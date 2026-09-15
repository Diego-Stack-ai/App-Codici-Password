# M8 — Backup e recupero

> **Stato:** runtime v2 e collaudo storico disponibili; recupero complessivo non certificato.
> **Autorità:** contratto specialistico e registro prove; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** backup e ripristino.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

## Contratto

Il backup è un file cifrato, autenticato e versionato. L'intestazione espone soltanto formato, versione, proprietario, data e parametri crittografici; dati, record, allegati e metadati funzionali restano nel ciphertext. La Recovery Key è casuale, distinta dalla Master Password e mostrata una sola volta; l'app non può recuperarla.

Il laboratorio usa 192 bit casuali, PBKDF2-SHA256 a 600.000 iterazioni e AES-GCM-256 con intestazione autenticata. Prima di scrivere dati, l'importazione valida formato, versione, proprietario e autenticità. Il ripristino definitivo dovrà usare staging, confronto e transazione, mai sovrascrivere direttamente il Vault attivo.

Il formato runtime v2 usa righe cifrate AES-GCM concatenate da numero di sequenza e digest del blocco precedente. Il formato consente una scrittura progressiva e rende rilevabili manomissione, riordino e troncamento tramite il footer finale autenticato. Il formato v1 resta esclusivamente una fixture di laboratorio.

Emergency Access è separato: richiederebbe delegato, attesa, revoca e consenso verificabile. Non viene abilitato implicitamente dalla Recovery Key.

Il ripristino usa un **Vault fantasma** in sola lettura prima di qualsiasi scrittura: confronta il backup aperto in memoria con il Vault corrente e classifica ogni record come mancante, invariato o modificato. L'anteprima mostra denominazioni comprensibili senza esporre credenziali, collega gli allegati al relativo account e non scrive dati. Gli elementi mancanti sono preselezionati; quelli modificati richiedono una scelta manuale e una conferma digitata prima della sostituzione. Gli invariati non sono selezionabili.

## Gate

### Esportazione Excel separata dal backup — candidata 15/09/2026

Richiesta aggiuntiva di Diego: recuperare il ramo `codex/real-excel-export-preview`, pubblicato a `40052515`, e integrarlo selettivamente nella candidata shell. L'Excel è una copia di consultazione modificabile e non sostituisce il backup cifrato o la sua procedura di ripristino. Nessuna modifica effettuata ai dati reali o al ramo Excel originale.

Verifica del sorgente originale: `openValue()` non riconosce PUK e il contenuto cifrato dei Widget `fields[].valueEnc` tramite il solo nome del percorso; la modalità mascherata può quindi decifrarli. Il servizio mantiene inoltre la chiave legacy e non lega tutte le attese successive alla raccolta alla sessione; il collegamento XLSX ai campi aggiuntivi cerca il solo ID Account, ambiguo tra aziende. I menu Area/Azienda del prototipo non filtrano ancora il menu Account. Questi rilievi impediscono un'integrazione diretta senza correzioni.

Primo sottoblocco su base `45deb058`: `experiments/persistent-vault-shell/excel-export-projection.mjs`, proiezione dati autonoma, senza scritture o download. Usa la capability RAM, valida UID e identità dei record, scarta risultati dopo blocco/uscita/cambio utente, maschera prima della decifratura PIN/PUK e campi protetti dei Widget. La modalità completa richiede un booleano esplicito, ma questo controllo non sostituisce conferma utente e riautenticazione nell'orchestratore da integrare. Errori crittografici interrompono la preparazione, senza fallback al ciphertext o file parziale. Limiti: 10.000 record, profondità 32 e budget di 16 Mi caratteri/valori proiettati, non stima del picco heap.

12 test mirati e suite `npm test` completa superati, inclusi 290 test shell; sole fixture. Il modulo è ancora isolato: nessun file Excel finale, test di formule o download browser attribuito a questo incremento. Esclude conservativamente impostazioni tecniche, chiavi, foto e riferimenti/record allegati: la parità del progetto originale sugli allegati resta aperta, non dichiarata rimossa per decisione di prodotto. Il mascheramento usa nomi e metadati del modello corrente, non può riconoscere segreti scritti liberamente nelle note; il nome “copia protetta” non deve far credere che il file sia cifrato.

