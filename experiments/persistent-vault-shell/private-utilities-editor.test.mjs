import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createPrivateUtilitiesEditorSource} from './private-utilities-editor-source.mjs';
import {withPrivateUtilitiesCandidateRules} from './private-utilities-candidate-rules.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const cipher=value=>Buffer.concat([Buffer.alloc(48,42),Buffer.from(String(value))]).toString('base64');
function fixture({online=true}={}){const abort=new AbortController(),state={uid:'owner',locked:false};
    const record={ownerId:'owner',_profileUtilitiesRevision:2,userAddresses:[
        {id:'address-home',address:'Via',unknown:'keep',utilities:[
            {id:'utility-one',type:'Energia',value:cipher('POD'),password:'legacy',unknown:'keep'},
            {id:'utility-linked',type:'Gas',value:cipher('PDR'),linkedAccountId:'account'},
            {id:'utility-address-home-legacy-hash',type:'Acqua',value:cipher('LEGACY')},
            {type:'Altro',value:cipher('NO-ID')}]},
        {id:'address-other',utilities:[{id:'utility-other',type:'Rete',value:cipher('OTHER')}]}]};
    const context={user:{uid:'owner'},signal:abort.signal,assertUnlocked(){if(state.locked)throw Error('LOCKED');},
        read:async({ciphertext})=>Buffer.from(ciphertext,'base64').subarray(48).toString(),encrypt:async value=>cipher(value)};
    const repository={getUserProfile:async()=>structuredClone(record),getUserProfileConfirmed:async()=>structuredClone(record)};
    let n=0;const source=createPrivateUtilitiesEditorSource({context,getUser:()=>({uid:state.uid}),repository,parentAddressId:'address-home',
        isEncryptedValue:value=>typeof value==='string'&&value.length>=60,hash,createId:()=>`utility-new-${++n}`,isOnline:()=>online});
    return{abort,state,record,source};}

test('source projects only the selected parent, decrypts value and exposes Account actions without a QR guard',async()=>{const f=fixture();const model=await f.source.load();
    assert.equal(model.rows.length,4);assert.equal(model.rows[0].fields.find(x=>x.key==='value').value,'POD');
    assert.equal(model.rows[1].linked,true);assert.deepEqual(model.rows[1].linkOrigin,{domain:'private',collection:'utilities',id:'utility-linked',parentAddressId:'address-home'});
    assert.equal(model.rows[0].linked,false);assert.equal(JSON.stringify(model),JSON.stringify(model).replace(/PROFILE_UTILITY_QR_SELECTED/g,''));});
test('stable utility updates encrypt only value and preserve the nested parent identity',async()=>{const f=fixture();await f.source.load();const request=await f.source.prepare({updates:[{id:'utility-one',fields:{type:'Luce',value:'NEW-POD'}}]},'operation');
    assert.equal(request.parentAddressId,'address-home');assert.equal(request.operations[0].fields.type,'Luce');assert.notEqual(request.operations[0].fields.value,'NEW-POD');
    assert.equal(Buffer.from(request.operations[0].fields.value,'base64').subarray(48).toString(),'NEW-POD');});
test('linked deletion and unstable identities fail closed, while a new ID is persisted in the command',async()=>{const f=fixture();await f.source.load();
    await assert.rejects(f.source.prepare({deletes:[{id:'utility-linked'}]},'linked'),/PROFILE_UTILITY_LINKED/);
    await assert.rejects(f.source.prepare({updates:[{id:'utility-address-home-legacy-hash',fields:{type:'X'}}]},'legacy'),/UTILITY_ID_DERIVED/);
    const id=f.source.createId(),request=await f.source.prepare({creates:[{id,fields:{type:'Fibra',value:'ABC'}}]},'create');assert.equal(request.operations[0].id,id);});
test('offline, lock, logout and abort revoke writes and leave consultation read-only',async()=>{const off=fixture({online:false});assert.equal((await off.source.load()).canSave,false);await assert.rejects(off.source.prepare({},'x'),/SAVE_UNAVAILABLE/);
    for(const mode of ['lock','logout','abort']){const f=fixture();await f.source.load();if(mode==='lock')f.state.locked=true;if(mode==='logout')f.state.uid='other';if(mode==='abort')f.abort.abort();await assert.rejects(f.source.prepare({updates:[{id:'utility-one',fields:{type:'X'}}]},mode));}});
test('candidate Rules close the utilities metadata through the existing A2 transform',()=>{const base=readFileSync(new URL('../../firestore.rules',import.meta.url),'utf8');
    const patched=withPrivateUtilitiesCandidateRules(base);assert.match(patched,/_profileUtilitiesRevision/);assert.match(patched,/_profileUtilitiesUpdatedAt/);
    assert.throws(()=>withPrivateUtilitiesCandidateRules(patched),/RULES_ALREADY_PATCHED|RULES_BASE_CHANGED/);});
