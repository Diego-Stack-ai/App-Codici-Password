import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const cryptoUrl = asModule(await readFile(new URL('../../Frontend/public/assets/js/modules/settings/backup-crypto.js', import.meta.url), 'utf8'));
const modelUrl = asModule(await readFile(new URL('../../Frontend/public/assets/js/modules/settings/backup-import-model.js', import.meta.url), 'utf8'));
const sourceText = (await readFile(new URL('./restore-resume-source.mjs', import.meta.url), 'utf8'))
  .replace('../../Frontend/public/assets/js/modules/settings/backup-crypto.js', cryptoUrl)
  .replace('../../Frontend/public/assets/js/modules/settings/backup-import-model.js', modelUrl);
const {readResumeBackup, createRestoreResumeSource, orderNewRestoreRecords, chunkNewRestoreRecords, validateRestoreSelection} = await import(asModule(sourceText));
const {createBackupHeader, deriveBackupKey, encryptBackupEntry, generateRecoveryKey} = await import(cryptoUrl);
const uid = 'synthetic';

test('new plans keep selected parent and bank widget atomic across count and byte boundaries',()=>{
  for(const company of [false,true]) {
    const parent={scope:company?'company-account':'private-account',...(company?{companyId:'c'}:{}),id:'a',data:{banking:[{bankId:'new'}]}};
    const widget={scope:company?'company-account-widget':'private-account-widget',accountId:'a',...(company?{companyId:'c'}:{}),id:'w',data:{kind:'embedded',context:company?'company':'private',...(company?{companyId:'c'}:{}),accountId:'a',bankId:'new'}};
    const fillers=Array.from({length:399},(_,index)=>({scope:'private-account',id:`other${index}`,data:{}}));
    const chunks=chunkNewRestoreRecords([...fillers,parent,widget]);
    assert.equal(chunks.length,2);assert.deepEqual(chunks[1],[parent,widget]);
    assert.throws(()=>chunkNewRestoreRecords([parent,...Array.from({length:400},(_,index)=>({...widget,id:`w${index}`}))]),/DEPENDENCY_GROUP_TOO_LARGE/);
    const large={...parent,data:{synthetic:'x'.repeat(600*1024)}};
    const largeWidget={...widget,data:{...widget.data,synthetic:'x'.repeat(600*1024)}};
    assert.throws(()=>chunkNewRestoreRecords([large,...Array.from({length:12},(_,index)=>({...largeWidget,id:`large${index}`}))]),/DEPENDENCY_GROUP_TOO_LARGE/);
  }
});

test('company and selected owned Accounts stay together instead of leaving a partial parent',()=>{
  const company={scope:'company',id:'c',data:{nome:'Synthetic'}};
  const accounts=Array.from({length:2},(_,i)=>({scope:'company-account',companyId:'c',id:`a${i}`,data:{}}));
  assert.deepEqual(chunkNewRestoreRecords([...accounts,company]),[[company,...accounts]]);
  assert.throws(()=>chunkNewRestoreRecords([company,...Array.from({length:400},(_,i)=>({...accounts[0],id:`a${i}`}))]),/DEPENDENCY_GROUP_TOO_LARGE/);
});

test('profile and linked deadlines stay in one chunk even after a full Account chunk',()=>{
  const accounts=Array.from({length:400},(_,i)=>({scope:'private-account',id:`a${i}`,data:{}}));
  const profile={scope:'profile',id:uid,data:{documenti:[{id:'doc',expiryReference:{deadlineId:'d'}}]}};
  const deadline={scope:'deadline',id:'d',data:{sourceRef:{type:'profileDocument',id:'doc'}}};
  const chunks=chunkNewRestoreRecords([deadline,...accounts,profile]);
  assert.equal(chunks.length,2);assert.deepEqual(chunks[1],[profile,deadline]);
});

