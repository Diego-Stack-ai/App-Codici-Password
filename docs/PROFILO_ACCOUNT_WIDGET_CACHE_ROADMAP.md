# Profilo, Account, Widget e Cache — roadmap di coerenza dati

## Scopo e stato

Questa attività precede l'evoluzione funzionale dell'Agente Codex. Deve stabilizzare il modello dati che l'Agente dovrà successivamente descrivere e utilizzare.

Stato: **roadmap registrata, audit non ancora eseguito, nessuna migrazione autorizzata**.

Principi inderogabili:

- preservare Firestore esistente, cifratura, offline-first e compatibilità con account privati e aziendali;
- non cancellare, migrare o sovrascrivere campi legacy senza averne verificato struttura, popolazione e utilizzo reale;
- correggere prima i difetti osservabili, senza riscrivere l'app;
- procedere per blocchi piccoli, testabili e reversibili.

## A — Audit

1. Ricostruire i flussi delle email di profilo e azienda/PEC, incluso `contactEmails[]`, `password` legacy e `linkedAccountId`.
2. Verificare se il collegamento a un Account trasferisce sempre la credenziale prima di rimuovere il valore legacy. Dopo una migrazione riuscita, valutare la rimozione del campo anziché una stringa vuota cifrata.
3. Verificare che gli account aziendali siano letti e scritti esclusivamente in `users/{uid}/aziende/{aziendaId}/accounts/{accountId}` e che dettaglio, modifica, allegati e condivisione conservino sempre `aziendaId`.
4. Cercare duplicazioni o contaminazioni con `users/{uid}/accounts/{accountId}`, prima nel codice e nei test e, solo con accesso autorizzato, nei dati reali.
5. Confermare nel codice la causa del difetto modifica → salva → dettaglio: `getDocSmart()` può restituire una cache precedente mentre il fetch server in background non provoca un nuovo render.
6. Mappare tutti i consumer di `getDocSmart()` e `getDocsSmart()` per individuare altre aree soggette allo stesso difetto.
7. Inventariare `profileWidgets`, wizard, banking, referente, QR, allegati e regole per campi sensibili, distinguendo schemi riutilizzabili da logica specifica.

L'audit dei dati reali deve essere soltanto esplorativo e minimizzato: conteggi, percorsi e forma dei documenti, senza esportare segreti nei log.

## B — Piano architetturale

Prima di modifiche strutturali devono essere approvati:

- file e flussi interessati;
- strategia generale **read-your-writes** senza fetch server indiscriminati;
- comportamento online, offline e durante la riconnessione;
- modello compatibile per widget, campi e template;
- trattamento dei campi legacy e, solo se indispensabile, migrazione idempotente e reversibile;
- rischi, rollback e matrice dei test.

La soluzione read-your-writes dovrà distinguere le normali letture cache-first dalle letture successive a una scrittura confermata. Le alternative da confrontare sono aggiornamento/invalida­zione controllata della cache, passaggio del dato appena scritto o lettura server-confirmed mirata.

## C — Implementazione per blocchi

Ordine previsto:

1. correggere in modo generale modifica → salva → dettaglio per account privati e aziendali;
2. rendere coerenti i percorsi aziendali e il trasporto di `aziendaId`;
3. mettere in sicurezza il collegamento email → Account senza perdita di password legacy;
4. generalizzare i widget soltanto dopo l'inventario degli schemi esistenti;
5. introdurre la libreria dei template come definizioni, separata dalle istanze associate agli Account;
6. valutare dati condivisi di servizio/dispositivo solo su casi reali ricorrenti, senza creare prematuramente una nuova entità `Servizio`.

## Modello widget desiderato

- **Widget**: contenitore o sezione associabile a profilo, Account privato o Account aziendale.
- **Fields**: array di uno o più campi; non esistono architetture separate per widget semplice e complesso.
- **Template**: sola definizione riutilizzabile della struttura.
- **Istanza**: widget effettivo con dati appartenenti a uno specifico contesto.

I primi template candidati derivano dalle strutture già presenti: referente, banking e domande di sicurezza. Non si duplicano campi o validazioni già esistenti senza aver prima valutato un adattatore o uno schema comune.

Ogni field sensibile deve essere cifrato, escluso da QR e anteprime in chiaro, protetto dallo stato della Vault e mai indicizzato o registrato senza protezione.

## D — Matrice minima di test

- Account privato e aziendale, con isolamento fra almeno due aziende;
- online, cache presente, offline applicabile e riconnessione;
- modifica e aggiunta di username, account/codice, password, URL, note, referente, banking e altri campi modificabili;
- dettaglio immediatamente aggiornato senza refresh manuale;
- allegati e condivisione sul percorso e sull'azienda corretti;
- nessuna perdita o duplicazione delle credenziali email/PEC;
- widget con uno e più campi, istanza da template e widget personalizzato;
- cifratura e non esposizione di tutti i campi sensibili;
- test mirati degli altri consumer di `getDocSmart()`/`getDocsSmart()`.

## E — Documentazione e gate di chiusura

Registrare decisioni, schema effettivo, compatibilità, eventuali migrazioni, test e problemi aperti negli MD pertinenti. Il blocco si chiude solo quando la proprietà read-your-writes è verificata, l'isolamento aziendale è provato e ogni intervento sui dati legacy ha un inventario e un rollback documentati.

