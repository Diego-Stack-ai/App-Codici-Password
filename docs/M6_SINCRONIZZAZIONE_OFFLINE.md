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
