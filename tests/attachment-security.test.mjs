import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

globalThis.File = class File {
  constructor(name, type, size) {
    this.name = name;
    this.type = type;
    this.size = size;
  }
};

const source = await readFile(
  new URL('../Frontend/public/assets/js/modules/shared/attachment-security.js', import.meta.url),
  'utf8',
);
const security = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

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
