# Struttura Firestore

## Collezioni Principali

### utenti
- uid
- nome
- cognome
- email
- ruolo
- flags_condiviso
- flags_memorandum

### aziende
- id_azienda
- ragione_sociale
- referente
- contatti
- indirizzo
- partita_iva
- codice_sdi
- numero_cciaa
- note
- flags

### account_privati
- id_account
- uid_utente
- nome_account
- utente
- password
- sito_web
- note
- referente
- telefono
- cellulare
- condiviso
- memorandum
- allegati

### account_azienda
- id_account
- id_azienda
- nome_account
- utente
- password
- sito_web
- note
- referente
- telefono
- cellulare
- condiviso
- memorandum
- allegati

### scadenze
- id_scadenza
- tipo_scadenza
- oggetto_email
- dati
- destinatari
- testo_email
- ultimo_avviso
- condiviso

### allegati
- id_allegato
- id_account
- tipo_allegato
- nome_file
- note
- data_caricamento
