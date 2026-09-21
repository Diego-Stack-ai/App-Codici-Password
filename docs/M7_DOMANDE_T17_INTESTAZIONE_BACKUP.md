# M7 — Domande per Diego: intestazione in chiaro del backup `.cpbackup` (T-17)

> **Stato:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T17.
> **Commit delle prove tecniche:** `f79d2926` (banco, censimento §6.7, riga T-17). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna modifica a formato, compatibilità, export o ripristino.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §6.7 e
> `tests/backup-header-cleartext.test.mjs`.

## Che cosa è stato misurato (per contesto)

Il file `.cpbackup` è una sequenza di righe JSON. La **prima riga è in chiaro** e contiene
**esattamente**: `format`, `schemaVersion` (2), `ownerUid`, `backupId` (UUID casuale per file),
`createdAt` (intero in millisecondi), `kdf` (`PBKDF2-SHA256`, **600.000** iterazioni, salt di
**32 byte**) e `cipher` (`AES-GCM-256-CHAINED`). Tutte le righe successive — record, allegati e
footer — sono buste cifrate con soli `sequence`, `previousDigest`, `iv` e `ciphertext`.

Senza chiave un osservatore ricava: **l'UID del proprietario**, un identificatore casuale del
file, **la data del backup**, il costo e il salt del KDF (utile per un attacco a dizionario
offline sulla Recovery Key), la versione del formato e **quante voci** contiene il file (dal
numero di righe; i conteggi del footer restano cifrati). Non ricava alcun contenuto: né
identificatori dei record, né percorsi Storage, né byte degli allegati, né la Recovery Key.
Il file è **locale** e non viene caricato su Storage o Firestore.

## Domande

1. **Q1 — Che cosa fare dell'intestazione in chiaro.**
   (a) Accettarla e **dichiararla** all'utente; (b) **ridurla** (es. togliere `ownerUid`,
   sostituire la data con un valore grossolano, id opaco); (c) lasciarla com'è ma mostrare un
   **avviso** al momento dell'export. Quale?

2. **Q2 — Compatibilità se si riduce.**
   `deriveBackupKey` **verifica** `header.ownerUid === ownerUid` e i parametri KDF
   (`backup-crypto.js:37-44,63-72`): togliere o cambiare quei campi rompe la derivazione della
   chiave e i file già esportati. Una riduzione deve quindi prevedere un nuovo `schemaVersion` e
   un percorso di ripristino per i file vecchi, oppure è esclusa a priori?

3. **Q3 — Numero di voci deducibile.**
   Il numero di record e allegati si ricava dal numero di righe. Va nascosto (padding) o è
   accettabile, dato che il file resta locale e la sua dimensione è comunque osservabile?

4. **Q4 — Rapporto con D5 e D6.**
   L'intestazione in chiaro entra nella decisione **D5** (backup e ricevute fuori dal perimetro
   di cancellazione) o è una voce autonoma? Il testo eventualmente mostrato all'utente ricade in
   **D6** (chi approva i testi)?

5. **Q5 — Trasparenza.**
   Serve una dichiarazione esplicita che il file contiene in chiaro UID, data e parametri di
   cifratura? Se sì, dove (avviso all'export, guida, informativa privacy) e con quale testo?

## Nota di perimetro

Nessuna di queste domande modifica il formato attuale: export e ripristino sono **invariati**,
nessuna compatibilità è stata toccata e nessun backup reale è stato letto o creato. Le prove
tecniche sono nel commit `f79d2926`; questo documento non le ripete e non le sostituisce.
