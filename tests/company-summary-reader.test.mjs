import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPdfModule} from './company-summary-loader.mjs';
const {createCompanySummaryReader, COMPANY_SUMMARY_GROUPS} = await loadPdfModule('company-summary-reader');
const all = () => Object.fromEntries(COMPANY_SUMMARY_GROUPS.map(key => [key, true]));
function fixture({decrypt, online = true} = {}) {
    let uid = 'owner', locked = false; const abort = new AbortController(), reads = [], calls = [];
    const record = {ownerId: uid, ragioneSociale: 'enc:Società Fittizia', partitaIva: 'enc:IVA', telefonoAzienda: 'enc:111',
        emails: {pec: {email: 'enc:pec@example.invalid', password: 'enc:SECRET'}}, note: 'enc:SECRET',
        allegati: [{url: 'enc:SECRET'}], altreSedi: [{citta: 'enc:Città'}]};
    const context = {user: {uid}, signal: abort.signal, assertUnlocked() {if (locked) throw Error('LOCKED');},
        async read({ciphertext}) {reads.push(ciphertext); return decrypt ? decrypt(ciphertext) : ciphertext.slice(4);}};
    return {record, abort, reads, calls, lock() {locked = true;}, change() {uid = 'other';},
        read: createCompanySummaryReader({context, getUser: () => ({uid}), isEncryptedValue: value => value.startsWith('enc:'),
            isOnline: () => online, source: {domain: 'company', companyId: 'company', async read(requested, confirmed) {
                assert.equal(requested, 'owner'); calls.push(confirmed); return structuredClone(record);
            }}})};
}
for (const online of [true, false]) test(`PDF projection excludes secret sources, online=${online}`, async () => {
    const f = fixture({online}), result = await f.read(all());
    assert.match(JSON.stringify(result), /Società Fittizia|Città/); assert.doesNotMatch(JSON.stringify(result), /SECRET|password|allegati|enc:/);
    assert.ok(!f.reads.includes('enc:SECRET')); assert.deepEqual(f.calls, [online, online]);
    assert.ok(Object.isFrozen(result.sections[0].rows));
});
test('unchecked groups are never decrypted and empty rows are omitted', async () => {
    const f = fixture(), selected = Object.fromEntries(COMPANY_SUMMARY_GROUPS.map(key => [key, key === 'identity']));
    const result = await f.read(selected); assert.deepEqual(f.reads, ['enc:Società Fittizia']); assert.equal(result.sections.length, 1);
    await assert.rejects(f.read({...selected, arbitrary: true}));
});
for (const boundary of ['lock', 'change', 'abort', 'record']) test(`PDF projection rejects late results after ${boundary}`, async () => {
    let release, first = true; const f = fixture({decrypt: value => first ? (first = false, new Promise(resolve => {release = resolve;})) : value.slice(4)});
    const pending = f.read(all()); await new Promise(setImmediate); const rejected = assert.rejects(pending);
    if (boundary === 'abort') f.abort.abort(); else if (boundary === 'record') f.record.partitaIva = 'enc:CHANGED'; else f[boundary]();
    release('Società'); await rejected;
});
