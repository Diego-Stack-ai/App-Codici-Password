# M7 — Domande per Diego: copie di consultazione (T-24)

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T24.
> **Commit delle prove tecniche:** `9ae8445a` (banco, censimento §6.6, riga T-24). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §6.6 e `tests/consultation-copies.test.mjs`.

## Che cosa è stato verificato (per contesto)

I due report dell'app sono **solo in memoria**: il report «salute credenziali» non produce file
e azzera i risultati quando il modale si chiude, e non mostra mai una password; il report «uso
dei campi» esclude gli Account archiviati (contandoli) e non usa Blob, download o archivi
locali. Le copie che invece **escono dall'app** sono file dell'utente: il backup `.cpbackup` e
le vCard `.vcf` (profilo, contatto aziendale, tessera ricevuta), oltre a tutto ciò che l'utente
salva per conto proprio (screenshot, stampa, PDF esterni). L'app non conserva alcun handle di
quei file e non esiste alcun percorso che li ritiri.

Dopo il **purge** di un Account: un export o un report **nuovo** che legge le sorgenti
confermate non contiene più quell'Account; un report rigenerato **dalla cache locale**
(offline, o quando la lettura confermata non risponde) **può** ancora contenerlo; un file già
esportato prima del purge resta per definizione. Non esistono export Excel, PDF o di stampa
nell'app distribuita: l'unica proiezione Excel è di laboratorio e non è montata.

## Domande

1. **Q1 — Copie già esportate.**
   Che cosa ci si aspetta dall'app per un `.cpbackup` o una `.vcf` già scaricati prima del
   purge? (a) nulla: file dell'utente, fuori perimetro; (b) un avviso al momento dell'export
   («questa copia non sarà cancellabile dal servizio»); (c) una dichiarazione nel testo di
   privacy/termini. Quale?

2. **Q2 — Un avviso al momento del purge.**
   Quando l'utente elimina definitivamente un Account, la UI deve ricordare che le copie
   esportate e i file salvati restano? Se sì, chi approva il testo?

3. **Q3 — Rigenerazione dalla cache.**
   Un report rigenerato offline può ancora includere un Account purgato, perché legge la cache
   locale. Va (a) accettato e documentato, (b) bloccato (il report richiede la connessione),
   o (c) segnalato all'utente («dati da copia locale, potenzialmente non aggiornati»)?

4. **Q4 — Copie di consultazione dell'app: conferma del «solo memoria».**
   Confermi che i report dell'app devono restare **solo in memoria** (nessun export, nessuna
   stampa, nessun salvataggio), oppure in futuro servirà un export esplicito — con quali
   contenuti e con quali mascheramenti?

5. **Q5 — Excel/PDF.**
   L'assenza di export Excel/PDF/stampa è una scelta definitiva o una funzione prevista? Se
   prevista, va progettata con mascheramento dei campi sensibili come nella proiezione di
   laboratorio?

6. **Q6 — Rapporto con D4/D5 e con le domande della cache (D10).**
   Le copie di consultazione rientrano nella politica dei residui (D4) e nella dichiarazione
   sui backup (D5), oppure sono una voce autonoma? La cancellazione/avviso deve essere
   **automatica**, **proposta** all'utente o **documentata soltanto**?

7. **Q7 — Diagnostica prestazioni.**
   I campioni della diagnostica prestazioni restano in `localStorage` finché non vengono
   cancellati esplicitamente. Vanno cancellati al logout (come chiesto per la cache in D10) o
   è accettabile che restino?

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: il runtime è **invariato**,
nessuna cancellazione è stata introdotta e nessun file reale è stato creato o letto. Le prove
tecniche sono nel commit `9ae8445a`; questo documento non le ripete e non le sostituisce.
