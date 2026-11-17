# Programma

<a id="rilascio-1282-programma-2026-11-17"></a>

## Contatti1.2.282 — completare la pubblicazione

Diego ordina la pubblicazione del correttivo; completare confezione, riesame immutabile, CI/merge, Hosting protetto e verifica pubblica, poi ricevuta. Superato il precedente limite locale per questo solo delta. Dopo il rilascio restano prova del telefono su ingresso e contatti, RG-01/RG-04, cornice, sicurezza/recupero, prodotto e ciclo finale secondo la scaletta corrente. Alla domanda di Diego sulla delega a Claude è proposta una revisione indipendente delle otto lingue/guida o dei residui grafici su checkout separato: nessun nuovo incarico inviato o iniziato, nessuna scrittura concorrente.


<a id="contatto-opzioni-programma-2026-11-17"></a>

## Riscontro telefono — contatto senza alternativa Download

Primo riscontro fisico dopo la281: «Scarica file» è ridondante e poco chiaro rispetto a Salva in File del sistema. Preparare il correttivo per entrambe le Tessere secondo il [contratto delle capacità native](../regole/INTERFACCIA.md#contatto-opzioni-ui-2026-11-17), con regressioni di annullamento/errori/riprova, geometria e palette. Il salvataggio browser resta soltanto l’unica primaria nei browser privi di entrambe le API native. Conservare nome file e spiegazione veritiera; niente fallback automatico.

Il seguito è locale, senza nuova versione o pubblicazione. Raccogliere anche il riscontro di Diego sull’ingresso e sulle due Tessere prima del prossimo rilascio; non dedurre PASS fisici dai test automatici. La281 resta online; RG-01/RG-04 e altri residui restano aperti.

<a id="rilascio-1281-programma-2026-11-17"></a>

## Ingresso e contatti — distribuiti nella1.2.281

Implementazione e rilascio chiusi: ingresso coerente e contatti con un comando/pannello compatto disponibili nella1.2.281, #328/Hosting#1208 e verifica pubblica completa PASS. [Ricevuta](../evidenze/COLLAUDI.md#rilascio-1281-verifiche-2026-11-17). Restano la prova fisica di Diego sul nuovo ingresso FaceID/passkey e su file/condivisione in privato/azienda, oltre a RG-01/RG-04 già aperti. Nessun PASS fisico trasferito da Chromium o dagli emulatori. Cornice ordinaria e tempi di sicurezza conservati; nessun nuovo incarico di sicurezza, policy o installazione dedotto dal rilascio. Le proposte e attese dei checkpoint sotto sono superate da questa pubblicazione.


<a id="ingresso-contatti-1281-programma-2026-11-17"></a>

## Seguito autorizzato e implementato — 1.2.281

L’[ordine diretto](INCARICO_CORRENTE.md#ingresso-contatti-1281-2026-11-17) supera la proposta storica sotto e comprende ingresso e contatti. Implementazione locale conclusa; completare suite, confezione, riesame indipendente/CI, PR/merge e Hosting protetto, poi verifica pubblica. Restano prova fisica iPhone/Android/PC di condivisione, destinazione file e nuovo ingresso. Nessun PASS fisico dedotto da Chromium; RG-01/RG-04 restano aperti.


<a id="contatti-flusso-2026-11-17"></a>

## Seguito dei contatti e ingresso — 17/11/2026

Diego segnala nella280 il difetto dimensionale dei pulsanti azienda e la ridondanza Tessera → popup → eventuale conferma della cornice. [Correttivo dimensionale locale e prove](../evidenze/COLLAUDI.md#contatti-compact-verifiche-2026-11-17); produzione invariata.

**Proposta di flusso, da discutere:** una sola entry «Salva o condividi contatto…» in entrambe le Tessere; preparazione del file e dei controlli; un solo pannello finale con nome visibile, una primaria e Chiudi. Primaria secondo capacità effettive: condivisione file se supportata; altrimenti scelta destinazione se disponibile; altrimenti download. Le alternative necessarie possono stare sotto «Altre opzioni». Il download resta un'alternativa esplicita per indisponibilità o errore; mai avviarlo automaticamente dopo annullamento.

Per eliminare davvero il pannello duplicato nella cornice occorre valutare la sola presentazione della conferma nativa esistente, mantenendo immutati snapshot/fingerprint, proof consumabile una volta, identità/revisione/generazione, revoca, scadenza e clic trusted finale senza await prima dell'API. Non promettere apertura OS dal primo tocco dopo preparazioni asincrone. Nessuna distinzione rigida tramite nome del browser o semplice classificazione telefono/PC. Nessuna di queste modifiche di flusso è dichiarata già applicata.

Il nuovo riscontro fisico post-login è la sequenza password salvata → verifica → Home → verifica → Vault bloccata → verifica → richiesta passkey. Confrontare routing standalone/cornice, guardie e avvio dello sblocco, distinguendo i due scopi di autenticazione dal codice prima di attribuirli. L'obiettivo di presentazione è evitare Home e stato di inattività prematuri durante il primo ingresso, conservando gli stati necessari per blocchi effettivi. Nessuna causa o correzione Auth è ancora accertata.

<a id="rilascio-1280-programma-2026-11-17"></a>

## RG-02/RG-03 — applicati e distribuiti nella 1.2.280, 17/11/2026

Chiuso RG-02 e il solo perimetro approvato RG-03: rosso delle card scadute, scrittura originaria degli intestatari e tipografia/etichette italiane selezionate del Profilo. Inclusi nello stesso rilascio anche vCard e lente Tessera azienda. #326/Hosting#1200, verifica pubblica completa PASS; [ricevuta](../evidenze/COLLAUDI.md#rilascio-1280-completo-verifiche-2026-11-17). RG-01/RG-04, prove native/fisiche e transitorio post-passkey restano aperti. Il mandato iniziale e i checkpoint sotto non sono lo stato corrente della pubblicazione.

Diego approva la proposta e ordina nuova versione, PR/merge/deploy e aggiornamento MD/GitHub. Sequenza: applicazione locale e registri → controlli/revisione → confezione1.2.280 → CI sulla testa → merge/CI master → Hosting protetto → verifica pubblica/ricevuta. [Mandato](INCARICO_CORRENTE.md#rilascio-1280-incarico-2026-11-17), [stato](STATO.md#rilascio-1280-stato-2026-11-17). L'approvazione della proposta chiude la scelta estetica qui presentata, non le prove fisiche di RG-01/RG-04 o la revisione completa delle otto lingue.

<a id="ingresso-passkey-2026-11-17"></a>

### Controllo successivo — schermata transitoria al primo ingresso

Diego osserva su PC e telefono che dopo l'accesso biometrico/passkey compare brevemente «Vault bloccata» con «Sblocca e riprendi», poi il flusso prosegue automaticamente: **non preme il pulsante e non descrive un secondo sblocco manuale obbligatorio**. Verificare se il primo ingresso viene presentato come ripresa di una cornice bloccata o se è lo stato transitorio di inizializzazione. Valutare un indicatore neutro durante l'ingresso, mantenendo controlli di identità/permesso e la schermata corretta per i blocchi effettivi (inattività, revoca e altri motivi contrattuali). Osservazione da riprodurre, causa non accertata; controllo successivo al rilascio grafico, senza modifiche Auth/Vault autorizzate implicitamente da questa nota.

**Tessere digitali — nome e destinazione della vCard.** Alla verifica precedente sulla produzione279, il Profilo privato produceva `profilo.vcf`; Dati azienda produceva `contatto-azienda.vcf`. Entrambi delegano il download al browser e non importano automaticamente nella rubrica. Diego conferma che sul PC vede il file aziendale in Download; sul telefono non comprende né il nome né la destinazione. Questo rilievo non attesta un download mobile completato o fallito. Richiede nomi riconoscibili: **`contatto-Nome-Cognome.vcf`** per il privato e **`contatto-azienda-Nome-Ditta.vcf`** per l'azienda, usando la ragione sociale e non il nome dell'amministratore. Mostrare il nome prima del comando e nel riscontro; valutare «Salva contatto…» con scelta della destinazione nativa quando disponibile e istruzioni comprensibili negli altri casi. Nel download tradizionale il riscontro deve dire «Download avviato: nomefile», senza attestare salvataggio o percorso non conoscibili dall'app. Il nome deve rimanere coerente fra salvataggio e condivisione, con caratteri e lunghezza compatibili col filesystem e fallback dichiarato se manca il titolare.

**Condivisione — differenza PC/telefono.** Diego riferisce che «Condividi» funziona sul cellulare ma sul PC non produce un risultato comprensibile. Nel [produttore privato](../../Frontend/public/assets/js/modules/privato/profilo_privato.js) sono previsti Web Share se ammesso e download alternativo; la causa dell'osservazione non è accertata. Distinguere capacità, conferma della cornice, annullamento, rifiuto/errore e consegna al sistema, dando un esito visibile e un'alternativa esplicita. Nessun download automatico dopo un annullamento e nessun messaggio «salvato» dedotto dal solo successo di Web Share. Preservare gesto trusted, controllo del destinatario e della revoca, senza salvare handle o registrare vCard/nomi nei log. I banchi che simulano la condivisione non attestano Windows o telefoni reali.

**QR della Tessera azienda — ingrandimento.** Controllo locale prima del correttivo, richiesto da Diego con dati inventati in entrambe le grafiche e payload di 80 e 1.324 byte: il QR della tessera rimane 220×220 px, senza lente né zoom al tap; oltre 1.200 byte compare soltanto l'avviso di capacità. La lente della testata apre invece il modale esistente con QR 300×300 px. Quindi non risulta un ingrandimento automatico della tessera al crescere dei dati: prevedere un comando accessibile esplicito nella tessera e prove di apertura/chiusura e dati selezionati. Nessuna prova di scansione fisica o salvataggio produttivo deriva da questo controllo.

Nomi, scelta destinazione, condivisione e zoom sono ora **inclusi nell'incarico ampliato della 1.2.280**, dopo l'ordine di Diego di pubblicare tutto insieme; implementazione, CI e pubblicazione completate con verifica pubblica integrale PASS. [Ricevuta del rilascio](../evidenze/COLLAUDI.md#rilascio-1280-completo-verifiche-2026-11-17). [Contratto e collegamenti](../regole/INTERFACCIA.md#vcard-1280-ui-2026-11-17). Servono regressioni sui percorsi nativi e prove distinte su PC, iPhone, Android e PWA; la disponibilità del sistema non consente di promettere una finestra identica in tutti i browser. La schermata post-passkey sopra resta un controllo separato, senza causa attribuita a questi rilievi. [Mandato](INCARICO_CORRENTE.md#vcard-1280-incarico-2026-11-17).

<a id="scaletta-chiusura-2026-11-17"></a>

## Scaletta di chiusura aggiornata — 17/11/2026

Fonte: [ordine di Diego](INCARICO_CORRENTE.md#scaletta-chiusura-incarico-2026-11-17), dopo il confronto con la scaletta di Claude. Questa è la priorità corrente; i checkpoint datati sotto conservano le rispettive evidenze e non ripropongono attività già concluse. Il programma non autorizza da solo esecuzioni, account, installazioni o rilasci.

1. **Residui grafici, non ripetizione del giro già pubblicato.** Gli undici correttivi UI275 sono distribuiti dalla 1.2.276; #316 e seguito Codex sono confluiti nella #318/1.2.277; base comune e bicolore nella 1.2.278; identità delle singole Scadenze nella 1.2.279. Non manca un nuovo GO o ordine per pubblicare la #316. Le 492 occorrenze oltre profondità erano ripetizioni raggruppate in 30 scenari, con 234 stati e 3.276 contesti sintetici verificati, non 492 viste ancora tutte da aprire. Restano il controllo a vista sul telefono e i limiti del banco descritti nel [lotto grafico sotto](#residui-grafici-2026-11-17); nessuna certificazione universale da questi numeri.
2. **Completare i collaudi della cornice già attiva.** La cornice ordinaria è disponibile dalla 1.2.275 agli utenti verificati e ammessi sulle 22 route private: non va riattivata come pilot o limitata a un utente. Riprendere C1 residua, D15 con sessione aperta, Android/iPhone/altri browser/PWA e D18. D18 richiede una cornice della versione precedente mantenuta aperta attraverso due rilasci reali approvati; contare i deploy non basta. I sei PASS storici valgono soltanto per QA2/Chrome Windows/1.2.270. L'eventuale fase personale/C2 richiede l'ordine e i gate propri, senza confonderla con l'attivazione generale. [Stato e limiti](STATO.md#cornice-ordinaria-1275-stato-2026-11-14).
3. **Sicurezza e recupero.** Distinguere i motivi dei rifiuti oggi aggregati in `ERROR_FRAME_OPERATION`: un episodio Home è classificato come rifiuto gestito, due precedenti restano da chiarire. Riesaminare le ricariche standalone di Impostazioni ogni tre minuti a Vault bloccata, rilievo di efficienza; spostare «Elimina» Scadenza nel modulo di modifica e rivedere i percorsi di cancellazione. Completare i lotti su notifiche dopo logout/cambio account, MIME, dipendenze/token e credenziali cloud, AAD/purge, recupero 2FA e Recovery FULL/migrazione, cache cifrata e conversione legacy, con i rispettivi gate. Gli audit indipendenti iniziano in sola lettura e su banco sintetico, senza attacchi alla produzione. SEC-MON-01 è già registrato come attivo alle 07:30 Europe/Rome e accompagna tutte le fasi; questo aggiornamento non ne certifica una nuova esecuzione. [Seguito diagnostico](#cornice-c1-fase1-seguito-2026-11-13), [cancellazioni](#scadenza-elimina-decisione-2026-11-11), [recupero e residui](#chiusura-e-priorita-2026-11-07).
4. **Prodotto residuo.** Matrice funzionale italiana e condivisioni dai due lati; revisione editoriale delle otto lingue e della guida pagina per pagina; Archivio portabile in un secondo programma ODS; banca su iPhone, offline e backup interrotto/ripreso; censimento manuale di lucchetti e campi protetti. La retention Archivio è già decisa: due anni dall'ultima archiviazione e avviso dieci giorni prima; restano verifiche, D8 legale e altre famiglie (allegati/backup), senza riaprire implicitamente la scelta. [Matrice finale](#collaudo-qa-finale-01--matrice-funzionale-e-linguistica--03112026).
5. **Ciclo finale di maturità.** End-to-end sui browser supportati, configurazioni e verifica di produzione, audit indipendente di sicurezza/crittografia, privacy/legale, procedura incidenti e chiusura dell'incidente storico. Prove automatiche, osservazioni fisiche e distribuzione restano stati distinti; nessun audit promette assenza assoluta di difetti.
6. **PentAGI per ultimo.** Solo emulatori o progetto di prova, dati inventati, Docker sul PC di Diego, lettura preventiva del codice e validazione delle segnalazioni da Claude e Codex. Resta «non incarico attivo», senza autorizzazione a installare o eseguire. [Vincoli concordati](#pentagi-nota-2026-11-10).

**Distribuzione e supporto.** Non emerge un piano commerciale operativo approvato per prezzi, monetizzazione o lancio; esistono riferimenti storici a un pacchetto commerciale, non un mandato attuale a realizzarlo. App e cornice contemplano già altri utenti; l'assistenza manuale 2FA è una scelta pubblicata. Canale e tempi di risposta, referenti e comunicazioni di incidente restano da definire nella [guida](../utente/GUIDA.md#fonte-docs-m10-guida-utente-bozza-md-11-segnaposto-per-le-informazioni-organizzative-da-compilare), senza dichiarare assente ogni pianificazione del supporto.

<a id="residui-grafici-2026-11-17"></a>

### Primo lotto — residui grafici dopo 1.2.279

Seguito del17/11: [proposta locale e confronto mobile pronti](../evidenze/COLLAUDI.md#rg02-proposta-verifiche-2026-11-17) su nuovo ordine di Diego. RG-02 è riprodotto con alternativa misurata, RG-01/RG-03 hanno anteprime a 390 px nelle due grafiche; la scelta estetica fu poi approvata e il perimetro concordato è ora distribuito nella280. Le prove fisiche e RG-04 restano aperti.

| ID | Controllo residuo | Criterio ed evidenza richiesta |
|---|---|---|
| RG-01 | Card Scadenze sul telefono, date e calendario rossi | Valutazione di Diego a vista: Home, elenco, scadute e archiviate; annotare tema, aspetto, grafica, dispositivo/browser e osservazione. Mantenere le scadute rosse fino a una decisione esplicita. |
| RG-02 | Contrasto del rosso — chiuso nella1.2.280 | Baseline storica2,72:1; corretti glifo/data delle card scadute con token locale #A61B1B/#FECACA, sette temi e due grafiche. Regressioni e CI verdi, pubblicazione verificata; non è più debito corrente di quel componente. |
| RG-03 | Caratteri — chiuso nel perimetro approvato della1.2.280 | Scrittura originale degli intestatari e trasformazione/spaziatura delle quattro classi Profilo, con cinque etichette italiane, approvate e distribuite. Nessuna riscrittura globale o modifica di font/dimensioni; eventuali altri casi richiedono rilievo puntuale. |
| RG-04 | Limiti nativi e visivi non attestati | Flag/QR, picker file e condivisioni native, contenuti coperti/ritagliati/fuori viewport, Safari/PWA e dispositivi fisici: registrare i casi pertinenti realmente osservati; non trasferire i PASS Chromium o del markup a questi ambienti. |

Dopo la280 si prosegue con RG-01/RG-04; Impostazioni e Profilo sono priorità per il confronto a vista, non 492 nuove visite obbligatorie. Per ciascun rilievo mantenere pagina → azione/stato → produttore/componente → CSS/ruolo → test → esito, riusando [registro profondo](../../scripts/ui-deep-theme-contract.json), [dinamico](../../scripts/ui-dynamic-theme-contract.json) e [livree](../../scripts/ui-livery-contract.json). Classica e Nuova condividono base/decorazioni; solo Nuova usa bicolore e card +15%. Le [prove esistenti](../evidenze/COLLAUDI.md#deep-temi-313-verifiche-2026-11-16) e il [debito del rosso](../evidenze/COLLAUDI.md#icone-scadenze-verifiche-2026-11-16) conservano fonte, data e limiti; nessuna nuova approvazione estetica o prova fisica viene attribuita a Diego da questa scaletta.

<a id="rilascio-1278-programma-2026-11-16"></a>

## APP 1.2.278 — rilascio completato, 16/11/2026

Completata la sequenza autorizzata sotto: #320, master pubblicato **a02c76a7**, Hosting #1187 SUCCESS e verifica completa **365 hash / 41 profili / tre probe PASS**. La [ricevuta finale](../evidenze/COLLAUDI.md#rilascio-1278-verifiche-2026-11-16) chiude il rilascio; l'aggiornamento dei Markdown su GitHub è separato dallo SHA runtime e non avvia un altro deploy. Cornice e faro conservati.

[Incarico](INCARICO_CORRENTE.md#rilascio-1278-incarico-2026-11-16): script canonico versione e offline, riesame della guida e identità del pacchetto → revisione indipendente e CI dello SHA finale → merge con testa attesa → workflow manuale `hosting` sul master finale, production protetto → verifica pubblica completa → ricevuta nei Markdown e su GitHub. Conservare rami e worktree precedenti; nessuna operazione policy/backend. [Stato](STATO.md#rilascio-1278-stato-2026-11-16), [evidenze](../evidenze/COLLAUDI.md#rilascio-1278-verifiche-2026-11-16).

<a id="livree-comuni-programma-2026-11-16"></a>

## Livree Classica/Nuova — seguito locale completato, 16/11/2026

[Ordine](INCARICO_CORRENTE.md#livree-comuni-incarico-2026-11-16): unificare la base evoluta e le tre decorazioni, conservare Classica nella palette principale, applicare bicolore e card +15% soltanto alla Nuova. Conservare i correttivi Ricerca del ramo corrente. Sequenza: contratto e ruoli centrali → produttori/CSS → adeguamento dei banchi ai marker distinti → matrice di pagine/palette e stati dinamici pertinenti → riesame in lettura e ricevuta locale. Il [registro](../../scripts/ui-livery-contract.json) collega componenti, colori, produttori e prove; gli esiti effettivi vanno nelle [evidenze](../evidenze/COLLAUDI.md#livree-comuni-verifiche-2026-11-16).

Nessuna nuova versione, commit/push, PR, merge, deploy o operazione policy/backend è autorizzata da questo seguito. Il rilascio completato sotto conserva la propria ricevuta.

Completati implementazione, matrice dei sette temi, controlli dinamici e riesame in lettura. La [ricevuta locale](../evidenze/COLLAUDI.md#livree-comuni-verifiche-2026-11-16) distingue i gruppi eseguiti, le prove negative e i limiti; nessuna equivalenza con CI o pubblicazione.

<a id="rilascio-1277-programma-2026-11-16"></a>

## APP 1.2.277 — rilascio del giro #313 completato, 16/11/2026

Su [ordine di Diego](DECISIONI.md#rilascio-1277-decisione-2026-11-16), completata la sequenza confezionamento canonico → identità funzionale e controlli → riesame indipendente e CI dello SHA effettivo → merge #318 → workflow manuale Hosting sul master finale → approvazione production delegata → verifica pubblica di manifest/hash/intestazioni. Candidata **630aed9f**, master pubblicato **8d28c7b5**, [Hosting #1182 SUCCESS](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/43877847216), **365 hash / 41 profili / tre probe PASS** e riscontro indipendente di cinque GET. [Incarico](INCARICO_CORRENTE.md#rilascio-1277-incarico-2026-11-16), [stato](STATO.md#rilascio-1277-stato-2026-11-16), [ricevuta](../evidenze/COLLAUDI.md#rilascio-1277-verifiche-2026-11-16). Cornice ordinaria conservata e pilot storico ritirato; nessuna modifica policy/backend o nuova attestazione fisica. Questa chiusura aggiorna soltanto documenti; il codice Hosting resta sullo SHA attestato.

<a id="deep-temi-313-programma-2026-11-16"></a>

## Giro #313 — chiusura dei comportamenti oltre profondità, 16/11/2026

Su [ordine di seguito](INCARICO_CORRENTE.md#deep-temi-313-incarico-2026-11-16), le 492 occorrenze ripetute della #317 sono ricondotte a gruppi di comportamento nel [registro dei percorsi profondi](../../scripts/ui-deep-theme-contract.json): Impostazioni 252, Profilo 96, altri percorsi 144. Il registro dichiara 30 scenari, 117 stati per grafica e relativi collegamenti a produttori, CSS, colori e test. Il grafo UI importa queste relazioni come dichiarate, senza trasformarle in osservazioni o PASS. [Metodo e limiti](../regole/INTERFACCIA.md#deep-temi-313-ui-2026-11-16), [esiti](../evidenze/COLLAUDI.md#deep-temi-313-verifiche-2026-11-16).

[Claude ha recepito la #317 nella #316/a126d59d](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/316#issuecomment-6915022674). Il seguito Codex resta separato: prove con dati sintetici, correzioni pertinenti riprodotte, bozza contro master per la CI completa e revisione sullo SHA finale. Il confronto con Claude continua sulla consegna concreta. Nessuna modifica alla produzione 1.2.276, alla disponibilità della cornice o alle decisioni cromatiche; versione, merge e deploy richiedono un nuovo ordine.

<a id="review-temi-313-programma-2026-11-16"></a>

## Giro #313 — revisione e consegna a Claude, 16/11/2026

Diego consegna **39e7bab** della [#316](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/316) e autorizza Codex a completarne revisione e correzioni pertinenti senza attendere Claude. Il ramo separato `codex/review-ui313-20261116` conserva intatta la sorgente di Claude per il confronto successivo. [Incarico](INCARICO_CORRENTE.md#review-temi-313-incarico-2026-11-16), [contratto delle prove](../regole/INTERFACCIA.md#review-temi-313-ui-2026-11-16), [esiti](../evidenze/COLLAUDI.md#review-temi-313-verifiche-2026-11-16).

Automezzi: il vecchio banco apriva soltanto lo stato senza regola; il produttore reale riceve ora una configurazione sintetica valida con `source=deadlineConfig&rule=tour-rule`, editor, mezzo esistente e aggiunta. Questo residuo non è un difetto applicativo dimostrato. Le correzioni applicative emerse riguardano contrasto dei menu, Annulla ordinario e decorazioni fisse residue. Censimento alla fonte, matrice dinamica, inventario statico e tour runtime conservano esiti e limiti distinti. Il seguito oltre la profondità osservata e le prove native/fisiche restano espliciti; nessun numero d'inventario equivale a una certificazione universale.

Correttivo verificato: matrice 1064/1064 e inventario delle 22 pagine nelle due grafiche, con profondità e residui espliciti. Consegna revisionabile a Claude con diff, test e dati di provenienza; produzione **1.2.276** e cornice ordinaria già attestate. Questo incarico non comprende cambio versione, merge, deploy o nuove operazioni cloud.

<a id="temi-segnalazioni-1275-2026-11-15"></a>

## Temi 1.2.275 — segnalazioni di Diego da verificare, 15/11/2026

Diego chiede di annotare i casi seguenti e di chiarire dove sono conservate le relazioni fra pagine, interazioni e colori. Successivamente autorizza mappatura dinamica, undici correzioni e prove nelle 28 combinazioni di grafica/palette/luminosità. Le osservazioni sotto conservano il problema originario della 1.2.275; i correttivi sono **pubblicati nella 1.2.276** dopo verifica dei 38 stati censiti e CI completa. [Ricevuta](../evidenze/COLLAUDI.md#temi-rilascio-1276-verifiche-2026-11-15). [Esiti e limiti](../evidenze/COLLAUDI.md#temi-dinamici-ui275-2026-11-15), [perimetro corrente](INCARICO_CORRENTE.md#temi-annotazione-incarico-2026-11-15).

Il giro completo successivo su tutte le pagine/opzioni è affidato a Claude su ordine di Diego nella [#313](https://github.com/Diego-Stack-ai/App-Codici-Password/issues/313), con notifica nel thread #308 e presa in carico ancora da confermare. Codex completa i primi undici casi e il banco riusabile; evitare scritture sovrapposte, account reali e PASS attribuiti a stati non aperti. Il successivo [ordine 1.2.276](INCARICO_CORRENTE.md#temi-rilascio-1276-incarico-2026-11-15) autorizza il rilascio dei soli undici correttivi: confezionare, revisionare, aprire PR, attendere CI, unire, distribuire solo Hosting e verificare manifest/hash/intestazioni. Sequenza completata nella #314 e Hosting #1173, con verifica pubblica PASS. Il secondo giro resta separato.

| ID | Area o stato segnalato | Osservazione originaria |
| --- | --- | --- |
| UI275-01 | Aggiornamento e refresh | La schermata rimane celeste dopo il cambio della palette. Verificare anche la transizione e il caricamento iniziale del tema. |
| UI275-02 | Blocco/sblocco della cornice | Sfondo celeste e pulsante «Sblocca e riprendi» blu indipendenti dalla palette scelta. Distinguere questa schermata dal modale di inserimento della Master Password. |
| UI275-03 | Allegati, in generale | Card, popup e relative superfici non sembrano seguire il tema; censire i diversi punti di apertura, non soltanto una pagina. |
| UI275-04 | Ricerca | Punto interrogativo nella card e campo/area della spiegazione non seguono il tema. |
| UI275-05 | Fascia superiore del Profilo utente | Talvolta entrando nella pagina resta scura e non trasparente. Riesaminare tema iniziale, transizione e superficie effettiva, distinguendo il difetto segnalato dalla protezione di contrasto prevista per titolo e comandi. |
| UI275-06 | Flag di inclusione nel QR | Le caselle/flag restano azzurri con altre palette. |
| UI275-07 | Riquadri QR | Cornici e contenitori QR in generale non sembrano seguire il tema. Distinguere le superfici decorative dai colori del codice necessari alla sua lettura. |
| UI275-08 | Widget personalizzati | La card ha una sottile linea celeste sul bordo superiore. |
| UI275-09 | Linguette del Profilo | La barra scorrevole «Panoramica, Anagrafica, Contatti, Indirizzi, Documenti, Tessera digitale» non sembra seguire il tema; includere selezione e scorrimento. |
| UI275-10 | Guida del Profilo dal comando inferiore | Il popup aperto dal pulsante indicato da Diego come «!» ha un comando «Chiudi» con effetto tendente al celeste e troppo intenso; controllare colore e alone, senza presumere quale simbolo sia mostrato dal componente. |
| UI275-11 | Card Scadenze | Le card non sembrano seguire il tema. Separare sfondo, bordi e comandi dai colori funzionali di valido/in scadenza/scaduto, che conservano il proprio significato. |

Il [registro dinamico](../../scripts/ui-dynamic-theme-contract.json) associa ogni ID a pagina/stato, azione, produttore/componente, selettore/proprietà, sorgenti CSS, ruolo cromatico ed effettivo test. Il [banco locale](../../scripts/dynamic-visual-map.mjs) prova Nuova e Classica, sette palette e chiaro/scuro, con cambio tema, ingresso, refresh e aperture pertinenti. Un caso passa soltanto per gli stati realmente esercitati; nessun PASS trasferito dai precedenti inventari statici. Gli stati non censiti e l'inventario cromatico non ancora classificato restano nel secondo lavoro affidato a Claude.

**Dove si conserva la conoscenza.** Il [registro delle pagine e i contratti UI](../regole/INTERFACCIA.md#fonte-docs-canonical-page-registry-md-l1) descrivono la superficie e i flussi previsti. [build-ui-topology.mjs](../../scripts/build-ui-topology.mjs) estrae pagine, controlli, collegamenti e pattern degli eventi in `graphify-out/ui-topology.json`; il [contratto della topologia](../../scripts/ui-topology-contract.json) dichiara dieci flussi critici e tre scenari runtime. Questa estrazione statica non percorre tutti i clic; anche i controlli di [audit-navigation-flows.mjs](../../scripts/audit-navigation-flows.mjs) restano mirati. Il [catalogo della guida](../../Frontend/public/assets/js/modules/assistant/documentation-catalog.json), revisionato sulla 275, conserva percorsi, istruzioni e target. La mappa locale `graphify-out/graph.json` collega sorgenti e dipendenze, con i [limiti CSS dichiarati](../regole/INTERFACCIA.md#ui-color-contract-2026-11-13).

Per i colori, `core.css` conserva le palette e `core_ui.css` i ruoli comuni; [ui-color-contract.json](../../scripts/ui-color-contract.json) registra abbinamenti verificati e casi pendenti, mentre [ui-color-decisions.json](../../scripts/ui-color-decisions.json) registra decisioni ed eccezioni. [visual-map.mjs](../../scripts/visual-map.mjs) misura l'aspetto calcolato dei contesti predisposti, rimuovendo gli script dell'app: contenuti dinamici, popup, transizioni e stati non visibili richiedono fixture o prove dedicate. Sono strumenti complementari: non esiste ancora un'unica mappa completa e verificata di ogni pagina, clic, stato dinamico e proprietà grafica dell'app.

<a id="cornice-ordinaria-1275-programma-2026-11-14"></a>

## APP 1.2.275 — sequenza autorizzata UI e cornice ordinaria

1. Comporre UI e runtime ordinario con i contratti aggiornati, prove locali negative e revisione tecnica indipendente. Le ricevute della #310 confluiscono senza ripubblicare la274.
2. Confezionare 1.2.275, catalogo rivisto, cache/asset e manifest sullo SHA pulito; PR e CI richiesta verde. L'[ordine](INCARICO_CORRENTE.md#cornice-ordinaria-1275-incarico-2026-11-14) elimina l'attesa del GO Claude per questo rilascio, mantenendo i controlli.
3. Integrare la candidata e avviare i run master degli scope **vault-frame-rules** e **hosting** sullo stesso SHA. Validazioni indipendenti possono procedere insieme; approvare ed eseguire prima le Rules, poi Hosting. Nessuna Function, Storage o indice.
4. Verificare online manifest/hash/header e sorgente Rules realmente pubblicata; eseguire solo dopo il workflow **Ordinary Vault frame policy**, mode enable e SHA atteso, con production protetto. Migrazione da OFF e attivazione ultima con CAS e riletture prima/dopo; registrare lo stato effettivo.
5. Conservare le prove storiche nel proprio perimetro. Il banco locale delle 22 route non è una prova fisica Android/iPhone/PWA, e la rilettura del singleton non è D15 con sessione aperta. D18 richiede due rilasci effettivi; nessuna chiusura globale inventata.

[Procedura e rollback](../regole/RILASCIO.md#cornice-ordinaria-rilascio-2026-11-14), [evidenze](../evidenze/COLLAUDI.md#cornice-ordinaria-1275-verifiche-2026-11-14).

<a id="rilascio-ui-1274-programma-2026-11-14"></a>

## APP 1.2.274 — rilascio concluso e percorso cornice ordinaria, 14/11/2026

[Ordine di Diego](DECISIONI.md#rilascio-ui-1274-decisione-2026-11-14) completato: UI #308, confezionamento #309, master **51ff1673b0ebddc0e2bdc52443a21d146d2835d3**, [Hosting #1163](https://github.com/Diego-Stack-ai/App-Codici-Password/actions/runs/43640799691) e [verifica pubblica](../evidenze/COLLAUDI.md#rilascio-ui-1274-verifiche-2026-11-14) riusciti. Nessun altro deploy per questa ricevuta.

Il seguito richiesto è la cornice ordinaria per tutti gli utenti e tutte le **22 route private**, con un solo sblocco iniziale durante la navigazione interna. Preparazione distinta dal rilascio grafico:

1. Comporre una candidata C2 che aggiorni insieme l'ammissione in `main-v129.js`, lo schema globale di `vault-frame-permit.mjs` e le Rules del singleton in `firestore.rules`: utenti autenticati, verificati e ammessi dal fence di recupero, senza dipendenza dal claim pilot e con scritture client sempre negate. Ogni permesso derivato resta legato all'UID corrente; nessuna assegnazione massiva di claim o filtro per browser.
2. Definire transizione vecchio/nuovo schema, durata della policy ordinaria e interruttore generale OFF autorevole; aggiornare `scripts/plan-vault-frame-release.mjs` e i contratti esistenti pertinenti. Chiusura del vecchio pilot e revoca delle credenziali temporanee sono passi amministrativi distinti, non eseguiti ora.
3. Aggiungere prove mirate: utente verificato senza claim, isolamento di due utenti, rifiuto su cambio UID/fence, policy assente/scaduta/disabilitata/non valida, revoca globale e compatibilità dei client; verificare che le pagine interne non introducano una nuova lettura della policy a ogni passaggio.
4. Conservare i sei PASS C1 QA2/Chrome Windows/1.2.270 (D02, D04-core, D05-A, D06-1, D06-3, D08-local). D02 storico copriva dieci route: il giro della candidata ordinaria deve attraversarne 22. Non ripetere automaticamente i casi già verdi né attribuirli ai telefoni.
5. Pianificare ricevute fisiche separate per Chrome Windows, Android e iPhone: un solo sblocco iniziale, navigazione delle 22 route con dati sintetici senza salvataggi, cronologia, ritorno da background/inattività, reload, logout e Indietro protetti. PWA/Home e altri browser sono modalità distinte, non esclusioni tecniche richieste da Diego. Login e pagine pubbliche restano fuori cornice.
6. Raccordare i sottocasi C1 ancora NE e il passaggio personale/C2 nel GO del nuovo perimetro; eseguire D15 con OFF durante una sessione aperta e D18 attraverso due rilasci reali approvati. Il rilascio attuale a canary OFF non dimostra queste prove.

Canary **OFF secondo Diego**. Questo percorso è preparato sul sorgente 51ff1673, senza patch applicativa, nuova prova autenticata o operazione amministrativa. La destinazione ordinaria è decisa; implementazione, revisione e prove effettive restano da completare secondo l'[incarico](INCARICO_CORRENTE.md#rilascio-ui-1274-incarico-2026-11-14).

<a id="rilascio-ui-1272-programma-2026-11-13"></a>

## APP 1.2.272 — sequenza del rilascio colori, 13/11/2026

La [scelta di intensità graduale e l'ordine di rilascio](DECISIONI.md#colori-intensita-rilascio-2026-11-13) seguono il merge della #302 in `0ffc0a39`; la #283 è chiusa come confluita. Il perimetro è il [confezionamento 1.2.272 solo Hosting](INCARICO_CORRENTE.md#rilascio-ui-1272-incarico-2026-11-13), senza nuovi aggiustamenti dei colori o attivazione della cornice.

1. Bump canonico e riesame del catalogo aiuti; controlli locali, manifest/hash e modello degli header sulla candidata pulita, registrando esiti reali e limiti nelle [evidenze](../evidenze/COLLAUDI.md#rilascio-ui-1272-verifiche-2026-11-13).
2. Revisione di Claude e CI verde sullo SHA finale; poi integrazione e dispatch Hosting già autorizzati. Il GO della #302 non sostituisce quello del confezionamento. L'approvazione production resta personale di Diego.
3. Dopo Hosting, verifica online di versione, manifest, hash e intestazioni per pagina e ricevuta del rilascio. Il successivo giro breve QA2 sulla 1.2.272 resta da autorizzare separatamente; le prove precedenti non gli attribuiscono PASS automatici.

Canary **OFF secondo Diego**. Nessuna ulteriore operazione cloud, prova QA2/personale, Rules, Functions o modifica della cornice. Restano aperti gli altri ambienti e sottocasi C1, D15, fase personale/C2 e D18; nessuna chiusura globale. I checkpoint sotto conservano il contesto storico.

<a id="rilascio-ui-1271-programma-2026-11-13"></a>

## Candidata APP 1.2.271 — preparazione prima del rilascio, 13/11/2026

L'[ordine corrente](INCARICO_CORRENTE.md#rilascio-ui-1271-incarico-2026-11-13) avvia la preparazione dell'app con UI e tipografia della #283, cornice gia presente nella 1.2.270 e ricevute C1 consolidate. Il precedente passo solo documentale e incorporato e resta sotto come checkpoint storico. Base master `0a599364`, fonte UI `9764c590`, ramo `codex/release-ui-1.2.271-20261113`; candidata locale **1.2.271 / DA_VERIFICARE**, non ancora produzione.

1. Comporre il candidato preservando master e il runner C1 corrente, versionare il pacchetto e allineare cache/precache, manifest e riferimenti di rilascio. Eseguire e registrare soltanto i controlli locali pertinenti: coerenza documentale, build, hash, modello degli header e banco browser locale.
2. Consegnare una sola PR in bozza per Claude con SHA esatto, differenze, risultati effettivi e limiti. Il GO UI precedente non approva automaticamente l'integrazione o i nuovi byte di confezionamento; attendere revisione e check richiesti senza auto-approvazione.
3. Dopo la revisione, sottoporre a Diego il candidato concreto e i successivi passi di merge, rilascio CI e giro breve. Ciascuno resta soggetto al proprio ordine; il giro breve deve dichiarare versione, ambiente e copertura. I sei PASS su QA2 / Chrome Windows / 1.2.270 non si trasferiscono automaticamente alla 1.2.271.

Canary **OFF secondo Diego** durante questa preparazione; nessun nuovo giro produttivo, merge, deploy o operazione cloud. Il perimetro gia verificato e Chrome desktop Windows: Edge, Safari, PWA e altri dispositivi restano da verificare, non esclusi per incompatibilita dimostrata. Restano aperti D15, gli altri sottocasi/ambienti C1, fase personale/C2 e D18 con secondo rilascio; niente CORNICE CHIUSA. I seguiti diagnostici ed efficienza descritti sotto restano pianificati e non implementati.

<a id="cornice-c1-fase1-seguito-2026-11-13"></a>

## C1 fase 1 — ricevute prioritarie consolidate e seguito da rivedere, 13/11/2026

La [conferma consolidata di Claude sulla #299](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/299#issuecomment-6857416470) riconosce i sei PASS prioritari **D02, D04-core, D05-A, D06-1, D06-3 e D08-local**, limitati a **QA2 / Chrome desktop Windows / v1.2.270**: nessuna ripetizione necessaria di questi sottocasi. Le [ricevute e i limiti](../evidenze/COLLAUDI.md#cornice-c1-fase1-prioritari-2026-11-13) distinguono i PASS circoscritti da D04/D05 complessivi LIMITE e dalle prove non eseguite. Il passo corrente e soltanto la PR documentale sui quattro Markdown esistenti, da sottoporre a Claude sullo SHA esatto; nessuna chiusura globale C1/C2 o CORNICE CHIUSA.

L'eventuale candidato UI/font della #283 richiedera allineamento a master, versione dedicata e verifica finale, conservando i gate UI e C1 e l'ordine personale di Diego. I PASS della 1.2.270 non si trasferiscono al candidato grafico: resta previsto almeno un giro breve sul candidato futuro. Questa preparazione documentale non avvia tale lavoro, un nuovo giro o il rilascio. Restano aperti D15 con prova dedicata, gli altri ambienti e sottocasi della matrice, la fase personale/C2 e D18 subordinato a un secondo rilascio; nessun PASS automatico. Canary **OFF secondo Diego**, senza rilettura amministrativa.

### Approfondimenti rinviati alla fase SICUREZZA

- **Motivo del rifiuto nella DIAG:** pianificare un enum chiuso per distinguere i rifiuti oggi aggregati in `ERROR_FRAME_OPERATION`, senza URL, UID, altri identificativi o testi liberi. Il gruppo delle tre specifiche occorrenze richiamate dalla nuova revisione comprende due eventi su `account_privati.html` l'11/11 alle **22:59:14.450 e 22:59:26.814 Europe/Rome**, secondo i JSON originali, per i quali il ricordo di Diego non e stato acquisito, e un evento sulla Home il 13/11 alle 10:54. Gli orari 23:12:34 e 23:12:46 indicati da Claude discordano dai JSON: il [dettaglio nelle evidenze](../evidenze/COLLAUDI.md#cornice-c1-fase1-prioritari-2026-11-13) conserva le fonti, da allineare nella revisione senza cambiare i PASS. Per l'episodio Home Diego ricorda un annullamento o una Master errata: il [criterio di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/299#issuecomment-6855725272) e il [registro aggiornato](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/299#issuecomment-6855446696) lo classificano come rifiuto gestito, fail-closed, comportamento atteso senza difetto accertato. Il ricordo non identifica il sottocodice tecnico; le due occorrenze precedenti restano da chiarire. La ricorrenza giustifica il seguito diagnostico, senza cambiare i sei PASS. Nessun enum o cambiamento applicativo implementato in questa consegna.
- **Ricariche standalone con canary OFF:** valutare dopo C1 il [rilievo non bloccante di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/299#issuecomment-6846567198) sul ciclo di ricarica di Impostazioni circa ogni tre minuti a Vault gia bloccata, con consumo di rete e saturazione del registro. L'obiettivo proposto e evitare che il timer si riarmi e ricarichi una pagina gia bloccata. La valutazione di Claude resta distinta da una verifica indipendente di sicurezza o efficienza; nessuna correzione o prova aggiuntiva e svolta qui.

I checkpoint sottostanti conservano gli ordini e le fotografie precedenti; non riaprono i sei sottocasi accettati e non autorizzano esecuzioni.

## C1 — revisione PR workflow manuale, poi ordini separati di merge ed esecuzione

[Piano e adapter](../procedure/COLLAUDI.md#cornice-c1-e2e-piano-2026-11-12) integrati con #292 su master 6dd80df1, dopo GO Claude 45f50a9e/CI e ordine personale. Configurazione GitHub eseguita da Diego, [verifica UI limitata a nomi e protezioni](../evidenze/COLLAUDI.md#cornice-c1-workflow-config-2026-11-12). Ora #293 per il workflow in .github/workflows, con corpo eseguibile invariato, test del nuovo percorso, CI e nuovo GO sullo SHA; nella stessa PR si registra il [criterio AUTO + giro breve approvato da Diego](DECISIONI.md#cornice-c1-auto-giro-breve-2026-11-12). Poi, solo su ordine di Diego, eventuale merge e registrazione master; dispatch ancora separato, inizialmente chrome-desktop con Diego presente per ON/OFF e ripristino timeout se interrotto. Nessun giro reale autorizzato ora, canary OFF. D02 Configurazione documenti NE senza link UI reale; nessun PASS simulato. Emulazioni separate, matrice19×4 mantenuta come indice delle evidenze per fase, senza sottocasi mancanti promossi dal giro breve. Restano Safari/PWA/camera/push, D15 personale, D18 con secondo rilascio, fase personale/C2. UI #283 con GO readonly 8a30920b, grafica/sicurezza fuori produzione fino a C1 completata e ordine di Diego. I checkpoint sotto sono precedenti.

## #285 — revisione opzione A, poi singoli passi autorizzati

Prima nuovo GO Claude su runner/ADC/rimozione e istruzioni IAM con i limiti espliciti; nessun merge o cloud in questo incarico. Poi ordini separati per ruoli/SA/delega, login ADC isolato, preflight autorizzato e ammissibilità QA2. Singleton OFF con destinatario sintetico corretto e Timestamp futuro concordato precede qualunque grant; dry-run non mostra identificativi e non sostituisce l'approvazione all'apply. Rimozione del claim dopo OFF e prima del cambio destinatario/C2, quindi revoca delega/SA/ADC. [Sequenza completa](../regole/RILASCIO.md#cornice-adc-impersonata-2026-11-10). C1 di ciascuna fase e sette giorni restano da concordare/eseguire; nessun automatismo.

## Cornice — revisione del runner e del piano sintetico → personale

Prima [revisione Claude del runner e della decisione in due fasi](INCARICO_CORRENTE.md#cornice-claim-preparazione-2026-11-10), senza eseguirlo. QA2 già popolata è candidata, non automaticamente ammessa; nessun nuovo account o riuso di QA1/fixture eliminate. Dopo GO e singoli ordini: preflight privato dell'identità, completamento singleton **spento** per il solo UID sintetico e Timestamp concordato, dry-run senza identificativi nel rapporto e verifica personale privata, ulteriore approvazione prima dell'unico aggiornamento claim, poi distinta attivazione e C1 fase 1. Per la fase 2: spegnere/verificare revoca, rimuovere claim precedente prima del cambio UID personale e controlli/approvazioni propri, C1 separata. Durata sette giorni da concordare senza rinnovi impliciti. C1 entrambe NE; UI e altri rilievi separati. Checkpoint sotto storici.

## Cornice: revisione della prescrizione B3.5, poi provisioning per passi

Hosting 1.2.268 già pubblicato sullo SHA 79ebd9b8, dopo Rules sullo stesso SHA. Ora soltanto [modello HTTP, test e ricevute](INCARICO_CORRENTE.md#cornice-b35-modello-incarico-2026-11-10), da sottoporre a Claude sulla #278 prima dell'attivazione; nessun nuovo rilascio necessario per questi soli file. Dopo GO e ordine personale: istruzioni per singleton creato **spento** da Diego, script claim una tantum separato da far rivedere prima dell'esecuzione, verifica e attivazione autorizzata con durata sette giorni. Nessuno di questi passi è implicito nella consegna corrente. Seguono C1 19 × quattro ambienti tutto NE, rapporto DIAG per ogni FAIL, infine C2. UI nuova separata; checkpoint seguenti storici.

## Cornice: prossimo passo riservato al caricamento del workflow

[DIAG approvata da Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6758777089). Diego riceve il workflow completo, lo carica sul ramo della PR #278 e conferma; Codex si ferma alla consegna. Seguiranno verifica dell'hash/check/revisione finale e approvazioni separate, non un'esecuzione automatica dell'intera B3. Canary scelto per 7 giorni; singleton di Diego in console, futuro script claim una tantum da far rivedere prima di eseguirlo. [Ordine corrente](INCARICO_CORRENTE.md#cornice-b3-consegna-workflow-2026-11-10). C1 resta 19 casi/quattro ambienti tutto NE; nuova grafica separata. I checkpoint seguenti sono storici.

<a id="cornice-diag-roadmap-2026-11-10"></a>

## Cornice: consegna DIAG prima di B3

Nuovo ordine di Diego: implementare DIAG, verificare dati/lifecycle/UI e consegnare sulla #278 con avviso e GO di Claude. Piano B3 già approvato come piano su c79770f6, ma la sua esecuzione resta sospesa. [Mandato](INCARICO_CORRENTE.md#cornice-diag-incarico-2026-11-10), [contratto](../regole/SICUREZZA.md#cornice-diag-sicurezza-2026-11-10), [prove](../evidenze/COLLAUDI.md#cornice-diag-verifiche-2026-11-10).

Dopo GO DIAG: riprendere i gate del piano B3, decisioni personali su applicazione workflow/canale amministrativo/durata e revisione dello SHA finale; nessun cloud o deploy implicito. Quindi C1: 19 casi/quattro ambienti, tutti NE; PWA iPhone e desktop prima. Per ogni FAIL allegare rapporto locale copiato, indicando quando il registro era spento o il dato non osservato. Infine C2; nuova grafica separata.

<a id="cornice-b3-roadmap-2026-11-10"></a>

## Cornice: GO D11, revisione del pacchetto B3

[GO D11 di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6757406980), CI #1049 verde, sblocca soltanto la preparazione richiesta da Diego. Pacchetto corrente: pianificatore locale non eseguibile, proposta CI sole Firestore Rules distinta dal recovery ampio e [sequenza/rollback](../regole/RILASCIO.md#cornice-b3-piano-2026-11-10). Il workflow attivo resta invariato; non si è eseguita alcuna operazione Firebase. Nuovo commit/check e revisione Claude B3 prima di chiedere a Diego approvazione sul pacchetto concreto.

Dopo il GO e gli ordini necessari: applicazione della sola proposta workflow mediante canale autorizzato, hash/check/revisione finale, merge personale, Rules CI poi Hosting sullo stesso SHA con approvazioni separate. Solo dopo verifiche effettive: provisioning privato, claim del pilota senza sovrascrivere gli altri, singleton attivato per ultimo con scadenza UTC approvata. Poi C1 (18 × 4 NE, PWA iPhone e desktop prima), infine C2. Nessuna chiusura dedotta dai test automatici. Nota D11 sugli ID malformati e nuova grafica separate.

<a id="cornice-d11-roadmap-2026-11-10"></a>

## Cornice: correzione D11 dopo GO B2

[GO B2 di Claude](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278#issuecomment-6753602102) su `70180aaffba629d112d235d93dddd0344f7f2c75`, CI #1048 verde. Passo corrente: consegnare sulla #278 l'intento notifiche alla cornice e le aggiunte C1 richieste (safe area e version skew, 18 casi tutti NE). Poi check e GO D11 prima di proporre B3. Nessun merge, provisioning individuale o deploy anticipato; produzione 1.2.267, candidata 1.2.268. [Mandato D11](INCARICO_CORRENTE.md#cornice-d11-2026-11-10), [prove e limiti](../evidenze/COLLAUDI.md#cornice-d11-verifiche-2026-11-10).

Dopo GO D11: preparazione B3 con approvazione personale di Diego; quindi C1, prima PWA iPhone e Chrome desktop, poi Safari iPhone e Chrome Android. Version skew resta NE fino al rilascio successivo; fallback PWA nativo e worker FCM effettivamente aggiornato sono limiti da verificare. C2 resta subordinata alle ricevute fisiche e non è autorizzata una chiusura dedotta dai test automatici. Nuova grafica separata.

<a id="cornice-b2-roadmap-2026-11-09"></a>

## Cornice: GO B1, lista B2 e gap prima di B3

GO B1 di Claude su `0d861eb0`, CI #1047 verde (3438 PASS/0 FAIL/10 skip). B2 prepara soltanto [lista fisica e matrice C1](../evidenze/COLLAUDI.md#cornice-b2-lista-2026-11-09); sedici casi/quattro ambienti tutti NE, con provisioning e refresh del pilota rinviati a B3 approvato. Gap statico noto nella notifica verso cornice pronta: il worker usa ancora navigate. Va corretto e rivisto prima della proposta di pubblicazione B3, senza confondere la lista con implementazione o prova fisica. Attendiamo GO B2 e prescrizioni del revisore sul gap; nessun avanzamento implicito o nuova grafica.

<a id="cornice-b1-roadmap-2026-11-09"></a>

## Cornice: dopo il GO A2, candidata B1

A2 approvata da Claude su `455b41fc`, CI #1044 riuscita. B1 implementa il permesso individuale server, le Rules e i profili HTTP; nessun provisioning o deploy reale. Il passo corrente è consegnare B1 sulla PR #278 e ottenere il GO sul nuovo commit. Solo dopo: B2 lista fisica; B3 proposta del provisioning privato, CI limitata alle sole Rules necessarie e Hosting con approvazione personale; C1 prove di Diego; C2 ricevuta finale. Nessun workflow modificato in B1 e nessuna Function richiesta. Candidata 1.2.268, produzione 1.2.267. [Stato corrente](STATO.md#cornice-b1-stato-2026-11-09).

I riepiloghi A1/A2 sottostanti conservano le fasi precedenti, non indicano un GO ancora mancante per A2. Gli incarichi di sicurezza e grafica restano distinti.

NO-GO B1 da chiudere: eliminare l'attesa aggiuntiva ai non partecipanti (token già acquisito come filtro esclusivamente negativo e uscita immediata offline), nuova CI e nuovo GO sullo SHA corretto. B3 dovrà proporre anche il solo claim Auth del pilota oltre al singleton, preservando gli altri claim; nessuna operazione Auth anticipata. La CI verde #1046 da sola non ha sbloccato B2.

<a id="cornice-a2-roadmap-2026-11-09"></a>

## Cornice: avanzamento dopo GO A1

A1 approvata da Claude sul commit `4f2bc0f812fa2f72c63a409d1aa5d3a120bcd136`. A2 implementata e verificata localmente per gruppi: candidata 1.2.268, bridge e broker produttivi spenti, conferme sensibili censite e prove negative; restano CI sul nuovo SHA e GO A2 di Claude. Soltanto dopo tale GO può iniziare B1 (ammissione server solo Diego, Rules/emulatori e header); seguono B2, B3 con approvazione personale e C1/C2. Nessun avanzamento implicito per un test verde e nessuna nuova grafica. [Mandato](INCARICO_CORRENTE.md#cornice-a2-preparazione-2026-11-09).

<a id="cornice-roadmap-2026-11-09"></a>

## Cornice — sequenza corrente con GO sulla PR #278, 09/11/2026

| Passo | Consegna | Gate prima di avanzare |
|---|---|---|
| A1 approvato | Contratto nei documenti Vault/UI/Decisioni e ricevuta sulla PR | GO Claude sulla PR per il commit del passo |
| A2 approvato | app.html e bridge reali ma spenti; test negativi | GO Claude su 455b41fc registrato |
| B1 approvato | Flag server solo Diego, Rules/emulatori e header effettivi selettivi | GO Claude su 0d861eb0 registrato |
| B2, corrente | Lista di prove fisiche desktop/Android/Safari/PWA, gap push dichiarato | GO Claude su B2 e correzione del gap prima di B3 |
| B3 | Preparazione merge e CI, eventuale backend necessario poi Hosting | GO, approvazione personale Diego, verifica commit/manifest/hash |
| C1 | Prove personali di Diego e sole correzioni emerse | Avviso → revisione → approvazione per ogni seguito |
| C2 | Ricevute finali e avviso «CORNICE CHIUSA» | Tutti i criteri del mandato verificati, nessun PASS per prove mancanti |

[Ordine e vincoli correnti](INCARICO_CORRENTE.md#cornice-a1-incarico-2026-11-09). Rimangono distinti il laboratorio disabilitato già presente, la produzione 1.2.267 e la futura attivazione server per il solo UID designato. Nuova grafica e altri rilievi di sicurezza non sono parte di questo ordine; non vengono dichiarati chiusi dalla cornice.


## Rifinitura visiva 1.2.267 pubblicata, seguito cornice — 09/11/2026

Follow-up delle schermate di Diego pubblicato e verificato con Hosting #1041, sorgente `1bcbef73`: copertura header nei due profili e metadati degli allegati separati dal cestino. PR #280 e stabilizzazione test #281 integrate dopo check e revisione statica di Claude, 341 hash verificati; il FAIL intermedio resta nelle evidenze. Il controllo fisico iPhone/Safari/PWA è ancora da eseguire. La cornice #278 resta il prossimo lavoro funzionale distinto, laboratorio non attivato; la nuova grafica è rinviata. [Mandato](INCARICO_CORRENTE.md#ui-overlap-followup-2026-11-09), [ricevuta e limiti](../evidenze/COLLAUDI.md#ui-overlap-followup-2026-11-09). Le voci seguenti conservano le fasi precedenti.

## Rilascio UI concluso, priorità alla cornice — 09/11/2026

La **1.2.266** è pubblicata con Hosting #1030, sorgente `193f4768`, dopo il clic di Codex delegato direttamente da Diego per questa sola run. Manifest e 341 file sono verificati; anteprime ancora online, escluse dalla precache. La prova fisica iPhone resta non eseguita e il riscontro produttivo di Claude non viene dedotto dal suo precedente parere statico. [Esiti](../evidenze/COLLAUDI.md#css-profilo-pubblicazione-1-2-266).

Priorità funzionale: raccordo reale della cornice Vault, partendo dalla [PR #278 in bozza](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278), laboratorio sintetico disabilitato. I suoi test non attivano la cornice né dimostrano parità su pagine reali/Firebase/dispositivi. La nuova grafica resta rinviata. I follow-up 2FA, cloud/Workload Identity, Dependabot, recovery, lingue e offline conservano perimetri e gate distinti; non sono riaperti o distribuiti dalla sola ricevuta UI.

<a id="cornice-avvio-2026-11-09"></a>

## Ordine operativo dopo la richiesta di Diego — 09/11/2026

Priorità funzionale alla cornice persistente: laboratorio iframe sintetico e negato per default, poi raccordo reale disabilitato, revisione della PR, prove sul canary autorizzato e dispositivi, soltanto infine attivazione limitata a Diego. Nessuna richiesta Master Password dell'app online è dichiarata risolta dal laboratorio. [Mandato](INCARICO_CORRENTE.md#cornice-laboratorio-2026-11-09), [contratto e passaggi mancanti](../regole/VAULT.md#cornice-lab-2026-11-09).

Nella fase precedente alla pubblicazione attestata sopra, la distinta 1.2.266 è unita con ordine di pubblicazione: Hosting #1030 sul sorgente `193f4768`, validazione riuscita e approvazione personale ancora attesa; controllo fisico iPhone rinviato e non eseguito. La precedente sequenza che lo richiedeva prima del merge descrive il mandato antecedente a questo ordine. Master resta fermo fino alla verifica di Hosting; laboratorio e ricevute successive non cambiano lo SHA in distribuzione.

Seguono la piccola pulizia 2FA/guida/export inutilizzato e del contratto CI intermedio, senza riaprire la PR #271 già distribuita né cambiare workflow implicitamente. I 3.231 casi della CI corrente hanno zero falliti: la vecchia segnalazione sul dialogo MFA non è un fallimento attuale dimostrato e va ricontrollata insieme all'inclusione del test nella suite. Poi inventario degli utilizzatori delle credenziali cloud prima di disattivare chiavi e percorso Workload Identity separato; Dependabot da rivalutare sugli avvisi effettivamente aperti, non sul vecchio numero cinque (#268 già integrata). Recupero 2FA effettivo, recovery completo mantenuto inerte, collaudi lingue/offline/dispositivi restano nei propri lotti. Nuova grafica rinviata; dubbi minori di sicurezza ancora da validare separatamente.

## Chiusura delle riserve UI prima della cornice — 09/11/2026

Prima della cornice, candidata separata 1.2.266 per trasparenze, header/linguette condivisi e anteprime escluse dalla precache ma ancora online. Dopo i controlli locali seguono PR, check CI, revisione di Claude sul diff e controllo fisico di Diego su iPhone, chiaro/scuro e almeno due palette, quindi merge e solo Hosting CI con approvazione personale. Non anticipare nuova grafica o attivazione della cornice. Il parere iniziale GO con riserve non sostituisce la revisione finale del candidato aggiornato. [Mandato](INCARICO_CORRENTE.md), [evidenze](../evidenze/COLLAUDI.md#css-profilo-candidata-1-2-266).

<a id="priorita-cornice-e-correzioni-ui-2026-11-09"></a>

## Priorità della cornice e correzioni UI — 09/11/2026

L'obiettivo funzionale principale resta la cornice persistente: evitare uno sblocco Vault a ogni pagina, conservando chiavi soltanto in RAM, isolamento, revoca, navigazione e conferma delle azioni sensibili. Non è ancora implementata. Le correzioni CSS/scroll sono una candidata separata dell'interfaccia attuale; l'adozione del nuovo disegno del Profilo è rinviata e i due commit originali Claude sono conservati.

Ordine da seguire: contraddittorio aggiornato e distinzione dei criteri ancora non provati; piccola pulizia già individuata dopo la 1.2.265; prototipo della cornice disabilitato e successivi collaudi/attivazione limitata a Diego soltanto secondo il mandato e i suoi gate. Il test reale fra due partecipanti con Auth/App Check non è attestato come riuscito e le prove fisiche restano aperte: nessuna dichiarazione di sblocco ne deriva automaticamente. La PR #271 e i due deploy 1.2.265 sono già conclusi e non vanno ripetuti. La pulizia non autorizza modifiche ai workflow: qualsiasi intervento su quel perimetro conserva l'ordine separato richiesto.

Seguono nei rispettivi incarichi credenziali cloud/Workload Identity, avvisi Dependabot, recupero 2FA effettivo, recovery completo/migrazione e chiusura dei collaudi di prodotto, lingue/offline e dispositivi. I nuovi dubbi di sicurezza riportati dal revisore vanno validati separatamente prima di considerarli difetti confermati. Le ricevute e i gate esistenti restano l'autorità; questo riordino non avvia operazioni cloud o la nuova grafica.

## Prove grafiche pubblicate e limiti residui — 09/11/2026

Le quattro prove separate sono distribuite con Hosting #1024, sorgente `87909638`, mantenendo l'app 1.2.265 e le 30 pagine reali invariate. Check completi, parere statico finale di Claude e verifica pubblica sono registrati nei [COLLAUDI](../evidenze/COLLAUDI.md#prove-grafiche-hosting-2026-11-09); il solo clic di questa run è eseguito su delega esplicita di Diego, senza modificare le protezioni dei prossimi rilasci. L'adozione di uno stile o della proposta Profilo richiede una successiva decisione e un incarico distinto. Le ricevute documentali non richiedono un altro Hosting.

La distinta assistenza 2FA è pubblicata e documentata nella [ricevuta 1.2.265](../evidenze/COLLAUDI.md#assistenza-2fa-rilascio-1-2-265); restano il controllo produttivo con attestazione genuina e il riscontro finale di Claude, senza dichiararli superati. Restano separati i piccoli follow-up già individuati (fixture del dialogo MFA, riferimento della guida al comando sospeso, export client non usato e successiva semplificazione del contratto CI). Nessuna attività aggiuntiva su workflow, backend o recupero deriva dalle prove grafiche. La cornice Vault conserva i propri prerequisiti e le prove fisiche ancora aperti.

## Avanzamento del passaggio workflow — 09/11/2026

Diego delega esplicitamente il solo commit del workflow approvato: completato sul branch della PR #271 con verifica dell'impronta, senza altra modifica al file. Questa delega aggiorna la precedente modalità manuale; le approvazioni production restano personali. Prossimo gate: check verdi sull'head completo di codice e ricevute, uscita da bozza e revisione finale valida di Claude. Nessun merge o pubblicazione è dedotto dai test. Seguono soltanto i rilasci CI autorizzati e le verifiche previste; candidata 1.2.265 e produzione 1.2.264 restano distinte.


## Passaggio di chiusura della PR #271 — 08/11/2026

La revisione fornita da Diego su `3ff7d29f` richiede due integrazioni prima del merge; i pareri locali precedenti restano consultivi. Priorità corrente: candidata 1.2.265 con assistenza coerente e generazione client sospesa, guida/test aggiornati e supporti CI intermedi verificabili. Diego carica personalmente sul branch il workflow completo consegnato con impronta; Codex ne verifica corrispondenza e check. Seguono uscita da bozza, revisione finale di Claude e soltanto allora merge/rilasci approvati, funzione dedicata prima di Hosting. La produzione resta alla 1.2.264. Questa voce aggiorna le fasi preparatorie precedenti; non avvia la cornice o altri lotti.


## Ordine aggiornato dalla revisione — 08/11/2026

La nota autorizzata di Diego/Claude accetta S1 chiuso con la 1.2.264 verificata in produzione. La mancata attestazione del secondo partecipante resta una limitazione delle prove, non un collaudo riuscito. Il lavoro corrente è l'aggiornamento separato della PR #271: assistenza 2FA, limiti e risposte uniformi, usabilità dei download e proposta privata di pubblicazione futura. La PR non si unisce né si pubblica con questo incarico; nessun workflow viene cambiato. La cornice non viene avviata automaticamente. Prima di qualunque futuro merge: check verdi sullo stesso head e revisione di Claude; pubblicazione soltanto dalla CI e con approvazione personale. Questa voce aggiorna la priorità delle note storiche seguenti senza riscriverne gli esiti.


## Prerequisito della continuità Vault — 08/11/2026

Aggiornamento finale del lotto: **1.2.264 pubblicata e verificata**, correzione del download grande provata sui moduli realmente online, parere conclusivo di Claude registrato nei [COLLAUDI](../evidenze/COLLAUDI.md#attachment-download-followup-1-2-264). Il criterio di condivisione completo resta aperto perché il browser del secondo partecipante non fornisce l'attestazione richiesta. Prima di riprendere la cornice servono una prova a due identità con Auth/App Check reali e la ricevuta del suo esito, senza indebolire i controlli. La preparazione 2FA #271 resta separata, da non unire o pubblicare; un suo futuro rilascio richiede un incarico CI specifico. Le due fixture di questo tentativo sono eliminate.

Il nuovo prototipo di cornice per Diego segue un distinto rilascio preparatorio di sicurezza: prima pubblicazione tramite CI, verifica indipendente e ricevuta dedicata nei COLLAUDI, poi ripresa del prototipo. La correzione upload della 1.2.262 non chiude quel prerequisito. Questa precisazione aggiorna l'ordine dei prossimi lotti rispetto all'elenco del 07/11, senza riaprire i rilasci già verificati. Il mandato e i limiti correnti sono mantenuti soltanto in [INCARICO_CORRENTE](INCARICO_CORRENTE.md#vault-frame-prerequisites-2026-11-08).

<a id="chiusura-e-priorita-2026-11-07"></a>

## Chiusura locale e ordine residuo — 07/11/2026

1. **Sicurezza corrente — rilascio concluso 08/11/2026:** le cinque correzioni di [AUDIT](../evidenze/AUDIT.md#sicurezza-candidata-2026-11-07) sono distribuite nella **1.2.261**, con suite completa/CI e ricevute di [COLLAUDI](../evidenze/COLLAUDI.md#pubblicazione-sicurezza-1-2-261). Le nuove Rules richiedono il client aggiornato per creare inviti; gli inviti legacy già esistenti restano leggibili/rispondibili. Il prossimo lotto funzionale è la shell RAM del punto seguente.
2. **Continuità della Vault:** integrare la shell persistente già approvata per navigare senza ripetere la Master Password; chiavi solo RAM, revoca su blocco/logout/cambio UID e rifiuto di risultati asincroni tardivi. Il contenimento multipagina rimane temporaneo.
3. **Recovery FULL e migrazione:** inventario revisioni/alias, drain, nuovo UID sintetico dedicato (QA2 esclusa), Auth/App Check reale, canary interruzione/ripresa/rollback; poi cache applicativa cifrata e conversione legacy riprendibile con CAS, parità offline, backup recuperabile e gestione dei vecchi writer.
4. **Prodotto:** matrice funzionale italiana e condivisioni da entrambi i lati, tour Graphify, secondo programma ODS, lucchetti, revisione editoriale delle otto lingue e guide. I 185 fallback delle guide e i sink JavaScript candidati non equivalgono a una traduzione definitiva né a un uguale numero di bug.
5. **Chiusura produttiva:** dispositivi reali Safari/iPhone/PWA, Push anche dopo logout/cambio account, Web Locks/fallback, memoria e backup interrotto; verifica delle configurazioni cloud effettive, audit indipendente crittografico, privacy/legale e incidente storico. Restano da approfondire il contratto AAD dei campi generici e il retry concorrente della purge sullo stesso proprietario; non sono stati dimostrati come nuovi accessi fra utenti in questa revisione.

Questo ordine sostituisce le priorità dei checkpoint storici sottostanti, senza cancellarne gli esiti o autorizzare operazioni cloud. AI.2 resta chiusa e non rientra nel prodotto. La retention Archivio già decisa non viene riaperta: due anni dall'ultima archiviazione e avviso dieci giorni prima; D8 legale e le altre famiglie mantengono i loro gate.

## Attività residue dopo il rilascio — revisione 07/11/2026

Per versione, sorgente distribuito, ricevute e limiti del rilascio consultare [STATO](STATO.md#stato-corrente) e [COLLAUDI](../evidenze/COLLAUDI.md), senza mantenere qui un secondo rapporto di pubblicazione. I prerequisiti del recovery completo sono già distribuiti ma inerti; restano drain, gate di attivazione e canary Auth/App Check su un nuovo banco dedicato. Seguono cache applicativa cifrata e conversione legacy, mentre la shell persistente resta un lotto separato. Restano pianificate le verifiche fisiche, l'analisi degli avvisi del banco e la chiusura editoriale delle guide multilingue e dei testi dinamici. Questi obiettivi non autorizzano l'esecuzione: il perimetro corrente è soltanto quello assegnato in [INCARICO_CORRENTE](INCARICO_CORRENTE.md).

## Prossimo lotto dopo il contenimento locale — 06/11/2026

Il primo lotto locale della candidata 1.2.259 è rendicontato in [STATO](STATO.md) e [COLLAUDI](../evidenze/COLLAUDI.md). La priorità successiva è completare e provare il recupero coerente di Vault, identità di condivisione e allegati profilo, mantenendo il divieto di restore generico di `settings/security`. Seguono cache applicativa cifrata con parità offline e conversione legacy riprendibile/CAS, prima del ritiro del fallback; la shell RAM completa recupererà la continuità di navigazione. Nessuna migrazione reale parte automaticamente e nessun blocco di pubblicazione viene chiuso dalla sola riuscita del lotto precedente.

## SEC-MON-01 — mappa d'attacco e sorveglianza permanente — 03/11/2026

1. mantenere l'inventario versionato di applicazione, runtime, dipendenze, browser e toolchain del PC;
2. completare threat model e scan di sicurezza repository-wide, distinguendo controllo presente, finding validato e rischio residuo;
3. verificare configurazione reale di Hosting, Auth, App Check, Rules, Functions, Storage, Push e workflow di rilascio;
4. eseguire ogni giorno alle 07:30 il confronto con advisory ufficiali, CISA KEV, NVD e GitHub Security Advisories;
5. restare silenziosi senza novità applicabili; inviare allarme solo con versione, impatto, prova, mitigazione e fonte;
6. sottoporre ogni correzione a ramo, revisione, test, autorizzazione e rilascio tracciato;
7. aggiungere WhatsApp soltanto dopo disponibilità di un'integrazione Business ufficiale.

Questo blocco accompagna la bonifica pre-finale e prosegue dopo il rilascio: non sostituisce aggiornamenti automatici del sistema operativo o dei browser, audit indipendente, test fisici e gestione incidenti.

<a id="scadenza-elimina-decisione-2026-11-11"></a>

**Decisione di Diego, 11/11/2026 — «Elimina» nel dettaglio Scadenza.** Per la revisione UI resta nel piè di pagina del dettaglio, con la conferma esistente (scelta C): eccezione dichiarata al contratto a tre livelli. Nella **fase sicurezza** si passa alla scelta A: «Elimina» spostato nel modulo di modifica della scadenza, insieme alla revisione dei percorsi di cancellazione (documento del Profilo collegato, allegati, purge), con test e revisione incrociata. L'elenco Scadenze conserva l'eliminazione con scorrimento e conferma.

<a id="pentagi-nota-2026-11-10"></a>

**Nota di Diego, 10/11/2026 — prova PentAGI a fine lavori.** Dopo la chiusura della cornice e della fase sicurezza successiva (notifiche dopo il logout, MIME, AAD, purge, COOP, vulnerabilità npm, token e Node), provare lo strumento open source di penetration testing con agenti AI PentAGI come controllo finale. Vincoli già concordati:
- mai contro la produzione o account con dati reali, ma solo contro gli emulatori locali o un progetto Firebase di prova con account inventati;
- esecuzione soltanto sul PC di Diego, in Docker, dopo la lettura del codice da parte di Claude;
- ogni segnalazione è un'ipotesi da validare da Claude e Codex prima di qualsiasi correzione, che segue il normale ciclo di ramo, revisione e rilascio.

Non è un incarico attivo e non autorizza installazioni.

## COLLAUDO-QA-FINALE-01 — matrice funzionale e linguistica — 03/11/2026

**Obiettivo:** dimostrare con l'utente tecnico sintetico che ogni percorso dell'app è comprensibile e funzionante dall'interfaccia reale, non soltanto coperto dal codice o da test isolati.

### Fase A — inventario Graphify e fixture

1. censire pagine, modali, menu, pulsanti, rotte e collegamenti con Graphify e sorgente canonica;
2. associare a ogni area i record necessari e tutti i campi realmente popolabili;
3. preparare dati fittizi riconoscibili, ripetibili e cancellabili, inclusi piccoli allegati sintetici nei formati supportati;
4. escludere dati personali reali, recapiti raggiungibili, identificativi formalmente validi, credenziali, token Push, MFA e segreti operativi.

### Fase B — collaudo funzionale italiano

Percorrere visualmente prima configurazione, Home, Profilo, contatti, indirizzi e utenze, Documenti e Tessera digitale, Aziende e sedi, Account privati e aziendali, vista bancaria, Memorandum e Memorandum condivisi, Widget, Scadenze, destinatari, allegati, archivi, Impostazioni e Ricerca. Per ogni record provare quando disponibile: creazione, lettura, modifica, ricerca, collegamento, condivisione, revoca, archiviazione, ripristino ed eliminazione. Verificare inoltre pagina chiamante/ritorno, stati vuoti, messaggi, conferme, contrasto, overflow, focus, tastiera, Console e rete.

I casi obbligatori distinguono Widget bancari collegati a un conto e Widget generici riutilizzabili; comprendono istanza, modello, cifratura, mostra/nascondi, modifica, riuso ed eliminazione. Le Credenziali comuni vengono provate con più Account per propagazione, scollegamento selettivo, autorizzazioni, archiviazione ed eliminazione. I contenuti creati dall'utente non cambiano al cambio lingua.

### Fase C — condivisioni a due utenti

Creare richieste esclusivamente sintetiche e registrare separatamente l'esito del mittente e quello del destinatario. Quando il secondo lato richiede l'intervento di Diego, il banco conserva l'identificativo sintetico e attende la sua evidenza senza dichiarare riuscita la condivisione. Account condivisi, Memorandum condivisi, revoca e visibilità successiva devono essere casi distinti.

### Fase D — matrice multilingua

Solo dopo la chiusura funzionale italiana, ripetere per ogni lingua supportata la navigazione completa e il controllo di testi statici e dinamici: titoli, campi, placeholder, pulsanti, menu, popup, conferme, errori, guida/Ricerca, ARIA, formati data e adattamento mobile. Il cambio lingua deve propagarsi a tutte le pagine senza tradurre o alterare i contenuti creati dall'utente.

La matrice comprende inoltre Archivio portabile, `LEGGIMI`, anteprime e messaggi degli allegati, intestazioni e fogli CSV/ODS/XLSX, avvisi di sicurezza e schermate di Backup/Ripristino. L'Archivio portabile parte dalla lingua scelta e permette di selezionare una lingua supportata anche offline; il JSON conserva chiavi tecniche canoniche. Il Backup cifrato non viene tradotto internamente.

### Evidenza e criteri di uscita

- una riga di matrice per pagina, lingua, viewport, percorso e risultato;
- screenshot privi di segreti per i difetti visivi e indicazione di Console/rete per gli errori tecnici;
- distinzione esplicita fra automatico, browser reale Windows, prova dell'altro utente e dispositivo fisico;
- nessun caso non eseguito marcato come superato;
- cleanup verificato delle fixture oppure inventario delle fixture conservate per regressione;
- correzioni rieseguite sullo stesso percorso prima di considerare chiuso il difetto.

**Ordine nella roadmap:** questo ciclo precede la guida visuale Graphify e la revisione finale delle lingue; dopo la stabilizzazione delle guide si esegue l'ultima passata multilingua, quindi bonifica conclusiva, audit fisici/privacy/legale e chiusura degli MD.

## RICERCA-GRAPHIFY-01 — consolidamento e futura guida interattiva — 03/11/2026

**Stato:** AI.2 chiusa e non operativa. La cronologia tecnica resta documentata, ma LLM, WebLLM, Qwen e Motore locale non fanno più parte del prodotto.

**Incremento corrente completato localmente:** mantenere una sola funzione denominata **Ricerca**, sempre disponibile nelle pagine private, basata sul motore deterministico, sulla guida D0 e sulla mappa Graphify. Il grafo runtime comprende pagine, controlli e collegamenti; la ricerca usa sinonimi, tolleranza ai piccoli errori e percorsi fra pagine per restituire la sezione o il pulsante più pertinente. Il vecchio video e ogni componente operativo AI.2 vengono rimossi.

**Incremento locale `1.2.257`:** la stessa mappa Graphify già collegata alla Ricerca alimenta ora il primo aiuto contestuale. **Mostra sulla pagina** offre testo del passo, contatore, Avanti, Indietro ed Esci; evidenzia il controllo soltanto quando è univoco, visibile, abilitato e collegato, senza premerlo o leggerne i valori. In caso contrario conserva l'istruzione testuale. I video restano opzionali e separati.

**Incremento `1.2.253`:** i comandi rapidi della Home portano direttamente al nuovo Account privato o, dopo la scelta esplicita dell'Azienda, al nuovo Account aziendale. Il catalogo D0 e il grafo Graphify sono stati rigenerati e verificati insieme alla suite completa.

### Backlog effettivo dopo `1.2.253`

Le attività ancora aperte si dividono in prodotto e certificazione; AI.2 è storico chiuso e non è un punto residuo:

1. completare la revisione editoriale e funzionale delle otto lingue, inclusi Ricerca, dettatura, messaggi, ARIA e adattamento mobile;
2. completare il collaudo pagina per pagina della guida visuale Graphify ora disponibile; eventuali video restano opzionali e separati;
3. chiudere l'interoperabilità dell'Archivio portabile su un secondo programma ODS e la matrice dei browser/dispositivi destinatari;
4. completare i gate fisici/offline residui: consultazione bancaria su iPhone, fallback senza Web Locks, backup interrotto/ripresa, memoria e dispositivi supportati;
5. approvare la politica di retention per archivio, allegati e backup e completare il collaudo Windows della Salute credenziali;
6. eseguire il ciclo finale di maturità: end-to-end sui browser supportati, verifica di produzione, audit indipendente di sicurezza/crittografia, revisione privacy/legale e procedura incidenti;
7. concludere il censimento manuale di tutti i lucchetti/campi protetti. Il riordino delle Impostazioni è chiuso nella release 1.2.256: **Prima configurazione** è espandibile, aperta solo se il requisito obbligatorio è incompleto, mentre **Tema App** è espandibile e normalmente chiusa.

**Candidata `1.2.257`:** le anteprime **Scadenze** e **Urgenze** della Home espongono anche modello/targa quando il record contiene `veicolo_modello`, evitando card omonime non distinguibili. Dopo il test mirato l'ordine di chiusura resta: precollaudo delle correzioni, completamento della matrice italiana, bonifica tecnica, riallineamento Graphify, guida contestuale, completamento dei collegamenti e controlli finali; la matrice multilingua segue soltanto una base funzionale stabile.

## AUDIT-SKILL-01 — sicurezza, qualità visiva e prestazioni — pianificazione 11/10/2026

**Obiettivo:** introdurre un ciclo di verifica indipendente e ripetibile dell'app, senza attribuire alle skill autorità di rilascio e senza eseguire test distruttivi sulla produzione.

### Ordine di esecuzione

1. **Baseline:** attendere la chiusura di ogni lavoro concorrente, identificare commit/branch da esaminare, conservare le modifiche locali e predisporre emulatori o staging con dati e utenti sintetici.
2. **Skill ufficiali iniziali:** verificare provenienza e permessi, quindi installare globalmente `security-best-practices`, `security-threat-model`, `playwright` e `screenshot`; nessuna skill viene incorporata nel repository.
3. **Audit statico read-only:** controllare autenticazione, autorizzazioni, Rules, Functions, Vault, crittografia, MFA, backup/ripristino, Storage, offline, Service Worker, input, dipendenze e configurazioni esposte.
4. **Threat model:** censire asset, ruoli, confini di fiducia, superfici esposte, attori e percorsi d'abuso; tradurre soltanto i rischi dimostrabili in casi di prova.
5. **QA browser e visuale:** con `playwright` e `screenshot` provare registrazione, login, sessione, MFA, Account, condivisioni, backup, offline/online, aggiornamento PWA, responsive, tastiera, ARIA, overflow, errori JavaScript e rete.
6. **Prestazioni e accessibilità:** misurare Lighthouse/Core Web Vitals, caricamento, peso asset, cache, rete lenta e WCAG prima di valutare skill esterne.
7. **Seconda opinione:** valutare il plugin ufficiale Codex Security, iniziando con scansione in sola lettura e senza patch automatiche; confrontare i risultati ed eliminare falsi positivi.
8. **Estensioni opzionali:** prendere in considerazione `security-ownership-map`, `playwright-interactive`, `product-design/audit`, Performance Audit, Frontend Visual QA e Browser Use soltanto se resta un bisogno non coperto e dopo audit di codice, permessi e dipendenze.

### Regole non negoziabili

- Nessuna Master Password, recovery key, password, PIN, PUK, CVV, codice MFA, cookie o sessione reale nei test.
- Test dinamici esclusivamente su emulatori/staging, profilo browser isolato e fixture chiaramente sintetiche.
- Prima esecuzione di ogni strumento in sola lettura; correzioni, scritture, installazioni aggiuntive, commit, push, merge e deploy richiedono autorizzazione separata.
- Ogni rilievo deve riportare evidenza, gravità, affidabilità, percorso di riproduzione, impatto, correzione proposta e prova di chiusura; una segnalazione automatica non è un difetto confermato.
- Browser Use, se ammesso, resta privo di cloud, stealth, proxy e CAPTCHA, con whitelist stretta dei domini e nessun accesso alla produzione.

### Criteri di uscita

- inventario delle aree controllate e di quelle non verificabili;
- threat model collegato a prove riproducibili;
- matrice desktop/tablet/telefono e online/offline con screenshot ed errori associati;
- misure prestazionali e di accessibilità confrontabili con una baseline;
- rilievi deduplicati e classificati in `AUDIT.md`;
- evidenze e regressioni registrate in `COLLAUDI.md`;
- nessuna dichiarazione di sicurezza assoluta o idoneità produttiva dedotta dal solo numero di test verdi.

## Progetto Portabilità, Assistente e Lingue — pianificazione 11/10/2026

Il nuovo programma sostituisce le etichette generiche «Excel, AI e Lingue» con tre risultati di prodotto coordinati. Non modifica ancora il runtime, non autorizza download di modelli e non riapre i cicli M7–M10.

### P1 — Archivio portabile completo

**Obiettivo:** consegnare all'utente che lascia l'app una copia completa, autonoma e comprensibile dei propri dati e allegati, distinta dal backup ripristinabile.

Prima fase:

- definire manifest e schema versionati, identificativi stabili e relazioni fra utenti, aziende, Account, scadenze e allegati;
- produrre un pacchetto cifrato o una cartella protetta con dati, allegati originali, indice di integrità e istruzioni;
- offrire una UI locale HTML/CSS/JavaScript in sola lettura, con Home e maschere navigabili in stile Access;
- produrre ODS come foglio aperto principale e CSV come formato semplice; XLSX resta una compatibilità facoltativa, non il motore del progetto;
- consentire ricerca, filtri e apertura degli allegati senza macro e senza dipendere da Excel;
- progettare la separazione dati/interfaccia in modo che una futura seconda fase CRUD non richieda di rifare il formato.

**Uscita P1:** pacchetto completo verificato su almeno due programmi compatibili ODS e nei browser destinatari, inventario allegati riconciliato, nessun segreto in chiaro senza scelta e protezione esplicite, distinzione visibile da backup/ripristino.

**Incremento locale PORTABILITA-01 (14–15/10/2026, esteso 24/10/2026):** il percorso runtime nelle Impostazioni produce un pacchetto offline composto da visualizzatore e contenitore `.cpportable`. Il formato v2 cifra a chunk AES-GCM concatenati, scrive con backpressure tramite File System Access, autentica ordine, `entryCount`, manifest ed EOF e rifiuta output manomessi, riordinati, troncati, sovraccarichi o con dati dopo il terminatore prima di mostrare dati. Writer e lettori condividono limiti espliciti; la creazione applica una policy password robusta distinta dalla compatibilità di lettura. Annullamento ed errore rimuovono il file incompleto quando l'API lo consente; il fallback senza streaming conserva soltanto ciphertext ed è limitato a 12 MiB, senza promessa mobile. Le proiezioni includono JSON completo, ODS e CSV schema-evolutivi e protetti contro formula injection. Fixture, inventario multi-ambito, 10.000 record, browser desktop, test ostili, annullamento e capacità sono raccolti nel gate `test:portable-archive-prerelease`. L'estensione del 24/10 include i video cifrati a blocchi come singole voci, fino a 512 MiB per file e 1 GiB cumulativo, senza buffer monolitico; il probe da 485 MiB registra circa 292 MiB RSS e scritture massime da 1,33 MiB. Il secondo programma ODS resta gate per dichiarare conclusa l'interoperabilità P1; i dispositivi fisici restano gate per l'attivazione generale mobile, non per una eventuale anteprima desktop esplicitamente limitata.

### P2 — Assistente specifico dell'app

**Obiettivo:** trovare, spiegare e guidare; non offrire una chat generalista.

Ordine:

1. consolidare il motore base senza AI: intenti chiusi, ricerca fuzzy, date, domini, risultati in card e domande di chiarimento;
2. completare il manifest di conoscenza delle pagine per onboarding, Vault, funzioni e Impostazioni;
3. aggiungere «Prepara per l'uso offline», distinguendo shell, dati verificati e allegati opzionali;
4. introdurre nelle Impostazioni una verifica locale e consensuale della compatibilità AI;
5. soltanto dopo benchmark fisici, valutare un piccolo modello locale scaricabile e rimovibile, con fallback immediato al motore base.

Il modello può produrre esclusivamente intenti e parametri tipizzati; il codice dell'app interroga i repository e costruisce le card. Scritture e operazioni sensibili restano fuori dall'esecuzione automatica e richiedono validazione e conferma. Nessuna Master Password, password, PIN, PUK, CVV o chiave entra in prompt, embeddings, log o modello.

**Uscita P2:** tutte le funzioni essenziali operano senza AI e senza token; il livello locale opzionale dimostra compatibilità, annullamento, limiti di risorse, privacy e fallback su dispositivi reali prima di ogni attivazione generale.

### P3 — Multilingua finale

**Obiettivo:** rendere interfaccia e Assistente coerenti nelle lingue supportate dopo la stabilizzazione funzionale.

- mantenere da P1/P2 identificatori di azione indipendenti dalla lingua e ogni nuovo testo in chiavi i18n;
- definire per ciascuna lingua sinonimi, esempi, formati data, domande di chiarimento e terminologia di sicurezza;
- verificare che l'eventuale modello locale comprenda realmente ogni lingua dichiarata, senza dedurlo dalla sola scheda del modello;
- collaudare navigazione, guida, risultati, errori, ARIA e Impostazioni in ogni lingua supportata.

**Uscita P3:** nessuna stringa utente hard-coded nei nuovi moduli, parità funzionale verificata e revisione umana dei testi sensibili.

**Incremento corrente 14/10/2026:** infrastruttura e flusso sono in lavorazione isolata sulla base `1.2.186`: preferenza pre-identità, recupero per profilo, cambio in Impostazioni, prima configurazione e locale vocale dell'Assistente base. L'incremento non chiude P3 finché i dizionari delle lingue dichiarate non hanno copertura editoriale completa e non sono conclusi i collaudi fisici previsti.

### Confini del ciclo

- Per alcuni mesi resta in valutazione la PWA esistente: nessun wrapper App Store/Play Store o riprogettazione nativa.
- La preparazione offline non è un backup e deve rilevare cache vuota, incompleta o espulsa.
- Gli allegati offline sono opt-in, cifrati, misurati e rimovibili; non entrano nella precache obbligatoria.
- Il presente passo approva il piano documentale, non implementazione, modello, provider, deploy o trattamento di dati reali.

## Stato corrente dopo 1.2.154 — 10/10/2026

Il lavoro applicativo autorizzato su profili Widget e allegati cifrati dei documenti personali è integrato e pubblicato tramite PR #97 (`eb1380c0`). Hosting, Rules e callable pertinenti sono distribuiti e verificati. Non resta un incremento locale obbligatorio per questa pubblicazione.

Il percorso successivo è un ciclo di certificazione, non una prosecuzione automatica del programma concluso: canary sintetico distribuito M7/M8, dispositivi fisici, audit indipendente e revisione privacy/legale. M7 generale, M8 riprendibile, MFA automatico e nuove scritture CPFE2 restano disabilitati fino a evidenza e autorizzazione specifiche.

## Programma M7-M10 chiuso — 10/10/2026

Il programma tecnico corrente M7-M10 è concluso sulla versione pubblicata `1.2.150`, ramo `master`, commit `86b969cc`. Non esistono ulteriori incrementi locali obbligatori assegnati da questo programma. La chiusura adotta la configurazione sicura verificata: purge automatico M7, restore riprendibile M8, recupero MFA automatico e nuove scritture crittografiche CPFE2 restano disabilitati. Le verifiche GCS reali, la matrice su dispositivi/browser fisici, l'audit indipendente e la revisione privacy/legale non sono state eseguite e appartengono a un eventuale nuovo ciclo di certificazione, da autorizzare separatamente.

Tutto il testo seguente è conservato come programma ed evidenza storica. Espressioni quali «attiva», «prossimo gate», «aperta» o «da completare» nelle fonti migrate non costituiscono un incarico corrente e non prevalgono su questa chiusura, su [STATO](STATO.md) e su [INCARICO_CORRENTE](INCARICO_CORRENTE.md).

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
