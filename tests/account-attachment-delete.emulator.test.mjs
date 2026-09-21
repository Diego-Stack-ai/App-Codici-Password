import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, setDoc} from 'firebase/firestore';
import {deleteObject, getBytes, listAll, ref, uploadBytes} from 'firebase/storage';

// M7-T15 — Prova sull'**emulatore reale** dello stesso percorso positivo del
// banco `tests/account-attachment-delete.test.mjs`.
//
// Qui non c'è modello in memoria: i byte stanno nell'emulatore Storage e i
// metadati nell'emulatore Firestore, e il modulo di produzione del client viene
// eseguito con i veri SDK web (`deleteObject`, `deleteDoc`) e con le Rules di
// produzione. La sparizione dell'oggetto è quindi verificata sull'emulatore
// (elenco della cartella e lettura che fallisce), non su un registro di chiamate.
const strip = text => text
    .replace(/^import[\s\S]*?;\r?\n/gm, '')
    .replace(/^export /gm, '');
const privateModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js', import.meta.url), 'utf8'));
const companyModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js', import.meta.url), 'utf8'));

const PROJECT_ID = 'codici-password-account-attachment-delete';
const OWNER = 'owner-delete';
const BYTES = new Uint8Array([4, 5, 6]);
const textsOf = node => {
    if (!node || typeof node !== 'object') return [];
    const own = typeof node.textContent === 'string' && node.textContent ? [node.textContent] : [];
    return [...own, ...(node.children || []).flatMap(textsOf)];
};
let testEnv;

const accounts = [
    {kind: 'privato', prefix: `users/${OWNER}/accounts/A/attachments`, accountId: 'A'},
    {kind: 'aziendale', prefix: `users/${OWNER}/aziende/company/accounts/one/attachments`,
        accountId: 'one', companyId: 'company'}
];
const record = (id, storagePath) => ({id, name: `${id}.pdf`, size: 3, type: 'application/pdf', storagePath});

async function seed({prefix}, id) {
    const storagePath = `${prefix}/${id}.pdf`;
    await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), prefix, id), record(id, storagePath));
        await uploadBytes(ref(context.storage(), storagePath), BYTES,
            {contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}});
    });
    return storagePath;
}

// Il modulo viene eseguito per intero; l'unica parte sostituita è la lettura
// della lista dopo il successo, che qui usa davvero Firestore.
function mount(kind, {accountId, companyId}) {
    const client = testEnv.authenticatedContext(OWNER);
    const db = client.firestore(), storage = client.storage();
    const container = {children: [], textContent: '', appendChild(child) { this.children.push(child); }};
    const toasts = [], errors = [];
    const context = vm.createContext({
        db, storage, t: () => '', console: {warn() {}}, logError: (...args) => errors.push(args),
        navigator: {onLine: true}, setChildren: (node, children) => { node.children = children; },
        clearElement: node => { node.children = []; node.textContent = ''; },
        createElement: (tag, props = {}, children = []) => ({tag, ...props, children}),
        document: {body: {style: {}}, getElementById: id => (id === 'attachments-list' ? container : null)},
        doc, collection, deleteDoc, ref, deleteObject,
        showConfirmModal: async () => true,
        showToast: (...args) => toasts.push(args),
        listPrivateAccountAttachments: async (ownerId, id) =>
            (await getDocs(collection(db, 'users', ownerId, 'accounts', id, 'attachments')))
                .docs.map(entry => ({id: entry.id, ...entry.data()})),
        listCompanyAccountAttachments: async (ownerId, company, id) =>
            (await getDocs(collection(db, 'users', ownerId, 'aziende', company, 'accounts', id, 'attachments')))
                .docs.map(entry => ({id: entry.id, ...entry.data()}))
    });
    if (kind === 'privato') {
        vm.runInContext(privateModule, context);
        const mountHandle = context.initPrivateAttachmentModule({ownerId: OWNER, accountId, readOnly: false});
        return {context, container, toasts, errors, db, storage,
            delete: attachment => context.deleteAttachment(attachment, mountHandle)};
    }
    vm.runInContext(companyModule, context);
    context.initAttachmentModule({ownerUid: OWNER, currentAziendaId: companyId, currentId: accountId,
        readOnly: false, isActive: () => true});
    return {context, container, toasts, errors, db, storage, delete: attachment => context.deleteAttachment(attachment)};
}

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
        storage: {rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => { await testEnv.clearFirestore(); await testEnv.clearStorage(); });
