import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {createResumePlanLab} from './restore-resume-plan-lab.mjs';
import {createRestoreChunkLab} from './restore-chunk-lab.mjs';
import {createRestoreAccountFenceLab} from './restore-account-fence-lab.mjs';
import {enterExclusivePurge} from './purge-fence-model.mjs';
import {readFile} from 'node:fs/promises';
import {prepareResumePlan} from './restore-resume-plan.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex');

test('company restore refuses a missing linked Account and accepts it in the same chunk', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,writer=createRestoreChunkLab({store,projectId,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    const company={scope:'company',id:'c',expectedVersion:{exists:false},data:{nome:'Synthetic',emails:{pec:{email:'synthetic@example.invalid',linkedAccountId:'a',linkedAccountCompanyId:'c'}}}};
    const input={expectedOwnerUid:uid,operationId:'company',backupId:'backup',chunkIndex:0,chunkCount:1,mode:'apply',confirmation:'RESTORE_VALIDATED',records:[company]},stage={restoreOperationId:'restore',stageIds:[]};
    await assert.rejects(writer.commit(uid,input,stage),/PARENT_MISSING/);
    assert.equal((await store.collection(`labCandidateRecords/${uid}/items`).get()).size,0);
    input.records.push({scope:'company-account',companyId:'c',id:'a',data:{synthetic:true},expectedVersion:{exists:false}});
    assert.equal((await writer.commit(uid,input,stage)).status,'applied');
    assert.deepEqual((await store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/aziende/c`)}`).get()).data(),company.data);
  } finally {await store.terminate();await deleteApp(app);}
});

