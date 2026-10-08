import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = (await readFile(new URL(
  '../Frontend/public/assets/js/modules/shared/shared-attachment-access.js', import.meta.url), 'utf8'))
  .replace(/^import[\s\S]*?;\r?\n/gm, '')
  .replace(/^export /gm, '') + '\n' +
  'globalThis.syncPrivateAttachmentAccess = syncPrivateAttachmentAccess;' +
  'globalThis.decryptReceivedPrivateAttachment = decryptReceivedPrivateAttachment;';

function fixture() {
  const published = [], wiped = [];
  const context = vm.createContext({
    Object, Set,
    functions: {},
    httpsCallable: (_functions, name) => async payload => published.push({name, payload}),
    unwrapAttachmentFileKey: async () => new Uint8Array(32).fill(7),
    sharedAttachmentContextId: async value => `context-${value.attachmentId}`,
    getSharingPublicIdentity: async uid => ({schemaVersion: 1, agreement: 'ECDH-P256', uid, publicJwk: {}}),
    crypto: {subtle: {importKey: async () => 'public-key'}},
    wrapRecordKeyForRecipient: async (key, publicKey, contextId, recipientId) => {
      assert.equal(publicKey, 'public-key');
      return {version: 1, recipientId, contextId, firstByte: key[0]};
    },
    ensureSharingIdentity: async () => ({privateKey: 'private-key'}),
    unwrapRecordKeyForRecipient: async (envelope, privateKey, contextId, recipientId) => {
      assert.equal(privateKey, 'private-key');
      assert.equal(envelope.recipientId, recipientId);
      assert.equal(envelope.contextId, contextId);
      const key = new Uint8Array(32).fill(9);
      const fill = key.fill.bind(key);
      key.fill = value => { wiped.push(value); return fill(value); };
      return key;
    },
    decryptAttachmentBytesWithFileKey: async (_bytes, _encryption, key) => {
      assert.equal(key[0], 9);
      return new Uint8Array([1, 2, 3]);
    },
  });
  vm.runInContext(source, context);
  return {context, published, wiped};
}

test('owner publishes one envelope per accepted recipient and skips existing envelopes', async () => {
  const {context, published} = fixture();
  const attachments = [{id: 'attachment-1', encryption: {version: 1},
    recipientKeyEnvelopes: {'guest-2': {existing: true}}}];
  const result = await context.syncPrivateAttachmentAccess({
    ownerUid: 'owner-1', accountId: 'account-1', vaultKeyMaterial: 'owner-key', attachments,
    account: {sharedWith: {
      first: {status: 'accepted', uid: 'guest-1'},
      second: {status: 'accepted', uid: 'guest-2'},
      pending: {status: 'pending', uid: 'guest-3'},
    }},
  });
  assert.deepEqual({...result}, {updated: 1, waiting: 0});
  assert.equal(published.length, 1);
  assert.equal(published[0].name, 'publishSharedAttachmentEnvelopes');
  assert.deepEqual(Object.keys(published[0].payload.envelopes), ['guest-1']);
  assert.equal(attachments[0].recipientKeyEnvelopes['guest-1'].recipientId, 'guest-1');
});

test('recipient requires its envelope and wipes the unwrapped file key', async () => {
  const {context, wiped} = fixture();
  const attachment = {id: 'attachment-1', encryption: {version: 1},
    recipientKeyEnvelopes: {'guest-1': {
      recipientId: 'guest-1', contextId: 'context-attachment-1'
    }}};
  const clear = await context.decryptReceivedPrivateAttachment({
    ownerUid: 'owner-1', accountId: 'account-1', attachment,
    recipientUid: 'guest-1', vaultKeyMaterial: 'guest-key', ciphertext: new Uint8Array([8])
  });
  assert.deepEqual([...clear], [1, 2, 3]);
  assert.deepEqual(wiped, [0]);
  await assert.rejects(context.decryptReceivedPrivateAttachment({
    ownerUid: 'owner-1', accountId: 'account-1', attachment: {...attachment, recipientKeyEnvelopes: {}},
    recipientUid: 'guest-1', vaultKeyMaterial: 'guest-key', ciphertext: new Uint8Array([8])
  }), /SHARED_ATTACHMENT_KEY_PENDING/);
});
