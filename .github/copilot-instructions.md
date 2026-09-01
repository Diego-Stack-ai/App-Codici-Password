# Istruzioni per gli agenti AI

Questo file è soltanto un punto di ingresso per gli strumenti integrati con GitHub. Non deve duplicare le regole del progetto.

Prima di analizzare o modificare il codice, leggere integralmente:

1. `Frontend/GUIDA.md` — fonte unica per architettura, sicurezza, UI, dati e comportamento applicativo.
2. `Frontend/GUIDA_AGGIORNAMENTI.md` — fonte unica per attività aperte, rischi e roadmap.

Struttura essenziale:

- `Frontend/public/` contiene la PWA pubblicata da Firebase Hosting.
- `functions/` contiene le Cloud Functions Firebase e deve rimanere separata dal frontend.
- `scripts/` contiene esclusivamente strumenti di manutenzione ancora in uso.
- `firebase.json`, `firestore.rules` e `firestore.indexes.json` controllano deploy e sicurezza Firebase.

Regole inderogabili:

- Non inventare nuove convenzioni in conflitto con le due guide.
- Non reintrodurre script di importazione, schemi legacy o documentazione duplicata.
- Non esporre credenziali, password, chiavi di servizio o dati personali.
- Non modificare condivisioni, crittografia, Firestore Rules o deploy senza verificare le checklist e le attività P0 documentate.
- Aggiornare `GUIDA.md` quando cambia una regola consolidata; aggiornare `GUIDA_AGGIORNAMENTI.md` quando cambia lo stato di un'attività aperta.
