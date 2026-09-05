# Prova con fotografie reali — 5 settembre 2026

Le sei fotografie sono state analizzate senza copiarle nel repository. Questo rapporto
non conserva numeri completi, codici fiscali, email, telefono o altri dati personali.

## Campioni

1. Badge personale: nome, data di nascita, codice fiscale e codice a barre visibili.
2. Biglietto da visita: nome, ruolo, azienda, sito, indirizzo, dati fiscali, telefono ed email.
3. Tessera carburante, retro: azienda, indirizzo, telefono e sito; nessun codice personale.
4. Tessera carburante, fronte: marchio e numero identificativo visibili.
5. Carta di pagamento deteriorata, retro: circuito e assistenza visibili; numero carta assente.
6. Carta di pagamento deteriorata, fronte: circuito e intestatario parzialmente visibili;
   numero e validità non sono recuperabili con sufficiente affidabilità.

## Esito OCR grezzo

Il tentativo diretto sui JPEG originali (circa 2880 × 3840, card ruotate) ha richiesto
circa 15–20 secondi per immagine su PC e ha prodotto testo largamente inutilizzabile.
La rotazione automatica non è risultata affidabile. Questa modalità è respinta.

## Requisiti emersi

- correggere l'orientamento prima dell'OCR e permettere la rotazione manuale;
- ridurre localmente il lato maggiore a circa 1800 px;
- applicare contrasto/scala di grigi prima del riconoscimento;
- ritagliare la sola card ed eventualmente separare fronte e retro;
- usare parser diversi per badge, biglietto da visita, carburante e pagamento;
- assegnare una confidenza a ogni campo e lasciare vuoto ciò che non è leggibile;
- non interpretare banda magnetica, chip o loghi come numeri;
- non estrarre CVV e non ricostruire numero carta o scadenza cancellati;
- mostrare sempre un'anteprima modificabile prima di qualunque salvataggio.

## Decisione

Il riconoscimento può essere utile per badge, biglietti da visita e tessere carburante
ben fotografate. Sulle carte deteriorate deve limitarsi ai dati chiaramente leggibili.
Il laboratorio dispone ora di rotazione manuale, ritaglio tattile, ridimensionamento,
controllo qualità e soglia minima di affidabilità. Prima dell'integrazione occorre una
terza prova dal browser iPhone; l'OCR non è ancora pronto per la produzione.

## Primo collaudo iPhone

Il primo collaudo ha rilevato tre problemi: selezione iniziale non ridimensionabile,
selettore iOS orientato soltanto alla fotocamera e avvio OCR non riuscito. La seconda
Preview introduce quattro maniglie sugli angoli, separa “Scatta foto” da “Scegli dalla
libreria”, pubblica esplicitamente il worker OCR e mostra il dettaglio tecnico degli
errori nel solo laboratorio. La correzione non costituisce ancora accettazione del motore.
