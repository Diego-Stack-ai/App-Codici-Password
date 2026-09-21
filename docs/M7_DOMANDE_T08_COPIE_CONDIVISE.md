# M7 — Domande per Diego: copie condivise e inviti dopo il purge (T-08)

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T08.
> **Commit delle prove tecniche:** `0b1a23fe` (banchi, censimento §3.6, riga T-08). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime o alle Rules.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §3.6,
> `tests/shared-copies-purge.emulator.test.mjs` e `tests/shared-copies-purge.test.mjs`.

## Che cosa è stato misurato (per contesto)

Dopo il purge di un Account:

- `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` **restano invariati** e sono
  leggibili **solo dal proprietario** (le Rules li tengono chiusi a chiunque altro);
- l'**invito resta invariato** e il **destinatario continua a leggerlo** (per email): vede
  ancora il **nome** e l'**id dell'Account eliminato**, lo stato della risposta e
  `sharingState: 'suspended'`. Lo stato sospeso è quello scritto **all'archiviazione**, non dal
  purge, e la riattivazione resta un nuovo invito voluto dal proprietario (decisioni già prese,
  misurate e **non** cambiate);
- la **Scadenza condivisa** segue un altro percorso: la copia nel profilo del destinatario
  (`receivedDeadlines`) resta e resta leggibile, l'indice backend `deadlineShares` resta e non è
  leggibile da alcun client;
- **nessun job o percorso** pulisce queste collezioni.

## Domande

1. **Q1 — L'invito che sopravvive al purge.**
   Il destinatario legge ancora l'invito con il nome e l'id dell'Account eliminato. È il
   comportamento voluto (mostra «sospeso/archiviato») o va cambiato? Alternative: (a) lasciarlo
   come oggi; (b) aggiornarlo rimuovendo nome/id dell'Account; (c) revocarlo/eliminarlo al
   purge. In (b) e (c) il destinatario perderebbe la traccia dell'invito.

2. **Q2 — Copie lato proprietario.**
   `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` restano orfani, invisibili e non
   leggibili da altri. Vanno cancellati insieme all'Account, inclusi in un job di pulizia per
   prefisso (D4), o lasciati e dichiarati?

3. **Q3 — Scadenza condivisa prima del purge.**
   La copia nel profilo del destinatario resta leggibile e non dipende dall'Account purgato.
   Va revocata quando il proprietario elimina un Account, o è indipendente (la Scadenza non è
   l'Account) e resta?

4. **Q4 — Indice `deadlineShares`.**
   L'indice backend resta dopo il purge (non è leggibile da alcun client). Va ripulito, o è
   corretto lasciarlo perché serve alla revoca delle copie ricevute?

5. **Q5 — Rapporto con le altre decisioni.**
   Queste voci rientrano nella politica dei residui (D4) o sono autonome? Vanno coordinate con
   le domande sulla cache del dispositivo (D10), sulle copie di consultazione (D11) e sui
   residui di rimozione/cancellazione (D12)?

6. **Q6 — Che cosa vede il destinatario.**
   Serve un testo dedicato quando l'Account condiviso non esiste più (oggi vede lo stato
   sospeso/archiviato)? Se sì, chi approva il testo?

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: runtime e **Rules** sono
**invariati**, nessuna cancellazione è stata introdotta e nessun dato reale è stato letto o
creato. Le prove tecniche sono nel commit `0b1a23fe`; questo documento non le ripete e non le
sostituisce.