Prossimi passi: riusare il generatore XLSX con identità composta dominio/azienda/Account e selettori funzionanti, normalizzare nomi e limiti Excel, testare le formule e l'assenza di formula injection nei valori, gestire metadati allegati senza esportare chiavi, integrare consenso/annullamento e controllo di sessione fino al download. Conservare separatamente il servizio originale finché il nuovo percorso non ha tutte queste prove. Rollback del sottoblocco: rimuovere solo modulo e test sperimentali, nessuna migrazione. Nessun bump, merge master, deploy o chiusura dei gate M8.

- [x] formato cifrato e versionato;
- [x] integrità e manomissione verificate automaticamente;
- [x] Recovery Key distinta progettata e testata;
- [x] identità proprietario vincolata al contenitore;
- [x] Emergency Access separato esplicitamente;
- [x] manifest allegati con riferimenti, dimensioni e digest verificati nel laboratorio;
- [x] importazione isolata in staging e piano transazionale con blocco collisioni nel laboratorio;
- [x] contratto backend dei chunk di ripristino: allowlist delle collezioni, percorsi costruiti dallo UID autenticato, limiti per record/chunk, collisioni e idempotenza verificati;
- [x] formato runtime v2 incrementale, autenticato e concatenato implementato e verificato;
- [x] esportazione runtime integrata con i dati e gli allegati reali; usa scrittura progressiva quando il browser espone File System Access e fallback Blob su iOS; file `.cpbackup`, Recovery Key a visualizzazione singola e conferma di salvataggio verificati fisicamente il 09/09/2026 con account di prova;
- [x] comando Backup cifrato integrato nelle Impostazioni con caricamento differito, scelta esplicita del file e Recovery Key mostrata una sola volta con conferma obbligatoria di salvataggio;
- [x] callable transazionale `restoreBackupChunk` distribuita con anteprima collisioni, allowlist, conversione tipi, limiti, idempotenza, App Check e sostituzione selettiva confermata;
- [x] lettore file in due passaggi e UI di ripristino distribuiti: verifica completa, nomi leggibili e anteprima precedono la selezione e la conferma digitata; allegati trasferiti soltanto per gli elementi scelti;
- [x] apertura fisica del `.cpbackup` con Recovery Key e anteprima server verificate il 09/09/2026: il Vault attivo ha prodotto il blocco collisioni previsto senza modificare dati;
- [x] collaudo fisico esporta/cancella/modifica/ripristina su account di prova completato il 09/09/2026: 3 elementi mancanti e 2 modificati sono stati riconosciuti e recuperati, compresi account privato, account aziendale, profilo/codice fiscale e allegato; il secondo confronto li ha classificati invariati.

Il collaudo del 09/09/2026 attesta il percorso riuscito descritto sopra. La release 1.2.70 aggiunge il ricaricamento della vista. Queste evidenze storiche non certificano il recupero in tutti i casi di interruzione né chiudono i requisiti della baseline dell’11/09.

## Verifica locale del 12/09/2026 e gate aperti

Sul commit applicativo indicato, `executeBackupRestore` applica transazioni separate fino a 400 record e carica gli allegati dopo i record. Due prove isolate del client, con servizi Firebase simulati e dati fittizi, confermano che un errore al secondo blocco lascia il primo già accettato e che un errore Storage arriva dopo l’applicazione del record allegato. Il backend conferma nel codice l’atomicità per singolo blocco; non è una transazione globale.

- [ ] progettare e collaudare staging, ripresa o compensazione fra blocchi e allegati;
- [ ] verificare retry fra esecuzioni diverse, collisioni e modifiche intervenute dopo l’anteprima;
- [ ] dimostrare assenza di riferimenti orfani e confronto finale su copia non produttiva;
- [ ] misurare memoria e dimensioni su iPhone e Windows.

L’export raccoglie i record in memoria e, senza File System Access, accumula il file in un Blob. Il formato incrementale non equivale quindi a memoria limitata al singolo record per l’intero runtime. Nessuna correzione del protocollo o migrazione è autorizzata da questo aggiornamento documentale.


