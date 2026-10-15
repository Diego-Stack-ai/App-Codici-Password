import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {
    buildPortableProjections, buildProjectionTables, iteratePortableProjectionEntries,
    PORTABLE_PROJECTION_FORMAT, sha256Base64
} from '../Frontend/public/assets/js/modules/settings/portable-archive-projections.js';
import {
    createPortableCapacityGuard, portableRecordKey, reconcilePortableAttachmentInventory
} from '../Frontend/public/assets/js/modules/settings/portable-archive-inventory.js';
import {
    createBoundedPortableSink, createPortableArchiveWriter, createPortableHeader,
    evaluatePortableArchivePassword, linesFromByteChunks, PORTABLE_ARCHIVE_LIMITS, verifyPortableArchiveLines
} from '../Frontend/public/assets/js/modules/settings/portable-archive-stream.js';
import {buildPortableViewerHtml} from '../Frontend/public/assets/js/modules/settings/portable-archive-viewer.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STRONG_PASSWORD = 'Fiume!Quarzo-83#Luna';

function memorySink({failAfter = Infinity} = {}) {
    const parts = [];
    let writes = 0, closed = false, aborted = false;
    return {
        async write(value) {
            if (++writes > failAfter) throw Object.assign(new Error('QUOTA_EXCEEDED'), {name: 'QuotaExceededError'});
            parts.push(Uint8Array.from(value));
        },
        async close() { closed = true; },
        async abort() { aborted = true; parts.length = 0; },
        bytes() {
            const size = parts.reduce((sum, part) => sum + part.byteLength, 0), output = new Uint8Array(size);
            let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
            return output;
        },
        get closed() { return closed; }, get aborted() { return aborted; }
    };
}

async function verifyBytes(bytes, password, options = {}) {
    return verifyPortableArchiveLines(linesFromByteChunks([bytes]), password, {cryptoApi: webcrypto, ...options});
}

function canonicalHeader(header) {
    return JSON.stringify({
        format: header.format, formatVersion: header.formatVersion, schemaVersion: header.schemaVersion,
        archiveId: header.archiveId, createdAt: header.createdAt, chunkSize: header.chunkSize,
        kdf: header.kdf, cipher: header.cipher
    });
}

async function rewriteAuthenticatedFooter(bytes, password, mutate) {
    const text = new TextDecoder().decode(bytes);
    const lines = text.trimEnd().split('\n');
    const header = JSON.parse(lines[0]);
    const footerIndex = lines.length - 2;
    const footer = JSON.parse(lines[footerIndex]);
    const raw = new TextEncoder().encode(password);
    const salt = new Uint8Array(Buffer.from(header.kdf.salt, 'base64'));
    const material = await webcrypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
    const key = await webcrypto.subtle.deriveKey({
        name: 'PBKDF2', hash: 'SHA-256', salt, iterations: header.kdf.iterations
    }, material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
    const aad = new TextEncoder().encode(
        `${canonicalHeader(header)}\nfooter\n${footer.sequence}\n${footer.previousDigest}`
    );
    const clear = new Uint8Array(await webcrypto.subtle.decrypt({
        name: 'AES-GCM', iv: Buffer.from(footer.iv, 'base64'), additionalData: aad
    }, key, Buffer.from(footer.ciphertext, 'base64')));
    const manifest = JSON.parse(new TextDecoder().decode(clear));
    mutate(manifest);
    const replacementIv = webcrypto.getRandomValues(new Uint8Array(12));
    const replacement = new Uint8Array(await webcrypto.subtle.encrypt({
        name: 'AES-GCM', iv: replacementIv, additionalData: aad
    }, key, new TextEncoder().encode(JSON.stringify(manifest))));
    footer.iv = Buffer.from(replacementIv).toString('base64');
    footer.ciphertext = Buffer.from(replacement).toString('base64');
    lines[footerIndex] = JSON.stringify(footer);
    lines[lines.length - 1] = JSON.stringify({
        ...JSON.parse(lines[lines.length - 1]),
        finalDigest: Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(lines[footerIndex]))).toString('base64')
    });
    raw.fill(0); salt.fill(0); clear.fill(0); replacement.fill(0); replacementIv.fill(0);
    return new TextEncoder().encode(`${lines.join('\n')}\n`);
}

