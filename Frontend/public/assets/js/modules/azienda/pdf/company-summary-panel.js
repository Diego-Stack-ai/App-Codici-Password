import {createCompanySummaryReader} from './company-summary-reader.js';
import {mountCompanySummaryView} from './company-summary-view.js';
import {createCompanyPdfActions} from './company-summary-browser.js';

// The legacy page supplies only scoped read/decrypt capabilities. Never retain
// a Vault Key, whole company record, or generated file outside this panel.
export function mountCompanyPdfPanel(root, companyId, dependencies) {
    const {getUser, ensureUnlocked, isUnlocked, readCompany, decryptValue, isEncryptedValue,
        events = window, subscribeAuth, mountView = mountCompanySummaryView, createActions = createCompanyPdfActions} = dependencies;
    const uid = getUser()?.uid, abort = new AbortController();
    let viewCleanup, actions, unsubscribe, disposed = false;
    const dispose = () => {
        if (disposed) return; disposed = true; abort.abort(); viewCleanup?.(); actions?.dispose(); unsubscribe?.(); root.replaceChildren();
    };
    const checkIdentity = () => {if (disposed || abort.signal.aborted || !uid || getUser()?.uid !== uid) throw Error('PDF_SESSION_CHANGED');};
    const check = () => {checkIdentity(); if (!isUnlocked()) {dispose(); throw Error('PDF_VAULT_LOCKED');}};
    events.addEventListener('pagehide', dispose, {signal: abort.signal});
    events.addEventListener('private-auth-blocked', dispose, {signal: abort.signal});
    events.addEventListener('vault-state-changed', () => {if (!isUnlocked()) dispose();}, {signal: abort.signal});
    unsubscribe = subscribeAuth(user => {if (user?.uid !== uid) dispose();});
    if (disposed) unsubscribe?.();
    const context = {user: {uid}, signal: abort.signal, assertUnlocked: check,
        async read({ownerId, ciphertext}) {
            check(); if (ownerId !== uid) throw Error('PDF_OWNER_MISMATCH');
            const value = await decryptValue(ciphertext); check(); return value;
        }};
    const source = {domain: 'company', companyId, async read(owner, confirmed) {
        check(); if (owner !== uid) throw Error('PDF_OWNER_MISMATCH');
        const record = await readCompany(uid, companyId, confirmed); check();
        if (!record || record.id !== companyId || (record.ownerId !== undefined && record.ownerId !== uid)) throw Error('PDF_COMPANY_MISMATCH');
        return record;
    }};
    root.textContent = 'Preparazione scheda aziendale…';
    void (async () => {
        try {
            checkIdentity(); await ensureUnlocked(); check();
            root.replaceChildren();
            actions = createActions({assertActive: check});
            const read = createCompanySummaryReader({context, getUser, source, isEncryptedValue});
            viewCleanup = mountView(root, context, {read, ...actions});
        } catch {
            if (!disposed) {dispose(); root.textContent = 'Scheda non disponibile. Sblocca il Vault e riapri questa linguetta.';}
        }
    })();
    return dispose;
}
