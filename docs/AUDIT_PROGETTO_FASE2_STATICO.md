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