test('shared data, reciprocal links, widgets and Account parents form one atomic dependency group',()=>{
  const common=id=>({scope:'shared-vault-data',id,data:{title:`Synthetic ${id}`}});
  const account=(id,companyId)=>({scope:companyId?'company-account':'private-account',id,
    ...(companyId?{companyId}:{}),data:{synthetic:true}});
  const pair=(sharedDataId,id,companyId)=>{
    const context=companyId?'company':'private',accountId=`a${id}`,linkId=`l${id}`,widgetId=`w${id}`;
    return [
      {scope:'shared-vault-data-link',id:linkId,sharedDataId,data:{sharedDataId,widgetId,context,accountId,...(companyId?{companyId}:{})}},
      {scope:companyId?'company-account-widget':'private-account-widget',id:widgetId,accountId,...(companyId?{companyId}:{}),
        data:{kind:'shared-reference',sharedDataId,linkId,context,accountId,...(companyId?{companyId}:{})}}
    ];
  };
  const privateAccount=account('a1'),privatePair=pair('s1','1');
  assert.deepEqual(chunkNewRestoreRecords([privatePair[1],common('s1'),privateAccount,privatePair[0]]),
    [[common('s1'),privateAccount,privatePair[0],privatePair[1]]]);
  const company={scope:'company',id:'c',data:{nome:'Synthetic'}},companyAccount=account('a2','c'),companyPair=pair('s2','2','c');
  assert.deepEqual(chunkNewRestoreRecords([companyPair[0],company,common('s2'),companyPair[1],companyAccount]),
    [[common('s2'),company,companyAccount,companyPair[0],companyPair[1]]]);
  const second=common('s3'),secondPair=pair('s3','3');
  secondPair[0].data.accountId='a1';secondPair[1].accountId='a1';secondPair[1].data.accountId='a1';
  const merged=chunkNewRestoreRecords([common('s1'),privateAccount,...privatePair,second,...secondPair]);
  assert.equal(merged.length,1);assert.equal(new Set(merged[0]).size,7);assert.equal(merged[0].filter(record=>record===privateAccount).length,1);
});

test('shared dependency groups reject incomplete, crossed and oversized backups before planning',()=>{
  const account={scope:'private-account',id:'a',data:{}},common={scope:'shared-vault-data',id:'s',data:{}},
    link={scope:'shared-vault-data-link',id:'l',sharedDataId:'s',data:{sharedDataId:'s',widgetId:'w',context:'private',accountId:'a'}},
    widget={scope:'private-account-widget',id:'w',accountId:'a',data:{kind:'shared-reference',sharedDataId:'s',linkId:'l',context:'private',accountId:'a'}};
  for(const records of [[account,common,link],[account,common,widget],[account,common,{...link,sharedDataId:'other'},widget],
    [account,common,link,{...widget,data:{...widget.data,linkId:'other'}}]])
    assert.throws(()=>chunkNewRestoreRecords(records),/SHARED_DEPENDENCY_INVALID/);
  const records=[common];
  for(let index=0;index<134;index++) {
    const accountId=`a${index}`,linkId=`l${index}`,widgetId=`w${index}`;
    records.push({scope:'private-account',id:accountId,data:{}},
      {scope:'shared-vault-data-link',id:linkId,sharedDataId:'s',data:{sharedDataId:'s',widgetId,context:'private',accountId}},
      {scope:'private-account-widget',id:widgetId,accountId,data:{kind:'shared-reference',sharedDataId:'s',linkId,context:'private',accountId}});
  }
  assert.throws(()=>chunkNewRestoreRecords(records),/DEPENDENCY_GROUP_TOO_LARGE/);
});

