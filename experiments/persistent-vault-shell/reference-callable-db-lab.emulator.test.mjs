import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash, randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createReferenceCallableDbLab} from './reference-callable-db-lab.mjs';
import {enterExclusivePurge} from './purge-fence-model.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {HttpsError} = require('firebase-functions/v2/https');
const widget = require('./account-widget-service');
const shared = require('./shared-vault-service');
const source = readFileSync(new URL('../../functions/index.js', import.meta.url), 'utf8');
const guard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const handlers = source.slice(source.indexOf('exports.manageSharedVaultData ='), source.indexOf('async function runRecoveryCommand'));

test('existing widget and shared-link handlers atomically honor lab fences', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000
}, async () => {
  const app = initializeApp({projectId: 'demo-vault-shell'}, `references-${randomUUID()}`), db = getFirestore(app);
  try {
    const scope = {exports: {}, ...widget, ...shared,
      ...require('./account-widget-receipt'), ...require('./shared-vault-receipt'),
      HttpsError, FieldValue, require: name => require(name), onCall: (_options, callback) => callback, getFirestore: () => createReferenceCallableDbLab(db)};
    runInNewContext(guard + handlers, scope);
    for (const action of ['create', 'update', 'delete', 'link', 'unlink']) for (const context of ['private', 'company']) for (const phase of ['prepared', 'exclusive', 'concurrent']) {
      const kind = ['link', 'unlink'].includes(action) ? 'shared' : 'widget';
      const uid = `synthetic-${randomUUID()}`, path = `users/${uid}/${context === 'company' ? 'aziende/c/' : ''}accounts/a`;
      const identity = {context, accountId: 'a', ...(context === 'company' ? {companyId: 'c'} : {})};
      await db.doc(path).create({synthetic: true});
      const fence = db.doc(`labPurgeStates/${createHash('sha256').update(path).digest('hex')}`);
      const initial = {fence: {phase: phase === 'concurrent' ? 'prepared' : phase, operationId: 'purge', revision: 2}};
      await fence.create(initial);
      const command = kind === 'widget' ? {expectedOwnerUid: uid, ...identity, widgetId: 'w', action, operationId: 'op', expectedRevision: 1,
        data: {title: 'Synthetic', fields: [{id: 'f', label: 'Synthetic', type: 'text', encrypted: false, value: 'synthetic'}]}} :
        {expectedOwnerUid: uid, action, operationId: 'op', sharedDataId: 's', linkId: 'l', widgetId: 'w', expectedRevision: 1,
          link: identity};
      const paths = kind === 'widget' ? widget.accountWidgetPaths(uid, command) : shared.sharedVaultPaths(uid, command);
      if (kind === 'shared') await db.doc(paths.data).create({revision: 1});
      if (action === 'update' || action === 'delete') await db.doc(paths.widget).create({
        ...identity, kind: 'embedded', revision: 1, createdAt: 'synthetic', title: 'Before', fields: command.data.fields
      });
      if (action === 'unlink') {
        await db.doc(paths.link).create({...identity, sharedDataId: 's', widgetId: 'w'});
        await db.doc(paths.widget).create({...identity, kind: 'shared-reference', sharedDataId: 's', linkId: 'l'});
      }
      const refs = [db.doc(path), fence, db.doc(paths.widget), db.doc(`mutationResults/${uid}/operations/op`), db.doc(`users/${uid}/auditEvents/op`)];
      if (kind === 'shared') refs.push(db.doc(paths.link), db.doc(paths.data));
      const snapshot = () => Promise.all(refs.map(async ref => (await ref.get()).data()));
      const before = await snapshot();
      const run = () => scope.exports[kind === 'widget' ? 'manageAccountWidget' : 'manageSharedVaultData']({auth: {uid}, data: command});
      if (phase === 'concurrent') {
        const claim = () => db.runTransaction(async tx => {
          const current = (await tx.get(fence)).data();
          tx.set(fence, {fence: enterExclusivePurge(current.fence, initial.fence)});
        });
        const [writerResult, claimResult] = await Promise.allSettled([run(), claim()]);
        assert.equal([writerResult, claimResult].filter(result => result.status === 'fulfilled').length, 1);
        if (claimResult.status === 'fulfilled') {
          assert.match(String(writerResult.reason), /FENCE_BUSY/);
          const after = await snapshot();
          assert.deepEqual(after[1], {fence: {phase: 'exclusive', operationId: 'purge', revision: 3}});
          assert.deepEqual(after.filter((_, i) => i !== 1), before.filter((_, i) => i !== 1));
          continue;
        }
        assert.match(String(claimResult.reason), /FENCE_CONFLICT/);
        assert.equal(writerResult.value.status, 'applied');
      }
      if (phase === 'exclusive') {
        await assert.rejects(run(), /FENCE_BUSY/);
        assert.deepEqual(await snapshot(), before);
      } else {
        if (phase !== 'concurrent') assert.equal((await run()).status, 'applied');
        assert.deepEqual((await fence.get()).data(), {fence: {phase: 'idle', operationId: null, revision: 3}});
        assert.equal((await db.doc(paths.widget).get()).exists, !['delete', 'unlink'].includes(action));
        if (action === 'update') assert.equal((await db.doc(paths.widget).get()).data().title, 'Synthetic');
        if (action === 'unlink') {
          assert.equal((await db.doc(paths.link).get()).exists, false);
          assert.equal((await db.doc(paths.data).get()).data().revision, 2);
        }
        assert.deepEqual((await db.doc(path).get()).data(), {synthetic: true});
        const after = await snapshot();
        assert.equal((await run()).duplicate, true);
        assert.deepEqual(await snapshot(), after);
      }
    }
  } finally { await db.terminate(); await deleteApp(app); }
});
