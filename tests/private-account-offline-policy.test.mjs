import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/privato/private-account-offline-policy.js', import.meta.url), 'utf8');
const {classifyPrivateAccountOfflineWrite} = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

test('abilita soltanto account e memorandum privati isolati', () => {
    assert.deepEqual(classifyPrivateAccountOfflineWrite({type: 'account', visibility: 'private'}),
        {eligible: true, reason: null});
    assert.deepEqual(classifyPrivateAccountOfflineWrite({type: 'memo', visibility: 'private'}),
        {eligible: true, reason: null});
});

test('richiede la rete per banca, profilo e condivisioni', () => {
    assert.equal(classifyPrivateAccountOfflineWrite({type: 'account', visibility: 'private', isBanking: true}).reason, 'banking');
    assert.equal(classifyPrivateAccountOfflineWrite({type: 'account', visibility: 'private', hasProfileLink: true}).reason, 'profile-link');
    assert.equal(classifyPrivateAccountOfflineWrite({type: 'account', visibility: 'shared'}).reason, 'shared-account');
    assert.equal(classifyPrivateAccountOfflineWrite({type: 'memo', visibility: 'shared'}).reason, 'shared-memo');
});
