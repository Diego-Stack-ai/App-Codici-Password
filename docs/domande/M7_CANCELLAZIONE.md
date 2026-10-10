# M7 cancellazione

> Aggiornamento locale 10/10/2026: T-08 non descrive più il comportamento candidato corrente. La cascata del purge rimuove ora widget, dati/link condivisi e inviti riferiti esattamente all'Account; Scadenze e copie autonome restano fuori perimetro. Emulatori 2/2, sorgente T-08 5/5 e Functions/security 444 pass, 9 skip dichiarati, zero fail. Il fence copre anche gli upload e le cancellazioni client Storage: suite Storage principali 14/14 e condivisione 5/5. Il testo storico sotto resta come provenienza. Il motore generale rimane hard-off per il canary distribuito e i gate esterni non ancora conclusi.

> Rollout controllato 09/10/2026: il percorso pubblicato è stato aperto esclusivamente all'account sintetico di collaudo e provato fino all'archivio vuoto. Gli utenti reali restano bloccati. Il risultato valida il caso nominale, non elimina i rischi concorrenti documentati e non autorizza uno sblocco generale.

> Chiusura operativa 09/10/2026: le domande storiche restano conservate come evidenza, ma non sono più attività del ciclo corrente. Purge automatico disabilitato; eventuale riapertura richiede un nuovo incarico e prove reali.

**Aggiornamento 27/09/2026:** risposte consolidate 1A/1B/2B/3A/3B/3C in DECISIONI precisano conflitti, ultima archiviazione, avviso interno, backup dopo purge, residui, blocco Azienda con Account e scadenze derivate/autonome. Le domande storiche sotto restano come provenienza, non da riproporre dove già coperte. Restano D8, cache/logout e gli altri aspetti non compresi esplicitamente nelle risposte; nessuna scelta implicita o implementazione certificata.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Stato delle decisioni collegate

D1: richiesta politica due anni/avviso dieci giorni, non attiva. D2: cancellazione immediata manuale confermata, testi e prove residui. D3: audit a 24 mesi e scrittura client rimossa nel ramo, distribuzione separata. D4/orientamento D14: cascata sulle copie derivate controllate dall’app, con residui D5/D10/D11 e Scadenze derivate/indipendenti. D8 rinviata. Le altre questioni non diventano decise per deduzione.

La raccolta T08 va letta insieme alla decisione D4/D14: non riproporre come totalmente assente una direzione già registrata, né chiudere automaticamente tutte le sue domande. Fonte: [DECISIONI](../progetto/DECISIONI.md). Per D1–D16 originali consultare [INVENTARI](../evidenze/INVENTARI.md); questa raccolta conserva i quesiti specialistici.

## Indice delle fonti conservate

