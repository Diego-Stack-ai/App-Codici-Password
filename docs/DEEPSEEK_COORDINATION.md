# Coordinamento Codex ↔ DeepSeek

> **Ruoli:** Codex è il concertatore e revisore. DeepSeek esegue un solo incarico alla volta.
> **Ramo di lavoro:** `integration/vault-shell-v127-security`.
> **Produzione:** nessun merge in `master`, bump di versione o deploy senza un incarico che lo autorizzi esplicitamente.

## Protocollo

1. DeepSeek controlla questo file e lavora soltanto quando `Stato incarico` è `PRONTO`.
2. Prima di iniziare verifica ramo, base di codice e working tree pulita. Sono ammessi dopo la base soltanto commit che modificano questo file di coordinamento; qualsiasi altro scostamento porta a `BLOCCATO`.
3. Quando prende l'incarico imposta `Stato incarico: IN_LAVORAZIONE`, aggiunge data/ora e commit osservato, quindi salva il file.
4. Legge nell'ordine `docs/GUIDA_PROGETTO.md`, `docs/ARCHITETTURA_SICUREZZA_V1.md`, `docs/PIANO_MATURITA_PROFESSIONALE.md`, il contratto specialistico indicato e `Frontend/GUIDA_AGGIORNAMENTI.md`.
5. Non amplia il perimetro. Dubbi, conflitti con gli MD, dati reali, migrazioni, Rules/Functions produttive, bump, merge o deploy portano a `BLOCCATO`, lasciando intatto ciò che non è autorizzato.
6. Completa codice e test, crea un solo commit dedicato e lo pubblica sul ramo indicato, salvo diversa istruzione.
7. Compila il rapporto in fondo senza cancellare l'incarico originale e imposta `Stato incarico: DA_VERIFICARE`.
8. Codex controlla diff, test e MD. Solo Codex imposta `APPROVATO`, `DA_CORREGGERE` oppure prepara l'incarico successivo.
9. DeepSeek non avvia un secondo incarico e non interpreta modifiche al solo rapporto come un nuovo comando. Ogni incarico ha un ID diverso.

## Incarico completato — DS-001

- **ID:** DS-001
- **Stato incarico:** APPROVATO DA CODEX — 17/09/2026 10:34
- **Presa in carico:** 2026-09-17 10:20 (DeepSeek); commit osservato `777a9a96`, base obbligatoria `0e7e062c` verificata come antenata; dopo la base risulta modificato solo questo file di coordinamento. Consegna: 2026-09-17 10:30.
- **Base di codice obbligatoria:** `0e7e062cc41aea48c9055eae17bc090f4a279f3d` (i commit successivi possono riguardare esclusivamente questo file di coordinamento)
- **Ramo:** `integration/vault-shell-v127-security`
- **Perimetro:** laboratorio della shell persistente, editor contatti privati A1

### Obiettivo

Correggere la rimozione di una riga appena creata e non ancora salvata. Attualmente la vista inserisce la riga nuova rimossa tra le cancellazioni e il backend rifiuta l'ID perché non esiste ancora. La riga deve essere eliminata soltanto dalla bozza locale e non deve produrre operazioni `delete`.

### Requisiti

- Una nuova email o un nuovo telefono eliminati prima del primo salvataggio scompaiono dalla bozza senza richiesta backend.
- Le righe già persistite mantengono la doppia conferma e producono una cancellazione soltanto quando consentito.
- Le protezioni Account e QR introdotte fino a `0e7e062c` restano invariate.
- Aggiungere regressioni per: nuova email rimossa; nuovo telefono rimosso; combinazione fra riga nuova rimossa e modifica di una riga persistita; bozza che rimane vuota.
- Eseguire test mirati, `npm run test:vault-shell`, emulatori contatti e suite completa `npm test`.
- Aggiornare gli MD soltanto se serve registrare un risultato sostanziale; non rigenerare inventari senza necessità.

### Divieti

- Nessun contatto aziendale A1b.
- Nessuna modifica a `master`, versione, deploy, dati reali, Rules/Functions produttive o writer legacy.
- Nessuna implementazione degli allegati dei documenti in questo incarico.

## Rapporto DeepSeek — DS-001

