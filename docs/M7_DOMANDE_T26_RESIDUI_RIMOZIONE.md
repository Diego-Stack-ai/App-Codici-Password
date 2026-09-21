# M7 — Domande per Diego: residui alla rimozione di righe e Scadenze (T-26)

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T26.
> **Commit delle prove tecniche:** `7bb622b6` (banchi, censimento §5.9, riga T-26). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §5.9,
> `tests/attachment-removal-residues.test.mjs` e `tests/attachment-removal-residues.emulator.test.mjs`.

## Che cosa è stato verificato (per contesto)

Togliendo una riga dall'array `allegati` di un'Azienda o dall'array `attachments` di una
Scadenza, il riferimento sparisce al salvataggio ma **i byte restano** nello Storage: nessuno
dei due percorsi chiama primitive di cancellazione. Anche cancellando una **Scadenza** con
allegati il documento viene eliminato (transazionalmente, se collegata a un documento del
profilo) mentre gli oggetti restano. L'unico percorso che elimina i byte è l'**allegato di un
Account** nella sottocollezione `attachments` (verificato in M7-T15). In `saveDeadline`
l'upload precede la scrittura del documento e non esiste compensazione: se la scrittura
fallisce, l'oggetto appena caricato resta senza riferimento (provato su Emulator).

## Domande

1. **Q1 — Rimozione di una riga da un array.**
   Quando l'utente toglie una riga e salva, i byte vanno (a) lasciati come oggi, (b) cancellati
   subito dal client, o (c) cancellati da un job di pulizia per prefisso? Se (b): l'app deve
   cancellare **prima** o **dopo** la scrittura del documento? Cancellare prima rischia di
   lasciare una riga che punta a un oggetto assente se il salvataggio fallisce; cancellare dopo
   richiede di ricordare quali percorsi sono stati rimossi fino all'esito.

2. **Q2 — Cancellazione di una Scadenza con allegati.**
   Gli allegati della Scadenza vanno cancellati insieme al documento? Anche qui: prima della
   cancellazione (rischio: Scadenza non cancellata e allegati perduti) o dopo (rischio: orfani
   se la seconda operazione fallisce)? O si preferisce un inventario per prefisso
   `users/{uid}/scadenze/{id}/` trattato da un job?

3. **Q3 — Errore parziale.**
   Se la scrittura fallisce dopo l'upload, l'oggetto resta orfano. Va introdotta una
   **compensazione immediata** (cancellare l'oggetto appena caricato nel percorso di errore)
   oppure lasciare la pulizia al job per prefisso previsto da D4?

4. **Q4 — Rapporto con D4.**
   I residui qui descritti rientrano in **un'unica** politica dei residui (inventario per
   prefisso + pulizia, D4) o servono regole distinte per percorso (Account, Azienda
   `aziende_allegati`, Scadenze, avatar)? La scelta cambia il costo e il rischio di ogni
   percorso.

5. **Q5 — Prefissi da coprire.**
   Il prefisso `users/{uid}/aziende_allegati/` (allegati del form Azienda) e
   `users/{uid}/scadenze/{id}/` (allegati delle Scadenze) contengono oggi oggetti non
   referenziati. Il purge degli Account (§3.4) **non** li raggiunge: vanno inclusi in una
   futura pulizia per prefisso o dichiarati fuori perimetro?

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: il runtime è **invariato**,
nessuna cancellazione è stata introdotta e nessun dato reale è stato letto o creato. Le prove
tecniche sono nel commit `7bb622b6`; questo documento non le ripete e non le sostituisce.
