import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createProfileLinkHandler} from './profile-link-handler.mjs';
import {readProfileLinkContact} from './profile-link-plan.mjs';
import {createAccountNoteHandler} from './account-note-handler.mjs';
import {createAccountStandardHandler} from './account-standard-handler.mjs';
import {prepareAccountStandard} from './account-standard-contract.mjs';
import {enterExclusivePurge} from './purge-fence-model.mjs';
import {createAccountWriteFenceLab} from './account-write-fence-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex');

test('profile link fences preserve every participant on refusal and invalidate both on success', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000
}, async () => {
  const models = {};
  for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js']) {
    Object.assign(models, await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
  }
  const app = initializeApp({projectId: 'demo-vault-shell'}, `links-${randomUUID()}`);
  const db = getFirestore(app);
  try {
    for (const company of [false, true]) for (const blocked of ['old', 'next', null, 'race-old', 'race-next']) {
      const uid = `synthetic-${randomUUID()}`, root = `users/${uid}`;
      const source = company ? {domain: 'company', companyId: 'origin', type: 'email', id: 'pec'} :
        {domain: 'private', type: 'phone', id: 'mobile'};
      const sourceRef = db.doc(company ? `${root}/aziende/origin` : root);
      const link = {linkedAccountId: 'old', linkedAccountCompanyId: ''};
      await sourceRef.create(company ? {emails: {pec: {email: 'enc:synthetic', ...link}}} :
        {contactPhones: [{id: 'mobile', number: 'enc:synthetic', ...link}]});
      await db.doc(`${root}/aziende/destination`).create({ownerId: uid});
      const oldRef = db.doc(`${root}/accounts/old`), nextRef = db.doc(`${root}/aziende/destination/accounts/next`);
      await oldRef.create({password: 'enc:old', ...(company ?
        {linkedCompanyProfileFields: [{companyId: 'origin', type: 'email', id: 'pec'}]} :
        {linkedProfileFields: [{type: 'phone', id: 'mobile'}]})});
      await nextRef.create({ownerId: uid, type: 'account', password: 'enc:next'});
      const fenceRefs = [oldRef, nextRef].map(ref => db.doc(`labPurgeStates/${hash(ref.path)}`));
      for (let i = 0; i < 2; i++) await fenceRefs[i].create({fence: {
        phase: blocked === ['old', 'next'][i] ? 'exclusive' : 'prepared', operationId: 'purge', revision: 2}});
      const all = [sourceRef, oldRef, nextRef, ...fenceRefs];
      const before = await Promise.all(all.map(async ref => (await ref.get()).data()));
      const current = readProfileLinkContact(before[0], source, models);
      const request = {source, account: {domain: 'company', companyId: 'destination', id: 'next'},
        expectedAccount: current.account, expectedRevision: 0, expectedFingerprint: hash(current.fingerprintInput),
        operationId: 'op', expectedOwnerUid: uid};
      const run = createProfileLinkHandler({db, models, hash, timestamp: () => 123,
        deleteField: () => FieldValue.delete(), beforeAccountWrite: createAccountWriteFenceLab(db)});
      const receipt = db.doc(`mutationResults/${uid}/operations/profile-link-op`);
      if (blocked?.startsWith('race-')) {
        const index = blocked === 'race-old' ? 0 : 1;
        const prepared = before[3 + index].fence;
        const results = await Promise.allSettled([
          run(request, {auth: {uid}, app: {appId: 'synthetic'}}),
          db.runTransaction(async tx => {
            const state = (await tx.get(fenceRefs[index])).data();
            tx.set(fenceRefs[index], {fence: enterExclusivePurge(state.fence, prepared)});
          })
        ]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        const saved = results[0].status === 'fulfilled';
        assert.match(results[saved ? 1 : 0].reason.message, /FENCE_BUSY|FENCE_CONFLICT/);
        assert.equal((await receipt.get()).exists, saved);
        if (saved) {
          assert.equal(readProfileLinkContact((await sourceRef.get()).data(), source, models).account.id, 'next');
          for (const ref of fenceRefs) assert.deepEqual((await ref.get()).data(), {fence: {phase: 'idle', operationId: null, revision: 3}});
        } else {
          assert.deepEqual(await Promise.all(all.slice(0, 3).map(async ref => (await ref.get()).data())), before.slice(0, 3));
          assert.deepEqual((await fenceRefs[1 - index].get()).data(), before[3 + 1 - index]);
          assert.equal((await fenceRefs[index].get()).data().fence.phase, 'exclusive');
        }
        assert.equal((await oldRef.get()).data().password, 'enc:old');
        assert.equal((await nextRef.get()).data().password, 'enc:next');
      } else if (blocked) {
        await assert.rejects(run(request, {auth: {uid}, app: {appId: 'synthetic'}}), /FENCE_BUSY/);
        assert.deepEqual(await Promise.all(all.map(async ref => (await ref.get()).data())), before);
        assert.equal((await receipt.get()).exists, false);
      } else {
        assert.equal((await run(request, {auth: {uid}, app: {appId: 'synthetic'}})).status, 'confirmed');
        for (const ref of fenceRefs) assert.deepEqual((await ref.get()).data(), {fence: {phase: 'idle', operationId: null, revision: 3}});
        assert.equal((await receipt.get()).exists, true);
        assert.equal((await oldRef.get()).data().password, 'enc:old');
        assert.equal((await nextRef.get()).data().password, 'enc:next');
        assert.equal(readProfileLinkContact((await sourceRef.get()).data(), source, models).account.id, 'next');
      }
    }
  } finally { await db.terminate(); await deleteApp(app); }
});

