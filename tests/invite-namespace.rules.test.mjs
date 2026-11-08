import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where} from 'firebase/firestore';

const helpers = await readFile(new URL('../Frontend/public/assets/js/utils.js', import.meta.url), 'utf8');
const {inviteIdForGuest, inviteMatchesAccount, inviteScopeForAccount} = await import('data:text/javascript;base64,' + Buffer.from(helpers).toString('base64'));
const OWNER = 'owner', ATTACKER = 'prior-guest', ACCOUNT = 'same-account';
const EMAIL = 'recipient@example.invalid', KEY = 'recipient_example_invalid';
const REF = '11111111-1111-4111-8111-111111111111';
let env;
const dbFor = uid => env.authenticatedContext(uid, {email: `${uid}@example.invalid`, email_verified: true}).firestore();
const resourcePath = (uid, company = '') => company
    ? ['users', uid, 'aziende', company, 'accounts', ACCOUNT] : ['users', uid, 'accounts', ACCOUNT];
const idFor = async (uid, company = '', cycle = 1) => inviteIdForGuest(await inviteScopeForAccount(uid, company, ACCOUNT), KEY, cycle);
const payload = (uid, id, company = '', cycle = 1) => ({inviteId: id, ownerId: uid, senderId: uid,
    senderEmail: `${uid}@example.invalid`, accountId: ACCOUNT, recipientEmail: EMAIL,
    ...(company ? {aziendaId: company} : {}), status: 'pending', cycle, auditRef: REF,
    createdAt: '2026-01-01T00:00:00.000Z', notifyEmail: false, notifyPush: false});
const seed = async (path, value) => env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), ...path), value));

before(async () => {
    env = await initializeTestEnvironment({projectId: 'demo-invite-namespace-test', firestore: {
        rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
    }});
});
beforeEach(async () => {
    await env.clearFirestore();
    for (const uid of [OWNER, ATTACKER]) for (const company of ['', 'company-a', 'company-b']) {
        await seed(resourcePath(uid, company), {revision: 1, sharingCycle: 1});
    }
});
after(async () => env?.cleanup());

test('scope separates owners, private accounts, companies and delimiter-like components', async () => {
    const scopes = await Promise.all([[OWNER, '', ACCOUNT], [ATTACKER, '', ACCOUNT],
        [OWNER, 'company-a', ACCOUNT], [OWNER, 'company-b', ACCOUNT],
        ['a\nb', 'c', 'd'], ['a', 'b\nc', 'd']].map(parts => inviteScopeForAccount(...parts)));
    assert.equal(new Set(scopes).size, scopes.length);
    const digest = value => createHash('sha256').update(value, 'utf8').digest('hex');
    assert.equal(scopes[0], digest(digest(OWNER) + digest('') + digest(ACCOUNT)));
});

test('an attacker with the same account ID cannot reserve victim or company namespace', async () => {
    const attackerDb = dbFor(ATTACKER);
    for (const company of ['', 'company-a', 'company-b']) {
        const victimId = await idFor(OWNER, company);
        await assertFails(setDoc(doc(attackerDb, 'invites', victimId), payload(ATTACKER, victimId, company)));
        await assertFails(setDoc(doc(attackerDb, 'invites', victimId), payload(OWNER, victimId, company)));
    }
    const privateId = await idFor(OWNER);
    await assertFails(setDoc(doc(dbFor(OWNER), 'invites', privateId), payload(OWNER, privateId, 'company-a')));
    const ownId = await idFor(ATTACKER);
    await assertSucceeds(setDoc(doc(attackerDb, 'invites', ownId), payload(ATTACKER, ownId)));
    await assertFails(setDoc(doc(attackerDb, 'invites', `${ACCOUNT}_${KEY}_c2`), payload(ATTACKER, `${ACCOUNT}_${KEY}_c2`, '', 2)));
});

