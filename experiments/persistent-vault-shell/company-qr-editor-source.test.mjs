import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanyQrEditorSource} from './company-qr-editor-source.mjs';
import {createCompanyQrRequest} from './company-qr-editor-provider.mjs';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';

function fixture() {
    const state = {uid: 'owner', online: true, locked: false, reads: [], record: {ownerId: 'owner',
        qrConfig: {ragioneSociale: true}, ragioneSociale: 'enc:SECRET', emails: {pec: {password: 'enc:SECRET'}}}};
    const abort = new AbortController(), context = {user: {uid: 'owner'}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');}, read() {throw Error('UNEXPECTED_DECRYPT');}};
    const source = {domain: 'company', companyId: 'company', async read(uid, confirmed) {
        state.reads.push({uid, confirmed}); return structuredClone(state.record);
    }};
    const options = {context, source, getUser: () => ({uid: state.uid}), isOnline: () => state.online};
    return {state, abort, context, source, options, editor: createCompanyQrEditorSource(options)};
}
test('company editor projects fourteen labels without reading secrets and prepares strict company payload', async () => {
    const f = fixture(), view = await f.editor.load();
    assert.equal(view.choices.length, 14); assert.doesNotMatch(JSON.stringify(view), /SECRET|password|ownerId/);
    assert.equal(view.selection.telefonoAzienda, false);
    const prepared = await f.editor.prepare({...view.selection, telefonoAzienda: true});
    const request = createCompanyQrRequest(prepared, 'op');
    assert.deepEqual(Object.keys(request).sort(), ['companyId', 'expectedConfig', 'operationId', 'selection']);
    assert.equal(request.companyId, 'company'); assert.equal(request.selection.telefonoAzienda, true);
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.selection) && Object.isFrozen(request.expectedConfig));
    assert.ok(f.state.reads.every(value => value.uid === 'owner' && value.confirmed));
    assert.equal(f.state.record.qrConfig.telefonoAzienda, undefined); f.editor.dispose();
});
test('offline editor can consult cached selection but never prepare a save', async () => {
    const f = fixture(); f.state.online = false; const view = await f.editor.load();
    assert.equal(f.state.reads[0].confirmed, false);
    await assert.rejects(f.editor.prepare(view.selection)); assert.equal(f.state.reads.length, 1); f.editor.dispose();
});
test('changed selection and missing/archived/foreign company invalidate preparation', async () => {
    for (const mutate of [f => {f.state.record.qrConfig.ragioneSociale = false;}, f => {f.state.record = null;},
        f => {f.state.record.isArchived = true;}, f => {f.state.record.ownerId = 'other';}, f => {f.source.companyId = 'other';}]) {
        const f = fixture(), view = await f.editor.load(); mutate(f);
        await assert.rejects(f.editor.prepare(view.selection)); f.editor.dispose();
    }
});
for (const boundary of ['uid', 'locked', 'abort']) test(`late company read cannot release choices after ${boundary}`, async () => {
    const f = fixture(); let release; f.source.read = () => new Promise(resolve => {release = resolve;});
    const pending = f.editor.load(), rejected = assert.rejects(pending);
    if (boundary === 'abort') f.abort.abort(); else f.state[boundary] = boundary === 'uid' ? 'other' : true;
    release(f.state.record); await rejected; f.editor.dispose();
});
test('company retry keeps the exact payload and omits private arrays and revision transport field', async () => {
    const f = fixture(), view = await f.editor.load(), sent = []; let first = true;
    const controller = createQrSelectionSaveController({...f.options, prepare: value => f.editor.prepare(value),
        createRequest: createCompanyQrRequest, createOperationId: () => 'same-company-op',
        submit: async request => {sent.push(request); if (first) {first = false; throw Error('RESPONSE_LOST');}
            return {status: 'confirmed', revision: 1};}});
    assert.equal((await controller.save(view.selection)).status, 'unknown');
    assert.equal((await controller.retry()).status, 'saved'); assert.equal(sent[0], sent[1]);
    assert.equal(sent[0].expectedRevision, undefined); assert.equal(sent[0].selection.phones, undefined);
    assert.throws(() => createCompanyQrRequest({companyId: 'company', selection: view.selection, expectedConfig: null, expectedRevision: 5}, 'id'), /REVISION_INVALID/);
    controller.dispose(); f.editor.dispose();
});
