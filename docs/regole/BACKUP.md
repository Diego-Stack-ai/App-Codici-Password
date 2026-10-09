# Backup

## Snapshot preventivo prima dei collaudi — 09/10/2026

Creato il bucket privato UE `appcodici-password-firestore-backup-eu-20261009`, con accesso uniforme, prevenzione accesso pubblico e soft-delete predefinito. Il service account Firestore ha `Storage Admin` limitato al bucket. Export gestito completo riuscito nel prefisso `pre-test-2026-10-09T15-10-09Z`: 551 documenti, 422,61 kB, completamento 17:15:02 Europe/Rome. È una copia Firestore verificata dalla Console; non include una prova di importazione/ripristino e non sostituisce il backup cifrato utente degli allegati Storage.

## Chiusura operativa M8 — 09/10/2026

M8 è chiuso per il ciclo corrente con il motore riprendibile mantenuto hard-off. Il backup/ripristino già distribuito resta nel perimetro verificato; staging riprendibile, cleanup remoto e compatibilità GCS non vengono dichiarati produttivi. Le relative prove reali sono trasferite a un eventuale ciclo futuro prima di qualunque attivazione.

## 05/10/2026 — ripresa e precisione temporale

Secondo le conferme M8-RP-01/M8-TS-01 in [DECISIONI](../progetto/DECISIONI.md), il piano minimo di ripresa si conserva per 30 giorni, con soli identificativi/versioni e senza password, chiavi o contenuti del backup. Alla scadenza serve una nuova anteprima, conservando i dati già ripristinati. Questa durata non modifica le retention delle altre categorie. Se una data del backup non è conservabile esattamente nel database, il ripristino deve essere bloccato con spiegazione, senza arrotondamento implicito. Requisiti approvati, implementazione e prove ancora da completare.

## 27/09/2026 — confine candidato degli oggetti di ripristino

Il namespace users/{uid}/restoreObjects è riservato a scritture server: le Rules locali negano create/update/delete client, inclusi metadati e sottopercorsi. Non usare un controllo client di assenza come precondizione atomica. Il candidato server crea con ifGenerationMatch:0 e verifica digest e generazione prima di qualunque futura pubblicazione; nessun endpoint o flusso app lo attiva ancora. La precondizione non è verificabile con l'emulatore installato, che nel probe l'ha ignorata: evidenza negativa in COLLAUDI, prova Storage separata ancora necessaria. Il 09/10/2026 il nucleo isolato di staging/ripresa ha superato 146/146 prove sintetiche in due blocchi; una successiva esecuzione ampliata dei gruppi resume/stage/chunk e dello staging backend registra 151 passaggi, 4 skip emulatori e zero errori su 155 casi. Il mapping attestato viene letto nella stessa transazione che pubblica il record, la lettura resta fissata alla generazione verificata, gli esiti incerti non autorizzano un caricamento generico e i trasporti interrompono la consegna azzerando le copie temporanee. Questa è evidenza del candidato, non del runtime distribuito. Restano trasporto e collegamento al flusso app, pulizia/purge coordinati, verifica remota delle precondizioni, scope/UI nell'app finale e compatibilità dei lettori. Nessuna modifica al formato backup o attestazione di chiusura M8.

## 27/09/2026 — autorità di condivisione nel ripristino Account

Implementazione locale del vincolo approvato 2B: il backup non è una fonte valida di autorizzazioni. Per Account privati e aziendali esistenti e attivi si conservano i campi di condivisione correnti letti nella stessa transazione CAS; per Account assenti o archiviati gli accessi del backup e quelli dormienti vengono neutralizzati. Anche la preview applica questa trasformazione, evitando differenze perpetue dovute alle vecchie autorizzazioni. La conferma UI avvisa che il ripristino può ricreare dati cancellati definitivamente ma non riattiva vecchie condivisioni. Non risolve staging Storage, ripresa in nuova sessione o concorrenza con purge.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Indice delle fonti conservate

