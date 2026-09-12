# M6 — Sincronizzazione e scritture offline

> **Stato:** cutover privato isolato attivo; consultazione offline completa non certificata.
> **Autorità:** contratto specialistico e registro prove; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** coda, conflitti e consultazione offline.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

Le tappe di adozione e le checkbox registrano la sequenza storica; lo stato corrente è il perimetro del primo cutover descritto in fondo. La flag disattivata del client generico non disattiva l'adattatore privato, che passa esplicitamente `enabled: true`. Il codice della coda richiede Web Locks: se l'API manca restituisce `OFFLINE_QUEUE_LOCKS_UNAVAILABLE`; il fallback previsto dal contratto resta da realizzare e collaudare. Queste precisazioni non estendono i domini abilitati e non chiudono il gate bancario.

> **Esito vincolante:** il test iPhone del 10/09/2026 con Account bancario non ha superato la consultazione offline. Nessun altro esito “verde” può essere interpretato come certificazione dell’offline completo finché quel flusso e la matrice prevista non sono superati.

## Stato iniziale

L'app usa la cache persistente multi-tab di Firestore e preriscalda le raccolte principali. Le letture offline sono quindi parzialmente operative, ma la coda implicita dell'SDK non offre all'interfaccia un contratto esplicito per revisione, idempotenza, conflitto o recupero dopo chiusura forzata.

## Contratto candidato

- ogni record modificabile possiede una `revision` intera crescente;
- ogni comando possiede `operationId`, `deviceId`, `recordId`, `expectedRevision` e modifiche;
- la coda conserva solo contenitori AES-GCM autenticati, mai payload in chiaro;
- la chiave della coda deriva dalla sessione Vault e non è conservata insieme alla coda;
- il backend conserva l'esito per `operationId`, rendendo sicure le ripetizioni;
- una scrittura passa solo se `expectedRevision` coincide con il server;
- un conflitto non produce merge impliciti: l'utente mantiene il server oppure ripropone consapevolmente la modifica;
- tab e dispositivi differenti seguono lo stesso controllo.

Gli stati UI previsti sono: `salvato`, `in attesa offline`, `sincronizzazione`, `conflitto`, `errore recuperabile`. Logout, reset Vault e cambio utente non devono rendere la coda leggibile da un altro account.

## Adozione

1. mantenere le letture offline correnti;
2. introdurre revisione e callable idempotente su un dominio non critico;
3. aggiungere IndexedDB cifrato e coordinamento Web Locks/BroadcastChannel con fallback;
4. collaudare modalità aereo, chiusura forzata, due tab e due dispositivi;
5. estendere un dominio per volta, iniziando dai dati non condivisi;
6. integrare record condivisi soltanto dopo il cutover M5.

Il laboratorio `experiments/offline-sync` dimostra cifratura e autenticità della coda, idempotenza, conflitto fra dispositivi, scelta esplicita e ripristino dopo serializzazione. Non è collegato al runtime e non modifica dati reali.

## Gate

- [x] modello versione/revisione del record;
- [x] contenitore di coda cifrato e autenticato;
- [x] idempotenza per `operationId`;
- [x] conflitto esplicito tra due dispositivi;
- [x] simulazione modalità aereo, chiusura e ritorno online;
- [x] lease multi-tab con subentro soltanto dopo scadenza;
- [x] isolamento degli esiti idempotenti per utente;
- [x] Rules candidate: lettura puntuale del proprietario e scritture esclusivamente backend;
- [x] modulo runtime IndexedDB cifrato, Web Locks e BroadcastChannel implementato e testato, non ancora collegato ai form;
- [x] callable idempotente implementata, validata e protetta da App Check; Rules candidate testate, client non collegato;
- [x] orchestratore client sotto lock con stati UI, arresto sul conflitto e retry recuperabile;
- [x] adattatore runtime collega coda, lease, BroadcastChannel e callable reale; flag predefinita disattivata e nessun form ancora instradato;
- [x] callable pilota separata per Account privati semplici: percorso confinato allo UID, soli record `account/private` non bancari, ciphertext obbligatorio, revisione e idempotenza;
- [x] form Account privato instradato soltanto con parametro esplicito `m6pilot=1`; account condivisi, memorandum, banca, allegati e collegamenti Profilo restano sul percorso stabile;
- [x] collaudo fisico Chrome: salvataggio online, accodamento cifrato offline, chiusura pagina, ritorno online e sincronizzazione automatica completati senza reinserire il record;
- [x] campi sensibili facoltativi accettano soltanto stringa vuota o ciphertext; errore recuperabile distinto dal salvataggio confermato;
- [x] secondo salvataggio bloccato dopo che la modifica offline è già stata accodata;
- [x] collaudo fisico Chrome–Edge: una revisione offline obsoleta viene bloccata dopo una modifica online più recente, senza sovrascrittura silenziosa;
- [x] risoluzione visiva collaudata: mantenimento server e recupero locale nel modulo avvengono soltanto su scelta esplicita dell'utente;
- [x] collaudo fisico iPhone: modifica cifrata conservata offline, sincronizzata al ritorno della connessione e mostrata nella lista senza refresh manuale;
- [x] cutover controllato: il normale salvataggio usa M6 per Account privati e memorandum privati isolati; condivisioni, banca e collegamenti Profilo richiedono la connessione;
- [x] i form online acquisiscono la revisione confermata dal server prima della modifica; i salvataggi legacy complessi incrementano la stessa revisione;
- [x] un conflitto appartenente a un altro record non blocca l'utente senza indicazioni: la UI apre il modulo del record corretto senza eliminare la coda;
- [x] il form con una scrittura già accodata intercetta il ritorno online e riavvia automaticamente il bootstrap di sincronizzazione;

