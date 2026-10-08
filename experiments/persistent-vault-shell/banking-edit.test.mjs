import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bankingEditBasis, validateBankingEditRequest} from './banking-edit-contract.mjs';
import {createBankingEditHandler} from './banking-edit-handler.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = Buffer.alloc(48, 42).toString('base64');
function fixture(company = false) {
  const uid = 'synthetic', account = company ? {domain: 'company', companyId: 'firm', id: 'a'} : {domain: 'private', id: 'a'};
  const parent = company ? `users/${uid}/aziende/firm` : `users/${uid}`, path = `${parent}/accounts/a`;
  const original = {ownerId: uid, id: 'a', revision: 2, banking: [
    {bankId: 'first', iban: 'FIRST', unknown: {keep: true}, cards: [{cardNumber: cipher, pin: cipher}]},
    {bankId: 'second', iban: 'SECOND', cards: [{cardNumber: cipher, pin: cipher, preserved: true}]}],
    note: 'KEEP', linkedProfileFields: [{id: 'link', type: 'phone'}]};
  const records = new Map([[path, structuredClone(original)], [parent, {ownerId: uid}]]);
  let fenced = false, fenceWrites = 0;
  const db = {doc: path => path, async runTransaction(run) {
    const writes = [];
    const result = await run({get: async ref => ({exists: records.has(ref), data: () => structuredClone(records.get(ref))}),
      update: (ref, patch) => writes.push(() => records.set(ref, {...records.get(ref), ...patch})),
      create: (ref, value) => writes.push(() => {assert.equal(records.has(ref), false); records.set(ref, value);})});
    writes.forEach(write => write()); return result;
  }};
  const handler = createBankingEditHandler({db, hash, timestamp: () => 1000,
    beforeAccountWrite: async () => {if (fenced) throw Error('PURGE_FENCED'); return () => {fenceWrites++;};}});
  const basis = bankingEditBasis(original, uid, account);
  const request = {expectedOwnerUid: uid, operationId: 'op', account, bankId: 'second', cardIndex: 0,
    patch: {pin: cipher, expiry: '12/30'}, expectedRevision: basis.revision, expectedFingerprint: hash(basis.fingerprintInput)};
  return {records, path, original, request, handler, trusted: {auth: {uid}, app: {appId: 'test'}},
    block: () => {fenced = true;}, fenceWrites: () => fenceWrites};
}
for (const company of [false, true]) test(`bank/card patch preserves unrelated fields and retries exactly: company=${company}`, async () => {
  const f = fixture(company);
  assert.equal((await f.handler(f.request, f.trusted)).status, 'confirmed');
  const result = f.records.get(f.path);
  assert.deepEqual(result.banking[0], f.original.banking[0]);
  assert.equal(result.banking[1].cards[0].preserved, true);
  assert.equal(result.banking[1].cards[0].expiry, '12/30');
  assert.deepEqual(result.linkedProfileFields, f.original.linkedProfileFields); assert.equal(result.note, 'KEEP');
  await f.handler(f.request, f.trusted); assert.equal(f.fenceWrites(), 1);
  await assert.rejects(f.handler({...f.request, patch: {expiry: '11/30'}}, f.trusted), /OPERATION_CONFLICT/);
});
test('bank patch rejects ciphertext omission, forged fields, legacy identity and stale card order', async () => {
  const f = fixture();
  for (const patch of [{pin: 'clear'}, {bankId: 'replacement'}, {cards: []}, {expiry: '13/30'}])
    assert.throws(() => validateBankingEditRequest({...f.request, patch}), /INVALID/);
  assert.throws(() => bankingEditBasis({...f.original, banking: [{iban: 'legacy'}]}, 'synthetic', f.request.account), /INVALID/);
  const changed = f.records.get(f.path); changed.banking[1].cards.unshift({pin: cipher});
  await assert.rejects(f.handler(f.request, f.trusted), /CONFLICT/);
  assert.equal(f.fenceWrites(), 0);
});
test('auth, owner and purge fence block writes and receipts', async () => {
  const f = fixture(), before = structuredClone([...f.records]);
  await assert.rejects(f.handler(f.request, {}), /UNAUTHENTICATED/);
  await assert.rejects(f.handler({...f.request, expectedOwnerUid: 'other'}, f.trusted), /OWNER_MISMATCH/);
  f.block(); await assert.rejects(f.handler(f.request, f.trusted), /PURGE_FENCED/);
  assert.deepEqual([...f.records], before);
});
