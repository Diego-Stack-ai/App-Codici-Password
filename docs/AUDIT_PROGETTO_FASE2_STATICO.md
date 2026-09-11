# Audit completo — Fase 2: verifica statica priorità P0/P1

> **Stato:** completata per il perimetro statico indicato; nessuna correzione autorizzata  
> **Autorità:** evidenza read-only subordinata al [Piano di audit completo](./PIANO_AUDIT_COMPLETO_PROGETTO.md)  
> **Data:** 11 settembre 2026  
> **Repository:** `Diego-Stack-ai/App-Codici-Password`  
> **Commit esaminato:** `6abeeb25674c157723a08d89b7c9fbf7f337bce4`  
> **Limite:** verifica dei file versionati su GitHub. Non certifica dati reali, Firebase Console, deploy effettivi, dispositivi o working tree locale.

## 1. Perimetro esaminato

La verifica ha coperto:

- sessione Vault e persistenza della chiave sbloccata;
- inventario dei campi cifrati e formato crittografico;
- distinzione fra runtime ed esperimenti;
- Firestore Rules e Storage Rules;
- callable, trigger e principali operazioni Admin SDK;
- backup, ripristino, cestino, retention e cancellazione definitiva;
- presenza e natura dei test collegati.

Non sono stati eseguiti deploy, emulatori, test locali, accessi alla Firebase Console, letture di dati reali o prove su dispositivi.

## 2. Sintesi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P0-01 | Alta | Verificato nel codice | `vault-session.js` conserva nello stesso `sessionStorage` payload Vault cifrato e chiave di wrapping |
| F2-P0-02 | Alta | Verificato nel codice | Il formato dei campi cifrati non è versionato e non usa AAD per legare proprietario, record, tipo e campo |
| F2-P0-03 | Alta | Verificato nel codice | Firestore mantiene in chiaro metadati che possono rivelare contenuto riservato |
| F2-P0-04 | Alta | Verificato nelle Rules | Una regola ricorsiva consente al proprietario scritture su molte sottocollezioni senza allowlist completa |
| F2-P0-05 | Alta | Verificato nel codice e nelle Rules | La creazione diretta di inviti può attivare email/push senza callable obbligatoria e rate limit affidabile |
| F2-P0-06 | Alta | Verificato nelle Storage Rules | Upload con MIME ammesso possono essere salvati senza marcatore di cifratura |
| F2-P0-07 | Alta | Verificato nel codice | Il ripristino backup è transazionale per chunk, non atomico per l'intera operazione, e non dispone di rollback complessivo |
| F2-P1-01 | Media | Verificato nel codice | Record ripristinati possono precedere gli allegati; un errore upload può lasciare riferimenti incompleti |
| F2-P1-02 | Media | Verificato nei test | Mancano test dedicati completi per `manageReceivedDeadline`, `onInviteCreated` e abuso dei canali |
| F2-P1-03 | Media | In conflitto documentale | M7 dichiara contemporaneamente retention aperta/non approvata e fase completata/certificata |
| F2-P1-04 | Media | Verificato nel codice | Viene scritto `purgeAfterMs` a 30 giorni, ma non è emerso un processo automatico che lo applichi |
| F2-P1-05 | Media | Da verificare su dispositivo | Il fallback backup su iPhone può accumulare file molto grandi in memoria |
| F2-P1-06 | Media | Da riesaminare | `recoverMfaWithCode` riceve la password Firebase nel payload della Cloud Function |

## 3. Sessione Vault

Il finding già documentato in `AUDIT_VAULT_SESSION_P0.md` è ancora presente nel commit esaminato. Il payload della Vault viene cifrato, ma la chiave casuale necessaria ad aprirlo è conservata nella stessa origine e nello stesso `sessionStorage`.

Elementi positivi confermati:

- password Firebase e Master Password sono distinte;
- la Vault Key nasce casualmente ed è protetta da envelope;
- verifier ed envelope sono versionati;
- non è emersa persistenza della Master Password in `localStorage`;
- i percorsi di blocco e cambio UID richiamano la pulizia centralizzata.