- [M7_DOMANDE_T08_COPIE_CONDIVISE.md](#fonte-docs-m7-domande-t08-copie-condivise-md-l1)
- [M7_DOMANDE_T17_INTESTAZIONE_BACKUP.md](#fonte-docs-m7-domande-t17-intestazione-backup-md-l1)
- [M7_DOMANDE_T21_RIPRISTINO_DOPO_PURGE.md](#fonte-docs-m7-domande-t21-ripristino-dopo-purge-md-l1)
- [M7_DOMANDE_T23_CACHE_DISPOSITIVO.md](#fonte-docs-m7-domande-t23-cache-dispositivo-md-l1)
- [M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md](#fonte-docs-m7-domande-t24-copie-consultazione-md-l1)
- [M7_DOMANDE_T26_RESIDUI_RIMOZIONE.md](#fonte-docs-m7-domande-t26-residui-rimozione-md-l1)
- [M7_DOMANDE_T27_HARD_DELETE.md](#fonte-docs-m7-domande-t27-hard-delete-md-l1)

<a id="fonte-docs-m7-domande-t08-copie-condivise-md-l1"></a>

## Fonte: M7_DOMANDE_T08_COPIE_CONDIVISE.md — righe originali 1–62

> Provenienza: `docs/M7_DOMANDE_T08_COPIE_CONDIVISE.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m7-domande-t08-copie-condivise-md-m7--domande-per-diego-copie-condivise-e-inviti-dopo-il-purge-t-08"></a>

## M7 — Domande per Diego: copie condivise e inviti dopo il purge (T-08)

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T08.
> **Commit delle prove tecniche:** `0b1a23fe` (banchi, censimento §3.6, riga T-08). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime o alle Rules.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §3.6,
> `tests/shared-copies-purge.emulator.test.mjs` e `tests/shared-copies-purge.test.mjs`.

<a id="fonte-docs-m7-domande-t08-copie-condivise-md-che-cosa-è-stato-misurato-per-contesto"></a>

### Che cosa è stato misurato (per contesto)

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

<a id="fonte-docs-m7-domande-t08-copie-condivise-md-domande"></a>

### Domande

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

<a id="fonte-docs-m7-domande-t08-copie-condivise-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: runtime e **Rules** sono
**invariati**, nessuna cancellazione è stata introdotta e nessun dato reale è stato letto o
creato. Le prove tecniche sono nel commit `0b1a23fe`; questo documento non le ripete e non le
sostituisce.

<a id="fonte-docs-m7-domande-t17-intestazione-backup-md-l1"></a>

## Fonte: M7_DOMANDE_T17_INTESTAZIONE_BACKUP.md — righe originali 1–55

> Provenienza: `docs/M7_DOMANDE_T17_INTESTAZIONE_BACKUP.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m7-domande-t17-intestazione-backup-md-m7--domande-per-diego-intestazione-in-chiaro-del-backup-cpbackup-t-17"></a>

## M7 — Domande per Diego: intestazione in chiaro del backup `.cpbackup` (T-17)

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T17.
> **Commit delle prove tecniche:** `f79d2926` (banco, censimento §6.7, riga T-17). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna modifica a formato, compatibilità, export o ripristino.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §6.7 e
> `tests/backup-header-cleartext.test.mjs`.

<a id="fonte-docs-m7-domande-t17-intestazione-backup-md-che-cosa-è-stato-misurato-per-contesto"></a>

### Che cosa è stato misurato (per contesto)

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

<a id="fonte-docs-m7-domande-t17-intestazione-backup-md-domande"></a>

### Domande

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

<a id="fonte-docs-m7-domande-t17-intestazione-backup-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il formato attuale: export e ripristino sono **invariati**,
nessuna compatibilità è stata toccata e nessun backup reale è stato letto o creato. Le prove
tecniche sono nel commit `f79d2926`; questo documento non le ripete e non le sostituisce.

<a id="fonte-docs-m7-domande-t21-ripristino-dopo-purge-md-l1"></a>

## Fonte: M7_DOMANDE_T21_RIPRISTINO_DOPO_PURGE.md — righe originali 1–58

> Provenienza: `docs/M7_DOMANDE_T21_RIPRISTINO_DOPO_PURGE.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m7-domande-t21-ripristino-dopo-purge-md-m7--domande-per-diego-ripristino-di-un-backup-dopo-il-purge-t-21"></a>

## M7 — Domande per Diego: ripristino di un backup dopo il purge (T-21)

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T21.
> **Commit delle prove tecniche:** `684f4fef` (banco, censimento §6.8, riga T-21). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna modifica a formato, import, export, politica o runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §6.8 e
> `tests/purged-account-restore.emulator.test.mjs`.

<a id="fonte-docs-m7-domande-t21-ripristino-dopo-purge-md-che-cosa-è-stato-misurato-per-contesto"></a>

### Che cosa è stato misurato (per contesto)

Esportando un backup mentre un Account è **archiviato** e poi **purgandolo**, il ripristino
dello stesso file **ricrea** l'Account con i valori memorizzati identici (`isArchived: true` e
revisione inclusi; il banco usa marcatori sintetici, non ciphertext reali), ricrea il metadato
dell'allegato, **ricarica i byte** dell'allegato al
 percorso finale e riporta i **riferimenti** in Profilo e Azienda al valore del backup — cioè
**annulla la pulizia dei riferimenti** fatta dal purge. La ricevuta di purge resta `purged`: una
ripetizione del purge con lo **stesso** `operationId` risponde `duplicate` e l'Account ricreato
resta, mentre con un `operationId` **nuovo** il purge funziona di nuovo. Il **file prodotto**
non si apre sotto un proprietario diverso — il primo passo del flusso di import valida
`ownerUid` nell'intestazione — e la callable **rifiuta** una richiesta con proprietario atteso
diverso (`BACKUP_OWNER_MISMATCH`); con l'utente coerente i percorsi dei record sono derivati
dall'UID autenticato.

<a id="fonte-docs-m7-domande-t21-ripristino-dopo-purge-md-domande"></a>

### Domande

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

<a id="fonte-docs-m7-domande-t21-ripristino-dopo-purge-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: export, import, formato,
compatibilità e runtime sono **invariati**; nessun backup o dato reale è stato letto o creato.
Le prove tecniche sono nel commit `684f4fef`; questo documento non le ripete e non le
sostituisce.

<a id="fonte-docs-m7-domande-t23-cache-dispositivo-md-l1"></a>

## Fonte: M7_DOMANDE_T23_CACHE_DISPOSITIVO.md — righe originali 1–69

> Provenienza: `docs/M7_DOMANDE_T23_CACHE_DISPOSITIVO.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m7-domande-t23-cache-dispositivo-md-m7--domande-per-diego-cache-del-dispositivo-t-23"></a>

## M7 — Domande per Diego: cache del dispositivo (T-23)

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T23.
> **Commit delle prove tecniche:** `2422e0b1` (banco, censimento §6.5, riga T-23). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §6.5 e `tests/device-cache-residues.test.mjs`.

<a id="fonte-docs-m7-domande-t23-cache-dispositivo-md-che-cosa-è-stato-verificato-per-contesto"></a>

### Che cosa è stato verificato (per contesto)

Dopo un **logout** il client azzera soltanto la sessione Vault in `sessionStorage`. Restano
materialmente sul dispositivo: `localStorage` (envelope e verifier cifrati del Vault, URL
avatar, tema, ambiti push, marcatore offline con TTL valutato alla lettura), la **cache
persistente Firestore** in IndexedDB (documenti sincronizzati: campi cifrati **e** metadati
leggibili), la **coda offline** in IndexedDB (operazioni sigillate AES-GCM), la **Cache
Storage** della shell PWA (solo risorse stessa-origine; nessuna risposta di backend) e le
bozze utente in `sessionStorage` della stessa scheda. Dopo il **purge** di un Account non
esiste alcun percorso client che evacui la cache locale: il client invoca la callable del
backend e non tocca IndexedDB, Cache Storage o `localStorage`.

Nessuna primitiva distruttiva (`clearIndexedDbPersistence`, `indexedDB.deleteDatabase`,
`localStorage.clear`, `sessionStorage.clear`) esiste nel runtime del client; `caches.delete`
compare solo nel service worker, per le proprie versioni di shell non correnti.

<a id="fonte-docs-m7-domande-t23-cache-dispositivo-md-domande"></a>

### Domande

1. **Q1 — Che cosa deve sparire al logout?**
   Oggi: solo la sessione Vault (RAM + `sessionStorage`), con blocco del gate e marcatore di
   diniego. Alternative: (a) lasciare tutto com'è (attuale); (b) svuotare anche la cache
   Firestore locale e la Cache Storage al logout; (c) svuotare soltanto i metadati leggibili
   della cache Firestore. Quale comportamento vuoi? (b) rende l'app inutilizzabile offline
   dopo ogni logout; (c) è più costoso da realizzare di (b).

2. **Q2 — Che cosa deve sparire dopo il purge di un Account?**
   Oggi: nulla sul dispositivo. Alternative: (a) nessuna azione locale (attuale);
   (b) il client evacua dalla cache locale i documenti dell'Account purgato dopo l'esito
   `purged`; (c) un comando di pulizia locale separato, esplicito per l'utente
   («rimuovi le copie locali»). Quale?

3. **Q3 — Residui cifrati: vanno trattati come dato da cancellare o come dato protetto?**
   La coda offline contiene operazioni **sigillate** con la Vault Key, e `localStorage`
   contiene l'envelope cifrato della chiave Vault. Sono dati materialmente presenti ma
   inutilizzabili senza la Master Password. Vanno cancellati al logout comunque, oppure
   dichiarati come copie cifrate ammesse?

4. **Q4 — Bozze utente in `sessionStorage`.**
   Le bozze (`profile-account-link-draft`, `profile-deadline-link-draft`,
   `pending_deadline_link`) sopravvivono al logout nella stessa scheda. Vanno azzerate al
   logout o è accettabile che restino finché la scheda è aperta?

5. **Q5 — Trasparenza verso l'utente.**
   Serve un'informazione esplicita («i dati restano su questo dispositivo finché non esci e
   non svuoti i dati del browser»)? Se sì, chi approva il testo?

6. **Q6 — Rapporto con D4/D5 del censimento.**
   La pulizia della cache locale è parte della politica dei residui (D4: oggetti e copie
   residue) o è una voce separata? La cancellazione locale deve essere **automatica**,
   **proposta** all'utente o **documentata soltanto**?

7. **Q7 — Prova richiesta.**
   La verifica attuale è di livello codice con archivi simulati (nessun browser). Per
   dichiarare la politica «verificata» è sufficiente, oppure serve una prova su browser
   sintetico/emulato (IndexedDB e Cache API reali) prima della decisione?

<a id="fonte-docs-m7-domande-t23-cache-dispositivo-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: il runtime è **invariato** e
nessuna cancellazione della cache è stata introdotta. Le prove tecniche sono nel commit
`2422e0b1`; questo documento non le ripete e non le sostituisce.

<a id="fonte-docs-m7-domande-t24-copie-consultazione-md-l1"></a>

## Fonte: M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md — righe originali 1–66

> Provenienza: `docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m7-domande-t24-copie-consultazione-md-m7--domande-per-diego-copie-di-consultazione-t-24"></a>

## M7 — Domande per Diego: copie di consultazione (T-24)

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T24.
> **Commit delle prove tecniche:** `9ae8445a` (banco, censimento §6.6, riga T-24). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §6.6 e `tests/consultation-copies.test.mjs`.

<a id="fonte-docs-m7-domande-t24-copie-consultazione-md-che-cosa-è-stato-verificato-per-contesto"></a>

### Che cosa è stato verificato (per contesto)

I due report dell'app sono **solo in memoria**: il report «salute credenziali» non produce file
e azzera i risultati quando il modale si chiude, e non mostra mai una password; il report «uso
dei campi» esclude gli Account archiviati (contandoli) e non usa Blob, download o archivi
locali. Le copie che invece **escono dall'app** sono file dell'utente: il backup `.cpbackup` e
le vCard `.vcf` (profilo, contatto aziendale, tessera ricevuta), oltre a tutto ciò che l'utente
salva per conto proprio (screenshot, stampa, PDF esterni). L'app non conserva alcun handle di
quei file e non esiste alcun percorso che li ritiri.

Dopo il **purge** di un Account: un export o un report **nuovo** che legge le sorgenti
confermate non contiene più quell'Account; un report rigenerato **dalla cache locale**
(offline, o quando la lettura confermata non risponde) **può** ancora contenerlo; un file già
esportato prima del purge resta per definizione. Non esistono export Excel, PDF o di stampa
nell'app distribuita: l'unica proiezione Excel è di laboratorio e non è montata.

<a id="fonte-docs-m7-domande-t24-copie-consultazione-md-domande"></a>

### Domande

1. **Q1 — Copie già esportate.**
   Che cosa ci si aspetta dall'app per un `.cpbackup` o una `.vcf` già scaricati prima del
   purge? (a) nulla: file dell'utente, fuori perimetro; (b) un avviso al momento dell'export
   («questa copia non sarà cancellabile dal servizio»); (c) una dichiarazione nel testo di
   privacy/termini. Quale?

2. **Q2 — Un avviso al momento del purge.**
   Quando l'utente elimina definitivamente un Account, la UI deve ricordare che le copie
   esportate e i file salvati restano? Se sì, chi approva il testo?

3. **Q3 — Rigenerazione dalla cache.**
   Un report rigenerato offline può ancora includere un Account purgato, perché legge la cache
   locale. Va (a) accettato e documentato, (b) bloccato (il report richiede la connessione),
   o (c) segnalato all'utente («dati da copia locale, potenzialmente non aggiornati»)?

4. **Q4 — Copie di consultazione dell'app: conferma del «solo memoria».**
   Confermi che i report dell'app devono restare **solo in memoria** (nessun export, nessuna
   stampa, nessun salvataggio), oppure in futuro servirà un export esplicito — con quali
   contenuti e con quali mascheramenti?

5. **Q5 — Excel/PDF.**
   L'assenza di export Excel/PDF/stampa è una scelta definitiva o una funzione prevista? Se
   prevista, va progettata con mascheramento dei campi sensibili come nella proiezione di
   laboratorio?

6. **Q6 — Rapporto con D4/D5 e con le domande della cache (D10).**
   Le copie di consultazione rientrano nella politica dei residui (D4) e nella dichiarazione
   sui backup (D5), oppure sono una voce autonoma? La cancellazione/avviso deve essere
   **automatica**, **proposta** all'utente o **documentata soltanto**?

7. **Q7 — Diagnostica prestazioni.**
   I campioni della diagnostica prestazioni restano in `localStorage` finché non vengono
   cancellati esplicitamente. Vanno cancellati al logout (come chiesto per la cache in D10) o
   è accettabile che restino?

<a id="fonte-docs-m7-domande-t24-copie-consultazione-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: il runtime è **invariato**,
nessuna cancellazione è stata introdotta e nessun file reale è stato creato o letto. Le prove
tecniche sono nel commit `9ae8445a`; questo documento non le ripete e non le sostituisce.

<a id="fonte-docs-m7-domande-t26-residui-rimozione-md-l1"></a>

## Fonte: M7_DOMANDE_T26_RESIDUI_RIMOZIONE.md — righe originali 1–57

> Provenienza: `docs/M7_DOMANDE_T26_RESIDUI_RIMOZIONE.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m7-domande-t26-residui-rimozione-md-m7--domande-per-diego-residui-alla-rimozione-di-righe-e-scadenze-t-26"></a>

## M7 — Domande per Diego: residui alla rimozione di righe e Scadenze (T-26)

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T26.
> **Commit delle prove tecniche:** `7bb622b6` (banchi, censimento §5.9, riga T-26). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §5.9,
> `tests/attachment-removal-residues.test.mjs` e `tests/attachment-removal-residues.emulator.test.mjs`.

<a id="fonte-docs-m7-domande-t26-residui-rimozione-md-che-cosa-è-stato-verificato-per-contesto"></a>

### Che cosa è stato verificato (per contesto)

Togliendo una riga dall'array `allegati` di un'Azienda o dall'array `attachments` di una
Scadenza, il riferimento sparisce al salvataggio ma **i byte restano** nello Storage: nessuno
dei due percorsi chiama primitive di cancellazione. Anche cancellando una **Scadenza** con
allegati il documento viene eliminato (transazionalmente, se collegata a un documento del
profilo) mentre gli oggetti restano. L'unico percorso che elimina i byte è l'**allegato di un
Account** nella sottocollezione `attachments` (verificato in M7-T15). In `saveDeadline`
l'upload precede la scrittura del documento e non esiste compensazione: se la scrittura
fallisce, l'oggetto appena caricato resta senza riferimento (provato su Emulator).

<a id="fonte-docs-m7-domande-t26-residui-rimozione-md-domande"></a>

### Domande

1. **Q1 — Rimozione di una riga da un array.**
   Quando l'utente toglie una riga e salva, i byte vanno (a) lasciati come oggi, (b) cancellati
   subito dal client, o (c) cancellati da un job di pulizia per prefisso? Se (b): l'app deve
   cancellare **prima** o **dopo** la scrittura del documento? Cancellare prima rischia di
   lasciare una riga che punta a un oggetto assente se il salvataggio fallisce; cancellare dopo
   richiede di ricordare quali percorsi sono stati rimossi fino all'esito.

2. **Q2 — Cancellazione di una Scadenza con allegati.**
   Gli allegati della Scadenza vanno cancellati insieme al documento? Anche qui: prima della
   cancellazione (rischio: Scadenza non cancellata e allegati perduti) o dopo (rischio: orfani
   se la seconda operazione fallisce)? O si preferisce un inventario per prefisso
   `users/{uid}/scadenze/{id}/` trattato da un job?

3. **Q3 — Errore parziale.**
   Se la scrittura fallisce dopo l'upload, l'oggetto resta orfano. Va introdotta una
   **compensazione immediata** (cancellare l'oggetto appena caricato nel percorso di errore)
   oppure lasciare la pulizia al job per prefisso previsto da D4?

4. **Q4 — Rapporto con D4.**
   I residui qui descritti rientrano in **un'unica** politica dei residui (inventario per
   prefisso + pulizia, D4) o servono regole distinte per percorso (Account, Azienda
   `aziende_allegati`, Scadenze, avatar)? La scelta cambia il costo e il rischio di ogni
   percorso.

5. **Q5 — Prefissi da coprire.**
   Il prefisso `users/{uid}/aziende_allegati/` (allegati del form Azienda) e
   `users/{uid}/scadenze/{id}/` (allegati delle Scadenze) contengono oggi oggetti non
   referenziati. Il purge degli Account (§3.4) **non** li raggiunge: vanno inclusi in una
   futura pulizia per prefisso o dichiarati fuori perimetro?

<a id="fonte-docs-m7-domande-t26-residui-rimozione-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: il runtime è **invariato**,
nessuna cancellazione è stata introdotta e nessun dato reale è stato letto o creato. Le prove
tecniche sono nel commit `7bb622b6`; questo documento non le ripete e non le sostituisce.

<a id="fonte-docs-m7-domande-t27-hard-delete-md-l1"></a>

## Fonte: M7_DOMANDE_T27_HARD_DELETE.md — righe originali 1–67

> Provenienza: `docs/M7_DOMANDE_T27_HARD_DELETE.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m7-domande-t27-hard-delete-md-m7--domande-per-diego-residui-dellhard-delete-di-azienda-e-account-aziendale-t-27"></a>

## M7 — Domande per Diego: residui dell'hard-delete di Azienda e Account aziendale (T-27)

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 21/09/2026 dopo la verifica M7-T27.
> **Commit delle prove tecniche:** `d2eef964` (banchi, censimento §3.5, riga T-27). Questo
> documento è volutamente in un **commit separato**: raccoglie **solo** le domande e non
> introduce alcuna politica, alcuna cancellazione e alcuna modifica al runtime.
> **Contesto tecnico:** `docs/M7_RETENTION_CENSIMENTO.md` §3.5,
> `tests/company-hard-delete-residues.test.mjs` e `tests/company-hard-delete-residues.emulator.test.mjs`.

<a id="fonte-docs-m7-domande-t27-hard-delete-md-che-cosa-è-stato-verificato-per-contesto"></a>

### Che cosa è stato verificato (per contesto)

Esistono **due percorsi diversi**:

- **Azienda cancellata dal client** (`deleteCompany` e la form): un solo `deleteDoc` sul
  documento Azienda, **non ricorsivo**. Restano gli Account aziendali con i loro metadati
  (`aziende/{cid}/accounts/**`), i byte Storage sotto
  `users/{uid}/aziende/{cid}/accounts/{aid}/attachments/**`, gli allegati del form Azienda
  (`users/{uid}/aziende_allegati/**`) e i riferimenti nei contatti del Profilo, che ora
  puntano a un'Azienda inesistente. Nella UI quegli Account non sono più raggiungibili
  (l'elenco parte dalle Aziende).
- **Account aziendale eliminato dal purge backend**: ricorsivo sul documento e sulla
  sottocollezione, cancella i byte **elencati** nei metadati (un oggetto non elencato resta),
  ripulisce **solo** la coppia esatta `(accountId, companyId)` nei riferimenti e lascia intatto
  l'Account con lo **stesso id** in un'altra Azienda, byte compresi. Il purge, però, si applica
  a un Account **archiviato** e non raggiunge mai `aziende_allegati`.

<a id="fonte-docs-m7-domande-t27-hard-delete-md-domande"></a>

### Domande

1. **Q1 — Cancellare l'Azienda deve cancellare anche i suoi Account?**
   Oggi no: restano documenti, metadati e byte, invisibili nella UI. Alternative: (a) lasciare
   come oggi e dichiararlo; (b) cancellare in cascata gli Account dell'Azienda (con i loro
   allegati elencati); (c) avvisare l'utente che gli Account restano come residuo e chiedere
   conferma esplicita. Quale?

2. **Q2 — Ordine e atomicità se si sceglie la cascata.**
   **Figli prima, padre poi**: se i figli vengono eliminati e l'eliminazione del **padre**
   fallisce, resta un'**Azienda senza quegli Account** (l'Azienda esiste ancora, ma è stata
   svuotata). **Padre prima, figli poi**: se il padre viene eliminato e l'eliminazione dei
   **figli** fallisce, restano **Account orfani senza Azienda visibile** (documenti, metadati e
   byte non più raggiungibili dalla UI). Quale rischio si preferisce? Serve una compensazione,
   un blocco dell'operazione, o si accetta un esito riprovabile?

3. **Q3 — Riferimenti pendenti.**
   I contatti del Profilo che puntano a un Account di un'Azienda eliminata restano. Vanno
   ripuliti al momento della cancellazione dell'Azienda (come fa il purge per la coppia esatta)
   o è accettabile che restino?

4. **Q4 — Prefissi non coperti dal purge.**
   `users/{uid}/aziende_allegati/**` e gli Account orfani di un'Azienda eliminata **non** sono
   raggiunti dal purge degli Account (che opera su un Account archiviato esistente). Vanno
   inclusi in una pulizia per prefisso (D4) o dichiarati fuori perimetro?

5. **Q5 — Rapporto con D4.**
   La cancellazione dell'Azienda rientra nella stessa politica dei residui (inventario per
   prefisso + job) o richiede una regola dedicata? Confermi anche per il futuro la regola
   attuale «si cancellano solo i percorsi elencati sotto il prefisso dell'Account», che oggi
   impedisce di toccare byte di altri Account?

6. **Q6 — Conferma esplicita nella UI.**
   La conferma attuale («Eliminare definitivamente l'azienda?») non dice che gli Account e i
   file resteranno. Va cambiato il testo? Se sì, chi lo approva?

<a id="fonte-docs-m7-domande-t27-hard-delete-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: il runtime è **invariato**,
nessuna cancellazione è stata introdotta e nessun dato reale è stato letto o creato. Le prove
tecniche sono nel commit `d2eef964`; questo documento non le ripete e non le sostituisce.
