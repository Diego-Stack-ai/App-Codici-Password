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

## Inventario del percorso dati

### Record Account privato

| Categoria | Campi osservati | Stato attuale |
|---|---|---|
| Segreti principali | `username`, `account`, `password`, `note` | cifrati con la Vault Key del proprietario |
| Dati bancari | `passwordDispositiva`, `cardNumber`, `pin`, `ccv` | cifrati con la Vault Key del proprietario |
| Classificazione e ACL | `type`, `visibility`, `sharedWith`, `sharedWithUids`, `acceptedCount` | plaintext necessario alle query e alle Rules |
| Identificazione visiva | `nomeAccount` e altri metadati non inclusi nella lista dei campi cifrati | da classificare rispetto alla privacy prima del nuovo formato |

### Record Account azienda

| Categoria | Campi osservati | Stato attuale |
|---|---|---|
| Segreti principali | `username`, `account`, `password`, `numeroIscrizione`, `codiceSocieta`, `note` | cifrati con la Vault Key del proprietario |
| Dati bancari | `passwordDispositiva`, `cardNumber`, `pin`, `ccv` | cifrati con la Vault Key del proprietario |
| Classificazione e ACL | stessi campi di condivisione dell'Account privato, più `aziendaId` nell'invito | plaintext necessario al routing e alle Rules |
| Contesto aziendale | nome account e riferimenti all'azienda | da minimizzare e classificare prima del nuovo formato |

### Inviti e notifiche

Gli inviti contengono in chiaro email di mittente e destinatario, nome dell'account, tipo, identificatori, stato e preferenze di notifica. Non contengono password, Vault Key o chiave per-record. Email e push comunicano l'esistenza dell'invito e possono includere il nome dell'account: questo metadato deve diventare una scelta esplicita di privacy.

L'ID corrente dell'invito deriva da `accountId` ed email sanificata. Prima di considerarlo un identificatore canonico occorre verificare collisioni, rinomina dell'email e omonimia fra percorsi privato/azienda.

### Firestore e cache offline

Le Rules consentono all'UID accettato di leggere il documento Account originale; le scritture del destinatario non sono abilitate. Il repository usa la cache persistente multischeda di Firestore e una strategia cache-first: nella cache resta quindi il ciphertext già autorizzato e scaricato, non il plaintext prodotto in memoria.

La revoca server impedisce letture successive, ma non può presumere la cancellazione immediata del ciphertext dalla cache del dispositivo. Il progetto della chiave per-record deve quindi trattare come permanente ogni ciphertext già consegnato e ruotare chiave e contenuto per le versioni future quando la revoca deve avere effetto crittografico.

### Allegati e Storage

Ogni allegato usa una chiave-file casuale AES-GCM. La chiave-file viene avvolta tramite HKDF e AES-GCM usando la Vault Key del proprietario; nel documento Firestore dell'allegato sono salvati metadati, percorso Storage e materiale di wrapping.

Le Storage Rules limitano lettura, creazione e cancellazione allo UID proprietario. Un invitato non può quindi scaricare l'oggetto del proprietario. Anche se potesse scaricarlo, il client tenterebbe di aprire la chiave-file con la Vault Key dell'invitato. La condivisione allegati non è attualmente end-to-end e dovrà usare lo stesso confine crittografico del record oppure un envelope dedicato.

Nel percorso aziendale il modulo allegati è inizializzato con `currentUid`, non con `ownerId`, e non espone lo stesso flag `readOnly` del percorso privato. Per un account ricevuto questo può indirizzare la raccolta sbagliata e mostrare comandi non coerenti; va corretto soltanto insieme al contratto di condivisione, con test di regressione.

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
| Metadati sensibili visibili | segreti principali cifrati | nome account, email, tipo e contesto aziendale restano plaintext |
| Cache dopo revoca | Firestore conserva ciphertext | rotazione della chiave per impedire l'accesso alle versioni future |
| Percorsi privato/azienda divergenti | UI simile e ACL comune | allegati azienda usano `currentUid` e non lo stesso contratto read-only |

## Direzione da prototipare, non ancora adottata

