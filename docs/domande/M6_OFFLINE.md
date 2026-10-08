# M6 offline

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Stato delle domande (successione riconciliata)

| Raccolta originale | Domanda | Stato corrente e residuo |
|---|---|---|
| Cache espulsa | Q1 → M6-C1 | DECISA la comunicazione; verifica della causa su dispositivo reale ancora richiesta |
| Cache espulsa | Q2 → M6-C2 | DECISA la ripreparazione quando possibile, con sessione valida e senza estendere il timer; attuazione e prove separate |
| Cache espulsa | Q3 → M6-C3 | APERTA; non confondere perdita di identità offline con duplicati della coda |
| Fallback Web Locks | Q1 → M6-F1 | DECISA la strategia additiva A; adozione, compatibilità e rollout restano da completare |
| Fallback Web Locks | Q2 → M6-F2 | DECISA la regola dei messaggi per operazione; formulazioni definitive da produrre |
| PWA precedente | M6-F3 | PARZIALE: avviso di aggiornamento deciso, conservazione pendenti obbligatoria; gate PWA e rilascio aperti |

Fonte primaria della successione: [DECISIONI](../progetto/DECISIONI.md). Le domande originali sotto rimangono per contesto; l’etichetta iniziale “aperte” non rappresenta più tutte le singole voci.

## Indice delle fonti conservate

