// Synthetic browser scenario for the company contacts editor (A1b-R1). It runs
// inside the laboratory page served by emulator-browser.mjs, mounts the real
// provider, source, view, save controller and *transactional service* of A1b over
// an isolated in-memory store, drives the interface with DOM events and reports
// the outcome to the harness. No real company, account, attachment or production
// resource is involved: the fixtures are synthetic and live in the page.
import {createCompanyContactsHandler} from '/modules/company-contacts-handler.mjs';
import {mountCompanyContactsEditorProvider} from '/modules/company-contacts-editor-provider.mjs';

const checks = [];
const errors = [];
const record = (name, value, detail = '') => checks.push({name, ok: Boolean(value), detail});
globalThis.addEventListener('error', event => errors.push(`error: ${event.message}`));
globalThis.addEventListener('unhandledrejection', event => errors.push(`rejection: ${event.reason?.message ?? event.reason}`));
const originalError = console.error;
console.error = (...args) => {errors.push(`console.error: ${args.join(' ')}`); originalError(...args);};
const tick = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, detail) => {if (!value) throw Error(detail ?? 'expected a truthy value'); return value;};
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
const cipher = value => `${btoa(String.fromCharCode(...new Uint8Array(48).fill(42)))}${btoa(String(value))}`;
const isCipher = value => typeof value === 'string' && value.length >= 60 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
// The synthetic company schema the unit and emulator suites use: e-mail slots as
// objects (only `password` is ciphertext), telephones as top-level strings,
// repeatable rows with and without a stable id, an Account link, a card selection
// and unknown fields that must survive.
const companyRecord = qrConfig => ({
    ownerId: 'owner', id: 'contatti', ragioneSociale: cipher('Azienda fittizia'), campoIgnoto: 'da conservare',
    aziendaEmail: 'legacy@example.invalid', aziendaEmailPassword: cipher('legacy-pass'),
    emails: {
        pec: {email: cipher('pec@example.invalid'), tipo: 'PEC', password: cipher('pec-pass'), note: 'nota pec',
            linkedAccountId: 'zeta', linkedAccountCompanyId: 'contatti'},
        amministrazione: {email: cipher('amm@example.invalid'), tipo: 'Amministrazione'},
        personale: {tipo: ''},
        extra: [
            {id: 'company-email-1', email: cipher('extra1@example.invalid'), tipo: 'Ufficio', password: cipher('extra-pass'), qr: false},
            {id: 'company-email-2', email: cipher('extra2@example.invalid'), tipo: 'Magazzino', qr: true},
            {email: cipher('senza@example.invalid'), tipo: 'Senza identità'}],
        altro: 'da conservare'},
    telefonoAzienda: '0110000000', faxAzienda: '0110000001', referenteCellulare: '3330000000',
    phoneAccountLinks: {referenteCellulare: {linkedAccountId: 'zeta', linkedAccountCompanyId: 'contatti'}},
    qrConfig, _companyContactsRevision: 1
});
const VALID_QR = {aziendaEmail: true, adminEmail: true, persEmail: false, telefonoAzienda: false,
    referenteCellulare: true, qrLegale: true};
