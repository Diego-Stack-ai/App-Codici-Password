import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBankingReader} from './banking-reader.mjs';
const source = await readFile(new URL('../../Frontend/public/assets/js/modules/shared/banking-model.js', import.meta.url), 'utf8');
const {normalizeEditableBankingAccounts: normalize} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function fixture(online = true, companyId) {
    const abort = new AbortController(), calls = [], decrypted = []; let uid = 'owner', locked = false;
    const state = {record: {ownerId: uid, banking: [{bankId: 'first', iban: 'enc:IBAN1', numeroVerde: '800000000', cards: [{cardType: 'Carta', pin: 'enc:1234', ccv: 'enc:567', cardNumber: 'enc:NUMBER'}]}, {bankId: 'second', iban: 'enc:IBAN2', cards: []}]}};
    const repository = {};
    for (const name of ['getPrivateAccount', 'getCompanyAccount']) for (const suffix of ['', 'Confirmed']) {
        repository[name + suffix] = async (...args) => {calls.push([name + suffix, ...args]); return state.record;};
    }
    const context = {user: {uid}, signal: abort.signal, assertUnlocked() {if (locked) throw Error('VAULT_LOCKED');},
        async read({ownerId, ciphertext}) {assert.equal(ownerId, 'owner'); decrypted.push(ciphertext); return ciphertext.slice(4);}};
    const options = {context, getUser: () => ({uid}), repository, normalize, isEncryptedValue: value => value.startsWith('enc:'), isOnline: () => online,
        selection: {domain: companyId ? 'company' : 'private', id: 'account', ...(companyId ? {companyId} : {})}};
    return {state, repository, calls, decrypted, options, context, abort, list: createBankingReader(options), lock() {locked = true;}, change() {uid = 'other';}};
}
for (const online of [true, false]) test(`bank and card capabilities read ${online ? 'server' : 'cache'} without exposing records or changing IDs`, async () => {
    const f = fixture(online, 'company'), before = JSON.stringify(f.state.record), banks = await f.list();
    assert.equal(banks.length, 2); assert.equal(f.decrypted.length, 0);
    assert.ok(!/enc:|IBAN1|1234/.test(JSON.stringify(banks)));
    assert.equal(await banks[0].read('iban'), 'IBAN1');
    assert.equal(await banks[0].read('numeroVerde'), '800000000');
    assert.equal(await banks[0].cards[0].read('pin'), '1234');
    assert.equal(await banks[1].read('iban'), 'IBAN2');
    assert.ok(f.calls.every(([name, uid, company, id]) => name.endsWith('Confirmed') === online && uid === 'owner' && company === 'company' && id === 'account'));
    assert.equal(JSON.stringify(f.state.record), before);
});
test('legacy canonical normalizer is read-only and does not create bank IDs', async () => {
    const f = fixture(); f.state.record = {ownerId: 'owner', iban: 'enc:OLD', cards: [{pin: 'enc:0000'}]};
    const banks = await f.list(); assert.equal(banks[0].bankId, null);
    assert.equal(await banks[0].read('iban'), 'OLD'); assert.equal(await banks[0].cards[0].read('pin'), '0000');
    assert.equal(f.state.record.bankId, undefined); assert.equal(f.state.record.banking, undefined);
    f.state.record = {ownerId: 'owner', referenteNome: 'General contact'}; assert.deepEqual(await f.list(), []);
});
test('reordering identified banks preserves identity while reordering cards rejects stale readers', async () => {
    const f = fixture(), banks = await f.list(); f.state.record.banking.reverse();
    assert.equal(await banks[0].read('iban'), 'IBAN1');
    f.state.record.banking[1].cards.unshift({pin: 'enc:OTHER'});
    await assert.rejects(banks[0].cards[0].read('pin'), /BANKING_CHANGED/);
});
for (const boundary of ['abort', 'lock', 'change']) test(`pending bank secret is discarded on ${boundary}`, async () => {
    const f = fixture(), banks = await f.list(); let release;
    f.context.read = () => new Promise(resolve => {release = resolve;});
    const pending = banks[0].cards[0].read('pin'), rejected = assert.rejects(pending, /VIEW_DISPOSED|VAULT_LOCKED|AUTH_CHANGED/);
    while (!release) await new Promise(resolve => setImmediate(resolve));
    if (boundary === 'abort') f.abort.abort(); else f[boundary](); release('late'); await rejected;
});
for (const mutation of ['remove', 'edit', 'archive', 'owner']) test(`bank ${mutation} during decryption prevents old value from escaping`, async () => {
    const f = fixture(), banks = await f.list();
    f.context.read = async () => {
        if (mutation === 'remove') f.state.record.banking.shift();
        if (mutation === 'edit') f.state.record.banking[0].cards[0].pin = 'enc:NEW';
        if (mutation === 'archive') f.state.record.isArchived = true;
        if (mutation === 'owner') f.state.record.ownerId = 'other';
        return 'late';
    };
    await assert.rejects(banks[0].cards[0].read('pin'), /BANKING_CHANGED|BANKING_UNAVAILABLE/);
});
test('duplicates, malformed values and unsupported fields fail closed', async () => {
    for (const modify of [f => f.state.record.banking.push(f.state.record.banking[0]), f => {f.state.record.banking[0].iban = {};},
        f => {f.state.record.banking[0].cards = {};}, f => {f.state.record.banking[0].cards = [null];}]) {
        const f = fixture(); modify(f); await assert.rejects(f.list());
    }
    const f = fixture(), banks = await f.list();
    await assert.rejects(banks[0].read('ownerId')); await assert.rejects(banks[0].cards[0].read('constructor'));
});
test('permission or decrypt errors cannot use cache/plaintext fallback', async () => {
    const f = fixture(); f.repository.getPrivateAccountConfirmed = async () => {throw Error('permission-denied');};
    await assert.rejects(f.list(), /permission-denied/); assert.equal(f.calls.length, 0);
    for (const value of [null, '--ERRORE--', 'enc:IBAN1']) {
        const g = fixture(), banks = await g.list(); g.context.read = async () => value;
        await assert.rejects(banks[0].read('iban'));
    }
});
