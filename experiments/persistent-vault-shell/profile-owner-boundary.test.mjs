import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateAddressesHandler} from './private-addresses-handler.mjs';
import {createCompanyAddressesHandler} from './company-addresses-handler.mjs';
import {createCompanyContactsHandler} from './company-contacts-handler.mjs';

for (const [name, factory, target, operation] of [
    ['private addresses', createPrivateAddressesHandler, {domain: 'private'},
        {kind: 'create', id: 'address-new', fields: {city: 'Prova'}}],
    ['company addresses', createCompanyAddressesHandler, {domain: 'company', companyId: 'company'},
        {kind: 'address-create', id: 'sede-new', fields: {citta: 'Prova'}}],
    ['company contacts', createCompanyContactsHandler, {domain: 'company', companyId: 'company'},
        {kind: 'email-extra-create', id: 'company-email-new', fields: {email: 'test@example.invalid'}}]
]) {
    test(`${name}: changed owner is rejected before database or hashing`, async () => {
        const unreachable = () => {assert.fail('must not reach storage or hash');};
        const run = factory({db: {doc: unreachable}, hash: unreachable, timestamp: unreachable});
        const request = {target, expectedOwnerUid: 'owner', expectedRevision: 0,
            operationId: 'operation', operations: [operation]};
        await assert.rejects(run(request, {auth: {uid: 'other'}, app: {appId: 'synthetic'}}), /OWNER_MISMATCH/);
        for (const expectedOwnerUid of [undefined, null, 123, '', '../owner']) {
            await assert.rejects(run({...request, expectedOwnerUid},
                {auth: {uid: 'owner'}, app: {appId: 'synthetic'}}), /INVALID/);
        }
    });
}
