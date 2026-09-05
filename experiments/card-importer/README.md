# Prototipo isolato — importatore leggero di card

Questo esperimento non viene caricato dall'app, non è incluso in `Frontend/public`,
non entra nella shell PWA e non tratta dati reali.

## Obiettivo

Separare il riconoscimento visivo dalla trasformazione del testo in campi:

1. acquisizione foto;
2. preprocessamento locale;
3. QR/barcode o OCR locale caricato su richiesta;
4. parser specifico;
5. anteprima modificabile;
6. conferma esplicita;
7. salvataggio attraverso i normali flussi cifrati dell'app.

## Decisioni iniziali

- `BarcodeDetector` può essere tentato come accelerazione nativa, ma non è un requisito perché Safari/iOS non lo rende affidabilmente disponibile.
- Un decoder multipiattaforma va importato dinamicamente soltanto nella schermata di scansione.
- Tesseract.js e i relativi modelli non devono entrare nel bundle iniziale o nella cache offline obbligatoria.
- Il CVV non viene estratto automaticamente.
- Un QR contenente un URL non viene mai aperto senza conferma.
- Ogni campo riconosciuto è soltanto una proposta modificabile.

## Misure preliminari (5 settembre 2026)

- `@zxing/browser` 0.2.1: circa 5,8 MB di contenuto npm non compresso.
- `tesseract.js` 7.0.0: circa 1,4 MB per il pacchetto principale, oltre a core WebAssembly e modelli linguistici.

Queste dimensioni escludono l'inclusione nel bootstrap ordinario. La fase successiva
deve produrre bundle reali lazy-loaded e misurarli compressi su iPhone.

Eseguire i parser con:

```text
node --test experiments/card-importer/card-parser.test.mjs
```

## Seconda prova isolata

`prototype.html` permette di fotografare o selezionare una card, scegliere il profilo
e ottenere una proposta modificabile. Non può salvare dati. QR usa prima l'API nativa
e poi ZXing; OCR usa Tesseract soltanto dopo la pressione di **Analizza**.

Il prototipo non è pubblicato e il bundle generato resta ignorato da Git:

```text
npm run build:card-importer-prototype
```

Prima di una possibile integrazione servono ancora prove su immagini reali, soprattutto
su iPhone, e la scelta di come distribuire localmente worker e modello italiano senza
dipendenze di rete durante il riconoscimento.