test('selection cannot split shared, embedded, company or profile dependency groups',()=>{
  const account={scope:'private-account',id:'a',data:{}},common={scope:'shared-vault-data',id:'s',data:{}},
    link={scope:'shared-vault-data-link',id:'l',sharedDataId:'s',data:{sharedDataId:'s',widgetId:'w',context:'private',accountId:'a'}},
    widget={scope:'private-account-widget',id:'w',accountId:'a',data:{kind:'shared-reference',sharedDataId:'s',linkId:'l',context:'private',accountId:'a'}};
  const shared=[account,common,link,widget];
  assert.deepEqual(validateRestoreSelection(shared,shared),shared);
  for(const selected of [[account],[common,link,widget],[account,common,link]])
    assert.throws(()=>validateRestoreSelection(shared,selected),/SELECTION_DEPENDENCY/);
  const embedded={scope:'private-account-widget',id:'e',accountId:'a',data:{kind:'embedded',context:'private',accountId:'a'}};
  assert.throws(()=>validateRestoreSelection([account,embedded],[embedded]),/SELECTION_DEPENDENCY/);
  const company={scope:'company',id:'c',data:{}},companyAccount={scope:'company-account',companyId:'c',id:'ca',data:{}};
  assert.throws(()=>validateRestoreSelection([company,companyAccount],[companyAccount]),/SELECTION_DEPENDENCY/);
  const profile={scope:'profile',id:uid,data:{}},deadline={scope:'deadline',id:'d',data:{sourceRef:{type:'profileDocument',id:'doc'}}};
  assert.throws(()=>validateRestoreSelection([profile,deadline],[deadline]),/SELECTION_DEPENDENCY/);
});

test('new multi-chunk plans put Account parents before children without modifying backup order',async()=>{
  const {chunkRestoreRecords}=await import(modelUrl);
  const children=Array.from({length:400},(_,index)=>({kind:'record',scope:'private-account-attachment',accountId:'a',id:`file${index}`,data:{synthetic:true}}));
  const parent={kind:'record',scope:'private-account',id:'a',data:{synthetic:true}};
  const original=[...children,parent],ordered=orderNewRestoreRecords(original);
  const chunks=chunkRestoreRecords(ordered);
  assert.equal(chunks.length,2);assert.equal(chunks[0][0].scope,'private-account');
  assert.equal(original[0],children[0]);assert.equal(original.at(-1),parent);
  assert.deepEqual(ordered.slice(1),children);
});
async function backup(entries = [{kind: 'record', scope: 'private-account', id: 'a', data: {synthetic: true}}]) {
  const recoveryKey = generateRecoveryKey(), header = createBackupHeader(uid), key = await deriveBackupKey(header, recoveryKey, uid);
  const lines = [JSON.stringify(header)]; let previousDigest = '';
  for (const [sequence, entry] of [...entries, {kind: 'footer', entryCount: entries.length,
    recordCount: entries.filter(entry => entry.kind === 'record').length,
    attachmentCount: entries.filter(entry => entry.kind === 'attachment').length}].entries()) {
    const result = await encryptBackupEntry({header, key, sequence, previousDigest, entry});
    previousDigest = result.digest; lines.push(JSON.stringify(result.envelope));
  }
  return {file: new Blob([lines.join('\n')]), recoveryKey, planId: 'plan', header};
}
test('security settings are excluded after authenticated reading and never sent to preview', async () => {
  const original = await backup([{kind: 'record', scope: 'settings', id: 'security', data: {verifier: 'synthetic-old'}},
    {kind: 'record', scope: 'private-account', id: 'a', data: {synthetic: true}}]);
  const abort = new AbortController(); let calls = 0;
  const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
    getUser: () => ({uid}), isOnline: () => true, submit: async request => {
      calls++;
      assert.equal(request.inputs.length, 1);
      assert.equal(request.inputs[0].records.length, 1);
      assert.equal(request.inputs[0].records[0].scope, 'private-account');
      return {chunks: [{previewVersion: 1, entries: [{index: 0, status: 'missing', expectedVersion: {exists: false}}]}]};
    }});
  const report = await source.previewNew(original);
  assert.equal(report.excludedSecuritySettings, 1);
  assert.equal(report.records, 1);
  assert.equal(calls, 1);
  source.dispose();
});

