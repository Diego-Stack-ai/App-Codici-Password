import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {createPurgeReferenceInventoryLab} from './purge-reference-inventory-lab.mjs';
import {createAccountWriteFenceLab} from './account-write-fence-lab.mjs';
import {enterExclusivePurge} from './purge-fence-model.mjs';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getFirestore}=require('firebase-admin/firestore');

test('prepared cancellation is atomic against claim and cannot cancel a later operation or exclusive history', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const app=initializeApp({projectId:'demo-vault-shell'},randomUUID()),db=getFirestore(app);
  try {
    for(const mode of ['cancel','claim','race','history']) {
      const uid=`synthetic-${randomUUID()}`,account=db.doc(`users/${uid}/accounts/a`);
      await account.create({revision:1,isArchived:true,synthetic:'preserved'});
      const before=await account.get();
      const request={uid,command:{context:'private',accountId:'a',operationId:'cancel-test',expectedRevision:1,confirmation:'DELETE_FOREVER'},writeBudget:20};
      const run=createPurgeReferenceInventoryLab(db),preview=await run(request);
      const prepared=await run.prepare(request,preview.planHash);
      const ref=db.doc(`labPurgeStates/${createHash('sha256').update(account.path).digest('hex')}`);
      const beforeBadClaim=await ref.get();
      for(const expected of [{phase:'prepared',revision:prepared.fence.revision,operationId:prepared.fence.operationId},
        {...prepared.fence,previewHash:'0'.repeat(64)}]) {
        await assert.rejects(db.runTransaction(async tx=>{
          const snapshot=await tx.get(ref);
          tx.set(ref,{fence:enterExclusivePurge(snapshot.data().fence,expected)});
        }),/FENCE_CONFLICT/);
        assert.ok((await ref.get()).updateTime.isEqual(beforeBadClaim.updateTime));
      }
      const claim=()=>db.runTransaction(async tx=>{
        const snapshot=await tx.get(ref),fence=enterExclusivePurge(snapshot.data().fence,prepared.fence);
        tx.set(ref,{fence});return fence;
      });
      if(mode==='cancel') {
        const saved=await ref.get();
        await assert.rejects(run.cancelPrepared(request,{...prepared.fence,previewHash:'0'.repeat(64)}),/FENCE_CONFLICT/);
        assert.ok((await ref.get()).updateTime.isEqual(saved.updateTime));
        const result=await run.cancelPrepared(request,prepared.fence);
        assert.equal(result.status,'cancelled-before-effects');assert.equal(result.destructiveAllowed,false);
        await assert.rejects(claim(),/FENCE_CONFLICT/);
        const next=await run.prepare(request,preview.planHash),nextSnapshot=await ref.get();
        assert.ok(next.fence.revision>prepared.fence.revision);
        await assert.rejects(run.cancelPrepared(request,prepared.fence),/FENCE_CONFLICT/);
        assert.ok((await ref.get()).updateTime.isEqual(nextSnapshot.updateTime));
      } else if(mode==='claim') {
        await claim();const saved=await ref.get();
        await assert.rejects(run.cancelPrepared(request,prepared.fence),/WRITE_BLOCKED|FENCE_CONFLICT/);
        assert.ok((await ref.get()).updateTime.isEqual(saved.updateTime));
      } else if(mode==='history') {
        await ref.update({sequence:{outcomes:['unknown']}});const saved=await ref.get();
        await assert.rejects(run.cancelPrepared(request,prepared.fence),/WRITE_BLOCKED/);
        assert.ok((await ref.get()).updateTime.isEqual(saved.updateTime));
      } else {
        const results=await Promise.allSettled([run.cancelPrepared(request,prepared.fence),claim()]);
        assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
        const state=(await ref.get()).data();
        assert.ok(['idle','exclusive'].includes(state.fence.phase));
        assert.equal(state.fence.revision,prepared.fence.revision+1);
      }
      assert.ok((await account.get()).updateTime.isEqual(before.updateTime));
    }
  } finally {await db.terminate();await deleteApp(app);}
});