## Protezioni candidate della sessione di ripristino — 13/09/2026

Base `141259d9`, ramo sperimentale. Prima il piano conservava lo UID del backup mentre la callable usava l'identità Firebase corrente: un cambio utente durante anteprima o conferma poteva far proseguire l'operazione nel contesto sbagliato. Il piano ora appartiene alla sessione che lo ha preparato; importazione, anteprima, invio dei blocchi e upload ricontrollano identità e validità prima/dopo le attese. Blocco Vault anche a UID invariato, logout, pagehide e dismissione annullano i passi successivi. I dialoghi di ripristino sono posseduti dall'azione e la chiave viene rimossa dagli input e dal piano alla chiusura. Un reader di file in attesa viene annullato quando possibile.

La protezione non annulla richieste callable o upload già iniziati, non è una transazione globale e non garantisce azzeramento fisico delle stringhe JavaScript in memoria. Dopo un tentativo di scrittura, un errore espone soltanto contatori tecnici e `mayHaveApplied`; la UI segnala un possibile ripristino parziale e richiede di verificare il Vault prima di ritentare, senza dichiarare semplicemente il backup non valido. Nessun retry automatico o compensazione.

Formato v2, parametri crittografici e schema dei dati restano invariati. Il comando callable richiede ora `expectedOwnerUid`, confrontato con lo UID autenticato prima di accedere a Firestore: copre anche il cambio identità durante il recupero asincrono del token SDK. Campo mancante o discordante produce `BACKUP_OWNER_MISMATCH`, senza fallback permissivo. Nessuna migrazione dei backup. Staging, confronto atomico rispetto all'anteprima, ricevute pregresse, ripresa complessiva e prove su dispositivi reali restano gate aperti.


Compatibilità e distribuzione: il nuovo backend rifiuta anche i client vecchi senza `expectedOwnerUid`; il vecchio backend non applica il controllo aggiunto. Servono ambiente di collaudo e distribuzione coordinata client/backend, con gestione delle copie PWA precedenti. Non distribuire soltanto il client dichiarando risolta la race del token. Un rollback non deve ripristinare un writer che accetta silenziosamente l'identità corrente al posto del proprietario previsto. Questo rilascio backend resta non eseguito e soggetto al gate strutturale esistente.


## Ricevute attendibili del ripristino — candidata 13/09/2026

Il nuovo writer salva la ricevuta in `mutationResults/{uid}/operations/{operationId}`, registro storicamente non scrivibile dai client. Un digest SHA-256 del comando normalizzato completo vincola proprietario, dominio, contenuti, consenso e suddivisione in blocchi. Un retry identico restituisce soltanto stato e conteggio verificati, prima di valutare le collisioni; non riscrive record cambiati dopo il primo ripristino. Una richiesta diversa con lo stesso identificatore viene respinta.

Le ricevute pregresse in `backupRestoreOperations` non vengono promosse: senza una ricevuta attendibile il writer rifiuta l'applicazione e richiede verifica. L'anteprima calcola le collisioni dai documenti effettivi. I test dell'handler reale con Firestore simulato coprono retry, payload cambiato, ricevute malformate e storiche; non certificano un ripristino end-to-end su Storage.

Questo blocco non risolve ancora il confronto atomico fra anteprima e applicazione, staging, compensazione o atomicità tra blocchi. Nessuna migrazione dei dati o distribuzione eseguita. Il rollback deve conservare sia il vincolo proprietario sia questo registro: tornare al vecchio writer riaprirebbe la fiducia nelle ricevute storiche.


## Confronto con l'anteprima — candidata 13/09/2026

Dopo il checkpoint `dc985f64`, la callable produce classificazione e versione del documento dalla stessa snapshot transazionale. La risposta contiene soltanto indice, stato e versione (`exists`, secondi/nanosecondi di `updateTime`), senza restituire i dati correnti. Il client conserva le versioni nella sessione del piano e le associa agli indici originali prima della selezione e della suddivisione dei blocchi. Non usa più una raccolta precedente del Vault per decidere il confronto.

