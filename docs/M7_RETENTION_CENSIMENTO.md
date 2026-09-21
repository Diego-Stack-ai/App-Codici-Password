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
- **B — durata scritta ma inerte.** `RETENTION_MS = 30 * 24 * 60 * 60 * 1000` (`functions/history-recovery-service.js:2`) e `purgeAfterMs: Date.now() + RETENTION_MS` (`functions/index.js:429`). La ricerca sull'intero repository non trova alcun consumatore di `purgeAfterMs`: il campo è rimosso al ripristino (`functions/index.js:433`) e mai applicato. **Verificato esercitando (M7-T13):** dopo un purge e dopo un giro del job dei 24 mesi la voce di `trash` è ancora presente con il suo `purgeAfterMs` invariato.
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

**Verifica esercitata (M7-T13, 21/09/2026):** la tabella qui sotto non è più solo lettura del codice. `tests/purge-retention-effects.emulator.test.mjs` esegue la callable reale del purge su Firestore e Storage **emulati** e controlla riga per riga: Account e sottoalbero dei metadati eliminati; byte elencati eliminati; oggetto dello stesso prefisso **non** elencato sopravvissuto; `trash`, collezioni sorelle, ricevuta legacy (scavalcata da una ricevuta di idempotenza fidata), ricevuta di idempotenza e registro sopravvissuti; riferimenti di Profilo e azienda ripuliti; evento `account-purged` scritto con `at` del server. La stessa prova conferma che una ricevuta legacy **sola** ferma il purge con `LEGACY_ARCHIVE_RESULT_UNVERIFIED` senza toccare Account, cestino e registro. Il caso veloce equivalente è in `functions/test/archive-receipt-handler.test.js`.

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

### 3.5 Hard-delete di Azienda e di Account aziendale: due percorsi diversi (verificato M7-T27)

| | **A — Azienda cancellata dal client** | **B — Account aziendale eliminato dal purge** |
|---|---|---|
| Chi lo esegue | client, `deleteCompany` (`company-list-service.js:8-10`) e la form (`ma_save.js:202-206`: conferma → `deleteDoc` → redirect) | callable backend `purgeArchivedAccount`, come per il cestino Account (T-13) |
| Documenti | **solo** il documento Azienda | documento Account **e** sottocollezione `attachments` (ricorsivo) |
| Account aziendali dentro l'Azienda | **restano**: `aziende/{cid}/accounts/**` non viene toccato | è l'oggetto stesso dell'operazione |
| Metadati allegati | restano (nella sottocollezione orfana) | eliminati |
| Byte Storage | **restano**: nessuna primitiva di cancellazione nel percorso client | eliminati **solo** quelli elencati nei metadati; un oggetto dello stesso prefisso non elencato resta |
| Allegati del form Azienda (`users/{uid}/aziende_allegati/**`) | restano | non pertinenti: fuori dal prefisso dell'Account |
| Riferimenti in altri documenti | **restano** e puntano a un'Azienda inesistente (nessuna pulizia) | ripulita **solo** la coppia esatta `(accountId, companyId)`; lo stesso `accountId` in un'altra Azienda e il collegamento privato omonimo restano |
| Ricevute e registro | nessuna scrittura | ricevuta di idempotenza a `purged` + evento `account-purged` |