const storedPath = 'users/owner/aziende/contatti';
// In-memory stand-in for Firestore: a transaction refuses a read after a write and
// serialises concurrent runs, exactly like the unit harness of the A1b service.
function createStore(seed) {
    const data = new Map([[storedPath, structuredClone(seed)]]);
    let chain = Promise.resolve();
    return {get: () => structuredClone(data.get(storedPath)),
        doc: value => value,
        runTransaction(run) {
            const next = chain.then(async () => {
                const staged = new Map();
                let written = false;
                const result = await run({
                    async get(ref) {
                        assert(!written, 'READ_AFTER_WRITE');
                        return {exists: data.has(ref), data: () => structuredClone(data.get(ref))};
                    },
                    update(ref, patch) {written = true; staged.set(ref, {...structuredClone(data.get(ref)), ...structuredClone(patch)});},
                    create(ref, value) {written = true; assert(!data.has(ref), 'RECEIPT_EXISTS'); staged.set(ref, structuredClone(value));}
                });
                for (const [key, value] of staged) data.set(key, value);
                return result;
            });
            chain = next.then(() => {}, () => {});
            return next;
        }};
}
// One isolated mount: its own store, service, source and host. The decryptor is a
// deliberate stub — this scenario proves the interface boundary, not the Vault.
async function mountCompany(qrConfig, {online = true} = {}) {
    const store = createStore(companyRecord(qrConfig));
    const state = {online, locked: false, uid: 'owner', submits: 0, saved: 0, hold: false, release: null};
    const abort = new AbortController();
    const context = {user: {uid: 'owner'}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');},
        async encrypt(value) {return cipher(value);},
        async read({ciphertext}) {return `plain:${ciphertext.slice(0, 8)}`;}};
    const source = {domain: 'company', companyId: 'contatti', async read() {return store.get();}};
    const handler = createCompanyContactsHandler({db: store, hash, timestamp: () => 123});
    const host = document.createElement('section');
    host.id = 'company-contacts-scenario';
    document.body.append(host);
    let counter = 0, cleanup = null;
    const mount = async () => {cleanup = await mountCompanyContactsEditorProvider(host, context, {
        getUser: () => ({uid: state.uid}), source, isEncryptedValue: isCipher, hash,
        createId: () => `company-email-nuovo-${++counter}`, isOnline: () => state.online,
        onSaved: async () => {state.saved += 1; cleanup?.(); cleanup = null; await mount(); await tick();},
        onCancel: () => {},
        submit: async request => {
            state.submits += 1;
            if (state.hold) await new Promise(resolve => {state.release = resolve;});
            return handler(request, {auth: {uid: 'owner'}, app: {appId: 'synthetic-not-http-attestation'}});
        }});};
    await mount();
    await tick();
    const rows = () => [...host.querySelectorAll('[data-company-row]')];
    return {host, store, state, abort,
        rows,
        row: id => host.querySelector(`[data-company-row][data-company-id="${id}"]`),
        field: (id, key) => host.querySelector(`[data-company-row][data-company-id="${id}"] [data-company-field="${key}"]`),
        message: id => host.querySelector(`[data-company-row][data-company-id="${id}"] [data-company-message]`)?.textContent ?? '',
        rowAction: (id, name) => host.querySelector(`[data-company-row][data-company-id="${id}"] [data-company-action="${name}"]`),
        action: name => host.querySelector(`[data-company-action="${name}"]`),
        status: () => host.querySelector('[data-company-status]')?.textContent ?? '',
        orphan: () => rows().find(row => row.dataset.companyKind === 'email-extra' && row.dataset.companyId === ''),
        dispose: () => {cleanup?.(); cleanup = null;}};
}
try {
    // The real loopback endpoint must keep refusing unauthenticated requests.
    const denied = await fetch('/demo-vault-shell/europe-west1/applyCompanyContactsMutation', {method: 'POST', body: '{}'});
    record('endpoint A1b: richiesta anonima respinta dal bridge reale', denied.status === 401, `status=${denied.status}`);

    const f = await mountCompany(VALID_QR);
    // 1. Rendering and company labels.
    const rendered = f.rows().map(row => [row.dataset.companyKind, row.dataset.companyId]);
    record('rendering: slot fissi, righe extra e telefoni nella stessa linguetta',
        rendered.length === 9 && rendered[0][0] === 'email-slot' && rendered[5][0] === 'email-extra' && rendered[6][0] === 'phone-slot',
        JSON.stringify(rendered));
    record('etichette aziendali: quella dello schema vince, altrimenti la migliore etichetta aziendale',
        f.row('pec')?.textContent.includes('PEC') && f.row('amministrazione')?.textContent.includes('Amministrazione')
        && f.row('personale')?.textContent.includes('Email personale')
        && f.row('telefonoAzienda')?.textContent.includes('Telefono azienda') && f.row('faxAzienda')?.textContent.includes('Fax')
        && f.row('referenteCellulare')?.textContent.includes('Cellulare referente')
        && f.row('company-email-1')?.textContent.includes('Ufficio'),
        [f.row('personale')?.textContent, f.row('referenteCellulare')?.textContent].join(' | '));
    record('password legacy: campo segreto, decifrata per la sola vista',
        f.field('pec', 'password')?.type === 'password' && f.field('pec', 'password').value.startsWith('plain:'));
    // 2. Guards visible without any request.
    record('riga senza ID persistito: consultabile ma non eliminabile',
        Boolean(f.orphan()) && f.field('', 'tipo')?.value === 'Senza identità' && f.rowAction('', 'delete').disabled
        && /ID persistito/.test(f.message('')), f.message(''));
    record('riga pubblicata sulla tessera: eliminazione disabilitata',
        f.rowAction('company-email-2', 'delete').disabled && /tessera digitale/.test(f.message('company-email-2')), f.message('company-email-2'));
    record('slot collegato a un Account: eliminazione disabilitata e motivo esplicito',
        f.rowAction('pec', 'delete').disabled && /Collegato a un Account/.test(f.message('pec')), f.message('pec'));
    // 3. Confirmed save through the real service and immediate re-read in the same tab.
    const before = f.store.get();
    f.field('amministrazione', 'email').value = 'nuova@example.invalid';
    f.field('telefonoAzienda', 'number').value = '0119999999';
    f.action('save').click();
    await tick(60); await tick(60);
    const after = f.store.get();
    record('salvataggio confermato dal servizio reale e rilettura nella stessa linguetta',
        f.state.submits === 1 && after._companyContactsRevision === 2
        && after.emails.amministrazione.email === cipher('nuova@example.invalid') && after.telefonoAzienda === '0119999999'
        && f.field('amministrazione', 'email')?.value.startsWith('plain:') && f.field('telefonoAzienda', 'number')?.value === '0119999999',
        `revisione=${after._companyContactsRevision}`);
    record('campi non toccati, legacy e sconosciuti preservati',
        after.emails.pec.password === before.emails.pec.password && after.aziendaEmail === before.aziendaEmail
        && after.emails.altro === 'da conservare' && after.campoIgnoto === 'da conservare'
        && after.phoneAccountLinks.referenteCellulare.linkedAccountId === 'zeta'
        && JSON.stringify(after.qrConfig) === JSON.stringify(before.qrConfig));
    // 4. A new row is discarded locally, without any request.
    const submitsBeforeDiscard = f.state.submits;
    f.action('add').click();
    const created = f.rows().find(row => row.dataset.companyNew === 'true');
    assert(created && created.dataset.companyId.startsWith('company-email-'), 'NEW_ROW_ID');
    created.querySelector('[data-company-action="delete"]').click();
    await tick();
    f.action('save').click();
    await tick();
    record('riga nuova scartata localmente senza richiesta backend',
        f.rows().every(row => row.dataset.companyNew !== 'true') && f.state.submits === submitsBeforeDiscard
        && /Nessuna modifica da salvare/.test(f.status()), `submit=${f.state.submits} status=${f.status()}`);
    // 5. Creation with a stable identity, then double confirmation and deletion.
    f.action('add').click();
    const fresh = f.rows().find(row => row.dataset.companyNew === 'true');
    const freshId = fresh.dataset.companyId;
    fresh.querySelector('[data-company-field="email"]').value = 'laboratorio@example.invalid';
    fresh.querySelector('[data-company-field="tipo"]').value = 'Laboratorio';
    f.action('save').click();
    await tick(60); await tick(60);
    const savedRow = f.store.get().emails.extra.find(item => item.id === freshId);
    record('creazione con identità stabile e riga non pubblicata sulla tessera',
        Boolean(savedRow) && savedRow.email === 'laboratorio@example.invalid' && savedRow.tipo === 'Laboratorio'
        && savedRow.qr === false && f.rows().some(row => row.dataset.companyId === freshId),
        `id=${freshId} email=${savedRow?.email} qr=${savedRow?.qr}`);
    const remove = f.rowAction(freshId, 'delete');
    remove.click();
    await tick();
    const confirmed = remove.textContent === 'Conferma eliminazione';
    remove.click();
    await tick();
    f.action('save').click();
    await tick(60); await tick(60);
    record('doppia conferma prima dell’eliminazione di una riga persistita',
        confirmed && !f.store.get().emails.extra.some(item => item.id === freshId)
        && !f.rows().some(row => row.dataset.companyId === freshId));
    // 6. Fail-closed emptying: Account link and card selection.
    const submitsBeforeEmpty = f.state.submits;
    f.field('pec', 'email').value = '';
    f.action('save').click();
    await tick();
    record('svuotamento rifiutato per slot collegato a un Account, senza richiesta',
        f.state.submits === submitsBeforeEmpty && /Collegato a un Account/.test(f.status())
        && Boolean(f.store.get().emails.pec.email), f.status());
    // The refused emptying stays in the draft: restore it so the next guard is the
    // one that actually answers.
    f.field('pec', 'email').value = f.field('pec', 'email').defaultValue;
    f.field('amministrazione', 'email').value = '';
    f.action('save').click();
    await tick();
    record('svuotamento rifiutato per slot pubblicato sulla tessera, senza richiesta',
        f.state.submits === submitsBeforeEmpty && /tessera digitale/.test(f.status())
        && Boolean(f.store.get().emails.amministrazione.email), f.status());
    f.dispose();
    // 7. An ambiguous card configuration blocks removal but not harmless editing.
    const blocked = await mountCompany({aziendaEmail: 'si'});
    record('configurazione ambigua: eliminazione e svuotamento bloccati con motivo esplicito',
        blocked.rowAction('company-email-1', 'delete').disabled && /non verificabile/.test(blocked.message('company-email-1'))
        && /non verificabile/.test(blocked.message('amministrazione')),
        [blocked.message('company-email-1'), blocked.message('amministrazione')].join(' | '));
    const blockedBefore = blocked.store.get();
    blocked.field('company-email-1', 'tipo').value = 'Ufficio aggiornato';
    blocked.action('save').click();
    await tick(60); await tick(60);
    record('configurazione ambigua: una modifica non distruttiva resta possibile',
        blocked.state.submits === 1 && blocked.store.get()._companyContactsRevision === 2
        && blocked.store.get().emails.extra[0].tipo === 'Ufficio aggiornato'
        && blockedBefore._companyContactsRevision === 1, `submit=${blocked.state.submits}`);
    blocked.dispose();
    // 8. Offline is consultative only.
    const off = await mountCompany(VALID_QR, {online: false});
    record('offline: sola consultazione, nessun salvataggio',
        off.field('pec', 'email').readOnly && off.field('pec', 'email').disabled && off.action('save').disabled
        && off.action('add').disabled && /sola consultazione/.test(off.status()) && off.state.submits === 0, off.status());
    off.dispose();
    // 9. Revocation and late answers.
    const rev = await mountCompany(VALID_QR);
    rev.field('amministrazione', 'email').value = 'tardiva@example.invalid';
    rev.state.hold = true;
    rev.action('save').click();
    await tick(40);
    const heldSubmits = rev.state.submits;
    rev.abort.abort();
    rev.state.release?.();
    await tick(60); await tick(60);
    record('cambio sezione: editor smontato e risposta tardiva non presentata come salvata',
        rev.host.children.length === 0 && rev.state.saved === 0 && rev.state.submits === heldSubmits, `saved=${rev.state.saved}`);
    record('scrittura già accettata dal servizio: non annullabile e mai riportata nella vista chiusa',
        rev.store.get()._companyContactsRevision === 2 && rev.host.children.length === 0
        && !rev.host.textContent.includes('salvati'), `revisione=${rev.store.get()._companyContactsRevision}`);
    rev.dispose();
    const locked = await mountCompany(VALID_QR);
    const lockedBefore = locked.store.get();
    locked.state.locked = true;
    locked.field('amministrazione', 'email').value = 'bloccata@example.invalid';
    locked.action('save').click();
    await tick(40);
    record('lock: nessuna richiesta e nessuna scrittura',
        locked.state.submits === 0 && JSON.stringify(locked.store.get()) === JSON.stringify(lockedBefore));
    locked.dispose();
    const loggedOut = await mountCompany(VALID_QR);
    const logoutBefore = loggedOut.store.get();
    loggedOut.state.uid = 'other';
    loggedOut.field('amministrazione', 'email').value = 'logout@example.invalid';
    loggedOut.action('save').click();
    await tick(40);
    record('logout/cambio UID: nessuna richiesta e nessuna scrittura',
        loggedOut.state.submits === 0 && JSON.stringify(loggedOut.store.get()) === JSON.stringify(logoutBefore));
    loggedOut.dispose();
    record('nessun errore di console', errors.length === 0, errors.join(' | '));
} catch (error) {
    record('scenario completato', false, error?.message ?? String(error));
}
await fetch('/entry-result', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ok: checks.every(check => check.ok), scenario: 'profile-company-contacts',
        viewport: {width: innerWidth, height: innerHeight}, checks, errors})});
