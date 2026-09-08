# M5 — Inventario dei dati e dei percorsi condivisi

## Scopo e confine

Questo documento fotografa il runtime corrente della condivisione Account, senza modificarlo. Comprende Account privati e aziendali, inviti, notifiche, allegati e cache offline. Le Scadenze condivise sono riportate come confine adiacente: usano destinatari e notifiche comuni, ma hanno copie backend dedicate e non devono essere confuse con il protocollo crittografico Account di M5.

Le Rules e i dati di produzione restano invariati. I percorsi `sharedRecords`, `recordAccess` e le identità crittografiche descritti nel threat model esistono soltanto nel laboratorio.

## Inventario Firestore attuale

| Percorso | Scrittore | Lettore | Dati rilevanti | Stato M5 |
|---|---|---|---|---|
| `users/{ownerUid}/accounts/{accountId}` | client proprietario; callable alla risposta invito | proprietario; UID in `sharedWithUids` | contenuto Account, modalità, ACL e metadati | formato legacy da leggere durante la migrazione |
| `users/{ownerUid}/aziende/{aziendaId}/accounts/{accountId}` | client proprietario; callable alla risposta invito | proprietario; UID in `sharedWithUids` | stesso contratto, più contesto aziendale | formato legacy da leggere durante la migrazione |
| sotto-collezione `attachments/{attachmentId}` dei due percorsi Account | client proprietario | proprietario; nel percorso Firestore generico anche l'ACL del record padre non viene riutilizzata esplicitamente | nome, URL Storage, percorso, MIME, dimensione, envelope chiave-file e data | metadati da migrare; accesso condiviso non dimostrato nel runtime corrente |
| `invites/{accountId}_{emailSanitizzata}` | client proprietario; callable aggiorna la risposta | proprietario/mittente o utente con email Auth corrispondente | email mittente e destinatario, ID Account/azienda, nome Account, tipo, canali, stato e date | sostituire con grant deterministico per UID e generazione |
| `users/{uid}/notifications/{notificationId}` | client proprietario e transazioni di revoca | proprietario | titolo, messaggio, tipo evento, nome/ID Account ed email controparte | legacy; testo e identità sono in chiaro |
| `users/{uid}/pushDevices/{deviceId}` | client proprietario | proprietario/backend | token FCM, piattaforma, browser, ambiti e privacy mode | canale, non materiale crittografico |
| `users/{uid}/notificationDeliveries/{deliveryId}` | backend | proprietario | esito tecnico di consegna | telemetria operativa da minimizzare |
| `users/{uid}/receivedDeadlines/{id}` e `deadlineShares/{id}` | backend | destinatario per la copia; backend per indice | copia minima Scadenza e indice tecnico | protocollo separato da M5 Account |

## Campi del record Account

### Cifrati oggi con la Vault Key del proprietario

- `username`, `account`, `password` e `note`;
- per Account azienda anche `numeroIscrizione` e `codiceSocieta`;
- `banking[].passwordDispositiva`;
- `banking[].cards[].cardNumber`, `pin` e `ccv`.

Il destinatario autorizzato dalle Rules riceve il documento ma non possiede, in modo dimostrato, la Vault Key del proprietario. Questa è la lacuna crittografica già confermata dal threat model.

### In chiaro nel documento

- `nomeAccount`, `url`, `logo` e collegamento eventuale al profilo;
- `referenteNome`, `referenteTelefono`, `referenteCellulare`;
- modalità e classificazione: `type`, `visibility`, `isExplicitMemo`, `isBanking`, `_encrypted`;
- dati bancari non protetti dal codice corrente, tra cui `iban`, tipo/titolare/scadenza carta e riferimenti del referente;
- ACL e stato: `sharedWith`, email/stato/UID di ogni invitato, `sharedWithUids`, `acceptedCount`;
- `createdAt`, `updatedAt` e altri campi legacy eventualmente ancora presenti.

Questi dati sono leggibili da ogni destinatario ammesso sul documento. Nel formato futuro il payload per-record deve includere tutti i dati funzionali che non servono a Rules, query o routing; all'esterno devono rimanere soltanto identificatori opachi, versione schema, generazione chiave e ACL minima.

## Flusso di lettura e scrittura attuale

1. I form privato e azienda cifrano soltanto i campi elencati e salvano il documento direttamente dal client.
2. Il client incorpora nel record la mappa `sharedWith` e crea `invites/{accountId}_{emailSanitizzata}` nella stessa transazione.
3. Il destinatario individua gli inviti con una query per `recipientEmail` e `status`.
4. `respondToInvitation`, protetta da autenticazione e App Check, confronta l'email Auth, aggiorna invito e record e inserisce l'UID in `sharedWithUids`.
5. Le Rules consentono al destinatario `get` e `list` dell'intero documento Account quando il suo UID è nell'array.
6. Le liste risolvono gli inviti accettati e poi leggono il percorso Account indicato dall'invito.
7. Revoca o ritorno a privato rimuovono invito e UID e producono notifiche, ma non ruotano materiale crittografico.

## Allegati e Storage attuali

Gli oggetti si trovano in:

- `users/{ownerUid}/accounts/{accountId}/attachments/{nomeCasuale}`;
- `users/{ownerUid}/aziende/{aziendaId}/accounts/{accountId}/attachments/{nomeCasuale}`.