test('normal senders can invite from private and company accounts sharing an ID', async () => {
    for (const uid of [OWNER, ATTACKER]) for (const company of ['', 'company-a', 'company-b']) {
        const id = await idFor(uid, company);
        await assertSucceeds(setDoc(doc(dbFor(uid), 'invites', id), payload(uid, id, company)));
    }
});

test('account and first v2 invitation can be created in the same transaction', async () => {
    const ownerDb = dbFor(OWNER);
    const accountId = 'new-account';
    const id = inviteIdForGuest(await inviteScopeForAccount(OWNER, '', accountId), KEY, 0);
    await assertSucceeds(runTransaction(ownerDb, async tx => {
        tx.set(doc(ownerDb, 'users', OWNER, 'accounts', accountId), {sharingCycle: 0});
        tx.set(doc(ownerDb, 'invites', id), {...payload(OWNER, id, '', 0), accountId});
    }));
});

test('create binds document ID, recipient key, cycle and an existing exact owner resource', async () => {
    const id = await idFor(OWNER);
    const good = payload(OWNER, id);
    for (const override of [{inviteId: 'different'}, {recipientEmail: 'other@example.invalid'}, {cycle: 2}, {accountId: 'missing'}]) {
        await assertFails(setDoc(doc(dbFor(OWNER), 'invites', id), {...good, ...override}));
    }
    await seed(resourcePath(OWNER), {revision: 1});
    const missingAccountId = 'missing';
    const missingId = inviteIdForGuest(await inviteScopeForAccount(OWNER, '', missingAccountId), KEY, 1);
    await assertFails(setDoc(doc(dbFor(OWNER), 'invites', missingId), {...payload(OWNER, missingId), accountId: missingAccountId}));
});

test('preexisting attacker legacy squat cannot abort a victim account save or be touched', async () => {
    const legacyId = `${ACCOUNT}_${KEY}_c1`;
    await seed(['invites', legacyId], payload(ATTACKER, legacyId));
    const ownerDb = dbFor(OWNER), id = await idFor(OWNER);
    await assertFails(getDoc(doc(ownerDb, 'invites', legacyId)));
    const owned = await assertSucceeds(getDocs(query(collection(ownerDb, 'invites'),
        where('ownerId', '==', OWNER), where('accountId', '==', ACCOUNT))));
    assert.equal(owned.size, 0, 'ownership discovery excludes the unreadable attacker record');
    await assertSucceeds(runTransaction(ownerDb, async tx => {
        const reference = doc(ownerDb, ...resourcePath(OWNER));
        await tx.get(reference);
        tx.update(reference, {revision: 2});
        tx.set(doc(ownerDb, 'invites', id), payload(OWNER, id));
    }));
    assert.equal((await assertSucceeds(getDoc(doc(dbFor(ATTACKER), 'invites', legacyId)))).data().ownerId, ATTACKER);
    assert.equal((await getDoc(doc(ownerDb, ...resourcePath(OWNER)))).data().revision, 2);
});

test('legacy owner and recipient reads, owner updates and deletion remain compatible', async () => {
    const id = `${ACCOUNT}_${KEY}`;
    await seed(['invites', id], {...payload(OWNER, id, '', 0), status: 'rejected', responseAuditRef: REF});
    const ownerDb = dbFor(OWNER);
    await assertSucceeds(getDoc(doc(ownerDb, 'invites', id)));
    const recipientDb = env.authenticatedContext('recipient', {email: EMAIL, email_verified: true}).firestore();
    await assertSucceeds(getDoc(doc(recipientDb, 'invites', id)));
    await assertSucceeds(updateDoc(doc(ownerDb, 'invites', id), {sharingState: 'suspended', senderNotified: true}));
    await assertFails(updateDoc(doc(dbFor(ATTACKER), 'invites', id), {senderNotified: true}));
    await assertSucceeds(deleteDoc(doc(ownerDb, 'invites', id)));
    assert.equal(inviteMatchesAccount(payload(OWNER, id), OWNER, 'company-a', ACCOUNT, 1), false);
});
