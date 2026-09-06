# Collaudo visivo M4 — header, footer e overscroll

Questo gate completa M4 soltanto dopo una prova sulla versione pubblicata. I test automatici verificano struttura e regressioni CSS, ma non possono certificare la composizione grafica del browser fisico.

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

Correzione candidata applicata: su viewport mobile il documento esterno non scorre più. Il guscio dell'app occupa `100dvh`, header e footer sono elementi non scorrevoli del layout e soltanto `.base-main` gestisce lo scorrimento verticale. Il confronto visivo con una schermata storica ha ricondotto l'effetto corretto al commit `8d89881`: fondo vetro `var(--card-bg)`, blur da 12 px e maschera che resta piena fino al 40% per poi dissolversi verso il centro dello schermo. Il gate resta aperto fino al nuovo collaudo fisico.
