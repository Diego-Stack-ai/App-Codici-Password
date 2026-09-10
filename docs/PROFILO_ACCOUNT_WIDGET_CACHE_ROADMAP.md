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

1. [x] formalizzare e testare una lettura `afterWrite`/server-required unica nel repository;
2. [x] sostituire i due parametri ad hoc con un contratto condiviso, mantenendo il fallback offline;
3. [x] correggere il contesto proprietario degli allegati aziendali condivisi;
4. [x] bloccare il collegamento email quando esiste una password legacy non trasferita;
5. creare l'inventario Firestore aggregato prima di progettare migrazioni;
6. soltanto dopo, definire schema widget Account, template e ordinamento touch.

### Primo blocco implementato — read-your-writes

Il contratto usa ora `afterWrite=1` per le navigazioni successive a un salvataggio privato o aziendale. I vecchi parametri `m6refresh` e `serverRefresh` restano accettati in lettura per compatibilità con schede o shell già aperte, ma non vengono più prodotti dai form.

Le funzioni `getDocServerConfirmed()` e `getDocsServerConfirmed()` richiedono esplicitamente la sorgente server di Firestore. Le normali funzioni `getDocSmart()` e `getDocsSmart()` restano cache-first: il costo di rete e l'offline-first non cambiano per la navigazione ordinaria.

Verifiche automatiche superate: build del runtime Firebase locale, shell offline, audit accesso dati, navigazione, sintassi JavaScript e riferimenti statici. Resta obbligatorio il collaudo fisico privato/azienda modifica → salva → dettaglio prima del rilascio.

### Secondo blocco implementato — allegati aziendali condivisi

Il modulo allegati distingue ora lo UID proprietario dallo UID del visitatore. La lista usa il percorso canonico del proprietario e conserva `aziendaId`; caricamento, eliminazione e selettore sorgente sono bloccati in modalità condivisa/sola lettura e il pulsante Elimina non viene renderizzato. Non sono stati ampliati i permessi Firestore o Storage: il contenuto degli allegati continua a rispettare il contratto di condivisione esistente.

### Terzo blocco implementato — inventario e protezione password legacy

È disponibile `scripts/audit-firestore-legacy-email-metadata.mjs`, con conferma obbligatoria del progetto e output limitato a conteggi aggregati. Il modello è testato per non restituire nomi, email, password o identificativi. Il tentativo del 10/09/2026 non ha letto Firestore perché nell'ambiente manca Application Default Credentials; non sono stati usati token o metodi alternativi meno sicuri.

In attesa dell'inventario reale, il collegamento email Profilo → Account è fail-closed: se la voce email contiene ancora una password decifrata non vuota, l'operazione viene bloccata e chiede di salvare prima la credenziale nell'Account e rimuoverla poi manualmente dal Profilo. In questo modo il codice non può più sostituire direttamente una password legacy con la stringa vuota durante il collegamento.

## B — Piano architetturale

Prima di modifiche strutturali devono essere approvati:

- file e flussi interessati;
- strategia generale **read-your-writes** senza fetch server indiscriminati;
- comportamento online, offline e durante la riconnessione;
- modello compatibile per widget, campi e template;
- trattamento dei campi legacy e, solo se indispensabile, migrazione idempotente e reversibile;
- rischi, rollback e matrice dei test.

La soluzione read-your-writes dovrà distinguere le normali letture cache-first dalle letture successive a una scrittura confermata. Le alternative da confrontare sono aggiornamento/invalida­zione controllata della cache, passaggio del dato appena scritto o lettura server-confirmed mirata.

### Decisioni funzionali approvate

#### Account e Memorandum

- Account e Account condiviso possono contenere `username`, `account/utente/codice` e `password`.
- Memorandum e Memorandum condiviso non possono contenere questi tre valori e non devono mostrarne i campi.
- Il passaggio a Memorandum è bloccato finché l'utente non svuota consapevolmente le credenziali; non si conservano copie nascoste.
- Se un Memorandum torna Account, i tre campi ricompaiono vuoti.
- Note, sito, widget e allegati restano disponibili in tutte le tipologie.
- La validazione deve esistere nel dominio/repository o backend, non soltanto nella UI.

#### Corpo dinamico della pagina

La struttura desiderata è: dati standard, note, corpo dinamico dei widget, allegati, tipologia/condivisione e comandi. Il corpo può allungarsi verticalmente e contenere widget singoli o composti. Widget e campi sono ordinabili; su touch è previsto un blocco/sblocco esplicito dell'ordinamento per evitare trascinamenti involontari.

#### Credenziali comuni

È approvata una terza area autonoma, provvisoriamente denominata **Credenziali comuni** o **Dati comuni protetti**. Non è un Account privato o aziendale e non appartiene a una singola Azienda. Conserva una sola istanza cifrata di un dato realmente riutilizzato, per esempio il codice generale dell'app Legal Mail collegato agli Account PEC di aziende differenti.