La correzione resta soggetta a una decisione architetturale e non è stata applicata.

## 4. Cifratura e metadati

`crypto-utils.js` usa PBKDF2-SHA-256 e AES-256-GCM con salt e IV casuali. Il formato testuale dei singoli campi, però, concatena salt, IV e ciphertext in Base64 senza:

- versione del formato;
- identificazione dell'algoritmo;
- AAD che leghi il valore a UID, record, tipo, campo o revisione.

Sono risultati in chiaro, secondo i percorsi verificati:

- `nomeAccount` e `url`;
- nominativi e recapiti dei referenti;
- IBAN e diversi metadati bancari;
- email e note delle caselle aziendali, mentre le password risultano cifrate;
- nomi, MIME, URL, percorso e dimensione degli allegati;
- nomi account, email e testi usati in inviti/notifiche;
- contenuto funzionale delle Scadenze necessario alle Functions.

L'inventario `ENCRYPTED_FIELD_INVENTORY.md` è quindi correttamente marcato come incompleto.

Il modello con Record Key e grant per destinatario resta in `experiments/sharing-key-prototype`. Alcuni test importano esplicitamente tale codice sperimentale: il loro successo non dimostra che il protocollo sia attivo nel runtime.

## 5. Firestore e Storage Rules

### Evidenze positive

- percorsi backend-only come `mfaRecovery`, `mfaRecoveryAttempts` e `deadlineShares` sono chiusi al client;
- copie ricevute delle Scadenze sono leggibili solo dal proprietario e scrivibili soltanto dal backend;
- nuovi domini `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` sono function-only in scrittura;
- Storage applica isolamento per UID e chiusura predefinita.

### Rischi

La regola `/users/{userId}/{collection}/{document=**}` consente al proprietario lettura e scrittura su tutte le sottocollezioni non escluse. Non impone in modo generale allowlist, tipi, dimensioni, UID immutabile o revisione.

Gli inviti possono essere creati direttamente da un utente autenticato. Il trigger `onInviteCreated` può quindi inviare email o push. Nel percorso verificato non emergono rate limit affidabili, quota, callable obbligatoria o prova dell'esistenza dell'account prima dell'invio.

Storage accetta vari MIME in chiaro; il metadato `encrypted: v1` è obbligatorio soltanto per `application/octet-stream`. Le Rules non dimostrano quindi che ogni allegato applicativo sia cifrato prima dell'upload.

## 6. Cloud Functions

Sono state rilevate 15 callable; tutte dichiarano `enforceAppCheck: true`. I controlli Authentication sono presenti direttamente o tramite helper comune. Le principali operazioni usano validazione e, in diversi casi, transazioni e `operationId`.

Controlli positivi osservati:

- `respondToInvitation` verifica identità, email, stato dell'invito, account e presenza del destinatario;
- `manageReceivedDeadline` ricontrolla il permesso sulla Scadenza originale;
- i percorsi Admin SDK sono costruiti usando l'UID autenticato nei servizi esaminati;
- audit backend limitati a campi tecnici.

Punti aperti:

- `recoverMfaWithCode` riceve email, password Firebase e Recovery Code, poi inoltra le credenziali a Identity Toolkit. La password non risulta persistita, ma attraversa il backend applicativo;
- l'enforcement App Check nel codice non prova la configurazione effettiva dei servizi remoti;
- i test unitari dei servizi non sostituiscono test emulator/integration sui confini Auth, App Check e Admin SDK.

## 7. Backup, ripristino e cancellazione

Il formato runtime v2 presenta controlli solidi:

- Recovery Key casuale da 192 bit;
- PBKDF2-SHA-256 a 600.000 iterazioni;
- AES-GCM;
- header autenticato;
- concatenazione tramite sequenza e digest precedente;
- footer autenticato contro troncamento, riordino e dati successivi;
- owner UID vincolato al contenitore.

