import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareResumePlan, verifyResumePlan, RESUME_PLAN_DURATION_MS} from './restore-resume-plan.mjs';
const input = () => [{expectedOwnerUid: 'synthetic', operationId: 'operation', backupId: 'backup',
  chunkIndex: 0, chunkCount: 1, mode: 'apply', confirmation: 'RESTORE_VALIDATED',
  records: [{scope: 'private-account', id: 'account', expectedVersion: {exists: false}, data: {secret: 'SYNTHETIC-CONTENT'}}]}];

test('plan creation rejects missing attachment and widget parents before persisting a plan', async () => {
  const {createResumePlanLab} = await import('./restore-resume-plan-lab.mjs');
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  try {
    for (const widget of [false, true]) {
      let writes = 0;
      const store = {projectId: 'demo-vault-shell', doc: path => ({path}),
        runTransaction: fn => fn({get: async () => ({exists: false}), create: () => {writes++;}})};
      const commands = input();
      commands[0].records = [{scope: widget ? 'private-account-widget' : 'private-account-attachment',
        accountId: 'missing', id: 'child', expectedVersion: {exists: false},
        data: widget ? {kind: 'embedded', context: 'private', accountId: 'missing'} : {synthetic: true}}];
      await assert.rejects(createResumePlanLab({store, projectId: store.projectId, now: () => 1000})
        .create('synthetic', commands, [{restoreOperationId: 'restore', stageIds: []}]),
      new RegExp(widget ? 'WIDGET_PARENT_MISSING' : 'ATTACHMENT_PARENT_MISSING'));
      assert.equal(writes, 0);
      commands[0].mode = 'preview'; delete commands[0].confirmation;
      delete commands[0].records[0].expectedVersion;
      await assert.rejects(createResumePlanLab({store, projectId: store.projectId, now: () => 1000})
        .preview('synthetic', commands), /PARENT_MISSING/);
      assert.equal(writes, 0);
    }
  } finally {
    if (previous === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous;
  }
});

test('creation rejects missing or ambiguous widget banks for selected and existing parents', async () => {
  const {createResumePlanLab} = await import('./restore-resume-plan-lab.mjs');
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  try {
    for (const selected of [false, true]) for (const banking of [[], [{bankId:'b'}, {bankId:'b'}], [{bankId:'b'}]]) {
      let writes = 0;
      const commands = input();
      const parent = {...commands[0].records[0], data:{banking}};
      commands[0].records = [...(selected ? [parent] : []), {scope:'private-account-widget', accountId:'account',
        id:'widget', expectedVersion:{exists:false}, data:{kind:'embedded', context:'private', accountId:'account', bankId:'b'}}];
      let reads = 0;
      const store = {projectId:'demo-vault-shell', doc:path=>({path}), runTransaction:fn=>fn({
        get:async()=>{reads++;return reads <= commands[0].records.length ? {exists:false} : {exists:true,data:()=>({banking})};},
        create:()=>{writes++;}})};
      const lab = createResumePlanLab({store,projectId:store.projectId,now:()=>1000});
      const creating = lab.create('synthetic',commands,[{restoreOperationId:'restore',stageIds:[]}]);
      if (banking.length === 1) {await creating; assert.equal(writes,1);}
      else {await assert.rejects(creating,/WIDGET_BANK_MISSING/);assert.equal(writes,0);}
      if (selected) {
        commands[0].mode='preview';delete commands[0].confirmation;reads=0;
        commands[0].records.forEach(record=>{delete record.expectedVersion;});
        await lab.preview('synthetic',commands);
        assert.equal(writes,banking.length===1?1:0,'preview never writes or blocks selection based on bank choice');
      }
    }
  } finally {
    if(previous===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;else process.env.FIRESTORE_EMULATOR_HOST=previous;
  }
});

test('preview rejects unsupported precision before any database access or attachment staging',async()=>{
  const {createResumePlanLab}=await import('./restore-resume-plan-lab.mjs');
  const previous=process.env.FIRESTORE_EMULATOR_HOST;let reads=0;
  process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8085';
  try {
    const lab=createResumePlanLab({projectId:'demo-vault-shell',store:{projectId:'demo-vault-shell',
      runTransaction(){reads++;throw Error('UNEXPECTED_DATABASE_ACCESS');}}});
    const commands=input();commands[0].mode='preview';delete commands[0].confirmation;
    commands[0].records[0].data={at:{$type:'timestamp',seconds:1,nanoseconds:1}};
    delete commands[0].records[0].expectedVersion;
    await assert.rejects(lab.preview('synthetic',commands),/TIMESTAMP_PRECISION_UNSUPPORTED/);
    assert.equal(reads,0);
  }finally{if(previous===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;else process.env.FIRESTORE_EMULATOR_HOST=previous;}
});
test('staged resume binds the exact attachment manifest and receipt domain', () => {
  const commands = input(), stages = [{restoreOperationId: 'restore', stageIds: ['a'.repeat(64)]}];
  const plan = prepareResumePlan('synthetic', 'plan', commands, 1000, stages);
  assert.deepEqual(verifyResumePlan(plan, 'synthetic', 'plan', commands, 1001, stages), plan);
  assert.equal(JSON.stringify(plan).includes('SYNTHETIC-CONTENT'), false);
  for (const changed of [undefined, [{...stages[0], stageIds: []}],
    [{...stages[0], restoreOperationId: 'other'}]]) {
    assert.throws(() => verifyResumePlan(plan, 'synthetic', 'plan', commands, 1001, changed), /MISMATCH/);
  }
  assert.throws(() => prepareResumePlan('synthetic', 'plan', commands, 1000, []), /STAGE_INVALID/);
});
test('minimal plan excludes content, expires exactly at thirty days and never slides', () => {
  const commands = input(), plan = prepareResumePlan('synthetic', 'plan', commands, 1000);
  assert.equal(JSON.stringify(plan).includes('SYNTHETIC-CONTENT'), false);
  assert.equal(JSON.stringify(plan).includes('secret'), false);
  assert.equal(plan.expiresAtMs, 1000 + RESUME_PLAN_DURATION_MS);
  assert.deepEqual(verifyResumePlan(plan, 'synthetic', 'plan', commands, plan.expiresAtMs - 1), plan);
  assert.throws(() => verifyResumePlan(plan, 'synthetic', 'plan', commands, plan.expiresAtMs), /EXPIRED_NEW_PREVIEW/);
  assert.equal(plan.createdAtMs, 1000);
});
test('changed owner, body, version, operation and stored metadata cannot resume', () => {
  const commands = input(), plan = prepareResumePlan('synthetic', 'plan', commands, 1000);
  for (const mutate of [c => {c[0].records[0].data.secret = 'changed';},
    c => {c[0].operationId = 'other';}, c => {c[0].records[0].expectedVersion = {exists: true, updateTime: {seconds: 1, nanoseconds: 0}};}]) {
    const changed = structuredClone(commands); mutate(changed);
    assert.throws(() => verifyResumePlan(plan, 'synthetic', 'plan', changed, 1001), /MISMATCH/);
  }
  assert.throws(() => verifyResumePlan(plan, 'other', 'plan', commands, 1001), /OWNER_MISMATCH/);
  for (const corrupt of [{...plan, expiresAtMs: plan.expiresAtMs + 1}, {...plan, contents: 'forbidden'}, {...plan, planHash: 'bad'}]) {
    assert.throws(() => verifyResumePlan(corrupt, 'synthetic', 'plan', commands, 1001), /MISMATCH/);
  }
});
test('incomplete, duplicate and reordered chunk manifests are rejected', () => {
  const commands = input(); commands[0].chunkCount = 2;
  assert.throws(() => prepareResumePlan('synthetic', 'plan', commands, 1000), /INVALID/);
  const second = structuredClone(commands[0]); second.operationId = 'second'; second.chunkIndex = 1;
  assert.throws(() => prepareResumePlan('synthetic', 'plan', [...commands, second], 1000), /DUPLICATE_TARGET/);
  second.records[0].id = 'different';
  assert.equal(prepareResumePlan('synthetic', 'plan', [...commands, second], 1000).chunks.length, 2);
  assert.throws(() => prepareResumePlan('synthetic', 'plan', [second, ...commands], 1000), /INVALID/);
});
