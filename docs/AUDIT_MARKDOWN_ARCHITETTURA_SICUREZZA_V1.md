# Audit Markdown rispetto ad Architettura Sicurezza V1

> **Stato:** audit storico dell’11/09 con rettifica della gerarchia.
> **Autorità:** evidenza storica, non istruzioni operative correnti; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** audit dei Markdown.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

> **Rettifica di lettura — 12/09/2026:** questo audit conserva analisi e proposte dell’11/09. La gerarchia proposta nella sezione 2 è superata dalla gerarchia definitiva di [GUIDA_PROGETTO.md](./GUIDA_PROGETTO.md): contratti specialistici prima della guida implementativa. Riferimenti mancanti, conteggi e azioni proposte descrivono le fotografie indicate, non lo stato del repository corrente. Le prescrizioni operative della guida sono state riallineate nella revisione documentale v1.2.110; i rischi del runtime non sono per questo risolti.

> **Data:** 11 settembre 2026\
> **Baseline:** [ARCHITETTURA_SICUREZZA_V1.md](./ARCHITETTURA_SICUREZZA_V1.md)\
> **Branch esaminato:** `master`; fotografia iniziale `b67662b430208771674f59d4084a89b8f5ca38d2`, aggiornata durante il consolidamento documentale dell’11 settembre 2026\
> **Ambito:** tutti i 35 file Markdown presenti nella fotografia consolidata, incluso il piano di audit creato al termine del riallineamento.\
> **Metodo:** confronto documentale, con controllo puntuale di `firestore.rules` e `storage.rules` per separare dichiarazioni, laboratori e produzione.\
> **Limite:** questo rapporto non certifica il runtime pubblicato, Firebase Console, i dati reali o la robustezza crittografica. Non modifica automaticamente nessun documento esistente.

## 1. Esito generale

La documentazione contiene una base tecnica sostanzialmente valida, soprattutto nei documenti M5–M10. Non serve rivoluzionare tutto. Serve però correggere la gerarchia delle fonti e rimuovere alcune prescrizioni storiche che oggi possono indirizzare un agente verso decisioni incompatibili.

I problemi principali sono:

1. `Frontend/GUIDA.md` si dichiara unica fonte di verità, ma contiene prescrizioni superate o in conflitto con la nuova baseline.
2. La stessa Guida prescrive la permanenza della MasterKey in `sessionStorage`; la baseline ammette chiavi sbloccate soltanto in memoria, salvo un futuro protocollo esplicitamente dimostrato.
3. La Guida descrive una bonifica automatica “Cripto-Healing” dei record legacy; la baseline vieta migrazioni silenziose e richiede inventario, doppio lettore, verifica e rollback.
4. `M7_CRONOLOGIA_CESTINO_AUDIT.md` prevede cestino cifrato senza scadenza automatica; manca una retention approvata ed è in conflitto con minimizzazione e cancellazione.
5. La documentazione corrente cita contratti non più presenti nel branch, compreso `VAULT_KEY_CONTRACT.md`, che dovrebbe essere un riferimento critico.
6. Il modello professionale di condivisione M5 è ben progettato ma risulta ancora candidato/laboratorio; il runtime corrente conserva un percorso legacy con ACL e metadati in chiaro.
7. L’offline delle scritture ha prove positive, ma la consultazione reale di un account bancario su iPhone è documentata come non superata.
8. App Check risulta configurato nel client, ma l’enforcement reale di Firestore e Storage non è documentato come verificato.
9. L’inventario aggregato dei dati Firestore reali non è stato completato; pertanto nessuna migrazione dei campi può basarsi soltanto sulla documentazione.
10. `FILE_INVENTORY.md` è generato ma non più aggiornato allo stato corrente; deve essere rigenerato dopo il consolidamento.

## 2. Nuova gerarchia documentale proposta

| Livello | Documento | Autorità |
|---|---|---|
| 1 | `docs/ARCHITETTURA_SICUREZZA_V1.md` | Decisioni di sicurezza, dati, chiavi, Functions/Rules, allegati, condivisione, offline e recupero |
| 2 | `Frontend/GUIDA.md` | Regole consolidate di implementazione e UI, subordinata alla baseline sicurezza |
| 3 | Contratti specifici in `docs/` | Dettaglio tecnico per Vault, dati, condivisione, offline, backup, hardening |
| 4 | `Frontend/GUIDA_AGGIORNAMENTI.md` | Registro cronologico di attività aperte, non fonte normativa |
| 5 | `experiments/` e audit storici | Evidenze e laboratori; non autorizzano produzione |
| Generato | `FILE_INVENTORY.md`, baseline prestazioni | Fotografie rigenerabili; non prescrivono architettura |

