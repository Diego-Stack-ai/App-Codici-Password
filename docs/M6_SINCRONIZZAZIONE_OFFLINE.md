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


### Rifiuto permanente del perimetro e scelta esplicita — 13/09/2026

Base `141259d9`, candidato sperimentale. `PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED` non viene più presentato come errore temporaneo di rete: la coda conserva dentro il contenitore cifrato il motivo e il marker di riconciliazione, arrestando i retry automatici anche alla riapertura. La UI spiega che il record richiede la modifica completa. Consente di conservare la copia per decidere più tardi oppure eliminarla esplicitamente mantenendo il server; non la applica con il writer ridotto e non dichiara un salvataggio riuscito. Nessuna conversione automatica verso il percorso complesso.

Verifiche locali: 31 test coda/sync/recupero, più 24 esiti nella suite Auth/Firestore emulata. I due nuovi scenari emulati comprendono 12 combinazioni di riferimenti inversi, inclusi contatti vuoti e aziende archiviate, namespace aziendale distinto, retry attendibile e assenza di variazioni a record, revisioni, updateTime e ricevute dopo rifiuto. Nessun dato reale. La scala della scansione e il recupero guidato della copia nel percorso complesso restano aperti. Nessuna migrazione o distribuzione backend.

### Conferma locale del comando applicato — candidata 13/09/2026

La coda elimina soltanto il comando effettivamente inviato: decifra la versione attesa in memoria e confronta nuovamente il contenitore nella transazione IndexedDB finale. Se nel frattempo un'altra azione lo ha sostituito o marcato da riconciliare, conserva la coda e restituisce errore recuperabile senza dichiarare salvato. Enqueue non sovrascrive un ID già associato a contenuti diversi; il reinserimento identico conserva il contenitore esistente. Anche lo scarto esplicito usa una snapshot acquisita sotto lease e il controllo della sessione.

Suite offline: 52 test superati, inclusa la regressione riprodotta della risposta tardiva che cancellava una riconciliazione. Nessun formato o schema IndexedDB modificato. Questo è un prerequisito del fallback senza Web Locks: lease con scadenza, fencing e coordinamento fra copie PWA richiedono un protocollo distinto; il gate resta aperto.


### Coordinamento IndexedDB candidato, non attivato — 13/09/2026

Il laboratorio offline-sync contiene un lease transazionale con token crescente: acquisizione, rinnovo e rilascio non permettono a un vecchio titolare di modificare il lease subentrato. La protezione della scrittura richiede la stessa transazione readwrite e lo stesso database della coda; errori, dati malformati, overflow e inversione dell'orologio interrompono la transazione. Nove test dedicati passano, 61 nella suite offline complessiva.

Il modulo non è importato dall'app e non aggiorna IndexedDB. Prima dell'integrazione servono store condiviso con le operazioni cifrate, adozione anche dal percorso Web Locks, controlli prima/dopo le attese e compatibilità delle copie PWA. La protezione vale per le mutazioni nella transazione, non garantisce callback o invii rete esclusivi dopo sospensione: eventuali duplicati dello stesso comando devono restare idempotenti. Nessun timer o annullamento può ritirare una richiesta già inviata. Il gate fallback e le prove fisiche restano aperti.

### Coordinatore comune ai due percorsi — candidato 13/09/2026

`experiments/offline-sync/hybrid-queue-coordinator.mjs` acquisisce sempre il medesimo lease IndexedDB, anche quando Web Locks è disponibile. Web Locks occupato o fallito non provoca un tentativo alternativo che aggiri il blocco. Il contesto controlla sessione e titolarità dopo le attese, espone rinnovo esplicito e scritture protette nella stessa transazione, e viene invalidato al termine. Il rilascio del vecchio titolare non modifica il lease di chi gli è subentrato.

Sette nuovi test sintetici verificano contesa fra percorsi misti in entrambe le direzioni, errori, annullamento durante acquisizione/esecuzione, scadenza e subentro, impossibilità di scrivere con il vecchio contesto e mancata conferma di un risultato tardivo. Insieme ai nove test del lease costituiscono 16 prove locali; non sono un collaudo IndexedDB su browser reale.

Nessun import nel runtime, aggiornamento dello schema o cutover. Restano da realizzare l'adozione sulla coda cifrata, la gestione delle copie PWA precedenti e i collaudi di sospensione su dispositivi. Il controllo della transazione non garantisce esclusività degli effetti di rete: restano necessarie le ricevute server idempotenti. Questo passo non chiude M6.


### Apertura e durata delle connessioni — candidata 13/09/2026

Base `5b3cd4da`, ramo `experiment/m6-database-lifecycle`: l'apertura della coda runtime resta alla versione IndexedDB 1. Una connessione chiude su `versionchange`; apertura bloccata, annullata o oltre 10 secondi restituisce errore recuperabile, senza lasciare utilizzabile una connessione arrivata tardi. Una richiesta già abbandonata non inizializza successivamente lo store. La derivazione della chiave precede l'apertura: un errore crittografico non lascia una connessione senza proprietario. Il client passa il proprio controllo di sessione anche all'apertura.

