import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Il modulo è un ESM del browser con estensione .js: si importa dalla sorgente,
// come gli altri test dei moduli pubblicati.
const source = await readFile(new URL('../Frontend/public/assets/js/modules/shared/share-revocation-notice.js', import.meta.url), 'utf8');
const {attemptShareRevocationNotice, shareRevocationNotice} =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

// M7-R5 — la notifica all'ospite non è scrivibile dal client del proprietario
// (la raccolta `notifications` è del solo proprietario). Deve quindi essere un
// tentativo successivo e non bloccante: non può far fallire la revoca e non può
// essere presentata come consegnata quando non lo è.
const failing = code => () => Promise.reject(Object.assign(new Error('negato'), {code}));

test('una consegna riuscita riporta delivered e non registra nulla', async () => {
  const logged = [];
  const outcome = await attemptShareRevocationNotice(() => Promise.resolve(), {log: (...args) => logged.push(args)});
  assert.equal(outcome.status, 'delivered');
  assert.deepEqual(logged, []);
});

test('una consegna negata non solleva mai e riporta l\'esito esplicito', async () => {
  const logged = [];
  const outcome = await attemptShareRevocationNotice(failing('permission-denied'), {log: (...args) => logged.push(args)});
  assert.deepEqual(outcome, {status: 'not-delivered', code: 'permission-denied'});
  assert.deepEqual(logged, [['SHARE_REVOCATION_NOTICE_NOT_DELIVERED', 'permission-denied']]);
});

test('un errore senza codice resta un esito non consegnato', async () => {
  const outcome = await attemptShareRevocationNotice(() => { throw new Error('sintetico'); });
  assert.equal(outcome.status, 'not-delivered');
  assert.equal(outcome.code, null);
});

test('un tentativo non eseguibile e un log difettoso non propagano errori', async () => {
  assert.deepEqual(await attemptShareRevocationNotice(null), {status: 'unavailable'});
  assert.deepEqual(await attemptShareRevocationNotice('non-una-funzione'), {status: 'unavailable'});
  const outcome = await attemptShareRevocationNotice(failing('permission-denied'),
    {log: () => { throw new Error('log rotto'); }});
  assert.equal(outcome.status, 'not-delivered');
});

test('il payload di revoca contiene solo i campi previsti', () => {
  const full = shareRevocationNotice({accountName: 'Account sintetico', ownerEmail: 'owner@example.invalid', guestEmail: 'guest@example.invalid'});
  assert.equal(full.type, 'share_revoked');
  assert.equal(full.accountName, 'Account sintetico');
  assert.equal(full.ownerEmail, 'owner@example.invalid');
  assert.equal(full.guestEmail, 'guest@example.invalid');
  assert.equal(full.read, false);
  assert.equal(typeof full.timestamp, 'string');
  const minimal = shareRevocationNotice();
  assert.equal(minimal.accountName, 'Account');
  assert.equal('ownerEmail' in minimal, false);
  assert.equal('guestEmail' in minimal, false);
  assert.match(minimal.message, /un account condiviso/);
});