async function createFixtureArchive(records = [{key: 'fixture:::1', scope: 'fixture', id: '1', data: {value: 1}}]) {
    const sink = memorySink();
    const writer = await createPortableArchiveWriter({
        sink, password: STRONG_PASSWORD,
        header: createPortableHeader({chunkSize: 64 * 1024, cryptoApi: webcrypto}), cryptoApi: webcrypto
    });
    const payload = new TextEncoder().encode(JSON.stringify({records}));
    await writer.addEntry({id: 'records', kind: 'records', name: 'dati.json', type: 'application/json'}, payload);
    await writer.addEntry({id: 'projection:json', kind: 'json', name: 'dati-completi.json', type: 'application/json'}, payload);
    payload.fill(0);
    await writer.close({counts: {records: records.length, attachments: 0, projections: 1}});
    return sink.bytes();
}

function readStoredZip(bytes) {
    const entries = new Map();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;
    while (offset + 4 <= bytes.byteLength && view.getUint32(offset, true) === 0x04034B50) {
        const size = view.getUint32(offset + 18, true);
        const nameLength = view.getUint16(offset + 26, true);
        const extraLength = view.getUint16(offset + 28, true);
        const nameStart = offset + 30;
        const dataStart = nameStart + nameLength + extraLength;
        const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
        entries.set(name, bytes.subarray(dataStart, dataStart + size));
        offset = dataStart + size;
    }
    return entries;
}

test('il visualizzatore v2 è autonomo, offline e privo di dati incorporati', () => {
    const html = buildPortableViewerHtml({title: '<Archivio>'});
    assert.match(html, /default-src 'none'/);
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /&lt;Archivio&gt;/);
    assert.match(html, /archivio\.cpportable/);
    assert.match(html, /Integrità e autenticità/i);
    assert.doesNotMatch(html, /utente-sintetico/);
});