In caso di conflitto prevale il livello superiore. Nessun documento può dichiarare “completato” ciò che è soltanto dimostrato in laboratorio o non verificato nell’ambiente reale.

## 3. Classificazione completa dei Markdown

| File | Esito | Cosa coincide | Cosa cambiare o chiarire | Priorità |
|---|---|---|---|---|
| `.github/copilot-instructions.md` | In conflitto parziale | Impone lettura preventiva e prudenza sulle zone rosse | Non può indicare `GUIDA.md` come unica fonte. Deve porre prima la baseline sicurezza e correggere i riferimenti relativi | P0 |
| `Frontend/GUIDA.md` | Da revisionare profondamente | Cifratura AES-GCM, separazione Auth/Vault, CSP, transazioni per condivisioni, Storage, audit e prudenza | Rimuovere il titolo di unica fonte per la sicurezza; correggere sessionStorage della chiave; vietare Cripto-Healing automatico; separare stato reale, target e codice storico; aggiornare condivisione, offline, SW e schema legacy | P0 |
| `Frontend/GUIDA_AGGIORNAMENTI.md` | Compatibile ma stratificato | Registra rischi, gate, offline, App Check, Vault e migrazioni prudenti | È un diario con decisioni di epoche diverse. Marcare sezioni chiuse/superate; correggere E2EE “in studio con libsodium”; riparare link; non usarlo come contratto | P1 |
| `docs/AGENTE_CODEX_EVOLUZIONE.md` | Compatibile | Elaborazione locale, livelli dati, costo zero e funzionamento senza server personale | Aggiungere la baseline come vincolo; vietare a modelli locali/remoti plaintext persistente, log e azioni sui dati senza autorizzazione; definire consenso per D3/D4 | P2 |
| `docs/APP_ARCHITECTURE_AUDIT.md` | Storico verificabile | Inventario prudente e distinzione tra audit e pubblicazione | Aggiungere commit/versione di validità e rinvio alla baseline. Non usarlo per descrivere automaticamente il runtime attuale | P2 |
| `docs/ARCHITETTURA_SICUREZZA_V1.md` | Baseline | Documento di confronto | Nessuna modifica ora. Le decisioni ancora aperte restano esplicitamente aperte | — |
| `docs/GUIDA_PROGETTO.md` | Indice autorevole | Definisce gerarchia, ordine di lettura e mappa delle fonti | Mantenere breve; aggiornare quando nasce, cambia o viene archiviato un contratto | P0 |
| `docs/AUDIT_MARKDOWN_ARCHITETTURA_SICUREZZA_V1.md` | Audit | Registra divergenze e piano di riallineamento | Non usarlo come contratto; aggiornare conteggio e stato durante questo consolidamento | P1 |
| `docs/PIANO_AUDIT_COMPLETO_PROGETTO.md` | Piano operativo | Trasforma il successivo controllo totale in fasi, prove e deliverable | Eseguire inizialmente read-only; non confondere il piano con un audit già svolto | P0 |
| `docs/CANONICAL_PAGE_REGISTRY.md` | Compatibile, fuori ambito sicurezza | Una pagina canonica, niente varianti versionate | Correggere soltanto eventuali riferimenti mancanti; mantenerlo come contratto UI/navigazione | P3 |
| `docs/DATA_ACCESS_CONTRACT.md` | Compatibile ma transitorio | Repository local-first, cache-first e scritture offline non improvvisate | Aggiornare lo stato M6; aggiungere classificazione diretto/Function e stati UI della baseline; chiarire quali scritture sono oggi realmente attive | P1 |
| `docs/ENCRYPTED_FIELD_INVENTORY.md` | Compatibile ma incompleto | Distingue campi cifrati e plaintext e dichiara di fotografare lo stato | Rigenerare dopo audit del codice e dati aggregati; includere widget, credenziali comuni, scadenze, notifiche, allegati, cache e metadati; classificare ogni plaintext necessario | P0 |
| `docs/FILE_INVENTORY.md` | Da rigenerare | Metodo automatico con hash e responsabilità | È obsoleto: non include la nuova baseline, riporta conteggi/Rules precedenti e cita MD assenti. Rigenerare solo dopo la sistemazione documentale | P1 |
| `docs/FUNCTIONAL_DATA_CONTRACT.md` | Compatibile, fotografia storica | Separa Auth e Vault, descrive cifratura, allegati, condivisioni e limiti offline | Mantenere come baseline funzionale M0, non come target sicurezza. Aggiungere collegamento alla baseline e stato delle modifiche successive | P1 |
| `docs/M10_HARDENING_RILASCIO.md` | Compatibile ma non certificante | Gate automatici, CSP, emulatori, rollback, audit indipendente | Evidenziare che suite verde non prova Firebase Console o runtime. App Check, matrice fisica, backup restore e audit indipendente restano aperti | P0 |
| `docs/M4_VISUAL_ACCEPTANCE.md` | Compatibile, fuori ambito sicurezza | Conserva prove reali e non maschera i fallimenti | Il riferimento a `PAGE_SHELL_CONTRACT.md` è rotto. Ripristinare il contratto o sostituire il riferimento | P2 |
| `docs/M5_COLLAUDO_DUE_DISPOSITIVI.md` | Compatibile, candidato | Chiave privata cifrata, chiave per-record, revoca e prova negativa | Conservare come procedura non produttiva; aggiungere esito, data, dispositivi e collegamento al gate di cutover quando sarà eseguita | P1 |
| `docs/M5_CONDIVISIONE_THREAT_MODEL.md` | Fortemente compatibile | Threat model, grant, chiave per-record, rotazione, limiti offline, niente plaintext al server | È il miglior dettaglio della baseline, ma separare più nettamente runtime legacy e target. Aggiornare dopo scelta editor/viewer e verifica identità chiavi | P0 |
| `docs/M5_INVENTARIO_DATI_CONDIVISI.md` | Compatibile e critico | Descrive dati, ACL, cache, allegati e metadati in chiaro | Rieseguire sul commit corrente. Eliminare gradualmente `getDownloadURL` persistenti; ridurre nome account/email nelle notifiche; verificare lettura allegati condivisi | P0 |
| `docs/M5_PIANO_INTEGRAZIONE.md` | Compatibile | Migrazione per fasi, doppio lettore, stati espliciti, rollback e backend per ACL | Aggiungere gate baseline: backup realmente ripristinato, inventario reale, audit indipendente e approvazione per ogni cutover | P1 |
| `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` | Compatibile ma stato da riconciliare | Coda cifrata, idempotenza, conflitti, prove PC/iPhone | Distingue correttamente scrittura e consultazione, ma va reso inequivocabile che la consultazione offline bancaria reale è ancora fallita | P0 |
| `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md` | In conflitto parziale | Cestino cifrato, revisione, purge backend-only e conferma forte | “Senza scadenza automatica” non può essere politica definitiva. Definire retention, cancellazione utente, backup e obblighi legali; non attivare purge senza prova | P0 |
| `docs/M8_BACKUP_RECUPERO.md` | Fortemente compatibile, laboratorio | Backup cifrato/autenticato/versionato, Recovery Key distinta, staging e nessuna sovrascrittura | Formalizzare parametri KDF dopo benchmark e audit; documentare custodia/rotazione; eseguire ripristino reale su copia non produttiva prima del cutover | P0 |
| `docs/M9_SALUTE_CREDENZIALI.md` | Compatibile | Analisi locale, HMAC effimero, k-anonymity prudente e rete disabilitata | Ripristinare o sostituire il riferimento mancante a `VAULT_KEY_CONTRACT.md`; consenso e privacy prima di attivare provider esterni | P1 |
| `docs/OFFLINE_WRITE_CONFLICT_POLICY.md` | Fortemente compatibile | revision, schemaVersion, operationId, idempotenza e niente overwrite silenzioso | Allineare lo stato alle implementazioni M6 e indicare entità abilitate/non abilitate; non lasciare “future” regole già parzialmente attive | P1 |
| `docs/PAGE_PERFORMANCE_BASELINE.md` | Compatibile, generato | Budget e distinzione fra statica e runtime | Rigenerare dopo modifiche; sicurezza e correttezza restano gate separati | P3 |
| `docs/PAGE_SHELL_CONTRACT.md` | Compatibile, fuori ambito sicurezza | Definisce le 29 pagine e il viewport con gate fisico | Aggiungere intestazione standard e verificare che il laboratorio `prova.html` non sia rimasto pubblico oltre il test | P2 |
| `docs/PIANO_MATURITA_PROFESSIONALE.md` | Fortemente compatibile ma storico-evolutivo | Modello progressivo, niente riscrittura cieca, fasi M0–M10 e audit indipendente | Subordinarlo alla baseline; aggiornare stati M6/M7/Vault; non usare checkbox storiche come prova di produzione | P1 |
| `docs/RUNTIME_PERFORMANCE_BASELINE.md` | Compatibile, evidenza storica | Misure senza contenuti sensibili e obiettivi iPhone/PC | Marcare versione/data; affiancare il fallimento offline bancario successivo e rigenerare prima/dopo interventi | P2 |
| `docs/UI_DESIGN_SYSTEM_CONTRACT.md` | Compatibile, fuori ambito sicurezza | Separazione responsabilità, accessibilità, budget e test fisici | Aggiungere intestazione standard e mantenere subordinazione a shell e baseline | P3 |
| `docs/VAULT_KEY_CONTRACT.md` | In conflitto P0, poi riallineato | Terminologia corretta per Auth, Master Password, KEK, Vault Key ed envelope | Il session wrapping con payload e chiave nello stesso storage è ora rischio da verificare, non garanzia; auditare il codice | P0 |
| `docs/RISPOSTA_INCIDENTI_E_RECUPERO.md` | Compatibile, riallineato | Segreti esclusi dalle evidenze, staging, rollback e recovery prudente | Completare ruoli, canale, contatti, escalation e obblighi privacy prima del go-live | P1 |
| `docs/PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md` | Compatibile ma in evoluzione | Blocca perdita password legacy, richiede inventario aggregato, cifra widget e usa Function per coerenza multi-documento | Separare con una tabella ciò che è implementato, collaudato localmente e verificato in produzione; completare audit reale aggregato; applicare la matrice della baseline ai widget semplici e comuni | P0 |
| `experiments/card-importer/README.md` | Storico/laboratorio compatibile | Isolamento dal runtime e niente dati reali | Mantenere fuori dal bundle; prima di produzione applicare pipeline allegati, consenso, elaborazione locale e cancellazione dei temporanei | P3 |
| `experiments/card-importer/REAL_IMAGE_AUDIT.md` | Storico con dati descrittivi | Non conserva numeri completi o file originali | Conservare solo se serve come evidenza; definire retention delle fotografie esterne al repo e non usare dati reali nei test futuri | P3 |

