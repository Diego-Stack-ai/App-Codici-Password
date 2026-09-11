# M7 — Cronologia, cestino e audit

> **Stato:** contratto candidato/laboratorio; retention di produzione non approvata  
> **Autorità:** contratto specialistico subordinato ad [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md)  
> **Ultima verifica documentale:** 11 settembre 2026

## Contratto

- la cancellazione ordinaria sposta il record in un cestino cifrato;
- la conservazione senza scadenza automatica descritta dal primo laboratorio non è approvata come politica di produzione;
- prima del go-live deve essere definita una retention esplicita, con cancellazione, backup e possibili obblighi legali;
- il cestino conserva ID, proprietario, revisione e data di archiviazione; il contenuto resta ciphertext;
- il ripristino fallisce se l'ID è occupato e crea una nuova revisione;
- il purge è backend-only, esclusivamente manuale e richiede sempre conferma forte;
- revoca e ripristino non riattivano grant precedenti;
- la cronologia è limitata agli eventi necessari, non a snapshot illimitati;
- l'audit usa un'allowlist e non registra password, chiavi, token, ciphertext o testo libero.

Il laboratorio `experiments/history-recovery` dimostra una retention tecnica di prova, ripristino senza sovrascrittura, revisione, redazione dei segreti e limite della cronologia. Non modifica la produzione e non approva una conservazione indefinita.

## Gate

- [x] conservazione senza scadenza automatica e condizioni di purge manuale definite;
- [x] ripristino senza sovrascrittura silenziosa;
- [x] audit con allowlist e senza segreti;
- [x] cronologia limitata;
- [x] Archivio Account riutilizzato come UI cestino; i nuovi elementi ricevono data e revisione, senza scadenza automatica; anche gli eventuali record con il vecchio `purgeAfter` richiedono la cancellazione manuale;
- [x] Rules verificate e callable atomica/idempotente distribuita;
- [x] conferma forte della UI collegata alla callable backend `purgeArchivedAccount`, con controllo archivio/revisione, ripresa idempotente, rimozione degli allegati confinata allo UID e scollegamento delle email del Profilo;
- [x] archiviazione, ripristino, permanenza senza scadenza automatica e cancellazione definitiva manuale verificati fisicamente il 09/09/2026 con account di prova dopo la distribuzione del nuovo contratto.

M7 è completata e certificata il 09/09/2026.


## Decisione aperta sulla retention

La cifratura non rende neutra una conservazione indefinita. Prima di attivare il contratto devono essere definiti durata del cestino, effetto della cancellazione account, propagazione ai backup, eccezioni legali e modalità di purge verificabile. Fino ad allora il laboratorio non autorizza retention o cancellazioni sui dati reali.


## Decisione di retention aperta

Prima dell’attivazione in produzione occorre stabilire:

- durata ordinaria del cestino;
- eliminazione immediata richiesta dall’utente e relative eccezioni legali;
- rapporto tra cestino, cronologia, allegati e backup;
- purge verificabile e idempotente;
- informazione mostrata all’utente;
- prova che il dato non resti raggiungibile nei percorsi applicativi.

La cifratura riduce l’esposizione ma non giustifica la conservazione illimitata.
