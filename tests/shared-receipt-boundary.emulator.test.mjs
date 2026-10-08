import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,updateDoc,deleteDoc} from 'firebase/firestore';

test('shared receipt root denies all client mutations and isolates owner reads', {
  skip:process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085'
},async()=>{
  const env=await initializeTestEnvironment({projectId:'demo-shared-receipt-rules',firestore:{host:'127.0.0.1',port:8085,
    rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
  const uid=`synthetic-${randomUUID()}`,path=`mutationResults/${uid}/operations/op`;
  try {
    const owner=env.authenticatedContext(uid).firestore();
    const other=env.authenticatedContext(`${uid}-other`).firestore();
    await assertFails(setDoc(doc(owner,path),{status:'applied'}));
    await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),path),{domain:'shared-vault',status:'applied'}));
    assert.equal((await assertSucceeds(getDoc(doc(owner,path)))).data().status,'applied');
    await assertFails(getDoc(doc(other,path)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),path)));
    await assertFails(updateDoc(doc(owner,path),{status:'forged'}));
    await assertFails(deleteDoc(doc(owner,path)));
    assert.equal((await getDoc(doc(owner,path))).data().status,'applied');
  } finally {await env.cleanup();}
});