## 4. Conflitti che richiedono una decisione

### 4.1 Chiave in sessionStorage

`GUIDA.md` ordina di conservare la MasterKey in `sessionStorage`. La baseline stabilisce che le chiavi sbloccate restino in memoria.

Questo è un conflitto documentale P0. Non si deve eliminare subito codice senza verificare `vault-session.js`: il valore potrebbe essere una Vault Key protetta e non la chiave in chiaro, oppure potrebbe costituire un rischio reale. Serve un audit specifico che risponda:

- quale valore viene scritto;
- se è plaintext, Base64 o ciphertext autenticato;
- con quale chiave viene protetto;
- dove risiede la chiave di protezione;
- cosa succede a logout, blocco, crash, chiusura scheda e cambio UID;
- se una XSS può recuperarlo.

Fino all’esito, la Guida non deve ordinare la persistenza come regola sicura.

### 4.2 Cripto-Healing automatico

La Guida descrive una migrazione automatica di dati vulnerabili. I documenti M5 e la baseline richiedono invece migrazione esplicita, versionata e reversibile.

Decisione: prevale la baseline. Il rilevamento può essere automatico; la riscrittura dei dati reali non può esserlo senza backup, doppio lettore, confronto e autorizzazione.

### 4.3 Cestino senza scadenza

