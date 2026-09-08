# M5 — Threat model della condivisione

Stato: analisi iniziale basata sul codice di `v1.2.63`. Questo documento non autorizza migrazioni o modifiche al formato dei dati di produzione.

## Obiettivo

Dimostrare separatamente e poi insieme:

1. che soltanto il proprietario e i destinatari autorizzati possono leggere un record;
2. che ogni destinatario autorizzato possiede il materiale crittografico corretto per decifrarlo;
3. che revoca, scadenza e variazione dei permessi eliminano l'accesso futuro senza perdere i dati del proprietario;
4. che backend, notifiche, log e metadati non espongono segreti.

## Stato verificato nel codice attuale

Il proprietario cifra i campi sensibili con la propria Vault Key. La Master Password protegge la Vault Key tramite un envelope: non coincide quindi con la chiave dati, anche se nei vault storici esiste un percorso compatibile con il materiale precedente.

L'invito contiene identità del destinatario, riferimenti al record e stato, ma non contiene materiale di decifratura. Dopo l'accettazione, la Cloud Function `respondToInvitation` aggiunge l'UID del destinatario a `sharedWithUids`. Le Firestore Rules consentono così al destinatario autenticato di leggere il documento originale del proprietario.

Le pagine di dettaglio ricevute caricano quel documento usando `ownerId`, ma invocano `ensureVaultKeyMaterial()` nella sessione dell'invitato e tentano la decifratura con la Vault Key dell'invitato. Non risulta nel flusso esaminato un envelope della chiave del record destinato all'invitato.

Conclusione: l'autorizzazione di lettura è implementata, ma la decifratura end-to-end del destinatario non è dimostrata. Con chiavi vault differenti, il destinatario può leggere il ciphertext autorizzato ma non dovrebbe poter ottenere correttamente il testo in chiaro. Questa è la lacuna principale di M5.

## Attori e confini di fiducia

- **Proprietario:** crea, modifica, condivide e revoca il record.
- **Destinatario invitato:** può accettare o rifiutare; dopo l'accettazione deve accedere solo a ciò che gli è stato concesso.
- **Destinatario revocato o scaduto:** non deve leggere nuove versioni né ottenere nuovo materiale crittografico.
- **Utente autenticato estraneo:** non deve leggere documento, invito o chiavi.
- **Client compromesso:** può osservare ciò che la sessione legittima può decifrare; non deve ottenere l'intera Vault Key altrui.
- **Firebase e Cloud Functions:** applicano identità e ACL; nel modello desiderato non devono ricevere plaintext o Master Password.
- **Canali email e push:** trasportano soltanto notifiche e riferimenti non sensibili.

## Dati da proteggere

- campi account, memorandum e dati bancari;
- allegati e relativo materiale di cifratura;
- Vault Key del proprietario e dell'invitato;
- eventuale chiave per-record e i suoi envelope;
- rubrica destinatari, inviti, ACL e cronologia;
- metadati che possono rivelare nome account, appartenenza o relazioni fra utenti.

## Flusso attuale

1. Il proprietario salva il record cifrato con la propria Vault Key.
2. Il client crea `sharedWith` sul record e un documento `invites`.
3. Email o push notificano il destinatario senza includere segreti.
4. Il destinatario autenticato accetta tramite Cloud Function.
5. La funzione collega il suo UID a `sharedWithUids`.
6. Le Rules autorizzano la lettura del documento del proprietario.
7. Il client tenta la decifratura con la Vault Key della sessione del destinatario: qui manca il ponte crittografico verificato.
8. La revoca elimina destinatario e invito dalle strutture correnti, ma va ancora dimostrata rispetto a chiavi già consegnate, cache offline e allegati.

## Minacce prioritarie

| Minaccia | Controllo attuale | Lacuna da chiudere |
|---|---|---|
| Lettura da utente estraneo | Auth, email invito e `sharedWithUids` | test negativi completi su tutti i percorsi account |
| UID o email sostituiti | accettazione lato Cloud Function | canonicalizzazione e collisioni dell'ID invito da verificare |
| Server o log vedono segreti | cifratura client dei campi principali | allegati, metadati, errori e percorsi legacy da censire |
| Invitato non riesce a decifrare | nessun controllo completo individuato | envelope per-record o soluzione equivalente |
| Revocato conserva l'accesso | ACL rimossa dal record | cache, ciphertext già scaricato e chiavi consegnate |
| Condivisione estende tutta la Vault | non risulta consegna della Vault Key | vietare esplicitamente la distribuzione della Vault Key completa |
| Scritture non autorizzate | destinatario in sola lettura nelle Rules esaminate | progettare ruoli prima di aggiungere modifica condivisa |
| Allegati divergono dai campi | cifratura client presente | accesso Storage e distribuzione della chiave da verificare end-to-end |

## Direzione da prototipare, non ancora adottata

La candidata più limitata è una chiave casuale per singolo record. I contenuti condivisibili vengono cifrati con quella chiave; la chiave del record viene poi avvolta separatamente per il proprietario e per ciascun destinatario. La Vault Key completa del proprietario non viene mai condivisa.

Prima di scegliere algoritmi e formato occorre verificare come associare in modo affidabile una chiave pubblica a ciascun account utente, come proteggerne la chiave privata con la Vault Key locale e come ruotare la chiave del record dopo una revoca. La revoca non può cancellare ciò che un destinatario ha già visto o copiato, ma deve impedirgli di ottenere versioni e chiavi future.

## Gate di M5

- [x] mappare attori, dati, confini e flusso attuale;
- [x] distinguere ACL da decifratura e identificare la lacuna corrente;
- [ ] censire campi, allegati, cache e percorsi legacy coinvolti;
- [ ] definire ruoli, scadenza, revoca e cronologia senza plaintext nei log;
- [ ] costruire un prototipo isolato con utenti e chiavi di prova;
- [ ] dimostrare lettura autorizzata e fallimento di lettura non autorizzata;
- [ ] dimostrare rotazione/revoca e comportamento offline;
- [ ] definire lettore retrocompatibile, backup e rollback;
- [ ] provare la migrazione su una copia non produttiva;
- [ ] modificare la produzione soltanto dopo approvazione esplicita.

## Prossimo passo

Produrre l'inventario completo dei dati condivisi e dei punti di lettura/scrittura, includendo Firestore, Storage, cache offline e notifiche. Soltanto dopo si definisce il contratto del prototipo per-record.
