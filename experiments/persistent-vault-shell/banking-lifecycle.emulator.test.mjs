import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {createBankingLifecycleHandler} from './banking-lifecycle-handler.mjs';
import {bankingLifecycleBasis} from './banking-lifecycle-contract.mjs';
import {createAccountWriteFenceLab} from './account-write-fence-lab.mjs';
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'), {getFirestore}=require('firebase-admin/firestore');
const hash=value=>createHash('sha256').update(value).digest('hex');
test('bank deletion races safely with an account-reading widget writer and respects purge fence',{
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085',timeout:60000
},async()=>{
  const app=initializeApp({projectId:'demo-vault-shell'},randomUUID()),db=getFirestore(app);
  try {
    const run=createBankingLifecycleHandler({db,hash,timestamp:()=>1000,beforeAccountWrite:createAccountWriteFenceLab(db)});
    for(const domain of ['private','company']) for(const mode of ['race','present','fenced']) {
      const uid=`synthetic-${randomUUID()}`,account={domain,id:'a',...(domain==='company'?{companyId:'c'}:{})};
      const parent=domain==='company'?`users/${uid}/aziende/c`:`users/${uid}`;
      if(domain==='company')await db.doc(parent).create({ownerId:uid});
      const ref=db.doc(`${parent}/accounts/a`),widget=db.doc(`users/${uid}/accountWidgets/w`);
      const record={ownerId:uid,revision:1,banking:[{bankId:'bank',cards:[]}],keep:'SYNTHETIC'};
      await ref.create(record);
      const request={expectedOwnerUid:uid,operationId:'delete',account,action:'delete-bank',bankId:'bank',cardIndex:null,
        values:null,expectedRevision:1,expectedFingerprint:hash(bankingLifecycleBasis(record,uid,account).fingerprintInput)};
      const widgetData={context:domain,accountId:'a',bankId:'bank',...(domain==='company'?{companyId:'c'}:{})};
      if(mode==='present')await widget.create(widgetData);
      if(mode==='fenced')await db.doc(`labPurgeStates/${hash(ref.path)}`).create({fence:{phase:'exclusive',revision:2,operationId:'purge'}});
      const mutate=()=>run(request,{auth:{uid},app:{appId:'demo'}});
      if(mode==='race') {
        const results=await Promise.allSettled([mutate(),db.runTransaction(async tx=>{
          const current=(await tx.get(ref)).data();
          if(!current.banking.some(bank=>bank.bankId==='bank'))throw Error('BANK_MISSING');
          tx.create(widget,widgetData);
        })]);
        assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
      } else await assert.rejects(mutate(),mode==='present'?/WIDGETS_PRESENT/:/FENCE|BLOCKED/);
      const saved=(await ref.get()).data(),exists=(await widget.get()).exists;
      assert.equal(saved.keep,'SYNTHETIC');
      assert.ok(!exists || saved.banking.some(bank=>bank.bankId==='bank'));
      if(!saved.banking.length)await mutate();
    }
  } finally {await db.terminate();await deleteApp(app);}
});
