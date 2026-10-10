import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc} from 'firebase/firestore';

const PROJECT_ID = 'demo-codici-password-widget-profile-rules-test';
const OWNER = 'owner';
const OTHER = 'other';
let testEnv;

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')}
    });
});

beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'users', OWNER, 'accountWidgetProfiles', 'profile-1'), {
            kind: 'widget-profile', category: 'account', title: 'Accessi',
            fields: [{id: 'field-1', label: 'Utente', type: 'text', encrypted: false}], revision: 1
        });
    });
});

after(async () => testEnv?.cleanup());

test('il proprietario legge il catalogo ma ogni scrittura client resta bloccata', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();
    const ref = doc(db, 'users', OWNER, 'accountWidgetProfiles', 'profile-1');
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'accountWidgetProfiles')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'accountWidgetProfiles', 'forged'), {title: 'X'}));
    await assertFails(updateDoc(ref, {title: 'Alterato'}));
    await assertFails(deleteDoc(ref));
});

test('altri utenti e anonimi non leggono né scrivono i profili', async () => {
    for (const db of [testEnv.authenticatedContext(OTHER).firestore(), testEnv.unauthenticatedContext().firestore()]) {
        const ref = doc(db, 'users', OWNER, 'accountWidgetProfiles', 'profile-1');
        await assertFails(getDoc(ref));
        await assertFails(getDocs(collection(db, 'users', OWNER, 'accountWidgetProfiles')));
        await assertFails(setDoc(ref, {title: 'X'}));
    }
});
