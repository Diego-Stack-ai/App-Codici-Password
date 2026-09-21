import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// M7-R5 correzione (revisione Codex 21/09/2026) — guardia di regressione.
// Il client del proprietario non deve MAI tentare di scrivere nella raccolta
// `notifications` di un altro utente: le Rules la concedono solo al suo
// proprietario, il tentativo non può riuscire e — se resta pendente — non deve
// poter rimandare il messaggio di successo dopo una revoca già confermata.
// La notifica all'ospite richiede un backend dedicato, non implementato.
const files = {
  'privato/dettaglio-privato-sharing.js': ['ownerId'],
  'azienda/dettaglio-azienda-sharing.js': ['uid'],
  'shared/detail-account-mode.js': [],
  'privato/form-privato-save.js': ['currentUid'],
  'azienda/form-azienda-save.js': ['currentUid']
};

for (const [file, ownerVariables] of Object.entries(files)) {
  const source = readFileSync(new URL(`../Frontend/public/assets/js/modules/${file}`, import.meta.url), 'utf8');
  const label = `Frontend/public/assets/js/modules/${file}`;

  test(`${label}: nessuna scrittura client verso la raccolta notifiche di un altro utente`, () => {
    const paths = [...source.matchAll(/users['"],\s*([A-Za-z_$][\w$]*)\s*,\s*['"]notifications['"]/g)].map(match => match[1]);
    for (const variable of paths) {
      assert.ok(ownerVariables.includes(variable),
        `percorso notifiche non del proprietario: ${variable}`);
    }
  });

  test(`${label}: nessuna attesa aggiunta dopo il commit e nessun residuo del vecchio tentativo`, () => {
    assert.equal(source.includes('Promise.allSettled'), false, 'nessuna attesa di scritture dopo il commit');
    assert.equal(source.includes('attemptShareRevocationNotice'), false, 'nessun helper di consegna nel client');
    assert.equal(source.includes('share-revocation-notice'), false, 'nessun import dell\'helper');
    assert.equal(source.includes('setDoc('), false, 'nessuna scrittura aggiuntiva dopo la transazione');
    assert.equal(source.includes('revokedGuests'), false, 'nessun accumulo ritentabile di ospiti');
  });

  test(`${label}: la revoca resta transazionale e mostra l'esito dopo il commit`, () => {
    assert.match(source, /runTransaction\(/, 'la revoca deve restare transazionale');
    assert.match(source, /showToast\(/, 'deve restare un messaggio di esito');
    // Nessuna scrittura di rete dopo il commit: l'unico `await` che segue la
    // transazione è quello già esistente (guardia di vista, ricaricamento).
    assert.equal(/Promise\.allSettled|\.then\(.*notifications/s.test(source), false);
  });
}

test('l\'helper rimosso non esiste più e nessun modulo lo importa', () => {
  assert.throws(() => readFileSync(new URL('../Frontend/public/assets/js/modules/shared/share-revocation-notice.js', import.meta.url), 'utf8'),
    /ENOENT/, 'il candidato di consegna non deve restare come codice morto');
});
