# M7 — Domande per Diego: cache del dispositivo (T-23)

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T23.
> **Commit delle prove tecniche:** `2422e0b1` (banco, censimento §6.5, riga T-23). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §6.5 e `tests/device-cache-residues.test.mjs`.

## Che cosa è stato verificato (per contesto)

Dopo un **logout** il client azzera soltanto la sessione Vault in `sessionStorage`. Restano
materialmente sul dispositivo: `localStorage` (envelope e verifier cifrati del Vault, URL
avatar, tema, ambiti push, marcatore offline con TTL valutato alla lettura), la **cache
persistente Firestore** in IndexedDB (documenti sincronizzati: campi cifrati **e** metadati
leggibili), la **coda offline** in IndexedDB (operazioni sigillate AES-GCM), la **Cache
Storage** della shell PWA (solo risorse stessa-origine; nessuna risposta di backend) e le
bozze utente in `sessionStorage` della stessa scheda. Dopo il **purge** di un Account non
esiste alcun percorso client che evacui la cache locale: il client invoca la callable del
backend e non tocca IndexedDB, Cache Storage o `localStorage`.

Nessuna primitiva distruttiva (`clearIndexedDbPersistence`, `indexedDB.deleteDatabase`,
`localStorage.clear`, `sessionStorage.clear`) esiste nel runtime del client; `caches.delete`
compare solo nel service worker, per le proprie versioni di shell non correnti.

## Domande

1. **Q1 — Che cosa deve sparire al logout?**
   Oggi: solo la sessione Vault (RAM + `sessionStorage`), con blocco del gate e marcatore di
   diniego. Alternative: (a) lasciare tutto com'è (attuale); (b) svuotare anche la cache
   Firestore locale e la Cache Storage al logout; (c) svuotare soltanto i metadati leggibili
   della cache Firestore. Quale comportamento vuoi? (b) rende l'app inutilizzabile offline
   dopo ogni logout; (c) è più costoso da realizzare di (b).

2. **Q2 — Che cosa deve sparire dopo il purge di un Account?**
   Oggi: nulla sul dispositivo. Alternative: (a) nessuna azione locale (attuale);
   (b) il client evacua dalla cache locale i documenti dell'Account purgato dopo l'esito
   `purged`; (c) un comando di pulizia locale separato, esplicito per l'utente
   («rimuovi le copie locali»). Quale?

3. **Q3 — Residui cifrati: vanno trattati come dato da cancellare o come dato protetto?**
   La coda offline contiene operazioni **sigillate** con la Vault Key, e `localStorage`
   contiene l'envelope cifrato della chiave Vault. Sono dati materialmente presenti ma
   inutilizzabili senza la Master Password. Vanno cancellati al logout comunque, oppure
   dichiarati come copie cifrate ammesse?

4. **Q4 — Bozze utente in `sessionStorage`.**
   Le bozze (`profile-account-link-draft`, `profile-deadline-link-draft`,
   `pending_deadline_link`) sopravvivono al logout nella stessa scheda. Vanno azzerate al
   logout o è accettabile che restino finché la scheda è aperta?

5. **Q5 — Trasparenza verso l'utente.**
   Serve un'informazione esplicita («i dati restano su questo dispositivo finché non esci e
   non svuoti i dati del browser»)? Se sì, chi approva il testo?

6. **Q6 — Rapporto con D4/D5 del censimento.**
   La pulizia della cache locale è parte della politica dei residui (D4: oggetti e copie
   residue) o è una voce separata? La cancellazione locale deve essere **automatica**,
   **proposta** all'utente o **documentata soltanto**?

7. **Q7 — Prova richiesta.**
   La verifica attuale è di livello codice con archivi simulati (nessun browser). Per
   dichiarare la politica «verificata» è sufficiente, oppure serve una prova su browser
   sintetico/emulato (IndexedDB e Cache API reali) prima della decisione?

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: il runtime è **invariato** e
nessuna cancellazione della cache è stata introdotta. Le prove tecniche sono nel commit
`2422e0b1`; questo documento non le ripete e non le sostituisce.
