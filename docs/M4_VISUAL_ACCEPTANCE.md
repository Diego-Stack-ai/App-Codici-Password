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

Il laboratorio non certifica da solo la correzione. Dopo la prova fisica, la candidata va applicata al CSS comune e ricollaudata almeno su Home, Registrazione e una pagina interna lunga; nebbia V2, ombre, pulsanti e ordine dei livelli devono restare invariati.
