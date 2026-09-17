# DS-002A — Contratto candidato per le immagini dei documenti digitali privati

> **Stato:** candidato, **non montato** e non attivo in produzione: nessun pulsante, nessun upload reale, nessuna modifica a Rules o Functions produttive.
> **Autorità:** contratto candidato di laboratorio; prevale la baseline sicurezza ([Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md) §11) e l'incarico DS-002A in [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md).
> **Riferimento di codice:** ramo `integration/vault-shell-v127-security`; base `58aaa625`; modulo `experiments/persistent-vault-shell/profile-document-attachments-contract.mjs` e collegati.
> **Ultima verifica:** 17/09/2026 — 35 prove unitarie in laboratorio (`test:vault-shell`), nessun emulatore e nessuna verifica browser: in questo incremento non esiste alcuna interfaccia.
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
2. **Caricamento** (`createProfileDocumentAttachmentHandler.upload`): (a) transazione di **prenotazione** — metadati `reserved` + ricevuta idempotente; (b) scrittura dell'oggetto opaco **fuori** da qualsiasi transazione; (c) transazione di **finalizzazione** — metadati e ricevuta `ready`.
3. **Cancellazione** (`remove`): ricevuta `deleting` → rimozione dell'oggetto → rimozione dei metadati e ricevuta `removed`. Il comando porta il digest atteso, quindi una modifica concorrente dei metadati produce un conflitto invece di una cancellazione alla cieca.
4. **Recupero** (`recover`): completa le ricevute pendenti e **compensa gli oggetti orfani** (oggetto presente senza metadati → oggetto rimosso; prenotazione senza oggetto → prenotazione e metadati rimossi). Idempotente: una seconda esecuzione non cambia nulla.

**Esiti dichiarati, senza falsa atomicità:** `confirmed` (terminale, ripetibile), `compensated` (terminale, nessuna traccia), `incomplete` (una ricevuta resta e `recover()` o un retry la conclude). Firestore e Storage non sono mai descritti come atomici insieme; le posizioni di ripristino sono la ricevuta e lo stato dei metadati.

**Proiezione di sola lettura** (`createProfileDocumentAttachmentsReader`): metadati del solo documento richiesto, con controllo proprietario/documento/percorso su ogni record, record non verificabili riportati in `invalid` e mai esposti, `available` vero solo se online **e** `ready`, `bytesAvailable` sempre falso. La vista è revocata dopo ogni attesa.

## 4. Limiti e rifiuti

- Solo immagini JPEG, PNG, WebP, HEIC, HEIF; **10 MiB** per immagine; **10 immagini** per documento.
- Un documento senza ID persistito univoco resta consultabile ma **non può ricevere immagini**: nessuna migrazione implicita, nessun ID inventato.
- Rifiuti espliciti: documento assente/ambiguo/ID non valido, MIME non ammesso, dimensione non ammessa, limite raggiunto, allegato già esistente, identità non conforme, metadati non conformi, proprietario non corrispondente, percorso non derivato, offline, comando falsificato, conflitto di operazione o di impronta.
- Offline: solo metadati già sincronizzati e stato non disponibile; i byte non entrano mai nella cache.

## 5. Rollback

L'incremento non tocca dati reali, Rules, Functions, versione o produzione: il rollback è la rimozione dei cinque moduli candidati, delle tre suite di test e del registro in `package.json`, senza migrazioni né ripristini. Per un oggetto già caricato in futuro, il rollback operativo è `recover()` (compensazione degli orfani) più la rimozione del documento di metadati; la cancellazione coordinata con un eventuale cestino/retention **non** è decisa in questo incremento (vedi §7).

## 6. Prove

35 prove unitarie, tutte in laboratorio e senza Firebase: limiti e allowlist MIME; ID documento mancante, duplicato o non valido; iniezione di percorso e percorsi estranei; metadati con campi sconosciuti, URL, byte o nomi originali; AAD diverso fra proprietari, documenti e allegati; envelope con versione, IV, salt o chiave avvolta non conformi; capacità revocata da UID, blocco e annullamento con plaintext azzerato anche in errore; comando immutabile senza byte, plaintext, chiave o nome; rifiuti di piano; prenotazione/finalizzazione/cancellazione; retry idempotente; riuso illecito della stessa operazione; scrittura oggetto fallita con compensazione; finalizzazione rinviata; oggetto orfano compensato; `recover()` idempotente su ricevute corrette e malformate; proiezione di sola lettura con record non verificabili e revoca durante l'attesa.

## 7. Cosa resta a DS-002B

1. **Trasporto**: callable con Auth e App Check reali (l'architettura indica una Cloud Function per la cancellazione coordinata), adattatori reali per Firestore e Storage, emulatori e test di integrazione.
2. **Sigillo reale**: implementazione della cifratura binaria con chiave-file casuale e AAD contestuale secondo questo contratto, con doppio lettore e prova di non regressione.
3. **Rules**: `firestore.rules:106-118` ammette ancora la scrittura diretta del proprietario su `profileDocumentAttachments`; serve un'esclusione/irrigidimento autorizzato. `storage.rules:18-20` accetta `application/octet-stream` solo con il marcatore `encrypted: 'v1'`, mentre il contratto prevede un formato nuovo: va deciso se riusare il marcatore o cambiare le Rules (nessuna delle due cose è autorizzata qui).
4. **Interfaccia**: pulsante **Allegato** accanto a Modifica e Cestino, galleria, apertura controllata, eliminazione, anteprima con Object URL revocati a chiusura/blocco/logout (le due indicazioni esistenti, 60 s e chiusura, vanno riconciliate).
5. **Decisioni aperte**: cestino/retention e rapporto con lo storico (M7), interazione con backup/ripristino (M8: limiti 10.000 allegati e 2 Mi caratteri), scansione locale e formati ammessi al rilascio, gate §16 dell'architettura (threat model, inventario, prove su dispositivi, migrazione e rollback, approvazione del proprietario, audit indipendente).

## 8. Divergenze e contraddizioni registrate (non risolte qui)

- Gli allegati Account usano **AAD costante** e conservano un `url` di download persistente; il modello candidato non usa né l'uno né l'altro (`attachment-security.js:13`, `dettaglio-privato-attachments.js:137`).
- `storage.rules:12-16` consente 25 MiB e formati non immagine; il candidato è più restrittivo (10 MiB, sole immagini). L'irrigidimento è nel contratto, non nelle Rules.
- `ARCHITETTURA_SICUREZZA_V1.md:201` parla di salvataggio «atomico o recuperabile»; qui l'atomicità non è dichiarata e la recuperabilità è esplicita.
- `M5_INVENTARIO_DATI_CONDIVISI.md:73` revoca gli Object URL dopo 60 s, l'incarico a chiusura/blocco/logout: decisione rinviata a DS-002B.
