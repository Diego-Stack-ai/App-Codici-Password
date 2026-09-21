import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// M7-T15 — Cancellazione **completa** di un allegato da un Account: il percorso
// positivo deve togliere sia l'oggetto Storage sia il riferimento nei metadati.
//
// Cosa è *reale* in questo banco: i due moduli di produzione (dettaglio Account
// privato e dettaglio Account aziendale) eseguiti per intero, con il loro ordine
// di chiamate, i loro controlli di sessione e la ricarica della lista dopo il
// successo.
//
// Cosa è *simulato*: Storage e Firestore sono un modello in memoria (un bucket e
// una collezione di metadati). Il banco prova quindi che il client chieda la
// rimozione dell'oggetto **e** del metadato giusti, nell'ordine previsto, e che
// dopo il percorso positivo non resti alcun residuo **nel modello**. Che i byte
// spariscano davvero dall'emulatore Storage è provato separatamente da
// `tests/account-attachment-delete.emulator.test.mjs`, sull'emulatore reale.
const strip = text => text
    .replace(/^import[\s\S]*?;\r?\n/gm, '')
    .replace(/^export /gm, '');
const privateModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js', import.meta.url), 'utf8'));
const companyModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js', import.meta.url), 'utf8'));

const OWNER = 'owner';
const textsOf = node => {
    if (!node || typeof node !== 'object') return [];
    const own = typeof node.textContent === 'string' && node.textContent ? [node.textContent] : [];
    return [...own, ...(node.children || []).flatMap(textsOf)];
};

// Modello in memoria: `objects` è il bucket Storage, `documents` la collezione dei
// metadati. Ogni operazione distruttiva passa da qui, quindi una chiamata su un
// percorso inesistente fallisce invece di essere registrata e basta.
function fixture(kind, {objects = [], documents = [], confirm = true} = {}) {
    const bucket = new Map(objects.map(path => [path, Uint8Array.from([7, 7, 7])]));
    const stored = new Map(documents.map(entry => [entry.path, {...entry.record}]));
    const operations = [], toasts = [], errors = [], confirmations = [];
    const container = {children: [], textContent: '', appendChild(child) { this.children.push(child); }};
    const list = prefix => [...stored.entries()]
        .filter(([path]) => path.startsWith(`${prefix}/`))
        .map(([, record]) => record);
    const context = vm.createContext({
        db: {}, storage: {}, t: () => '', console: {warn() {}}, logError: (...args) => errors.push(args),
        navigator: {onLine: true}, setTimeout: () => 0, clearTimeout() {},
        document: {body: {style: {}}, getElementById: id => (id === 'attachments-list' ? container : null)},
        doc: (_db, ...path) => path.join('/'), collection: (_db, ...path) => path.join('/'),
        ref: (_storage, path) => path,
        deleteObject: async path => {
            operations.push(['storage-delete', path]);
            assert.equal(bucket.delete(path), true, `il client ha chiesto di eliminare un oggetto che non esiste: ${path}`);
        },
        deleteDoc: async path => {
            const record = stored.get(path);
            operations.push(['document-delete', path, record]);
            assert.ok(record, `il client ha chiesto di eliminare un metadato che non esiste: ${path}`);
            stored.delete(path);
        },
        showConfirmModal: async (...args) => { confirmations.push(args); return confirm; },
        showToast: (...args) => toasts.push(args),
        createElement: (tag, props = {}, children = []) => ({tag, ...props, children}),
        setChildren: (node, children) => { node.children = Array.isArray(children) ? children : [children]; },
        clearElement: node => { node.children = []; node.textContent = ''; },
        listPrivateAccountAttachments: async (ownerId, accountId) =>
            list(`users/${ownerId}/accounts/${accountId}/attachments`),
        listCompanyAccountAttachments: async (ownerId, companyId, accountId) =>
            list(`users/${ownerId}/aziende/${companyId}/accounts/${accountId}/attachments`)
    });
    if (kind === 'privato') {
        vm.runInContext(privateModule, context);
        const mount = context.initPrivateAttachmentModule({ownerId: OWNER, accountId: 'A', readOnly: false});
        return {context, mount, container, operations, toasts, errors, confirmations, bucket, stored,
            accountPrefix: `users/${OWNER}/accounts/A/attachments`,
            delete: attachment => context.deleteAttachment(attachment, mount)};
    }
    vm.runInContext(companyModule, context);
    context.initAttachmentModule({ownerUid: OWNER, currentAziendaId: 'company', currentId: 'one', readOnly: false,
        isActive: () => true});
    return {context, container, operations, toasts, errors, confirmations, bucket, stored,
        accountPrefix: `users/${OWNER}/aziende/company/accounts/one/attachments`,
        delete: attachment => context.deleteAttachment(attachment)};
}