Il ripristino valida scope, identificatori, dimensioni, collisioni e conferma. I percorsi sono ricostruiti dal backend sotto l'UID autenticato.

Il limite principale è operativo: i record vengono applicati in chunk distinti e gli allegati caricati dopo i record. Un errore fra due chunk o durante gli upload può lasciare un ripristino parziale. Non è emersa una procedura automatica di rollback dell'intera esecuzione.

Per il cestino, `RETENTION_MS` vale 30 giorni e viene scritto `purgeAfterMs`; non è stato rilevato un processo automatico che cancelli alla scadenza. La politica effettiva resta pertanto non determinata e la documentazione M7 contiene dichiarazioni incompatibili.

## 8. Test e limiti probatori

I test presenti coprono principalmente:

- primitivi e formato backup;
- validatori di restore e purge;
- servizi offline e mutazioni private;
- widget e credenziali comuni;
- sicurezza dei Recovery Code.

Non risultano prove sufficienti per dichiarare verificati:

- rollback dopo errore fra chunk;
- perdita di rete durante ripristino allegati;
- memoria e spazio su iPhone con backup grandi;
- abuso/rate limit di `onInviteCreated`;
- flusso completo di `manageReceivedDeadline`;
- enforcement App Check reale;
- retention e cancellazione effettiva nei backup remoti.

## 9. Ordine proposto per le verifiche successive

Senza applicare correzioni:

1. offline, service worker, coda cifrata e conflitti;
2. allegati e URL legacy;
3. condivisione legacy contro modello candidato;
4. supply chain, dipendenze, segreti e workflow;
5. matrice test/emulatori;
6. configurazione Firebase reale e dispositivi, soltanto dopo autorizzazione specifica.

## 10. Gate

Questa fase registra findings e prove statiche. Non autorizza:

- migrazioni crittografiche;
- modifica di Rules o Functions;
- lettura o riscrittura di dati reali;
- deploy;
- correzione automatica della documentazione in conflitto;
- modifica di `docs/PIANO_MATURITA_PROFESSIONALE.md`.

Le correzioni dovranno essere approvate e realizzate per blocchi separati, con test, migrazione e rollback.


## 11. Verifica offline, service worker e conflitti

### Evidenze positive

- il service worker applicativo precarica soltanto la shell dichiarata in `offline-assets.js`;
- le richieste protette a `/protected-media/presentation` sono escluse dalla Cache API;
- codice e stili usano rete-prima con fallback sulla stessa URL/versione;
- Firestore usa `persistentLocalCache` con gestione multischeda;
- la coda IndexedDB conserva contenitori AES-GCM e non il payload della mutazione in chiaro;
- la chiave della coda deriva tramite HKDF dal materiale Vault e dall'UID;
- l'AAD lega versione, UID e `operationId`;
- il backend verifica revisione e idempotenza prima di applicare le mutazioni;
- una mutazione viene rimossa dalla coda soltanto dopo esito applicato o duplicato già riconosciuto;
- un conflitto arresta la sincronizzazione senza sovrascrivere il record remoto;
- Account condivisi, bancari e collegati al Profilo restano esclusi dalle scritture offline.

### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P1-07 | Media | Verificato nel codice | `withOfflineQueueLease` genera errore se Web Locks non è disponibile; non esiste il fallback dichiarato dal contratto |
| F2-P1-08 | Media | Verificato nel codice | L'handoff dopo salvataggio conserva in `sessionStorage` l'intero record, inclusi metadati non cifrati, con TTL controllato solo alla lettura |
| F2-P1-09 | Media | Verificato nel codice e da prova dichiarata | Offline, una query cache vuota viene restituita direttamente e non distingue raccolta vuota da cache mai preparata |
| F2-P1-10 | Media | Verificato nel codice | Il flag globale delle mutazioni è disattivato, ma l'adattatore Account lo forza a `enabled: true`; il nome “pilot” non riflette più chiaramente il cutover dichiarato |
| F2-P2-01 | Bassa | Verificato nel worker | Una push `share_invite` apre la Home, non una destinazione specifica per l'invito |
| F2-P2-02 | Bassa | Da verificare | L'installazione usa `Promise.all`: una singola risorsa mancante impedisce l'installazione completa della nuova shell |

