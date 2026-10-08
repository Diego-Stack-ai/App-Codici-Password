import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createProfileOverviewReader} from './profile-overview-reader.mjs';
const model = await readFile(new URL('../../Frontend/public/assets/js/modules/privato/profile-model.js', import.meta.url), 'utf8');
const {buildProfileOverview, resolvePrimary} = await import('data:text/javascript;base64,' + Buffer.from(model).toString('base64'));
function fixture(record, {company = false, online = true, decrypt} = {}) {
    let uid = 'owner', locked = false; const controller = new AbortController(), reads = [], calls = [];
    const context = {user: {uid}, signal: controller.signal, assertUnlocked() {if (locked) throw new Error('LOCKED');},
        read: async ({ciphertext}) => {reads.push(ciphertext); return decrypt ? decrypt(ciphertext) : ciphertext.slice(4);}};
    const repository = {getUserProfile: async () => {calls.push('cache'); return record;}, getUserProfileConfirmed: async () => {calls.push('server'); return record;}};
    return {reads, calls, controller, change: () => {uid = 'other';}, lock: () => {locked = true;}, read: createProfileOverviewReader({context,
        getUser: () => ({uid}), repository, isOnline: () => online, buildProfileOverview, resolvePrimary, isEncryptedValue: value => value.startsWith('enc:'), now: () => new Date('2026-09-15T12:00:00Z'),
        source: company ? {domain: 'company', read: async (requested, confirmed) => {assert.equal(requested, 'owner'); calls.push(confirmed ? 'server' : 'cache'); return record;}, normalize: value => value} : undefined})};
}
test('canonical primaries and fiscal/expiry model use only allowlisted fields', async () => {
    const f = fixture({nome: 'enc:Nome', cognome: 'enc:Cognome', password: 'enc:NO', note: 'enc:NO',
        contactEmails: [{address: 'enc:UNSELECTED'}, {address: 'enc:primary@example.invalid', isPrimary: true, password: 'enc:NO'}],
        contactPhones: [{number: '000', pin: 'enc:NO'}], userAddresses: [{address: 'Via', civic: '1', city: 'Citta', photo: 'enc:NO'}],
        documenti: [{type: 'Patente', expiry_date: 'enc:2026-10-01', num_serie: 'enc:UNNEEDED'}, {type: 'Codice fiscale', cf_value: 'enc:CF', url: 'enc:NO'}]});
    const rows = await f.read();
    assert.equal(rows[0].value, 'Nome Cognome'); assert.equal(rows[1].value, 'CF'); assert.equal(rows[2].value, 'primary@example.invalid');
    assert.ok(rows.some(row => row.value === '2026-10-01' && row.target === 'documents'));
    assert.deepEqual(f.reads, ['enc:Nome', 'enc:Cognome', 'enc:primary@example.invalid', 'enc:2026-10-01', 'enc:CF']);
    assert.deepEqual(f.calls, ['server']); assert.ok(Object.isFrozen(rows));
});
for (const online of [true, false]) test(`company summary counts documents without opening attachments ${online}`, async () => {
    const f = fixture({ragioneSociale: 'enc:Azienda', partitaIva: 'enc:IVA', contactEmails: [{address: 'pec'}], userAddresses: [{address: 'Sede'}], documenti: [{name: 'enc:NO', url: 'enc:NO'}]}, {company: true, online});
    const rows = await f.read(); assert.equal(rows[0].value, 'Azienda'); assert.equal(rows.at(-1).value, '1');
    assert.deepEqual(f.reads, ['enc:Azienda', 'enc:IVA']); assert.deepEqual(f.calls, [online ? 'server' : 'cache']);
});
test('empty, malformed and unowned records never return invented data or decryption fallback', async () => {
    assert.equal((await fixture({}).read())[0].value, 'Non indicato');
    for (const record of [null, {isArchived: true}, {ownerId: 'other'}, {contactEmails: {}}, {documenti: [null]}]) await assert.rejects(fixture(record).read());
    await assert.rejects(fixture({nome: 'enc:broken'}, {decrypt: () => '--ERRORE--'}).read(), /PROFILE_VALUE_INVALID/);
});
for (const boundary of ['lock', 'change', 'abort']) test(`overview decryption cannot outlive ${boundary}`, async () => {
    let release; const f = fixture({nome: 'enc:late'}, {decrypt: () => new Promise(resolve => {release = resolve;})});
    const pending = f.read(); await new Promise(setImmediate);
    const rejected = assert.rejects(pending, /LOCKED|AUTH_CHANGED|VIEW_DISPOSED/);
    if (boundary === 'abort') f.controller.abort(); else f[boundary]();
    release('secret'); await rejected;
});
