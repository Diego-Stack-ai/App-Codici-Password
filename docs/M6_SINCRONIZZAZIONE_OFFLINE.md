# M6 — Sincronizzazione e scritture offline

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
- [ ] collaudo fisico su due dispositivi.

M6 resta attiva finché runtime e backend non dimostrano che nessuna scrittura può essere persa o sovrascritta silenziosamente.
