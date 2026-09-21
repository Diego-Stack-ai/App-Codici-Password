import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// M7-T29 — Apertura di un allegato **legacy**, cioè senza il campo `encryption`.
//
// Il banco esegue i moduli reali di apertura e l'helper reale di sicurezza
// (`attachment-security.js`: `normalizeExternalUrl`, `openExternalUrl`,
// `openDecryptedAttachment`) e dimostra il comportamento attuale del ramo
// legacy: quale URL viene aperto, se la Vault Key viene richiesta, quali
// controlli restano applicati e che cosa accade negli errori principali.
//
// Il ramo cifrato è esercitato nello stesso banco come controprova: è ciò che
// distingue davvero i due comportamenti.
//
// Cosa è **reale**: il codice di produzione dei quattro percorsi di apertura e
// la policy degli URL. Cosa è **simulato**: `window.open`, il documento, i
// messaggi e il Vault (`ensureVaultKeyMaterial`), perché in Node non esistono e
// la prova non deve toccare né browser né dati reali.
const paths = {
    privato: '../Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js',
    aziendale: '../Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js',
    incorporato: '../Frontend/public/assets/js/modules/azienda/dati-azienda-attachments.js'
};
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const securityModule = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/shared/attachment-security.js', import.meta.url), 'utf8'));
const sources = Object.fromEntries(await Promise.all(Object.entries(paths)
    .map(async ([kind, path]) => [kind, strip(await readFile(new URL(path, import.meta.url), 'utf8'))])));
// La pagina delle Scadenze è grande e ha effetti di modulo: si estrae la sola
// funzione di apertura, che è l'ultima del file.
const deadlineSource = strip(await readFile(
    new URL('../Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js', import.meta.url), 'utf8'));
const deadlineFunction = deadlineSource.slice(deadlineSource.indexOf('async function openDeadlineAttachment('));
assert.ok(deadlineFunction.includes('openExternalUrl') && deadlineFunction.includes('openDecryptedAttachment'),
    'la funzione delle Scadenze deve essere estratta per intero');

const LEGACY = {id: 'legacy', name: 'Legacy.pdf', type: 'application/pdf', url: 'https://example.invalid/report.pdf'};
const VAULT_KEY = 'synthetic-vault-key';
const CIPHERTEXT_PATH = 'users/A/accounts/one/attachments/c.pdf';

// L'allegato cifrato è costruito con la **cifratura reale** del modulo: il ramo
// cifrato viene così esercitato per intero (involucro, chiave, decifratura e URL
// blob) invece di essere simulato.
const sealingRealm = (() => {
    const context = vm.createContext({crypto, TextEncoder, TextDecoder, console, File, Blob, Date,
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        atob: value => Buffer.from(value, 'base64').toString('binary')});
    vm.runInContext(`${securityModule}\nglobalThis.encryptAttachmentFile = encryptAttachmentFile;`, context);
    return context;
})();

async function sealedAttachment() {
    const file = new File([Uint8Array.from([1, 2, 3, 4])], 'Cifrato.pdf', {type: 'application/pdf'});
    const sealed = await sealingRealm.encryptAttachmentFile(file, VAULT_KEY);
    return {attachment: {id: 'cifrato', name: 'Cifrato.pdf', type: 'application/pdf',
        storagePath: CIPHERTEXT_PATH, encryption: sealed.metadata},
    ciphertext: new Uint8Array(await sealed.blob.arrayBuffer())};
}

// Osserva la decifratura **reale**: l'helper di sicurezza viene avvolto da una
// spia che registra la chiamata e poi esegue l'originale.
const SPY = `
const __realDecrypt = decryptAttachmentBytes;
decryptAttachmentBytes = async (bytes, encryption, vaultKey) => {
    __decrypts.push({encryption, vaultKey, size: bytes.length});
    return __realDecrypt(bytes, encryption, vaultKey);
};
`;

