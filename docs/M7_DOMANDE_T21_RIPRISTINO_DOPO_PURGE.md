# M7 — Domande per Diego: ripristino di un backup dopo il purge (T-21)

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T21.
> **Commit delle prove tecniche:** `684f4fef` (banco, censimento §6.8, riga T-21). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna modifica a formato, import, export, politica o runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §6.8 e
> `tests/purged-account-restore.emulator.test.mjs`.

## Che cosa è stato misurato (per contesto)

Esportando un backup mentre un Account è **archiviato** e poi **purgandolo**, il ripristino
dello stesso file **ricrea** l'Account con i valori del backup (`isArchived: true`, revisione e
campi cifrati com'erano), ricrea il metadato dell'allegato, **ricarica i byte** dell'allegato al
percorso finale e riporta i **riferimenti** in Profilo e Azienda al valore del backup — cioè
**annulla la pulizia dei riferimenti** fatta dal purge. La ricevuta di purge resta `purged`: una
ripetizione del purge con lo **stesso** `operationId` risponde `duplicate` e l'Account ricreato
resta, mentre con un `operationId` **nuovo** il purge funziona di nuovo. Un backup **non** si
applica sotto un proprietario diverso (`BACKUP_OWNER_MISMATCH`) e i percorsi dei record sono
derivati dall'UID autenticato.

## Domande

1. **Q1 — Il ripristino deve poter ricreare un Account purgato?**
   (a) **Sì**, come oggi: il backup è una copia dell'utente e prevale sul purge;
   (b) **no**: il ripristino salta i record degli Account la cui ricevuta di purge esiste;
   (c) **sì ma con avviso**: prima di applicare, l'utente vede quanti Account eliminati
   definitivamente verrebbero ricreati. Quale?

2. **Q2 — Se si sceglie (b): che cosa mostrare?**
   L'utente deve capire perché alcuni elementi del file non vengono ripristinati. Serve un
   elenco («N Account eliminati definitivamente, non ripristinati») e un'azione alternativa
   (annullare l'operazione)? Chi approva il testo (D6)?

3. **Q3 — Riferimenti.**
   Il ripristino riporta i riferimenti di Profilo e Azienda al valore del backup, annullando la
   pulizia del purge. È voluto o va evitato (riferimenti ricreati solo se l'Account è
   effettivamente ripristinato)?

4. **Q4 — Allegati.**
   I byte vengono ricaricati al percorso finale. Se l'oggetto esiste già (purge parziale o
   ripristino ripetuto) va sovrascritto, saltato o confrontato (digest/contenuto)? Il file
   contiene i byte, quindi il confronto è possibile senza toccare altro.

5. **Q5 — Ricevuta di purge e nuovo stato.**
   Dopo il ripristino la ricevuta di purge resta `purged` mentre l'Account esiste di nuovo: è
   accettabile (ogni purge futuro richiede un `operationId` nuovo), va invalidata, o va
   annotata una «rinascita» dell'Account?

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: export, import, formato,
compatibilità e runtime sono **invariati**; nessun backup o dato reale è stato letto o creato.
Le prove tecniche sono nel commit `684f4fef`; questo documento non le ripete e non le
sostituisce.
