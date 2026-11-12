# Sicurezza

<a id="cornice-c1-frame-entry-runtime-2026-11-12"></a>

## C1 — contratto candidato del primo errore v2, 12/11/2026

Il runner osserva l'ingresso della Home nella cornice senza anticiparlo con goto. App standalone persistente con Auth pronta è C1_FRAME_NOT_ENTERED, nessun invio Master. Budget iniziale complessivo, Resource Timing, identità/claim QA2 e guardia immediatamente prima della Master invariati; nessun nuovo login, retry o deroga ai gate.

Il rapporto v2 aggiunge soltanto firstError, null o oggetto esatto phase/source/frame/tag/host con [enum chiusi e regole di combinazione](../procedure/COLLAUDI.md#cornice-c1-frame-entry-runtime-2026-11-12). Codice e fase sono prenotati al primo fatal; nessun errore successivo di DIAG o cleanup lo sostituisce. Prefissi console sconosciuti/dinamici restano OTHER; solo RESOURCE permette categoria host da location, mai URL o testo del messaggio. L'attribuzione frame può restare other quando il contesto non è verificabile; non si deduce dal nome del file sorgente e non si prolunga il budget per ottenerla.

I canali nativi console/pageerror/HTTP restano invariati: nessuna nuova binding o intercettazione di error/unhandledrejection, nessun preventDefault o modifica al logger. Pageerror non fornisce un Frame verificabile: si registra other senza leggere messaggio/stack per inventare una correlazione. Per console l'eventuale handle serve solo a classificare il realm, senza leggerne il valore. Nessun messaggio, stack, URL, frame name, UID/email/record ID, valore, chiave o token in report/artefatti. Il validatore ricostruisce l'intero schema v2 e i casi/DIAG, rifiutando campi estranei prima della scrittura; ricevute v1 storiche immutate. [Banco e limiti](../evidenze/COLLAUDI.md#cornice-c1-frame-entry-runtime-2026-11-12). Il canary resta OFF; nessun quarto giro, self-hosted o deploy autorizzato dal banco.

<a id="cornice-c1-qa2-segreti-2026-11-12"></a>

## C1 automatizzato — QA2 esclusivamente sintetica e segreti, 12/11/2026

L'account QA2 del runner C1 deve contenere **sempre e soltanto dati inventati: mai dati reali**, personali o aziendali. La Master e le credenziali restano segreti da proteggere anche per un account sintetico. L'uso nei segreti GitHub è limitato a QA2 approvata, environment protetto con approvazione personale e ordine di esecuzione; nessun account personale entra nel runner. Se la natura sintetica non è verificata, oppure vengono introdotti dati reali, sospendere le run, mantenere il canary OFF e rivedere gestione/accessi ai segreti prima di riprendere.

UID/email vengono confrontati privatamente e non riportati; password, Master, token e claim estranei non entrano in log, screenshot, trace, HAR, storageState o artefatti. Il browser non eredita i segreti del processo Node; report ricostruiti da schema chiuso, solo codici e DIAG sanificata. L'adapter non crea/ruota credenziali, non usa ADC/SDK Admin e non scrive singleton, claim, Rules o Functions.

La diagnostica Auth C1 usa soltanto C1_AUTH_HTTP_APPCHECK, C1_AUTH_HTTP_IDENTITY, C1_AUTH_HTTP_FIRESTORE, C1_AUTH_HTTP_OTHER, C1_AUTH_EMAIL_UNVERIFIED, C1_AUTH_NOT_READY_LOGIN, C1_AUTH_NOT_READY_ROUTE, C1_AUTH_NOT_READY_RESOURCE, C1_AUTH_NOT_READY_USER e C1_LANGUAGE_DIALOG. Per 401/403 si confronta il solo hostname con l'elenco esatto documentato nel [piano](../procedure/COLLAUDI.md#cornice-c1-auth-codici-2026-11-12); l'URL è transitorio e non viene conservato né riportato. Nessun suffisso, path, query, header, body, nome host arbitrario o messaggio del provider entra nel rapporto. Categoria del servizio o osservazione di readiness non significa causa del diniego. Tutti questi sottocodici restano BLOCKED, con OFF_REQUIRED e nessun retry; il primo errore resta prevalente. Il controllo email del bootstrap segue il confronto privato dell'identità QA2 e precede la Master.

Il runner deve attendere il bootstrap reale e gestire soltanto il comando UI canonico per utente esistente del dialogo lingua, senza forzare DOM/storage o inizializzare un'Auth diversa. Budget iniziale di 30 secondi, anche con check token pendente; check non verificabile = C1_BOOTSTRAP_MISMATCH. Nessun risultato tardivo o segnale di visibilità da solo concede l'invio della Master. [Readiness e gate](../procedure/COLLAUDI.md#cornice-c1-bootstrap-readiness-2026-11-12).

Gli altri status HTTP almeno 400 usano la stessa mappa esatta con C1_HTTP_FAILURE_APPCHECK, C1_HTTP_FAILURE_IDENTITY, C1_HTTP_FAILURE_FIRESTORE o C1_HTTP_FAILURE_OTHER. Restano FAIL, con OFF_REQUIRED e nessun retry, senza aggiungere lo status, URL o payload al rapporto. Anche un 400 App Check conserva così la categoria; non prova un rifiuto reCAPTCHA né una causa particolare. Risposte senza errore non emettono un codice di fallimento.

L'opzione self-hosted con Chrome visibile è soltanto [una valutazione](../procedure/COLLAUDI.md#cornice-c1-self-hosted-valutazione-2026-11-12). I segreti dell'environment e il filtro dell'ambiente browser non isolano il PC dai job: nessuna registrazione del computer personale o concessione di accesso è autorizzata da questo documento. Restano vietati debug token App Check e riduzioni di Auth/Rules per ottenere un test verde.

2FA/MFA non viene indebolita per il test: se QA2 richiede TOTP, stato BLOCKED e decisione di Diego, senza recupero o disattivazione automatica. L'ammissione server e i controlli dell'app restano effettivi. Login/bootstrap, preferenze timeout 1/3 e logout possono scrivere: richiedono l'ordine esplicito con gli effetti elencati nel [piano C1](../procedure/COLLAUDI.md#cornice-c1-e2e-piano-2026-11-12). Un verde locale o GO sul piano non autorizza produzione, merge, deploy o attivazione.

La [ricevuta della configurazione GitHub](../evidenze/COLLAUDI.md#cornice-c1-workflow-config-2026-11-12) attesta soltanto environment, protezioni, variabile operatore e presenza dei quattro nomi di segreti. Non attesta contenuti, corrispondenza effettiva QA2, stato MFA, login o provider. Lo spostamento del workflow nel percorso riconosciuto da Actions non concede un ordine di esecuzione: approvazione di Claude sullo SHA, ordine personale di Diego, gate dell'environment e attestazioni del singolo giro restano distinti.

## Conferma Vault nella cornice — isolamento dell'interazione, 10/11/2026

L'isolamento UI del dialogo parent e un obbligo distinto dall'ammissione e dalla disponibilita della chiave. Un hold della modale non concede ne conserva materiale Vault, non rinnova i timer e non neutralizza abort/revoca. Iframe inert, focus confinato e rilascio subordinato allo stato corrente sono definiti nel [contratto UI](INTERFACCIA.md#cornice-dialogo-ui-2026-11-10). La diagnostica active/permitValid non certifica da sola uno sblocco riuscito; prova UI locale, stato della chiave e collaudo fisico restano evidenze diverse.

## ADC impersonata del runner cornice — contratto candidato, 10/11/2026

Accettare solo ADC impersonated_service_account per il SA dedicato, sorgente authorized_user validata, URL IAM ufficiale esatto, universo predefinito e assenza di delegate/progetto quota. Il JSON validato una volta alimenta esplicitamente GoogleAuth, senza successiva ricerca di altri file/cache; Auth lettura, GET REST singleton e unico POST claim condividono la credenziale impersonata in RAM. Rifiutare emulatori e override quota. Nessun token, UID o dato Auth nei rapporti, anche sola prova. --remove elimina soltanto il claim cornice, dopo OFF e prima del cambio binding; nessuna ripetizione o ripristino globale dopo esito incerto.

Il ruolo Auth get/update ha ambito progetto; Firestore entities.get si restringe per database, **non al documento**. Il vincolo a target/claim/singleton è del runner, non IAM. Il refresh token sorgente nell'ADC rimane sensibile e potenzialmente più privilegiato del SA: protezione locale e revoca obbligatorie, nessuna promessa di isolamento dall'Owner. Nessuna chiave privata SA generata. [Istruzioni e limiti di revoca](RILASCIO.md#cornice-adc-impersonata-2026-11-10). Compatibilità offline e autorizzazione produttiva rimangono attestazioni distinte.

## Preparazione amministrativa del claim cornice — 10/11/2026

Runner manuale e una tantum per UID approvato esplicito, fase sintetica prima della personale; [decisione](../progetto/DECISIONI.md#cornice-canary-due-fasi-2026-11-10). Non usa runner QA, non crea credenziali/utenti, non modifica Vault, singleton o altre risorse. `setCustomUserClaims` sostituisce la mappa: conservarla integralmente in RAM, doppia lettura prima dell'unico set e verifica completa dopo; **non è CAS né transazione** e richiede una finestra a scrittore unico confermata. Il writer effettivo usa un solo POST REST fisso con ADC, senza retry o redirect; la lettura Auth mantiene l'SDK, il singleton usa un GET REST fisso con la stessa credenziale. Deriva, errore o risultato incerto fermano la sequenza senza retry né ripristino dell'intera mappa. [Semantica Firebase](https://firebase.google.com/docs/auth/admin/custom-claims).

Default dry-run senza salvataggi o scritture cloud, senza UID anche in sola prova per l'ultimo ordine di Diego; output solo codici/booleans/conteggi, niente token, email, valori/nomi degli altri claim o errori SDK liberi. La precedente eccezione UID nel dry-run è superata: nessun identificativo in rapporti, DIAG, MD, PR o log. Input privato e ricevuta pre-scrittura fuori da Git/OneDrive; ricevuta cifrata DPAPI CurrentUser verificata, mai JSON temporaneo in chiaro. Il canale amministrativo esistente e i percorsi privati richiedono conferma prima dell'uso; nessun nuovo login o chiave impliciti. Singleton completo/spento, identità verificata e scadenza futura sono necessari per apply grant; apply remove ammette scadenza passata/assente ma richiede OFF e binding invariato; quattro campi senza expiresAt sono solo staging negato. La consegna presente non esegue il runner o richieste Firebase.

<a id="cornice-diag-sicurezza-2026-11-10"></a>

## DIAG — diagnostica locale della cornice, candidata 10/11/2026

Mandato diretto di Diego: passo DIAG sulla PR #278 prima dell'esecuzione B3, senza operazioni Firebase o deploy. Registro separato dalle metriche prestazioni, **spento di default**, volontario e limitato alla singola scheda: sessionStorage, eliminato anche alla chiusura della scheda. Disattivarlo elimina consenso ed eventi. Nessuna telemetria: nessun invio di eventi/rapporto a rete, Firestore, Functions o provider; soltanto copia esplicita negli appunti e cancellazione. Caricare i moduli statici dell'app e il ping locale MessageChannel non trasmette il rapporto.

Ogni evento ha **esattamente** code, at, version, page, environment: codice da allowlist chiusa, tempo numerico, versione canonica, nome pagina da elenco finito senza percorso/query/hash, browser oppure PWA. Motivi di blocco ed errori sono codici fissi, mai testo libero. Codici/campi estranei, URL/ID, versioni/ambienti arbitrari, timestamp futuri e archivi malformati sono rifiutati; non si ripulisce un payload estraneo fingendolo attendibile. Nessun UID/email, ID record/notifica, URL completo, query/hash, token, ticket/nonce Auth, chiavi/grant, contenuto Vault, messaggio/stack originale nel registro o rapporto.

Massimo **200** eventi, soltanto gli ultimi; durata **inferiore a 7 giorni**. Lettura/copia esclude sempre gli scaduti e li rimuove alla prima esecuzione disponibile; una scheda congelata dal browser non può eseguire una cancellazione a orologio. A registro spento non si crea, raccoglie, pota o scrive un buffer: nessun append né archivio automatico. Le sole scritture del consenso avvengono per gesto esplicito; cancellazioni di riservatezza su logout/invalidazione non sono raccolta eventi.

Il consenso è legato a generazione opaca e revisione numerica del fence, metadata locali non inclusi nel rapporto. L'identità canonica è confrontata **soltanto in RAM**, mai salvata dalla DIAG. Logout/null, cambio UID o invalidazione Auth/fence cancellano subito consenso e journal prima degli await e disabilitano la raccolta. Una nuova revisione non può leggere il vecchio registro; una nuova attivazione richiede un gesto. Cambi pagina/sblocchi/timeout Vault non sono logout: non cancellare la cronologia a ogni vault-session-locked. La sola Cancellazione del journal mantiene il consenso ma ruota la generazione, così le risposte pendenti precedenti non lo ricreano.

Import/risposte tardive verificano ancora consenso catturato, documento vivo/proprio figlio e identità/fence locali. pagehide è terminale per il vecchio scrittore; non adottare callback nel successore o dopo BFCache senza nuova inizializzazione. Nessuna eccezione diagnostica deve bloccare o concedere la Vault. Lo storage negato rimane non disponibile, senza ripiego in localStorage/IndexedDB o invio remoto.

Il worker FCM **non persiste** e non possiede chiavi: trasmette soltanto protocollo/codice al client principale selezionato. ACK significa ricevuto dal worker, non solo inviato dal padre. Fallback distingue richiesto, promise risolta ed errore; la risoluzione non prova una nuova finestra PWA. L'osservatore opt-in convalida evento nativo/origine/registrazione FCM attiva/schema e lifecycle dopo l'attesa. Nessun osservatore/delivery = dato non osservato, non PASS inventato. [Contratto UI](INTERFACCIA.md#cornice-diag-ui-2026-11-10), [prove](../evidenze/COLLAUDI.md#cornice-diag-verifiche-2026-11-10).

## Vincoli della candidata locale — 07/11/2026

Le nuove create di inviti devono usare un'identità v2 vincolata a UID proprietario e risorsa completa; una semplice verifica di esistenza dell'Account non basta a impedire collisioni tra proprietari. Restano compatibili gli inviti legacy già esistenti, non la creazione di nuovi ID legacy da vecchi client. Il rilascio deve coordinare client, Rules e Functions e conservare un rollback coerente.

Le anteprime portabili di testo non interpretano HTML/XML; `sandbox` applicato a un elemento `object` non costituisce isolamento. Gli invii email di inviti e scadenze condividono il budget provider transazionale. La cache offline non prova l'autorizzazione del nuovo utente: prima del rendering occorre binding UID/email verificata, con revoche note prevalenti. Ogni copia della capacità di decifrare, mostrare, copiare o dettare nella Ricerca deve decadere al blocco e al teardown anche durante un await; azzerare soltanto la chiave centrale non basta.

Prove e limiti in [AUDIT](../evidenze/AUDIT.md#sicurezza-candidata-2026-11-07). I vincoli non attestano una certificazione completa né l'attivazione produttiva della candidata.

## Strumenti di revisione AI e validità della procedura ECC — 07/11/2026

Il controllo delle configurazioni degli agenti AI è distinto dall'audit della sicurezza applicativa. La [procedura temporanea ECC/AgentShield](../procedure/COLLAUDI.md#controllo-sicurezza-ecc-temporaneo) documenta una futura prova circoscritta, successiva alla chiusura della revisione di sicurezza corrente; non attesta installazione, esecuzione o certificazione dell'app. L'edizione del 07/11/2026 scade il **07/11/2027** e da tale data è obsoleta per uso operativo senza nuova verifica e revisione esplicita. Chi consulta questo contratto deve controllare quella scadenza e confrontare gli strumenti allora disponibili, anticipando il riesame se cambiano i presupposti tecnici. I passi e i criteri sono mantenuti soltanto nella procedura collegata.

## Modello delle minacce operativo e sorveglianza continua — 03/11/2026

Il perimetro da proteggere comprende sia l'app pubblica sia il PC Windows usato per sviluppo e rilascio. Gli asset principali sono: contenuto cifrato della Vault, chiavi presenti soltanto sul dispositivo, identità Firebase, sessioni e fattori MFA, allegati, condivisioni, backup e archivi esportati, configurazione Firebase, credenziali di rilascio, repository GitHub e postazione di sviluppo. Il monitoraggio non deve leggere contenuti della Vault, Master Password, Recovery Key, token, cookie, allegati decifrati o dati personali.

I confini di fiducia sono: browser/PWA e memoria del dispositivo; Service Worker, cache e storage locale; Firebase Authentication e App Check; Firestore e Storage protetti dalle Rules; Cloud Functions con Admin SDK; servizi e-mail/push; GitHub Actions e supply chain npm; sistema operativo, browser e strumenti del PC di sviluppo; file esportati che escono dal perimetro cifrato. L'Admin SDK bypassa le Rules e costituisce quindi un confine privilegiato che richiede autorizzazione esplicita in ogni handler.

| Superficie | Percorso d'attacco prioritario | Controlli e verifiche richiesti |
|---|---|---|
| Login, reset, MFA e sessioni | furto account, token riusato, enumeration, recupero abusato | verifica e-mail, autenticazione recente, App Check, revoca sessioni, rate limit, messaggi non rivelatori |
| Vault e crittografia client | XSS, dipendenza compromessa, chiave persistita, IV/AAD errati | CSP, dipendenze fissate, Web Crypto autenticato, chiavi solo in RAM, test di formato e blocco sessione |
| Firestore e Storage | Rules eccessive, IDOR, percorso o allegato sostituito | default deny, vincolo UID/ACL, schema e dimensioni, generation/CAS, test emulatori |
| Cloud Functions | autorizzazione mancante, payload ostile, abuso risorse, segreti nei log | Auth/App Check, allowlist, limiti, idempotenza, audit minimo, nessun plaintext o chiave |
| Condivisioni e inviti | destinatario errato, revoca incompleta, copia residua | identità canonica, grant per destinatario, stato atomico, rotazione, prova a due utenti |
| Allegati, QR, OCR, PDF e import | parser vulnerabile, file attivo, decompression bomb, spoofing MIME | limite tipo/dimensione, magic bytes, cifratura prima dell'upload, viewer controllato, dipendenze aggiornate |
| Backup, ripristino e Archivio portabile | file manipolato, collisione, export in chiaro, residui temporanei | AEAD, manifest e digest, staging/CAS, avviso copia leggibile, pulizia temporanei, nessun import implicito |
| PWA, offline e Push | cache avvelenata, vecchio codice, dati tra utenti, payload rivelatore | shell versionata, invalidazione su logout/upgrade, ciphertext locale, push minimizzato |
| Hosting e browser | XSS, clickjacking, framing, CORS/CSP errati, vulnerabilità engine | CSP e header di sicurezza, frame-ancestors, origin allowlist, matrice Chrome/Edge/Safari aggiornata |
| Repository e CI/CD | dipendenza o Action compromessa, segreto nel commit, deploy non revisionato | lockfile, revisioni fissate, least privilege, secret scanning, branch protection, gate prima del deploy |
| PC di sviluppo | malware, browser/Node/Git vulnerabili, furto token, servizio esposto | patch Windows/browser/toolchain, cifratura disco, account protetto, credenziali in store sicuro, firewall e nessun listener pubblico |

La sorveglianza quotidiana correla gli advisory soltanto con componenti e versioni realmente presenti. Le notizie sociali sono segnali, non prove: ogni allarme richiede una fonte primaria del produttore o un registro autorevole, verifica dell'applicabilità e un'azione concreta. Nessuna patch, modifica, commit o pubblicazione è automatica.

## Anteprime temporanee e copie leggibili dell'Archivio portatile — 25/10/2026

Il visualizzatore non estrae automaticamente allegati in chiaro. Anteprima, salvataggio singolo, salvataggio collettivo ed esportazioni JSON/CSV/ODS/XLSX sono azioni esplicite; prima della persistenza viene mostrato che il risultato è decifrato e deve essere custodito in un luogo sicuro. Gli allegati vengono riletti e autenticati dal contenitore prima dell'uso.

Per i file grandi il browser usa esclusivamente un namespace temporaneo OPFS dell'applicazione, senza Cache Storage o IndexedDB. Alla chiusura revoca gli Object URL, elimina i file temporanei e azzera i buffer mutabili disponibili; all'avvio rimuove eventuali residui di una chiusura improvvisa. Il contratto non promette cancellazione fisica forense assoluta dalla RAM, dai file di paging o dal supporto. Errori di codec, compatibilità, quota/memoria, PDF e integrità restano distinti e non degradano in esposizione parziale.

## Archivio portatile di allegati a blocchi — 24/10/2026

L'esportazione non ricompone in RAM gli allegati grandi. Prima di leggere Storage valida versione crittografica, tipo video, limite dichiarato, dimensione e numero dei blocchi, ordine e unicità dei percorsi, IV, dimensioni chiare/cifrate e somma finale. La chiave-file viene aperta una volta, ogni blocco viene scaricato entro la dimensione dichiarata, autenticato con AES-GCM e AAD già vincolato a identità e posizione, consegnato al writer e azzerato prima del blocco successivo. La chiave-file viene azzerata anche in caso di errore.

Il writer portabile conserva PBKDF2-SHA256 a 600.000 iterazioni e AES-GCM-256 concatenato del formato v2. Manifest, ordine, conteggi, dimensioni, digest, terminatore ed EOF restano verificati prima dell'esposizione; il visualizzatore esegue una seconda lettura autenticata per salvare un allegato. Blocco mancante o sostituito, manifest incoerente, dimensione diversa o tag AEAD non valido producono un fallimento chiuso e nessun archivio parziale utilizzabile.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Indice delle fonti conservate

- [ARCHITETTURA_SICUREZZA_V1.md](#fonte-docs-architettura-sicurezza-v1-md-l1)

<a id="fonte-docs-architettura-sicurezza-v1-md-l1"></a>

## Fonte: ARCHITETTURA_SICUREZZA_V1.md — righe originali 1–378

> Provenienza: `docs/ARCHITETTURA_SICUREZZA_V1.md` a `2900ccc0`.

<a id="fonte-docs-architettura-sicurezza-v1-md-architettura-sicurezza-v1--codici--password"></a>

## Architettura Sicurezza V1 — Codici & Password

> **Stato:** baseline architetturale approvata l'11 settembre 2026.\
> **Ambito:** dati riservati, credenziali, account privati e aziendali, widget, allegati, condivisioni, cache offline, notifiche, backup e recupero.\
> **Natura del documento:** architettura obiettivo e criterio vincolante per le decisioni future. Non certifica che il codice o i dati di produzione siano già conformi.\
> **Regola di cambiamento:** questa baseline non si modifica per adattarla a una singola funzione. Una modifica richiede motivazione, minaccia affrontata, impatto sui dati esistenti, piano di migrazione, rollback, test e approvazione esplicita del product owner.

<a id="fonte-docs-architettura-sicurezza-v1-md-1-scopo"></a>

### 1. Scopo

Codici & Password tratta informazioni il cui accesso improprio può produrre danni importanti: credenziali, PIN, informazioni bancarie, documenti, allegati e dati condivisi.

L'obiettivo è ottenere contemporaneamente:

1. confidenzialità: Firebase e gli operatori del servizio non devono conoscere il contenuto riservato;
2. integrità: alterazioni e sostituzioni devono essere rilevabili;
3. disponibilità: i dati devono poter essere consultati offline e recuperati in modo controllato;
4. autorizzazione: ogni operazione deve essere concessa soltanto al soggetto corretto;
5. minimizzazione: conservare soltanto ciò che serve;
6. reattività: le operazioni comuni devono apparire immediate senza ridurre la sicurezza;
7. evoluzione verificabile: nessuna migrazione implicita o riscrittura generale senza prove e rollback.

<a id="fonte-docs-architettura-sicurezza-v1-md-2-principio-centrale"></a>

### 2. Principio centrale

> **Il dispositivo cifra e decifra. Firebase conserva. Le Security Rules proteggono le operazioni semplici. Le Cloud Functions governano le operazioni complesse. Il server non possiede le chiavi dei contenuti.**

La cifratura avviene prima dell'invio. Firestore, Storage e Functions ricevono ciphertext e metadati minimi. Le Functions non costituiscono il livello crittografico: costituiscono il livello di controllo per autorizzazioni, transazioni, condivisioni, revisioni, quote, notifiche e audit.

Il sistema deve applicare difesa in profondità: cifratura, autenticazione, autorizzazione, validazione, minimizzazione, isolamento delle chiavi, test, monitoraggio senza segreti e recupero controllato.

<a id="fonte-docs-architettura-sicurezza-v1-md-3-fonti-normative-e-tecniche"></a>

### 3. Fonti normative e tecniche

Questa baseline deriva principalmente da:

- [GDPR — Regolamento (UE) 2016/679](https://eur-lex.europa.eu/legal-content/IT/TXT/HTML/?uri=CELEX:32016R0679): protezione fin dalla progettazione e per impostazione predefinita, minimizzazione e misure proporzionate al rischio;
- [NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final): gestione completa del ciclo di vita delle chiavi;
- [NIST SP 800-63B-4](https://csrc.nist.gov/pubs/sp/800/63/b/4/final): autenticazione digitale e livelli di garanzia;
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html): threat model, minimizzazione, cifratura autenticata e separazione chiavi/dati;
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html): generazione, custodia, rotazione, recupero e dismissione delle chiavi;
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): validazione e isolamento degli allegati;
- [Firebase Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started): autorizzazione e validazione server-side delle richieste client;
- [Firebase App Check](https://firebase.google.com/docs/app-check): attestazione del client complementare ad Authentication.

Queste fonti definiscono principi e controlli. La conformità legale effettiva richiede anche valutazione professionale rispetto a finalità, titolarità, utenti, paesi e categorie di dati trattate.

<a id="fonte-docs-architettura-sicurezza-v1-md-4-modello-delle-minacce-minimo"></a>

### 4. Modello delle minacce minimo

Il progetto deve considerare almeno:

| Minaccia | Controllo architetturale |
|---|---|
| Accesso al database o backup | Dati riservati cifrati lato client; chiavi assenti dal server |
| Account Firebase compromesso | Separazione tra autenticazione e sblocco del Vault; MFA/passkey; revoca dispositivi |
| Client contraffatto o automazione abusiva | Authentication, App Check, Rules, rate limit e quote |
| Utente che modifica campi non autorizzati | Allowlist di campi, tipi, dimensioni, proprietario e revisioni |
| Function o amministratore curioso | Function riceve ciphertext e metadati minimi, mai chiavi Vault o plaintext |
| XSS o dipendenza frontend compromessa | CSP rigorosa, niente script inline, dipendenze bloccate, audit e riduzione superficie |
| Alterazione del ciphertext | Cifratura autenticata e AAD che lega proprietario, record, tipo e versione |
| Riutilizzo di nonce/IV | Nonce casuale e unico per ogni operazione secondo il contratto crittografico |
| Furto o smarrimento dispositivo | Blocco Vault, sessione limitata, revoca dispositivo, dati locali cifrati |
| Condivisione revocata | Rotazione delle chiavi per le versioni future; limite delle copie già viste dichiarato |
| Allegato malevolo | Formati limitati, firma/tipo/dimensione verificati, apertura controllata |
| Cancellazione o corruzione | Cestino cifrato, backup autenticato, versioni e prova periodica di ripristino |
| Log o notifica rivelatrice | Nessun segreto, allegato o contenuto Vault nei log, push, email o analytics |

Il motore AI locale può richiedere compilazione WebAssembly sotto CSP esclusivamente tramite la sorgente mirata `'wasm-unsafe-eval'` e artefatti fissati same-origin. La sorgente generale `'unsafe-eval'`, che estenderebbe il permesso anche alla valutazione dinamica JavaScript, resta vietata e deve essere controllata come token distinto nei gate di rilascio.

Prima di una modifica strutturale deve essere indicato quale rischio viene ridotto e quale nuovo rischio viene introdotto.

<a id="fonte-docs-architettura-sicurezza-v1-md-5-classificazione-dei-dati"></a>

### 5. Classificazione dei dati

<a id="fonte-docs-architettura-sicurezza-v1-md-51-segreti-e-contenuto-riservato"></a>

#### 5.1 Segreti e contenuto riservato

Devono essere sempre cifrati prima di lasciare il dispositivo:

- password, PIN, codici dispositivi e codici di recupero;
- numeri di carta, CCV, IBAN quando associabile a una persona o account;
- risposte di sicurezza;
- username, email o codici quando fanno parte del contenuto del Vault;
- note, campi widget e valori personalizzati;
- contenuto e metadati sensibili degli allegati;
- payload delle condivisioni;
- cronologia e cestino contenenti dati del Vault.

<a id="fonte-docs-architettura-sicurezza-v1-md-52-metadati-tecnici-minimi"></a>

#### 5.2 Metadati tecnici minimi

Possono restare leggibili dal servizio soltanto quando indispensabili:

- UID proprietario e destinatario;
- identificatori casuali;
- schemaVersion, revision, keyGeneration e stato transazionale;
- timestamp tecnici;
- dimensione e tipo generico dell'oggetto quando necessari alle Rules;
- stato di invito, autorizzazione, revoca o consegna;
- preferenze tecniche delle notifiche.

Titoli, nomi account, nomi file, descrizioni e testi delle scadenze non devono essere considerati innocui per impostazione predefinita.

<a id="fonte-docs-architettura-sicurezza-v1-md-53-dati-esclusi"></a>

#### 5.3 Dati esclusi

Non devono essere salvati se non necessari alla funzione. Debug, telemetry e audit non devono duplicare contenuti del Vault.

<a id="fonte-docs-architettura-sicurezza-v1-md-6-contratto-crittografico-obiettivo"></a>

### 6. Contratto crittografico obiettivo

1. Usare cifratura autenticata, con algoritmo e formato versionati. Il riferimento applicativo è AES-256-GCM tramite Web Crypto.
2. Ogni record protetto utilizza una chiave casuale dedicata oppure un modello equivalente formalmente documentato.
3. Ogni allegato utilizza una chiave-file casuale dedicata.
4. Le chiavi dati vengono avvolte da chiavi superiori; non vengono memorizzate in chiaro accanto al ciphertext.
5. L'AAD deve legare almeno versione, proprietario, tipo, identificatore e, quando applicabile, generazione/revisione.
6. Nonce/IV non possono essere riutilizzati con la stessa chiave.
7. Il formato salvato deve contenere versione dell'algoritmo e parametri necessari alla lettura, mai la chiave.
8. La Master Password non coincide con la password Firebase e non viene inviata al server.
9. Password, Vault Key, chiavi private decifrate e chiavi di record/file non devono entrare in localStorage, log, URL o analytics.
10. Le chiavi sbloccate restano in memoria per la durata strettamente necessaria.
11. Ogni evoluzione del formato richiede doppio lettore, migrazione verificata, integrità, rollback e rimozione legacy separata.

Parametri KDF, formato degli envelope e strategia di recupero devono essere raccolti in un contratto crittografico tecnico versionato e sottoposti ad audit indipendente prima di dichiarare la soluzione matura.

<a id="fonte-docs-architettura-sicurezza-v1-md-7-autenticazione-vault-e-dispositivi"></a>

### 7. Autenticazione, Vault e dispositivi

Firebase Authentication dimostra l'identità remota; non autorizza automaticamente la decifratura del Vault.

Il modello deve separare:

- credenziale di accesso Firebase;
- fattore forte o passkey/MFA;
- segreto di sblocco del Vault;
- materiale di recupero;
- identità crittografica usata per le condivisioni.

Requisiti:

- verifica email quando prevista;
- MFA o passkey per operazioni ad alto impatto;
- elenco e revoca dei dispositivi;
- timeout e blocco Vault;
- nuova autenticazione per esportazione, recupero, modifica sicurezza e operazioni distruttive;
- protezione contro tentativi ripetuti;
- nessuna biometria simulata: la biometria deve usare capacità reali del dispositivo e proteggere un segreto locale, non sostituire fittiziamente la crittografia.

App Check deve essere valutato e verificato in enforcement su Firestore, Storage e callable, senza considerarlo sostitutivo di Authentication o Rules.

<a id="fonte-docs-architettura-sicurezza-v1-md-8-matrice-firestore-diretto--cloud-functions"></a>

### 8. Matrice Firestore diretto / Cloud Functions

Non esiste la regola «tutto deve passare dalle Functions». La decisione dipende dagli invarianti.

| Operazione | Percorso obiettivo | Condizioni |
|---|---|---|
| Lettura di un proprio record cifrato | Firestore diretto | Rules proprietario, schema noto, dati cifrati |
| Creazione/modifica di un proprio record semplice | Firestore diretto | Allowlist completa, tipi, dimensioni, UID immutabile, revisione coerente |
| Widget personale contenuto in un solo record | Firestore diretto ammesso | Stessi controlli dei normali account; nessun collegamento parziale |
| Widget comune collegato a più account | Cloud Function | Scrittura atomica dei collegamenti, revisioni e rollback |
| Invito e condivisione | Cloud Function | Controllo mittente/destinatario, grant, envelope e transazione |
| Accettazione, rifiuto e revoca | Cloud Function | Aggiornamento atomico di ACL, stato, generazione e notifiche |
| Cambio proprietario o permessi | Cloud Function | Operazione privilegiata e autenticazione recente |
| Aggiornamento di più documenti | Cloud Function | Atomicità, idempotenza e conflitto |
| Cancellazione coordinata record/allegati | Cloud Function | Inventario oggetti, cestino/ritenzione e retry |
| Quote, rate limit e audit affidabile | Cloud Function | Il client non può auto-certificare il proprio consumo |
| Registrazione preferenze locali semplici | Firestore diretto | Rules ristrette e valori enumerati |
| Invio email/push | Backend/Cloud Function | Nessun segreto nel messaggio; deduplicazione e autorizzazione |

Le Functions devono rifiutare richieste non autenticate, token/app non validi quando enforcement è attivo, payload inattesi, dimensioni eccessive, revisioni obsolete e operazioni non idempotenti.

Le librerie server Firebase bypassano le Firestore Security Rules: ogni Function deve implementare esplicitamente autorizzazione e validazione. Essere nel backend non rende automaticamente sicura un'operazione.

<a id="fonte-docs-architettura-sicurezza-v1-md-9-prestazioni-e-risposta-istantanea"></a>

### 9. Prestazioni e risposta istantanea

La sicurezza non richiede di rendere lenta l'interfaccia.

Per le operazioni comuni:

1. validazione locale;
2. cifratura locale;
3. aggiornamento ottimistico della vista;
4. inserimento in una coda cifrata e osservabile;
5. scrittura diretta o Function secondo la matrice;
6. conferma, retry idempotente oppure rollback visibile.

L'interfaccia non deve dichiarare «salvato» se esiste soltanto una modifica in memoria. Deve distinguere almeno: locale, in sincronizzazione, sincronizzato, conflitto ed errore.

<a id="fonte-docs-architettura-sicurezza-v1-md-10-offline-cache-e-conflitti"></a>

### 10. Offline, cache e conflitti

- Nessun plaintext del Vault in localStorage.
- IndexedDB e cache persistenti possono contenere soltanto ciphertext, envelope cifrati e metadati minimi.
- La coda offline deve essere cifrata, versionata e collegata all'UID.
- Ogni entità modificabile deve avere schemaVersion, revision e updatedAt assegnati o verificati in modo affidabile.
- Retry e callable devono essere idempotenti.
- I conflitti non devono produrre sovrascritture silenziose.
- Logout, cambio utente, revoca dispositivo e blocco Vault devono eliminare chiavi in memoria e impedire l'apertura della cache.
- La disponibilità offline di una condivisione già decifrabile implica che la revoca non può cancellare retroattivamente quella copia.

<a id="fonte-docs-architettura-sicurezza-v1-md-11-allegati"></a>

### 11. Allegati

<a id="fonte-docs-architettura-sicurezza-v1-md-111-pipeline-obbligatoria"></a>

#### 11.1 Pipeline obbligatoria

1. selezione;
2. verifica dimensione massima;
3. allowlist estensione/formato;
4. verifica MIME senza fidarsi del valore fornito dal browser;
5. verifica firma/magic bytes quando applicabile;
6. nome oggetto casuale;
7. cifratura autenticata sul dispositivo con chiave-file dedicata;
8. caricamento come oggetto opaco;
9. salvataggio atomico o recuperabile del riferimento;
10. download autorizzato;
11. decifratura in memoria e apertura controllata.

Non utilizzare URL pubblici permanenti. Storage deve applicare least privilege e chiusura predefinita.

<a id="fonte-docs-architettura-sicurezza-v1-md-112-scelta-zero-knowledge"></a>

#### 11.2 Scelta zero-knowledge

La baseline adotta come obiettivo **zero-knowledge per il contenuto**: il server non riceve l'allegato in chiaro.

Conseguenza dichiarata: un server che vede soltanto ciphertext non può eseguire una scansione antivirus completa del contenuto. Per ridurre il rischio:

- limitare inizialmente i formati;
- effettuare controlli locali prima della cifratura;
- non eseguire contenuti attivi;
- usare viewer sicuri o download esplicito;
- mantenere browser e dipendenze aggiornati;
- valutare una scansione locale o un ambiente isolato quando tecnicamente disponibile.

Una futura scansione server del plaintext costituirebbe una modifica sostanziale al modello zero-knowledge e richiederebbe nuova approvazione.

<a id="fonte-docs-architettura-sicurezza-v1-md-12-condivisione"></a>

### 12. Condivisione

Il modello obiettivo usa chiavi per-record e grant per destinatario:

1. il proprietario cifra il record con una chiave casuale;
2. la chiave del record viene avvolta separatamente per ciascun destinatario autorizzato;
3. il backend verifica e registra ACL, stato, scadenza, ruolo e generazione;
4. il destinatario usa la propria identità crittografica per aprire il proprio envelope;
5. il backend non riceve plaintext o chiavi private decifrate;
6. gli allegati usano chiavi-file avvolte dalla chiave record o un contratto equivalente;
7. la revoca incrementa la generazione e protegge le versioni future;
8. una copia già vista, esportata o disponibile offline non può essere cancellata a distanza.

Notifiche, email e inviti contengono solo informazioni minime e non sostituiscono l'autorizzazione applicativa.

<a id="fonte-docs-architettura-sicurezza-v1-md-13-backup-recupero-e-cancellazione"></a>

### 13. Backup, recupero e cancellazione

I backup reali devono essere:

- cifrati e autenticati;
- versionati;
- separati dalle chiavi necessarie ad aprirli;
- soggetti a controllo accessi e retention;
- provati periodicamente con ripristino su ambiente non produttivo.

Lo zero-knowledge comporta un limite: senza un materiale di recupero valido, il servizio non può ricostruire il Vault. Il prodotto deve scegliere e spiegare una strategia, per esempio recovery key, dispositivo fidato o recupero sociale. Nessuna chiave di recupero può essere inviata in log, ticket, screenshot o chat.

La cancellazione deve includere dati principali, indici, copie ricevute controllabili, allegati, cache del dispositivo e backup secondo la politica di retention. Deve essere verificabile e compatibile con eventuali obblighi di conservazione.

<a id="fonte-docs-architettura-sicurezza-v1-md-14-log-notifiche-e-telemetria"></a>

### 14. Log, notifiche e telemetria

Non devono contenere:

- password, PIN, codici, token o chiavi;
- plaintext del Vault;
- contenuto o nomi sensibili degli allegati;
- payload completi;
- URL con segreti;
- dati personali non necessari.

Gli errori possono includere codice tecnico, fase, versione, operazione, UID pseudonimizzato e correlation ID. Push ed email devono adottare modalità discreta predefinita e aprire una destinazione interna che ripete autenticazione e autorizzazione.

<a id="fonte-docs-architettura-sicurezza-v1-md-15-requisiti-gdpr-e-organizzativi"></a>

### 15. Requisiti GDPR e organizzativi

Oltre ai controlli tecnici servono:

- finalità e base giuridica definite;
- minimizzazione e retention;
- informativa comprensibile;
- gestione dei diritti dell'interessato;
- inventario dei trattamenti e dei fornitori;
- localizzazione e trasferimenti dei dati verificati;
- procedura incidenti/data breach;
- ruoli e accessi amministrativi minimi;
- valutazione d'impatto quando richiesta dal rischio;
- revisione periodica delle misure.

«Dato sensibile» nel linguaggio comune non coincide sempre con «categoria particolare di dati» in senso GDPR. Credenziali, PIN e documenti restano comunque segreti ad altissimo impatto.

<a id="fonte-docs-architettura-sicurezza-v1-md-16-gate-obbligatori-prima-della-produzione"></a>

### 16. Gate obbligatori prima della produzione

Una modifica a cifratura, chiavi, Rules, Functions, condivisione, allegati, backup o migrazione non può essere dichiarata pronta senza:

- threat model aggiornato;
- inventario dei dati e dei metadati;
- test unitari e di integrazione;
- emulatori Firestore e Storage;
- test negativo per utenti anonimi, estranei, revocati e payload alterati;
- test offline, conflitto e retry;
- test su almeno i dispositivi/browser ufficialmente supportati;
- piano di migrazione e rollback;
- backup della copia di collaudo e prova di ripristino;
- verifica che log e notifiche siano privi di segreti;
- approvazione esplicita del product owner;
- audit indipendente prima di dichiarare la crittografia professionalmente matura.

<a id="fonte-docs-architettura-sicurezza-v1-md-17-stato-del-repository-al-momento-dellapprovazione"></a>

### 17. Stato del repository al momento dell'approvazione

L'11 settembre 2026 il repository presenta elementi già coerenti e altri ancora candidati:

- esiste cifratura AES-GCM e un inventario dei campi cifrati;
- Storage applica isolamento per UID e riconosce upload opachi marcati come cifrati;
- molte scritture proprietario sono ancora consentite direttamente dalle Rules;
- i nuovi Account Widget e i domini condivisi sono function-only;
- il modello con chiave per-record, grant, rotazione e allegati condivisi risulta documentato e collaudato in laboratorio, ma non autorizzato come migrazione di produzione;
- il gate automatico M0–M10 risulta documentato come superato;
- matrice fisica completa, verifica delle configurazioni reali e audit crittografico indipendente restano gate separati.

Queste osservazioni sono una fotografia documentale, non una certificazione runtime. Il successivo audit confronterà codice, Rules, Functions e tutti i Markdown con questa baseline.

<a id="fonte-docs-architettura-sicurezza-v1-md-18-metodo-per-laudit-dei-documenti-esistenti"></a>

### 18. Metodo per l'audit dei documenti esistenti

Prova candidata locale 12/09/2026, base `553a35d5`: compatibilità del gestore in RAM con verifier/envelope v2 e CPVK2 su soli dati sintetici; anteprima statica separata pronta per eventuale pubblicazione autorizzata. [Audit Vault §13](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-13-compatibilità-e-anteprima-offline--12092026) registra limiti e minacce. Nessuna modifica a baseline, dati o formato produttivo.

Attuazione sperimentale autorizzata 12/09/2026, base `a6f756cc`: [prototipo di navigazione persistente](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-11-prototipo-autorizzato--12092026), escluso dal runtime pubblico, con sola fixture fittizia. Dimostra un flusso con chiave in RAM ma non cambia gli invarianti o la classificazione di conformità dell’app reale.

Secondo aggiornamento di attuazione locale del 12/09/2026, base `67288cc3`: operazioni Vault pendenti invalidate dopo logout/blocco/reset e cambio UID; nessuna variazione della baseline o dei formati. [Audit Vault §9–10](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-9-correzione-locale-del-12092026--operazioni-concorrenti) distingue la correzione concorrente dalla proposta, ancora da scegliere, di navigazione persistente.

Aggiornamento di attuazione locale, 12/09/2026, base v1.2.110: pulizia esplicita della sessione prima di tutti i sette logout applicativi; dettagli, prove e rollback in [Audit Vault §8](../evidenze/AUDIT.md#fonte-docs-audit-vault-session-p0-md-8-correzione-locale-del-12092026--blocco-1-logout). Questa nota non modifica la baseline approvata: formato, persistenza fra pagine e gate crittografici restano invariati e non certificati. Nessuna distribuzione implicita.

Ogni Markdown sarà classificato senza modificarlo automaticamente:

| Esito | Significato |
|---|---|
| Uguale | La decisione coincide con questa baseline |
| Compatibile | Non contraddice la baseline, ma descrive solo una parte |
| Compatibile ma incompleto | Mancano vincoli, stato o gate necessari |
| In conflitto | Prescrive un comportamento incompatibile |
| Da sostituire | Duplica o mantiene come attuale un modello superato |
| Storico | Utile come traccia, ma non deve guidare nuove modifiche |
| Da verificare | L'affermazione richiede controllo nel codice o nell'ambiente reale |

Il rapporto di confronto deve riportare per ogni file: scopo, versione/stato, punti coincidenti, divergenze, rischi, modifica proposta e priorità. Soltanto dopo approvazione si aggiorneranno i documenti interessati.

<a id="fonte-docs-architettura-sicurezza-v1-md-19-decisioni-non-ancora-chiuse"></a>

### 19. Decisioni non ancora chiuse

La baseline stabilisce la direzione, ma richiede decisioni separate e documentate su:

- parametri definitivi della KDF;
- modalità WebAuthn/passkey e fallback;
- strategia di recupero zero-knowledge;
- formati allegato ammessi al rilascio;
- retention di cestino, audit e backup;
- metadati delle scadenze da cifrare;
- politica di ricerca su dati cifrati;
- cutover dal formato legacy al record-key;
- politica esatta per widget singoli e widget comuni;
- matrice dei dispositivi/browser supportati.

Questi punti non autorizzano soluzioni temporanee silenziose.

<a id="fonte-docs-architettura-sicurezza-v1-md-20-formula-decisionale-finale"></a>

### 20. Formula decisionale finale

Quando si progetta una funzione nuova, l'ordine obbligatorio è:

1. classificare dati e minacce;
2. minimizzare;
3. stabilire cosa viene cifrato sul dispositivo;
4. stabilire chi possiede e recupera le chiavi;
5. scegliere Firestore diretto o Function tramite la matrice;
6. definire offline, conflitto e rollback;
7. scrivere test e gate;
8. ottenere approvazione;
9. implementare;
10. collaudare prima del deploy.

La convenienza del codice esistente non può prevalere sulla protezione dei dati, ma la sicurezza non giustifica una riscrittura non misurata e non reversibile.

Verifica locale 12/09/2026, base `ff006c71`: il laboratorio invalida anche le dipendenze dei tentativi di sblocco annullati e gestisce gli errori di smontaggio. Nessuna modifica della baseline o attivazione produttiva; [audit §15](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-15-annullamento-e-robustezza-del-laboratorio--12092026).

Preparazione locale 12/09/2026, base `0a807adb`: montaggio/smontaggio degli orchestratori delle liste con invalidazione dei consumatori e rimozione dei dati visibili. Nessuna modifica della baseline, delle chiavi o dei dati persistiti; integrazione con blocco/Auth ancora da completare. [Audit §17](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-17-primo-adattamento-degli-orchestratori-reali--12092026).

Integrazione sperimentale 12/09/2026, base `d906fd50`: coordinatore identità/Vault/viste con lettori legati a UID e revisione del contesto. Logout invalida prima dell’uscita remota; la prova browser mantiene un’identità simulata. Nessuna modifica della baseline o attivazione produttiva. [Audit §19](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-19-coordinamento-identità-vault-e-viste--12092026).

Prova emulata 12/09/2026, base `0e07621d`: SDK Auth/Firestore, coordinatore e lettore v2 integrati su fixture. Le Rules originali respingono altri UID e utenti anonimi, ma consentono record non conformi sotto il proprio UID: finding di validazione ancora aperto. Nessuna modifica della baseline o delle Rules. [Audit §20](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).

Candidato locale 12/09/2026: il segnale senza payload `vault-session-locked`, emesso dopo la cancellazione della chiave da `softLock`, `clearSession` e `resetVault`, dismette i widget Account e i loro dialoghi anche a UID invariato. Test locali verificano pulizia dei valori, rimozione dei listener e blocco di copia/salvataggio tardivi. È un segnale di invalidazione della UI, non un'attestazione di sicurezza né un annullamento di richieste già inviate. Baseline, chiavi e formati invariati; nessun deploy incluso.