test('every unconnected shared component blocks preview before any server or staging call', async () => {
  const shared = [
    {kind: 'record', scope: 'shared-vault-data', id: 'shared', data: {synthetic: true}},
    {kind: 'record', scope: 'shared-vault-data-link', id: 'link', sharedDataId: 'shared',
      data: {sharedDataId: 'shared', widgetId: 'widget', context: 'private', accountId: 'a'}},
    {kind: 'record', scope: 'private-account-widget', id: 'widget', accountId: 'a',
      data: {kind: 'shared-reference', sharedDataId: 'shared', linkId: 'link', context: 'private', accountId: 'a'}}
  ];
  for (const entries of [...shared.map(record => [record]), [
    {kind: 'record', scope: 'private-account', id: 'a', data: {synthetic: true}}, ...shared
  ]]) {
    const original = await backup(entries);
    const abort = new AbortController(); let calls = 0;
    const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
      getUser: () => ({uid}), isOnline: () => true, submit: async () => {calls++;},
      attachmentPreparer: {dispose() {}, async prepare() {calls++;}}});
    await assert.rejects(source.previewNew(original), /RESUME_SCOPE_NOT_CONNECTED/);
    assert.equal(calls, 0);
    source.dispose();
  }
});

test('attachments require explicit staging before plan creation and never enter metadata requests', async () => {
  const storagePath = `users/${uid}/attachments/a`;
  const original = await backup([{kind: 'record', scope: 'private-account', id: 'a', data: {storagePath}},
    {kind: 'attachment', storagePath, content: 'AQI='}]);
  const abort = new AbortController(), calls = []; let retained, stages = 0;
  const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
    getUser: () => ({uid}), isOnline: () => true, attachmentPreparer: {dispose() {}, async prepare(data) {
      stages++; retained = data.bytes; assert.deepEqual([...retained], [1, 2]); return {stageId: 'a'.repeat(64)};
    }}, submit: async data => {
      calls.push(data);
      if (data.action === 'preview') return {chunks: [{previewVersion: 1, entries: [{index: 0, status: 'missing', expectedVersion: {exists: false}}]}]};
      return {planId: 'stage-plan', expiresAtMs: 3000};
    }});
  assert.deepEqual(await source.previewNew(original), {records: 1, chunks: 1, attachments: 1});
  assert.equal(stages, 0);
  await assert.rejects(source.create(), /STAGING_REQUIRED/);
  assert.deepEqual(await source.stageAttachments(), {staged: 1});
  assert.deepEqual([...retained], [0, 0]);
  await source.stageAttachments(); assert.equal(stages, 1);
  await source.create();
  assert.deepEqual(calls[1].stageCommands[0].stageIds, ['a'.repeat(64)]);
  assert.equal(Object.hasOwn(calls[1], 'attachments'), false);
  assert.equal(JSON.stringify(calls).includes('AQI='), false);
  source.dispose();
});

test('partial staging wipes confirmed bytes and retry uploads only the unfinished attachment', async () => {
  const paths = ['a', 'b'].map(id => `users/${uid}/attachments/${id}`);
  const original = await backup([
    ...paths.map((storagePath, index) => ({kind:'record', scope:'private-account', id:`a${index}`, data:{storagePath}})),
    ...paths.map(storagePath => ({kind:'attachment', storagePath, content:'AQI='}))]);
  const calls = [], retained = [], abort = new AbortController(); let fail = true;
  const source = createRestoreResumeSource({context:{user:{uid}, signal:abort.signal, assertUnlocked(){}},
    getUser:()=>({uid}), isOnline:()=>true, attachmentPreparer:{dispose(){}, async prepare(data) {
      calls.push(data.storagePath); retained.push(data.bytes);
      if (data.storagePath === paths[1] && fail) {fail = false; throw Error('lost');}
      return {stageId:(data.storagePath === paths[0] ? 'a' : 'b').repeat(64)};
    }}, submit:async data => {
      if(data.action === 'preview') return {chunks:[{previewVersion:1,entries:paths.map((_,index)=>
        ({index,status:'missing',expectedVersion:{exists:false}}))}]};
      return {planId:'partial',expiresAtMs:3000};
    }});
  await source.previewNew(original);
  await assert.rejects(source.stageAttachments(), /lost/);
  assert.deepEqual([...retained[0]], [0,0]);
  assert.deepEqual([...retained[1]], [1,2]);
  await assert.rejects(source.create(), /STAGING_REQUIRED/);
  await source.stageAttachments();
  assert.deepEqual(calls, [paths[0],paths[1],paths[1]]);
  assert.deepEqual([...retained[1]], [0,0]);
  await source.create(); source.dispose();
});