Una Credenziale comune usa lo stesso contratto `widget + fields` e può quindi contenere uno o più campi normali o sensibili. Negli Account appare come **widget collegato**, contenente soltanto un riferimento; non viene duplicato il valore.

Si distinguono:

- **widget incorporato**: appartiene a un solo Account;
- **widget collegato**: riferisce una Credenziale comune centrale utilizzabile da più Account.

La Credenziale comune è di proprietà dell'utente che la crea. Gli Account collegati non ne diventano proprietari. Un destinatario di un Account condiviso non riceve automaticamente accesso alla Credenziale comune e non può modificarla senza un permesso separato ed esplicito.

Accessi previsti:

- Impostazioni → Credenziali comuni: creazione, modifica, elenco dei collegamenti, autorizzazioni e rimozione;
- Account → Credenziali comuni: collega un dato esistente oppure crea un nuovo dato centrale e collega automaticamente l'Account corrente.

Creazione centrale e collegamento devono costituire un'unica operazione atomica. La modifica deve avvisare quanti Account saranno interessati. L'eliminazione deve essere bloccata finché esistono collegamenti, mentre lo scollegamento del singolo Account non elimina il dato centrale.

Il percorso centrale candidato è `users/{uid}/sharedVaultData/{datoId}`. L'audit tecnico di Rules, backup e coda offline ha portato al contratto candidato descritto sotto; nessuna collezione è stata ancora creata e il contratto resta soggetto al gate di approvazione prima dell'implementazione.

#### Prevenzione duplicati

È prevista una ricerca locale preventiva mentre si digita il nome di Account o Memorandum. Normalizzazione, parole in ordine diverso e piccoli errori di battitura producono suggerimenti, mai un blocco assoluto. Il confronto rispetta il perimetro privato/azienda, non usa password e permette sempre di creare legittimamente due Account distinti.

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

### Contratto tecnico candidato — 10/09/2026

#### Collocazione dei dati

I widget Account non vengono incorporati nel documento Account. Usano collezioni proprietarie dedicate:

- widget privati e aziendali: `users/{uid}/accountWidgets/{widgetId}`;
- centrale: `users/{uid}/sharedVaultData/{sharedDataId}`;
- indice dei collegamenti: `users/{uid}/sharedVaultLinks/{linkId}`.

Le collezioni separate evitano di avvicinarsi al limite Firestore del singolo Account, impediscono che il riordino riscriva l'intero Account e riducono i conflitti con le credenziali standard. Sono state preferite alle sottocollezioni annidate perché l'attuale Rule generica su `accounts` e `aziende` renderebbe impossibile applicare una validazione più stretta ai soli widget senza un refactor rischioso delle regole esistenti.

Ogni documento nella sottocollezione `widgets` ha un solo contratto e un discriminante:

- `kind: embedded`: contiene `fields[]` ed è proprietà dell'Account;
- `kind: shared-reference`: contiene `sharedDataId` e metadati di presentazione/ordine, ma nessuna copia dei valori centrali.

Campi comuni candidati: `context`, `accountId`, `companyId` solo per il contesto aziendale, `title`, `description`, `icon`, `color`, `order`, `collapsed`, `schemaVersion`, `createdAt`, `updatedAt` e `revision`. Un widget incorporato aggiunge `fields[]`; un riferimento aggiunge esclusivamente `sharedDataId`. Lo schema dei field riusa quello già collaudato in `profileWidgets`, inclusi identificativo stabile, tipo, etichetta, ordine, valore cifrato per i dati sensibili e divieto di esposizione in QR/anteprime.

La Credenziale comune centrale usa lo stesso modello `fields[]`, con titolo e metadati propri. Non contiene una lista duplicata degli Account nel documento principale: i collegamenti stanno in `sharedVaultLinks`, priva di segreti. Ciascun link identifica `sharedDataId`, contesto (`private` o `company`), `accountId` e, se necessario, `companyId`.

#### Coerenza e proprietà

Creazione centrale + collegamento, collegamento esistente e scollegamento devono essere operazioni atomiche che aggiornano insieme il riferimento nell'Account e l'indice centrale. Un identificativo deterministico del collegamento impedisce di collegare due volte la stessa Credenziale allo stesso Account.

La rimozione della Credenziale centrale è rifiutata se esiste almeno un link. Poiché una Rule non può garantire da sola l'assenza di documenti arbitrari in una sottocollezione, creazione/collegamento/scollegamento/eliminazione passano da una funzione backend validata. Le normali letture restano disponibili al proprietario. Nessun destinatario di Account condiviso eredita il dato centrale: il widget collegato mostra uno stato non disponibile, salvo una futura condivisione esplicita separata.

