import test from 'node:test';
import assert from 'node:assert/strict';
import {createExcelExportProjection, EXCEL_MASK} from './excel-export-projection.mjs';

function fixture() {
    const abort = new AbortController(); let uid = 'owner', locked = false;
    const reads = [];
    const records = [
        {scope: 'private-account', id: 'account', data: {ownerId: uid, nomeAccount: 'enc:Account', password: 'enc:password', simPin: '2076', puk: '99887766', note: 'enc:Nota'}},
        {scope: 'private-account-widget', id: 'widget', accountId: 'account', data: {fields: [
            {id: 'f', label: 'SIM', encrypted: true, valueEnc: 'enc:widget-secret'},
            {id: 'g', label: 'Other', encrypted: false, value: 0}
        ]}},
        {scope: 'shared-vault-data', id: 'shared', data: {fields: [{id: 'q', encrypted: true, valueEnc: 'enc:common-secret'}]}}
    ];
    const context = {user: {uid}, signal: abort.signal, assertUnlocked() {if (locked) throw Error('VAULT_LOCKED');},
        async read({ownerId, ciphertext}) {assert.equal(ownerId, 'owner'); reads.push(ciphertext); return ciphertext.slice(4);}};
    const options = {context, getUser: () => ({uid}), collectRecords: async () => records, isEncryptedValue: v => v.startsWith('enc:')};
    return {abort, reads, records, context, options, project: createExcelExportProjection(options), lock() {locked = true;}, change() {uid = 'other';}};
}

test('masked projection suppresses PUK, camel-case PIN and encrypted widget/common values before decryption', async () => {
    const f = fixture(), before = JSON.stringify(f.records), rows = await f.project();
    for (const key of ['password', 'simPin', 'puk']) assert.equal(rows[0].data[key], EXCEL_MASK);
    assert.equal(rows[1].data.fields[0].valueEnc, EXCEL_MASK);
    assert.equal(rows[2].data.fields[0].valueEnc, EXCEL_MASK);
    assert.deepEqual(f.reads, ['enc:Account', 'enc:Nota']);
    assert.equal(rows[1].data.fields[1].value, 0);
    assert.equal(JSON.stringify(f.records), before);
    assert.ok(!/99887766|2076|widget-secret|common-secret/.test(JSON.stringify(rows)));
});

test('full projection requires a boolean choice and uses only the live RAM capability', async () => {
    const f = fixture();
    const rows = await f.project({includeSecrets: true});
    assert.equal(rows[0].data.password, 'password');
    assert.equal(rows[1].data.fields[0].valueEnc, 'widget-secret');
    assert.equal(rows[2].data.fields[0].valueEnc, 'common-secret');
    for (const includeSecrets of ['false', 'true', 1, null]) await assert.rejects(f.project({includeSecrets}), /CONSENT/);
});

for (const mode of [false, true]) test(`keys, settings, photo and attachment references are excluded even in full=${mode}`, async () => {
    const f = fixture();
    Object.assign(f.records[0].data, {vaultKey: 'never', masterPassword: 'never', fileKey: 'never', verifier: 'never', foto: 'never', storagePath: 'never', allegati: [{name: 'never'}]});
    f.records.push({scope: 'settings', id: 'keys', data: {value: 'never'}}, {scope: 'private-account-attachment', id: 'file', data: {url: 'never'}});
    assert.ok(!JSON.stringify(await f.project({includeSecrets: mode})).includes('never'));
});

for (const boundary of ['abort', 'lock', 'change']) test(`no projection escapes after ${boundary} during decryption`, async () => {
    const f = fixture(); let release;
    f.context.read = () => new Promise(resolve => {release = resolve;});
    const pending = f.project(), rejected = assert.rejects(pending, /VIEW_DISPOSED|VAULT_LOCKED|AUTH_CHANGED/);
    while (!release) await new Promise(resolve => setImmediate(resolve));
    if (boundary === 'abort') f.abort.abort(); else f[boundary]();
    release('late'); await rejected;
});

test('session is rechecked after collection, before any decryption', async () => {
    const f = fixture();
    const project = createExcelExportProjection({...f.options, collectRecords: async (_uid, options) => {
        f.change(); assert.equal(options.isActive(), false); return f.records;
    }});
    await assert.rejects(project(), /AUTH_CHANGED/); assert.equal(f.reads.length, 0);
});

test('decrypt errors and ciphertext sentinel values cannot silently produce partial export', async () => {
    for (const value of [null, '--ERRORE--', 'enc:Account']) {
        const f = fixture(); f.context.read = async () => value;
        await assert.rejects(f.project(), /DECRYPT/);
    }
    const f = fixture(); f.context.read = async () => {throw Error('decode');}; await assert.rejects(f.project(), /decode/);
});

test('owners, scopes and duplicate identities are checked, company identity is distinct', async () => {
    for (const bad of [
        {scope: 'private-account', id: 'foreign', data: {ownerId: 'other'}},
        {scope: 'profile', id: 'other', data: {}}, {scope: 'unknown', id: 'x', data: {}},
        {scope: 'company-account', id: 'x', data: {}}, {scope: 'private-account-widget', id: 'x', data: {}}
    ]) {const f = fixture(); f.records.push(bad); await assert.rejects(f.project());}
    const f = fixture(); f.records.push(f.records[0]); await assert.rejects(f.project());
    const g = fixture();
    for (const companyId of ['one', 'two']) g.records.push({scope: 'company-account', id: 'account', companyId, data: {nomeAccount: companyId}});
    assert.equal((await g.project()).length, 5);
});

test('malformed fields, byte tags and excessive depth or plaintext size fail closed', async () => {
    for (const value of [{$type: 'bytes', value: [1]}, {encrypted: 'yes', value: 'x'}, NaN]) {
        const f = fixture(); f.records[0].data.extra = value; await assert.rejects(f.project());
    }
    const f = fixture(); let deep = {};
    for (let i = 0; i < 34; i++) deep = {next: deep};
    f.records[0].data.extra = deep; await assert.rejects(f.project(), /LIMIT/);
    const g = fixture(); g.context.read = async () => 'x'.repeat(16 * 1024 * 1024 + 1);
    await assert.rejects(g.project(), /LIMIT/);
});

test('tagged dates are validated and formula-like user strings stay plain strings', async () => {
    const f = fixture();
    f.records[0].data.note = '=HYPERLINK("https://example.invalid")';
    f.records[0].data.date = {$type: 'timestamp', seconds: 0, nanoseconds: 0};
    const rows = await f.project();
    assert.equal(rows[0].data.note, f.records[0].data.note);
    assert.equal(rows[0].data.date, '1970-01-01T00:00:00.000Z');
});
