# Baseline statica delle prestazioni per pagina

> Generata con `npm run audit:pages`. Misura il peso locale inizialmente raggiungibile da HTML, CSS e grafo degli import JavaScript. Non misura rete Firebase, decifratura, rendering o prestazioni del dispositivo: questi valori richiedono il collaudo runtime P5.

Pagine canoniche analizzate: **30**. I redirect storici sono archiviati; il laboratorio temporaneo pubblico `prova.html` è escluso dal conteggio.

| Pagina | HTML | CSS | Moduli JS | Peso grezzo | Stima gzip |
|---|---:|---:|---:|---:|---:|
| `profilo_privato.html` | 1 | 7 | 42 | 1179.8 KB | 335.6 KB |
| `form_account_privato.html` | 1 | 6 | 40 | 1119.0 KB | 321.3 KB |
| `form_account_azienda.html` | 1 | 6 | 39 | 1108.2 KB | 318.9 KB |
| `dati_azienda.html` | 1 | 8 | 38 | 1094.3 KB | 317.0 KB |
| `aggiungi_scadenza.html` | 1 | 7 | 38 | 1094.1 KB | 315.8 KB |
| `impostazioni.html` | 1 | 5 | 34 | 1092.1 KB | 311.7 KB |
| `dettaglio_account_azienda.html` | 1 | 7 | 36 | 1073.7 KB | 310.5 KB |
| `dettaglio_account_privato.html` | 1 | 7 | 36 | 1071.2 KB | 310.0 KB |
| `modifica_azienda.html` | 1 | 6 | 35 | 1089.5 KB | 305.5 KB |
| `home_page.html` | 1 | 6 | 34 | 1004.7 KB | 296.7 KB |
| `dettaglio_scadenza.html` | 1 | 6 | 32 | 1013.4 KB | 296.2 KB |
| `account_privati.html` | 1 | 6 | 34 | 1006.1 KB | 296.1 KB |
| `area_privata.html` | 1 | 7 | 31 | 1012.8 KB | 295.9 KB |
| `archivio_account.html` | 1 | 6 | 32 | 1005.2 KB | 295.5 KB |
| `account_azienda.html` | 1 | 6 | 34 | 1001.2 KB | 294.7 KB |
| `scadenze.html` | 1 | 6 | 28 | 966.6 KB | 285.0 KB |
| `configurazione_automezzi.html` | 1 | 6 | 27 | 957.1 KB | 280.3 KB |
| `configurazione_generali.html` | 1 | 6 | 27 | 956.5 KB | 280.2 KB |
| `configurazione_documenti.html` | 1 | 6 | 27 | 956.7 KB | 280.2 KB |
| `lista_aziende.html` | 1 | 6 | 28 | 938.9 KB | 278.4 KB |
| `gestione_destinatari.html` | 1 | 6 | 26 | 941.0 KB | 277.7 KB |
| `registrati.html` | 1 | 5 | 25 | 933.4 KB | 276.9 KB |
| `reset_password.html` | 1 | 4 | 25 | 927.0 KB | 275.6 KB |
| `regole_scadenze.html` | 1 | 6 | 23 | 925.6 KB | 273.9 KB |
| `imposta_nuova_password.html` | 1 | 4 | 24 | 921.2 KB | 273.4 KB |
| `privacy.html` | 1 | 4 | 23 | 896.1 KB | 265.9 KB |
| `termini.html` | 1 | 4 | 23 | 893.9 KB | 265.7 KB |
| `login-v115.html` | 1 | 4 | 19 | 885.5 KB | 264.0 KB |
| `contatto_condiviso.html` | 1 | 3 | 3 | 25.9 KB | 9.2 KB |
| `index.html` | 1 | 1 | 1 | 13.4 KB | 4.4 KB |

## Pagine con il maggiore carico statico

- `profilo_privato.html`: 335.6 KB gzip stimati, 42 moduli JS e 7 fogli CSS.
- `form_account_privato.html`: 321.3 KB gzip stimati, 40 moduli JS e 6 fogli CSS.
- `form_account_azienda.html`: 318.9 KB gzip stimati, 39 moduli JS e 6 fogli CSS.
- `dati_azienda.html`: 317.0 KB gzip stimati, 38 moduli JS e 8 fogli CSS.
- `aggiungi_scadenza.html`: 315.8 KB gzip stimati, 38 moduli JS e 7 fogli CSS.
- `impostazioni.html`: 311.7 KB gzip stimati, 34 moduli JS e 5 fogli CSS.
- `dettaglio_account_azienda.html`: 310.5 KB gzip stimati, 36 moduli JS e 7 fogli CSS.
- `dettaglio_account_privato.html`: 310.0 KB gzip stimati, 36 moduli JS e 7 fogli CSS.

## Asset condivisi da almeno il 75% delle pagine

- `assets/css/core.css`: 3.1 KB gzip stimati, usato da 30/30 pagine.
- `assets/css/core_fonts.css`: 1.5 KB gzip stimati, usato da 29/30 pagine.
- `assets/js/theme-init.js`: 0.8 KB gzip stimati, usato da 29/30 pagine.
- `assets/js/offline-firestore.js`: 0.6 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/vendor/firebase-runtime.js`: 211.4 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/logger.js`: 0.4 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/ui-core-v129.js`: 5.1 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/dom-utils.js`: 1.6 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/translations.js`: 7.6 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/modules/core/password-policy.js`: 1.3 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/components-v129.js`: 5.1 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/firebase-config.js`: 1.3 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/footer-state.js`: 0.3 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/env-v126.js`: 0.2 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/utils.js`: 0.7 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/offline-status.js`: 0.4 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/main-v129.js`: 8.1 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/ui-components.js`: 1.3 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/cleanup.js`: 2.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/modules/shared/company-area-preference.js`: 0.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/inactivity-timer.js`: 1.6 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/modules/core/vault-session.js`: 1.1 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/pages-init.js`: 1.1 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/offline-sync.js`: 1.5 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/performance-metrics.js`: 1.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/css/core_ui.css`: 5.9 KB gzip stimati, usato da 26/30 pagine.
- `assets/css/core_fascie.css`: 2.2 KB gzip stimati, usato da 24/30 pagine.

## Regola di utilizzo

Rigenerare questa baseline prima e dopo ogni rifattorizzazione. Una riduzione statica non autorizza a cambiare sicurezza, schema dati o UX; il risultato va sempre affiancato ai test automatici e a misure runtime su iPhone e PC.
