# Registro delle pagine canoniche

Contratto M3 per distinguere le funzioni reali dai percorsi storici di compatibilità.

## Regola

- Ogni funzione visibile possiede una sola pagina HTML e un solo modulo inizializzatore canonici.
- Un redirect storico non contiene logica applicativa, non entra nella baseline prestazionale e punta direttamente alla pagina canonica.
- Nuove pagine con suffissi di versione sono vietate. Le evoluzioni modificano la pagina canonica e sono protette da Git e test.
- La rimozione di un redirect storico richiede prima prova di assenza da link, manifest, installazioni PWA e metriche reali.

## Compatibilità Home

Pagina canonica: `home_page.html` → `modules/home/home.js`.

Redirect storici temporanei:

- `home-v126.html`;
- `home-v127.html`;
- `home-v128.html`;
- `home-v129.html`.

I quattro file devono restare redirect statici senza script e senza dipendenze applicative.

## Domini canonici

- autenticazione: `login-v115.html`, `registrati.html`, `reset_password.html`, `imposta_nuova_password.html`;
- Home: `home_page.html`;
- Privato: `area_privata.html`, `account_privati.html`, `form_account_privato.html`, `dettaglio_account_privato.html`, `profilo_privato.html`;
- Azienda: `lista_aziende.html`, `dati_azienda.html`, `modifica_azienda.html`, `account_azienda.html`, `form_account_azienda.html`, `dettaglio_account_azienda.html`;
- Scadenze: `scadenze.html`, `aggiungi_scadenza.html`, `dettaglio_scadenza.html`, `regole_scadenze.html` e le tre configurazioni;
- Impostazioni: `impostazioni.html`, `gestione_destinatari.html`, `archivio_account.html`;
- informative: `privacy.html`, `termini.html`.

Il nome storico `login-v115.html` viene mantenuto finché i flussi di autenticazione e i collegamenti installati non sono migrati con redirect verificato; non autorizza la creazione di nuove varianti.
