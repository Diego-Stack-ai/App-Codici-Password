import {profileLinkAccount} from './profile-link-contract.mjs';

// Standalone picker: selection does not write or create an Account. The caller
// must use the guarded relationship source and transactional service to save.
export async function mountProfileAccountPicker(root, context, {load, filterAccounts, onSelect, onCancel}) {
    const host = document.createElement('section'), search = document.createElement('input'), scope = document.createElement('select');
    const list = document.createElement('div'), status = document.createElement('p'), more = document.createElement('button'), cancel = document.createElement('button');
    const controls = new AbortController(); let renderControls, rows = [], disposed = false, maximum = 50;
    host.dataset.profileAccountPicker = 'true'; search.type = 'search'; search.autocomplete = 'off'; search.maxLength = 1000;
    search.placeholder = 'Cerca Account o azienda'; search.setAttribute('aria-label', 'Cerca Account o azienda');
    scope.setAttribute('aria-label', 'Ambito degli Account'); status.setAttribute('role', 'status');
    more.type = cancel.type = 'button'; more.textContent = 'Mostra altri'; cancel.textContent = 'Annulla'; more.hidden = true;
    const check = () => {if (disposed || context.signal.aborted) throw Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const clear = () => {renderControls?.abort(); for (const node of list.querySelectorAll('button')) node.textContent = ''; list.replaceChildren();};
    const dispose = () => {
        if (disposed) return; disposed = true; controls.abort(); context.signal.removeEventListener('abort', dispose);
        clear(); rows = []; search.value = search.defaultValue = ''; scope.value = '';
        for (const option of scope.querySelectorAll('option')) option.textContent = '';
        scope.replaceChildren(); status.textContent = ''; host.remove();
    };
    const addScope = (value, title) => {const option = document.createElement('option'); option.value = value; option.textContent = title; scope.append(option);};
    const render = () => {
        check(); clear(); renderControls = new AbortController();
        const filtered = filterAccounts(rows, search.value.slice(0, 1000), scope.value || 'all'), visible = filtered.slice(0, maximum);
        status.textContent = filtered.length ? `${visible.length} di ${filtered.length} Account` : 'Nessun Account trovato.';
        more.hidden = visible.length === filtered.length;
        for (const row of visible) {
            const button = document.createElement('button'); button.type = 'button';
            button.textContent = `${row.name} — ${row.companyId ? row.companyName : 'Personale'}`;
            button.addEventListener('click', () => {
                try {check(); const selection = row.selection; dispose(); onSelect(selection);} catch {dispose();}
            }, {signal: renderControls.signal}); list.append(button);
        }
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    try {
        check(); status.textContent = 'Caricamento Account…'; host.append(search, scope, status, list, more, cancel); root.append(host);
        cancel.addEventListener('click', () => {dispose(); onCancel();}, {signal: controls.signal});
        const loaded = await load(); check();
        if (!Array.isArray(loaded) || loaded.length > 10000) throw Error('PROFILE_PICKER_INVALID');
        const companies = new Map(), seen = new Set();
        rows = loaded.map(row => {
            const selection = profileLinkAccount(row.selection), key = JSON.stringify(selection);
            if (!selection || seen.has(key) || typeof row.name !== 'string' || row.name.length > 1000 ||
                typeof row.companyName !== 'string' || row.companyName.length > 1000 || row.companyId !== (selection.companyId || '')) throw Error('PROFILE_PICKER_INVALID');
            seen.add(key);
            if (row.companyId) {
                if (companies.has(row.companyId) && companies.get(row.companyId) !== row.companyName) throw Error('PROFILE_PICKER_INVALID');
                companies.set(row.companyId, row.companyName);
            }
            return Object.freeze({selection, name: row.name, companyId: row.companyId, companyName: row.companyName});
        });
        addScope('all', 'Tutti gli Account'); addScope('personal', 'Personali');
        for (const [id, name] of companies) addScope('company:' + id, name);
        scope.value = 'all';
        for (const [node, event] of [[search, 'input'], [scope, 'change']]) node.addEventListener(event, () => {try {maximum = 50; render();} catch {dispose();}}, {signal: controls.signal});
        more.addEventListener('click', () => {try {maximum += 50; render();} catch {dispose();}}, {signal: controls.signal});
        render();
    } catch (error) {dispose(); throw error;}
    return dispose;
}
