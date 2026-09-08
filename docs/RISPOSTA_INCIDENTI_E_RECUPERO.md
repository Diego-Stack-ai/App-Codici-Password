# Risposta agli incidenti e recupero

## Priorità

Proteggere i dati e impedire nuove modifiche viene prima del ripristino del servizio. Non inserire mai password, Master Password, Vault Key, Recovery Key, token, allegati o contenuti decifrati in ticket, screenshot, log o chat.

## Procedura

1. interrompere deploy e migrazioni; annotare versione, orario, dispositivo e azione tecnica senza dati personali;
2. se sono coinvolti accessi, revocare sessioni e ruotare le credenziali amministrative pertinenti;
3. se sono coinvolte Rules o Functions, ripristinare l'ultima versione verificata e conservare le evidenze tecniche;
4. lavorare su una copia isolata; verificare integrità e proprietario prima di importare un backup;
5. ripristinare prima in staging, confrontare conteggi e digest, poi applicare in transazione;
6. verificare login, sblocco, lettura, scrittura, condivisione, offline e recupero su due dispositivi;
7. documentare causa, impatto, correzione e prevenzione prima di riaprire la pubblicazione.

Un backup non verificato non deve mai sovrascrivere il Vault attivo. In assenza della Recovery Key non si promette il recupero dei dati cifrati.
