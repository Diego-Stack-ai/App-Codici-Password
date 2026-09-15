import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createProfileLinkEditorSource} from './profile-link-editor-source.mjs';
const models = {};
for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js']) {
    Object.assign(models, await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
}
function fixture(company = false) {
    const abort = new AbortController(), reads = [];
    const state = {uid: 'owner', online: true, hook: null, profile: company
        ? {ownerId: 'owner', id: 'firm', emails: {pec: {email: 'cipher', password: 'secret', linkedAccountId: 'old'}}}
        : {ownerId: 'owner', contactPhones: [{id: 'mobile', number: 'cipher', linkedAccountId: 'old'}]}};
    const source = company ? {domain: 'company', companyId: 'firm', type: 'email', id: 'pec'} : {domain: 'private', type: 'phone', id: 'mobile'};
    const editor = createProfileLinkEditorSource({context: {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {}, read() {throw Error('UNEXPECTED_DECRYPT');}},
        getUser: () => ({uid: state.uid}), source, models, isOnline: () => state.online,
        hash: value => createHash('sha256').update(value).digest('hex'),
        readProfile: async query => {reads.push(query); await state.hook?.(); return structuredClone(state.profile);}});
    return {editor, state, abort, reads, source};
}
for (const company of [false, true]) test(`link source ${company ? 'company' : 'private'} captures immutable request without plaintext`, async () => {
    const f = fixture(company), loaded = await f.editor.load();
    assert.deepEqual(loaded.account, {domain: 'private', id: 'old'});
    const target = {domain: 'company', companyId: 'other', id: 'next'};
    const request = await f.editor.prepare(target, 'op'); target.id = 'changed';
    assert.equal(request.account.id, 'next'); assert.equal(request.expectedRevision, 0);
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.account));
    assert.ok(!JSON.stringify(request).includes('secret') && !JSON.stringify(request).includes('cipher'));
    assert.ok(f.reads.every(query => query.uid === 'owner' && query.confirmed));
    assert.equal((await f.editor.prepare(null, 'unlink')).account, null);
    f.editor.dispose(); await assert.rejects(f.editor.load(), /VIEW_DISPOSED/);
});
test('offline can inspect relationship but cannot prepare a write', async () => {
    const f = fixture(); f.state.online = false;
    assert.equal((await f.editor.load()).canSave, false);
    assert.ok(f.reads.every(query => !query.confirmed));
    await assert.rejects(f.editor.prepare(null, 'op'), /SAVE_UNAVAILABLE/);
    f.state.online = true; await f.editor.load();
    f.state.hook = () => {f.state.online = false;};
    await assert.rejects(f.editor.prepare(null, 'op'), /SAVE_UNAVAILABLE/);
});
test('legacy edits without revision and changed revisions invalidate preparation', async () => {
    for (const mutate of [p => {p.contactPhones[0].number = 'new';}, p => {p._profileLinkRevision = 1;}, p => {p.contactPhones[0].linkedAccountId = 'new';}]) {
        const f = fixture(); await f.editor.load(); mutate(f.state.profile);
        await assert.rejects(f.editor.prepare(null, 'op'), /PROFILE_LINK_CHANGED/);
    }
});
test('owner alias, authentication change and abort fail closed', async () => {
    const f = fixture(true); f.state.profile.id = 'wrong';
    await assert.rejects(f.editor.load(), /OWNER_MISMATCH/);
    for (const revoke of [f => {f.state.uid = 'other';}, f => f.abort.abort()]) {
        const g = fixture(); await g.editor.load(); g.state.hook = () => revoke(g);
        await assert.rejects(g.editor.prepare(null, 'op'), /VIEW_DISPOSED/);
    }
});
test('overlapping loads invalidate previous work; incomplete load cannot prepare', async () => {
    const f = fixture(); let release;
    f.state.hook = () => new Promise(resolve => {release = resolve;});
    const first = f.editor.load(); await Promise.resolve();
    await assert.rejects(f.editor.prepare(null, 'op'), /SAVE_UNAVAILABLE/);
    f.state.hook = null; await f.editor.load(); release();
    await assert.rejects(first, /PROFILE_LINK_CHANGED/);
    assert.equal((await f.editor.prepare(null, 'op')).operationId, 'op');
});
