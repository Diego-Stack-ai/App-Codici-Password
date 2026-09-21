import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';

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

// M7-R7C-1 — identità degli inviti per ciclo di condivisione: i tre scrittori
// devono costruire l'ID con l'helper condiviso e dichiarare il ciclo, così un
// reinvito dopo l'archiviazione non sovrascrive l'invito storico.
const writers = ['shared/detail-account-mode.js', 'privato/form-privato-save.js', 'azienda/form-azienda-save.js'];
for (const file of writers) {
  test(`Frontend/public/assets/js/modules/${file}: gli inviti usano l'ID per ciclo`, () => {
    const source = readFileSync(new URL(`../Frontend/public/assets/js/modules/${file}`, import.meta.url), 'utf8');
    assert.match(source, /inviteIdForGuest\(/, 'l\'ID dell\'invito passa dall\'helper condiviso');
    assert.match(source, /sharingCycleOf\(/, 'il ciclo viene letto e validato');
    assert.match(source, /cycle: sharingCycle|cycle,/, 'l\'invito dichiara il proprio ciclo');
    // Nessun ID costruito a mano: il formato vive in un solo posto.
    assert.equal(/invites['"],\s*`\$\{[^}]+\}_\$\{[^}]+\}`/.test(source), false, 'nessun ID invito costruito a mano');
    assert.match(source, /status === 'suspended'/, 'una voce sospesa richiede un nuovo invito');
    // M7-AUDIT-5C: ogni creazione/reinvito dichiara una base opaca **nuova** per
    // l'istanza di invito, generata con `crypto.randomUUID()`: l'espressione è
    // vincolata per costruzione, quindi non può derivare dall'email, dalla sua
    // chiave sanificata o dall'id del documento.
    assert.match(source, /auditRef:\s*crypto\.randomUUID\(\)/,
      'l\'invito dichiara la base opaca dell\'istanza con crypto.randomUUID()');
  });
}

// M7-R7C-4 — la vista ospite riconosce la sospensione dall'invito, non
// dall'Account (che le Rules negano) e solo per inviti già accettati.
test('inviti: la scoperta dell\'ospite resta limitata agli inviti accettati', () => {
  const repository = readFileSync(new URL('../Frontend/public/assets/js/modules/data/vault-repository.js', import.meta.url), 'utf8');
  assert.match(repository, /where\('status', '==', 'accepted'\)/, 'un invito pendente non è un accesso');
  assert.match(repository, /sharingState === 'suspended'/, 'lo stato sospeso viene letto dall\'invito');
  for (const file of ['privato/account_privati.js', 'privato/dettaglio_account_privato.js', 'azienda/dettaglio_account_azienda.js']) {
    assert.match(readFileSync(new URL(`../Frontend/public/assets/js/modules/${file}`, import.meta.url), 'utf8'),
      /findSuspendedGuestInvite|_suspended/, `${file}: deve riconoscere l'accesso sospeso`);
  }
});

test('utils: il ciclo legacy è 0 e i valori malformati sono invalidi', async () => {
  const source = await readFile(new URL('../Frontend/public/assets/js/utils.js', import.meta.url), 'utf8');
  const helpers = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.equal(helpers.sharingCycleOf({}), 0, 'assenza = ciclo legacy 0');
  assert.equal(helpers.sharingCycleOf({sharingCycle: 2}), 2);
  for (const invalid of [-1, 1.5, '1', null, Number.MAX_SAFE_INTEGER + 2]) {
    assert.equal(helpers.sharingCycleOf({sharingCycle: invalid}), null, `ciclo invalido: ${invalid}`);
  }
  assert.equal(helpers.nextSharingCycle({}), 1);
  assert.equal(helpers.nextSharingCycle({sharingCycle: Number.MAX_SAFE_INTEGER}), null, 'nessun overflow');
  assert.equal(helpers.nextSharingCycle({sharingCycle: -1}), null);
  assert.equal(helpers.inviteIdForGuest('account', 'guest_key', 0), 'account_guest_key', 'ciclo legacy: ID storico');
  assert.equal(helpers.inviteIdForGuest('account', 'guest_key', 3), 'account_guest_key_c3');
});
