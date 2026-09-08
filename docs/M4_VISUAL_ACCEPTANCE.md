# Collaudo visivo M4 — header, footer e overscroll

Questo gate completa M4 soltanto dopo una prova sulla versione pubblicata. I test automatici verificano struttura e regressioni CSS, ma non possono certificare la composizione grafica del browser fisico.

Il contratto delle due famiglie e del viewport è definito in `PAGE_SHELL_CONTRACT.md`; il relativo gate statico è `npm run test:page-shells`.

## iPhone

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

## Windows

Ripetere sulle stesse pagine con finestra massimizzata e ridotta a circa 390 px di larghezza:

- [ ] nessun flash durante scroll con mouse e touchpad;
- [ ] nessun salto di layout quando compare la barra di scorrimento;
- [ ] header e footer restano allineati al contenitore massimo;
- [ ] tema chiaro e scuro mantengono contrasto leggibile.

## Registrazione esito

Annotare dispositivo, versione del sistema operativo, browser/PWA, tema e pagina dell’eventuale difetto. Una sola voce negativa mantiene M4 aperta e richiede correzione prima di M5.

## Esito del primo collaudo iPhone

Il collaudo del 6 settembre 2026 non ha superato il gate. Le schermate fornite mostrano che, durante lo scroll/overscroll, il footer viene ricomposto nel mezzo del viewport e il contenuto continua a scorrere dietro di esso; compare inoltre una fascia terminale estranea al fondale. È stato anche chiarito che, nel tema chiaro, le fasce devono essere bianche e sfumate, non celesti o azzurre.

Correzione candidata applicata: su viewport mobile il documento esterno non scorre più e soltanto `.base-main` gestisce lo scorrimento verticale. Il collaudo comparativo del 6 settembre ha scelto la variante "nebbia V2": maschera progressiva sul contenuto, velo bianco tramite pseudo-elemento e blur da 12 px, senza bordi visibili. La tecnica deriva dai commit storici `ba7f85f` e `2c19860` e conserva intenzionalmente l'effetto delle card che sfumano sotto le fasce.

Fallback preservato fuori dal runtime: la variante storica del commit `ab532e2`, il confronto della nebbia e i relativi supporti sono conservati in `archive/home-experiments/`. La specifica descritta in questo documento resta la fonte ufficiale; l'archivio consente un confronto manuale senza pubblicare o memorizzare offline i laboratori. Il gate M4 resta aperto fino al nuovo collaudo su iPhone e Windows.

## Laboratorio radice del viewport

`prova.html` è stato pubblicato temporaneamente per riprodurre su iPhone la sola estensione del fondale con `100vh`/`100dvh` e `viewport-fit=cover`, senza cambiare nebbia, livelli, safe area o componenti dell'app. Serve a stabilire se la fascia inferiore nasce dalla superficie radice oppure dalla shell interna.

Il laboratorio mostra separatamente il perimetro di `100dvh`, quello di `100lvh`, le misure di `innerHeight`, `visualViewport`, schermo e documento, oltre a un marcatore fissato al bordo inferiore. Se il marcatore tocca il bordo fisico e il gradiente continua sotto di esso, la superficie radice copre correttamente il viewport e la fascia dell'app nasce dalla shell interna. Se sotto il marcatore compare ancora un'area estranea, il difetto appartiene invece al canvas o alla viewport esposta dal browser. Le misure sono soltanto diagnostiche: non pilotano il layout e non introducono un ridimensionamento JavaScript.

Il laboratorio non certifica da solo la correzione. Dopo la prova fisica, la candidata va applicata al CSS comune e ricollaudata almeno su Home, Registrazione e una pagina interna lunga; nebbia V2, ombre, pulsanti e ordine dei livelli devono restare invariati.

### Esito sonda iPhone — 8 settembre 2026

Prima prova eseguita nel browser incorporato della chat su iPhone, schermo dichiarato `393 × 852`. La sonda ha rilevato `innerHeight = 631 px`, `visualViewport = 631 px` e altezza documento `631 px`; il marcatore fissato in basso coincide con il limite del contenuto web. Il gradiente copre quindi tutta la viewport concessa alla pagina. La sottile separazione successiva al marcatore è esterna al documento e precede i controlli del browser incorporato.

Questa evidenza esclude, in quel contesto, un fondale HTML più corto della viewport. Non chiude il gate: occorre ripetere la prova in modalità PWA avviata dall'icona Home, dove non esiste la barra del browser e le safe area vengono calcolate diversamente.

Seconda prova eseguita dalla PWA installata: `innerHeight`, `visualViewport` e documento coincidono a `793 px`, mentre lo schermo misura `852 px`. Il marcatore raggiunge esattamente il limite dei 793 px e sotto compare una fascia alta 59 px del colore `--bg-primary`. La fascia è quindi il canvas esterno alla layout viewport che iOS colora con il fallback della radice; non deriva da contenuto insufficiente, safe-area interna, nebbia o altezza del footer.

Candidata isolata da verificare nel laboratorio: lasciare il gradiente sul `body` e assegnare a `html` il colore pieno con cui termina la nebbia al bordo fisico (bianco nel tema chiaro, colore scuro equivalente nel tema dark). La candidata non modifica dimensioni, scroll, maschere o stacking.

La controprova PWA ha confermato la diagnosi: mantenendo invariati i valori `793/793/793 px`, il canvas esterno è passato dal grigio al bianco. La candidata è stata quindi trasferita nel core tramite `--viewport-edge-color`, bianco in tema chiaro e `#0a0f1e` in tema scuro. Il test statico del contratto impedisce che la radice torni a usare `--bg-primary`. Il gate resta aperto fino al collaudo delle pagine applicative con la nebbia reale.

Il primo collaudo della Home `v1.2.60` ha eliminato il grigio ma ha mostrato una linea fra il bianco puro esterno e il terminale azzurrato della nebbia. Il campionamento della schermata ha rilevato lungo l'ultima riga interna valori compresi fra `rgb(237 246 253)` e `rgb(232 242 252)`, con valore centrale `rgb(235 244 253)`. La candidata chiara è quindi affinata a `#ebf4fd`, colore medio del bordo reale, senza intervenire sull'effetto o sulla sua geometria.

Il collaudo della Home `v1.2.61` conferma la continuità esatta del tema chiaro: sopra e sotto il confine il valore centrale è `rgb(235 244 253)`. Nel tema scuro resta invece una differenza misurabile fra il terminale interno `rgb(12 19 38)` e il canvas esterno `rgb(9 15 29)`. La candidata dark è pertanto affinata a `#0c1326`, mantenendo invariati nebbia e layout.
