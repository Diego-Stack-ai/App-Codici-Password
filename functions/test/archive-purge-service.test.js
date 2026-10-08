const test = require("node:test");
const assert = require("node:assert/strict");
const {
  accountPath, isSafeAttachmentPath, purgeDecision, planProfileReferenceCleanup, validatePurgeCommand,
  assertNoExternalAccountReferences
} = require("../archive-purge-service");

test('external preflight separates account namespaces and preserves inputs', () => {
  const targets = [{context: 'private', accountId: 'a', companyId: null},
    {context: 'company', accountId: 'a', companyId: 'c'}];
  for (const target of targets) {
    for (const slot of [0, 1]) {
      const lists = [[], []];
      lists[slot] = [Object.freeze({...target})];
      assert.throws(() => assertNoExternalAccountReferences(target, ...lists));
      lists[slot] = [Object.freeze({...target, accountId: 'other'})];
      const before = JSON.stringify(lists);
      assert.doesNotThrow(() => assertNoExternalAccountReferences(Object.freeze(target), ...lists));
      assert.equal(JSON.stringify(lists), before);
    }
  }
  assert.doesNotThrow(() => assertNoExternalAccountReferences(targets[0], [targets[1]], []));
  assert.throws(() => assertNoExternalAccountReferences(targets[0], [targets[0]], [targets[0]]));
  assert.throws(() => assertNoExternalAccountReferences(targets[0], [targets[1]], [targets[0]]));
  assert.throws(() => assertNoExternalAccountReferences(targets[0], [targets[0]], [targets[1]]));
  assert.doesNotThrow(() => assertNoExternalAccountReferences(targets[1], [targets[0]],
    [{...targets[1], companyId: 'other'}]));
  for (const companyId of [undefined, null, '']) {
    assert.doesNotThrow(() => assertNoExternalAccountReferences(targets[0],
      [{context: 'private', accountId: 'other', companyId}], []));
  }
});

test('external preflight fails closed on ambiguous identities and missing collections', () => {
  const target = {context: 'private', accountId: 'a'};
  for (const invalid of [null, undefined, [], {}, {context: 'unknown', accountId: 'x'},
    {context: 'private', accountId: 'x', companyId: 'c'}, {context: 'company', accountId: 'x'},
    ...['', 'a/b', 42, 'x'.repeat(161)].map(accountId => ({context: 'private', accountId}))]) {
    assert.throws(() => assertNoExternalAccountReferences(target, [invalid], []));
    assert.throws(() => assertNoExternalAccountReferences(target, [], [invalid]));
  }
  assert.throws(() => assertNoExternalAccountReferences(target, null, []));
  assert.throws(() => assertNoExternalAccountReferences(target, [], undefined));
});

test("accetta soltanto account privati o aziendali con identificatori sicuri", () => {
  const privateCommand = validatePurgeCommand({
    accountId: "account-1", operationId: "device:op-1", context: "private",
    expectedRevision: 2, confirmation: "DELETE_FOREVER"
  });
  assert.equal(accountPath("owner-1", privateCommand), "users/owner-1/accounts/account-1");
  assert.equal(privateCommand.confirmation, true);
  assert.throws(() => validatePurgeCommand({
    accountId: "../account", operationId: "op", context: "private", expectedRevision: 0
  }), /INVALID/);
});

test("costruisce il percorso aziendale senza accettare attraversamenti", () => {
  const command = validatePurgeCommand({
    accountId: "a1", companyId: "c1", operationId: "op1", context: "company", expectedRevision: 0
  });
  assert.equal(accountPath("u1", command), "users/u1/aziende/c1/accounts/a1");
  assert.equal(isSafeAttachmentPath("u1", command, "users/u1/aziende/c1/accounts/a1/attachments/file.pdf"), true);
  assert.equal(isSafeAttachmentPath("u1", command, "users/u2/aziende/c1/accounts/a1/attachments/file.pdf"), false);
});

