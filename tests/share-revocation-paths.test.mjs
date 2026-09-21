import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// M7-R5 — guardia di regressione sul difetto riprodotto: la revoca di un ospite
// accettato non deve più scrivere nella sua raccolta `notifications` dentro la
// transazione (le Rules la negano e annullavano l'intera revoca). La consegna
// avviene dopo, tramite l'helper non bloccante.
const files = [
  'Frontend/public/assets/js/modules/privato/dettaglio-privato-sharing.js',
  'Frontend/public/assets/js/modules/azienda/dettaglio-azienda-sharing.js',
  'Frontend/public/assets/js/modules/shared/detail-account-mode.js',
  'Frontend/public/assets/js/modules/privato/form-privato-save.js',
  'Frontend/public/assets/js/modules/azienda/form-azienda-save.js'
];
// Forme esatte che causavano il difetto: scrittura dell'ospite dentro la transazione.
const legacyShapes = [
  "transaction.set(guestNotifRef",
  "transaction.set(doc(collection(db, 'users', guest.uid, 'notifications'))",
  "transaction.set(doc(collection(db, 'users', guestUid, 'notifications'))"
];

for (const file of files) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

  test(`${file}: usa la consegna non bloccante e non scrive più nella raccolta dell'ospite in transazione`, () => {
    assert.match(source, /from '[^']*share-revocation-notice\.js'/, 'deve importare l\'helper');
    assert.match(source, /attemptShareRevocationNotice\(/, 'deve usare la consegna non bloccante');
    for (const shape of legacyShapes) {
      assert.equal(source.includes(shape), false, `forma che ha causato il difetto ancora presente: ${shape}`);
    }
  });
}

test('l\'helper è l\'unico punto in cui si tenta la consegna all\'ospite', () => {
  const helper = readFileSync(new URL('../Frontend/public/assets/js/modules/shared/share-revocation-notice.js', import.meta.url), 'utf8');
  assert.match(helper, /status: 'not-delivered'/, 'un errore deve produrre un esito esplicito');
  assert.match(helper, /status: 'delivered'/);
  for (const file of files) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal(source.includes('not-delivered'), false, 'l\'esito esplicito deve restare nell\'helper');
  }
});
