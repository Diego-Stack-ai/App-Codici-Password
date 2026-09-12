# Politica dei conflitti e delle scritture offline

> **Stato:** requisiti attivi, adozione per dominio secondo M6.
> **Autorità:** contratto specialistico; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** revisioni e mutazioni offline.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

Contratto introdotto in M2 e applicato progressivamente da M6. Alla v1.2.110 il cutover riguarda Account e memorandum privati isolati; i gate di M6 restano vincolanti per gli altri domini. Questo documento non autorizza nuove attivazioni né certifica la consultazione offline completa.

## Regole obbligatorie

1. Ogni entità modificabile deve avere `schemaVersion`, `revision` e `updatedAt` assegnati o verificati dal backend.
2. Una mutazione offline deve avere un `operationId` casuale e stabile, così un nuovo invio non duplica l'operazione.
3. La coda locale deve contenere soltanto payload cifrati quando include dati della Vault.
4. L'aggiornamento può essere applicato automaticamente soltanto se la revisione remota coincide con la revisione di partenza della mutazione.
5. Se entrambe le copie hanno cambiato lo stesso record, l'app non usa silenziosamente “ultimo salvataggio vince”. Registra un conflitto e chiede una scelta comprensibile all'utente.
6. Le cancellazioni sono tombstone revisionate finché termina il periodo di recupero; non sono rimozioni locali immediate non tracciate.
7. Due schede dello stesso dispositivo coordinano una sola coda tramite lock e messaggi tra contesti.
8. Logout, cambio utente e revoca dispositivo eliminano chiavi e coda decifrabile appartenenti all'utente precedente.
9. Email, Push e altre azioni esterne partono dal backend una sola volta dopo l'accettazione della mutazione, mai direttamente dalla coda locale.
10. Allegati richiedono un protocollo separato con hash, caricamento riprendibile e commit del metadato soltanto dopo verifica.

## Stati minimi

- `synced`: revisione locale uguale alla remota;
- `pending`: mutazione cifrata in attesa;
- `syncing`: invio in corso con lease breve;
- `conflict`: revisione remota divergente;
- `failed`: errore permanente o intervento necessario.

## Strategia iniziale M6

- Creazioni: ID generato prima del salvataggio e operazione idempotente.
- Modifiche: controllo `baseRevision` in transazione.
- Cancellazioni: tombstone recuperabile.
- Conflitti: confronto dei campi non sensibili e scelta tra copia locale/remota; i segreti non entrano nei log.
- Operazioni indipendenti su record diversi possono procedere; quelle sullo stesso record restano ordinate.

## Gate prima dell'attivazione

- test modalità aereo, chiusura forzata, doppia scheda e due dispositivi;
- test retry e duplicazione della stessa richiesta;
- test logout/cambio UID;
- test conflitto modifica-modifica e modifica-cancellazione;
- rollback documentato e nessuna modifica dello schema produttivo senza lettore retrocompatibile.