for (const boundary of ['lock','owner']) test(`failed upload bytes are wiped when ${boundary} is detected without abort`,async()=>{
  const storagePath=`users/${uid}/attachments/synthetic`;
  const original=await backup([{kind:'record',scope:'private-account',id:'a',data:{storagePath}},
    {kind:'attachment',storagePath,content:'AQI='}]);
  const abort=new AbortController();let locked=false,owner=uid,retained,disposed=0,uploads=0;
  const source=createRestoreResumeSource({context:{user:{uid},signal:abort.signal,assertUnlocked(){if(locked)throw Error('VAULT_LOCKED');}},
    getUser:()=>({uid:owner}),isOnline:()=>true,attachmentPreparer:{dispose(){disposed++;},async prepare(data){
      uploads++;retained=data.bytes;throw Error('UPLOAD_UNCONFIRMED');}},
    submit:async()=>({chunks:[{previewVersion:1,entries:[{index:0,status:'missing',expectedVersion:{exists:false}}]}]})});
  await source.previewNew(original);await assert.rejects(source.stageAttachments(),/UPLOAD_UNCONFIRMED/);
  assert.deepEqual([...retained],[1,2]);
  if(boundary==='lock')locked=true;else owner='other-synthetic';
  await assert.rejects(source.create(),/VAULT_LOCKED|VIEW_DISPOSED/);
  assert.deepEqual([...retained],[0,0]);assert.equal(disposed,1);
  locked=false;owner=uid;await assert.rejects(source.stageAttachments(),/VIEW_DISPOSED/);assert.equal(uploads,1);
  source.dispose();abort.abort();assert.equal(disposed,1);
});

test('prepare wipes attachment bytes if abort occurs in the final reader await gap',async t=>{
  const storagePath=`users/${uid}/attachments/synthetic-gap`;
  const original=await backup([{kind:'record',scope:'private-account',id:'a',data:{storagePath}},
    {kind:'attachment',storagePath,content:'AQI='}]);
  let readerChecks=0;
  const baseline=await readResumeBackup(original.file,original.recoveryKey,uid,()=>{readerChecks++;},true);
  for(const item of baseline.attachments)item.bytes.fill(0);
  const from=Uint8Array.from,captured=[];
  t.mock.method(Uint8Array,'from',function(...args){const result=from.apply(this,args);
    if(result.length===2&&result[0]===1&&result[1]===2)captured.push(result);return result;});
  const abort=new AbortController();let checks=0,requests=0;
  const source=createRestoreResumeSource({context:{user:{uid},signal:abort.signal,assertUnlocked(){}},
    getUser(){if(++checks===readerChecks+1)queueMicrotask(()=>abort.abort());return{uid};},
    isOnline:()=>true,attachmentPreparer:{dispose(){}},submit:async()=>{requests++;throw Error('UNEXPECTED');}});
  await assert.rejects(source.prepare(original),/VIEW_DISPOSED/);
  assert.equal(captured.length,1);assert.deepEqual([...captured[0]],[0,0]);assert.equal(requests,0);
});

