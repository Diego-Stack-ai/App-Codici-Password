# Programma

## Esito finale del ciclo corrente — 09/10/2026

Il proprietario ha disposto la chiusura dell'intero ciclo M7–M10. Il risultato consegnato è la versione `1.2.144` pubblicata integralmente sull'app originale, con suite locali pertinenti verdi e motori non dimostrati mantenuti hard-off. Il programma non conserva ulteriori attività tecniche automatiche obbligatorie per questo ciclo: GCS reale, matrice fisica, audit indipendente e revisione privacy/legale sono gate esterni trasferiti a un futuro ciclo di certificazione e non vengono falsamente marcati come eseguiti. Lingue, AI ed Excel restano fuori perimetro e potranno essere pianificati separatamente.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](STATO.md).

Obiettivi e criteri di completamento del programma, non secondo diario di avanzamento. Lo stato è mantenuto soltanto in STATO. Il piano di audit conservato sotto definisce metodo e verifiche ancora da raccordare: nessuna formula storica di prosecuzione abilita nuovi incarichi.

## Ordine pre-finale — riconciliazione completa, 27/09/2026

Aggiornamento successivo: Diego ha approvato il pacchetto di scelte 1A–5, registrato in DECISIONI, e ordinato completamento locale unificato. Integrare protocolli e nuovi componenti prima della consegna per i suoi controlli nel browser locale. Lingue, AI ed Excel rinviati a un secondo momento; le formulazioni precedenti sul rinvio ancora da decidere sono storiche. Nessuna equivalenza fra demo, app integrata, collaudo distribuito e autorizzazione al rilascio.

Su ordine di Diego, completare le attività del programma e riconciliare l'intera app prima dei successivi lavori su lingue, integrazione AI ed esportazione Excel. Chiudere gli MD significa risolvere e verificare le attività che descrivono, non chiudere artificialmente documenti permanenti, domande o gate ancora pendenti.

1. Raccordare requisiti dei 31 MD, codice corrente, laboratori e prove; distinguere storico superato da rilievi ancora presenti.
2. Consolidare in AUDIT un elenco senza duplicati di tutti i difetti noti, inclusi quelli riprodotti da test tecnicamente verdi, con identificativo, gravità, ambito, fonte, stato, correzione e prova richiesta. Distinguere difetti confermati, sospetti da verificare, decisioni prodotto e verifiche non eseguite.
3. Correggere i difetti nel perimetro autorizzato e ripetere prove pertinenti e regressioni. Un test che riproduce un difetto non ne autorizza la chiusura. Registrare evidenze in COLLAUDI e avanzamento in STATO; raccogliere le sole decisioni nuove indispensabili continuando i lavori indipendenti.
4. Consegnare bilancio riconciliato di risolti, aperti, bloccanti e limiti di verifica; valutare la candidata senza dedurre idoneità dal numero di test verdi. Nessuna promessa di assenza assoluta di difetti.

Lingue, AI ed esportazione Excel sono filoni successivi separati. Excel ha già un progetto e una proiezione sperimentale descritti in BACKUP: riusare quel lavoro, senza dichiarare conclusa l'integrazione. Diego considera possibile rinviarli a dopo la pubblicazione, ma la collocazione prima/dopo rilascio resta da decidere esplicitamente. Non rinviare per questo protezioni dei campi sensibili o altri requisiti di sicurezza. Restano i gate di rilascio esistenti e il divieto di commit, merge, push, deploy e modifiche produttive senza ordine successivo.

## Indice delle fonti conservate

