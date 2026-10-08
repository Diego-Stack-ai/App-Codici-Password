const test = require('node:test');
const assert = require('node:assert/strict');
const {planArchivePurgeReferences: plan} = require('../archive-purge-reference-plan');

const prefix = 'users/owner/';
function fixture(context = 'private', companyId = null) {
  const identity = {context, accountId: 'account', ...(context === 'company' ? {companyId} : {})};
  return {uid: 'owner', command: {context, companyId, accountId: 'account', operationId: 'op',
    expectedRevision: 2, confirmation: 'DELETE_FOREVER'}, writeBudget: 20,
  inventory: {
    scope: {ownerUid: 'owner', context, companyId, accountId: 'account'},
    complete: {widgets: true, links: true, invites: true, sharedData: true},
    widgets: [{path: `${prefix}accountWidgets/custom-widget`, ...identity,
      kind: 'shared-reference', sharedDataId: 'shared', linkId: 'custom-link'},
    {path: `${prefix}accountWidgets/embedded`, ...identity, kind: 'embedded'}],
    links: [{path: `${prefix}sharedVaultLinks/custom-link`, ...identity,
      sharedDataId: 'shared', widgetId: 'custom-widget'}],
    sharedData: [{path: `${prefix}sharedVaultData/shared`, revision: 3}],
    invites: [{path: 'invites/arbitrary-contact@example.invalid', ownerId: 'owner', accountId: 'account',
      ...(context === 'company' ? {aziendaId: companyId} : {})}]
  }};
}
function rejected(input, code) {
  const output = plan(input);
  assert.equal(output.valid, false);
  assert.equal(output.applicable, false);
  assert.deepEqual(output.deletePaths, []);
  assert.deepEqual(output.revisionTouches, []);
  assert.equal(output.plannedWriteCount, 0);
  if (code) assert.ok(output.anomalies.some(item => item.code === code), JSON.stringify(output.anomalies));
  return output;
}

test('proposta privata interna: elimina solo riferimenti e mantiene dati condivisi', () => {
  const input = fixture(), before = structuredClone(input), output = plan(input);
  assert.equal(output.valid, true);
  assert.equal(output.applicable, false);
  assert.deepEqual(output.activation, {integrated: false, requiredGate: 'GLOBAL_PURGE_LOCK', grantCleanup: 'EXCLUDED_UNRESOLVED'});
  assert.deepEqual(output.deletePaths, ['invites/arbitrary-contact@example.invalid',
    `${prefix}accountWidgets/custom-widget`, `${prefix}accountWidgets/embedded`, `${prefix}sharedVaultLinks/custom-link`]);
  assert.deepEqual(output.revisionTouches, [{path: `${prefix}sharedVaultData/shared`, expectedRevision: 3, nextRevision: 4}]);
  assert.equal(output.plannedWriteCount, 5);
  assert.deepEqual(input, before);
  assert.ok(Object.isFrozen(output) && Object.isFrozen(output.revisionTouches[0]));
});

test('identità esatta di azienda e proprietario, senza usare prefissi degli inviti', () => {
  for (const context of ['private', 'company']) {
    const input = fixture(context, context === 'company' ? 'company-1' : null);
    input.inventory.widgets.push({path: `${prefix}accountWidgets/other-company`, kind: 'embedded', context: 'company', companyId: 'company-2', accountId: 'account'});
    input.inventory.invites.push(
      {path: 'invites/account_misleading-prefix', ownerId: 'other-owner', accountId: 'account'},
      {path: 'invites/account_other-company', ownerId: 'owner', accountId: 'account', aziendaId: 'company-2'},
      {path: 'invites/account_other-account', ownerId: 'owner', accountId: 'other'});
    if (context === 'company') input.inventory.invites.push({path: 'invites/account_private', ownerId: 'owner', accountId: 'account'});
    const output = plan(input);
    assert.equal(output.valid, true);
    assert.equal(output.deletePaths.length, 4);
    assert.ok(!output.deletePaths.some(path => path.includes('other') || path.endsWith('_private')));
  }
});

test('due coppie target toccano una revisione, altra coppia conserva le credenziali', () => {
  const input = fixture();
  for (const [suffix, accountId] of [['second', 'account'], ['other', 'other']]) {
    input.inventory.widgets.push({...input.inventory.widgets[0], path: `${prefix}accountWidgets/${suffix}`, accountId, linkId: suffix});
    input.inventory.links.push({...input.inventory.links[0], path: `${prefix}sharedVaultLinks/${suffix}`, accountId, widgetId: suffix});
  }
  const output = plan(input);
  assert.equal(output.valid, true);
  assert.equal(output.deletePaths.length, 6);
  assert.equal(output.revisionTouches.length, 1);
  assert.ok(output.deletePaths.every(path => !path.includes('sharedVaultData') && !path.endsWith('/other')));
});