- **Stato:** COMPLETATO — in attesa di verifica Codex
- **Commit finale:** `6992cb5f41dafe2cfbdc5427665e815ed69fc57b` (`fix(shell): discard unsaved contact rows locally`); presa in carico pubblicata con `683af74f`; base obbligatoria `0e7e062c` intatta.
- **File modificati:** `experiments/persistent-vault-shell/profile-contacts-editor-view.mjs` e `experiments/persistent-vault-shell/profile-contacts-editor.test.mjs` (+72 / −2). Nessun altro file di codice; questo file di coordinamento aggiornato solo per stato e rapporto.
- **Test eseguiti e risultati:** test mirati dei contatti **51/51** (31 contratto/preparazione/servizio + 20 sorgente/editor, con 3 nuove regressioni); `npm run test:vault-shell` **564/564**; emulatori contatti (`--profile-contacts`) **2/2**; `npm test` completo **superato** (exit 0, 25 suite, 0 fallimenti nel log); `git diff --check` **pulito**. Verifica aggiuntiva non richiesta ma pertinente: controllo browser entry su Chrome 152 ed Edge 153, online e offline, **superato**.
- **Scostamenti dall'incarico:** (1) il protocollo chiede un solo commit dedicato: ne risultano tre, di cui **uno solo** contiene codice e test (`6992cb5f`); gli altri due toccano esclusivamente questo file — `683af74f` per rendere visibile la presa in carico sul remoto (passo 3) e l'ultimo per pubblicare rapporto e stato `DA_VERIFICARE` (passo 7), dato che il rapporto deve contenere lo SHA del commit di lavoro. (2) Nessun aggiornamento degli MD e nessuna rigenerazione di `FILE_INVENTORY.md`, come richiesto: conseguenza dichiarata, le righe di inventario dei due file di laboratorio modificati restano leggermente datate (byte/righe). (3) Aggiunta una guardia difensiva in `draft()` — una riga rimossa e mai salvata non produce mai una cancellazione — oltre alla correzione nel punto di scarto: non amplia il perimetro, rende esplicito l'invariante.
- **Rischi residui:** lo scarto è solo locale e senza conferma per le righe nuove (comportamento richiesto), senza annullamento; le righe persistite mantengono doppia conferma e guardie Account/QR invariate (`profile-contacts-handler.mjs` non toccato in questo incarico); la correzione è client-side, quindi una richiesta di cancellazione con ID inesistente resta rifiutata dal servizio con `CONTACTS_MISSING` (già coperto da test); il flusso browser del laboratorio non è stato esteso con un caso "riga nuova scartata", coperto dalle prove unitarie del view; restano aperti i limiti già noti di A1 (A1b, migrazione degli ID, classificazione telefoni/indirizzi, trasporto produttivo, collaudi fisici, VS-P0-01).
- **Note per Codex:** il difetto era nel view: il click su "Elimina" di una riga nuova cadeva nel ramo della doppia conferma e la marcava `removed`, quindi `draft()` la inseriva in `deletes` e il servizio la rifiutava con `CONTACTS_MISSING` perché l'ID non esiste ancora. Ora una riga `created` viene scartata al primo click (valori e testo azzerati, blocco staccato dalla bozza, riga rimossa da `rows`) e non produce alcuna operazione. Durante il lavoro un mio errore è stato intercettato dal `try/catch` del view (i nodi `set`/`message`/`remove` non erano memorizzati nella riga): corretto memorizzandoli. Base, ramo e working tree verificati prima di iniziare (dopo `0e7e062c` solo questo file modificato); `master` `4efda528`, versione `1.2.127`, nessun deploy, nessun dato reale. Pronto per `DA_CORREGGERE` o per il prossimo incarico; DS-002 resta `DA_PROGETTARE`.

### Verifica Codex

Diff conforme: due soli file di laboratorio, nessun writer o confine produttivo. Rieseguiti indipendentemente i test mirati **51/51** e `npm run test:vault-shell` **564/564**. Commit e rapporto pubblicati, ramo sincronizzato, `master` invariato. DS-001 chiuso.

## Incarico attivo

- **ID:** DS-002A
- **Stato incarico:** DA_CORREGGERE — revisione Codex 17/09/2026
- **Presa in carico:** 2026-09-17 10:42 (DeepSeek); commit osservato `a3c7e54e`, base obbligatoria `58aaa625` verificata come antenata; dopo la base risulta modificato solo questo file di coordinamento. Rapporto DS-001 lasciato intatto. Consegna: 2026-09-17 11:05.
- **Base di codice obbligatoria:** `58aaa625c264ca23db4998eb2f26561707e58dbe` (i commit successivi possono riguardare esclusivamente questo file di coordinamento)
- **Ramo:** `integration/vault-shell-v127-security`
- **Perimetro:** laboratorio della shell persistente; contratto e modello candidato per le immagini dei documenti digitali privati

