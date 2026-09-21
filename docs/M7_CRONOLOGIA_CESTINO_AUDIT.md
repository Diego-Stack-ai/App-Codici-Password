# M7 — Cronologia, cestino e audit

> **Stato:** funzioni implementate e collaudo storico registrato; retention complessiva non approvata.
> **Autorità:** contratto specialistico e registro prove; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** cronologia, cestino e purge.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

## Contratto

- la cancellazione ordinaria sposta il record in un cestino cifrato;
- la conservazione senza scadenza automatica descritta dal primo laboratorio non è approvata come politica di produzione;
- prima del go-live deve essere definita una retention esplicita, con cancellazione, backup e possibili obblighi legali;
- il cestino conserva ID, proprietario, revisione e data di archiviazione; il contenuto resta ciphertext;
- il ripristino fallisce se l'ID è occupato e crea una nuova revisione;
- il purge è backend-only, esclusivamente manuale e richiede sempre conferma forte;
- revoca e ripristino non riattivano grant precedenti;
- la cronologia è limitata agli eventi necessari, non a snapshot illimitati;
- l'audit usa un'allowlist e non registra password, chiavi, token, ciphertext o testo libero.

Il laboratorio `experiments/history-recovery` dimostra una retention tecnica di prova, ripristino senza sovrascrittura, revisione, redazione dei segreti e limite della cronologia. Non modifica la produzione e non approva una conservazione indefinita.

## Gate

- [x] conservazione senza scadenza automatica e condizioni di purge manuale definite;
- [x] ripristino senza sovrascrittura silenziosa;
- [x] audit con allowlist e senza segreti;
- [x] cronologia limitata;
- [x] Archivio Account riutilizzato come UI cestino; i nuovi elementi ricevono data e revisione, senza scadenza automatica; anche gli eventuali record con il vecchio `purgeAfter` richiedono la cancellazione manuale;
- [x] Rules verificate e callable atomica/idempotente distribuita;
- [x] conferma forte della UI collegata alla callable backend `purgeArchivedAccount`, con controllo archivio/revisione, ripresa idempotente, rimozione degli allegati confinata allo UID e scollegamento delle email del Profilo;
- [x] archiviazione, ripristino, permanenza senza scadenza automatica e cancellazione definitiva manuale verificati fisicamente il 09/09/2026 con account di prova dopo la distribuzione del nuovo contratto.

Il 09/09/2026 è stato accettato il collaudo funzionale descritto sopra. Non costituisce approvazione della retention complessiva né certificazione rispetto alla baseline adottata l’11/09.

## Decisione di retention aperta

Per chiudere il requisito di retention della baseline occorre stabilire, senza annullare il collaudo storico delle funzioni già implementate:

- durata ordinaria del cestino;
- eliminazione immediata richiesta dall’utente e relative eccezioni legali;
- rapporto tra cestino, cronologia, allegati e backup;
- purge verificabile e idempotente;
- informazione mostrata all’utente;
- prova che il dato non resti raggiungibile nei percorsi applicativi.

La cifratura riduce l’esposizione ma non giustifica la conservazione illimitata.

**Censimento collegato (M7-R1, 21/09/2026):** [`M7_RETENTION_CENSIMENTO.md`](./M7_RETENTION_CENSIMENTO.md) documenta il comportamento attuale di cestino, cronologia/audit, allegati e backup con citazioni verificabili, propone opzioni di politica e una matrice di test sintetici e raccoglie le domande decisionali. **Non decide** durate, eccezioni legali o cancellazioni definitive e non approva alcuna retention.


## Riesame dopo evoluzione Profili — 13/09/2026

Base `141259d9`: la pulizia finale di `purgeArchivedAccount` considerava soltanto `contactEmails` privato e confrontava il solo ID. La stessa stringa ID in Account privato e aziendale non identifica lo stesso record: questa collisione può scollegare un contatto estraneo. Telefoni, documenti, utenze e riferimenti nelle aziende non erano inclusi. Il nuovo blocco candidato deve distinguere contesto/azienda e conservare dati del contatto, note e valori cifrati.

Restano distinti e aperti:

