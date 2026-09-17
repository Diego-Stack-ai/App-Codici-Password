# DS-002A — Contratto candidato per le immagini dei documenti digitali privati

> **Stato:** candidato, **non montato** e non attivo in produzione: nessun pulsante, nessun upload reale, nessuna modifica a Rules o Functions produttive.
> **Autorità:** contratto candidato di laboratorio; prevale la baseline sicurezza ([Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md) §11) e l'incarico DS-002A in [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md).
> **Riferimento di codice:** ramo `integration/vault-shell-v127-security`; base `dbb7bdb3`; modulo `experiments/persistent-vault-shell/profile-document-attachments-contract.mjs` e collegati.
> **Ultima verifica:** 17/09/2026 — 80 prove unitarie della fetta (`test:vault-shell` **644/644**), 8 prove su Firestore Emulator e 9 prove sulla suite emulatrice `auth,firestore,storage`; nessuna verifica browser: il pannello non è ancora montato in una pagina di laboratorio.
> **Area:** profilo privato, `users/{uid}.documenti[]`, allegati immagine.
> **Dipendenze:** `profile-document-attachments-contract.mjs`, `profile-document-attachment-capability.mjs`, `prepare-profile-document-attachment.mjs`, `profile-document-attachments-handler.mjs`, `profile-document-attachments-reader.mjs`.
> **Sostituisce:** nessun documento; non sostituisce la sezione allegati dell'architettura né i contratti M5–M8, che restano autorevoli.

## 1. Scopo

Preparare il confine sicuro e testabile che consentirà a un documento digitale privato persistito (`users/{uid}.documenti[]`) di possedere zero o più immagini cifrate, **prima** di qualsiasi integrazione nell'interfaccia. L'incremento definisce identità, metadati, cifratura contestuale, percorsi, limiti, cancellazione e compensazione; non carica, non apre e non mostra nulla all'utente.

## 2. Schema candidato

**Documento di metadati** — un documento distinto per immagine, in `users/{uid}/profileDocumentAttachments/{attachmentId}`:

| Campo | Contenuto | Note |
|---|---|---|
| `ownerId` | UID proprietario | verificato contro il contesto autenticato |
| `documentId` | ID persistito del documento | univoco e non derivato dall'indice |
| `storagePath` | percorso Storage | **derivato**, mai accettato dal client |
| `mimeType` | tipo originale | allowlist: JPEG, PNG, WebP, HEIC, HEIF |
| `size` | byte originali | 1 … 10 MiB |
| `digest` | SHA-256 dei byte **memorizzati** (ciphertext) | verificabile senza chiave |
| `envelope` | materiale di cifratura | vedi sotto; nessuna chiave in chiaro |
| `status` | `reserved` / `ready` / `deleting` | macchina a stati minima |
| `schemaVersion` | 1 | versione del contratto |
| `createdAt` | timestamp backend | assegnato dal servizio |

Non esistono campi per nome originale, URL di download, byte o chiave: l'allowlist del contratto rifiuta qualsiasi chiave sconosciuta. Il campo di trasporto `id` aggiunto dal repository è accettato solo se coincide con l'identità derivata dal percorso.

**Ricevuta di operazione** — un documento distinto per operazione, in `mutationResults/{uid}/operations/profile-document-attachment-{operationId}`. È l'autorità di recupero, quindi è validata canonicamente: allowlist **esatta** per tipo (nessun campo estraneo; solo l'`id` di trasporto è tollerato, e solo se coincide con il nome derivato), percorso ricalcolato da proprietario/documento/allegato, stato ammesso per tipo e timestamp presente **solo** nello stato che lo possiede.

| Campo | Caricamento | Cancellazione |
|---|---|---|
| `kind` | `profile-document-attachment` | `profile-document-attachment-delete` |
| `ownerId`, `operationId`, `documentId`, `attachmentId`, `storagePath` | identità e percorso derivato | identità e percorso derivato |
| `digest` | digest del **comando** (operazione) | digest del **comando** (operazione) |
| `objectDigest` | SHA-256 dei byte memorizzati | — |
| `expectedDigest` | — | SHA-256 atteso dell'oggetto da rimuovere |
| `objectSize` | byte **memorizzati** (o `null` se il trasporto non li riporta) | byte memorizzati osservati alla prenotazione |
| `status` | `reserved` / `ready` | `deleting` / `removed` |
| `createdAt` / `readyAt` / `removedAt` | `readyAt` solo con `ready` | `removedAt` solo con `removed` |