test('contact and known configuration restore together with exact receipt replay', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,writer=createRestoreChunkLab({store,projectId,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    const records=[{scope:'contact',id:'c',data:{nome:'Synthetic',email:'contact@example.invalid',active:false}},
      {scope:'settings',id:'profileLabels',data:{label:'Synthetic'}}].map(record=>({...record,expectedVersion:{exists:false}}));
    const input={expectedOwnerUid:uid,operationId:'contacts',backupId:'backup',chunkIndex:0,chunkCount:1,
      mode:'apply',confirmation:'RESTORE_VALIDATED',records},stage={restoreOperationId:'restore',stageIds:[]};
    assert.equal((await writer.commit(uid,input,stage)).status,'applied');
    for(const [index,path] of [`users/${uid}/contacts/c`,`users/${uid}/settings/profileLabels`].entries())
      assert.deepEqual((await store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`).get()).data(),records[index].data);
    assert.equal((await writer.commit(uid,input,stage)).duplicate,true);
  } finally {await store.terminate();await deleteApp(app);}
});

test('profile and linked deadline restore together; incomplete pair writes neither target', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,writer=createRestoreChunkLab({store,projectId,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    const profile={scope:'profile',id:uid,expectedVersion:{exists:false},data:{documenti:[{id:'doc',expiryReference:{deadlineId:'d'}}]}},
      deadline={scope:'deadline',id:'d',expectedVersion:{exists:false},data:{sourceRef:{type:'profileDocument',id:'doc'},recipients:[{email:'old@example.invalid',canManage:true}]}};
    const input={expectedOwnerUid:uid,operationId:'pair',backupId:'backup',chunkIndex:0,chunkCount:1,mode:'apply',confirmation:'RESTORE_VALIDATED',records:[profile]};
    const stage={restoreOperationId:'restore',stageIds:[]};
    await assert.rejects(writer.commit(uid,input,stage),/PAIR_INVALID/);
    assert.equal((await store.collection(`labCandidateRecords/${uid}/items`).get()).size,0);
    input.records=[profile,deadline];
    assert.equal((await writer.commit(uid,input,stage)).status,'applied');
    const saved=(await store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/scadenze/d`)}`).get()).data();
    assert.deepEqual(saved.recipients,[]);assert.equal(saved.sourceRef.id,'doc');
    assert.equal((await writer.commit(uid,input,stage)).duplicate,true);
  } finally {await store.terminate();await deleteApp(app);}
});

test('standalone deadline restore is private when absent and keeps live recipients on overwrite', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,target=store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/scadenze/d`)}`);
    const writer=createRestoreChunkLab({store,projectId,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    const stage={restoreOperationId:'restore',stageIds:[]};
    const input={expectedOwnerUid:uid,operationId:'create',backupId:'backup',chunkIndex:0,chunkCount:1,
      mode:'apply',confirmation:'RESTORE_VALIDATED',records:[{scope:'deadline',id:'d',expectedVersion:{exists:false},
        data:{title:'Synthetic',recipients:[{email:'old@example.invalid',canManage:true}],email1:'old@example.invalid'}}]};
    assert.equal((await writer.commit(uid,input,stage)).status,'applied');
    assert.deepEqual((await target.get()).data().recipients,[]);
    const recipients=[{email:'current@example.invalid',canManage:false,sendEmail:false}];
    await target.update({recipients,notif_frequency:21});
    const snap=await target.get();
    input.operationId='overwrite';input.overwriteExisting=true;input.confirmation='RESTORE_SELECTED_OVERWRITE';
    input.records[0].expectedVersion={exists:true,updateTime:{seconds:snap.updateTime.seconds,nanoseconds:snap.updateTime.nanoseconds}};
    assert.equal((await writer.commit(uid,input,stage)).status,'applied');
    const result=(await target.get()).data();
    assert.deepEqual(result.recipients,recipients);assert.equal(result.notif_frequency,21);
    assert.equal(result.email1,'');
  } finally {await store.terminate();await deleteApp(app);}
});

test('profile restore requires linked Account and preserves current biometric preference', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,path=`users/${uid}`;
    const target=store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`);
    await target.create({nome:'Before',settings_biometric:false});
    const snap=await target.get();
    const input={expectedOwnerUid:uid,operationId:'profile',backupId:'backup',chunkIndex:0,chunkCount:1,
      mode:'apply',overwriteExisting:true,confirmation:'RESTORE_SELECTED_OVERWRITE',records:[{scope:'profile',id:uid,
        data:{nome:'After',settings_biometric:true,contactEmails:[{linkedAccountId:'a'}]},
        expectedVersion:{exists:true,updateTime:{seconds:snap.updateTime.seconds,nanoseconds:snap.updateTime.nanoseconds}}}]};
    const writer=createRestoreChunkLab({store,projectId,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    const stage={restoreOperationId:'restore',stageIds:[]};
    await assert.rejects(writer.commit(uid,input,stage),/RESUME_PROFILE_PARENT_MISSING/);
    assert.ok((await target.get()).updateTime.isEqual(snap.updateTime));
    await store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/accounts/a`)}`).create({synthetic:true});
    assert.equal((await writer.commit(uid,input,stage)).status,'applied');
    const result=(await target.get()).data();
    assert.equal(result.nome,'After');assert.equal(result.settings_biometric,false);
    assert.deepEqual(result.contactEmails,[{linkedAccountId:'a'}]);
  } finally {await store.terminate();await deleteApp(app);}
});

test('legacy persisted invalid second chunk causes no new Firestore writes',{
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,inputs=[0,1].map(index=>({expectedOwnerUid:uid,operationId:`legacy-${index}`,backupId:'backup',
      chunkIndex:index,chunkCount:2,mode:'apply',confirmation:'RESTORE_VALIDATED',records:[{scope:'private-account',id:`a${index}`,
        expectedVersion:{exists:false},data:index?{at:{$type:'timestamp',seconds:1,nanoseconds:1}}:{synthetic:true}}]}));
    const stages=inputs.map(()=>({restoreOperationId:'restore',stageIds:[]}));
    const plan=prepareResumePlan(uid,'legacy',inputs,1000,stages),ref=store.doc(`labRestoreResumePlans/${uid}/items/${hash('legacy')}`);
    await ref.create(plan);const before=await ref.get();
    const writer=createRestoreChunkLab({store,projectId,now:()=>1000,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    await assert.rejects(writer.commitPlan(uid,'legacy',inputs,stages),/TIMESTAMP_PRECISION_UNSUPPORTED/);
    assert.equal((await store.collection(`labCandidateRecords/${uid}/items`).get()).size,0);
    assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,0);
    assert.ok((await ref.get()).updateTime.isEqual(before.updateTime));
  } finally {await store.terminate();await deleteApp(app);}
});