test('purge never coerces malformed identifiers or revisions into a destructive command', () => {
  const command = {accountId: 'a1', operationId: 'op1', context: 'private', expectedRevision: 0, confirmation: 'DELETE_FOREVER'};
  for (const patch of [{accountId: 1}, {accountId: ' a1 '}, {operationId: {}}, {expectedRevision: '0'},
    {expectedRevision: null}, {expectedRevision: false}, {expectedRevision: Number.MAX_SAFE_INTEGER + 1}]) {
    assert.throws(() => validatePurgeCommand({...command, ...patch}), /INVALID/);
  }
  for (const revision of ['0', null, false, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(purgeDecision({record: {isArchived: true, revision}, expectedRevision: 0, confirmed: true}).status, 'invalid-revision');
  }
  assert.equal(purgeDecision({record: {isArchived: true}, expectedRevision: 0, confirmed: true}).status, 'ready');
});

test("la cancellazione richiede sempre archivio, revisione e conferma manuale", () => {
  const base = {isArchived: true, revision: 3, purgeAfter: "2030-01-31T00:00:00.000Z"};
  assert.equal(purgeDecision({record: base, expectedRevision: 3, confirmed: false}).status, "confirmation-required");
  assert.equal(purgeDecision({record: base, expectedRevision: 3, confirmed: true}).status, "ready");
  assert.equal(purgeDecision({record: base, expectedRevision: 3, confirmed: false}).status, "confirmation-required");
  assert.equal(purgeDecision({record: base, expectedRevision: 2, confirmed: true}).status, "conflict");
  assert.equal(purgeDecision({record: {...base, isArchived: false}, expectedRevision: 3, confirmed: true}).status, "not-archived");
  assert.equal(purgeDecision({record: null, expectedRevision: 0, confirmed: true}).status, "not-found");
  assert.equal(purgeDecision({record: null, expectedRevision: 0, confirmed: true, previous: {status: "processing"}}).status, "resume");
  assert.deepEqual(purgeDecision({record: null, expectedRevision: 0, confirmed: true, previous: {status: "purged"}}), {status: "purged", duplicate: true});
});

test('cleanup preserves namespace, contact content, metadata and unrelated ciphertext across all profile fields', () => {
  for (const context of ['private', 'company']) {
    const command = {accountId: 'a1', context, companyId: context === 'company' ? 'c1' : null};
    const linked = {linkedAccountId: 'a1', linkedAccountCompanyId: context === 'company' ? 'c1' : '', note: 'note', password: 'ciphertext'};
    const other = {...linked, linkedAccountCompanyId: 'other-company'};
    const cleared = {...linked, linkedAccountId: '', linkedAccountCompanyId: ''};
    const source = {contactEmails: [linked, other], contactPhones: [linked], documenti: [linked],
      userAddresses: [{id: 'address', note: 'address-note', utilities: [linked]}], metadata: 'keep'};
    const before = structuredClone(source), patch = planProfileReferenceCleanup(source, command);
    assert.deepEqual(patch.contactEmails, [cleared, other]);
    assert.deepEqual(patch.contactPhones, [cleared]); assert.deepEqual(patch.documenti, [cleared]);
    assert.deepEqual(patch.userAddresses, [{...source.userAddresses[0], utilities: [cleared]}]);
    assert.equal('metadata' in patch, false); assert.deepEqual(source, before);
    assert.deepEqual(planProfileReferenceCleanup({...source, ...patch}, command), {});
    const company = {emails: {pec: linked, amministrazione: linked, personale: other, extra: [linked], metadata: 'keep'},
      phoneAccountLinks: {telefonoAzienda: linked, faxAzienda: linked, referenteCellulare: linked}, isArchived: true};
    const companyBefore = structuredClone(company), result = planProfileReferenceCleanup(company, command, {company: true});
    assert.deepEqual(result.emails, {...company.emails, pec: cleared, amministrazione: cleared, extra: [cleared]});
    assert.deepEqual(Object.values(result.phoneAccountLinks), [cleared, cleared, cleared]);
    assert.deepEqual(company, companyBefore);
    assert.deepEqual(planProfileReferenceCleanup({...company, ...result}, command, {company: true}), {});
  }
});

test('malformed source aborts planning and unrelated old null links are preserved', () => {
  const command = {accountId: 'a1', context: 'private'};
  for (const source of [{contactEmails: {}}, {documenti: [null]}, {userAddresses: [{utilities: null}]}]) {
    assert.throws(() => planProfileReferenceCleanup(source, command), /SHAPE_UNSUPPORTED/);
  }
  assert.deepEqual(planProfileReferenceCleanup({contactEmails: [{linkedAccountId: null}]}, command), {});
});
