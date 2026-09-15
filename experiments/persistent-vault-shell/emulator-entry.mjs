import {signInWithEmailAndPassword} from 'firebase/auth';
import {auth, db, functions} from './emulator-firebase.mjs';
import {openEmulatorQueue} from './emulator-queue.mjs';
import {createFirebasePrivateNoteSource} from './firebase-private-note-source.mjs';
import {createPrivateNotePanelProvider} from './private-note-panel-provider.mjs';
import {mountEmulatorList} from './emulator-list-view.mjs';
import {mountEmulatorDetail} from './emulator-detail-view.mjs';
import {createAccountDetailReader} from './account-detail-reader.mjs';
import {parseAccountDestination} from './account-route.mjs';
import {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import * as cryptoApi from '../../Frontend/public/assets/js/modules/core/crypto-utils.js';
import {createFirebaseSession} from './firebase-session.mjs';
import {createProfileSectionReader} from './profile-section-reader.mjs';
import {createProfileOverviewReader} from './profile-overview-reader.mjs';
import {buildProfileOverview, resolvePrimary, validateProfileWidget} from '../../Frontend/public/assets/js/modules/privato/profile-model.js';
import {createProfileWidgetReader} from './profile-widget-reader.mjs';
import {mountProfileWidgetView} from './profile-widget-view.mjs';
import {listProfileWidgets, listProfileWidgetsConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {getUserSetting, getUserSettingConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {createPrivateDigitalCardReader} from './private-digital-card-reader.mjs';
import {createCompanyDigitalCardReader} from './company-digital-card-reader.mjs';
import {buildCompanyVCard} from '../../Frontend/public/assets/js/modules/azienda/company-vcard.js';
import {mountDigitalCardView} from './digital-card-view.mjs';
import {buildVCard, buildProfileQrPayload, ensureQRCodeLib, renderQRCode} from '../../Frontend/public/assets/js/modules/shared/qr_code_utils-v2.js';
import {mountProfileShell} from './profile-shell-view.mjs';
import {createProfileLinkedAccountReader} from './profile-linked-account.mjs';
import {createCompanyProfileSource} from './company-profile-source.mjs';
import {companyProfileContacts} from '../../Frontend/public/assets/js/modules/azienda/company-profile-model.js';
import {getCompany, getCompanyConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {getUserProfile, getUserProfileConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {requestMaster} from './master-prompt.mjs';
import {probeOfflineConsultation} from './offline-consultation-probe.mjs';
import {prepareOfflineData} from '../../Frontend/public/assets/js/offline-sync.js';
import {createShellOfflinePreparation} from './shell-offline-preparation.mjs';
import {createCompanyDirectoryReader, mountCompanyDirectory, validateCompanyId} from './company-directory.mjs';
import {listCompanies, listCompaniesConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';
import {readErrorMessage} from '../../Frontend/public/assets/js/modules/shared/read-error-message.js';
import {createAccountWidgetReader} from './account-widget-reader.mjs';
import {mountAccountWidgetView} from './account-widget-view.mjs';
import {createBankingReader} from './banking-reader.mjs';
import {mountBankingView} from './banking-view.mjs';
import {normalizeEditableBankingAccounts} from '../../Frontend/public/assets/js/modules/shared/banking-model.js';
import {listAccountWidgets, listAccountWidgetsConfirmed, listSharedVaultData, listSharedVaultDataConfirmed} from '../../Frontend/public/assets/js/modules/data/vault-repository.js';

const byId = id => document.getElementById(id);
const content = byId('content'), status = byId('status'), message = byId('message');
let selectedRoute = 'private', busy = false;
let selectedAccount = null, detailReturnRoute = 'private';
let selectedCompanyId = null;
let listStates = {};
let probeContext;
export const runOfflineConsultationProbe = (options = {}) => probeOfflineConsultation({context: probeContext, getUser: () => auth.currentUser, ...options});
const offlinePreparation = createShellOfflinePreparation({getUser: () => auth.currentUser, prepare: prepareOfflineData,
    onState(state) {
        byId('offline-status').dataset.state = state;
        byId('offline-status').textContent = {idle: '', preparing: 'Preparazione dei dati per uso offline…', ready: 'Dati testuali pronti per uso offline.', incomplete: 'Preparazione offline incompleta. Riconnettiti e riprova.', offline: 'Offline: puoi consultare i dati già scaricati.'}[state];
    }});
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
        selectedAccount = parseAccountDestination(destination, {uid: auth.currentUser?.uid, companyId: selectedCompanyId});
        detailReturnRoute = selectedAccount.domain; selectedRoute = 'detail'; void session.navigate('detail');
    } catch (error) { showError(error); }
}
const mount = context => { probeContext = context; const key = context.route === 'company' ? `company:${selectedCompanyId}` : context.route; return mountEmulatorList(content, context, {
    companyId: selectedCompanyId, state: listStates[key], onRemember: state => { listStates[key] = state; }, onOpen: openDetail
}); };
const mountCompanies = context => {
    probeContext = context;
    const open = (companyId, route) => { context.assertUnlocked(); if (context.signal.aborted) return; selectedCompanyId = validateCompanyId(context.user.uid, companyId); navigateList(route); };
    return mountCompanyDirectory(content, context, {
        readCompanies: createCompanyDirectoryReader({context, getUser: () => auth.currentUser, repository: {listCompanies, listCompaniesConfirmed}, isEncryptedValue: cryptoApi.isEncryptedValue}),
        onOpenProfile: id => open(id, 'companyProfile'), onOpenAccounts: id => open(id, 'company'), errorMessage: error => readErrorMessage(error, 'Elenco aziende non disponibile.')
    });
};
const mountDetail = context => {
    probeContext = context;
    if (!selectedAccount || !context.unlocked) { content.replaceChildren(); return; }
    const selection = selectedAccount;
    const openAccount = createAccountDetailReader({context, getUser: () => auth.currentUser,
        repository: {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed}});
    const mountSavePanel = createPrivateNotePanelProvider({context, getUser: () => auth.currentUser,
        readSource: createFirebasePrivateNoteSource({auth, db}), deviceId: 'loopback-laboratory',
        openQueue: options => session.openMutationQueue(options)});
    const widgetReader = createAccountWidgetReader({context, getUser: () => auth.currentUser, selection,
        repository: {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed,
            listAccountWidgets, listAccountWidgetsConfirmed, listSharedVaultData, listSharedVaultDataConfirmed}});
    return mountEmulatorDetail(content, context, {selection, openAccount, mountSavePanel,
        mountWidgets: async root => {
            const generic = await mountAccountWidgetView(root, context, {reader: {
                list: async () => (await widgetReader.list()).filter(widget => !widget.bankId), read: (...args) => widgetReader.read(...args)}});
            try {
                const banking = await mountBankingView(root, context, {widgetReader,
                    listBanks: createBankingReader({context, getUser: () => auth.currentUser, selection, normalize: normalizeEditableBankingAccounts,
                        isEncryptedValue: cryptoApi.isEncryptedValue, repository: {getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed}})});
                return () => {try {banking();} finally {generic();}};
            } catch (error) {generic(); throw error;}
        },
        backLabel: ['profile', 'companyProfile'].includes(detailReturnRoute) ? 'Torna al profilo' : 'Torna alla lista', onBack: () => navigateList(detailReturnRoute)});
};
const mountProfile = context => {
    probeContext = context;
    const company = context.route === 'companyProfile';
    const source = company ? createCompanyProfileSource({uid: context.user.uid, companyId: selectedCompanyId, repository: {getCompany, getCompanyConfirmed}, normalizeContacts: companyProfileContacts}) : undefined;
    return mountProfileShell(content, context, {profileTitle: company ? 'Profilo aziendale' : 'Profilo utente', readSection: createProfileSectionReader({context, source,
        getUser: () => auth.currentUser, repository: {getUserProfile}, isEncryptedValue: cryptoApi.isEncryptedValue}),
        readOverview: createProfileOverviewReader({context, source, getUser: () => auth.currentUser,
            repository: {getUserProfile, getUserProfileConfirmed}, isEncryptedValue: cryptoApi.isEncryptedValue, buildProfileOverview, resolvePrimary}),
        mountWidgets: company ? undefined : (root, {section, signal}) => {
            const scoped = {...context, signal};
            return mountProfileWidgetView(root, scoped, {reader: createProfileWidgetReader({context: scoped, getUser: () => auth.currentUser,
                repository: {listProfileWidgets, listProfileWidgetsConfirmed}, tab: section, validateProfileWidget})});
        },
        mountDigitalCard: (root, {signal}) => {
            const scoped = {...context, signal};
            return mountDigitalCardView(root, scoped, {
                generate: company ? createCompanyDigitalCardReader({context: scoped, source, getUser: () => auth.currentUser,
                    isEncryptedValue: cryptoApi.isEncryptedValue, buildVCard: buildCompanyVCard}) : createPrivateDigitalCardReader({context: scoped, getUser: () => auth.currentUser,
                    repository: {getUserProfile, getUserProfileConfirmed, getUserSetting, getUserSettingConfirmed, listProfileWidgets, listProfileWidgetsConfirmed},
                    isEncryptedValue: cryptoApi.isEncryptedValue, buildVCard}),
                // The loopback lab has no public receiver. Photo-bearing QR
                // codes target the existing receiver; creating this fragment
                // performs no request, upload or publication.
                loadQr: ensureQRCodeLib, makePayload: card => company ? card : buildProfileQrPayload(card, 'https://appcodici-password.web.app'),
                renderQr: (target, payload) => renderQRCode(target, payload, {width: 220, height: 220}),
                download: async (card, check) => {
                    check(); const url = URL.createObjectURL(new Blob([card], {type: 'text/vcard;charset=utf-8'}));
                    const anchor = document.createElement('a');
                    try {check(); anchor.href = url; anchor.download = company ? 'contatto-azienda.vcf' : 'contatto.vcf'; anchor.click();}
                    finally {anchor.removeAttribute('href'); URL.revokeObjectURL(url);}
                }
            });
        },
        linkedAccounts: createProfileLinkedAccountReader({context, source, getUser: () => auth.currentUser,
            repository: {getUserProfile, getUserProfileConfirmed, getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed}}),
        onOpenAccount(selection) { context.assertUnlocked(); selectedAccount = selection; detailReturnRoute = context.route; selectedRoute = 'detail'; void session.navigate('detail'); }});
};
const session = createFirebaseSession({auth, db, cryptoApi,
    createQueueClient: scope => openEmulatorQueue({auth, functions, ...scope}),
    requestPassword: options => requestMaster(byId('master-dialog'), options),
    routes: {overview: mount, private: mount, company: mount, detail: mountDetail, profile: mountProfile, companyProfile: mountProfile, companies: mountCompanies},
    onState({state}) {
        if (state === 'unlocked') void offlinePreparation.refresh();
        else offlinePreparation.clear();
        status.textContent = state === 'unlocked' ? 'Vault sbloccato' : state === 'locked' ? 'Accesso effettuato · Vault bloccato' : 'Accesso non effettuato';
        if (state !== 'unlocked') {
            probeContext = null;
            content.replaceChildren(); listStates = {};
            if (selectedRoute === 'detail') selectedRoute = selectedAccount?.domain || 'private';
            selectedAccount = null;
            selectedCompanyId = null;
            if (['company', 'companyProfile'].includes(selectedRoute)) selectedRoute = 'companies';
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
for (const route of ['private', 'profile', 'companies']) byId(route).addEventListener('click', () => {
    navigateList(route);
});
document.addEventListener('pointerdown', () => session.touch());
document.addEventListener('keydown', () => session.touch());
document.addEventListener('visibilitychange', () => { if (document.hidden) session.lock('background'); });
window.addEventListener('pagehide', () => session.lock('pagehide'));
setInterval(() => session.check(), 1000);
refreshControls();
