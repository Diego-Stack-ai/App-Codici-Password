# Contratto UI e design system

Questo documento definisce i vincoli tecnici della fase M4. Non sostituisce la revisione completa di lingue e organizzazione delle Impostazioni prevista dopo M10.

La struttura di viewport, fondale, contenitori, area scorrevole, fasce e spaziatori è regolata separatamente da `PAGE_SHELL_CONTRACT.md`. Ombre, vetro e decorazioni non fanno parte di quel contratto strutturale.

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
- Campi dei form: `assets/css/moduli.css`; composizione comune dei form Account Privato/Azienda: `assets/css/account_form.css`.
- Card e righe Account: `modules/shared/account-list-view.js`.
- Campi sensibili: `modules/shared/card-secret.js`.
- Stati di pagina: `modules/shared/ui-state-view.js`.

## Famiglie della superficie UI

Le due famiglie definite dal contratto strutturale restano il livello esterno:

- **Accesso**: `index.html` come ingresso tecnico e le quattro pagine di autenticazione;
- **Operativa**: le 24 pagine dotate di header, area centrale scorrevole e footer condivisi.

La famiglia operativa non implica che tutte le pagine abbiano la stessa composizione interna. Per evitare CSS monolitici e duplicazioni locali, le pagine operative adottano sei modelli di composizione, determinati dall'interazione principale e non dalla sola somiglianza grafica:

1. **Hub e navigazione**: Home e Area privata. Presentano destinazioni, riepiloghi e contatori attraverso grandi card di accesso.
2. **Elenchi e collezioni**: Account privati, Account azienda, Lista aziende, Scadenze e Archivio account. Ripetono righe o card, ricerca, filtri, ordinamento e azioni sugli elementi.
3. **Dettagli e consultazione**: Dettaglio account privato, Dettaglio account azienda, Dettaglio scadenza, Dati azienda e Profilo privato. Organizzano un singolo soggetto o record in hero, sezioni, campi consultabili e azioni contestuali.
4. **Form e modifica**: Form account privato, Form account azienda, Modifica azienda e Aggiungi scadenza. Condividono campi, griglie, validazione, allegati e azioni di salvataggio.
5. **Impostazioni e configurazione**: Impostazioni, Regole scadenze, Gestione destinatari e le tre configurazioni. Usano card amministrative, controlli, preferenze e accessi alle gestioni specialistiche.
6. **Informative**: Privacy e Termini. Condividono una composizione documentale di lettura, distinta dai controlli di configurazione.

Una pagina può usare componenti appartenenti a più modelli, ma deve avere un solo modello primario. Il modello non modifica il contratto del viewport e non autorizza una seconda implementazione di header, footer o area scorrevole.

### Responsabilità delle pagine rappresentative

- **Area privata** è un hub di navigazione: distingue Account standard, Condivisi, Note private e Note condivise e mostra gli elementi più utilizzati.
- **Profilo privato** è uno spazio dati operativo: gestisce identità, contatti, indirizzi, documenti, QR e tessera digitale tramite tab e sezioni modificabili.
- **Impostazioni** è un centro di controllo: raccoglie preferenze, servizi e accessi alle configurazioni.

Le tre pagine condividono il linguaggio visivo rappresentativo, non lo stesso modello funzionale: Area privata è un hub, Profilo privato è un dettaglio operativo e Impostazioni è il centro della famiglia configurazione. La qualità "rappresentativa" è quindi una variante visiva trasversale. Hero, card, badge, tab e sezioni devono essere componenti riusabili; i contenuti e il comportamento restano dei rispettivi moduli.

## Livelli di proprietà dello stile

Ogni regola deve appartenere al livello più ristretto che ne descrive correttamente la responsabilità:

1. **Fondazioni**: temi, token, viewport, spazi, tipografia e livelli semantici nel core.
2. **Componenti**: card, campi glass, badge, tab, pulsanti, allegati e stati riutilizzati da almeno due pagine.
3. **Modelli di pagina**: composizione interna comune a hub, elenchi, dettagli, form, configurazioni o informative.
4. **Pagina**: solo identità o comportamento realmente esclusivo.

Non si crea un unico foglio globale per assorbire ogni differenza. Una classe locale viene promossa soltanto quando due utilizzi reali hanno stesso significato, stessa struttura e stessi stati. L'uguaglianza puramente estetica non è sufficiente.

## Contratto degli effetti visivi

- Fondale, colori di tema e glow ambientale appartengono a `core.css`.
- Nebbia, vetro delle fasce e dissolvenza del contenuto appartengono a `core_fascie.css`.
- Profondità, bordi e ombre dei componenti devono usare token condivisi; una pagina non ridefinisce una variante già esistente cambiandone soltanto il nome.
- Watermark e decorazioni fisse non partecipano al layout, non intercettano input e non cambiano le dimensioni del documento.
- Animazioni decorative non possono essere necessarie per comprendere uno stato e devono avere una variante senza movimento.
- Il tema scuro non è una semplice inversione: ogni livello glass deve conservare contrasto, separazione e leggibilità equivalenti al tema chiaro.

## Debito censito e ordine di consolidamento

La ricognizione M4 ha rilevato una forte sovrapposizione tra i CSS dei form, dei dettagli Account e delle pagine Azienda, mentre Area privata, Profilo privato e Impostazioni condividono soprattutto una variante visiva rappresentativa e non il modello funzionale. Sono inoltre presenti watermark ripetuti, effetti locali e valori di livello non ancora espressi tramite una scala semantica.

Il consolidamento procede senza variazioni grafiche intenzionali in questo ordine:

1. form Account privato e azienda, già basati su `account_form.css`;
2. dettagli Account privato e azienda;
3. Dati azienda e Modifica azienda;
4. componenti rappresentativi realmente comuni tra Area privata, Profilo privato e Impostazioni;
5. watermark, decorazioni e scala semantica dei livelli;
6. rimozione delle regole locali soltanto dopo equivalenza visiva e funzionale verificata.

La presenza duplicata di `base-glow` nelle due pagine di dettaglio Account è registrata come anomalia da verificare durante il punto 2; non deve essere rimossa senza confronto visivo.

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
