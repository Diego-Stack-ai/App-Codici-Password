# M7 — Cronologia, cestino e audit

## Contratto

- la cancellazione ordinaria sposta il record in un cestino cifrato per 30 giorni;
- il cestino conserva ID, proprietario, revisione e scadenza; il contenuto resta ciphertext;
- il ripristino fallisce se l'ID è occupato e crea una nuova revisione;
- il purge è backend-only dopo retention o conferma forte;
- revoca e ripristino non riattivano grant precedenti;
- la cronologia è limitata agli eventi necessari, non a snapshot illimitati;
- l'audit usa un'allowlist e non registra password, chiavi, token, ciphertext o testo libero.

Il laboratorio `experiments/history-recovery` dimostra retention, ripristino senza sovrascrittura, revisione, redazione dei segreti e limite della cronologia. Non modifica la produzione.

## Gate

- [x] retention e condizioni di purge definite;
- [x] ripristino senza sovrascrittura silenziosa;
- [x] audit con allowlist e senza segreti;
- [x] cronologia limitata;
- [~] Rules candidate verificate in emulatore; funzioni non ancora collegate;
- [ ] UI cestino e conferma forte integrate;
- [ ] prova su copia non produttiva.

M7 resta attiva fino all'integrazione verificata.
