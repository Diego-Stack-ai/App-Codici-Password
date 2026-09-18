import {parseAccountDestination} from './account-route.mjs';

export function validateCompanyId(uid, companyId) {
    parseAccountDestination(`dettaglio_account_azienda.html?id=validation&aziendaId=${encodeURIComponent(companyId)}`, {uid, companyId});
    return companyId;
}
export function createCompanyDirectoryReader({context, getUser, repository, isEncryptedValue, isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    const check = () => {
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        context.assertUnlocked();
    };
    return async () => {
        check();
        // A single previously opened profile does not prove cache completeness.
        const records = await repository[isOnline() ? 'listCompaniesConfirmed' : 'listCompanies'](uid);
        check();
        if (!Array.isArray(records)) throw new Error('COMPANY_LIST_INVALID');
        const rows = [], seen = new Set();
        for (const record of records) {
            check();
            if (!record || (Object.hasOwn(record, 'ownerId') && record.ownerId !== uid)) throw new Error('OWNER_MISMATCH');
            const id = validateCompanyId(uid, record.id);
            if (seen.has(id)) throw new Error('COMPANY_LIST_INVALID');
            seen.add(id);
            if (record.isArchived) continue;
            const value = record.ragioneSociale ?? '';
            if (typeof value !== 'string') throw new Error('COMPANY_NAME_INVALID');
            const title = isEncryptedValue(value) ? await context.read({ownerId: uid, ciphertext: value}) : value;
            check();
            if (typeof title !== 'string') throw new Error('COMPANY_NAME_INVALID');
            rows.push(Object.freeze({id, title: title || 'Azienda senza nome'}));
        }
        check(); return rows;
    };
}

export async function mountCompanyDirectory(root, context, {readCompanies, onOpenProfile, onOpenAccounts, errorMessage = () => 'Elenco aziende non disponibile. Riprova dopo lo sblocco o la connessione.'}) {
    if (!context.unlocked || context.signal.aborted) return () => {};
    let disposed = false, records = [], renderControls;
    const controls = new AbortController(), host = document.createElement('section');
    const title = document.createElement('h2'); title.textContent = 'Aziende';
    const search = document.createElement('input'); search.type = 'search'; search.autocomplete = 'off';
    search.placeholder = 'Cerca azienda'; search.setAttribute('aria-label', 'Cerca azienda'); search.dataset.companySearch = 'true';
    const list = document.createElement('div'), status = document.createElement('p'); status.setAttribute('role', 'status');
    status.textContent = 'Caricamento aziende…';
    const active = () => { if (disposed || context.signal.aborted) return false; context.assertUnlocked(); return true; };
    const clearList = () => { renderControls?.abort(); for (const node of list.querySelectorAll('h3')) node.textContent = ''; list.replaceChildren(); };
    const dispose = () => {
        if (disposed) return;
        disposed = true; controls.abort(); context.signal.removeEventListener('abort', dispose);
        records = []; search.value = ''; clearList(); host.remove();
    };
    function render() {
        if (!active()) return;
        clearList(); renderControls = new AbortController();
        const query = (search.value || '').trim().toLocaleLowerCase('it');
        const filtered = records.filter(row => row.title.toLocaleLowerCase('it').includes(query));
        status.textContent = filtered.length ? `${filtered.length} aziende` : 'Nessuna azienda trovata.';
        for (const row of filtered) {
            const card = document.createElement('article'), heading = document.createElement('h3'); heading.textContent = row.title;
            card.append(heading);
            for (const [label, action, key] of [['Apri profilo', onOpenProfile, 'companyProfile'], ['Apri Account', onOpenAccounts, 'companyAccounts']]) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset[key] = row.id;
                button.addEventListener('click', () => { try { if (active()) action(row.id); } catch { if (!disposed) status.textContent = 'Operazione non disponibile. Riapri la lista.'; } }, {signal: renderControls.signal});
                card.append(button);
            }
            list.append(card);
        }
    }
    search.addEventListener('input', () => { try { render(); } catch { dispose(); } }, {signal: controls.signal});
    host.append(title, search, status, list); root.append(host);
    context.signal.addEventListener('abort', dispose, {once: true});
    try {
        records = await readCompanies();
        if (!active()) { records = []; return dispose; }
        render();
    } catch (error) { records = []; if (!disposed && !context.signal.aborted) { clearList(); status.textContent = errorMessage(error); } }
    return dispose;
}
