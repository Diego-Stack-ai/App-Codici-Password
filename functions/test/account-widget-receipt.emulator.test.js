const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {randomUUID} = require('node:crypto');
const {runInNewContext} = require('node:vm');
const {initializeApp,deleteApp} = require('firebase-admin/app');
const {getFirestore,FieldValue} = require('firebase-admin/firestore');
const {HttpsError} = require('firebase-functions/v2/https');
const policy = require('../account-widget-service');
const receipts = require('../account-widget-receipt');

test('widget receipts bind lifecycle and collisions in emulator transactions', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085'
}, async () => {
  const app=initializeApp({projectId:'demo-widget-receipt'},`widget-${randomUUID()}`), db=getFirestore(app);
  const source=readFileSync(require.resolve('../index'),'utf8');
  const guard=source.slice(source.indexOf('function requireMutationOwner('),source.indexOf('exports.applyOfflineMutation'));
  const handler=source.slice(source.indexOf('exports.manageAccountWidget ='),source.indexOf('async function runRecoveryCommand'));
  const store={doc:(...args)=>db.doc(...args),collection:(...args)=>db.collection(...args),
    runTransaction:callback=>db.runTransaction(async tx=>await callback(tx))};
  const scope={exports:{},...policy,...receipts,HttpsError,FieldValue,require: _name => require('../reference-callables'), onCall:(_options,callback)=>callback,getFirestore:()=>store};
  runInNewContext(guard+handler,scope);
  try {
    for (const context of ['private','company']) {
      const uid=`synthetic-${randomUUID()}`;
      const base={expectedOwnerUid:uid,widgetId:'w',accountId:'a',context,...(context==='company'?{companyId:'c'}:{})};
      const paths=policy.accountWidgetPaths(uid,base);
      await db.doc(paths.account).set({synthetic:true,banking:[{bankId:'b'}]});
      const payload={title:'Synthetic',fields:[{id:'f',label:'Synthetic',type:'text',encrypted:false,value:'synthetic'}]};
      const commands=[{action:'create',operationId:'create',data:{...payload,bankId:'b'}},
        {action:'update',operationId:'update',expectedRevision:1,data:payload},
        {action:'update',operationId:'clear',expectedRevision:2,data:{...payload,bankId:null}},
        {action:'delete',operationId:'delete',expectedRevision:3}];
      const invoke=command=>scope.exports.manageAccountWidget({auth:{uid},data:{...base,...command}});
      for (const [index,command] of commands.entries()) {
        assert.equal((await invoke(command)).revision,index+1);
        const widget=db.doc(paths.widget), root=db.doc(`mutationResults/${uid}/operations/${command.operationId}`);
        const legacy=db.doc(`users/${uid}/operationResults/${command.operationId}`);
        const audit=db.doc(`users/${uid}/auditEvents/${command.operationId}`);
        assert.equal((await legacy.get()).exists,false);
        assert.equal(Object.hasOwn((await root.get()).data(),'data'),false);
        if(index===1) assert.equal((await widget.get()).data().bankId,'b');
        if(index===2) assert.equal(Object.hasOwn((await widget.get()).data(),'bankId'),false);
        if(index===3) assert.equal((await widget.get()).exists,false);
        const refs=[widget,root,audit];
        const snapshot=()=>Promise.all(refs.map(async ref=>(await ref.get()).data()));
        const before=await snapshot();
        assert.equal((await invoke(command)).duplicate,true);
        const changed=command.data?{...command,data:{...command.data,title:'Changed'}}:{...command,expectedRevision:99};
        await assert.rejects(invoke(changed),e=>e.details?.reason==='ACCOUNT_WIDGET_RESULT_UNVERIFIED');
        if(command.action==='update') await assert.rejects(invoke({...command,expectedRevision:99}),e=>e.details?.reason==='ACCOUNT_WIDGET_RESULT_UNVERIFIED');
        assert.deepEqual(await snapshot(),before);
      }
      // Widget is now absent: another existing Account must not reuse this receipt.
      const other={...base,accountId:'other'};
      await db.doc(policy.accountWidgetPaths(uid,other).account).set({synthetic:true});
      await assert.rejects(invoke({...commands[3],accountId:'other'}),e=>e.details?.reason==='ACCOUNT_WIDGET_RESULT_UNVERIFIED');
      await db.doc(`users/${uid}/operationResults/legacy`).set({domain:'account-widget',action:'create',widgetId:'w',status:'applied',revision:1});
      await assert.rejects(invoke({action:'create',operationId:'legacy',data:payload}),e=>e.details?.reason==='ACCOUNT_WIDGET_RESULT_UNVERIFIED');
      assert.equal((await db.doc(paths.widget).get()).exists,false);
      assert.equal((await db.doc(`mutationResults/${uid}/operations/legacy`).get()).exists,false);
    }
  } finally { await db.terminate(); await deleteApp(app); }
});