test('inventario deve attestare completezza e ambito esatto', () => {
  for (const collection of ['widgets', 'links', 'invites', 'sharedData']) {
    const input = fixture(); input.inventory.complete[collection] = false;
    rejected(input, 'INVENTORY_INCOMPLETE');
    delete input.inventory[collection]; rejected(input, 'INVENTORY_SHAPE_INVALID');
  }
  for (const key of ['ownerUid', 'context', 'accountId', 'companyId']) {
    const input = fixture(); input.inventory.scope[key] = 'different';
    rejected(input, 'INVENTORY_SCOPE_MISMATCH');
  }
  rejected({}, 'TARGET_INVALID');
  const unsafe = fixture(); unsafe.command.expectedRevision = Number.MAX_SAFE_INTEGER + 1;
  rejected(unsafe, 'TARGET_INVALID');
});

test('coppie incomplete, incrociate o duplicate impediscono tutte le azioni', () => {
  const mutations = [
    input => { input.inventory.links = []; },
    input => { input.inventory.widgets = input.inventory.widgets.slice(1); },
    input => { input.inventory.links[0].widgetId = 'embedded'; },
    input => { input.inventory.links[0].sharedDataId = 'wrong'; },
    input => { input.inventory.links[0].accountId = 'another'; },
    input => { input.inventory.links[0].context = 'company'; input.inventory.links[0].companyId = 'company'; },
    input => { input.inventory.widgets.push({...input.inventory.widgets[0]}); },
    input => { input.inventory.widgets[1].kind = 'unknown'; },
    input => { input.inventory.widgets[1].sharedDataId = 'shared'; }
  ];
  for (const mutate of mutations) { const input = fixture(); mutate(input); rejected(input); }
});

test('metadati privati non normalizzano companyId e inviti ambigui', () => {
  for (const value of [null, '', 'company']) {
    const input = fixture(); input.inventory.widgets[0].companyId = value;
    rejected(input, 'ACCOUNT_IDENTITY_INVALID');
  }
  for (const value of [null, '', 7]) {
    const input = fixture(); input.inventory.invites[0].aziendaId = value;
    rejected(input, 'INVITE_IDENTITY_INVALID');
  }
});

test('riferimenti inversi da altri account impediscono di lasciare coppie pendenti', () => {
  for (const collection of ['widgets', 'links']) {
    const input = fixture();
    input.inventory[collection].push({...input.inventory[collection][0],
      path: `${prefix}${collection === 'widgets' ? 'accountWidgets' : 'sharedVaultLinks'}/foreign`, accountId: 'other'});
    rejected(input, 'FOREIGN_INCOMING_REFERENCE');
  }
});

test('revisione centrale esistente e incrementabile obbligatoria', () => {
  for (const revision of [undefined, null, '3', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1]) {
    const input = fixture(); input.inventory.sharedData[0].revision = revision;
    rejected(input, 'SHARED_REVISION_INVALID');
  }
  const input = fixture(); input.inventory.sharedData = [];
  rejected(input, 'SHARED_DATA_MISSING');
});

test('budget residuo include eliminazioni e revisioni, nessuna proposta parziale', () => {
  const input = fixture(); input.writeBudget = 5; assert.equal(plan(input).valid, true);
  input.writeBudget = 4; rejected(input, 'WRITE_BUDGET_EXCEEDED');
  for (const budget of [undefined, -1, 451, 1.5, '20']) {
    input.writeBudget = budget; rejected(input, 'WRITE_BUDGET_INVALID');
  }
  for (const key of ['widgets', 'links', 'invites', 'sharedData']) input.inventory[key] = [];
  input.writeBudget = 0; assert.equal(plan(input).valid, true);
});

test('namespace estranei respinti; anomalie non espongono path o contenuti', () => {
  const input = fixture();
  input.inventory.widgets[0].path = 'users/another-owner/accountWidgets/private-sensitive-id';
  input.inventory.widgets[0].ciphertext = 'secret-cipher-body';
  const output = rejected(input, 'METADATA_PATH_INVALID');
  assert.ok(!JSON.stringify(output).includes('private-sensitive-id'));
  assert.ok(!JSON.stringify(output).includes('secret-cipher-body'));
  assert.ok(output.anomalies.every(item => Object.keys(item).every(key => ['code', 'collection', 'index'].includes(key))));
});

test('grant sconosciuti esclusi, contenuti extra mai restituiti e gate inattivo', () => {
  const input = fixture();
  input.inventory.grants = [{path: 'recordAccess/private-secret', recipientId: 'secret-recipient'}];
  input.inventory.sharedData[0].ciphertext = 'secret-cipher-body';
  const output = plan(input);
  assert.equal(output.valid, true);
  assert.equal(output.applicable, false);
  assert.equal(output.activation.grantCleanup, 'EXCLUDED_UNRESOLVED');
  assert.ok(!JSON.stringify(output).includes('secret-'));
});