### Dettaglio

`offline-firestore.js` usa cache-first quando il dispositivo risulta online e aggiorna dal server in background. Quando `navigator.onLine` è falso, restituisce direttamente la cache. Per una query mai preparata, una cache vuota appare quindi come lista realmente vuota. Questo comportamento è coerente con il fallimento già dichiarato nel test dell'Account bancario su iPhone.

La coda è separata per UID tramite il nome del database e i contenitori restano cifrati. Non è emersa una cancellazione fisica automatica del database IndexedDB al logout. La coda non dovrebbe essere decifrabile senza il materiale Vault, ma cancellazione, revoca dispositivo e recupero della coda residua richiedono una prova specifica.

`private-account-offline-pilot.js` salva per 60 secondi un handoff della UI in `sessionStorage`. Il controllo del TTL avviene quando il dato viene consumato; se la pagina successiva non lo legge, il contenitore può restare oltre il TTL. Il record include ciphertext per le credenziali ma anche i metadati che il normale schema conserva in chiaro.

Il worker Firebase Messaging è separato dal worker della shell. Gestisce correttamente i deep link per Scadenze proprie e ricevute; per `share_invite` usa invece il fallback Home.

### Gate ancora aperti

- apertura offline deterministica delle liste su iPhone;
- prova su browser privo di Web Locks;
- logout, cambio UID e revoca con coda pendente;
- chiusura forzata prima del consumo dell'handoff;
- aggiornamento della shell quando una risorsa del manifest non è disponibile;
- concorrenza reale fra due schede e due dispositivi sul runtime distribuito.


## 12. Verifica allegati e condivisione

### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P0-08 | Bloccante | Verificato nel codice | L'ACL consente al destinatario di leggere il record, ma non esiste un envelope della chiave capace di decifrare i campi del proprietario |
| F2-P0-09 | Bloccante | Verificato in codice e Rules | Il destinatario non può scaricare gli allegati del proprietario e non possiede la chiave necessaria ad aprirli |
| F2-P0-10 | Alta | Verificato nel codice | URL Firebase di download vengono persistiti e i lettori legacy li aprono direttamente; il token URL non deve essere trattato come autorizzazione |
| F2-P0-11 | Alta | Verificato nel codice | La validazione upload si fida del MIME fornito dal browser e non controlla magic bytes/firma del file |
| F2-P1-11 | Media | Verificato nel codice | L'AAD degli allegati è una costante e non lega proprietario, record, allegato, versione o percorso |
| F2-P1-12 | Media | Verificato nel codice | Nome originale, tipo, dimensione, URL e percorso Storage restano metadati leggibili in Firestore |
| F2-P1-13 | Media | Verificato nel runtime | La revoca rimuove l'ACL ma non ruota il materiale crittografico e non può eliminare copie già presenti nella cache |
| F2-P1-14 | Media | Verificato nei test | I test crittografici della condivisione usano in parte `experiments/sharing-key-prototype` e non certificano il runtime attivo |

### Flusso Account condiviso attuale

1. Il proprietario cifra i campi usando la propria Vault Key.
2. Il client salva `sharedWith` e crea un invito.
3. `respondToInvitation` verifica il destinatario e aggiunge il suo UID a `sharedWithUids`.
4. Le Firestore Rules consentono la lettura del documento originale.
5. Il client del destinatario tenta di decifrare usando la Vault Key del destinatario.
6. Non è emerso un envelope che colleghi la chiave del record alla chiave del destinatario.

La separazione fra autorizzazione e decifratura è quindi incompleta: il destinatario può ricevere il ciphertext ma non è dimostrato che possa ottenere correttamente il contenuto.

### Allegati

