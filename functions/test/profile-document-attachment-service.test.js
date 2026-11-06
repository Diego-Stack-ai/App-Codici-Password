const test = require('node:test');
const assert = require('node:assert/strict');
const {assertTransactionRecoveryAcquirable} = require('../vault-recovery-fence');
const {createProfileDocumentAttachmentService, expectedStoragePath, MAX_CLEAR_BYTES} = require('../profile-document-attachment-service');

class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
const encryption = (type = 'image/jpeg', size = 3) => ({version: 1, cipher: 'AES-GCM-256', keyWrap: 'HKDF-SHA256+A256GCM',
  contentIv: Buffer.alloc(12, 1).toString('base64'), wrapSalt: Buffer.alloc(32, 2).toString('base64'),
  wrapIv: Buffer.alloc(12, 3).toString('base64'), wrappedFileKey: Buffer.alloc(48, 4).toString('base64'),
  originalType: type, originalSize: size});

function fixture(hooks = {}) {
  const values = new Map([['users/owner', {documenti: [{id: 'doc_1', type: 'Patente'}]}]]);
  const objects = new Map();
  const metadata = new Map();
  const ref = path => ({path, collection(name) {return collection(`${path}/${name}`);}, async delete() {values.delete(path);},
    async update(patch) {values.set(path, {...values.get(path), ...patch});}});
  const collection = path => ({path, doc(id) {return ref(`${path}/${id}`);}, where(field, op, value) {
    return {path, field, op, value, limit() {return this;}};}});
  const snapshot = path => ({exists: values.has(path), data: () => values.get(path)});
  const db = {doc: ref, collection,
    async runTransaction(run) {return run({
      async get(target) {
        if (target.field) {
          const docs = [...values].filter(([path, value]) => path.startsWith(`${target.path}/`) && (target.op === 'in' ? target.value.includes(value[target.field]) : value[target.field] === target.value))
            .map(([path, value]) => ({id: path.split('/').at(-1), data: () => value}));
          return {size: docs.length, docs};
        }
        return snapshot(target.path);
      },
      create(target, value) {if (values.has(target.path)) throw Error('exists'); values.set(target.path, value);},
      delete(target) {values.delete(target.path);},
      update(target, patch) {values.set(target.path, {...values.get(target.path), ...patch});}
    });}
  };
  const bucket = {file(path, fileOptions = {}) {return {
    ...(hooks.roundGeneration && fileOptions.generation ? {generation: Number(fileOptions.generation)} : {}),
    async save(bytes, options) {
      if (objects.has(path)) throw Object.assign(Error('exists'), {code: 412});
      objects.set(path, Buffer.from(bytes)); metadata.set(path, {generation: hooks.generation || '7', ...options.metadata});
      if (hooks.saved) await hooks.saved({path, values, objects});
    },
    async getMetadata() {
      if (hooks.metadata) await hooks.metadata({path, values, objects, metadata});
      if (!objects.has(path)) throw Object.assign(Error('missing'), {code: 404});
      return [metadata.get(path)];
    },
    async delete(options) {
      assert.equal(typeof options.ifGenerationMatch, 'string');
      assert.equal(fileOptions.generation, options.ifGenerationMatch);
      if (!objects.has(path) || metadata.get(path)?.generation !== options.ifGenerationMatch) throw Object.assign(Error('missing generation'), {code: 404});
      if (hooks.deleting) await hooks.deleting({path, values, objects, metadata, options});
      // An old generation DELETE cannot remove a replacement written while paused.
      if (metadata.get(path)?.generation !== options.ifGenerationMatch) throw Object.assign(Error('missing generation'), {code: 404});
      objects.delete(path);
    }
  };}};
  const service = createProfileDocumentAttachmentService({db, bucket, timestamp: () => 123,
    assertUnlocked: async () => {if (hooks.guard) await hooks.guard({values, objects});}, HttpsError});
  return {service, values, objects, metadata, db};
}

