import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// M7-R6 — decisione di Diego: per gli Account propri il pulsante «Elimina» deve
// SPOSTARE nell'Archivio, non cancellare. La cancellazione definitiva resta
// possibile soltanto dall'Archivio con la callable purgeArchivedAccount.
const modules = [
  'privato/account_privati.js',
  'azienda/account_azienda.js',
  'azienda/form-azienda-save.js'
];

for (const module of modules) {
  const source = readFileSync(new URL(`../Frontend/public/assets/js/modules/${module}`, import.meta.url), 'utf8');
  const label = `Frontend/public/assets/js/modules/${module}`;

  test(`${label}: nessuna cancellazione diretta del documento Account`, () => {
    assert.equal(/deleteDoc\(\s*doc\(/.test(source), false, 'nessun deleteDoc di documento');
    assert.equal(/batch\.delete\(/.test(source), false, 'nessun batch.delete');
    assert.equal(/writeBatch\(/.test(source), false, 'nessun writeBatch');
    assert.equal(source.includes('deleteDoc'), false, 'nessun residuo di deleteDoc');
  });

  test(`${label}: l'eliminazione passa dall'archiviazione canonica`, () => {
    assert.match(source, /archiveAccount\(/, 'deve usare archiveAccount');
    // Il servizio può essere importato staticamente oppure con import differito
    // (il form aziendale lo carica solo alla conferma, per il budget di pagina).
    assert.match(source, /archive-account-service\.js/, 'deve usare il servizio di Archivio');
  });

  test(`${label}: la conferma dice che l'Account va nell'Archivio`, () => {
    assert.match(source, /confirm_archive_title/, 'titolo di conferma dedicato');
    assert.match(source, /confirm_archive_msg/, 'messaggio di conferma dedicato');
    assert.equal(source.includes('confirm_delete_title'), false, 'nessuna conferma di eliminazione diretta');
  });
}

test('le liste mantengono il blocco per gli Account ricevuti come ospite', () => {
  for (const module of ['privato/account_privati.js', 'azienda/account_azienda.js']) {
    const source = readFileSync(new URL(`../Frontend/public/assets/js/modules/${module}`, import.meta.url), 'utf8');
    assert.match(source, /dataset\.owner !== 'true'/, `${module}: la guardia di proprietà deve restare`);
  }
});

test('la cancellazione definitiva resta soltanto dall\'Archivio', () => {
  const service = readFileSync(new URL('../Frontend/public/assets/js/modules/settings/archive-account-service.js', import.meta.url), 'utf8');
  assert.match(service, /purgeArchivedAccount/, 'il purge resta la via della cancellazione definitiva');
  for (const module of modules) {
    const source = readFileSync(new URL(`../Frontend/public/assets/js/modules/${module}`, import.meta.url), 'utf8');
    assert.equal(source.includes('purgeArchivedAccount'), false, `${module}: nessuna cancellazione definitiva diretta`);
    assert.equal(source.includes('DELETE_FOREVER'), false, `${module}: nessuna conferma di cancellazione definitiva`);
  }
});
