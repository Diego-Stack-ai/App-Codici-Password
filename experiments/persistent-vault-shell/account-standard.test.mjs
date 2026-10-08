import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareAccountStandard, validateAccountStandardRequest} from './account-standard-contract.mjs';
import {createAccountStandardHandler} from './account-standard-handler.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => Buffer.alloc(48, value.charCodeAt(0) || 42).toString('base64');
function fixture(company = false) {
    const abort = new AbortController(), state = {uid: 'owner', locked: false};
    const account = company ? {domain: 'company', companyId: 'firm', id: 'same'} : {domain: 'private', id: 'same'};
    const parent = company ? 'users/owner/aziende/firm' : 'users/owner', path = parent + '/accounts/same';
    const source = {id: 'same', ownerId: 'owner', schemaVersion: 1, revision: 7, nomeAccount: cipher('N'), username: cipher('U'), account: cipher('C'), password: cipher('P'), url: 'https://old.invalid',
        note: cipher('Z'), allegati: [{id: 'file'}], banking: [{id: 'bank', cards: [{id: 'card'}]}], referenteNome: cipher('R'), linkedProfileFields: [{type: 'phone', id: 'mobile'}],
        linkedCompanyProfileFields: [{companyId: 'firm', type: 'email', id: 'pec'}], sharedWithUids: [], unknown: {keep: true}};
    const records = new Map([[path, structuredClone(source)], [parent, {id: company ? 'firm' : undefined, ownerId: 'owner'}]]), writes = [];
    const db = {doc: value => value, async runTransaction(run) {const staged = new Map(); const result = await run({
        get: async ref => ({exists: records.has(ref), data: () => structuredClone(records.get(ref))}),
        update(ref, patch) {writes.push(Object.keys(patch)); staged.set(ref, {...records.get(ref), ...structuredClone(patch)});},
        create(ref, value) {staged.set(ref, structuredClone(value));}}); for (const [key, value] of staged) records.set(key, value); return result;}};
    const context = {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {if (state.locked) throw Error('LOCKED');}, encrypt: async value => cipher(value)};
    return {source, account, records, path, writes, abort, state, context, getUser: () => ({uid: state.uid}), hash,
        run: createAccountStandardHandler({db, hash, timestamp: () => 123}), trusted: {auth: {uid: 'owner'}, app: {appId: 'fixture'}}};
}
for (const company of [false, true]) test(`standard editor patches five fields and preserves ${company ? 'company' : 'private'} record`, async () => {
    const f = fixture(company), before = structuredClone(f.source);
    const request = await prepareAccountStandard({...f, changes: {nomeAccount: 'Nuovo', username: '', account: 'Codice', password: 'Segreto', url: ''}, operationId: 'op'});
    assert.deepEqual(Object.keys(request.patch).sort(), ['account', 'nomeAccount', 'password', 'url', 'username']);
    assert.doesNotMatch(JSON.stringify(request), /Nuovo|Codice|Segreto|linkedProfileFields|banking|note/);
    assert.deepEqual(await f.run(request, f.trusted), {status: 'confirmed', revision: 8});
    const saved = f.records.get(f.path); for (const key of Object.keys(before)) if (!['nomeAccount','username','account','password','url','revision'].includes(key)) assert.deepEqual(saved[key], before[key]);
    assert.deepEqual(f.writes[0].sort(), ['account','nomeAccount','password','revision','schemaVersion','updatedAt','url','username']);
    await f.run(request, f.trusted); assert.equal(saved.revision, 8);
});
test('concurrency, malformed relations and wrong company fail without partial writes', async () => {
    for (const mutate of [f => f.records.get(f.path).revision++, f => f.records.get(f.path).username = cipher('X'), f => f.records.get(f.path).linkedProfileFields = 'bad', f => f.records.get('users/owner/aziende/firm').ownerId = 'other']) {
        const f = fixture(true), request = await prepareAccountStandard({...f, changes: {username: 'next'}, operationId: 'op'}); mutate(f); const before = structuredClone([...f.records]);
        await assert.rejects(f.run(request, f.trusted)); assert.deepEqual([...f.records], before); assert.equal(f.writes.length, 0);
    }
});
test('wire and preparation reject plaintext, foreign lifecycle, invalid URL and extra keys', async () => {
    const f = fixture(), request = await prepareAccountStandard({...f, changes: {password: ''}, operationId: 'op'});
    assert.throws(() => validateAccountStandardRequest({...request, patch: {password: 'plaintext'}}));
    assert.throws(() => validateAccountStandardRequest({...request, patch: {...request.patch, note: ''}}));
    await assert.rejects(prepareAccountStandard({...f, changes: {url: 'javascript:alert(1)'}, operationId: 'x'}));
    f.state.uid = 'other'; await assert.rejects(prepareAccountStandard({...f, changes: {username: 'x'}, operationId: 'x'}));
});
test('late encryption is revoked and request snapshots changes', async () => {
    const f = fixture(), changes = {username: 'before'};
    f.context.encrypt = async value => {changes.username = 'after'; return cipher(value);};
    const request = await prepareAccountStandard({...f, changes, operationId: 'op'}); assert.equal(request.patch.username, cipher('before'));
    const g = fixture(); g.context.encrypt = async value => {g.abort.abort(); return cipher(value);};
    await assert.rejects(prepareAccountStandard({...g, changes: {username: 'x'}, operationId: 'op'}), /VIEW_DISPOSED/);
});
