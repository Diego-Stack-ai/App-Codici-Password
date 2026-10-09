import {createRequire} from 'node:module';
import {createHash, randomUUID} from 'node:crypto';
const require = createRequire(import.meta.url);
const stage = require('../../functions/backup-attachment-stage.js');
const HEX = /^[a-f0-9]{64}$/;
const UID = /^[A-Za-z0-9._:-]{1,160}$/;
const GEN = /^[1-9][0-9]*$/;
const DOMAIN = 'backup-restore-lab';
const fail = code => { throw Object.assign(new Error(code), {code}); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const millis = value => value?.toMillis?.();
const instant = value => Number.isSafeInteger(value) && value >= 0;

// Isolated candidate: no Firebase export, listener, app record or cleanup worker.
// Service methods require an authenticated UID from the caller. Only upload is HTTP.
export function createRestoreStageLab({store, bucket, verifyIdToken, verifyAppCheck, now, timestamp, projectId}) {
  if (!/^demo-[a-z0-9-]+$/.test(projectId || '') || !store || !bucket ||
      [verifyIdToken, verifyAppCheck, now, timestamp].some(fn => typeof fn !== 'function')) fail('LAB_CONFIG');
  const time = () => {
    const value = now();
    if (!instant(value) || !instant(value + stage.STAGE_TTL_MS)) fail('LAB_CLOCK');
    return value;
  };
  const stamp = value => {
    const result = timestamp(value);
    if (millis(result) !== value) fail('LAB_CLOCK');
    return result;
  };
  const ref = (root, uid, id) => store.collection(root).doc(uid).collection('items').doc(id);
  const refs = (uid, id) => {
    if (typeof uid !== 'string' || !UID.test(uid) || typeof id !== 'string' || !HEX.test(id)) fail('LAB_INPUT');
    return [ref('labRestoreOperations', uid, id), stage.stageRef(store, uid, id), ref('labRestorePublished', uid, id)];
  };
  function validate(uid, id, plan) {
    if (!plan || plan.ownerUid !== uid || plan.stageId !== id || plan.domain !== DOMAIN ||
        plan.bindingVersion !== 1 || ![1, 2, 3].includes(plan.revision)) fail('LAB_PLAN');
    if (Object.hasOwn(plan, 'uploadTrackingVersion') &&
        (plan.uploadTrackingVersion !== 1 || !Number.isSafeInteger(plan.uploadActivityRevision) ||
          plan.uploadActivityRevision < 0)) fail('LAB_PLAN');
    const identity = stage.stageIdentity(uid, plan.input);
    if (identity.id !== id || Object.keys(identity).some(key => plan.identity?.[key] !== identity[key])) fail('LAB_PLAN');
    const created = millis(plan.createdAt), updated = millis(plan.updatedAt);
    if (!instant(created) || !instant(updated) || updated < created ||
        !instant(plan.expiresAtMillis) || plan.expiresAtMillis !== created + stage.STAGE_TTL_MS) fail('LAB_PLAN');
    if (plan.revision === 1) {
      if (plan.generation !== null || plan.bytesSha256 !== null || plan.publishedPath !== null) fail('LAB_PLAN');
    } else {
      if (typeof plan.generation !== 'string' || !GEN.test(plan.generation) || plan.bytesSha256 !== identity.sha256 ||
          plan.publishedPath !== (plan.revision === 3 ? refs(uid, id)[2].path : null)) fail('LAB_PLAN');
    }
    return plan;
  }
  const view = (plan, duplicate = false) => ({stageId: plan.stageId, revision: plan.revision,
    generation: plan.generation, destinationPath: plan.identity.storagePath,
    publishedPath: plan.publishedPath, expiresAtMillis: plan.expiresAtMillis, duplicate});
  async function load(uid, id) {
    const [p] = refs(uid, id);
    const snap = await store.runTransaction(tx => tx.get(p));
    if (!snap.exists) fail('LAB_NOT_FOUND');
    return validate(uid, id, snap.data());
  }
  // Diagnostic snapshot, never deletion authorization. Bounded and consistent
  // with registration on the operation document and settlement on each entry.
  async function inspectUploadActivity(uid, {stageId: id} = {}) {
    refs(uid, id);
    return store.runTransaction(tx => inspectActivity(tx, uid, id));
  }
  async function inspectActivity(tx, uid, id) {
    const [p] = refs(uid, id);
      const snapshot = await tx.get(p);
      if (!snapshot.exists) fail('LAB_NOT_FOUND');
      const plan = validate(uid, id, snapshot.data());
      if (plan.uploadTrackingVersion !== 1) return {trackedFromCreation: false, cleanupAllowed: false};
      if (plan.uploadActivityRevision > 100) fail('LAB_ACTIVITY_LIMIT');
      const entries = await tx.get(store.collection('labRestoreUploadActivity').doc(uid).collection('items')
        .where('stageId', '==', id).limit(101));
      if (entries.size > 100) fail('LAB_ACTIVITY_LIMIT');
      if (entries.size !== plan.uploadActivityRevision) fail('LAB_ACTIVITY_HISTORY');
      const counts = {active: 0, unknown: 0, verified: 0};
      for (const snapshot of entries.docs) {
        const entry = snapshot.data(), started = millis(entry.startedAt), ended = millis(entry.endedAt);
        if (entry.ownerUid !== uid || entry.stageId !== id || !Object.hasOwn(counts, entry.status) ||
            !instant(started) || started < millis(plan.createdAt) ||
            (entry.status === 'active' ? Object.hasOwn(entry, 'endedAt') : !instant(ended) || ended < started) ||
            (entry.status === 'verified' ? typeof entry.generation !== 'string' || !GEN.test(entry.generation) : entry.generation !== null))
          fail('LAB_ACTIVITY_HISTORY');
        if (entry.status === 'verified' && plan.revision >= 2 && entry.generation !== plan.generation) fail('LAB_ACTIVITY_HISTORY');
        counts[entry.status]++;
      }
      return {trackedFromCreation: true, attempts: entries.size, counts,
        expired: plan.expiresAtMillis <= time(), cleanupAllowed: false};
  }
  // Preparation is the durable authorization marker. Deletion remains pinned
  // to the recorded generation and is never inferred from the current object.
  async function prepareUploadCleanup(uid, {stageId: id} = {}) {
    const [p, d, r] = refs(uid, id), cleanupId = randomUUID();
    return store.runTransaction(async tx => {
      const report = await inspectActivity(tx, uid, id);
      if (!report.trackedFromCreation || !report.expired || report.counts.active || report.counts.unknown || !report.counts.verified)
        fail('LAB_CLEANUP_BLOCKED');
      const [ps, ds, rs] = await Promise.all([tx.get(p), tx.get(d), tx.get(r)]);
      if (!ps.exists || !ds.exists || rs.exists) fail('LAB_CLEANUP_BLOCKED');
      const plan = validate(uid, id, ps.data()), descriptor = stage.verifyStageDescriptor(ds.data(), plan.identity);
      if (plan.revision !== 2 || descriptor.status !== 'pending') fail('LAB_CLEANUP_BLOCKED');
      if (millis(descriptor.createdAt) !== millis(plan.createdAt) ||
          millis(descriptor.expiresAt) !== plan.expiresAtMillis || plan.expiresAtMillis > time())
        fail('LAB_CLEANUP_BLOCKED');
      if (Object.hasOwn(plan, 'cleanup')) {
        const prior = plan.cleanup;
        if (!prior || Object.keys(prior).sort().join(',') !== 'generation,id,status' ||
            prior.status !== 'prepared' || prior.generation !== plan.generation ||
            typeof prior.id !== 'string' || !/^[a-f0-9-]{36}$/.test(prior.id)) fail('LAB_CLEANUP_BLOCKED');
        return {cleanupId: prior.id, generation: prior.generation, duplicate: true, cleanupAllowed: false};
      }
      tx.update(p, {cleanup: {id: cleanupId, status: 'prepared', generation: plan.generation}});
      return {cleanupId, generation: plan.generation, duplicate: false, cleanupAllowed: false};
    });
  }
  async function executeUploadCleanup(uid, {stageId: id, cleanupId} = {}) {
    const [p, d, r] = refs(uid, id);
    if (typeof cleanupId !== 'string' || !/^[a-f0-9-]{36}$/.test(cleanupId)) fail('LAB_INPUT');
    const authorization = await store.runTransaction(async tx => {
      const report = await inspectActivity(tx, uid, id);
      const [ps, ds, rs] = await Promise.all([tx.get(p), tx.get(d), tx.get(r)]);
      if (!report.trackedFromCreation || !report.expired || report.counts.active || report.counts.unknown ||
          !report.counts.verified || !ps.exists || !ds.exists || rs.exists) fail('LAB_CLEANUP_BLOCKED');
      const plan = validate(uid, id, ps.data());
      if (plan.cleanup?.status !== 'prepared') fail('LAB_CLEANUP_BLOCKED');
      const descriptor = stage.verifyStageDescriptor(ds.data(), plan.identity);
      if (plan.revision !== 2 || descriptor.status !== 'pending' || plan.cleanup?.id !== cleanupId ||
          plan.cleanup?.status !== 'prepared' || plan.cleanup?.generation !== plan.generation ||
          millis(descriptor.createdAt) !== millis(plan.createdAt) || millis(descriptor.expiresAt) !== plan.expiresAtMillis ||
          plan.expiresAtMillis > time()) fail('LAB_CLEANUP_BLOCKED');
      return {identity: plan.identity, generation: plan.generation};
    });
    const deleted = await stage.deleteStageGeneration(bucket, authorization.identity, authorization.generation);
    return store.runTransaction(async tx => {
      const [ps, ds, rs] = await Promise.all([tx.get(p), tx.get(d), tx.get(r)]);
      if (!ps.exists || !ds.exists || rs.exists) fail('LAB_CLEANUP_BLOCKED');
      const plan = validate(uid, id, ps.data()), descriptor = stage.verifyStageDescriptor(ds.data(), plan.identity);
      if (plan.revision !== 2 || descriptor.status !== 'pending' || plan.cleanup?.id !== cleanupId ||
          plan.cleanup?.status !== 'prepared' || plan.cleanup?.generation !== authorization.generation)
        fail('LAB_CLEANUP_BLOCKED');
      const completedAt = time();
      tx.update(p, {cleanup: {...plan.cleanup, status: 'completed'}, updatedAt: stamp(completedAt)});
      tx.update(d, {status: 'cleaned', cleanupId, cleanedGeneration: authorization.generation, cleanedAt: stamp(completedAt)});
      return {...deleted, cleanupId, completed: true};
    });
  }
  async function claim(uid, input) {
    // Keep the real helper's owner assertion; never silently replace it.
    const identity = stage.stageIdentity(uid, input);
    const normalized = Object.fromEntries(['expectedOwnerUid', 'operationId', 'storagePath', 'sha256', 'size'].map(k => [k, input[k]]));
    const [p] = refs(uid, identity.id), at = time();
    const plan = await store.runTransaction(async tx => {
      const snap = await tx.get(p);
      if (snap.exists) return validate(uid, identity.id, snap.data());
      const value = {ownerUid: uid, stageId: identity.id, domain: DOMAIN, bindingVersion: 1,
        uploadTrackingVersion: 1, uploadActivityRevision: 0,
        input: normalized, identity, revision: 1, generation: null, bytesSha256: null, publishedPath: null,
        createdAt: stamp(at), updatedAt: stamp(at), expiresAtMillis: at + stage.STAGE_TTL_MS};
      tx.create(p, value);
      return value;
    });
    // A crash here retains the plan. Reclaim resumes preparation without renewal.
    if (Object.hasOwn(plan, 'cleanup')) fail('LAB_CLEANUP_BLOCKED');
    // Published state must never go through preparation: a missing descriptor
    // is corruption, not permission to create a new pending reservation.
    if (plan.revision === 3) return publish(uid, {stageId: identity.id, expectedRevision: 2});
    if (plan.expiresAtMillis <= time()) fail('LAB_EXPIRED');
    // A delayed transaction/retry must not renew the descriptor's lifetime.
    await stage.prepareStage({store, bucket, uid, input: plan.input, now: millis(plan.createdAt), timestamp: stamp});
    if (plan.expiresAtMillis <= time()) fail('LAB_EXPIRED');
    return view(plan);
  }
  function published(uid, id, plan, descriptor, record) {
    stage.verifyStageDescriptor(descriptor, plan.identity);
    if (plan.revision !== 3 || descriptor.status !== 'published' || descriptor.generation !== plan.generation ||
        !record || record.domain !== DOMAIN || record.bindingVersion !== 1 || record.revision !== 3 ||
        record.stageId !== id || record.ownerUid !== uid || record.sourcePath !== plan.input.storagePath ||
        record.destinationPath !== plan.identity.storagePath || record.generation !== plan.generation ||
        record.bytesSha256 !== plan.identity.sha256 || record.size !== plan.identity.size ||
        record.readerContract !== 'generation-pinned' || !instant(millis(record.publishedAt)) ||
        millis(record.publishedAt) !== millis(plan.updatedAt) ||
        millis(descriptor.publishedAt) !== millis(record.publishedAt)) fail('LAB_RECORD');
    return record;
  }
  async function publish(uid, {stageId: id, expectedRevision} = {}) {
    if (expectedRevision !== 2) fail('LAB_CAS');
    const [p, d, r] = refs(uid, id);
    return store.runTransaction(async tx => {
      const [ps, ds, rs] = await Promise.all([tx.get(p), tx.get(d), tx.get(r)]);
      if (!ps.exists || !ds.exists) fail('LAB_NOT_FOUND');
      const plan = validate(uid, id, ps.data()), descriptor = stage.verifyStageDescriptor(ds.data(), plan.identity);
      if (Object.hasOwn(plan, 'cleanup')) fail('LAB_CLEANUP_BLOCKED');
      if (rs.exists) { published(uid, id, plan, descriptor, rs.data()); return view(plan, true); }
      if (plan.revision !== 2 || descriptor.status !== 'pending') fail('LAB_CAS');
      const at = time(), expiry = millis(descriptor.expiresAt);
      if (!instant(expiry) || expiry <= at || plan.expiresAtMillis <= at) fail('LAB_EXPIRED');
      if (descriptor.generation != null && descriptor.generation !== plan.generation) fail('LAB_GENERATION');
      const publishedAt = stamp(at);
      tx.update(d, {status: 'published', generation: plan.generation, publishedAt});
      tx.create(r, {domain: DOMAIN, bindingVersion: 1, revision: 3, stageId: id, ownerUid: uid,
        sourcePath: plan.input.storagePath, destinationPath: plan.identity.storagePath,
        generation: plan.generation, bytesSha256: plan.identity.sha256, size: plan.identity.size,
        readerContract: 'generation-pinned', publishedAt});
      tx.update(p, {revision: 3, publishedPath: r.path, updatedAt: publishedAt});
      return view({...plan, revision: 3, publishedPath: r.path});
    });
  }
  // Snapshot only: a future chunk commit must recheck bindings atomically.
  async function resolveMapping(uid, {operationId, stageIds} = {}) {
    return store.runTransaction(tx => resolveMappingInTransaction(tx, uid, {operationId, stageIds}));
  }
  // Caller must use this transaction for the eventual record writes too.
  async function resolveMappingInTransaction(tx, uid, {operationId, stageIds} = {}) {
    if (typeof operationId !== 'string' || !UID.test(operationId) || !Array.isArray(stageIds) ||
        stageIds.length < 1 || stageIds.length > 100 || new Set(stageIds).size !== stageIds.length) fail('LAB_INPUT');
    const groups = stageIds.map(id => ({id, refs: refs(uid, id)}));
      const snapshots = await Promise.all(groups.map(async group => ({id: group.id,
        values: await Promise.all(group.refs.map(ref => tx.get(ref)))})));
      const mapping = Object.create(null);
      for (const {id, values: [ps, ds, rs]} of snapshots) {
        if (!ps.exists || !ds.exists || !rs.exists) fail('LAB_NOT_FOUND');
        const plan = validate(uid, id, ps.data());
        if (plan.input.operationId !== operationId) fail('LAB_OPERATION');
        const record = published(uid, id, plan, ds.data(), rs.data());
        if (Object.hasOwn(mapping, record.sourcePath)) fail('LAB_MAPPING_CONFLICT');
        mapping[record.sourcePath] = record.destinationPath;
      }
      return Object.freeze(mapping);
  }
  async function read(uid, {stageId: id} = {}) {
    const [p, d, r] = refs(uid, id);
    const record = await store.runTransaction(async tx => {
      const [ps, ds, rs] = await Promise.all([tx.get(p), tx.get(d), tx.get(r)]);
      if (!ps.exists || !ds.exists || !rs.exists) fail('LAB_NOT_FOUND');
      return published(uid, id, validate(uid, id, ps.data()), ds.data(), rs.data());
    });
    const [bytes] = await stage.generationFile(bucket, record.destinationPath, record.generation).download();
    try {
      if (!Buffer.isBuffer(bytes) || bytes.length !== record.size || digest(bytes) !== record.bytesSha256) fail('LAB_DIGEST');
      // Caller owns and must clear this buffer. No metadata re-selection.
      return {bytes, generation: record.generation, sha256: record.bytesSha256, size: record.size};
    } catch (error) { if (Buffer.isBuffer(bytes)) bytes.fill(0); throw error; }
  }
  async function upload(req, res) {
    let bytes;
    const send = (status, error) => {
      if (!res.destroyed && !res.headersSent) {
        res.writeHead(status, {'content-type': 'application/json', 'cache-control': 'no-store',
          ...(error === 'BACKUP_STAGE_GENERATION_UNSUPPORTED' ? {'x-stage-error': 'GENERATION_UNSUPPORTED'} : {})});
        res.end(JSON.stringify(error ? {error} : {ok: true}));
      }
    };
    try {
      const remote = req.socket?.remoteAddress;
      let host;
      try { host = new URL(`http://${req.headers.host}`).hostname; } catch { fail('LAB_LOOPBACK'); }
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote) ||
          !['127.0.0.1', 'localhost', '[::1]'].includes(host)) fail('LAB_LOOPBACK');
      if (req.method !== 'POST') fail('LAB_METHOD');
      if (req.url !== '/upload') fail('LAB_INPUT');
      if (req.headers['content-type'] !== 'application/octet-stream') fail('LAB_CONTENT_TYPE');
      const token = req.headers.authorization, app = req.headers['x-firebase-appcheck'];
      if (typeof token !== 'string' || !token.startsWith('Bearer ') || !token.slice(7) || typeof app !== 'string' || !app) fail('LAB_AUTH');
      let uid;
      try { ({uid} = await verifyIdToken(token.slice(7))); await verifyAppCheck(app); } catch { fail('LAB_AUTH'); }
      if (typeof uid !== 'string' || !UID.test(uid)) fail('LAB_AUTH');
      const declared = req.headers['content-length'];
      if (declared !== undefined && (!/^\d+$/.test(declared) || !Number.isSafeInteger(Number(declared)))) fail('LAB_INPUT');
      if (Number(declared) > stage.MAX_BYTES) fail('LAB_OVERSIZE');
      const id = req.headers['x-stage-id'], plan = await load(uid, id);
      if (Object.hasOwn(plan, 'cleanup')) fail('LAB_CLEANUP_BLOCKED');
      if (plan.revision === 3) fail('LAB_PUBLISHED');
      if (plan.expiresAtMillis <= time()) fail('LAB_EXPIRED');
      bytes = await collect(req, stage.MAX_BYTES);
      if (plan.expiresAtMillis <= time()) fail('LAB_EXPIRED');
      let attempt, result;
      try {
        result = await stage.uploadStage({store, bucket, uid, input: plan.input, bytes, now: time(), timestamp: stamp,
          beforeUpload: async () => {
            const activity = ref('labRestoreUploadActivity', uid, randomUUID()), [p] = refs(uid, id);
            await store.runTransaction(async tx => {
              const snapshot = await tx.get(p);
              if (!snapshot.exists) fail('LAB_NOT_FOUND');
              const current = validate(uid, id, snapshot.data()), at = time();
              if (current.revision === 3) fail('LAB_PUBLISHED');
              if (current.expiresAtMillis <= at) fail('LAB_EXPIRED');
              // Future cleanup must coordinate on this same operation. No cleanup
              // state, lease expiry or legacy history is treated as permission.
              if (Object.hasOwn(current, 'cleanup')) fail('LAB_PLAN');
              const sequence = Object.hasOwn(current, 'uploadActivityRevision') ? current.uploadActivityRevision : 0;
              if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence === Number.MAX_SAFE_INTEGER) fail('LAB_PLAN');
              tx.update(p, {uploadActivityRevision: sequence + 1});
              tx.create(activity, {ownerUid: uid, stageId: id, status: 'active', generation: null, startedAt: stamp(at)});
            });
            attempt = activity;
          },
          assertUploadAllowed: () => { if (plan.expiresAtMillis <= time()) fail('LAB_EXPIRED'); }});
      } finally {
        if (attempt) await store.runTransaction(async tx => {
          const snapshot = await tx.get(attempt), entry = snapshot.data();
          if (!snapshot.exists || entry.ownerUid !== uid || entry.stageId !== id || entry.status !== 'active') fail('LAB_PLAN');
          // Unknown does not expire into a settled result. This journal is not a
          // GC authorization; it cannot attest attempts from older writers.
          tx.update(attempt, {status: result ? 'verified' : 'unknown', generation: result?.generation ?? null, endedAt: stamp(time())});
        });
      }
      await store.runTransaction(async tx => {
        const [p, d] = refs(uid, id);
        const [ps, ds] = await Promise.all([tx.get(p), tx.get(d)]);
        if (!ps.exists || !ds.exists) fail('LAB_NOT_FOUND');
        const current = validate(uid, id, ps.data()), descriptor = stage.verifyStageDescriptor(ds.data(), current.identity);
        if (Object.hasOwn(current, 'cleanup')) fail('LAB_CLEANUP_BLOCKED');
        const at = time(), expiry = millis(descriptor.expiresAt);
        if (current.revision === 3 || descriptor.status !== 'pending') fail('LAB_PUBLISHED');
        if (!instant(expiry) || expiry <= at || current.expiresAtMillis <= at) fail('LAB_EXPIRED');
        if (typeof result.generation !== 'string' || !GEN.test(result.generation)) fail('LAB_GENERATION');
        if (current.revision === 2) {
          if (current.generation !== result.generation) fail('LAB_GENERATION');
          return;
        }
        tx.update(p, {revision: 2, generation: result.generation, bytesSha256: current.identity.sha256, updatedAt: stamp(at)});
      });
      send(200);
    } catch (error) {
      drain(req);
      const statuses = {LAB_AUTH: 401, LAB_LOOPBACK: 403, LAB_METHOD: 405, LAB_CONTENT_TYPE: 415,
        LAB_OVERSIZE: 413, LAB_NOT_FOUND: 404, LAB_PUBLISHED: 409, LAB_EXPIRED: 409, LAB_GENERATION: 409, LAB_CLEANUP_BLOCKED: 409,
        BACKUP_STAGE_GENERATION_UNSUPPORTED: 409};
      // Never return verifier errors, body contents or tokens.
      send(statuses[error.code] || 400, statuses[error.code] ? error.code : 'LAB_FAILED');
    } finally { bytes?.fill(0); }
  }
  return Object.freeze({claim, upload, publish, read, inspectUploadActivity, prepareUploadCleanup, executeUploadCleanup, resolveMapping, resolveMappingInTransaction, status: async (uid, {stageId} = {}) => view(await load(uid, stageId)), MAX_BYTES: stage.MAX_BYTES});
}