La candidata più limitata è una chiave casuale per singolo record. I contenuti condivisibili vengono cifrati con quella chiave; la chiave del record viene poi avvolta separatamente per il proprietario e per ciascun destinatario. La Vault Key completa del proprietario non viene mai condivisa.

Prima di scegliere algoritmi e formato occorre verificare come associare in modo affidabile una chiave pubblica a ciascun account utente, come proteggerne la chiave privata con la Vault Key locale e come ruotare la chiave del record dopo una revoca. La revoca non può cancellare ciò che un destinatario ha già visto o copiato, ma deve impedirgli di ottenere versioni e chiavi future.

Il primo laboratorio isolato si trova in `experiments/sharing-key-prototype/`. Usa ECDH P-256 soltanto per concordare il materiale dell'envelope, HKDF-SHA-256 per derivare la chiave di wrapping e AES-GCM-256 per cifrare chiave e contenuto. La chiave per-record non è derivata dalla Master Password e la Vault Key del proprietario non viene consegnata al destinatario.

Il laboratorio dimostra la proprietà crittografica minima, non decide ancora persistenza, recupero multi-dispositivo, verifica delle chiavi pubbliche, schema Firestore o migrazione. Non è importato dal frontend e non deve essere aggiunto alla cache offline.

## Contratto funzionale candidato

### Ruoli della prima versione

- **Proprietario:** unico soggetto che modifica contenuto, destinatari, scadenza e chiavi.
- **Lettore:** legge il contenuto e gli eventuali allegati esplicitamente condivisi; non modifica il record e non invita terzi.

Il ruolo editor non entra nella prima versione. Aggiungerlo ora richiederebbe firme delle modifiche, conflitti offline, attribuzione e regole di scrittura più ampie. L'interfaccia può conservare un campo ruolo versionato, ma le Rules devono accettare soltanto `viewer` finché quel protocollo non sarà dimostrato.

### Stati della condivisione

`pending` → `accepted` → `revoked` oppure `expired`; da `pending` si può passare anche a `rejected` o `cancelled`. Solo `accepted` e non scaduto concede ACL ed envelope attivo. Gli stati terminali non vengono riutilizzati: un nuovo invito riceve un nuovo identificatore casuale.

### Scadenza

La scadenza è facoltativa e viene valutata lato server. Il client può mostrarla, ma non costituisce il controllo di sicurezza. Alla scadenza il backend rimuove l'ACL e non distribuisce più envelope o versioni; per impedire accesso alle revisioni successive applica la stessa rotazione prevista dalla revoca.

### Revoca

La revoca produce una nuova chiave per-record, ricifra l'ultima versione e crea nuovi envelope soltanto per proprietario e lettori ancora attivi. Il vecchio ciphertext può rimanere leggibile a chi lo aveva già ricevuto: questa limitazione deve essere dichiarata all'utente. Allegati nuovi o aggiornati usano chiavi collegate alla nuova generazione; gli allegati precedenti richiedono una decisione esplicita fra ricifratura e accesso storico.

### Cronologia minima

La cronologia registra soltanto identificatori opachi, attore UID, azione, ruolo, generazione della chiave e timestamp server. Non registra nome account, email completa, contenuto, password, chiavi, ciphertext o nomi originali degli allegati. Gli eventi minimi sono creazione invito, accettazione/rifiuto, apertura envelope riuscita o fallita in forma aggregata, revoca, scadenza e rotazione.

## Identità crittografica candidata

Ogni utente possiede una coppia ECDH distinta dalla credenziale di login, dalla Master Password e dalla Vault Key. La chiave pubblica è associata all'UID autenticato e versionata. La chiave privata viene esportata soltanto per essere cifrata con una chiave derivata dalla Vault Key dell'utente; Firebase conserva esclusivamente la versione cifrata.

Un nuovo dispositivo, dopo login e sblocco corretto della Vault, scarica e apre la chiave privata cifrata. La rotazione della Master Password riavvolge Vault Key e chiave privata senza ricifrare i record. Il reset irreversibile della Vault non può recuperare condivisioni precedenti senza una Recovery Key progettata in M8.