Suite offline: 73 test superati, inclusi quattro nuovi scenari del ciclo di vita con fixture transazionali. Non viene cancellato il database, modificato il formato cifrato o installato lo store dei lease. Queste protezioni cooperano soltanto nelle copie dell'app che le includono; una PWA precedente può ancora bloccare l'upgrade. Prima di un futuro schema 2 servono distribuzione preparatoria, chiusura delle copie precedenti, collaudo browser reale e rollback che sappia leggere lo schema aggiornato. M6 rimane aperta.

### Collaudo browser del coordinamento candidato — 13/09/2026

Base `44c7f077`. Runner locale `node experiments/offline-sync/run-browser-tests.mjs <percorso-browser>`: profilo temporaneo isolato, server soltanto loopback con allowlist di cinque moduli, nessuna connessione Firebase o dato reale. Sei scenari superati in Chrome headless 152 e Edge headless 153 su Windows: roundtrip cifrato IndexedDB; upgrade sintetico a schema 2 che chiude i lettori cooperativi e conserva byte del contenitore; rifiuto VersionError del lettore v1; contesa pagina/Worker con e senza Web Locks; fencing transazionale del vecchio titolare dopo subentro.

Lo schema 2 esiste soltanto nel profilo di collaudo. La prova dimostra che il rollback al lettore v1 non sarebbe compatibile: non va usato un downgrade con cancellazione/ricreazione del database. La prossima integrazione deve mantenere lettori compatibili e ricevute idempotenti; nessun upgrade runtime autorizzato da questo test. Worker separati verificano contesti concorrenti ma non sostituiscono iPhone/iPad, sospensione reale o copie PWA produttive. Il browser di collaudo usa un profilo usa e getta e non tocca quello dell'utente.

### Lettore compatibile in sola lettura — candidato successivo alla 1.2.124

Base integrata f4074ab5. Il laboratorio compatible-queue-reader.mjs legge snapshot dei contenitori cifrati negli schemi IndexedDB 1 e 2, apre senza imporre una versione e valida struttura e proprietario. Una coda assente resta assente; schema sconosciuto o malformato, cambio sessione, timeout e cambio versione causano rifiuto e chiusura della connessione, senza cancellazioni o riparazioni. Il lettore non restituisce il database e non espone scritture. Non decifra o autentica il contenuto: il successivo consumo deve usare il lettore crittografico esistente.

Undici scenari complessivi passati sia in Chrome headless 152 sia in Edge headless 153 con profili temporanei e dati sintetici: cinque nuovi scenari di compatibilità, oltre ai sei già presenti. Conservazione byte per byte verificata negli schemi 1 e 2; rifiuto di schema 2 malformato e schema 3 senza alterazione; invalidazione della sessione e mancata creazione di database assenti. Nessun dato reale, import runtime, migrazione o deploy. Il lettore serve come prerequisito di recupero/rollback, non rende sicure le vecchie scritture nello schema 2. Restano integrazione dei writer con il lease, distribuzione preparatoria delle copie PWA, gestione delle code grandi e matrice fisica.

### Scritture cifrate sotto coordinamento — candidato di laboratorio

Base c82ceab0. fenced-queue-writer.mjs riusa derivazione e cifratura della coda canonica e il coordinatore ibrido. Inserimento, sostituzione, marcatura da riconciliare e rimozione confrontano il contenitore atteso e verificano il lease nella stessa transazione readwrite su encryptedOperations e queueLeases. Secondo controllo immediatamente prima delle scritture; nessuna crittografia asincrona dentro la transazione. Reinserimento identico conserva il ciphertext, sostituzioni conservano queuedAt, collisioni e conferme obsolete non eliminano dati. Il contesto trattenuto diventa inutilizzabile al termine del coordinamento.

Sedici scenari complessivi superati sia in Chrome headless 152 sia in Edge headless 153: cinque nuovi gruppi per scritture, contesti scaduti, collisioni, subentro Worker e invalidazione sessione. Verificato roundtrip cifrato del marker di riconciliazione, senza motivo in chiaro nel contenitore. Suite offline canonica/laboratorio superata. Profili temporanei e soli dati sintetici.

Il modulo richiede un database schema 2 già preparato nel laboratorio e non lo crea o aggiorna. Non è importato dai form o dal client di produzione: restano integrazione del ciclo completo lettura/sync/UI, distribuzione preparatoria, upgrade concordato, compatibilità PWA e prove fisiche. Il fencing protegge le scritture IndexedDB, non ritira richieste di rete già inviate: le ricevute server idempotenti restano necessarie. Nessuna modifica a dati reali, Hosting, Rules, Functions o formato cifrato. M6 resta aperta.

### Client di sincronizzazione sotto lease — candidato di laboratorio