test('plan creation rejects a moved widget split from its old selected parent without saving a plan',{
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,options={store,projectId,now:()=>1000};
    const widget=store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/accountWidgets/w`)}`);
    const old=store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/accounts/old`)}`);
    await old.create({banking:[{bankId:'removed'}]});
    await widget.create({kind:'embedded',context:'private',accountId:'old',bankId:'removed'});
    const snapshot=await widget.get(),oldSnapshot=await old.get();
    const records=[{scope:'private-account',id:'old',data:{banking:[]},expectedVersion:{exists:true,
      updateTime:{seconds:oldSnapshot.updateTime.seconds,nanoseconds:oldSnapshot.updateTime.nanoseconds}}},
      {scope:'private-account',id:'new',data:{synthetic:true},expectedVersion:{exists:false}},
      {scope:'private-account-widget',accountId:'new',id:'w',data:{kind:'embedded',context:'private',accountId:'new'},
        expectedVersion:{exists:true,updateTime:{seconds:snapshot.updateTime.seconds,nanoseconds:snapshot.updateTime.nanoseconds}}}];
    const inputs=[[records[0]],records.slice(1)].map((records,chunkIndex)=>({expectedOwnerUid:uid,operationId:`split-${chunkIndex}`,backupId:'backup',
      chunkIndex,chunkCount:2,mode:'apply',overwriteExisting:true,confirmation:'RESTORE_SELECTED_OVERWRITE',records}));
    const stages=inputs.map(()=>({restoreOperationId:'restore',stageIds:[]}));
    await assert.rejects(createResumePlanLab(options).create(uid,inputs,stages),/DEPENDENCY_CROSS_CHUNK/);
    assert.equal((await store.collection(`labRestoreResumePlans/${uid}/items`).get()).size,0);
    assert.ok((await widget.get()).updateTime.isEqual(snapshot.updateTime));
    assert.ok((await old.get()).updateTime.isEqual(oldSnapshot.updateTime));
    const together=[{...inputs[0],chunkCount:1,records}];
    const plan=await createResumePlanLab(options).create(uid,together,[stages[0]]);
    const writer=createRestoreChunkLab({...options,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    assert.equal((await writer.commitPlan(uid,plan.planId,together,[stages[0]])).status,'completed');
    assert.equal((await widget.get()).data().accountId,'new');
  } finally {await store.terminate();await deleteApp(app);}
});