Il runtime cifra ogni nuovo allegato con una File Key casuale AES-GCM e avvolge la File Key tramite HKDF/AES-GCM usando la Vault Key del proprietario. Questo protegge il contenuto salvato come `application/octet-stream`.

Restano però aperti quattro confini:

- Storage consente la lettura solo all'UID proprietario;
- la File Key è avvolta per la Vault Key del proprietario, non per il destinatario;
- l'AAD è `CodiciPassword-Attachment-v1` per tutti gli oggetti e non lega il contesto;
- il controllo formato usa `file.type`, senza verifica dei magic bytes.

### URL legacy

I moduli privato e azienda continuano a:

- ottenere `getDownloadURL`;
- salvare l'URL nel documento Firestore;
- aprire direttamente `attachment.url` quando manca il metadato `encryption`.

Un Firebase download URL può includere un token persistente e non deve essere considerato equivalente a una lettura governata in ogni momento dalle Storage Rules. Per gli oggetti legacy non cifrati, la conoscenza dell'URL può esporre direttamente il contenuto. Non è stato effettuato alcun inventario dei token o degli oggetti reali.

### Identità crittografica candidata

`sharing-identity.js` crea un'identità ECDH P-256, cifra la chiave privata con materiale derivato dalla Vault Key e usa AAD legata a UID e key ID. Il modulo è coperto da test isolati, ma non è emerso un collegamento completo dal form Account al protocollo record-key/grant.

Il modello con Record Key, grant individuali, `keyGeneration` e rotazione resta candidato e non deve essere dichiarato attivo.

### Gate ancora aperti

- condivisione end-to-end fra due Vault realmente differenti;
- download e apertura allegato da parte del destinatario;
- inventario aggregato degli URL/token legacy;
- magic-byte validation per ogni formato ammesso;
- rotazione dopo revoca;
- comportamento della cache del destinatario revocato;
- verifica e sostituzione protetta della chiave pubblica;
- migrazione con doppio lettore e rollback, solo dopo approvazione.


## 13. Verifica supply chain e workflow di rilascio

### Evidenze positive

- repository marcato `private: true` nei package npm;
- lockfile v3 presenti sia alla radice sia nelle Functions;
- dipendenze risolte con hash `integrity`;
- `.env`, `serviceAccountKey.json`, cache Firebase, log e `node_modules` sono esclusi da Git;
- la scansione statica dei nomi e dei pattern non ha rilevato chiavi private, service account o valori di `GMAIL_APP_PASSWORD`;
- i segreti Gmail sono richiamati tramite Secret Manager;
- il workflow usa `npm ci`, non installazioni non deterministiche;
- test completi eseguiti prima del comando di deploy;
- le Functions sono escluse dal deploy automatico corrente.

Le API key Firebase presenti nel frontend e nella Function sono configurazioni del client Firebase e non equivalgono a una chiave privata o service account. La suddivisione della stringa nel frontend non costituisce una misura di sicurezza.

### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P0-12 | Alta | Verificato nel workflow | Ogni push su `master`, anche documentale, avvia un deploy di Hosting, Firestore Rules e Storage |
| F2-P0-13 | Alta | Verificato nel workflow | Il deploy non specifica `--project` e dipende dal progetto predefinito `appcodici-password` in `.firebaserc` |
| F2-P1-15 | Media | Verificato nel workflow | Autenticazione CI basata su `FIREBASE_TOKEN`, dichiarata legacy dallo stesso repository |
| F2-P1-16 | Media | Verificato nel workflow | Le GitHub Actions sono referenziate tramite tag maggiori (`@v5`) e non tramite commit SHA immutabile |
| F2-P1-17 | Media | Verificato nel workflow | Rules/Storage/Hosting vengono ridistribuiti insieme anche quando non sono cambiati |
| F2-P1-18 | Media | Verificato nel workflow | Functions restano manuali, creando possibilità di disallineamento fra frontend, Rules e backend |
| F2-P1-19 | Media | Non determinabile | Vulnerabilità correnti delle dipendenze transitive non verificate con audit del lockfile |
| F2-P2-03 | Bassa | Verificato nel repository | Numerose suite chiamate “prototype” o basate su `experiments/` fanno parte del gate principale e possono essere confuse con copertura del runtime |

