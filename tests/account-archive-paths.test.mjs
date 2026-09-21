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
    // Correzione M7-R6: il confronto usa i marker osservati nel record caricato.
    assert.match(source, /revision: account\?\.revision, updatedAt: account\?\.updatedAt/,
      `${module}: la revisione osservata e il marker updatedAt devono essere passati al servizio`);
    assert.match(source, /ARCHIVE_UPDATED_AT_CONFLICT/, `${module}: anche il conflitto su updatedAt invita ad aggiornare`);
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

// M7-R6 correzione (revisione Codex 21/09/2026): il form aziendale deve usare il
// marker osservato ALL'APERTURA, non una rilettura appena prima di archiviare,
// altrimenti una modifica concorrente dopo l'apertura passerebbe inosservata.
test('il form aziendale usa la revisione osservata all\'apertura, senza rileggere prima di archiviare', () => {
  const form = readFileSync(new URL('../Frontend/public/assets/js/modules/azienda/form-azienda-save.js', import.meta.url), 'utf8');
  assert.match(form, /observedRevision/, 'deve ricevere la revisione osservata');
  assert.match(form, /observedUpdatedAt/, 'deve ricevere il marker updatedAt osservato');
  assert.equal(form.includes('getDocFromServer'), false, 'nessuna rilettura tardiva del documento');
  const page = readFileSync(new URL('../Frontend/public/assets/js/modules/azienda/form_account_azienda.js', import.meta.url), 'utf8');
  assert.match(page, /observedRevision/, 'la pagina deve conservare la revisione letta all\'apertura');
  assert.match(page, /window\.deleteAccount[\s\S]*observedRevision/, 'la pagina deve passarla all\'archiviazione');
  // Correzione M7-R6 (secondo rilievo Codex): lo stato di modulo non deve
  // sopravvivere a un rimontaggio, e l'azione resta chiusa finché il
  // caricamento del montaggio corrente non ha confermato il documento.
  assert.match(page, /observedRevision = undefined;/, 'il marker osservato va azzerato a ogni montaggio');
  assert.match(page, /markerConfirmed = false;/, 'la conferma del montaggio corrente va azzerata a ogni montaggio');
  assert.match(page, /if \(!markerConfirmed\)/, 'l\'archiviazione deve essere bloccata senza conferma');
  // Correzione M7-R6 (terzo rilievo Codex): i caricamenti possono sovrapporsi,
  // quindi il risultato va legato a un'epoch immutabile del montaggio.
  assert.match(page, /let mountEpoch = 0;/, 'serve un\'epoch di montaggio');
  assert.match(page, /const mount = \+\+mountEpoch;/, 'ogni init deve aprire una nuova epoch');
  assert.match(page, /async function loadData\(mount\)/, 'il caricamento deve ricevere l\'epoch del montaggio');
  assert.match(page, /if \(stale\(\)\) return;/, 'un caricamento superato deve uscire dopo le attese');
});
