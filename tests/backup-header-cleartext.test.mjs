import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// M7-T17 — Intestazione in chiaro del file `.cpbackup`: diagnosi del formato
// attuale con il **percorso reale di export** e la **crypto reale**.
//
// Valutazione preliminare dei banchi esistenti (per non duplicare):
//   - `tests/backup-crypto-runtime.test.mjs` prova che le voci sono cifrate, la
//     catena, l'ordine e il vincolo sul proprietario, ma **non** ispeziona
//     l'intestazione serializzata;
//   - `tests/backup-export-session.test.mjs` prova il flusso di export (ordine
//     delle scritture, interruzioni, capacità) con la **crypto sostituita**
//     (`createBackupHeader` → `{header: true}`, `encryptBackupEntry` passthrough):
//     non dice nulla su che cosa finisca in chiaro nel file;
//   - `tests/backup-export-model.test.mjs` copre modello e descrittori.
// Il divario è quindi: **che cosa è leggibile nel file prodotto**, con dati veri.
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const asModule = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const cryptoApi = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-crypto.js'));
const modelApi = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-export-model.js'));
const bufferApi = await asModule(await read('../Frontend/public/assets/js/modules/settings/backup-export-buffer.js'));
const serviceSource = (await read('../Frontend/public/assets/js/modules/settings/backup-export-service.js'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

// Marcatori sintetici: non sono dati reali e servono a cercare fughe in chiaro.
const MARKERS = {
    profile: 'SYNTHETIC-PROFILE-SECRET',
    password: 'SYNTHETIC-ACCOUNT-PASSWORD',
    note: 'SYNTHETIC-NOTE-SECRET',
    attachment: 'SYNTHETIC-ATTACHMENT-BYTES',
    storagePath: 'users/A/accounts/account-1/attachments/sintetico.pdf'
};

function fixture(uid = 'A') {
    const writes = [];
    const sink = {write: async value => { writes.push(value); }, close: async () => {}};
    // Le sorgenti del backup sono identificatori liberi nel modulo: vanno passate
    // come parametri della funzione, non assegnate all'oggetto restituito.
    const repositories = {};
    for (const name of ['listBackupCompanies', 'listBackupCompanyAccounts', 'listBackupCompanyAttachments',
        'listBackupAccountWidgets', 'listBackupContacts', 'listBackupDeadlines', 'listBackupProfileWidgets',
        'listBackupSettings', 'listBackupSharedVaultData', 'listBackupSharedVaultLinks']) {
        repositories[name] = async () => [];
    }
    repositories.listBackupPrivateAccounts = async () => [{id: 'account-1', nomeAccount: 'Sintetico',
        password: MARKERS.password, note: MARKERS.note}];
    repositories.listBackupPrivateAttachments = async () => [{id: 'att-1', name: 'Sintetico.pdf',
        storagePath: MARKERS.storagePath}];
    repositories.getBackupProfile = async () => ({nome: 'Sintetico', note: MARKERS.profile});
    repositories.getBytes = async () => new TextEncoder().encode(MARKERS.attachment);
    const names = Object.keys(repositories);
    const factory = new Function(...names, 'auth', 'navigator', 'window', 'onAuthStateChanged', 'addEventListener',
        'removeEventListener', 'createBackupExportBuffer', 'createBackupRecordBuffer', 'generateRecoveryKey',
        'createBackupHeader', 'deriveBackupKey', 'encryptBackupEntry', 'serializeBackupLine', 'parseBackupLine',
        'verifyBackupChain', 'createProfileDescriptorFromData', 'createRecordDescriptorFromData',
        'attachmentRecordScope', 'collectStoragePaths', 'ref', 'storage', 'btoa', 'console',
        `${serviceSource}\nreturn {exportOwnerBackup, collectOwnerBackup};`);
    const module = factory(...names.map(name => repositories[name]),
        {currentUser: {uid}}, {onLine: true},
        {showSaveFilePicker: async () => ({createWritable: async () => sink})},
        () => () => {}, () => {}, () => {},
        bufferApi.createBackupExportBuffer, bufferApi.createBackupRecordBuffer,
        cryptoApi.generateRecoveryKey, cryptoApi.createBackupHeader, cryptoApi.deriveBackupKey,
        cryptoApi.encryptBackupEntry, cryptoApi.serializeBackupLine, cryptoApi.parseBackupLine,
        cryptoApi.verifyBackupChain,
        modelApi.createProfileDescriptorFromData, modelApi.createRecordDescriptorFromData,
        modelApi.attachmentRecordScope, modelApi.collectStoragePaths,
        (_storage, path) => path, {}, value => Buffer.from(value, 'binary').toString('base64'),
        {warn() {}, log() {}});
    return {module, writes, text: () => writes.join('')};
}

test('T-17: nel file di backup sono in chiaro solo i campi dichiarati dell’intestazione', async () => {
    const f = fixture();
    const result = await f.module.exportOwnerBackup('A');
    const lines = f.text().trimEnd().split('\n');
    const header = cryptoApi.parseBackupLine(lines[0]);

    // 1. Prima riga leggibile: **esattamente** i campi censiti, nessuno di più.
    assert.deepEqual(Object.keys(header).sort(),
        ['backupId', 'cipher', 'createdAt', 'format', 'kdf', 'ownerUid', 'schemaVersion']);
    assert.equal(header.ownerUid, 'A', 'il proprietario è in chiaro');
    assert.equal(header.format, 'codici-password-backup');
    assert.equal(header.schemaVersion, 2);
    assert.equal(header.cipher, 'AES-GCM-256-CHAINED');
    assert.match(header.backupId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        'un identificatore casuale di file');
    assert.equal(Number.isSafeInteger(header.createdAt), true, 'la data di creazione è un intero');
    // 2. Parametri KDF in chiaro: nome, iterazioni e salt (32 byte in base64).
    assert.deepEqual(Object.keys(header.kdf).sort(), ['iterations', 'name', 'salt']);
    assert.equal(header.kdf.name, 'PBKDF2-SHA256');
    assert.equal(header.kdf.iterations, 600000);
    assert.equal(Buffer.from(header.kdf.salt, 'base64').length, 32);
    // 3. Le righe successive sono **solo** buste cifrate, footer compreso.
    for (const line of lines.slice(1)) {
        const envelope = cryptoApi.parseBackupLine(line);
        assert.deepEqual(Object.keys(envelope).sort(), ['ciphertext', 'iv', 'previousDigest', 'sequence']);
        assert.equal(Buffer.from(envelope.iv, 'base64').length, 12, 'IV AES-GCM di 12 byte');
        assert.equal(typeof envelope.ciphertext, 'string');
    }
    assert.equal(lines.length, result.recordCount + result.attachmentCount + 2,
        'una riga di intestazione, una per voce, una di chiusura');
});

test('T-17: nessun segreto del Vault o del contenuto compare in chiaro nel file', async () => {
    const f = fixture();
    const result = await f.module.exportOwnerBackup('A');
    const text = f.text();
    // La chiave di recupero esiste solo nella risposta all'utente, non nel file.
    assert.equal(text.includes(result.recoveryKey), false, 'la Recovery Key non è nel file');
    for (const [name, marker] of Object.entries(MARKERS)) {
        assert.equal(text.includes(marker), false, `nessuna fuga in chiaro di ${name}`);
    }
    // Nemmeno i nomi delle chiavi del corpo compaiono nell'intestazione.
    const header = cryptoApi.parseBackupLine(text.trimEnd().split('\n')[0]);
    assert.equal(JSON.stringify(header).includes('recordCount'), false);
    assert.equal(JSON.stringify(header).includes('entryCount'), false);
    assert.equal(/entryCount|recordCount|attachmentCount/.test(text), false,
        'i conteggi del footer restano cifrati');
});

test('T-17: il file è un backup valido — la catena si riapre solo con la chiave di recupero', async () => {
    const f = fixture();
    const result = await f.module.exportOwnerBackup('A');
    const lines = f.text().trimEnd().split('\n');
    const header = cryptoApi.parseBackupLine(lines[0]);
    const envelopes = lines.slice(1).map(cryptoApi.parseBackupLine);
    const key = await cryptoApi.deriveBackupKey(header, result.recoveryKey, 'A');
    const verified = await cryptoApi.verifyBackupChain({header, key, envelopes});

    // Controllo positivo: i marcatori esistono, ma **dentro** il ciphertext.
    const serialized = JSON.stringify(verified.entries);
    for (const marker of [MARKERS.profile, MARKERS.password, MARKERS.note, MARKERS.storagePath]) {
        assert.equal(serialized.includes(marker), true, `il contenuto è recuperabile con la chiave (${marker})`);
    }
    // I byte dell'allegato viaggiano in base64 nel payload cifrato.
    const attachment = verified.entries.find(entry => entry.kind === 'attachment');
    assert.equal(Buffer.from(attachment.content, 'base64').toString('utf8'), MARKERS.attachment,
        'i byte dell’allegato sono recuperabili solo dopo la decifratura');
    assert.equal(verified.footer.entryCount, result.recordCount + result.attachmentCount);
    assert.equal(verified.footer.recordCount, result.recordCount);
    assert.equal(verified.footer.attachmentCount, result.attachmentCount);
    // Con una chiave sbagliata la catena non si apre.
    await assert.rejects(async () => {
        const wrong = await cryptoApi.deriveBackupKey(header, cryptoApi.generateRecoveryKey(), 'A');
        return cryptoApi.verifyBackupChain({header, key: wrong, envelopes});
    });
});

test('T-17: due backup diversi non condividono identificatore né salt', async () => {
    const first = fixture(), second = fixture();
    await first.module.exportOwnerBackup('A');
    await second.module.exportOwnerBackup('A');
    const headerOf = f => cryptoApi.parseBackupLine(f.text().trimEnd().split('\n')[0]);
    const [a, b] = [headerOf(first), headerOf(second)];
    assert.notEqual(a.backupId, b.backupId, 'identificatore casuale per file');
    assert.notEqual(a.kdf.salt, b.kdf.salt, 'salt casuale per file');
    assert.equal(a.ownerUid, b.ownerUid, 'il proprietario resta in chiaro in entrambi');
});