Il file è cifrato con una chiave-file casuale AES-GCM. La chiave-file è avvolta con una chiave derivata dalla Vault Key del proprietario; envelope, IV, salt, tipo e dimensione originali sono memorizzati nel documento Firestore dell'allegato. Storage conserva un blob `application/octet-stream` marcato `encrypted=v1`.

Le Storage Rules di produzione permettono lettura, creazione, aggiornamento e cancellazione soltanto all'UID proprietario. Pertanto il destinatario non scarica l'allegato e, anche ottenendo il blob, non può aprire l'envelope con la propria Vault Key. Gli URL ottenuti con `getDownloadURL` sono persistiti nei metadati legacy: il nuovo protocollo non deve usarli come autorizzazione e deve preferire letture SDK governate dalle Rules.

Il laboratorio candidato risolve il confine con un percorso opaco condiviso, lo stesso grant Firestore e la stessa `keyGeneration`; scritture e sostituzioni restano backend-only.

## Cache offline e memoria browser

- Firestore usa `persistentLocalCache` con gestione multi-tab: record, inviti, notifiche e metadati già letti possono restare nell'IndexedDB gestito dall'SDK.
- `getDocSmart` e `getDocsSmart` privilegiano la cache quando disponibile e aggiornano dal server in background; offline leggono esclusivamente la cache.
- La Vault Key operativa non viene salvata in chiaro in `localStorage`: la sessione usa materiale avvolto in `sessionStorage` e viene eliminata a blocco/logout.
- La cache Firestore non equivale a revoca crittografica. Un ciphertext e un envelope già consegnati possono essere conservati; soltanto una nuova generazione impedisce al revocato di aprire revisioni future.
- Gli allegati vengono aperti da byte scaricati e trasformati in un Object URL temporaneo, revocato dopo 60 secondi. Non esiste oggi una coda locale applicativa di allegati condivisi.
- `sessionStorage` conserva alcuni deep link e bozze di navigazione, non il payload condiviso; `localStorage` conserva preferenze Push e identificatore dispositivo, non deve ricevere segreti o envelope per-record.

## Notifiche ed email

- L'invito può abilitare separatamente `notifyEmail` e `notifyPush`.
- La Cloud Function `onInviteCreated` invia un'email generica e/o un Push; il corpo non contiene password o altri segreti, ma il Push dettagliato può includere `accountName`.
- Le notifiche Firestore di invio e revoca contengono nome Account ed email della controparte in chiaro.
- Il Service Worker usa dati di routing come `eventType`, `deliveryTag`, ID scadenza/notifica; non deve ricevere ciphertext, chiavi o contenuto sensibile.
- I log devono limitarsi a ID tecnici e categoria dell'errore. Il runtime corrente contiene ancora log diagnostici di invito e revoca da riclassificare prima del cutover.

## Formati legacy rilevati

- ACL moderne: `sharedWith` come mappa per email sanitizzata e `sharedWithUids` come array.
- destinatari storici: `sharedWithEmails` e `recipientEmail`.
- flag storici rimossi durante una modifica: `shared`, `isMemoShared`, `hasMemo`.
- il modulo azienda conserva anche un renderer alternativo capace di trattare gli ospiti come array e di fare auto-healing client; non deve sopravvivere al contratto canonico.
- allegati senza `encryption` vengono ancora aperti tramite l'URL legacy esterno.

## Rischi e decisioni per il cutover

| Priorità | Evidenza | Decisione richiesta |
|---|---|---|
| Bloccante | ACL concede il documento, ma la Vault Key resta del proprietario | payload cifrato con chiave per-record e envelope individuali |
| Bloccante | revoca corrente non ruota alcuna chiave | nuova `keyGeneration` per ogni revisione successiva alla revoca |
| Alta | Storage proprietario e allegati avvolti dalla Vault Key | percorso condiviso governato dallo stesso grant e wrapping con record key |
| Alta | molti metadati personali e bancari restano in chiaro | allowlist minima dei metadati esterni al payload |
| Alta | invito identificato da Account più email e ACL duplicate nel record | grant per UID, stato e generazione scritto dal backend |
| Alta | cache persistente conserva dati già consegnati | messaggio utente esplicito: revoca futura, non cancellazione remota delle copie |
| Media | logica revoca duplicata e forma ospiti mappa/array | servizio canonico unico prima della migrazione |
| Media | `getDownloadURL` legacy è persistito | eliminazione graduale dei token URL dopo lettore retrocompatibile |
| Media | notifiche espongono nome Account/email | modalità discreta predefinita e payload Push minimo |

## Gate dell'inventario

- [x] percorsi Account privato e aziendale;
- [x] inviti, ACL, accettazione e revoca;
- [x] campi cifrati e metadati in chiaro;
- [x] documenti e oggetti allegato;
- [x] cache Firestore, sessione Vault e comportamento offline;
- [x] notifiche Firestore, Push ed email;
- [x] formati legacy e implementazioni concorrenti;
- [x] separazione esplicita dal dominio Scadenze.

L'inventario è completo per progettare il piano di integrazione. Non autorizza ancora migrazioni, modifica delle Rules o scritture su dati reali.