- [M8_BACKUP_RECUPERO.md](#fonte-docs-m8-backup-recupero-md-l1)

<a id="fonte-docs-m8-backup-recupero-md-l1"></a>

## Fonte: M8_BACKUP_RECUPERO.md — righe originali 1–64

> Provenienza: `docs/M8_BACKUP_RECUPERO.md` a `2900ccc0`.

<a id="fonte-docs-m8-backup-recupero-md-m8--backup-e-recupero"></a>

## M8 — Backup e recupero

> **Stato:** runtime v2 e collaudo storico disponibili; recupero complessivo non certificato.
> **Autorità:** contratto specialistico e registro prove; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** backup e ripristino.
> **Dipendenze:** [Guida progetto](../LEGGIMI.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

<a id="fonte-docs-m8-backup-recupero-md-contratto"></a>

### Contratto

Il backup è un file cifrato, autenticato e versionato. L'intestazione espone soltanto formato, versione, proprietario, data e parametri crittografici; dati, record, allegati e metadati funzionali restano nel ciphertext. La Recovery Key è casuale, distinta dalla Master Password e mostrata una sola volta; l'app non può recuperarla.

Il laboratorio usa 192 bit casuali, PBKDF2-SHA256 a 600.000 iterazioni e AES-GCM-256 con intestazione autenticata. Prima di scrivere dati, l'importazione valida formato, versione, proprietario e autenticità. Il ripristino definitivo dovrà usare staging, confronto e transazione, mai sovrascrivere direttamente il Vault attivo.

Il formato runtime v2 usa righe cifrate AES-GCM concatenate da numero di sequenza e digest del blocco precedente. Il formato consente una scrittura progressiva e rende rilevabili manomissione, riordino e troncamento tramite il footer finale autenticato. Il formato v1 resta esclusivamente una fixture di laboratorio.

Emergency Access è separato: richiederebbe delegato, attesa, revoca e consenso verificabile. Non viene abilitato implicitamente dalla Recovery Key.

Il ripristino usa un **Vault fantasma** in sola lettura prima di qualsiasi scrittura: confronta il backup aperto in memoria con il Vault corrente e classifica ogni record come mancante, invariato o modificato. L'anteprima mostra denominazioni comprensibili senza esporre credenziali, collega gli allegati al relativo account e non scrive dati. Gli elementi mancanti sono preselezionati; quelli modificati richiedono una scelta manuale e una conferma digitata prima della sostituzione. Gli invariati non sono selezionabili.

<a id="fonte-docs-m8-backup-recupero-md-gate"></a>

### Gate

<a id="fonte-docs-m8-backup-recupero-md-esportazione-excel-separata-dal-backup--candidata-15092026"></a>

#### Esportazione Excel separata dal backup — candidata 15/09/2026

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

<a id="fonte-docs-m8-backup-recupero-md-verifica-locale-del-12092026-e-gate-aperti"></a>

### Verifica locale del 12/09/2026 e gate aperti

Sul commit applicativo indicato, `executeBackupRestore` applica transazioni separate fino a 400 record e carica gli allegati dopo i record. Due prove isolate del client, con servizi Firebase simulati e dati fittizi, confermano che un errore al secondo blocco lascia il primo già accettato e che un errore Storage arriva dopo l’applicazione del record allegato. Il backend conferma nel codice l’atomicità per singolo blocco; non è una transazione globale.

- [ ] progettare e collaudare staging, ripresa o compensazione fra blocchi e allegati;
- [ ] **PARZIALE (21/09/2026)** verificare retry fra esecuzioni diverse, collisioni e modifiche intervenute dopo l’anteprima: **retry** — su emulatori reali e dati sintetici una nuova sessione dello stesso file classifica i record già applicati, compreso il metadato dell'allegato i cui byte mancano, come «invariato» e non riprova nulla (`BACKUP_RESTORE_NOTHING_SELECTED`, zero caricamenti), mentre la ricevuta precedente non impedisce una nuova esecuzione se resta un record selezionabile (sezione «Nuovo tentativo dopo un ripristino interrotto»); **modifiche dopo l'anteprima** — il controllo di versione sul percorso reale rifiuta il blocco con `stale-preview` senza scrivere dati, ricevute o audit e senza caricamenti, con **una parzialità dichiarata** nel flusso a più blocchi, dove il rifiuto lascia applicati i blocchi precedenti (sezione «Modifica intervenuta dopo l'anteprima»); **collisioni multiple** — con due destinazioni modificate e una invariata, l'esecuzione senza selezione è rifiutata con `BACKUP_COLLISIONS` e la selezione di **un solo** modificato applica quello lasciando intatti l'altro modificato e l'invariato, con ricevute, audit e allegati coerenti con la selezione (sezione «Collisioni multiple con selezione e conferma»). **Non** esercitati: iPhone/Windows, backup di grandi dimensioni, più allegati per record, collaudi fisici. Gate complessivo lasciato **aperto** (restano staging, riferimenti orfani e collaudi fisici).
- [ ] **NON CHIUSA (21/09/2026)** dimostrare assenza di riferimenti orfani e confronto finale su copia non produttiva: su emulatori reali, con dati sintetici e il percorso reale `executeBackupRestore`, un **upload fallito dopo l'applicazione dei record** lascia il metadato dell'allegato in Firestore (che cita il percorso) **senza** i byte in Storage — riferimento orfano **osservato**, non dedotto. Dettagli e controllo positivo nella sezione qui sotto; gate lasciato **aperto**.
- [ ] misurare memoria e dimensioni su iPhone e Windows.

L’export raccoglie i record in memoria e, senza File System Access, accumula il file in un Blob. Il formato incrementale non equivale quindi a memoria limitata al singolo record per l’intero runtime. Nessuna correzione del protocollo o migrazione è autorizzata da questo aggiornamento documentale.
