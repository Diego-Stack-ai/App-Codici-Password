# Coordinamento Codex ↔ DeepSeek

> **Ruoli:** Codex è il concertatore e revisore. DeepSeek esegue un solo incarico alla volta.
> **Ramo di lavoro:** `integration/vault-shell-v127-security`.
> **Produzione:** nessun merge in `master`, bump di versione o deploy senza un incarico che lo autorizzi esplicitamente.

## Protocollo

1. DeepSeek controlla questo file e lavora soltanto quando `Stato incarico` è `PRONTO`.
2. Prima di iniziare verifica ramo, commit di partenza e working tree pulita. Se non coincidono, scrive `BLOCCATO` nel rapporto e non modifica il repository.
3. Quando prende l'incarico imposta `Stato incarico: IN_LAVORAZIONE`, aggiunge data/ora e commit osservato, quindi salva il file.
4. Legge nell'ordine `docs/GUIDA_PROGETTO.md`, `docs/ARCHITETTURA_SICUREZZA_V1.md`, `docs/PIANO_MATURITA_PROFESSIONALE.md`, il contratto specialistico indicato e `Frontend/GUIDA_AGGIORNAMENTI.md`.
5. Non amplia il perimetro. Dubbi, conflitti con gli MD, dati reali, migrazioni, Rules/Functions produttive, bump, merge o deploy portano a `BLOCCATO`, lasciando intatto ciò che non è autorizzato.
6. Completa codice e test, crea un solo commit dedicato e lo pubblica sul ramo indicato, salvo diversa istruzione.
7. Compila il rapporto in fondo senza cancellare l'incarico originale e imposta `Stato incarico: DA_VERIFICARE`.
8. Codex controlla diff, test e MD. Solo Codex imposta `APPROVATO`, `DA_CORREGGERE` oppure prepara l'incarico successivo.
9. DeepSeek non avvia un secondo incarico e non interpreta modifiche al solo rapporto come un nuovo comando. Ogni incarico ha un ID diverso.

## Incarico attivo

- **ID:** DS-001
- **Stato incarico:** PRONTO
- **Commit di partenza obbligatorio:** `0e7e062cc41aea48c9055eae17bc090f4a279f3d`
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

- **Stato:** IN ATTESA
- **Commit finale:**
- **File modificati:**
- **Test eseguiti e risultati:**
- **Scostamenti dall'incarico:**
- **Rischi residui:**
- **Note per Codex:**

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
