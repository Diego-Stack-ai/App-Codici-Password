# Collaudi

<a id="cornice-c1-e2e-locale-2026-11-12"></a>

## C1 — preparazione E2E, verifiche locali e limiti, 12/11/2026

<a id="cornice-c1-workflow-config-2026-11-12"></a>

### Configurazione GitHub osservata e nuova PR workflow — nessuna run reale

La #292 è unita su ordine di Diego in master `6dd80df1ee7be63550583b89bde6b326ad8122b5`, dopo [GO Claude sul codice 45f50a9e](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/292#issuecomment-6812002019) e [CI verde](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/292#issuecomment-6812127683); [ricevuta del merge](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/292#issuecomment-6816335473). Il successivo ordine di Diego autorizza una PR dedicata al workflow e l'avviso a Claude, **non merge, dispatch, produzione o accensione**.

Diego ha configurato privatamente GitHub, con riscontri UI di Codex: environment `c1-qa2-production`; Required reviewers attivo con il suo account; bypass amministratori disattivato; Prevent self-review non selezionato per il suo avvio/clic; **solo branch master, un ramo e zero tag**. Variabile C1_ALLOWED_OPERATOR presente e coincidente con il login GitHub dell'operatore. Presenti i quattro nomi C1_QA2_EMAIL, C1_QA2_EXPECTED_UID, C1_QA2_PASSWORD e C1_QA2_MASTER_PASSWORD negli Environment secrets. L'ultima verifica ha cercato solo nomi e booleani delle protezioni, con modulo segreti chiuso: **nessun valore letto o copiato da Codex, nessun contenuto sensibile nel rapporto**. Presenza non significa correttezza di UID/password/Master, identità QA2, stato MFA o riuscita del login: restano da verificare solo nel futuro giro autorizzato.

Il nuovo ramo parte dal master sopra e sposta il solo YAML revisionato da scripts/workflows a .github/workflows: corpo eseguibile identico, cambiano soltanto due commenti iniziali. Nuovo percorso **candidato in PR**, non installazione su master o esecuzione. Test del workflow aggiornato per leggere il file riconosciuto da Actions, rifiutare la vecchia copia e ammettere come unico trigger workflow_dispatch; nessun trigger automatico, modifica di adapter/Frontend o accesso ai segreti. Prima dello spostamento il nuovo test fallisce per file mancante (gli altri otto test puri passano): il controllo non valida una copia rimasta fuori da Actions.

Verifiche locali del seguito: test:qa-automation **14/14 QA e 27/27 C1** su fixture loopback, test:docs **12/12** (34 Markdown, 916 collegamenti locali), YAML parsato e confronto del corpo eseguibile con il template revisionato identico. Nessun nuovo provider, motore emulato o ambiente produttivo provato. I risultati CI e la revisione sullo SHA candidato saranno riportati nell'avviso della PR.

Restano tutti i limiti della matrice: D02 Configurazione documenti NE senza link UI reale, D08 multischeda non implementato, provider/attese produttive/dispositivi non provati, nessun nuovo PASS C1. Canary OFF secondo Diego, senza rilettura Firebase. Nuovo GO sullo SHA della PR dedicata e CI verde precedono un eventuale ordine di merge; dispatch ancora separato. I checkpoint seguenti conservano la preparazione precedente alla configurazione.

### Seguito al GO sul piano f2ad012d — adapter mai eseguito in produzione

Il [GO Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/292#issuecomment-6810738784) copre piano e primo prototipo. Il seguito prepara adapter con gate CI/manuali, QA2 privata, dialogo Master validato (sopra iframe, inert e focus), contatore DOM senza valori, itinerari reali, reload, timer e logout; proposta YAML fuori da .github. Nessun segreto reale letto, provider chiamato, workflow avviato o nuovo PASS C1. Frontend/Rules/Functions/versione/header/precache invariati; canary OFF secondo Diego.

Suite locale C1 ampliata: **27/27** fra guardie, oracoli e browser Chrome su 127.0.0.1 con richieste esterne bloccate. Owner/broker/transport/focus reali, Auth/UI/DIAG/dati inventati. Il medesimo core del port attraversa il sottoinsieme di nove pagine, cronologia e ricarica, ferma MFA/identità errata/dialogo di creazione prima della conferma, rileva finestre transitorie, distingue ACK timeout da selector ottimistico, gestisce iframe rimosso al blocco e verifica DIAG cancellata/Back chiuso al logout. Test puri negativi per manifest, autorizzazione anche all'import diretto del runner, errori DIAG, ambiente browser senza segreti e artifact precedente non caricabile. Algoritmo 1/3 minuti verificato con clock sintetico: nessuna attesa reale di produzione eseguita.

L'intera suite C1 entra in test:qa-automation/pretest e quindi validate. Restano da verificare provider reali, App Check/MFA effettivi, persistenza cloud, attese fisiche, runner GitHub protetto e motori emulati; Chromium/WebKit Playwright non sono installati su questa postazione (Chrome presente). Configurazione documenti NE se il vero link UI manca; nessun URL diretto o facade al suo posto. Getter distinto dagli appunti; nessuna prova di RAM, PRF, camera, Push o PWA/Safari reali.

### Primo checkpoint f2ad012d — storico approvato, prima dell'adapter

Base master `8afadf8e80ff8b52e789530a6619698d7b4f7869`; [piano proposto, copertura e gate](../procedure/COLLAUDI.md#cornice-c1-e2e-piano-2026-11-12). Nessun adapter/workflow produttivo, credenziale letta, richiesta di produzione o intervento Firebase. Ultimo canary OFF riferito da Diego, senza rilettura amministrativa. Frontend, versione 1.2.270, Rules, Functions, header, manifest e precache invariati.

- `npm run test:c1-e2e-local`: **12/12**, di cui 6 puri e 6 browser Chrome locale. Owner/broker/transport reali, ammissione/materiale e UI sintetici su 127.0.0.1, richieste esterne bloccate. Link Home/Privato/Account, query, Back/Forward browser e freccia interna conservano lo sblocco; reload padre richiede un nuovo invio e conserva pagina/categoria.
- Negativi intenzionali rilevati: nuova Master in navigazione, destinazione sbagliata, reload senza Master e seconda Master immediata dopo reload. Nessun secondo invio automatico. Guardie pure rifiutano origine produttiva prima di reload/callback, traffico esterno e schema DIAG con campi/codici estranei, query, eventi scaduti/oltre 200 e versione non stringa; errori liberi ricondotti a codice chiuso.
- `npm run test:qa-automation`: **20/20** e inventario 31 pagine invariato. `npm run test:docs`: **12/12**, elenco 34 Markdown conservato. Sintassi dei tre moduli nuovi e whitespace verificati.

Limiti: i nuclei locali D02/D04 e D05-A non chiudono i D complessivi o colonne fisiche; osservazione di ripetizioni post-reload limitata a due frame grafici, non prova di assenza tardiva. Nessuna leggibilità di dati reali, login/MFA/App Check, PRF, appunti, camera, Push, OS/PWA o RAM direttamente misurata. `validateDiag` controlla il formato di un rapporto sintetico, non raccoglie ancora quello dell'app. CLI senza argomenti e richiesta di produzione si fermano senza rete; nessun nuovo PASS C1 e nessun rilascio dedotti da questi verdi.

<a id="cornice-c1-d05a-ricarica-270-2026-11-11"></a>

## C1 QA2 — D05-A ricarica del padre, destinazione e nuovo sblocco PASS — 11/11/2026

Prova manuale eseguita da Diego su **Google Chrome desktop Windows, QA2, app v1.2.270**, sorgente distribuito cb48b7196a3816a62dda05d11e11ff4ca7c51d26. Guida completa prima dell'inizio, DIAG acceso e timeout invariato a **180000 ms**; nessuna attesa della chat fra le azioni. Versione esatta Chrome/build Windows non raccolte. Diego opera personalmente ON, sblocco iniziale, ricarica dal pulsante di Chrome, nuovo sblocco e OFF. Codex guida e analizza il rapporto, senza controllare Chrome, inserire password o usare Firebase/Google Cloud amministrativi.

Riscontro esplicito dell'operatore: **stessa pagina e categoria dopo la ricarica; una sola Master dopo il pulsante Ricarica; sempre app.html; Spento**. Destinazione prima e dopo: **Account privato, categoria Account Personali**. Il nuovo sblocco dopo la ricarica e atteso, distinto dallo sblocco iniziale e dalla continuita nelle navigazioni interne. Nessun dato o modulo modificato richiesto/riferito.

Rapporto di **66 eventi**, tutti v1.2.270/browser, ordinati e conformi all'allowlist: i **primi 47 sono identici** al rapporto della riprova D04, seguono **19 eventi append-only**. LOCK_POLICY_REVOKED delle 23:25:07.149, ADMISSION_DENIED/LOCK_ADMISSION_DENIED delle 23:25:38.597 e gli altri eventi prima del nuovo ingresso appartengono alla preparazione/arresto precedente; sono fuori dal segmento D05-A. Nessun errore storico viene cancellato o attribuito a questa ricarica.

**Segmento D05-A:** FRAME_ENTER Area Privata alle **23:39:22.844**, at=1794436762844, fino a FRAME_EXIT Account alle **23:41:11.315**, orari **Europe/Rome**. **Otto eventi: due ingressi, cinque uscite e un solo LOCK_PAGEHIDE del padre**, durata del tratto **108,471 secondi**. Il PAGEHIDE intenzionale e compatibile con il clic Ricarica riferito dall'operatore; il codice da solo non distinguerebbe una ricarica da altre uscite del documento.

| Evento | Ora Europe/Rome | Riscontro e limite |
|---|---|---|
| FRAME_ENTER area_privata.html | 23:39:22.844 | Ingresso della preparazione ammessa, prima della ricarica su Account. |
| FRAME_EXIT area_privata.html | 23:39:29.957 | Preparazione tra pagine. |
| FRAME_EXIT home_page.html | 23:39:44.251 | Preparazione verso Area Privata. |
| FRAME_EXIT area_privata.html | 23:40:30.294 | Passaggio verso Account Personali riferito. |
| LOCK_PAGEHIDE app.html | 23:40:37.403 | Uscita del padre durante la ricarica riferita. |
| FRAME_EXIT account_privati.html | 23:40:37.405 | Uscita del vecchio figlio, due millisecondi dopo il padre. |
| FRAME_ENTER account_privati.html | 23:40:38.913 | Nuovo ingresso sulla pagina Account. |
| FRAME_EXIT account_privati.html | 23:41:11.315 | Uscita successiva verso la raccolta DIAG nelle Impostazioni. |

PAGEHIDE → nuovo ingresso: **1,510 secondi**, intervallo fra eventi che non misura il completamento dello sblocco o del caricamento. Il tratto dopo il nuovo ingresso fino all'ultima uscita dura **32,402 secondi** e non contiene blocchi, errori o altri ingressi. Lo stato copiato e active=true, permitValid=true, idleMs=180000, pushReady=true, registro attivo/disponibile; lastBlock=LOCK_PAGEHIDE rinvia alla ricarica precedente al nuovo ingresso e non prova un blocco successivo.

**PASS del sottocaso D05-A**, limitato alla ricarica del padre dal pulsante Chrome, stessa pagina/categoria riferite, una sola nuova Master e permanenza in app.html, **solo fase 1 QA2 / Chrome desktop Windows / v1.2.270**. Non e una misura diretta della cancellazione RAM o una certificazione generale di query/hash. Ricarica del solo figlio, link privato diretto, nuova scheda con sblocco proprio e Back dopo logout restano non eseguiti: **D05 complessivo LIMITE/incompleto** in matrice. I PASS D02 e del percorso D04 mantengono il proprio perimetro; nessun trasferimento a altri ambienti o fase personale.

**Ultimo stato OFF:** Diego conferma Spento dopo la copia ancora attiva. Nessuna rilettura amministrativa o DIAG dopo l'ultimo spegnimento; la revoca storica non prova l'ultimo OFF, latenza o cancellazione RAM/D15. pushReady non certifica D11. Scadenza e timeout invariati. Solo ricevute nei quattro Markdown esistenti, senza codice, versione, workflow, Rules, Functions, singleton/claim o credenziali modificati da Codex; nessun deploy o merge. Si aggiorna la bozza #291 con nuova revisione richiesta sul nuovo head: il GO precedente sul solo 5ca66ce0 resta storico, #289 e #290 preservate. C1/C2 restano aperti; nessuna CORNICE CHIUSA o nuova accensione implicita.



<a id="cornice-c1-d04-continuita-270-2026-11-11"></a>

## C1 QA2 — continuita e tre comandi D04 del percorso Chrome PASS — 11/11/2026

Riprova eseguita personalmente da Diego su **Google Chrome desktop Windows, QA2, app v1.2.270**, sorgente distribuito cb48b7196a3816a62dda05d11e11ff4ca7c51d26. La guida completa viene fornita prima dell'inizio, con timeout invariato a **180000 ms**: nessuna attesa della chat tra i sette passaggi. Versione esatta Chrome/build Windows non raccolte. ON, sblocco e OFF eseguiti dall'operatore; Codex legge soltanto il rapporto e guida, senza controllare Chrome nativo, inserire credenziali o usare servizi amministrativi.

Diego conferma esplicitamente **sette passaggi corretti, nessun doppio salto, nessuna nuova Master durante i sette passaggi, sempre app.html e Spento**. Percorso: Home → avatar Profilo → Home → Privato → Account Personali → Indietro Chrome (Area Privata) → Avanti Chrome (Account Personali) → freccia interna dell'app (Area Privata). La categoria Personali e le destinazioni sono riferite dall'operatore, non dedotte dai soli eventi. Il successivo accesso alle Impostazioni serve alla copia DIAG ed e distinto dai sette passaggi valutati.

Il nuovo rapporto contiene **47 eventi**, tutti v1.2.270/browser, conformi all'allowlist e ordinati; i **primi 34 sono identici** al rapporto precedente e seguono **13 eventi append-only**. Tra le aggiunte, LOCK_POLICY_REVOKED delle 23:08:14.347 e l'uscita Impostazioni appartengono all'arresto precedente; LOCK_PAGEHIDE del padre alle 23:22:44.307 precede il nuovo ingresso. Sono esclusi dal segmento della riprova, insieme ai blocchi e due errori tecnici storici, ancora non attribuiti.

**Segmento pulito:** FRAME_ENTER Impostazioni alle **23:22:46.054** (at=1794435766054) fino a FRAME_EXIT Area Privata alle **23:24:24.521**, orari **Europe/Rome**. **10 eventi: un ingresso e nove uscite**, **98,467 secondi** compresa la preparazione dalla pagina ammessa e la raccolta finale. Nessun LOCK_*, ERROR_*, ADMISSION_*, nuovo FRAME_ENTER o uscita del padre all'interno. FRAME_EXIT delle pagine figlie e coerente con la navigazione normale, senza dimostrare da solo quale pulsante e stato usato.

| Evento nel segmento | Ora Europe/Rome | Riscontro riferito/coerente |
|---|---|---|
| FRAME_ENTER impostazioni.html | 23:22:46.054 | Nuovo ingresso ammesso, prima del giro dalla Home. |
| FRAME_EXIT impostazioni.html | 23:22:53.269 | Preparazione verso Home. |
| FRAME_EXIT home_page.html | 23:22:55.786 | 1. Avatar → Profilo. |
| FRAME_EXIT profilo_privato.html | 23:23:09.106 | 2. Casetta → Home. |
| FRAME_EXIT home_page.html | 23:23:11.683 | 3. Privato → Area Privata. |
| FRAME_EXIT area_privata.html | 23:23:14.065 | 4. Account Personali → Account privato. |
| FRAME_EXIT account_privati.html | 23:23:20.007 | 5. Indietro Chrome → Area Privata. |
| FRAME_EXIT area_privata.html | 23:23:30.470 | 6. Avanti Chrome → Account Personali. |
| FRAME_EXIT account_privati.html | 23:23:34.964 | 7. Freccia app → Area Privata. |
| FRAME_EXIT area_privata.html | 23:24:24.521 | Raccolta successiva nelle Impostazioni. |

L'uscita Account relativa al settimo passaggio e registrata **48,910 secondi dopo l'ingresso del padre**; la destinazione finale e confermata dall'operatore prima della raccolta nel segmento di **98,467 secondi**. La soglia di tre minuti e rispettata senza cambiare preferenze; l'evento di uscita non misura da solo il completamento del caricamento. Stato alla copia active=true, permitValid=true, idleMs=180000, pushReady=true, registro attivo/disponibile. lastBlock=LOCK_PAGEHIDE e storico, anteriore al nuovo FRAME_ENTER. Il solo stato attivo non basterebbe: il risultato combina il segmento con le conferme manuali. pushReady non certifica D11.

**PASS del sottocaso continuita e dei tre comandi per questo itinerario, soltanto fase 1 QA2 / Chrome desktop Windows / v1.2.270.** Non e un PASS globale di C1, degli altri ambienti o della fase personale. Altri percorsi/query, anchor e ripristino di form sensibili non sono esercitati/certificati da questo giro: **D04 complessivo resta incompleto**, riportato in matrice come LIMITE con collegamento al PASS circoscritto, secondo la legenda e da rivedere con Claude. D02 conserva il proprio PASS; D01/D03 e gli altri casi restano aperti. Nessuna cancellazione o reinterpretazione dei precedenti blocchi/errori.

**Ultimo stato OFF:** Diego conferma Spento dopo il rapporto copiato ancora attivo. Nessuna rilettura amministrativa indipendente o DIAG dopo questo ultimo spegnimento. Il LOCK_POLICY_REVOKED storico non prova l'ultimo OFF, la latenza o cancellazione RAM: nessun PASS D15/revoca live. Scadenza concordata invariata. Nessun codice, versione, workflow, Rules, Functions, singleton/claim o timeout modificati da Codex; nessun merge, deploy, grafica o sicurezza pubblicata. Ricevuta separata da base 0dd3b123 per preservare gli head gia revisionati di #289 e #290; nuovo GO richiesto per questo seguito, nessuna CORNICE CHIUSA o nuova accensione implicita.



<a id="cornice-c1-d04-chrome-270-2026-11-11"></a>

## C1 QA2 — D04 Chrome, destinazioni corrette e continuita non certificata — 11/11/2026

Prova manuale riferita da Diego su **Google Chrome desktop Windows, profilo QA2**, app **v1.2.270**, sorgente distribuito cb48b7196a3816a62dda05d11e11ff4ca7c51d26. Versione esatta Chrome/build Windows non raccolte. Fonti: risposte di Diego e rapporto DIAG di 34 eventi; nessun controllo della sessione Chrome nativa da Codex, nessuna password inserita o operazione amministrativa Firebase/Google Cloud dell'agente. Le prove nel browser della chat restano ausili separati.

Baseline prima dell'accensione: active=false, permitValid=false, permitExpiresAt=null, idleMs=180000, pushReady=true, lastBlock=null, registro enabled=true/available=true ed events vuoto. Diego conferma poi il solo enabled=true personale e Home leggibile con indirizzo app.html. Il primo tentativo con la scorciatoia della tastiera non produce un risultato ricostruibile; non si dichiara un difetto dell'app. Dopo aver chiarito i comandi, Diego riferisce il percorso **Home → avatar Profilo → Home → Privato → Account Personali**, seguito dai tre clic distinti:

| Comando riferito da Diego | Destinazione riferita |
|---|---|
| Freccia Indietro di Chrome, nella barra degli indirizzi | Area Privata |
| Freccia Avanti di Chrome, nella stessa barra | Account Personali |
| Freccia interna dell'app, accanto al titolo | Area Privata |

Diego conferma che l'indirizzo rimane sempre app.html. Conferma anche che **la Master Password ricompare**, ritenendo trascorsi i tre minuti: i riscontri positivi delle destinazioni non certificano una sola sessione senza nuovo sblocco.

Il rapporto finale contiene **34 eventi**, tutti v1.2.270/browser, ordinati e conformi all'allowlist di codici/campi/pagine. Totali: FRAME_EXIT 19, FRAME_ENTER 5, LOCK_EXPIRED 2, LOCK_PAGEHIDE 4, ERROR_FRAME_OPERATION 2 e LOCK_CHILD_REQUEST 2. Stato alla copia: active=true, permitValid=true, permitExpiresAt=1795042740000, idleMs=180000, pushReady=true, lastBlock=LOCK_PAGEHIDE; registro attivo/disponibile. Lo stato attivo della copia non ricostruisce la continuita precedente; pushReady non prova una consegna push e non assegna PASS D11. Orari seguenti **Europe/Rome**; FRAME_EXIT indica l'uscita della pagina, non il nome del comando premuto.

| Evento o tratto nel rapporto | Riscontro e limite |
|---|---|
| 22:49:18.622 FRAME_ENTER Home; 22:56:50.483 LOCK_EXPIRED Account | Primo tratto e blocco precedenti alla sequenza finale. |
| 22:59:14.450 e 22:59:26.814 ERROR_FRAME_OPERATION Account, ciascuno seguito da LOCK_CHILD_REQUEST | Errori tecnici prima del segmento finale; causa non attribuita. Nessuna Master errata, problema di rete o vulnerabilita dedotti dal solo codice. |
| 22:59:38.099 FRAME_ENTER Account | Inizio del tratto finale esaminato: 14 eventi complessivi, due ingressi, dieci uscite, un blocco expired e un pagehide del padre. |
| FRAME_EXIT 23:00:49.305 Account; 23:00:54.857 Home; 23:01:00.320 Profilo; 23:01:04.986 Home; 23:01:09.880 Area Privata | Uscite compatibili con la preparazione riferita; il registro non contiene query o hash. |
| FRAME_EXIT 23:02:19.733 Account e 23:03:18.111 Area Privata | Ordine compatibile con i risultati Indietro/Avanti riferiti; l'identificazione dei pulsanti viene dalla conferma dell'operatore. |
| 23:04:10.025 LOCK_EXPIRED Account; uscita; 23:04:43.012 LOCK_PAGEHIDE padre; 23:04:44.927 FRAME_ENTER Account | La sequenza attraversa un blocco e un nuovo ingresso. Il blocco e circa 180 secondi dopo l'uscita Area Privata delle 23:01:09.880: compatibile con il timeout scelto, senza provare da solo la causa. |
| FRAME_EXIT 23:05:08.825 Account e 23:06:46.745 Area Privata | Seguito coerente con il ritorno riferito tramite freccia interna e la visita finale alle Impostazioni per copiare il rapporto. |

**D04 Chrome resta parziale/NE**, con tre destinazioni positive riferite, permanenza in app.html e nuovo sblocco confermato; niente PASS della continuita, parita completa query/anchor o mancato ripristino di form sensibili. LOCK_EXPIRED confluisce da piu cause, tra cui inattivita, scadenza permesso, attesa dello sblocco e background: non tutti gli eventi expired sono una prova automatica dei tre minuti di inattivita. Le pause della guida sono compatibili con il superamento della soglia, ma non sostituiscono la diagnosi.

**Arresto finale:** dopo la copia Diego conferma esplicitamente Si, spento e salvato alla richiesta di rimettere solo enabled=false. Ultimo stato **canary OFF riferito dall'operatore**, distinto dalla fotografia DIAG ancora attiva; nessuna rilettura amministrativa indipendente o rapporto successivo allo spegnimento. Nessun PASS D15/revoca live, latenza o cancellazione RAM. D02 Chrome mantiene il proprio PASS; D03 e gli altri casi/ambienti, fase personale e C2 restano aperti.

Il seguito documentale parte da 02beeb1b su un ramo separato: la **#289 e il suo GO restano invariati**, nessun merge ancora autorizzato da Diego. Nessun codice, versione, workflow, Rules, Functions, singleton/claim, scadenza o preferenza di inattivita modificati da Codex; nessun deploy, grafica o sicurezza pubblicata. Il prossimo eventuale tentativo richiede ordine personale, preparazione chiara dei tre comandi e una sequenza continua entro la soglia, senza pause della chat fra i clic e senza allungare il timeout per ottenere un PASS. Gli errori tecnici rimangono da qualificare; nessuna correzione dichiarata.



<a id="cornice-c1-d03-d04-270-2026-11-11"></a>

## C1 QA2 — D03 parziale, D04 Chrome inconcluso, nuova prova integrata positiva e OFF — 11/11/2026

Seguito manuale su Google Chrome/profilo QA2, app v1.2.270, sorgente distribuito cb48b7196a3816a62dda05d11e11ff4ca7c51d26. Fonti: risposte di Diego nella chat, osservazioni del browser integrato e test locale distinto. Nessun UID, dato copiato o contenuto Vault viene aggiunto alla ricevuta. Il precedente D02 Chrome PASS resta limitato al proprio segmento; questo seguito non riapre o estende quel risultato.

**D03, sottocasi riferiti da Diego nella cornice:** Contatti leggibili/raggiungibili e senza sovrapposizioni; Indirizzi leggibili con pulsanti raggiungibili; Documenti leggibili/raggiungibili senza sovrapposizioni fino in fondo; Tessera digitale leggibile/raggiungibile senza sovrapposizioni. Lasciato Contatti selezionato, il QR nelle Impostazioni apre direttamente Tessera digitale: query di destinazione riscontrata corretta. L'indicazione iniziale Gestisci Tessera digitale era il nome del collegamento, non una scritta visibile; chiarita la guida al riquadro QR, nessun difetto attribuito a quella incomprensione.

In Anagrafica, matita Note Anagrafica → apertura → Annulla senza cambiamenti: Diego conferma chiusura e Profilo invariato. Copia di un telefono fittizio nei Contatti, incolla nel campo Ricerca senza invio e successiva rimozione/chiusura: Diego conferma copia corretta; nessun valore e riportato. In Dati Azienda dell'azienda sintetica gia presente visita Contatti, Indirizzi, Documenti e Tessera digitale e risponde tutto OK alla verifica di apertura, leggibilita/raggiungibilita e sovrapposizioni; nessuna sezione vuota segnalata. **D03 resta incompleto/NE:** confronto diretto con lo standalone ancora da eseguire e parita/anchor complessivi non certificati; nessun PASS globale dedotto dai soli sottocasi positivi. Nessun salvataggio richiesto o riferito.

**D04 Chrome, prima prova inconclusa:** percorso guidato Home → Profilo → Home → Privato → Account Standard. Diego riferisce Indietro corretto e Avanti di Chrome non selezionabile. Dopo una prima identificazione di entrambe le frecce come comandi Chrome, precisa di non ricordare con certezza e che forse Indietro era quello interno dell'app. La sequenza iniziale non e quindi ricostruita: **D04 Chrome rimane NE/inconcluso**, senza FAIL o difetto specifico dimostrato. La lettura della finestra Chrome nativa si era interrotta prima di acquisire la schermata per insufficiente riconoscimento dell'URL, anche dopo la conferma Chrome pronto; nessun clic nativo eseguito e nessuna immagine ottenuta. Nell'inventario disponibile per la successiva prova non compare una finestra Chrome controllabile. Nessun risultato di altre superfici certifica la colonna Chrome.

**Due riscontri distinti:** il test locale gia presente real broker/transport: ten private documents use one unlock, queries/fragments and back/forward persist viene rieseguito con Chrome headless e Auth/ammissione sintetiche, sola rete loopback: **1/1 PASS**, zero skip. Usa chiamate al facade e non l'esatta sequenza mista di clic dell'app: non chiude D04 fisico. Dopo l'ordine aggiuntivo fai la prova anche tu e l'apertura personale dell'app nella chat, Codex legge una sessione gia sbloccata e prova nel **browser integrato** Home → Privato → Account Personali, poi Indietro → Area Privata e Avanti → Account privato standard: destinazioni riscontrate nelle pagine visibili. Il primo tentativo con un selettore non si completa mentre la pagina osservata passa a Home; la sequenza conclusiva riparte dalla Home con i comandi effettivamente presenti. I comandi di cronologia usano le API del browser integrato: non viene certificato lo stato del pulsante Avanti della finestra Chrome nativa. Nessuna password inserita, record aperto o modifica salvata da Codex; nessun accesso amministrativo Firebase/Google Cloud. Il riscontro integrato resta ausiliario, fuori dalle quattro colonne canoniche C1.

**Primo arresto e rapporto OFF:** dopo la prima prova ausiliaria Diego conferma il salvataggio personale di enabled=false. Tornato nella stessa scheda Chrome QA2 senza ricaricare o altri clic, riferisce Vault bloccata / Sblocca e riprendi. Il rapporto successivo ricevuto mostra v1.2.270, active=false, permitValid=false, permitExpiresAt=null, idleMs=180000, pushReady=false, lastBlock=null, registro enabled=true/available=true ed events vuoto. enabled nel rapporto riguarda il registro, non il singleton. Le nuove richieste Master fra pagine standalone con cornice OFF sono attese; il journal vuoto non ricostruisce D04. La vista bloccata non misura la latenza, non esclude un blocco precedente per inattivita e non prova cancellazione RAM: **nessun PASS D15**.

**Nuova prova completa nel browser integrato, distinta da Chrome:** dopo la precisazione sulla freccia Diego chiede di rifare la prova e ordina fai tu. Conferma personalmente una nuova accensione; la Master Password iniziale e inserita soltanto da lui nell'app. Codex osserva poi la Home sbloccata nella cornice e svolge la sequenza seguente, con lettura della pagina visibile dopo ogni passaggio. I comandi browser sono Back/Forward del browser integrato; l'ultimo Indietro e invece il pulsante interno dell'app.

| Passaggio eseguito | Destinazione osservata |
|---|---|
| Home → avatar del Profilo | Profilo Utente |
| Profilo → Home | Home |
| Home → Privato | Area Privata |
| Area Privata → Account Personali | Account privato, categoria standard |
| Indietro del browser integrato | Area Privata |
| Avanti del browser integrato | Account privato, categoria standard conservata |
| Indietro interno dell'app | Area Privata |

Pagine leggibili, padre rimasto app.html con route coerente, nessuna nuova richiesta Master osservata durante questa sequenza. Verificate le destinazioni anche dopo l'effettivo caricamento, senza dedurle dal solo clic; le immagini ritagliate dei due esiti finali mostrano soltanto le intestazioni Account privato e Area Privata. Il percorso comprende il clic reale sull'avatar, oltre ai collegamenti e ai due tipi di Indietro. Nessun record aperto, dato modificato o salvataggio, nessuna password inserita da Codex. Questa prova e **positiva come ausilio IAB**, fuori dalle quattro colonne canoniche C1: non prova lo stato del pulsante Chrome nativo, la parita completa di query/anchor o il mancato ripristino di form sensibili. Nessun nuovo test locale rieseguito o difetto corretto per questo seguito.

**Arresto di quella prova:** Diego conferma nuovamente di avere salvato personalmente enabled=false; nessuna rilettura amministrativa indipendente o nuovo rapporto DIAG successivo a questo secondo spegnimento. Questo e il checkpoint precedente all'ulteriore ripetizione seguente.

**Ulteriore riprova su richiesta prova ancora:** Diego conferma prima il singleton OFF, poi esegue personalmente la nuova accensione e lo sblocco nella pagina della chat. Il segmento valutato inizia soltanto dopo la Home figlia visibile nella cornice. Codex ripete tutti i sette passaggi della tabella, compresi il clic sull'avatar, Back e Forward del browser integrato e la freccia interna dell'app: Home/Profilo/Area Privata/Account privato osservati dopo il caricamento, categoria standard mantenuta, padre app.html con route coerente e nessuna nuova finestra Master durante la sequenza. L'ultimo Indietro interno termina su Area Privata; immagine di prova limitata alla sua intestazione, senza dati dei record. Nessun record aperto, modifica salvata, password inserita da Codex o nuovo test locale. Il tentativo separato di accedere alla finestra Chrome si era nuovamente interrotto per riconoscimento insufficiente dell'URL, prima di clic applicativi. **Riprova IAB positiva come solo ausilio; D04 Chrome ancora NE/inconcluso**, senza certificare query/anchor complessivi o ripristino di form sensibili.

**Ultimo arresto confermato:** alla fine dell'ulteriore riprova Diego risponde ho messo false alla richiesta di salvare personalmente solo enabled=false. **Canary OFF secondo l'operatore**, senza rilettura amministrativa o nuovo rapporto DIAG successivo all'ultimo spegnimento. Nessuna revoca live, latenza o cancellazione RAM certificata e nessun PASS D15. D02 Chrome conserva il proprio PASS; D03/D04, altri casi/ambienti e fase personale restano incompleti/NE. Nessun cambiamento a app, workflow, Rules, Functions, claim, scadenza o preferenza di inattivita, nessun accesso amministrativo Firebase/Google Cloud di Codex. Nessuna correzione, merge/deploy o CORNICE CHIUSA; nessuna nuova accensione implicita. Si aggiorna solo questa evidenza: STATO, incarico e guida conservano perimetro, risultati e stato OFF gia descritti. Ricevuta e avviso a Claude sulla #289/#278 per revisione readonly.

<a id="cornice-c1-d02-270-2026-11-11"></a>

## C1 QA2 su 1.2.270 — D02 PASS Chrome Windows, D03 parziale — 11/11/2026

Fonti: azioni/conferme personali di Diego e due rapporti DIAG copiati nella chat; Diego conferma esplicitamente che il giro e svolto in Google Chrome con profilo QA2, distinto dal browser integrato della chat. Versione app **v1.2.270**, sorgente distribuito cb48b7196a3816a62dda05d11e11ff4ca7c51d26; versione esatta di Chrome/build Windows non raccolte. Nessuna esecuzione autenticata, login, sblocco o operazione amministrativa Firebase/Google Cloud di Codex.

Preparazione: un primo rapporto apparteneva all'account personale e viene escluso da C1 QA2; la sua preferenza di inattivita non viene modificata. Diego esce da quell'account, accede a QA2 e copia la baseline OFF: active=false, permitValid=false, idleMs=180000, lastBlock=null, registro acceso/disponibile e zero eventi. Dopo la guida cambia personalmente solo enabled a true, confermando l'accensione; scadenza invariata al 18/11/2026 ore 23:59 Europe/Rome. Raggiunta la vista Vault bloccata, riferisce un clic su Sblocca e riprendi, inserimento locale della Master Password e Home aperta. Questi sono riscontri del primo accesso, **non un PASS globale D01/Auth/App Check**.

Il primo rapporto contiene 107 eventi e il secondo 124: i primi 107 sono identici, seguono 17 FRAME_EXIT v1.2.270. Si isola il segmento dal **FRAME_ENTER 1794420113369**, Home alle **19:01:53.369 Europe/Rome**, fino all'ultimo evento alle **19:14:34.186**: **37 eventi**, un ingresso e 36 uscite delle pagine figlie, tutti v1.2.270/browser. Nessun nuovo LOCK_*, ERROR_*, ADMISSION_*, FRAME_ENTER o uscita del padre nel segmento; FRAME_EXIT e compatibile con il pagehide normale della figlia. Il lastBlock=LOCK_PAGEHIDE finale rinvia al blocco precedente all'ingresso, non a un blocco durante D02. I 77 eventi storici v1.2.269 e il precedente LOCK_EXPIRED v1.2.270 non concorrono al risultato.

Nel primo tratto manca Archivio Account e Diego non ricorda di averlo aperto: **nessun PASS assegnato a quel rapporto isolato**. Il seguito e append-only dello stesso segmento, senza interruzioni documentate, e contiene Archivio Account alle 19:12:11.493 e 19:13:26.499. Ora sono presenti tutte le destinazioni canoniche: home_page, area_privata, account_privati, profilo_privato, impostazioni, regole_scadenze, configurazione_documenti, scadenze, archivio_account, gestione_destinatari. Presenti anche aggiungi_scadenza e dettaglio_account_privato, senza una prova CRUD o salvataggio dedotta dalle aperture.

Diego conferma separatamente per entrambi i tratti **nessuna nuova Master Password, pagine leggibili e permanenza nella stessa scheda app.html**; la sequenza e stata guidata con soli collegamenti interni, senza reload o salvataggi. Stato finale active=true, permitValid=true, idleMs=180000, registro acceso e disponibile. **D02 PASS soltanto fase 1 QA2 / Chrome desktop Windows / 1.2.270**, sulla base delle prove manuali riferite e del segmento compatibile: il solo stato DIAG non avrebbe certificato lo sblocco. Nessun trasferimento agli altri ambienti o alla fase personale.

**D03 parziale:** Diego apre Profilo → Contatti, scorre senza modificare dati e conferma testi/pulsanti leggibili, raggiungibili e senza sovrapposizioni. Restano Indirizzi, Documenti, Tessera digitale e gli altri controlli previsti; D03 in matrice rimane NE, senza estendere il sottocaso positivo a parita completa, copia/annullamento o profilo aziendale. D01 e gli altri casi restano NE/incompleti; pushReady=false non attribuisce un esito a D11. **Canary ON secondo la conferma personale e i rapporti ricevuti**, nessuna rilettura amministrativa indipendente; arresto con enabled=false alla prima anomalia effettiva. Nessuna modifica a codice, preferenza di inattivita, singleton/claim da parte di Codex o nuova pubblicazione. C1 e C2 restano aperti; nessuna CORNICE CHIUSA.

<a id="cornice-riprendi-pubblicazione-1-2-270"></a>

## Hosting 1.2.270 pubblicato e verificato, canary OFF — 11/11/2026

Fonti: [GO Claude sul candidato finale ee101767](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/288#issuecomment-6797126819), ordine personale di merge/Hosting e successiva delega esplicita per il clic finale in chat; [run #1088](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/43036071599), log dei job e storico approvazioni API, confronto pubblico indipendente. La [#288](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/288) e unita in **cb48b7196a3816a62dda05d11e11ff4ca7c51d26**, albero identico al candidato revisionato. I check PR e post-merge sono verdi; la run manuale usa master, tale SHA e release_scope=hosting.

Diego delega a Codex Approve and deploy **per la sola #1088**. Approvazione production registrata come approved con il commento che identifica delega/scope/SHA; nessun bypass o modifica delle protezioni. Non e una delega generale. Validate **130575108944** e Deploy Firebase production **130582061839** conclusi SUCCESS. Comando CI effettivo con --only hosting; installazione backend e scope recovery prerequisites, Vault Rules e MFA response saltati, nessuna Functions/Rules distribuita.

Pubblicazione completata **11/11/2026 14:57:16 UTC (15:57:16 Europe/Rome)**; verifica pubblica CI riuscita alle 14:57:29 UTC. Successiva verifica indipendente dal checkout pulito dell'esatto merge: generazione del manifest ignorato e comando release-manifest con --require-clean e --verify-url sul sito pubblico, uscita 0; esito acquisito prima delle 15:03:28 UTC. **Manifest 1.2.270**, sourceCommit esatto, **362/362 payload e hash** (363 file compreso il manifest), public tree SHA-256 **5689f9de7059c9733f6ad5fd5d4c598982e4a3c2aece1767e148942b18bdb735**. Verificati 41 profili di intestazioni, root/rewrite/redirect/alias e i tre probe di normalizzazione child/shell/public, inclusa policy del manifest. Nessuna modifica a modello, header configurati o precache per questa ricevuta.

Rapporto completo pubblicato per Claude sulla [#288](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/288#issuecomment-6799339795) e sulla [#278](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6799344776). **Limiti:** confronto HTTP distinto da prova fisica e aggiornamento delle singole schede/PWA; C1 D01/D02 sospesi/NE, revoca live e altri ambienti non certificati. La 1.2.270 corregge le etichette della vista bloccata nelle otto lingue, senza risolvere i rilievi separati su Ricerca, doppio clic OFF o gli errori tecnici non attribuiti. **Canary OFF secondo l'ultima conferma personale di Diego**, senza rilettura o scrittura amministrativa di Codex. Nessun singleton/claim modificato, nuova grafica o sicurezza pubblicata; revisione produttiva Claude e nuovo ordine personale prima della riaccensione. La ricevuta documentale non richiede altro deploy. Le sezioni seguenti conservano la fase candidata e le prove precedenti.

<a id="cornice-riprendi-fix-2026-11-11"></a>

## C1 — candidata 1.2.270, testo della vista bloccata — 11/11/2026

Diego sceglie [l'opzione 3](../progetto/DECISIONI.md#cornice-riprendi-scelta-2026-11-11): Vault bloccata / Sblocca e riprendi. Conferma successivamente enabled=false; nessuna rilettura o scrittura amministrativa di Codex. Base runtime 6b61eead, ramo codex/vault-frame-resume-copy-20261111 dalle ricevute 1350971d. Produzione 1.2.269; questa e una candidata non pubblicata.

Implementazione limitata al title, h1 e testo/chiave del link di app.html e a due traduzioni dedicate nei cataloghi it/en/es/fr/de/zh/hi/pt. Le chiavi condivise di Privato e Home restano intatte; href e gestore resume non cambiano. Aggiornamenti meccanici del versionamento canonico alla 1.2.270 e metadato reviewedAppVersion del catalogo guida; nessun cambiamento alle istruzioni/target D0. Nessun nuovo MD o dipendenza installata.

**Verifiche locali:** suite cornice **248/248 PASS**, compresi dieci casi del dialogo reale sopra iframe/focus/inert e cinque casi header/framing su Hosting Emulator demo. Offline **16/16 PASS**, precache **342 risorse**, runtime Firebase con 61 export rigenerato usando lo stesso SDK gia installato; vendor e lista precache identici alla base. I18n **19/19 PASS**, zero nuove chiavi usate mancanti nelle otto lingue; guida **12/12 PASS**, 31 pagine/126 istruzioni/111 target; budget rispettati da tutte le 31 pagine senza aumento delle soglie, diagnostica **4/4 PASS** e sintassi di 249 moduli valida. Versionamento coerente su 275 riferimenti; documenti **12/12 PASS**, 34 MD e 890 collegamenti; diff senza errori di spaziatura.

**Preparazione del banco:** la prima build non trova il pacchetto Firebase nel nuovo worktree; copia locale dello stesso SDK, versione confrontata col lock, consente la build senza installazioni. I cinque test header sono inizialmente bloccati dalla CLI assente nel worktree, poi dal timeout di avvio; riuso della CLI locale della versione del lock e modalita CI senza controllo aggiornamenti risolvono il solo banco. Rerun dei cinque header **5/5 PASS**, quindi nuova esecuzione integrale della suite **248/248 PASS** con uscita 0. Nessun test saltato o modifica ai test/permissi di produzione per ottenere il risultato.

**Manifest locale:** 1.2.270, 362 payload, albero pubblico **e997a8dc177ef0a3304cb4e9aa6cdc8ddd90fb52181b479c0f5faad2424b447c**, generazione e verifica locale riuscite. La generazione preliminare sul tree non ancora committato non certifica l'origine del rilascio: manifest da riallineare al commit finale e verificare in CI prima di un eventuale rilascio. firebase.json, Rules, Functions e workflow identici alla base; il diff applicativo normalizzato per la sola versione contiene solo app.html e le due chiavi negli otto dizionari. Nessuna variazione funzionale al gestore resume.

**Limiti:** CI del nuovo head e revisione Claude ancora da attendere. I test browser usano solo fixture e chiavi fittizie, non l'account QA2 o il cloud; non certificano i quattro ambienti fisici o la nuova etichetta gia online. D01/D02 restano sospesi/NE e i due ERROR_FRAME_OPERATION restano di causa non identificata. La correzione delle etichette non risolve o riclassifica i rilievi separati su Ricerca e doppio clic OFF. Revisione Claude e ordine personale prima di qualsiasi merge/rilascio.

<a id="cornice-c1-ripresa-2026-11-11"></a>

## C1 QA2 — ripresa manuale su 1.2.269, 11/11/2026

Fonte: azioni e riscontri riferiti da Diego nella chat, Chrome desktop Windows, profilo QA2; nessuna esecuzione autenticata o lettura amministrativa di Codex. Produzione 1.2.269 e sorgente 6b61eead restano quelli della ricevuta seguente. I risultati non si trasferiscono agli altri tre ambienti o alla fase personale.

Preparazione ripetuta con singleton OFF confermato: logout con conferma, ritorno al login, nuovo accesso e Home riferiti da Diego. In Impostazioni riattivato volontariamente il registro; rapporto v1.2.269 con active=false, permitValid=false, permitExpiresAt=null, idleMs=180000, lastBlock=null ed eventi vuoti. enabled=true nel rapporto indica solo il registro diagnostico. Diego conferma poi il cambio personale del solo enabled del singleton a true; scadenza invariata al 18/11/2026 alle 23:59 Europe/Rome. Nessun nuovo claim o provisioning.

Primo ingresso: vista «Privato / Home Page» in app.html; Diego riferisce che il clic apre SBLOCCO VAULT e, dopo l'inserimento locale, mostra Impostazioni. Il gestore resume conserva la route richiesta: l'etichetta Home Page e fuorviante, non prova una destinazione Home. Il successivo rapporto ha active=true, permitValid=true, permitExpiresAt=1795042740000, idleMs=180000, lastBlock=LOCK_PAGEHIDE, registro acceso e disponibile. Il journal comprende anche tentativi precedenti e LOCK_POLICY_REVOKED, LOCK_CHILD_REQUEST e LOCK_EXPIRED: senza un collegamento temporale controllato non attribuiamo loro una causa o un PASS della revoca/inattivita. La spia active attesta il documento figlio riconosciuto dall'owner, non da sola la chiave sbloccata.

**D02 in corso, riscontri parziali:** dopo lo sblocco, Diego riferisce navigazioni senza nuove richieste Master e conferma separatamente Area privata e lista Account privati standard, aperte senza Master Password. Home e Impostazioni sono le altre due destinazioni gia raggiunte: quattro Document distinti riferiti, non ancora l'itinerario completo di dieci. Nessuna modifica dei dati richiesta. D01 resta incompleto per la sequenza iniziale da chiarire; D02 non e ancora PASS. D01-D19 della matrice rimangono NE finche non sono completate le singole azioni e i risultati attesi. Nessun esito fisico dedotto dai test automatici.

**Prosecuzione D02:** Diego conferma poi Profilo, Regole invio scadenze, Destinatari, Scadenze e Archivio Account senza nuove richieste Master: nove destinazioni distinte riferite. Configurazione documenti resta da raggiungere. Il comando suggerito «apri configurazione documenti» nella Ricerca mostra Configurazione della regola come primo risultato, non apre la pagina prevista. Riproduzione locale in memoria con catalogo e motore produttivi, zero record, nessun browser/Auth/rete: la pagina esatta e settima e viene esclusa dai cinque risultati; la ricerca «configurazione documenti» senza «apri» la restituisce invece al primo posto. E un rilievo distinto sulla graduatoria della Ricerca, non una richiesta Master ripetuta e non una navigazione D02 completata. Nessuna correzione runtime eseguita; indicazione successiva limitata alla frase verificata e alla selezione esplicita della pagina.

**Rapporto finale acquisito e D02 sospeso/NE:** usando la frase verificata, Diego conferma anche Configurazione documenti aperta senza Master. Sono quindi dieci destinazioni visitate; cio non certifica una singola sessione continua. Il rapporto successivo contiene 74 eventi, dieci pagine figlie distinte piu app.html, 13 FRAME_ENTER, 12 LOCK_PAGEHIDE, sette LOCK_EXPIRED, tre LOCK_CHILD_REQUEST, due LOCK_POLICY_REVOKED e due ERROR_FRAME_OPERATION. Stato finale active=true e permitValid=true, versione v1.2.269; non ricostruisce da solo la continuita passata. La guida una pagina per messaggio ha interposto pause: non si deve aggirare il timer o assegnare PASS a dieci aperture distribuite fra sessioni diverse.

I due errori avvengono alle 11:44:16.250 su Profilo e alle 12:20:49.653 su Scadenze, Europe/Rome; seguono l'ingresso di 5.211 e 4.293 secondi, poi LOCK_CHILD_REQUEST dopo 2 e 3 ms. Sorgente verificato: l'owner aggrega ogni risposta kind=error nello stesso evento, il transport ne perde il codice specifico e il figlio chiama clearSession/lock. Il ciclo e compatibile anche con Master errata o sblocco annullato: nessuna di queste cause e provata e nessun bug e dichiarato confermato. Sette scadenze sono tutte oltre 180000 ms dall'evento registrato precedente; mancano gesti, completamento unlock e visibilita per misurare l'inattivita effettiva. FRAME_EXIT puo essere normale pagehide del figlio, non uscita dall'owner.

Non si passa a D03: richiesto a Diego di rimettere personalmente enabled=false prima di altri tentativi; conferma ancora attesa alla presente ricevuta. Registro acquisito, nessuna richiesta di cancellazione o logout. Nuova revisione readonly di Claude sulle evidenze, poi eventuale chiarimento e una prova D02 continua senza attese in chat tra le pagine; nessun innalzamento della preferenza per far passare il test. D01 e D02 restano incompleti/NE; nessun FAIL di sicurezza, PASS C1 completo o correzione runtime dedotti dal solo journal.

**Stato operativo alla presente annotazione:** ultimo rapporto ammesso, spegnimento personale richiesto e ancora da confermare; nessuna lettura/scrittura Firebase di Codex. Prove sospese, nessun deploy, modifica alla cornice, UID o dato personale in questa ricevuta. Nessuna CORNICE CHIUSA. Le sezioni sotto conservano i checkpoint precedenti, compresi gli spegnimenti.

<a id="cornice-dialogo-pubblicazione-1-2-269"></a>

## Cornice: rilascio Hosting 1.2.269 verificato — 11/11/2026

**Fonte e autorizzazione:** [ordine corrente](../progetto/INCARICO_CORRENTE.md#cornice-dialogo-rilascio-2026-11-11), [GO Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/286#issuecomment-6788613792) sul candidato f25ed120848c603da5520e078aba8efce4b27806, tre check obbligatori verdi. #286 segnata pronta e unita con expected_head_sha vincolato; sorgente master **6b61eead6dc6791eafea15038486020d22267ac4**, albero identico al candidato e ramo conservato. Nessuna modifica ai file dopo il GO prima del merge.

**Run e approvazione:** [Hosting #1075](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42972066163), evento workflow_dispatch su master, RELEASE_SCOPE hosting letto nei log. La run era già stata avviata da Diego; Codex non ne avvia una duplicata. L'API registra approved dall'account Diego-Stack-ai per production; l'endpoint non riporta l'ora del clic. Nessun bypass amministratore. validate e deploy riusciti; pubblicazione alle **07:38:40 Europe/Rome**, verifica CI alle 07:38:48. Solo comando --only hosting eseguito: Rules, Functions e gli altri scope backend saltati. Il singleton non è parte di questo rilascio.

**Verifica indipendente:** dal checkout pulito del merge eseguito `node scripts/release-manifest.mjs --commit 6b61eead6dc6791eafea15038486020d22267ac4 --require-clean --verify-url https://appcodici-password.web.app --retries 8 --delay-ms 5000`, concluso con codice 0. Versione **1.2.269**, manifest e **362/362 payload/hash** uguali al sorgente; 363 file serviti contando il manifest. Albero pubblico **f7c4e7b057c89c6f317e65017a77b4124e605a623d52f8adc4e841b440a18e5c**. Verificati i 41 profili header, cache del manifest, root/home, redirect storico e tre probe di normalizzazione. Nessun SDK amministrativo o dato Vault usato. Versionamento locale coerente su 275 riferimenti; documenti **12/12 PASS**, 34 MD e 877 collegamenti prima della presente ricevuta.

**Versione caricata, prova manuale:** Diego riferisce dopo Ctrl+R nella Home di Chrome QA2 «Vedo v1.2.269». PASS della sola verifica dell'aggiornamento di quel browser; non è un PASS D01 né certifica tutte le PWA installate.

**Limiti e seguito:** singleton OFF secondo l'ordine e la precedente conferma dell'operatore, non riletto da Codex; nessuna nuova attivazione, claim o modifica dati. Restano D01, revoca durante sessione aperta e C1 nei quattro ambienti fisici, oltre al distinto doppio clic Home. Sul telefono il passaggio in background annulla il dialogo: comportamento atteso da annotare nel futuro C1. La [ricevuta pubblica sulla #286](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/286#issuecomment-6789028976) e l'[avviso sulla #278](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6789029978) richiedono la verifica produttiva readonly di Claude, non ancora attestata qui. Nessuna CORNICE CHIUSA. Le sezioni successive documentano la preparazione precedente al rilascio.

<a id="cornice-dialogo-fix-2026-11-10"></a>

## Dialogo della cornice — candidata 1.2.269, 10/11/2026

[Mandato](../progetto/INCARICO_CORRENTE.md#cornice-dialogo-fix-incarico-2026-11-10): correzione su ramo dedicato, PR in bozza e rapporto leggibile da Claude su GitHub, senza identificativi o dati personali. Base 41c63006. Nessuna modifica a workflow, firebase.json, Rules, Functions, policy o credenziali. Canary OFF riferito dall'utente, non riacceso da Codex; produzione resta 1.2.268. Nessun deploy o nuovo collaudo fisico.

**Implementazione:** stili UI comuni caricati anche nel padre. L'owner mantiene un hold del dialogo, distinto da chiave/permesso/timer; aggiornamento inset e resize non possono annullare inert mentre il dialogo e aperto. Guardia DOM solo parent: fratelli non interattivi, semantica dialogo, Tab/Shift+Tab ed Escape, recupero focus anche da un tentativo di focus nella figlia. Rilascio idempotente ricalcola lo stato attuale; blocco/dispose vincono. Sostituzione cancella il dialogo precedente; abort gia presente non apre una nuova finestra, abort in corso svuota subito il campo. Il mascheramento e gli attributi anti-autofill esistenti restano conservati.

**Browser reale locale:** tests/vault-frame-modal.browser.test.mjs usa HTML e CSS effettivi di app.html, owner/transport e showInputModal produttivi; solo identita/ammissione e verifica della password sono fittizie. Il callback unlock attende il dialogo reale, non restituisce subito la chiave. Nessun SDK Firebase o credenziale reale; contesto Chrome temporaneo, service worker bloccati e richieste pagina esterne negate. **10/10 PASS:** desktop/mobile viewport e resize, hit testing sopra iframe, mascheramento, iframe inert, tentativi di clic/tasti/focus nella figlia, Tab/Shift+Tab, conferma, annullamento fresco, revoca, pagehide, freeze, background breve, dispose, segnale gia abortito, sostituzione e regressione standalone. Il caso hidden verifica annullamento e figlio nascosto/inert, distinto dalla rimozione sulle altre revoche.

**Controllo negativo:** due esecuzioni della medesima asserzione positiva, con solo CSS UI rimosso dalla fixture privata, falliscono su static invece di fixed, come atteso. La suite include inoltre negativi che rilevano assenza CSS e guardia focus/inert. Prima del test definitivo sono stati corretti il percorso Windows del server fittizio, un'attesa di attivazione del secondo dialogo e la gestione dell'esito di annullamento nella fixture: quei tentativi non sono dichiarati PASS applicativi.

**Verifiche della candidata:** suite cornice **248/248 PASS**, comprendente i dieci nuovi casi e i test header browser su Hosting Emulator demo-only; hardening **71/71 PASS**; offline **16/16 PASS**, 342 risorse senza anteprime; sintassi 249 moduli, riferimenti 338 file, Stylelint e assenza cicli riusciti. Budget statici di tutte le 31 pagine rispettati senza aumentare soglie: guardia importata soltanto dall'owner, non aggiunta al bootstrap delle altre pagine. Versionamento canonico 1.2.269: 275 riferimenti uniformati in 111 file applicativi; le relative righe sono modifiche meccaniche, non adozione grafica. Manifest locale verificato con 362 file; generazione su albero non ancora committato e relativa origine non equivalgono alla ricevuta di rilascio CI.

**Limiti e seguito:** Chrome headless con viewport emulati non certifica Chrome Windows manuale, Android Chrome, Safari iPhone o PWA installata. Non provati nel banco: Firebase Auth/App Check, PRF, chiave reale, consegna push, revoca live o intero percorso storico C1. Il doppio clic Home resta rilievo separato e non e corretto da questa PR. C1 ON rimane sospeso, nessuna CORNICE CHIUSA. Riesame interno statico non equivale al GO Claude; revisione del nuovo SHA e ordine personale prima di merge, rilascio e ulteriore accensione. [Contratto UI](../regole/INTERFACCIA.md#cornice-dialogo-ui-2026-11-10).

**Consegna su GitHub:** commit applicativo 9e9488b875286b8b8571ea954a462df5efeed6db inviato nel ramo dedicato; [PR #286 in bozza](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/286), rapporto completo copiato nella descrizione. [Richiesta readonly a Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/286#issuecomment-6781467146) e [rinvio sulla #278](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6781468385) pubblicati. Gitleaks su indice e singolo nuovo commit: nessun nuovo segreto. Manifest rigenerato dopo il commit: 362 file, albero f6939510a6a2af2ed8451e6bfd94bb2d685c4659bd66061c382806c8725606e1, verifica locale riuscita. Eventuali commit delle sole ricevute lasciano invariato il codice applicativo; CI e revisione del relativo head restano leggibili su GitHub, non dichiarate superate da questa ricevuta. Nessun merge, deploy o accensione.

**Allineamento catalogo dopo CI:** la run validate 42918461368 si ferma sul gate guide: reviewedAppVersion era ancora 1.2.268. Riesaminati route, target e diff di app.html: i comandi non cambiano; catalogo aggiornato a 1.2.269, contentVersion 12 conservata. `npm run test:guide`: 31 pagine, 126 istruzioni, 111 target e **12/12 PASS**. Questa modifica aggiuntiva del solo metadato pubblico cambia l'hash del catalogo e richiede un nuovo manifest locale/CI; l'albero f6939510 sopra resta la ricevuta del commit precedente. Esito completo CI da leggere sul nuovo head della PR, senza dichiararlo preventivamente verde.

<a id="cornice-c1-qa2-2026-11-10"></a>

## Cornice C1 QA2 — avvio guidato fisico, 10/11/2026

**Provenienza:** passi eseguiti personalmente da Diego, riscontri nella chat; non sono chiamate Firebase o prove device eseguite da Codex. Nessun UID, password, token o contenuto Vault riportato. Account sintetico gia popolato, identita verificata privatamente dal runner; non creato, ruotato o ripopolato per queste prove.

Preparazione riferita: ADC impersonata dedicata e singleton completo con schema/versione 1, destinatario QA2, enabled=false, Timestamp 18/11/2026 23:59 Europe/Rome. Apply autorizzato dopo GO Claude riportato: wrote=true, verified=true, otherClaimCount=3, preservesOtherClaims=true. Ricevuta preventiva DPAPI privata fuori da Git/OneDrive; nessun suo contenuto letto da Codex per questa annotazione. Gli avvisi SDK sono distinti dall'esito applicativo positivo.

**PRE-OFF Chrome Windows — PASS riferito:** nuovo profilo Chrome locale QA2 senza sincronizzazione Google; iniziale login rifiutato, interrotto e ricopiata privatamente la credenziale prima di un unico nuovo tentativo riuscito. Il motivo del primo rifiuto non e accertato e non e attribuito a Firebase, alla cornice o al helper. Sblocco Vault riuscito, Home standalone riferita dall'utente. Nessuna accensione dedotta dal login. Report DIAG copiato manualmente: versione v1.2.268, active=false, permitValid=false, permitExpiresAt=null, idleMs=180000, pushReady=false, lastBlock=null, enabled=true, available=true, events vuoto. enabled del report indica il solo consenso al registro locale. Lo stato passivo fuori cornice non dimostra da solo il diniego server.

Dry-run successivo al login eseguito personalmente da Diego: targetValidated=true, policyComplete=true, applyReady=true, alreadyCurrent=true, wouldWrite=false, wrote=false, verified=false; altri tre claim preservati. verified=false e normale nel dry-run. Questo riscontro conferma privatamente il binding e il claim ancora presente dopo il login, senza nuove scritture. Claude GO sul PRE-OFF riportato da Diego; raccomandazione di ripetizione negli altri ambienti conservata, **PRE-OFF Android, Safari iPhone e PWA iPhone NE**.

Ordine successivo: Diego accende personalmente solo enabled, guida C1 un caso alla volta; primo intervento in caso di anomalia enabled=false, poi raccolta DIAG e arresto. [Scadenza confermata esplicitamente](../progetto/DECISIONI.md#cornice-c1-scadenza-2026-11-10) al 18 novembre ore 23:59 italiane, pur superando sette giorni dall'ordine odierno. Diego conferma successivamente in chat il salvataggio personale ON: nessuna scrittura o rilettura Firebase indipendente di Codex. **D01 avviato nella guida ma non ancora verificato; D01-D19 NE in tutte le colonne**. D19 parziale solo per consenso/copia Chrome: non prova cancellazione, TTL, logout, off o appunti Safari/PWA. D11 non eseguito; worker non pronto nel rapporto, senza attribuzione di FAIL dalla sola spia. Nessuna CORNICE CHIUSA; fase personale interamente NE.

Ambiente finora identificato: Chrome desktop Windows nel profilo locale QA2, app v1.2.268 riferita; build Windows e versione esatta Chrome non ancora annotate. Nessun test headless/emulato sostituisce questa colonna. I PASS automatici nelle ricevute precedenti restano distinti. [Matrice e casi C1](#cornice-b2-lista-2026-11-09); le ricevute preparatorie sotto conservano la situazione antecedente al provisioning manuale e non attestano l'attuale accensione.

**D01 Chrome Windows — riscontro parziale, esito NE in attesa del comportamento riferito:** primo rapporto ON copiato da Diego con v1.2.268, active=true, permitValid=true, permitExpiresAt=1795042740000 (18/11/2026 23:59 Europe/Rome), idleMs=180000, registro acceso e disponibile, pushReady=false. Il journal contiene ingressi/uscite, un LOCK_CHILD_REQUEST e due LOCK_PAGEHIDE del padre, poi un nuovo FRAME_ENTER; lastBlock conserva LOCK_PAGEHIDE. Il riesame del solo sorgente conferma che FRAME_EXIT puo essere il pagehide normale della figlia e lastBlock puo riferirsi al journal precedente, anche con stato attuale ammesso. Questo non certifica ne un difetto ne l'assenza di richieste ripetute: chiesta conferma a Diego sul numero di sblocchi senza ulteriori ricariche. Nessun FAIL o PASS D01 attribuito dal solo report, nessun passaggio a D02 e nessuna operazione cloud di Codex. Regola di arresto invariata alla prima anomalia effettiva.

**Seguito D01 — sospeso, non PASS:** Diego chiarisce di aver aperto Home, poi premuto Ctrl+R e visto la pagina tipo app; riferisce zero richieste Master Password. Il sorgente distingue ammissione/mount del padre dallo sblocco su richiesta del figlio: active/permitValid non attestano sessione sbloccata. Home e Impostazioni richiedono comunque la chiave nel bootstrap privato; dopo una vera ricarica del padre e prima richiesta della chiave e attesa una nuova cerimonia Master/PRF. Restano da distinguere bootstrap incompleto, ricarica effettiva del padre e possibile biometria: nessuna vulnerabilita o chiave persistita dedotta dal solo racconto. Per l'ordine di arresto di Diego richiesto **enabled=false prima di altre prove**; spegnimento non ancora confermato. Nessun passaggio a D02, nessun nuovo tentativo, logout o modifica runtime/cloud di Codex.

**Spegnimento confermato e sequenza OFF chiarita:** Diego conferma personalmente enabled=false. Screenshot QA2 della sequenza successiva mostrano app.html con sola vista Privato/Home Page e senza contenuto figlio; poi Home standalone con richiesta Master, sblocco confermato dal toast, passaggio a Impostazioni standalone con una nuova richiesta Master e relativo toast. Gli URL osservati sono rispettivamente app.html, home_page.html e impostazioni.html; nessun identificativo riportato. Diego precisa che il collegamento Home Page della vista bloccata ha richiesto due clic: prima nessun effetto percepito, poi uscita verso Home. Questo seguito e **fuori cornice con OFF**, percio le due richieste su documenti diversi corrispondono al comportamento standalone atteso e non costituiscono un FAIL di continuita ON. Il doppio clic resta un rilievo di usabilita da verificare separatamente, non classificato come falla.

Revoca: osservata nelle immagini la rimozione della vista figlia dopo OFF, ma senza misura della latenza o prova indipendente della cancellazione RAM; **solo riscontro parziale D15**, non PASS dell'intero caso. D01 ON resta sospeso/NE per assenza di una sequenza completa controllata; D02 non iniziato. In attesa del rapporto DIAG aggiornato della stessa scheda, nessuna riaccensione o prova applicativa di Codex autorizzata da queste immagini. Canary OFF confermato dall'utente, scadenza invariata, nessun UID nei report.

**Rapporto OFF aggiornato — calibrazione delle evidenze:** active=false, permitValid=false, permitExpiresAt=null, idleMs=180000, lastBlock=LOCK_ADMISSION_DENIED, registro locale ancora acceso. Il journal completa la sequenza precedente con LOCK_EXPIRED e FRAME_EXIT alle 22:46:52 italiane, circa 181,948 secondi dopo l'ultimo FRAME_ENTER delle 22:43:50. Il codice expired raggruppa inattivita, background, attesa di sblocco e scadenza del permesso: compatibilita con la soglia di tre minuti non dimostra chiave gia aperta, motivo univoco o PASS D06. La scadenza fissa del canary rimane il 18 novembre e non e il timeout locale.

Più tardi il journal registra pagehide del padre, ADMISSION_DENIED e LOCK_ADMISSION_DENIED alle 22:55:03 italiane, quindi uscita da app e da Home. Con OFF confermato questo documenta il **diniego al nuovo ingresso**, non una revoca live: la vista era gia stata bloccata prima della ricarica. D15 e D06 restano incompleti; D01 non PASS. Il sorgente offre una spiegazione del doppio clic: resume intercetta il primo clic sul link Home conservando la vecchia route e ricarica il padre; il nuovo avvio negato elimina mounted, consentendo al secondo clic di seguire il link standalone. Spiegazione statica coerente con il racconto e gli eventi, non ancora riproduzione automatica o correzione. Approfondimento solo in lettura sul primo sblocco reale; canary OFF, nessuna nuova prova cloud o attivazione.

**Approfondimento locale — difetto di visibilita del dialogo riprodotto, non ancora corretto:** banco isolato con stili del padre e modulo UI reali, iframe e testi fittizi, traffico pagina esterno bloccato. Primo tentativo non eseguibile per diniego sandbox al loopback; ripetizione del medesimo banco con autorizzazione locale terminata con codice 0. Con gli stili correnti il dialogo e presente/focalizzato ma coperto dall'iframe; una sola aggiunta di stili UI in memoria del banco lo rende visibile e interagibile. Conferma/annullamento riusciti, nessun errore pagina. Artefatti tecnici e proposta in .codex-tmp, esclusi da Git. Nessun file applicativo o cloud modificato, nessuna nuova versione.

Riesame statico interno del banco conferma la separazione delle evidenze: solo Chrome headless 1280x850, nessun bootstrap produttivo Auth/broker completo o chiave reale; nessuna certificazione Safari/PWA, header, cache o sequenza storica C1 completa. Difetto locale concreto coerente con il prompt non percepito, non prova di sblocco senza conferma. D01 fisico resta sospeso, C1 non prosegue; proposta minima e regressione da sottoporre a Claude prima del seguito approvato. Nessuna auto-approvazione, PR, commit, push o deploy derivano dal banco.

<a id="cornice-adc-offline-2026-11-10"></a>

## #285 — ADC impersonata e rimozione, prove offline del 10/11/2026

Letto il [GO sospeso Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/285#issuecomment-6766818781). Scelta A di Diego: istruzioni per SA dedicato/ruoli/delega/ADC isolata/revoca; nessuna esecuzione Google/Firebase. [Procedura e limiti IAM](../regole/RILASCIO.md#cornice-adc-impersonata-2026-11-10). Nessun UID nei rapporti, anche sola prova; input resta privato ed esplicito. Preparato --remove prima del cambio binding/C2, idempotente e senza sostituire altri claim.

Prove dedicate: modello/parser/CLI/writer/ricevuta DPAPI e adapter ADC reale con soli dati sintetici. Firebase Admin **14.5.0** e GoogleAuth **11.3.3** dalle dipendenze functions bloccate: OAuth sorgente e mint IAM intercettati sul trasporto Gaxios effettivo; lettura Auth mantiene AuthorizedHttpClient reale fino all'inserimento del Bearer impersonato; GET singleton e singolo POST claim intercettati. Provati grant e remove, preservazione degli altri claim e verifica finale. HTTP/HTTPS, socket e fetch non previsti bloccati; nessuna credenziale reale caricata, nessuna rete esterna. La dipendenza emette avvisi di deprecazione/validazione dei costruttori; il runner valida preventivamente forma, URL e identità SA. Non rappresentano una verifica dei ruoli reali.

Il riesame interno ha rilevato il rischio che applicationDefault riscoprisse un file diverso da quello validato: corretto usando soltanto il JSON già letto e GoogleAuth esplicito. Test con CLOUDSDK_CONFIG divergente (e alias minuscolo divergente su sistemi case-sensitive). Guardia anche per quota annidata/override, ADC authorized_user o chiave privata, URL/SA/delegate/universo non ammessi; rifiuto prima dell'import Admin. Primo test d'integrazione non riuscito: fixture Windows con variabili equivalenti per maiuscole e mock Gaxios di una diversa copia della dipendenza; corretti il banco e il trasporto annidato, senza usare credenziali o rete reali. Normalizzata anche l'asserzione del percorso privato per il casing Windows, senza attenuare i controlli del percorso.

Prima esecuzione hardening nel sandbox: **66/71**, cinque blocchi ambientali (tre subprocess prompt sintetici in timeout e due connessioni loopback EACCES), nessun fallimento dei nuovi casi ADC/claim. Ripetizione autorizzata solo per i test locali, senza operazioni cloud: **71/71 PASS**, zero skip, include **30 prove dedicate** (26 core/CLI/DPAPI e quattro ADC/SDK). `npm run test:docs` **12/12 PASS**, 34 MD e 861 link locali. Il primo controllo docs segnalava l'ancora di questa ricevuta ancora mancante durante la stesura: completata prima della verifica finale. Riesame interno readonly: ADC rieseguita indipendentemente **4/4 PASS**, rischio discovery risolto; IAM corretto precisando che users.get può enumerare utenti. Questi riscontri interni non sono il GO di Claude.

Precondizioni reali **non eseguite**: nuovo GO Claude; ammissibilità QA2 e lettura identità; SA/ruoli/ADC; singleton OFF con destinatario sintetico e Timestamp futuro concordato; dry-run/apply/attivazione autorizzati separatamente. Prima del passaggio fase: OFF e revoca, remove a binding invariato, poi cambio destinatario. Due matrici C1 **19 × quattro ambienti ciascuna, tutte NE**; sette giorni da concordare, nessuna CORNICE CHIUSA. Nessun workflow/Rules/Functions/runtime/versione modificati, nessun merge/deploy.

<a id="cornice-claim-candidato-2026-11-10"></a>

## Cornice — runner claim candidato e piano C1 in due fasi, 10/11/2026

Dopo [GO Claude #284](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/284#issuecomment-6764572316), merge **28c97128716deb804385a084088a6f4367a5bcc1** e [ricevuta](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6764652342), Diego ha predisposto personalmente in console quattro campi del singleton: schema/versione 1, enabled false, UID personale; manca expiresAt. Stato osservato in sola lettura via UI, confronto del solo valore UID appena incollato senza stamparlo; non è verifica indipendente Auth della titolarità né documento completo/attivabile. Nessuna scadenza provvisoria o claim assegnato.

Nuovo mandato di preparazione e successiva [decisione sintetico → personale](../progetto/DECISIONI.md#cornice-canary-due-fasi-2026-11-10). Ricognizione documentale: QA2 popolata è l'identità sintetica conservata dalla bonifica; QA1 è storico e le fixture S1 temporanee eliminate. Le esclusioni QA2 citate riguardano i lotti recovery/S1; non bastano per affermare un divieto globale, né per certificare l'ammissione al nuovo canary. Diego indica il riuso dell'account già popolato: **QA2 candidata fase 1, da confermare con Claude e preflight Auth/policy in un passo autorizzato**. Nessuna nuova lettura Auth/Firestore amministrativa, creazione utente o modifica cloud per questa ricognizione. Il singleton non è stato spostato al candidato.

Runner/helper nuovi nel ramo codex/vault-frame-claim-preparation-20261110: UID/fase espliciti, piano privato corrispondente, default sola prova, UID inizialmente mostrato solo in quella modalità, poi escluso da ogni rapporto dall'ultimo ordine di Diego, altri claim preservati/non stampati. Singleton incompleto, acceso o discordante impedisce apply. Ricevuta DPAPI privata prima del set, seconda lettura con confronto di stato, unica scrittura e verifica completa; deriva/esito incerto fermano senza ripetizioni o ripristino globale. La finestra a scrittore unico resta una condizione operativa, non atomicità dimostrata.

Prove locali sintetiche dedicate: **23/23 PASS**, incluso roundtrip DPAPI in RAM e dal file, rifiuto overwrite sul solo payload di prova locale e adapter REST a un solo tentativo. Test del modello con Auth/Firestore finti; help/parser e main testati tramite dipendenze finte, nessun SDK Admin caricato e nessun runner eseguito su Firebase, neppure dry-run. Coperti preservazione nested/array/flag precedente, UID/fase/identità/policy errati, limite byte, staging senza expiry, nessuna scrittura in dry-run, deriva pre-set, errore ambiguo e mismatch post-set, errori redatti e percorsi privati. `npm run test:release-hardening` **64/64 PASS** (include i 23 dedicati, non sommare), `npm run test:docs` **12/12 PASS**, 34 MD e 852 link; sintassi dei quattro nuovi moduli superata. In Linux CI il solo test DPAPI Windows è marcato non applicabile, distinto dal suo PASS locale effettivo. CI e revisione Claude del nuovo SHA ancora da attendere. Il primo insieme 17/17 non provava il trasporto reale: il riesame readonly ha rilevato i retry automatici del writer SDK. Il seguito usa un adapter REST fisso senza retry/redirect, verificato con fetch finto su 503, 302, reset e timeout, sempre un invio; SDK lasciato soltanto alle letture. L'esito iniziale non è una prova di assenza retry. Nessun test di rete reale eseguito.

[C1](#cornice-b2-lista-2026-11-09) separa fase 1 e fase 2: **19 × quattro ambienti per fase, tutto NE**. Solo ordine del piano cambiato; nessuna prova fisica, attivazione, nuova versione/deploy, claim o dato Vault modificato. Frontend/Rules/Functions/workflow invariati. Scadenza sette giorni da concordare, nessuna CORNICE CHIUSA; consegna per GO Claude e arresto.

<a id="cornice-b35-modello-2026-11-10"></a>

## Cornice B3.5 — produzione 1.2.268 e prescrizione del modello, 10/11/2026

La [#278](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278) è stata unita; sorgente di produzione **`79ebd9b8014c606ecdea9f6a4ce696e674d90c0a`**. [Rules #1059](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42777892603) riuscita, sole Firestore Rules; [ricevuta B3.4](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6762681832). [Hosting #1060](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42786989182) riuscita il 10/11 alle **09:22:13 UTC / 10:22:13 CET**, controllo pubblico CI riuscito e run conclusa alle 09:22:27 UTC. Approvazioni personali di Diego, nessun bypass; soltanto Hosting in #1060, altri target saltati. [Ricevuta B3.5](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6763944540), [GO di Claude con prescrizione](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6763989370).

Prima verifica indipendente: manifest e **361/361 file**, 36 HTML e 41 profili riusciti. Il banco supplementare risultava **45/46** alle 09:28 UTC: il modello letterale attribuiva alla variante codificata della cornice il profilo generale, mentre Hosting restituiva il profilo canonico della cornice. DENY e ancestors none erano comunque presenti; differivano frame-src e Permissions Policy. Anche la figlia codificata riceve il profilo canonico, ma `privateFrameUrl` nega l'ammissione. Claude non lo classifica come bypass della Vault: prescrive allineamento modello e tre probe prima dell'attivazione. Il risultato 45/46 resta storico, non viene riscritto come PASS.

Seguito autorizzato sul ramo `codex/hosting-header-normalization-20261110`, base 79ebd9b8: inventario esplicito dei file e decodifica singola ASCII non riservata, con [eccezioni conservative](../regole/INTERFACCIA.md#cornice-b1-header-2026-11-09). L'emulatore superstatic continua a verificare il matching letterale osservato localmente, distinto dalla produzione; non sono rimosse asserzioni. Il verificatore remoto aggiunge tre probe fuori dai metadati del manifest: figlia codificata con header canonici e diniego JavaScript, cornice codificata DENY/none **con frame-src self**, pagina pubblica codificata DENY/none **senza self**. Tutti richiedono 200 senza redirect, hash canonico e corrispondenza di CSP completa/XFO/Permissions; test negativi per profilo scambiato, 302/404 e payload diverso. Nessun nuovo campo del manifest o modifica di configurazione.

Ripetizione effettiva alle **09:53:11 UTC / 10:53:11 CET** tramite sole richieste HTTPS GET pubbliche: **manifest, 361/361 hash, 41 profili e 46/46 controlli supplementari PASS** sul modello corretto. **Tre nuovi probe 3/3 PASS**, di cui la cornice già presente nel gruppo 46 (conteggi non sommabili come 49 URL distinti). Albero pubblico sempre **`ae3a30ee2be99f67bed9f83050e88cd1d9266ac0ecc20727e9ec187b22415776`**, cache manifest no-cache/no-store, redirect legacy same-origin corretto, rewrite /home corretta e prova.html 404. Cinque header singoli per ogni risposta del gruppo 46. Ricevuta locale esclusa da Git, SHA-256 **`69b89f63b25752abbba6077caf4aa79735a7721ebf54ab37f8e8a4ad9465aa0a`**; precedente rapporto fallito conservato separatamente.

Test locali della prescrizione: `node --test tests/release-manifest.test.mjs` **7/7 PASS**; `npm run test:release-hardening` **41/41 PASS** (include i sette precedenti, non sommare); `node --test tests/vault-frame-headers.browser.test.mjs` **5/5 PASS**, emulatore Hosting reale e Chrome headless con script sintetici/rete esterna bloccata. `npm run test:docs` **12/12 PASS**, 34 MD e 839 collegamenti verificati. Gli script e la documentazione non cambiano Frontend/public, firebase.json, Rules, Functions, workflow, package o versione. Nessun nuovo deploy, lettura amministrativa Firebase, singleton, claim o attivazione. Il riesame statico interno non è GO Claude e non esegue test indipendenti. Nuova PR/check e GO Claude ancora richiesti prima del seguito; **C1 19 × quattro ambienti resta tutto NE**, nessuna CORNICE CHIUSA. Elenco MD invariato a 34.

<a id="cornice-b3-workflow-consegna-2026-11-10"></a>

## Cornice B3 — ricevuta della consegna workflow, nessuna applicazione

Verificato il [GO DIAG di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6758777089) sullo SHA `2d53604ee0662e49389318c31288ef58cc999d82`: il revisore attesta CI #1051 verde per validate/docs/Gitleaks e deploy saltato. Non è una ricevuta di produzione o di prove fisiche.

Rigenerato localmente il file completo con `node scripts/plan-vault-frame-release.mjs --write-proposal`; `Get-FileHash -Algorithm SHA256` conferma **`f08956fc606c554a661a898bd80a9a69b7e89c4becc73db2c169aee3d8d16bb3`**, identico alla proposta revisionata. File e piano rimangono in .codex-tmp/vault-frame-b3-proposal, esclusi da Git; workflow tracciato invariato. Lo scope aggiunto seleziona soltanto Firestore Rules. La durata di 7 giorni scelta da Diego non viene applicata dal workflow; nessun permesso o claim reale configurato.

Questa ricevuta registra soltanto preparazione e consegna: caricamento personale di Diego e verifica hash del blob GitHub ancora da fare; nessun merge, dispatch, deploy, lettura o scrittura Firebase. Controlli della consegna: `npm run test:docs` **12/12 PASS**, 34 MD e 829 collegamenti; `node --test tests/vault-frame-release-plan.test.mjs tests/recovery-canary-plan.test.mjs` **9/9 PASS**. Nessuna nuova regressione runtime per i soli aggiornamenti documentali. Matrice C1 19 × 4 ancora tutta NE.

<a id="cornice-diag-verifiche-2026-11-10"></a>

## Cornice DIAG — candidata locale, 10/11/2026

Mandato di Diego prima della prosecuzione B3, PR #278. Il [GO B3 del revisore](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6757843877) approva il solo piano su c79770f6, non questi nuovi byte. Nuova sezione Cornice e registro per scheda, separati dalla diagnostica prestazioni: default off, schema chiuso a cinque campi, 200 eventi/7 giorni, sessionStorage senza UID/email/URL/query/chiavi/contenuti o errori liberi. Consenso/revisione e identità RAM non entrano nel rapporto. Cancellazione sincrona su logout/cambio account/fence e generazione ruotata su Cancella/riattivazione; import e callback tardivi respinti. Worker senza persistenza, messaggi chiusi solo al contesto push selezionato, ping locale di capacità distinto da consegna FCM.

Prove dedicate: 24 casi del modello, 8 browser DIAG, più un caso di attribuzione worker e uno sullo snapshot passivo dell'owner. Il banco Chrome usa UI/controller e moduli effettivi, storage e worker/MessageChannel reali, Auth/FCM sintetici e rete esterna bloccata. Copia usa appunti intercettati: non certifica il permesso clipboard Safari/PWA. Verificati otto cataloghi, off senza scritture, coppia copia/cancella senza modifica Auth/Vault, logout/cambio UID, reload stessa scheda, TTL, storage negato, import pendente dopo pagehide, probe e fallback senza coordinate. Lo snapshot accetta solo proprio figlio e non avvia letture d'ammissione.

Riscontro del sorgente finale nella regressione locale: **238/238 test della cornice PASS**, inclusi i 34 casi nuovi/estesi DIAG; documenti **12/12**, 34 MD/824 link, sintassi **248 moduli**, assenza cicli e budget di 31 pagine riusciti. Offline rigenerato **61 export/341 risorse**, anteprime escluse. Gitleaks sull’indice senza nuovi segreti; artefatti e mappa codice non committati. La regressione generale è distinta dal gruppo dedicato e dal futuro esito CI del nuovo SHA.

`npm test` finale termina con codice 0: **3529 casi / 3519 PASS / 0 FAIL / 0 cancellati / 10 skip in 64 gruppi**. Il sorgente applicativo è quello della consegna; i successivi aggiornamenti della ricevuta non cambiano il runtime. La futura CI deve validare il nuovo SHA e non viene dichiarata verde anticipatamente.

Tentativi di sviluppo conservati separatamente: fixture inizialmente non rivelata dal bootstrap sintetico, validatore della versione senza prefisso v, fixture con ordine import diverso dal bootstrap reale; corretti senza dichiarare quei tentativi PASS. La prima regressione generale segnala un ciclo fra bridge e runtime: eliminato con guardia di lifecycle passata dal bridge al runtime lazy, assenza cicli ricontrollata. Casi push attribuiti al solo client selezionato e import tardivo terminale verificati dopo il riesame interno; nessun parere interno è GO Claude.

Misura statica ripetibile su c79770f6 tramite letture git show locali, senza modificare la base: +0,97 KB gzip per gli hook condivisi, +1,27 KB su Impostazioni con controlli/testi. Recorder/UI differiti; sei eccezioni di budget incrementate di 1 KB (dettaglio privato nuovo 339, aggiungi_scadenza 341,5), limite generale/moduli/CSS e target fisici invariati. La nuova eccezione deve essere valutata da Claude. Rigenerati inventario statico pagine e QA: 167 campi compilabili, incluso toggle DIAG. Nessuna nuova prova visiva/dispositivo dedotta dagli inventari.

[Contratto sicurezza](../regole/SICUREZZA.md#cornice-diag-sicurezza-2026-11-10), [UI/stato e limiti](../regole/INTERFACCIA.md#cornice-diag-ui-2026-11-10). C1 aggiunge D19 e rapporto per ogni FAIL: **19 casi × quattro ambienti, tutti NE**. Storage chiuso con la scheda; scadenza applicata alla prima esecuzione e prima della copia, senza promessa di eseguire codice quando l'OS congela l'app. In assenza di osservatore push il dato resta non osservato; fallback risolto non prova una nuova finestra. Nessuna operazione Firebase, modifica workflow/Rules/Functions/Storage, provisioning, merge o deploy. Candidata sempre 1.2.268, produzione attestata 1.2.267. Nuovo commit/check/GO DIAG richiesti, poi gli ulteriori gate B3 e approvazioni personali. MD sempre 34, nessuna CORNICE CHIUSA.

<a id="cornice-b3-preparazione-2026-11-10"></a>

## Cornice B3 — preparazione per revisione, nessuna operazione Firebase

Prerequisito verificato: [GO D11 di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6757406980) su `3820afe6be11fbdb1c1c724592232c5ad36e8503`. [CI #1049](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42742698785) riuscita: **3490 casi/3480 PASS/0 FAIL/0 cancellati/10 skip, 64 gruppi**, docs/Gitleaks verdi, deploy saltato. Log validate e API verificati; checkout merge sintetico `bbe16f76daec103aae8332e9314fff58c6ab5d14`, genitori master `039b7a6b` e head `3820afe6`, confronto API zero file diversi. Manifest CI: 358 file, albero `8a372cacd68141811683806dd3bf7f1c1ca2c985082f97d93a5a5e9ea301a375`; distinto da quello locale e dalla produzione. Questo chiude il gate D11, non autorizza il cloud.

Il pacchetto B3 introduce solo pianificatore/generatore locale, supporto del futuro quarto scope nel verificatore, test e documenti. Il file .github/workflows/firebase-deploy.yml **non cambia** e non offre ancora vault-frame-rules. Il pianificatore restituisce executable=false/cloudCalls=false/cloudReadsPerformed=false, rifiuta apply/deploy/UID e crea la proposta soltanto in .codex-tmp/vault-frame-b3-proposal con opzione locale esplicita. Niente SDK amministrativo, credenziale, UID reale o runner di provisioning. Proposta completa UTF-8/LF, SHA-256 **`f08956fc606c554a661a898bd80a9a69b7e89c4becc73db2c169aee3d8d16bb3`**; la rimozione delle quattro modifiche previste deve ricostruire semanticamente il workflow originale.

Controlli preparatori: `node --test tests/vault-frame-release-plan.test.mjs tests/recovery-canary-plan.test.mjs` **9/9 PASS**; `npm run test:release-hardening` **40/40 PASS**, inclusi 5 nuovi test B3 con 23 mutazioni negative della proposta (scope/selettori ampliati, guardie/credenziali alterate, duplicati, condizioni ibride). Verificati tutti i quattro scope, assenza di install Functions/Hosting nello scope Rules, riproducibilità e hash del file completo, rifiuto dei comandi operativi. La prima esecuzione nel sandbox fallisce soltanto sui server HTTP locali per EACCES; ripetizione con loopback autorizzato riuscita, log distinti conservati. Nessun FAIL viene sommato come PASS e nessuna rete Firebase usata dal banco.

Controllo documentale finale **12/12**, elenco invariato di **34 MD**; sintassi dei due script riuscita. Gitleaks sulla proposta completa e sul piano locale: nessun segreto rilevato. La regressione generale D11 sopra non viene presentata come riesecuzione sul nuovo codice di governance B3: la CI del nuovo SHA resta distinta. Mappa codice riutilizzata senza estrazione semantica dei documenti; artefatti locali esclusi da Git.

Perimetro proposto e non eseguito: [Rilascio B3](../regole/RILASCIO.md#cornice-b3-piano-2026-11-10). Il delta Rules candidato rispetto a origin/master locale aggiunge solo dodici righe del singleton read-only; non è una lettura delle Rules realmente pubblicate. Functions, Storage, indici e file pubblici non sono modificati da B3. Occorrono ancora GO Claude sul pacchetto, applicazione CI da proprietario/canale esplicito e verifica hash/check, approvazione finale prima di merge e Firebase; canale amministrativo/UID/scadenza UTC sono da verificare privatamente soltanto dopo l'autorizzazione. Nessun valore reale cercato nel cloud da questo passo.

Candidata ancora 1.2.268; produzione attestata 1.2.267. Nessun deploy o permesso reale creato; C1 18 casi/quattro ambienti **tutto NE**, priorità PWA iPhone e Chrome desktop. I contratti runtime Vault/UI non cambiano: B3 precisa soltanto rilascio, concorrenza amministrativa e rollback, nella sede canonica RILASCIO. MD sempre 34. Non è CORNICE CHIUSA e i pareri interni readonly non sono il GO di Claude sulla PR.

<a id="cornice-d11-verifiche-2026-11-10"></a>

## Cornice D11 — notifiche e lista C1 candidate, 10/11/2026

Fonte: [GO B2 di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6753602102) sul commit `70180aaffba629d112d235d93dddd0344f7f2c75`, con validate/docs/Gitleaks verdi nella CI #1048 e deploy saltato. Diego autorizza D11 e le integrazioni della lista sulla stessa PR #278. Il GO B2 non è ancora GO sul codice D11.

Implementato nel worker FCM il click verso cornice pronta tramite intento e ACK entro 1500 ms, senza navigate sul padre. Destinazione limitata e coordinate id/received/notification conservate; preferenza per client principale focalizzato/visibile. Il padre verifica evento nativo, origine, registrazione FCM attiva, nonce/schema/path/deadline e stato attuale; dopo le attese ricontrolla identità, fence, generazione, documento del figlio e visibilità. Solo una sessione già aperta e ammessa naviga il figlio. Nessuna chiave o token nel canale, nessuno sblocco implicito o rinnovo dell'inattività. In assenza di cornice resta il percorso ordinario; su diniego, errore o timeout della cornice si richiede openWindow, mai navigate diretto sul padre.

`npm run test:vault-frame-runtime`: **204/204 PASS**, inclusi **35 test D11 unitari/VM** e **7 browser D11**. I test browser usano Chrome effettivo, ServiceWorker/WindowClient/MessageChannel nativi e owner/receiver produttivi, con identità e permesso sintetici: due notifiche cambiano il figlio conservando padre e singolo sblocco; rifiuti per sorgente estranea/percorso non ammesso, blocco, timeout, cambio UID/epoca, sospensione, revoca e documento sostituito durante l'attesa. Provati anche il ramo ordinario reale e il suo errore nativo fuori scope FCM. I test VM coprono schema/ACK/nonce/scadenza, porta/focus in errore, replay e callback tardive. Aggiornato solo l'harness del test di mount precedente per iniettare il nuovo installer: non viene conteggiato come prova D11.

Altri controlli locali D11: documenti **12/12**, **34 MD/799 collegamenti**; sintassi **245 moduli**, assenza cicli e budget statico **31 pagine** riusciti. Rigenerato runtime offline **61 export/338 risorse**, anteprime sempre escluse; manifest locale candidato verificato, **358 file**, non una ricevuta di produzione. Gitleaks sull’indice senza nuovi segreti. Ricevute tecniche in .codex-tmp esclusa da Git. La regressione generale e la CI sul nuovo SHA hanno esiti distinti dalla suite dedicata.

**Limiti espliciti:** click notifiche e servizio FCM sono simulati; openWindow è intercettato nel banco browser, senza certificare gesto nativo o creazione di finestre. Chrome Android/Windows può riusare la finestra PWA nel fallback ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clients/openWindow)); resta C1 e non si dichiara «padre mai ricaricato» in assenza di ACK. L'ACK prova adozione dell'intento, non caricamento completo. L'update best effort della registrazione FCM esistente va verificato davvero dopo aggiornamento; il controller offline sw.js non dimostra che il worker FCM sia aggiornato. Nessuna prova push fisica, PRF/Auth/App Check o dei quattro dispositivi dedotta da questi test.

La lista C1 sotto contiene ora **18 casi/quattro ambienti, tutti NE**: D17 safe area esplicita Safari/PWA in verticale e orizzontale, D18 version skew NE fino al secondo rilascio. Priorità PWA iPhone e Chrome desktop, poi Safari e Android. Invariati arresto/rollback e i gate: nuovo commit, check e GO D11 di Claude prima di B3, più approvazione personale di Diego per merge/provisioning/deploy. Produzione ancora 1.2.267, candidata 1.2.268; nessun provisioning, Rules/Functions/workflow o cloud modificato da D11. Nessun nuovo MD.

<a id="cornice-b2-lista-2026-11-09"></a>

## Cornice B2 — lista fisica candidata, nessuna prova eseguita

Prerequisito: [GO B1 di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6753223333) su `0d861eb093626b9e0828848fef80c83c1b0e3aee`. [CI #1047](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42711090070) riuscita, **3448 casi/3438 PASS/0 FAIL/0 cancellati/10 skip in 64 gruppi**, docs e Gitleaks verdi, deploy saltato. Checkout CI merge sintetico `02a289d907abb3870e3b9622c6e7043407b0ac11`, genitori master `039b7a6b` e head `0d861eb0`; confronto API: zero file diversi dall'head. Manifest CI 357 file, hash `6300e82c5f675064a0fbc744a0f46ca4a73e94f746570aca9c5774a9ac595c6c`. Il GO accetta il filtro del token già acquisito e l'eccezione statica dichiarata; non è merge, attivazione o prova fisica.

**Cronologia B2:** il gap statico del worker che chiamava navigate su app.html era aperto alla consegna B2. Il [GO B2 di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6753602102) ne conferma la correzione necessaria prima di B3. Ora D11 implementa il percorso nella candidata, con ricevuta sopra; non è ancora pubblicato né verificato sui dispositivi. Nessun PASS fisico deriva dai GO o dai test automatici.

### Preparazione di C1, dopo il rilascio B3 approvato

Aggiornamento del 10/11/2026: **fase 1 su QA2 candidata sintetica già popolata, da confermare con Claude e preflight; fase 2 sull’account personale di Diego**. Un solo UID nel singleton per volta, fasi e ricevute separate. Questa lista non abilita alcun utente o cambio cloud. Produzione attestata 1.2.268 / #1060 / 79ebd9b8; il singleton predisposto manualmente è ancora spento, parziale e personale, non configurato per la fase 1.

Diego esegue le prove separatamente su **Chrome desktop Windows, Chrome Android, Safari iPhone e PWA installata su iPhone**. **Priorità: PWA iPhone e Chrome desktop per primi, poi Safari iPhone e Chrome Android.** Registrare per ogni colonna modello/OS/browser/versione app/data, sorgente del rilascio approvato e presenza effettiva della cornice; Safari e PWA sono due ambienti distinti. Le tabelle nascono interamente NE; la [ricevuta dell'11/11 su 1.2.270](#cornice-c1-d02-270-2026-11-11) assegna il solo D02 Chrome desktop della fase 1. Codice pubblicato e provisioning da soli non provano un collaudo riuscito. Prima di ogni fase verificare versione da manifest/worker e non dalla sola etichetta.

B3 deve proporre l'assegnazione privata del singleton e del solo claim del pilota, preservando gli altri claim; il token nuovo richiede un nuovo accesso oppure un refresh esplicito. Per C1 preferire logout/login normale dopo la conferma del provisioning, così non si chiede a Diego di incollare token o eseguire comandi in console. La hint non concede ammissione: il documento server e il fence rimangono obbligatori. Nessun altro account viene abilitato o creato da B2.

Annotare il valore originale di Tempo di Inattività; per i casi temporizzati scegliere prima 1 minuto, poi verificare anche 3 minuti e infine ripristinare la preferenza originale. Ogni scheda/finestra parte con RAM propria. Dopo logout o ricarica completa è corretto richiedere un nuovo sblocco; il requisito di continuità riguarda le navigazioni interne con padre vivo. Per tutte le prove usare soltanto l'account pilota, dati di prova già autorizzati e contenuti innocui; annullare editor, fotocamera e operazioni sensibili prima di qualsiasi scrittura non prevista. Non cancellare record, cambiare Master Password, revocare condivisioni o pubblicare backup per dimostrare la sola conferma.

### Gate delle due fasi, prima di D01

1. **Fase 1:** confermare con Claude l'ammissibilità di QA2 per questa cornice e verificare privatamente UID/identità Auth e dati esclusivamente sintetici. Nessun fallback a QA1, nessuna creazione/provisioning o lettura di credenziali dal semplice piano. Singleton completo ma spento con quell'UID e Timestamp concordato; confronto con il parametro UID mostrato dal dry-run. Se il singleton conserva ancora l'UID personale o manca expiresAt, STOP: non cambiare UID/data o approvare apply per aggirare il controllo. Claim e accensione richiedono ordini separati. Confermare che l'account personale/estranei non ricevano ammissione durante questa fase.
2. Eseguire D01–D19 nei quattro ambienti sulla fase 1, registrando PASS/FAIL/NE/LIMITE senza dati reali; ogni FAIL con rapporto DIAG. Funzioni non disponibili nell'account/dispositivo sono LIMITE/NE, non PASS. Eventuali fixture mancanti richiedono un incarico esplicito prima di essere create.
3. **Passaggio fase:** dopo revisione degli esiti e approvazione personale, spegnere e verificare revoca/chiave non riusabile nella vecchia fase; solo dopo cambiare il singleton al solo UID personale con precondizioni, ricevuta e scadenza approvate. Nessun rinnovo implicito dei sette giorni. Un eventuale claim residuo del vecchio pilota non concede ammissione: verificare il diniego; rimozione del claim distinta e solo approvata. STOP su deriva o revoca non rispettata.
4. **Fase 2:** nuovo preflight/dry-run/revisione/approvazioni, token aggiornato e D01–D19 con ricevute proprie; non trasferire i PASS sintetici alla fase personale. Le prove distruttive reali rimangono vietate. Verificare che il pilota sintetico non sia più ammesso.

### Itinerario di dieci pagine private

Sbloccare una volta e raggiungere, tramite i menu/link dell'app e senza incollare URL nella barra degli indirizzi: **Home → Area privata → lista Account privati standard → Profilo → Impostazioni → Regole scadenze → Configurazione documenti → Scadenze → Archivio Account → Destinatari**. Le destinazioni canoniche sono home_page, area_privata, account_privati, profilo_privato, impostazioni, regole_scadenze, configurazione_documenti, scadenze, archivio_account e gestione_destinatari. È consentito tornare a Home fra le tappe; contare dieci Document distinti, non dieci linguette dello stesso Profilo. Non salvare i moduli. In desktop controllare che l'indirizzo esterno rimanga app.html con destinazione applicativa; PWA senza barra: registrare la sequenza e l'assenza di nuove cerimonie Vault. Un nuovo incolla/nuova scheda/ricarica del padre non è questo test.

### Rapporto DIAG per ogni FAIL

Prima delle prove scegliere volontariamente se attivare Impostazioni → Diagnostica → Cornice → Registra eventi. Per **ogni FAIL**, premere **Copia rapporto** e allegare il JSON copiato alla ricevuta tramite il canale concordato con Diego/revisore; nessun invio automatico. Il rapporto contiene solo stato tecnico e codici ammessi. Non aggiungere URL con query, screenshot Vault, UID o contenuti reali. Se il registro era spento o un evento non osservabile, indicarlo: rapporto di solo stato/zero eventi non ricostruisce una cronologia né attribuisce PASS. Logout/cambio account elimina intenzionalmente il journal; ove possibile copiare la ricevuta prima del logout, senza impedire la cancellazione di riservatezza.

### Casi e risultati attesi

| Caso | Azione e risultato atteso |
|---|---|
| D01 — avvio | Nuovo accesso Firebase/2FA e token aggiornato dopo B3; pilota ammesso, uno sblocco Vault iniziale. Nessun loop, pagina bianca o errore Auth/App Check ignorato. |
| D02 — dieci pagine | Itinerario sopra con dati leggibili e azioni disponibili; nessuna ulteriore Master Password/PRF durante le navigazioni interne prima della scadenza. |
| D03 — sezioni e parità | Profilo Contatti/Indirizzi/Documenti/Tessera e, se usata, azienda: tab/query/anchor corretti, header e pulsanti raggiungibili, niente sovrapposizioni; lettura/copia/annullamento equivalenti allo standalone. Nessuna adozione della grafica sperimentale. |
| D04 — cronologia | Almeno tre navigazioni interne, Indietro/Avanti browser e freccia app; una sola sequenza logica, destinazione/query/anchor giusti, nessun doppio salto o form sensibile ripristinato. |
| D05 — ricarica/link/scheda | Ricaricare il padre riporta alla medesima destinazione validata e richiede un solo nuovo sblocco. Ricarica del solo figlio, quando il browser offre quel comando: padre vivo e chiave conservati; distinguerla dal reload dell'app. Link privato diretto e nuova scheda entrano correttamente ma con RAM e sblocco propri. Tornare indietro dopo logout non ripristina dati aperti. |
| D06 — inattività | Con 1 minuto scelto, attendere senza toccare fino a oltre soglia: blocco e nuovo sblocco richiesto. Navigare appena prima della soglia non rinnova il tempo; interazione reale sì. Ripetere a 3 minuti per escludere un valore fisso. |
| D07 — background | Nascondere brevemente e tornare prima delle due scadenze: verifica server prima dei dati, nessun nuovo sblocco se il padre è ancora vivo, non scaduto e senza eventi di revoca. Oltre soglia: blocco prima di mostrare dati. Annotare separatamente freeze/pagehide/BFCache e scarto OS: revocano o distruggono legittimamente RAM anche prima della soglia; non scambiarli per continuità provata. |
| D08 — logout/fence | Logout dalla cornice e da altra scheda dello stesso browser: UI bloccata, vecchie schede e Back non riaprono dati; nuovo accesso/sblocco necessari. Nuova epoca dello stesso UID non riusa la vecchia RAM. |
| D09 — biometria | Con PRF realmente supportato eseguire lo sblocco e una nuova conferma; annullamento/errore non sbloccano. Incompatibilità e ripiego Master Password sono registrati separatamente e non certificano PRF. |
| D10 — camera/voce | Dal gesto previsto aprire fotocamera/scanner documenti e dettatura con contenuto innocuo; consentire/rifiutare/annullare. Stream arrestati su cambio pagina/background/blocco, risultato tardivo scartato e nessun caricamento involontario. Picker nativo distinto dalla camera integrata; annullare prima del salvataggio. |
| D11 — notifiche | Dopo conferma del nuovo **worker FCM attivo**, una notifica reale autorizzata seleziona la destinazione validata: cornice pronta e ACK ricevuto, padre vivo e id/received/notification conservati senza nuovo sblocco. Ripetere con app bloccata, assente e risposta tardiva: destinazione corretta e sblocco se necessario, senza navigate diretto sul padre. Nel fallback openWindow annotare se il browser crea o riusa la finestra PWA; il riuso può ricaricare il padre, quindi non certifica continuità. Aggiornamento del worker offline distinto dal FCM. Annotare limiti dei push sul dispositivo; simulazione/helper non equivale a notifica fisica. |
| D12 — allegati/export/stampa | PDF/immagine ammessi si aprono fuori cornice, altri formati restano download secondo S1; ritorno conserva il padre vivo se non scaduto. Export/vCard/PDF richiedono conferma fresca e gesto finale previsto; annullare senza esportare dati reali. Stampa fuori cornice, annullamento e ritorno corretti. |
| D13 — azioni sensibili | A Vault aperta, export/backup, cambio Master Password, condivisione e cancellazione definitiva chiedono nuova conferma; annullare PRIMA della scrittura. Non usare operazioni distruttive su dati reali per questo collaudo. Le prove sintetiche di grant scaduti/riusati restano nelle ricevute B1. |
| D14 — uscite | Privacy/termini/login escono al livello principale dopo revoca. Link web esterno senza opener, tel/mailto aprono il percorso nativo e il ritorno non mostra dati scaduti. Verificare anche ritorno da picker/telefono/email. |
| D15 — rete/policy | Offline iniziale prosegue standalone senza attesa aggiuntiva del permesso. Perdita rete/policy non verificabile nella cornice: blocco e nessuna riapertura da cache. Spegnimento del singleton e riaccensione sono prove operative B3/C1 solo approvate, mai modifica client del flag. La rimozione del claim non è il kill switch. |
| D16 — confini | Confermare le evidenze automatiche su origine estranea, URL non ammessi/blob/data, UID/fence, assenza chiavi in storage/URL/log. Il controllo fisico è distinto: non chiedere dump di chiavi o storage; qualunque materiale sensibile visibile fuori dalla vista autorizzata impone arresto. Altro account solo se già disponibile e autorizzato, altrimenti NE senza crearne uno. |
| D17 — safe area | Su Safari iPhone e PWA installata, provare verticale e orizzontale: header e footer dei figli fuori da notch e barra home, ultimi pulsanti visibili e toccabili, anche dopo scroll/cambio pagina/orientamento. Annotare separatamente i due ambienti; gli inset del banco sintetico non certificano il dispositivo. |
| D18 — version skew | Tenere aperta la cornice della versione precedente, poi dopo un rilascio successivo navigare internamente: uscita o ricarica pulita sulla destinazione valida, nessuna chiave consegnata a protocollo/versione diversa, nessun loop o pagina bianca. NE finché manca un secondo rilascio; non forzare versioni o cache dai comandi in console per attribuire un PASS reale. |
| D19 — DIAG | Default spento, sola lettura dello stato; attivare, eseguire navigazioni/blocco/push e copiare rapporto; nomi pagina senza query/ID. Cancella lascia la raccolta scelta ma azzera gli eventi; disattivare elimina. Logout/cambio account cancella e non riattiva. Provare appunti reali su Safari/PWA; errore/permesso negato resta LIMITE, nessun invio di rete. Nessun dato Vault aggiunto a mano. |

### Matrice C1 fase 1 — account sintetico QA2

`NE` = non eseguito, `PASS` = azione e risultato entrambi osservati, `FAIL` = comportamento diverso, `LIMITE` = capacità primaria non disponibile o prova incompleta da decidere con revisore/Diego. Un fallback riuscito non trasforma un LIMITE in PASS. Nessun risultato viene precompilato dalle suite automatiche.

| Caso | Chrome desktop | Chrome Android | Safari iPhone | PWA iPhone |
|---|---|---|---|---|
| D01 | NE | NE | NE | NE |
| D02 | [PASS](#cornice-c1-d02-270-2026-11-11) | NE | NE | NE |
| D03 | NE | NE | NE | NE |
| D04 | LIMITE — [continuita del percorso PASS](#cornice-c1-d04-continuita-270-2026-11-11) | NE | NE | NE |
| D05 | LIMITE — [ricarica padre D05-A PASS](#cornice-c1-d05a-ricarica-270-2026-11-11) | NE | NE | NE |
| D06 | NE | NE | NE | NE |
| D07 | NE | NE | NE | NE |
| D08 | NE | NE | NE | NE |
| D09 | NE | NE | NE | NE |
| D10 | NE | NE | NE | NE |
| D11 | NE | NE | NE | NE |
| D12 | NE | NE | NE | NE |
| D13 | NE | NE | NE | NE |
| D14 | NE | NE | NE | NE |
| D15 | NE | NE | NE | NE |
| D16 | NE | NE | NE | NE |
| D17 | NE | NE | NE | NE |
| D18 | NE | NE | NE | NE |
| D19 | NE | NE | NE | NE |

### Matrice C1 fase 2 — account personale di Diego

| Caso | Chrome desktop | Chrome Android | Safari iPhone | PWA iPhone |
|---|---|---|---|---|
| D01 | NE | NE | NE | NE |
| D02 | NE | NE | NE | NE |
| D03 | NE | NE | NE | NE |
| D04 | NE | NE | NE | NE |
| D05 | NE | NE | NE | NE |
| D06 | NE | NE | NE | NE |
| D07 | NE | NE | NE | NE |
| D08 | NE | NE | NE | NE |
| D09 | NE | NE | NE | NE |
| D10 | NE | NE | NE | NE |
| D11 | NE | NE | NE | NE |
| D12 | NE | NE | NE | NE |
| D13 | NE | NE | NE | NE |
| D14 | NE | NE | NE | NE |
| D15 | NE | NE | NE | NE |
| D16 | NE | NE | NE | NE |
| D17 | NE | NE | NE | NE |
| D18 | NE | NE | NE | NE |
| D19 | NE | NE | NE | NE |

Per ogni esito riportare caso, ambiente/versioni, passi, risultato e ora; riferimenti o schermate solo ripuliti da dati personali/credenziali. Le ricevute tecniche sensibili restano fuori Git. Eventuali tempi misurati sono del dispositivo indicato, non promesse generali.

**Arresto e chiusura:** chiave/dati non autorizzati, revoca non rispettata, contenuto navigabile nel frame o bypass coorte impongono blocco immediato del canary e revisione prima di riprendere. Ripetizione dello sblocco ad ogni pagina, perdita di route, regressioni camera/voce/push o form non utilizzabili impediscono di dichiarare il requisito concluso. La correzione candidata D11 richiede il proprio GO prima di B3; gli altri FAIL/NE/LIMITE rimangono aperti in C1. Spegnimento d'emergenza mediante singleton disabled/rimosso; rimozione dell'instradamento Hosting solo CI approvata, mai deploy dal PC. B2 non esegue tali operazioni. C2 richiede ricevute STATO/COLLAUDI e GO sui seguiti; nessun «CORNICE CHIUSA» con prove obbligatorie mancanti.

<a id="cornice-b1-verifiche-2026-11-09"></a>

## Cornice B1 — verifiche candidate, 09/11/2026

**Seguito del NO-GO sul routing:** la [CI #1046](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42707510928) è riuscita, 3442 casi/3432 PASS/0 FAIL/10 skip in 64 gruppi, ma Claude ha [confermato NO-GO](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6752782102) su `13fa2d45d9a181966f8bfa8e67740ef12e1ab2d3`: la pre-verifica del singleton ritardava anche i non partecipanti. Il checkout CI era il merge sintetico `dd42e7872590d3b50f5abaed2c32ec9a7f5606ec`, genitori master `039b7a6b` e head `13fa2d45`; confronto API: zero file diversi dall'head. Manifest CI 357 file, albero `21115095e55a4611ec49da743860ba9022e985edbd6f2004a7b71d9cc1e6882d`. Nessun deploy: job saltato. Quella CI chiude il verificatore ma non il secondo rilievo né il gate B1.

La correzione corrente riusa il risultato del token Auth già richiesto: hint server booleana vera, email verificata e UID ancora corrente permettono soltanto di tentare il routing. Hint assente/diversa da true/offline salta import/listener/letture del singleton, senza richieste token aggiuntive. L'adapter nega anche offline iniziale prima del SDK. Il marker di solo diniego viene consumato localmente prima del filtro; nessuna hint, storage o token concede chiave o sostituisce Rules/fence. Per il solo partecipante rimane la pre-verifica e la successiva verifica del padre; i figli non ripetono il routing. Nessuna modifica a Rules, Hosting, Functions o claim reali. Provisioning privato del solo claim del pilota, preservando gli altri, va proposto e approvato in B3 insieme al singleton.

Prove del seguito: cornice **162/162 PASS** (sei casi aggiunti, permesso/routing/adapter 39), bootstrap Auth/offline/recovery **35/35 PASS**, sintassi 244 JS, documenti **12/12**, 34 MD/789 link. Dieci avvii non-coorte online/offline/rete lenta con policy che non risponde: zero letture e nessuna attesa della verifica; numero di richieste token canoniche invariato. Hint vera con diniego server non instrada, hint vera offline non crea SDK, fallback ripulito senza rete/hint. Il budget rileva inizialmente 340,1 KB contro 340 sulla sola aggiungi_scadenza: costo del filtro dichiarato, limite candidato circoscritto a 340,5 KB, altri limiti e target runtime invariati; controllo finale superato. Non è un test di latenza su dispositivo fisico. La CI del nuovo commit e il GO sul sorgente corretto restano necessari prima di B2; i conteggi precedenti restano cronologia.

Prerequisito verificato: [GO Claude A2](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6751236506), commit `455b41fc4f3bc86e0b9f9df48ccb9f5623309060`. La CI effettiva è [#1044](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42695875669), sullo stesso SHA e con validate/docs/Gitleaks riusciti; il #1043 citato dal revisore è un refuso. Claude dichiara 116/116 test della cornice ripetuti. Questo è il GO di A2, non di B1.

B1 sul medesimo ramo/PR #278: singleton server individuale fuori dalle preferenze utente, schema chiuso e scadenza server; scritture/list/query negate, identità verificata e fence di recupero richiesti. Adapter SDK con listener e metadati reali, stato solo RAM, letture fresche in ingresso/ripresa/azioni sensibili, deadline anche sulle letture fresche e invalidazione dei GET precedenti alla sospensione. Routing canonico prima dello sblocco, marker di solo diniego contro i loop, anchor per route e uscite esterne esplicite senza opener. Nessuna nuova Function o modifica Storage/workflow.

Rules: `npm run test:firestore-rules` **107/107 PASS**, compresi 13 nuovi casi del permesso. Emulatore Firestore demo, dati e UID sintetici; il test con SDK effettivo riceve il diniego dopo disabilitazione amministrativa del documento. Anonimo, estraneo, non verificato, documento malformato/scaduto/assente, recupero attivo, scritture e query non autorizzano. Non è una verifica delle Rules già in produzione.

Header: emulatore Hosting ufficiale con configurazione candidata, 35 HTML inclusi anteprime, root/alias/query e varianti negative; una sola CSP/XFO/Permissions Policy prevista per risposta. Browser Chrome effettivo: figlia same-origin ammessa, cornice incorniciata negata, sito estraneo negato. Cache matcher preesistenti conservati: il banco Windows non ne certifica l'applicazione HTTP, perché il normalizzatore dell'emulatore converte i glob in backslash. Non è una prova di difetto della cache in produzione. Nosniff e Referrer-Policy mantengono i valori originali nei profili disgiunti e sono controllati via HTTP. La verifica remota del manifest viene estesa ai profili HTML, alias e risposte negative, con un controllo negativo di deriva a payload identico.

Suite finale dedicata `npm run test:vault-frame-runtime`: **156/156 PASS**, sette file (runtime 55, navigazione 30, confini 19, permesso/routing/adapter 33, browser runtime 10, browser media 4, header HTTP/browser 5). Il banco usa i moduli effettivi con identità e documenti sintetici; il listener SDK/Rules usa l'emulatore demo. Verificati timeout del GET, invalidazione della verifica precedente al background, timer di un GET superato incapace di revocare la policy nuova, UID/fence/documento cambiati durante l'attesa, uscita esterna senza opener e hash non ammesso che revoca e rimuove il figlio. `release-manifest` 6/6 e contratto Profilo 7/7; sintassi JS, assenza cicli e budget statico riusciti. Runtime offline: 61 export/337 risorse, anteprime sempre escluse. Nessuna emulazione browser equivale ai dispositivi fisici.

`npm test` termina con codice 0: **3440 casi / 3430 PASS / 0 FAIL / 0 cancellati / 10 skip in 64 gruppi**. L'ultimo fix circoscritto al timer del GET superato e i due test aggiunti sono successivi all'avvio della regressione e già ricontrollati nella suite dedicata finale 156/156: il log generale non viene presentato come esecuzione monolitica del sorgente finale. La CI deve ancora verificare l'intero nuovo SHA; il suo esito resta distinto. Le correzioni del banco durante lo sviluppo e i loro tentativi falliti non vengono sommati come PASS. Le ricevute tecniche restano in .codex-tmp, escluse da Git. Mappa Graphify aggiornata solo sul codice; Gitleaks sull'indice senza nuovi segreti; nessun contenuto reale, credenziale o UID personale usato nei test. Audit documentale: 34 MD/788 collegamenti, test 12/12. Confronto con A2: configurazioni backend, definizioni cache, redirect, rewrite e baseline effettiva degli header root invariati.

Limiti: nessun permesso reale predisposto, nessuna Rules/Hosting pubblicata o anteprima Firebase attivata; produzione ancora 1.2.267. Candidata 1.2.268, raccordo compilato attivo ma ammissione negata in assenza del documento server valido. B2/C1 e Auth/App Check/PRF, fotocamera/microfono reali e i quattro dispositivi non collaudati. Attendere GO B1 di Claude prima di B2; merge/deploy e provisioning individuale solo secondo B3 e approvazione personale di Diego. Nessun avviso CORNICE CHIUSA.

Seguito CI: la [#1045](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42706492117) su `e7c7c8d9a0c92363b18010626897456053e8e046` fallisce in un controllo HTTP, 155/156 test della cornice: su Linux il link legacy restituisce realmente 302, prima del middleware degli header. Il banco Windows aveva invece osservato la risposta negativa per il vecchio matcher glob. Corretto il verificatore per attestare separatamente stato/destinazione same-origin del redirect e header della pagina finale; le risposte documento conservano tutti i controlli, nessuna asserzione rimossa sui loro header. Il manifest non classifica più il 302 legacy come documento; un redirect verso sito estraneo con lo stesso percorso è rifiutato. Configurazione Hosting, Rules e runtime B1 invariati. Prove locali del seguito: HTTP/browser e manifest 11/11, intero gruppo hardening 35/35, documenti 12/12, scansione dell'indice senza nuovi segreti. L'esito fallito resta registrato; nuovo commit e nuova CI richiedono il proprio GO del revisore.

<a id="cornice-a2-preparazione-2026-11-09"></a>

## Cornice A2 — candidata reale spenta, 09/11/2026

Fonte del passaggio: [GO Claude A1](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6747756706), riferito esattamente a `4f2bc0f812fa2f72c63a409d1aa5d3a120bcd136`; non è un GO su A2. Candidata 1.2.268 sul ramo `codex/vault-frame-lab-20261109` della PR #278, produzione ancora 1.2.267. Nessun merge, cloud, attivazione o deploy della cornice.

Raccordo reale: pagina app.html, bootstrap canonico, broker/owner/trasporto e security manager; 22 route chiuse, query per route, protocollo/release, UID con intero fence revision/nonce, controllo dopo le attese, scadenze da lock_timeout, safe area prima della visibilità, history e uscite pubbliche top-level. Default doppiamente negato: switch compilato false e adapter di ammissione null, senza UID personale nel repository. Rules, Functions, firebase.json e workflow invariati.

Conferme fresche nei percorsi censiti: export/backup e vCard/PDF, cambio Master Password, condivisione/revoca e pubblicazione delle nuove buste per gli allegati, cancellazioni definitive e rimozioni strutturate differite al salvataggio (banche/carte/Widget, profilo e azienda). Grant monouso legato al target, 15 secondi e limite metadati 64 KiB; nessuna credenziale nei target. Le intenzioni di rimozione delle bozze possono richiedere una conferma anche per un elemento appena aggiunto e mai salvato: limite di usabilità, senza ampliamento dei permessi. Il cambio Master mantiene le tre schermate esistenti e aggiunge la conferma del padre prima della scrittura; dopo il successo revoca la sessione della cornice. La copertura resta oggetto della revisione di Claude.

Prove dedicate: `npm run test:vault-frame-runtime` **116/116**, in cinque file: runtime 55, navigazione/logout 30, confini 19, browser runtime/native 8 e browser media 4. `node --test tests/vault-session-races.test.mjs` **25/25**, incluso il gestore reale, fence pendente senza evento e cambio Master interrotto. Sono prove sintetiche: policy/broker/owner/transport/CSS e checker reali; confini Auth/Firebase simulati, Chrome desktop headless su loopback, stream canvas e file inventati. Nessun contenuto personale o Vault reale. La prova native usa il checker effettivo e un nuovo clic attendibile, compresi scadenza, lease e sospensione; fotocamera e picker scartano i risultati tardivi dopo revoca. I test archivio distinguono esplicitamente revoca prima e dopo la prima richiesta inviata, mantenendo le asserzioni sulle cancellazioni effettive.

Regressione generale: verificati tutti i gruppi previsti da npm test, **3388 casi / 3378 PASS / 0 FAIL / 0 cancellati / 10 skip in 64 gruppi**. Il comando iniziale si è fermato nell'harness storico di cancellazione Scadenze perché rimuoveva gli import senza fornire il nuovo confine standalone. Corretto il solo harness, mantenute le asserzioni su retry SDK e scritture reali; ripetuti test:vault-mutation e tutti i gruppi successivi, tutti riusciti. Il conteggio usa il prefisso riuscito e la coda finale ripetuta, senza sommare i tentativi falliti e senza presentarli come un singolo npm test con exit 0. I log distinti e la sintesi effettiva sono conservati in .codex-tmp. La CI sul commit della PR deve ancora eseguire integralmente npm test. Ambiente locale Node 24.22.1; la CI prevista usa Node 22 e ha un esito distinto. I vecchi harness che rimuovono gli import ricevono un confine standalone esplicito, senza indebolire le asserzioni sui dati: non certificano la cornice. Le prove browser della cornice rimangono separate e verificano la conferma reale. Dipendenze esatte dei lockfile installate con script disabilitati, senza upgrade: il tentativo offline Functions è risultato incompleto ed è stato completato da npm pubblico. Il collegamento temporaneo iniziale a node_modules è stato rimosso; nessuna eccezione alla scansione MD.

Inventari e gate: 31 HTML canonici (30 pagine e contenitore inattivo); runtime offline con 61 export e 334 risorse, anteprime UI escluse. Le due etichette dell'azione nativa e le tre frasi della nuova guida sono nelle otto lingue; il precedente debito di 185 frasi guida in italiano non è dichiarato risolto da A2. Budget statico con costo circoscritto documentato in [Interfaccia](../regole/INTERFACCIA.md#cornice-a2-ui-2026-11-09): eccezioni esplicite da rivedere con Claude, target runtime invariati. Mappa Graphify aggiornata solo sul codice, generati e ricevute tecniche in .codex-tmp esclusi da Git. Gitleaks sull'indice del candidato senza nuovi segreti; verifica finale dei documenti sul candidato prima del commit. La CI del nuovo SHA è distinta dalle precedenti run A1.

Gate successivo: GO A2 di Claude sul commit segnalato nell'avviso sulla [PR #278](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278). Nessun GO attribuito ai controlli statici interni. B1 (interruttore server e header selettivi) non iniziata; B2 lista prove e C1 Auth/App Check/PRF, camera/microfono reali, Android, Safari iPhone e PWA fisici non eseguiti. Nessuna attivazione né dichiarazione CORNICE CHIUSA. Merge/deploy soltanto dopo GO e approvazione personale di Diego.

<a id="cornice-a1-contratto-2026-11-09"></a>

## Cornice A1 — contratto preparato, 09/11/2026

Nuovo ordine diretto di Diego, sequenza A1–C2 sulla PR #278; scelta esplicita del background uguale alla durata dell'inattività. Ramo `codex/vault-frame-lab-20261109` riallineato al master 1.2.267 mediante merge `7ae131b5582baf99a3741c396c5112b5a6a6a217`, senza conflitti e conservando il laboratorio. Quel merge importa solo lavoro già integrato in master; A1 aggiunge soltanto contratto/decisione e manutenzione documentale. Nessuna nuova implementazione A2, flag server, header applicati, prova di integrazione reale o pubblicazione.

Ricognizione statica mirata: 22 pagine private con bootstrap, query operative e ritorni esistenti; le dieci route lab non sono allowlist produttiva. Verificati sorgenti di timeout, lifecycle RAM, fence/logout, navigazione e worker push; matrice header attuale, provider App Check/Auth, camera, voce e WebAuthn GET/CREATE. Due riscontri consultivi interni readonly hanno aiutato il censimento; Codex resta unico scrittore, e tali riscontri non sono una revisione di Claude né un GO sulla PR.

A1 esplicita intestazioni statiche per route (non per UID), permesso server individuale, copie RAM transitorie nei figli e limite same-origin/XSS. I riferimenti tecnici esterni sono nei contratti; nessuna prova fisica/di compatibilità è dedotta dalla lettura. Controllo documentale locale superato: 34 MD, 777 collegamenti e 12/12 test. `npm run test:vault-contract` superato: 889/889, zero falliti/cancellati/skip in tre gruppi (29 sessione, 831 shell storica, 29 laboratorio iframe inclusi cinque browser). Il primo tentativo ristretto conta 884 PASS e cinque browser FAIL per ERR_NETWORK_ACCESS_DENIED su loopback; la ripetizione con accesso necessario, senza modificare test o runtime, supera tutti i casi. Queste sono prove dei contratti/laboratori preesistenti, non del bridge reale A2 o dei dispositivi. Risultati e SHA completo nel commento «PASSO A1 COMMITTATO» sulla PR. Claude deve rispondere sulla PR prima di A2. Stato produttivo invariato: 1.2.267, sorgente `1bcbef73`, cornice non attivata; elenco MD sempre 34.


<a id="ui-overlap-followup-2026-11-09"></a>

## Residui di copertura header e metadati allegati — 1.2.267 pubblicata, 09/11/2026

**Pubblicazione conclusa e verificata:** [PR #280](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/280) integrata in `f225d599`; stabilizzazione separata [#281](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/281), con check verdi sull’head `37981d30`, integrata nel sorgente finale **`1bcbef73631380ec30821357641ce9695cc6e230`**. [CI #1039](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42656484505) e successivo controllo post-merge #1040 riusciti. Il precedente FAIL #1038 rimane registrato, non viene trasformato in PASS.

[Hosting #1041](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42658564232) concluso con successo: validate `129303618237`, deploy `129310479394`, sullo stesso SHA di master. Suite del rilascio **3.234 casi, 3.224 passati, zero falliti/cancellati, 10 skip in 62 gruppi**. Scope **hosting**; installazione backend e i due deploy recovery/MFA sono saltati, comando CI limitato a Hosting. Nessun deploy dal PC né modifica a workflow, Rules, Functions o dati.

La run ha atteso realmente production; Diego conferma «ho accettato» e la risposta API registra **approved**, utente Diego-Stack-ai, `can_admins_bypass:false`. Codex prepara il modulo e seleziona production ma non invia il clic finale: questa approvazione è personale, distinta dalla delega precedente della #1030. Il deploy termina alle **17:04:07 UTC**; il controllo remoto della CI alle 17:04:14 UTC.

Confronto indipendente di Codex dalla checkout esatta e pulita: manifest locale rigenerato e verificato; `--verify-url` superato, versione **1.2.267**, sorgente **1bcbef73**, **341/341 file** identici oltre al manifest, albero pubblico SHA-256 **`f998f3112f72e555084efd5cedb8dfc11e71d6f51a8dc98b74c9590ae70f1256`**. Il verificatore controlla anche cache-control del manifest, CSP della root, indice, redirect login legacy e rewrite Home. I commit documentali successivi non cambiano lo SHA Hosting. Non è una prova di rendering fisico o di attivazione del worker su tutte le PWA.

Contraddittorio di Claude sul codice UI: sessione `80bc9f99-82c0-4112-8d90-bb3d0760e8a3`, codice `33f6aec7`, già delimitato qui sotto; sulle sole ricevute successive sessione `d90cb2b7-7183-488a-bfa5-5b11320a98cd`, nessun bloccante/diniego. Sul seguito test #281, sessione **`1b4a3f1d-a442-4bc5-9c9f-31f2b243d3d7`**, head `37981d30`, lettura integrale di diff, contesto test/CSS e riepilogo di integrità: nessun bloccante né indebolimento delle asserzioni nel perimetro letto, zero dinieghi. Rapporto locale ignorato SHA-256 **`a58e3e41f9b5090d20572ee44622d738436b4d1921c5c59d94bb0a39fa6744a0`**; una miglioria diagnostica minore resta non bloccante. Queste letture statiche precedono i merge ma non sono riesecuzioni dei test né una verifica indipendente di Claude della produzione.

**Limiti e seguito:** prova fisica iPhone/Safari/PWA non eseguita; nuova grafica rinviata, cornice #278 ancora laboratorio in bozza e non attivata. La richiesta Vault a ogni pagina non è risolta da questo rilascio. Ricevute aggiornate nei cinque MD esistenti; elenco canonico sempre **34**. Le sezioni seguenti conservano la preparazione e il FAIL intermedio, non indicano la versione attualmente online.

**Seguito post-merge prima del rilascio:** dopo l’ordine diretto «pubblica», la PR #280 è integrata in `f225d59911776cfabbaf73b1fedc21ba7e72504c`. La [run #1038](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42654742561) fallisce nel test aziendale sulla precondizione di posizionamento del probe, prima del confronto pixel; nessun deploy eseguito. Dodici ripetizioni diagnostiche del test precedente passano localmente e non annullano il FAIL della CI. Una prima attesa di un solo frame riproduce entrambi i fallimenti: probe alto 83px ma top 20/bottom 103 nella fascia 0..85, dopo variazione iniziale da 44px.

Il seguito `codex/ui267-scroll-fixture-stability` attende font, altezza effettiva e geometria/scroll stabili per due frame, con limite diagnostico di due secondi; disabilita l’anchoring soltanto sullo scroller sintetico. Nessuna attesa fissa, ritentativo dei confronti, tolleranza aggiunta, crop ridotto o test saltato. Mantiene l’intero probe nella fascia e l’uguaglianza pixel A/B, con coordinate negli errori. Fondazioni UI **15/15 PASS**; cinque ripetizioni aggiuntive dei due header superate. Controllo negativo con lo stesso helper e solo CSS header della 1.2.266: **due fallimenti pixel attesi**, senza errore di posizionamento; nessun sorgente CSS modificato per la prova. Codice applicativo, versione e albero pubblico invariati rispetto a #280; nuova PR/check e parere Claude precedono il rilascio richiesto. Produzione ancora 1.2.266 e controllo fisico iPhone non eseguito.

Ramo isolato `codex/ui-overlap-followup-20261109`, base `0229279980cdb2d3524091403ad1ac785cda8e8d`. Le schermate di Diego riguardano Chrome PC; nessun dato personale, foto o contenuto Vault è importato nelle fixture o nel pacchetto per il revisore. Le precedenti prove verdi 1.2.266 verificavano posizione e hit testing delle linguette, non il compositing dell'header e non le card degli allegati: non dimostravano assenza dei due residui.

Riproduzione prima della correzione, `node --test --test-name-pattern 'header occludes|attachment metadata' tests/profile-scroll.browser.test.mjs`: **tre fallimenti attesi**, header Profilo, header Dati azienda e metadati degli allegati. A 320px la stringa dimensione/data invadeva il cestino e usciva di 79px dalla propria colonna. Le due immagini dell'header con/senza contenuto contrastato sottostante differivano: hit testing corretto e sfondo delle linguette non bastavano a impedire la trasparenza.

Correzione locale in due CSS: header coprente e pseudo-velo neutralizzato nel solo foglio dei due profili; footer degli allegati Profilo con metadati a larghezza piena, ritorno a capo e cestino su riga distinta/target minimo. La prima soluzione con solo ritorno a capo superava l'assenza di collisione ma spezzava male le date sulle card strette: dopo ispezione degli artefatti sintetici si separa la riga del cestino, mantenendo tutta l'informazione visibile. Nessuna modifica JavaScript funzionale o handler.

`npm run test:ui-foundations`: **15/15 PASS**, zero skip (6 tema, 3 contratto colori, 6 browser). I tre browser aggiunti coprono due profili con confronto pixel della fascia header, titoli/controlli sintetici intenzionalmente sottostanti, click del comando header senza click-through; inoltre card immagine/file con nomi lunghi, dimensione e data, rettangoli del testo, contenimento e click Elimina senza apertura. Header: 320/393/1280px, chiaro/scuro e palette blu/lavanda. Allegati: 320/360/393/1280px e testo 16/24/32px. Artefatti prima/dopo solo locali in .codex-tmp e ispezionati; nessun dato reale.

Stylelint globale superato. Lint eseguito con le dipendenze già presenti, senza installare o aggiornare pacchetti. Il collegamento locale temporaneo non è compatibile con la scansione MD: rimosso il solo collegamento, mantenendo il controllo documentale invariato e usando il percorso esplicito del linter. Bump canonico 1.2.266 → 1.2.267, 264 riferimenti in 104 file, worker e versione coerenti: non equivale a distribuzione. Catalogo guida riesaminato rispetto ai due profili: comandi, testi e target restano validi, incluso cestino/conferma; sola reviewedAppVersion allineata alla candidata, senza introdurre nuovi testi o certificazioni linguistiche. La successiva ricevuta CI/revisione qui sotto aggiorna i precedenti gate preparatori. Restano le prove fisiche e una distinta decisione di rilascio: produzione **1.2.266 / Hosting #1030 / 193f4768**, cornice non attivata, 34 MD invariati.

**CI del candidato:** [PR #280](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/280), codice `33f6aec739b4b95e17ece8e5f26109ec21b1470a`. [Run #1036](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42649399069), job validate `129271337673`, conclusa con successo; `validate`, `docs` e `Gitleaks on changed commits` verdi. Suite completa **3.234 casi, 3.224 passati, 0 falliti, 0 cancellati e 10 skip in 62 gruppi**, inclusi i tre nuovi browser. Manifest candidato di **341 file** verificato sul merge temporaneo GitHub `f481094c0326e57a3cdda70f3d7097c6915fe382`, albero pubblico SHA-256 `f998f3112f72e555084efd5cedb8dfc11e71d6f51a8dc98b74c9590ae70f1256`. Il job deploy è **saltato**: non è una pubblicazione. Questa ricevuta successiva riguarda solo MD; i check del suo head finale si consultano sulla PR e non sono sostituiti dagli esiti del codice precedente.

**Contraddittorio valido di Claude Code:** sessione `80bc9f99-82c0-4112-8d90-bb3d0760e8a3`, eseguita dopo la CI sul candidato `33f6aec7`, in sola lettura con Read/Glob/Grep. Lettura dichiarata dell’intero pacchetto `context.txt`, `integrity.json` e `focused.patch`, con riscontri mirati sugli import e sul renderer degli allegati: **nessun bloccante nel perimetro letto**, zero dinieghi registrati, nessuna modifica. Rapporto locale ignorato `.codex-tmp/review/claude-result.json`, SHA-256 `9e9ce8a21f5e28b8489b6330124c339e25181aca15029321ddc0b24285b1aaae`. Il parere conferma il perimetro dei due fogli CSS e la separazione dei metadati dal cestino, ma non ripete test, richieste HTTP o verifiche fisiche; non autorizza merge/deploy e non certifica il comportamento produttivo. Le successive modifiche alle sole ricevute non vengono attribuite a questa lettura del codice.

<a id="css-profilo-pubblicazione-1-2-266"></a>

## Pubblicazione verificata UI 1.2.266 — 09/11/2026

[PR #277](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/277) integrata nel sorgente `193f4768ff67f047a0701a3c6fbc581308e04ded`. [Run Hosting #1030](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42619309846) conclusa con successo, job deploy `129172366224`; validazione completa e controllo remoto della CI superati. Gli scope backend recovery e MFA sono SKIPPED: questa run distribuisce soltanto Hosting, non Rules o Functions. Nessun deploy dal PC.

Dopo l'attesa prevista, Diego scrive direttamente in chat «Approva e distribuisci» e delega questo solo clic a Codex. L'approvazione è inviata dall'interfaccia GitHub e registrata via API con `state: approved`, utente Diego-Stack-ai e commento che identifica delega, run, scope e SHA. Non è un'approvazione premuta personalmente da Diego sul sito e non è un'autorizzazione generale per altre run. Nessuna protezione viene modificata o aggirata; il dato restituito nell'approvazione conserva `can_admins_bypass: false`. La riserva personale precedente viene aggiornata esclusivamente per questa run dal nuovo ordine diretto.

Verifica indipendente di Codex dal sorgente pulito ed esatto: manifest locale rigenerato come artefatto ignorato (quello preesistente era della 1.2.265), `--check --require-clean` e `--verify-url` superati. Manifest pubblico **1.2.266**, `sourceDirty: false`, sorgente **193f4768**, **341/341 hash identici**, SHA-256 dell'albero `90d8706b24b70aa7263f2ddab1880ed5993e7f0b191276ed5e877d930cb6e992`. Verificati anche cache-control del manifest, CSP completa, indice, redirect login legacy e rewrite Home. Le ricevute documentali successive non sostituiscono lo SHA distribuito e non richiedono un nuovo Hosting.

Controlli HTTP aggiuntivi alle 14:30 UTC (15:30 italiane): **321 risorse** in `offline-assets.js`, **zero anteprime** nella shell, tutte le **17 anteprime** conservate nell'albero pubblico già confrontato; worker `codex-shell-v1.2.266`. `/prova.html`, `/app.html` e `/experiments/persistent-vault-frame/app.html` rispondono **404**. Profilo, Dati azienda e login rispondono 200 con XFO DENY, CSP frame-ancestors none e nosniff. Non viene affermato che tutte le PWA abbiano già attivato il nuovo worker o eliminato le vecchie cache.

La revisione statica valida precedente di Claude Code riguarda il candidato `d648a5f7`, sessione `fa260ebd-d434-4f59-bee2-3e7d075dbb2f`, senza bloccanti nel pacchetto letto; non è una nuova verifica di Claude della produzione. La prova fisica iPhone chiaro/scuro e due palette è rinviata da Diego e resta **non eseguita**. La [PR #278](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278) rimane un laboratorio sintetico in bozza, non unita né distribuita: la richiesta Vault a ogni pagina non è risolta da questo rilascio. Elenco canonico sempre 34 MD.

<a id="cornice-lab-2026-11-09"></a>

## Primo laboratorio della cornice iframe — 09/11/2026

Worktree `.codex-tmp/vault-frame-lab-20261109`, ramo `codex/vault-frame-lab-20261109`, base master `193f4768`. I file applicativi del laboratorio sono esclusivamente in `experiments/persistent-vault-frame/`; non esiste ancora `Frontend/public/app.html`. Il server espone soltanto file sintetici espliciti su `127.0.0.1`, senza dati, chiavi, account o richieste Firebase. Il modello nega l'ammissione per default; l'interruttore dimostrativo abilita solo fixture inventate.

Comando `node --test experiments/persistent-vault-frame/*.test.mjs`: **29/29 PASS**, zero skip. Sono 23 prove del modello, una sulla copia transitoria nel child e cinque browser Chrome headless reali su loopback. Le prime prove browser nel sandbox sono fallite con rete locale negata; riesecuzione con permesso loopback riuscita, senza disabilitare sicurezza o scaricare browser. Sono stati corretti e ricontrollati anche i casi di scadenza durante sblocco/riammissione e continuazioni che terminano dopo la revoca.

Browser: diniego iniziale; dieci documenti con un solo sblocco; due Indietro e due Avanti; query id/filter/profileTab conservate; reload del figlio senza nuovo sblocco e reload del padre con nuova sessione; nuova scheda senza sessione ereditata; blocco dal padre e dal figlio, logout; conferma sintetica annullata/accettata; vecchio READY ignorato dopo reload sulla stessa URL; about:blank revoca; header deny/self effettivi e tentativo di framing esterno respinto. L'assenza del materiale è controllata in storage, database/cache browser, cookie, URL, DOM e console. Origine/source/Document/nonce, concorrenza UID/epoca, timeout, background e grant monouso sono coperti anche dal modello con orologio controllato; quest'ultimo non è un test fisico del background su iPhone.

Revisioni consultive degli agenti in sola lettura: modello e trasporto/handshake, percorso reale di integrazione, prove browser/cleanup. Nessun test rieseguito dai revisori; il loro parere non è una review di Claude. Claude Code ha letto integralmente il pacchetto immutabile dei 12 file del laboratorio (candidate.txt, righe 1-824), sessione `d0d69f7e-1a3c-47f2-9c46-c4b9268a6e47`: nessun difetto bloccante concreto individuato, nessun test rieseguito e nessun diniego di lettura. Il parere copre il laboratorio fotografato, non i cinque MD o package.json e non costituisce GO al merge/deploy. I riferimenti numerici del rapporto sono coordinate del bundle, da non usare come righe dei singoli sorgenti. Successivamente Codex aggiunge una sola prova concorrente, nove conferme su limite otto, senza cambiare il runtime: otto grant e un diniego, suite portata da 28 a 29 casi. Follow-up ristretto di Claude, sessione `e9b2b573-4b16-418c-bb1d-976bf9be9d34`: rilievo di superamento del limite ritirato, perché controllo e inserimento sono sincroni dopo l’ultimo await; confermata la correzione dei riferimenti al bundle e il carattere consultivo senza GO al merge/deploy. Nessuna nuova lettura completa o esecuzione gli è attribuita. Il confronto degli hash attesta che fra il pacchetto letto e la successiva consegna cambia soltanto il file di test con quel caso aggiuntivo; gli undici altri file sono identici. Rapporto completo privato SHA-256 `faf21a0b710778296b406dbbe78c9e89063c23a914864446ff1f82f9b2759613`. Nessuna attivazione o pubblicazione della cornice, nessuna modifica alla produzione; UI 1.2.266 segue il distinto gate descritto sotto. Prove reali Firebase/Auth/App Check/PRF/scanner, parità e dispositivi ancora non eseguite. Elenco MD sempre 34.

La preparazione è salvata nel commit `b503efbe2beddcf08697f51fc96ac891fbcb2393` e nella [PR #278 in bozza](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278); fase iniziale con check CI in corso, nessun merge. Sul successivo commit `9807dfb53dca128bfdbabfbaa3443c4cde1fb72e`, [#1032](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42624268694), job `129183874492`, la suite completa è poi riuscita: **3.260 casi, 3.250 PASS, zero falliti e cancellati, 10 skip in 63 gruppi**, inclusi i 29 casi del laboratorio e i suoi cinque browser. `validate`, `docs` e `Gitleaks on changed commits` verdi sul medesimo head, deploy SKIPPED. Manifest candidato 1.2.266 di 341 file costruito e verificato sul merge temporaneo `bc2a53cf21fd6aee4606ca68216c49737afa6f41`; non è una distribuzione. La ricevuta successiva aggiorna solo gli esiti MD, senza cambiare codice o test; i relativi check sono distinti e consultabili nella PR. La suite laboratorio è inclusa in `npm test` tramite `test:vault-contract`; quest’ultimo è superato localmente, inclusi i contratti preesistenti. Controlli documentali 12/12, 34 MD e 749 collegamenti; Gitleaks del pacchetto sintetico senza rilievi. Nessuna differenza in Frontend/public, backend, Rules o workflow; albero pubblico invariato: 341 file, SHA-256 `90d8706b24b70aa7263f2ddab1880ed5993e7f0b191276ed5e877d930cb6e992`. `release:verify` nel worktree privo di manifest generato termina per file assente e non è dichiarato PASS: nessun manifest/deploy è richiesto per il laboratorio, il confronto dell’albero pubblico è invece eseguito.

<a id="css-profilo-rilascio-1-2-266"></a>

## Integrazione e avvio del rilascio UI 1.2.266 — 09/11/2026

Fotografia precedente alla delega del clic e alla pubblicazione: lo stato finale è nella ricevuta produttiva sopra.

Revisione statica finale valida di Claude Code, sessione `fa260ebd-d434-4f59-bee2-3e7d075dbb2f`, sul candidato `d648a5f71fd25b41e0077fdd4a5156074302d2fd`: «APPROVABILE PER IL CODICE», nessun bloccante nel diff letto, nessun test eseguito né certificazione fisica/produttiva. Lettura completa del pacchetto focalizzato e del contesto, senza dinieghi; rapporto locale escluso da Git, SHA-256 `8f303ae284546017647c28e8c66108509552803288f275c95760b9bff379cd50`. Il tentativo precedente con percorso non accessibile non vale come revisione. [PR #277](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/277) con provenienza del parere registrata.

Check finali sull'head documentale d648a5f7 tutti verdi; [#1028](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42610604705): 3.231 casi, 3.221 PASS, zero falliti/cancellati, 10 skip in 62 gruppi. Manifest candidato di 341 file e albero pubblico identico a quello collaudato nella #1027. Diego ordina la pubblicazione e rinvia il controllo visivo fisico: iPhone chiaro/scuro e due palette resta **non eseguito**, non PASS. Merge `193f4768ff67f047a0701a3c6fbc581308e04ded`, entrambi i commit e tutti i rami conservati.

Preflight Git severo conservato con exit 1 per i vecchi rami e il vecchio worktree sporco congelato; non dichiarato verde né aggirato. Bundle completo di tutte le ref creato fuori OneDrive e verificato; verifica della preservazione del vecchio delta: 1.387 file archiviati invariati. Il candidato corrente e master risultavano puliti e allineati, nessun file vecchio importato.

La run automatica push #1029 è riuscita e il suo job deploy è SKIPPED, come previsto dal workflow. Prima richiesta di dispatch rifiutata dalla revisione automatica per possibile sovrapposizione; attesa la conclusione e verificato via API il deploy saltato, stesso dispatch effettuato senza percorsi alternativi. [Hosting #1030](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42619309846), SHA 193f4768, scope solo hosting: validazione completa riuscita in 11m24s, **Waiting for review**, approvazione personale ancora attesa. Nessun deploy locale o backend. Ultima produzione effettivamente verificata ancora 1.2.265 / #1024 / 87909638; questa nota non dichiara la 1.2.266 online.

<a id="css-profilo-candidata-1-2-266"></a>

## Integrazioni della candidata CSS/Profilo 1.2.266 — 09/11/2026

Codice integrato nel commit `1126e5b6c2a31f9e668fba8a29db1660a4184f85`, [PR #277](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/277) in bozza sulla base `449c5832`. Check `validate`, `docs` e `Gitleaks on changed commits` verdi. [Run completa #1027](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42608767001), job validate riuscito in 10m57s: **3.231 casi, 3.221 passati, zero falliti, zero cancellati, 10 skip in 62 gruppi**. I tre browser passano sul runner, senza modifica del workflow o rimozione/skip dei test. Versionamento e manifest candidato superati: 341 file, merge temporaneo GitHub `b6cb9f00a9317bfa0e6a954569ebc72a1610d4ce`, impronta dell'albero pubblico `90d8706b24b70aa7263f2ddab1880ed5993e7f0b191276ed5e877d930cb6e992`. Quello SHA non è un rilascio: il job deploy è saltato. La ricevuta successiva modifica soltanto MD; nessun nuovo parere di Claude o controllo fisico è attribuito a questo esito CI.

Il parere riportato da Diego sulla candidata base `449c5832` è un GO con riserve dopo lettura completa del diff; Claude non ha rieseguito gli 11 test allora registrati. Le integrazioni successive definiscono `--header-height: 85px` nelle fasce comuni, applicato a header, contenitore bilanciato e offset delle linguette, con safe area sommata una sola volta. Fondo opaco tematico comune per Profilo privato e Dati azienda; rimosso anche l'override aziendale trasparente più specifico. Spaziatura privata riallineata al token mantenendo il margine editoriale. Nessun nuovo livello globale né modifica del bootstrap.

Le fixture browser leggono markup delle linguette e ordine CSS dalle due pagine reali, con rete bloccata; verificano chiaro/scuro a 393×852 e 1280×900, altezza canonica e override a 100px, scorrimento effettivo, azione intenzionalmente coperta dalla banda e cliccabilità dopo lo scorrimento. Gate fondazioni UI **12/12** (6 tema, 3 contratto colori, 3 browser), offline **16/16**, cache/residui **10/10** e Stylelint globale superati. I primi tentativi della fixture estesa non avevano coda di contenuto sufficiente per portare l'ultima azione sotto la banda; aumentata la sola altezza sintetica, senza indebolire gli assert. La build richiede le dipendenze nel worktree: collegamento locale alla cartella già presente, senza aggiornamenti npm. Non sono prove fisiche iPhone/Safari/PWA.

Bump tramite `npm run version:bump -- 1.2.266`: versione, lock, riferimenti asset e cache worker coerenti. La build canonica produce **321 risorse offline**, escluse le 17 anteprime mediante politica condivisa fra generatore e audit. Test sui percorsi esclusi e sul worker reale in harness: anteprime HTML/CSS/JS, anche con query, non intercettate e nessuna scrittura cache. Le risorse pubbliche restano sul filesystem e nel perimetro Hosting; la cache HTTP del browser è distinta. La nuova cache di versione elimina quella precedente all'attivazione del worker. Nessun deploy eseguito e manifest di rilascio generato soltanto con il relativo SHA.

Il ripristino delle trasparenze può cambiare l'aspetto di tutte le pagine interessate: controllo di Diego su iPhone, chiaro/scuro e almeno due palette ancora aperto. Servono inoltre check CI e nuova revisione di Claude sulla PR prima del merge. L'elenco resta di 34 MD; ricevute e catalogo distinguono candidata e produzione 1.2.265. La verifica diretta della risposta server resta non eseguita, distinta dalla lettura del codice.

<a id="rilievi-css-profilo-locali-2026-11-09"></a>

## Prima verifica CSS/Profilo, precedente alle integrazioni — 09/11/2026

Base `449c5832`, nessuna pubblicazione. Confermate 110 dichiarazioni con alpha mancante in 25 CSS. L'analisi storica le riconduce alla modifica `d99a3960` dell'08/10; il parent `da3c6339` consente il recupero univoco di tutti i valori mediante contesto selettore/at-rule/proprietà, compresa una rinomina successiva. Sono inoltre normalizzate 55 funzioni con alpha già presente, perché le triplette del token e dei producer JavaScript contengono virgole. Risultato: 165 funzioni corrette in 27 CSS; token, valori preesistenti e JavaScript preservati. Un controllo indipendente ricostruisce le associazioni senza usare il rapporto del generatore come oracolo.

Nel solo Profilo privato le linguette avevano offset di ripiego 64px, mentre l'header reale misura 85px oltre alla safe area, e sfondo trasparente. La candidata usa un selettore locale, offset coerente e fondo opaco; nessun nuovo livello globale o cambiamento delle fasce comuni. La barra Azienda non è selezionata dalla nuova regola.

Regressione prima/dopo con CSS reali su fixture Chrome isolate e rete bloccata: prima si riproducono funzioni colore invalide e barra trasparente; dopo gate fondazioni UI **11/11**, compresi i test del tema, dei colori risolti e dei tre pulsanti del Profilo, lo scroll del solo contenitore centrale, l'intersezione intenzionale fra pulsante e banda delle linguette e la successiva raggiungibilità dell'azione. Stylelint, shell delle pagine e riferimenti statici superati. Il nuovo controllo Stylelint intercetta alpha mancanti e separatori incompatibili; i test coprono anche funzioni RGB seguite da URL validi. Sono prove locali Chromium, non Safari fisico, PWA o verifica autenticata dell'app completa. Claude riceve una fotografia immutabile e fornisce un parere consultivo sulla roadmap e sul banco di prova, dichiarando di non avere potuto rileggere integralmente il diff CSS. Il riscontro non costituisce revisione finale della candidata o GO al merge/deploy; nessuna verifica produttiva è attribuita al revisore.

<a id="prove-grafiche-hosting-2026-11-09"></a>

## Pubblicazione separata delle quattro prove grafiche — 09/11/2026

La [PR #275](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/275) conserva `91084186` (tre prove Account), `3f161bfd` (Profilo) e il distinto aggiornamento del mandato. I tre check obbligatori sono verdi sull'head `1d1fa16b61e6b3432b2b2c423defe98271902933`; suite completa CI: **3.222 casi, 3.212 passati, 0 falliti, 10 skip in 62 gruppi**. Claude Code, limitato a strumenti di lettura, fornisce prima il parere statico e poi la conferma finale sul medesimo head dopo i check, senza difetti bloccanti. Non attesta prove browser o una chiusura di sicurezza complessiva.

Merge `8790963858756d694e191a4c62fee02a9f1004dd`; [run Hosting #1024](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42585828782) riuscita alle **09:40:52 italiane**. L'approvazione production è eseguita da Codex soltanto dopo la nuova delega esplicita di Diego per questa run, registrata anche nel commento GitHub. Nessuna modifica ai requisiti di revisione o ai permessi; nessun deploy dal PC. I log confermano l'unico target Hosting, con entrambe le distribuzioni backend saltate.

Manifest **1.2.265**, sorgente `87909638`, **341/341 hash online verificati** dal verificatore canonico; impronta dell'albero `c667e88b0d59d04514933a87641b3a67669b616c97ef35571769e627bf79df11`. Il conteggio Firebase è 342 perché include il manifest stesso. Rispetto al precedente sorgente produttivo `f2e810a7`, i 323 file pubblici esistenti diversi dalla precache sono identici: 17 nuove risorse dimostrative e un solo aggiornamento dell'indice offline. Header e contratto Hosting invariati su otto percorsi; `prova.html` risponde 404. Confronto cloud prima/dopo: **47 Functions e Rules esattamente invariate**.

Verifica browser sui moduli realmente pubblicati, Chromium con viewport 393×852: apertura delle quattro prove, ricerca e filtro, dettaglio e ritorno, visibilità della password inventata, modifica del nome utente e ritorno alla fixture dopo reload, cambio del solo tema dimostrativo, sezioni Contatti/Indirizzi/Documenti e confronto Oggi/Proposta. Il cambio dello switch mantiene il focus; il visore foto è un dialogo nativo, Escape lo chiude e ripristina il focus alla miniatura. Indice a 1280×900: quattro card senza scorrimento orizzontale. Nessun errore console osservato. Dati inventati, modifiche dei dati soltanto in memoria e sola preferenza del tema conservata localmente; nessun accesso a Vault, utenti reali o clipboard in lettura. **Non è una certificazione su dispositivi fisici, Safari o PWA**. Il primo tentativo locale della suite era interrotto dalla dipendenza Functions assente nel worktree; installata dal lockfile senza modificarlo, il test interessato passa 1/1 e la CI completa rimane l'evidenza integrale.

Rollback: solo Profilo tramite revert completo di `3f161bfd`; tutte le prove con un unico revert del merge #275, inclusa la precache, seguito da PR/check/Hosting CI. Non rimuovere il primo bundle conservando il Profilo, che ne usa le risorse comuni. Schede già aperte e worker precedenti richiedono aggiornamento/riapertura; verificare poi i 404. I rami sono conservati. Ricevute tecniche e immagini restano locali escluse da Git; i documenti successivi non cambiano lo SHA distribuito.

<a id="assistenza-2fa-rilascio-1-2-265"></a>

## Ricevuta distinta dell'assistenza 2FA 1.2.265 — 09/11/2026

Il precedente sorgente `f2e810a7c7674dcea1469b41fb4b646e044dd94d` deriva dalla PR #271, dopo il rapporto finale valido di Claude fornito da Diego sull'head `a8858faa`. [Run dedicata #1020](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42572798743) e [Hosting #1021](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42574533722) riuscite dopo le approvazioni personali di Diego, senza deploy locale. Suite completa CI 3.212 passati, 0 falliti e 10 skip; manifest e 324/324 hash verificati. Nella prima fase cambia soltanto la Function dedicata, con le altre 46 invariate e Rules/Hosting immutati; nella seconda rimangono identiche tutte le 47 Functions e le Rules.

Probe dei componenti client realmente online: **29 controlli superati** su contenuti sintetici, inclusi nomi dei download e contenitore portabile. Il percorso a blocchi usa una piccola fixture in RAM, non un upload reale o una prova del codec. L'ingresso senza attestazione rifiuta la richiesta, ma il tentativo con attestazione genuina non ottiene un token valido: **la verifica live dell'esito interno resta bloccata, non PASS**. Nessun bypass, utente o dato Vault creato. I test browser del modulo di accesso e delle Impostazioni restano prove su fixture, non sessioni produttive autenticate. Il riscontro produttivo finale del revisore resta da completare; questa ricevuta non lo sostituisce e non avvia la cornice Vault.

<a id="workflow-delegato-pr-271-2026-11-09"></a>

## Commit workflow delegato della PR #271 — 09/11/2026

Dopo la richiesta di aiuto, Diego delega esplicitamente a Codex il solo commit del workflow, già incollato nel browser. Letto il contenuto completo dell'editor, l'impronta corrisponde al file approvato prima della conferma. Il [commit `3b6425ae`](https://github.com/Diego-Stack-ai/App-Codici-Password/commit/3b6425aea9e0205b33f57eae82ba2b89dd7a9b0e) è creato dal sito GitHub sul branch della PR #271, con unico parent `2af21c8c` e un solo file modificato. Il blob remoto conta 10.469 byte e conserva esattamente SHA-256 `14508cccc44463eb3160e7a2e0bf68b2d9f1aeb2b5adcff26b8a5988390e69cb`. Riscontro ripetuto indipendentemente via API; ricevuta visiva e rapporti tecnici privati esclusi da Git.

Il contratto effettivo a tre scope supera planner e test dedicati 4/4, inclusi 71 casi mutazionali e i controlli di censimento/policy. I selettori del percorso precedente restano invariati e il nuovo percorso riguarda soltanto la risorsa approvata. Il commit documentale successivo non cambia il workflow: i check finali e la successiva revisione valida devono riferirsi al nuovo head completo. Nessuna approvazione di deploy, merge, Function o Hosting eseguiti in questa fase. Produzione 1.2.264, candidata 1.2.265, 34 MD canonici; la delega non comprende le approvazioni personali production.


<a id="integrazione-revisione-pr-271-2026-11-08"></a>

## Integrazione della revisione valida della PR #271 — 08/11/2026

La nota di revisione fornita da Diego sullo head `3ff7d29f` è il riferimento valido per la chiusura e richiede due integrazioni prima del merge. I pareri consultivi locali di Claude Code registrati in precedenza non valgono come approvazione finale di questa nota. La candidata 1.2.265 sospende i percorsi client di generazione dei codici, compreso quello automatico dopo la configurazione, aggiorna assistenza, guida e registro linguistico; nessuna modifica al generatore server o ai codici esistenti. Prove e riscontri della consegna sono registrati sul nuovo head nella PR, distinguendo test sintetici da produzione.

I due supporti CI vengono preparati separatamente dal workflow, che resta sotto il controllo personale di Diego. La patch approvata esige già il nuovo contratto: applicarla letteralmente ai soli supporti farebbe fallire i check prima del commit del workflow. Per rispettare l'ordine richiesto, il validatore ammette soltanto due configurazioni esatte, quella corrente e quella futura, rifiutando combinazioni ibride, selettori aggiuntivi e perdita dei gate. Il workflow completo consegnato privatamente deve poi coincidere per SHA-256 con il file committato da Diego sul medesimo branch. Seguiranno check verdi e revisione finale valida; nessun merge o rilascio è attestato da questa preparazione. Produzione invariata alla 1.2.264, documenti canonici sempre 34.


<a id="revisione-preparazione-2fa-2026-11-08"></a>

## Preparazione 2FA e provenienza dei pareri — 08/11/2026

Aggiornamento della PR #271 in bozza dopo la nota autorizzata di revisione: risposte e assistenza manuale uniformate, limiti conservati e nomi dei download migliorati. Nessun rilascio, workflow, Rules o dato produttivo modificato. La proposta del futuro percorso CI resta un diff privato non applicato; la pubblicazione richiederà un ordine distinto e l'approvazione personale. Verifiche locali mirate concluse: Functions 566 passati, 0 falliti e 10 skip storici su 576; limite transazionale concorrente 2/2; browser assistenza 7/7; browser allegati e viewer portabile superati, con integrità dei byte e nessuna nuova anteprima per i download. I banchi UI usano import Auth sintetici, quelli remoti restano esclusi: non sono un collaudo produttivo. Documentazione verificata con 34 MD. Suite completa, CI e parere conclusivo di Claude devono riferirsi allo stesso head: i relativi esiti e la ricevuta consultiva vengono raccolti nella PR prima della consegna. La produzione resta alla 1.2.264. S1 è accettato come chiuso dalla nota autorizzata, conservando il precedente blocco del test completo a due identità come limite di copertura.

**Provenienza delle revisioni precedenti:** le API GitHub non registrano review formali sulle PR #272 e #273. Esistono invece i pareri consultivi locali di Claude Code sul codice prima dei merge: #272 head `9be28c1a`, parere completato alle 19:49:14 UTC e merge alle 19:53:14 UTC; #273 head `0c0deaa2`, parere completato alle 20:44:58 UTC e merge alle 20:52:21 UTC. Contenuti dei pareri, riferimenti esaminati e confronto dei file congelati con i blob Git concordano; i tree dei merge corrispondono agli head revisionati. I tempi locali sono riscontri del filesystem, non attestazioni firmate. Non si equiparano i pareri locali a review GitHub, né alla distinta verifica successiva di Claude riportata da Diego. Le ricevute tecniche restano negli appunti locali esclusi da Git. Da questa consegna la sequenza resta esplicita: check verdi → revisione Claude sul medesimo head → eventuale merge e rilascio autorizzati.


<a id="attachment-hardening-1-2-263"></a>

## Hosting 1.2.263 pubblicato — gestione allegati e ritiro laboratorio, 08/11/2026

Mandato preparatorio ricevuto dopo la 1.2.262; la cornice di continuità Vault resta sospesa. Inventario statico completato prima delle modifiche, con punti di apertura, anteprime, download e archivi portabili classificati. Il rapporto tecnico e i dettagli del rilievo aperto restano negli appunti locali esclusi da Git. La candidata irrobustisce la gestione degli allegati con una decisione condivisa, mantiene il formato e la validazione dei file grandi e ritira il laboratorio pubblico con i supporti dedicati. La superficie canonica resta di 30 pagine. La preparazione del recupero 2FA appartiene a un altro ramo da non unire o distribuire.

Verifiche locali concluse: suite completa **3.195 casi, 3.185 passati, 0 falliti e 10 skip dichiarati**, comprendente suite allegati **109/109**, archivio portabile **21/21** e ciclo vita dei dettagli **24/24**; audit sintassi e sicurezza, canone/pagine, guida e documentazione superati. La revisione indipendente del codice non ha rilevato aggiramenti della nuova decisione; il successivo controllo di invalidazione dei file grandi è verificato con tre prove mirate e nel browser. I due banchi browser superano anche il download reale e quello progressivo, il mantenimento delle anteprime ammesse e la pulizia dei temporanei. Usano crittografia destinatario reale e dati sintetici, con servizi remoti e persistenza dell'identità sostituiti dal banco; non certificano Auth/App Check o il protocollo produttivo completo. Gitleaks sul diff candidato non rileva nuovi segreti.

**Pubblicazione verificata:** [PR #272](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/272) integrata in `5dbdd60062610b00bfd7ce07a04a3d89679bf22e`, dopo i check obbligatori verdi e il GO consultivo di Claude. La [run 1004](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42517749223), scope `hosting`, termina con successo dopo attesa production e approvazione personale di Diego, registrata dalle API. Manifest pulito, tutti i **324 hash** e gli header verificati; pagina ritirata e due supporti rispondono **404** sia normalmente sia senza cache. Censimento, configurazioni, digest e timestamp delle **47 Functions**, insieme a hash e metadati delle Rules, sono identici prima/dopo. Nessun deploy dal PC. I vecchi riferimenti restano conservati; preflight exit 1 invariato e classificato, senza nuove anomalie o esclusioni.

**Collaudo produttivo e rettifica della copertura:** il banco sui moduli realmente pubblicati conta **13 PASS e 1 FAIL**. Download e anteprime dei contenuti ordinari, rifiuti di formato e viewer portabile sono verificati con byte effettivi. Il download a blocchi avvia lo scaricamento ma non lo completa: il precedente test controllava il solo nome/evento, quindi il suo esito non provava la consegna dei byte. Il difetto è riprodotto indipendentemente e trattato nel seguito 1.2.264. Il banco produttivo tra due nuovi utenti sintetici autorizzati si ferma invece alla preparazione del secondo partecipante: risposta 401, verifica server Auth valida e App Check mancante. Nessun Account, invito o allegato condiviso è stato creato; non si aggira la protezione e non si dichiara il percorso E2E superato. QA2 e Vault esistenti restano esclusi. Il criterio condiviso rimane aperto; il seguito 1.2.264 qui sotto registra la verifica conclusiva di Claude sul rilascio.

**Consegne separate:** la bozza [#271](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/271) è aggiornata sulla base Hosting in `0bca105a23c97350438e0859b03b398b878aa32c`, con `validate`, `docs` e Gitleaks verdi; resta non unita e non pubblicata. La [#268](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/268) è aggiornata, revisionata e integrata separatamente in `193759914d0e463d4b29468df08defc135772423`, dopo check verdi sulla testa `e502ad39`: modifica soltanto il lock degli strumenti di sviluppo e non ridistribuisce l'app. Queste librerie sono usate anche dalla CLI dei futuri deploy, quindi non si deduce assenza di impatto dal solo attributo dev.

<a id="attachment-download-followup-1-2-264"></a>

## Hosting 1.2.264 pubblicato — completamento download, 08/11/2026

Correzione mirata del completamento dei download grandi, con formato video e controlli di revoca invariati. Il banco ora attende il completamento e verifica i byte scaricati: fallisce sulla 1.2.263 e passa dopo la correzione. La prova indipendente confronta 64 KiB e 4 MiB, con contenuto integro e zero residui temporanei; non è una misura di memoria costante né un collaudo della dimensione massima. Due prove aggiuntive coprono revoca durante la nuova lettura ed errore dello stream, sempre senza apertura tardiva e con cleanup. Suite allegati **111/111**. La cache dei moduli segue la policy degli altri script; CSP e protezioni rimangono invariate. Guide riesaminate senza cambiamenti dei passi utente.

**Esecuzione conclusa:** [PR #273](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/273) integrata in **`70b9618ceddfceebc633975ad09e8687b743d5e1`**, dopo `validate`, `docs` e Gitleaks verdi sulla testa `0c0deaa2`. Claude conferma il GO del codice; la suite locale completa termina con exit **0**, **3.197 casi, 3.187 passati, 0 falliti e 10 skip dichiarati**, in 61 gruppi. I 117 file della candidata sono verificati immutati durante la revisione. La [run #1010](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42522435141), scope `hosting`, termina con successo dopo attesa production e personale approvazione di Diego. Nessun deploy dal PC, workflow o backend modificati.

**Produzione:** manifest `sourceDirty:false`, versione 1.2.264 e sorgente `70b9618c`; tutti i **324 file** corrispondono al tree **`252a2b9ae092b3cd6239cba7bd21927050c6326e6228741cce676eb4b5d480ff`**. Restano sei riscontri 404 sui tre percorsi ritirati, con/senza cache-bust. Header e CSP sono verificati; il modulo nuovo usa ora la stessa cache `no-cache, no-store, must-revalidate` degli altri script. Confronto automatico integrale delle **47 Functions** e delle Rules: sorgente, configurazioni, digest, timestamp e identificativi invariati. Il rilascio è avvenuto alle **21:06:26 UTC** dell'08/11/2026.

Il probe browser sui moduli realmente pubblicati passa **14/14**, compreso lo scaricamento completo dei byte del file a blocchi e zero residui temporanei. Controlla anche download protetti, anteprime ammesse, rifiuti di formato e viewer portabile generato dagli asset pubblicati. È una prova client con contenuti sintetici: i chunk arrivano dalla RAM del banco, non da Storage, e non dimostra il protocollo condiviso Auth/App Check. Nessun collaudo a 512 MiB, misura di memoria costante o prova fisica mobile è attestato. La verifica conclusiva di Claude, in sola lettura delle ricevute, conferma pubblicazione e correzione; non interroga indipendentemente le API e non ripete il confronto automatico di ogni metadato.

**Gate residuo e cleanup:** il distinto test a due utenti resta bloccato dall'attestazione del secondo partecipante. Le due identità sintetiche nuove autorizzate sono eliminate dopo chiusura dei browser; entrambi gli utenti Auth e gli **otto percorsi esatti** censiti risultano assenti, senza Account, inviti o oggetti Storage creati. Rimossi anche i due file DPAPI dedicati; QA2 e dati reali sono esclusi da ogni operazione. Nessuna cancellazione per prefisso, di ledger o lock. Claude conferma che il criterio condiviso completo e la cornice rimangono **aperti/sospesi**: il GO del rilascio non li chiude. La PR #271 resta in bozza e non distribuita; un futuro rilascio richiederà riallineamento a master, nuovi check e una distinta decisione CI. Le presenti ricevute sono integrate con una PR soltanto documentale, senza cambiare il sorgente dell'app pubblicata.

<a id="rilascio-storage-403-1-2-262"></a>

## Pubblicazione 1.2.262 — Storage 403 e documentazione, 08/11/2026

Base locale `6b400ddb38b96962ccda70bf4bd9f1fab476edb8`, sorgente della produzione 1.2.261 `eab609be3a7e9a13514562724888ea73c7af2ece`. Il delta iniziale di dieci file è preservato fuori OneDrive, insieme al bundle completo dei riferimenti e all'archivio verificato di 1.387 file del precedente worktree di sicurezza. I singoli frammenti delle ricevute 1.2.261 sono ripristinati da HEAD nei sette MD interessati, conservando le nuove note amministrative e Storage; non vengono presentati come una nuova pubblicazione. Versione e riferimenti asset sono allineati a 1.2.262 e il catalogo guida è riesaminato: la correzione Rules non modifica controlli o passi dei walkthrough.

La revisione indipendente delle Rules e della matrice di sedici combinazioni non rileva ampliamenti degli accessi: restano UID, recovery fence, purge lock, formato cifrato e limiti del file. La lettura guest con tre documenti distinti è un limite separato. Lo scope backend del workflow seleziona anche 43 Functions e Firestore Rules invariati; Hosting segue sullo stesso SHA. La prova sintetica delle Rules API riportata sotto è completata dalla prova SDK sulle Rules effettivamente pubblicate descritta negli esiti finali.

La prima suite completa si ferma su `firestore.profile-widgets.rules.test.mjs`: la fixture `received-1` viene cancellata dalla suite parallela `archive-purge-global-lock.rules.test.mjs`, che condivideva lo stesso project ID ed eseguiva `clearFirestore()` prima di ogni caso. La diagnosi indipendente conferma la collisione; alla sola suite purge-lock viene assegnato un database emulato esclusivo, preservando test e asserzioni. Firestore Rules restano identiche alla produzione. La riesecuzione completa termina con codice **0**, **3.161 test: 3.151 passati, 0 falliti, 10 skip**, raggiungendo l'ultimo gruppo `test:account-standard-emulators`; il primo esito fallito è conservato. Log finale SHA-256 `ca45a991e833dd85b1124da0629676be14020b1279c9d879adfcfd71d60ba382`.

Controlli aggiuntivi: versione coerente con 266 riferimenti, documentazione con 34 MD e 705 collegamenti locali, 12/12 test documentali, `git diff --check` valido. Gitleaks sulla cronologia di tutti i riferimenti locali esamina **1.622 commit** e non rileva nuovi segreti, conservando soltanto le dodici eccezioni storiche individuali censite. Il riesame esatto dei blob conferma 109 file pubblici modificati soltanto dal bump, nessun aggiornamento di dipendenze e nessun diff in workflow, script, Functions, Firestore o configurazione Firebase. Graphify è aggiornato solo per il codice, senza estrazione semantica e senza includere i suoi artefatti nel rilascio.

La lettura cloud precedente al rilascio, **08/11/2026 10:34:15 UTC**, attesta 47 Functions attive, Hosting 1.2.261 sorgente `eab609be`, Firestore hash `12957526a5ce6255ab2358c60cd83fcd6c90c45a96fab4c61599523c1e890bc7` e Storage ancora `97fb854cf4c52fe20b586d0cc183ffe88173154397f412590912dc70c0218694`. Nuove run, pubblicazione e prova QA non sono ancora eseguite.

L'archivio e il bundle sono verificati. Il controllo automatico ha rifiutato due volte il ritiro dei vecchi riferimenti per assenza di consenso specifico alla cancellazione. Diego risolve scegliendo esplicitamente **«Conserva i vecchi rami e pubblica»**: restano i tre rami locali/remoti `codex/complete-recovery`, `codex/release-1.2.261-receipts`, `codex/release-security-1.2.261`, il worktree `.codex-tmp/security-closure-20261107` e il suo ramo locale. Il preflight mantiene exit **1** e tutte le segnalazioni effettive relative a questi riferimenti e a Dependabot #268; nessuna esclusione è aggiunta al controllo e nessuna cancellazione è avvenuta. Ogni ulteriore anomalia resta bloccante.

La nuova lettura remota del **08/11/2026 14:00:24 UTC** conferma la stessa produzione 1.2.261, gli stessi hash Rules e 47 Functions attive. Il ramo `master` è ancora `6b400ddb`, la candidata pubblicata su GitHub è `470b1590`, e Dependabot #268 è aperta sullo SHA preservato. Queste letture non attestano ancora un deploy della 1.2.262.

**Esecuzione finale:** [PR #269](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/269) integrata in **`ef7cae863756ffa0ad97a2aff2cba8c8c290ab17`**, dopo `validate`, `docs` e `Gitleaks on changed commits` verdi. Sul medesimo sorgente sono riuscite la [run backend 42496064235](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42496064235), scope `recovery-prerequisites-disabled`, e la [run Hosting 42505080699](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42505080699). Entrambe si sono fermate su `Waiting for review`: le API registrano l'approvazione dell'account `Diego-Stack-ai`; la sessione documenta il clic personale di Diego. Gli agenti hanno soltanto predisposto il modulo, senza inviare l'approvazione. Non è stato eseguito alcun deploy dal PC.

**Backend:** il confronto indipendente rileva 47 Functions `ACTIVE`, sorgente, opzioni, digest di ambiente e riferimenti ai segreti invariati. Tutte le 43 Functions selezionate hanno un nuovo timestamp di aggiornamento; le quattro escluse sono identiche alla baseline. Firestore resta all'hash `12957526a5ce6255ab2358c60cd83fcd6c90c45a96fab4c61599523c1e890bc7`; Storage corrisponde al commit approvato, hash **`bfa041c9acdf18d9bef11bc71f1c5976b15ea35225934d64fefea4f5109f94c5`**. Policy recovery `disabled`, coorte vuota e flag client falso restano verificati. Hosting non cambia durante il backend; la successiva run Hosting non cambia Functions o Rules.

**Prova reale SDK QA:** autenticazione in memoria sulla sola identità sintetica già delegata, lock QA assenti, 48 byte casuali cifrati AES-GCM con chiave soltanto in RAM. Upload, metadati, download, confronto dei byte e decifratura riescono; la cancellazione riesce e la successiva lettura restituisce `storage/object-not-found`. Lettura anonima e scrittura autenticata in un namespace fittizio estraneo sono respinte con `storage/unauthorized`. Cleanup completo, nessun dato reale, file dei codici o nuova identità utilizzati. Questo conferma il contratto Storage del proprietario nel caso provato: non è una prova della UI, della registrazione Firestore dell'allegato, del wrapping della chiave dell'app, del protocollo guest o dell'attestazione App Check. I lock rilasciati sono coperti dalle prove sintetiche, non da questa prova produttiva con lock assenti.

**Hosting:** release `1794160235784000`, versione `381d2fd7f00b5269`, pubblicata **08/11/2026 alle 18:50:35 Europe/Rome**. Manifest **1.2.262**, `sourceDirty: false`, sorgente **`ef7cae86`**, **326 file**, albero pubblico SHA-256 **`8402a54fbdfa5ebab8783bb60e990b164da553303532a610131f5a0813465e08`**. Sia il workflow sia il controllo indipendente confrontano tutti i byte pubblici, non soltanto il numero versione. Verificati anche redirect legacy, rewrite `/home`, CSP e cache; un controllo separato confronta cinque header di sicurezza e la cache su sei URL rispetto alla configurazione dello SHA distribuito.

**Protezioni e credenziale CI:** dopo il rilascio restano revisore obbligatorio Diego, bypass amministratore spento, self-review consentita e solo `master`; ruleset attivo, bypass vuoto e tre check GitHub Actions obbligatori. La UI conferma zero segreti repository e il solo `FIREBASE_TOKEN` nell'environment. I due deploy riusciti ne confermano l'uso CI effettivo senza esporne il valore. Rami/worktree conservati secondo l'ordine esplicito; Dependabot #268 rimane separata sullo SHA richiesto. Ricevute tecniche in `.codex-tmp/storage-403-release-20261108/`, esclusa da Git. I commit documentali successivi conservano queste evidenze senza sostituire lo SHA pubblicato o richiedere un altro deploy.

<a id="credenziali-agenti-2026-11-08"></a>

## PAT locale limitato, revoca OAuth e app GitHub — 08/11/2026

Diego autorizza il PAT **Agenti App-Codici-Password**, identificativo non segreto `22582985`, e la sostituzione delle credenziali locali. La pagina finale GitHub conferma: scadenza **6 febbraio 2027**, solo repository `Diego-Stack-ai/App-Codici-Password`, nessun permesso utente, lettura di Actions/Commit statuses/Metadata e scrittura di Contents/Pull requests. Non sono concessi Administration, Deployments, Environments, Secrets o Workflows. Il token non viene mostrato nei risultati o scritto in chiaro nei file del progetto; il trasferimento locale usa cifratura effimera e il salvataggio finale è nel keyring Windows.

Verifica dei soli metadati: account attivo corretto e keyring confermati; Git usa il helper `gh auth git-credential` preceduto dal reset della catena; vecchio account GCM e slot legacy assenti. Il helper è globale per GitHub/gist, quindi gli altri repository GitHub risentono dei limiti del nuovo PAT. I GET `/actions/secrets` e `/actions/permissions` del repository restituiscono **403**. Lettura dell'identità e del remoto pubblico riuscite; non è stato eseguito un push di prova e la lettura di risorse pubbliche non certifica i permessi di scrittura. La ricevuta senza valori segreti è in `.codex-tmp/github-limited-credentials-20261108/verification.json`, esclusa da Git.

Con successiva autorizzazione esplicita vengono revocati nella UI GitHub anche i grant OAuth **GitHub CLI** e **Git Credential Manager**. La lista OAuth passa da sei a quattro voci e non contiene più quelle due app. Non viene dichiarata una prova negativa con copie dei vecchi token, non conservate. Questo è distinto dalla revoca Google Firebase CLI già verificata nel passo 2. La pagina sicurezza mostra app Authenticator e GitHub Mobile configurati come metodi 2FA; nessuna lettura di password, seed o codici di recupero.

Diego conserva Claude, nega Cursor e richiede poi la rimozione anche di Jules. Alla successiva scelta del perimetro conferma esplicitamente **«Mantieni tutti i repository»** per Claude: la configurazione già verificata coincide con l'ordine, senza nuove modifiche dell'installazione. Codex revoca le autorizzazioni personali di Cursor e Jules. Le conferme native di disinstallazione non sono gestibili dall'automazione; Diego le completa e Codex rilegge il provider. Stato finale verificato:

- **Installed GitHub Apps:** soltanto ChatGPT Codex Connector e Claude; Cursor e Google Labs Jules assenti.
- **Authorized GitHub Apps:** ChatGPT Codex Connector, Claude, Copilot Pull Request Reviewer e Copilot SWE Agent; Cursor e Jules assenti.
- Nessun aumento dei permessi Cursor accettato. Nessun accesso al sito Jules o cancellazione di sue attività/archivi eseguiti.

La separazione del PAT locale è completata nel perimetro concordato, non è isolamento totale: il connettore Codex conserva accesso a due repository selezionati e Claude a tutti i repository, con permessi propri inclusa scrittura dei workflow. Questi canali e la sessione browser richiedono decisioni distinte; nessuna approvazione di deploy viene inviata dagli agenti. Applicazione, workflow e Firebase restano invariati da questo lotto; nessun commit, push, merge o deploy avviato.

<a id="dependabot-2026-11-08"></a>

## Abilitazione Dependabot alerts e security updates — 08/11/2026

Stato iniziale letto dal provider: alerts disabilitati (HTTP 404 esplicito), security updates `enabled: false`, `paused: false`, auto-merge repository `false`; nessun file `dependabot.yml`/`.yaml` nella `.github` remota. Abilitati in sequenza alerts e security updates tramite gli endpoint dedicati, senza modificare workflow o file di dipendenze.

Nuove letture indipendenti confermano:

- alerts **abilitati**, HTTP **204**;
- security updates **abilitati**, `paused: false`, con `security_and_analysis.dependabot_security_updates.status: enabled`;
- version updates **non configurati**, entrambi i nomi del file assenti nel ramo remoto `master`;
- auto-merge **disabilitato**, nessun automatismo di merge trovato nei workflow/script esaminati.

Il revisore indipendente censisce manifest e lock npm root e `functions/`; i manifest Frontend dei moduli assistant/settings contengono soltanto `type: module`. Le librerie browser sono gestite dal manifest root e i loro bundle vendorizzati richiedono ricostruzione/verifica nelle relative PR. Il rapporto tecnico senza segreti è in `.codex-tmp/dependabot-20261108/verification.json`, escluso da Git. Nessuna dipendenza aggiornata o PR unita dagli agenti, nessun deploy avviato. Il riscontro attesta la configurazione, non una scansione esaustiva né l'assenza di vulnerabilità.

Al censimento successivo risultano **cinque alert aperti**, tutti transitivi del lock root classificati development: due su `@grpc/grpc-js`, uno ciascuno su `minimatch`, `qs` e `uuid`. Le versioni del lock Functions sono fuori dai rispettivi intervalli affetti; il gRPC individuato appartiene al runtime Node, non al bundle browser. L'analisi statica non dimostra sfruttamento nell'app; la classificazione development non elimina il rischio sul PC o in CI. È già aperta la [PR #268](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/268), head osservata `59733f5f`, con modifica del solo lock root, `qs` a 6.16.2, aggiornamenti Express/MCP e check docs/Gitleaks/validate riusciti. Copre il solo alert qs, non gli altri quattro. Nessun merge o aggiornamento delle dipendenze è eseguito da questo censimento.

<a id="master-ruleset-2026-11-08"></a>

## Check obbligatori del ruleset Protezione master — 08/11/2026

Il ruleset repository `22926664`, creato l'11/09/2026, esisteva già ed era attivo. La vecchia API branch protection restituisce 404, mentre `/rules/branches/master` conferma l'applicazione del ruleset: non è stata creata una nuova protezione o un duplicato. La revisione indipendente dei workflow conferma `docs` e `Gitleaks on changed commits` su ogni `pull_request`, senza filtri di percorso o ramo e senza condizioni al job; i check reali osservati provengono da GitHub Actions (`integration_id: 15368`).

Aggiornata soltanto la lista `required_status_checks`, aggiungendo i due contesti a `validate` e vincolandoli alla medesima app. Una nuova lettura del ruleset e delle regole effettive del ramo conferma tutti e tre i check. Il confronto integrale dei campi scrivibili prima/dopo verifica **nessun'altra modifica**: Active, bypass vuoto, target ramo predefinito, esclusioni vuote, blocco eliminazione e force push, PR con zero approvazioni, metodi di merge e tutte le altre opzioni conservati. Le copie tecniche senza segreti sono in `.codex-tmp/master-protection-20261108/`, escluse da Git.

Nessun workflow, commit, push, token o deploy avviato. Non sono stati tentati force push, eliminazioni di ramo o merge per verificare il blocco: l'evidenza è la configurazione effettiva letta dal provider. Al termine di quel passo la separazione degli accessi restava un'attività successiva; il passo 5 è ora documentato nella ricevuta precedente.

<a id="production-secrets-2026-11-08"></a>

## Ambiente production e rotazione dei segreti CI — 08/11/2026

Letture API iniziali: ambiente `production` esistente, revisore `Diego-Stack-ai`, auto-approvazione consentita, solo branch `master`, bypass amministratore attivo; nessun environment secret, due repository secrets (`FIREBASE_TOKEN` e `FIREBASE_SERVICE_ACCOUNT_APPCODICI_PASSWORD`), nessun workflow in corso o in coda. La revisione indipendente conferma che soltanto il job `deploy`, già legato a `production`, usa `FIREBASE_TOKEN` e non trova utilizzatori del segreto service account nei workflow/script esaminati. Master remoto è rimasto `6b400ddb38b96962ccda70bf4bd9f1fab476edb8`.

Eseguiti nell'ordine richiesto:

1. `can_admins_bypass` impostato a `false`; nuova lettura conferma revisore, auto-approvazione consentita e unica regola `master` di tipo `branch` conservati.
2. Rimosso nell'account Google proprietario il collegamento **Firebase CLI**. Scambio OAuth del refresh token locale precedente respinto con HTTP 400, `invalid_grant`; stessa verifica negativa ripetuta dopo la creazione della nuova credenziale CI.
3. Nuova autorizzazione con il flusso ufficiale del Firebase CLI installato, verifica dell'identità e del ruolo proprietario sul progetto, trasferimento del refresh token soltanto in RAM/stdin a `gh secret set --env production`. Il valore CI non viene stampato, scritto nel repository o nei rapporti, né copiato negli argomenti del processo. Metadata GitHub confermano `production/FIREBASE_TOKEN` creato il 08/11/2026.
4. Solo dopo quel riscontro, eliminati i due repository secrets. Lettura finale: **zero repository secrets**, **un environment secret**, `FIREBASE_TOKEN`.
5. Nuova autorizzazione separata e ripristino del login locale nel normale archivio credenziali del Firebase CLI. Un processo successivo legge con successo i metadati di `appcodici-password`.

Nessun workflow, codice applicativo, Rules, dato Vault o chiave del service account Google Cloud modificato da questa operazione; nessun deploy e nessuna approvazione di deploy inviati. Il primo utilizzo del token CI sarà attestato nel prossimo rilascio autorizzato. Gli stati tecnici privi di valori segreti sono conservati in `.codex-tmp/github-production-secrets-20261108/`, esclusi da Git. Il PAT locale successivo non dispone di Deployments in scrittura; restano separati gli altri canali del revisore, descritti nella [procedura](../regole/RILASCIO.md#production-protection-2026-11-08).

<a id="upload-storage-403-2026-11-08"></a>

## Upload Storage negato — diagnosi e candidata locale 08/11/2026

Questa sezione conserva la diagnosi precedente al rilascio. La correzione è poi pubblicata e collaudata nella [1.2.262](#rilascio-storage-403-1-2-262), con i limiti indicati nella relativa ricevuta.

- Segnalazione: `403 Forbidden` su un upload Account privato, confermato dall'utente con un file di prova. Due prove indipendenti con l'identità QA già autorizzata e 128 byte casuali producono `storage/unauthorized`; il corpo HTTP contiene soltanto `Permission denied.`. Nessun oggetto viene creato; nessun file reale o codice di recupero viene letto o inviato dagli agenti.
- Metadati cloud: Rules Storage online e sorgente distribuito hanno hash LF `97fb854cf4c52fe20b586d0cc183ffe88173154397f412590912dc70c0218694`; service agent Storage con ruolo `roles/firebaserules.firestoreServiceAgent` senza condizioni; App Check Storage `UNENFORCED`. Per l'UID segnalato il recovery lock è assente e il purge lock è `released`, schema 1 e proprietario corrispondente. Nessuna configurazione, lock o dato reale viene modificato.
- Candidata: un solo `firestore.get` per lock e rimozione del richiamo recovery ridondante dal helper purge, sempre preceduto da `isOwner`. Le condizioni di rilascio e il digest recovery restano identici. Nessun allentamento di autenticazione, isolamento UID, cifratura, limiti o fence.
- `npm run test:storage-rules`: **26/26**, nessun fallimento/skip (3 dispatcher, 18 Rules produttive e 5 prototipo). Il nuovo caso comprende 16 combinazioni recovery/purge: assente, rilasciato, attivo e malformato.
- Verifiche aggiuntive: `test:security` **45/45** e audit statico verdi; `test:docs` **12/12**, elenco invariato di **34 Markdown** e 679 collegamenti locali validi. `git diff --check` non rileva errori di spaziatura. La revisione indipendente del delta non individua ampliamenti degli accessi; conferma che tutti i callsite purge mantengono prima il recovery fence di `isOwner`.
- Simulatore ufficiale Rules API con source candidata e soli mock sintetici: **5/5**; lock assenti o rilasciati consentono con esattamente due lookup; lock attivi, malformati e lookup in errore negano. Hash LF candidata `bfa041c9acdf18d9bef11bc71f1c5976b15ea35225934d64fefea4f5109f94c5`. Il rapporto tecnico locale e il delta documentale preesistente sono conservati sotto `.codex-tmp/attachment-upload-20261108/`, esclusi da Git.

Limiti: la risposta produttiva non rivela la condizione esatta negata. Il motore locale non applica il limite produttivo delle due letture cross-service ([segnalazione Firebase](https://github.com/firebase/firebase-tools/issues/11167)); i mock cloud non provano IAM, cache e accesso reale. La candidata elimina la dipendenza dalle consultazioni ripetute per le mutazioni owner, ma resta da pubblicare nel percorso controllato e ripetere l'upload QA prima di dichiarare risolto il `403`. Il percorso di download guest consulta tre documenti distinti (lock owner, ACL Account, lock guest): è un rilievo separato da approfondire, non risolto né attestato dal verde dell'emulatore. Nessun commit, push o deploy effettuato in questo lotto.

<a id="pubblicazione-sicurezza-1-2-261"></a>

## Pubblicazione verificata 1.2.261 — 08/11/2026

PR [#266](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/266), commit candidato `d313d83d0ed2d12aa308a7c4fac64ee4d2c335e2`, integrata nel sorgente distribuito **`eab609be3a7e9a13514562724888ea73c7af2ece`**. Documentazione, Gitleaks e validazione PR sono verdi; quest'ultima è la run [42431518645](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42431518645), job `128581259671`. Suite completa su PC e GitHub: **3.160 casi, 3.150 passati, 0 falliti, 10 skip dichiarati, 0 cancellati**, aggregati da 61 riepiloghi coerenti. Anche le due prove browser Ricerca e il runner portabile sono stati ripetuti sulla 1.2.261 con esito positivo. Il primo tentativo locale si era fermato sul catalogo guida ancora marcato 1.2.260; il catalogo è stato riesaminato, allineato e l'intera suite è stata rieseguita.

- **Backend:** run [42432143000](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42432143000), validazione `128583173239`, deploy `128585734571`, tutti riusciti. Pubblicazione conclusa alle **02:11:08 Europe/Rome**; nessuna conferma retry richiesta (`retryConfirmationSent: false`). Il controller conserva i soli quattro retry già approvati e il controllo della cleanup policy esistente.
- **Confronto indipendente backend**, alle **02:12:31 Europe/Rome**: censimento esatto di **47 Functions ACTIVE**, 43 hash sorgente aggiornati, quattro Functions escluse identiche al precedente censimento anche per aggiornamento/configurazione. Runtime, memoria, timeout, istanze, concorrenza, ingress, service account, policy retry, digest di ambiente e riferimenti Secret Manager sono conservati. Gli hash endpoint non sono SHA Git.
- **Rules:** contenuto Firestore normalizzato LF uguale al sorgente, SHA256 `12957526a5ce6255ab2358c60cd83fcd6c90c45a96fab4c61599523c1e890bc7`; Storage invariato e conforme, SHA256 `97fb854cf4c52fe20b586d0cc183ffe88173154397f412590912dc70c0218694`.
- **Hosting:** run [42433256107](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42433256107), validazione `128586569251`, deploy `128588831084`, tutti riusciti sul medesimo SHA. Deploy concluso alle **02:23:26 Europe/Rome**, verifica pubblica della CI alle **02:23:34**. Manifest schema 2, versione **1.2.261**, sorgente pulito, **326 file di payload**, SHA256 **`e79f2f1c736fd95b430d2aa4cf2261bdc73c3c82aec8b4273c722b146a55a815`**; 327 file caricati includendo il manifest.
- **Verifica indipendente finale**, dalle **02:24:48 Europe/Rome**: release/versione/SHA e tutti i 326 asset, redirect, rewrite, cache e CSP conformi tramite il verificatore di rilascio. Functions identiche al censimento post-backend dopo Hosting; policy FULL `disabled`, coorte vuota e flag client falso confermati nel sorgente attestato.

La release Hosting corrente è **1794101005467000**, versione **11355292794315f6**; il predecessore effettivo 1.2.260 è **1793982864613000**, versione **815734a047aad8c1**, rilevato prima del deploy. Gli identificativi più antichi nei checkpoint precedenti non sono il predecessore di questa pubblicazione. Nessun rollback eseguito; un eventuale ritorno non deve riaprire il namespace inviti o ripristinare il visualizzatore vulnerabile.

I 147 file testuali locali con CRLF sono stati confrontati con i blob Git e riallineati ai medesimi byte LF: nessuna differenza di contenuto Git introdotta; il manifest locale coincide con quello Linux della CI. Log e snapshot di metadata sono negli artefatti locali riservati esclusi dal Git. Le ricevute documentali vengono committate dopo entrambe le run per conservare il vincolo di SHA su `master`.

Limiti: nessun nuovo collaudo autenticato con utenti reali, prova Push/SMTP, canary FULL, drain, migrazione o chiusura F2/F3; restano i gate fisici e gli altri lavori del [PROGRAMMA](../progetto/PROGRAMMA.md#chiusura-e-priorita-2026-11-07). Il rilascio non implementa la shell RAM. Le copie HTML portabili esportate in precedenza mantengono il proprio codice: per ottenere l'anteprima corretta occorre esportarne una nuova dalla 1.2.261.

<a id="sicurezza-candidata-2026-11-07"></a>

## Candidata locale di sicurezza — 07/11/2026

Prove eseguite sul worktree isolato, senza utenti reali, invii SMTP o modifica cloud:

- Rules Firestore nell'emulatore: **94/94**, nessun fallimento/skip, inclusi namespace v2, squat storico, contesti owner/azienda, creazione atomica e compatibilità legacy.
- `npm run test:navigation`: **198/198** e audit di navigazione/pagine canoniche verdi. L'asserzione obsoleta sulla forma del delete è stata sostituita da controlli su discovery proprietario/risorsa e revoca dei soli snapshot posseduti.
- Cache: **56/56** sui cinque file mirati, con due regressioni fallite prima della patch e controlli positivi su proprietario e destinatario offline. Il nuovo helper ha tre prove proprie ed è incluso nel gate navigazione.
- Ricerca: **7/7** prove controller e **2/2** prove browser del DOM reale, inclusi lock, UID, nuovo sblocco, decifratura/preparazione tardive, archiviazione e continuazioni del microfono; il gate Ricerca preesistente passa **17/17**.
- Archivio portabile: **21/21** e runner browser verde. HTML/XML passivi, XHTML senza anteprima attiva, SVG tramite immagine, PNG/PDF/WAV, testo limitato e download completo, cancellazione/supersessione e revoca degli URL. OPFS fisico oltre 16 MiB e riproduzione video su dispositivo restano da provare.
- Budget provider: **77/77** nella suite mirata; attacco riprodotto prima della patch con 12 scadenze/12 invii allo stesso destinatario. Fixture di concorrenza transazionale, non invii reali.
- `npm run test:functions-security`: sintassi ed ESLint verdi, **565 casi: 555 pass, 0 fail, 10 skip** di prove emulator-specifiche non attivate da questo comando. Non si deduce che siano state eseguite.
- `npm run test:security`: audit e **45/45**. Sintassi frontend: **230 moduli**. Il bundle backend supera `node scripts/build-vault-account-backend.mjs --check`.

Un primo avvio dell'emulatore confinato non ha aperto la porta loopback; il successivo avvio locale autorizzato ha eseguito le Rules. Il controllo sintattico diretto Node/CommonJS dei file browser ESM non è applicabile: il gate Babel di progetto è quello eseguito. Functions non espone uno script `npm test`; è stato usato il gate radice `test:functions-security`.

Controllo documentale: **34 Markdown, 673 collegamenti, 12/12**. Il revisore della patch e il parere statico limitato di Claude non hanno lasciato altri rilievi supportati nei rispettivi perimetri. Il gate performance ha inizialmente rilevato l'incremento dei controlli di sicurezza: è documentata un'eccezione circoscritta per un modulo puro aggiuntivo (massimo 47) e per i due limiti di pagina (profilo 344 KB, form azienda 340 KB; misurati 343,3 e 339,2 KB). Il tetto generale di 338 KB e gli obiettivi runtime restano quelli precedenti.

Nessuna nuova versione o pubblicazione attestata da queste prove. La navigazione multipagina con richiesta di Master Password resta da sostituire con la shell RAM.

## Pubblicazione verificata 1.2.260 — 06/11/2026

Le PR #263 e #264 portano al sorgente pubblicato **`a392b9c80e006dcce50c724cad232020194500e2`**. La PR #264, la run backend **42250314439** e la run Hosting **42252368644** hanno gate verdi; quest'ultima esegue **3.126 casi: 3.116 passati, 0 falliti, 10 skip dichiarati, nessuna cancellazione**. Hardening 32/32 e documentazione 12/12 sono inclusi. Le run manuali ricontrollano credenziale storica, scansione completa, versione, manifest e SHA di master; nessun deploy diretto dal PC.

- Backend: deploy del job **128008344616** concluso con successo alle **16:24:30 UTC**, con 41 aggiornamenti, due creazioni e pubblicazione delle Rules Firestore/Storage. La sola conferma nativa prevista è ricevuta dal controllore vincolato, senza `--force`; Hosting è escluso dalla run.
- GET indipendenti alle **16:25:34 UTC**: censimento esatto di **47 Functions**, 43 prerequisiti ACTIVE con hash aggiornati, opzioni precedentemente catturate conservate per i 41 esistenti e quattro export esclusi invariati. Le nuove callable `manageFullVaultRecovery` e `readRecoveryBackupAsset` hanno Node.js 22, `europe-west1`, 512 MiB, concorrenza 1, massimo un'istanza e timeout 120 s. I sei controlli passano; gli hash delle Rules corrispondono al sorgente M2 dopo sola normalizzazione LF. Gli hash endpoint includono configurazione/ambiente e non sono SHA Git; il vecchio censimento non catturava concorrenza e massimo istanze dei writer esistenti. ACTIVE e revisione corrente non provano il drain delle invocazioni precedenti.
- Hosting: job **128014638234**, deploy concluso alle **16:34:25 UTC** e verifica remota riuscita alle **16:34:36 UTC**. Manifest schema 2, versione **1.2.260**, SHA **`a392b9c8`**, sorgente pulito, **325 file di payload** e hash **`4a117f4ad67a2435e70c6f81cc14cfa4b654f06f843c877875d731c130e506b2`**. Hosting carica 326 file includendo il manifest; la verifica confronta tutti i 325 hash, redirect, rewrite, cache e CSP.
- GET pubblici indipendenti alle **16:35:12 UTC**: stessa versione, SHA e hash CI; modulo client con `COMPLETE_RECOVERY_ENABLED = false`; `/favicon.ico` risponde **200 image/x-icon**, magic bytes ICO e hash atteso **`5034f662cbc8daf34cb9c610a8e6037f50f9a495988020247c168aa812f471cf`**. Nessun nuovo collaudo autenticato viene dedotto da queste letture.

I log effettivi e il report cloud sono conservati negli artefatti privati gestiti. La ricevuta Hosting precedente identifica release **1793955523972000**, versione **0321154d29c61fee**, del 06/11/2026 08:58:43.972 UTC; nessun rollback è stato eseguito. Recovery resta disabilitato con coorte vuota e flag client falso. Nessun canary, scrittura recovery, wipe/rotazione QA2, migrazione, prova Auth/App Check produttiva o chiusura F2/F3 è derivata dalla pubblicazione.

## Prima pubblicazione 1.2.260 e conferma retry circoscritta — 06/11/2026

La PR #263 supera GitHub con **3.108 passati, 0 falliti e 10 skip dichiarati** ed è integrata in `faef0091`. La run manuale backend `42241548534` supera suite, versione, manifest, scansione e controllo provider; il deploy si ferma sulla conferma richiesta dal Firebase CLI per i retry dei quattro trigger già nel sorgente. GET successivi confermano 45 Functions con identità/hash/configurazioni invariati, due nuove callable assenti e Rules ancora identiche a `16c94c24`. Il primo tentativo di lettura nel sandbox restituisce HTTP 500; il successivo GET autorizzato fuori sandbox riesce. Nessun dato applicativo è letto o scritto.

La correzione del rilascio usa il CLI ufficiale `--interactive`, senza `--force`: il controllore invia un solo `y` dopo l'avviso completo con i quattro nomi e `europe-west1` e la domanda esatta. Elenchi mancanti/aggiuntivi, regioni diverse, qualsiasi altra domanda, seconda conferma o input arbitrario vengono rifiutati. Prima del deploy un GET verifica la cleanup policy/opt-out già presente; la policy osservata è a 30 giorni e non viene modificata. Le prove includono l'effettivo prompt del Firebase CLI con endpoint sintetici, frammentazione ANSI/pipe e rifiuto di prompt reali inattesi, senza chiamate cloud. La revisione indipendente ha riprodotto due transcript sintetici accettati erroneamente: suffisso arbitrario dopo la domanda e domanda estranea precedente nello stesso chunk. Il parser ora verifica il framing completo e tutte le domande prima di rispondere; le relative regressioni passano. È corretta anche la decodifica UTF-8 per canale: un marker di completamento diviso fra chunk non può nascondere una seconda conferma. Il riesame finale non lascia rilievi aperti nel perimetro. Il gate di hardening con Gitleaks reale passa **32/32 senza skip**. Una corsa precedente della fixture subprocess ha avuto un timeout; la prova isolata e il gate completo successivo passano. Il runtime applicativo, Functions e Rules sono identici a `faef0091`. Non si disabilitano i retry necessari alla propagazione dei fence; i ledger presenti non garantiscono l'assenza assoluta di duplicati dopo invii esterni incerti.

## Collegamento produttivo recovery 1.2.260 — preparazione locale, 06/11/2026

Questo delta segue il lotto formato/UI/laboratorio riportato sotto. Le due callable sono ora registrate nel sorgente, ma policy server `disabled`, coorte vuota e flag client `false` impediscono ogni attivazione. Nessuna prova usa dati reali o modifica Firebase. Il wrapper vincola UID, e-mail verificata, autenticazione recente, provider password e App ID, rinvia la costruzione degli SDK e rifiuta progetto/database/bucket o endpoint diversi. Errori tipizzati serializzati con il vero `HttpsError`, limiti di capacità e opzioni delle Functions sono verificati localmente.

La revisione indipendente ha rilevato due difetti concreti, entrambi riprodotti prima della correzione: gli alias SDK `apiEndpoint`/`universeDomain` potevano eludere il vincolo Firestore; il conteggio client dei metadati ometteva parentesi e virgole dell'array. La prova completa del secondo difetto ha prodotto un backup di 3.000 record e 2.999 allegati accettato dal lettore, ma rifiutato dal server (2.100.152 byte contro 2.097.152). Il controllo condiviso del writer e del lettore ora conta l'intero array UTF-8; il limite server resta invariato. Le regressioni dei due casi sono verdi. Il protocollo Firebase reale su HTTP loopback conserva i motivi di errore: la prima prova nel sandbox falliva prima di raggiungere il servizio, il rerun locale autorizzato fuori sandbox passa. Questa fixture verifica il protocollo, non l'autenticazione cloud della piattaforma.

Il contratto canary in sola lettura censisce 41 writer precedenti più due nuove callable, Firestore Rules e Storage Rules, escludendo quattro export estranei, Hosting e indici. La suite rifiuta writer aggiunti/rimossi, attivazione della policy o flag client e configurazioni alternative. Il bundle backend viene confrontato con i sorgenti. Il workflow già pubblicato resta Hosting-only. La candidata locale prepara nello stesso file la scelta manuale fissa `recovery-prerequisites-disabled`, alternativa a Hosting e mai predefinita: stessi gate di validazione/SHA/master, ambiente production e concorrenza esclusiva. Il comando deriva i 43 selettori dal contratto verificato, esclude Hosting/indici, nel primo tentativo usa `--non-interactive` e non usa `--force`; la correzione circoscritta è descritta nella sezione precedente. La fixture rifiuta modifica del default, attivazione automatica, ambiente alternativo, selector generico e bypass dei controlli. Dopo la suite integrale sono cambiati soltanto questi tre file di rilascio (workflow, planner, fixture); il relativo gate finale passa **24/24 senza skip**. Il runtime applicativo della suite completa non è cambiato. Account dedicato, autorizzazione al rilascio cloud, inventario delle revisioni e drain restano gate aperti, non risultati già acquisiti.

Gli avvisi `MaxListenersExceededWarning` sono stati approfonditi con la prova publisher reale: cinque distinti corpi HTTP delle dipendenze partecipano a pipeline sovrapposte, con picchi 12 listener `error` e 11 `close`. Al successivo idle, dopo quattro turni GC, tutti e cinque risultano raccolti. Non si alzano limiti né si sopprimono avvisi; la prova non certifica un runtime caldo di produzione contro ogni perdita di memoria. Le misure ripetute su successo/errore, socket, heap e corpi trattenuti restano nel gate canary. Evidenze e riproduttori sono conservati nella raccolta privata Codex Security.

La regressione integrale del nuovo delta termina con **codice 0**: `GITLEAKS_REQUIRED=1 npm test`, Node 24.22.1, **3.117 casi: 3.107 passati, 0 falliti, 10 skip dichiarati**. Risultati rilevanti: backup 205/205; Functions 548 passati e 10 skip che richiedono il rispettivo contesto emulatore; hardening 23/23 con Gitleaks reale; publisher 36/36 senza skip; restore v2 emulatore 1/1. Il test browser separato copre sei combinazioni e passa. Dieci avvisi nativi sui listener restano nel log; i dinieghi Rules delle fixture negative non sono presentati come Console priva di messaggi. Il confronto dopo la suite non rileva cambiamenti del sorgente non documentale rispetto al digest iniziale `731f1f00f4768452d5ff42c0dc27fe4104793dfbe9f22a10d822c131bc1a6c43`. Gli esiti della sezione successiva descrivono invece la copia precedente al collegamento produttivo.

Una successiva lettura cloud, senza modifiche, restituisce 45 Functions attive, tutte `gcfv2`/Node 22 in `europe-west1`, con timeout massimo effettivo di 540 s e due hash di distribuzione. I 41 writer previsti sono presenti; le due nuove callable non sono distribuite. Nessun nome restituito è estraneo al censimento del sorgente corrente. Questa lettura non prova assenza di vecchie revisioni Cloud Run ancora serventi o di invocazioni precedenti: inventario delle revisioni e drain restano gate di attivazione. L’output trattenuto esclude variabili d’ambiente, segreti e token.

## Recovery completo 1.2.260 — lotto formato/UI/laboratorio precedente al collegamento, 06/11/2026

Le prove riguardano fixture sintetiche e laboratorio locale. Il profilo schema 3 usa file e Recovery Key senza la vecchia Master Password e protegge il materiale recuperato con quella nuova, per lo stesso UID autenticato. Il flag applicativo è `false`; `manageFullVaultRecovery` e `readRecoveryBackupAsset` non sono registrate in `functions/index.js`. L’adapter publisher ammette soltanto il progetto `demo-*` e i veri endpoint SDK loopback. Gli esiti non attestano attivazione in produzione, prove fisiche, wipe o rotazione QA, migrazione o chiusura F2/F3.

Verifiche concluse sul checkout integrato:

- `npm run test:backup-prototype`: **196/196**, senza skip; compatibilità v2, crittografia reale random/CPVK2, identità, allegati profilo e alias Scadenza, chunk, capacità, manomissioni, fonte server confermata, keyring esatto, ripresa e lifecycle. Il client verifica l’envelope realmente memorizzato prima del successo e distingue il completamento dalla pulizia parti da riprovare.
- `node scripts/run-full-recovery-emulators.mjs --client-only`: **2/2** con Firestore e Storage reali locali. Il coordinatore client usa il vero handler dedicato fino a finalizzazione, verifica della nuova autorità e pulizia parti; nella corsa con un writer legittimo precedente al fence riceve `not-started`, libera soltanto il proprio blocco, preserva il record concorrente e non avvia un’altra operazione. La prima esecuzione nel sandbox non ha aperto la porta hub; il rerun autorizzato fuori sandbox termina con codice **0**. Nessun collegamento cloud.
- Il checkout publisher separato ha superato **34/34** casi emulatori e **15/15** unitari prima dell’integrazione, inclusi lettura/decifratura/eliminazione degli allegati recuperati, purge Account corrente, interruzioni, generazioni, scadenza e consenso al nuovo confronto. Per `abortChecking`, quattro writer legittimi prima del fence conservano i propri dati; operazioni prepared/staged/completed, ricevute e oggetti inattesi, binding cambiati e le due direzioni della corsa CAS sono coperti. La suite integrata, inclusi i due casi client/server sopra, supera **36/36 senza skip** nel passaggio integrale finale.
- `npm run test:full-recovery-ui-browser`: **6/6 combinazioni** inglese/cinese/hindi × mobile/desktop, con CSS e font locali, anteprima a soli conteggi, riferimenti esterni dichiarati, nessun overflow o errore browser e stili effettivi verificati. Il banco usa servizi sintetici; non simula Firebase Auth reale, MFA fisico, Safari/iPhone o App Check produttivo.
- Budget statico rispettato da **30 pagine**, senza aumentare soglie; fondazioni UI **6/6**, con una sola dichiarazione inline preesistente e zero chiamate ai dialoghi nativi. Costanti recovery nell’esistente `app-env.js`; rimossi tre vecchi modal locali senza chiamanti, preservando listener e risposta agli inviti attivi. Il primo `npm test` ha rilevato i due nuovi stili inline e il nome dell’helper locale `confirm`; corretti tramite classi CSS e `askConfirmation`, senza modificare i gate.
- Mappa rigenerata: **31 pagine, 418 controlli, 235 eventi, 195 superfici**, zero controlli statici non mappati; **1.100 chiavi runtime** senza assenze nelle otto lingue, incluse **49 chiavi recovery**. Restano **185 chiavi guida** con fallback italiano nelle altre sette lingue, **8** segmenti HTML e **329** sink JavaScript candidati da classificare. Questa copertura statica non prova ogni stato dinamico.
- Versione **1.2.260** coerente su **265 riferimenti**, runtime offline con **318 risorse** e favicon ICO generato dall’icona PNG esistente. Nessun file immagine ridisegnato. Il catalogo D0 è riesaminato sulla nuova base: percorsi ordinari, target e istruzioni v2 restano validi; il recovery completo disabilitato non viene presentato come percorso già disponibile nella guida. Il gate ha correttamente fermato il secondo passaggio integrale finché `reviewedAppVersion` indicava ancora 1.2.259.

La regressione integrale conclusiva **`npm test` termina con codice 0**: **3.084 test passati, 0 falliti e 10 skip dichiarati** su 3.094 test censiti nei riepiloghi Node. Sono compresi formato e UI, Functions **536 passati / 10 skip** nel profilo unitario, Rules Firestore/Storage, publisher completo **36/36**, ripristino v2 e tutti i runner emulatori previsti di Account, Profili, Documenti, purge, retention e condivisioni. Le cinque vecchie fixture che estraggono il backend in VM ora ricevono i nuovi helper reali del fence, senza stub permissivi o rimozione delle asserzioni; la vecchia asserzione statica sulla cancellazione batch è aggiornata alla transazione, verificando anche guardie di tutti i partecipanti e protezione dagli eventi ritardati.

Nel processo del banco publisher si osservano **10 avvisi `MaxListenersExceededWarning` su `PassThrough`**. Non sono soppressi e non vengono presentati né come prova di una perdita di memoria né come prova della sua assenza; la causa e il comportamento con i servizi reali restano da approfondire prima dell’attivazione cloud. I dinieghi `PERMISSION_DENIED` delle prove negative delle Rules sono invece attesi e accompagnati dai controlli positivi. Safari/iPhone, memoria su dispositivi reali, Auth/MFA/App Check produttivi e convivenza con writer/dispositivi precedenti mantengono i rispettivi gate.

La produzione resta distinta dalla candidata: il manifest pubblico letto in sola lettura conferma ancora il sorgente `16c94c24e4d7b342600382dad077cbc491902e6a` della 1.2.259. Nessun commit, push, deploy o modifica cloud eseguito per questo lotto. Le prove e il digest della copia candidata sono conservati nella raccolta privata degli artefatti per il riesame sullo stesso contenuto; non costituiscono certificazione del recovery in produzione.

## Pubblicazione Hosting 1.2.259 e verifica online — 06/11/2026

[Run di rilascio 42190828545](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/42190828545) conclusa con successo: verifica provider, Gitleaks completo, pulizia del report, suite integrale, versione, manifest, deploy del solo Hosting e verifica del manifest/asset reali. Il [manifest pubblico](https://appcodici-password.web.app/release-manifest.json) indica schema 2, versione **1.2.259**, commit **16c94c24e4d7b342600382dad077cbc491902e6a**, **314 file** e hash CI **e08f553f434a26e41ff73ac3266fce72abcba081d6e57d6c1d2047b5f914e437**. Questa è la provenienza verificata della distribuzione; i successivi commit soltanto documentali non vengono confusi con il commit pubblicato.

Il confronto indipendente fra tutti i fingerprint pubblici e la copia Windows rileva 151 file testuali con CRLF locali anziché LF del checkout CI: normalizzando esclusivamente le terminazioni riga tutti i 151 corrispondono, mentre gli altri file corrispondono già byte per byte. Nessuna differenza di contenuto resta inspiegata. Un manifest calcolato sui byte grezzi di una vecchia copia Windows non sostituisce quello canonico generato e verificato in CI.

Smoke autenticato sulla produzione con la sola QA autorizzata: login, Master Password, Home, quattro navigazioni con nuovo sblocco (`area_privata`, `account_privati`, `impostazioni`, `home_page`), logout e diniego di una scheda nuova sono superati. Il report funzionale è `ok: true`, senza errori di rete applicativi o avvisi App Check. Il runner termina però con codice **1** per un solo errore Console: richiesta automatica del browser a `/favicon.ico`, che risponde 404. Il difetto resta dichiarato e programmato, senza alterare il test per nasconderlo. Non sono state eseguite operazioni CRUD su dati reali; Safari/iPhone/PWA e Push fisico conservano i rispettivi gate separati.

## Pulizia del report scanner e manifest nelle PR — 06/11/2026

La run manuale `42188321874` sul commit `83e7336b` supera i controlli provider, Gitleaks, suite completa e versione. Fallisce prima di Hosting con `Il manifest di produzione richiede un worktree tracciato pulito.` Il sorgente dell'Action fissata conferma che `results.sarif` viene sempre scritto nella root e che disabilitare il caricamento non lo elimina. Il workflow rimuove quindi il solo report regolare, non tracciato e non symlink; qualsiasi altro file resta visibile al gate. La generazione/verifica del manifest con `--require-clean` viene eseguita anche nelle PR che svolgono la suite applicativa, anziché essere provata per la prima volta al deploy manuale. L'errore non ha pubblicato una versione incompleta.

## Gate storico verificato e baseline esatta — 06/11/2026

La run manuale `42185150887` si è fermata su Gitleaks, senza eseguire Hosting. I dodici reperti sono poi stati riconciliati individualmente: due copie della stessa chiave privata storica oggi inutilizzabile secondo lo stato provider, sette configurazioni pubbliche Firebase/VAPID e tre valori sintetici di test. La baseline usa soltanto `commit:percorso:regola:riga`; il preparatore ne verifica l'insieme esatto e non autorizza intere regole, percorsi o nuovi commit.

Evidenza aggiuntiva: IAM sul progetto esplicito restituisce `NOT_FOUND`; entrambi gli endpoint pubblici Google dei certificati della vecchia identità restituiscono 404 JSON, mentre il controllo valido restituisce 200 con certificati X.509 validi. Il preflight live è verde alle **08:17:53 UTC**. Gli endpoint pubblici sono descritti nella [documentazione Google sulle chiavi](https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys); il comportamento del progetto esplicito è documentato nel [riferimento IAM get](https://docs.cloud.google.com/iam/docs/reference/rest/v1/projects.serviceAccounts/get). La prova non usa la chiave privata, non genera token e non modifica Google Cloud. Il riesame indipendente distingue lo stato corrente verificato dalla ricostruzione storica ancora aperta; non si dichiara avvenuta una revoca né si esclude un abuso passato.

Hardening rilascio **21/21 senza skip**, inclusi Gitleaks reale sulla reintroduzione della stessa chiave in un nuovo commit e in un altro percorso, baseline alterata, URL provider fissati da un controllo indipendente e matrice provider su rete, timeout, permessi, falso 404 e certificati non validi. Lo scan reale Gitleaks 8.30.1 copre **1.612 commit / circa 112 MB**, senza reperti aggiuntivi rispetto ai dodici riconosciuti. Il workflow ricontrolla lo stato provider prima dello scan manuale e immediatamente prima di Hosting, fallendo chiuso su ogni anomalia.

Rollback verificato tramite lettura dell'API Hosting: release attiva prima del nuovo deploy `sites/appcodici-password/releases/1793899336876000`, versione `sites/appcodici-password/versions/7b00f8b1afadf81b`, pubblicata il **05/11/2026 17:22:16.876 UTC**, osservata come **1.2.258**. Nessuna operazione di rollback è stata eseguita.

## Checkpoint GitHub 1.2.259 — 06/11/2026

Commit applicativo `3401d601`, PR #258, merge `4a485d92`. La run GitHub `42183152903` ha concluso con successo la validazione completa su Linux e il controllo della versione; i controlli documentali e Gitleaks dei nuovi commit sono verdi. Il deploy è stato correttamente saltato perché non è una run manuale di produzione. Prima del commit Gitleaks 8.30.1 sullo staging non rileva segreti; i test di hardening rilascio sono 14/14 senza skip. La fixture PEM sintetica è costruita a runtime e il test reale conferma che lo scanner la blocca.

La scansione redatta dell'intera cronologia copre 1.611 commit e circa 112 MB, con 12 occorrenze revisionate: due copie di una sola chiave privata storica, sette valori pubblici Firebase/VAPID e tre valori sintetici di fixture/emulator. Nessuna nuova credenziale attiva è stata identificata, ma questo non prova la revoca della chiave storica. Il vecchio account risponde `NOT_FOUND` e il certificato pubblico HTTP 404; la verifica del progetto con l'identità attuale non è conclusiva. Nessuna revoca, rotazione, eccezione Gitleaks per la chiave privata o pubblicazione Hosting è stata eseguita. La prova dell'eliminazione con l'identità proprietaria e la revisione dei log restano necessarie per chiudere il gate.

## 06/11/2026 — primo lotto hardening locale, non distribuito

- `npm test`: codice **0**, nessun gruppo fallito; il log conserva nove skip espliciti nei profili generici (ricevute Widget, purge preflight, recovery/MFA storica, unlink condiviso). Non sono presentati come prove eseguite. Dopo le correzioni finali sono stati rieseguiti i controlli pertinenti sul sorgente corrente.
- `test:security`: **45/45** senza skip; include i moduli reali di login/finalizzazione, 2FA tardiva, verifica email, cambio password interno con diniego condiviso, quota del fallback e indisponibilità dello stato autoritativo. `vault-session`, race e logout: **29/29**; shell candidata di laboratorio: **831/831**. Questi ultimi non attestano la parità della shell con l'app completa.
- `test:auth-hardening-browser`: quattro configurazioni Chrome/Edge con e senza BroadcastChannel, server solo loopback e rete esterna bloccata. Verificati logout fallito su due schede, rifiuto di una nuova scheda, login tardivo, nuovo login esplicito, perdita della chiave al reload, alias Messaging effettivo e contrasto del messaggio pending in light/dark.
- Prova autorizzata `test-qa-release-browser` con `QA_APP_ORIGIN` loopback e sola identità sintetica: login/sblocco/Home/logout verdi; estensione `QA_VERIFY_RAM_NAVIGATION=1` verde su Area privata, Account privati, Impostazioni e ritorno Home, sempre con nuovo unlock. Una nuova scheda dopo logout è respinta. Console, rete e warning vuoti. Il runner non richiede CRUD esplicito sui record; le eventuali sincronizzazioni automatiche dell'app riguardano soltanto la QA.
- Il primo tentativo browser confinato è stato impedito dal sandbox sulle richieste loopback. Un tentativo QA esterno è stato rifiutato dall'auto-review prima dell'esecuzione; dopo consenso esplicito dell'utente è stato eseguito. Il server di prova è stato corretto per l'alias favicon e il runner ora attende lo stato UI, evitando `networkidle` sui listener Firestore; il passaggio finale è verde. Questi passaggi non sono descritti come guasti del backend.
- Sintassi su **219 moduli**, riferimenti su **316 file**, CSS, offline **14/14**, QA automation **14/14**, documenti **12/12**, topologia **7/7** e traduzioni UI **5/5** sono verdi. La topologia conserva **418/418 controlli** mappati. Versione locale **1.2.259**, 264 riferimenti asset coerenti.
- Il nuovo confine condiviso aggiunge un modulo: tetto **46** anziché 45. Il limite generale resta **338 KB gzip**; soltanto `form_account_azienda.html` ha tetto **339 KB** e `profilo_privato.html` **343 KB**, per il costo misurato del coordinatore e degli export Messaging locali. Nessun obiettivo temporale runtime è stato alzato; il controllo statico passa su 30 pagine.
- Restano aperti cache Firestore con dati in chiaro, recovery completo e migrazione della dipendenza legacy, shell persistente completa, Push reale e prove fisiche Safari/iPhone/PWA. La credenziale storica e gli altri gate cloud restano separati. Nessun commit, push, deploy o conversione di dati reali eseguito da questo lotto.

## 06/11/2026 — regressione integrale conclusiva della candidata 1.2.259

- `npm test`, eseguito fuori dal sandbox per consentire esclusivamente le porte loopback degli emulatori Firebase, termina con codice **0** e nessun gruppo fallito. Sono verdi controlli statici e documentali, sicurezza e Gitleaks reale, release manifest e verifica HTTP locale, Graphify/topologia, i18n, offline, cifratura, Functions, Firestore Rules, Storage Rules, retention/purge, backup/ripristino, Vault, Profili, allegati, collegamenti, note e Account standard.
- Le fixture VM che eseguono moduli dipendenti da `t`/`tf` usano ora `tests/helpers/test-translator.mjs`, costruito sul catalogo italiano effettivo e sui cataloghi dinamici. La correzione riguarda il banco di prova: non sostituisce il traduttore runtime e non maschera chiavi mancanti.
- `test:release-hardening`, con Gitleaks **8.30.1** reale obbligatorio, conclude **14/14** senza skip. Il controllo comprende configurazione, manifest, rifiuto dei file pubblici non tracciati, payload remoto simulato, redirect/rewrite, cache e CSP.
- Il budget resta generale a **338 KB gzip**; la sola `profilo_privato.html` ha una soglia esplicita di **341 KB** e misura **340,2 KB**. L'aumento rispetto alla baseline precedente deriva principalmente dal runtime Firebase rigenerato, passato a **213,9 KB gzip** (circa **+2,5 KB**), non dai cataloghi differiti delle traduzioni. Moduli JS e CSS restano entro i limiti.
- Il test di interruzione del ripristino conserva intenzionalmente l'evidenza dello stato intermedio «riferimento scritto, byte non ancora caricati»; il gruppo successivo prova che una nuova sessione rileva il byte mancante e completa l'upload senza riscrivere i record. È una parzialità recuperabile documentata, non un fallimento nascosto dalla suite verde.
- I `PERMISSION_DENIED` ed evaluation error stampati dagli emulatori appartengono ai casi negativi che verificano la chiusura delle Rules; i rispettivi test sono superati. Nessun commit, push, modifica cloud o deploy è stato eseguito.

## 06/11/2026 — secondo lotto i18n dinamico e topologia aggiornata

- I candidati JavaScript censiti scendono da **734 a 333**; il residuo HTML scende da **32 testi / 7 attributi a 8 / 0**. I residui HTML sono tecnici o brand e non frasi applicative.
- Il catalogo dinamico copre prioritariamente Impostazioni, Widget, Credenziali comuni e form Account privato. Impostazioni passa da 71 candidati a 3 falsi positivi dimostrabili: rapporto numerico, percentuale e brand.
- Le **1.066 chiavi runtime** collegate alla topologia sono presenti e valide in italiano, inglese, spagnolo, francese, tedesco, cinese, hindi e portoghese: mancanti, non valide e assenti dal catalogo pagina tutti **0**.
- Gate verdi: sintassi JavaScript su **218 moduli**, i18n **18/18**, traduzioni UI **5/5**, topologia **7/7**, **418/418** controlli mappati e zero errori di iniezione Graphify.
- Limiti espliciti: 17 candidati appartengono al visualizzatore portabile separato, 3 sono falsi positivi di Impostazioni e **313** restano da classificare negli altri moduli; le **185** voci guida sono dirette solo in italiano e usano fallback italiano nelle altre sette lingue. Questi numeri impediscono di dichiarare l'app editorialmente tradotta in ogni stato dinamico.

## 06/11/2026 — audit dipendenze e allowlist Gitleaks reale

- `npm audit --omit=dev --json` nella radice: **0** vulnerabilita di produzione. `npm audit --json` in `functions`: **0** vulnerabilita.
- L'audit completo della radice rileva **26** dipendenze di sviluppo/tooling (21 moderate, 5 alte). Non interessano il bundle pubblico o le Functions; non e stato usato `--force`, perche le correzioni proposte comportano cambi incompatibili o downgrade. Il residuo va rivalutato a ogni aggiornamento degli strumenti.
- Il test di hardening usa Gitleaks **8.30.1** reale oltre alle asserzioni sulla configurazione: una chiave Firebase Web interamente sintetica nel percorso autorizzato non produce finding; lo stesso valore in un altro file produce `gcp-api-key`; una PEM privata sintetica produce `private-key`. Risultato complessivo `test:release-hardening`: **14/14**.
- Il test viene eseguito dalla radice con target `.`: i regex dei percorsi sono ancorati e il comportamento coincide con il checkout GitHub Actions. Nessun valore reale viene scritto nelle fixture o nei log.
- Resta esterno e bloccante il controllo della chiave privata storica gia rilevata: revoca/rotazione e verifica dei log devono essere confermate dal proprietario prima della pubblicazione.

## 05/11/2026 — candidata 1.2.259, attestazione locale e procedura di rollback

- Il bump patch separa la candidata dalla **1.2.258** gia pubblicata e invalida il namespace della cache PWA. La versione canonica viene controllata in `package.json`, `app-env.js`, Home e Service Worker.
- Il manifest di rilascio lega versione, commit Git, stato pulito, hash dell'albero pubblico, hash di **15 asset critici** e hash individuale di ogni file del payload pubblicato, escluso il manifest auto-descrittivo, incluso l'alias di compatibilita `env-v126.js`. Il gate include file non tracciati sotto `Frontend/public`; il manifest generato e ignorato non causa falsi positivi. Dopo il deploy vengono verificati manifest, intero payload pubblico, redirect login 302, rewrite `/home`, header no-cache/no-store e CSP effettivamente servita, con richieste no-cache, timeout per richiesta e retry limitati senza batch sovrapposti. Anche i job validate/deploy hanno un limite temporale esplicito.
- La compatibilita login usa **302** durante la finestra di rollback. Service Worker e shell offline gestiscono `/`, `/home` e `/login-v115.html` tramite le pagine canoniche.
- Gitleaks usa la configurazione predefinita e una sola allowlist `AND` per la chiave Firebase Web pubblica: la fingerprint deve essere quella approvata e il file deve essere uno dei tre percorsi esatti. La configurazione temporanea supera il parser Gitleaks 8.30.1. Nessuna allowlist copre la chiave privata storica.
- **Gate esterno bloccante:** prima della pubblicazione il proprietario deve confermare revoca o rotazione della chiave privata storica e conservare un'evidenza priva del valore. Devono inoltre essere verificati sul repository GitHub Secret/Push Protection, branch protection e private vulnerability reporting.
- **Rollback:** se la verifica post-deploy fallisce, se login/Home non superano lo smoke test o se compaiono errori applicativi critici entro 15 minuti, il proprietario interrompe il collaudo e ripristina dalla cronologia Firebase Hosting la release precedente. Dopo il rollback verifica login storico, `login.html`, Home, Service Worker e versione pubblica. Functions, Rules, indici e dati non fanno parte di questo deploy e non vengono modificati. Il passaggio 302 resta finche almeno una release precedente e ancora una destinazione di rollback.
- Il token Firebase CI esistente e un meccanismo legacy: la migrazione a credenziali federate/ruolo minimo resta un intervento separato, da non improvvisare nella stessa pubblicazione.
- Il job di validazione del rilascio esegue direttamente Gitleaks **8.30.1** con la configurazione generata, oltre al workflow preventivo separato: il deploy non dipende quindi soltanto da una convenzione esterna di branch protection. La prova fixture locale con binario esplicito e obbligatorio conclude **14/14** senza skip; l'Action reale del job resta comunque obbligatoria.
- Il commit approvato dal workflow (`GITHUB_SHA`) e la sorgente immutabile del deploy. Il job verifica che coincida con `master` sia all'inizio sia nello stesso step immediatamente prima del comando Firebase; se `master` avanza dopo quel controllo, il riepilogo registra entrambi gli SHA senza trasformare un deploy gia concluso in un falso mancato deploy.
- Il collaudo integrale finale `npm test`, eseguito fuori dal sandbox per consentire le sole porte loopback degli emulatori, termina con codice **0**. Sono verdi i controlli statici, sicurezza, cifratura, offline, Graphify, guide, i18n, Functions, Firestore Rules, Storage Rules, backup/ripristino, Vault e tutti gli emulatori previsti. Il catalogo guida dichiara la base **1.2.259** e usa la route canonica `login.html`.
- Nessun commit, push, modifica cloud o deploy è stato eseguito da questo blocco.

## 05/11/2026 — topologia UI completa e pannello Supporto multilingue

- Il generatore UI ha censito **31 pagine**, **418 controlli**, **232 binding di evento**, **180 superfici/popup** di cui **130 create dinamicamente**, **1.100 nodi di traduzione**, **30 schede guida**, **125 passi**, **110 target**, **6 journey** e **3 scenari runtime sicuri**. I dieci flussi critici definiti dal contratto sono risolti; tre controlli legacy sono marcati inattivi e il conteggio dei controlli operativi non mappati è **0**.
- `npm run test:ui-topology` conclude **7/7**: copertura e univocità, flussi critici, isolamento dei riferimenti al callback del singolo evento, storyboard dei passi guida, sequenze dei journey e iniezione idempotente nel grafo. Il grafo canonico dopo l'overlay conta **11.893 nodi** e **28.383 relazioni**, con `directed:true` e `multigraph:true`; `GRAPH_TREE.html` è stato rigenerato per la consultazione dell'albero.
- `npm run test:ui-translations` conclude **5/5**. Le **909 chiavi runtime uniche** collegate dal grafo risultano presenti e valorizzate nelle otto lingue; la verifica pagina per pagina conferma che ogni chiave dichiarativa o di flusso critico appartiene al catalogo effettivamente caricato dalla route. Mancanze runtime, valori tecnici/vuoti e mancanze nel catalogo pagina sono tutti **0**. Il controllo comprende **591** marcatori testuali, **65** placeholder, **61** etichette ARIA, **13** title e **7** alt.
- La guida D0 conserva **185 chiavi** disponibili direttamente in italiano e usa esplicitamente il fallback italiano in EN/ES/FR/DE/ZH/HI/PT. Il debito residuo, che impedisce di dichiarare completa la traduzione visiva, è censito in **32 segmenti HTML**, **7 attributi HTML** e **734 sink JavaScript candidati**; questi ultimi includono anche token tecnici, icone e valori dinamici e richiedono classificazione, non sono 734 difetti confermati.
- La correzione Supporto usa ora cataloghi dedicati nelle otto lingue per descrizione app, Privacy e Termini e legge la versione applicativa dalla sorgente canonica. `npm run test:i18n` conclude **18/18** e `npm run test:guide` **12/12**.
- Limiti registrati: l'estrazione Graphify `--code-only` non incorpora i documenti; due HTML sensibili filtrati dal nucleo Graphify sono comunque presenti nell'overlay UI; **377** gruppi di archi paralleli con gli stessi estremi possono essere collassati nelle query Graphify standard, mentre restano distinti nel JSON; i tre scenari runtime non sono ancora stati eseguiti sulla candidata autenticata. La mappa supporta storyboard e selezione delle scene, ma non certifica da sola che ogni popup condizionale sia stato aperto nel browser.
- Nessun commit, push o deploy è stato eseguito. Le correzioni locali non sono ancora visibili sul sito pubblicato.

## 05/11/2026 — pagine pubbliche di accesso e contatto condiviso in otto lingue

- Graphify ha ricondotto Login, Registrazione e Nuova Password al loader `translations.js`, ai controller Auth e al percorso onboarding già presente. È stato aggiunto un solo catalogo pagina Accesso di **59 chiavi**, con parità esatta nelle otto lingue e segnaposto `{seconds}` verificato; il catalogo viene caricato soltanto sulle pagine pubbliche pertinenti.
- Login copre ora titoli, TOTP, recupero, dispositivo ricordato, throttle, stato offline e pannello di verifica email. Registrazione e Nuova Password coprono suggerimento e requisiti password. I testi dei pulsanti sono in nodi dedicati, così la traduzione non elimina più le icone Material Symbols. Nuova Password conserva il logout obbligatorio sul percorso di aggiornamento policy; l'audit sicurezza accetta la chiave tradotta senza ridurre il requisito `signOut`.
- Contatto condiviso carica la lingua scelta senza richiedere login, traduce titolo, accessibilità, stati di preparazione/errore, azioni e dieci etichette vCard. Il modello conserva il comportamento italiano predefinito per compatibilità; i test QR/vCard restano **8/8** verdi e non espongono foto remote o campi esclusi.
- Le quattro pagine passano da **41 segmenti testuali e 5 attributi letterali** a **zero rilievi HTML i18n**. L'audit globale conclude **17/17 PASS**, zero chiavi usate mancanti in tutte le lingue, **32** segmenti HTML, **7** attributi e **736** sink JavaScript residui.
- Il nuovo banco Chrome locale carica il DOM reale e il loader i18n con asset same-origin e verifica **32/32** combinazioni, cioè 4 pagine × 8 lingue: nessun fallback, chiave tecnica, errore Console o overflow orizzontale; le icone submit restano presenti. Il bootstrap applicativo viene sostituito intenzionalmente per non creare identità o sessioni: questa prova non certifica login, registrazione, recupero/cambio password, MFA, invio email o importazione reale del contatto.
- Gate mirati verdi: sicurezza **26/26**, navigazione **191/191**, sintassi JavaScript su **216 moduli**, shell delle 5 pagine accesso e 24 interne, icone, riferimenti statici, budget prestazionale, guida e catalogo i18n. La regressione integrale `npm test` fuori sandbox termina con codice **0**, inclusi Functions/security (**482 PASS, 9 SKIP, 0 FAIL**), Firestore Rules, Storage Rules, retention/purge, backup/ripristino, Vault e tutti gli emulatori previsti.
- Restano da trattare il debito delle altre pagine e dei **736** sink JavaScript, la revisione editoriale madrelingua, il lettore di schermo e i percorsi reali MFA/email/App Check/dispositivo. Nessun commit, push o deploy è stato eseguito.

## 05/11/2026 — prima matrice multilingua autenticata, Profili e Destinatari interattivi

- Il runner browser accetta una matrice di lingue e un filtro di pagine validato sul catalogo canonico. L'override della lingua usa `sessionStorage` soltanto su `localhost`, `127.0.0.1` o `::1`; non cambia la preferenza Firestore dell'utente QA. Gli ID sintetici di Account privato, Azienda, Account aziendale e Scadenza sono validati e usati soltanto nelle URL locali; il report conserva esclusivamente la loro presenza, non i valori.
- Il primo giro completo rafforzato ha rilevato due difetti del banco: lo stato italiano valido **Da completare** veniva scambiato per caricamento incompleto e mancavano i parametri del modulo/dettaglio Account aziendale. Le condizioni sono state corrette e il rerun mirato è terminato **24/24** senza redirect o warning.
- Esito canonico finale: **384/384 `SHELL_OK`** su 24 pagine interne × 8 lingue × 2 viewport. Zero errori Console applicativi, zero errori rete, zero chiavi mancanti/fallback, zero overflow orizzontale e zero redirect di contesto. L'unico warning è il frame Google reCAPTCHA bloccato dalla CSP report-only, già classificato come limite noto del Chrome headless.
- Le schermate dinamiche rappresentative hanno attese obbligatorie: un Profilo o le Impostazioni vuoti fanno fallire il gate. La modalità interattiva apre inoltre Contatti e Tessera digitale nei Profili privato e aziendale e ricontrolla fallback e overflow dopo ogni click: **32/32** aperture e **64** stati di scheda verdi in tutte le lingue e viewport.
- **Gestione destinatari** ha un catalogo pagina di **44** chiavi con parità esatta in tutte le lingue e conservazione verificata dei segnaposto `{count}`, `{name}`, `{usage}` e `{companies}`. Il giro browser mirato conclude **16/16 `SHELL_OK`** e **48/48** stati interattivi tradotti: modifica, validazione del nome obbligatorio e conferma eliminazione su 8 lingue × 2 viewport. La conferma viene sempre annullata e non produce scritture; zero fallback, overflow, errori Console o rete. Il report è `.codex-tmp/qa-final/page-matrix-recipients-interactive.json`.
- L'ispezione visiva di cinese, hindi e portoghese ha confermato la traduzione delle etichette applicative e la conservazione intenzionale dei dati utente sintetici. Sono stati corretti: `click_to_enlarge` reso condiviso; lingua dinamica Impostazioni; schede e riepilogo Profilo; destinatari e allegati Scadenza; panoramica, Contatti e Tessera digitale Azienda; Tessera digitale privata. Il catalogo pagina Profilo contiene **50** chiavi con parità esatta nelle otto lingue.
- Audit i18n conclusivo: **16/16 PASS**, zero chiavi usate mancanti in ogni lingua, **73** segmenti HTML letterali, **12** attributi letterali e **749** sink JavaScript. Rispetto al checkpoint precedente sono stati rimossi 15 segmenti, 3 attributi e 13 sink; rispetto ai 790 sink osservati prima della bonifica dinamica il calo complessivo è 41. La baseline garantisce che il debito non peggiori, non la completezza editoriale.
- Il primo `npm test` successivo ha esposto due fixture VM che isolavano moduli ora dipendenti da `t`; sono state aggiornate senza cambiare il runtime. I gruppi mirati sono verdi: PDF Azienda **35/35**, allegati **73/73**, navigazione **191/191** e sintassi su **215 moduli**. La prima ripetizione integrale si è fermata prima degli emulatori perché il sandbox non ha aperto la porta 4400; il rerun autorizzato fuori sandbox termina con codice **0**, inclusi documentazione, Functions/security, Firestore Rules, Storage Rules, retention/purge, backup/ripristino, sessioni e mutazioni Vault, Profili, allegati, collegamenti, note, Account standard e tutti gli emulatori previsti.
- Perimetro non certificato da questo passaggio: apertura di ogni altro popup/menu/stato di errore, revisione editoriale di tutti i **749** sink residui, attributi ARIA con lettore di schermo, notifiche/biometria/MFA, iPhone/Safari e browser fisico ammesso da App Check. Nessun commit, push o deploy è stato eseguito.

## 05/11/2026 — audit i18n e regressione integrale nel workspace OneDrive

- Il primo `npm run test:i18n` ha rilevato **17 chiavi usate ma mancanti** in tutti i cataloghi: titoli dei dettagli Account, sezioni Profilo/Azienda, scheda PDF, referente, note e condivisione. Le chiavi sono state aggiunte con testo locale a italiano, inglese, spagnolo, francese, tedesco, cinese, hindi e portoghese.
- Rerun i18n: **13/13 PASS** e zero chiavi usate mancanti in ciascuna delle otto lingue. Il risultato certifica presenza, struttura e controlli automatici; non equivale alla revisione editoriale o visiva completa di popup, menu, ARIA e contenuti dinamici in ogni lingua.
- Il nuovo percorso OneDrive ha esposto `EBADF` nelle riscritture non necessarie di documenti e licenze generate. I writer ora confrontano prima il contenuto; la sezione documentale usa scritture posizionali limitate quando deve cambiare davvero. Lo script dell'inventario è importabile senza effetti collaterali e i report locali `graphify-out` sono esclusi dall'audit dei Markdown versionati, con regressione dedicata.
- Gate mirati verdi: QA automation **13/13**, documentazione **12/12** su 31 Markdown e 631 collegamenti, sintassi JavaScript su **213 moduli**, riferimenti statici su **310 file** e purezza HTML su 31 pagine.
- La regressione conclusiva `npm test` termina con codice **0**. Sono verdi build offline, PDF, sicurezza, navigazione, Functions (**482 PASS, 9 SKIP, 0 FAIL**), Firestore Rules, Storage Rules, retention/purge, backup e ripristino, sessioni e mutazioni Vault, profili, allegati, collegamenti, note, Account standard e tutti gli emulatori previsti. I `PERMISSION_DENIED` osservati nei log appartengono ai casi negativi attesi e superati.
- Nessun dato reale è stato letto o modificato in questa bonifica; nessun commit, push o deploy è stato eseguito. Restano aperti i controlli fisici/App Check, i nove percorsi di sicurezza o dispositivo e la matrice visiva completa nelle otto lingue.

## 05/11/2026 — delega completa QA2 e censimento campi con Graphify

- `codex.qa2@appcodici-password.invalid` è l'identità tecnica delegata a ogni tipologia di collaudo applicativo sui soli dati sintetici. Sono autorizzati creazione, modifica, collegamento, condivisione tra identità sintetiche, archiviazione, ripristino e cancellazione delle fixture QA. Utenti e recapiti reali restano esclusi; identità, Master Password e chiave Vault di QA2 non vengono ruotate o eliminate durante i normali test.
- Graphify è stato rigenerato sull'intero codice pubblico con indice tecnico separato: **216 file JavaScript**, **2.231 nodi** e **8.442 relazioni**. Il grafo collega pagine, moduli, form, controller e repository; il precedente sotto-grafo dell'assistente non era sufficiente per censire i campi dell'app.
- L'inventario contiene **167 controlli HTML statici**. Dopo aver escluso campi tecnici, di sola lettura e azioni non persistenti, i runner fanno riferimento a **98/98 campi ordinari**; i controlli creati letteralmente dai moduli JavaScript sono **4/4**. Il riferimento nel runner è una copertura tecnica, non sostituisce la prova browser e la rilettura del valore.
- I **9 controlli statici separati** non sono dati da lasciare popolati nella Vault: nuova password/conferma, conferma registrazione, TOTP, codice di recupero, dispositivo ricordato, 2FA, Face ID e Push condivisioni. Verranno provati nei rispettivi percorsi di sicurezza o su dispositivo fisico e non vengono dichiarati coperti per inferenza.
- Profilo QA2: anagrafica, nota cifrata, telefono, e-mail `.invalid`, indirizzo, utenza cifrata, Documento, Widget pubblico e cifrato, Tessera digitale e rilettura dopo reload sono verdi. Il caricamento automatico dell'allegato Documento resta **BLOCKED** dal `401` App Check nel Chrome automatizzato; nessun bypass è stato applicato.
- Azienda QA2: anagrafica, fiscale, referente, due sedi, quattro e-mail `.invalid`, password sintetiche, note, immagini e allegato sono presenti. Tutti i **14 campi pubblici** della Tessera digitale sono stati selezionati e persistiti; i **13 checkbox QR** del form storico li rileggono correttamente. Password e segreti restano esclusi dal QR e dal PDF.
- Scadenze QA2: oltre alle fixture personali e aziendali, è stata creata e riletta `QA Scadenza Azienda Esterna` con il campo `Nome azienda esterna`. Gate completo verde, zero errori Console/rete, archiviazione/ripristino e idempotenza degli ID superati; la cancellazione definitiva della fixture TEMP è stata soltanto aperta e annullata.
- Widget generico, Credenziale comune e archivio Account sono stati ritentati. Il browser automatico è stato respinto da App Check/Functions (`manageWidgetProfile`, `manageSharedVaultData`), quindi restano **BLOCKED**, non superati. Il campo invito accetta l'indirizzo sintetico `.invalid` senza inviarlo; invio/ricezione/revoca richiedono la prova fisica o una seconda identità sintetica esplicitamente coinvolta.
- Il ciclo Archivio ha lasciato due copie omonime della sola fixture sintetica `QA Privato Standard`. L'audit successivo ha identificato entrambe tramite contesto e ID, ha ripristinato la copia più recente `uiPVtG2svNVHPuZ9iVyn` e ne ha verificato il dettaglio. La copia precedente `xcsq4OKYDvNXb7iP8mU3` resta isolata nell'Archivio: la richiesta di eliminazione definitiva viene rimossa dalla vista, ma il controllo remoto la ritrova perché il Chrome automatico non supera App Check. Nessun bypass o accesso diretto al database è stato usato; la pulizia fisica resta una prova su browser ammesso.

## 05/11/2026 — lotto Regole e Scadenze QA2 sulla candidata locale

- Il test usa esclusivamente QA2, la società sintetica già verificata e indirizzi `.invalid`; prima di iniziare conferma che le notifiche Scadenze siano disattivate. Nessuna e-mail o Push è stata inviata.
- Sette regole operative e tre destinatari sono stati riletti o riconciliati. Cinque Scadenze sintetiche sono state aggiornate e rilette nei rispettivi dettagli; i filtri **Tutte** e **Urgenti** mostrano i record previsti.
- La Scadenza privata futura ha completato archiviazione, apertura del dettaglio archiviato, ripristino e rilettura. Gli ID delle quattro fixture permanenti sono rimasti invariati nel controllo di idempotenza.
- La fixture `QA Scadenza TEMP CESTINO` è stata eliminata definitivamente soltanto dopo verifica congiunta dell'ID esatto, del testo normalizzato e dell'opt-in distruttivo già autorizzato. Nessun altro record è stato cancellato.
- Il primo passaggio ha rilevato che il calendario personalizzato poteva non risultare inizializzato durante la modifica asincrona di una Scadenza esistente. L'inizializzazione è ora idempotente e viene richiamata anche dopo il caricamento; il giro sulla copia locale ha aggiornato tutte le date attraverso la UI.
- Il secondo passaggio ha rilevato un `TypeError` nella rubrica: dopo `await add(contact)`, `event.currentTarget` poteva essere già nullo. Il controller conserva ora il selettore prima dell'attesa e lo azzera soltanto se è ancora collegato al documento.
- Esito finale: `runCompleted: true`, `gatePassed: true`, `consoleErrors: []`, `networkErrors: []`. Test mirati Scadenze/Rubrica **16/16** e automazione QA **13/13** verdi. La regressione integrale `npm test` è terminata con codice **0**: documentazione, controlli statici, navigazione, sicurezza, Functions, Firestore Rules, Storage Rules, sessioni Vault, backup/ripristino e tutti gli emulatori previsti sono verdi. Report: `.codex-tmp/qa-final/qa-deadlines-report.json`; gli artefatti temporanei non entrano nel repository.

## 05/11/2026 — verifica della release pubblicata 1.2.257

- PR `#256` integrata nel commit `bb3bc25f8934026ec90a73a427453786f4c326be`; workflow GitHub `42001933820` completato con validazione e deploy del solo Firebase Hosting verdi. La Home pubblica risponde HTTP `200` e dichiara `1.2.257`.
- Banco essenziale autenticato: login QA2, inserimento della Master Password tecnica, apertura Home e logout completati; nessun errore Console o rete applicativo. Il rifiuto App Check/reCAPTCHA del Chrome headless resta classificato come limite ambientale.
- Matrice browser: **48/48 `SHELL_OK`**, zero errori Console e zero errori rete applicativi sulle combinazioni pagina/viewport previste.
- Banco P0 non distruttivo: **9 PASS, 0 FAIL, 2 BLOCKED, 0 SKIP**. Sono verdi preferenze reversibili e Supporto, annullamento delle conferme di sicurezza, Credenziali comuni in sola lettura, Archivio portabile con esportazioni tecniche, Salute credenziali, Utilizzo campi Account, Diagnostica e logout.
- `archive-read-only-restore-fixture` resta bloccato perché QA2 non contiene la fixture dedicata `QA P0 Archivio Ripristino`; la consultazione dell'archivio vuoto è riuscita e nessun dato è stato creato o ripristinato.
- `encrypted-backup-restore-preflight` ha creato e verificato localmente un `.cpbackup`, senza registrare la Recovery Key, ma il preflight è fermato dal `401` App Check su `restoreBackupChunk` nel browser automatico. Nessun ripristino è stato applicato.
- Il collaudatore è stato corretto per aprire la nuova card Tema prima di usare i colori e per chiudere il dialogo di ripristino dopo il blocco App Check. Questo elimina i due falsi `FAIL` del primo tentativo e consente di proseguire con l'Archivio portabile.
- Report finali: `.codex-tmp/qa-p0-safe/2026-11-05T09-39-01-475Z/report.json` e `.codex-tmp/qa-final/page-matrix.json`. Gli artefatti temporanei non vengono pubblicati né committati.

## 04/11/2026 — lotto Account completo sulla QA2

- Il runner Account richiede ora un `CODEX_QA_COMPANY_ID` esplicito e valido e interrompe l'esecuzione prima di leggere le credenziali se il valore manca o non è conforme. Non esiste alcun fallback verso la società della QA1. Il lotto ha usato esclusivamente QA2 e la società sintetica `wDYoVnxGwwlTkqge0htJ`.
- Tramite UI reale pubblica sono stati creati e riletti sei record sintetici: Account privato standard, bancario e Memorandum; Account aziendale standard, bancario e Memorandum. La seconda esecuzione li ha tutti riutilizzati senza duplicarli. La password resta mascherata, il controllo mostra/nascondi è presente e l'IBAN compare soltanto nella sezione bancaria dedicata.
- L'allegato piccolo `qa-account-allegato-sintetico.txt` è stato caricato e riletto. I quattro casi negativi Account/Memorandum condiviso, privato e aziendale, sono stati bloccati come previsto quando manca il destinatario. Questa evidenza certifica soltanto la validazione locale del destinatario: non certifica invio, ricezione o revoca di una condivisione reale.
- L'archiviazione e il ripristino dell'Account privato standard sono riusciti usando l'identificativo esatto della fixture; dopo il ripristino l'Account è stato ritrovato nella lista e non è rimasto alcun record QA2 archiviato per errore.
- Widget e Credenziale comune sono stati tentati sulla fixture QA2 esatta ma restano **bloccati**, non superati: il Chrome headless riceve `401 Unauthenticated` rispettivamente da `manageWidgetProfile` e `manageSharedVaultData`, insieme ai rifiuti ambientali App Check già censiti. Non viene dichiarato alcun successo per questi due flussi né per la condivisione end-to-end.
- Il report finale è `.codex-tmp/qa-final/qa-accounts-report.json`; gli screenshot coprono i sei form/dettagli, l'allegato, i quattro blocchi destinatario e lo stato successivo al ripristino. Test QA **8/8**, controllo sintassi e `git diff --check` verdi. Il runner si è chiuso senza lasciare processi browser o Node pendenti; nessun commit, push o deploy.

## 04/11/2026 — identità QA2, confronto Profilo pubblico/candidato e Azienda

- Creata senza rotazioni l'identità sintetica separata `codex.qa2@appcodici-password.invalid`, UID `1lfhs2WoDRNXA9huOK0u0ffjQC13`, e-mail verificata e Vault nuova. Il bundle locale è protetto con DPAPI nel percorso standard; QA1 non è stata toccata e nessun segreto è entrato in repository o log.
- Il Profilo sulla versione pubblicata perdeva l'utenza appena inserita: dopo reload la UI non mostrava righe e la rilettura server-confermata registrava `utilityCount: 0`. Il bundle pubblico usa ancora il contesto Indirizzi creato all'avvio, diventato obsoleto dopo `loadUserData()`.
- La candidata locale ricostruisce il contesto a ogni azione delegata. Due esecuzioni sulla copia Hosting locale hanno riletto immediatamente l'utenza cifrata; la seconda è idempotente e ha riletto anagrafica, nota, recapiti, indirizzo, Documento, Widget pubblico/segreto e Tessera digitale dopo reload, senza errori Console o rete. Gli allegati Documento sono stati esclusi sul solo origin locale perché la callable richiede App Check pubblico.
- Il lotto Azienda pubblico ha creato e poi riletto idempotentemente `QA Azienda Sintetica SRL`, companyId `wDYoVnxGwwlTkqge0htJ`. La seconda esecuzione ha trovato il record esistente e lo ha aggiornato senza duplicarlo. `registerSharingIdentity` ha restituito due `401` nel Chrome headless: il report resta formalmente `ok: false`, pur con creazione e rilettura Azienda superate; la condivisione non è dichiarata collaudata.
- Test QA **7/7**, controllo sintassi del runner e `git diff --check` verdi. Non sono stati eseguiti i collegamenti Profilo; nessun commit, push o deploy.

## 04/11/2026 — lotto Account parziale storico (QA1) e interlock DPAPI

- Questa evidenza descrive il tentativo storico sulla QA1 ed è stata superata operativamente dal lotto QA2 completo riportato sopra. Rimane valida per documentare l'interlock DPAPI e il motivo per cui la QA1 non deve essere ruotata o riutilizzata come recupero.
- Il runner UI idempotente ha riletto `QA Privato Standard`, `QA Privato Bancario`, `QA Privato Memorandum`, `QA Azienda Account Standard` e `QA Azienda Memorandum`. Password standard mascherata, controllo mostra/nascondi presente e IBAN bancario consultabile nella sezione dedicata. Il report è `.codex-tmp/qa-final/qa-accounts-report.json`.
- L'esecuzione si è arrestata prima di allegato sintetico, prove negative Account/Memorandum condiviso, Widget, credenziali comuni e archivio. Questi casi restano **non eseguiti**, non superati per inferenza.
- Il report headless contiene rifiuti `403` dell'exchange reCAPTCHA/App Check; le riletture Firestore eseguite sono riuscite, ma gli avvisi ambientali restano registrati e non vengono rimossi dal verbale.
- Alla ripetizione il file DPAPI previsto non esisteva più. Nessun provisioning è stato avviato: sull'identità QA esistente avrebbe creato nuove credenziali e un nuovo envelope Vault, rendendo illeggibili le fixture cifrate precedenti.
- Correzione locale fail-closed: identità QA esistente + contenitore DPAPI assente + nessun `--rotate` produce `QA_CREDENTIALS_MISSING_EXISTING_VAULT`; `shouldCreateVault` dipende ora soltanto da nuova identità o rotazione esplicita. Test QA **7/7** e `git diff --check` verdi.
- Ripresa consentita soltanto recuperando il file DPAPI originale sotto lo stesso profilo Windows oppure creando un nuovo utente QA distinto. È vietato usare la rotazione come recupero della Vault esistente.

## 03/11/2026 — piano avviato, collaudo visivo completo con utente QA

- Autorizzato l'uso dell'utente tecnico sintetico per popolare tutti i campi applicativi utili con dati fittizi riconoscibili e per percorrere l'app pagina per pagina come un utente umano.
- Baseline autenticata sulla versione pubblicata `1.2.253`: il banco isolato ha completato login, inserimento della Master Password tecnica, apertura Home e logout; `consoleErrors` e `networkErrors` sono vuoti. L'unico avviso è il rifiuto App Check/reCAPTCHA atteso nell'esecuzione headless e viene classificato separatamente.
- Inventario statico pre-finale completato: **30 pagine canoniche**, **125 istruzioni**, **110 target guida** e **167 campi HTML statici**. I campi creati dinamicamente restano assegnati al passaggio browser e non vengono dichiarati coperti dal solo inventario.
- Matrice autenticata della struttura privata completata su **24 pagine × 2 viewport = 48/48 `SHELL_OK`** (desktop 1440×1000 e telefono 393×852), senza errori applicativi Console o rete. Il messaggio CSP `report-only` dell'iframe Google e il limite App Check del Chrome headless sono avvisi ambientali espliciti, non errori ignorati.
- Controllati visivamente gli screenshot rappresentativi di Home, Profilo, Impostazioni, Account privato, Azienda e Scadenza. Il caricamento dinamico del nome, lo stato **Prima configurazione completata** e i tre comandi rapidi Home sono presenti dopo l'attesa corretta. Sulla versione pubblicata l'avatar Home privo di foto usa però una sorgente `data:` bloccata e appare rotto: il fallback è stato corretto localmente con l'immagine applicativa e protetto da test; resta da verificare dopo una futura pubblicazione autorizzata.
- Il provisioning QA riconcilia profilo e lingua senza sostituire l'intero documento e senza rigenerare la chiave Vault; lingua e completamento della prima configurazione vengono riletti e verificati dal documento remoto.
- La matrice comprende Profilo, Aziende, Account, vista bancaria, Memorandum, condivisioni, Widget, Documenti, Tessera digitale, Scadenze, allegati, archivi, Impostazioni e Ricerca; per ciascun ambito copre i cicli di vita disponibili e il controllo visivo desktop/telefono.
- Le condivisioni richiedono evidenza separata del mittente e del destinatario. L'eventuale riscontro comunicato da Diego verrà registrato come prova umana distinta. Account condivisi e Memorandum condivisi con allegati restano casi separati.
- Il collaudo distingue Widget bancari, Widget generici e Credenziali comuni. I testi creati dall'utente non devono essere alterati dal cambio lingua.
- Il collaudo completo parte in italiano; la matrice multilingua viene eseguita soltanto dopo la stabilizzazione funzionale e deve verificare tutte le pagine, i componenti dinamici, l'ARIA, l'Archivio portabile e le interfacce Backup/Ripristino. L'Archivio portabile traduce la presentazione e le esportazioni leggibili, non le chiavi canoniche del JSON; il Backup resta tecnicamente neutro.
- **Stato attuale: inventario e baseline strutturale conclusi; popolamento e cicli di vita non ancora eseguiti integralmente.** Le 48 aperture provano autenticazione, sblocco, shell e caricamento di base, non ancora creazione/modifica/archiviazione/condivisione di tutti i dati né le lingue.
- Primo lotto Profilo eseguito tramite UI reale sull'utente QA: anagrafica, nota cifrata, telefono fittizio, e-mail `.invalid`, indirizzo fittizio e utenza cifrata. La seconda esecuzione locale è idempotente e rilegge tutti i valori dopo il reload; report senza errori Console o rete in `.codex-tmp/qa-final/profile-fixture.json` e screenshot verificato in `.codex-tmp/qa-final/profile-populated.png`.
- Il percorso umano completo ha individuato un difetto non coperto dai test precedenti: dopo il refresh del Profilo, la delega Indirizzi/Utenze conservava gli array precedenti. Il salvataggio sembrava riuscire ma l'utenza non entrava nello stato corrente. La candidata ricostruisce il contesto a ogni azione delegata; test Profilo **176/176**, QA **8/8** e sintassi su **212 moduli** verdi. La prova sulla copia Hosting locale conferma salvataggio e rilettura; la versione pubblicata non è stata modificata.
- Secondo lotto Profilo eseguito con la stessa fixture idempotente: Documento `QA-DOC-0001`, allegato cifrato `qa-allegato-sintetico.txt`, Widget `QA Widget Profilo` con campo pubblico e campo cifrato, e Tessera digitale con i soli campi pubblici selezionabili. Il campo segreto non compare tra le scelte della Tessera. La prova headful sull'origine pubblica ha superato App Check, caricato e riletto l'allegato; la ripetizione sulla candidata locale ha riletto tutti gli altri valori senza errori Console o rete. Evidenze: `.codex-tmp/qa-final/profile-fixture.json`, `profile-populated.png`, `profile-widget.png` e `profile-documents.png`.
- Il controllo visivo del Documento ha scoperto password, PIN, PUK e codice app inizialmente esposti in chiaro. La candidata li rende ora tutti `••••••••`, con rivelazione esplicita e copia separata; il valore grezzo non viene montato nel testo iniziale. La regressione è coperta dal test di produzione degli allegati/documenti. Nessun deploy è stato eseguito; sul Profilo restano da collaudare i collegamenti Account/Scadenza.
- Collegamento Profilo → Account eseguito tramite UI reale: l'e-mail sintetica `.invalid` ha creato `QA Account Profilo`, il riferimento è stato riletto in una nuova sessione, il pulsante apre il dettaglio corretto e la password collegata resta `••••••••`. Il test idempotente non crea duplicati; report e screenshot sono in `.codex-tmp/qa-final/profile-links-fixture.json` e `profile-account-link.png`.
- Percorso Profilo → Documento → Scadenza verificato fino al compositore: intestatario, tipo, numero `QA-DOC-0001`, data `15/01/2040` e allegato cifrato arrivano dalla sorgente. Il salvataggio non è stato forzato perché l'utente QA non ha ancora una regola **Documenti personali**; l'interfaccia mostra correttamente lo stato vuoto. Evidenza in `profile-deadline-link-deferred.png`. La chiusura definitiva appartiene al lotto Regole/Scadenze e non viene dichiarata completata in anticipo.
- Lotto Azienda completato tramite UI reale sull'utente tecnico: `QA Azienda Sintetica SRL` contiene anagrafica e dati fiscali non reali, referente, sede legale e sede aggiuntiva, quattro e-mail `.invalid`, note cifrate, logo/foto sintetici e allegato cifrato. La ripetizione elimina tramite i normali comandi dell'app eventuali duplicati QA e conserva un solo record. La rilettura ha verificato tutte le schede, password inizialmente `••••••••`, Tessera digitale senza segreti e preparazione della Scheda PDF. Nessun errore Console o rete; evidenze in `.codex-tmp/qa-final/company-fixture.json`, `company-personal.png`, `company-contacts-masked.png`, `company-locations.png`, `company-digital-card.png` e `company-pdf-summary.png`.

<!-- generated:pages:start -->
#### Inventario QA finale

Fonte verificata: **31 pagine canoniche**, **126 istruzioni**, **111 target guida** e **167 campi HTML statici compilabili**.

> I campi creati dinamicamente dai moduli JavaScript non sono dichiarati coperti da questo inventario statico: vengono censiti e provati nel passaggio browser. BASELINE AUTOMATICA indica soltanto accesso/sblocco/Home, non il collaudo visivo completo della pagina.

| Pagina | Famiglia | Campi HTML statici | Target guida | Fixture necessaria | Stato |
|---|---|---|---|---|---|
| `index`<br>Codici & Password | access | 0: — | 0: — | Nessuna scrittura; ingresso e inoltro verso Accesso. | **NON ESEGUITO** |
| `login`<br>Codici & Password - Accedi | access | 4: email, password, remember-device, totp-code | 3: #login-form, #totp-help, #link-forgot-password | Identità QA verificata, password tecnica e Master Password DPAPI; nessun dato reale. | **BASELINE AUTOMATICA** |
| `registrati`<br>Codici & Password - Registrazione | access | 5: cognome, confirm-password, email, nome, password | 3: #register-form, #account-password-requirements, #register-submit-btn | Solo percorso controllato o ambiente isolato; non creare nuove identità durante il passaggio ordinario. | **NON ESEGUITO** |
| `reset_password`<br>Codici & Password - Recupero | access | 1: email | 2: #reset-form, #reset-submit-btn | Solo controllo UI; non inviare e-mail durante il passaggio ordinario. | **NON ESEGUITO** |
| `imposta_nuova_password`<br>Codici & Password - Nuova Password | access | 3: confirm-password, new-password, username | 2: #account-password-requirements, #new-pass-submit-btn | Solo controllo UI con collegamento sintetico dedicato quando autorizzato. | **NON ESEGUITO** |
| `home_page`<br>Home Page | internal | 0: — | 1: #upcoming-count | Scadenze sintetiche future, odierne, urgenti e ricevute per riepiloghi e comandi rapidi. | **BASELINE AUTOMATICA** |
| `area_privata`<br>Area Privata - PROTOCOLLO BASE | internal | 0: — | 2: #top-accounts-list, #btn-reset-views | Un record sintetico per Account, Condiviso, Memorandum e Memorandum condiviso. | **NON ESEGUITO** |
| `account_privati`<br>Account Privati - PROTOCOLLO BASE | internal | 1: account-search | 3: #account-search, #sort-btn, #accounts-container | Quattro modalità Account, stato vuoto, ricerca, ordinamento e un archiviato escluso. | **NON ESEGUITO** |
| `form_account_privato`<br>Dettaglio Account Privato | internal | 17: account-code, account-name, account-note, account-password, account-url, account-username, account-widget-template-select, flag-account, flag-banking, flag-memo, flag-memo-shared, flag-shared, invite-email, logo-input, ref-mobile, ref-name, ref-phone | 6: #account-name, #account-mode-edit-controls, #flag-banking, #account-widgets-section, #shared-credentials-section, #shared-management | Account standard, bancario, Memorandum e condiviso; Widget, credenziale comune e allegato piccolo. | **NON ESEGUITO** |
| `dettaglio_account_privato`<br>Dettaglio Account Privato - PROTOCOLLO BASE | internal | 12: account-widget-template-select, detail-account, detail-nomeAccount, detail-password, detail-referenteCellulare, detail-referenteNome, detail-referenteTelefono, detail-username, detail-website, input-camera, input-file, input-gallery | 6: #toggle-password, #banking-toggle, #account-widgets-section, #btn-edit-account-note, #btn-add-attachment, #shared-management-section | Record completo con password, nota, banking, Widget, credenziale comune, allegato e permessi. | **NON ESEGUITO** |
| `profilo_privato`<br>Profilo Utente - PROTOCOLLO BASE V5.0 | internal | 4: avatar-input, qr-toggle-cf, qr-toggle-nascita, qr-toggle-nome | 6: #profile-tabs, #avatar-trigger, #telefoni-view-container, #indirizzi-view-container, #documenti-view-container, #profile-digital-card | Anagrafica, contatti, indirizzo, utenze, Documento con allegato, tessera digitale e collegamenti Account/Scadenza. | **PARZIALE · dati completi e Account collegato; Scadenza rinviata alla creazione della regola QA** |
| `lista_aziende`<br>Le Mie Aziende - PROTOCOLLO BASE | internal | 0: — | 1: #aziende-list-container | Due aziende sintetiche, una con sedi e record nelle quattro modalità Account. | **PASSA · azienda sintetica unica creata e riletta** |
| `dati_azienda`<br>Profilo aziendale | internal | 6: cciaa, codice-sdi, data-iscrizione, note-azienda-edit, piva, referente-cellulare | 4: #company-overview, #company-digital-card, #company-pdf-summary, #company-locations-list | Azienda completa con sede, contatti, QR/tessera e riepilogo PDF sintetico. | **PASSA · schede, segreti mascherati, QR e PDF verificati** |
| `modifica_azienda`<br>Modifica Azienda | internal | 49: cap, cciaa, citta, civico, codice-sdi, data-iscrizione, email-amministrazione, email-amministrazione-note, email-amministrazione-password, email-pec, email-pec-note, email-pec-password, email-personale, email-personale-note, email-personale-password, fax-azienda, forma-giuridica, indirizzo, input-camera, input-file, input-gallery, logo-upload, note-azienda, piva, provincia, qr-amministrazione, qr-cciaa, qr-data-iscr, qr-partita-iva, qr-pec, qr-personale, qr-ragione-sociale, qr-referente-cellulare, qr-referente-cognome, qr-referente-nome, qr-referente-titolo, qr-sdicodici, qr-sede-legale, ragione-sociale, referente-cellulare, referente-cognome, referente-nome, referente-photo-upload, referente-ruolo, telefono-azienda, tipo-sede-legale, type-amministrazione, type-pec, type-personale | 5: #ragione-sociale, #btn-toggle-fiscal, #btn-toggle-locations, #btn-toggle-emails, #btn-trigger-upload | Anagrafica, dati fiscali non validi, referente fittizio, sedi, tre e-mail non raggiungibili, note e immagini sintetiche. | **PASSA · anagrafica, sedi, contatti, immagini e allegato completi** |
| `account_azienda`<br>Account Azienda - PROTOCOLLO BASE | internal | 1: account-search | 3: #account-search, #sort-btn, #accounts-container | Quattro modalità Account nell’azienda QA, ricerca, filtri, ordinamento e archiviato escluso. | **NON ESEGUITO** |
| `form_account_azienda`<br>Account Azienda | internal | 19: account-code, account-codice-societa, account-name, account-note, account-numero-iscrizione, account-password, account-url, account-username, account-widget-template-select, flag-account, flag-banking, flag-memo, flag-memo-shared, flag-shared, invite-email, logo-input, ref-mobile, ref-name, ref-phone | 6: #account-name, #account-mode-edit-controls, #flag-banking, #account-widgets-section, #shared-credentials-section, #shared-management | Account standard, bancario, Memorandum e condiviso nel contesto aziendale; Widget e credenziale comune. | **NON ESEGUITO** |
| `dettaglio_account_azienda`<br>Dettaglio Account Azienda - PROTOCOLLO BASE | internal | 14: account-widget-template-select, detail-account, detail-codice-societa, detail-nomeAccount, detail-numero-iscrizione, detail-password, detail-username, detail-website, input-camera, input-file, input-gallery, ref-mobile, ref-name, ref-phone | 6: #toggle-password, #banking-toggle, #account-widgets-section, #btn-edit-account-note, #btn-add-attachment, #shared-management-section | Record aziendale completo con nota, banking, Widget, allegato e permessi. | **NON ESEGUITO** |
| `scadenze`<br>Scadenze - PROTOCOLLO V5.0 | internal | 1: deadline-search | 3: #deadline-search, #sort-btn, #scadenze-list | Scadenze sintetiche proprie/ricevute, future/odierne/urgenti/archiviate e ricerca. | **NON ESEGUITO** |
| `aggiungi_scadenza`<br>Componi Scadenza - PROTOCOLLO V5.0 | internal | 19: deadline_url, deadline-company-context-select, deadline-contact-select, deadline-domain-select, deadline-external-company-name, deadline-parameter-select, deadline-rule-select, dueDate, input-camera, input-file, input-gallery, modello_veicolo, nome_cognome, notes, notif_days_before, notif_frequency, oggetto_email, testo_email_select, tipo_scadenza | 5: #deadline-domain-select, #dueDate, #notif_days_before, #btn-manage-deadline-contacts, #attachments-section | Scadenza personale e aziendale con data, regola, destinatario non raggiungibile, pianificazione e allegato piccolo. | **NON ESEGUITO** |
| `dettaglio_scadenza`<br>Dettaglio Scadenza - PROTOCOLLO V5.0 | internal | 0: — | 4: #detail-date-day, #section-planning, #section-attachments, #detail-page-actions | Scadenza completa con pianificazione, fonte, destinatari, allegato e azioni permesse. | **NON ESEGUITO** |
| `regole_scadenze`<br>Regole Scadenze - PROTOCOLLO BASE V5.0 | internal | 0: — | 2: #deadline-tab-personal, #deadline-panel-personal | Regole sintetiche in ogni linguetta operativa e Documento personale collegato. | **NON ESEGUITO** |
| `configurazione_automezzi`<br>Configurazione Automezzi - PROTOCOLLO BASE V5.0 | internal | 0: — | 3: #vehicle-rule-title, #btn-add-email-object, #btn-save-vehicle-rule | Regola veicolo con modello/targa fittizi, oggetto, testo e pianificazione. | **NON ESEGUITO** |
| `configurazione_documenti`<br>Configurazione Documenti - PROTOCOLLO BASE V5.0 | internal | 0: — | 3: #btn-add-type, #btn-add-model, #btn-add-template | Tipo, modello e testo sintetici per Documento. | **NON ESEGUITO** |
| `configurazione_generali`<br>Configurazione Generali - PROTOCOLLO BASE V5.0 | internal | 0: — | 2: #btn-add-type, #btn-add-template | Tipo e testo sintetici per regola generale. | **NON ESEGUITO** |
| `impostazioni`<br>Impostazioni - PROTOCOLLO BASE V5.0 | internal | 7: 2fa-toggle, company-area-toggle, deadline-push-toggle, face-id-toggle, frame-diagnostics-toggle, performance-diagnostics-toggle, sharing-push-toggle | 20: #btn-toggle-lang, #theme-settings-toggle, #company-area-toggle, #btn-account-archive, #btn-shared-credentials, #btn-export-encrypted-backup, #btn-restore-encrypted-backup, #btn-credential-health, #btn-account-field-usage, #btn-expiry-rules, #btn-change-password, #btn-regenerate-recovery-codes, #btn-change-master-password, #face-id-toggle, #lock-timer-selector, #btn-reset-vault, #btn-revoke-all-sessions, #deadline-push-toggle, #btn-run-app-diagnostics, #logout-btn-settings | Preferenze QA reversibili; Account archiviato, credenziale comune, backup/archivio sintetici e diagnostica senza notifiche reali. | **NON ESEGUITO** |
| `gestione_destinatari`<br>Gestione destinatari - Codici & Password | internal | 3: recipient-email, recipient-first-name, recipient-last-name | 3: #recipient-first-name, #recipient-email, #recipient-list | Tre destinatari .invalid: privato, aziendale e disattivato; nessun recapito raggiungibile. | **NON ESEGUITO** |
| `archivio_account`<br>Archivio Account - PROTOCOLLO BASE V5.0 | internal | 1: archive-search | 3: #archive-filter-btn, #archive-search, #btn-empty-trash | Account e Memorandum sintetici archiviati; ripristino e cancellazione soltanto delle fixture QA. | **NON ESEGUITO** |
| `contatto_condiviso`<br>Salva contatto — Codici &amp; Password | public-contact | 0: — | 3: #contact-details, #save-contact, #retry-contact | vCard/QR completamente fittizio e privo di recapiti reali. | **NON ESEGUITO** |
| `privacy`<br>Privacy Policy - PROTOCOLLO BASE V5.0 | internal | 0: — | 0: — | Nessuna fixture; lettura, navigazione, zoom, tastiera e link. | **NON ESEGUITO** |
| `termini`<br>Termini e Condizioni - PROTOCOLLO BASE V5.0 | internal | 0: — | 0: — | Nessuna fixture; lettura, navigazione, zoom, tastiera e link. | **NON ESEGUITO** |
| `app`<br>Vault bloccata | internal | 0: — | 1: #frame-resume | Cornice A2 spenta: solo pagina inattiva e ritorno Home; nessuna Vault o scrittura. Browser del broker separato con identità sintetica. | **NON ESEGUITO** |

#### Regole di esecuzione

- Ogni riga passa da `NON ESEGUITO` a un esito soltanto dopo controllo browser della pagina reale.
- Per ogni percorso si registrano viewport, Console, rete, focus/tastiera, creazione, rilettura, modifica e cleanup applicabili.
- I valori usano il prefisso `QA-SINTETICO` e domini `.invalid`; allegati e immagini sono piccoli e generati per il test.
- Condivisioni, notifiche reali, MFA, biometria e prove fisiche restano evidenze separate e non vengono simulate come riuscite.
<!-- generated:pages:end -->

## 29/10/2026 — rubrica destinatari e contesti aziendali

- Test mirati sul modello verificano etichetta compatta **Nome Cognome — e-mail**, ordinamento dei soli contatti realmente associati, sostituzione esplicita delle associazioni e deduplica per email.
- I controlli statici verificano che il gestore non usi più l’associazione automatica e che il compositore non aggiunga il nome dell’azienda all’etichetta del contatto.
- La rimozione di un collegamento richiede conferma e non modifica le Scadenze già salvate. Nessuna migrazione e nessuna scrittura su dati reali sono incluse nel collaudo.
- Verifica candidata `1.2.243` completata: **15/15** test mirati, controllo versione su **267** riferimenti, build offline e dipendenze senza cicli, controlli documentali **11/11**, suite Functions **468** verdi con **9** esclusioni previste e intera sequenza emulatori Firebase conclusa senza errori.

## 25/10/2026 — consultazione completa e XLSX dell'Archivio portatile

- Test puri Portable Archive verdi **17/17**: separazione campi tecnici, timestamp leggibili, proiezioni future-safe e pacchetto XLSX OOXML nativo con fogli, filtri, colonne e celle testuali. Apertura indipendente con openpyxl 3.1.5 riuscita: fogli e filtro leggibili, codice sintetico `00123` conservato come stringa con formato testo.
- Banco Chrome offline verde: apertura fail-closed, navigazione, viewport desktop/mobile, esportazioni e allegato riletti e autenticati. Poiché il Chrome headless installato annulla anche un download Blob minimo indipendente, il contenuto salvato è verificato tramite sink File System Access sintetico; il limite ambientale non è attribuito al visualizzatore.
- Probe di capacità verde fino allo stream sintetico da **485 MiB**: output cifrato **646,9 MiB**, scrittura massima **1,33 MiB**, picco RSS circa **293,4 MiB**. Nessun dato o allegato reale è stato usato.
- `git diff --check` verde. Formato cifrato v2, manifest, limiti e flusso degli allegati a blocchi invariati. Modifica inclusa nella candidata Hosting `1.2.236` autorizzata dall'ordine **«pubblichiamo tutto»**.

## 24/10/2026 — Archivio portatile con video sintetico da 485 MiB

- Test puri Portable Archive verdi **17/17**: formato v2, inventario logico dei blocchi, writer da iterabile asincrono, limiti, manomissione, EOF e UI.
- Test sicurezza allegati verdi **22/22**: manifest valido, ordine, dimensioni, decifratura progressiva e rifiuto delle alterazioni.
- Il probe isolato usa esclusivamente byte sintetici generati in blocchi da 8 MiB. Per 1×485 MiB registra output cifrato **646,9 MiB**, scrittura massima al sink **1,33 MiB**, picco RSS circa **292,2 MiB** e nessun buffer monolitico. Anche 1×32, 2×32 e 8×32 MiB restano sotto 384 MiB RSS.
- Il banco browser offline è verde in Chrome desktop fuori dal sandbox: password errata, manomissione, dati finali, conteggi, limiti, allegati, download e viewport. Nel sandbox il download di Chrome veniva annullato dal contenimento; una prova Blob minima indipendente ha riprodotto lo stesso vincolo ambientale.
- Sintassi JavaScript verificata su **222 moduli**. Nessun allegato reale, Vault reale o dato utente è stato letto o scritto; il video da circa 485 MB non è stato riesportato.

## 23/10/2026 — testo completo della nuova Scadenza in Dettaglio, e-mail e Push

- La prova reale **Olio motore** ha prodotto una sola Scadenza, correttamente collegata alla nuova regola, ma il Dettaglio aggiungeva il prefisso storico e il riferimento veicolo al `templateText` già completo.
- La successiva e-mail reale ha confermato lo stesso residuo backend: il corpo conteneva il testo completo seguito da una seconda copia di `Hyundai I10 - FL790AX`.
- La correzione distingue i record strutturati (`ruleId` + `ruleDomain`) dai record legacy: i primi usano il testo finale una sola volta; i secondi mantengono la composizione storica.
- Test mirati modello, lifecycle del Dettaglio, invio e-mail e notifiche Push verdi **60/60**; conservato il fallimento sicuro per un `templateText` malformato.
- Regressione completa `npm test` conclusa con codice 0; emulatori Firebase arrestati regolarmente.
- Nessuna Scadenza reale è stata modificata dalla correzione e nessuna Function è stata distribuita.

## 22/10/2026 — recupero dello stato Push dopo token revocato

- I log di produzione hanno mostrato il precedente token iOS come non registrato; il record dispositivo era stato invalidato correttamente.
- Dopo la nuova registrazione sul secondo telefono, la prova Push è arrivata in pochi secondi: token, destinatario e callable risultano quindi operativi.
- Individuata l'incoerenza residua nel client: la registrazione riuscita riattivava il dispositivo senza rimuovere `status: invalid` e `invalidatedAt`.
- La candidata `1.2.227` salva `status: active`, elimina `invalidatedAt` e forza il nuovo modulo con `push=20261022a`.
- Il test mirato `push-registration-recovery` verifica sia il recupero sia la normalizzazione del record. Nessun dato reale è stato modificato manualmente.

## 22/10/2026 — diagnosi del video da 485 MB nel Memorandum

- Controllo autenticato in sola lettura del record **Impianto elettrico sottotetto casa**: presente `IMG_2282.jpeg`, 6.384.039 byte, `image/jpeg`; nessun metadato video nella sottoraccolta allegati.
- Inventario Storage dello stesso Account: presente soltanto l'oggetto cifrato della foto; nessun blocco video orfano. Il flusso ha quindi rifiutato il file prima dell'invio oppure ha compensato correttamente un upload interrotto.
- Circa 485 MB restano sotto il limite applicativo di 512 MiB. Aggiunta compatibilità prudente per MIME generico dei video `.mov`, `.mp4`, `.m4v` e `.webm`, senza estendere formati o documenti non video.
- Durante un video grande la pagina mostra ora avanzamento persistente, avviso di non uscita, Wake Lock ove supportato e causa operativa in caso di errore. La prova mirata della sicurezza allegati è verde **22/22**; sintassi JavaScript su **222 moduli** e riferimenti statici su **315 file** sono verdi.
- La suite integrale `npm test` è terminata con codice **0**, inclusi Functions/security, Firestore Rules, Storage Rules, Vault e tutti gli emulatori Firebase previsti. Verdi anche lifecycle e Allegati mirati **34/34**, budget su **30 pagine**, CSS, fondamenta UI e `git diff --check`.
- Nessun file reale è stato ritentato, caricato, cancellato o modificato durante il controllo. Il collaudo fisico resta a Diego dopo la pubblicazione Hosting.

## 19/10/2026 — revisione locale Account/Memorandum

- Le card della Lista aziende già pubblicate nella `1.2.208` non sono state modificate. È stato aggiunto un caso di regressione che trasforma un Account e un Memorandum da privati a condivisi e verifica che ciascun record cambi una sola categoria, senza duplicazioni; gli archiviati restano esclusi dal riepilogo.
- Riprodotta la sovrascrittura dei comandi di copia bancari nel solo dettaglio aziendale: il selettore generico ora esclude in entrambi i contesti i pulsanti con `data-banking-copy="true"`.
- Dettagli e riepiloghi dei destinatari riconoscono i quattro modi tramite il modello canonico comune, inclusi i flag dei record storici.
- I moduli di modifica privato e aziendale non nascondono più **Account condiviso** sui record esistenti. Restano attive esclusione reciproca dei modi, validazione delle credenziali dei Memorandum, conferma della revoca e selezione dei destinatari.
- Il controllo successivo ha riprodotto il lampeggio riferito dall'utente: **Account condiviso** era l'unico modo in un contenitore autonomo. I quattro modi sono ora nello stesso gruppo, inizialmente chiuso durante il caricamento. In modifica viene nascosto soltanto il modo corrente e sono mostrate esattamente le altre tre alternative; il nuovo comando **Account** consente il ritorno esplicito da Account condiviso o da un Memorandum.
- Verdi: matrice delle quattro modalità e dei due moduli **3/3**, regressione estesa dei form e flussi Account/Memorandum **291/291**, navigazione **168/168**, i18n **14/14**, accesso dati **95/95**, sicurezza **25/25**, HTML puro, CSS, shell pagine, riferimenti statici, sintassi JavaScript su **218 moduli**, documentazione **11/11** e `git diff --check`.
- Il primo gate integrale della candidata `1.2.209` ha respinto entrambi i form a **46 moduli > 45**. Eliminato il nuovo import senza eliminare il comportamento: il selettore usa ora il modello Account già caricato, la shell offline torna a **307 risorse** e il budget è verde su 30 pagine.
- Il secondo gate integrale ha superato anche il budget, poi si è fermato sul controllo intenzionale della Guida: `reviewedAppVersion` conservava la base `1.2.208`. Il catalogo è stato riesaminato senza modifiche editoriali e allineato alla candidata `1.2.209` prima della ripetizione completa.
- La ripetizione definitiva di `npm test` è terminata con codice **0**: documentazione **11/11**, Guida **6/6**, navigazione **168/168**, accesso dati **95/95**, sicurezza **25/25**, i18n **14/14**, budget, dipendenze, Functions/security, Firestore Rules, Storage Rules, Vault e tutti gli emulatori sono verdi.
- Graphify principale riallineato dopo il consolidamento e il bump: **13.370 nodi**, **35.068 archi** e **748 comunità**.
- PR `#183` integrata nel commit `dc7d0955`; gate GitHub verdi. Il workflow manuale `39259111507` ha ripetuto la validazione completa in 6m38s e completato **Deploy Hosting only** in 41s.
- Verifica HTTP pubblica `200` su Home, modulo Account privato, modulo Account aziendale e modello condiviso; le pagine confermano la versione `1.2.209`. Nessuna Function, Rule, indice, migrazione o dato reale è stato modificato o distribuito. Il controllo visivo/manuale dei contatori dopo una condivisione reale resta nella lista dei collaudi futuri.

## 19/10/2026 — candidata 1.2.208, card aziendali per tipologia

- Ogni card della Lista aziende conserva l'accesso separato ai Dati azienda e aggiunge quattro azioni con contatore: Account, Condivisi, Memorandum e Memo condivisi.
- I conteggi usano i record Account dell'azienda, ignorano gli archiviati e non vengono scritti nel documento Azienda. La rotta filtrata usa `type`; la rotta senza parametro conserva la vista completa.
- La pagina Account azienda espone gli stessi filtri con conteggi e il comando di aggiunta eredita la categoria selezionata. Le otto lingue possiedono le nuove chiavi e la guida locale è stata riesaminata come `contentVersion` 3.
- Primo avvio completo interrotto dal gate Guida perché il metadato conservava correttamente la base precedente `1.2.207`; aggiornati versione e contenuti del catalogo, il gate mirato è tornato verde.
- Secondo avvio `npm test` terminato con codice **0**, inclusi documentazione **11/11**, guida **6/6**, navigazione **166/166**, accesso dati **95/95**, sicurezza **25/25**, offline **14/14**, i18n **14/14**, Functions/security **473 totali, 464 superati, 9 esclusi e 0 errori**, Rules, Storage, Vault e tutti gli emulatori Firebase. Shell offline: **307 risorse**; sintassi: **218 moduli**; riferimenti statici: **311 file**; nessuna dipendenza circolare.
- Graphify principale riallineato dopo il bump/versionamento degli asset: **13.347 nodi, 35.010 archi e 740 comunità**. Il diff non contiene modifiche a Functions, Rules o indici.
- Pubblicazione autorizzata sul solo Firebase Hosting; il collaudo della Push sul secondo telefono resta indipendente.
- PR `#181` integrata nel commit `eeb67bf7`; due gate documentali e validazione GitHub completa verde in 7m56s. Il workflow manuale `39243406078` ha ripetuto la validazione in 6m34s e completato **Deploy Hosting only** in 44s. Home, Lista aziende e i tre moduli interessati rispondono HTTP `200` e mostrano versione o contratti della `1.2.208`.

## 19/10/2026 — recupero della prova Push da record già non attivo

- Evidenza iPhone sulla `1.2.206`: runtime `push=20261018b` caricato, revoca FCM della registrazione precedente conclusa con `403` e successiva callable `sendDeadlinePushTest` conclusa con HTTP `400`; il warning di durata del gestore `load` non è causale.
- Il sorgente conferma che il client recuperava `push-token-invalid`, ma non eseguiva un precontrollo prima della prova e non gestiva la risposta backend **Notifiche non attive su questo dispositivo**.
- La candidata `1.2.207` interroga il record confermato, forza la registrazione distinta se token, stato o ambito Scadenze non sono coerenti, conserva gli ambiti locali/server e limita a uno il nuovo tentativo della callable.
- La schermata rilegge lo stato dopo la prova, così un fallimento non lascia interruttore o pulsante in uno stato soltanto apparente.
- Prove mirate `push-registration-recovery` verdi **2/2** e `git diff --check` verde. La suite integrale `npm test` è terminata con codice **0**, compresi documentazione, controlli statici, sicurezza, offline, Functions, Firestore Rules, Storage Rules, Vault, ripristino e tutti gli emulatori Firebase. Il primo avvio isolato si era fermato sul noto limite Windows `EPERM` dei repository temporanei documentali; la ripetizione fuori sandbox ha completato l'intera catena senza errori applicativi. Graphify principale riallineato: **13.320 nodi, 34.960 archi e 727 comunità**. Ordine di pubblicazione ricevuto: i gate completi precedono commit, integrazione e distribuzione del solo Hosting; il collaudo fisico resta distinto.
- PR `#179` integrata nel commit `1d91eee1`; due gate documentali e validazione GitHub verde in 6m46s. Il workflow manuale `39221884870` ha ripetuto la suite in 8m00s e completato **Deploy Hosting only** in 47s.
- Verifica pubblica: HTTP `200` su Home, Impostazioni, `push-manager.js?push=20261019c` e `push-settings-controller.js?push=20261019c`; versione `1.2.207`, precontrollo del record, recupero dello stato non attivo e `await render()` presenti. Functions, Rules, indici, migrazioni e dati reali non sono stati distribuiti.

## 19/10/2026 — compatibilità CSP del motore AI locale WebAssembly

- Evidenza del browser: `WebAssembly.instantiate()` del runtime ONNX viene bloccato dalla direttiva `script-src` perché mancava una sorgente che autorizzasse la compilazione WebAssembly.
- Il candidato aggiunge esclusivamente `'wasm-unsafe-eval'`; la sorgente generale `'unsafe-eval'`, che consentirebbe valutazione dinamica JavaScript, resta assente.
- Il gate di hardening confronta ora token CSP esatti e un test degli artefatti AI verifica congiuntamente presenza del permesso WebAssembly e assenza del permesso JavaScript generale.
- La UI precedente elencava Leggera, Media e Potente ma usava sempre il candidato Leggera. Il candidato locale espone un gruppo di scelta accessibile, marca la raccomandazione del dispositivo e passa la taglia selezionata al catalogo, al download e alla verifica. Il blocco dei pacchetti nasce nascosto e segue immediatamente l'interruttore Agente AI; il percorso di errore riallinea sia l'interruttore sia la visibilità.
- Verifica remota in sola lettura: i `runtime/factory.js` delle taglie Media e Potente rispondono entrambi HTTP `200` sull'Hosting pubblico; il difetto non dipende dall'assenza dei pacchetti distribuiti.
- Verdi: contratti AI locale **34/34**, prova Chrome headless con tre scelte e raccomandazione coerente, sicurezza **25/25**, shell offline **14/14**, navigazione **165/165**, i18n **14/14**, fondazioni UI **6/6**, sintassi JavaScript su **218 moduli**, riferimenti statici su **311 file**, HTML puro, CSS e hardening di rilascio.
- Graphify principale aggiornato dopo il cambiamento strutturale e il bump della candidata: **13.302 nodi, 34.948 archi e 708 comunità**.
- Candidata `1.2.206`: suite completa verde, inclusi i banchi Rules, Storage, Vault e tutti gli emulatori Firebase. Il solo arresto iniziale era dovuto a `firebase-tools` assente dal `node_modules` isolato del worktree; collegata la dipendenza già installata nel progetto principale, il banco e tutti i controlli successivi sono terminati senza errori applicativi.
- Ordine di pubblicazione ricevuto il 19/10/2026. Perimetro: solo Firebase Hosting; nessuna modifica o distribuzione di Functions, Firestore Rules, Storage Rules, indici, migrazioni o dati reali.
- PR `#177` integrata nel commit `7ce91633`; due gate documentali e validazione GitHub verde in 6m39s. Il workflow `39212436454` ha ripetuto la validazione in 7m59s e pubblicato il solo Hosting in 45s.
- Verifica remota: HTTP `200` su Home, Impostazioni e modulo Push; versione `1.2.206`, rotazione dello scope Push, pannello AI.2 e CSP `'wasm-unsafe-eval'` presenti. La sorgente generale `'unsafe-eval'` resta assente.
- Nessun deploy di Functions, Firestore Rules, Storage Rules, indici, migrazioni o dati. La consegna fisica della Push resta da confermare sull'iPhone dopo la riapertura dell'app installata.

## 18/10/2026 — correzione locale successiva alla 1.2.205, rotazione Web Push iPhone

- Il racconto del collaudo e i log Cloud Run coincidono: il primo tentativo ha invalidato il token FCM non registrato; i successivi hanno trovato il dispositivo inattivo. Otto richieste fra le 23:41 e le 23:43 sono terminate con HTTP `400`; quattro riportano esplicitamente `messaging/registration-token-not-registered`.
- La console iPhone conferma anche il tentativo di eliminazione remota della vecchia registrazione FCM con risposta `403`. Nel runtime Firebase `12.18.0` questo errore viene intercettato; non coincide con gli avvisi prestazionali dei gestori `setTimeout`/`load` e non elimina la necessità di creare una subscription distinta.
- La causa residua è nel recupero client: su iOS `unsubscribe()` può produrre di nuovo gli stessi parametri della subscription e il SDK Firebase riutilizza il token memorizzato. Il candidato locale registra il worker sotto uno scope progressivo solo dopo un rifiuto permanente, forza così una subscription distinta, conserva gli ambiti e revoca il worker sostituito dopo il salvataggio del nuovo token.
- Prova mirata del contratto di recupero **1/1**, sicurezza **25/25**, shell offline **14/14**, navigazione **165/165**, i18n **14/14**, guida **6/6**, documentazione **11/11**, sintassi JavaScript **218 moduli**, riferimenti statici su **311 file** e hardening di rilascio verdi. Il primo avvio dei test documentali nel sandbox Windows è stato impedito da `EPERM` sui repository temporanei; la ripetizione autorizzata fuori dal sandbox ha superato tutte le **11/11** prove. Graphify principale riallineato: **13.263 nodi, 34.899 archi e 692 comunità**. Il collaudo fisico richiede una futura pubblicazione esplicitamente autorizzata e un nuovo comando di prova sull’iPhone.

## 18/10/2026 — pubblicazione 1.2.205, test Push iPhone con rinnovo del token FCM

- Evidenza reale: callable raggiunta con Auth e App Check validi; FCM restituisce `messaging/registration-token-not-registered` per il token iPhone. Il `[500]` mostrato dall’app era quindi la perdita di questa classificazione nel solo comando di prova.
- Prove sintetiche dedicate: token rifiutato marcato `invalid` e limite del tentativo liberato; errore temporaneo senza disattivazione; token sostituito in parallelo conservato. Recupero client: Service Worker esplicito, conservazione degli ambiti e un solo nuovo tentativo.
- Test mirati **26/26**; suite Functions/security **473 totali, 464 superati, 9 esclusi esplicitamente, 0 errori**; sintassi JavaScript **218 moduli**; `git diff --check` verde prima dell’aggiornamento documentale.
- Graphify principale rigenerato sulla candidata: **13.274 nodi, 34.932 archi e 677 comunità**; l’indice resta un supporto e le decisioni sono state verificate nel sorgente e nei log.
- PR `#175`: due controlli documentali e validazione GitHub completa verdi; merge `0ae341c0` in `master`, con validazione conclusa in 7m58s.
- Deploy Firebase riuscito: **343 file Hosting** e sola callable `sendDeadlinePushTest` aggiornata in `europe-west1`. `gcloud functions describe` la conferma `ACTIVE`, revisione `senddeadlinepushtest-00023-mif`, aggiornamento `2026-10-18T21:07:05Z`.
- Verifica remota: Home serve `v1.2.205`; `main-v129.js` usa il cache-bust `push=20261018a`; il modulo Push pubblico contiene `push-token-invalid` e `serviceWorkerRegistration`.
- Firestore Rules, Storage Rules, indici, migrazioni, altre Functions e dati reali sono rimasti esclusi. La ricezione reale su iPhone non è attestata dal banco: richiede l’apertura dell’app installata e un nuovo invio dal pulsante di prova.

## 18/10/2026 — pubblicazione 1.2.201, editor dedicato Scadenze dei Documenti personali

- La data del Documento è conservata in formato canonico nel modello e mostrata secondo la lingua dell'app; in italiano usa `gg/mm/aaaa`. Il nuovo editor dedicato presenta come riepilogo non modificabile intestatario, tipo, numero, ente emittente e scadenza, senza riproporre i selettori del compositore storico.
- Il messaggio proposto deriva dalle regole configurate per la tipologia del Documento e può essere modificato per la singola Scadenza. Numero ed ente emittente restano campi distinti; Email e Push usano lo stesso testo salvato senza duplicare il numero.
- Restano modificabili preavviso, frequenza, destinatari e canali, permesso di gestione, allegati e note. **Regole scadenze → Documenti personali** legge lo stesso record collegato e mostra anche il messaggio configurato, senza crearne una copia.
- Test mirati frontend **30/30**, Functions Email/Push **28/28**, Profilo **167/167**, navigazione **163/163**, offline **14/14**, i18n **14/14**, guida **6/6**, diagnostica prestazioni **3/3**, documentazione **11/11**. La suite Functions/security conta **468** prove: **459 superate**, **9 saltate esplicitamente**, **0 errori**. Verdi anche sintassi di **218 moduli**, riferimenti statici su **311 file**, HTML puro, shell pagine, CSS, dipendenze circolari, hardening e budget statico.
- Graphify principale è stato rigenerato sulla candidata `1.2.201`: **13.184 nodi**, **34.859 archi** e **622 comunità**; le relazioni del generatore di messaggio e del riepilogo destinatari con l'editor sono state poi verificate nel sorgente.
- PR `#167` integrata su `master` nel commit `43d9d238`; gate documentali e validazione GitHub verdi, con suite completa conclusa in 6m26s. Il job automatico di deploy era saltato: il deploy esplicito autorizzato ha quindi pubblicato **343 file Hosting** e aggiornato con successo le Functions Node.js 22 in `europe-west1`.
- Verifica pubblica HTTP `200` su Home, editor Scadenza, Regole scadenze e Profilo; versione `1.2.201`, riepilogo Documento, generatore del messaggio e azione italiana **Configura scadenza** confermati negli asset serviti.
- La ricezione reale di Email e Push e la resa su telefono richiedono un collaudo distinto dopo la pubblicazione; Firestore Rules, Storage Rules, indici, migrazioni e dati reali sono rimasti esclusi.

## 17/10/2026 — pubblicazione 1.2.200, configurazione Scadenza da Documento

- Test mirati **28/28**, navigazione **161/161**, offline **14/14**, i18n **14/14**, guida **6/6**, documentazione **11/11**, diagnostica prestazioni **3/3**; verdi anche versione, sintassi di **218 moduli**, riferimenti statici su **311 file**, CSS, dipendenze circolari, hardening e `git diff --check`.
- Il catalogo guida è stato riesaminato sulla `1.2.200`: **30 pagine**, **126 istruzioni** e **112 target** univoci; il target del Preavviso punta al nuovo campo modificabile `notif_days_before`.
- Graphify principale è stato rigenerato dopo le modifiche JavaScript strutturali: 13.126 nodi, 34.766 archi e 601 comunità. Il grafo resta un indice di supporto e non sostituisce i test.
- PR `#165`: due controlli documentali e `validate` completa verde in 7m49s; merge `572ad57b` in `master`.
- Deploy riuscito sul solo Firebase Hosting: **343 file**. Verifica remota HTTP `200` su Home, editor Scadenza, modulo bozza di ritorno e catalogo guida, con versione `1.2.200` confermata.
- Functions, Firestore Rules, Storage Rules, indici, migrazioni e dati reali sono rimasti esclusi. La ricezione effettiva di Email e Push non è attestata dai test sintetici e resta una prova manuale dell'utente.

## 17/10/2026 — pubblicazione 1.2.199, Scadenze definitive dai Documenti

- I test sintetici devono verificare che la proposta avvenga soltanto dopo la persistenza del Documento e che **Configura scadenza** apra l'editor completo; dopo il collegamento la scheda deve mostrare **Apri scadenza del documento** e nessun secondo comando per record storici.
- Il collegamento definitivo usa il marcatore `profile-document-deadline-v1` e non adotta come definitiva una Scadenza storica soltanto perché compatibile o già collegata. L'eventuale eliminazione resta manuale nella lista Scadenze.
- Il modulo precompila tipo, identificativo e data; recupera preavviso, frequenza e testo dalle regole esistenti quando disponibili; consente destinatari Email/Push e nota. I riferimenti agli allegati sono riutilizzati senza duplicazione per la consultazione nell'app; l'invio dei file come allegati email non è attestato.
- La linguetta **Regole scadenze → Documenti personali** deve leggere gli stessi record, renderne il riepilogo senza duplicarli e coprire caricamento, vuoto, errore, nuovo tentativo, campi sensibili esclusi e comandi Configura/Apri.
- Sul diff integrato risultano verdi: test mirati Documenti/Scadenze **44/44**, backend Email/Push/scheduler **42/42**, navigazione **159/159**, Profilo **167/167**, allegati **70/70**, i18n **14/14**, offline **14/14**, diagnostica performance **3/3**, documentazione **11/11**, sintassi **217 moduli**, riferimenti statici **310 file**, HTML puro **31 pagine**, shell pagina **5 pubbliche + 24 interne**, budget statico **30 pagine**, hardening, app leggera e coerenza versione `1.2.199`. Stylelint è verde usando le dipendenze già installate nel progetto principale; Madge non rileva dipendenze circolari nei **217 moduli**. `git diff --check` è verde.
- Graphify principale è stato rigenerato sul lotto JavaScript e interrogato sul percorso Documenti Profilo → Scadenza definitiva → riepilogo Regole scadenze; il grafo continua a essere un indice di supporto, non un'evidenza sostitutiva dei test.
- PR `#163`: due controlli documentali e validazione GitHub completa verdi; merge `5917cc93` in `master`.
- Deploy Firebase riuscito per Hosting e Functions: **342 file** Hosting; funzioni Node.js 22 aggiornate in `europe-west1`. `functions:list` conferma `checkDeadlines`, `sendDeadlinePushTest` e i trigger `onScadenzaCreated`, `onScadenzaUpdated`, `onScadenzaDeleted`.
- Verifica remota: HTTP `200` su Home, Profilo e Regole scadenze con versione `1.2.199`; HTTP `200` e marcatore `profile-document-deadline-v1` nei tre moduli pubblici del salvataggio, riepilogo e Profilo.
- Il collaudo reale Passaporto con ricezione Email e Push e la successiva creazione/cancellazione delle tre Scadenze appartengono alla prova dell'utente. Nessun dato reale è stato usato nella verifica automatica. Firestore Rules, Storage Rules, indici e migrazioni non sono stati distribuiti.

## 13/10/2026 — pubblicazione 1.2.177, qualità Tessera/Carta

- Diagnosi sul sorgente e sulla cronologia: il percorso guidato e l'editor Carta producevano sempre una JPEG `1012×638`, indipendentemente dalla risoluzione disponibile; Camera/Galleria con allegato originale non subivano quel ricampionamento.
- La guida resta `1012×638`, mentre l'output guidato usa le dimensioni del ritaglio sorgente e l'editor Carta conserva la selezione fino a 4096 px sul lato lungo. Richiesta camera ideale `4096×2160`, interpolazione di qualità e JPEG `0,98`.
- Test mirati: editor/geometria **12/12** e allegati complessivi **69/69**, inclusi rapporto ID-1, output oltre 3000 px da sorgente 3840 px, limite 4096 px, zoom/pan vincolati e collegamenti a Documenti/Account/Scadenze. Profilo **164/164** e navigazione/lifecycle **157/157**.
- Sintassi JavaScript **187 moduli**, CSS, dipendenze circolari, riferimenti statici e coerenza versione verdi. Il CSS dell'editor è caricato soltanto all'apertura; budget statico verde su **30 pagine**, senza innalzare la soglia.
- PR #134: documentazione e validazione completa GitHub verdi; merge `260d03ba` in `master`. Workflow di produzione `38315264096`: validazione verde in 7m14s e deploy Hosting verde in 26s.
- Verifica remota HTTP **200** su home, scanner, editor e nuovo stile; versione `1.2.177`, richiesta ideale 4096 e output a risoluzione sorgente presenti. La resa ottica effettiva richiede ancora un controllo su telefono fisico: `ideal` è una preferenza e il browser può scegliere una risoluzione inferiore.

## 12/10/2026 — pubblicazione 1.2.176, fallback Tessera/Carta condiviso

- Regressione iniziale riprodotta staticamente: Documenti usava un fallback nativo che saltava l’editor, mentre gli Account terminavano con un messaggio generico.
- Il nuovo orchestratore classifica gli errori della fotocamera, propone lo stesso fallback nei tre contesti e marca la selezione nativa per aprire l’editor in modalità Carta una sola volta.
- Test mirati iniziali: **7/7** su classificazione errori, consumo della modalità, attivazione del fallback e collegamenti nei tre contesti.
- Suite locali pertinenti verdi: allegati **69/69**, Profilo **164/164**, navigazione/lifecycle **157/157**, governance documentale **11/11**; verdi anche sintassi JavaScript, CSS, dipendenze circolari, riferimenti statici e coerenza versione.
- PR #132: documentazione e validazione completa GitHub verdi; merge `8b727fb7` in `master`.
- Workflow di produzione `38294794975`: validazione verde in 7m33s, deploy del solo Hosting verde in 24s.
- Verifica remota: home e nuovo orchestratore HTTP `200`, versione `1.2.176`, fallback presente e header `Permissions-Policy: camera=(self)`. Il gesto fisico su telefono resta un collaudo distinto.

## 12/10/2026 — pubblicazione 1.2.175, selettore allegati condiviso

- Test mirati su Profilo Documenti e lifecycle Account privato/azienda: **28/28**.
- Verificato staticamente che i tre contesti importino lo stesso `attachment-source-picker.js` e che Tessera/Carta mantenga `card-camera-capture.js`.
- Persistenza, cifratura, callable e Rules non cambiano; il rilascio previsto riguarda soltanto Hosting.
- Suite Allegati **66/66**, Profilo **164/164**, Navigazione **157/157**; Emulator cancellazione allegato **2/2**; sintassi **186 moduli**, CSS, dipendenze, versione, riferimenti statici e documentazione verdi.
- PR #130 unita in `master` (`83f70213`) dopo validazione GitHub verde in 7m43s. Workflow di produzione `38285339424`: validazione verde in 5m24s e deploy Hosting verde in 30s.
- Verifica remota: home, modulo selettore e stile HTTP **200**; versione `1.2.175` e azione Tessera/Carta presenti. Nessuna Function, Rule o dato reale modificato.

## 12/10/2026 — pubblicazione 1.2.174, allegati e Scadenze collegate

- Test mirati iniziali: **29/29** su UI Widget, collegamento Documento→Scadenza, profilo documento e validatori backend.
- Suite allegati **66/66**, accesso dati **95/95**, navigazione **157/157**.
- Functions/security **465 totali, 456 pass, 9 skip dichiarati, 0 fail**; sintassi JavaScript **184 moduli**.
- La callable copre immagini, `video/mp4`, PDF e DOCX; soglia dichiarata **32 MiB**.
- Gate PR verdi: due controlli documentali e validazione completa **5m26s**. PR #128 unita in `master` (`7705aa04`).
- Pipeline manuale di produzione verde: validazione **7m08s** e deploy Hosting **31s**. Aggiornamento della sola callable `uploadProfileDocumentAttachment` riuscito in `europe-west1`.
- Verifica remota: Profilo HTTP **200**, versione `1.2.174` presente. Nessuna modifica a Firestore Rules, Storage Rules, indici, migrazioni o dati reali.

## 12/10/2026 — pubblicazione 1.2.170, scanner Tessera/Carta nei Documenti del Profilo

- Prove mirate allegati/editor **14/14**; documentazione **11/11**; navigazione, riferimenti statici, versione e diff verdi.
- Pipeline GitHub completa verde in **8m02s**, oltre ai due gate documentali.
- PR #122 unita in `master` (`219f9dc7`); deploy del solo Hosting riuscito con 273 file.
- Verifica remota HTTP **200** su home, Profilo, modulo allegati documenti e foglio stile camera; versione `1.2.170` e comando scanner presenti.
- Nessun dato reale letto o modificato. Il gesto fisico su telefono resta da collaudare direttamente.

## 12/10/2026 — pubblicazione 1.2.169, conferma Tessera/Carta regolabile

- Prove editor, geometria e integrazione **15/15**; documentazione **11/11**; navigazione, riferimenti statici, versione e diff verdi.
- Pipeline GitHub completa verde in **7m37s**, oltre ai due gate documentali.
- PR #120 unita in `master` (`ad06df59`); deploy del solo Hosting riuscito con 272 file.
- Verifica remota HTTP **200** su home, dettagli Account privato/azienda e modulo camera; versione `1.2.169`, zoom minimo e comando **Ripeti foto** presenti.
- Nessun dato reale letto o modificato. Il gesto fisico su telefono resta da collaudare direttamente.

## 12/10/2026 — pubblicazione 1.2.168, acquisizione guidata Tessera/Carta

- Prove editor/allegati e UI mirata **14/14**; documentazione **11/11**; audit navigazione, riferimenti statici, versione e diff verdi.
- Pipeline GitHub completa verde: validazione **7m38s** e due gate documentali superati.
- PR #118 unita in `master` (`00297d21`); deploy del solo Hosting riuscito con 272 file.
- Verifica remota HTTP **200** su home, dettagli Account privato/azienda e modulo camera; versione `1.2.168` e comando scanner presenti.
- Nessun dato reale letto o modificato. Il comportamento ergonomico della fotocamera richiede ancora prova su telefono fisico.

## 12/10/2026 — pubblicazione 1.2.167, video nella galleria allegati

- Test mirati selettori e sicurezza allegati **22/22**; documentazione **11/11**; sintassi **183 moduli**; 254 riferimenti versione coerenti.
- PR #116 unita in `master` (`ba9cb84a`) dopo validazione GitHub verde in 7m35s.
- Deploy del solo Hosting riuscito. Home, dettaglio Account privato e dettaglio Account aziendale HTTP **200**; versione `1.2.167` e filtro `image/*,video/*` verificati da remoto.
- Nessun dato reale letto o modificato.

## 12/10/2026 — pubblicazione 1.2.166, allegati originali e limite 32 MiB

- L'editor immagini distingue il salvataggio del ritaglio dall'allegato originale e restituisce il `File` iniziale nel secondo caso.
- I controlli di dimensione sono allineati a 32 MiB in upload, download, condivisione, backup/ripristino, Functions e Storage Rules; l'oggetto cifrato ammette 1 KiB di overhead.
- Prove locali: allegati/editor **64/64**; Storage Rules **14/14** e condivisione Storage **5/5**; backup/ripristino **112/112**; Functions mirate **20/20**; sintassi **183 moduli**; audit sicurezza e documentazione verdi.
- PR #114 unita in `master` (`db5e4e1d`) dopo validazione GitHub verde in 7m43s. Deploy riuscito per Hosting, Storage Rules e `manageBackupRestoreV2`.
- Verifica remota: home HTTP **200** con versione `1.2.166`; modulo editor HTTP **200** con entrambe le azioni; callable elencata in `europe-west1`, runtime Node.js 22.
- Nessun dato reale impiegato.

## AUDIT-SKILL-01 — piano di collaudo, non ancora eseguito — 11/10/2026

Baseline da registrare prima dell'avvio: commit e branch esaminati, stato del working tree, versioni delle skill e dei browser, configurazione emulatori/staging, viewport, rete simulata e identificativi delle sole fixture sintetiche.

### Matrice minima

- **Statico:** autenticazione/autorizzazioni, Firestore e Storage Rules, Functions, Vault e crittografia, MFA, backup/ripristino, allegati, offline/Service Worker, dipendenze e segreti.
- **Flussi browser:** registrazione, login, logout, scadenza sessione, MFA, creazione/modifica/condivisione/archiviazione/cancellazione di record sintetici, backup interrotto e ripreso, aggiornamento PWA.
- **Rete:** online, offline, riconnessione, richieste fallite, conflitti e riapertura della pagina; nessuna simulazione deve interessare dati produttivi.
- **Viewport:** telefono, tablet e desktop; orientamento e zoom pertinenti; verifica di tastiera, focus, ARIA, overflow, clipping, modali e messaggi d'errore.
- **Prestazioni:** Lighthouse e Core Web Vitals, avvio freddo/caldo, peso degli asset, cache, rete lenta e comportamento del Service Worker.
- **Sicurezza offensiva controllata:** soltanto percorsi derivati dal threat model, contro staging/emulatori e senza tecniche distruttive, evasive o rivolte a servizi terzi.

### Evidenza richiesta per ogni caso

1. identificativo e prerequisiti;
2. dati sintetici impiegati;
3. passi riproducibili e risultato atteso/osservato;
4. screenshot o log minimizzato, privo di segreti;
5. browser, viewport, rete e versione esaminata;
6. classificazione: superato, fallito, bloccato o non eseguito;
7. collegamento all'eventuale rilievo in `AUDIT.md` e alla regressione di chiusura.

Nessuna prova è dichiarata superata in questa sezione iniziale. L'installazione delle skill e l'avvio dei collaudi costituiscono gate successivi da autorizzare.

## 11/10/2026 — pubblicazione M8 V2, release 1.2.158

- PR #102 unita in `master` al commit `1712e4ff`; documentazione e validazione GitHub verdi.
- Pipeline locale completa verde, inclusi Functions/security **453 pass + 9 skip dichiarati**, backup **112/112** e Firestore Emulator V2 **1/1**.
- Deploy mirato riuscito: Hosting e `manageBackupRestoreV2`.
- Verifica remota Hosting: HTTP **200**, versione `1.2.158` presente.
- Verifica callable: `ACTIVE`, `europe-west1`, Node.js 22, hash `419ec3ce5cd21e3581c665af9e98a3d1adc7588f`.
- Nessun dato reale usato o cancellato.

## 10/10/2026 — pubblicazione 1.2.157 e allineamento Functions

- PR #101 unita in `master` (`a3c436d7`); CI PR verde in **7m30s**, validazione `master` verde in **6m07s**, gate del workflow manuale verde in **5m58s**.
- Firebase Hosting: deploy riuscito; home `1.2.157` HTTP **200**, riferimento versione presente; `image-crop-editor.js` HTTP **200** e contenuto di ritaglio presente.
- Functions: aggiornamento mirato riuscito per **15/15** callable CPFE2/M7; Firebase CLI ha concluso con `Deploy complete`.
- Test integrale locale precedente al rilascio: `npm test` exit **0**. Nessun dato reale modificato durante i collaudi.

## 10/10/2026 — promozione M8 V2, contratto piano persistente

- Nuovo contratto Functions per manifest riprendibile: nessun corpo record persistito; binding di owner, backup, chunk, path, versione attesa e hash operazione.
- Ricostruzione consentita soltanto ripresentando il backup originale; manomissione di corpo, identità, versione, ordine o conferma non ricrea l'hash iniziale.
- Test piano, repository/dispatcher e interlock/adapter iniziali **10/10**. Evidenza successiva dell'11/10: callable e client collegati a create/inspect/reconstruct, locator minimo, risposta persa e ripresa dopo riselezione. Dopo la verifica completa l'interlock è stato aperto solo localmente. Gate finale: Functions/security **462 totali: 453 pass, 9 skip dichiarati, 0 fail**; backup **112/112**; session client **47/47** più contratto client **1/1**; Firestore Emulator V2 **1/1**; sintassi **183 moduli**. Nessun deploy e nessun dato reale.

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

## 04/11/2026 — QA Scadenze e collegamento Documento

- Runner UI reale: `scripts/populate-qa-deadlines-browser.mjs`; report macchina in `.codex-tmp/qa-final/qa-deadlines-report.json`.
- Interlock notifiche Scadenze verificato **spento** prima di ogni scrittura; destinatari esclusivamente `.invalid`, con email, Push e gestione disattivate.
- Regola **Carta Identità**, regole sintetiche e rubrica QA verificate. Le fixture indipendenti sono state rilette senza cambio ID: aziendale futura `D3CvtKxQXy4ZSzM43bAI`, odierna `qFToacHsn72hxK0uQfbu`, urgente `zWZQhzDevG09qWPWVSj6`, TEMP CESTINO `krPaexORkVvGJkR4lJaA`.
- Filtri lista e Urgenti, dettaglio, allegato sintetico delle Scadenze e idempotenza: **superati**. Il cestino TEMP è stato aperto e annullato: nessuna cancellazione permanente.
- Bonifica autorizzata conclusa: rimossa esclusivamente la fixture sintetica duplicata `RaImPJWOEAeL6M4z3Yxj` e conservata `ukxN2ktid7JWvYJLpdTK`, che era nell'Archivio. La fixture conservata è stata ripristinata, archiviata e ripristinata nuovamente via UI; gate Scadenze conclusivo `runCompleted=true`, `gatePassed=true`, `executionAccepted=true`. Il cestino TEMP è rimasto intatto: conferma aperta e annullata.
- Candidata locale Documento → Scadenza: accesso, Vault, Account collegato, numero `QA-DOC-0001` e testo composto sono corretti. Il gate allegato resta **bloccato**: il Documento QA non contiene l'allegato perché `uploadProfileDocumentAttachment` ha risposto `401` App Check; il form mostra quindi 0 copie, non 1. Nessun accesso Firestore diretto o simulazione del dato.
- Regressione mirata: **21/21** test superati (`qa-automation` + `profile-document-deadline-pilot-integration`). Nessun commit, push o deploy eseguito da questo blocco.

## 04/11/2026 — QA P0 sicuro su QA2

- Esecuzione finale `npm run qa:p0-safe-browser`: **9 PASS, 2 BLOCKED, 0 FAIL, 0 SKIP**. Report: `.codex-tmp/qa-p0-safe/2026-11-04T08-59-37-081Z/report.json`.
- Identità Firebase QA2 e sessione Vault verificate prima delle operazioni. Preferenze modificate ripristinate, popup reset/revoca soltanto annullati, Credenziali comuni consultate senza mutazioni, diagnostica conclusa e logout eseguito per ultimo.
- Archivio portatile aperto offline: **19 schede, 5 allegati, integrità AEAD verificata**. JSON analizzato, CSV controllato, ODS e XLSX verificati come contenitori ZIP. Nove schermate prodotte senza password o Recovery Key.
- `BLOCKED` Archivio Account: elenco QA2 vuoto; nessun ripristino senza fixture dedicata `QA P0 Archivio Ripristino`.
- `BLOCKED` restore backup: backup cifrato QA2 creato (**61.470 byte**), ma `restoreBackupChunk` ha risposto `401` per App Check nel browser headless. Recovery Key solo in memoria, mai in log/screenshot/report; nessun restore applicato.
- Rumore headless distinto: `APP_CHECK_RECAPTCHA_HEADLESS_REJECTED` e `SHARING_IDENTITY_APP_CHECK_BLOCKED`. Il `401` del restore resta associato al controllo bloccato.
- Residui limitati alla cartella ignorata `.codex-tmp/qa-p0-safe/`; nessun dato reale, commit, push o deploy.

### Irrigidimento e riesecuzione conclusiva

- Revisione indipendente del diff QA: nessun finding critico o alto. I runner Account e Scadenze ora vincolano e-mail/UID QA2, richiedono l'ID Azienda esplicito e ne verificano tramite UI ragione sociale e contesto prima delle mutazioni.
- Bonifica duplicati Scadenza: oltre ai due ID esatti richiede `QA_ALLOW_DESTRUCTIVE=1` e token dedicato. Con autorizzazione esplicita del proprietario è stata rimossa soltanto `RaImPJWOEAeL6M4z3Yxj`; `ukxN2ktid7JWvYJLpdTK` è stata verificata nell'Archivio e conservata.
- Scadenze rieseguite dopo la bonifica: `runCompleted=true`, `gatePassed=true`, `executionAccepted=true`, zero errori, notifiche spente, filtri, dettagli, archivio/ripristino e idempotenza superati. La cancellazione permanente della fixture TEMP non è stata autorizzata né eseguita.
- P0 rieseguito: **9 PASS, 2 BLOCKED, 0 FAIL, 0 SKIP**; `runCompleted=true`, `gatePassed=false`, incompletezza esplicita. Report: `.codex-tmp/qa-p0-safe/2026-11-04T09-30-18-170Z/report.json`.
- Gli export decifrati ora restano soltanto nella directory temporanea del sistema e vengono rimossi nel `finally`; la password dell'Archivio portatile è casuale per esecuzione. Il report conserva soltanto nome, dimensione e SHA-256. CSV validato strutturalmente e contro formule non neutralizzate; ODS/XLSX validati tramite directory ZIP e componenti obbligatori.
- Il duplicato sintetico `qa-account-allegato-sintetico.txt` nell'Account QA2 `xcsq4OKYDvNXb7iP8mU3` è stato ridotto da due copie a una con consenso esplicito e controllo dell'ID esatto. Il rerun ha verificato allegato univoco, sei Account/Memorandum, validazioni di condivisione e archivio/ripristino dell'Account privato. Widget e Credenziali comuni restano `BLOCKED` dal rifiuto App Check/Functions `403/401`; nessun bypass è stato applicato.
- Hardening successivo del runner: gli export decifrati non restano più nel workspace, la password dell'Archivio portatile è casuale per esecuzione, ODS/XLSX vengono controllati tramite directory ZIP e il gate distingue `runCompleted` da `gatePassed`. Questa modifica non retroattiva non cambia l'esito storico sopra e richiede un nuovo run per produrre una nuova evidenza.

## 04/11/2026 — Collaudo fisico iPhone/PWA e correzioni conseguenti

- Verificati su iPhone reale: accesso PWA e sblocco Vault, Credenziali comuni e relativi collegamenti, ricezione Push, selettore Widget, mascheramento/visualizzazione password, Documento collegato a Scadenza con allegato, Account e Memorandum condivisi.
- La notifica di prova ha mostrato una Scadenza reale anziché un testo neutro. La callable locale ora non interroga più le Scadenze e invia sempre il solo messaggio neutro `Notifica di prova ricevuta correttamente`, senza ID o collegamento a dati reali.
- Due navigazioni da Impostazioni hanno prodotto pagina bianca e ritorno al login. Il report locale v1.2.253 ha misurato `offline-sync` a **16.415 ms** e navigazione Area privata a **12.915 ms**, oltre al precedente timeout fail-closed di 15 secondi.
- Correzione locale: gate identità portato a 45 secondi senza anticipare la visualizzazione della pagina; il contenuto resta `hidden` e `inert` fino alla conferma Firebase. Durante l'attesa compare il solo stato sicuro `Verifica accesso in corso…`, al posto della pagina bianca. Un eventuale nuovo blocco registra in sessione soltanto motivo, pagina, durata e orario, visibili nel report diagnostico senza dati Vault.
- La lista Account privati ha misurato bootstrap ripetuti di circa **8,8–9,0 secondi**. È stato aggiunto un primo render privo di credenziali cifrate e una scomposizione diagnostica delle fasi: sorgente Account propri, inviti, record condivisi e decifrazione.
- Collegamenti Profilo uniformati: pulsante principale `Apri: nome Account` a tutta larghezza; sotto rimangono `Cambia Account` e `Scollega Account`. Applicato a telefoni, email, utenze, documenti e contatti aziendali.
- La password salvata nel Profilo aziendale non viene più qualificata genericamente come `legacy`: è un dato valido finché l'email non è collegata a un Account. Se, dopo il collegamento, viene conservata, compare nella sezione espandibile `Password nel Profilo aziendale (conservata)`.
- Al salvataggio del collegamento email→Account viene ora richiesta una decisione esplicita: se le password coincidono si può mantenere soltanto quella dell'Account oppure entrambe; se l'Account è privo di password si può trasferire quella del Profilo oppure conservarla soltanto nel Profilo; se sono diverse il sistema non cancella nulla e avverte del conflitto, consentendo soltanto di conservare entrambe o annullare.
- La rimozione dal Profilo avviene nella stessa transazione che salva l'Account e il collegamento. Prima di cancellare viene verificato che il valore cifrato non sia cambiato nel frattempo; in caso di modifica concorrente l'intera operazione viene annullata senza perdita di dati. Per le PEC viene rimosso, solo dopo consenso esplicito, anche l'eventuale valore storico nella radice del Profilo.
- Le password non vengono inserite nei messaggi, nei log o nei report; il confronto avviene localmente e il marcatore che distingue un Account inizialmente vuoto resta soltanto in RAM e non viene serializzato.
- Regressioni locali verdi: suite Profilo completa, incluse le nuove decisioni password, **183/183**; gate/diagnostica **18/18**, ciclo pagine Account **42/42**, hook profilo aziendale **7/7**, integrazione Documento/Scadenza e bootstrap offline **19/19**, notifica Push Scadenze **3/3**. Sintassi verificata su **212 moduli** e riferimenti statici su **303 file**.
- Regressione conclusiva del pacchetto locale: tutti i gruppi eseguiti da `npm test` prima degli emulatori sono verdi, compresi documentazione, sicurezza, navigazione, shell, CSS, dipendenze circolari, assistente/Ricerca, guida strutturale, i18n e Functions. Il budget prestazionale ha inizialmente rilevato `profilo_privato.html` a **338,1 KB gzip** contro il limite di **338 KB**; la duplicazione del renderer dei collegamenti è stata rimossa e il rerun è verde su **30/30 pagine**, senza aumentare la soglia.
- Il primo avvio Firebase nel sandbox si è fermato esclusivamente perché le porte loopback `4400/8080` non potevano essere aperte. Il medesimo test Backup/Ripristino V2 e tutti i **27 gruppi** Emulator residui sono stati rieseguiti fuori sandbox: Firestore Rules, Storage Rules, retention, purge, restore, Vault, profili, allegati, collegamenti, note e Account standard sono tutti verdi. Nessun dato reale, commit, push o deploy è stato eseguito.

## 05/11/2026 — Bonifica utenti Firebase autorizzata

- Inventario Auth produttivo verificato in modalità fail-closed: sei identità esatte prima dell'operazione; conservati esclusivamente Diego, Ester e l'utente sintetico QA2 popolato.
- Eliminati i tre utenti non autorizzati dal perimetro finale. Prima della mutazione sono stati controllati UID, e-mail e numero complessivo; una variazione dell'inventario avrebbe interrotto l'operazione.
- Bonifica completata su Firebase Authentication, alberi Firestore proprietari, namespace tecnici indicizzati per UID e Storage `users/{uid}/`. Rimossi **3** oggetti Storage per complessivi **446.512 byte**.
- Rimossi **2** inviti, **5** eventi/notifiche collegati e una voce di condivisione dall'Account proprietario superstite. La patch della condivisione ha ricalcolato UID accettati, mappa e-mail per UID, conteggio e visibilità.
- Un indirizzo e-mail aziendale presente nei dati propri di Diego è stato deliberatamente conservato: coincideva con l'e-mail di un login eliminato, ma non costituiva un'autorizzazione o un riferimento Firebase.
- Verifica conclusiva: Auth contiene esattamente **3** utenti; radici e sottocollezioni dei tre UID eliminati assenti; prefissi Storage vuoti; nessun invito residuo riferito agli utenti rimossi.
- Nessun contenuto Vault, password, Recovery Key, token o byte di allegato è stato scritto nei documenti di evidenza. Nessun commit, push o deploy applicativo eseguito.
