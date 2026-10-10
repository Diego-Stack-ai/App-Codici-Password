# Collaudi

## 10/10/2026 — PDF azienda e preparazione immagini candidata 1.2.157

- PDF azienda: layout a schede, due colonne per campi brevi, larghezza piena e segmentazione multipagina per testi lunghi. Suite **33/33**; fixture sintetica renderizzata e ispezionata su tre pagine, senza sovrapposizioni o troncamenti.
- Immagini: editor condiviso collegato a Documenti Profilo, Account privati/aziendali e Scadenze; rotazione 90°, ritaglio tattile e lato massimo 2048 px. OCR e parser assenti. Suite allegati/editor **56/56**.
- CPFE2: corretti i validatori Account emersi dal primo full run; Vault shell **829/829** e Vault Emulator **21/21**.
- Gate statici: sintassi **182 moduli**, CSS, riferimenti statici, runtime offline **264 risorse** e budget prestazionale verdi.
- Verifica integrale: `npm test` completato con codice di uscita **0**, incluse tutte le suite locali e con emulatori previste dal progetto.

## 10/10/2026 — attivazione candidata M7 globale e writer CPFE2

- M7: interlock statico portato a policy attiva; nessun override da richiesta o ambiente. Restano obbligatori conferma `DELETE_FOREVER`, owner binding, revisione, global lock, ricevuta e audit. Prove mirate purge **26/26**.
- CPFE2: `encrypt()` produce ora l'envelope versionato `CPFE2` con PBKDF2-SHA256 a 600.000 iterazioni e AES-GCM-256; la lettura legacy a 100.000 resta compatibile. Prove crypto e diagnostica **19/19**.
- Controlli statici iniziali: sintassi **181 moduli**, CSS e diff whitespace verdi.
- Limite esplicito: questo incremento non rende attivi M8 V2 o MFA selettivo, che non dispongono ancora di un percorso runtime completo e sicuro.

## Rilascio completo 1.2.154 — 10/10/2026

- Integrazione: PR #97, merge commit `eb1380c0` su `master`.
- CI finale su PR: documentazione verde; validazione completa verde in 5m59s, inclusi emulatori di backup/ripristino aggiornati per lo scope `account-widget-profile`.
- CI successiva su `master`: validazione completa verde in 5m43s.
- Deploy Firebase: Hosting, Firestore Rules, Storage Rules, `manageAccountWidget`, `manageWidgetProfile`, `uploadProfileDocumentAttachment` e `removeProfileDocumentAttachment`; tutte le operazioni concluse con successo.
- Verifica remota: `home_page.html?v=1.2.154` HTTP 200 e riferimenti versione presenti; `profilo_privato.html?v=1.2.154` HTTP 200 e foglio `profile-document-attachments.css?v=1.2.154` presente.
- Perimetro pubblicato: cataloghi profili Widget separati Account/Banca, istanze con valori locali alla destinazione, titoli strutturali uniformati, allegati cifrati immagine/PDF sui documenti personali.
- Esclusioni: nessuna migrazione automatica dei widget legacy, nessun OCR, nessuna attivazione di M7 generale, M8 riprendibile, MFA automatico o writer CPFE2.

## Profili Widget separati dalle istanze — 10/10/2026

- Contratto: profili `account|bank` privi di valori; istanze con `profileId`, destinazione e valori propri.
- UI: cataloghi distinti Account/Banca con titolo, descrizione e lista campi; creazione vuota e libera; duplicato bloccato nella stessa destinazione.
- Compatibilità: istanze storiche prive di profilo conservate senza riscrittura automatica.
- Sicurezza/backend: validazione profilo, owner binding, App Check, revisione, audit, global purge fence e scritture client negate dalle Rules.
- Backup: nuovo scope `account-widget-profile`, identità e percorso proprietario verificati.
- Esiti: UI/lifecycle **41/41**, backup **110/110**, Functions/security **440 pass, 9 skip, 0 fail**, sintassi/riferimenti/CSS verdi.
- Limite: suite Firestore Rules non eseguita per timeout di avvio dell'Emulator Hub sulla porta 4400; test dedicato presente ma non dichiarato superato. Nessun dato reale, commit o deploy.

## M10 — CPFE2 dual-read nel browser reale — 10/10/2026

- Runner locale dedicato: `experiments/persistent-vault-shell/benchmark-vault-kdf-server.mjs`; pagina isolata su loopback, senza account, Firebase o dati reali.
- Ambiente: Chrome 155 su Windows 10, sorgente runtime `crypto-utils.js` SHA-256 `65a4db4e1ba4f35167ff3aa33883156652ef4d8e7cbb16e3fa386dbccd7bfb40`.
- Esito: fixture CPFE2 generata indipendentemente e letta dal runtime; password errata respinta; `encrypt()` verificato ancora legacy, quindi nuove scritture CPFE2 disabilitate.
- Misura `fieldV2Read`, 7 campioni dopo warm-up: **72,4 / 72,9 / 74,1 ms** min/mediana/max con PBKDF2-SHA256 a 600.000 iterazioni.
- Raccordo applicativo: `account-loaddata-full-context.test.mjs` **20/20**; i moduli Crea/Modifica Account privato e aziendale riconoscono e decifrano campi CPFE2 sintetici attraverso il guardiano di caricamento, senza rendere salvabile un errore.
- Confine strict: suite crittografia **16/16**; qualsiasi valore nel namespace riservato `CPFE2.`, anche corto, non canonico o malformato, viene trattato come ciphertext e fallisce chiuso invece di ricadere a testo in chiaro.
- Limiti: singolo browser desktop; non è integrazione applicativa, matrice dispositivi, audit indipendente, approvazione dei parametri o autorizzazione alla migrazione.

## M8 — regressione locale dopo CPFE2 — 10/10/2026

- Comando: `npm run test:backup-prototype`.
- Esito: **110/110** superati su export/import cifrato, intestazione, preflight, collisioni, selezione, retry, interruzioni, buffer e UI di ripristino.
- Perimetro: fixture e dati sintetici; nessun servizio remoto, dato reale, migrazione o attivazione del motore riprendibile.
- Limiti invariati: GCS reale, integrazione distribuita e dispositivi fisici restano gate esterni.

## M7 — regressione pura del purge vincolato — 10/10/2026

- Suite `purge-*.test.mjs` senza emulatori: primo passaggio **55/56**, perché la fixture Storage non esponeva ancora `getMetadata()` richiesto dall'executor già protetto.
- Correzione limitata al doppio sintetico: `getMetadata()` restituisce la generation prevista e il file generation-pinned continua a verificare `generation` e `ifGenerationMatch` come stringhe esatte.
- Rerun: **56/56** superati; fence, stop, journal, inventario, sequenza, riconciliazione e assenza di retry incerto restano verdi.
- Nessuna modifica al motore live, nessuna delete remota e nessuna abilitazione del purge.

## MFA e Functions — regressione conclusiva locale — 10/10/2026

- `node --test functions/test/recovery-security.test.js`: **11 pass, 4 skip storici**, 0 fail.
- `npm run test:functions-security`: **424 totali, 415 pass, 9 skip dichiarati, 0 fail**, inclusi lint e controlli sintattici Functions.
- Verificato che la policy assistita arresti il recupero con fattori iscritti prima di prenotare/consumare codici o aggiornare Auth.
- Full-replace e withdraw selettivo restano hard-off; nessun recupero reale, deploy o modifica dati eseguiti.

## Account privato — doppio salvataggio pubblicato 1.2.150 — 09/10/2026

Prerequisiti osservati: record sintetico `TEST v147 - Account privato`, URL senza `m6pilot`, Vault già sbloccata e Hosting `1.2.150`. Primo ciclo: nota impostata a `TEST persistenza 1.2.150 - diagnosi B`, salvataggio, navigazione `afterWrite=1` e rilettura confermata nel dettaglio. Secondo ciclo immediato sullo stesso record: nota `diagnosi C`, nuovo salvataggio e nuova rilettura confermata. Il DOM ha mostrato il valore nuovo in entrambi i cicli; nessun recupero offline o conflitto è comparso. Il test `account-save-context-blocks-writes.test.mjs` esegue inoltre il callback transazionale e verifica due aggiornamenti consecutivi con note cifrate differenti.

## M8 — collaudo pubblicato 1.2.145 concluso — 09/10/2026

Deploy del solo Firebase Hosting riuscito (263 file); Functions, Rules e dati invariati. Nella sessione sintetica isolata la Vault è stata sbloccata dall'utente, lo stesso backup cifrato è stato caricato e la Recovery Key inserita direttamente dall'utente. Tre evidenze concordano: DOM con `Il backup è integro`, schermata dell'anteprima e contenuto copiabile `Mancanti: 0; modificati: 0; invariati: 1`. Il solo profilo è invariato e non selezionabile; nessun ripristino è stato applicato. L'errore server precedente non ricorre: `settings/security` è stato autenticato/contato ma escluso dal piano prima della callable, conservando la sicurezza corrente.

## M8 — esclusione sicurezza dal ripristino pubblicabile — 09/10/2026

La prova browser con backup cifrato sintetico ha autenticato e decifrato correttamente il file, ma la callable ha respinto il piano perché il client pubblicato inviava ancora `users/{uid}/settings/security`. Corretto il raccordo runtime: il record resta autenticato e contato nel footer, ma viene escluso dal piano prima dell'anteprima e non raggiunge il server; la UI dichiara che le impostazioni di sicurezza correnti vengono conservate. Regressione backup **110/110**, riferimenti statici, sintassi, hardening e coerenza versione `1.2.145` verdi. Il ripristino effettivo resta da confermare nell'app pubblicata e richiede conferma distruttiva separata.

## M7 — collaudo controllato sull'app pubblicata — 09/10/2026

La callable `purgeArchivedAccount` è stata distribuita con un'eccezione di rollout limitata all'account sintetico `codex-collaudo-20261009@example.invalid`; per tutti gli altri utenti l'interlock continua a rispondere come sospeso. Prima del deploy: suite Functions/security **424 totali, 415 superati, 9 skip emulatori dichiarati, 0 falliti** e lint verde. Deploy mirato della sola callable in `europe-west1` riuscito.

Nell'app pubblicata è stato creato un Account sintetico chiaramente identificato, archiviato e quindi eliminato definitivamente dall'utente dopo la conferma distruttiva. Tre riscontri concordano: DOM con stato `Nessun account trovato`, schermata visiva dell'archivio vuoto e messaggio finale copiabile `Eliminato definitivamente`; console senza errori o warning. Nessun dato reale è stato usato o eliminato. Il collaudo dimostra il percorso nominale per questo attore sintetico, non risolve le race già documentate né autorizza l'abilitazione M7 generalizzata.

## Avvio nuovo ciclo di prova — 09/10/2026

Controllo visivo non distruttivo sull'app pubblicata: sessione autenticata valida, versione `1.2.144`, home, area privata e pagina Impostazioni accessibili; nessun errore o warning console nelle viste osservate. Individuata un'immagine profilo apparentemente non caricata nella home. Non sono stati creati, modificati, ripristinati o eliminati record. I test con scritture e la rimozione degli interlock restano sospesi per backup preventivo non ancora disponibile.

Il prerequisito è stato successivamente superato: export Firestore completo `Riuscita`, 551 documenti e 422,61 kB nel bucket UE dedicato. La prossima fase può usare l'app per collaudi funzionali non distruttivi e può usare esclusivamente fixture/emulatori o record sintetici chiaramente identificati per scenari distruttivi. L'export non autorizza da solo la rimozione contemporanea di tutti gli interlock produttivi.

## Chiusura del ciclo di collaudo locale — 09/10/2026

La candidata `1.2.144` ha superato i gate locali usati per il rilascio: Functions/security 413 pass e 9 skip emulatori, offline 14/14, riferimenti statici e hardening. Il deploy completo è terminato con esito positivo e il controllo HTTP successivo ha restituito 200 per pagina iniziale e manifest, con versione corretta. Questo chiude il collaudo locale del ciclo; non sostituisce prove GCS reali, matrice fisica o audit esterno, trasferiti a un futuro incarico.

09/10/2026 — regressione completa ripetuta dopo la rimozione fisica del full-replace MFA: `npm run test:functions-security` **422 totali, 413 pass, 9 skip dichiarati, 0 fail**; lint e sintassi inclusi nel comando.

## 09/10/2026 — rimozione meccanica full-replace MFA

- Da `recoverMfaWithCode` rimossi update completo dei fattori, prenotazione/consumo automatico del codice e revoca automatica sessioni.
- `node --check`, ESLint mirato e `recovery-security.test.js`: **11 pass, 4 skip storici, 0 fail**.
- Account con fattori: assistenza manuale; account senza fattori: nessun recupero necessario. Entrambi terminano senza accesso a `mfaRecovery` e senza mutazioni Auth.
- Modifica esclusivamente locale; nessuna Function distribuita e nessun account reale usato.

## 09/10/2026 — applicazione locale MFA opzione 1

- `recoverMfaWithCode` con TOTP o altro fattore restituisce `failed-precondition` con indicazione assistenza prima della raccolta `mfaRecovery` e prima di `updateUser`; codice non consumato.
- Prova mirata nuova: policy assistenza manuale, zero letture/prenotazioni codice e zero aggiornamenti Auth.
- `npm run test:functions-security`: **422 totali, 413 superati, 9 skip, 0 falliti**; lint e sintassi verdi.
- Quattro skip aggiuntivi sono scenari storici del vecchio full-replace, mantenuti visibili ma non più raggiungibili per decisione di prodotto. Nessun recupero o account reale e nessun deploy.

## 09/10/2026 — gate negativo custom-token MFA

- Auth Emulator su `scripts/test-mfa-session-emulator.mjs`: caratterizzazione completata con account sintetico e teardown.
- Dopo creazione del custom token e cancellazione dell'utente prima dello scambio, `accounts:signInWithCustomToken` restituisce successo e ricrea lo stesso UID come nuovo account senza email.
- Esito: **gate fallito per il design server-only**; le 12/12 prove fixture attestano soltanto l'orchestrazione nominale e non autorizzano integrazione o attivazione.
- Corretto nello script un requisito estraneo di `FUNCTIONS_EMULATOR_HOST`; il banco ora richiede esplicitamente soltanto Auth Emulator loopback.

## 09/10/2026 — ponte token server-only per MFA selettivo

- Quattro suite laboratorio MFA: **12/12 superati**.
- Il bridge genera e scambia il custom token soltanto nel backend, non restituisce token Firebase, invoca il withdraw sul singolo enrollment e revoca i refresh token sia dopo successo sia dopo errore successivo allo scambio.
- Scambio, withdraw e revoca sono fixture; controllo statico conferma assenza di import nel runtime.
- Fonti ufficiali riesaminate: custom auth token escluso dai provider soggetti a MFA; Identity Platform non offre recupero del secondo fattore preconfezionato e demanda all'app una verifica d'identità adeguata. Serve ancora prova emulata/staging del protocollo reale.

## 09/10/2026 — composizione end-to-end sintetica MFA selettiva

- Tre suite laboratorio MFA: **9/9 superati**.
- Verificati rimozione del solo enrollment bersaglio, conservazione del secondo fattore, consumo dopo rilettura, riconciliazione di risposta persa e mancato consumo quando il bersaglio resta presente.
- Verificatore token, Identity Toolkit e inventario fattori sono fixture; nessun import runtime, token reale, chiamata remota o recupero effettivo.
- Gate residuo: il flusso reale deve ottenere un ID token dell'utente con un meccanismo di recupero ufficialmente supportato e senza neutralizzare MFA.

## 09/10/2026 — persistenza CAS grant MFA selettivo

- Firestore `emulators:exec` su `mfa-recovery-grant-store-lab.emulator.test.mjs`: **1/1 superato**.
- Fra due prenotazioni discordanti esiste un solo vincitore; stato `reserved` preservato se l'enrollment bersaglio è ancora presente, passaggio a `consumed` solo dopo assenza e replay duplicato senza nuova mutazione.
- Progetto demo, dati sintetici e teardown completato; nessun token, Auth remoto, callable, deploy o accesso all'app di prova.

## 09/10/2026 — grant breve per recupero MFA selettivo

- `node --test functions/test/mfa-selective-withdraw-lab.test.js functions/test/mfa-recovery-grant-lab.test.js`: **6/6 superati**.
- Il grant lega UID, singolo enrollment e hash del codice; UID/fattore discordante e scadenza falliscono chiusi.
- La finalizzazione rifiuta di consumare il codice finché il fattore bersaglio risulta presente e conserva gli altri enrollment osservati.
- Moduli non importati da `functions/index.js`; stato solo in memoria, token e requester sintetici, nessuna operazione Auth reale.

## 09/10/2026 — candidato MFA selective-withdraw hard-off

- `node --test functions/test/mfa-selective-withdraw-lab.test.js`: **3/3 superati**.
- Verificati: hard-off senza I/O, binding di un solo `mfaEnrollmentId`, assenza del campo `enrolledFactors`, rifiuto di binding mancante e risposta incompleta.
- Controllo statico: nessun import in `functions/index.js`. Requester completamente sintetico; nessuna chiamata Identity Toolkit, token reale, recupero reale o deploy.
- Limite: l'endpoint ufficiale richiede un ID token utente valido; il modo sicuro per ottenerlo nel caso di perdita dell'Authenticator non è ancora implementato né dimostrato.

## 09/10/2026 — regressione completa Functions/security dopo recheck MFA

- `npm run test:functions-security`: lint e controlli sintattici verdi; **409 test totali, 404 superati, 5 skip emulatori attesi, 0 falliti**.
- La suite mirata recovery copre anche il fattore aggiunto fra le due letture: nessuna chiamata `updateUser` e codice di recupero preservato; la suite Firestore emulata recovery resta **2/2**.
- Limite esplicito: il test non crea una primitive CAS/selective-delete assente nell'Admin SDK e non chiude la finestra fra lettura finale e aggiornamento. Nessun recupero MFA reale, deploy o dato di produzione.

## 09/10/2026 — M7 executor documentale composto

- Firestore `emulators:exec` su `purge-bound-effect-document-lab.emulator.test.mjs`: **1/1 superato**.
- Versione target, transizioni begin/outcome, delete, stato composto e ricevuta vengono confermati atomicamente; replay successivo è `duplicate:true` senza ricreare o rileggere il target cancellato.
- Solo namespace demo e dato sintetico; interlock live invariato, nessun effetto Storage.

## 09/10/2026 — M7 persistenza CAS emulata

- Firestore `emulators:exec` su `purge-bound-effect-state-lab.emulator.test.mjs`: **1/1 superato**.
- Due transizioni concorrenti con token identico producono un solo successo; documento persistito con `stateRevision=1`, revisione journal 1 e primo effetto `pending`.
- Emulatori arrestati al termine; nessun executor, Storage o delete. Il warning metadata dell'Admin SDK non ha causato accessi non emulati.

## 09/10/2026 — M7 stato CAS composto

- `node --test experiments/persistent-vault-shell/purge-bound-effect-state.test.mjs experiments/persistent-vault-shell/purge-effect-sequence.test.mjs`: **4/4 superati**.
- Fence, stop slot e journal condividono la revisione; l'esito applicato viene storicizzato prima del riuso. Token obsoleto, storageHash cambiato ed effectId estraneo sono rifiutati.
- Modello puro non ancora persistito; nessun executor o delete live.

## 09/10/2026 — M7 journal della sequenza bound

- `node --test experiments/persistent-vault-shell/purge-bound-effects.test.mjs experiments/persistent-vault-shell/purge-effect-sequence.test.mjs`: **4/4 superati**.
- Applicazione parziale seguita da stop conserva storico e impedisce il passo successivo; `unknown` resta irrisolto e blocca l'avanzamento. Inversione dell'ordine cambia hash e identità degli effetti.
- Modello puro non persistito e non esecutivo; interlock e `destructiveAllowed:false` invariati.

## 09/10/2026 — M7 derivazione effetti bound

- `node --test experiments/persistent-vault-shell/purge-bound-effects.test.mjs experiments/persistent-vault-shell/purge-storage-inventory-lab.test.mjs`: **6/6 superati**.
- La sequenza classifica ogni versione una sola volta, mantiene la generazione a 64 bit, colloca Storage prima del metadato allegato e l'Account per ultimo. Target extra, duplicati o discordanti falliscono chiusi.
- È soltanto un piano immutabile con `destructiveAllowed:false`; executor e journal globale non sono ancora collegati.

## 09/10/2026 — M7 binding transazionale Firestore/Storage

- `node --test experiments/persistent-vault-shell/purge-storage-inventory-lab.test.mjs`: **4/4 superati**.
- La nuova prova rilegge nella stessa transazione Account e metadato allegato con versioni esatte, registra una sola volta `planHash`/`storageHash`, accetta replay identico e rifiuta la modifica concorrente di un nanosecondo.
- Il marker resta `destructiveAllowed:false`; bucket e database sono fixture, nessuna cancellazione.

## 09/10/2026 — M7 inventario Storage generation-bound

- `node --test experiments/persistent-vault-shell/purge-storage-inventory-lab.test.mjs`: **3/3 superati**.
- Verificati ordinamento canonico, generazione a 64 bit mantenuta come stringa, binding dell'hash Firestore e della generazione, rifiuto di oggetto mancante/path duplicato/generazione numerica o malformata.
- È una lettura su bucket finto con `destructiveAllowed:false`; nessuna delete e nessuna attestazione dell'emulatore Storage o GCS remoto.

## 09/10/2026 — M7 baseline del candidato sospeso

- Suite pure composta su 14 file di servizio/modello purge: **65/65 superati**, zero skip.
- Coperti interlock live prima dei dati, binding ricevute, inventario bounded, fence/claim, stop e stati incerti, riconciliazione, target versionati, sequenze documentali e delete Storage generation-pinned senza rete.
- Limite invariato: manca la composizione globale della proposta; l'emulatore Storage non certifica la precondizione DELETE e il purge live resta sospeso.

## 09/10/2026 — M8 regressione composta del nucleo disabilitato

- Suite composta di otto file (`restore-resume-source`, `restore-reference-scope`, `restore-resume-plan`, `restore-stage-lab`, `restore-chunk-lab`, helper allegati e boundary V2): **105/105 superati**, zero skip.
- Esecuzione fuori sandbox soltanto per i server HTTP loopback delle fixture. Nessun servizio remoto o dato reale.
- Il risultato qualifica il nucleo locale mantenuto hard-off; non sostituisce Firestore/Storage end-to-end, browser/bundle, GCS remoto o dispositivi.

## 09/10/2026 — M8 adapter autenticato dietro interlock

- `node --test functions/test/backup-restore-v2-service.test.js functions/test/backup-restore-v2-adapter.test.js`: **4/4 superati**.
- Mancanza di autenticazione, owner valido/coincidente o App Check viene respinta in ordine; con tutti i segnali presenti l'interlock sospeso termina prima dell'executor e il contatore di accessi rimane zero.
- L'adapter è candidato isolato: nessun import/export in `functions/index.js`, endpoint o deploy.

## 09/10/2026 — M8 confine Functions hard-off

- `node --test functions/test/backup-restore-v2-service.test.js functions/test/backup-attachment-stage.test.js`: **20/20 superati**.
- L'interlock V2 resta `true` anche con variabile ambiente o proprietà di bypass sintetiche; il controllo statico rifiuta import o export del candidato in `functions/index.js`. Il runtime distribuito e il precedente `restoreBackupChunk` non sono stati modificati.
- Limite: questo chiude il confine di sicurezza, non l'adapter autenticato, il collaudo end-to-end o l'attivazione.

## 09/10/2026 — M8 cleanup della generazione Storage

- `node --test experiments/persistent-vault-shell/restore-stage-lab.test.mjs`: **34/34 superati** fuori sandbox perché la suite apre un server HTTP esclusivamente su loopback. Il cleanup richiede stage scaduto, non pubblicato, cronologia completa senza tentativi attivi o incerti e marker `cleanupId`; cancella soltanto la generazione registrata e chiude i metadati. Autorizzazione errata: zero delete.
- `node --test functions/test/backup-attachment-stage.test.js`: **18/18 superati**. La nuova prova verifica stringa di generazione a 64 bit, selezione puntuale del file e `ifGenerationMatch` sulla delete; il 404 è idempotente e altri errori restano errori.
- Limite: è ancora un candidato locale non esportato da `functions/index.js`; non prova Storage remoto, runtime distribuito, UI o dispositivi.

## 09/10/2026 — M8 shared, selezione e writer transazionale

- `node --test experiments/persistent-vault-shell/restore-resume-source.test.mjs experiments/persistent-vault-shell/restore-reference-scope.test.mjs experiments/persistent-vault-shell/restore-resume-plan.test.mjs experiments/persistent-vault-shell/restore-chunk-lab.test.mjs`: **49/49 superati**. La nuova prova di selezione rifiuta sottoinsiemi di gruppi condivisi, Account/widget embedded, Azienda/Account e Profilo/Scadenza; restano validi i casi indipendenti già coperti.
- `firebase emulators:exec --config experiments/persistent-vault-shell/firebase.emulators.json --project demo-vault-shell --only firestore "node --test experiments/persistent-vault-shell/restore-account-fence.emulator.test.mjs"`: **15/15 superati**, dati esclusivamente sintetici. Il gruppo Account–dato comune–link–widget viene scritto interamente con una sola ricevuta; collisione, CAS obsoleto e reciprocità spezzata non producono applicazioni parziali. Il fence purge dell'Account partecipa alla stessa transazione.
- Regressione estesa `restore-resume-*`, `restore-stage-*` e `restore-chunk-*`: **138 superati, 4 skip emulatori, zero errori** su 142 casi eseguiti con accesso locale. Governance documentale: **11/11**, 31 MD e 612 collegamenti locali; `git diff --check` senza errori.
- Primo avvio confinato non riuscito perché l'hub locale `127.0.0.1:4455` non diventava raggiungibile; la ripetizione autorizzata con accesso locale ha avviato Firestore e completato la suite. Gli avvisi `MetadataLookupWarning` dell'Admin SDK non hanno causato accessi a servizi non emulati né fallimenti.
- Limite: il reader cifrato continua a rifiutare gli scope condivisi. Questa evidenza certifica il candidato isolato, non runtime distribuito, Storage remoto, UI, dispositivo o produzione.

## M8 — fence e reciprocità shared nel laboratorio piano, 09/10/2026

`restoreReferenceParents` copre ora `sharedVaultData`, `sharedVaultLinks` e widget `shared-reference`. Per link e widget restituisce Account padre, dato comune e documento reciproco; durante un overwrite include anche i riferimenti precedenti. Il nuovo validatore di chunk rifiuta terne parziali o incrociate. `createResumePlanLab` lo esegue in anteprima e creazione piano, senza affidarsi al solo raggruppamento client.

Esiti: scope + sorgente **30/30**; `restore-resume-plan.test.mjs` **8/8**, incluso piano completo privato e negativi senza scrittura del piano. Sintassi dei moduli modificati valida. Sono fixture/fake transazionali locali: commit Firestore emulato, collisioni shared e writer restano il prossimo gate prima di aprire il reader.

## M8 — raggruppamento atomico degli scope condivisi, 09/10/2026

Il pianificatore dei nuovi ripristini raggruppa ora credenziale comune, link, widget `shared-reference` e Account padre nello stesso chunk; per Account aziendali include anche l'Azienda già selezionata. La fusione è transitiva: due credenziali comuni collegate allo stesso Account producono un solo gruppo e una sola copia del padre. Casi negativi sintetici coprono link senza widget, widget senza link, `sharedDataId` o `linkId` incrociati e gruppo da 403 record, rifiutato con `RESUME_DEPENDENCY_GROUP_TOO_LARGE` prima del piano.

Comando: `node --test experiments/persistent-vault-shell/restore-resume-source.test.mjs`. Esito **23/23**. Reader, fence server e writer non sono stati aperti agli scope shared: il nuovo contratto è un prerequisito isolato, non un'attivazione incompleta. Nessun emulatore, rete, dato reale o deploy.

## M8 — confine fail-closed della terna condivisa, 09/10/2026

Il test cifrato della sorgente candidata copre ora separatamente `shared-vault-data`, `shared-vault-data-link` e il widget Account `shared-reference`, oltre a un backup che contiene Account padre e terna completa. La prima esecuzione ha riprodotto un difetto di confine: il widget condiviso era ammesso dal reader e raggiungeva l'anteprima, mentre dato e link erano rifiutati. Il reader ammette ora per gli scope widget soltanto `kind: embedded`; gli altri tipi terminano con `RESUME_SCOPE_NOT_CONNECTED` prima di `submit` o preparazione allegati.

Comando: `node --test experiments/persistent-vault-shell/restore-resume-source.test.mjs`. Esito finale: **21/21**, zero fallimenti; in tutti i quattro casi shared il contatore di chiamate server/staging resta zero. Dati esclusivamente sintetici. Questa prova non abilita il ripristino condiviso: documenta e verifica il confine sicuro necessario prima di introdurre raggruppamento atomico, reciprocità link/widget e selezione dipendenze.

## 08/10/2026 — sette palette confrontabili (locale)

Aggiunte Petrolio (`#0f766e`/`#5eead4`), Lavanda (`#6750a4`/`#c4b5fd`) e Rosa polvere (`#855466`/`#d9a7b8`) alle quattro palette esistenti, con coppie accento chiaro/scuro e superfici derivate. Verificati applicazione anticipata, allowlist di sette valori, sette comandi in Impostazioni e contrasto minimo 4,5:1 degli accenti nuovi nei casi automatici. `test:ui-foundations` 5/5, `test:css`, `test:js-syntax` su 172 moduli, `test:static-references` su 246 file, `test:performance-budget` su 30 pagine e `git diff --check` superati. Puliti commenti CSS obsoleti senza cambiare regole. Confronto visivo chiaro/scuro su PC e telefono ancora da eseguire; nessuna pubblicazione.

## 08/10/2026 — card Account collegate alle palette (locale)

Verificato che le liste Account private e aziendali usino i token `--account-card-bg` e `--account-card-border`, derivati dal colore d’identità selezionato, senza conservare gli sfondi blu fissi precedenti. Le card delle credenziali condivise usano gli stessi token e tonalità derivate per campi e controlli. Restano distinti i colori semantici dei tipi di Account e degli stati funzionali. `test:ui-foundations` 4/4, `test:css`, `test:static-references`, `test:performance-budget` su 30 pagine e `git diff --check` superati. Nessuna pubblicazione eseguita.

## 08/10/2026 — identificazione Account nell’avviso offline

Verificato che il coordinatore globale utilizzi l’operazione in attesa per mostrare il nome dell’Account privato interessato, proponga “Apri Account” e navighi al modulo esatto tramite l’identificativo codificato; “Più tardi” conserva la modifica in coda. La navigazione resta subordinata alla sessione utente corrente. Test mirato 2/2, `test:offline-write-prototype` 209/209, controllo sintattico di 172 moduli, riferimenti statici su 246 file e `git diff --check` superati. Functions, Rules, indici e dati non modificati.

## 08/10/2026 — quattro palette colore (locale)

Verificate le preferenze indipendenti di modalità e colore, il fallback Blu per valori assenti/non validi, l’applicazione anticipata in `theme-init.js`, le varianti chiare/scure dei token e la persistenza limitata a `blue`, `green`, `red`, `sand`. I colori funzionali `success`, `warning`, `error` non sono ridefiniti dalle palette. `npm run test:ui-foundations`, `test:js-syntax`, `test:css`, `test:static-references`, `test:html-purity`, `test:page-shells`, `test:navigation`, `test:lightweight`, `test:performance-budget` e `test:docs` superati; il test documentale è stato ripetuto fuori sandbox perché Windows impediva rename e `git init` nelle cartelle temporanee isolate. Resta da registrare l’esito del collaudo visivo su browser/dispositivo dopo l’eventuale pubblicazione; nessun deploy eseguito in questo checkpoint.

## 08/10/2026 — riconciliazione Account offline 1.2.133

Riprodotto il caso in cui una modifica pendente dell’Account A mostrava una decisione bloccante aprendo l’Account B e ricompariva dopo “Mantieni server” in presenza di più operazioni dello stesso record. Il client ora controlla la coda all’avvio del Vault, al ritorno online, al ritorno visibile e tramite il canale della coda, senza intervallo periodico. Solo il form del record coinvolto propone la decisione; gli altri form restano modificabili. Lo scarto per mantenere il server opera sotto lease su tutte le operazioni del record e verifica zero residui. `npm run test:offline-write-prototype`: 208/208; controlli mirati precedenti 128/128, data-access94/94, navigation154/154, riferimenti statici246 file, sintassi172 moduli, HTML/CSS/UI/page-shell verdi. Nessun dato reale letto o modificato; Functions, Rules e indici invariati. Resta distinto il collaudo manuale dopo pubblicazione.

## 06/10/2026 — avvio manuale anteprima senza seed

BuildEmulator accetta preview:true con artefatti separati dist/manual-preview. Nuovo manual-preview.mjs controlla porte, riusa solo account sintetici a/b@example.invalid già esistenti, non applica Rules e non crea dati; bridge attivo soltanto sul loopback4188 con allowlist UID. node --check sui due file passa. Esecuzione reale si arresta prima della build per servizi8085/9099/9199 mancanti: nessun avvio riuscito attestato, nessun browser aperto. Compilazione completa e funzionamento con banco conservato ancora da verificare; precedente esbuild Access denied non aggirato cambiando permessi.

## 06/10/2026 — ripristino Azienda nel candidato

Estratti collegamenti Account da emails (slot ed extra) e phoneAccountLinks, con fence su vecchi e nuovi riferimenti. Commit SDK sintetico rifiuta Azienda con Account collegato assente senza scritture; ammette Azienda+Account nello stesso chunk e verifica rilettura. Suite SDK14/14, demo-vault-shell8085 arrestato. Regressione pura141/141; successivo test source raggruppa Azienda+Account selezionati e rifiuta gruppo oltre400 record (source21/21). Non è verifica di tutti i riferimenti inversi o del protocollo di cancellazione3B; scope shared/widget profilo/QR e collaudo integrato ancora aperti. Nessun deploy.

## 06/10/2026 — contatti e configurazioni nel commit candidato

Reader cifrato ammette contact, conservando active:false nella fixture sintetica; scope owner-local senza riferimenti Account. Commit demo-vault-shell8085 ripristina contatto e profileLabels nello stesso blocco, rilettura esatta e replay duplicate verificati. Suite SDK13/13 senza skip, emulatore arrestato; regressione restore pura140/140. Nessuna concessione/invio reale o collaudo rubrica UI; altri scope e backup completo ancora aperti.

## 06/10/2026 — configurazioni applicative note nel reader M8

Whitelist condivisa nel significato fra reader e controllo scope: profileLabels, deadlineConfig, deadlineConfigDocuments, generalConfig, corrispondenti ai writer applicativi. Security non ammesso, selezioni QR con riferimenti e nomi sconosciuti restano bloccati. Suite restore*.test.mjs esclusi emulator/http140/140, zero skip; reader cifrato delle quattro configurazioni verificato nella suite source successiva. Nessuna prova SDK specifica delle configurazioni o browser in questo checkpoint; nessuna certificazione del backup completo.

## 06/10/2026 — coppie profilo/scadenza atomiche nel candidato

Validatore collegato a preview, creazione piano e fence del commit; coppie esplicite selezionate devono essere complete nello stesso chunk. Il commit controlla anche i documenti correnti selezionati, per non abbandonare una metà preesistente. Chunking tiene profilo e scadenze collegate insieme anche dopo400 Account; gruppi troppo grandi restano rifiutati. Prova Firestore demo-vault-shell8085: coppia incompleta non scrive target, coppia completa crea entrambi con scadenza privata, retry restituisce ricevuta duplicate. Suite SDK12/12 senza skip; scope/source/view/pair40/40. Emulatore arrestato. Riferimenti dedotti o dati legacy ambigui non convertiti, browser/build e altri scope M8 restano separati; nessun deploy.

## 06/10/2026 — scadenze autonome nel candidato

Reader ammette deadline, scope/fence rifiutano sourceRef sia nel backup sia nella versione corrente; anteprima controlla anche quest'ultima, senza permettere di scollegare implicitamente un documento profilo. Test SDK demo-vault-shell8085: scadenza assente creata senza destinatari; overwrite mantiene destinatari correnti e notif_frequency21 invece dei valori del backup. Suite SDK11/11 senza skip, emulatore arrestato. Scope/source/view36/36; view14/14 ripetuti dopo avviso fisso sui destinatari e limite delle coppie profilo/scadenza. Nessun invio reale, nessun deploy, coppie ancora non collegate e recupero completo non attestato.

## 06/10/2026 — autorità destinatari scadenze durante restore

Decisione Diego confermata: destinatari/permessi/impostazioni di invio correnti mantenuti, scadenza assente privata. Proiezione preserveRestoreAuthority per percorso scadenza esatto elimina dal backup recipients, emails, email1/email2 e campi notif_, riprendendoli soltanto dal documento corrente. Assenza del documento produce destinatari vuoti; nessun fallback alle email legacy del backup. Test sintetico corrente/assente/corrente senza campi; service/authority19/19. Non collaudo invii o condivisioni reali, nessun deploy; raccordo candidato completo ancora aperto.

## 06/10/2026 — preparazione coppie profilo/scadenza M8

Nuovo modulo puro `restore-profile-deadline-pair`: verifica riferimenti reciproci espliciti, rifiuta coppie mancanti/ambigue/di altro proprietario e non deduce collegamenti da descrizioni/date. Test3/3 con dati sintetici, input non mutato. Non collegato a preview/commit: nessuna nuova copertura runtime attestata. Decisione sul mantenimento dei destinatari/permessi correnti richiesta, senza assumere risposta o riattivare condivisioni dal backup.

## 06/10/2026 — raccordo profilo M8 con Account collegati

Reader ammette profile, preview accetta il percorso radice del proprietario. Estrazione dei collegamenti da contatti/documenti/utenze indirizzi; unione vecchi/nuovi Account nella fence. Preview e commit verificano esistenza dei nuovi Account; nessuna deduzione di riferimenti scadenza, ancora rifiutati. Firestore demo-vault-shell8085, UID sintetico nuovo: Account mancante rifiuta il commit senza modificare il profilo; Account presente consente ripristino mantenendo settings_biometric corrente. Suite SDK10/10 senza skip, emulatore arrestato. Source/view/scope35/35 dopo aggiornamento del precedente test che considerava profile non supportato. Nessuna prova browser/build o recupero completo; company/settings generici e altri scope restano esclusi.

## 06/10/2026 — preferenza biometrica nel restore del profilo

`preserveRestoreAuthority` applica al percorso esatto users/uid la conservazione di settings_biometric dalla versione transazionale corrente; se assente, il campo del backup non viene ripristinato. Regressione sintetica con valore corrente true/false/assente e confronto anteprima invariato; input non mutato. Service/authority18/18. Non verifica biometria hardware o app distribuita. Scope profile candidato ancora bloccato: contiene collegamenti Account e scadenze che richiedono raccordo, non si allarga semplicemente la whitelist.

## 06/10/2026 — esclusione impostazioni sicurezza nel restore candidato

Decisione Diego: mantenere sicurezza attuale. `backup-restore-service` rifiuta settings/security prima delle transazioni, in preview/apply e con conferma overwrite; callable restituisce spiegazione fissa. Reader candidato verifica catena e footer contando anche il documento escluso, non lo invia al server e restituisce contatore per avviso UI. Prova con backup cifrato sintetico misto: solo Account inviato, esclusione contata. Server service/authority17/17; source/view33/33, zero skip/fail. La suite UI preesistente passa, ma l'avviso specifico non ancora verificato in browser. Ambiti profile e altri non collegati restano bloccati; campi sicurezza sul profilo da trattare separatamente. Nessun deploy o chiusura M8.

06/10/2026 — deroga Rules esplicita di Diego: corretto grant ricorsivo Azienda separando create da read/update/delete; create nel ramo accounts richiede existsAfter del padre. Test dedicato SDK: assenza padre e discendente rifiutati, batch padre+Account (figlio scritto per primo) consentito, padre esistente/edit/lettura consentiti, estraneo e delete Azienda singolo/batch negati, nuovo Account dopo rimozione padre Admin negato. Accesso/modifica/pulizia di orfani già esistenti preservati intenzionalmente, ricreazione vietata. Suite Rules composta74/74 senza skip su emulatore temporaneo; include caratterizzazioni pregresse, non tutti difetti risolti. Test storico company-parent-boundary aggiornato all'esito corretto, non rieseguito su8085 in questo ciclo. Nessun deploy/storage.rules/manifest, interlock purge invariato; Admin bypassa Rules e protocollo3B non dichiarato completo.

06/10/2026 — browser IAB, laboratorio TOTP isolato su porta loopback effimera: dialog/renderer estratti dal sorgente corrente, encoder vendor reale, Auth e helper DOM simulati, nessun import Firebase. Osservate apertura finestra, logout simulato con rimozione e messaggio Sessione cambiata, riapertura e Annulla con esito Annullato. Skill computer-use usata per interazione UI; nessuna credenziale/enrollment reale, banco originario intatto. Server e scheda temporanei chiusi. Non build candidata, callback SDK Auth reale, scansione o verifica Edge/dispositivi; gate aperti.

06/10/2026 — chiusura finestra TOTP collegata all'osservatore Auth: cambio utente durante attesa rigetta, esegue cleanup e deregistra observer; completamento QR tardivo non ridisegna. Fixture enrollment8/8, include logout prima del caricamento completato; nessun SDK Auth reale o browser attestato. Completa il limite UI annotato nel checkpoint precedente, non annulla enrollment già inviato o risolve recupero MFA selettivo.

06/10/2026 — enrollment TOTP, cambio utente fra attese: regressione inizialmente fallita; aggiunti controlli identità oggetto Auth corrente prima e dopo getSession/generateSecret/dialog/enroll. Fixture prova sostituzione anche con stesso UID: prima dell'invio zero enrollment; dopo invio nessun refresh vecchio utente e messaggio di verifica, senza promessa di rollback. Caso invariato resta positivo. Suite enrollment7/7 e composta recupero18/18; soli adapter sintetici. Non annulla richiesta già inviata né chiude subito finestra al logout durante attesa: quest'ultimo limite resta distinto. Nessun Auth reale, deploy o gate chiuso.

06/10/2026 — QR TOTP verificato oltre lo stub: caricato vendor qrcode.min.js invariato in Node con DOM minimo, generata matrice per due URI sintetici (etichetta semplice e percent-encoded), decodificata con ZXing già installato. Test conferma testo identico byte-per-testo e title originale, senza padding. Suite enrollment6/6. Nessuna dipendenza installata o rete; prova della matrice, non del canvas/pixel, scansione Authenticator, dispositivo o enrollment reale.

06/10/2026 — cleanup finestra TOTP esteso: prima della rimozione vengono svuotati input codice, testo chiave manuale, figli QR e attributo title; riferimenti locali URI/chiave sostituiti con stringa vuota. Percorsi errore/successo verificati nella fixture5/5, annullamento mantiene protezione dai callback tardivi. Non garantisce cancellazione delle stringhe immutabili, copie SDK, pixel o heap del browser; nessun enrollment reale. Nessuna nuova semantica MFA o gate chiuso.

06/10/2026 — audit renderer QR reale: modalità condivisa aggiungeva150 spazi ai testi oltre50 caratteri e assorbiva errori, quindi non garantiva URI TOTP esatto né rigetto promesso dalla sola fixture precedente. Aggiunta opzione exactText usata dall'enrollment: nessun padding/fallback, errore propagato senza log dell'encoder, errore esplicito con libreria assente. Cinque test sintetici verificano testo identico, correzione livello0 preservata, singola chiamata/no log e finestra; vCard conserva modalità precedente. Non prova scansione con Authenticator/dispositivo o build distribuita.

06/10/2026 — finestra enrollment TOTP: eliminato esecutore async della Promise che non propagava il rigetto del caricamento/render QR. Errore ora rimuove la finestra e rigetta; annullamento durante caricamento impedisce rendering tardivo e assorbe errore tardivo, senza enrollment. Fixture DOM sintetica3/3: errori load/render, annullamento con successo/errore tardivo e codice valido/invalidato. Suite composta con recupero14/14. Difetto individuato nel codice, non riproduzione browser; nessuna build/dispositivo o cancellazione garantita delle stringhe in memoria attestata. Non modifica protocollo MFA selettivo.

06/10/2026 — limite recupero MFA verificato con Firestore locale e handler corrente estratto: otto richieste concorrenti sul medesimo identificatore sintetico, cinque sole chiamate al primo fattore simulato e tre resource-exhausted; contatore persistito6. Richiesta ulteriore conserva finestra/scadenza; record poi reso NaN soltanto nella fixture viene rifiutato senza mutare updateTime o chiamare Auth. Test SDK1/1 senza skip. Prima esecuzione fallita per Promise cross-realm della fixture VM, corretta usando compileFunction nello stesso realm dello SDK; non difetto applicativo. Nessun Auth reale/produzione, emulatori arrestati; non attesta rate limit globale fra IP differenti o risolve MFA selettivo.

06/10/2026 — completato confine callable del contatore recupero: stato non valido restituisce failed-precondition con spiegazione italiana fissa e nessun codice consumato, senza esporre codice interno. Rimossi fallback falsy sui valori già validati prima della persistenza. Recovery-security11/11 verifica risposta e zero effetti nel caso corrotto; prova aggiuntiva handler con persistenza simulata conferma cinque richieste al primo fattore, sesta bloccata e tre ulteriori richieste senza Auth né azzeramento contatore/finestra/scadenza. Non è collaudo browser/Auth reale o concorrenza Firestore né soluzione del recupero MFA selettivo.

06/10/2026 — corretto rate limiter recupero MFA: regressione inizialmente fallita su contatori/date malformati; rimossa conversione Number e validati interi non negativi/overflow. Stato esistente incompleto rifiutato, documento assente resta primo tentativo; blocco attivo restituisce anche contatore e inizio finestra, evitando loro azzeramento nel caller. Suite recovery-security10/10: confini finestra, blocco ripetuto e handler reale estratto con dipendenze simulate confermano zero scritture/Auth/consumo codici sullo stato corrotto. Nessuna rete o migrazione dei record, nessun deploy. Caratterizzazione consumo codice prima di errore Auth resta verde ma difetto aperto; non risolve MFA selettivo.

06/10/2026 — executor Storage, negativi prima dell'effetto esterno verificati senza rete: commit begin fallito lascia unstarted; conferma commit persa lascia pending; endpoint o retry SDK cambiati durante begin producono unknown senza chiamare file/delete. Ripetizione del vecchio token negli stati pending/unknown rifiutata anche dopo ripristino configurazione. Modulo3/3, quattro nuove condizioni simulate; nessuna nuova correzione del runtime o attestazione Storage reale. Restano precondizioni remote e riconciliazione; interlock invariato.

06/10/2026 — sequenza purge Firestore locale7/7 senza skip: aggiunta contesa di due invocazioni Storage con stesso token, adapter esterno simulato trattenuto dopo begin. Stato pending persistito prima dell'effetto, seconda invocazione rifiutata e una sola chiamata; stop salvato durante l'attesa conservato dalla registrazione finale applied. Migliorata attesa della fixture per propagare subito errori prima dell'ammissione. Nessun effetto Storage reale in questa prova, nessuna certificazione della precondizione DELETE o riconciliazione unknown; negativo Storage precedente resta aperto. Emulatori arrestati, interlock globale true.

06/10/2026 — regressione composta della sorgente corrente: tutti i test puri restore/purge del laboratorio172/172, helper staging17/17, senza skip. Include caratterizzazioni di limiti noti: non equivale a difetti tutti risolti. Esclusi deliberatamente i test emulatori, compreso il negativo Storage già documentato. Nessuna estensione scope, modifica Rules, cancellazione o sblocco interlock.

06/10/2026 — audit statico estensione M8: export include settings; security-manager scrive verifier in users/{uid}/settings/security; restorePath ammette settings generico. preserveRestoreAuthority tutela soltanto ACL Account e restituisce altri ambiti invariati. Nessun test con dati reali e nessuna nuova abilitazione: allargare soltanto whitelist del reader non risolve il trattamento delle impostazioni di sicurezza. Scelta richiesta in INCARICO_CORRENTE, non risposta presunta.

06/10/2026 — confronto export/reader M8: collectRecords emette profile sempre e ulteriori settings/company/deadline/contact/profile-widget/shared-vault-data/shared-vault-data-link; readResumeBackup candidato accetta solo Account privati/aziendali, loro allegati/widget e byte allegati opt-in. Test cifrato sintetico profile+Account: rifiuto RESUME_SCOPE_NOT_CONNECTED prima di submit/staging (zero chiamate),1/1. È caratterizzazione dell’incompletezza, non soluzione: vietato descrivere il candidato come ripristino completo dei backup ordinari o rimuovere implicitamente i record esclusi.

06/10/2026 — audit M8 scope: parser rifiuta esplicitamente ambiti esclusi, non li ignora. Vista candidata non spiegava tale errore e il catch staging nascondeva il codice generazione: aggiunti messaggi distinti, senza dettagli interni o promessa di rollback. Test DOM14/14 include scope non collegato e codice generazione con messaggio interno arbitrario non esposto. Nessun supporto shared implementato e nessun browser/bundle attestato.

06/10/2026 — benchmark offline KDF aggiornato sulla sorgente dopo cleanup: SHA25627a1dbbc6c913a4c26711d78187f025fe8f5a2f904f5ced00bf6e64345332e9f, Node24.12 Windows, PBKDF2-SHA256600000 invariato. Sette campioni dopo warm-up: mediane wrap64,38ms, unwrap63,24ms, verifier62,65ms; password errata62,37ms e ciphertext alterato62,84ms correttamente rifiutati. Solo dati sintetici, nessuna scrittura runtime. Non browser/Edge/iPhone, audit indipendente o migrazione; nessun gate chiuso.

06/10/2026 — isolamento executor Storage: aggiunta verifica apiEndpoint/baseUrl effettivi sul client, con solo loopback9199 ammesso, ripetuta prima dell’effetto. Variabili ambiente da sole non provano la configurazione di un client già costruito. Fixture con ciascun endpoint esterno rifiutata prima di transazioni/chiamate; modulo2/2 senza rete. Ricerca import: executor referenziato soltanto dai suoi test. Non è verifica runtime/remote e non chiude gate purge.

06/10/2026 — regressione integrata dopo interceptor generation e messaggi client: reference-bridge-http.emulator.test.mjs1/1 su demo-vault-shell; restore-stage-lab.emulator.test.mjs2/2 su demo-m8-stage. Verificate pubblicazione concorrente/ripresa ricostruita, preparazione cleanup senza Storage e percorsi HTTP esistenti; emulatori arrestati regolarmente. Ricerca sorgenti generation-pinned limitata a functions/laboratorio non trova altri accessi diretti oltre helper e nuovo executor. Interlock globale confermato true. Non attesta precondizioni DELETE dell’emulatore, ambiente distribuito o UI browser.

06/10/2026 — corretto confine retry dell’executor Storage sperimentale: prima l’assenza di retry riguardava soltanto il codice chiamante, non le opzioni SDK. Ora client senza autoRetry=false viene rifiutato prima di transazioni/effetti; controllo ripetuto dopo begin. Fixture prova rifiuto con zero transazioni/chiamate e successivi scenari con retry disabilitato; suite purge40/40. Test emulatori configurato con client dedicato, non rieseguito: difetto DELETE generazioni dell’emulatore resta aperto. Nessuna modifica client globale, dipendenze o permessi.

06/10/2026 — generationFile: usato interceptor per-file già presente nello SDK installato, senza patch a dipendenze o mutazione del valore interno generation. Query GET media ripristina la stringa esatta9007199254740993; richieste non GET rifiutate su tale adattamento. Test intercetta makeAuthenticatedRequest prima della rete, verifica alt=media/generation esatta e interrompe lo stream con errore sintetico. Adapter privo di interceptor continua a fallire chiuso. Helper17/17, restore130/130. Prova limitata alla costruzione richiesta: non attesta servizio remoto né supera il limite DELETE dell’emulatore.

06/10/2026 — blocco generazione esteso all’upload: server409/codice fisso e no-store, client messaggio italiano di esito non confermato. Test client verifica una sola richiesta, cancellazione risposta e azzeramento sola copia trasporto; test server non espone errore interno né aggiunge scritture/save. Restore129/129 e successiva regressione server mirata1/1. Nessun collaudo UI o risoluzione del limite SDK dichiarati.

06/10/2026 — download laboratorio/client: GENERATION_UNSUPPORTED produce409 con codice fisso, non messaggio interno. Client genera spiegazione italiana del blocco, cancella corpo senza leggere byte e non tenta altre versioni. Due regressioni aggiunte, suite restore128/128; nessuna verifica UI/browser o chiusura del limite SDK.

06/10/2026 — audit letture Storage: SDK converte generation in Number e createReadStream riusa il valore convertito. Test sullo SDK installato senza rete con9007199254740993 riproduce conversione; generationFile ora rifiuta discrepanza prima di download, usato da verifica staging e lettura laboratorio. Generazione123 accettata. Helper17/17 e restore126/126; adapter simulati non certificano il trasporto. Supporto esatto uint64 non completato; nessuna modifica dipendenze, Rules o interlock.

06/10/2026 — verifica costruzione richiesta nello SDK Storage installato, intercettata prima della rete: riprodotto arrotondamento di options.generation nel costruttore file. Nuovo executor passa generation anche in delete insieme a ifGenerationMatch; query DELETE verificata con entrambe le stringhe esatte. Due test del modulo superati, senza chiamate esterne. Correzione limitata al nuovo executor: altre letture generation-pinned richiedono audit separato. Non converte in verde la prova negativa sull’emulatore.

06/10/2026 — prova SDK Firestore/Storage demo-purge-fence con oggetti sintetici nuovi: cancellazione semplice riuscita; prova generazione sostituita FALLITA (applied invece di unknown). Ispezione node_modules/firebase-tools/lib/emulator/storage/apis/gcloud.js: DELETE inoltra a deleteObject solo bucketId/decodedObjectId, senza generation o ifGenerationMatch; files.js cancella il path corrente. Limite concreto dell’emulatore installato, non prova di sicurezza o bug del servizio remoto. Nessun dato reale/banco originario coinvolto. Config locale dedicata firebase.purge-storage-local.json, Rules immutate; test negativo mantenuto. Vietato considerare questa infrastruttura sufficiente per validare GC condizionale; nessuna promozione executor o sblocco interlock.

06/10/2026 — nuovo purge-sequence-storage-lab, vincolato a progetto demo e host emulatori locali, senza export runtime. Adapter simulato prova cinque scenari: successo, stop durante effetto,404, errore trasporto, errore registrazione finale. Generazione90071992547409931234 mantenuta stringa in selezione/precondizione; begin salvato prima della chiamata;404/trasporto restano unknown, registrazione fallita lascia pending; replay del token non richiama delete. Nessun oggetto reale cancellato. Non costituisce verifica SDK, protocollo completo, riconciliazione o permesso di sbloccare purge.

06/10/2026 — sequenza purge documentale: il metodo accettava target kind object fino all’avvio della transazione. Test riprodotto con store sintetico; introdotto rifiuto prima di qualsiasi lettura/ricevuta. Non dimostra una cancellazione errata precedente: corregge il confine di validazione dell’executor documentale. Nessuna modifica a Rules, manifest o interlock; executor Storage ancora assente.

06/10/2026 — cleanup laboratorio: test inizialmente fallito perché la preparazione accettava expiresAt assente. Aggiunta corrispondenza createdAt/expiresAt tra descrittore e piano e ricontrollo scadenza corrente. Tre casi (scadenza assente, futura e creazione incoerente) ora rifiutati senza scritture e con oggetto conservato; restore126/126. Nel checkpoint precedente verificata anche integrazione HTTP/Auth/Storage locale1/1. Nessuna attivazione della cancellazione fisica.

06/10/2026 — laboratorio restore: riprodotto retry upload su byte esistenti con preparazione cleanup durante la lettura metadata e successivo arretramento del clock. Prima restituiva 200 nonostante marker persistente; aggiunto controllo nella transazione finale, ora 409 LAB_CLEANUP_BLOCKED. Fixture metadata asincrona; nessuna ulteriore scrittura dopo preparazione, un solo save, oggetto conservato. Suite restore pura125/125. Non dimostra cancellazione fisica, comportamento distribuito o chiusura dei quattro blocchi.

06/10/2026 — preparazione cleanup upload interna demo aggiunta: transazione ammette solo piano scaduto revisione2, tracciato dall'origine, con tentativi tutti verified della stessa generazione, descrittore pending e nessuna pubblicazione. Salva marker prepared/generazione e ID; retry idempotente, nessuna chiamata Storage e cleanupAllowed:false. Claim/upload/publish bloccati dal marker anche con clock arretrato. Unit negativi live/published/legacy/unknown/generazione incoerente, restore124/124; SDK2/2 verifica rifiuto active, due preparazioni concorrenti con unico ID e updateTime invariato al retry, oltre alla regressione precedente. Corretto un import errato nella nuova fixture prima della prova riuscita. Emulatori arrestati. Non executor, pulizia fisica, nuova retention o chiusura dei quattro blocchi.

06/10/2026 — lettura registro estesa ai tentativi uncertain/journal-failure dopo retry e scadenza: inspectUploadActivity conserva rispettivamente unknown/active invece di contare verified; cleanupAllowed resta false anche dopo sette giorni. Laboratorio28/28. Nessuna nuova correzione o riconciliazione automatica degli esiti incerti.

06/10/2026 — verifica SDK del registro durante save: lettura Firestore eseguita prima di memorizzare i byte nello Storage simulato osserva un tentativo active, zero verified e cleanupAllowed:false; dopo l'upload osserva verified. Suite Firestore1/1, emulatori arrestati. Prova dell'ordine di persistenza, non garanzia GCS distribuita né implementazione della cancellazione.

06/10/2026 — storico upload: nuovi piani marcati uploadTrackingVersion1 dalla creazione con contatore0; claim/upload dei piani legacy non aggiungono retroattivamente questa provenienza. Aggiunta inspectUploadActivity interna read-only transazionale: confronta contatore e record owner/stage-bound, valida stati/generazioni/date, limite100 tentativi con rifiuto overflow. Restituisce sempre cleanupAllowed:false, anche scaduto e tutto verified. Restore123/123 include storia mancante/corrotta, legacy e overflow senza scritture; SDK Firestore1/1 conferma lettura del registro e compatibilità con pubblicazione/commit concorrenti. Storage simulato in questa prova SDK; emulatori arrestati. Nessun executor GC, endpoint nuovo, migrazione o chiusura dei quattro blocchi.

06/10/2026 — registro upload: corretto fallback che trattava uploadActivityRevision:null come campo assente e iniziava una nuova sequenza. Regressione prima rossa poi verde; null, negativo, frazionario, stringa e contatore esaurito rifiutati senza save o scritture. Restore121/121 senza skip. Campo assente mantiene compatibilità con i piani precedenti, senza attestarne la cronologia completa; nessuna cancellazione o chiusura cleanup.

06/10/2026 — helper staging16/16: nuova prova con barriera asincrona conferma zero save/download mentre la registrazione upload è pendente, zero save al fallimento della registrazione e nuovo controllo scadenza dopo la sua attesa; positivo con una sola save e buffer chiamante preservato. Verifica del raccordo introdotto, non cleanup Storage implementato né chiusura dei quattro blocchi.

06/10/2026 — prerequisito cleanup staging collegato al laboratorio: prima di una save effettiva, transazione crea labRestoreUploadActivity owner/stage-bound in stato active e incrementa uploadActivityRevision dell'operazione. Esito helper verificato registra verified/generazione; errore registra unknown, mancata chiusura del registro conserva active. Retry su byte esistenti non riscrive né considera risolti tentativi precedenti. Test iniettati successo/perdita risposta/fallimento registro nel laboratorio25/25; restore120/120; HTTP/Auth/Firestore/Storage1/1 verifica persistenza reale di registro e revisione, emulatori arrestati. Nessuna lease/scadenza automatica dei tentativi, cancellazione, worker GC o nuova retention adottata. Non attesta assenza di upload dei writer precedenti, né risolve gli esiti incerti: cleanup e quattro blocchi restano aperti, build/browser non attestati.

06/10/2026 — M8 riparazione selettiva allegato: prova composta dal backup cifrato via sorgente/HTTP/Auth/Firestore/Storage con metadato figlio uguale al backup (preview unchanged), ma oggetto originario assente verificato in Storage. Selezione esplicita del solo allegato, staging, piano e resume completati; download dei byte dal nuovo stage identico al backup, updateTime Account padre invariato, vecchio oggetto ancora assente. Suite HTTP1/1 senza skip, emulatori temporanei arrestati. Nessuna modifica applicativa necessaria: il percorso di selezione esistente copre questo caso. Non rilevamento automatico dei byte mancanti, prova browser o copertura di tutti gli scope; cleanup e quattro blocchi restano aperti.

06/10/2026 — verifica aggiuntiva helper staging15/15: rifiuto della guardia pre-upload (incluso codice412) non viene confuso con contesa Storage; nessuna save/download e buffer del chiamante preservato. Nessuna nuova correzione o implementazione GC. Riesame sorgenti: manca ancora coordinamento persistente degli upload in corso prima di autorizzare una pulizia; il solo controllo di scadenza non lo sostituisce.

06/10/2026 — regressione HTTP/Auth/Firestore/Storage dopo guardia pre-upload superata1/1 senza skip, emulatori temporanei arrestati. Aggiunto controllo positivo a scadenza meno1ms: upload e pubblicazione validi. Caratterizzazione separata upload già in volo: scadenza dopo save lascia un oggetto, operazione revisione1 e descrittore pending, nessuna pubblicazione; reclaim e retry rifiutati senza seconda save. Laboratorio24/24. Il test verde documenta il residuo di cleanup, non la sua soluzione: serve coordinamento delle operazioni in volo prima di GC sicuro. Nessun worker/cancellazione Storage o chiusura dei quattro blocchi.

06/10/2026 — staging M8: riprodotto upload iniziato dopo scadenza maturata durante getMetadata Storage (risposta409 ma una save già eseguita). Il helper accetta ora una guardia sincrona del chiamante immediatamente prima di save; il laboratorio controlla la scadenza originale del piano dopo le attese della preparazione. Regressione rossa poi verde: zero save/oggetti e revisione1 conservata; helper+laboratorio37/37, gruppo restore118/118 senza skip. Nessuna nuova retention o eliminazione: upload già in volo, coordinamento GC, Storage distribuito e build/browser rimangono non attestati. Interlock e Rules invariati, quattro blocchi aperti.

06/10/2026 — stop/ripresa purge: aggiunta matrice pura con riapertura JSON per ciascuno dei tre target, pending/unknown e risoluzioni applied/not-applied; stop e storico restano conservati, token precedente e ulteriori effetti rifiutati. Pure purge37/37. Nuova prova SDK: assenza del target senza ricevuta non risolve pending/unknown e non autorizza ripresa riferimento su altro target intatto; updateTime stato invariato e riferimento assente. Suite sequenza documenti6/6 senza skip su demo-purge-fence temporaneo, arrestato al termine. Solo copertura aggiuntiva del laboratorio, nessun difetto nuovo corretto, nessuna prova Storage o integrazione distruttiva globale. Quattro blocchi aperti.

06/10/2026 — enterExclusivePurge: test inizialmente rosso per expected senza previewHash o con hash diverso da prepared; confronto aggiunto preservando le preparazioni del modello base prive di hash. Pure purge36/36 e SDK inventario7/7: le transazioni con token alterato non cambiano updateTime della barriera, token corretto e contesa annullamento/claim ancora funzionanti. Solo modello/raccordo interno demo, nessun endpoint distruttivo attivato, nessuna attestazione della futura sequenza Storage. Emulatori arrestati; quattro blocchi aperti.

06/10/2026 — company-parent-boundary.emulator.test.mjs, caratterizzazione delle firestore.rules correnti e non modificate: owner sintetico crea un Account mentre il documento Azienda padre è assente, assenza verificata prima/dopo. SDK1/1 significa comportamento rischioso riprodotto, non gate 3B superato. Unico documento sintetico creato eliminato nel teardown, nessun clearFirestore/reseed; emulatori temporanei arrestati. Chiusura sicura richiede raccordo dei writer e protezione del confine client, non basta aggiungere delete server con query vuota. Richiesta autorizzazione alle sole modifiche Rules locali pendente; nessun deploy o variazione al file.

06/10/2026 — regressione composta Firestore dopo cambio validate della fence: account-write-fence-lab, reference-callable-db-lab, banking-edit-fence e restore-account-fence,14/14 senza skip. Coperti writer note/standard/link Profilo, modifica bancaria, handler widget/shared-link e restore multipagina/legacy, inclusi rifiuti esclusivi e contesa claim. Esecuzione su demo-vault-shell temporaneo con UID sintetici separati, arresto confermato. Nessuna nuova modifica applicativa in questo checkpoint; non prova browser, completo inventario writer, GC o protocollo purge globale. Interlock invariato.

06/10/2026 — verifica annullamento/writer: tre ordini SDK (writer-prima, annullamento-prima, concorrente) conservano aggiornamento Account e invalidano preparazione precedente; successiva preparazione protetta dal token vecchio anche riusando operationId. Prova di copertura, non nuovo difetto corretto. Separatamente, regressione pura inizialmente rossa: invalidatePurgeForWrite/preparePurgeFence ignoravano campi fence sconosciuti; validazione ora rifiuta metadati non riconosciuti e previewHash non valido/fuori fase. Pure purge35/35 e SDK7/7; tre fixture di stato interno non riconosciuto conservano updateTime di Account e barriera. Nessuna cancellazione, endpoint o nuova autorizzazione distruttiva; emulatori terminati. Quattro blocchi aperti.

06/10/2026 — cancelPreparedPurge/cancelPrepared, nuova capacità interna demo per annullare soltanto una preparazione prima degli effetti. Pure purge34/34; SDK inventario5/5 con quattro scenari nuovi: annullamento e nuova preparazione, claim già acquisito, contesa annullamento/claim, storico con esito unknown. Hash errato e token vecchio respinti senza riscrivere lo stato; nella contesa una sola transazione riesce, revisione incrementata una sola volta. updateTime dell'Account invariato in tutti i casi, nessuna chiamata Storage o delete. Dopo annullamento il vecchio claim è invalido; retry non viene falsamente dichiarato idempotente senza ricevuta. Emulatori temporanei terminati. Nessun endpoint/UI/protocollo distruttivo attivato; stop/ripresa post-effetti e copertura globale restano aperti.

06/10/2026 — M8 controllo bancario alla creazione: regressione inizialmente rossa per widget con bankId mancante/duplicato; verifica usa l'Account selezionato nello stesso blocco/precedente oppure quello letto transazionalmente. Sei combinazioni unit comprendono negativi e positivi, Account selezionato/esistente; anteprima non bloccata prima della scelta. Restore117/117 senza skip, SDK9/9 conserva rifiuto commit su piano legacy e verifica nuovo rifiuto create senza piano salvato; HTTP1/1 controlla codice fisso RESUME_WIDGET_BANK_MISSING e numero piani invariato. DOM verifica messaggio senza promessa di rollback. Emulatori temporanei arrestati; non collaudo browser, GC o chiusura globale.

06/10/2026 — riesame documentale MFA, nessun test di recupero dichiarato superato: [withdraw](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaEnrollment/withdraw) richiede ID token e ID del fattore; [signInWithCustomToken](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signInWithCustomToken) supporta anche creazione utente e non documenta nel corpo una precondizione existing-only. Non individuata qui una soluzione alla ricreazione già osservata nel probe locale; nessun cambio configurazione, token reale o chiamata Auth remota. Il gate selettivo/concorrenza rimane aperto.

06/10/2026 — anteprima e creazione M8: regressione inizialmente rossa, piano salvato anche con allegato senza Account padre. Verifica transazionale comune per allegati/widget accetta padre selezionato nello stesso blocco o precedente, altrimenti richiede padre presente nel laboratorio; il commit non perde le proprie guardie. Restore115/115, SDK9/9 include rifiuto create privato/azienda senza piano salvato e conservazione dei negativi commit su piani legacy costruiti esplicitamente. HTTP Auth/Firestore/Storage1/1 verifica codici fissi per preview/create allegato/widget e numero piani invariato; prima esecuzione fallita per fixture preview con campo stageCommands non ammesso, corretta la fixture senza allargare il contratto. DOM verifica spiegazione e creazione disabilitata. Non prova browser, GC Storage, scope condivisi o chiusura globale.

06/10/2026 — restore-stage-lab: due regressioni inizialmente rosse, transazione claim ritardata fino a scadenza accettata e upload completato dopo scadenza che ricreava descrittore e salvava bytes prima del rifiuto finale. Controlli temporali dopo le attese impediscono rispettivamente preparazione e salvataggio; ulteriore prova verifica scadenza del descrittore uguale a quella del piano dopo preparazione interrotta. Restore113/113 senza skip, fixture sintetiche con clock controllato; nessuna prova di revoca di upload già consegnati a Storage, GC completo o browser. Interlock invariato.

06/10/2026 — compatibilità crypto: fixture legacy costruita con WebCrypto indipendentemente dal writer canonico (PBKDF2-SHA256100000/AES-GCM, materiale sintetico) leggibile con password Unicode NFC/trim; fallback CPVK2 alla credenziale legacy verificato e output del writer decifrato indipendentemente. Suite crypto/sessioni/races/logout/protected-session75/75; copertura di compatibilità, non nuova correzione o migrazione.

06/10/2026 — sei regressioni sintetiche sui byte passati a importKey (wrap, verifier, legacy; successo/errore) inizialmente conservavano credenziale codificata. importPasswordMaterial mantiene NFC/trim e parametri PBKDF2 preesistenti ma svuota encoded in finally. Suite crypto/sessioni74/74 senza skip. Nessuna asserzione di azzeramento stringhe o copie native, nessun nuovo algoritmo/parametro, migrazione o attestazione dispositivo; benchmark precedenti riferiti ai rispettivi hash storici.

06/10/2026 — tre regressioni in crypto-utils con intercettazione dei buffer WebCrypto sintetici: wrapping successo, wrapping errore e unwrap lasciavano byte della chiave non svuotati. Dopo correzione finally, buffer tutti zero e stringa restituita invariata; suite composta crypto/vault-session/races/logout/protected-session68/68. Non prova azzeramento stringhe, heap o copie native; formati/costo KDF invariati. Benchmark precedente resta prova della sorgente identificata dal suo hash, non nuovo benchmark. Nessuna migrazione o chiusura globale.

06/10/2026 — benchmark browser KDF: benchmark-vault-kdf-server.mjs espone solo tre risorse allowlist su127.0.0.1/porta effimera, snapshot del crypto-utils canonico SHA2563ea5793790c4e8b6599e2ee04cd65b0c35d51bea26312de3d201f617a89ef8f7; nessun Firebase, scrittura o account. Browser integrato su Windows (UA Chromium154), stato completed osservato nel DOM. Sette campioni dopo warm-up: mediane wrap52,9/unwrap51,2/password errata51,8/ciphertext alterato51,8/verifier51,5ms; massimi58,8/52,5/54,1/52,4/52,1ms. Assert positivi/negativi superati. Server temporaneo terminato tramite la propria sessione. Non misura Edge/iPhone, benchmark statistico completo, collaudo app, migrazione o audit indipendente.

06/10/2026 — benchmark-vault-kdf.mjs eseguito offline con implementazione canonica, SHA256 sorgente3ea5793790c4e8b6599e2ee04cd65b0c35d51bea26312de3d201f617a89ef8f7, Node24.12.0/win32. PBKDF2-SHA256600000 invariato. Sette campioni per operazione dopo un warm-up: mediane wrap65,18ms, unwrap66,14ms, rifiuto password errata78,11ms, ciphertext alterato77,46ms, verifier77,38ms; massimi rispettivi67,76/77,98/78,17/78,40/103,40ms. Assert su esiti validi/negativi superati; nessun materiale crittografico emesso nel rapporto, nessuna scrittura dati o rete. Non confronto statisticamente robusto, non misura browser/iPhone, migrazione o audit indipendente; gate KDF aperto.

06/10/2026 — crypto-utils unwrapVaultKey: envelope sintetico valido si apre; varianti con kdf/cipher alterati o iterations100000/600001/assente inizialmente non venivano rifiutate. Guard ora richiede PBKDF2-SHA256/AES-GCM-256/600000 coerenti con wrapVaultKey, prima della derivazione. Crypto3/3 e suite composta crypto/vault-session/races/logout/protected-session65/65 senza skip. Correzione locale del lettore canonico, non migrazione ciphertext né inventario dati reali; compatibilità dispositivi e audit indipendente restano aperti. Nessuna modifica Rules/manifest/interlock/deploy.

06/10/2026 — estensione reference-bridge-http.emulator.test: anteprima di due chunk con timestamp1ns nel secondo restituisce400/BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED; nessun piano aggiunto. Suite HTTP/Auth/Firestore/Storage1/1 superata nel progetto demo-vault-shell; arresto dei servizi temporanei confermato. Non reseed del banco originario, non prova browser o nuova build. Mantiene distinta questa prova dal precedente caso create e dalla prevalidazione unit senza accesso database.

06/10/2026 — anteprima M8: test con store sintetico strumentato mostrava ingresso nella transazione prima del rifiuto di timestamp1ns; aggiunta chiamata al decoder canonico nella validazione dei record preview. Ora codice TIMESTAMP_PRECISION_UNSUPPORTED e zero accessi database; suite resume-plan5/5, restore110/110. È prova unit della precedenza del rifiuto, non test di un upload effettivo né HTTP/browser; create/commit mantengono le loro verifiche. Nessuna nuova attestazione bundle, Rules/manifest/interlock invariati.

06/10/2026 — restore-stage-client: due test inizialmente rossi con read pendente dopo un chunk e cancel pendente dopo overflow. Abort ora svuota i chunk posseduti senza attendere read; ramo errore svuota output/chunk prima di attendere cancel. Listener rimosso in finally, risultato restituito resta del chiamante. Client8/8 include HTTP loopback con risposta parziale; gruppo restore109/109 senza skip. Non prova browser reale, revoca dei byte di rete o cleanup oggetti Storage; nessuna chiusura dei quattro blocchi.

06/10/2026 — prove sintetiche upload pendente: promise trasporto trattenuta, poi dispose/abort prima della risoluzione. Due regressioni in restore-stage-source e una in restore-stage-upload-client inizialmente lasciavano byte non nulli; dopo la correzione buffer propri subito svuotati, input chiamante invariato e nessuna status/publish dopo chiusura. Suite restore107/107 senza skip. Il client HTTP riceve già il signal per fetch; questa prova attesta il buffer JS, non l'annullamento di byte già inviati, cancellazioni Storage o collaudo browser. Solo sorgente staging supporta dispose diretto; il trasporto HTTP osserva abort e il proprio finally.

06/10/2026 — restore-resume-source: due regressioni inizialmente rosse confermavano byte [1,2] conservati dopo fallimento upload e successiva rilevazione lock/cambio owner senza abort. Ora check chiude la sorgente, svuota gli allegati e dispone il preparatore una sola volta; ritorno allo stesso owner/sblocco non riusa la sorgente chiusa. Aggiunta prova del gap finale readResumeBackup/prepare: abort via microtask, buffer catturato svuotato e zero richieste backend. Sorgente17/17; gruppo restore103/103 precedente all'aggiunta dell'ultima prova. Offline non equiparato a cambio identità. Nessuna attestazione cleanup Storage, browser o chiusura globale.

06/10/2026 — cleanup UI al lock rilevato: aggiunte regressioni sintetiche in company-directory.test e profile-shell-view.test, entrambe inizialmente fallite perché il contenitore con dati restava montato dopo il rifiuto di assertUnlocked. Correzione: dispose immediato al controllo fallito, senza attendere abort; verificati nessuna navigazione, rimozione vista e svuotamento valori DOM trattenuti (anche ricerca aziende). Suite composta25/25, test:vault-shell829/829 senza skip. Non prova browser, build o dispositivi; non attesta azzeramento fisico delle stringhe JavaScript né chiusura globale sicurezza. Rules, manifest e interlock non modificati.

06/10/2026 — ripresa piano legacy M8: test rosso in restore-chunk-lab mostrava record/ricevuta del primo chunk aggiunti prima del rifiuto timestamp del secondo. Prevalidazione intero comando prima del ciclo commit corregge il difetto senza mutare manifest, identità o validazioni transazionali. Restore101/101; Account-fence SDK9/9 include piano sintetico salvato direttamente nel solo namespace lab per simulare versione precedente, nessun nuovo record/ricevuta e updateTime piano invariato al rifiuto. Emulatore terminato. Non rollback di effetti precedenti, non soluzione di tutte le dipendenze o attestazione browser/build; quattro blocchi aperti.

06/10/2026 — prevalidazione valori tipizzati M8: create usa il validatore/decoder canonico sull'intero insieme prima della transazione; risultato scartato, factory reali e CAS restano nel commit. HTTP con due chunk e timestamp1ns nel secondo rifiuta con codice specifico, numero piani invariato. DOM con prepare1/2 e successivo errore timestamp verifica che i blocchi completati restino esplicitamente applicati, senza promessa di rollback globale. Restore100/100 senza skip; HTTP + resume-plan SDK2/2 su emulatori temporanei terminati. Non chiude altri errori parziali, scope, build/browser o quattro blocchi; nessuna modifica Rules/manifest/interlock.

06/10/2026 — diagnostica M8 attraverso HTTP: piano inesistente e piano sintetico di31 giorni restituiscono rispettivamente codici fissi MISSING_NEW_PREVIEW/EXPIRED_NEW_PREVIEW; richiesta owner estraneo resta generica. Suite HTTP/Auth/Firestore/Storage1/1 superata dopo le asserzioni, emulatori terminati. Allowlist trasporto include anche il codice timestamp già previsto dalla UI; nessuna nuova prova HTTP specifica timestamp in questo ciclo. Build: probe esbuild stdin senza import riuscito, risoluzione file progetto con tsconfigRaw esplicito ancora negata; non equivale a bundle riuscito. Nessuna modifica permessi, Rules, manifest o interlock; nessuna chiusura globale.

06/10/2026 — M8 dipendenze del vecchio padre: `restore-resume-plan-lab` legge lo stato precedente del widget nella transazione di creazione e rifiuta `RESUME_DEPENDENCY_CROSS_CHUNK` se un padre selezionato è in altro chunk. SDK Account-fence + resume-plan9/9: vecchio Account con conto referenziato, rifiuto senza nuovo piano e versioni invariate; stesso insieme in un chunk sposta il widget e aggiorna i padri. Restore99/99 include DOM: riprodotto messaggio generico errato al create, corretto senza modificare gestione degli esiti di rete incerti. Bridge consente solo il codice fisso per questo errore, mantiene occultati gli altri dettagli; HTTP/Auth/Firestore/Storage1/1 conferma400 e nessun nuovo piano. Emulatori temporanei terminati. Nessun raggruppamento automatico vecchio/nuovo padre, prova bundle/browser o chiusura dei quattro blocchi; interlock e vincoli invariati.

06/10/2026 — raggruppamento dipendenze M8 dei nuovi piani: test puro privato/azienda ai limiti400 record e7MiB, rifiuto gruppo sovradimensionato; DOM verifica messaggio esplicito e creazione disabilitata. Firestore demo8085: helper reale produce chunk399+2, quindi overwrite Account/bank widget da old a new applicato congiuntamente e due ricevute. Suite SDK7/7, restore98/98 senza skip; prima fixture SDK priva di accountId di scope corretta prima dell'esito positivo, non difetto applicativo. Nessun cambiamento ai piani persistiti o ai controlli backend. Build bridge/Functions fallita per lettura directory superiori negata da esbuild, nessuna escalation/variazione permessi: sorgente nuova non attestata nell'artefatto servito. Emulatori temporanei terminati. Restano vecchi/nuovi padri diversi, scope condivisi e verifiche browser/distribuite; nessuna chiusura globale.

06/10/2026 — M8 multipagina: `restore-account-fence.emulator.test.mjs`6/6 su demo-vault-shell/Firestore8085. Caso nuovo401 record sintetici (Account +400 metadati allegati): applicazione primo chunk400, ricostruzione manifest dal backup in ordine figli/padre, ripresa ultimo record, due ricevute e updateTime invariati al replay; nessun Account nel percorso applicativo reale. `restore-resume-source.test.mjs` aggiunge backup cifrato401 record, anteprima/create padre-prima e ricostruzione dall'ordine originale; trasporto di questa prova simulato, distinto dall'SDK. Gruppo restore puro96/96 senza skip; `reference-bridge-http.emulator.test.mjs`1/1 su Auth/Firestore/Storage locali. Tutti gli emulatori temporanei terminati. Non prova browser, file binari multipagina, scope condivisi, overwrite dipendenti fra chunk o completamento globale; interlock invariato.

06/10/2026 — M8 ordine nuovi piani: partizione stabile Account/figli prima del chunking, senza mutare record originali o ricostruzione di piani già salvati. Sorgente12/12, prova401 record colloca padre nel primo chunk e conserva ordine relativo figli. Non prova SDK401 record, non risolve overwrite con widget dipendenti in chunk successivi né scope shared; interlock invariato.

06/10/2026 — preparazione purge: rimosso helper esportato privo di vincolo anteprima; prepare è alias del percorso verificato, nessun hash implicito calcolato al posto del chiamante. Unit1/1 verifica rifiuto chiamata senza hash, SDK4/4 conferma negativi/replay/invalidazione e preservazione storico. Questa voce supera la precedente descrizione del prepare non vincolato. Nessuna delete/Rules/manifest modificati; emulatori chiusi.

06/10/2026 — copertura inventario profili: SDK4/4 senza skip, aggiunti documenti e utenze privati, email aziendali extra/pec/amministrazione/personale e telefono/fax/referente. Otto documenti interessati riconosciuti, omonimo Account di altra azienda escluso, contenuti originari invariati. Verifica del planner già esistente, nessuna nuova correzione o cleanup applicato; emulatori chiusi e gate globali invariati.

06/10/2026 — retry preparazione purge: prepareVerified conserva previewHash nella sola fence prepared; replay richiede stessa operazione/hash e struttura/revisione valide, nessun nuovo documento o TTL. SDK3/3 senza skip: due richieste contemporanee producono un nuovo risultato e un duplicate, retry successivo conserva updateTime; writer invalida la fence e rimuove hash, retry obsoleto rifiutato. Nessuna release di esclusiva/storico, delete o chiusura globale. Emulatori arrestati.

06/10/2026 — anteprima purge: hash del comando normalizzato e del piano versionato; prepareVerified confronta nuova lettura completa prima di creare fence. Unit1/1, SDK3/3 senza skip: hash stabile a dati invariati, modifiche Account anche con revision invariata, inserimento widget e cambio contenuto profilo rendono obsoleta l'anteprima; nessuna fence al rifiuto. Percorso interno prepare non vincolato resta helper di laboratorio, non conferma UI; nessuna autorizzazione distruttiva dal digest, grant/Storage/stop globale ancora esclusi. Emulatori chiusi.

06/10/2026 — inventario purge versionato: expectedDocuments include Account, delete riferimenti, shared da revisionare, profili interessati e allegati, con updateTime esatta dalla stessa transazione. Versioni mancanti/non valide rifiutate; piano invalido non emette questa lista. Unit1/1 e SDK2/2 senza skip, confronto puntuale delle sette versioni nei casi privato/azienda. È metadato interno, non autorizzazione CAS/esecutore: raccordo sequenza distruttiva, grant e Storage restano aperti. Emulatori chiusi.

06/10/2026 — negativi preparazione inventario purge: SDK2/2 senza skip, inclusi Account non archiviato, revisione obsoleta, profilo malformato, budget insufficiente e stato esclusivo con storico unknown. Ogni rifiuto preserva Account e stato preesistente, senza creare fence nuove. È verifica del comportamento già implementato, non nuova correzione né chiusura purge globale. Emulatori temporanei chiusi.

06/10/2026 — build staging: primo tentativo esbuild bloccato dalla lettura directory nel sandbox; stessa build locale eseguita con autorizzazione puntuale, senza cambio configurazione permessi. BRIDGE_BUILD_OK e FUNCTIONS_BUILD_RESTORED, finale realFunctions:true/persistent:false. Gruppo restore94/94 senza skip; aggiunta prova trasporto Buffer successo/errore, copia azzerata e originale preservato. Nessun servizio/seed o collaudo browser; quattro blocchi ancora aperti.

05/10/2026 — staging: riprodotto test rosso su input Node Buffer accettato come Uint8Array; slice condivideva memoria e finally azzerava i byte del chiamante. Sorgente e trasporto upload ora usano new Uint8Array per copia indipendente; prove mirate9/9. Correzione sorgente, bundle non rigenerato in questo checkpoint. HTTP/Auth/Firestore/Storage1/1 superato dopo estensione fence Account/widget, prima della correzione Buffer; non attribuire questa prova HTTP alla patch successiva. Emulatori chiusi; nessuna chiusura globale.

05/10/2026 — M8 composizione/concorrenza Account-widget: SDK5/5 senza skip, esteso ai cambi coerenti nello stesso chunk e alla contesa fra rimozione conto e creazione widget, per privato e azienda. In contesa un solo commit riesce e non resta bankId orfano; sostituzione atomica conto+widget riesce. Prova diretta del hook transazionale nel laboratorio, non nuovo endpoint/browser o chiusura globale. Emulatori temporanei chiusi.

05/10/2026 — M8 overwrite Account: aggiunta query transazionale limitata sui widget embedded candidati già presenti; rifiutata rimozione di bankId ancora referenziati, considerate sostituzioni widget nello stesso chunk. SDK restore fence4/4 senza skip: privato/azienda, Account invariato e nessuna ricevuta dopo rifiuto; retry riuscito rimosso il collegamento bancario sintetico. Limite400, nessuna migrazione legacy o copertura shared dichiarata. Emulatori temporanei chiusi; nessun collaudo browser o rilascio.

05/10/2026 — inventario allegati purge: query transazionale limitata sulla subcollection attachments del bersaglio, verifica prefisso Storage tramite validatore esistente e acquisizione updateTime esatta secondi/nanosecondi. Budget cumulativo comprende profili e documenti allegati; nessun dato cifrato restituito. Unit1/1 e SDK1/1 privato/azienda superati, inclusi path estraneo rifiutato con documento preservato. Non è inventario fisico Storage, pinning generazione o executor distruttivo; interlock invariato. Emulatori temporanei arrestati.

05/10/2026 — seguito inventario: aggiunta nella medesima transazione lettura profilo privato e aziende limitate, applicando solo in memoria il planner cleanup esistente; restituiti esclusivamente path interessati, mai patch/contatti/ciphertext. Budget include i documenti profilo da ripulire. SDK inventario1/1 nuovamente superato con riferimenti privato/azienda preservati; nessun cleanup realmente applicato. HTTP composto1/1 superato dopo correzione padre allegati. Governance11/11,31MD,612link. Queste estensioni non chiudono purge globale o gli altri blocchi.

05/10/2026 — inventario purge demo: query Firestore nella stessa transazione per intere collezioni owner widget/link/shared e inviti filtrati owner; limite+1 e rifiuto overflow, soli metadati nel piano. Rilevati riferimenti entranti da altri Account, nessuna delete/revisione shared applicata. Preparazione verifica Account archiviato/revisione, scrive soltanto fence compatibile col writer; nuova scrittura invalida prepared, preparazione obsoleta e seconda preparazione rifiutate. Unit1/1 e SDK1/1 privato/azienda. M8: corretto allegato senza Account padre; verifica padre nello stesso chunk o lettura transazionale candidato, rifiuto senza target/ricevuta, retry riuscito dopo presenza padre. Suite restore fence3/3; esecuzione SDK composta4/4 senza skip. Emulatori temporanei chiusi. Inventario non copre grant/profili/discendenti/Storage e non attiva claim/delete; nessuna attestazione globale, browser o produzione.

05/10/2026 — M8 selezione esplicita degli esistenti aggiunta alla sorgente/vista: checkbox inizialmente vuote, comandi limitati alle voci scelte, conferma overwrite distinta, versioni esatte dell'anteprima conservate. HTTP composto1/1 verifica sostituzione del solo Account selezionato, documento allegato escluso invariato e rifiuto dopo modifica concorrente prima della creazione piano. Raccordo restore widget embedded ai vecchi/nuovi Account: helper scope esclude shared-reference/owner estraneo, fence unica per padre; assenza Account candidato o bankId sospende il commit. SDK2/2 include entrambi i padri, blocco su ciascuno, nessuna scrittura/ricevuta parziale; dati sempre labCandidateRecords. Build entrambe valide, finale5001 ripristinata. Non coperti tutti gli scope/shared, cleanup Storage o browser; non chiusura dei quattro blocchi.

05/10/2026 — ciclo conti/carte candidato: aggiunti create/delete per array banking canonici, handler autenticato owner-bound con revision/fingerprint, ricevuta idempotente e fence Account obbligatoria. Delete conto verifica in transazione assenza widget della destinazione, anche archiviati; nessun cascade dei widget. SDK Firestore1/1 copre privato/azienda, widget presente, esclusiva purge e contesa con writer che legge Account: mai widget orfano. HTTP/Auth/Firestore/Storage1/1 ampliato copre quattro azioni, owner/auth negativi e replay senza riscrittura. Sorgente cifrata e vista con conferma esplicita, pulizia bozze/retry opaco; capability di lettura impedisce selezioni obsolete delle carte. Gruppo banking34/34, regressione827/827 senza skip; build bridge/Functions passate, finale5001 ripristinata. Non prova browser/Edge né copertura writer distribuiti; formati legacy e Account senza array canonico restano bloccati, nessuna assegnazione implicita bankId. Endpoint solo bridge candidato, non Functions5001 o produzione.

05/10/2026 — negativi staging M8: riprodotti prima della correzione cambio di generazione tra verifica/pubblicazione e permanenza dei byte già confermati dopo errore su allegato successivo. La sorgente ora rifiuta la generazione diversa, valida lo stageId e azzera subito i byte confermati; retry conserva solo gli allegati incompleti e non ricarica i precedenti. Verificato anche lock durante upload: nessuna richiesta status/publish successiva, copia propria azzerata e input chiamante preservato. Gruppo restore89/89 senza skip; build bridge e Functions riuscite, artefatto finale5001 ripristinato. Sono prove locali, non nuovo collaudo browser o garanzia GCS distribuita; quattro blocchi ancora aperti.

05/10/2026 — selezione M8 aggiunta: su backup misto la vista richiede esplicitamente «Conserva esistenti e seleziona solo mancanti»; create/staging bloccati prima della scelta, comandi ricomposti senza overwrite e allegati esclusi non caricati. Sorgente/DOM16/16; gruppo restore aggiornato86/86 senza skip. HTTP composto1/1 ampliato: rimosso soltanto un documento candidato sintetico dalla fixture, recuperato dal backup mantenendo updateTime dell'Account già presente; ripresa riuscita. Nessun dato utente eliminato, emulatori temporanei terminati. Build entrambe riuscite, finale Functions5001 ripristinata. Sovrascrittura selettiva degli esistenti non introdotta, scope indiretti e cleanup Storage restano separati.

05/10/2026 — M8 prova composta con cifratura reale del backup: lettore/sorgente→HTTP bridge→Auth/Firestore/Storage demo, Account con documento allegato→anteprima→staging→piano→commit→nuova sorgente con backup originale→rilettura ricevuta→replay senza duplicazione. HTTP1/1 ampliato superato. Fence estesa ai documenti attachments diretti usando una sola barriera per Account padre; SDK1/1 copre prepared/exclusive/storico/contesa per privato e azienda, conservazione storico e assenza scritture app. Scope indiretti non inclusi. Gruppo restore completo84/84, zero skip; decoder JSON bounded2/2 (UTF-8 frammentato/errato, limite byte), HTTP accetta ora anteprima M8 oltre200KB entro16MiB. Spiegazione UI timestamp non rappresentabile senza arrotondamento verificata. Build bridge/Functions passate, finale5001 ripristinata. Regressione generale825/825 al checkpoint editor; documentazione11/11,31 MD/612 link. Nessuna nuova prova browser/Edge/GCS reale né chiusura dei quattro blocchi.

05/10/2026 — seguito M8: sorgente/upload client e vista collegati allo staging del bridge, con conferma separata upload→piano→ripresa, limite backup16MiB/100 allegati, corrispondenza esatta storagePath e pulizia dei buffer al termine/lock. Retry dopo risposta upload persa verificato anche HTTP reale locale: una sola trasmissione, stessa operazione, pubblicazione e download confermati. Cleanup metadati scaduti esposto owner-bound a pagine50 senza retention inviata dal client; HTTP verifica rimozione del piano sintetico31 giorni e conservazione target/ricevuta con replay valido. Gruppo sorgenti/UI/handler23/23; HTTP/Auth/Firestore/Storage1/1 ampliato, senza skip; emulatori chiusi. Build bridge/Functions passate dopo il raccordo, finale5001 ripristinata. Non è ancora collaudo browser; cleanup automatico pianificato e Storage orfani sono distinti.

05/10/2026 — difetti editor: riprodotti sei test rossi per mutazione della bozza durante lettura confermata (documenti, utenze, contatti privati/azienda, indirizzi privati/azienda). Copia detached all'ingresso prepare; stessi sei test verdi e gruppo completo61/61. Nessuna modifica della classificazione cifrato/chiaro, revisioni, permessi o contratto dei writer. Prove sintetiche, non nuove attestazioni browser/dispositivo.

05/10/2026 — M8 ingresso candidato: anteprima da backup cifrato originale, creazione piano separata dalla ripresa e recupero read-only della risposta di creazione persa. Nessun secondo create dopo esito incerto; collisioni richiedono selezione, non overwrite implicito. Gruppo18/18, SDK/HTTP2/2 senza skip; regressione generale821/821, non comprensiva automaticamente di tutti i nuovi test. Build bridge e Functions riuscite, ripristinato bundle realFunctions:true/persistent:false. Nessuna nuova prova browser.

05/10/2026 — staging M8 collegato al bridge opzionale Storage loopback: confine metadata autenticato, upload/download bounded, mapping pubblicato verificato prima della creazione e nuovamente nella transazione di commit con fence Account. Prima prova rossa: create accettava stage inesistente con Storage abilitato; corretto il controllo anticipato. Secondo rosso dovuto al conteggio fixture che assumeva zero piani prima dell'anteprima: ora confronta il conteggio precedente, senza indebolire la verifica read-only. Gruppo staging37/37 e HTTP/Auth/Firestore/Storage1/1 finale senza skip: owner/origine, pubblicazione, download, binding operazione, rewrite candidato e replay senza riscrittura; Account applicativo non creato. Servizi temporanei chiusi, nessun seed globale. UI da backup con allegati e cleanup operativo restano aperti; emulatore non prova CAS delle generazioni GCS reali. Rules, manifest, app finale e interlock invariati.

05/10/2026 — parità bancaria candidata: aggiunti contratto/writer applyBankingEdit, sorgente e vista per modifica dei campi di conti/carte già canonici. Nessuna creazione/eliminazione, assegnazione bankId legacy o modifica collegamenti implicita. Patch limitata, fingerprint dell'intero banking e revisione Account; segreti cifrati, campi non modificati conservati, bozza copiata prima delle attese, retry opaco. Gruppo banking11/11 unit/DOM; test UI iniziale correggeva un'assunzione sull'ordine DOM, ora seleziona esplicitamente conto/carta del secondo bankId. HTTP/Auth/Firestore1/1 ampliato: privato/azienda, fence exclusive rifiuta dati e ricevuta, replay conserva updateTime. SDK fence1/1 con sei scenari (prepared/storico/contesa nei due domini): un vincitore, nessuna perdita dello storico. Hook disponibile solo bridge4188; pulsanti non esposti nel bundle5001, nessuna nuova prova browser. Build bridge e Functions riuscite; bundle finale ripristinato realFunctions:true/persistent:false, servizi temporanei chiusi.

05/10/2026 — difetto bozza editor Account standard riprodotto con test rosso: cambiando l'oggetto changes durante la lettura confermata veniva cifrato il valore successivo all'invio. Aggiunta copia prima dell'await; suite6/6 verde. Regressione generale precedente a questa correzione e al nuovo banking:818/818 senza skip; non comprende automaticamente tutti i nuovi file di test. Documentazione11/11,31 MD e612 collegamenti al checkpoint M8. Nessuna attestazione complessiva di chiusura o rilascio.

05/10/2026 — seguito locale shared/M8: unlink condiviso distinto dal delete, doppia conferma, cancellazione bozza e retry della stessa richiesta. Suite editor/shared23/23; HTTP/Auth/Firestore1/1 con cifratura reale verifica rimozione della sola coppia link/widget scelta, dato comune/Account conservati e secondo collegamento invariato. Non nuova prova browser Alfa. Build aggiornata con unlink e copia anticipata delle bozze.

05/10/2026 — M8 ricostruzione da backup originale: nessuna nuova anteprima/versione/opId durante il retry. Ricostruzione server accettata soltanto con hash del comando originale e verifica completa del piano; i quattro valori normalizzati dei flag storici vengono confrontati con il digest, senza modificare lo schema persistito. Endpoint reconstruct autenticato e owner-bound, nessuna scrittura; test Firestore piano1/1 e HTTP1/1 ampliati con ricostruzione, backup alterato, owner e replay dopo completamento. Emulatori temporanei chiusi. Lettore cifrato candidato Account-only (limite esplicito16 MiB, nessun allegato), controllo catena/footer, sorgente session-bound e vista con verifica/conferma/retry: gruppo13/13 unit/DOM/crypto. Primo test Node fallito per caricamento ESM dei moduli browser; test corretto caricando il sorgente effettivo come ESM, senza modificare runtime o asserzioni. Build realFunctions:true riuscita: mostra indisponibilità esplicita del comando M8 su5001; esecuzione UI sul bridge4188 NON collaudata. Nessuna creazione piano da UI, staging, scheduler o integrazione nell'app finale attestata; M8 ancora aperto.

05/10/2026 — raccordo ripristino/barriera Account nel laboratorio. restore-chunk-lab accetta hook server beforeChunkWrite e applica l'invalidazione nella stessa transazione di dati/ricevuta, dopo tutte le letture e la decodifica. Il bridge lo configura con restore-account-fence-lab: soltanto record Account privati/aziendali; altri scope rifiutati con RESUME_SCOPE_FENCE_NOT_CONNECTED, allegati staged ancora esclusi. Nessuna modifica ai record users, nessuna estensione implicita della garanzia ai riferimenti contenuti nei record. Firestore SDK1/1 comprende prepared, exclusive, storico sequence preservato, contesa claim/ripristino (un solo vincitore), atomicità fra due Account e replay senza nuova invalidazione. Unit chunk/handler10/10. HTTP/Auth/Firestore1/1 verifica rifiuto dell'endpoint con fence exclusive e assenza ricevuta. Primo avvio HTTP fallito per GOOGLE_CLOUD_PROJECT mancante, ripetuto con entrambe le variabili demo esplicite: successo, nessun allentamento delle guardie. Emulatori temporanei chiusi, banco browser non avviato. Purge resta interdetto; non chiusura PURGE-CAS o M8.

05/10/2026 — sweep M8 verificato anche con Firestore effettivo temporaneo8085, progetto demo-m8-stage, senza avviare Auth/Functions/browser o rieseguire il seed dell'app: suite piano1/1 estesa con due sweep concorrenti e cursori, piano valido e sentinella/ricevuta conservati. Suite esecuzione3/3 include contesa pulizia/ripresa alla scadenza: nessun secondo blocco pubblicato, primo blocco con updateTime invariato, unica ricevuta preservata, vecchio piano non ricreabile. Zero skip; emulatori temporanei chiusi regolarmente da emulators:exec. Non scheduler distribuito né nuova prova Alfa/UI. Il precedente limite «solo unit» dello sweep è superato da questi casi SDK, non dagli altri gate M8.

05/10/2026 — seguito candidato shared/banking e pulizia M8. Widget del secondo conto: create/update/rilettura/delete verificati nella precedente sessione IAB4188; carte e primo conto conservati, screenshot dist/bank-widget-proof.jpg. Editor credenziali comuni distinto, con avviso di effetto su tutti gli Account collegati, senza delete/link/unlink impliciti: salvataggio di COMUNE-DOPO-VERIFICATO su Zeta riuscito via Functions5001. Fixture separata shared-editor-48950c8b-aacc-4ece-8169-9829b2695843 creata tramite callable e collegata a Zeta/Alfa; corretto il preparatore della fixture perché ogni link incrementa la revisione comune (primo tentativo secondo link rifiutato per conflitto, poi ripreso con revisione2). Il dato storico privo di link/revisione resta rifiutato e non normalizzato. Rilettura da Alfa NON completata: alla ripresa pagina4188 connection refused e nessun listener sulle porte4188/9099/8085/5001/4455; nessun reseed o riavvio effettuato.

Pulizia M8: aggiunto sweep per proprietario, paginato e limitato1–100, namespace labRestoreResumePlans, con ricontrollo transazionale di ogni piano; identità/percorso/scadenza incoerenti conservati e contati come rejected, errori infrastrutturali propagati. Due test unit verificano paginazione, scadenza esatta, piano cambiato/scomparso dopo scansione e sentinella dati preservata. Non scheduler attivo, non prova Firestore di questo nuovo sweep. Regressione mirata30/30 senza skip; editor shared con preparatore e cifratore reali4/4, poi copia preventiva delle bozze prima delle attese confermate e regressione editor20/20. L'ultima copia preventiva è nel sorgente, non ancora nella build. Nessuna chiusura dei quattro blocchi, nessuna prova Edge/dispositivi/ambiente distribuito, interlock purge invariato.

05/10/2026 — parità widget generici: sorgente candidata aggiunge create (ID casuale, parent confermato, identità account imposta dal writer, niente bankId/revisione iniettati) e delete (snapshot e revisione ricontrollati). UI crea1–30 campi testo/riservati, mascherati in bozza, riservati per default; cancella con seconda conferma, retry conserva comando e vieta passaggio da delete incerto a save. Unit editor/view/writer25/25; build realFunctions:true/persistent:false riuscita dopo escalation tecnica esbuild, senza seed/Rules/riavvio. IAB4188 + Functions5001: creato Collaudo creazione sintetica 05-10 su Zeta A, campo cifrato mostrato correttamente; apertura editor, doppia conferma e rimozione riuscite. Account, precedente Collaudo editor verificato e widget storici conservati; rimossa solo fixture sintetica appena creata, non recuperabile dall'interfaccia. Screenshot locale dist/widget-create-delete-proof.jpg (generato, non documento canonico). Non prova Edge/dispositivi, bridge fence, parità shared/banking o tutti i tipi campo; nessuna chiusura globale.

05/10/2026 — confine ripresa candidata: restore-resume-handler verifica identità/attestazione fornite dal trasporto, owner atteso, allowlist azioni/campi; create restituisce solo ID/scadenza, resume passa soltanto a commitPlan con piano obbligatorio. Unit1/1. Registrato nel sorgente bridge demo manageRestoreResume, per ora solo record senza stage allegati: manifest non vuoti respinti, nessun mapping inventato. Suite HTTP/Auth/Firestore reference-bridge ampliata1/1 senza skip: rifiuti, creazione, esecuzione, replay e inspect, dato scritto esclusivamente in labCandidateRecords e Account applicativo assente. Server temporaneo chiuso, servizio4188 non riavviato; niente UI, produzione o App Check reale. Allegati e integrazione UI restano aperti.

05/10/2026 — M8 ripresa: create assegna ID server e controlla versioni attuali nel namespace demo; save non crea record mancanti. removeExpired elimina esclusivamente il piano scaduto validato, preservando sentinella/ricevuta; test verifica che la vecchia ripresa non lo ricrei. Manifest staged vincola identità e ID allegati, riconciliazione usa esclusivamente labRestoreChunkReceipts; le ricevute ordinarie restano distinte. Commit con contesto verifica piano e scadenza nella stessa transazione dei dati/ricevuta, incluso retry (fixture). Suite piano/unit/SDK/staging6/6 senza skip; regressione binding/chunk/summary18/18, successiva fixture retry porta chunk a9/9. Nuova esecuzione multipla SDK2/2: risposta ignorata dopo primo blocco, nuova istanza completa soltanto secondo (updateTime del primo invariato); conflitto sul primo arresta senza dati/ricevute dei successivi. Storage simulato nel test staging, Firestore8085 effettivo demo; nessuna prova UI/endpoint, nessun cleanup automatico o certificazione distribuita. Eliminati soltanto metadati sintetici del test, non dati produttivi. Controllo documenti11/11,31 MD e612 link prima di questo aggiornamento. Quattro blocchi non chiusi.

05/10/2026 — riesame input ripresa: save/reopen ora copiano i comandi prima dell'attesa Firestore, come già reconcile; verificato SDK che la mutazione del chiamante dopo avvio non sostituisce identità/contenuto in nessuno dei tre percorsi. Suite3 unit+1 SDK4/4 senza skip. Non è ripresa applicativa completa. Riesame statico retention: la sola rimozione del documento farebbe tornare save al ramo create; occorre impedire il rinnovo di vecchie operazioni dopo cleanup prima di introdurre tale cancellazione. Nessuna pulizia fisica attivata o retention ulteriore presunta.

05/10/2026 — piano ripresa: aggiunta riconciliazione read-only transazionale con ricevute backend non-staged mutationResults. Piano e ricevute letti insieme; binding ricalcolato dai comandi originali, ricevuta valida→applied, assente→unconfirmed (mai autorizzazione a rieseguire), alterata→rifiuto. SDK ampliato e tre unit4/4 senza skip: rilettura da nuova istanza, hash ricevuta diverso rifiutato, scadenza impedisce anche riconciliazione, ricevuta/completati conservati. Primo avvio fallito per percorso require della fixture, corretto prima della riesecuzione. Non prova endpoint autenticato o ripresa effettiva; dominio staged ancora separato, pulizia fisica scaduti non implementata. Nessuna modifica a dati reali/Rules.

05/10/2026 — M8-RP-01 primo raccordo candidato: restore-resume-plan prepara manifest minimo da comandi validati (identificativi, percorsi/versioni originarie, impronte), senza corpi/chiavi; controlla completezza/ordine chunk, unicità operazioni/bersagli e capacità800KiB. Scadenza fissa30 giorni dalla creazione, nessun rinnovo su riapertura; backup originale nuovamente necessario. restore-resume-plan-lab persiste transazionalmente soltanto in demo/8085 e labRestoreResumePlans, non endpoint autenticato. Prove3 unit+1 SDK tutte passate senza skip: due save concorrenti concordano, nuova istanza rilegge il piano, contenuto sintetico assente dai dati persistiti, scadenza esatta rifiuta save/reopen senza mutare sentinella dei completati. Verifica canonica tollera ordine campi Firestore ma rifiuta metadati aggiunti/alterati. Restano integrazione UI/endpoint, raccordo staging/ricevute e pulizia fisica dei piani scaduti: il rifiuto alla scadenza NON realizza da solo la retention. Nessuna chiusura M8 o modifica Rules/produzione.

05/10/2026 — M8-TS-01 implementato nel preflight client validateRestoreTypes e decoder server decodeFirestoreValue: timestamp valido ma non multiplo di1000ns rifiutato con BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED, senza conversione. UI impostazioni aggiunge spiegazione specifica; nessuna prova browser del messaggio in questo checkpoint. Fixture con data non rappresentabile dopo401 record dimostra mancata restituzione dei chunk, valori originali invariati e factory timestamp non invocata. Suite modello client/decoder/lab24/24; regressione backend backup56/56. SDK Firestore8085/demo-m8-stage1/1 senza skip: timestamp456000ns conservato,456ns ora rifiutato senza documento o ricevuta (sostituita precedente caratterizzazione di perdita precisione). Storage simulato in tale banco: non prova GCS. Sintassi tramite audit progetto171 moduli OK; check diretto Node sul file ESM non applicabile per package CommonJS. Nessun deploy, migrazione o prova distribuita; piano30 giorni ancora da implementare.

05/10/2026 — regressione di riconciliazione: test:vault-shell817/817, test:data-access95/95 (audit repository incluso), test:navigation152/152 (audit navigazione e registro inclusi), test:crypto2/2, sintassi171 moduli OK. test:attachments inizialmente52/53: caratterizzazione T-08 obsoleta vietava perfino la menzione accountWidgets, ora presente come lettura preflight; aggiornata per distinguere letture/widget-link, assenza cleanup e interlock, senza toccare runtime purge. Rieseguita53/53; interlock dinamico1/1 prova zero accessi dati. I test residui T-26 e simili restano caratterizzazioni di difetti, non correzioni.

05/10/2026 — editor generico: ampliati negativi parent assente/archiviato/owner diverso, identità/contesto/revisioni invalide, record duplicati/assenti, decifratura fallita e modifica durante decifratura; positivo aziendale conserva collocazione, rifiuta sostituzione ID campo. Nuovo caso bankId inizialmente fallisce (sorgente accettava il widget escluso dalla vista); aggiunto rifiuto nella sorgente, senza abilitare editor bancario. Editor/capability/view21/21. Build candidata completata realFunctions:true/persistent:false, incluse validazione numerica e guardia bankId; primo tentativo sandbox negato, compilazione autorizzata riuscita. Nessun reload/prova browser nuova attestata in questo checkpoint; emulatori, Rules, manifest, purge e produzione invariati.

05/10/2026 — ispezione editor candidato: Number('') trasformava implicitamente campo numerico vuoto in zero. Aggiunto controllo prima di source.prepare: vuoto/spazi e conversioni non finite rifiutati con messaggio specifico, nessuna preparazione/invio; zero esplicito consentito. Fixture DOM copre vuoto, spazi, Infinity, testo invalido e correzione a zero. Seconda fixture: doppio click durante invio non duplica richiesta; errore trasporto conserva piano, campi puliti/disabilitati e retry prepara una sola volta. node --test editor + write-capability:13/13 senza skip. Prova DOM sintetica, non browser né guasto rete reale; nessuna nuova build/reload in questo checkpoint. Non estende copertura create/delete/shared/banking, interlock invariato.

05/10/2026 — prova IAB reale su4188, realFunctions:true/persistent:false: seed-widget-editor-fixture.mjs crea tramite manageAccountWidget5001 una fixture sintetica distinta revision1 sotto Zeta A, senza seed globale/Rules o normalizzazione legacy. Widget editor-check-7cfc094b-8240-4d30-9ab9-03d268c72f49: titolo Collaudo editor 05-10 e valore PRIMA-PROVA-UI modificati dalla pagina in Collaudo editor verificato / DOPO-PROVA-UI. Salva chiude editor e aggiorna dettaglio; riapertura mostra valori salvati. Inserita BOZZA-NON-SALVATA senza invio, Blocca rimuove dettaglio/editor; nuovo sblocco e apertura Zeta mostrano DOPO-PROVA-UI, non la bozza. Copertura UI limitata a update generic embedded con campo non cifrato; cifratura resta attestata dalle precedenti prove dedicate, non da questa. Nessuna prova fence del bridge, Edge/dispositivi o distribuito. Purge interlock invariato, niente produzione/deploy.

05/10/2026 — aggiornamento pagina richiesto: buildEmulator({persistent:false,realFunctions:true}) riuscita dopo errore iniziale di accesso sandbox esbuild e riesecuzione autorizzata; mantenuta configurazione rilevata nel bundle servito. Nessun riavvio emulatori/seed/Rules. Aperta nuova scheda IAB4188 (nessuna precedente scheda locale disponibile), login A e sblocco sintetico riusciti, dettaglio Zeta mostra nuovo pulsante Modifica widget. Apertura rifiutata con messaggio generico: seed storico widget-private non contiene revision, richiesta dal nuovo source; nessuna normalizzazione/scrittura forzata. Pagina aggiornata attestata, salvataggio UI NON superato. Il banco usa Functions5001, non bridge con fence4188: non attribuire alla UI le prove di barriera del server temporaneo. Necessaria fixture revisionata separata per il percorso positivo.

05/10/2026 — editor widget incorporati esistenti collegato nel sorgente emulator-entry: pulsante opzionale nella vista generica, lettura server con snapshot/revisione ricontrollati dopo decifratura e prima di preparare; modifica solo titolo/valori preservando metadati fidati. Invio tramite writer di sessione/callable, retry stesso piano e bozza rimossa dopo preparazione; campi sensibili mascherati, dispose/lock pulisce input. Fixture editor4/4, regressione editor/view/capability16/16; sintassi entry superata. Non eseguita build/reload del servizio4188 o prova browser fisica. Perimetro UI: update di embedded generici, non create/delete, widget bancari o shared-reference. Nessuna attestazione completamento UI globale; test DOM usa fixture, non browser. Purge invariato.

05/10/2026 — raccordo sessione/cifratura/trasporto widget verificato: createSessionAccountWidgetWriter usa context.encrypt della vista protetta e rifiuta plaintext/cifrato non riconosciuto; dispose abbandona i piani. HTTP emulator1/1 ampliato con ProtectedSession/MemoryVault reali (ammissione sintetica di test), modello prepareEmbeddedAccountWidget e crypto-utils reali: create sensitive, documento senza segreto in chiaro, lettura/decifratura attraverso la vista, retry idempotente e invio rifiutato dopo lock. Auth/Firestore emulati e server temporaneo come prima; non produzione o UI montata. Unit capability7/7 più sessione33/33 =40/40: errore trasporto conserva comando/operationId senza ricifrare, output cifratura invalido impedisce invio, sessione/owner/risposta tardiva. Test risposta persa simula errore client, non guasto rete reale. Restano editor e riconciliazione post-stop; nessuna chiusura globale MD o riattivazione purge.

05/10/2026 — primo confine scrittura UI candidata account-widget-write-capability: sessione/owner/online ricontrollati prima e dopo preparazione/cifratura e risposta; piano opaco trattiene solo comando preparato con identità retry stabile, duplicato simultaneo rifiutato. Fixture5/5: modello applicativo prepareEmbeddedAccountWidget reale con cifratore sintetico, identità aziendale/revisione, nessun valore sensitive in chiaro nel comando, cambio owner/abort durante cifratura, offline/dispose, delete senza cifratura, risposta tardiva. Quest'ultima può essere già applicata dal server: il rifiuto locale non promette rollback. Modulo non ancora montato nell'editor né collegato a cifratore/sessione/HTTP reali; test non prova crittografia. Editor legacy importa security-manager e client globali: non importato nella candidata. Nessun cambiamento runtime principale o riavvio; interlock purge invariato.

05/10/2026 — regressione estesa richiesta «tutte le prove», circoscritta ai percorsi in lavorazione: Functions382 pass/3 skip, modelli purge32/32, note/standard/link27/27, reader/view widget e banking52/52; SDK/HTTP candidata e ricevute7/7 su8085; executor purge6 pass/2 skip su8080 isolato, poi fence/target/preflight3/3 su8085. I tre emulator test saltati nella suite Functions e i due sulla porta8080 sono coperti nelle esecuzioni dedicate corrette; nessun fallimento finale. Non npm test globale. Emulator8080 arrestato regolarmente, banco4188/8085 conservato. Ispezione emulator-entry.mountWidgets e account-widget-view conferma composizione consultation-only: nessun editor/writer dei nuovi callable collegato alla pagina. Correzione del prossimo passo: un semplice reload non abilita quei percorsi; serve integrazione UI candidata distinta prima del collaudo browser delle mutazioni. I test view sono fixture, non Edge/dispositivi reali; Storage/distribuito e chiusura difetti purge non attestati. Rules, manifest e interlock invariati.

05/10/2026 — reference-bridge-http.emulator.test.mjs superato 1/1 senza skip: bridge importato dal sorgente corrente, server HTTP loopback temporaneo su porta libera, Auth9099 e Firestore8085 reali emulati. Utenti sintetici univoci: rifiuti token assente, utente fuori allowlist, origine/host/attestazione errati e owner diverso; create widget, replay, link condiviso e barriera exclusive verificati su dati persistiti. Test iniziale 401 invece di400 perché fetch non inviava l'Host richiesto nel banco su porta diversa; sostituito solo il client di test con http.request, nessuna guardia allentata. Server temporaneo chiuso; servizio4188 e emulatori esistenti non riavviati. Header Host/origin impostati dal test, quindi NON prova browser/CORS/AppCheck produzione né attestazione che la pagina4188 abbia caricato le modifiche. Nessun dato reale, Rules o deploy.

05/10/2026 — raccordo sorgente servizio candidata: estratta senza duplicazione la logica widget/shared-vault in functions/reference-callables.js, factory con dipendenze e guardia owner obbligatoria. index conserva registrazione region/AppCheck e richiama lo stesso modulo; bridge demo registra entrambi i percorsi passando DB con barriera e guardia owner, sotto i controlli esistenti token/allowlist/origine. Nessuna estrazione VM nel runtime. Adattate sei fixture che leggevano index: prima quattro errori require assente nel test owner, poi correzione dell'iniezione di test; regressione Functions 382 pass/3 skip/0 fail. SDK tre suite 3/3 senza skip (widget receipt, unlink, barriera con trenta scenari). Lint index/modulo e sintassi bridge/modulo superati. Nessun riavvio, deploy o attestazione HTTP/UI: il sorgente è collegato, il servizio già attivo non è dichiarato aggiornato. Interlock purge invariato; stop/ripresa e copertura globale restano aperti.

05/10/2026 — contesa aggiunta alla suite reference-callable-db-lab.emulator: SDK1/1 senza skip, trenta scenari complessivi, dieci concorrenti (cinque comandi × privato/azienda). Promise.allSettled avvia writer e claim transazionale sulla stessa barriera prepared: un solo successo; claim vincente conserva tutti i dati/ricevute/audit, writer vincente invalida piano e verifica effetti/replay. Controllati FENCE_BUSY/FENCE_CONFLICT, non accettati errori generici come esito corretto. Non attesta tutti gli interleaving o entrambi i vincitori in ciascuna esecuzione. Solo demo8085 e dati sintetici; nessuna delete purge, HTTP/UI, modifica runtime o riavvio. Raccordo servizio e stop/ripresa restano aperti.

05/10/2026 — ampliata suite reference-callable-db-lab.emulator: 1/1 senza skip, ora venti scenari (create/update/delete widget, link/unlink condiviso × privato/azienda × prepared/exclusive). Aggiunti modifica titolo, eliminazione widget, scollegamento di entrambi i riferimenti con incremento revisione condivisa; Account conservato. Exclusive lascia tutte le prove persistite invariate, replay dopo successo non ripete effetti né invalidazione. SDK demo locale8085, autenticazione sintetica e handler estratti in VM; nessun riavvio o collegamento HTTP/UI. Non ancora contesa simultanea con claim, stop/ripresa o integrazione servizio. Nessuna modifica runtime in questo checkpoint; interlock purge invariato.

05/10/2026 — primo raccordo isolato widget/condivisioni: reference-callable-db-lab accoda le scritture dei callable esistenti e legge/invalida la barriera Account nella stessa transazione prima del commit; nessuna copia della logica applicativa. Test SDK reference-callable-db-lab.emulator.test.mjs: 1/1 senza skip, otto scenari (create widget/link condiviso × privato/azienda × prepared/exclusive). Prepared salva e invalida atomicamente; exclusive rifiuta lasciando Account, riferimento, dati condivisi, ricevuta e audit invariati; replay dopo successo non modifica nulla. Handler reali estratti in VM, autenticazione sintetica: non prova HTTP/Auth/AppCheck o UI. Solo demo-vault-shell8085, warning metadata non fatale. Adattatore non ancora collegato al servizio candidata; update/delete widget, unlink, contesa e stop/ripresa ancora da verificare. Interlock purge invariato, nessuna modifica Rules/manifest o deploy.

04/10/2026 — contesa SDK link/claim aggiunta: quattro scenari (sorgente privata/aziendale × claim sul precedente/nuovo Account) con Promise.allSettled e transazioni Firestore reali. Un solo vincitore; se vince claim, profilo/Account intatti, ricevuta assente e barriera dell'altro partecipante immutata; se vince link, entrambe le barriere invalidate e destinazione aggiornata. Credenziali preservate. Suite candidata 3/3 senza skip su demo locale8085; numero test invariato perché ampliato il test link. Non cancellazione reale, non attestazione entrambi i vincitori osservati in ogni contesa, non prova browser/HTTP. Widget/condivisioni restano callable distinti in functions/index.js, non presenti nella mappa del bridge candidata; richiedono raccordo separato.

04/10/2026 — SDK collegamenti candidata verificato in account-write-fence-lab.emulator.test.mjs: sorgente privata/aziendale verso Account aziendale, barriera exclusive sul precedente o sul nuovo Account lascia profilo/Account/barriere identici e ricevuta assente; successo invalida entrambe le barriere e salva collegamento/ricevuta preservando credenziali. Sei scenari nello stesso test; suite complessiva 3/3 senza skip comprende note e contesa standard. Solo dati sintetici univoci su demo-vault-shell8085, nessuna modifica Rules o riavvio; warning metadata non fatale. Non prova HTTP/Auth/AppCheck reali, browser, contesa link/claim o widget/condivisioni. Interlock purge invariato.

04/10/2026 — raccordo candidata campi Account e link: suite account-write-fence-lab.emulator 2/2 senza skip sul demo locale8085, comprende standard privato/azienda writer-first, claim-first e contesa; un solo vincitore, ricevuta coerente, note e metadati estranei preservati. Collegato hook anche a profile-link-handler: controlla i partecipanti modificati vecchio/nuovo Account prima di qualsiasi scrittura, deduplica percorso. Fixture link verifica rifiuto di ciascun partecipante senza effetti e ordine read/read/commit/commit; regressione note/standard/link 27/27. Non ancora prova SDK link né collaudo UI/ricaricamento bridge. Blocco purge invariato; stop post-claim e restante copertura ancora aperti.

04/10/2026 — primo raccordo writer candidata: hook server beforeAccountWrite nei salvataggi note/standard, iniettato solo da emulator-qr-bridge. Adattatore account-write-fence-lab vincolato a demo-vault-shell/127.0.0.1:8085, identifica labPurgeStates tramite SHA256 del percorso Account; stato assente ammesso, prepared invalidato nella transazione di save, exclusive/storia sequence rifiutati senza reset. Unit note/standard 13/13; prova SDK handler note 1/1 senza skip (assente/prepared/exclusive, Account e ricevuta verificati), dati sintetici univoci. Non test browser, non prova SDK standard, non nuovo executor distruttivo su questi percorsi. Bridge in esecuzione non riavviato: wiring nel sorgente, caricamento pagina corrente non attestato. Mancano stop post-claim/ripresa per questi writer, collegamenti, altri writer, discovery e Storage; interlock applicativo resta attivo.

04/10/2026 — interlock temporaneo applicativo: nuovo purge-suspension-handler.test.js usa policy reale e handler estratto da index; privato/azienda, retry e campo bypass client vengono rifiutati prima di Firestore/Storage/binding, autenticazione e owner restano verificati. Suite mirata 37/37 comprendente recovery; suite Functions completa 382 pass/3 skip emulator/0 fail, sintassi index e lint dei file runtime e nuovo test superati. Fixture storiche archive-owner, archive-receipt, purge-profile-cleanup e preflight emulator escludono esplicitamente l'interlock nel solo contesto VM per preservare evidenza del vecchio algoritmo: non provano disponibilità endpoint o risoluzione dei difetti. Nessun deploy, nessuna attestazione di ricaricamento servizi già avviati o UI browser.

04/10/2026 — regressione completa del gruppo purge dopo ripresa: 64/64 locali (modelli/fixture purge e quattro suite Functions), 6/6 SDK su emulator isolato 8080, 3/3 SDK su emulator esistente 8085, tutti senza skip. Nuove prove nella sequenza: errore reale server al commit tramite create di sentinella esistente non salva riferimento né modifica stato/bersaglio; due resume concorrenti stesso ID danno un solo successo e REFERENCE_EXISTS; modifica bersaglio concorrente è serializzata e una successiva richiesta sul piano vecchio rifiutata. Una modifica non cooperante dopo il commit resta possibile: non attestata protezione globale. Emulator isolato arrestato, servizio esistente non riavviato; warning metadata non fatali. Totale tecnico 73/73 include le due caratterizzazioni KNOWN LIMIT ancora aperte nell'app. Non è esecuzione npm test globale, né verifica Edge/dispositivi/Storage/produzione.

04/10/2026 — ripresa esplicita riferimento sintetico dopo stop: resumeLabReferenceAfterStop rilegge stato, tutti i bersagli/ricevute e riferimento destinazione nella transazione di create. Richiede revisione corrente, soli applied/unstarted riconciliati e bersaglio unstarted con versione originale presente. Non riapre fence, non ricrea dati, non sovrascrive riferimenti, non azzera storia. Fixture 2/2 (inclusi pending/unknown rifiutati); SDK sequenza 5/5 senza skip: salvataggio sul superstite dopo successo parziale, revisione obsoleta e bersaglio già cancellato/ricreato rifiutati, duplicato rifiutato, modifica successiva al rapporto rifiutata, vecchio executor ancora bloccato. Emulator demo 8080 arrestato, warning metadata non fatale. Limite: solo create di riferimento sintetico, non ripresa generale writer/Storage o nuovo ciclo purge; duplicato non è replay idempotente.

04/10/2026 — negativi riconciliazione ampliati: ricevuta con effectId/planHash/indice/esito diversi, stato non fermato o revisioni incoerenti rifiutati; rapporto e voci immutabili. Nuova regressione inizialmente rossa: applied con ricevuta ma identica versione bersaglio ancora presente era accettato. Corretto con PURGE_EVIDENCE_CONFLICT, distinto da versione ricreata. Suite locali purge 32/32 e SDK sequenza 5/5 senza skip; emulator isolato arrestato normalmente, warning metadata non fatale. Rapporto sempre writeAllowed:false; nessuna prova di release o ripresa effettiva, nessuna modifica app principale.

04/10/2026 — ispezione post-stop in sola lettura: inspectStoppedLabPurge legge stato, versioni bersaglio e ricevute in una transazione, verifica binding operazione/piano/indice, distingue absent/original-version/different-version e restituisce sempre writeAllowed:false. Fixture 1/1: pending/unknown senza documento restano irrisolti, applied senza ricevuta rifiutato, stato immutato. Suite SDK sequenza 5/5 senza skip: successo parziale attestato e bersaglio ricreato riconosciuto senza perdere esito precedente né modificare stato. Emulator demo 8080 terminato, warning metadata non fatale. Nessuna risoluzione automatica degli esiti, release o ripresa writer; solo evidenza transazionalmente coerente al momento della lettura.

04/10/2026 — nuova preparazione sintetica: prepareLabPurgeWithoutReferences legge nella stessa transazione stato, presenza riferimenti nello scope e versioni documentali. Suite sequenza SDK 5/5 senza skip su demo-purge-fence/127.0.0.1:8080: writer prima, preparazione prima, contesa e versione cambiata. Riferimento persistito blocca ogni nuova preparazione; writer successivo invalida il token preparato. Nessuna delete nelle nuove prove. Emulator terminato normalmente, warning metadata non fatale. Il controllo è conservativo (qualsiasi riferimento nello scope blocca), limitato a labPurgeReferences e writer cooperanti; non scopre riferimenti applicativi o discendenti né abilita ripresa post-stop.

04/10/2026 — regressione estesa richiesta da Diego, perimetro purge: tutti gli 8 file purge non-emulator del laboratorio e i quattro file Functions archive-purge-service/reference-plan/receipt e purge-profile-cleanup-handler: 62/62, zero skip. Prima esecuzione 61/62: fixture purge-document-lab.test.mjs rimasta su 8085 invece di 8080; corretto solo il test, aggiungendo anche il rifiuto esplicito della vecchia porta. Riesecuzione completa verde. Emulator isolato 8080: executor singolo e sequenza 5/5; emulator esistente 8085, soli progetti demo e identificatori sintetici univoci: fence, versioni bersagli e preflight esterno 3/3. Nessuno skip, nessun riavvio del servizio esistente; warning metadata non fatali. Totale tecnico 70/70, inclusi due KNOWN LIMIT che confermano difetti, non correzioni. Non eseguita la suite globale npm test né attestati Edge/dispositivi/Storage/produzione. Ripresa post-stop e completezza del nuovo piano non implementate, quindi non certificate da queste prove.

04/10/2026 — writer pre-claim sintetico: createLabReferenceBeforePurge salva il riferimento create-only e invalida fence nella stessa transazione su labPurgeStates. Suite SDK purge-sequence-document-lab.emulator.test.mjs 4/4 senza skip su demo-purge-fence/127.0.0.1:8080: writer-first rifiuta claim obsoleto, claim-first rifiuta writer, contesa ammette un solo vincitore, versione bersaglio cambiata non modifica stato né crea riferimento; riferimento duplicato non incrementa revisioni. Rieseguiti anche gli scenari post-claim e multipasso. Emulator arrestato; warning metadata non fatale. Non prova scoperta automatica dei riferimenti, UI, autenticazione, Storage o release/ripresa post-stop.

04/10/2026 — gate post-claim dei riferimenti: `purge-reference-writer-lab.mjs` legge bersaglio e stato condiviso e persiste stop, restituendo saved:false (deferred-reverification oppure target-missing). Suite `purge-sequence-document-lab.emulator.test.mjs` 3/3, nessuno skip, progetto demo-purge-fence su 127.0.0.1:8080: ordini writer-first/delete-first e contesa reale SDK, retry stabile senza ulteriori transizioni. Emulator arrestato normalmente, warning metadata non fatale. Il gate non crea riferimenti, non accoda la richiesta e non implementa ripresa/release: assenza di orfani in questa prova non certifica un writer completo né i percorsi applicativi.

## RICONCILIAZIONE-04-10 — verifiche puntuali dei residui

Seguito writer: `purge-profile-cleanup-handler.test.js` 8/8, compreso nuovo KNOWN LIMIT sui riferimenti tardivi in accountWidgets/sharedVaultLinks. La fixture inserisce il riferimento dopo preflight: Account cancellato, riferimento presente e ricevuta purged. Caratterizzazione del difetto aperto, non prova di scrittura autorizzata tramite endpoint/Rules concorrenti.

`purge-sequence-document-lab.test.mjs`: nuova regressione inizialmente fallita con PURGE_TARGET_INVALID quando scope veniva cambiato durante la lettura asincrona. Corretta acquisizione immutabile di scope e token, validato prima di I/O. Test successivo verifica separatamente mutazione scope/token, successo sul comando originario e tre scritture candidate; fixture, non SDK. Insieme al modello bound-sequence: 6/6. Dopo patch, `purge-sequence-document-lab.emulator.test.mjs` 2/2 su emulatore Firestore separato 127.0.0.1:8080/demo-purge-fence, avviato e arrestato dal comando emulators:exec. Warning metadata non fatale. Banco app 4188/8085 lasciato attivo; nessuna patch runtime/Rules base o nuovo MD.

Seguito UI 04/10: identificata l'app già servita su `http://127.0.0.1:4188/`, titolo «Vault · laboratorio Firebase locale». Nuova scheda nel browser integrato Codex, fixture A/B del banco esistente, nessuna modifica a Rules o seed. Percorsi osservati nel DOM: accesso A mantiene Vault bloccato e dati assenti; password sintetica corretta apre tre card A; navigazione Profilo mostra dati fittizi; Blocca rimuove profilo/card; Esci ripristina selettore e accesso anonimo; ingresso B resta bloccato, poi sblocco e route Account mostrano Alfa/Banca/Zeta B; reload ripristina «Accesso non effettuato», Sblocca disabilitato e nessuna card. Screenshot locale `.codex-tmp/riconciliazione-vault-reload.jpg`. Servizi esistenti lasciati attivi. È prova della build già servita, senza certificazione di parità con gli ultimi sorgenti; non Chrome/Edge separati, mobile, editor, App Check reale o integrazione multipagina principale. Superato il solo blocco di accesso al banco tramite UI, non il fallimento del runner che tenta di riavviarlo sulle porte occupate.

`node scripts/audit-vault-integration.mjs`: risultato BLOCKED, 13/13 callable cercate presenti sia nel ponte sia negli export del checkout; restano i due indicatori wrapping legacy e ingresso multipagina. Inventario per pattern, non collaudo di raggiungibilità o produzione. Riscontro sorgente conferma sessionStorage.setItem(WRAPPING_KEY) e ITERATIONS=100000 distinto da KEK/verifier=600000.

`node --test functions/test/purge-profile-cleanup-handler.test.js tests/crypto-utils.test.mjs`: 9/9, di cui 7 handler e 2 verifier. Il caso KNOWN LIMIT modifica il record fra preparazione e recursiveDelete e conferma che viene cancellato: test verde di caratterizzazione, PURGE-CAS NON corretto. Dipendenze sintetiche, nessun dato reale. I test verifier non provano migrazione KDF dei campi.

`node scripts/run-vault-session-emulators.mjs --entry-browser`: exit 1 prima dei test browser, porte 4455/4555/9099/8085 occupate. GET locale del solo elenco servizi `http://127.0.0.1:4455/emulators` conferma hub, logging, Auth, Firestore e Functions esistenti; nessun contenuto utente letto, nessun processo preesistente arrestato. Nessuna prova UI dichiarata eseguita. Il runner ha preparato copie delle Rules in dist/emulators; Rules base non modificate. Prima di riprovare identificare il banco attivo, poiché il runner browser modifica fixture/Rules dell'emulatore e non va lanciato indiscriminatamente sulla sessione esistente.


## PURGE-SEQUENCE-03 — CAS del solo stato condiviso, 04/10/2026

`purge-bound-stop-model.test.mjs` e `purge-document-lab.test.mjs`: 5 pass, 1 skipped su Node 22 nella verifica precedente; lo skip era dovuto a emulator non avviato. Decisione Diego: riuso dello slot singolo `stop.effect` solo dopo registrazione atomica di `applied` nello storico durevole `sequence.outcomes`; conservare tutti gli esiti, bloccare con `pending`/`unknown` e arrestare con `not-applied`. Nuovi test del modello puro `purge-bound-sequence-model.test.mjs`: 5/5 Node 22, inclusi slot riusato dopo storico applicato, blocchi/reconciliazione degli stati incerti, stop e rifiuto di snapshot/azioni non validi. `purge-document-lab.emulator.test.mjs` + `purge-sequence-document-lab.emulator.test.mjs`: 3/3 con Firestore Emulator realmente avviato via `firebase emulators:exec --only firestore --project demo-purge-fence`, host esatto `127.0.0.1:8080` configurato dalla prova e namespace sintetici `labPurge*`; emulatore poi arrestato. Verificati due effetti atomici sullo stesso `labPurgeStates/{scopeId}`, esiti precedenti preservati, revisione/token obsoleti rifiutati senza cancellare il secondo bersaglio, replay idempotente che preserva la ricreazione, e stop dopo successo parziale che impedisce l'effetto seguente. Warning `MetadataLookupWarning` dell'SDK su metadata assente in ambiente locale non ha impedito i test. Harness resta non diagnosticato: testo di risposta mostrato troncato, senza `finish_reason`, budget distinti, stream grezzo o errori frontend; non è stato usato per implementare. `npm run test:docs` superato dopo l'aggiornamento: 31 Markdown, 607 link, 11/11 governance. Tutto è laboratorio: nessun runtime/app, Rules, Storage, retention/TTL o release; non prova completezza del piano, copertura di tutti i writer, identità/autenticazione dell'esecutore o comportamento distribuito.

## M8-READERS — adattatore isolato, 04/10/2026

Purge sequence ampliata5/5 Node22: tre successi ordinati mantengono tutti gli esiti e appliedCount3; doppio begin/completamento e indice oltre piano rifiutati. Secondo passo not-applied dopo primo successo conserva appliedCount1 e impedisce terzo. Nessun I/O o release; allApplied rappresenta solo lista fornita, non completezza globale. Riesame conferma necessità di validatore snapshot server e CAS persistente prima del wiring: WeakSet non è ripresa.

Purge sequence model3/3 Node22: piano canonico con hash ordinato, stati immutabili emessi dalla factory; stop dopo primo applied mantiene appliedCount1, unknown blocca passo successivo e resta riconciliabile dopo stop, not-applied arresta sequenza. Rifiutati stato di altra factory, hash diverso, revisione attesa errata e salto di indice. WeakSet limita stati al processo, NON verifica origine server, persistenza o attualità globale: il chiamante deve usare CAS sullo stato corrente, vecchi snapshot puri possono ancora generare rami. Nessuna delete o release; allApplied non significa purge globale completato.

Executor negativi: purge-document-lab.test.mjs1/1 Node22 con fixture senza SDK/I/O. Host diverso dall'esatto loopback previsto e project diverso rifiutati prima doc(); ricevute con effectId errato, outcome unknown o campi assenti rifiutate dopo unica lettura ricevuta, senza lettura bersaglio/delete. Ambiente del processo ripristinato in finally. Non prova provenienza server-owned, trasporto SDK o impossibilità falsificazione con accesso privilegiato; nessuna cancellazione eseguita.

Executor risposta persa/delete-prima-stop: suite1/1 Node22 ampliata. Wrapper attende commit SDK riuscito e poi solleva SIMULATED_RESPONSE_LOST_AFTER_COMMIT: simulazione al confine chiamante, NON guasto rete reale. Target assente; successiva transazione stop conserva applied e riepilogo stopped/partial true, unresolved false. Ricreato documento sintetico, replay dalla ricevuta restituisce duplicate e conserva nuovo contenuto; barriera resta exclusive. Caso ordinato opposto ora verificato, contesa della stessa esecuzione osserva ancora stop vincente. Cancellata solo versione sintetica ricostruibile, nessun dato utente o Storage.

Executor contesa: purge-document-lab.emulator1/1 ampliata Node22. Promise.allSettled avvia delete e transazione stop; osservato stop vincente, delete rifiutata PURGE_BOUND_CONFLICT, target originale conservato, nessuna ricevuta/effetto e barriera exclusive. Test contempla anche commit delete precedente allo stop con applied parziale, ma ramo non osservato qui e non dichiarato verificato. Altri scenari della suite confermati; cancellata solo versione sintetica del caso successo, poi ricreata, nessun dato utente. Non garanzia priorità assoluta, Storage o ambiente distribuito.

Executor errore server: purge-document-lab.emulator1/1 ampliata Node22. Wrapper della transazione aggiunge create di sentinella già esistente dopo callback del servizio composto; SDK restituisce6 ALREADY_EXISTS. Target originale e intero stato barriera/stop identici, ricevuta derivata da effectId assente. Non simulazione di rollback in memoria: rifiuto commit dell'emulatore. Non prova timeout/rete/esito ignoto; nessuna modifica servizio, dati utente o Rules. Altri scenari sintetici della suite confermati, incluso delete della sola versione di prova e ricreazione.

Executor purge-document-lab.emulator1/1 Node22 su demo-purge-fence/127.0.0.1:8085: tre scenari sintetici stop già registrato, versione modificata, successo+ricreazione+replay. Nei primi due bersaglio presente ed effetto nullo; successo registra stato applied/ricevuta e cancella esatta versione nella stessa transazione; retry restituisce duplicate senza toccare ricreazione. Barriera resta exclusive. Cancellata soltanto versione sintetica creata dalla prova, ricostruibile; nessun dato utente/Storage/Rules. Metodo interno, ricevuta presupposta server-owned; guardie env/projectId non certificano da sole un store iniettato arbitrario. Non provati ancora contesa stop/commit o errore server nel servizio composto. Warning metadata non fatale.

Purge atomicità documentale: purge-target-plan.emulator1/1 ampliata Node22, demo-purge-fence/127.0.0.1:8085. Transazione accoda delete versionata+ricevuta e create di sentinella già esistente: errore6 ALREADY_EXISTS, bersaglio conservato e ricevuta assente. Senza errore indotto, bersaglio assente e ricevuta applied insieme; documento ricreato con valore sintetico dopo prova. Eliminata solo versione creata dal test, ricostruibile dal test; nessun dato utente. Non prova perdita risposta, binding receipt o stop concorrente: questi non sono ancora integrati. Warning metadata SDK non fatale.

Purge target binding: suite purge-target-plan4/4 Node22. SHA256 con dominio lab dedicato lega scope, operationId, claimRevision e bersaglio canonico/versione esatta; variazioni operazione/revisione/path/updateTime/generation cambiano identità. Composto con begin del modello barriera/stop: outcome per versione differente rifiutato, pending invariato. Non prova autenticità esito, persistenza intent, completezza piano o esecuzione SDK; nessuna delete in questa prova.

Purge target SDK: purge-target-plan.emulator.test.mjs1/1 Node22, demo-purge-fence con host obbligatorio127.0.0.1:8085. Documento unico labPurgeTargets/UUID creato dal test: update dopo snapshot, delete con vecchia versione rifiutata codice9 e contenuto conservato; delete con versione corrente riuscita; ricreazione sul medesimo path, vecchia precondizione rifiutata codice9 e nuovo contenuto conservato. Piano converte snapshot→seconds/nanoseconds→Timestamp senza millisecondi. Lasciata ricreazione sintetica come evidenza; nessuna pulizia ricorsiva, users, Storage o Rules. Warning metadata SDK non fatale. Interleaving ordinato, non contesa distribuita, copertura albero o executor purge integrato.

Purge target plan3/3 Node22: solo labPurgeTargets/labPurgeObjects nello scope sintetico esplicito, output copiato/immutabile, duplicati/path estranei/array sparsi rifiutati. Generation mantenuta stringa decimale senza Number; validazione rappresentazione, NON accettazione provider. updateTime conserva seconds/nanoseconds e rifiuta sub-microsecondi nel solo piano purge da snapshot, senza normalizzarli: non decide M8-TS-01 sui dati importati. Nessuna scoperta albero, verifica riferimenti, persistenza o delete; piano non è autorizzazione.

Purge composizione pura: purge-bound-stop-model.test.mjs3/3 Node22. Claim rifiuta preparazione invalidata; transizioni legate a operationId, claimRevision e stopRevision. Stop invalida token precedente e impedisce nuovi effetti anche con token aggiornato; unknown resta irrisolto, applied resta parziale e barriera esclusiva invariata. ID effetto errato rifiutato, input preservato. Un risultato tardivo con token vecchio richiede rilettura/riconciliazione, NON significa effetto assente. Nessuna persistenza/CAS SDK, autenticazione esecutore, versione bersaglio o release; token non è autorizzazione né annulla I/O. Difetto runtime non risolto.

Purge stop puro: purge-stop-model.test.mjs3/3 Node22. Stop prima dell'avvio impedisce effetto; pending e unknown restano irrisolti nonostante stop; esito applied produce riepilogo parziale, not-applied no. ID effetto errato ed esito terminale contraddittorio rifiutati, input preservato. Modello di un solo effetto, senza I/O, persistenza, autenticazione evidenze, composizione barriera o release: stopped NON è permesso writer. Non prova cancellazione sicura o risolve KNOWN LIMIT; esiti devono provenire da esecutore/riconciliazione attendibile, non client.

Contesa barriera SDK: suite purge-fence-model.emulator1/1 ampliata. Writer e claim avviati insieme con Promise.allSettled: esattamente uno completa, stato/dato coerenti; in questa esecuzione vince writer e claim restituisce FENCE_CONFLICT. Il test contempla il claim vincente ma tale ramo non osservato in questa esecuzione. Nessuna delete: prova serializzazione del modello, NON priorità conservazione post-claim o copertura writer reali. Integrazione runtime invariata.

Purge barriera SDK: purge-fence-model.emulator.test.mjs1/1 Node22 su demo-purge-fence/127.0.0.1:8085. Preparazione, writer che aggiorna record+barriera nella stessa transazione, poi claim col token precedente: FENCE_CONFLICT, zero claim distruttivi, record restaurato conservato e revisione2 idle. Nessuna delete/Storage o Rules installata. Interleaving ordinato riproducibile, NON contesa simultanea né copertura writer reali; protocollo post-confine ancora assente. Warning SDK metadata non fatale.

Purge modello pre-distruttivo purge-fence-model.mjs/test.mjs3/3 Node22: transizioni pure idle/prepared/exclusive, writer prima della fase esclusiva invalida preparazione e token precedente, riuso stesso operationId non riabilita vecchia revisione; overflow e stato invalido rifiutati. Dopo exclusive modello rifiuta writer: NON soddisfa da solo la priorità conservazione1A, mancano richiesta di arresto e gestione effetti parziali dopo il confine. Nessuna persistenza, I/O, Rules o writer reale collegati; NON correzione KNOWN LIMIT. Transizioni richiedono stessa transazione del writer/claim e copertura di tutti i writer; nessuno sblocco automatico/TTL introdotto.

Piano originale strutturale: restore-resume-summary3/3 Node22 con bindOriginalRestorePlan. Comandi validati, indici ordinati completi/count coerente, unico backup/owner/restoreOperationId, ID chunk e percorsi record univoci; hash del piano cambia se cambiano i dati. Rifiutati piano tronco/riordinato, backup misti e duplicati. Non prova che un piano fornito sia quello originariamente scelto: autenticazione/recupero identità e persistenza restano separati, nessun nuovo registro. Funzione pura, non autorizza replay o ricostruzione arbitraria.

Riepilogo resume puro restore-resume-summary.mjs/test.mjs2/2 Node22: binding originali e snapshot ricevute forniti dal chiamante, confermati/non confermati/conflitti distinti, owner/operazione comuni e ID chunk univoci; slot mancanti e binding invalidi rifiutati. Nessuna lettura/scrittura, nessun payload nel risultato. Null significa ricevuta assente/non confermata, NON record o byte mancanti né autorizzazione retry. Non attesta origine input o completezza del piano, non scopre operazioni precedenti e non implementa ripresa persistente.

Limiti byte candidato: restore-chunk-lab8/8 Node22. Record JSON sintetico esattamente800KiB accettato, un byte oltre rifiutato; dieci record da800KiB superano7MiB aggregati e sono rifiutati senza scritture. Fixture, non dimensione richiesta SDK o documenti Firestore/index overhead. Quesito timestamp M8-TS-01 raccolto senza risposta presunta; ricercate fonti DECISIONI/BACKUP/M8_RECUPERO.

Tipizzati SDK: prima prova fallita, timestamp456ns riletto0ns. Separata caratterizzazione: timestamp456000ns conservato,456ns troncato a0; Buffer [0,127,255] conservato, Date riletta come Timestamp con istante identico. Suite integrata1/1 Node22 successiva, NON perdita precisione risolta: il validatore ammette nanosecondi non multipli di1000. Nessuna modifica semantica o formato introdotta; eventuale rifiuto/conservazione alternativa richiede contratto. Solo emulatore verificato.

Commit tipizzati/limite conteggio: suite restore-chunk-lab7/7 Node22. Timestamp senza factory rifiutato senza scritture; con factory sintetica timestamp, Buffer e Date conservano valori attesi. 400 record minimi senza stage accettati nella fixture (401 documenti inclusa ricevuta), 401 record rifiutati prima di scrivere. Non prova serializzazione timestamp SDK, dimensione massima byte/chunk, prestazioni o transazione da400 su Firestore. Nessuna patch servizio.

Errore atomico SDK: suite stage/commit ampliata1/1 Node22 exit0. Wrapper di test aggiunge alla transazione effettiva create di sentinella lab già esistente dopo accodamento record/ricevuta; Firestore emulato restituisce codice6 ALREADY_EXISTS. Record candidato e ricevuta assenti, sentinella invariata. Errore indotto ma rifiuto server/atomicità non simulati. Copre questa precondizione fallita, non perdita connessione/esito ignoto, produzione o purge. Servizio candidato invariato.

Riesame binding: Array(1) sparso accettato dall'helper, regressione fallita Missing expected exception. Corretta verifica su Array.from(stageIds), che rende espliciti gli slot assenti. Binding+commit8/8 Node22 dopo patch. Nessuna prova di bypass servizio stage o modifica app; dettaglio limiti consolidato in AUDIT.

Overwrite Firestore emulato: suite stage/commit ampliata1/1 Node22 exit0. Versione corrente effettiva SDK: prima richiesta senza overwrite produce collision senza ricevuta né cambio updateTime; stessa operazione confermata esplicitamente applica e conserva sharedWithUids/visibility correnti. Replay della prima operazione, dopo questa sovrascrittura e pubblicazione corrotta, non ripristina il vecchio stato: updateTime del record rimane quello nuovo e ricevuta iniziale invariata. Prova solo laboratorio; nessuna nuova correzione servizio. Rollback SDK dopo errore server e purge ancora non verificati.

Matrice commit lab ampliata5/5 Node22: collisione senza overwrite non scrive ricevuta; overwrite confermato con versione coerente conserva i permessi correnti anziché quelli importati; versione obsoleta lascia record invariato. Errore sintetico nell'accodamento ricevuta scarta le scritture bufferizzate della fixture. Quest'ultimo verifica propagazione errore/fixture, NON rollback SDK dopo invio al server. Nessuna patch del servizio o difetto runtime dichiarato risolto; overwrite emulato e riesame restano da completare.

Commit lab integrato Firestore/stage: suite restore-stage-lab.emulator.test.mjs ampliata1/1 Node22 exit0 (circa22s). Due commit identici concorrenti producono un applied e un duplicate; record riscritto e ricevuta presenti, permessi importati neutralizzati. Nuovo operationId con versione missing ormai obsoleta restituisce stale-preview senza ricevuta. Pubblicazione poi corrotta: replay originale ancora duplicate, backupId diverso rifiutato, updateTime di record/ricevuta invariati. Firestore SDK effettivo; Storage/verificatori sintetici. Non prova rollback per errore di commit, overwrite/collisioni completi, descriptor cancellato o purge concorrente. Nessuna modifica servizio/app in questo ampliamento.

Commit candidato restore-chunk-lab.mjs/test.mjs: 2/2 Node22 con store e mapping sintetici. Validazione comando esistente, mapping dentro tx, controllo versioni/collisioni, rewrite dell'intero chunk, preservazione autorità e scritture soltanto labCandidateRecords/labRestoreChunkReceipts; guardia projectId demo coerente col store. Ricevuta contiene binding e hash canonico del comando riscritto prima di preservare l'autorità (non digest dello stato finale persistito). Prove primo commit, permessi importati neutralizzati, replay senza seconda lettura stage, backupId diverso rifiutato, owner/conferma/percorso non mappato rifiutati senza scritture. Fixture bufferizza scritture ma non implementa CAS/retry: verifica Firestore reale del nuovo servizio e matrice versioni/collisioni/rollback ancora aperte. API interna, non endpoint autenticato; nessun audit/preview completo, integrazione app, purge o resume globale dichiarato.

Ricevuta candidata: suite restore-chunk-binding3/3 Node22 dopo aggiunta verifyStagedChunkReceipt. Verifica tutti i campi del binding, stato applied/duplicate false e forma rewriteHash; restituisce soltanto stato/duplicate/conteggio. Alterazione di ciascun campo, binding incompleto, digest assente/invalido e diverso elenco stage rifiutati. Helper puro senza letture stage: non prova ancora replay persistito né origine server della ricevuta, che il futuro servizio deve garantire. Digest riscrittura ancora da calcolare nel commit, non attestato dalla sola forma.

Prerequisito commit: restore-chunk-binding.mjs/test.mjs aggiunti nel laboratorio, 2/2 Node22. Hash dedicato lab-staged-restore-chunk include binding comando originale, owner, restoreOperationId distinto da chunkOperationId e lista stage ordinata; rifiuta ID malformati/duplicati/oltre100. Prove variazioni comando e identità, ordine stage equivalente. API interna richiede comando già validato: non sostituisce validateRestoreChunk, non autentica ricevute e non scrive record. Commit/ricevuta e digest della riscrittura server ancora da implementare.

Mapping concorrente Firestore emulato: stessa suite ampliata1/1 Node22 exit0. Due transazioni lanciate insieme leggono lo stesso record candidato, rivalidano mapping dentro ciascun callback e incrementano il contatore: valore finale2, percorso pubblicato conservato, tre documenti stage invariati. Osservati3 callback per2 commit, quindi un retry effettivo SDK in questa esecuzione (non imposto dal test). Non è prova di mutazione concorrente del descriptor, purge o Storage reale; solo contesa sul record lab. Nessuna patch runtime.

Mapping su Firestore emulato: suite restore-stage-lab.emulator.test.mjs ampliata, 1/1 Node22 exit0 su demo-m8-stage/127.0.0.1:8085. resolveMappingInTransaction legge gli stage nella transazione che crea un record labCandidateRecords; percorso scritto uguale alla pubblicazione. Pubblicazione successivamente corrotta rifiuta una seconda transazione e il relativo record non esiste. Verificati uso SDK e rifiuto prima della scrittura, NON conflitto concorrente/retry del nuovo mapping. Storage/verificatori sintetici; warning SDK MetadataLookupWarning non fatale. Nessuna scrittura users, attivazione app o soluzione purge.

Mapping nella transazione chiamante: resolveMappingInTransaction aggiunto, resolveMapping resta wrapper di sola lettura. Suite restore-stage-lab.test.mjs19/19 Node22. Nuova prova legge mapping e prepara scrittura nello stesso tx, muta descriptor nella fixture prima del commit e verifica read conflict senza documento candidato né scritture aggiuntive. Store sintetico senza retry: non prova Firestore concorrente, commit chunk completo o coordinamento purge. Nessuna modifica app o Rules.

Mapping conflittuale: suite laboratorio18/18 Node22. Due stage distinti della stessa operazione/sorgente, con byte/digest diversi ed entrambi pubblicati, rifiutati da resolveMapping in entrambi gli ordini senza scritture. Nessuna scelta implicita del primo/ultimo. Prova sintetica, runtime invariato.

Mapping candidato: resolveMapping legge i tre documenti per stage in una transazione di sola lettura, verifica owner/operazione/pubblicazione e rifiuta sorgenti duplicate; limite locale100 stage. Suite laboratorio17/17: rewriteStorageData reale→classificatore→read stage restituisce byte attesi; stage non pubblicato, owner/operazione diversi, ID ripetuti e descriptor mancante rifiutati senza scritture. Store sintetico. È snapshot attestato, NON autorizzazione riutilizzabile per un commit successivo: chunk futuro deve rivalidare atomicamente e coordinarsi col purge. Nessuna integrazione app.

Auth emulato: restore-stage-download.auth-emulator.test.mjs 1/1 Node22 con FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099, progetto demo-vault-shell. Token anonimo sintetico verificato con Admin verifyIdToken reale, UID corretto ricevuto da read; token malformato e App Check sintetico errato rifiutati prima di read. HTTP effettivo; read/Storage e App Check restano sintetici. Primo tentativo fallito nel teardown perché deleteApp precedeva deleteUser, processo rimasto aperto interrotto; corretto ordine in unico hook, seconda prova conclusa exit0. Account anonimo della seconda prova eliminato; uno della prima può restare nell'emulatore, nessuna pulizia indiscriminata effettuata. Nessun dato produzione o token stampato.

Consolidamento: sette suite mirate eseguite insieme, 75/75 Node22 (protected-session, restore-stage-reader/client/download/lab, attachment-read-route/export-plan). Nuova prova core sessione→signal vista→client fetch sintetico: lock abortisce fetch pendente. Suite sessione ora 33/33 inclusa nel totale. Non sommare ai conteggi precedenti; non prova browser o Firebase reale.

Client AbortSignal aggiunto e verificato: 6/6 Node22. HTTP reale restituisce un byte dei due dichiarati e resta aperto; test attende la seconda read effettiva prima di abortire. Promise rifiutata, socket server chiuso, successivo uso dello stesso signal rifiutato. Nessun timeout applicativo o polling introdotto. Il chiamante deve collegare signal alla revoca della vista; isActive da solo resta controllo post-attesa. Attesa getCredentials non interrompibile automaticamente; controllo prima di fetch impedisce invio dopo abort. Nessuna attivazione browser.

Client riesame e integrazione: suite client 5/5 con revoca durante read pendente (chunk consegnato azzerato, cancel/release eseguiti) e stream troncato rifiutato/azzerato. Suite laboratorio ancora 16/16, ampliato scenario HTTP con fetch Node effettivo→handler→read stage: byte e generazione pubblicata corretti attraverso il client. Storage/verificatori sintetici, nessun browser/CORS reale. Revoca è controllata al completamento delle attese, non cancella immediatamente una read che non si risolve; non dichiarare tale garanzia.

Client candidato restore-stage-client.mjs/test.mjs: prime 3/3 Node22 con fetch/ReadableStream sintetici. Origin loopback esplicitamente uguale, redirect error, cookie omessi, credenziali iniettate; limite streaming contro Content-Length, metadati generation stringa, cancellazione stream su errore e azzeramento chunk consumati. Verificati successo, eccesso byte, revoca e risposta redirect. Non prova HTTP client-server integrato, digest locale, revoca durante read già pendente o disponibilità same-origin nel browser; autenticazione Firebase e CORS non configurati. Buffer interni del browser non azzerabili da questo adattatore. Candidato da riesaminare, non accettato completo.

Disconnessione HTTP locale effettiva: restore-stage-download.test.mjs 6/6 Node22. Socket client distrutto dopo avvio read, attesa close sul server e successiva risoluzione read: buffer tardivo azzerato; server effimero e connessioni chiusi nel teardown. Verificatori/read sintetici, ma interruzione socket non simulata. Copre questo punto d'interruzione, non l'intera matrice rete lenta/trasferimento parziale/Edge o Firebase reale. Nessuna patch runtime.

Download matrice ampliata: restore-stage-download.test.mjs 5/5 Node22. Richieste sintetiche con metodo errato, body dichiarato/chunked, stageId invalido, generation client, host/remoto non loopback rifiutate prima di verificatori/read. Buffer intatto dopo end prima dell'evento finale, azzerato su finish/close/error anche ripetuti; metadati generation invalidi producono 500 e azzeramento. Eventi/framing simulati: non prova raw TCP malformato o disconnessione di rete reale. Nessuna patch runtime aggiuntiva.

HTTP→servizio stage integrato nella fixture: restore-stage-lab.test.mjs 16/16 Node22. Dopo pubblicazione e aggiunta di versione successiva, download HTTP restituisce byte e generation1 pubblicati; UID diverso dal verificatore rifiutato prima di Storage. Generazione1 rimossa nella fixture: errore senza fallback alla versione successiva, nessuna scrittura metadati. Verificatori, store e Storage sintetici; HTTP loopback effettivo con server effimero chiuso. Non verifica Firebase Auth/App Check reali o concorrenza distribuita.

Riesame download: errore del servizio con status=200 veniva riflesso come successo HTTP. Regressione prima rossa (200 anziché 400), poi 3/3 dopo selezione dello status esclusivamente interna all'handler; dettagli provider sempre omessi. Correzione del solo candidato, non endpoint produzione. Matrice body/metodo/owner e integrazione servizio ancora da completare.

Download HTTP candidato: restore-stage-download.mjs/test.mjs, 2/2 Node22. Server loopback effimero chiuso a fine test, verificatori/read sintetici: risposta binaria intatta, generazione stringa oltre MAX_SAFE_INTEGER, no-store e buffer server azzerato dopo finish; token/App Check errati, UID client e query rifiutati senza ulteriori read. Evento close simulato durante read pendente: risultato tardivo azzerato senza invio. Non ancora collegato a read del servizio stage, verificatori Firebase reali o browser; body/metodo/owner incrociati e disconnessione TCP effettiva da ampliare. Nessun listener persistente/export produzione, Rules o manifest modificati.

Sessione candidata effettiva: protected-session.test.mjs 32/32 Node22. Nuova prova collega isActive del lettore a assertUnlocked della vista catturata; blocco, sblocco dello stesso owner e nuova navigazione non riabilitano la risposta pendente della vecchia vista, i cui byte vengono azzerati. Nuova vista valida, vecchio lettore rifiutato anche al successivo uso. Core sessione/router/Vault reali del laboratorio; admission, chiave e trasporto sintetici. Nessun browser/Firebase reale o modifica sessione runtime.

Riesame output parziale esistente: tests/backup-export-session.test.mjs 20/20 Node22 dopo aggiunta scenario errore sink durante allegato. Servizio export attuale eseguito in VM con dipendenze sintetiche: abort una volta, nessuna close/Recovery Key, buffer allegato azzerato e observer rimossi. È copertura del comportamento già presente, non difetto corretto né prova filesystem/Edge; candidato lettori non ancora collegato al servizio. Nessuna patch runtime.

Raccordo crittografico: attachment-export-plan.test.mjs 6/6 Node22. Consumo candidato con collector e backup-crypto.js invariati, lettori sintetici: due allegati unici cifrati/riaperti con percorsi e contenuto identici, buffer letti azzerati; catena senza footer rifiutata, completa accettata. Prova in RAM senza file/sink o browser: non verifica abort dell'output parziale, trasporto autenticato, export app completo o compatibilità dispositivi. Nessuna modifica crittografica/runtime.

Consumo sequenziale del piano aggiunto nello stesso candidato: attachment-export-plan.test.mjs 5/5 Node22. Test con collector reale e lettori/append sintetici: due percorsi unici, scelta lettore stage/legacy, buffer azzerati dopo append; revoca dopo lettura impedisce append, errore append interrompe successive letture e azzera buffer. isActive deve vincolare un'epoca immutabile; append prende in prestito i byte fino alla risoluzione. Cifratura, serializzazione, abort output parziale e trasporto autenticato restano responsabilità da integrare/provare, non coperti da queste fixture. Nessuna modifica export app.

attachment-export-plan.test.mjs: 3/3 Node22, usa sorgente invariata collectStoragePaths effettiva iniettata nel candidato. Duplicati annidati producono una voce per percorso, distinguendo stageId e legacy; input immutato, piano congelato, owner/percorso riservato invalidi rifiutati. Primo avvio fallito per import browser ESM sotto package CommonJS: risolto solo caricamento test via data URL e dipendenza esplicita, senza manifest modificato. Non esegue export/cifratura/download: pianifica soltanto. Non gestisce binding generation client discordanti perché non ne accetta come autorità; generazione resta risolta dal servizio. Eventuali futuri campi binding richiederanno validazione prima della dedup, non vanno ignorati tramite questo piano.

Composizione dispatcher→lettore→servizio verificata nella suite laboratorio 15/15 Node22: lettura pubblicata riuscita, poi generazione pubblicata rimossa dalla fixture mentre una versione più recente resta presente; lettura rifiutata senza chiamate legacy né scritture. Store/Storage sintetici, non cancellazione reale o prova CAS. Test sessione usa ora segnale esplicito e timeout anziché polling non limitato. Nessuna patch runtime o collegamento app in questo controllo.

attachment-read-route.test.mjs: 4/4 Node22 sintetici. Classificatore candidato separa users/uid/restoreObjects/stageId dal percorso legacy; namespace riservato malformato, owner diverso e percorsi ambigui rifiutati prima del trasporto. Errore del lettore pubblicato propagato senza invocare legacy/latest. Dispatcher senza autorizzazione propria: trasporti devono autenticare owner e applicare controlli sessione. Nessun nuovo campo nei record/backup, nessun collegamento ai consumatori produzione. Dedup export e trasporto legacy concreto ancora mancanti.

Prova integrata aggiunta a restore-stage-lab.test.mjs: suite 14/14 Node22. Il lettore chiama il servizio laboratorio reale (store/Storage sintetici) dopo claim/upload/pubblicazione; con una nuova generazione presente legge ancora quella pubblicata. Risposta ritardata e nuova epoca di sessione: consegna rifiutata, byte azzerati, successiva lettura dalla vecchia istanza rifiutata prima del download. Epoca simulata tramite Symbol, non sessione app reale; nessun nuovo endpoint di lettura HTTP o test Edge. Nessuna patch runtime necessaria in questa prova.

restore-stage-reader.test.mjs con Node22: 4/4 prove sintetiche. Coperti comando con solo stageId e generazione oltre MAX_SAFE_INTEGER conservata come stringa; revoca durante attesa con byte azzerati; dispose irreversibile durante trasporto; ID invalido senza chiamata e risposta malformata azzerata senza fallback. Trasporto e isActive iniettati: non prova connessione al servizio, autenticazione reale, integrità digest client o sessione app. Il contratto richiede isActive legato alla stessa epoca immutabile e dispose alla revoca; un semplice flag globale che torna true non basta. Nessuna modifica ai lettori produzione o al formato backup.

## M8-LAB-01 — candidato isolato, 04/10/2026

Riesame reclaim pubblicato: test dimostra ricreazione impropria di descriptor mancante (attesa rejection assente); corretto claim revision3 con verifica replay transazionale anziché prepareStage. Suite 13/13 dopo correzione. Il caso riguarda incoerenza dei metadati: nessuna attestazione di riparazione automatica o coordinamento cleanup.

Riesame buffer: nuovo test oversize prima rosso (due listener drain invece di uno), poi verde con drain idempotente tramite WeakSet; suite 12/12 inclusiva. Verificati byte raccolti/eccedenti/drenati azzerati e listener rimossi su end, nessuna save. Prova EventEmitter sintetica, non attestazione esaustiva delle disconnessioni TCP.

Prova Firestore effettivo: restore-stage-lab.emulator.test.mjs, Node22, FIRESTORE_EMULATOR_HOST=127.0.0.1:8085, progetto separato demo-m8-stage e UID sintetico univoco, 1/1 superata. Due pubblicazioni concorrenti: una applicata, una replay. Nuova factory dopo risposta considerata persa: replay senza variazioni di dati/updateTime dei tre documenti; expectedRevision errata rifiutata; read con generazione stringa oltre MAX_SAFE_INTEGER superata; destinazione corrotta rifiutata da publish/read senza ulteriori modifiche. Storage e verificatori iniettati sintetici. SDK ha emesso MetadataLookupWarning; suite conclusa con exit0. Nessun reset emulatore, Rules modificate o server persistente; non prova CAS Storage reale né integrazione app.

Estensione successiva: 11/11 inclusivi dei precedenti otto. Aggiunti generazione cambiata con retry rifiutato e piano immutato; errore iniettato dopo save Storage prima di markVerified con recupero senza seconda save; stream sintetico interrotto con verifica azzeramento dei chunk trattenuti e stato ancora prepared. Quest'ultima usa EventEmitter, non prova disconnessione TCP reale. Nessuna correzione runtime aggiuntiva né attestazione CAS distribuita.

Factory e suite in experiments/persistent-vault-shell/restore-stage-lab.mjs e restore-stage-lab.test.mjs, adattate dopo riesame della proposta Harness. Node22: 8/8 prove con helper backup-attachment-stage reale, store/bucket/verifier sintetici e HTTP effettivo su loopback effimero. Coperti ciclo claim/upload/publish/read con generazione fissata, replay senza nuova save, replay pubblicato dopo sette giorni, owner/path invalidi, ripresa fra piano e descriptor con nuova factory, expiry invalida, digest piano e readerContract corrotti, auth/metodo/query/content-type/oversize streaming e byte errati. Verificata assenza riferimenti nel production index e runner locale Functions. Primo giro 7/8 per ECONNRESET nella fixture HTTP; corretti GET senza corpo e connessione indipendente, secondo 8/8.

Non dimostra concorrenza Firestore reale, precondizioni Storage reali, App Check Firebase effettivo, interruzioni/azzeramento buffer esaustivi, coordinamento purge/cleanup o integrazione lettori/client app. Nessun server persistente avviato. Bundle ancora da completare e riesaminare, non gate M8 chiuso.

04/10/2026 — WIDGET-RECEIPT-01 Firestore emulato Node22 su 127.0.0.1:8085, progetto isolato demo-widget-receipt: 1/1 con ciclo create/update preserva bankId/update null/delete in privato e azienda. Verificati replay senza variazioni, payload/revisione diversi rifiutati, Account diverso con widget assente rifiutato, legacy-only senza nuove root/widget, nessuna ricevuta legacy nuova o payload nella root. Eliminati solo widget sintetici creati dalla prova; Account/ricevute sintetici conservati. Handler estratto in VM, transazioni Firestore reali emulate, non HTTP/App Check/UI. Client letto: usa risposta callable, non ricevute legacy; nuova invocazione genera nuovo operationId, limite retry UI distinto. Diff --check senza errori, avvisi CRLF preesistenti.

04/10/2026 — WIDGET-RECEIPT-01 regressione Node22 backend non-emulatore 380/380. Nuovi test modulo verificano comando completo/owner, bankId omission-null, corruzione di ogni campo binding, risultato proiettato, revisioni e accessor senza invocazione. Handler privato/azienda verifica replay root prevalente su legacy, collisioni titolo/bankId/widget senza scritture e Account assente not-found. Primo 379/380 dovuto a deepStrictEqual fra prototipi VM e clone locale: confrontati snapshot entrambi structuredClone, nessuna protezione runtime cambiata. Non ancora Firestore emulato widget o HTTP.

04/10/2026 — WIDGET-RECEIPT-01 prima integrazione: test legacy con stesso op/widget/action ma titolo modificato fallisce per mancato rifiuto prima della patch. Dopo binding completo e root separata, 13/13 account-widget-service + account-widget-bank-handler su Node22. Vecchio retry legacy positivo sostituito da negativo legacy e positivo root attestato; mantenute prove omission/null bankId. Non ancora matrice completa ricevute, regressione o Firestore emulato; nessuna accettazione complessiva.

04/10/2026 — WIDGET-RECEIPT-01 limite numerico: nuovo test update/delete fallisce prima della patch per mancato rifiuto MAX_SAFE_INTEGER. Validatore ora richiede safeInteger >=1 e <MAX_SAFE_INTEGER; ultimo incremento rappresentabile verificato. Suite account-widget-service Node22 7/7, incluse semantiche bankId esistenti. Non prova binding ricevute, HTTP o runtime browser: quel difetto resta aperto. Analisi Harness valutata criticamente, nessuna migrazione ricevute ancora applicata.

04/10/2026 — shared-receipt-boundary.emulator 1/1, Node22, progetto demo-shared-receipt-rules su 127.0.0.1:8085 con Rules base lette senza modificarle. Owner può leggere ricevuta sintetica; create/update/delete client negati, read altro UID/anonimo negato, valore preservato. Non sostituite Rules del laboratorio browser. Client condiviso verificato staticamente: consuma risposta callable, nessuna lettura operationResults trovata nella ricerca frontend; ogni nuova invocazione genera operationId nuovo, distinto da replay backend dello stesso comando.

04/10/2026 — shared-unlink.emulator esteso al ciclo reale emulato create/update/link/unlink/delete e legacy-only: 1/1 inclusivo dei quattro scenari precedenti. Ogni azione verifica revisione, root receipt senza payload, assenza nuova legacy, replay immutabile e rifiuto comando variato. Cancellati soltanto record/link/widget sintetici della prova; Account sintetico conservato. Non HTTP/App Check/Rules client o concorrenza distribuita. Riesame helper rifiuta anche revisione null non-create (validatore runtime già la negava), test modulo 3/3; diff --check senza errori.

04/10/2026 — ricevute shared-vault: 9/9 mirati modulo+handler sintetico, inclusi rifiuto comando diverso con stessa operazione, legacy-only/root non attestata, replay identico e root valida prevalente senza variazioni. Regressione Node22 backend non-emulator 374/374. Primo run 373/374 per dipendenza nuova non iniettata nella fixture VM mutation-owner-handler; aggiunta dipendenza reale, protezioni non indebolite. Restano altre azioni in matrice emulata e riesame finale.

04/10/2026 — SHARED-RECEIPT-01 implementazione iniziale: digest copre intero comando normalizzato e owner/domain/versione; test cambi title/valueEnc/link.order, canonicalizzazione rigorosa senza getter, risultato esatto/overflow. Modulo+unlink 7/7; unlink Firestore emulato 1/1 aggiornato al root delle ricevute. Test collisioni/legacy e tutte le azioni ancora da completare: non accettazione globale del bundle. Nessun payload salvato nella nuova ricevuta oltre digest e metadati di identità/esito.

04/10/2026 — SHARED-UNLINK-01: 9/9 unitari mirati, inclusi omonimi in aziende diverse e input malformati/immutabili. `shared-unlink.emulator.test.js` Node22, Firestore 127.0.0.1:8085, progetto demo-shared-unlink: 1/1 con quattro scenari. Transazioni reali emulatore, handler estratto in VM e auth sintetica (non HTTP/App Check); coppia incoerente rifiutata senza variazioni, coppia valida orfana scollegata, dati condivisi/altri riferimenti preservati, replay identico non riscrive. Cancellati soltanto link/widget sintetici creati da questa prova; nessuna produzione. Binding replay a comando diverso rimane aperto.

04/10/2026 — SHARED-UNLINK-01: nuovo test handler con dipendenze sintetiche inizialmente fallisce per mancato rifiuto di link.widgetId diverso; dopo controllo coppia/Account completo passa. Suite shared-unlink-handler + shared-vault-service 7/7: mismatch reciproci, embedded, namespace e Account diversi senza scritture; unlink valido con Account assente preserva dati condivisi e riferimento altro Account. Proposta Harness adattata mantenendo lettura Account reale (non richiedendone esistenza) e export esistenti. Non prova HTTP/emulata, receipt replay invariata e da riesaminare.

04/10/2026 — regressione dopo preflight: Node22, tutti i file functions/test terminanti .test.js esclusi .emulator., 365/365 senza skip. Comprende prove con dipendenze sintetiche e caratterizzazioni di difetti aperti; non è esecuzione completa HTTP/browser né chiusura PURGE-CAS.

04/10/2026 — riesame PURGE-COORDINATION-03: suite preflight Firestore emulata ampliata a dieci scenari, sempre 1/1. Controlli positivi fresh/resume con riferimento aziendale omonimo al target privato superano il preflight e raggiungono getStorage sostituito da stop intenzionale; receipt processing verificata, resume senza variazioni receipt, dati preservati, recursiveDelete mai invocato. Ciò verifica anche il collegamento del blocco distruttivo usato dalle prove negative. Aggiunti casi misti fra due collezioni negli unitari: 15/15 nelle due suite servizio/cleanup. Nessuna prova Storage reale né risoluzione concorrenza; conteggi non sommabili come collaudo globale.

04/10/2026 — preflight riferimenti esterni verificato anche con transazioni Firestore emulato reali: `functions/test/purge-external-preflight.emulator.test.js`, Node22, FIRESTORE_EMULATOR_HOST=127.0.0.1:8085, progetto isolato demo-purge-preflight, 1/1 con otto combinazioni (privato/azienda × widget/link × fresh/resume senza Account). Stato prima/dopo identico, reason verificato, zero accessi Storage o recursiveDelete (trasporti deliberatamente bloccati). Handler estratto dal sorgente, non HTTP/App Check né test Storage reale. Primo tentativo fallito per Promise proveniente dal contesto VM nella fixture: adattata callback async del test, nessuna correzione runtime. Nessuna cancellazione/Rules installate; soltanto fixture sintetiche con UID univoci. Gara successiva al preflight ancora aperta.

04/10/2026 — PURGE-COORDINATION-02: controllo conservativo riferimenti esterni integrato in purge. Eseguiti `node --test functions/test/archive-purge-service.test.js functions/test/purge-profile-cleanup-handler.test.js functions/test/archive-receipt-handler.test.js functions/test/archive-owner-handler.test.js`: 32/32. Nuove prove identità/namespace e handler con dipendenze sintetiche: target o record ambiguo in ciascuna collezione rifiuta fresh/resume senza variazioni stato né recursiveDelete; Storage non raggiunto. Non prova SDK/HTTP o CAS. Il test KNOWN LIMIT passa perché riproduce ancora perdita del record concorrente: non è correttezza del purge. Proposta Harness adattata ai moduli reali e corretta nelle aspettative contraddittorie. Rules/manifest/produzione invariati.

04/10/2026 — verifica accesso Chrome locale: root 127.0.0.1:4188 mostra pagina laboratorio con login e sblocco disabilitato prima accesso. Navigazione ?privateGate=1 fallisce ERR_BLOCKED_BY_CLIENT. Non eseguiti login/unlock né test funzionali aggiuntivi: RAM14 rimane non collaudato in UI. Nessuna protezione aggirata o configurazione residente sostituita.

04/10/2026 — riesame compositore 5/5: rifiutate condizioni con OR true, riga commentata, owner alterato, lista aggiuntiva e collisione segnaposto; verificato per posizione che l'unione contenga ogni campo protetto dai tre rami reali. Include regressione doppia negazione precedente. Nessuna nuova modifica runtime o prova SDK in questo passaggio; ultimo SDK 11/11. Non è un parser generale di Rules né un controllo di ogni possibile mutazione della base.

04/10/2026 — RULES-INTEGRATION-03: test mutazione dimostra accettazione indebita di !!request nel compositore candidato appena introdotto. Guardia ora riconosce intera riga allow create/update owner, singola negazione e chiusura immediata con punto e virgola; test prima rosso poi verde. Composizione 4/4 e SDK integrato 11/11 dopo fix, Harness riesaminato. Nessuna doppia negazione trovata nelle Rules effettive: difetto di robustezza del compositore, non bypass osservato in produzione. Restano ulteriori mutazioni suggerite e collaudo browser.

04/10/2026 — SDK configurazione comune 11/11 (10 sottoprove + contenitore, inclusivi). Aggiunti handler QR privato e aziendale con salvataggio/replay, verifica selezioni e conservazione profilo/contatti/indirizzi/note; scritture dirette QR negate. Prima run fallita per deepEqual tra Timestamp Admin e client nella verifica profilo immutato; usato stesso SDK ai due lati, poi superata. La matrice ora esercita percorsi mirati dei tredici handler Account/profilo; non tutti i rami, né HTTP/App Check reale, UI, purge o migrazioni. Progetto demo separato, produzione invariata.

04/10/2026 — SDK integrato 10/10 (9 sottoprove + contenitore, inclusivi): handler contatti privati/azienda creano email sintetica e confermano replay. Note e indirizzi preservati; per azienda conservate sede, filiali e PEC precedente. Sostituzione client contactEmails/emails negata. Cifratura fixture sintetica, contesto trusted iniettato, nessuna prova HTTP/UI; non estendere questo scenario create a tutti i casi update/delete dei contatti.

04/10/2026 — SDK integrato 9/9 (8 sottoprove + contenitore, inclusivi): company-addresses-handler aggiorna sede e città filiale, replay confermato, seconda richiesta sulla revisione precedente rifiutata REVISION_CONFLICT. Preservati PEC, QR, nota, civico e proprietà sconosciuta; client non può modificare indirizzoSede o azzerare altreSedi. Namespace demo separato loopback, nessuna prova HTTP/UI o produzione.

04/10/2026 — SDK integrato 8/8 (7 sottoprove + contenitore, inclusivi): handler indirizzi privati aggiorna città conservando utenze; handler utenze modifica valore e conserva città appena salvata, proprietà sconosciuta indirizzo, password legacy e nota profilo. Replay di entrambi confermato e azzeramento client indirizzi negato. Sequenza locale controllata, fixture cifratura sintetica, nessuna prova race simultanea/HTTP/UI o dato reale.

04/10/2026 — SDK composizione integrata 7/7 (6 sottoprove + contenitore, inclusivi): private-documents-handler aggiorna numero documento con replay, conserva nota profilo e proprietà sconosciuta documento. Scrittura client documenti=[] negata. Metadato allegato sintetico presente causa HAS_ATTACHMENTS: profilo invariato e nessuna ricevuta di cancellazione creata. Non caricato oggetto Storage, non prova trasporto allegati/cifratura reale/UI; fixture encrypt e trusted context sintetici.

04/10/2026 — suite SDK integrata 6/6 ampliata con profile-account-create-handler privato/azienda: verifica record creato, collegamento profilo, backlink, replay e revisione backlink ferma a 1, mantenimento password legacy quando transferLegacyPassword=false; update client nome vietato. Primo run rosso PROFILE_LINK_SOURCE_UNSUPPORTED per fixture PEC con address al posto di email, corretta rappresentazione persistita del seed, nessuna correzione runtime. Byte/formato sintetici e contesto trusted iniettato; non verifica crittografia, HTTP o browser.

04/10/2026 — configurazione integrata SDK 6/6 (5 sottoprove + contenitore, inclusivi): profile-link-handler effettivo collega telefono privato e telefono aziendale allo stesso Account aziendale. Replay confermato; riletture client verificano entrambi i riferimenti inversi e quelli sul profilo; nomeAccount/URL/nota precedenti preservati. Azzeramento diretto client dei due backlink negato. Seed e trusted context sintetici, Firestore loopback separato; nessuna prova HTTP, UI, unlink o trasferimento concorrente con purge.

04/10/2026 — note Account con configurazione integrata: handler reale Admin emulato salva nota e conferma replay nei due domini, preserva nomeAccount/URL e incrementa revisione di uno. Handler standard rifiuta REVISION_CONFLICT per richiesta preparata prima del salvataggio nota; aggiornamento diretto client della nota negato. Suite ancora 5/5, scenari inclusi/ampliati e non conteggio additivo. Ordine controllato sequenziale, non interleaving simultaneo; HTTP/App Check/browser non coperti.

04/10/2026 — configurazione integrata: firebase-browser-rule-composition 5/5 (4 sottoprove + contenitore), include handler testo profilo effettivo su Firestore emulato per privato e azienda. Confermati salvataggio/rilettura, replay, REVISION_CONFLICT su seconda richiesta obsoleta (sequenziale, non prova di interleaving simultaneo), mantenimento campo estraneo; negate modifica diretta note, rimozione campo e sostituzione completa. Contesto trusted e cifratura fixture sintetici, nessuna attestazione App Check/HTTP/browser; conteggio inclusivo dei precedenti 4/4.

04/10/2026 — seguito configurazione integrata SDK: privato e azienda rifiutano set sostitutivo senza campo protetto, deleteField(nomeAccount), deleteDoc(Account), batch di modifica URL protetto insieme a campo di controllo consentito. Rilettura verifica Account invariato e mancato commit della scrittura di controllo nel batch negato. Suite firebase-browser-rule-composition 4/4 con scenari ampliati; non nuovi quattro test sommabili. Solo emulatore nel namespace sintetico separato, nessun nuovo difetto runtime né garanzia sul protocollo Admin purge.

04/10/2026 — seguito RULES-INTEGRATION-02: SDK 4/4 con scenari estesi al createAccountStandardHandler effettivo, Admin Firestore emulato demo-browser-rules-check. Privato/azienda: scrittura URL confermata, replay identico, rilettura client conferma revisione e conserva nomeAccount; mancanza app context rifiutata. Contesto trusted sintetico, non verifica HTTP/App Check reale; Admin bypassa Rules per definizione. Primo run fallito ACCOUNT_STANDARD_INVALID perché il seed precedente per sole Rules conteneva nomeAccount in chiaro; sostituito con byte sintetici in formato accettato (non prova crittografica), poi superato. UID unico per run evita collisioni ricevute senza cancellare dati del laboratorio aperto.

04/10/2026 — RULES-INTEGRATION-02: unione conservativa delle otto deny-list generate dai tre rami candidati, struttura identica obbligatoria e sole liste negate di campi semplici. Harness riesaminato; adattata proposta incompleta al formato reale. Composizione 4/4 con rifiuto struttura divergente, contesto positivo e campo anomalo. SDK Firestore loopback progetto separato: 3 sottoprove + contenitore = 4/4, inclusivi dei precedenti 20 tentativi standard negati; aggiunti otto update negati su metadati privati e campi/metadati aziendali, con update non protetti consentiti. Non certifica ogni campo/servizio né PURGE; configurazione del browser aperto non ricaricata. Rules base, manifest e produzione non modificati.

04/10/2026 — RULES-INTEGRATION-01 SDK reale Firestore emulato, Node22: firebase-browser-rule-composition.test.mjs supera 2 sottoprove + contenitore = 3/3. Progetto sintetico separato demo-browser-rules-check, host 127.0.0.1:8085; eseguita l'espressione Rules del caricatore browser. Per entrambi i domini: cinque create e cinque update standard negate (20 complessive), create/update campi non protetti consentite come controllo non vacuo, lettura owner consentita/altro UID negata, originale preservato. Ripetuta dopo aggiunta del controllo positivo update. Nessun test browser/App Check reale, nessuna modifica Rules residenti di demo-vault-shell; protezione globale degli altri campi e purge non certificata.

04/10/2026 — RULES-INTEGRATION-01: sostituito nel loader browser il compositore note con standard, che conserva note/link e aggiunge cinque campi Account. `candidate-rule-composition.test.mjs` 3/3, inclusa esecuzione in VM dell'espressione effettiva del loader e verifica quattro liste protette. Primo tentativo fallito per JSON.parse sulle liste Rules a quote singole, poi filtro del test corretto. Sono prove statiche/composizione: nessuna nuova prova SDK/browser, Rules residenti non ricaricate. Harness consultato senza strumenti; Rules base/manifest invariati. Restano composizione complessiva e M8/PURGE aperti.

04/10/2026 — RAM14 regressione rosso/verde: callback signIn reale estratta dall'entry ed eseguita in VM, revoca activationEpoch durante promessa Auth pendente; prima avviava comunque il gate, dopo correzione rifiuta AUTH_CHANGED senza attivarlo. Runner 15/15. È prova sintetica della continuazione, non prova browser né annullamento della richiesta Auth già inoltrata.

04/10/2026 — RAM14 integrazione opt-in privateGate=1: sintassi entry valida, build locale realFunctions riuscita, 811/811 regressioni. Tentativo browser NON eseguito fino alla UI: scheda precedente non esiste, nuova apertura Chrome rifiutata dal client ERR_BLOCKED_BY_CLIENT. Nessun accesso/sblocco/logout del nuovo percorso certificato. Gate sorgente pubblico non modificato; asset copiato nel solo dist laboratorio.

04/10/2026 — estensione RAM13 con SDK Auth/Firestore locale e dati sintetici: aggiunte prove throw null iniziale, throw undefined a sessione aperta, dispose rientrante da onState durante lock. Verificati revoca contesto prima della segnalazione, timer rimossi, dispose singola, nessun nuovo begin e unlock rifiutato. Nessuna prova browser nuova; admission rimane fixture esplicita. Non si dichiara esaustività delle rientranze arbitrarie.

04/10/2026 — RAM13 wrapper condiviso: SDK Firebase effettivo contro Auth 9099 / Firestore 8085 demo-vault-shell, 17 sottoprove più contenitore 18/18. Aggiunta asserzione un solo beginIdentity iniziale nonostante callback SDK e un solo begin per B; login/unlock, isolamento, logout/dispose conservati. Admission/presentation di questa suite sono fixture dichiarate, non gate pubblico integrato. Suite laboratorio 811/811. Nuovi rami errore/rientranza observer ancora da collaudare specificamente; browser non ricostruito dopo patch.

04/10/2026 — RAM12: browser-session-boundary 38/38. Quattro nuove prove caricano il sorgente effettivo private-auth-gate.js in VM con DOM/storage/timer sintetici: revoca ticket e block terminale, A/B/A e identità non verificata, dispose rientrante nella seconda lettura, begin obsoleto throwing senza cancellare il successore e invalidazione dentro active. Adattatore candidato non ancora collegato al pubblico. Non prova browser, timer reale, Rules o autorizzazione dati. La revoca dell'adattatore invalida ticket; il blocco fisico resta responsabilità della sessione.

## 04/10/2026 — teardown admission fallibile

Verificato dispose con invalidate e dispose admission che lanciano: memory Vault non più sbloccato, cleanup Vault e unsubscribe entrambi tentati, sessione definitivamente chiusa e seconda dispose idempotente. 31/31 sessione. Primo tentativo del nuovo test fallito per chiamata fixture a metodo memory-vault.dispose inesistente; corretta fixture, nessuna correzione runtime attribuita a quel fallimento. Build realFunctions riuscita con auth-unavailable; non eseguito nuovo collaudo UI del ramo eccezionale.

## 04/10/2026 — perdita lettore identità revoca Vault

Nuova regressione con Vault reale in memoria: dopo unlock, getUser lancia e session.check propagava errore lasciando isUnlocked true. Prova prima FALLITA (true invece di false). Corretto synchronize con revoca observedUid/revision e vault.lock auth-unavailable prima della propagazione, senza sopprimere eventuali errori cleanup. Suite completa successiva 806/806, zero saltate (include test sessione e nuove gare). Nessuna nuova prova browser/build per questa correzione; non significa certificazione di ogni race o integrazione pubblica.

## 04/10/2026 — fixture mutation compatibile con regole candidate

Diagnosi del PERMISSION_DENIED: emulator-browser installa composizione QR/note/allegati; firebase-mutation preparava record legacy tramite client. Spostata soltanto creazione fixture Account su Admin Firestore nell'emulatore demo, mantenendo guardie host/progetto e tutte le asserzioni su handler, ownership, idempotenza, conflitti e divieti scrittura/cancellazione ricevute. Ripetizione effettiva Node22 contro emulatori attivi: 24 sottoprove e contenitore, 25/25, zero saltate. Non test client-create, non HTTP/App Check (handler originale .run), admission test-only dichiarata. Rules/manifest invariati, nessun riavvio/reset o produzione. Il fallimento del checkpoint precedente è superato per questa suite.

## 04/10/2026 — RAM08/RAM10 SDK e primo browser integrato

Build realFunctions completata dopo limite sandbox del compilatore (esecuzione autorizzata, nessun deploy). Chrome loopback 4188: login sintetico A mantiene Vault bloccato, ammissione consente prompt, Master fittizia apre tre card A, Blocca le rimuove, Esci disconnette/disabilita unlock. Osservazione UI, nessuna prova Edge o attestation reale. Test firebase-session aggiornato con SDK/Auth/Firestore reali emulati: 16 sottoprove superate più contenitore; admission resta fixture test-only esplicita in questa suite, non in UI. Esecuzione congiunta firebase-mutation produce totale 17 pass/1 fail: mutation si ferma sul setDoc della fixture sintetica per PERMISSION_DENIED L55/56/156 delle regole attive. Non considerare il gate mutation passato; verificare config/composizione prevista prima di correggere il test, senza indebolire regole. Nessun dato reale, Rules o manifest modificati.

## 04/10/2026 — RAM08/RAM10 primo collegamento sessione candidata

Applicato nei sorgenti protected-session il coordinatore admission obbligatorio: check prima di unlock/navigate, ricontrollo ticket dopo prompt, invalidazione e pulizie nested finally. Migrati wrapper Firebase (presentation lifecycle), emulator-entry (FirebaseAdmission effettivo), demo crittografica (autorità demo esplicita), test unitari e Firebase (fixture dichiarata test-only, non prova policy). Suite laboratorio 803/803 dopo migrazione; successivamente aggiunti due test integrati e verificati 29/29 protected-session: lock durante gate non avvia unlock fisico, single-flight, latest-wins e rifiuto con Vault bloccato. Sintassi wrapper/entry superata. Nessuna prova browser/build o test Firebase aggiornato ancora eseguita; restano verifica SDK/UI e riesame lifecycle prima dell'accettazione. Conteggi inclusivi non sommabili; non chiude app pubblica o gli altri protocolli.

## 04/10/2026 — RAM10 riuso App Check del solo emulatore

Riesame Harness ricevuto e adattato soltanto per l'export `requireEmulatorAppCheck` in emulator-firebase: restituisce l'istanza sintetica già inizializzata, senza reinizializzazione, e rifiuta origine diversa da 127.0.0.1:4188 o istanza assente. Test del corpo modulo reale con dipendenze SDK sintetiche, senza rete: runner 14/14; sintassi verificata. Suite completa 800/800 eseguita prima di aggiungere questo test, non sommabile ai mirati. Non certifica App Check reale, browser o integrazione admission alla sessione; queste ultime non ancora eseguite. Nessun incarico Harness pendente; restanti frammenti RAM10 richiedono adattamento ownership ticket e cleanup, non accettazione automatica.

## 04/10/2026 — errore sottoscrizione Auth in bootstrap

Test sintetico dimostra che subscribeUser throwing lasciava senza cleanup il Vault appena creato: eventi attesi lock/dispose assenti. Corretto protected-session con invalidazione disposed/revision e nested finally per lock bootstrap-failed, vault.dispose e unsubscribe eventualmente acquisita quando fallisce synchronize. Regressione prima rossa poi verde; 25/25 mirati e 800/800 laboratorio, zero skip. Caso diretto subscribe throwing verificato; non nuova certificazione browser o integrazione admission. Nessun incarico Harness pendente, Rules/manifest/produzione invariati.

## 04/10/2026 — composizione admission locale con SDK

Eseguiti insieme local-presentation, firebase-admission e admission-coordinator contro Auth/Firestore loopback demo-vault-shell, account sintetico A. Verificati ammissione online, UID risultante, assertCurrent, seconda navigazione che rende obsoleta la prima, signOut effettivo seguito da invalidate espliciti e rifiuto del tentativo precedente, assenza ticket dopo logout. Exit 0 e app client chiusa in finally; nessuna scrittura dati. App Check resta callback sintetica. Questa prova integra i tre moduli fra loro, NON protected-session o browser: migrazione RAM08 ancora da fare. Ultima regressione completa 799/799 invariata.

## 04/10/2026 — RAM09 ticket identità locale isolato

Proposta Harness adattata in local-presentation.mjs: origine esatta loopback, ticket opaco stabile per UID, invalidazione su identità osservata diversa/assente e dispose; invalidate esplicito aggiunto per gli eventi Auth. acceptIdentity verifica emailVerified strettamente true anche nell'utente corrente, non solo nell'argomento. Errori getter propagati, invalidazione rientrante rifiutata. Due test sintetici nella suite esistente: 34/34 mirati, 799/799 laboratorio, zero skip. Non ancora collegato all'entry/sessione; non autorizza dati o policy, non gestisce DOM, non certifica App Check. Un logout/login dello stesso UID senza letture intermedie richiede invalidate dal chiamante: obbligo di integrazione, non copertura implicita. Nessun incarico Harness pendente; Rules/manifest/produzione invariati.

## 04/10/2026 — teardown Firebase effettivo dopo errore detach

Eseguita prova SDK contro Auth 9099 e Firestore 8085, progetto demo-vault-shell, account sintetico A già presente, crypto-utils effettivo e createFirebaseSession: sblocco iniziale confermato, removeEventListener sintetico throwing durante dispose. Verificati propagazione dell'errore originale, session.check false, nuovo unlock rifiutato SESSION_DISPOSED e secondo dispose idempotente. Comando exit 0, client chiuso in finally. Supera il limite precedente del wrapper Firebase non collaudato; non è prova UI né integrazione admission RAM08. Nessuna scrittura dati, produzione o rilascio. Ultima regressione completa invariata 797/797.

## 04/10/2026 — teardown con errore rimozione eventi

Riprodotto errore sintetico removeEventListener(pagehide) durante private-auth-blocked: dispose non veniva chiamato (0 invece di 1). Corretto bindBrowserSession: disattivazione callback immediata, tentativo di tutte le rimozioni e del timer conservando primo errore, session.dispose in finally sulla revoca. Anche il dispose pubblico Firebase usa finally per non saltare la chiusura quando detach lancia. Prova prima rossa poi verde: dispose una volta, quattro rimozioni tentate, timer rimosso, callback residui inerti. 32/32 browser-session-boundary e 797/797 laboratorio, zero skip. Non eseguito nuovo collaudo SDK del wrapper Firebase né prova UI; RAM08 ancora non integrato. Rules/manifest/produzione invariati.

## 04/10/2026 — seed e adapter admission contro emulatori effettivi

Eseguito seedEmulatorAdmission con SDK Admin esistente e host espliciti Auth 127.0.0.1:9099 / Firestore 127.0.0.1:8085, progetto demo-vault-shell. Per entrambe le fixture A/B verificati emailVerified true e passwordPolicyVersion 1; confronto deepEqual dei campi profilo prima/dopo esclusa la sola policy superato. Nessun reset/riavvio, creazione account o accesso a produzione. App Admin chiusa in finally.

Seconda prova con SDK client Firebase effettivo e createFirebaseAdmission, login sintetico A: check online con reload/server superato, check offline dalla cache popolata superato, ticket diverso rifiutato, gate disposed rifiutato. Callback App Check chiamata una sola volta (online) ma sintetica, così come gate di presentazione; NON certificati App Check reale, cache persistente dopo riavvio, browser o integrazione sessione. Entrambi i comandi terminati con exit 0. Nessuna nuova suite completa eseguita in questo checkpoint: ultima regressione 796/796. Queste prove superano il limite del solo SDK iniettato RAM06, non chiudono RAM08.

## 04/10/2026 — preparazione fixture admission

emulator-browser prepara ora emailVerified e passwordPolicyVersion 1 per i soli A/B sintetici tramite helper con progetto demo-vault-shell, host loopback esatti e confronto UID/email prima di scrivere. Policy con merge, SDK Admin dalla dipendenza Functions esistente, app temporanea chiusa in finally. Test iniettato rifiuta progetto/host/email/UID estranei senza scritture e verifica ordine auth/policy: suite runner 13/13; laboratorio 796/796, zero skip; node --check runner superato. NON ancora eseguito questo seed con Auth/Firestore emulati: verifica SDK effettiva e riavvio restano da fare. Non modifica i dati del laboratorio già aperto, non completa RAM08 o certifica l'app; Rules/manifest/produzione invariati.

## 04/10/2026 — errore notifica sblocco

Riprodotto con createMemoryVault reale e dati sintetici: onState(unlocked) throwing faceva rigettare unlock ma lasciava isUnlocked true. Prova aggiunta in protected-session.test.mjs prima fallita, poi superata dopo lock report-failed limitato al tentativo ancora corrente (revision/unlocking/UID/disposed). Errori di pulizia non soppressi. Suite mirata 24/24; laboratorio 795/795, zero skip. Non è collegamento admission né prova browser. Riesame RAM08 ricevuto ma resto proposta non applicato: controllo finale ownerChanged ancora non sufficiente per callback rientranti e sincronizzazione UID prima dei return. Nessun incarico Harness pendente; Rules/manifest/produzione invariati.

## 04/10/2026 — inoltro motivo blocco nell'adattatore

legacy-adapter.lock scartava il parametro reason e notificava sempre manual. Aggiunta prova sintetica per admission-refused, auth-change e default manual: prima fallita con tre manual, dopo inoltro reason al memoryVault superata. Suite legacy-adapter 20/20. Il blocco fisico era già presente: correzione del contratto di notifica, non prova di integrazione admission completata. RAM08 prima proposta non applicata, richiesto riesame su invalidate throwing prima lock e sincronizzazione UID nel catch navigate. Nessuna prova browser aggiuntiva, Rules/manifest/produzione invariati.

## 04/10/2026 — RAM07 coordinatore isolato

Prima proposta Harness respinta per rejection admission/throw ticket senza blocco e soppressione cleanup. Riesame ricevuto e adattato in admission-coordinator.mjs: snapshot congelati ed emessi dal coordinatore, epoch e sequenza navigate, callback sincrone ricontrollate, errori identità correnti rifiutati invece di trattarli come automaticamente obsoleti. onRefused e teardown propagano errori; nessuno stato unlocked duplicato. Cinque test sintetici aggiunti alla suite esistente coprono rejection corrente e tardiva, UID/invalidate/dispose/latest-nav, ticket inattivo o throwing/rientrante, risultato malformato, snapshot falso e cleanup throwing. 31/31 mirati strict e 793/793 test:vault-shell, zero skip. Non rivendicata regressione rossa nel runtime esistente: è un nuovo modulo isolato.

NON collegato a protected-session/Firebase/entry: non dimostra ancora azzeramento chiavi o rimozione viste attraverso questo coordinatore. Il chiamante deve garantire lock fisico al cambio UID, single-flight prima di begin, invalidazione salvo unlock-start, assertCurrent dopo prompt e nested finally nel teardown; onRefused deve bloccare Vault/vista. Nessun timeout introdotto, ammissione mai risolta resta pendente; nessuna certificazione browser/Edge/distribuita. Rules, manifest e produzione non modificati.

## 04/10/2026 — RAM06, adattatore Firebase di ammissione isolato

Proposta DeepSeek ricevuta nella nuova conversazione autorizzata e adattata da Astra in firebase-admission.mjs: SDK reale come default, dipendenze iniettabili; reload del medesimo utente, binding del gate di presentazione, lettura del solo passwordPolicyVersion in users/UID. Online usa esclusivamente getDocFromServer, offline esclusivamente getDocFromCache: nessun ripiego sulla cache in caso di errore server. Ownership ricontrollata prima/dopo attesa; snapshot malformati rifiutati conservativamente. Nessuna configurazione Firebase, credenziale, listener o materiale Vault nel modulo.

Quattro test sintetici aggiunti a browser-session-boundary.test.mjs: separazione online/offline, errore server senza fallback, cambio proprietario durante lettura, snapshot/dipendenze invalidi. Eseguiti node --unhandled-rejections=strict --test sul file: 26/26; npm run test:vault-shell: 788/788, zero fallimenti/skip. Conteggi inclusivi, non sommabili. Queste sono prove con SDK iniettato, non nuove prove Auth/Firestore reali né certificazione App Check o freschezza cache offline. Nessuna regressione rossa preesistente rivendicata per il nuovo modulo.

Adattatore NON ancora collegato a protected-session/firebase-session/entry o app pubblica. Restano integrazione admission, gestione gare e migrazione dei consumatori; server browser già aperto non ricostruito per RAM05/RAM06. Nessuna modifica a Rules base, manifest o produzione; nessun rilascio e nessuna chiusura globale.

## 04/10/2026 — RAM05 parziale, sblocchi concorrenti

Riesame Harness ricevuto e valutato: accettato solo il single-flight fisico in protected-session.mjs, adattato da Astra senza introdurre il cablaggio admission incompleto. Il secondo unlock viene rifiutato con UNLOCK_PENDING fino al termine del precedente, anche dopo lock; lock continua ad annullare subito il risultato. Un fallimento libera la guardia per un nuovo tentativo esplicito. Due test sintetici aggiunti alla suite esistente: prima della patch il caso concorrente falliva (secondo sblocco non rifiutato), dopo 23/23 mirati strict e 784/784 test:vault-shell, zero skip. Il test di retry era già verde prima e non è contato come difetto corretto.

Restano non accettate le altre parti RAM05: contatore di navigazione latest-wins assente nella proposta, trattamento delle eccezioni di admission/getTicket e teardown da completare, migrazione coordinata dei callsite e adapter Firebase/fixture. Nessun bypass policy aggiunto; modulo admission ancora isolato. Non eseguito nuovo collaudo browser, server già aperto non ricostruito. Nessuna modifica a Rules base, manifest o produzione; non chiude integrazione globale.

## 04/10/2026 — RAM04, modulo candidato di ammissione isolato

Proposta Harness riesaminata e adattata in admission-gate.mjs, senza collegarla alla sessione o all'app pubblica. Controlla identità verificata, versione policy, invalidazione/UID e sorgente esplicita server-only/cache-only; stato rete indeterminato rifiutato, errore online senza fallback. Nessuna chiave, storage o nuova sessione; clearLegacyUnlock invariato. Sei nuovi test sintetici nella suite già registrata: 22/22 mirati strict, nessuna prova Firebase/browser di questo modulo. Non è correzione produttiva né attestazione di App Check reale. Il chiamante futuro deve collegare invalidazione, adapter Firebase e impedire contenuti sensibili prima della policy: acceptIdentity legacy rende visibile il body prima dell'ammissione completa. Questi collegamenti restano aperti.

## 04/10/2026 — RAM-INTEGRATION-03, comandi della shell locale

Collaudo UI successivo su Chrome controllato, progetto demo-vault-shell e soli emulatori loopback: accesso A con Vault bloccato; sblocco con fixture pubblica e comparsa dei tre Account A; Blocca rimuove le card; Annulla sblocco mantiene il Vault bloccato e mostra il messaggio; Esci torna a Accesso non effettuato e disabilita Sblocca. Esiti osservati nella UI reale del laboratorio, non soltanto test Node. Non verificata in questo giro la gara di lock durante derivazione, coperta solo dai test sintetici; nessuna estensione a Edge/mobile o intera app. Server locale attivo nella sessione terminale 31943, tab Chrome 330768749 lasciata disconnessa per prosecuzione.

Verifica successiva: compilazione effettiva del laboratorio con realFunctions riuscita (`LOCAL_BUILD_OK`), dopo errore iniziale di accesso del compilatore alle cartelle superiori nel sandbox e ripetizione autorizzata. Non equivale a test browser o servizi in esecuzione; nessun deploy.

Estratto shell-commands.mjs e collegato ai sette controlli reali di emulator-entry. Proposta Harness riesaminata: respinto rilascio del single-flight al lock, perché signIn può essere ancora pendente; il blocco resta fino alla conclusione fisica ma la continuazione non naviga più. Astra ha inoltre protetto gli errori di avvio UI dentro il tentativo. Dispose rimuove solo listener, non possiede sessione né esegue signOut; export disponibile, non inventato un teardown globale/HMR.

Sei nuovi test sintetici eseguiti (non presentati come rosso/verde sul vecchio entry): login/unlock pendenti dopo lock, blocco secondo tentativo, dispose, binding parziale, route indipendenti, rejection obsoleta e guasto UI. Suite entry-runner strict 12/12; laboratorio 776/776 inclusivi, zero skip. Non eseguita in questo checkpoint una prova browser/Firebase del nuovo cablaggio: resta da collaudare prima di dichiararlo verificato end-to-end. Modificata soltanto entry del laboratorio, non bootstrap pubblico; integrazione globale aperta. Rules/manifest/produzione invariati.

## 04/10/2026 — RAM-INTEGRATION-02, pulizia nel percorso stop

Riesame Harness concluso; proposta adattata da Astra perché chiudeva il gate soltanto dopo abort, consentendo navigazione rientrante. Ora stop sgancia proprietà della vista e blocca rientranze prima di abort/disposer. Un disposer thenable blocca nuovi mount fino all'esito, senza riavvio automatico; errore inoltrato una volta a onError prima della riapertura del gate. Getter then acquisito una sola volta e protetto. Whitelist, API congelata, default onError e ramo stale RAM01 preservati.

Quattro regressioni sintetiche prima fallite, poi superate: pulizia pendente e ripresa esplicita; rejection con onError rientrante; rientranza da abort/disposer; getter then fallito. Mirati prototype/protected-session strict: 47/47. Suite laboratorio completa: 770/770, zero skip, inclusivi e non sommabili. Nessuna prova browser/dispositivo/Firebase aggiuntiva. Un disposer che non termina mantiene il blocco, senza timeout. Non certificata la gestione globale di pulizie stale concorrenti né callback onError asincroni; bootstrap app ancora da integrare. Nessuna modifica Rules, manifest o produzione.

## 04/10/2026 — RAM-INTEGRATION-01, errore del disposer asincrono

Riesame Harness ricevuto e concluso. Respinti il wrapper duplicato e la proposta di sopprimere gli errori delle pulizie obsolete: il contratto esistente li segnala, perché non è dimostrata l'assenza di residui. Accettata solo l'attesa del disposer restituito da un mount superato, mantenendo onError e il blocco conservativo del Vault. Nessun cambiamento di decisione prodotto.

Nuova regressione differita contro router reale: prima fallisce per rejection non gestita; dopo `await cleanup?.()` passa, segnala lo stesso errore una volta e non completa prima della pulizia. Mirati prototype/protected-session con unhandled-rejections strict: 43/43. Regressione laboratorio: 766/766, inclusivi dei mirati e delle due prove QA precedenti; zero skip. Nessuna prova browser o Firebase aggiuntiva. Resta da verificare separatamente la gestione di disposer asincroni nel percorso stop, che è ancora sincrono; non estendere questa correzione a quel caso. Bootstrap globale non integrato, produzione/Rules/manifest invariati.

## 04/10/2026 — seguito QA-04-10C nella nuova conversazione Harness

Riesame ricevuto nella nuova conversazione «Codici & Password», senza strumenti o scritture delegate. Aggiunte due prove suggerite e verificate direttamente: metodo removeItem mancante/non funzione o getter che lancia (quattro tentativi e primo errore preservato); ripetizione dopo errore parziale, idempotenza e preferenze conservate. Suite confine sessione 16/16, exit 0, nessuno skip. Sono prove aggiuntive già verdi sul codice corretto, non due nuovi difetti risolti. Non rieseguita l'intera suite: 763/763 resta il conteggio della precedente esecuzione.

Non adottata la proposta di normalizzare ogni eccezione: il contratto conserva il primo valore lanciato e il bootstrap invoca la pulizia prima di creare sessione/listener, senza catch che lo declassi. L'assenza di storage resta ammessa per ambiente Node senza storage; non certifica un futuro adattatore browser che sostituisca silenziosamente uno storage negato con undefined. Integrazione globale ancora aperta. Nessuna modifica runtime in questo seguito, né Rules, manifest, produzione o Git mutante.

## 04/10/2026 — ripresa locale, pulizia legacy resistente a errori parziali

Nel confine della candidata RAM, `clearLegacyUnlock` interrompeva tutte le rimozioni al primo errore: le voci successive, inclusa la wrapping key, non venivano neppure tentate. Ora tenta tutti e quattro i nomi autorizzati e propaga comunque il primo errore, anche se il valore lanciato è falsy. Non legge valori, non scrive chiavi, non tocca preferenze e non permette il bootstrap dopo un errore. Non garantisce rimozione da uno storage che la rifiuta.

- Due nuove regressioni sintetiche eseguite sul codice precedente: entrambe fallite; dopo correzione, suite `browser-session-boundary.test.mjs` 14/14, nessuno skip.
- `npm run test:vault-shell`: 763/763, nessuno skip, exit 0; include i 14 precedenti, non sommare i conteggi.
- Non eseguite in questo checkpoint prove browser, emulatori Firebase o dispositivi reali. La modifica resta nella candidata e non migra il bootstrap multipagina; VS-P0-01 e gli altri gate globali restano aperti.
- Tentativo QA-04-10C Harness bloccato dal controllo di sicurezza della UI per rischio di lettura di materiale privato estraneo nella sessione esistente. Invio non confermato, nessun ritentativo o aggiramento, nessuna risposta usata come revisione. Modifica riesaminata direttamente e verificata con prove locali.
- Nessun commit/merge/push/deploy, nessuna modifica di produzione, Rules base o manifest. Autorizzazione di ripresa tecnica registrata in INCARICO_CORRENTE.

## 04/10/2026 — correzione autorizzata dei compositori e ricollaudo

Perimetro: solo compositori Rules e controlli automatici del laboratorio, con dati sintetici. Autorizzazione esplicita successiva di Diego; nessuna modifica alle regole base, ai manifest o alla produzione. Riutilizzata la diagnosi Harness QA-04-10B, con applicazione e verifica diretta dell'orchestratore; nessun nuovo incarico delegato.

- Compositore QR aziendale: sostituisce il blocco base sovrapposto nella sola stringa candidata, anziché aggiungere una restrizione inefficace; conserva l'esclusione aziende dal permesso generico e il divieto di cancellazione diretta. Il compositore testo profilo verifica ora questo divieto già presente. I compositori derivati di link/note/campi Account non ereditano più il permesso alternativo sui discendenti aziendali.
- Compositore Storage: riconosce la base con namespace, mantiene la riserva `restoreObjects` anche per lettura di percorsi non previsti e nega le mutazioni client di `profile-documents`. MIME, dimensioni, proprietario e scritture server-only non allentati. Gestiti LF/CRLF; forma inattesa e seconda applicazione sono rifiutate.
- Audit statico: controllo aggiornato al percorso UID/namespace e alle due condizioni di riserva ripristino; non eliminata l'asserzione per ottenere il verde. Tolto dal messaggio finale il vecchio numero fisso «88», non calcolato dal runner: ora dichiara espressamente la natura statica, non un collaudo completo.
- Nuove regressioni: rifiuto delete azienda, mantenimento scritture legittime estranee al dominio QR e isolamento UID; Storage rifiuta creazione/sostituzione/eliminazione nei percorsi di ripristino, letture anonime/estranee e letture owner fuori dal percorso previsto; rifiutati upload vuoti e octet-stream non marcati. Test di composizione verificano base inattesa, doppia applicazione e normalizzazione delle righe.

Risultati effettivi, senza skip o todo:

| Comando/suite | Esito |
|---|---|
| runner Vault `--qr-selection` | 2/2 |
| `--profile-text` | 3/3 |
| `--profile-company-contacts` | 2/2 |
| `--profile-addresses` | 2/2 |
| `--profile-link` | 2/2 |
| `--account-note` | 1/1 |
| `--account-standard` | 1/1 |
| `--profile-document-attachments-storage` | 9/9 |
| `node --test experiments/persistent-vault-shell/candidate-rule-composition.test.mjs` | 2/2 |
| `npm run test:vault-shell` | 761/761 |
| `npm run test:security` | audit statico completato e 25/25 test |
| `npm run test:docs` | 31 MD, 606 collegamenti; 11/11 test |

Le otto suite emulatore prima fallite sono ora superate (22 test riportati, inclusi contenitori: non 22 azioni utente). Avviate in sequenza con Node22, progetto demo-vault-shell; uscita finale 0 e arresto normale degli emulatori. La regressione di composizione è eseguita esplicitamente, senza modificare il manifest dei comandi.

Impronte SHA256 prima/dopo identiche per `firestore.rules`, `storage.rules`, `package.json`, `package-lock.json`, `firebase.json`, `scripts/docs-manifest.json`, `Frontend/public/manifest.json`. Nessun commit/merge/push/deploy. Fonti riesaminate: LEGGIMI, INCARICO_CORRENTE, STATO, SICUREZZA, catena effettiva dei compositori e relativi test.

Limiti: chiuso questo difetto di composizione del laboratorio, NON l'integrazione globale o i sette punti. Il test Storage che dimostra che l'emulatore ignora le precondizioni native resta una caratterizzazione di un limite, non una prova di sicurezza distribuita. Restano M8, PURGE-CAS, recupero MFA sicuro, migrazione KDF e sessione RAM multipagina, oltre ai collaudi reali/Edge. Nessuna prova visiva nuova eseguita; server 4188 non avviato da questo intervento. Lingue/AI/Excel ancora separati.

## 04/10/2026 — ripresa autonoma dei controlli locali, non chiusura rilascio

### Esiti ulteriori e blocco di composizione Rules

- Ripetuto `scripts/run-functions-emulator-local.mjs --vault-accounts` con Node22: 158 controlli HTTP autenticati sugli export effettivi SUPERATI (Auth/Firestore/Functions locali). Non prova App Check reale né chiude i rifiuti client mancanti negli overlay. Emulatori arrestati normalmente al termine; laboratorio 4188 non riavviato in attesa della correzione delle protezioni candidate.

- Suite emulatore sequenziali: audit-retention 14/14, account-attachment-delete 2/2, purge-retention 4/4, attachment-removal 3/3, company-hard-delete 4/4, shared-copies-purge 2/2, purged-account-restore 5/5, interrupted-restore 2/2, restore-retry 3/3, restore-stale 3/3, restore-collisions 4/4. Alcune sono prove di caratterizzazione dei residui/difetti noti, NON prove di correzione: non chiudono M7/M8.
- Avatar: prima 0/2 per `listAll(users/uid)` negato. Adeguato esclusivamente l'inventario del test: asserisce il rifiuto al client e inventaria con il contesto amministrativo dell'emulatore; upload e lettura byte restano soggetti alle Rules owner. Primo tentativo del test corretto fallito per ritorno void di withSecurityRulesDisabled, poi corretto e 2/2. La presenza del vecchio avatar orfano è ancora confermata, NON risolta. Nessuna Rules cambiata.
- Runner Vault: sessione 17/17, mutation 41/41, contatti privati 2/2, utenze 1/1, allegati documenti 8/8 superati. FALLITI: QR (0/2), testo profilo (1/3), contatti azienda (1/2), indirizzi (1/2), link profilo (1/2), note Account (0/1), campi standard Account (0/1). In questi casi una scrittura attesa negata è riuscita; i totali includono gli eventuali test contenitore.
- Causa verificata nel sorgente: il nuovo match azienda della base concede read/create/update e scritture ai discendenti. Gli overlay aggiungono match più restrittivi senza neutralizzare la concessione base; le condizioni sovrapposte sono additive. Le prove candidate precedenti NON attestano quindi la base attuale. Non toccate le protezioni per ottenere il verde.
- Allegati documenti Storage: 7/9, due test FALLITI con RULES_BASE_CHANGED; il compositore richiede ancora il vecchio blocco Storage senza namespace. Occorre aggiornare il compositore mantenendo sia la riserva restoreObjects sia profile-documents, senza alterare le Rules base.
- Harness QA-04-10B ha fornito diagnosi della sovrapposizione e criteri di composizione; non eseguiti suoi strumenti o patch. Non accettata la frase che delete:false resti necessariamente efficace: l'overlay QR contiene allow read,delete e può a sua volta concedere delete. La futura correzione deve provare esplicitamente anche questo divieto. Nessun nuovo manifest.
- Arrestato il server sintetico precedente per le suite Vault sequenziali: nessun dato online coinvolto. Il laboratorio visivo non va considerato collaudato rispetto alle nuove correzioni prima di nuova inizializzazione e controllo Edge.

- DeepSeek Harness consultato nella sessione esistente, incarico QA-04-10 solo risposta in chat e senza strumenti. Ricevuta matrice fixture/editor/Edge; adottata verifica del primo caricamento con il seed effettivo. Non adottata euristica per riconoscere ciphertext dall'aspetto del testo, né nuova decifratura degli indirizzi.
- Corretto `emulator-browser.mjs`: indirizzo privato iniziale in chiaro secondo contratto A2; `utilities[].value` resta cifrato. Regressione esegue l'espressione seed effettiva con spia di cifratura e carica il vero editor source: prima rossa, poi 9/9 indirizzi verdi. Non è una prova DOM né WebCrypto; nessuna modifica ai dati della sessione laboratorio già avviata. La correzione seed richiede nuova inizializzazione sintetica.
- Passate le suite npm: vault-shell, backup-prototype, history-prototype, crypto, attachments, profile, navigation, docs, functions-security; inoltre company-pdf (33), offline (14), data-access (95), page-shells, ui-foundations, html-purity, static-references, lightweight, performance-budget, js-syntax, css, dependencies, assistant (4), maturity-fixture (4), sharing-prototype (38), offline-write-prototype (203), credential-health-prototype (12), release-hardening. Sono suite di codice/audit, non certificazione dei flussi integrati o dei difetti noti registrati.
- Gruppo mirato documenti/Annulla/sessione/logout/autofill/bootstrap/auth: 66/66. Firestore emulato: 73/73; Storage regole correnti: 10/10, prototipo condivisione Storage: 5/5. Non sommare con totali storici o suite sovrapposte.
- `test:security` FALLISCE in `audit-security-flows.mjs:247`: regex richiede il vecchio percorso `/users/{userId}/{allPaths=**}`, mentre le Rules usano il segmento namespace per escludere restoreObjects. Le Rules non sono state alterate per soddisfare l'audit. Il gate resta rosso; i test comportamentali Storage sopra non equivalgono alla chiusura dell'audit né dell'intero programma.
- Esecuzione iniziale indiscriminata `node --test experiments/persistent-vault-shell/*.test.mjs` FALLITA: include test che richiedono variabili emulatori, preview non preparata e bridge non attivo. Non è conteggiata come suite superata. Primo Storage avviato sovrapposto all'altro emulatore: hook/discovery falliti; ripetizione sequenziale conclusa con esiti sopra. Nessuna modifica alle protezioni per aggirare questi errori.
- Conferme manuali pregresse di Diego, ricevute in chat dopo le sezioni del 28/09: nota documento visibile, Annulla funzionante, numero documento persistente e isolato A/B, scarto con Esci/Blocca/Annulla, creazione isolata, eliminazione seguita da Salva e persistenza dopo F5. Sono prove riferite dall'utente, non osservazioni automatiche Astra; superano le diciture «conferma pendente» dei relativi checkpoint storici.
- Edge rimane per verifica insieme all'utente. Rimangono aperti integrazione globale, M8, PURGE-CAS, MFA e KDF, oltre ai gate distribuiti/dispositivi reali; nessuna attestazione globale verde, commit, push o deploy.

## 28/09/2026 — rifiuto eliminazione documenti nel laboratorio

- Segnalato da Diego retry ripetuto con documento conservato. Seed QR privo del booleano cf, che rende le dipendenze non verificabili per il gestore conservativo. Aggiunto cf:false al seed, senza indebolire la guardia backend. Non ancora applicato alla sessione emulata già popolata.
- Il provider documenti riconosce esclusivamente quattro rifiuti failed-precondition con motivo noto; il controller distingue un rifiuto al primo invio da unknown. Un retry dopo un precedente unknown resta incerto anche se riceve poi un rifiuto: nessuna falsa attestazione di mancata scrittura.
- Editor: blocco campi e aggiunta durante preparazione/invio/unknown; rifiuto spiegato e Annulla disponibile. Test controller, annullamento e documenti 15/15. Build locale aggiornata senza reset; ripetizione manuale della cancellazione e inizializzazione corretta ancora pendenti. Non dichiarata superata la prova segnalata.

## 28/09/2026 — Annulla nell'editor documenti

- Aggiunto comando Annulla alla vista e collegato il callback già previsto dalla shell attraverso il provider. Scarta la bozza, pulisce i campi e torna ai dettagli senza inviare salvataggi.
- Disabilitato durante preparazione, invio ed esito incerto: non promette di annullare una scrittura già inviata. Retry preesistente invariato.
- Eseguiti private-documents-cancel.test.mjs, private-documents.test.mjs e profile-shell-view.test.mjs: 21/21. Il nuovo test verifica pulizia, nessun salvataggio, callback singolo e disabilitazione negli stati pendenti. Laboratorio rigenerato senza reset dati; conferma visiva Edge ancora pendente.

## 28/09/2026 — nota documento assente nei dettagli

- Diego riferisce nota conservata nell'editor dopo rientro, ma assente in consultazione. Confermata omissione di note dalla proiezione Documenti; aggiunta riga Note tramite lettore autorizzato del Vault, senza esporre password/PIN o cambiare la Panoramica sintetica.
- Regressione prima fallita per riga mancante, poi superata. Suite lettori sezioni/panoramica e vista profilo 36/36. Laboratorio rigenerato senza riavviare emulatori o azzerare dati. Conferma visiva dell'utente ancora pendente.

## 28/09/2026 — fixture telefono azienda

- Diego identifica nel campo Telefono azienda una sequenza cifrata entrando in modifica. Il seed usava encrypted sul numero mentre ma_save.js e il contratto phone-slot memorizzano il telefono come stringa in chiaro. Corretto esclusivamente il seed a 111111111; email cifrate, password e collegamenti invariati.
- Aggiunta regressione statica: fallita prima della correzione e superata dopo. Nessuna migrazione o sovrascrittura della sessione manuale corrente; il valore iniziale corretto richiede nuova inizializzazione. Conferma visiva ancora pendente.

## 28/09/2026 — fixture indirizzi aziendali non conformi

- Diego segnala sequenze cifrate nei due indirizzi precompilati entrando in Modifica, mentre il testo sostituito manualmente resta leggibile. Confermato: emulator-browser cifrava sede e filiale, in contrasto con il formato in chiaro previsto in PROFILO_E_ACCOUNT e nell'editor.
- Corretto esclusivamente il seed del laboratorio per entrambi gli indirizzi. Nessuna modifica alla cifratura dell'app, nessuna migrazione dei dati e nessuna sovrascrittura della sessione manuale corrente.
- Regressione statica sul seed prima fallita, poi superata; suite company-addresses 8/8. Questo verifica il formato del seed e il contratto delle mutazioni, non è una nuova prova visiva Edge. I dati già caricati nell'emulatore restano invariati: serve una nuova inizializzazione del laboratorio per osservare i due valori iniziali corretti. Non dichiarare chiusa la verifica visiva sulla sessione attuale.

## 28/09/2026 — prove manuali Edge e mascheratura editor

- Diego riferisce riusciti nel laboratorio Edge: accesso/sblocco, persistenza nota dopo riapertura e F5 con nuovo sblocco, separazione note A/B/A, blocco con dati nascosti, password errata respinta, annullamento con campo svuotato e dati nascosti, uscita con sblocco disabilitato prima dell'accesso. Evidenza manuale dell'utente, non esecuzione automatica né collaudo globale.
- Durante modifica Account Diego segnala tutti i campi mascherati. Identificata regola CSS globale `input` con `-webkit-text-security:disc`; rimossa la mascheratura globale, conservata su password e `#unlock-value`. Solo laboratorio, nessuna modifica alla produzione o ai valori salvati.
- Test mirati editor 5/5, inclusa regressione sulla selettività CSS; laboratorio rigenerato in modalità realFunctions. Conferma visiva Edge dopo aggiornamento ancora da raccogliere. Queste prove non chiudono gli altri punti del programma.

## 28/09/2026 — ritentativo Edge dopo chiusura finestre

- Diego ha chiuso le finestre e autorizzato il ritentativo. Prima dell'avvio risultavano ancora processi msedge in background; non terminati né modificate impostazioni personali.
- Rieseguito Node22 `--vault-browser` con `VAULT_SHELL_BROWSER=edge`, esclusivamente demo-vault-shell e profilo temporaneo: runner exit 1, Edge termina con exit 0 prima dell'endpoint DevTools (`DEVTOOLS_BROWSER_EXITED_BEFORE_ENDPOINT:0`). Nessuno scenario Edge eseguito o superato; chiudere le finestre non ha risolto, causa non accertata.
- In questo tentativo anche il caricamento delle definizioni Functions ha superato il timeout di 10 secondi: problema distinto, nessuna validazione backend attribuita a questa esecuzione. Emulatori arrestati regolarmente. Produzione e codice applicativo invariati.

## 28/09/2026 — browser autenticato verso i tredici servizi locali

- `scripts/run-functions-emulator-local.mjs --vault-browser` esegue ora il percorso completo `--test`, non lo scenario isolato indirizzi. Progetto demo-vault-shell, Auth 9099, Firestore 8085 e Functions 5001; ponte simulato disabilitato. Bootstrap pubblicato invariato.
- Eseguito con Node22 e `VAULT_SHELL_BROWSER=chrome`: esito 0, rapporti `ok:true` separati desktop e mobile simulato. Accesso sintetico, sblocco Vault, modifiche dalle schermate montate, chiamate SDK autenticate ai veri export emulati e riletture. Coperti note, credenziali standard, creazione/collegamento Account, anagrafica, contatti privati/aziendali, indirizzi privati/aziendali, utenze, metadati documenti e selezioni QR private/aziendali. Per i cinque percorsi aggiunti: modifica, riapertura, confronto valore e ripristino originale, senza mock del submit. Restano inclusi blocco Vault, pulizia viste, consultazione offline, coda cifrata e risincronizzazione esplicita.
- Prima della riuscita completa, il nuovo selettore del telefono aziendale era errato: test fermato con `TIMEOUT_company contacts_EDITOR`, non difetto di salvataggio. Corretto al campo `number` della riga `telefonoAzienda`, poi rieseguito il percorso intero su entrambi i profili Chrome.
- Edge ritentato separatamente: uscita 0 del processo browser PRIMA dell'endpoint DevTools, runner exit 1. Nessuna prova Edge dichiarata superata; nessuna modifica a impostazioni browser/sicurezza. Mobile è viewport simulato su Windows, non telefono fisico. App Check usa attestazione sintetica valida solo per emulatore, non attestazione del provider reale.
- Guardia argomenti del runner: modalità sconosciute o combinate respinte prima di avviare emulatori, test 1/1 superato. Sintassi dei due script verificata. Emulatori arrestati regolarmente dopo ogni esecuzione.
- È accettato questo sottoinsieme di integrazione del laboratorio, NON il bootstrap dell'app intera, M8, PURGE-CAS, recupero MFA, migrazione KDF o gate distribuiti. DeepSeek Harness consultato solo per stato UI Read Only; nessuna nuova proposta attribuita al canale in questa sessione. Nessun Git mutante, produzione o deploy.

## 28/09/2026 — tredici export locali e prova negativa MFA

- Aggiunti applyPrivateAddressesMutation, applyCompanyAddressesMutation e applyCompanyContactsMutation al bundle/entry Functions locale. expectedOwnerUid obbligatorio e controllato prima di accesso al database; middleware Auth/App Check, ricevute e conservazione dei campi mantenuti. Inventario statico 13/13 export presenti; resta BLOCKED per chiave legacy persistita e ingresso multipagina, non modificato per ottenere verde.
- Riprodotte due cancellazioni multiple che aggiravano la protezione QR: dopo la prima rimozione, l'indice della lista modificata non corrispondeva più all'indice della selezione originale. Corretto confronto sulla posizione originale sia per sedi sia per email aggiuntive aziendali. Test prima entrambi rossi (mancato rifiuto), poi verdi con documento intatto.
- Mirati Node22 56/56; laboratorio Node24 755/755; Functions Node22 362/362. HTTP demo Auth/Firestore/Functions: 158 controlli complessivi, comprendono i precedenti 135/156 e i due rifiuti multi-delete verificati su Firestore. Arresto emulatori regolare. Non sommare suite sovrapposte; App Check reale non attestato. ESLint inizialmente rilevava variabile parent inutilizzata nel bundle utenze: rimossa dal sorgente, rigenerato bundle, controllo riuscito e 11/11 wrapper/utenze rieseguiti.
- Prova separata autorizzata scripts/test-mfa-session-emulator.mjs, eseguita con --mfa-session-probe: creazione di identità esclusivamente sintetica in demo locale, emissione token tecnico, eliminazione della stessa identità e scambio token. Auth emulato ha risposto isNewUser=true e ricreato UID senza email. Identità sintetica rimossa e emulatori arrestati. È caratterizzazione di un difetto: gate sicurezza FALLITO anche se lo script termina con 0 perché osserva il rischio atteso. Nessuna sessione salvata/esposta, nessun nuovo percorso MFA collegato all'app.
- Fonti primarie consultate: [scambio custom-token](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signInWithCustomToken), che può creare utenti, e [rimozione selettiva MFA](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaEnrollment/withdraw), che richiede ID token e identificativo del fattore. Un controllo di esistenza prima dello scambio non elimina la gara riprodotta. Nessuna cancellazione compensativa di account proposta o attivata.
- Programma globale NON concluso: integrazione UI/sessione, M8, coordinamento purge/pulizie, recupero MFA sicuro/ripresa, KDF e gate esterni ancora aperti. Lingue/AI/Excel separati. Nessun commit, push, deploy o produzione.

## 28/09/2026 — integrazione contatti privati e binding proprietario

- Riprodotto con test sintetico il replay di una creazione preparata per owner sotto identità other: prima della correzione mancava il rifiuto e il test falliva. Aggiunto expectedOwnerUid obbligatorio a contratto/preparazione, confrontato con identità verificata prima del database. Non è accesso al profilo di un terzo: il difetto era l'applicazione della richiesta preparata al diverso profilo autenticato dopo cambio sessione.
- Collegato applyProfileContactsMutation all'export locale con Auth/App Check e bundle autonomo; errori controllati sanitizzati. Dieci dei tredici export presenti; schermate legacy non ancora migrate.
- Node22: contatti/editor 52/52, wrapper backend 5/5. Laboratorio npm run test:vault-shell: 753/753 (Node24). Nessuna somma tra suite sovrapposte.
- Auth/Firestore/Functions demo locali: 135 controlli HTTP complessivi superati, inclusi i precedenti 129; nuove prove contatti su auth/attestazione assenti, proprietario diverso, creazione, retry, revisione obsoleta e preservazione campi. Emulatori arrestati regolarmente, uscita 0. App Check reale non attestato; nessun dato reale o distribuzione.
- Restano tre export, integrazione multipagina e protocolli M8/PURGE-CAS/MFA/KDF e gate esterni. Il verde di queste prove non chiude il programma.

## 27/09/2026 — seguito Account/profilo: collegamento e creazione backend

- Aggiunti gli export locali applyProfileLinkMutation/applyProfileAccountCreate, stessi middleware Auth/App Check e sanitizzazione degli errori. Modelli puri incorporati alla build, nessun import runtime dal frontend. Esportazioni ora 4/13, non ancora collegamento delle schermate legacy al nuovo backend.
- Nuove prove inizialmente rosse hanno riprodotto perdita del collegamento privato dopo trasferimento legacy e mancata rimozione della copia aziendale. Correzione: conservare il collegamento preparato, rimuovere la sola proprietà trasferita dall'elemento privato senza sentinel dentro array; azienda modifica lo slot realmente memorizzato oppure il campo fallback aziendaEmailPassword. Resta necessaria transferLegacyPassword esplicita e corrispondenza con la copia attesa. Cifratura formale di nome/username richiesta dal contratto; revisione massima respinta.
- Node 22, `scripts/run-functions-emulator-local.mjs --vault-accounts`: **72 controlli HTTP superati** attraverso quattro export reali in Auth/Firestore/Functions emulati. Inclusi i precedenti 24 Account e 16 link; ulteriori 32 su creazione email privata, utenza, slot aziendale e fallback legacy. Verificati auth/App Check mancanti, owner diverso, plaintext respinto, retry invariato, conflitto, preservazione credenziali/campi extra, rimozione copia richiesta, nuovo link e assenza del segreto nelle ricevute. Collegamento/scollegamento concorrenti danno un solo vincitore e aggiornano entrambi i riferimenti. Emulatori arrestati regolarmente. Il token App Check resta una fixture solo emulatore, non attestazione reale.
- Regressione Functions 362/362; ESLint mirato superato. Suite mirata intermedia creazione/link/adattatori 30/30 prima dell'aggiunta dell'ulteriore test negativo sul contratto. Nessuna prova browser completa, nessuna produzione o Git mutante. Bootstrap multipagina, nove export rimanenti e protocolli M8/PURGE-CAS/MFA restano aperti.


## 27/09/2026 — Account: export backend e prove HTTP reali locali

- `functions/vault-account-entry.mjs` compone gli handler note e campi standard; `scripts/build-vault-account-backend.mjs` genera il bundle CommonJS autonomo `functions/vault-account-runtime.js`. In `functions/index.js` aggiunti applyAccountNoteMutation/applyAccountStandardMutation con enforceAppCheck:true. Identità e attestazione arrivano soltanto dal middleware; nessun ponte sintetico incluso nel bundle, nessun caricamento runtime dei sorgenti frontend. Errori imprevisti non espongono percorsi/payload.
- Node 22: Functions 362/362, inclusi cinque nuovi controlli degli adattatori. ESLint mirato superato dopo eliminazione degli import inutilizzati generati e correzione del percorso nel test; non indebolita la configurazione. Generazione inizialmente negata dal sandbox per letture di cartelle antenate, riuscita con escalation limitata al comando di build locale.
- `scripts/run-functions-emulator-local.mjs --vault-accounts`: **24 verifiche HTTP superate**, dati sintetici e progetto demo, sui veri export Functions. Copertura privata/aziendale: autenticazione, attestazione assente, altro UID, contesto fidato falsificato, salvataggio, retry invariato, riuso dell'operazione con dati diversi, concorrenza con un solo vincitore, revisione obsoleta, archivio e conservazione campi estranei. Prima esecuzione fallita per token App Check della fixture privo di sub; corretta solo la fixture, non la protezione. Token non firmato ammesso esclusivamente dall'emulatore: NON verifica di attestazione reale. Emulatori arrestati regolarmente.
- Revisione successiva della creazione candidata Account dal profilo: aggiunti due test che inizialmente fallivano per mancato rifiuto. Handler ora verifica kind/owner/revision della ricevuta e owner/id dei documenti sorgente/destinazione prima di scrivere. Suite creazione 10/10; insieme a collegamenti e adattatori backend **28/28**. Test transazionali simulati, non prova HTTP di questo terzo percorso che resta non esportato.
- Inventario statico senza modifiche al controllo: due export presenti su tredici, **11 mancanti**, VS-P0-01 e parità multipagina ancora bloccanti. Non migrate UI o Rules legacy; nessuna dichiarazione di app integrata o pronta al rilascio, nessun deploy/Git mutante. Numeri delle suite si sovrappongono e non vanno sommati come percorsi utente distinti.


## 27/09/2026 — M8 Storage: regole server-only e limite concreto dell'emulatore

- Prima proposta locale rifiutata: allow create più resource == null respinge la sostituzione sequenziale, ma due upload concorrenti sono entrambi riusciti nell'emulatore (asserzione 2 anziché 1). Non accettata come immutabilità e non distribuita. La proposta è stata sostituita: restoreObjects è escluso dal catch-all; nessun client può crearvi/sostituirvi/eliminarvi oggetti o metadati. Lettura solo owner. Percorsi ordinari invariati nelle prove.
- Node 22, `scripts/run-storage-rules-tests.mjs`: 10/10 Rules correnti su Firestore+Storage; 5/5 Rules condivisione candidata. Verificati tentativi concorrenti entrambi negati, accessi di altro utente/anonimo, prenotazioni server non falsificabili, sottopercorsi, MIME/limiti e compatibilità dei file ordinari. Questa suite prova il diniego client, NON una pubblicazione M8 completa.
- `functions/backup-attachment-stage.js`: candidato uploadStage controlla digest/dimensione prima della prenotazione, usa save non resumable con preconditionOpts.ifGenerationMatch:0, verifica byte della generazione precisa anche dopo 412, non converte 503 in successo. Retry non riscrive un oggetto già presente. 14/14 test del modulo, incluso contratto del trasporto simulato; Node 22 Functions 357/357. Nessun endpoint o client attivato.
- Probe separato `.codex-tmp/stage-precondition-probe.mjs` con vero Admin SDK su demo-stage-precondition e Storage loopback: prima save ifGenerationMatch:0 seguita da seconda save con la stessa precondizione. **FALLITO**: seconda scrittura riuscita e contenuto sostituito; preconditionEnforced:false, uscita probe 2 / runner 1. L'emulatore installato non certifica questa garanzia. Non inserito nel totale dei test superati e non trasformato in test verde di correzione. Occorre prova della stessa condizione, anche concorrente, su Storage separato autorizzato prima dell'accettazione finale; nessuna richiesta a Storage produttivo.
- Regressione backup 107/107; ESLint mirato superato dalla directory functions (prima invocazione dalla radice non trovava la configurazione, rettificata senza cambiarla). M8/PURGE-CAS e integrazione restano aperti. Emulatori spenti regolarmente, dati solo sintetici, nessun Git mutante o deploy.


## 27/09/2026 — hard-delete Azienda: guardia Rules, non protocollo completo

- Corretto `firestore.rules`: documento Azienda escluso dal catch-all owner; permesso esplicito read/create/update, delete negato. Il match dei discendenti richiede almeno raccolta/documento e non può concedere delete al padre per corrispondenza ricorsiva vuota. Nessun ampliamento dei permessi precedenti sui discendenti.
- Node 22, `scripts/run-company-hard-delete-emulators.mjs`: 4/4 su Firestore e Storage locali. Nuove prove: delete diretto respinto; batch delete figlio+padre respinto atomicamente; azienda vuota ancora protetta; create/update e discendenti del proprietario preservati; altro proprietario respinto. Le prove preesistenti comprendono una caratterizzazione dei residui purge Account, che NON certifica la loro correzione.
- Node 22, `scripts/run-firestore-rules-tests.mjs`: 73/73, emulatori terminati regolarmente. Dati sintetici, nessun deploy o dato reale.
- Limite: Admin SDK non vincolato dalle Rules; protocollo server 3B e coordinamento con restore/allegati ancora da implementare. Non dichiarare chiusi T-27/3B o preparazione globale al rilascio.
- DeepSeek Harness: sessione storica visibile in Read Only, invio disabilitato con richiesta di scegliere area di lavoro. Nessuna nuova richiesta inviata, nessuna modifica ai permessi, nessuna attività DeepSeek presunta.


## 27/09/2026 — R22: decoder reale e primitive M8 non attivate

- Difetto riprodotto con due prove inizialmente fallite: byte negativi/frazionari/fuori intervallo venivano convertiti da Uint8Array; date non valide o normalizzate e campi aggiunti ai tag tipizzati non erano rifiutati. Corretto `functions/backup-restore-service.js`: byte interi 0–255 in array denso, date ISO canoniche, timestamp nei limiti Firestore e forma esatta dei tag riconosciuti. È una modifica al decoder usato dal vero handler, non la soluzione del ripristino parziale.
- Primitive candidate nuove: `backup-attachment-stage.js` prenota per proprietario/operazione/sorgente/hash/dimensione, senza rinnovare implicitamente i sette giorni; esclude descrittori scaduti/in pulizia o pubblicati privi di file, verifica hash su generation testuale esatta e azzera il buffer scaricato. `backup-storage-rewrite.js` clona dati serializzati e modifica solo storagePath mappati; rifiuta accessors, prototipi speciali, simboli, mapping estranei/inutilizzati e valori tipizzati malformati. Limiti fissi del candidato, inclusi array fino a 10.000 elementi: compatibilità con tutti i backup ancora da integrare/verificare.
- DeepSeek R22 consultato in chat Read Only, con un riesame correttivo. Astra non ha copiato integralmente la proposta: restavano accessi non verificati, alias, schema record incompatibile e validazione incompleta dei tipi. Nessuna attestazione sul backend oltre l'etichetta UI osservata.
- Verifiche effettive Node 22: mirati 24/24; successiva regressione Functions **353/353**, zero fallimenti/skipped/todo; lint mirato senza errori. Nel totale sono comprese **16 prove sintetiche sulle primitive candidate**, non prove del ripristino integrato. Nessun nuovo test browser, Firebase emulato o provider remoto in questo checkpoint.
- Estesa la stessa validazione al preflight client di tutti i record prima della creazione dei chunk. Un record malformato in posizione 401 ora impedisce ogni callable/upload, invece di poter emergere soltanto dopo i chunk precedenti. Due nuove prove: parità frontend/backend su tipi validi e invalidi e servizio reale con sorgente sintetica malformata tardiva. Mirati Node 22 **51/51**; suite backup completa tramite npm **107/107** (runtime Node predefinito, non attestata qui come Node 22); sintassi **171 moduli** OK. Questo chiude il difetto dei tipi malformati prima delle scritture nel client corrente, non gli errori Storage/concorrenza.
- Documentazione **11/11**, elenco invariato **31 MD**, **606 collegamenti** verificati; diff-check dei file tracciati del checkpoint senza errori.
- Limiti obbligatori: primitive non esportate né importate dal runtime; nessuna nuova Rules o scrittura dati. Prima dell'attivazione occorrono immutabilità Storage effettiva, pubblicazione atomica riferimenti/descrittori/ricevuta con CAS, ripresa e preview, compatibilità dei lettori legacy, pulizia coordinata dopo sette giorni e protocollo comune con purge/upload. M8, PURGE-CAS e lavoro complessivo restano aperti; produzione invariata.

## 27/09/2026 — R21 allegati non verificabili

Rimosso il filtro che scartava silenziosamente gli allegati con storagePath assente/vuoto/falso prima della cancellazione. Ora la validazione interrompe il purge, conserva Account e riferimenti, non cancella nemmeno i file validi dello stesso elenco e non registra successo. Il test nuovo era rosso prima della correzione; poi verde. Adeguata la precedente prova che accettava implicitamente allegati legacy URL-only, aggiungendo un caso esplicito di conservazione invece di ometterne la copertura. Node 22: Functions 335/335, exit 0. ESLint passato sulla modifica runtime; non costituisce una prova distribuita. Restano aperti il conflitto concorrente prima di recursiveDelete e il protocollo Storage/Firestore comune. Il riesame correttivo DeepSeek R21 è concluso senza patch accettata e senza approvare nuovi comportamenti di sola cancellazione logica o pulizia manuale.

## 27/09/2026 — purge, controllo preventivo dei riferimenti e ricreazione finale

Due prove rosse prima della correzione e verdi dopo: piano dei riferimenti malformato/oltre budget ora respinto prima di Storage o recursiveDelete; Account ricreato dopo recursiveDelete ora impedisce unlink Profilo/Aziende, audit di successo e ricevuta purged. La verifica finale è nella stessa transazione della pulizia; non è solo una lettura preliminare. Fixture owner adeguata a simulare davvero la rimozione del documento, prima restituiva sempre l'Account.

Functions Node 22 **333/333** ed ESLint riusciti. Emulatore Firestore/Storage, vero corpo handler e veri SDK: **5/5**; caso malformato conserva documento, metadati, byte e collegamenti senza ricevuta; ricreazione iniettata dopo delete conserva nuovo documento e collegamenti lasciando processing. Gli altri tre casi T-21 conservano il percorso ordinario. Emulatori arrestati. Ricreazione iniettata non equivale al percorso completo restore concorrente. La caratterizzazione fra preparazione e recursiveDelete resta un difetto aperto: queste due guardie non chiudono PURGE-CAS né M8. Nessuna produzione o Git mutante.

## 27/09/2026 — rivalidazione backup e fixture degli emulatori

Il ripristino ricontrolla l'intero flusso autenticato prima delle scritture, anche al ritentativo: header, sequenza record, allegati e completezza devono coincidere con la preview privata. Quattro varianti di sorgente alterata dopo anteprima vengono rifiutate senza apply né upload. Aggiunta anche prova di sorgente cambiata dopo risposta persa: niente secondo invio, ma mayHaveApplied resta vero per il primo tentativo. Suite backup rieseguita: **105/105**. Non sostituisce staging server, controllo delle scritture concorrenti o ripresa in nuova sessione. Rieseguiti anche Functions Node 22 **332/332** ed ESLint, riusciti.

La regressione generale si era arrestata su T-21: il mock getBytes restituiva il buffer condiviso del seed, che l'export correttamente azzerava. Corretti cinque banchi affinché ogni lettura restituisca una copia indipendente, senza rimuovere la pulizia runtime o indebolire gli assert sui byte. Rieseguiti emulatori Firestore/Storage: T-21 **3/3**, interruzione **2/2**, nuova sessione **3/3**, preview obsoleta **3/3**, collisioni **4/4**; processi arrestati. I casi esplicitamente denominati «difetto osservato» confermano ancora riferimenti senza byte e mancata riparazione in nuova sessione: **M8 resta aperto**. Non attestata la regressione generale completa.

Completata anche la coda della regressione automatica dopo il gruppo ripristino, tutti i comandi con uscita 0: Vault sessione 17/17, mutazioni 41/41, selezione QR 2/2, testo profilo 3/3, contatti privati 2/2, contatti azienda 2/2, indirizzi 2/2, utenze 1/1, allegati documenti 8/8, allegati Storage/Rules 9/9, collegamenti profilo 2/2, note Account 1/1, Account standard 1/1. I conteggi includono eventuali test contenitore e non sono numeri di scenari manuali. Emulatori arrestati; verifiche candidate e handler confinati, non app distribuita o prova fisica. La precedente esecuzione monolitica era fallita: questa ripresa della coda non viene presentata come un singolo npm test integralmente riuscito. Documentazione verificata: 11/11, 31 MD, 606 collegamenti.

R20 DeepSeek, consultazione Read Only, non accettata come implementazione: nessuna primitiva Admin selettiva identificata; il percorso REST richiede token utente e restituisce token aggiornati. La proposta di sessione tecnica server introduce capacità di autenticazione distinta, con rischi di ricreazione account e concorrenza da risolvere. Nessuna attivazione o credenziale reale usata.

## 27/09/2026 — guardie recupero MFA e input purge

Correzioni locali: generazione recovery code con campionamento uniforme tramite crypto.randomInt; autenticazione recente accettata soltanto con auth_time intero valido, non futuro e non oltre 300 secondi. Recupero vincolato al localId della risposta positiva del primo fattore con idToken o mfaPendingCredential: lookup per UID, rifiuto account disabilitato, UID o email discordanti prima del consumo del codice. Non accettato il solo testo di errore MFA_REQUIRED. Validazione purge senza coercizione di identificativi/revisioni; revisione memorizzata malformata rifiutata, assenza legacy distinta.

Verifica effettiva: Node 22, Functions **332/332**, ESLint superato; suite recovery **7/7**, compresi otto casi negativi di binding e guardie prima dell'accesso ai codici. Test sintetici del vero corpo handler, non autenticazione distribuita. Il test di caratterizzazione del consumo del codice prima di errore Auth resta verde perché riproduce il difetto **ancora aperto**: non è recupero MFA risolto. Restano rimozione selettiva dei fattori originari, ripresa 15 minuti e race purge/restore. Nessuna prova con credenziali reali, nessun deploy.

## 27/09/2026 — ricevute recupero syncRecords

Corretti i veri handler trashSyncRecord/restoreSyncRecord: ricevute nel namespace root già negato ai client, vincolate a proprietario/azione/record/revisione/operazione; retry identico restituisce soltanto esito minimo. Ricevute legacy o corrotte non attestano successo e non autorizzano riapplicazioni. Ripristino controlla la revisione attesa; cestino già occupato non viene sovrascritto; identificativi coercibili e revisioni non sicure respinti. Nessuna modifica alla retention del cestino né migrazione dei dati esistenti.

Functions complete Node 22: **328/328**, lint riuscito. Test dei due handler con transazioni simulate e guardie owner: 24/24 (sottoinsieme, non sommare). Emulatore Firestore demo-vault-shell confinato 127.0.0.1:8085, veri SDK e Rules: **4/4**, inclusivo del contenitore; tre retry concorrenti producono una sola transizione, owner/estraneo/anonimo non possono falsificare la ricevuta root, cambio azione rifiutato, ripristino stale non muta e due ripristini identici sono idempotenti. Emulatori arrestati. Nessuna produzione o credenziale. Queste prove non chiudono PURGE-CAS, M8 o MFA.

R17 DeepSeek conclusa: read-back Storage non accettato come sostituto di precondizioni atomiche mancanti nell'emulatore. R18 consultazione in sola lettura sulla rimozione MFA condizionale/per-enrollment; nessuna proposta implementativa accettata al checkpoint.

## 27/09/2026 — R15 buffer, owner recupero, R16 PDF integrato

Astra ha applicato e verificato proposte DeepSeek in chat Read Only, correggendo la proposta di sessione PDF (flag locale insufficiente e listener non smaltiti). Nessun dato reale, credenziale, Git mutante o distribuzione.

- Allegati reali `attachment-security.js`: azzeramento in finally del plaintext temporaneo, chiave file e copia UTF-8 Vault anche su errori import/encrypt/derive/wrap/decrypt/lettura. WebCrypto reale con spie per riferimento e guasti: 18/18; File, ciphertext del chiamante e plaintext restituito preservati. Non garantisce cancellazione di stringhe immutabili, CryptoKey o copie interne della piattaforma. Suite allegati 53/53: include caratterizzazioni di residui NON risolti. Un assert obsoleto che pretendeva il vecchio deleteDoc Azienda è stato sostituito con verifica del servizio protetto, senza rimuovere le prove dei byte residui.
- `trashSyncRecord`/`restoreSyncRecord`: proprietario atteso obbligatorio prima di qualsiasi accesso Firestore. Test sugli handler reali con trasporto simulato: mancanti/malformati/cambio UID rifiutati, percorsi positivi preservati; suite owner 13/13. Nessun chiamante frontend di questi due endpoint trovato. Vecchi client senza campo vengono rifiutati; ricevute legacy del recupero restano un limite distinto. Functions Node 22: 317/317; lint OK.
- R16 PDF: portati i moduli e gli asset del commit locale `9d0f7065` tramite patch selettive, NON merge né sostituzione dei file correnti. Linguetta in dati_azienda, caricamento differito, build vendor/font locali e offline; nessun bump versione. Hook protetto da generazione/identità anche A-B-A, pagehide, lock e nodo rimosso; panel ascolta il vero evento vault-session-locked. Predicato sincrono RAM/UID/softlock/scadenza senza sblocco automatico. Test PDF 31/31 più 2 del rilevamento import = comando test:company-pdf 33/33; session-races 18/18. Generatore reale verificato con PDF sintetico di tre pagine, render Poppler e ispezione di tutte le pagine: testo lungo, accenti, continuazioni e numerazione leggibili, nessun taglio osservato. Non prova scaricamento/condivisione nativa su dispositivi o pagina Firebase completa.
- Build locale riuscita dopo autorizzazione del compilatore fuori sandbox, 59 export Firebase/250 asset. Controllo riferimenti inizialmente fallito per regex che interpretava testo `from` del vendor come import: applicata correzione selettiva già presente nel commit PDF e prove che mantengono i riferimenti reali, inclusi side-effect import; riferimenti 245 file OK. Offline 14/14, budget 30 pagine OK, sintassi 171 moduli OK, CSS OK, navigazione 152/152, sicurezza 88 controlli statici +25 test. Profilo inizialmente 157/160 per listener eager: inizializzazione spostata all'effettiva apertura del profilo, poi 160/160; nessuno stub aggiunto per nascondere l'effetto collaterale.

Questi conteggi non si sommano in un certificato globale. PURGE-CAS, M8 staging/ripresa, MFA, pulizie/retention e sostituzione multipagina restano aperti. R14 ha confermato che una seconda lettura Firestore non rende atomiche le delete Storage; nessuna falsa correzione di quel protocollo applicata.

## 27/09/2026 — D5 ripristino autorità e limite frequenza

- Functions complete Node 22: 313/313 dopo correzione autorità, inclusi Account archiviati; lint superato.
- Emulatore Firestore demo-vault-shell confinato 127.0.0.1:8085: 3/3 inclusivo del contenitore, eseguito con veri SDK e Rules per Account privati/aziendali, destinatario revocato negato, corrente attivo consentito, grant archiviato negato, retry idempotente e CAS stale. Arresto emulatori riuscito. Non è test cloud.
- UI backup in VM: 21/21, incluso testo di conferma su dati cancellati e condivisioni; non prova browser di questa nuova avvertenza.
- Modello configurazione e vero salvataggio estratto: 6/6, interi 1–30 ammessi, valori fuori limite respinti prima di upload/scritture, vecchio 90 preservato in lettura. Con UI backup esecuzione combinata 27/27.
- Cinque fixture emulatore backup aggiornate per nuova dipendenza: non rieseguite in questo checkpoint. Anche fixture rimozione allegati aggiornata ma non rieseguita.
- M8 parziale/orfani, PURGE-CAS e MFA non chiusi da questi conteggi. Nessuna produzione, credenziale, invio reale o deploy utilizzato.

## 27/09/2026 — M8 memoria temporanea, protocollo ancora aperto

Import ed export ora azzerano i buffer binari temporanei degli allegati dopo uso, errore e invalidazione della sessione. La validazione preview rilascia immediatamente la copia decodificata; anche il rifiuto per dimensione decodificata la azzera. Non equivale a cancellazione garantita delle stringhe base64 o delle copie interne SDK/GC. Test sessioni 60/60; regressione mirata backup (modelli, UI, sessioni, crittografia e header) 96/96, con dati sintetici. Nessuna prova di staging/ripresa completata da questi conteggi.

Ispezione del runtime conferma ancora commit Firestore prima di upload Storage, possibile ripristino parziale e filtro degli invariati che impedisce riparazione dei byte in nuova sessione. Proposta DeepSeek M8 respinta: ricevute nel sottoalbero owner non protetto, pubblicazione canonica visibile prima del CAS, writer legacy concorrenti e risposta persa della copia non risolti. I riferimenti osservati dai lettori sono storagePath in chiaro: non assumere che tutti siano dentro ciphertext. Serve protocollo coordinato server/Rules/lettori, non mero riordino delle chiamate. Nessun nuovo consenso richiesto sulle decisioni M8 già approvate; lavoro tecnico non concluso.

Verifica finale R13: intera suite Functions eseguita con Node 22, **304/304**; ESLint riuscito. Le 96 prove backup includono caratterizzazioni del comportamento parziale tuttora difettoso: non sono 96 difetti risolti. Emulatori di questa sessione arrestati, nessun listener sulle porte 4188/8085/9099/9199 al controllo. Nessun commit, push, deploy o dato reale.

## 27/09/2026 — R13 registro consegne destinatari

Integrato recipient-delivery-ledger.js nei due sender reali di functions/index.js: email e push destinatari/dispositivi, non notifiche N1 né registro push owner. Claim atomico con lease cinque minuti, esito condizionato al token, cadenza del giorno italiano, rilettura eleggibilità e dispositivo prima dell'invio. Riparata anche la disabilitazione di token sostituito nel frattempo: l'errore del vecchio token non disabilita quello nuovo. Rimossi i controlli di cadenza globale che sopprimevano destinatari falliti; vecchi marcatori usati soltanto come pavimento transitorio senza attribuire successi individuali. Nessun messaggio/indirizzo/token provider persistito nel registro, nessun errore raw nel nuovo percorso.

Test unitari mirati 38/38, incluso vero corpo dei sender in VM con trasporti sintetici: esclusione invii concorrenti, retry solo falliti, cambio token, cadenza/DST, completamento DB fallito dopo invio accettato, lease scaduto e chiusura tardiva, migrazione conservativa, guardia frequenze oltre 30 giorni. Emulatore Firestore 5/5 (quattro sottocasi più contenitore): tre claim concorrenti un solo invio sintetico autorizzato, retry indipendente, lettura/scrittura registro negate a owner/estraneo/anonimo, rimozione record scaduti. L'ultima estensione della guardia frequenze e del pavimento legacy è coperta da unitari, non da una nuova esecuzione dell'emulatore. Nessun SMTP/FCM vero. Prima regressione generale 292/298: sei fixture scheduler non adeguate alla nuova dipendenza/cadenza; corrette esplicitamente, seconda esecuzione 298/298 prima delle sei prove aggiuntive. ESLint e audit sicurezza 88 controlli riusciti prima dell'ultima estensione.

DeepSeek consultato sola chat fino a 105 turni/447 passi: respinti namespace sotto users scrivibile dal client, campi identificativi superflui e guardia sent permanente; riesame successivo distingue problemi reali da ipotesi errate (expiresAt viene rinnovato nel claim). Limiti e scelta aggiuntiva cadenza >30 giorni in AUDIT; cleanup 500/giorno richiede verifica capacità/attivazione distribuita e non attesta TTL fisico esatto. Gli esiti incerti sono ritentabili con possibile duplicato, non exactly-once. Nessuna chiusura globale o rilascio.

## 27/09/2026 — R12 allegati: integrazione locale effettiva

Composto il provider nella sezione Documenti dell'entry candidata con repository Firebase SDK e Storage emulato, non mock. Ponte HTTP locale upload/remove autenticato tramite token Auth verificato e allowlist UID fixture; Host/Origin/progetto demo vincolati, attestazione sintetica confinata al laboratorio, nessun trusted proveniente dal browser. Trasporto base64 canonico con limite derivato dai byte cifrati; non esportabile tale quale in produzione (dimensioni richiesta e memoria da progettare sul trasporto distribuito). Conferma eliminazione collegata; rimossi dal provider integrato i pulsanti documento senza azione.

Riprodotto e corretto il caricamento in memoria di file sovradimensionati prima del rifiuto. Controllo intestazione coerente con MIME per PNG/JPEG/WebP/HEIF, non scanner antivirus né decodifica completa; buffer rifiutati azzerati. Rules candidate Firestore negano scritture dirette metadati/ricevute. Corretta anche la trasformazione Storage candidata: namespace profile-documents escluso dalle concessioni generiche owner, tutte le mutazioni passano dal servizio; politiche degli altri namespace invariate. File Rules di produzione non modificati.

Esecuzioni Astra: laboratorio 751/751, zero falliti/saltati; test indipendenti wire/firme/repository 14/14; Auth/Firestore/Storage 9/9 (sei sottocasi più contenitore e due test Rules); HTTP con Auth/Firestore/Storage 5/5, ripetuto dopo il caricamento delle Rules candidate finali. Verificati upload cifrato, retry idempotente, byte scaricati decifrabili con AAD atteso, cancellazione del solo allegato senza eliminare il documento, rifiuto identità/attestazione mancanti, owner estraneo e wire malformato. Compilazione locale riuscita. I totali di suite diverse non sono un conteggio deduplicato di requisiti.

Browser Chrome reale via CUA su 127.0.0.1:4188: login/sblocco fixture A, pannello allegati montato; apertura immagine sintetica precedentemente caricata tramite servizio, immagine decifrata 24×24 verificata (blob locale); blocco Vault elimina la vista; logout/login B mostra galleria vuota. Upload tramite selettore file NON passato: estensione rifiuta setFiles finché manca Allow access to file URLs; non aggirato, indicazione comunicata. Nessuna cancellazione definitiva cliccata nel browser; copertura servizio distinta. Verifica visiva precedente alla sola stretta finale Storage, poi percorso HTTP rieseguito con regole finali.

DeepSeek consultato Read Only (riesame R12, 103 turni/445 passi), proposte verificate da Astra: nessuna esecuzione attribuita al consulente. Analisi separata MFA-RESUME non accettata: rilettura/sostituzione intera lista fattori Admin Auth non protegge da nuova iscrizione concorrente; nessun cambiamento MFA applicato. R12 chiude il collegamento locale mancante, NON bootstrap multipagina, VS-P0-01, export callable produttivi, replica distribuita delle precondizioni Storage o riconciliazione globale. Produzione e Git invariati.

## 27/09/2026 — R10-INTEGRATION-INVENTORY

Eseguito il nuovo inventario statico in sola lettura scripts/audit-vault-integration.mjs: risultato BLOCKED, 13 chiamate candidate tutte presenti nel ponte locale e assenti dagli export onCall del checkout produttivo; provider allegati non composto, ingresso multipagina e persistenza wrapping legacy ancora presenti. Dettagli e limiti in AUDIT. È un controllo negativo di preparazione, non una suite superata né tredici difetti nuovi. Nessuna regressione applicativa rieseguita in questo checkpoint: 749/749 resta l'esecuzione precedente, non una nuova attestazione.

## 27/09/2026 — R10-ATTACH-SELECTION

Corretti nella candidata allegati sei casi riprodotti con test inizialmente falliti: cancellazione/upload tramite eventi in sola lettura; conferma cancellazione risolta dopo dispose; caricamento che ridisegna una vista già disposta; load fuori ordine che cambia il documento selezionato; cambio documento durante lettura file prima della pianificazione; chiusura durante decifratura che ricrea un'anteprima. Guardie di selezione e ticket dopo le attese, invalidazione immediata delle anteprime, azzeramento dei buffer rifiutati e handler inerti dopo dispose. Gli invii già effettuati non vengono annullati retroattivamente. Nessun cambiamento di retention o permessi backend.

Regressione completa laboratorio eseguita: 749/749, zero falliti o saltati. Sono prove automatiche sintetiche, non 749 interazioni browser né certificazione dell'app distribuita. Aggiornata una precedente asserzione per misurare la singola chiusura esplicita separatamente dalle nuove chiusure preventive al refresh. Nessuna nuova prova Firebase o browser di questo sottoinsieme dichiarata.

DeepSeek ha consegnato riesame in sola chat (99 turni/441 passi): verificati i suggerimenti su ticket, ID richiesto e guardie canWrite; non copiata la proposta remove(selection), che confonde documento e identificativo allegato, né l'asserzione che il precedente plaintext non fosse già azzerato. Scrittura e test eseguiti da Astra. Consultazione conclusa. Restano aperti integrazione multipagina, VS-P0-01 e gate globali; il verde del laboratorio non li chiude.

## 27/09/2026 — R10-SESSION-LIFECYCLE

Il confine browser della sessione candidata possiede ora attività pointer/keyboard, blocco hidden/freeze/bfcache e controllo periodico della scadenza (1000 ms, timeout Vault invariato). Rimossi i cinque collegamenti duplicati/non smontabili dell'entry laboratorio. Detach idempotente elimina listener/timer e rende inerti callback già accodate; rollback delle registrazioni su setup fallito. Firebase session dispone il coordinatore se il binding fallisce. Tre nuove prove inizialmente fallite, poi superate; aggiunte prove su timer fallito, remount e scadenza reale del Vault con orologio controllato.

Riprodotto e corretto anche il riavvio della preparazione offline da un evento online prima dello sblocco, dopo clear o per altro UID. Reconnect resta consentito per la preparazione esplicitamente avviata dal bootstrap sbloccato dello stesso UID; clear revoca tale attivazione. Due nuove prove rosse prima della patch, poi verdi. Nessuna nuova politica di cache/retention; richieste SDK già inviate non sono annullabili.

Verifiche eseguite: laboratorio 743/743 senza falliti/saltati; Auth/Firestore demo-vault-shell 16 sottocasi più contenitore (17/17) incluso background/freeze/bfcache attraverso Firebase session con eventi sintetici. Compilazione candidata riuscita; primo tentativo esbuild bloccato da accesso alle cartelle, ripetizione autorizzata riuscita. Emulatori arrestati normalmente.

Browser Chrome su banco isolato 127.0.0.1:3094, CSP connect-src none, moduli reali memory-vault/protected-session/boundary/offline-preparation, identità e lettura sintetiche: dato visibile dopo sblocco; timer reale e orologio avanzato eliminano il dato; riconnessione non incrementa le preparazioni da bloccato; lettura negata; evento pageshow persisted simulato blocca; revoca dispone e impedisce nuovo sblocco/lettura. Non è app completa, Firebase nel browser, bfcache reale né dispositivo fisico. Banco e scheda chiusi.

DeepSeek consultato in Read Only, proposta sola chat verificata da Astra: accettati ownership/cleanup e guardie tardive; respinta la proposta di touch al pageshow persisted, conservato lock bfcache. Nessuna esecuzione attribuita al consulente. Non chiusi bootstrap multipagina/VS-P0-01 né gate globali.

## 27/09/2026 — R10-BINARY-BRIDGE

Collegati sealImage/openImage da Firebase session al legacy adapter e al Vault RAM del candidato. I due test adapter inizialmente fallivano per metodo assente; ora usano i 32 byte della chiave primaria casuale già esistente, anche nel contenitore CPVK2. Nessuna derivazione silenziosa da testo legacy, nessun fallback alla chiave legacy e nessuna migrazione. I buffer temporanei di decodifica sono azzerati; non si promette cancellazione fisica delle stringhe JavaScript.

Eseguiti: laboratorio 736/736, zero falliti/saltati; Auth/Firestore locali demo-vault-shell 15 sottocasi più test contenitore (16/16 nel runner), incluso round-trip binario attraverso sessione reale SDK, AAD errato, revoca della route/lock e impostazioni non riscritte. Emulatori arrestati normalmente. Non è un test browser, Storage o bootstrap multipagina di produzione. Le prove aggiunte coprono materiale malformato/non canonico ed esecuzioni parallele con buffer indipendenti.

DeepSeek ha riesaminato in chat Read Only la descrizione del collegamento, senza eseguire test. Accolti test su errori fissi e concorrenza; non introdotta una euristica di entropia sulle chiavi esistenti. AAD resta costruito dalla capability di dominio già verificata, non dal decodificatore crittografico. VS-P0-01 e riconciliazione globale restano aperti: questo checkpoint non certifica il rilascio.

## 27/09/2026 — R10-ATTACH-CANCEL

Corretto nel candidato RAM il confine source degli allegati: dopo lettura file e preparazione asincrona ora ricontrolla sessione/proprietario/revoca prima di chiamare upload o remove; ogni iterazione riparte con controllo e azzera il proprio buffer in finally. Controllo anche dopo servizio, senza promettere revoca di richieste già inviate. Tre nuovi test inizialmente falliti, poi superati: buffer dopo errore planner, annullamento durante lettura/preparazione anche con piano rifiutato, remove dopo abort/lock/cambio UID. Quarto test conferma che un upload già inviato può completarsi ma non parte il secondo file. Riparata una vecchia asserzione vacua: il contatore del servizio nel caso piano rifiutato ora è collegato alla funzione realmente chiamata.

Regressione laboratorio eseguita: 732/732, zero falliti/saltati. Test source con planner/servizio simulati: non prova concorrente Firebase, non test browser né integrazione globale. DeepSeek consultato in UI Harness, Read Only invariato: proposta in sola chat su estratto circoscritto, nessuna esecuzione o lettura file richiesta. Accettati guardie post-await e finally; conservati codici/controlli esistenti senza introdurre classificazione degli errori tramite stringhe. Astra ha riprodotto, applicato e verificato. Nessuna modifica a retention, formato, produzione o protocollo backend; gate globali invariati.

## 27/09/2026 — RICONCILIAZIONE-10, rifiuti anticipati e mount allegati

Due regressioni riprodotte prima della correzione nel candidato di laboratorio: sealImage lasciava intatto il buffer ricevuto quando rifiutava prima della cifratura; un errore nella lettura iniziale dei documenti lasciava tre listener di abort attivi. Corretto il finally della capability includendo validazione/sessione/identità; aggiunto controllo di revoca dopo il digest. Il provider ora smonta source, reader e capability anche in errore; source e reader rimuovono i propri listener alla disposizione.

Nuove prove rosse poi verdi: rifiuto anticipato per abort, proprietario diverso, lock e identità documento invalida (un test con quattro casi); fallimento lettura iniziale, assenza di listener residui e nuovo mount riuscito. Gruppi mirati 11/11 e 6/6; regressione laboratorio 728/728, zero saltati o falliti. Controlli sessione legacy 28/28 eseguiti separatamente: non certificano la sicurezza della persistenza legacy. Nessun backend reale, browser o emulatore usato per questi due nuovi test; DOM e repository del provider sono sintetici. Nessuna modifica al runtime pubblicato o ai formati crittografici. VS-P0-01, PURGE-CAS e gli altri gate restano aperti; il numero di test passati non attesta la preparazione globale al rilascio.

## 27/09/2026 — seguito RICONCILIAZIONE-10, allegati incorporati

Correzione candidata RAM: buffer binari decifrati dopo lock/cambio route/revoca e anteprime respinte o con errore Object URL non venivano azzerati. Tre nuove prove inizialmente rosse; correzione nei confini memory-vault, protected-session, capability documenti e source anteprime. Gruppo mirato 27/27, regressione completa laboratorio 726/726. Azzerati i buffer posseduti e rifiutati da quei confini, non certificata cancellazione fisica di ogni copia nella memoria del motore JavaScript. Nessun formato, KDF, persistenza o runtime pubblicato modificati; VS-P0-01 resta aperto. Lint del nuovo test PURGE-CAS e diff-check superati (soli avvisi CRLF).

Regressione Functions successiva su Node22: 291/291, comprende le caratterizzazioni dei limiti MFA e PURGE-CAS, che restano aperti. R10-VS-BRIDGE consegnato da DeepSeek senza scritture/esecuzioni: proposta di uniformare AUTH_REQUIRED/AUTH_CHANGED non applicata, perché non dimostra un difetto del percorso reale attraverso memory-vault e non colma il collegamento mancante. Nessun incarico DeepSeek ancora in esecuzione a questo checkpoint.

Ulteriore verifica: Firestore+Storage emulati, profilo documenti/allegati 9/9 con demo-vault-shell, arresto regolare. Le precondizioni di versione sono rifiutate dall'adapter; il banco dichiara che l'emulatore Storage non ne certifica l'enforcement nativo. Editor utenze/creazione Account 13/13. Questi banchi non collegano automaticamente le capacità binarie a createFirebaseSession e non attestano l'integrazione completa nel bootstrap dell'app.

PURGE-CAS: nuova caratterizzazione sull'handler reale estratto, Node22 4/4 nel gruppo purge-profile-cleanup-handler. Iniettata una nuova revisione non archiviata dopo la preparazione e prima della cancellazione ricorsiva: viene eliminata e l'operazione risulta purged. È un difetto riprodotto nel modello di interleaving, NON corretto e NON collaudo concorrente del restore reale o delle Rules. Nessun cambiamento al protocollo di cancellazione/conservazione.

DeepSeek R10-VS-MAP consegnato in Read Only; proposta di mantenere vault-session persistente come API unica non applicata perché non risolve VS-P0-01. Il file real-lists-entry è una demo con repository sintetico, mentre emulator-entry usa createFirebaseSession: i due livelli non sono equivalenti. Riesame mirato del collegamento candidato in corso, nessuna promozione automatica del laboratorio nel runtime.

Emulatori demo-vault-shell: documento/allegati 8/8; poi nove comandi terminati con exit 0 per testo profili, contatti privati, contatti azienda, indirizzi, utenze, link profilo, note Account, campi standard Account e selezione QR. Processi arrestati regolarmente tra i banchi. Sono percorsi candidati con transazioni/Rules emulati e dati sintetici, non distribuzione delle Rules candidate né integrazione completa della shell. CLI Node22 e, nel ciclo dei nove comandi, PATH temporaneo impostato sullo stesso Node22 per i figli; nessuna impostazione persistente cambiata. Le negazioni PERMISSION_DENIED sono assert negativi attesi.

Browser salute credenziali: renderer reale estratto con report/action sintetici, letture/rete assenti. Avvertenza cache visibile, indicazione provider online disattivato, Escape chiude il dialogo e restituisce focus. Non collaudo screen reader o certificazione di freschezza. Server della sonda arrestato. Dopo le ultime correzioni build offline, sintassi 165 moduli, budget 30 pagine e documentazione 31 MD/606 collegamenti/11 test superati.

Checkpoint successivo: avatar esteso a lock/pagehide con UID invariato; nuova prova inizialmente fallita, poi superata durante upload/URL/update. Profilo 160/160. Allegati 39/39 (10 dedicati T-29/lifecycle), inclusi callback di rendering precedente e rifiuto getBytes dopo lock senza errori tardivi; ultima ipotesi suggerita da DeepSeek e verificata da Astra, non difetto aggiuntivo. Gli orfani restano residuo esplicito e non sono cancellati dalla classificazione del consulente.

Regressione indipendente rieseguita: security 25/25 più audit, pagine/shell/UI/HTML/riferimenti statici/lightweight/CSS senza errori bloccanti, assistant 4/4, fixture maturità 4/4, crypto 2/2, sharing 38/38, offline-write 203/203, backup 99/99, salute 12/12. Dependencies non rileva cicli ma salta 37 riferimenti (assoluti browser, querystring, CDN): non copertura completa del grafo. UI conserva un avviso baseline per testo da 10px nell'assistente. Vault-contract riuscito, incluso laboratorio 723/723, non integrazione RAM nel runtime. Functions eseguite con Node 22: 290/290, incluso il test che riproduce il limite MFA, non lo risolve. Nessun npm test completo dichiarato.

Ulteriori prove browser isolate: funzione reale runProfileEdit estratta con import dinamico nativo verso editor sintetico; verificati assenza caricamento anticipato, scarto dopo cambio UID, percorso positivo e scarto dopo distacco DOM. Avatar: codice reale estratto, servizi/validatore/file sintetici, cambio UID durante upload e salvataggio positivo singolo verificati; pulita soltanto la chiave cache sintetica creata dal banco. Server locali arrestati. Non sono collaudi dell'intera pagina Firebase né prova della validazione del file.

QR: riprodotto ReferenceError showToast dopo overflow in entrambe le utility; eliminata chiamata globale inesistente, mantenuto avviso inline. Suite profilo 158/158 dopo la correzione; poi aggiunta prova del fallback vendor con payload HTML ostile, gruppo contact-card-photo 8/8. Il testo non entra nell'HTML della tabella con colori costanti: non è certificazione generale del vendor. Build offline riuscita (59 export, 244 risorse) dopo blocco filesystem del primo tentativo; offline 14/14, data-access 95/95, budget 30 pagine e sintassi 165 moduli superati prima della successiva correzione QR.

Guardie di apertura aggiunte al modulo aziendale incorporato: UID, blocco Vault, uscita pagina e validità del rendering; controlli ripetuti dopo ogni attesa. Nessun cambio a cifratura, host ammessi o conservazione. Test dedicati 8/8; gruppo allegati 37/37, navigazione 150/150, profilo 157/157. I gruppi includono caratterizzazioni di residui ancora presenti: questi conteggi non significano altrettanti difetti risolti. Apertura cifrata positiva eseguita con cifratura reale e servizi sintetici; nessuna consegna browser certificata da questo banco.

Rettifica del rilievo popup: con noopener window.open può restituire null anche aprendo la scheda ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)). Il banco non prova un blocco del popup; rimane un limite di osservabilità. Non rimossa la protezione noopener/noreferrer.

## RICONCILIAZIONE-10 — checkpoint locale, 27/09/2026

Seguito autonomo: risolto anche ricerca durante loading/errore dell'Archivio, che prima mostrava falso vuoto. Nuovo test inizialmente rosso e poi verde; aggiunti casi di errore tardivo dopo rimontaggio riuscito e blocco Vault, senza toast/stato obsoleto. History finale 110/110. Browser Chrome su localhost: due scenari (errore con ricerca, nuovo caricamento riuscito) osservati PASS con UI/servizio/dom-utils reali e backend simulato, CSP connect-src none; banco temporaneo .codex-tmp/archive-ui-probe.mjs, processo arrestato. Non è E2E Firebase né collaudo fisico/accessibilità completo. DeepSeek ha suggerito i due casi di invalidazione, eseguiti da Astra; il generico rischio di annullamento trasformato in errore non si riproduce perché check e loadActive lo escludono. L'aggregato fallito non mostra più dati parziali; resta utilizzabile il filtro per singolo contesto, non è stata introdotta una politica di cancellazione.

MFA: Node22 recovery-security 4/4, incluso nuovo caso di caratterizzazione consumo-prima-di-errore-Auth (problema aperto, non correzione). Lint del file superato. Offline 14/14 più audit 244 risorse; sicurezza 88 controlli statici e 25/25; hardening statico superato (non attesta enforcement distribuito). Nessun accesso al servizio Auth reale. Controlli riferimenti239/HTML31/docs11 della ripresa precedente superati; nessuna inferenza di release readiness.

Non costituisce chiusura globale: registro operativo in AUDIT ancora in corso. DeepSeek consultato attraverso Harness in Read Only soltanto sulla classificazione dei rilievi; nessuna esecuzione o verifica del repository attribuita al collaboratore.

- Lotto residui avatar/allegati/aziende/copie/cache/legacy/backup/notifiche: 105/105. Include caratterizzazioni di difetti tuttora aperti, non 105 correzioni.
- Avatar: aggiunte guardie dopo operazioni asincrone contro cambio UID, nuovo caricamento e rimontaggio. Avatar e copie 15/15; profilo 157/157. Non annulla scritture già inviate né rimuove file orfani; collaudo browser della modifica pendente.
- Archivio parziale: tre nuove prove inizialmente fallite per mancata segnalazione delle sorgenti indisponibili; dopo correzione lista 9/9 e history 107/107. La pagina sostituisce il caricamento con errore. Il comando inesistente test:archive-history non ha eseguito test; usato poi il corretto test:history-prototype.
- Caricamento differito account e rivalidazione salvataggi: precedente esecuzione mirata 7+8 prove superate; non collaudo browser.
- Build offline rigenerata con 59 export/244 risorse dopo diniego sandbox del compilatore e riesecuzione autorizzata. Sintassi 165 moduli, budget 30 pagine e diff check superati.
- Corretta la descrizione del test copie: l'assenza di indicatori XLSX/print nel checkout non dimostra assenza generale di PDF/Excel in produzione.
- Salute credenziali 12/12: una nuova caratterizzazione conferma fallback cache dopo errore della lettura confermata, non attesta freschezza. Aggiunta avvertenza nel pannello sul possibile mancato aggiornamento rispetto agli altri dispositivi; verifica visiva pendente, comportamento di lettura invariato.

Nessun deploy, operazione Git mutante o dato reale. Restano distinti le prove sintetiche eseguite, i difetti riprodotti e i controlli browser/distribuiti non eseguiti.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Gli esiti conservano versione, data, dispositivo e limiti. La procedura riutilizzabile è in procedure/COLLAUDI; un risultato storico positivo non vale automaticamente per una build successiva. Nuove esecuzioni si aggiungono qui come sezioni datate, senza nuovi MD.

## Indice delle fonti conservate

## PREPARAZIONE-09 — regressione estesa locale, 27/09/2026

Autorizzazione autonoma e scelta invii incerti in DECISIONI. Eseguite 27 voci npm locali indipendenti senza fermare il lotto al primo errore; log per suite in .codex-tmp/*-release-check.log. Prima esecuzione: quattro suite rosse (Vault, performance, offline-write, history). Le altre 23 concluse con exit 0. Non è esecuzione integrale di npm test né certificazione di tutti i gate M10.

Correzioni e riesami:

- Banco allegati: attesa fissa di 10 ms sostituita, per upload/rimozione, con attesa della condizione osservabile e timeout che fallisce. Nessun assert soppresso. Vault ripetuto: 28 test sessione e 723 shell superati.
- Banco archivio: caricati helper reali credential-decrypt-guard e EventTarget per le dipendenze aggiunte dalla correzione precedente. History ripetuto: 104/104; nove montaggi archivio passano anche dopo caricamento differito.
- Offline-write: 202/203 su Node 22 perché la prova Web Locks richiede navigator.locks nativo. Su Node 24.12.0: 203/203, senza modificare test o runtime per nascondere il limite. Functions su Node 22.16.0: 289/289.
- Budget: inizialmente due form 44 moduli contro 43 e profilo privato 338.1 KB gzip contro 337. Ora salvataggio dei form caricato a richiesta; contesto originario mantenuto e verificato dai servizi, archiviazione tardiva annullata dopo rimontaggio, errore import gestito con possibilità di riprovare. Controlli avatar caricati a richiesta e UID ricontrollato prima dell'upload. Budget invariato: 30/30 pagine conformi. Aggiunta suite account-lazy-save (5/5); banchi avatar aggiornati a caricare il vero helper attraverso il punto di import simulato, non una validazione fittizia.
- Runner Vault: configurazione CLI isolata e credenziali ambientali escluse; il primo tentativo dei 12 casi era fallito prima dei test per accesso alla configurazione personale. Seconda esecuzione isolata: mutation 41, QR 2, testo 3, contatti 2, contatti aziendali 2, indirizzi 2, utenze 1, allegati 8, allegati+Storage 9, link 2, nota 1, credenziali standard 1: **74/74**. Tutti exit 0, emulatori arrestati. Progetto demo-vault-shell, dati sintetici, non collaudo visuale della nuova UI.
- Rules Firestore 73/73; Storage 5+5 e dispatcher 3/3. Build offline ripetuta con Node 22: 59 export e 244 risorse; prima prova bloccata dai percorsi esbuild nella sandbox, riuscita con escalation autorizzata.

Regressioni dopo caricamento differito: offline, security, data-access, navigation, performance-budget, js-syntax, static-references e profile tutte exit 0. Le prove VM sostituiscono soltanto il caricamento del modulo, non verificano il trasferimento HTTP reale del chunk. Le prove storiche browser non vengono attribuite a queste nuove modifiche.

Restano: contratto/retention anti-duplicati per push destinatari ed email (ritentativo incerto già approvato, non ancora implementato); compatibilità client/backend e candidata integrata con master/PDF da collaudare dopo ordine di integrazione; gate fisici, audit indipendente e servizi reali. Nessun commit, merge, push, deploy o dato reale. Non dichiarare il progetto pronto al rilascio.

## NOTIFICHE-08 — chiusura controlli Node 22 e concorrenza, 26/09/2026

Usata copia isolata .codex-tmp/node22-check/node.exe, versione 22.16.0 scaricata da nodejs.org dopo autorizzazione dello strumento e confronto SHA-256 con SHASUMS256.txt dello stesso distributore. Nessuna sostituzione dell'installazione globale, modifica manifest o dipendenza. PATH modificato solo nei processi di prova. Non si afferma che questa minor sia la più recente né che sia certificato un runtime cloud.

Esiti Node 22: test:functions-security **289/289** con sintassi/ESLint; deadline-model, deadline-reminders, deadline-list-calendar e functions-emulator-targets **28/28**; run-functions-emulator-local **6/6**, exit 0 e messaggio «Using node@22 from host». Tutti gli emulatori arrestati dal runner. Superato il precedente limite Node 24 per questi specifici scenari. Nessun invio SMTP/FCM, account reale, deploy o Git mutante.

Tre nuove prove di concorrenza nei banchi esistenti: push proprietario mantiene un solo send mentre il primo è sospeso, con transazioni simulate serializzate e timestamp valido; due chiamate destinatari sulla stessa scadenza tentano due send; due chiamate email producono due sendMail. Queste ultime prove verdi sono caratterizzazione di un **rilievo aperto**, non accettazione anti-duplicazione. I sender destinatari/email non prenotano atomicamente l'invio; il marcatore successivo non impedisce a invocazioni con snapshot già eleggibili di procedere. Una deliveryTag identica non dimostra assenza di tentativi duplicati né consegna exactly-once.

Limiti: il banco proprietario assume atomicità transazionale e non prova Firestore distribuito, conflitti reali, scadenza lease con primo invio ancora attivo o crash dopo accettazione provider. La correzione destinatari/email richiede contratto di idempotenza/prenotazione, gestione esito ambiguo e conservazione dei record; non introdotta implicitamente come parte del collaudo e non derivata dal registro N1 di altra funzione. Restano separati invii reali/dispositivi, recupero parziale e validazione UTC rinnovo ricevute. Controlli conclusi, non certificazione generale dell'app.

Skill astra-flash-orchestrator letta; tentativo di accesso UI Harness 127.0.0.1:3080 bloccato dal browser. Nessun aggiramento, nessun nuovo incarico o risposta DeepSeek in questo passaggio: test e valutazione eseguiti da Astra.

## NOTIFICHE-08 — prove residue del recupero, 26/09/2026

Modificato solo il banco functions/test/deadline-push.test.js: aggiornamenti e disabilitazioni persistono nella memoria del fake, query scadenze/device coerenti e orologio avanzabile. Tre nuove prove: scheduler checkDeadlines e sender destinatari reali nello stesso VM con Firestore/Auth/FCM simulati; assenza device/errori invalid-argument e quota-exceeded; token invalido insieme a errore temporaneo, con esclusione del token disabilitato dalla query successiva.

Sequenza sintetica con scadenza 30 settembre e frequenza sette giorni: errore server-unavailable il 26 conserva il marcatore del 18; recupero il 27 aggiorna il marcatore; nessun invio il 28; invio giorno zero il 30 con TTL 21600; nessun invio il 1 ottobre. Questa prova integra scheduler e sender, superando il limite della sola invocazione diretta del checkpoint precedente, ma non esegue un cron reale né attende giorni reali.

Esiti: npm run test:functions-security **286/286**, sintassi ed ESLint inclusi; node scripts/run-functions-emulator-local.mjs **6/6**, exit 0, arresto regolare di tutti gli emulatori. Caricato anche il modulo calendario nella fixture isolata demo-codici-password. Il collaudo HTTP non esercita invii FCM/SMTP o scheduling Pub/Sub; Node 24 dell'host usato al posto del 22 richiesto. Nessuna modifica runtime, nuova politica, credenziale o dato reale, invio esterno applicativo, Git mutante o deploy. Non certifica consegna fisica, exactly-once o concorrenza distribuita.

## NOTIFICHE-08 — recupero fallimento totale approvato, 26/09/2026

Patch minima Astra in sendRecipientDeadlinePushes: flag per soli errori messaging/server-unavailable e messaging/internal-error; marcatore preservato soltanto con zero send risolti e almeno un tale errore. Se almeno un send riesce, cadenza precedente conservata. Nessun registro/timer/nuova chiamata di invio; è il normale scheduler a poter riprovare finché diffDays non è negativo. Token invalidi continuano a essere disabilitati e nessun device/altri errori mantengono comportamento precedente. Lookup e sincronizzazione non sono oggetto di questa patch.

Test aggiornato distingue totale e parziale; nuova prova inietta errore interno, verifica zero update e vecchio marcatore immutato, poi simula recupero e verifica invio/update. La seconda invocazione è diretta con dipendenze finte, non un'esecuzione reale dello scheduler il giorno dopo. Regressioni scheduler coprono esclusione passate e giorno zero. Suite Functions **283/283**, sintassi/ESLint inclusi. Nessun FCM/SMTP reale, credenziale, dato produttivo, Git mutante o deploy. Limiti: errori provider non provano mancata consegna fisica; niente garanzia exactly-once, recupero selettivo dei parziali o tentativi dopo scadenza. Questa piccola correzione usa l'analisi DeepSeek già raccolta; applicazione e verifica sono di Astra, nessuna nuova revisione DeepSeek attribuita.

## NOTIFICHE-08 — approfondimento retry locale, 26/09/2026

Su «procedi», aggiunte due prove di comportamento, nessuna modifica runtime: errore temporaneo totale/parziale push destinatari avanza comunque lastRecipientPushNotifiedAt; push proprietario con due device e un fallimento mantiene il marcatore e, alla successiva chiamata, ritenta solo il device fallito (sequenza one/two/two). Banchi email+push **18/18**. Le prove verdi caratterizzano il difetto destinatari, non ne attestano la correttezza. Email continua ad avere un marcatore globale e nessun registro per destinatario; un reinvio generale dopo successo parziale rischia duplicati. Prima di introdurre nuovi tentativi/registro occorre definire finestra e conservazione. Nessun invio reale, deploy, credenziale o dato reale.

## NOTIFICHE-08 — calendario italiano applicato, 26/09/2026

**Accettazione locale Astra:** Functions **280/280** con sintassi/ESLint; notifiche **29/29 per ciascuno dei tre fusi host** UTC, Europe/Rome e America/Los_Angeles; documentazione **11/11**, 31 MD/606 collegamenti; diff mirato senza errori whitespace. Nessuna certificazione di rilascio o chiusura dei residui separati.

Dopo conferma esplicita di Diego, Astra ha consolidato la proposta DeepSeek nel modulo deadline-calendar: date-only valide restano letterali; istanti con offset esplicito (frazioni fino a nove cifre), Date e millisecondi sono convertiti in Europe/Rome; formati ambigui e giorni impossibili rifiutati. Distanze su ordinali civili, non durate fra mezzanotti locali. Integrazione nei sette percorsi degli avvisi, inclusi scheduler, creazione e push manuale. Dipendenze/provider, destinatari, permessi, giorno zero, condizione successo e retry invariati. Nessuna riscrittura dati.

Test con codice reale estratto e calendario reale, SDK/trasporti finti: mezzanotte estiva/invernale, cambio ora primaverile (sette giorni), autunnale (25→26 ottobre un giorno), data email e tre marcatori scritti al giorno italiano, esclusione date malformate, trigger e selezione push manuale prima/dopo mezzanotte. Prove non certificano SMTP/FCM, scheduling distribuito o runtime Node 22. DeepSeek ha segnalato frazioni ISO e guardia null: recepiti e verificati; coperture aggiunte durante la revisione, senza attribuire al consulente esecuzioni locali.

Compatibilità: nessuna migrazione dei marcatori esistenti, letti letteralmente; eventuale errore storico di un giorno non viene indovinato/corretto. Il nuovo giorno italiano può spostare una finestra rispetto al passato vicino a mezzanotte. validFutureIsoDate per il rinnovo delle ricevute resta UTC (non è un invio): possibile discrepanza di validazione vicino a mezzanotte, fuori da questa decisione. Non introdotto registro per destinatario o nuova politica di recupero invii falliti; nessun nuovo MD/manifest/protezione, credenziale, Git mutante o deploy.

## NOTIFICHE-08 — calendario e fallimenti, checkpoint 26/09/2026

Chiusura della sola patch log: revisione statica DeepSeek senza errori bloccanti; Astra accetta le due righe e il test eseguito. Non adottato ulteriore riepilogo numerico suggerito: il log di successo esistente riporta già riusciti/totale nel caso parziale. Documentazione 11/11, 31 MD/606 collegamenti; diff-check senza errori whitespace. Il calendario resta in attesa di scelta esplicita, non completato.

Astra ha rieseguito i 19 test notifiche preesistenti: tutti superati. Riproduzione locale senza SDK/rete dell'aritmetica attuale, istante 2026-09-26T10:00:00Z e scadenza date-only 2026-09-26: UTC produce marcatore 26/09 e diff 0; Europe/Rome produce marcatore 25/09 e diff 0; America/Los_Angeles produce marcatore 26/09 e diff -1. Esecuzione della vera funzione shouldSendPush estratta in VM, tempo 30/03/2026 e precedente 23/03/2026: frequenza 7 ammessa in UTC, negata in Europe/Rome perché 167 ore diventano sei giorni. Queste sono riproduzioni di difetti, non prove di correzione o osservazioni sulla produzione.

DeepSeek ha consegnato proposta read-only per calendario esplicito Europe/Rome e analisi fallimenti. Non applicata: il fuso del cron non decide da solo il giorno del prodotto, i marcatori precedenti possono essere ambigui e non sono autorizzate migrazioni. Astra ha inoltre respinto incongruenze della proposta: fallback permissivo per data non canonica, conversione a stringa di timestamp numerico incompatibile col suo banco e esempio autunnale con date etichettate diversamente dagli istanti. Nessun modulo calendario nuovo aggiunto.

Correzione limitata applicata: sendScadenzaEmail non registra più messaggi o codici arbitrari del provider nei due log interni lookup/consegna; usa EMAIL_LOOKUP_FAILED ed EMAIL_DELIVERY_FAILED. Test con sentinelle sintetiche in messaggio/codice: prima 6/7 (indirizzo fittizio esposto dal log), dopo suite Functions **271/271**, sintassi ed ESLint inclusi, exit 0. Il test verifica anche che il fallimento lookup conservi l'invio email e l'aggiornamento previsti. Nessuna modifica a destinatari, HTML, frequenza, marcatori o retry; non è un audit completo di tutti i log backend, altri siti restano fuori da questa patch minima.

Residui decisionali distinti: calendario backend Roma o UTC e compatibilità dei marcatori; trattamento degli invii parziali email/push destinatari (registro per destinatario escluso dal contratto corrente); fallimento nel giorno zero senza successivo giro utile. Non introdotta nuova finestra di tentativi o conservazione. Nessun SMTP/FCM reale, credenziale, dato produttivo, deploy o Git mutante. Bundle complessivo non accettato.

## COLLAUDO-07 — regressioni e notifiche locali, 26/09/2026

Su richiesta di completare il lavoro locale con DeepSeek, Astra ha eseguito e verificato: Functions iniziali 251/251; Firestore 69/69 iniziali e 73/73 dopo quattro nuovi casi sui permessi di notificationDeliveries/deadlineNotifications/pushDevices; Storage 5/5 Rules correnti e 5/5 prototipo condivisione; dispatcher 3/3 dopo aggiunta lifecycle. Runner Firestore/Storage e relativi dieci identificativi di test ora usano prefisso demo-, verificati nuovamente con arresto regolare degli emulatori. Non cambia la configurazione di produzione né le Rules. La CLI conserva il normale proxy per destinazioni esterne: questo non è un firewall globale; nessun accesso a dati produttivi nelle prove.

Attachments: primo esito 35/36 per conteggio storico di due schedule. Corretto il test con elenco esatto dei tre export (incluso cleanupInviteRevocationMarkers già approvato N1) e verifica della delega separata; riesecuzione 36/36. Nessuna modifica al purge. Alcuni test di questo gruppo caratterizzano residui noti, non attestano che quei comportamenti siano desiderabili.

DeepSeek ha proposto prove VM di push/email/scheduler e escaping HTML. Astra ha consolidato i tre file deadline-email/deadline-push/deadline-scheduler sotto functions/test: 18 nuove prove su codice reale estratto, dipendenze esclusivamente fittizie. Email prima della correzione 4/6: riscontrato markup grezzo nel nome e helper assente; dopo escaping dei cinque valori testuali name/templateText/type/notes/veicolo_modello 6/6. Oggetto, destinatari, link e politica di invio invariati. Test indipendente per ciascun campo impedisce che una sola interpolazione corretta nasconda le altre. Suite Functions complessiva 269/269, inclusi sintassi ed ESLint, exit 0.

Push: create-if-absent, stato viewed conservato, dedup di consegna, lease recente/scaduto, token invalido, errore transitorio, nessun dispositivo, D0/TTL e destinatari sincronizzati. Scheduler: finestra/default, completate/passate/senza data, frequenza e opt-out, isolamento dei fallimenti per canale, configurazione Europe/Rome. Tempo congelato nei test push/scheduler; nessuna prova di concorrenza reale, infrastruttura scheduler o FCM. La sincronizzazione copie nei test push è simulata. Le Rules sono invece eseguite sull'emulatore reale, con documenti sintetici e casi negativi.

Checkpoint finale: revisione statica DeepSeek dei tre test/patch senza errori bloccanti, rettificate sue iniziali asserzioni cross-VM/log e copertura dispatcher già esistente. Astra ha aggiunto una diciannovesima prova sul token invalido del destinatario e rafforzato campi notifica/incremento tentativi/limite memoria: Functions finali **270/270**, exit 0. Il test caratterizza anche l'avanzamento preesistente del marcatore destinatari dopo insuccesso, non lo approva come nuova politica.

Smoke HTTP: preparato `scripts/run-functions-emulator-local.mjs` con copia dei soli JS/package runtime in fixture separata, dipendenze locali collegate, valori email sintetici da template dedicato, nessuna copia di .env o segreti reali. Configurazione `firebase.functions-local.json`, solo loopback Auth/Firestore/Functions e progetto demo-codici-password; nessun documento scadenza/invito/device seminato, quindi nessun percorso SMTP/FCM raggiunto. Eseguito il banco esistente: **6/6**, exit 0 e arresto regolare. Provati auth assente, revoca sessione sintetica, input recupero/invito/push invalido e recupero codici senza TOTP. Aggiunta guardia fail-closed agli endpoint dello smoke prima di fetch: progetto demo e tutti gli host espliciti loopback obbligatori, **2/2** test negativi/positivi. L'emulatore ha usato Node 24 del computer invece del Node 22 richiesto: non è certificazione del runtime distribuito. App Check usa token sintetico emulatore; job schedulati ignorati in assenza Pub/Sub, testati solo in VM.

Limiti: nessun SMTP/FCM o segreto reale letto, nessun invio reale, deploy o Git mutante. Consegna push su dispositivo, ricezione/rendering/spam email e scheduling/retry della piattaforma richiedono ambiente distribuito autorizzato. Successo email parziale continua ad avanzare il marcatore globale come prima; non introdotta una nuova politica retry. DeepSeek segnala inoltre marcatori che azzerano l'ora locale e salvano poi la data UTC: a fuso positivo la data può essere quella precedente. Osservazione statica preesistente non corretta né giudicata innocua da Astra; le prove scheduler usano timestamp ISO completo e non certificano calendario/DST backend. Redazione dei log email e tutte le combinazioni di errore provider non coperte. Decisioni purge/backup, compatibilità di vecchie PWA e gate rilascio restano separati. Nessuna certificazione generale dell'app. Documenti 31, controllo documentale 11/11 e diff whitespace senza errori.

## Chiusura estensione locale — pagine complete e mobile, 26/09/2026

Esteso il server di prova esistente alle pagine/assets originali, senza rimuovere main, login-entry o gate. Solo configurazione Firebase e SDK sono serviti in versione locale: Auth 9099 e Firestore 8085, progetto demo-vault-shell, Rules correnti. CSP consente connessioni solo self/emulatori; Functions/Storage puntano a loopback non avviati, App Check e messaging sono stub del solo banco. Nessuna modifica a configurazione/manifest/protezioni di produzione. Account sintetico con password validata tramite policy reale e relativo passwordPolicyVersion; verifier/envelope e password account cifrata generati con crypto-utils reale. Il primo seed privo di versione ha correttamente provocato richiesta aggiornamento password; corretto il seed, non il controllo applicativo.

Controlli manuali Chrome riusciti sulle pagine originali: login tramite form; richiesta Master Password e messaggio di vault sbloccato; Home con un promemoria e contatore Scadenze 1/Urgenze 0; rinvio del dialogo visivamente efficace; lista In scadenza con record di oggi e filtro Urgenti vuoto; ritorno Home/area privata con sessione vault conservata; account sintetico presente e azione Mostra che restituisce il valore sintetico atteso; logout con conferma e ritorno login; accesso diretto alla lista privata dopo logout nuovamente reindirizzato al login. Non utilizzate credenziali utente né dati online.

Screenshot osservati a 390×844: dialogo promemoria su Home completa leggibile, data e pulsante contenuti nel viewport; ulteriore anteprima isolata mostra due omonimi distinti e label Già visto. Viewport ripristinato a fine prova. Il blocco ERR_BLOCKED_BY_CLIENT precedente non si è ripresentato sulle pagine applicative. Banco arrestato dopo logout. Si chiude il perimetro locale richiesto, insieme alle precedenti prove 10/10 promemoria e 15/15 laboratorio vault; non sommare come casi unici. Non certificati dispositivi fisici, App Check, push/email, Functions/Storage, tutte le sezioni dell'app o produzione. Il record sintetico minimale mostra Senza Nome perché non prepara il campo titolo atteso: non attestazione del mapping di tutti i campi account.

## Estensione locale — sessione vault e tentativo mobile, 26/09/2026

`node scripts/run-vault-session-emulators.mjs`: exit 0, **15/15** (14 sottocasi e contenitore), Auth/Firestore `demo-vault-shell`, Rules correnti, dati sintetici. Verificati login senza sblocco automatico; master corretta/errata; ciphertext privato/aziendale; preparazione patch senza scrittura sorgente; percorsi/campi non ammessi; isolamento proprietario server; rifiuto plaintext e metadati proprietario invalidi; logout; cambio utente; dispose; nessuna configurazione automatica del vault. È il laboratorio persistent-vault-shell con crypto reale, non collaudo dell'intera app distribuita. Emulatori arrestati regolarmente dal runner.

Banco promemoria esteso per anteprima `/?visual`: gate originale servito senza modifiche, accettazione della sola identità verificata nell'emulatore; modalità visuale si ferma prima del logout per mantenere i promemoria. Tentativo Chrome via controllo browser respinto con `ERR_BLOCKED_BY_CLIENT` su loopback 3088. Nessuna screenshot/verifica mobile riuscita, nessuna protezione disabilitata; processo di prova terminato. Modifica al banco visuale non ancora validata nel browser. Restano percorso completo di bootstrap/vault e QA mobile.

## PROMEMORIA-06 — integrazione Auth/Firestore locale, 26/09/2026

Banco `scripts/serve-reminder-emulators.mjs` e `scripts/reminder-emulator-entry.mjs`, configurazione separata `firebase.reminder-emulators.json`. Firebase CLI `emulators:exec --project demo-vault-shell --only auth,firestore --config firebase.reminder-emulators.json "node scripts/serve-reminder-emulators.mjs"`; primo avvio respinto per percorso Rules fuori directory, corretto spostando la sola configurazione di prova nella root. Rules originali non modificate. Server loopback 3088, Auth 9099, Firestore 8085; configurazione produzione esclusa dal bundle e CSP limitata a loopback. Account sintetico creato nell'emulatore, nessuna credenziale utente consultata.

Chrome: esito DOM **SUPERATO — 10 controlli integrati Auth/Firestore locali**. SDK Auth reale locale, repository/offline-Firestore reali e Rules correnti. Controlli: login; lettura iniziale; eventi 21/14/7 persistiti con unico corrente; due omonimi distinti; viewed visibile nel DOM; scadute solo nel conteggio Urgenze; date aggiornate; rimozione al logout; permission-denied dopo logout; due sorgenti ancora presenti. La cache viene riscaldata esplicitamente dal server prima dei refresh: non certifica la latenza della sincronizzazione spontanea. Eventi notifiche e modifiche data seminati tramite Admin locale, non tramite trigger/scheduler; nessuna attestazione push/email. Il markup Home è reale ma gli script originali sono esclusi e il body resta hidden/inert: prova DOM dei moduli, non QA visuale né bootstrap privato/vault completo. Processo terminato dopo la verifica. Nessun commit o deploy; restano app completa e mobile.

## PROMEMORIA-06 — chiusura locale, 26/09/2026

Risolti i residui della prova seguente: paginazione a 10 elementi dopo deduplicazione, senza eliminare eventi o sorgenti; navigazione su 23 scadenze/69 eventi verifica tutti i 23 promemoria correnti. `tests/deadline-reminders.test.mjs` **13/13** e `tests/deadline-list-calendar.test.mjs` **6/6**: lista reale con sorgenti simulate, omonimi owned/received separati, ricevute senza swipe, soglia oggi/domani e 30 giorni, invalidi/completati, timer, visibilità, cambio UID e doppio mount, callback obsoleti senza azioni. Rafforzato il guard dei callback card/swipe e del completamento init su mount superato.

`npm run test:navigation` concluso con exit 0: audit che esegue anche i **19 test** sopra, registro pagine canoniche OK e **150/150** regressioni. Le due vecchie asserzioni dipendenti dalla sintassi sono sostituite da prove del rendering effettivo e collegamento al calendario condiviso, non semplicemente rimosse. `npm run test:js-syntax`: **165 moduli OK**; `git diff --check` mirato senza errori, soli avvisi LF/CRLF.

Ripetuta prova browser Chrome su loopback con CSP senza connessioni esterne: **11/11 controlli DOM**, inclusa navigazione delle tre pagine 10/10/3. Nessun Firebase, login, credenziale o scrittura persistente. Server arrestato al termine. Accettazione locale della correzione, non collaudo dell'app completa, SDK remoto, push, email o dispositivi; nessun deploy. Gli esiti precedenti sotto restano storici.

## PROMEMORIA-06 — prova locale isolata, 26/09/2026

Eseguito `node --test tests/deadline-reminders.test.mjs tests/deadline-model.test.mjs tests/deadline-detail-lifecycle.test.mjs`: **36/36**, comprendenti 11 nuovi casi di proiezione/rendering/lifecycle, 7 calendario/modello e 18 regressioni dettaglio. I moduli reali sono caricati con dati e DOM simulati; nessun SDK remoto eseguito. Verificati 21→14→7 anche fuori ordine, omonimi, viewed/resolved, giorni attuali, sorgente immutata, cambio data/completamento, mezzanotte, dismiss, UID/gate/pagehide e risposte asincrone obsolete. Calendario provato anche in processi con fusi Europe/Rome e America/New_York e transizioni DST.

Eseguito `npm run test:js-syntax`: **165 moduli OK**. `node scripts/audit-navigation-flows.mjs`: **FAIL** all'asserzione storica `unread.slice(0, 10)`. Il controllo non è stato indebolito/modificato; resta da riconciliare il limite con la nuova proiezione e verificare il resto della suite.

Browser Chrome, `scripts/serve-deadline-reminder-probe.mjs`, loopback 127.0.0.1:3087: osservato **COLLAUDO SUPERATO, 8 controlli DOM reali**. Il server offre soltanto due route in memoria; CSP `connect-src 'none'`, niente Firebase, credenziali, storage persistente o scritture. Caricati dom-utils, modello, dashboard e inbox reali privati dei soli import/export, con repository/auth/orologio simulati. Controllati avviso iniziale, sostituzioni 14/7, giorni correnti, omonimi, passaggio al giorno dopo nelle sole Urgenze, sorgenti intatte e rimozione su blocco. Non è prova dell'app completa né di sincronizzazione/push/Firebase; nessuna accettazione di rilascio. Server arrestato a fine prova.
## CORREZIONI-05 — conclusione locale, 25/09/2026

Astra ha applicato e verificato le proposte DeepSeek readonly, con rettifiche proprie sui banchi e sui confini di sicurezza. D3 impedisce il salvataggio dopo errore di decifratura; D1 elimina scritture dal rendering condivisioni; N1 collega ricevuta server, notifica/dedup e consumer; C1 distingue incompatibilità sicure da funzionamento supportato. Accettazione limitata al codice e alle prove locali, non al rilascio.

Evidenze finali mirate: `node --test tests/backup-restore-session.test.mjs` **39/39**; `npm run test:firestore-rules` **69/69**, emulatore arrestato, soli dati sintetici; banchi owner backup/archivio/mutation/deadline **21/21**; callable inviti **27/27**; client N1, finestra e servizio **19/19**, incluso caso con 25 notifiche legacy che occuperebbero il limite senza discriminatore. Sintassi **165 moduli** valida. Questi gruppi includono regressioni già contate nei checkpoint, non sono un totale di casi unici.

Non verificati: browser reale del nuovo consumer, Firebase remoto, dispositivi, copie PWA distribuite e tempi reali di cleanup. Nessuna produzione, credenziale reale, migrazione, commit o deploy. Limiti di ricevute legacy, ID conservativi, finestra/cleanup e compatibilità mista registrati in STATO; nessuna decisione implicita su purge/backup. Le fonti storiche sotto restano riferite alle rispettive date.

## Indice storico delle fonti conservate

- [M4_VISUAL_ACCEPTANCE.md](#fonte-docs-m4-visual-acceptance-md-l39)
- [RUNTIME_PERFORMANCE_BASELINE.md](#fonte-docs-runtime-performance-baseline-md-l1)
- [REAL_IMAGE_AUDIT.md](#fonte-experiments-card-importer-real-image-audit-md-l1)

<a id="fonte-docs-m4-visual-acceptance-md-l39"></a>

## Fonte: M4_VISUAL_ACCEPTANCE.md — righe originali 39–81

> Provenienza: `docs/M4_VISUAL_ACCEPTANCE.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-m4-visual-acceptance-md-esito-del-primo-collaudo-iphone"></a>

### Esito del primo collaudo iPhone

<a id="evidenza-0c669851d397eac429d4"></a>

Il collaudo del 6 settembre 2026 non ha superato il gate. Le schermate fornite mostrano che, durante lo scroll/overscroll, il footer viene ricomposto nel mezzo del viewport e il contenuto continua a scorrere dietro di esso; compare inoltre una fascia terminale estranea al fondale. È stato anche chiarito che, nel tema chiaro, le fasce devono essere bianche e sfumate, non celesti o azzurre.

<a id="evidenza-2a5e49c5926c458f5613"></a>

Correzione candidata applicata: su viewport mobile il documento esterno non scorre più e soltanto `.base-main` gestisce lo scorrimento verticale. Il collaudo comparativo del 6 settembre ha scelto la variante "nebbia V2": maschera progressiva sul contenuto, velo bianco tramite pseudo-elemento e blur da 12 px, senza bordi visibili. La tecnica deriva dai commit storici `ba7f85f` e `2c19860` e conserva intenzionalmente l'effetto delle card che sfumano sotto le fasce.

<a id="evidenza-1f5fb5849b583723a116"></a>

Fallback preservato fuori dal runtime: la variante storica del commit `ab532e2`, il confronto della nebbia e i relativi supporti sono conservati in `archive/home-experiments/`. La specifica descritta in questo documento resta la fonte ufficiale; l'archivio consente un confronto manuale senza pubblicare o memorizzare offline i laboratori. Il gate M4 resta aperto fino al nuovo collaudo su iPhone e Windows.

<a id="fonte-docs-m4-visual-acceptance-md-laboratorio-radice-del-viewport"></a>

### Laboratorio radice del viewport

<a id="evidenza-80440e99ec050dd717b3"></a>

`prova.html` è stato pubblicato temporaneamente per riprodurre su iPhone la sola estensione del fondale con `100vh`/`100dvh` e `viewport-fit=cover`, senza cambiare nebbia, livelli, safe area o componenti dell'app. Serve a stabilire se la fascia inferiore nasce dalla superficie radice oppure dalla shell interna.

<a id="evidenza-a53913769877b2f3b029"></a>

Il laboratorio mostra separatamente il perimetro di `100dvh`, quello di `100lvh`, le misure di `innerHeight`, `visualViewport`, schermo e documento, oltre a un marcatore fissato al bordo inferiore. Se il marcatore tocca il bordo fisico e il gradiente continua sotto di esso, la superficie radice copre correttamente il viewport e la fascia dell'app nasce dalla shell interna. Se sotto il marcatore compare ancora un'area estranea, il difetto appartiene invece al canvas o alla viewport esposta dal browser. Le misure sono soltanto diagnostiche: non pilotano il layout e non introducono un ridimensionamento JavaScript.

<a id="evidenza-467628392d525f4e69dc"></a>

Il laboratorio non certifica da solo la correzione. Dopo la prova fisica, la candidata va applicata al CSS comune e ricollaudata almeno su Home, Registrazione e una pagina interna lunga; nebbia V2, ombre, pulsanti e ordine dei livelli devono restare invariati.

<a id="fonte-docs-m4-visual-acceptance-md-esito-sonda-iphone--8-settembre-2026"></a>

#### Esito sonda iPhone — 8 settembre 2026

<a id="evidenza-808b5c04ebec7de6b8f0"></a>

Prima prova eseguita nel browser incorporato della chat su iPhone, schermo dichiarato `393 × 852`. La sonda ha rilevato `innerHeight = 631 px`, `visualViewport = 631 px` e altezza documento `631 px`; il marcatore fissato in basso coincide con il limite del contenuto web. Il gradiente copre quindi tutta la viewport concessa alla pagina. La sottile separazione successiva al marcatore è esterna al documento e precede i controlli del browser incorporato.

<a id="evidenza-ad83d1a68501fcb8b37b"></a>

Questa evidenza esclude, in quel contesto, un fondale HTML più corto della viewport. Non chiude il gate: occorre ripetere la prova in modalità PWA avviata dall'icona Home, dove non esiste la barra del browser e le safe area vengono calcolate diversamente.

<a id="evidenza-aca6b5fea3a83f0e6e11"></a>

Seconda prova eseguita dalla PWA installata: `innerHeight`, `visualViewport` e documento coincidono a `793 px`, mentre lo schermo misura `852 px`. Il marcatore raggiunge esattamente il limite dei 793 px e sotto compare una fascia alta 59 px del colore `--bg-primary`. La fascia è quindi il canvas esterno alla layout viewport che iOS colora con il fallback della radice; non deriva da contenuto insufficiente, safe-area interna, nebbia o altezza del footer.

<a id="evidenza-64cc21febbaaf53d0684"></a>

Candidata isolata da verificare nel laboratorio: lasciare il gradiente sul `body` e assegnare a `html` il colore pieno con cui termina la nebbia al bordo fisico (bianco nel tema chiaro, colore scuro equivalente nel tema dark). La candidata non modifica dimensioni, scroll, maschere o stacking.

<a id="evidenza-9e34686b1028d7329b7f"></a>

La controprova PWA ha confermato la diagnosi: mantenendo invariati i valori `793/793/793 px`, il canvas esterno è passato dal grigio al bianco. La candidata è stata quindi trasferita nel core tramite `--viewport-edge-color`, bianco in tema chiaro e `#0a0f1e` in tema scuro. Il test statico del contratto impedisce che la radice torni a usare `--bg-primary`. Il gate resta aperto fino al collaudo delle pagine applicative con la nebbia reale.

<a id="evidenza-24fe82dec97e5da163db"></a>

Il primo collaudo della Home `v1.2.60` ha eliminato il grigio ma ha mostrato una linea fra il bianco puro esterno e il terminale azzurrato della nebbia. Il campionamento della schermata ha rilevato lungo l'ultima riga interna valori compresi fra `rgb(237 246 253)` e `rgb(232 242 252)`, con valore centrale `rgb(235 244 253)`. La candidata chiara è quindi affinata a `#ebf4fd`, colore medio del bordo reale, senza intervenire sull'effetto o sulla sua geometria.

<a id="evidenza-27a616f0b6d43a476213"></a>

Il collaudo della Home `v1.2.61` conferma la continuità esatta del tema chiaro: sopra e sotto il confine il valore centrale è `rgb(235 244 253)`. Nel tema scuro resta invece una differenza misurabile fra il terminale interno `rgb(12 19 38)` e il canvas esterno `rgb(9 15 29)`. La candidata dark è pertanto affinata a `#0c1326`, mantenendo invariati nebbia e layout.

<a id="evidenza-43654337ced8abfef4a8"></a>

La successiva verifica iPhone della Home ha confermato la continuità anche in tema scuro e l'utente ha approvato colori ed effetto nebbia senza ulteriori variazioni. Il sotto-gate iPhone resta da completare sulle altre pagine e con tastiera/modale; il sotto-gate Windows non è ancora certificato. M4 rimane quindi formalmente aperta, senza rimettere in discussione la soluzione grafica approvata.

<a id="fonte-docs-m4-visual-acceptance-md-verifica-windows-preliminare--8-settembre-2026"></a>

#### Verifica Windows preliminare — 8 settembre 2026

<a id="evidenza-3ba7e3a380af7f11d423"></a>

La pagina Area privata della release pubblicata `v1.2.62`, aperta in Chrome con finestra desktop massimizzata, presenta fondale continuo, fasce allineate al contenitore e nessun salto della barra di scorrimento. Il contenuto visibile non era sufficientemente lungo per esercitare lo scroll e questa prova non copre la finestra ridotta a circa `390px`.

<a id="fonte-docs-m4-visual-acceptance-md-chiusura-del-gate--8-settembre-2026"></a>

### Chiusura del gate — 8 settembre 2026

<a id="evidenza-b2932a2a88b53af4b749"></a>

La release `v1.2.63` conserva la nebbia V2 approvata, il colore terminale coerente nei temi chiaro e scuro e il contratto comune del viewport. La suite completa è risultata verde e la pubblicazione ha confermato la presenza dei 13 watermark canonici; l'utente ne ha verificato e approvato visivamente presenza, dimensione e colore, inclusi l'ingranaggio di Impostazioni e la chiave di Account privati.

<a id="evidenza-784d34cd5ffcfc1ae06d"></a>

M4 è quindi chiusa per accettazione del product owner. La matrice estesa — Windows a larghezza ridotta, ulteriori browser, tastiera e combinazioni di modali — resta un collaudo di regressione obbligatorio in M10 e non modifica la soluzione grafica approvata.

<a id="fonte-docs-runtime-performance-baseline-md-l1"></a>

## Fonte: RUNTIME_PERFORMANCE_BASELINE.md — righe originali 1–55

> Provenienza: `docs/RUNTIME_PERFORMANCE_BASELINE.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-runtime-performance-baseline-md-baseline-runtime-m0--iphone-e-pc"></a>

## Baseline runtime M0 — iPhone e PC

> Misure raccolte il 6 settembre 2026 tramite la diagnostica locale della versione 1.2.51. I report contengono soltanto tempi, pagina, stato rete e conteggi tecnici.

<a id="fonte-docs-runtime-performance-baseline-md-metodo"></a>

### Metodo

- PC portatile: viewport 1536×695, connessione indicata come 4G dal browser.
- iPhone: viewport 393×852, classe touch.
- Navigazione ripetuta tra Home, Profilo, Area privata, Account, Aziende, Scadenze e Impostazioni.
- `page-navigation` misura la disponibilità della struttura iniziale.
- `private-page-bootstrap` misura il completamento dell'inizializzazione applicativa della pagina.
- Le mediane sono preferite ai singoli valori; i picchi restano registrati perché indicano attese intermittenti reali.

<a id="fonte-docs-runtime-performance-baseline-md-risultati-sintetici"></a>

### Risultati sintetici

| Pagina | PC online | PC offline | iPhone online | iPhone offline | Valutazione iniziale |
|---|---:|---:|---:|---:|---|
| Home | ~1,76 s; picchi 9,50/18,67 s | ~0,50 s; prima navigazione 28,85 s | ~1,08 s; picco 3,62 s | ~0,15 s | bootstrap normalmente buono; picchi online e timeout iniziale PC da isolare |
| Area privata | 2,10 s | ~1,75 s | ~1,13 s | 0,54 s | PC da ottimizzare |
| Account privati | 9,57 s | 6,20 s | ~4,15 s; picco 33,37 s | 2,98 s | priorità critica su entrambi i dispositivi |
| Dettaglio account privato | non campionato | 0,50 s | 1,18 s | 0,17 s | buono |
| Lista aziende | ~0,84 s | 0,30 s | ~0,72 s | ~0,09 s | buono |
| Account aziendali | ~6,52 s | 4,84 s | ~3,16 s | 2,43 s | priorità critica |
| Dettaglio account aziendale | 1,66 s | non campionato | campione incompleto | 0,21 s | percorso offline buono; completare campioni online durante la correzione |
| Dati azienda | non campionato | non campionato | 1,05 s | ~0,12 s | buono |
| Profilo | ~2,90 s | 1,45 s | ~1,42 s | 0,60 s | PC online da ottimizzare |
| Scadenze | 1,42 s | non campionato | ~0,73 s | non campionato | buono nei campioni disponibili |
| Impostazioni | ~2,97 s | 1,04 s | ~1,10 s | prova conclusa tornando online | PC online da ottimizzare |
| Archivio | non campionato | non campionato | 25,14 s | non campionato | priorità critica, campione singolo da confermare |

<a id="fonte-docs-runtime-performance-baseline-md-evidenze-architetturali"></a>

### Evidenze architetturali

1. Le liste Account restano lente offline: la causa include elaborazione, decifratura, composizione delle condivisioni o rendering, non soltanto la rete.
2. Il PC ha atteso 28,85 secondi nella prima navigazione dopo la disconnessione, mentre il relativo bootstrap Home è durato 0,65 secondi. Va verificata la strategia di navigazione/fallback del Service Worker o un'attesa di rete precedente al documento.
3. Su iPhone online ogni pagina ha riportato circa 229–238 KB trasferiti, mentre sul PC caldo il trasferimento era 0 KB. Va verificata l'interazione tra Safari/PWA, Service Worker e header `no-store`, in particolare per il runtime Firebase condiviso.
4. I dettagli dei singoli Account sono rapidi offline: non è necessario nascondere le credenziali dietro un ulteriore passaggio per ottenere prestazioni accettabili.
5. `offline-sync` identifica la preparazione della cache e può comparire online; non rappresenta da solo una prova in modalità aereo.

<a id="fonte-docs-runtime-performance-baseline-md-priorità-risultante"></a>

### Priorità risultante

1. Account privati e Account aziendali.
2. Archivio e picchi intermittenti Home.
3. Prima apertura offline su PC.
4. Cache degli asset su iPhone.
5. Profilo, Impostazioni e Area privata su PC.

<a id="fonte-docs-runtime-performance-baseline-md-gate-di-confronto"></a>

### Gate di confronto

- Online caldo: primo contenuto utile entro 1,5 s come obiettivo.
- Offline caldo: primo contenuto utile entro 1 s come obiettivo.
- Online freddo: entro 3 s come obiettivo iniziale.
- Nessuna attesa di rete lunga prima del fallback offline.
- Nessuna regressione delle pagine che oggi rientrano già nei limiti.

Questa baseline chiude M0 ma non certifica che tutti gli obiettivi siano raggiunti: costituisce il riferimento prima/dopo per M1–M4.

<a id="fonte-experiments-card-importer-real-image-audit-md-l1"></a>

## Fonte: REAL_IMAGE_AUDIT.md — righe originali 1–48

> Provenienza: `experiments/card-importer/REAL_IMAGE_AUDIT.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-experiments-card-importer-real-image-audit-md-prova-con-fotografie-reali--5-settembre-2026"></a>

## Prova con fotografie reali — 5 settembre 2026

Le sei fotografie sono state analizzate senza copiarle nel repository. Questo rapporto
non conserva numeri completi, codici fiscali, email, telefono o altri dati personali.

<a id="fonte-experiments-card-importer-real-image-audit-md-campioni"></a>

### Campioni

1. Badge personale: nome, data di nascita, codice fiscale e codice a barre visibili.
2. Biglietto da visita: nome, ruolo, azienda, sito, indirizzo, dati fiscali, telefono ed email.
3. Tessera carburante, retro: azienda, indirizzo, telefono e sito; nessun codice personale.
4. Tessera carburante, fronte: marchio e numero identificativo visibili.
5. Carta di pagamento deteriorata, retro: circuito e assistenza visibili; numero carta assente.
6. Carta di pagamento deteriorata, fronte: circuito e intestatario parzialmente visibili;
   numero e validità non sono recuperabili con sufficiente affidabilità.

<a id="fonte-experiments-card-importer-real-image-audit-md-esito-ocr-grezzo"></a>

### Esito OCR grezzo

<a id="evidenza-e3388c647b7b03c86e89"></a>

Il tentativo diretto sui JPEG originali (circa 2880 × 3840, card ruotate) ha richiesto
circa 15–20 secondi per immagine su PC e ha prodotto testo largamente inutilizzabile.
La rotazione automatica non è risultata affidabile. Questa modalità è respinta.

<a id="fonte-experiments-card-importer-real-image-audit-md-requisiti-emersi"></a>

### Requisiti emersi

- correggere l'orientamento prima dell'OCR e permettere la rotazione manuale;
- ridurre localmente il lato maggiore a circa 1800 px;
- applicare contrasto/scala di grigi prima del riconoscimento;
- ritagliare la sola card ed eventualmente separare fronte e retro;
- usare parser diversi per badge, biglietto da visita, carburante e pagamento;
- assegnare una confidenza a ogni campo e lasciare vuoto ciò che non è leggibile;
- non interpretare banda magnetica, chip o loghi come numeri;
- non estrarre CVV e non ricostruire numero carta o scadenza cancellati;
- mostrare sempre un'anteprima modificabile prima di qualunque salvataggio.

<a id="fonte-experiments-card-importer-real-image-audit-md-decisione"></a>

### Decisione

<a id="evidenza-1ec0827f070ef5697a85"></a>

Il riconoscimento può essere utile per badge, biglietti da visita e tessere carburante
ben fotografate. Sulle carte deteriorate deve limitarsi ai dati chiaramente leggibili.
Il laboratorio dispone ora di rotazione manuale, ritaglio tattile, ridimensionamento,
controllo qualità e soglia minima di affidabilità. Prima dell'integrazione occorre una
terza prova dal browser iPhone; l'OCR non è ancora pronto per la produzione.

<a id="fonte-experiments-card-importer-real-image-audit-md-primo-collaudo-iphone"></a>

### Primo collaudo iPhone

<a id="evidenza-bf8f43ac652f8e16cbea"></a>

Il primo collaudo ha rilevato tre problemi: selezione iniziale non ridimensionabile,
selettore iOS orientato soltanto alla fotocamera e avvio OCR non riuscito. La seconda
Preview introduce quattro maniglie sugli angoli, separa “Scatta foto” da “Scegli dalla
libreria”, pubblica esplicitamente il worker OCR e mostra il dettaglio tecnico degli
errori nel solo laboratorio. La correzione non costituisce ancora accettazione del motore.
## 09/10/2026 — M7, executor revision-touch composto

- Comando: `firebase emulators:exec --config experiments/persistent-vault-shell/firebase.emulators.json --project demo-purge-fence --only firestore "node --test experiments/persistent-vault-shell/purge-bound-effect-revision-lab.emulator.test.mjs"`
- Esito: **1/1 superato** su Firestore Emulator.
- Evidenze: revisione condivisa avanzata da 7 a 8 con confronto atomico; ciphertext preservato; begin/outcome, stato composto e ricevuta registrati nella stessa transazione; replay classificato `duplicate` senza una seconda mutazione.
- Limite: laboratorio sintetico; nessuna cancellazione reale, nessun deploy e motore M7 ancora disabilitato.
## 09/10/2026 — M7, cleanup riferimenti profilo composto

- Test puro `purge-bound-effects.test.mjs`: **2/2 superati**; ogni effetto profilo incorpora il solo comando normalizzato necessario e distingue profilo utente/azienda.
- Test `purge-bound-effect-profile-lab.emulator.test.mjs` su Firestore Emulator: **1/1 superato**.
- Evidenze: confronto su `updateTime`, rimozione del solo collegamento all'account bersaglio, riferimento estraneo preservato, stato composto e ricevuta nella stessa transazione, replay `duplicate` senza nuova mutazione.
- Nota ambiente: l'avvio in sandbox non esponeva l'hub locale; il medesimo comando autorizzato fuori sandbox ha avviato e arrestato correttamente l'emulatore. Nessun servizio remoto o dato reale coinvolto.
- Limite: laboratorio sintetico, nessun deploy; il motore M7 resta disabilitato.
## 09/10/2026 — M7, adapter Storage vincolato alla generation

- Test `purge-bound-effect-storage-lab.test.mjs`: **2/2 superati**.
- Evidenze: il delete sintetico riceve il percorso pianificato e `ifGenerationMatch: "9007199254740993"` senza conversione numerica; un errore Storage ambiguo viene persistito nello stato composto come `unknown` e non come completamento.
- Limite aperto: manca ancora la riconciliazione del gap non atomico Storage/Firestore. Il componente è solo laboratorio, dichiara `destructiveAllowed: false` e non è collegato al runtime o al deploy.
## 09/10/2026 — M7, riconciliazione Storage per generation

- Suite `purge-bound-effect-storage-lab.test.mjs`: **4/4 superati**.
- Evidenze: la riconciliazione usa `bucket.file(path, {generation})`; 404 sulla generation esatta porta `unknown → applied`, la generation ancora presente porta `unknown → not-applied` e richiede stop, mentre gli errori non conclusivi non diventano successo.
- Limite: fixture sintetica; manca ancora il retry controllato dopo `not-applied`. Nessuna cancellazione reale, integrazione runtime o abilitazione del motore.
## 09/10/2026 — M7, retry controllato Storage

- Suite mirata dei modelli stop/binding/sequenza e adapter Storage: **16/16 superati**.
- Evidenze: `retry` è ammesso solo per lo stesso effetto in stato `unknown`, avanza atomicamente lo stato a `pending` prima dell'I/O e riusa la generation esatta; dopo `applied` un nuovo tentativo fallisce prima di richiamare Storage.
- Limite: verifica ancora in memoria con bucket sintetico; persistenza Firestore della transizione da collaudare. Motore reale disabilitato e nessun deploy.
## 09/10/2026 — M7, retry Storage persistito

- Test `purge-bound-effect-storage-lab.emulator.test.mjs` su Firestore Emulator: **1/1 superato**.
- Evidenze: sequenza durevole `pending → unknown → pending → applied`, revisione composta finale 4; il bucket sintetico legge `pending` da Firestore prima sia del primo tentativo sia del retry.
- Ambiente: progetto demo, Firestore Emulator locale e bucket in memoria; teardown completato. Nessuna chiamata Storage reale, deploy o abilitazione del motore.
## 09/10/2026 — M7, ricevuta finale della sequenza

- Test `purge-bound-effect-finalize-lab.emulator.test.mjs` su Firestore Emulator: **1/1 superato**.
- Evidenze: finalizzazione prima degli effetti respinta; dopo `applied` viene creata una ricevuta `effects-applied` vincolata a operation/claim/sequence; il replay restituisce `duplicate` senza seconda scrittura.
- Sicurezza: la ricevuta non rilascia il fence, non abilita il motore e conserva `destructiveAllowed: false`; progetto demo e teardown completato.
## 09/10/2026 — regressione locale composta M7

- Suite pure `purge-*.test.mjs` (esclusi emulator): **56/56 superate**.
- Suite emulatori, ripartita secondo i profili richiesti dai test (Firestore 8085, Firestore 8080, Firestore+Storage 8080/9199): **24/24 superate**.
- Il primo run parallelo ha avuto una contesa transitoria nel test CAS, poi superato isolatamente 1/1. Il test Storage ha inoltre dimostrato che l'emulatore poteva cancellare una replacement ignorando la generation; l'executor laboratorio ora verifica prima la generation corrente e conserva comunque `ifGenerationMatch` per il race residuo. Rerun Storage: 1/1, replacement preservata.
- Limiti: gli emulatori non certificano CAS DELETE su GCS reale; motore live, export/runtime, rollout e dati reali restano esclusi e disabilitati.
## 09/10/2026 — M10, formato KDF dei campi

- Suite `field-kdf-format-lab.test.mjs`: **3/3 superati**.
- Evidenze: nuovo envelope prefissato/versionato `CPFE2` con PBKDF2-SHA256 a 600.000; fixture legacy concatenata a 100.000 ancora leggibile; migrazione esplicita e idempotente; password errata e dichiarazione v2 declassata respinte.
- Limiti: solo laboratorio; nessun dato o ciphertext esistente riscritto, nessun runtime modificato. Mancano CAS persistito, gestione interruzioni, inventario completo dei chiamanti, benchmark dispositivi e decisione finale di rollout.
## 09/10/2026 — M10, migrazione KDF con CAS

- Test `field-kdf-migration-lab.emulator.test.mjs` su Firestore Emulator: **1/1 superato**.
- Evidenze: fault prima del commit conserva byte/ciphertext legacy; due proposte concorrenti sulla stessa `updateTime` e ciphertext producono un solo commit; campo estraneo preservato; nuovo ciphertext decifrabile e secondo passaggio `current/duplicate`.
- Limiti: documento e segreto sintetici, modulo di laboratorio non importato dal runtime. Mancano inventario chiamanti, rollout/rollback, benchmark fisici e migrazione di dati reali.
## 09/10/2026 — M10, inventario chiamanti KDF

- Test `field-kdf-callers-inventory.test.mjs`: **1/1 superato**.
- Evidenze: elenco chiuso di 26 moduli che importano `encrypt`/`decrypt` esclusivamente da `security-manager.js`; nessun import diretto delle primitive raw di `crypto-utils.js` al di fuori del boundary centrale.
- Limiti: inventario statico degli import ES del sorgente corrente; non certifica chiamate dinamiche, bundle distribuiti o compatibilità dispositivo. Runtime e formato di scrittura restano invariati.
## 09/10/2026 — M10, adapter rollout KDF hard-off

- Suite combinate `field-kdf-format-lab.test.mjs` e `field-kdf-rollout-lab.test.mjs`: **5/5 superate**.
- Evidenze: new-write resta sul writer legacy anche con variabile ambiente e opzione chiamante favorevoli; dual-read accetta il formato v2 esplicito senza migrazione automatica.
- Limiti: adapter di laboratorio non importato dal runtime; nessuna attivazione, migrazione o modifica di ciphertext. Benchmark e rollout restano aperti.
## 09/10/2026 — M10, benchmark campo KDF sintetico

- Comando: `node experiments/persistent-vault-shell/benchmark-field-kdf-lab.mjs`.
- Ambiente: Windows, Node v24.12.0, 7 campioni dopo warm-up per operazione.
- Risultati (min/mediana/max): legacy decrypt 100k **10,81/10,92/11,03 ms**; v2 encrypt 600k **62,45/63,20/65,98 ms**; v2 decrypt 600k **62,58/62,85/63,80 ms**.
- Limiti: singolo host e WebCrypto Node; non è browser, dispositivo fisico, audit indipendente o approvazione dei parametri/rollout.
## 09/10/2026 — M10, regressione hardening e KDF

- `npm run test:release-hardening`: superato; 5 header, 30 callable con App Check e Rules vincolate all'UID.
- `npm run test:crypto`: **13/13 superati**.
- `node --test experiments/persistent-vault-shell/field-kdf-*.test.mjs`: **6 superati, 1 skip atteso** perché richiede Firestore Emulator; il medesimo CAS emulato era già stato eseguito separatamente **1/1**.
- Limiti: nessun browser/dispositivo fisico, produzione, audit indipendente o modifica runtime.
## 09/10/2026 — M10, restringimento race MFA

- `node --test functions/test/recovery-security.test.js`: **14/14 superati**.
- `recovery-attempts.emulator.test.js` su Firestore Emulator 8080: **2/2 superati**.
- Nuova evidenza: fattore TOTP aggiunto fra prima lettura e prenotazione rilevato dalla seconda lettura; update Auth non chiamato e recovery code non consumato.
- Limite vincolante: resta il gap fra seconda lettura e full-replace Auth; nessun recupero Auth reale, fattore reale o soluzione selettiva certificata.

## 09/10/2026 — rilascio selettivo della policy MFA manuale

- Commit applicativo: `b18d6c88` sul ramo `codex/complete-m7-m8-m10`, pubblicato su `origin`.
- Verifiche pre-rilascio: suite Functions Security **413 superate, 9 saltate, 0 fallite**; documentazione **31 MD**, **612 collegamenti**, **11/11** test; regressione locale M7/M8/M10 **94 superate, 1 skip hard-off**.
- Deploy eseguito esclusivamente con target `functions:recoverMfaWithCode` sul progetto `appcodici-password`; Firebase CLI: `Successful update operation` e `Deploy complete`.
- Verifica remota: funzione `recoverMfaWithCode` **ACTIVE**, regione `europe-west1`, runtime `nodejs22`, hash `44c5590082c851780a3e5b34745f726bbbe233ad`.
- Comportamento distribuito: se esiste un secondo fattore, il recupero automatico si arresta e richiede assistenza; nessun fattore viene rimosso, nessun recovery code consumato e nessun aggiornamento Auth eseguito.
- Esclusioni rispettate: nessun deploy Hosting, Rules, indici o altre Functions; nessuna operazione su dati reali e nessuna modifica all'app di prova.
## 10/10/2026 — Profili Widget e testi strutturali

- Verifica mirata modello/servizi: **20/20** test superati.
- Regressione accesso dati: **94/94** test superati dopo l'aggiornamento della fixture browser.
- Regressione Functions/security: **453 totali, 444 superati, 9 saltati, 0 fallimenti**.
- Audit sintassi JavaScript: **180 moduli verificati**.
- Il planner sintetico dimostra 6 istanze legacy → 5 profili/6 collegamenti, deduplicazione strutturale, identificativi deterministici e assenza dei valori nei profili.
- Limite: nessun dato produttivo è stato trasformato; nessun commit, push o deploy eseguito in questo passaggio.

## 10/10/2026 — M7 cascata copie e compensazione allegati

- `npm run test:shared-copies-purge-emulators`: **2/2**. Il purge rimuove Account, widget, dati/link condivisi e inviti del medesimo Account; il destinatario non può più leggere l'invito eliminato. Scadenze e copie autonome restano preservate.
- `node --test tests/shared-copies-purge.test.mjs`: **5/5**. Il controllo di sorgente attesta lettura transazionale, limite conservativo e cancellazione della cascata nella transazione finale.
- `npm run test:functions-security`: **453 totali, 444 superati, 9 skip dichiarati, 0 fallimenti**.
- Allegati Scadenza: test locali **5/5** ed Emulator **3/3**. Avatar: test locali **10/10** ed Emulator **2/2**.
- `npm run test:attachments`: **54/54**; `npm run test:js-syntax`: **180 moduli**.
- Limite: M7 generale resta hard-off. Le prove non chiudono la race fra preparazione ed effetti distruttivi quando un writer non raccordato al lock modifica o ricrea il bersaglio; nessun deploy o dato reale in questo incremento.

## 10/10/2026 — batteria conclusiva motori

- Backup/ripristino corrente: **110/110** test locali.
- M7/M8 Emulator: cascata **2/2**, restore dopo purge **5/5**, interruzione **2/2**, nuova sessione/retry **3/3**, anteprima obsoleta **3/3**, collisioni multiple **4/4**.
- Le prove di interruzione sono caratterizzazioni verdi del difetto: upload fallito dopo il commit lascia il riferimento senza byte; la nuova sessione classifica il record invariato e non recupera il file. Non vanno interpretate come approvazione del motore corrente.
- Candidato M8 riprendibile completo: **168 totali, 164 pass, 4 skip esterni dichiarati, 0 fail**. Il primo tentativo nel sandbox era stato impedito dalle porte loopback; il rerun autorizzato fuori sandbox è verde.
- Suite Functions/security: **453 totali, 444 pass, 9 skip dichiarati, 0 fail**. CPFE2 e policy MFA manuale sono comprese nelle regressioni mirate.
- Decisione tecnica: mantenere hard-off M7 globale e M8 corrente; integrare il candidato M8 e completare il fence di tutti i writer M7 prima dell'abilitazione. Nessun flag o deploy modificato da questa verifica.

## 10/10/2026 — M8 retry Storage nella stessa sessione

- `npm run test:backup-prototype`: **110/110**.
- `npm run test:interrupted-restore-emulators`: **2/2**.
- `npm run test:restore-retry-emulators`: **4/4**, con nuovo caso positivo di ripresa dell'upload senza seconda applicazione Firestore.
- Contratto: un errore Storage non conclusivo restituisce `BACKUP_STORAGE_UNCERTAIN` e richiede conferma esplicita; il piano conserva l'elenco degli oggetti già caricati e li salta nel retry.
- Il precedente limite fra sessioni è stato chiuso nell'incremento successivo; nessuna attivazione M8 o deploy in questo incremento.

## 10/10/2026 — M8 recupero Storage dopo riavvio

- Il preflight controlla i percorsi Storage dei soli record che Firestore classifica come invariati usando una lettura massima di un byte.
- Un oggetto assente riclassifica il relativo record come `changed`, senza alterare gli altri record; errori diversi da `storage/object-not-found` bloccano il piano con `BACKUP_STORAGE_PREFLIGHT_FAILED`.
- `npm run test:backup-prototype`: **110/110**.
- `npm run test:restore-retry-emulators`: **4/4**. Coperti recupero in nuova sessione, retry nella stessa sessione, record mancante e combinazione record modificato/allegato senza byte.
- Regressioni Emulator sequenziali dopo la rimozione del solo processo Firestore orfano: interruzione **2/2**, anteprima stale **3/3**, collisioni multiple **4/4**.
- Le prime esecuzioni parallele avevano incontrato esclusivamente un conflitto locale sulle porte 8080/9199 e non sono conteggiate come esito funzionale. Nessun commit, push, deploy o attivazione motore eseguiti.

## 10/10/2026 — M7 fence globale esteso a Storage

- `storage.rules` consulta ora `archivePurgeLocks/{uid}` per ogni creazione, modifica o cancellazione client nello spazio applicativo dell'utente. La lettura resta disponibile; i namespace server-only conservano il precedente diniego.
- Lock attivo: upload, modifica metadati e cancellazione negati. Lock rilasciato con schema e proprietario validi: operazioni riaperte. Lock malformato: diniego fail-closed.
- `npm run test:storage-rules`: dispatcher **3/3**, regole Storage principali **14/14**, condivisione Storage **5/5**.
- `npm run test:firestore-rules`: verde, compresi lock attivo/rilasciato/malformato su root, discendenti, aziende e inviti.
- `npm run test:functions-security`: **453 totali, 444 pass, 9 skip dichiarati, 0 fail**; le callable applicative censite leggono il fence prima delle letture di dominio.
- Il test di iniezione Admin che salta intenzionalmente ogni writer supportato continua a documentare il confine di fiducia. Il motore resta hard-off fino al canary distribuito; nessun commit, push, deploy o attivazione eseguiti.
## 10/10/2026 — Diagnostica App E Motori locale

- Estesa la diagnostica volontaria nelle Impostazioni: tempi e contesto restano locali; la nuova sonda verifica soltanto capacità del browser/sessione e un file applicazione same-origin.
- Il report separa gli esiti osservati dallo stato di policy della release: M7 limitato, ripristino M8 corrente attivo, M8 riprendibile hard-off, CPFE2 dual-read attivo/new-write hard-off e recupero MFA selettivo hard-off.
- Nessun contenuto Vault, email, password o ciphertext entra nel report; la prova rimuove la chiave temporanea da localStorage e non invoca callable distruttive.
- Evidenze: `node --test tests/app-diagnostics.test.mjs` 3/3; `test:performance-budget` 30 pagine; `test:page-shells` 5 accesso + 24 interne; `test:js-syntax` 181 moduli; `test:static-references` 256 file; `test:css` e `git diff --check` verdi.
- Canary esterno: i primi tentativi hanno confermato la necessità di attendere la propagazione di `roles/iam.serviceAccountTokenCreator`; ogni concessione non riuscita è stata revocata. Nel ciclo definitivo, dopo 90 secondi, firma diretta IAM riuscita e runner sintetico completato con `m7: pass`, `m8: pass`, `appCheck: pass`: purge M7 con ricevuta/lock/audit, restore M8 Firestore + oggetto Storage e replay idempotente. Il runner ha rimosso record e oggetto sintetici; il ruolo temporaneo a livello progetto è stato revocato nel `finally`. Nessun dato reale usato o modificato.
