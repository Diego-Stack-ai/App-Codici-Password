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
