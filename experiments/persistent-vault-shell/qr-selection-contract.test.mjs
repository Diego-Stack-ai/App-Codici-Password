import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePrivateQrSelection} from './qr-selection-contract.mjs';
const profile = () => ({contactPhones: [{id: 'phone-a', number: 'enc:SECRET'}, {id: 'phone-b'}],
    contactEmails: [{id: 'email-a', password: 'enc:SECRET'}], userAddresses: [{id: 'address-a'}]});
test('saved indexes become stable IDs and survive reordered contact rows', () => {
    const source = profile(), before = structuredClone(source);
    const config = preparePrivateQrSelection({nome: true, phones: [1], emails: ['email-a']}, source);
    assert.deepEqual(config.phones, ['phone-b']); assert.equal(config.photo, false);
    assert.deepEqual(source, before); assert.doesNotMatch(JSON.stringify(config), /SECRET|password|number/);
    source.contactPhones.reverse();
    assert.deepEqual(preparePrivateQrSelection(config, source), config);
    assert.ok(Object.isFrozen(config) && Object.isFrozen(config.phones));
});
test('missing, ambiguous and duplicate selected identities cannot silently change consent', () => {
    for (const configure of [p => {p.contactPhones.pop();}, p => {p.contactPhones.push({...p.contactPhones[1]});}]) {
        const p = profile(); configure(p); assert.throws(() => preparePrivateQrSelection({phones: ['phone-b']}, p));
    }
    for (const phones of [[-1], [22], [0, 'phone-a'], ['missing'], ['phone/a'], [1.5]]) {
        assert.throws(() => preparePrivateQrSelection({phones}, profile()));
    }
});
test('foreign payload fields, malformed booleans and oversized choices are rejected', () => {
    for (const config of [{ownerId: 'other'}, {photo: 'true'}, {phones: 'phone-a'}, {phones: Array(1001).fill('phone-a')}, {password: 'secret'}]) {
        assert.throws(() => preparePrivateQrSelection(config, profile()));
    }
    assert.throws(() => preparePrivateQrSelection({}, {...profile(), isArchived: true}));
    assert.deepEqual(preparePrivateQrSelection({}, {}).emails, []);
});