test('percorso allegato documento resta confinato a proprietario, documento e id', () => {
  assert.equal(expectedStoragePath('owner', 'doc_1', 'att_1'), 'users/owner/profile-documents/doc_1/attachments/att_1');
});

test('upload cifrato conferma metadati e byte, poi delete rimuove entrambi', async () => {
  const f = fixture();
  const storagePath = expectedStoragePath('owner', 'doc_1', 'att_1');
  const request = {auth: {uid: 'owner'}, data: {documentId: 'doc_1', attachmentId: 'att_1', storagePath,
    mimeType: 'image/jpeg', size: 3, encryptedName: 'CPFE1.synthetic', encryption: encryption(),
    payloadBase64: Buffer.alloc(19, 7).toString('base64')}};
  assert.deepEqual(await f.service.upload(request), {status: 'confirmed', attachmentId: 'att_1'});
  const record = f.values.get('users/owner/profileDocumentAttachments/att_1');
  assert.equal(record.status, 'ready');
  assert.equal(record.generation, '7');
  assert.deepEqual([...f.objects.get(storagePath)], [...Buffer.alloc(19, 7)]);
  assert.deepEqual(await f.service.remove({auth: {uid: 'owner'}, data: {attachmentId: 'att_1'}}),
    {status: 'confirmed', attachmentId: 'att_1'});
  assert.equal(f.values.has('users/owner/profileDocumentAttachments/att_1'), false);
  assert.equal(f.objects.has(storagePath), false);
});

test('documento inesistente e percorso forgiato falliscono senza oggetti', async () => {
  const f = fixture();
  const base = {auth: {uid: 'owner'}, data: {documentId: 'missing', attachmentId: 'att_1',
    storagePath: expectedStoragePath('owner', 'missing', 'att_1'), mimeType: 'image/jpeg', size: 3,
    encryptedName: 'CPFE1.synthetic', encryption: encryption(), payloadBase64: Buffer.alloc(19, 7).toString('base64')}};
  await assert.rejects(f.service.upload(base), error => error.details?.reason === 'DOCUMENT_NOT_FOUND');
  await assert.rejects(f.service.upload({...base, data: {...base.data, storagePath: 'users/other/file'}}),
    error => error.details?.reason === 'ATTACHMENT_INVALID');
  assert.equal(f.objects.size, 0);
});

test('il contratto unificato accetta video e documenti fino a 32 MiB', async () => {
  assert.equal(MAX_CLEAR_BYTES, 32 * 1024 * 1024);
  for (const [index, mimeType] of ['video/mp4', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].entries()) {
    const f = fixture();
    const attachmentId = `att_${index}`;
    const storagePath = expectedStoragePath('owner', 'doc_1', attachmentId);
    const request = {auth: {uid: 'owner'}, data: {documentId: 'doc_1', attachmentId, storagePath,
      mimeType, size: 3, encryptedName: 'CPFE1.synthetic', encryption: encryption(mimeType),
      payloadBase64: Buffer.alloc(19, 7).toString('base64')}};
    assert.equal((await f.service.upload(request)).status, 'confirmed');
  }
});

const uploadRequest = () => ({auth: {uid: 'owner'}, data: {documentId: 'doc_1', attachmentId: 'att_1',
  storagePath: expectedStoragePath('owner', 'doc_1', 'att_1'), mimeType: 'image/jpeg', size: 3,
  encryptedName: 'CPFE1.synthetic', encryption: encryption(), payloadBase64: Buffer.alloc(19, 7).toString('base64')}});
const recordPath = 'users/owner/profileDocumentAttachments/att_1';

test('reservation persists across paused Storage save and blocks recovery acquisition', async () => {
  let resume, entered;
  const paused = new Promise(resolve => {entered = resolve;});
  const wait = new Promise(resolve => {resume = resolve;});
  const f = fixture({saved: async () => {entered(); await wait;}});
  const uploading = f.service.upload(uploadRequest());
  await paused;
  assert.equal(f.values.get(recordPath).status, 'reserved');
  await assert.rejects(f.db.runTransaction(tx => assertTransactionRecoveryAcquirable(tx, f.db, 'owner')), /STORAGE_PENDING/);
  resume();
  await uploading;
  await f.db.runTransaction(tx => assertTransactionRecoveryAcquirable(tx, f.db, 'owner'));
});