test('dependency chunking permits atomic Account and bank widget overwrite after a full preceding chunk',{
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const asModule=source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  let source=await readFile(new URL('./restore-resume-source.mjs',import.meta.url),'utf8');
  for(const name of ['backup-crypto','backup-import-model']) {
    const path=`../../Frontend/public/assets/js/modules/settings/${name}.js`;
    source=source.replace(path,asModule(await readFile(new URL(path,import.meta.url),'utf8')));
  }
  const {chunkNewRestoreRecords}=await import(asModule(source));
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,options={store,projectId,now:()=>1000};
    const ref=path=>store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`);
    const parent=ref(`users/${uid}/accounts/a`),widget=ref(`users/${uid}/accountWidgets/w`);
    await parent.create({banking:[{bankId:'old'}]});
    await widget.create({kind:'embedded',context:'private',accountId:'a',bankId:'old'});
    const version=async doc=>{const snapshot=await doc.get();return {exists:true,updateTime:{seconds:snapshot.updateTime.seconds,nanoseconds:snapshot.updateTime.nanoseconds}};};
    const records=[...Array.from({length:399},(_,index)=>({scope:'private-account',id:`other${index}`,data:{synthetic:true},expectedVersion:{exists:false}})),
      {scope:'private-account',id:'a',data:{banking:[{bankId:'new'}]},expectedVersion:await version(parent)},
      {scope:'private-account-widget',accountId:'a',id:'w',data:{kind:'embedded',context:'private',accountId:'a',bankId:'new'},expectedVersion:await version(widget)}];
    const chunks=chunkNewRestoreRecords(records);
    assert.deepEqual(chunks.map(chunk=>chunk.length),[399,2]);
    const inputs=chunks.map((records,chunkIndex)=>({expectedOwnerUid:uid,operationId:`chunk-${chunkIndex}`,backupId:'backup',
      chunkIndex,chunkCount:chunks.length,mode:'apply',overwriteExisting:true,confirmation:'RESTORE_SELECTED_OVERWRITE',records}));
    const stages=inputs.map(()=>({restoreOperationId:'restore',stageIds:[]}));
    const plan=await createResumePlanLab(options).create(uid,inputs,stages);
    const writer=createRestoreChunkLab({...options,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    assert.equal((await writer.commitPlan(uid,plan.planId,inputs,stages)).status,'completed');
    assert.equal((await parent.get()).data().banking[0].bankId,'new');
    assert.equal((await widget.get()).data().bankId,'new');
    assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,2);
  } finally {await store.terminate();await deleteApp(app);}
});

test('multi-chunk restore resumes after the parent chunk without rewriting completed records', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,options={store,projectId,now:()=>1000};
    const records=[{scope:'private-account',id:'a',data:{synthetic:true},expectedVersion:{exists:false}},
      ...Array.from({length:400},(_,index)=>({scope:'private-account-attachment',accountId:'a',id:`file${index}`,
        data:{synthetic:true},expectedVersion:{exists:false}}))];
    const inputs=[records.slice(0,400),records.slice(400)].map((records,chunkIndex)=>({expectedOwnerUid:uid,
      operationId:`chunk-${chunkIndex}`,backupId:'backup',chunkIndex,chunkCount:2,mode:'apply',confirmation:'RESTORE_VALIDATED',records}));
    const stages=inputs.map(()=>({restoreOperationId:'restore',stageIds:[]}));
    const plan=await createResumePlanLab(options).create(uid,inputs,stages);
    const writer=createRestoreChunkLab({...options,beforeChunkWrite:createRestoreAccountFenceLab(store)});
    await writer.commit(uid,inputs[0],stages[0],{planId:plan.planId,inputs,stageCommands:stages});
    const collection=store.collection(`labCandidateRecords/${uid}/items`),first=await collection.get();
    assert.equal(first.size,400);
    const originalOrder=[...records.slice(1),records[0]];
    const reopened=await createResumePlanLab(options).reconstruct(uid,plan.planId,'backup',originalOrder);
    assert.equal(reopened.inputs[0].records[0].scope,'private-account');
    assert.equal((await writer.commitPlan(uid,plan.planId,reopened.inputs,reopened.stageCommands)).status,'completed');
    const completed=await collection.get();assert.equal(completed.size,401);
    const versions=new Map(completed.docs.map(doc=>[doc.id,doc.updateTime]));
    for(const doc of first.docs)assert.ok(versions.get(doc.id).isEqual(doc.updateTime));
    assert.equal((await writer.commitPlan(uid,plan.planId,inputs,stages)).status,'completed');
    for(const doc of (await collection.get()).docs)assert.ok(versions.get(doc.id).isEqual(doc.updateTime));
    assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,2);
    assert.equal((await store.doc(`users/${uid}/accounts/a`).get()).exists,false);
  } finally {await store.terminate();await deleteApp(app);}
});

test('Account and widget changes compose atomically and concurrent restores cannot orphan a bank reference', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    for(const company of [false,true]) for(const mode of ['together','race']) {
      const uid=`synthetic-${randomUUID()}`,parent=`users/${uid}/${company?'aziende/c/':''}accounts/a`,widget=`users/${uid}/accountWidgets/w`;
      const ref=path=>store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`);
      const account={banking:[{bankId:'old'}]},identity={kind:'embedded',context:company?'company':'private',...(company?{companyId:'c'}:{}),accountId:'a'};
      await ref(parent).create(account);
      if(mode==='together')await ref(widget).create({...identity,bankId:'old'});
      const guard=createRestoreAccountFenceLab(store);
      const apply=records=>store.runTransaction(async tx=>{
        const snapshots=await Promise.all(records.map(record=>tx.get(ref(record.path))));
        const finish=await guard(tx,records,snapshots.map(snapshot=>snapshot.exists?snapshot.data():null));
        finish();for(const record of records)tx.set(ref(record.path),record.data);
      });
      if(mode==='together') {
        await apply([{path:parent,data:{banking:[{bankId:'new'}]}},{path:widget,data:{...identity,bankId:'new'}}]);
        assert.equal((await ref(widget).get()).data().bankId,'new');
        assert.equal((await ref(parent).get()).data().banking[0].bankId,'new');
      } else {
        const results=await Promise.allSettled([apply([{path:parent,data:{banking:[]}}]),apply([{path:widget,data:{...identity,bankId:'old'}}])]);
        assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
        assert.match(results.find(result=>result.status==='rejected').reason.message,/WIDGET_BANK_MISSING/);
        const savedWidget=await ref(widget).get(),savedAccount=(await ref(parent).get()).data();
        assert.ok(!savedWidget.exists||savedAccount.banking.some(bank=>bank.bankId===savedWidget.data().bankId));
      }
    }
  } finally {await store.terminate();await deleteApp(app);}
});

