# M8 — Domande per Diego: ripristino interrotto fra record e allegati

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M8.
> **Commit delle prove tecniche:** `425e68d0` (banco, aggiornamento di `docs/M8_BACKUP_RECUPERO.md`, runner e registrazione).
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> staging, compensazione, retry o nuove politiche. **Contesto:** `docs/M8_BACKUP_RECUPERO.md`
> (gate «dimostrare assenza di riferimenti orfani», ora dichiarato **non chiuso**) e
> `tests/interrupted-restore-orphan-refs.emulator.test.mjs`.

## Che cosa è stato osservato

Con il percorso reale `executeBackupRestore` su emulatori (dati sintetici): i **record** vengono
applicati a blocchi **prima** degli upload; se un `uploadBytes` fallisce, il piano si blocca
(`BACKUP_STORAGE_RETRY_BLOCKED`) e in Firestore resta il **riferimento** all'allegato **senza i
byte** in Storage (`storage/object-not-found`). Il caso è complementare a quello già dichiarato
nel documento M8 («byte senza riferimento», riga 120). Il controllo positivo (upload riuscito)
mostra riferimento e byte coerenti. **Nessuna correzione è stata introdotta.**

## Domande

1. **Q1 — Come chiudere il buco fra record e byte.**
   (a) **Staging**: caricare i byte **prima** di scrivere il record, così un fallimento non lascia
   riferimenti; (b) **compensazione**: cancellare il riferimento se l'upload fallisce; (c)
   **ripresa**: rendere riprovabile il piano bloccato e completare gli upload mancanti; (d)
   lasciare com'è e documentare il limite. Quale?

2. **Q2 — Il caso inverso.**
   Con lo staging (o con un upload riuscito e record non scritto) si creano **byte senza
   riferimento**. Vanno accettati e dichiarati, marcati in qualche modo, o puliti da un job per
   prefisso (D4)?

3. **Q3 — Il piano bloccato.**
   Oggi, dopo un errore in fase `storage`, il piano è **bloccato** e un nuovo tentativo è
   rifiutato: l'utente deve rifare l'intero ripristino. Va reso riprovabile (retry esplicito dei
   soli upload mancanti) o è accettabile così?

4. **Q4 — Che cosa vede l'utente.**
   Un allegato con riferimento senza byte va segnalato nell'interfaccia (es. «allegato non
   disponibile: ripristino incompleto») o resta invisibile finché non lo si apre? Chi approva il
   testo (D6)?

5. **Q5 — Rapporto con le decisioni esistenti.**
   Questa voce è autonoma o rientra in **D5** (backup e ricevute) e **D16** (ripristino dopo un
   purge)? Il gate M8 resta **aperto** finché non c'è una decisione.

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: formato, import, export, Rules e
runtime sono **invariati**; nessun dato o backup reale è stato letto o creato. Le prove tecniche
sono nel commit `425e68d0`; questo documento non le ripete e non le sostituisce.
