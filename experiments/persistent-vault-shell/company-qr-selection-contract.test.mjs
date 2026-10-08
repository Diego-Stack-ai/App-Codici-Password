import test from 'node:test';
import assert from 'node:assert/strict';
import {COMPANY_QR_SCALARS, prepareCompanyQrSelection, readCompanyQrSelection} from './company-qr-selection-contract.mjs';

test('absent company configuration is distinct from legacy defaults and grants no implicit selection', () => {
    const absent = readCompanyQrSelection({});
    assert.equal(absent.expectedConfig, null); assert.ok(Object.values(absent.selection).every(value => value === false));
    const legacy = readCompanyQrSelection({qrConfig: {}});
    assert.equal(legacy.selection.ragioneSociale, true); assert.equal(legacy.selection.qrLegale, true);
    for (const key of ['telefonoAzienda', 'adminEmail', 'persEmail']) assert.equal(legacy.selection[key], false);
    assert.deepEqual(legacy.expectedConfig, {}); assert.equal(legacy.revision, 0);
});
test('company selection snapshot contains no values or row flags and is immutable', () => {
    const record = {qrConfig: {qrLegale: false, ragioneSociale: true}, ragioneSociale: 'enc:SECRET',
        emails: {extra: [{email: 'SECRET', password: 'SECRET', qr: true}]}, altreSedi: [{qr: true, indirizzo: 'SECRET'}]};
    const before = structuredClone(record), snapshot = readCompanyQrSelection(record);
    assert.equal(snapshot.selection.qrLegale, false); assert.deepEqual(record, before);
    assert.doesNotMatch(JSON.stringify(snapshot), /SECRET|password|indirizzo|extra/);
    for (const value of [snapshot, snapshot.selection, snapshot.expectedConfig]) assert.ok(Object.isFrozen(value));
    assert.deepEqual(prepareCompanyQrSelection(snapshot.selection), snapshot.selection);
});
test('malformed configuration and unknown future fields fail instead of being discarded', () => {
    for (const config of [null, [], 'x', {photo: true}, {telefonoAzienda: 1}, {qrLegale: null},
        {_qrRevision: null}, {_qrRevision: -1}, {_qrRevision: 1.5}, {_qrRevision: Number.MAX_SAFE_INTEGER}, {_qrSchemaVersion: 2}]) {
        assert.throws(() => readCompanyQrSelection({qrConfig: config}));
    }
    assert.throws(() => readCompanyQrSelection({isArchived: true}));
    assert.throws(() => readCompanyQrSelection(null));
});
test('wire selection requires all fourteen explicit booleans; canonical ordering is stable', () => {
    const valid = Object.fromEntries(COMPANY_QR_SCALARS.map(key => [key, false]));
    for (const input of [{}, {...valid, password: 'secret'}, {...valid, qrLegale: 'false'}, {...valid, qrLegale: undefined}]) {
        assert.throws(() => prepareCompanyQrSelection(input));
    }
    const left = readCompanyQrSelection({qrConfig: {qrLegale: false, ragioneSociale: true}});
    const right = readCompanyQrSelection({qrConfig: {ragioneSociale: true, qrLegale: false}});
    assert.equal(JSON.stringify(left), JSON.stringify(right));
});
