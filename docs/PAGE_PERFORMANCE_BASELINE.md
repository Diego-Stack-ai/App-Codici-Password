# Baseline statica delle prestazioni per pagina

> Generata con `npm run audit:pages`. Misura il peso locale inizialmente raggiungibile da HTML, CSS e grafo degli import JavaScript. Non misura rete Firebase, decifratura, rendering o prestazioni del dispositivo: questi valori richiedono il collaudo runtime P5.

Pagine canoniche analizzate: **31**. Redirect storici esclusi: `home-v126.html`, `home-v127.html`.

| Pagina | HTML | CSS | Moduli JS | Peso grezzo | Stima gzip |
|---|---:|---:|---:|---:|---:|
| `profilo_privato.html` | 1 | 5 | 40 | 1107.4 KB | 319.2 KB |
| `aggiungi_scadenza.html` | 1 | 7 | 29 | 1057.3 KB | 305.1 KB |
| `dettaglio_account_privato.html` | 1 | 6 | 30 | 1048.4 KB | 303.7 KB |
| `dettaglio_account_azienda.html` | 1 | 6 | 31 | 1036.7 KB | 301.2 KB |
| `modifica_azienda.html` | 1 | 5 | 33 | 1054.2 KB | 297.8 KB |
| `form_account_azienda.html` | 1 | 6 | 29 | 1020.2 KB | 296.5 KB |
| `form_account_privato.html` | 1 | 6 | 28 | 1018.6 KB | 295.4 KB |
| `impostazioni.html` | 1 | 5 | 30 | 1005.7 KB | 293.7 KB |
| `account_privati.html` | 1 | 6 | 30 | 983.2 KB | 291.2 KB |
| `dati_azienda.html` | 1 | 5 | 29 | 998.3 KB | 291.1 KB |
| `home_page.html` | 1 | 6 | 28 | 973.5 KB | 288.8 KB |
| `area_privata.html` | 1 | 7 | 27 | 980.1 KB | 288.3 KB |
| `archivio_account.html` | 1 | 6 | 28 | 974.0 KB | 288.0 KB |
| `account_azienda.html` | 1 | 6 | 29 | 967.9 KB | 286.8 KB |
| `dettaglio_scadenza.html` | 1 | 6 | 28 | 971.5 KB | 286.6 KB |
| `scadenze.html` | 1 | 6 | 25 | 933.4 KB | 277.4 KB |
| `configurazione_automezzi.html` | 1 | 6 | 24 | 925.7 KB | 273.4 KB |
| `configurazione_generali.html` | 1 | 6 | 24 | 925.0 KB | 273.2 KB |
| `configurazione_documenti.html` | 1 | 6 | 24 | 925.2 KB | 273.2 KB |
| `registrati.html` | 1 | 4 | 25 | 913.9 KB | 272.5 KB |
| `lista_aziende.html` | 1 | 6 | 24 | 910.5 KB | 271.5 KB |
| `reset_password.html` | 1 | 4 | 25 | 908.1 KB | 271.4 KB |
| `gestione_destinatari.html` | 1 | 6 | 24 | 911.2 KB | 271.3 KB |
| `regole_scadenze.html` | 1 | 6 | 23 | 906.9 KB | 269.9 KB |
| `imposta_nuova_password.html` | 1 | 4 | 24 | 903.2 KB | 269.4 KB |
| `privacy.html` | 1 | 4 | 23 | 885.9 KB | 263.5 KB |
| `termini.html` | 1 | 4 | 23 | 883.7 KB | 263.2 KB |
| `login-v115.html` | 1 | 4 | 19 | 869.3 KB | 260.7 KB |
| `index.html` | 1 | 1 | 1 | 11.5 KB | 3.9 KB |
| `home-v128.html` | 1 | 0 | 0 | 0.5 KB | 0.3 KB |
| `home-v129.html` | 1 | 0 | 0 | 0.5 KB | 0.3 KB |

## Pagine con il maggiore carico statico

- `profilo_privato.html`: 319.2 KB gzip stimati, 40 moduli JS e 5 fogli CSS.
- `aggiungi_scadenza.html`: 305.1 KB gzip stimati, 29 moduli JS e 7 fogli CSS.
- `dettaglio_account_privato.html`: 303.7 KB gzip stimati, 30 moduli JS e 6 fogli CSS.
- `dettaglio_account_azienda.html`: 301.2 KB gzip stimati, 31 moduli JS e 6 fogli CSS.
- `modifica_azienda.html`: 297.8 KB gzip stimati, 33 moduli JS e 5 fogli CSS.
- `form_account_azienda.html`: 296.5 KB gzip stimati, 29 moduli JS e 6 fogli CSS.
- `form_account_privato.html`: 295.4 KB gzip stimati, 28 moduli JS e 6 fogli CSS.
- `impostazioni.html`: 293.7 KB gzip stimati, 30 moduli JS e 5 fogli CSS.

## Asset condivisi da almeno il 75% delle pagine

- `assets/css/core.css`: 2.6 KB gzip stimati, usato da 29/31 pagine.
- `assets/js/theme-init.js`: 0.8 KB gzip stimati, usato da 29/31 pagine.
- `assets/css/core_fonts.css`: 1.5 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/offline-firestore.js`: 0.6 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/vendor/firebase-runtime.js`: 211.8 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/logger.js`: 0.4 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/ui-core-v129.js`: 4.9 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/dom-utils.js`: 1.3 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/translations.js`: 7.6 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/modules/core/password-policy.js`: 1.3 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/components-v129.js`: 5.0 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/firebase-config.js`: 1.3 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/footer-state.js`: 0.3 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/env-v126.js`: 0.2 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/utils.js`: 0.7 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/offline-status.js`: 0.4 KB gzip stimati, usato da 28/31 pagine.
- `assets/js/main-v129.js`: 7.7 KB gzip stimati, usato da 27/31 pagine.
- `assets/js/ui-components.js`: 1.2 KB gzip stimati, usato da 27/31 pagine.
- `assets/js/cleanup.js`: 2.3 KB gzip stimati, usato da 27/31 pagine.
- `assets/js/modules/shared/company-area-preference.js`: 0.4 KB gzip stimati, usato da 27/31 pagine.
- `assets/js/inactivity-timer.js`: 1.6 KB gzip stimati, usato da 27/31 pagine.
- `assets/js/modules/core/vault-session.js`: 1.0 KB gzip stimati, usato da 27/31 pagine.
- `assets/js/pages-init.js`: 1.1 KB gzip stimati, usato da 27/31 pagine.
- `assets/js/offline-sync.js`: 1.5 KB gzip stimati, usato da 27/31 pagine.
- `assets/js/performance-metrics.js`: 0.4 KB gzip stimati, usato da 27/31 pagine.
- `assets/css/core_ui.css`: 4.3 KB gzip stimati, usato da 26/31 pagine.
- `assets/css/core_fascie.css`: 2.0 KB gzip stimati, usato da 24/31 pagine.

## Regola di utilizzo

Rigenerare questa baseline prima e dopo ogni rifattorizzazione. Una riduzione statica non autorizza a cambiare sicurezza, schema dati o UX; il risultato va sempre affiancato ai test automatici e a misure runtime su iPhone e PC.