- `accountWidgets` e `sharedVaultLinks` sono collezioni sorelle del documento Account, quindi la cancellazione ricorsiva dell'Account non li include. La pulizia deve eliminare soltanto il collegamento dell'Account; il valore comune usato altrove va conservato.
- Ripristino da Archivio e preparazione del purge non condividono un protocollo transazionale che impedisca il ripristino fra verifica iniziale e cancellazione. Il solo aggiornamento della pulizia finale non chiude questa race.
- Ripristino e grant legacy richiedono una prova specifica di mancata riattivazione delle autorizzazioni precedenti.
- Storage, cancellazione ricorsiva e transazione finale sono passaggi distinti: l'atomicità globale e la ripresa completa non sono certificate.

L'audit finale attuale usa una allowlist di campi tecnici, senza segreti. Nessuna decisione di retention, operazione su dati reali o pubblicazione deriva da questo riesame.


### Pulizia candidata dei collegamenti dopo purge — 13/09/2026

Il pianificatore `planProfileReferenceCleanup` distingue `{context, companyId, accountId}` e aggiorna solo i campi che contengono un riferimento esatto. Copre i campi noti dei Profili privati e aziendali, mantenendo il resto del contatto. La transazione finale legge Profilo e tutte le aziende prima delle scritture; un retry rilegge i dati correnti. Il completamento avviene insieme alle patch e all'audit finale. Una precedente operazione `processing` senza Account riprende la pulizia; `purged` conserva il comportamento di retry esistente. Questo non certifica la provenienza storica delle ricevute `archiveOperations`, distinta dal nuovo registro M6.

Limiti: scansione completa delle aziende, crescita dei costi e della contesa; massimo conservativo di 450 documenti modificati più ricevuta/audit. Un piano troppo ampio o malformato interrompe la transazione finale, lasciando `processing` e nessuna pulizia parziale; l'Account può però essere già stato eliminato dal passaggio precedente. Non è un rollback né una soluzione alla race purge/ripristino. Nessuna migrazione di alias o intervento sui dati reali.

Compatibilità M6: il vecchio purge scriveva `linkedAccountId: null`. Il guard dei riferimenti accetta ora questo marker di collegamento assente, senza modificarlo. Un ID reale con `linkedAccountCompanyId: null` continua a essere trattato come collegamento privato e impedisce il writer ridotto. Il nuovo unlink usa stringhe vuote per entrambi i campi, come la UI corrente.


### Proprietario e sessione dell'Archivio — candidata 13/09/2026

Il purge richiede `expectedOwnerUid`, confrontato con Auth prima della validazione del comando e di qualunque accesso a Firestore o Storage. Questo impedisce che un token scelto dall'SDK dopo il cambio utente esegua il comando nel Vault successivo. I client precedenti senza proprietario atteso sono rifiutati: il rilascio richiede aggiornamento coordinato e rollback che mantenga il controllo.

Il lavoro sul ciclo di vita UI/servizio accompagna il controllo server: acquisire Account e proprietario prima dei dialoghi, annullare le azioni ancora in attesa dopo blocco/cambio sessione, fermare lo svuotamento prima del record successivo e distinguere Account con ID uguali in contesti diversi. Una richiesta già inviata può comunque completarsi. Il vincolo proprietario non risolve le ricevute `archiveOperations` storicamente scrivibili dal client né la race globale purge/ripristino.


### Ricevute protette del purge — candidata 13/09/2026

Il registro di avanzamento si sposta in `mutationResults/{uid}/operations/{operationId}`, storicamente negato alle scritture client. Il binding server comprende proprietario, dominio, Account/contesto/azienda, revisione, conferma e hash dell'intero comando normalizzato. Conferma obbligatoria anche per riprese e duplicati. Le vecchie ricevute `archiveOperations`, da sole, provocano un rifiuto esplicito; non sono promosse. Un esito protetto valido prevale sul legacy, mentre un esito protetto malformato non autorizza fallback.

La transazione iniziale accetta soltanto ricevute verificate: `processing` consente ripresa del comando identico, mantenendo i controlli archivio/revisione se l'Account esiste; `purged` restituisce solo stato e indicatore duplicato. La transazione finale rilegge e verifica il binding prima delle patch dei Profili, della ricevuta finale e dell'audit. Il timestamp iniziale viene conservato nei retry.

Questo blocco corregge la provenienza degli esiti, non il protocollo globale: una richiesta già partita, la race purge/ripristino e i widget/grant residui restano problemi separati. La UI genera ancora un nuovo identificatore ad ogni operazione: ripresa backend con lo stesso ID collaudata, recupero UI degli esiti incerti non ancora implementato. Nessuna migrazione delle ricevute pregresse o cancellazione reale.