test('explicit overwrite binds only selected records to original preview versions', async () => {
  const original=await backup(['a','b'].map(id=>({kind:'record',scope:'private-account',id,data:{synthetic:id}})));
  const abort=new AbortController(),calls=[],version={exists:true,updateTime:{seconds:100,nanoseconds:123000}};
  const source=createRestoreResumeSource({context:{user:{uid},signal:abort.signal,assertUnlocked(){}},getUser:()=>({uid}),isOnline:()=>true,
    submit:async data=>{calls.push(data);if(data.action==='preview')return {chunks:[{previewVersion:1,entries:[0,1].map(index=>
      ({index,status:'changed',expectedVersion:version}))}]};return {planId:'selected',expiresAtMs:3000};}});
  const report=await source.previewNew(original);assert.equal(report.choices.length,2);
  assert.throws(()=>source.selectMissingOnly(),/SELECTION_EMPTY/);
  for(const keys of [[],['0:2'],['0:0','0:0']])assert.throws(()=>source.selectRecords(keys,'RESTORE_SELECTED_OVERWRITE'),/SELECTION_INVALID/);
  assert.throws(()=>source.selectRecords(['0:1'],'RESTORE_VALIDATED'),/SELECTION_INVALID/);
  source.selectRecords(['0:1'],'RESTORE_SELECTED_OVERWRITE');await source.create();
  const input=calls[1].inputs[0];assert.equal(input.records.length,1);assert.equal(input.records[0].id,'b');
  assert.deepEqual(input.records[0].expectedVersion,version);assert.equal(input.overwriteExisting,true);
  assert.equal(input.confirmation,'RESTORE_SELECTED_OVERWRITE');source.dispose();
});

test('encrypted multi-chunk backup creates parent-first commands but reconstruct sends original order',async()=>{
  const records=[...Array.from({length:400},(_,index)=>({kind:'record',scope:'private-account-attachment',accountId:'a',id:`file${index}`,data:{synthetic:true}})),
    {kind:'record',scope:'private-account',id:'a',data:{synthetic:true}}];
  const original=await backup(records),abort=new AbortController(),calls=[];
  const source=createRestoreResumeSource({context:{user:{uid},signal:abort.signal,assertUnlocked(){}},getUser:()=>({uid}),isOnline:()=>true,
    submit:async data=>{
      calls.push(structuredClone(data));
      if(data.action==='preview')return {chunks:data.inputs.map(input=>({previewVersion:1,entries:input.records.map((_,index)=>({index,status:'missing',expectedVersion:{exists:false}}))}))};
      if(data.action==='create')return {planId:'multi',expiresAtMs:3000};
      if(data.action==='reconstruct') {
        assert.equal(data.records[0].scope,'private-account-attachment');assert.equal(data.records.at(-1).scope,'private-account');
        const created=calls.find(call=>call.action==='create');return {...created,expiresAtMs:3000};
      }
      if(data.action==='inspect')return {chunks:data.inputs.map(input=>({operationId:input.operationId,status:'unconfirmed'}))};
    }});
  assert.deepEqual(await source.previewNew(original),{records:401,chunks:2});
  await source.create();
  const created=calls.find(call=>call.action==='create');assert.equal(created.inputs[0].records[0].scope,'private-account');
  assert.equal(created.inputs[0].records.length,400);assert.equal(created.inputs[1].records.length,1);
  assert.deepEqual(await source.prepare({...original,planId:'multi'}),{expiresAtMs:3000,applied:0,total:2});source.dispose();
});

test('mixed backup requires explicit missing-only selection and excludes existing records from create', async () => {
  const original = await backup([{kind:'record',scope:'private-account',id:'existing',data:{synthetic:true}},
    {kind:'record',scope:'private-account',id:'missing',data:{synthetic:true}}]);
  const abort = new AbortController(), calls=[];
  const source=createRestoreResumeSource({context:{user:{uid},signal:abort.signal,assertUnlocked(){}},
    getUser:()=>({uid}),isOnline:()=>true,submit:async data=>{
      calls.push(data);
      if(data.action==='preview')return {chunks:[{previewVersion:1,entries:[{index:0,status:'changed',expectedVersion:{exists:true,updateTime:{seconds:100,nanoseconds:0}}},
        {index:1,status:'missing',expectedVersion:{exists:false}}]}]};
      return {planId:'selected',expiresAtMs:3000};
    }});
  assert.equal((await source.previewNew(original)).existing,1);
  await assert.rejects(source.create(),/SELECTION_REQUIRED/);
  assert.equal(calls.length,1);
  assert.deepEqual(source.selectMissingOnly(),{records:1,chunks:1,attachments:0});
  await source.create();
  assert.deepEqual(calls[1].inputs[0].records.map(record=>record.id),['missing']);
  assert.equal(calls[1].inputs[0].overwriteExisting,undefined);
  assert.equal(calls[1].inputs[0].chunkIndex,0);assert.equal(calls[1].inputs[0].chunkCount,1);source.dispose();
});

