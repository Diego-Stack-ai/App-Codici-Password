import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPrivateDigitalCardReader} from './private-digital-card-reader.mjs';
const source = await readFile(new URL('../../Frontend/public/assets/js/modules/shared/qr_code_utils-v2.js', import.meta.url), 'utf8');
const {buildVCard} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
function fixture({online = true, decrypt} = {}) {
    let uid = 'owner', locked = false; const controller = new AbortController(), reads = [], calls = [];
    const state = {profile: {nome: 'enc:Nome', cognome: 'enc:Cognome', note: 'enc:NEVER', password: 'enc:NEVER',
        photoURL: 'https://example.invalid/photo.jpg', contactEmails: [{id: 'e', address: 'enc:mail@example.invalid', password: 'enc:NEVER'}, {id: 'unused', address: 'enc:UNSELECTED'}],
        contactPhones: [{id: 'p', number: 'enc:000'}], userAddresses: [{id: 'a', address: 'enc:Via', civic: '1', city: 'Citta', cap: '00000'}]},
        config: {nome: true, phones: [0], emails: ['e'], addresses: ['a']},
        widgets: [{fields: [{id: 's', type: 'sensitive', encrypted: true, valueEnc: 'enc:NEVER', includeInQr: true},
            {id: 'p', label: 'Ruolo', type: 'text', value: 'Tecnico', encrypted: false, includeInQr: true}]}]};
    const repository = {};
    for (const suffix of ['', 'Confirmed']) for (const [method, key] of [['getUserProfile', 'profile'], ['getUserSetting', 'config'], ['listProfileWidgets', 'widgets']]) {
        repository[method + suffix] = async (requested, setting) => {assert.equal(requested, 'owner'); if (key === 'config') assert.equal(setting, 'qrCodeInclusions'); calls.push(suffix); return state[key];};
    }
    const context = {user: {uid}, signal: controller.signal, assertUnlocked() {if (locked) throw new Error('LOCKED');},
        read: async ({ciphertext}) => {reads.push(ciphertext); return decrypt ? decrypt(ciphertext) : ciphertext.slice(4);}};
    return {state, reads, calls, controller, change: () => {uid = 'other';}, lock: () => {locked = true;}, generate: createPrivateDigitalCardReader({context,
        getUser: () => ({uid}), repository, isEncryptedValue: value => value.startsWith('enc:'), buildVCard, isOnline: () => online})};
}
for (const online of [true, false]) test(`only selected contact data reaches canonical vCard ${online}`, async () => {
    const f = fixture({online}), card = await f.generate();
    assert.match(card, /FN:Nome Cognome/); assert.match(card, /TEL:000/); assert.match(card, /EMAIL:mail@example.invalid/);
    assert.match(card, /NOTE:Ruolo: Tecnico/); assert.doesNotMatch(card, /PHOTO|NEVER|UNSELECTED|enc:/);
    assert.ok(f.reads.every(value => !value.includes('NEVER') && !value.includes('UNSELECTED')));
    assert.ok(f.calls.every(suffix => suffix === (online ? 'Confirmed' : '')));
});
test('photo URL is included only by saved opt-in without fetching its bytes', async () => {
    const f = fixture(); f.state.config.photo = true;
    assert.match(await f.generate(), /PHOTO;VALUE=URI:https:\/\/example.invalid/);
    f.state.profile.photoURL = 'https://user:secret@example.invalid/photo'; await assert.rejects(f.generate());
});
test('ambiguous/missing selections, owner changes and malformed configuration fail closed', async () => {
    for (const mutate of [f => {f.state.config = null;}, f => {f.state.profile.ownerId = 'other';},
        f => {f.state.config.nome = 'true';}, f => {f.state.config.emails = ['missing'];},
        f => {f.state.profile.contactEmails.push({...f.state.profile.contactEmails[0]});}]) {
        const f = fixture(); mutate(f); await assert.rejects(f.generate());
    }
});
for (const boundary of ['lock', 'change', 'abort', 'selection']) test(`generation rejects late output after ${boundary}`, async () => {
    let release, first = true;
    const f = fixture({decrypt: value => first ? (first = false, new Promise(resolve => {release = resolve;})) : value.slice(4)});
    const pending = f.generate(); await new Promise(setImmediate); const rejected = assert.rejects(pending);
    if (boundary === 'abort') f.controller.abort(); else if (boundary === 'selection') f.state.config.emails = []; else f[boundary]();
    release('Nome'); await rejected;
});
test('a plaintext classification cannot force ciphertext or secret Widget values into the QR', async () => {
    const f = fixture(); f.state.widgets[0].fields = [{type: 'puk', encrypted: false, includeInQr: true, value: 'NEVER'}];
    assert.doesNotMatch(await f.generate(), /NEVER/);
    f.state.widgets[0].fields = [{type: 'text', encrypted: false, includeInQr: true, value: 'enc:NEVER'}];
    await assert.rejects(f.generate());
});