Base 2a79917a. fenced-queue-client.mjs collega il writer cifrato al sincronizzatore canonico: elenco decifrato nella sessione protetta, invio con verifica del lease prima e dopo la risposta, conferma tramite rimozione CAS. Enqueue, replace e discard acquisiscono il medesimo coordinatore. Flush concorrenti sullo stesso client condividono la promessa; close e invalidazione impediscono nuovi invii, conferme tardive e aggiornamenti UI. Gli errori permanenti mantengono il marker cifrato di riconciliazione anche dopo riapertura del client.

Ventidue scenari browser passati sia in Chrome headless 152 sia in Edge headless 153, più 59 test offline canonici/laboratorio. I sei nuovi scenari coprono ritorno online, risposta persa con retry idempotente simulato, conflitto e scarto esplicito, riapertura del marker, subentro Worker durante invio, chiusura durante invio. IndexedDB è reale; le risposte del backend sono simulate in memoria, non costituiscono collaudo Firebase o attestazione delle ricevute server.

Nessun import dai form, aggiornamento DB, worker produttivo, wakeup automatico o deploy. Restano collegamento al backend emulato, UI e lifecycle completo, rinnovo per invii lunghi, distribuzione preparatoria e upgrade dello schema con gestione delle copie PWA precedenti. Una richiesta di rete già inviata non può essere ritirata: il comando resta conservato per la riconciliazione/idempotenza server. M6 rimane aperta; produzione 1.2.124 invariata.

### Browser e backend originale emulato — candidato M6

Base 7f2886b9. Comando riproducibile Windows: node scripts/run-vault-session-emulators.mjs --fenced-browser. Il runner avvia Auth/Firestore demo-vault-shell e due browser headless isolati. Il ponte loopback verifica le variabili degli emulatori prima di importare Functions, limita il record alla fixture e autentica il contesto del comando con uno UID sintetico fisso per esecuzione. Nessun collegamento a Firebase reale. Le operazioni vengono cifrate nel browser con il modulo canonico e custodite dalla coda IndexedDB sotto lease.

Cinque scenari superati in Chrome 152 ed Edge 153: applyOfflineMutation originale applica il ciphertext e produce una ricevuta vincolata; risposta persa dopo commit lascia il comando locale e il retry restituisce duplicate senza riscrivere; revisione obsoleta conserva coda e record; operationId riutilizzato con contenuto diverso viene rifiutato; proprietario del comando diverso dal contesto autenticato non modifica record o ricevute. Snapshot, revisione e timestamp verificati nell’emulatore. Dieci esecuzioni browser complessive; non sommare come nuovi casi della suite Node.

Limiti: chiamata diretta handler.run tramite ponte locale, senza Functions HTTP, autenticazione del trasporto o verifica App Check. Il percorso testato è il dominio generico syncRecords; il collegamento browser con applyPrivateAccountMutation, le sue relazioni inverse, la UI e il rollout dello schema restano aperti. Le prove private esistenti sui soli emulatori rimangono distinte. Nessun deploy o migrazione produttiva, nessun incremento versione: Hosting resta 1.2.124.

### Account privati nel collaudo browser–backend — candidato M6

Base 3b551a7a. Il runner --fenced-browser esegue ora il dominio generico e il dominio Account privato su Chrome ed Edge. Il ponte emulato seleziona applyPrivateAccountMutation originale e limita i preset di relazione ai soli documenti sintetici della fixture. Payload privato conforme con campi cifrati dal modulo canonico; nessun handler o writer di produzione modificato.

Otto scenari privati passati per ciascun browser: i cinque casi di applicazione/retry/conflitto/riuso ID/proprietario, più riferimento inverso telefono Profilo, riferimento email vuota in azienda archiviata e retry attendibile dopo cambiamento delle relazioni. I due rifiuti di perimetro conservano in IndexedDB il marker cifrato PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED, non creano ricevute applicate e non cambiano il timestamp del record. Un secondo flush non richiama il trasporto per il marker. Una ricevuta server già verificata rimane autorevole dopo un nuovo collegamento e non riscrive il record.

Il comando completo passa 5 scenari generici e 8 privati in ognuno dei due browser: 26 esecuzioni complessive. Rimane invocazione diretta degli handler con contesto Auth sintetico; non certifica trasporto pubblico, App Check o autenticazione HTTP. Ancora aperti l’integrazione nella UI, rinnovo e chiusura del client sulle pagine, rollout dello schema e copie PWA, collaudi fisici. Nessun deploy, migrazione o modifica ai dati reali; versione online 1.2.124 invariata.

### Pannello note e confine della vista — candidato M6

Base 7beb3dbf. offline-save-panel.mjs espone nota, Salva e Riprova sincronizzazione con stati distinti: in attesa offline, sincronizzazione, conferma, conflitto e riconciliazione. Riceve solo createClient/prepare autorizzati e il segnale della vista; nessun accesso a chiavi, SDK o database dal DOM. Dopo accodamento confermato la bozza visibile è svuotata e il secondo invio è disabilitato. Un tentativo incerto conserva lo stesso comando preparato per evitare nuovi identificatori. Chiusura durante factory/preparazione chiude il client tardivo e impedisce accodamenti fuori vista.