test('le proiezioni preservano campi futuri e neutralizzano le formule', async () => {
    const records = [{
        key: 'private-account:::a1', scope: 'private-account', id: 'a1', title: 'Conto',
        data: {
            utente: 'sintetico', nuovoWidget: {colore: 'blu', valore: 7},
            nota: '=HYPERLINK("https://invalid.test")', controllo: 'prima\u0001dopo'
        }
    }, {
        key: 'profile-widget:::w1', scope: 'profile-widget', id: 'w1', title: 'Widget futuro',
        data: {tipo: 'fixture', campiAggiuntivi: ['uno', 'due']}
    }];
    const tables = buildProjectionTables(records);
    assert.equal(tables.length, 2);
    assert.ok(tables.find(table => table.scope === 'private-account').columns.includes('data.nuovoWidget.colore'));

    const projections = await buildPortableProjections(records, {
        createdAt: '2026-10-14T10:00:00.000Z', cryptoApi: webcrypto
    });
    assert.equal(projections.version, PORTABLE_PROJECTION_FORMAT.version);
    const accountCsv = Buffer.from(projections.csv.find(file => file.scope === 'private-account').content, 'base64').toString('utf8');
    assert.match(accountCsv, /data\.nuovoWidget\.colore/);
    assert.match(accountCsv, /'=HYPERLINK/);
    assert.doesNotMatch(accountCsv, /,"=HYPERLINK/);

    const odsBytes = new Uint8Array(Buffer.from(projections.ods.content, 'base64'));
    const entries = readStoredZip(odsBytes);
    assert.equal(new TextDecoder().decode(entries.get('mimetype')), PORTABLE_PROJECTION_FORMAT.odsMime);
    assert.ok(entries.has('content.xml'));
    assert.ok(entries.has('META-INF/manifest.xml'));
    const content = new TextDecoder().decode(entries.get('content.xml'));
    assert.match(content, /data\.nuovoWidget\.colore/);
    assert.match(content, /&apos;=HYPERLINK/);
    assert.match(content, /prima\uFFFDdopo/);
    assert.doesNotMatch(content, /\u0001/);
    assert.doesNotMatch(content, /table:formula/);
    assert.equal(projections.ods.sha256, await sha256Base64(odsBytes, webcrypto));

});

test('la capacità ammette i limiti esatti e fallisce senza allocare file enormi', () => {
    const oneFile = createPortableCapacityGuard({perFileBytes: 8, totalBytes: 12});
    assert.equal(oneFile.accept(8), 8);
    assert.throws(() => oneFile.accept(5), {code: 'PORTABLE_CAPACITY_EXCEEDED'});
    assert.equal(oneFile.totalBytes, 8);
    assert.equal(oneFile.accept(4), 12);
    assert.throws(() => oneFile.accept(1), {code: 'PORTABLE_CAPACITY_EXCEEDED'});

    const perFile = createPortableCapacityGuard({perFileBytes: 8, totalBytes: 16});
    assert.throws(() => perFile.accept(9), {code: 'PORTABLE_ATTACHMENT_CAPACITY_EXCEEDED'});
    assert.equal(perFile.totalBytes, 0);
    assert.throws(() => perFile.accept(-1), {code: 'PORTABLE_ATTACHMENT_SIZE_INVALID'});
    assert.throws(
        () => createPortableCapacityGuard({perFileBytes: 8, totalBytes: 7}),
        {code: 'PORTABLE_CAPACITY_LIMIT_INVALID'}
    );
});

test('l’inventario sintetico riconcilia ogni allegato e tutte le relazioni', () => {
    const shared = {storagePath: 'users/fixture/shared/card.jpg', name: 'card.jpg', mimeType: 'image/jpeg'};
    const profile = {scope: 'profile', id: 'fixture', data: {documenti: [{allegati: [shared]}]}};
    const privateAccount = {scope: 'private-account', id: 'a1', data: {nome: 'Privato'}};
    const privateAttachment = {
        scope: 'private-account-attachment', id: 'p1', accountId: 'a1',
        data: {storagePath: 'users/fixture/private/p1.jpg', name: 'p1.jpg', mimeType: 'image/jpeg'}
    };
    const companyAccount = {scope: 'company-account', id: 'a2', companyId: 'c1', data: {nome: 'Azienda'}};
    const companyAttachment = {
        scope: 'company-account-attachment', id: 'c1', accountId: 'a2', companyId: 'c1',
        data: {storagePath: 'users/fixture/company/c1.pdf', name: 'c1.pdf', mimeType: 'application/pdf'}
    };
    const deadline = {scope: 'deadline', id: 'd1', data: {allegato: {...shared}}};
    const records = [profile, privateAccount, privateAttachment, companyAccount, companyAttachment, deadline];
    const projected = new Set([profile, privateAccount, companyAccount, deadline].map(portableRecordKey));
    const inventory = reconcilePortableAttachmentInventory(records, [
        'users/fixture/company/c1.pdf', 'users/fixture/private/p1.jpg', 'users/fixture/shared/card.jpg'
    ], projected);
    assert.equal(inventory.length, 3);
    assert.deepEqual(
        inventory.find(item => item.storagePath.endsWith('shared/card.jpg')).recordKeys,
        ['deadline:::d1', 'profile:::fixture']
    );
    assert.deepEqual(
        inventory.find(item => item.storagePath.endsWith('private/p1.jpg')).recordKeys,
        ['private-account:::a1']
    );
    assert.deepEqual(
        inventory.find(item => item.storagePath.endsWith('company/c1.pdf')).recordKeys,
        ['company-account:c1::a2']
    );

    assert.throws(
        () => reconcilePortableAttachmentInventory(records, ['users/fixture/missing.bin'], projected),
        {code: 'PORTABLE_ATTACHMENT_INVENTORY_MISMATCH'}
    );
    assert.throws(
        () => reconcilePortableAttachmentInventory([privateAttachment], ['users/fixture/private/p1.jpg'], projected),
        {code: 'PORTABLE_ATTACHMENT_OWNER_MISSING'}
    );
    const conflict = {scope: 'deadline', id: 'd2', data: {allegato: {...shared, mimeType: 'application/pdf'}}};
    assert.throws(
        () => reconcilePortableAttachmentInventory(
            [profile, deadline, conflict], ['users/fixture/shared/card.jpg'],
            new Set([profile, deadline, conflict].map(portableRecordKey))
        ),
        {code: 'PORTABLE_ATTACHMENT_METADATA_CONFLICT'}
    );
});

test('la proiezione regge il limite sintetico di 10.000 record', async () => {
    const records = Array.from({length: 10000}, (_, index) => ({
        key: `private-account:::fixture-${index}`, scope: 'private-account', id: `fixture-${index}`,
        title: `Account sintetico ${index}`, data: {utente: `utente-${index}`, futuro: {indice: index}}
    }));
    const projections = await buildPortableProjections(records, {
        createdAt: '2026-10-14T10:00:00.000Z', cryptoApi: webcrypto
    });
    assert.equal(projections.csv.length, 1);
    assert.ok(projections.json.size > 1_000_000);
    assert.ok(projections.ods.size > 1_000_000);
    assert.match(Buffer.from(projections.csv[0].content, 'base64').toString('utf8'), /fixture-9999/);
});

test('il runtime emette le proiezioni una alla volta come byte, senza Base64 cumulativo', async () => {
    const records = [{key: 'fixture:::1', scope: 'fixture', id: '1', title: 'Fixture', data: {futuro: {valore: 9}}}];
    const entries = [];
    for await (const entry of iteratePortableProjectionEntries(records, {createdAt: '2026-10-15T10:00:00.000Z'})) {
        assert.ok(entry.bytes instanceof Uint8Array);
        assert.equal('content' in entry, false);
        entries.push({kind: entry.kind, filename: entry.filename});
        entry.bytes.fill(0);
    }
    assert.deepEqual(entries, [
        {kind: 'json', filename: 'dati-completi.json'},
        {kind: 'csv', filename: 'fixture.csv'},
        {kind: 'ods', filename: 'archivio-portabile.ods'}
    ]);
});

test('la UI distingue esplicitamente archivio portabile e backup', async () => {
    const html = await readFile(resolve(root, 'Frontend/public/impostazioni.html'), 'utf8');
    const settings = await readFile(resolve(root, 'Frontend/public/assets/js/modules/settings/impostazioni.js'), 'utf8');
    const settingsCss = await readFile(resolve(root, 'Frontend/public/assets/css/impostazioni.css'), 'utf8');
    const settingsTranslations = await readFile(resolve(root, 'Frontend/public/assets/js/translations/settings.js'), 'utf8');
    const service = await readFile(resolve(root, 'Frontend/public/assets/js/modules/settings/portable-archive-service.js'), 'utf8');
    const stream = await readFile(resolve(root, 'Frontend/public/assets/js/modules/settings/portable-archive-stream.js'), 'utf8');
    const offline = await readFile(resolve(root, 'Frontend/public/offline-assets.js'), 'utf8');
    assert.match(html, /id="btn-export-portable-archive"/);
    assert.match(html, /id="btn-export-encrypted-backup"/);
    assert.match(settings, /t\('portable_acknowledge'\)/);
    assert.match(settings, /className: 'portable-archive-close'/);
    assert.match(settings, /cancelButton\.addEventListener\('click', \(\) => action\.dispose\(\)\)/);
    assert.match(settings, /event\.key === 'Escape'/);
    assert.match(settings, /event\.target === modal/);
    assert.match(settingsCss, /\.portable-archive-modal\s*\{[^}]*overflow-y:\s*auto;/s);
    assert.match(settingsCss, /\.portable-archive-modal > \.modal-actions\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;/s);
    assert.match(settingsTranslations, /non è un backup reimportabile/);
    assert.match(settings, /forceReload: true, promptImmediately: true/);
    assert.match(settings, /PORTABLE_ATTACHMENT_CAPACITY_EXCEEDED/);
    assert.match(settings, /PORTABLE_ATTACHMENT_METADATA_CONFLICT/);
    assert.match(offline, /portable-archive-service\.js/);
    assert.match(offline, /portable-archive-inventory\.js/);
    assert.match(offline, /portable-archive-projections\.js/);
    assert.match(offline, /portable-archive-stream\.js/);
    assert.match(offline, /portable-archive-viewer\.js/);
    assert.match(service, /'account-widget-profile'/);
    assert.match(service, /reconcilePortableAttachmentInventory/);
    assert.match(service, /createPortableCapacityGuard/);
    assert.match(service, /createPortableArchiveWriter/);
    assert.match(service, /preparePortableArchiveOutput/);
    assert.match(service, /LEGACY_VAULT_KEY_MATERIAL_FIELD = \['master', 'Key'\]\.join\(''\)/);
    assert.doesNotMatch(service, /\bmasterKey\b/);
    assert.match(settings, /vaultKeyMaterial = await ensureVaultKeyMaterial/);
    assert.match(stream, /PORTABLE_STREAMING_REQUIRED/);
});

test('la policy password rifiuta valori corti, comuni o ripetitivi e ammette password robuste', async () => {
    const rejected = [
        ['corta-123', 'PORTABLE_PASSWORD_TOO_SHORT'],
        ['PasswordPassword', 'PORTABLE_PASSWORD_COMMON'],
        ['PasswordPassword123!', 'PORTABLE_PASSWORD_COMMON'],
        ['abcabcabcabcabc', 'PORTABLE_PASSWORD_REPETITIVE'],
        ['Abc12Abc12Abc12', 'PORTABLE_PASSWORD_REPETITIVE'],
        ['Abc12Abc12Abc12!', 'PORTABLE_PASSWORD_REPETITIVE'],
        ['aaaaaaaaaaaaaa', 'PORTABLE_PASSWORD_REPETITIVE']
    ];
    for (const [password, code] of rejected) {
        assert.equal(evaluatePortableArchivePassword(password).code, code);
        await assert.rejects(
            () => createPortableArchiveWriter({
                sink: memorySink(), password,
                header: createPortableHeader({cryptoApi: webcrypto}), cryptoApi: webcrypto
            }),
            {code}
        );
    }
    assert.equal(evaluatePortableArchivePassword(STRONG_PASSWORD).valid, true);
    assert.equal(evaluatePortableArchivePassword('questa frase contiene parole tutte distinte').valid, true);
    assert.equal(evaluatePortableArchivePassword('Fiume!Quarzo-83#Lunà').valid, true);

    const legacyHeader = createPortableHeader({cryptoApi: webcrypto});
    await assert.rejects(
        () => verifyPortableArchiveLines([JSON.stringify(legacyHeader)], 'aaaaaaaaaaaa', {cryptoApi: webcrypto}),
        /PORTABLE_INCOMPLETE/
    );
});

test('il formato v2 cifra a chunk, concatena l’ordine e verifica il manifest prima di esporre i dati', async () => {
    const sink = memorySink();
    const header = createPortableHeader({
        createdAt: '2026-10-15T10:00:00.000Z', chunkSize: 64 * 1024, cryptoApi: webcrypto
    });
    const writer = await createPortableArchiveWriter({sink, password: STRONG_PASSWORD, header, cryptoApi: webcrypto});
    const records = new TextEncoder().encode(JSON.stringify({records: [{data: {campoFuturo: {valore: 42}}}]}));
    const attachment = new Uint8Array(150000).map((_, index) => index % 251);
    await writer.addEntry({id: 'records', kind: 'records', name: 'dati.json', type: 'application/json'}, records);
    await writer.addEntry({id: 'attachment-1', kind: 'attachment', name: 'fixture.bin', recordKeys: ['private-account:::fixture']}, attachment);
    const manifest = await writer.close({
        counts: {records: 1, attachments: 1}, format: 'override-vietato', entries: []
    });
    assert.equal(sink.closed, true);
    assert.equal(manifest.format, 'codici-password-portable-manifest');
    assert.equal(manifest.entries[1].chunkCount, 3);
    assert.equal(manifest.entries[1].size, attachment.byteLength);

    const opened = await verifyBytes(sink.bytes(), STRONG_PASSWORD, {retainKinds: ['records']});
    assert.equal(opened.manifest.counts.attachments, 1);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(opened.retained.get('records'))), JSON.parse(new TextDecoder().decode(records)));
    assert.equal(opened.retained.has('attachment-1'), false);
});

