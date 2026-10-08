import {bankingLifecycleBasis,validateBankingLifecycleRequest,applyBankingLifecycle} from './banking-lifecycle-contract.mjs';
import {BANK_EDIT_FIELDS,CARD_EDIT_FIELDS,BANK_EDIT_SECRETS} from './banking-edit-contract.mjs';
import {profileLinkAccount} from './profile-link-contract.mjs';

export function createBankingLifecycleSource({context,getUser,account,readRecord,hash,isEncryptedValue,isOnline,submit,assertCurrent}) {
  const uid=context.user.uid,selection=profileLinkAccount(account);
  let closed=false,plans=new WeakMap();
  const check=()=>{if(closed || context.signal.aborted || getUser()?.uid!==uid)throw Error('VIEW_DISPOSED');
    context.assertUnlocked();if(!isOnline())throw Error('BANK_EDIT_ONLINE_REQUIRED');};
  const dispose=()=>{closed=true;plans=new WeakMap();context.signal.removeEventListener('abort',dispose);};
  context.signal.addEventListener('abort',dispose,{once:true});
  return Object.freeze({dispose,async prepare(action,{bankId,cardIndex=null,values=null}={}) {
    check(); const copied=structuredClone(values);
    const record=structuredClone(await readRecord());check();
    if(action!=='create-bank') {
      if(typeof assertCurrent!=='function')throw Error('BANK_LIFECYCLE_SELECTION_REQUIRED');
      await assertCurrent();check();
    }
    const basis=bankingLifecycleBasis(record,uid,selection),create=action.startsWith('create'),bank=action.endsWith('bank');
    const patch=create?{}:null;
    if(create) {
      const fields=bank?BANK_EDIT_FIELDS:CARD_EDIT_FIELDS;
      if(!copied || Object.getPrototypeOf(copied)!==Object.prototype ||
        Object.entries(copied).some(([key,value])=>!fields.includes(key)||typeof value!=='string'||value.length>20000))throw Error('BANK_LIFECYCLE_INVALID');
      for(const [key,value] of Object.entries(copied)) {
        patch[key]=BANK_EDIT_SECRETS.includes(key)&&value!==''?await context.encrypt(value):value;check();
        if(BANK_EDIT_SECRETS.includes(key)&&value!==''&&!isEncryptedValue(patch[key]))throw Error('BANK_EDIT_ENCRYPTION_FAILED');
      }
    }
    const request=validateBankingLifecycleRequest({expectedOwnerUid:uid,operationId:crypto.randomUUID(),account:selection,
      action,bankId:action==='create-bank'?crypto.randomUUID():bankId,cardIndex,values:patch,
      expectedRevision:basis.revision,expectedFingerprint:await hash(basis.fingerprintInput)});
    check();applyBankingLifecycle(record.banking,request);
    const fresh=bankingLifecycleBasis(await readRecord(),uid,selection);check();
    if(JSON.stringify(fresh)!==JSON.stringify(basis))throw Error('BANK_EDIT_CONFLICT');
    if(action!=='create-bank'){await assertCurrent();check();}
    const plan=Object.freeze({});plans.set(plan,{request,pending:false});return plan;
  },async send(plan) {
    check();const entry=plans.get(plan);if(!entry||entry.pending)throw Error('BANK_EDIT_PLAN_INVALID');
    entry.pending=true;
    try{const result=await submit(structuredClone(entry.request));check();return result;}finally{entry.pending=false;}
  }});
}