- [PIANO_AUDIT_COMPLETO_PROGETTO.md](#fonte-docs-piano-audit-completo-progetto-md-l1)
- [PIANO_MATURITA_PROFESSIONALE.md](#fonte-docs-piano-maturita-professionale-md-l183)

<a id="fonte-docs-piano-audit-completo-progetto-md-l1"></a>

## Fonte: PIANO_AUDIT_COMPLETO_PROGETTO.md — righe originali 1–212

> Provenienza: `docs/PIANO_AUDIT_COMPLETO_PROGETTO.md` a `2900ccc0`. Metodo di audit conservato. Stato e ordine esecutivo correnti si trovano in STATO e INCARICO_CORRENTE.

<a id="fonte-docs-piano-audit-completo-progetto-md-piano-di-audit-completo-del-progetto"></a>

## Piano di audit completo del progetto

> **Stato:** in esecuzione; fotografia iniziale e audit P0 della sessione Vault completati
> **Autorità:** piano operativo subordinato a [Guida progetto](../LEGGIMI.md) e [Architettura Sicurezza V1](../regole/SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1)\
> **Versione:** 1.0\
> **Data:** 11 settembre 2026\
> **Vincolo:** l’audit è inizialmente read-only. Non autorizza migrazioni, deploy, cancellazioni o modifiche ai dati reali.

> **Aggiornamento di stato:** 15/09/2026, incremento `054b045d`, PR #67. Chiusura delle sole attività verificate e gate rimanenti nel [riepilogo corrente](../storico/REGISTRO.md#fonte-docs-piano-maturita-professionale-md-chiusura-documentale-dellincremento-054b045d--15092026). La shell è già approvata; l'audit complessivo e la correzione produttiva VS-P0-01 non sono chiusi. La data sopra identifica l'origine di questo piano.

<a id="fonte-docs-piano-audit-completo-progetto-md-1-obiettivo"></a>

### 1. Obiettivo

Ricontrollare l’intero progetto e determinare, con prove:

- cosa è realmente implementato;
- cosa coincide con i contratti;
- cosa esiste soltanto nei laboratori;
- cosa è legacy ma ancora necessario;
- cosa è in conflitto o non verificabile;
- cosa è distribuito davvero su Firebase;
- quali correzioni sono necessarie e in quale ordine.

L’esito sarà un rapporto unico con evidenza, rischio, priorità, intervento proposto, test, migrazione e rollback.

<a id="fonte-docs-piano-audit-completo-progetto-md-2-regola-di-classificazione"></a>

### 2. Regola di classificazione

Ogni affermazione sarà marcata:

| Stato | Significato |
|---|---|
| Verificato nel codice | Evidenza nel commit esaminato |
| Verificato da test | Prova automatica riproducibile |
| Verificato in emulatore | Prova locale Firebase, non produzione |
| Verificato sul dispositivo | Prova fisica registrata |
| Verificato in Firebase | Configurazione/prodotto remoto controllato |
| Dichiarato soltanto | Presente in un MD ma non ancora dimostrato |
| Laboratorio | Isolato dal runtime |
| Legacy necessario | Vecchio formato ancora letto da dati reali |
| In conflitto | Non rispetta la baseline |
| Non determinabile | Richiede accesso o prova aggiuntiva |

<a id="fonte-docs-piano-audit-completo-progetto-md-3-perimetro"></a>

### 3. Perimetro

<a id="fonte-docs-piano-audit-completo-progetto-md-a-repository-e-supply-chain"></a>

#### A. Repository e supply chain

- branch, commit, workflow e deploy;
- dipendenze, lockfile e vulnerabilità;
- segreti, token e credenziali accidentalmente versionati;
- file duplicati, morti, storici o pubblicati per errore;
- laboratori esclusi dal runtime;
- licenze e provenienza delle dipendenze critiche.

<a id="fonte-docs-piano-audit-completo-progetto-md-b-autenticazione-e-vault"></a>

#### B. Autenticazione e Vault

- Firebase Authentication, verifica email, MFA/TOTP e WebAuthn/PRF;
- separazione password account/Master Password;
- verifier, KDF, salt, envelope e keyring;
- `localStorage`, `sessionStorage`, IndexedDB e RAM;
- blocco, logout, cambio UID, revoca e recupero;
- audit P0 di `vault-session.js`;
- compatibilità e rimozione controllata dei formati legacy.

<a id="fonte-docs-piano-audit-completo-progetto-md-c-cifratura-e-dati"></a>

#### C. Cifratura e dati

- inventario di ogni campo e metadato;
- algoritmo, IV/nonce, AAD, versioni e gestione errori;
- plaintext in Firestore, Storage, cache, URL, log e notifiche;
- account privati, aziende, Profilo, scadenze, widget e credenziali comuni;
- confronto fra schema documentato e schema reale;
- inventario Firestore aggregato, senza restituire valori sensibili.

<a id="fonte-docs-piano-audit-completo-progetto-md-d-firestore-e-functions"></a>

#### D. Firestore e Functions

- copertura di ogni percorso da parte delle Rules;
- Rule generica e possibili autorizzazioni eccessive;
- allowlist, tipi, dimensioni, UID e revisioni;
- chiamate client dirette;
- callable e trigger con Authentication, App Check, autorizzazione, idempotenza e rate limit;
- operazioni Admin SDK che bypassano le Rules;
- transazioni, retry, conflitti e documenti orfani.

<a id="fonte-docs-piano-audit-completo-progetto-md-e-storage-e-allegati"></a>

#### E. Storage e allegati

- percorsi e isolamento UID;
- cifratura prima dell’upload;
- chiavi-file e wrapping;
- formati, dimensione, MIME e magic bytes;
- URL di download legacy;
- eliminazione coordinata;
- condivisione allegati;
- apertura sicura dei formati ammessi;
- conferma del compromesso zero-knowledge/scansione malware.

<a id="fonte-docs-piano-audit-completo-progetto-md-f-condivisioni"></a>

#### F. Condivisioni

- inviti, email canonicalizzata, UID, ruoli e stati;
- condivisione account privato e aziendale;
- differenza tra ACL e consegna della chiave;
- record-key, envelope, generazione e revoca;
- comportamento offline dopo revoca;
- allegati e notifiche;
- confronto runtime legacy/laboratorio M5/target.

<a id="fonte-docs-piano-audit-completo-progetto-md-g-offline-e-prestazioni"></a>

#### G. Offline e prestazioni

- service worker applicativo e worker Firebase Messaging;
- cache shell e cache Firestore;
- consultazione offline di liste e dettagli;
- coda di scrittura cifrata;
- revisioni, operationId, retry e conflitti;
- comportamento iPhone/Windows;
- tempi percepiti e budget;
- caso bancario offline attualmente non superato.

<a id="fonte-docs-piano-audit-completo-progetto-md-h-backup-cestino-e-recupero"></a>

#### H. Backup, cestino e recupero

- formato backup, KDF, autenticità e versione;
- Recovery Key e custodia;
- staging, confronto, ripristino e rollback;
- retention di cestino, cronologia, allegati e backup;
- purge backend-only;
- cancellazione account e dati;
- prova reale esclusivamente su copia non produttiva.

<a id="fonte-docs-piano-audit-completo-progetto-md-i-frontend-e-sicurezza-web"></a>

#### I. Frontend e sicurezza web

- CSP e header Hosting;
- XSS, injection, URL e rendering dinamico;
- script inline, dipendenze esterne e iframe;
- autofill, clipboard, QR e visibilità campi;
- accessibilità e privacy delle notifiche;
- errori che mostrano dati sensibili;
- pagina laboratorio eventualmente pubblicata.

<a id="fonte-docs-piano-audit-completo-progetto-md-l-firebase-reale-e-rilascio"></a>

#### L. Firebase reale e rilascio

- progetto e ambiente corretti;
- versioni Rules, Functions, Hosting e indici distribuite;
- App Check enforcement;
- Authentication/Identity Platform e MFA;
- scheduler, email e push;
- IAM e service account;
- log e monitoraggio;
- workflow GitHub;
- piano rollback e matrice di rilascio.

<a id="fonte-docs-piano-audit-completo-progetto-md-m-privacy-e-organizzazione"></a>

#### M. Privacy e organizzazione

- minimizzazione e finalità;
- informative e consensi;
- retention;
- diritti dell’utente;
- fornitori e localizzazione;
- procedura incidenti;
- ruoli amministrativi;
- eventuale necessità di DPIA e consulenza legale.

<a id="fonte-docs-piano-audit-completo-progetto-md-4-ordine-di-esecuzione"></a>

### 4. Ordine di esecuzione

1. congelare commit e inventario;
2. eseguire audit statico read-only;
3. eseguire test automatici esistenti;
4. mappare documenti contro codice;
5. eseguire emulatori;
6. produrre inventario dati aggregato;
7. verificare Firebase Console e deploy reali;
8. eseguire matrice fisica iPhone/Windows;
9. classificare rischi e dipendenze;
10. presentare il rapporto prima di qualsiasi correzione;
11. approvare correzioni per blocchi;
12. implementare, collaudare e documentare ogni blocco separatamente.

<a id="fonte-docs-piano-audit-completo-progetto-md-evidenze-prodotte"></a>

#### Evidenze prodotte

- [Fotografia iniziale del progetto](../storico/REGISTRO.md#fonte-docs-audit-progetto-fase1-fotografia-md-l1)
- [Audit P0 della sessione Vault](../evidenze/AUDIT.md#fonte-docs-audit-vault-session-p0-md-l1)

<a id="fonte-docs-piano-audit-completo-progetto-md-5-priorità-iniziali"></a>

### 5. Priorità iniziali

| Priorità | Verifica |
|---|---|
| P0 | contenuto reale di `vault-session.js` e storage delle chiavi |
| P0 | Rules generiche e autorizzazioni effettive |
| P0 | campi/metadati realmente cifrati |
| P0 | condivisione legacy e possibilità reale di decifratura del destinatario |
| P0 | backup realmente ripristinabile |
| P0 | App Check/Rules/Functions realmente distribuiti |
| P1 | URL allegati legacy e pipeline formati |
| P1 | consultazione offline bancaria su iPhone |
| P1 | retention cestino/backup |
| P1 | inventario aggregato dei dati |
| P2 | prestazioni, UI, documentazione generata e laboratori |

<a id="fonte-docs-piano-audit-completo-progetto-md-6-deliverable-finale"></a>

### 6. Deliverable finale

Il rapporto dovrà contenere:

- commit e ambiente esaminati;
- matrice requisito → documento → codice → test → produzione;
- elenco findings con gravità e prova;
- falsi positivi separati;
- dati o accessi mancanti;
- correzione proposta;
- impatto su utenti e dati;
- piano di migrazione e rollback;
- ordine dei blocchi;
- gate di accettazione;
- decisioni richieste al product owner.

<a id="fonte-docs-piano-audit-completo-progetto-md-7-criterio-di-completamento"></a>

### 7. Criterio di completamento

L’audit è completo soltanto quando non restano aree dichiarate conformi basandosi esclusivamente sui Markdown. Gli elementi non verificabili devono rimanere esplicitamente aperti.

<a id="fonte-docs-piano-maturita-professionale-md-l183"></a>

## Fonte: PIANO_MATURITA_PROFESSIONALE.md — righe originali 183–459

> Provenienza: `docs/PIANO_MATURITA_PROFESSIONALE.md` a `2900ccc0`.

<a id="fonte-docs-piano-maturita-professionale-md-2-terminologia-crittografica-reale"></a>

### 2. Terminologia crittografica reale

La Master Password e la Vault Key non sono la stessa cosa.

```text
Password account Firebase
  └─ autentica l'utente verso Firebase

Master Password della Vault
  ├─ verifica locale tramite Vault Verifier
  └─ deriva una KEK che apre il Vault Key Envelope

Vault Key casuale
  └─ protegge i dati cifrati della Vault
```

Nella fotografia iniziale, prima del completamento M1, la variabile `_masterKey` di `security-manager.js` contiene, dopo lo sblocco, la **Vault Key risolta** o il keyring di compatibilità; il nome è storico e ambiguo. I Vault nuovi ricevono già una chiave casuale generata da `generateVaultKey()`, protetta da `wrapVaultKey()`. Per i dati precedenti può esistere temporaneamente un fallback legacy nel keyring, necessario a leggerli senza una ricifratura non atomica.

Il possibile livello futuro non è “aggiungere una Vault Key”, perché esiste già. È valutare una **Data Encryption Key per record (DEK)**:

```text
Vault Key
  ├─ protegge DEK Account A
  ├─ protegge DEK Documento B
  └─ protegge DEK Scadenza C
```

Questo modello può facilitare condivisione, revoca e rotazione selettiva, ma aumenta complessità e non deve essere adottato senza prima dimostrarne la necessità, progettare la migrazione e testare rollback e compatibilità.

<a id="fonte-docs-piano-maturita-professionale-md-3-prodotto-esistente-da-preservare"></a>

### 3. Prodotto esistente da preservare

- autenticazione Firebase, 2FA TOTP e codici di recupero;
- Master Password distinta dalla password dell'account;
- Vault Key, verifier, envelope e WebAuthn/PRF;
- profilo personale, contatti, indirizzi, documenti e tessera digitale;
- account privati e aziendali, memorandum e memorandum condivisi;
- aziende, dati bancari e allegati cifrati;
- scadenze, regole, email, notifiche Push e notifiche interne;
- rubrica destinatari condivisa tra scadenze e inviti;
- archivio, ricerca e Agente Codex locale;
- consultazione offline dei dati già sincronizzati;
- importatore OCR mantenuto isolato finché non supera i relativi gate.

Una fase non può essere dichiarata conclusa se elimina, altera o rende più lenta una di queste funzioni senza una decisione esplicita e documentata.

<a id="fonte-docs-piano-maturita-professionale-md-4-modello-tecnico-di-destinazione"></a>

### 4. Modello tecnico di destinazione

<a id="fonte-docs-piano-maturita-professionale-md-41-bootstrap-e-navigazione"></a>

#### 4.1 Bootstrap e navigazione

- bootstrap pubblico minimo per login, registrazione e recupero;
- bootstrap protetto unico per autenticazione, Vault, componenti e routing;
- import dinamico esclusivo del modulo della pagina corrente;
- servizi accessori, Push e prefetch sempre non bloccanti rispetto al primo contenuto;
- redirect storici confinati e rimovibili tramite un registro di compatibilità.

<a id="fonte-docs-piano-maturita-professionale-md-42-strati-applicativi"></a>

#### 4.2 Strati applicativi

```text
UI pagina
  → servizi di dominio
    → repository locale
      → sincronizzazione
        → Firebase

Sicurezza e cifratura attraversano gli strati tramite API centrali,
senza essere replicate nelle singole pagine.
```

- la UI non costruisce direttamente percorsi Firestore complessi;
- il dominio definisce Account, Azienda, Profilo, Scadenza, Condivisione e Notifica;
- il repository decide cache-first/server refresh;
- il motore di sincronizzazione gestisce versione, stato e conflitti;
- la cifratura riceve e restituisce dati attraverso contratti espliciti.

<a id="fonte-docs-piano-maturita-professionale-md-43-componenti"></a>

#### 4.3 Componenti

- card, righe dati, modali, form field, selettori, switch, liste e stati vuoti condivisi;
- token CSS centrali e CSS di pagina limitato al solo layout specifico;
- accessibilità, target tattili, safe area e responsive verificati automaticamente;
- nessuna dipendenza UI caricata se non serve alla pagina corrente.

<a id="fonte-docs-piano-maturita-professionale-md-44-dati-e-sincronizzazione"></a>

#### 4.4 Dati e sincronizzazione

- schema versionato per ogni entità;
- migrazioni idempotenti e riprendibili;
- cache locale cifrata o affidata a contenitori il cui rischio sia documentato;
- stato `sincronizzato`, `in attesa`, `conflitto`, `errore` quando saranno abilitate scritture offline;
- aggiornamento incrementale e selettivo, non riscaricamento globale;
- cancellazione locale verificabile su logout, cambio utente e revoca dispositivo.

<a id="fonte-docs-piano-maturita-professionale-md-45-condivisione"></a>

#### 4.5 Condivisione

- risoluzione email → UID esclusivamente backend;
- autorizzazione Firestore distinta dalla consegna crittografica della chiave;
- inviti con stato, scadenza, revoca e audit minimo;
- modello permessi predisposto per `view`, `edit`, `manage`, anche se inizialmente viene concesso soltanto `view`;
- nessuna enumerazione degli utenti e nessuna esposizione di token dispositivo;
- studio formale dell'eventuale cifratura per-record prima di cambiare il formato attuale.

<a id="fonte-docs-piano-maturita-professionale-md-46-continuità-e-recupero"></a>

#### 4.6 Continuità e recupero

- cestino recuperabile e cronologia essenziale;
- esportazione cifrata completa e ripristino verificato;
- Recovery Key valutata separatamente dai codici di recupero 2FA;
- Emergency Access soltanto con disegno zero-knowledge, tempo di attesa e revoca;
- nessuna backdoor server per la Master Password.

<a id="fonte-docs-piano-maturita-professionale-md-5-confronto-sintetico-con-prodotti-maturi"></a>

### 5. Confronto sintetico con prodotti maturi

<a id="confronto-originario-conservato"></a>

#### Confronto originario conservato — base `2900ccc0`, righe 292–303

> **Fonte storica.** Tabella e riferimenti originali di `PIANO_MATURITA_PROFESSIONALE.md`, conservati integralmente il 24/09/2026. La colonna «oggi» descrive quella base, non lo stato attuale. Le possibilità da valutare non diventano decisioni approvate; restano valide le decisioni documentate nei contratti. Questa riproduzione non autorizza nuove implementazioni. Mantiene espliciti anche «possibile DEK per record» e «budget CI e misure runtime su dispositivi reali», non ripetuti nella tabella del riesame.

| Area | Codici & Password oggi | Modello maturo da valutare |
|---|---|---|
| Vault | Vault Key casuale con envelope e compatibilità legacy | terminologia pulita, migrazione legacy conclusa e possibile DEK per record |
| Condivisione | inviti, UID e regole di accesso | consegna crittografica verificata, ruoli, revoca e audit |
| Offline | shell PWA, Firestore persistente e prefetch | repository local-first, conflitti e coda scritture espliciti |
| Prestazioni | metriche bootstrap e baseline statica | budget CI e misure runtime su dispositivi reali |
| Account | consultazione, copia e condivisione | salute credenziali, cronologia e possibile autofill separato |
| Recupero | recupero account/2FA e cambio Master Password | backup cifrato verificato, Recovery Key ed eventuale emergenza |
| Organizzazione | Privato, Azienda, memorandum, documenti e scadenze | contratti comuni senza perdere i domini specifici |
| Funzioni distintive | scadenze, veicoli, documenti, Push, AI locale e OCR sperimentale | conservarle come vantaggio del prodotto, subordinate ai gate core |

Riferimenti di confronto: [Bitwarden Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/), [Bitwarden encryption](https://bitwarden.com/help/what-encryption-is-used/), [Proton Pass vault](https://proton.me/support/pass-vault), [Proton Pass sharing](https://proton.me/support/pass-browser-share), [KeePassXC documentation](https://keepassxc.org/docs/).

#### Riesame del 23/09/2026

Il confronto originario è stato rieseguito il 23/09/2026 dopo il riordino dei 71 MD
in 31 documenti. Il riesame distingue tre casi: requisito già conservato, requisito
presente ma incompleto, opportunità di mercato non ancora decisa. Non trasforma una
funzione concorrente in un requisito e non autorizza implementazioni o servizi esterni.

| Area osservata nei prodotti maturi | Copertura nei 31 MD | Valutazione |
|---|---|---|
| Cifratura locale/zero-knowledge, chiavi separate e metadati sensibili | SICUREZZA, VAULT, DATI, inventario cifrato e audit P0 | **Conservata**, con migrazione legacy e session wrapping ancora aperti |
| Condivisione cifrata, ruoli, revoca, scadenza e audit | CONDIVISIONE, M5, CANCELLAZIONE | **Conservata**, attivazione reale e collaudo su due dispositivi ancora aperti |
| Offline multipiattaforma, conflitti, coda e rollback | OFFLINE e M6 | **Conservata**, con fallback e dispositivi reali ancora aperti |
| Salute password, riuso, debolezza e controllo violazioni | SALUTE_CREDENZIALI e M9 | **Conservata/parziale**: analisi locale presente; provider di violazioni richiede privacy e consenso |
| Autofill ed estensione/browser credential provider | SALUTE_CREDENZIALI lo separa correttamente dalla PWA | **Presente come confine**, non progettato né implementato |
| Passkey per servizi e sblocco locale WebAuthn/PRF | VAULT, SICUREZZA e SALUTE_CREDENZIALI | **Conservata/parziale**: distinzione corretta; mancano ciclo completo di salvataggio/uso/esportazione delle passkey di servizio e matrice reale |
| TOTP integrato nei record | La 2FA TOTP protegge l'account Firebase; non esiste un autenticatore TOTP dei servizi conservati | **Opportunità nuova da decidere**, con threat model che valuti il rischio di tenere password e secondo fattore nello stesso Vault |
| Accesso d'emergenza con contatto fidato, attesa, approvazione/rifiuto e revoca | Citato e mantenuto separato da Recovery Key e recupero 2FA | **Conservato come obiettivo**, ma senza decisione prodotto o progetto |
| Condivisione di un singolo elemento a non utenti con scadenza, password e limite visualizzazioni | Gli inviti M5 richiedono identità e ACL; non coprono un equivalente di Secure Link/Send | **Opportunità nuova da decidere**, distinta dalla condivisione permanente |
| Alias email per ridurre correlazione, spam e impatto delle violazioni | Nessuna previsione specifica | **Opportunità nuova da decidere**; richiederebbe un provider esterno e una valutazione privacy |
| Importazione da altri gestori ed esportazione interoperabile | Backup cifrato proprietario coperto da M8; CSV/JSON interoperabili non progettati | **Lacuna di portabilità da valutare**, senza confondere export interoperabile e backup sicuro |
| Vault multipli, collezioni/gruppi familiari o aziendali e permessi granulari | Privato/Azienda e condivisione per record esistono; manca un contenitore utente esplicito equivalente | **Opportunità da valutare** dopo M5, senza duplicare i domini dell'app |
| Inventario dispositivi/sessioni e revoca remota | Revoca dispositivo è un obiettivo di sicurezza, ma non risultano UI e contratto completi | **Obiettivo parziale da esplicitare** nel futuro disegno account/sicurezza |
| Modalità viaggio o disponibilità selettiva dei Vault sul dispositivo | Non prevista | **Opportunità a priorità bassa**, utile solo con più Vault/collezioni e un modello di minaccia approvato |
| Generatore di password e flusso guidato di cambio credenziale | Non emerge un generatore applicativo dedicato né automazione del cambio | **Lacuna funzionale da valutare**; non autorizza automazione su siti terzi |
| Audit indipendente, codice verificabile, disclosure/bug bounty e supply chain | M10 richiede audit indipendente e controlli dipendenze | **Conservata/parziale**: open source e programma di disclosure restano decisioni organizzative |
| Recupero, export cifrato e cancellati recuperabili | BACKUP, CANCELLAZIONE, M7 e M8 | **Conservata**, con staging, journal, prove fisiche e retention ancora aperti |
| Funzioni distintive: profili, aziende, scadenze, veicoli, documenti, Push, AI locale e OCR | DATI, INTERFACCIA e documenti di sviluppo | **Conservate come vantaggio del prodotto**, subordinate ai gate core |

Il riesame non ha individuato obiettivi M0–M10 cancellati dal riordino. Ha invece
reso visibili opportunità che il confronto originario citava solo in parte o non
citava. Prima di assegnarle a una fase, Diego deve decidere valore, priorità e costo:
non vanno inserite automaticamente fra i gate che bloccano M6–M10.

Fonti ufficiali consultate nel riesame: [1Password Watchtower](https://support.1password.com/watchtower/),
[Bitwarden encryption](https://bitwarden.com/help/what-encryption-is-used/),
[Bitwarden Emergency Access](https://bitwarden.com/help/request-and-grant-emergency-access/),
[Bitwarden import/export](https://bitwarden.com/help/import-faqs/),
[Proton Pass security](https://proton.me/pass/security),
[Proton Pass secure links](https://proton.me/support/pass-secure-link-security),
[Apple Passwords](https://support.apple.com/guide/iphone/use-passwords-iphd18e98624/ios),
[Apple shared groups](https://support.apple.com/guide/personal-safety/manage-shared-password-and-passkeys-ips3ce9f6e15/web),
[Google password protection](https://support.google.com/chrome/answer/10311524) e
[Google passkeys](https://support.google.com/accounts/answer/13548313).

<a id="fonte-docs-piano-maturita-professionale-md-6-programma-di-lavoro"></a>

### 6. Programma di lavoro

<a id="fonte-docs-piano-maturita-professionale-md-m0--baseline-e-congelamento-dei-contratti"></a>

#### M0 — Baseline e congelamento dei contratti

- [x] inventario del repository e grafo dipendenze;
- [x] baseline statica per pagina con `npm run audit:pages`;
- [x] prima metrica runtime `private-page-bootstrap`;
- [x] catalogo delle funzioni visibili e dei percorsi dati in `FUNCTIONAL_DATA_CONTRACT.md`;
- [x] dataset di prova privo di segreti reali, protetto da test automatici;
- [x] budget statici e obiettivi runtime definiti; baseline reale iPhone/PC registrata in `RUNTIME_PERFORMANCE_BASELINE.md`.

**Uscita:** sappiamo misurare prima/dopo senza usare i dati personali come collaudo.

<a id="fonte-docs-piano-maturita-professionale-md-m1--nomenclatura-e-contratti-della-vault"></a>

#### M1 — Nomenclatura e contratti della Vault

- [x] rinominare gradualmente `_masterKey` in `vaultKeyMaterial` senza cambiare il valore;
- [x] documentare verifier, KEK, envelope, Vault Key, keyring legacy e session wrapping in `VAULT_KEY_CONTRACT.md`;
- [x] produrre l’inventario iniziale M1 in `ENCRYPTED_FIELD_INVENTORY.md`; l’estensione ai campi successivi e l’inventario reale restano aperti;
- [x] verificare il helper di pulizia della sessione; integrazione dei logout, blocco e conformità della persistenza restano aperti nell’audit Vault;
- [x] vietare il ritorno della variabile interna ambigua `_masterKey` tramite audit.

**Uscita:** nessuna ambiguità fra password e chiavi; nessuna migrazione dati in questa fase.

<a id="fonte-docs-piano-maturita-professionale-md-m2--data-access-e-repository-local-first"></a>

#### M2 — Data access e repository local-first

- [x] sostituire le letture Firestore replicate con repository di dominio;
- [x] formalizzare cache-first e refresh in background in `DATA_ACCESS_CONTRACT.md`;
- [x] deduplicare richieste equivalenti nel perimetro già migrato;
- [x] rendere selettiva la sincronizzazione per pagina tramite le priorità di `offline-sync.js`;
- [x] definire conflitti prima di abilitare scritture offline in `OFFLINE_WRITE_CONFLICT_POLICY.md`.

M2 completata: i moduli applicativi usano il repository unico; richieste equivalenti sono coordinate senza introdurre una seconda cache permanente. Questa chiusura riguarda M2; il cutover successivo e limitato delle scritture è descritto in M6.

**Uscita:** le pagine non conoscono più i dettagli della cache o della rete.

<a id="fonte-docs-piano-maturita-professionale-md-m3--rifattorizzazione-delle-pagine"></a>

#### M3 — Rifattorizzazione delle pagine

Registro canonico e redirect di compatibilità formalizzati in `CANONICAL_PAGE_REGISTRY.md`; il gate automatico impedisce che le vecchie Home vengano trattate come pagine applicative.

Ordine iniziale determinato dalla baseline, corretto dal rischio funzionale:

1. [x] Profilo Utente unico;
2. [x] Area Privata e liste Account: letture parallelizzate, password lazy anche nei più usati e vista card/Swipe condivisa tra Privato e Azienda;
3. [x] Aggiungi/Modifica Scadenza: modelli destinatari/data/configurazione, controller destinatari/allegati/configurazione e servizio di persistenza estratti e testati; il form conserva soltanto orchestrazione e UI specifiche;
4. [x] Dettagli Account Privato e Azienda: modalità canoniche, renderer bancario e compatibilità legacy condivisi; allegati e condivisione isolati, con gate su campi sensibili, listener e revoca;
5. [x] Form Account Privato e Azienda: regole Account/Memorandum e renderer bancario condivisi; cifratura e transazioni di salvataggio isolate in servizi dedicati e protette da gate;
6. [x] Impostazioni e configurazioni: modello comune delle configurazioni Scadenze estratto e testato; canali Push riuniti in un controller condiviso e QR opzionale caricato fuori dal percorso critico; riordino visivo complessivo rinviato al post-M10;
7. [x] Aziende e archivio: letture archivio parallelizzate e isolate dalla vista, mutazioni Archivio/Aziende delegate a servizi dedicati, decifratura preventiva limitata al solo indice username; apertura allegati anagrafica azienda isolata e coperta dai gate di sicurezza;
8. [x] Home e pagine pubbliche: bootstrap pubblico minimo; presentazione protetta, inbox e dashboard Scadenze isolate dall’orchestratore Home e coperte da gate dedicati.

Per ogni pagina: baseline, mappa responsabilità, componenti condivisi, caricamento progressivo, test, confronto e rimozione del vecchio percorso.

**Uscita:** una sola implementazione canonica per funzione, senza suffissi di versione applicativi.

M3 completata: le pagine canoniche sono state separate in orchestratori, viste condivise e servizi di dominio dove necessario; i percorsi precedenti non sono più concorrenti e i gate impediscono il ritorno delle duplicazioni rimosse.

<a id="fonte-docs-piano-maturita-professionale-md-m4--componenti-e-design-system"></a>

#### M4 — Componenti e design system

- [x] estrarre componenti soltanto dopo almeno due utilizzi reali, secondo `UI_DESIGN_SYSTEM_CONTRACT.md`;
- [x] unificare card Account, righe sensibili, form field e stati di caricamento: viste Account e dati bancari condivise, campi base in `moduli.css`, stati di pagina accessibili in `ui-state-view.js`;
- [x] eliminare flash e discontinuità di header/footer durante scroll e overscroll: nebbia V2 e colore del canvas esterno approvati su iPhone, contratto strutturale verificato su Windows; la matrice estesa resta nel collaudo finale M10;
- [x] ridurre CSS duplicato senza aumentare il cascade globale: i due form Account usano un solo foglio canonico e gli stati pagina sono nel core condiviso;
- [x] completare l’infrastruttura i18n e l’accessibilità tecnica: stati asincroni, focus, target tattili, movimento ridotto e dialoghi sono coperti; revisione editoriale di tutte le lingue resta vincolata al post-M10;
- [x] applicare budget per font e icone: Manrope e Material Symbols restano locali, non bloccanti e protetti dal gate M4.

**Uscita:** UI coerente e più leggera, senza una libreria astratta sovradimensionata.

<a id="fonte-docs-piano-maturita-professionale-md-m5--condivisione-professionale"></a>

#### M5 — Condivisione professionale

- [x] threat model completo del flusso proprietario/invitato;
- [x] verificare come il destinatario ottiene il materiale necessario alla decifratura;
- [x] confrontare ACL attuale e condivisione crittografica;
- [x] progettare ruoli, revoca, scadenza e cronologia;
- [x] prototipo isolato della chiave per-record, incluse ACL Firestore e Storage candidate in emulatore;
- [~] migrazione simulata soltanto su dataset fittizio; integrazione e copia non produttiva reale non avviate.

**Uscita:** autorizzazione e crittografia sono entrambe dimostrate end-to-end.

<a id="fonte-docs-piano-maturita-professionale-md-m6--sincronizzazione-e-scritture-offline"></a>

#### M6 — Sincronizzazione e scritture offline

- [x] modello di revisione, coda cifrata, idempotenza e conflitti per il perimetro privato isolato;
- [x] prove del cutover registrate nel contratto M6;
- [ ] consultazione bancaria offline iPhone e matrice completa;
- [ ] fallback quando Web Locks non è disponibile e collaudi aggiuntivi dei dispositivi supportati.

**Uscita:** nessuna perdita o sovrascrittura silenziosa nel perimetro collaudato; estensione ad altri domini separata.

<a id="fonte-docs-piano-maturita-professionale-md-m7--cronologia-cestino-e-audit"></a>

#### M7 — Cronologia, cestino e audit

- [x] archivio e purge manuale implementati; distribuzione e collaudo storico del 09/09 registrati in M7;
- [x] audit tecnico e controlli di revisione/idempotenza nel perimetro implementato;
- [ ] politica di retention complessiva approvata e verificata su dati, allegati e backup.

**Uscita:** recupero e cancellazione verificabili; il collaudo storico non chiude la decisione sulla retention.

<a id="fonte-docs-piano-maturita-professionale-md-m8--backup-e-recupero"></a>

#### M8 — Backup e recupero

- [x] formato v2 cifrato, Recovery Key distinta, integrità e anteprima implementati;
- [x] distribuzione e prova di recupero riuscita su account di prova registrate il 09/09 in M8;
- [ ] gestione completa delle interruzioni fra blocchi e allegati;
- [ ] rispondenza al requisito di staging e ripresa/rollback su copia non produttiva;
- [ ] limiti di memoria e matrice fisica completa.

**Uscita:** recupero dimostrato anche in errore. Emergency Access resta separato e non attivato.

<a id="fonte-docs-piano-maturita-professionale-md-m9--salute-credenziali-e-integrazioni"></a>

#### M9 — Salute credenziali e integrazioni

- [x] analisi locale e UI su richiesta implementate, con collaudo iPhone registrato il 10/09;
- [ ] collaudo Windows;
- [ ] provider violazioni, privacy e consenso prima di qualsiasi attivazione di rete;
- [x] passkey di servizio e autofill esterno distinti dallo sblocco Vault e dalla PWA.

**Uscita:** nessuna integrazione riduce la sicurezza o appesantisce il bootstrap.

<a id="fonte-docs-piano-maturita-professionale-md-m10--hardening-e-rilascio-maturo"></a>

#### M10 — Hardening e rilascio maturo

- [~] checklist tecnica e threat model consolidati; revisione OWASP finale e audit indipendente ancora richiesti;
- [~] dipendenze, CSP, App Check e Rules coperti da gate statici/emulatori; verifica in produzione ancora richiesta;
- [ ] test end-to-end su iPhone, Windows e browser supportati;
- [ ] audit esterno indipendente quando il modello crittografico è stabile;
- [~] procedura di recupero e risposta agli incidenti aggiunta; guida utente e revisione privacy finali ancora richieste.

**Uscita:** release candidata documentata, misurata e ripristinabile.

> **Censimento dei gate aperti M6–M10 (21/09/2026):** tabella con fonte, evidenza, ciò che manca, dipendenza e un solo passo autonomo consigliato in [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1). Il censimento è documentale e non chiude alcun gate.

<a id="fonte-docs-piano-maturita-professionale-md-attività-conclusiva-dopo-m10--lingue-impostazioni-e-campi-protetti"></a>

#### Attività conclusiva dopo M10 — Lingue, Impostazioni e campi protetti

Questa attività è un promemoria vincolante, ma **non deve essere anticipata durante le fasi M0–M10**. Una volta completato l’intero programma di maturazione:

- riesaminare tutte le lingue e tutte le stringhe dell’app;
- completare e uniformare le traduzioni, eliminando testi mancanti, duplicati o incoerenti;
- verificare terminologia, maiuscole, messaggi di errore, accessibilità e adattamento dei testi su mobile;
- riesaminare integralmente la pagina **Impostazioni**;
- riordinare card e comandi in gruppi logici, coerenti e facilmente riconoscibili;
- eliminare eventuali doppioni soltanto dopo averne verificato utilizzo e collegamenti;
- censire in tutte le pagine ogni campo che presenta il lucchetto o un comando per occultare e mostrare dati sensibili;
- verificare manualmente che ciascun lucchetto sia attivo e che nasconda il valore all'apertura, lo mostri soltanto su richiesta e torni a occultarlo correttamente;
- controllare i campi protetti sia in visualizzazione sia nei form di inserimento e modifica, su account privati e aziendali;
- registrare eventuali campi con icona presente ma comportamento assente, incoerente o non accessibile e correggerli prima della chiusura post-M10;
- collaudare il risultato su iPhone, PC e in tutte le lingue supportate.

**Uscita:** lingue coerenti, pagina Impostazioni organizzata definitivamente per gruppi e tutti i campi sensibili realmente protetti da lucchetti funzionanti, dopo la stabilizzazione tecnica M0–M10.

<a id="fonte-docs-piano-maturita-professionale-md-7-regole-di-esecuzione"></a>

### 7. Regole di esecuzione

1. Una sola fase strutturale attiva per volta; correzioni urgenti possono essere isolate.
2. Nessun cambio di formato dati senza lettore retrocompatibile, backup e rollback.
3. Nessuna funzione viene rimossa perché “sembra inutilizzata” senza prova da runtime, riferimenti e test.
4. Ogni rifattorizzazione deve ridurre o mantenere peso, richieste e tempo; un aumento richiede motivazione.
5. Nessun dato sensibile nei log, nelle metriche o nei dataset di prova.
6. Commit piccoli e tematici; push e deploy soltanto dopo suite verde e autorizzazione.
7. Le implementazioni precedenti vengono eliminate soltanto quando il percorso canonico supera tutti i gate.
8. AI, OCR e funzioni accessorie non entrano nel percorso critico di apertura.