test('il formato v2 rifiuta password errata, manomissione, riordino e output incompleto', async () => {
    const sink = memorySink();
    const writer = await createPortableArchiveWriter({
        sink, password: STRONG_PASSWORD,
        header: createPortableHeader({chunkSize: 64 * 1024, cryptoApi: webcrypto}), cryptoApi: webcrypto
    });
    await writer.addEntry({id: 'fixture', kind: 'records'}, new Uint8Array(100000).fill(7));
    await writer.close();
    const bytes = sink.bytes();
    await assert.rejects(() => verifyBytes(bytes, 'password-errata-123'));

    const text = new TextDecoder().decode(bytes), lines = text.trimEnd().split('\n');
    const altered = JSON.parse(lines[1]);
    altered.ciphertext = `${altered.ciphertext.slice(0, -2)}AA`;
    const tampered = new TextEncoder().encode([lines[0], JSON.stringify(altered), ...lines.slice(2)].join('\n') + '\n');
    await assert.rejects(() => verifyBytes(tampered, STRONG_PASSWORD));

    const reordered = new TextEncoder().encode([lines[0], lines[2], lines[1], ...lines.slice(3)].join('\n') + '\n');
    await assert.rejects(() => verifyBytes(reordered, STRONG_PASSWORD), /PORTABLE_CHAIN_INVALID/);
    const incomplete = new TextEncoder().encode(lines.slice(0, -2).join('\n') + '\n');
    await assert.rejects(() => verifyBytes(incomplete, STRONG_PASSWORD), /PORTABLE_INCOMPLETE/);
});