test('uncertain save retains reservation and never deletes unknown bytes', async () => {
  const f = fixture({metadata: async () => {throw Error('uncertain');}});
  await assert.rejects(f.service.upload(uploadRequest()), error => error.details?.reason === 'ATTACHMENT_UPLOAD_FAILED');
  assert.equal(f.values.get(recordPath).status, 'reserved');
  assert.equal(f.objects.size, 1);
});

test('confirmation failure cleans exact generation before releasing owned reservation', async () => {
  let guards = 0;
  const f = fixture({generation: '90071992547409931234', guard: () => {
    if (++guards === 2) throw Error('confirmation failed');
  }, deleting: ({values, options}) => {
    assert.equal(values.get(recordPath).status, 'reserved');
    assert.equal(options.ifGenerationMatch, '90071992547409931234');
  }});
  await assert.rejects(f.service.upload(uploadRequest()));
  assert.equal(f.objects.size, 0);
  assert.equal(f.values.has(recordPath), false);
});

test('upload cleanup cannot delete another reservation or ready record', async () => {
  const f = fixture({metadata: ({values}) => {values.set(recordPath, {...values.get(recordPath),
    reservationId: 'replacement', status: 'ready', generation: 'new'});}});
  await assert.rejects(f.service.upload(uploadRequest()), error => error.details?.reason === 'ATTACHMENT_STATE_CHANGED');
  assert.equal(f.values.get(recordPath).reservationId, 'replacement');
  assert.equal(f.objects.size, 1);
});

test('deletion keeps durable marker across paused I/O and preserves exact generation strings', async () => {
  let resume, entered;
  const paused = new Promise(resolve => {entered = resolve;});
  const wait = new Promise(resolve => {resume = resolve;});
  const f = fixture({generation: '90071992547409931234', deleting: async ({values, options}) => {
    assert.equal(values.get(recordPath).status, 'deleting');
    assert.equal(options.ifGenerationMatch, '90071992547409931234');
    entered(); await wait;
  }});
  await f.service.upload(uploadRequest());
  const removing = f.service.remove({auth: {uid: 'owner'}, data: {attachmentId: 'att_1'}});
  await paused;
  await assert.rejects(f.db.runTransaction(tx => assertTransactionRecoveryAcquirable(tx, f.db, 'owner')), /STORAGE_PENDING/);
  resume(); await removing;
  assert.equal(f.values.has(recordPath), false);
});

test('failed deletion rollback never overwrites replacement metadata', async () => {
  const f = fixture({deleting: ({values}) => {
    values.set(recordPath, {...values.get(recordPath), deletionId: 'replacement', status: 'ready'});
    throw Error('failed');
  }});
  await f.service.upload(uploadRequest());
  await assert.rejects(f.service.remove({auth: {uid: 'owner'}, data: {attachmentId: 'att_1'}}));
  assert.equal(f.values.get(recordPath).deletionId, 'replacement');
  assert.equal(f.objects.size, 1);
});

test('regression: retry resumes durable deletion after Storage success and transient metadata confirmation failure', async () => {
  let guards = 0;
  const f = fixture({guard: () => {if (++guards === 4) throw Error('TRANSIENT_CONFIRMATION_FAILURE');}});
  await f.service.upload(uploadRequest());
  const request = {auth: {uid: 'owner'}, data: {attachmentId: 'att_1'}};
  await assert.rejects(f.service.remove(request), error => error.details?.reason === 'ATTACHMENT_DELETE_FAILED');
  assert.equal(f.values.get(recordPath).status, 'deleting'); assert.equal(f.objects.size, 0);
  assert.deepEqual(await f.service.remove(request), {status: 'confirmed', attachmentId: 'att_1'});
  assert.equal(f.values.has(recordPath), false);
});

