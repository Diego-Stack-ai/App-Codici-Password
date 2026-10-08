import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer, request as httpRequest} from 'node:http';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createSessionAccountWidgetWriter} from './account-widget-write-capability.mjs';
import {createSharedWidgetEditorSource} from './shared-widget-editor-source.mjs';
import {bankingEditBasis} from './banking-edit-contract.mjs';
import {createProtectedSession} from './test-support/protected-session.mjs';
import {createMemoryVault} from './memory-vault.mjs';
import {createEmulatorQrBridge} from './emulator-qr-bridge.mjs';
import {createRestoreStageSource} from './restore-stage-source.mjs';
import {createResumePlanLab} from './restore-resume-plan-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {getFirestore} = require('firebase-admin/firestore');
const {getApps, deleteApp} = require('firebase-admin/app');

test('current reference bridge uses real local HTTP/Auth and rejects invalid callers', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000
}, async () => {
  assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  const signup = async () => {
    const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
      method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({email: `synthetic-${randomUUID()}@example.invalid`, password: 'LOCAL-SYNTHETIC-ONLY-123!', returnSecureToken: true})
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const owner = await signup(), outsider = await signup();
  const bridge = await createEmulatorQrBridge([owner.localId]);
  const server = createServer(async (request, response) => {
    if (!await bridge(request, response)) response.writeHead(404).end();
  });
  const db = getFirestore();
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    // Ephemeral port avoids replacing the running browser server. Host/origin
    // deliberately exercise the bridge contract; this is not a browser test.
    const call = (name, data, override = {}) => new Promise((resolve, reject) => {
      const request = httpRequest(`http://127.0.0.1:${server.address().port}/demo-vault-shell/europe-west1/${name}`, {
        method: 'POST', headers: {'content-type': 'application/json', host: '127.0.0.1:4188',
          origin: 'http://127.0.0.1:4188', authorization: `Bearer ${owner.idToken}`,
          'x-firebase-appcheck': 'synthetic-app-check', ...override}
      }, response => {
        let body = '';
        response.on('data', chunk => {body += chunk;});
        response.on('end', () => {
          try {resolve({status: response.statusCode, body: JSON.parse(body)});} catch (error) {reject(error);}
        });
      });
      request.on('error', reject);
      request.end(JSON.stringify({data}));
    });
    const uid = owner.localId, account = db.doc(`users/${uid}/accounts/a`);
    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      const bytes = Buffer.from('synthetic-staged-ciphertext');
      const data = {expectedOwnerUid: uid, action: 'claim', operationId: 'http-stage',
        storagePath: `users/${uid}/attachments/staged`, size: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex')};
      const claimed = await call('manageRestoreStage', data);
      assert.equal(claimed.status, 200);
      const stageId = claimed.body.result.stageId;
      const binary = (route, body, override = {}) => new Promise((resolve, reject) => {
        const request = httpRequest(`http://127.0.0.1:${server.address().port}/restore-stage/${route}`, {
          method: 'POST', headers: {host: '127.0.0.1:4188', origin: 'http://127.0.0.1:4188',
            authorization: `Bearer ${owner.idToken}`, 'x-firebase-appcheck': 'synthetic-app-check',
            'x-stage-id': stageId, 'content-type': 'application/octet-stream', 'content-length': body.length, ...override}
        }, response => {
          const chunks = []; response.on('data', chunk => chunks.push(chunk));
          response.on('end', () => resolve({status: response.statusCode, bytes: Buffer.concat(chunks)}));
        });
        request.on('error', reject); request.end(body);
      });
      assert.equal((await binary('upload', bytes, {authorization: `Bearer ${outsider.idToken}`})).status, 401);
      assert.equal((await binary('upload', bytes, {origin: 'http://foreign.invalid'})).status, 401);
      assert.equal((await binary('download', Buffer.alloc(0))).status, 400);
      assert.equal((await binary('upload', bytes)).status, 200);
      const activities = await db.collection(`labRestoreUploadActivity/${uid}/items`).where('stageId', '==', stageId).get();
      assert.equal(activities.size, 1);
      assert.equal(activities.docs[0].data().status, 'verified');
      assert.match(activities.docs[0].data().generation, /^[1-9][0-9]*$/);
      assert.equal((await db.doc(`labRestoreOperations/${uid}/items/${stageId}`).get()).data().uploadActivityRevision, 1);
      const published = await call('manageRestoreStage', {expectedOwnerUid: uid, action: 'publish', stageId, expectedRevision: 2});
      assert.equal(published.status, 200);
      assert.equal(published.body.result.revision, 3);
      const downloaded = await binary('download', Buffer.alloc(0));
      assert.equal(downloaded.status, 200); assert.deepEqual(downloaded.bytes, bytes);
      assert.equal((await binary('upload', bytes)).status, 409);
      assert.equal((await call('manageRestoreStage', {...data, generation: '1'})).status, 400);
      const staged = {expectedOwnerUid: uid, action: 'create', inputs: [{expectedOwnerUid: uid,
        operationId: 'http-stage-chunk', backupId: 'http-stage-backup', chunkIndex: 0, chunkCount: 1,
        mode: 'apply', confirmation: 'RESTORE_VALIDATED', records: [
          {scope: 'private-account', id: 'stage-target', expectedVersion: {exists: false}, data: {synthetic: true}},
          {scope: 'private-account-attachment', accountId: 'stage-target', id: 'file',
          expectedVersion: {exists: false}, data: {storagePath: data.storagePath}}]}],
        stageCommands: [{restoreOperationId: data.operationId, stageIds: [stageId]}]};
      const badBinding = structuredClone(staged);
      badBinding.stageCommands[0].restoreOperationId = 'foreign-operation';
      assert.equal((await call('manageRestoreResume', badBinding)).status, 400);
      const created = await call('manageRestoreResume', staged);
      assert.equal(created.status, 200);
      const resume = {...staged, action: 'resume', planId: created.body.result.planId};
      assert.equal((await call('manageRestoreResume', resume)).body.result.status, 'completed');
      const target = db.doc(`labCandidateRecords/${uid}/items/${createHash('sha256').update(`users/${uid}/accounts/stage-target/attachments/file`).digest('hex')}`);
      const saved = await target.get();
      assert.equal(saved.data().storagePath, published.body.result.destinationPath);
      assert.equal((await call('manageRestoreResume', resume)).body.result.results[0].duplicate, true);
      assert.ok((await target.get()).updateTime.isEqual(saved.updateTime));
      assert.equal((await db.doc(`users/${uid}/accounts/stage-target`).get()).exists, false);
      let uploads = 0;
      const source = createRestoreStageSource({uid, isActive: () => true,
        submit: async data => {
          const response = await call('manageRestoreStage', data);
          assert.equal(response.status, 200); return response.body.result;
        }, upload: async ({stageId, bytes}) => {
          uploads++;
          assert.equal((await binary('upload', bytes, {'x-stage-id': stageId})).status, 200);
          throw Error('synthetic-response-lost');
        }});
      const sourceCommand = {operationId: 'http-stage-source', storagePath: data.storagePath, bytes: new Uint8Array(bytes)};
      await assert.rejects(source.prepare(sourceCommand), /synthetic-response-lost/);
      const recovered = await source.prepare(sourceCommand);
      assert.equal(uploads, 1); assert.equal(typeof recovered.generation, 'string');
      const recoveredBytes = await binary('download', Buffer.alloc(0), {'x-stage-id': recovered.stageId});
      assert.equal(recoveredBytes.status, 200); assert.deepEqual(recoveredBytes.bytes, bytes);
      source.dispose(); sourceCommand.bytes.fill(0);
      // Actual encrypted backup -> source -> bridge -> stages -> plan -> replay.
      const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
      const cryptoUrl = moduleUrl(readFileSync(new URL('../../Frontend/public/assets/js/modules/settings/backup-crypto.js', import.meta.url), 'utf8'));
      const modelUrl = moduleUrl(readFileSync(new URL('../../Frontend/public/assets/js/modules/settings/backup-import-model.js', import.meta.url), 'utf8'));
      const resumeUrl = moduleUrl(readFileSync(new URL('./restore-resume-source.mjs', import.meta.url), 'utf8')
        .replace('../../Frontend/public/assets/js/modules/settings/backup-crypto.js', cryptoUrl)
        .replace('../../Frontend/public/assets/js/modules/settings/backup-import-model.js', modelUrl));
      const cryptoBackup = await import(cryptoUrl), {createRestoreResumeSource} = await import(resumeUrl);
      const recoveryKey = cryptoBackup.generateRecoveryKey(), header = cryptoBackup.createBackupHeader(uid);
      const backupKey = await cryptoBackup.deriveBackupKey(header, recoveryKey, uid);
      const entries = [{kind: 'record', scope: 'private-account', id: 'full-backup', data: {synthetic: true}},
        {kind: 'record', scope: 'private-account-attachment', accountId: 'full-backup', id: 'file', data: {storagePath: data.storagePath}},
        {kind: 'attachment', storagePath: data.storagePath, content: bytes.toString('base64')},
        {kind: 'footer', entryCount: 3, recordCount: 2, attachmentCount: 1}];
      const lines = [JSON.stringify(header)]; let previousDigest = '';
      for (const [sequence, entry] of entries.entries()) {
        const result = await cryptoBackup.encryptBackupEntry({header, key: backupKey, sequence, previousDigest, entry});
        previousDigest = result.digest; lines.push(JSON.stringify(result.envelope));
      }
      const original = {file: new Blob([lines.join('\n')]), recoveryKey};
      const abort = new AbortController();
      const makeSource = () => createRestoreResumeSource({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
        getUser: () => ({uid}), isOnline: () => true,
        submit: async data => {const reply = await call('manageRestoreResume', data); assert.equal(reply.status, 200); return reply.body.result;},
        attachmentPreparer: createRestoreStageSource({uid, signal: abort.signal, isActive: () => !abort.signal.aborted,
          submit: async data => {const reply = await call('manageRestoreStage', data); assert.equal(reply.status, 200); return reply.body.result;},
          upload: async ({stageId, bytes}) => {assert.equal((await binary('upload', bytes, {'x-stage-id': stageId})).status, 200);}})});
      const full = makeSource();
      assert.deepEqual(await full.previewNew(original), {records: 2, chunks: 1, attachments: 1});
      await assert.rejects(full.create(), /STAGING_REQUIRED/);
      assert.deepEqual(await full.stageAttachments(), {staged: 1});
      const fullPlan = await full.create();
      assert.equal((await full.resume()).status, 'completed'); full.dispose();
      const reopened = makeSource();
      const inspected = await reopened.prepare({...original, planId: fullPlan.planId});
      assert.equal(inspected.applied, 1);
      assert.equal((await reopened.resume()).results[0].duplicate, true);
      reopened.dispose();
      // Simulate one absent candidate document, retaining the existing Account.
      const parentTarget = db.doc(`labCandidateRecords/${uid}/items/${createHash('sha256').update(`users/${uid}/accounts/full-backup`).digest('hex')}`);
      const childTarget = db.doc(`labCandidateRecords/${uid}/items/${createHash('sha256').update(`users/${uid}/accounts/full-backup/attachments/file`).digest('hex')}`);
      const parentBefore = await parentTarget.get();
      await childTarget.delete(); // Exact synthetic test target only.
      const mixed = makeSource();
      assert.equal((await mixed.previewNew(original)).existing, 1);
      await assert.rejects(mixed.create(), /SELECTION_REQUIRED/);
      assert.deepEqual(mixed.selectMissingOnly(), {records: 1, chunks: 1, attachments: 1});
      await mixed.stageAttachments(); await mixed.create();
      assert.equal((await mixed.resume()).status, 'completed');
      assert.ok((await parentTarget.get()).updateTime.isEqual(parentBefore.updateTime));
      assert.equal((await childTarget.get()).exists, true);
      mixed.dispose();
      // An unchanged attachment document can still point at absent bytes.
      // Repair only the explicitly selected child through a new immutable stage.
      const {getStorage} = require('firebase-admin/storage');
      const bucket = getStorage().bucket('demo-vault-shell.appspot.com');
      assert.equal((await bucket.file(data.storagePath).exists())[0], false);
      await childTarget.set({storagePath: data.storagePath});
      const repairParent = await parentTarget.get();
      const repair = makeSource(), repairPreview = await repair.previewNew(original);
      const childChoice = repairPreview.choices.find(choice => choice.scope === 'private-account-attachment');
      assert.equal(childChoice.status, 'unchanged');
      assert.deepEqual(repair.selectRecords([childChoice.key], 'RESTORE_SELECTED_OVERWRITE'),
        {records: 1, chunks: 1, attachments: 1});
      await repair.stageAttachments(); await repair.create();
      assert.equal((await repair.resume()).status, 'completed');
      const repairedPath = (await childTarget.get()).data().storagePath;
      assert.notEqual(repairedPath, data.storagePath);
      const repairedStageId = repairedPath.split('/').at(-1);
      const repairedBytes = await binary('download', Buffer.alloc(0), {'x-stage-id': repairedStageId});
      assert.equal(repairedBytes.status, 200);
      assert.deepEqual(repairedBytes.bytes, bytes);
      assert.ok((await parentTarget.get()).updateTime.isEqual(repairParent.updateTime));
      assert.equal((await bucket.file(data.storagePath).exists())[0], false, 'no recreation of old object');
      repair.dispose();
      const childBeforeOverwrite=await childTarget.get();
      await parentTarget.update({synthetic:'changed'});
      const selected=makeSource();
      assert.equal((await selected.previewNew(original)).existing,2);
      assert.deepEqual(selected.selectRecords(['0:0'],'RESTORE_SELECTED_OVERWRITE'),{records:1,chunks:1,attachments:0});
      await selected.create();assert.equal((await selected.resume()).status,'completed');selected.dispose();
      assert.equal((await parentTarget.get()).data().synthetic,true);
      assert.ok((await childTarget.get()).updateTime.isEqual(childBeforeOverwrite.updateTime));
      const stale=makeSource();await stale.previewNew(original);
      stale.selectRecords(['0:0'],'RESTORE_SELECTED_OVERWRITE');
      await parentTarget.update({synthetic:'concurrent'});
      await assert.rejects(stale.create());
      assert.equal((await parentTarget.get()).data().synthetic,'concurrent');stale.dispose();
      abort.abort();
    }
    for (const company of [false, true]) {
      const selection = company ? {domain: 'company', companyId: 'bank-firm', id: 'bank-edit'} : {domain: 'private', id: 'bank-edit'};
      const parent = company ? `users/${uid}/aziende/bank-firm` : `users/${uid}`;
      if (company) await db.doc(parent).create({ownerId: uid});
      const bankRef = db.doc(`${parent}/accounts/bank-edit`), record = {ownerId: uid, revision: 1,
        banking: [{bankId: 'first', iban: 'KEEP'}, {bankId: 'second', iban: 'BEFORE', cards: [{pin: ''}]}], note: 'KEEP'};
      await bankRef.create(record);
      const basis = bankingEditBasis(record, uid, selection);
      const edit = {expectedOwnerUid: uid, operationId: company ? 'bank-company' : 'bank-private', account: selection,
        bankId: 'second', cardIndex: null, patch: {iban: 'AFTER'}, expectedRevision: basis.revision,
        expectedFingerprint: createHash('sha256').update(basis.fingerprintInput).digest('hex')};
      const fenceRef = db.doc(`labPurgeStates/${createHash('sha256').update(bankRef.path).digest('hex')}`);
      await fenceRef.create({fence: {phase: 'exclusive', revision: 4, operationId: 'purge'}});
      assert.equal((await call('applyBankingEdit', edit)).status, 400);
      assert.deepEqual((await bankRef.get()).data(), record);
      assert.equal((await db.doc(`mutationResults/${uid}/operations/banking-edit-${edit.operationId}`).get()).exists, false);
      // Only this synthetic test fixture transitions to writable; no live purge release.
      await fenceRef.delete();
      assert.equal((await call('applyBankingEdit', edit, {authorization: ''})).status, 401);
      assert.equal((await call('applyBankingEdit', edit)).status, 200);
      const saved = await bankRef.get();
      assert.equal(saved.data().banking[1].iban, 'AFTER');
      assert.deepEqual(saved.data().banking[0], record.banking[0]);
      assert.deepEqual(saved.data().banking[1].cards, record.banking[1].cards);
      assert.equal(saved.data().note, 'KEEP');
      assert.equal((await call('applyBankingEdit', edit)).status, 200);
      assert.ok((await bankRef.get()).updateTime.isEqual(saved.updateTime));
      for (const [action, bankId, cardIndex, values] of [['create-bank','new',null,{iban:'SYNTHETIC'}],
        ['create-card','new',0,{pin:''}],['delete-card','new',0,null],['delete-bank','new',null,null]]) {
        const current=(await bankRef.get()).data(), state=bankingEditBasis(current,uid,selection);
        const command={expectedOwnerUid:uid,operationId:`${edit.operationId}-${action}`,account:selection,action,bankId,cardIndex,values,
          expectedRevision:state.revision,expectedFingerprint:createHash('sha256').update(state.fingerprintInput).digest('hex')};
        assert.equal((await call('applyBankingLifecycle',command,{authorization:''})).status,401);
        assert.equal((await call('applyBankingLifecycle',{...command,expectedOwnerUid:outsider.localId})).status,400);
        assert.equal((await call('applyBankingLifecycle',command)).status,200);
        const after=await bankRef.get();
        assert.equal((await call('applyBankingLifecycle',command)).status,200);
        assert.ok((await bankRef.get()).updateTime.isEqual(after.updateTime));
      }
      assert.deepEqual((await bankRef.get()).data().banking,saved.data().banking);
    }
    const resumeData = {expectedOwnerUid: uid, action: 'create', inputs: [{expectedOwnerUid: uid,
      operationId: 'resume-http', backupId: 'synthetic-backup', chunkIndex: 0, chunkCount: 1,
      mode: 'apply', confirmation: 'RESTORE_VALIDATED', records: [{scope: 'private-account', id: 'resume-http',
        expectedVersion: {exists: false}, data: {synthetic: 'restore-http'}}]}],
      stageCommands: [{restoreOperationId: 'restore-http', stageIds: []}]};
    assert.equal((await call('manageRestoreResume', resumeData, {authorization: ''})).status, 401);
    assert.equal((await call('manageRestoreResume', {...resumeData, expectedOwnerUid: outsider.localId})).status, 400);
    assert.equal((await call('manageRestoreResume', {...resumeData,
      stageCommands: [{restoreOperationId: 'restore-http', stageIds: ['a'.repeat(64)]}]})).status, 400);
    const previewData = {expectedOwnerUid: uid, action: 'preview', inputs: resumeData.inputs.map(input => ({...input, mode: 'preview'}))};
    const plansBeforePreview = (await db.collection(`labRestoreResumePlans/${uid}/items`).get()).size;
    for (const widget of [false, true]) {
      const orphan = structuredClone(resumeData);
      orphan.inputs[0].records = [{scope: widget ? 'private-account-widget' : 'private-account-attachment',
        accountId: 'absent-parent', id: 'child', expectedVersion: {exists: false},
        data: widget ? {kind: 'embedded', context: 'private', accountId: 'absent-parent'} : {synthetic: true}}];
      for (const action of ['preview', 'create']) {
        const request = structuredClone(orphan); request.action = action;
        if (action === 'preview') {request.inputs[0].mode = 'preview'; delete request.stageCommands;}
        const rejected = await call('manageRestoreResume', request);
        assert.equal(rejected.status, 400);
        assert.equal(rejected.body.error.message, widget ? 'RESUME_WIDGET_PARENT_MISSING' : 'RESUME_ATTACHMENT_PARENT_MISSING');
      }
      assert.equal((await db.collection(`labRestoreResumePlans/${uid}/items`).get()).size, plansBeforePreview);
    }
    const precision=structuredClone(resumeData);
    const missingBank = structuredClone(resumeData);
    missingBank.inputs[0].records.push({scope:'private-account-widget',accountId:'resume-http',id:'missing-bank-widget',
      expectedVersion:{exists:false},data:{kind:'embedded',context:'private',accountId:'resume-http',bankId:'absent'}});
    const bankRejected = await call('manageRestoreResume',missingBank);
    assert.equal(bankRejected.status,400);
    assert.equal(bankRejected.body.error.message,'RESUME_WIDGET_BANK_MISSING');
    assert.equal((await db.collection(`labRestoreResumePlans/${uid}/items`).get()).size,plansBeforePreview);
    precision.inputs[0].chunkCount=2;
    precision.inputs.push({...precision.inputs[0],operationId:'precision-second',chunkIndex:1,records:[{scope:'private-account',
      id:'precision-second',expectedVersion:{exists:false},data:{at:{$type:'timestamp',seconds:1,nanoseconds:1}}}]});
    precision.stageCommands.push(structuredClone(precision.stageCommands[0]));
    const rejectedPreviewPrecision=await call('manageRestoreResume',{expectedOwnerUid:uid,action:'preview',
      inputs:precision.inputs.map(input=>({...input,mode:'preview'}))});
    assert.equal(rejectedPreviewPrecision.status,400);
    assert.equal(rejectedPreviewPrecision.body.error.message,'BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED');
    assert.equal((await db.collection(`labRestoreResumePlans/${uid}/items`).get()).size,plansBeforePreview);
    const rejectedPrecision=await call('manageRestoreResume',precision);
    assert.equal(rejectedPrecision.status,400);
    assert.equal(rejectedPrecision.body.error.message,'BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED');
    assert.equal((await db.collection(`labRestoreResumePlans/${uid}/items`).get()).size,plansBeforePreview);
    const split=structuredClone(resumeData);
    split.inputs[0].chunkCount=2;
    split.inputs.push({...split.inputs[0],operationId:'split-widget',chunkIndex:1,records:[{scope:'private-account-widget',
      accountId:'resume-http',id:'split-widget',expectedVersion:{exists:false},
      data:{kind:'embedded',context:'private',accountId:'resume-http'}}]});
    split.stageCommands.push(structuredClone(split.stageCommands[0]));
    const rejectedSplit=await call('manageRestoreResume',split);
    assert.equal(rejectedSplit.status,400);
    assert.equal(rejectedSplit.body.error.message,'RESUME_DEPENDENCY_CROSS_CHUNK');
    assert.equal((await db.collection(`labRestoreResumePlans/${uid}/items`).get()).size,plansBeforePreview);
    assert.equal((await call('manageRestoreResume', previewData, {authorization: ''})).status, 401);
    const previewResponse = await call('manageRestoreResume', previewData);
    assert.equal(previewResponse.status, 200);
    assert.deepEqual(previewResponse.body.result.chunks[0].entries, [{index: 0, status: 'missing', expectedVersion: {exists: false}}]);
    const largerPreview = structuredClone(previewData);
    largerPreview.inputs[0].records[0].data = {note: 'è'.repeat(130000)};
    assert.ok(Buffer.byteLength(JSON.stringify({data: largerPreview})) > 200000);
    assert.equal((await call('manageRestoreResume', largerPreview)).status, 200);
    assert.equal((await db.collection(`labRestoreResumePlans/${uid}/items`).get()).size, plansBeforePreview);
    const planResponse = await call('manageRestoreResume', resumeData);
    assert.equal(planResponse.status, 200);
    const planId = planResponse.body.result.planId;
    assert.equal(typeof planId, 'string');
    const recoveredCreation = await call('manageRestoreResume', {...resumeData, action: 'recoverCreation'});
    assert.equal(recoveredCreation.body.result.status, 'found');
    assert.equal(recoveredCreation.body.result.planId, planId);
    assert.equal(recoveredCreation.body.result.expiresAtMs, planResponse.body.result.expiresAtMs);
    const rebind = {expectedOwnerUid: uid, action: 'reconstruct', planId,
      backupId: 'synthetic-backup', records: resumeData.inputs[0].records};
    const missingPlan=await call('manageRestoreResume',{...rebind,planId:'synthetic-absent-plan'});
    assert.equal(missingPlan.status,400);
    assert.equal(missingPlan.body.error.message,'RESUME_PLAN_MISSING_NEW_PREVIEW_REQUIRED');
    const foreignPlan=await call('manageRestoreResume',{...rebind,expectedOwnerUid:outsider.localId});
    assert.equal(foreignPlan.body.error.message,'Laboratory selection rejected');
    assert.equal((await call('manageRestoreResume', rebind, {authorization: ''})).status, 401);
    assert.equal((await call('manageRestoreResume', {...rebind, expectedOwnerUid: outsider.localId})).status, 400);
    const rebound = await call('manageRestoreResume', rebind);
    assert.equal(rebound.status, 200);
    assert.equal(rebound.body.result.inputs[0].operationId, 'resume-http');
    const alteredBackup = structuredClone(rebind);
    alteredBackup.records[0].data = {synthetic: 'WRONG-BACKUP-CONTENT'};
    assert.equal((await call('manageRestoreResume', alteredBackup)).status, 400);
    const resume = {...resumeData, action: 'resume', planId};
    assert.equal((await call('manageRestoreResume', resume)).body.result.status, 'completed');
    const afterPreview = await call('manageRestoreResume', previewData);
    assert.equal(afterPreview.body.result.chunks[0].entries[0].expectedVersion.exists, true);
    assert.equal((await call('manageRestoreResume', resume)).body.result.results[0].duplicate, true);
    const reopened = (await call('manageRestoreResume', rebind)).body.result;
    assert.equal((await call('manageRestoreResume', {expectedOwnerUid: uid, action: 'resume', planId,
      inputs: reopened.inputs, stageCommands: reopened.stageCommands})).body.result.results[0].duplicate, true);
    assert.equal((await call('manageRestoreResume', {...resume, action: 'inspect'})).body.result.chunks[0].status, 'applied');
    const restored = db.doc(`labCandidateRecords/${uid}/items/${createHash('sha256').update(`users/${uid}/accounts/resume-http`).digest('hex')}`);
    assert.deepEqual((await restored.get()).data().synthetic, 'restore-http');
    assert.equal((await db.doc(`users/${uid}/accounts/resume-http`).get()).exists, false);
    const expiredInput = structuredClone(resumeData.inputs);
    expiredInput[0].operationId = 'expired-plan-fixture'; expiredInput[0].records[0].id = 'expired-plan-fixture';
    const expiredPlan = await createResumePlanLab({store: db, projectId: 'demo-vault-shell',
      now: () => Date.now() - 31 * 86400000}).create(uid, expiredInput, resumeData.stageCommands);
    const expiredRef = db.doc(`labRestoreResumePlans/${uid}/items/${createHash('sha256').update(expiredPlan.planId).digest('hex')}`);
    const targetBeforeCleanup = await restored.get();
    const expiredResponse=await call('manageRestoreResume',{expectedOwnerUid:uid,action:'reconstruct',
      planId:expiredPlan.planId,backupId:expiredInput[0].backupId,records:expiredInput[0].records});
    assert.equal(expiredResponse.status,400);
    assert.equal(expiredResponse.body.error.message,'RESUME_PLAN_EXPIRED_NEW_PREVIEW_REQUIRED');
    assert.equal((await call('manageRestoreResume', {expectedOwnerUid: uid, action: 'cleanupExpired', retention: 0})).status, 400);
    assert.equal((await call('manageRestoreResume', {expectedOwnerUid: outsider.localId, action: 'cleanupExpired'})).status, 400);
    const cleanup = await call('manageRestoreResume', {expectedOwnerUid: uid, action: 'cleanupExpired'});
    assert.equal(cleanup.status, 200); assert.equal(cleanup.body.result.removed, 1);
    assert.equal((await expiredRef.get()).exists, false);
    assert.ok((await restored.get()).updateTime.isEqual(targetBeforeCleanup.updateTime));
    assert.equal((await call('manageRestoreResume', resume)).body.result.results[0].duplicate, true);
    const blockedResume = structuredClone(resumeData);
    blockedResume.inputs[0].operationId = 'resume-fenced';
    blockedResume.inputs[0].records[0].id = 'resume-fenced';
    const resumeFence = db.doc(`labPurgeStates/${createHash('sha256').update(`users/${uid}/accounts/resume-fenced`).digest('hex')}`);
    await resumeFence.create({fence: {phase: 'exclusive', revision: 4, operationId: 'purge'}});
    const blockedPlan = await call('manageRestoreResume', blockedResume);
    assert.equal(blockedPlan.status, 200);
    assert.equal((await call('manageRestoreResume', {...blockedResume, action: 'resume', planId: blockedPlan.body.result.planId})).status, 400);
    assert.equal((await db.doc(`labRestoreChunkReceipts/${uid}/items/${createHash('sha256').update('resume-fenced').digest('hex')}`).get()).exists, false);
    assert.equal((await resumeFence.get()).data().fence.phase, 'exclusive');
    await account.create({synthetic: true});
    const fence = db.doc(`labPurgeStates/${createHash('sha256').update(account.path).digest('hex')}`);
    await fence.create({fence: {phase: 'prepared', revision: 2, operationId: 'purge'}});
    const command = {expectedOwnerUid: uid, context: 'private', accountId: 'a', widgetId: 'w', operationId: 'create', action: 'create',
      data: {title: 'Synthetic', fields: [{id: 'f', label: 'Synthetic', type: 'text', encrypted: false, value: 'synthetic'}]}};
    const name = 'manageAccountWidget';
    for (const headers of [{authorization: ''}, {authorization: `Bearer ${outsider.idToken}`},
      {origin: 'https://example.invalid'}, {'x-firebase-appcheck': ''}, {host: 'localhost:4188'}]) {
      assert.equal((await call(name, command, headers)).status, 401);
    }
    assert.equal((await call(name, {...command, expectedOwnerUid: outsider.localId})).status, 400);
    assert.equal((await db.doc(`users/${uid}/accountWidgets/w`).get()).exists, false);
    assert.equal((await fence.get()).data().fence.revision, 2);
    const first = await call(name, command);
    assert.equal(first.status, 200); assert.equal(first.body.result.status, 'applied');
    assert.equal((await call(name, command)).body.result.duplicate, true);
    assert.equal((await fence.get()).data().fence.revision, 3);
    const loadModule = async path => import(`data:text/javascript;base64,${Buffer.from(readFileSync(new URL(path, import.meta.url), 'utf8')).toString('base64')}`);
    const cryptoApi = await loadModule('../../Frontend/public/assets/js/modules/core/crypto-utils.js');
    const model = await loadModule('../../Frontend/public/assets/js/modules/data/shared-vault-data-model.js');
    const key = cryptoApi.generateVaultKey();
    let view;
    const session = createProtectedSession({getUser: () => ({uid}), subscribeUser: () => () => {},
      routes: {widget: context => {view = context;}},
      createVault: callbacks => createMemoryVault({...callbacks, unlockKey: async () => key,
        encryptValue: (material, value) => cryptoApi.encrypt(value, material),
        decryptRecord: (material, record) => cryptoApi.decrypt(record.ciphertext, material)})});
    try {
      await session.unlock(); await session.navigate('widget');
      const writer = createSessionAccountWidgetWriter({context: view, getUser: () => ({uid}),
        account: {context: 'private', accountId: 'a'}, prepare: model.prepareEmbeddedAccountWidget,
        isEncryptedValue: cryptoApi.isEncryptedValue, isOnline: () => true,
        submit: async command => {
          const result = await call(name, command); assert.equal(result.status, 200); return result.body.result;
        }});
      const plan = await writer.prepare({action: 'create', widgetId: 'encrypted', data: {title: 'Synthetic encrypted',
        fields: [{id: 'secret', label: 'Secret', type: 'sensitive', value: 'SYNTHETIC-SECRET-ONLY'}]}});
      await writer.send(plan); assert.equal((await writer.send(plan)).duplicate, true);
      const stored = (await db.doc(`users/${uid}/accountWidgets/encrypted`).get()).data();
      assert.equal(JSON.stringify(stored).includes('SYNTHETIC-SECRET-ONLY'), false);
      assert.equal(await view.read({ownerId: uid, ciphertext: stored.fields[0].valueEnc}), 'SYNTHETIC-SECRET-ONLY');
      const commonId = 'editor-shared';
      const sharedData = await model.prepareSharedVaultData({title: 'Synthetic common', fields: [
        {id: 'secret', label: 'Secret', type: 'sensitive', value: 'SYNTHETIC-COMMON'}]}, value => view.encrypt(value));
      assert.equal((await call('manageSharedVaultData', {expectedOwnerUid: uid, action: 'create',
        operationId: 'editor-shared-create', sharedDataId: commonId, data: sharedData})).body.result.status, 'applied');
      await db.doc(`users/${uid}/accounts/b`).create({synthetic: true});
      for (const [index, accountId] of ['a', 'b'].entries()) {
        assert.equal((await call('manageSharedVaultData', {expectedOwnerUid: uid, action: 'link',
          operationId: `editor-link-${accountId}`, expectedRevision: index + 1, sharedDataId: commonId,
          linkId: `editor-link-${accountId}`, widgetId: `editor-widget-${accountId}`,
          link: {context: 'private', accountId}})).body.result.status, 'applied');
      }
      const list = async name => (await db.collection(`users/${uid}/${name}`).get()).docs.map(doc => ({...doc.data(), id: doc.id}));
      const sharedSource = createSharedWidgetEditorSource({context: view, getUser: () => ({uid}),
        account: {context: 'private', accountId: 'a'}, readAccount: async () => (await account.get()).data(),
        listWidgets: () => list('accountWidgets'), listLinks: () => list('sharedVaultLinks'), listShared: () => list('sharedVaultData'),
        prepare: model.prepareSharedVaultData, isEncryptedValue: cryptoApi.isEncryptedValue, isOnline: () => true,
        submit: async command => {
          const response = await call('manageSharedVaultData', command); assert.equal(response.status, 200);
          return response.body.result;
        }});
      const draft = await sharedSource.load('editor-widget-a');
      draft.fields[0].value = 'SYNTHETIC-COMMON-UPDATED';
      await sharedSource.send(await sharedSource.prepare(draft));
      const common = db.doc(`users/${uid}/sharedVaultData/${commonId}`);
      assert.equal(await view.read({ownerId: uid, ciphertext: (await common.get()).data().fields[0].valueEnc}), 'SYNTHETIC-COMMON-UPDATED');
      await sharedSource.load('editor-widget-a');
      const otherLink = db.doc(`users/${uid}/sharedVaultLinks/editor-link-b`), otherWidget = db.doc(`users/${uid}/accountWidgets/editor-widget-b`);
      const beforeOther = await Promise.all([otherLink.get(), otherWidget.get()]);
      const unlink = await sharedSource.prepareUnlink();
      await sharedSource.send(unlink); assert.equal((await sharedSource.send(unlink)).duplicate, true);
      assert.equal((await db.doc(`users/${uid}/sharedVaultLinks/editor-link-a`).get()).exists, false);
      assert.equal((await db.doc(`users/${uid}/accountWidgets/editor-widget-a`).get()).exists, false);
      assert.equal((await common.get()).exists, true); assert.equal((await account.get()).exists, true);
      const afterOther = await Promise.all([otherLink.get(), otherWidget.get()]);
      afterOther.forEach((doc, index) => assert.ok(doc.updateTime.isEqual(beforeOther[index].updateTime)));
      sharedSource.dispose();
      session.lock(); await assert.rejects(writer.send(plan), /VIEW_DISPOSED|VAULT_LOCKED/);
      writer.dispose();
    } finally {session.dispose();}
    await db.doc(`users/${uid}/sharedVaultData/s`).create({revision: 1});
    const link = {expectedOwnerUid: uid, action: 'link', operationId: 'link', sharedDataId: 's', linkId: 'l', widgetId: 'shared',
      expectedRevision: 1, link: {context: 'private', accountId: 'a'}};
    assert.equal((await call('manageSharedVaultData', link)).body.result.status, 'applied');
    await fence.set({fence: {phase: 'exclusive', revision: 5, operationId: 'purge'}});
    assert.equal((await call(name, {...command, widgetId: 'blocked', operationId: 'blocked'})).status, 400);
    assert.equal((await db.doc(`users/${uid}/accountWidgets/blocked`).get()).exists, false);
    assert.equal((await db.doc(`mutationResults/${uid}/operations/blocked`).get()).exists, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.terminate();
    await Promise.all(getApps().map(app => deleteApp(app)));
  }
});
