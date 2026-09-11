# Istruzioni per gli agenti AI

> **Stato:** attivo  
> **Autorità:** punto di ingresso per gli strumenti integrati con GitHub  
> **Ultima verifica:** 11 settembre 2026

Questo file indica l’ordine di lettura. Non duplica le regole del progetto.

Prima di analizzare o modificare il codice, leggere integralmente:

1. [`docs/GUIDA_PROGETTO.md`](../docs/GUIDA_PROGETTO.md) — indice, gerarchia e mappa delle fonti;
2. [`docs/ARCHITETTURA_SICUREZZA_V1.md`](../docs/ARCHITETTURA_SICUREZZA_V1.md) — baseline vincolante per sicurezza e dati;
3. [`Frontend/GUIDA.md`](../Frontend/GUIDA.md) — regole consolidate di implementazione e UI;
4. [`Frontend/GUIDA_AGGIORNAMENTI.md`](../Frontend/GUIDA_AGGIORNAMENTI.md) — attività aperte, rischi e roadmap;
5. il contratto specialistico dell’area interessata, individuato tramite la Guida progetto.

Regole obbligatorie:

- verificare codice, test, `firebase.json`, `firestore.rules`, `storage.rules`, indici e Functions; un MD non certifica il runtime;
- distinguere sempre stato reale, target, laboratorio e storico;
- non reintrodurre script di importazione, schemi legacy o documentazione duplicata;
- non modificare condivisioni, crittografia, chiavi, Rules, Functions, dati reali o deploy senza checklist, test, rollback e approvazione esplicita;
- non inserire segreti, token, dati personali o contenuti del Vault in commit, log, screenshot o report;
- preservare i fallback legacy finché inventario e migrazione non sono approvati;
- aggiornare il contratto interessato nello stesso lavoro che cambia una regola consolidata;
- aggiornare `GUIDA_AGGIORNAMENTI.md` quando cambia lo stato di un’attività;
- archiviare o marcare come storico un documento superato: non lasciarlo apparentemente autorevole;
- in caso di conflitto documentale prevale la gerarchia definita in `docs/GUIDA_PROGETTO.md`.
