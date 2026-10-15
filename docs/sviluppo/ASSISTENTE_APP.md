# Assistente app

## Catalogo D0 e risolutore della guida

La progettazione pagina per pagina e la valutazione dei video sono nella [GUIDA](../utente/GUIDA.md#guida-pagina-per-pagina-e-aiuto-contestuale). Per implementazione, verifiche locali e distribuzione consultare soltanto [STATO](../progetto/STATO.md). Il nucleo della guida è indipendente dall'indice personale dell'Assistente: non importa Firebase, sicurezza o cifratori, non legge il DOM o storage e non esegue richieste di rete. Riduce il rischio che una richiesta di istruzioni causi involontariamente sblocco o letture dei dati; il rischio nuovo è una guida obsoleta o un target UI non più corrispondente, mitigato da audit e gate editoriale per release.

La sorgente strutturata è `Frontend/public/assets/js/modules/assistant/documentation-catalog.json`. `schemaVersion` descrive il contratto, `contentVersion` l'edizione editoriale, `reviewedAppVersion` la base di codice riesaminata; nessun campo certifica un deploy. Ogni scheda ha `pageId`, route canonica locale, famiglia accesso/interna/ricevitore pubblico, chiavi titolo/scopo, passi con ID/chiave/target opzionale, pagine correlate e `tutorialId:null`. Le traduzioni sono dizionari distinti dalla struttura: il primo corpus italiano usa chiavi `guide.*`; lingue aggiuntive possono essere parziali con fallback dichiarato. I percorsi `journeys` raggruppano schede senza navigare o effettuare operazioni.

Nel primo incremento il JSON è mantenuto esplicitamente insieme alla matrice della GUIDA; non è presentato come testo automaticamente estratto dal Markdown. Il successivo generatore/build del manifest generale deve riusare questi ID e questa sorgente per evitare una seconda base di conoscenza. L'estensione a campi, validazioni ed errori runtime del manifest dell'Assistente richiede il riesame semantico degli specifici contratti; le 30 schede non equivalgono alla copertura completa di ogni variante o dialogo.

`documentation-guide.js` espone `validateGuideCatalog`, `createDocumentationGuide` e `presentGuideStep`. La factory riceve solo il catalogo statico, crea uno snapshot immutabile ed espone risoluzione locale di pageId, scheda tradotta e percorsi. Scarta i parametri URL, rifiuta route esterne, laboratori e riferimenti sconosciuti; non restituisce identificatori di record. Testi e target vengono dal catalogo controllato, mai da una domanda libera o dal modello AI. L'integrazione deve renderizzare i testi con `textContent`; nessun HTML interpretato, handler o comando eseguibile può essere aggiunto alle schede.

La funzione di presentazione riceve soltanto il numero di corrispondenze e tre booleani non sensibili: visibile, abilitato, collegato alla vista. Conserva sempre il testo; ammette l'evidenziazione solo per un target univoco e disponibile. Il renderer futuro calcola questo stato nell'owner corrente e non passa valori, attributi contenenti dati, immagini o titoli personali. Gli ID statici attuali sono verificati nell'HTML; controlli dinamici richiedono ID di aiuto semantici stabili e test del loro renderer prima di inserirli. Assenza, ambiguità o smontaggio non autorizzano selettori più ampi o l'attivazione automatica di sezioni.

Il ciclo è: ingresso Aiuto → contesto canonico del pathname → scheda D0 → chiusura/smontaggio. `assets/js/guide.js` resta l'adattatore degli ingressi pubblici login e ricevitore: crea il comando nel contenuto senza dipendere da Firebase o Vault. Nelle pagine private il bootstrap non monta più un secondo `?` nel footer prima dei moduli pagina, perché quel nodo veniva subito sostituito dagli owner canonici del footer e produceva un lampeggio. L'unico comando di aiuto privato rimane nel dialogo Agente Codex; la successiva integrazione del catalogo D0 dovrà riusare quel proprietario senza creare un altro pulsante. L'adattatore cattura soltanto il pathname, senza query, hash o identità, e lo traduce in un contesto immutabile. L'ingresso tecnico index rinvia al login e non riceve un secondo layout.

La vista `documentation-view.js` e il JSON vengono richiesti soltanto dal gesto di apertura. Il fetch è same-origin, senza credenziali e annullabile; `documentation-ui-labels.js` raccoglie tutte le nuove chiavi dei controlli. Il dialogo testuale contiene la selezione delle 30 schede, schede correlate e percorso Primi passi: questi comandi cambiano la scheda guida, non la pagina dell'app. La prima UI resta in italiano, con `lang` e fallback dichiarato rispetto alla preferenza di lingua esistente. Sono disponibili pulsanti reali, nome/descrizione accessibili, focus iniziale, contenimento Tab/Shift-Tab, Escape, ripristino del focus e contenuto equivalente senza animazioni. Il componente non apre un secondo dialogo quando un altro è visibile.

L'owner rimuove vista, listener e comando su pagehide/blocco dell'identità; una risposta tardiva dopo abort non ricrea il dialogo. In caso di pagehide persistito, il successivo pageshow persistito può ricreare un nuovo owner del solo comando, senza riaprire il dialogo o riusare il controller distrutto; i gate Auth restano invariati. Il blocco del solo Vault non richiede dati alla guida. L'eventuale comparsa asincrona di un dialogo dell'app chiude la guida senza sottrargli il focus o rinviare il flusso di sicurezza: un observer DOM, attivo soltanto durante l'apertura, controlla esclusivamente presenza e visibilità degli altri dialoghi e viene disconnesso alla chiusura. Il controllo è ripetuto dopo il caricamento prima di creare la vista. Background inert e focus vengono ripristinati senza revocare hidden/inert del gate Auth sul body. Non viene creato un secondo observer Auth, timer permanente o progresso conversazionale. Evidenziazione dei controlli reali, walkthrough con passi/avanzamento, video e navigazione verso record restano estensioni successive.

Audit e prove pure sono raccolti in `npm run test:guide`, incluso nella sequenza `npm test`: copertura delle route, matrice, chiavi, riferimenti, target statici, purezza del risolutore, assenza di dipendenze dei dati nella UI, cablaggio dei bootstrap e presenza nella shell offline. Il corpus statico mantiene il budget di 96 KiB; le soglie delle pagine non vengono aumentate. `npm run build:offline-runtime` genera l'elenco che comprende i sei asset D0: entry, risolutore, vista, chiavi UI, catalogo e CSS. La preparazione della shell include solo istruzioni statiche; non aggiunge modelli, video o allegati personali.

`npm run test:guide-browser` usa Chromium headless, profilo temporaneo e loopback, pagine sintetiche derivate dagli HTML canonici senza bootstrap Firebase, adattatore/vista reali e Service Worker dell'app. Legge il nome cache dalla release reale; verifica prima apertura offline, tastiera, albero AX, fallback, viewport mobile, riflusso equivalente al 200%, smontaggio e risposta tardiva. Un caso usa il gate Auth reale con identità sintetica: pagina nascosta prima dell'ammissione, guida disponibile con Vault sintetico bloccato, smontaggio al blocco dell'identità. Il browser eseguibile può essere indicato tramite `GUIDE_TEST_BROWSER`. Questo banco non certifica l'app autenticata completa, un utente reale, un lettore di schermo umano o dispositivi fisici. Esiti, screenshot sintetico e limiti sono registrati soltanto in STATO.

L'Assistente corrente, nella base `14c61754`, chiama `prepare()` con chiave Vault e loader prima di aprire la UI, non riceve pageId e conserva testi/sinonimi italiani legacy. Il video Home ha controller e trasporto dedicati. Questi sono riscontri sui sorgenti, non autorizzazioni alla rimozione o a una migrazione automatica. D0 usa il proprio ingresso prima di preparare D2, preservando opt-out, ownership e ricerca esistente. Il router pubblicato in questa base è l'adattatore multipagina `pages-init.js`: la guida usa il contesto canonico dei suoi bootstrap e non attiva il laboratorio del router persistente. AI locale, migrazione della shell persistente e revisione globale delle lingue restano filoni separati, non gate software del lotto testuale.

## Azioni Account dai risultati — candidata 1.2.173

Le schede risultato di tipo Account possono mostrare il logo/avatar già associato al record e un comando **Archivia**. Nell'app Archivio e cestino sono lo stesso stato sicuro: l'Assistente richiama lo stesso servizio transazionale delle liste Account, con conferma, CAS su revisione/aggiornamento e sospensione atomica degli accessi condivisi. Non espone la cancellazione definitiva, che resta confinata alla pagina Archivio.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Questa roadmap riguarda l’assistente integrato nell’app, non Astra/DeepSeek che sviluppano il progetto. Resta una fase futura con attivazioni separate; provider, prezzi e compatibilità citati nelle fonti sono riferimenti datati.

## Direzione aggiornata — 11/10/2026

L'Assistente è una funzione specifica di Codici & Password, non una chat generica. Deve riconoscere richieste relative all'app, cercare nomi completi o parziali, aziende, Account, utenti e scadenze anche da ricordi incompleti, mostrare subito card attendibili quando il risultato è chiaro e porre una domanda discriminante quando i risultati sono numerosi. Deve inoltre spiegare cosa fa l'app, guidare il primo accesso, il Vault e la Master Password senza conoscerla, e accompagnare l'utente nel pannello Impostazioni.

Il prodotto conserva due livelli separati:

- **Assistente base**, disponibile senza AI: regole, sinonimi, fuzzy search, filtri, conoscenza delle pagine, guida, navigazione e risultati verificabili;
- **AI locale avanzata**, facoltativa nelle Impostazioni: interpreta formulazioni vaghe e restituisce soltanto azioni/parametri tipizzati. Non interroga direttamente i dati, non esegue scritture e non sostituisce il livello base.

### Architettura sperimentale A1/A2/A3 — 15/10/2026

L'autorizzazione `AI-LOCALE-A2-A3-01` rende espliciti tre livelli dello stesso Agente, senza creare tre chat:

| Livello | Funzione | Runtime | Disponibilità obiettivo |
|---|---|---|---|
| A1 | ricerca, apertura e guida deterministiche | JavaScript esistente | sempre, anche senza pacchetti |
| A2 | similarità semantica e parafrasi sulle istruzioni statiche | Transformers.js + ONNX Runtime Web, WebAssembly con accelerazione solo se provata | PC e cellulari compatibili, compreso iPhone dopo banco fisico |
| A3 | interpretazione conversazionale locale più flessibile | WebLLM in Worker dedicato e WebGPU | laboratorio mobile; produzione inizialmente PC/portatili se i gate mobili falliscono |

A2 non è un LLM generativo e non sostituisce A1. Gli embeddings della documentazione D0 vengono prodotti in build o nel pacchetto; sul dispositivo si calcola la rappresentazione della domanda e si restituiscono riferimenti a schede versionate. Un eventuale shortlist D2 viene prima ottenuto da A1 e può entrare nell'envelope soltanto con riferimento opaco, tipo, titolo e sottotitolo necessari. Credenziali, note libere e D3/D4 non entrano nell'indice semantico.

A3 non possiede strumenti applicativi. Riceve lo stesso envelope minimo, una cronologia effimera limitata e istruzioni statiche; restituisce soltanto uno di questi intenti: `explain_page`, `semantic_search`, `select_result`, `clarify`. Il validatore rifiuta proprietà aggiuntive, ordinali fuori intervallo, URL, HTML, intenti sconosciuti e richieste di operazioni. L'esecutore deterministico risolve l'intento; ogni futura estensione con effetti dovrà produrre un'anteprima e richiedere conferma, senza attribuire al modello autorizzazioni.

La memoria conversazionale vive esclusivamente nell'istanza del dialogo, conserva al massimo otto coppie domanda/intento e viene azzerata su chiusura, blocco Vault, logout, cambio UID e `pagehide`. Non entra in `localStorage`, IndexedDB, log, diagnostica o telemetria. Il modello non riceve errori contenenti payload o stack con dati. Testi provenienti dal Vault sono delimitati e trattati come dati non affidabili: una frase contenuta in un Account non può cambiare istruzioni, strumenti o politica.

#### Pacchetti e ciclo di vita

Modello e runtime non fanno parte della shell, del service worker ordinario o del primo download. Un catalogo applicativo firmato/versionato descrive livello, modello, runtime, revisione immutabile, licenza, lingue dichiarate, dimensione, memoria massima e file con SHA-256. Il flusso previsto è:

1. feature detection e stima quota senza dati Vault;
2. informativa su dimensione, spazio, RAM, batteria, calore, offline e rimozione;
3. consenso esplicito e download annullabile;
4. scrittura in area temporanea, verifica di ogni hash e del totale;
5. attivazione atomica del nuovo manifest, conservando il precedente fino al test di avvio;
6. benchmark locale sintetico e scelta A2/A3/A1;
7. rimozione completa di file, cache, indici derivati e memoria.

Interruzione, quota insufficiente, hash errato, runtime incompatibile, memoria insufficiente o background prolungato non lasciano un pacchetto attivo parziale. L'aggiornamento fallito conserva la versione precedente; A1 resta immediatamente disponibile. La preferenza di installazione può persistere, ma non la conversazione né plaintext del Vault.

#### Candidati iniziali e budget da verificare

Per A2 è distribuita la conversione INT8 `yuiseki/granite-embedding-97m-multilingual-r2-ONNX`, fissata a revisione immutabile. Modello, tokenizer, Transformers.js/ONNX Runtime Web e licenze totalizzano 145.871.600 byte. Il pacchetto è disponibile soltanto dopo consenso e verifica locale completa.

Per A3 è distribuito `mlc-ai/Qwen2.5-0.5B-Instruct-q4f16_1-MLC` con WebLLM 0.2.86 e libreria WebGPU fissata: 301.982.152 byte di download e circa 944,62 MiB di VRAM dichiarata. A3 resta hard-off su iPhone e sui dispositivi senza WebGPU, quota o memoria sufficiente.

Il gestore `local-ai-package-manager.js` non è importato dalla shell: accetta soltanto URL same-origin sotto il percorso del pacchetto, verifica quota, byte e SHA-256 in una cache di staging, promuove il lotto soltanto dopo verifica completa, espone progresso streaming/abort e rimuove tutte le cache del livello. Le cache usano il prefisso `codex-local-ai-`, distinto da `codex-shell-`; il Service Worker le preserva agli aggiornamenti e serve offline soltanto le risposte già verificate, senza inserirle nella shell. `incremental-sha256.js` legge un chunk per volta mentre una copia dello stream alimenta Cache Storage: nessun `arrayBuffer()` dell'intero shard. La quota preventiva include 2,15 volte il download perché staging e cache pronta coesistono durante la promozione atomica.

I manifest fissati misurano 145.871.600 byte per A2 e 301.982.152 byte per A3. Il loader rifiuta pacchetto assente, capacità insufficiente, runtime esterno o factory errata prima di importare codice ML. Il catalogo è `available` perché gli artefatti same-origin e le licenze sono presenti e verificati; disponibilità del catalogo non equivale a compatibilità del dispositivo.

#### Matrice e gate fisici

| Piattaforma | A2 | A3 | Gate minimo |
|---|---|---|---|
| Windows Chrome/Edge | candidato | candidato laboratorio | WebGPU reale, cold/warm start, RAM/VRAM, 20 turni, annullamento e ripresa |
| Android Chromium | candidato | laboratorio | due fasce RAM, batteria/temperatura, background/foreground, quota ed espulsione |
| iPhone Safari/PWA | candidato WASM | laboratorio, mai promesso | installazione/rimozione, tempo domanda, pressione memoria, blocco schermo e riapertura |
| browser senza WebGPU | candidato WASM | non disponibile | fallback A1, nessun loop di download o messaggio ingannevole |

A2 deve rispettare un tempo interattivo deciso dopo misura e non bloccare il main thread. A3 misura almeno: tempo di caricamento, tempo al primo token, token/s, picco memoria, energia/temperatura osservabile, cancellazione entro un tempo finito e assenza di crash della PWA. I test di qualità includono le otto lingue dell'app, domande ambigue, round-trip di lingua, output JSON alterato, prompt injection nei titoli e nei dati sintetici, assenza di rete dopo installazione e cancellazione delle risorse. Nessun banco automatico sostituisce i dispositivi fisici.

Lo scaffold locale `advanced-local-ai-contract.js` è deliberatamente non importato dal runtime pubblico. Serve a rendere eseguibili i contratti di manifest, capacità, envelope, intenti e memoria prima di scegliere artefatti o implementare download. Non effettua rete, storage, inferenza o accesso al Vault.

### Incremento Assistente base 14/10/2026

L'interfaccia mantiene un solo **Agente Codex** con due modalità esplicite. **Cerca** usa esclusivamente indice e regole locali; **Chiedi** riserva lo spazio all'AI locale avanzata e, finché il relativo pacchetto non è implementato e autorizzato, resta disabilitata con una spiegazione trasparente. Il pulsante `?` interno è l'unico aiuto delle pagine private e documenta comandi ed esempi senza accedere ai record. Il catalogo pagina per pagina resta disponibile al prodotto, ma non monta un secondo comando nel footer.

Le varianti di apertura includono anche trascrizioni vocali come `apre undicesimo`. Se una richiesta di apertura resta ambigua, il motore chiede di indicare posizione o nome e conserva l'ultimo elenco: un errore di riconoscimento non può interrompere il comando successivo. Il saluto iniziale non viene inserito nella cronologia.

I risultati Account riusano il gesto laterale canonico delle liste. Il trascinamento verso sinistra espone il cestino e richiede conferma; quello verso destra espone Archivio e richiede comunque avviso quando l'Account ha destinatari. Entrambe le azioni chiamano il servizio transazionale di archiviazione: la cancellazione definitiva resta esclusa dall'Assistente e confinata alla pagina Archivio.

Il contesto del livello base conserva l'ultimo elenco di risultati. I comandi di apertura accettano ordinali, cifre e cardinali italiani da uno a dodici; un nome Azienda viene aperto soltanto per corrispondenza esatta e univoca con il record Azienda, mentre un titolo esatto e univoco può selezionare una card dell'ultimo elenco. Queste sono regole deterministiche: non costituiscono comprensione generativa e non attivano l'AI locale avanzata.

Il microfono espone uno stato di ascolto interrompibile, mostra la trascrizione parziale nel campo, conserva senza duplicarli i segmenti finali fra eventi incrementali e lascia modificabile il testo incompleto. Distingue permesso negato, microfono assente o occupato, lingua mancante e servizio non raggiungibile. Su Safari/WebKit la sintesi viene attivata con un primer quasi silenzioso nel medesimo gesto che avvia il microfono. Dopo una domanda vocale la risposta viene pronunciata soltanto quando `SpeechRecognition` ha emesso `end` e dopo un breve rilascio della sessione audio; il controller non usa `speechSynthesis.cancel()` immediatamente prima della risposta perché WebKit può eliminare in modo asincrono l'utterance appena accodata. Mantiene inoltre un riferimento forte alla frase e preferisce una voce italiana del dispositivo. La chiusura dell'Assistente interrompe sempre riconoscimento e sintesi vocale; il servizio vocale remoto del browser richiede un secondo gesto informato.

Nel lotto Lingue il locale BCP 47 di riconoscimento e sintesi deriva dalla lingua applicativa (`it-IT`, `en-US`, `es-ES`, `fr-FR`, `de-DE`, `zh-CN`, `hi-IN`, `pt-PT`). Questo cablaggio non certifica che i sinonimi deterministici, le risposte o il pacchetto vocale siano disponibili in ogni lingua: parità editoriale, intenti e prove fisiche restano gate separati. L'Assistente non traduce titoli o contenuti personali.

Il contratto PWA del microfono richiede `Permissions-Policy: microphone=(self)`: nessuna origine esterna o iframe viene abilitata. A ogni avvio l'Assistente consulta la Permissions API quando supportata e, nello stesso gesto dell'utente, verifica `getUserMedia({ audio: true })`; le tracce ottenute vengono fermate immediatamente e non sono registrate, conservate o trasmesse. Soltanto dopo questa verifica parte `SpeechRecognition`. Un errore successivo del motore non viene più descritto come diniego del microfono: blocco del servizio, pacchetto italiano locale mancante, dispositivo assente e dispositivo occupato mantengono esiti separati. Il fallback al servizio vocale del browser resta esplicito e richiede un secondo gesto.

Prima dell'attivazione AI l'app chiede il consenso a una verifica locale del dispositivo e comunica supporto WebGPU/WASM, spazio stimato, dimensione del download, memoria/batteria, possibile riscaldamento, funzionamento offline, assenza di token API e possibilità di eliminare il modello. La compatibilità deriva da feature detection e breve benchmark locale, non dal solo modello del telefono. Il controllo e i risultati non vengono inviati fuori dal dispositivo.

L'app resta PWA durante il periodo di valutazione deciso da Diego. Nessun wrapper nativo o provider cloud fa parte di questa fase. La preparazione offline di shell e dati è distinta dall'installazione del modello e dal download volontario degli allegati. Tutti i nuovi intenti usano identificatori indipendenti dalla lingua; testi e chiarimenti usano chiavi i18n per consentire la fase multilingue finale.

## Indice delle fonti conservate

- [AGENTE_CODEX_EVOLUZIONE.md](#fonte-docs-agente-codex-evoluzione-md-l1)

<a id="fonte-docs-agente-codex-evoluzione-md-l1"></a>

## Fonte: AGENTE_CODEX_EVOLUZIONE.md — righe originali 1–216

> Provenienza: `docs/AGENTE_CODEX_EVOLUZIONE.md` a `2900ccc0`.

<a id="fonte-docs-agente-codex-evoluzione-md-evoluzione-agente-codex--audit-e-roadmap-locale"></a>

## Evoluzione Agente Codex — audit e roadmap locale

> **Stato:** direzione approvata; attivazioni e gate separati.
> **Autorità:** roadmap specialistica; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** Agente locale e accesso ai dati.
> **Dipendenze:** [Guida progetto](../LEGGIMI.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

La fotografia prestazionale del 10/09 resta storica. Il catalogo futuro deve coprire le 30 pagine canoniche della v1.2.110, distinguendo il ricevitore pubblico dal contesto Vault. L’ordine post-M0–M10 sotto riportato non anticipa i gate di sicurezza della baseline né quelli del piano di audit. Prezzi, compatibilità e dimensioni citati sono riferimenti della fotografia originale da riverificare prima di adottare un provider o modello; nessuna adozione è autorizzata qui.

> Audit eseguito il 10/09/2026 sulla v1.2.90. Questo documento approva l'architettura progressiva; non autorizza ancora il download di modelli, API esterne o azioni automatiche sui dati.

<a id="fonte-docs-agente-codex-evoluzione-md-decisione"></a>

### Decisione

L'Agente deve evolvere come orchestratore locale a livelli, mantenendo sempre disponibile il motore deterministico attuale. La priorità non è installare subito un LLM, ma costruire una conoscenza forte e verificabile dell'app. Il percorso raccomandato è:

1. regole e ricerca locale attuali;
2. conoscenza strutturata per pagina e guida contestuale;
3. ricerca semantica locale opzionale sulla sola documentazione;
4. piccolo LLM locale opzionale sui dispositivi compatibili;
5. eventuale LLM remoto soltanto come funzione futura, esplicita e non necessaria.

Il livello base deve continuare a funzionare senza API, senza PC del proprietario e almeno parzialmente offline per ogni utente.

<a id="fonte-docs-agente-codex-evoluzione-md-inventario-attuale"></a>

### Inventario attuale

| Componente | Responsabilità | Dimensione | gzip indicativo |
|---|---|---:|---:|
| `assistant-controller.js` | apertura, sblocco Vault, caricamento dati e ciclo di vita | 3.383 B | 1.255 B |
| `assistant-ui.js` | dialogo, testo/voce, risultati, mostra/copia credenziali | 12.119 B | 3.336 B |
| `conversation-engine.js` | token, sinonimi, fuzzy match, ordinali e apertura | 5.615 B | 1.998 B |
| `vault-data-loader.js` | profilo, documenti, Account, aziende e Scadenze | 4.781 B | 1.659 B |
| `search-normalizer.js` | normalizzazione lessicale | 211 B | 175 B |
| `vault-assistant.css` | interfaccia responsive chiara/scura | 9.009 B | 2.435 B |

Il codice funzionale dell'Agente pesa circa 35 KB non compressi e 10,9 KB gzip, esclusi Firebase e i dati. È caricato su richiesta soltanto se la funzione è attiva. La shell offline include già questi file.

<a id="fonte-docs-agente-codex-evoluzione-md-flusso-ricostruito"></a>

### Flusso ricostruito

1. `main-v129.js` identifica la pagina e, nelle pagine private, legge l'impostazione dell'Agente.
2. Il controller viene importato dinamicamente e collega il comando del footer.
3. Al primo tocco richiede il materiale della Vault e carica l'indice dell'utente.
4. Il loader interroga profilo, Account privati, aziende, Account aziendali e Scadenze tramite il repository condiviso.
5. Il motore normalizza la domanda, elimina parole comuni, applica sinonimi e somiglianza testuale e conserva gli ultimi risultati per frasi come “apri il secondo”.
6. La UI mostra risultati navigabili. Username e codice vengono decifrati per il risultato; la password resta mascherata e viene decifrata soltanto dopo il comando esplicito mostra/copia.

Non esistono chiamate LLM, embeddings o invio automatico di contenuti a servizi AI. La voce tenta il riconoscimento locale quando disponibile; l'eventuale servizio vocale del browser richiede una seconda azione esplicita e riguarda soltanto ciò che viene pronunciato.

<a id="fonte-docs-agente-codex-evoluzione-md-dati-inclusi-ed-esclusi"></a>

### Dati inclusi ed esclusi

Attualmente entrano nell'indice testuale: nomi di profilo, tipi di documento, nomi Account, aziende, Scadenze, categorie, URL, referente e alcuni metadati aziendali. Per le Scadenze vengono indicizzati sia i campi canonici (`title`, `type`, `category`, `name`) sia gli equivalenti storici, oltre a intestatario, veicolo, targa, riferimento e data. La card usa tipo/categoria come titolo e riunisce intestatario, veicolo/targa e data nel sottotitolo, in coerenza con il modello delle Scadenze applicative. I metadati cifrati dei documenti non entrano nell'indice. Le credenziali non partecipano alla ricerca testuale: restano associate al risultato in forma memorizzata e vengono decifrate dalla UI quando necessario.

L'audit ha rilevato questi limiti:

- nessun contesto della pagina corrente viene passato all'Agente;
- nessuna conoscenza di scopo, campi, obbligatorietà, collegamenti o errori frequenti;
- testi e sinonimi sono quasi interamente italiani;
- record archiviati, condivisi e memorandum non hanno ancora una politica di indicizzazione esplicita;
- la qualità offline dipende dalla disponibilità effettiva della cache Firestore, già oggetto del gate offline separato;
- il loader ricostruisce l'intero indice al primo utilizzo e non misura separatamente lettura, decifratura e ricerca;
- un campo cifrato non decifrato non è semanticamente ricercabile, condizione corretta per sicurezza ma da rendere esplicita;
- non esistono memoria conversazionale persistente, pianificazione di azioni o conferme strutturate.

<a id="fonte-docs-agente-codex-evoluzione-md-conoscenza-specifica-delle-pagine"></a>

### Conoscenza specifica delle pagine

La sorgente runtime proposta è un manifest JSON versionato, generato e validato in build a partire dal registro canonico e da schede Markdown mantenute dall'uomo. Gli MD restano la documentazione leggibile; il JSON evita di interpretare testo libero nel browser e impedisce duplicazioni incontrollate.

Schema minimo per ogni pagina:

```json
{
  "pageId": "form_account_privato",
  "route": "/form_account_privato.html",
  "family": "internal-form",
  "purposeKey": "assistant.pages.privateAccountForm.purpose",
  "fields": [
    {
      "id": "nomeAccount",
      "labelKey": "account_name",
      "required": true,
      "whyKey": "assistant.fields.accountName.why",
      "sensitivity": "metadata"
    }
  ],
  "actions": ["save-draft", "open-account-list"],
  "links": ["account_privati", "dettaglio_account_privato"],
  "commonErrors": ["missing-required-field", "offline-linked-record"],
  "tutorialId": null
}
```

`pageId` deve provenire dallo stesso router usato dall'app ed essere passato al controller come oggetto immutabile. Le chiavi linguistiche traducono soltanto contenuti dell'app. Titoli creati dall'utente, come “Casa al mare”, restano invariati; eventuali traduzioni personali saranno campi separati e facoltativi.

Il primo catalogo deve coprire le 30 pagine canoniche. `prova.html`, modali e pagine archiviate non vi entrano. Un test deve fallire quando una pagina canonica non possiede una scheda o quando una scheda cita campi/azioni inesistenti.

<a id="fonte-docs-agente-codex-evoluzione-md-contratto-di-accesso-ai-dati"></a>

### Contratto di accesso ai dati

| Livello | Contenuto consentito | Regola |
|---|---|---|
| D0 | documentazione e manifest dell'app | sempre locale, nessun Vault necessario |
| D1 | pagina, stato UI non sensibile, tipi e validazioni | locale, nessuna persistenza conversazionale |
| D2 | nomi e metadati dell'utente autorizzati | soltanto dopo sblocco; indice cifrato o effimero |
| D3 | username, codici, email e dati bancari | solo per richiesta pertinente e risultato selezionato |
| D4 | password, PIN, PUK, CVV e segreti equivalenti | mai in embeddings, log o prompt remoto; mostra/copia soltanto con gesto esplicito |

Il modello, se presente, non riceve mai D4. Le azioni future usano comandi tipizzati e una lista chiusa: il modello può proporre una bozza, ma il codice applicativo valida e l'utente conferma. Cancellazioni, condivisioni, invii, cambi di sicurezza e sovrascritture restano vietati all'esecuzione automatica.

<a id="fonte-docs-agente-codex-evoluzione-md-roadmap-tecnica"></a>

### Roadmap tecnica

<a id="fonte-docs-agente-codex-evoluzione-md-a0--irrobustire-la-base-attuale"></a>

#### A0 — irrobustire la base attuale

- esportare un unico `getCurrentPageContext()` dal router;
- definire esplicitamente inclusione di Account, memorandum, condivisi e archivio;
- separare indice di metadati dal risolutore delle credenziali;
- aggiungere tempi diagnostici senza contenuti e test di privacy;
- conservare ricerca e apertura attuali come fallback universale.

<a id="fonte-docs-agente-codex-evoluzione-md-a1--guida-contestuale-senza-llm"></a>

#### A1 — guida contestuale senza LLM

- creare schede Markdown e manifest delle 30 pagine;
- gestire intenti come “a cosa serve”, “dove inserisco”, “perché”, “cosa posso fare”;
- collegare campi, validazioni, errori frequenti e percorsi correlati;
- proporre navigazione e wizard, senza scrivere dati;
- integrare le chiavi di traduzione solo dopo la stabilizzazione funzionale.

Questa fase offre il maggiore beneficio con costo cloud zero, peso minimo, risultati verificabili e piena compatibilità offline.

<a id="fonte-docs-agente-codex-evoluzione-md-a2--ricerca-semantica-locale-opzionale"></a>

#### A2 — ricerca semantica locale opzionale

- usare un piccolo modello di embeddings quantizzato eseguito in Web Worker;
- calcolare in build gli embeddings della documentazione statica;
- calcolare sul dispositivo soltanto la domanda, non password o segreti;
- mantenere un indice piccolo, versionato e ricostruibile;
- usare WASM come fallback e WebGPU soltanto quando rilevato;
- scaricare il modello solo dopo consenso, mostrando peso, spazio libero e possibilità di rimozione.

Prima dell'adozione servono benchmark reali su iPhone, Android e Windows. Transformers.js supporta inferenza WebGPU e quantizzazione a 4/8 bit, ma documenta ancora differenze di compatibilità; non va inserito nel bootstrap.

<a id="fonte-docs-agente-codex-evoluzione-md-a3--piccolo-llm-locale-installabile"></a>

#### A3 — piccolo LLM locale installabile

Un modello da 0,5–1,5B parametri quantizzato può migliorare parafrasi e dialogo, ma non è una base universale. Le configurazioni pubbliche WebLLM indicano per un modello da 1B circa 879–1.129 MB di VRAM a seconda della quantizzazione, oltre a pesi, runtime, cache e memoria temporanea. Il primo download può essere di centinaia di MB o oltre, incide su traffico, spazio, avvio, temperatura e batteria.

Requisiti del laboratorio isolato:

- rilevamento `navigator.gpu`, limiti GPU, RAM/storage stimati e modalità risparmio;
- Web Worker dedicato, generazione breve e annullabile;
- modello non incluso nella shell né nel deploy ordinario;
- download volontario, barra di progresso, integrità dei file, cache cancellabile;
- prompt composto soltanto da D0–D2 e risultati D3 strettamente necessari;
- fallback immediato ad A1 in assenza di capacità o dopo errore.

Safari 26 ha introdotto WebGPU, ma il supporto dell'API non garantisce che ogni iPhone abbia memoria e prestazioni sufficienti. La PWA deve quindi eseguire un benchmark fisico prima di offrire A3.

<a id="fonte-docs-agente-codex-evoluzione-md-a4--remoto-opzionale-futuro"></a>

#### A4 — remoto opzionale futuro

Un provider remoto potrà essere solo una funzione premium/avanzata attivata dall'utente, con budget, consenso per richiesta, redazione locale e divieto assoluto di D4. Non è richiesto per utilizzare l'Agente né per le funzioni di base.

<a id="fonte-docs-agente-codex-evoluzione-md-video-tutorial"></a>

### Video tutorial

Il video Home è protetto, richiesto soltanto dopo un gesto, scaricato con token e non precaricato. La stessa regola va mantenuta. Ogni tutorial deve avere `tutorialId`, pagina, durata, dimensione, trascrizione, capitoli e versione; l'Agente usa trascrizione e capitoli, non il video.

Prima di estendere i video occorre fissare un budget per pagina e misurare il traffico. Firebase Hosting conteggia il trasferimento anche quando il file è servito dal CDN; il piano gratuito indicato dalla documentazione offre 10 GB/mese, oltre i quali il costo pubblicato è 0,15 USD/GB sul piano Blaze. Per questo i video devono essere opzionali, compressi, mai nella precache e preferibilmente pochi e riutilizzabili.

<a id="fonte-docs-agente-codex-evoluzione-md-storage-locale-e-cloud-personale"></a>

### Storage locale e cloud personale

Cache Storage è adatto ad asset e modelli scaricati; IndexedDB ai manifest, indici e configurazioni; OPFS può essere valutato per grandi file in un Worker. Prima di un download si usa `navigator.storage.estimate()` e si può richiedere persistenza. La cache non è un backup: quote ed espulsione dipendono dal browser e i dati dell'origine possono essere rimossi.

Google Drive, OneDrive e iCloud possono in futuro conservare un pacchetto modello o configurazioni, ma aggiungono OAuth, permessi, disponibilità e sincronizzazione e non eseguono inferenza. Non portano vantaggio alla prima roadmap e restano esclusi.

<a id="fonte-docs-agente-codex-evoluzione-md-costi-previsti"></a>

### Costi previsti

| Soluzione | Cloud ricorrente | Costo sul dispositivo | Valutazione |
|---|---:|---:|---|
| A0/A1 regole + manifest | circa zero | trascurabile | raccomandata subito |
| A2 embeddings locali | hosting/download del modello | decine di MB, CPU/GPU moderata | pilota dopo benchmark |
| A3 piccolo LLM locale | hosting/download potenzialmente elevato | centinaia di MB–oltre 1 GB, RAM/batteria elevate | opzionale, non universale |
| A4 LLM remoto | costo per token/richiesta | rete e privacy | futuro premium/fallback |
| storage personale | API generalmente non di inferenza | login, sync e manutenzione | nessuna implementazione ora |

<a id="fonte-docs-agente-codex-evoluzione-md-gate-prima-di-implementare"></a>

### Gate prima di implementare

1. approvare schema del manifest e contratto D0–D4;
2. realizzare A0/A1 con fixture, senza cambiare la Vault;
3. verificare tutte le 30 pagine e il fallback offline;
4. misurare tempi/peso dell'indice su account piccolo e grande;
5. solo dopo, creare un laboratorio A2 isolato e non pubblicato;
6. provare WebGPU/WASM su iPhone, Android e Windows;
7. decidere separatamente se A3 giustifica download, memoria e batteria;
8. sottoporre accesso ai dati e azioni tipizzate all'audit di sicurezza.

Non viene creata ora una prova LLM: prima servono il manifest di pagina e una misura reale delle capacità del dispositivo. Questa scelta evita di aggiungere peso e dipendenze prima di avere un caso d'uso verificabile.

<a id="fonte-docs-agente-codex-evoluzione-md-ordine-operativo-post-m0m10"></a>

### Ordine operativo post M0–M10

1. coerenza Profilo/Account/Widget/Cache: audit, piano e implementazione per blocchi, con priorità al read-your-writes; il contratto completo è in `PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md`;
2. Agente Codex A0/A1: contesto e conoscenza per pagina senza LLM, dopo la stabilizzazione dello schema dati;
3. collaudo fisico Windows online;
4. collaudo offline sistematico con F12 sulle 30 pagine;
5. correzione della consultazione offline reale emersa dal collaudo;
6. rifiniture UI rinviate, inclusi lucchetti, modali, watermark, sticky, glass e animazioni;
7. audit indipendente di crittografia, condivisione, backup e nuovo contratto Agente;
8. per ultime, lingue e riordino definitivo delle Impostazioni.

La lista comprende quindi otto attività. Il nuovo blocco precede l'Agente perché cache, collegamenti e widget devono essere stabili prima di diventare conoscenza e strumenti dell'assistente.

<a id="fonte-docs-agente-codex-evoluzione-md-fonti-tecniche"></a>

### Fonti tecniche

- [Apple — Safari 26: supporto WebGPU](https://developer.apple.com/documentation/safari-release-notes/safari-26-release-notes)
- [MDN — WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Hugging Face — Transformers.js su WebGPU](https://huggingface.co/docs/transformers.js/en/guides/webgpu)
- [Hugging Face — modelli quantizzati](https://huggingface.co/docs/transformers.js/main/guides/dtypes)
- [MLC — WebLLM](https://github.com/mlc-ai/web-llm)
- [MDN — StorageManager](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager)
- [MDN — quote ed espulsione dello storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Firebase — quote e prezzi Hosting](https://firebase.google.com/docs/hosting/usage-quotas-pricing)