Il dettaglio della shell emulata accetta un mountSavePanel opzionale solo sul dominio privato, governato dal proprio AbortController anche alla rimozione manuale; il provider non è ancora configurato dall’entry principale. Il pannello è montato e collaudato nella fixture browser privata con backend emulato. Non viene attivato automaticamente sui dati dell’utente.

Undici scenari privati e cinque generici per ciascuno di Chrome ed Edge: 32 esecuzioni browser/emulatore complessive. Tre casi UI aggiunti: nota offline poi sincronizzata, chiusura durante avvio, chiusura durante preparazione. Trentuno test mirati vista/sessione passati, inclusi teardown manuale, inizializzatore tardivo e esclusione aziendale. Resta collegare il provider autorizzato alla shell principale, aggiornare la vista dopo conferma, implementare recupero esplicito dei conflitti, styling definitivo e rollout dello schema. Nessun deploy o dato reale modificato; produzione 1.2.124 invariata.

### Rinnovo durante gli invii lunghi — candidato M6

Base a7b7d1f8. Il client sperimentale accetta renewEveryMs opzionale, disabilitato per default e inferiore al TTL. Durante flush rinnova il lease senza sovrapporre rinnovi; errori impediscono conferme tardive. Timer rimossi a fine flush, abort o close. Un trasporto già avviato può terminare, ma la chiusura impedisce cancellazione della coda e aggiornamenti UI. Non è un servizio in background e non recupera lease scaduti.

Ventiquattro scenari IndexedDB reali passati su Chrome ed Edge, inclusi invio oltre TTL e chiusura durante invio; 73 test offline superati. Il worker del test temporizzato legge Date.now al momento dell'operazione, evitando timestamp congelati durante il passaggio di messaggi. Restano provider protetto, trasporto autenticato, rollout schema e prove fisiche. Produzione 1.2.124 invariata.

### Conferma della singola nota — candidato M6

Base 790d3d26. Il client emette onCommitted con soli operationId e recordId dopo conferma backend e rimozione protetta dalla coda. Errori del consumatore non riaccodano una scrittura confermata. Il pannello associa la conferma al proprio comando: uno stato saved dell'intera coda o il conflitto di un altro Account non possono confermare o smentire la nota. onSaved riceve solo lifecycle per rileggere il dettaglio; un errore di lettura indica che la nota è salvata e richiede riapertura, senza proporre un secondo invio.

79 test offline superati, inclusi sei casi su identità, conferma singola, offline, errore refresh e abort. Il runner --fenced-browser supera ancora 32 esecuzioni Chrome/Edge e verifica la rilettura della nota dal backend privato emulato dopo conferma. Il provider principale rimane da attivare; nessuna modifica produttiva.

### Rilettura del dettaglio dopo conferma — candidato M6

Base ec8ced7d. Il dettaglio passa al provider opzionale onSaved, che rilegge l'Account attraverso la capability protetta e prepara i campi aggiuntivi fuori dal DOM visibile. Solo dopo lettura riuscita sostituisce i dati della vista e libera la vecchia nota. Letture concorrenti condividono lo stesso tentativo; errore conserva la vista precedente, mentre chiusura o blocco impediscono l'inserimento tardivo. Una password richiesta prima della rilettura non può apparire dopo la sostituzione del dettaglio.

155 test della shell superati, inclusi cinque nuovi casi di aggiornamento, errore, concorrenza, password tardiva e nota decifrata dopo chiusura. Suite npm test completa superata, compresi controlli statici, Functions, Rules ed emulatori. Provider principale e trasporto autenticato ancora da collegare: predisposizione della vista verificata, non attivazione delle scritture nella shell o in produzione. Rollback del candidato al checkpoint precedente senza migrazioni o modifica del formato dati.

### Scarto esplicito del comando in conflitto — candidato M6

Base 7471d3c8. Il pannello propone Mantieni i dati online solo per il proprio operationId/recordId in conflitto o riconciliazione. Una seconda conferma elimina il comando locale tramite discard con lease e confronto del contenuto atteso; Annulla conserva la coda. Non modifica il record online e non invia altre operazioni. Marker di revisione inclusi nello snapshot; blocco o cambiamento della coda non vengono presentati come eliminazione riuscita. Chiusura della vista sopprime callback e notifiche tardive. onDiscarded rilegge il dettaglio attraverso la stessa capability protetta.

83 test offline e 155 test shell superati. Runner --fenced-browser: 12 scenari privati e 5 generici per ciascuno di Chrome ed Edge, 34 esecuzioni complessive. Il nuovo caso dimostra annullamento, eliminazione del solo comando e uguaglianza di record/timestamp Firestore emulati. Resta da costruire confronto completo e riproposizione esplicita della copia locale; nessun merge automatico, nuova migrazione o attivazione del provider nel bootstrap. Produzione 1.2.124 invariata.

### Confronto delle note in conflitto — candidato M6

