# Condivisione

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Indice delle fonti conservate

- [M5_CONDIVISIONE_THREAT_MODEL.md](#fonte-docs-m5-condivisione-threat-model-md-l1)
- [M5_PIANO_INTEGRAZIONE.md](#fonte-docs-m5-piano-integrazione-md-l1)

<a id="fonte-docs-m5-condivisione-threat-model-md-l1"></a>

## Fonte: M5_CONDIVISIONE_THREAT_MODEL.md — righe originali 1–206

> Provenienza: `docs/M5_CONDIVISIONE_THREAT_MODEL.md` a `2900ccc0`.

<a id="fonte-docs-m5-condivisione-threat-model-md-m5--threat-model-della-condivisione"></a>

## M5 — Threat model della condivisione

Stato: analisi iniziale basata sul codice di `v1.2.63`. Questo documento non autorizza migrazioni o modifiche al formato dei dati di produzione.

<a id="fonte-docs-m5-condivisione-threat-model-md-obiettivo"></a>

### Obiettivo

Dimostrare separatamente e poi insieme:

1. che soltanto il proprietario e i destinatari autorizzati possono leggere un record;
2. che ogni destinatario autorizzato possiede il materiale crittografico corretto per decifrarlo;
3. che revoca, scadenza e variazione dei permessi eliminano l'accesso futuro senza perdere i dati del proprietario;
4. che backend, notifiche, log e metadati non espongono segreti.

<a id="fonte-docs-m5-condivisione-threat-model-md-stato-verificato-nel-codice-attuale"></a>

### Stato verificato nel codice attuale

Il proprietario cifra i campi sensibili con la propria Vault Key. La Master Password protegge la Vault Key tramite un envelope: non coincide quindi con la chiave dati, anche se nei vault storici esiste un percorso compatibile con il materiale precedente.

L'invito contiene identità del destinatario, riferimenti al record e stato, ma non contiene materiale di decifratura. Dopo l'accettazione, la Cloud Function `respondToInvitation` aggiunge l'UID del destinatario a `sharedWithUids`. Le Firestore Rules consentono così al destinatario autenticato di leggere il documento originale del proprietario.

Le pagine di dettaglio ricevute caricano quel documento usando `ownerId`, ma invocano `ensureVaultKeyMaterial()` nella sessione dell'invitato e tentano la decifratura con la Vault Key dell'invitato. Non risulta nel flusso esaminato un envelope della chiave del record destinato all'invitato.

Conclusione: l'autorizzazione di lettura è implementata, ma la decifratura end-to-end del destinatario non è dimostrata. Con chiavi vault differenti, il destinatario può leggere il ciphertext autorizzato ma non dovrebbe poter ottenere correttamente il testo in chiaro. Questa è la lacuna principale di M5.

<a id="fonte-docs-m5-condivisione-threat-model-md-attori-e-confini-di-fiducia"></a>

### Attori e confini di fiducia

- **Proprietario:** crea, modifica, condivide e revoca il record.
- **Destinatario invitato:** può accettare o rifiutare; dopo l'accettazione deve accedere solo a ciò che gli è stato concesso.
- **Destinatario revocato o scaduto:** non deve leggere nuove versioni né ottenere nuovo materiale crittografico.
- **Utente autenticato estraneo:** non deve leggere documento, invito o chiavi.
- **Client compromesso:** può osservare ciò che la sessione legittima può decifrare; non deve ottenere l'intera Vault Key altrui.
- **Firebase e Cloud Functions:** applicano identità e ACL; nel modello desiderato non devono ricevere plaintext o Master Password.
- **Canali email e push:** trasportano soltanto notifiche e riferimenti non sensibili.

<a id="fonte-docs-m5-condivisione-threat-model-md-dati-da-proteggere"></a>

### Dati da proteggere

- campi account, memorandum e dati bancari;
- allegati e relativo materiale di cifratura;
- Vault Key del proprietario e dell'invitato;
- eventuale chiave per-record e i suoi envelope;
- rubrica destinatari, inviti, ACL e cronologia;
- metadati che possono rivelare nome account, appartenenza o relazioni fra utenti.

<a id="fonte-docs-m5-condivisione-threat-model-md-flusso-attuale"></a>

### Flusso attuale

1. Il proprietario salva il record cifrato con la propria Vault Key.
2. Il client crea `sharedWith` sul record e un documento `invites`.
3. Email o push notificano il destinatario senza includere segreti.
4. Il destinatario autenticato accetta tramite Cloud Function.
5. La funzione collega il suo UID a `sharedWithUids`.
6. Le Rules autorizzano la lettura del documento del proprietario.
7. Il client tenta la decifratura con la Vault Key della sessione del destinatario: qui manca il ponte crittografico verificato.
8. La revoca elimina destinatario e invito dalle strutture correnti, ma va ancora dimostrata rispetto a chiavi già consegnate, cache offline e allegati.

<a id="fonte-docs-m5-condivisione-threat-model-md-inventario-del-percorso-dati"></a>

### Inventario del percorso dati

<a id="fonte-docs-m5-condivisione-threat-model-md-record-account-privato"></a>

#### Record Account privato

| Categoria | Campi osservati | Stato attuale |
|---|---|---|
| Segreti principali | `username`, `account`, `password`, `note` | cifrati con la Vault Key del proprietario |
| Dati bancari | `passwordDispositiva`, `cardNumber`, `pin`, `ccv` | cifrati con la Vault Key del proprietario |
| Classificazione e ACL | `type`, `visibility`, `sharedWith`, `sharedWithUids`, `acceptedCount` | plaintext necessario alle query e alle Rules |
| Identificazione visiva | `nomeAccount` e altri metadati non inclusi nella lista dei campi cifrati | da classificare rispetto alla privacy prima del nuovo formato |

<a id="fonte-docs-m5-condivisione-threat-model-md-record-account-azienda"></a>

#### Record Account azienda

| Categoria | Campi osservati | Stato attuale |
|---|---|---|
| Segreti principali | `username`, `account`, `password`, `numeroIscrizione`, `codiceSocieta`, `note` | cifrati con la Vault Key del proprietario |
| Dati bancari | `passwordDispositiva`, `cardNumber`, `pin`, `ccv` | cifrati con la Vault Key del proprietario |
| Classificazione e ACL | stessi campi di condivisione dell'Account privato, più `aziendaId` nell'invito | plaintext necessario al routing e alle Rules |
| Contesto aziendale | nome account e riferimenti all'azienda | da minimizzare e classificare prima del nuovo formato |

<a id="fonte-docs-m5-condivisione-threat-model-md-inviti-e-notifiche"></a>

#### Inviti e notifiche

Gli inviti contengono in chiaro email di mittente e destinatario, nome dell'account, tipo, identificatori, stato e preferenze di notifica. Non contengono password, Vault Key o chiave per-record. Email e push comunicano l'esistenza dell'invito e possono includere il nome dell'account: questo metadato deve diventare una scelta esplicita di privacy.

L'ID corrente dell'invito deriva da `accountId` ed email sanificata. Prima di considerarlo un identificatore canonico occorre verificare collisioni, rinomina dell'email e omonimia fra percorsi privato/azienda.

<a id="fonte-docs-m5-condivisione-threat-model-md-firestore-e-cache-offline"></a>

#### Firestore e cache offline

Le Rules consentono all'UID accettato di leggere il documento Account originale; le scritture del destinatario non sono abilitate. Il repository usa la cache persistente multischeda di Firestore e una strategia cache-first: nella cache resta quindi il ciphertext già autorizzato e scaricato, non il plaintext prodotto in memoria.

La revoca server impedisce letture successive, ma non può presumere la cancellazione immediata del ciphertext dalla cache del dispositivo. Il progetto della chiave per-record deve quindi trattare come permanente ogni ciphertext già consegnato e ruotare chiave e contenuto per le versioni future quando la revoca deve avere effetto crittografico.

<a id="fonte-docs-m5-condivisione-threat-model-md-allegati-e-storage"></a>

#### Allegati e Storage

Ogni allegato usa una chiave-file casuale AES-GCM. La chiave-file viene avvolta tramite HKDF e AES-GCM usando la Vault Key del proprietario; nel documento Firestore dell'allegato sono salvati metadati, percorso Storage e materiale di wrapping.

Le Storage Rules limitano lettura, creazione e cancellazione allo UID proprietario. Un invitato non può quindi scaricare l'oggetto del proprietario. Anche se potesse scaricarlo, il client tenterebbe di aprire la chiave-file con la Vault Key dell'invitato. La condivisione allegati non è attualmente end-to-end e dovrà usare lo stesso confine crittografico del record oppure un envelope dedicato.

Nel percorso aziendale il modulo allegati è inizializzato con `currentUid`, non con `ownerId`, e non espone lo stesso flag `readOnly` del percorso privato. Per un account ricevuto questo può indirizzare la raccolta sbagliata e mostrare comandi non coerenti; va corretto soltanto insieme al contratto di condivisione, con test di regressione.

<a id="fonte-docs-m5-condivisione-threat-model-md-minacce-prioritarie"></a>

### Minacce prioritarie

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

<a id="fonte-docs-m5-condivisione-threat-model-md-direzione-da-prototipare-non-ancora-adottata"></a>

### Direzione da prototipare, non ancora adottata

La candidata più limitata è una chiave casuale per singolo record. I contenuti condivisibili vengono cifrati con quella chiave; la chiave del record viene poi avvolta separatamente per il proprietario e per ciascun destinatario. La Vault Key completa del proprietario non viene mai condivisa.

Prima di scegliere algoritmi e formato occorre verificare come associare in modo affidabile una chiave pubblica a ciascun account utente, come proteggerne la chiave privata con la Vault Key locale e come ruotare la chiave del record dopo una revoca. La revoca non può cancellare ciò che un destinatario ha già visto o copiato, ma deve impedirgli di ottenere versioni e chiavi future.

Il primo laboratorio isolato si trova in `experiments/sharing-key-prototype/`. Usa ECDH P-256 soltanto per concordare il materiale dell'envelope, HKDF-SHA-256 per derivare la chiave di wrapping e AES-GCM-256 per cifrare chiave e contenuto. La chiave per-record non è derivata dalla Master Password e la Vault Key del proprietario non viene consegnata al destinatario.

Il laboratorio dimostra la proprietà crittografica minima, non decide ancora persistenza, recupero multi-dispositivo, verifica delle chiavi pubbliche, schema Firestore o migrazione. Non è importato dal frontend e non deve essere aggiunto alla cache offline.

<a id="fonte-docs-m5-condivisione-threat-model-md-contratto-funzionale-candidato"></a>

### Contratto funzionale candidato

<a id="fonte-docs-m5-condivisione-threat-model-md-ruoli-della-prima-versione"></a>

#### Ruoli della prima versione

- **Proprietario:** unico soggetto che modifica contenuto, destinatari, scadenza e chiavi.
- **Lettore:** legge il contenuto e gli eventuali allegati esplicitamente condivisi; non modifica il record e non invita terzi.

Il ruolo editor non entra nella prima versione. Aggiungerlo ora richiederebbe firme delle modifiche, conflitti offline, attribuzione e regole di scrittura più ampie. L'interfaccia può conservare un campo ruolo versionato, ma le Rules devono accettare soltanto `viewer` finché quel protocollo non sarà dimostrato.

<a id="fonte-docs-m5-condivisione-threat-model-md-stati-della-condivisione"></a>

#### Stati della condivisione

`pending` → `accepted` → `revoked` oppure `expired`; da `pending` si può passare anche a `rejected` o `cancelled`. Solo `accepted` e non scaduto concede ACL ed envelope attivo. Gli stati terminali non vengono riutilizzati: un nuovo invito riceve un nuovo identificatore casuale.

<a id="fonte-docs-m5-condivisione-threat-model-md-scadenza"></a>

#### Scadenza

La scadenza è facoltativa e viene valutata lato server. Il client può mostrarla, ma non costituisce il controllo di sicurezza. Alla scadenza il backend rimuove l'ACL e non distribuisce più envelope o versioni; per impedire accesso alle revisioni successive applica la stessa rotazione prevista dalla revoca.

<a id="fonte-docs-m5-condivisione-threat-model-md-revoca"></a>

#### Revoca

La revoca produce una nuova chiave per-record, ricifra l'ultima versione e crea nuovi envelope soltanto per proprietario e lettori ancora attivi. Il vecchio ciphertext può rimanere leggibile a chi lo aveva già ricevuto: questa limitazione deve essere dichiarata all'utente. Allegati nuovi o aggiornati usano chiavi collegate alla nuova generazione; gli allegati precedenti richiedono una decisione esplicita fra ricifratura e accesso storico.

<a id="fonte-docs-m5-condivisione-threat-model-md-cronologia-minima"></a>

#### Cronologia minima

La cronologia registra soltanto identificatori opachi, attore UID, azione, ruolo, generazione della chiave e timestamp server. Non registra nome account, email completa, contenuto, password, chiavi, ciphertext o nomi originali degli allegati. Gli eventi minimi sono creazione invito, accettazione/rifiuto, apertura envelope riuscita o fallita in forma aggregata, revoca, scadenza e rotazione.

<a id="fonte-docs-m5-condivisione-threat-model-md-identità-crittografica-candidata"></a>

### Identità crittografica candidata

Ogni utente possiede una coppia ECDH distinta dalla credenziale di login, dalla Master Password e dalla Vault Key. La chiave pubblica è associata all'UID autenticato e versionata. La chiave privata viene esportata soltanto per essere cifrata con una chiave derivata dalla Vault Key dell'utente; Firebase conserva esclusivamente la versione cifrata.

Un nuovo dispositivo, dopo login e sblocco corretto della Vault, scarica e apre la chiave privata cifrata. La rotazione della Master Password riavvolge Vault Key e chiave privata senza ricifrare i record. Il reset irreversibile della Vault non può recuperare condivisioni precedenti senza una Recovery Key progettata in M8.

Il proprietario non deve fidarsi di una chiave pubblica fornita liberamente dal client durante l'invito. La pubblicazione e sostituzione della chiave devono essere autorizzate per lo stesso UID, versionate e protette contro sostituzioni silenziose. Il protocollo definitivo dovrà decidere se mostrare una verifica di impronta per condivisioni ad alto rischio.

<a id="fonte-docs-m5-condivisione-threat-model-md-schema-logico-candidato-non-di-produzione"></a>

### Schema logico candidato, non di produzione

- `users/{uid}/cryptoIdentity/current`: chiave pubblica, versione, algoritmo e chiave privata cifrata per la Vault dell'utente;
- record condiviso: payload cifrato, `keyGeneration`, versione schema e metadati minimi;
- `recordShares/{shareId}`: proprietario, record opaco, destinatario UID, ruolo, stato, scadenza ed envelope per quella generazione;
- eventi append-only separati dal contenuto e leggibili soltanto dai soggetti previsti.

L'ACL Firestore deve leggere documenti di autorizzazione controllabili dalle Rules; non deve fidarsi di un array modificabile dall'invitato. Storage dovrà verificare lo stesso grant attivo usato da Firestore, evitando URL pubblici persistenti.

Il laboratorio Rules usa per questo `recordAccess/{recordId}/members/{uid}`: il percorso deterministico permette alle Rules di verificare il grant senza query. Il destinatario può leggere soltanto il proprio documento; record, grant e identità sono scritti esclusivamente dal backend. La lista dei record ricevuti dovrà usare un indice personale separato e minimale, mentre l'apertura del contenuto resta una lettura puntuale.

Le Rules candidate sono conservate soltanto nel laboratorio e vengono eseguite dall'emulatore separatamente dai test delle Rules correnti. Le prove Firestore confermano accesso per proprietario e lettore attivo, diniego per estraneo, revocato, scaduto e grant di generazione obsoleta, isolamento del grant e della chiave privata cifrata e blocco di ogni scrittura client su record, grant e identità. `firestore.rules` di produzione non è stato modificato.

La prova Storage candidata usa lo stesso `recordAccess/{recordId}/members/{uid}` e confronta la sua `keyGeneration` con quella del record. Proprietario e lettore attivo scaricano l'oggetto cifrato; estraneo, anonimo, revocato, scaduto e destinatario con grant di generazione precedente vengono respinti. Creazione e sovrascrittura client restano vietate: gli oggetti condivisi sono prodotti dal backend e non hanno URL pubblici persistenti. Anche `storage.rules` di produzione resta invariato.

<a id="fonte-docs-m5-condivisione-threat-model-md-compatibilità-e-migrazione-candidata"></a>

### Compatibilità e migrazione candidata

Il lettore dovrà riconoscere esplicitamente due formati:

- **legacy:** campi sensibili separati, cifrati con la Vault Key del proprietario;
- **record-key-v1:** payload unico cifrato con chiave per-record e grant separati per UID/generazione.

Durante la preparazione non si esegue una doppia scrittura silenziosa. La migrazione legge e decifra il legacy nella sessione del proprietario, costruisce il nuovo record in memoria, verifica che il nuovo payload torni identico e soltanto allora prepara una scrittura atomica. Il legacy resta disponibile fino alla conferma del nuovo formato; la sua eliminazione appartiene a un cutover successivo e separato.

Il simulatore locale `migration-simulator.mjs` accetta soltanto input con `fixture: true`. Produce record schema 2, grant individuali per proprietario e lettori e un pacchetto di rollback con checksum SHA-256. Non usa Firebase e non accetta percorsi o credenziali di produzione.

Il backup reale non potrà essere un semplice snapshot in chiaro come quello didattico del simulatore: dovrà essere cifrato, versionato, autenticato e coperto dal progetto M8. Per M5 il rollback richiesto consiste nel conservare il documento legacy intatto finché la verifica del nuovo record non è conclusa.

<a id="fonte-docs-m5-condivisione-threat-model-md-esito-allegati-e-offline-del-laboratorio"></a>

### Esito allegati e offline del laboratorio

Il laboratorio cifra ogni allegato con una chiave-file casuale e avvolge quest'ultima con la chiave per-record. Il destinatario autorizzato può quindi aprire record e allegato usando un solo grant, senza ricevere la Vault Key del proprietario. In caso di rotazione si può riavvolgere la chiave-file per i soggetti rimasti autorizzati senza ricifrare il contenuto binario, purché la politica scelta consenta loro l'accesso storico.

La prova offline conferma il limite del modello: un destinatario revocato che aveva già envelope e ciphertext della generazione precedente può continuare a leggere quella copia. La chiave precedente non apre però la revisione ricifrata con la generazione successiva. UI e documentazione dovranno spiegare che revocare impedisce l'accesso futuro, non cancella copie già viste o esportate.

L'inventario verificato dei percorsi e dei dati è conservato in `M5_INVENTARIO_DATI_CONDIVISI.md`; ordine di cutover, doppio lettore e rollback sono definiti in `M5_PIANO_INTEGRAZIONE.md`.

<a id="fonte-docs-m5-condivisione-threat-model-md-gate-di-m5"></a>

### Gate di M5

- [x] mappare attori, dati, confini e flusso attuale;
- [x] distinguere ACL da decifratura e identificare la lacuna corrente;
- [x] censire campi, allegati, cache, notifiche, percorsi legacy e metadati in chiaro;
- [x] definire il contratto iniziale per ruoli, scadenza, revoca e cronologia senza plaintext nei log;
- [x] costruire un prototipo isolato con utenti e chiavi di prova;
- [x] dimostrare lettura autorizzata e fallimento di lettura non autorizzata;
- [x] dimostrare rotazione dopo revoca e comportamento della copia offline già consegnata;
- [x] dimostrare nell'emulatore le ACL Firestore candidate senza modificare le Rules di produzione;
- [x] dimostrare nell'emulatore l'accesso Storage tramite lo stesso grant e la stessa generazione;
- [x] definire doppio lettore retrocompatibile, stati di migrazione e rollback; integrazione runtime non attivata;
- [x] provare la trasformazione e il rollback sul dataset fittizio M0;
- [ ] modificare la produzione soltanto dopo approvazione esplicita.

<a id="fonte-docs-m5-condivisione-threat-model-md-prossimo-passo"></a>

### Prossimo passo

Completare la classificazione dei percorsi legacy e dei metadati ancora in chiaro, poi trasformare il contratto retrocompatibile e il rollback già simulati in un piano di integrazione verificabile. Qualunque modifica a dati o Rules di produzione resta subordinata ad approvazione esplicita.

<a id="fonte-docs-m5-piano-integrazione-md-l1"></a>

## Fonte: M5_PIANO_INTEGRAZIONE.md — righe originali 1–114

> Provenienza: `docs/M5_PIANO_INTEGRAZIONE.md` a `2900ccc0`.

<a id="fonte-docs-m5-piano-integrazione-md-m5--piano-di-integrazione-e-rollback"></a>

## M5 — Piano di integrazione e rollback

<a id="fonte-docs-m5-piano-integrazione-md-principio"></a>

### Principio

La condivisione professionale entra nel runtime per fasi reversibili. Nessuna fase sovrascrive o elimina il record legacy finché il nuovo record non è stato scritto, riletto, decifrato e confrontato dal proprietario. Le Rules candidate e i nuovi percorsi non diventano produzione senza approvazione esplicita.

<a id="fonte-docs-m5-piano-integrazione-md-stati-di-migrazione"></a>

### Stati di migrazione

| Stato | Lettura | Scrittura | Reversibilità |
|---|---|---|---|
| `legacy` | solo documento attuale | formato attuale | totale |
| `prepared` | legacy canonico; schema 2 ombra non visibile | legacy + pacchetto schema 2 verificato | eliminazione sicura dell'ombra |
| `dual-read` | schema 2 se integro, altrimenti legacy | legacy canonico | ritorno immediato al legacy |
| `record-key` | schema 2 canonico | schema 2 con nuova generazione | legacy conservato in quarantena cifrata |
| `finalized` | schema 2 | schema 2 | rollback tramite backup cifrato M8 |

Lo stato non viene dedotto dall'assenza di campi: è un valore esplicito, versionato e modificabile soltanto dal backend o da un orchestratore autorizzato.

<a id="fonte-docs-m5-piano-integrazione-md-fasi-operative"></a>

### Fasi operative

<a id="fonte-docs-m5-piano-integrazione-md-0-preparazione-senza-traffico"></a>

#### 0. Preparazione senza traffico

- mantenere invariati record, inviti e Rules correnti;
- distribuire soltanto codice capace di ignorare in sicurezza campi e documenti schema 2;
- introdurre metriche prive di segreti: versione schema, esito e codice errore;
- provare fixture privata, aziendale, memorandum e allegato.

<a id="fonte-docs-m5-piano-integrazione-md-1-identità-crittografica"></a>

#### 1. Identità crittografica

- generare sul dispositivo la coppia ECDH dell'utente;
- pubblicare la sola chiave pubblica versionata tramite backend;
- avvolgere la chiave privata con la Vault Key e conservarla separatamente;
- verificare ripristino su secondo dispositivo, cambio Master Password e reset irreversibile;
- impedire sostituzione silenziosa della chiave pubblica.

<a id="fonte-docs-m5-piano-integrazione-md-2-doppio-lettore"></a>

#### 2. Doppio lettore

- risolvere un descrittore opaco del record;
- se lo stato è `dual-read` o successivo, validare schema, grant e generazione prima di decifrare;
- in caso di documento schema 2 assente o non integro, usare il legacy senza modificarlo;
- non fare fallback dopo un errore di autorizzazione o autenticità: eviterebbe il controllo di revoca;
- mostrare un errore sicuro se entrambi i formati sono presenti ma divergono.

<a id="fonte-docs-m5-piano-integrazione-md-3-nuove-scritture"></a>

#### 3. Nuove scritture

- creare record schema 2 e grant del proprietario in una transazione backend;
- creare l'envelope del destinatario solo dopo identità verificata e consenso;
- usare un indice ricevuti minimale per la lista, seguito da lettura puntuale del record;
- scrivere allegati cifrati nel percorso condiviso senza URL pubblico persistente;
- inviti, revoche e rotazioni diventano operazioni backend idempotenti.

<a id="fonte-docs-m5-piano-integrazione-md-4-migrazione-progressiva"></a>

#### 4. Migrazione progressiva

- selezione esplicita di un singolo record del proprietario;
- lettura e decifratura legacy in memoria;
- creazione del payload per-record e dei grant attivi;
- rilettura dal backend, decifratura e confronto semantico campo per campo;
- stato `prepared`, poi `dual-read` dopo conferma;
- nessuna migrazione automatica in massa nella prima release.

<a id="fonte-docs-m5-piano-integrazione-md-5-cutover-e-quarantena"></a>

#### 5. Cutover e quarantena

- promuovere a `record-key` solo record verificati e senza divergenze;
- rendere il legacy non scrivibile e conservarlo per una finestra definita;
- ruotare la chiave e incrementare `keyGeneration` a ogni revoca che precede una nuova revisione;
- passare a `finalized` soltanto quando M8 fornisce backup cifrato e ripristino provato.

<a id="fonte-docs-m5-piano-integrazione-md-contratto-del-doppio-lettore"></a>

### Contratto del doppio lettore

1. `schemaVersion` e `cryptoProtocol` devono essere riconosciuti esplicitamente.
2. Record, grant ed envelope devono avere lo stesso `recordId`, destinatario e `keyGeneration`.
3. Il proprietario usa anch'egli un grant; nessuna chiave del record è memorizzata in chiaro.
4. Il payload autenticato contiene tutti i campi funzionali e la revisione.
5. I metadati esterni seguono una allowlist, non una copia del record legacy.
6. Una firma/tag non valido, una generazione discordante o un grant revocato sono errori terminali.
7. Il fallback legacy è ammesso soltanto negli stati `legacy`, `prepared` e `dual-read` e mai per aggirare un diniego.

<a id="fonte-docs-m5-piano-integrazione-md-scritture-concorrenza-e-idempotenza"></a>

### Scritture, concorrenza e idempotenza

- ogni comando porta `operationId`, `expectedRevision` e `expectedKeyGeneration`;
- un'operazione ripetuta con lo stesso ID restituisce lo stesso esito;
- una revisione inattesa produce conflitto e non sovrascrive;
- record, grant, indice ricevuti ed evento audit vengono aggiornati atomicamente o tramite outbox backend recuperabile;
- il client non modifica direttamente ACL, generazione o stato migrazione.

Questi requisiti diventano la base di M6 per sincronizzazione e conflitti.

<a id="fonte-docs-m5-piano-integrazione-md-rollback"></a>

### Rollback

| Fase | Azione di rollback |
|---|---|
| Preparazione/identità | disabilitare feature flag; nessun record applicativo cambia |
| `prepared` | eliminare solo l'ombra dopo verifica del checksum; legacy intatto |
| `dual-read` | impostare lettore su legacy e bloccare nuove promozioni |
| `record-key` | riaprire il legacy in sola lettura; riconciliare revisioni senza sovrascrittura |
| `finalized` | usare esclusivamente il backup cifrato e verificato progettato in M8 |

Un rollback non riattiva grant revocati e non riduce `keyGeneration`.

<a id="fonte-docs-m5-piano-integrazione-md-gate-prima-della-produzione"></a>

### Gate prima della produzione

- [x] crittografia per-record ed envelope dimostrati su fixture;
- [x] Rules Firestore e Storage candidate dimostrate in emulatori;
- [x] revoca, generazione futura e limite della cache offline dimostrati;
- [x] inventario completo dei percorsi e dei metadati correnti;
- [x] ordine di integrazione, doppio lettore e rollback definiti;
- [ ] identità crittografica provata su due dispositivi non produttivi;
- [x] runtime identità ECDH implementato: chiave privata cifrata con materiale Vault, UID e chiave pubblica autenticati, sostituzione silenziosa bloccata;
- [x] trasferimento A→B simulato tramite serializzazione e decifratura per-record; protocollo di prova fisica documentato;
- [x] doppio lettore integrato nel repository e testato con flag predefinita disattivata; revoca, autenticità, generazione e divergenza falliscono senza fallback;
- [ ] backup cifrato e ripristino M8 disponibili prima di `finalized`;
- [ ] approvazione esplicita per Rules, funzioni, migrazione e cutover di produzione.

M5 può chiudere come architettura e laboratorio. L'attivazione reale resta un rilascio separato dipendente da collaudo fisico, M6 e M8.
