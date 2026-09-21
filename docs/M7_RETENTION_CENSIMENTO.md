# M7-R1 — Censimento retention e proposta di politica

> **Stato:** censimento in sola lettura consegnato per verifica; **nessuna politica di retention approvata**, nessuna durata decisa.
> **Autorità:** subordinato a [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md) (baseline) e a [M7 — Cronologia, cestino e audit](./M7_CRONOLOGIA_CESTINO_AUDIT.md) (contratto d'area).
> **Revisione:** 21/09/2026, riferimento applicativo `v1.2.127`, base di lavoro `7ce5a989`.
> **Area:** retention attuale di cestino, cronologia/audit, allegati e backup.
> **Perimetro:** sola analisi in lettura e documentazione. Nessuna modifica a runtime, dati, `Frontend/public/**`, Rules/Functions produttive, versione, `master` o deploy; nessun dato reale.
> **Fetta:** M7-R1 (censimento). M8–M10 e l'audit Alibaba/OpenCodeReview non sono avviati da questo documento.

## 0. Come leggere questo documento

Ogni affermazione è accompagnata dal riferimento `percorso:riga` al codice o alle Rules esaminate. La legenda degli stati è:

| Stato | Significato |
|---|---|
| **verificato nel codice** | la proprietà è dimostrata dalle righe citate del codice distribuito |
| **verificato nelle Rules** | la proprietà è dimostrata dalle Rules citate |
| **verificato nei test** | esiste un test che esercita la proprietà (file:riga) |
| **solo laboratorio** | la proprietà esiste unicamente in `experiments/**` o in Rules candidate non pubblicate |
| **non verificato** | non è dimostrabile da questo repository; è indicato cosa servirebbe |

**Produttivo** significa codice effettivamente pubblicato o distribuibile da questo ramo (`functions/`, `firestore.rules`, `storage.rules`, `Frontend/public/**`, `firebase.json`). **Laboratorio** significa `experiments/**` o Rules candidate: non raggiungibili dall'app distribuita.

Questo documento **non decide** durate, eccezioni legali o cancellazioni definitive: le raccoglie come domande per il proprietario nella sezione 10.

## 1. Requisito di partenza

### 1.1 Baseline di sicurezza

- I backup reali devono essere «cifrati e autenticati; versionati; separati dalle chiavi necessarie ad aprirli; **soggetti a controllo accessi e retention**; provati periodicamente con ripristino su ambiente non produttivo» (`docs/ARCHITETTURA_SICUREZZA_V1.md:239-245`).
- «La cancellazione deve includere dati principali, indici, copie ricevute controllabili, allegati, cache del dispositivo e backup **secondo la politica di retention**. Deve essere verificabile e compatibile con eventuali obblighi di conservazione» (`docs/ARCHITETTURA_SICUREZZA_V1.md:249`).
- «retention di cestino, audit e backup» è elencata fra le **decisioni non ancora chiuse** (`docs/ARCHITETTURA_SICUREZZA_V1.md:344`).
- La tabella dei rischi indica per «Cancellazione o corruzione»: «Cestino cifrato, backup autenticato, versioni e prova periodica di ripristino» (`docs/ARCHITETTURA_SICUREZZA_V1.md:62`).

### 1.2 Piano di maturità

- M7: `[ ] politica di retention complessiva approvata e verificata su dati, allegati e backup` (`docs/PIANO_MATURITA_PROFESSIONALE.md:396`); uscita: «recupero e cancellazione verificabili; il collaudo storico non chiude la decisione sulla retention» (`:398`).
- M8: restano aperti «gestione completa delle interruzioni fra blocchi e allegati», «rispondenza al requisito di staging e ripresa/rollback su copia non produttiva», «limiti di memoria e matrice fisica completa» (`docs/PIANO_MATURITA_PROFESSIONALE.md:404-406`).
- Sintesi di stato: M7 «funzioni e collaudo storico registrati; retention complessiva non approvata» (`docs/PIANO_MATURITA_PROFESSIONALE.md:469`).

### 1.3 Rilievi già registrati che questo censimento conferma o precisa

| Rilievo | Contenuto | Esito di M7-R1 |
|---|---|---|
| F2-P1-03 | «M7 dichiara contemporaneamente retention aperta/non approvata e fase completata/certificata» (`docs/AUDIT_PROGETTO_FASE2_STATICO.md:37`) | **confermato**: la sezione 2 mostra due meccanismi di cestino con semantiche diverse e la sezione 7 distingue ciò che esiste da ciò che non esiste |
| F2-P1-04 | «Viene scritto `purgeAfterMs` a 30 giorni, ma non è emerso un processo automatico che lo applichi» (`docs/AUDIT_PROGETTO_FASE2_STATICO.md:38`) | **confermato e precisato**: il metadato è scritto solo dal percorso `trash` legacy (`functions/index.js:429`) e non ha alcun consumatore; l'Archivio Account non lo scrive affatto |
| — | «non è stato rilevato un processo automatico che cancelli alla scadenza» (`docs/AUDIT_PROGETTO_FASE2_STATICO.md:128`) | **confermato**: l'unica schedulazione del progetto è `checkDeadlines` (`functions/index.js:1486`) |

## 2. Meccanismi di cestino: due percorsi distinti

Il censimento ha individuato **due meccanismi diversi** che il linguaggio comune chiama "cestino". Confonderli è la causa principale dell'ambiguità documentale.

| # | Meccanismo | Dove vive il record | Chi scrive | Campi di stato | Scadenza automatica | UI |
|---|---|---|---|---|---|---|
| A | **Archivio Account** (quello usato dall'utente) | il documento Account stesso, con flag `isArchived` | client, direttamente sul documento (`Frontend/public/assets/js/modules/privato/account_privati.js:371`, `.../azienda/account_azienda.js:249`) | `isArchived`, `archiveSchemaVersion: 2`, `archivedAt`, `revision` (`.../settings/archive-account-model.js:1-7`) | **nessuna** | `Frontend/public/archivio_account.html` |
| B | **`trash` dei `syncRecords`** (legacy, senza UI) | `users/{uid}/trash/{recordId}` | callable backend `trashSyncRecord` / `restoreSyncRecord` (`functions/index.js:445-446`) | copia del record + `deletedAt`, `purgeAfterMs` (`functions/index.js:429`) | **nessuna**: il metadato `purgeAfterMs` (30 giorni) non è letto da alcun processo | **nessuna** |

Dettagli verificati:

- **A — archiviazione senza scadenza.** `createArchiveMetadata` non produce alcun campo di scadenza (`Frontend/public/assets/js/modules/settings/archive-account-model.js:1-7`), e il test `tests/archive-account-model.test.mjs:8,14` verifica che l'archiviazione non pianifichi cancellazioni (`metadata.purgeAfter === undefined`).
- **A — messaggio all'utente coerente con l'assenza di scadenza.** La UI dell'Archivio mostra «Conservato finché non lo elimini manualmente» (`Frontend/public/assets/js/modules/settings/archivio_account.js:355`).
- **B — durata scritta ma inerte.** `RETENTION_MS = 30 * 24 * 60 * 60 * 1000` (`functions/history-recovery-service.js:2`) e `purgeAfterMs: Date.now() + RETENTION_MS` (`functions/index.js:429`). La ricerca sull'intero repository non trova alcun consumatore di `purgeAfterMs`: il campo è rimosso al ripristino (`functions/index.js:433`) e mai applicato.
- **B — nessun percorso utente.** Nessun modulo di `Frontend/public/assets/js` referenzia `trashSyncRecord`, `restoreSyncRecord` o la collezione `trash` (ricerca su tutto il frontend distribuito).
- **Nessun TTL di progetto nel repository.** `firebase.json` non contiene sezioni TTL; l'unica occorrenza di `ttl` è `"ttl": false` in `firestore.indexes.json:7` (override di indicizzazione su `accounts.sharedWith`).

## 3. Account archiviati: comportamento attuale

### 3.1 Archiviazione

L'utente archivia un Account scrivendo i metadati sul documento (`archive-account-model.js:1-7`), con incremento di `revision`. Non viene creata una copia separata e non viene scritta alcuna scadenza. Il record resta quindi nel percorso applicativo principale: la lettura del documento continua a esistere e viene filtrata dal flag.

### 3.2 Ripristino

Il ripristino è lato client con controllo di concorrenza (CAS) sulla revisione letta: richiede `isArchived === true` e revisione coincidente, quindi rimuove i metadati di archiviazione e incrementa la revisione (`Frontend/public/assets/js/modules/settings/archive-account-service.js:164-190`). Un conflitto non sovrascrive e chiede di aggiornare l'Archivio.

### 3.3 Cancellazione definitiva (`purgeArchivedAccount`)

Passi verificati nel backend (`functions/index.js:448-537`):

1. richiede autenticazione, `expectedOwnerUid` coincidente con Auth (`:451-452`), comando valido (`:454-456`) e conferma esplicita `DELETE_FOREVER` (`:457`; il valore è accettato solo da `validatePurgeCommand`, `functions/archive-purge-service.js:18`);
2. costruisce un binding e una ricevuta protetta; una ricevuta legacy in `archiveOperations` **blocca** l'operazione con `LEGACY_ARCHIVE_RESULT_UNVERIFIED` (`functions/index.js:462-480`);
3. in una prima transazione scrive lo stato `processing` in `mutationResults/{uid}/operations/{operationId}` (`:470`, `:489-492`);
4. legge la sottocollezione `attachments` del documento (`:500`), valida ogni `storagePath` con `isSafeAttachmentPath` (`:502`; la regola richiede prefisso `users/{uid}/[...]/accounts/{id}/attachments/`, assenza di `..` e lunghezza ≤ 1024, `functions/archive-purge-service.js:26-40`) e in caso contrario **interrompe** senza cancellare nulla;
5. elimina gli oggetti Storage con `delete({ignoreNotFound: true})` (`functions/index.js:506`);
6. esegue `store.recursiveDelete(recordRef)` sul documento Account (`:507`);
7. in una transazione finale rilegge Profilo e **tutte** le aziende, pianifica la pulizia dei riferimenti (`planProfileReferenceCleanup`), rifiuta piani oltre 450 modifiche, applica le patch, marca la ricevuta `purged` e scrive l'evento di audit `account-purged` (`:509-535`).

Atomicità: i passi 5 e 6 **non** sono dentro una transazione. Un'interruzione fra il passo 4 e il 7 lascia la ricevuta in `processing` e consente una ripresa (`purgeDecision`, `functions/archive-purge-service.js:42-50`), ma lo Storage e `recursiveDelete` restano fuori dall'atomicità globale. La race fra purge e ripristino è già dichiarata aperta nel contratto d'area (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:55-60`) e **non** è chiusa da questo censimento.

### 3.4 Copie residue dopo il purge (verificate)

| Percorso | Sopravvive al purge? | Perché |
|---|---|---|
| `users/{uid}/accounts/{id}` e sottoalberi (inclusi `attachments` metadati) | **no** | `recursiveDelete` (`functions/index.js:507`) |
| oggetti Storage elencati nei metadati dell'Account | **no** (best effort) | `bucket.file(path).delete({ignoreNotFound: true})` (`:506`) |
| oggetti Storage **non** elencati in quei metadati | **sì** | vengono cancellati solo i percorsi letti dalla sottocollezione (`:500-501`) |
| `users/{uid}/auditEvents/**` | **sì** | collezione sorella, non inclusa in `recursiveDelete`; l'evento `account-purged` stesso resta (`:530-533`) |
| `mutationResults/{uid}/operations/{operationId}` | **sì** | registro di avanzamento separato (`:470`, `:529`) |
| `users/{uid}/archiveOperations/**` (legacy) e `operationResults/**` | **sì** | percorsi di ricevuta distinti (`:471`, `:410`) |
| `accountWidgets`, `sharedVaultData`, `sharedVaultLinks` | **sì** | collezioni sorelle del documento Account: la cancellazione ricorsiva non le raggiunge (già registrato in `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:57`) |
| riferimenti nei Profili e nelle aziende | parzialmente | la pulizia finale aggiorna solo i campi con riferimento esatto, con budget 450 (`functions/index.js:517-528`) |
| backup `.cpbackup` già esportati dall'utente | **sì** | il backup è un file locale dell'utente, fuori dal controllo del servizio (sezione 6) |
| cache del dispositivo (Firestore offline, IndexedDB, Cache Storage) | **non gestita dal purge** | nessuna riga del purge la tocca |

## 4. Cronologia e audit: comportamento attuale

### 4.1 Dove sono gli eventi

L'audit produttivo è **una sola collezione**: `users/{uid}/auditEvents/{operationId}` (documento identificato dall'`operationId`). È scritta da cinque punti di `functions/index.js`:

| Sorgente | Azione registrata | Riga |
|---|---|---|
| `trashSyncRecord` / `restoreSyncRecord` | `trashed` / `restored` con `safeAudit` | `functions/index.js:437-440` |
| `purgeArchivedAccount` | `account-purged` (oggetto letterale, **senza** `safeAudit`) | `functions/index.js:530-533` |
| `manageSharedVaultData` | `shared-vault-<action>` (oggetto letterale) | `functions/index.js:309-316` |
| `manageAccountWidget` | `account-widget-<action>` (oggetto letterale) | `functions/index.js:387-394` |
| `restoreBackupChunk` | `backup-restore-chunk` con `safeRestoreAudit` | `functions/index.js:602-608` |

### 4.2 Contenuto: allowlist applicata solo a due percorsi su cinque

- `safeAudit` restituisce esclusivamente `{schemaVersion: 1, action, actorUid, recordId, operationId}` e rifiuta azioni fuori da `{trashed, restored, purged}` (`functions/history-recovery-service.js:29-34`); i campi del payload non vengono copiati.
- `safeRestoreAudit` restituisce solo `{action, actorUid, operationId, backupId, chunkIndex, recordCount}` (`functions/backup-restore-service.js:136-142`).
- Gli eventi `purgeArchivedAccount`, `manageSharedVaultData` e `manageAccountWidget` costruiscono l'oggetto a mano: contengono anch'essi solo identificatori tecnici (`accountId`, `context` limitato a `private`/`company`, `sharedDataId`, `widgetId`, `revision`), ma **non passano da un validatore condiviso**. La garanzia è per costruzione del letterale, non imposta.
- Test pertinenti: `functions/test/history-recovery-service.test.js:15` («audit espone soltanto identificatori tecnici consentiti») e `functions/test/backup-restore-service.test.js:68` («audit conserva soltanto contatori e identificatori tecnici»), entrambi con un segreto fittizio nel payload che non deve comparire nel documento.

### 4.3 Limite e scadenza

- **Nessun limite quantitativo e nessuna scadenza** su `auditEvents`: non esiste contatore, finestra temporale, potatura o TTL nel percorso produttivo.
- Il requisito di contratto «la cronologia è limitata agli eventi necessari» e il gate «cronologia limitata» (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:19,29`) trovano riscontro **solo nel laboratorio**: `appendHistory(..., maximum = 100)` con troncamento `slice(-maximum)` (`experiments/history-recovery/history-model.mjs:26-27`).
- La collezione `recordHistory` **non esiste in produzione**: compare soltanto nelle Rules candidate di laboratorio (`experiments/history-recovery/firestore.candidate.rules:9-12`), non pubblicate (`firebase.json` pubblica `firestore.rules`).
- Nessuna interfaccia utente mostra la cronologia: nessun modulo di `Frontend/public/assets/js` legge `auditEvents` o `recordHistory`.

### 4.4 Chi può leggere, scrivere e cancellare l'audit

- `firestore.rules:106-118` è un'autorizzazione generica del proprietario (`allow read, write: if isOwner(userId)`) che **esclude** un elenco di collezioni: `contacts`, `pushDevices`, `notificationDeliveries`, `deadlineNotifications`, `receivedDeadlines`, `operationResults`, `profileWidgets`, `accountWidgets`, `sharedVaultData`, `sharedVaultLinks`.
- `trash`, `auditEvents`, `archiveOperations`, `backupRestoreOperations` e `syncRecords` **non sono in quell'elenco**: il client autenticato del proprietario può quindi creare, modificare e **cancellare** i propri documenti di audit tramite SDK.
- Le ricevute protette sono invece in sola lettura per il client: `mutationResults/{userId}/operations/{operationId}` → `allow write: if false` (`firestore.rules:30-33`) e `operationResults` → `allow write: if false` (`:101-104`).
- Le Rules candidate di laboratorio renderebbero `auditEvents` e `trash` non scrivibili dal client (`experiments/history-recovery/firestore.candidate.rules:5-16`); i test emulatori `tests/history-recovery.rules.test.mjs:9,17` verificano quelle Rules candidate, **non** quelle produttive.

### 4.5 Effetto del purge sulla cronologia

Il purge di un Account **non** elimina né anonimizza alcun evento: `auditEvents` non è toccato da `recursiveDelete` (che agisce sul solo documento Account, `functions/index.js:507`) e nessuna riga del percorso cancella o redige eventi. L'evento `account-purged` resta quindi in `auditEvents` con `actorUid`, `accountId` e `context`.

## 5. Allegati: comportamento attuale

### 5.1 Dove vivono i byte e dove i metadati

| Tipo | Percorso Storage | Riferimento nel metadato | Riga |
|---|---|---|---|
| Allegato Account privato | `users/{uid}/accounts/{accountId}/attachments/{nome}` | campo `storagePath` nel documento di sottocollezione `attachments` | `Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js:126,140-148` |
| Allegato Account aziendale | `users/{uid}/aziende/{companyId}/accounts/{accountId}/attachments/{nome}` | idem | `Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js:101,114-123` |
| Allegato Scadenza | `users/{uid}/scadenze/{deadlineId o new_<ts>}/{nome}` | array `attachments` nel documento scadenza | `Frontend/public/assets/js/modules/scadenze/deadline-save-service.js:42,151` |
| Allegato anagrafica azienda (legacy) | `users/{uid}/aziende_allegati/{nome}` | array `allegati` nel documento azienda | `Frontend/public/assets/js/modules/azienda/ma_save.js:149,161` |
| Avatar/foto profilo | `users/{uid}/avatar_{nome}` | `photoURL` nel documento utente **e** in `localStorage['codex_profile_avatar_{uid}']` | `Frontend/public/assets/js/modules/privato/profilo-ui.js:46-50` |
| Logo/referente azienda | **nessun oggetto Storage**: data-URL dentro il documento azienda (`logo`, `referentePhoto`) | — | `Frontend/public/assets/js/modules/azienda/ma_save.js:141,143` |

Il purge di un Account elimina gli oggetti Storage **solo** per i percorsi letti dalla sottocollezione `attachments` di quell'Account (`functions/index.js:500-501`), con prefisso obbligatorio validato (`functions/archive-purge-service.js:32-40`). **Cinque famiglie di percorsi su sei non sono toccate da alcun flusso backend**: `scadenze/**`, `aziende_allegati/**`, `avatar_*`, gli allegati di Aziende eliminate e quelli di Account aziendali eliminati con l'hard-delete.

### 5.2 Ordine di scrittura e cancellazione (non atomici)

- **Upload**: sempre prima i byte (`uploadBytes` con `contentType: application/octet-stream` e `customMetadata.encrypted = 'v1'`), poi `getDownloadURL`, poi la scrittura del metadato (`.../privato/dettaglio-privato-attachments.js:132-148`). Nessuna transazione: un'interruzione fra i due passi lascia un oggetto senza metadato.
- **Cancellazione dall'utente**: `deleteObject` e poi `deleteDoc` (`.../privato/dettaglio-privato-attachments.js:270-272`; variante aziendale `:238-244`). Un errore nella seconda fase lascia un metadato senza byte; non esiste ricevuta né audit per questa operazione.
- **Purge**: `bucket.file(path).delete({ignoreNotFound: true})` su tutti i percorsi raccolti, in parallelo, **prima** di `recursiveDelete` (`functions/index.js:506-507`). La cancellazione dei byte non è nella transazione che marca `purged`, quindi non è atomica rispetto al metadato.
- **Percorso non conforme**: un solo `storagePath` fuori dal prefisso dell'Account **interrompe l'intero purge** con `failed-precondition` prima di qualunque cancellazione (`functions/index.js:502-504`), lasciando la ricevuta in `processing`.
- **Nessuna scadenza automatica**: `firebase.json` non contiene alcuna sezione `lifecycle` per Storage e nel repository non esiste alcuna policy di lifecycle. L'eventuale lifecycle a livello di bucket GCS è **non verificato** (sezione 11); `storage.cors.json` configura solo CORS.

### 5.3 Percorsi che NON passano dal protocollo di cancellazione (verificati)

| Percorso | Cosa elimina | Cosa resta |
|---|---|---|
| Rimozione di una riga dall'array `allegati` (anagrafica azienda) | solo la voce dell'array (`.../azienda/ma_attachments.js:65-68`) | l'oggetto su Storage |
| Rimozione di una riga dall'array `attachments` di una Scadenza | solo la voce dell'array (`.../scadenze/deadline-attachment-controller.js:41-43`) | l'oggetto su Storage e l'eventuale cartella `new_<ts>` di una scadenza mai salvata |
| Cancellazione di una Scadenza | il documento; il trigger rimuove solo le copie ricevute (`functions/index.js:1689-1704`) | tutti i byte sotto `users/{uid}/scadenze/{id}/**` |
| Hard-delete di un Account aziendale | il solo documento (`.../azienda/account_azienda.js:271`; `.../azienda/form-azienda-save.js:326`) | metadati della sottocollezione `attachments` e relativi oggetti Storage |
| Hard-delete di un'Azienda | il solo documento (`.../azienda/ma_save.js:204`) | sottocollezioni `accounts/*/attachments` e oggetti `aziende_allegati/**` |
| Cambio avatar | **nessuna** cancellazione dell'avatar precedente | un oggetto orfano per ogni sostituzione |

### 5.4 Permessi

`storage.rules:33-36` concede al proprietario `read, delete` e `create, update` sotto `users/{userId}/**`; l'upload è vincolato da `isAllowedUpload()` (dimensione > 0, ≤ 25 MiB + 1 KiB, MIME in allowlist, e `metadata.encrypted == 'v1'` obbligatorio per `application/octet-stream`, `storage.rules:9-21`). Il proprietario può quindi **cancellare** i propri oggetti senza passare dal backend, e può creare oggetti sotto qualunque prefisso del proprio spazio: l'inventario dei prefissi ricavato dal codice non prova che il bucket non ne contenga altri. Nessuna regola Firestore dedicata esiste per i metadati degli allegati: ricadono nella wildcard proprietario (`firestore.rules:106-118`).

### 5.5 Crittografia, legacy e ciò che non è autenticato

- L'AAD degli allegati Account è la costante `CodiciPassword-Attachment-v1` (`Frontend/public/assets/js/modules/shared/attachment-security.js:13`): percorso Storage, nome del file e ID dell'Account **non** entrano nell'autenticazione (`docs/AUDIT_PROGETTO_FASE2_STATICO.md:258`, `docs/M8_BACKUP_RECUPERO.md:111`). Il candidato di laboratorio usa un AAD contestuale (`experiments/persistent-vault-shell/profile-document-attachments-contract.mjs:108-115`), ma **non è montato**.
- **Allegati legacy senza campo `encryption`**: vengono aperti con `openExternalUrl(attachment.url)` **senza** passare dalla Vault Key (`.../privato/dettaglio-privato-attachments.js:230-232`; stessi rami in `.../azienda/dettaglio-azienda-attachments.js:211-213`, `.../azienda/dati-azienda-attachments.js:37-40`, `.../scadenze/dettaglio_scadenza.js:489-492`). Storicamente questi metadati possono non avere `storagePath`, e in tal caso il purge li ignora (`.filter(Boolean)`, `functions/index.js:501`).
- **Avatar non cifrato**: l'upload non applica `customMetadata` né cifratura (`.../privato/profilo-ui.js:46-50`); l'URL è persistito anche in `localStorage`.
- **Ripristino e marcatore**: i byte vengono ricaricati con `customMetadata.encrypted = 'v1'` (`.../settings/backup-import-service.js:448-450`) anche quando il metadato ripristinato non ha `encryption`: possibile etichetta non corrispondente all'involucro effettivo.

### 5.6 Orfani possibili (dedotti dal codice)

| Caso | Come si produce | Copertura |
|---|---|---|
| metadato senza byte | `deleteObject` riuscito e `deleteDoc` fallito; oppure cancellazione manuale dell'oggetto dal client (consentita da `storage.rules:34`) | nessuna riparazione automatica |
| byte senza metadato | `uploadBytes` riuscito e `addDoc` fallito, pagina abbandonata, form annullato dopo l'upload (`.../azienda/ma_save.js:147-161` carica prima della transazione) | nessun job li cerca: il purge legge solo i `storagePath` elencati (`functions/index.js:501`) |
| byte di Scadenze e `aziende_allegati` | rimozione dall'array o cancellazione del documento (sezione 5.3) | nessuna gestione in alcun flusso backend |
| byte dell'avatar | ogni cambio avatar | nessuna cancellazione; il purge non tocca `users/{uid}/avatar_*` |
| metadati di sottocollezioni | hard-delete di Azienda o di Account aziendale | restano irraggiungibili dalla UI |
| oggetti non elencati nei metadati | upload non registrato o percorso scritto direttamente dal client | il purge non scansiona il prefisso |
| versioni precedenti dell'oggetto | dipende da object versioning del bucket: **non verificato** | — |
| record `reserved` del candidato | interruzione fra prenotazione e scrittura dell'oggetto | chiusi solo con `recover()` invocato manualmente (`experiments/persistent-vault-shell/profile-document-attachments-handler.mjs:379-461`) |

Verifica dell'esistenza effettiva di orfani nel progetto reale: **non verificata** (richiederebbe di listare il bucket; nessun dato reale è stato letto).

### 5.7 Copertura di test e suoi limiti

Test pertinenti: `tests/storage.rules.test.mjs:29,40,51,69,80` (permessi, isolamento UID, MIME/dimensioni, marcatore `encrypted`), `tests/attachment-security.test.mjs:21,28,34,41` (MIME, nomi casuali, URL, cifratura), `tests/private-account-detail-lifecycle.test.mjs:166,172,179,202` e `tests/company-account-detail-lifecycle.test.mjs:69,75,106` (nessuna cancellazione di byte di un Account dopo il cambio di contesto), `tests/deadline-detail-lifecycle.test.mjs:92,173`, `functions/test/archive-purge-service.test.js:19` e `functions/test/backup-restore-service.test.js:11` (percorsi), `tests/backup-restore-session.test.mjs:110,287,333,355,369,498,532` (allegati nel ripristino).

**Copertura del ramo distruttivo (aggiornata da M7-R2 il 21/09/2026):** i test del purge sono stati estesi con un fake Storage che elenca davvero i metadati `attachments` e registra ogni `bucket.file(path).delete` (`functions/test/archive-receipt-handler.test.js`). Ora sono dimostrati: la cancellazione dei byte elencati **nell'ordine previsto e prima** di `recursiveDelete`, con `ignoreNotFound`, e l'ignoranza degli allegati senza `storagePath` (T-25, riga 160); l'arresto **prima di qualunque** cancellazione — compresi i percorsi validi — quando un percorso esce dal prefisso dell'Account (T-05, riga 174); l'errore parziale Storage che lascia la ricevuta in `processing` senza falso `purged`, con ripresa idempotente dello stesso comando (T-06, riga 187). Restano non coperti: la rimozione di una riga dagli array, gli hard-delete di Azienda/Account aziendale, la sostituzione dell'avatar, l'apertura di un legacy senza `encryption`, la cancellazione client completa byte+metadato (T-15) e la pulizia della cache del dispositivo.

## 6. Backup e ripristino: comportamento attuale

### 6.1 Il file di backup è locale

L'export produce un file `codici-password-<data>.cpbackup` scritto con File System Access API oppure scaricato via Blob (`Frontend/public/assets/js/modules/settings/backup-export-service.js:120,161`); **non viene caricato** su Storage o Firestore. La prima riga è un'intestazione **in chiaro** con formato, `schemaVersion: 2`, `ownerUid`, `backupId`, `createdAt` e parametri KDF; i record e gli allegati seguono cifrati AES-GCM-256 concatenati (`.../settings/backup-crypto.js:50-59`, `backup-export-service.js:167,172-188`). La Recovery Key è generata una sola volta e azzerata alla chiusura (`.../settings/impostazioni.js:681-735`).

Conseguenza di retention: **le copie di backup sono fuori dal controllo del servizio**. Il purge di un Account non può cancellare un file `.cpbackup` già esportato, e l'export include anche gli Account archiviati (nessun filtro `isArchived` nella raccolta dei record).

### 6.2 Cosa resta dopo un ripristino

| Elemento | Percorso | Persistenza | Riga |
|---|---|---|---|
| Ricevuta del blocco | `mutationResults/{uid}/operations/{operationId}` con `binding`, `operationHash`, `appliedAt` | permanente, client in sola lettura, nessun TTL | `functions/index.js:554,598-601`; `firestore.rules:30-33` |
| Audit del blocco | `users/{uid}/auditEvents/{operationId}` con azione `backup-restore-chunk` | permanente; cancellabile dal client (wildcard) | `functions/index.js:602-608` |
| Registro legacy bloccante | `users/{uid}/backupRestoreOperations/{operationId}` | letto e **mai scritto** dal codice attuale; se presente blocca l'apply | `functions/index.js:555,571-574` |
| Oggetti allegato | `users/{uid}/...` al **percorso finale** | nessuno staging, nessuna copia preventiva | `.../settings/backup-import-service.js:445-452` |
| Journal / compensazione | — | **assenti** nel runtime: la compensazione esiste solo nel laboratorio `experiments/persistent-vault-shell/**` e per un altro dominio | — |

Il digest della ricevuta è calcolato sull'**intero comando, dati dei record inclusi** (`functions/backup-restore-receipt.js:31`): la ricevuta conserva quindi un'impronta dei dati ripristinati, non solo metadati.

### 6.3 Atomicità

Il ripristino applica blocchi separati (max 400 record per blocco, `functions/backup-restore-service.js:3`) e carica gli allegati dopo i record. Un'interruzione lascia record applicati senza allegati o allegati parziali sul percorso finale, senza rollback complessivo (confermato da `tests/backup-restore-session.test.mjs:110`; rilievo F2-P0-07, `docs/AUDIT_PROGETTO_FASE2_STATICO.md:34`). La preview **non scrive nulla** (`functions/index.js:585`).

### 6.4 Copie di consultazione e cache

- Il report di salute delle credenziali è solo in memoria (`.../settings/impostazioni.js:142`); non produce file.
- La cache del dispositivo è indipendente dal backup: cache Firestore persistente multi-tab (`Frontend/public/assets/js/firebase-config.js:56-58`) e marcatore di preparazione offline `codex_offline_ready_{uid}` in `localStorage` con TTL 5 minuti valutato **alla lettura** (`Frontend/public/assets/js/offline-sync.js:27,110-117`). Nessuna cancellazione di questi elementi è stata trovata nel codice esaminato.

## 7. Sintesi: cosa esiste e cosa non esiste

| Proprietà | Stato attuale | Evidenza |
|---|---|---|
| Scadenza automatica del cestino Account | **non esiste** | `archive-account-model.js:1-7`; nessun TTL, nessun job |
| Scadenza automatica del cestino `trash` (syncRecords) | **non esiste** (metadato inerte) | `functions/index.js:429` scrive, nessun lettore |
| Purge manuale backend-only con conferma forte | **esiste** | `functions/index.js:448-537` |
| TTL di progetto Firestore/Storage | **non presente nel repository**; configurazione reale `non verificata` | `firestore.indexes.json:7` (`"ttl": false`); `firebase.json` senza lifecycle |
| Schedulazioni backend | **una sola**, per le scadenze | `functions/index.js:1486` |
| Limite quantitativo della cronologia | **esiste solo nel laboratorio** (100 eventi) | `experiments/history-recovery/history-model.mjs:26-27` |
| Audit con allowlist senza segreti | **esiste su 2 percorsi su 5** | `history-recovery-service.js:29-34`; `backup-restore-service.js:136-142` |
| Audit leggibile/scrivibile/cancellabile dal proprietario | **sì** (Rules produttive) | `firestore.rules:106-118` |
| Anonimizzazione dell'audit al purge | **non esiste** | nessuna riga cancella o redige `auditEvents` |
| Pulizia dei widget/credenziali condivise collegate all'Account | **solo proposta, non attiva** | `functions/archive-purge-reference-plan.js:16-18,32` |
| Staging del ripristino (nessun residuo temporaneo) | **non implementato** → nessun residuo di staging | `functions/index.js:539-608`; `backup-import-service.js:445-452` |
| Journal durevole del ripristino | **assente** | solo ricevute per blocco |
| Copie residue dopo il purge | **presenti e non gestite** | sezione 3.4 |

## 8. Proposta di politica di retention (confrontabile, non approvata)

Le durate **non sono decise qui**. Per ogni dimensione sono elencate le opzioni tecniche, che cosa richiede ciascuna e se la scelta spetta al proprietario.

### D1 — Durata ordinaria del cestino (Archivio Account)

| Opzione | Comportamento | Cosa richiede |
|---|---|---|
| **D1-a** Conservazione illimitata fino a purge manuale (stato attuale) | nessuna cancellazione automatica | nulla; da dichiarare esplicitamente all'utente |
| **D1-b** Finestra dichiarata con purge assistito | allo scadere la UI segnala gli elementi e propone la cancellazione | definizione della durata; contatore/marcatura; nessun job obbligatorio |
| **D1-c** Finestra dichiarata con purge automatico | un job pianificato elimina gli elementi scaduti | funzione `onSchedule` nuova; ricevute per ogni eliminazione; gestione degli errori e della ripetizione; **il purge automatico è distruttivo e richiede una decisione esplicita del proprietario** |

*Vincolo tecnico:* il purge attuale è una saga non atomica con conferma obbligatoria; un purge automatico dovrebbe riusare lo stesso protocollo senza conferma interattiva (D2). *Decisione del proprietario:* durata e se la cancellazione debba essere automatica o solo proposta.

### D2 — Eliminazione immediata richiesta dall'utente

- Stato attuale: possibile, con conferma testuale e callable (`archivio_account.js`; `functions/index.js:448-537`).
- Da decidere: se esistono categorie per cui la cancellazione immediata non è consentita e come comunicarlo. *Scelta del proprietario, con eventuale vincolo legale.*

### D3 — Retention di cronologia e audit

| Opzione | Comportamento | Cosa richiede |
|---|---|---|
| **D3-a** Permanente e non modificabile (raccomandata come base tecnica) | nessuna scadenza; l'utente non può cancellare l'audit | togliere `auditEvents`/`trash`/`archiveOperations` dal wildcard proprietario (`firestore.rules:106-118`) o aggiungerli all'elenco escluso; nessun job |
| **D3-b** Finestra definita con potatura | gli eventi oltre la finestra vengono eliminati o aggregati | job pianificato, conteggi, ricevute; definizione della durata |
| **D3-c** Anonimizzazione al purge dell'Account | l'audit resta ma perde i riferimenti all'Account | patch dell'evento; definizione di cosa resta utile per la diagnosi |

*Vincolo tecnico:* l'audit oggi è cancellabile dal client, quindi non è una prova integra; qualunque politica lo presume integro solo dopo D3-a o D3-c. *Decisione del proprietario:* durata e anonimizzazione.

### D4 — Allegati e copie residue

- Stato attuale: il purge elimina solo gli allegati **elencati** nei metadati dell'Account; cinque famiglie di percorsi non sono toccate da alcun flusso backend (sezione 5.1) e gli orfani non sono cercati.
- Opzioni: **D4-a** solo quanto già elencato (attuale); **D4-b** inventario degli oggetti per prefisso al momento del purge (richiede `list` su Storage dal backend e un budget, e non copre gli oggetti di altri domini); **D4-c** lifecycle di bucket per gli oggetti non più referenziati (richiede una configurazione esterna e una prova su copia non produttiva).
- Da decidere insieme: (i) se la cancellazione debba rimuovere anche `accountWidgets`, `sharedVaultLinks`, `sharedVaultData` e inviti collegati all'Account — il planner esiste ma è **inattivo** e richiede un blocco globale condiviso con ripristino e backup; (ii) se gli allegati di Scadenze, `aziende_allegati` e avatar rientrino in una politica di pulizia dedicata; (iii) cosa fare degli allegati legacy aperti oggi via `url` senza Vault Key.

### D5 — Backup e ricevute

- Stato attuale: file `.cpbackup` locale (fuori dal servizio), ricevute e audit permanenti.
- Opzioni: **D5-a** permanenza (attuale); **D5-b** finestra per ricevute e audit con potatura; **D5-c** documentare all'utente che i backup esportati non sono cancellabili dal servizio.
- *Vincolo tecnico:* senza ricevute permanenti si perde l'idempotenza dei retry; una potatura richiede di conservare almeno il periodo di recupero. *Decisione del proprietario:* durata.

### D6 — Informazione all'utente

- Stato attuale: l'Archivio dichiara «Conservato finché non lo elimini manualmente» (`archivio_account.js:355`); il metadato backend `purgeAfterMs` a 30 giorni (dominio diverso) non ha effetto.
- Da decidere: il testo definitivo deve descrivere la politica approvata, e va rimosso o reso effettivo il metadato inerte per evitare due messaggi contraddittori.

### D7 — Prova di irraggiungibilità

- Stato attuale: **non esiste** una prova che, dopo il purge, il dato non sia raggiungibile dai percorsi applicativi. Sono dimostrabili solo i singoli passi (sezione 3.3-3.4).
- Opzioni: matrice di test sintetici (sezione 9) come prerequisito; in più, una verifica su copia non produttiva prima di dichiarare la politica verificata.

### D8 — Obblighi legali e di conservazione

- Stato attuale: nessuna categoria di dati è distinta per obblighi di conservazione o di cancellazione; la baseline richiede che la cancellazione sia «compatibile con eventuali obblighi di conservazione» (`docs/ARCHITETTURA_SICUREZZA_V1.md:249`).
- Da decidere: se esistono categorie (per esempio documenti fiscali o contrattuali) che devono essere conservate oltre la volontà dell'utente e come questo si riflette su cestino, allegati e backup. *Scelta del proprietario, con eventuale supporto legale; nessuna durata è proposta qui.*

### D9 — Ordine di lavoro

- La definizione della politica (D1–D3, D5) è un prerequisito per dare senso tecnico alle modifiche a planner dei riferimenti residui, blocco globale purge/ripristino e potatura; l'ordine è indicato come domanda 9 nella sezione 10.

## 9. Matrice di test sintetici per la futura verifica

Tutti gli scenari usano esclusivamente dati sintetici e ambienti di laboratorio/emulatori. «Esistente» rimanda a una prova già presente; «da realizzare» indica ciò che manca per verificare la politica scelta. **Ogni riga marcata «esistente» è stata verificata leggendo il test citato**: lo scenario descrive la proprietà che quel test dimostra davvero, e dove la prova copre solo una parte dello scenario la riga è marcata «da realizzare» con la parte già coperta indicata a parte.

| ID | Area | Scenario | Atteso | Stato |
|---|---|---|---|---|
| T-01 | Cestino Account | archiviazione di un Account privato e di uno aziendale | scrittura sul percorso corretto, `isArchived: true`, `revision+1`, `purgeAfter` assente | esistente (`tests/account-page-lifecycle.test.mjs:239`; `tests/archive-account-model.test.mjs:8`) |
| T-02 | Cestino Account | ripristino con revisione cambiata | conflitto, nessuna scrittura | esistente (`tests/archive-session.test.mjs:161`) |
| T-03 | Purge | purge senza conferma o con proprietario diverso | rifiuto prima di ogni accesso a Firestore/Storage | esistente (`functions/test/archive-owner-handler.test.js:41,52`) |
| T-04 | Purge | ripetizione di un comando con esito già `purged` | `duplicate`, nessuna cancellazione Storage o `recursiveDelete`, nessuna scrittura | esistente (`functions/test/archive-receipt-handler.test.js:79`) |
| T-05 | Purge | un `storagePath` fuori dal prefisso dell'Account presente nei metadati | purge interrotto **prima** di ogni cancellazione, ricevuta in `processing` | esistente (`functions/test/archive-receipt-handler.test.js:174`); il predicato isolato è T-33 |
| T-06 | Purge | errore parziale sulle delete Storage | ricevuta resta `processing`, nessun falso `purged`, ripresa idempotente con lo stesso comando | esistente (`functions/test/archive-receipt-handler.test.js:187`) |
| T-07 | Purge | piano di pulizia riferimenti oltre 450 modifiche | transazione finale annullata, nessuna pulizia parziale | esistente (`functions/test/purge-profile-cleanup-handler.test.js:63`) |
| T-08 | Copie residue | dopo il purge restano `accountWidgets`/`sharedVaultLinks`/inviti | documentare l'esito atteso secondo la politica scelta | **da realizzare** |
| T-09 | Copie residue | allegato su Storage non elencato nei metadati | resta dopo il purge: verificare la scelta D4 | **da realizzare** |
| T-10 | Cronologia | un evento di audit non contiene segreti | il segreto fittizio non compare nel documento | esistente (`functions/test/history-recovery-service.test.js:15`; `functions/test/backup-restore-service.test.js:68`) |
| T-11 | Cronologia | limite/scadenza della cronologia nel runtime | cancellazione automatica degli eventi oltre la finestra decisa | **da realizzare** in produzione: la finestra di **24 mesi** è decisa e il candidato di laboratorio è provato (T-34…T-38), ma nessun job esiste ancora nel runtime |
| T-12 | Cronologia | il client tenta di creare, modificare o cancellare un evento di audit | rifiuto secondo la politica decisa | **da realizzare** in produzione: provato solo sulle Rules candidate (`tests/history-recovery.rules.test.mjs`); le Rules produttive consentono ancora le scritture proprietario |
| T-13 | Cronologia | effetto del purge su `trash`/`auditEvents`/ricevute legacy | definito e verificato | **da realizzare** |
| T-14 | Allegati | upload senza marcatore `encrypted` per `application/octet-stream` | rifiuto delle Rules | esistente (`tests/storage.rules.test.mjs:69`; `storage.rules:9-21`) |
| T-15 | Allegati | cancellazione di un allegato da parte dell'utente: percorso completo con esito positivo | oggetto rimosso **e** metadato rimosso, senza residui | **da realizzare**: i test citati in T-32 dimostrano solo l'arresto dopo il cambio di Account, non il percorso completo |
| T-16 | Allegati | oggetto orfano per prefisso dopo il purge | assente o motivato secondo D4 | **da realizzare** |
| T-25 | Allegati | purge con `storagePath` reali: il ramo di cancellazione byte è esercitato | cancellazione effettiva, nell'ordine previsto e prima di `recursiveDelete`, con `ignoreNotFound` | esistente (`functions/test/archive-receipt-handler.test.js:160`) |
| T-26 | Allegati | rimozione di una riga dagli array `allegati`/`attachments` e cancellazione di una Scadenza | byte non più referenziati: esito definito secondo D4 | **da realizzare** |
| T-27 | Allegati | hard-delete di Azienda o di Account aziendale | metadati e byte residui: esito definito secondo D4 | **da realizzare** |
| T-28 | Allegati | cambio avatar | il precedente oggetto non resta orfano, o è dichiarato | **da realizzare** |
| T-29 | Allegati | apertura di un allegato legacy senza `encryption` | comportamento di sicurezza dichiarato (oggi `openExternalUrl` senza Vault Key) | **da realizzare** |
| T-17 | Backup | header in chiaro con `ownerUid`/`backupId`/`createdAt` | documentato come accettato o rimosso | **da realizzare** (decisione D5/D6) |
| T-18 | Backup | errore al secondo blocco o durante il caricamento degli allegati | stato parziale dichiarato, nessun successo | esistente (`tests/backup-restore-session.test.mjs:100,110`) |
| T-19 | Backup | ricevuta con dati cambiati o comando diverso | rifiuto, nessuna riapplicazione | esistente (`functions/test/backup-restore-receipt.test.js:22`) |
| T-20 | Backup | registro legacy presente | apply bloccato con `LEGACY_BACKUP_RESULT_UNVERIFIED`, nessuna scrittura | esistente (`functions/test/backup-receipt-handler.test.js:48`) |
| T-21 | Backup | importo un backup che contiene un Account poi purgato | comportamento definito secondo D5 | **da realizzare** |
| T-22 | Trasversale | TTL/lifecycle effettivamente assenti sul progetto | verifica esterna documentata | **da realizzare** (verifica di configurazione, non test di codice) |
| T-23 | Trasversale | cache del dispositivo dopo purge/logout | esito definito secondo la politica | **da realizzare** |
| T-24 | Trasversale | copia di consultazione (report/Excel) e dati purgati | nessun residuo non dichiarato | **da realizzare** |
| T-30 | Cestino Account | lettura della lista dell'Archivio (filtro sugli archiviati) | compaiono solo i record archiviati, con l'identità di contesto corretta | **da realizzare**: la query vive nel repository; i test esistenti coprono staleness e identità della selezione (`tests/archive-session.test.mjs:207,232`), non il filtro |
| T-31 | Cestino Account | ripristino riuscito | identità privato/azienda conservata, solo stato di archiviazione e revisione aggiornati | esistente (`tests/archive-session.test.mjs:147`) |
| T-32 | Allegati | cancellazione di un allegato interrotta dal cambio di Account | nessuna scrittura di metadati sotto il nuovo Account; se la conferma arriva dopo il cambio, nessuna operazione | esistente (`tests/private-account-detail-lifecycle.test.mjs:166,172`) |
| T-33 | Purge | predicato di percorso sicuro su un `storagePath` di un altro proprietario o fuori dal prefisso dell'Account | percorso rifiutato come non sicuro | esistente (`functions/test/archive-purge-service.test.js:19`) |
| T-34 | Cronologia | evento dentro, al confine e oltre la finestra di 24 mesi | conservato dentro, cancellabile al confine e oltre | esistente in laboratorio (`experiments/history-recovery/audit-retention.test.mjs:26,35`) |
| T-35 | Cronologia | record senza data valida, nanosecondi fuori intervallo o secondi non rappresentabili | mai cancellato, elencato come `unverifiable` e fuori da ogni lotto | esistente in laboratorio (`experiments/history-recovery/audit-retention.test.mjs:19,35,162,177`) |
| T-36 | Cronologia | cancellazione a lotti con errore parziale e ripresa | nessun falso completamento; ripresa idempotente dagli eventi residui | esistente in laboratorio (`experiments/history-recovery/audit-retention.test.mjs:46,120`) |
| T-37 | Cronologia | isolamento UID e percorsi fuori dal registro | piano interrotto; nessuna ricevuta pianificata o toccata; piani arbitrari rifiutati prima di ogni cancellazione | esistente in laboratorio (`experiments/history-recovery/audit-retention.test.mjs:65,81,204`) |
| T-38 | Cronologia | il client tenta create, update e delete su un evento di audit | tutte e tre negate; lettura del proprietario conservata | esistente in laboratorio (`tests/history-recovery.rules.test.mjs:17`, Rules candidate) |

## 10. Domande decisionali per Diego

1. **D1 — Durata del cestino Account**: illimitata con cancellazione manuale (attuale), oppure una finestra dichiarata? Se una finestra, la cancellazione allo scadere deve essere **automatica** o solo **proposta** all'utente?
2. **D2 — Cancellazione immediata**: confermi che l'utente può sempre cancellare subito ciò che ha archiviato, senza attese? Esistono categorie escluse?
3. **D3 — Cronologia e audit**: (a) permanenti e non cancellabili dall'utente, (b) con finestra e potatura, (c) anonimizzati al purge dell'Account? In tutti i casi: si rimuove la scrittura/cancellazione client su `auditEvents` (raccomandato per l'integrità della prova)?
4. **D4 — Residui del purge**: ci si limita agli allegati elencati (attuale) o si aggiunge un inventario per prefisso? Si cancellano anche `accountWidgets`, `sharedVaultLinks`, `sharedVaultData` e inviti collegati all'Account (il planner è pronto ma inattivo)?
5. **D5 — Backup e ricevute**: le ricevute di idempotenza e gli audit restano permanenti? I backup esportati dall'utente vanno dichiarati esplicitamente come **fuori** dal perimetro di cancellazione del servizio?
6. **D6 — Messaggi all'utente**: chi approva i testi definitivi di Archivio, cancellazione definitiva e backup? Va rimosso il metadato inerte `purgeAfterMs` (30 giorni) per evitare due messaggi contraddittori?
7. **D7 — Prova di irraggiungibilità**: quale livello di prova è richiesto prima di dichiarare la politica verificata (matrice sintetica soltanto, oppure anche una prova su copia non produttiva)?
8. **D8 — Obblighi legali**: esistono categorie di dati con obblighi di conservazione o di cancellazione che devono prevalere sulla politica scelta?
9. **D9 — Ordine di lavoro**: la definizione della politica viene prima dell'attivazione del planner dei riferimenti residui e del blocco globale purge/ripristino?

## 11. Limiti del censimento e voci `non verificate`

**Non verificato da questo repository (richiede accesso esterno o dati reali, non usati):**

1. policy TTL Firestore a livello di progetto (`gcloud firestore fields ttls list`) e assenza di lifecycle/versioning sul bucket Storage (`gcloud storage buckets describe`, `gsutil lifecycle get`);
2. corrispondenza fra questo ramo e ciò che è **effettivamente distribuito** (Functions, Rules, Hosting) sul progetto `appcodici-password`;
3. presenza nei dati reali di metadati legacy (`purgeAfter`, ricevute `archiveOperations`/`backupRestoreOperations`, allegati senza campo `encryption` o senza `storagePath`);
4. esistenza e quantità di oggetti Storage orfani e prefissi realmente presenti nel bucket (le Rules consentono al proprietario di scrivere qualunque percorso sotto `users/{uid}/**`);
5. esistenza di file `.cpbackup` già esportati contenenti dati poi purgati;
6. retention dei log delle Cloud Functions, che possono contenere il payload dei comandi di ripristino;
7. eventuali procedure operative esterne al repository che eliminino o conservino dati;
8. comportamento in caso di fallimento parziale delle cancellazioni Storage (deducibile, non testato);
9. configurazione reale di App Check, backup gestiti/PITR e quote del progetto;
10. copie residue lato browser: `persistentLocalCache` conserva metadati in IndexedDB, `localStorage['codex_profile_avatar_{uid}']` conserva l'URL dell'avatar e nel codice non esiste una rimozione al logout (l'assenza di altre copie nel browser non è dimostrabile staticamente);
11. validità della `downloadURL` ripristinata dal backup mentre l'oggetto viene riscritto (comportamento backend del token di download, non deducibile dal codice);
12. cifratura at-rest gestita da Google e concorrenza reale fra purge e upload nella finestra fra la lettura di `attachments` (`functions/index.js:500`) e `recursiveDelete` (`:507`): il codice non serializza le due operazioni.

**Limiti di metodo.** Il censimento è statico: legge codice, Rules e configurazione versionata; non esegue test, non interroga il progetto, non legge dati reali. Le proprietà elencate come «esistenti» derivano da codice e test citati, non da un collaudo end-to-end. Nessuna durata, eccezione legale o cancellazione definitiva è stata decisa o implementata da questo documento.

## 12. Riferimenti

- Baseline: `docs/ARCHITETTURA_SICUREZZA_V1.md` (§13 backup/recupero/cancellazione; §19 decisioni aperte).
- Contratto d'area: `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md`, `docs/M8_BACKUP_RECUPERO.md`.
- Piano: `docs/PIANO_MATURITA_PROFESSIONALE.md` (M7, M8).
- Rilievi: `docs/AUDIT_PROGETTO_FASE2_STATICO.md` (F2-P0-07, F2-P1-01, F2-P1-03, F2-P1-04).
- Incidenti: `docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`.
- Contratti allegati e condivisione: `docs/DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md`.
- Codice citato: `functions/index.js`, `functions/archive-purge-service.js`, `functions/archive-purge-receipt.js`, `functions/archive-purge-reference-plan.js`, `functions/history-recovery-service.js`, `functions/backup-restore-service.js`, `functions/backup-restore-receipt.js`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `Frontend/public/assets/js/modules/settings/**`, `Frontend/public/assets/js/modules/privato/**`, `Frontend/public/assets/js/modules/azienda/**`, `Frontend/public/assets/js/modules/scadenze/**`, `Frontend/public/assets/js/offline-sync.js`, `Frontend/public/assets/js/firebase-config.js`.