In applicazione tutte le versioni, compreso il Profilo, vengono confrontate prima di scrivere. Creazione, cancellazione o modifica dopo l'anteprima fermano l'intero chunk con `stale-preview`, senza dati, ricevuta o audit scritti da quel chunk. La sostituzione confermata non aggira questo controllo. Il Profilo esistente richiede anch'esso la scelta e il consenso alla sostituzione. La ricevuta attendibile di un retry identico precede il confronto, perché il primo tentativo può aver già cambiato le versioni.

Una nuova anteprima è obbligatoria dopo un esito obsoleto. Se blocchi precedenti sono stati applicati, la UI segnala il ripristino parziale; i successivi blocchi e upload non partono. Il formato del file e la cifratura restano invariati. Il protocollo callable cambia: backend vecchio senza `previewVersion: 1` viene rifiutato dal client; backend nuovo richiede `expectedVersion` per ogni record applicato. Rilascio coordinato e rollback che conservi tutti i controlli restano necessari.

Questa è atomicità del singolo chunk Firestore, non dell'intero backup: staging, compensazione, ripresa fra esecuzioni e Storage restano aperti. Le prove automatiche con servizi simulati non sostituiscono il collaudo del ripristino sui dispositivi.

Verifica dei tipi: i byte vengono ricostruiti come Buffer compatibile con Admin SDK; export e confronto rifiutano numeri non finiti anziché convertirli implicitamente in null. Nessun nuovo formato o conversione dei file precedenti.


## Ripresa nella stessa sessione — candidata 13/09/2026

Dopo il checkpoint Archivio `f67c8d7b`, l'esecuzione Firestore conserva un piano privato immutabile: selezione, chunk, consenso, versioni e identificativi vengono preparati una sola volta. Una sola chiamata per piano può essere in corso. Dopo una risposta persa il client può reinviare il chunk incerto soltanto su scelta esplicita, con identico comando; quelli già confermati vengono saltati. Il server verifica la ricevuta protetta prima del CAS. Non si rigenerano silenziosamente versioni o identificatori.

La UI mantiene piano e chiave soltanto mentre offre «Verifica e riprendi» nella sessione attiva. Interrompi, blocco Vault, cambio identità o dismissione chiudono il dialogo e rilasciano il piano. Nessun retry automatico. Rifiuti definitivi e anteprima obsoleta non vengono ritentati; un esito incerto dopo l'inizio di Storage blocca la ripetizione generica. Dopo successo una seconda chiamata restituisce il risultato già registrato, senza ripetere gli upload.

Questo passo non salva un journal durevole, non riprende dopo refresh, non fornisce staging degli oggetti né compensazione globale. La retention delle eventuali copie intermedie richiede una decisione distinta prima di attivarle. Il formato cpbackup resta invariato.


### Prerequisiti verificati per lo staging degli allegati — 13/09/2026

Il runtime allegati v1 usa AAD costante `CodiciPassword-Attachment-v1`: percorso Storage, nome e ID Account non entrano nella cifratura o nel wrapping. Il prototipo di condivisione lega invece recordId/attachmentId, che devono restare invariati, ma non storagePath. Il contenitore backup v2 è distinto dal formato dell'allegato. I legacy senza `encryption` vengono aperti tramite URL e richiedono classificazione separata: nessuna riscrittura automatica.

Una futura promozione deve verificare digest/dimensione/generazione dello staging e copiare su un nuovo percorso finale nel prefisso dell'Account: un riferimento permanente sotto restoreStaging sarebbe rifiutato dal purge. Le Rules attuali consentono al proprietario di modificare gli oggetti, quindi un controllo iniziale non prova immutabilità. Staging e promozione non sono implementati da questa annotazione.

Correzione export candidata `630972ec`: supportato il tipo Bytes restituito dal vero SDK Web Firestore, oltre a Uint8Array. Il test usa la classe SDK installata e conserva il tag bytes esistente; nessun nuovo formato di backup.


### Manifest degli allegati selezionati — candidata 13/09/2026

