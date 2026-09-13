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