La cifratura non rende neutra una conservazione indefinita. Deve essere definita una retention esplicita con eccezioni legali documentate. Fino ad allora M7 resta laboratorio, non politica di produzione.

### 4.4 Tutto via Function o Firestore diretto

La roadmap Widget motiva correttamente le Functions per collegamenti multi-documento. Non giustifica l’obbligo generale per ogni campo.

Decisione confermata:

- record personale singolo: scrittura diretta ammessa con Rules ristrette e dati già cifrati;
- widget/credenziale comune multi-account: Function;
- condivisioni, ACL, generazioni, purge e operazioni coordinate: Function.

Il controllo puntuale di `firestore.rules` mostra ancora una regola generica proprietario per molte sottocollezioni. Prima di promuovere questa parte a conforme occorre censire i percorsi raggiunti e sostituire l’autorizzazione larga con contratti specifici, senza bloccare i formati legacy.

## 5. Documenti inizialmente non inclusi e situazione risolta

Durante il consolidamento il branch ha reso nuovamente disponibili i contratti che la prima fotografia non mostrava. La verifica finale include:

- `VAULT_KEY_CONTRACT.md`;
- `PIANO_MATURITA_PROFESSIONALE.md`;
- `RUNTIME_PERFORMANCE_BASELINE.md`;
- `PAGE_SHELL_CONTRACT.md`;
- `UI_DESIGN_SYSTEM_CONTRACT.md`;
- `RISPOSTA_INCIDENTI_E_RECUPERO.md`.