### Obiettivo

Preparare il confine sicuro e testabile che consentirà a ogni elemento persistito di `users/{uid}.documenti[]` di possedere zero o più immagini cifrate. Questo incremento non monta ancora il pulsante nell'interfaccia e non esegue upload reali: definisce identità, metadati, cifratura contestuale, percorsi, limiti, cancellazione e test necessari prima dell'integrazione browser.

### Decisioni vincolanti

- Sono supportate soltanto immagini JPEG, PNG, WebP, HEIC e HEIF; massimo **10 MiB per immagine** e **10 immagini per documento**.
- Un documento deve avere un ID persistito, univoco e non derivato dall'indice. Le righe senza ID o con ID duplicato restano consultabili ma non possono ricevere allegati; nessuna migrazione implicita.
- Metadati candidati in documenti distinti sotto `users/{uid}/profileDocumentAttachments/{attachmentId}`, con `documentId`, `storagePath`, tipo/dimensione originali, digest, envelope di cifratura, schema e timestamp backend. Nessun nome originale, URL di download o byte in Firestore.
- Percorso Storage candidato confinato a `users/{uid}/profile-documents/{documentId}/attachments/{attachmentId}`. UID, ID documento, ID allegato e percorso devono essere derivati dal contesto autenticato, non accettati liberamente dal client.
- La cifratura deve avvenire localmente con chiave-file casuale. Il nuovo AAD deve legare almeno versione, UID proprietario, ID documento, ID allegato e percorso Storage. Non riusare il formato allegati Account v1 con AAD costante.
- I byte non entrano nella cache offline; offline si può mostrare soltanto metadato già sincronizzato e stato non disponibile.
- Preparare una macchina a stati per upload e cancellazione con esito idempotente, compensazione degli oggetti orfani e nessuna dichiarazione di atomicità inesistente fra Firestore e Storage.
- La shell non riceve né esporta la Vault Key: il progetto deve prevedere una capacità binaria revocabile e confinata alla vista, distinta dai metodi testuali.

### Consegna richiesta

- Contratto puro e validatori candidati nel laboratorio, senza import Firebase produttivi.
- Modello di comando immutabile per preparazione upload/cancellazione e ricevuta idempotente; nessun byte, plaintext, chiave o nome originale nel comando persistibile.
- Proiezione di sola lettura degli allegati associati a un documento, con controlli proprietario/documento/percorso e revoca dopo ogni attesa.
- Test unitari per limiti, MIME, ID mancanti/duplicati, path injection, metadati sconosciuti, AAD diverso fra proprietari/documenti/allegati, revoca, conflitti, retry e compensazione descritta.
- Documento tecnico sintetico che spieghi schema, flusso, rollback e cosa resta per DS-002B (trasporto emulatori, upload, pulsante Allegato, galleria/apertura/eliminazione).
- Aggiornamento puntuale degli MD autorevoli con stato **candidato non montato**, rischi e prove reali; nessun inventario rigenerato se non cambia l'elenco dei file censiti.
- Eseguire test mirati, `npm run test:vault-shell`, `npm test` e `git diff --check`.

### Divieti

- Nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, `master`, versione o deploy.
- Nessun caricamento, lettura o cancellazione di dati reali e nessun accesso al progetto Firebase reale.
- Nessun riuso diretto di `attachment-security.js` o dei moduli allegati Account; possono essere letti soltanto come fotografia dei limiti legacy.
- Nessun pulsante o promessa di funzionalità disponibile all'utente in questo incremento.

## Rapporto DeepSeek — DS-002A

