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

## Incarico attivo

- **ID:** DS-001
- **Stato incarico:** DA_VERIFICARE
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

## Coda approvata dal proprietario

### DS-002 — Allegati dei documenti digitali privati

Nella linguetta **Documenti digitali** del Profilo utente, accanto alle azioni Modifica e Cestino, aggiungere **Allegato**. Ogni documento deve poter avere una o più immagini del documento stesso.

Questo incarico sarà dettagliato da Codex dopo DS-001 e dopo la verifica del modello dati. Dovrà rispettare almeno questi vincoli già decisi negli MD:

- cifratura locale prima dell'upload;
- allegati disponibili online e non inclusi automaticamente nella cache offline;
- percorsi Storage e metadati confinati al proprietario;
- nessun URL pubblico persistente usato come autorizzazione;
- limiti di tipo, dimensione e quantità;
- anteprima e Object URL revocati alla chiusura/lock/logout;
- cancellazione coordinata fra riferimento del documento, metadati Firestore e oggetto Storage;
- nessun dato reale nei test;
- nessun riuso automatico del modello allegati Account finché compatibilità, AAD e proprietà non sono dimostrate.

**Stato coda:** DA_PROGETTARE, non ancora eseguibile.
