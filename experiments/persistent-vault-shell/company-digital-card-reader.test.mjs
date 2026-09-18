import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCompanyDigitalCardReader} from './company-digital-card-reader.mjs';
const text = await readFile(new URL('../../Frontend/public/assets/js/modules/azienda/company-vcard.js', import.meta.url), 'utf8');
const {buildCompanyVCard} = await import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
function fixture({online = true, decrypt} = {}) {
    let uid = 'owner', locked = false;
    const controller = new AbortController(), reads = [], calls = [];
    const record = {ownerId: uid, ragioneSociale: 'enc:Azienda', partitaIva: 'enc:IVA', note: 'enc:NEVER',
        qrConfig: {partitaIva: false, adminEmail: true}, emails: {pec: {email: 'enc:pec@example.invalid', password: 'enc:NEVER'},
            amministrazione: {email: 'enc:admin@example.invalid'}, extra: [{email: 'enc:NEVER', qr: false}]},
        altreSedi: [{indirizzo: 'enc:Strada', citta: 'enc:Citta', pin: 'enc:NEVER'}]};
    const context = {user: {uid}, signal: controller.signal, assertUnlocked() {if (locked) throw Error('LOCKED');},
        async read({ciphertext}) {reads.push(ciphertext); return decrypt ? decrypt(ciphertext) : ciphertext.slice(4);}};
    const source = {domain: 'company', companyId: 'company', async read(requested, confirmed) {
        assert.equal(requested, 'owner'); calls.push(confirmed); return structuredClone(record);
    }};
    return {record, reads, calls, controller, lock() {locked = true;}, change() {uid = 'other';},
        generate: createCompanyDigitalCardReader({context, source, getUser: () => ({uid}), buildVCard: buildCompanyVCard,
            isEncryptedValue: value => value.startsWith('enc:'), isOnline: () => online})};
}
for (const online of [true, false]) test(`company QR projects selected fields only, online=${online}`, async () => {
    const f = fixture({online}), card = await f.generate();
    assert.match(card, /FN:Azienda/); assert.match(card, /admin@example.invalid/); assert.match(card, /Strada/);
    assert.doesNotMatch(card, /NEVER|IVA|enc:/); assert.ok(f.reads.every(value => !value.includes('NEVER') && !value.includes('IVA')));
    assert.deepEqual(f.calls, [online, online]);
});
test('company QR rejects missing saved config, foreign owner and malformed selections', async () => {
    for (const mutate of [f => delete f.record.qrConfig, f => {f.record.ownerId = 'other';},
        f => {f.record.qrConfig.adminEmail = 'true';}, f => {f.record.emails.extra[0].qr = 'false';}]) {
        const f = fixture(); mutate(f); await assert.rejects(f.generate());
    }
});
test('new company phone is neither decoded nor exported until opted in', async () => {
    const f = fixture(); f.record.telefonoAzienda = 'enc:333';
    assert.doesNotMatch(await f.generate(), /333/); assert.ok(!f.reads.includes('enc:333'));
    f.record.qrConfig.telefonoAzienda = true;
    assert.match(await f.generate(), /TEL;TYPE=WORK:333/);
});
for (const boundary of ['lock', 'change', 'abort', 'selection']) test(`company QR refuses late output after ${boundary}`, async () => {
    let release, first = true;
    const f = fixture({decrypt: value => first ? (first = false, new Promise(resolve => {release = resolve;})) : value.slice(4)});
    const pending = f.generate(); await new Promise(setImmediate); const rejected = assert.rejects(pending);
    if (boundary === 'abort') f.controller.abort(); else if (boundary === 'selection') f.record.qrConfig.adminEmail = false; else f[boundary]();
    release('Azienda'); await rejected;
});
