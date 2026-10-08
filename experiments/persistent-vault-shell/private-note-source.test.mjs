import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateNoteSourceReader} from './private-note-source.mjs';
const metadata = {fromCache: false, hasPendingWrites: false};
const snap = (id, value) => ({id, metadata, exists: () => value !== undefined, data: () => value});
function fixture({record = {ownerId: 'owner'}, profile = {}, companies = [], ...overrides} = {}) {
    let uid = 'owner'; const controller = new AbortController();
    const reader = createPrivateNoteSourceReader({getUser: () => ({uid}), readAccount: async () => snap('record', record),
        readProfile: async () => snap('owner', profile),
        readCompanies: async () => ({metadata, docs: companies.map((value, i) => snap(String(i), value))}), ...overrides});
    return {controller, change: () => { uid = 'other'; }, read: () => reader({uid: 'owner', recordId: 'record', signal: controller.signal})};
}
test('complete server snapshots establish scope without changing or migrating the record', async () => {
    const record = {ownerId: 'owner', note: 'ciphertext'};
    assert.deepEqual(await fixture({record}).read(), {source: {...record, id: 'record'}, hasProfileLink: false});
    assert.equal(record.id, undefined);
});
test('private and company reverse links, including hidden contacts, block the candidate', async () => {
    const link = {linkedAccountId: 'record', hidden: true};
    for (const options of [{profile: {contactEmails: [link]}}, {profile: {contactPhones: [link]}},
        {profile: {documenti: [link]}}, {profile: {userAddresses: [{utilities: [link]}]}},
        {companies: [{emails: {extra: [link]}}]}, {companies: [{phoneAccountLinks: {telefonoAzienda: link}}]}]) {
        await assert.rejects(fixture(options).read(), /SCOPE_UNSUPPORTED/);
    }
});
test('missing documents, cache, pending writes and truncated company lists are not negative evidence', async () => {
    for (const options of [{readProfile: async () => snap('owner')},
        {readAccount: async () => ({...snap('record', {ownerId: 'owner'}), metadata: {...metadata, fromCache: true}})},
        {readCompanies: async () => ({metadata: {...metadata, hasPendingWrites: true}, docs: []})},
        {companies: Array.from({length: 201}, () => ({}))}, {record: {ownerId: 'other'}}, {record: {id: 'legacy-alias', ownerId: 'owner'}}]) {
        await assert.rejects(fixture(options).read());
    }
});
for (const boundary of ['abort', 'identity']) test(`late server snapshots cannot cross ${boundary}`, async () => {
    let release; const gate = new Promise(resolve => { release = resolve; });
    const f = fixture({readProfile: () => gate}); const reading = f.read();
    if (boundary === 'abort') f.controller.abort(); else f.change();
    release(snap('owner', {})); await assert.rejects(reading, /INACTIVE/);
});