### Workflow corrente

Il solo workflow `.github/workflows/firebase-deploy.yml` reagisce direttamente al push su `master`:

1. checkout;
2. Node.js 22 e Java 21;
3. `npm ci`;
4. `npm ci --prefix functions`;
5. `npm test`;
6. deploy di Hosting, Firestore Rules e Storage con `FIREBASE_TOKEN`.

Non è emerso un ambiente di approvazione, un gate manuale, una selezione basata sui file modificati o un comando `--project <PROJECT_ID>`. Di conseguenza un merge esclusivamente documentale può causare una nuova distribuzione della configurazione di produzione.

### Segreti e file sensibili

La scansione statica ha cercato nomi e pattern compatibili con:

- chiavi private PEM;
- service account;
- file `.env`;
- backup/credenziali;
- riferimenti `FIREBASE_TOKEN`;
- riferimenti `GMAIL_APP_PASSWORD`.

Non sono emersi valori di chiavi private o password Gmail. Questo controllo non certifica la cronologia Git, i branch non esaminati, gli artifact Actions o i segreti configurati nell'account GitHub.

### Dipendenze

I manifest dichiarano fra le dipendenze principali Firebase SDK, Firebase Tools, Rules Unit Testing, esbuild, madge, stylelint, Tesseract.js, ZXing, Firebase Admin, Firebase Functions e Nodemailer.

I lockfile rendono riproducibile l'installazione, ma il workflow non esegue una verifica esplicita di advisory/licenze. La presenza di una versione nel lockfile non dimostra l'assenza di vulnerabilità correnti. Un controllo attendibile richiede esecuzione separata dell'audit e valutazione dei risultati, senza aggiornamenti automatici.

### Gate aperti

- audit delle dipendenze e licenze sul lockfile;
- scansione della cronologia Git e dei branch residui;
- verifica ruleset/branch protection;
- sostituzione del token CI con identità federata a privilegi minimi;
- ambiente protetto con approvazione deploy;
- parametro esplicito `--project`;
- deploy selettivo basato sugli artifact modificati;
- matrice di compatibilità fra versione Hosting, Rules e Functions.


## 14. Matrice delle prove e significato della CI

### Stato verificato

Il commit di base `6abeeb25674c157723a08d89b7c9fbf7f337bce4` è associato a un'esecuzione riuscita del workflow **Validate and deploy Firebase**:

- run ID: `34596454444`;
- evento: push su `master`;
- esito: `success`;
- intervallo registrato: 11 settembre 2026, 11:56:44–11:57:51 UTC.

L'esito dimostra che i comandi configurati nel workflow sono terminati con successo e che il job ha raggiunto il deploy. Non certifica, da solo, completezza dei test, configurazione remota effettiva, comportamento sui dispositivi o correttezza end-to-end dei flussi critici.

### Inventario delle prove versionate

| Gruppo | Quantità rilevata | Natura prevalente | Valore probatorio |
|---|---:|---|---|
| Test principali in `tests/` | 35 | unitari, integrazione locale, contratti e prototipi | Variabile: dipende dal modulo importato |
| Test unitari Functions in `functions/test/` | 8 | helper e servizi isolati | Non equivalgono a callable/trigger distribuiti |
| Test in `experiments/` | 7 | protocolli candidati | Provano il prototipo, non il runtime attivo |
| Script `audit-*.mjs` | 16 | asserzioni statiche e ricerca di pattern | Provano presenza testuale, non comportamento |
| Runner emulatori | 3 | Firestore Rules, Storage Rules, Functions | Solo Firestore e Storage sono nel gate `npm test` |