L'importazione riusa la raccolta ricorsiva dei percorsi dell'export: include riferimenti annidati in aziende/scadenze e altri scope, deduplicando gli oggetti. Il manifest dell'esecuzione rimane immutabile nei retry. Prima delle scritture, ogni oggetto selezionato deve essere presente nel backup; upload e conteggio seguono soltanto quel manifest, senza creare oggetti orfani non referenziati.

La prima lettura rifiuta oggetti duplicati, percorsi di altri proprietari e contenuti mancanti, vuoti, base64 malformati o eccessivi. La lunghezza viene limitata prima della conversione base64; i byte non vengono conservati nel piano. Il recupero selettivo degli elementi validi resta possibile se il file manca per un record non selezionato. Nessuno staging remoto o cambio implicito degli URL legacy.

### Lettura incrementale del file — candidata 13/09/2026

Il percorso alternativo senza TextDecoderStream legge porzioni da 64 KiB con decodifica UTF-8 incrementale e rigorosa. Entrambi i percorsi limitano la riga prima della concatenazione, interrompono la lettura al blocco del Vault e rifiutano record oltre il limite prima di accumularli nel piano. Le prove backup passano: 58 test.

Il limite per riga tiene conto della doppia codifica base64 degli allegati. Questo non limita ancora la memoria aggregata dei record né i temporanei crittografici del singolo allegato; il completamento del requisito memoria M8 resta aperto.


### Identità degli allegati fra le due letture — candidata 13/09/2026

Il piano privato conserva il digest crittografico dell'involucro di ciascun allegato già calcolato durante la verifica iniziale. Prima di ogni upload la seconda scansione deve produrre lo stesso digest per il percorso selezionato; duplicati e contenuti cambiati interrompono il ripristino. Non vengono caricati byte diversi da quelli verificati nell'anteprima. I digest vengono rilasciati con la sessione.

Le scritture Firestore precedenti possono essere già avvenute: l'errore conserva l'indicazione di ripristino parziale e blocca il retry generico Storage. Non è una transazione globale o uno staging. Suite backup: 61 test superati, inclusi tre nuovi casi sulla seconda lettura.


### Transazioni nel database emulato — candidata 13/09/2026

Il runner delle mutazioni include il callable originale restoreBackupChunk su Firestore/Auth demo locali: 32 test complessivi superati, inclusi sette test backup (contenitore e sei scenari). Verificati CAS su Profilo/Account, creazione/cancellazione concorrente, consenso, retry attendibile prima del CAS, isolamento proprietario, byte e timestamp reali e Rules delle ricevute. Il test invoca direttamente l'handler: non certifica trasporto HTTPS, App Check remoto, trigger o Storage distribuito.


### Limiti dell'anteprima in memoria — candidata 13/09/2026

Base `b4bec892`, ramo `experiment/m8-restore-memory-budget`: durante la prima scansione vengono ammessi al massimo 10.000 record e 16 Mi caratteri JSON complessivi dei record, più 10.000 allegati e 2 Mi caratteri per percorsi/digest trattenuti. I limiti sono controllati prima dell'inserimento nelle strutture dell'anteprima e prima di qualsiasi chiamata di confronto/ripristino. Restano anche i limiti per riga, singolo record e allegato. Superamento: nessun ripristino, rilascio della sessione e messaggio che invita a conservare il file; non viene classificato come backup corrotto.

Sono soglie conservative di ammissione, non una misura esatta dello heap: oggetti JS, descrizioni, confronto, decifratura del singolo elemento e copie temporanee hanno costi aggiuntivi. Il limite di 16 Mi caratteri rappresenta fino a 32 MiB per una sola rappresentazione UTF-16; non significa 32 MiB di RAM totali. Servono misurazioni sui dispositivi supportati prima di certificare il requisito memoria M8. Quattro nuove prove coprono superamento cumulativo, limite esatto, interruzione prima dei record successivi e messaggio UI; suite backup 65 test superati. Staging, journal durevole e compensazione restano aperti. Nessuna modifica al formato, al backend, ai backup esistenti o ai dati reali.

### Unicità globale delle destinazioni — candidata 13/09/2026

