# Baseline statica delle prestazioni per pagina

> Generata con `npm run audit:pages`. Misura il peso locale inizialmente raggiungibile da HTML, CSS e grafo degli import JavaScript. Non misura rete Firebase, decifratura, rendering o prestazioni del dispositivo: questi valori richiedono il collaudo runtime P5.

Pagine canoniche analizzate: **30**. I redirect storici sono archiviati; il laboratorio temporaneo pubblico `prova.html` è escluso dal conteggio.

| Pagina | HTML | CSS | Moduli JS | Peso grezzo | Stima gzip |
|---|---:|---:|---:|---:|---:|
| `profilo_privato.html` | 1 | 7 | 43 | 1174.7 KB | 335.1 KB |
| `form_account_privato.html` | 1 | 6 | 43 | 1156.7 KB | 330.9 KB |
| `form_account_azienda.html` | 1 | 6 | 43 | 1153.1 KB | 330.2 KB |
| `dati_azienda.html` | 1 | 8 | 40 | 1103.0 KB | 319.7 KB |
| `aggiungi_scadenza.html` | 1 | 7 | 39 | 1100.1 KB | 317.6 KB |
| `impostazioni.html` | 1 | 5 | 35 | 1110.9 KB | 316.4 KB |
| `dettaglio_account_privato.html` | 1 | 7 | 38 | 1094.6 KB | 316.0 KB |
| `dettaglio_account_azienda.html` | 1 | 7 | 38 | 1094.6 KB | 316.0 KB |
| `modifica_azienda.html` | 1 | 6 | 36 | 1096.2 KB | 307.5 KB |
| `archivio_account.html` | 1 | 6 | 33 | 1028.2 KB | 301.3 KB |
| `account_privati.html` | 1 | 6 | 36 | 1018.9 KB | 299.7 KB |
| `dettaglio_scadenza.html` | 1 | 6 | 33 | 1025.5 KB | 299.5 KB |
| `home_page.html` | 1 | 6 | 35 | 1010.8 KB | 298.5 KB |
| `account_azienda.html` | 1 | 6 | 36 | 1013.4 KB | 298.1 KB |
| `area_privata.html` | 1 | 7 | 32 | 1018.9 KB | 297.7 KB |
| `scadenze.html` | 1 | 6 | 29 | 971.6 KB | 286.6 KB |
| `configurazione_automezzi.html` | 1 | 6 | 28 | 961.8 KB | 281.8 KB |
| `configurazione_generali.html` | 1 | 6 | 28 | 961.2 KB | 281.7 KB |
| `configurazione_documenti.html` | 1 | 6 | 28 | 961.4 KB | 281.7 KB |
| `lista_aziende.html` | 1 | 6 | 30 | 944.1 KB | 280.2 KB |
| `gestione_destinatari.html` | 1 | 6 | 27 | 945.7 KB | 279.2 KB |
| `registrati.html` | 1 | 5 | 25 | 935.8 KB | 277.7 KB |
| `reset_password.html` | 1 | 4 | 25 | 929.4 KB | 276.3 KB |
| `regole_scadenze.html` | 1 | 6 | 24 | 930.2 KB | 275.5 KB |
| `imposta_nuova_password.html` | 1 | 4 | 24 | 923.4 KB | 274.1 KB |
| `privacy.html` | 1 | 4 | 23 | 898.1 KB | 266.5 KB |
| `termini.html` | 1 | 4 | 23 | 895.9 KB | 266.2 KB |
| `login-v115.html` | 1 | 4 | 19 | 885.7 KB | 264.2 KB |
| `contatto_condiviso.html` | 1 | 3 | 3 | 26.0 KB | 9.2 KB |
| `index.html` | 1 | 1 | 1 | 13.5 KB | 4.4 KB |

## Pagine con il maggiore carico statico

- `profilo_privato.html`: 335.1 KB gzip stimati, 43 moduli JS e 7 fogli CSS.
- `form_account_privato.html`: 330.9 KB gzip stimati, 43 moduli JS e 6 fogli CSS.
- `form_account_azienda.html`: 330.2 KB gzip stimati, 43 moduli JS e 6 fogli CSS.
- `dati_azienda.html`: 319.7 KB gzip stimati, 40 moduli JS e 8 fogli CSS.
- `aggiungi_scadenza.html`: 317.6 KB gzip stimati, 39 moduli JS e 7 fogli CSS.
- `impostazioni.html`: 316.4 KB gzip stimati, 35 moduli JS e 5 fogli CSS.
- `dettaglio_account_privato.html`: 316.0 KB gzip stimati, 38 moduli JS e 7 fogli CSS.
- `dettaglio_account_azienda.html`: 316.0 KB gzip stimati, 38 moduli JS e 7 fogli CSS.

## Asset condivisi da almeno il 75% delle pagine

- `assets/css/core.css`: 3.2 KB gzip stimati, usato da 30/30 pagine.
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
- `assets/js/main-v129.js`: 8.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/ui-components.js`: 1.3 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/cleanup.js`: 2.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/modules/shared/company-area-preference.js`: 0.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/inactivity-timer.js`: 1.6 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/modules/core/vault-session.js`: 1.1 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/pages-init.js`: 1.1 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/offline-sync.js`: 1.7 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/performance-metrics.js`: 1.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/css/core_ui.css`: 6.0 KB gzip stimati, usato da 26/30 pagine.
- `assets/css/core_fascie.css`: 2.2 KB gzip stimati, usato da 24/30 pagine.

## Regola di utilizzo

Rigenerare questa baseline prima e dopo ogni rifattorizzazione. Una riduzione statica non autorizza a cambiare sicurezza, schema dati o UX; il risultato va sempre affiancato ai test automatici e a misure runtime su iPhone e PC.