- [M6_DOMANDE_CACHE_ESPULSA.md](#fonte-docs-m6-domande-cache-espulsa-md-l1)
- [M6_DOMANDE_FALLBACK_WEB_LOCKS.md](#fonte-docs-m6-domande-fallback-web-locks-md-l1)

<a id="fonte-docs-m6-domande-cache-espulsa-md-l1"></a>

## Fonte: M6_DOMANDE_CACHE_ESPULSA.md — righe originali 1–48

> Provenienza: `docs/M6_DOMANDE_CACHE_ESPULSA.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m6-domande-cache-espulsa-md-m6--domande-per-diego-cache-del-dispositivo-espulsa"></a>

## M6 — Domande per Diego: cache del dispositivo espulsa

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 22/09/2026 dopo la verifica M6-1-LAB
> (`docs/M6_SINCRONIZZAZIONE_OFFLINE.md`, sezione «M6-1-LAB — Avvio a freddo e cache espulsa»).
> **Commit delle prove tecniche:** `experiments/persistent-vault-shell/emulator-evicted-check.mjs`,
> correzione dei confini di `experiments/persistent-vault-shell/build-emulator.mjs`, comando
> `test:offline-evicted-browser`.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> politiche, riparazioni automatiche o nuovo comportamento. **Non duplica** le domande già raccolte
> (`M7_RETENTION_CENSIMENTO.md` D1–D16, `M8_DOMANDE_RIPRISTINO_*`, `M6_DOMANDE_FALLBACK_WEB_LOCKS.md`).

<a id="fonte-docs-m6-domande-cache-espulsa-md-che-cosa-è-stato-osservato"></a>

### Che cosa è stato osservato

Con il banco a freddo, dopo aver espulso la **cache applicativa** e riaperto l'app in un processo
nuovo, **offline**: la shell arriva dalla cache del browser, la cache Firestore non c'è più,
l'**identità Firebase non si ripristina**, il Vault resta chiuso, la consultazione è rifiutata con
`PROBE_SESSION`, lo stato della preparazione offline resta vuoto (`undefined`) e **nessun marcatore
privato compare**. Con la cache **intatta** lo stesso flusso ripristina l'identità e mostra l'intera
matrice bancaria (33 esiti). **Nessuna correzione** è stata introdotta.

<a id="fonte-docs-m6-domande-cache-espulsa-md-domande"></a>

### Domande

1. **Q1 — Che cosa deve vedere l'utente quando la cache è stata espulsa.**
   Oggi l'app non distingue «dati offline assenti perché la cache del dispositivo è stata espulsa» da
   «nessun dato»: lo stato della preparazione resta vuoto e la lettura semplicemente non riesce. Va
   introdotto un esito esplicito (per esempio «i dati preparati per l'uso offline non sono più
   disponibili: riconnettiti per prepararli di nuovo»), e chi approva il testo (D6)?

2. **Q2 — Ripreparazione automatica al ritorno della connessione.**
   Quando la cache è stata espulsa, deve bastare che l'utente torni online perché l'app **ripari**
   da sola i dati offline (ripreparazione automatica, con indicazione di stato), oppure la
   ripreparazione resta una conseguenza implicita della normale navigazione? Se è automatica, va
   limitata a una condizione (per esempio solo dopo sblocco riuscito) per non scaricare dati senza
   sessione?

3. **Q3 — Identità e cache applicativa sullo stesso dispositivo.**
   Nel banco l'espulsione della cache applicativa coincide con la mancata persistenza dell'identità
   offline: non è chiaro se sia una proprietà del prodotto o un effetto del laboratorio. Va
   verificato su dispositivo fisico prima di decidere se l'utente debba poter **sbloccare il Vault
   offline** anche quando la cache dei dati è stata espulsa?

<a id="fonte-docs-m6-domande-cache-espulsa-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: `Frontend/public/**`, Functions, Rules,
schema IndexedDB e dati sono **invariati**; nessun dato reale è stato letto o creato; il banco è di
laboratorio, con dati sintetici e profilo usa e getta. Il gate **M6-1 resta aperto**: la dimensione
«cache espulsa» è documentata e parzialmente esercitata, non verificata, e i collaudi fisici su
iPhone/PWA restano al proprietario. Le prove tecniche sono in un commit separato.

<a id="fonte-docs-m6-domande-fallback-web-locks-md-l1"></a>

## Fonte: M6_DOMANDE_FALLBACK_WEB_LOCKS.md — righe originali 1–47

> Provenienza: `docs/M6_DOMANDE_FALLBACK_WEB_LOCKS.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m6-domande-fallback-web-locks-md-m6--domande-per-diego-fallback-senza-web-locks-e-schema-della-coda"></a>

## M6 — Domande per Diego: fallback senza Web Locks e schema della coda

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M6-2
> (`docs/M6_SINCRONIZZAZIONE_OFFLINE.md`, sezione «M6-2 — Coordinatore ibrido dietro l'interfaccia
> della coda»).
> **Commit delle prove tecniche:** banco `experiments/offline-sync/browser-runtime-lease.mjs`, runner
> `experiments/offline-sync/run-browser-tests.mjs`, comando `test:offline-runtime-lease`.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> politiche, attivazioni, migrazioni o rollout. **Non duplica** le domande già raccolte nei file
> M7/M8 (`M7_RETENTION_CENSIMENTO.md` D1–D16, `M8_DOMANDE_RIPRISTINO_*`): riguarda il coordinamento
> della coda offline.

<a id="fonte-docs-m6-domande-fallback-web-locks-md-che-cosa-è-stato-osservato"></a>

### Che cosa è stato osservato

Sul percorso reale, con il candidato di laboratorio iniettato nell'interfaccia della coda
(`withOfflineQueueLease` / `withLease`) e `navigator.locks` realmente assente, l'interfaccia si
comporta come previsto: esecuzione sotto il lease IndexedDB, esclusione reciproca fra titolari
distinti, rilascio dopo errore, `HYBRID_ACQUIRE_TIMEOUT` con task mai eseguito e lease tardivo
rilasciato senza effetti, `OFFLINE_QUEUE_BUSY` dalla coda reale. **Il runtime distribuito però non usa
il fallback**: rifiuta con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE`, e la coda è in **versione 1** con il solo
store `encryptedOperations` — **manca lo store `queueLeases`** su cui il fallback si appoggia.
**Nessuna correzione** è stata introdotta e `Frontend/public/**` è invariato.

<a id="fonte-docs-m6-domande-fallback-web-locks-md-domande"></a>

### Domande

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

<a id="fonte-docs-m6-domande-fallback-web-locks-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: formato, schema IndexedDB, coda, Rules,
Functions e runtime sono **invariati**; nessun dato reale è stato letto o creato; le due mutazioni di
discriminazione sono state eseguite su file di laboratorio e su un file di produzione **ripristinato
con hash identico a `HEAD`**. Il finding `F2-P1-07` **resta aperto**: questo lavoro fa avanzare
l'evidenza di laboratorio, non chiude l'adozione, la distribuzione né i collaudi fisici.