test('writer survives cancellation contention and stale cancellation cannot invalidate a subsequent preview', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const app=initializeApp({projectId:'demo-vault-shell'},randomUUID()),db=getFirestore(app);
  try {
    for(const order of ['write-first','cancel-first','concurrent']) {
      const uid=`synthetic-${randomUUID()}`,account=db.doc(`users/${uid}/accounts/a`);
      await account.create({revision:1,isArchived:true});
      const request={uid,command:{context:'private',accountId:'a',operationId:'same-operation',expectedRevision:1,confirmation:'DELETE_FOREVER'},writeBudget:20};
      const run=createPurgeReferenceInventoryLab(db),preview=await run(request),prepared=await run.prepare(request,preview.planHash);
      const write=()=>db.runTransaction(async tx=>{
        const finish=await createAccountWriteFenceLab(db)(tx,account);
        finish();tx.update(account,{revision:2,synthetic:'writer-preserved'});
      });
      if(order==='write-first') {
        await write();await assert.rejects(run.cancelPrepared(request,prepared.fence),/WRITE_BLOCKED|FENCE_CONFLICT/);
      } else if(order==='cancel-first') {
        await run.cancelPrepared(request,prepared.fence);await write();
      } else {
        const [writer,cancel]=await Promise.allSettled([write(),run.cancelPrepared(request,prepared.fence)]);
        assert.equal(writer.status,'fulfilled');
        if(cancel.status==='rejected')assert.match(cancel.reason.message,/WRITE_BLOCKED|FENCE_CONFLICT/);
      }
      const saved=await account.get();assert.equal(saved.data().revision,2);assert.equal(saved.data().synthetic,'writer-preserved');
      const state=db.doc(`labPurgeStates/${createHash('sha256').update(account.path).digest('hex')}`);
      assert.equal((await state.get()).data().fence.phase,'idle');
      const nextRequest={...request,command:{...request.command,expectedRevision:2}};
      const nextPreview=await run(nextRequest),next=await run.prepare(nextRequest,nextPreview.planHash),before=await state.get();
      assert.ok(next.fence.revision>prepared.fence.revision);
      await assert.rejects(run.cancelPrepared(nextRequest,prepared.fence),/FENCE_CONFLICT/);
      assert.ok((await state.get()).updateTime.isEqual(before.updateTime));
      assert.ok((await account.get()).updateTime.isEqual(saved.updateTime));
    }
  } finally {await db.terminate();await deleteApp(app);}
});

test('writer refuses unknown inner fence metadata without discarding it or changing the Account', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const app=initializeApp({projectId:'demo-vault-shell'},randomUUID()),db=getFirestore(app);
  try {
    for(const extra of [{sequence:{outcome:'unknown'}},{stopRequested:true},{previewHash:'invalid'}]) {
      const uid=`synthetic-${randomUUID()}`,account=db.doc(`users/${uid}/accounts/a`);
      await account.create({revision:1,isArchived:true});
      const ref=db.doc(`labPurgeStates/${createHash('sha256').update(account.path).digest('hex')}`);
      await ref.create({fence:{phase:'idle',revision:2,operationId:null,...extra}});
      const before=await ref.get(),target=await account.get();
      await assert.rejects(db.runTransaction(async tx=>{
        const finish=await createAccountWriteFenceLab(db)(tx,account);finish();tx.update(account,{revision:2});
      }),/FENCE_STATE/);
      assert.ok((await ref.get()).updateTime.isEqual(before.updateTime));
      assert.ok((await account.get()).updateTime.isEqual(target.updateTime));
    }
  } finally {await db.terminate();await deleteApp(app);}
});

test('profile inventory covers documents utilities email extras and all company phone slots without rewriting them',{
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const app=initializeApp({projectId:'demo-vault-shell'},randomUUID()),db=getFirestore(app);
  try {
    const uid=`synthetic-${randomUUID()}`,root=`users/${uid}`,link={linkedAccountId:'a',linkedAccountCompanyId:'target'};
    await db.doc(`${root}/aziende/target/accounts/a`).create({revision:1,isArchived:true});
    const privateData={documenti:[{id:'d',...link}],userAddresses:[{id:'address',utilities:[{id:'u',...link}]}]};
    await db.doc(root).create(privateData);
    const sources={extra:{emails:{extra:[{id:'e',...link}]}},pec:{emails:{pec:{...link}}},
      amministrazione:{emails:{amministrazione:{...link}}},personale:{emails:{personale:{...link}}},
      telefono:{phoneAccountLinks:{telefonoAzienda:{...link}}},fax:{phoneAccountLinks:{faxAzienda:{...link}}},
      referente:{phoneAccountLinks:{referenteCellulare:{...link}}},unrelated:{emails:{pec:{...link,linkedAccountCompanyId:'other'}}}};
    for(const [id,data] of Object.entries(sources))await db.doc(`${root}/aziende/${id}`).create(data);
    const request={uid,command:{context:'company',companyId:'target',accountId:'a',operationId:'inventory',expectedRevision:1,confirmation:'DELETE_FOREVER'},writeBudget:20};
    const result=await createPurgeReferenceInventoryLab(db)(request);
    assert.equal(result.valid,true);assert.equal(result.profileReferencePaths.length,8);
    assert.ok(!result.profileReferencePaths.includes(`${root}/aziende/unrelated`));
    assert.equal(result.plannedWriteCount,8);
    assert.deepEqual((await db.doc(root).get()).data(),privateData);
    for(const [id,data] of Object.entries(sources))assert.deepEqual((await db.doc(`${root}/aziende/${id}`).get()).data(),data);
  } finally {await db.terminate();await deleteApp(app);}
});

