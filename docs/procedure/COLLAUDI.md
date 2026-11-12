# Collaudi

<a id="cornice-c1-auth-codici-2026-11-12"></a>

## C1 — diagnostica Auth dopo il primo giro bloccato, 12/11/2026

Il [primo giro reale](../evidenze/COLLAUDI.md#cornice-c1-primo-giro-2026-11-12) non ha superato SETUP; canary OFF confermato da Diego. La nuova PR sostituisce il generico C1_AUTH_BLOCKED con sei codici chiusi, senza ampliare lo schema del rapporto o modificare login, attese, protezioni e browser. Nessun nuovo giro prima della revisione Claude e di un nuovo ordine personale.

| Segnale osservato | Sottocodice fisso |
|---|---|
| HTTP 401/403, host esatto firebaseappcheck.googleapis.com oppure content-firebaseappcheck.googleapis.com | C1_AUTH_HTTP_APPCHECK |
| HTTP 401/403, host esatto identitytoolkit.googleapis.com oppure securetoken.googleapis.com | C1_AUTH_HTTP_IDENTITY |
| HTTP 401/403, host esatto firestore.googleapis.com | C1_AUTH_HTTP_FIRESTORE |
| HTTP 401/403, qualsiasi altro host o URL non analizzabile | C1_AUTH_HTTP_OTHER |
| Pannello di verifica email visibile, oppure email non verificata nel bootstrap dopo il confronto privato QA2 | C1_AUTH_EMAIL_UNVERIFIED |
| Utente/bootstrap non pronto al controllo richiesto o autenticazione non confermata entro il limite esistente | C1_AUTH_NOT_READY |

I servizi canonici sono documentati da [Firebase](https://firebase.google.com/docs/projects/api-keys); l'alias content-firebaseappcheck è presente nel bundle Firebase distribuito dall'app. Nessun suffisso, substring, path o query decide la categoria. L'URL serve transitoriamente a leggere hostname, poi resta solo il codice; nessun host arbitrario, URL, header, body, testo del provider o identificativo entra in log, DIAG o rapporto. Un codice HTTP identifica il servizio osservato, **non la causa del diniego** e non prova un punteggio reCAPTCHA. Email/utente non pronto non dimostrano credenziali errate. Il vecchio rapporto C1 #1 conserva il codice storico: nessuna riclassificazione retroattiva.

Tutti i sottocodici sono BLOCKED, emettono OFF_REQUIRED e mantengono l'arresto senza retry. Il primo errore resta prevalente; un errore runtime successivo non lo sostituisce. MFA, identità/progetto/claim errati e bootstrap non verificabile conservano i propri codici e guardie. DIAG assente resta null, non un rapporto vuoto inventato. Nessun dato aggiuntivo né prova positiva deriva dal verde dei test locali.

<a id="cornice-c1-self-hosted-valutazione-2026-11-12"></a>

### Opzione A — self-hosted sul PC con Chrome visibile, solo valutata

**Fattibile tecnicamente, non attivata e non dimostrata come soluzione al blocco.** Chrome visibile sulla connessione di Diego consentirebbe l'osservazione del giro. Il diverso ambiente potrebbe cambiare il comportamento del provider, ma il primo rapporto non ne identifica la causa. Il runner attuale resta headless:true: una futura modalità esplicita headless:false e il relativo targeting del job richiedono progetto/revisione separati. Playwright supporta [Chrome e modalità visibile](https://playwright.dev/docs/browsers); [headless](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-headless) non implica riuso di profili. Context nuovo obbligatorio, nessun collegamento al Chrome già aperto o al profilo personale. Policy aziendali possono interferire.

Per vedere la finestra servirebbe avviare il runner nella sessione Windows interattiva con Diego presente, senza servizio: i [servizi Windows sono isolati dal desktop utente](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services). Non è consigliato registrare la sessione di lavoro del PC personale come runner del repository pubblico: GitHub segnala il rischio di compromissione e persistenza nei [self-hosted](https://docs.github.com/en/actions/reference/security/secure-use). Environment, branch gate nel nostro YAML e label non isolano il computer né impediscono da soli ad altri workflow di raggiungerlo. Il filtro delle variabili del browser non protegge i file accessibili a Node e agli altri step.

Variante da valutare: **VM Windows dedicata e temporanea sul PC**, visibile in una finestra, utente standard, senza OneDrive, cartelle/clipboard condivise, profili personali, credenziali Git/gh, ADC/gcloud, chiavi cloud o accesso alla rete aziendale. Isolare l'intero ambiente, non soltanto il context browser. Occorre anche verificare un vincolo effettivo al solo workflow revisionato: le restrizioni dei [runner group](https://docs.github.com/en/enterprise-cloud%40latest/actions/how-tos/manage-runners/self-hosted-runners/manage-access) dipendono dalle funzionalità dell'account/piano, qui non verificate. Senza tale vincolo, l'opzione resta sospesa; un harness privato separato richiederebbe una distinta decisione di Diego.

Lifecycle proposto, non eseguito: runner per un solo job e una sola finestra concordata, poi rimozione e distruzione/ripristino della VM pulita. La [registrazione effimera](https://docs.github.com/en/actions/reference/runners/self-hosted-runners) si annulla dopo un job ma non ripulisce il sistema; fermare il processo lascia invece il runner registrato offline. La [rimozione GitHub](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/remove-runners) revoca l'associazione. Nessuna registrazione, installazione, credenziale o modifica di protezioni in questa PR.

Restano QA2 soltanto sintetica, segreti nell'environment, SHA esatto, dispatch manuale, approvazione personale, OFF alla prima anomalia e a fine giro, nessun retry e nuovo ordine per ogni esecuzione. Nessun debug token App Check, bypass Auth/Rules, esportazione sessioni, trace, video, HAR o screenshot automatici. Una futura estensione del rapporto dovrebbe distinguere hosted/self-hosted con soli valori fissi, senza nome del PC. Chrome visibile non certifica Safari iPhone, PWA, camera, push o dispositivi reali. **Gate: scelta di Diego, progetto tecnico e revisione Claude prima di attivare A; poi ordine personale per il giro.**

<a id="cornice-c1-e2e-piano-2026-11-12"></a>

## C1 — adapter integrato e PR dedicata al workflow manuale, 12/11/2026

**Stato: primo giro SETUP BLOCKED, nuova PR soltanto diagnostica.** #292 e #293 sono unite dopo GO e ordini di Diego; master del runner `cd05b44e26792a70fe7f37e43be5172dfc75f81d`. La [ricevuta C1 #1](../evidenze/COLLAUDI.md#cornice-c1-primo-giro-2026-11-12) distingue tentativo reale ed esiti non eseguiti. La PR corrente aggiunge i sottocodici descritti sopra e valuta A, senza nuovo dispatch: prima revisione Claude e nuovo ordine personale di Diego. Produzione osservata 1.2.270 da `cb48b7196a3816a62dda05d11e11ff4ca7c51d26`; canary **OFF secondo Diego**, senza rilettura amministrativa; scadenza 18/11/2026 alle 23:59 italiane invariata.

### Adapter integrato e nuova PR workflow

Piano completo e adapter integrato; il primo tentativo produttivo si è fermato prima dei casi, come documentato sopra. Avvio Auth normale, confronto privato QA2/progetto/claim prima di ogni Master prevista, singolo invio solo nel dialogo semanticamente Sblocco Vault, contatore DOM di nuove finestre senza leggerne i valori; nessuna riapertura automatica per mascherare regressioni. Priorità concordata con Claude: D02, D04, D05-A, D06 a 1/3 minuti e D08 locale. Lo schema DIAG è chiuso e il rapporto viene raccolto tramite getter delimitato, non tramite clipboard; codice/segmento del caso controllati anche semanticamente per errori, dinieghi e blocchi inattesi.

`npm run qa:c1:e2e -- --help` e `--list` sono inerti. Nessun argomento significa arresto; `--production` richiede contesto GitHub manuale/master/SHA esatto, operatore approvato, ordine personale, attestazioni private e quattro segreti QA2; senza questi si ferma prima di leggere credenziali, importare Playwright o fare rete. Non accetta URL, UID, profili persistenti, credenziali o accelerazioni temporali come argomenti. Il manifest pubblico deve coincidere con versione/SHA di rilascio prima del login. Gli errori sono solo codici fissi, mai stack o messaggi originali.

Il [workflow](../../.github/workflows/c1-qa2-e2e.yml) è disponibile su master dopo il merge autorizzato della #293, esclusivamente tramite workflow_dispatch: nessun trigger push, PR, schedule o altro avvio automatico. Un solo giro autorizzato eseguito, fermo al setup; nessun retry. Environment, reviewer, variabile e quattro nomi di segreti sono stati osservati nella UI; i valori non sono stati letti da Codex. [Ricevuta e limiti della configurazione](../evidenze/COLLAUDI.md#cornice-c1-workflow-config-2026-11-12). I tre profili restano dispatch esclusivi; provider reali, MFA/App Check e WebKit/macOS non sono certificati dal banco locale. La PR diagnostica cambia solo codici/adapter/test/documenti: Frontend/cornice, workflow, headless, versione, Rules, Functions, header, manifest pubblico e precache invariati.

`npm run test:c1-e2e-local` esegue guardie, oracoli e fixture browser su 127.0.0.1, con ogni richiesta esterna bloccata; il medesimo core dell'adapter è usato tramite un wrapper esclusivamente loopback e timeout UI ridotto. Auth, UI, DIAG e dati sono inventati; owner/broker/transport sono reali. L'intera suite entra ora in `test:qa-automation`, quindi in pretest/npm test e nella validate esistente. [Esiti locali e limiti](../evidenze/COLLAUDI.md#cornice-c1-e2e-locale-2026-11-12). I timer 1/3 sono provati localmente come algoritmo con clock sintetico e come selezione/ACK UI; le attese reali e i provider non sono ancora eseguiti. Nessun nuovo PASS C1.

### Limite D02 e prerequisiti del primo giro

La ricognizione statica trova **nove percorsi UI canonici**. Il mapping di Configurazione documenti esiste in `deadline-domain-model.js`, ma `deadline-rules-hub.js` genera il link a `configurazione_automezzi.html?source=…`; non è stato trovato un ingresso UI effettivo a `configurazione_documenti.html`. L'adapter usa solo un vero link canonico se presente nella UI: altrimenti marca quel sottocaso NE e D02 **LIMITE**, senza goto, facade, link iniettati o PASS simulato. Il limite va accettato esplicitamente nell'ordine di esecuzione o risolto/rivisto prima del giro completo; nessuna correzione della pagina in questo incarico.

Prima della run Diego verifica privatamente: QA2 corretta/attiva/email verificata, solo dati inventati, fixture Profilo/Account e configurazioni già esistenti, assenza di onboarding/avvisi di riconciliazione/inviti inattesi, lingua italiana e timeout iniziale 3 minuti. **2FA attesa OFF soltanto se verificata privatamente da Diego**; qui non è stata riletta. Se TOTP è richiesto il runner dà BLOCKED, non usa recupero, non chiede/crea un segreto TOTP e non disattiva MFA. Se tale precondizione non è accettabile, la soluzione spetta a Diego prima dell'esecuzione. [Regola QA2 e segreti](../regole/SICUREZZA.md#cornice-c1-qa2-segreti-2026-11-12).

### Evidenze e ambienti proposti

La [matrice canonica D01–D19, due fasi e quattro ambienti fisici](../evidenze/COLLAUDI.md#cornice-b2-lista-2026-11-09) conserva i propri esiti. Nessuna conversione automatica di emulazione in PASS fisico. La fase personale resta interamente separata e non entra nei runner.

Il futuro rapporto AUTO propone tre colonne distinte, eseguite in serie: Chrome reale desktop su runner Windows; Chromium con viewport/touch Android; WebKit con descriptor iPhone su runner macOS. Registrare versione del motore e OS effettivi. Il secondo e il terzo sono **emulazioni**, il terzo non è Safari su iPhone; non provano installazione PWA, hardware, sistema operativo, memoria sospesa o safe area fisica. [Playwright: emulazione](https://playwright.dev/docs/emulation), [motori e canali](https://playwright.dev/docs/browsers).

Le righe sotto descrivono la **copertura proposta finale** e il codice preparato; nessuna run reale è stata eseguita. A = automatizzabile; P = parziale; M = manuale; NE = prerequisito reale mancante. Nessuna riga significa PASS. Il primo gruppo è SETUP tecnico, D02, D04-core, D05-A, D06-1/D06-3 e D08-local: i sottocasi non chiudono automaticamente i D complessivi.

| Caso | Copertura proposta | Codice presente e controlli che restano |
|---|---|---|
| D01 avvio | P: login QA2 reale, Auth/App Check, identità e ammissione, uno sblocco iniziale | Primo giro SETUP BLOCKED, causa non determinata e DIAG assente; nessun PASS D01. MFA/email non verificata restano BLOCKED prima della Master. |
| D02 dieci pagine | A: dieci destinazioni canoniche via UI, padre app.html, dati pronti e nessuna nuova Master | Nove percorsi UI preparati; Configurazione documenti NE se manca il link reale, D02 LIMITE. Account richiede card di fixture; mancanza/caricamento/errore non diventano PASS. |
| D03 sezioni/parità | P: tab/query/anchor, copia di solo valore sintetico, annullamento editor e confronto standalone | Non implementato. Visibilità e confronto fisico restano necessari; nessun salvataggio o automatismo verso fixture mancanti. Appunti Safari/PWA manuali. |
| D04 cronologia | A per percorsi fissati, Back/Forward browser e freccia app, query/anchor, nessun doppio salto o ripristino sensibile | Preparati i sette comandi Home/Profilo/Home/Privato/Account/Back/Forward/freccia interna, query categoria e conteggio finestre. Anchor e ripristino form sensibili restano fuori dal nucleo. |
| D05 ricarica/link/scheda | P: reload padre, stessa destinazione e una sola nuova Master; nuova scheda con sblocco proprio; Back dopo logout | D05-A preparato, dialogo padre semanticamente validato e un solo invio. Ricarica figlio, link diretto e nuova scheda non implementati; Back dopo logout solo nel nucleo D08 locale. |
| D06 inattività | A: 1/3 minuti reali, attività trusted che rinnova e navigazione passiva che non rinnova | Preparato algoritmo con attese reali non scalabili: tasto Shift innocuo, poi Back browser senza clic nel figlio, blocco/LOCK_EXPIRED e un nuovo sblocco. ACK di scrittura tramite nuovo toast successivo ad updateDoc/sync, non solo selector o snapshot ottimistico. Verificato in locale con clock sintetico/fixture; nessuna attesa reale produttiva eseguita. |
| D07 background | P: cambio scheda breve/lungo, controllo al ritorno | Non implementato. Freeze, discard OS e BFCache Safari/PWA reali restano manuali; non confondere una revoca lecita con continuità provata. |
| D08 logout/fence | A/P: logout UI locale e altra scheda, Back chiuso, nuovo accesso/sblocco | D08-local preparato: Home/logout/conferma, login top-level, cancellazione DIAG e Back chiuso; nessuna revoca globale. Altra scheda/nuova epoca e nuovo accesso restano da implementare; nessuna misura RAM. |
| D09 biometria | M: PRF reale, annullamento/errore, conferma fresca e fallback | Non implementato. Un virtual authenticator nel banco non certifica il dispositivo. |
| D10 camera/voce | M/P: apertura/annullamento UI automatizzabile; stream, consenso, dettatura e picker reali manuali | Non implementato. Nessun fake stream in produzione o autorizzazione camera/microfono automatica. |
| D11 notifiche | M/P: stato worker e codici DIAG come preparazione; invio/clic OS, ACK/fallback, app bloccata/assente e riuso PWA manuali | Non implementato. pushReady=true non è consegna riuscita; nessuna generazione di push o marcatura notifiche lette implicita. |
| D12 allegati/export/stampa | P: piccola fixture sintetica preesistente, preview esterna e ritorno; nuova conferma e annullamento | Non implementato. Picker/stampa e gesto nativo manuali; nessun export/scaricamento di dati reali o apertura dettaglio non concordata. |
| D13 azioni sensibili | P: conferma fresca e annullamento PRIMA della scrittura | Non implementato. Mai cambiare Master, condividere, cancellare o salvare per dimostrare il gate. Le azioni distruttive restano escluse. |
| D14 uscite | P: privacy/termini/login top-level dopo revoca, web esterno senza opener | Non implementato. Telefonata, mailto e ritorno da app/picker nativi manuali; nessun invio di messaggi. |
| D15 rete/policy | M: Diego spegne, osservazione revoca live; eventuale sottocaso rete con ordine proprio | Nessuna automazione cloud. Registrare T0/T1, osservato/non osservato e rapporto DIAG; nessun flag client, cambio claim, riaccensione o pretesa di misura RAM. |
| D16 confini | P: test avversariali locali e verifiche limitate di identità/origine/report | Guardie, schema e oracoli locali presenti; nessun attacco produttivo, secondo account, dump storage/chiavi o lettura Vault per prove negative. |
| D17 safe area | M: Safari iPhone e PWA reali verticale/orizzontale, scroll e tocchi ultimi comandi | Non implementato. Emulazione separata solo per viewport/orientamento; notch/home bar reali non certificati. |
| D18 version skew | NE fino a due rilasci reali approvati con cornice vecchia ancora aperta | Non implementato. Nessun deploy, cache alterata o versione contraffatta per produrre PASS. |
| D19 DIAG | P: default OFF, opt-in UI, schema/codici chiusi, copia, Cancella, OFF e logout | Adapter verifica default OFF, attiva una volta da UI, raccoglie getter con idle/push effettivi e verifica cancellazione al logout. Non prova clipboard, Cancella/OFF UI o cambio account; Safari/PWA manuali. Nessuna riattivazione implicita. |

### Adapter integrato, configurazione GitHub e gate futuri

1. **Target unico.** Solo QA2 già approvata; nessun provisioning, reset, rotazione, account personale o fallback verso altro account. Segreti separati dell'environment protetto: `C1_QA2_EMAIL`, `C1_QA2_PASSWORD`, `C1_QA2_MASTER_PASSWORD`, `C1_QA2_EXPECTED_UID`. Diego li ha inseriti privatamente: verificata solo la presenza dei quattro nomi, non i contenuti. UID e credenziali mai in input pubblico, comando, PR, log o rapporto. Email esatta QA2 e dominio riservato, UID atteso, email verificata, progetto e claim cornice confrontati privatamente prima dell'inserimento della Master; restituzione di soli boolean/codici. Login rifiutato/account disabilitato o non verificabile = arresto, non riparazione. Il claim non sostituisce l'ammissione effettiva del server.
2. **Contesto nuovo.** Browser effimero per ogni profilo; mai profili personali o persistent context. Nessuna esportazione `storageState`, cookie, token, dump, HTML o HAR. Niente registrazioni video, screenshot automatici, trace o error reporter grezzo; potrebbero includere valori Vault o credenziali. Auth state e trace hanno contenuto sensibile: [autenticazione Playwright](https://playwright.dev/docs/auth), [trace](https://playwright.dev/docs/trace-viewer).
3. **Avvio soltanto manuale.** Proposta workflow dedicata workflow_dispatch, separata da firebase-deploy, senza push/PR/schedule. Solo master e SHA del runner revisionato; versione/SHA Hosting distinti, controllati sul manifest prima del login. Un profilo per dispatch, un context effimero, nessuna matrice automatica, retry orchestrati o dispatch del profilo successivo. Gruppo esclusivo cancel-in-progress:false; non accodare altri giri: al primo FAIL sospendere e richiedere nuovo esame/ordine. Permissions contents:read, Actions fissate a SHA, nessun OIDC/id-token, ADC, SA, chiave cloud o token amministrativo.
4. **Gate segreti e revisione.** Environment dedicato con Diego reviewer prima che i segreti arrivino al job. Configurazione UI osservata: Required reviewers attivo con Diego, bypass amministratori disattivato, Prevent self-review non selezionato per consentire il suo avvio e clic personale; solo branch master e nessun tag. La variabile C1_ALLOWED_OPERATOR coincide con il suo login GitHub. Non rimuovere questi gate per provare il codice; GO Claude sullo SHA e approvazione personale dell'esecuzione sono distinti. [Environment GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [uso sicuro di Actions](https://docs.github.com/en/actions/reference/security/secure-use).
5. **Nessun aggiramento.** Auth/2FA/App Check ordinari; niente debug token, auth emulator, SDK Admin, stubbing, route fulfillment o risposte finte nel giro reale. Errore Auth/App Check, origine/versione inattesa, nuovo dialogo non previsto o errore tecnico = arresto con codice fisso. Nessun retry automatico o login di recupero. Negli itinerari D02/D04 una Master inattesa è FAIL: non inserire nuovamente la Master per proseguire. D01 e D05 distinguono esplicitamente lo sblocco atteso.
6. **Nessuna mutazione di dati esplicita.** Niente crea/salva/archivia/elimina/condividi, semina fixture o riconciliazione. Fixture assente = NE/BLOCKED, non creazione. Preferenze di test, logout e altri effetti ammessi devono essere elencati nel futuro ordine. Casi non implementati = NE, mai PASS sintetico.

### Effetti automatici: un giro reale non è di sola lettura

L'app può scrivere anche con soli login e navigazioni. La revisione statica ha individuato: aggiornamento policy password/profilo Auth in `auth.js`; fence locale; creazione/migrazione verifier/envelope allo sblocco in `security-manager.js`; avvio identità di condivisione e coordinatore offline da `main-v129.js`; eventuale flush di una coda; default delle Configurazioni; incremento views in dettagli Account; recupero registrazioni Push e lettura di notifiche tramite conferma UI. Il futuro adapter deve censire e sottoporre questi effetti a Diego prima dell'esecuzione. Un context nuovo evita vecchie code locali, non garantisce assenza di scritture remote.

Non riutilizzare direttamente i runner QA precedenti: alcuni chiamano lo sblocco a ogni pagina o trasformano 403 App Check in avvisi. Ciò maschererebbe regressioni e violerebbe il nuovo criterio. Nessun loader DPAPI locale è usato nel prototipo o proposto per GitHub Actions. Un runner che non riesce ad accedere per MFA/App Check deve riferire BLOCKED, senza degradare le protezioni.

### Rapporti, stop e completamento

Il rapporto candidato ricostruisce uno schema chiuso: caso da elenco, profilo AUTO, OS/versione motore, versione/SHA pubblici, esito PASS/FAIL/BLOCKED/NE/LIMITE, codici fissi e DIAG validata. Eventi solo code/at/version/page/environment, massimo 200 e 7 giorni; nessun UID, email, record ID, URL/query/hash, valori, claim estranei, token, chiavi o stack/errori liberi. Si rifiutano campi/codici estranei; gli oracoli verificano anche errori, reingressi e blocchi inattesi del segmento. Ring pieno = limite, non PASS ricostruito. Getter effettivo, nessuna clipboard simulata; niente screenshot/trace/HAR/storageState. Solo JSON sanificato, retention proposta 7 giorni, caricabile solo se creato dalla run corrente: un errore wx non abilita l'upload del file precedente.

La copia dal pulsante reale è prova degli appunti solo se il browser li legge davvero. Un getter DIAG delimitato, che legga versione/idle/push effettivi senza storage o materiale Vault, può essere proposto per raccogliere evidenza quando gli appunti non sono disponibili, ma va etichettato come getter e non certifica “Copia rapporto”. Non sostituire la clipboard in produzione. Copiare prima del logout; dopo, verificare la cancellazione senza esportare storage o riattivare il registro.

Alla prima anomalia: emissione immediata di OFF_REQUIRED con codice fisso; **Diego cambia personalmente enabled=false come prima azione operativa**. Stop dei passi e profili successivi, nessun retry; singleton/claim mai toccati dal codice. Getter sanificato sul solo figlio già presente, limitato complessivamente a 2,5 secondi, senza navigare/sbloccare o inventare un rapporto vuoto quando il contesto è perso; poi chiusura dei context. Letture DOM passive durante i timer non rinnovano l'inattività. OFF richiesto anche a fine successo. Diego deve essere presente; timeout/cancellazione CI non garantiscono OFF. Se timeoutRestoreRequired è true, Diego verifica e ripristina manualmente i 3 minuti dopo OFF: la responsabilità e questo percorso vanno confermati nel futuro ordine di esecuzione, senza tentativi automatici dopo errore. Nessuna notifica esterna automatica introdotta.

### Residuo fisico e sequenza di approvazione

Configurazione GitHub già eseguita da Diego e [osservata nella UI](../evidenze/COLLAUDI.md#cornice-c1-workflow-config-2026-11-12): environment c1-qa2-production, reviewer personale, solo master, bypass disattivato, variabile C1_ALLOWED_OPERATOR e quattro nomi di segreti presenti nell'environment. Nessun contenuto letto, nessuna prova di login riuscito dal primo giro; nessuna chiave JSON o ADC. L'incarico corrente prepara soltanto la PR diagnostica con test e valutazione A, senza autorizzare un secondo giro.

Il dispatch futuro richiede SHA del runner esatto, versione/SHA Hosting attesi, un profilo, link al commento con ordine personale e tre attestazioni false di default: preflight privato completato (QA2 fittizia, email verificata, MFA OFF, fixture/italiano/timeout), effetti accettati e limite D02 accettato se presente. Non verificano da sole la verità dell'ordine: valgono insieme alle protezioni dell'environment e all'approvazione personale. Nessun accesso ai segreti o al cloud per tentare il codice durante la revisione.

Il GO Claude sul codice 45f50a9e della #292 è valido con CI verde e il relativo merge è concluso. La nuova posizione del workflow e il suo test richiedono **nuovo GO sullo SHA della PR dedicata e CI verde**; l'approvazione precedente non si trasferisce. Dopo eventuale ordine di merge, registrare lo SHA finale di master e fermarsi ancora prima del dispatch. Prima run reale solo con nuovo ordine di Diego riferito a profilo ed effetti, sua presenza e sua accensione; prima Chrome desktop, altri profili con i propri gate e nessuna anomalia precedente. OFF finale personale.

Passaggio breve approvato da Diego per ciascun dispositivo reale: ingresso/sblocco, Home → Privato → Account e Profilo/tab, tre comandi di cronologia, reload con nuovo sblocco, inattività e ritorno da background, raggiungibilità degli ultimi comandi in verticale/orizzontale, DIAG copia e pulizia. Aggiungere le prove reali applicabili PRF, camera/voce/picker, Push con app aperta/bloccata/assente, preview/stampa/tel/mailto e ritorno PWA. Safari iPhone e PWA iPhone hanno ricevute indipendenti; Android browser reale e Chrome desktop restano colonne proprie. D15 rimane guidato con spegnimento di Diego; D18 resta NE fino al secondo rilascio. I limiti di capability restano LIMITE/NE motivati.

**Metodo combinato approvato da Diego: AUTO + giro breve sui dispositivi reali**, [decisione del 12/11](../progetto/DECISIONI.md#cornice-c1-auto-giro-breve-2026-11-12). Non serve ripetere integralmente a mano i medesimi controlli validamente coperti dall'automazione; la matrice 19 × 4 per fase rimane l'indice di copertura, con fonti e limiti per ambiente. Nessun caso mancante, FAIL o NE è chiuso dal solo giro breve; emulazioni e sottocasi conservano il proprio perimetro. Claude rivede copertura/guardie/residuo ed esiti, Diego autorizza separatamente le operazioni. Fase personale fuori dai runner, C2, grafica e sicurezza non sono sbloccate da questa scelta.

## Canary cornice — gate amministrativi aggiornati, 10/11/2026

Prima di ogni prova cloud del runner: nuovo GO Claude #285, approvazione personale del passo, credenziale impersonata dedicata verificata senza stamparla, destinatario privato confermato e singleton OFF concordante. Il grant richiede anche Timestamp futuro approvato; il documento parziale attuale non basta. Per il cambio fase/C2: OFF → revoca verificata → rimozione del solo claim con binding invariato e rilettura → eventuale cambio destinatario → infine revoca IAM/ADC. Nessuna prova di produzione o PASS fisico derivati dai mock. Nessun UID nel rapporto, neppure dry-run. [Istruzioni amministrative](../regole/RILASCIO.md#cornice-adc-impersonata-2026-11-10), [due matrici C1](../evidenze/COLLAUDI.md#cornice-b2-lista-2026-11-09), entrambe NE; per ogni FAIL rapporto DIAG copiato privo di identificativi.

## Procedura pre-finale con utente tecnico sintetico

### Preparazione sicura

- usare soltanto l'utente marcato `codexQa` e `synthetic`, con profilo browser isolato;
- verificare UID e marcatori prima di ogni scrittura; interrompere se il target non coincide;
- per i runner che operano su una società, richiedere un `CODEX_QA_COMPANY_ID` esplicito, sintatticamente valido e appartenente all'identità QA corrente; interrompere se manca o non coincide e non usare mai fallback verso società di un'altra identità;
- non ruotare la chiave della Vault tecnica durante provisioning o riconciliazione ordinari;
- se l'identità tecnica esiste ma il contenitore DPAPI manca, interrompere con `QA_CREDENTIALS_MISSING_EXISTING_VAULT`: non creare nuove credenziali, non sostituire verifier/envelope e non usare `--rotate` come recupero;
- per riprendere, ripristinare il file DPAPI originale nello stesso profilo Windows oppure creare un nuovo utente QA separato con una nuova Vault; la sola generazione di una nuova Master Password non recupera i dati precedenti. Il recupero con file schema 3 e Recovery Key appartiene al protocollo dedicato, ancora disabilitato, e richiede i relativi gate;
- assegnare alle fixture un prefisso o identificatore stabile di collaudo, così una seconda esecuzione aggiorna i propri record senza moltiplicarli;
- usare domini riservati come `example.invalid`, numeri e codici chiaramente fittizi e allegati sintetici di piccole dimensioni;
- non creare recapiti realmente raggiungibili, documenti formalmente validi, token Push, segreti MFA o credenziali riutilizzabili.
- usare la modalità estesa isolata soltanto dopo che il lotto base ha identificato in modo univoco la fixture prerequisita; ogni `401/403` App Check o Callable deve essere registrato come **blocco ambientale**, non trasformato in esito superato e non usato per dichiarare riuscita una condivisione.

### Percorso obbligatorio per ogni pagina

1. aprire la pagina dalla navigazione reale, non soltanto tramite URL diretto;
2. verificare titolo, header/footer, comandi, testo, stato vuoto e focus iniziale;
3. compilare tutti i campi pertinenti con fixture sintetiche, incluse varianti facoltative e riferimenti collegabili;
4. salvare e rileggere dal dettaglio o dalla lista, quindi ricaricare la pagina per escludere risultati presenti soltanto in memoria;
5. modificare almeno un valore, svuotare quando consentito un valore facoltativo e verificarne la persistenza;
6. provare ricerca e collegamenti verso Account, Memorandum, Aziende, Documenti e Scadenze, inclusi i record condivisi autorizzati;
7. provare archiviazione/ripristino e, quando previsto e sicuro, eliminazione con relativa conferma;
8. controllare layout desktop e viewport telefono, scorrimento, overflow, contrasto, focus, tastiera e chiusura dei popup;
9. acquisire Console e richieste di rete senza registrare valori sensibili;
10. uscire dalla pagina, rientrare e annotare esito, difetto, riproduzione ed eventuale cleanup.

### Copertura dati minima

Il percorso deve comprendere Profilo e prima configurazione; Anagrafica, Contatti, Indirizzi, Utenze, Documenti e Tessera digitale; Aziende, sedi e dati aziendali; Account privati, aziendali e bancari; Memorandum, Memorandum condivisi e Widget; Scadenze, regole, destinatari, Email/Push soltanto in modalità non recapitabile; allegati sintetici; archivi, Impostazioni, Ricerca e flussi di collegamento. I campi dipendenti da hardware, provider o identità reale vengono verificati strutturalmente e registrati come gate fisico, non simulati come prova riuscita.

Per i Widget creare almeno un modello bancario legato a un conto e un modello generico riutilizzato in due Account. Verificare valori cifrati, mostra/nascondi, modifica, eliminazione della sola istanza e rimozione del modello quando non più usato. Cambiare lingua e confermare che nomi, etichette e valori creati dall'utente restino invariati mentre i comandi dell'app si traducano. Per le Credenziali comuni collegare una fixture a due Account, aggiornarla, scollegarne uno, archiviare l'altro e verificare cifratura, mascheramento, copia e assenza dalla Ricerca e dai log.

### Condivisione

Mittente e destinatario sono due evidenze distinte. Annotare richiesta, accettazione, visibilità, permessi, revoca e stato successivo per Account condiviso e Memorandum condiviso. Se l'altro account viene controllato da Diego, attendere la sua conferma esplicita e riportarla come evidenza umana separata; la sola creazione dell'invito non certifica la ricezione.

Usare allegati sintetici piccoli nel Memorandum condiviso e verificare separatamente elenco, apertura, permesso, revoca e cleanup. Non inviare segreti o dati reali all'account destinatario.

### Lingue

La prima esecuzione completa avviene in italiano. Dopo la stabilizzazione funzionale, ripetere in ogni lingua supportata tutte le pagine e i componenti visibili: titoli, etichette, placeholder, menu, popup, conferme, errori, ARIA, guida/Ricerca e date. Verificare il cambio lingua sia durante la sessione sia dopo ricarica e nuovo login. I contenuti creati dall'utente devono restare invariati. Una chiave esistente nel dizionario non dimostra da sola che il testo sia corretto o visibile nella pagina.

Esportare anche l'Archivio portabile in ciascuna lingua campione e controllare visualizzatore offline, selettore lingua, `LEGGIMI`, compatibilità allegati, avvisi e intestazioni CSV/ODS/XLSX. Il JSON deve conservare le stesse chiavi canoniche in ogni lingua. Per il Backup cifrato confrontare hash/struttura e ripristino: la lingua modifica soltanto l'interfaccia, mai il contenitore tecnico.

### Registrazione dell'esito

Per ogni caso conservare versione, commit, browser, sistema, viewport, lingua, pagina, fixture, passi, risultato atteso, risultato osservato, Console/rete, screenshot redatto e stato del cleanup. Usare **superato**, **fallito**, **bloccato** o **non eseguito**; non trasformare un blocco o un controllo automatico in prova visiva superata.

## Consultazione completa dell'Archivio portatile

Oltre al gate `npm run test:portable-archive-prerelease`, verificare con fixture sintetiche: ordine fra dati principali e **Informazioni tecniche**; negli ambiti Account separazione fra il campo operativo `account` e i soli classificatori `type`/`tipo` di primo livello, senza spostare il tipo di un campo Widget annidato; omissione visuale dei valori tecnici predefiniti `false` e `0` senza perdita nel JSON o nelle tabelle; timestamp leggibili; persistenza dei campi sconosciuti; anteprima di immagine, video, audio, PDF e testo; messaggi e azioni per codec, browser, quota/memoria, PDF e integrità; revoca Object URL e pulizia OPFS alla chiusura e alla riapertura. Non usare allegati o dati reali.

Verificare che nessuna copia in chiaro sia creata prima della conferma, che **Salva tutti** richieda una cartella scelta dall'utente e che ogni esportazione mostri l'avviso di sicurezza. Controllare in CSV, ODS e XLSX che dati principali e campi non tecnici precedano tutti gli identificativi e metadati tecnici, senza perdere campi futuri. Aprire l'XLSX prodotto con un lettore indipendente: fogli distinti, intestazioni e filtri presenti, colonne dimensionate, date leggibili e codici con zeri iniziali conservati come testo. Un browser headless che annulla ogni download Blob va diagnosticato con una prova minima separata; il banco automatico può usare un sink File System Access sintetico per verificare nome e byte salvati.

## Archivio portatile con allegati a blocchi

Usare soltanto fixture sintetiche. Eseguire `npm run test:portable-archive`, `node --test tests/attachment-security.test.mjs`, `npm run test:portable-archive-capacity` e `npm run test:portable-archive-browser`; il gate aggregato resta `npm run test:portable-archive-prerelease`. Il probe deve comprendere uno stream da 485 MiB prodotto in blocchi da 8 MiB, non un'allocazione monolitica, e deve attestare output completo, scrittura massima sotto 1,5 MiB e RSS sotto 384 MiB nell'ambiente di riferimento.

Il banco browser deve aprire da `file://` il visualizzatore, verificare l'intero archivio prima di mostrare schede e scaricare un allegato con la seconda lettura autenticata. Provare password errata, ciphertext alterato, blocco riordinato o troncato, manifest/conteggio incoerente, byte dopo il terminatore, annullamento e cleanup dell'output parziale. Per un allegato oltre 8 MiB verificare File System Access e l'assenza di fallback Blob; per la creazione oltre 12 MiB verificare l'assenza del fallback in memoria.

Registrare browser, sistema operativo, dimensioni chiare/cifrate, picco RSS e massima singola scrittura. Un limite del sandbox sui download va distinto da un difetto applicativo con una prova minima indipendente e la ripetizione nello stesso browser fuori dal contenimento. Il test sintetico non certifica velocità, spazio libero o comportamento fisico su iPhone/Android.

## Banco Google Cloud reale per M7/M8

Questo banco serve a colmare il limite noto dell'emulatore Storage, che non certifica `ifGenerationMatch`. Prerequisiti: Google Cloud CLI (`gcloud`) installata; autenticazione con identità a privilegi minimi sul solo progetto `appcodici-password`; bucket e regione verificati; prefisso sintetico univoco registrato nel verbale; nessun oggetto o documento appartenente a utenti reali.

Sequenza minima obbligatoria: creare un oggetto sintetico; acquisirne la `generation`; sostituirlo; verificare che la cancellazione condizionata alla generazione precedente fallisca senza rimuovere la replacement; cancellare la generazione corrente; ripetere il comando per verificare idempotenza/esito mancante; provare staging e cleanup M8 con generazione fissata; inventariare e rimuovere soltanto le risorse sintetiche create. Conservare comandi redatti, timestamp, identità non segreta, bucket/prefisso, generazioni e risultati. Un esito verde soddisfa soltanto il prerequisito tecnico di questo banco. L'avvio del successivo canary allowlisted richiede il proprio incarico esplicito e gli altri gate applicabili; il test non autorizza canary o rollout generale.

Stato 10/10/2026: installato Google Cloud SDK 588.0.0, autenticati account utente e ADC sul progetto `appcodici-password`. Il banco reale sul bucket `appcodici-password.firebasestorage.app` ha creato due generazioni dello stesso oggetto sotto `codex-synthetic-gcs-gate/2026-10-10/`, ha respinto la cancellazione della generazione obsoleta con 404 generation-pinned, ha riletto e preservato la replacement, ha cancellato la generazione corrente e ha verificato 404 finale. Il successivo `gcloud storage ls` non trova oggetti nel prefisso sintetico. Nessun percorso o dato utente è stato letto o modificato.

Il primo run reale ha individuato che `File#delete` dell'SDK installato ignora l'opzione write-style `preconditionOpts` passata a `delete()`. Corretto il runner e l'helper candidato M8 `deleteStageGeneration` usando un file generation-pinned e i campi diretti `generation`/`ifGenerationMatch`. Verifiche locali combinate 23/23; runner GCS 2/2. Il run reale successivo è verde con cleanup verificato. Questo supera il gate puntuale delle precondizioni GCS, ma non certifica ancora il flusso distribuito completo M7/M8 né autorizza da solo il cutover generale.

Regressione M8 successiva alla correzione dell'helper: suite Functions backup **67/67** e laboratorio ripresa/staging/bridge **34 pass, 3 skip esterni dichiarati, 0 fail**. Il primo avvio confinato aveva prodotto esclusivamente errori `EACCES` sull'apertura di server loopback; la ripetizione fuori dal sandbox ha isolato un mock storico ancora basato su `preconditionOpts`, aggiornato al contratto reale `generation`/`ifGenerationMatch`, e ha chiuso la suite. Tutti i dati erano fixture sintetiche; nessun endpoint produttivo è stato esportato o attivato.

Primo incremento del blocco globale M7: introdotto il contratto CAS backend `archivePurgeLocks/{uid}` con binding opaco a proprietario, operazione e percorso Account; acquisizione e rilascio sono idempotenti soltanto per lo stesso binding, record attivi o malformati bloccano i writer. La prima copertura Firestore Rules rende il namespace backend-only e applica il fence ai writer client del proprietario, inclusi radice, discendenti, Aziende e inviti. Prove pure **5/5**, piano riferimenti **11/11**, Rules Emulator complessivo **78/78** (tre casi specifici: lock attivo blocca, release valida riapre, lock malformato fallisce chiuso). Il purge resta hard-off: prima dell'acquisizione reale devono essere raccordati anche tutti i writer Admin/Functions, che bypassano le Rules.

Secondo incremento M7: il bundle deployabile dei tredici writer Account/Profilo usa ora un proxy transazionale con contesto proprietario isolato; ogni transazione legge `archivePurgeLocks/{uid}` prima di ricevute o dati dominio. Un lock attivo produce `PURGE_LOCK_ACTIVE` depurato e il test dimostra che nessuna lettura Account precede il fence. Contratto/adattatore e confine callable **12/12**, bundle rigenerato e controllo build verde. Restano da raccordare gli altri writer Admin esterni al bundle prima di acquisire realmente il lock nel purge.

Chiusura locale del protocollo M7: gli entry point Admin inventariati sono recintati, inclusa la cancellazione contatto, e il purge acquisisce/rilascia `archivePurgeLocks/{uid}` nelle transazioni di preparazione/finalizzazione. Le prove che alterano direttamente lo stato durante la cancellazione sono avversariali e non rappresentano un writer applicativo non recintato. Evidenze complessive: Functions/security **428 pass, 9 skip dichiarati, 0 fail**; Rules Emulator **78/78**. Il risultato non abilita il motore: canary, attivazione e deploy restano gate separati.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Le istruzioni sono riutilizzabili, gli esiti sono in evidenze/COLLAUDI. Una checklist non compilata non è una prova riuscita. Nessuna raccolta di segreti in screenshot, report o chat. Il collaudo M4 storico non riapre automaticamente M4; nuove regressioni si riferiscono al gate fisico pertinente (M10). M6 resta da eseguire nei limiti della checklist.

<a id="controllo-sicurezza-ecc-temporaneo"></a>

## Controllo temporaneo degli strumenti AI per la sicurezza (ECC) — 07/11/2026

**Edizione:** 07/11/2026. **Riesame massimo:** 07/11/2027. **Stato:** procedura documentata per una prova futura; ECC e AgentShield non sono stati installati o eseguiti nell'ambito di questa verifica preliminare.

### Ambito e provenienza

La chat «Verifica ECC e i suoi strumenti» del 07/11/2026 ha verificato in sola lettura le funzionalità dichiarate e ha rinviato la prova fino alla chiusura e documentazione dell'attuale procedura di sicurezza. Non ha prodotto una scansione dell'app o un esito di collaudo di ECC. Il presente aggiornamento conserva quel limite.

ECC è valutato come possibile supporto, non come strumento obbligatorio o garanzia permanente. La funzione [`security-scan`](https://github.com/affaan-m/ECC/blob/main/skills/security-scan/SKILL.md), basata su [AgentShield](https://github.com/affaan-m/agentshield), riguarda configurazioni degli agenti AI: istruzioni, permessi, hook, server MCP e definizioni degli agenti. È distinta dalla revisione del codice applicativo supportata da [`security-review`](https://github.com/affaan-m/ECC/blob/main/skills/security-review/SKILL.md). Disponibilità e comportamento dipendono dall'ambiente effettivo; non si presume parità fra Claude Code, Codex e Cursor.

### Procedura per la futura prova controllata

1. **Verificare validità e incarico.** Leggere la scadenza sotto, lo stato della revisione di sicurezza corrente e l'incarico autorizzato. La sola presenza di questa sezione non avvia installazioni o scansioni. La prova ECC resta successiva alla chiusura documentata della procedura di sicurezza attuale.
2. **Selezionare strumenti e revisioni.** Confrontare manutenzione, copertura utile, compatibilità, gestione dei dati e limiti di ECC/AgentShield con le alternative disponibili al momento. Verificare il [repository ufficiale ECC](https://github.com/affaan-m/ECC) e quello di AgentShield; registrare commit, versione del pacchetto, provenienza, ambiente ospitante e runtime. Per questa prova non sono ancora stati selezionati una versione eseguibile e un commit di installazione. Non scaricare o eseguire automaticamente una versione mobile `latest`.
3. **Esaminare ciò che verrà eseguito.** Controllare manifest, dipendenze, script di installazione, hook, MCP, permessi, comandi e destinazioni di rete della revisione selezionata. Preparare una copia minima e redatta delle configurazioni autorizzate, escludendo credenziali, token, dati reali e contenuti della Vault. Un branch separato non costituisce isolamento del filesystem, della rete o dei segreti.
4. **Eseguire una prova circoscritta.** Usare una directory di prova isolata e un'installazione locale con versione fissata; iniziare senza hook attivi. Rivalidare nella documentazione della versione scelta i parametri AgentShield `scan --path <copia-configurazione> --format json`, con percorso esplicito, evitando la scoperta automatica dell'intero profilo utente. Il primo controllo è locale e in sola lettura: non usare `--fix` o `init`. La modalità avversariale con modelli esterni, inclusa `--opus`, è una prova distinta: prima identificarne contenuti trasmessi, destinatario, credenziali necessarie e possibili costi nel relativo incarico. Non eseguirla come effetto implicito della scansione locale.
5. **Verificare i risultati.** Distinguere configurazioni attive, esempi, cache e codice non raggiungibile. Per ogni rilievo ricostruire attore, input controllato, controlli, conseguenza e prerequisiti; registrare conferme, falsi positivi e fatti ancora mancanti. I punteggi del tool, il numero di agenti/skill e una soglia generale di coverage dell'80% non attestano la sicurezza dell'app. Restano separati audit del codice, test pertinenti, emulatori, configurazioni reali del cloud e prove fisiche.
6. **Registrare utilità e uscita dalla prova.** Conservare nelle evidenze esistenti data, revisione esaminata, versione dei tool, comando esatto, ambito, esito osservato, limiti, consumo di contesto e confronto con i controlli già presenti. Non inserire segreti o report grezzi nelle evidenze pubbliche. Rimuovere l'integrazione di prova se duplica controlli o introduce interferenze, verificando il ripristino della configurazione iniziale. L'adozione stabile richiede una decisione esplicita; la prova non abilita modifiche cloud o pubblicazioni.

### Scadenza e riesame obbligatorio

**Chi legge questi MD deve confrontare la data corrente con quella di scadenza. Dal 07/11/2027 questa edizione è scaduta e obsoleta come istruzione operativa, e vale soltanto come riferimento storico.** Non va riproposta o eseguita automaticamente come procedura attuale. Per riutilizzarla occorrono un nuovo confronto con gli strumenti allora disponibili, la verifica di versioni, comandi, permessi e limiti e una revisione esplicita registrata con nuove date e fonti. La scadenza non si rinnova copiando il testo o cambiando soltanto la data.

Il riesame va anticipato in caso di cambiamenti rilevanti di tool, plugin, hook, MCP, provider, runtime, permessi o minacce note. La durata di un anno è un limite massimo documentale, non una garanzia di adeguatezza fino a quella data. Non si assume che ECC sarà ancora la scelta migliore né che esisterà certamente un sostituto migliore: il confronto aggiornato deve stabilirlo. Le evidenze storiche mantengono la propria data, ambito e revisione anche dopo la scadenza della procedura.

## Indice delle fonti conservate

- [M4_VISUAL_ACCEPTANCE.md](#fonte-docs-m4-visual-acceptance-md-l1)
- [M5_COLLAUDO_DUE_DISPOSITIVI.md](#fonte-docs-m5-collaudo-due-dispositivi-md-l1)
- [M6_CHECKLIST_IPHONE.md](#fonte-docs-m6-checklist-iphone-md-l1)

<a id="fonte-docs-m4-visual-acceptance-md-l1"></a>

## Fonte: M4_VISUAL_ACCEPTANCE.md — righe originali 1–38

> Provenienza: `docs/M4_VISUAL_ACCEPTANCE.md` a `2900ccc0`.

<a id="fonte-docs-m4-visual-acceptance-md-collaudo-visivo-m4--header-footer-e-overscroll"></a>

## Collaudo visivo M4 — header, footer e overscroll

Questo documento conserva il collaudo che ha completato M4 sulla versione pubblicata. I test automatici verificano struttura e regressioni CSS, mentre la composizione grafica è stata confermata sui dispositivi usati durante il lavoro.

Il contratto delle due famiglie e del viewport è definito in `PAGE_SHELL_CONTRACT.md`; il relativo gate statico è `npm run test:page-shells`.

<a id="fonte-docs-m4-visual-acceptance-md-iphone"></a>

### iPhone

Eseguire in tema chiaro e scuro sulle pagine Home, Area privata, Account privati, Aziende, Scadenze, Archivio e Impostazioni:

1. aprire la pagina dall’icona installata in Home;
2. scorrere lentamente dall’inizio alla fine;
3. ripetere con movimenti rapidi e inversioni di direzione;
4. raggiungere il limite superiore e inferiore tentando un breve overscroll;
5. aprire e chiudere una tastiera o un pannello modale e ripetere lo scroll.

Esito richiesto:

- [ ] header stabile, senza lampi o cambi di luminosità;
- [ ] footer stabile, senza lampi o cambi di luminosità;
- [ ] nessuna fascia bianca oltre il contenuto;
- [ ] nessuna linea netta fra fondale della pagina e area esterna;
- [ ] pulsanti sempre selezionabili e non spostati dalle safe area;
- [ ] contenuto mai nascosto permanentemente sotto header o footer.

<a id="fonte-docs-m4-visual-acceptance-md-windows"></a>

### Windows

Ripetere sulle stesse pagine con finestra massimizzata e ridotta a circa 390 px di larghezza:

- [ ] nessun flash durante scroll con mouse e touchpad;
- [ ] nessun salto di layout quando compare la barra di scorrimento;
- [ ] header e footer restano allineati al contenitore massimo;
- [ ] tema chiaro e scuro mantengono contrasto leggibile.

<a id="fonte-docs-m4-visual-acceptance-md-registrazione-esito"></a>

### Registrazione esito

Annotare dispositivo, versione del sistema operativo, browser/PWA, tema e pagina dell’eventuale difetto. Una sola voce negativa mantiene M4 aperta e richiede correzione prima di M5.


<a id="fonte-docs-m5-collaudo-due-dispositivi-md-l1"></a>

## Fonte: M5_COLLAUDO_DUE_DISPOSITIVI.md — righe originali 1–16

> Provenienza: `docs/M5_COLLAUDO_DUE_DISPOSITIVI.md` a `2900ccc0`.

<a id="fonte-docs-m5-collaudo-due-dispositivi-md-m5--collaudo-identità-su-due-dispositivi"></a>

## M5 — Collaudo identità su due dispositivi

Il test automatico `sharing-two-device.test.mjs` simula il trasferimento serializzato dal dispositivo A al dispositivo B e dimostra che la chiave privata resta cifrata, l'identità può essere riaperta con la stessa Vault Key e il destinatario può decifrare la chiave per-record. Un dispositivo con materiale Vault errato viene respinto.

<a id="fonte-docs-m5-collaudo-due-dispositivi-md-prova-fisica-non-produttiva"></a>

### Prova fisica non produttiva

1. usare due account e due dispositivi dedicati al collaudo, senza dati reali;
2. creare sul dispositivo A l'identità del destinatario e verificare che Firebase riceva soltanto la chiave pubblica;
3. accedere allo stesso account sul dispositivo B e riaprire la busta privata con la Vault Key corretta;
4. condividere un record fixture dal proprietario e verificarne la decifratura sul dispositivo B;
5. provare Vault Key errata, UID differente, busta alterata e chiave pubblica sostituita: tutti devono essere bloccati;
6. revocare il destinatario, ruotare la chiave per-record e verificare che il nuovo contenuto non sia leggibile dalla vecchia sessione offline;
7. cambiare Master Password senza cambiare la Vault Key e ripetere la riapertura;
8. registrare soltanto esito, versione schema e codice errore, mai chiavi o contenuti.

Il test fisico non autorizza il cutover. L'attivazione resta separata e richiede backup M8 realmente ripristinato e approvazione delle Rules di produzione.

<a id="fonte-docs-m6-checklist-iphone-md-l1"></a>

## Fonte: M6_CHECKLIST_IPHONE.md — righe originali 1–163

> Provenienza: `docs/M6_CHECKLIST_IPHONE.md` a `2900ccc0`.

<a id="fonte-docs-m6-checklist-iphone-md-m6--checklist-iphone-per-diego-prova-fisica-evidenza-circoscritta"></a>

## M6 — Checklist iPhone per Diego (prova fisica, evidenza circoscritta)

> **Stato: APERTA e NON ESEGUITA.** Questa checklist **non è stata eseguita**, non contiene esiti e non
> certifica nulla finché non è compilata da Diego sul proprio dispositivo.
>
> **Un esito fisico positivo è evidenza circoscritta**: riguarda i passi qui elencati, su quella build e
> quel dispositivo, e **non chiude M6**, **non chiude M6-F3**, **non chiude i gate PWA, di produzione o di
> deploy** e non autorizza alcun rilascio. I **gate M6 restano quelli elencati** in
> [STATO_CORRENTE_M0_M10.md](../progetto/STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1) e [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1)
> (M6-1, M6-2, M6-3 e la matrice delle copie PWA); lo stato delle decisioni di prodotto è in
> [REGISTRO_DECISIONI.md](../progetto/DECISIONI.md#fonte-docs-registro-decisioni-md-l1).
>
> **Autorità:** contratto [M6 — Sincronizzazione e scritture offline](../regole/OFFLINE.md#fonte-docs-m6-sincronizzazione-offline-md-l1);
> prevale la baseline di sicurezza.
> **Perimetro:** sola consultazione. Nessuna modifica ai dati, nessuna nuova credenziale di prova, nessun
> logout, nessun deploy. **Nessuna prova su dispositivi o ambienti reali è stata eseguita per produrre
> questo documento.**
> **Build da provare:** la sceglie **Diego**. Questa checklist non indica, non presume e non sostituisce
> la scelta della build o dell'ambiente.

<a id="fonte-docs-m6-checklist-iphone-md-perché-serve"></a>

### Perché serve

Il test del 10/09/2026 con un Account bancario aperto integralmente online non ha superato la
consultazione offline: dopo il distacco della rete la lista risultava vuota o non disponibile. Nessun
esito di laboratorio sostituisce questa prova. Questa checklist ripete il flusso in modo verificabile e
raccoglie **evidenze circoscritte**, senza catturare segreti.

<a id="fonte-docs-m6-checklist-iphone-md-1-anagrafica-del-test--da-compilare-prima-di-iniziare"></a>

### 1. Anagrafica del test — da compilare **prima** di iniziare

| Campo | Valore (a cura di Diego) |
|---|---|
| Data e ora di inizio | |
| Esecutore | |
| Dispositivo e versione iOS | |
| Browser / PWA usati (installata sulla Home?) | |
| **Versione e build effettive** lette nell'app (piè di pagina o schermata versione) | |
| **Ambiente provato** | ☐ produzione (app pubblicata) ☐ preview/laboratorio **esplicitamente autorizzati** |
| Riferimento dell'autorizzazione, se preview/laboratorio | |
| Rete disponibile per il ritorno online (Wi-Fi / dati) | |
| Note su fixture o account dedicati **già autorizzati** (se usati) | |

**Regole sull'ambiente.** Produzione e preview/laboratorio **non sono intercambiabili**: un esito su
preview **non** vale come prova di produzione e viceversa. Una prova su preview o laboratorio si esegue
**solo** se esiste un'autorizzazione esplicita e separata, da citare nel campo sopra. Se l'autorizzazione
non c'è, il test su quell'ambiente **non si esegue**.

Se il test si svolge in più sessioni, indicare la **data accanto a ogni riga** compilata.

<a id="fonte-docs-m6-checklist-iphone-md-2-regole-di-evidenza-nessun-segreto-nessun-dato-reale"></a>

### 2. Regole di evidenza (nessun segreto, nessun dato reale)

1. **Vietato** consegnare screenshot, foto, video, testi o report che contengano **PIN, CCV, password,
   credenziali, valori in chiaro, token o dati personali** (nomi, indirizzi, email, IBAN, documenti).
2. **Non trascrivere mai il valore** di un PIN, CCV, password o credenziale: si verifica solo il
   **comportamento** di mascheramento e rivelazione. La verifica è «il campo era mascherato, l'azione di
   rivelazione ha mostrato un valore, il campo è tornato mascherato», **senza registrare il valore**.
3. Ammesse come evidenza **solo**: (a) la **tabella compilata** con esiti strutturati; (b) i campi
   dell'anagrafica; (c) eventuali screenshot di schermate **prive di segreti e di dati personali**;
   (d) eventuali **fixture dedicate esplicitamente autorizzate**, dichiarate in anagrafica.
4. Se una schermata **può contenere** segreti o dati personali, **non acquisirla**; se serve comunque
   documentarla, **oscurarla sul dispositivo prima che l'immagine lo lasci**.
5. Non consegnare log, dump di IndexedDB, esportazioni o allegati che possano contenere valori cifrati
   con le relative chiavi, token o dati personali.
6. Se un'evidenza acquisita per errore contiene segreti o dati personali, **non consegnarla**: va
   eliminata dal dispositivo e sostituita con una descrizione strutturata dell'esito.

<a id="fonte-docs-m6-checklist-iphone-md-3-prerequisiti"></a>

### 3. Prerequisiti

- PWA installata sulla schermata Home (Safari → Condividi → Aggiungi a Home), **oppure** preview
  autorizzata secondo l'anagrafica.
- Versione e build **registrate in anagrafica** prima di iniziare.
- Master Password disponibile; Vault sbloccato prima del distacco.
- Sessione mantenuta: **non eseguire il logout** in nessun momento del test.
- Dati già presenti e non modificati nel profilo usato (almeno un Account personale e uno aziendale con
  banche e carte, Widget bancari, credenziali comuni, profilo, indirizzi, documenti, scadenze).
- Wi-Fi e rete mobile disponibili per il ritorno online.
- Circa 15 minuti. Nessuna nuova credenziale di prova va inserita.

<a id="fonte-docs-m6-checklist-iphone-md-4-preparazione-online-obbligatoria"></a>

### 4. Preparazione online (obbligatoria)

1. Apri l'app con rete attiva e sblocca il Vault con la Master Password.
2. Attendi che la preparazione offline automatica arrivi allo stato pronto. Non procedere prima.
3. Visita una volta, sempre online: lista Account personali, dettaglio degli Account bancari con le
   banche e le relative carte, Widget bancari, credenziali comuni, profilo (anagrafica, contatti,
   indirizzi, documenti), scadenze. Solo ciò che è stato caricato è garantito leggibile.
4. Non eseguire il logout.

<a id="fonte-docs-m6-checklist-iphone-md-5-distacco-della-rete"></a>

### 5. Distacco della rete

5. Attiva la Modalità aereo, oppure disattiva Wi-Fi e dati cellulare.
6. Verifica che l'app mostri lo stato offline. Da qui in avanti **non riattivare la rete** fino al §8.
7. Chiudi e riapri la PWA: è atteso un nuovo sblocco con la Master Password (le chiavi non sopravvivono
   alla chiusura: è il comportamento corretto).

<a id="fonte-docs-m6-checklist-iphone-md-6-verifiche-offline"></a>

### 6. Verifiche offline

Una riga per verifica. Segna **`OK`**, **`KO`** oppure **`NON ESEGUITO`**. Nessun valore segreto o dato
personale va trascritto: la colonna «Esito» contiene solo l'esito e, se serve, una nota di comportamento.

| # | Passo | Atteso (verifica di comportamento) | Esito |
|---|---|---|---|
| 1 | Apri la lista Account personali | Gli Account già caricati sono elencati; non una lista vuota | |
| 2 | Apri un Account bancario personale | Dettaglio visibile; presenza delle banche attese (nessun valore trascritto) | |
| 3 | Rivela e rimaschera PIN e CCV della prima carta | Campo **mascherato** prima della rivelazione; la rivelazione mostra un valore; il campo torna mascherato. **Non registrare il valore** | |
| 4 | Controlla la seconda banca e la sua carta | Stesso comportamento di mascheramento/rivelazione del punto 3; nessun valore mancante (**senza** trascriverlo) | |
| 5 | Apri la lista Account aziendali e un Account bancario aziendale | Stessi controlli dei punti 2–4 per il perimetro aziendale, **senza** trascrivere valori | |
| 6 | Apri i Widget bancari | Valori presenti e coerenti; **nessun dato di un altro Account** (nessun valore trascritto) | |
| 7 | Apri le credenziali comuni | Voci presenti con campi **mascherati**; comportamento di rivelazione come al punto 3 | |
| 8 | Apri il profilo: anagrafica, contatti, indirizzi, documenti | Dati già caricati leggibili (nessun dato personale trascritto) | |
| 9 | Apri gli allegati di un Account | Nome e metadati già caricati; **non** è richiesto che il contenuto del file sia disponibile offline | |
| 10 | Apri le scadenze | Dati già caricati leggibili | |
| 11 | Blocca il Vault e tenta di rileggere i dati | Accesso negato finché non si sblocca di nuovo | |
| 12 | Sblocca di nuovo con la Master Password | La matrice precedente torna leggibile | |
| 13 | Cambia sezione e torna indietro | I valori rivelati vengono **azzerati** quando si lascia la vista | |

<a id="fonte-docs-m6-checklist-iphone-md-7-chiusura-riapertura-e-cache-mancante"></a>

### 7. Chiusura, riapertura e cache mancante

14. Chiudi completamente la PWA e riaprila **senza rete**; sblocca e ripeti i punti 1, 2, 5 e 6.
15. Opzionale ma più severo: riavvia l'iPhone senza rete e ripeti i punti 1, 2, 5 e 6.
16. Se una lista o un dettaglio **già caricato** appare vuoto o «non disponibile» offline, registra
    **`KO`**: una lista vuota non significa «nessun dato».
17. Verifica un dominio mai aperto online (per esempio il profilo di un'azienda mai visitata): deve
    comparire un messaggio di indisponibilità, **non** un record vuoto o inventato. Se il dato non viene
    mostrato come valido, registra **`OK`**.
18. Un documento mai caricato non è garantito offline: è un limite noto, **se** non viene presentato come
    dato valido. Le domande aperte su questo tema restano in
    [M6_DOMANDE_CACHE_ESPULSA.md](../domande/M6_OFFLINE.md#fonte-docs-m6-domande-cache-espulsa-md-l1).

<a id="fonte-docs-m6-checklist-iphone-md-8-ritorno-online"></a>

### 8. Ritorno online

19. Disattiva la Modalità aereo e attendi il ritorno della connessione.
20. Verifica di essere ancora autenticato senza nuovo login.
21. Riapri un dettaglio bancario: gli stessi dati devono essere presenti e coerenti (nessun valore
    trascritto).

<a id="fonte-docs-m6-checklist-iphone-md-9-condizioni-di-stop"></a>

### 9. Condizioni di stop

Interrompi il test e riferisci subito, **senza tentare riparazioni**, se:

- un valore segreto è visibile in chiaro dove dovrebbe essere mascherato;
- compaiono dati di un altro Account o di un altro utente;
- il Vault si sblocca senza Master Password, oppure la sessione cambia utente da sola;
- un Account o una lista caricati integralmente online appaiono vuoti o non disponibili offline: è il
  difetto originale, va registrato e non aggirato;
- l'app richiede un nuovo login o esegue il logout da sola;
- un dato risulta modificato;
- **un'evidenza acquisita contiene segreti o dati personali**: non consegnarla, eliminala dal dispositivo
  e sostituiscila con una descrizione strutturata dell'esito.

Non modificare dati, non rifare la preparazione, non reinstallare l'app e non eseguire alcun deploy
durante il test.

<a id="fonte-docs-m6-checklist-iphone-md-10-esito-e-limiti"></a>

### 10. Esito e limiti

- Consegna la **tabella compilata** (anche con righe `NON ESEGUITO`) e l'**anagrafica**: sono le evidenze
  ammesse. Aggiungi screenshot **solo** se privi di segreti e dati personali.
- **Un esito positivo è evidenza circoscritta**: vale per i passi elencati, su quella build e quel
  dispositivo. **Non chiude M6**, **non chiude M6-F3**, **non chiude i gate PWA, di produzione o di
  deploy** e non autorizza alcun rilascio.
- I **gate M6** restano quelli di [STATO_CORRENTE_M0_M10.md](../progetto/STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1) e
  [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1); un esito **`KO`** o **`NON ESEGUITO`** non
  chiude nulla e non va presentato come superato.
- La build e l'ambiente li sceglie **Diego**: questa checklist non li seleziona e non presume che la
  prova sia già avvenuta su produzione, preview o laboratorio.

> Evidenza locale 10/10/2026 — M7 blocco globale: regressione sintetica dei writer Admin già recintati (recupero sync, restore backup, risposta inviti, allegati condivisi e contratto lock) **63/63**. Nessun dato reale, deploy o attivazione; il risultato non certifica ancora tutti i writer Admin né il ciclo acquire/release della purge.
> Evidenza locale 10/10/2026 — M7 writer di riferimento: Widget Account e Credenziale comune bloccano le mutazioni con lock globale attivo prima delle letture di dominio; regressione mirata **34/34**. Prova sintetica, senza deploy e senza attivazione del purge.
> Evidenza locale 10/10/2026 — M7 writer offline: anche Account privato e sync offline falliscono chiusi sul lock globale prima delle letture di dominio. Contratto mirato **17/17**, regressione combinata **34/34**; solo fixture sintetiche, nessun deploy.
> Evidenza locale 10/10/2026 — M7 ciclo lock/purge: acquire CAS, resume, persistenza del lock dopo interruzione e release atomica finale verificati nella regressione sintetica **31/31**. Il motore rimane hard-off; la prova non usa Storage o dati reali e non autorizza il rollout.
> Evidenza locale 10/10/2026 — regressione Functions completa dopo il blocco globale: controlli sintattici e lint verdi; **427 pass, 9 skip, 0 fail**. Gli skip rimandano a profili emulatore dedicati e non vanno contati come gate superati.
> Evidenza locale 10/10/2026 — Firestore Rules Emulator: **78/78**, zero fallimenti; lock attivo, release valida, fail-closed su record malformato e namespace backend-only verificati senza dati reali.
> Evidenza locale 10/10/2026 — governance documentale: **31 MD**, **615 link**, **11/11** controlli superati nel rerun locale autorizzato.
> Evidenza release 10/10/2026 — candidata `1.2.152`: regressione completa attraversata dopo il nuovo fence globale; corretto il caso di riacquisizione del lock da parte di una nuova purge dopo una release. Ultimi profili rieseguiti con esito verde: QR **2/2**, allegati documento Firestore/Storage **9/9**, collegamenti profilo **2/2**, note Account **1/1**, Account standard **1/1**. Solo fixture ed emulatori sintetici; non equivale a prova su GCS o dispositivi reali e non abilita i motori hard-off.

> Evidenza locale 26/10/2026 — AI.2 candidata `1.2.241`: `test:assistant-local-ai` **49/49**, `test:assistant` **17/17**, probe browser standard verde e probe WebGPU con modello reale verde. La richiesta “Spiegami questa pagina e dimmi a cosa serve” è stata classificata erroneamente dal modello leggero come selezione del secondo risultato; la validazione applicativa l'ha corretta in `explain_page` usando soltanto lo scopo e i passaggi della guida verificata. Suite completa successiva: uscita **0**, inclusi profili Firestore/Auth/Storage Emulator. Un primo passaggio è stato ripetuto perché la porta locale 8080 era occupata da un emulatore residuo; non era un errore applicativo.

## Runner QA Scadenze (04/11/2026)

Il runner opera soltanto tramite UI e richiede il file credenziali DPAPI QA e l'ID esplicito dell'Azienda sintetica:

```powershell
$env:CODEX_QA_COMPANY_ID='wDYoVnxGwwlTkqge0htJ'
$env:CODEX_QA_CREDENTIAL_PATH='C:\Users\Diego\AppData\Local\CodiciPassword\qa\credentials.dpapi'
$env:QA_SKIP_PRIVATE_ARCHIVE='1'
$env:QA_ALLOW_INCOMPLETE='1' # solo esecuzione informativa, non gate di rilascio
npm run qa:populate-deadlines-browser
```

- Il runner si arresta se le notifiche Scadenze sono attive o se compare un recapito non `.invalid`/un canale destinatario attivo.
- `QA_SKIP_PRIVATE_ARCHIVE=1` esclude completamente la fixture privata duplicata e rinvia archivio/ripristino; senza `QA_ALLOW_INCOMPLETE=1` il gate resta rosso.
- La cancellazione permanente di TEMP CESTINO è vietata per default; richiede insieme `QA_ALLOW_DESTRUCTIVE=1` e `QA_DELETE_TEMP_TRASH=1`, oltre a un bersaglio identificato nella stessa esecuzione.
- La bonifica di duplicati richiede due ID espliciti, `QA_ALLOW_DESTRUCTIVE=1`, `QA_CLEANUP_CONFIRM=DELETE_SYNTHETIC_DUPLICATE` e un consenso diretto verificabile. In assenza di tale consenso non impostare queste variabili.
- Le condivisioni end-to-end, la consegna di notifiche e i dispositivi reali restano fuori dal runner automatico.

Per Documento → Scadenza si serve temporaneamente `Frontend/public` su loopback e si imposta `QA_APP_ORIGIN`. L'upload dell'allegato sorgente deve prima riuscire tramite la UI protetta; un `401` App Check è un blocco da registrare, non da aggirare con scritture dirette.

## Runner QA P0 sicuro (04/11/2026)

`npm run qa:p0-safe-browser` esegue il blocco pre-finale esclusivamente con
`codex.qa2@appcodici-password.invalid` e UID `1lfhs2WoDRNXA9huOK0u0ffjQC13`.
Il runner interrompe l'avvio se bundle DPAPI, e-mail o UID non coincidono; non
può essere usato con Account reali.

```powershell
$env:CODEX_QA_CREDENTIAL_PATH='C:\Users\Diego\AppData\Local\CodiciPassword\qa\credentials.dpapi'
npm run qa:p0-safe-browser
```

Il report e le schermate senza segreti sono scritti in
`.codex-tmp/qa-p0-safe/<data-ora>/`. Download, archivio ed esportazioni decifrate
vivono esclusivamente nella directory temporanea del sistema e sono rimossi nel
`finally`; il report conserva soltanto nome, dimensione e hash SHA-256. Il runner copre: accesso/sblocco e identità
QA2, preferenze reversibili, Supporto, annullamento popup reset/revoca,
Credenziali comuni in sola lettura, Archivio Account in consultazione, backup
cifrato con Recovery Key solo in memoria, restore fino al preflight e annullato,
Archivio portatile offline, JSON/CSV/ODS/XLSX, Salute credenziali, utilizzo
campi, diagnostica e logout finale.

Sono vietati: dati reali, delete, cambio password/Master Password, MFA,
biometria, recovery code, revoca sessioni, reset Vault, applicazione restore e
notifiche reali. Il guardiano screenshot rifiuta la cattura se vede un campo
password o la Recovery Key. Se callable, fixture, download o file picker non
sono affidabili, l'esito deve essere `BLOCKED` e non va forzato.

Esiti: `PASS` = controllo concluso e stato ripristinato; `BLOCKED` =
prerequisito controllato assente; `FAIL` = difetto o perdita delle garanzie;
`SKIP` = blocco esplicitamente escluso. Dopo il P0 restano, come fasi separate,
bonifica repository, Graphify/aiuti, lingue e prove con dispositivi reali.
Per default `BLOCKED` o `SKIP` rendono rosso il gate. `QA_P0_ALLOW_INCOMPLETE=1`
consente soltanto un'esecuzione informativa e deve risultare esplicitamente nel report.