`objectSize` è la **dimensione cifrata registrata**, misurata nel confine fidato: è distinta dal `size` del documento di metadati, che resta la dimensione originale. Un solo valore non è negoziabile: se il trasporto riporta la dimensione dell'oggetto, deve coincidere con quella registrata; se non la riporta (campo assente o `null`), la proprietà dell'oggetto è dimostrata dal solo digest. Digest o dimensione discordanti non permettono promozione, sovrascrittura o cancellazione; una dimensione riportata ma non conforme al contratto rende l'oggetto non verificabile.

**Envelope** (`profile-document-attachment-envelope`, versione 1): `cipher: AES-GCM-256`, `keyWrap: HKDF-SHA256+A256GCM`, `contentIv` (12 byte, base64), `wrapSalt` (32 byte), `wrapIv` (12 byte), `wrappedFileKey`. Le primitive sono quelle già provate dall'applicazione; ciò che cambia rispetto agli allegati Account è il **binding**: l'AAD non è una costante.

**AAD contestuale** — stringa canonica, derivata e mai ricevuta:

```
CodiciPassword:profile-document-attachment:v1:<uid>:<documentId>:<attachmentId>:<storagePath>
```

Identificatori e percorso sono vincolati a `[A-Za-z0-9_-]` (nessun `:`, nessun `/`), quindi l'AAD non è falsificabile per composizione; proprietario, documento, allegato e percorso cambiano tutti l'AAD. La costante legacy `CodiciPassword-Attachment-v1` degli allegati Account **non** viene riusata.

**Percorso Storage candidato:** `users/{uid}/profile-documents/{documentId}/attachments/{attachmentId}`, calcolato solo da UID, documento e allegato autenticati. Un percorso che non coincide con questa derivazione è rifiutato, non riparato.

**Capacità binaria:** `profile-document-attachment-capability.mjs` riceve i byte in chiaro, chiede la cifratura al sigillo di sessione iniettato, restituisce payload cifrato, envelope e digest, e **azzera sempre il buffer in chiaro** (anche in caso di errore). La Vault Key non viene mai richiesta, ricevuta o restituita; la capacità è revocata da blocco Vault, logout, cambio UID o annullamento, ed è distinta dai metodi testuali.

## 3. Flusso

1. **Pianificazione** (`planProfileDocumentAttachmentUpload`): verifica documento univoco, allowlist MIME, limite di dimensione, limite di 10 immagini per documento, stato online; genera l'identità dell'allegato nel confine; produce un **comando immutabile** (identità, percorso, tipo, dimensione, digest, envelope, marcatore oggetto) e, separatamente, il payload cifrato **transiente**. Nel comando non entrano byte, plaintext, chiavi o nome originale; il digest di operazione è calcolato sul comando canonico.
2. **Caricamento** (`createProfileDocumentAttachmentHandler.upload`): (a) transazione di **prenotazione** — metadati `reserved` + ricevuta idempotente; (b) scrittura dell'oggetto opaco **fuori** da qualsiasi transazione, con prova di digest e dimensione registrata; (c) transazione di **finalizzazione** — metadati e ricevuta `ready`, dopo aver riletto entrambi e riprovato la coerenza con il comando.
3. **Cancellazione** (`remove`): dimensione osservata → ricevuta `deleting` → prova dell'oggetto (digest e dimensione registrata) → rimozione dell'oggetto → transazione finale che rilegge record e ricevuta, cancella i metadati solo se sono ancora canonici in stato `deleting` e chiude la ricevuta `removed`. Il comando porta il digest atteso, quindi una modifica concorrente dei metadati produce un conflitto invece di una cancellazione alla cieca.
4. **Recupero** (`recover`): valida canonicamente ogni ricevuta, completa le ricevute pendenti e **compensa gli oggetti orfani** (oggetto presente senza metadati → oggetto rimosso solo dopo prova; prenotazione senza oggetto → prenotazione e metadati rimossi solo se riprovati nella transazione finale). Idempotente: una seconda esecuzione non cambia nulla.