test('verified preparation rejects edits and new references after preview without creating a fence',{
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const app=initializeApp({projectId:'demo-vault-shell'},randomUUID()),db=getFirestore(app);
  try {
    for(const change of ['account','new-widget','profile','none']) {
      const uid=`synthetic-${randomUUID()}`,root=`users/${uid}`,account=db.doc(`${root}/accounts/a`);
      await account.create({revision:1,isArchived:true});
      await db.doc(root).create({contactPhones:[{linkedAccountId:'a',number:'synthetic-before'}]});
      const request={uid,command:{context:'private',accountId:'a',operationId:'new',expectedRevision:1,confirmation:'DELETE_FOREVER'},writeBudget:20};
      const run=createPurgeReferenceInventoryLab(db),preview=await run(request);
      assert.equal((await run(request)).planHash,preview.planHash);
      if(change==='account')await account.update({synthetic:'after'});
      if(change==='new-widget')await db.doc(`${root}/accountWidgets/w`).create({kind:'embedded',context:'private',accountId:'a'});
      if(change==='profile')await db.doc(root).update({contactPhones:[{linkedAccountId:'a',number:'synthetic-after'}]});
      if(change==='none') {
        const results=await Promise.all([run.prepareVerified(request,preview.planHash),run.prepareVerified(request,preview.planHash)]);
        assert.equal(results.filter(result=>result.duplicate).length,1);
        assert.equal(results[0].fence.phase,'prepared');
        const stateRef=db.doc(`labPurgeStates/${createHash('sha256').update(account.path).digest('hex')}`);
        const before=await stateRef.get();
        assert.equal((await run.prepareVerified(request,preview.planHash)).duplicate,true);
        assert.ok((await stateRef.get()).updateTime.isEqual(before.updateTime));
        await db.runTransaction(async tx=>{const finish=await createAccountWriteFenceLab(db)(tx,account);finish();tx.update(account,{revision:2});});
        await assert.rejects(run.prepareVerified(request,preview.planHash),/VERSION_CONFLICT/);
        assert.equal((await stateRef.get()).data().fence.phase,'idle');
        assert.equal((await stateRef.get()).data().fence.previewHash,undefined);
      }
      else await assert.rejects(run.prepareVerified(request,preview.planHash),/PREVIEW_STALE/);
      const state=await db.doc(`labPurgeStates/${createHash('sha256').update(account.path).digest('hex')}`).get();
      assert.equal(state.exists,change==='none');
      assert.equal((await account.get()).exists,true);
    }
  } finally {await db.terminate();await deleteApp(app);}
});

test('preparation failures never create a fence or replace exclusive history',{
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const app=initializeApp({projectId:'demo-vault-shell'},randomUUID()),db=getFirestore(app);
  try {
    for(const mode of ['active','stale','malformed-profile','budget','history']) {
      const uid=`synthetic-${randomUUID()}`,path=`users/${uid}/accounts/a`;
      const account=db.doc(path),state=db.doc(`labPurgeStates/${createHash('sha256').update(path).digest('hex')}`);
      await account.create({revision:1,isArchived:mode!=='active'});
      if(mode==='malformed-profile')await db.doc(`users/${uid}`).create({contactPhones:'invalid'});
      if(mode==='budget')await db.doc(`users/${uid}/accountWidgets/w`).create({context:'private',accountId:'a',kind:'embedded'});
      const history={fence:{phase:'exclusive',revision:7,operationId:'earlier'},sequence:{outcomes:['unknown']}};
      if(mode==='history')await state.create(history);
      const request={uid,command:{context:'private',accountId:'a',operationId:'new',expectedRevision:mode==='stale'?2:1,confirmation:'DELETE_FOREVER'},writeBudget:mode==='budget'?0:20};
      const codes={active:/NOT_ARCHIVED/,stale:/VERSION_CONFLICT/,'malformed-profile':/SHAPE_UNSUPPORTED/,budget:/INVENTORY_INVALID/,history:/WRITE_BLOCKED/};
      const run=createPurgeReferenceInventoryLab(db);
      const hash=['stale','malformed-profile'].includes(mode)?'0'.repeat(64):(await run(request)).planHash;
      await assert.rejects(run.prepare(request,hash),codes[mode]);
      const after=await state.get();
      if(mode==='history')assert.deepEqual(after.data(),history);else assert.equal(after.exists,false);
      assert.equal((await account.get()).data().revision,1);
    }
  } finally {await db.terminate();await deleteApp(app);}
});