test('uncertain exact-generation delete remains resumable with bytes present or absent and never rolls back ready', async () => {
  for (const removed of [false, true]) {
    let failed = false;
    const f = fixture({deleting: ({objects, path}) => {
      if (!failed) {failed = true; if (removed) objects.delete(path); throw Error('UNKNOWN_DELETE_OUTCOME');}
    }});
    await f.service.upload(uploadRequest());
    const request = {auth: {uid: 'owner'}, data: {attachmentId: 'att_1'}};
    await assert.rejects(f.service.remove(request));
    const deletionId = f.values.get(recordPath).deletionId;
    assert.equal(f.values.get(recordPath).status, 'deleting'); assert.equal(f.objects.size, removed ? 0 : 1);
    await assert.rejects(f.db.runTransaction(tx => assertTransactionRecoveryAcquirable(tx, f.db, 'owner')), /STORAGE_PENDING/);
    await f.service.remove(request);
    assert.equal(typeof deletionId, 'string'); assert.equal(f.values.has(recordPath), false);
  }
});

test('paused old-generation retry cannot affect replacement data after another attempt confirms', async () => {
  let resume, entered, deletes = 0;
  const paused = new Promise(resolve => {entered = resolve;});
  const wait = new Promise(resolve => {resume = resolve;});
  const pins = [];
  const f = fixture({deleting: async ({options}) => {
    pins.push(options.ifGenerationMatch);
    if (++deletes === 1) {entered(); await wait;}
  }});
  await f.service.upload(uploadRequest());
  const original = {...f.values.get(recordPath)};
  const request = {auth: {uid: 'owner'}, data: {attachmentId: 'att_1'}};
  const first = f.service.remove(request); await paused;
  const deletionId = f.values.get(recordPath).deletionId;
  await assert.rejects(f.db.runTransaction(tx => assertTransactionRecoveryAcquirable(tx, f.db, 'owner')), /STORAGE_PENDING/);
  assert.deepEqual(await f.service.remove(request), {status: 'confirmed', attachmentId: 'att_1'});
  await f.db.runTransaction(tx => assertTransactionRecoveryAcquirable(tx, f.db, 'owner'));
  const replacement = {...original, generation: '90071992547409931234', digest: 'b'.repeat(64), reservationId: 'new'};
  f.values.set(recordPath, replacement);
  const path = expectedStoragePath('owner', 'doc_1', 'att_1');
  f.metadata.set(path, {generation: replacement.generation}); f.objects.set(path, Buffer.from([8, 9]));
  resume(); await assert.rejects(first);
  assert.equal(typeof deletionId, 'string'); assert.deepEqual(pins, ['7', '7']);
  assert.deepEqual(f.values.get(recordPath), replacement); assert.deepEqual([...f.objects.get(path)], [8, 9]);
});

test('unexpected live generation and rounded SDK generation fail closed with durable metadata untouched', async () => {
  for (const rounding of [false, true]) {
    const f = fixture({generation: '90071992547409931234', roundGeneration: rounding});
    await f.service.upload(uploadRequest());
    const path = expectedStoragePath('owner', 'doc_1', 'att_1');
    if (!rounding) f.metadata.set(path, {generation: '90071992547409931235'});
    await assert.rejects(f.service.remove({auth: {uid: 'owner'}, data: {attachmentId: 'att_1'}}));
    assert.equal(f.values.get(recordPath).status, 'deleting'); assert.equal(f.objects.has(path), true);
  }
});

test('late deletion confirmation cannot remove replacement metadata with a different durable binding', async () => {
  let replacement;
  const f = fixture({metadata: ({values, objects}) => {
    if (!objects.size && replacement) values.set(recordPath, replacement);
  }});
  await f.service.upload(uploadRequest());
  replacement = {...f.values.get(recordPath), status: 'ready', generation: '8', digest: 'b'.repeat(64), reservationId: 'replacement'};
  await assert.rejects(f.service.remove({auth: {uid: 'owner'}, data: {attachmentId: 'att_1'}}));
  assert.deepEqual(f.values.get(recordPath), replacement);
});