// Un realm per percorso: stesso comportamento atteso, moduli diversi.
function realm(kind) {
    const opened = [], toasts = [], errors = [], reads = [], decrypts = [];
    const state = {keyRequests: 0, active: true, openResult: {opener: 'synthetic'}, openThrows: false};
    const nodes = {'attachments-list': {children: [], appendChild(child) { this.children.push(child); }}};
    const context = vm.createContext({
        __decrypts: decrypts,
        document: {body: {style: {}}, getElementById: id => nodes[id] ?? null, querySelector: () => null,
            querySelectorAll: () => []},
        window: {open: (url, target, features) => {
            if (state.openThrows) throw new Error('synthetic popup failure');
            opened.push({url, target, features});
            return state.openResult;
        }},
        URL, Blob, TextEncoder, TextDecoder, crypto, console: {warn() {}}, Date, File,
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        setTimeout: () => 0, clearTimeout() {}, navigator: {onLine: true},
        storage: {}, db: {}, ref: (_storage, path) => path, doc: (_db, ...path) => path.join('/'),
        collection: (_db, ...path) => path.join('/'),
        getBytes: async (path, cap) => { reads.push({path, cap}); return state.ciphertext; },
        ensureVaultKeyMaterial: async () => { state.keyRequests++; return VAULT_KEY; },
        showToast: (...args) => toasts.push(args), showConfirmModal: async () => true,
        logError: (...args) => errors.push(args), t: value => value,
        createElement: (tag, props = {}, children = []) => ({tag, ...props, children}),
        setChildren: (node, children) => { node.children = children; },
        clearElement: node => { node.children = []; },
        listPrivateAccountAttachments: async () => [], listCompanyAccountAttachments: async () => [],
        uploadBytes: async () => ({}), getDownloadURL: async () => 'https://example.invalid', addDoc: async () => {},
        deleteObject: async () => {}, deleteDoc: async () => {}, serverTimestamp: () => 'time',
        validateAttachmentFile() {}, createStorageObjectName: () => 'synthetic'
    });
    const expose = kind === 'incorporato' ? 'globalThis.openCompanyAttachment = openCompanyAttachment;'
        : 'globalThis.openAttachment = openAttachment;';
    vm.runInContext(`${securityModule}\n${sources[kind]}\n${SPY}\n${expose}`, context);
    let mount = null;
    if (kind === 'privato') {
        mount = context.initPrivateAttachmentModule({ownerId: 'A', accountId: 'one', readOnly: false});
    } else if (kind === 'aziendale') {
        context.initAttachmentModule({ownerUid: 'A', currentAziendaId: 'company', currentId: 'one',
            readOnly: false, isActive: () => state.active});
    }
    return {opened, toasts, errors, reads, decrypts, state,
        invalidate: () => { state.active = false; mount?.destroy(); },
        open: attachment => (kind === 'incorporato' ? context.openCompanyAttachment(attachment)
            : context.openAttachment(attachment))};
}

function deadlineRealm() {
    const opened = [], toasts = [], errors = [], reads = [], decrypts = [];
    const state = {keyRequests: 0, active: true, openResult: {opener: 'synthetic'}, ciphertext: null};
    const context = vm.createContext({
        __decrypts: decrypts,
        window: {open: (url, target, features) => {
            opened.push({url, target, features});
            return state.openResult;
        }},
        URL, Blob, TextEncoder, TextDecoder, crypto, console: {warn() {}}, Date, setTimeout: () => 0,
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        storage: {}, ref: (_storage, path) => path,
        getBytes: async (path, cap) => { reads.push({path, cap}); return state.ciphertext; },
        ensureVaultKeyMaterial: async () => { state.keyRequests++; return VAULT_KEY; },
        showToast: (...args) => toasts.push(args), logError: (...args) => errors.push(args)
    });
    vm.runInContext(`${securityModule}\n${deadlineFunction}\n${SPY}\n`
        + 'globalThis.openDeadlineAttachment = openDeadlineAttachment;', context);
    return {opened, toasts, errors, reads, decrypts, state,
        invalidate: () => { state.active = false; },
        open: attachment => context.openDeadlineAttachment(attachment, () => state.active)};
}

const openers = [
    ['privato', () => realm('privato')],
    ['aziendale', () => realm('aziendale')],
    ['aziendale incorporato', () => realm('incorporato')],
    ['scadenza', deadlineRealm]
];

