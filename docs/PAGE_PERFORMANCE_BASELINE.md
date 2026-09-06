# Baseline statica delle prestazioni per pagina

> Generata con `npm run audit:pages`. Misura il peso locale inizialmente raggiungibile da HTML, CSS e grafo degli import JavaScript. Non misura rete Firebase, decifratura, rendering o prestazioni del dispositivo: questi valori richiedono il collaudo runtime P5.

Pagine canoniche analizzate: **29**. Laboratori e redirect storici sono conservati fuori dalla cartella pubblica.

| Pagina | HTML | CSS | Moduli JS | Peso grezzo | Stima gzip |
|---|---:|---:|---:|---:|---:|
| `profilo_privato.html` | 1 | 5 | 42 | 1119.5 KB | 322.6 KB |
| `aggiungi_scadenza.html` | 1 | 7 | 38 | 1070.4 KB | 311.8 KB |
| `dettaglio_account_azienda.html` | 1 | 6 | 36 | 1049.9 KB | 305.9 KB |
| `dettaglio_account_privato.html` | 1 | 6 | 36 | 1047.6 KB | 305.3 KB |
| `modifica_azienda.html` | 1 | 5 | 35 | 1066.2 KB | 301.3 KB |
| `form_account_azienda.html` | 1 | 6 | 32 | 1035.4 KB | 300.8 KB |
| `form_account_privato.html` | 1 | 6 | 32 | 1032.9 KB | 300.4 KB |
| `impostazioni.html` | 1 | 5 | 33 | 1028.0 KB | 300.1 KB |
| `dati_azienda.html` | 1 | 5 | 32 | 1010.4 KB | 295.0 KB |
| `home_page.html` | 1 | 6 | 34 | 987.0 KB | 293.8 KB |
| `area_privata.html` | 1 | 7 | 31 | 994.6 KB | 292.7 KB |
| `account_privati.html` | 1 | 6 | 33 | 985.9 KB | 292.3 KB |
| `archivio_account.html` | 1 | 6 | 32 | 986.1 KB | 292.0 KB |
| `dettaglio_scadenza.html` | 1 | 6 | 32 | 988.7 KB | 291.7 KB |
| `account_azienda.html` | 1 | 6 | 33 | 982.1 KB | 291.1 KB |
| `scadenze.html` | 1 | 6 | 28 | 947.9 KB | 281.6 KB |
| `configurazione_automezzi.html` | 1 | 6 | 27 | 940.1 KB | 277.4 KB |
| `configurazione_generali.html` | 1 | 6 | 27 | 939.4 KB | 277.3 KB |
| `configurazione_documenti.html` | 1 | 6 | 27 | 939.6 KB | 277.2 KB |
| `lista_aziende.html` | 1 | 6 | 28 | 921.5 KB | 275.3 KB |
| `gestione_destinatari.html` | 1 | 6 | 26 | 923.2 KB | 274.6 KB |
| `registrati.html` | 1 | 4 | 25 | 919.4 KB | 274.1 KB |
| `reset_password.html` | 1 | 4 | 25 | 913.6 KB | 273.1 KB |
| `regole_scadenze.html` | 1 | 6 | 23 | 913.6 KB | 271.8 KB |
| `imposta_nuova_password.html` | 1 | 4 | 24 | 908.6 KB | 271.1 KB |
| `privacy.html` | 1 | 4 | 23 | 891.4 KB | 265.0 KB |
| `termini.html` | 1 | 4 | 23 | 889.2 KB | 264.7 KB |
| `login-v115.html` | 1 | 4 | 19 | 871.4 KB | 261.4 KB |
| `index.html` | 1 | 1 | 1 | 12.4 KB | 4.2 KB |

## Pagine con il maggiore carico statico

- `profilo_privato.html`: 322.6 KB gzip stimati, 42 moduli JS e 5 fogli CSS.
- `aggiungi_scadenza.html`: 311.8 KB gzip stimati, 38 moduli JS e 7 fogli CSS.
- `dettaglio_account_azienda.html`: 305.9 KB gzip stimati, 36 moduli JS e 6 fogli CSS.
- `dettaglio_account_privato.html`: 305.3 KB gzip stimati, 36 moduli JS e 6 fogli CSS.
- `modifica_azienda.html`: 301.3 KB gzip stimati, 35 moduli JS e 5 fogli CSS.
- `form_account_azienda.html`: 300.8 KB gzip stimati, 32 moduli JS e 6 fogli CSS.
- `form_account_privato.html`: 300.4 KB gzip stimati, 32 moduli JS e 6 fogli CSS.
- `impostazioni.html`: 300.1 KB gzip stimati, 33 moduli JS e 5 fogli CSS.

## Asset condivisi da almeno il 75% delle pagine

- `assets/css/core.css`: 2.9 KB gzip stimati, usato da 29/29 pagine.
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
- `assets/css/core_ui.css`: 4.6 KB gzip stimati, usato da 26/29 pagine.
- `assets/css/core_fascie.css`: 2.2 KB gzip stimati, usato da 24/29 pagine.

## Regola di utilizzo

Rigenerare questa baseline prima e dopo ogni rifattorizzazione. Una riduzione statica non autorizza a cambiare sicurezza, schema dati o UX; il risultato va sempre affiancato ai test automatici e a misure runtime su iPhone e PC.