**Rischio di toccare altri Account.** Provato che **non** accade: nel purge aziendale l'Account con lo **stesso id** in un'altra Azienda conserva documento, metadati e byte, e la pulizia dei riferimenti non tocca la coppia diversa (controllo per mutazione: ignorare l'Azienda di destinazione rende rossi i banchi). La cancellazione dei byte resta comunque limitata ai percorsi elencati e sotto il prefisso dell'Account (`isSafeAttachmentPath`, T-05/T-33).

**Errori parziali.** In A il `deleteDoc` è un'unica operazione: se fallisce, nulla è stato modificato e l'utente vede l'errore; non esiste compensazione (non serve). In B valgono le proprietà di T-13: un errore Storage lascia la ricevuta in `processing`, senza falso `purged`, e la ripetizione è idempotente.

**Prove.** Emulator reali (Firestore + Storage, Rules di produzione): `tests/company-hard-delete-residues.emulator.test.mjs` esegue la **`deleteCompany` reale** (Azienda eliminata; Account, metadati, byte, allegati del form e riferimenti rimasti; l'altra Azienda intatta) e il **purge reale** in contesto `company` (documento e sottocollezione eliminati, byte elencati rimossi, oggetto non elencato sopravvissuto, Account omonimo di un'altra Azienda e suoi byte intatti, riferimento della coppia esatta azzerato). Modello e sorgente: `tests/company-hard-delete-residues.test.mjs` (percorsi, assenza di ricorsione nel client, semantica di `planProfileReferenceCleanup`).

**Limiti dichiarati.** Non sono esercitati l'interfaccia (conferma, redirect, lista aziende) né la visibilità degli Account orfani nella UI: la diagnosi è sui dati. Il percorso A è provato con la funzione reale della lista (`deleteCompany`); la form esegue lo stesso `deleteDoc` e la differenza è asserita sul sorgente. Restano fuori perimetro i residui del purge privato (T-13) e la pulizia degli orfani (D4), non decisa.

### 3.6 Copie condivise e inviti dopo il purge (verificato M7-T08)

Misura dell'effetto del purge su un Account con widget, dati condivisi, collegamento e invito collegato, più una Scadenza condivisa come percorso di confronto. Il purge viene eseguito **reale** (Admin SDK, come in produzione) e la leggibilità è verificata con le **Rules di produzione** su contesti client di proprietario, destinatario ed estraneo.

| Elemento | Dopo il purge | Leggibile dal **destinatario**? |
|---|---|---|
| `users/{uid}/accountWidgets/{id}` | **resta, invariato** (confronto byte per byte prima/dopo) | **no**: sola lettura del proprietario, scrittura negata |
| `users/{uid}/sharedVaultData/{id}` | **resta, invariato** | **no**: idem |
| `users/{uid}/sharedVaultLinks/{id}` | **resta, invariato** | **no**: idem |
| `invites/{inviteId}` | **resta, invariato**: `sharingState: 'suspended'` e `suspendedAt` sono quelli scritti dall'**archiviazione** (`archive-account-service.js:254,352`), non dal purge; `status` non viene riscritto | **sì**, per email: il destinatario legge ancora `accountName`, `accountId`, `status` e `sharingState` dell'Account purgato |
| Account e allegati | **rimossi** (ricorsivo) più i byte elencati | no: il documento non esiste più |
| `users/{destinatario}/receivedDeadlines/{id}` (Scadenze) | **resta, invariato**: percorso separato | **sì**: è la copia del destinatario |
| `deadlineShares/{id}` (indice backend delle Scadenze) | resta; nessun client lo legge | **no**: `allow read, write: if false` |

**Decisioni già prese, misurate e non cambiate.** Il purge **non** riscrive lo stato sospeso (lo fa l'archiviazione), **non** crea un nuovo invito (la riattivazione resta un gesto del proprietario, con il rinvio attuale mantenuto) e **non** tocca la copia della Scadenza nel profilo del destinatario. Nessun job o percorso pulisce queste collezioni: nel backend esistono solo due schedulazioni (scadenze e retention del registro, che scansiona il solo `collectionGroup("auditEvents")`).

**Prove.** `tests/shared-copies-purge.emulator.test.mjs` (2 casi, emulatori Firestore + Storage reali, purge reale e Rules reali) e `tests/shared-copies-purge.test.mjs` (5 casi di sorgente e Rules). **Controllo per mutazione**: purge che elimina una copia condivisa e l'invito → rosso; Rules che ignorano `isArchived` per gli ospiti → rosso (discriminato da un Account archiviato che conserva il destinatario fra gli UID ammessi, forma legacy).

**Limiti dichiarati.** Emulator e Rules sono esercitati; **l'interfaccia no** (nessuna prova browser: che cosa il destinatario *veda* nella sua schermata non è misurato). Il purge è invocato con l'Admin SDK, che ignora le Rules come in produzione. Le funzioni backend della condivisione Scadenze (`syncReceivedDeadlines`/`removeReceivedDeadlines`) **non** sono eseguite: la loro separazione è misurata come invarianza e asserita sul sorgente. Restano fuori perimetro la pulizia degli orfani (D4) e la scelta su che cosa fare di inviti e copie dopo il purge.

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

- **Limite e scadenza (riconciliato in M7-AUDIT-7).** Il censimento qui sotto descrive lo stato **prima** delle fette M7-AUDIT. Nel **ramo locale** esiste ora un job pianificato di retention (`functions/index.js`, `purgeExpiredAuditEvents`, giornaliero alle 03:00 Europe/Rome) che cancella gli eventi oltre **24 mesi di calendario** usando la data efficace (`at`, oppure `createdAt` solo per `shared-vault-*`/`account-widget-*` senza `at`), con lotti confermati sulla versione letta, cursori di servizio per campo e log di soli conteggi. **Nessun deploy**: in produzione non esiste ancora alcun job attivo. Restano fuori dalla finestra le ricevute di idempotenza, `trash`, `recordHistory` (non esiste in produzione), i backup, i log di piattaforma e gli Account archiviati; gli eventi non databili sono conservati e mai cancellati.
- Il requisito di contratto «la cronologia è limitata agli eventi necessari» e il gate «cronologia limitata» (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:19,29`) trovano riscontro **solo nel laboratorio**: `appendHistory(..., maximum = 100)` con troncamento `slice(-maximum)` (`experiments/history-recovery/history-model.mjs:26-27`).
- La collezione `recordHistory` **non esiste in produzione**: compare soltanto nelle Rules candidate di laboratorio (`experiments/history-recovery/firestore.candidate.rules:9-12`), non pubblicate (`firebase.json` pubblica `firestore.rules`).
- Nessuna interfaccia utente mostra la cronologia: nessun modulo di `Frontend/public/assets/js` legge `auditEvents` o `recordHistory`.

### 4.4 Chi può leggere, scrivere e cancellare l'audit

- `firestore.rules:106-118` è un'autorizzazione generica del proprietario (`allow read, write: if isOwner(userId)`) che **esclude** un elenco di collezioni: `contacts`, `pushDevices`, `notificationDeliveries`, `deadlineNotifications`, `receivedDeadlines`, `operationResults`, `profileWidgets`, `accountWidgets`, `sharedVaultData`, `sharedVaultLinks`.
- `trash`, `auditEvents`, `archiveOperations`, `backupRestoreOperations` e `syncRecords` **non sono in quell'elenco** (stato al momento del censimento): il client autenticato del proprietario poteva quindi creare, modificare e **cancellare** i propri documenti di audit tramite SDK. **Riconciliato in M7-AUDIT-7:** nel **ramo locale** `auditEvents` è escluso dal catch-all proprietario e ha un blocco dedicato in sola lettura (`firestore.rules`, M7-AUDIT-2), quindi il client **non** può più creare, modificare o cancellare eventi; `trash`, `recordHistory` e le ricevute restano fuori da quella fetta e invariati. La correzione vale **solo nel ramo** finché le Rules non saranno distribuite.
- Le ricevute protette sono invece in sola lettura per il client: `mutationResults/{userId}/operations/{operationId}` → `allow write: if false` (`firestore.rules:30-33`) e `operationResults` → `allow write: if false` (`:101-104`).
- Le Rules candidate di laboratorio renderebbero `auditEvents` e `trash` non scrivibili dal client (`experiments/history-recovery/firestore.candidate.rules:5-16`); i test emulatori `tests/history-recovery.rules.test.mjs:9,17` verificano quelle Rules candidate, **non** quelle produttive.

### 4.5 Effetto del purge sulla cronologia

Il purge di un Account **non** elimina né anonimizza alcun evento: `auditEvents` non è toccato da `recursiveDelete` (che agisce sul solo documento Account, `functions/index.js:507`) e nessuna riga del percorso cancella o redige eventi. L'evento `account-purged` resta quindi in `auditEvents` con `actorUid`, `accountId` e `context`.

**Verifica esercitata (M7-T13, 21/09/2026).** Sugli emulatori reali: dopo il purge l'evento `users/{uid}/auditEvents/{operationId}` esiste con `action: 'account-purged'`, `actorUid`, `accountId`, `context` e `at` Timestamp del server, e l'evento precedente del registro resta al suo posto; una ricevuta legacy sola impedisce il purge e **non** scrive alcun evento.

**Confronto con la decisione dei 24 mesi (solo registro).** L'evidenza del purge **è** un evento di audit e quindi **scade come gli altri**: nella stessa prova il job `purgeExpiredAuditEvents` cancella un evento `account-purged` datato oltre i 24 mesi e conserva quelli recenti, mentre non tocca `trash`, ricevute, collezioni sorelle e aziende. Conseguenza dichiarata: dopo 24 mesi il registro non conserva più la traccia del purge, mentre la ricevuta di idempotenza in `mutationResults` (che resta senza scadenza) continua a dire che quell'`operationId` è stato eseguito. Le due metà non hanno la stessa durata: è coerente con la decisione, che riguarda **solo** il registro, ed è una delle voci ancora aperte su cestino e ricevute (§8, D1/D5).

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
- **Allegati legacy senza campo `encryption`**: vengono aperti con `openExternalUrl(attachment.url)` **senza** passare dalla Vault Key (`.../privato/dettaglio-privato-attachments.js:230-232`; stessi rami in `.../azienda/dettaglio-azienda-attachments.js:211-213`, `.../azienda/dati-azienda-attachments.js:37-40`, `.../scadenze/dettaglio_scadenza.js:489-492`). Storicamente questi metadati possono non avere `storagePath`, e in tal caso il purge li ignora (`.filter(Boolean)`, `functions/index.js:501`). **Verificato esercitando (M7-T29, §5.5.1).**
- **Avatar non cifrato**: l'upload non applica `customMetadata` né cifratura (`.../privato/profilo-ui.js:46-50`); l'URL è persistito anche in `localStorage`.
- **Ripristino e marcatore**: i byte vengono ricaricati con `customMetadata.encrypted = 'v1'` (`.../settings/backup-import-service.js:448-450`) anche quando il metadato ripristinato non ha `encryption`: possibile etichetta non corrispondente all'involucro effettivo.

#### 5.5.1 Apertura di un allegato legacy: comportamento verificato (M7-T29)

`tests/legacy-attachment-opening.test.mjs` esegue i quattro percorsi reali di apertura (dettaglio privato, dettaglio aziendale, allegati incorporati nell'anagrafica aziendale, dettaglio Scadenza) e la policy reale degli URL (`attachment-security.js`). Il percorso cifrato è esercitato nello stesso banco **con la cifratura reale** del modulo, come controprova.

| Domanda | Risposta verificata (ramo legacy) |
|---|---|
| Quale URL viene aperto? | quello del metadato, normalizzato: schema mancante → `https://`; apertura in `_blank` con `noopener,noreferrer` e `opener` azzerato sulla finestra restituita |
| La Vault Key viene richiesta? | **no**: `ensureVaultKeyMaterial` non viene mai invocata, nessun byte viene letto da Storage, nessuna decifratura |
| Quali controlli restano applicati? | solo la policy di protocollo/schema di `normalizeExternalUrl` (`http`/`https`): `javascript:`, `data:`, `file:`, `blob:`, `ftp:`, URL malformati e URL vuoti vengono rifiutati e mostrati all'utente. **Nessuna allowlist di host**: un URL legacy può puntare a un sito qualsiasi |
| Differenza dal ramo cifrato | il ramo cifrato chiede la Vault Key, legge i byte con il tetto di 25 MB, decifra e apre un URL `blob:`; senza `storagePath` si ferma **prima** della chiave, e con un involucro non valido fallisce senza aprire |
| Popup bloccato | `openExternalUrl` restituisce **`true`** anche quando `window.open` restituisce `null`: il blocco **non** è distinguibile dal successo e non produce errore né avviso. Un'eccezione di `window.open` è invece registrata e mostrata |
| Sessione invalidata | privato, aziendale e Scadenza non aprono nulla; gli allegati **incorporati** nell'anagrafica aziendale **non** hanno alcun controllo di sessione e aprono comunque (comportamento attuale, dichiarato) |

**Decisione necessaria (non presa qui):** il ramo legacy consegna al browser un URL esterno arbitrario fuori dal Vault; definire se questo va mantenuto, limitato (allowlist di host/origini) o accompagnato da un avviso esplicito all'utente è una scelta di prodotto. Non ho introdotto migrazioni, cancellazioni, nuove regole di accesso né alcuna modifica al comportamento.

### 5.6 Orfani possibili (dedotti dal codice)

| Caso | Come si produce | Copertura |
|---|---|---|
| metadato senza byte | `deleteObject` riuscito e `deleteDoc` fallito; oppure cancellazione manuale dell'oggetto dal client (consentita da `storage.rules:34`) | nessuna riparazione automatica |
| byte senza metadato | `uploadBytes` riuscito e `addDoc` fallito, pagina abbandonata, form annullato dopo l'upload (`.../azienda/ma_save.js:147-161` carica prima della transazione) | nessun job li cerca: il purge legge solo i `storagePath` elencati (`functions/index.js:501`) |
| byte di Scadenze e `aziende_allegati` | rimozione dall'array o cancellazione del documento (sezione 5.3) | nessuna gestione in alcun flusso backend |
| byte dell'avatar | ogni cambio avatar | nessuna cancellazione; il purge non tocca `users/{uid}/avatar_*` — **provato** in M7-T28 (§5.8) |
| metadati di sottocollezioni | hard-delete di Azienda o di Account aziendale | restano irraggiungibili dalla UI |
| oggetti non elencati nei metadati | upload non registrato o percorso scritto direttamente dal client | il purge non scansiona il prefisso |
| versioni precedenti dell'oggetto | dipende da object versioning del bucket: **non verificato** | — |
| record `reserved` del candidato | interruzione fra prenotazione e scrittura dell'oggetto | chiusi solo con `recover()` invocato manualmente (`experiments/persistent-vault-shell/profile-document-attachments-handler.mjs:379-461`) |

Verifica dell'esistenza effettiva di orfani nel progetto reale: **non verificata** (richiederebbe di listare il bucket; nessun dato reale è stato letto).

### 5.8 Avatar del profilo: un percorso fuori dal protocollo degli allegati (verificato M7-T28)

L'avatar è un oggetto Storage che **non** passa dal protocollo degli allegati: non ha metadati in una sottocollezione, non è cifrato e non è elencato in alcun documento tranne il riferimento `photoURL` del profilo.

| Aspetto | Comportamento attuale (verificato) |
|---|---|
| Scrittore | unico: `setupAvatarEdit` in `Frontend/public/assets/js/modules/privato/profilo-ui.js:32-61` (`profilo_privato.js:159` lo monta) |
| Validazione | `validateAttachmentFile(file, {imageOnly: true, maxBytes: MAX_AVATAR_BYTES})` (solo immagini, 5 MB) |
| Percorso dell'oggetto | `users/{uid}/avatar_<timestamp>_<uuid>.<ext>` — **nome nuovo a ogni caricamento** (`createStorageObjectName`) |
| Riferimento | `updateDoc(users/{uid}, {photoURL: url})` — **sovrascritto**, non conservato |
| Cancellazione del precedente | **nessuna**: il modulo non importa né invoca primitive di cancellazione (nessun `deleteObject`), e nessun altro percorso del repository elimina `users/{uid}/avatar_*` |
| Esito del cambio | il precedente oggetto **resta in Storage e non è più referenziato**: è un orfano, e se ne accumula uno a ogni cambio |
| Errore su upload | nessun byte scritto, `photoURL` invariato, errore mostrato |
| Errore su URL o su `updateDoc` | l'oggetto **nuovo** resta in Storage senza riferimento: un orfano in più, creato dall'errore parziale; `photoURL` resta quello vecchio |
| Cambio di sessione durante il caricamento | l'uid viene letto **una sola volta** all'inizio (`_getState()`), quindi byte e riferimento finiscono sotto il proprietario iniziale; nessun controllo di sessione e nessuna scrittura sul proprietario nuovo |
| Recupero | nessun job: la retention dei 24 mesi scansiona il solo `collectionGroup('auditEvents')` (§4), e il purge elimina solo gli oggetti elencati nei metadati `attachments` dell'Account, che per costruzione stanno sotto `.../accounts/{id}/attachments/` |
| Backup | l'avatar **non** è incluso nei backup: `collectStoragePaths` raccoglie solo i campi `storagePath` (`.../settings/backup-export-model.js:67-84`), mentre `photoURL` è esportato come campo del profilo |

**Decisione necessaria (non presa qui):** definire se e quando l'oggetto precedente va eliminato (alla sostituzione, con un job di pulizia per prefisso, o mai), con quale rapporto verso D4 sugli orfani e con quale gestione del caso «URL nel backup che punta a un oggetto rimosso». Il comportamento attuale è una **scelta non dichiarata**, non un difetto con una decisione già vigente: per questo T-28 è «dichiarato, non corretto» e non ho modificato la produzione.

### 5.7 Copertura di test e suoi limiti

Test pertinenti: `tests/storage.rules.test.mjs:29,40,51,69,80` (permessi, isolamento UID, MIME/dimensioni, marcatore `encrypted`), `tests/attachment-security.test.mjs:21,28,34,41` (MIME, nomi casuali, URL, cifratura), `tests/account-attachment-delete.test.mjs` e `tests/account-attachment-delete.emulator.test.mjs` (cancellazione completa dell'allegato: oggetto **e** metadato, con modello in memoria ed emulatori reali), `tests/private-account-detail-lifecycle.test.mjs:166,172,179,202` e `tests/company-account-detail-lifecycle.test.mjs:69,75,106` (nessuna cancellazione di byte di un Account dopo il cambio di contesto), `tests/deadline-detail-lifecycle.test.mjs:92,173`, `functions/test/archive-purge-service.test.js:19` e `functions/test/backup-restore-service.test.js:11` (percorsi), `tests/backup-restore-session.test.mjs:110,287,333,355,369,498,532` (allegati nel ripristino).

**Copertura del ramo distruttivo (aggiornata da M7-R2 il 21/09/2026):** i test del purge sono stati estesi con un fake Storage che elenca davvero i metadati `attachments` e registra ogni `bucket.file(path).delete` (`functions/test/archive-receipt-handler.test.js`). Ora sono dimostrati: la cancellazione dei byte elencati **nell'ordine previsto e prima** di `recursiveDelete`, con `ignoreNotFound`, e l'ignoranza degli allegati senza `storagePath` (T-25, riga 160); l'arresto **prima di qualunque** cancellazione — compresi i percorsi validi — quando un percorso esce dal prefisso dell'Account (T-05, riga 174); l'errore parziale Storage che lascia la ricevuta in `processing` senza falso `purged`, con ripresa idempotente dello stesso comando (T-06, riga 187). Restano non coperti: la rimozione di una riga dagli array, gli hard-delete di Azienda/Account aziendale, la sostituzione dell'avatar, l'apertura di un legacy senza `encryption` e la pulizia della cache del dispositivo.

**Copertura della cancellazione client (aggiornata da M7-T15 il 21/09/2026):** il percorso positivo della cancellazione di un allegato da un Account — quello dell'utente, distinto dal purge del backend — è ora provato su entrambi i moduli reali (`dettaglio-privato-attachments.js:249-281`, `dettaglio-azienda-attachments.js:230-254`): `tests/account-attachment-delete.test.mjs` esegue i moduli con un modello in memoria di bucket e metadati e verifica ordine (prima l'oggetto, poi il metadato), accoppiamento fra oggetto eliminato e metadato eliminato, assenza di residui incrociati e ricarica della lista; `tests/account-attachment-delete.emulator.test.mjs` ripete il percorso sugli **emulatori reali** Firestore e Storage con le Rules di produzione, dimostrando che l'oggetto non è più elencato né leggibile e che il documento dei metadati non esiste più, mentre l'altro allegato resta intatto (T-15, riga 337).

### 5.9 Rimozione di una riga e cancellazione di una Scadenza: che cosa resta (verificato M7-T26)

Tre percorsi distinti, con esiti diversi sullo **stesso** oggetto Storage. Il riferimento vive in punti diversi, e solo uno dei tre elimina i byte.

| Percorso | Riferimento | Metadati | Byte Storage |
|---|---|---|---|
| Allegato di un Account (sottocollezione `attachments`) | rimosso (`deleteDoc`) | rimossi | **rimossi** (`deleteObject`) — è il percorso di T-15 |
| Riga dell'array `allegati` dell'Azienda (form modifica, `ma_attachments.js:65-69`) | rimossa al salvataggio (`ma_save.js:161` compone l'array senza la riga) | l'array vive nel documento Azienda | **restano**: nessun `deleteObject` in `ma_save.js`, l'unico `deleteDoc` cancella l'intera Azienda (`ma_save.js:204`) |
| Riga dell'array `attachments` di una Scadenza (`deadline-attachment-controller.js:35-45`) | rimossa al salvataggio (`deadline-save-service.js:151`) | l'array vive nel documento Scadenza | **restano**: il controller non tocca Storage |
| Cancellazione della Scadenza (`dettaglio_scadenza.js:27-55`) | documento eliminato | metadati della Scadenza eliminati (e `expiryReference` azzerato nel profilo, se collegata) | **restano**: solo `deleteDoc`/transazione, nessuna chiamata a Storage |

**Errori parziali.** In `saveDeadline` l'upload precede la scrittura del documento (`deadline-save-service.js:138` prima di `:162`) e **non esiste compensazione**: se la scrittura fallisce, l'oggetto caricato resta nello Storage senza alcun riferimento — un orfano creato dall'errore. Nella cancellazione della Scadenza, se il documento non esiste o la transazione fallisce, non viene toccato nulla (e i byte restano comunque); se il `deleteDoc` riesce, l'oggetto è già orfano nello stesso istante.

**Privato e aziendale.** Le Scadenze sono per proprietario (`users/{uid}/scadenze/{id}`), quindi il residuo è nell'archivio del proprietario; l'array `allegati` dell'Azienda vive nel documento dell'azienda, con oggetti sotto `users/{uid}/aziende_allegati/` — fuori dal prefisso di qualsiasi Account e quindi anche dal purge (che legge solo `.../accounts/{id}/attachments/`, §3.4).

**Prove.** Emulator (Firestore + Storage reali, Rules di produzione): `tests/attachment-removal-residues.emulator.test.mjs` esegue la `deleteScadenza` **reale** (documento eliminato, oggetto ancora elencato e leggibile byte per byte) e la `saveDeadline` **reale** (array aggiornato a vuoto, oggetto ancora presente), più un errore parziale reale (upload riuscito, scrittura fallita → oggetto orfano). Modello e sorgente: `tests/attachment-removal-residues.test.mjs` (rimozione dallo stato del form, composizione reale degli array, transazione della Scadenza collegata, assenza di compensazione).

**Controllo per mutazione.** Cancellazione della Scadenza che tocca Storage → rosso (modello ed emulatore); salvataggio che lascia una riga residua nell'array → rosso (emulatore).

**Limiti dichiarati.** I percorsi di **form** (rimozione della riga) sono provati a livello di stato e di composizione: il salvataggio completo dell'Azienda non è rieseguito su Emulator (transazione sui contatti e caricamento cifrato fuori perimetro), mentre per la Scadenza il salvataggio è quello reale. Non sono esercitati gli hard-delete di Azienda/Account (T-27) né la pulizia degli orfani (D4). Nessuna cancellazione è stata aggiunta al runtime.

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

### 6.5 Copie sul dispositivo: che cosa resta dopo logout e dopo purge (verificato M7-T23)

Censimento delle copie client e prova con dati sintetici (`tests/device-cache-residues.test.mjs`, 7 casi). Distinzione usata in tutta la tabella: **cancellato** (l'archivio viene svuotato), **invalidato** (la sessione si chiude ma i byte restano), **presente** (il dato è ancora nell'archivio locale).

| Archivio | Che cosa contiene | Dopo **logout** | Dopo **purge** di un Account |
|---|---|---|---|
| `sessionStorage` — sessione Vault (`vault_session_v1`, `codex_vault_session_wrapping_key_v1`, `vault_s_key`, `vault_s_expiry`) | chiave Vault cifrata per la scheda | **cancellato** (`clearVaultSession`, `logout-session.js:7`) | non pertinente |
| `sessionStorage` — altri dati (`profile-account-link-draft`, `profile-deadline-link-draft`, `pending_deadline_link`, `vault_verified`) | bozze e stato di navigazione dell'utente | **presente** nella stessa scheda: il logout non svuota `sessionStorage`; sparisce alla chiusura della scheda | **presente** |
| `localStorage` — envelope e verifier del Vault (`codex_vault_envelope_{uid}`, `codex_vault_verifier_{uid}`) | **cifratto**: chiave Vault avvolta + verifier; richiede la Master Password | **presente** (per progetto: serve all'auto-sblocco) | **presente** |
| `localStorage` — `codex_vault_secret*` (deprecato), `codex_profile_avatar_{uid}`, `codex_theme`, `codex_push_active_scopes`, `codex_offline_ready_{uid}` | segreti deprecati in fase di pulizia, URL avatar, tema, ambiti push, marcatore TTL | **presente** (`purgeDeprecatedVaultSecrets` rimuove solo i segreti deprecati al cambio di stato auth, `security-manager.js:42-45`) | **presente**; l'URL dell'avatar può puntare a un oggetto non più esistente |
| **IndexedDB** — cache Firestore persistente (`persistentLocalCache`, multi-tab) | documenti sincronizzati come scritti dall'app: campi cifrati del Vault **e** metadati leggibili (nomi, marcatori, percorsi) | **presente**: nessun percorso del runtime chiama `clearIndexedDbPersistence` | **presente** finché l'SDK non sincronizza la cancellazione del server; nessuna evacuazione locale esplicita |
| **IndexedDB** — coda offline (`codex-offline-queue-{uid}`, store `encryptedOperations`) | operazioni pendenti **sigillate** AES-GCM con chiave derivata dalla Vault Key | **presente** e non toccata dal logout; riapribile solo con la Vault Key (provato: chiave diversa → apertura rifiutata) | **presente** |
| **Cache Storage** — shell PWA (`codex-shell-<versione>`) | solo risorse **stessa origine** dichiarate nella shell (HTML/JS/CSS/manifest) | **presente**: il logout non la tocca; `activate` cancella solo le proprie versioni precedenti | **presente**; nessuna risposta di Firestore/Storage/Functions vi entra (richieste cross-origin scartate) |
| Cache delle **risposte backend** | — | **non esiste** in Cache Storage: cross-origin scartato, `/protected-media/presentation` escluso, ammessi solo i percorsi della shell | — |
| Chiavi delle voci di cache | URL completi, **query inclusa** (`cache.put(request)`) | un URL di pagina con `?id=<Account>` resta **nominato** nella cache stessa-origine, senza il contenuto dell'Account | — |
| Blob/allegati aperti, file scaricati (`.cpbackup`, report) | copie fuori dal controllo dell'app | **presenti** (file system dell'utente) | **presenti** |

**Prove.** `tests/device-cache-residues.test.mjs`: il logout reale azzera la sola sessione Vault e non invoca **alcuna** primitiva distruttiva (nessun `clear`, nessun `delete`); il censimento statico su 161 sorgenti del runtime (esclusi i bundle `vendor/`) non trova `clearIndexedDbPersistence`, `indexedDB.deleteDatabase`, `localStorage.clear(` o `sessionStorage.clear(`, e trova `caches.delete` **solo** in `sw.js` per le proprie cache di shell non correnti; il service worker reale non intercetta risposte cross-origin nemmeno con percorso identico a una risorsa di shell; la coda offline, dopo il logout, conserva il contenitore **senza plaintext** e si riapre solo con la Vault Key; il percorso di purge del client invoca la callable e **non** evacua la cache locale.

**Controllo per mutazione.** Logout che svuota `localStorage`/IndexedDB/Cache → 3 casi rossi; service worker senza controllo di origine → caso della cache cross-origin rosso; coda offline che conserva il plaintext → caso della coda rosso.

**Limiti dichiarati.** La prova è di **livello codice con archivi simulati**: nessun browser è stato usato, quindi non sono esercitati l'IndexedDB reale, la Cache API reale, la persistenza Firestore su disco né il comportamento dell'SDK offline a sessione chiusa (per esempio la possibilità di leggere dalla cache locale senza autenticazione). Che cosa resta **fisicamente** sul dispositivo è dedotto dalla configurazione (`persistentLocalCache`) e dall'assenza di cancellazioni nel runtime, non misurato su un browser. La presenza di residui nei dati reali non è verificata. La policy di cancellazione della cache **non è stata decisa né introdotta**.

### 6.6 Copie di consultazione: che cosa è solo in memoria e che cosa esce dall'app (verificato M7-T24)

Censimento delle superfici che producono copie di consultazione e prova con dati sintetici (`tests/consultation-copies.test.mjs`, 6 casi). Nessun file o dato personale reale è stato letto o creato.

| Superficie | Dove vive la copia | Dopo il purge di un Account |
|---|---|---|
| Report **salute credenziali** (`impostazioni.js:66-152`) | **solo in memoria**: modale DOM, nessun file; alla chiusura i risultati vengono **azzerati** (`:85-87`); il testo dichiara «Analisi eseguita soltanto in memoria» e mostra solo identità, forza e flag, **mai** una password | rigenerabile dai dati correnti; non esiste una copia da cancellare |
| Report **uso dei campi** (`account-field-usage-service.js:135-180` + `account-field-usage-model.js:94-107`) | **solo in memoria**: nessun `Blob`, nessun download, nessun archivio locale nei due moduli; gli Account archiviati sono **esclusi** e contati (`archivedExcluded`) | **online** il report rigenerato legge le sorgenti confermate e non contiene l'Account purgato; **offline**, o se la lettura confermata non risponde, il ripiego è la **cache locale** e il report può ancora includere l'Account purgato (provato) |
| Diagnostica **prestazioni** (`performance-metrics.js`, campioni in `localStorage`, `clearPerformanceSamples`) | archivio locale del dispositivo (non un file) | resta finché non viene cancellata esplicitamente: **censimento di codice, non esercitato** in M7-T24 |
| File di **backup** `.cpbackup` (`backup-export-service.js:117-139`) | **file dell'utente** (File System Access o download) | un file **già esportato** resta fuori dal controllo dell'app; un **nuovo** export richiede la rete (`BACKUP_REQUIRES_ONLINE`) e legge sorgenti confermate, quindi non contiene l'Account purgato; **nessun filtro** `isArchived`: gli archiviati sono inclusi (provato) |
| **vCard** `.vcf` (`profilo_privato.js:336-344`, `company-profile-ui.js:123`, `contact-card-receiver.js:32-33`) | **file dell'utente**: `Blob` + link con `download`; viene revocato solo l'Object URL, non il file | il file scaricato resta; l'app non ha alcun handle per ritirarlo (provato) |
| Allegati aperti e copie di consultazione dell'utente (screenshot, stampa del browser, PDF esterni) | fuori dall'app | restano: **non gestibili** dall'applicazione |
| **Excel** e **PDF/stampa** | **non esistono** nell'app distribuita: nessun `xlsx`/`SheetJS`/`jspdf`/`window.print` nei sorgenti; l'unica proiezione Excel è di laboratorio (`experiments/persistent-vault-shell/excel-export-projection.mjs`, non montata) e maschera i valori sensibili (provato) | non pertinente |

**Prove.** Il banco esegue il modello e il servizio **reali** del report uso dei campi (esclusione degli archiviati, rigenerazione pulita online, fallback sulla cache che include l'Account purgato), la funzione **reale** `showCredentialHealthResults` (nessun segreto sintetico nel DOM, risultati azzerati alla chiusura), la funzione **reale** `downloadVCard` (un solo oggetto creato, revoca del solo Object URL) e i fatti di sorgente dell'export di backup.

**Controllo per mutazione.** Archiviati inclusi nel report → rosso; risultati non azzerati alla chiusura → rosso; vCard con handle di file → rosso; segreto stampato nel report → rosso.

**Limiti dichiarati.** La prova è di **livello codice con DOM, Blob e repository simulati**: non viene creato alcun file reale e non è esercitato il browser (nessun `showSaveFilePicker`, nessun salvataggio su disco). Che un file **già esportato** resti leggibile è una proprietà del file system dell'utente, **non misurabile** dall'app. La diagnostica prestazioni è censita ma **non esercitata**. Non sono state aperte le decisioni su cancellazione, avviso all'utente o limitazione delle copie: la scelta di prodotto è raccolta in un **commit separato** (`docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md`).

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
| Audit leggibile/scrivibile/cancellabile dal proprietario | **lettura sì, scrittura no nel ramo** (M7-AUDIT-2); le Rules distribuite restano permissive | `firestore.rules` (blocco dedicato in sola lettura ed esclusione dal catch-all); censimento originale a `firestore.rules:106-118` |
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
| T-08 | Copie residue | dopo il purge restano `accountWidgets`/`sharedVaultLinks`/inviti | documentare l'esito atteso secondo la politica scelta | **dichiarato e verificato per il comportamento attuale** (M7-T08, §3.6): `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` **restano invariati** e leggibili **solo dal proprietario**; l'**invito resta invariato** e il **destinatario lo legge ancora** (nome e id dell'Account purgato), con lo stato `suspended` scritto dall'**archiviazione**, non dal purge; la **Scadenza condivisa** segue un altro percorso e la copia del destinatario resta leggibile; nessun job pulisce queste collezioni. Prove: `tests/shared-copies-purge.emulator.test.mjs` (2 casi) e `tests/shared-copies-purge.test.mjs` (5 casi); mutazioni rosse. Nessuna modifica a produzione, Rules o decisioni: le domande residue sono in un commit separato |
| T-09 | Copie residue | allegato su Storage non elencato nei metadati | resta dopo il purge: verificare la scelta D4 | **da realizzare** |
| T-10 | Cronologia | un evento di audit non contiene segreti | il segreto fittizio non compare nel documento | esistente (`functions/test/history-recovery-service.test.js:15`; `functions/test/backup-restore-service.test.js:68`) |
| T-11 | Cronologia | limite/scadenza della cronologia nel runtime | cancellazione automatica degli eventi oltre la finestra decisa | **realizzato nel ramo, non distribuito** (M7-AUDIT-6): job pianificato con finestra di 24 mesi di calendario, date `at`/`createdAt`, cursori di servizio, `functions/test/audit-retention-service.test.js` (13 casi), `functions/test/audit-retention-job.test.js` (6) e `tests/audit-retention.emulator.test.mjs` (14); in produzione il job non esiste ancora |
| T-12 | Cronologia | il client tenta di creare, modificare o cancellare un evento di audit | rifiuto secondo la politica decisa | **realizzato nel ramo, non distribuito** (M7-AUDIT-2): esclusione dal catch-all e blocco dedicato in sola lettura, provati in `tests/audit-events.rules.test.mjs`; le Rules distribuite restano quelle precedenti |
| T-13 | Cronologia | effetto del purge su `trash`/`auditEvents`/ricevute legacy | definito e verificato | **verificato** (M7-T13): sugli emulatori reali (Firestore + Storage, Admin SDK del runtime) il purge elimina il solo documento Account con il suo sottoalbero e i byte **elencati** nei metadati, mentre restano cestino legacy, collezioni sorelle, ricevuta legacy, ricevuta di idempotenza (che passa a `purged`) e registro, con l'evento `account-purged` scritto; una ricevuta legacy sola ferma il purge senza toccare nulla; il job dei 24 mesi tocca il **solo** registro, quindi rimuove anche l'evidenza del purge oltre la finestra e lascia intatti cestino e ricevute. Prove: `tests/purge-retention-effects.emulator.test.mjs` (3 casi) e `functions/test/archive-receipt-handler.test.js` (caso M7-T13). Nessuna correzione al comportamento; resta aperta la decisione complessiva su cestino e ricevute |
| T-14 | Allegati | upload senza marcatore `encrypted` per `application/octet-stream` | rifiuto delle Rules | esistente (`tests/storage.rules.test.mjs:69`; `storage.rules:9-21`) |
| T-15 | Allegati | cancellazione di un allegato da parte dell'utente: percorso completo con esito positivo | oggetto rimosso **e** metadato rimosso, senza residui | **verificato** (M7-T15): `tests/account-attachment-delete.test.mjs` esegue i due moduli reali (privato `dettaglio-privato-attachments.js:249-281`, aziendale `dettaglio-azienda-attachments.js:230-254`) su un modello in memoria di bucket e metadati e prova ordine, accoppiamento, assenza di residui e ricarica della lista; `tests/account-attachment-delete.emulator.test.mjs` ripete il percorso sugli emulatori reali Firestore e Storage con le Rules di produzione e verifica che l'oggetto non sia più elencato né leggibile e che il metadato non esista più, con l'altro allegato intatto. Nessun difetto dimostrato: il percorso non richiede correzioni |
| T-16 | Allegati | oggetto orfano per prefisso dopo il purge | assente o motivato secondo D4 | **da realizzare** |
| T-25 | Allegati | purge con `storagePath` reali: il ramo di cancellazione byte è esercitato | cancellazione effettiva, nell'ordine previsto e prima di `recursiveDelete`, con `ignoreNotFound` | esistente (`functions/test/archive-receipt-handler.test.js:160`) |
| T-26 | Allegati | rimozione di una riga dagli array `allegati`/`attachments` e cancellazione di una Scadenza | byte non più referenziati: esito definito secondo D4 | **dichiarato e verificato per il comportamento attuale** (M7-T26, §5.9): in **tutti e tre** i percorsi il riferimento sparisce ma i **byte restano** in Storage (l'unico percorso che li elimina è l'allegato di un Account in sottocollezione, T-15); un errore di scrittura dopo l'upload lascia un orfano (nessuna compensazione). Prove: `tests/attachment-removal-residues.emulator.test.mjs` (3 casi su emulatori reali, incluse `deleteScadenza` e `saveDeadline` reali) e `tests/attachment-removal-residues.test.mjs` (5 casi a modello/sorgente). Nessuna cancellazione aggiunta: la scelta è D4, con domande specifiche in un commit separato (`docs/M7_DOMANDE_T26_RESIDUI_RIMOZIONE.md`) |
| T-27 | Allegati | hard-delete di Azienda o di Account aziendale | metadati e byte residui: esito definito secondo D4 | **dichiarato e verificato per il comportamento attuale** (M7-T27, §3.5): sono **due percorsi diversi** — la cancellazione dell'Azienda dal client è un solo `deleteDoc` **non ricorsivo** (Account, metadati, byte Storage e riferimenti restano), mentre l'eliminazione di un Account aziendale passa dal **purge backend** (ricorsivo: documento e sottocollezione eliminati, byte elencati rimossi, oggetto non elencato e Account omonimo di un'altra Azienda intatti, solo la coppia esatta di riferimenti ripulita). Prove: `tests/company-hard-delete-residues.emulator.test.mjs` (2 casi, `deleteCompany` e purge reali) e `tests/company-hard-delete-residues.test.mjs` (5 casi). Nessuna modifica al runtime: la scelta sui residui è D4, con domande specifiche in `docs/M7_DOMANDE_T27_HARD_DELETE.md` (commit separato) |
| T-28 | Allegati | cambio avatar | il precedente oggetto non resta orfano, o è dichiarato | **dichiarato, non corretto** (M7-T28): il percorso attuale **lascia il precedente oggetto in Storage** — nessuna cancellazione viene nemmeno tentata — e il residuo si accumula a ogni cambio, perché ogni upload usa un nome nuovo (`avatar_<timestamp>_<uuid>`) e `photoURL` viene sovrascritto. Provato con i moduli reali su modello (§5.8) e su emulatori reali Firestore + Storage con le Rules di produzione (`tests/avatar-change-residues.test.mjs`, 6 casi; `tests/avatar-change-residues.emulator.test.mjs`, 2 casi). La proprietà richiesta «non resta orfano» **non** è dimostrata: serve una decisione di pulizia (D4), non introdotta qui |
| T-29 | Allegati | apertura di un allegato legacy senza `encryption` | comportamento di sicurezza dichiarato (oggi `openExternalUrl` senza Vault Key) | **dichiarato e verificato per il comportamento attuale** (M7-T29, §5.5.1): i quattro percorsi reali aprono l'URL del metadato normalizzato, **senza** Vault Key, senza lettura di byte e senza decifratura; restano la policy di protocollo (`http`/`https`) e `noopener`/`noreferrer`, **nessuna** allowlist di host; un popup bloccato è riportato come successo e gli allegati incorporati non hanno controllo di sessione. Prove: `tests/legacy-attachment-opening.test.mjs` (7 casi, ramo cifrato reale come controprova). Nessuna modifica al comportamento: la scelta di limitare o avvisare è una decisione di prodotto |
| T-17 | Backup | header in chiaro con `ownerUid`/`backupId`/`createdAt` | documentato come accettato o rimosso | **da realizzare** (decisione D5/D6) |
| T-18 | Backup | errore al secondo blocco o durante il caricamento degli allegati | stato parziale dichiarato, nessun successo | esistente (`tests/backup-restore-session.test.mjs:100,110`) |
| T-19 | Backup | ricevuta con dati cambiati o comando diverso | rifiuto, nessuna riapplicazione | esistente (`functions/test/backup-restore-receipt.test.js:22`) |
| T-20 | Backup | registro legacy presente | apply bloccato con `LEGACY_BACKUP_RESULT_UNVERIFIED`, nessuna scrittura | esistente (`functions/test/backup-receipt-handler.test.js:48`) |
| T-21 | Backup | importo un backup che contiene un Account poi purgato | comportamento definito secondo D5 | **da realizzare** |
| T-22 | Trasversale | TTL/lifecycle effettivamente assenti sul progetto | verifica esterna documentata | **da realizzare** (verifica di configurazione, non test di codice) |
| T-23 | Trasversale | cache del dispositivo dopo purge/logout | esito definito secondo la politica | **dichiarato e verificato per il comportamento attuale** (M7-T23, §6.5): il logout azzera la **sola** sessione Vault in `sessionStorage` e non tocca `localStorage`, IndexedDB (cache Firestore persistente e coda offline) e Cache Storage; il purge è backend e non evacua la cache locale. Nessuna primitiva distruttiva esiste nel runtime; la coda offline resta ma sigillata (Vault Key necessaria); la Cache Storage contiene solo la shell stessa-origine, mai risposte backend. Prove: `tests/device-cache-residues.test.mjs` (7 casi). La **politica** di cancellazione è aperta e le domande per Diego sono raccolte in un commit separato (`docs/M7_DOMANDE_T23_CACHE_DISPOSITIVO.md`) |
| T-24 | Trasversale | copia di consultazione (report/Excel) e dati purgati | nessun residuo non dichiarato | **dichiarato e verificato per il comportamento attuale** (M7-T24, §6.6): i due report dell'app (salute credenziali, uso dei campi) sono **solo in memoria** e senza segreti, il primo azzerato alla chiusura; backup `.cpbackup` e vCard `.vcf` sono **file dell'utente** che l'app non può ritirare; un export **nuovo** usa sorgenti confermate e non contiene l'Account purgato, mentre un report rigenerato **dalla cache** può ancora contenerlo; **Excel/PDF/stampa non esistono** nell'app distribuita (solo proiezione di laboratorio). Prove: `tests/consultation-copies.test.mjs` (6 casi). La politica su copie già esportate e avviso all'utente è una decisione di prodotto, raccolta in un commit separato (`docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md`) |
| T-30 | Cestino Account | lettura della lista dell'Archivio (filtro sugli archiviati) | compaiono solo i record archiviati, con l'identità di contesto corretta | **verificato** (M7-T30): il filtro del profilo privato è nella **query** (`vault-repository.js:29-31`, `where('isArchived','==',true)`) e quello aziendale è **client-side** (`archive-account-service.js:83-89` e `:113-115`); l'identità di contesto (`privato`, oppure id azienda con `businessName`), l'assenza di mescolanza fra contesti e l'invalidazione su cambio utente o blocco del Vault sono provate da `tests/archive-list-filter.test.mjs` (**6 casi**), con `npm run test:history-prototype` 104/104. Il caso del cambio di sessione usa sorgenti **sensibili al proprietario** con Account distinti per A e B e verifica gli uid passati alle letture: un servizio che continuasse a leggere i dati del vecchio proprietario fallisce (controllo per mutazione). Nessun difetto dimostrato: la lista non richiede correzioni |
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
10. **D10 — Copie sul dispositivo (M7-T23)**: le sette domande su logout, purge, residui cifrati, bozze in `sessionStorage`, trasparenza all'utente, rapporto con D4/D5 e livello di prova richiesto sono in `docs/M7_DOMANDE_T23_CACHE_DISPOSITIVO.md` (commit separato dalle prove). Comportamento attuale: nulla viene cancellato sul dispositivo, né al logout né dopo il purge.
11. **D11 — Copie di consultazione (M7-T24)**: le sette domande su copie già esportate, avviso al momento del purge, rigenerazione dalla cache, conferma dei report «solo in memoria», Excel/PDF, rapporto con D4/D5 e diagnostica prestazioni sono in `docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md` (commit separato dalle prove). Comportamento attuale: i report dell'app restano in memoria, backup e vCard sono file dell'utente che l'app non ritira, Excel/PDF/stampa non esistono nella app distribuita.
12. **D12 — Residui alla rimozione di righe e Scadenze (M7-T26)**: le cinque domande su rimozione di una riga dagli array, cancellazione di una Scadenza con allegati, compensazione sugli errori parziali, rapporto con D4 e prefissi da coprire sono in `docs/M7_DOMANDE_T26_RESIDUI_RIMOZIONE.md` (commit separato dalle prove). Comportamento attuale: il riferimento sparisce, i byte restano in Storage; `users/{uid}/aziende_allegati/**` e `users/{uid}/scadenze/{id}/**` non sono raggiunti dal purge degli Account.
13. **D13 — Hard-delete di Azienda e Account aziendale (M7-T27)**: le sei domande su cascata degli Account, ordine/atomicità, riferimenti pendenti, prefissi non coperti, rapporto con D4 e testo della conferma sono in `docs/M7_DOMANDE_T27_HARD_DELETE.md` (commit separato dalle prove). Comportamento attuale: cancellare l'Azienda è un solo `deleteDoc` non ricorsivo (Account, byte e riferimenti restano); l'Account aziendale si elimina solo con il purge backend, ricorsivo e limitato ai byte elencati.

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
