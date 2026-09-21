import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, runTransaction, setDoc} from 'firebase/firestore';

// M7-R4 correzione (revisione Codex 21/09/2026): prova mirata sulla revoca di un
// ospite che ha già accettato. La transazione reale del dettaglio privato
// (Frontend/public/assets/js/modules/privato/dettaglio-privato-sharing.js:105-161)
// aggiorna l'Account del proprietario, cancella l'invito, scrive una notifica
// nella PROPRIA raccolta e — se l'ospite ha accettato — anche in
// users/{guestUid}/notifications. Questo test verifica, con le Rules di
// PRODUZIONE e dati sintetici, se quella transazione viene accettata o rifiutata
// nella sua interezza, e se il rifiuto lascia l'Account invariato.
const PROJECT_ID = 'codici-password-sharing-revocation-test';
const OWNER = 'owner', GUEST = 'guest', ACCOUNT = 'account-1';
const EMAIL_KEY = 'guest_example_invalid';
const INVITE_ID = `${ACCOUNT}_${EMAIL_KEY}`;
const accountPath = ['users', OWNER, 'accounts', ACCOUNT];
const invitePath = ['invites', INVITE_ID];
const guestNotificationPath = ['users', GUEST, 'notifications', 'revoca-sintetica'];
const ownerNotificationPath = ['users', OWNER, 'notifications', 'revoca-sintetica'];
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
    const db = context.firestore();
    await setDoc(doc(db, ...accountPath), {
      nomeAccount: 'Account sintetico', type: 'account', revision: 1, visibility: 'shared', acceptedCount: 1,
      sharedWith: {[EMAIL_KEY]: {email: 'guest@example.invalid', status: 'accepted', uid: GUEST}},
      sharedWithUids: [GUEST]
    });
    await setDoc(doc(db, ...invitePath), {
      inviteId: INVITE_ID, ownerId: OWNER, senderId: OWNER, senderEmail: 'owner@example.invalid',
      recipientEmail: 'guest@example.invalid', accountId: ACCOUNT, status: 'accepted'
    });
  });
});
after(async () => testEnv?.cleanup());

const asOwner = () => testEnv.authenticatedContext(OWNER).firestore();
// `withSecurityRulesDisabled` non restituisce il valore del callback: lo
// catturiamo in una variabile locale.
async function readAsAdmin(path) {
  let snapshot;
  await testEnv.withSecurityRulesDisabled(async context => { snapshot = await getDoc(doc(context.firestore(), ...path)); });
  return snapshot;
}

// Riproduce i passi della revoca reale nell'ordine in cui il codice li esegue.
async function revocationTransaction(db, {notifyGuest}) {
  return runTransaction(db, async transaction => {
    const accountRef = doc(db, ...accountPath);
    const snapshot = await transaction.get(accountRef);
    const data = snapshot.data();
    const sharedWith = {...(data.sharedWith || {})};
    const revoked = sharedWith[EMAIL_KEY];
    const guestUid = revoked?.status === 'accepted' ? revoked.uid : null;
    delete sharedWith[EMAIL_KEY];
    transaction.update(accountRef, {
      sharedWith,
      sharedWithUids: Object.values(sharedWith).filter(guest => guest.status === 'accepted' && guest.uid).map(guest => guest.uid),
      acceptedCount: Math.max(0, (data.acceptedCount || 0) - 1),
      visibility: 'private', type: data.type, updatedAt: 'sintetico'
    });
    transaction.delete(doc(db, ...invitePath));
    transaction.set(doc(collection(db, 'users', OWNER, 'notifications')), {type: 'share_revoked', read: false});
    if (notifyGuest && guestUid) {
      transaction.set(doc(collection(db, 'users', guestUid, 'notifications')), {type: 'share_revoked', read: false});
    }
  });
}

test('il proprietario scrive nella propria raccolta di notifiche ma non in quella dell\'ospite', async () => {
  const db = asOwner();
  await assertSucceeds(setDoc(doc(db, ...ownerNotificationPath), {type: 'share_revoked'}));
  await assertFails(setDoc(doc(db, ...guestNotificationPath), {type: 'share_revoked'}));
});

test('la transazione di revoca senza notifica all\'ospite riesce e rimuove l\'accesso', async () => {
  await assertSucceeds(revocationTransaction(asOwner(), {notifyGuest: false}));
  const account = (await readAsAdmin(accountPath)).data();
  assert.equal(account.sharedWithUids.length, 0);
  assert.equal(account.visibility, 'private');
  assert.equal((await readAsAdmin(invitePath)).exists(), false);
});

test('la transazione reale, che notifica anche l\'ospite, viene rifiutata interamente', async () => {
  await assertFails(revocationTransaction(asOwner(), {notifyGuest: true}));
  const account = (await readAsAdmin(accountPath)).data();
  assert.deepEqual(account.sharedWithUids, [GUEST], 'l\'ospite non deve essere rimosso se la transazione fallisce');
  assert.equal(account.visibility, 'shared');
  assert.equal(account.acceptedCount, 1);
  assert.equal((await readAsAdmin(invitePath)).exists(), true, 'l\'invito non deve sparire se la transazione fallisce');
});

test('cancellare l\'invito da solo resta consentito al proprietario', async () => {
  await assertSucceeds(deleteDoc(doc(asOwner(), ...invitePath)));
  assert.equal((await readAsAdmin(invitePath)).exists(), false);
});
