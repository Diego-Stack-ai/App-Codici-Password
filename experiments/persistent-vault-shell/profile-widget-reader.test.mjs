import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createProfileWidgetReader} from './profile-widget-reader.mjs';
const model = await readFile(new URL('../../Frontend/public/assets/js/modules/privato/profile-model.js', import.meta.url), 'utf8');
const {validateProfileWidget} = await import('data:text/javascript;base64,' + Buffer.from(model).toString('base64'));
function fixture({online = true, decrypt} = {}) {
    let uid = 'owner', locked = false; const controller = new AbortController(), reads = [], calls = [];
    const rows = [{id: 'widget', title: 'Titolo', tab: 'personal', size: 'medium', order: 1, collapsed: true,
        fields: [{id: 'secret', type: 'sensitive', label: 'PIN', encrypted: true, valueEnc: 'enc:1234', order: 2, copyable: true},
            {id: 'plain', label: 'Testo', encrypted: false, value: 'Testo privato', order: 0, preview: false, copyable: true}]}];
    const context = {user: {uid}, signal: controller.signal, assertUnlocked() {if(locked)throw new Error('LOCKED');},
        read: async ({ciphertext}) => {reads.push(ciphertext);return decrypt ? decrypt(ciphertext) : ciphertext.slice(4);}};
    const reader = createProfileWidgetReader({context, getUser: () => ({uid}), tab: 'personal', validateProfileWidget, isOnline: () => online,
        repository: {listProfileWidgets: async requested => {assert.equal(requested, 'owner');calls.push('cache');return rows;},
            listProfileWidgetsConfirmed: async requested => {assert.equal(requested, 'owner');calls.push('server');return rows;}}});
    return {reader, rows, reads, calls, controller, change: () => {uid = 'other';}, lock: () => {locked = true;}};
}
for (const online of [true, false]) test(`metadata preserves tab/order/collapse/preview without exposing values ${online}`, async () => {
    const f = fixture({online}); f.rows.push({...structuredClone(f.rows[0]), id: 'other', tab: 'contacts'});
    const rows = await f.reader.list(); assert.equal(rows.length, 1); assert.equal(rows[0].collapsed, true);
    assert.deepEqual(rows[0].fields.map(field => field.id), ['plain', 'secret']); assert.equal(rows[0].fields[0].preview, false);
    assert.equal(rows[0].fields[1].copyable, false); assert.ok(!JSON.stringify(rows).includes('1234')); assert.deepEqual(f.reads, []);
    assert.equal(await f.reader.read('widget', 'secret', {expectedEncrypted: true}), '1234');
    assert.ok(f.calls.every(call => call === (online ? 'server' : 'cache')));
});
test('copy classification is checked against the current field', async () => {
    const f = fixture(); await assert.rejects(f.reader.read('widget', 'secret', {copy: true}), /COPY_FORBIDDEN/);
    assert.equal(await f.reader.read('widget', 'plain', {copy: true, expectedEncrypted: false}), 'Testo privato');
    f.rows[0].fields[1].copyable = false; await assert.rejects(f.reader.read('widget', 'plain', {copy: true}), /COPY_FORBIDDEN/);
    await assert.rejects(f.reader.read('widget', 'secret', {expectedEncrypted: false}), /CHANGED/);
});
for (const boundary of ['change', 'lock', 'abort', 'move', 'edit', 'delete']) test(`pending field read is rejected after ${boundary}`, async () => {
    let release; const f = fixture({decrypt: () => new Promise(resolve => {release = resolve;})});
    const pending = f.reader.read('widget', 'secret'); await new Promise(setImmediate); const rejected = assert.rejects(pending);
    if (boundary === 'abort') f.controller.abort();
    else if (boundary === 'move') f.rows[0].tab = 'contacts';
    else if (boundary === 'edit') f.rows[0].fields[0].valueEnc = 'enc:changed';
    else if (boundary === 'delete') f.rows.length = 0;
    else f[boundary](); release('late'); await rejected;
});
test('ambiguous, unowned, malformed or secret plaintext Widgets are not consulted', async () => {
    for (const change of [f => f.rows.push(structuredClone(f.rows[0])), f => {f.rows[0].ownerId = 'other';},
        f => {f.rows[0].companyId = 'company';}, f => {f.rows[0].fields[0].encrypted = false;},
        f => {delete f.rows[0].fields[0].valueEnc;}, f => {f.rows[0].fields.push(structuredClone(f.rows[0].fields[0]));}]) {
        const f = fixture(); change(f); await assert.rejects(f.reader.list()); assert.deepEqual(f.reads, []);
    }
    await assert.rejects(fixture({decrypt: () => '--ERRORE--'}).reader.read('widget', 'secret'));
});