test('candidate reads authenticated original backup and rejects truncation, owner mismatch and unsupported scope', async () => {
  const contact=await backup([{kind:'record',scope:'contact',id:'c',data:{nome:'Synthetic',email:'contact@example.invalid',active:false}}]);
  const readContact=(await readResumeBackup(contact.file,contact.recoveryKey,uid,()=>{})).records[0];
  assert.equal(readContact.scope,'contact');assert.equal(readContact.data.active,false);
  const configs=await backup(['profileLabels','deadlineConfig','deadlineConfigDocuments','generalConfig'].map(id=>({kind:'record',scope:'settings',id,data:{synthetic:true}})));
  assert.equal((await readResumeBackup(configs.file,configs.recoveryKey,uid,()=>{})).records.length,4);
  const original = await backup();
  assert.equal((await readResumeBackup(original.file, original.recoveryKey, uid, () => {})).records.length, 1);
  await assert.rejects(readResumeBackup(original.file, original.recoveryKey, 'other', () => {}), /FORMAT_INVALID/);
  const text = await original.file.text();
  await assert.rejects(readResumeBackup(new Blob([text.slice(0, text.lastIndexOf('\n'))]), original.recoveryKey, uid, () => {}), /FOOTER_INVALID/);
  const profile = await backup([{kind: 'record', scope: 'profile', id: uid, data: {synthetic: true}}]);
  assert.equal((await readResumeBackup(profile.file, profile.recoveryKey, uid, () => {})).records[0].scope, 'profile');
  const unsupported = await backup([{kind: 'record', scope: 'shared-vault-data', id: 'c', data: {synthetic: true}}]);
  await assert.rejects(readResumeBackup(unsupported.file, unsupported.recoveryKey, uid, () => {}), /SCOPE_NOT_CONNECTED/);
  await assert.rejects(readResumeBackup({size: 17 * 1024 * 1024}, '', uid, () => {}), /SIZE_LIMIT/);
});
test('resume checks session, reconciles before enabling, retries exact commands and clears on lock', async () => {
  const original = await backup(), abort = new AbortController(), calls = []; let lose = true;
  const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
    getUser: () => ({uid}), isOnline: () => true, submit: async data => {
      calls.push(structuredClone(data));
      if (data.action === 'reconstruct') return {inputs: [{expectedOwnerUid: uid, backupId: original.header.backupId,
        operationId: 'original-operation', records: data.records}], stageCommands: [{}], expiresAtMs: 3000};
      if (data.action === 'inspect') return {chunks: [{operationId: 'original-operation', status: 'unconfirmed'}]};
      if (lose) {lose = false; throw Error('response-lost');}
      return {status: 'completed'};
    }});
  await assert.rejects(source.resume(), /BACKUP_REQUIRED/);
  assert.deepEqual(await source.prepare(original), {expiresAtMs: 3000, applied: 0, total: 1});
  await assert.rejects(source.resume(), /response-lost/);
  assert.equal((await source.resume()).status, 'completed');
  assert.deepEqual(calls[2], calls[3]);
  assert.equal(JSON.stringify(calls).includes(original.recoveryKey), false);
  abort.abort(); await assert.rejects(source.resume(), /VIEW_DISPOSED/);
});
test('cleanup source checks bounded response and does not send retention or record data', async () => {
  const abort = new AbortController(), calls = []; let malformed = false;
  const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
    getUser: () => ({uid}), isOnline: () => true, submit: async data => {calls.push(data);
      return {scanned: 2, removed: malformed ? 3 : 1, retained: 1, absent: 0, rejected: 0, next: null};}});
  assert.equal((await source.cleanupExpired()).removed, 1);
  assert.deepEqual(calls[0], {expectedOwnerUid: uid, action: 'cleanupExpired', after: null});
  malformed = true; await assert.rejects(source.cleanupExpired(), /RESPONSE_INVALID/);
  abort.abort(); await assert.rejects(source.cleanupExpired(), /VIEW_DISPOSED/);
});

