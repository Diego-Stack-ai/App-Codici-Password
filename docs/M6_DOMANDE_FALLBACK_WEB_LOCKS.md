# M6 — Domande per Diego: fallback senza Web Locks e schema della coda

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M6-2
> (`docs/M6_SINCRONIZZAZIONE_OFFLINE.md`, sezione «M6-2 — Coordinatore ibrido dietro l'interfaccia
> della coda»).
> **Commit delle prove tecniche:** banco `experiments/offline-sync/browser-runtime-lease.mjs`, runner
> `experiments/offline-sync/run-browser-tests.mjs`, comando `test:offline-runtime-lease`.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> politiche, attivazioni, migrazioni o rollout. **Non duplica** le domande già raccolte nei file
> M7/M8 (`M7_RETENTION_CENSIMENTO.md` D1–D16, `M8_DOMANDE_RIPRISTINO_*`): riguarda il coordinamento
> della coda offline.

## Che cosa è stato osservato

Sul percorso reale, con il candidato di laboratorio iniettato nell'interfaccia della coda
(`withOfflineQueueLease` / `withLease`) e `navigator.locks` realmente assente, l'interfaccia si
comporta come previsto: esecuzione sotto il lease IndexedDB, esclusione reciproca fra titolari
distinti, rilascio dopo errore, `HYBRID_ACQUIRE_TIMEOUT` con task mai eseguito e lease tardivo
rilasciato senza effetti, `OFFLINE_QUEUE_BUSY` dalla coda reale. **Il runtime distribuito però non usa
il fallback**: rifiuta con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE`, e la coda è in **versione 1** con il solo
store `encryptedOperations` — **manca lo store `queueLeases`** su cui il fallback si appoggia.
**Nessuna correzione** è stata introdotta e `Frontend/public/**` è invariato.

## Domande

1. **Q1 — Adozione del fallback e schema IndexedDB.**
   Adottare il fallback richiede di aggiungere lo store `queueLeases` alla coda distribuita, cioè un
   **aggiornamento di schema** su copie PWA già installate (e il lettore v1 del laboratorio rifiuta lo
   schema 2, quindi l'ordine di aggiornamento conta). Quale strategia: (a) aggiornamento coordinato con
   rilascio preparatorio e ordine client/backend definito; (b) mantenere il rifiuto **fail-closed**
   attuale finché non esiste un rilascio coordinato; (c) non adottare il fallback e dichiarare che su
   quei browser la coda offline non è disponibile? Chi prepara la matrice di compatibilità delle copie
   installate?

2. **Q2 — Che cosa deve fare un browser senza Web Locks.**
   Oggi su quei browser il percorso della coda **fallisce chiuso** (`OFFLINE_QUEUE_LOCKS_UNAVAILABLE`):
   è il comportamento accettato e dichiarato all'utente (che resta quindi online), oppure il fallback
   è un **requisito di prodotto** per il salvataggio offline? Se è un requisito, quale messaggio deve
   vedere l'utente quando il fallback non è ancora adottato, e chi approva il testo (D6)?

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: formato, schema IndexedDB, coda, Rules,
Functions e runtime sono **invariati**; nessun dato reale è stato letto o creato; le due mutazioni di
discriminazione sono state eseguite su file di laboratorio e su un file di produzione **ripristinato
con hash identico a `HEAD`**. Il finding `F2-P1-07` **resta aperto**: questo lavoro fa avanzare
l'evidenza di laboratorio, non chiude l'adozione, la distribuzione né i collaudi fisici.