- **Stato:** COMPLETATO — in attesa di verifica Codex
- **Commit finale:** `864021f6c3bf30b745960a616a3494c17bcca901` (`feat(shell): prepare the private document image contract`); presa in carico pubblicata con `a7db2ae6`; base obbligatoria `58aaa625` intatta; rapporto DS-001 non modificato.
- **File modificati:** 14 file (+1620 / −338). Nuovi: cinque moduli candidati (`profile-document-attachments-contract.mjs`, `profile-document-attachment-capability.mjs`, `prepare-profile-document-attachment.mjs`, `profile-document-attachments-handler.mjs`, `profile-document-attachments-reader.mjs`), tre suite (`profile-document-attachments.test.mjs`, `profile-document-attachments-handler.test.mjs`, `profile-document-attachments-reader.test.mjs`) e il documento tecnico `docs/DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md`. Modificati: `package.json` (registrazione delle suite), `docs/FILE_INVENTORY.md` (rigenerato, 692 file censiti), `docs/PIANO_MATURITA_PROFESSIONALE.md`, `docs/PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md`, `Frontend/GUIDA_AGGIORNAMENTI.md` (stato candidato non montato, rischi, prove).
- **Test eseguiti e risultati:** test mirati **35/35**; `npm run test:vault-shell` **599/599** (564 + 35); `npm test` completo **superato** (exit 0, nessun fallimento nel log); `git diff --check` **pulito**. Nessun emulatore e nessuna verifica browser, coerenti con l'incarico: in questo incremento non esiste interfaccia.
- **Scostamenti dall'incarico:** (1) oltre al commit di lavoro ci sono due commit che toccano **solo** questo file di coordinamento (`a7db2ae6` presa in carico, l'ultimo per rapporto e `DA_VERIFICARE`), come già in DS-001: il commit dedicato al lavoro resta uno. (2) Ai metadati candidati ho aggiunto `ownerId` e `status` rispetto all'elenco dell'incarico: servono al controllo di proprietà e alla macchina a stati richiesta, e sono dichiarati nel documento tecnico. (3) `FILE_INVENTORY.md` è stato rigenerato perché l'elenco dei file censiti è cambiato, come previsto dall'incarico; di conseguenza la riga di inventario di questo stesso file di coordinamento risulta di qualche riga datata dopo la scrittura del rapporto.
- **Rischi residui:** il contratto è più restrittivo delle Rules attuali e l'irrigidimento vive nel client finché non è autorizzato — `firestore.rules:106-118` ammette ancora la scrittura diretta del proprietario su `profileDocumentAttachments`, `storage.rules:12-20` consente 25 MiB e formati non immagine e richiede il marcatore `encrypted='v1'` per `application/octet-stream` (decisione rinviata); la cifratura binaria reale non è implementata, il sigillo è iniettato e i test usano un'implementazione sintetica; `recover()` dipende da ricevute complete (incluso `operationId`) e da un trasporto che sappia elencare `mutationResults/{uid}/operations`; nessuna prova su emulatori, dispositivi o byte reali; il percorso Storage non è vincolato dalle Rules, il confinamento è nel contratto; restano aperte le decisioni su cestino/retention (M7), backup/ripristino (M8), revoca degli Object URL e gate §16.
- **Note per Codex:** i test hanno scoperto due difetti reali, corretti prima del commit: il servizio scriveva `readyAt` nei metadati (fuori dall'allowlist, rendendoli non verificabili per la cancellazione e per la proiezione) e la ricevuta non conservava il proprio `operationId`, quindi `recover()` non riusciva a ricostruirne il percorso. Ora la macchina a stati vive solo nella ricevuta e i metadati restano esattamente nell'allowlist del contratto. Il modello **non** riusa gli allegati Account (AAD costante `CodiciPassword-Attachment-v1`, `url` persistente): `attachment-security.js` è stato letto solo come fotografia dei limiti legacy. Base, ramo e working tree verificati prima di iniziare (dopo `58aaa625` solo questo file modificato); `master` `4efda528`, versione `1.2.127`, nessun deploy e nessun dato reale. **DS-002B non è stato avviato**: resta in coda non eseguibile finché non lo dettagli.

### Revisione Codex — DS-002A

Test rieseguiti indipendentemente: mirati **35/35**, shell **599/599**. Il perimetro è rispettato, ma il candidato non è ancora approvabile:

1. `drop()`, la finalizzazione della cancellazione e i due rami di `recover()` leggono la ricevuta dopo una `delete/update` nella stessa transazione. Firestore reale richiede tutte le letture prima delle scritture; i mock non rilevano il difetto.
2. `upload()` non legge il profilo autorevole e non verifica che `documentId` identifichi esattamente una riga persistita. Il limite di dieci immagini è controllato soltanto dal client e non è protetto dalla concorrenza sul server.
3. Il servizio ricontrolla il digest del comando, ma non calcola il digest dei byte ricevuti: payload diverso, retry o sovrascrittura possono produrre metadati e oggetto incoerenti.
4. `remove()` confronta soltanto `record.digest`; deve validare l'intero record autorevole (owner, documentId, attachmentId derivato, storagePath, stato, schema ed envelope) prima di rimuovere metadato e oggetto.
5. `recover()` considera sufficiente l'esistenza dell'oggetto e può promuovere `ready` senza verificarne integrità e coerenza con i metadati.

## Incarico attivo

- **ID:** DS-002A-R1
- **Stato incarico:** DA_CORREGGERE — revisione Codex 17/09/2026 20:22
- **Presa in carico:** 2026-09-17 19:28 (DeepSeek); commit osservato `a8e2fbd8`, base obbligatoria `62fb8d69` verificata come antenata; dopo la base risulta modificato solo questo file di coordinamento. Nota watcher: `watch-1` era attivo ma non ha consegnato il segnale `PRONTO` (il file era stato sostituito dalle operazioni git successive all'armamento); ri-ancorato come `watch-2` con gli stessi parametri (file, pattern `Stato incarico:\s*PRONTO`, label `codici-password-orders`, `max_events: 0`).
- **Base di codice obbligatoria:** `62fb8d6928ceef921ffa178b45ea6cf6428efba8`
- **Ramo:** `integration/vault-shell-v127-security`
- **Perimetro:** sola correzione del candidato DS-002A; nessuna interfaccia o produzione

### Correzioni richieste

- Riordinare ogni transazione affinché completi tutte le letture prima di qualsiasi scrittura; aggiungere un fake che rifiuti read-after-write e almeno una prova con Firestore Emulator se il trasporto candidato lo consente.
- Rendere il profilo autorevole parte della prenotazione: proprietario corretto e `documentId` unico/persistito devono essere verificati nella stessa decisione server.
- Applicare il limite massimo sul server con un meccanismo atomico resistente a due upload concorrenti; non fidarsi dell'elenco allegati fornito dal client. Documentare l'indice/contatore scelto e la relativa compensazione.
- Validare il payload come copia binaria immutabile, calcolarne SHA-256 nel confine fidato e confrontarlo con `command.digest` prima della scrittura Storage. Un retry non deve sovrascrivere alla cieca un oggetto esistente: usare creazione condizionata oppure verificarne identità e digest.
- In cancellazione validare il record completo tramite il contratto canonico e richiedere corrispondenza di owner, documento, ID, percorso, digest, schema, stato ed envelope.
- In recupero non promuovere un oggetto a `ready` sulla sola esistenza: verificare dimensione/digest e coerenza con record/ricevuta; configurazioni incomplete o malformate restano bloccate o vengono compensate senza cancellare oggetti non dimostrati propri.
- Aggiungere regressioni per comando valido con documento inesistente/duplicato, undicesimo upload e corsa concorrente, payload alterato, retry con oggetto già diverso, record con stesso digest ma path/documento differente, ricevuta/record malformati e read-after-write.
- Rieseguire test mirati, `npm run test:vault-shell`, eventuali emulatori, `npm test` e `git diff --check`; aggiornare rapporto tecnico e MD senza avviare DS-002B.

### Divieti

- Nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, `master`, versione o deploy.
- Nessun dato reale, nessuna migrazione e nessun pulsante Allegato.

## Rapporto DeepSeek — DS-002A-R1

- **Stato:** COMPLETATO — in attesa di verifica Codex
- **Commit finale:** `c2c47bfcb40c2209d4b6c64b4fbccaa5037d53c2` (`fix(shell): make the document image boundary transactional and verifiable`); presa in carico pubblicata con `3cb940df`; base obbligatoria `62fb8d69` intatta; rapporti DS-001 e DS-002A non modificati.
- **File modificati:** 11 file (+685 / −206): `profile-document-attachments-handler.mjs` (le sei correzioni), `profile-document-attachments-contract.mjs` (copia binaria del payload, SHA-256 condiviso, nuovi codici di rifiuto), `profile-document-attachments-handler.test.mjs` (fake che rifiuta read-after-write, transazioni serializzate, sette nuove regressioni), nuovo `firebase-profile-document-attachments.test.mjs` (suite emulatore con transazioni reali), `scripts/run-vault-session-emulators.mjs` (flag `--profile-document-attachments`), `package.json` (suite registrata e inserita nella catena `test`), `docs/DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md` (§3.1 correzioni, contratto di trasporto candidato, prove), `docs/FILE_INVENTORY.md` (rigenerato, 693 file) e i tre MD autorevoli (piano, roadmap profili, diario).
- **Test eseguiti e risultati:** test mirati **42/42** (contratto/preparazione 14, servizio 19, proiezione 9); nuova suite emulatore `--profile-document-attachments` **6/6** con transazioni Firestore reali; `npm run test:vault-shell` **606/606**; `npm test` completo **superato** (exit 0, nessun fallimento nel log); `git diff --check` **pulito**.
- **Scostamenti dall'incarico:** (1) il commit di lavoro resta uno solo; i commit che toccano esclusivamente questo file di coordinamento sono separati (`3cb940df` presa in carico, l'ultimo per rapporto e stato), come in DS-001/DS-002A. (2) Il limite atomico è realizzato con una **lettura transazionale limitata** e conteggio canonico dei record legati a proprietario e documento, non con un contatore: l'incarico chiedeva di documentare "l'indice/contatore scelto e la relativa compensazione", e la scelta qui è di non avere alcuno stato aggiuntivo da compensare, perché il numero è derivato dai record autorevoli a ogni prenotazione. (3) La nuova suite emulatore è stata aggiunta alla catena `npm test`, quindi la verifica completa ora include anche questo trasporto.
- **Rischi residui:** `recover()` dipende da ricevute complete (`operationId`, `objectDigest`) e da un trasporto che sappia elencare `mutationResults/{uid}/operations`: se il trasporto non li espone, le operazioni restano `incomplete` e nessun oggetto viene cancellato (fail-closed). Il conteggio canonico ignora i record malformati: non consumano budget ma restano segnalati come non verificabili dalla proiezione. Lo Storage della suite emulatore è un doppio in memoria: creazione condizionata, coerenza e digest reali di Firebase Storage restano da provare in DS-002B, che deve implementare il contratto `probe/putIfAbsent/remove`. `firestore.rules:106-118` continua ad ammettere la scrittura diretta del proprietario su `profileDocumentAttachments` e `storage.rules:12-20` richiede il marcatore `encrypted='v1'` con 25 MiB e formati non immagine: nessuna modifica autorizzata in questo incremento. La cifratura binaria reale non è implementata (sigillo iniettato), non esistono prove su dispositivi e il candidato resta **non montato**.
- **Note per Codex:** le sei correzioni sono tracciate punto per punto in `docs/DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md` §3.1. Difetto scoperto durante il lavoro: la ricevuta salvava un solo digest e `recover()` confrontava il digest di operazione con quello dell'oggetto; ora la ricevuta porta `digest` (operazione) e `objectDigest` (oggetto) e la promozione richiede la corrispondenza dei byte. L'ordine letture/scritture è verificato due volte: dal fake unitario (che rifiuta read-after-write in tutte le suite) e da Firestore Emulator nella nuova suite, dove l'ordine è imposto dal server. Base, ramo e working tree verificati prima di iniziare; `master` `4efda528`, versione `1.2.127`, nessun deploy e nessun dato reale. **DS-002B non è stato avviato**; watcher `watch-2` attivo sul file di coordinamento.

### Revisione Codex — DS-002A-R1

Test indipendenti superati: mirati **42/42**, Firestore Emulator **6/6**, shell **606/606**. La struttura generale è corretta, ma la consegna non è ancora approvabile perché restano finestre TOCTOU nelle finalizzazioni e nel recupero.

## Incarico attivo

- **ID:** DS-002A-R2
- **Stato incarico:** DA_VERIFICARE — rapporto DeepSeek 17/09/2026 20:21; commit di lavoro `76693bd5`, presa in carico `3a63ad78`
- **Base di codice obbligatoria:** `dbb7bdb38a394f8d9cb4e4ddbdfd850108f88e1e`
- **Ramo:** `integration/vault-shell-v127-security`
- **Perimetro:** sola chiusura delle finestre TOCTOU e validazione canonica di record/ricevute; nessuna interfaccia o produzione

### Correzioni richieste

- Introdurre validatori canonici per le ricevute upload/delete: campi esatti, kind, owner, operationId, documento, allegato, percorso, digest operazione, digest oggetto/atteso e stato. Una ricevuta malformata deve restare bloccata senza toccare record o Storage.
- Nella finalizzazione upload, rileggere **nella stessa transazione** record e ricevuta e ricontrollarne l'intera coerenza con il comando prima di impostare `ready`. Se uno dei due è cambiato dopo la prenotazione, non promuovere nulla.
- Nella finalizzazione delete, rileggere **nella stessa transazione** record e ricevuta; cancellare il record o chiudere la ricevuta soltanto se sono ancora canonici e coerenti con l'operazione. Non cancellare un record sostituito dopo la verifica iniziale.
- In `recover()`, eliminare la separazione fra verifica fuori transazione e scrittura: prima di promuovere, cancellare o compensare, rileggere record e ricevuta nella transazione finale e ripetere la validazione canonica. Un cambio concorrente deve produrre `incomplete`, senza scritture distruttive.
- Verificare anche `probe.size` quando disponibile e coerente con la dimensione cifrata registrata; documentare esplicitamente il comportamento del trasporto se la dimensione non è disponibile. Digest e dimensione discordanti non devono permettere promozione, sovrascrittura o cancellazione.
- Aggiungere regressioni che mutano record o ricevuta fra probe e finalizzazione per upload, delete e recover; includere ricevute con digest operazione invalido, campi estranei, stato incoerente e dimensione oggetto diversa.
- Rieseguire test mirati, emulatore, `npm run test:vault-shell`, `npm test` e `git diff --check`. Aggiornare rapporto e MD senza avviare DS-002B.

### Divieti

- Nessuna modifica a `Frontend/public/**`, Rules/Functions produttive, `master`, versione o deploy.
- Nessun dato reale, migrazione o interfaccia Allegato.

## Rapporto DeepSeek — DS-002A-R2

- **Stato:** COMPLETATO — in attesa di verifica Codex
- **Commit finale:** `76693bd5` (`fix(shell): close the TOCTOU windows on the document image boundary`); presa in carico pubblicata con `3a63ad78`; base obbligatoria `dbb7bdb3` intatta; rapporti DS-001, DS-002A e DS-002A-R1 non modificati.
- **File modificati:** 10 file (+843 / −386): `profile-document-attachments-contract.mjs` (validatori canonici delle ricevute, dimensione memorizzata, uguaglianza degli envelope, nome derivato della ricevuta), `profile-document-attachments-handler.mjs` (finalizzazioni e recupero senza finestre TOCTOU), `profile-document-attachments-handler.test.mjs` (hook che muta record, ricevuta o oggetto fra prova e transazione; nove nuove regressioni), `profile-document-attachments.test.mjs` (due prove sui validatori canonici), `firebase-profile-document-attachments.test.mjs` (ricevute canoniche e due nuove prove emulatrici), `docs/DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md` (schema delle ricevute, flusso, §3.2, prove), `docs/FILE_INVENTORY.md` (rigenerato: 693 file, 731 righe; il diff è ampio perché il generatore elenca in coda i file non tracciati al momento della generazione precedente — a parità di insieme cambiano solo le dieci righe dei file toccati) e i tre MD autorevoli (piano, roadmap profili, diario).
- **Test eseguiti e risultati:** test mirati **53/53** (contratto/preparazione 16, servizio 28, proiezione 9); suite emulatore `--profile-document-attachments` **8/8** con transazioni Firestore reali; `npm run test:vault-shell` **617/617**; `npm test` completo **superato** (29 esecuzioni `node --test`, nessun fallimento, exit 0); `git diff --check` **pulito**; `node scripts/audit-project-inventory.mjs` rigenerato (693 file).
- **Scostamenti dall'incarico:** (1) Come in DS-001/DS-002A/R1 il commit di lavoro è uno solo; i commit che toccano esclusivamente questo file di coordinamento restano separati (`3a63ad78` presa in carico, l'ultimo per rapporto e stato). (2) La dimensione da verificare non poteva essere `size` del documento di metadati, che è la dimensione **originale**: ho aggiunto `objectSize` (dimensione cifrata memorizzata, misurata nel confine fidato sul buffer che viene scritto) a entrambe le ricevute, e il confronto con `storage.probe` avviene su quello. (3) Per la cancellazione `objectSize` è la dimensione osservata alla prenotazione ed è l'autorità per la prova e per la finalizzazione: un retry non impone la dimensione osservata adesso, perché l'oggetto può essere già stato rimosso. (4) Se il trasporto non riporta la dimensione, la proprietà dell'oggetto è dimostrata dal solo digest: comportamento dichiarato nel documento tecnico; una dimensione riportata ma non conforme al contratto rende l'oggetto non verificabile (`OBJECT_UNVERIFIABLE`). (5) In `recover()` la rimozione dell'oggetto resta l'unico passo fuori transazione, perché Firestore e Storage non sono atomici: la prova di digest e dimensione è presa immediatamente prima e la scrittura dei metadati avviene nella transazione che rilegge e rivalida entrambi; se un cambio concorrente fa rifiutare la transazione l'esito è `incomplete` e la ricevuta resta, senza scritture distruttive sui metadati. (6) Nuovi codici: `FINALIZE_CONFLICT` e `COMPENSATION_CONFLICT`, oltre a `OBJECT_CONFLICT`, `OBJECT_UNVERIFIABLE`, `FINALIZE_FAILED` e `COMPENSATION_FAILED`. (7) `recover()` non promuove più una ricevuta quando il record è assente (in R1 quel ramo aggiornava la ricevuta): ora resta bloccata. (8) Correzione documentale: i tre MD e il documento tecnico riportavano «55 prove unitarie» per R1 mentre il conteggio verificabile era 42 (35 di DS-002A più 7); allineati a 42 e portati a 53.
- **Rischi residui:** Firestore e Storage non sono atomici: la prova sull'oggetto è una lettura immediatamente precedente alla scrittura, non una transazione, e un trasporto che non riporta la dimensione restringe la prova al solo digest. `recover()` richiede ricevute canoniche: una ricevuta scritta dal candidato precedente (senza `objectSize`) resta bloccata senza migrazione implicita. Lo Storage della suite emulatore è un doppio in memoria: presenza e semantica di `digest`/`size` di Firebase Storage reale restano da provare in DS-002B, che deve implementare il contratto `probe/putIfAbsent/remove`. `firestore.rules:106-118` continua ad ammettere la scrittura diretta del proprietario su `profileDocumentAttachments` e `storage.rules:12-20` richiede il marcatore `encrypted='v1'` con 25 MiB e formati non immagine: nessuna modifica autorizzata in questo incremento. La cifratura binaria reale non è implementata (sigillo iniettato), non esistono prove su dispositivi e il candidato resta **non montato**. La riga dell'inventario per questo file di coordinamento è per costruzione leggermente stantia dopo questo rapporto.
- **Note per Codex:** le sette correzioni richieste sono tracciate punto per punto in `docs/DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md` §3.2. Le ricevute sono ora l'unica autorità di recupero: `documentAttachmentUploadReceipt` e `documentAttachmentDeleteReceipt` applicano allowlist esatta per tipo (solo l'`id` di trasporto è tollerato, e deve coincidere con `profile-document-attachment-<operationId>`), percorso ricalcolato da proprietario/documento/allegato, digest di operazione e digest dell'oggetto, `objectSize`, stato ammesso e `readyAt`/`removedAt` presenti solo nello stato che li possiede; `documentAttachmentEnvelopeEquals` confronta gli otto campi dell'envelope e il record deve essere coerente con il comando campo per campo (proprietario, documento, allegato derivato, percorso, MIME, dimensione, digest, stato). La finestra TOCTOU è resa riproducibile nel fake unitario con un hook che muta record, ricevuta o oggetto esattamente fra la prova e la transazione: caricamento, cancellazione e recupero restano bloccati senza promuovere né cancellare. Base, ramo e working tree verificati prima di iniziare; `master` `4efda528`, versione `1.2.127`, nessun deploy e nessun dato reale. **DS-002B non è stato avviato**; watcher `watch-2` attivo e affiancato da `watch-3` (polling a 20 s con confronto SHA-256, perché il tail perde il segnale quando git sostituisce il file).

## Coda approvata dal proprietario

### DS-002B — Allegati dei documenti digitali privati nell'interfaccia

Nella linguetta **Documenti digitali** del Profilo utente, accanto alle azioni Modifica e Cestino, aggiungere **Allegato**. Ogni documento deve poter avere una o più immagini del documento stesso.

Questo incarico sarà dettagliato da Codex dopo l'approvazione di DS-002A. Dovrà rispettare almeno questi vincoli già decisi negli MD:

- cifratura locale prima dell'upload;
- allegati disponibili online e non inclusi automaticamente nella cache offline;
- percorsi Storage e metadati confinati al proprietario;
- nessun URL pubblico persistente usato come autorizzazione;
- limiti di tipo, dimensione e quantità;
- anteprima e Object URL revocati alla chiusura/lock/logout;
- cancellazione coordinata fra riferimento del documento, metadati Firestore e oggetto Storage;
- nessun dato reale nei test;
- nessun riuso automatico del modello allegati Account finché compatibilità, AAD e proprietà non sono dimostrate.

**Stato coda:** IN ATTESA DI DS-002A, non ancora eseguibile.