test('Account overwrite refuses to orphan existing bank widgets', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    for(const company of [false,true]) {
      const uid=`synthetic-${randomUUID()}`,path=`users/${uid}/${company?'aziende/c/':''}accounts/a`;
      const target=store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`);
      await target.create({banking:[{bankId:'bank',cards:[]}]});
      const original=await target.get(),widget=store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/accountWidgets/w`)}`);
      await widget.create({kind:'embedded',context:company?'company':'private',...(company?{companyId:'c'}:{}),accountId:'a',bankId:'bank'});
      const inputs=[{expectedOwnerUid:uid,operationId:'account',backupId:'backup',chunkIndex:0,chunkCount:1,mode:'apply',
        overwriteExisting:true,confirmation:'RESTORE_SELECTED_OVERWRITE',records:[{scope:company?'company-account':'private-account',
          ...(company?{companyId:'c'}:{}),id:'a',data:{banking:[]},expectedVersion:{exists:true,updateTime:{seconds:original.updateTime.seconds,nanoseconds:original.updateTime.nanoseconds}}}]}];
      const stages=[{restoreOperationId:'restore',stageIds:[]}],options={store,projectId,now:()=>1000};
      const plan=await createResumePlanLab(options).create(uid,inputs,stages);
      const writer=createRestoreChunkLab({...options,beforeChunkWrite:createRestoreAccountFenceLab(store)});
      await assert.rejects(writer.commitPlan(uid,plan.planId,inputs,stages),/WIDGET_BANK_MISSING/);
      assert.ok((await target.get()).updateTime.isEqual(original.updateTime));
      assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,0);
      await widget.update({bankId:null});
      assert.equal((await writer.commitPlan(uid,plan.planId,inputs,stages)).status,'completed');
    }
  } finally {await store.terminate();await deleteApp(app);}
});

test('attachment-only restore cannot create an orphan and leaves no receipt on rejection', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    for(const company of [false,true]) {
      const uid=`synthetic-${randomUUID()}`,parent=`users/${uid}/${company?'aziende/c/':''}accounts/a`;
      const inputs=[{expectedOwnerUid:uid,operationId:'attachment',backupId:'backup',chunkIndex:0,chunkCount:1,mode:'apply',
        confirmation:'RESTORE_VALIDATED',records:[{scope:company?'company-account-attachment':'private-account-attachment',
          ...(company?{companyId:'c'}:{}),accountId:'a',id:'file',data:{synthetic:true},expectedVersion:{exists:false}}]}];
      const stages=[{restoreOperationId:'restore',stageIds:[]}],options={store,projectId,now:()=>1000};
      await assert.rejects(createResumePlanLab(options).create(uid,inputs,stages),/ATTACHMENT_PARENT_MISSING/);
      assert.equal((await store.collection(`labRestoreResumePlans/${uid}/items`).get()).size,0);
      // Retain coverage of pre-existing plans created before the new guard.
      const plan=prepareResumePlan(uid,'legacy-orphan',inputs,1000,stages);
      await store.doc(`labRestoreResumePlans/${uid}/items/${hash(plan.planId)}`).create(plan);
      const writer=createRestoreChunkLab({...options,beforeChunkWrite:createRestoreAccountFenceLab(store)});
      await assert.rejects(writer.commitPlan(uid,plan.planId,inputs,stages),/ATTACHMENT_PARENT_MISSING/);
      assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,0);
      assert.equal((await store.doc(`labCandidateRecords/${uid}/items/${hash(`${parent}/attachments/file`)}`).get()).exists,false);
      await store.doc(`labCandidateRecords/${uid}/items/${hash(parent)}`).create({synthetic:true});
      assert.equal((await writer.commitPlan(uid,plan.planId,inputs,stages)).status,'completed');
    }
  } finally {await store.terminate();await deleteApp(app);}
});

test('embedded widget restore fences both parents and rejects missing parent or bank', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    for(const blocked of ['none','old','new','missing','bank']) {
      const uid=`synthetic-${randomUUID()}`,old=`users/${uid}/accounts/old`,next=`users/${uid}/aziende/c/accounts/new`;
      const path=`users/${uid}/accountWidgets/w`,target=store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`);
      await target.create({kind:'embedded',context:'private',accountId:'old',synthetic:'before'});
      const original=await target.get();
      if(blocked!=='missing')await store.doc(`labCandidateRecords/${uid}/items/${hash(next)}`).create({synthetic:true});
      for(const [name,parent] of [['old',old],['new',next]])await store.doc(`labPurgeStates/${hash(parent)}`).create({fence:{phase:blocked===name?'exclusive':'prepared',revision:2,operationId:'purge'}});
      const data={kind:'embedded',context:'company',companyId:'c',accountId:'new',synthetic:'after',...(blocked==='bank'?{bankId:'missing'}:{})};
      const inputs=[{expectedOwnerUid:uid,operationId:'widget',backupId:'backup',chunkIndex:0,chunkCount:1,mode:'apply',
        overwriteExisting:true,confirmation:'RESTORE_SELECTED_OVERWRITE',records:[{scope:'company-account-widget',companyId:'c',accountId:'new',id:'w',data,
          expectedVersion:{exists:true,updateTime:{seconds:original.updateTime.seconds,nanoseconds:original.updateTime.nanoseconds}}}]}];
      const stages=[{restoreOperationId:'restore',stageIds:[]}],options={store,projectId,now:()=>1000};
      let plan;
      if (blocked==='missing' || blocked==='bank') {
        await assert.rejects(createResumePlanLab(options).create(uid,inputs,stages),
          blocked==='missing' ? /WIDGET_PARENT_MISSING/ : /WIDGET_BANK_MISSING/);
        assert.equal((await store.collection(`labRestoreResumePlans/${uid}/items`).get()).size,0);
        plan=prepareResumePlan(uid,'legacy-widget',inputs,1000,stages);
        await store.doc(`labRestoreResumePlans/${uid}/items/${hash(plan.planId)}`).create(plan);
      } else plan=await createResumePlanLab(options).create(uid,inputs,stages);
      const writer=createRestoreChunkLab({...options,beforeChunkWrite:createRestoreAccountFenceLab(store)});
      if(blocked==='none') {
        assert.equal((await writer.commitPlan(uid,plan.planId,inputs,stages)).status,'completed');
        for(const parent of [old,next])assert.equal((await store.doc(`labPurgeStates/${hash(parent)}`).get()).data().fence.revision,3);
        assert.equal((await target.get()).data().accountId,'new');
      } else {
        await assert.rejects(writer.commitPlan(uid,plan.planId,inputs,stages),/FENCE_BUSY|PARENT_MISSING|BANK_MISSING/);
        assert.ok((await target.get()).updateTime.isEqual(original.updateTime));
        assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,0);
      }
    }
  }finally{await store.terminate();await deleteApp(app);}
});

