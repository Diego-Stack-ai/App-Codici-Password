import {mountAccountPrivati} from '../../Frontend/public/assets/js/modules/privato/account_privati.js';
import {mountAccountAziendaList} from '../../Frontend/public/assets/js/modules/azienda/account_azienda.js';
import {auth} from './emulator-firebase.mjs';

export async function mountEmulatorList(root, context, {state = {}, onRemember = () => {}, onOpen = () => {}} = {}) {
    if (context.signal.aborted) return;
    root.replaceChildren();
    if (!context.unlocked) { root.textContent = 'Sblocca il Vault per leggere gli account di prova.'; return; }
    const user = auth.currentUser;
    if (!user || user.uid !== context.user?.uid) throw new Error('AUTH_CHANGED');
    const wrapper = document.createElement('div');
    const title = document.createElement('h2');
    const company = context.route === 'company';
    title.textContent = company ? 'Account aziendali · dati fittizi' : 'Account privati · dati fittizi';
    const search = document.createElement('input');
    search.id = 'account-search'; search.type = 'search'; search.placeholder = 'Cerca account';
    search.setAttribute('aria-label', 'Cerca account'); search.autocomplete = 'off';
    const sort = document.createElement('button'); sort.id = 'sort-btn'; sort.setAttribute('aria-label', 'Cambia ordinamento');
    const sortLabel = document.createElement('span'); sortLabel.id = 'sort-label'; sort.append(sortLabel);
    const info = document.createElement('p');
    info.textContent = 'Liste e repository dell’app, collegati agli emulatori. Apri una card per il dettaglio base. Salvataggi non disponibili.';
    const container = document.createElement('div'); container.id = 'accounts-container';
    wrapper.append(title, search, sort, info, container); root.append(wrapper);
    const mount = company ? mountAccountAziendaList : mountAccountPrivati;
    const page = mount({uid: user.uid, email: user.email}, {signal: context.signal, readOnly: true,
        search: company ? '?id=company' : '?type=standard',
        async readField(record, field) {
            if (context.signal.aborted || auth.currentUser?.uid !== user.uid) throw new Error('VIEW_DISPOSED');
            if (!['nomeAccount', 'username', 'account', 'password'].includes(field)) throw new Error('FIELD_NOT_ALLOWED');
            if (Object.hasOwn(record, 'ownerId') && record.ownerId !== user.uid) throw new Error('OWNER_MISMATCH');
            return context.read({ownerId: user.uid, ciphertext: record[field]});
        },
        navigate: destination => { if (!context.signal.aborted) onOpen(destination); }
    });
    let disposed = false;
    const cleanup = () => {
        if (disposed) return;
        disposed = true; context.signal.removeEventListener('abort', cleanup);
        onRemember({search: search.value, descending: sortLabel.textContent === 'Z-A'});
        try { page.destroy(); } finally { wrapper.remove(); }
    };
    context.signal.addEventListener('abort', cleanup, {once: true});
    if (context.signal.aborted) cleanup();
    try { await page.ready; } catch (error) { cleanup(); throw error; }
    if (!context.signal.aborted) {
        search.value = state.search || '';
        search.dispatchEvent(new Event('input'));
        if (state.descending) sort.click();
    }
    return cleanup;
}
