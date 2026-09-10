# Profilo, Account, Widget e Cache — roadmap di coerenza dati

## Scopo e stato

Questa attività precede l'evoluzione funzionale dell'Agente Codex. Deve stabilizzare il modello dati che l'Agente dovrà successivamente descrivere e utilizzare.

Stato: **audit statico completato; piano applicativo e verifica aggregata dei dati reali ancora da approvare; nessuna migrazione autorizzata**.

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

## Esito audit sorgente — 10/09/2026

Stato: **audit statico completato; dati Firestore reali non ispezionati; nessuna modifica applicativa o migrazione eseguita**.

### Cache e read-your-writes

L'ipotesi è confermata. Quando il dispositivo è online, `getDocSmart()` e `getDocsSmart()` restituiscono una copia cache valida e avviano una lettura remota non attesa. Il valore remoto non viene pubblicato al consumer che ha già renderizzato la pagina. Tutti i consumer del repository possono quindi osservare dati precedenti, in particolare dopo una scrittura o una modifica proveniente da un altro contesto.

I due flussi Account hanno già correzioni puntuali:

- il form privato naviga con `m6refresh=1` e il dettaglio chiama `getPrivateAccountConfirmed()`;
- il form aziendale naviga con `serverRefresh=1` e il dettaglio chiama `getCompanyAccountConfirmed()`.

Queste correzioni coprono la navigazione immediata nota, ma duplicano il contratto tramite due nomi di parametro e non proteggono gli altri consumer. Inoltre le funzioni denominate `ServerConfirmed` usano attualmente `getDoc()`/`getDocs()` standard; soltanto `getDocsFromServer()` è presente nel bundle Firebase corrente. Prima di considerare forte la garanzia occorre introdurre una sorgente server esplicita per il documento oppure definire con precisione la semantica accettata.

Il repository è usato anche da Home, liste Account/Aziende/Scadenze, Profilo, Impostazioni, archivio, Salute credenziali, configurazioni Scadenze, allegati e Agente Codex. Non vanno trasformate tutte queste letture in server-first: serve un'opzione mirata per il read-after-write e un contratto testabile.

### Percorsi Account aziendali

Creazione, modifica, dettaglio proprietario, lista, archivio, backup e metadati degli allegati usano nel sorgente il percorso canonico `users/{uid}/aziende/{aziendaId}/accounts/{accountId}`. Il form rifiuta l'avvio senza `aziendaId` e lo conserva nella navigazione.

È stata però trovata una divergenza nel dettaglio di un Account aziendale condiviso: il record viene letto con `ownerId`, mentre `initAttachmentModule()` riceve `currentUid`. Di conseguenza la lista e i percorsi allegati vengono costruiti sotto l'utente visitatore anziché sotto il proprietario. Le azioni di scrittura devono comunque restare bloccate in sola lettura; il contesto di lettura degli allegati va corretto e coperto da test senza allargare i permessi.

La ricerca statica non mostra salvataggi ordinari di Account aziendali nella collezione privata. Le letture condivise scelgono il percorso aziendale quando l'invito contiene `aziendaId`. Questo non dimostra l'assenza di duplicati storici nei dati reali.

### Email profilo e credenziali legacy

`contactEmails[]` continua a leggere, decifrare, modificare e ricifrare `password` e `note`. Il collegamento a un Account esistente imposta `linkedAccountId` e poi assegna `email.password = ''`; il salvataggio del Profilo cifra nuovamente anche la stringa vuota. Il flusso di creazione guidata di un nuovo Account precompila l'email come username, ma non trasferisce la password legacy prima di scrivere `password: ''` nel Profilo.

Esiste quindi un rischio concreto di perdita della password legacy durante il collegamento. Il collegamento va bloccato o reso transazionale finché la password non è stata trasferita e verificata. Dopo il trasferimento, il campo deve essere eliminato esplicitamente dalla voce email, non sostituito da un ciphertext della stringa vuota. Non è stata trovata una migrazione completa già esistente.

Le email aziendali hanno tuttora un modello separato: `emails.pec`, `emails.amministrazione`, `emails.personale`, `emails.extra[]` e il fallback storico `aziendaEmailPassword`. Le password vengono lette e cifrate nel documento Azienda; non è presente un collegamento equivalente a `linkedAccountId`. Questo ambito richiede prima un inventario reale e non deve essere migrato insieme al Profilo per semplice analogia.

### Widget e strutture riutilizzabili

`profileWidgets` offre già il nucleo richiesto: documento widget con `fields[]`, ordine di widget e campi, duplicazione, collasso, tipi di campo, limite di 30 campi e cifratura per `sensitive`. I campi sensibili vengono esclusi dal QR e dalla copia/anteprima in chiaro. Le Rules limitano forma, tab e dimensione del widget, ma non validano in profondità ogni oggetto di `fields[]`; il controllo più dettagliato è oggi lato client.

Banking è già normalizzato da un modello condiviso e legge sia il formato canonico `banking[]` sia il vecchio oggetto singolo. Referente esiste sia a livello Account sia dentro banking. Non esistono ancora widget Account né una libreria template. La generalizzazione dovrà estrarre un modello neutro senza spostare automaticamente banking/referente esistenti.

### Dati reali e gate

Il repository e l'ambiente corrente non forniscono una lettura amministrativa sicura già predisposta che produca soltanto conteggi e forma dei documenti. Per evitare di esporre credenziali o introdurre uno script improvvisato sulla produzione, Firestore reale non è stato interrogato in questo audit. Prima di qualsiasi migrazione servirà un comando read-only dedicato, con output aggregato e campi sensibili esclusi.

### Priorità risultante

1. formalizzare e testare una lettura `afterWrite`/server-required unica nel repository;
2. sostituire i due parametri ad hoc con un contratto condiviso, mantenendo il fallback offline;
3. correggere il contesto proprietario degli allegati aziendali condivisi;
4. bloccare il collegamento email quando esiste una password legacy non trasferita;
5. creare l'inventario Firestore aggregato prima di progettare migrazioni;
6. soltanto dopo, definire schema widget Account, template e ordinamento touch.

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