test('shared restore group commits atomically and rejects collision, stale CAS and broken reciprocity', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const projectId='demo-vault-shell',app=initializeApp({projectId},randomUUID()),store=getFirestore(app);
  try {
    for(const scenario of ['applied','collision','stale','broken']) {
      const uid=`synthetic-${randomUUID()}`,accountPath=`users/${uid}/accounts/a`;
      const records=[
        {scope:'private-account',id:'a',data:{synthetic:'account'}},
        {scope:'shared-vault-data',id:'s',data:{title:'Synthetic'}},
        {scope:'shared-vault-data-link',id:'l',sharedDataId:'s',data:{sharedDataId:'s',widgetId:'w',context:'private',accountId:'a'}},
        {scope:'private-account-widget',id:'w',accountId:'a',data:{kind:'shared-reference',sharedDataId:'s',linkId:'l',context:'private',accountId:'a'}}
      ];
      if(scenario==='broken')records[2].data.widgetId='other';
      const paths=[accountPath,`users/${uid}/sharedVaultData/s`,`users/${uid}/sharedVaultLinks/l`,`users/${uid}/accountWidgets/w`];
      if(scenario==='collision')await store.doc(`labCandidateRecords/${uid}/items/${hash(paths[1])}`).create({title:'Current'});
      const commands=[{expectedOwnerUid:uid,operationId:'shared',backupId:'backup',chunkIndex:0,chunkCount:1,mode:'apply',
        confirmation:'RESTORE_VALIDATED',records:records.map(record=>({...record,expectedVersion:{exists:false}}))}];
      const stages=[{restoreOperationId:'restore',stageIds:[]}],options={store,projectId,now:()=>1000};
      if(scenario==='broken') {
        await assert.rejects(createResumePlanLab(options).create(uid,commands,stages),/SCOPE_FENCE_NOT_CONNECTED/);
        assert.equal((await store.collection(`labRestoreResumePlans/${uid}/items`).get()).size,0);
        continue;
      }
      const plan=await createResumePlanLab(options).create(uid,commands,stages).catch(error=>{
        if(scenario==='collision'&&/NEW_PREVIEW_REQUIRED/.test(error.message))return null;throw error;
      });
      if(scenario==='collision') {
        assert.equal(plan,null);
        assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,0);
        continue;
      }
      if(scenario==='stale')await store.doc(`labCandidateRecords/${uid}/items/${hash(paths[1])}`).create({title:'Concurrent'});
      await store.doc(`labPurgeStates/${hash(accountPath)}`).create({fence:{phase:'prepared',revision:2,operationId:'purge'}});
      const writer=createRestoreChunkLab({...options,beforeChunkWrite:createRestoreAccountFenceLab(store)});
      const result=await writer.commitPlan(uid,plan.planId,commands,stages);
      if(scenario==='stale') {
        assert.equal(result.status,'stopped');assert.equal(result.results[0].status,'stale-preview');
        assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,0);
        for(const path of paths.filter(path=>!path.endsWith('/sharedVaultData/s')))
          assert.equal((await store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`).get()).exists,false);
      } else {
        assert.equal(result.status,'completed');
        for(const path of paths)assert.equal((await store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`).get()).exists,true);
        assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size,1);
        assert.deepEqual((await store.doc(`labPurgeStates/${hash(accountPath)}`).get()).data(),
          {fence:{phase:'idle',revision:3,operationId:null}});
      }
    }
  }finally{await store.terminate();await deleteApp(app);}
});