Il proprietario non deve fidarsi di una chiave pubblica fornita liberamente dal client durante l'invito. La pubblicazione e sostituzione della chiave devono essere autorizzate per lo stesso UID, versionate e protette contro sostituzioni silenziose. Il protocollo definitivo dovrà decidere se mostrare una verifica di impronta per condivisioni ad alto rischio.

## Schema logico candidato, non di produzione

- `users/{uid}/cryptoIdentity/current`: chiave pubblica, versione, algoritmo e chiave privata cifrata per la Vault dell'utente;
- record condiviso: payload cifrato, `keyGeneration`, versione schema e metadati minimi;
- `recordShares/{shareId}`: proprietario, record opaco, destinatario UID, ruolo, stato, scadenza ed envelope per quella generazione;
- eventi append-only separati dal contenuto e leggibili soltanto dai soggetti previsti.

L'ACL Firestore deve leggere documenti di autorizzazione controllabili dalle Rules; non deve fidarsi di un array modificabile dall'invitato. Storage dovrà verificare lo stesso grant attivo usato da Firestore, evitando URL pubblici persistenti.

## Compatibilità e migrazione candidata

Il lettore dovrà riconoscere esplicitamente due formati:

- **legacy:** campi sensibili separati, cifrati con la Vault Key del proprietario;
- **record-key-v1:** payload unico cifrato con chiave per-record e grant separati per UID/generazione.

Durante la preparazione non si esegue una doppia scrittura silenziosa. La migrazione legge e decifra il legacy nella sessione del proprietario, costruisce il nuovo record in memoria, verifica che il nuovo payload torni identico e soltanto allora prepara una scrittura atomica. Il legacy resta disponibile fino alla conferma del nuovo formato; la sua eliminazione appartiene a un cutover successivo e separato.

Il simulatore locale `migration-simulator.mjs` accetta soltanto input con `fixture: true`. Produce record schema 2, grant individuali per proprietario e lettori e un pacchetto di rollback con checksum SHA-256. Non usa Firebase e non accetta percorsi o credenziali di produzione.

Il backup reale non potrà essere un semplice snapshot in chiaro come quello didattico del simulatore: dovrà essere cifrato, versionato, autenticato e coperto dal progetto M8. Per M5 il rollback richiesto consiste nel conservare il documento legacy intatto finché la verifica del nuovo record non è conclusa.

## Esito allegati e offline del laboratorio

Il laboratorio cifra ogni allegato con una chiave-file casuale e avvolge quest'ultima con la chiave per-record. Il destinatario autorizzato può quindi aprire record e allegato usando un solo grant, senza ricevere la Vault Key del proprietario. In caso di rotazione si può riavvolgere la chiave-file per i soggetti rimasti autorizzati senza ricifrare il contenuto binario, purché la politica scelta consenta loro l'accesso storico.

La prova offline conferma il limite del modello: un destinatario revocato che aveva già envelope e ciphertext della generazione precedente può continuare a leggere quella copia. La chiave precedente non apre però la revisione ricifrata con la generazione successiva. UI e documentazione dovranno spiegare che revocare impedisce l'accesso futuro, non cancella copie già viste o esportate.

## Gate di M5

- [x] mappare attori, dati, confini e flusso attuale;
- [x] distinguere ACL da decifratura e identificare la lacuna corrente;
- [~] censire campi, allegati e cache; restano i percorsi legacy e tutti i metadati da classificare;
- [x] definire il contratto iniziale per ruoli, scadenza, revoca e cronologia senza plaintext nei log;
- [x] costruire un prototipo isolato con utenti e chiavi di prova;
- [x] dimostrare lettura autorizzata e fallimento di lettura non autorizzata;
- [x] dimostrare rotazione dopo revoca e comportamento della copia offline già consegnata;
- [~] definire lettore retrocompatibile, backup e rollback; contratto e simulatore pronti, integrazione runtime non avviata;
- [x] provare la trasformazione e il rollback sul dataset fittizio M0;
- [ ] modificare la produzione soltanto dopo approvazione esplicita.

## Prossimo passo

Produrre l'inventario completo dei dati condivisi e dei punti di lettura/scrittura, includendo Firestore, Storage, cache offline e notifiche. Soltanto dopo si definisce il contratto del prototipo per-record.
