import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, setDoc, updateDoc, getDoc, deleteDoc, writeBatch} from 'firebase/firestore';

test('Company parent is required for Account creation without breaking atomic parent creation or existing owner edits',
  {skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080', timeout: 60000}, async () => {
    const env = await initializeTestEnvironment({projectId: `demo-company-${randomUUID().slice(0,8)}`,
      firestore: {host: '127.0.0.1', port: 8080, rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')}});
    try {
      const owner = env.authenticatedContext('synthetic-owner').firestore();
      const prefix = 'users/synthetic-owner/aziende/c';
      const parent = doc(owner, prefix), account = doc(owner, `${prefix}/accounts/a`);
      await assertFails(setDoc(account, {name: 'synthetic'}));
      await assertFails(setDoc(doc(owner, `${prefix}/accounts/a/attachments/f`), {name: 'synthetic'}));
      const batch = writeBatch(owner);
      batch.set(account, {name: 'synthetic'});
      batch.set(parent, {name: 'synthetic-company'});
      await assertSucceeds(batch.commit());
      await assertSucceeds(updateDoc(account, {name: 'updated'}));
      await assertSucceeds(updateDoc(parent, {name: 'updated-company'}));
      await assertSucceeds(setDoc(doc(owner, `${prefix}/accounts/b`), {name: 'second'}));
      await assertSucceeds(setDoc(doc(owner, `${prefix}/accounts/a/attachments/f`), {name: 'synthetic'}));
      await assertSucceeds(getDoc(account));
      const other = env.authenticatedContext('other').firestore();
      await assertFails(setDoc(doc(other, `${prefix}/accounts/foreign`), {}));
      await assertFails(deleteDoc(parent));
      const deletion = writeBatch(owner); deletion.delete(account); deletion.delete(parent);
      await assertFails(deletion.commit());
      assert.equal((await getDoc(account)).exists(), true);
      // Admin can bypass Rules: model server removal without deleting the child.
      await env.withSecurityRulesDisabled(async context => deleteDoc(doc(context.firestore(), prefix)));
      await assertFails(setDoc(doc(owner, `${prefix}/accounts/late`), {}));
      // Existing orphan access/cleanup is intentionally not silently removed.
      await assertSucceeds(getDoc(account));
      await assertSucceeds(updateDoc(account, {name: 'existing-orphan'}));
      await assertSucceeds(deleteDoc(account));
      await assertFails(setDoc(account, {name: 'cannot-recreate'}));
    } finally {await env.cleanup();}
  });