test('T-29: il ramo legacy apre l\'URL esterno, senza Vault Key e senza leggere byte', async () => {
    for (const [name, build] of openers) {
        const f = build();
        await f.open(LEGACY);
        assert.equal(f.opened.length, 1, `${name}: un solo URL aperto`);
        assert.equal(f.opened[0].url, 'https://example.invalid/report.pdf', `${name}: si apre l'URL del metadato`);
        assert.equal(f.opened[0].target, '_blank', `${name}: apertura in una nuova scheda`);
        assert.match(f.opened[0].features, /noopener/, `${name}: noopener resta applicato`);
        assert.match(f.opened[0].features, /noreferrer/, `${name}: noreferrer resta applicato`);
        assert.equal(f.state.keyRequests, 0, `${name}: la Vault Key NON viene richiesta`);
        assert.deepEqual(f.reads, [], `${name}: nessun byte letto da Storage`);
        assert.deepEqual(f.decrypts, [], `${name}: nessuna decifratura`);
        assert.deepEqual(f.errors, [], `${name}: nessun errore`);
        assert.deepEqual(f.toasts, [], `${name}: nessun avviso`);
    }
});

test('T-29: l\'URL legacy viene normalizzato e taglia l\'opener; nessun controllo di host', async () => {
    const f = realm('privato');
    await f.open({...LEGACY, url: 'example.invalid/report.pdf'});
    assert.equal(f.opened[0].url, 'https://example.invalid/report.pdf', 'schema mancante: si assume https');
    assert.equal(f.state.openResult.opener, null, 'opener viene azzerato sulla finestra aperta');
    // Nessuna allowlist di host: un URL legacy può puntare a un sito qualsiasi.
    await f.open({...LEGACY, url: 'https://phishing.invalid/steal'});
    assert.equal(f.opened[1].url, 'https://phishing.invalid/steal',
        'il percorso attuale non applica alcuna allowlist di host');
    assert.equal(f.state.keyRequests, 0, 'nemmeno per un host esterno la Vault Key viene coinvolta');
});

test('T-29: i protocolli attivi e gli URL non validi vengono rifiutati prima di aprire', async () => {
    const refused = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///C:/Windows/win.ini',
        'blob:https://example.invalid/9b1d', 'ftp://example.invalid/file.pdf', 'https://[malformato', '', null, undefined];
    for (const [name, build] of openers) {
        const f = build();
        for (const url of refused) {
            f.opened.length = 0;
            await f.open({...LEGACY, url});
            assert.deepEqual(f.opened, [], `${name}: nessun URL aperto per ${String(url)}`);
            assert.equal(f.state.keyRequests, 0, `${name}: nessuna Vault Key per ${String(url)}`);
            assert.deepEqual(f.reads, [], `${name}: nessun byte letto per ${String(url)}`);
            assert.ok(f.toasts.length > 0, `${name}: il rifiuto viene mostrato all'utente per ${String(url)}`);
        }
    }
});

test('T-29: un popup bloccato è riportato come successo; un\'eccezione no', async () => {
    for (const [name, build] of openers) {
        const f = build();
        f.state.openResult = null; // il browser blocca la nuova scheda: `window.open` restituisce null
        await f.open(LEGACY);
        // Comportamento attuale di `openExternalUrl`: la funzione restituisce
        // `true` anche quando non è stata aperta alcuna finestra, quindi il ramo
        // legacy non segnala nulla e non chiede la Vault Key.
        assert.equal(f.state.keyRequests, 0, `${name}: la Vault Key non viene richiesta`);
        assert.deepEqual(f.reads, [], `${name}: nessun byte letto`);
        assert.equal(f.opened.length, 1, `${name}: il tentativo di apertura è avvenuto`);
        assert.deepEqual(f.errors, [], `${name}: nessun errore: il blocco non è distinguibile dal successo`);
        assert.deepEqual(f.toasts, [], `${name}: nessun avviso all'utente`);
    }
    const throwing = realm('privato');
    throwing.state.openThrows = true;
    await throwing.open(LEGACY);
    assert.equal(throwing.state.keyRequests, 0, 'un\'eccezione di window.open non porta a chiedere la Vault Key');
    assert.equal(throwing.errors.length, 1, 'l\'eccezione viene registrata, non propagata');
    assert.equal(throwing.toasts.length, 1, 'l\'eccezione viene mostrata come errore');
});