**Esiti dichiarati, senza falsa atomicità:** `confirmed` (terminale, ripetibile), `compensated` (terminale, nessuna traccia), `incomplete` (una ricevuta resta e `recover()` o un retry la conclude). Firestore e Storage non sono mai descritti come atomici insieme; le posizioni di ripristino sono la ricevuta e lo stato dei metadati.

**Proiezione di sola lettura** (`createProfileDocumentAttachmentsReader`): metadati del solo documento richiesto, con controllo proprietario/documento/percorso su ogni record, record non verificabili riportati in `invalid` e mai esposti, `available` vero solo se online **e** `ready`, `bytesAvailable` sempre falso. La vista è revocata dopo ogni attesa.

### 3.1 Correzioni DS-002A-R1 (17/09/2026)

La revisione Codex di DS-002A ha richiesto sei correzioni al servizio candidato, tutte applicate in questo incremento:

1. **Ordine delle letture.** Ogni transazione (`drop`, finalizzazione del caricamento, prenotazione della cancellazione, finalizzazione della cancellazione, i due rami di `recover`) esegue **tutte** le letture prima della prima scrittura, come Firestore reale richiede. Il difetto non era visibile con mock permissivi: il fake unitario ora **rifiuta read-after-write** e una suite dedicata gira su **Firestore Emulator** con transazioni reali.
2. **Profilo autorevole.** La prenotazione legge `users/{uid}` nella stessa transazione e verifica proprietario e che `documentId` identifichi **esattamente una** riga persistita di `documenti[]`; un documento assente, duplicato o non persistito è rifiutato dal servizio, non dal client.
3. **Limite atomico.** Il numero di immagini per documento è deciso **nella transazione di prenotazione**, con una lettura transazionale limitata (`attachmentsFor({uid, documentId})`) e conteggio dei soli record che si legano canonicamente a proprietario e documento; due caricamenti concorrenti non possono superare le dieci immagini (provato sull'emulatore con una corsa reale). Nessun contatore da mantenere: il conteggio è derivato dai record autorevoli, quindi non esiste deriva da compensare.
4. **Integrità del payload e dell'oggetto.** Il confine fidato copia i byte ricevuti (`documentAttachmentPayloadCopy`) e ne calcola lo SHA-256, confrontandolo con `command.digest` **prima** di qualsiasi scrittura Storage; un payload diverso viene rifiutato (`ATTACHMENT_PAYLOAD_MISMATCH`). Un oggetto già presente non viene mai sovrascritto alla cieca: `storage.probe()` ne verifica il digest e, se diverso, l'operazione resta `incomplete` con `OBJECT_CONFLICT`.
5. **Cancellazione con record completo.** `remove` valida l'intero record autorevole con il contratto canonico (proprietario, documento, ID allegato derivato, percorso, digest, schema, stato ed envelope) e richiede la corrispondenza con il comando: un record con lo stesso digest ma percorso o documento diverso è rifiutato, e un oggetto con byte diversi non viene cancellato.
6. **Recupero verificato.** `recover` non promuove più un oggetto per la sola esistenza: promuove solo se i byte memorizzati hanno il digest registrato nella ricevuta (`objectDigest`) e il record è canonico e coerente; configurazioni malformate, ricevute incomplete o oggetti non dimostrabili restano **bloccati** (`incomplete`) senza cancellare oggetti non propri. La ricevuta ora porta sia il digest di operazione sia `objectDigest` (o `expectedDigest` per la cancellazione), perché sono due valori distinti.

**Contratto di trasporto candidato** (implementato dal test emulatore, richiesto a DS-002B): `db = {doc, get, list, attachmentsFor, runTransaction}`; `tx = {get, listAttachments, create, update, delete}` con letture prima delle scritture; `storage = {probe(path) → {exists, digest, size}, putIfAbsent(path, bytes, options) → 'created' | 'exists', remove(path)}`. La dimensione riportata da `probe` è quella dell'oggetto memorizzato: quando è disponibile deve coincidere con `objectSize` registrato nella ricevuta, quando manca la proprietà è dimostrata dal digest (§3.2, punto 2).

### 3.2 Correzioni DS-002A-R2 (17/09/2026)

La revisione Codex di DS-002A-R1 ha rilevato **finestre TOCTOU** fra la verifica (fuori transazione) e la scrittura, e ricevute validate solo in parte. Le correzioni applicate:

1. **Validatori canonici delle ricevute** (`documentAttachmentUploadReceipt`, `documentAttachmentDeleteReceipt`, §2). Una ricevuta malformata o incoerente resta bloccata: `recover()` la conta come `incomplete` senza toccare né Storage né record, e nessuna operazione viene promossa, sovrascritta o cancellata sulla sua parola.
2. **Dimensione cifrata registrata.** La ricevuta porta `objectSize`, misurato nel confine fidato (`payload.byteLength` dell'oggetto che verrà scritto) e distinto dal `size` dei metadati (byte originali), perché un payload AEAD è più lungo del plaintext. Se il trasporto riporta una dimensione, deve coincidere; se non la riporta (assente o `null`), la proprietà è dimostrata dal solo digest — questo è il comportamento dichiarato del trasporto. Un `size` presente ma non conforme al contratto rende l'oggetto non verificabile (`OBJECT_UNVERIFIABLE`).
3. **Finalizzazione del caricamento.** La transazione finale rilegge **nella stessa transazione** ricevuta e record e riprova l'intera coerenza con il comando: proprietario, documento, allegato derivato dal percorso, percorso, MIME, dimensione originale, digest, envelope confrontato campo per campo e stato `reserved`. Se uno dei due è cambiato dopo la prenotazione, l'esito è `incomplete` con `FINALIZE_CONFLICT`: nulla viene promosso.
4. **Finalizzazione della cancellazione.** Stessa regola: la ricevuta deve restare canonica e coerente con l'operazione e il record — quando esiste — deve essere ancora quello canonico in stato `deleting`. Un record sostituito dopo la verifica iniziale non viene cancellato, e i metadati non vengono rimossi.
5. **`recover()` senza separazione fra verifica e scrittura.** Ogni ramo rilegge ricevuta e record **nella transazione finale** e ripete la validazione canonica prima di promuovere, chiudere o compensare; un cambio concorrente produce `incomplete` senza scritture distruttive. L'oggetto è rimosso solo dopo una prova **immediatamente precedente** di digest e dimensione; la compensazione di una prenotazione non cancella mai un record che non riesca a riprovare come proprio, canonico e `reserved`.
6. **Regressioni sulle finestre TOCTOU.** Il fake unitario espone un hook che muta record, ricevuta o oggetto esattamente fra la prova e la transazione: caricamento, cancellazione e recupero restano bloccati senza promuovere né cancellare. Si aggiungono le regressioni su ricevute non canoniche (digest di operazione non valido, digest dell'oggetto non valido, campo estraneo, campo dell'altro tipo, stato incoerente, timestamp di stato sbagliato, dimensione non canonica, percorso estraneo) e su dimensioni discordanti, in unità e su Firestore Emulator.


### 3.3 DS-002B, primi due blocchi (17/09/2026)

**Blocco 1 — sigillo reale, trasporto e Rules** (commit `0bb19c60`):

1. **Sigillo reale** (`profile-document-attachment-seal.mjs`): AES-GCM-256 con chiave-file casuale di 32 byte; la chiave-file è avvolta con HKDF-SHA256 (salt di 32 byte, `info` = AAD contestuale) e AES-GCM. Contenuto e chiave sono legati allo stesso AAD, quindi un envelope non è riusabile su un altro proprietario, documento, allegato o percorso. Chiave-file e bit derivati sono azzerati su ogni percorso, anche in errore; `openDocumentImageBytes` risponde con un unico codice ad AAD diverso, chiave estranea, payload alterato o chiave avvolta alterata, e un envelope non canonico è rifiutato prima di qualsiasi operazione crittografica.
2. **Capacità di sessione**: `memory-vault` e `protected-session` espongono `sealImage`/`openImage` con le stesse verifiche di `read`/`encrypt` (proprietario, epoca, blocco, annullamento) prima e dopo ogni attesa, e la chiave non lascia mai il Vault. La capacità binaria azzera sempre il plaintext che riceve e ora apre ciò che ha sigillato; senza apertore iniettato rifiuta invece di restituire byte.
3. **Versione nativa dell'oggetto**: `storage.probe` riporta anche `generation`; `storage.remove(path, {generation})` applica la precondizione nativa e l'adattatore **verifica comunque la versione da sé**. **Riscontro di questo incremento: l'emulatore Firebase Storage non applica `ifGenerationMatch`** — accetta una creazione condizionata sopra un oggetto esistente e una cancellazione con versione obsoleta; la suite lo asserisce esplicitamente, quindi la verifica della versione è dell'adattatore e la precondizione nativa resta da provare su Cloud Storage reale (fuori perimetro: nessun bucket reale).
4. **Adattatori reali** (`firebase-document-attachment-transport.mjs`): Firestore (`doc`, `get`, `list`, `attachmentsFor` con lettura transazionale limitata, `runTransaction`) e Firebase Storage (`probe` con digest SHA-256, dimensione e versione; `putIfAbsent` con controllo di esistenza e `ifGenerationMatch: 0`; `remove` condizionata alla versione), usati dalla suite emulatrice con transazioni reali.
5. **Rules candidate** (`profile-document-attachment-candidate-rules.mjs`, `profile-document-attachment-storage-rules.mjs`): trasformazioni ancorate ai file produttivi, con rifiuto `RULES_BASE_CHANGED` se la base cambia e `RULES_ALREADY_PATCHED` se sono applicate due volte. I record `profileDocumentAttachments` escono dalla regola generica delle collezioni proprietario e diventano leggibili dal solo proprietario e **non scrivibili dal client** (il namespace delle ricevute era già chiuso dal file produttivo); le regole Storage restringono l'upload a 10 MiB più l'overhead AEAD, ai soli formati immagine e `application/octet-stream` con il marcatore `encrypted: 'v1'`, e aggiungono il blocco proprietario sul percorso degli allegati.
6. **Limite noto delle Rules Storage**: le regole concedono l'accesso quando *una qualsiasi* regola corrisponde, quindi la regola generica del proprietario copre ancora il percorso degli allegati e un proprietario autenticato potrebbe collocarvi un oggetto non sigillato. Chiuderlo richiede di sostituire la regola generica con un modello esplicito per collezione: è una decisione di deploy, non presa qui. Il servizio resta fail-closed, perché un oggetto che non corrisponde a digest e dimensione non viene mai promosso, sovrascritto né cancellato.

**Blocco 2 — interfaccia nella shell sperimentale** (commit `c826ff3e`):

- `profile-document-attachments-source.mjs`: una sola anteprima per volta; l'Object URL è revocato e il plaintext azzerato a chiusura, blocco, logout, cambio UID, annullamento della vista e `dispose`; caricamento file per file con esito distinto per ciascuno; il nome originale del file scelto vive solo nel risultato transiente e non entra in comandi, record o ricevute; nessuna scrittura offline; la cancellazione revoca l'anteprima dell'allegato rimosso.
- `profile-document-attachments-view.mjs`: azione **Allegato** accanto a Modifica e Cestino, selezione multipla, galleria con Apri e Cancella, anteprima con Chiudi, stato leggibile per offline e sola consultazione, e messaggio esplicito per i documenti senza ID persistito univoco (consultabili, senza allegati).
- **Non compreso nei due blocchi pubblicati**: il montaggio nella pagina di laboratorio e lo scenario browser sintetico, che restano un debito dichiarato (§7, punto 5).

## 4. Limiti e rifiuti

- Solo immagini JPEG, PNG, WebP, HEIC, HEIF; **10 MiB** per immagine; **10 immagini** per documento.
- Un documento senza ID persistito univoco resta consultabile ma **non può ricevere immagini**: nessuna migrazione implicita, nessun ID inventato.
- Rifiuti espliciti: documento assente/ambiguo/ID non valido, MIME non ammesso, dimensione non ammessa, limite raggiunto, allegato già esistente, identità non conforme, metadati non conformi, proprietario non corrispondente, percorso non derivato, offline, comando falsificato, conflitto di operazione o di impronta.
- Offline: solo metadati già sincronizzati e stato non disponibile; i byte non entrano mai nella cache.

## 5. Rollback

L'incremento non tocca dati reali, Rules, Functions, versione o produzione: il rollback è la rimozione dei cinque moduli candidati, delle tre suite di test e del registro in `package.json`, senza migrazioni né ripristini. Per un oggetto già caricato in futuro, il rollback operativo è `recover()` (compensazione degli orfani) più la rimozione del documento di metadati; la cancellazione coordinata con un eventuale cestino/retention **non** è decisa in questo incremento (vedi §7).

## 6. Prove

**53 prove unitarie** (35 di DS-002A, 7 di DS-002A-R1 e 11 di DS-002A-R2), tutte in laboratorio e senza Firebase: limiti e allowlist MIME; ID documento mancante, duplicato o non valido; documento non persistito rifiutato dal servizio autorevole; iniezione di percorso e percorsi estranei; metadati con campi sconosciuti, URL, byte o nomi originali; **ricevute canoniche di caricamento e cancellazione** (allowlist esatta per tipo, percorso derivato, entrambi i digest, `objectSize`, timestamp solo nello stato che lo possiede, `id` di trasporto vincolato al nome derivato, campi dell'altro tipo rifiutati); **dimensione cifrata e uguaglianza dell'envelope**; AAD diverso fra proprietari, documenti e allegati; envelope con versione, IV, salt o chiave avvolta non conformi; capacità revocata da UID, blocco e annullamento con plaintext azzerato anche in errore; comando immutabile senza byte, plaintext, chiave o nome; payload alterato rifiutato dal confronto di digest; rifiuti di piano; prenotazione/finalizzazione/cancellazione; retry idempotente; riuso illecito della stessa operazione; **undicesimo caricamento e corsa concorrente sul limite**; scrittura oggetto fallita con compensazione; **oggetto preesistente con byte diversi mai sovrascritto**; **oggetto con la stessa impronta ma dimensione diversa mai riusato**; finalizzazione rinviata; oggetto orfano compensato solo se il digest lo dimostra; **recupero che non promuove né cancella oggetti non dimostrabili**; **recupero che non promuove un oggetto di dimensione diversa da quella registrata**; cancellazione che valida l'intero record (stesso digest con percorso o documento diverso rifiutato); **cancellazione che non rimuove un oggetto la cui dimensione registrata è cambiata**; **mutazioni di record o ricevuta fra prova e finalizzazione per caricamento, cancellazione e recupero, tutte bloccate**; **ricevute non canoniche bloccate senza toccare Storage**; `recover()` idempotente su ricevute corrette e malformate; proiezione di sola lettura con record non verificabili e revoca durante l'attesa.

**Una suite su Firestore Emulator** (`firebase-profile-document-attachments.test.mjs`, `npm run test:profile-document-attachments-emulators`) con transazioni **reali**, **8 prove su 8**: un caricamento committa e si ripete in modo idempotente; un documento non univocamente persistito è rifiutato dal profilo autorevole; il decimo posto è assegnato atomicamente anche contro un caricamento concorrente e l'undicesimo è rifiutato; la cancellazione valida il record autorevole, è idempotente e rifiuta un record alterato; il recupero promuove solo l'oggetto con digest corrispondente e lascia intatto quello estraneo; **una dimensione memorizzata diversa da quella registrata blocca la promozione senza toccare l'oggetto**; **una ricevuta con campo estraneo o digest di operazione non valido resta bloccata**. Firestore stesso rifiuterebbe una lettura dopo una scrittura, quindi l'ordine delle transazioni è provato e non solo simulato.

**Suite emulatrice di DS-002B** (`npm run test:profile-document-attachments-storage-emulators`, emulatori `auth,firestore,storage`), **9 prove su 9**: un caricamento **cifrato davvero** (sigillo reale) committa su Firestore e Firebase Storage con precondizioni, dimensione registrata e marcatore dell'oggetto, e si ripete in modo idempotente senza riscrivere l'oggetto; un oggetto esistente non viene mai sovrascritto; l'adattatore rifiuta una versione obsoleta **e la suite dimostra che l'emulatore non applica `ifGenerationMatch`**; la cancellazione rimuove record, ricevuta e la sola versione verificata; il recupero lascia intatto un oggetto estraneo; il decimo posto resta atomico anche con il trasporto reale. Due prove Rules con `@firebase/rules-unit-testing`: record e ricevute leggibili dal solo proprietario e non scrivibili da nessun client, oggetti confinati allo UID con marcatore obbligatorio, envelope di dimensione applicato e formati non immagine rifiutati.

**Prove unitarie di DS-002B (blocchi 1 e 2), 27 in più delle 53**: sigillo reale e sua revoca (8), trasporto Storage/Firestore su SDK simulati (5), precondizioni di versione nel servizio (3), sorgente revocabile della galleria e interfaccia (11).

## 7. Cosa resta dopo i primi due blocchi di DS-002B

1. **Trasporto di produzione**: callable con Auth e App Check reali (l'architettura indica una Cloud Function per la cancellazione coordinata) e verifica delle precondizioni di generazione su **Cloud Storage reale**, che l'emulatore non applica.
2. **Rules autorizzate**: applicare le due trasformazioni candidate è una decisione di deploy; il limite noto del §3.3 punto 6 richiede di sostituire la regola generica del proprietario con un modello esplicito per collezione.
3. **Doppio lettore e non regressione**: la cifratura reale è provata in laboratorio, ma non esiste ancora una prova di compatibilità con i dati già cifrati dall'applicazione né su dispositivi.
4. **Montaggio e browser**: la pagina di laboratorio non monta ancora il pannello e non esiste lo scenario browser sintetico; entrambi restano da fare prima di qualunque valutazione di interfaccia.
5. **Decisioni aperte**: cestino/retention e rapporto con lo storico (M7), interazione con backup/ripristino (M8: limiti 10.000 allegati e 2 Mi caratteri), scansione locale e formati ammessi al rilascio, gate §16 dell'architettura (threat model, inventario, prove su dispositivi, migrazione e rollback, approvazione del proprietario, audit indipendente).

## 8. Divergenze e contraddizioni registrate (non risolte qui)

- Gli allegati Account usano **AAD costante** e conservano un `url` di download persistente; il modello candidato non usa né l'uno né l'altro (`attachment-security.js:13`, `dettaglio-privato-attachments.js:137`).
- `storage.rules:12-16` consente 25 MiB e formati non immagine; il candidato è più restrittivo (10 MiB, sole immagini). L'irrigidimento è nel contratto, non nelle Rules.
- `ARCHITETTURA_SICUREZZA_V1.md:201` parla di salvataggio «atomico o recuperabile»; qui l'atomicità non è dichiarata e la recuperabilità è esplicita.
- `M5_INVENTARIO_DATI_CONDIVISI.md:73` revoca gli Object URL dopo 60 s, l'incarico a chiusura/blocco/logout: la sorgente candidata revoca a chiusura, blocco, logout, cambio UID, annullamento e `dispose`, senza scadenza a tempo; la riconciliazione con la regola dei 60 s resta aperta per il montaggio.
- **L'emulatore Firebase Storage non applica `ifGenerationMatch`** (creazione e cancellazione): le precondizioni native sono passate a Storage ma non sono verificabili in laboratorio, quindi l'adattatore confronta la versione da sé e la garanzia atomica resta da provare su Cloud Storage reale (§3.3 punto 3).
- **Le Rules Storage concedono l'accesso se una qualsiasi regola corrisponde**: la regola generica del proprietario continua a coprire il percorso degli allegati, quindi un oggetto non sigillato può essere collocato dal proprietario nel proprio sottoalbero. Servirebbe un modello esplicito per collezione (§3.3 punto 6); il servizio non si fida dell'oggetto in nessun caso.
