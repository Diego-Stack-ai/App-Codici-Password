# Contratto UI e design system

Questo documento definisce i vincoli tecnici della fase M4. Non sostituisce la revisione completa di lingue e organizzazione delle Impostazioni prevista dopo M10.

## Principi

- Un componente condiviso nasce soltanto quando esistono almeno due utilizzi reali.
- HTML, stile, comportamento e accesso ai dati restano separati.
- Le pagine compongono componenti e servizi; non duplicano renderer o mutazioni di dominio.
- Ogni controllo interattivo deve essere raggiungibile da tastiera, avere nome accessibile e un target minimo di 44 px.
- Gli stati asincroni devono essere espliciti: caricamento, vuoto, errore e avviso non possono apparire come una pagina bloccata.
- Animazioni e transizioni rispettano `prefers-reduced-motion`.

## Fondazioni canoniche

- Token di spazio, raggio, livelli, movimento e target tattile: `assets/css/core.css`.
- Token tipografici: `assets/css/core_fonts.css`.
- Header e footer: `assets/css/core_fascie.css` e `components-v129.js`.
- Controlli, modali e stati condivisi: `assets/css/core_ui.css`.
- Campi dei form: `assets/css/moduli.css`.
- Card e righe Account: `modules/shared/account-list-view.js`.
- Campi sensibili: `modules/shared/card-secret.js`.
- Stati di pagina: `modules/shared/ui-state-view.js`.

## Contratto degli stati di pagina

`createUiState()` è la sola implementazione dinamica per i nuovi stati di caricamento, vuoto, avviso ed errore. Usa:

- `role="status"` e `aria-live="polite"` per caricamento e stato vuoto;
- `role="alert"` e `aria-live="assertive"` per errori e avvisi;
- `aria-busy="true"` soltanto durante il caricamento;
- pulsanti reali con target tattile minimo per le azioni di recupero.

Le pagine già esistenti vengono migrate quando sono toccate da una fase attiva; non si introduce un cambio grafico globale non verificato.

## Budget

- Nessun testo nuovo sotto 12 px.
- Le dimensioni tipografiche nuove usano i token di `core_fonts.css`.
- Le icone nuove riusano Material Symbols già incluso; nessuna nuova famiglia o libreria.
- Nessun nuovo stile inline, dialogo nativo o runtime CSS.
- Ogni variazione deve superare `test:ui-foundations`, `test:html-purity`, `test:css` e il budget statico delle pagine.

## Verifica visiva

I gate automatici coprono struttura, accessibilità statica, dipendenze e budget. Scroll, overscroll, safe area e stabilità delle fasce richiedono anche prova fisica su iPhone e Windows prima di dichiarare M4 conclusa.