test('T-29: a sessione invalidata il ramo legacy non apre nulla (tranne il percorso senza controllo)', async () => {
    for (const [name, build] of [['privato', () => realm('privato')], ['aziendale', () => realm('aziendale')],
        ['scadenza', deadlineRealm]]) {
        const f = build();
        f.invalidate();
        await f.open(LEGACY);
        assert.deepEqual(f.opened, [], `${name}: nessuna apertura a sessione invalidata`);
        assert.equal(f.state.keyRequests, 0, `${name}: nessuna Vault Key`);
        assert.deepEqual(f.reads, [], `${name}: nessuna lettura`);
    }
    // Il percorso degli allegati incorporati nell'anagrafica aziendale **non** ha
    // alcun parametro di sessione: è una differenza dichiarata, non una svista
    // del banco.
    const incorporato = realm('incorporato');
    incorporato.invalidate();
    await incorporato.open(LEGACY);
    assert.equal(incorporato.opened.length, 1,
        'il percorso incorporato apre senza controllo di sessione: comportamento attuale, dichiarato');
});

test('T-29: il ramo cifrato è diverso — Vault Key, byte con tetto, decifratura e URL blob', async () => {
    const sealed = await sealedAttachment();
    const f = realm('privato');
    f.state.ciphertext = sealed.ciphertext;
    await f.open(sealed.attachment);
    assert.equal(f.state.keyRequests, 1, 'la Vault Key viene richiesta una volta');
    assert.equal(f.reads.length, 1, 'i byte vengono letti da Storage');
    assert.equal(f.reads[0].path, CIPHERTEXT_PATH);
    assert.equal(f.reads[0].cap, 25 * 1024 * 1024 + 1024, 'la lettura porta il tetto di 25 MB');
    assert.equal(f.decrypts.length, 1, 'il payload viene decifrato');
    assert.equal(f.decrypts[0].vaultKey, VAULT_KEY, 'la decifratura usa la chiave del Vault');
    assert.equal(f.decrypts[0].size, sealed.ciphertext.length, 'la decifratura riceve il ciphertext letto');
    assert.equal(f.opened.length, 1, 'si apre l\'oggetto decifrato');
    assert.match(f.opened[0].url, /^blob:/, 'il ramo cifrato apre un URL blob, non un URL esterno');
    assert.deepEqual(f.errors, [], 'nessun errore nel percorso positivo');
});

test('T-29: nel ramo cifrato manca il percorso o l\'involucro è malformato', async () => {
    const sealed = await sealedAttachment();
    const missing = realm('privato');
    await missing.open({...sealed.attachment, storagePath: undefined});
    assert.equal(missing.state.keyRequests, 0, 'senza percorso non si chiede la Vault Key');
    assert.deepEqual(missing.reads, [], 'nessuna lettura');
    assert.deepEqual(missing.decrypts, [], 'nessuna decifratura');
    assert.deepEqual(missing.opened, [], 'nessuna apertura');
    assert.equal(missing.errors.length, 1, 'l\'errore viene registrato');

    const malformed = realm('privato');
    malformed.state.ciphertext = sealed.ciphertext;
    await malformed.open({...sealed.attachment, encryption: {version: 2, cipher: 'AES-GCM-256'}});
    assert.equal(malformed.state.keyRequests, 1, 'la chiave viene chiesta prima di validare l\'involucro');
    assert.equal(malformed.decrypts.length, 1, 'la decifratura viene tentata e fallisce');
    assert.deepEqual(malformed.opened, [], 'un involucro non valido non apre nulla');
    assert.equal(malformed.errors.length, 1, 'l\'errore viene registrato');
    assert.match(malformed.toasts[0][0], /Impossibile aprire/);
});