Non sono più classificati come assenti. Vault e risposta incidenti sono stati riallineati; gli altri sono inclusi nella tabella completa. Resta necessario controllare e riparare i collegamenti relativi, quindi rigenerare l’inventario.

## 6. Verifiche documentali contro Rules correnti

### Firestore

Aspetti positivi:

- domini sensibili backend-only per recupero, consegne e copie di scadenze;
- nuovi `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` non scrivibili direttamente dai client;
- `pushDevices` usa allowlist, tipi e limiti;
- accesso proprietario e accesso ospite sono distinti.

Da correggere o verificare:

- la regola generica sotto `users/{uid}/{collection}/{document=**}` concede lettura e scrittura proprietario a molte collezioni non escluse;
- gli inviti possono ancora essere creati dal client con email e nome account in metadati;
- l’ACL account legacy usa `sharedWithUids`;
- Admin SDK nelle Functions bypassa le Rules e richiede controlli applicativi completi.

### Storage

Aspetti positivi:

- isolamento sotto UID;
- chiusura predefinita;
- limite 25 MB;
- `application/octet-stream` richiede metadato `encrypted=v1`.

Da correggere o verificare:

- allowlist ancora ampia, comprendente video, Office, testo, GIF e HEIC/HEIF;
- le Rules possono verificare dimensione, tipo dichiarato e metadato, non la firma reale del file cifrato;
- la condivisione degli allegati non è autorizzata dal modello Storage di produzione;
- eventuali URL download persistenti legacy devono essere censiti e rimossi con migrazione controllata.

## 7. Piano di correzione proposto

### Blocco A — Autorità documentale

1. aggiornare `.github/copilot-instructions.md`;
2. inserire all’inizio di `GUIDA.md` la subordinazione alla baseline;
3. declassare `GUIDA_AGGIORNAMENTI.md` a registro cronologico;
4. aggiungere stato, versione e natura “reale/candidata/storica” a ogni documento.

### Blocco B — Conflitti P0

1. audit del materiale conservato da `vault-session.js`;
2. rimozione della prescrizione Cripto-Healing automatico;
3. definizione retention M7;
4. aggiornamento inventario cifratura e metadati;
5. verifica App Check enforcement reale;
6. chiarimento ufficiale del fallimento consultazione offline iPhone.

### Blocco C — Contratti mancanti

1. verificare la cronologia dei documenti ricomparsi e conservarne lo stato;
2. applicare intestazioni standard e gerarchia;
3. mantenere Vault e risposta incidenti come contratti attivi riallineati;
4. riparare tutti i collegamenti relativi.

### Blocco D — Stato reale

1. eseguire inventario Firestore aggregato read-only;
2. censire percorsi coperti dalla Rule generica;
3. verificare Functions, Rules e App Check effettivamente distribuiti;
4. provare backup/ripristino in ambiente non produttivo;
5. completare matrice fisica iPhone/Windows;
6. commissionare audit crittografico indipendente.

### Blocco E — Consolidamento

1. aggiornare gli MD approvati;
2. rigenerare `FILE_INVENTORY.md` e performance baseline;
3. aggiungere un controllo automatico per link Markdown rotti e intestazioni di stato;
4. eseguire test;
5. commit documentale separato;
6. solo successivamente progettare modifiche a codice, Rules, Functions o dati.

## 8. Cosa non deve essere fatto ora

- non migrare automaticamente record legacy;
- non eliminare campi sulla base della sola frequenza d’uso;
- non spostare tutte le scritture nelle Functions senza matrice;
- non dichiarare zero-knowledge il runtime finché condivisione e recupero non sono verificati;
- non cancellare fallback prima dell’inventario dei dati reali;
- non considerare suite locale verde equivalente a configurazione Firebase reale verificata;
- non promuovere versioni storiche senza confronto con baseline, codice e stato reale.

## 9. Decisione conclusiva

L’architettura documentata non è da buttare. Il nucleo M5–M10 converge già verso la baseline. La parte da “rivoluzionare” è soprattutto la governance documentale:

- una sola baseline di sicurezza;
- guide subordinate e prive di affermazioni assolute non dimostrate;
- stato reale distinto da laboratorio e obiettivo;
- nessuna migrazione automatica;
- evidenze runtime separate dai test statici;
- contratti mancanti ripristinati o ricreati in modo controllato.

Il primo intervento consigliato è il Blocco A, seguito dall’audit P0 di `vault-session.js`. Nessuna modifica ai dati reali è necessaria per iniziare.