Base `5fa297ab`: la prima scansione identifica le destinazioni con tuple non ambigue e le rifiuta se duplicate, anche fra chunk diversi. Profilo con ID descrittivi diversi e Widget privati/aziendali con lo stesso ID fisico non costituiscono record separati. I separatori contenuti negli ID non provocano false collisioni; campi di contesto ignorati dal backend non creano false identità. Il confronto locale usa la stessa identità. Il server resta responsabile della validazione e delle autorizzazioni.

Suite backup: 68 test superati. Il test di equivalenza confronta le identità client con restorePath del backend per tutti i domini; due regressioni verificano duplicati oltre 400 record e alias Profilo/Widget, senza chiamate server o upload. L'insieme delle identità è limitato dalle soglie d'anteprima e rilasciato con la sessione. Non rende atomico il ripristino: staging/journal e concorrenza globale restano aperti.

### Esportazione vincolata alla sessione — candidata 14/09/2026

Base `4dd2f0a2`, ramo `experiment/m8-export-session`: export e raccolta dati verificano proprietario, abort, blocco Vault e pagehide ai confini asincroni. Dopo invalidazione non iniziano nuovi download, cifrature o scritture; il sink viene annullato quando il passaggio in corso restituisce il controllo. Errori del provider non vengono riportati con dettagli sensibili. Conferma e Recovery Key appartengono alla stessa azione: chiusura e cambio sessione rimuovono il valore dal DOM; risposte tardive non riaprono finestre né riabilitano un'esportazione nuova.

Suite completa npm test superata; 11 prove servizio e 17 prove UI superate (l'ultima regressione UI sul rimontaggio eseguita separatamente dopo l'avvio della suite). Prove sintetiche, non collaudi fisici. Non si può annullare retroattivamente un file già chiuso, un download già avviato o una richiesta clipboard già consegnata al browser; picker nativo e operazioni pendenti non sono resi interrompibili. Le variabili rilasciate non provano azzeramento fisico della memoria JavaScript. Formato e parametri crittografici invariati; staging, journal durevole, compensazione e limiti aggregati dell'export restano aperti. Nessun deploy.

### Limite del download in memoria — candidata 14/09/2026

Base `fc3927d2`, ramo `experiment/m8-export-buffer-limit`: il fallback senza File System Access ammette fino a 64 Mi caratteri di righe JSON già cifrate. Il controllo cumulativo precede l'accumulo; superamento o annullamento rilasciano i frammenti e impediscono la creazione di un download parziale. La UI propone un browser con salvataggio diretto su file. Il percorso progressivo non usa questo buffer e il formato non cambia.

È una soglia conservativa del solo contenuto trattenuto, non un limite certificato di RAM: raccolta dei record, cifratura del singolo elemento, conversioni, Blob e copie del browser hanno costi ulteriori. Le misure fisiche e il limite della raccolta iniziale restano aperti. Suite backup: 90 prove superate, comprese frontiera esatta, overflow cumulativo, assenza di download troncato, successo fallback e messaggio UI. Manifest offline rigenerato; controlli offline, riferimenti statici, budget delle 30 pagine e sintassi superati. Nessun deploy.

### Ammissione dei record raccolti — candidata 14/09/2026

Base `29263519`, ramo `experiment/m8-export-record-limits`: massimo 10.000 descrittori e 16 Mi caratteri JSON cumulativi, coerenti con le soglie record dell'anteprima di ripristino. Ogni descrittore è controllato prima dell'inserimento; gli Account e allegati non creano più un secondo array aggregato per Account. Su superamento la raccolta si interrompe, non prosegue con altre letture e non cifra record o footer; lo stream aperto viene annullato. Messaggio distinto dal limite del download Blob: cambiare browser non aggira il limite dei record.

93 prove backup superate; budget statici e sintassi superati. Sono limiti di ammissione dei descrittori trattenuti, non delle snapshot SDK già ricevute o della serializzazione temporanea del singolo record. Paginazione delle letture, manifest percorsi, memoria sui dispositivi, staging e journal restano aperti. Nessun formato, soglia import, versione o deploy modificato.