test('standard writer and claim serialize for private and company Accounts', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000
}, async () => {
  const app = initializeApp({projectId: 'demo-vault-shell'}, `standard-${randomUUID()}`);
  const db = getFirestore(app);
  try {
    for (const company of [false, true]) for (const order of ['writer-first', 'claim-first', 'concurrent']) {
      const uid = `synthetic-${randomUUID()}`, cipher = Buffer.alloc(48, 42).toString('base64');
      const parent = company ? `users/${uid}/aziende/firm` : `users/${uid}`;
      const account = company ? {domain: 'company', companyId: 'firm', id: 'account'} : {domain: 'private', id: 'account'};
      await db.doc(parent).create(company ? {id: 'firm', ownerId: uid} : {ownerId: uid});
      const ref = db.doc(`${parent}/accounts/account`);
      const source = {id: 'account', ownerId: uid, schemaVersion: 1, revision: 7,
        nomeAccount: cipher, username: cipher, account: cipher, password: cipher, url: '', note: cipher,
        unknown: {keep: true}};
      await ref.create(source);
      const stateRef = db.doc(`labPurgeStates/${hash(ref.path)}`);
      const prepared = {phase: 'prepared', operationId: 'purge', revision: 2};
      await stateRef.create({fence: prepared});
      const request = await prepareAccountStandard({source, account, hash, operationId: 'op',
        getUser: () => ({uid}), changes: {username: ''},
        context: {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}, encrypt: async () => cipher}});
      const run = createAccountStandardHandler({db, hash, timestamp: () => 123, beforeAccountWrite: createAccountWriteFenceLab(db)});
      const save = () => run(request, {auth: {uid}, app: {appId: 'synthetic'}});
      const claim = () => db.runTransaction(async tx => {
        const state = (await tx.get(stateRef)).data();
        tx.set(stateRef, {fence: enterExclusivePurge(state.fence, prepared)});
      });
      let saved;
      if (order === 'writer-first') {
        await save(); saved = true;
        await assert.rejects(claim(), /FENCE_CONFLICT/);
      } else if (order === 'claim-first') {
        await claim(); saved = false;
        await assert.rejects(save(), /FENCE_BUSY/);
      } else {
        const results = await Promise.allSettled([save(), claim()]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        saved = results[0].status === 'fulfilled';
        assert.match(results[saved ? 1 : 0].reason.message, /FENCE_CONFLICT|FENCE_BUSY/);
      }
      const record = (await ref.get()).data();
      assert.equal(record.revision, saved ? 8 : 7);
      assert.equal(record.username, saved ? '' : cipher);
      assert.deepEqual(record.unknown, source.unknown);
      assert.equal(record.note, cipher);
      assert.equal((await db.doc(`mutationResults/${uid}/operations/account-standard-op`).get()).exists, saved);
      assert.equal((await stateRef.get()).data().fence.phase, saved ? 'idle' : 'exclusive');
    }
  } finally { await db.terminate(); await deleteApp(app); }
});

test('candidate note writer commits invalidation atomically and refuses exclusive state', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-vault-shell'}, `writer-${randomUUID()}`);
  const db = getFirestore(app);
  try {
    for (const phase of ['absent', 'prepared', 'exclusive']) {
      const uid = `synthetic-${randomUUID()}`;
      const ref = db.doc(`users/${uid}/accounts/account`);
      const original = {id: 'account', ownerId: uid, note: 'legacy note', revision: 4, schemaVersion: 1};
      await ref.create(original);
      const stateRef = db.doc(`labPurgeStates/${hash(ref.path)}`);
      const state = {fence: {phase, operationId: 'purge', revision: 2}};
      if (phase !== 'absent') await stateRef.create(state);
      const run = createAccountNoteHandler({db, hash, timestamp: () => 123,
        beforeAccountWrite: createAccountWriteFenceLab(db)});
      const request = {account: {domain: 'private', id: 'account'}, expectedOwnerUid: uid,
        note: Buffer.alloc(48, 42).toString('base64'), expectedRevision: 4,
        expectedFingerprint: hash(JSON.stringify([true, 'legacy note'])), operationId: 'op'};
      const receipt = db.doc(`mutationResults/${uid}/operations/account-note-op`);
      if (phase === 'exclusive') {
        await assert.rejects(run(request, {auth: {uid}, app: {appId: 'synthetic'}}), /FENCE_BUSY/);
        assert.deepEqual((await ref.get()).data(), original);
        assert.equal((await receipt.get()).exists, false);
        assert.deepEqual((await stateRef.get()).data(), state);
      } else {
        assert.equal((await run(request, {auth: {uid}, app: {appId: 'synthetic'}})).status, 'confirmed');
        assert.equal((await ref.get()).data().revision, 5);
        assert.equal((await receipt.get()).exists, true);
        if (phase === 'prepared') assert.deepEqual((await stateRef.get()).data(),
          {fence: {phase: 'idle', operationId: null, revision: 3}});
        else assert.equal((await stateRef.get()).exists, false);
      }
    }
  } finally { await db.terminate(); await deleteApp(app); }
});