Base 12d4e3f9. readConflictNotes confronta soltanto la nota cifrata del comando e quella del record corrente, attraverso lettore proprietario e capability di decifratura. Verifica UID, ID fisico, schema, dominio privato e revisione; cattura il ciphertext prima delle attese e interrompe il risultato su blocco o cambio sessione. Non prepara sostituzioni o scritture.

Il pannello offre Confronta le note soltanto con provider esplicito e conflitto del proprio comando. Presenta i testi con textContent, distingue la nota online al momento della lettura e svuota il confronto su chiusura, conferma o variazione del conflitto. Una nuova notifica richiede nuovamente conferma prima dello scarto. Il provider principale resta non attivato.

90 test offline superati; 34 esecuzioni browser/backend emulato Chrome/Edge, con confronto reale delle note cifrate e verifica della coda intatta. Inventario aggiornato. Riproposizione della copia locale con nuova revisione, confronto degli altri campi, riapertura delle code pregresse e trasporto autenticato restano aperti. Nessun deploy, migrazione o mutazione dei dati reali.

### Preparazione della riproposizione della sola nota — candidato M6

Base cc067a12. createConflictNoteProposal prepara, senza inviarla, una nuova operazione dopo confronto e conferma esplicita. Richiede evidenza noteOnly e assenza di riferimenti Profilo; rifiuta marker di riconciliazione e cancellazione tramite nota vuota, fuori dal preparatore corrente. Snapshot della fonte completa tramite la stessa validazione del preparatore canonico, revisione fissata a quella confrontata, nuovo operationId stabile nei retry. Cambia soltanto la nota e conserva gli altri campi della fonte aggiornata. Una nuova modifica online dopo il confronto dovrà essere rifiutata dal CAS backend, non incorporata implicitamente.

95 test offline e 155 shell superati, inclusi validatore backend originale, snapshot, consenso, identità, perimetro e chiusura durante cifratura. Non collegato al pulsante UI, alla sostituzione transazionale della coda o al backend nel browser: questi passaggi e il recupero delle operazioni dopo riapertura restano da realizzare. Nessuna scrittura reale, migrazione o deploy.

### Riproposizione esplicita dalla UI — candidato M6 cloud

Base iniziale `65a5d0e7`. Il pannello candidato collega il confronto alla proposta protetta e mostra un secondo consenso dedicato prima di riproporre la sola nota. La sostituzione usa `client.replace(expected, replacement)`: lease e CAS sostituiscono atomicamente il comando confrontato, senza finestra elimina/accoda. L'identità della sostituzione viene associata alla vista prima del flush, così soltanto la relativa ricevuta può confermare la nota. Annullamento, lease non acquisito, variazione del conflitto e chiusura preservano la copia precedente e svuotano il testo decifrato. Nessuna chiave Vault raggiunge la vista.

Il laboratorio browser/backend prepara ora una nota locale sintetica, sostituisce il comando in conflitto e la inoltra a `applyPrivateAccountMutation` nell'emulatore; verifica nuova revisione e nuovo `operationId`, quindi conserva anche lo scenario di scarto senza mutazione online. Il runner accetta `CHROME_PATH` e `EDGE_PATH` e cerca percorsi Linux oltre a quelli Windows. Nel container cloud del checkpoint non erano installati Chrome/Chromium né Edge: gli scenari browser non sono stati eseguiti e non vengono dichiarati superati. L'avvio Auth/Firestore sul solo progetto `demo-vault-shell` è stato tentato, ma il JAR Firestore non era in cache e il download è stato impedito dalla rete dell'ambiente.

Validazione cloud effettiva: installazioni riproducibili root e Functions completate; Java OpenJDK 25 rilevato; 97 test offline e 155 test shell superati. Provider protetto del bootstrap principale, trasporto autenticato, recupero delle code dopo riapertura, rollout schema e prove fisiche restano aperti. Nessun deploy, migrazione, dato reale o versione di produzione modificati; M6 rimane aperta.

Revisione locale PR #59 (base `a3f7f28`, audit 68): la conservazione della copia precedente vale solo prima della sostituzione o quando il lease iniziale è certamente rifiutato. Il client espone `replacementApplied` per distinguere questo caso dal flush non acquisito dopo il replace. Un'eccezione dopo l'avvio della transazione non dimostra rollback: la vista conserva la nuova identità, disabilita lo scarto sul vecchio snapshot e offre solo retry della coda. Proposte tardive sono chiuse senza leggere il confronto dopo abort; scarto e confronto fallito revocano le relative azioni. 101 test offline, suite completa e Chrome/Edge con backend emulato passati localmente; prove Linux cloud ancora da eseguire.


### Collaudo finale dell'ambiente Linux cloud

Su discendente verificato di `bdb95236`, setup e fixture effettivi confermano browser, Java e cache Firestore. La suite completa arriva al gate Storage ma la cache Storage non era inclusa nello setup consolidato; la rete già disattivata impedisce di recuperarla durante la fase agente. Il runner Chrome/Edge ha inoltre richiesto `--no-sandbox` perché il container esegue come root. Entrambe le compatibilità sono corrette nel candidato: cache Storage durante il setup con rete e flag browser limitato a Linux root. Il runner corretto supera 34 scenari sintetici complessivi su Chrome ed Edge. La riesecuzione completa dopo un nuovo setup resta il solo blocco del collaudo ambiente; provider, trasporto, riapertura e rollout restano gate M6 separati e non avviati.


