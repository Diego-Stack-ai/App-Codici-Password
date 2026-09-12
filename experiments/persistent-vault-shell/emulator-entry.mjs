import {signInWithEmailAndPassword} from 'firebase/auth';
import {auth, db} from './emulator-firebase.mjs';
import {mountEmulatorList} from './emulator-list-view.mjs';
import {mountEmulatorDetail} from './emulator-detail-view.mjs';
import {createAccountDetailReader} from './account-detail-reader.mjs';
import {parseAccountDestination} from './account-route.mjs';
import {getPrivateAccount, getCompanyAccount} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import * as cryptoApi from '../../Frontend/public/assets/js/modules/core/crypto-utils.js';
import {createFirebaseSession} from './firebase-session.mjs';
import {requestMaster} from './master-prompt.mjs';

const byId = id => document.getElementById(id);
const content = byId('content'), status = byId('status'), message = byId('message');
let selectedRoute = 'private', busy = false;
let selectedAccount = null;
let listStates = {};
function refreshControls() {
    byId('login').disabled = busy || Boolean(auth.currentUser);
    byId('identity').disabled = busy || Boolean(auth.currentUser);
    byId('unlock').disabled = busy || !auth.currentUser;
    byId('logout').disabled = busy;
}
function showError(error) {
    const known = {INVALID_MASTER_PASSWORD: 'Master Password non corretta.', UNLOCK_CANCELLED: 'Sblocco annullato.', AUTH_REQUIRED: 'Accedi prima al laboratorio.'};
    message.textContent = known[error.message] || 'Operazione non riuscita. Verifica che gli emulatori siano attivi.';
}
function navigateList(domain) {
    selectedAccount = null; selectedRoute = domain;
    void session.navigate(domain);
}
function openDetail(destination) {
    try {
        selectedAccount = parseAccountDestination(destination, {uid: auth.currentUser?.uid});
        selectedRoute = 'detail'; void session.navigate('detail');
    } catch (error) { showError(error); }
}
const mount = context => mountEmulatorList(content, context, {
    state: listStates[context.route], onRemember: state => { listStates[context.route] = state; }, onOpen: openDetail
});
const mountDetail = context => {
    if (!selectedAccount || !context.unlocked) { content.replaceChildren(); return; }
    const selection = selectedAccount;
    const openAccount = createAccountDetailReader({context, getUser: () => auth.currentUser,
        repository: {getPrivateAccount, getCompanyAccount}});
    return mountEmulatorDetail(content, context, {selection, openAccount, onBack: () => navigateList(selection.domain)});
};
const session = createFirebaseSession({auth, db, cryptoApi,
    requestPassword: options => requestMaster(byId('master-dialog'), options),
    routes: {overview: mount, private: mount, company: mount, detail: mountDetail},
    onState({state}) {
        status.textContent = state === 'unlocked' ? 'Vault sbloccato' : state === 'locked' ? 'Accesso effettuato · Vault bloccato' : 'Accesso non effettuato';
        if (state !== 'unlocked') {
            content.replaceChildren(); listStates = {};
            if (selectedRoute === 'detail') selectedRoute = selectedAccount?.domain || 'private';
            selectedAccount = null;
        }
        refreshControls();
    }, onError: showError
});
async function run(action) {
    if (busy) return;
    busy = true; message.textContent = ''; refreshControls();
    try { await action(); } catch (error) { showError(error); }
    finally { busy = false; refreshControls(); }
}
byId('login').addEventListener('click', () => run(async () => {
    await signInWithEmailAndPassword(auth, `${byId('identity').value}@example.invalid`, 'LOGIN-SOLO-EMULATORE!123');
    await session.navigate(selectedRoute);
}));
byId('unlock').addEventListener('click', () => run(async () => { await session.unlock(); await session.navigate(selectedRoute); }));
byId('lock').addEventListener('click', () => session.lock());
byId('logout').addEventListener('click', () => run(() => session.logout()));
for (const route of ['private', 'company']) byId(route).addEventListener('click', () => {
    navigateList(route);
});
document.addEventListener('pointerdown', () => session.touch());
document.addEventListener('keydown', () => session.touch());
document.addEventListener('visibilitychange', () => { if (document.hidden) session.lock('background'); });
window.addEventListener('pagehide', () => session.lock('pagehide'));
setInterval(() => session.check(), 1000);
refreshControls();
