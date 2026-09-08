import assert from 'node:assert/strict';
import test from 'node:test';
import {analyzeCredentialHealth, buildBreachRangeQuery, classifyCredentialType, createHealthSessionKey} from './credential-health.mjs';

test('rileva password deboli, duplicate e datate senza restituire segreti', () => {
  const now = Date.UTC(2026, 8, 8);
  const records = [
    {id: 'a', password: 'password', passwordUpdatedAt: now},
    {id: 'b', password: 'Forte#Fixture123', passwordUpdatedAt: now - 400 * 86400000},
    {id: 'c', password: 'Forte#Fixture123', passwordUpdatedAt: now}
  ];
  const result = analyzeCredentialHealth(records, {now, sessionKey: Buffer.alloc(32, 7)});
  assert.deepEqual(result, [
    {recordId: 'a', flags: ['weak']},
    {recordId: 'b', flags: ['dated', 'duplicate']},
    {recordId: 'c', flags: ['duplicate']}
  ]);
  assert.equal(JSON.stringify(result).includes('Forte#Fixture123'), false);
});

test('le impronte duplicate cambiano a ogni sessione', () => {
  assert.notDeepEqual(createHealthSessionKey(), createHealthSessionKey());
});

test('il controllo violazioni espone soltanto il prefisso k-anonimo', () => {
  const query = buildBreachRangeQuery('fixture-non-segreto');
  assert.match(query.prefix, /^[A-F0-9]{5}$/);
  assert.equal(query.suffix.length, 35);
  assert.equal(Object.keys(query).length, 2);
});

test('passkey servizio e passkey di sblocco Vault restano tipi distinti', () => {
  assert.deepEqual(classifyCredentialType({kind: 'service-passkey'}), {kind: 'service-passkey', canUnlockVault: false});
  assert.deepEqual(classifyCredentialType({kind: 'vault-unlock-passkey'}), {kind: 'vault-unlock-passkey', canUnlockVault: true});
});