### Chiusura del trasferimento Linux cloud — ambiente nuovo

Base iniziale `3070d01d`, ambiente ricaricato nella stessa shell e cache Firestore/Storage entrambe presenti. Dopo aver instradato direttamente soltanto gli host loopback esatti tra emulatori, conservando il `ProxyAgent` originale per ogni altra destinazione, la suite completa è passata realmente su Linux. Il runner fenced ha superato 34 esecuzioni complessive, 5 generiche e 12 private per ciascuno di Chrome 153 ed Edge 153, usando esclusivamente fixture sintetiche, Auth/Firestore demo e handler originali emulati.

Questo esito chiude il trasferimento del laboratorio cloud, non M6. Restano aperti provider protetto del bootstrap della shell persistente, trasporto autenticato e App Check, recupero delle code dopo riapertura, rollout dello schema e collaudi fisici. La direzione resta la shell persistente con Vault Key esclusivamente in memoria; nessun deploy, migrazione o dato reale.

### Recupero della nota dopo riapertura — candidata 14/09/2026

Base `b5ab595c`, ramo `experiment/m6-reopen-pending-note`. Il client sotto lease può identificare la singola operazione pendente di un record restituendo soltanto operationId/recordId. Più comandi per lo stesso record interrompono il recupero senza invii o cancellazioni. L'editor con recoveryRecordId esplicito verifica la coda prima di consentire un nuovo salvataggio: una modifica presente conserva la propria identità, svuota l'input e permette soltanto la ripresa esplicita. La conferma resta legata alla ricevuta esatta; conflitti e riconciliazioni riaprono le scelte già previste.

Test DOM: ripresa senza nuova preparazione, ricevuta corretta, riconciliazione, coda vuota, lock negato/risultato incoerente e chiusura durante la lettura. Chrome/Edge con backend originale emulato verificano anche ambiguità, chiusura effettiva della connessione IndexedDB e nuova apertura con la stessa chiave sintetica, senza upgrade. Restano separati riapertura fisica PWA, rilascio preparatorio dello schema, provider bootstrap e trasporto reale: nessun cutover o migrazione è implicito.

### Dismissione del writer e del client — candidata 14/09/2026

Base `d4d2e644`, ramo `experiment/m6-queue-client-disposal`: close rilascia il riferimento alla chiave derivata e impedisce nuove esecuzioni. Anche le operazioni già entrate nel coordinatore verificano il writer ancora attivo prima di toccare la coda. Il client chiude il writer su abort e rimuove il listener; il materiale passato alla derivazione viene rilasciato dopo il suo completamento, compreso il riferimento nelle opzioni del client.

106 test offline superati; Chrome/Edge con backend emulato superati, 7 scenari generici e 15 privati per browser (44 esecuzioni). Verificati close durante un'operazione sospesa e abort del client: comandi locali conservati e nessun invio. L'ulteriore guardia sul tipo isActive è verificata dalla suite finale. Non si annullano retroattivamente una richiesta server o Web Crypto già partita e non si dichiara azzeramento fisico della memoria. Provider bootstrap, trasporto e rollout rimangono aperti; nessuno schema, upgrade o deploy.

### Adattatore Firebase della coda — candidata 14/09/2026

Base `82ab2002`, ramo `experiment/m6-firebase-queue-adapter`: il client fenced può usare i callable SDK canonici applyPrivateAccountMutation/applyOfflineMutation. Richiede Auth e Functions della stessa Firebase App, UID attuale, dominio esplicito e segnale di durata del Vault/vista. Osserva Auth, invalida il client su cambio identità o abort, chiude anche un client arrivato tardi e rilascia il riferimento al materiale della coda nelle proprie opzioni. Il comando è copiato prima delle attese SDK; domini o proprietari diversi vengono rifiutati prima dell'invio. I token Auth/App Check restano gestiti dall'SDK, senza header costruiti dall'adattatore o persistenza aggiunta.

113 prove offline superate; suite completa npm test superata prima dell'ultima regressione aggiunta, poi suite offline rieseguita. Chrome/Edge superano 9 scenari generici e 17 privati per browser (52 esecuzioni): IndexedDB, SDK Firebase originale, login Auth emulato, verifica JWT tramite Admin emulator e handler originali su Firestore demo. Il bridge richiede un header App Check sintetico: l'assenza viene rifiutata senza scrittura. Non è una certificazione del middleware onCall o dell'attestazione App Check remota.

