import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails,assertSucceeds,initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,updateDoc,deleteDoc,getDocs,collection,query,where,Timestamp,onSnapshot} from 'firebase/firestore';
let env;
const target='frame-designated-synthetic';
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-vault-frame-policy-rules',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>env?.cleanup());beforeEach(async()=>env.clearFirestore());
const client=(uid=target,verified=true)=>env.authenticatedContext(uid,{email:'synthetic@example.invalid',email_verified:verified}).firestore();
const payload=fields=>({schemaVersion:1,version:1,uid:target,enabled:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000),...fields});
const seed=async fields=>env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'vaultFramePolicy','current'),payload(fields)));
test('only the designated verified UID can GET the server singleton',async()=>{
 await seed();await assertSucceeds(getDoc(doc(client(),'vaultFramePolicy','current')));
 await assertFails(getDoc(doc(client('foreign'),'vaultFramePolicy','current')));await assertFails(getDoc(doc(client(target,false),'vaultFramePolicy','current')));
 await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'vaultFramePolicy','current')));
});
for(const fields of [{enabled:false},{uid:'other'},{version:2},{schemaVersion:2},{expiresAt:Timestamp.fromMillis(1)},{extra:true}])
 test('revoked or incompatible singleton denies: '+JSON.stringify(fields),async()=>{await seed(fields);await assertFails(getDoc(doc(client(),'vaultFramePolicy','current')));});
test('missing singleton and every other document in the collection deny',async()=>{
 await assertFails(getDoc(doc(client(),'vaultFramePolicy','current')));await seed();
 await assertFails(getDoc(doc(client(),'vaultFramePolicy','other')));
});
test('clients cannot create, update, delete, list or query the policy, including its selected UID',async()=>{
 const db=client(),reference=doc(db,'vaultFramePolicy','current');await assertFails(setDoc(reference,payload()));await seed();
 await assertFails(updateDoc(reference,{expiresAt:Timestamp.fromMillis(Date.now()+7200000)}));await assertFails(deleteDoc(reference));
 await assertFails(getDocs(collection(db,'vaultFramePolicy')));await assertFails(getDocs(query(collection(db,'vaultFramePolicy'),where('uid','==',target))));
});
test('owner preferences cannot shadow the root policy',async()=>{
 await assertSucceeds(setDoc(doc(client(),'users',target,'settings','vaultFrame'),{enabled:true,uid:target}));
 await assertFails(getDoc(doc(client(),'vaultFramePolicy','current')));
});
for(const lock of [{status:'active'},{schemaVersion:1,status:'malformed'}])test('recovery fence prevents admission '+JSON.stringify(lock),async()=>{
 await seed();await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'vaultRecoveryLocks',target),lock));
 await assertFails(getDoc(doc(client(),'vaultFramePolicy','current')));
});
test('the actual server listener loses permission after revocation',{timeout:20000},async()=>{
 await seed();let ready,revoked;const seen=new Promise(resolve=>{ready=resolve;}),denied=new Promise(resolve=>{revoked=resolve;});
 const stop=onSnapshot(doc(client(),'vaultFramePolicy','current'),{includeMetadataChanges:true},snapshot=>{if(!snapshot.metadata.fromCache)ready();},error=>revoked(error.code));
 try{await Promise.race([seen,denied.then(code=>{throw Error(code);})]);await seed({enabled:false});assert.equal(await denied,'permission-denied');}finally{stop();}
});