const draining = new WeakSet();
function drain(req) {
  if (req.readableEnded || req.destroyed || draining.has(req)) return;
  draining.add(req);
  const wipe = chunk => { if (Buffer.isBuffer(chunk)) chunk.fill(0); };
  const stop = () => { draining.delete(req); req.off('data', wipe); req.off('end', stop); req.off('aborted', stop); req.off('error', stop); };
  req.on('data', wipe); req.once('end', stop); req.once('aborted', stop); req.once('error', stop); req.resume();
}
function collect(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    const cleanup = () => {
      req.off('data', data); req.off('end', end); req.off('aborted', abort); req.off('error', abort);
      for (const chunk of chunks) chunk.fill(0);
    };
    const abort = () => { cleanup(); reject(Object.assign(new Error('LAB_ABORT'), {code: 'LAB_ABORT'})); };
    const data = chunk => {
      size += chunk.length;
      if (size > max) {
        chunk.fill(0); cleanup(); drain(req);
        reject(Object.assign(new Error('LAB_OVERSIZE'), {code: 'LAB_OVERSIZE'}));
      } else chunks.push(chunk);
    };
    const end = () => { const bytes = Buffer.concat(chunks, size); cleanup(); resolve(bytes); };
    if (req.aborted || req.destroyed) return abort();
    req.on('data', data); req.once('end', end); req.once('aborted', abort); req.once('error', abort);
  });
}
