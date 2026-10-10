const test = require('node:test');
const assert = require('node:assert/strict');
const {createProfileDocumentAttachmentService, expectedStoragePath} = require('../profile-document-attachment-service');

class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
const encryption = (type = 'image/jpeg', size = 3) => ({version: 1, cipher: 'AES-GCM-256', keyWrap: 'HKDF-SHA256+A256GCM',
  contentIv: Buffer.alloc(12, 1).toString('base64'), wrapSalt: Buffer.alloc(32, 2).toString('base64'),
  wrapIv: Buffer.alloc(12, 3).toString('base64'), wrappedFileKey: Buffer.alloc(48, 4).toString('base64'),
  originalType: type, originalSize: size});

function fixture() {
  const values = new Map([['users/owner', {documenti: [{id: 'doc_1', type: 'Patente'}]}]]);
  const objects = new Map();
  const ref = path => ({path, collection(name) {return collection(`${path}/${name}`);}, async delete() {values.delete(path);},
    async update(patch) {values.set(path, {...values.get(path), ...patch});}});
  const collection = path => ({path, doc(id) {return ref(`${path}/${id}`);}, where(field, op, value) {
    assert.equal(op, '=='); return {path, field, value, limit() {return this;}};}});
  const snapshot = path => ({exists: values.has(path), data: () => values.get(path)});
  const db = {collection,
    async runTransaction(run) {return run({
      async get(target) {
        if (target.field) {
          const docs = [...values].filter(([path, value]) => path.startsWith(`${target.path}/`) && value[target.field] === target.value)
            .map(([path, value]) => ({id: path.split('/').at(-1), data: () => value}));
          return {size: docs.length, docs};
        }
        return snapshot(target.path);
      },
      create(target, value) {if (values.has(target.path)) throw Error('exists'); values.set(target.path, value);},
      update(target, patch) {values.set(target.path, {...values.get(target.path), ...patch});}
    });}
  };
  const bucket = {file(path) {return {
    async save(bytes) {if (objects.has(path)) throw Object.assign(Error('exists'), {code: 412}); objects.set(path, Buffer.from(bytes));},
    async getMetadata() {return [{generation: '7'}];},
    async delete() {objects.delete(path);}
  };}};
  const service = createProfileDocumentAttachmentService({db, bucket, timestamp: () => 123,
    assertUnlocked: async () => {}, HttpsError});
  return {service, values, objects};
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
