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
