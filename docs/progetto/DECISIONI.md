# Decisioni

<a id="cornice-c1-scadenza-2026-11-10"></a>

## 10/11/2026 — canary QA2, scadenza fissa e arresto delle prove fisiche

Diego riporta il GO di Claude sul PRE-OFF Chrome Windows, consiglia di ripeterlo negli altri ambienti e ordina l'accensione personale del solo campo enabled. Prima del salvataggio Codex segnala che la data gia predisposta supera sette giorni dall'accensione odierna; Diego sceglie esplicitamente **mantenere il 18/11/2026 alle 23:59 Europe/Rome (22:59 UTC)**. Questa scelta sostituisce per questa finestra la durata nominale di sette giorni; nessuna proroga implicita o cambio di destinatario. La fase personale resta distinta.

Diego modifica il cloud personalmente; Codex guida primo accesso e C1 un caso alla volta e registra solo esiti riferiti o realmente osservati. Alla prima anomalia la prima azione operativa e riportare enabled a false in console, poi raccogliere la diagnostica e sospendere il seguito. Nessun UID, credenziale o contenuto Vault nei rapporti; nessun deploy, merge o modifica applicativa discende dal collaudo. [Esiti e limiti](../evidenze/COLLAUDI.md#cornice-c1-qa2-2026-11-10).

<a id="cornice-adc-decisione-2026-11-10"></a>

## 10/11/2026 — scelta opzione A, credenziale impersonata e revoca del claim

Diego sceglie SA dedicato senza chiave privata JSON; preparazione e revisione soltanto. Due ruoli custom separati, Auth get/update e GET Firestore condizionato al database default; Token Creator al solo SA. Le limitazioni effettive sono dichiarate: IAM non vincola singolo utente/claim o documento, il runner sì. L'ADC conserva un refresh token sorgente: non equivale a separare i privilegi del PC se il principale sorgente è Owner. [Procedura, limiti e revoca](../regole/RILASCIO.md#cornice-adc-impersonata-2026-11-10).

Credenziale costruita dal solo JSON validato in RAM; nessuna seconda scoperta ADC da SDK, header quota o percorso alternativo. Auth SDK e REST singleton/scrittura usano lo stesso token impersonato. Rimozione idempotente del solo claim con singleton OFF/binding invariato prima del cambio fase e prima della revoca IAM; ammette scadenza passata o assente. Nessuna attivazione o scrittura reale da questa consegna. **L'ultimo ordine vieta UID in ogni rapporto, anche dry-run**, superando la precedente eccezione; input --uid rimane esplicito e privato. Scadenza sette giorni e ogni passo reale richiedono accordo/approvazione separati; #285 attende nuovo GO Claude.

<a id="cornice-canary-due-fasi-2026-11-10"></a>

## 10/11/2026 — canary prima sintetico, poi personale; runner soltanto da revisionare

Diego cambia il piano: **fase 1 su account di prova ammesso, fase 2 sul proprio account**. Dopo la ricognizione delle esclusioni chiede di riusare l'account già creato e popolato con dati inventati: **QA2 è la candidata della fase 1, da confermare con Claude**, non un nuovo utente da creare. Le ricevute escludono QA2 dai precedenti lotti recovery/S1 ma non documentano un divieto globale per qualunque test della cornice; non usare quelle deleghe storiche come approvazione automatica del nuovo canary. QA1 resta storico e le fixture temporanee S1 risultano eliminate. Identità attuale, ammissibilità Auth/policy e approvazione del candidato vanno confermate prima di qualunque prova cloud o cambio del singleton.

Un solo `vaultFramePolicy/current`: durante fase 1 dovrà riferirsi all'UID sintetico verificato; prima della fase 2 spegnimento, verifica della revoca, rimozione del claim precedente a binding invariato e solo dopo cambio al solo UID personale con distinta revisione/approvazione. Nessuna abilitazione simultanea, nuova coorte o uso di dati reali nella fase 1. Le [due matrici C1](../evidenze/COLLAUDI.md#cornice-b2-lista-2026-11-09) hanno esiti indipendenti; nessun PASS trasferito da una fase all'altra. Questo ordine supera soltanto il precedente vincolo «primo canary esclusivamente Diego», non i gate o la protezione dei dati.

Lo script una tantum deve ricevere `--uid` e fase espliciti, senza account QA predefinito. L'ordine iniziale chiedeva UID nel dry-run; l'ultimo ordine lo supera: UID solo come input privato esplicito, nessun identificativo nei rapporti, nemmeno nella sola prova. Tutti gli altri claim restano preservati e non stampati; nessun token, e-mail o eccezione SDK libera. Dry-run predefinito, riletture e ricevuta privata cifrata prima dell'unica scrittura; nessuna promessa di atomicità Auth. Il mandato attuale autorizza soltanto preparazione/test locali/documenti/commit/push/PR e avviso a Claude. **Non eseguire il runner su Firebase**, nemmeno in dry-run, né creare utenti o cambiare singleton/claim. Dopo la consegna arresto per GO Claude e ulteriore approvazione personale. Scadenza dei sette giorni da concordare vicino all'attivazione; nessuna data provvisoria, estensione o ripartenza automatica della finestra per il cambio fase.

<a id="ui-tre-livelli-decisione-2026-11-10"></a>

## 10/11/2026 — Revisione UI a tre livelli e ripartizione Claude/Codex

Dopo l'analisi visiva, le quattro prove grafiche isolate (`/ui-preview/ui-prove/`) e il confronto «Oggi/Proposta» del Profilo, Diego dichiara che la quarta prova lo convince e chiede di applicarne il principio a tutta l'app. Alla scelta sulla ripartizione del lavoro risponde **«A»**: **Claude esegue la revisione UI**, Codex conclude la cornice e poi i punti di sicurezza aperti; ciascuno rivede l'altro con lo stesso ciclo avviso → GO/NO-GO, senza auto-approvazione.

La decisione adotta il principio della quarta prova e, come aspetto visivo, la direzione **«Rifinita»**: identità attuale resa più calma (vetro solo sulle barre, card piene, contrasto più alto nel tema chiaro), guidata dalla palette scelta dall'utente. Restano tema automatico e **tutte e sette le palette** (blu, verde, rosso, sabbia, petrolio, lavanda, rosa antico), in chiaro e in scuro; Diego ha visionato l'anteprima Rifinita nelle sette palette prima della scelta. Per le filigrane Diego sceglie **«B + C»**: simbolo della pagina come piccola icona accanto al titolo nell'intestazione, più filigrana discreta in un angolo, mai sotto il contenuto. Le regole sono nel [contratto UI a tre livelli](../regole/INTERFACCIA.md#ui-tre-livelli-2026-11-10). La regola «un componente condiviso nasce con almeno due utilizzi reali» resta valida: i componenti nascono insieme al primo pilota (Profilo privato), non come libreria inutilizzata.

Stato: decisione e contratto registrati sul ramo `claude/awesome-keller-kt4v9t`, allineato alla candidata cornice 1.2.268. Nessuna pagina applicativa modificata; il codice della tappa pilota attende l'integrazione della PR #278 per non sovrapporsi alla cornice. Nessun merge, versione o deploy deriva da questa decisione.

## 10/11/2026 — prescrizione B3.5 dopo il GO Hosting

Diego trasmette il [GO condizionato di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6763989370) e autorizza correzione del solo modello/test/documenti prima dell'attivazione. Gli header della risposta seguono la normalizzazione limitata di caratteri non riservati osservata su Hosting per file esistenti; l'ammissione JavaScript della cornice rimane rigorosa sui nomi canonici e rifiuta le varianti di nome codificate verificate dai probe. Le eccezioni conservative del modello non sono una nuova attestazione universale del comportamento Hosting. Nessuna modifica a runtime/configurazione o ridistribuzione; tre probe aggiuntivi separati dal manifest già pubblicato. [Contratto](../regole/INTERFACCIA.md#cornice-b1-header-2026-11-09), [evidenze e storico del confronto](../evidenze/COLLAUDI.md#cornice-b35-modello-2026-11-10). Prima del provisioning occorrono nuova revisione Claude e approvazione personale del singolo passo; canary sette giorni invariato.

## 10/11/2026 — B3 per singoli passi e canary di sette giorni

Dopo il [GO DIAG](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6758777089), Diego sceglie esplicitamente **7 giorni di canary**, distinti dai 7 giorni massimi del journal. Il Timestamp UTC non è assegnato oggi: verrà concordato all'attivazione, senza rinnovi automatici. Diego carica il workflow e crea personalmente il singleton in console; Codex preparerà in un passo successivo uno script claim una tantum, da sottoporre a Claude prima dell'esecuzione. Il passo attuale termina con la consegna del workflow completo e hash, poi arresto e attesa di approvazione. Nessuna operazione cloud autorizzata da questa consegna. [Mandato](INCARICO_CORRENTE.md#cornice-b3-consegna-workflow-2026-11-10), [procedura](../regole/RILASCIO.md#cornice-b3-piano-2026-11-10). Questa decisione supera la precedente proposta non approvata di 24 ore.

<a id="cornice-diag-decisione-2026-11-10"></a>

## 10/11/2026 — DIAG prima della prosecuzione B3

Diego ordina un registro diagnostico locale volontario per C1 e valutazione dell'app, con sezione Cornice, default off, allowlist chiusa, nessun dato identificante/Vault o invio remoto, massimo 200 eventi/7 giorni, eliminazione su logout/cambio account, copia e cancellazione. Aggiornare contratti e lista: ogni FAIL deve avere il rapporto copiato. Consegna sulla #278 mediante avviso PASSO DIAG COMMITTATO e revisione Claude, poi B3. Nessuna operazione Firebase o deploy autorizzata.

Scelta implementativa candidata: sessionStorage della singola scheda, identità soltanto in RAM e revisione non identificante del fence nel consenso; il worker non persiste. Disattivazione elimina, Cancella ruota la generazione mantenendo il consenso. Registro distinto dalle metriche prestazioni esistenti. Specifica e limiti sono in [SICUREZZA](../regole/SICUREZZA.md#cornice-diag-sicurezza-2026-11-10); nuovo costo statico dichiarato in [INTERFACCIA](../regole/INTERFACCIA.md#cornice-diag-ui-2026-11-10), soggetto al revisore. Non è scelta della durata canary né approvazione dei successivi passi cloud.

<a id="cornice-b3-decisione-2026-11-10"></a>

## 10/11/2026 — B3 da preparare, cloud fermo

Diego trasmette il [GO D11 di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6757406980) sul commit `3820afe6be11fbdb1c1c724592232c5ad36e8503` e autorizza preparazione e avviso B3 sulla #278. Revisione Claude del pacchetto e approvazione personale di Diego precedono ogni esecuzione Firebase; nessuna delega implicita per workflow, merge o deploy. Proposta scelta per la revisione: sole Rules Firestore con scope CI fisso distinto dal recovery ampio, poi Hosting sullo stesso SHA e provisioning privato del solo pilota dopo le verifiche. Nessuna nuova Function o migrazione Vault.

Il file completo della CI viene soltanto generato localmente e vincolato da SHA-256; workflow attivo invariato. Canale amministrativo, UID e scadenza UTC rimangono da concordare dopo revisione, non assegnati. La durata di 24 ore è una proposta, non una decisione acquisita. Auth e Firestore non sono una transazione: evitare writer concorrenti, verificare i claim conservati e usare precondizioni sul singleton. [Piano, gate e rollback canonici](../regole/RILASCIO.md#cornice-b3-piano-2026-11-10). L'abilitazione non equivale a collaudo C1/C2; nessun nuovo documento oltre i 34.

<a id="cornice-d11-decisione-2026-11-10"></a>

## 10/11/2026 — D11 dopo GO B2, prima della proposta B3

Diego trasmette il [GO B2 di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6753602102) e ordina la correzione notifiche con le integrazioni della lista. Si adotta l'intento dal worker FCM alla cornice pronta, confermato tramite porta/nonce/path entro 1500 ms: il padre verifica sorgente attiva registrata, allowlist e stato corrente, quindi naviga il figlio senza sblocco implicito. Senza conferma si usa openWindow; mai navigate diretto sulla cornice. È una correzione candidata da rivedere, non un'attivazione. Il fallback nativo può riusare una PWA e richiede il collaudo distinto riportato nel contratto UI.

Safe area verticale/orizzontale e version skew entrano nella lista C1, senza risultati precompilati; priorità PWA iPhone e Chrome desktop. Restano gate GO sul nuovo SHA, approvazione personale B3, CI soltanto e 34 MD. Questo passo non autorizza provisioning, nuove Rules/Functions/workflow, merge o deploy.

<a id="cornice-b1-decisione-2026-11-09"></a>

## 09/11/2026 — B1 dopo GO A2, senza attivazione produttiva

Diego trasmette il [GO Claude A2](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6751236506) sul commit `455b41fc4f3bc86e0b9f9df48ccb9f5623309060` e ordina B1. Si usa un singleton fuori dal sottoalbero delle preferenze modificabili dagli utenti: un solo destinatario server, nessuna scrittura client o UID personale nel codice. Ascolto continuo con metadati e verifiche server fresche ai confini sensibili; richieste pendenti prima del background non possono soddisfare la ripresa. Il compilato candidato può instradare nella cornice solo dopo consenso server; il documento reale assente conserva il diniego. Nessuna nuova Function, chiave o migrazione Vault.

La configurazione selettiva degli header è per route e non per utente. In B1 si prova il codice con SDK/emulatori e browser sintetico; provisioning privato e rilascio CI delle Rules/Hosting sono rinviati a B3 dopo i GO previsti e approvazione personale. Il vecchio scope CI che comprende più backend non viene usato per distribuire soltanto questa Rules. Nessuna modifica workflow da questo passo; nessun deploy dal PC. Questa decisione aggiorna i checkpoint A2 preparatori seguenti, preservandone la provenienza.

Contraddittorio B1: Claude rileva che la pre-verifica su ogni pagina aggiunge ritardo anche ai non partecipanti; NO-GO mantenuto dopo CI verde. Correzione scelta: riutilizzare l'indicazione server negativa già disponibile nel token Auth canonico, senza richiesta ulteriore e senza cache positiva. Solo la hint booleana true per UID corrente permette di tentare il routing; singleton/Rules restano unica autorità, offline nessun tentativo. Il provisioning privato B3 dovrà proporre il solo claim del pilota preservando gli altri; nessuna mutazione Auth ora. Il consumo locale del marker precede il filtro, evitando residui anche senza hint. Costo statico dichiarato e gate di revisione in [Interfaccia B1](../regole/INTERFACCIA.md#cornice-b1-header-2026-11-09).

<a id="cornice-ordine-2026-11-09"></a>

## 09/11/2026 — ordine cornice A1–C2, revisione sulla PR e timer

Diego ordina di chiudere e pubblicare la cornice persistente attiva soltanto per il proprio account. Sicurezza aperta fuori perimetro e nuova grafica seguiranno separatamente. Codex è unico esecutore; Claude revisore consultivo readonly sulla PR #278, senza modifica di file/commit/cloud. La lavorazione continua sulla #278; un'eventuale nuova PR va collegata subito con commento sulla #278.

A fine di ogni passo l'avviso sulla #278 deve iniziare «PASSO <A1/A2/B1/…> COMMITTATO – ramo: … – commit: <SHA completo> – file toccati: … – test eseguiti ed esito: … – limiti/cosa non è fatto: … – in attesa di revisione Claude». Solo una risposta sulla PR «REVISIONE CLAUDE – GO» riferibile al passo/commit sblocca il passo seguente; NO-GO richiede correzione e nuovo avviso. I pareri CLI dei laboratori precedenti non sostituiscono questo nuovo gate. Merge e deploy richiedono inoltre l'approvazione personale di Diego: nessuna delega implicita e nessun deploy dal PC. MD fermi a 34.

Sequenza autorizzata: A1 contratto nei tre documenti canonici → A2 integrazione reale pubblicabile ma spenta → B1 flag server soltanto UID Diego, Rules/emulatori e header selettivi → B2 lista prove dispositivi → B3 preparazione merge e CI, eventuale Rules/Function strettamente richiesta da B1 poi Hosting → C1 prove personali e correzioni con lo stesso ciclo → C2 ricevute e avviso «CORNICE CHIUSA». L'ordine aggiorna la precedente sola preparazione sintetica. B2 prepara la lista e C1 esegue le prove dopo l'attivazione individuale B3: questa nuova sequenza sostituisce, soltanto per il canary Diego, il precedente vincolo di completare tutta la matrice fisica prima di attivarlo. Restano obbligatori i test automatizzati precedenti, GO, approvazione personale e rollback; nessuna prova mancante è dichiarata superata e non è autorizzata l'attivazione per altri utenti.

Alla domanda sul tempo in background Diego sceglie esplicitamente **«Usa lo stesso tempo dell'inattività»**. Entrambi derivano dalla preferenza `lock_timeout`, non dal default fisso del laboratorio. Scadenze, copie RAM e confine same-origin sono nel [contratto Vault A1](../regole/VAULT.md#cornice-a1-2026-11-09); intestazioni, permessi e transizioni in [Interfaccia A1](../regole/INTERFACCIA.md#cornice-a1-ui-2026-11-09). La matrice specifica che gli header statici sono per route e per tutti i visitatori: il flag server individuale governa l'abilitazione e il broker, non gli header.

Aggiornamento: A1 ha ricevuto il [GO di Claude sul commit 4f2bc0f8](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6747756706). È quindi in preparazione A2 reale ma spenta; nessun GO A2, attivazione o pubblicazione della cornice. Il raccordo aggiunge conferme sensibili e pulizia delle continuazioni; costo statico circoscritto e limiti sono dichiarati in [Interfaccia](../regole/INTERFACCIA.md#cornice-a2-ui-2026-11-09), da valutare nella revisione del candidato.


## 07/11/2026 — riconciliazione del manifest Markdown

Diego risponde «procedi» alla proposta di correggere i disallineamenti documentali e censire **34 Markdown**: i 32 già approvati e i due file tecnici `AGENTS.md` e `.agents/skills/token-saver/SKILL.md`, creati dal bootstrap token-saver richiesto. I documenti precedenti conservano funzione e autorità; le due istruzioni tecniche sono sottoposte agli stessi controlli. Nessun file o cartella viene escluso per ottenere il passaggio dell'audit. La mappa delle 71 fonti storiche conserva baseline, segmenti e impronte originali; il numero dei documenti ammessi viene riallineato al manifest, senza inventare provenienze per i file nuovi.

L'ordine riguarda la manutenzione documentale locale e le relative verifiche. Il perimetro esecutivo è nell'[incarico corrente](INCARICO_CORRENTE.md#revisione-documentale-2026-11-07); le evidenze della revisione sono in [AUDIT](../evidenze/AUDIT.md#revisione-documentale-2026-11-07).

## 06/11/2026 — recovery completo con Recovery Key

Diego risponde «Sì, recupero completo con Recovery Key» alla domanda che esplicita il recupero della Vault tramite file e Recovery Key anche senza la vecchia Master Password, scegliendone poi una nuova. Chi possiede entrambi può quindi recuperare il materiale della Vault. Il nuovo profilo completo conserva questo materiale soltanto nella capsula cifrata del file e nella RAM client; non lo invia in chiaro al server né lo inserisce nell'archivio portabile o nei piani di ripresa.

Il recupero resta vincolato allo stesso proprietario autenticato. Il formato v2 ordinario rimane compatibile e non acquisisce implicitamente questa proprietà. L'implementazione e le prove locali sono autorizzate; distribuzione backend/Rules, recupero con scritture cloud, migrazione legacy e rotazione della Vault QA richiedono i rispettivi gate già indicati nell'incarico. Questa decisione non dichiara il percorso completo implementato o distribuito.

## 03/11/2026 — monitoraggio sicurezza dell'app e del PC

La sorveglianza finale comprende sia l'app pubblica sia il PC Windows usato per sviluppo e rilascio. Il controllo viene eseguito ogni giorno alle 07:30 Europe/Rome, resta silenzioso quando non esistono novità applicabili e non applica automaticamente patch, commit o deploy. Gli allarmi richiedono conferma su fonti primarie, correlazione con le versioni realmente usate e indicazione di una misura concreta.

Il recapito approvato è `boschettodiego@gmail.com`; l'autorizzazione riguarda esclusivamente avvisi di sicurezza senza dati della Vault o dati personali. WhatsApp è ammesso soltanto tramite canale Business ufficiale. Non si installano automazioni fragili sul profilo WhatsApp personale. Il monitor non accede alla Vault o a segreti dell'utente.

## 03/11/2026 — collaudo QA, contenuti utente e archivi multilingua

Il collaudo pre-finale usa l'utente tecnico sintetico per popolare e verificare visivamente tutti i campi applicativi consentiti. Account condivisi e Memorandum condivisi richiedono due evidenze distinte: stato del mittente QA e stato del destinatario. La sola creazione dell'invito non dimostra ricezione, accettazione, permessi, allegati o revoca; quando il destinatario è l'utente di Diego, il suo riscontro viene registrato come prova umana separata.

I Widget restano distinti fra Widget bancari legati al conto o all'Account bancario e Widget generici riutilizzabili negli Account. Nomi, etichette e valori creati dall'utente sono contenuto utente e non vengono tradotti cambiando lingua; vengono tradotti soltanto comandi, conferme, errori e testi dell'interfaccia. Lo stesso principio vale per note, descrizioni e altri valori inseriti dall'utente. Le Credenziali comuni devono essere collaudate per cifratura, collegamento multiplo, aggiornamento, scollegamento, mascheramento, copia, archiviazione, condivisione autorizzata ed eliminazione senza esposizione nella Ricerca o nei log.

L'Archivio portabile è una copia destinata alla consultazione umana: si apre nella lingua scelta dall'utente, include il selettore delle lingue supportate e traduce visualizzatore, istruzioni, errori, avvisi, intestazioni e nomi dei fogli. I contenuti utente restano invariati. JSON e identificatori tecnici mantengono chiavi canoniche stabili; CSV, ODS e XLSX usano intestazioni nella lingua selezionata per l'esportazione. Il Backup cifrato resta invece un formato tecnico indipendente dalla lingua: si traducono soltanto interfaccia, messaggi e procedura di ripristino, non il contenuto del contenitore.

## 03/11/2026 — AI.2 abbandonata, resta solo Ricerca

La funzione generativa AI.2 è rimossa dall'app. Le prove con WebLLM/WebGPU, Qwen e il prototipo di Motore locale Windows restano nello storico documentale, ma non vengono più distribuite né esposte agli utenti. Non devono rimanere download LLM, eseguibili, impostazioni AI, pulsanti AI.2, diagnostica dedicata, permessi loopback o dipendenze di pubblicazione.

La funzione mantenuta si chiama **Ricerca**: è deterministica, locale, utilizzabile con testo o dettatura e non pretende di essere un'intelligenza artificiale. Graphify fornisce la mappa tecnica usata per ampliare comprensione delle parole, collegamenti fra pagine, percorsi e conoscenza dei controlli reali. Il precedente video di presentazione viene eliminato; la futura guida interattiva con evidenziazioni e frecce riuserà questa base ma sarà progettata e collaudata separatamente.

## 03/11/2026 — collaudo sintetico e AI.2 nativa

I rilasci vengono verificati con un utente tecnico dedicato e dati esclusivamente fittizi. L'utente conserva tutte le protezioni del prodotto, incluse password di accesso, Master Password e cifratura della Vault; non esiste una modalità senza Master Password o una porta di servizio. Le credenziali automatiche sono protette dal profilo Windows tramite DPAPI e non vengono condivise con il codice o con gli utenti reali.

Codex AI.2 mantiene l'interfaccia web ma separa il calcolo generativo: **Ricerca** resta deterministica nel browser, mentre il modello viene eseguito da un motore Windows locale. Il pulsante di installazione deve spiegare componenti, requisiti, privacy, spazio e rimozione; Windows conserva la propria conferma esplicita per l'eseguibile. Il motore e il modello sono versionati, firmati o verificati tramite hash e distribuiti dall'infrastruttura controllata dell'app. Il servizio ascolta soltanto su loopback, limita l'origine ammessa e richiede un'associazione locale, così un altro sito non può usarlo. Il motore riceve solo conoscenza D0 e cronologia limitata, mai la Master Password, chiavi, credenziali o record della Vault.

La licenza inclusa nel pacchetto WebLLM Qwen2.5 3B è la **Qwen Research License**, non Apache 2.0: quel modello non viene quindi scelto per il nuovo pacchetto distribuibile. La candidata nativa è Qwen3 4B GGUF `Q4_K_M`, pubblicata con licenza Apache 2.0; resta non distribuibile finché binari Windows, modello, licenze, dimensioni e SHA-256 non sono materializzati e collaudati. Il vecchio WebLLM rimane soltanto come confronto e riserva temporanea fino al collaudo A/B.

Il servizio leggero può avviarsi con Windows, ma non carica Qwen finché Codex AI.2 non viene realmente usata. L'accesso dal browser richiede il permesso granulare `loopback-network`; l'accesso alla rete locale ordinaria resta negato. Qwen3 viene eseguito in modalità non-thinking per le risposte operative dell'app, riducendo latenza, uso di token e rischio di timeout senza cambiare la conoscenza D0 fornita al modello.

## 24/10/2026 — allegati a blocchi nell’Archivio portatile

Diego approva esplicitamente l'inclusione degli allegati cifrati a blocchi nell'Archivio portatile. Il manifest di un video viene validato come una sola voce logica; i blocchi sono scaricati, autenticati, decifrati e passati al writer in ordine, uno per volta. Il contenitore resta il formato v2 già pubblicato: un solo `archivio.cpportable` cifrato e autenticato contiene dati e allegati, mentre `visualizzatore.html` e `LEGGIMI.txt` non contengono dati utente.

Il limite è 512 MiB per singolo allegato, 1 GiB per il totale degli allegati e 1,5 GiB per il contenitore cifrato. Gli allegati grandi richiedono File System Access in un browser desktop compatibile; i fallback restano limitati a 12 MiB per la creazione e 8 MiB per il download dal visualizzatore. Manifest incoerente, blocco mancante, dimensione errata o autenticazione fallita interrompono l'operazione e invalidano o rimuovono l'output parziale. La decisione autorizza codice, test e documentazione locale, non commit, pubblicazione o uso di dati reali.

## 23/10/2026 — spazi automatici nel compositore delle Scadenze

Il compositore dei messaggi delle Scadenze non affida più agli spazi iniziali o finali inseriti dall'utente la separazione tra testo, oggetto, modello e targa. Ogni frammento conserva il proprio contenuto ma viene ripulito ai confini; il compositore inserisce un solo spazio quando serve e nessuno prima della punteggiatura o dopo parentesi aperte e apostrofi. Le configurazioni già corrette non producono quindi doppi spazi, mentre quelle prive del raccordo vengono composte correttamente. Anteprima, catalogo del form e salvataggio devono usare la stessa funzione centrale.

I Documenti personali restano esclusi da questa ricomposizione e continuano a seguire il flusso dedicato del Profilo. Le Scadenze esistenti non vengono riscritte in massa: i cinque messaggi già individuati richiedono una ricomposizione mirata dopo la pubblicazione del nuovo compositore.

## 22/10/2026 — tipo obbligatorio prima della regola

Una nuova Scadenza non assume un ambito predefinito. L'utente sceglie prima il **Tipo di scadenza**, poi la **Regola** e infine il **Riferimento**; la pianificazione e il testo restano proprietà della regola. La modifica di una Scadenza conserva invece la selezione persistita. **Documenti personali** è un percorso guidato verso i Documenti del Profilo e non permette di creare dal form generico una Scadenza scollegata dalla propria sorgente.

## 21/10/2026 — uniformità delle regole senza migrazione implicita

Le sei linguette operative adottano la stessa gerarchia visiva e lo stesso principio di configurazione: nota autonoma, card delle regole senza grande contenitore esterno, pianificazione unica a livello di regola e card interne nominate. La forma fisica storica resta temporaneamente distribuita tra `deadlineConfig`, `deadlineConfigDocuments` e `generalConfig`; non viene nascosta né riscritta durante il caricamento. Le regole nuove o salvate esplicitamente ricevono ID stabile, ambito esplicito e versione di schema. La scelta e il popolamento di una sorgente canonica, seguiti dal collegamento delle Scadenze tramite `ruleId`, costituiscono un cutover separato con inventario, prova e rollback.

## 17/10/2026 — editor dedicato delle Scadenze dei Documenti personali

Il flusso Documento → Scadenza non usa più la composizione generica per i dati già determinati dal Documento. Intestatario, tipo, numero o codice, ente di rilascio e Data di scadenza sono mostrati come riepilogo non modificabile; tipo ed ente restano campi distinti. Il valore data persistito rimane ISO, mentre la presentazione segue la lingua dell’app e in italiano usa `GG/MM/AAAA`.

Il messaggio proposto deriva dal catalogo linguistico e dal testo configurato per il tipo di Documento, non da una frase inserita direttamente nel controller. Numero ed ente vengono aggiunti quando disponibili e il risultato resta modificabile per la singola Scadenza. Preavviso, frequenza, destinatari, Email, Push, permesso **Può gestire**, allegati e note rimangono configurabili. La linguetta **Documenti personali** nelle Regole scadenze mostra lo stesso messaggio e gli stessi parametri degli stessi record.

## 17/10/2026 — Scadenze definitive dei Documenti personali

Diego approva il flusso definitivo in **Profilo → Documenti**. Un Documento privo del collegamento mostra **Configura scadenza** e apre il modulo completo già esistente; dopo il salvataggio il comando diventa **Apri scadenza del documento**. Preavviso, frequenza, destinatari e canali Email/Push, nota e riferimenti agli allegati sono configurati nello stesso flusso. Non deve comparire un comando separato per aprire una Scadenza precedente.

La **Data di scadenza** del Documento è la fonte finale della Scadenza collegata: nel modulo viene mostrata in sola lettura e non viene sostituita con una nuova data proposta. La Data di rilascio resta distinta e informativa. Preavviso e frequenza sono modificabili; per ogni destinatario si scelgono separatamente Email, Push e **Può gestire**.

I destinatari provengono dalla rubrica unica **Impostazioni → Destinatari email**. Dal modulo Scadenza deve essere possibile aprire la medesima pagina per aggiungere o modificare un contatto e poi tornare al modulo senza perdere i valori già compilati; una modifica del contatto aggiorna i suoi dati senza modificare le scelte di canale o gestione della Scadenza.

La linguetta **Documenti personali** di **Impostazioni → Regole scadenze** mostra direttamente il riepilogo dei Documenti del Profilo: dati del Documento, data, pianificazione, destinatari/canali, nota, numero di allegati e lo stesso comando **Configura scadenza** oppure **Apri scadenza del documento**. Non duplica i Documenti, le Scadenze o gli allegati e non presenta una scheda introduttiva separata. Le configurazioni storiche e le Scadenze già presenti restano disponibili e non vengono riscritte automaticamente.

Il cutover resta manuale e sequenziale: prima si usa un Passaporto fittizio con data nella finestra di preavviso per verificare Email e Push; poi si creano le Scadenze definitive di Patente, Codice fiscale e Carta d'identità. Dopo la verifica Diego elimina immediatamente e singolarmente soltanto le proprie tre vecchie Scadenze; le Scadenze degli altri familiari restano attive. Non sono autorizzate cancellazioni automatiche, massive o per tipologia, né l'adozione silenziosa di record storici. I riferimenti agli allegati consentono la consultazione protetta dentro l'app; l'invio dei relativi byte come allegati email non è dichiarato implementato.

## 14/10/2026 — lingua iniziale e prima configurazione

Il selettore lingua appare prima che l'app conosca l'identità. Un utente già registrato può chiuderlo e autenticarsi; dopo il login l'app recupera la preferenza valida associata al profilo. La registrazione di un nuovo utente richiede invece una scelta esplicita. La lingua resta modificabile nelle Impostazioni e interessa esclusivamente testi statici, guida, ARIA, errori, comandi e voce dell'Assistente: i contenuti creati dall'utente restano invariati.

Dopo il primo login la Home propone le Impostazioni o l'esplorazione. Per questa iterazione l'unica configurazione obbligatoria è la conferma della lingua. Tema, area Azienda, Assistente base, notifiche, MFA, biometria e backup sono facoltativi. Finché il requisito minimo non è completato le pagine di creazione/modifica censite mostrano lo stesso invito bloccante; la consultazione resta disponibile. Questa classificazione non riduce i gate autonomi di sicurezza del Vault e non rende facoltative password, autenticazione o verifiche richieste dai rispettivi contratti.

## 11/10/2026 — apertura del progetto Portabilità, Assistente e Lingue

Diego apre un nuovo ciclo di progettazione articolato in tre filoni, successivi alla stabilizzazione corrente e distinti dal backup tecnico:

1. **Archivio portabile completo**, denominazione che sostituisce «esportazione Excel»: deve consentire a chi non vuole più usare l'app di conservare sul proprio PC tutti i dati e gli allegati in formati aperti. La prima fase è consultabile e in sola lettura, con navigazione locale in stile maschere Access fra Home, utenti, aziende, Account e scadenze; ODS/CSV sono copie interoperabili, mentre HTML/CSS/JavaScript costituiscono l'interfaccia locale. Dati, allegati e interfaccia restano separati e versionati per predisporre, senza implementarla ora, una seconda fase con aggiunta, modifica ed eliminazione. Non è un backup e non promette reimportazione nell'app.
2. **Assistente intelligente dell'app**: non è una chat generica. Il livello base senza AI deve rimanere disponibile e offrire ricerca per nomi parziali, date, categorie e domini, card dei risultati, guida contestuale, onboarding del Vault e guida alle Impostazioni. Un piccolo modello locale è soltanto un'estensione facoltativa attivabile dalle Impostazioni sui dispositivi compatibili; prima del download l'app deve comunicare dimensione, spazio, memoria/batteria, limiti e funzionamento locale senza token API. La verifica di compatibilità richiede consenso, resta sul dispositivo e deve preferire una prova tecnica alle sole informazioni dichiarate dal telefono. Master Password e segreti D4 non entrano nel modello.
3. **Lingue**, ultimo filone: app, guida e assistente dovranno essere multilingue. Intenzioni e azioni interne usano identificatori stabili indipendenti dalla lingua; testi, chiarimenti, ARIA ed errori usano chiavi i18n. La revisione editoriale e il collaudo di ogni lingua avvengono dopo la stabilizzazione dell'Assistente, ma nessun nuovo testo deve essere scritto in modo da impedirne la traduzione futura.

Per l'offline è necessaria una preparazione esplicita eseguita almeno una volta online, con avanzamento, verifica di completezza, ultimo aggiornamento e avviso che cache o dati possono essere espulsi dal sistema. Gli allegati non sono inclusi automaticamente: l'utente sceglie quali scaricare, vede spazio e stato, può limitare il download al Wi-Fi e rimuove le copie locali; i byte locali restano cifrati.

Il prodotto resta per ora una **PWA**. Non sono autorizzati Capacitor, wrapper per store, riprogettazione nativa, AI cloud, download di modelli o modifiche runtime da questa decisione. Diego valuterà per alcuni mesi il comportamento dell'app prima di decidere un eventuale confezionamento per gli store. L'incarico corrente è documentale e di pianificazione; implementazione, prove fisiche e rilascio richiedono passi successivi espliciti.

## 10/10/2026 — pubblicazione 1.2.154 senza sblocco generale dei motori

Diego ha autorizzato pubblicazione e completamento del lavoro su profili Widget e allegati dei documenti personali. PR #97 è stata unita e sono stati distribuiti Hosting, Rules e le quattro callable pertinenti. La pubblicazione non costituisce autorizzazione a migrare automaticamente i widget legacy né ad attivare M7 generale, M8 riprendibile, recupero MFA automatico o writer CPFE2. OCR e riconoscimento automatico dei documenti restano un filone successivo.

## 10/10/2026 — criterio definitivo di chiusura M7-M10

La chiusura del ciclo è confermata sulla versione pubblicata `1.2.150`. La decisione del 09/10 resta valida nel suo significato safe-off ed è aggiornata soltanto nel riferimento di versione: nessun motore non dimostrato viene acceso per ottenere una chiusura nominale. Purge M7, restore riprendibile M8, recupero MFA automatico e nuove scritture CPFE2 rimangono disabilitati. GCS reale, matrice fisica, audit indipendente e privacy/legale sono fuori dal ciclo concluso e richiedono un nuovo incarico esplicito.

Questa decisione prevale sulle formulazioni storiche che descrivono i sei filoni come «aperti e da completare»: M7, M8 e M10 non sono incarichi correnti; lingue, AI ed Excel restano lavori futuri separati e non fanno parte della chiusura M7-M10.

## 09/10/2026 — chiusura operativa completa del ciclo M7–M10

Diego ordina «chiudiamo tutto il ciclo». La decisione chiude l'incarico tecnico e documentale corrente dopo il deploy completo della `1.2.144`. Le parti non dimostrate non vengono abilitate per ottenere una chiusura nominale: purge automatico M7 e restore riprendibile M8 restano hard-off; il recupero MFA resta assistito secondo opzione 1. Le prove GCS reali, fisiche, l'audit indipendente e la revisione privacy/legale sono esplicitamente trasferite a un eventuale ciclo futuro di certificazione. La chiusura non equivale a dichiararle superate.

## 08/10/2026 — sei filoni congelati dopo la prova con app duplicata

Fonte: decisione registrata durante la duplicazione pilota in `DUPLICAZIONE_APP.md` e confermata successivamente da Diego. I sei filoni da conservare come **aperti e da completare**, senza considerarli chiusi per effetto di merge, deploy o prove parziali, sono:

1. **M7 — cancellazione e purge**;
2. **M8 — completamento e collaudi reali**;
3. **M10 — audit, privacy e rilascio**;
4. **esportazione Excel**;
5. **integrazione AI**;
6. **Lingue**.

Il fatto che i commit o i rami sperimentali M7/M8 risultino confluiti in `master` indica soltanto che il relativo codice non è più isolato su quei rami. **Non attesta il completamento di M7 o M8**, non chiude i rispettivi gate e non sostituisce i collaudi ancora richiesti. Il ramo remoto Excel resta una sorgente separata da preservare finché il lavoro non sarà ripreso. Anche le evidenze M10 non confluite devono essere conservate o riconciliate prima della pulizia dei relativi rami. Per AI e Lingue non risulta un'implementazione completa da considerare acquisita.

## 05/10/2026 — M8-RP-01 e M8-TS-01: conferma esplicita

Fonte: Diego risponde in questa chat «Confermo 30 giorni e blocco con spiegazione» alle due proposte illustrate.

- **M8-RP-01:** conservare per 30 giorni il piano minimo di ripresa del ripristino interrotto, composto da identificativi e versioni, senza password, chiavi o contenuti del backup. Alla scadenza occorre una nuova anteprima; i dati già ripristinati restano. La durata non si estende alle ricevute, agli upload incompleti o ad altre categorie.
- **M8-TS-01:** se una data nel backup non può essere conservata esattamente dal database, bloccare il ripristino con una spiegazione; non arrotondare silenziosamente e non applicare l'alternativa della perdita di precisione.

Chiusi i quesiti decisionali, non l'implementazione o il gate M8. Proseguono sviluppo e prove locali già autorizzati; nessuna autorizzazione a deploy, produzione, modifica Rules o riattivazione purge.

04/10/2026 — Diego conferma «si» alla proposta di bloccare temporaneamente la cancellazione definitiva nel codice locale, mantenendo archivio/ripristino disponibili mentre prosegue l'integrazione sicura. Nessuna autorizzazione a deploy o modifica produzione. È mitigazione temporanea dei due difetti concorrenti, non loro soluzione definitiva.

## 27/09/2026 — sessione tecnica recupero MFA: autorizzazione locale esplicita

Diego risponde «Autorizzo soltanto progettazione e prove locali» alla domanda sulla sessione Firebase temporanea creata dal server dopo password e codice di recupero validi. Autorizzati esclusivamente progettazione e collaudo con dati sintetici: sessione solo in memoria server, mai inviata al browser o salvata nei documenti. Nessuna attivazione online, accesso produttivo o autorizzazione al rilascio. Superata soltanto la precedente mancanza di consenso al collaudo locale del meccanismo; sicurezza selettiva, concorrenza e ripresa di 15 minuti devono ancora essere dimostrate.

## 27/09/2026 — recupero Authenticator obbligatorio

Diego richiede esplicitamente di implementare il recupero con password e codice di emergenza dopo perdita dell'Authenticator. Conferma del requisito, non attestazione che il percorso sia già funzionante. Alla domanda sulla nuova sessione tecnica Firebase interna ha chiesto a cosa servisse: non registrare quella risposta come consenso esplicito al meccanismo custom-token. Restano autorizzati gli altri lavori locali; produzione e rilascio esclusi. Il codice di recupero MFA non sostituisce la password separata del Vault.

## 27/09/2026 — recupero MFA, alternativa 1 confermata

Fonte: risposta esplicita di Diego «risposta 1» dopo spiegazione delle tre alternative. Correggere il recupero perché rimuova soltanto i fattori originari dell'operazione e preservi quelli aggiunti successivamente, anche in concorrenza. La funzione non è pronta al rilascio finché questa protezione non è verificata. Non è rinuncia al recupero, né approvazione della sua esclusione temporanea dal prodotto o del rischio di rimozione indiscriminata. Rimane valida la decisione 5: ripresa della medesima operazione per 15 minuti con nuova verifica password. Gli altri lavori locali già autorizzati proseguono indipendentemente; nessuna modifica di produzione o autorizzazione al rilascio.

## 27/09/2026 — frequenza notifiche, risposta esplicita di Diego

Confermato: conservare il registro opaco per 30 giorni e limitare a 30 giorni l’intervallo massimo tra avvisi. Nessuna estensione della conservazione. Nuovi valori e modifiche ammettono interi 1–30; vecchie frequenze superiori non vengono riscritte né accelerate automaticamente: richiedono correzione esplicita nella configurazione. Il guard backend preesistente blocca gli invii anticipati non supportati, mantenendo l’avviso nel giorno della scadenza. Nessuna migrazione di produzione eseguita.

## 27/09/2026 — programma locale unificato, conferme definitive di Diego

Fonte: risposte in questa chat alle domande 1A–5 e conferma successiva «I due anni partono dall'ultima archiviazione. Confermo comunque 1 e 2. Ora procedi a completare tutto il programma». Decisioni di comportamento e autorizzazione a implementazione/prove locali; non attestazioni di implementazione. Nessun commit/merge/push/deploy o modifica dei dati produttivi.

- **1A, conflitti purge:** prevale la conservazione dei dati. Se ripristino/caricamento e cancellazione entrano in conflitto, fermare la cancellazione e consentire una nuova richiesta dopo verifica; non promettere reversibilità di byte già eliminati. Progettare serializzazione/versionamento prima del passo distruttivo e stato esplicito per errori parziali.
- **1B, archivio:** due anni dall'ultima archiviazione, anche dopo ripristino e nuova archiviazione. Purge automatico non prima di almeno dieci giorni dalla creazione persistita dell'avviso interno; un avviso non creato rinvia il purge. Lettura/conferma dell'avviso non richiesta. Mancata consegna push non blocca se l'avviso interno è regolarmente registrato. Restano verifica organizzativa/legale D8 e autorizzazione separata all'attivazione distribuita.
- **2A, M8 riaperto:** staging/verifica degli allegati prima della disponibilità del relativo blocco; blocchi completati conservati senza promessa di rollback globale; ripresa dei soli elementi mancanti anche in nuova sessione; modifiche concorrenti mai sovrascritte silenziosamente. Riepilogo di recuperati/mancanti/conflitti; riparazione allegati delle sole voci selezionate, incluse voci testuali invariate con byte mancanti. Superata la sospensione precedente, non dichiarato chiuso il gate M8.
- **2B, D5:** backup precedente può ricreare un elemento purgato soltanto mediante ripristino esplicito con avviso; non riattivare automaticamente condivisioni pregresse. Nessuna distruzione retroattiva dei backup posseduti dall'utente.
- **3A:** pulizia server riprovabile dei file sicuramente non più referenziati dopo salvataggio riuscito (avatar sostituiti, allegati rimossi, upload abbandonati). Identità/percorso e riferimenti verificati, mai omonimia. Upload temporanei incompleti riprendibili per sette giorni, poi pulizia escludendo operazioni attive; durata non estesa ad altre categorie.
- **3B:** impedire eliminazione Azienda finché contiene Account, da spostare o eliminare prima tramite le rispettive procedure; non cascata implicita degli Account.
- **3C:** eliminare scadenze dimostrate derivate dall'Account, preservare autonome anche omonime; origine ambigua sospende quella parte con segnalazione. Copie esportate e dispositivi offline non eliminabili immediatamente a distanza: limite da comunicare.
- **4:** approvato registro anti-duplicati degli invii destinatari push/email per 30 giorni, identificativi opachi/stato/date, senza contenuti/email/token. Distinto dal precedente N1. Ritentativi incerti già consentiti, nessuna promessa exactly-once; non autorizza invii oltre eleggibilità/scadenza.
- **5:** ripresa della stessa operazione di recupero MFA per 15 minuti con nuova verifica della password; nessun riuso generale del codice consumato. Stato minimo utente/operazione/date/esito, nessuna password o codice in chiaro. Scaduta la finestra serve altro metodo valido; nessun bypass manuale dell'identità né garanzia di recupero a metodi esauriti. Non estende automaticamente la retention audit; pulizia dello stato transitorio da verificare.

Lingue, AI ed esportazione Excel rinviati a un secondo momento, esclusi dall'attuale sequenza tecnica. Non è autorizzazione al rilascio prima dei gate. Diego eseguirà successivamente controlli sull'app locale integrata; le demo separate non equivalgono a tale consegna.

**27/09/2026 — ordine pre-finale di riconciliazione:** Diego richiede di completare il lavoro descritto negli MD e aggiungere, prima di lingue/AI/esportazione Excel, riconciliazione completa dell'app e risoluzione verificata dei difetti noti, compresi quelli caratterizzati da prove verdi. Sequenza e criteri in PROGRAMMA, incarico in INCARICO_CORRENTE. Il rinvio delle tre funzionalità a dopo pubblicazione è un'opzione da decidere, non un rinvio definitivo approvato. Nessuna chiusura automatica dei gate o autorizzazione Git/rilascio.

**27/09/2026 — preparazione locale autonoma e invii incerti:** Diego autorizza correzioni e prove locali fino alla preparazione al rilascio, continuando sui lavori indipendenti quando una parte richiede decisioni. Approvato ritentare gli invii dall'esito incerto, accettando possibili duplicati. Non è approvazione di una durata di conservazione nuova, di registri ulteriori o di tentativi oltre scadenza. Quesiti da raccogliere insieme; niente commit, merge, push, deploy o modifica produzione senza ordine successivo.

**26/09/2026 — NOTIFICHE-08, recupero fallimento totale:** Diego conferma con «procedi» la proposta di ritentare al controllo giornaliero successivo, entro la scadenza, quando nessun push ai destinatari riesce per errore temporaneo. Successi parziali invariati per evitare reinvii indiscriminati; niente nuovi registri o migrazioni. Non autorizza tentativi oltre scadenza o una nuova politica email.

**26/09/2026 — NOTIFICHE-08, calendario backend approvato:** Diego risponde «sì» alla scelta di usare sempre il giorno italiano (Europe/Rome) per gli avvisi, indipendentemente dal fuso del server. Autorizzata correzione locale e prove; vecchie registrazioni inalterate, nessuna migrazione o modifica delle regole di retry, nessun deploy. I marcatori date-only precedenti restano letti letteralmente: il loro istante/fuso originale non è ricostruibile con certezza.

**26/09/2026 — PROMEMORIA-06, soglia Urgenze approvata da Diego:** «sì confermo» alla regola proposta: il giorno di scadenza resta «Scade oggi» nei promemoria per tutta la giornata; dal giorno successivo passa nelle Urgenze e scompare dai promemoria. Uniformare Home e lista Urgenze su questa regola di giorno di calendario, senza cambiare la scadenza originale o le politiche di invio push/email.

## CORREZIONI-05-N1 — conservazione anti-duplicati approvata il 25/09/2026

Diego ha risposto «approvo» alla proposta in questa chat: registro tecnico minimo anti-duplicati per **30 giorni**, senza nomi, email o contenuti degli Account; eventi più vecchi ignorati per impedire che un avviso cancellato ricompaia per riconsegna tardiva. Approvazione limitata a progettazione, implementazione e test locali, non distribuzione o accesso ai dati reali. La finestra riguarda il registro N1, non cambia la conservazione generale delle notifiche, audit, backup o purge. Implementazione, pulizia effettiva e limiti operativi vanno verificati separatamente: questa decisione non certifica cancellazioni già eseguite.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](STATO.md).

Questo registro indicizza decisioni e loro successioni: non crea da solo incarichi. Una decisione di prodotto, una realizzazione nel ramo e un rilascio sono tre eventi distinti. Le date Git non sono date di approvazione. I riferimenti `:N` nelle fonti migrate sono riferiti ai vecchi file alla base indicata e si ricostruiscono dalla mappa di migrazione.

## M6-C1/C2/C3 — decisioni già registrate, ora indicizzate

- **M6-C1 DECISA:** avviso esplicito di indisponibilità locale, senza affermare perdita sul server o chiedere reinserimenti. Prova fisica della causa ancora aperta. [DEEPSEEK_COORDINATION (base, riga 7689)](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l7689).
- **M6-C2 DECISA:** ripreparazione al ritorno online quando possibile, con sessione valida; non estendere il timer e non dichiarare riuscita senza verifica. Vault bloccato/scaduto richiede normale sblocco. Attuazione distinta dalla decisione. [DEEPSEEK_COORDINATION (base, riga 7882)](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l7882).
- **M6-C3 APERTA:** la risposta sui duplicati della coda non decide lo sblocco offline dopo espulsione/perdita di identità e non autorizza cancellazioni. [DEEPSEEK_COORDINATION (base, riga 7884)](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l7884).

## Indice delle fonti conservate

- [REGISTRO_DECISIONI.md](#fonte-docs-registro-decisioni-md-l1)

<a id="fonte-docs-registro-decisioni-md-l1"></a>

## Fonte: REGISTRO_DECISIONI.md — righe originali 1–257

> Provenienza: `docs/REGISTRO_DECISIONI.md` a `2900ccc0`.

<a id="fonte-docs-registro-decisioni-md-registro-indicativo-delle-decisioni--indice-non-normativo"></a>

## Registro indicativo delle decisioni — indice NON normativo

> **Natura del documento.** Indice **breve, datato e NON normativo**: elenca decisioni, rinvii e stati
> **già dimostrabili nelle fonti esistenti**, con il collegamento alla fonte originale. **Non sostituisce
> le fonti**: in caso di divergenza valgono i documenti originali, e la baseline di sicurezza e i
> contratti specialistici restano **normativi**. Questo file non crea, non estende e non reinterpreta
> alcuna decisione.
>
> **Revisione del documento:** **D02 R2 — 23/09/2026** (correzione finale). Allinea le approvazioni esterne
> **M6-A-8b / 8c R1 / 8d / 8e** alla loro **provenienza dichiarata** (autore, conversazione, citazione
> testuale, commit, metadati **non esposti dalla UI**) e registra **M6-A-8c base** come **non approvata**;
> per M7 distingue **decisione**, **implementazione nel ramo** e **distribuzione** e aggiunge le decisioni
> **successive del 22/09/2026**; i **richiami puntuali** sono stati ricontrollati. Revisione precedente:
> **D02 R1**.
>
> **Base:** ramo `integration/vault-shell-v127-security`, commit `9be970201a26f1e1df1efa425b8ff74c18ca56ec`
> (`9be97020`, **D01 R1**), working tree pulito, **23/09/2026**. Il registro è stato creato con **D02**
> (`e7b97080`) e corretto con **D02 R1** (`4e0ee70d`) e **D02 R2** (correzione finale, commit locale
> successivo che **non riscrive** i precedenti).
>
> **Perimetro:** solo documentazione versionata. Nessun accesso a console, ambienti distribuiti, PWA o
> dati reali; nessuna modifica a codice, test, versione, Rules/Functions.

<a id="fonte-docs-registro-decisioni-md-come-leggere-le-voci"></a>

### Come leggere le voci

**Stati:** **DECISA** = scelta registrata con autorità e perimetro; **PARZIALE** = parte decisa e parte
ancora aperta, dichiarate separatamente; **RINVIATA** = rinvio esplicito registrato; **APERTA** = nessuna
decisione rintracciata (o solo una proposta/preferenza, che **non** è una decisione).

**Campi obbligatori di ogni voce:** ID · titolo · stato · perimetro e residuo aperto · tipo · autorità,
data e fonte originale · *sostituisce/integra* · effetti consentiti · effetti **non** autorizzati.

**Tipi:** decisione tecnica · decisione di prodotto · approvazione consegna · chiusura gate ·
autorizzazione deploy.

<a id="fonte-docs-registro-decisioni-md-regole-di-autorità"></a>

### Regole di autorità

1. Il registro **indicizza** le fonti originali e **non le sostituisce**.
2. Baseline e contratti specialistici restano **normativi**.
3. Una **decisione tecnica** non equivale a **approvazione della consegna**.
4. **Approvazione della consegna**, **chiusura di un gate** e **autorizzazione al deploy** sono eventi **distinti**.
5. Una **proposta**, un'**analisi** o una **prova** non diventano decisioni.
6. **Non** si reinterpretano retroattivamente cronologie o formulazioni: le contraddizioni si indicano, non si risolvono per presunzione.

<a id="fonte-docs-registro-decisioni-md-1-m6--adozione-messaggi-copie-pwa"></a>

### 1. M6 — adozione, messaggi, copie PWA

<a id="fonte-docs-registro-decisioni-md-m6-f1--upgrade-additivo-della-coda-allo-schema-v2-opzione-a"></a>

#### M6-F1 — Upgrade additivo della coda allo schema v2 (opzione A)

- **Stato:** DECISA
- **Perimetro e residuo:** si adotta l'**opzione A** (upgrade additivo controllato della coda IndexedDB esistente allo schema v2 con store `queueLeases`). Il perimetro riguarda la **coda delle scritture offline già abilitate**; la consultazione offline resta un gate distinto. **Residuo aperto:** prova mista vecchia/nuova, compatibilità delle copie PWA, rollback v2-compatibile, collaudi fisici.
- **Tipo:** decisione tecnica (con ricadute di prodotto)
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7679`, «Decisione Diego — M6-F1 = A»)
- **Sostituisce/integra:** integra il piano `M6-ADOZIONE-PIANO R1` (opzione A); **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** preparazione e verifica **nel solo ramo** `integration/vault-shell-v127-security`.
- **Effetti NON autorizzati:** upgrade delle copie PWA installate; modifica di dati reali; deploy; chiusura dei gate M6.

<a id="fonte-docs-registro-decisioni-md-m6-f2--testo-generico-riferito-al-tipo-di-operazione-errori-di-salvataggio-senza-web-locks"></a>

#### M6-F2 — Testo generico riferito al tipo di operazione (errori di salvataggio senza Web Locks)

- **Stato:** DECISA
- **Perimetro e residuo:** per gli errori del salvataggio offline in browser senza Web Locks si usa un testo **generico ma riferito al tipo di operazione** che l'utente stava compiendo (es. creazione/modifica di Account privato o modifica di memorandum), **senza** nomi, valori o segreti del record; il testo deve indicare che **quella operazione non ha un salvataggio confermato** e invitare a riprovare; **non** deve affermare che la modifica sia conservata, persa o sincronizzata finché lo stato non è verificato. La formulazione per ciascun tipo di operazione va preparata **quando** si arriverà all'incarico UI. **Residuo aperto:** la formulazione concreta per i tipi di operazione abilitati non è ancora prodotta.
- **Tipo:** decisione di prodotto (testo all'utente)
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7685`, «Decisione Diego — M6-F2»)
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**; distinta dall'avviso alla vecchia PWA (M6-F3).
- **Effetti consentiti:** vincola la futura formulazione dei messaggi nel perimetro dichiarato.
- **Effetti NON autorizzati:** ampliare i domini offline; promettere conservazione non verificata; modificare l'incarico tecnico attivo (allora M6-A-1, limitato al lettore).

<a id="fonte-docs-registro-decisioni-md-m6-f3--vecchia-pwa-avviso-aggiorna-lapp"></a>

#### M6-F3 — Vecchia PWA: avviso «Aggiorna l'app»

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** per «vecchia PWA» si intende la versione **già installata o ancora aperta** prima dell'aggiornamento della coda; l'utente deve ricevere un avviso **esplicito e operativo** che chieda di **aggiornare** alla nuova versione (non un semplice «la versione è cambiata»), formulato secondo il **meccanismo effettivo di aggiornamento** disponibile (es. aggiornare/riaprire l'app dal browser), **senza** presupporre un download dallo store. Nella stessa fonte è registrato che, **in caso di versione non compatibile**, le **scritture vanno fermate in sicurezza** e i **dati pendenti conservati**.
- **Residuo aperto:** prova della **convivenza delle copie già aperte**; **conservazione della coda** in caso di upgrade bloccato o dispositivo offline; **rollback v2-compatibile**; collaudo delle **PWA installate**; **sequenza di rilascio**; **criterio di blocco** (solo *proposto*, non deciso); **tempi**; **compatibilità reale**; **testo definitivo**.
- **Tipo:** decisione di prodotto (comunicazione all'utente) — non è un'autorizzazione al rilascio
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8118`, «Decisione Diego M6-F3 — messaggio alla PWA precedente»). Il chiarimento su matrice e prove è in `:7687` ed è **esplicitamente** «non ancora decisione di rilascio»: **un chiarimento non è una decisione**.
- **Sostituisce/integra:** integra M6-F1 e M6-F2; **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** definisce la comunicazione all'utente e il requisito di fermare in sicurezza le scritture con dati pendenti conservati.
- **Effetti NON autorizzati:** distribuire lo schema v2; cancellare operazioni offline pendenti; chiudere M6-F3; considerare approvati tempi, criterio di blocco, compatibilità reale o testo definitivo.

<a id="fonte-docs-registro-decisioni-md-m6-a-8e--approvazione-della-consegna-esterna-al-repository"></a>

#### M6-A-8e — Approvazione della consegna (esterna al repository)

- **Stato:** DECISA (limitatamente all'evento «approvazione consegna»)
- **Perimetro e residuo:** approvazione della **sola consegna M6-A-8e** (casi 6, 6-bis, 6-ter come **evidenza di laboratorio**) sul commit **`3b7b96a6`**. Nel repository la voce resta `DA_VERIFICARE`. **Residuo aperto:** M6 e i gate fisici, PWA e produttivi restano aperti; **M6-F3** resta aperto.
- **Tipo:** approvazione consegna (distinta da chiusura gate e da autorizzazione deploy)
- **Autorità, data, fonte:** **Sol** — comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; l'attribuzione a Sol e la data **23/09/2026** provengono dall'incarico D02 ricevuto nella **stessa** conversazione, **non** dal messaggio di approvazione. **Citazione:** «APPROVATO M6-A-8e — commit 3b7b96a6. La chiusura riguarda esclusivamente questa consegna verificata e non chiude M6 né i gate fisici, PWA o produttivi.» **ID messaggio non esposto dalla UI**; **data del messaggio non recuperabile**. Prova nel repository: [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8757`, rapporto `DA_VERIFICARE`); limiti dichiarati in [M6_SINCRONIZZAZIONE_OFFLINE.md](../regole/OFFLINE.md#fonte-docs-m6-sincronizzazione-offline-md-l1) (§M6-A-8e).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8e; **non sostituisce** le revisioni Codex precedenti né le fonti di M6.
- **Effetti consentiti:** considerare approvata **quella** consegna su **quel** commit, nei limiti in cui è dimostrata dalle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o di M6-1/M6-2/M6-3/M6-F3; chiusura dei gate fisici, PWA o produttivi; deploy, push, merge o rilascio; estensione dell'approvazione ad altri commit.

<a id="fonte-docs-registro-decisioni-md-altre-approvazioni-esterne-della-serie-m6-a-8-chat-harness"></a>

#### Altre approvazioni esterne della serie M6-A-8 (chat Harness)

Le consegne seguenti hanno una **comunicazione esterna esplicita** nella chat Harness, con gli **stessi
limiti** di M6-A-8e: nel repository restano registrate come `DA_VERIFICARE` e l'approvazione copre
**solo** la consegna e **solo** il commit indicato.

<a id="fonte-docs-registro-decisioni-md-m6-a-8b--approvazione-della-consegna"></a>

##### M6-A-8b — Approvazione della consegna

- **Stato:** DECISA (limitatamente all'evento «approvazione consegna»)
- **Perimetro e residuo:** sola consegna M6-A-8b (coordinatore lease isolato) sul commit **`583c3d7c`**, con le relative prove di laboratorio. Nel repository resta `DA_VERIFICARE`. **Residuo aperto:** M6, i gate fisici/PWA/produttivi e M6-F3 restano aperti.
- **Tipo:** approvazione consegna
- **Autorità, data, fonte:** comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; **autore non nominato nel messaggio**, che attribuisce la revisione a **Codex**. **Citazione:** «APPROVATO M6-A-8b — commit 583c3d7c, albero pulito, 167/167 test superati anche nella revisione Codex.» **ID messaggio non esposto dalla UI**; **data non recuperabile dal messaggio**: la data 2026-09-22 è quella **Git del commit** `583c3d7c`, non dell'approvazione. Prova nel repository: [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8749`, rapporto `DA_VERIFICARE`).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8b; **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** considerare approvata quella consegna su quel commit, nei limiti delle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o dei gate; deploy, push, merge o rilascio; estensione ad altri commit o deduzione di approvazioni da incarichi successivi.

<a id="fonte-docs-registro-decisioni-md-m6-a-8c-r1--approvazione-della-consegna"></a>

##### M6-A-8c R1 — Approvazione della consegna

- **Stato:** DECISA (limitatamente all'evento «approvazione consegna»)
- **Perimetro e residuo:** sola consegna M6-A-8c R1 (fencing atomico delle scritture della coda) sul commit **`d0a1d71c`**, con le relative prove Node e di banco. Nel repository resta `DA_VERIFICARE`. **Residuo aperto:** M6, i gate fisici/PWA/produttivi e M6-F3 restano aperti; il rinnovo durante task lunghi resta non implementato.
- **Tipo:** approvazione consegna
- **Autorità, data, fonte:** comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; **autore non nominato nel messaggio**, che attribuisce la revisione a **Codex** («Revisione Codex completata»). **Citazione:** «APPROVATO M6-A-8c R1 — commit d0a1d71c.» **ID messaggio non esposto dalla UI**; **data non recuperabile dal messaggio**: la data 2026-09-23 è quella **Git del commit** `d0a1d71c`, non dell'approvazione. Prova nel repository: [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8753`, rapporto `DA_VERIFICARE`).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8c R1; **non** estende l'approvazione alla consegna **M6-A-8c base** (`a200a334`).
- **Effetti consentiti:** considerare approvata quella consegna su quel commit, nei limiti delle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o dei gate; deploy, push, merge o rilascio; estensione ad altri commit; considerare approvata la consegna base 8c.

<a id="fonte-docs-registro-decisioni-md-m6-a-8d--approvazione-della-consegna"></a>

##### M6-A-8d — Approvazione della consegna

- **Stato:** DECISA (limitatamente all'evento «approvazione consegna»)
- **Perimetro e residuo:** sola consegna M6-A-8d (prova pagina + Worker sul pilota lease, caso 5 della matrice) sul commit **`6ab70723`**, con le relative prove Node e di banco. Nel repository resta `DA_VERIFICARE`. **Residuo aperto:** M6, i gate fisici/PWA/produttivi e M6-F3 restano aperti.
- **Tipo:** approvazione consegna
- **Autorità, data, fonte:** comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; **autore non nominato nel messaggio**, che attribuisce la revisione a **Codex** («Revisione Codex: …»). **Citazione:** «APPROVATO M6-A-8d — commit 6ab70723. … Il caso 5 della matrice M6 è coperto come evidenza di laboratorio.» **ID messaggio non esposto dalla UI**; **data non recuperabile dal messaggio**: la data 2026-09-23 è quella **Git del commit** `6ab70723`, non dell'approvazione. Prova nel repository: [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:8755`, rapporto `DA_VERIFICARE`).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8d; **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** considerare approvata quella consegna su quel commit, nei limiti delle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o dei gate; deploy, push, merge o rilascio; estensione ad altri commit o deduzione di approvazioni da incarichi successivi.

<a id="fonte-docs-registro-decisioni-md-m6-a-8c-base--approvazione-non-rintracciata-correzione-richiesta"></a>

#### M6-A-8c (base) — Approvazione **non rintracciata**; correzione richiesta

- **Stato:** APERTA
- **Perimetro e residuo:** il commit **`a200a334`** (M6-A-8c base) risulta nel repository **solo** con un rapporto `DA_VERIFICARE` ([DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) `:8751`); la comunicazione esterna in chat Harness relativa a quella consegna è una **richiesta di correzione** («M6-A-8c non ancora approvato»), seguita dalla correzione **R1** approvata. **Non** esiste una comunicazione esplicita di approvazione della consegna base. **Residuo aperto:** la consegna base resta **non approvata**.
- **Tipo:** approvazione consegna (non accordata)
- **Autorità, data, fonte:** comunicazione esterna nella conversazione **«DeepSeek Harness — sessione Codici & Password»**; **autore non nominato nel messaggio**. **Citazione:** «CORREZIONE RICHIESTA — M6-A-8c non ancora approvato. … resta un difetto di sicurezza nel contratto richiesto». **ID messaggio non esposto dalla UI**; **data non recuperabile dal messaggio**: la data 2026-09-23 è quella **Git del commit** `a200a334`, non dell'approvazione; prova nel repository `:8751`.
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**: le fonti originali restano invariate e la correzione R1 è un evento distinto, registrato sopra.
- **Effetti consentiti:** trattare la consegna base come **non approvata** e la sua correzione R1 come l'evento approvato.
- **Effetti NON autorizzati:** dichiarare approvata la consegna base; estendere a essa l'approvazione di R1; dedurre approvazioni da incarichi successivi.

**Nota di completezza.** Nel primo contenuto di questo registro **nessun'altra** consegna della serie M6-A-8 resta priva di una comunicazione esplicita: 8b, 8c R1, 8d ed 8e hanno approvazioni esterne registrate sopra, mentre 8c **base** è registrata come non approvata. Restano **fuori** da questo primo contenuto le altre consegne e i gate, che non vengono dedotti da qui.

<a id="fonte-docs-registro-decisioni-md-2-m7--retention-e-audit-decisioni-del-21092026-e-successive-del-22092026"></a>

### 2. M7 — retention e audit (decisioni del 21/09/2026 e successive del 22/09/2026)

<a id="fonte-docs-registro-decisioni-md-m7-d1-a--account-archiviati-conservazione-senza-scadenza-automatica"></a>

#### M7-D1-a — Account archiviati: conservazione senza scadenza automatica

- **Stato:** DECISA
- **Perimetro e residuo:** gli **Account archiviati** sono conservati **senza scadenza automatica**, finché l'utente non sceglie di eliminarli; la **cancellazione definitiva manuale** resta disponibile con **conferma esplicita**. **Residuo aperto:** le altre famiglie e le scelte M7 non coperte da questa voce restano come indicato in M7-D3 e nelle contraddizioni sotto.
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **21/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:1212`, «gli Account archiviati sono conservati senza scadenza automatica…»); opzione **D1-a** in [M7_RETENTION_CENSIMENTO.md](../evidenze/INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1) (`:501`).
- **Sostituisce/integra:** risponde a **D1** del censimento (opzione D1-a). **Come politica è integrata e superata** dalla decisione successiva del **22/09/2026** (M7-D1: cancellazione automatica dopo due anni con avviso dieci giorni prima): la decisione storica del 21/09 **resta registrata** e non viene cancellata. Integra [M7_RETENTION_CENSIMENTO.md](../evidenze/INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1) (`:501`); **nessuna fonte originale modificata**.
- **Effetti consentiti:** definire il comportamento di prodotto per gli Account archiviati.
- **Effetti NON autorizzati:** cancellare dati reali; eseguire deploy; cambiare altre politiche M7; dedurre approvazioni ulteriori.

<a id="fonte-docs-registro-decisioni-md-m7-d2-account--comportamento-ordinario-confermato"></a>

#### M7-D2 (Account) — Comportamento ordinario confermato

- **Stato:** DECISA (limitatamente agli Account)
- **Perimetro e residuo:** la decisione **conferma il comportamento ordinario di D2 per gli Account**, **senza** introdurre eccezioni, obblighi legali o una nuova durata. **Residuo aperto:** D2 per le altre famiglie di dati resta fuori da questa conferma.
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **21/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:1212`).
- **Sostituisce/integra:** **integrata** dalla decisione successiva del **22/09/2026** (M7-D2: cancellazione definitiva **immediata** con conferma esplicita, senza attendere i due anni); la conferma storica del 21/09 resta registrata. **Nessuna fonte originale modificata**.
- **Effetti consentiti:** assumere il comportamento ordinario per gli Account.
- **Effetti NON autorizzati:** estendere la conferma ad altre famiglie; chiudere D2 in blocco.

<a id="fonte-docs-registro-decisioni-md-m7-d3--registro-tecnico-auditevents-a-24-mesi-solo-ramo-non-distribuito"></a>

#### M7-D3 — Registro tecnico `auditEvents` a 24 mesi (solo ramo, non distribuito)

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** gli eventi tecnici di `users/{uid}/auditEvents` sono conservati **24 mesi di calendario** dal timestamp autorevole e poi cancellati da un processo **controllato dal backend**. La **rimozione della scrittura client** sul registro è **decisa e implementata nel ramo** (marcatori opachi nei tre scrittori client e Rules del ramo che la escludono): **non** è un residuo da decidere. Il **job pianificato** di retention è **montato nel ramo e inerte in produzione** (`functions/`), con cursori di servizio e cancellazione confermata sulla versione letta.
- **Residuo aperto (parte non decisa):** permanenza delle **altre famiglie** (ricevute di idempotenza, backup, log di piattaforma, Account archiviati restano **fuori** dalla finestra audit; per gli Account vale la successiva politica D1 richiesta, non ancora attiva); **bonifica dei record storici senza `at`**; **vista utente** del registro; **distribuzione** di job e Rules del ramo (in produzione non esiste ancora alcun job attivo e le Rules distribuite restano le precedenti).
- **Tipo:** decisione di prodotto (durata) + decisione tecnica (attuazione nel ramo)
- **Autorità, data, fonte:** Diego — **21/09/2026** — [M7_CRONOLOGIA_CESTINO_AUDIT.md](../regole/CANCELLAZIONE.md#fonte-docs-m7-cronologia-cestino-audit-md-l1) §«Retention del registro tecnico — decisione 21/09/2026 e progetto candidato» (`:114`–`:118`, `:125`) e §«Cancellazione a lotti»; registrazione in [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:1230`–`:1232`). Montaggio nel ramo **M7-AUDIT-6**: commit `65e0e776`, con correzioni `300e138b` e `2cfb19d1` ([DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) `:5178`, `:5239`, `:5297`).
- **Sostituisce/integra:** **sostituisce** la precedente indicazione di **12 mesi** per il solo registro ([DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) `:1253`: «la precedente indicazione di 12 mesi è superata»); integra D3 del censimento. Le successive decisioni M7 del 22/09/2026 **non** riducono né estendono questa finestra ad altre famiglie.
- **Effetti consentiti:** considerare decisa la durata di 24 mesi per il solo registro e ammettere, **nel ramo**, il job di retention non distribuito e la rimozione della scrittura client.
- **Effetti NON autorizzati:** estendere i 24 mesi ad altre famiglie; attivare o distribuire il job o le Rules; cancellare dati reali; deploy.

<a id="fonte-docs-registro-decisioni-md-m7-d8--obblighi-legali-di-conservazione-rinvio"></a>

#### M7-D8 — Obblighi legali di conservazione: rinvio

- **Stato:** RINVIATA
- **Perimetro e residuo:** il rinvio è **dichiarato** trattando gli obblighi legali come **dipendenza**, **senza** deroghe inventate. **Residuo aperto:** la verifica degli eventuali obblighi specifici resta da fare (dipendenza esterna).
- **Tipo:** decisione di prodotto (rinvio)
- **Autorità, data, fonte:** registro di coordinamento / censimento — 21/09/2026 — [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1) (gate **M7-1**, `:33`, «rinvio dichiarato di D8»); [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:1285`).
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** mantenere aperta la verifica senza assumere deroghe.
- **Effetti NON autorizzati:** dedurre una durata o una deroga; chiudere D8.

<a id="fonte-docs-registro-decisioni-md-decisioni-successive--22092026-in-successione-sulle-voci-d1-d2-e-d4d14"></a>

#### Decisioni successive — 22/09/2026 (in successione sulle voci D1, D2 e D4/D14)

Queste decisioni **integrano o superano come politica** le voci del 21/09/2026, che restano registrate
sopra. Per ciascuna si distingue **decisione richiesta**, **implementazione attuale nel ramo** e
**distribuzione/autorizzazione al rilascio**.

<a id="fonte-docs-registro-decisioni-md-m7-d1-22092026--cancellazione-automatica-degli-account-archiviati-dopo-due-anni"></a>

##### M7-D1 (22/09/2026) — Cancellazione automatica degli Account archiviati dopo due anni

- **Stato:** DECISA (politica di prodotto richiesta)
- **Perimetro (decisione):** gli Account nell'Archivio devono essere cancellati **automaticamente dopo due anni** dall'archiviazione; **dieci giorni prima** l'utente deve ricevere un **avviso interno all'app** e, se il dispositivo ha il canale Push attivo/consentito, anche una **notifica esterna** sul telefono. Il testo deve avvertire della cancellazione imminente e consentire di verificare gli elementi interessati. La decisione **non** estende automaticamente a due anni la durata di backup, ricevute, cache, allegati o altre famiglie di dati.
- **Implementazione attuale nel ramo:** **non attiva**. Il codice attuale dell'Archivio dichiara conservazione fino a **cancellazione manuale**; esistono Push e notifiche interne per le Scadenze, **non** una prova o implementazione equivalente per la scadenza dell'Archivio. Prima di qualsiasi purge automatico la fonte elenca come necessari: protocollo sicuro, idempotenza, prova su copia non produttiva, gestione delle notifiche non recapitate, decisione **D8** sugli eventuali obblighi di conservazione e precisazione del caso «Account ripristinato e poi riarchiviato».
- **Distribuzione / autorizzazione al rilascio:** **nessuna**. La fonte dichiara «Nessun incarico di implementazione o rilascio assegnato».
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **22/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7886`, «Decisione Diego — M7-D1 (22/09/2026), politica richiesta»)
- **Sostituisce/integra:** **integra e supera come politica** la decisione del 21/09/2026 (M7-D1-a, conservazione senza scadenza automatica), che resta registrata. **Nessuna fonte originale modificata**.
- **Effetti consentiti:** considerare **richiesta** la politica dei due anni con avviso a dieci giorni; preparare protocollo e prove **nel ramo**.
- **Effetti NON autorizzati:** attivare un purge automatico oggi; cancellare dati reali; inviare notifiche reali; considerare implementata o distribuita la politica; estendere i due anni ad altre famiglie; deploy.

<a id="fonte-docs-registro-decisioni-md-m7-d2-22092026--cancellazione-definitiva-immediata-di-un-account-archiviato"></a>

##### M7-D2 (22/09/2026) — Cancellazione definitiva immediata di un Account archiviato

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** l'utente può cancellare definitivamente **subito** un Account già archiviato, **senza attendere i due anni**, con una **conferma esplicita** del tipo «Sei sicuro di voler cancellare definitivamente?».
- **Implementazione attuale nel ramo:** il comportamento attuale prevede **già** un percorso di purge manuale con conferma.
- **Distribuzione / autorizzazione al rilascio:** **nessuna**; la fonte dichiara che non è assegnato alcun nuovo incarico mentre M6-A-2 era in correzione.
- **Residuo aperto (parte non decisa):** **testo finale** e **verifiche**, da rivedere insieme a D6/D8.
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **22/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7888`, «Decisione Diego — M7-D2 (22/09/2026)»)
- **Sostituisce/integra:** **integra** la conferma del comportamento ordinario del 21/09/2026 (M7-D2 Account), che resta registrata. **Nessuna fonte originale modificata**.
- **Effetti consentiti:** considerare decisa la cancellazione immediata su richiesta esplicita dell'utente.
- **Effetti NON autorizzati:** cancellare dati reali; considerare approvati testo definitivo e verifiche; deploy.

<a id="fonte-docs-registro-decisioni-md-m7-d4--orientamento-d14-22092026--effetto-a-cascata-della-cancellazione"></a>

##### M7-D4 / orientamento D14 (22/09/2026) — Effetto a cascata della cancellazione

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** quando il proprietario elimina definitivamente un Account — **manualmente (D2)** o **alla scadenza automatica richiesta (D1)** — la cancellazione deve avere **effetto a cascata su tutti i dati dell'app collegati a quell'Account**: documento principale, allegati e byte correlati, widget/riferimenti, dati e link condivisi, inviti e copie condivise ancora gestite dal servizio. I destinatari **non** devono continuare a vedere o raggiungere nell'app il contenuto eliminato tramite il collegamento ricevuto; accessi e indici correlati vanno revocati/ripuliti in modo coerente.
- **Implementazione attuale nel ramo:** **non descritta** da questa decisione: la fonte dichiara che «oggi il purge lascia alcune copie/inviti e oggetti Storage non elencati», quindi la decisione **non** descrive il comportamento attuale. Un **limite tecnico** è dichiarato: la revoca e la pulizia **sul servizio** possono essere richieste e verificate, ma una PWA del destinatario già offline, un file esportato, uno screenshot o una copia creata autonomamente **non** sono cancellabili istantaneamente dal dispositivo del destinatario.
- **Distribuzione / autorizzazione al rilascio:** **nessuna**; «nessuna cancellazione, commit, push, merge o deploy autorizzati da questa nota».
- **Residuo aperto (parte non decisa):** **D5, D10, D11** e il **confine** fra una Scadenza condivisa derivata dall'Account e una Scadenza indipendente; **testi al destinatario**, **prova di non accessibilità** e **gestione degli errori parziali**.
- **Tipo:** decisione di prodotto (copie derivate e controllate dall'app)
- **Autorità, data, fonte:** Diego — **22/09/2026** — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7959`, «Decisione Diego — M7-D4 / orientamento D14 (22/09/2026)»; limite tecnico a `:7961`)
- **Sostituisce/integra:** orienta **D14-Q1/Q2**; **non** sostituisce le voci D5/D10/D11, che restano da precisare. **Nessuna fonte originale modificata**.
- **Effetti consentiti:** considerare decisa la **politica di prodotto** per le copie derivate e controllate dall'app.
- **Effetti NON autorizzati:** cancellare record autonomi di altri utenti, backup o file già esportati; presentare la cascata come cancellazione retroattiva garantita di copie esterne; cancellare dati reali; deploy.

<a id="fonte-docs-registro-decisioni-md-contraddizioni-sulle-voci-m7-indicate-non-risolte"></a>

#### Formulazioni M7 precedenti conservate nelle evidenze

- [CENSIMENTO_GATE_M6_M10.md](../storico/REGISTRO.md#fonte-docs-censimento-gate-m6-m10-md-l1) (gate **M7-1**, `:33`) elenca ancora fra le decisioni **da approvare** «D1, D2, D4, D5, D6, D7, D9, D10–D16», mentre il registro del **21/09/2026** documenta D1-a e il comportamento ordinario D2 per gli Account e quello del **22/09/2026** documenta D1 (due anni), D2 (immediata) e D4/D14 (cascata): il censimento è **precedente** e non le riporta.
- [M10_REVISIONE_PRIVACY_PRELIMINARE.md](../evidenze/AUDIT.md#fonte-docs-m10-revisione-privacy-preliminare-md-l1) (§8, punto 1, 22/09/2026) elenca fra le **ancora aperte** «D1, D2, D4, D5, D6, D7, D9, D10–D16»: formulazione **più vecchia** delle decisioni del 22/09/2026.
- [M7_RETENTION_CENSIMENTO.md](../evidenze/INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1) (`:208`, §8) tiene **D5** e le parti residue di **D1** (cestino e ricevute) aperti, coerentemente con il perimetro delle decisioni.
- Le formulazioni precedenti restano come **evidenze datate** nello storico e negli inventari. Le raccolte delle domande e la sezione iniziale del contratto CANCELLAZIONE ora distinguono la successione registrata e i residui: questa riconciliazione documentale non inventa approvazioni o attuazioni.

<a id="fonte-docs-registro-decisioni-md-3-m8--backup-e-recupero"></a>

### 3. M8 — backup e recupero

<a id="fonte-docs-registro-decisioni-md-m8--ripristino-interrotto-sospensione-richiesta-dal-proprietario"></a>

#### M8 — Ripristino interrotto: sospensione richiesta dal proprietario

- **Stato:** APERTA (nessuna decisione registrata; **rinvio operativo** richiesto)
- **Perimetro e residuo:** sulla domanda M8-Q2 il proprietario ha espresso una **preferenza preliminare** (annullare l'intera procedura se il record non viene salvato e rimuovere l'allegato senza riferimento) e ha chiesto di **sospendere M8** perché la sequenza dei casi Q1/Q2 non era chiara. La fonte dichiara **esplicitamente** che la preferenza **non** va registrata come decisione M8 e che **non** va assegnato lavoro di ripristino. **Residuo aperto:** tutte le scelte M8 restano aperte.
- **Tipo:** decisione di prodotto (non assunta) — sospensione operativa
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](../storico/REGISTRO.md#fonte-docs-deepseek-coordination-md-l1) (`:7890`, «M7-D3 e M8 — chiarimento, non nuove decisioni»)
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** considerare M8 **sospeso in attesa di chiarimento**; le domande restano nei documenti M8.
- **Effetti NON autorizzati:** trattare la preferenza su Q2 come decisione; avviare lavoro di ripristino; chiudere le voci M8.

<a id="fonte-docs-registro-decisioni-md-4-fuori-dal-primo-contenuto-di-questo-registro"></a>

### 4. Perimetro e voci ancora da indicizzare

**M6-C1/C2 e il residuo C3 sono ora indicizzati in apertura.** Restano fuori da questa raccolta le altre decisioni M7 non comprese nelle voci sopra e le voci M8/M9/M10 ulteriori: prima di assegnare lavoro pertinente occorre cercarne la fonte e indicizzarle, senza presumere nuove decisioni.

<a id="fonte-docs-registro-decisioni-md-5-limiti-di-questo-registro"></a>

### 5. Limiti di questo registro

- È un **indice**, non una fonte: ogni voce va letta nella fonte originale collegata.
- **Nessuna decisione è inventata** e **nessun residuo aperto è chiuso** implicitamente: dove la fonte non basta, lo stato è **APERTA**.
- Le date riportate sono quelle delle fonti; questo registro **non** rende attuali decisioni o prove storiche.
- **Riferimenti puntuali.** I richiami originali `:N` si riferiscono ai vecchi file alla base `2900ccc0`, ricostruibile tramite `scripts/docs-source-map.json`: dove possibile sono accompagnati da **sezione** e **commit**, che restano i riferimenti stabili. Un riferimento puntuale non è una fonte: vale il documento collegato.
- **Produzione e ambiente distribuito non sono verificati** da questo file: per lo stato corrente si veda [STATO_CORRENTE_M0_M10.md](STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1), anch'esso **non normativo**.
- **Perimetro di D02.** Unico file creato: questo registro (commit D02 `e7b97080`); le correzioni **D02 R1** (`4e0ee70d`) e **D02 R2** (correzione finale, commit locale successivo) toccano **solo** questo registro e [STATO_CORRENTE_M0_M10.md](STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1), **senza riscrivere** i commit precedenti. Nessuna modifica ad altri file, codice, test, versione, Rules/Functions, dati reali, PWA o produzione; nessun push, merge o deploy.