test('manifest entryCount e fine archivio coprono l’intero contenitore', async () => {
    const bytes = await createFixtureArchive();
    const invalidCount = await rewriteAuthenticatedFooter(bytes, STRONG_PASSWORD, manifest => {
        manifest.entryCount += 1;
    });
    await assert.rejects(() => verifyBytes(invalidCount, STRONG_PASSWORD), /PORTABLE_MANIFEST_INVALID/);

    const text = new TextDecoder().decode(bytes);
    await assert.rejects(
        () => verifyBytes(new TextEncoder().encode(`${text}   \ncontenuto-non-autenticato\n`), STRONG_PASSWORD),
        /PORTABLE_TRAILING_DATA/
    );
    const accepted = await verifyBytes(new TextEncoder().encode(`${text}   \n\t\n`), STRONG_PASSWORD, {retainKinds: []});
    assert.equal(accepted.manifest.entryCount, 2);
});

test('parser e verificatore falliscono chiusi sui budget di file, linea, frame, entry, record e plaintext', async () => {
    const encoded = new TextEncoder();
    await assert.rejects(async () => {
        for await (const ignored of linesFromByteChunks([encoded.encode('123456789')], {maxFileBytes: 8, maxLineBytes: 8})) {
            void ignored;
        }
    }, /PORTABLE_FILE_LIMIT/);
    await assert.rejects(async () => {
        for await (const ignored of linesFromByteChunks([encoded.encode('123456789')], {maxFileBytes: 16, maxLineBytes: 8})) {
            void ignored;
        }
    }, /PORTABLE_LINE_LIMIT/);

    const bytes = await createFixtureArchive([
        {key: 'fixture:::1', scope: 'fixture', id: '1', data: {value: 'contenuto sintetico abbastanza lungo'}},
        {key: 'fixture:::2', scope: 'fixture', id: '2', data: {value: 2}}
    ]);
    const directLines = new TextDecoder().decode(bytes).trimEnd().split('\n');
    await assert.rejects(
        () => verifyPortableArchiveLines(directLines, STRONG_PASSWORD, {
            cryptoApi: webcrypto, limits: {maxFileBytes: 1}
        }),
        /PORTABLE_FILE_LIMIT/
    );
    await assert.rejects(
        () => verifyPortableArchiveLines([...directLines, ' '], STRONG_PASSWORD, {
            cryptoApi: webcrypto, limits: {maxLines: directLines.length}
        }),
        /PORTABLE_LINE_LIMIT/
    );
    await assert.rejects(() => verifyBytes(bytes, STRONG_PASSWORD, {limits: {maxFrames: 2}}), /PORTABLE_FRAME_LIMIT/);
    await assert.rejects(() => verifyBytes(bytes, STRONG_PASSWORD, {limits: {maxEntries: 1}}), /PORTABLE_MANIFEST_INVALID|PORTABLE_ENTRY_LIMIT/);
    await assert.rejects(() => verifyBytes(bytes, STRONG_PASSWORD, {limits: {maxRecords: 1}}), /PORTABLE_RECORD_LIMIT/);
    await assert.rejects(
        () => verifyBytes(bytes, STRONG_PASSWORD, {limits: {maxRetainedPlaintextBytes: 16}}),
        /PORTABLE_RETAINED_LIMIT/
    );
    assert.equal(PORTABLE_ARCHIVE_LIMITS.maxFileBytes, 384 * 1024 * 1024);
    assert.equal(PORTABLE_ARCHIVE_LIMITS.maxRecords, 10000);
});

