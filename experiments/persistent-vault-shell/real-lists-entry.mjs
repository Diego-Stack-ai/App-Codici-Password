import {mountAccountPrivati} from '../../Frontend/public/assets/js/modules/privato/account_privati.js';
import {mountAccountAziendaList} from '../../Frontend/public/assets/js/modules/azienda/account_azienda.js';
import {installFixture} from './fixture-repository.mjs';
export {createProtectedSession} from './protected-session.mjs';

// Mount canonical page orchestrators with an explicitly synthetic repository.
export async function mountRealList(root, records, {signal, company = false}) {
    if (signal.aborted) return () => {};
    const title = document.createElement('h2');
    title.textContent = company ? 'Account aziendali · dati fittizi' : 'Account privati · dati fittizi';
    const search = document.createElement('input');
    search.id = 'account-search'; search.type = 'search'; search.placeholder = 'Cerca account';
    search.setAttribute('aria-label', 'Cerca account'); search.autocomplete = 'off';
    const sort = document.createElement('button');
    sort.id = 'sort-btn'; sort.setAttribute('aria-label', 'Cambia ordinamento');
    const label = document.createElement('span'); label.id = 'sort-label'; sort.append(label);
    const info = document.createElement('p');
    info.textContent = 'Liste reali in sola lettura. Dettagli e salvataggi non sono ancora disponibili nella demo.';
    const container = document.createElement('div'); container.id = 'accounts-container';
    root.append(title, search, sort, info, container);
    const release = installFixture(records);
    records = [];
    const mount = company ? mountAccountAziendaList : mountAccountPrivati;
    const page = mount({uid: 'demo-user', email: 'demo@example.invalid'}, {
        signal, readOnly: true, search: company ? '?id=demo-company' : '?type=standard',
        navigate: () => { info.textContent = 'Il dettaglio Account non è ancora incluso in questa demo.'; }
    });
    let disposed = false;
    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        signal.removeEventListener('abort', cleanup);
        try { page.destroy(); } finally { release(); root.replaceChildren(); }
    };
    signal.addEventListener('abort', cleanup, {once: true});
    if (signal.aborted) cleanup();
    try { await page.ready; } catch (error) { cleanup(); throw error; }
    return cleanup;
}
