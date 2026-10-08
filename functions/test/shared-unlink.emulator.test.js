const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {randomUUID} = require('node:crypto');
const {runInNewContext} = require('node:vm');
const {initializeApp,deleteApp} = require('firebase-admin/app');
const {getFirestore,FieldValue} = require('firebase-admin/firestore');
const {HttpsError} = require('firebase-functions/v2/https');
const policy = require('../shared-vault-service');
const receipts = require('../shared-vault-receipt');

test('shared unlink validates pairs in real Firestore emulator transactions', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085'
}, async () => {
  const app = initializeApp({projectId:'demo-shared-unlink'},`unlink-${randomUUID()}`);
  const db = getFirestore(app);
  const source = readFileSync(require.resolve('../index'),'utf8');
  const guard = source.slice(source.indexOf('function requireMutationOwner('),source.indexOf('exports.applyOfflineMutation'));
  const handler = source.slice(source.indexOf('exports.manageSharedVaultData'),source.indexOf('exports.manageAccountWidget'));
  const store = {doc:(...args)=>db.doc(...args),collection:(...args)=>db.collection(...args),
    runTransaction:callback=>db.runTransaction(async tx=>await callback(tx))};
  const scope = {exports:{},...policy,...receipts,HttpsError,FieldValue,require: _name => require('../reference-callables'), onCall:(_options,callback)=>callback,getFirestore:()=>store};
  runInNewContext(guard+handler,scope);
  try {
    for (const context of ['private','company']) {
      for (const mismatch of [false,true]) {
        const uid = `synthetic-${randomUUID()}`;
        const identity = {context,accountId:'a',...(context==='company'?{companyId:'c'}:{})};
        const command = {expectedOwnerUid:uid,action:'unlink',operationId:'op',sharedDataId:'s',linkId:'l',widgetId:'w',expectedRevision:1,link:identity};
        const paths = policy.sharedVaultPaths(uid,command);
        const data = db.doc(paths.data), link = db.doc(paths.link), widget = db.doc(paths.widget);
        const other = db.doc(`users/${uid}/sharedVaultLinks/other`);
        const operation = db.doc(`mutationResults/${uid}/operations/op`), audit = db.doc(`users/${uid}/auditEvents/op`);
        await data.set({revision:1,syntheticCiphertext:'preserve'});
        await link.set({...identity,sharedDataId:'s',widgetId:mismatch?'different':'w'});
        await widget.set({...identity,sharedDataId:'s',linkId:'l',kind:'shared-reference'});
        await other.set({...identity,accountId:'other',sharedDataId:'s'});
        const refs = [data,link,widget,other,operation,audit];
        const before = await Promise.all(refs.map(async ref=>(await ref.get()).data()));
        const invoke = ()=>scope.exports.manageSharedVaultData({auth:{uid},data:command});
        if (mismatch) {
          await assert.rejects(invoke(),error=>error.code==='failed-precondition');
          assert.deepEqual(await Promise.all(refs.map(async ref=>(await ref.get()).data())),before);
        } else {
          assert.equal((await db.doc(paths.account).get()).exists,false);
          assert.equal((await invoke()).status,'applied');
          assert.equal((await link.get()).exists,false); assert.equal((await widget.get()).exists,false);
          assert.deepEqual((await other.get()).data(),before[3]);
          assert.equal((await data.get()).data().syntheticCiphertext,'preserve');
          assert.equal((await data.get()).data().revision,2);
          const after = await Promise.all(refs.map(async ref=>(await ref.get()).data()));
          assert.equal((await invoke()).duplicate,true);
          assert.deepEqual(await Promise.all(refs.map(async ref=>(await ref.get()).data())),after);
        }
      }
    }
    // Complete service lifecycle, including exact replay and changed payload.
    const uid = `synthetic-${randomUUID()}`;
    const base = {expectedOwnerUid:uid,sharedDataId:'lifecycle'};
    const payload = {title:'Synthetic',fields:[{id:'f',label:'Synthetic',type:'sensitive',encrypted:true,valueEnc:'synthetic-cipher'}]};
    const invoke = command => scope.exports.manageSharedVaultData({auth:{uid},data:{...base,...command}});
    const data = db.doc(`users/${uid}/sharedVaultData/lifecycle`);
    const commands = [
      {action:'create',operationId:'create',data:payload},
      {action:'update',operationId:'update',expectedRevision:1,data:{...payload,title:'Updated'}},
      {action:'link',operationId:'link',expectedRevision:2,linkId:'l',widgetId:'w',link:{context:'private',accountId:'a'}},
      {action:'unlink',operationId:'unlink',expectedRevision:3,linkId:'l',widgetId:'w',link:{context:'private',accountId:'a'}},
      {action:'delete',operationId:'delete',expectedRevision:4}
    ];
    await db.doc(`users/${uid}/accounts/a`).set({synthetic:true});
    for (const [index,command] of commands.entries()) {
      assert.equal((await invoke(command)).revision,index+1);
      const root = db.doc(`mutationResults/${uid}/operations/${command.operationId}`);
      const legacy = db.doc(`users/${uid}/operationResults/${command.operationId}`);
      const refs = [data,root,db.doc(`users/${uid}/sharedVaultLinks/l`),db.doc(`users/${uid}/accountWidgets/w`),db.doc(`users/${uid}/auditEvents/${command.operationId}`)];
      const snapshot = async () => Promise.all(refs.map(async ref=>(await ref.get()).data()));
      const before = await snapshot();
      assert.equal((await legacy.get()).exists,false);
      assert.equal(Object.hasOwn((await root.get()).data(),'data'),false);
      assert.equal((await invoke(command)).duplicate,true);
      const changed = command.data ? {...command,data:{...command.data,title:'Different retry'}} : {...command,expectedRevision:99};
      await assert.rejects(invoke(changed),error=>error.details?.reason==='SHARED_RESULT_UNVERIFIED');
      assert.deepEqual(await snapshot(),before);
    }
    assert.equal((await data.get()).exists,false);
    const legacyCommand={action:'create',operationId:'legacy',data:payload};
    await db.doc(`users/${uid}/operationResults/legacy`).set({status:'applied',domain:'shared-vault'});
    await assert.rejects(invoke(legacyCommand),error=>error.details?.reason==='SHARED_RESULT_UNVERIFIED');
    assert.equal((await data.get()).exists,false);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/legacy`).get()).exists,false);
  } finally { await db.terminate(); await deleteApp(app); }
});