### Ripresa dell'eliminazione nella stessa sessione — candidata 13/09/2026

Dopo la conferma iniziale, il servizio prepara un piano opaco con comandi e identificativi immutabili. Se la risposta del purge non arriva, la UI propone «Verifica e riprendi»: solo quella scelta riutilizza il comando incerto. Nello svuotamento vengono saltati gli Account già confermati. Una sola operazione per volta; filtro e altre mutazioni non partono durante l'eliminazione. Rifiuti definitivi bloccano il piano; interrompere mantiene visibili gli elementi non confermati e segnala l'eventuale eliminazione parziale.

Blocco Vault, logout e cambio montaggio eliminano il piano; i vecchi callback non possono ripartire. Le API precedenti del servizio restano utilizzabili senza retry automatico. Il recupero UI copre adesso la stessa sessione aperta, non un refresh o un nuovo accesso. Nessun journal durevole e nessuna soluzione implicita alla concorrenza globale purge/ripristino.

### Piano dei riferimenti residui, non attivato — candidata 13/09/2026

Il planner puro archive-purge-reference-plan distingue widget incorporati, coppie widget/link e inviti tramite identità esatte; non deduce i documenti dai prefissi. Le credenziali centrali sharedVaultData non vengono eliminate, anche se prive di altri collegamenti. Sono proposte soltanto revisioni esistenti e incrementabili. Coppie incomplete, riferimenti incrociati anche provenienti da altri Account, inventario non attestato o budget residuo insufficiente annullano tutta la proposta. Undici test dedicati e 121 test Functions superati.

Un piano coerente restituisce comunque applicable:false: non è collegato al purge. La completezza è dichiarata dal chiamante, non provata dal planner. Prima dell'attivazione occorre un blocco comune rispettato da ripristino Archivio, widget/link, inviti, Rules e ripristino backup; il solo controllo dell'esistenza dell'Account non basta. I grant M5 candidati non sono dedotti dagli ID legacy. I percorsi degli inviti possono contenere email: il piano è interno e non va scritto nei log o negli eventi audit.


### Ripristino con confronto transazionale — candidata 13/09/2026

Base `4fba54e7`, ramo `experiment/m7-archive-restore-cas`: il ripristino rilegge nella transazione l'identità selezionata e richiede Account esistente, ancora archiviato e revisione uguale a quella scelta. La revisione deve essere intera sicura e incrementabile; soltanto l'assenza legacy equivale a zero. Null, stringhe, revisioni negative o fuori intervallo sono rifiutate. Il cambio sessione dopo la lettura impedisce la scrittura. In caso di conflitto la riga rimane visibile e il messaggio chiede di aggiornare l'Archivio.

25 test del servizio/UI superati. Il runner mutazioni include inoltre il servizio canonico con Auth/Firestore demo: successo, revisione obsoleta/stato già ripristinato, retry SDK dopo aggiornamento concorrente e invalidazione sessione dopo lettura. I casi negativi conservano contenuto e updateTime; i test usano esclusivamente dati sintetici. Il ripristino non retrocede più la revisione usando soltanto la snapshot UI.

Il CAS non chiude la race purge/ripristino: la preparazione purge non marca ancora il documento e recursiveDelete resta fuori dalla transazione. Il futuro protocollo comune deve essere rispettato da tutti i writer, Rules, Widget/link, inviti e backup prima di attivare il planner residui. Nessuna modifica a retention, backend o dati reali in questo blocco.


## Retention del registro tecnico — decisione 21/09/2026 e progetto candidato

**Decisione del proprietario.** Gli eventi tecnici di `users/{uid}/auditEvents` sono conservati per **24 mesi** dal timestamp autorevole e poi cancellati automaticamente da un processo **controllato dal backend**; l'app client non può creare, modificare o cancellare singoli eventi di audit. Diego ha indicato 12 mesi e poi corretto a **24 mesi** il 21/09/2026: prevale la seconda indicazione. La durata è una decisione di prodotto per questo registro e **non** un termine legale generale: eventuali obblighi specifici di conservazione restano da verificare. La decisione **non** si estende alle ricevute di idempotenza (`mutationResults`, `operationResults`, `archiveOperations`, `backupRestoreOperations`), ai backup, ai log di piattaforma o agli Account archiviati, che restano senza scadenza automatica.

