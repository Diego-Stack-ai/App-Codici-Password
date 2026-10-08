import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';

globalThis.File = class File {
  constructor(name, type, size, bytes = null) {
    this.name = name;
    this.type = type;
    this.size = size;
    this.bytes = bytes || new Uint8Array(size);
  }
  arrayBuffer() { return Promise.resolve(this.bytes.buffer.slice(0)); }
};

const source = await readFile(
  new URL('../Frontend/public/assets/js/modules/shared/attachment-security.js', import.meta.url),
  'utf8',
);
const security = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

async function withCryptoProbe(fault, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const captured = [];
  const calls = {};
  const subtle = new Proxy(webcrypto.subtle, {get(target, name) {
    const method = target[name];
    if (typeof method !== 'function') return method;
    return async (...args) => {
      const call = `${name}:${calls[name] = (calls[name] || 0) + 1}`;
      if (name === 'importKey') captured.push(args[1]);
      if (name === 'encrypt' && calls[name] === 1) captured.push(args[2]);
      if (call === fault) throw new Error('INJECTED');
      return method.apply(target, args);
    };
  }});
  Object.defineProperty(globalThis, 'crypto', {configurable: true, value: {
    subtle, getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  }});
  try { await run(captured, calls); }
  finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
}

function assertWiped(buffers) {
  assert.ok(buffers.length > 0);
  for (const buffer of buffers) {
    const bytes = ArrayBuffer.isView(buffer)
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) : new Uint8Array(buffer);
    assert.ok(bytes.every(byte => byte === 0), 'owned secret buffer must be zeroed');
  }
}

for (const fault of [null, 'importKey:1', 'encrypt:1', 'importKey:2', 'deriveKey:1', 'encrypt:2', 'read']) {
  test(`encrypt wipes owned buffers on ${fault || 'success'} without changing File`, async () => {
    const clear = new TextEncoder().encode('synthetic attachment');
    const file = new File('test.txt', 'text/plain', clear.length, clear);
    let reads = 0;
    const read = file.arrayBuffer.bind(file);
    file.arrayBuffer = async () => { reads++; if (fault === 'read') throw new Error('INJECTED'); return read(); };
    await withCryptoProbe(fault, async (buffers) => {
      if (fault) await assert.rejects(security.encryptAttachmentFile(file, 'synthetic-key'), /INJECTED/);
      else {
        const result = await security.encryptAttachmentFile(file, 'synthetic-key');
        assertWiped(buffers);
        assert.deepEqual([result.metadata.contentIv, result.metadata.wrapSalt, result.metadata.wrapIv]
          .map(value => Buffer.from(value, 'base64').length), [12, 32, 12]);
        const restored = await security.decryptAttachmentBytes(await result.blob.arrayBuffer(), result.metadata, 'synthetic-key');
        assert.deepEqual(new Uint8Array(restored), clear);
      }
      assertWiped(buffers);
    });
    assert.equal(reads, fault === 'importKey:1' ? 0 : 1);
    assert.deepEqual(file.bytes, new TextEncoder().encode('synthetic attachment'));
  });
}

for (const fault of [null, 'importKey:1', 'deriveKey:1', 'decrypt:1', 'importKey:2', 'decrypt:2', 'wrong-key']) {
  test(`decrypt wipes owned keys on ${fault || 'success'} and preserves caller ciphertext`, async () => {
    const clear = new TextEncoder().encode('synthetic attachment');
    const encrypted = await security.encryptAttachmentFile(new File('test.txt', 'text/plain', clear.length, clear), 'synthetic-key');
    const ciphertext = new Uint8Array(await encrypted.blob.arrayBuffer());
    const before = ciphertext.slice();
    await withCryptoProbe(fault, async (buffers) => {
      const pending = security.decryptAttachmentBytes(ciphertext, encrypted.metadata, fault === 'wrong-key' ? 'wrong' : 'synthetic-key');
      if (fault) await assert.rejects(pending);
      else assert.deepEqual(new Uint8Array(await pending), clear);
      assertWiped(buffers);
      assert.deepEqual(ciphertext, before);
    });
  });
}

test('accetta file previsti e rifiuta dimensioni o MIME pericolosi', () => {
  assert.doesNotThrow(() => security.validateAttachmentFile(new File('doc.pdf', 'application/pdf', 1024)));
  assert.throws(() => security.validateAttachmentFile(new File('attack.html', 'text/html', 1024)));
  assert.throws(() => security.validateAttachmentFile(new File('large.pdf', 'application/pdf', 25 * 1024 * 1024 + 1)));
  assert.throws(() => security.validateAttachmentFile(new File('avatar.pdf', 'application/pdf', 1024), {imageOnly: true}));
});

test('genera nomi Storage casuali senza includere il nome originale', () => {
  const generated = security.createStorageObjectName(new File('../Segreto Personale.PDF', 'application/pdf', 10));
  assert.match(generated, /^\d+_[a-f0-9-]+\.pdf$/);
  assert.doesNotMatch(generated, /segreto|personale|\.\./i);
});

test('normalizza soltanto URL web e respinge protocolli attivi', () => {
  assert.equal(security.normalizeExternalUrl('example.com/path'), 'https://example.com/path');
  assert.equal(security.normalizeExternalUrl('https://example.com/path'), 'https://example.com/path');
  assert.equal(security.normalizeExternalUrl('javascript:alert(1)'), null);
  assert.equal(security.normalizeExternalUrl('data:text/html,test'), null);
});

test('cifra e decifra un allegato soltanto con la chiave Vault corretta', async () => {
  const clear = new TextEncoder().encode('contenuto riservato');
  const file = new File('documento.txt', 'text/plain', clear.length, clear);
  const encrypted = await security.encryptAttachmentFile(file, 'vault-key-corretta');
  const ciphertext = await encrypted.blob.arrayBuffer();
  assert.notDeepEqual(new Uint8Array(ciphertext), clear);
  const decrypted = await security.decryptAttachmentBytes(
    ciphertext, encrypted.metadata, 'vault-key-corretta',
  );
  assert.deepEqual(new Uint8Array(decrypted), clear);
  await assert.rejects(() => security.decryptAttachmentBytes(
    ciphertext, encrypted.metadata, 'vault-key-errata',
  ));
});