I runner Firestore e Storage usano project ID fittizi e avviano emulatori locali. È una separazione positiva dai dati reali. Le rispettive suite includono tuttavia sia Rules di produzione sia regole o protocolli candidati: il successo complessivo deve essere attribuito al singolo file verificato, non all'intera funzionalità nominale.

### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P1-20 | Media | Verificato negli script npm | `scripts/test-functions-emulator.mjs` esiste ma non è richiamato da `npm test` |
| F2-P1-21 | Media | Verificato negli audit script | Molti gate “security” sono asserzioni regex/statiche e dimostrano presenza di costrutti, non efficacia a runtime |
| F2-P1-22 | Media | Verificato nella composizione del gate | Test di produzione, candidati e prototipi confluiscono nello stesso esito, riducendo la chiarezza sulla maturità effettiva |
| F2-P1-23 | Media | Verificato nel runner Functions | L'emulatore Functions copre sei scenari basilari/negativi e non i flussi completi di invito, condivisione, scadenze, App Check e abuso |
| F2-P1-24 | Media | Limite probatorio verificato | La CI riuscita prova l'esecuzione del workflow, ma non le versioni/configurazioni remote effettive né l'enforcement App Check reale |
| F2-P2-04 | Bassa | Non rilevato | Non è emersa strumentazione di code coverage o una soglia minima bloccante |

### Distinzione fra tipi di evidenza

- **Unit test:** utile per logica pura, validatori e servizi; non attraversa necessariamente Auth, Rules, rete e Admin SDK.
- **Test emulatore Rules:** prova decisioni di accesso per gli scenari dichiarati; non prova configurazioni o dati di produzione.
- **Test emulatore Functions:** può attraversare endpoint locali, ma il runner attuale è limitato e fuori dal gate principale.
- **Audit statico:** individua regressioni testuali e contratti dichiarati; può dare falsi positivi sul comportamento.
- **Test prototipo:** valida una direzione tecnica; non autorizza a descriverla come implementata.
- **CI verde:** prova che il set configurato è passato; non prova ciò che il set non esercita.

Un esempio rilevante è l'audit della sessione Vault: il controllo statico conferma il pattern di persistenza previsto dal codice, ma non rende sicuro il fatto che payload cifrato e chiave di wrapping risiedano nella stessa sessione browser.

### Gate aperti

- integrare l'emulatore Functions nel gate solo dopo averne definito isolamento, stabilità e scenari obbligatori;
- separare chiaramente suite runtime, candidate ed esperimenti nel reporting CI;
- associare ogni requisito critico a una prova comportamentale e a un ambiente;
- coprire flussi positivi, negativi, concorrenza, retry, abuso e revoca;
- introdurre coverage soltanto come indicatore complementare, non come sostituto dei casi di sicurezza;
- verificare configurazione Firebase reale e dispositivi esclusivamente dopo autorizzazione specifica.


## 15. Visibilità, governance, dipendenze e cronologia Git

### Evidenze verificate

- il repository GitHub è **pubblico** (`private: false`, `visibility: public`) e consente fork;
- `master` è il branch predefinito e GitHub lo dichiara `protected: false`;
- tutti i 12 branch elencati risultano non protetti;
- l'endpoint ruleset restituisce un elenco vuoto;
- il collegamento usato per l'audit dispone di permessi amministrativi, ma la lettura dettagliata della branch protection è negata all'integrazione; lo stato sintetico dei branch resta comunque `protected: false`;
- nei 826 commit raggiungibili da `master`, 805 commit risultano non firmati e 21 verificati;
- il repository non richiede il sign-off dei commit via web;
- GitHub non rileva una licenza del repository, mentre il solo `package.json` dichiara `ISC`.

Il valore `private: true` nei due manifest npm impedisce la pubblicazione accidentale dei pacchetti su npm. Non rende privato il repository GitHub.

### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P0-14 | Alta | Verificato su GitHub e nel workflow | `master` non è protetto e ogni push diretto può avviare test e deploy di Hosting, Firestore Rules e Storage |
| F2-P1-25 | Media | Verificato su GitHub | Non risultano ruleset; tutti i 12 branch elencati, incluso `master`, hanno `protected: false` |
| F2-P1-26 | Media | Verificato su GitHub | Il repository del password manager è pubblico e consente fork; ciò amplia la superficie informativa e rende essenziale che nessun dato o segreto operativo sia versionato |
| F2-P1-27 | Media | Verificato nella cronologia | 805 dei 826 commit raggiungibili da `master` non hanno firma verificata; il sign-off web non è richiesto |
| F2-P1-28 | Media | Non determinabile con l'accesso disponibile | Alert Dependabot, secret scanning e advisory correnti non sono leggibili dall'integrazione usata |
| F2-P2-05 | Bassa | Verificato nei metadati | Il manifest dichiara licenza ISC, ma GitHub riporta `license: null`; manca una licenza di repository riconosciuta |
| F2-P2-06 | Bassa | Verificato nei lockfile | Quattro pacchetti non espongono il campo licenza nel lockfile; uno, `limiter@1.1.5`, è nel grafo Functions non-dev |

### Licenze ricavate dai lockfile

| Lockfile | Pacchetti registrati | Produzione/non-dev | Metadato licenza assente | Copyleft rilevato dal campo |
|---|---:|---:|---:|---|
| radice | 935 | 0 | 3 | `postcss-values-parser` — MPL-2.0, dev |
| Functions | 356 | 283 | 1 | nessuno |

I tre pacchetti dev senza campo licenza nel lockfile radice sono `fuzzy@0.1.3`, `svg-tags@1.0.0` e `valid-url@1.0.9`. Nel lockfile Functions manca il campo per `limiter@1.1.5`.

Questa è una lettura dei metadati versionati, non un parere legale. L'assenza del campo nel lockfile non dimostra automaticamente che un pacchetto sia privo di licenza; richiede verifica sulla fonte del pacchetto prima di una distribuzione formale.

### Vulnerabilità delle dipendenze

Le versioni dirette e transitive sono fissate dai lockfile v3, ma non è stato possibile interrogare gli alert Dependabot o eseguire un advisory audit attendibile attraverso l'accesso disponibile. Non sono stati eseguiti `npm audit fix`, aggiornamenti o modifiche dei lockfile.

Il finding F2-P1-19 rimane quindi aperto: non è corretto dichiarare le dipendenze sicure né vulnerabili senza un risultato advisory aggiornato e valutato.

### Verifica storica dei segreti

La cronologia di `master` contiene 826 commit. Sono stati controllati:

- messaggi e metadati di tutti i commit;
- commit associati ai percorsi `.env`, `serviceAccountKey.json`, `scripts_import_dati/serviceAccountKey.json` e `Torna alla Login e accedi con.docx`;
- patch mirate dei commit che introducono Secret Manager e la protezione dei file locali.

Per i quattro percorsi sensibili espliciti GitHub restituisce zero commit. Nelle patch mirate, Gmail usa `defineSecret` e non è emerso il valore della password applicativa.

Limite: la verifica non ha materializzato e analizzato ogni blob di ogni albero storico con uno scanner dedicato. Non certifica quindi l'assenza assoluta di segreti sotto nomi differenti, branch non raggiungibili da `master`, tag, artifact o log Actions.

### Priorità di governance proposta

Prima di qualunque merge dell'audit o futura correzione:

1. disaccoppiare i cambi documentali dal deploy Firebase;
2. proteggere `master` con pull request e check obbligatori;
3. aggiungere un'approvazione esplicita per il job di produzione;
4. rendere esplicito il progetto Firebase di destinazione;
5. decidere consapevolmente se il repository debba restare pubblico;
6. abilitare e verificare secret scanning/Dependabot secondo le capacità del piano GitHub;
7. definire firma o provenance dei commit e una politica licenze.

Qualsiasi modifica a workflow, visibilità, Rules, Functions o deploy resta fuori dal perimetro di questo audit e richiede autorizzazione.
