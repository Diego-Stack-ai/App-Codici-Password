# M6 — Domande per Diego: cache del dispositivo espulsa

> **Stato:** domande **aperte**, raccolte da DeepSeek il 22/09/2026 dopo la verifica M6-1-LAB
> (`docs/M6_SINCRONIZZAZIONE_OFFLINE.md`, sezione «M6-1-LAB — Avvio a freddo e cache espulsa»).
> **Commit delle prove tecniche:** `experiments/persistent-vault-shell/emulator-evicted-check.mjs`,
> correzione dei confini di `experiments/persistent-vault-shell/build-emulator.mjs`, comando
> `test:offline-evicted-browser`.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce
> politiche, riparazioni automatiche o nuovo comportamento. **Non duplica** le domande già raccolte
> (`M7_RETENTION_CENSIMENTO.md` D1–D16, `M8_DOMANDE_RIPRISTINO_*`, `M6_DOMANDE_FALLBACK_WEB_LOCKS.md`).

## Che cosa è stato osservato

Con il banco a freddo, dopo aver espulso la **cache applicativa** e riaperto l'app in un processo
nuovo, **offline**: la shell arriva dalla cache del browser, la cache Firestore non c'è più,
l'**identità Firebase non si ripristina**, il Vault resta chiuso, la consultazione è rifiutata con
`PROBE_SESSION`, lo stato della preparazione offline resta vuoto (`undefined`) e **nessun marcatore
privato compare**. Con la cache **intatta** lo stesso flusso ripristina l'identità e mostra l'intera
matrice bancaria (33 esiti). **Nessuna correzione** è stata introdotta.

## Domande

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

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: `Frontend/public/**`, Functions, Rules,
schema IndexedDB e dati sono **invariati**; nessun dato reale è stato letto o creato; il banco è di
laboratorio, con dati sintetici e profilo usa e getta. Il gate **M6-1 resta aperto**: la dimensione
«cache espulsa» è documentata e parzialmente esercitata, non verificata, e i collaudi fisici su
iPhone/PWA restano al proprietario. Le prove tecniche sono in un commit separato.
