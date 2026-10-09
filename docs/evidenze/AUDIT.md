# Audit

## Pre-collaudo e backup preventivo — 09/10/2026

Su richiesta del proprietario il ciclo è stato riaperto esclusivamente per preparare abilitazione e collaudo controllati. La sessione autenticata dell'app pubblicata ha mostrato versione `1.2.144`, home, area privata e impostazioni senza errori console rilevati nelle viste controllate. La home presenta però un'immagine profilo non caricata, da ricontrollare come anomalia visiva distinta dai motori M7/M8/M10.

**Export preventivo riuscito.** È stato creato un bucket dedicato privato in multi-region UE, con accesso uniforme, prevenzione dell'accesso pubblico e soft-delete predefinito. Il ruolo `Storage Admin` è assegnato sul solo bucket al service account gestito di Firestore. L'export di tutte le raccolte verso `appcodici-password-firestore-backup-eu-20261009/pre-test-2026-10-09T15-10-09Z` risulta `Riuscita`: 551 documenti, 422,61 kB, completato il 09/10/2026 alle 17:15:02 Europe/Rome. Questo prova la disponibilità dell'artefatto di backup, non un ripristino effettivo.

Prima delle prove con scritture sono stati tentati due export completi tramite la Console Firestore. Entrambi sono falliti senza creare backup: `403` per assenza di accesso del service account `service-343696844738@gcp-sa-firestore.iam.gserviceaccount.com` al bucket europeo di trasferimento; `400` per incompatibilità geografica del bucket predefinito `us-central1` con il database europeo. Nessun dato è stato modificato. Il collaudo con scritture resta sospeso finché non esiste un export riuscito e verificato.

## Evidenza di chiusura operativa — 09/10/2026

Base rilasciata `7095925b`, versione `1.2.144`, progetto Firebase originale `appcodici-password`. Deploy completo riuscito: Hosting, Functions, regole Storage, regole e indici Firestore. Verifica remota immediata: `index.html` 200, `manifest.json` 200 e riferimento `1.2.144` presente. Prima del deploy: Functions/security 422 totali, 413 pass, 9 skip emulatori dichiarati e zero fail; offline 14/14; audit riferimenti statici e release hardening verdi. Repository originale pulito dopo il rilascio.

Esito: ciclo tecnico M7–M10 chiuso con confine safe-off. Purge automatico e restore riprendibile non sono certificati né attivati; audit indipendente, privacy/legale, GCS reale e dispositivi fisici non sono stati eseguiti. Queste assenze sono limiti dichiarati e non falsi esiti positivi.

09/10/2026 — opzione MFA 1 resa strutturale nel ramo: il full-replace non è più soltanto irraggiungibile, ma è stato rimosso dalla callable insieme agli effetti automatici successivi. Rimangono separati i laboratori selective-withdraw hard-off e le prove storiche skip; nessuno è importato dal runtime. Lo stato online non cambia senza pubblicazione Functions esplicitamente autorizzata.

09/10/2026 — Diego sceglie MFA opzione 1: assistenza manuale quando non esiste una sessione valida. Il ramo locale interrompe la callable prima di codici e mutazioni Auth per ogni account con MFA; il full-replace resta nel sorgente storico a valle ma è irraggiungibile e coperto da skip espliciti, in attesa di successiva rimozione meccanica. La modifica non è distribuita: la produzione conserva il comportamento dell'ultima callable pubblicata fino a un deploy Functions autorizzato.

09/10/2026 — il ponte custom-token proposto per ottenere un ID token nel recupero MFA è **respinto**: il banco Auth Emulator dimostra che lo scambio può ricreare automaticamente un account cancellato nella race fra verifica e scambio. Non esiste CAS sull'identità Auth che chiuda questa finestra. Il codice laboratorio resta non importato e hard-off; non va presentato come soluzione approvata. La revoca selettiva rimane utilizzabile con una sessione utente già valida, mentre il lockout totale richiede supporto manuale oppure accettazione documentata del rischio full-replace.

09/10/2026 — riesame ufficiale MFA: Firebase documenta i custom auth token fra i metodi non supportati dalla challenge MFA e indica che il recupero del secondo fattore deve essere costruito dall'app con verifica d'identità sufficiente. È stato quindi modellato soltanto un ponte server-side che non consegna alcuna sessione al browser, usa l'ID token temporaneo per il withdraw selettivo e revoca subito i refresh token. Evidenza sintetica 12/12; nessuna attestazione ancora su Auth reale/emulato e nessuna attivazione.

09/10/2026 — alternativa locale per MFA-CONSUME: aggiunto solo un adapter di laboratorio hard-off che modella la revoca selettiva di un singolo enrollment tramite `accounts.mfaEnrollment:withdraw`. Non è importato dal runtime e non sostituisce la callable distribuita. La soluzione elimina semanticamente il full-replace soltanto quando esiste un ID token utente valido; questo prerequisito resta il gate di sicurezza da progettare e verificare. Evidenza 3/3 sintetica, nessuna operazione Auth reale.

09/10/2026 — evidenza di rilascio del pacchetto applicabile: commit `909b8211` pubblicato su `origin/codex/complete-m7-m8-m10`; Firebase CLI ha completato l'aggiornamento della callable `recoverMfaWithCode` (`europe-west1`) e il rilascio Hosting di `appcodici-password`. URL verificato: `https://appcodici-password.web.app`; DOM/accessibilità e schermata concordano sulla home, con versione `1.2.141`. Il popup Vault è stato annullato e la schermata sottostante è tornata integra; console browser senza errori o warning. La verifica ha riutilizzato una sessione locale già autenticata senza digitare credenziali o effettuare mutazioni applicative; nessuna cattura con dati personali è conservata. Prima del deploy: Functions/security 403 totali (398 passaggi, 5 skip emulatori), history 117/117, backup 109/109, vault preview 4/4, docs 11/11 e release-hardening superato. Perimetro escluso e invariato: Rules, indici, migrazioni, purge e dati. Restano aperti i gate dichiarati per M7/M8, la rimozione MFA selettiva concorrente, audit indipendente, privacy finale e collaudi fisici; il rilascio non li trasforma in accettati.

09/10/2026 — MFA-CONSUME avanzato ma non chiuso: il recovery code non viene più rimosso prima dell'effetto Auth. Una prenotazione legata all'hash consente retry dello stesso codice dopo errore Auth e riconciliazione dopo risposta persa; un hash differente non può attraversare una prenotazione esistente. La prenotazione scade dopo 15 minuti senza estendersi ai retry e una ripresa successiva fallisce chiusa senza ripetere Auth o consumare il codice. I fattori non TOTP già visibili bloccano il percorso senza consumo. Prove mirate 13/13, regressione Functions/security 398 pass/5 skip/zero fail e Firestore emulato 2/2 confermano consumo singolo e assenza del marker finale. Resta però una race vincolante: `updateUser(...enrolledFactors:null)` può eliminare un fattore aggiunto dopo `getUser`; l'Admin SDK non offre CAS o rimozione TOTP selettiva. La decisione di preservare fattori concorrenti non è soddisfatta. Restano inoltre Auth reale, account eliminato/ricreato, rollout e audit indipendente.

05/10/2026 — riesame MFA-CONSUME: [accounts.update](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/update) documenta che mfa sostituisce le informazioni precedenti; non offre in quel campo una rimozione selettiva concorrente. [mfaEnrollment.withdraw](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaEnrollment/withdraw) distingue rimozione per enrollment con ID token. Consultazione tecnica, non prova nuova di funzionamento: il custom-token già caratterizzato come capace di ricreare utente eliminato resta non accettato, nessuna compensazione distruttiva o cambio configurazione Auth applicati. Nessuna nuova domanda sul consenso al medesimo esperimento; altri lavori indipendenti proseguono.

05/10/2026 — M8-RP-01/M8-TS-01 hanno ricevuto risposta esplicita, registrata in DECISIONI e recepita in BACKUP. Nelle righe storiche sotto, l'attesa della decisione è superata; restano aperti implementazione e collaudo M8-PARTIAL, non la scelta di durata o trattamento della precisione.

05/10/2026 — riesame verso chiusura: collaudo update widget generico locale positivo (vedi COLLAUDI); source bankId ora rifiutato dopo regressione rossa/verde. Build candidata aggiornata e regressioni estese superate, ma non equivalgono a parità UI create/delete/shared/banking né chiusura VS-P0-01, PURGE-CAS, MFA-CONSUME o KDF-LEGACY. Il test statico T-08 era obsoleto: widget/link sono letti dal preflight dell'algoritmo sospeso, non ripuliti. Corretto il test, non dichiarata soluzione delle copie residue. RICONCILIAZIONE-04-10 sotto resta indice dei residui; nessuna nuova decisione M8 ricevuta.

04/10/2026 — chiuso il controllo di nuova preparazione nel namespace sintetico: riferimenti esistenti impediscono di ricreare un piano cancellabile dopo invalidazione; transazione comune e writer cooperanti coprono la contesa. Dettagli in COLLAUDI. Non equivale a completezza del piano applicativo: restano censimento riferimenti/discendenti, Storage e ripresa riconciliata dopo stop. Nessuna release automatica introdotta.

04/10/2026 — pre-claim completato nel solo writer sintetico: riferimento e invalidazione atomici, versione bersaglio verificata, create-only senza sovrascritture; gli stati con storia sequence non vengono ridotti a idle. Prove SDK in COLLAUDI. Il successivo piano dovrà includere/verificare i riferimenti esistenti: invalidare quello precedente non certifica la completezza di uno nuovo. Restano ripresa post-stop, discovery e integrazione dei writer applicativi; PURGE-CAS/T-08 aperti.

04/10/2026 — raccordo post-claim sintetico: richiesta di riferimento ed executor documentale ora contendono lo stesso labPurgeStates. Stop impedisce i passi successivi; se la delete precede la richiesta viene riportato target-missing, non un salvataggio. Retry dello stop già persistito non incrementa revisioni. Prova SDK in COLLAUDI. Restano esplicitamente aperti writer completo pre-claim, ripresa dopo riconciliazione, copertura runtime e Storage; nessuna nuova policy di sblocco o retention e nessuna chiusura PURGE-CAS/T-08.

## RICONCILIAZIONE-04-10 — residui e prove necessarie

Raccordo del registro operativo RICONCILIAZIONE-10 con decisioni e checkpoint successivi, su richiesta di Diego di procedere e usare l'app di prova dove necessario. Non è una nuova lettura completa di tutto il codice o una certificazione dei 31 MD. Le prove storiche conservano la propria data; le sole verifiche rieseguite qui sono in COLLAUDI, sezione RICONCILIAZIONE-04-10. Questa tabella è l'indice corrente dei residui censiti; le descrizioni storiche sotto non riaprono scelte già approvate.

| Ambito / ID già esistenti | Stato riconciliato | Passo concreto e criterio di chiusura |
| --- | --- | --- |
| VS-P0-01 / ingresso multipagina | Aperto. Inventario statico attuale conferma wrapping key in sessionStorage e ingresso profilo legacy. Tutti i 13 export cercati sono presenti nel checkout: il vecchio 0/13 è superato. | Verificare nella candidata isolata ingresso, lock, logout, cambio utente e navigazione fra pagine; poi riesaminare parità dei percorsi prima dell'integrazione finale. Il laboratorio RAM da solo non chiude il runtime legacy. |
| PURGE-CAS | Aperto P1, riprodotto nuovamente nell'handler con dipendenze sintetiche. PURGE-SEQUENCE-03 conclude soltanto il protocollo documentale di laboratorio. | Mappare writer di Account, ripristino, upload e riferimenti sul medesimo confine; provare interleaving e conflitti prima di ogni effetto distruttivo nella candidata. Una seconda lettura isolata non chiude la race; completamento richiede copertura dei writer e dei bersagli. |
| M8-PARTIAL / M8-RP-01 / M8-TS-01 | Staging, lettori e commit hanno prove locali circoscritte. Ripresa nuova sessione non completa; due quesiti tecnici registrati in M8_RECUPERO. | Precisare metadati minimi, durata/scadenza del piano di ripresa e trattamento di timestamp non rappresentabili; decisioni mancanti da presentare con alternative. Prove integrate devono conservare completati, segnalare mancanti/conflitti e non sovrascrivere modifiche concorrenti. |
| T-08 / T-09 / T-26 / T-28 | Residui di copie/riferimenti e byte; 3A e 3C già approvano pulizia verificata e preservazione dei dati autonomi. Non chiedere di nuovo se pulire. | Inventario per identità/versione e prova di file referenziati, sostituiti e upload interrotti; nessuna cancellazione di dati autonomi o ancora referenziati. Distinguere il limite dimostrato dell'emulatore Storage sulle precondizioni di generazione. T-16 è solo indice, non ulteriore difetto. |
| T-27 | Mitigazione del delete padre già verificata; percorso Azienda vuota ancora da completare secondo 3B. | Nella candidata dimostrare rifiuto con Account presenti e completamento coordinato con riferimenti/allegati quando assenti; nessuna cascata implicita sugli Account. |
| MFA-CONSUME | Consumo anticipato corretto localmente; retry, scadenza fail-closed a 15 minuti e concorrenza Firestore verificati. Gate ancora aperto: `enrolledFactors:null` non preserva un fattore aggiunto fra lettura e update Auth. | Serve una rimozione per enrollment che non ricrei l'account; poi Auth reale, eliminazione/ricreazione concorrente, rollout e audit indipendente. |
| KDF-LEGACY | Riscontro attuale: campi 100000 iterazioni, KEK/verifier 600000. Due test verifier passati non verificano migrazione campi. | Definire compatibilità/versione del formato e provare lettura dei dati precedenti, conversione e interruzioni su fixture sintetiche prima di cambiare parametri. |
| M7-D1 | Modello locale 25/25: due anni dall'ultima archiviazione, almeno dieci giorni dall'avviso persistito; riarchiviazione, ambito aziendale, date corrotte e avviso assente verificati fail-closed. | Collegare soltanto dopo protocollo purge sicuro; notifiche, scheduler, D8 e attivazione distribuita restano gate separati. |
| DEADLINE-SCAN | Capacità non misurata; limite statico del ciclo utenti/scadenze già documentato. | Banco sintetico con volume e interruzioni per misurare avanzamento e tempi; nessuna soglia di capacità dedotta dai test funzionali. |
| T-29 / T-21 / T-17 / T-23-T-24 | Guardia legacy corretta con limite di policy URL; D5 sul ripristino esplicito dopo purge già deciso. Header pubblico previsto e copie esterne non revocabili non sono automaticamente bug. | Verificare avviso/ripristino senza grant pregressi; isolare la sola policy URL ancora non risolta e mantenere espliciti i limiti delle copie esportate. |
| R10-NOTIFY / R10-AVATAR-SESSION / ARCHIVE-PARTIAL / HEALTH-CACHE / QR-OVERFLOW | Correzioni locali già documentate; il massimo notifiche 30 giorni è deciso e implementato. HEALTH-CACHE conserva un limite comunicato, non freschezza garantita. | Non ripetere correzioni concluse. Completare soltanto le verifiche integrate mancanti; consegna SMTP/FCM, volume e dispositivi sono evidenze distinte. |
| QR-VENDOR / VERSIONI / PDF / M6 / M10 | Limiti di audit, compatibilità e prove esterne; nessuna chiusura globale deducibile dalla suite. | Parità della candidata e prove pertinenti; Edge, dispositivi fisici, condivisione/scaricamento, audit indipendente e ambiente distribuito vanno dichiarati verificati o ancora aperti separatamente. |

### Primo raccordo dei writer con PURGE-CAS

Seguito: letto `company-profile-link.js` integralmente; legge la sorgente Azienda nella transazione del form, verifica contatto/identità/versione e restituisce patch/backlink. Non legge lo stato purge. `manageSharedVaultData` nel ramo link legge Account/link/widget oltre a dati e ricevute; `manageAccountWidget` legge Account/widget/ricevute. La presenza dell'Account in una transazione distinta non coordina la fase successiva di purge. I candidati account-note/account-standard/profile-link hanno letture Account e ricevute proprie: anch'essi devono partecipare al confine comune, non basta il controllo sessione UI.

Nuova caratterizzazione nell'handler purge: inserzione sintetica di accountWidgets oppure sharedVaultLinks dopo preflight e prima di recursiveDelete lascia riferimento presente, Account assente ed esito purged. Suite 8/8, NON correzione: copre interleaving iniettato, non esecuzione completa del writer concorrente o autorizzazione Rules. È un caso aggiuntivo di PURGE-CAS/T-08, non un nuovo ID duplicato.

Riesame executor multipasso di laboratorio: parametri scope/expected mantenuti per riferimento oltre await. Regressione con mutazione del chiamante inizialmente fallita PURGE_TARGET_INVALID; ora copie scalari congelate e validazione del token prima di I/O, prova separata mutazione token/scope superata. Modello+fixture 6/6, emulator multipasso 2/2 su demo-purge-fence: accettata soltanto questa correzione del laboratorio. Non attribuirla al purge applicativo o alla correzione dei riferimenti tardivi.

Aggiornamento successivo 04/10: separati i domini dopo lettura dei corpi. `applyOfflineMutation` scrive `syncRecords`, mentre il writer degli Account privati è `applyPrivateAccountMutation`: non contarli come due writer dello stesso bersaglio. Matrice dei confini riscontrati sotto; helper di collegamento, tutti gli editor e writer indiretti non sono ancora censiti integralmente.

| Percorso riscontrato | Letture/effetti osservati | Interleaving da verificare nella candidata |
| --- | --- | --- |
| form-privato-save / form-azienda-save | Transazione su Account e profilo opzionale; helper collegamento Azienda, inviti e notifiche nello stesso salvataggio. | Salvataggio dopo preparazione purge; aggiornamento dei riferimenti prima/dopo claim. Seguire helper prima di dichiarare copertura completa. |
| applyPrivateAccountMutation | Legge Account e ricevute corrente/legacy in transazione; distinto da syncRecords. | Replay e nuova mutazione a cavallo del claim, conservando versione e identità Account. |
| archive-account-service restore | Legge Account archiviato/revisione in transazione; commento esplicito che il CAS non coordina recursiveDelete. | Restore dopo preparazione: già riprodotto il difetto nell'handler; la candidata deve impedire l'effetto sulla versione ripristinata. |
| restoreBackupChunk / backup-import-service | Server legge ricevute e record del chunk; il client completa i chunk Firestore prima del ciclo uploadBytes. | Ripristino record e upload successivo durante purge; provare anche record invariato con byte mancanti. La separazione delle fasi è ancora presente nel codice principale. |
| dettaglio-privato-attachments / dettaglio-azienda-attachments | uploadBytes, ottenimento URL e addDoc dei metadati sono passaggi separati. | Nuovo figlio/oggetto dopo inventario, purge tra upload e pubblicazione, esito upload incerto. Nessuna garanzia distribuita dedotta dal controllo mount.active. |
| purgeArchivedAccount | Dopo preparazione: query attachments, delete Storage con ignoreNotFound e recursiveDelete, poi transazione conclusiva. | Il riesame finale non può recuperare byte/documenti già cancellati; occorrono versioni e protocollo comune prima degli effetti. |

App di prova identificata tramite pagina servita a 127.0.0.1:4188 e hub locale (Auth 9099, Firestore 8085, Functions 5001). Verifica UI nel browser integrato completata senza ripreparare emulatori: A login/unlock/profilo/lock/logout; B login/unlock con sole card B; reload ritorna anonimo e senza card. Accettazione limitata a questi percorsi della build già servita; hash/allineamento build-checkout, Edge, mobile, editor e race restano distinti. Dettagli in COLLAUDI.

Riscontri nel checkout, non elenco esaustivo dei writer: `functions/index.js` espone applyOfflineMutation, restoreBackupChunk e purgeArchivedAccount; quest'ultimo legge gli allegati e chiama delete Storage e recursiveDelete dopo la transazione di preparazione. `archive-account-service.js` documenta esplicitamente che il CAS del ripristino non coordina quel protocollo di purge. `form-privato-save.js` e `form-azienda-save.js` salvano con transazioni; gli allegati privati/aziendali usano uploadBytes seguito da addDoc. Questi sono confini distinti da portare nella matrice di interleaving; una transazione sul solo Account non prova coordinamento con byte e nuovi documenti figli. Il prossimo controllo deve seguire helper e chiamanti di queste entrate, inclusi backup-import-service, per accertare il read-set comune e le precondizioni su ogni effetto. Nessuna modifica ai writer effettuata in questo raccordo.

Ordine operativo: copertura writer/bersagli purge e verifica candidata RAM; in parallelo concettuale preparazione delle alternative M8 senza attivare nuova conservazione; poi protocollo cleanup e recupero MFA. Lingue, AI ed Excel restano rinviati. Il banco browser appena tentato non è partito perché le porte previste sono già occupate da emulatori locali: prima di ripeterlo identificare la sessione attiva o predisporre un banco realmente separato, senza sostituire Rules o fixture della sessione esistente.


## PURGE-DOCUMENT-LAB — riesame circoscritto, 04/10/2026

Accettabile solo per esperimenti isolati sul singolo documento: nessun endpoint/autenticazione, scoperta discendenti, copertura writer/riferimenti, Storage o rilascio barriera. Ricevuta controlla effectId derivato dal binding e applied, ma origine server-owned resta presupposto del laboratorio; hash non autentica input. Env/projectId non attestano trasporto di uno store arbitrario iniettato. Riesame trova token expected mantenuto per riferimento attraverso await: regressione rossa PURGE_BOUND_CONFLICT con mutazione del chiamante, poi copia scalare congelata e validazione stopRevision, suite SDK1/1 verde. Non dimostrata cancellazione indebita in app. Prove precedenti coprono stop/commit ordinati e contesa osservata stop-vincente, errore server atomico e risposta persa simulata; non equivalgono a guasti distribuiti reali. Prima di ampliare: negativi ricevuta alterata e guardie ambiente; poi contratto multipasso senza assumere nuova retention.

## M8-CHUNK-LAB — riesame circoscritto, 04/10/2026

Aggiornamento prove: commit locale8/8, binding3/3, suite SDK integrata1/1 nelle rispettive ultime esecuzioni (non nuovo run aggregato). Aggiunti rifiuto atomico server ALREADY_EXISTS, overwrite e valori tipizzati. Timestamp sub-microsecondo caratterizzato, non corretto; provenienza export tracciata fino a getDoc(s)FromServer e encoder che copia nanos. Non dimostrato caso nel backup normale né esclusi pending writes. Limiti byte provati solo in fixture. Candidato accettabile per proseguire esperimenti isolati, NON collegamento ai record users: resume persistente e fence purge restano prerequisiti globali.

Candidato interno con namespace separati, validazione comando esistente, mapping nel read-set e ricevuta prima di ogni replay. Prove descritte in COLLAUDI: binding/commit8/8 e suite Firestore integrata1/1 nell'ultima esecuzione precedente. Riesame trova array stage sparso accettato dall'helper binding (some saltava slot assente): regressione rossa, correzione e8/8 verdi. Non dimostrata scrittura indebita attraverso servizio stage, che rifiuta ID non valido; difetto corretto al confine helper. Accettazione non globale: projectId demo non prova da solo connessione emulata, API non autentica chiamante, ricevuta deve restare server-owned, types timestamp/bytes vanno iniettati per record tipizzati. rewriteHash descrive comando riscritto pre-autorità, non stato finale. Mancano rollback SDK su errore server, descriptor concorrente, limiti grandi chunk, preview/resume persistente, fence purge e integrazione browser/app. Nessun nuovo grant o rilascio.

## M8-READERS — consolidamento candidato, 04/10/2026

Sette suite mirate insieme 75/75 Node22: sessione, lettore, classificatore, piano/consumo export, handler HTTP, client streaming, servizio stage. Include collegamento signal della vista al fetch (trasporto sintetico) e prova separata fetch Node con risposta HTTP parziale reale interrotta. Accettazione limitata alle interfacce candidate e ai casi descritti in COLLAUDI, non all'app. Corretto nel riesame status HTTP controllabile dall'errore provider. Restano Firebase Auth/App Check effettivi, topologia same-origin browser, quattro consumatori reali, pubblicazione chunk/mapping/resume e purge distribuito. Nessun gate globale chiuso, nessun rilascio. Il client richiede signal della vista e controllo assertUnlocked catturato, non un flag globale riutilizzabile.

## M8-LAB-01 — confine verificato, 04/10/2026

Factory isolata fuori functions e non importata da index/runner, helper stage reale invariato. Pubblicazione transazionale di piano/descriptor/riferimento lab; lettura vincolata alla generazione e digest; replay e interruzioni nei limiti delle prove in COLLAUDI. Accettazione circoscritta al laboratorio, non al ripristino applicativo. Restano espliciti adattamento chunk, mapping completo dei riferimenti e lettori, operazione persistente di resume e coordinamento purge/cleanup. rewriteStorageData attuale sostituisce soltanto storagePath: non trasporta generazione; il client attuale pubblica chunk prima degli upload. Non collegare il candidato ai record attivi senza questi contratti e prove integrate.

## 04/10/2026 — consolidamento locale, non chiusura globale

WIDGET-RECEIPT-01: accettata la correzione backend nei percorsi verificati. Ricevuta vincolata all'intero comando normalizzato e UID, root server-only già prevista dalle Rules, legacy sola rifiutata; preservati requisito Account esistente, appartenenza widget e semantica bankId. Regressione 380/380 e ciclo privato/azienda Firestore emulato 1/1; riesame finale aggiunge prova di appartenenza prima del replay, handler 7/7. Il client consuma la risposta callable: non richiede letture legacy, ma nuovo tentativo UI genera nuova operationId e non beneficia del replay dello stesso comando. Non attestati HTTP/App Check reale, UI/Edge o backend del laboratorio ricaricato. Nessuna chiusura PURGE-CAS/M8/Vault.

I rilievi storici sotto restano riferiti alla loro data. Esiti aggiornati nei soli percorsi verificati; dettagli delle prove in [COLLAUDI](COLLAUDI.md).

| Ambito | Esito e limite attuale |
| --- | --- |
| RULES-INTEGRATION-03 | Corretta composizione candidata del laboratorio, incluse protezioni contro doppia negazione e perdita di denylist: 5/5 composizione e 11/11 SDK integrato (contenitore incluso). Rules base invariate; composizione non ancora installata nel laboratorio browser aperto. |
| PURGE riferimenti esterni | Preflight conservativo integrato per accountWidgets/sharedVaultLinks: riferimenti presenti o ambigui impediscono di procedere, anche in resume. Test handler e transazioni Firestore emulato verificati. Non è una soluzione CAS: una scrittura successiva al controllo rimane possibile e il test della perdita concorrente resta una caratterizzazione del difetto aperto. |
| SHARED-UNLINK-01 | Corretto e verificato il controllo reciproco link/widget e dell'intera identità Account. Coppie incoerenti rifiutate senza scritture; unlink orfano valido preserva dati condivisi e altri riferimenti. |
| SHARED-RECEIPT-01 | Corretto e verificato il binding del comando completo normalizzato alle ricevute root, con risultato esatto e rifiuto conservativo della sola legacy. Matrice emulata create/update/link/unlink/delete, replay e collisioni verificata; confine SDK/Rules root verificato. La ripetizione manuale UI genera una nuova operazione: non è coperta dalla garanzia di replay dello stesso comando. |

Regressione backend non-emulatore: 374/374; successivo irrigidimento del helper sulla revisione null verificato con 3/3 mirati. Le prove degli handler estratti e delle transazioni emulate non attestano HTTP, App Check reale o backend del browser ricaricato. Rimangono aperti integrazione Vault multipagina, M8 completo, PURGE-CAS e generazioni Storage, recupero 2FA, migrazione KDF, Edge/dispositivi/ambiente distribuito. Nessun rilascio o modifica di manifest.

27/09/2026 — seguito: export locali Account/profilo ora 4/13, nove ancora mancanti. Prove HTTP aggregate 72 (comprendono le precedenti 24 e 40), dettagli COLLAUDI. Corretti e riprovati due difetti di trasferimento legacy: perdita link privato e mancata rimozione della copia aziendale richiesta. I checkpoint 2/13 sotto sono storici. Restano bootstrap, VS-P0-01 e protocolli/global gate; nessuna riconciliazione complessiva dichiarata conclusa.

27/09/2026 — delta integrazione Account: applyAccountNoteMutation e applyAccountStandardMutation ora esportate nel backend locale, con 24 verifiche HTTP sugli emulatori. L'inventario precedente 13/13 mancanti è storico: restano 11 export mancanti, VS-P0-01 e parità multipagina. Non confondere disponibilità degli export con migrazione UI/Rules o attestazione App Check reale. Corretti anche controlli ricevuta e identità nella creazione candidata Account dal profilo (rosso/verde); quel percorso non è ancora esportato. Evidenze e limiti in COLLAUDI; riconciliazione globale ancora aperta.

27/09/2026 — M8 Storage: respinta immutabilità basata sul solo upload client; prova concorrente locale ha accettato entrambe le scritture. Namespace restoreObjects ora server-only nelle Rules locali. Helper server candidato con ifGenerationMatch:0 non integrato; probe Admin SDK ha mostrato la precondizione ignorata dall'emulatore installato. Il risultato negativo è in COLLAUDI, distinto da 10/10 dinieghi Rules e dai test del trasporto simulato. Nessuna chiusura M8/PURGE-CAS o nuova attestazione produttiva.

27/09/2026 — Recupero syncRecords: chiuso localmente il difetto di riuso non vincolato delle ricevute nei due handler trash/restore, aggiunto CAS della revisione nel restore e protezione del cestino occupato. Root mutationResults già non scrivibile dai client; legacy rifiutata senza riapplicazione. Prove reali Firestore emulato e limiti in COLLAUDI. I precedenti rilievi sul recupero legacy restano storici; PURGE-CAS, M8, MFA e integrazione Vault multipagina rimangono aperti e distinti.

## 27/09/2026 — delta R15/R16, non riconciliazione conclusa

Correzioni verificate: buffer temporanei allegati azzerati anche su errore; proprietario atteso su runRecoveryCommand. Quest'ultimo chiude il rilievo del comando nato nella vecchia sessione, NON certifica le ricevute legacy operationResults o il protocollo complessivo di recupero.

PDF master-only ora integrato selettivamente nel checkout (moduli, linguetta, asset, build/offline e guardie), senza merge. Non resta un porting integralmente mancante; restano prova del percorso completo Firebase nel browser, condivisione/scaricamento fisico e integrazione con la futura sessione RAM globale. Predicato isVaultUnlocked non chiude VS-P0-01: persistenza legacy invariata. R14 conferma PURGE-CAS aperto: processing non è un lock per writer che non lo leggono; delete Storage/recursiveDelete restano non atomiche. Riscontri e prove in COLLAUDI.

## 27/09/2026 — delta D5 e decisione R13

D5: corretto il ripristino automatico dei vecchi accessi Account nel vero handler, non solo caratterizzazione. CAS e ricevute idempotenti restano attivi; test con Rules verificano accesso negato al vecchio destinatario, conservazione di quello corrente attivo e neutralizzazione dei grant archiviati. Non estendere questo esito alla chiusura completa M8 o a tutti i domini di condivisione.

R13: la scelta sulle frequenze superiori a 30 giorni non è più pendente: Diego ha scelto massimo 30 con retention invariata. Validazione locale di configurazioni e salvataggi implementata; dati storici non migrati. Restano da verificare il percorso grafico di errore e gli invii distribuiti reali. Nessun test locale vale come prova SMTP/FCM o rilascio.

## Aggiornamento R12/R13 — 27/09/2026

Il raccordo allegati mancante descritto nell'inventario R10 sotto è ora presente nella entry locale: provider SDK, ponte autenticato e Storage candidato, con verifiche in COLLAUDI. Le due route upload/remove vivono nel nuovo modulo di composizione: il vecchio inventario regex dei tredici nomi non ne dimostra la parità produttiva. Non modificato il controllo per ottenere un esito verde. Bootstrap multipagina, chiave legacy ed export distribuiti restano aperti.

R13 integra nel backend locale recipientDeliveryLedger alla radice (client negati dalle Rules esistenti), claim transazionale e cadenza separata email/dispositivo push. Le precedenti caratterizzazioni dei doppi invii sono sostituite da prove di esclusione concorrente; retry parziale non reinvia destinatari riusciti. Identificativi SHA-256 opachi, soli stato/date/token casuale di tentativo; nessun indirizzo, token dispositivo o contenuto. Conservazione logica 30 giorni, pulizia giornaliera limitata a 500 record con rilettura, non promessa di cancellazione fisica puntuale sotto backlog/guasti. Migrazione conservativa: in assenza di voce individuale il vecchio marcatore globale vale soltanto da pavimento di cadenza, non da prova di consegna. Può rinviare i falliti pregressi fino alla prossima cadenza; evita reinvio generalizzato alla prima esecuzione.

Nuovo punto prodotto isolato, non risposta presunta: la configurazione ammette frequenze maggiori di 30 giorni, incompatibili con memoria individuale cancellata dopo 30 giorni. Per queste sole frequenze gli invii anticipati della candidata sono sospesi con codice esplicito; giorno della scadenza resta eleggibile. Scegliere se limitare tali frequenze a 30 giorni o conservare il minimo marcatore individuale fino alla cadenza configurata. Nessuna delle due scelte applicata implicitamente; nessun deploy. Restano invii incerti potenzialmente duplicati e modifiche dopo l'ultima lettura prima della chiamata esterna, non atomicità SMTP/FCM/Firestore.

## R10-INTEGRATION-INVENTORY — 27/09/2026

Inventario statico corrente eseguibile con `node scripts/audit-vault-integration.mjs`, fuori dal conteggio dei test verdi. Esito BLOCKED: 13 nomi callable richiamati da emulator-entry sono presenti nel ponte emulator-qr-bridge, ma nessuno dei 13 è esportato come onCall in functions/index.js del checkout. Coprono note/account standard, link/creazione account da profilo, anagrafica, contatti privati/aziendali, indirizzi privati/aziendali, utenze, documenti privati e selezione QR privata/aziendale. Non sono tredici bug della produzione: sono dipendenze mancanti per promuovere la candidata.

Ulteriori riscontri distinti: mountDocumentAttachments è previsto da profile-shell-view ma non fornito da emulator-entry; profilo_privato.html carica ancora main-v129.js; modules/core/vault-session.js conserva sessionStorage.setItem(WRAPPING_KEY). Confermato VS-P0-01 aperto. Il ponte emulato accetta una attestazione sintetica confinata a demo-vault-shell: non va copiato come middleware produttivo e non certifica App Check reale.

Il controllo usa pattern testuali dichiarati, non dimostra raggiungibilità o parità funzionale; anche l'assenza futura dei pattern richiederebbe revisione manuale. Non ispeziona servizi distribuiti. Non modifica manifest, protezioni, runtime o dati. Sequenza tecnica residua: collegare provider allegati nella candidata con repository/servizio confinati; predisporre e verificare adattatori callable con identità/App Check reali senza esportare il ponte sintetico; completare parità delle route e sostituzione multipagina; prove integrate prima di chiudere VS-P0-01. Nessuna di queste attività è dichiarata completata dall'inventario.

## RICONCILIAZIONE-10 — registro operativo, 27/09/2026

**In corso, non censimento esaustivo concluso.** Questo registro aggiorna i rilievi sotto senza cancellarne la storia. Un test verde di caratterizzazione conferma il comportamento problematico, non la conformità. Non sommare casi di test, cause e famiglie come se fossero difetti distinti. T-16 è indice dei residui T-09/T-26/T-27/T-28, non un ulteriore difetto. Le prove locali non attestano produzione. Priorità sotto: P0 sicurezza critica già classificata; P1 dati/sicurezza/conservazione; P2 affidabilità o rappresentazione; NV gravità da valutare con riproduzione. Non è una stima quantitativa del rischio.

| ID canonico / riferimenti | Stato e priorità | Evidenza e criterio di chiusura |
|---|---|---|
| VS-P0-01 — wrapping in sessionStorage | Aperto P0, integrazione architetturale | Riscontro corrente in core/vault-session.js: chiave persistita insieme alla sessione. Shell RAM sperimentale non equivale a sostituzione del runtime; chiusura richiede integrazione e prove dell'app completa secondo VAULT/SICUREZZA. |
| R10-NOTIFY — push destinatari/email concorrenti | Corretto nel backend locale per cadenze supportate; gate R13 aperti | Registro per destinatario/canale, transazioni, retry parziali e lease/crash verificati; Firestore emulato 5/5. Prove e limiti in COLLAUDI. Frequenze oltre 30 giorni sospese nella candidata in attesa della scelta retention/cadenza; SMTP/FCM distribuiti e volume cleanup non attestati. |
| T-08 — copie/link/inviti dopo purge | Residuo confermato, P1 | Banco shared-copies-purge corrente; cascata richiesta da D4 ma confini residui aperti. Verificare revoca e pulizia delle sole copie derivate, senza cancellare record autonomi. |
| T-09 — oggetti non elencati dal purge | Residuo documentato, P1 | INVENTARI e banchi emulatori storici; inventario per prefisso assente. Riproduzione corrente emulata e protocollo di pulizia confinato necessari; non contare nuovamente T-16. |
| T-26 — allegati scadenze/form azienda rimossi | Residuo confermato, P1 | attachment-removal-residues rieseguito: riferimenti rimossi, byte conservati; parte sorgente/modello, non tutti flussi UI. Chiusura richiede politica e gestione errori parziali, non solo delete aggiunto. |
| T-27 — hard-delete Azienda | Mitigato, protocollo 3B aperto, P1 | 27/09: guardia UI e Rules negano delete del padre anche diretto/in batch; emulatori Aziende 4/4 e Firestore 73/73. Non permane il vecchio deleteDoc UI non ricorsivo. Azienda vuota ancora bloccata: percorso server coordinato con Account/allegati/ripristino da completare; distinto dal purge Account aziendale e dai suoi residui. |
| T-28 — avatar orfani | Residuo confermato, P2 | Vecchio oggetto e upload parziale restano nel banco corrente. Pulizia non introdotta; scelta conservazione separata dalla correzione di sessione sotto. |
| R10-AVATAR-SESSION | Corretto localmente, P1; browser isolato verificato | UID, istanza del modulo, montaggio input e numero operazione ricontrollati dopo import/upload/URL/update; lock/pagehide invalidano il numero anche con UID invariato (prova rossa poi verde). Browser reale con upload/backend sintetici: cambio UID durante upload impedisce riferimento/cache, percorso positivo salva una volta. Non E2E Firebase; scrittura già inviata non revocabile, nessuna pulizia Storage implicita. |
| T-29 — apertura legacy | Guardia incorporata corretta localmente; policy legacy aperta, P1/P2 | Aggiunte guardie UID, lock, pagehide e generazione rendering al percorso incorporato. Dieci test dedicati superati, inclusi interruzioni durante chiave/lettura/decifratura, errore tardivo, rendering precedente e apertura cifrata positiva. URL legacy http/https senza Vault e senza allowlist restano una scelta aperta. Rettifica: ritorno nullo di window.open con noopener NON prova un popup bloccato; il test caratterizza un esito non osservabile, non un difetto accertato. |
| M8-PARTIAL — blocchi/byte e retry nuova sessione | Aperto P1, decisioni approvate il 27/09 | BACKUP/M8_RECUPERO: record prima dei byte, riferimenti senza oggetto, nuova sessione può saltare byte mancanti. Staging/verifica prima della disponibilità e ripresa selettiva anche nuova sessione approvati in DECISIONI; implementazione e prove integrate ancora necessarie. |
| PURGE-CAS — purge concorrente con restore/upload | Riprodotto con interleaving sintetico, P1 aperto | Handler reale: record modificato a revisione 2/non archiviato dopo preparazione a revisione 1 viene comunque eliminato da recursiveDelete e ricevuta marcata purged. Banco purge-profile-cleanup-handler 4/4, caratterizzazione NON correzione; mutazione concorrente iniettata, non prova del restore completo/Rules/emulatori. Serve protocollo comune; distinto da T-21 (backup DOPO purge). |
| T-21 — backup dopo purge | Scelta D5, non bug automaticamente | Ripristino storico ricrea dati purgati; definire significato del purge rispetto al backup prima di cambiare formato/semantica. |
| T-17 — header backup pubblico | Informativo / eventuale scelta formato | Contratto BACKUP prevede metadati pubblici; non contare come vulnerabilità dimostrata o segreti esposti. |
| T-23/T-24 — cache e copie esportate | Scelte D10/D11 e limiti, non due bug automatici | Banchi correnti; file esterni non ritirabili. Titolo del test che pretendeva attestare app distribuita rettificato: scansiona soltanto indicatori nel checkout locale. PDF master separato non escluso dalla prova. |
| M7-D1 — archivio due anni/avviso dieci giorni | Modello locale verificato, integrazione non conclusa | Modello isolato 25/25 copre calendario, avviso tardivo/assente, riarchiviazione, ambito aziendale e marker temporali malformati; regressione Archivio 117/117. Restano registrazione/notifica reale, scheduler, D8 e protocollo purge sicuro prima di attivare cancellazione automatica. |
| ARCHIVE-PARTIAL | Corretto localmente P2; prova browser isolata superata | Sorgente fallita interrompe il risultato aggregato; ricerca non sovrascrive caricamento/errore. History 110/110. Due scenari browser con DOM e moduli reali, backend sintetico e rete disabilitata: errore persistente durante ricerca, nuovo caricamento riuscito. Non E2E Firebase. Nessuna modifica ai dati o alla retention. |
| HEALTH-CACHE | Limite riprodotto; avvertenza verificata nel browser isolato | La prova sintetica conferma fallback cache dopo errore server senza metadati di freschezza. Il renderer reale mostra che possono mancare modifiche di altri dispositivi; Escape chiude e ripristina il focus nel banco senza backend. Non collaudo screen reader o pagina completa. Nessuna modifica alle letture, nessuna certificazione di freschezza; salute 12/12 include una caratterizzazione del limite. |
| MFA-CONSUME | Parziale locale; gate concorrente ancora aperto | La caratterizzazione storica del consumo anticipato è coperta dalla prenotazione: errore Auth conserva il codice, risposta persa viene riconciliata, concorrenza consuma una sola volta e la ripresa scade fail-closed dopo 15 minuti. I fattori non TOTP già letti bloccano il percorso, ma un nuovo fattore nel gap Auth può ancora essere rimosso da `enrolledFactors:null`. Test VM/emulatore sintetici; Auth reale, account eliminato/ricreato, rollout e audit restano aperti. |
| DEADLINE-SCAN | Limite statico confermato, capacità NV | checkDeadlines legge tutti gli utenti e scadenze incomplete sequenzialmente entro timeout configurato di 120 secondi. Non confondere con cursori auditRetention; nessuna misura di volume/timeout reale eseguita, quindi nessuna soglia di capacità certificata. |
| KDF-LEGACY | Rilievo di audit, NV | crypto-utils usa ITERATIONS=100000 per campi, distinto da KEK/verifier600000; migrazione formato da progettare/verificare. Non modificare parametri rendendo illeggibili dati precedenti. |
| QR-VENDOR | Sink confermato, sfruttabilità non dimostrata | Fallback tabella del bundle eseguito in VM con payload HTML ostile: testo convertito in moduli, assente dall'HTML; colori costanti nei chiamanti esaminati. Non equivale ad audit completo del vendor né copre opzioni arbitrarie/non attendibili. |
| QR-OVERFLOW | Corretto localmente P2 | Entrambe le utility chiamavano showToast non definito dopo doppio fallimento del renderer. Test prima rosso (ReferenceError), poi verde: mantenuto messaggio inline senza dipendenza globale. Nessun cambio al formato QR. |
| VERSIONI / PDF / M6 / M10 | Gate distinti dai difetti | Compatibilità fail-closed non interoperabilità; PDF master da preservare; Web Locks/cache espulsa, dispositivi, audit indipendente, enforcement e configurazione distribuita non chiusi dai test locali. |

**Rilievi corretti già registrati, non da ricontare tra aperti:** D3 sentinelle e scritture dopo decrypt fallito; D1 scrittura dal rendering; N1 notifiche revoca nel perimetro approvato; proiezione promemoria; HTML email; calendario italiano/DST; retry totale destinatari. Rinvio alle accettazioni datate in STATO/COLLAUDI: non estendere quelle accettazioni a scenari esclusi.

**Ritirati, non difetti residui:** export del banco profilo, readBytes, adattatore checkCurrent, biometria e D2 come già motivato nella revisione accettata. Non ripetere revisione578.

DeepSeek consultato tramite UI Harness accessibile, Read Only invariato, soltanto per schema di classificazione in chat; nessuna nuova lettura repository o prova attribuita al consulente. Astra mantiene evidenze e accettazione. La risposta proponeva separare scelte/non-difetti: applicato con cautela, una scelta pendente non cancella un rischio confermato.

## Accettazione della revisione statica — 25/09/2026, 07:47 Europe/Rome

Astra accetta la revisione e la riconciliazione nel perimetro e con i limiti del checkpoint rettificato sottostante. Esito applicativo: **MODIFICHE/VERIFICHE RICHIESTE, integrazione e rilascio NON APPROVATI**. Accettare la consegna non significa approvare il prodotto: restano tutti i rischi e gate elencati, compresi D1/D3, compatibilità versioni e collaudi non eseguiti. Nessuna garanzia di assenza assoluta di errori.

Ultimo riscontro diretto in sola lettura: HEAD invariato `2900ccc0bbd83997de8e50d260b1868f33bc5e38`, categorie Git 59/37/312/22/87/55/6 (578), divergenza dai riferimenti remoti locali 435/2 e 133 verso il secondario. Nessun fetch: non si attesta che GitHub non sia cambiato nel frattempo. Sessione DeepSeek ferma dopo consegna, non bloccata. Controlli documentali dell'ultimo aggiornamento: 31 MD, 606 collegamenti, 11/11. La fase di revisione termina qui; nessun incarico di implementazione, commit, merge, push o deploy avviato. Il controllo periodico va messo in pausa secondo l'ordine di Diego.

## Relazione DeepSeek rettificata — 24/09/2026, 22:22 Europe/Rome

Ricevuta la relazione e la proposta documentale; accettazione finale Astra ancora pendente. Il diff `0ba2332b..2900ccc0` è riconciliato in 578 percorsi disgiunti: Frontend 59, functions 37, experiments 312, scripts 22, tests 87, docs 55, altri 6. Natura delle evidenze: letture dichiarate integrali per Frontend/functions/scripts/tests; experiments 310 testi e due font solo metadati; docs 55 fonti storiche mappate sui metadati di conservazione 71 fonti/82 segmenti del riordino locale 31 MD; altri cinque testi integrali e solo diff completo del lockfile. Non si dichiarano 575 testi nuovamente letti: il mapping documentale riusa le precedenti verifiche canoniche. I 435 commit esclusivi del ramo, 133 non pushati rispetto al remoto secondario e due master-only PDF sono un asse distinto dai percorsi. Nessun rilascio o integrazione.

Prove correnti Astra già eseguite: functions-security 220/220, data-access 95/95, navigation 146/146, 129 casi mirati sovrapposti, profile-contact-link 65/65, documenti 11/11, impronte 7/7 e 71/71 fonti canoniche. Non sommare gruppi sovrapposti. Le attestazioni storiche di emulatori e suite da 2042 casi non sono esecuzioni correnti. Nessuna suite completa, emulatore, prova fisica o integrazione PDF eseguita in questa revisione.

Riscontri rettificati: D1 (array `sharedWith` nel writer aziendale) e D3 (sentinella di decifratura reinserita nei campi e ricifrabile dal salvataggio) sono rischi statici preesistenti secondo il confronto DeepSeek base/master. Astra ha riscontrato direttamente il writer `dettaglio-azienda-sharing.js:187-192` e la catena privata `form_account_privato.js:435-453` → `form-privato-save.js:84-90`; non ha eseguito il salvataggio. D3 comporta rischio di sostituzione del dato cifrato, non certezza di perdita irreversibile senza verifica delle copie disponibili. Notifiche: sette istruzioni client rimosse in cinque moduli, non cinque istruzioni; tipo `share_revoked`, nessun sostituto per la condivisione dimostrato. Non ripristinare scritture client cross-user. `runRecoveryCommand` riguarda cestino/ripristino syncRecords, non MFA né backup: path confinati a `request.auth.uid`, senza confronto owner atteso; nessun chiamante frontend trovato, scenario cambio UID non dimostrato. Astra ha riscontrato direttamente questa distinzione nel corpo del comando.

Restano DA_VERIFICARE le quattro osservazioni di index (interpolazioni HTML email, concorrenza scadenze, consumo codice MFA, scansione checkDeadlines), senza promuoverle a nuovi bug. Restano aperti compatibilità expectedOwnerUid/vecchia PWA e rollout/rollback, purge contro restore CAS distinto dal ripristino dopo purge, staging/compensazione backup, allegati, conservazione hook/asset PDF master insieme alle guardie offline del ramo, prove fisiche e audit indipendente. Ritirati i falsi rilievi export test profilo, readBytes, adattatore checkCurrent, biometria e revisione aziendale D2. AI/vocale precede la revisione finale lingue, ma entrambe restano rinviate. La proposta DeepSeek recava erroneamente 25/09: questo checkpoint è del 24/09/2026.

## Supervisione periodica — 24/09/2026, 20:34 Europe/Rome

Consegna profilo non accettata nelle conclusioni: il presunto export mancante di `createLinkedAccountPassword` non impedisce il test. `loadController` in `tests/profile-contact-link.test.mjs:20` costruisce una funzione con il sorgente e restituisce i nomi dal medesimo scope, incluse dichiarazioni locali prive di export ESModule. Astra ha eseguito il solo file interessato: **65/65 passati**, incluso il caso contestato. I 16 test dichiarati dal rapporto non corrispondono ai casi espansi dai cicli; richiesta rettifica, nessuna correzione al prodotto. Letture del bundle restano avanzamento parziale, non certificazione globale.

Nella stessa sessione assegnata lettura completa dei file PDF master-only e innesti runtime/HTML/CSS/build/offline/test dai blob master, con inventario per path/ref e confronto al ramo. Running verificato. Nessun merge, commit, push o deploy; laboratori e riconciliazione residui.

## Supervisione periodica — 24/09/2026, 20:32 Europe/Rome

DeepSeek ha consegnato i sei test offline: lunghezze verificate da Astra 280, 220, 295, 124, 218, 96, totale 1.233 righe. Riscontro mirato di `tests/pilot-lease-worker.test.mjs:279` fino a fine file: lease occupato impedisce ingresso pagina e rilascio consente acquisizione. Il rapporto distingue trasporto simulato, IndexedDB in memoria e Worker pilotato direttamente; nessun nuovo difetto dimostrato, nessuna certificazione dei gate emulatore/dispositivo. Accettato avanzamento di lettura, non revisione globale. Rilievo `readBytes` ritirato esplicitamente; altre fragilità del banco non approvate senza prova.

Prosecuzione nella stessa sessione, Running verificato: tre test profilo indicati in INCARICO_CORRENTE e runtime pertinente, confronto requisiti/asserzioni/diff in sola lettura. Inventario complessivo ancora da riconciliare, PDF/laboratori successivi. Nessun codice applicativo modificato o comando Git mutante.

## Supervisione periodica — 24/09/2026, 20:27 Europe/Rome

DeepSeek ha consegnato la lettura dei nove test backup/cancellazione assegnati alle 20:24. Astra ha riscontrato le lunghezze dei nove file (153, 141, 115, 171, 168, 263, 254, 597, 295: totale 2.157 righe) e le asserzioni del retry da nuova sessione: il banco descrive il riferimento senza byte già documentato, non una nuova regressione. Nessun emulatore eseguito e nessuna attestazione complessiva. Respinto il rilievo di iniezione `readBytes` silenziosamente inefficace: `backup-restore-session.test.mjs` verifica numero e dimensione delle slice, asserzioni omesse dal rapporto. Richiesta rettifica senza modifiche ai file.

Nella stessa sessione «Collaudo runner e laboratori ramo» assegnati i sei test residui offline: `offline-mutation-client`, `offline-mutation-sync`, `pilot-lease-worker`, `private-account-offline-pilot`, `mixed-current`, `offline-profile-readiness` (tutti sotto `tests/`, suffisso `.test.mjs`). Presa in carico Running verificata. Nessun codice modificato né operazione Git di scrittura; profili/PDF/laboratori e riconciliazione globale ancora aperti.

## Verifica intermedia runtime — STABILIZZAZIONE-04 fase 2, 24/09/2026

La prima consegna DeepSeek è **parziale e non accettata come revisione completa**. Richiesto nello stesso canale il completamento dei diff runtime mancanti e la correzione delle conclusioni non provate: distribuzione Hosting insufficiente a garantire aggiornamento delle PWA offline; assenza di prove non deducibile senza leggere i test esistenti; marker legacy `null` accettato non equivale a obbligo di scriverlo; filtro `pull_request` riferito al ramo di destinazione. Nessuna patch applicativa deriva dal rapporto preliminare.

Astra ha eseguito indipendentemente sul working tree locale, senza Firebase o dati reali:

- `node --test functions/test/*.test.js`: **220/220**, zero falliti, saltati o cancellati.
- `node --test tests/vault-session.test.mjs tests/vault-logout.test.mjs tests/vault-session-races.test.mjs tests/backup-header-cleartext.test.mjs tests/backup-import-model.test.mjs tests/backup-restore-session.test.mjs tests/account-widget-session.test.mjs tests/shared-credential-update-session.test.mjs tests/archive-session.test.mjs`: **129/129**, zero falliti, saltati o cancellati.

Sono prove unitarie mirate, non la suite completa, non una prova di integrazione con i due commit PDF, né collaudi emulatori/dispositivi/produzione. La fase 2 resta attiva; nessuna autorizzazione al rilascio e nessuna operazione Git di scrittura eseguita.

**Riesame 2A concluso, accettazione complessiva ancora sospesa.** DeepSeek ha ritirato i falsi allarmi su test dell'anteprima assenti, marker `null`, revoca con ciclo malformato, sessione biometrica, pulizia dei nodi aziendali e variabili dichiarate dopo la definizione delle callback. Anche la presunta catena CI rotta è ritirata: Astra ha letto `scripts/run-restore-stale-emulators.mjs`, che avvia esplicitamente gli emulatori tramite il CLI locale; lanciare direttamente il test senza wrapper non dimostra un guasto CI. Questo controllo statico non equivale a esecuzione riuscita della CI.

**Residui reali da valutare, non nuove approvazioni:** incompatibilità client/backend nelle due direzioni (vecchie PWA senza proprietario atteso; nuovo ripristino che richiede la nuova anteprima), race purge/ripristino già documentata, integrazione completa PDF master. Astra ha inoltre riscontrato in `runRecoveryCommand` l'assenza del legame con il proprietario atteso: le scritture sono confinate all'UID autenticato, quindi non è dimostrato accesso a un altro utente; resta da valutare il comando nato in una sessione precedente. Il diff dei moduli di revoca mostra la rimozione della scrittura client della notifica all'ospite e il rinvio a un backend dedicato: va distinta dall'effettiva revoca dell'accesso e non viene reinserita una scrittura cross-utente. Nessuna patch applicativa accettata sulla base di questi soli rilievi.

**Bundle 2B avviato separatamente:** inventario e verifica di test, runner, laboratori e residui HTML/PDF. La sessione DeepSeek «Revisione runtime e compatibilità STABILIZZAZIONE-04» conserva il rapporto 2A con le rettifiche; i primi rapporti non vanno riutilizzati senza tali rettifiche. La copertura completa dei 578 file cumulativi non è ancora attestata.

**Esito 2B dopo il giro consolidato: NON ACCETTATO come completo.** La sessione «Collaudo runner e laboratori ramo» ha rettificato le false conclusioni su CI committata, symlink, ordine client-first e assenza di conflitti. La migrazione locale deve includere atomicamente i suoi script, test e dipendenze: questo non dimostra che HEAD sia già rotto. Il rapporto finale dichiara ancora 454 corpi di test non letti; la tabella contiene voci NON_LETTO ma il riepilogo dice zero non esaminati, e il conteggio dei LETTO non è riconciliato. Non si adottano percentuali, conteggi o attestazioni di copertura di quel rapporto. I 312 file di laboratorio restano da completare; il limite di esecuzione `spawn EPERM` dichiarato da DeepSeek non dimostra l'impossibilità di leggere i file residui.

**Verifiche Astra aggiuntive:** `npm run test:functions-security` passa sintassi, lint e 220/220 test; `npm run test:data-access` passa audit e 95/95; `npm run test:navigation` passa audit e 146/146. Questi gruppi si sovrappongono ai 129 casi mirati sopra: non sommare le esecuzioni come test unici. Non eseguita la suite completa o un emulatore. Nessuna sicurezza generale degli emulatori certificata dalla sola configurazione XDG o dal nome di progetto.

**Punto di ripresa:** nessun worker sta ancora lavorando dopo queste consegne. Servono inventario univoco dei file già letti e lettura integrale dei residui di test/PDF/laboratorio, prima dell'accettazione della fase 2. Le fasi 3–5 sono inoltre bloccate dai permessi della sessione: `.git` è in sola lettura; nessun tentativo di scrittura o aggiramento tramite altri canali. L'obiettivo complessivo non è raggiunto.

<a id="impronte-canoniche-24092026"></a>

## Impronte canoniche e provenienza — STABILIZZAZIONE-04 fase 1

**Accettazione Astra, 24/09/2026.** La mappa conserva senza modifiche tutte le impronte originarie `sourceSha256` e aggiunge, per ciascuno degli 82 segmenti, `sourceBlob` e `sourceSha256Bytes`: OID e SHA-256 dei byte esatti del blob alla base dichiarata. I campi globali `hashAlgorithm: sha256` e `hashInput: git-blob-bytes` rendono esplicita la ricetta. Nessuna normalizzazione del testo nel controllo canonico; nessuna modifica al manifest o ai 31 percorsi.

**Prova d'archivio.** Astra ha letto solo le entrate pertinenti del pacchetto locale, senza estrarlo né modificarlo. Le copie sotto `codex-session/work/App-Codici-Password/docs/` riproducono esattamente le impronte originarie di cinque fonti; normalizzando CRLF in LF, il loro testo è identico al blob Git. La causa provata è la presenza di fine riga misti:

| Fonte | Righe terminate CRLF / totale newline | Esito |
|---|---|---|
| AUDIT_VAULT_SESSION_P0.md | 6 / 945 | Impronta originale riprodotta; testo uguale a Git |
| DATA_ACCESS_CONTRACT.md | 90 / 93 | Impronta originale riprodotta; testo uguale a Git |
| M10_HARDENING_RILASCIO.md | 95 / 98 | Impronta originale riprodotta; testo uguale a Git |
| PIANO_AUDIT_COMPLETO_PROGETTO.md | 209 / 212 | Impronta originale riprodotta; testo uguale a Git |
| VAULT_KEY_CONTRACT.md | 165 / 168 | Impronta originale riprodotta; testo uguale a Git |

La copia archiviata di PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP ha 647 righe, contro 741 alla base Git; non riproduce l'impronta storica della mappa. La causa di **questa sola impronta storica resta indeterminata**. Il documento Git è invece interamente coperto e la sua nuova impronta canonica è verificata: nessuna fonte è esclusa, nessun hash storico viene cancellato o corretto per supposizione.

**Controlli eseguiti da Astra dopo adattamento della proposta DeepSeek:** `node scripts/verify-map-fingerprints.mjs` → **71/71 canonicali, 82 segmenti, 28 target mappati** (sottoinsieme dei 31 MD). Classificazione del solo confronto legacy RAW/CRLF: 33 RAW, 32 CRLF, 6 OTHER; cinque OTHER sono spiegati dalla prova d'archivio sopra, uno resta incerto. `node --test tests/docs-source-map.test.mjs` → **7/7** su repository Git sintetici temporanei: OID/hash, campi mancanti, metadati discordanti, buchi iniziali/intermedi/finali, sovrapposizioni, fonte/base inesistente e codici d'uscita. Il validatore non scrive, non accetta override della base da ambiente e fallisce sui metadati canonici errati. Comandi separati; i controlli documentali esistenti non sono indeboliti.

**Limite aggiornato:** il confronto dei contenuti precedentemente accettato resta valido. La provenienza canonica di tutte le fonti è ora riproducibile; non si certifica l'origine del vecchio hash della roadmap profili. Nessuna approvazione applicativa o al deploy deriva da questa fase.

<a id="conservazione-contenuti-24092026"></a>

## Conservazione dei contenuti 71→31 — 24/09/2026

**DOC-31-CONTENUTI-03: confronto dei contenuti accettato da Astra nel perimetro sotto.** DeepSeek ha proposto il confronto e la patch tramite il canale browser autorizzato; Astra ha respinto conteggi non riproducibili, l'inversione dell'ordine AI/lingue e il falso allarme sui log mancanti. Le affermazioni iniziali del rapporto non sono evidenze accettate. Per il rischio di alterare requisiti di sicurezza è stata estesa la verifica locale. Nessun nuovo MD, codice applicativo, commit, push, merge o deploy.

**Base e metodo.** Letti da Git i testi completi delle 71 sorgenti a `2900ccc0bbd83997de8e50d260b1868f33bc5e38`, nei 82 intervalli della mappa. Confrontate tutte le righe non vuote prima con il target assegnato, poi con gli altri target. Normalizzazione limitata a NFC, livelli delle intestazioni, ancore HTML, prefisso di citazione, destinazione dei link (etichetta conservata) e spaziature. Punteggiatura, numeri, date, negazioni, enfasi e maiuscole non eliminate. La ricerca testuale è un filtro delle differenze: non dimostra da sola ordine logico, autorità o equivalenza semantica. Le differenze sono state lette e riconciliate come segue.

**Risultato prima della patch:** 14.890 righe = 14.789 nel target + 61 altrove + 40 differenze. **Dopo il ripristino della tabella storica:** 14.890 = 14.799 nel target + 61 altrove + 30 differenze editoriali spiegate. **69/69 deduplicazioni:** ogni paragrafo completo alla destinazione `evidence` è presente nel testo originale della sorgente; nessuna perdita dei resoconti di test presunta dal solo mancato ritrovamento nel REGISTRO.

| Differenze dalla base Git | Riscontro e motivazione |
|---|---|
| 14 intestazioni, riga 3 delle raccolte M6/M7/M8/M10 | «Stato alla raccolta originale» conserva domanda, data e provenienza; evita che la vecchia etichetta aperta annulli decisioni successive. |
| 2 righe di M7_CRONOLOGIA_CESTINO_AUDIT, 17 e 116 | CANCELLAZIONE distingue purge manuale attuale da politica automatica richiesta; mantiene 24 mesi per auditEvents, esclusione delle altre famiglie e successione D1. Nessuna nuova autorizzazione a cancellare o distribuire. |
| 10 righe di REGISTRO_DECISIONI, 162, 223, 228, 242, 244–248, 255 | DECISIONI distingue la finestra audit dalla politica D1, spiega le formulazioni storiche, indicizza C1/C2 e C3, conserva le altre voci da indicizzare e lega i vecchi riferimenti alla base Git. Non chiude i gate applicativi. |
| 4 righe di STATO_CORRENTE_M0_M10, 4, 78, 104, 106 | Nuovo indice autorevole, successioni M7 esplicitate e inventario aggiornato; restano separati deciso, implementato nel ramo e distribuito. |
| 10 righe della tabella di PIANO_MATURITA_PROFESSIONALE, 292, 294–301, 303 | Tabella e cinque riferimenti ripristinati integralmente in [PROGRAMMA](../progetto/PROGRAMMA.md#confronto-originario-conservato), accanto al riesame già presente. La proposta DEK per record e i budget/misure prestazionali restano espliciti; nessuna proposta viene promossa a decisione. Queste dieci differenze non restano nell'esito successivo alla patch. |

Le nove correzioni editoriali elencate nella mappa sono riscontrate nei contratti CANCELLAZIONE, nelle voci M6 di DECISIONI, nelle successioni di STATO/DECISIONI, nella natura storica del REGISTRO, nelle intestazioni delle domande e nella regola dei riferimenti di LEGGIMI. M0–M10 non vengono riaperti o chiusi da questa verifica. L'ordine resta quello di [ASSISTENTE_APP](../sviluppo/ASSISTENTE_APP.md): stabilizzazione/coerenza dei dati, assistente e relativi collaudi secondo i gate, **lingue e riordino finale delle Impostazioni per ultimi**. Nessuna nuova indagine di mercato svolta in questo incarico: si conserva e confronta il materiale preesistente.

**Tredici estratti.** Riutilizzata la riconciliazione del 23/09 nel [REGISTRO](../storico/REGISTRO.md#riconciliazione-dei-tredici-resoconti-locali-del-1213-settembre-2026), con le tredici fonti nominate, i contenuti operativi e le destinazioni. Non dichiarata una nuova estrazione integrale o una nuova verifica SHA dell'archivio in questo incarico.

**Limite delle impronte.** I campi `sourceSha256` sono riprodotti per 65/71 sorgenti: 33 sui byte Git, 32 convertendo LF in CRLF. Non riprodotti per AUDIT_VAULT_SESSION_P0, DATA_ACCESS_CONTRACT, M10_HARDENING_RILASCIO, PIANO_AUDIT_COMPLETO_PROGETTO, PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP e VAULT_KEY_CONTRACT. Non è stata dimostrata la causa e non vengono corretti o certificati per supposizione. Questi sei testi sono comunque compresi nel confronto diretto con Git; il limite riguarda l'impronta della mappa, non sei documenti saltati. Prima di usare la mappa come attestazione crittografica completa occorre riconciliare tali metadati. Nessuna garanzia generale di assenza di errori, né approvazione all'integrazione o al rilascio.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Raccolta di evidenze datate. I rapporti descrivono i commit e gli ambienti originali: non sono contratti nuovi né autorizzazioni. I rilievi ancora aperti restano visibili in STATO. Le proposte nei rapporti non diventano decisioni.

**VS-P0-01 resta aperto in produzione secondo le fonti disponibili**: non è stato eseguito un nuovo controllo dell’ambiente distribuito. M6 richiede ancora prove fisiche/PWA e adozione; M8 resta sospeso in attesa dei chiarimenti registrati. La revisione privacy è preliminare. Per decisioni M7 successive usare DECISIONI, non l’elenco storico delle domande nei rapporti.

## Indice delle fonti conservate

- [APP_ARCHITECTURE_AUDIT.md](#fonte-docs-app-architecture-audit-md-l1)
- [AUDIT_PROGETTO_FASE2_STATICO.md](#fonte-docs-audit-progetto-fase2-statico-md-l1)
- [AUDIT_VAULT_SESSION_P0.md](#fonte-docs-audit-vault-session-p0-md-l1)
- [M10_REVISIONE_LOCALE.md](#fonte-docs-m10-revisione-locale-md-l1)
- [M10_REVISIONE_PRIVACY_PRELIMINARE.md](#fonte-docs-m10-revisione-privacy-preliminare-md-l1)
- [M6_SINCRONIZZAZIONE_OFFLINE.md](#fonte-docs-m6-sincronizzazione-offline-md-l94)
- [M8_BACKUP_RECUPERO.md](#fonte-docs-m8-backup-recupero-md-l65)

<a id="fonte-docs-app-architecture-audit-md-l1"></a>

## Fonte: APP_ARCHITECTURE_AUDIT.md — righe originali 1–118

> Provenienza: `docs/APP_ARCHITECTURE_AUDIT.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-app-architecture-audit-md-audit-architettura-e-inventario--codici--password"></a>

## Audit architettura e inventario — Codici & Password

> Stato: revisione sorgente completata sul branch di audit. Collaudo automatico superato; pubblicazione non eseguita.

<a id="fonte-docs-app-architecture-audit-md-obiettivi-e-invarianti"></a>

### Obiettivi e invarianti

- Conservare comportamento, dati, sicurezza, UI e funzionamento offline.
- Ridurre richieste, file duplicati, codice morto e responsabilità sovrapposte.
- Non rimuovere alias o pagine storiche finché ogni riferimento interno, cache e compatibilità non è verificato.
- Eseguire la suite completa dopo ogni gruppo di modifiche.

<a id="fonte-docs-app-architecture-audit-md-architettura-verificata"></a>

### Architettura verificata

<a id="evidenza-ebb42db6fc18555065df"></a>

L'applicazione è una PWA multipagina ospitata da Firebase Hosting. Le pagine protette caricano
`main-v129.js`, che inizializza componenti condivisi, autenticazione, Vault, timer di inattività,
notifiche/inviti e poi importa dinamicamente il modulo della pagina tramite `pages-init.js`.
La pagina di accesso usa il bootstrap più piccolo `login-entry.js`.

L'audit dedicato dell'Agente locale, il suo confine dati e la roadmap verso conoscenza per pagina,
ricerca semantica e modelli locali opzionali sono definiti in `AGENTE_CODEX_EVOLUZIONE.md`.

<a id="evidenza-6f9778cdf16e6a5b2772"></a>

Firestore usa come radice `users/{uid}`. I dati personali sono nelle sottocollezioni `accounts`,
`aziende`, `scadenze`, `contacts` e `settings`; gli account aziendali sono sotto
`users/{uid}/aziende/{aziendaId}/accounts`. Gli inviti sono documenti top-level in `invites` e
la loro accettazione è convalidata dalla Cloud Function `respondToInvitation`. Allegati e avatar
sono in Storage sotto `users/{uid}/...`. Gli allegati della Vault vengono cifrati lato client.

<a id="evidenza-98576e0351f5d09622f6"></a>

Il service worker applicativo `sw.js` precarica una shell minima e mette in cache a runtime le pagine
visitate e gli asset same-origin. Il worker Push `firebase-messaging-sw.js` è separato, usa lo scope
esplicito `/firebase-cloud-messaging-push-scope` e non importa `sw.js`. Firestore mantiene inoltre una
cache locale persistente multi-tab. Cache della shell, cache dati e messaggistica hanno quindi
responsabilità distinte.

<a id="evidenza-f3141d86341ded6c20c1"></a>

`sw.js` non inizializza più Firebase Messaging e non gestisce notifiche: questa responsabilità è
esclusiva del worker Push. Il runtime online del listener in primo piano viene caricato soltanto sui
dispositivi che risultano localmente abilitati; il primo controllo migra in modo conservativo le
registrazioni precedenti.

<a id="fonte-docs-app-architecture-audit-md-flussi-principali-verificati"></a>

### Flussi principali verificati

1. Login: `login-v115.html` → `login-entry.js` → `modules/auth/login.js` → `auth.js`.
2. Avvio protetto: pagina HTML → `main-v129.js` → auth observer → `pages-init.js` → modulo pagina.
3. Vault: `security-manager.js` coordina verifier, envelope, WebAuthn e `vault-session.js`.
4. Privato: area/lista → dettaglio → form; dati in `users/{uid}/accounts`.
5. Azienda: lista → dati azienda → account/dettaglio/form; dati sotto `aziende/{aziendaId}`.
6. Scadenze: lista/dettaglio/form + configurazioni; notifiche generate dalle Cloud Functions.
7. Condivisione: invito top-level → validazione server → UID destinatario aggiunto all'account.
8. Push: `push-messaging-client.js` registra il worker dedicato e il device in `pushDevices`; il worker gestisce messaggi e deep link senza prendere il controllo della navigazione PWA.

<a id="fonte-docs-app-architecture-audit-md-evidenze-e-decisioni-conservative"></a>

### Evidenze e decisioni conservative

- Nessuna dipendenza circolare: il grafo è passato da 90 a 82 moduli analizzati.
- Il font Material Symbols pesa circa 3,7 MB ed è il maggiore asset applicativo.
- I CSS delle tre configurazioni scadenze e quelli degli account condividono molte regole, ma
  unirli ora aumenterebbe la superficie di cascade e potrebbe caricare regole inutili sulle singole
  pagine. La duplicazione è quindi documentata e rinviata alla futura revisione UI, quando potrà
  essere verificata visivamente senza alterare la livrea corrente.
- Gli entry point segnalati come “orfani” dal grafo non sono automaticamente codice morto: molti
  sono caricati direttamente dall'HTML o tramite import dinamico.
- I laboratori Home e i quattro redirect versionati sono stati rimossi dalla superficie pubblica e
  conservati in `archive/home-experiments/`; il runtime espone soltanto le 29 pagine ufficiali.
- Firebase Messaging resta sulla versione 12.18.0 già adottata: un downgrade alla 11.1.0 può rendere incompatibile lo schema IndexedDB locale. Le importazioni CDN sono ammesse soltanto nel worker Push isolato; il worker della shell rimane same-origin.

<a id="fonte-docs-app-architecture-audit-md-ottimizzazioni-applicate"></a>

### Ottimizzazioni applicate

- Rimossa la vecchia API generica `db.js` (18 export, 16 inutilizzati). Le sole due operazioni
  ancora necessarie, lettura ed eliminazione di una scadenza, sono ora locali al relativo modulo
  e mantengono esattamente gli stessi percorsi Firestore.
- Rimossa la classe `VaultSearchIndex`, mai caricata dal runtime e sostituita dal più completo
  `VaultConversationEngine`; il test ora esercita soltanto il motore realmente usato dall'app.
- Corretto il deep link dell'assistente per le aziende da una pagina inesistente alla pagina
  canonica `dati_azienda.html`.
- Eliminati quattro moduli alias privi di logica (`components.js`, `components-v126.js`,
  `ui-core.js`, `env.js`) dopo avere convertito tutti gli import ai moduli canonici.
- Archiviati i redirect storici `home-v126.html`–`home-v129.html`: non vengono più pubblicati,
  precacheati o considerati dagli audit delle pagine attive.
- Rimossa `googleapis` dalle Cloud Functions: non era importata; email e notifiche usano
  rispettivamente `nodemailer` e Firebase Admin Messaging.
- Rimosse le dipendenze Playwright: il progetto non contiene test che le importino e il browser
  non veniva installato né usato dalla pipeline. Il collaudo locale è stato eseguito con Edge già
  presente sul sistema, senza aggiungere peso alle installazioni npm.
- Attivati nella suite i controlli sulle dipendenze circolari e un lint CSS conservativo che
  rileva errori strutturali senza imporre modifiche stilistiche.
- Rimossi l'onboarding `security-setup.js`, mai importato dal runtime e superato dal flusso Vault
  canonico, e `scadenza_templates.js`, sostituito dalle configurazioni Firestore e dal compositore
  effettivo in `aggiungi_scadenza.js`.
- Rimossi helper ed export senza consumatori da UI, crittografia, profilo e sicurezza; non erano
  raggiungibili da pagine, import dinamici o test di comportamento.
- Rimosse due condizioni di navigazione relative alla pagina inesistente `notifiche_storia.html`.
- Aggiunto un audit dei riferimenti statici: verifica import, asset, pagine e impedisce il ritorno
  degli alias storici eliminati.

<a id="fonte-docs-app-architecture-audit-md-impatto-misurato"></a>

### Impatto misurato

- File JavaScript pubblici: da 91 a 83 file fisici; grafo applicativo da 90 a 82 moduli.
- Diff funzionale del frontend: circa 800 righe eliminate e meno di 150 aggiunte, incluse le
  sostituzioni locali necessarie e i commenti aggiornati.
- Dipendenze: rimossi `googleapis` dalle Functions e il `playwright` dichiarato due volte alla
  radice; i lockfile restano riproducibili.
- Nessun asset visivo, schema Firestore, regola di autorizzazione o formato dati è stato cambiato.

<a id="fonte-docs-app-architecture-audit-md-verifiche-completate"></a>

### Verifiche completate

- 77 controlli di sicurezza e offline.
- 32 HTML senza stile, script o eventi inline, ID duplicati o Tailwind runtime.
- 148 file testuali pubblici con riferimenti statici validi.
- Lint CSS, navigazione post-salvataggio, assistente Vault e grafo senza cicli.
- Test crittografia, allegati, Cloud Functions e regole Storage.
- Smoke test locale dei redirect di ingresso e degli alias Home storici con Edge headless; le
  chiamate Firebase esterne restano volutamente non verificabili nel server locale isolato.

<a id="fonte-docs-app-architecture-audit-md-stato-inventario"></a>

### Stato inventario

- Configurazione Firebase, manifest, regole Firestore/Storage: letti e classificati.
- Service worker, bootstrap, router e dipendenze globali: letti e mappati.
- 32 HTML: struttura, fogli stile, entry point, form e redirect censiti.
- JavaScript di dominio, CSS, traduzioni, test e documentazione: letti, classificati e verificati.
- Il dettaglio file per file è rigenerabile con `npm run audit:inventory` in `FILE_INVENTORY.md`.

<a id="fonte-docs-audit-progetto-fase2-statico-md-l1"></a>

## Fonte: AUDIT_PROGETTO_FASE2_STATICO.md — righe originali 1–487

> Provenienza: `docs/AUDIT_PROGETTO_FASE2_STATICO.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-audit-progetto-fase2-statico-md-audit-completo--fase-2-verifica-statica-priorità-p0p1"></a>

## Audit completo — Fase 2: verifica statica priorità P0/P1

> **Stato:** completata per il perimetro statico indicato; nessuna correzione autorizzata\
> **Autorità:** evidenza read-only subordinata al [Piano di audit completo](../progetto/PROGRAMMA.md#fonte-docs-piano-audit-completo-progetto-md-l1)\
> **Data:** 11 settembre 2026\
> **Repository:** `Diego-Stack-ai/App-Codici-Password`\
> **Commit esaminato:** `6abeeb25674c157723a08d89b7c9fbf7f337bce4`\
> **Limite:** verifica dei file versionati su GitHub. Non certifica dati reali, Firebase Console, deploy effettivi, dispositivi o working tree locale.

<a id="fonte-docs-audit-progetto-fase2-statico-md-1-perimetro-esaminato"></a>

### 1. Perimetro esaminato

La verifica ha coperto:

- sessione Vault e persistenza della chiave sbloccata;
- inventario dei campi cifrati e formato crittografico;
- distinzione fra runtime ed esperimenti;
- Firestore Rules e Storage Rules;
- callable, trigger e principali operazioni Admin SDK;
- backup, ripristino, cestino, retention e cancellazione definitiva;
- presenza e natura dei test collegati.

Non sono stati eseguiti deploy, emulatori, test locali, accessi alla Firebase Console, letture di dati reali o prove su dispositivi.

<a id="fonte-docs-audit-progetto-fase2-statico-md-2-sintesi"></a>

### 2. Sintesi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P0-01 | Alta | Verificato nel codice | `vault-session.js` conserva nello stesso `sessionStorage` payload Vault cifrato e chiave di wrapping |
| F2-P0-02 | Alta | Verificato nel codice | Il formato dei campi cifrati non è versionato e non usa AAD per legare proprietario, record, tipo e campo |
| F2-P0-03 | Alta | Verificato nel codice | Firestore mantiene in chiaro metadati che possono rivelare contenuto riservato |
| F2-P0-04 | Alta | Verificato nelle Rules | Una regola ricorsiva consente al proprietario scritture su molte sottocollezioni senza allowlist completa |
| F2-P0-05 | Alta | Verificato nel codice e nelle Rules | La creazione diretta di inviti può attivare email/push senza callable obbligatoria e rate limit affidabile |
| F2-P0-06 | Alta | Verificato nelle Storage Rules | Upload con MIME ammesso possono essere salvati senza marcatore di cifratura |
| F2-P0-07 | Alta | Verificato nel codice | Il ripristino backup è transazionale per chunk, non atomico per l'intera operazione, e non dispone di rollback complessivo |
| F2-P1-01 | Media | Verificato nel codice | Record ripristinati possono precedere gli allegati; un errore upload può lasciare riferimenti incompleti |
| F2-P1-02 | Media | Verificato nei test | Mancano test dedicati completi per `manageReceivedDeadline`, `onInviteCreated` e abuso dei canali |
| F2-P1-03 | Media | In conflitto documentale | M7 dichiara contemporaneamente retention aperta/non approvata e fase completata/certificata |
| F2-P1-04 | Media | Verificato nel codice | Viene scritto `purgeAfterMs` a 30 giorni, ma non è emerso un processo automatico che lo applichi |
| F2-P1-05 | Media | Da verificare su dispositivo | Il fallback backup su iPhone può accumulare file molto grandi in memoria |
| F2-P1-06 | Media | Da riesaminare | `recoverMfaWithCode` riceve la password Firebase nel payload della Cloud Function |

<a id="fonte-docs-audit-progetto-fase2-statico-md-3-sessione-vault"></a>

### 3. Sessione Vault

<a id="evidenza-eb9e00b78d745d963f88"></a>

Il finding già documentato in `AUDIT_VAULT_SESSION_P0.md` è ancora presente nel commit esaminato. Il payload della Vault viene cifrato, ma la chiave casuale necessaria ad aprirlo è conservata nella stessa origine e nello stesso `sessionStorage`.

Elementi positivi confermati:

- password Firebase e Master Password sono distinte;
- la Vault Key nasce casualmente ed è protetta da envelope;
- verifier ed envelope sono versionati;
- non è emersa persistenza della Master Password in `localStorage`;
- i percorsi di blocco e cambio UID richiamano la pulizia centralizzata.

La correzione resta soggetta a una decisione architetturale e non è stata applicata.

<a id="fonte-docs-audit-progetto-fase2-statico-md-4-cifratura-e-metadati"></a>

### 4. Cifratura e metadati

`crypto-utils.js` usa PBKDF2-SHA-256 e AES-256-GCM con salt e IV casuali. Il formato testuale dei singoli campi, però, concatena salt, IV e ciphertext in Base64 senza:

- versione del formato;
- identificazione dell'algoritmo;
- AAD che leghi il valore a UID, record, tipo, campo o revisione.

Sono risultati in chiaro, secondo i percorsi verificati:

- `nomeAccount` e `url`;
- nominativi e recapiti dei referenti;
- IBAN e diversi metadati bancari;
- email e note delle caselle aziendali, mentre le password risultano cifrate;
- nomi, MIME, URL, percorso e dimensione degli allegati;
- nomi account, email e testi usati in inviti/notifiche;
- contenuto funzionale delle Scadenze necessario alle Functions.

L'inventario `ENCRYPTED_FIELD_INVENTORY.md` è quindi correttamente marcato come incompleto.

Il modello con Record Key e grant per destinatario resta in `experiments/sharing-key-prototype`. Alcuni test importano esplicitamente tale codice sperimentale: il loro successo non dimostra che il protocollo sia attivo nel runtime.

<a id="fonte-docs-audit-progetto-fase2-statico-md-5-firestore-e-storage-rules"></a>

### 5. Firestore e Storage Rules

<a id="fonte-docs-audit-progetto-fase2-statico-md-evidenze-positive"></a>

#### Evidenze positive

- percorsi backend-only come `mfaRecovery`, `mfaRecoveryAttempts` e `deadlineShares` sono chiusi al client;
- copie ricevute delle Scadenze sono leggibili solo dal proprietario e scrivibili soltanto dal backend;
- nuovi domini `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` sono function-only in scrittura;
- Storage applica isolamento per UID e chiusura predefinita.

<a id="fonte-docs-audit-progetto-fase2-statico-md-rischi"></a>

#### Rischi

La regola `/users/{userId}/{collection}/{document=**}` consente al proprietario lettura e scrittura su tutte le sottocollezioni non escluse. Non impone in modo generale allowlist, tipi, dimensioni, UID immutabile o revisione.

<a id="evidenza-4cc8a7ecfd9365ec5221"></a>

Gli inviti possono essere creati direttamente da un utente autenticato. Il trigger `onInviteCreated` può quindi inviare email o push. Nel percorso verificato non emergono rate limit affidabili, quota, callable obbligatoria o prova dell'esistenza dell'account prima dell'invio.

Storage accetta vari MIME in chiaro; il metadato `encrypted: v1` è obbligatorio soltanto per `application/octet-stream`. Le Rules non dimostrano quindi che ogni allegato applicativo sia cifrato prima dell'upload.

<a id="fonte-docs-audit-progetto-fase2-statico-md-6-cloud-functions"></a>

### 6. Cloud Functions

<a id="evidenza-a2cdf2a448f1a5f751ca"></a>

Sono state rilevate 15 callable; tutte dichiarano `enforceAppCheck: true`. I controlli Authentication sono presenti direttamente o tramite helper comune. Le principali operazioni usano validazione e, in diversi casi, transazioni e `operationId`.

Controlli positivi osservati:

- `respondToInvitation` verifica identità, email, stato dell'invito, account e presenza del destinatario;
- `manageReceivedDeadline` ricontrolla il permesso sulla Scadenza originale;
- i percorsi Admin SDK sono costruiti usando l'UID autenticato nei servizi esaminati;
- audit backend limitati a campi tecnici.

Punti aperti:

- `recoverMfaWithCode` riceve email, password Firebase e Recovery Code, poi inoltra le credenziali a Identity Toolkit. La password non risulta persistita, ma attraversa il backend applicativo;
- l'enforcement App Check nel codice non prova la configurazione effettiva dei servizi remoti;
- i test unitari dei servizi non sostituiscono test emulator/integration sui confini Auth, App Check e Admin SDK.

<a id="fonte-docs-audit-progetto-fase2-statico-md-7-backup-ripristino-e-cancellazione"></a>

### 7. Backup, ripristino e cancellazione

Il formato runtime v2 presenta controlli solidi:

- Recovery Key casuale da 192 bit;
- PBKDF2-SHA-256 a 600.000 iterazioni;
- AES-GCM;
- header autenticato;
- concatenazione tramite sequenza e digest precedente;
- footer autenticato contro troncamento, riordino e dati successivi;
- owner UID vincolato al contenitore.

Il ripristino valida scope, identificatori, dimensioni, collisioni e conferma. I percorsi sono ricostruiti dal backend sotto l'UID autenticato.

<a id="evidenza-f1af96c5f3d00bbc6632"></a>

Il limite principale è operativo: i record vengono applicati in chunk distinti e gli allegati caricati dopo i record. Un errore fra due chunk o durante gli upload può lasciare un ripristino parziale. Non è emersa una procedura automatica di rollback dell'intera esecuzione.

<a id="evidenza-f33edb9cf74960472e47"></a>

Per il cestino, `RETENTION_MS` vale 30 giorni e viene scritto `purgeAfterMs`; non è stato rilevato un processo automatico che cancelli alla scadenza. La politica effettiva resta pertanto non determinata e la documentazione M7 contiene dichiarazioni incompatibili.

<a id="fonte-docs-audit-progetto-fase2-statico-md-8-test-e-limiti-probatori"></a>

### 8. Test e limiti probatori

I test presenti coprono principalmente:

- primitivi e formato backup;
- validatori di restore e purge;
- servizi offline e mutazioni private;
- widget e credenziali comuni;
- sicurezza dei Recovery Code.

Non risultano prove sufficienti per dichiarare verificati:

- rollback dopo errore fra chunk;
- perdita di rete durante ripristino allegati;
- memoria e spazio su iPhone con backup grandi;
- abuso/rate limit di `onInviteCreated`;
- flusso completo di `manageReceivedDeadline`;
- enforcement App Check reale;
- retention e cancellazione effettiva nei backup remoti.

<a id="fonte-docs-audit-progetto-fase2-statico-md-9-ordine-proposto-per-le-verifiche-successive"></a>

### 9. Ordine proposto per le verifiche successive

Senza applicare correzioni:

1. offline, service worker, coda cifrata e conflitti;
2. allegati e URL legacy;
3. condivisione legacy contro modello candidato;
4. supply chain, dipendenze, segreti e workflow;
5. matrice test/emulatori;
6. configurazione Firebase reale e dispositivi, soltanto dopo autorizzazione specifica.

<a id="fonte-docs-audit-progetto-fase2-statico-md-10-gate"></a>

### 10. Gate

Questa fase registra findings e prove statiche. Non autorizza:

- migrazioni crittografiche;
- modifica di Rules o Functions;
- lettura o riscrittura di dati reali;
- deploy;
- correzione automatica della documentazione in conflitto;
- modifica di `docs/PIANO_MATURITA_PROFESSIONALE.md`.

Le correzioni dovranno essere approvate e realizzate per blocchi separati, con test, migrazione e rollback.


<a id="fonte-docs-audit-progetto-fase2-statico-md-11-verifica-offline-service-worker-e-conflitti"></a>

### 11. Verifica offline, service worker e conflitti

<a id="fonte-docs-audit-progetto-fase2-statico-md-evidenze-positive-1"></a>

#### Evidenze positive

- il service worker applicativo precarica soltanto la shell dichiarata in `offline-assets.js`;
- le richieste protette a `/protected-media/presentation` sono escluse dalla Cache API;
- codice e stili usano rete-prima con fallback sulla stessa URL/versione;
- Firestore usa `persistentLocalCache` con gestione multischeda;
- la coda IndexedDB conserva contenitori AES-GCM e non il payload della mutazione in chiaro;
- la chiave della coda deriva tramite HKDF dal materiale Vault e dall'UID;
- l'AAD lega versione, UID e `operationId`;
- il backend verifica revisione e idempotenza prima di applicare le mutazioni;
- una mutazione viene rimossa dalla coda soltanto dopo esito applicato o duplicato già riconosciuto;
- un conflitto arresta la sincronizzazione senza sovrascrivere il record remoto;
- Account condivisi, bancari e collegati al Profilo restano esclusi dalle scritture offline.

<a id="fonte-docs-audit-progetto-fase2-statico-md-finding-aggiuntivi"></a>

#### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P1-07 | Media | Verificato nel codice; candidato di laboratorio verificato in browser — adozione runtime aperta | `withOfflineQueueLease` genera errore se Web Locks non è disponibile; non esiste il fallback dichiarato dal contratto |
| F2-P1-08 | Media | Verificato nel codice | L'handoff dopo salvataggio conserva in `sessionStorage` l'intero record, inclusi metadati non cifrati, con TTL controllato solo alla lettura |
| F2-P1-09 | Media | Verificato nel codice e da prova dichiarata | Offline, una query cache vuota viene restituita direttamente e non distingue raccolta vuota da cache mai preparata |
| F2-P1-10 | Media | Verificato nel codice | Il flag globale delle mutazioni è disattivato, ma l'adattatore Account lo forza a `enabled: true`; il nome “pilot” non riflette più chiaramente il cutover dichiarato |
| F2-P2-01 | Bassa | Verificato nel worker | Una push `share_invite` apre la Home, non una destinazione specifica per l'invito |
| F2-P2-02 | Bassa | Da verificare | L'installazione usa `Promise.all`: una singola risorsa mancante impedisce l'installazione completa della nuova shell |

<a id="fonte-docs-audit-progetto-fase2-statico-md-dettaglio"></a>

#### Dettaglio

<a id="evidenza-4b8867ff31af22a43c87"></a>

`offline-firestore.js` usa cache-first quando il dispositivo risulta online e aggiorna dal server in background. Quando `navigator.onLine` è falso, restituisce direttamente la cache. Per una query mai preparata, una cache vuota appare quindi come lista realmente vuota. Questo comportamento è coerente con il fallimento già dichiarato nel test dell'Account bancario su iPhone.

<a id="evidenza-e1071819c38e2cb3b62f"></a>

La coda è separata per UID tramite il nome del database e i contenitori restano cifrati. Non è emersa una cancellazione fisica automatica del database IndexedDB al logout. La coda non dovrebbe essere decifrabile senza il materiale Vault, ma cancellazione, revoca dispositivo e recupero della coda residua richiedono una prova specifica.

<a id="evidenza-e5a0a554897ec3f2744a"></a>

`withOfflineQueueLease` continua a rifiutare un browser privo di Web Locks. Il candidato di laboratorio `hybrid-queue-coordinator.mjs` realizza il fallback dichiarato dal contratto con il solo lease IndexedDB, ora con acquisizione limitata nel tempo e rifiuto del lease tardivo; la prova in Chrome 152 ed Edge 153 con `navigator.locks` realmente assente è registrata in `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` (M6-CLOSE, 18/09/2026). Il finding resta aperto finché il runtime non adotta il candidato.

<a id="evidenza-63c5ac2cfce42fc94d88"></a>

`private-account-offline-pilot.js` salva per 60 secondi un handoff della UI in `sessionStorage`. Il controllo del TTL avviene quando il dato viene consumato; se la pagina successiva non lo legge, il contenitore può restare oltre il TTL. Il record include ciphertext per le credenziali ma anche i metadati che il normale schema conserva in chiaro.

Il worker Firebase Messaging è separato dal worker della shell. Gestisce correttamente i deep link per Scadenze proprie e ricevute; per `share_invite` usa invece il fallback Home.

<a id="fonte-docs-audit-progetto-fase2-statico-md-gate-ancora-aperti"></a>

#### Gate ancora aperti

- apertura offline deterministica delle liste su iPhone;
- adozione nel runtime del fallback senza Web Locks: il candidato di laboratorio è completo e verificato in un browser con l'API realmente assente, mentre `withOfflineQueueLease` continua a rifiutare l'API mancante;
- logout, cambio UID e revoca con coda pendente;
- chiusura forzata prima del consumo dell'handoff;
- aggiornamento della shell quando una risorsa del manifest non è disponibile;
- concorrenza reale fra due schede e due dispositivi sul runtime distribuito.


<a id="fonte-docs-audit-progetto-fase2-statico-md-12-verifica-allegati-e-condivisione"></a>

### 12. Verifica allegati e condivisione

<a id="fonte-docs-audit-progetto-fase2-statico-md-finding-aggiuntivi-1"></a>

#### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P0-08 | Bloccante | Verificato nel codice | L'ACL consente al destinatario di leggere il record, ma non esiste un envelope della chiave capace di decifrare i campi del proprietario |
| F2-P0-09 | Bloccante | Verificato in codice e Rules | Il destinatario non può scaricare gli allegati del proprietario e non possiede la chiave necessaria ad aprirli |
| F2-P0-10 | Alta | Verificato nel codice | URL Firebase di download vengono persistiti e i lettori legacy li aprono direttamente; il token URL non deve essere trattato come autorizzazione |
| F2-P0-11 | Alta | Verificato nel codice | La validazione upload si fida del MIME fornito dal browser e non controlla magic bytes/firma del file |
| F2-P1-11 | Media | Verificato nel codice | L'AAD degli allegati è una costante e non lega proprietario, record, allegato, versione o percorso |
| F2-P1-12 | Media | Verificato nel codice | Nome originale, tipo, dimensione, URL e percorso Storage restano metadati leggibili in Firestore |
| F2-P1-13 | Media | Verificato nel runtime | La revoca rimuove l'ACL ma non ruota il materiale crittografico e non può eliminare copie già presenti nella cache |
| F2-P1-14 | Media | Verificato nei test | I test crittografici della condivisione usano in parte `experiments/sharing-key-prototype` e non certificano il runtime attivo |

<a id="fonte-docs-audit-progetto-fase2-statico-md-flusso-account-condiviso-attuale"></a>

#### Flusso Account condiviso attuale

1. Il proprietario cifra i campi usando la propria Vault Key.
2. Il client salva `sharedWith` e crea un invito.
3. `respondToInvitation` verifica il destinatario e aggiunge il suo UID a `sharedWithUids`.
4. Le Firestore Rules consentono la lettura del documento originale.
5. Il client del destinatario tenta di decifrare usando la Vault Key del destinatario.
6. Non è emerso un envelope che colleghi la chiave del record alla chiave del destinatario.

La separazione fra autorizzazione e decifratura è quindi incompleta: il destinatario può ricevere il ciphertext ma non è dimostrato che possa ottenere correttamente il contenuto.

<a id="fonte-docs-audit-progetto-fase2-statico-md-allegati"></a>

#### Allegati

Il runtime cifra ogni nuovo allegato con una File Key casuale AES-GCM e avvolge la File Key tramite HKDF/AES-GCM usando la Vault Key del proprietario. Questo protegge il contenuto salvato come `application/octet-stream`.

Restano però aperti quattro confini:

- Storage consente la lettura solo all'UID proprietario;
- la File Key è avvolta per la Vault Key del proprietario, non per il destinatario;
- l'AAD è `CodiciPassword-Attachment-v1` per tutti gli oggetti e non lega il contesto;
- il controllo formato usa `file.type`, senza verifica dei magic bytes.

<a id="fonte-docs-audit-progetto-fase2-statico-md-url-legacy"></a>

#### URL legacy

I moduli privato e azienda continuano a:

- ottenere `getDownloadURL`;
- salvare l'URL nel documento Firestore;
- aprire direttamente `attachment.url` quando manca il metadato `encryption`.

<a id="evidenza-75f96963e131fda303f4"></a>

Un Firebase download URL può includere un token persistente e non deve essere considerato equivalente a una lettura governata in ogni momento dalle Storage Rules. Per gli oggetti legacy non cifrati, la conoscenza dell'URL può esporre direttamente il contenuto. Non è stato effettuato alcun inventario dei token o degli oggetti reali.

<a id="fonte-docs-audit-progetto-fase2-statico-md-identità-crittografica-candidata"></a>

#### Identità crittografica candidata

<a id="evidenza-c7108aec5f8a531872b7"></a>

`sharing-identity.js` crea un'identità ECDH P-256, cifra la chiave privata con materiale derivato dalla Vault Key e usa AAD legata a UID e key ID. Il modulo è coperto da test isolati, ma non è emerso un collegamento completo dal form Account al protocollo record-key/grant.

Il modello con Record Key, grant individuali, `keyGeneration` e rotazione resta candidato e non deve essere dichiarato attivo.

<a id="fonte-docs-audit-progetto-fase2-statico-md-gate-ancora-aperti-1"></a>

#### Gate ancora aperti

- condivisione end-to-end fra due Vault realmente differenti;
- download e apertura allegato da parte del destinatario;
- inventario aggregato degli URL/token legacy;
- magic-byte validation per ogni formato ammesso;
- rotazione dopo revoca;
- comportamento della cache del destinatario revocato;
- verifica e sostituzione protetta della chiave pubblica;
- migrazione con doppio lettore e rollback, solo dopo approvazione.


<a id="fonte-docs-audit-progetto-fase2-statico-md-13-verifica-supply-chain-e-workflow-di-rilascio"></a>

### 13. Verifica supply chain e workflow di rilascio

<a id="fonte-docs-audit-progetto-fase2-statico-md-evidenze-positive-2"></a>

#### Evidenze positive

- repository marcato `private: true` nei package npm;
- lockfile v3 presenti sia alla radice sia nelle Functions;
- dipendenze risolte con hash `integrity`;
- `.env`, `serviceAccountKey.json`, cache Firebase, log e `node_modules` sono esclusi da Git;
- la scansione statica dei nomi e dei pattern non ha rilevato chiavi private, service account o valori di `GMAIL_APP_PASSWORD`;
- i segreti Gmail sono richiamati tramite Secret Manager;
- il workflow usa `npm ci`, non installazioni non deterministiche;
- test completi eseguiti prima del comando di deploy;
- le Functions sono escluse dal deploy automatico corrente.

<a id="evidenza-9d0d9692bfb5f31ea70c"></a>

Le API key Firebase presenti nel frontend e nella Function sono configurazioni del client Firebase e non equivalgono a una chiave privata o service account. La suddivisione della stringa nel frontend non costituisce una misura di sicurezza.

<a id="fonte-docs-audit-progetto-fase2-statico-md-finding-aggiuntivi-2"></a>

#### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P0-12 | Alta | Verificato nel workflow | Ogni push su `master`, anche documentale, avvia un deploy di Hosting, Firestore Rules e Storage |
| F2-P0-13 | Alta | Verificato nel workflow | Il deploy non specifica `--project` e dipende dal progetto predefinito `appcodici-password` in `.firebaserc` |
| F2-P1-15 | Media | Verificato nel workflow | Autenticazione CI basata su `FIREBASE_TOKEN`, dichiarata legacy dallo stesso repository |
| F2-P1-16 | Media | Verificato nel workflow | Le GitHub Actions sono referenziate tramite tag maggiori (`@v5`) e non tramite commit SHA immutabile |
| F2-P1-17 | Media | Verificato nel workflow | Rules/Storage/Hosting vengono ridistribuiti insieme anche quando non sono cambiati |
| F2-P1-18 | Media | Verificato nel workflow | Functions restano manuali, creando possibilità di disallineamento fra frontend, Rules e backend |
| F2-P1-19 | Media | Non determinabile | Vulnerabilità correnti delle dipendenze transitive non verificate con audit del lockfile |
| F2-P2-03 | Bassa | Verificato nel repository | Numerose suite chiamate “prototype” o basate su `experiments/` fanno parte del gate principale e possono essere confuse con copertura del runtime |

<a id="fonte-docs-audit-progetto-fase2-statico-md-workflow-corrente"></a>

#### Workflow corrente

Il solo workflow `.github/workflows/firebase-deploy.yml` reagisce direttamente al push su `master`:

1. checkout;
2. Node.js 22 e Java 21;
3. `npm ci`;
4. `npm ci --prefix functions`;
5. `npm test`;
6. deploy di Hosting, Firestore Rules e Storage con `FIREBASE_TOKEN`.

<a id="evidenza-e0e5b4fb584e0674fdb3"></a>

Non è emerso un ambiente di approvazione, un gate manuale, una selezione basata sui file modificati o un comando `--project <PROJECT_ID>`. Di conseguenza un merge esclusivamente documentale può causare una nuova distribuzione della configurazione di produzione.

<a id="fonte-docs-audit-progetto-fase2-statico-md-segreti-e-file-sensibili"></a>

#### Segreti e file sensibili

La scansione statica ha cercato nomi e pattern compatibili con:

- chiavi private PEM;
- service account;
- file `.env`;
- backup/credenziali;
- riferimenti `FIREBASE_TOKEN`;
- riferimenti `GMAIL_APP_PASSWORD`.

Non sono emersi valori di chiavi private o password Gmail. Questo controllo non certifica la cronologia Git, i branch non esaminati, gli artifact Actions o i segreti configurati nell'account GitHub.

<a id="fonte-docs-audit-progetto-fase2-statico-md-dipendenze"></a>

#### Dipendenze

I manifest dichiarano fra le dipendenze principali Firebase SDK, Firebase Tools, Rules Unit Testing, esbuild, madge, stylelint, Tesseract.js, ZXing, Firebase Admin, Firebase Functions e Nodemailer.

<a id="evidenza-2ff9758efcddb9ed7b03"></a>

I lockfile rendono riproducibile l'installazione, ma il workflow non esegue una verifica esplicita di advisory/licenze. La presenza di una versione nel lockfile non dimostra l'assenza di vulnerabilità correnti. Un controllo attendibile richiede esecuzione separata dell'audit e valutazione dei risultati, senza aggiornamenti automatici.

<a id="fonte-docs-audit-progetto-fase2-statico-md-gate-aperti"></a>

#### Gate aperti

- audit delle dipendenze e licenze sul lockfile;
- scansione della cronologia Git e dei branch residui;
- verifica ruleset/branch protection;
- sostituzione del token CI con identità federata a privilegi minimi;
- ambiente protetto con approvazione deploy;
- parametro esplicito `--project`;
- deploy selettivo basato sugli artifact modificati;
- matrice di compatibilità fra versione Hosting, Rules e Functions.


<a id="fonte-docs-audit-progetto-fase2-statico-md-14-matrice-delle-prove-e-significato-della-ci"></a>

### 14. Matrice delle prove e significato della CI

<a id="fonte-docs-audit-progetto-fase2-statico-md-stato-verificato"></a>

#### Stato verificato

Il commit di base `6abeeb25674c157723a08d89b7c9fbf7f337bce4` è associato a un'esecuzione riuscita del workflow **Validate and deploy Firebase**:

- run ID: `34596454444`;
- evento: push su `master`;
- esito: `success`;
- intervallo registrato: 11 settembre 2026, 11:56:44–11:57:51 UTC.

<a id="evidenza-2943f52827d086238120"></a>

L'esito dimostra che i comandi configurati nel workflow sono terminati con successo e che il job ha raggiunto il deploy. Non certifica, da solo, completezza dei test, configurazione remota effettiva, comportamento sui dispositivi o correttezza end-to-end dei flussi critici.

<a id="fonte-docs-audit-progetto-fase2-statico-md-inventario-delle-prove-versionate"></a>

#### Inventario delle prove versionate

| Gruppo | Quantità rilevata | Natura prevalente | Valore probatorio |
|---|---:|---|---|
| Test principali in `tests/` | 35 | unitari, integrazione locale, contratti e prototipi | Variabile: dipende dal modulo importato |
| Test unitari Functions in `functions/test/` | 8 | helper e servizi isolati | Non equivalgono a callable/trigger distribuiti |
| Test in `experiments/` | 7 | protocolli candidati | Provano il prototipo, non il runtime attivo |
| Script `audit-*.mjs` | 16 | asserzioni statiche e ricerca di pattern | Provano presenza testuale, non comportamento |
| Runner emulatori | 3 | Firestore Rules, Storage Rules, Functions | Solo Firestore e Storage sono nel gate `npm test` |

<a id="evidenza-fadd71bcb5ebb495fdcf"></a>

I runner Firestore e Storage usano project ID fittizi e avviano emulatori locali. È una separazione positiva dai dati reali. Le rispettive suite includono tuttavia sia Rules di produzione sia regole o protocolli candidati: il successo complessivo deve essere attribuito al singolo file verificato, non all'intera funzionalità nominale.

<a id="fonte-docs-audit-progetto-fase2-statico-md-finding-aggiuntivi-3"></a>

#### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P1-20 | Media | Verificato negli script npm | `scripts/test-functions-emulator.mjs` esiste ma non è richiamato da `npm test` |
| F2-P1-21 | Media | Verificato negli audit script | Molti gate “security” sono asserzioni regex/statiche e dimostrano presenza di costrutti, non efficacia a runtime |
| F2-P1-22 | Media | Verificato nella composizione del gate | Test di produzione, candidati e prototipi confluiscono nello stesso esito, riducendo la chiarezza sulla maturità effettiva |
| F2-P1-23 | Media | Verificato nel runner Functions | L'emulatore Functions copre sei scenari basilari/negativi e non i flussi completi di invito, condivisione, scadenze, App Check e abuso |
| F2-P1-24 | Media | Limite probatorio verificato | La CI riuscita prova l'esecuzione del workflow, ma non le versioni/configurazioni remote effettive né l'enforcement App Check reale |
| F2-P2-04 | Bassa | Non rilevato | Non è emersa strumentazione di code coverage o una soglia minima bloccante |

<a id="fonte-docs-audit-progetto-fase2-statico-md-distinzione-fra-tipi-di-evidenza"></a>

#### Distinzione fra tipi di evidenza

- **Unit test:** utile per logica pura, validatori e servizi; non attraversa necessariamente Auth, Rules, rete e Admin SDK.
- **Test emulatore Rules:** prova decisioni di accesso per gli scenari dichiarati; non prova configurazioni o dati di produzione.
- **Test emulatore Functions:** può attraversare endpoint locali, ma il runner attuale è limitato e fuori dal gate principale.
- **Audit statico:** individua regressioni testuali e contratti dichiarati; può dare falsi positivi sul comportamento.
- **Test prototipo:** valida una direzione tecnica; non autorizza a descriverla come implementata.
- **CI verde:** prova che il set configurato è passato; non prova ciò che il set non esercita.

<a id="evidenza-3ba7eeb89eb45ab8c560"></a>

Un esempio rilevante è l'audit della sessione Vault: il controllo statico conferma il pattern di persistenza previsto dal codice, ma non rende sicuro il fatto che payload cifrato e chiave di wrapping risiedano nella stessa sessione browser.

<a id="fonte-docs-audit-progetto-fase2-statico-md-gate-aperti-1"></a>

#### Gate aperti

- integrare l'emulatore Functions nel gate solo dopo averne definito isolamento, stabilità e scenari obbligatori;
- separare chiaramente suite runtime, candidate ed esperimenti nel reporting CI;
- associare ogni requisito critico a una prova comportamentale e a un ambiente;
- coprire flussi positivi, negativi, concorrenza, retry, abuso e revoca;
- introdurre coverage soltanto come indicatore complementare, non come sostituto dei casi di sicurezza;
- verificare configurazione Firebase reale e dispositivi esclusivamente dopo autorizzazione specifica.


<a id="fonte-docs-audit-progetto-fase2-statico-md-15-visibilità-governance-dipendenze-e-cronologia-git"></a>

### 15. Visibilità, governance, dipendenze e cronologia Git

<a id="fonte-docs-audit-progetto-fase2-statico-md-evidenze-verificate"></a>

#### Evidenze verificate

- il repository GitHub è **pubblico** (`private: false`, `visibility: public`) e consente fork;
- `master` è il branch predefinito e GitHub lo dichiara `protected: false`;
- tutti i 12 branch elencati risultano non protetti;
- l'endpoint ruleset restituisce un elenco vuoto;
- il collegamento usato per l'audit dispone di permessi amministrativi, ma la lettura dettagliata della branch protection è negata all'integrazione; lo stato sintetico dei branch resta comunque `protected: false`;
- nei 826 commit raggiungibili da `master`, 805 commit risultano non firmati e 21 verificati;
- il repository non richiede il sign-off dei commit via web;
- GitHub non rileva una licenza del repository, mentre il solo `package.json` dichiara `ISC`.

Il valore `private: true` nei due manifest npm impedisce la pubblicazione accidentale dei pacchetti su npm. Non rende privato il repository GitHub.

<a id="fonte-docs-audit-progetto-fase2-statico-md-finding-aggiuntivi-4"></a>

#### Finding aggiuntivi

| ID | Gravità | Stato | Finding |
|---|---|---|---|
| F2-P0-14 | Alta | Verificato su GitHub e nel workflow | `master` non è protetto e ogni push diretto può avviare test e deploy di Hosting, Firestore Rules e Storage |
| F2-P1-25 | Media | Verificato su GitHub | Non risultano ruleset; tutti i 12 branch elencati, incluso `master`, hanno `protected: false` |
| F2-P1-26 | Media | Verificato su GitHub | Il repository del password manager è pubblico e consente fork; ciò amplia la superficie informativa e rende essenziale che nessun dato o segreto operativo sia versionato |
| F2-P1-27 | Media | Verificato nella cronologia | 805 dei 826 commit raggiungibili da `master` non hanno firma verificata; il sign-off web non è richiesto |
| F2-P1-28 | Media | Non determinabile con l'accesso disponibile | Alert Dependabot, secret scanning e advisory correnti non sono leggibili dall'integrazione usata |
| F2-P2-05 | Bassa | Verificato nei metadati | Il manifest dichiara licenza ISC, ma GitHub riporta `license: null`; manca una licenza di repository riconosciuta |
| F2-P2-06 | Bassa | Verificato nei lockfile | Quattro pacchetti non espongono il campo licenza nel lockfile; uno, `limiter@1.1.5`, è nel grafo Functions non-dev |

<a id="fonte-docs-audit-progetto-fase2-statico-md-licenze-ricavate-dai-lockfile"></a>

#### Licenze ricavate dai lockfile

| Lockfile | Pacchetti registrati | Produzione/non-dev | Metadato licenza assente | Copyleft rilevato dal campo |
|---|---:|---:|---:|---|
| radice | 935 | 0 | 3 | `postcss-values-parser` — MPL-2.0, dev |
| Functions | 356 | 283 | 1 | nessuno |

I tre pacchetti dev senza campo licenza nel lockfile radice sono `fuzzy@0.1.3`, `svg-tags@1.0.0` e `valid-url@1.0.9`. Nel lockfile Functions manca il campo per `limiter@1.1.5`.

<a id="evidenza-97e70686c09471d4a5f2"></a>

Questa è una lettura dei metadati versionati, non un parere legale. L'assenza del campo nel lockfile non dimostra automaticamente che un pacchetto sia privo di licenza; richiede verifica sulla fonte del pacchetto prima di una distribuzione formale.

<a id="fonte-docs-audit-progetto-fase2-statico-md-vulnerabilità-delle-dipendenze"></a>

#### Vulnerabilità delle dipendenze

<a id="evidenza-7c81de2df556e8f6b3b5"></a>

Le versioni dirette e transitive sono fissate dai lockfile v3, ma non è stato possibile interrogare gli alert Dependabot o eseguire un advisory audit attendibile attraverso l'accesso disponibile. Non sono stati eseguiti `npm audit fix`, aggiornamenti o modifiche dei lockfile.

Il finding F2-P1-19 rimane quindi aperto: non è corretto dichiarare le dipendenze sicure né vulnerabili senza un risultato advisory aggiornato e valutato.

<a id="fonte-docs-audit-progetto-fase2-statico-md-verifica-storica-dei-segreti"></a>

#### Verifica storica dei segreti

La cronologia di `master` contiene 826 commit. Sono stati controllati:

- messaggi e metadati di tutti i commit;
- commit associati ai percorsi `.env`, `serviceAccountKey.json`, `scripts_import_dati/serviceAccountKey.json` e `Torna alla Login e accedi con.docx`;
- patch mirate dei commit che introducono Secret Manager e la protezione dei file locali.

Per i quattro percorsi sensibili espliciti GitHub restituisce zero commit. Nelle patch mirate, Gmail usa `defineSecret` e non è emerso il valore della password applicativa.

<a id="evidenza-813f6759f230f9544ccc"></a>

Limite: la verifica non ha materializzato e analizzato ogni blob di ogni albero storico con uno scanner dedicato. Non certifica quindi l'assenza assoluta di segreti sotto nomi differenti, branch non raggiungibili da `master`, tag, artifact o log Actions.

<a id="fonte-docs-audit-progetto-fase2-statico-md-priorità-di-governance-proposta"></a>

#### Priorità di governance proposta

Prima di qualunque merge dell'audit o futura correzione:

1. disaccoppiare i cambi documentali dal deploy Firebase;
2. proteggere `master` con pull request e check obbligatori;
3. aggiungere un'approvazione esplicita per il job di produzione;
4. rendere esplicito il progetto Firebase di destinazione;
5. decidere consapevolmente se il repository debba restare pubblico;
6. abilitare e verificare secret scanning/Dependabot secondo le capacità del piano GitHub;
7. definire firma o provenance dei commit e una politica licenze.

Qualsiasi modifica a workflow, visibilità, Rules, Functions o deploy resta fuori dal perimetro di questo audit e richiede autorizzazione.

<a id="fonte-docs-audit-vault-session-p0-md-l1"></a>

## Fonte: AUDIT_VAULT_SESSION_P0.md — righe originali 1–119

> Provenienza: `docs/AUDIT_VAULT_SESSION_P0.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-audit-vault-session-p0-md-audit-p0--sessione-vault"></a>

## Audit P0 — Sessione Vault

> **Stato:** audit iniziale completato; shell persistente approvata e parzialmente integrata. VS-P0-01 ancora aperto in produzione.
> **Autorità:** evidenza subordinata a [Architettura Sicurezza V1](../regole/SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1) e [Contratto Vault Key](../regole/VAULT.md#fonte-docs-vault-key-contract-md-l1)
> **Data:** 11 settembre 2026
> **Commit esaminato:** `2b00336dfcf2a2c90e244263bca33fbf3db2d922`
> **Codice esaminato:** `security-manager.js`, `vault-session.js`, `webauthn-manager.js`, `inactivity-timer.js`, chiamate di logout e test Vault

> **Ultima verifica dello stato:** 15/09/2026, incremento `054b045d`, PR #67; produzione 1.2.127. Le sezioni iniziali descrivono l'audit storico del commit sopra indicato; per stato corrente e chiusure vedere il [riepilogo del programma](../storico/REGISTRO.md#fonte-docs-piano-maturita-professionale-md-chiusura-documentale-dellincremento-054b045d--15092026). La scelta architetturale non è più in attesa di approvazione.

<a id="fonte-docs-audit-vault-session-p0-md-1-esito"></a>

### 1. Esito

<a id="evidenza-37b8aa5c4fac31d75124"></a>

Il runtime separa correttamente la password Firebase dalla Master Password e usa una Vault Key casuale protetta da envelope. La sessione fra pagine, però, non soddisfa l'invariante della baseline: `vault-session.js` conserva nello stesso `sessionStorage` sia il materiale Vault cifrato sia la chiave casuale che lo decifra.

<a id="evidenza-03fc62bd5ba6e5ecbd2a"></a>

Questo wrapping impedisce la lettura casuale del solo payload, ma non crea una separazione crittografica contro uno script eseguito nella stessa origine. Un attaccante capace di eseguire JavaScript nell'app può leggere entrambi i valori e ricostruire il materiale Vault della scheda sbloccata.

Il runtime non deve quindi essere dichiarato conforme al contratto Vault o definitivamente zero-knowledge finché questa persistenza resta attiva.

<a id="fonte-docs-audit-vault-session-p0-md-2-flusso-verificato"></a>

### 2. Flusso verificato

1. La Master Password verifica il verifier e deriva temporaneamente la KEK.
2. La KEK apre `vaultKeyEnvelope` oppure inizializza il formato compatibile previsto.
3. `_vaultKeyMaterial` conserva la chiave sbloccata in RAM.
4. `saveVaultSession()` cifra lo stesso materiale e salva il payload in `sessionStorage`.
5. `getSessionKey(true)` genera la chiave di wrapping e salva anch'essa in `sessionStorage`.
6. Al caricamento della pagina successiva `restoreVaultSession()` legge entrambi i valori e ripristina `_vaultKeyMaterial` senza chiedere nuovamente la Master Password.
7. Il timer aggiorna `expiresAt`; `softLock()` e `clearSession()` eliminano payload e chiave di wrapping.

<a id="fonte-docs-audit-vault-session-p0-md-3-evidenze-positive"></a>

### 3. Evidenze positive

- non è emersa persistenza della Master Password in `localStorage`;
- verifier e `vaultKeyEnvelope` memorizzati localmente sono contenitori cifrati e versionati;
- il vecchio segreto biometrico non strutturato viene eliminato e non viene più letto;
- il contenitore WebAuthn/PRF conserva ciphertext, IV, salt e identificatore credenziale, non la chiave PRF;
- cambio UID, perdita dell'utente autenticato, blocco per inattività e reset Vault chiamano la pulizia centralizzata;
- i test verificano isolamento per UID e cancellazione dei due valori di sessione;
- non sono emerse chiamate che inviano Master Password o Vault Key alle Cloud Functions.

<a id="fonte-docs-audit-vault-session-p0-md-4-finding"></a>

### 4. Finding

<a id="fonte-docs-audit-vault-session-p0-md-vs-p0-01--chiave-e-ciphertext-nello-stesso-storage"></a>

#### VS-P0-01 — Chiave e ciphertext nello stesso storage

<a id="evidenza-c1f229e848b59d69869f"></a>

**Gravità:** alta.
**Stato:** verificato nel codice e indirettamente dai test.
**Impatto:** una XSS o dipendenza frontend compromessa, mentre la Vault è sbloccata o ripristinabile, può ottenere entrambi gli elementi necessari alla decifratura.
**Limite:** nessuna soluzione browser può proteggere completamente una chiave già in RAM da codice ostile eseguito nella stessa pagina; eliminare la persistenza riduce però la finestra e impedisce il recupero dopo un nuovo caricamento.

<a id="fonte-docs-audit-vault-session-p0-md-vs-p1-02--pulizia-al-logout-non-sempre-esplicita"></a>

#### VS-P1-02 — Pulizia al logout non sempre esplicita

<a id="evidenza-b736837eedbdb18e661d"></a>

**Gravità:** media.
**Stato:** verificato nel codice.
**Impatto:** alcuni pulsanti chiamano direttamente `signOut()` e affidano la pulizia al listener globale `onAuthStateChanged`. Il percorso normalmente funziona, ma il contratto dovrebbe richiedere `clearSession()` prima del logout in ogni comando esplicito, mantenendo il listener come seconda difesa.

<a id="fonte-docs-audit-vault-session-p0-md-vs-p1-03--ripristino-della-scheda-e-crash-non-certificati"></a>

#### VS-P1-03 — Ripristino della scheda e crash non certificati

<a id="evidenza-569ca7d80799306fbda2"></a>

**Gravità:** media.
**Stato:** non determinabile senza prova fisica.
**Impatto:** `sessionStorage` è normalmente limitato alla scheda, ma il ripristino della sessione del browser dopo chiusura anomala può conservarlo. Non esiste una prova su Safari/iPhone, Chrome ed Edge che documenti tutti i casi.

<a id="fonte-docs-audit-vault-session-p0-md-vs-p1-04--test-funzionali-descritti-come-contratto-di-sicurezza"></a>

#### VS-P1-04 — Test funzionali descritti come contratto di sicurezza

<a id="evidenza-fd5528bcfc70705433dc"></a>

**Gravità:** media.
**Stato:** verificato nei test e negli script.
**Impatto:** i test attuali dimostrano che la sessione viene ripristinata e cancellata, ma non dimostrano che il wrapping sia sicuro. Uno script di audit richiede esplicitamente la persistenza fra pagine; il messaggio “contratto M1 rispettato” deve essere separato dalla conformità alla nuova baseline.

<a id="fonte-docs-audit-vault-session-p0-md-5-vincolo-funzionale"></a>

### 5. Vincolo funzionale

<a id="evidenza-d850af9a0ab4ed255791"></a>

L'app usa pagine HTML separate. Una Vault Key conservata soltanto in una variabile JavaScript viene persa a ogni navigazione completa. Rimuovere subito `sessionStorage` obbligherebbe quindi l'utente a reinserire la Master Password in quasi ogni pagina, salvo usare WebAuthn con un nuovo gesto dell'utente.

Per questo motivo la correzione non deve essere una cancellazione isolata di `vault-session.js`: richiede una decisione sull'architettura di navigazione e sul livello di comodità accettato.

<a id="fonte-docs-audit-vault-session-p0-md-6-piano-di-correzione-proposto"></a>

### 6. Piano di correzione proposto

<a id="fonte-docs-audit-vault-session-p0-md-blocco-1--riduzione-immediata-del-rischio"></a>

#### Blocco 1 — Riduzione immediata del rischio

- rendere esplicita la pulizia prima di ogni logout;
- distinguere nei test “continuità funzionale” e “conformità di sicurezza”;
- verificare CSP, rendering dinamico e dipendenze come difesa principale contro XSS;
- misurare chiusura, crash, ripristino scheda e timeout sui browser supportati.

Questo blocco non cambia il formato dei dati e non richiede migrazione.

<a id="fonte-docs-audit-vault-session-p0-md-blocco-2--scelta-del-modello-di-sessione"></a>

#### Blocco 2 — Scelta del modello di sessione

Valutare e approvare una delle seguenti direzioni:

1. **modalità rigorosa:** chiave solo in RAM e nuovo sblocco dopo ogni caricamento completo;
2. **navigazione persistente:** evoluzione graduale verso una shell che non ricarica il contesto crittografico a ogni pagina;
3. **sblocco dispositivo:** WebAuthn/PRF esplicito quando cambia documento, mantenendo la Master Password come fallback;
4. **compatibilità temporanea:** mantenere il comportamento corrente per un periodo dichiarato, rafforzando fortemente prevenzione XSS e timeout, senza definirlo conforme.

<a id="evidenza-4de5ef77b52fa3c9f090"></a>

Service Worker, SharedWorker, cookie o un secondo storage web non devono essere considerati automaticamente sicuri: richiedono threat model, compatibilità iPhone/PWA e prova che la chiave non sia recuperabile dagli stessi script dell'origine.

<a id="fonte-docs-audit-vault-session-p0-md-blocco-3--cutover-controllato"></a>

#### Blocco 3 — Cutover controllato

Dopo la scelta:

- implementare il nuovo gestore dietro una modalità reversibile;
- mantenere invariati ciphertext, envelope e dati Firestore quando possibile;
- aggiungere test per logout, cambio UID, timeout, refresh, chiusura e ripristino;
- collaudare su iPhone/Safari, PWA, Chrome ed Edge;
- rimuovere il lettore di sessione precedente soltanto dopo il collaudo e il rollback verificato.

<a id="fonte-docs-audit-vault-session-p0-md-7-decisione-richiesta"></a>

### 7. Decisione richiesta

<a id="evidenza-b9e420f09571fb5c55fa"></a>

La correzione non richiede recuperare o risalvare gli account esistenti: riguarda il modo in cui la chiave già sbloccata sopravvive fra le pagine. Prima del Blocco 2 il product owner deve scegliere se privilegiare temporaneamente comodità, modalità rigorosa oppure una futura shell persistente.

<a id="fonte-docs-audit-vault-session-p0-md-8-correzione-locale-del-12092026--blocco-1-logout"></a>

### 8. Correzione locale del 12/09/2026 — Blocco 1, logout

Base applicativa: v1.2.110, `fa555d49`; documentazione consolidata in `5ef16228`.

- Corretti i quattro percorsi privi di pulizia esplicita: logout in `auth.js`, pulsante Home in `components-v129.js`, riautenticazione e uscita dall’aggiornamento password obbligatorio in `imposta_nuova_password.js`.
- Tutti i sette `signOut(auth)` applicativi sono preceduti da `clearSession()`. Nei percorsi nuovi il gestore viene importato soltanto quando si esce, mantenendo leggero il bootstrap pubblico.
- `tests/vault-logout.test.mjs` censisce i sette percorsi e prova il comando logout con il corpo reale dei moduli di sicurezza/sessione, sostituendo soltanto browser e Firebase. Verifica RAM e quattro chiavi di sessione eliminate prima della chiamata remota, anche quando questa fallisce; gli altri dati locali restano intatti.
- I messaggi dei gate distinguono terminologia e continuità funzionale dalla conformità crittografica.

<a id="evidenza-ae1482ca48e7cf3f57e9"></a>

**Impatto e rollback:** nessuna modifica a ciphertext, envelope, autenticazione, Rules o Functions. Se Firebase rifiuta il logout, la Vault resta priva del materiale locale già cancellato; il recupero richiede lo sblocco previsto dall’app. Il rollback è il revert del commit, senza migrazione dati.

<a id="evidenza-6232b9851f680207e606"></a>

**Validazione locale:** `npm test` completato con successo il 12/09/2026, inclusi build, gate statici, test Vault e suite Firestore/Storage negli emulatori. Rigenerati inventario e baseline delle 30 pagine; nessun collegamento relativo a file MD rotto. Il primo tentativo di build era impedito dai permessi di lettura della sandbox; la suite completa è stata poi eseguita con l’accesso locale necessario. Queste prove non sostituiscono i collaudi fisici elencati sotto.

<a id="fonte-docs-m10-revisione-locale-md-l1"></a>

## Fonte: M10_REVISIONE_LOCALE.md — righe originali 1–221

> Provenienza: `docs/M10_REVISIONE_LOCALE.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-m10-revisione-locale-md-m10--revisione-locale-preparatoria-della-parte-owasp-22092026"></a>

## M10 — Revisione locale preparatoria della parte OWASP, 22/09/2026

> **Stato:** revisione **locale e preparatoria**, su questo ramo e a questo commit. **Non** è la revisione
> OWASP finale, **non** è l'audit indipendente di crittografia e condivisione, **non** certifica l'app.
> M10-1 resta **aperto**.
> **Base:** ramo `integration/vault-shell-v127-security`, HEAD `2679285c`, versione `1.2.127`.
> **Metodo:** riuso dei controlli automatici già presenti nel repository + riesame mirato del codice sui
> percorsi a rischio più alto. **Nessuna modifica** a runtime, Functions, Rules, dipendenze o dati;
> nessun test nuovo è stato necessario: nessuna osservazione ha richiesto una prova aggiuntiva.
> **Riferimenti:** `docs/M10_HARDENING_RILASCIO.md`, `docs/PIANO_MATURITA_PROFESSIONALE.md` (M10),
> `docs/CENSIMENTO_GATE_M6_M10.md` (riga M10-1), `docs/ARCHITETTURA_SICUREZZA_V1.md`,
> `docs/AUDIT_PROGETTO_FASE2_STATICO.md`, `docs/AUDIT_VAULT_SESSION_P0.md`.

<a id="fonte-docs-m10-revisione-locale-md-1-ambito-e-limite-di-metodo"></a>

### 1. Ambito e limite di metodo

Esaminati: confini Auth/Vault, isolamento fra proprietari, condivisione e revoca, cifratura e gestione
delle chiavi, backup/ripristino, coda offline, dati sensibili in log e nel DOM, dipendenze di produzione.

<a id="evidenza-5f6adbb09c185845ca1e"></a>

**Non** esaminati o non dimostrabili qui: comportamento della console Firebase (App Check Enforcement,
Rules distribuite, indici, log), dispositivo fisico, copia non produttiva, penetrazione attiva, revoca di
un token già emesso, resistenza della crittografia a un attaccante con accesso al dispositivo. Questi
punti restano i gate esterni di M10 e **non** sono sostituiti da questo documento.

<a id="fonte-docs-m10-revisione-locale-md-2-controlli-automatici-rieseguiti-riuso-non-reinterpretazione"></a>

### 2. Controlli automatici rieseguiti (riuso, non reinterpretazione)

| Comando | Esito reale (22/09/2026) |
|---|---|
| `npm run test:release-hardening` | exit 0 — 5 header di sicurezza, **15 callable con App Check**, Rules vincolate all'UID |
| `npm run test:firestore-rules` | exit 0 — **65/65** test, `fail 0` |
| `npm run test:storage-rules` | exit 0 — **2 + 5 + 5** test, `fail 0` |
| `npm run test:security` | exit 0 (audit flussi + test di input/bootstrap/auth gate) |
| `npm run test:functions-security` | exit 0 |
| `npm run test:js-syntax` | exit 0 — **161 moduli** verificati |
| `npm run test:dependencies` | exit 0 — **nessuna dipendenza circolare** |
| `npm run test:static-references` | exit 0 — **235 file** |
| `npm run test:html-purity` | exit 0 — struttura separata da stile e comportamento inline |
| `npm run test:lightweight` | exit 0 — OCR/QR esclusi dal runtime pubblico |
| `npm run test:crypto` | exit 0 — 2/2 |
| `npm run test:sharing-prototype` | exit 0 — **38** test, `fail 0` |
| `npm run test:backup-prototype` | exit 0 — **99** test, `fail 0` |
| `npm run test:offline-write-prototype` | exit 0 — **121** test, `fail 0` |
| `npm audit --omit=dev` | **0 vulnerabilità note** nelle dipendenze di produzione (database locale, oggi; non è l'audit indipendente) |

<a id="fonte-docs-m10-revisione-locale-md-3-matrice-di-autorizzazione-degli-ingressi-esportati-letta-dal-codice"></a>

### 3. Matrice di autorizzazione degli ingressi esportati (letta dal codice)

24 ingressi esportati: 15 `onCall` con `enforceAppCheck: true` più trigger e schedulazioni. Per i
callable la tabella distingue dove sta il controllo, perché **i presidi vivono anche negli helper**:

| Ingresso | App Check | Autenticazione | Vincolo di proprietario |
|---|---|---|---|
| `applyOfflineMutation`, `applyPrivateAccountMutation` | sì | `request.auth` obbligatorio | `requireMutationOwner`: `data.uid === request.auth.uid`, altrimenti `MUTATION_OWNER_MISMATCH` |
| `trashSyncRecord`, `restoreSyncRecord` | sì | **in `runRecoveryCommand`**: `unauthenticated` senza sessione | percorsi costruiti su `users/{request.auth.uid}`; transazione con ricevuta idempotente |
| `restoreBackupChunk` | sì | `request.auth` obbligatorio | `expectedOwnerUid` validato dal chunk (`BACKUP_OWNER_MISMATCH` → `failed-precondition`) |
| `purgeArchivedAccount`, `manageSharedVaultData`, `manageAccountWidget`, `manageReceivedDeadline` | sì | `request.auth` obbligatorio | `expectedOwnerUid` presente nel corpo del callable |
| `createMfaRecoveryCodes`, `revokeAllSessions`, `sendDeadlinePushTest`, `deleteContactIfUnused`, `respondToInvitation` | sì | `request.auth` obbligatorio | percorsi costruiti sullo UID autenticato |
| `recoverMfaWithCode` | sì | **nessuna sessione per progetto** | primo fattore (password) verificato su Identity Toolkit, codice di recupero monouso, limite per email+IP (§4.7) |
| Trigger (`onInviteCreated/Written`, `onPrivateAccountWritten`, `onCompanyAccountWritten`, `onScadenzaCreated/Updated`) e schedulazioni (`checkDeadlines`, `purgeExpiredAuditEvents`) | non applicabile (non sono callable client) | n/d | girano con identità di servizio; non accettano input client |
| `getAppPresentation` (`onRequest`) | non applicabile | pubblica per progetto | sola presentazione, nessun dato del Vault |

<a id="evidenza-60aed336f36067066e7e"></a>

**Nessun callable che tratti dati di un proprietario risulta privo di autenticazione o di vincolo di
proprietario**, una volta considerati gli helper (`requireMutationOwner`, `runRecoveryCommand`,
`validateRestoreChunk`): una lettura della sola riga `exports.X = onCall(...)` avrebbe prodotto **falsi
positivi** (per esempio su `trashSyncRecord`).

<a id="fonte-docs-m10-revisione-locale-md-4-aree-di-codice-esaminate-ed-esito"></a>

### 4. Aree di codice esaminate ed esito

1. **Randomness e primitive.** `crypto.getRandomValues` **27** usi, `crypto.randomUUID` **25**,
   `AES-GCM` **39** riferimenti, `PBKDF2` **13**, `SHA-256` **11**, `SHA-1` **0** nel runtime.
   **Nessun** uso di `Math.random` per chiavi, IV, token o identificatori di idempotenza: i 5 usi
   rimasti sono id di riga nel DOM (`ma_cards.js:123,231,303`, `area_privata.js:208`) e un indice di
   colore (`ma_save.js:136`) — nessun valore di sicurezza.
2. **Derivazione delle chiavi (corretto il 22/09 dopo la revisione Codex).** Due parametri **distinti**:
   - **Vault:** verificatore e KEK a **600 000** iterazioni PBKDF2-SHA256 (`crypto-utils.js:14-15`,
     `VERIFIER_ITERATIONS`/`KEK_ITERATIONS`; `deriveKek` nell'involucro della chiave).
   - **Cifratura dei campi:** `ITERATIONS = 100000` (`crypto-utils.js:11`) è **attivo anche in
     scrittura**: `encrypt()` → `deriveKey()` (`:212` → `:176-187`) e `decrypt()` → `deriveKey()`
     (`:275`). **Non** è un residuo di sola lettura storica.
   Formato del valore cifrato: `salt(16) + iv(12) + ciphertext`, **senza** conteggio di iterazioni né
   marcatore KDF (`:209-225`, `:249-257`); `decrypt` usa il parametro fisso e prova i candidati del
   keyring (`encryptionKeyCandidates`, `:273`). **Conseguenza:** alzare il parametro **non** è una
   modifica di una riga — richiede ri-cifratura/migrazione di tutti i campi oppure un meccanismo di
   iterazioni candidate, quindi una decisione da prendere con l'audit.
   **Che cosa passa da `encrypt`** — **34 chiamate dirette** nei moduli (la definizione è
   `crypto-utils.js:197`), conteggiate con
   `git grep` escludendo `crypto.subtle.encrypt` e riprodotte con
   `rg --pcre2 '(?<!\.)\bencrypt\(' Frontend/public/assets/js/modules --glob '*.js'` → **35 righe**,
   cioè **34 chiamate + la definizione**: `azienda/form-azienda-save.js` **10**
   (`:65,66,67,69,70,71,80,88,90,91`) e `privato/form-privato-save.js` **8**
   (`:86,87,88,90,102,106,107,108`) — campi di Account aziendali e privati, comprese le credenziali
   bancarie; `azienda/ma_save.js` **5** (`:98,105,112,121,127`) e `privato/profilo-sync.js` **5**
   (`:60,68,69,78,92`) — dati aziendali e Profilo; poi `azienda/dati_azienda.js:156`,
   `data/account-widget-client.js:33`, `data/shared-vault-data-client.js:14`,
   `privato/profilo-actions.js:65`, `privato/profilo-widgets.js:56` e
   `shared/account-note-editor.js:25`.
   **Le 10 occorrenze di `crypto.subtle.encrypt` vanno classificate in tre gruppi distinti** (corretto
   il 22/09 dopo la revisione Codex, che ha rilevato la contraddizione precedente):
   **1 interna al flusso `encrypt()`** — `core/crypto-utils.js:214`, il passo AES-GCM della funzione
   stessa, che **segue** `deriveKey` a `:212` e quindi **usa** il PBKDF2 a 100 000;
   **2 nel flusso Vault a 600 000** — `core/crypto-utils.js:87` (`createVaultVerifier` →
   `deriveVerifierKey`, `VERIFIER_ITERATIONS`) e `core/crypto-utils.js:125` (`wrapVaultKey` →
   `deriveKek`, `KEK_ITERATIONS`);
   **7 operazioni WebCrypto separate da `crypto-utils.encrypt()`, con fonti di chiave diverse: alcune
   derivate, altre casuali o fornite dal chiamante** — nessuna passa da `crypto-utils.deriveKey` (quindi
   nessuna usa il parametro a 100 000 né quello a 600 000 *di quel modulo*), ma **non** tutte derivano
   una chiave: la classificazione puntuale, verificata una per una il 22/09 dopo le revisioni Codex R3-R5,
   è **HKDF-SHA256**: `core/sharing-identity.js:35` (`deriveWrappingKey`),
   `data/offline-mutation-queue.js:43` (`deriveOfflineQueueKey`),
   `shared/attachment-security.js:51` (`deriveAttachmentWrappingKey`); **chiave casuale**: chiave di file a
   32 byte per `shared/attachment-security.js:42`, chiave AES-GCM di sessione a 32 byte in
   `sessionStorage` per `core/vault-session.js:30` (`getSessionKey`); **chiave fornita dal chiamante**
   (PRF WebAuthn): `core/webauthn-manager.js:203` (`encryptVaultSecret`); **PBKDF2-SHA256 a 600 000
   iterazioni proprie**: `settings/backup-crypto.js:78` (`encryptBackupEntry` con la chiave di
   `deriveBackupKey`, parametro `KDF_ITERATIONS = 600000` a `:5`, passato a PBKDF2 a `:69-70`).
   Quindi il **600 000** compare in **due contesti distinti e non intercambiabili** — il
   verificatore/KEK del Vault in `crypto-utils.js` e il KDF del **file di backup** in
   `backup-crypto.js` — mentre la cifratura dei **campi** resta a 100 000; le altre operazioni usano
   HKDF, chiavi casuali o chiavi fornite dal chiamante.
   La versione precedente di questa mappa elencava per errore fra i call site di `encrypt`
   `attachment-security.js`, `sharing-identity.js`, `vault-session.js`, `webauthn-manager.js` e
   `offline-mutation-queue.js`, e fra i percorsi «autonomi» anche il passo interno `:214` e i due usi
   Vault a 600 000 (`:87`, `:125`).
   **Quale segreto entra:** `generateVaultKey()` produce 32 byte casuali; il keyring `CPVK2:` porta
   `primaryKey` (casuale) e `legacyKey` — e nei due call site di `security-manager.js:265,573` il
   `legacyKey` è la **Master Password**. Per i record cifrati con la chiave casuale le iterazioni contano
   poco (spazio delle chiavi già impraticabile); per il **percorso legacy** che ripiega sulla Master
   Password le 100 000 iterazioni sono l'unico fattore di lavoro.
3. **IV.** AES-GCM con IV a **12 byte** generati casualmente (`backup-crypto.js:76`); i valori a 24/32
   byte sono salt/chiavi. Nessun IV riusato in modo visibile nei percorsi esaminati.
4. **Segreti nel repository.** Nessuna chiave privata, nessun `.env` e nessun file di service account
   tracciati (`.gitignore:77`); `git grep` per chiavi private e `client_secret` non trova nulla.
   La **Firebase Web API key** compare in `push-messaging-client.js:12`, `firebase-messaging-sw.js:5` e
   `functions/index.js:664`: **non è un segreto** per progetto (identifica il progetto; i presidi sono
   App Check e Rules), ma va trattata come identificatore da limitare in caso di abuso.
5. **Dati sensibili nei log (limite del campione, corretto il 22/09).** Nei moduli di produzione ci sono
   **107** chiamate `console.*`; il **campione effettivamente esaminato** (moduli
   `crypto|backup|vault|session|security|offline-mutation|archive`) non registra password, chiavi o
   plaintext **per quanto visto**. Il campione **non** è esaustivo: `security-manager.js` registra un
   **oggetto errore** in **7** chiamate (righe 66, 112, 131, 185, 429, 488, 539), non solo nelle due
   citate in §5.1. Nessuna delle due affermazioni è una prova di sfruttabilità: sono igiene da
   completare — e le **9** chiamate sono state sanificate in M10-LOG-1 (§5.1), con l'elenco sopra
   riferito alle righe **prima** dell'intervento.
6. **DOM e iniezione.** Nessun `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval` o
   `new Function` nel codice applicativo: i DOM sono costruiti con `createElement`/`textContent`. I soli
   riscontri sono nei **bundle di terze parti** (`qrcode.min.js` costruisce una tabella via `innerHTML`;
   `firebase-runtime.js` è l'SDK compilato): §5.2.
7. **Percorso di recupero MFA senza sessione.** Limite per email+IP **fail-closed** (stato scritto prima
   della verifica, `resource-exhausted` oltre soglia), email conservata come hash SHA-256 nel documento
   dei tentativi, primo fattore verificato su Identity Toolkit (accetta `MFA_REQUIRED`), codice di
   recupero confrontato per hash e **monouso** (l'hash viene rimosso nella stessa transazione), messaggi
   d'errore **generici** e nessuna enumerazione degli account prima dell'accettazione del primo fattore.
8. **Condivisione e revoca.** Riusate le prove esistenti (38 test di condivisione, ciclo di revoca,
   sospensione inviti, regrant dopo ripristino) e i gate Rules: le letture del destinatario passano da
   `sharedWith` e i percorsi del proprietario restano vincolati dallo UID.
9. **Backup e ripristino.** 99 test del prototipo più le verifiche M8 di oggi (owner mismatch,
   collisioni, CAS per blocco, riferimenti orfani): nessuna nuova osservazione di sicurezza; i difetti
   già registrati restano di **robustezza**, non di autorizzazione.
10. **Coda offline e chiavi di sessione.** Il modulo della coda richiede Web Locks e **fallisce chiuso**
    se l'API manca (`OFFLINE_QUEUE_LOCKS_UNAVAILABLE`); la sessione Vault incapsula la chiave con
    AES-GCM. Resta il **P0 già noto e dichiarato**: la chiave di wrapping vive in `sessionStorage`
    (`vault-session.js:3,17`) — §5.4.
11. **Service worker.** Unico messaggio accettato: `SKIP_WAITING` (`sw.js:92`); cache limitata alla
    shell di stessa origine, senza Auth, Firestore, risposte callable o dati decifrati.

<a id="fonte-docs-m10-revisione-locale-md-5-osservazioni-nessuna-vulnerabilità-dimostrata-quattro-voci-da-assegnare"></a>

### 5. Osservazioni: nessuna vulnerabilità dimostrata, quattro voci da assegnare

Le voci seguenti **non** sono difetti dimostrati: sono igiene, ambito da chiarire o debito già noto.
Per un eventuale difetto l'incarico prevede prova e proposta di correzione, **senza** modificare il
codice qui.

1. **Igiene dei log — APPLICATA (M10-LOG-1, 22/09/2026; irrobustita in R1).** Le **9** chiamate che
   registravano l'**oggetto errore** (`security-manager.js:66,112,131,185,429,488,539` e
   `vault-session.js:40,70`, righe **prima** dell'intervento) ora emettono **solo un'etichetta
   diagnostica**, prodotta da `logErrorLabel(value)` (definito in `vault-session.js` e importato da
   `security-manager.js`). Due proprietà, entrambe verificate da test:
   - **solo etichette note** — l'helper accetta `code`/`name` soltanto se compare in una **lista chiusa**
     di codici/nomi diagnostici (`permission-denied`, `unavailable`, `not-found`, `failed-precondition`,
     `unauthenticated`, `OperationError`, `InvalidStateError`, `Error`); qualunque altro valore, **anche
     se sintatticamente valido come un segreto**, diventa `'Error'` (la sola verifica di forma non
     garantisce l'assenza di segreti: rilievo R1 di Codex);
   - **lettura protetta** — `code`/`name` sono letti dentro `try`/`catch`: un getter che lancia
     restituisce `'Error'` invece di propagare l'eccezione, così il flusso del chiamante resta quello
     originale (pulizia della sessione e ritorno `false`/`null` inclusi).
   Flusso degli errori e comportamento visibile **invariati**; **mai** oggetto, messaggio, stack, percorso
   o dati della cassaforte. Prove in `tests/vault-session.test.mjs` (**8** test): log nei percorsi di
   persistenza e ripristino, **codice valido ma sensibile** → `'Error'`, **getter che lancia** → nessuna
   eccezione e pulizia/ritorno invariati, valore non-`Error`, controllo meccanico sui due moduli; tre
   controlli di discriminazione (chiamata grezza ripristinata → rosso; allowlist sostituita dal solo
   pattern → rosso sul caso sensibile; protezione rimossa → rosso sul getter). L'helper non porta
   commento: è documentato qui e specificato dai test, per non incidere sul budget statico delle pagine.
   Il punto resta soggetto alla verifica di Codex.
2. **Bundle di terze parti con sink HTML.** `qrcode.min.js` usa `innerHTML` per la tabella di fallback;
   il contenuto deriva da dati QR generati dall'app (non HTML) e il contenitore è creato dalla libreria.
   *Proposta:* includerlo nell'ambito dell'audit indipendente e, se si vuole, sostituire la libreria con
   una versione che non usi `innerHTML`. Nessuna prova di sfruttabilità in questo laboratorio.
3. **PBKDF2 dei campi a 100 000 iterazioni, attivo in scrittura (esposizione dimostrata dal codice; impatto non dimostrato).**
   *Esposizione:* `ITERATIONS = 100000` (`crypto-utils.js:11`) è passato a PBKDF2 da `deriveKey` (`:176-187`)
   e raggiunto sia da `encrypt` (`:212`) sia da `decrypt` (`:275`): vale quindi **anche per i dati nuovi**.
   *Impatto:* dipende dall'entropia del segreto effettivo — per i record cifrati con la chiave casuale
   del keyring le iterazioni aggiungono poco, mentre nel **percorso legacy con la Master Password** sono
   l'unico fattore di lavoro; non è una vulnerabilità dimostrata in questo laboratorio. *Che cosa serve:*
   **audit indipendente** e una decisione su migrazione/ri-cifratura, perché il formato non memorizza il
   parametro. **Nessuna modifica applicata.**
4. **P0 noto, non chiuso da questa revisione.** La chiave di wrapping della sessione Vault vive in
   `sessionStorage` (`vault-session.js:3,17`): è il P0 legacy già dichiarato in
   `AUDIT_VAULT_SESSION_P0.md` e richiamato dal piano (`PIANO:683`). Bonifica della shell persistente,
   **non** di questa revisione; qui è registrata perché l'audit indipendente di gestione delle chiavi
   deve partire da questo stato.

<a id="fonte-docs-m10-revisione-locale-md-6-che-cosa-resta-esterno-e-non-è-stato-dichiarato-concluso"></a>

### 6. Che cosa resta esterno (e non è stato dichiarato concluso)

<a id="evidenza-fa75626fabe020e4dcd7"></a>

App Check Enforcement, Rules distribuite, indici e log dalla **console del progetto pubblicato**;
**audit indipendente** di crittografia e condivisione; matrice fisica iPhone/Windows; prova di backup,
cancellazione e ripristino su **copia non produttiva**; verifica esterna TTL/lifecycle (M7-2).
La revisione OWASP **finale** richiede una firma che questo documento non fornisce.

<a id="fonte-docs-m10-revisione-locale-md-7-dichiarazione-di-perimetro"></a>

### 7. Dichiarazione di perimetro

<a id="evidenza-0f636f989724670ba738"></a>

Nessuna modifica a runtime di produzione, Functions, Rules, dipendenze o dati; nessun commit di
correzione dell'app; nessun push, merge o deploy. Le osservazioni di §5 sono **proposte** in attesa di
una revisione Codex e di un incarico esecutivo distinto. **M10-1 resta aperto** e questo documento non
sostituisce né anticipa l'audit indipendente.

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-l1"></a>

## Fonte: M10_REVISIONE_PRIVACY_PRELIMINARE.md — righe originali 1–134

> Provenienza: `docs/M10_REVISIONE_PRIVACY_PRELIMINARE.md` a `2900ccc0`. Revisione preliminare datata. L’elenco delle decisioni aperte va letto con la successione registrata in DECISIONI; non è un parere legale. Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-m10-4--revisione-privacy-preliminare-mappatura-alle-fonti-del-repository"></a>

## M10-4 — Revisione privacy preliminare (mappatura alle fonti del repository)

> **Stato:** **REVISIONE PRELIMINARE di laboratorio**, per la revisione di Diego. **Non** è un parere
> legale, **non** è la revisione privacy finale, **non** chiude M10-4 né M6–M10 e **non** autorizza un
> go-live. M10-4 resta **aperto** (`docs/CENSIMENTO_GATE_M6_M10.md`, riga M10-4).
> **Base:** ramo `integration/vault-shell-v127-security`, HEAD `30b38835`, versione `1.2.127`.
> **Metodo:** solo fonti del repository (documenti e codice letti e citati); nessun dato reale, nessuna
> modifica a codice, test, Rules o Functions. Le decisioni del proprietario sono in
> `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md` (commit separato).

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-1-categorie-di-dati-e-dove-vivono"></a>

### 1. Categorie di dati e dove vivono

| Categoria | Dove vive | Fonte |
|---|---|---|
| Credenziali e campi sensibili dei record (Account privati/aziendali, banche, widget, credenziali comuni, note, scadenze, profilo) | **Firestore**, cifrati nel client (`encrypt`) con chiave del Vault; testo in chiaro **solo in memoria** dopo lo sblocco | `docs/DATA_ACCESS_CONTRACT.md` («Nessun dato decifrato viene conservato dal repository»); `modules/core/crypto-utils.js` |
| Metadati degli allegati | Firestore, sotto `users/{uid}/accounts/{aid}/attachments/**` e prefissi collegati | `docs/M7_RETENTION_CENSIMENTO.md` §5.1 |
| Byte degli allegati | **Firebase Storage**, sotto gli stessi prefissi | `storage.rules`; `docs/M7_RETENTION_CENSIMENTO.md` §5.4 |
| Identità e sessioni | **Firebase Auth**; copia locale gestita dall'SDK | `docs/M7_RETENTION_CENSIMENTO.md` §6.5 (T-23) |
| Copie sul dispositivo (cache di consultazione) | cache persistente di Firestore (IndexedDB), copie in memoria, bozze in `sessionStorage`; **al logout viene cancellata la sola sessione Vault** (`vault_session_v1`, chiave di wrapping, `vault_s_key`, `vault_s_expiry`), mentre bozze, cache IndexedDB, coda offline, `localStorage` e shell PWA **restano**; dopo il purge nessuna di queste viene evacuata | `docs/M7_RETENTION_CENSIMENTO.md` §6.5-6.6 (T-23, T-24; decisioni D10, D11); `vault-session.js:94-99` |
| Chiave di sessione del Vault | `sessionStorage` (chiave di wrapping + payload incapsulato) | `vault-session.js:3` (`getSessionKey`); **P0 noto** in `AUDIT_VAULT_SESSION_P0.md` |
| Coda offline cifrata | IndexedDB (contenitore cifrato, lease) | `modules/data/offline-mutation-queue.js`; `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` |
| Shell dell'app offline | Cache Storage del service worker (solo asset di stessa origine) | `sw.js`; `docs/M10_REVISIONE_LOCALE.md` §4.11 |
| Cronologia/audit tecnico | `users/{uid}/auditEvents` (nessuna interfaccia utente) | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:114-171` |
| Ricevute di idempotenza | `mutationResults/{uid}/operations`, `operationResults`, `archiveOperations`, `backupRestoreOperations` | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:129` |
| Backup esportato | **file locale dell'utente** (`.cpbackup`), fuori dal servizio | `docs/M8_BACKUP_RECUPERO.md`; `docs/M7_RETENTION_CENSIMENTO.md` §6.1 |
| Log tecnici | Console del browser e log di piattaforma Firebase; dal 22/09 i moduli di sicurezza registrano **solo un'etichetta diagnostica** | `docs/M10_REVISIONE_LOCALE.md` §5.1 (M10-LOG-1) |

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-2-flussi-e-destinatari"></a>

### 2. Flussi e destinatari

| Flusso | Verso dove | Fonte |
|---|---|---|
| Autenticazione, letture/scritture, upload/download | **Firebase/Google** (Auth, Firestore, Storage, Functions `europe-west1`) | `firebase.json`, `.firebaserc`, `functions/index.js` |
| Recupero MFA con codice | chiamata server-side a **Identity Toolkit** (`accounts:signInWithPassword`) | `functions/index.js` (`recoverMfaWithCode`) |
| Notifiche push | servizio push del browser/Firebase | `push-messaging-client.js`, `firebase-messaging-sw.js` |
| Controllo violazioni password (k-anonimato) | **nessuna rete**: integrazione disattivata; il laboratorio è testato senza rete | `docs/M9_SALUTE_CREDENZIALI.md:14,30` |
| Autofill/estensione browser | progetto separato, **non** nel bootstrap | `docs/M9_SALUTE_CREDENZIALI.md:18` |
| Analisi salute credenziali | **solo in memoria**, nessuna impronta persistita | `docs/M9_SALUTE_CREDENZIALI.md:12` |

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-3-conservazione-che-cosa-è-deciso-e-che-cosa-no"></a>

### 3. Conservazione: che cosa è deciso e che cosa no

| Voce | Stato attuale | Fonte |
|---|---|---|
| Cronologia tecnica `auditEvents` | **24 mesi** decisi dal proprietario (21/09/2026), job di cancellazione controllato dal backend, **implementato solo nel ramo, non distribuito** | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:116-118` |
| Eventi non databili | conservati come `unverifiable`, **mai** cancellati automaticamente | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:143` |
| Archivio Account (cestino) | **nessuna scadenza automatica**: permane fino alla cancellazione manuale | `docs/M7_RETENTION_CENSIMENTO.md` §7, D1 |
| Ricevute di idempotenza, backup, log di piattaforma, Account archiviati | **fuori** dalla retention dei 24 mesi | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:129` |
| Copie sul dispositivo (cache, bozze, copie di consultazione) | al **logout** viene cancellata la **sola sessione Vault in `sessionStorage`** (4 elementi, `vault-session.js:94-99`); restano bozze `sessionStorage`, envelope e verifier in `localStorage`, cache Firestore in IndexedDB, coda offline, shell PWA e file dell'utente. Dopo il **purge** nessuna di queste copie viene evacuata | `docs/M7_RETENTION_CENSIMENTO.md` §6.5-6.6, tabella M7-T23 (D10, D11) |
| TTL Firestore e lifecycle del bucket | **configurazione reale non verificata** (serve accesso esterno) | `docs/M7_RETENTION_CENSIMENTO.md` §11.1 (T-22) |
| Obblighi legali di conservazione | **dipendenza dichiarata**, nessuna deroga inventata (D8 rinviata) | `docs/M7_RETENTION_CENSIMENTO.md` §8 D8; `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:168` |

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-4-condivisione-e-revoca"></a>

### 4. Condivisione e revoca

- La condivisione usa `sharedWith` sull'Account e inviti; le letture del destinatario sono vincolate
  dallo UID (`docs/DATA_ACCESS_CONTRACT.md`; `firestore.rules`; 38 test di condivisione, ciclo di revoca,
  sospensione inviti, reinvito dopo ripristino).
- Il **purge del proprietario non tocca inviti né copie condivise**: l'invito resta leggibile dal
  destinatario con nome e identificativo dell'Account eliminato e lo stato `suspended`
  (`docs/M7_RETENTION_CENSIMENTO.md` §3.6; decisione **D14 aperta**).
- La cancellazione di un'**Azienda** è un singolo `deleteDoc` non ricorsivo: Account, byte e riferimenti
  restano (`docs/M7_RETENTION_CENSIMENTO.md` §3.5; **D13 aperta**).

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-5-backup-e-ripristino"></a>

### 5. Backup e ripristino

- Il file `.cpbackup` è **locale**: la prima riga è in chiaro (formato, `schemaVersion`, UID del
  proprietario, `backupId`, data, parametri KDF, cifrario) e il corpo è cifrato
  (`docs/M7_RETENTION_CENSIMENTO.md` §6.7; **D15 aperta**).
- La **Recovery Key** è a visualizzazione singola; senza di essa il recupero dei dati cifrati non è
  promesso (`docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`).
- Un ripristino può **ricreare** un Account già purgato, con byte e riferimenti, mentre la ricevuta di
  purge resta `purged` (`docs/M7_RETENTION_CENSIMENTO.md` §6.8; **D16 aperta**).
- Le interruzioni fra record e byte sono un **difetto osservato** con gate aperto
  (`docs/M8_BACKUP_RECUPERO.md`): riferimento senza byte dopo un upload fallito; nessuna compensazione.

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-6-log-e-diagnosi"></a>

### 6. Log e diagnosi

- Dal 22/09/2026 i nove punti dei moduli di sicurezza che registravano l'oggetto errore emettono **solo
  un'etichetta diagnostica** da lista chiusa (`docs/M10_REVISIONE_LOCALE.md` §5.1; commit `27c1c621`,
  `30b38835`). Restano le righe di log **applicative** preesistenti (contesto e identificatori), e i log
  di piattaforma Firebase, che **non** sono stati riesaminati qui.
- La procedura di incidente vieta di inserire password, Master Password, Vault Key o Recovery Key nei
  canali di supporto e chiede di annotare versione, orario e azione tecnica **senza dati personali**
  (`docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`).

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-7-interazione-dellutente-con-i-propri-dati"></a>

### 7. Interazione dell'utente con i propri dati

| Diritto/azione | Stato nel prodotto | Fonte |
|---|---|---|
| Consultare i propri dati | sì, dopo lo sblocco | `docs/DATA_ACCESS_CONTRACT.md` |
| Esportare un backup | sì, file locale cifrato | `docs/M8_BACKUP_RECUPERO.md` |
| Cancellare un Account | sì, con conferma forte; il purge lascia copie residue elencate | `docs/M7_RETENTION_CENSIMENTO.md` §3.4 |
| Cancellare copie sul dispositivo | **parziale**: al logout l'app cancella da sé solo la sessione Vault in `sessionStorage`; **nessun comando** cancella bozze, cache IndexedDB, coda offline, `localStorage` o shell PWA | `docs/M7_RETENTION_CENSIMENTO.md` §6.5-6.6; `vault-session.js:94-99` |
| Vedere la cronologia tecnica | **non previsto** (nessuna interfaccia) | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md` |
| Richiedere la cancellazione anticipata di un evento di audit | **non previsto** (registro non cancellabile dal client) | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:116` |
| Informative pubblicate | `privacy.html` e `termini.html` esistono; **contenuto non riesaminato qui** | `docs/CANONICAL_PAGE_REGISTRY.md` |

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-8-punti-incerti-e-dipendenze-nessuna-decisione-presa-qui"></a>

### 8. Punti incerti e dipendenze (nessuna decisione presa qui)

1. **Decisioni D1–D16: stato distinto, non «tutte aperte».**
   - **Decise:** **D3** — il registro tecnico `auditEvents` è conservato **24 mesi** con cancellazione
     controllata dal backend (decisione del proprietario del 21/09/2026), **implementata solo nel ramo e
     non distribuita**; la convenzione della finestra (mesi di calendario) è decisa e implementata
     (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:116,165`; `docs/CENSIMENTO_GATE_M6_M10.md:24`). **La durata
     non si richiede di nuovo.**
   - **Rinviata:** **D8** (obblighi legali di conservazione) — dipendenza dichiarata, nessuna deroga
     inventata (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:168`).
   - **Parziali:** **D3**, per le parti non coperte dalla durata (permanenza delle altre famiglie,
     rimozione della scrittura client sul registro, eventuale anonimizzazione al purge).
   - **Ancora aperte:** **D1, D2, D4, D5, D6, D7, D9, D10–D16** (durata del cestino, cancellazione
     immediata, residui del purge, backup e ricevute, messaggi all'utente, prova di irraggiungibilità,
     ordine di lavoro, copie sul dispositivo, copie di consultazione, residui alla rimozione, hard-delete
     di Azienda, copie condivise, intestazione del backup, ripristino dopo il purge), elencate in
     `docs/M7_RETENTION_CENSIMENTO.md` §8 e §10.
2. **TTL Firestore e lifecycle del bucket**: stato reale **non verificato** (T-22): richiede accesso
   esterno (`gcloud`), non deducibile dai file del repository.
3. **P0 della chiave di wrapping in `sessionStorage`**: aperto (`docs/AUDIT_VAULT_SESSION_P0.md`).
4. **PBKDF2 dei campi a 100 000 iterazioni**, attivo in scrittura e con ripiego sulla Master Password nel
   percorso legacy: da chiarire con l'audit indipendente, con migrazione necessaria per cambiarlo
   (`docs/M10_REVISIONE_LOCALE.md` §4.2).
5. **Audit indipendente di crittografia e condivisione** e **revisione OWASP finale firmata**: non
   eseguiti; domande in `docs/M10_DOMANDE_AUDIT_INDIPENDENTE.md`.
6. **Copie sul dispositivo e copie di consultazione**: comportamenti attuali verificati, decisioni di
   prodotto aperte (`docs/M7_DOMANDE_T23_CACHE_DISPOSITIVO.md`,
   `docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md`).
7. **Prove esterne mancanti**: matrice fisica iPhone/Windows, console del progetto (App Check
   Enforcement, Rules distribuite, indici, log), copia non produttiva, obblighi legali specifici.

<a id="fonte-docs-m10-revisione-privacy-preliminare-md-9-limiti-di-questa-revisione"></a>

### 9. Limiti di questa revisione

- È **preliminare e documentale**: si basa sulle fonti del repository a questo commit, non su un esame
  dei dati reali, dei log di piattaforma o delle configurazioni distribuite.
- **Non** è un parere legale e **non** sostituisce la revisione privacy finale né l'audit indipendente:
  per i profili legali e per i diritti degli interessati serve il referente competente (segnaposto in
  `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md`).
- **Non** chiude M6–M10 e **non** autorizza alcuna pubblicazione o go-live.

<a id="fonte-docs-m6-sincronizzazione-offline-md-l94"></a>

## Fonte: M6_SINCRONIZZAZIONE_OFFLINE.md — righe originali 94–679

> Provenienza: `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-m6-sincronizzazione-offline-md-controllo-candidato-dei-riferimenti-inversi--12092026"></a>

#### Controllo candidato dei riferimenti inversi — 12/09/2026

<a id="evidenza-d6cc6c66b313c3c28300"></a>

Base `1ce18fe2`, ramo sperimentale. La mutazione privata legge nella stessa transazione il Profilo `users/{uid}` e tutti i documenti diretti `users/{uid}/aziende`. Controlla `contactEmails`, `contactPhones`, `documenti`, `userAddresses[].utilities`, le email aziendali fisse/extra e `phoneAccountLinks`; `linkedAccountCompanyId` assente o vuoto identifica il riferimento privato. Contatti senza valore e aziende archiviate sono inclusi. I backlink nel solo Account non erano sufficienti.

<a id="evidenza-594f8b1da9a0405ab522"></a>

Il percorso ridotto rifiuta dati malformati e un campo legacy `id` diverso dall'ID fisico, senza migrare alias. Un retry con ricevuta attendibile viene risolto prima di queste letture e non riscrive il record. L'esito legacy non verificabile resta distinto. I test sintetici dell'handler coprono riferimenti inversi, separazione dal namespace aziendale, alias e assenza di scritture dopo rifiuto.

<a id="evidenza-67815f34ebddee818a88"></a>

Costo: per ogni operazione nuova si aggiungono il Profilo e la query completa delle aziende; letture, dimensione e contesa crescono con il numero delle aziende. La soluzione non tronca la query per dichiarare falsamente assenti i link. Valutazione di scala e latenza prima del rilascio; altri domini e bonifica degli alias non certificati. Nessun indice, migrazione o deploy in questo blocco. Il rollback strutturale deve comunque conservare il registro attendibile degli esiti, come richiesto nell'audit Vault.


<a id="fonte-docs-m6-sincronizzazione-offline-md-rifiuto-permanente-del-perimetro-e-scelta-esplicita--13092026"></a>

#### Rifiuto permanente del perimetro e scelta esplicita — 13/09/2026

<a id="evidenza-2d3250dc17a74cac9d5e"></a>

Base `141259d9`, candidato sperimentale. `PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED` non viene più presentato come errore temporaneo di rete: la coda conserva dentro il contenitore cifrato il motivo e il marker di riconciliazione, arrestando i retry automatici anche alla riapertura. La UI spiega che il record richiede la modifica completa. Consente di conservare la copia per decidere più tardi oppure eliminarla esplicitamente mantenendo il server; non la applica con il writer ridotto e non dichiara un salvataggio riuscito. Nessuna conversione automatica verso il percorso complesso.

<a id="evidenza-f35410d5cde74fce09c5"></a>

Verifiche locali: 31 test coda/sync/recupero, più 24 esiti nella suite Auth/Firestore emulata. I due nuovi scenari emulati comprendono 12 combinazioni di riferimenti inversi, inclusi contatti vuoti e aziende archiviate, namespace aziendale distinto, retry attendibile e assenza di variazioni a record, revisioni, updateTime e ricevute dopo rifiuto. Nessun dato reale. La scala della scansione e il recupero guidato della copia nel percorso complesso restano aperti. Nessuna migrazione o distribuzione backend.

<a id="fonte-docs-m6-sincronizzazione-offline-md-conferma-locale-del-comando-applicato--candidata-13092026"></a>

#### Conferma locale del comando applicato — candidata 13/09/2026

<a id="evidenza-5be608f179b2287baf35"></a>

La coda elimina soltanto il comando effettivamente inviato: decifra la versione attesa in memoria e confronta nuovamente il contenitore nella transazione IndexedDB finale. Se nel frattempo un'altra azione lo ha sostituito o marcato da riconciliare, conserva la coda e restituisce errore recuperabile senza dichiarare salvato. Enqueue non sovrascrive un ID già associato a contenuti diversi; il reinserimento identico conserva il contenitore esistente. Anche lo scarto esplicito usa una snapshot acquisita sotto lease e il controllo della sessione.

<a id="evidenza-6ce2fac139ec80d99908"></a>

Suite offline: 52 test superati, inclusa la regressione riprodotta della risposta tardiva che cancellava una riconciliazione. Nessun formato o schema IndexedDB modificato. Questo è un prerequisito del fallback senza Web Locks: lease con scadenza, fencing e coordinamento fra copie PWA richiedono un protocollo distinto; il gate resta aperto.


<a id="fonte-docs-m6-sincronizzazione-offline-md-coordinamento-indexeddb-candidato-non-attivato--13092026"></a>

#### Coordinamento IndexedDB candidato, non attivato — 13/09/2026

<a id="evidenza-c88f537293ea9146b51c"></a>

Il laboratorio offline-sync contiene un lease transazionale con token crescente: acquisizione, rinnovo e rilascio non permettono a un vecchio titolare di modificare il lease subentrato. La protezione della scrittura richiede la stessa transazione readwrite e lo stesso database della coda; errori, dati malformati, overflow e inversione dell'orologio interrompono la transazione. Nove test dedicati passano, 61 nella suite offline complessiva.

<a id="evidenza-215f15ab201bd5d21a6f"></a>

Il modulo non è importato dall'app e non aggiorna IndexedDB. Prima dell'integrazione servono store condiviso con le operazioni cifrate, adozione anche dal percorso Web Locks, controlli prima/dopo le attese e compatibilità delle copie PWA. La protezione vale per le mutazioni nella transazione, non garantisce callback o invii rete esclusivi dopo sospensione: eventuali duplicati dello stesso comando devono restare idempotenti. Nessun timer o annullamento può ritirare una richiesta già inviata. Il gate fallback e le prove fisiche restano aperti.

<a id="fonte-docs-m6-sincronizzazione-offline-md-coordinatore-comune-ai-due-percorsi--candidato-13092026"></a>

#### Coordinatore comune ai due percorsi — candidato 13/09/2026

<a id="evidenza-ceaaba4c73433559ce64"></a>

`experiments/offline-sync/hybrid-queue-coordinator.mjs` acquisisce sempre il medesimo lease IndexedDB, anche quando Web Locks è disponibile. Web Locks occupato o fallito non provoca un tentativo alternativo che aggiri il blocco. Il contesto controlla sessione e titolarità dopo le attese, espone rinnovo esplicito e scritture protette nella stessa transazione, e viene invalidato al termine. Il rilascio del vecchio titolare non modifica il lease di chi gli è subentrato.

<a id="evidenza-f8bbbbaa79cd3b8ff6c5"></a>

Sette nuovi test sintetici verificano contesa fra percorsi misti in entrambe le direzioni, errori, annullamento durante acquisizione/esecuzione, scadenza e subentro, impossibilità di scrivere con il vecchio contesto e mancata conferma di un risultato tardivo. Insieme ai nove test del lease costituiscono 16 prove locali; non sono un collaudo IndexedDB su browser reale.

<a id="evidenza-45fac6d0be570ef758e0"></a>

Nessun import nel runtime, aggiornamento dello schema o cutover. Restano da realizzare l'adozione sulla coda cifrata, la gestione delle copie PWA precedenti e i collaudi di sospensione su dispositivi. Il controllo della transazione non garantisce esclusività degli effetti di rete: restano necessarie le ricevute server idempotenti. Questo passo non chiude M6.


<a id="fonte-docs-m6-sincronizzazione-offline-md-apertura-e-durata-delle-connessioni--candidata-13092026"></a>

#### Apertura e durata delle connessioni — candidata 13/09/2026

<a id="evidenza-704cf7d5b702c1e0c505"></a>

Base `5b3cd4da`, ramo `experiment/m6-database-lifecycle`: l'apertura della coda runtime resta alla versione IndexedDB 1. Una connessione chiude su `versionchange`; apertura bloccata, annullata o oltre 10 secondi restituisce errore recuperabile, senza lasciare utilizzabile una connessione arrivata tardi. Una richiesta già abbandonata non inizializza successivamente lo store. La derivazione della chiave precede l'apertura: un errore crittografico non lascia una connessione senza proprietario. Il client passa il proprio controllo di sessione anche all'apertura.

<a id="evidenza-dad808b939fcd8ed5d60"></a>

Suite offline: 73 test superati, inclusi quattro nuovi scenari del ciclo di vita con fixture transazionali. Non viene cancellato il database, modificato il formato cifrato o installato lo store dei lease. Queste protezioni cooperano soltanto nelle copie dell'app che le includono; una PWA precedente può ancora bloccare l'upgrade. Prima di un futuro schema 2 servono distribuzione preparatoria, chiusura delle copie precedenti, collaudo browser reale e rollback che sappia leggere lo schema aggiornato. M6 rimane aperta.

<a id="fonte-docs-m6-sincronizzazione-offline-md-collaudo-browser-del-coordinamento-candidato--13092026"></a>

#### Collaudo browser del coordinamento candidato — 13/09/2026

<a id="evidenza-7abb46e5e08db461ca68"></a>

Base `44c7f077`. Runner locale `node experiments/offline-sync/run-browser-tests.mjs <percorso-browser>`: profilo temporaneo isolato, server soltanto loopback con allowlist di cinque moduli, nessuna connessione Firebase o dato reale. Sei scenari superati in Chrome headless 152 e Edge headless 153 su Windows: roundtrip cifrato IndexedDB; upgrade sintetico a schema 2 che chiude i lettori cooperativi e conserva byte del contenitore; rifiuto VersionError del lettore v1; contesa pagina/Worker con e senza Web Locks; fencing transazionale del vecchio titolare dopo subentro.

<a id="evidenza-1a897cc02bb629138794"></a>

Lo schema 2 esiste soltanto nel profilo di collaudo. La prova dimostra che il rollback al lettore v1 non sarebbe compatibile: non va usato un downgrade con cancellazione/ricreazione del database. La prossima integrazione deve mantenere lettori compatibili e ricevute idempotenti; nessun upgrade runtime autorizzato da questo test. Worker separati verificano contesti concorrenti ma non sostituiscono iPhone/iPad, sospensione reale o copie PWA produttive. Il browser di collaudo usa un profilo usa e getta e non tocca quello dell'utente.

<a id="fonte-docs-m6-sincronizzazione-offline-md-lettore-compatibile-in-sola-lettura--candidato-successivo-alla-12124"></a>

#### Lettore compatibile in sola lettura — candidato successivo alla 1.2.124

<a id="evidenza-bf84598a698bcd6d6588"></a>

Base integrata f4074ab5. Il laboratorio compatible-queue-reader.mjs legge snapshot dei contenitori cifrati negli schemi IndexedDB 1 e 2, apre senza imporre una versione e valida struttura e proprietario. Una coda assente resta assente; schema sconosciuto o malformato, cambio sessione, timeout e cambio versione causano rifiuto e chiusura della connessione, senza cancellazioni o riparazioni. Il lettore non restituisce il database e non espone scritture. Non decifra o autentica il contenuto: il successivo consumo deve usare il lettore crittografico esistente.

<a id="evidenza-da0466da1a966b450424"></a>

Undici scenari complessivi passati sia in Chrome headless 152 sia in Edge headless 153 con profili temporanei e dati sintetici: cinque nuovi scenari di compatibilità, oltre ai sei già presenti. Conservazione byte per byte verificata negli schemi 1 e 2; rifiuto di schema 2 malformato e schema 3 senza alterazione; invalidazione della sessione e mancata creazione di database assenti. Nessun dato reale, import runtime, migrazione o deploy. Il lettore serve come prerequisito di recupero/rollback, non rende sicure le vecchie scritture nello schema 2. Restano integrazione dei writer con il lease, distribuzione preparatoria delle copie PWA, gestione delle code grandi e matrice fisica.

<a id="fonte-docs-m6-sincronizzazione-offline-md-scritture-cifrate-sotto-coordinamento--candidato-di-laboratorio"></a>

#### Scritture cifrate sotto coordinamento — candidato di laboratorio

<a id="evidenza-2cac26507e655c6bb6e7"></a>

Base c82ceab0. fenced-queue-writer.mjs riusa derivazione e cifratura della coda canonica e il coordinatore ibrido. Inserimento, sostituzione, marcatura da riconciliare e rimozione confrontano il contenitore atteso e verificano il lease nella stessa transazione readwrite su encryptedOperations e queueLeases. Secondo controllo immediatamente prima delle scritture; nessuna crittografia asincrona dentro la transazione. Reinserimento identico conserva il ciphertext, sostituzioni conservano queuedAt, collisioni e conferme obsolete non eliminano dati. Il contesto trattenuto diventa inutilizzabile al termine del coordinamento.

<a id="evidenza-cb3592da30b5a53fa9cf"></a>

Sedici scenari complessivi superati sia in Chrome headless 152 sia in Edge headless 153: cinque nuovi gruppi per scritture, contesti scaduti, collisioni, subentro Worker e invalidazione sessione. Verificato roundtrip cifrato del marker di riconciliazione, senza motivo in chiaro nel contenitore. Suite offline canonica/laboratorio superata. Profili temporanei e soli dati sintetici.

<a id="evidenza-562cab9750aa68db595d"></a>

Il modulo richiede un database schema 2 già preparato nel laboratorio e non lo crea o aggiorna. Non è importato dai form o dal client di produzione: restano integrazione del ciclo completo lettura/sync/UI, distribuzione preparatoria, upgrade concordato, compatibilità PWA e prove fisiche. Il fencing protegge le scritture IndexedDB, non ritira richieste di rete già inviate: le ricevute server idempotenti restano necessarie. Nessuna modifica a dati reali, Hosting, Rules, Functions o formato cifrato. M6 resta aperta.

<a id="fonte-docs-m6-sincronizzazione-offline-md-client-di-sincronizzazione-sotto-lease--candidato-di-laboratorio"></a>

#### Client di sincronizzazione sotto lease — candidato di laboratorio

<a id="evidenza-b4964c4404c005a39615"></a>

Base 2a79917a. fenced-queue-client.mjs collega il writer cifrato al sincronizzatore canonico: elenco decifrato nella sessione protetta, invio con verifica del lease prima e dopo la risposta, conferma tramite rimozione CAS. Enqueue, replace e discard acquisiscono il medesimo coordinatore. Flush concorrenti sullo stesso client condividono la promessa; close e invalidazione impediscono nuovi invii, conferme tardive e aggiornamenti UI. Gli errori permanenti mantengono il marker cifrato di riconciliazione anche dopo riapertura del client.

<a id="evidenza-835360b106855043d686"></a>

Ventidue scenari browser passati sia in Chrome headless 152 sia in Edge headless 153, più 59 test offline canonici/laboratorio. I sei nuovi scenari coprono ritorno online, risposta persa con retry idempotente simulato, conflitto e scarto esplicito, riapertura del marker, subentro Worker durante invio, chiusura durante invio. IndexedDB è reale; le risposte del backend sono simulate in memoria, non costituiscono collaudo Firebase o attestazione delle ricevute server.

<a id="evidenza-0b14e3ad06c65d4c7665"></a>

Nessun import dai form, aggiornamento DB, worker produttivo, wakeup automatico o deploy. Restano collegamento al backend emulato, UI e lifecycle completo, rinnovo per invii lunghi, distribuzione preparatoria e upgrade dello schema con gestione delle copie PWA precedenti. Una richiesta di rete già inviata non può essere ritirata: il comando resta conservato per la riconciliazione/idempotenza server. M6 rimane aperta; produzione 1.2.124 invariata.

<a id="fonte-docs-m6-sincronizzazione-offline-md-browser-e-backend-originale-emulato--candidato-m6"></a>

#### Browser e backend originale emulato — candidato M6

<a id="evidenza-6ffa5cab848ede5fc148"></a>

Base 7f2886b9. Comando riproducibile Windows: node scripts/run-vault-session-emulators.mjs --fenced-browser. Il runner avvia Auth/Firestore demo-vault-shell e due browser headless isolati. Il ponte loopback verifica le variabili degli emulatori prima di importare Functions, limita il record alla fixture e autentica il contesto del comando con uno UID sintetico fisso per esecuzione. Nessun collegamento a Firebase reale. Le operazioni vengono cifrate nel browser con il modulo canonico e custodite dalla coda IndexedDB sotto lease.

<a id="evidenza-c64cd20374998a21f7fa"></a>

Cinque scenari superati in Chrome 152 ed Edge 153: applyOfflineMutation originale applica il ciphertext e produce una ricevuta vincolata; risposta persa dopo commit lascia il comando locale e il retry restituisce duplicate senza riscrivere; revisione obsoleta conserva coda e record; operationId riutilizzato con contenuto diverso viene rifiutato; proprietario del comando diverso dal contesto autenticato non modifica record o ricevute. Snapshot, revisione e timestamp verificati nell’emulatore. Dieci esecuzioni browser complessive; non sommare come nuovi casi della suite Node.

<a id="evidenza-adb8f5df44914e324ac4"></a>

Limiti: chiamata diretta handler.run tramite ponte locale, senza Functions HTTP, autenticazione del trasporto o verifica App Check. Il percorso testato è il dominio generico syncRecords; il collegamento browser con applyPrivateAccountMutation, le sue relazioni inverse, la UI e il rollout dello schema restano aperti. Le prove private esistenti sui soli emulatori rimangono distinte. Nessun deploy o migrazione produttiva, nessun incremento versione: Hosting resta 1.2.124.

<a id="fonte-docs-m6-sincronizzazione-offline-md-account-privati-nel-collaudo-browserbackend--candidato-m6"></a>

#### Account privati nel collaudo browser–backend — candidato M6

<a id="evidenza-e50efdd919d9f9821e60"></a>

Base 3b551a7a. Il runner --fenced-browser esegue ora il dominio generico e il dominio Account privato su Chrome ed Edge. Il ponte emulato seleziona applyPrivateAccountMutation originale e limita i preset di relazione ai soli documenti sintetici della fixture. Payload privato conforme con campi cifrati dal modulo canonico; nessun handler o writer di produzione modificato.

<a id="evidenza-89a2970dc442b8352104"></a>

Otto scenari privati passati per ciascun browser: i cinque casi di applicazione/retry/conflitto/riuso ID/proprietario, più riferimento inverso telefono Profilo, riferimento email vuota in azienda archiviata e retry attendibile dopo cambiamento delle relazioni. I due rifiuti di perimetro conservano in IndexedDB il marker cifrato PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED, non creano ricevute applicate e non cambiano il timestamp del record. Un secondo flush non richiama il trasporto per il marker. Una ricevuta server già verificata rimane autorevole dopo un nuovo collegamento e non riscrive il record.

<a id="evidenza-b2c6c329b0f042e2d059"></a>

Il comando completo passa 5 scenari generici e 8 privati in ognuno dei due browser: 26 esecuzioni complessive. Rimane invocazione diretta degli handler con contesto Auth sintetico; non certifica trasporto pubblico, App Check o autenticazione HTTP. Ancora aperti l’integrazione nella UI, rinnovo e chiusura del client sulle pagine, rollout dello schema e copie PWA, collaudi fisici. Nessun deploy, migrazione o modifica ai dati reali; versione online 1.2.124 invariata.

<a id="fonte-docs-m6-sincronizzazione-offline-md-pannello-note-e-confine-della-vista--candidato-m6"></a>

#### Pannello note e confine della vista — candidato M6

<a id="evidenza-6cff6828beb80cbaca5f"></a>

Base 7beb3dbf. offline-save-panel.mjs espone nota, Salva e Riprova sincronizzazione con stati distinti: in attesa offline, sincronizzazione, conferma, conflitto e riconciliazione. Riceve solo createClient/prepare autorizzati e il segnale della vista; nessun accesso a chiavi, SDK o database dal DOM. Dopo accodamento confermato la bozza visibile è svuotata e il secondo invio è disabilitato. Un tentativo incerto conserva lo stesso comando preparato per evitare nuovi identificatori. Chiusura durante factory/preparazione chiude il client tardivo e impedisce accodamenti fuori vista.

<a id="evidenza-2617e8e9fb458423f7c1"></a>

Il dettaglio della shell emulata accetta un mountSavePanel opzionale solo sul dominio privato, governato dal proprio AbortController anche alla rimozione manuale; il provider non è ancora configurato dall’entry principale. Il pannello è montato e collaudato nella fixture browser privata con backend emulato. Non viene attivato automaticamente sui dati dell’utente.

<a id="evidenza-23bddc5691762bac7636"></a>

Undici scenari privati e cinque generici per ciascuno di Chrome ed Edge: 32 esecuzioni browser/emulatore complessive. Tre casi UI aggiunti: nota offline poi sincronizzata, chiusura durante avvio, chiusura durante preparazione. Trentuno test mirati vista/sessione passati, inclusi teardown manuale, inizializzatore tardivo e esclusione aziendale. Resta collegare il provider autorizzato alla shell principale, aggiornare la vista dopo conferma, implementare recupero esplicito dei conflitti, styling definitivo e rollout dello schema. Nessun deploy o dato reale modificato; produzione 1.2.124 invariata.

<a id="fonte-docs-m6-sincronizzazione-offline-md-rinnovo-durante-gli-invii-lunghi--candidato-m6"></a>

#### Rinnovo durante gli invii lunghi — candidato M6

<a id="evidenza-223df2502a5b61990299"></a>

Base a7b7d1f8. Il client sperimentale accetta renewEveryMs opzionale, disabilitato per default e inferiore al TTL. Durante flush rinnova il lease senza sovrapporre rinnovi; errori impediscono conferme tardive. Timer rimossi a fine flush, abort o close. Un trasporto già avviato può terminare, ma la chiusura impedisce cancellazione della coda e aggiornamenti UI. Non è un servizio in background e non recupera lease scaduti.

<a id="evidenza-99ba84ac9a2d5338c6e7"></a>

Ventiquattro scenari IndexedDB reali passati su Chrome ed Edge, inclusi invio oltre TTL e chiusura durante invio; 73 test offline superati. Il worker del test temporizzato legge Date.now al momento dell'operazione, evitando timestamp congelati durante il passaggio di messaggi. Restano provider protetto, trasporto autenticato, rollout schema e prove fisiche. Produzione 1.2.124 invariata.

<a id="fonte-docs-m6-sincronizzazione-offline-md-conferma-della-singola-nota--candidato-m6"></a>

#### Conferma della singola nota — candidato M6

<a id="evidenza-44877a23bff753f7307d"></a>

Base 790d3d26. Il client emette onCommitted con soli operationId e recordId dopo conferma backend e rimozione protetta dalla coda. Errori del consumatore non riaccodano una scrittura confermata. Il pannello associa la conferma al proprio comando: uno stato saved dell'intera coda o il conflitto di un altro Account non possono confermare o smentire la nota. onSaved riceve solo lifecycle per rileggere il dettaglio; un errore di lettura indica che la nota è salvata e richiede riapertura, senza proporre un secondo invio.

<a id="evidenza-e2e81f908e1f8dfbc342"></a>

79 test offline superati, inclusi sei casi su identità, conferma singola, offline, errore refresh e abort. Il runner --fenced-browser supera ancora 32 esecuzioni Chrome/Edge e verifica la rilettura della nota dal backend privato emulato dopo conferma. Il provider principale rimane da attivare; nessuna modifica produttiva.

<a id="fonte-docs-m6-sincronizzazione-offline-md-rilettura-del-dettaglio-dopo-conferma--candidato-m6"></a>

#### Rilettura del dettaglio dopo conferma — candidato M6

<a id="evidenza-878d99d6567e64943227"></a>

Base ec8ced7d. Il dettaglio passa al provider opzionale onSaved, che rilegge l'Account attraverso la capability protetta e prepara i campi aggiuntivi fuori dal DOM visibile. Solo dopo lettura riuscita sostituisce i dati della vista e libera la vecchia nota. Letture concorrenti condividono lo stesso tentativo; errore conserva la vista precedente, mentre chiusura o blocco impediscono l'inserimento tardivo. Una password richiesta prima della rilettura non può apparire dopo la sostituzione del dettaglio.

<a id="evidenza-39a5fad6ac15c5dbab6a"></a>

155 test della shell superati, inclusi cinque nuovi casi di aggiornamento, errore, concorrenza, password tardiva e nota decifrata dopo chiusura. Suite npm test completa superata, compresi controlli statici, Functions, Rules ed emulatori. Provider principale e trasporto autenticato ancora da collegare: predisposizione della vista verificata, non attivazione delle scritture nella shell o in produzione. Rollback del candidato al checkpoint precedente senza migrazioni o modifica del formato dati.

<a id="fonte-docs-m6-sincronizzazione-offline-md-scarto-esplicito-del-comando-in-conflitto--candidato-m6"></a>

#### Scarto esplicito del comando in conflitto — candidato M6

<a id="evidenza-e90efc9a4f12472591ca"></a>

Base 7471d3c8. Il pannello propone Mantieni i dati online solo per il proprio operationId/recordId in conflitto o riconciliazione. Una seconda conferma elimina il comando locale tramite discard con lease e confronto del contenuto atteso; Annulla conserva la coda. Non modifica il record online e non invia altre operazioni. Marker di revisione inclusi nello snapshot; blocco o cambiamento della coda non vengono presentati come eliminazione riuscita. Chiusura della vista sopprime callback e notifiche tardive. onDiscarded rilegge il dettaglio attraverso la stessa capability protetta.

<a id="evidenza-c3d63dfc3abd5357084d"></a>

83 test offline e 155 test shell superati. Runner --fenced-browser: 12 scenari privati e 5 generici per ciascuno di Chrome ed Edge, 34 esecuzioni complessive. Il nuovo caso dimostra annullamento, eliminazione del solo comando e uguaglianza di record/timestamp Firestore emulati. Resta da costruire confronto completo e riproposizione esplicita della copia locale; nessun merge automatico, nuova migrazione o attivazione del provider nel bootstrap. Produzione 1.2.124 invariata.

<a id="fonte-docs-m6-sincronizzazione-offline-md-confronto-delle-note-in-conflitto--candidato-m6"></a>

#### Confronto delle note in conflitto — candidato M6

<a id="evidenza-6f95d034cff1a4ce44a5"></a>

Base 12d4e3f9. readConflictNotes confronta soltanto la nota cifrata del comando e quella del record corrente, attraverso lettore proprietario e capability di decifratura. Verifica UID, ID fisico, schema, dominio privato e revisione; cattura il ciphertext prima delle attese e interrompe il risultato su blocco o cambio sessione. Non prepara sostituzioni o scritture.

<a id="evidenza-953e5fff489c85731c98"></a>

Il pannello offre Confronta le note soltanto con provider esplicito e conflitto del proprio comando. Presenta i testi con textContent, distingue la nota online al momento della lettura e svuota il confronto su chiusura, conferma o variazione del conflitto. Una nuova notifica richiede nuovamente conferma prima dello scarto. Il provider principale resta non attivato.

<a id="evidenza-c2667410c5cd9b6d1c1e"></a>

90 test offline superati; 34 esecuzioni browser/backend emulato Chrome/Edge, con confronto reale delle note cifrate e verifica della coda intatta. Inventario aggiornato. Riproposizione della copia locale con nuova revisione, confronto degli altri campi, riapertura delle code pregresse e trasporto autenticato restano aperti. Nessun deploy, migrazione o mutazione dei dati reali.

<a id="fonte-docs-m6-sincronizzazione-offline-md-preparazione-della-riproposizione-della-sola-nota--candidato-m6"></a>

#### Preparazione della riproposizione della sola nota — candidato M6

<a id="evidenza-60376ebbfe0e4124ef5c"></a>

Base cc067a12. createConflictNoteProposal prepara, senza inviarla, una nuova operazione dopo confronto e conferma esplicita. Richiede evidenza noteOnly e assenza di riferimenti Profilo; rifiuta marker di riconciliazione e cancellazione tramite nota vuota, fuori dal preparatore corrente. Snapshot della fonte completa tramite la stessa validazione del preparatore canonico, revisione fissata a quella confrontata, nuovo operationId stabile nei retry. Cambia soltanto la nota e conserva gli altri campi della fonte aggiornata. Una nuova modifica online dopo il confronto dovrà essere rifiutata dal CAS backend, non incorporata implicitamente.

<a id="evidenza-c0b4ad719da967d4b9ee"></a>

95 test offline e 155 shell superati, inclusi validatore backend originale, snapshot, consenso, identità, perimetro e chiusura durante cifratura. Non collegato al pulsante UI, alla sostituzione transazionale della coda o al backend nel browser: questi passaggi e il recupero delle operazioni dopo riapertura restano da realizzare. Nessuna scrittura reale, migrazione o deploy.

<a id="fonte-docs-m6-sincronizzazione-offline-md-riproposizione-esplicita-dalla-ui--candidato-m6-cloud"></a>

#### Riproposizione esplicita dalla UI — candidato M6 cloud

<a id="evidenza-10a4c69c55bfa2b8e992"></a>

Base iniziale `65a5d0e7`. Il pannello candidato collega il confronto alla proposta protetta e mostra un secondo consenso dedicato prima di riproporre la sola nota. La sostituzione usa `client.replace(expected, replacement)`: lease e CAS sostituiscono atomicamente il comando confrontato, senza finestra elimina/accoda. L'identità della sostituzione viene associata alla vista prima del flush, così soltanto la relativa ricevuta può confermare la nota. Annullamento, lease non acquisito, variazione del conflitto e chiusura preservano la copia precedente e svuotano il testo decifrato. Nessuna chiave Vault raggiunge la vista.

<a id="evidenza-6126bfd44977752c9e54"></a>

Il laboratorio browser/backend prepara ora una nota locale sintetica, sostituisce il comando in conflitto e la inoltra a `applyPrivateAccountMutation` nell'emulatore; verifica nuova revisione e nuovo `operationId`, quindi conserva anche lo scenario di scarto senza mutazione online. Il runner accetta `CHROME_PATH` e `EDGE_PATH` e cerca percorsi Linux oltre a quelli Windows. Nel container cloud del checkpoint non erano installati Chrome/Chromium né Edge: gli scenari browser non sono stati eseguiti e non vengono dichiarati superati. L'avvio Auth/Firestore sul solo progetto `demo-vault-shell` è stato tentato, ma il JAR Firestore non era in cache e il download è stato impedito dalla rete dell'ambiente.

<a id="evidenza-d2eda91ef46b09db3476"></a>

Validazione cloud effettiva: installazioni riproducibili root e Functions completate; Java OpenJDK 25 rilevato; 97 test offline e 155 test shell superati. Provider protetto del bootstrap principale, trasporto autenticato, recupero delle code dopo riapertura, rollout schema e prove fisiche restano aperti. Nessun deploy, migrazione, dato reale o versione di produzione modificati; M6 rimane aperta.

<a id="evidenza-b29501d245ee2f8c2575"></a>

Revisione locale PR #59 (base `a3f7f28`, audit 68): la conservazione della copia precedente vale solo prima della sostituzione o quando il lease iniziale è certamente rifiutato. Il client espone `replacementApplied` per distinguere questo caso dal flush non acquisito dopo il replace. Un'eccezione dopo l'avvio della transazione non dimostra rollback: la vista conserva la nuova identità, disabilita lo scarto sul vecchio snapshot e offre solo retry della coda. Proposte tardive sono chiuse senza leggere il confronto dopo abort; scarto e confronto fallito revocano le relative azioni. 101 test offline, suite completa e Chrome/Edge con backend emulato passati localmente; prove Linux cloud ancora da eseguire.


<a id="fonte-docs-m6-sincronizzazione-offline-md-collaudo-finale-dellambiente-linux-cloud"></a>

#### Collaudo finale dell'ambiente Linux cloud

<a id="evidenza-d77909c30ba3e7ab3f7d"></a>

Su discendente verificato di `bdb95236`, setup e fixture effettivi confermano browser, Java e cache Firestore. La suite completa arriva al gate Storage ma la cache Storage non era inclusa nello setup consolidato; la rete già disattivata impedisce di recuperarla durante la fase agente. Il runner Chrome/Edge ha inoltre richiesto `--no-sandbox` perché il container esegue come root. Entrambe le compatibilità sono corrette nel candidato: cache Storage durante il setup con rete e flag browser limitato a Linux root. Il runner corretto supera 34 scenari sintetici complessivi su Chrome ed Edge. La riesecuzione completa dopo un nuovo setup resta il solo blocco del collaudo ambiente; provider, trasporto, riapertura e rollout restano gate M6 separati e non avviati.


<a id="fonte-docs-m6-sincronizzazione-offline-md-chiusura-del-trasferimento-linux-cloud--ambiente-nuovo"></a>

#### Chiusura del trasferimento Linux cloud — ambiente nuovo

<a id="evidenza-83d6450ede3f93c13868"></a>

Base iniziale `3070d01d`, ambiente ricaricato nella stessa shell e cache Firestore/Storage entrambe presenti. Dopo aver instradato direttamente soltanto gli host loopback esatti tra emulatori, conservando il `ProxyAgent` originale per ogni altra destinazione, la suite completa è passata realmente su Linux. Il runner fenced ha superato 34 esecuzioni complessive, 5 generiche e 12 private per ciascuno di Chrome 153 ed Edge 153, usando esclusivamente fixture sintetiche, Auth/Firestore demo e handler originali emulati.

<a id="evidenza-ddf8dbe9cdd949f4dc74"></a>

Questo esito chiude il trasferimento del laboratorio cloud, non M6. Restano aperti provider protetto del bootstrap della shell persistente, trasporto autenticato e App Check, recupero delle code dopo riapertura, rollout dello schema e collaudi fisici. La direzione resta la shell persistente con Vault Key esclusivamente in memoria; nessun deploy, migrazione o dato reale.

<a id="fonte-docs-m6-sincronizzazione-offline-md-recupero-della-nota-dopo-riapertura--candidata-14092026"></a>

#### Recupero della nota dopo riapertura — candidata 14/09/2026

<a id="evidenza-e4ae04f6c818933123c2"></a>

Base `b5ab595c`, ramo `experiment/m6-reopen-pending-note`. Il client sotto lease può identificare la singola operazione pendente di un record restituendo soltanto operationId/recordId. Più comandi per lo stesso record interrompono il recupero senza invii o cancellazioni. L'editor con recoveryRecordId esplicito verifica la coda prima di consentire un nuovo salvataggio: una modifica presente conserva la propria identità, svuota l'input e permette soltanto la ripresa esplicita. La conferma resta legata alla ricevuta esatta; conflitti e riconciliazioni riaprono le scelte già previste.

<a id="evidenza-26b1c0fbdd7caf0d5ed5"></a>

Test DOM: ripresa senza nuova preparazione, ricevuta corretta, riconciliazione, coda vuota, lock negato/risultato incoerente e chiusura durante la lettura. Chrome/Edge con backend originale emulato verificano anche ambiguità, chiusura effettiva della connessione IndexedDB e nuova apertura con la stessa chiave sintetica, senza upgrade. Restano separati riapertura fisica PWA, rilascio preparatorio dello schema, provider bootstrap e trasporto reale: nessun cutover o migrazione è implicito.

<a id="fonte-docs-m6-sincronizzazione-offline-md-dismissione-del-writer-e-del-client--candidata-14092026"></a>

#### Dismissione del writer e del client — candidata 14/09/2026

<a id="evidenza-a5d21263b32dd71194b3"></a>

Base `d4d2e644`, ramo `experiment/m6-queue-client-disposal`: close rilascia il riferimento alla chiave derivata e impedisce nuove esecuzioni. Anche le operazioni già entrate nel coordinatore verificano il writer ancora attivo prima di toccare la coda. Il client chiude il writer su abort e rimuove il listener; il materiale passato alla derivazione viene rilasciato dopo il suo completamento, compreso il riferimento nelle opzioni del client.

<a id="evidenza-3c4b08c1d8dc54c0b280"></a>

106 test offline superati; Chrome/Edge con backend emulato superati, 7 scenari generici e 15 privati per browser (44 esecuzioni). Verificati close durante un'operazione sospesa e abort del client: comandi locali conservati e nessun invio. L'ulteriore guardia sul tipo isActive è verificata dalla suite finale. Non si annullano retroattivamente una richiesta server o Web Crypto già partita e non si dichiara azzeramento fisico della memoria. Provider bootstrap, trasporto e rollout rimangono aperti; nessuno schema, upgrade o deploy.

<a id="fonte-docs-m6-sincronizzazione-offline-md-adattatore-firebase-della-coda--candidata-14092026"></a>

#### Adattatore Firebase della coda — candidata 14/09/2026

<a id="evidenza-7ab80f9ff7aa18ec9e28"></a>

Base `82ab2002`, ramo `experiment/m6-firebase-queue-adapter`: il client fenced può usare i callable SDK canonici applyPrivateAccountMutation/applyOfflineMutation. Richiede Auth e Functions della stessa Firebase App, UID attuale, dominio esplicito e segnale di durata del Vault/vista. Osserva Auth, invalida il client su cambio identità o abort, chiude anche un client arrivato tardi e rilascia il riferimento al materiale della coda nelle proprie opzioni. Il comando è copiato prima delle attese SDK; domini o proprietari diversi vengono rifiutati prima dell'invio. I token Auth/App Check restano gestiti dall'SDK, senza header costruiti dall'adattatore o persistenza aggiunta.

<a id="evidenza-a85ce625750786444e3f"></a>

113 prove offline superate; suite completa npm test superata prima dell'ultima regressione aggiunta, poi suite offline rieseguita. Chrome/Edge superano 9 scenari generici e 17 privati per browser (52 esecuzioni): IndexedDB, SDK Firebase originale, login Auth emulato, verifica JWT tramite Admin emulator e handler originali su Firestore demo. Il bridge richiede un header App Check sintetico: l'assenza viene rifiutata senza scrittura. Non è una certificazione del middleware onCall o dell'attestazione App Check remota.

<a id="evidenza-0a00bafdabd5cc934c15"></a>

Una risposta volutamente trattenuta dopo il commit prova che abort conserva il comando locale; un nuovo client risolve il retry con la stessa ricevuta senza cambiare updateTime. L'SDK callable ordinario installato non offre AbortSignal per interrompere la richiesta: dopo l'invocazione un effetto remoto può ancora avvenire, anche durante le attese interne dei token. Il client non lo presenta come rollback e non accetta una risposta tardiva nella sessione chiusa. Provider bootstrap, rollout schema/PWA, trasporto con middleware remoto e prove fisiche restano aperti. Nessuna attivazione runtime, upgrade, nuova cifratura, versione o deploy.

<a id="fonte-docs-m6-sincronizzazione-offline-md-coda-posseduta-dalla-shell--candidata-14092026"></a>

#### Coda posseduta dalla shell — candidata 14/09/2026

<a id="evidenza-5927be078b8daa999124"></a>

Base `32db005f`, ramo `experiment/m6-shell-owned-queue`: il Vault in memoria può aprire la coda tramite una factory configurata soltanto dal bootstrap. La factory riceve il materiale della Vault già sbloccata e un contesto UID/dominio/segnale; alla chiamante viene restituita una facciata con soli enqueue, flush, pendingForRecord, discard, replace e close. Chiavi, database, SDK e proprietà extra della factory non attraversano la facciata. Le route continuano a ricevere soltanto i servizi già previsti, senza openMutationQueue: sarà il provider del pannello a collegare le azioni circoscritte al record.

<a id="evidenza-214ab2d09e3a4b0260cc"></a>

Blocco, timeout, cambio identità, navigazione con il segnale della vista e logout anche fallito chiudono tutte le code possedute. Client arrivati dopo dismissione vengono chiusi; risposte tardive non raggiungono la sessione successiva. Il controllo UID si ripete anche se la notifica Auth è ritardata. Errori di una chiusura non impediscono le altre. Non esiste garanzia di cancellazione fisica dello heap o annullamento di richieste remote già invocate.

<a id="evidenza-c7c985c22b90b497a769"></a>

Suite completa npm test superata, inclusi 165 test shell (10 nuove regressioni di proprietà/lifecycle) e 15 test del collegamento Firebase emulato. La prova Firebase verifica che la factory riceva il materiale realmente estratto dall'envelope di prova. Le 52 esecuzioni Chrome/Edge passano ora attraverso Vault/sessione proprietaria prima dell'SDK: lock dopo commit conserva la coda; nuovo unlock risolve il retry senza riscrittura. App Check resta sintetico nel bridge. Restano provider UI per record, attivazione dell'entry, rollout IndexedDB/PWA e verifiche remote/fisiche. Nessuna migrazione, nuova cifratura, master, bump o deploy.

<a id="fonte-docs-m6-sincronizzazione-offline-md-provider-della-nota-privata--candidata-14092026"></a>

#### Provider della nota privata — candidata 14/09/2026

<a id="evidenza-eb102eda0ffc6ef57ec5"></a>

Base c4e1a1a8, ramo experiment/m6-private-note-provider. Il provider collega il pannello della nota a openMutationQueue della shell e prepara il comando canonico sulla revisione mostrata, conservando gli altri campi. Espone al pannello soltanto operazioni circoscritte al record selezionato; UID, segnale della vista e del Vault vengono controllati anche dopo le attese. Gli observer della coda attraversano le stesse guardie e non notificano una sessione successiva. Una ricevuta di un altro record non aggiorna la vista.

<a id="evidenza-c055c1321fc6613525d3"></a>

Il readSource fidato deve fornire documento completo, proprietario e prova esplicita di assenza di collegamenti al profilo. Il provider non inventa tale prova e non viene attivato nell'entry principale. Restano i limiti del preparatore: account privato isolato con schema compatibile, nessun campo sconosciuto o banca/condivisione, cancellazione della nota vuota esclusa da questo incremento. Una proposta di conflitto richiede il comando esatto preparato nella stessa vista; dopo riapertura, senza provenienza durevole della modifica alla sola nota, resta il confronto in sola lettura con le azioni di recupero già previste.

<a id="evidenza-d1d260b28f97e8cb7a61"></a>

Suite completa npm test superata; dopo l'aggiunta della prova di integrazione con il pannello reale, suite shell rieseguita: 178 test superati. La suite offline include la regressione del confronto senza proposta. Chrome/Edge: 52 esecuzioni demo esistenti superate; verificano coda/sessione/SDK, non ancora il nuovo provider nel browser. Il provider è verificato con fixture e pannello DOM simulato, compresi cambio UID senza notifica Auth, risposte tardive e conferma legata alla ricevuta. Restano collegamento dell'entry con lettore fidato, prova browser dedicata al provider, rollout schema/PWA e collaudi remoti/fisici. Nessun master, versione, migrazione o deploy.

<a id="fonte-docs-m6-sincronizzazione-offline-md-lettore-fidato-e-prova-browser-del-provider--candidata-14092026"></a>

#### Lettore fidato e prova browser del provider — candidata 14/09/2026

<a id="evidenza-06b153ae41a2194428ca"></a>

Base 840128de, stessa PR #63 e ramo experiment/m6-private-note-provider. Il lettore Firebase usa getDocFromServer per Account e profilo e getDocsFromServer per tutte le aziende, senza filtrare contatti nascosti o aziende archiviate. Riusa la policy pura del backend per i collegamenti inversi: niente seconda interpretazione dei campi. Cache, scritture pendenti, documenti mancanti, alias incoerenti e cambio UID durante la lettura impediscono il montaggio. La query richiede al massimo 201 aziende: oltre 200 il percorso resta indisponibile, senza scambiare una lista troncata per assenza di collegamenti. Il proprietario viene fornito come metadato del percorso autenticato quando manca nel documento, senza migrazione; un valore esplicito discordante resta rifiutato.

<a id="evidenza-50e15e8b3219bdd8e955"></a>

La prova browser usa ora il vero provider e pannello, lettura dei profili tramite SDK Firestore, coda della shell, SDK callable e handler emulato. Controlla anche collegamenti inversi personali e aziendali prima del montaggio. I test unitari coprono assenza di prove e risposte tardive. Queste letture non sono una transazione con il futuro salvataggio: il backend ricontrolla comunque lo scope nella transazione di modifica. La prima apertura richiede rete; l'apertura iniziale offline non è chiusa da questo incremento.

<a id="evidenza-178d663753200ddb6833"></a>

L'entry del laboratorio resta in sola lettura: occorre ancora collegare trasporto locale, disponibilità della coda e gestione delle sorgenti non compatibili, senza rompere la consultazione degli altri Account. Non sono introdotti upgrade IndexedDB, attivazione in produzione, versione o deploy. App Check rimane sintetico nel bridge; rollout PWA e verifiche remote/fisiche restano aperti.

<a id="evidenza-f636e27ad49e91eedb4c"></a>

Validazione finale audit 80: npm test completo superato (183 test shell e 114 offline inclusi); Chrome/Edge superati, 9 scenari generici e 20 privati per browser, 58 esecuzioni totali. Compresi lettore Firebase reale, blocco dei link inversi e salvataggio del provider. App Check resta sintetico e il laboratorio principale non è ancora attivato.

<a id="fonte-docs-m6-sincronizzazione-offline-md-attivazione-nellingresso-del-laboratorio--candidata-14092026"></a>

#### Attivazione nell'ingresso del laboratorio — candidata 14/09/2026

<a id="evidenza-96d8e386d13ba4cfa565"></a>

Base 8343282e, stessa PR #63. L'entry Firebase locale collega provider, lettore fidato e coda posseduta dalla shell. Il laboratorio crea solo code nuove e vuote in schema 2 sull'origine fissa http://127.0.0.1:4188; una coda schema 1 non viene aggiornata. La connessione segue la durata della vista/Vault. Il bridge accetta solo JWT degli utenti fittizi appena predisposti, header App Check sintetico e record privato alfa: invoca l'handler originale negli emulatori, mai Firebase remoto.

<a id="evidenza-66ecae85f786a458ed6b"></a>

Il preparatore verifica la compatibilità prima di mostrare l'editor. Account non compatibili o letture indisponibili mantengono il dettaglio consultabile e un messaggio generico. La prova dell'entry ha individuato una rilettura dalla cache dopo la ricevuta: il refresh ora usa il repository canonico server-confirmed senza fallback alla vecchia nota. Il documento non viene ricaricato e il Vault resta gestito dalla shell.

<a id="evidenza-0cc37c60aeb9c1b8c2cb"></a>

Collaudo dedicato: node scripts/run-vault-session-emulators.mjs --entry-browser. Apre Chrome/Edge con profili temporanei, esegue login, Master Password sintetica, modifica della nota, conferma della nuova nota visibile, consultazione di Zeta incompatibile e blocco della vista. Nessuna credenziale reale. Il laboratorio interattivo si avvia con il comando già esistente prototype:vault-emulators. Questa attivazione non riguarda l'anteprima pubblicata o la PWA di produzione. Restano apertura iniziale offline, rollout schema/PWA, compatibilità estesa, App Check remoto e dispositivi fisici; nessun bump, master o deploy.

<a id="evidenza-ada9e7634d901b96c227"></a>

Validazione finale audit 81: suite completa npm test superata, inclusi 189 test shell e 114 offline. Regressioni Chrome/Edge della coda: 58 esecuzioni superate. Nuovo collaudo dell'entry: 5 verifiche per browser, 10 esecuzioni superate (68 totali). Dopo le ultime guardie di chiusura, rieseguiti i 21 test mirati di coda/dettaglio e il collaudo dell'entry. Nessuna prova App Check remota o su dispositivo fisico.

<a id="fonte-docs-m6-sincronizzazione-offline-md-recupero-della-coda-con-rete-browser-disabilitata--candidata-14092026"></a>

#### Recupero della coda con rete browser disabilitata — candidata 14/09/2026

<a id="evidenza-36c0f0727bbcd3e0e38c"></a>

Base 48b1eae6, stessa PR #63. Quando navigator.onLine segnala offline, il provider non richiede nuove prove al server: monta esclusivamente il recupero della coda per il record selezionato. Il pannello nasconde il nuovo editor, conserva l'identità del comando e permette la ripresa esplicita. Una coda vuota non autorizza a preparare una modifica. Tornare online non trasforma questo pannello in un editor: per nuove modifiche serve riaprire il dettaglio e verificare le sorgenti. Errori dei controlli eseguiti online non vengono degradati automaticamente a prove offline.

<a id="evidenza-674450372cf58039cfab"></a>

Il collaudo --entry-browser usa il protocollo DevTools sul solo target temporaneo per disabilitare e ripristinare davvero la rete; un fetch HTTP deve fallire durante l'assenza di rete. Verifica nota preparata dopo una lettura online e salvata offline, blocco del Vault, nuovo sblocco offline, lettura dei dati già disponibili, riapertura del record e recupero della stessa coda. Un retry ancora offline conserva la modifica; dopo il ritorno online, il retry esplicito riceve conferma e aggiorna il dettaglio. Il PC e gli altri browser restano connessi.

<a id="evidenza-6852dd60641dc403a8fa"></a>

Il test parte da una sessione autenticata e una cache già popolata: non certifica avvio a freddo senza rete, nuova autenticazione offline, riapertura fisica della PWA, consultazione bancaria o migrazione delle code. Non viene persistita alcuna Vault Key e non si aggiunge una cache di prove sui collegamenti. Restano rollout schema/PWA, compatibilità estesa e verifiche remote/fisiche; nessuna modifica a master, versione o deploy.

<a id="evidenza-6a290a10a02522ca436a"></a>

Validazione finale audit 82: npm test completo superato, inclusi 191 test shell e 116 offline. Chrome/Edge: 58 regressioni coda/provider e 18 verifiche dell'entry (9 per browser), 76 esecuzioni totali. La rete viene disabilitata dal protocollo DevTools, con HTTP effettivamente bloccato; superati recupero, nuovo sblocco offline e retry al ritorno online. Questa prova non certifica avvio a freddo o PWA fisica.

<a id="fonte-docs-m6-sincronizzazione-offline-md-matrice-di-consultazione-dei-domini-già-caricati--candidata-14092026"></a>

#### Matrice di consultazione dei domini già caricati — candidata 14/09/2026

<a id="evidenza-db3a55c72d8930cb7d86"></a>

Base 3af7006b, stessa PR #63. L'audit dei lettori ha rilevato che le password degli Account collegati ai contatti nei profili privati e aziendali usavano sempre il server. La sola consultazione ora usa il repository ordinario/cache quando il browser è offline; online conserva la lettura confermata. Account assenti, archiviati, proprietario discordante o cambio sessione non vengono decifrati/esposti. I percorsi di modifica e verifica dei collegamenti non sono trasformati in letture offline.

<a id="evidenza-15f5bc32db025e97fe6f"></a>

Il laboratorio carica esplicitamente una matrice sintetica, poi disabilita la rete tramite DevTools e legge gli stessi dati dal repository canonico, decifrandoli attraverso la capability del Vault dopo nuovo sblocco. La query e il campo devono essere già disponibili. Una lettura di documento mai caricato deve fallire: non viene presentata come dato vuoto valido.

| Area | Esito coperto dalla matrice | Limite ancora aperto |
|---|---|---|
| Account personali e aziendali | Presenza nelle liste e password cifrate già caricate | Non tutte le schermate/categorie o installazioni reali |
| Profili, email, telefoni, indirizzi e documenti | Lettura e decifratura dei campi sintetici del profilo | Non certifica foto, tessera QR e contenuto dei documenti |
| Banca e carte | IBAN personale/aziendale, PIN e CCV già presenti nel documento; dal 18/09/2026 anche seconda banca e seconda carta, Widget bancari, cache mancante e riapertura (matrice M6-CLOSE) | Gate iPhone e byte Storage restano aperti |
| Widget del profilo e scadenze | Dati sintetici letti dal repository/cache | Widget Account, credenziali condivise e altre varianti non inclusi |
| Allegati | Nome e metadati Firestore già caricati | I byte su Storage usano getBytes e non hanno cache offline esplicita |
| Avvio da app chiusa | Non coperto | Autenticazione, asset e cache persistente devono essere collaudati insieme |

<a id="evidenza-de4a491c7a8a910541d6"></a>

La matrice verifica disponibilità e decifratura, non tutte le UI di produzione. Il laboratorio usa dati fittizi e la sessione già autenticata; non garantisce preparazione automatica dell'intero archivio o assenza di espulsione della cache sul telefono. Nessuna cache aggiuntiva di chiavi o file, migrazione, master, versione o deploy.

<a id="evidenza-d7d8233e745b45b89eec"></a>

Validazione finale audit 83: npm test completo superato (inclusi 191 test shell, 116 offline e 65 test dei collegamenti dei profili). Collaudo entry su Chrome ed Edge: 25 verifiche per browser, 50 esecuzioni superate, con rete DevTools disabilitata e ripristinata. Questa matrice certifica letture dei dati sintetici già caricati nella sessione del laboratorio, non avvio a freddo, tutte le UI o file Storage offline.

<a id="fonte-docs-m6-sincronizzazione-offline-md-audit-84--ciclo-onlineoffline-e-blocco-della-consultazione-14092026"></a>

#### Audit 84 — ciclo online/offline e blocco della consultazione (14/09/2026)

<a id="evidenza-51e2750e49c31d3d89ed"></a>

Base 2dc18daa, stessa PR #63. Il collaudo dell'entry verifica esplicitamente che la matrice dei dati già caricati sia ancora consultabile dopo il ritorno online e che il probe protetto rifiuti la lettura dopo blocco del Vault, sia offline sia online. Chrome ed Edge: 28 verifiche per browser, 56 esecuzioni superate con emulatori e fixture locali. Modifica limitata al collaudo: nessun cambiamento runtime produttivo. La suite completa resta quella superata sul checkpoint precedente; non viene dichiarata rieseguita in questo incremento.

<a id="evidenza-661d082c54fed1d62db6"></a>

Programma: avanzamento della verifica M6, senza chiusura globale. Restano avvio a freddo/cache persistente, file Storage, copertura delle UI e compatibilità estesa, rollout e prove fisiche/remoti. M8 conserva staging/journal e verifiche memoria/dispositivi; M9 conserva le prove fisiche di accessibilità. Nessun master, versione o deploy.

<a id="fonte-docs-m6-sincronizzazione-offline-md-ricaricamento-offline-persistente--candidata-14092026"></a>

#### Ricaricamento offline persistente — candidata 14/09/2026

<a id="evidenza-d64fd69c2b1e5415f441"></a>

Audit 85, base 613dece6, stessa PR #63. Nuovo collaudo `node scripts/run-vault-session-emulators.mjs --cold-browser`: Auth e Firestore persistenti, worker con soli asset statici, reload con rete bloccata, nuovo sblocco obbligatorio, decifratura della matrice e ritorno online/logout. Chrome ed Edge: 44 verifiche superate. Il laboratorio ordinario resta in memoria. Il marker di fase non contiene dati o chiavi.

<a id="evidenza-c114fa79f0a4c073350d"></a>

Questo supera il prerequisito di ricaricamento del documento con cache già popolata; non chiude avvio da processo terminato/dispositivo riavviato, collaudo PWA fisico, preparazione automatica di tutti i dati o contenuto degli allegati. Nessuna estensione delle scritture offline e nessun deploy. Dettagli e diagnosi DevTools nell'audit 85.

<a id="evidenza-a618f7edc8c53f523d5e"></a>

Validazione finale audit 85: npm test completo superato, inclusi 194 test shell e 116 offline. Nuovo collaudo persistente: 44 esecuzioni Chrome/Edge superate; regressione entry ordinaria: 56 esecuzioni superate, 100 verifiche browser complessive nei due collaudi. Nessuna certificazione di chiusura processo, riavvio dispositivo o PWA produttiva.

<a id="fonte-docs-m6-sincronizzazione-offline-md-riavvio-del-browser-con-cache-persistente--candidata-14092026"></a>

#### Riavvio del browser con cache persistente — candidata 14/09/2026

<a id="evidenza-0e409127c71b75b2e90a"></a>

Audit 86, base ba529553, stessa PR #63. Nuovo comando `node scripts/run-vault-session-emulators.mjs --restart-browser`: preparazione online, chiusura controllata e uscita del processo, nuovo processo sullo stesso profilo temporaneo con rete bloccata prima della navigazione. Identità recuperata, Vault bloccato, nuovo sblocco obbligatorio e lettura della matrice già caricata. Chrome/Edge: 46 verifiche superate. Ritorno online e logout collaudati.

<a id="evidenza-5bb1d217d6c20f6950f6"></a>

Questo supera il prerequisito di riavvio controllato del processo nel laboratorio. Non equivale ad arresto forzato, riavvio dispositivo o PWA fisica/iPhone. Restano preparazione deterministica completa, eviction, file Storage, compatibilità delle UI, rollout e altri gate del programma. Nessun dato reale o deploy.

<a id="evidenza-03418c75cfef0a7abc35"></a>

Validazione finale audit 86: npm test completo superato (194 test shell e 116 offline inclusi). Chrome/Edge: 46 verifiche del riavvio processo, 44 del reload e 56 dell'entry ordinaria, 146 esecuzioni complessive superate. Nessun test su dispositivo fisico o dati reali; nessun deploy.

<a id="fonte-docs-m6-sincronizzazione-offline-md-arresto-forzato-con-nota-in-attesa--candidata-14092026"></a>

#### Arresto forzato con nota in attesa — candidata 14/09/2026

<a id="evidenza-9abe6c91f6c4b3989288"></a>

Audit 87, base 1947b5c1, stessa PR #63. Il collaudo --crash-browser termina forzatamente il browser temporaneo dopo la conferma di accodamento di una nota offline e lo riapre senza rete. Nuovo sblocco obbligatorio, matrice cache leggibile, recupero della coda senza ricreare la modifica e retry esplicito online verificati. Chrome/Edge Windows: 50 verifiche superate.

<a id="evidenza-ab45cae9f6a6e19a1f92"></a>

Si supera questo scenario di arresto dopo conservazione locale confermata. Restano arresto durante scritture in volo, spegnimento/riavvio dispositivo, corruzione/eviction, PWA iPhone, preparazione completa, file Storage e rollout. Nessuna estensione delle mutazioni o deploy; dettagli nell'audit 87.

<a id="evidenza-9e3b097c025c28b5ee25"></a>

Validazione finale audit 87: npm test completo superato (194 test shell e 116 offline inclusi). Chrome/Edge Windows: 50 verifiche arresto forzato/nota pendente, 46 riavvio controllato, 56 entry ordinaria e 44 reload; 196 esecuzioni browser superate. Percorso Linux di terminazione non collaudato in questo incremento. Nessun test su dati reali o deploy.

<a id="fonte-docs-m6-sincronizzazione-offline-md-segnalazione-iphone-12124-e-bootstrap-auth--candidata-14092026"></a>

#### Segnalazione iPhone 1.2.124 e bootstrap Auth — candidata 14/09/2026

<a id="evidenza-20bedb526213accb78f0"></a>

Audit 88, base 1b341c74, stessa PR #63. L'utente riferisce lista non visibile dopo Account online → Home → modalità aereo nella PWA iPhone 1.2.124. Identificato nel bootstrap reale un refresh Auth obbligatorio anche offline che interrompeva l'inizializzazione prima della cache. Il candidato conserva il refresh online e offline richiede l'identità Firebase corrente già verificata, senza bypass della Master Password; protegge anche dal cambio UID durante attesa.

<a id="evidenza-79253e6f399be371410e"></a>

Sette regressioni sul blocco reale, con fallimenti riprodotti prima della correzione. I test precedenti del laboratorio non eseguivano questo bootstrap: non sostituiscono il retest iPhone, che resta aperto fino a pubblicazione autorizzata e verifica. Nessun deploy o modifica ai dati dell'utente.

<a id="evidenza-416be26ee8d3e13391dc"></a>

Validazione finale audit 88: npm test completo superato, inclusi 88 controlli statici sicurezza, 11 test security (7 nuovi sul bootstrap), 194 test shell e 116 offline. Inventario aggiornato e controllo whitespace superato. I 196 scenari browser dell'audit 87 non sono stati rieseguiti né attribuiti a questa modifica del bootstrap produttivo; retest iPhone ancora necessario dopo rilascio autorizzato.

<a id="fonte-docs-m6-sincronizzazione-offline-md-rilascio-isolato-iphone-12125--15092026"></a>

### Rilascio isolato iPhone 1.2.125 — 15/09/2026

<a id="evidenza-16523fb6c0681aa5e608"></a>

PR #64 unita in master 263355f261c0fe0661089e2c65782edf1d13527a; release 6b36ae2d, backport isolato del controllo Auth offline. npm test locale e workflow GitHub 34931928458 superati. Deploy Hosting completato; verificati via HTTP gli hash di Home, env-v126.js, sw.js e main-v129.js rispetto al rilascio testato. Functions, Rules e dati non distribuiti/modificati. Prova iPhone Home → modalità aereo → lista ancora da ripetere dopo aggiornamento alla 1.2.125.

<a id="evidenza-f698211c6613f5518d1a"></a>

La PR #63 resta sperimentale e separata: non è stata unita o distribuita. Prima di un suo futuro rilascio occorre riallinearne la base/versione al nuovo master; non distribuire direttamente il vecchio numero 1.2.124 del ramo. Il programma generale e i gate fisici restano aperti.

<a id="fonte-docs-m6-sincronizzazione-offline-md-verifiche-fisiche-e-preparazione-profilo--15092026"></a>

#### Verifiche fisiche e preparazione profilo — 15/09/2026

<a id="evidenza-e0714bf2d621d1bc96f0"></a>

L'utente conferma su iPhone 1.2.125 la consultazione degli Account e dei dati già caricati, anche dopo chiusura completa, riapertura offline e nuovo sblocco del Vault. Precisa però che il profilo utente inizialmente mostrava un errore generico: dopo averlo visitato online i suoi dati diventano leggibili offline. Queste prove non certificano l'intero archivio, file Storage, riavvio del dispositivo o cache espulsa.

<a id="evidenza-8727c516e120d79918d2"></a>

Correzione candidata sulla PR #63: la preparazione online include esplicitamente il documento users/{uid}, oltre alle raccolte già previste. Il vecchio marker completo non evita il nuovo caricamento del profilo; una lettura fallita o un documento assente mantengono la preparazione incompleta. Le pagine principali di profilo, aziende, liste e dettagli Account distinguono i fallimenti di connettività offline dagli altri errori. Permessi, autenticazione e decifratura non vengono riclassificati come cache mancante. Le query vuote offline restano ambigue: non equivalgono a prova di archivio vuoto o completo.

<a id="evidenza-fd64c079b1b0ae9c001c"></a>

Non occorre visitare il profilo per prepararlo dopo questa correzione, ma occorrono rete e completamento del caricamento automatico. Nessuna nuova cache di chiavi o dati decifrati, nessun cambiamento a scritture, allegati o Rules. Candidato non pubblicato: produzione resta 1.2.125; PR #63 resta da riallineare prima di un futuro rilascio.

<a id="evidenza-6ae3a3ace3548151ad99"></a>

Validazione: npm test completo superato, inclusi sei nuovi test su preparazione profilo, marker precedente, lettura fallita/assente, assenza rete e classificazione degli errori. Gli ambienti dei test delle pagine caricano il nuovo gestore condiviso. Il candidato non è stato ancora collaudato su iPhone né distribuito.

<a id="fonte-docs-m6-sincronizzazione-offline-md-audit-90--widget-account-e-credenziali-comuni-offline-15092026"></a>

#### Audit 90 — Widget Account e credenziali comuni offline (15/09/2026)

<a id="evidenza-2495d259d0112e62a3cf"></a>

Base 9f769aab, stessa PR #63. Su richiesta dell'utente la verifica riguarda Widget Account e credenziali comuni; foto e byte degli allegati sono esplicitamente esclusi dal requisito di consultazione offline, per evitare carichi eccessivi nella cache. Non chiedere il loro caricamento offline come condizione per chiudere questo requisito. L'utente intende mantenere la sessione autenticata (nessun logout), anche chiudendo e riaprendo l'app.

<a id="evidenza-3c3df23f38c5b609f6ab"></a>

Riscontro: i componenti di consultazione già leggono accountWidgets e sharedVaultData tramite il repository con cache e decifrano localmente dopo sblocco. Queste due raccolte mancavano però dalla preparazione automatica. Ora sono incluse; un nuovo marker widgetsIncluded impedisce che il precedente stato completo salti il caricamento. Un fallimento di una delle due mantiene la preparazione incompleta. I riferimenti condivisi usati nelle schede Account risiedono in accountWidgets; non occorre scaricare file Storage.

<a id="evidenza-81ee3fab4f57afe21854"></a>

Validazione: test:data-access, test:offline, test:js-syntax e controllo whitespace superati. Sette nuove regressioni: tre sulla preparazione (inclusione senza visita, fallimento di ciascuna raccolta) e quattro sulla UI reale eseguita in ambiente simulato, con letture server vietate offline, per Widget/credenziali e Account personali/aziendali. Verificati rendering, rivelazione del valore e rimozione al blocco; zero scritture. Crittografia nei test UI simulata: non attribuire una nuova prova fisica iPhone o end-to-end a questi risultati. La suite completa era passata su 9f769aab; questo incremento ha eseguito i controlli mirati indicati.

Nessun deploy, bump, modifica a master, scrittura dati o estensione delle modifiche offline. Produzione resta 1.2.125; il candidato sperimentale richiede il riallineamento già previsto prima del rilascio.

<a id="fonte-docs-m6-sincronizzazione-offline-md-rilascio-isolato-12126-completato--15092026"></a>

### Rilascio isolato 1.2.126 completato — 15/09/2026

<a id="evidenza-a495d92a5d221c6015e5"></a>

PR #65 unita in master a14d0198b37507b7c6fb0e7352fe8930d57a9f0d, candidato bb926671693f52348a4d2f9a6032d532170e7635 sulla base produttiva 1.2.125. Distribuite soltanto preparazione offline del profilo, accountWidgets/sharedVaultData e spiegazione degli errori di connettività nelle pagine principali. Il gestore del profilo viene importato su errore; intestazione del modulo abbreviata per il budget. Non sono stati importati i cambiamenti sperimentali dei componenti Widget.

<a id="evidenza-20fe8f9ab5b2c3940ca8"></a>

npm test completo della release superato; GitHub Actions 34937232687, job validate 104277695629 riuscito. Tredici test offline del ramo produttivo (preparazione/classificazione e quattro letture Widget/credenziali private/azienda con rivelazione e mascheramento simulati). Hosting distribuito con successo, 240 file. Verificati via HTTP gli hash SHA256 di Home, env-v126.js, sw.js, offline-sync.js, read-error-message.js, profilo_privato.js e offline-assets.js: corrispondono al candidato testato. Functions, Rules e dati invariati.

<a id="evidenza-76c923c67d8e09a2dd06"></a>

Retest iPhone ancora richiesto sulla 1.2.126: app online fino a completamento preparazione, poi modalità aereo senza logout; profilo, Widget e credenziali comuni consultabili senza visita preventiva. Foto e allegati esclusi per decisione dell'utente. Non interpretare la nuova pubblicazione come test fisico riuscito o garanzia contro cache espulsa.

<a id="evidenza-b5cde02373b8c35a5c67"></a>

PR #63 resta separata e aperta. Produzione ora 1.2.126: prima di un futuro rilascio sperimentale riallineare master, versioni e i due backport già distribuiti, evitando duplicazioni. Non distribuire direttamente la vecchia versione 1.2.124 del ramo sperimentale.

<a id="fonte-docs-m6-sincronizzazione-offline-md-rilascio-isolato-auth-12127-completato--15092026"></a>

### Rilascio isolato Auth 1.2.127 completato — 15/09/2026

<a id="evidenza-8ee6ad98fde154dc820e"></a>

PR #66 unita in master 0ba2332b298d155f0afb1a4eb50c9659115fe321; release 94792d837cadd538e17aa67e439df1c68a09a23a. Pubblicazione Hosting autorizzata e completata. Le 22 pagine private rimangono nascoste fino alla conferma Auth; errore, timeout e logout mantengono il blocco. Pulizia locale/Vault prima del tentativo di signOut. Nessuna lettura o modifica di dati reali; Functions e Rules non distribuite.

<a id="evidenza-03019818157021f2a79e"></a>

npm test completo e dieci scenari browser Chrome/Edge superati; GitHub Actions 34939530695 riuscita. Dopo il deploy, 31 file pubblicati corrispondono via SHA256 alla release. Prova Chrome con profilo isolato senza credenziali: nessuna struttura privata visibile e arrivo a /login-v115.html senza parametro di errore/timeout. Collaudo fisico iPhone ancora da eseguire, inclusa riapertura offline con sessione mantenuta e sblocco Vault.

<a id="evidenza-ff302c198868ac6f8f83"></a>

Produzione ora 1.2.127. PR #63 resta sperimentale: riallineare con master prima di integrare, evitando duplicazioni dei backport offline e logout. La direzione shell persistente resta confermata; questo rilascio non chiude il P0 legacy del wrapping in sessionStorage né l'intero audit sicurezza. Dettagli implementativi e regressioni sono in docs/AUDIT_VAULT_SESSION_P0.md del ramo produttivo e nella PR #66.

<a id="fonte-docs-m6-sincronizzazione-offline-md-m6-close--18092026"></a>

### M6-CLOSE — 18/09/2026

<a id="evidenza-c5b767d00ebacfba21f8"></a>

Incarico di chiusura delle attività autonome di M6, con ramo `integration/vault-shell-v127-security` e base `482e88f5`. Soltanto laboratorio, test e MD: nessuna modifica a `Frontend/public/**`, Rules o Functions produttive, `master`, versione, deploy o dati reali. Il gate fisico iPhone resta aperto e non blocca questa consegna. A1–A6 non sono stati rifatti; M7–M10 restano sospesi.

<a id="fonte-docs-m6-sincronizzazione-offline-md-fallback-senza-web-locks-verificato-in-browser"></a>

#### Fallback senza Web Locks verificato in browser

<a id="evidenza-8e924b48db3b57103d6a"></a>

Il contratto dichiara da tempo un fallback per i browser privi di Web Locks. Il laboratorio coordinava già entrambi i percorsi sullo stesso lease IndexedDB, ma due lacune impedivano di considerarlo completo: l'acquisizione non aveva un limite di tempo e non esisteva alcuna prova in un browser con l'API realmente assente.

<a id="evidenza-84fa240eadd207056abc"></a>

`experiments/offline-sync/hybrid-queue-coordinator.mjs` accetta ora `acquireTimeoutMs` (predefinito 10 s) e limita soltanto l'acquisizione. Se il lease IndexedDB o la richiesta di Web Lock non si concludono entro la scadenza, il comando non viene eseguito e viene restituito `HYBRID_ACQUIRE_TIMEOUT`: senza la piattaforma nulla può annullare una transazione bloccata o sospesa, quindi il fallback deve fallire chiuso invece di attendere indefinitamente. Un lease concesso in ritardo viene rilasciato senza eseguire il task, così una callback tardiva non può mutare la coda né dichiarare un salvataggio. Dopo l'acquisizione il timer viene annullato: il rinnovo periodico continua a coprire gli invii lunghi. Un oggetto Web Locks malformato fallisce con `HYBRID_LOCKS_INVALID` senza degradare al fallback; un lock occupato o rifiutato non aggira il blocco.

<a id="evidenza-25865f76fe7954794ae1"></a>

Nuova suite dedicata `node experiments/offline-sync/run-browser-tests.mjs <browser> --no-locks`, riproducibile con `npm run test:offline-no-locks` su Chrome ed Edge. Pagina e Worker eliminano davvero `navigator.locks` prima di creare il coordinatore, che usa la risoluzione predefinita senza parametri iniettati; il report espone `webLocks: "undefined"`. Nove scenari superati in Chrome headless 152 ed Edge headless 153 su Windows, con profilo usa e getta, solo loopback e dati sintetici: coda cifrata mutata sotto il solo lease; esclusione reciproca pagina/Worker in entrambe le direzioni; subentro dopo scadenza reale con fencing del titolare ripreso; ripresa di un lease abbandonato con generazione monotona; scadenza dell'acquisizione bloccata senza eseguire il task e senza effetti da callback tardiva; richiesta di Web Lock che non si conclude mai; isolamento fra UID distinti; invalidazione di sessione con ciphertext intatto; riapertura della connessione con ciphertext e generazione conservati.

<a id="evidenza-90705538b59d68dd030a"></a>

I test unitari del coordinatore passano da sette a dodici e coprono gli stessi casi senza browser, inclusa la risoluzione predefinita con `navigator` privo di `locks`. Le 24 verifiche della suite browser di coordinamento esistente restano superate in Chrome 152: nessuna regressione.

<a id="evidenza-62c258f464eb30b81f3e"></a>

Limiti dichiarati: il percorso resta di laboratorio e non è importato dal runtime. `withOfflineQueueLease` in `Frontend/public/**` continua a restituire `OFFLINE_QUEUE_LOCKS_UNAVAILABLE` quando l'API manca, quindi l'adozione nel runtime, la distribuzione preparatoria delle copie PWA e i collaudi fisici restano aperti. Il fencing protegge le scritture IndexedDB, non ritira una richiesta di rete già inviata: le ricevute idempotenti del backend restano necessarie.

<a id="fonte-docs-m6-sincronizzazione-offline-md-matrice-offline-bancaria-e-delle-ui-previste"></a>

#### Matrice offline bancaria e delle UI previste

<a id="evidenza-1d85c0354321c04f7c0f"></a>

Il collaudo `--entry-browser` e la matrice del laboratorio coprono ora esplicitamente le dimensioni del gate bancario. La rete viene disabilitata dal protocollo DevTools e un `fetch` di controllo deve fallire; le fixture sono sintetiche e nessun byte Storage viene incluso o dichiarato disponibile.

| Dimensione richiesta | Evidenza nel laboratorio | Limite aperto |
|---|---|---|
| Account personali e aziendali | Lista e dettaglio aperti offline dopo lock/sblocco; decifratura dei campi sintetici nella matrice del probe | Installazioni reali e tutte le categorie di pagina |
| Più banche e carte | Per ciascuno scope `fixture` (`IBAN-FITTIZIO`, PIN `1234`, CCV `000`) e `fixture-two` (`IBAN-SECONDO`, PIN `5678`, CCV `111`), con PIN e CCV rivelati nella UI | Nessun byte Storage; carte reali non provate |
| Widget bancari | Widget bancari di entrambe le banche montati sopra le carte e rivelati offline | Nessuna nuova prova fisica |
| Cache preparata | Matrice del probe online, poi riletta e decifrata offline dopo nuovo sblocco, anche per la seconda banca e la seconda carta | Eviction e quota disco non coperte |
| Cache mancante | Offline il probe rifiuta i bancari mai preparati (`users/{uid}/accounts/banca-mai-preparata` e il percorso aziendale) invece di mostrare un record vuoto | Non distingue un documento esistente ma espulso dalla cache |
| Rete assente | DevTools offline con HTTP bloccato e `navigator.onLine` falso; nessuna richiesta server durante la lettura | — |
| Riapertura | Dettaglio bancario lasciato e riaperto nella stessa sessione con valori identici; dopo riavvio del processo browser con cache persistente la seconda banca e la seconda carta restano leggibili | PWA fisica e riavvio dispositivo |
| Lock/sblocco | Blocco del Vault con accesso negato ai dati in cache, nuovo sblocco offline e rilettura della matrice | — |
| Cambio sezione e pulizia dei valori | Uscita dal dettaglio bancario con azzeramento di tutti i valori rivelati, in ogni scope e in entrambe le modalità | — |

<a id="evidenza-f06664d64330a2fe3c7b"></a>

Esecuzioni reali: `--entry-browser` superato in quattro esecuzioni (Chrome 152 ed Edge 153, profili desktop e mobile) con la matrice bancaria estesa e le nuove etichette di riapertura; `--restart-browser` superato in Chrome 152 ed Edge 153, 35 verifiche ciascuno, con la seconda banca e la seconda carta decifrate dopo il riavvio del processo e la cache persistente. I 723 test di `npm run test:vault-shell` restano superati, così come i 12 test unitari del coordinatore e le 71 prove offline del laboratorio.

<a id="evidenza-8c48600f0be062d14f57"></a>

La matrice certifica disponibilità e decifratura dei dati sintetici già caricati e il comportamento delle UI di laboratorio, non l'avvio a freddo, ogni pagina di produzione, i file Storage, la PWA fisica o l'assenza di espulsione della cache sul telefono.

<a id="fonte-docs-m6-sincronizzazione-offline-md-gate-residui-di-m6-close"></a>

#### Gate residui di M6-CLOSE

<a id="evidenza-55d00e001313d2a1c783"></a>

Aperti e non chiusi da questa consegna: test fisico iPhone/PWA riservato a Diego (checklist dedicata in [M6_CHECKLIST_IPHONE.md](../procedure/COLLAUDI.md#fonte-docs-m6-checklist-iphone-md-l1)); adozione del fallback senza Web Locks e del lease nel runtime distribuito; distribuzione preparatoria e compatibilità delle copie PWA con lo schema IndexedDB; trasporto autenticato e App Check reali; concorrenza reale fra schede e dispositivi sul runtime distribuito; cache espulsa e avvio da processo terminato sul dispositivo fisico.

<a id="fonte-docs-m6-sincronizzazione-offline-md-m6-2--coordinatore-ibrido-dietro-linterfaccia-della-coda-21092026"></a>

### M6-2 — Coordinatore ibrido dietro l'interfaccia della coda, 21/09/2026

<a id="evidenza-3d6158c6d20f1a2bdfc4"></a>

Laboratorio, dati sintetici, profilo browser usa e getta, solo loopback. **`Frontend/public/**`, Functions e Rules restano invariati**: il banco inietta il candidato dall'esterno e non attiva nulla. Comando nuovo `npm run test:offline-runtime-lease` (Chrome ed Edge headless, 153.0.0.0), pagina `experiments/offline-sync/browser-runtime-lease.mjs` servita dal runner di laboratorio.

<a id="fonte-docs-m6-sincronizzazione-offline-md-che-cosa-è-stato-verificato"></a>

#### Che cosa è stato verificato

<a id="evidenza-95f502120136f2564d22"></a>

Il candidato di laboratorio è iniettato **nell'interfaccia reale** della coda: come terzo argomento `locks` di `withOfflineQueueLease(uid, task, locks)` e come `withLease` passato a `createOfflineMutationClientCore`, che è il punto in cui `offline-mutation-client.js:16` collega la stessa funzione. L'adattatore traduce l'esito del coordinatore nel contratto della piattaforma: lease ottenuto → il task gira sotto il lease IndexedDB; lease non ottenuto → l'interfaccia riceve `no lock`, esattamente come con Web Locks occupato (`ifAvailable: true`).

| Scenario | Esito osservato (Chrome 153 ed Edge 153) |
|---|---|
| **Web Locks disponibile** (comportamento attuale, invariato) | il task gira sotto il lock di piattaforma; un secondo ingresso concorrente ottiene `{acquired: false}` senza attendere |
| **`navigator.locks` realmente assente** | il runtime distribuito **rifiuta** con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE` e non esegue nulla: il fallback **non** è nel runtime, coerentemente con il finding aperto |
| **Assenza + coordinatore iniettato** — esecuzione e rilascio | `{acquired: true, value}`; l'ingresso successivo riesce, quindi il lease è stato rilasciato dopo il successo |
| **Assenza + coordinatore iniettato** — esclusione reciproca | due richieste concorrenti da **titolari distinti**, una sola esegue (`heldRuns === 1`), l'altra riceve `{acquired: false}` senza attendere |
| **Assenza + coordinatore iniettato** — errore del task | l'errore attraversa l'interfaccia (`SYNTHETIC_TASK_FAILURE`) e il lease viene **rilasciato**: l'ingresso successivo riesce |
| **Assenza + coordinatore iniettato** — acquisizione bloccata | `HYBRID_ACQUIRE_TIMEOUT` attraverso l'interfaccia, task **mai** eseguito, nessun effetto; il **lease tardivo** viene rilasciato senza eseguire il task |
| **Coda reale + `withLease` iniettato** (`discard` con `createOfflineMutationClientCore`) | con il lease occupato da un altro titolare la coda reale segnala `OFFLINE_QUEUE_BUSY`; ottenutolo, l'operazione viene rimossa (coda vuota) |
| **Schema della coda distribuita** | il database `codex-offline-queue-{uid}` è in **versione 1** con il solo store `encryptedOperations`: **non esiste** uno store `queueLeases` |

<a id="fonte-docs-m6-sincronizzazione-offline-md-prove-già-presenti-riusate-e-non-sostituite"></a>

#### Prove già presenti, riusate e non sostituite

<a id="evidenza-fca1b136c32768c1ef02"></a>

12 test unitari del coordinatore ibrido, 9 scenari browser `--no-locks` (Chrome 152/Edge 153), 23 scenari browser di coordinamento e 20 test unitari della coda (`tests/offline-mutation-queue.test.mjs`, che copre anche `withOfflineQueueLease` con `locks` iniettato a livello unitario). Il banco nuovo **non li duplica**: aggiunge il solo vuoto di copertura — l'interfaccia **reale** della coda esercitata con il candidato iniettato, nei due rami, più i tre casi richiesti (esclusione reciproca, timeout/lease tardivo, rilascio dopo errore). `npm run test:offline-no-locks` resta verde su entrambi i browser dopo questa consegna.

<a id="fonte-docs-m6-sincronizzazione-offline-md-controlli-di-discriminazione-mutazioni-temporanee-poi-ripristinate"></a>

#### Controlli di discriminazione (mutazioni temporanee, poi ripristinate)

| Mutazione | Esito atteso | Esito ottenuto |
|---|---|---|
| `withOfflineQueueLease`: rimosso il rifiuto quando `locks` manca | banco rosso sul ramo «API assente» | **rosso** (`RUNTIME_FALLBACK_CLAIMED`), 1/8 scenari |
| `indexeddb-queue-lease`: concesso il lease anche se un altro titolare lo detiene | banco rosso sull'esclusione reciproca | **rosso** (`HYBRID_EXCLUSION`), 3/8 scenari |

<a id="evidenza-369b138e51f9ecf6518e"></a>

Entrambi i file sono stati ripristinati con hash **identico a `HEAD`** (`git hash-object`: `1eb704a1dadb22d4aca8060df17dbc82546145fe` per `offline-mutation-queue.js`, `7d0c3535e83133de6bedf5577d5e8870747af498` per `indexeddb-queue-lease.mjs`); `git diff --name-only -- Frontend functions firestore.rules storage.rules` è **vuoto**.

<a id="fonte-docs-m6-sincronizzazione-offline-md-nota-di-adozione-e-rollback-copie-pwa-precedenti"></a>

#### Nota di adozione e rollback (copie PWA precedenti)

<a id="evidenza-fddef020e34b349aef65"></a>

L'adozione nel runtime **non è stata fatta** e richiede una decisione, perché il fallback ha bisogno di uno store `queueLeases` che la coda distribuita non ha (versione 1, solo `encryptedOperations`). Un rilascio coordinato dovrebbe quindi: (a) decidere l'aggiornamento di schema e la sua compatibilità con le **copie PWA già installate** — il lettore v1 del laboratorio rifiuta lo schema 2, quindi l'ordine di aggiornamento conta; (b) mantenere il rifiuto fail-closed attuale finché l'aggiornamento non è distribuito; (c) prevedere un rollback che non reintroduca un percorso di scrittura senza lease. Le domande per il proprietario sono in [M6_DOMANDE_FALLBACK_WEB_LOCKS.md](../domande/M6_OFFLINE.md#fonte-docs-m6-domande-fallback-web-locks-md-l1) (commit separato dalle prove).

<a id="fonte-docs-m6-sincronizzazione-offline-md-criterio-ancora-aperto-per-f2-p1-07"></a>

#### Criterio ancora aperto per `F2-P1-07`

<a id="evidenza-13eeab1a926be80305f6"></a>

Il finding **resta aperto**: questo banco **fa avanzare l'evidenza** (l'interfaccia reale accetta il candidato e si comporta come previsto nei tre casi critici), ma **non** chiude l'adozione nel runtime, l'aggiornamento dello schema IndexedDB, la distribuzione preparatoria delle copie PWA, la concorrenza reale fra schede e dispositivi sul runtime distribuito, né i collaudi fisici.

<a id="fonte-docs-m6-sincronizzazione-offline-md-limiti-dichiarati"></a>

#### Limiti dichiarati

- Banco **di laboratorio**: browser headless, dati sintetici, nessun dispositivo fisico, nessuna app distribuita, nessun deploy.
- Nel banco il database del lease è **separato** da quello della coda reale (nel caso `createOfflineMutationClientCore` il lease vive in un database di laboratorio dedicato) proprio perché la coda distribuita non ha lo store del lease: un'adozione reale dovrà riconciliare i due schemi.
- L'esclusione reciproca è provata fra **titolari in pagina**; il caso pagina/Worker e la concorrenza fra schede e dispositivi restano coperti dalle suite di coordinamento esistenti, non da questo banco.
- Non sono esercitati UI, migrazione IndexedDB, aggiornamento delle copie PWA installate, né il comportamento con Storage/cache espulsi.

<a id="fonte-docs-m6-sincronizzazione-offline-md-m6-1-lab--avvio-a-freddo-e-cache-espulsa-22092026"></a>

### M6-1-LAB — Avvio a freddo e cache espulsa, 22/09/2026

<a id="evidenza-12a347fe58e6f0b87cea"></a>

Laboratorio, dati sintetici, profilo browser usa getta, solo loopback. **`Frontend/public/**`, Functions e Rules restano invariati.** Due risultati: una **riparazione del banco** senza la quale la matrice a freddo non era nemmeno costruibile, e un **banco nuovo** per la cache espulsa.

<a id="fonte-docs-m6-sincronizzazione-offline-md-1-il-banco-a-freddo-non-era-eseguibile-su-questo-ramo-difetto-di-laboratorio-corretto"></a>

#### 1. Il banco a freddo non era eseguibile su questo ramo (difetto di laboratorio, corretto)

<a id="evidenza-a57e60f04a6b5e5de3d2"></a>

`node scripts/run-vault-session-emulators.mjs --cold-browser` falliva **prima** di avviare il browser: il bundle di laboratorio (`buildEmulator`) non risolveva più otto export introdotti nel frattempo da `archive-account-service.js` — `functions` da `firebase-config.js`; `deleteField`, `httpsCallable`, `onAuthStateChanged`, `runTransaction` da `firebase-runtime.js`; `inviteIdForGuest`, `nextSharingCycle`, `sharingCycleOf` da `utils.js`. Gli stessi errori colpivano `--restart-browser`.

<a id="evidenza-a8453ac6f00be9de0e9f"></a>

Correzione **solo di laboratorio** in `experiments/persistent-vault-shell/build-emulator.mjs`: `functions` come oggetto inerte nel confine del progetto demo e `deny` (errore `EMULATOR_READ_ONLY`) per gli ingressi callable/mutazione, con `onAuthStateChanged` come sottoscrizione nulla. Nessuna scorciatoia permissiva: qualunque chiamata reale resta impossibile. Dopo la correzione il banco a freddo esistente **non è stato modificato** e torna eseguibile.

<a id="fonte-docs-m6-sincronizzazione-offline-md-2-controllo-positivo-riusato-cache-intatta-matrice-bancaria-a-freddo"></a>

#### 2. Controllo positivo riusato (cache intatta): matrice bancaria a freddo

<a id="evidenza-9fd4ace17400f30cbd29"></a>

`node scripts/run-vault-session-emulators.mjs --cold-browser`, **Chrome 153 ed Edge 153**: `ok: true` con **33 esiti**, fra cui «Firebase identity restored from persistent storage», «reloaded Vault remains locked and denies consultation», «uncached HTTP remains blocked», la matrice completa dei domini dopo riavvio offline e «two banks and their Widget/card composition readable on first visit after offline restart» (IBAN, PIN e CCV sintetici di due banche). È il riferimento con cui si confronta il caso con cache espulsa.

<a id="fonte-docs-m6-sincronizzazione-offline-md-3-banco-nuovo-cache-applicativa-espulsa-npm-run-testoffline-evicted-browser"></a>

#### 3. Banco nuovo: cache applicativa espulsa (`npm run test:offline-evicted-browser`)

Pagina `experiments/persistent-vault-shell/emulator-evicted-check.mjs`, nel flusso a due fasi del banco a freddo (**prepare → processo browser terminato → resume con lo stesso profilo**), Chrome 153 ed Edge 153, `ok: true`:

| Fase | Che cosa fa e che cosa osserva |
|---|---|
| **prepare** (online) | accesso, sblocco del Vault, preparazione offline completata, service worker di laboratorio attivo; **enumerazione** di cache e database; quindi **espulsione della sola cache applicativa Firestore** (`indexedDB.deleteDatabase` sui database il cui nome contiene `firestore`) e terminazione del processo |
| **resume** (processo nuovo, rete assente) | `cache del browser = ["synthetic-vault-cold-assets-v1"]` con la shell **presente nella cache**; `database IndexedDB = ["firebase-app-check-database","firebase-heartbeat-database","firebaseLocalStorageDb"]` → la cache Firestore **non c'è più**; **identità Firebase non ripristinata** e Vault chiuso; consultazione **rifiutata** con `PROBE_SESSION`; stato della preparazione offline `undefined` (mai `ready`); **nessun marcatore privato** nel documento; infine, espulsa anche la cache del browser, il documento **non è più disponibile dalla cache** e resta la garanzia di assenza di marcatori |

<a id="evidenza-8891726381a7badc3e52"></a>

**Distinzione richiesta fra le tre memorie.** *Cache del browser*: Cache Storage `synthetic-vault-cold-assets-v1`, che contiene la shell e resta intatta nell'espulsione applicativa. *Dati IndexedDB*: la cache Firestore viene espulsa, mentre restano i database di Auth, App Check e heartbeat. *File Storage*: in questo modo l'emulatore Storage **non è nemmeno avviato** (`--only auth,firestore`) e la sonda di consultazione esclude i metadati degli allegati: **nessun byte Storage** entra nella matrice.

<a id="fonte-docs-m6-sincronizzazione-offline-md-4-limiti-dichiarati-il-gate-m6-1-resta-aperto"></a>

#### 4. Limiti dichiarati (il gate M6-1 resta aperto)

- **L'identità non si ripristina** dopo l'espulsione della cache applicativa: nel banco il ramo «sblocco riuscito con cache espulsa» **non è esercitato**, e la differenza rispetto al controllo positivo (stesso flusso, cache intatta, identità ripristinata) è l'unica variabile osservata. Serve una prova su dispositivo o una separazione diversa delle due cache per dire se è una proprietà del prodotto o un effetto del banco.
- Una cancellazione di database può restare **`blocked`** finché l'SDK tiene aperte le connessioni: il banco **registra** ciò che resta invece di dichiarare un'espulsione completa.
- Il controllo di rete della pagina **non governa le richieste del service worker** (verificato: con la cache vuota la richiesta riesce comunque): l'«indisponibilità offline assoluta» con cache espulsa **non è riproducibile** in modo affidabile qui. Il banco prova l'assenza dalla cache, non l'assenza di rete.
- Restano fuori: iPhone/PWA fisica, **tutte** le categorie di pagina di produzione, i file Storage, l'espulsione reale per pressione di quota del browser, l'avvio a freddo dopo riavvio del dispositivo.
- **Nessun gate è chiuso**: la dimensione «cache espulsa» della riga M6-1 è ora **documentata e parzialmente esercitata**, non verificata. Le domande per il proprietario sono in [M6_DOMANDE_CACHE_ESPULSA.md](../domande/M6_OFFLINE.md#fonte-docs-m6-domande-cache-espulsa-md-l1) (commit separato).

<a id="fonte-docs-m6-sincronizzazione-offline-md-m6-a-8b--coordinatore-lease-isolato-sul-database-v2-già-esistente-22092026"></a>

### M6-A-8b — Coordinatore lease isolato sul database v2 già esistente, 22/09/2026

<a id="evidenza-30972bd641a97a24c000"></a>

Laboratorio, dati sintetici, profilo browser usa e getta, solo loopback. **`Frontend/public/**`, Functions e Rules restano invariati** (`git diff --name-only -- Frontend functions firestore.rules storage.rules` vuoto: il commit tocca `experiments/offline-sync/**`, `package.json` e i due MD di progetto). Il candidato `experiments/offline-sync/offline-mutation-lease.mjs` è **isolato**: non importa nulla, nessun file di `Frontend/public/**` lo nomina (prova statica nella suite), non è collegato a `withOfflineQueueLease`, al client, al sincronizzatore o al pilota e `withOfflineQueueLease` continua a rifiutare con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE` quando Web Locks manca: **nessun fallback è abilitato** e nessuna copia PWA è coinvolta.

<a id="fonte-docs-m6-sincronizzazione-offline-md-contratto-del-candidato"></a>

#### Contratto del candidato

<a id="evidenza-432fbe6b025aa4cadf79"></a>

Apre il database della coda **senza imporre una versione** (né downgrade né upgrade automatico; un database assente resta assente) e accetta **solo** lo schema v2 con `encryptedOperations` e `queueLeases` entrambi `keyPath:'id'` e `autoIncrement:false`. Le transazioni che apre nominano **solo** `queueLeases`: `encryptedOperations` è scritto unicamente dalla transazione protetta del chiamante, mai dal coordinatore. Offre acquisizione con **token monotono** (il rilascio conserva il contatore: nessuna finestra ABA), rinnovo, rilascio, **timeout di acquisizione** limitato con rilascio del lease tardivo senza eseguire il task, e **fencing** con `guardTransaction` nella stessa transazione del chiamante (una connessione diversa o una transazione in sola lettura sono rifiutate). Rifiuti dichiarati con codice stabile: `LEASE_DATABASE_MISSING`, `LEASE_SCHEMA_V1`, `LEASE_SCHEMA_UNSUPPORTED`, `LEASE_SCHEMA_MALFORMED`, `LEASE_SESSION_INACTIVE`, `LEASE_BUSY`, `LEASE_ACQUIRE_TIMEOUT`, `LEASE_TRANSACTION_FAILED`, `LEASE_RECORD_INVALID`, `LEASE_TOKEN_EXHAUSTED`, `LEASE_CLOCK_INVALID`/`REVERSED`, `LEASE_LOST`, `LEASE_CONTEXT_CLOSED`, `LEASE_GUARD_INVALID`, `LEASE_ASYNC_MUTATION_FORBIDDEN`.

<a id="fonte-docs-m6-sincronizzazione-offline-md-prove-node-sul-modulo-reale-1212"></a>

#### Prove Node sul modulo reale (12/12)

<a id="evidenza-236cbf656a29b60f76d2"></a>

Fixture IndexedDB in memoria con bozza, commit alla conclusione, abort con rollback, richieste differite e iniezione di un guasto di transazione. Casi: apertura v2 con percorso protetto e rilascio; rifiuti su **coda assente, schema v1, schema v3, store del lease mancante, chiave errata e incremento attivo** (sei casi, tutti con task mai eseguito, zero scritture, nessuno store creato e `encryptedOperations` intatto); sessione scaduta prima e **durante** il task; **contesa fra due contesti** (il secondo riceve `{acquired:false, reason:'LEASE_BUSY'}`, non esegue e non scrive; il gate viene rilasciato **prima** di attendere il titolare); **rilascio dopo errore** con token che avanza; **timeout** su transazione che non si conclude, con lease tardivo rilasciato e task mai eseguito; **fencing** con il record del lease sostituito da un **altro titolare prima** di `guardTransaction` → `LEASE_LOST`, transazione annullata e **zero scritture** su `encryptedOperations`; transazione fallita; rinnovo e token anti-ABA; record malformato senza riparazioni; isolamento statico del modulo. Suite mirate: **167/167** in `npm run test:offline-write-prototype` (155 preesistenti + 12 nuove); `test:js-syntax` 163 moduli, `test:static-references` 237 file, `audit-offline-shell`, `test:release-hardening` tutti **exit 0**.

<a id="fonte-docs-m6-sincronizzazione-offline-md-banco-browser-sul-layout-v2-reale-7-verdetti-ripetibile"></a>

#### Banco browser sul layout v2 reale (7 verdetti, ripetibile)

<a id="evidenza-ef386de95ef6160363dc"></a>

`npm run test:offline-mutation-lease` (`run-emulated-browsers.mjs --mutation-lease`), pagina reale e IndexedDB reale: una coda dell'app con due operazioni sigillate viene **aggiornata a v2** e il coordinatore lavora sul `queueLeases` dello **stesso** database. **Chrome 153 e Edge 153**: `ok: true` con **7 verdetti**, **3 esecuzioni identiche per browser (6/6)**. Verdetti: apertura sul layout reale senza migrazione e scrittura protetta sulla coda vera con rilascio del lease; rifiuti su coda v1 reale (resta v1 senza store del lease, righe identiche), coda assente (`LEASE_DATABASE_MISSING`, nessun database creato — verificato con `indexedDB.databases()`) e v2 con struttura errata (`LEASE_SCHEMA_MALFORMED`); contesa fra due contesti con `LEASE_BUSY` e token che avanza; rilascio dopo errore; fencing con takeover e contenitori identici byte per byte; token anti-ABA e **timeout deterministico** (transazione readwrite trattenuta sullo store del lease + budget di 60 ms → `LEASE_ACQUIRE_TIMEOUT`, task mai eseguito, lease tardivo rilasciato); nessuna connessione lasciata aperta (la cancellazione dei database sintetici non resta bloccata).

<a id="fonte-docs-m6-sincronizzazione-offline-md-controlli-di-discriminazione-mutazioni-temporanee-poi-ripristinate-1"></a>

#### Controlli di discriminazione (mutazioni temporanee, poi ripristinate)

| Mutazione sul modulo reale | Esito atteso | Esito ottenuto |
|---|---|---|
| Fencing senza il controllo di possesso (`owned`) | rosso sul caso di fencing | **rosso** (`LEASE_BENCH_FENCING`/`LEASE_LOST`), 1 test |
| Rilascio del lease tardivo neutralizzato dopo la scadenza | rosso sul caso di timeout | **rosso** (`timeout di acquisizione`), 1 test |
| Rifiuto dello schema v1 neutralizzato | rosso sui rifiuti | **rosso** (`rifiuti dichiarati`), 1 test |

Il modulo è stato ripristinato **byte per byte** (`sha256 6D687FC7AAEDED36709B53E89C9D5FDC377EA5C1B0DB1FA65F7E2F9E66D3E731`) e la suite è tornata **12/12**.

<a id="fonte-docs-m6-sincronizzazione-offline-md-limiti-dichiarati-1"></a>

#### Limiti dichiarati

- È un **candidato di laboratorio**: browser headless, dati sintetici, una sola pagina con due contesti del coordinatore; **non** due schede reali, **non** Worker, **non** due dispositivi, **non** PWA installate.
- L'adozione nel **runtime** non è fatta: il coordinatore **non** è collegato a `withOfflineQueueLease`, al client, al sincronizzatore o al pilota, e il fallback resta spento. Restano aperti il punto 4 dell'ordine preparatorio di `M6-ADOZIONE-PIANO R1` (§3.4) e il caso 4 della sua matrice §8; **M6-F3** (quando aggiornare le copie PWA installate) è aperto e nessuna decisione di prodotto è stata presa.
- Il fencing protegge le **scritture IndexedDB** nella transazione del chiamante e **non ritira** una richiesta di rete già inviata: le ricevute idempotenti del backend restano necessarie. Il timeout copre **solo l'acquisizione**, non la durata del task; la conferma dell'esito di una transazione del chiamante resta dell'attesa del chiamante — il coordinatore non trasforma mai una transazione fallita in una riuscita.
- L'isolamento è provato **staticamente** su `Frontend/public/**`; non è una prova di sicurezza contro un'inclusione futura nel runtime.
- **Nessun gate è chiuso** e la matrice delle copie PWA, il collaudo fisico e il rilascio restano fuori da questo passo.

<a id="fonte-docs-m6-sincronizzazione-offline-md-m6-a-8c--adozione-controllata-del-lease-nel-solo-pilota-di-sviluppo-22092026"></a>

### M6-A-8c — Adozione controllata del lease nel solo pilota di sviluppo, 22/09/2026

<a id="evidenza-87d8f361dc908f2fd0e3"></a>

Laboratorio con dati sintetici e profilo browser usa e getta. Il coordinatore approvato in M6-A-8b è stato portato nel **runtime di sviluppo** con una **copia runtime** e collegato **esclusivamente** al pilota account privato, dietro **opt-in esplicito e spento per default**. Nessun Service Worker, nessuna PWA installata, nessun dato reale, nessuna modifica a Rules/Functions.

<a id="fonte-docs-m6-sincronizzazione-offline-md-regola-di-adozione-un-punto-solo-resolveofflinequeuelease"></a>

#### Regola di adozione (un punto solo: `resolveOfflineQueueLease`)

| Situazione | Confine `withLease` usato |
|---|---|
| `navigator.locks` **presente** | percorso di piattaforma di sempre (`withOfflineQueueLease`), **prioritario e invariato**; il lease IndexedDB non viene nemmeno aperto |
| `navigator.locks` **assente**, opt-in **spento** (default) | rifiuto invariato del runtime: `OFFLINE_QUEUE_LOCKS_UNAVAILABLE`, nessun task eseguito |
| `navigator.locks` **assente**, opt-in **acceso** (`?m6lease=1`, che si aggiunge a `?m6pilot=1`) | lease IndexedDB sul **database della coda** (`codex-offline-queue-<uid>`), **solo schema v2 valido** (`encryptedOperations` + `queueLeases`, entrambi `keyPath:'id'`, nessun `autoIncrement`) |

<a id="evidenza-c232d5e8ec47e9e058dc"></a>

L'API è letta **a ogni chiamata**, il coordinatore è creato **pigramente** (così la presenza di Web Locks non dipende dall'IndexedDB) e il default è spento: nessuna attivazione globale, automatica o produttiva. Un database assente, uno schema v1, uno schema non supportato o malformato, un lease occupato (`{acquired:false, reason:'LEASE_BUSY'}`, stessa forma del Web Lock occupato), una sessione scaduta e una transazione fallita **non** producono mai una riuscita: il rifiuto è esplicito e il task non viene eseguito. Il coordinatore **non** crea database, **non** esegue upgrade (il trigger M6-A-7 resta separato e **non** viene invocato) e **non** ripara schemi; le sue transazioni nominano solo `queueLeases`.

<a id="fonte-docs-m6-sincronizzazione-offline-md-file-e-integrazione"></a>

#### File e integrazione

- **Nuovo** `Frontend/public/assets/js/modules/data/offline-mutation-lease.js`: copia runtime del coordinatore approvato (stessi codici e stessa semantica: acquisizione, rilascio, rinnovo, timeout con rilascio del lease tardivo, token anti-ABA, fencing) più il risolutore della tabella qui sopra.
- `Frontend/public/assets/js/modules/data/offline-mutation-client.js`: **un solo** punto di iniezione (`withLease: options?.withLease ?? withOfflineQueueLease`). Il default resta quello di sempre per **ogni** altro chiamante.
- `Frontend/public/assets/js/modules/data/private-account-offline-pilot.js`: predicato `isPrivateAccountLeaseFallbackEnabled` (`?m6lease=1`) e passaggio del risolutore **solo** con l'opt-in; la chiave `withLease` non viene passata altrimenti.
- `Frontend/public/offline-assets.js`: rigenerato dal pretest (243 risorse): è l'unico effetto sulla shell offline; `sw.js` non è toccato e nessun deploy avviene.
- Nessun file di `Frontend/public/**` importa da `experiments/`: la copia runtime è autonoma e importa solo `./offline-mutation-queue.js`.

<a id="fonte-docs-m6-sincronizzazione-offline-md-prove"></a>

#### Prove

- **22 prove** fra la suite nuova (`tests/offline-mutation-lease.test.mjs`, 14 casi: regola di adozione, rifiuti, contesa fra due contesti, timeout, errore del task, sessione scaduta, assenza di IndexedDB, collegamento solo nel pilota) e la suite del pilota estesa (`tests/private-account-offline-pilot.test.mjs`, 8 casi). Sul **percorso reale**: client e sincronizzatore veri con coda e lettore veri su una coda v2 in memoria, con **contesa fra due contesti**, **rilascio dopo errore** e fail-closed su coda v1 senza upgrade.
- `npm run test:offline-write-prototype`: **185/185** (167 prima + 18).
- **Controlli di mutazione discriminatori (4)**: priorità Web Locks neutralizzata → rosso; default dell'opt-in acceso → rosso; rifiuto dello schema v1 neutralizzato → rosso; iniezione del confine nel pilota rimossa → rosso. File ripristinati **byte per byte** (`sha256 C25F79C0…F3947ED` per il modulo runtime, `sha256 F1CF0ED2…1E09AAE` per il pilota) e suite di nuovo 22/22.
- **Banco browser `--pilot-lease`** (`npm run test:offline-pilot-lease`) su coda v2 **reale**: **6 verdetti** e **6/6 esecuzioni identiche** (3 su Chrome 153, 3 su Edge 153) — Web Locks presente senza alcun record di lease; opt-in spento che rifiuta; opt-in acceso che sincronizza sotto lease e lo rilascia; contesa fra due contesti reali; rilascio dopo errore del trasporto; v1 reale e coda assente fail-closed senza upgrade.
- Audit: `test:js-syntax` 164 moduli, `test:static-references` 238 file, `audit-offline-shell` 243 risorse, `test:release-hardening`, `test:performance-budget` (30 pagine), `test:dependencies` (nessuna dipendenza circolare su 164 file), `test:lightweight`, `test:data-access`, `test:security` (88 controlli) — tutti **exit 0**.

<a id="fonte-docs-m6-sincronizzazione-offline-md-limiti-dichiarati-2"></a>

#### Limiti dichiarati

- Il **default distribuito non cambia**: senza opt-in (o con `navigator.locks` presente) il confine resta quello di sempre e `withOfflineQueueLease` continua a rifiutare quando l'API manca. Lo schema della coda **distribuita** resta la v1 con il solo `encryptedOperations`: il percorso lease funziona solo su una coda che una copia ha già portato a v2 con l'upgrade **esplicito** M6-A-7.
- Il confine adottato usa il lease anche come **fencing transazionale** delle scritture della coda (vedi M6-A-8c R1 qui sotto): ogni mutazione eseguita sotto un token verifica il possesso nella **stessa** transazione. Il fencing non ritira comunque una richiesta di rete già inviata: servono le ricevute idempotenti del server.
- Prove su **una sola pagina** con due contesti del coordinatore: non due schede reali, non Worker, non dispositivi, non PWA installate; il banco rimuove `navigator.locks` nel proprio realm dopo il primo scenario e usa un profilo usa e getta.
- L'adozione è di **sviluppo** e resta subordinata alle decisioni di prodotto: **M6-F3** (quando aggiornare le copie PWA installate), matrice delle copie, messaggio temporaneo e collaudi fisici restano aperti. `docs/CENSIMENTO_GATE_M6_M10.md` non è stato toccato: la sua riga M6-2 resta corretta per il **default distribuito** (rifiuto senza Web Locks, schema v1).
- Il `npm test` **globale** non è stato eseguito in questa sessione: sono state eseguite le suite e gli audit elencati sopra.

<a id="fonte-docs-m6-sincronizzazione-offline-md-m6-a-8c-r1--fencing-atomico-delle-scritture-della-coda-22092026"></a>

#### M6-A-8c R1 — Fencing atomico delle scritture della coda, 22/09/2026

<a id="evidenza-def66ad3063b1168bc6f"></a>

**Difetto corretto (segnalato dalla revisione).** Il lease era usato solo come **esclusione esterna**: con TTL 30 s e nessun rinnovo durante il task, una sincronizzazione lenta o una sospensione poteva far scadere il titolare, un secondo contesto poteva subentrare e il primo poteva ancora eseguire `enqueue`/`replace`/`remove` prima del controllo finale — con rischio di rimuovere o riscrivere contenitori già in mano al nuovo titolare.

<a id="evidenza-3d9ee130b47d3fb0363f"></a>

**Correzione.** Il **contesto del lease** viene passato al task dal solo confine del fallback (il percorso Web Locks invoca il task senza argomenti, quindi il contesto è `undefined` e il codice resta quello di sempre). Le mutazioni della coda — `enqueue`, `replace`, `markForReview`, `remove` (compresa la **conferma** del sincronizzatore) — accettano quel contesto e, quando c'è:

1. la transazione readwrite finale nasce dalla **stessa connessione del coordinatore** e comprende `['encryptedOperations', 'queueLeases']` (nuovo metodo `transaction` sul contesto);
2. `guardTransaction` verifica il **possesso del token** dentro la stessa transazione e, solo se il lease è ancora nostro, esegue il confronto CAS e la scrittura;
3. un titolare scaduto o subentrato riceve **`LEASE_LOST`**, la transazione viene annullata e non resta **nessun** inserimento, sostituzione, marcatura o rimozione;
4. il contesto distingue la causa della chiusura: `LEASE_LOST` quando il lease è stato perso, `LEASE_CONTEXT_CLOSED` quando il coordinamento è finito regolarmente.

Senza contesto — percorso Web Locks e **ogni altro chiamante** — la transazione resta quella di prima (singolo store, nessun fencing): l'operazione è additiva e verificata dalle suite esistenti.

<a id="evidenza-8e3adab0f7bf5ad5cdf2"></a>

**Regola dell'accodamento (adattamento dichiarato).** L'accodamento non deve dipendere da un lock, perché la modifica dell'utente va conservata: l'inserimento avviene **sotto token** quando il confine è acquisibile; se **nessun token è mai stato preso** (confine occupato, API di piattaforma assente, lease indisponibile o acquisizione scaduta) avviene senza token come prima — è un inserimento con `operationId` univoco e CAS, che non sovrascrive contenitori esistenti; se invece un **token preso viene perso** o la **sessione cambia**, non si scrive nulla e l'esito è un rifiuto. Nel percorso Web Locks l'accodamento passa ora dal confine di piattaforma quando è libero (e resta accodato senza lock quando è occupato): la conservazione non cambia e l'ampiezza del lock sull'accodamento è più stretta, non più larga.

<a id="evidenza-a700f66f365ebe103a7e"></a>

**Prove R1.** `tests/offline-mutation-lease.test.mjs` sale a 19 casi con cinque prove discriminanti: fencing atomico sulle quattro mutazioni con titolare scaduto (tutte `LEASE_LOST`, **zero** scritture/rimozioni, contenitore invariato, transazione fenced presente) e nuovo titolare che completa; **ritardo/sospensione oltre TTL** durante una sincronizzazione reale (`LEASE_LOST`, nessuna conferma, nessuna rimozione, record non riscritto) con il nuovo titolare che subentra e conclude; confine occupato che conserva comunque l'accodamento senza dichiarare alcuna riuscita; confine che riferisce `LEASE_LOST` che **non** lascia scrivere senza token (controprova: `OFFLINE_QUEUE_LOCKS_UNAVAILABLE` conserva come prima); percorso Web Locks senza alcuna transazione sul lease. Catena `test:offline-write-prototype`: **190/190**. Banco `--pilot-lease`: **7 verdetti**, **6/6 esecuzioni identiche** (3× Chrome 153, 3× Edge 153), con il nuovo scenario R1 su IndexedDB reale. **Controlli di mutazione (3/3 rossi sul caso previsto)**: fencing della coda neutralizzato, perdita del lease ammessa all'accodamento, causa della chiusura del contesto neutralizzata; file ripristinati **byte per byte** (`sha256 35C90A15…79A51A9` coda, `00DEA7EE…A197A1C` client-core, `1E7408F9…B46B592D9` lease) e suite di nuovo verde.

<a id="evidenza-052355b78cb985e5b587"></a>

**Limiti R1.** Il rinnovo durante un task lungo **non** è stato aggiunto: un task lento o sospeso oltre il TTL **perde** il lease e da quel momento **fallisce chiuso** invece di scrivere (è la proprietà richiesta); estendere il possesso con un rinnovo resta un passo separato e non è stato fatto. L'invio di rete già partito non viene ritirato (servono le ricevute idempotenti). Le prove restano di laboratorio (una pagina, due contesti, dati sintetici).

<a id="fonte-docs-m6-sincronizzazione-offline-md-m6-a-8d--prova-pagina--worker-sul-pilota-lease-caso-5-della-matrice-22092026"></a>

#### M6-A-8d — Prova pagina + Worker sul pilota lease (caso 5 della matrice), 22/09/2026

<a id="evidenza-9546304492af98501db3"></a>

Laboratorio e runtime di sviluppo, dati sintetici, profilo usa e getta, solo loopback. Chiusura del **caso tecnico 5** della matrice di `M6-ADOZIONE-PIANO R1` («esclusione pagina/Worker nel runtime con lease condiviso»). **Nessun** Service Worker, nessuna PWA installata, nessun `deploy`, nessun dato reale, nessuna modifica a Rules/Functions. **Nessun adattatore runtime nuovo**: il Worker guida i moduli runtime approvati così come sono.

<a id="evidenza-f0e3c073a8324d142682"></a>

**Contesti.** `experiments/offline-sync/pilot-lease-worker.mjs` (Worker di modulo dedicato) e `experiments/offline-sync/browser-pilot-lease-worker.mjs` (pagina). Entrambi rimuovono **davvero** `navigator.locks` nel proprio realm e ne verificano l'assenza (`typeof` vale `undefined` nei due contesti, riportato dal banco); stesso database `codex-offline-queue-<uid>` a **v2** e stesso UID. Su entrambi i lati si usano i **moduli runtime reali** (`offline-mutation-queue.js`, `offline-mutation-lease.js`, `offline-mutation-client-core.js`, `offline-mutation-sync.js`): il Worker non importa nulla da `experiments/` come implementazione e la sua factory è esportata solo per poterla pilotare dalle prove Node.

**Verdetti del banco (8, `npm run test:offline-pilot-lease-worker`).**

| # | Verifica | Esito |
|---|---|---|
| 1 | Pagina e Worker senza `navigator.locks` sullo stesso database v2 e stesso UID | `typeof navigator.locks === 'undefined'` in entrambi i realm |
| 2 | **Esclusione reciproca** pagina→Worker e Worker→pagina | il secondo contesto riceve `{acquired:false}` e **non esegue** il task; dopo il rilascio acquisisce |
| 3 | `enqueue`, `replace`, `markForReview`, `remove` nel Worker **sotto token** | tutte riescono, il contatore del lease avanza e torna `holderId:null`; la marcatura di riconciliazione è verificata decifrando il contenitore |
| 4 | **Takeover dopo la scadenza** | il Worker con il token vecchio ottiene `LEASE_LOST` e **zero** rimozioni (contenitori identici prima/dopo); il nuovo titolare in pagina completa la rimozione nella stessa transazione fenced |
| 5 | **Worker terminato** mentre tiene il lease | finché il lease è vivo la pagina **non** entra e il contesto morto non scrive nulla; oltre la scadenza il nuovo titolare subentra e prosegue (limite: da un contesto morto `LEASE_LOST` non è osservabile — è provato nel caso 4) |
| 6 | Rilascio dopo errore, **timeout di acquisizione**, sessione scaduta | errore del task → lease rilasciato e ingresso successivo riuscito; blocco deliberato di una transazione readwrite trattenuta dalla pagina + budget 60 ms → `LEASE_ACQUIRE_TIMEOUT` con task mai eseguito e nessun lease trattenuto; `LEASE_SESSION_INACTIVE` prima e durante il task |
| 7 | Coda **v1**, database **assente**, schema **malformato** dal Worker | `LEASE_SCHEMA_V1` (resta v1, righe identiche), `LEASE_DATABASE_MISSING` (nessun database creato, verificato con `indexedDB.databases()`), `LEASE_SCHEMA_MALFORMED` (struttura invariata): nessun upgrade, nessuna creazione, nessuna riparazione |
| 8 | Accodamento e **conferma** nella superficie del client | `client.enqueue` accoda e sincronizza (`saved`, coda vuota); conferma sotto token; con trasporto in errore `recoverable-error` con coda **conservata** e lease rilasciato |

<a id="evidenza-85c9503716e96abd9af9"></a>

**Difetto reale trovato e corretto (dalla prova pagina/Worker).** La **chiusura** del confine poteva abbandonare un'**acquisizione in corso**: se un'acquisizione scadeva e il lease arrivava in ritardo, chiudere subito il coordinatore lasciava il lease **trattenuto fino alla scadenza naturale**, bloccando gli altri contesti. `close()` ora attende la corsa in corso e chiude la connessione **dopo** che il lease tardivo è stato rilasciato (`Frontend/public/assets/js/modules/data/offline-mutation-lease.js`). È una correzione al modulo runtime approvato in M6-A-8c/R1, dichiarata qui: la proprietà «lease tardivo rilasciato» vale ora anche quando il confine viene chiuso immediatamente (come fa il pilota in `finally`). Prova dedicata in `tests/offline-mutation-lease.test.mjs` e nel caso 6 del Worker.

<a id="evidenza-3e2b993e023ac7b643e3"></a>

**Prove Node e catena.** `tests/pilot-lease-worker.test.mjs` (**8 casi**, con la stessa factory del Worker e una IndexedDB in memoria): struttura e cablaggio, percorso di piattaforma quando Web Locks c'è (Node espone un `navigator.locks` reale: il primo caso lo usa e poi lo rimuove, come fa il realm del Worker), le quattro mutazioni sotto token, takeover, sessione, errore/timeout/conferma, rifiuti di schema, esclusione. `npm run test:offline-write-prototype`: **199/199** (190 + 8 Worker + 1 modulo sulla chiusura). Audit: `js-syntax` 164 moduli, `static-references` 238 file, `offline-shell` 243 risorse, `release-hardening`, `performance-budget` (30 pagine), `dependencies` (nessun ciclo su 164 file), `lightweight`, `data-access`, `security` (88 controlli) — tutti **exit 0**.

<a id="evidenza-09f0b03c705f63173cac"></a>

**Ripetibilità e controlli di mutazione.** Banco `--pilot-lease-worker`: **8 verdetti** e **6/6 esecuzioni identiche** (3× Chrome 154, 3× Edge 153), anche dopo la correzione della chiusura. Tre controlli di mutazione discriminatori: chiusura che abbandona l'acquisizione → **rosso** sulla prova di modulo; Worker che **non** rimuove Web Locks → banco **rosso** (`WORKER_WEB_LOCKS_PRESENT`); fencing della coda neutralizzato → banco **rosso** (`WORKER_STALE_WROTE`, contenitori non più identici). File ripristinati **byte per byte** (`sha256 81D1FB4A…B819D8D` lease, `90F30FED…B4E5C947D` Worker, `35C90A15…79A51A9` coda) e suite di nuovo verde.

<a id="evidenza-a1a35e3c2b05fbddec39"></a>

**Limiti dichiarati.** Il caso 5 è coperto **come evidenza di laboratorio** con il pilota opt-in e i moduli runtime: non è un'adozione di prodotto né una prova sull'app distribuita. Restano fuori due schede reali di browser, due dispositivi, la PWA installata e i collaudi fisici; il banco usa una sola macchina e un profilo usa e getta, e la rimozione di Web Locks avviene nel realm del banco. Nel caso «Worker terminato» il vecchio contesto non può riferire `LEASE_LOST` (è morto): la proprietà è provata dal caso con titolare ancora vivo. Vale la regola dichiarata in R1 per l'accodamento (sotto token quando il confine è acquisibile; senza token **solo** se nessun token è mai stato preso): su schema non supportato le mutazioni che modificano contenitori esistenti falliscono con contenitori identici, mentre l'accodamento resta conservato con esito di rifiuto esplicito. **M6-F3**, la matrice delle copie PWA, il messaggio definitivo, l'adozione nel runtime distribuito e i dispositivi restano aperti; il `npm test` globale non è stato eseguito.

<a id="fonte-docs-m6-sincronizzazione-offline-md-m6-a-8e--matrice-copie-miste-e-rollback-v2-compatibile-casi-6-6-bis-6-ter-22092026"></a>

#### M6-A-8e — Matrice copie miste e rollback v2-compatibile (casi 6, 6-bis, 6-ter), 22/09/2026

<a id="evidenza-0ae939b1c3c43ea9a558"></a>

Laboratorio e runtime di sviluppo, dati sintetici, profilo usa e getta: **nessuna release, PWA installata o decisione di prodotto**. Banchi nuovi `experiments/offline-sync/browser-mixed-current.mjs` e `mixed-current-worker.mjs` (modo `--mixed-current`, `npm run test:offline-mixed-current`), su Chrome 154 ed Edge 153. Tre ruoli interpretati con i **moduli runtime correnti**:

| Ruolo | Come è modellato |
|---|---|
| **Copia vecchia** (v1/Web-Locks-only) | apre la coda con la **versione 1** (davanti a v2 fallisce con `VersionError`), esclude con il solo `withOfflineQueueLease` e legge con un lettore **solo schema 1** (su v2: `QUEUE_UNAVAILABLE_SCHEMA`, mai coda vuota) |
| **Copia nuova** (corrente, opt-in) | `resolveOfflineQueueLease` + mutazioni fenced del runtime (`offline-mutation-queue/lease`), con Web Locks prioritario e lease IndexedDB solo con API assente |
| **Rollback v2-compatibile** | runtime con **fallback spento**: lettore compatibile v1/v2 e `withOfflineQueueLease` come unico confine; **mai** un lettore solo-v1 |

**Verdetti del banco (6, ripetibili 6/6).**

| # | Verifica | Esito |
|---|---|---|
| 1 | Ponte con **Web Locks presente** (6-bis), nuova→vecchia e vecchia→nuova | il contesto escluso riceve `{acquired:false}` e **non scrive** (contenitori identici durante l'esclusione); dopo il rilascio la scrittura avviene — il ponte è il **lock di piattaforma condiviso** |
| 2 | Upgrade additivo con il runtime (`upgradeOfflineQueueSchema`, lo stesso codice del trigger M6-A-7) | creato **solo** `queueLeases`, contenitori **byte-identici**, nessun duplicato e nessuna cancellazione |
| 3 | Copia **vecchia davanti a v2** | `VersionError` all'apertura a versione 1 e `QUEUE_UNAVAILABLE_SCHEMA` dal lettore solo-v1 (stato dichiarato, **mai** coda vuota); nessuna scrittura, coda e contenitori intatti |
| 4 | Senza Web Locks (6-ter) | la copia vecchia rifiuta con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE` e **non scrive**; anche la copia nuova **senza opt-in** rifiuta; con l'opt-in lavora sotto il lease — nessuna elaborazione insicura della stessa coda e nessuna falsa riuscita |
| 5 | **Rollback v2-compatibile** | **legge** la v2 (lettore compatibile) ma rifiuta sincronizzazione e mutazioni senza il lock richiesto (`OFFLINE_QUEUE_LOCKS_UNAVAILABLE`, zero invii, contenitori **byte-identici**, record del lease intatto: nessun uso del lease); con il lock di piattaforma entra nella sezione critica, legge la v2 e si ferma sull'operazione marcata per revisione **senza** inviarla |
| 6 | **Vecchia connessione durante l'upgrade/versionchange** | con la connessione **trattenuta**: `QUEUE_UPGRADE_BLOCKED`, coda ancora v1 con contenitori identici, nessun aggiornamento silenzioso; l'esito **tardivo** dopo la chiusura viene annullato (resta v1, contenitori identici) e un nuovo tentativo riesce con contenitori byte-identici; con la connessione **cooperativa** l'upgrade riesce al primo tentativo; nessun handle lasciato (la cancellazione dei database sintetici non resta bloccata) |

<a id="evidenza-04414834f891e67e02d1"></a>

**Prove Node e catena.** `tests/mixed-current.test.mjs` (**4 casi** su una IndexedDB in memoria): cablaggio di banco e Worker (nessun import da `experiments/`), copia vecchia che legge la v1 e fallisce esplicitamente davanti alla v2 **senza scrivere**, rollback che **legge** la v2 ma rifiuta invio e mutazioni senza lock (contenitori e lease invariati), copia nuova che lavora sotto il lease mentre il vecchio non può mescolarsi. `npm run test:offline-write-prototype`: **203/203** (199 + 4). Audit: `js-syntax` 164 moduli, `static-references` 238 file, `offline-shell` 243 risorse, `release-hardening`, `performance-budget` 30 pagine, `dependencies` senza cicli, `lightweight`, `security` 88 controlli — tutti **exit 0**.

<a id="evidenza-bbbd6e3cc17f3dfd2d7f"></a>

**Controlli di mutazione (3, file ripristinato byte per byte).** Rollback che usa il fallback del lease → banco **rosso** (`MIXED_ROLLBACK_SYNC:[true,null,[]]`); copia vecchia che apre **senza** versione → banco **rosso** (`MIXED_OLD_WRITE_V2:[true,null]`, cioè scrive su v2); copia vecchia che scrive **senza** il lock di piattaforma → banco **rosso** (`MIXED_OLD_IN:[true,true]`, il contesto non più escluso). `sha256 72A30CF0…6EBCF6EF3` per il Worker, banco di nuovo verde.

<a id="evidenza-48397dc8cb1c7d75cf94"></a>

**Limiti dichiarati.** È **evidenza di laboratorio** sui moduli runtime, non un'adozione: nessun Service Worker, nessuna PWA installata, nessun dato reale, nessuna decisione di prodotto. La **copia vecchia è modellata** (apertura a versione 1 + lettore solo-v1) e il **rollback** è modellato dal runtime con il fallback spento: non sono build distribuite né prove di aggiornamento su copie installate. L'assenza di Web Locks è creata nel realm del banco (pagina) e nel realm del Worker per job. Restano fuori due schede reali, due dispositivi, la PWA fisica e la matrice reale delle copie installate; il banco usa una sola macchina, un profilo usa e getta e un trasporto simulato (l'operazione marcata per revisione è sintetica). **M6-F3**, la matrice delle copie PWA, il messaggio definitivo e i collaudi fisici restano aperti; il `npm test` globale non è stato eseguito.

<a id="fonte-docs-m8-backup-recupero-md-l65"></a>

## Fonte: M8_BACKUP_RECUPERO.md — righe originali 65–286

> Provenienza: `docs/M8_BACKUP_RECUPERO.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-m8-backup-recupero-md-riferimenti-orfani-dopo-un-ripristino-interrotto-verifica-21092026"></a>

### Riferimenti orfani dopo un ripristino interrotto (verifica 21/09/2026)

<a id="evidenza-8a392f1be5b4cd083d72"></a>

Prova su **emulatori reali** (Firestore + Storage), dati interamente sintetici, **codice di produzione** del client (`prepareBackupRestore` + `executeBackupRestore`) e **callable reale** `restoreBackupChunk`: `tests/interrupted-restore-orphan-refs.emulator.test.mjs` (2 casi), runner `scripts/run-interrupted-restore-emulators.mjs`.

| Scenario | Esito osservato |
|---|---|
| **Interruzione mirata** fra scrittura del riferimento e upload (primo `uploadBytes` che fallisce) | i record sono applicati (Profilo, Account e **metadato dell'allegato**, che cita il percorso dell'oggetto); l'upload viene tentato una volta e fallisce; la lettura dei byte fallisce con `storage/object-not-found` → **riferimento senza byte** |
| **Controllo positivo** (upload riuscito) | riferimento e byte **coincidono**: l'oggetto esiste e il contenuto è quello del backup |

<a id="evidenza-a1a1af036d236c5a1006"></a>

**Perché accade (dal codice).** `executeBackupRestore` applica **prima** tutti i blocchi di record (fase `firestore`) e solo **dopo** carica gli allegati (fase `storage`, `storageStarted = true`); un errore in fase `storage` blocca il piano (`BACKUP_STORAGE_RETRY_BLOCKED`) e **non** esiste compensazione, staging o retry automatico. Il caso osservato è **complementare** a quello già dichiarato in questo documento («senza creare oggetti orfani non referenziati», riga 120): là i **byte senza riferimento**, qui il **riferimento senza byte**.

<a id="evidenza-8e4a74a75ed3b4bfe914"></a>

**Cosa resta dedotto.** Non sono esercitati iPhone/Windows, i backup di grandi dimensioni, le collisioni o le modifiche intercorse dopo l'anteprima, né la ripetizione con `retry` dal piano bloccato (all'epoca asserzione di codice; la sezione «Nuovo tentativo dopo un ripristino interrotto» la osserva poi sul percorso reale con `BACKUP_STORAGE_RETRY_BLOCKED`).

<a id="evidenza-d767f9164d4ef0e588c1"></a>

**Nessuna correzione introdotta.** Come richiesto non ho introdotto staging, compensazione, retry automatici o nuove politiche: il difetto è registrato e il gate resta **aperto** in attesa di una decisione (domande per Diego in `docs/M8_DOMANDE_RIPRISTINO_INTERROTTO.md`, commit separato).

<a id="fonte-docs-m8-backup-recupero-md-nuovo-tentativo-dopo-un-ripristino-interrotto-verifica-21092026"></a>

### Nuovo tentativo dopo un ripristino interrotto (verifica 21/09/2026)

<a id="evidenza-1423dea49f5d50a253a0"></a>

Prova su **emulatori reali** (Firestore + Storage), dati interamente sintetici, **codice di produzione** del client (`prepareBackupRestore` + `executeBackupRestore`) e **callable reale** `restoreBackupChunk`: `tests/restore-retry-new-session.emulator.test.mjs` (3 casi), runner `scripts/run-restore-retry-emulators.mjs`. Punto di partenza: il caso della sezione precedente (record applicati, primo `uploadBytes` fallito, piano bloccato), riaperto in una **nuova** sessione di ripristino con lo **stesso** file.

| Domanda | Esito osservato |
|---|---|
| Che cosa viene **classificato** | i tre record già scritti — **compreso il metadato dell'allegato i cui byte non esistono** — risultano «invariato» (`missing 0, unchanged 3, changed 0`, `collisionCount` 3): la classificazione confronta **solo** il documento Firestore, non i byte in Storage |
| Che cosa può essere **selezionato o confermato** | nulla: sia l'esecuzione senza selezione sia quella con la selezione degli indici «invariato» sono rifiutate con `BACKUP_RESTORE_NOTHING_SELECTED`; **zero** caricamenti tentati (nell'interfaccia le caselle «Invariato» sono disabilitate, `impostazioni.js:620`) |
| Ripetizione **impedita o permessa** | nella **stessa** sessione il piano bloccato resta non riprovabile (`BACKUP_STORAGE_RETRY_BLOCKED`, anche con `retry`); la **ricevuta** dell'applicazione interrotta **non** blocca una nuova sessione (ogni esecuzione ha un proprio `operationId`/`executionId`), ma la nuova sessione non arriva a eseguire perché non resta nulla da applicare, e l'anteprima non scrive ricevute |
| **Stato finale** di riferimento e byte | il metadato continua a citare il percorso e i byte restano assenti (`storage/object-not-found`): il difetto **persiste** e non nasce alcuna nuova ricevuta |
| **Controllo positivo** (metadato mancante) | cancellando il **solo metadato** dell'allegato, la nuova sessione lo classifica «mancante», lo applica e **carica i byte**: riferimento e byte tornano coerenti, con **due** ricevute di applicazione distinte |
| **Controllo positivo** (record modificato) | modificando l'Account, la nuova sessione lo classifica «modificato» e lo applica con esito riuscito (1 record, 0 allegati) **senza** ricaricare i byte: l'allegato resta orfano anche dopo un ripristino riuscito |

<a id="evidenza-4adf246549fa2eac1db9"></a>

**Perché accade (dal codice).** `prepareRestoreExecution` esclude i record «invariato» (`entry.status !== 'unchanged'`) e rifiuta l'esecuzione se non ne resta nessuno; i percorsi Storage da caricare sono quelli dei **soli record applicati** (`collectStoragePaths(records, uid)`), quindi l'allegato di un record escluso non viene mai ricaricato. La ricevuta è legata all'`operationId` dell'esecuzione (`restore:{backupId}:{executionId}:{index}`), mentre l'anteprima usa `restore:{backupId}:{index}` e non persiste nulla.

<a id="evidenza-58cab025872c44d6b690"></a>

**Controllo per mutazione.** Rendendo sempre vero il filtro sugli «invariato» (`entry.status !== 'unchanged'` → `entry.status === entry.status`), il primo caso diventa **rosso** (`BACKUP_COLLISIONS` invece di `BACKUP_RESTORE_NOTHING_SELECTED`) e gli altri due restano verdi; il file di produzione è poi stato ripristinato con hash identico a `HEAD` (`git hash-object` = `1591885ed5a52ba3eb966b80217a8d5a9a55f339`).

<a id="evidenza-f9b3962508518e6ad45f"></a>

**Cosa resta dedotto.** Non sono esercitati iPhone/Windows, i backup di grandi dimensioni, i ripristini con più allegati, né l'interfaccia grafica (le caselle disabilitate sono lette dal codice, non da un browser). Le **collisioni** e le **modifiche intervenute dopo l'anteprima** sono esercitate più avanti, nella sezione «Modifica intervenuta dopo l'anteprima».

<a id="evidenza-62e161019dfa72e10aa9"></a>

**Nessuna correzione introdotta.** Come richiesto non ho introdotto retry automatici, staging, compensazione, migrazione o nuove politiche: il difetto è registrato e il gate resta **aperto** (nuove domande per Diego in `docs/M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md`, commit separato).

<a id="fonte-docs-m8-backup-recupero-md-modifica-intervenuta-dopo-lanteprima-verifica-21092026"></a>

### Modifica intervenuta dopo l'anteprima (verifica 21/09/2026)

<a id="evidenza-eb790db69f10b85eccdc"></a>

Controllo di versione (CAS) osservato sul percorso **reale end-to-end** — client di produzione (`prepareBackupRestore` + `executeBackupRestore`) e callable reale `restoreBackupChunk` — su **emulatori reali** (Firestore + Storage) con dati sintetici: `tests/restore-stale-preview.emulator.test.mjs` (3 casi), runner `scripts/run-restore-stale-emulators.mjs`.

<a id="fonte-docs-m8-backup-recupero-md-prove-già-presenti-prima-di-questa-verifica-censimento-richiesto"></a>

#### Prove già presenti prima di questa verifica (censimento richiesto)

| Dove | Che cosa prova già |
|---|---|
| `functions/test/backup-receipt-handler.test.js:88-120` | handler con store **in memoria**: creazione, cancellazione e cambiamento al nanosecondo dopo l'anteprima → `stale-preview`, nessuna scrittura; il cambio del **Profilo** blocca l'intero blocco; `overwriteExisting` non aggira il controllo; il retry identico precede il CAS |
| `experiments/persistent-vault-shell/firebase-backup.test.mjs:97-116` | lato **backend su emulatore**: `profile-change`, `account-created`, `account-deleted` dopo l'anteprima → `stale-preview` con `staleCount`/`staleIndexes`, snapshot invariati, nessuna ricevuta e nessun audit |
| `tests/backup-restore-session.test.mjs:173-188` | lato **client con callable simulata**: 801 record, blocco obsoleto al primo o al secondo, `progress` accurato, piano invalidato (`BACKUP_PLAN_INVALID`), zero upload |
| `tests/backup-restore-ui.test.mjs:192` | messaggio della UI quando il servizio segnala `BACKUP_PREVIEW_STALE` (servizio simulato) |
| `docs/AUDIT_VAULT_SESSION_P0.md:556` | descrizione del controllo sulla base `dc985f64` (versione e classificazione dalla stessa istantanea, applicazione condizionata a tutte le versioni del blocco) |

**Mancava** una prova end-to-end con la modifica concorrente che avviene **nel database** fra l'anteprima del client e la sua applicazione: è quella aggiunta qui. Le prove esistenti restano valide e non sono state modificate.

<a id="fonte-docs-m8-backup-recupero-md-esiti-osservati"></a>

#### Esiti osservati

| Caso | Esito |
|---|---|
| **Un blocco, modifica concorrente** (creazione del record destinazione dopo l'anteprima) | **rifiuto**: `BACKUP_PREVIEW_STALE` con `confirmedChunks 0`, `attemptedChunks 1`, `mayHaveApplied false`; il valore concorrente **sopravvive**; nessun record creato, **zero** upload (benché un allegato fosse selezionato), **nessuna** ricevuta, **nessun** audit; il piano è invalidato (`BACKUP_PLAN_INVALID`) |
| **Controllo positivo** (stessa selezione, nessuna modifica concorrente) | applicato: 2 record e **1 allegato**, byte presenti e identici al backup, 1 ricevuta, 1 audit |
| **Flusso a più blocchi** (403 record → blocchi da 400 e 3; modifica concorrente su un record del **secondo** blocco) | **parzialità osservata**: il primo blocco è applicato (400 record, 1 ricevuta, 1 audit) e il secondo è rifiutato con `stale-preview` (`confirmedChunks 1`, `mayHaveApplied true`); il valore concorrente sopravvive e la fase Storage **non parte** (`0` upload). Poiché il metadato dell'allegato cade nel **primo** blocco, il rifiuto lascia in Firestore un **riferimento senza byte** creato dal controllo di versione stesso (`storage/object-not-found`), non da un upload fallito |

<a id="evidenza-90b564c9fddf0adbc69d"></a>

**Dal codice:** `staleRestoreIndexes` confronta `expectedVersion` con la versione corrente di ogni record **del blocco** e la callable restituisce `stale-preview` **prima** di qualunque scrittura, ricevuta o audit di quel blocco; il client interrompe i blocchi successivi e la fase Storage, e invalida il piano. La verifica è **per blocco**, non globale: i blocchi già applicati restano.

<a id="fonte-docs-m8-backup-recupero-md-controllo-per-mutazione"></a>

#### Controllo per mutazione

<a id="evidenza-72208f526606661192b4"></a>

Reso sempre vuoto l'esito del controllo (`staleRestoreIndexes` che non segnala più alcun indice), il primo e il terzo caso diventano **rossi** (il valore concorrente verrebbe sovrascritto e il secondo blocco applicato) e il controllo positivo resta verde; `functions/backup-restore-preview.js` è poi stato ripristinato con hash identico a `HEAD` (`git hash-object` = `00cf4dacbe407eb39dda1df7865d05e3747be739`).

<a id="fonte-docs-m8-backup-recupero-md-cosa-resta-dedotto-o-non-esercitato"></a>

#### Cosa resta dedotto o non esercitato

<a id="evidenza-f3b2bf5303d2bf52f878"></a>

iPhone/Windows, backup di grandi dimensioni, blocchi contenenti **più** allegati, sostituzione confermata su collisioni multiple, la UI in un browser (il messaggio è provato con un servizio simulato) e l'esito su un blocco intermedio di un flusso con **più di tre** blocchi. Il rifiuto per modifica concorrente **non** è una compensazione: non annulla i blocchi già applicati.

<a id="fonte-docs-m8-backup-recupero-md-nessuna-correzione-introdotta"></a>

#### Nessuna correzione introdotta

<a id="evidenza-8777a86a202db2cc2fa8"></a>

Come richiesto non ho introdotto politiche, compensazioni, staging o retry: comportamento attuale descritto e parzialità dichiarata. Il gate M8 resta **aperto** e **non** è concluso da questo caso (nuove domande per Diego in `docs/M8_DOMANDE_RIPRISTINO_CAS_PARZIALE.md`, commit separato).

<a id="fonte-docs-m8-backup-recupero-md-collisioni-multiple-con-selezione-e-conferma-verifica-21092026"></a>

### Collisioni multiple con selezione e conferma (verifica 21/09/2026)

<a id="evidenza-e1aff7335e12bdb482f6"></a>

Controllo osservato sul percorso **reale end-to-end** — client di produzione (`prepareBackupRestore` + `executeBackupRestore`) e callable reale `restoreBackupChunk` — su **emulatori reali** (Firestore + Storage) con dati sintetici: `tests/restore-multiple-collisions.emulator.test.mjs` (4 casi), runner `scripts/run-restore-collisions-emulators.mjs`. Stato di partenza: due destinazioni **modificate** rispetto al backup, una **invariata**, profilo e metadato dell'allegato **mancanti** (anteprima reale: `missing 2, unchanged 1, changed 2`, `collisionCount` 3, un solo blocco da 5 record).

<a id="fonte-docs-m8-backup-recupero-md-prove-già-presenti-censimento-riusate-e-non-modificate"></a>

#### Prove già presenti (censimento, riusate e non modificate)

| Dove | Che cosa prova già |
|---|---|
| `tests/backup-restore-session.test.mjs:191-265,341-364` | client con callable **simulata**: un record esistente richiede selezione manuale e conferma `RESTORE_SELECTED_OVERWRITE`; un «invariato» non è selezionabile; selezione non contigua `[0, 2]`; selezione immutabile nel retry; `BACKUP_ATTACHMENT_MISSING` se si seleziona un record senza il suo allegato; selezione del solo allegato |
| `functions/test/backup-restore-service.test.js:27-34,61-66` | validazione del chunk: `overwriteConfirmed` vero solo con `overwriteExisting` **e** `RESTORE_SELECTED_OVERWRITE`; `restoreChunkDecision` blocca le collisioni e le consente con overwrite |
| `functions/test/backup-receipt-handler.test.js:105-120` | handler con store **in memoria**: il cambio del Profilo blocca il blocco; con overwrite confermato il blocco è applicato |
| `experiments/persistent-vault-shell/firebase-backup.test.mjs:60-95` | **backend su emulatore**: applicazione di due record con le versioni dell'anteprima, ricevuta e audit |
| `tests/backup-restore-ui.test.mjs:179-196` | ciclo di vita dell'anteprima selettiva (blocco che la chiude; `stale-preview` senza blocchi applicati), **non** la semantica di selezione |
| `impostazioni.js:617-651` (letto, non esercitato) | caselle «Invariato» disabilitate e «Mancante» preselezionate: comportamento **letto dal codice**, non provato da un banco |

**Mancava** la prova end-to-end con **più collisioni** e selezione parziale sul percorso reale (client + callable + emulatori): è quella aggiunta.

<a id="fonte-docs-m8-backup-recupero-md-esiti-osservati-1"></a>

#### Esiti osservati

| Caso | Esito |
|---|---|
| **Anteprima con più collisioni** (`missing 2, unchanged 1, changed 2`) | l'esecuzione **senza selezione** è rifiutata con `BACKUP_COLLISIONS`; nessun caricamento, **0** ricevute, **0** audit |
| **Selezione di un solo modificato** (`account-1`) | applicato **1 record e 0 allegati**: il selezionato torna alla versione del backup; l'**altro modificato** e l'**invariato** restano intatti — e l'invariato conserva il proprio `updateTime` (prova che non è stato riscritto); il metadato dell'allegato non era selezionato e resta assente, **0** caricamenti; **1** ricevuta, **1** audit |
| **Selezione del modificato con il suo allegato** | applicati **2 record e 1 allegato**: il metadato cita il percorso e i byte coincidono con il backup; l'altro modificato e l'invariato restano intatti (stesso `updateTime`); **nessun** byte per l'Account non selezionato; **1** caricamento, **1** ricevuta, **1** audit |
| **Un selezionato cambia ancora prima dell'applicazione** | rifiuto `BACKUP_PREVIEW_STALE` (`confirmedChunks 0`, `mayHaveApplied false`, un solo blocco): il valore concorrente sopravvive, gli altri record restano intatti, **0** metadati, **0** caricamenti, **0** ricevute, **0** audit; il piano è invalidato (`BACKUP_PLAN_INVALID`) |

<a id="evidenza-d4e50b21440d81dc3805"></a>

**Dal codice:** `prepareRestoreExecution` filtra i record «invariato» e, se la selezione è esplicita, tiene **solo** gli indici scelti; `overwriteExisting` e la conferma `RESTORE_SELECTED_OVERWRITE` sono necessari per sostituire un record esistente; i percorsi Storage da caricare derivano **dai soli record applicati**.

<a id="fonte-docs-m8-backup-recupero-md-controllo-per-mutazione-1"></a>

#### Controllo per mutazione

<a id="evidenza-f2a898b68bbb00f2c324"></a>

Resa sempre vera la condizione di selezione (`selected.has(entry.index)` → sempre vero), il **secondo** e il **terzo** caso diventano **rossi** (`recordCount 4` invece di 1 e 2: verrebbero applicati anche i record non selezionati) e il primo e il quarto restano verdi; `Frontend/public/assets/js/modules/settings/backup-import-service.js` è poi stato ripristinato con hash identico a `HEAD` (`git hash-object` = `1591885ed5a52ba3eb966b80217a8d5a9a55f339`).

<a id="fonte-docs-m8-backup-recupero-md-cosa-resta-dedotto-o-non-dimostrato"></a>

#### Cosa resta dedotto o non dimostrato

- **Nessuna atomicità globale** è dimostrata: in questi casi la selezione sta in **un solo blocco**; la garanzia è **per blocco**, come osservato nella sezione «Modifica intervenuta dopo l'anteprima».
- Non esercitati: UI in un browser (la semantica di selezione è letta dal codice), iPhone/Windows, backup di grandi dimensioni, più allegati per record, selezioni che coprono **più** blocchi con collisioni miste, e la sostituzione confermata su molti record insieme.
- Restano **aperti** staging fra blocchi e allegati, riferimenti orfani e collaudi fisici: **M8 non è concluso**.

<a id="fonte-docs-m8-backup-recupero-md-nessuna-correzione-e-nessuna-nuova-domanda"></a>

#### Nessuna correzione e nessuna nuova domanda

<a id="evidenza-d3dae833c5f0887ac8cc"></a>

Comportamento attuale descritto, nessuna politica, compensazione, staging o retry introdotti. **Non** nascono nuove domande per Diego: le osservazioni rientrano in quelle già raccolte (`M8_DOMANDE_RIPRISTINO_INTERROTTO.md`, `M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md`, `M8_DOMANDE_RIPRISTINO_CAS_PARZIALE.md`), quindi qui non c'è un commit di domande.

<a id="fonte-docs-m8-backup-recupero-md-protezioni-candidate-della-sessione-di-ripristino--13092026"></a>

### Protezioni candidate della sessione di ripristino — 13/09/2026

<a id="evidenza-d1fee4a048bb1f1b7adf"></a>

Base `141259d9`, ramo sperimentale. Prima il piano conservava lo UID del backup mentre la callable usava l'identità Firebase corrente: un cambio utente durante anteprima o conferma poteva far proseguire l'operazione nel contesto sbagliato. Il piano ora appartiene alla sessione che lo ha preparato; importazione, anteprima, invio dei blocchi e upload ricontrollano identità e validità prima/dopo le attese. Blocco Vault anche a UID invariato, logout, pagehide e dismissione annullano i passi successivi. I dialoghi di ripristino sono posseduti dall'azione e la chiave viene rimossa dagli input e dal piano alla chiusura. Un reader di file in attesa viene annullato quando possibile.

<a id="evidenza-ccab358892812431d9d2"></a>

La protezione non annulla richieste callable o upload già iniziati, non è una transazione globale e non garantisce azzeramento fisico delle stringhe JavaScript in memoria. Dopo un tentativo di scrittura, un errore espone soltanto contatori tecnici e `mayHaveApplied`; la UI segnala un possibile ripristino parziale e richiede di verificare il Vault prima di ritentare, senza dichiarare semplicemente il backup non valido. Nessun retry automatico o compensazione.

<a id="evidenza-5cab5c05cb22839bfa35"></a>

Formato v2, parametri crittografici e schema dei dati restano invariati. Il comando callable richiede ora `expectedOwnerUid`, confrontato con lo UID autenticato prima di accedere a Firestore: copre anche il cambio identità durante il recupero asincrono del token SDK. Campo mancante o discordante produce `BACKUP_OWNER_MISMATCH`, senza fallback permissivo. Nessuna migrazione dei backup. Staging, confronto atomico rispetto all'anteprima, ricevute pregresse, ripresa complessiva e prove su dispositivi reali restano gate aperti.


<a id="evidenza-a33b8cb4a31d6ad5c88e"></a>

Compatibilità e distribuzione: il nuovo backend rifiuta anche i client vecchi senza `expectedOwnerUid`; il vecchio backend non applica il controllo aggiunto. Servono ambiente di collaudo e distribuzione coordinata client/backend, con gestione delle copie PWA precedenti. Non distribuire soltanto il client dichiarando risolta la race del token. Un rollback non deve ripristinare un writer che accetta silenziosamente l'identità corrente al posto del proprietario previsto. Questo rilascio backend resta non eseguito e soggetto al gate strutturale esistente.


<a id="fonte-docs-m8-backup-recupero-md-ricevute-attendibili-del-ripristino--candidata-13092026"></a>

### Ricevute attendibili del ripristino — candidata 13/09/2026

<a id="evidenza-250fbf930c587691d874"></a>

Il nuovo writer salva la ricevuta in `mutationResults/{uid}/operations/{operationId}`, registro storicamente non scrivibile dai client. Un digest SHA-256 del comando normalizzato completo vincola proprietario, dominio, contenuti, consenso e suddivisione in blocchi. Un retry identico restituisce soltanto stato e conteggio verificati, prima di valutare le collisioni; non riscrive record cambiati dopo il primo ripristino. Una richiesta diversa con lo stesso identificatore viene respinta.

<a id="evidenza-34f02d937622c0f3f3b5"></a>

Le ricevute pregresse in `backupRestoreOperations` non vengono promosse: senza una ricevuta attendibile il writer rifiuta l'applicazione e richiede verifica. L'anteprima calcola le collisioni dai documenti effettivi. I test dell'handler reale con Firestore simulato coprono retry, payload cambiato, ricevute malformate e storiche; non certificano un ripristino end-to-end su Storage.

<a id="evidenza-c1d470b2851636e38aca"></a>

Questo blocco non risolve ancora il confronto atomico fra anteprima e applicazione, staging, compensazione o atomicità tra blocchi. Nessuna migrazione dei dati o distribuzione eseguita. Il rollback deve conservare sia il vincolo proprietario sia questo registro: tornare al vecchio writer riaprirebbe la fiducia nelle ricevute storiche.


<a id="fonte-docs-m8-backup-recupero-md-confronto-con-lanteprima--candidata-13092026"></a>

### Confronto con l'anteprima — candidata 13/09/2026

<a id="evidenza-141deb63f6f7dbb3d810"></a>

Dopo il checkpoint `dc985f64`, la callable produce classificazione e versione del documento dalla stessa snapshot transazionale. La risposta contiene soltanto indice, stato e versione (`exists`, secondi/nanosecondi di `updateTime`), senza restituire i dati correnti. Il client conserva le versioni nella sessione del piano e le associa agli indici originali prima della selezione e della suddivisione dei blocchi. Non usa più una raccolta precedente del Vault per decidere il confronto.

<a id="evidenza-16adbb82b54432e7acb9"></a>

In applicazione tutte le versioni, compreso il Profilo, vengono confrontate prima di scrivere. Creazione, cancellazione o modifica dopo l'anteprima fermano l'intero chunk con `stale-preview`, senza dati, ricevuta o audit scritti da quel chunk. La sostituzione confermata non aggira questo controllo. Il Profilo esistente richiede anch'esso la scelta e il consenso alla sostituzione. La ricevuta attendibile di un retry identico precede il confronto, perché il primo tentativo può aver già cambiato le versioni.

<a id="evidenza-f46ccbb23166b2353334"></a>

Una nuova anteprima è obbligatoria dopo un esito obsoleto. Se blocchi precedenti sono stati applicati, la UI segnala il ripristino parziale; i successivi blocchi e upload non partono. Il formato del file e la cifratura restano invariati. Il protocollo callable cambia: backend vecchio senza `previewVersion: 1` viene rifiutato dal client; backend nuovo richiede `expectedVersion` per ogni record applicato. Rilascio coordinato e rollback che conservi tutti i controlli restano necessari.

<a id="evidenza-14a1ca61cc297e6544dd"></a>

Questa è atomicità del singolo chunk Firestore, non dell'intero backup: staging, compensazione, ripresa fra esecuzioni e Storage restano aperti. Le prove automatiche con servizi simulati non sostituiscono il collaudo del ripristino sui dispositivi.

Verifica dei tipi: i byte vengono ricostruiti come Buffer compatibile con Admin SDK; export e confronto rifiutano numeri non finiti anziché convertirli implicitamente in null. Nessun nuovo formato o conversione dei file precedenti.


<a id="fonte-docs-m8-backup-recupero-md-ripresa-nella-stessa-sessione--candidata-13092026"></a>

### Ripresa nella stessa sessione — candidata 13/09/2026

<a id="evidenza-92549d0ca403a563af61"></a>

Dopo il checkpoint Archivio `f67c8d7b`, l'esecuzione Firestore conserva un piano privato immutabile: selezione, chunk, consenso, versioni e identificativi vengono preparati una sola volta. Una sola chiamata per piano può essere in corso. Dopo una risposta persa il client può reinviare il chunk incerto soltanto su scelta esplicita, con identico comando; quelli già confermati vengono saltati. Il server verifica la ricevuta protetta prima del CAS. Non si rigenerano silenziosamente versioni o identificatori.

<a id="evidenza-78ab605e6a3e25afd5e9"></a>

La UI mantiene piano e chiave soltanto mentre offre «Verifica e riprendi» nella sessione attiva. Interrompi, blocco Vault, cambio identità o dismissione chiudono il dialogo e rilasciano il piano. Nessun retry automatico. Rifiuti definitivi e anteprima obsoleta non vengono ritentati; un esito incerto dopo l'inizio di Storage blocca la ripetizione generica. Dopo successo una seconda chiamata restituisce il risultato già registrato, senza ripetere gli upload.

<a id="evidenza-b87b5bcc65f959172dcb"></a>

Questo passo non salva un journal durevole, non riprende dopo refresh, non fornisce staging degli oggetti né compensazione globale. La retention delle eventuali copie intermedie richiede una decisione distinta prima di attivarle. Il formato cpbackup resta invariato.


<a id="fonte-docs-m8-backup-recupero-md-prerequisiti-verificati-per-lo-staging-degli-allegati--13092026"></a>

#### Prerequisiti verificati per lo staging degli allegati — 13/09/2026

<a id="evidenza-1ac83733ce0d7898ca9b"></a>

Il runtime allegati v1 usa AAD costante `CodiciPassword-Attachment-v1`: percorso Storage, nome e ID Account non entrano nella cifratura o nel wrapping. Il prototipo di condivisione lega invece recordId/attachmentId, che devono restare invariati, ma non storagePath. Il contenitore backup v2 è distinto dal formato dell'allegato. I legacy senza `encryption` vengono aperti tramite URL e richiedono classificazione separata: nessuna riscrittura automatica.

<a id="evidenza-c2027b99a2df6af1a2f1"></a>

Una futura promozione deve verificare digest/dimensione/generazione dello staging e copiare su un nuovo percorso finale nel prefisso dell'Account: un riferimento permanente sotto restoreStaging sarebbe rifiutato dal purge. Le Rules attuali consentono al proprietario di modificare gli oggetti, quindi un controllo iniziale non prova immutabilità. Staging e promozione non sono implementati da questa annotazione.

Correzione export candidata `630972ec`: supportato il tipo Bytes restituito dal vero SDK Web Firestore, oltre a Uint8Array. Il test usa la classe SDK installata e conserva il tag bytes esistente; nessun nuovo formato di backup.


<a id="fonte-docs-m8-backup-recupero-md-manifest-degli-allegati-selezionati--candidata-13092026"></a>

#### Manifest degli allegati selezionati — candidata 13/09/2026

<a id="evidenza-1c1d183d7bd28244e192"></a>

L'importazione riusa la raccolta ricorsiva dei percorsi dell'export: include riferimenti annidati in aziende/scadenze e altri scope, deduplicando gli oggetti. Il manifest dell'esecuzione rimane immutabile nei retry. Prima delle scritture, ogni oggetto selezionato deve essere presente nel backup; upload e conteggio seguono soltanto quel manifest, senza creare oggetti orfani non referenziati.

<a id="evidenza-54e3fd1d906a7fe80921"></a>

La prima lettura rifiuta oggetti duplicati, percorsi di altri proprietari e contenuti mancanti, vuoti, base64 malformati o eccessivi. La lunghezza viene limitata prima della conversione base64; i byte non vengono conservati nel piano. Il recupero selettivo degli elementi validi resta possibile se il file manca per un record non selezionato. Nessuno staging remoto o cambio implicito degli URL legacy.

<a id="fonte-docs-m8-backup-recupero-md-lettura-incrementale-del-file--candidata-13092026"></a>

#### Lettura incrementale del file — candidata 13/09/2026

<a id="evidenza-a972fd4b8797b125eaf4"></a>

Il percorso alternativo senza TextDecoderStream legge porzioni da 64 KiB con decodifica UTF-8 incrementale e rigorosa. Entrambi i percorsi limitano la riga prima della concatenazione, interrompono la lettura al blocco del Vault e rifiutano record oltre il limite prima di accumularli nel piano. Le prove backup passano: 58 test.

<a id="evidenza-50a14bad6c3b1dddeaae"></a>

Il limite per riga tiene conto della doppia codifica base64 degli allegati. Questo non limita ancora la memoria aggregata dei record né i temporanei crittografici del singolo allegato; il completamento del requisito memoria M8 resta aperto.


<a id="fonte-docs-m8-backup-recupero-md-identità-degli-allegati-fra-le-due-letture--candidata-13092026"></a>

#### Identità degli allegati fra le due letture — candidata 13/09/2026

<a id="evidenza-35670a85e3f9637cf6c1"></a>

Il piano privato conserva il digest crittografico dell'involucro di ciascun allegato già calcolato durante la verifica iniziale. Prima di ogni upload la seconda scansione deve produrre lo stesso digest per il percorso selezionato; duplicati e contenuti cambiati interrompono il ripristino. Non vengono caricati byte diversi da quelli verificati nell'anteprima. I digest vengono rilasciati con la sessione.

<a id="evidenza-0ec530b578ab2a374cd8"></a>

Le scritture Firestore precedenti possono essere già avvenute: l'errore conserva l'indicazione di ripristino parziale e blocca il retry generico Storage. Non è una transazione globale o uno staging. Suite backup: 61 test superati, inclusi tre nuovi casi sulla seconda lettura.


<a id="fonte-docs-m8-backup-recupero-md-transazioni-nel-database-emulato--candidata-13092026"></a>

#### Transazioni nel database emulato — candidata 13/09/2026

<a id="evidenza-1c0df13369f2e8099113"></a>

Il runner delle mutazioni include il callable originale restoreBackupChunk su Firestore/Auth demo locali: 32 test complessivi superati, inclusi sette test backup (contenitore e sei scenari). Verificati CAS su Profilo/Account, creazione/cancellazione concorrente, consenso, retry attendibile prima del CAS, isolamento proprietario, byte e timestamp reali e Rules delle ricevute. Il test invoca direttamente l'handler: non certifica trasporto HTTPS, App Check remoto, trigger o Storage distribuito.


<a id="fonte-docs-m8-backup-recupero-md-limiti-dellanteprima-in-memoria--candidata-13092026"></a>

#### Limiti dell'anteprima in memoria — candidata 13/09/2026

<a id="evidenza-c2fa8415ba0604a5b0e0"></a>

Base `b4bec892`, ramo `experiment/m8-restore-memory-budget`: durante la prima scansione vengono ammessi al massimo 10.000 record e 16 Mi caratteri JSON complessivi dei record, più 10.000 allegati e 2 Mi caratteri per percorsi/digest trattenuti. I limiti sono controllati prima dell'inserimento nelle strutture dell'anteprima e prima di qualsiasi chiamata di confronto/ripristino. Restano anche i limiti per riga, singolo record e allegato. Superamento: nessun ripristino, rilascio della sessione e messaggio che invita a conservare il file; non viene classificato come backup corrotto.

<a id="evidenza-7bf08b8609cbac98f4f8"></a>

Sono soglie conservative di ammissione, non una misura esatta dello heap: oggetti JS, descrizioni, confronto, decifratura del singolo elemento e copie temporanee hanno costi aggiuntivi. Il limite di 16 Mi caratteri rappresenta fino a 32 MiB per una sola rappresentazione UTF-16; non significa 32 MiB di RAM totali. Servono misurazioni sui dispositivi supportati prima di certificare il requisito memoria M8. Quattro nuove prove coprono superamento cumulativo, limite esatto, interruzione prima dei record successivi e messaggio UI; suite backup 65 test superati. Staging, journal durevole e compensazione restano aperti. Nessuna modifica al formato, al backend, ai backup esistenti o ai dati reali.

<a id="fonte-docs-m8-backup-recupero-md-unicità-globale-delle-destinazioni--candidata-13092026"></a>

#### Unicità globale delle destinazioni — candidata 13/09/2026

<a id="evidenza-4bfb8a7e19293644c54e"></a>

Base `5fa297ab`: la prima scansione identifica le destinazioni con tuple non ambigue e le rifiuta se duplicate, anche fra chunk diversi. Profilo con ID descrittivi diversi e Widget privati/aziendali con lo stesso ID fisico non costituiscono record separati. I separatori contenuti negli ID non provocano false collisioni; campi di contesto ignorati dal backend non creano false identità. Il confronto locale usa la stessa identità. Il server resta responsabile della validazione e delle autorizzazioni.

<a id="evidenza-ba6f2d07a61b6eab69d4"></a>

Suite backup: 68 test superati. Il test di equivalenza confronta le identità client con restorePath del backend per tutti i domini; due regressioni verificano duplicati oltre 400 record e alias Profilo/Widget, senza chiamate server o upload. L'insieme delle identità è limitato dalle soglie d'anteprima e rilasciato con la sessione. Non rende atomico il ripristino: staging/journal e concorrenza globale restano aperti.

<a id="fonte-docs-m8-backup-recupero-md-esportazione-vincolata-alla-sessione--candidata-14092026"></a>

#### Esportazione vincolata alla sessione — candidata 14/09/2026

<a id="evidenza-0a08c27ee44422176a73"></a>

Base `4dd2f0a2`, ramo `experiment/m8-export-session`: export e raccolta dati verificano proprietario, abort, blocco Vault e pagehide ai confini asincroni. Dopo invalidazione non iniziano nuovi download, cifrature o scritture; il sink viene annullato quando il passaggio in corso restituisce il controllo. Errori del provider non vengono riportati con dettagli sensibili. Conferma e Recovery Key appartengono alla stessa azione: chiusura e cambio sessione rimuovono il valore dal DOM; risposte tardive non riaprono finestre né riabilitano un'esportazione nuova.

<a id="evidenza-661090676ddc2b19dce5"></a>

Suite completa npm test superata; 11 prove servizio e 17 prove UI superate (l'ultima regressione UI sul rimontaggio eseguita separatamente dopo l'avvio della suite). Prove sintetiche, non collaudi fisici. Non si può annullare retroattivamente un file già chiuso, un download già avviato o una richiesta clipboard già consegnata al browser; picker nativo e operazioni pendenti non sono resi interrompibili. Le variabili rilasciate non provano azzeramento fisico della memoria JavaScript. Formato e parametri crittografici invariati; staging, journal durevole, compensazione e limiti aggregati dell'export restano aperti. Nessun deploy.

<a id="fonte-docs-m8-backup-recupero-md-limite-del-download-in-memoria--candidata-14092026"></a>

#### Limite del download in memoria — candidata 14/09/2026

<a id="evidenza-f0d8ab2280bf776634a7"></a>

Base `fc3927d2`, ramo `experiment/m8-export-buffer-limit`: il fallback senza File System Access ammette fino a 64 Mi caratteri di righe JSON già cifrate. Il controllo cumulativo precede l'accumulo; superamento o annullamento rilasciano i frammenti e impediscono la creazione di un download parziale. La UI propone un browser con salvataggio diretto su file. Il percorso progressivo non usa questo buffer e il formato non cambia.

<a id="evidenza-3496c6cac584474b212c"></a>

È una soglia conservativa del solo contenuto trattenuto, non un limite certificato di RAM: raccolta dei record, cifratura del singolo elemento, conversioni, Blob e copie del browser hanno costi ulteriori. Le misure fisiche e il limite della raccolta iniziale restano aperti. Suite backup: 90 prove superate, comprese frontiera esatta, overflow cumulativo, assenza di download troncato, successo fallback e messaggio UI. Manifest offline rigenerato; controlli offline, riferimenti statici, budget delle 30 pagine e sintassi superati. Nessun deploy.

<a id="fonte-docs-m8-backup-recupero-md-ammissione-dei-record-raccolti--candidata-14092026"></a>

#### Ammissione dei record raccolti — candidata 14/09/2026

<a id="evidenza-eb96a88d963c28d6ffd5"></a>

Base `29263519`, ramo `experiment/m8-export-record-limits`: massimo 10.000 descrittori e 16 Mi caratteri JSON cumulativi, coerenti con le soglie record dell'anteprima di ripristino. Ogni descrittore è controllato prima dell'inserimento; gli Account e allegati non creano più un secondo array aggregato per Account. Su superamento la raccolta si interrompe, non prosegue con altre letture e non cifra record o footer; lo stream aperto viene annullato. Messaggio distinto dal limite del download Blob: cambiare browser non aggira il limite dei record.

<a id="evidenza-0d75642d1ba7843f7dc5"></a>

93 prove backup superate; budget statici e sintassi superati. Sono limiti di ammissione dei descrittori trattenuti, non delle snapshot SDK già ricevute o della serializzazione temporanea del singolo record. Paginazione delle letture, manifest percorsi, memoria sui dispositivi, staging e journal restano aperti. Nessun formato, soglia import, versione o deploy modificato.

## Riesame comparativo di mercato dopo il riordino — 23/09/2026

È stato confrontato il programma consolidato nei 31 MD con documentazione ufficiale
aggiornata di 1Password, Bitwarden, Proton Pass, Apple Passwords e Google Password
Manager. Il controllo ha incluso: cifratura e metadati, passkey, TOTP, salute delle
credenziali, condivisione, recupero, portabilità, dispositivi/sessioni e funzioni
privacy. Non sono stati usati punteggi commerciali o dichiarazioni di superiorità.

La ricerca nelle fonti prima e dopo la migrazione conferma la conservazione degli
obiettivi già presenti: Emergency Access zero-knowledge, autofill separato, provider
di violazioni soggetto a consenso, passkey distinte dallo sblocco Vault, backup,
condivisione, offline, retention e audit indipendente. La mappa dettagliata è nella
sezione «Confronto sintetico con prodotti maturi» del PROGRAMMA.

Il delta non è attribuibile alla riduzione da 71 a 31 MD. Le aree assenti o soltanto
abbozzate erano già tali nella fonte precedente: autenticatore TOTP per i servizi,
alias email, link temporaneo a non utenti, import/export interoperabile, Vault multipli,
inventario e revoca remota delle sessioni/dispositivi, modalità viaggio e generatore
di password. Sono opportunità o requisiti candidati, non difetti automaticamente
assegnati né autorizzazioni a collegare servizi esterni.

Limiti: il confronto riguarda funzioni pubblicamente documentate, non una verifica
del codice o dell'efficacia crittografica dei concorrenti; piani commerciali e
disponibilità possono cambiare. Ogni eventuale adozione richiede threat model,
privacy, dipendenze, portabilità, costi operativi e collocazione nel programma decisi
separatamente. Nessun comportamento applicativo è stato modificato da questo audit.
09/10/2026 — MFA-CONSUME riduzione del rischio locale: dopo la prenotazione del recovery code, l'handler rilegge l'utente Auth e confronta l'insieme ordinato `{factorId, uid}` prima del full-replace. Un fattore aggiunto nel frattempo produce `failed-precondition`, zero `updateUser` e codice conservato. Test mirati 14/14, concorrenza Firestore 2/2. Il controllo riduce ma non elimina la race: un fattore aggiunto dopo la seconda lettura e prima di `updateUser(...enrolledFactors:null)` non è protetto; gate ancora aperto in assenza di rimozione TOTP selettiva/CAS.

09/10/2026 — Decisione MFA e distribuzione: il full-replace dei fattori è stato rimosso dal runtime. Con MFA attivo `recoverMfaWithCode` ora fallisce chiuso e indirizza all'assistenza senza prenotare o consumare codici e senza invocare `updateUser`. Commit `b18d6c88`, deploy limitato alla sola Function e verifica remota `ACTIVE` (`europe-west1`, Node.js 22, hash `44c5590082c851780a3e5b34745f726bbbe233ad`). Nessun recupero MFA reale è stato eseguito; audit indipendente e prove fisiche restano non dichiarati.
