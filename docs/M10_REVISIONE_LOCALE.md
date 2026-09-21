# M10 — Revisione locale preparatoria della parte OWASP, 22/09/2026

> **Stato:** revisione **locale e preparatoria**, su questo ramo e a questo commit. **Non** è la revisione
> OWASP finale, **non** è l'audit indipendente di crittografia e condivisione, **non** certifica l'app.
> M10-1 resta **aperto**.
> **Base:** ramo `integration/vault-shell-v127-security`, HEAD `2679285c`, versione `1.2.127`.
> **Metodo:** riuso dei controlli automatici già presenti nel repository + riesame mirato del codice sui
> percorsi a rischio più alto. **Nessuna modifica** a runtime, Functions, Rules, dipendenze o dati;
> nessun test nuovo è stato necessario: nessuna osservazione ha richiesto una prova aggiuntiva.
> **Riferimenti:** `docs/M10_HARDENING_RILASCIO.md`, `docs/PIANO_MATURITA_PROFESSIONALE.md` (M10),
> `docs/CENSIMENTO_GATE_M6_M10.md` (riga M10-1), `docs/ARCHITETTURA_SICUREZZA_V1.md`,
> `docs/AUDIT_PROGETTO_FASE2_STATICO.md`, `docs/AUDIT_VAULT_SESSION_P0.md`.

## 1. Ambito e limite di metodo

Esaminati: confini Auth/Vault, isolamento fra proprietari, condivisione e revoca, cifratura e gestione
delle chiavi, backup/ripristino, coda offline, dati sensibili in log e nel DOM, dipendenze di produzione.

**Non** esaminati o non dimostrabili qui: comportamento della console Firebase (App Check Enforcement,
Rules distribuite, indici, log), dispositivo fisico, copia non produttiva, penetrazione attiva, revoca di
un token già emesso, resistenza della crittografia a un attaccante con accesso al dispositivo. Questi
punti restano i gate esterni di M10 e **non** sono sostituiti da questo documento.

## 2. Controlli automatici rieseguiti (riuso, non reinterpretazione)

