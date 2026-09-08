# M8 — Backup e recupero

## Contratto

Il backup è un file cifrato, autenticato e versionato. L'intestazione espone soltanto formato, versione, proprietario, data e parametri crittografici; dati, record, allegati e metadati funzionali restano nel ciphertext. La Recovery Key è casuale, distinta dalla Master Password e mostrata una sola volta; l'app non può recuperarla.

Il laboratorio usa 192 bit casuali, PBKDF2-SHA256 a 600.000 iterazioni e AES-GCM-256 con intestazione autenticata. Prima di scrivere dati, l'importazione valida formato, versione, proprietario e autenticità. Il ripristino definitivo dovrà usare staging, confronto e transazione, mai sovrascrivere direttamente il Vault attivo.

Emergency Access è separato: richiederebbe delegato, attesa, revoca e consenso verificabile. Non viene abilitato implicitamente dalla Recovery Key.

## Gate

- [x] formato cifrato e versionato;
- [x] integrità e manomissione verificate automaticamente;
- [x] Recovery Key distinta progettata e testata;
- [x] identità proprietario vincolata al contenitore;
- [x] Emergency Access separato esplicitamente;
- [x] manifest allegati con riferimenti, dimensioni e digest verificati nel laboratorio;
- [x] importazione isolata in staging e piano transazionale con blocco collisioni nel laboratorio;
- [x] contratto backend dei chunk di ripristino: allowlist delle collezioni, percorsi costruiti dallo UID autenticato, limiti per record/chunk, collisioni e idempotenza verificati;
- [ ] esportazione streaming integrata con gli allegati reali;
- [ ] ripristino transazionale integrato nel backend;
- [ ] collaudo fisico esporta/cancella/ripristina su copia non produttiva.

M8 resta attiva fino alla prova reale di ripristino.
