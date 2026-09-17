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
- **Stato incarico:** DA_VERIFICARE
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
