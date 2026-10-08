import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc, getDoc, deleteDoc} from 'firebase/firestore';

// Regression after the explicitly authorized local Rules correction.
// Isolated temporary emulator only; no clearFirestore/global reseed.
test('owner rules reject an Account below a missing Company; deletion protocol remains separate', {
  skip:process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085', timeout:60000
}, async () => {
  const env=await initializeTestEnvironment({projectId:'demo-vault-shell',firestore:{
    host:'127.0.0.1',port:8085,rules:await readFile(new URL('../../firestore.rules',import.meta.url),'utf8')}});
  const uid=`synthetic-${randomUUID()}`,company=`users/${uid}/aziende/synthetic`,account=`${company}/accounts/synthetic`;
  try {
    const db=env.authenticatedContext(uid).firestore();
    assert.equal((await getDoc(doc(db,company))).exists(),false);
    await assertFails(setDoc(doc(db,account),{ownerId:uid,synthetic:true}));
    assert.equal((await getDoc(doc(db,account))).exists(),false);
    assert.equal((await getDoc(doc(db,company))).exists(),false);
  } finally {
    await env.withSecurityRulesDisabled(async context=>{await deleteDoc(doc(context.firestore(),account));});
    await env.cleanup();
  }
});
