import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// M7-T08 — Asserzioni di sorgente che completano la misura su Emulator
// (`tests/shared-copies-purge.emulator.test.mjs`): chi scrive lo stato sospeso,
// che cosa il purge rimuove, e perché la condivisione delle Scadenze è un
// percorso separato.
const root = new URL('../Frontend/public/', import.meta.url);
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const indexSource = await read('../functions/index.js');
const purgeSlice = indexSource.slice(indexSource.indexOf('exports.purgeArchivedAccount'),
    indexSource.indexOf('exports.restoreBackupChunk'));
const rulesSource = await read('../firestore.rules');
const archiveService = await readFile(new URL('assets/js/modules/settings/archive-account-service.js', root), 'utf8')
    .then(text => text.replace(/\r\n/g, '\n'));

test('T-08: algoritmo sospeso salvo actor sintetico pianifica e applica la cascata delle copie condivise', () => {
    // Il purge resta bloccato per utenti reali; l'eccezione consente solo il collaudo maturity allowlisted.
    assert.match(purgeSlice, /if \(isArchivePurgeSuspended\(\) && !isMaturityTestActor\(request\.auth\)\)/);
    assert.match(purgeSlice, /ARCHIVE_PURGE_TEMPORARILY_SUSPENDED/);
    for (const identifier of ['deadlineShares', 'receivedDeadlines', 'sharingState', 'suspendedAt']) {
        assert.equal(purgeSlice.includes(identifier), false,
            `il purge non deve nominare ${identifier}`);
    }
    for (const identifier of ['accountWidgets', 'sharedVaultData', 'sharedVaultLinks']) {
        assert.match(purgeSlice, new RegExp(`transaction\\.get\\(userRef\\.collection\\('${identifier}'\\)\\)`),
            `${identifier}: lettura transazionale della cascata`);
    }
    assert.match(purgeSlice, /transaction\.get\(store\.collection\('invites'\)\.where\('ownerId', '==', ownerUid\)\)/);
    assert.match(purgeSlice, /const cascade = planCascadeCleanup\(cascadeSnapshots\)/);
    assert.match(purgeSlice, /for \(const reference of cascade\) transaction\.delete\(reference\)/);
    assert.match(purgeSlice, /ARCHIVE_PURGE_CASCADE_LIMIT/);
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

test('T-08: la cascata è atomica nel purge e non dipende da un job successivo', () => {
    // N1 aggiunge solo la retention dei marcatori; le copie e gli inviti sono
    // eliminati nella transazione finale del purge.
    const schedules = [...indexSource.matchAll(/exports\.(\w+) = onSchedule\(/g)]
        .map(match => match[1]).sort();
    assert.deepEqual(schedules, ['checkDeadlines', 'cleanupInviteRevocationMarkers',
        'purgeExpiredAuditEvents']);
    const markerCleanup = indexSource.slice(indexSource.indexOf('exports.cleanupInviteRevocationMarkers'),
        indexSource.indexOf('function contactMatchesDeadline'));
    assert.match(markerCleanup, /runAcceptanceMarkerCleanup\(/);
    assert.match(markerCleanup, /statePath: "sharingNotificationRetention\/scan"/);
    for (const collection of ['invites', 'accountWidgets', 'sharedVaultData', 'sharedVaultLinks']) {
        assert.equal(markerCleanup.includes(`"${collection}"`), false);
    }
    assert.match(purgeSlice, /for \(const reference of cascade\) transaction\.delete\(reference\)/);
    assert.match(indexSource, /exports\.checkDeadlines = onSchedule\(/);
    assert.match(indexSource, /exports\.purgeExpiredAuditEvents = onSchedule\(/);
    // La retention del registro scansiona solo `auditEvents`.
    assert.match(indexSource, /collectionGroup\("auditEvents"\)/);
    assert.equal(indexSource.includes('collectionGroup("invites")'), false);
});