test('SDK inventory detects foreign incoming references and overflow without deleting targets',{
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const app=initializeApp({projectId:'demo-vault-shell'},randomUUID()),db=getFirestore(app);
  try {
    for(const context of ['private','company']) {
      const uid=`synthetic-${randomUUID()}`,root=`users/${uid}`;
      const account=db.doc(`${root}/${context==='company'?'aziende/c/':''}accounts/a`);
      await account.create({revision:1,isArchived:true});
      const file=account.collection('attachments').doc('file');
      await file.create({storagePath:`${account.path}/attachments/blob`,ciphertext:'SYNTHETIC'});
      const link={linkedAccountId:'a',linkedAccountCompanyId:context==='company'?'c':''};
      await db.doc(root).create({contactPhones:[{number:'SYNTHETIC',...link}]});
      await db.doc(`${root}/aziende/origin`).create({emails:{pec:{email:'SYNTHETIC',...link}}});
      const identity={context,accountId:'a',...(context==='company'?{companyId:'c'}:{})};
      await db.doc(`${root}/accountWidgets/w`).create({...identity,kind:'shared-reference',sharedDataId:'s',linkId:'l'});
      await db.doc(`${root}/sharedVaultLinks/l`).create({...identity,sharedDataId:'s',widgetId:'w'});
      await db.doc(`${root}/sharedVaultData/s`).create({revision:1,ciphertext:'SYNTHETIC'});
      const request={uid,command:{...identity,operationId:'p',expectedRevision:1,confirmation:'DELETE_FOREVER'},writeBudget:20};
      const run=createPurgeReferenceInventoryLab(db,{limit:2});
      let result=await run(request);
      assert.equal(result.valid,true);assert.equal(result.applicable,false);
      assert.equal(result.deletePaths.length,2);assert.equal(result.revisionTouches.length,1);
      assert.deepEqual(result.profileReferencePaths,[root,`${root}/aziende/origin`]);
      assert.equal(result.plannedWriteCount,6);
      assert.equal(result.expectedDocuments.length,7);
      for(const expected of result.expectedDocuments) {
        const actual=(await db.doc(expected.path).get()).updateTime;
        assert.deepEqual(expected.updateTime,{seconds:actual.seconds,nanoseconds:actual.nanoseconds});
      }
      assert.equal(result.attachmentMetadata.length,1);
      assert.equal(result.attachmentMetadata[0].storagePath,`${account.path}/attachments/blob`);
      assert.equal(result.attachmentMetadata[0].expectedVersion.seconds,(await file.get()).updateTime.seconds);
      assert.ok(!JSON.stringify(result).includes('SYNTHETIC'));
      const prepared=await run.prepare(request,result.planHash);
      assert.equal(prepared.destructiveAllowed,false);assert.equal(prepared.fence.phase,'prepared');
      assert.equal((await run.prepare(request,result.planHash)).duplicate,true);
      const beforeWrite=createAccountWriteFenceLab(db);
      await db.runTransaction(async tx=>{
        const commit=await beforeWrite(tx,account);
        commit();tx.update(account,{revision:2});
      });
      const state=db.doc(`labPurgeStates/${createHash('sha256').update(account.path).digest('hex')}`);
      assert.equal((await state.get()).data().fence.phase,'idle');
      await assert.rejects(run.prepare(request,result.planHash),/VERSION_CONFLICT/);
      request.command.expectedRevision=2;
      await db.doc(`${root}/accountWidgets/foreign`).create({context:'private',accountId:'other',kind:'shared-reference',sharedDataId:'s',linkId:'l'});
      result=await run(request);
      assert.equal(result.valid,false);assert.ok(result.anomalies.some(a=>a.code==='FOREIGN_INCOMING_REFERENCE'));
      assert.deepEqual(result.deletePaths,[]);
      await db.doc(`${root}/accountWidgets/overflow`).create({context:'private',accountId:'other',kind:'embedded'});
      await assert.rejects(run(request),/TOO_LARGE/);
      assert.equal((await account.get()).data().revision,2);
      assert.equal((await db.doc(`${root}/sharedVaultData/s`).get()).data().revision,1);
      assert.equal((await db.doc(root).get()).data().contactPhones[0].linkedAccountId,'a');
      await db.doc(`${root}/accountWidgets/overflow`).delete();
      await file.update({storagePath:'users/foreign/accounts/a/attachments/blob'});
      await assert.rejects(run(request),/ATTACHMENT_PATH_UNVERIFIED/);
      assert.equal((await file.get()).exists,true);
    }
  } finally {await db.terminate();await deleteApp(app);}
});