test('annullamento ed errore di spazio abortiscono il sink senza risultato utilizzabile', async () => {
    const controller = new AbortController(), cancelledSink = memorySink();
    const cancelled = await createPortableArchiveWriter({
        sink: cancelledSink, password: STRONG_PASSWORD, signal: controller.signal,
        header: createPortableHeader({chunkSize: 64 * 1024, cryptoApi: webcrypto}), cryptoApi: webcrypto
    });
    controller.abort();
    await assert.rejects(() => cancelled.addEntry({id: 'fixture', kind: 'records'}, new Uint8Array(1)), {name: 'AbortError'});
    assert.equal(cancelledSink.aborted, true);
    assert.equal(cancelledSink.bytes().byteLength, 0);

    const quotaSink = memorySink({failAfter: 1});
    const quota = await createPortableArchiveWriter({
        sink: quotaSink, password: STRONG_PASSWORD,
        header: createPortableHeader({chunkSize: 64 * 1024, cryptoApi: webcrypto}), cryptoApi: webcrypto
    });
    await assert.rejects(() => quota.addEntry({id: 'fixture', kind: 'attachment'}, new Uint8Array(70000)), {name: 'QuotaExceededError'});
    assert.equal(quotaSink.aborted, true);
    assert.equal(quotaSink.bytes().byteLength, 0);

    const duplicateSink = memorySink();
    const duplicate = await createPortableArchiveWriter({
        sink: duplicateSink, password: STRONG_PASSWORD,
        header: createPortableHeader({chunkSize: 64 * 1024, cryptoApi: webcrypto}), cryptoApi: webcrypto
    });
    await duplicate.addEntry({id: 'fixture', kind: 'attachment'}, new Uint8Array([1]));
    await assert.rejects(
        () => duplicate.addEntry({id: 'fixture', kind: 'attachment'}, new Uint8Array([2])),
        /PORTABLE_ENTRY_DUPLICATE/
    );
    assert.equal(duplicateSink.aborted, true);
    assert.equal(duplicateSink.bytes().byteLength, 0);
    await assert.rejects(() => duplicate.close(), /PORTABLE_WRITER_CLOSED/);
});

test('il fallback conserva soltanto chunk cifrati entro un limite esplicito', async () => {
    let completed = 0;
    const sink = createBoundedPortableSink({limitBytes: 64 * 1024, onComplete: async parts => { completed = parts.length; }});
    await sink.write(new Uint8Array(32000));
    await sink.write(new Uint8Array(32000));
    assert.equal(sink.size, 64000);
    await sink.close();
    assert.ok(completed > 0);
    assert.equal(sink.size, 0);

    const exceeded = createBoundedPortableSink({limitBytes: 64 * 1024});
    await assert.rejects(() => exceeded.write(new Uint8Array(70 * 1024)), {code: 'PORTABLE_STREAMING_REQUIRED'});
    await exceeded.abort();
    assert.equal(exceeded.size, 0);
});