test('lock during backup read prevents transmission', async () => {
  const original = await backup(), abort = new AbortController(); let sent = 0;
  const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
    getUser: () => ({uid}), isOnline: () => true, submit: async () => {sent++;}});
  const pending = source.prepare(original); abort.abort();
  await assert.rejects(pending, /VIEW_DISPOSED/); assert.equal(sent, 0);
});

test('new plan requires preview, creates once and keeps execution separately confirmed', async () => {
  const original = await backup(), abort = new AbortController(), calls = [];
  const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
    getUser: () => ({uid}), isOnline: () => true, submit: async data => {
      calls.push(structuredClone(data));
      if (data.action === 'preview') return {chunks: [{previewVersion: 1, entries: [{index: 0, status: 'missing', expectedVersion: {exists: false}}]}]};
      if (data.action === 'create') return {planId: 'server-plan', expiresAtMs: 3000};
      return {status: 'completed'};
    }});
  await assert.rejects(source.create(), /CREATION_UNAVAILABLE/);
  assert.deepEqual(await source.previewNew(original), {records: 1, chunks: 1});
  await assert.rejects(source.resume(), /BACKUP_REQUIRED/);
  assert.equal((await source.create()).planId, 'server-plan');
  assert.deepEqual(calls.map(call => call.action), ['preview', 'create']);
  await assert.rejects(source.create(), /CREATION_UNAVAILABLE/);
  await source.resume();
  assert.equal(calls[2].inputs[0].operationId, calls[0].inputs[0].operationId);
  assert.equal(calls[2].inputs[0].overwriteExisting, undefined); source.dispose();
});

test('collision and uncertain creation never trigger overwrite or duplicate creation', async () => {
  const original = await backup();
  for (const collision of [true, false]) {
    const abort = new AbortController(), actions = [];
    const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
      getUser: () => ({uid}), isOnline: () => true, submit: async data => {
        actions.push(data.action);
        if (data.action === 'preview') return {chunks: [{previewVersion: 1, entries: [{index: 0,
          status: collision ? 'changed' : 'missing', expectedVersion: collision ? {exists:true,updateTime:{seconds:100,nanoseconds:0}} : {exists:false}}]}]};
        throw Error('response-lost');
      }});
    if (collision) {await source.previewNew(original); await assert.rejects(source.create(), /SELECTION_REQUIRED/);}
    else {await source.previewNew(original); await assert.rejects(source.create(), /response-lost/);}
    await assert.rejects(source.create(), collision ? /SELECTION_REQUIRED/ : /CREATION_UNAVAILABLE/);
    await assert.rejects(source.resume(), /BACKUP_REQUIRED/);
    assert.deepEqual(actions, collision ? ['preview'] : ['preview', 'create']); source.dispose();
  }
});
test('lost creation can be recovered read-only before separately confirmed execution', async () => {
  const original = await backup(), abort = new AbortController(), actions = [];
  let found = false;
  const source = createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
    getUser: () => ({uid}), isOnline: () => true, submit: async data => {
      actions.push(data.action);
      if (data.action === 'preview') return {chunks: [{previewVersion: 1, entries: [{index: 0, status: 'missing', expectedVersion: {exists: false}}]}]};
      if (data.action === 'create') throw Error('lost');
      if (data.action === 'recoverCreation') return found ? {status: 'found', planId: 'original-plan', expiresAtMs: 3000} : {status: 'unconfirmed'};
      return {status: 'completed'};
    }});
  await source.previewNew(original); await assert.rejects(source.create(), /lost/);
  assert.equal((await source.recoverCreation()).status, 'unconfirmed');
  await assert.rejects(source.resume(), /BACKUP_REQUIRED/);
  found = true; assert.equal((await source.recoverCreation()).planId, 'original-plan');
  await source.resume(); assert.equal(actions.filter(action => action === 'create').length, 1);
  assert.equal(actions.at(-1), 'resume'); source.dispose();
});
