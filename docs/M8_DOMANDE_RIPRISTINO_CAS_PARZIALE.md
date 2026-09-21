# M8-ter — Domande per Diego: modifica dopo l'anteprima e ripristino parziale

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica «modifiche
> intervenute dopo l'anteprima» (ultima parte del sotto-gate `docs/M8_BACKUP_RECUPERO.md:59`).
> **Commit delle prove tecniche:** `tests/restore-stale-preview.emulator.test.mjs`,
> `scripts/run-restore-stale-emulators.mjs`, aggiornamento di `docs/M8_BACKUP_RECUPERO.md`.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> politiche, compensazioni, staging o retry.
> **Non duplica** le domande già raccolte: `docs/M8_DOMANDE_RIPRISTINO_INTERROTTO.md` (Q1-Q5,
> buco fra record e byte e piano bloccato), `docs/M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md`
> (N1-N4, riapertura dello stesso backup). Qui il caso è diverso: **il ripristino si ferma perché
> i dati sono cambiati dopo l'anteprima**, non perché un upload è fallito.

## Che cosa è stato osservato

Sul percorso reale (client di produzione + callable reale, emulatori Firestore/Storage, dati
sintetici):

- **un blocco**: la modifica concorrente dopo l'anteprima fa rifiutare il blocco
  (`BACKUP_PREVIEW_STALE`) **senza** scrivere dati, ricevute o audit e **senza** upload; il valore
  concorrente sopravvive e il piano viene invalidato;
- **più blocchi** (403 record → blocchi da 400 e 3): il primo blocco viene **applicato** (con
  ricevuta e audit) e il secondo è rifiutato: il ripristino resta **parziale**. Poiché la fase
  Storage parte solo dopo **tutti** i blocchi, il metadato dell'allegato applicato nel primo blocco
  resta **senza byte** (`storage/object-not-found`): il rifiuto del controllo di versione **crea**
  un riferimento orfano, come già osservato per l'upload fallito.

**Nessuna correzione è stata introdotta.**

## Domande

1. **S1 — La fase Storage nei flussi a più blocchi.**
   Oggi gli upload partono solo dopo che **tutti** i blocchi sono stati applicati: se un blocco
   successivo viene rifiutato, i record già applicati restano senza i loro byte. I byte vanno
   caricati **blocco per blocco** man mano che i blocchi vengono applicati, oppure lo stato parziale
   va accettato e dichiarato? (La Q1 di `M8_DOMANDE_RIPRISTINO_INTERROTTO.md` riguarda lo staging e
   la compensazione dopo un **upload fallito**; qui il trigger è il rifiuto del controllo di
   versione e la domanda è sull'**ordine della fase Storage** rispetto ai blocchi.)

2. **S2 — Che cosa vede l'utente in un ripristino parziale per dati cambiati.**
   Con blocchi già applicati, la UI mostra il messaggio generico «Ripristino interrotto: alcuni dati
   potrebbero essere già stati applicati» (`impostazioni.js:507-510`) e resta **una** ricevuta e
   **un** audit del blocco applicato. Va indicato esplicitamente **quanto** è stato applicato (quali
   blocchi, quali ricevute, quali allegati restano senza byte) e chi approva il testo (D6)? La Q4 di
   `M8_DOMANDE_RIPRISTINO_INTERROTTO.md` riguarda l'allegato senza byte in generale; qui si chiede se
   il **ripristino parziale da modifica concorrente** merita una segnalazione propria.

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: formato, import, export, Rules e
runtime sono **invariati**; nessun dato o backup reale è stato letto o creato; il codice di
produzione è stato mutato **solo** per il controllo di discriminazione (esito del CAS reso vuoto) e
poi ripristinato con hash identico a `HEAD`. Le prove tecniche sono in un commit separato; questo
documento non le ripete e non le sostituisce. **M8 resta aperto**: questo caso non conclude l'intero
gate.
