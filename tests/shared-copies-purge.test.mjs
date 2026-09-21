import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// M7-T08 — Asserzioni di sorgente che completano la misura su Emulator
// (`tests/shared-copies-purge.emulator.test.mjs`): chi scrive lo stato sospeso,
// che cosa il purge non tocca, e perché la condivisione delle Scadenze è un
// percorso separato.
const root = new URL('../Frontend/public/', import.meta.url);
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const indexSource = await read('../functions/index.js');
const purgeSlice = indexSource.slice(indexSource.indexOf('exports.purgeArchivedAccount'),
    indexSource.indexOf('exports.restoreBackupChunk'));
const rulesSource = await read('../firestore.rules');
const archiveService = await readFile(new URL('assets/js/modules/settings/archive-account-service.js', root), 'utf8')
    .then(text => text.replace(/\r\n/g, '\n'));

test('T-08: il purge non scrive su inviti, copie condivise né condivisioni di Scadenze', () => {
    for (const identifier of ['invites', 'accountWidgets', 'sharedVaultData', 'sharedVaultLinks',
        'deadlineShares', 'receivedDeadlines', 'sharingState', 'suspendedAt']) {
        assert.equal(purgeSlice.includes(identifier), false,
            `il purge non deve nominare ${identifier}`);
    }
    // Le uniche scritture finali sono: pulizia dei riferimenti, ricevuta e registro.
    assert.match(purgeSlice, /transaction\.set\(operationRef, \{status: "purged"/);
    assert.match(purgeSlice, /action: "account-purged"/);
});

test('T-08: lo stato sospeso dell’invito lo scrive l’archiviazione, non il purge', async () => {
    // Archiviazione (`archiveAccount`) e ripristino (`restoreArchivedAccount`).
    assert.match(archiveService, /sharingState: 'suspended', suspendedAt: now/);
    assert.match(archiveService, /sharingState: 'suspended', suspendedAt\}/);
    // La lettura per il destinatario considera sospeso un invito marcato.
    const repository = await readFile(new URL('assets/js/modules/data/vault-repository.js', root), 'utf8')
        .then(text => text.replace(/\r\n/g, '\n'));
    assert.match(repository, /invite\.sharingState === 'suspended'/);
});

test('T-08: le Rules tengono l’Account archiviato fuori dalla portata del destinatario', () => {
    assert.match(rulesSource, /function isGuestReadableAccount\(\) \{[\s\S]{0,200}isArchived', false\) == false/,
        'un Account archiviato non è leggibile dagli ospiti');
    for (const collection of ['accountWidgets', 'sharedVaultData', 'sharedVaultLinks']) {
        const block = rulesSource.slice(rulesSource.indexOf(`/users/{userId}/${collection}/{`));
        assert.match(block.slice(0, 200), /allow read: if isOwner\(userId\);/,
            `${collection} è in sola lettura per il proprietario`);
        assert.match(block.slice(0, 200), /allow write: if false;/);
    }
});

test('T-08: la condivisione delle Scadenze è un altro percorso', () => {
    // Indice backend in sola amministrazione e copia del destinatario.
    assert.match(rulesSource, /match \/deadlineShares\/\{shareId\} \{\s*\n\s*allow read, write: if false;/);
    assert.match(rulesSource, /match \/users\/\{userId\}\/receivedDeadlines\/\{receivedDeadlineId\} \{[\s\S]{0,120}allow read: if isOwner\(userId\);/);
    // Chi le scrive: le funzioni backend delle Scadenze, non il purge.
    assert.match(indexSource, /async function syncReceivedDeadlines\(/);
    assert.match(indexSource, /async function removeReceivedDeadlines\(/);
    assert.match(indexSource, /batch\.delete\(db\.collection\("users"\)\.doc\(recipientUid\)\.collection\("receivedDeadlines"\)/);
    const syncSlice = indexSource.slice(indexSource.indexOf('async function syncReceivedDeadlines('),
        indexSource.indexOf('async function removeReceivedDeadlines('));
    assert.match(syncSlice, /receivedDeadlineShareRef\(db, ownerUid, deadlineId\)/,
        'la sincronizzazione usa l’indice backend della condivisione');
    assert.match(indexSource, /function receivedDeadlineShareRef\(db, ownerUid, deadlineId\) \{\s*\n\s*return db\.collection\("deadlineShares"\)/);
});

test('T-08: nessun job o percorso di pulizia per copie condivise e inviti', () => {
    // Solo due schedulazioni in Functions: scadenze e retention del registro.
    const schedules = [...indexSource.matchAll(/onSchedule\(/g)].length;
    assert.equal(schedules, 2, 'solo due job pianificati nel backend');
    assert.match(indexSource, /exports\.checkDeadlines = onSchedule\(/);
    assert.match(indexSource, /exports\.purgeExpiredAuditEvents = onSchedule\(/);
    // La retention del registro scansiona solo `auditEvents`.
    assert.match(indexSource, /collectionGroup\("auditEvents"\)/);
    assert.equal(indexSource.includes('collectionGroup("invites")'), false);
});
