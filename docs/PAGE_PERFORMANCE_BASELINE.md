# Baseline statica delle prestazioni per pagina

> Generata con `npm run audit:pages`. Misura il peso locale inizialmente raggiungibile da HTML, CSS e grafo degli import JavaScript. Non misura rete Firebase, decifratura, rendering o prestazioni del dispositivo: questi valori richiedono il collaudo runtime P5.

Pagine canoniche analizzate: **30**. I redirect storici sono archiviati; il laboratorio temporaneo pubblico `prova.html` è escluso dal conteggio.

| Pagina | HTML | CSS | Moduli JS | Peso grezzo | Stima gzip |
|---|---:|---:|---:|---:|---:|
| `profilo_privato.html` | 1 | 7 | 42 | 1182.0 KB | 336.1 KB |
| `form_account_privato.html` | 1 | 6 | 42 | 1144.1 KB | 327.6 KB |
| `form_account_azienda.html` | 1 | 6 | 41 | 1133.2 KB | 325.2 KB |
| `dati_azienda.html` | 1 | 8 | 38 | 1098.1 KB | 317.9 KB |
| `aggiungi_scadenza.html` | 1 | 7 | 38 | 1096.3 KB | 316.2 KB |
| `impostazioni.html` | 1 | 5 | 34 | 1095.3 KB | 312.5 KB |
| `dettaglio_account_azienda.html` | 1 | 7 | 36 | 1076.3 KB | 311.1 KB |
| `dettaglio_account_privato.html` | 1 | 7 | 36 | 1075.0 KB | 310.8 KB |
| `modifica_azienda.html` | 1 | 6 | 35 | 1092.4 KB | 306.2 KB |
| `account_privati.html` | 1 | 6 | 34 | 1014.8 KB | 298.0 KB |
| `home_page.html` | 1 | 6 | 34 | 1006.9 KB | 297.1 KB |
| `dettaglio_scadenza.html` | 1 | 6 | 32 | 1015.6 KB | 296.7 KB |
| `account_azienda.html` | 1 | 6 | 34 | 1009.1 KB | 296.5 KB |
| `area_privata.html` | 1 | 7 | 31 | 1015.0 KB | 296.3 KB |
| `archivio_account.html` | 1 | 6 | 32 | 1007.8 KB | 296.1 KB |
| `scadenze.html` | 1 | 6 | 28 | 968.1 KB | 285.3 KB |
| `configurazione_automezzi.html` | 1 | 6 | 27 | 958.3 KB | 280.5 KB |
| `configurazione_generali.html` | 1 | 6 | 27 | 957.7 KB | 280.4 KB |
| `configurazione_documenti.html` | 1 | 6 | 27 | 957.9 KB | 280.4 KB |
| `lista_aziende.html` | 1 | 6 | 28 | 940.0 KB | 278.6 KB |
| `gestione_destinatari.html` | 1 | 6 | 26 | 942.2 KB | 277.9 KB |
| `registrati.html` | 1 | 5 | 25 | 934.5 KB | 277.1 KB |
| `reset_password.html` | 1 | 4 | 25 | 928.2 KB | 275.8 KB |
| `regole_scadenze.html` | 1 | 6 | 23 | 926.7 KB | 274.1 KB |
| `imposta_nuova_password.html` | 1 | 4 | 24 | 922.3 KB | 273.6 KB |
| `privacy.html` | 1 | 4 | 23 | 896.7 KB | 266.0 KB |
| `termini.html` | 1 | 4 | 23 | 894.5 KB | 265.8 KB |
| `login-v115.html` | 1 | 4 | 19 | 886.0 KB | 264.1 KB |
| `contatto_condiviso.html` | 1 | 3 | 3 | 25.9 KB | 9.2 KB |
| `index.html` | 1 | 1 | 1 | 13.4 KB | 4.4 KB |

## Pagine con il maggiore carico statico

- `profilo_privato.html`: 336.1 KB gzip stimati, 42 moduli JS e 7 fogli CSS.
- `form_account_privato.html`: 327.6 KB gzip stimati, 42 moduli JS e 6 fogli CSS.
- `form_account_azienda.html`: 325.2 KB gzip stimati, 41 moduli JS e 6 fogli CSS.
- `dati_azienda.html`: 317.9 KB gzip stimati, 38 moduli JS e 8 fogli CSS.
- `aggiungi_scadenza.html`: 316.2 KB gzip stimati, 38 moduli JS e 7 fogli CSS.
- `impostazioni.html`: 312.5 KB gzip stimati, 34 moduli JS e 5 fogli CSS.
- `dettaglio_account_azienda.html`: 311.1 KB gzip stimati, 36 moduli JS e 7 fogli CSS.
- `dettaglio_account_privato.html`: 310.8 KB gzip stimati, 36 moduli JS e 7 fogli CSS.

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
- `assets/css/core_ui.css`: 6.0 KB gzip stimati, usato da 26/30 pagine.
- `assets/css/core_fascie.css`: 2.2 KB gzip stimati, usato da 24/30 pagine.

## Regola di utilizzo

Rigenerare questa baseline prima e dopo ogni rifattorizzazione. Una riduzione statica non autorizza a cambiare sicurezza, schema dati o UX; il risultato va sempre affiancato ai test automatici e a misure runtime su iPhone e PC.