Una risposta volutamente trattenuta dopo il commit prova che abort conserva il comando locale; un nuovo client risolve il retry con la stessa ricevuta senza cambiare updateTime. L'SDK callable ordinario installato non offre AbortSignal per interrompere la richiesta: dopo l'invocazione un effetto remoto può ancora avvenire, anche durante le attese interne dei token. Il client non lo presenta come rollback e non accetta una risposta tardiva nella sessione chiusa. Provider bootstrap, rollout schema/PWA, trasporto con middleware remoto e prove fisiche restano aperti. Nessuna attivazione runtime, upgrade, nuova cifratura, versione o deploy.

### Coda posseduta dalla shell — candidata 14/09/2026

Base `32db005f`, ramo `experiment/m6-shell-owned-queue`: il Vault in memoria può aprire la coda tramite una factory configurata soltanto dal bootstrap. La factory riceve il materiale della Vault già sbloccata e un contesto UID/dominio/segnale; alla chiamante viene restituita una facciata con soli enqueue, flush, pendingForRecord, discard, replace e close. Chiavi, database, SDK e proprietà extra della factory non attraversano la facciata. Le route continuano a ricevere soltanto i servizi già previsti, senza openMutationQueue: sarà il provider del pannello a collegare le azioni circoscritte al record.

Blocco, timeout, cambio identità, navigazione con il segnale della vista e logout anche fallito chiudono tutte le code possedute. Client arrivati dopo dismissione vengono chiusi; risposte tardive non raggiungono la sessione successiva. Il controllo UID si ripete anche se la notifica Auth è ritardata. Errori di una chiusura non impediscono le altre. Non esiste garanzia di cancellazione fisica dello heap o annullamento di richieste remote già invocate.

Suite completa npm test superata, inclusi 165 test shell (10 nuove regressioni di proprietà/lifecycle) e 15 test del collegamento Firebase emulato. La prova Firebase verifica che la factory riceva il materiale realmente estratto dall'envelope di prova. Le 52 esecuzioni Chrome/Edge passano ora attraverso Vault/sessione proprietaria prima dell'SDK: lock dopo commit conserva la coda; nuovo unlock risolve il retry senza riscrittura. App Check resta sintetico nel bridge. Restano provider UI per record, attivazione dell'entry, rollout IndexedDB/PWA e verifiche remote/fisiche. Nessuna migrazione, nuova cifratura, master, bump o deploy.

### Provider della nota privata — candidata 14/09/2026

Base c4e1a1a8, ramo experiment/m6-private-note-provider. Il provider collega il pannello della nota a openMutationQueue della shell e prepara il comando canonico sulla revisione mostrata, conservando gli altri campi. Espone al pannello soltanto operazioni circoscritte al record selezionato; UID, segnale della vista e del Vault vengono controllati anche dopo le attese. Gli observer della coda attraversano le stesse guardie e non notificano una sessione successiva. Una ricevuta di un altro record non aggiorna la vista.

Il readSource fidato deve fornire documento completo, proprietario e prova esplicita di assenza di collegamenti al profilo. Il provider non inventa tale prova e non viene attivato nell'entry principale. Restano i limiti del preparatore: account privato isolato con schema compatibile, nessun campo sconosciuto o banca/condivisione, cancellazione della nota vuota esclusa da questo incremento. Una proposta di conflitto richiede il comando esatto preparato nella stessa vista; dopo riapertura, senza provenienza durevole della modifica alla sola nota, resta il confronto in sola lettura con le azioni di recupero già previste.

Suite completa npm test superata; dopo l'aggiunta della prova di integrazione con il pannello reale, suite shell rieseguita: 178 test superati. La suite offline include la regressione del confronto senza proposta. Chrome/Edge: 52 esecuzioni demo esistenti superate; verificano coda/sessione/SDK, non ancora il nuovo provider nel browser. Il provider è verificato con fixture e pannello DOM simulato, compresi cambio UID senza notifica Auth, risposte tardive e conferma legata alla ricevuta. Restano collegamento dell'entry con lettore fidato, prova browser dedicata al provider, rollout schema/PWA e collaudi remoti/fisici. Nessun master, versione, migrazione o deploy.

### Lettore fidato e prova browser del provider — candidata 14/09/2026

Base 840128de, stessa PR #63 e ramo experiment/m6-private-note-provider. Il lettore Firebase usa getDocFromServer per Account e profilo e getDocsFromServer per tutte le aziende, senza filtrare contatti nascosti o aziende archiviate. Riusa la policy pura del backend per i collegamenti inversi: niente seconda interpretazione dei campi. Cache, scritture pendenti, documenti mancanti, alias incoerenti e cambio UID durante la lettura impediscono il montaggio. La query richiede al massimo 201 aziende: oltre 200 il percorso resta indisponibile, senza scambiare una lista troncata per assenza di collegamenti. Il proprietario viene fornito come metadato del percorso autenticato quando manca nel documento, senza migrazione; un valore esplicito discordante resta rifiutato.

La prova browser usa ora il vero provider e pannello, lettura dei profili tramite SDK Firestore, coda della shell, SDK callable e handler emulato. Controlla anche collegamenti inversi personali e aziendali prima del montaggio. I test unitari coprono assenza di prove e risposte tardive. Queste letture non sono una transazione con il futuro salvataggio: il backend ricontrolla comunque lo scope nella transazione di modifica. La prima apertura richiede rete; l'apertura iniziale offline non è chiusa da questo incremento.