const privateSetup = () => ({
    objects: ['users/owner/accounts/A/attachments/gone.pdf', 'users/owner/accounts/A/attachments/stays.pdf'],
    documents: [
        {path: 'users/owner/accounts/A/attachments/gone', record: {id: 'gone', name: 'Gone.pdf', size: 1024,
            type: 'application/pdf', storagePath: 'users/owner/accounts/A/attachments/gone.pdf'}},
        {path: 'users/owner/accounts/A/attachments/stays', record: {id: 'stays', name: 'Stays.pdf', size: 2048,
            type: 'application/pdf', storagePath: 'users/owner/accounts/A/attachments/stays.pdf'}}
    ]
});
const companySetup = () => ({
    objects: ['users/owner/aziende/company/accounts/one/attachments/gone.pdf',
        'users/owner/aziende/company/accounts/one/attachments/stays.pdf'],
    documents: [
        {path: 'users/owner/aziende/company/accounts/one/attachments/gone', record: {id: 'gone', name: 'Gone.pdf',
            size: 1024, type: 'application/pdf',
            storagePath: 'users/owner/aziende/company/accounts/one/attachments/gone.pdf'}},
        {path: 'users/owner/aziende/company/accounts/one/attachments/stays', record: {id: 'stays', name: 'Stays.pdf',
            size: 2048, type: 'application/pdf',
            storagePath: 'users/owner/aziende/company/accounts/one/attachments/stays.pdf'}}
    ]
});
const cases = [['privato', privateSetup], ['aziendale', companySetup]];

test('T-15: il percorso positivo rimuove l\'oggetto Storage e il metadato, senza residui', async () => {
    for (const [kind, setup] of cases) {
        const data = setup(), f = fixture(kind, data);
        const [deleted] = data.documents;
        await f.delete(deleted.record);

        assert.equal(f.confirmations.length, 1, `${kind}: una sola conferma, come nel percorso dell'utente`);
        assert.ok(f.confirmations[0].some(value => typeof value === 'string' && value.includes(deleted.record.name)),
            `${kind}: la conferma nomina l'allegato scelto`);
        assert.deepEqual(f.operations.map(([operation]) => operation), ['storage-delete', 'document-delete'],
            `${kind}: prima l'oggetto, poi il metadato, e una sola volta ciascuno`);
        assert.equal(f.operations[0][1], deleted.record.storagePath,
            `${kind}: l'oggetto eliminato è quello dichiarato dal metadato`);
        assert.equal(f.operations[1][1], `${f.accountPrefix}/${deleted.record.id}`,
            `${kind}: il metadato eliminato è nell'Account e con l'id dell'allegato scelto`);
        assert.equal(f.operations[1][2].storagePath, f.operations[0][1],
            `${kind}: oggetto e metadato rimossi sono la stessa coppia, non due scelte indipendenti`);
        assert.equal(f.errors.length, 0, `${kind}: nessun errore registrato`);
        assert.ok(f.toasts.some(([message]) => message === 'Allegato eliminato'), `${kind}: esito di successo mostrato`);

        // Nessun residuo: né l'oggetto né il metadato, e nessuna delle due metà
        // rimasta orfana dell'altra.
        assert.equal(f.bucket.has(deleted.record.storagePath), false, `${kind}: i byte non sono più nel bucket`);
        assert.equal(f.stored.has(`${f.accountPrefix}/${deleted.record.id}`), false,
            `${kind}: il riferimento non è più nei metadati`);
        assert.deepEqual([...f.bucket.keys()], [data.objects[1]], `${kind}: l'altro oggetto non è stato toccato`);
        assert.deepEqual([...f.stored.keys()], [data.documents[1].path],
            `${kind}: il metadato dell'altro allegato non è stato toccato`);
        assert.deepEqual([...f.bucket.keys()].filter(path =>
            ![...f.stored.values()].some(record => record.storagePath === path)), [],
        `${kind}: nessun oggetto resta senza metadato`);
        assert.deepEqual([...f.stored.values()].filter(record => !f.bucket.has(record.storagePath)), [],
            `${kind}: nessun metadato resta senza oggetto`);

        // La lista ricaricata dopo il successo non mostra più l'allegato rimosso.
        const shown = textsOf(f.container);
        assert.ok(shown.includes('Stays.pdf') && !shown.includes('Gone.pdf'),
            `${kind}: la vista ricaricata mostra solo l'allegato rimasto`);
    }
});

test('T-15: la conferma rifiutata non rimuove né byte né metadato (la prova positiva non è vacua)', async () => {
    for (const [kind, setup] of cases) {
        const data = setup(), f = fixture(kind, {...data, confirm: false});
        await f.delete(data.documents[1].record);
        assert.deepEqual(f.operations, [], `${kind}: nessuna rimozione senza conferma`);
        assert.equal(f.bucket.size, data.objects.length, `${kind}: bucket intatto`);
        assert.equal(f.stored.size, data.documents.length, `${kind}: metadati intatti`);
    }
});

test('T-15: un allegato senza percorso Storage perde solo il metadato, senza oggetto orfano', async () => {
    const external = {id: 'link', name: 'Link', size: 0, type: 'application/pdf', url: 'https://example.invalid/doc'};
    const f = fixture('privato', {
        objects: ['users/owner/accounts/A/attachments/gone.pdf'],
        documents: [
            {path: 'users/owner/accounts/A/attachments/link', record: external},
            {path: 'users/owner/accounts/A/attachments/gone', record: {id: 'gone', name: 'Gone.pdf', size: 1024,
                type: 'application/pdf', storagePath: 'users/owner/accounts/A/attachments/gone.pdf'}}
        ]
    });
    await f.delete(external);
    assert.deepEqual(f.operations.map(([operation]) => operation), ['document-delete'],
        'un allegato senza percorso non deve chiamare Storage');
    assert.equal(f.stored.has('users/owner/accounts/A/attachments/link'), false);
    assert.deepEqual([...f.bucket.keys()], ['users/owner/accounts/A/attachments/gone.pdf'],
        'nessun oggetto viene creato o rimosso per un allegato esterno');
    assert.equal(f.errors.length, 0);
});
