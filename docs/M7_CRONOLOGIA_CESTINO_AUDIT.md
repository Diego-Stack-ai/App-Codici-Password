# M7 — Cronologia, cestino e audit

## Contratto

- la cancellazione ordinaria sposta il record in un cestino cifrato senza scadenza automatica;
- il cestino conserva ID, proprietario, revisione e data di archiviazione; il contenuto resta ciphertext;
- il ripristino fallisce se l'ID è occupato e crea una nuova revisione;
- il purge è backend-only, esclusivamente manuale e richiede sempre conferma forte;
- revoca e ripristino non riattivano grant precedenti;
- la cronologia è limitata agli eventi necessari, non a snapshot illimitati;
- l'audit usa un'allowlist e non registra password, chiavi, token, ciphertext o testo libero.

Il laboratorio `experiments/history-recovery` dimostra retention, ripristino senza sovrascrittura, revisione, redazione dei segreti e limite della cronologia. Non modifica la produzione.

## Gate

- [x] conservazione senza scadenza automatica e condizioni di purge manuale definite;
- [x] ripristino senza sovrascrittura silenziosa;
- [x] audit con allowlist e senza segreti;
- [x] cronologia limitata;
- [x] Archivio Account riutilizzato come UI cestino; i nuovi elementi ricevono data e revisione, senza scadenza automatica; anche gli eventuali record con il vecchio `purgeAfter` richiedono la cancellazione manuale;
- [x] Rules candidate verificate e callable atomiche/idempotenti implementate, non distribuite;
- [x] conferma forte della UI collegata alla callable backend `purgeArchivedAccount`, con controllo archivio/revisione, ripresa idempotente, rimozione degli allegati confinata allo UID e scollegamento delle email del Profilo; implementazione locale non ancora distribuita;
- [x] archiviazione e ripristino verificati fisicamente il 09/09/2026 con un account di prova; permanenza e cancellazione definitiva manuale restano da verificare dopo la distribuzione del nuovo contratto.

M7 resta attiva fino all'integrazione verificata.