test('restore Account chunk and purge claim share one atomic boundary', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000
}, async () => {
  const projectId = 'demo-vault-shell', app = initializeApp({projectId}, randomUUID()), store = getFirestore(app);
  try {
    for (const scenario of ['prepared', 'exclusive', 'history', 'race']) {
      const uid = `synthetic-${randomUUID()}`;
      const records = [{scope: 'private-account', id: 'a'}, {scope: 'company-account', companyId: 'c', id: 'b'},
        {scope: 'private-account-attachment', accountId: 'a', id: 'file'},
        {scope: 'company-account-attachment', companyId: 'c', accountId: 'b', id: 'file'}]
        .map(record => ({...record, expectedVersion: {exists: false}, data: {synthetic: scenario}}));
      const commands = [{expectedOwnerUid: uid, operationId: 'chunk', backupId: 'backup', chunkIndex: 0,
        chunkCount: 1, mode: 'apply', confirmation: 'RESTORE_VALIDATED', records}];
      const stages = [{restoreOperationId: 'restore', stageIds: []}];
      const options = {store, projectId, now: () => 1000};
      const plan = await createResumePlanLab(options).create(uid, commands, stages);
      const paths = [`users/${uid}/accounts/a`, `users/${uid}/aziende/c/accounts/b`];
      const allPaths = [...paths, ...paths.map(path => `${path}/attachments/file`)];
      const fences = paths.map(path => store.doc(`labPurgeStates/${hash(path)}`));
      const prepared = {phase: 'prepared', revision: 2, operationId: 'purge'};
      await fences[0].create({fence: prepared});
      await fences[1].create(scenario === 'history' ? {fence: prepared, sequence: {outcomes: ['preserve']}} :
        {fence: {...prepared, phase: scenario === 'exclusive' ? 'exclusive' : 'prepared'}});
      const writer = createRestoreChunkLab({...options, beforeChunkWrite: createRestoreAccountFenceLab(store)});
      const run = () => writer.commitPlan(uid, plan.planId, commands, stages);
      let applied = false;
      if (scenario === 'race') {
        const results = await Promise.allSettled([run(), store.runTransaction(async tx => {
          const state = (await tx.get(fences[1])).data();
          tx.set(fences[1], {fence: enterExclusivePurge(state.fence, prepared)});
        })]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        applied = results[0].status === 'fulfilled';
        assert.match(results[applied ? 1 : 0].reason.message, /FENCE_BUSY|FENCE_CONFLICT/);
      } else if (scenario === 'prepared') {
        assert.equal((await run()).status, 'completed'); applied = true;
        const snapshot = await fences[0].get();
        assert.equal((await run()).results[0].duplicate, true);
        assert.ok((await fences[0].get()).updateTime.isEqual(snapshot.updateTime));
      } else await assert.rejects(run(), /FENCE_BUSY|PURGE_WRITE_BLOCKED/);
      for (const path of allPaths) assert.equal((await store.doc(`labCandidateRecords/${uid}/items/${hash(path)}`).get()).exists, applied);
      assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size, applied ? 1 : 0);
      assert.deepEqual((await fences[0].get()).data(), {fence: applied ? {phase: 'idle', revision: 3, operationId: null} : prepared});
      if (scenario === 'history') assert.deepEqual((await fences[1].get()).data().sequence, {outcomes: ['preserve']});
      for (const path of allPaths) assert.equal((await store.doc(path).get()).exists, false);
    }
    const guard = createRestoreAccountFenceLab(store);
    await assert.rejects(guard({}, [{path: 'users/synthetic/sharedVaultLinks/link'}]), /SCOPE_FENCE_NOT_CONNECTED/);
  } finally {await store.terminate(); await deleteApp(app);}
});