L'entry del laboratorio resta in sola lettura: occorre ancora collegare trasporto locale, disponibilità della coda e gestione delle sorgenti non compatibili, senza rompere la consultazione degli altri Account. Non sono introdotti upgrade IndexedDB, attivazione in produzione, versione o deploy. App Check rimane sintetico nel bridge; rollout PWA e verifiche remote/fisiche restano aperti.

Validazione finale audit 80: npm test completo superato (183 test shell e 114 offline inclusi); Chrome/Edge superati, 9 scenari generici e 20 privati per browser, 58 esecuzioni totali. Compresi lettore Firebase reale, blocco dei link inversi e salvataggio del provider. App Check resta sintetico e il laboratorio principale non è ancora attivato.

### Attivazione nell'ingresso del laboratorio — candidata 14/09/2026

Base 8343282e, stessa PR #63. L'entry Firebase locale collega provider, lettore fidato e coda posseduta dalla shell. Il laboratorio crea solo code nuove e vuote in schema 2 sull'origine fissa http://127.0.0.1:4188; una coda schema 1 non viene aggiornata. La connessione segue la durata della vista/Vault. Il bridge accetta solo JWT degli utenti fittizi appena predisposti, header App Check sintetico e record privato alfa: invoca l'handler originale negli emulatori, mai Firebase remoto.

Il preparatore verifica la compatibilità prima di mostrare l'editor. Account non compatibili o letture indisponibili mantengono il dettaglio consultabile e un messaggio generico. La prova dell'entry ha individuato una rilettura dalla cache dopo la ricevuta: il refresh ora usa il repository canonico server-confirmed senza fallback alla vecchia nota. Il documento non viene ricaricato e il Vault resta gestito dalla shell.

Collaudo dedicato: node scripts/run-vault-session-emulators.mjs --entry-browser. Apre Chrome/Edge con profili temporanei, esegue login, Master Password sintetica, modifica della nota, conferma della nuova nota visibile, consultazione di Zeta incompatibile e blocco della vista. Nessuna credenziale reale. Il laboratorio interattivo si avvia con il comando già esistente prototype:vault-emulators. Questa attivazione non riguarda l'anteprima pubblicata o la PWA di produzione. Restano apertura iniziale offline, rollout schema/PWA, compatibilità estesa, App Check remoto e dispositivi fisici; nessun bump, master o deploy.

Validazione finale audit 81: suite completa npm test superata, inclusi 189 test shell e 114 offline. Regressioni Chrome/Edge della coda: 58 esecuzioni superate. Nuovo collaudo dell'entry: 5 verifiche per browser, 10 esecuzioni superate (68 totali). Dopo le ultime guardie di chiusura, rieseguiti i 21 test mirati di coda/dettaglio e il collaudo dell'entry. Nessuna prova App Check remota o su dispositivo fisico.

### Recupero della coda con rete browser disabilitata — candidata 14/09/2026

Base 48b1eae6, stessa PR #63. Quando navigator.onLine segnala offline, il provider non richiede nuove prove al server: monta esclusivamente il recupero della coda per il record selezionato. Il pannello nasconde il nuovo editor, conserva l'identità del comando e permette la ripresa esplicita. Una coda vuota non autorizza a preparare una modifica. Tornare online non trasforma questo pannello in un editor: per nuove modifiche serve riaprire il dettaglio e verificare le sorgenti. Errori dei controlli eseguiti online non vengono degradati automaticamente a prove offline.

Il collaudo --entry-browser usa il protocollo DevTools sul solo target temporaneo per disabilitare e ripristinare davvero la rete; un fetch HTTP deve fallire durante l'assenza di rete. Verifica nota preparata dopo una lettura online e salvata offline, blocco del Vault, nuovo sblocco offline, lettura dei dati già disponibili, riapertura del record e recupero della stessa coda. Un retry ancora offline conserva la modifica; dopo il ritorno online, il retry esplicito riceve conferma e aggiorna il dettaglio. Il PC e gli altri browser restano connessi.

Il test parte da una sessione autenticata e una cache già popolata: non certifica avvio a freddo senza rete, nuova autenticazione offline, riapertura fisica della PWA, consultazione bancaria o migrazione delle code. Non viene persistita alcuna Vault Key e non si aggiunge una cache di prove sui collegamenti. Restano rollout schema/PWA, compatibilità estesa e verifiche remote/fisiche; nessuna modifica a master, versione o deploy.

Validazione finale audit 82: npm test completo superato, inclusi 191 test shell e 116 offline. Chrome/Edge: 58 regressioni coda/provider e 18 verifiche dell'entry (9 per browser), 76 esecuzioni totali. La rete viene disabilitata dal protocollo DevTools, con HTTP effettivamente bloccato; superati recupero, nuovo sblocco offline e retry al ritorno online. Questa prova non certifica avvio a freddo o PWA fisica.