after(async () => testEnv?.cleanup());

test('T-15 su emulatore: l\'oggetto esce dallo Storage e il metadato da Firestore', async () => {
    for (const account of accounts) {
        const {kind, prefix} = account;
        const gonePath = await seed(account, 'gone');
        await seed(account, 'stays');
        const f = mount(kind, account);
        const kept = ref(f.storage, `${prefix}/stays.pdf`);

        // Prima dello scatto le due metà esistono davvero, altrimenti la prova
        // di rimozione non direbbe nulla.
        assert.deepEqual((await listAll(ref(f.storage, prefix))).items.map(item => item.name).sort(),
            ['gone.pdf', 'stays.pdf'], `${kind}: due oggetti presenti nell'emulatore`);
        assert.deepEqual(new Uint8Array(await getBytes(ref(f.storage, gonePath))), BYTES,
            `${kind}: i byte dell'allegato sono leggibili prima della cancellazione`);
        assert.equal((await getDoc(doc(f.db, prefix, 'gone'))).exists(), true, `${kind}: metadato presente`);

        await f.delete(record('gone', gonePath));

        assert.equal(f.errors.length, 0, `${kind}: nessun errore`);
        assert.ok(f.toasts.some(([message]) => message === 'Allegato eliminato'), `${kind}: esito di successo mostrato`);
        assert.equal((await getDoc(doc(f.db, prefix, 'gone'))).exists(), false,
            `${kind}: il documento dei metadati è stato rimosso davvero`);
        assert.deepEqual((await listAll(ref(f.storage, prefix))).items.map(item => item.name), ['stays.pdf'],
            `${kind}: l'oggetto non compare più nell'elenco dello Storage`);
        let vanished = null;
        try { await getBytes(ref(f.storage, gonePath)); } catch (error) { vanished = error; }
        assert.equal(vanished?.code, 'storage/object-not-found',
            `${kind}: la lettura diretta dei byte eliminati fallisce sull'emulatore`);
        assert.deepEqual(new Uint8Array(await getBytes(kept)), BYTES,
            `${kind}: l'altro allegato è intatto, byte compresi`);
        assert.deepEqual((await getDocs(collection(f.db, prefix))).docs.map(entry => entry.id), ['stays'],
            `${kind}: nei metadati resta solo l'altro allegato`);
        const shown = textsOf(f.container);
        assert.ok(shown.includes('stays.pdf') && !shown.includes('gone.pdf'),
            `${kind}: la lista ricaricata da Firestore mostra solo l'allegato rimasto`);
    }
});

test('T-15 su emulatore: nessun residuo incrociato fra Storage e metadati', async () => {
    for (const account of accounts) {
        const {kind, prefix} = account;
        const gonePath = await seed(account, 'gone');
        await seed(account, 'stays');
        const f = mount(kind, account);
        await f.delete(record('gone', gonePath));

        const objects = (await listAll(ref(f.storage, prefix))).items.map(item => item.name);
        const documents = (await getDocs(collection(f.db, prefix))).docs.map(entry => ({
            id: entry.id, storagePath: entry.data().storagePath}));
        assert.deepEqual(objects, ['stays.pdf'], `${kind}: un solo oggetto rimasto`);
        assert.deepEqual(documents.map(entry => entry.id), ['stays'], `${kind}: un solo metadato rimasto`);
        assert.deepEqual(objects.filter(name => !documents.some(entry =>
            entry.storagePath === `${prefix}/${name}`)), [], `${kind}: nessun oggetto senza metadato`);
        assert.deepEqual(documents.filter(entry => !objects.includes(entry.storagePath.split('/').pop())), [],
            `${kind}: nessun metadato senza oggetto`);
    }
});