| Comando | Esito reale (22/09/2026) |
|---|---|
| `npm run test:release-hardening` | exit 0 — 5 header di sicurezza, **15 callable con App Check**, Rules vincolate all'UID |
| `npm run test:firestore-rules` | exit 0 — **65/65** test, `fail 0` |
| `npm run test:storage-rules` | exit 0 — **2 + 5 + 5** test, `fail 0` |
| `npm run test:security` | exit 0 (audit flussi + test di input/bootstrap/auth gate) |
| `npm run test:functions-security` | exit 0 |
| `npm run test:js-syntax` | exit 0 — **161 moduli** verificati |
| `npm run test:dependencies` | exit 0 — **nessuna dipendenza circolare** |
| `npm run test:static-references` | exit 0 — **235 file** |
| `npm run test:html-purity` | exit 0 — struttura separata da stile e comportamento inline |
| `npm run test:lightweight` | exit 0 — OCR/QR esclusi dal runtime pubblico |
| `npm run test:crypto` | exit 0 — 2/2 |
| `npm run test:sharing-prototype` | exit 0 — **38** test, `fail 0` |
| `npm run test:backup-prototype` | exit 0 — **99** test, `fail 0` |
| `npm run test:offline-write-prototype` | exit 0 — **121** test, `fail 0` |
| `npm audit --omit=dev` | **0 vulnerabilità note** nelle dipendenze di produzione (database locale, oggi; non è l'audit indipendente) |

## 3. Matrice di autorizzazione degli ingressi esportati (letta dal codice)

24 ingressi esportati: 15 `onCall` con `enforceAppCheck: true` più trigger e schedulazioni. Per i
callable la tabella distingue dove sta il controllo, perché **i presidi vivono anche negli helper**:

| Ingresso | App Check | Autenticazione | Vincolo di proprietario |
|---|---|---|---|
| `applyOfflineMutation`, `applyPrivateAccountMutation` | sì | `request.auth` obbligatorio | `requireMutationOwner`: `data.uid === request.auth.uid`, altrimenti `MUTATION_OWNER_MISMATCH` |
| `trashSyncRecord`, `restoreSyncRecord` | sì | **in `runRecoveryCommand`**: `unauthenticated` senza sessione | percorsi costruiti su `users/{request.auth.uid}`; transazione con ricevuta idempotente |
| `restoreBackupChunk` | sì | `request.auth` obbligatorio | `expectedOwnerUid` validato dal chunk (`BACKUP_OWNER_MISMATCH` → `failed-precondition`) |
| `purgeArchivedAccount`, `manageSharedVaultData`, `manageAccountWidget`, `manageReceivedDeadline` | sì | `request.auth` obbligatorio | `expectedOwnerUid` presente nel corpo del callable |
| `createMfaRecoveryCodes`, `revokeAllSessions`, `sendDeadlinePushTest`, `deleteContactIfUnused`, `respondToInvitation` | sì | `request.auth` obbligatorio | percorsi costruiti sullo UID autenticato |
| `recoverMfaWithCode` | sì | **nessuna sessione per progetto** | primo fattore (password) verificato su Identity Toolkit, codice di recupero monouso, limite per email+IP (§4.7) |
| Trigger (`onInviteCreated/Written`, `onPrivateAccountWritten`, `onCompanyAccountWritten`, `onScadenzaCreated/Updated`) e schedulazioni (`checkDeadlines`, `purgeExpiredAuditEvents`) | non applicabile (non sono callable client) | n/d | girano con identità di servizio; non accettano input client |
| `getAppPresentation` (`onRequest`) | non applicabile | pubblica per progetto | sola presentazione, nessun dato del Vault |

**Nessun callable che tratti dati di un proprietario risulta privo di autenticazione o di vincolo di
proprietario**, una volta considerati gli helper (`requireMutationOwner`, `runRecoveryCommand`,
`validateRestoreChunk`): una lettura della sola riga `exports.X = onCall(...)` avrebbe prodotto **falsi
positivi** (per esempio su `trashSyncRecord`).

## 4. Aree di codice esaminate ed esito

1. **Randomness e primitive.** `crypto.getRandomValues` **27** usi, `crypto.randomUUID` **25**,
   `AES-GCM` **39** riferimenti, `PBKDF2` **13**, `SHA-256` **11**, `SHA-1` **0** nel runtime.
   **Nessun** uso di `Math.random` per chiavi, IV, token o identificatori di idempotenza: i 5 usi
   rimasti sono id di riga nel DOM (`ma_cards.js:123,231,303`, `area_privata.js:208`) e un indice di
   colore (`ma_save.js:136`) — nessun valore di sicurezza.
2. **Derivazione delle chiavi (corretto il 22/09 dopo la revisione Codex).** Due parametri **distinti**:
   - **Vault:** verificatore e KEK a **600 000** iterazioni PBKDF2-SHA256 (`crypto-utils.js:14-15`,
     `VERIFIER_ITERATIONS`/`KEK_ITERATIONS`; `deriveKek` nell'involucro della chiave).
   - **Cifratura dei campi:** `ITERATIONS = 100000` (`crypto-utils.js:11`) è **attivo anche in
     scrittura**: `encrypt()` → `deriveKey()` (`:212` → `:176-187`) e `decrypt()` → `deriveKey()`
     (`:275`). **Non** è un residuo di sola lettura storica.
   Formato del valore cifrato: `salt(16) + iv(12) + ciphertext`, **senza** conteggio di iterazioni né
   marcatore KDF (`:209-225`, `:249-257`); `decrypt` usa il parametro fisso e prova i candidati del
   keyring (`encryptionKeyCandidates`, `:273`). **Conseguenza:** alzare il parametro **non** è una
   modifica di una riga — richiede ri-cifratura/migrazione di tutti i campi oppure un meccanismo di
   iterazioni candidate, quindi una decisione da prendere con l'audit.
   **Che cosa passa da `encrypt`** (33 call site nei moduli): `form-azienda-save.js` (10) e
   `form-privato-save.js` (8) — campi di Account aziendali e privati, comprese le credenziali bancarie;
   `ma_save.js` (5) e `profilo-sync.js` (5) — dati aziendali e Profilo; `attachment-security.js` (2);
   poi `dati_azienda.js`, `sharing-identity.js`, `vault-session.js`, `webauthn-manager.js`,
   `account-widget-client.js`, `offline-mutation-queue.js`, `shared-vault-data-client.js`.
   **Quale segreto entra:** `generateVaultKey()` produce 32 byte casuali; il keyring `CPVK2:` porta
   `primaryKey` (casuale) e `legacyKey` — e nei due call site di `security-manager.js:265,573` il
   `legacyKey` è la **Master Password**. Per i record cifrati con la chiave casuale le iterazioni contano
   poco (spazio delle chiavi già impraticabile); per il **percorso legacy** che ripiega sulla Master
   Password le 100 000 iterazioni sono l'unico fattore di lavoro.
3. **IV.** AES-GCM con IV a **12 byte** generati casualmente (`backup-crypto.js:76`); i valori a 24/32
   byte sono salt/chiavi. Nessun IV riusato in modo visibile nei percorsi esaminati.
4. **Segreti nel repository.** Nessuna chiave privata, nessun `.env` e nessun file di service account
   tracciati (`.gitignore:77`); `git grep` per chiavi private e `client_secret` non trova nulla.
   La **Firebase Web API key** compare in `push-messaging-client.js:12`, `firebase-messaging-sw.js:5` e
   `functions/index.js:664`: **non è un segreto** per progetto (identifica il progetto; i presidi sono
   App Check e Rules), ma va trattata come identificatore da limitare in caso di abuso.
5. **Dati sensibili nei log (limite del campione, corretto il 22/09).** Nei moduli di produzione ci sono
   **107** chiamate `console.*`; il **campione effettivamente esaminato** (moduli
   `crypto|backup|vault|session|security|offline-mutation|archive`) non registra password, chiavi o
   plaintext **per quanto visto**. Il campione **non** è esaustivo: `security-manager.js` registra un
   **oggetto errore** in **7** chiamate (righe 66, 112, 131, 185, 429, 488, 539), non solo nelle due
   citate in §5.1. Nessuna delle due affermazioni è una prova di sfruttabilità: sono igiene da
   completare.
6. **DOM e iniezione.** Nessun `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval` o
   `new Function` nel codice applicativo: i DOM sono costruiti con `createElement`/`textContent`. I soli
   riscontri sono nei **bundle di terze parti** (`qrcode.min.js` costruisce una tabella via `innerHTML`;
   `firebase-runtime.js` è l'SDK compilato): §5.2.
7. **Percorso di recupero MFA senza sessione.** Limite per email+IP **fail-closed** (stato scritto prima
   della verifica, `resource-exhausted` oltre soglia), email conservata come hash SHA-256 nel documento
   dei tentativi, primo fattore verificato su Identity Toolkit (accetta `MFA_REQUIRED`), codice di
   recupero confrontato per hash e **monouso** (l'hash viene rimosso nella stessa transazione), messaggi
   d'errore **generici** e nessuna enumerazione degli account prima dell'accettazione del primo fattore.
8. **Condivisione e revoca.** Riusate le prove esistenti (38 test di condivisione, ciclo di revoca,
   sospensione inviti, regrant dopo ripristino) e i gate Rules: le letture del destinatario passano da
   `sharedWith` e i percorsi del proprietario restano vincolati dallo UID.
9. **Backup e ripristino.** 99 test del prototipo più le verifiche M8 di oggi (owner mismatch,
   collisioni, CAS per blocco, riferimenti orfani): nessuna nuova osservazione di sicurezza; i difetti
   già registrati restano di **robustezza**, non di autorizzazione.
10. **Coda offline e chiavi di sessione.** Il modulo della coda richiede Web Locks e **fallisce chiuso**
    se l'API manca (`OFFLINE_QUEUE_LOCKS_UNAVAILABLE`); la sessione Vault incapsula la chiave con
    AES-GCM. Resta il **P0 già noto e dichiarato**: la chiave di wrapping vive in `sessionStorage`
    (`vault-session.js:3,17`) — §5.4.
11. **Service worker.** Unico messaggio accettato: `SKIP_WAITING` (`sw.js:92`); cache limitata alla
    shell di stessa origine, senza Auth, Firestore, risposte callable o dati decifrati.

## 5. Osservazioni: nessuna vulnerabilità dimostrata, quattro voci da assegnare

Le voci seguenti **non** sono difetti dimostrati: sono igiene, ambito da chiarire o debito già noto.
Per un eventuale difetto l'incarico prevede prova e proposta di correzione, **senza** modificare il
codice qui.

1. **Igiene dei log (proposta di correzione, basso rischio).** Nei moduli di sicurezza **9** chiamate
   registrano l'**oggetto errore**: `security-manager.js:66,112,131,185,429,488,539` e
   `vault-session.js:40,70`; il resto del codice usa la sola `e.name`/messaggio (per esempio
   `crypto-utils.js:227`). *Perché conta:* un errore dell'SDK può contenere percorso o dettagli della
   richiesta. *Proposta:* registrare solo `e?.name || 'Error'` in quelle nove chiamate.
   *Verifica proposta:* grep di controllo che nei moduli di sicurezza nessuna `console.*` riceva un
   oggetto errore; `npm test` verde. **Non applicata**: serve un incarico esecutivo.
2. **Bundle di terze parti con sink HTML.** `qrcode.min.js` usa `innerHTML` per la tabella di fallback;
   il contenuto deriva da dati QR generati dall'app (non HTML) e il contenitore è creato dalla libreria.
   *Proposta:* includerlo nell'ambito dell'audit indipendente e, se si vuole, sostituire la libreria con
   una versione che non usi `innerHTML`. Nessuna prova di sfruttabilità in questo laboratorio.
3. **PBKDF2 dei campi a 100 000 iterazioni, attivo in scrittura (esposizione dimostrata dal codice; impatto non dimostrato).**
   *Esposizione:* `ITERATIONS = 100000` (`crypto-utils.js:11`) è passato a PBKDF2 da `deriveKey` (`:176-187`)
   e raggiunto sia da `encrypt` (`:212`) sia da `decrypt` (`:275`): vale quindi **anche per i dati nuovi**.
   *Impatto:* dipende dall'entropia del segreto effettivo — per i record cifrati con la chiave casuale
   del keyring le iterazioni aggiungono poco, mentre nel **percorso legacy con la Master Password** sono
   l'unico fattore di lavoro; non è una vulnerabilità dimostrata in questo laboratorio. *Che cosa serve:*
   **audit indipendente** e una decisione su migrazione/ri-cifratura, perché il formato non memorizza il
   parametro. **Nessuna modifica applicata.**
4. **P0 noto, non chiuso da questa revisione.** La chiave di wrapping della sessione Vault vive in
   `sessionStorage` (`vault-session.js:3,17`): è il P0 legacy già dichiarato in
   `AUDIT_VAULT_SESSION_P0.md` e richiamato dal piano (`PIANO:683`). Bonifica della shell persistente,
   **non** di questa revisione; qui è registrata perché l'audit indipendente di gestione delle chiavi
   deve partire da questo stato.

## 6. Che cosa resta esterno (e non è stato dichiarato concluso)

App Check Enforcement, Rules distribuite, indici e log dalla **console del progetto pubblicato**;
**audit indipendente** di crittografia e condivisione; matrice fisica iPhone/Windows; prova di backup,
cancellazione e ripristino su **copia non produttiva**; verifica esterna TTL/lifecycle (M7-2).
La revisione OWASP **finale** richiede una firma che questo documento non fornisce.

## 7. Dichiarazione di perimetro

Nessuna modifica a runtime di produzione, Functions, Rules, dipendenze o dati; nessun commit di
correzione dell'app; nessun push, merge o deploy. Le osservazioni di §5 sono **proposte** in attesa di
una revisione Codex e di un incarico esecutivo distinto. **M10-1 resta aperto** e questo documento non
sostituisce né anticipa l'audit indipendente.