**Stato: candidato di laboratorio, NON attivo in produzione.** Non esistono job schedulati di potatura, le Rules produttive non sono cambiate e nessun dato reale è stato cancellato o letto. `functions/index.js`, `firestore.rules`, `storage.rules` e `Frontend/public/**` restano invariati.

### Perimetro del registro

Entrano in `auditEvents` i cinque percorsi già censiti in [M7_RETENTION_CENSIMENTO.md](./M7_RETENTION_CENSIMENTO.md) §4.1: `trashed`/`restored` (`trashSyncRecord`/`restoreSyncRecord`), `account-purged` (`purgeArchivedAccount`), `shared-vault-<azione>`, `account-widget-<azione>` e `backup-restore-chunk`. Nessun altro scrittore è previsto; un nuovo scrittore dovrà rispettare il timestamp autorevole descritto sotto.

### Timestamp autorevole

Il timestamp è `at`, impostato dal backend con `serverTimestamp` in tutti e cinque i percorsi. Il candidato accetta le forme con cui Firestore restituisce un Timestamp (istanza SDK, `{seconds, nanoseconds}`, `Date` nei test) e considera **inverificabile** qualunque altro valore.

### Record legacy o malformati

Un evento privo di data valida non viene mai cancellato: è classificato `unverifiable`, resta nel registro e viene elencato dall'esecuzione. La scelta è deliberata — non si inventa una data per eliminare un record che non si sa datare — ed è il motivo per cui una futura bonifica dei record storici senza `at` resta una decisione aperta.

### Cancellazione a lotti

Il piano è deterministico: solo eventi scaduti e databili, ordinati dal più vecchio con spareggio sull'id, divisi in lotti entro il limite di **500 operazioni per batch** di Firestore (dimensione predefinita 200) e con un tetto di **10.000 eventi per esecuzione**. L'ordine stabile rende il piano riproducibile.

### Idempotenza, errori e ripresa

La cancellazione di un documento già assente è un no-op; il piano si ricalcola dagli eventi ancora presenti, quindi ripetere l'esecuzione non duplica effetti e un lotto già cancellato non riappare. Un errore di lotto interrompe l'esecuzione e riporta `partial` con il lotto fallito, **senza mai dichiarare completato** ciò che non lo è; una sessione chiusa interrompe senza cancellare oltre. La ripresa riparte dagli eventi residui.

### Esclusione delle ricevute e isolamento fra UID

Ogni percorso pianificato deve iniziare con `users/{uid}/auditEvents/`: id non conformi sono rifiutati e un evento attribuito a un altro UID interrompe il piano. Le ricevute di idempotenza non sono mai toccate, né pianificate.

### Visibilità all'utente

Non esiste un'interfaccia che mostri la cronologia: nessun modulo di `Frontend/public/assets/js` legge `auditEvents`. Il candidato mantiene la **lettura** del proprietario e nega ogni scrittura client; l'eventuale futura visibilità all'utente richiederebbe una decisione di prodotto separata.

### Dipendenze e decisioni ancora aperte

- **Convenzione della finestra**: il candidato usa mesi di calendario (con giorno limitato nei mesi corti); l'alternativa è un multiplo fisso di giorni. Da confermare.
- **Record storici senza `at`**: conservazione permanente o bonifica manuale documentata.
- **Obblighi legali specifici**: dipendenza dichiarata, nessuna deroga inventata.
- **Job reale**: cadenza, ambiente di collaudo, monitoraggio, allarme e rollback non sono progettati da questa fetta.
- **Rules produttive e distribuzione**: la rimozione della scrittura client sull'audit richiede la modifica delle Rules effettive e un rilascio coordinato, autorizzati separatamente.

### Prove di laboratorio disponibili

- `experiments/history-recovery/audit-retention.mjs` — pianificatore ed esecutore puri, non importati dall'app né da Functions.
- `experiments/history-recovery/audit-retention.test.mjs` — **12 prove sintetiche**: forme del timestamp, finestra di 24 mesi con limite di calendario, conservazione/scadenza al confine, dati non interpretabili mai cancellati, ordinamento e lotti, esclusione delle ricevute, isolamento UID, input fuori misura, completamento, errore parziale con ripresa idempotente, interruzione.
- `tests/history-recovery.rules.test.mjs` — Rules **candidate** (`experiments/history-recovery/firestore.candidate.rules`): lettura riservata al proprietario e **create, update e delete negati** al client su `auditEvents`, `trash` e `recordHistory`.