## Perimetro del primo cutover

M6 è attivo per creazione e modifica di Account privati semplici e memorandum privati isolati. Gli allegati già associati restano conservati e continuano a seguire il proprio flusso stabile: il cutover non accoda, modifica o cancella allegati. Account e memorandum condivisi, dati bancari e collegamenti diretti ai campi Profilo possono essere modificati soltanto online e saranno migrati soltanto con collaudi dedicati.

La consultazione offline resta distinta dalla modifica offline. Il prossimo gate fisico verifica in particolare l'apertura senza rete dei dati bancari già memorizzati. Per gli allegati, la lista può provenire dalla cache Firestore, mentre il contenuto cifrato su Storage non è garantito offline finché non sarà introdotta una cache locale esplicita con limiti di spazio.

Il 10/09/2026 la prova fisica su telefono ha confermato che un Account bancario aperto integralmente online non era poi raggiungibile dalla lista Account dopo il distacco della rete: la lista risultava vuota/non disponibile. Il risultato non viene conteggiato come regressione della coda M6, già certificata per le scritture private isolate, ma come gate separato non superato della consultazione offline reale. La relativa revisione deve partire dalla disponibilità della lista e dalla preparazione deterministica della cache, prima di provare PIN, CCV o allegati. Non va mascherata con fallback grafici né usata per estendere ora le mutazioni offline bancarie.

M6 resta attiva finché runtime e backend non dimostrano che nessuna scrittura può essere persa o sovrascritta silenziosamente.

Prova locale della nuova sessione, base `6432cad8`: aggiornamento cifrato sperimentale attraverso il contratto M6 e il backend originale emulato. Non è un nuovo cutover o collaudo della coda offline; restano verifiche delle relazioni correnti e compatibilità dei lettori. [Audit §26](./AUDIT_VAULT_SESSION_P0.md#26-preparazione-m6-e-transazione-originale-su-dati-emulati--12092026).

Verifica sul codice corrente, 12/09/2026: il wildcard proprietario delle Rules include operationResults anche in scrittura; la callable può accettare un esito precedente con dominio/recordId compatibili senza applicare il payload. La riconciliazione sperimentale non certifica la provenienza backend. Questo finding resta un gate, distinto dalle prove storiche della coda. [Audit §29](./AUDIT_VAULT_SESSION_P0.md#29-esito-incerto-retry-e-verifica-del-salvataggio--12092026).

Candidato locale successivo, base `a795b462`: esiti privati/offline generici nel nuovo namespace backend `/mutationResults/{uid}/operations/{operationId}`, con controllo del payload e dell'identità prima del retry. Il vecchio namespace resta leggibile e viene chiuso alle scritture client; gli esiti pregressi non sono promossi ad attestazioni. Nessun deploy: recupero delle code legacy e rollback compatibile devono precedere l'attivazione. [Audit §32](./AUDIT_VAULT_SESSION_P0.md#32-provenienza-e-identità-degli-esiti-di-salvataggio--12092026).


### Controllo candidato dei riferimenti inversi — 12/09/2026

Base `1ce18fe2`, ramo sperimentale. La mutazione privata legge nella stessa transazione il Profilo `users/{uid}` e tutti i documenti diretti `users/{uid}/aziende`. Controlla `contactEmails`, `contactPhones`, `documenti`, `userAddresses[].utilities`, le email aziendali fisse/extra e `phoneAccountLinks`; `linkedAccountCompanyId` assente o vuoto identifica il riferimento privato. Contatti senza valore e aziende archiviate sono inclusi. I backlink nel solo Account non erano sufficienti.

Il percorso ridotto rifiuta dati malformati e un campo legacy `id` diverso dall'ID fisico, senza migrare alias. Un retry con ricevuta attendibile viene risolto prima di queste letture e non riscrive il record. L'esito legacy non verificabile resta distinto. I test sintetici dell'handler coprono riferimenti inversi, separazione dal namespace aziendale, alias e assenza di scritture dopo rifiuto.

Costo: per ogni operazione nuova si aggiungono il Profilo e la query completa delle aziende; letture, dimensione e contesa crescono con il numero delle aziende. La soluzione non tronca la query per dichiarare falsamente assenti i link. Valutazione di scala e latenza prima del rilascio; altri domini e bonifica degli alias non certificati. Nessun indice, migrazione o deploy in questo blocco. Il rollback strutturale deve comunque conservare il registro attendibile degli esiti, come richiesto nell'audit Vault.
