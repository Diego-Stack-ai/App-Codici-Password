# Registro delle pagine canoniche

Contratto M3 per distinguere le funzioni reali dai percorsi storici di compatibilità.

## Regola

- Ogni funzione visibile possiede una sola pagina HTML e un solo modulo inizializzatore canonici.
- Nuove pagine con suffissi di versione sono vietate. Le evoluzioni modificano la pagina canonica e sono protette da Git e test.
- Laboratori e redirect storici non appartengono alla superficie pubblica e restano conservati soltanto nell'archivio del repository.

## Compatibilità Home

Pagina canonica: `home_page.html` → `modules/home/home.js`.

Riferimenti storici archiviati in `archive/home-experiments/`:

- `home_confronto.html` e `home_nebbia.html`, con i relativi supporti;
- `home-v126.html`;
- `home-v127.html`;
- `home-v128.html`;
- `home-v129.html`.

Questi file non vengono pubblicati, memorizzati offline o inclusi negli audit delle pagine attive.

## Domini canonici

- autenticazione: `login-v115.html`, `registrati.html`, `reset_password.html`, `imposta_nuova_password.html`;
- Home: `home_page.html`;
- Privato: `area_privata.html`, `account_privati.html`, `form_account_privato.html`, `dettaglio_account_privato.html`, `profilo_privato.html`;
- Azienda: `lista_aziende.html`, `dati_azienda.html`, `modifica_azienda.html`, `account_azienda.html`, `form_account_azienda.html`, `dettaglio_account_azienda.html`;
- Scadenze: `scadenze.html`, `aggiungi_scadenza.html`, `dettaglio_scadenza.html`, `regole_scadenze.html` e le tre configurazioni;
- Impostazioni: `impostazioni.html`, `gestione_destinatari.html`, `archivio_account.html`;
- informative: `privacy.html`, `termini.html`.

Il nome storico `login-v115.html` viene mantenuto finché i flussi di autenticazione e i collegamenti installati non sono migrati con redirect verificato; non autorizza la creazione di nuove varianti.
