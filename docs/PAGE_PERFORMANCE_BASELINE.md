# Baseline statica delle prestazioni per pagina

> Generata con `npm run audit:pages`. Misura il peso locale inizialmente raggiungibile da HTML, CSS e grafo degli import JavaScript. Non misura rete Firebase, decifratura, rendering o prestazioni del dispositivo: questi valori richiedono il collaudo runtime P5.

Pagine canoniche analizzate: **29**. Redirect storici esclusi: `home-v126.html`, `home-v127.html`, `home-v128.html`, `home-v129.html`.

| Pagina | HTML | CSS | Moduli JS | Peso grezzo | Stima gzip |
|---|---:|---:|---:|---:|---:|
| `profilo_privato.html` | 1 | 5 | 42 | 1116.0 KB | 321.8 KB |
| `aggiungi_scadenza.html` | 1 | 7 | 31 | 1065.4 KB | 307.7 KB |
| `dettaglio_account_privato.html` | 1 | 6 | 32 | 1056.5 KB | 306.2 KB |
| `dettaglio_account_azienda.html` | 1 | 6 | 33 | 1044.8 KB | 303.6 KB |
| `impostazioni.html` | 1 | 5 | 33 | 1031.0 KB | 300.8 KB |
| `modifica_azienda.html` | 1 | 5 | 35 | 1062.7 KB | 300.4 KB |
| `form_account_azienda.html` | 1 | 6 | 31 | 1028.6 KB | 299.0 KB |
| `form_account_privato.html` | 1 | 6 | 30 | 1027.1 KB | 298.0 KB |
| `account_privati.html` | 1 | 6 | 32 | 991.4 KB | 293.7 KB |
| `dati_azienda.html` | 1 | 5 | 31 | 1006.8 KB | 293.7 KB |
| `home_page.html` | 1 | 6 | 30 | 981.3 KB | 291.2 KB |
| `area_privata.html` | 1 | 7 | 29 | 988.2 KB | 290.8 KB |
| `archivio_account.html` | 1 | 6 | 30 | 982.1 KB | 290.5 KB |
| `account_azienda.html` | 1 | 6 | 31 | 976.3 KB | 289.3 KB |
| `dettaglio_scadenza.html` | 1 | 6 | 30 | 979.8 KB | 289.2 KB |
| `scadenze.html` | 1 | 6 | 27 | 941.8 KB | 279.9 KB |
| `configurazione_automezzi.html` | 1 | 6 | 26 | 934.3 KB | 275.9 KB |
| `configurazione_generali.html` | 1 | 6 | 26 | 933.6 KB | 275.8 KB |
| `configurazione_documenti.html` | 1 | 6 | 26 | 933.9 KB | 275.8 KB |
| `lista_aziende.html` | 1 | 6 | 26 | 919.0 KB | 274.0 KB |
| `gestione_destinatari.html` | 1 | 6 | 26 | 919.7 KB | 273.8 KB |
| `registrati.html` | 1 | 4 | 25 | 917.2 KB | 273.5 KB |
| `reset_password.html` | 1 | 4 | 25 | 911.4 KB | 272.4 KB |
| `regole_scadenze.html` | 1 | 6 | 23 | 910.2 KB | 271.0 KB |
| `imposta_nuova_password.html` | 1 | 4 | 24 | 906.5 KB | 270.5 KB |
| `privacy.html` | 1 | 4 | 23 | 889.2 KB | 264.5 KB |
| `termini.html` | 1 | 4 | 23 | 887.0 KB | 264.2 KB |
| `login-v115.html` | 1 | 4 | 19 | 869.3 KB | 260.7 KB |
| `index.html` | 1 | 1 | 1 | 11.5 KB | 3.9 KB |

## Pagine con il maggiore carico statico

- `profilo_privato.html`: 321.8 KB gzip stimati, 42 moduli JS e 5 fogli CSS.
- `aggiungi_scadenza.html`: 307.7 KB gzip stimati, 31 moduli JS e 7 fogli CSS.
- `dettaglio_account_privato.html`: 306.2 KB gzip stimati, 32 moduli JS e 6 fogli CSS.
- `dettaglio_account_azienda.html`: 303.6 KB gzip stimati, 33 moduli JS e 6 fogli CSS.
- `impostazioni.html`: 300.8 KB gzip stimati, 33 moduli JS e 5 fogli CSS.
- `modifica_azienda.html`: 300.4 KB gzip stimati, 35 moduli JS e 5 fogli CSS.
- `form_account_azienda.html`: 299.0 KB gzip stimati, 31 moduli JS e 6 fogli CSS.
- `form_account_privato.html`: 298.0 KB gzip stimati, 30 moduli JS e 6 fogli CSS.

## Asset condivisi da almeno il 75% delle pagine

- `assets/css/core.css`: 2.6 KB gzip stimati, usato da 29/29 pagine.
- `assets/js/theme-init.js`: 0.8 KB gzip stimati, usato da 29/29 pagine.
- `assets/css/core_fonts.css`: 1.5 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/offline-firestore.js`: 0.6 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/vendor/firebase-runtime.js`: 211.8 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/logger.js`: 0.4 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/ui-core-v129.js`: 4.9 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/dom-utils.js`: 1.3 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/translations.js`: 7.6 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/modules/core/password-policy.js`: 1.3 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/components-v129.js`: 5.0 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/firebase-config.js`: 1.3 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/footer-state.js`: 0.3 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/env-v126.js`: 0.2 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/utils.js`: 0.7 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/offline-status.js`: 0.4 KB gzip stimati, usato da 28/29 pagine.
- `assets/js/main-v129.js`: 7.7 KB gzip stimati, usato da 27/29 pagine.
- `assets/js/ui-components.js`: 1.2 KB gzip stimati, usato da 27/29 pagine.
- `assets/js/cleanup.js`: 2.3 KB gzip stimati, usato da 27/29 pagine.
- `assets/js/modules/shared/company-area-preference.js`: 0.4 KB gzip stimati, usato da 27/29 pagine.
- `assets/js/inactivity-timer.js`: 1.6 KB gzip stimati, usato da 27/29 pagine.
- `assets/js/modules/core/vault-session.js`: 1.0 KB gzip stimati, usato da 27/29 pagine.
- `assets/js/pages-init.js`: 1.1 KB gzip stimati, usato da 27/29 pagine.
- `assets/js/offline-sync.js`: 1.5 KB gzip stimati, usato da 27/29 pagine.
- `assets/js/performance-metrics.js`: 1.4 KB gzip stimati, usato da 27/29 pagine.
- `assets/css/core_ui.css`: 4.3 KB gzip stimati, usato da 26/29 pagine.
- `assets/css/core_fascie.css`: 2.0 KB gzip stimati, usato da 24/29 pagine.

## Regola di utilizzo

Rigenerare questa baseline prima e dopo ogni rifattorizzazione. Una riduzione statica non autorizza a cambiare sicurezza, schema dati o UX; il risultato va sempre affiancato ai test automatici e a misure runtime su iPhone e PC.
