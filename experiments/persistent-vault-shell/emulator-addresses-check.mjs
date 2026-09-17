// Synthetic browser scenario for the A2 address editor. It runs inside the
// laboratory page served by emulator-browser.mjs, mounts the real private and
// company providers, sources and shared view over isolated in-memory stores, and
// drives both through the real transactional services. No real profile, company or
// production resource is involved.
import {mountPrivateAddressesEditorProvider} from '/modules/private-addresses-editor-provider.mjs';
import {mountCompanyAddressesEditorProvider} from '/modules/company-addresses-editor-provider.mjs';
import {createPrivateAddressesHandler} from '/modules/private-addresses-handler.mjs';
import {createPrivateUtilitiesHandler} from '/modules/private-utilities-handler.mjs';
import {createCompanyAddressesHandler} from '/modules/company-addresses-handler.mjs';

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
// The runner applies the device profile through DevTools before the page loads and
// injects its name here: it is reported with the result and drives the layout checks.
const device = globalThis.__entryDeviceProfile ?? 'single';
// In-memory stand-in for Firestore: a transaction refuses a read after a write and
// serialises concurrent runs, exactly like the unit harness of the A2 services.
function createStore(seed) {
    const data = new Map(Object.entries(structuredClone(seed)));
    let chain = Promise.resolve();
    return {get: path => structuredClone(data.get(path)),
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
const container = () => {const node = document.createElement('div'); document.body.append(node); return node;};
const queries = (root, selector) => [...root.querySelectorAll(selector)];
const rowsOf = root => queries(root, '[data-address-row]');
const rowOf = (root, id) => rowsOf(root).find(row => row.dataset.addressId === id);
const fieldOf = (root, id, key) => {const row = rowOf(root, id); return row && row.querySelector(`[data-address-field="${key}"]`);};
const actionOf = (root, name, id) => {const scope = id ? rowOf(root, id) : root; return scope && scope.querySelector(`[data-address-action="${name}"]`);};
const messageOf = (root, id) => rowOf(root, id)?.querySelector('[data-address-message]')?.textContent ?? '';
const statusOf = root => root.querySelector('[data-address-status]')?.textContent ?? '';
const utilityRow = (root, id) => queries(root, '[data-utility-row]').find(row => row.dataset.utilityId === id);
const utilityField = (root, id, key) => utilityRow(root, id)?.querySelector(`[data-utility-field="${key}"]`);
const utilityAction = (root, name, id) => (id ? utilityRow(root, id) : root)?.querySelector(`[data-utility-action="${name}"]`);
const click = async node => {node.dispatchEvent(new Event('click')); await tick();};
// Private environment: the real handler over an isolated store, mounted through the
// real provider. Only the id generator is synthetic.
function privateEnvironment({online = true, selection = {nome: true, emails: [], phones: [], addresses: []}} = {}) {
    const uid = 'addresses-owner', path = `users/${uid}`, selectionPath = `${path}/settings/qrCodeInclusions`;
    const store = createStore({[path]: {ownerId: uid, nome: 'Nome fittizio', _profileAddressesRevision: 1,
        userAddresses: [
            {id: 'address-home', type: 'Residenza', address: 'Via fittizia 1', civic: '1', cap: '00100', city: 'Roma',
                province: 'RM', isPrimary: true, campoIgnoto: 'da conservare',
                utilities: [{id: 'utility-gas', type: 'Contatore Metano', value: 'cipher:POD'},
                    {id: 'utility-linked', type: 'Fibra', value: 'cipher:LINEA', linkedAccountId: 'account'}]},
            {id: 'address-office', type: 'Ufficio', address: 'Via ufficio 2', isPrimary: false},
            {id: 'address-free', type: 'Altro', address: 'Via libera 5', isPrimary: false},
            {id: 'address-legacy-1a2b', type: 'Altro', address: 'Via legacy 3', isPrimary: false}]},
        ...(selection === null ? {} : {[selectionPath]: selection})});
    const state = {online, submits: 0, utilitySubmits: 0, saved: 0, locked: false, uid, hold: false, release: null, links: []};
    const abort = new AbortController();
    const handler = createPrivateAddressesHandler({db: store, hash, timestamp: () => 123});
    const utilitiesHandler = createPrivateUtilitiesHandler({db: store, hash, timestamp: () => 123});
    const context = {user: {uid}, signal: abort.signal, assertUnlocked() {if (state.locked) throw Error('LOCKED');},
        read: async ({ciphertext}) => atob(ciphertext).slice(48), encrypt: async value => btoa('x'.repeat(48) + value)};
    let counter = 0, cleanup = null;
    const host = container();
    const mount = async () => {cleanup = await mountPrivateAddressesEditorProvider(host, context, {
        getUser: () => ({uid: state.uid}), hash, isOnline: () => state.online,
        isEncryptedValue: value => typeof value === 'string' && value.length >= 64 && /^[A-Za-z0-9+/]+={0,2}$/.test(value),
        repository: {getUserProfile: async () => store.get(path), getUserProfileConfirmed: async () => store.get(path),
            getUserSetting: async (requested, key) => store.get(`${path}/settings/${key}`) ?? null},
        createId: prefix => `${prefix}-c0ffee${++counter}`, onCancel: () => {}, onUtilityLink: value => state.links.push(value),
        onSaved: async () => {state.saved += 1; cleanup?.(); cleanup = null; await mount(); await tick();},
        submit: async request => {state.submits += 1;
            if (state.hold) await new Promise(resolve => {state.release = resolve;});
            return handler(request, {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}});},
        submitUtilities: async request => {state.utilitySubmits += 1; return utilitiesHandler(request,
            {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}});}});};
    return {host, store, state, abort, path, mount, cleanup: () => {cleanup?.(); cleanup = null;}};
}
// Company environment: same shape, with the legal seat and `altreSedi`.
function companyEnvironment({qrConfig = {qrLegale: true, aziendaEmail: true, adminEmail: false, persEmail: false,
    telefonoAzienda: false, referenteCellulare: true}} = {}) {
    const uid = 'company-owner', path = `users/${uid}/aziende/company`;
    const store = createStore({[path]: {ownerId: uid, id: 'company', ragioneSociale: 'Azienda fittizia', unrelated: 'keep',
        tipoSedeLegale: 'Sede Legale', indirizzoSede: 'Via sede 1', civicoSede: '1', capSede: '00100', cittaSede: 'Roma',
        provinciaSede: 'RM', emails: {pec: {email: 'pec@example.invalid'}}, qrConfig, _companyAddressesRevision: 1,
        altreSedi: [
            {id: 'sede-filiale', tipo: 'Filiale', indirizzo: 'Via filiale 2', qr: false},
            {id: 'sede-pubblicata', tipo: 'Showroom', indirizzo: 'Via vetrina 5', qr: true},
            {id: 'sede-2', tipo: 'Magazzino', indirizzo: 'Via indice 3'},
            {tipo: 'Senza identità', indirizzo: 'Via senza id 4'}]}});
    const state = {submits: 0, saved: 0};
    const abort = new AbortController();
    const handler = createCompanyAddressesHandler({db: store, hash, timestamp: () => 123});
    const context = {user: {uid}, signal: abort.signal, assertUnlocked() {}};
    const source = {domain: 'company', companyId: 'company', async read() {return store.get(path);}};
    let counter = 0, cleanup = null;
    const host = container();
    const mount = async () => {cleanup = await mountCompanyAddressesEditorProvider(host, context, {
        getUser: () => ({uid}), hash, isOnline: () => true, source, createId: prefix => `${prefix}-c0ffee${++counter}`,
        onCancel: () => {}, onSaved: async () => {state.saved += 1; cleanup?.(); cleanup = null; await mount(); await tick();},
        submit: async request => {state.submits += 1; return handler(request, {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}});}});};
    return {host, store, state, abort, path, mount, cleanup: () => {cleanup?.(); cleanup = null;}};
}
try {
    for (const endpoint of ['applyPrivateAddressesMutation', 'applyCompanyAddressesMutation']) {
        const denied = await fetch(`/demo-vault-shell/europe-west1/${endpoint}`, {method: 'POST', body: '{}'});
        record(`endpoint A2 ${endpoint}: richiesta anonima respinta dal bridge reale`, denied.status === 401, `status=${denied.status}`);
    }
    // ── Private addresses ────────────────────────────────────────────────────
    const priv = privateEnvironment();
    await priv.mount();
    await tick(60);
    record('privato: quattro indirizzi con le etichette reali del profilo',
        rowsOf(priv.host).length === 4 && rowOf(priv.host, 'address-home').textContent.includes('Residenza')
        && rowOf(priv.host, 'address-office').textContent.includes('Ufficio'),
        rowsOf(priv.host).map(row => row.dataset.addressId).join(','));
    record('A3: utenze renderizzate sotto il relativo indirizzo padre',
        Boolean(rowOf(priv.host, 'address-home').querySelector('[data-utilities-editor]'))
        && utilityField(priv.host, 'utility-gas', 'type').value === 'Contatore Metano'
        && !rowOf(priv.host, 'address-office').querySelector('[data-utility-row]'));
    record('A3: guardia Account e azioni Collega/Cambia/Scollega restano operative',
        utilityAction(priv.host, 'delete', 'utility-linked').disabled
        && utilityRow(priv.host, 'utility-linked').querySelector('[data-utility-link="change"]')
        && utilityRow(priv.host, 'utility-linked').querySelector('[data-utility-link="unlink"]'));
    await click(utilityRow(priv.host, 'utility-linked').querySelector('[data-utility-link="change"]'));
    record('A3: azione Account conserva origine composta indirizzo/utenza',
        priv.state.links[0]?.source?.parentAddressId === 'address-home' && priv.state.links[0]?.source?.id === 'utility-linked');
    record('privato: la riga con identità derivata è consultabile ma non modificabile',
        fieldOf(priv.host, 'address-legacy-1a2b', 'address').readOnly && actionOf(priv.host, 'delete', 'address-legacy-1a2b').disabled
        && /non persistita/.test(messageOf(priv.host, 'address-legacy-1a2b')), messageOf(priv.host, 'address-legacy-1a2b'));
    record('privato: un indirizzo con utenze non si elimina e il motivo è visibile',
        actionOf(priv.host, 'delete', 'address-home').disabled && /utenze/i.test(messageOf(priv.host, 'address-home')),
        messageOf(priv.host, 'address-home'));
    fieldOf(priv.host, 'address-office', 'city').value = 'Monza';
    await click(actionOf(priv.host, 'add'));
    const created = rowsOf(priv.host).at(-1);
    const createdId = created.dataset.addressId;
    created.querySelector('[data-address-field="address"]').value = 'Via nuova 9';
    created.querySelector('[data-address-field="isPrimary"]').checked = true;
    await click(actionOf(priv.host, 'save'));
    const savedPrivate = priv.store.get(priv.path);
    const createdRow = savedPrivate.userAddresses.find(item => item.id === createdId);
    record('privato: creazione di un nuovo indirizzo con ID persistito',
        priv.state.submits === 1 && savedPrivate._profileAddressesRevision === 2 && /^address-/.test(createdId)
        && createdRow?.address === 'Via nuova 9' && createdRow?.isPrimary === true, `id=${createdId}`);
    record('privato: rilettura confermata nella stessa linguetta, valore aggiornato e valore creato',
        fieldOf(priv.host, 'address-office', 'city').value === 'Monza' && fieldOf(priv.host, createdId, 'address').value === 'Via nuova 9',
        `${fieldOf(priv.host, 'address-office', 'city').value} | ${fieldOf(priv.host, createdId, 'address').value}`);
    // The new address is edited again: it is a first-class persisted row, not a
    // one-shot creation, and the other addresses keep their utilities.
    fieldOf(priv.host, createdId, 'city').value = 'Torino';
    await click(actionOf(priv.host, 'save'));
    record('privato: modifica successiva del nuovo indirizzo con gli altri preservati',
        priv.state.submits === 2 && priv.store.get(priv.path).userAddresses.find(item => item.id === createdId)?.city === 'Torino'
        && priv.store.get(priv.path).userAddresses.find(item => item.id === 'address-home').utilities[0].value === 'cipher:POD'
        && priv.store.get(priv.path).userAddresses.length === 5,
        `revisione=${priv.store.get(priv.path)._profileAddressesRevision}`);
    record('privato: l’indirizzo principale è esclusivo e le utenze sopravvivono',
        savedPrivate.userAddresses.filter(item => item.isPrimary).length === 1
        && savedPrivate.userAddresses.find(item => item.id === 'address-home').isPrimary === false
        && savedPrivate.userAddresses.find(item => item.id === 'address-home').utilities[0].value === 'cipher:POD'
        && savedPrivate.userAddresses.find(item => item.id === 'address-home').campoIgnoto === 'da conservare');
    const remove = actionOf(priv.host, 'delete', 'address-free');
    await click(remove);
    const confirmed = remove.textContent === 'Conferma eliminazione';
    await click(remove);
    await click(actionOf(priv.host, 'save'));
    record('privato: doppia conferma prima dell’eliminazione di un indirizzo persistito',
        confirmed && !priv.store.get(priv.path).userAddresses.some(item => item.id === 'address-free'));
    priv.cleanup();
    const utilities = privateEnvironment({selection: {nome: true, emails: [], phones: [], addresses: ['address-home']}});
    await utilities.mount();
    await tick(60);
    utilityField(utilities.host, 'utility-gas', 'value').value = 'POD-AGGIORNATO';
    await click(utilityAction(utilities.host, 'add'));
    const freshUtility = queries(utilities.host, '[data-utility-new]').at(-1), freshId = freshUtility.dataset.utilityId;
    freshUtility.querySelector('[data-utility-field="type"]').value = 'Acqua'; freshUtility.querySelector('[data-utility-field="value"]').value = 'MATRICOLA';
    await click(utilityAction(utilities.host, 'save'));
    record('A3: modifica e creazione cifrano solo value, rileggono e preservano indirizzo/campi legacy',
        utilities.state.utilitySubmits === 1 && utilityField(utilities.host, 'utility-gas', 'value').value === 'POD-AGGIORNATO'
        && utilityField(utilities.host, freshId, 'value').value === 'MATRICOLA'
        && utilities.store.get(utilities.path).userAddresses[0].address === 'Via fittizia 1'
        && utilities.store.get(utilities.path).userAddresses[0].campoIgnoto === 'da conservare');
    const utilityDelete = utilityAction(utilities.host, 'delete', 'utility-gas'); await click(utilityDelete);
    const utilityConfirmed = utilityDelete.textContent === 'Conferma eliminazione'; await click(utilityDelete); await click(utilityAction(utilities.host, 'save'));
    record('A3: doppia conferma e nessun falso blocco QR quando il padre è nella tessera',
        utilityConfirmed && !utilities.store.get(utilities.path).userAddresses[0].utilities.some(item => item.id === 'utility-gas'));
    utilities.cleanup();
    const offline = privateEnvironment({online: false});
    await offline.mount();
    record('privato offline: sola consultazione, nessun salvataggio',
        fieldOf(offline.host, 'address-office', 'address').readOnly && actionOf(offline.host, 'save').disabled
        && actionOf(offline.host, 'add').disabled && /sola consultazione/.test(statusOf(offline.host)) && offline.state.submits === 0,
        statusOf(offline.host));
    offline.cleanup();
    const unverifiable = privateEnvironment({selection: {addresses: 'address-free'}});
    await unverifiable.mount();
    record('privato: configurazione QR non risolvibile, eliminazione disabilitata con motivo esplicito',
        actionOf(unverifiable.host, 'delete', 'address-free').disabled
        && /non verificabile/.test(messageOf(unverifiable.host, 'address-free')), messageOf(unverifiable.host, 'address-free'));
    unverifiable.cleanup();
    // ── Company addresses ───────────────────────────────────────────────────
    const comp = companyEnvironment();
    await comp.mount();
    const seat = comp.host.querySelector('[data-address-seat]');
    record('azienda: la sede fissa è presente, modificabile e senza azione di eliminazione',
        Boolean(seat) && queries(seat, '[data-address-field]').length === 6 && !seat.querySelector('[data-address-action="delete"]'));
    // Rows that cannot be addressed share the empty DOM identity: what tells them
    // apart is the reason the service would use.
    const orphans = rowsOf(comp.host).filter(row => row.dataset.addressId === '')
        .map(row => row.querySelector('[data-address-message]').textContent);
    record('azienda: le sedi ripetibili mostrano le etichette e le guardie reali',
        rowsOf(comp.host).length === 4 && /tessera digitale/.test(messageOf(comp.host, 'sede-pubblicata'))
        && orphans.length === 2 && orphans.some(text => /non persistita/.test(text)) && orphans.some(text => /ID persistito/.test(text)),
        `righe=${rowsOf(comp.host).length} | ${messageOf(comp.host, 'sede-pubblicata')} | ${orphans.join(' / ')}`);
    queries(seat, '[data-address-field]').find(node => node.dataset.addressField === 'indirizzoSede').value = 'Via sede 1 bis';
    await click(actionOf(comp.host, 'save'));
    const savedCompany = comp.store.get(comp.path);
    record('azienda: la sede si aggiorna campo per campo e la vista rilegge il valore confermato',
        comp.state.submits === 1 && savedCompany._companyAddressesRevision === 2 && savedCompany.indirizzoSede === 'Via sede 1 bis'
        && savedCompany.civicoSede === '1' && savedCompany.emails.pec.email === 'pec@example.invalid'
        && queries(comp.host.querySelector('[data-address-seat]'), '[data-address-field]')
            .find(node => node.dataset.addressField === 'indirizzoSede').value === 'Via sede 1 bis');
    await click(actionOf(comp.host, 'add'));
    const newRow = rowsOf(comp.host).at(-1);
    const newId = newRow.dataset.addressId;
    newRow.querySelector('[data-address-field="indirizzo"]').value = 'Via deposito 6';
    newRow.querySelector('[data-address-field="tipo"]').value = 'Deposito';
    await click(actionOf(comp.host, 'save'));
    record('azienda: creazione di una sede con identità persistita e riga non pubblicata',
        comp.state.submits === 2 && comp.store.get(comp.path).altreSedi.find(item => item.id === newId)?.qr === false
        && Boolean(rowOf(comp.host, newId)), `id=${newId}`);
    const removeRow = actionOf(comp.host, 'delete', 'sede-filiale');
    await click(removeRow);
    await click(removeRow);
    await click(actionOf(comp.host, 'save'));
    record('azienda: doppia conferma e rimozione di una sede non pubblicata',
        !comp.store.get(comp.path).altreSedi.some(item => item.id === 'sede-filiale'));
    comp.cleanup();
    const blockedCompany = companyEnvironment({qrConfig: {qrLegale: 'si'}});
    await blockedCompany.mount();
    record('azienda: configurazione della tessera ambigua, eliminazioni disabilitate in fail-closed',
        actionOf(blockedCompany.host, 'delete', 'sede-filiale').disabled
        && /non verificabile/.test(messageOf(blockedCompany.host, 'sede-filiale')), messageOf(blockedCompany.host, 'sede-filiale'));
    blockedCompany.cleanup();
    // ── Lifecycle, one path per check ────────────────────────────────────────
    const sectionChange = privateEnvironment();
    await sectionChange.mount();
    sectionChange.abort.abort();
    await tick();
    record('ciclo di vita — cambio sezione: editor smontato, nessuna richiesta',
        sectionChange.host.children.length === 0 && queries(sectionChange.host, '[data-address-field]').length === 0
        && sectionChange.state.saved === 0 && sectionChange.state.submits === 0);
    const locked = privateEnvironment();
    await locked.mount();
    locked.state.locked = true;
    fieldOf(locked.host, 'address-office', 'city').value = 'Napoli';
    await click(actionOf(locked.host, 'save'));
    record('ciclo di vita — lock: nessuna richiesta e nessuna scrittura',
        locked.state.submits === 0 && locked.store.get(locked.path)._profileAddressesRevision === 1);
    const loggedOut = privateEnvironment();
    await loggedOut.mount();
    loggedOut.state.uid = 'other';
    fieldOf(loggedOut.host, 'address-office', 'city').value = 'Napoli';
    await click(actionOf(loggedOut.host, 'save'));
    record('ciclo di vita — logout/cambio UID: nessuna richiesta e nessuna scrittura',
        loggedOut.state.submits === 0 && loggedOut.store.get(loggedOut.path)._profileAddressesRevision === 1);
    const late = privateEnvironment();
    await late.mount();
    late.state.hold = true;
    fieldOf(late.host, 'address-office', 'city').value = 'Bologna';
    actionOf(late.host, 'save').dispatchEvent(new Event('click'));
    await tick(40);
    const heldSubmits = late.state.submits;
    late.abort.abort();
    late.state.release();
    await tick(60); await tick(60);
    record('ciclo di vita — risposta tardiva dopo accettazione del servizio: nessuna vista ricreata',
        late.state.submits === heldSubmits && late.state.saved === 0 && late.host.children.length === 0
        && late.store.get(late.path)._profileAddressesRevision === 2
        && late.store.get(late.path).userAddresses.find(item => item.id === 'address-office').city === 'Bologna',
        `saved=${late.state.saved} revisione=${late.store.get(late.path)._profileAddressesRevision}`);
    for (const environment of [sectionChange, locked, loggedOut, late]) environment.cleanup();
    // ── Device profile and layout ────────────────────────────────────────────
    const expected = device === 'mobile' ? {width: 390, factor: 3} : device === 'desktop' ? {width: 1280, factor: 1} : null;
    record(`profilo ${device}: il runner ha applicato il viewport via DevTools`,
        !expected || (window.innerWidth === expected.width && window.devicePixelRatio === expected.factor),
        `inner=${window.innerWidth} dpr=${window.devicePixelRatio} device=${device}`);
    const layout = privateEnvironment();
    await layout.mount();
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    record(`profilo ${device}: nessun overflow orizzontale con l'editor montato`, overflow <= 1,
        `scroll=${document.documentElement.scrollWidth} inner=${window.innerWidth}`);
    const saveBox = actionOf(layout.host, 'save').getBoundingClientRect();
    const fieldBox = fieldOf(layout.host, 'address-office', 'address').getBoundingClientRect();
    record(`profilo ${device}: controlli visibili e utilizzabili`,
        saveBox.width > 0 && saveBox.height > 0 && saveBox.right <= window.innerWidth + 1 && fieldBox.width > 0
        && !actionOf(layout.host, 'save').disabled && queries(layout.host, '[data-address-row]').length === 4,
        `save=${Math.round(saveBox.width)}x${Math.round(saveBox.height)} campo=${Math.round(fieldBox.width)} righe=${queries(layout.host, '[data-address-row]').length}`);
    layout.cleanup();
    record('nessun errore di console', errors.length === 0, errors.join(' | '));
} catch (error) {
    record('scenario completato', false, error?.message ?? String(error));
}
await fetch('/entry-result', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ok: checks.every(check => check.ok), scenario: 'profile-addresses', device,
        viewport: {width: innerWidth, height: innerHeight}, deviceScaleFactor: devicePixelRatio, checks, errors})});