#### Ordinamento

Widget incorporati e collegati condividono lo stesso campo `order`, quindi possono essere intercalati nella pagina. Il riordino touch è consentito soltanto dopo **Sblocca ordinamento** e si conclude con un salvataggio esplicito. Il riordino aggiorna soltanto i documenti interessati e non i dati Account. Non si introduce ora il trascinamento dei singoli campi: l'ordine dei field resta quello dell'array del widget.

#### Template

I template predefiniti sono manifest statici versionati distribuiti con l'app: descrivono struttura e validazioni, non contengono valori utente e non richiedono Firestore. La creazione copia la struttura in una nuova istanza, così un aggiornamento futuro del template non altera silenziosamente i widget esistenti.

Prima libreria candidata, da approvare dopo il confronto con i wizard esistenti:

- Informazioni referente;
- Dati bancari;
- Domande di sicurezza;
- campo singolo personalizzato.

Banking e referente legacy non vengono migrati né rimossi in questa fase. Il template potrà riusarne nomi, tipi e validazioni, ma rimarrà una nuova istanza indipendente finché non sarà definita una migrazione esplicita.

#### Backup e ripristino

Il backup attuale esporta `profileWidgets`, ma non conosce widget Account, Credenziali comuni o relativi link. Prima di rendere scrivibile la nuova UI occorre aggiungere scope distinti per:

- widget Account privato;
- widget Account aziendale;
- Credenziale comune;
- link della Credenziale comune.

Il ripristino deve ricostruire prima i documenti centrali e poi i riferimenti, validare proprietario e percorsi, descrivere chiaramente titolo e Account nell'anteprima e non creare riferimenti orfani. Il backup rimane cifrato; gli allegati conservano il flusso separato già esistente.

#### Offline e coda M6

I widget incorporati potranno entrare nel normale offline-first solo dopo una mutation dedicata e test di conflitto. Le Credenziali comuni coinvolgono più documenti e, nella prima versione, sono **consultabili dalla cache ma creabili, modificabili, collegabili e scollegabili soltanto online**. Questa limitazione è intenzionale e deve essere dichiarata nella UI; evita code parziali o riferimenti orfani. L'estensione offline sarà valutata dopo la certificazione degli account semplici e degli allegati.

#### Rules e limiti

Le nuove collezioni non devono ricadere semplicemente nella regola generica proprietario. Servono Rules nominate che limitino chiavi, tipi, numero massimo di field, lunghezze, `kind`, contesto e versione schema. La validazione profonda già insufficiente in `profileWidgets` va centralizzata in un modello condiviso lato client/backend e coperta da test Rules. Valori sensibili ammessi soltanto nella forma cifrata prevista dalla Vault; nessun valore decifrato può apparire nei link o nei log.

#### Gate prima del codice applicativo

1. approvazione esplicita di percorsi, proprietà e limite online iniziale;
2. estensione backup/ripristino e relativi test prima della prima scrittura reale;
3. Rules e test emulator per isolamento privato/aziendale e accesso condiviso negato;
4. funzioni atomiche con test di idempotenza, conflitto e cancellazione bloccata;
5. prova isolata con un widget incorporato e una Credenziale comune collegata a due Account di aziende diverse;
6. soltanto dopo, UI completa, ordinamento touch e libreria template.

### Quarto blocco implementato — predisposizione backup e Rules

Il formato cifrato riconosce ora, pur in assenza di dati reali, quattro scope distinti: widget Account privato, widget Account aziendale, Credenziale comune e relativo collegamento. Esportazione e ripristino conservano `accountId`, `companyId` e `sharedDataId`, costruiscono esclusivamente percorsi sotto lo UID autenticato e mostrano nell'anteprima titoli leggibili senza includere valori protetti.

L'esame delle Rules ha fatto scartare le sottocollezioni annidate negli Account: la regola generica storica su `accounts` e `aziende` avrebbe consentito scritture senza la nuova validazione, a meno di un refactor ampio e rischioso. Il contratto è stato quindi corretto verso `accountWidgets`, `sharedVaultData` e `sharedVaultLinks`, tutte sotto il proprietario. Sono escluse dalla regola generica, leggibili soltanto dal proprietario e temporaneamente non scrivibili dai client. Il ripristino amministrativo continua a essere compatibile; le future modifiche atomiche passeranno dal backend.

Verifiche superate: 16 test del backup cifrato e dell'anteprima, 5 test del servizio backend, controllo sintattico di 139 moduli e 15 test Firestore Rules. Nessuna collezione è stata popolata e nessun dato reale è stato modificato. Prima dell'attivazione UI restano da implementare validazione condivisa dello schema, funzioni atomiche e controllo delle dipendenze durante un ripristino selettivo.

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
