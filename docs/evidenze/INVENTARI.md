# Inventari

## M8/PURGE — inventario incrementale del 04/10/2026

Contratto multipasso candidato (15:47 UTC, non implementato): il modello single-effect non va riutilizzato azzerando effect dopo ogni delete, perché perderebbe esiti parziali e identità dei retry. Piano immutabile ordinato di bersagli versionati, hash di piano e indice del passo legati a operationId/claimRevision; ogni risultato conserva identità del piano e del passo. Stato distingue passi applied, conflitto/not-applied, pending/unknown e non avviati; riepilogo mantiene appliedCount anche dopo stop. Un solo passo autorizzato alla volta. Stop impedisce avanzamento, conflitto interrompe il piano senza sostituire versioni; pending/unknown impedisce avanzamento e rilascio. Per Firestore delete+avanzamento+ricevuta nello stesso commit con barriera nel read-set; Storage resta protocollo separato, nessuna I/O dentro callback transazionale. Piano fornito non attesta completezza dell'albero: inventario/riferimenti e copertura writer sono prerequisiti separati, non risolti da hash/count. Fine lista non autorizza release o dichiara purge completo senza verifica globale. Primo passo sicuro: modello puro di avanzamento/riepilogo su piano sintetico, stop dopo primo successo e rifiuto replay sotto piano mutato. Nessun nuovo registro runtime, durata di conservazione o ripartenza automatica decisi.

Confine executor documentale (15:33 UTC): per un documento Firestore, leggere barriera/stato/bersaglio e committare delete versionata più esito nella stessa transazione; non introdurre artificialmente due commit intent/esito come per Storage. Callback senza I/O esterno né contatori di successo; retry non equivale a nuova autorizzazione e deve ricontrollare stop/versioni. Ricevuta persistita può attestare il commit anche dopo risposta persa, ma assenza ricevuta durante richiesta incerta non prova abort e non libera writer. Prima di integrare occorre binding completo nella ricevuta e barriera nello stesso read-set. Prova atomica SDK in COLLAUDI è preliminare, non executor completo; nessuna nuova retention o registro runtime autorizzati.

Bersagli versionati (15:25 UTC, riscontro statico e contratto candidato): SDK Firestore installato espone delete con lastUpdateTime; index.js già lo usa nella retention audit, ma il relativo fallback riclassifica e cancella la versione corrente e NON va copiato nel purge1A. Per purge ogni effetto deve fissare percorso canonico e updateTime completo (seconds/nanoseconds, non millisecondi), oppure bucket/path/generation Storage come stringa decimale senza conversione Number. SDK Storage installato ammette ifGenerationMatch stringa. Queste precondizioni proteggono il singolo bersaglio, non nuovi riferimenti allo stesso oggetto né figli aggiunti: serve ancora barriera comune a tutti i writer, inventario completo dei discendenti e verifica riferimenti. Vietato fallback a recursiveDelete o delete senza versione dopo conflitto. Esito precondizione fallita arresta quel passo e richiede nuova verifica, non autorizza a sostituire la versione attesa. Un 404 o una lettura successiva assente non attestano quale tentativo abbia cancellato: distinguere stato osservato da esito attribuibile e non risolvere unknown per sola assenza. Nessun I/O distruttivo o nuovo registro implementato. Prossimo esperimento: piano bersagli sintetico, validazione versioni/perimetro e rifiuto perdita precisione; successiva prova precondizioni solo in namespace demo esplicitamente isolato.

Arresto purge post-claim (15:16 UTC, contratto sperimentale non implementato): richiesta writer durante exclusive deve registrare stopRequested senza applicare ancora la scrittura; nessun nuovo passo distruttivo autorizzabile dopo stop. Un passo già autorizzato/in volo può comunque terminare: esito pending/unknown non permette rilascio della barriera o dichiarazione di conservazione completa. Dopo esiti riconciliati, stato stopped con riepilogo effetti parziali; nuova scrittura/richiesta solo dopo nuova verifica, come1A. Non adottare timeout come prova che il vecchio worker sia cessato. Una barriera Firestore non invalida delete già inviata a Storage: occorrono oggetti immutabili con generation fissata e riferimenti verificati, mentre record/figli devono avere precondizioni/versioni specifiche; recursiveDelete indistinto resta incompatibile con garanzia contro ricreazione. Primo esperimento indipendente: modello senza I/O di stop e singolo effetto in volo, con unknown bloccante. Non promette esecuzione distribuita, recupero automatico o nuova retention.

Purge riesaminato (15:08 UTC): index prepara ricevuta processing in transazione ma non acquisisce una barriera condivisa coi writer; poi elenca allegati, elimina Storage per solo path e chiama recursiveDelete. Il controllo Account ricreato arriva nella transazione finale, dopo distruzione. Prova KNOWN LIMIT in purge-profile-cleanup-handler.test.js già dimostra perdita del ripristino interposto: non rieseguita né dichiarata risolta. Una seconda lettura revision prima delle delete lascia ancora una finestra; generation-match protegge dalla sostituzione dello stesso oggetto ma non da nuovi riferimenti alla stessa generazione. Contratto candidato da provare in isolamento: token/revisione condivisi da tutti i writer, fase pre-distruttiva invalidabile dal writer (vince conservazione secondo1A), passaggio esclusivo prima dell'I/O e stato parziale esplicito dopo primo effetto irreversibile. Nessun semplice timeout libera un'operazione dall'esito incerto. Necessario coprire root/discendenti/riferimenti esterni/client legacy e Storage; senza tale copertura non applicare il protocollo a users né rimuovere preflight. Nessuna Rules base modificata.

Ripresa riesaminata (15:00 UTC): decisione27/09 2A autorizza nuova sessione e soli mancanti, non rollback globale;3A limita sette giorni agli upload incompleti, non alla ricevuta/registro del ripristino. Client attuale prepareRestoreExecution esclude unchanged, genera executionId casuale e conserva commands/confirmedChunks in RAM; loop conferma chunk prima degli upload. Il candidato risolve solo il commit del singolo comando: una nuova preview cambia expectedVersion e quindi binding, non può essere presentata come replay dello stesso comando. Per ripresa verificabile occorre recuperare identità e comando originali oppure classificare come nuova operazione con nuova conferma/CAS; backupId da solo non distingue selezioni/esecuzioni. Prima del wiring serve contratto del piano minimo e della sua conservazione: nessuna durata dedotta dai sette giorni, nessun nuovo registro attivato. Lavoro indipendente possibile: riconciliazione pura degli esiti attestati per un piano originale fornito, senza persistenza o decisioni retention; non confonderla con scoperta automatica della vecchia operazione.

Contratto commit candidato (14:25 UTC, non implementato): distinguere restoreOperationId degli stage da chunkOperationId/ricevuta; comando include record originali validati e lista stageId canonica senza duplicati. Binding dedicato laboratorio comprende entrambi gli ID, owner, record/versioni/conferme e lista stage: non riutilizzare ciecamente domain/version della ricevuta attuale. Transazione legge ricevuta; replay verifica l'intero binding e restituisce solo risultato attestato senza nuova pubblicazione. Primo commit legge stage/piano/descriptor/riferimenti e record nel medesimo read-set, verifica operazione e mapping univoco, riscrive percorsi, applica CAS/autorità e scrive record candidati+ricevuta insieme. La ricevuta conserva anche digest della riscrittura verificata dal server, non un mapping scelto dal client. Nessun record users attivo in questa fase. Rimangono da definire fence purge e resume persistente: il contratto non garantisce che i byte restino conservati dopo commit né autorizza cleanup. Prima implementazione limitata a namespace lab e prove replay/mapping diverso/stage cambiato tra lettura e commit.

Commit chunk (14:23 UTC): restoreBackupChunk legge ricevuta root/legacy e record nella transazione, verifica binding/replay e versioni anteprima, poi scrive record/ricevuta/audit. Non legge stage. Per integrare mapping non basta chiamare resolveMapping prima: occorre validatore transazionale riusabile nello stesso read-set e binding ricevuta che includa l'identità della riscrittura. Il replay attuale precede ulteriori verifiche: va preservato il risultato attestato senza dipendere da descriptor eliminabili dopo commit, ma senza accettare un mapping diverso sotto la stessa operationId. Progettazione candidata ancora aperta; nessuna modifica index o semantica replay applicata.

Riesame same-origin e mapping (14:19 UTC): server4188 ha dispatcher Host/CSP e asset espliciti; introdurre /download richiede composizione del servizio e ciclo di avvio, non basta copiare un modulo nel build. Lo startup esegue anche seed/composizione Rules candidate: non riavviato alla cieca. Per il mapping, il nuovo classificatore ricava stageId dal path canonico restoreObjects e il servizio ne risolve la generazione: questo supera, per il solo candidato completo, la precedente necessità di duplicare generation nel record. rewriteStorageData può restare puro/path-only, ma la tabella from→to deve provenire da stage verificati dello stesso owner/operazione e la pubblicazione dei record va coordinata transazionalmente. Non autorizza mapping client arbitrario né integrazione attuale restoreBackupChunk. Prossimo lavoro indipendente: prova rewrite→classificazione→lettura candidata e rifiuto mapping non attestato prima di progettare il commit dei chunk.

Topologia verificata nel codice (14:15 UTC): emulator-firebase.mjs vincola origin a http://127.0.0.1:4188 e usa Auth9099, Firestore8085, Storage9199; Functions5001 nel percorso realFunctions. App Check è un CustomProvider con attestazione sintetica non firmata per l'emulatore, esplicitamente non attestazione reale. emulator-browser.mjs possiede il server4188 con guardia Host, mentre build-emulator costruisce solo frontend. Il nuovo download non è montato su questo server: la prova Node su porta effimera non prova browser same-origin4188. Passo indipendente possibile: test Auth emulato con Admin verifyIdToken, lasciando App Check sintetico dichiarato; non chiamare ciò verifica App Check reale né indebolire il verificatore per accettare quel token in produzione. Nessun server riavviato o configurazione modificata da questa ispezione.

Confine download candidato (13:55 UTC, design non implementato): handler separato nel laboratorio, senza listener persistente/export Functions. POST /download esatto, richiesta vuota con x-stage-id, Bearer e x-firebase-appcheck; rifiuto query, body e header UID/path/generation come input di autorità. Loopback come upload; nessuna apertura CORS automatica. UID esclusivamente dall'esito verifyIdToken, App Check richiesto prima di read; stessi limiti owner/stage e lettura dei tre documenti già in read. Risposta application/octet-stream, Cache-Control no-store, Content-Length e metadati generation/sha256 validati dal servizio. Buffer mantenuto fino a finish/close/error della risposta, poi azzerato idempotentemente: non cancellarlo subito dopo res.end, che può usarlo ancora. Disconnessione durante await deve impedire invio e cancellare il risultato tardivo. Errori generici senza token, dettagli provider o percorsi. Prove richieste: HTTP loopback effimero, auth/App Check/owner errati prima del download, risposta pinned, body/query invalidi, errore generazione senza fallback, cleanup success/disconnessione. Non risolve revoca server durante trasferimento o purge concorrente; nessun endpoint esistente dichiarato conforme.

Raccordo M8-READERS (riesame 13:51 UTC): protected-session.mjs fornisce alle viste assertUnlocked e signal; assertUnlocked controlla vista abortita, owner/revision e Vault. Un adattatore candidato può convertirne il successo in isActive=true, senza esportare chiavi o leggere lo stato globale login. Va provata la revoca su lock/navigazione e successivo unlock, non basta la prova Symbol precedente. restore-stage-lab.read(uid,{stageId}) è solo metodo interno: non verifica token/App Check; tali verifiche esistono nell'upload HTTP, non in un endpoint read. Prima del collegamento browser serve quindi confine download autenticato che ricavi UID dal token e restituisca byte/metadati della generazione pubblicata, senza accettare path/generation client. L'adattatore firebase-document-attachment-transport riguarda un diverso servizio e non è un endpoint M8 riutilizzabile automaticamente. Nessuna modifica runtime o prova nuova; restano separati autenticazione trasporto, revoca locale e coordinamento purge.

Integrazione lettori dopo M8-LAB-01: oltre ai dettagli allegati privato/azienda, dati-azienda-attachments.js apre gli allegati incorporati tramite getBytes sul solo path (la variabile generation locale è un contatore rendering, non generazione Storage). Backup export usa collectStoragePaths, che riduce i riferimenti a un Set di sole stringhe, poi getBytes: aggiungere generation al record senza modificare raccolta/trasporto non preserva il vincolo nell'esportazione. Il prossimo contratto deve coprire questi quattro consumatori e distinguere riferimenti legacy da stage attestati; mapping path-only non sufficiente. Nessun cambiamento runtime da questa ispezione.

Quarto passaggio (11:55 UTC): `applyOfflineMutation` e `runRecoveryCommand` (trash/restore) scrivono `syncRecords`, non direttamente gli Account: esclusi dal write-set diretto Account, senza dedurre indipendenza di tutti i servizi. `manageAccountWidget` scrive `users/uid/accountWidgets`; link/unlink di `manageSharedVaultData` scrive anche `users/uid/sharedVaultLinks` e aggiorna il dato condiviso. Sono riferimenti esterni all'albero Account. Il percorso purge letto in `functions/index.js` pulisce riferimenti nel profilo e nelle aziende, elimina attachments e ricorsivamente l'Account, ma non pianifica queste due collezioni esterne. La risoluzione dei dati bancari widget controlla il bankId, non lo stato archiviato. Il coordinamento deve quindi includere anche creazione/rimozione dei riferimenti esterni; non è sufficiente proteggere il documento Account. Riscontro statico, non prova di concorrenza eseguita e non difetto risolto.

Aggiornamento composizione: il disallineamento descritto nel paragrafo seguente è stato corretto nel sorgente del caricatore mediante `withIntegratedAccountCandidateRules`; verifiche e limiti in COLLAUDI. Non ancora installato nel progetto browser aperto. Il paragrafo conserva l'evidenza iniziale, non descrive il loader attuale.

Composizione effettiva del laboratorio browser: `emulator-browser.mjs` carica `withDocumentAttachmentCandidateRules(withAccountNoteCandidateRules(withQrSelectionCandidateRules(base)))`. La catena include indirettamente link, testo e QR aziendali, ma NON `withAccountStandardCandidateRules`: i test dedicati dei campi standard caricano una composizione diversa. Pertanto il superamento di quei test non certifica la stessa protezione nella configurazione browser. Serve una composizione integrata verificata, non la semplice somma degli esiti delle suite separate. Questa constatazione deriva dai sorgenti del caricatore, non da una rilettura delle Rules attualmente residenti nell'emulatore.

Terzo passaggio: `profile-link-handler` legge e aggiorna sia il vecchio sia il nuovo Account nella transazione. `assertProfileLinkAccount` applica il rifiuto degli archiviati soltanto con `destination: true`: il vecchio Account può quindi essere archiviato e ricevere la rimozione del riferimento inverso. Il fence deve coprire anche questa scrittura, non soltanto la destinazione. I tredici export in `vault-account-entry.mjs` verificano autenticazione/App Check ma non introducono una guardia purge comune.

Le Rules base, lette senza modificarle, mantengono grant ricorsivi owner per Account privati e discendenti aziendali. La composizione `withProfileLinkCandidateRules` esclude accounts dai grant generici, ma introduce grant propri create/update sui campi non protetti e read/write dei discendenti: non è ancora un fence purge. Occorre verificare l'intera composizione effettiva e tutte le concessioni sovrapposte prima di affermare che una guardia server impedisce le scritture concorrenti. Riscontro statico, nessun nuovo test funzionale e nessuna protezione modificata.

Secondo passaggio: vault-repository.js non contiene chiamate dirette setDoc/updateDoc/addDoc/deleteDoc/writeBatch/runTransaction nella ricerca eseguita; non classificarlo automaticamente come writer. profilo-ui carica foto e scrive photoURL, distinto dai metadati storagePath degli allegati Account. deadline-save-service scrive scadenze/configurazioni; dettaglio_scadenza elimina il documento e gestisce transazioni/stato notifiche. ma_save ha update/creazione azienda e upload. dati-azienda-attachments non mostra primitive Firestore di scrittura nella ricerca: seguire le chiamate, non contarlo dal solo nome.

Backend da includere nel perimetro: applyOfflineMutation, applyPrivateAccountMutation, manageSharedVaultData, manageAccountWidget, trashSyncRecord/restoreSyncRecord, restoreBackupChunk e purgeArchivedAccount. Inoltre i tredici export apply* iniziali delegano al bundle generato vault-account-runtime: i sorgenti sono vault-account-entry.mjs e gli handler di experiments/persistent-vault-shell, non modificare il bundle a mano. Fra questi profile-link-handler aggiorna anche vecchio/nuovo Account; profile-document-attachments-handler ha proprie transizioni ready/deleting/removed e trasporto Storage. L'elenco resta incrementale: presenza della primitiva non dimostra ancora il preciso conflitto con purge.

Ricerca statica, non inventario writer chiuso né verifica distribuita. Nei moduli frontend sono presenti upload diretti in dettaglio-privato-attachments, dettaglio-azienda-attachments, deadline-save-service, profilo-ui, ma_save e backup-import-service. I primi due pubblicano metadati con addDoc dopo uploadBytes e cancellano oggetti con deleteObject; il backup pubblica invece i record via callable prima degli upload. profilo_privato importa uploadBytes ma la sola importazione non prova una chiamata. Restano da tracciare scritture indirette, sostituzioni interi record, librerie repository e candidati server/laboratorio.

Riscontro di compatibilità: backup-attachment-stage genera users/uid/restoreObjects/id; archive-purge-service.isSafeAttachmentPath accetta soltanto il prefisso attachments dell'Account privato/aziendale. Pertanto un riferimento candidato riscritto al namespace restoreObjects non è attualmente pianificabile dal purge. Non allargare semplicemente il prefisso: occorrono proprietà/descriptor, generazione verificata e coordinamento dei riferimenti. Entrambi i percorsi rimangono non integrati.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Gli inventari descrivono il perimetro e la data delle fonti. Non fissano politiche e non autorizzano migrazioni. Le proposte D1–D16 del censimento sono la formulazione originaria: per il loro esito successivo usare DECISIONI e domande/M7_CANCELLAZIONE. D1/D2 e D4/D14 non sono tutti privi di decisione; la scrittura client dell’audit è già rimossa nel ramo. I gate di distribuzione restano separati.

I rapporti generati occupano esclusivamente i blocchi delimitati in fondo; i generatori non possono sovrascrivere le parti manuali o ricreare i vecchi MD.

## Indice delle fonti conservate

- [ENCRYPTED_FIELD_INVENTORY.md](#fonte-docs-encrypted-field-inventory-md-l1)
- [M5_INVENTARIO_DATI_CONDIVISI.md](#fonte-docs-m5-inventario-dati-condivisi-md-l1)
- [M7_MAPPA_ELIMINAZIONE_CONDIVISIONE.md](#fonte-docs-m7-mappa-eliminazione-condivisione-md-l1)
- [M7_RETENTION_CENSIMENTO.md](#fonte-docs-m7-retention-censimento-md-l1)

<a id="fonte-docs-encrypted-field-inventory-md-l1"></a>

## Fonte: ENCRYPTED_FIELD_INVENTORY.md — righe originali 1–70

> Provenienza: `docs/ENCRYPTED_FIELD_INVENTORY.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-encrypted-field-inventory-md-inventario-dei-campi-cifrati"></a>

## Inventario dei campi cifrati

> **Stato:** fotografia M1 incompleta rispetto al runtime corrente\
> **Autorità:** inventario tecnico, non decisione architetturale\
> **Baseline:** [Architettura Sicurezza V1](../regole/SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1)\
> **Ultima revisione documentale:** 11 settembre 2026

> **Gate P0:** prima di migrare o rimuovere campi, rigenerare l’inventario su codice e dati reali tramite output esclusivamente aggregato. Includere widget, credenziali comuni, scadenze, notifiche, allegati, cache e tutti i metadati in chiaro.

Inventario M1 ricavato dalle chiamate a `encrypt`, `decrypt` ed `encryptAttachmentFile`. Il formato testuale è gestito da `crypto-utils.js`; gli allegati nuovi sono blob AES-GCM con wrapping per-file.

<a id="evidenza-375ae8a0da076964a6cf"></a>

Compatibilità sperimentale 12/09/2026, base `553a35d5`: verifier/envelope v2 e CPVK2 letti dal gestore in RAM su fixture sintetiche tramite le funzioni originali. Nessuna scrittura o trasformazione dei record. La cache offline dell’anteprima contiene solo file statici fittizi, non sessioni sbloccate o dati reali. [Evidenze](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-13-compatibilità-e-anteprima-offline--12092026).

<a id="evidenza-17672156fb87d1fae220"></a>

Laboratorio 12/09/2026, base `a6f756cc`: `persistent-vault-shell` usa due record fittizi AES-GCM solo in RAM. Nessun campo reale aggiunto o migrato; fixture e credenziale pubblica del laboratorio non sono un nuovo formato Vault produttivo. [Perimetro](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-11-prototipo-autorizzato--12092026).

<a id="evidenza-f1f6458545c941d8a4f0"></a>

Seconda verifica di impatto 12/09/2026, base `67288cc3`: i contatori che invalidano sblocchi/salvataggi precedenti restano solo in RAM. Nessun campo aggiunto allo schema o allo storage. Il cambio Master Password conserva i contenitori cifrati di una scrittura già completata, ma non riapre la Vault dopo logout. [Prove e limiti](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-9-correzione-locale-del-12092026--operazioni-concorrenti).

<a id="evidenza-d88f1d70eef9f2cfb2d0"></a>

Verifica di impatto 12/09/2026, correzione locale logout su base v1.2.110: nessuna aggiunta/rimozione o ricifratura di campi. Cambia soltanto il momento della pulizia della RAM Vault e delle chiavi `vault_session_v1`, `codex_vault_session_wrapping_key_v1`, `vault_s_key`, `vault_s_expiry`, ora prima di tutti i logout espliciti. Verifier, envelope e contenitori WebAuthn non vengono cancellati. L’inventario dei dati reali resta aperto; vedere [Audit Vault §8](AUDIT.md#fonte-docs-audit-vault-session-p0-md-8-correzione-locale-del-12092026--blocco-1-logout).

| Documento / area | Campi cifrati osservati |
|---|---|
| `users/{uid}` profilo | `note`; nei dati legacy anche `nome`, `cognome`, `cf`, `birth_place` possono essere letti cifrati |
| `users/{uid}.documenti[]` | `num_serie`, `cf_value`, `id_number`, `license_number`, `cf`, `rilasciato_da`, `luogo_rilascio`, `username`, `password`, `pin`, `puk`, `codice_app`, `note`, `categoria`, `home_page` |
| `users/{uid}.contactEmails[]` | `password`, `note` |
| `users/{uid}.userAddresses[].utilities[]` | `value` |
| `users/{uid}/accounts/{accountId}` | `username`, `account`/`codice`, `password`, `note`, `banking[].passwordDispositiva`, `banking[].cards[].cardNumber`, `pin`, `ccv` |
| account nelle aziende | `username`, `account`/`codice`, `password`, `numeroIscrizione`, `codiceSocieta`, `note`, `banking[].passwordDispositiva`, `banking[].cards[].cardNumber`, `pin`, `ccv` |
| `users/{uid}/aziende/{aziendaId}` | `note`, `emails.pec.password`, `emails.amministrazione.password`, `emails.personale.password`, `emails.extra[].password` |
| allegati privati, azienda e scadenze | contenuto completo; il record conserva URL/percorso e metadati `encryption` |
| widget profilo | `valueEnc` quando il campo dichiara `encrypted` |

<a id="fonte-docs-encrypted-field-inventory-md-campi-deliberatamente-non-cifrati-nel-modello-attuale"></a>

### Campi deliberatamente non cifrati nel modello attuale

<a id="evidenza-64b853ce972a1e244320"></a>

Restano leggibili dal modello applicativo date e metadati necessari alle liste, telefoni e indirizzi del profilo, anagrafiche aziendali, destinatari email e regole delle Scadenze. È una descrizione dello stato corrente, non una decisione definitiva.

<a id="fonte-docs-encrypted-field-inventory-md-compatibilità"></a>

### Compatibilità

- `_encrypted` segnala i documenti che richiedono decifratura selettiva.
- `decrypt` prova la chiave primaria e, quando presente, il fallback del keyring legacy.
- M1 non riscrive documenti, non rimuove fallback e non cambia lo schema Firestore.

<a id="evidenza-cf3f26ed6b2124c5cf1e"></a>

Verifica sperimentale 12/09/2026, base `ff006c71`: introdotto AbortSignal per il ciclo di sblocco; nessuna variazione dei campi, della cifratura o della persistenza. [Evidenze](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-15-annullamento-e-robustezza-del-laboratorio--12092026).

<a id="evidenza-257a6c8a43c826f6aca1"></a>

Preparazione delle liste 12/09/2026, base `0a807adb`: rimosse le referenze ai record e il contenuto visibile allo smontaggio; invalidata la prosecuzione delle decifrature dopo uscita. Campi, formati e persistenza invariati. [Audit §17](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-17-primo-adattamento-degli-orchestratori-reali--12092026).

<a id="evidenza-10b6a244cfab44c577d3"></a>

Verifica sperimentale 12/09/2026, base `d906fd50`: letture v2 sintetiche collegate al ciclo delle viste e invalidate al cambio identità. Nessun campo o formato persistito modificato; nessun record reale letto o migrato. [Audit §19](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-19-coordinamento-identità-vault-e-viste--12092026).

<a id="evidenza-e19463817b5b82f9f410"></a>

Riscontro emulato 12/09/2026, base `0e07621d`: il lettore candidato rifiuta password non cifrate e ownerId incoerente, che le Rules attuali consentono al proprietario di salvare. Non è stato censito o corretto alcun dato reale. Nessun campo o formato modificato. [Audit §20](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).

<a id="evidenza-a696c0d7f14eed6158e5"></a>

Prova browser locale 12/09/2026, base `83dffc30`: quattro campi sintetici creati cifrati negli emulatori e letti con crypto-utils originale. Nessun inventario, lettura o modifica di dati personali. [Audit §21](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-21-interfaccia-browser-degli-emulatori--12092026).

<a id="evidenza-75ffc6927ba10b9fb1fc"></a>

Integrazione delle liste, 12/09/2026: otto record sintetici con nomeAccount, username, account e password cifrati; soltanto i primi tre campi sono decifrati su copie per ricerca/render. La password resta ciphertext fino al comando esplicito. Nessuna riscrittura del formato o dato reale. [Audit §22](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-22-liste-canoniche-e-repository-negli-emulatori--12092026).

<a id="evidenza-8d9df1ca6bdd443d4384"></a>

Prova dettaglio base, 12/09/2026: nomeAccount, username e account su copie per la vista; password lazy. Proprietario esplicitamente invalido respinto nel percorso candidato, anche se vuoto; campo assente ammesso. Nessun inventario o bonifica di dati reali. [Audit §23](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-23-dettaglio-base-protetto-e-ritorno-alla-lista--12092026).

<a id="evidenza-154df501cdb808eed199"></a>

Fixture locale del dettaglio, 12/09/2026: sei campi cifrati per record (nomeAccount, username, account, password, note, url). URL visualizzato come testo copiabile; nessuna apertura esterna. Questo non certifica né converte eventuali URL in chiaro o alias nei dati produttivi. [Audit §24](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-24-identità-dei-record-e-campi-aggiuntivi-del-dettaglio--12092026).

<a id="evidenza-6b1695e57741cef06542"></a>

Preparazione sperimentale, base `b792b1c0`: patch locale dei sei campi del dettaglio tramite crypto-utils originale. Nessuna ricifratura o migrazione di dati persistiti; compatibilità del titolo/URL con il writer M6 ancora da risolvere. [Audit §25](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-25-preparazione-cifrata-delle-modifiche-nella-sessione-in-ram--12092026).

<a id="fonte-docs-encrypted-field-inventory-md-verifica-circoscritta-banking--candidata-12118-13092026"></a>

### Verifica circoscritta banking — candidata 1.2.118, 13/09/2026

<a id="evidenza-ff1d23dec2570fe2f441"></a>

Codice `4a431ec3`, editor `form-privato-save.js` e `form-azienda-save.js`: `banking[].referenteNome` e `banking[].numeroVerde` sono metadati in chiaro, come i telefoni del referente. `passwordDispositiva`, `cards[].cardNumber`, `cards[].pin` e `cards[].ccv` continuano a essere cifrati dagli stessi writer. È una fotografia del codice, subordinata alla baseline: non approva nuovi usi di dati in chiaro e non chiude l'inventario globale P0. Nessun dato reale letto, cancellato o ricifrato durante l'integrazione. Dipendenze: contratto funzionale e [Audit §51](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-51-integrazione-account-ui-e-vault--candidata-13092026).

<a id="fonte-docs-encrypted-field-inventory-md-verifica-circoscritta-ui-12118--13092026"></a>

### Verifica circoscritta UI 1.2.118 — 13/09/2026

<a id="evidenza-270640aff07a71f7f1d8"></a>

Base `445b338d`, UI `d2ef897e`: nei writer privato e aziendale `banking[].numeroVerde` e `banking[].referenteNome` sono metadati in chiaro, come i telefoni bancari. Password dispositiva, numero carta, PIN e CCV mantengono la cifratura esistente. È una descrizione del codice, non una chiusura dell’inventario globale o una nuova decisione di sicurezza. Nessuna lettura o riscrittura di dati reali durante la preparazione del rilascio.

<a id="fonte-docs-encrypted-field-inventory-md-metadati-posizione-widget--candidata-12119-13092026"></a>

### Metadati posizione Widget — candidata 1.2.119, 13/09/2026

<a id="evidenza-7c46ad58b5e00aefe263"></a>

banking[].bankId e accountWidgets.bankId sono identificativi tecnici non cifrati, privi di IBAN o dati personali. Cifratura e validazione dei valori Widget restano quelle esistenti. Il campo sensibile viene ancora inviato esclusivamente come valueEnc. Nessun dato reale letto o migrato; verifica circoscritta del codice su base a6699e8d, non chiusura dell'inventario globale.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-l1"></a>

## Fonte: M5_INVENTARIO_DATI_CONDIVISI.md — righe originali 1–117

> Provenienza: `docs/M5_INVENTARIO_DATI_CONDIVISI.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-m5--inventario-dei-dati-e-dei-percorsi-condivisi"></a>

## M5 — Inventario dei dati e dei percorsi condivisi

<a id="fonte-docs-m5-inventario-dati-condivisi-md-scopo-e-confine"></a>

### Scopo e confine

<a id="evidenza-16ff576243153661ec8b"></a>

Questo documento fotografa il runtime corrente della condivisione Account, senza modificarlo. Comprende Account privati e aziendali, inviti, notifiche, allegati e cache offline. Le Scadenze condivise sono riportate come confine adiacente: usano destinatari e notifiche comuni, ma hanno copie backend dedicate e non devono essere confuse con il protocollo crittografico Account di M5.

Le Rules e i dati di produzione restano invariati. I percorsi `sharedRecords`, `recordAccess` e le identità crittografiche descritti nel threat model esistono soltanto nel laboratorio.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-inventario-firestore-attuale"></a>

### Inventario Firestore attuale

| Percorso | Scrittore | Lettore | Dati rilevanti | Stato M5 |
|---|---|---|---|---|
| `users/{ownerUid}/accounts/{accountId}` | client proprietario; callable alla risposta invito | proprietario; UID in `sharedWithUids` | contenuto Account, modalità, ACL e metadati | formato legacy da leggere durante la migrazione |
| `users/{ownerUid}/aziende/{aziendaId}/accounts/{accountId}` | client proprietario; callable alla risposta invito | proprietario; UID in `sharedWithUids` | stesso contratto, più contesto aziendale | formato legacy da leggere durante la migrazione |
| sotto-collezione `attachments/{attachmentId}` dei due percorsi Account | client proprietario | proprietario; nel percorso Firestore generico anche l'ACL del record padre non viene riutilizzata esplicitamente | nome, URL Storage, percorso, MIME, dimensione, envelope chiave-file e data | metadati da migrare; accesso condiviso non dimostrato nel runtime corrente |
| `invites/{accountId}_{emailSanitizzata}` | client proprietario; callable aggiorna la risposta | proprietario/mittente o utente con email Auth corrispondente | email mittente e destinatario, ID Account/azienda, nome Account, tipo, canali, stato e date | sostituire con grant deterministico per UID e generazione |
| `users/{uid}/notifications/{notificationId}` | client proprietario e transazioni di revoca | proprietario | titolo, messaggio, tipo evento, nome/ID Account ed email controparte | legacy; testo e identità sono in chiaro |
| `users/{uid}/pushDevices/{deviceId}` | client proprietario | proprietario/backend | token FCM, piattaforma, browser, ambiti e privacy mode | canale, non materiale crittografico |
| `users/{uid}/notificationDeliveries/{deliveryId}` | backend | proprietario | esito tecnico di consegna | telemetria operativa da minimizzare |
| `users/{uid}/receivedDeadlines/{id}` e `deadlineShares/{id}` | backend | destinatario per la copia; backend per indice | copia minima Scadenza e indice tecnico | protocollo separato da M5 Account |

<a id="fonte-docs-m5-inventario-dati-condivisi-md-campi-del-record-account"></a>

### Campi del record Account

<a id="fonte-docs-m5-inventario-dati-condivisi-md-cifrati-oggi-con-la-vault-key-del-proprietario"></a>

#### Cifrati oggi con la Vault Key del proprietario

- `username`, `account`, `password` e `note`;
- per Account azienda anche `numeroIscrizione` e `codiceSocieta`;
- `banking[].passwordDispositiva`;
- `banking[].cards[].cardNumber`, `pin` e `ccv`.

Il destinatario autorizzato dalle Rules riceve il documento ma non possiede, in modo dimostrato, la Vault Key del proprietario. Questa è la lacuna crittografica già confermata dal threat model.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-in-chiaro-nel-documento"></a>

#### In chiaro nel documento

- `nomeAccount`, `url`, `logo` e collegamento eventuale al profilo;
- `referenteNome`, `referenteTelefono`, `referenteCellulare`;
- modalità e classificazione: `type`, `visibility`, `isExplicitMemo`, `isBanking`, `_encrypted`;
- dati bancari non protetti dal codice corrente, tra cui `iban`, tipo/titolare/scadenza carta e riferimenti del referente;
- ACL e stato: `sharedWith`, email/stato/UID di ogni invitato, `sharedWithUids`, `acceptedCount`;
- `createdAt`, `updatedAt` e altri campi legacy eventualmente ancora presenti.

<a id="evidenza-a2e110573e4cc9aba037"></a>

Questi dati sono leggibili da ogni destinatario ammesso sul documento. Nel formato futuro il payload per-record deve includere tutti i dati funzionali che non servono a Rules, query o routing; all'esterno devono rimanere soltanto identificatori opachi, versione schema, generazione chiave e ACL minima.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-flusso-di-lettura-e-scrittura-attuale"></a>

### Flusso di lettura e scrittura attuale

1. I form privato e azienda cifrano soltanto i campi elencati e salvano il documento direttamente dal client.
2. Il client incorpora nel record la mappa `sharedWith` e crea `invites/{accountId}_{emailSanitizzata}` nella stessa transazione.
3. Il destinatario individua gli inviti con una query per `recipientEmail` e `status`.
4. `respondToInvitation`, protetta da autenticazione e App Check, confronta l'email Auth, aggiorna invito e record e inserisce l'UID in `sharedWithUids`.
5. Le Rules consentono al destinatario `get` e `list` dell'intero documento Account quando il suo UID è nell'array.
6. Le liste risolvono gli inviti accettati e poi leggono il percorso Account indicato dall'invito.
7. Revoca o ritorno a privato rimuovono invito e UID e producono notifiche, ma non ruotano materiale crittografico.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-allegati-e-storage-attuali"></a>

### Allegati e Storage attuali

Gli oggetti si trovano in:

- `users/{ownerUid}/accounts/{accountId}/attachments/{nomeCasuale}`;
- `users/{ownerUid}/aziende/{aziendaId}/accounts/{accountId}/attachments/{nomeCasuale}`.

<a id="evidenza-e2642705a16cd967f73d"></a>

Il file è cifrato con una chiave-file casuale AES-GCM. La chiave-file è avvolta con una chiave derivata dalla Vault Key del proprietario; envelope, IV, salt, tipo e dimensione originali sono memorizzati nel documento Firestore dell'allegato. Storage conserva un blob `application/octet-stream` marcato `encrypted=v1`.

<a id="evidenza-6ab5c5c4cd0c24a82c3f"></a>

Le Storage Rules di produzione permettono lettura, creazione, aggiornamento e cancellazione soltanto all'UID proprietario. Pertanto il destinatario non scarica l'allegato e, anche ottenendo il blob, non può aprire l'envelope con la propria Vault Key. Gli URL ottenuti con `getDownloadURL` sono persistiti nei metadati legacy: il nuovo protocollo non deve usarli come autorizzazione e deve preferire letture SDK governate dalle Rules.

Il laboratorio candidato risolve il confine con un percorso opaco condiviso, lo stesso grant Firestore e la stessa `keyGeneration`; scritture e sostituzioni restano backend-only.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-cache-offline-e-memoria-browser"></a>

### Cache offline e memoria browser

- Firestore usa `persistentLocalCache` con gestione multi-tab: record, inviti, notifiche e metadati già letti possono restare nell'IndexedDB gestito dall'SDK.
- `getDocSmart` e `getDocsSmart` privilegiano la cache quando disponibile e aggiornano dal server in background; offline leggono esclusivamente la cache.
- La Vault Key operativa non viene salvata in chiaro in `localStorage`: la sessione usa materiale avvolto in `sessionStorage` e viene eliminata a blocco/logout.
- La cache Firestore non equivale a revoca crittografica. Un ciphertext e un envelope già consegnati possono essere conservati; soltanto una nuova generazione impedisce al revocato di aprire revisioni future.
- Gli allegati vengono aperti da byte scaricati e trasformati in un Object URL temporaneo, revocato dopo 60 secondi. Non esiste oggi una coda locale applicativa di allegati condivisi.
- `sessionStorage` conserva alcuni deep link e bozze di navigazione, non il payload condiviso; `localStorage` conserva preferenze Push e identificatore dispositivo, non deve ricevere segreti o envelope per-record.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-notifiche-ed-email"></a>

### Notifiche ed email

- L'invito può abilitare separatamente `notifyEmail` e `notifyPush`.
- La Cloud Function `onInviteCreated` invia un'email generica e/o un Push; il corpo non contiene password o altri segreti, ma il Push dettagliato può includere `accountName`.
- Le notifiche Firestore di invio e revoca contengono nome Account ed email della controparte in chiaro.
- Il Service Worker usa dati di routing come `eventType`, `deliveryTag`, ID scadenza/notifica; non deve ricevere ciphertext, chiavi o contenuto sensibile.
- I log devono limitarsi a ID tecnici e categoria dell'errore. Il runtime corrente contiene ancora log diagnostici di invito e revoca da riclassificare prima del cutover.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-formati-legacy-rilevati"></a>

### Formati legacy rilevati

- ACL moderne: `sharedWith` come mappa per email sanitizzata e `sharedWithUids` come array.
- destinatari storici: `sharedWithEmails` e `recipientEmail`.
- flag storici rimossi durante una modifica: `shared`, `isMemoShared`, `hasMemo`.
- il modulo azienda conserva anche un renderer alternativo capace di trattare gli ospiti come array e di fare auto-healing client; non deve sopravvivere al contratto canonico.
- allegati senza `encryption` vengono ancora aperti tramite l'URL legacy esterno.

<a id="fonte-docs-m5-inventario-dati-condivisi-md-rischi-e-decisioni-per-il-cutover"></a>

### Rischi e decisioni per il cutover

| Priorità | Evidenza | Decisione richiesta |
|---|---|---|
| Bloccante | ACL concede il documento, ma la Vault Key resta del proprietario | payload cifrato con chiave per-record e envelope individuali |
| Bloccante | revoca corrente non ruota alcuna chiave | nuova `keyGeneration` per ogni revisione successiva alla revoca |
| Alta | Storage proprietario e allegati avvolti dalla Vault Key | percorso condiviso governato dallo stesso grant e wrapping con record key |
| Alta | molti metadati personali e bancari restano in chiaro | allowlist minima dei metadati esterni al payload |
| Alta | invito identificato da Account più email e ACL duplicate nel record | grant per UID, stato e generazione scritto dal backend |
| Alta | cache persistente conserva dati già consegnati | messaggio utente esplicito: revoca futura, non cancellazione remota delle copie |
| Media | logica revoca duplicata e forma ospiti mappa/array | servizio canonico unico prima della migrazione |
| Media | `getDownloadURL` legacy è persistito | eliminazione graduale dei token URL dopo lettore retrocompatibile |
| Media | notifiche espongono nome Account/email | modalità discreta predefinita e payload Push minimo |

<a id="fonte-docs-m5-inventario-dati-condivisi-md-gate-dellinventario"></a>

### Gate dell'inventario

- [x] percorsi Account privato e aziendale;
- [x] inviti, ACL, accettazione e revoca;
- [x] campi cifrati e metadati in chiaro;
- [x] documenti e oggetti allegato;
- [x] cache Firestore, sessione Vault e comportamento offline;
- [x] notifiche Firestore, Push ed email;
- [x] formati legacy e implementazioni concorrenti;
- [x] separazione esplicita dal dominio Scadenze.

L'inventario è completo per progettare il piano di integrazione. Non autorizza ancora migrazioni, modifica delle Rules o scritture su dati reali.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-l1"></a>

## Fonte: M7_MAPPA_ELIMINAZIONE_CONDIVISIONE.md — righe originali 1–186

> Provenienza: `docs/M7_MAPPA_ELIMINAZIONE_CONDIVISIONE.md` a `2900ccc0`.  Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-m7-r4--mappa-eliminazione-e-condivisione"></a>

## M7-R4 — Mappa eliminazione e condivisione

> **Stato:** censimento in sola lettura. **Nessuna decisione presa** e nessuna modifica al comportamento attuale.
> **Autorità:** subordinato a [Architettura Sicurezza V1](../regole/SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1), a [M7 — Cronologia, cestino e audit](../regole/CANCELLAZIONE.md#fonte-docs-m7-cronologia-cestino-audit-md-l1) e a [M7 — Censimento retention](INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1).
> **Revisione:** 21/09/2026, riferimento applicativo `v1.2.127`, base `b5df2f2b`.
> **Perimetro:** sola lettura e documentazione. Nessuna modifica a runtime, Rules, Functions, dati reali, versione o `master`; nessun test distruttivo; M8–M10 non avviati.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-0-come-leggere"></a>

### 0. Come leggere

| Stato | Significato |
|---|---|
| **verificato nel codice** | la proprietà è dimostrata dalle righe citate |
| **verificato nelle Rules** | la proprietà è dimostrata dalle Rules citate |
| **non implementata** | l'azione non esiste in nessun percorso del codice distribuito |
| **non verificata** | non è dimostrabile da questo repository |

**Produttivo** = `Frontend/public/**`, `functions/**`, `firestore.rules`, `storage.rules`. **Laboratorio** = `experiments/**` (non raggiungibile dall'app).

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-1-i-quattro-casi"></a>

### 1. I quattro casi

| # | Caso | Chi è il proprietario | Dove vive il record | Chi lo vede |
|---|---|---|---|---|
| 1 | Account proprio non condiviso | l'utente | `users/{uid}/accounts/{id}` o `users/{uid}/aziende/{cid}/accounts/{id}` | solo il proprietario |
| 2 | Account proprio condiviso con ospiti | l'utente | stesso percorso, con `sharedWith`/`sharedWithUids` valorizzati | proprietario + ospiti accettati |
| 3 | Account di altro proprietario ricevuto | un altro utente | resta nel percorso del **proprietario**; l'ospite lo legge da lì | proprietario + l'ospite accettato, **solo lettura** |
| 4 | Account proprio collegato a credenziali comuni | l'utente | stesso percorso del caso 1/2 più `sharedVaultData`/`sharedVaultLinks` e i widget in `accountWidgets` | solo il proprietario (le collezioni comuni sono del proprietario) |

<a id="evidenza-f14a2fcde73e09519436"></a>

Il caso 3 non crea **nessun documento Account separato** nella raccolta Firestore dell'ospite: la lista dell'ospite legge il documento del proprietario (`Frontend/public/assets/js/modules/privato/account_privati.js:205-216`) e ne conserva una copia **in memoria JavaScript**, inserendola in `allAccounts` (`:226,255`). La distinzione è importante: la copia esiste nel processo del browser e può restare nella cache locale di Firestore, ma **non** è una seconda persistenza né un documento nella raccolta dell'ospite.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-2-modello-tecnico-della-condivisione-verificato"></a>

### 2. Modello tecnico della condivisione (verificato)

- La condivisione è una **mappa sul documento dell'Account**: `sharedWith = { <email normalizzata>: {email, status, uid} }`, più gli indici `sharedWithUids` (solo ospiti `accepted` con `uid`) e `acceptedCount`, e `visibility: 'shared'` (`Frontend/public/assets/js/modules/privato/form-privato-save.js:311-407`; stessa logica per l'azienda in `.../azienda/form-azienda-save.js:220-315`; pannello in `.../shared/detail-account-mode.js:142-182`).
- **Regola dell'ospite accettato**: `isAcceptedGuest()` vale se l'UID autenticato è dentro `sharedWithUids` del documento (`firestore.rules:10-12`).
- **Lettura dell'ospite, sola lettura**: `users/{userId}/accounts/{accountId}`, la variante aziendale e la collection-group `{path=**}/accounts/{accountId}` concedono **solo `get, list`** all'ospite accettato (`firestore.rules:164-172`). Nessuna scrittura, nessuna cancellazione, nessun accesso alle sottocollezioni.
- **Inviti**: `invites/{inviteId}` è leggibile dal proprietario (`ownerId`/`senderId`) **o** dal destinatario per email; creazione, modifica e cancellazione sono riservate al proprietario dell'invito (`firestore.rules:174-202`). L'accettazione o il rifiuto passano quindi da una callable, non da una scrittura client: `respondToInvitation` (`Frontend/public/assets/js/main-v129.js:567-568`).
- **Credenziali comuni e widget**: `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` sono **leggibili solo dal proprietario e non scrivibili da alcun client** (`firestore.rules:149-162`); le scritture passano dalle callable backend. L'ospite **non** ha accesso a queste collezioni del proprietario.
- **Esclusione dell'ospite nel resto dell'app** (verificato nel codice): il flag `_isGuest` esclude il record dal collegamento ai Profili e dalle liste aziendali (`Frontend/public/assets/js/modules/azienda/company-profile-ui.js:57`, `.../azienda/company-profile-link.js:21`, `.../shared/profile-account-management.js:12`, `.../privato/profilo-links.js:64`) e dalle scritture offline ridotte M6 (`Frontend/public/assets/js/modules/privato/private-account-offline-policy.js:22-28`).
- **Cache offline e backup includono le collezioni comuni**: `sharedVaultData` e `accountWidgets` sono nella preparazione offline (`Frontend/public/assets/js/offline-sync.js:12,113`) e nel backup (`Frontend/public/assets/js/modules/settings/backup-export-service.js:84-98`).

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-21-ciclo-di-vita-dellinvito-verificato"></a>

#### 2.1 Ciclo di vita dell'invito (verificato)

1. **Creazione** — il proprietario, dal client e in transazione, crea `invites/{accountId}_{emailSanitizzata}` con `status: 'pending'` e aggiunge `sharedWith[chiaveEmail] = {email, status: 'pending', uid: null}` (`Frontend/public/assets/js/modules/privato/form-privato-save.js:353-373`; varianti aziendali in `.../azienda/form-azienda-save.js:267-281` e `.../shared/detail-account-mode.js:164-173`). La chiave email è normalizzata togliendo ogni carattere non alfanumerico.
2. **Notifica** — un trigger backend avvisa il destinatario con email o push (`functions/index.js:1320-1368`).
3. **Accettazione o rifiuto** — solo tramite la callable `respondToInvitation` (`functions/index.js:1187-1246`), che accetta esclusivamente `accepted` o `rejected` ed esige che l'invito sia ancora `pending`; il client la invoca da `Frontend/public/assets/js/main-v129.js:566-568`.
4. **Effetti dell'accettazione** — sul documento del **proprietario**: `sharedWith[guestKey]` aggiornato con `uid`, `sharedWithUids` ricalcolato, `acceptedCount`, `visibility: 'shared'`, `updatedAt` (`functions/index.js:1226-1237`); sul documento invito: `status`, `guestUid`, `respondedAt` (`:1238-1242`).
5. **Revoca** — solo dal proprietario, con tre percorsi client: pannello del dettaglio privato (`.../privato/dettaglio-privato-sharing.js:92-171`), pannello del dettaglio aziendale (`.../azienda/dettaglio-azienda-sharing.js:199-292`) e cambio modalità dell'Account (`.../shared/detail-account-mode.js:145-185`). L'effetto è la rimozione dell'ospite da `sharedWith`, il ricalcolo di `sharedWithUids`/`acceptedCount`/`visibility` e la cancellazione del documento invito. Il **destinatario non può** modificare né cancellare l'invito (`firestore.rules:201`).
6. **Nessuna scadenza**: non esiste alcun campo di scadenza o TTL sugli inviti o sulla condivisione.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-22-cosa-vede-lospite-nel-dettaglio"></a>

#### 2.2 Cosa vede l'ospite nel dettaglio

<a id="evidenza-589331f680287bf21a65"></a>

Il dettaglio privato imposta `ownerId` dall'URL e attiva la modalità sola lettura quando `ownerId !== uid` (`Frontend/public/assets/js/modules/privato/dettaglio_account_privato.js:91-92`), mostrando il banner «Account condiviso in sola lettura». I pulsanti di copia restano attivi. **Verificato nel codice**: la chiave Vault è per-UID (`Frontend/public/assets/js/modules/core/security-manager.js:399-404`) e il lettore di record condivisi è disattivato (`Frontend/public/assets/js/modules/data/shared-record-reader.js:12`, `SHARED_RECORD_READER_ENABLED = false`); **non verificato**: che cosa la schermata mostri effettivamente a un ospite e se il valore copiato sia ciphertext. Questa sezione non dichiara provato il comportamento dell'interfaccia: la prova statica riguarda il lettore disattivato e la derivazione per-UID della chiave, non l'esito visibile. Le sezioni dei widget e delle credenziali del proprietario sono nascoste in sola lettura (`.../shared/account-embedded-widgets.js:438`) e l'ospite non può scaricare gli allegati (`storage.rules:33-36`). **La decifratura lato ospite non è implementata**: il prototipo con chiave per record è di laboratorio.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-3-azioni-per-caso"></a>

### 3. Azioni per caso

Legenda: **Sì** = disponibile a quel ruolo; **No** = impedito da UI o Rules; **—** = non applicabile.

| Azione | Caso 1 proprietario | Caso 2 proprietario | Caso 2 ospite | Caso 3 ospite | Caso 4 proprietario | Dove |
|---|---|---|---|---|---|---|
| Vedere il record | Sì | Sì | Sì | Sì | Sì | `firestore.rules:106-118,164-172` |
| Archiviare (cestino) | Sì | Sì | **No** | **No** | Sì | `.../privato/account_privati.js:371`, `.../azienda/account_azienda.js:249` |
| Ripristinare | Sì | Sì | **No** | **No** | Sì | `.../settings/archive-account-service.js:159-194` |
| Eliminare dalla lista | Sì, ma **sposta nell'Archivio** (M7-R6) | Sì, ma **sposta nell'Archivio** | **No** | **No** (bloccato in UI) | Sì, ma **sposta nell'Archivio** | `.../privato/account_privati.js:392-402`, `.../azienda/account_azienda.js:271-286`, `.../azienda/form-azienda-save.js:326-340` |
| Purge definitivo da Archivio | Sì | Sì | **No** | **No** | Sì | `functions/index.js:448-537` |
| Revocare l'accesso a un ospite | — | Sì | **No** | **No** | — | `.../privato/dettaglio-privato-sharing.js:105-157`, `.../azienda/dettaglio-azienda-sharing.js:212-277`, `.../shared/detail-account-mode.js:137-187` (corretto in M7-R5) |
| Rinunciare alla condivisione (lato ospite) | — | — | — | **non implementata** | — | nessun percorso trovato |
| Modificare le credenziali comuni collegate | — | — | — | — | Sì | `firestore.rules:154-162` + callable backend |
| Accettare o rifiutare un invito | — | — | **No** (è il destinatario) | Sì, solo se `pending` | — | `functions/index.js:1187-1207` |
| Modificare o cancellare un invito | Sì | Sì | **No** | **No** | — | `firestore.rules:201` |
| Copiare i valori dell'Account | Sì | Sì | Sì (sui record cifrati copia ciphertext) | Sì (ciphertext) | Sì | `.../privato/dettaglio_account_privato.js:420-448` |
| Vedere i widget del proprietario | Sì | Sì | **No** | **No** | Sì | `.../shared/account-embedded-widgets.js:438` |
| Scaricare gli allegati | Sì | Sì | **No** | **No** | Sì | `storage.rules:33-36` |
| Leggere la rubrica contatti del proprietario | Sì | Sì | **No** | **No** | Sì | `firestore.rules:120-123` |

<a id="evidenza-c3a128e29ae22a873d31"></a>

**Perché l'ospite non può eliminare**: la lista marca le card ricevute con `data-owner` diverso da `true` e la cancellazione esce subito con «solo il proprietario può eliminare» (`.../privato/account_privati.js:216,385`). Anche senza quel controllo, le Rules negherebbero la scrittura.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-4-deletedoc-dalla-lista-contro-purgearchivedaccount"></a>

### 4. `deleteDoc` dalla lista contro `purgeArchivedAccount`

| Aspetto | Eliminazione dalla lista | Purge da Archivio |
|---|---|---|
| Chi | proprietario | proprietario, con conferma esplicita `DELETE_FOREVER` |
| Operazione | `batch.delete` (privato) / `deleteDoc` (azienda) | callable `purgeArchivedAccount` |
| Documento Account | eliminato | eliminato |
| Sottocollezioni (metadati allegati) | **restano** | eliminate con `recursiveDelete` |
| Oggetti su Storage | **restano** | eliminati per i percorsi elencati nei metadati |
| Riferimenti in Profilo/Aziende | solo `contactEmails` del Profilo privato, con confronto sul solo ID (privato); **nessuno** per l'azienda | pulizia pianificata su Profilo e su tutte le aziende |
| Widget, credenziali comuni, inviti | **restano** | **restano** (planner esistente ma non attivo) |
| Ricevuta di idempotenza | **nessuna** | `mutationResults/{uid}/operations/{operationId}` |
| Audit | **nessuno** | evento `account-purged` in `auditEvents` |
| Ripetibile / ripristinabile | no: il documento non esiste più | sì: ricevuta `processing` con ripresa |

<a id="evidenza-c08e3b5e54f4c23cd026"></a>

Conseguenza verificata: dopo un'eliminazione dalla lista il purge **non è più applicabile** a quell'Account (`purgeDecision` risponde `not-found`, `functions/archive-purge-service.js:45`), quindi metadati e byte restano orfani senza un percorso applicativo che li rimuova. Il confronto con il solo ID del Profilo privato è già registrato come difetto storico in `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md` §«Riesame dopo evoluzione Profili».

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-5-ospite-dopo-laccettazione"></a>

### 5. Ospite dopo l'accettazione

1. L'ospite accetta con la callable `respondToInvitation` (`Frontend/public/assets/js/main-v129.js:567-568`).
2. La sua lista carica gli inviti accettati per la propria email e legge il documento del proprietario, marcandolo `isOwner: false`, `ownerId: <proprietario>`, `_isGuest: true` (`.../privato/account_privati.js:193-216`).
3. Da quel momento può **soltanto leggere**: le Rules concedono `get, list` e nulla più (`firestore.rules:164-172`).
4. Il proprietario può **revocare**: la mappa `sharedWith` viene aggiornata, `sharedWithUids` ricalcolato e all'ospite arriva una notifica `share_revoked` (`.../shared/detail-account-mode.js:151-153`). Da quel momento l'ospite non è più in `sharedWithUids` e la lettura decade.
5. **Non implementata**: un'azione dell'ospite per rinunciare alla condivisione dopo l'accettazione. L'ospite può solo rifiutare un invito **pendente**; dopo l'accettazione dipende dalla revoca del proprietario.

<a id="evidenza-211d1853246d7ddb2e45"></a>

**Non verificata**: se e come l'ospite riesca a **decifrare** i valori dell'Account ricevuto. Le chiavi di condivisione esistono solo come prototipo di laboratorio (`experiments/sharing-key-prototype`), mentre `sharedVaultData`/`sharedVaultLinks`/`accountWidgets` del proprietario non sono leggibili dall'ospite (`firestore.rules:149-162`): il comportamento effettivo della schermata di dettaglio per un ospite richiede una verifica dedicata.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-6-effetti-e-sopravvivenza-degli-elementi"></a>

### 6. Effetti e sopravvivenza degli elementi

Colonne: **1L** = caso 1 eliminazione dalla lista; **1P** = caso 1 purge da Archivio; **2** = caso 2 (Account proprio condiviso); **3** = caso 3 (ospite); **4** = caso 4 (credenziali comuni collegate).

| Elemento | 1L | 1P | 2 | 3 | 4 | Evidenza |
|---|---|---|---|---|---|---|
| Documento Account | eliminato | eliminato | eliminato | resta del proprietario, l'ospite non può toccarlo | eliminato | M7-R1 §3.3-3.4; `firestore.rules:164-172` |
| Metadati allegati (sottocollezione) | **restano** | eliminati | restano | — | restano | `recursiveDelete` solo nel purge (`functions/index.js:507`) |
| Oggetti su Storage | **restano** | eliminati per i percorsi elencati | restano | — | restano | `functions/index.js:500-506` |
| Inviti (`invites/{id}`) | **restano** | restano | restano | restano, anche se l'Account non esiste più | restano | `firestore.rules:174-202`; nessun percorso li elimina |
| Accesso dell'ospite | decade con il documento | decade con il documento | decade con il documento o con la revoca | decade con la revoca del proprietario | — | `firestore.rules:10-12` |
| Widget (`accountWidgets`) | restano | restano | restano | non leggibili dall'ospite | restano | `firestore.rules:149-152`; planner non attivo |
| Credenziali comuni (`sharedVaultData`, `sharedVaultLinks`) | restano | **restano** | restano | non leggibili dall'ospite | **restano per progetto** | `firestore.rules:154-162`; `functions/archive-purge-reference-plan.js:16-18,32` |
| Riferimenti in Profilo/Aziende | solo `contactEmails` privati, confronto sul solo ID | pulizia pianificata su Profilo e aziende | come 1L | — | come 1L | `.../privato/account_privati.js:390-402`; `functions/index.js:517-528` |
| Audit (`auditEvents`) | **nessun evento** | evento `account-purged` | nessuno | nessuno | nessuno | `functions/index.js:530-533` |
| Ricevute (`mutationResults`) | nessuna | ricevuta `processing`/`purged` | nessuna | nessuna | nessuna | `functions/index.js:470,489-492,529` |
| Backup `.cpbackup` già esportato | intatto (file locale) | intatto | intatto | intatto | intatto | `.../settings/backup-export-service.js:161` |
| Cache del dispositivo | non ripulita | non ripulita | non ripulita | non ripulita | non ripulita | `Frontend/public/assets/js/firebase-config.js:56-58`, `offline-sync.js:110-117` |

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-7-trabocchetti-verificati-e-azioni-non-implementate"></a>

### 7. Trabocchetti verificati e azioni non implementate

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-71-trabocchetti-verificati-nel-codice-e-nelle-rules-non-coperti-da-test"></a>

#### 7.1 Trabocchetti (verificati nel codice e nelle Rules, non coperti da test)

1. **La revoca di un ospite che ha già accettato falliva per intero — provato con test e RISOLTO in M7-R5.** Le vie di revoca scrivevano, dentro la stessa transazione, una notifica in `users/{guestUid}/notifications`. Le Rules non hanno alcuna regola per `notifications`: il percorso ricade nella wildcard del proprietario (`firestore.rules:106-118`), che richiede `isOwner(userId)`. Il proprietario non è proprietario del percorso dell'ospite, quindi la scrittura era negata e — essendo dentro una transazione — **annullava anche la rimozione dell'ospite**.

<a id="evidenza-b51c24401d56ca717e78"></a>

   **Prova** (`tests/sharing-revocation.rules.test.mjs`, Rules **produttive**, emulatore, dati sintetici): il proprietario scrive nella propria raccolta di notifiche ma non in quella dell'ospite; la transazione di revoca **senza** la notifica all'ospite riesce (controllo); la transazione con la notifica dentro viene **rifiutata interamente** e lascia l'Account invariato.

<a id="evidenza-c7ca4b312e6202378f11"></a>

   **Correzione (M7-R5, completata dopo la revisione Codex del 21/09/2026):** il tentativo di scrittura nella raccolta `notifications` dell'ospite è stato **eliminato dal client** in tutti i sette punti di scrittura in cinque file — `.../privato/dettaglio-privato-sharing.js`, `.../azienda/dettaglio-azienda-sharing.js`, `.../shared/detail-account-mode.js`, `.../privato/form-privato-save.js` (due punti), `.../azienda/form-azienda-save.js` (due punti). Il client **non tenta più** una scrittura che le Rules vietano: dopo il commit confermato seguono soltanto il messaggio di esito e il ricaricamento già esistenti, senza attese aggiunte. Le notifiche al **proprietario** restano dentro la transazione e le Rules non sono state ampliate. Prove: suite Rules **29/29** (comprese lettura dell'ospite prima della revoca e rifiuto dopo), `tests/share-revocation-paths.test.mjs` (guardia: nessun percorso notifiche non proprietario, nessuna attesa aggiunta dopo il commit).

<a id="evidenza-cb12a4a2b1bc44bca38f"></a>

   **Limite dichiarato, nessuna consegna annunciata:** la notifica all'ospite **non viene recapitata**. Serve un percorso backend dedicato (callable con Admin SDK), **non implementato**; la proposta va valutata in un incarico separato e non autorizza da sola un ampliamento delle Rules.
2. **`respondToInvitation` non incrementa `revision`.** L'accettazione aggiorna `sharedWith`, `sharedWithUids`, `acceptedCount`, `visibility` e `updatedAt` senza toccare `revision` (`functions/index.js:1231-1237`), mentre gli altri percorsi usano `increment(1)` (`.../shared/detail-account-mode.js:183`) e l'archiviazione `revision + 1` (`.../settings/archive-account-model.js:6`). Il purge richiede l'uguaglianza esatta della revisione (`functions/archive-purge-service.js:47-48`): dopo un'accettazione la revisione non descrive più lo stato del documento.
3. **Una credenziale comune collegata a un Account archiviato diventa non scollegabile e non eliminabile.** Il selettore dei collegamenti elenca solo gli Account non archiviati (`Frontend/public/assets/js/modules/settings/shared-credentials-controller.js:84,88`), mentre la callable rifiuta di eliminare una credenziale finché esistono collegamenti (`functions/index.js:294-299`, «Scollega prima tutti gli Account»). Archiviare l'Account toglie quindi l'unico modo per scollegarla.
4. **Archiviare un Account condiviso non avvisa gli ospiti e rende la revoca irraggiungibile.** L'archiviazione non tocca `sharedWithUids` e le Rules non guardano `isArchived`: l'ospite continua a vedere l'Account (`.../privato/account_privati.js:216,226-255`; il filtro `!isArchived` a `:253` vale solo per gli Account propri). Dall'Archivio non esiste un percorso verso il dettaglio dell'Account archiviato, quindi il proprietario non può revocare finché non lo ripristina.
5. **Eliminazione dalla lista e purge non erano equivalenti — RISOLTO in M7-R6 per gli Account propri.** Il pulsante «Elimina» ora **sposta nell'Archivio** tramite `archiveAccount` (archiviazione canonica con controllo di revisione) invece di cancellare il documento; la cancellazione definitiva resta soltanto dall'Archivio con `purgeArchivedAccount`. Restano invariati i limiti già dichiarati: il purge elimina solo gli allegati elencati nei metadati, e widget, credenziali comuni e inviti non vengono toccati da nessuna delle due operazioni. Le eliminazioni **dirette** di un'Azienda (`.../azienda/company-list-service.js:9`, `.../azienda/ma_save.js:204`) restano fuori da questa fetta: non sono Account e mantengono il comportamento precedente (le sottocollezioni degli Account contenuti restano).
6. **`auditEvents` è cancellabile dal proprietario nelle Rules produttive** *(stato al momento del censimento)*: nessuna regola dedicata, ricadeva nella wildcard (`firestore.rules:106-118`). **Riconciliato in M7-AUDIT-7:** nel **ramo locale** il registro è escluso dal catch-all proprietario e ha un blocco dedicato in sola lettura (M7-AUDIT-2), quindi il client non può più creare, modificare o cancellare eventi; `tests/audit-events.rules.test.mjs` lo prova. La modifica vale **solo nel ramo** finché le Rules non saranno distribuite, e `trash`/`recordHistory` restano fuori da quella fetta.
7. **Il restore di un backup riscrive anche i percorsi condivisi** (`functions/index.js:590-596`) senza toccare inviti, `accountWidgets`, `sharedVaultData` o `sharedVaultLinks`.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-72-azioni-non-implementate"></a>

#### 7.2 Azioni non implementate

1. **Rinuncia dell'ospite** dopo l'accettazione: non esiste alcun percorso (l'ospite può solo rifiutare un invito pendente).
2. **Rimozione dell'Account ricevuto dalla lista dell'ospite**: non implementata; l'unica via è la revoca del proprietario.
3. **Pulizia degli inviti** quando l'Account del proprietario viene eliminato o purgato: l'invito resta come documento che punta a un Account inesistente; la lista dell'ospite lo salta silenziosamente (`.../privato/account_privati.js:217-218`).
4. **Eliminazione di widget, credenziali comuni e collegamenti** durante il purge: il planner esiste ma è esplicitamente non collegato (`functions/archive-purge-reference-plan.js:16-18,32`).
5. **Eliminazione degli allegati** sull'eliminazione dalla lista: nessun percorso la esegue.
6. **Notifica all'ospite** quando il proprietario elimina dalla lista (invece della revoca): non prevista.
7. **Decifratura dell'Account ricevuto dall'ospite**: non implementata; la chiave di condivisione esiste solo come prototipo di laboratorio.
8. **Immutabilità dell'audit in produzione** e **retention a 24 mesi**: decise ma non attive (sezione M7-R3 del contratto d'area).

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-8-opzioni-decisionali-per-diego"></a>

### 8. Opzioni decisionali per Diego

Le opzioni sono descritte in linguaggio semplice; **nessuna è decisa** da questo documento e la pulizia dei dati condivisi o la rinuncia dell'ospite non vengono proposte come obbligatorie.

| Caso | Cosa significa oggi «Elimina» | Cosa resta oggi | Opzioni da scegliere |
|---|---|---|---|
| **1** — Account proprio non condiviso | il record sparisce subito e definitivamente, **senza** passare dal cestino | metadati degli allegati e byte su Storage restano; nessun evento di audit | (a) lasciare com'è; (b) far passare «Elimina» dal cestino, così la cancellazione definitiva resta al purge; (c) lasciare com'è ma avvisare che gli allegati restano |
| **2** — Account proprio condiviso | come il caso 1; l'accesso degli ospiti decade con il documento | widget e credenziali comuni collegate restano; gli inviti restano | (a) lasciare com'è; (b) rimuovere anche i collegamenti ai widget/credenziali comuni (il planner è pronto ma inattivo); (c) avvisare gli ospiti con una notifica |
| **3** — Account ricevuto come ospite | l'ospite **non** può eliminare né archiviare: dipende dal proprietario | dopo la revoca l'ospite perde la lettura; l'invito resta come documento orfano | (a) lasciare com'è; (b) dare all'ospite un'azione di rinuncia; (c) pulire gli inviti orfani quando l'Account non esiste più |
| **4** — Account con credenziali comuni | il record sparisce ma le credenziali comuni **non** vengono toccate | `sharedVaultData`/`sharedVaultLinks` restano, anche se non più usati da quell'Account | (a) lasciare com'è (la credenziale comune può servire ad altri Account); (b) eliminare solo i collegamenti, mai il valore comune; (c) chiedere all'utente cosa fare |

Domande aperte collegate, già registrate in M7: durata e modalità del cestino (deciso: nessuna scadenza automatica), sorte dei widget/credenziali comuni dopo un purge, e comportamento dell'ospite dopo la revoca.

<a id="evidenza-ca9a76d2bd0a7694d834"></a>

**Due trabocchetti della sezione 7 non sono scelte di retention ma difetti funzionali** e richiedono una decisione separata: (a) la revoca di un ospite che ha accettato può fallire per la notifica scritta nel percorso dell'ospite; (b) una credenziale comune collegata a un Account archiviato non è più scollegabile né eliminabile. Nessuno dei due è coperto da test: la correzione va valutata da Codex come incarico dedicato, non decisa qui.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-9-limiti-e-voci-non-verificate"></a>

### 9. Limiti e voci `non verificate`

1. **Decifratura dell'Account ricevuto dall'ospite**: `non verificata`. Le chiavi di condivisione sono un prototipo di laboratorio e l'ospite non accede alle collezioni comuni del proprietario; il comportamento reale della schermata di dettaglio richiede una prova dedicata (ambiente non produttivo o emulatori con condivisione reale).
2. **Regole effettivamente distribuite**: questo censimento legge `firestore.rules` e `storage.rules` del ramo, non ciò che è pubblicato sul progetto.
3. **Dati reali**: nessuna lettura; non è possibile dire quante condivisioni, inviti orfani o collegamenti a credenziali comuni esistano davvero.
4. **Comportamento lato server delle callable** `respondToInvitation`, `manageSharedVaultData`, `manageAccountWidget`: verificato nel codice del repository, non su un ambiente distribuito.
5. **Backup**: il contenuto effettivo di un `.cpbackup` rispetto agli Account ricevuti e alle credenziali comuni non è stato provato con un file reale.
6. **Nessun test copre le Rules produttive** per l'ospite accettato (`isAcceptedGuest()`), per la lettura di `users/{owner}/accounts` da parte di un ospite o per `invites`: i punti 2 e 3 della sezione 2 sono dimostrati dal codice e dalle Rules, non da test.
7. **Il fallimento della revoca è provato** sulle Rules produttive con l'emulatore ed è stato **corretto in M7-R5**; resta **non verificato** il comportamento dell'app reale, perché il codice corretto non è stato eseguito in un browser né contro un ambiente distribuito, e la notifica all'ospite continua a non essere consegnabile dal client.
8. **Nessun test verifica la sopravvivenza** di widget, collegamenti e inviti dopo un purge.
9. **Ambito effettivo della regola ospite**: `match /{path=**}/accounts/{accountId}` (`firestore.rules:170-172`) autorizza `get, list` su qualunque documento che termini in `/accounts/{id}`, per chiunque risulti in `sharedWithUids` di quel documento; l'effetto pratico su collezioni inattese non è verificato.

**Limiti di metodo:** censimento statico su codice, Rules e configurazione versionata; nessun test distruttivo, nessuna esecuzione contro il progetto, nessun dato reale.

<a id="fonte-docs-m7-mappa-eliminazione-condivisione-md-10-riferimenti"></a>

### 10. Riferimenti

- [M7 — Cronologia, cestino e audit](../regole/CANCELLAZIONE.md#fonte-docs-m7-cronologia-cestino-audit-md-l1): contratto d'area, purge, riesame dei riferimenti residui.
- [M7 — Censimento retention](INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1): comportamento attuale di cestino, audit, allegati e backup.
- [Architettura Sicurezza V1](../regole/SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1): cancellazione coordinata record/allegati e retention.
- Prove sintetiche collegate: `tests/sharing-revocation.rules.test.mjs` (revoca dell'ospite sulle Rules produttive, emulatore) e, per la retention audit, `experiments/history-recovery/audit-retention.test.mjs`.
- Codice citato: `firestore.rules`, `storage.rules`, `functions/index.js`, `functions/archive-purge-service.js`, `functions/archive-purge-reference-plan.js`, `Frontend/public/assets/js/modules/privato/account_privati.js`, `.../privato/form-privato-save.js`, `.../privato/dettaglio-privato-sharing.js`, `.../privato/private-account-offline-policy.js`, `.../privato/profilo-links.js`, `.../azienda/account_azienda.js`, `.../azienda/form-azienda-save.js`, `.../azienda/dettaglio-azienda-sharing.js`, `.../azienda/company-profile-ui.js`, `.../azienda/company-profile-link.js`, `.../shared/detail-account-mode.js`, `.../shared/profile-account-management.js`, `.../settings/archive-account-service.js`, `.../settings/backup-export-service.js`, `Frontend/public/assets/js/main-v129.js`, `Frontend/public/assets/js/offline-sync.js`, `Frontend/public/assets/js/firebase-config.js`.

<a id="fonte-docs-m7-retention-censimento-md-l1"></a>

## Fonte: M7_RETENTION_CENSIMENTO.md — righe originali 1–678

> Provenienza: `docs/M7_RETENTION_CENSIMENTO.md` a `2900ccc0`. Censimento e proposte alla base originale: per D1/D2/D4/D14 successivi e D3 attuato nel ramo consultare DECISIONI. Non è l’elenco corrente delle domande aperte. Fonte datata; non assegna lavoro e non aggiorna la produzione.

<a id="fonte-docs-m7-retention-censimento-md-m7-r1--censimento-retention-e-proposta-di-politica"></a>

## M7-R1 — Censimento retention e proposta di politica

> **Stato:** censimento in sola lettura consegnato per verifica; **nessuna politica di retention approvata**, nessuna durata decisa.
> **Autorità:** subordinato a [Architettura Sicurezza V1](../regole/SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1) (baseline) e a [M7 — Cronologia, cestino e audit](../regole/CANCELLAZIONE.md#fonte-docs-m7-cronologia-cestino-audit-md-l1) (contratto d'area).
> **Revisione:** 21/09/2026, riferimento applicativo `v1.2.127`, base di lavoro `7ce5a989`.
> **Area:** retention attuale di cestino, cronologia/audit, allegati e backup.
> **Perimetro:** sola analisi in lettura e documentazione. Nessuna modifica a runtime, dati, `Frontend/public/**`, Rules/Functions produttive, versione, `master` o deploy; nessun dato reale.
> **Fetta:** M7-R1 (censimento). M8–M10 e l'audit Alibaba/OpenCodeReview non sono avviati da questo documento.

<a id="fonte-docs-m7-retention-censimento-md-0-come-leggere-questo-documento"></a>

### 0. Come leggere questo documento

Ogni affermazione è accompagnata dal riferimento `percorso:riga` al codice o alle Rules esaminate. La legenda degli stati è:

| Stato | Significato |
|---|---|
| **verificato nel codice** | la proprietà è dimostrata dalle righe citate del codice distribuito |
| **verificato nelle Rules** | la proprietà è dimostrata dalle Rules citate |
| **verificato nei test** | esiste un test che esercita la proprietà (file:riga) |
| **solo laboratorio** | la proprietà esiste unicamente in `experiments/**` o in Rules candidate non pubblicate |
| **non verificato** | non è dimostrabile da questo repository; è indicato cosa servirebbe |

<a id="evidenza-9086c3353ba4bab22ee6"></a>

**Produttivo** significa codice effettivamente pubblicato o distribuibile da questo ramo (`functions/`, `firestore.rules`, `storage.rules`, `Frontend/public/**`, `firebase.json`). **Laboratorio** significa `experiments/**` o Rules candidate: non raggiungibili dall'app distribuita.

Questo documento **non decide** durate, eccezioni legali o cancellazioni definitive: le raccoglie come domande per il proprietario nella sezione 10.

<a id="fonte-docs-m7-retention-censimento-md-1-requisito-di-partenza"></a>

### 1. Requisito di partenza

<a id="fonte-docs-m7-retention-censimento-md-11-baseline-di-sicurezza"></a>

#### 1.1 Baseline di sicurezza

- I backup reali devono essere «cifrati e autenticati; versionati; separati dalle chiavi necessarie ad aprirli; **soggetti a controllo accessi e retention**; provati periodicamente con ripristino su ambiente non produttivo» (`docs/ARCHITETTURA_SICUREZZA_V1.md:239-245`).
- «La cancellazione deve includere dati principali, indici, copie ricevute controllabili, allegati, cache del dispositivo e backup **secondo la politica di retention**. Deve essere verificabile e compatibile con eventuali obblighi di conservazione» (`docs/ARCHITETTURA_SICUREZZA_V1.md:249`).
- «retention di cestino, audit e backup» è elencata fra le **decisioni non ancora chiuse** (`docs/ARCHITETTURA_SICUREZZA_V1.md:344`).
- La tabella dei rischi indica per «Cancellazione o corruzione»: «Cestino cifrato, backup autenticato, versioni e prova periodica di ripristino» (`docs/ARCHITETTURA_SICUREZZA_V1.md:62`).

<a id="fonte-docs-m7-retention-censimento-md-12-piano-di-maturità"></a>

#### 1.2 Piano di maturità

- M7: `[ ] politica di retention complessiva approvata e verificata su dati, allegati e backup` (`docs/PIANO_MATURITA_PROFESSIONALE.md:396`); uscita: «recupero e cancellazione verificabili; il collaudo storico non chiude la decisione sulla retention» (`:398`).
- M8: restano aperti «gestione completa delle interruzioni fra blocchi e allegati», «rispondenza al requisito di staging e ripresa/rollback su copia non produttiva», «limiti di memoria e matrice fisica completa» (`docs/PIANO_MATURITA_PROFESSIONALE.md:404-406`).
- Sintesi di stato: M7 «funzioni e collaudo storico registrati; retention complessiva non approvata» (`docs/PIANO_MATURITA_PROFESSIONALE.md:469`).

<a id="fonte-docs-m7-retention-censimento-md-13-rilievi-già-registrati-che-questo-censimento-conferma-o-precisa"></a>

#### 1.3 Rilievi già registrati che questo censimento conferma o precisa

| Rilievo | Contenuto | Esito di M7-R1 |
|---|---|---|
| F2-P1-03 | «M7 dichiara contemporaneamente retention aperta/non approvata e fase completata/certificata» (`docs/AUDIT_PROGETTO_FASE2_STATICO.md:37`) | **confermato**: la sezione 2 mostra due meccanismi di cestino con semantiche diverse e la sezione 7 distingue ciò che esiste da ciò che non esiste |
| F2-P1-04 | «Viene scritto `purgeAfterMs` a 30 giorni, ma non è emerso un processo automatico che lo applichi» (`docs/AUDIT_PROGETTO_FASE2_STATICO.md:38`) | **confermato e precisato**: il metadato è scritto solo dal percorso `trash` legacy (`functions/index.js:429`) e non ha alcun consumatore; l'Archivio Account non lo scrive affatto |
| — | «non è stato rilevato un processo automatico che cancelli alla scadenza» (`docs/AUDIT_PROGETTO_FASE2_STATICO.md:128`) | **confermato**: l'unica schedulazione del progetto è `checkDeadlines` (`functions/index.js:1486`) |

<a id="fonte-docs-m7-retention-censimento-md-2-meccanismi-di-cestino-due-percorsi-distinti"></a>

### 2. Meccanismi di cestino: due percorsi distinti

Il censimento ha individuato **due meccanismi diversi** che il linguaggio comune chiama "cestino". Confonderli è la causa principale dell'ambiguità documentale.

| # | Meccanismo | Dove vive il record | Chi scrive | Campi di stato | Scadenza automatica | UI |
|---|---|---|---|---|---|---|
| A | **Archivio Account** (quello usato dall'utente) | il documento Account stesso, con flag `isArchived` | client, direttamente sul documento (`Frontend/public/assets/js/modules/privato/account_privati.js:371`, `.../azienda/account_azienda.js:249`) | `isArchived`, `archiveSchemaVersion: 2`, `archivedAt`, `revision` (`.../settings/archive-account-model.js:1-7`) | **nessuna** | `Frontend/public/archivio_account.html` |
| B | **`trash` dei `syncRecords`** (legacy, senza UI) | `users/{uid}/trash/{recordId}` | callable backend `trashSyncRecord` / `restoreSyncRecord` (`functions/index.js:445-446`) | copia del record + `deletedAt`, `purgeAfterMs` (`functions/index.js:429`) | **nessuna**: il metadato `purgeAfterMs` (30 giorni) non è letto da alcun processo | **nessuna** |

Dettagli verificati:

- **A — archiviazione senza scadenza.** `createArchiveMetadata` non produce alcun campo di scadenza (`Frontend/public/assets/js/modules/settings/archive-account-model.js:1-7`), e il test `tests/archive-account-model.test.mjs:8,14` verifica che l'archiviazione non pianifichi cancellazioni (`metadata.purgeAfter === undefined`).
- **A — messaggio all'utente coerente con l'assenza di scadenza.** La UI dell'Archivio mostra «Conservato finché non lo elimini manualmente» (`Frontend/public/assets/js/modules/settings/archivio_account.js:355`).
- **B — durata scritta ma inerte.** `RETENTION_MS = 30 * 24 * 60 * 60 * 1000` (`functions/history-recovery-service.js:2`) e `purgeAfterMs: Date.now() + RETENTION_MS` (`functions/index.js:429`). La ricerca sull'intero repository non trova alcun consumatore di `purgeAfterMs`: il campo è rimosso al ripristino (`functions/index.js:433`) e mai applicato. **Verificato esercitando (M7-T13):** dopo un purge e dopo un giro del job dei 24 mesi la voce di `trash` è ancora presente con il suo `purgeAfterMs` invariato.
- **B — nessun percorso utente.** Nessun modulo di `Frontend/public/assets/js` referenzia `trashSyncRecord`, `restoreSyncRecord` o la collezione `trash` (ricerca su tutto il frontend distribuito).
- **Nessun TTL di progetto nel repository.** `firebase.json` non contiene sezioni TTL; l'unica occorrenza di `ttl` è `"ttl": false` in `firestore.indexes.json:7` (override di indicizzazione su `accounts.sharedWith`).

<a id="fonte-docs-m7-retention-censimento-md-3-account-archiviati-comportamento-attuale"></a>

### 3. Account archiviati: comportamento attuale

<a id="fonte-docs-m7-retention-censimento-md-31-archiviazione"></a>

#### 3.1 Archiviazione

<a id="evidenza-a52d6b7d11f793479358"></a>

L'utente archivia un Account scrivendo i metadati sul documento (`archive-account-model.js:1-7`), con incremento di `revision`. Non viene creata una copia separata e non viene scritta alcuna scadenza. Il record resta quindi nel percorso applicativo principale: la lettura del documento continua a esistere e viene filtrata dal flag.

<a id="fonte-docs-m7-retention-censimento-md-32-ripristino"></a>

#### 3.2 Ripristino

<a id="evidenza-b3c8d8cbb642fefe1973"></a>

Il ripristino è lato client con controllo di concorrenza (CAS) sulla revisione letta: richiede `isArchived === true` e revisione coincidente, quindi rimuove i metadati di archiviazione e incrementa la revisione (`Frontend/public/assets/js/modules/settings/archive-account-service.js:164-190`). Un conflitto non sovrascrive e chiede di aggiornare l'Archivio.

<a id="fonte-docs-m7-retention-censimento-md-33-cancellazione-definitiva-purgearchivedaccount"></a>

#### 3.3 Cancellazione definitiva (`purgeArchivedAccount`)

Passi verificati nel backend (`functions/index.js:448-537`):

1. richiede autenticazione, `expectedOwnerUid` coincidente con Auth (`:451-452`), comando valido (`:454-456`) e conferma esplicita `DELETE_FOREVER` (`:457`; il valore è accettato solo da `validatePurgeCommand`, `functions/archive-purge-service.js:18`);
2. costruisce un binding e una ricevuta protetta; una ricevuta legacy in `archiveOperations` **blocca** l'operazione con `LEGACY_ARCHIVE_RESULT_UNVERIFIED` (`functions/index.js:462-480`);
3. in una prima transazione scrive lo stato `processing` in `mutationResults/{uid}/operations/{operationId}` (`:470`, `:489-492`);
4. legge la sottocollezione `attachments` del documento (`:500`), valida ogni `storagePath` con `isSafeAttachmentPath` (`:502`; la regola richiede prefisso `users/{uid}/[...]/accounts/{id}/attachments/`, assenza di `..` e lunghezza ≤ 1024, `functions/archive-purge-service.js:26-40`) e in caso contrario **interrompe** senza cancellare nulla;
5. elimina gli oggetti Storage con `delete({ignoreNotFound: true})` (`functions/index.js:506`);
6. esegue `store.recursiveDelete(recordRef)` sul documento Account (`:507`);
7. in una transazione finale rilegge Profilo e **tutte** le aziende, pianifica la pulizia dei riferimenti (`planProfileReferenceCleanup`), rifiuta piani oltre 450 modifiche, applica le patch, marca la ricevuta `purged` e scrive l'evento di audit `account-purged` (`:509-535`).

<a id="evidenza-f8e7356f3d044f6c6fc4"></a>

Atomicità: i passi 5 e 6 **non** sono dentro una transazione. Un'interruzione fra il passo 4 e il 7 lascia la ricevuta in `processing` e consente una ripresa (`purgeDecision`, `functions/archive-purge-service.js:42-50`), ma lo Storage e `recursiveDelete` restano fuori dall'atomicità globale. La race fra purge e ripristino è già dichiarata aperta nel contratto d'area (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:55-60`) e **non** è chiusa da questo censimento.

<a id="fonte-docs-m7-retention-censimento-md-34-copie-residue-dopo-il-purge-verificate"></a>

#### 3.4 Copie residue dopo il purge (verificate)

<a id="evidenza-511d83b4a0e279fb3c6d"></a>

**Verifica esercitata (M7-T13, 21/09/2026):** la tabella qui sotto non è più solo lettura del codice. `tests/purge-retention-effects.emulator.test.mjs` esegue la callable reale del purge su Firestore e Storage **emulati** e controlla riga per riga: Account e sottoalbero dei metadati eliminati; byte elencati eliminati; oggetto dello stesso prefisso **non** elencato sopravvissuto; `trash`, collezioni sorelle, ricevuta legacy (scavalcata da una ricevuta di idempotenza fidata), ricevuta di idempotenza e registro sopravvissuti; riferimenti di Profilo e azienda ripuliti; evento `account-purged` scritto con `at` del server. La stessa prova conferma che una ricevuta legacy **sola** ferma il purge con `LEGACY_ARCHIVE_RESULT_UNVERIFIED` senza toccare Account, cestino e registro. Il caso veloce equivalente è in `functions/test/archive-receipt-handler.test.js`.

| Percorso | Sopravvive al purge? | Perché |
|---|---|---|
| `users/{uid}/accounts/{id}` e sottoalberi (inclusi `attachments` metadati) | **no** | `recursiveDelete` (`functions/index.js:507`) |
| oggetti Storage elencati nei metadati dell'Account | **no** (best effort) | `bucket.file(path).delete({ignoreNotFound: true})` (`:506`) |
| oggetti Storage **non** elencati in quei metadati | **sì** | vengono cancellati solo i percorsi letti dalla sottocollezione (`:500-501`) |
| `users/{uid}/auditEvents/**` | **sì** | collezione sorella, non inclusa in `recursiveDelete`; l'evento `account-purged` stesso resta (`:530-533`) |
| `mutationResults/{uid}/operations/{operationId}` | **sì** | registro di avanzamento separato (`:470`, `:529`) |
| `users/{uid}/archiveOperations/**` (legacy) e `operationResults/**` | **sì** | percorsi di ricevuta distinti (`:471`, `:410`) |
| `accountWidgets`, `sharedVaultData`, `sharedVaultLinks` | **sì** | collezioni sorelle del documento Account: la cancellazione ricorsiva non le raggiunge (già registrato in `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:57`) |
| riferimenti nei Profili e nelle aziende | parzialmente | la pulizia finale aggiorna solo i campi con riferimento esatto, con budget 450 (`functions/index.js:517-528`) |
| backup `.cpbackup` già esportati dall'utente | **sì** | il backup è un file locale dell'utente, fuori dal controllo del servizio (sezione 6) |
| cache del dispositivo (Firestore offline, IndexedDB, Cache Storage) | **non gestita dal purge** | nessuna riga del purge la tocca |

<a id="fonte-docs-m7-retention-censimento-md-35-hard-delete-di-azienda-e-di-account-aziendale-due-percorsi-diversi-verificato-m7-t27"></a>

#### 3.5 Hard-delete di Azienda e di Account aziendale: due percorsi diversi (verificato M7-T27)

| | **A — Azienda cancellata dal client** | **B — Account aziendale eliminato dal purge** |
|---|---|---|
| Chi lo esegue | client, `deleteCompany` (`company-list-service.js:8-10`) e la form (`ma_save.js:202-206`: conferma → `deleteDoc` → redirect) | callable backend `purgeArchivedAccount`, come per il cestino Account (T-13) |
| Documenti | **solo** il documento Azienda | documento Account **e** sottocollezione `attachments` (ricorsivo) |
| Account aziendali dentro l'Azienda | **restano**: `aziende/{cid}/accounts/**` non viene toccato | è l'oggetto stesso dell'operazione |
| Metadati allegati | restano (nella sottocollezione orfana) | eliminati |
| Byte Storage | **restano**: nessuna primitiva di cancellazione nel percorso client | eliminati **solo** quelli elencati nei metadati; un oggetto dello stesso prefisso non elencato resta |
| Allegati del form Azienda (`users/{uid}/aziende_allegati/**`) | restano | non pertinenti: fuori dal prefisso dell'Account |
| Riferimenti in altri documenti | **restano** e puntano a un'Azienda inesistente (nessuna pulizia) | ripulita **solo** la coppia esatta `(accountId, companyId)`; lo stesso `accountId` in un'altra Azienda e il collegamento privato omonimo restano |
| Ricevute e registro | nessuna scrittura | ricevuta di idempotenza a `purged` + evento `account-purged` |

<a id="evidenza-960e1c79074139c86dcb"></a>

**Rischio di toccare altri Account.** Provato che **non** accade: nel purge aziendale l'Account con lo **stesso id** in un'altra Azienda conserva documento, metadati e byte, e la pulizia dei riferimenti non tocca la coppia diversa (controllo per mutazione: ignorare l'Azienda di destinazione rende rossi i banchi). La cancellazione dei byte resta comunque limitata ai percorsi elencati e sotto il prefisso dell'Account (`isSafeAttachmentPath`, T-05/T-33).

<a id="evidenza-2b69848010ba03a9ca07"></a>

**Errori parziali.** In A il `deleteDoc` è un'unica operazione: se fallisce, nulla è stato modificato e l'utente vede l'errore; non esiste compensazione (non serve). In B valgono le proprietà di T-13: un errore Storage lascia la ricevuta in `processing`, senza falso `purged`, e la ripetizione è idempotente.

<a id="evidenza-bdf21cb12c60908e55f9"></a>

**Prove.** Emulator reali (Firestore + Storage, Rules di produzione): `tests/company-hard-delete-residues.emulator.test.mjs` esegue la **`deleteCompany` reale** (Azienda eliminata; Account, metadati, byte, allegati del form e riferimenti rimasti; l'altra Azienda intatta) e il **purge reale** in contesto `company` (documento e sottocollezione eliminati, byte elencati rimossi, oggetto non elencato sopravvissuto, Account omonimo di un'altra Azienda e suoi byte intatti, riferimento della coppia esatta azzerato). Modello e sorgente: `tests/company-hard-delete-residues.test.mjs` (percorsi, assenza di ricorsione nel client, semantica di `planProfileReferenceCleanup`).

<a id="evidenza-853b0b573319db1cf981"></a>

**Limiti dichiarati.** Non sono esercitati l'interfaccia (conferma, redirect, lista aziende) né la visibilità degli Account orfani nella UI: la diagnosi è sui dati. Il percorso A è provato con la funzione reale della lista (`deleteCompany`); la form esegue lo stesso `deleteDoc` e la differenza è asserita sul sorgente. Restano fuori perimetro i residui del purge privato (T-13) e la pulizia degli orfani (D4), non decisa.

<a id="fonte-docs-m7-retention-censimento-md-36-copie-condivise-e-inviti-dopo-il-purge-verificato-m7-t08"></a>

#### 3.6 Copie condivise e inviti dopo il purge (verificato M7-T08)

<a id="evidenza-49221a50634fb015f287"></a>

Misura dell'effetto del purge su un Account con widget, dati condivisi, collegamento e invito collegato, più una Scadenza condivisa come percorso di confronto. Il purge viene eseguito **reale** (Admin SDK, come in produzione) e la leggibilità è verificata con le **Rules di produzione** su contesti client di proprietario, destinatario ed estraneo.

| Elemento | Dopo il purge | Leggibile dal **destinatario**? |
|---|---|---|
| `users/{uid}/accountWidgets/{id}` | **resta, invariato** (confronto byte per byte prima/dopo) | **no**: sola lettura del proprietario, scrittura negata |
| `users/{uid}/sharedVaultData/{id}` | **resta, invariato** | **no**: idem |
| `users/{uid}/sharedVaultLinks/{id}` | **resta, invariato** | **no**: idem |
| `invites/{inviteId}` | **resta, invariato**: `sharingState: 'suspended'` e `suspendedAt` sono quelli scritti dall'**archiviazione** (`archive-account-service.js:254,352`), non dal purge; `status` non viene riscritto | **sì**, per email: il destinatario legge ancora `accountName`, `accountId`, `status` e `sharingState` dell'Account purgato |
| Account e allegati | **rimossi** (ricorsivo) più i byte elencati | no: il documento non esiste più |
| `users/{destinatario}/receivedDeadlines/{id}` (Scadenze) | **resta, invariato**: percorso separato | **sì**: è la copia del destinatario |
| `deadlineShares/{id}` (indice backend delle Scadenze) | resta; nessun client lo legge | **no**: `allow read, write: if false` |

<a id="evidenza-05c91a835a0fd18bf8bb"></a>

**Decisioni già prese, misurate e non cambiate.** Il purge **non** riscrive lo stato sospeso (lo fa l'archiviazione), **non** crea un nuovo invito (la riattivazione resta un gesto del proprietario, con il rinvio attuale mantenuto) e **non** tocca la copia della Scadenza nel profilo del destinatario. Nessun job o percorso pulisce queste collezioni: nel backend esistono solo due schedulazioni (scadenze e retention del registro, che scansiona il solo `collectionGroup("auditEvents")`).

<a id="evidenza-57268a01f18c30a9e257"></a>

**Prove.** `tests/shared-copies-purge.emulator.test.mjs` (2 casi, emulatori Firestore + Storage reali, purge reale e Rules reali) e `tests/shared-copies-purge.test.mjs` (5 casi di sorgente e Rules). **Controllo per mutazione**: purge che elimina una copia condivisa e l'invito → rosso; Rules che ignorano `isArchived` per gli ospiti → rosso (discriminato da un Account archiviato che conserva il destinatario fra gli UID ammessi, forma legacy).

<a id="evidenza-d32a6ff2fec7a100960e"></a>

**Limiti dichiarati.** Emulator e Rules sono esercitati; **l'interfaccia no** (nessuna prova browser: che cosa il destinatario *veda* nella sua schermata non è misurato). Il purge è invocato con l'Admin SDK, che ignora le Rules come in produzione. Le funzioni backend della condivisione Scadenze (`syncReceivedDeadlines`/`removeReceivedDeadlines`) **non** sono eseguite: la loro separazione è misurata come invarianza e asserita sul sorgente. Restano fuori perimetro la pulizia degli orfani (D4) e la scelta su che cosa fare di inviti e copie dopo il purge.

<a id="fonte-docs-m7-retention-censimento-md-37-oggetti-storage-non-elencati-nei-metadati-che-cosa-resta-verificato-m7-t09"></a>

#### 3.7 Oggetti Storage non elencati nei metadati: che cosa resta (verificato M7-T09)

Il purge non ha alcun inventario del prefisso: legge la sottocollezione `attachments` dell'Account e cancella **esattamente** i `storagePath` letti lì (`functions/index.js:500-506`). Da questo discendono, misurati su emulatori reali:

| Oggetto sotto il prefisso dell'Account | Esito |
|---|---|
| **elencato** nei metadati (`attachments/{id}.storagePath`) | **eliminato** |
| non elencato, nella **stessa** cartella `attachments/` | **resta**, con i propri byte |
| non elencato, in una **sottocartella diversa** dell'Account (es. `scansioni/`) | **resta**, con i propri byte |
| sotto un Account **vicino di nome** (`acc-1-bis` mentre si purga `acc-1`) | **resta**: né documento né allegato vengono toccati |
| conteggio dopo il purge | sotto il prefisso restano **solo** gli oggetti non elencati: nessuna scansione |

<a id="evidenza-16796babd75cdfb543fe"></a>

**Differenza da T-05.** Il controllo di prefisso esiste, ma si applica ai percorsi **letti** dai metadati: un `storagePath` elencato che esce dal prefisso dell'Account fa **interrompere** il purge **prima di qualunque cancellazione**, compresi i percorsi validi (`functions/test/archive-receipt-handler.test.js:198-204`; predicato isolato in `functions/test/archive-purge-service.test.js:19`, riga T-33). Un oggetto **non** elencato non passa da quel controllo perché non viene mai letto: sopravvive per assenza di inventario, non per una verifica.

<a id="evidenza-9007dd58309f72d5b687"></a>

**Prove e riferimenti (senza banchi ridondanti).** Le asserzioni «elencato eliminato / non elencato sopravvissuto» erano **già** provate su emulatori reali: `tests/purge-retention-effects.emulator.test.mjs` (T-13, caso 1: byte elencati spariti, oggetto dello stesso prefisso mai elencato presente) e `tests/company-hard-delete-residues.emulator.test.mjs` (T-27, caso 2, contesto aziendale e verifica con `listAll` del client). Per T-09 è stato aggiunto **un solo caso mirato** nello stesso banco T-13 — `T-09: sotto il prefisso dell'Account sopravvivono solo gli oggetti non elencati` — che copre i confini non ancora asseriti: sottocartella diversa da `attachments/`, secondo oggetto non elencato nella stessa cartella, Account **vicino di nome** con il suo documento e allegato, e il **conteggio** che dimostra l'assenza di scansione. Nessun nuovo banco, nessun nuovo runner, nessun comando aggiunto.

<a id="evidenza-fc10a35b02f68fcda220"></a>

**Controllo per mutazione.** Aggiungendo al purge un **inventario per prefisso** (`getFiles({prefix})` + delete) il caso T-09 diventa **rosso**, insieme alle asserzioni su oggetto non elencato di T-13: la prova discrimina davvero il comportamento attuale dall'alternativa D4.

<a id="evidenza-2a5b632acdad4ee19787"></a>

**Limiti dichiarati.** Il purge è invocato con l'Admin SDK (come in produzione, Rules aggirate); la verifica dei byte è ammessa dall'Admin SDK, non da un client. La sopravvivenza degli oggetti non elencati è una **conseguenza dell'assenza di inventario**: non implica che esista una verifica di prefisso. Restano fuori perimetro la scelta D4 (inventario e pulizia), T-22 (assenza di lifecycle/TTL sul bucket, verifica esterna **non** eseguita) e la presenza di simili oggetti nei dati reali (mai letti).

<a id="fonte-docs-m7-retention-censimento-md-4-cronologia-e-audit-comportamento-attuale"></a>

### 4. Cronologia e audit: comportamento attuale
<a id="fonte-docs-m7-retention-censimento-md-41-dove-sono-gli-eventi"></a>

#### 4.1 Dove sono gli eventi

L'audit produttivo è **una sola collezione**: `users/{uid}/auditEvents/{operationId}` (documento identificato dall'`operationId`). È scritta da cinque punti di `functions/index.js`:

| Sorgente | Azione registrata | Riga |
|---|---|---|
| `trashSyncRecord` / `restoreSyncRecord` | `trashed` / `restored` con `safeAudit` | `functions/index.js:437-440` |
| `purgeArchivedAccount` | `account-purged` (oggetto letterale, **senza** `safeAudit`) | `functions/index.js:530-533` |
| `manageSharedVaultData` | `shared-vault-<action>` (oggetto letterale) | `functions/index.js:309-316` |
| `manageAccountWidget` | `account-widget-<action>` (oggetto letterale) | `functions/index.js:387-394` |
| `restoreBackupChunk` | `backup-restore-chunk` con `safeRestoreAudit` | `functions/index.js:602-608` |

<a id="fonte-docs-m7-retention-censimento-md-42-contenuto-allowlist-applicata-solo-a-due-percorsi-su-cinque"></a>

#### 4.2 Contenuto: allowlist applicata solo a due percorsi su cinque

- `safeAudit` restituisce esclusivamente `{schemaVersion: 1, action, actorUid, recordId, operationId}` e rifiuta azioni fuori da `{trashed, restored, purged}` (`functions/history-recovery-service.js:29-34`); i campi del payload non vengono copiati.
- `safeRestoreAudit` restituisce solo `{action, actorUid, operationId, backupId, chunkIndex, recordCount}` (`functions/backup-restore-service.js:136-142`).
- Gli eventi `purgeArchivedAccount`, `manageSharedVaultData` e `manageAccountWidget` costruiscono l'oggetto a mano: contengono anch'essi solo identificatori tecnici (`accountId`, `context` limitato a `private`/`company`, `sharedDataId`, `widgetId`, `revision`), ma **non passano da un validatore condiviso**. La garanzia è per costruzione del letterale, non imposta.
- Test pertinenti: `functions/test/history-recovery-service.test.js:15` («audit espone soltanto identificatori tecnici consentiti») e `functions/test/backup-restore-service.test.js:68` («audit conserva soltanto contatori e identificatori tecnici»), entrambi con un segreto fittizio nel payload che non deve comparire nel documento.

<a id="fonte-docs-m7-retention-censimento-md-43-limite-e-scadenza"></a>

#### 4.3 Limite e scadenza

- **Limite e scadenza (riconciliato in M7-AUDIT-7).** Il censimento qui sotto descrive lo stato **prima** delle fette M7-AUDIT. Nel **ramo locale** esiste ora un job pianificato di retention (`functions/index.js`, `purgeExpiredAuditEvents`, giornaliero alle 03:00 Europe/Rome) che cancella gli eventi oltre **24 mesi di calendario** usando la data efficace (`at`, oppure `createdAt` solo per `shared-vault-*`/`account-widget-*` senza `at`), con lotti confermati sulla versione letta, cursori di servizio per campo e log di soli conteggi. **Nessun deploy**: in produzione non esiste ancora alcun job attivo. Restano fuori dalla finestra le ricevute di idempotenza, `trash`, `recordHistory` (non esiste in produzione), i backup, i log di piattaforma e gli Account archiviati; gli eventi non databili sono conservati e mai cancellati.
- Il requisito di contratto «la cronologia è limitata agli eventi necessari» e il gate «cronologia limitata» (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:19,29`) trovano riscontro **solo nel laboratorio**: `appendHistory(..., maximum = 100)` con troncamento `slice(-maximum)` (`experiments/history-recovery/history-model.mjs:26-27`).
- La collezione `recordHistory` **non esiste in produzione**: compare soltanto nelle Rules candidate di laboratorio (`experiments/history-recovery/firestore.candidate.rules:9-12`), non pubblicate (`firebase.json` pubblica `firestore.rules`).
- Nessuna interfaccia utente mostra la cronologia: nessun modulo di `Frontend/public/assets/js` legge `auditEvents` o `recordHistory`.

<a id="fonte-docs-m7-retention-censimento-md-44-chi-può-leggere-scrivere-e-cancellare-laudit"></a>

#### 4.4 Chi può leggere, scrivere e cancellare l'audit

- `firestore.rules:106-118` è un'autorizzazione generica del proprietario (`allow read, write: if isOwner(userId)`) che **esclude** un elenco di collezioni: `contacts`, `pushDevices`, `notificationDeliveries`, `deadlineNotifications`, `receivedDeadlines`, `operationResults`, `profileWidgets`, `accountWidgets`, `sharedVaultData`, `sharedVaultLinks`.
- `trash`, `auditEvents`, `archiveOperations`, `backupRestoreOperations` e `syncRecords` **non sono in quell'elenco** (stato al momento del censimento): il client autenticato del proprietario poteva quindi creare, modificare e **cancellare** i propri documenti di audit tramite SDK. **Riconciliato in M7-AUDIT-7:** nel **ramo locale** `auditEvents` è escluso dal catch-all proprietario e ha un blocco dedicato in sola lettura (`firestore.rules`, M7-AUDIT-2), quindi il client **non** può più creare, modificare o cancellare eventi; `trash`, `recordHistory` e le ricevute restano fuori da quella fetta e invariati. La correzione vale **solo nel ramo** finché le Rules non saranno distribuite.
- Le ricevute protette sono invece in sola lettura per il client: `mutationResults/{userId}/operations/{operationId}` → `allow write: if false` (`firestore.rules:30-33`) e `operationResults` → `allow write: if false` (`:101-104`).
- Le Rules candidate di laboratorio renderebbero `auditEvents` e `trash` non scrivibili dal client (`experiments/history-recovery/firestore.candidate.rules:5-16`); i test emulatori `tests/history-recovery.rules.test.mjs:9,17` verificano quelle Rules candidate, **non** quelle produttive.

<a id="fonte-docs-m7-retention-censimento-md-45-effetto-del-purge-sulla-cronologia"></a>

#### 4.5 Effetto del purge sulla cronologia

<a id="evidenza-8038c1799d93065ae5b1"></a>

Il purge di un Account **non** elimina né anonimizza alcun evento: `auditEvents` non è toccato da `recursiveDelete` (che agisce sul solo documento Account, `functions/index.js:507`) e nessuna riga del percorso cancella o redige eventi. L'evento `account-purged` resta quindi in `auditEvents` con `actorUid`, `accountId` e `context`.

<a id="evidenza-8f213a74a9c12bcda106"></a>

**Verifica esercitata (M7-T13, 21/09/2026).** Sugli emulatori reali: dopo il purge l'evento `users/{uid}/auditEvents/{operationId}` esiste con `action: 'account-purged'`, `actorUid`, `accountId`, `context` e `at` Timestamp del server, e l'evento precedente del registro resta al suo posto; una ricevuta legacy sola impedisce il purge e **non** scrive alcun evento.

<a id="evidenza-4804781f15dad54f67e6"></a>

**Confronto con la decisione dei 24 mesi (solo registro).** L'evidenza del purge **è** un evento di audit e quindi **scade come gli altri**: nella stessa prova il job `purgeExpiredAuditEvents` cancella un evento `account-purged` datato oltre i 24 mesi e conserva quelli recenti, mentre non tocca `trash`, ricevute, collezioni sorelle e aziende. Conseguenza dichiarata: dopo 24 mesi il registro non conserva più la traccia del purge, mentre la ricevuta di idempotenza in `mutationResults` (che resta senza scadenza) continua a dire che quell'`operationId` è stato eseguito. Le due metà non hanno la stessa durata: è coerente con la decisione, che riguarda **solo** il registro, ed è una delle voci ancora aperte su cestino e ricevute (§8, D1/D5).

<a id="fonte-docs-m7-retention-censimento-md-5-allegati-comportamento-attuale"></a>

### 5. Allegati: comportamento attuale

<a id="fonte-docs-m7-retention-censimento-md-51-dove-vivono-i-byte-e-dove-i-metadati"></a>

#### 5.1 Dove vivono i byte e dove i metadati

| Tipo | Percorso Storage | Riferimento nel metadato | Riga |
|---|---|---|---|
| Allegato Account privato | `users/{uid}/accounts/{accountId}/attachments/{nome}` | campo `storagePath` nel documento di sottocollezione `attachments` | `Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js:126,140-148` |
| Allegato Account aziendale | `users/{uid}/aziende/{companyId}/accounts/{accountId}/attachments/{nome}` | idem | `Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js:101,114-123` |
| Allegato Scadenza | `users/{uid}/scadenze/{deadlineId o new_<ts>}/{nome}` | array `attachments` nel documento scadenza | `Frontend/public/assets/js/modules/scadenze/deadline-save-service.js:42,151` |
| Allegato anagrafica azienda (legacy) | `users/{uid}/aziende_allegati/{nome}` | array `allegati` nel documento azienda | `Frontend/public/assets/js/modules/azienda/ma_save.js:149,161` |
| Avatar/foto profilo | `users/{uid}/avatar_{nome}` | `photoURL` nel documento utente **e** in `localStorage['codex_profile_avatar_{uid}']` | `Frontend/public/assets/js/modules/privato/profilo-ui.js:46-50` |
| Logo/referente azienda | **nessun oggetto Storage**: data-URL dentro il documento azienda (`logo`, `referentePhoto`) | — | `Frontend/public/assets/js/modules/azienda/ma_save.js:141,143` |

<a id="evidenza-cb4803ecd6bb9e2d6f6d"></a>

Il purge di un Account elimina gli oggetti Storage **solo** per i percorsi letti dalla sottocollezione `attachments` di quell'Account (`functions/index.js:500-501`), con prefisso obbligatorio validato (`functions/archive-purge-service.js:32-40`). **Cinque famiglie di percorsi su sei non sono toccate da alcun flusso backend**: `scadenze/**`, `aziende_allegati/**`, `avatar_*`, gli allegati di Aziende eliminate e quelli di Account aziendali eliminati con l'hard-delete.

<a id="fonte-docs-m7-retention-censimento-md-52-ordine-di-scrittura-e-cancellazione-non-atomici"></a>

#### 5.2 Ordine di scrittura e cancellazione (non atomici)

- **Upload**: sempre prima i byte (`uploadBytes` con `contentType: application/octet-stream` e `customMetadata.encrypted = 'v1'`), poi `getDownloadURL`, poi la scrittura del metadato (`.../privato/dettaglio-privato-attachments.js:132-148`). Nessuna transazione: un'interruzione fra i due passi lascia un oggetto senza metadato.
- **Cancellazione dall'utente**: `deleteObject` e poi `deleteDoc` (`.../privato/dettaglio-privato-attachments.js:270-272`; variante aziendale `:238-244`). Un errore nella seconda fase lascia un metadato senza byte; non esiste ricevuta né audit per questa operazione.
- **Purge**: `bucket.file(path).delete({ignoreNotFound: true})` su tutti i percorsi raccolti, in parallelo, **prima** di `recursiveDelete` (`functions/index.js:506-507`). La cancellazione dei byte non è nella transazione che marca `purged`, quindi non è atomica rispetto al metadato.
- **Percorso non conforme**: un solo `storagePath` fuori dal prefisso dell'Account **interrompe l'intero purge** con `failed-precondition` prima di qualunque cancellazione (`functions/index.js:502-504`), lasciando la ricevuta in `processing`.
- **Nessuna scadenza automatica**: `firebase.json` non contiene alcuna sezione `lifecycle` per Storage e nel repository non esiste alcuna policy di lifecycle. L'eventuale lifecycle a livello di bucket GCS è **non verificato** (sezione 11); `storage.cors.json` configura solo CORS.

<a id="fonte-docs-m7-retention-censimento-md-53-percorsi-che-non-passano-dal-protocollo-di-cancellazione-verificati"></a>

#### 5.3 Percorsi che NON passano dal protocollo di cancellazione (verificati)

| Percorso | Cosa elimina | Cosa resta |
|---|---|---|
| Rimozione di una riga dall'array `allegati` (anagrafica azienda) | solo la voce dell'array (`.../azienda/ma_attachments.js:65-68`) | l'oggetto su Storage |
| Rimozione di una riga dall'array `attachments` di una Scadenza | solo la voce dell'array (`.../scadenze/deadline-attachment-controller.js:41-43`) | l'oggetto su Storage e l'eventuale cartella `new_<ts>` di una scadenza mai salvata |
| Cancellazione di una Scadenza | il documento; il trigger rimuove solo le copie ricevute (`functions/index.js:1689-1704`) | tutti i byte sotto `users/{uid}/scadenze/{id}/**` |
| Hard-delete di un Account aziendale | il solo documento (`.../azienda/account_azienda.js:271`; `.../azienda/form-azienda-save.js:326`) | metadati della sottocollezione `attachments` e relativi oggetti Storage |
| Hard-delete di un'Azienda | il solo documento (`.../azienda/ma_save.js:204`) | sottocollezioni `accounts/*/attachments` e oggetti `aziende_allegati/**` |
| Cambio avatar | **nessuna** cancellazione dell'avatar precedente | un oggetto orfano per ogni sostituzione |

<a id="fonte-docs-m7-retention-censimento-md-54-permessi"></a>

#### 5.4 Permessi

<a id="evidenza-a3ca84e33e6c1373a0cd"></a>

`storage.rules:33-36` concede al proprietario `read, delete` e `create, update` sotto `users/{userId}/**`; l'upload è vincolato da `isAllowedUpload()` (dimensione > 0, ≤ 25 MiB + 1 KiB, MIME in allowlist, e `metadata.encrypted == 'v1'` obbligatorio per `application/octet-stream`, `storage.rules:9-21`). Il proprietario può quindi **cancellare** i propri oggetti senza passare dal backend, e può creare oggetti sotto qualunque prefisso del proprio spazio: l'inventario dei prefissi ricavato dal codice non prova che il bucket non ne contenga altri. Nessuna regola Firestore dedicata esiste per i metadati degli allegati: ricadono nella wildcard proprietario (`firestore.rules:106-118`).

<a id="fonte-docs-m7-retention-censimento-md-55-crittografia-legacy-e-ciò-che-non-è-autenticato"></a>

#### 5.5 Crittografia, legacy e ciò che non è autenticato

- L'AAD degli allegati Account è la costante `CodiciPassword-Attachment-v1` (`Frontend/public/assets/js/modules/shared/attachment-security.js:13`): percorso Storage, nome del file e ID dell'Account **non** entrano nell'autenticazione (`docs/AUDIT_PROGETTO_FASE2_STATICO.md:258`, `docs/M8_BACKUP_RECUPERO.md:111`). Il candidato di laboratorio usa un AAD contestuale (`experiments/persistent-vault-shell/profile-document-attachments-contract.mjs:108-115`), ma **non è montato**.
- **Allegati legacy senza campo `encryption`**: vengono aperti con `openExternalUrl(attachment.url)` **senza** passare dalla Vault Key (`.../privato/dettaglio-privato-attachments.js:230-232`; stessi rami in `.../azienda/dettaglio-azienda-attachments.js:211-213`, `.../azienda/dati-azienda-attachments.js:37-40`, `.../scadenze/dettaglio_scadenza.js:489-492`). Storicamente questi metadati possono non avere `storagePath`, e in tal caso il purge li ignora (`.filter(Boolean)`, `functions/index.js:501`). **Verificato esercitando (M7-T29, §5.5.1).**
- **Avatar non cifrato**: l'upload non applica `customMetadata` né cifratura (`.../privato/profilo-ui.js:46-50`); l'URL è persistito anche in `localStorage`.
- **Ripristino e marcatore**: i byte vengono ricaricati con `customMetadata.encrypted = 'v1'` (`.../settings/backup-import-service.js:448-450`) anche quando il metadato ripristinato non ha `encryption`: possibile etichetta non corrispondente all'involucro effettivo.

<a id="fonte-docs-m7-retention-censimento-md-551-apertura-di-un-allegato-legacy-comportamento-verificato-m7-t29"></a>

##### 5.5.1 Apertura di un allegato legacy: comportamento verificato (M7-T29)

<a id="evidenza-80a95b5124f25236da0d"></a>

`tests/legacy-attachment-opening.test.mjs` esegue i quattro percorsi reali di apertura (dettaglio privato, dettaglio aziendale, allegati incorporati nell'anagrafica aziendale, dettaglio Scadenza) e la policy reale degli URL (`attachment-security.js`). Il percorso cifrato è esercitato nello stesso banco **con la cifratura reale** del modulo, come controprova.

| Domanda | Risposta verificata (ramo legacy) |
|---|---|
| Quale URL viene aperto? | quello del metadato, normalizzato: schema mancante → `https://`; apertura in `_blank` con `noopener,noreferrer` e `opener` azzerato sulla finestra restituita |
| La Vault Key viene richiesta? | **no**: `ensureVaultKeyMaterial` non viene mai invocata, nessun byte viene letto da Storage, nessuna decifratura |
| Quali controlli restano applicati? | solo la policy di protocollo/schema di `normalizeExternalUrl` (`http`/`https`): `javascript:`, `data:`, `file:`, `blob:`, `ftp:`, URL malformati e URL vuoti vengono rifiutati e mostrati all'utente. **Nessuna allowlist di host**: un URL legacy può puntare a un sito qualsiasi |
| Differenza dal ramo cifrato | il ramo cifrato chiede la Vault Key, legge i byte con il tetto di 25 MB, decifra e apre un URL `blob:`; senza `storagePath` si ferma **prima** della chiave, e con un involucro non valido fallisce senza aprire |
| Popup bloccato | `openExternalUrl` restituisce **`true`** anche quando `window.open` restituisce `null`: il blocco **non** è distinguibile dal successo e non produce errore né avviso. Un'eccezione di `window.open` è invece registrata e mostrata |
| Sessione invalidata | privato, aziendale e Scadenza non aprono nulla; gli allegati **incorporati** nell'anagrafica aziendale **non** hanno alcun controllo di sessione e aprono comunque (comportamento attuale, dichiarato) |

<a id="evidenza-e0046f1573600e7aee2f"></a>

**Decisione necessaria (non presa qui):** il ramo legacy consegna al browser un URL esterno arbitrario fuori dal Vault; definire se questo va mantenuto, limitato (allowlist di host/origini) o accompagnato da un avviso esplicito all'utente è una scelta di prodotto. Non ho introdotto migrazioni, cancellazioni, nuove regole di accesso né alcuna modifica al comportamento.

<a id="fonte-docs-m7-retention-censimento-md-56-orfani-possibili-dedotti-dal-codice"></a>

#### 5.6 Orfani possibili (dedotti dal codice)

| Caso | Come si produce | Copertura |
|---|---|---|
| metadato senza byte | `deleteObject` riuscito e `deleteDoc` fallito; oppure cancellazione manuale dell'oggetto dal client (consentita da `storage.rules:34`) | nessuna riparazione automatica |
| byte senza metadato | `uploadBytes` riuscito e `addDoc` fallito, pagina abbandonata, form annullato dopo l'upload (`.../azienda/ma_save.js:147-161` carica prima della transazione) | nessun job li cerca: il purge legge solo i `storagePath` elencati (`functions/index.js:501`) |
| byte di Scadenze e `aziende_allegati` | rimozione dall'array o cancellazione del documento (sezione 5.3) | nessuna gestione in alcun flusso backend |
| byte dell'avatar | ogni cambio avatar | nessuna cancellazione; il purge non tocca `users/{uid}/avatar_*` — **provato** in M7-T28 (§5.8) |
| metadati di sottocollezioni | hard-delete di Azienda o di Account aziendale | restano irraggiungibili dalla UI |
| oggetti non elencati nei metadati | upload non registrato o percorso scritto direttamente dal client | il purge non scansiona il prefisso |
| versioni precedenti dell'oggetto | dipende da object versioning del bucket: **non verificato** | — |
| record `reserved` del candidato | interruzione fra prenotazione e scrittura dell'oggetto | chiusi solo con `recover()` invocato manualmente (`experiments/persistent-vault-shell/profile-document-attachments-handler.mjs:379-461`) |

Verifica dell'esistenza effettiva di orfani nel progetto reale: **non verificata** (richiederebbe di listare il bucket; nessun dato reale è stato letto).

<a id="evidenza-f32462e43b0fc60f2924"></a>

**Classificazione consolidata (M7-T16):** la tabella precedente, nata come deduzione dal codice, è oggi sostenuta da prove su emulatori reali per prefisso e causa, con l'indicazione di che cosa è osservato e che cosa resta dedotto: vedi **§5.10**.

<a id="fonte-docs-m7-retention-censimento-md-58-avatar-del-profilo-un-percorso-fuori-dal-protocollo-degli-allegati-verificato-m7-t28"></a>

#### 5.8 Avatar del profilo: un percorso fuori dal protocollo degli allegati (verificato M7-T28)

L'avatar è un oggetto Storage che **non** passa dal protocollo degli allegati: non ha metadati in una sottocollezione, non è cifrato e non è elencato in alcun documento tranne il riferimento `photoURL` del profilo.

| Aspetto | Comportamento attuale (verificato) |
|---|---|
| Scrittore | unico: `setupAvatarEdit` in `Frontend/public/assets/js/modules/privato/profilo-ui.js:32-61` (`profilo_privato.js:159` lo monta) |
| Validazione | `validateAttachmentFile(file, {imageOnly: true, maxBytes: MAX_AVATAR_BYTES})` (solo immagini, 5 MB) |
| Percorso dell'oggetto | `users/{uid}/avatar_<timestamp>_<uuid>.<ext>` — **nome nuovo a ogni caricamento** (`createStorageObjectName`) |
| Riferimento | `updateDoc(users/{uid}, {photoURL: url})` — **sovrascritto**, non conservato |
| Cancellazione del precedente | **nessuna**: il modulo non importa né invoca primitive di cancellazione (nessun `deleteObject`), e nessun altro percorso del repository elimina `users/{uid}/avatar_*` |
| Esito del cambio | il precedente oggetto **resta in Storage e non è più referenziato**: è un orfano, e se ne accumula uno a ogni cambio |
| Errore su upload | nessun byte scritto, `photoURL` invariato, errore mostrato |
| Errore su URL o su `updateDoc` | l'oggetto **nuovo** resta in Storage senza riferimento: un orfano in più, creato dall'errore parziale; `photoURL` resta quello vecchio |
| Cambio di sessione durante il caricamento | l'uid viene letto **una sola volta** all'inizio (`_getState()`), quindi byte e riferimento finiscono sotto il proprietario iniziale; nessun controllo di sessione e nessuna scrittura sul proprietario nuovo |
| Recupero | nessun job: la retention dei 24 mesi scansiona il solo `collectionGroup('auditEvents')` (§4), e il purge elimina solo gli oggetti elencati nei metadati `attachments` dell'Account, che per costruzione stanno sotto `.../accounts/{id}/attachments/` |
| Backup | l'avatar **non** è incluso nei backup: `collectStoragePaths` raccoglie solo i campi `storagePath` (`.../settings/backup-export-model.js:67-84`), mentre `photoURL` è esportato come campo del profilo |

<a id="evidenza-d5d91d58dd403eb1fab1"></a>

**Decisione necessaria (non presa qui):** definire se e quando l'oggetto precedente va eliminato (alla sostituzione, con un job di pulizia per prefisso, o mai), con quale rapporto verso D4 sugli orfani e con quale gestione del caso «URL nel backup che punta a un oggetto rimosso». Il comportamento attuale è una **scelta non dichiarata**, non un difetto con una decisione già vigente: per questo T-28 è «dichiarato, non corretto» e non ho modificato la produzione.

<a id="fonte-docs-m7-retention-censimento-md-57-copertura-di-test-e-suoi-limiti"></a>

#### 5.7 Copertura di test e suoi limiti

<a id="evidenza-a76693db1228df668db0"></a>

Test pertinenti: `tests/storage.rules.test.mjs:29,40,51,69,80` (permessi, isolamento UID, MIME/dimensioni, marcatore `encrypted`), `tests/attachment-security.test.mjs:21,28,34,41` (MIME, nomi casuali, URL, cifratura), `tests/account-attachment-delete.test.mjs` e `tests/account-attachment-delete.emulator.test.mjs` (cancellazione completa dell'allegato: oggetto **e** metadato, con modello in memoria ed emulatori reali), `tests/private-account-detail-lifecycle.test.mjs:166,172,179,202` e `tests/company-account-detail-lifecycle.test.mjs:69,75,106` (nessuna cancellazione di byte di un Account dopo il cambio di contesto), `tests/deadline-detail-lifecycle.test.mjs:92,173`, `functions/test/archive-purge-service.test.js:19` e `functions/test/backup-restore-service.test.js:11` (percorsi), `tests/backup-restore-session.test.mjs:110,287,333,355,369,498,532` (allegati nel ripristino).

<a id="evidenza-b0c1369f4d7568b564d7"></a>

**Copertura del ramo distruttivo (aggiornata da M7-R2 il 21/09/2026):** i test del purge sono stati estesi con un fake Storage che elenca davvero i metadati `attachments` e registra ogni `bucket.file(path).delete` (`functions/test/archive-receipt-handler.test.js`). Ora sono dimostrati: la cancellazione dei byte elencati **nell'ordine previsto e prima** di `recursiveDelete`, con `ignoreNotFound`, e l'ignoranza degli allegati senza `storagePath` (T-25, riga 160); l'arresto **prima di qualunque** cancellazione — compresi i percorsi validi — quando un percorso esce dal prefisso dell'Account (T-05, riga 174); l'errore parziale Storage che lascia la ricevuta in `processing` senza falso `purged`, con ripresa idempotente dello stesso comando (T-06, riga 187). Restano non coperti: la rimozione di una riga dagli array, gli hard-delete di Azienda/Account aziendale, la sostituzione dell'avatar, l'apertura di un legacy senza `encryption` e la pulizia della cache del dispositivo.

<a id="evidenza-8748c85ea7de99105c5d"></a>

**Copertura della cancellazione client (aggiornata da M7-T15 il 21/09/2026):** il percorso positivo della cancellazione di un allegato da un Account — quello dell'utente, distinto dal purge del backend — è ora provato su entrambi i moduli reali (`dettaglio-privato-attachments.js:249-281`, `dettaglio-azienda-attachments.js:230-254`): `tests/account-attachment-delete.test.mjs` esegue i moduli con un modello in memoria di bucket e metadati e verifica ordine (prima l'oggetto, poi il metadato), accoppiamento fra oggetto eliminato e metadato eliminato, assenza di residui incrociati e ricarica della lista; `tests/account-attachment-delete.emulator.test.mjs` ripete il percorso sugli **emulatori reali** Firestore e Storage con le Rules di produzione, dimostrando che l'oggetto non è più elencato né leggibile e che il documento dei metadati non esiste più, mentre l'altro allegato resta intatto (T-15, riga 337).

<a id="fonte-docs-m7-retention-censimento-md-59-rimozione-di-una-riga-e-cancellazione-di-una-scadenza-che-cosa-resta-verificato-m7-t26"></a>

#### 5.9 Rimozione di una riga e cancellazione di una Scadenza: che cosa resta (verificato M7-T26)

Tre percorsi distinti, con esiti diversi sullo **stesso** oggetto Storage. Il riferimento vive in punti diversi, e solo uno dei tre elimina i byte.

| Percorso | Riferimento | Metadati | Byte Storage |
|---|---|---|---|
| Allegato di un Account (sottocollezione `attachments`) | rimosso (`deleteDoc`) | rimossi | **rimossi** (`deleteObject`) — è il percorso di T-15 |
| Riga dell'array `allegati` dell'Azienda (form modifica, `ma_attachments.js:65-69`) | rimossa al salvataggio (`ma_save.js:161` compone l'array senza la riga) | l'array vive nel documento Azienda | **restano**: nessun `deleteObject` in `ma_save.js`, l'unico `deleteDoc` cancella l'intera Azienda (`ma_save.js:204`) |
| Riga dell'array `attachments` di una Scadenza (`deadline-attachment-controller.js:35-45`) | rimossa al salvataggio (`deadline-save-service.js:151`) | l'array vive nel documento Scadenza | **restano**: il controller non tocca Storage |
| Cancellazione della Scadenza (`dettaglio_scadenza.js:27-55`) | documento eliminato | metadati della Scadenza eliminati (e `expiryReference` azzerato nel profilo, se collegata) | **restano**: solo `deleteDoc`/transazione, nessuna chiamata a Storage |

<a id="evidenza-e977f4af939055730781"></a>

**Errori parziali.** In `saveDeadline` l'upload precede la scrittura del documento (`deadline-save-service.js:138` prima di `:162`) e **non esiste compensazione**: se la scrittura fallisce, l'oggetto caricato resta nello Storage senza alcun riferimento — un orfano creato dall'errore. Nella cancellazione della Scadenza, se il documento non esiste o la transazione fallisce, non viene toccato nulla (e i byte restano comunque); se il `deleteDoc` riesce, l'oggetto è già orfano nello stesso istante.

<a id="evidenza-21a09cbaf2afb8c57bde"></a>

**Privato e aziendale.** Le Scadenze sono per proprietario (`users/{uid}/scadenze/{id}`), quindi il residuo è nell'archivio del proprietario; l'array `allegati` dell'Azienda vive nel documento dell'azienda, con oggetti sotto `users/{uid}/aziende_allegati/` — fuori dal prefisso di qualsiasi Account e quindi anche dal purge (che legge solo `.../accounts/{id}/attachments/`, §3.4).

<a id="evidenza-56b818759a8d476b5f25"></a>

**Prove.** Emulator (Firestore + Storage reali, Rules di produzione): `tests/attachment-removal-residues.emulator.test.mjs` esegue la `deleteScadenza` **reale** (documento eliminato, oggetto ancora elencato e leggibile byte per byte) e la `saveDeadline` **reale** (array aggiornato a vuoto, oggetto ancora presente), più un errore parziale reale (upload riuscito, scrittura fallita → oggetto orfano). Modello e sorgente: `tests/attachment-removal-residues.test.mjs` (rimozione dallo stato del form, composizione reale degli array, transazione della Scadenza collegata, assenza di compensazione).

**Controllo per mutazione.** Cancellazione della Scadenza che tocca Storage → rosso (modello ed emulatore); salvataggio che lascia una riga residua nell'array → rosso (emulatore).

<a id="evidenza-6d49a9036d30716cf45c"></a>

**Limiti dichiarati.** I percorsi di **form** (rimozione della riga) sono provati a livello di stato e di composizione: il salvataggio completo dell'Azienda non è rieseguito su Emulator (transazione sui contatti e caricamento cifrato fuori perimetro), mentre per la Scadenza il salvataggio è quello reale. Non sono esercitati gli hard-delete di Azienda/Account (T-27) né la pulizia degli orfani (D4). Nessuna cancellazione è stata aggiunta al runtime.

<a id="fonte-docs-m7-retention-censimento-md-510-classificazione-degli-orfani-dopo-il-purge-m7-t16"></a>

#### 5.10 Classificazione degli orfani dopo il purge (M7-T16)

<a id="evidenza-e433631b2b5e790843d0"></a>

Sintesi delle prove già acquisite (T-09, T-13, T-26, T-27, T-28) per prefisso e per causa, con la distinzione richiesta fra ciò che è stato **osservato su Emulator** e ciò che è **solo dedotto dal codice**. Nessun banco nuovo: ogni meccanismo è già esercitato almeno una volta su emulatori reali.

| Prefisso Storage | Causa | Esito | Stato della prova |
|---|---|---|---|
| `users/{uid}/accounts/{aid}/attachments/**` | oggetto **non elencato** nei metadati al momento del purge | **resta**: il purge non inventaria il prefisso | **osservato**: T-13 caso 1 (esistenza), T-09 caso mirato (esistenza, byte propri, sottocartella `scansioni/`, Account vicino `acc-1-bis`, conteggio `getFiles`), T-27 caso 2 (contesto aziendale, verifica con `listAll` del client) |
| idem | oggetto **elencato** nei metadati | **rimosso** dal purge | **osservato**: T-13 caso 1, T-27 caso 2 |
| idem | upload riuscito e **scrittura dei metadati fallita** | resta un orfano: `uploadBytes` precede `addDoc` e non c'è compensazione (`dettaglio-privato-attachments.js:132-148`, `dettaglio-azienda-attachments.js:107-123`) | **dedotto dal codice** (non esercitato su Emulator; lo stesso meccanismo è osservato per le Scadenze, riga sotto) |
| `users/{uid}/aziende_allegati/**` (allegati del form Azienda) | riga rimossa dall'array `allegati` e salvataggio (`ma_save.js:161`) | **resta**: nessun `deleteObject` nel percorso | **dedotto** (T-26 §rimozione riga: modello + sorgente; il salvataggio completo della form non è esercitato) |
| idem | **hard-delete dell'Azienda** | **resta**: il `deleteDoc` è sul solo documento Azienda | **osservato**: T-27 caso 1 (`items(.../aziende_allegati) === ['modulo.pdf']`) |
| `users/{uid}/aziende/{cid}/accounts/{aid}/attachments/**` | **hard-delete dell'Azienda** | **restano** documento Account, metadati e byte: sottocollezione orfana | **osservato**: T-27 caso 1 |
| idem | **purge dell'Account aziendale** | elencato rimosso, **non elencato resta**; Account omonimo di un'altra Azienda intatto | **osservato**: T-27 caso 2 |
| `users/{uid}/scadenze/{id}/**` | riga rimossa dall'array `attachments` e salvataggio | **resta** (`saveDeadline` reale compone l'array senza la riga) | **osservato**: T-26 caso 2 |
| idem | **cancellazione della Scadenza** | **resta** (`deleteScadenza` reale elimina solo il documento) | **osservato**: T-26 caso 1 |
| idem | **errore parziale** (upload riuscito, scrittura fallita) | resta l'oggetto caricato, senza riferimento | **osservato**: T-26 caso 3 |
| `users/{uid}/avatar_*` | **cambio avatar** | **resta** il precedente, con i suoi byte | **osservato**: T-28 caso 2 |
| `users/{uid}/avatar_*` | **errore parziale** (URL o `updateDoc` fallito) | resta l'oggetto nuovo senza riferimento | **dedotto** (T-28 banco a modello; il banco emulator non forza il fallimento) |
| `users/{uid}/accounts/{aid}/scansioni/**` (sottocartella **diversa** da `attachments/`, ma sempre sotto il prefisso dell'Account purgato) | assenza di inventario | **resta** | **osservato**: T-09 caso mirato |
| **qualsiasi altro prefisso sotto `users/{uid}/**` fuori dall'Account purgato** (es. `aziende_allegati/`, `scadenze/`, `avatar_*`) | assenza di inventario | **resta** (il purge legge solo i metadati dell'Account) | **dedotto dal codice**: il purge non scansiona il prefisso e tocca solo `.../accounts/{aid}/attachments/`; per questi prefissi la sopravvivenza è **osservata per altre cause** (righe sopra), non attraverso un purge |

<a id="evidenza-e2587d14f92a87b80d6f"></a>

**Bilancio:** **10 classi osservate su Emulator** e **4 classi solo dedotte dal codice** (upload parziale di un allegato di Account; riga rimossa dal form Azienda; errore parziale sull'avatar; sopravvivenza al purge di un prefisso fuori dall'Account).

<a id="evidenza-9a03154ba6c802686111"></a>

**Conseguenze comuni (osservate o asserite).** Il purge recupera **solo** i percorsi elencati sotto `.../accounts/{aid}/attachments/`: nessuna delle altre classi è raggiunta. Nessun job o percorso pulisce alcuna di queste classi (due sole schedulazioni nel backend; la retention scansiona il solo `collectionGroup("auditEvents")`, T-08). Un `storagePath` **elencato** fuori prefisso fa interrompere il purge prima di ogni cancellazione (T-05/T-33), quindi non è una via per ripulire altri prefissi.

<a id="evidenza-b2d05ee2db47b8f1b4a9"></a>

**Deduzione dichiarata (non esercitata).** Dopo l'hard-delete dell'Azienda l'Account orfano **esiste ancora** con `isArchived: true`: un purge successivo invocato con il contesto aziendale giusto lo eliminerebbe (documento, sottocollezione e byte elencati), ma la UI non offre più quel percorso perché l'elenco parte dalle Aziende. È una conseguenza del codice (`purgeDecision` più `accountPath`), **non** misurata.

<a id="evidenza-755c22988d6ede83408e"></a>

**Perché nessun banco nuovo.** Le tre classi dedotte (upload parziale di un allegato di Account, riga rimossa dal form Azienda, errore parziale sull'avatar) ripetono meccanismi **già osservati** su un altro prefisso: la sequenza «upload prima della scrittura, senza compensazione» è esercitata per le Scadenze (T-26 caso 3) e la riscrittura dell'array è esercitata con `saveDeadline` reale (T-26 caso 2). Aggiungere banchi equivarrebbe a ripetere le stesse asserzioni su un altro documento, come richiesto di evitare.

**Verifica esterna non eseguita.** Non si misura quanti oggetti non elencati esistano nel bucket reale né se il bucket abbia lifecycle/TTL (T-22 resta da realizzare): la classificazione è sui dati sintetici e sul runtime corrente.

<a id="fonte-docs-m7-retention-censimento-md-6-backup-e-ripristino-comportamento-attuale"></a>

### 6. Backup e ripristino: comportamento attuale

<a id="fonte-docs-m7-retention-censimento-md-61-il-file-di-backup-è-locale"></a>

#### 6.1 Il file di backup è locale

<a id="evidenza-6a095f266d6c72e72828"></a>

L'export produce un file `codici-password-<data>.cpbackup` scritto con File System Access API oppure scaricato via Blob (`Frontend/public/assets/js/modules/settings/backup-export-service.js:120,161`); **non viene caricato** su Storage o Firestore. La prima riga è un'intestazione **in chiaro** con formato, `schemaVersion: 2`, `ownerUid`, `backupId`, `createdAt` e parametri KDF; i record e gli allegati seguono cifrati AES-GCM-256 concatenati (`.../settings/backup-crypto.js:50-59`, `backup-export-service.js:167,172-188`). La Recovery Key è generata una sola volta e azzerata alla chiusura (`.../settings/impostazioni.js:681-735`).

<a id="evidenza-d23d75b77726ac8ee83a"></a>

Conseguenza di retention: **le copie di backup sono fuori dal controllo del servizio**. Il purge di un Account non può cancellare un file `.cpbackup` già esportato, e l'export include anche gli Account archiviati (nessun filtro `isArchived` nella raccolta dei record).

<a id="fonte-docs-m7-retention-censimento-md-62-cosa-resta-dopo-un-ripristino"></a>

#### 6.2 Cosa resta dopo un ripristino

| Elemento | Percorso | Persistenza | Riga |
|---|---|---|---|
| Ricevuta del blocco | `mutationResults/{uid}/operations/{operationId}` con `binding`, `operationHash`, `appliedAt` | permanente, client in sola lettura, nessun TTL | `functions/index.js:554,598-601`; `firestore.rules:30-33` |
| Audit del blocco | `users/{uid}/auditEvents/{operationId}` con azione `backup-restore-chunk` | permanente; cancellabile dal client (wildcard) | `functions/index.js:602-608` |
| Registro legacy bloccante | `users/{uid}/backupRestoreOperations/{operationId}` | letto e **mai scritto** dal codice attuale; se presente blocca l'apply | `functions/index.js:555,571-574` |
| Oggetti allegato | `users/{uid}/...` al **percorso finale** | nessuno staging, nessuna copia preventiva | `.../settings/backup-import-service.js:445-452` |
| Journal / compensazione | — | **assenti** nel runtime: la compensazione esiste solo nel laboratorio `experiments/persistent-vault-shell/**` e per un altro dominio | — |

Il digest della ricevuta è calcolato sull'**intero comando, dati dei record inclusi** (`functions/backup-restore-receipt.js:31`): la ricevuta conserva quindi un'impronta dei dati ripristinati, non solo metadati.

<a id="fonte-docs-m7-retention-censimento-md-63-atomicità"></a>

#### 6.3 Atomicità

<a id="evidenza-7d4577f57b5580c589cf"></a>

Il ripristino applica blocchi separati (max 400 record per blocco, `functions/backup-restore-service.js:3`) e carica gli allegati dopo i record. Un'interruzione lascia record applicati senza allegati o allegati parziali sul percorso finale, senza rollback complessivo (confermato da `tests/backup-restore-session.test.mjs:110`; rilievo F2-P0-07, `docs/AUDIT_PROGETTO_FASE2_STATICO.md:34`). La preview **non scrive nulla** (`functions/index.js:585`).

<a id="fonte-docs-m7-retention-censimento-md-64-copie-di-consultazione-e-cache"></a>

#### 6.4 Copie di consultazione e cache

- Il report di salute delle credenziali è solo in memoria (`.../settings/impostazioni.js:142`); non produce file.
- La cache del dispositivo è indipendente dal backup: cache Firestore persistente multi-tab (`Frontend/public/assets/js/firebase-config.js:56-58`) e marcatore di preparazione offline `codex_offline_ready_{uid}` in `localStorage` con TTL 5 minuti valutato **alla lettura** (`Frontend/public/assets/js/offline-sync.js:27,110-117`). Nessuna cancellazione di questi elementi è stata trovata nel codice esaminato.

<a id="fonte-docs-m7-retention-censimento-md-65-copie-sul-dispositivo-che-cosa-resta-dopo-logout-e-dopo-purge-verificato-m7-t23"></a>

#### 6.5 Copie sul dispositivo: che cosa resta dopo logout e dopo purge (verificato M7-T23)

<a id="evidenza-bd533392038fdbfc297d"></a>

Censimento delle copie client e prova con dati sintetici (`tests/device-cache-residues.test.mjs`, 7 casi). Distinzione usata in tutta la tabella: **cancellato** (l'archivio viene svuotato), **invalidato** (la sessione si chiude ma i byte restano), **presente** (il dato è ancora nell'archivio locale).

| Archivio | Che cosa contiene | Dopo **logout** | Dopo **purge** di un Account |
|---|---|---|---|
| `sessionStorage` — sessione Vault (`vault_session_v1`, `codex_vault_session_wrapping_key_v1`, `vault_s_key`, `vault_s_expiry`) | chiave Vault cifrata per la scheda | **cancellato** (`clearVaultSession`, `logout-session.js:7`) | non pertinente |
| `sessionStorage` — altri dati (`profile-account-link-draft`, `profile-deadline-link-draft`, `pending_deadline_link`, `vault_verified`) | bozze e stato di navigazione dell'utente | **presente** nella stessa scheda: il logout non svuota `sessionStorage`; sparisce alla chiusura della scheda | **presente** |
| `localStorage` — envelope e verifier del Vault (`codex_vault_envelope_{uid}`, `codex_vault_verifier_{uid}`) | **cifratto**: chiave Vault avvolta + verifier; richiede la Master Password | **presente** (per progetto: serve all'auto-sblocco) | **presente** |
| `localStorage` — `codex_vault_secret*` (deprecato), `codex_profile_avatar_{uid}`, `codex_theme`, `codex_push_active_scopes`, `codex_offline_ready_{uid}` | segreti deprecati in fase di pulizia, URL avatar, tema, ambiti push, marcatore TTL | **presente** (`purgeDeprecatedVaultSecrets` rimuove solo i segreti deprecati al cambio di stato auth, `security-manager.js:42-45`) | **presente**; l'URL dell'avatar può puntare a un oggetto non più esistente |
| **IndexedDB** — cache Firestore persistente (`persistentLocalCache`, multi-tab) | documenti sincronizzati come scritti dall'app: campi cifrati del Vault **e** metadati leggibili (nomi, marcatori, percorsi) | **presente**: nessun percorso del runtime chiama `clearIndexedDbPersistence` | **presente** finché l'SDK non sincronizza la cancellazione del server; nessuna evacuazione locale esplicita |
| **IndexedDB** — coda offline (`codex-offline-queue-{uid}`, store `encryptedOperations`) | operazioni pendenti **sigillate** AES-GCM con chiave derivata dalla Vault Key | **presente** e non toccata dal logout; riapribile solo con la Vault Key (provato: chiave diversa → apertura rifiutata) | **presente** |
| **Cache Storage** — shell PWA (`codex-shell-<versione>`) | solo risorse **stessa origine** dichiarate nella shell (HTML/JS/CSS/manifest) | **presente**: il logout non la tocca; `activate` cancella solo le proprie versioni precedenti | **presente**; nessuna risposta di Firestore/Storage/Functions vi entra (richieste cross-origin scartate) |
| Cache delle **risposte backend** | — | **non esiste** in Cache Storage: cross-origin scartato, `/protected-media/presentation` escluso, ammessi solo i percorsi della shell | — |
| Chiavi delle voci di cache | URL completi, **query inclusa** (`cache.put(request)`) | un URL di pagina con `?id=<Account>` resta **nominato** nella cache stessa-origine, senza il contenuto dell'Account | — |
| Blob/allegati aperti, file scaricati (`.cpbackup`, report) | copie fuori dal controllo dell'app | **presenti** (file system dell'utente) | **presenti** |

<a id="evidenza-ff165c37e6cf3375b262"></a>

**Prove.** `tests/device-cache-residues.test.mjs`: il logout reale azzera la sola sessione Vault e non invoca **alcuna** primitiva distruttiva (nessun `clear`, nessun `delete`); il censimento statico su 161 sorgenti del runtime (esclusi i bundle `vendor/`) non trova `clearIndexedDbPersistence`, `indexedDB.deleteDatabase`, `localStorage.clear(` o `sessionStorage.clear(`, e trova `caches.delete` **solo** in `sw.js` per le proprie cache di shell non correnti; il service worker reale non intercetta risposte cross-origin nemmeno con percorso identico a una risorsa di shell; la coda offline, dopo il logout, conserva il contenitore **senza plaintext** e si riapre solo con la Vault Key; il percorso di purge del client invoca la callable e **non** evacua la cache locale.

**Controllo per mutazione.** Logout che svuota `localStorage`/IndexedDB/Cache → 3 casi rossi; service worker senza controllo di origine → caso della cache cross-origin rosso; coda offline che conserva il plaintext → caso della coda rosso.

<a id="evidenza-3ae1e4a9595b98f4e104"></a>

**Limiti dichiarati.** La prova è di **livello codice con archivi simulati**: nessun browser è stato usato, quindi non sono esercitati l'IndexedDB reale, la Cache API reale, la persistenza Firestore su disco né il comportamento dell'SDK offline a sessione chiusa (per esempio la possibilità di leggere dalla cache locale senza autenticazione). Che cosa resta **fisicamente** sul dispositivo è dedotto dalla configurazione (`persistentLocalCache`) e dall'assenza di cancellazioni nel runtime, non misurato su un browser. La presenza di residui nei dati reali non è verificata. La policy di cancellazione della cache **non è stata decisa né introdotta**.

<a id="fonte-docs-m7-retention-censimento-md-66-copie-di-consultazione-che-cosa-è-solo-in-memoria-e-che-cosa-esce-dallapp-verificato-m7-t24"></a>

#### 6.6 Copie di consultazione: che cosa è solo in memoria e che cosa esce dall'app (verificato M7-T24)

Censimento delle superfici che producono copie di consultazione e prova con dati sintetici (`tests/consultation-copies.test.mjs`, 6 casi). Nessun file o dato personale reale è stato letto o creato.

| Superficie | Dove vive la copia | Dopo il purge di un Account |
|---|---|---|
| Report **salute credenziali** (`impostazioni.js:66-152`) | **solo in memoria**: modale DOM, nessun file; alla chiusura i risultati vengono **azzerati** (`:85-87`); il testo dichiara «Analisi eseguita soltanto in memoria» e mostra solo identità, forza e flag, **mai** una password | rigenerabile dai dati correnti; non esiste una copia da cancellare |
| Report **uso dei campi** (`account-field-usage-service.js:135-180` + `account-field-usage-model.js:94-107`) | **solo in memoria**: nessun `Blob`, nessun download, nessun archivio locale nei due moduli; gli Account archiviati sono **esclusi** e contati (`archivedExcluded`) | **online** il report rigenerato legge le sorgenti confermate e non contiene l'Account purgato; **offline**, o se la lettura confermata non risponde, il ripiego è la **cache locale** e il report può ancora includere l'Account purgato (provato) |
| Diagnostica **prestazioni** (`performance-metrics.js`, campioni in `localStorage`, `clearPerformanceSamples`) | archivio locale del dispositivo (non un file) | resta finché non viene cancellata esplicitamente: **censimento di codice, non esercitato** in M7-T24 |
| File di **backup** `.cpbackup` (`backup-export-service.js:117-139`) | **file dell'utente** (File System Access o download) | un file **già esportato** resta fuori dal controllo dell'app; un **nuovo** export richiede la rete (`BACKUP_REQUIRES_ONLINE`) e legge sorgenti confermate, quindi non contiene l'Account purgato; **nessun filtro** `isArchived`: gli archiviati sono inclusi (provato) |
| **vCard** `.vcf` (`profilo_privato.js:336-344`, `company-profile-ui.js:123`, `contact-card-receiver.js:32-33`) | **file dell'utente**: `Blob` + link con `download`; viene revocato solo l'Object URL, non il file | il file scaricato resta; l'app non ha alcun handle per ritirarlo (provato) |
| Allegati aperti e copie di consultazione dell'utente (screenshot, stampa del browser, PDF esterni) | fuori dall'app | restano: **non gestibili** dall'applicazione |
| **Excel** e **PDF/stampa** | **non esistono** nell'app distribuita: nessun `xlsx`/`SheetJS`/`jspdf`/`window.print` nei sorgenti; l'unica proiezione Excel è di laboratorio (`experiments/persistent-vault-shell/excel-export-projection.mjs`, non montata) e maschera i valori sensibili (provato) | non pertinente |

<a id="evidenza-fc9e03809321e03665f1"></a>

**Prove.** Il banco esegue il modello e il servizio **reali** del report uso dei campi (esclusione degli archiviati, rigenerazione pulita online, fallback sulla cache che include l'Account purgato), la funzione **reale** `showCredentialHealthResults` (nessun segreto sintetico nel DOM, risultati azzerati alla chiusura), la funzione **reale** `downloadVCard` (un solo oggetto creato, revoca del solo Object URL) e i fatti di sorgente dell'export di backup.

**Controllo per mutazione.** Archiviati inclusi nel report → rosso; risultati non azzerati alla chiusura → rosso; vCard con handle di file → rosso; segreto stampato nel report → rosso.

<a id="evidenza-d07197d4d1e708ec8abd"></a>

**Limiti dichiarati.** La prova è di **livello codice con DOM, Blob e repository simulati**: non viene creato alcun file reale e non è esercitato il browser (nessun `showSaveFilePicker`, nessun salvataggio su disco). Che un file **già esportato** resti leggibile è una proprietà del file system dell'utente, **non misurabile** dall'app. La diagnostica prestazioni è censita ma **non esercitata**. Non sono state aperte le decisioni su cancellazione, avviso all'utente o limitazione delle copie: la scelta di prodotto è raccolta in un **commit separato** (`docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md`).

<a id="fonte-docs-m7-retention-censimento-md-67-intestazione-in-chiaro-del-file-cpbackup-verificato-m7-t17"></a>

#### 6.7 Intestazione in chiaro del file `.cpbackup` (verificato M7-T17)

<a id="evidenza-2c7cbee84a2af0942f78"></a>

Il file è una **sequenza di righe JSON** (`serializeBackupLine`): **la prima riga è l'intestazione in chiaro**, tutte le successive sono buste cifrate — una per voce (record, allegati) e una di chiusura (footer). Misurato con il **percorso di export reale** e la **crypto reale** (`tests/backup-header-cleartext.test.mjs`).

| Che cosa è leggibile senza chiave | Contenuto |
|---|---|
| **Intestazione** (prima riga) | **esattamente** `format` (`codici-password-backup`), `schemaVersion` (2), `ownerUid`, `backupId` (UUID casuale per file), `createdAt` (intero, ms), `kdf` = `{name: PBKDF2-SHA256, iterations: 600000, salt: 32 byte casuali in base64}`, `cipher` (`AES-GCM-256-CHAINED`) |
| **Buste** (tutte le righe successive) | solo `sequence`, `previousDigest`, `iv` (12 byte) e `ciphertext`: nessun campo del contenuto |

<a id="evidenza-f8907c5882db970a3cf9"></a>

**Che cosa un osservatore può ricavare dai metadati non segreti.** Dal solo file: l'**UID del proprietario** (collega il file a un account), un **identificatore casuale** del file, la **data di creazione** (quando l'utente ha eseguito il backup), il **nome e il costo del KDF** con il suo **salt** (consente un attacco a dizionario offline sulla Recovery Key) e la **versione del formato** (utile per gli strumenti). Dal numero di righe ricava **quante voci** contiene il backup (record e allegati), mentre i **conteggi del footer restano cifrati**; la dimensione del file è ovvia. **Non** può ricavare alcun contenuto: né gli identificatori dei record, né i percorsi Storage, né i byte degli allegati, né la Recovery Key (che non è mai nel file), né materiale del Vault.

<a id="evidenza-1f81c1b80777e508aac0"></a>

**Nessuna fuga in chiaro.** Nel file prodotto con dati sintetici non compaiono la Recovery Key, i valori dei record (password, note), i percorsi degli allegati né i byte degli allegati: il controllo positivo mostra che gli stessi marcatori **si leggono solo dopo la decifratura**, e che con una chiave diversa la catena non si apre.

<a id="evidenza-80efe6cf2ea7489dd884"></a>

**Prove.** `tests/backup-header-cleartext.test.mjs` (4 casi: campi esatti dell'intestazione e buste, assenza di fughe, catena valida solo con la Recovery Key, identificatore e salt diversi fra due backup). **Controllo per mutazione:** un campo in più nell'intestazione → rosso; corpo che conserva il plaintext → rosso. I banchi già esistenti sono stati valutati: `tests/backup-crypto-runtime.test.mjs` prova la cifratura delle voci e i vincoli di catena/proprietario, `tests/backup-export-session.test.mjs` prova il flusso con la **crypto sostituita**, `tests/backup-export-model.test.mjs` copre modello e descrittori: **nessuno** ispezionava il file prodotto.

<a id="evidenza-25a70a05c0e15228dd5b"></a>

**Limiti dichiarati.** I dati sono sintetici e le sorgenti del backup sono sostituite (i descrittori e la crypto sono quelli reali); non è esercitato il salvataggio su disco (File System Access o download), coperto da `tests/backup-export-session.test.mjs`. L'analisi di ciò che un osservatore ricava è **analitica**, non eseguita con un parser di terze parti. Il file resta **locale** e non viene caricato (§6.1). La scelta se accettare o ridurre l'intestazione in chiaro è una decisione di prodotto, raccolta in un **commit separato** (`docs/M7_DOMANDE_T17_INTESTAZIONE_BACKUP.md`).

<a id="fonte-docs-m7-retention-censimento-md-68-ripristino-di-un-backup-che-contiene-un-account-poi-purgato-verificato-m7-t21"></a>

#### 6.8 Ripristino di un backup che contiene un Account poi purgato (verificato M7-T21)

<a id="evidenza-2bebab666d3f99ceb28b"></a>

Misura con **export reale**, **purge reale** (callable) e **ripristino reale** (callable `restoreBackupChunk`, anteprima + apply come fa il client) su emulatori Firestore + Storage, più il passo di caricamento degli allegati che il client esegue. Dati sintetici.

| Passo | Esito misurato |
|---|---|
| Backup esportato mentre l'Account è **archiviato** | il file contiene il record dell'Account (con `isArchived: true`), il metadato dell'allegato, i **byte** dell'allegato e i documenti che lo nominano (Profilo, Azienda) |
| Purge | Account, sottocollezione `attachments` e byte **elencati** eliminati; i riferimenti in Profilo e Azienda **ripuliti**; ricevuta `purged` ed evento di audit scritti |
| **Ripristino dello stesso file** | l'Account è **ricreato** con i valori del backup (`isArchived: true`, `revision: 1` e i **valori memorizzati identici**: il banco semina marcatori sintetici, non ciphertext reali), il metadato dell'allegato è ricreato, i **byte** dell'allegato sono ricaricati al percorso finale e i **riferimenti** in Profilo e Azienda tornano al valore del backup: **la pulizia del purge è annullata** |
| Ricevute | la ricevuta di purge resta `purged` e quella del ripristino è scritta a parte; entrambi gli eventi di audit esistono |
| Conseguenza sulla ripetizione | ripetendo il purge con lo **stesso** `operationId` la risposta è `duplicate: true` e l'Account ricreato **resta**; con un `operationId` **nuovo** il purge funziona di nuovo |
| Identità | il **file prodotto** non si apre sotto un altro proprietario: il primo passo del flusso client è `deriveBackupKey`, che valida `ownerUid` nell'intestazione e fallisce (`FORMAT`); in più la callable **rifiuta** una richiesta con `expectedOwnerUid` diverso dall'utente autenticato (`BACKUP_OWNER_MISMATCH`) senza scrivere nulla; con l'utente coerente i percorsi sono **derivati dall'UID autenticato** (i record finiscono sotto chi importa) e un `id` che tenta di uscire dal prefisso è rifiutato |

<a id="evidenza-8365033ebd72434179dc"></a>

**Distinzione richiesta.** Quanto sopra è la **possibilità tecnica**: il ripristino ricrea un Account purgato perché scrive i documenti del backup e ricarica gli allegati. **Non** è una scelta di prodotto: se un purge debba essere definitivo anche rispetto ai backup già esportati è **D5**, e la domanda operativa è raccolta in un commit separato.

<a id="evidenza-54540819a418f906896d"></a>

**Prove.** `tests/purged-account-restore.emulator.test.mjs` (3 casi, emulatori reali, callable reali). **Controllo per mutazione:** ripristino che non ricrea i documenti assenti → rosso (3 casi); controllo sul proprietario rimosso dalla callable → rosso (identità); **vincolo di proprietario rimosso dall'intestazione** (`validateHeader`) → rosso sul caso del file prodotto. Riuso dei banchi esistenti: il flusso del client (anteprima, chunk, identità, allegati) è già coperto da `tests/backup-restore-session.test.mjs` con stubs; qui si misura l'**effetto sul dato** dopo un purge reale.

<a id="evidenza-2159323e05efd56bc803"></a>

**Limiti dichiarati.** Le sorgenti del backup sono **stub che rispecchiano il seed** (l'export usa la crypto reale); l'anteprima è chiamata dal banco, non dall'interfaccia; il **salvataggio/lettura del file su disco** e la UI non sono esercitati (coperti altrove); il caricamento degli allegati è eseguito dal banco con lo stesso percorso e gli stessi metadati del client, non dal servizio client completo. I **valori dei campi** sono marcatori sintetici: la **forma cifrata reale** scritta dal client non è esercitata (il backup memorizza il valore così com'è e il ripristino lo riscrive identico). Nessuna modifica a formato, politica o runtime; nessun backup o dato reale.

<a id="fonte-docs-m7-retention-censimento-md-7-sintesi-cosa-esiste-e-cosa-non-esiste"></a>

### 7. Sintesi: cosa esiste e cosa non esiste

| Proprietà | Stato attuale | Evidenza |
|---|---|---|
| Scadenza automatica del cestino Account | **non esiste** | `archive-account-model.js:1-7`; nessun TTL, nessun job |
| Scadenza automatica del cestino `trash` (syncRecords) | **non esiste** (metadato inerte) | `functions/index.js:429` scrive, nessun lettore |
| Purge manuale backend-only con conferma forte | **esiste** | `functions/index.js:448-537` |
| TTL di progetto Firestore/Storage | **non presente nel repository**; configurazione reale `non verificata` | `firestore.indexes.json:7` (`"ttl": false`); `firebase.json` senza lifecycle |
| Schedulazioni backend | **una sola**, per le scadenze | `functions/index.js:1486` |
| Limite quantitativo della cronologia | **esiste solo nel laboratorio** (100 eventi) | `experiments/history-recovery/history-model.mjs:26-27` |
| Audit con allowlist senza segreti | **esiste su 2 percorsi su 5** | `history-recovery-service.js:29-34`; `backup-restore-service.js:136-142` |
| Audit leggibile/scrivibile/cancellabile dal proprietario | **lettura sì, scrittura no nel ramo** (M7-AUDIT-2); le Rules distribuite restano permissive | `firestore.rules` (blocco dedicato in sola lettura ed esclusione dal catch-all); censimento originale a `firestore.rules:106-118` |
| Anonimizzazione dell'audit al purge | **non esiste** | nessuna riga cancella o redige `auditEvents` |
| Pulizia dei widget/credenziali condivise collegate all'Account | **solo proposta, non attiva** | `functions/archive-purge-reference-plan.js:16-18,32` |
| Staging del ripristino (nessun residuo temporaneo) | **non implementato** → nessun residuo di staging | `functions/index.js:539-608`; `backup-import-service.js:445-452` |
| Journal durevole del ripristino | **assente** | solo ricevute per blocco |
| Copie residue dopo il purge | **presenti e non gestite** | sezione 3.4 |

<a id="fonte-docs-m7-retention-censimento-md-8-proposta-di-politica-di-retention-confrontabile-non-approvata"></a>

### 8. Proposta di politica di retention (confrontabile, non approvata)

Le durate **non sono decise qui**. Per ogni dimensione sono elencate le opzioni tecniche, che cosa richiede ciascuna e se la scelta spetta al proprietario.

<a id="fonte-docs-m7-retention-censimento-md-d1--durata-ordinaria-del-cestino-archivio-account"></a>

#### D1 — Durata ordinaria del cestino (Archivio Account)

| Opzione | Comportamento | Cosa richiede |
|---|---|---|
| **D1-a** Conservazione illimitata fino a purge manuale (stato attuale) | nessuna cancellazione automatica | nulla; da dichiarare esplicitamente all'utente |
| **D1-b** Finestra dichiarata con purge assistito | allo scadere la UI segnala gli elementi e propone la cancellazione | definizione della durata; contatore/marcatura; nessun job obbligatorio |
| **D1-c** Finestra dichiarata con purge automatico | un job pianificato elimina gli elementi scaduti | funzione `onSchedule` nuova; ricevute per ogni eliminazione; gestione degli errori e della ripetizione; **il purge automatico è distruttivo e richiede una decisione esplicita del proprietario** |

<a id="evidenza-7b4560fbdb76f36494ff"></a>

*Vincolo tecnico:* il purge attuale è una saga non atomica con conferma obbligatoria; un purge automatico dovrebbe riusare lo stesso protocollo senza conferma interattiva (D2). *Decisione del proprietario:* durata e se la cancellazione debba essere automatica o solo proposta.

<a id="fonte-docs-m7-retention-censimento-md-d2--eliminazione-immediata-richiesta-dallutente"></a>

#### D2 — Eliminazione immediata richiesta dall'utente

- Stato attuale: possibile, con conferma testuale e callable (`archivio_account.js`; `functions/index.js:448-537`).
- Da decidere: se esistono categorie per cui la cancellazione immediata non è consentita e come comunicarlo. *Scelta del proprietario, con eventuale vincolo legale.*

<a id="fonte-docs-m7-retention-censimento-md-d3--retention-di-cronologia-e-audit"></a>

#### D3 — Retention di cronologia e audit

| Opzione | Comportamento | Cosa richiede |
|---|---|---|
| **D3-a** Permanente e non modificabile (raccomandata come base tecnica) | nessuna scadenza; l'utente non può cancellare l'audit | togliere `auditEvents`/`trash`/`archiveOperations` dal wildcard proprietario (`firestore.rules:106-118`) o aggiungerli all'elenco escluso; nessun job |
| **D3-b** Finestra definita con potatura | gli eventi oltre la finestra vengono eliminati o aggregati | job pianificato, conteggi, ricevute; definizione della durata |
| **D3-c** Anonimizzazione al purge dell'Account | l'audit resta ma perde i riferimenti all'Account | patch dell'evento; definizione di cosa resta utile per la diagnosi |

*Vincolo tecnico:* l'audit oggi è cancellabile dal client, quindi non è una prova integra; qualunque politica lo presume integro solo dopo D3-a o D3-c. *Decisione del proprietario:* durata e anonimizzazione.

<a id="fonte-docs-m7-retention-censimento-md-d4--allegati-e-copie-residue"></a>

#### D4 — Allegati e copie residue

- Stato attuale: il purge elimina solo gli allegati **elencati** nei metadati dell'Account; cinque famiglie di percorsi non sono toccate da alcun flusso backend (sezione 5.1) e gli orfani non sono cercati.
- Opzioni: **D4-a** solo quanto già elencato (attuale); **D4-b** inventario degli oggetti per prefisso al momento del purge (richiede `list` su Storage dal backend e un budget, e non copre gli oggetti di altri domini); **D4-c** lifecycle di bucket per gli oggetti non più referenziati (richiede una configurazione esterna e una prova su copia non produttiva).
- Da decidere insieme: (i) se la cancellazione debba rimuovere anche `accountWidgets`, `sharedVaultLinks`, `sharedVaultData` e inviti collegati all'Account — il planner esiste ma è **inattivo** e richiede un blocco globale condiviso con ripristino e backup; (ii) se gli allegati di Scadenze, `aziende_allegati` e avatar rientrino in una politica di pulizia dedicata; (iii) cosa fare degli allegati legacy aperti oggi via `url` senza Vault Key.

<a id="fonte-docs-m7-retention-censimento-md-d5--backup-e-ricevute"></a>

#### D5 — Backup e ricevute

- Stato attuale: file `.cpbackup` locale (fuori dal servizio), ricevute e audit permanenti.
- Opzioni: **D5-a** permanenza (attuale); **D5-b** finestra per ricevute e audit con potatura; **D5-c** documentare all'utente che i backup esportati non sono cancellabili dal servizio.
- *Vincolo tecnico:* senza ricevute permanenti si perde l'idempotenza dei retry; una potatura richiede di conservare almeno il periodo di recupero. *Decisione del proprietario:* durata.

<a id="fonte-docs-m7-retention-censimento-md-d6--informazione-allutente"></a>

#### D6 — Informazione all'utente

- Stato attuale: l'Archivio dichiara «Conservato finché non lo elimini manualmente» (`archivio_account.js:355`); il metadato backend `purgeAfterMs` a 30 giorni (dominio diverso) non ha effetto.
- Da decidere: il testo definitivo deve descrivere la politica approvata, e va rimosso o reso effettivo il metadato inerte per evitare due messaggi contraddittori.

<a id="fonte-docs-m7-retention-censimento-md-d7--prova-di-irraggiungibilità"></a>

#### D7 — Prova di irraggiungibilità

- Stato attuale: **non esiste** una prova che, dopo il purge, il dato non sia raggiungibile dai percorsi applicativi. Sono dimostrabili solo i singoli passi (sezione 3.3-3.4).
- Opzioni: matrice di test sintetici (sezione 9) come prerequisito; in più, una verifica su copia non produttiva prima di dichiarare la politica verificata.

<a id="fonte-docs-m7-retention-censimento-md-d8--obblighi-legali-e-di-conservazione"></a>

#### D8 — Obblighi legali e di conservazione

- Stato attuale: nessuna categoria di dati è distinta per obblighi di conservazione o di cancellazione; la baseline richiede che la cancellazione sia «compatibile con eventuali obblighi di conservazione» (`docs/ARCHITETTURA_SICUREZZA_V1.md:249`).
- Da decidere: se esistono categorie (per esempio documenti fiscali o contrattuali) che devono essere conservate oltre la volontà dell'utente e come questo si riflette su cestino, allegati e backup. *Scelta del proprietario, con eventuale supporto legale; nessuna durata è proposta qui.*

<a id="fonte-docs-m7-retention-censimento-md-d9--ordine-di-lavoro"></a>

#### D9 — Ordine di lavoro

- La definizione della politica (D1–D3, D5) è un prerequisito per dare senso tecnico alle modifiche a planner dei riferimenti residui, blocco globale purge/ripristino e potatura; l'ordine è indicato come domanda 9 nella sezione 10.

<a id="fonte-docs-m7-retention-censimento-md-9-matrice-di-test-sintetici-per-la-futura-verifica"></a>

### 9. Matrice di test sintetici per la futura verifica

<a id="evidenza-3cabbf94b2729bf65b83"></a>

Tutti gli scenari usano esclusivamente dati sintetici e ambienti di laboratorio/emulatori. «Esistente» rimanda a una prova già presente; «da realizzare» indica ciò che manca per verificare la politica scelta. **Ogni riga marcata «esistente» è stata verificata leggendo il test citato**: lo scenario descrive la proprietà che quel test dimostra davvero, e dove la prova copre solo una parte dello scenario la riga è marcata «da realizzare» con la parte già coperta indicata a parte.

| ID | Area | Scenario | Atteso | Stato |
|---|---|---|---|---|
| T-01 | Cestino Account | archiviazione di un Account privato e di uno aziendale | scrittura sul percorso corretto, `isArchived: true`, `revision+1`, `purgeAfter` assente | esistente (`tests/account-page-lifecycle.test.mjs:239`; `tests/archive-account-model.test.mjs:8`) |
| T-02 | Cestino Account | ripristino con revisione cambiata | conflitto, nessuna scrittura | esistente (`tests/archive-session.test.mjs:161`) |
| T-03 | Purge | purge senza conferma o con proprietario diverso | rifiuto prima di ogni accesso a Firestore/Storage | esistente (`functions/test/archive-owner-handler.test.js:41,52`) |
| T-04 | Purge | ripetizione di un comando con esito già `purged` | `duplicate`, nessuna cancellazione Storage o `recursiveDelete`, nessuna scrittura | esistente (`functions/test/archive-receipt-handler.test.js:79`) |
| T-05 | Purge | un `storagePath` fuori dal prefisso dell'Account presente nei metadati | purge interrotto **prima** di ogni cancellazione, ricevuta in `processing` | esistente (`functions/test/archive-receipt-handler.test.js:174`); il predicato isolato è T-33 |
| T-06 | Purge | errore parziale sulle delete Storage | ricevuta resta `processing`, nessun falso `purged`, ripresa idempotente con lo stesso comando | esistente (`functions/test/archive-receipt-handler.test.js:187`) |
| T-07 | Purge | piano di pulizia riferimenti oltre 450 modifiche | transazione finale annullata, nessuna pulizia parziale | esistente (`functions/test/purge-profile-cleanup-handler.test.js:63`) |
| T-08 | Copie residue | dopo il purge restano `accountWidgets`/`sharedVaultLinks`/inviti | documentare l'esito atteso secondo la politica scelta | **dichiarato e verificato per il comportamento attuale** (M7-T08, §3.6): `accountWidgets`, `sharedVaultData` e `sharedVaultLinks` **restano invariati** e leggibili **solo dal proprietario**; l'**invito resta invariato** e il **destinatario lo legge ancora** (nome e id dell'Account purgato), con lo stato `suspended` scritto dall'**archiviazione**, non dal purge; la **Scadenza condivisa** segue un altro percorso e la copia del destinatario resta leggibile; nessun job pulisce queste collezioni. Prove: `tests/shared-copies-purge.emulator.test.mjs` (2 casi) e `tests/shared-copies-purge.test.mjs` (5 casi); mutazioni rosse. Nessuna modifica a produzione, Rules o decisioni: le domande residue sono in un commit separato (`docs/M7_DOMANDE_T08_COPIE_CONDIVISE.md`) |
| T-09 | Copie residue | allegato su Storage non elencato nei metadati | resta dopo il purge: verificare la scelta D4 | **dichiarato e verificato per il comportamento attuale** (M7-T09, §3.7): il purge elimina **solo** i `storagePath` letti dai metadati e non ha alcun inventario del prefisso, quindi ogni oggetto non elencato **resta** — stessa cartella, sottocartella diversa dell'Account e Account vicino di nome compresi, con i propri byte — mentre un `storagePath` **elencato** fuori prefisso interrompe il purge prima di ogni cancellazione (T-05/T-33). Prove: casi già esistenti (T-13 caso 1, T-27 caso 2) più **un** caso mirato aggiunto in `tests/purge-retention-effects.emulator.test.mjs`; mutazione con inventario per prefisso → rosso. La scelta è D4 |
| T-10 | Cronologia | un evento di audit non contiene segreti | il segreto fittizio non compare nel documento | esistente (`functions/test/history-recovery-service.test.js:15`; `functions/test/backup-restore-service.test.js:68`) |
| T-11 | Cronologia | limite/scadenza della cronologia nel runtime | cancellazione automatica degli eventi oltre la finestra decisa | **realizzato nel ramo, non distribuito** (M7-AUDIT-6): job pianificato con finestra di 24 mesi di calendario, date `at`/`createdAt`, cursori di servizio, `functions/test/audit-retention-service.test.js` (13 casi), `functions/test/audit-retention-job.test.js` (6) e `tests/audit-retention.emulator.test.mjs` (14); in produzione il job non esiste ancora |
| T-12 | Cronologia | il client tenta di creare, modificare o cancellare un evento di audit | rifiuto secondo la politica decisa | **realizzato nel ramo, non distribuito** (M7-AUDIT-2): esclusione dal catch-all e blocco dedicato in sola lettura, provati in `tests/audit-events.rules.test.mjs`; le Rules distribuite restano quelle precedenti |
| T-13 | Cronologia | effetto del purge su `trash`/`auditEvents`/ricevute legacy | definito e verificato | **verificato** (M7-T13): sugli emulatori reali (Firestore + Storage, Admin SDK del runtime) il purge elimina il solo documento Account con il suo sottoalbero e i byte **elencati** nei metadati, mentre restano cestino legacy, collezioni sorelle, ricevuta legacy, ricevuta di idempotenza (che passa a `purged`) e registro, con l'evento `account-purged` scritto; una ricevuta legacy sola ferma il purge senza toccare nulla; il job dei 24 mesi tocca il **solo** registro, quindi rimuove anche l'evidenza del purge oltre la finestra e lascia intatti cestino e ricevute. Prove: `tests/purge-retention-effects.emulator.test.mjs` (3 casi) e `functions/test/archive-receipt-handler.test.js` (caso M7-T13). Nessuna correzione al comportamento; resta aperta la decisione complessiva su cestino e ricevute |
| T-14 | Allegati | upload senza marcatore `encrypted` per `application/octet-stream` | rifiuto delle Rules | esistente (`tests/storage.rules.test.mjs:69`; `storage.rules:9-21`) |
| T-15 | Allegati | cancellazione di un allegato da parte dell'utente: percorso completo con esito positivo | oggetto rimosso **e** metadato rimosso, senza residui | **verificato** (M7-T15): `tests/account-attachment-delete.test.mjs` esegue i due moduli reali (privato `dettaglio-privato-attachments.js:249-281`, aziendale `dettaglio-azienda-attachments.js:230-254`) su un modello in memoria di bucket e metadati e prova ordine, accoppiamento, assenza di residui e ricarica della lista; `tests/account-attachment-delete.emulator.test.mjs` ripete il percorso sugli emulatori reali Firestore e Storage con le Rules di produzione e verifica che l'oggetto non sia più elencato né leggibile e che il metadato non esista più, con l'altro allegato intatto. Nessun difetto dimostrato: il percorso non richiede correzioni |
| T-16 | Allegati | oggetto orfano per prefisso dopo il purge | assente o motivato secondo D4 | **dichiarato e verificato per il comportamento attuale** (M7-T16, §5.10): classificazione per prefisso e causa degli oggetti che restano non referenziati, con **10 classi osservate su Emulator** (oggetto non elencato e oggetto elencato sotto l'Account purgato; sottocartella dell'Account diversa da `attachments/`; sottocollezione orfana e byte di un'Azienda eliminata; `aziende_allegati` dopo l'hard-delete; Account aziendale purgato con non elencato superstite; allegati di Scadenza rimossi dall'array o con Scadenza cancellata; errore parziale su upload di Scadenza; avatar precedente) e **4 classi solo dedotte dal codice** (upload parziale di un allegato di Account, riga rimossa dal form Azienda, errore parziale sull'avatar, sopravvivenza al purge di un prefisso **fuori** dall'Account, che il caso T-09 non osserva); nessun job le pulisce e un percorso elencato fuori prefisso interrompe il purge (T-05/T-33). **Nessun banco nuovo**: le classi dedotte ripetono meccanismi già osservati (T-26). La scelta resta D4 |
| T-25 | Allegati | purge con `storagePath` reali: il ramo di cancellazione byte è esercitato | cancellazione effettiva, nell'ordine previsto e prima di `recursiveDelete`, con `ignoreNotFound` | esistente (`functions/test/archive-receipt-handler.test.js:160`) |
| T-26 | Allegati | rimozione di una riga dagli array `allegati`/`attachments` e cancellazione di una Scadenza | byte non più referenziati: esito definito secondo D4 | **dichiarato e verificato per il comportamento attuale** (M7-T26, §5.9): in **tutti e tre** i percorsi il riferimento sparisce ma i **byte restano** in Storage (l'unico percorso che li elimina è l'allegato di un Account in sottocollezione, T-15); un errore di scrittura dopo l'upload lascia un orfano (nessuna compensazione). Prove: `tests/attachment-removal-residues.emulator.test.mjs` (3 casi su emulatori reali, incluse `deleteScadenza` e `saveDeadline` reali) e `tests/attachment-removal-residues.test.mjs` (5 casi a modello/sorgente). Nessuna cancellazione aggiunta: la scelta è D4, con domande specifiche in un commit separato (`docs/M7_DOMANDE_T26_RESIDUI_RIMOZIONE.md`) |
| T-27 | Allegati | hard-delete di Azienda o di Account aziendale | metadati e byte residui: esito definito secondo D4 | **dichiarato e verificato per il comportamento attuale** (M7-T27, §3.5): sono **due percorsi diversi** — la cancellazione dell'Azienda dal client è un solo `deleteDoc` **non ricorsivo** (Account, metadati, byte Storage e riferimenti restano), mentre l'eliminazione di un Account aziendale passa dal **purge backend** (ricorsivo: documento e sottocollezione eliminati, byte elencati rimossi, oggetto non elencato e Account omonimo di un'altra Azienda intatti, solo la coppia esatta di riferimenti ripulita). Prove: `tests/company-hard-delete-residues.emulator.test.mjs` (2 casi, `deleteCompany` e purge reali) e `tests/company-hard-delete-residues.test.mjs` (5 casi). Nessuna modifica al runtime: la scelta sui residui è D4, con domande specifiche in `docs/M7_DOMANDE_T27_HARD_DELETE.md` (commit separato) |
| T-28 | Allegati | cambio avatar | il precedente oggetto non resta orfano, o è dichiarato | **dichiarato, non corretto** (M7-T28): il percorso attuale **lascia il precedente oggetto in Storage** — nessuna cancellazione viene nemmeno tentata — e il residuo si accumula a ogni cambio, perché ogni upload usa un nome nuovo (`avatar_<timestamp>_<uuid>`) e `photoURL` viene sovrascritto. Provato con i moduli reali su modello (§5.8) e su emulatori reali Firestore + Storage con le Rules di produzione (`tests/avatar-change-residues.test.mjs`, 6 casi; `tests/avatar-change-residues.emulator.test.mjs`, 2 casi). La proprietà richiesta «non resta orfano» **non** è dimostrata: serve una decisione di pulizia (D4), non introdotta qui |
| T-29 | Allegati | apertura di un allegato legacy senza `encryption` | comportamento di sicurezza dichiarato (oggi `openExternalUrl` senza Vault Key) | **dichiarato e verificato per il comportamento attuale** (M7-T29, §5.5.1): i quattro percorsi reali aprono l'URL del metadato normalizzato, **senza** Vault Key, senza lettura di byte e senza decifratura; restano la policy di protocollo (`http`/`https`) e `noopener`/`noreferrer`, **nessuna** allowlist di host; un popup bloccato è riportato come successo e gli allegati incorporati non hanno controllo di sessione. Prove: `tests/legacy-attachment-opening.test.mjs` (7 casi, ramo cifrato reale come controprova). Nessuna modifica al comportamento: la scelta di limitare o avvisare è una decisione di prodotto |
| T-17 | Backup | header in chiaro con `ownerUid`/`backupId`/`createdAt` | documentato come accettato o rimosso | **dichiarato e verificato per il formato attuale** (M7-T17, §6.7): la **prima riga** è in chiaro ed è **esattamente** `format`, `schemaVersion`, `ownerUid`, `backupId` (UUID), `createdAt`, `kdf` (`PBKDF2-SHA256`, 600000 iterazioni, salt di 32 byte) e `cipher`; tutte le righe successive sono buste con soli `sequence`, `previousDigest`, `iv`, `ciphertext`, e **nessun** segreto (Recovery Key, valori dei record, percorsi e byte degli allegati) compare in chiaro. Un osservatore ricava UID, data, costo/salt del KDF e numero di voci (line count). Prove: `tests/backup-header-cleartext.test.mjs` (4 casi); mutazioni rosse. La scelta se accettare o ridurre l'intestazione è una decisione di prodotto (D5/D6), raccolta in un commit separato (`docs/M7_DOMANDE_T17_INTESTAZIONE_BACKUP.md`) |
| T-18 | Backup | errore al secondo blocco o durante il caricamento degli allegati | stato parziale dichiarato, nessun successo | esistente (`tests/backup-restore-session.test.mjs:100,110`) |
| T-19 | Backup | ricevuta con dati cambiati o comando diverso | rifiuto, nessuna riapplicazione | esistente (`functions/test/backup-restore-receipt.test.js:22`) |
| T-20 | Backup | registro legacy presente | apply bloccato con `LEGACY_BACKUP_RESULT_UNVERIFIED`, nessuna scrittura | esistente (`functions/test/backup-receipt-handler.test.js:48`) |
| T-21 | Backup | importo un backup che contiene un Account poi purgato | comportamento definito secondo D5 | **dichiarato e verificato per il comportamento attuale** (M7-T21, §6.8): il ripristino **ricrea** l'Account purgato con i valori memorizzati identici (`isArchived: true`), il metadato e i **byte** dell'allegato e i **riferimenti** in Profilo e Azienda — annullando la pulizia del purge — mentre la ricevuta di purge resta `purged` e blocca una ripetizione con lo stesso `operationId` (con un id nuovo il purge funziona di nuovo); il **file prodotto** non si apre sotto un altro proprietario (`deriveBackupKey` valida l'intestazione) e la callable rifiuta un `expectedOwnerUid` diverso, con i percorsi derivati dall'UID autenticato. Prove: `tests/purged-account-restore.emulator.test.mjs` (3 casi, callable reali); mutazioni rosse. La scelta di prodotto sul significato del purge rispetto ai backup è D5, con domanda in un commit separato (`docs/M7_DOMANDE_T21_RIPRISTINO_DOPO_PURGE.md`) |
| T-22 | Trasversale | TTL/lifecycle effettivamente assenti sul progetto | verifica esterna documentata | **tentata, esito `non verificato`** (M7-T22, §11.1): i file locali **non** dichiarano TTL né lifecycle (le tre `ttl: false` in `firestore.indexes.json` riguardano gli indici), e la **verifica in sola lettura** non è stata possibile — `gcloud` assente, `GOOGLE_APPLICATION_CREDENTIALS` non impostato, nessuna credenziale ADC, Firebase CLI non autenticato e senza comandi TTL/lifecycle. L'assenza **non** è dedotta dal repository: la voce resta **non verificata** finché qualcuno con accesso non esegue i due comandi documentati (progetto `appcodici-password`, bucket `appcodici-password.firebasestorage.app`), registrando fonte, data e output |
| T-23 | Trasversale | cache del dispositivo dopo purge/logout | esito definito secondo la politica | **dichiarato e verificato per il comportamento attuale** (M7-T23, §6.5): il logout azzera la **sola** sessione Vault in `sessionStorage` e non tocca `localStorage`, IndexedDB (cache Firestore persistente e coda offline) e Cache Storage; il purge è backend e non evacua la cache locale. Nessuna primitiva distruttiva esiste nel runtime; la coda offline resta ma sigillata (Vault Key necessaria); la Cache Storage contiene solo la shell stessa-origine, mai risposte backend. Prove: `tests/device-cache-residues.test.mjs` (7 casi). La **politica** di cancellazione è aperta e le domande per Diego sono raccolte in un commit separato (`docs/M7_DOMANDE_T23_CACHE_DISPOSITIVO.md`) |
| T-24 | Trasversale | copia di consultazione (report/Excel) e dati purgati | nessun residuo non dichiarato | **dichiarato e verificato per il comportamento attuale** (M7-T24, §6.6): i due report dell'app (salute credenziali, uso dei campi) sono **solo in memoria** e senza segreti, il primo azzerato alla chiusura; backup `.cpbackup` e vCard `.vcf` sono **file dell'utente** che l'app non può ritirare; un export **nuovo** usa sorgenti confermate e non contiene l'Account purgato, mentre un report rigenerato **dalla cache** può ancora contenerlo; **Excel/PDF/stampa non esistono** nell'app distribuita (solo proiezione di laboratorio). Prove: `tests/consultation-copies.test.mjs` (6 casi). La politica su copie già esportate e avviso all'utente è una decisione di prodotto, raccolta in un commit separato (`docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md`) |
| T-30 | Cestino Account | lettura della lista dell'Archivio (filtro sugli archiviati) | compaiono solo i record archiviati, con l'identità di contesto corretta | **verificato** (M7-T30): il filtro del profilo privato è nella **query** (`vault-repository.js:29-31`, `where('isArchived','==',true)`) e quello aziendale è **client-side** (`archive-account-service.js:83-89` e `:113-115`); l'identità di contesto (`privato`, oppure id azienda con `businessName`), l'assenza di mescolanza fra contesti e l'invalidazione su cambio utente o blocco del Vault sono provate da `tests/archive-list-filter.test.mjs` (**6 casi**), con `npm run test:history-prototype` 104/104. Il caso del cambio di sessione usa sorgenti **sensibili al proprietario** con Account distinti per A e B e verifica gli uid passati alle letture: un servizio che continuasse a leggere i dati del vecchio proprietario fallisce (controllo per mutazione). Nessun difetto dimostrato: la lista non richiede correzioni |
| T-31 | Cestino Account | ripristino riuscito | identità privato/azienda conservata, solo stato di archiviazione e revisione aggiornati | esistente (`tests/archive-session.test.mjs:147`) |
| T-32 | Allegati | cancellazione di un allegato interrotta dal cambio di Account | nessuna scrittura di metadati sotto il nuovo Account; se la conferma arriva dopo il cambio, nessuna operazione | esistente (`tests/private-account-detail-lifecycle.test.mjs:166,172`) |
| T-33 | Purge | predicato di percorso sicuro su un `storagePath` di un altro proprietario o fuori dal prefisso dell'Account | percorso rifiutato come non sicuro | esistente (`functions/test/archive-purge-service.test.js:19`) |
| T-34 | Cronologia | evento dentro, al confine e oltre la finestra di 24 mesi | conservato dentro, cancellabile al confine e oltre | esistente in laboratorio (`experiments/history-recovery/audit-retention.test.mjs:26,35`) |
| T-35 | Cronologia | record senza data valida, nanosecondi fuori intervallo o secondi non rappresentabili | mai cancellato, elencato come `unverifiable` e fuori da ogni lotto | esistente in laboratorio (`experiments/history-recovery/audit-retention.test.mjs:19,35,162,177`) |
| T-36 | Cronologia | cancellazione a lotti con errore parziale e ripresa | nessun falso completamento; ripresa idempotente dagli eventi residui | esistente in laboratorio (`experiments/history-recovery/audit-retention.test.mjs:46,120`) |
| T-37 | Cronologia | isolamento UID e percorsi fuori dal registro | piano interrotto; nessuna ricevuta pianificata o toccata; piani arbitrari rifiutati prima di ogni cancellazione | esistente in laboratorio (`experiments/history-recovery/audit-retention.test.mjs:65,81,204`) |
| T-38 | Cronologia | il client tenta create, update e delete su un evento di audit | tutte e tre negate; lettura del proprietario conservata | esistente in laboratorio (`tests/history-recovery.rules.test.mjs:17`, Rules candidate) |

<a id="fonte-docs-m7-retention-censimento-md-10-domande-decisionali-per-diego"></a>

### 10. Domande decisionali per Diego

1. **D1 — Durata del cestino Account**: illimitata con cancellazione manuale (attuale), oppure una finestra dichiarata? Se una finestra, la cancellazione allo scadere deve essere **automatica** o solo **proposta** all'utente?
2. **D2 — Cancellazione immediata**: confermi che l'utente può sempre cancellare subito ciò che ha archiviato, senza attese? Esistono categorie escluse?
3. **D3 — Cronologia e audit**: (a) permanenti e non cancellabili dall'utente, (b) con finestra e potatura, (c) anonimizzati al purge dell'Account? In tutti i casi: si rimuove la scrittura/cancellazione client su `auditEvents` (raccomandato per l'integrità della prova)?
4. **D4 — Residui del purge**: ci si limita agli allegati elencati (attuale) o si aggiunge un inventario per prefisso? Si cancellano anche `accountWidgets`, `sharedVaultLinks`, `sharedVaultData` e inviti collegati all'Account (il planner è pronto ma inattivo)?
5. **D5 — Backup e ricevute**: le ricevute di idempotenza e gli audit restano permanenti? I backup esportati dall'utente vanno dichiarati esplicitamente come **fuori** dal perimetro di cancellazione del servizio?
6. **D6 — Messaggi all'utente**: chi approva i testi definitivi di Archivio, cancellazione definitiva e backup? Va rimosso il metadato inerte `purgeAfterMs` (30 giorni) per evitare due messaggi contraddittori?
7. **D7 — Prova di irraggiungibilità**: quale livello di prova è richiesto prima di dichiarare la politica verificata (matrice sintetica soltanto, oppure anche una prova su copia non produttiva)?
8. **D8 — Obblighi legali**: esistono categorie di dati con obblighi di conservazione o di cancellazione che devono prevalere sulla politica scelta?
9. **D9 — Ordine di lavoro**: la definizione della politica viene prima dell'attivazione del planner dei riferimenti residui e del blocco globale purge/ripristino?
10. **D10 — Copie sul dispositivo (M7-T23)**: le sette domande su logout, purge, residui cifrati, bozze in `sessionStorage`, trasparenza all'utente, rapporto con D4/D5 e livello di prova richiesto sono in `docs/M7_DOMANDE_T23_CACHE_DISPOSITIVO.md` (commit separato dalle prove). Comportamento attuale: nulla viene cancellato sul dispositivo, né al logout né dopo il purge.
11. **D11 — Copie di consultazione (M7-T24)**: le sette domande su copie già esportate, avviso al momento del purge, rigenerazione dalla cache, conferma dei report «solo in memoria», Excel/PDF, rapporto con D4/D5 e diagnostica prestazioni sono in `docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md` (commit separato dalle prove). Comportamento attuale: i report dell'app restano in memoria, backup e vCard sono file dell'utente che l'app non ritira, Excel/PDF/stampa non esistono nella app distribuita.
12. **D12 — Residui alla rimozione di righe e Scadenze (M7-T26)**: le cinque domande su rimozione di una riga dagli array, cancellazione di una Scadenza con allegati, compensazione sugli errori parziali, rapporto con D4 e prefissi da coprire sono in `docs/M7_DOMANDE_T26_RESIDUI_RIMOZIONE.md` (commit separato dalle prove). Comportamento attuale: il riferimento sparisce, i byte restano in Storage; `users/{uid}/aziende_allegati/**` e `users/{uid}/scadenze/{id}/**` non sono raggiunti dal purge degli Account.
13. **D13 — Hard-delete di Azienda e Account aziendale (M7-T27)**: le sei domande su cascata degli Account, ordine/atomicità, riferimenti pendenti, prefissi non coperti, rapporto con D4 e testo della conferma sono in `docs/M7_DOMANDE_T27_HARD_DELETE.md` (commit separato dalle prove). Comportamento attuale: cancellare l'Azienda è un solo `deleteDoc` non ricorsivo (Account, byte e riferimenti restano); l'Account aziendale si elimina solo con il purge backend, ricorsivo e limitato ai byte elencati.
14. **D14 — Copie condivise e inviti dopo il purge (M7-T08)**: le sei domande su invito superstite, copie lato proprietario, Scadenza condivisa, indice `deadlineShares`, rapporto con D4/D10-D12 e testo visto dal destinatario sono in `docs/M7_DOMANDE_T08_COPIE_CONDIVISE.md` (commit separato dalle prove). Comportamento attuale: il purge non tocca inviti né copie condivise; l'invito resta leggibile dal destinatario con nome e id dell'Account eliminato e lo stato `suspended` scritto dall'archiviazione.
16. **D16 — Ripristino dopo il purge (M7-T21)**: le cinque domande su ricreazione dell'Account purgato, messaggio all'utente se i record vengono saltati, riferimenti, allegati già presenti e ricevuta di purge dopo la ricreazione sono in `docs/M7_DOMANDE_T21_RIPRISTINO_DOPO_PURGE.md` (commit separato dalle prove). Comportamento attuale: il ripristino ricrea l'Account purgato, i suoi allegati e i riferimenti, e la ricevuta di purge resta purged.
15. **D15 — Intestazione in chiaro del backup (M7-T17)**: le cinque domande su accettare o ridurre l'intestazione, compatibilità della riduzione con deriveBackupKey, numero di voci deducibile, rapporto con D5/D6 e trasparenza all'utente sono in `docs/M7_DOMANDE_T17_INTESTAZIONE_BACKUP.md` (commit separato dalle prove). Comportamento attuale: la prima riga del file è in chiaro con UID, data, parametri KDF e identificatore del file; il corpo è cifrato.

<a id="fonte-docs-m7-retention-censimento-md-11-limiti-del-censimento-e-voci-non-verificate"></a>

### 11. Limiti del censimento e voci `non verificate`

**Non verificato da questo repository (richiede accesso esterno o dati reali, non usati):**

1. policy TTL Firestore a livello di progetto (`gcloud firestore fields ttls list`) e assenza di lifecycle/versioning sul bucket Storage (`gcloud storage buckets describe`, `gsutil lifecycle get`) — **esito T-22 in §11.1: tentativo di verifica in sola lettura, accesso esterno NON disponibile, voce ancora `non verificata`**;
2. corrispondenza fra questo ramo e ciò che è **effettivamente distribuito** (Functions, Rules, Hosting) sul progetto `appcodici-password`;
3. presenza nei dati reali di metadati legacy (`purgeAfter`, ricevute `archiveOperations`/`backupRestoreOperations`, allegati senza campo `encryption` o senza `storagePath`);
4. esistenza e quantità di oggetti Storage orfani e prefissi realmente presenti nel bucket (le Rules consentono al proprietario di scrivere qualunque percorso sotto `users/{uid}/**`);
5. esistenza di file `.cpbackup` già esportati contenenti dati poi purgati;
6. retention dei log delle Cloud Functions, che possono contenere il payload dei comandi di ripristino;
7. eventuali procedure operative esterne al repository che eliminino o conservino dati;

8. comportamento in caso di fallimento parziale delle cancellazioni Storage (deducibile, non testato);
9. configurazione reale di App Check, backup gestiti/PITR e quote del progetto;
10. copie residue lato browser: `persistentLocalCache` conserva metadati in IndexedDB, `localStorage['codex_profile_avatar_{uid}']` conserva l'URL dell'avatar e nel codice non esiste una rimozione al logout (l'assenza di altre copie nel browser non è dimostrabile staticamente);
11. validità della `downloadURL` ripristinata dal backup mentre l'oggetto viene riscritto (comportamento backend del token di download, non deducibile dal codice);
12. cifratura at-rest gestita da Google e concorrenza reale fra purge e upload nella finestra fra la lettura di `attachments` (`functions/index.js:500`) e `recursiveDelete` (`:507`): il codice non serializza le due operazioni.

<a id="fonte-docs-m7-retention-censimento-md-111-verifica-esterna-di-ttl-e-lifecycle-m7-t22-21092026"></a>

#### 11.1 Verifica esterna di TTL e lifecycle (M7-T22, 21/09/2026)

**Che cosa dichiarano i file locali (letti, non modificati).**

| File | Dichiarazione | Che cosa significa |
|---|---|---|
| `firebase.json` | chiavi `firestore` (`database: (default)`, `location: eur3`, `rules`, `indexes`), `storage` (`rules`), `functions`, `hosting`, `emulators` | **nessuna** sezione TTL e **nessuna** sezione lifecycle: la configurazione di deploy non li prevede (una policy TTL e un lifecycle del bucket non si dichiarano in questi file) |
| `firestore.indexes.json` | tre `fieldOverrides` con `"ttl": false`: `accounts.sharedWith` (riga 7), `auditEvents.at` (riga 30), `auditEvents.createdAt` (riga 53) | è la forma con cui il file degli **indici** dichiara che quei campi **non** sono campi TTL; **non** è una prova sullo stato del progetto |
| `firestore.rules`, `storage.rules` | solo autorizzazioni | le Rules **non** possono esprimere né TTL né lifecycle |
| `.firebaserc` | progetto di default `appcodici-password` | progetto e bucket di riferimento: `appcodici-password.firebasestorage.app` (`firebase-config.js:26`) |

**Tentativo di verifica esterna (in sola lettura).** Data: 21/09/2026. Progetto: `appcodici-password`; bucket: `appcodici-password.firebasestorage.app`.

| Accesso necessario | Esito della sonda |
|---|---|
| `gcloud` (per `gcloud firestore fields ttls list`, `gcloud storage buckets describe`) | **assente** sulla macchina |
| `GOOGLE_APPLICATION_CREDENTIALS` | **non impostato** |
| Credenziali ADC di `gcloud` (`%APPDATA%\gcloud\application_default_credentials.json`) | **assenti** |
| Firebase CLI (presente come dipendenza di sviluppo) | **non autenticato** e senza comandi per TTL o lifecycle del bucket |

<a id="evidenza-2eabfeffc05c55c789bb"></a>

**Esito: verifica esterna NON eseguita → TTL e lifecycle restano `non verificati`.** Come richiesto, **non** si deduce l'assenza di TTL o di lifecycle dai file del repository: `ttl: false` negli indici riguarda la definizione degli indici, non lo stato del progetto.

**Comandi che completerebbero la verifica (per chi ha accesso, in sola lettura).**

```
gcloud firestore fields ttls list --project appcodici-password
gcloud storage buckets describe gs://appcodici-password.firebasestorage.app --format=json
```

Da registrare quando eseguiti: **fonte** (account e strumento usati), **data**, **progetto/bucket** e **output** (elenco delle policy TTL attive; eventuale blocco `lifecycle`), senza elencare documenti, oggetti o nomi di file.

<a id="evidenza-fcb46c429ed7b8e69179"></a>

**Limiti.** Nessuna lista di documenti, oggetti o nomi reali è stata prodotta; nessuna modifica a TTL, lifecycle, Rules o IAM; nessun test di codice è stato aggiunto (la verifica è di configurazione). Nessuna nuova domanda di prodotto: la voce resta un **handoff operativo** verso chi possiede le credenziali.

<a id="evidenza-5d7d0034f7c6dcc2662b"></a>

**Limiti di metodo.** Il censimento è statico: legge codice, Rules e configurazione versionata; non esegue test, non interroga il progetto, non legge dati reali. Le proprietà elencate come «esistenti» derivano da codice e test citati, non da un collaudo end-to-end. Nessuna durata, eccezione legale o cancellazione definitiva è stata decisa o implementata da questo documento.

<a id="fonte-docs-m7-retention-censimento-md-12-riferimenti"></a>

### 12. Riferimenti

- Baseline: `docs/ARCHITETTURA_SICUREZZA_V1.md` (§13 backup/recupero/cancellazione; §19 decisioni aperte).
- Contratto d'area: `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md`, `docs/M8_BACKUP_RECUPERO.md`.
- Piano: `docs/PIANO_MATURITA_PROFESSIONALE.md` (M7, M8).
- Rilievi: `docs/AUDIT_PROGETTO_FASE2_STATICO.md` (F2-P0-07, F2-P1-01, F2-P1-03, F2-P1-04).
- Incidenti: `docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`.
- Contratti allegati e condivisione: `docs/DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md`.
- Codice citato: `functions/index.js`, `functions/archive-purge-service.js`, `functions/archive-purge-receipt.js`, `functions/archive-purge-reference-plan.js`, `functions/history-recovery-service.js`, `functions/backup-restore-service.js`, `functions/backup-restore-receipt.js`, `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `Frontend/public/assets/js/modules/settings/**`, `Frontend/public/assets/js/modules/privato/**`, `Frontend/public/assets/js/modules/azienda/**`, `Frontend/public/assets/js/modules/scadenze/**`, `Frontend/public/assets/js/offline-sync.js`, `Frontend/public/assets/js/firebase-config.js`.

## Inventario dei file generato

<!-- generated:files:start -->
### Inventario completo dei file

> Generato da `npm run audit:inventory`. Ogni file sorgente viene letto integralmente per calcolare metadati e hash. I file in `node_modules` e questo rapporto generato sono esclusi dal conteggio.

File censiti: **850**. Duplicati byte-per-byte: **1 gruppi**.

#### .firebaserc

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `.firebaserc` | CONFIG | 65 | 6 | Associa Firebase CLI al progetto appcodici-password. |

#### .github

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `.github/copilot-instructions.md` | MD | 1611 | 12 | Documentazione: copilot-instructions. |
| `.github/workflows/docs.yml` | YML | 1286 | 38 | File di progetto: docs. |
| `.github/workflows/firebase-deploy.yml` | YML | 1884 | 74 | File di progetto: firebase-deploy. |

#### .gitignore

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `.gitignore` | CONFIG | 1720 | 89 | Esclusioni Git per file generati o locali. |

#### .vscode

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `.vscode/launch.json` | JSON | 286 | 13 | File di progetto: launch. |
| `.vscode/settings.json` | JSON | 42 | 3 | File di progetto: settings. |

#### Frontend

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `Frontend/public/account_azienda.html` | HTML | 3971 | 83 | Struttura della pagina account azienda; comportamento demandato ai moduli. |
| `Frontend/public/account_privati.html` | HTML | 3920 | 83 | Struttura della pagina account privati; comportamento demandato ai moduli. |
| `Frontend/public/aggiungi_scadenza.html` | HTML | 20708 | 350 | Struttura della pagina aggiungi scadenza; comportamento demandato ai moduli. |
| `Frontend/public/archivio_account.html` | HTML | 5947 | 119 | Struttura della pagina archivio account; comportamento demandato ai moduli. |
| `Frontend/public/area_privata.html` | HTML | 6395 | 135 | Struttura della pagina area privata; comportamento demandato ai moduli. |
| `Frontend/public/assets/css/accesso.css` | CSS | 12303 | 551 | Stili della sezione accesso. |
| `Frontend/public/assets/css/account_azienda.css` | CSS | 10090 | 464 | Stili della sezione account azienda. |
| `Frontend/public/assets/css/account_detail.css` | CSS | 10850 | 506 | Stili della sezione account detail. |
| `Frontend/public/assets/css/account_form.css` | CSS | 19589 | 929 | Stili della sezione account form. |
| `Frontend/public/assets/css/account_privati.css` | CSS | 9392 | 431 | Stili della sezione account privati. |
| `Frontend/public/assets/css/aggiungi_scadenza.css` | CSS | 18863 | 801 | Stili della sezione aggiungi scadenza. |
| `Frontend/public/assets/css/archivio_account.css` | CSS | 6237 | 270 | Stili della sezione archivio account. |
| `Frontend/public/assets/css/area_privata.css` | CSS | 12830 | 559 | Stili della sezione area privata. |
| `Frontend/public/assets/css/azienda_shared.css` | CSS | 378 | 21 | Stili della sezione azienda shared. |
| `Frontend/public/assets/css/configurazione_automezzi.css` | CSS | 7820 | 363 | Stili della sezione configurazione automezzi. |
| `Frontend/public/assets/css/configurazione_documenti.css` | CSS | 7935 | 368 | Stili della sezione configurazione documenti. |
| `Frontend/public/assets/css/configurazione_generali.css` | CSS | 7581 | 352 | Stili della sezione configurazione generali. |
| `Frontend/public/assets/css/contact-card-receiver.css` | CSS | 1514 | 26 | Stili della sezione contact-card-receiver. |
| `Frontend/public/assets/css/core.css` | CSS | 10815 | 437 | Stili della base e dei token globali. |
| `Frontend/public/assets/css/core_fascie.css` | CSS | 9062 | 346 | Stili della sezione core fascie. |
| `Frontend/public/assets/css/core_fonts.css` | CSS | 4599 | 136 | Stili della sezione core fonts. |
| `Frontend/public/assets/css/core_pagine.css` | CSS | 5563 | 242 | Stili della sezione core pagine. |
| `Frontend/public/assets/css/core_ui.css` | CSS | 26776 | 1122 | Stili della sezione core ui. |
| `Frontend/public/assets/css/datepicker_v5.css` | CSS | 4846 | 218 | Stili della sezione datepicker v5. |
| `Frontend/public/assets/css/dati_azienda.css` | CSS | 24636 | 863 | Stili della sezione dati azienda. |
| `Frontend/public/assets/css/dettaglio_account_azienda.css` | CSS | 5897 | 257 | Stili della sezione dettaglio account azienda. |
| `Frontend/public/assets/css/dettaglio_account_privato.css` | CSS | 12593 | 568 | Stili della sezione dettaglio account privato. |
| `Frontend/public/assets/css/dettaglio_scadenza.css` | CSS | 7398 | 349 | Stili della sezione dettaglio scadenza. |
| `Frontend/public/assets/css/form_azienda.css` | CSS | 17901 | 912 | Stili della sezione form azienda. |
| `Frontend/public/assets/css/gestione_destinatari.css` | CSS | 3183 | 155 | Stili della sezione gestione destinatari. |
| `Frontend/public/assets/css/home_page.css` | CSS | 10240 | 422 | Stili della sezione home page. |
| `Frontend/public/assets/css/impostazioni.css` | CSS | 29869 | 1344 | Stili della sezione impostazioni. |
| `Frontend/public/assets/css/lista_aziende.css` | CSS | 5553 | 260 | Stili della sezione lista aziende. |
| `Frontend/public/assets/css/moduli.css` | CSS | 12716 | 481 | Stili della sezione moduli. |
| `Frontend/public/assets/css/privacy.css` | CSS | 5178 | 242 | Stili della sezione privacy. |
| `Frontend/public/assets/css/profile-contacts.css` | CSS | 2288 | 45 | Stili della sezione profile-contacts. |
| `Frontend/public/assets/css/profile-layout.css` | CSS | 4217 | 76 | Stili della sezione profile-layout. |
| `Frontend/public/assets/css/profilo_privato.css` | CSS | 29161 | 1217 | Stili della sezione profilo privato. |
| `Frontend/public/assets/css/prova.css` | CSS | 2084 | 112 | Stili della sezione prova. |
| `Frontend/public/assets/css/registrati.css` | CSS | 533 | 19 | Stili della sezione registrati. |
| `Frontend/public/assets/css/regole_scadenze.css` | CSS | 3256 | 148 | Stili della sezione regole scadenze. |
| `Frontend/public/assets/css/scadenze.css` | CSS | 9473 | 386 | Stili della sezione scadenze. |
| `Frontend/public/assets/css/vault-assistant.css` | CSS | 9119 | 131 | Stili della sezione vault-assistant. |
| `Frontend/public/assets/fonts/manrope/manrope-11.woff2` | FONT | 24836 | — | Font locale manrope-11.woff2. |
| `Frontend/public/assets/fonts/material-symbols/material-symbols-0.woff2` | FONT | 3846876 | — | Font locale material-symbols-0.woff2. |
| `Frontend/public/assets/images/app-icon-192.png` | PNG | 32104 | — | Asset immagine app-icon-192.png. |
| `Frontend/public/assets/images/app-icon-512.png` | PNG | 220302 | — | Asset immagine app-icon-512.png. |
| `Frontend/public/assets/images/app-icon-maskable-512.png` | PNG | 278177 | — | Asset immagine app-icon-maskable-512.png. |
| `Frontend/public/assets/images/app-icon.jpg` | JPG | 325279 | — | Asset immagine app-icon.jpg. |
| `Frontend/public/assets/images/apple-touch-icon-180.png` | PNG | 28202 | — | Asset immagine apple-touch-icon-180.png. |
| `Frontend/public/assets/images/google-avatar.png` | PNG | 1014 | — | Asset immagine google-avatar.png. |
| `Frontend/public/assets/images/user-avatar-5.png` | PNG | 340072 | — | Asset immagine user-avatar-5.png. |
| `Frontend/public/assets/js/auth.js` | JS | 12471 | 311 | Registrazione, login, TOTP, logout e reset account Firebase Auth. |
| `Frontend/public/assets/js/cleanup.js` | JS | 8121 | 196 | Supporto frontend: cleanup. |
| `Frontend/public/assets/js/components-v129.js` | JS | 19440 | 375 | Header, footer e navigazione condivisa. |
| `Frontend/public/assets/js/contact-card-receiver.js` | JS | 2251 | 47 | Supporto frontend: contact-card-receiver. |
| `Frontend/public/assets/js/datepicker_v5.js` | JS | 8872 | 241 | Supporto frontend: datepicker v5. |
| `Frontend/public/assets/js/dom-utils.js` | JS | 4694 | 124 | Creazione DOM sicura e protezione da inserimenti HTML arbitrari. |
| `Frontend/public/assets/js/env-v126.js` | JS | 257 | 8 | Supporto frontend: env-v126. |
| `Frontend/public/assets/js/firebase-config.js` | JS | 3033 | 76 | Singleton Firebase e cache Firestore persistente multi-tab. |
| `Frontend/public/assets/js/footer-state.js` | JS | 571 | 19 | Supporto frontend: footer-state. |
| `Frontend/public/assets/js/home-bootstrap.js` | JS | 725 | 20 | Supporto frontend: home-bootstrap. |
| `Frontend/public/assets/js/inactivity-timer.js` | JS | 4629 | 140 | Blocco Vault dopo inattività secondo la preferenza utente. |
| `Frontend/public/assets/js/logger.js` | JS | 663 | 18 | Supporto frontend: logger. |
| `Frontend/public/assets/js/login-entry.js` | JS | 950 | 24 | Bootstrap minimo della pagina di accesso. |
| `Frontend/public/assets/js/logout-session.js` | JS | 992 | 22 | Supporto frontend: logout-session. |
| `Frontend/public/assets/js/main-v129.js` | JS | 33219 | 605 | Bootstrap autenticato globale, router, inviti e notifiche. |
| `Frontend/public/assets/js/modules/assistant/assistant-controller.js` | JS | 3444 | 77 | Modulo dell’assistente Vault: assistant-controller. |
| `Frontend/public/assets/js/modules/assistant/assistant-ui.js` | JS | 12297 | 179 | Modulo dell’assistente Vault: assistant-ui. |
| `Frontend/public/assets/js/modules/assistant/conversation-engine.js` | JS | 5734 | 120 | Modulo dell’assistente Vault: conversation-engine. |
| `Frontend/public/assets/js/modules/assistant/package.json` | JSON | 19 | 2 | Modulo dell’assistente Vault: package. |
| `Frontend/public/assets/js/modules/assistant/search-normalizer.js` | JS | 211 | 5 | Modulo dell’assistente Vault: search-normalizer. |
| `Frontend/public/assets/js/modules/assistant/vault-data-loader.js` | JS | 4816 | 75 | Modulo dell’assistente Vault: vault-data-loader. |
| `Frontend/public/assets/js/modules/auth/imposta_nuova_password.js` | JS | 8748 | 231 | Flusso autenticazione: imposta nuova password. |
| `Frontend/public/assets/js/modules/auth/login.js` | JS | 14122 | 340 | Flusso autenticazione: login. |
| `Frontend/public/assets/js/modules/auth/registrati.js` | JS | 7113 | 202 | Flusso autenticazione: registrati. |
| `Frontend/public/assets/js/modules/auth/reset_password.js` | JS | 4396 | 134 | Flusso autenticazione: reset password. |
| `Frontend/public/assets/js/modules/azienda/account_azienda.js` | JS | 13670 | 310 | Flusso aziende/account aziendali: account azienda. |
| `Frontend/public/assets/js/modules/azienda/company-list-service.js` | JS | 423 | 11 | Flusso aziende/account aziendali: company-list-service. |
| `Frontend/public/assets/js/modules/azienda/company-profile-link.js` | JS | 2761 | 25 | Flusso aziende/account aziendali: company-profile-link. |
| `Frontend/public/assets/js/modules/azienda/company-profile-model.js` | JS | 2642 | 37 | Flusso aziende/account aziendali: company-profile-model. |
| `Frontend/public/assets/js/modules/azienda/company-profile-ui.js` | JS | 16964 | 175 | Flusso aziende/account aziendali: company-profile-ui. |
| `Frontend/public/assets/js/modules/azienda/company-vcard.js` | JS | 4660 | 111 | Flusso aziende/account aziendali: company-vcard. |
| `Frontend/public/assets/js/modules/azienda/dati-azienda-attachments.js` | JS | 2522 | 51 | Flusso aziende/account aziendali: dati-azienda-attachments. |
| `Frontend/public/assets/js/modules/azienda/dati_azienda.js` | JS | 15989 | 372 | Flusso aziende/account aziendali: dati azienda. |
| `Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js` | JS | 10243 | 255 | Flusso aziende/account aziendali: dettaglio-azienda-attachments. |
| `Frontend/public/assets/js/modules/azienda/dettaglio-azienda-sharing.js` | JS | 13358 | 283 | Flusso aziende/account aziendali: dettaglio-azienda-sharing. |
| `Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js` | JS | 25560 | 539 | Flusso aziende/account aziendali: dettaglio account azienda. |
| `Frontend/public/assets/js/modules/azienda/form-azienda-save.js` | JS | 21664 | 372 | Flusso aziende/account aziendali: form-azienda-save. |
| `Frontend/public/assets/js/modules/azienda/form_account_azienda.js` | JS | 31580 | 677 | Flusso aziende/account aziendali: form account azienda. |
| `Frontend/public/assets/js/modules/azienda/lista_aziende.js` | JS | 10138 | 266 | Flusso aziende/account aziendali: lista aziende. |
| `Frontend/public/assets/js/modules/azienda/ma_attachments.js` | JS | 2731 | 70 | Flusso aziende/account aziendali: ma attachments. |
| `Frontend/public/assets/js/modules/azienda/ma_cards.js` | JS | 16116 | 330 | Flusso aziende/account aziendali: ma cards. |
| `Frontend/public/assets/js/modules/azienda/ma_save.js` | JS | 13794 | 226 | Flusso aziende/account aziendali: ma save. |
| `Frontend/public/assets/js/modules/azienda/ma_state.js` | JS | 460 | 17 | Flusso aziende/account aziendali: ma state. |
| `Frontend/public/assets/js/modules/azienda/ma_ui.js` | JS | 8616 | 195 | Flusso aziende/account aziendali: ma ui. |
| `Frontend/public/assets/js/modules/azienda/modifica_azienda.js` | JS | 4488 | 105 | Flusso aziende/account aziendali: modifica azienda. |
| `Frontend/public/assets/js/modules/core/crypto-utils.js` | JS | 12441 | 332 | Primitive KDF, AES-GCM, verifier e codifiche crittografiche. |
| `Frontend/public/assets/js/modules/core/mfa-manager.js` | JS | 4798 | 108 | Enroll, rimozione, recupero e revoca sessioni TOTP. |
| `Frontend/public/assets/js/modules/core/password-policy.js` | JS | 3229 | 76 | Supporto frontend: password-policy. |
| `Frontend/public/assets/js/modules/core/security-manager.js` | JS | 25138 | 607 | Orchestrazione Master Password, envelope Vault e sblocco biometrico. |
| `Frontend/public/assets/js/modules/core/sharing-identity.js` | JS | 4101 | 78 | Supporto frontend: sharing-identity. |
| `Frontend/public/assets/js/modules/core/vault-session.js` | JS | 4303 | 101 | Sessione Vault cifrata e limitata alla scheda/browser session. |
| `Frontend/public/assets/js/modules/core/webauthn-manager.js` | JS | 7326 | 237 | Registrazione e uso WebAuthn/PRF della credenziale locale. |
| `Frontend/public/assets/js/modules/data/account-widget-client.js` | JS | 2964 | 74 | Supporto frontend: account-widget-client. |
| `Frontend/public/assets/js/modules/data/offline-mutation-client-core.js` | JS | 7609 | 139 | Supporto frontend: offline-mutation-client-core. |
| `Frontend/public/assets/js/modules/data/offline-mutation-client.js` | JS | 1660 | 27 | Supporto frontend: offline-mutation-client. |
| `Frontend/public/assets/js/modules/data/offline-mutation-lease.js` | JS | 23360 | 409 | Supporto frontend: offline-mutation-lease. |
| `Frontend/public/assets/js/modules/data/offline-mutation-queue.js` | JS | 23498 | 426 | Supporto frontend: offline-mutation-queue. |
| `Frontend/public/assets/js/modules/data/offline-mutation-sync.js` | JS | 7867 | 137 | Supporto frontend: offline-mutation-sync. |
| `Frontend/public/assets/js/modules/data/offline-mutation-upgrade.js` | JS | 8561 | 148 | Supporto frontend: offline-mutation-upgrade. |
| `Frontend/public/assets/js/modules/data/private-account-offline-pilot.js` | JS | 5531 | 139 | Supporto frontend: private-account-offline-pilot. |
| `Frontend/public/assets/js/modules/data/private-account-pilot-queue.js` | JS | 1752 | 28 | Supporto frontend: private-account-pilot-queue. |
| `Frontend/public/assets/js/modules/data/request-coordinator.js` | JS | 687 | 16 | Supporto frontend: request-coordinator. |
| `Frontend/public/assets/js/modules/data/shared-record-reader.js` | JS | 2733 | 70 | Supporto frontend: shared-record-reader. |
| `Frontend/public/assets/js/modules/data/shared-vault-data-client.js` | JS | 3256 | 70 | Supporto frontend: shared-vault-data-client. |
| `Frontend/public/assets/js/modules/data/shared-vault-data-model.js` | JS | 4690 | 104 | Supporto frontend: shared-vault-data-model. |
| `Frontend/public/assets/js/modules/data/vault-repository.js` | JS | 11709 | 199 | Supporto frontend: vault-repository. |
| `Frontend/public/assets/js/modules/home/home-deadline-dashboard.js` | JS | 2748 | 67 | Supporto frontend: home-deadline-dashboard. |
| `Frontend/public/assets/js/modules/home/home-deadline-inbox.js` | JS | 3459 | 71 | Supporto frontend: home-deadline-inbox. |
| `Frontend/public/assets/js/modules/home/home-presentation.js` | JS | 3669 | 88 | Supporto frontend: home-presentation. |
| `Frontend/public/assets/js/modules/home/home.js` | JS | 14430 | 355 | Supporto frontend: home. |
| `Frontend/public/assets/js/modules/privato/account_privati.js` | JS | 21409 | 456 | Flusso profilo/account personali: account privati. |
| `Frontend/public/assets/js/modules/privato/area_privata.js` | JS | 21560 | 514 | Flusso profilo/account personali: area privata. |
| `Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js` | JS | 11901 | 282 | Flusso profilo/account personali: dettaglio-privato-attachments. |
| `Frontend/public/assets/js/modules/privato/dettaglio-privato-sharing.js` | JS | 7993 | 163 | Flusso profilo/account personali: dettaglio-privato-sharing. |
| `Frontend/public/assets/js/modules/privato/dettaglio_account_privato.js` | JS | 25390 | 532 | Flusso profilo/account personali: dettaglio account privato. |
| `Frontend/public/assets/js/modules/privato/form-privato-save.js` | JS | 24707 | 430 | Flusso profilo/account personali: form-privato-save. |
| `Frontend/public/assets/js/modules/privato/form_account_privato.js` | JS | 38740 | 805 | Flusso profilo/account personali: form account privato. |
| `Frontend/public/assets/js/modules/privato/private-account-offline-policy.js` | JS | 1719 | 31 | Flusso profilo/account personali: private-account-offline-policy. |
| `Frontend/public/assets/js/modules/privato/profile-model.js` | JS | 10767 | 221 | Flusso profilo/account personali: profile-model. |
| `Frontend/public/assets/js/modules/privato/profilo-actions.js` | JS | 12091 | 242 | Flusso profilo/account personali: profilo-actions. |
| `Frontend/public/assets/js/modules/privato/profilo-addresses-docs.js` | JS | 18827 | 296 | Flusso profilo/account personali: profilo-addresses-docs. |
| `Frontend/public/assets/js/modules/privato/profilo-dashboard.js` | JS | 9971 | 167 | Flusso profilo/account personali: profilo-dashboard. |
| `Frontend/public/assets/js/modules/privato/profilo-links.js` | JS | 8514 | 143 | Flusso profilo/account personali: profilo-links. |
| `Frontend/public/assets/js/modules/privato/profilo-modal.js` | JS | 20243 | 375 | Flusso profilo/account personali: profilo-modal. |
| `Frontend/public/assets/js/modules/privato/profilo-phones-emails.js` | JS | 21177 | 403 | Flusso profilo/account personali: profilo-phones-emails. |
| `Frontend/public/assets/js/modules/privato/profilo-qr.js` | JS | 6005 | 136 | Flusso profilo/account personali: profilo-qr. |
| `Frontend/public/assets/js/modules/privato/profilo-sync.js` | JS | 4991 | 113 | Flusso profilo/account personali: profilo-sync. |
| `Frontend/public/assets/js/modules/privato/profilo-ui.js` | JS | 11228 | 238 | Flusso profilo/account personali: profilo-ui. |
| `Frontend/public/assets/js/modules/privato/profilo-widgets.js` | JS | 15215 | 293 | Flusso profilo/account personali: profilo-widgets. |
| `Frontend/public/assets/js/modules/privato/profilo_privato.js` | JS | 26249 | 526 | Flusso profilo/account personali: profilo privato. |
| `Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js` | JS | 26079 | 621 | Flusso scadenze/configurazione: aggiungi scadenza. |
| `Frontend/public/assets/js/modules/scadenze/configurazione_automezzi.js` | JS | 13134 | 276 | Flusso scadenze/configurazione: configurazione automezzi. |
| `Frontend/public/assets/js/modules/scadenze/configurazione_documenti.js` | JS | 12571 | 265 | Flusso scadenze/configurazione: configurazione documenti. |
| `Frontend/public/assets/js/modules/scadenze/configurazione_generali.js` | JS | 14338 | 333 | Flusso scadenze/configurazione: configurazione generali. |
| `Frontend/public/assets/js/modules/scadenze/deadline-attachment-controller.js` | JS | 4260 | 90 | Flusso scadenze/configurazione: deadline-attachment-controller. |
| `Frontend/public/assets/js/modules/scadenze/deadline-config-controller.js` | JS | 17567 | 379 | Flusso scadenze/configurazione: deadline-config-controller. |
| `Frontend/public/assets/js/modules/scadenze/deadline-config-model.js` | JS | 2572 | 64 | Flusso scadenze/configurazione: deadline-config-model. |
| `Frontend/public/assets/js/modules/scadenze/deadline-model.js` | JS | 3145 | 70 | Flusso scadenze/configurazione: deadline-model. |
| `Frontend/public/assets/js/modules/scadenze/deadline-recipient-controller.js` | JS | 6176 | 105 | Flusso scadenze/configurazione: deadline-recipient-controller. |
| `Frontend/public/assets/js/modules/scadenze/deadline-recipient-model.js` | JS | 2875 | 66 | Flusso scadenze/configurazione: deadline-recipient-model. |
| `Frontend/public/assets/js/modules/scadenze/deadline-save-service.js` | JS | 6847 | 180 | Flusso scadenze/configurazione: deadline-save-service. |
| `Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js` | JS | 24550 | 506 | Flusso scadenze/configurazione: dettaglio scadenza. |
| `Frontend/public/assets/js/modules/scadenze/scadenze.js` | JS | 15003 | 399 | Flusso scadenze/configurazione: scadenze. |
| `Frontend/public/assets/js/modules/settings/account-field-usage-model.js` | JS | 6787 | 110 | Impostazioni applicative: account-field-usage-model. |
| `Frontend/public/assets/js/modules/settings/account-field-usage-service.js` | JS | 8154 | 181 | Impostazioni applicative: account-field-usage-service. |
| `Frontend/public/assets/js/modules/settings/archive-account-model.js` | JS | 2602 | 55 | Impostazioni applicative: archive-account-model. |
| `Frontend/public/assets/js/modules/settings/archive-account-service.js` | JS | 22355 | 449 | Impostazioni applicative: archive-account-service. |
| `Frontend/public/assets/js/modules/settings/archivio_account.js` | JS | 21179 | 474 | Impostazioni applicative: archivio account. |
| `Frontend/public/assets/js/modules/settings/backup-crypto.js` | JS | 5314 | 125 | Impostazioni applicative: backup-crypto. |
| `Frontend/public/assets/js/modules/settings/backup-export-buffer.js` | JS | 2570 | 50 | Impostazioni applicative: backup-export-buffer. |
| `Frontend/public/assets/js/modules/settings/backup-export-model.js` | JS | 4479 | 93 | Impostazioni applicative: backup-export-model. |
| `Frontend/public/assets/js/modules/settings/backup-export-service.js` | JS | 9517 | 203 | Impostazioni applicative: backup-export-service. |
| `Frontend/public/assets/js/modules/settings/backup-import-model.js` | JS | 8223 | 160 | Impostazioni applicative: backup-import-model. |
| `Frontend/public/assets/js/modules/settings/backup-import-service.js` | JS | 23565 | 478 | Impostazioni applicative: backup-import-service. |
| `Frontend/public/assets/js/modules/settings/credential-health-model.js` | JS | 2829 | 73 | Impostazioni applicative: credential-health-model. |
| `Frontend/public/assets/js/modules/settings/credential-health-service.js` | JS | 6295 | 155 | Impostazioni applicative: credential-health-service. |
| `Frontend/public/assets/js/modules/settings/impostazioni.js` | JS | 65739 | 1291 | Impostazioni applicative: impostazioni. |
| `Frontend/public/assets/js/modules/settings/push-settings-controller.js` | JS | 3468 | 93 | Impostazioni applicative: push-settings-controller. |
| `Frontend/public/assets/js/modules/settings/shared-credentials-controller.js` | JS | 17243 | 320 | Impostazioni applicative: shared-credentials-controller. |
| `Frontend/public/assets/js/modules/shared/account-banking-view.js` | JS | 7645 | 159 | Supporto frontend: account-banking-view. |
| `Frontend/public/assets/js/modules/shared/account-embedded-widgets.js` | JS | 28014 | 540 | Supporto frontend: account-embedded-widgets. |
| `Frontend/public/assets/js/modules/shared/account-list-view.js` | JS | 9430 | 190 | Supporto frontend: account-list-view. |
| `Frontend/public/assets/js/modules/shared/account-mode-model.js` | JS | 1828 | 40 | Supporto frontend: account-mode-model. |
| `Frontend/public/assets/js/modules/shared/account-note-editor.js` | JS | 8907 | 142 | Supporto frontend: account-note-editor. |
| `Frontend/public/assets/js/modules/shared/account-shared-credentials.js` | JS | 16481 | 296 | Supporto frontend: account-shared-credentials. |
| `Frontend/public/assets/js/modules/shared/account-widget-lifecycle.js` | JS | 4757 | 92 | Supporto frontend: account-widget-lifecycle. |
| `Frontend/public/assets/js/modules/shared/attachment-security.js` | JS | 5917 | 139 | Validazione e cifratura degli allegati prima di Storage. |
| `Frontend/public/assets/js/modules/shared/banking-model.js` | JS | 3817 | 103 | Supporto frontend: banking-model. |
| `Frontend/public/assets/js/modules/shared/banking-renderer.js` | JS | 11799 | 219 | Renderer condiviso per conti bancari e carte. |
| `Frontend/public/assets/js/modules/shared/card-secret.js` | JS | 706 | 17 | Supporto frontend: card-secret. |
| `Frontend/public/assets/js/modules/shared/company-area-preference.js` | JS | 840 | 24 | Supporto frontend: company-area-preference. |
| `Frontend/public/assets/js/modules/shared/contact-card-model.js` | JS | 4264 | 71 | Supporto frontend: contact-card-model. |
| `Frontend/public/assets/js/modules/shared/contact-card-photo.js` | JS | 1669 | 34 | Supporto frontend: contact-card-photo. |
| `Frontend/public/assets/js/modules/shared/detail-account-mode.js` | JS | 12039 | 209 | Supporto frontend: detail-account-mode. |
| `Frontend/public/assets/js/modules/shared/gestione-destinatari.js` | JS | 7483 | 138 | Supporto frontend: gestione-destinatari. |
| `Frontend/public/assets/js/modules/shared/profile-account-management.js` | JS | 7010 | 87 | Supporto frontend: profile-account-management. |
| `Frontend/public/assets/js/modules/shared/push-manager.js` | JS | 12189 | 255 | Registrazione dispositivo FCM e preferenze push per ambito. |
| `Frontend/public/assets/js/modules/shared/qr_code_utils-v2.js` | JS | 7707 | 155 | Supporto frontend: qr code utils-v2. |
| `Frontend/public/assets/js/modules/shared/qr_code_utils.js` | JS | 5450 | 124 | Caricamento QR e generazione vCard. |
| `Frontend/public/assets/js/modules/shared/read-error-message.js` | JS | 518 | 9 | Supporto frontend: read-error-message. |
| `Frontend/public/assets/js/modules/shared/ui-state-view.js` | JS | 1334 | 45 | Supporto frontend: ui-state-view. |
| `Frontend/public/assets/js/offline-firestore.js` | JS | 2035 | 58 | Supporto frontend: offline-firestore. |
| `Frontend/public/assets/js/offline-status.js` | JS | 813 | 23 | Supporto frontend: offline-status. |
| `Frontend/public/assets/js/offline-sync.js` | JS | 5030 | 132 | Supporto frontend: offline-sync. |
| `Frontend/public/assets/js/pages-init.js` | JS | 5697 | 152 | Router con import dinamici dei moduli pagina. |
| `Frontend/public/assets/js/performance-metrics.js` | JS | 4160 | 111 | Supporto frontend: performance-metrics. |
| `Frontend/public/assets/js/private-auth-gate.js` | JS | 2070 | 44 | Supporto frontend: private-auth-gate. |
| `Frontend/public/assets/js/prova.js` | JS | 958 | 23 | Supporto frontend: prova. |
| `Frontend/public/assets/js/push-messaging-client.js` | JS | 1160 | 35 | Supporto frontend: push-messaging-client. |
| `Frontend/public/assets/js/swipe-list-v6.js` | JS | 8791 | 251 | Supporto frontend: swipe-list-v6. |
| `Frontend/public/assets/js/theme-init.js` | JS | 2176 | 54 | Applica il tema prima del rendering per evitare lampeggiamenti. |
| `Frontend/public/assets/js/translations.js` | JS | 24915 | 452 | Dizionario italiano e caricamento differito delle altre lingue. |
| `Frontend/public/assets/js/translations/de.js` | JS | 5975 | 123 | Dizionario differito per la lingua de. |
| `Frontend/public/assets/js/translations/en.js` | JS | 17012 | 313 | Dizionario differito per la lingua en. |
| `Frontend/public/assets/js/translations/es.js` | JS | 6970 | 141 | Dizionario differito per la lingua es. |
| `Frontend/public/assets/js/translations/fr.js` | JS | 6132 | 123 | Dizionario differito per la lingua fr. |
| `Frontend/public/assets/js/translations/hi.js` | JS | 8868 | 122 | Dizionario differito per la lingua hi. |
| `Frontend/public/assets/js/translations/pt.js` | JS | 5815 | 122 | Dizionario differito per la lingua pt. |
| `Frontend/public/assets/js/translations/zh.js` | JS | 5393 | 122 | Dizionario differito per la lingua zh. |
| `Frontend/public/assets/js/ui-components.js` | JS | 4122 | 101 | Supporto frontend: ui-components. |
| `Frontend/public/assets/js/ui-core-v129.js` | JS | 19841 | 457 | Toast, modali, input protetti e componenti UI globali. |
| `Frontend/public/assets/js/utils.js` | JS | 2697 | 78 | Supporto frontend: utils. |
| `Frontend/public/assets/js/vendor/firebase-runtime.js` | JS | 724606 | 70 | Supporto frontend: firebase-runtime. |
| `Frontend/public/assets/js/vendor/firebase-sw-runtime.js` | JS | 80549 | 8 | Supporto frontend: firebase-sw-runtime. |
| `Frontend/public/assets/js/vendor/qrcode.min.js` | JS | 19927 | 1 | Supporto frontend: qrcode.min. |
| `Frontend/public/configurazione_automezzi.html` | HTML | 8376 | 160 | Struttura della pagina configurazione automezzi; comportamento demandato ai moduli. |
| `Frontend/public/configurazione_documenti.html` | HTML | 8387 | 160 | Struttura della pagina configurazione documenti; comportamento demandato ai moduli. |
| `Frontend/public/configurazione_generali.html` | HTML | 6753 | 134 | Struttura della pagina configurazione generali; comportamento demandato ai moduli. |
| `Frontend/public/contatto_condiviso.html` | HTML | 1508 | 29 | Struttura della pagina contatto condiviso; comportamento demandato ai moduli. |
| `Frontend/public/dati_azienda.html` | HTML | 20574 | 321 | Struttura della pagina dati azienda; comportamento demandato ai moduli. |
| `Frontend/public/dettaglio_account_azienda.html` | HTML | 27950 | 418 | Struttura della pagina dettaglio account azienda; comportamento demandato ai moduli. |
| `Frontend/public/dettaglio_account_privato.html` | HTML | 24940 | 383 | Struttura della pagina dettaglio account privato; comportamento demandato ai moduli. |
| `Frontend/public/dettaglio_scadenza.html` | HTML | 8979 | 177 | Struttura della pagina dettaglio scadenza; comportamento demandato ai moduli. |
| `Frontend/public/firebase-messaging-sw.js` | JS | 2874 | 60 | File di progetto: firebase-messaging-sw. |
| `Frontend/public/form_account_azienda.html` | HTML | 21156 | 322 | Struttura della pagina form account azienda; comportamento demandato ai moduli. |
| `Frontend/public/form_account_privato.html` | HTML | 19453 | 302 | Struttura della pagina form account privato; comportamento demandato ai moduli. |
| `Frontend/public/gestione_destinatari.html` | HTML | 4731 | 74 | Struttura della pagina gestione destinatari; comportamento demandato ai moduli. |
| `Frontend/public/home_page.html` | HTML | 5998 | 134 | Struttura della pagina home page; comportamento demandato ai moduli. |
| `Frontend/public/imposta_nuova_password.html` | HTML | 6128 | 132 | Struttura della pagina imposta nuova password; comportamento demandato ai moduli. |
| `Frontend/public/impostazioni.html` | HTML | 31106 | 523 | Struttura della pagina impostazioni; comportamento demandato ai moduli. |
| `Frontend/public/index.html` | HTML | 801 | 19 | Struttura della pagina index; comportamento demandato ai moduli. |
| `Frontend/public/lista_aziende.html` | HTML | 2982 | 66 | Struttura della pagina lista aziende; comportamento demandato ai moduli. |
| `Frontend/public/login-v115.html` | HTML | 8139 | 166 | Struttura della pagina login-v115; comportamento demandato ai moduli. |
| `Frontend/public/manifest.json` | JSON | 909 | 33 | Manifest PWA, icone, nome, scope e pagina iniziale. |
| `Frontend/public/modifica_azienda.html` | HTML | 67093 | 823 | Struttura della pagina modifica azienda; comportamento demandato ai moduli. |
| `Frontend/public/offline-assets.js` | JS | 10475 | 246 | File di progetto: offline-assets. |
| `Frontend/public/privacy.html` | HTML | 13808 | 262 | Struttura della pagina privacy; comportamento demandato ai moduli. |
| `Frontend/public/profilo_privato.html` | HTML | 15687 | 260 | Struttura della pagina profilo privato; comportamento demandato ai moduli. |
| `Frontend/public/prova.html` | HTML | 1396 | 31 | Struttura della pagina prova; comportamento demandato ai moduli. |
| `Frontend/public/registrati.html` | HTML | 7420 | 148 | Struttura della pagina registrati; comportamento demandato ai moduli. |
| `Frontend/public/regole_scadenze.html` | HTML | 7016 | 134 | Struttura della pagina regole scadenze; comportamento demandato ai moduli. |
| `Frontend/public/reset_password.html` | HTML | 4141 | 107 | Struttura della pagina reset password; comportamento demandato ai moduli. |
| `Frontend/public/scadenze.html` | HTML | 5569 | 109 | Struttura della pagina scadenze; comportamento demandato ai moduli. |
| `Frontend/public/sw.js` | JS | 3932 | 95 | Service worker: shell offline, cache runtime, push in background e deep link. |
| `Frontend/public/termini.html` | HTML | 11553 | 226 | Struttura della pagina termini; comportamento demandato ai moduli. |

#### archive

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `archive/home-experiments/home-confronto.js` | JS | 59 | 2 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |
| `archive/home-experiments/home-nebbia.js` | JS | 58 | 2 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |
| `archive/home-experiments/home-v126.html` | HTML | 548 | 14 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |
| `archive/home-experiments/home-v127.html` | HTML | 548 | 14 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |
| `archive/home-experiments/home-v128.html` | HTML | 553 | 14 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |
| `archive/home-experiments/home-v129.html` | HTML | 558 | 14 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |
| `archive/home-experiments/home_confronto.html` | HTML | 592 | 20 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |
| `archive/home-experiments/home_confronto_legacy.css` | CSS | 2717 | 87 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |
| `archive/home-experiments/home_nebbia.html` | HTML | 605 | 20 | Riferimento storico Home escluso dal runtime e dalla pubblicazione. |

#### docs

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `docs/LEGGIMI.md` | MD | 5076 | 69 | Documentazione: LEGGIMI. |
| `docs/domande/M10_RILASCIO.md` | MD | 8928 | 141 | Documentazione: M10 RILASCIO. |
| `docs/domande/M6_OFFLINE.md` | MD | 9440 | 148 | Documentazione: M6 OFFLINE. |
| `docs/domande/M7_CANCELLAZIONE.md` | MD | 32767 | 560 | Documentazione: M7 CANCELLAZIONE. |
| `docs/domande/M8_RECUPERO.md` | MD | 13281 | 218 | Documentazione: M8 RECUPERO. |
| `docs/evidenze/AUDIT.md` | MD | 250294 | 2817 | Documentazione: AUDIT. |
| `docs/evidenze/COLLAUDI.md` | MD | 17208 | 254 | Documentazione: COLLAUDI. |
| `docs/procedure/AMBIENTE_DI_TEST.md` | MD | 9052 | 91 | Documentazione: AMBIENTE DI TEST. |
| `docs/procedure/COLLAUDI.md` | MD | 16914 | 287 | Documentazione: COLLAUDI. |
| `docs/procedure/GESTIONE_INCIDENTI.md` | MD | 4577 | 80 | Documentazione: GESTIONE INCIDENTI. |
| `docs/progetto/DECISIONI.md` | MD | 37594 | 331 | Documentazione: DECISIONI. |
| `docs/progetto/INCARICO_CORRENTE.md` | MD | 1428 | 24 | Documentazione: INCARICO CORRENTE. |
| `docs/progetto/PROGRAMMA.md` | MD | 30569 | 602 | Documentazione: PROGRAMMA. |
| `docs/progetto/STATO.md` | MD | 25803 | 141 | Documentazione: STATO. |
| `docs/regole/BACKUP.md` | MD | 11302 | 89 | Documentazione: BACKUP. |
| `docs/regole/CANCELLAZIONE.md` | MD | 28854 | 247 | Documentazione: CANCELLAZIONE. |
| `docs/regole/CONDIVISIONE.md` | MD | 29528 | 424 | Documentazione: CONDIVISIONE. |
| `docs/regole/DATI.md` | MD | 26720 | 265 | Documentazione: DATI. |
| `docs/regole/INTERFACCIA.md` | MD | 40122 | 517 | Documentazione: INTERFACCIA. |
| `docs/regole/OFFLINE.md` | MD | 16952 | 194 | Documentazione: OFFLINE. |
| `docs/regole/RILASCIO.md` | MD | 13509 | 136 | Documentazione: RILASCIO. |
| `docs/regole/SALUTE_CREDENZIALI.md` | MD | 6227 | 75 | Documentazione: SALUTE CREDENZIALI. |
| `docs/regole/SICUREZZA.md` | MD | 27136 | 446 | Documentazione: SICUREZZA. |
| `docs/regole/VAULT.md` | MD | 15979 | 204 | Documentazione: VAULT. |
| `docs/storico/REGISTRO.md` | MD | 2275769 | 19820 | Documentazione: REGISTRO. |
| `docs/sviluppo/ALLEGATI_DOCUMENTI.md` | MD | 30674 | 193 | Documentazione: ALLEGATI DOCUMENTI. |
| `docs/sviluppo/ASSISTENTE_APP.md` | MD | 17419 | 272 | Documentazione: ASSISTENTE APP. |
| `docs/sviluppo/PROFILO_E_ACCOUNT.md` | MD | 44986 | 514 | Documentazione: PROFILO E ACCOUNT. |
| `docs/utente/GUIDA.md` | MD | 14990 | 188 | Documentazione: GUIDA. |

#### experiments

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `experiments/backup-recovery/backup-format.mjs` | MJS | 5714 | 85 | File di progetto: backup-format. |
| `experiments/backup-recovery/backup-format.test.mjs` | MJS | 3890 | 55 | File di progetto: backup-format.test. |
| `experiments/card-importer/card-parser.mjs` | MJS | 3041 | 81 | File di progetto: card-parser. |
| `experiments/card-importer/card-parser.test.mjs` | MJS | 1480 | 33 | File di progetto: card-parser.test. |
| `experiments/card-importer/prototype.css` | CSS | 1529 | 18 | File di progetto: prototype. |
| `experiments/card-importer/prototype.html` | HTML | 2168 | 48 | Struttura della pagina prototype; comportamento demandato ai moduli. |
| `experiments/card-importer/prototype.mjs` | MJS | 13822 | 312 | File di progetto: prototype. |
| `experiments/credential-health/credential-health.mjs` | MJS | 1968 | 46 | File di progetto: credential-health. |
| `experiments/credential-health/credential-health.test.mjs` | MJS | 1701 | 36 | File di progetto: credential-health.test. |
| `experiments/history-recovery/audit-retention.mjs` | MJS | 8719 | 157 | File di progetto: audit-retention. |
| `experiments/history-recovery/audit-retention.test.mjs` | MJS | 13778 | 222 | File di progetto: audit-retention.test. |
| `experiments/history-recovery/firestore.candidate.rules` | RULES | 644 | 20 | File di progetto: firestore.candidate. |
| `experiments/history-recovery/history-model.mjs` | MJS | 1618 | 28 | File di progetto: history-model. |
| `experiments/history-recovery/history-model.test.mjs` | MJS | 1597 | 24 | File di progetto: history-model.test. |
| `experiments/offline-sync/browser-backend-sync.mjs` | MJS | 26844 | 320 | File di progetto: browser-backend-sync. |
| `experiments/offline-sync/browser-coordination-worker.mjs` | MJS | 1857 | 30 | File di progetto: browser-coordination-worker. |
| `experiments/offline-sync/browser-coordination.mjs` | MJS | 18853 | 250 | File di progetto: browser-coordination. |
| `experiments/offline-sync/browser-mixed-contexts-worker.mjs` | MJS | 4849 | 77 | File di progetto: browser-mixed-contexts-worker. |
| `experiments/offline-sync/browser-mixed-contexts.mjs` | MJS | 15884 | 233 | File di progetto: browser-mixed-contexts. |
| `experiments/offline-sync/browser-mixed-current.mjs` | MJS | 18237 | 236 | File di progetto: browser-mixed-current. |
| `experiments/offline-sync/browser-mutation-lease.mjs` | MJS | 16787 | 226 | File di progetto: browser-mutation-lease. |
| `experiments/offline-sync/browser-no-locks.mjs` | MJS | 12909 | 195 | File di progetto: browser-no-locks. |
| `experiments/offline-sync/browser-pilot-lease-worker.mjs` | MJS | 23520 | 313 | File di progetto: browser-pilot-lease-worker. |
| `experiments/offline-sync/browser-pilot-lease.mjs` | MJS | 16946 | 228 | File di progetto: browser-pilot-lease. |
| `experiments/offline-sync/browser-queue-upgrade.mjs` | MJS | 21771 | 287 | File di progetto: browser-queue-upgrade. |
| `experiments/offline-sync/browser-rollback-v2.mjs` | MJS | 9578 | 121 | File di progetto: browser-rollback-v2. |
| `experiments/offline-sync/browser-runtime-lease.mjs` | MJS | 21951 | 328 | File di progetto: browser-runtime-lease. |
| `experiments/offline-sync/browser-runtime-upgrade.mjs` | MJS | 17674 | 223 | File di progetto: browser-runtime-upgrade. |
| `experiments/offline-sync/browser-two-tabs.mjs` | MJS | 25746 | 382 | File di progetto: browser-two-tabs. |
| `experiments/offline-sync/compatible-queue-reader.mjs` | MJS | 4088 | 68 | File di progetto: compatible-queue-reader. |
| `experiments/offline-sync/conflict-note-proposal.mjs` | MJS | 3194 | 54 | File di progetto: conflict-note-proposal. |
| `experiments/offline-sync/conflict-note-proposal.test.mjs` | MJS | 4444 | 62 | File di progetto: conflict-note-proposal.test. |
| `experiments/offline-sync/conflict-note-review.mjs` | MJS | 1970 | 28 | File di progetto: conflict-note-review. |
| `experiments/offline-sync/conflict-note-review.test.mjs` | MJS | 2668 | 40 | File di progetto: conflict-note-review.test. |
| `experiments/offline-sync/emulated-backend-bridge.mjs` | MJS | 6282 | 90 | File di progetto: emulated-backend-bridge. |
| `experiments/offline-sync/fenced-queue-client.mjs` | MJS | 5833 | 99 | File di progetto: fenced-queue-client. |
| `experiments/offline-sync/fenced-queue-writer.mjs` | MJS | 8158 | 124 | File di progetto: fenced-queue-writer. |
| `experiments/offline-sync/firebase-fenced-queue-client.mjs` | MJS | 3008 | 55 | File di progetto: firebase-fenced-queue-client. |
| `experiments/offline-sync/firebase-fenced-queue-client.test.mjs` | MJS | 5745 | 82 | File di progetto: firebase-fenced-queue-client.test. |
| `experiments/offline-sync/firestore.candidate.rules` | RULES | 711 | 22 | File di progetto: firestore.candidate. |
| `experiments/offline-sync/hybrid-queue-coordinator.mjs` | MJS | 5635 | 102 | File di progetto: hybrid-queue-coordinator. |
| `experiments/offline-sync/hybrid-queue-coordinator.test.mjs` | MJS | 16281 | 265 | File di progetto: hybrid-queue-coordinator.test. |
| `experiments/offline-sync/indexeddb-queue-lease.mjs` | MJS | 5522 | 99 | File di progetto: indexeddb-queue-lease. |
| `experiments/offline-sync/indexeddb-queue-lease.test.mjs` | MJS | 8650 | 139 | File di progetto: indexeddb-queue-lease.test. |
| `experiments/offline-sync/mixed-current-worker.mjs` | MJS | 12598 | 203 | File di progetto: mixed-current-worker. |
| `experiments/offline-sync/offline-mutation-lease.mjs` | MJS | 19136 | 349 | File di progetto: offline-mutation-lease. |
| `experiments/offline-sync/offline-mutation-lease.test.mjs` | MJS | 23461 | 356 | File di progetto: offline-mutation-lease.test. |
| `experiments/offline-sync/offline-mutation-model.mjs` | MJS | 4660 | 68 | File di progetto: offline-mutation-model. |
| `experiments/offline-sync/offline-mutation-model.test.mjs` | MJS | 3958 | 58 | File di progetto: offline-mutation-model.test. |
| `experiments/offline-sync/offline-save-panel.mjs` | MJS | 17077 | 235 | File di progetto: offline-save-panel. |
| `experiments/offline-sync/offline-save-panel.test.mjs` | MJS | 19612 | 307 | File di progetto: offline-save-panel.test. |
| `experiments/offline-sync/pilot-lease-worker.mjs` | MJS | 11911 | 184 | File di progetto: pilot-lease-worker. |
| `experiments/offline-sync/queue-upgrade-v2.mjs` | MJS | 7876 | 128 | File di progetto: queue-upgrade-v2. |
| `experiments/offline-sync/rollback-v2-compatible.mjs` | MJS | 4403 | 71 | File di progetto: rollback-v2-compatible. |
| `experiments/offline-sync/run-browser-tests.mjs` | MJS | 10558 | 133 | File di progetto: run-browser-tests. |
| `experiments/offline-sync/run-emulated-browsers.mjs` | MJS | 1973 | 32 | File di progetto: run-emulated-browsers. |
| `experiments/persistent-vault-shell/account-detail-reader.mjs` | MJS | 2776 | 51 | File di progetto: account-detail-reader. |
| `experiments/persistent-vault-shell/account-detail-reader.test.mjs` | MJS | 7494 | 121 | File di progetto: account-detail-reader.test. |
| `experiments/persistent-vault-shell/account-note-candidate-rules.mjs` | MJS | 739 | 12 | File di progetto: account-note-candidate-rules. |
| `experiments/persistent-vault-shell/account-note-contract.mjs` | MJS | 3000 | 42 | File di progetto: account-note-contract. |
| `experiments/persistent-vault-shell/account-note-editor-provider.mjs` | MJS | 3031 | 43 | File di progetto: account-note-editor-provider. |
| `experiments/persistent-vault-shell/account-note-editor-source.mjs` | MJS | 3832 | 54 | File di progetto: account-note-editor-source. |
| `experiments/persistent-vault-shell/account-note-editor.test.mjs` | MJS | 9049 | 101 | File di progetto: account-note-editor.test. |
| `experiments/persistent-vault-shell/account-note-handler.mjs` | MJS | 2884 | 39 | File di progetto: account-note-handler. |
| `experiments/persistent-vault-shell/account-note-panel-router.mjs` | MJS | 3684 | 58 | File di progetto: account-note-panel-router. |
| `experiments/persistent-vault-shell/account-note-panel-router.test.mjs` | MJS | 4787 | 56 | File di progetto: account-note-panel-router.test. |
| `experiments/persistent-vault-shell/account-note-queue-access.mjs` | MJS | 2124 | 37 | File di progetto: account-note-queue-access. |
| `experiments/persistent-vault-shell/account-note-queue-access.test.mjs` | MJS | 4172 | 49 | File di progetto: account-note-queue-access.test. |
| `experiments/persistent-vault-shell/account-note.test.mjs` | MJS | 7251 | 85 | File di progetto: account-note.test. |
| `experiments/persistent-vault-shell/account-route.mjs` | MJS | 2067 | 38 | File di progetto: account-route. |
| `experiments/persistent-vault-shell/account-route.test.mjs` | MJS | 4424 | 80 | File di progetto: account-route.test. |
| `experiments/persistent-vault-shell/account-standard-candidate-rules.mjs` | MJS | 1058 | 19 | File di progetto: account-standard-candidate-rules. |
| `experiments/persistent-vault-shell/account-standard-contract.mjs` | MJS | 4707 | 51 | File di progetto: account-standard-contract. |
| `experiments/persistent-vault-shell/account-standard-editor-provider.mjs` | MJS | 1725 | 20 | File di progetto: account-standard-editor-provider. |
| `experiments/persistent-vault-shell/account-standard-editor-source.mjs` | MJS | 3486 | 41 | File di progetto: account-standard-editor-source. |
| `experiments/persistent-vault-shell/account-standard-editor-view.mjs` | MJS | 2793 | 35 | File di progetto: account-standard-editor-view. |
| `experiments/persistent-vault-shell/account-standard-editor.test.mjs` | MJS | 4539 | 39 | File di progetto: account-standard-editor.test. |
| `experiments/persistent-vault-shell/account-standard-handler.mjs` | MJS | 2849 | 39 | File di progetto: account-standard-handler. |
| `experiments/persistent-vault-shell/account-standard.test.mjs` | MJS | 5493 | 54 | File di progetto: account-standard.test. |
| `experiments/persistent-vault-shell/account-widget-reader.mjs` | MJS | 6403 | 107 | File di progetto: account-widget-reader. |
| `experiments/persistent-vault-shell/account-widget-reader.test.mjs` | MJS | 8984 | 144 | File di progetto: account-widget-reader.test. |
| `experiments/persistent-vault-shell/account-widget-view.mjs` | MJS | 5575 | 88 | File di progetto: account-widget-view. |
| `experiments/persistent-vault-shell/account-widget-view.test.mjs` | MJS | 4368 | 60 | File di progetto: account-widget-view.test. |
| `experiments/persistent-vault-shell/addresses-editor-view.mjs` | MJS | 15374 | 241 | File di progetto: addresses-editor-view. |
| `experiments/persistent-vault-shell/app.mjs` | MJS | 5001 | 94 | File di progetto: app. |
| `experiments/persistent-vault-shell/assets/pdf/LICENSE_LIBERATION` | CONFIG | 4511 | 102 | File di progetto: LICENSE LIBERATION. |
| `experiments/persistent-vault-shell/assets/pdf/LiberationSans-Bold.ttf` | TTF | 137052 | 1082 | File di progetto: LiberationSans-Bold. |
| `experiments/persistent-vault-shell/assets/pdf/LiberationSans-Regular.ttf` | TTF | 139512 | 906 | File di progetto: LiberationSans-Regular. |
| `experiments/persistent-vault-shell/banking-reader.mjs` | MJS | 5124 | 80 | File di progetto: banking-reader. |
| `experiments/persistent-vault-shell/banking-reader.test.mjs` | MJS | 6040 | 78 | File di progetto: banking-reader.test. |
| `experiments/persistent-vault-shell/banking-view.mjs` | MJS | 3474 | 51 | File di progetto: banking-view. |
| `experiments/persistent-vault-shell/banking-view.test.mjs` | MJS | 3765 | 52 | File di progetto: banking-view.test. |
| `experiments/persistent-vault-shell/browser-session-boundary.mjs` | MJS | 1018 | 21 | File di progetto: browser-session-boundary. |
| `experiments/persistent-vault-shell/browser-session-boundary.test.mjs` | MJS | 2949 | 46 | File di progetto: browser-session-boundary.test. |
| `experiments/persistent-vault-shell/build-emulator.mjs` | MJS | 5031 | 52 | File di progetto: build-emulator. |
| `experiments/persistent-vault-shell/build.mjs` | MJS | 2525 | 32 | File di progetto: build. |
| `experiments/persistent-vault-shell/company-addresses-candidate-rules.mjs` | MJS | 1600 | 23 | File di progetto: company-addresses-candidate-rules. |
| `experiments/persistent-vault-shell/company-addresses-contract.mjs` | MJS | 11322 | 208 | File di progetto: company-addresses-contract. |
| `experiments/persistent-vault-shell/company-addresses-editor-provider.mjs` | MJS | 1378 | 21 | File di progetto: company-addresses-editor-provider. |
| `experiments/persistent-vault-shell/company-addresses-editor-source.mjs` | MJS | 6800 | 101 | File di progetto: company-addresses-editor-source. |
| `experiments/persistent-vault-shell/company-addresses-handler.mjs` | MJS | 5763 | 92 | File di progetto: company-addresses-handler. |
| `experiments/persistent-vault-shell/company-addresses.test.mjs` | MJS | 14025 | 202 | File di progetto: company-addresses.test. |
| `experiments/persistent-vault-shell/company-contacts-candidate-rules.mjs` | MJS | 1898 | 27 | File di progetto: company-contacts-candidate-rules. |
| `experiments/persistent-vault-shell/company-contacts-contract.mjs` | MJS | 22017 | 351 | File di progetto: company-contacts-contract. |
| `experiments/persistent-vault-shell/company-contacts-contract.test.mjs` | MJS | 17392 | 234 | File di progetto: company-contacts-contract.test. |
| `experiments/persistent-vault-shell/company-contacts-editor-provider.mjs` | MJS | 1393 | 21 | File di progetto: company-contacts-editor-provider. |
| `experiments/persistent-vault-shell/company-contacts-editor-source.mjs` | MJS | 11122 | 164 | File di progetto: company-contacts-editor-source. |
| `experiments/persistent-vault-shell/company-contacts-editor-view.mjs` | MJS | 15900 | 250 | File di progetto: company-contacts-editor-view. |
| `experiments/persistent-vault-shell/company-contacts-editor.test.mjs` | MJS | 15371 | 231 | File di progetto: company-contacts-editor.test. |
| `experiments/persistent-vault-shell/company-contacts-handler.mjs` | MJS | 8125 | 123 | File di progetto: company-contacts-handler. |
| `experiments/persistent-vault-shell/company-contacts.test.mjs` | MJS | 30558 | 437 | File di progetto: company-contacts.test. |
| `experiments/persistent-vault-shell/company-digital-card-reader.mjs` | MJS | 4150 | 64 | File di progetto: company-digital-card-reader. |
| `experiments/persistent-vault-shell/company-digital-card-reader.test.mjs` | MJS | 3645 | 48 | File di progetto: company-digital-card-reader.test. |
| `experiments/persistent-vault-shell/company-directory.mjs` | MJS | 5183 | 82 | File di progetto: company-directory. |
| `experiments/persistent-vault-shell/company-directory.test.mjs` | MJS | 5475 | 61 | File di progetto: company-directory.test. |
| `experiments/persistent-vault-shell/company-profile-source.mjs` | MJS | 2126 | 31 | File di progetto: company-profile-source. |
| `experiments/persistent-vault-shell/company-profile-source.test.mjs` | MJS | 5269 | 60 | File di progetto: company-profile-source.test. |
| `experiments/persistent-vault-shell/company-qr-editor-provider.mjs` | MJS | 1801 | 25 | File di progetto: company-qr-editor-provider. |
| `experiments/persistent-vault-shell/company-qr-editor-source.mjs` | MJS | 2547 | 42 | File di progetto: company-qr-editor-source. |
| `experiments/persistent-vault-shell/company-qr-editor-source.test.mjs` | MJS | 4630 | 60 | File di progetto: company-qr-editor-source.test. |
| `experiments/persistent-vault-shell/company-qr-selection-candidate-rules.mjs` | MJS | 1044 | 17 | File di progetto: company-qr-selection-candidate-rules. |
| `experiments/persistent-vault-shell/company-qr-selection-contract.mjs` | MJS | 2661 | 48 | File di progetto: company-qr-selection-contract. |
| `experiments/persistent-vault-shell/company-qr-selection-contract.test.mjs` | MJS | 2836 | 39 | File di progetto: company-qr-selection-contract.test. |
| `experiments/persistent-vault-shell/company-qr-selection-handler.mjs` | MJS | 3350 | 47 | File di progetto: company-qr-selection-handler. |
| `experiments/persistent-vault-shell/company-qr-selection-handler.test.mjs` | MJS | 5076 | 68 | File di progetto: company-qr-selection-handler.test. |
| `experiments/persistent-vault-shell/company-summary-browser.mjs` | MJS | 2770 | 39 | File di progetto: company-summary-browser. |
| `experiments/persistent-vault-shell/company-summary-browser.test.mjs` | MJS | 2148 | 28 | File di progetto: company-summary-browser.test. |
| `experiments/persistent-vault-shell/company-summary-pdf.mjs` | MJS | 5923 | 95 | File di progetto: company-summary-pdf. |
| `experiments/persistent-vault-shell/company-summary-pdf.test.mjs` | MJS | 2230 | 32 | File di progetto: company-summary-pdf.test. |
| `experiments/persistent-vault-shell/company-summary-reader.mjs` | MJS | 5105 | 66 | File di progetto: company-summary-reader. |
| `experiments/persistent-vault-shell/company-summary-reader.test.mjs` | MJS | 2924 | 35 | File di progetto: company-summary-reader.test. |
| `experiments/persistent-vault-shell/company-summary-view.mjs` | MJS | 5657 | 58 | File di progetto: company-summary-view. |
| `experiments/persistent-vault-shell/company-summary-view.test.mjs` | MJS | 2486 | 34 | File di progetto: company-summary-view.test. |
| `experiments/persistent-vault-shell/detail-extra-fields.mjs` | MJS | 2838 | 62 | File di progetto: detail-extra-fields. |
| `experiments/persistent-vault-shell/detail-extra-fields.test.mjs` | MJS | 5898 | 96 | File di progetto: detail-extra-fields.test. |
| `experiments/persistent-vault-shell/digital-card-view.mjs` | MJS | 3768 | 50 | File di progetto: digital-card-view. |
| `experiments/persistent-vault-shell/digital-card-view.test.mjs` | MJS | 3450 | 46 | File di progetto: digital-card-view.test. |
| `experiments/persistent-vault-shell/emulator-addresses-check.mjs` | MJS | 30838 | 354 | File di progetto: emulator-addresses-check. |
| `experiments/persistent-vault-shell/emulator-attachments-check.mjs` | MJS | 8452 | 126 | File di progetto: emulator-attachments-check. |
| `experiments/persistent-vault-shell/emulator-browser.mjs` | MJS | 15735 | 172 | File di progetto: emulator-browser. |
| `experiments/persistent-vault-shell/emulator-cold-check.mjs` | MJS | 20204 | 234 | File di progetto: emulator-cold-check. |
| `experiments/persistent-vault-shell/emulator-cold-sw.js` | JS | 1191 | 17 | File di progetto: emulator-cold-sw. |
| `experiments/persistent-vault-shell/emulator-cold-sw.test.mjs` | MJS | 2348 | 35 | File di progetto: emulator-cold-sw.test. |
| `experiments/persistent-vault-shell/emulator-company-contacts-check.mjs` | MJS | 18325 | 274 | File di progetto: emulator-company-contacts-check. |
| `experiments/persistent-vault-shell/emulator-detail-view.mjs` | MJS | 7354 | 134 | File di progetto: emulator-detail-view. |
| `experiments/persistent-vault-shell/emulator-detail-view.test.mjs` | MJS | 15301 | 260 | File di progetto: emulator-detail-view.test. |
| `experiments/persistent-vault-shell/emulator-entry-check.mjs` | MJS | 43246 | 508 | File di progetto: emulator-entry-check. |
| `experiments/persistent-vault-shell/emulator-entry-runner.mjs` | MJS | 7520 | 101 | File di progetto: emulator-entry-runner. |
| `experiments/persistent-vault-shell/emulator-entry-runner.test.mjs` | MJS | 6224 | 93 | File di progetto: emulator-entry-runner.test. |
| `experiments/persistent-vault-shell/emulator-entry.mjs` | MJS | 29765 | 344 | File di progetto: emulator-entry. |
| `experiments/persistent-vault-shell/emulator-evicted-check.mjs` | MJS | 10495 | 139 | File di progetto: emulator-evicted-check. |
| `experiments/persistent-vault-shell/emulator-firebase.mjs` | MJS | 1498 | 19 | File di progetto: emulator-firebase. |
| `experiments/persistent-vault-shell/emulator-list-view.mjs` | MJS | 3510 | 54 | File di progetto: emulator-list-view. |
| `experiments/persistent-vault-shell/emulator-network-control.mjs` | MJS | 8878 | 125 | File di progetto: emulator-network-control. |
| `experiments/persistent-vault-shell/emulator-note-bridge.mjs` | MJS | 2518 | 44 | File di progetto: emulator-note-bridge. |
| `experiments/persistent-vault-shell/emulator-qr-bridge.mjs` | MJS | 5976 | 75 | File di progetto: emulator-qr-bridge. |
| `experiments/persistent-vault-shell/emulator-queue.mjs` | MJS | 3404 | 52 | File di progetto: emulator-queue. |
| `experiments/persistent-vault-shell/emulator-queue.test.mjs` | MJS | 3898 | 54 | File di progetto: emulator-queue.test. |
| `experiments/persistent-vault-shell/emulator.css` | CSS | 3726 | 39 | File di progetto: emulator. |
| `experiments/persistent-vault-shell/emulator.html` | HTML | 1964 | 11 | Struttura della pagina emulator; comportamento demandato ai moduli. |
| `experiments/persistent-vault-shell/excel-export-projection.mjs` | MJS | 6383 | 96 | File di progetto: excel-export-projection. |
| `experiments/persistent-vault-shell/excel-export-projection.test.mjs` | MJS | 6517 | 105 | File di progetto: excel-export-projection.test. |
| `experiments/persistent-vault-shell/firebase-account-note.test.mjs` | MJS | 4946 | 57 | File di progetto: firebase-account-note.test. |
| `experiments/persistent-vault-shell/firebase-account-standard.test.mjs` | MJS | 4904 | 60 | File di progetto: firebase-account-standard.test. |
| `experiments/persistent-vault-shell/firebase-addresses.test.mjs` | MJS | 14004 | 170 | File di progetto: firebase-addresses.test. |
| `experiments/persistent-vault-shell/firebase-archive.test.mjs` | MJS | 6219 | 81 | File di progetto: firebase-archive.test. |
| `experiments/persistent-vault-shell/firebase-backup.test.mjs` | MJS | 12936 | 175 | File di progetto: firebase-backup.test. |
| `experiments/persistent-vault-shell/firebase-company-contacts.test.mjs` | MJS | 16885 | 212 | File di progetto: firebase-company-contacts.test. |
| `experiments/persistent-vault-shell/firebase-deadline.test.mjs` | MJS | 10293 | 159 | File di progetto: firebase-deadline.test. |
| `experiments/persistent-vault-shell/firebase-document-attachment-transport.mjs` | MJS | 5403 | 108 | File di progetto: firebase-document-attachment-transport. |
| `experiments/persistent-vault-shell/firebase-document-attachment-transport.test.mjs` | MJS | 6573 | 112 | File di progetto: firebase-document-attachment-transport.test. |
| `experiments/persistent-vault-shell/firebase-documents.test.mjs` | MJS | 3214 | 4 | File di progetto: firebase-documents.test. |
| `experiments/persistent-vault-shell/firebase-mutation.test.mjs` | MJS | 35343 | 480 | File di progetto: firebase-mutation.test. |
| `experiments/persistent-vault-shell/firebase-private-note-source.mjs` | MJS | 864 | 13 | File di progetto: firebase-private-note-source. |
| `experiments/persistent-vault-shell/firebase-profile-contacts.test.mjs` | MJS | 13767 | 174 | File di progetto: firebase-profile-contacts.test. |
| `experiments/persistent-vault-shell/firebase-profile-document-attachments-storage.test.mjs` | MJS | 14062 | 175 | File di progetto: firebase-profile-document-attachments-storage.test. |
| `experiments/persistent-vault-shell/firebase-profile-document-attachments.test.mjs` | MJS | 17339 | 219 | File di progetto: firebase-profile-document-attachments.test. |
| `experiments/persistent-vault-shell/firebase-profile-link.test.mjs` | MJS | 8781 | 98 | File di progetto: firebase-profile-link.test. |
| `experiments/persistent-vault-shell/firebase-profile-text.test.mjs` | MJS | 5078 | 63 | File di progetto: firebase-profile-text.test. |
| `experiments/persistent-vault-shell/firebase-qr-selection.test.mjs` | MJS | 11113 | 132 | File di progetto: firebase-qr-selection.test. |
| `experiments/persistent-vault-shell/firebase-session.mjs` | MJS | 3760 | 62 | File di progetto: firebase-session. |
| `experiments/persistent-vault-shell/firebase-session.test.mjs` | MJS | 13229 | 176 | File di progetto: firebase-session.test. |
| `experiments/persistent-vault-shell/firebase-utilities.test.mjs` | MJS | 4251 | 15 | File di progetto: firebase-utilities.test. |
| `experiments/persistent-vault-shell/firebase.emulators-storage.json` | JSON | 469 | 14 | File di progetto: firebase.emulators-storage. |
| `experiments/persistent-vault-shell/firebase.emulators.json` | JSON | 359 | 12 | File di progetto: firebase.emulators. |
| `experiments/persistent-vault-shell/firebase.preview.json` | JSON | 626 | 15 | File di progetto: firebase.preview. |
| `experiments/persistent-vault-shell/fixture-repository.mjs` | MJS | 1036 | 21 | File di progetto: fixture-repository. |
| `experiments/persistent-vault-shell/fixture.mjs` | MJS | 2025 | 32 | File di progetto: fixture. |
| `experiments/persistent-vault-shell/index.html` | HTML | 1748 | 27 | Struttura della pagina index; comportamento demandato ai moduli. |
| `experiments/persistent-vault-shell/legacy-adapter.mjs` | MJS | 3664 | 83 | File di progetto: legacy-adapter. |
| `experiments/persistent-vault-shell/legacy-adapter.test.mjs` | MJS | 11224 | 220 | File di progetto: legacy-adapter.test. |
| `experiments/persistent-vault-shell/master-prompt.mjs` | MJS | 1415 | 29 | File di progetto: master-prompt. |
| `experiments/persistent-vault-shell/master-prompt.test.mjs` | MJS | 3590 | 64 | File di progetto: master-prompt.test. |
| `experiments/persistent-vault-shell/memory-vault.mjs` | MJS | 6403 | 120 | File di progetto: memory-vault. |
| `experiments/persistent-vault-shell/offline-consultation-probe.mjs` | MJS | 4964 | 62 | File di progetto: offline-consultation-probe. |
| `experiments/persistent-vault-shell/owned-queue.test.mjs` | MJS | 5685 | 82 | File di progetto: owned-queue.test. |
| `experiments/persistent-vault-shell/prepare-company-addresses.mjs` | MJS | 5865 | 93 | File di progetto: prepare-company-addresses. |
| `experiments/persistent-vault-shell/prepare-company-contacts.mjs` | MJS | 8360 | 132 | File di progetto: prepare-company-contacts. |
| `experiments/persistent-vault-shell/prepare-preview.mjs` | MJS | 2144 | 32 | File di progetto: prepare-preview. |
| `experiments/persistent-vault-shell/prepare-private-account-mutation.mjs` | MJS | 6741 | 105 | File di progetto: prepare-private-account-mutation. |
| `experiments/persistent-vault-shell/prepare-private-account-mutation.test.mjs` | MJS | 8547 | 128 | File di progetto: prepare-private-account-mutation.test. |
| `experiments/persistent-vault-shell/prepare-private-account-patch.mjs` | MJS | 4145 | 63 | File di progetto: prepare-private-account-patch. |
| `experiments/persistent-vault-shell/prepare-private-account-patch.test.mjs` | MJS | 6482 | 103 | File di progetto: prepare-private-account-patch.test. |
| `experiments/persistent-vault-shell/prepare-private-addresses.mjs` | MJS | 4664 | 76 | File di progetto: prepare-private-addresses. |
| `experiments/persistent-vault-shell/prepare-private-documents.mjs` | MJS | 2328 | 13 | File di progetto: prepare-private-documents. |
| `experiments/persistent-vault-shell/prepare-private-utilities.mjs` | MJS | 4838 | 81 | File di progetto: prepare-private-utilities. |
| `experiments/persistent-vault-shell/prepare-profile-account-create.mjs` | MJS | 3299 | 37 | File di progetto: prepare-profile-account-create. |
| `experiments/persistent-vault-shell/prepare-profile-contacts.mjs` | MJS | 4637 | 83 | File di progetto: prepare-profile-contacts. |
| `experiments/persistent-vault-shell/prepare-profile-document-attachment.mjs` | MJS | 10122 | 121 | File di progetto: prepare-profile-document-attachment. |
| `experiments/persistent-vault-shell/prepare-profile-text.mjs` | MJS | 2117 | 32 | File di progetto: prepare-profile-text. |
| `experiments/persistent-vault-shell/preview.test.mjs` | MJS | 4504 | 74 | File di progetto: preview.test. |
| `experiments/persistent-vault-shell/private-account-save-controller.mjs` | MJS | 7242 | 135 | File di progetto: private-account-save-controller. |
| `experiments/persistent-vault-shell/private-account-save-controller.test.mjs` | MJS | 12949 | 189 | File di progetto: private-account-save-controller.test. |
| `experiments/persistent-vault-shell/private-addresses-candidate-rules.mjs` | MJS | 1503 | 21 | File di progetto: private-addresses-candidate-rules. |
| `experiments/persistent-vault-shell/private-addresses-contract.mjs` | MJS | 9208 | 161 | File di progetto: private-addresses-contract. |
| `experiments/persistent-vault-shell/private-addresses-editor-provider.mjs` | MJS | 1965 | 28 | File di progetto: private-addresses-editor-provider. |
| `experiments/persistent-vault-shell/private-addresses-editor-source.mjs` | MJS | 7817 | 118 | File di progetto: private-addresses-editor-source. |
| `experiments/persistent-vault-shell/private-addresses-handler.mjs` | MJS | 7742 | 114 | File di progetto: private-addresses-handler. |
| `experiments/persistent-vault-shell/private-addresses.test.mjs` | MJS | 15885 | 221 | File di progetto: private-addresses.test. |
| `experiments/persistent-vault-shell/private-digital-card-reader.mjs` | MJS | 6283 | 100 | File di progetto: private-digital-card-reader. |
| `experiments/persistent-vault-shell/private-digital-card-reader.test.mjs` | MJS | 4786 | 56 | File di progetto: private-digital-card-reader.test. |
| `experiments/persistent-vault-shell/private-documents-candidate-rules.mjs` | MJS | 581 | 4 | File di progetto: private-documents-candidate-rules. |
| `experiments/persistent-vault-shell/private-documents-contract.mjs` | MJS | 5793 | 52 | File di progetto: private-documents-contract. |
| `experiments/persistent-vault-shell/private-documents-editor-provider.mjs` | MJS | 956 | 3 | File di progetto: private-documents-editor-provider. |
| `experiments/persistent-vault-shell/private-documents-editor-source.mjs` | MJS | 3771 | 16 | File di progetto: private-documents-editor-source. |
| `experiments/persistent-vault-shell/private-documents-editor-view.mjs` | MJS | 4831 | 10 | File di progetto: private-documents-editor-view. |
| `experiments/persistent-vault-shell/private-documents-editor.test.mjs` | MJS | 2936 | 8 | File di progetto: private-documents-editor.test. |
| `experiments/persistent-vault-shell/private-documents-handler.mjs` | MJS | 2803 | 11 | File di progetto: private-documents-handler. |
| `experiments/persistent-vault-shell/private-documents.test.mjs` | MJS | 5696 | 18 | File di progetto: private-documents.test. |
| `experiments/persistent-vault-shell/private-note-panel-provider.mjs` | MJS | 8223 | 107 | File di progetto: private-note-panel-provider. |
| `experiments/persistent-vault-shell/private-note-panel-provider.test.mjs` | MJS | 10147 | 144 | File di progetto: private-note-panel-provider.test. |
| `experiments/persistent-vault-shell/private-note-source.mjs` | MJS | 2181 | 31 | File di progetto: private-note-source. |
| `experiments/persistent-vault-shell/private-note-source.test.mjs` | MJS | 2864 | 40 | File di progetto: private-note-source.test. |
| `experiments/persistent-vault-shell/private-qr-editor-provider.mjs` | MJS | 1114 | 17 | File di progetto: private-qr-editor-provider. |
| `experiments/persistent-vault-shell/private-utilities-candidate-rules.mjs` | MJS | 746 | 7 | File di progetto: private-utilities-candidate-rules. |
| `experiments/persistent-vault-shell/private-utilities-contract.mjs` | MJS | 9806 | 162 | File di progetto: private-utilities-contract. |
| `experiments/persistent-vault-shell/private-utilities-editor-provider.mjs` | MJS | 1029 | 11 | File di progetto: private-utilities-editor-provider. |
| `experiments/persistent-vault-shell/private-utilities-editor-source.mjs` | MJS | 4963 | 69 | File di progetto: private-utilities-editor-source. |
| `experiments/persistent-vault-shell/private-utilities-editor-view.mjs` | MJS | 5676 | 38 | File di progetto: private-utilities-editor-view. |
| `experiments/persistent-vault-shell/private-utilities-editor.test.mjs` | MJS | 4661 | 41 | File di progetto: private-utilities-editor.test. |
| `experiments/persistent-vault-shell/private-utilities-handler.mjs` | MJS | 4557 | 72 | File di progetto: private-utilities-handler. |
| `experiments/persistent-vault-shell/private-utilities.test.mjs` | MJS | 15962 | 217 | File di progetto: private-utilities.test. |
| `experiments/persistent-vault-shell/profile-account-create-contract.mjs` | MJS | 2821 | 36 | File di progetto: profile-account-create-contract. |
| `experiments/persistent-vault-shell/profile-account-create-handler.mjs` | MJS | 4974 | 48 | File di progetto: profile-account-create-handler. |
| `experiments/persistent-vault-shell/profile-account-create-view.mjs` | MJS | 4204 | 36 | File di progetto: profile-account-create-view. |
| `experiments/persistent-vault-shell/profile-account-create.test.mjs` | MJS | 9011 | 97 | File di progetto: profile-account-create.test. |
| `experiments/persistent-vault-shell/profile-account-picker-reader.mjs` | MJS | 4188 | 66 | File di progetto: profile-account-picker-reader. |
| `experiments/persistent-vault-shell/profile-account-picker-view.mjs` | MJS | 5713 | 69 | File di progetto: profile-account-picker-view. |
| `experiments/persistent-vault-shell/profile-account-picker.test.mjs` | MJS | 10748 | 128 | File di progetto: profile-account-picker.test. |
| `experiments/persistent-vault-shell/profile-contacts-candidate-rules.mjs` | MJS | 1284 | 18 | File di progetto: profile-contacts-candidate-rules. |
| `experiments/persistent-vault-shell/profile-contacts-contract.mjs` | MJS | 8596 | 139 | File di progetto: profile-contacts-contract. |
| `experiments/persistent-vault-shell/profile-contacts-editor-provider.mjs` | MJS | 1344 | 20 | File di progetto: profile-contacts-editor-provider. |
| `experiments/persistent-vault-shell/profile-contacts-editor-source.mjs` | MJS | 8604 | 126 | File di progetto: profile-contacts-editor-source. |
| `experiments/persistent-vault-shell/profile-contacts-editor-view.mjs` | MJS | 11754 | 183 | File di progetto: profile-contacts-editor-view. |
| `experiments/persistent-vault-shell/profile-contacts-editor.test.mjs` | MJS | 21589 | 331 | File di progetto: profile-contacts-editor.test. |
| `experiments/persistent-vault-shell/profile-contacts-handler.mjs` | MJS | 8178 | 122 | File di progetto: profile-contacts-handler. |
| `experiments/persistent-vault-shell/profile-contacts.test.mjs` | MJS | 21070 | 305 | File di progetto: profile-contacts.test. |
| `experiments/persistent-vault-shell/profile-document-attachment-candidate-rules.mjs` | MJS | 2275 | 36 | File di progetto: profile-document-attachment-candidate-rules. |
| `experiments/persistent-vault-shell/profile-document-attachment-capability.mjs` | MJS | 4070 | 67 | File di progetto: profile-document-attachment-capability. |
| `experiments/persistent-vault-shell/profile-document-attachment-rules.test.mjs` | MJS | 5600 | 71 | File di progetto: profile-document-attachment-rules.test. |
| `experiments/persistent-vault-shell/profile-document-attachment-seal.mjs` | MJS | 5599 | 101 | File di progetto: profile-document-attachment-seal. |
| `experiments/persistent-vault-shell/profile-document-attachment-seal.test.mjs` | MJS | 11101 | 170 | File di progetto: profile-document-attachment-seal.test. |
| `experiments/persistent-vault-shell/profile-document-attachment-storage-rules.mjs` | MJS | 3495 | 48 | File di progetto: profile-document-attachment-storage-rules. |
| `experiments/persistent-vault-shell/profile-document-attachments-contract.mjs` | MJS | 19165 | 255 | File di progetto: profile-document-attachments-contract. |
| `experiments/persistent-vault-shell/profile-document-attachments-editor.test.mjs` | MJS | 16575 | 269 | File di progetto: profile-document-attachments-editor.test. |
| `experiments/persistent-vault-shell/profile-document-attachments-handler.mjs` | MJS | 32486 | 464 | File di progetto: profile-document-attachments-handler. |
| `experiments/persistent-vault-shell/profile-document-attachments-handler.test.mjs` | MJS | 36409 | 543 | File di progetto: profile-document-attachments-handler.test. |
| `experiments/persistent-vault-shell/profile-document-attachments-provider.mjs` | MJS | 4006 | 57 | File di progetto: profile-document-attachments-provider. |
| `experiments/persistent-vault-shell/profile-document-attachments-provider.test.mjs` | MJS | 12703 | 179 | File di progetto: profile-document-attachments-provider.test. |
| `experiments/persistent-vault-shell/profile-document-attachments-reader.mjs` | MJS | 3140 | 54 | File di progetto: profile-document-attachments-reader. |
| `experiments/persistent-vault-shell/profile-document-attachments-reader.test.mjs` | MJS | 7702 | 110 | File di progetto: profile-document-attachments-reader.test. |
| `experiments/persistent-vault-shell/profile-document-attachments-source.mjs` | MJS | 8312 | 144 | File di progetto: profile-document-attachments-source. |
| `experiments/persistent-vault-shell/profile-document-attachments-view.mjs` | MJS | 7415 | 151 | File di progetto: profile-document-attachments-view. |
| `experiments/persistent-vault-shell/profile-document-attachments.test.mjs` | MJS | 22686 | 299 | File di progetto: profile-document-attachments.test. |
| `experiments/persistent-vault-shell/profile-link-candidate-rules.mjs` | MJS | 2668 | 31 | File di progetto: profile-link-candidate-rules. |
| `experiments/persistent-vault-shell/profile-link-contract.mjs` | MJS | 5967 | 79 | File di progetto: profile-link-contract. |
| `experiments/persistent-vault-shell/profile-link-editor-provider.mjs` | MJS | 7024 | 92 | File di progetto: profile-link-editor-provider. |
| `experiments/persistent-vault-shell/profile-link-editor-source.mjs` | MJS | 3509 | 49 | File di progetto: profile-link-editor-source. |
| `experiments/persistent-vault-shell/profile-link-editor-source.test.mjs` | MJS | 8864 | 123 | File di progetto: profile-link-editor-source.test. |
| `experiments/persistent-vault-shell/profile-link-handler.mjs` | MJS | 5157 | 63 | File di progetto: profile-link-handler. |
| `experiments/persistent-vault-shell/profile-link-origin.mjs` | MJS | 1397 | 22 | File di progetto: profile-link-origin. |
| `experiments/persistent-vault-shell/profile-link-plan.mjs` | MJS | 6140 | 80 | File di progetto: profile-link-plan. |
| `experiments/persistent-vault-shell/profile-link.test.mjs` | MJS | 12427 | 147 | File di progetto: profile-link.test. |
| `experiments/persistent-vault-shell/profile-linked-account.mjs` | MJS | 4448 | 67 | File di progetto: profile-linked-account. |
| `experiments/persistent-vault-shell/profile-linked-account.test.mjs` | MJS | 6744 | 85 | File di progetto: profile-linked-account.test. |
| `experiments/persistent-vault-shell/profile-overview-reader.mjs` | MJS | 4649 | 66 | File di progetto: profile-overview-reader. |
| `experiments/persistent-vault-shell/profile-overview-reader.test.mjs` | MJS | 4302 | 44 | File di progetto: profile-overview-reader.test. |
| `experiments/persistent-vault-shell/profile-section-reader.mjs` | MJS | 5227 | 73 | File di progetto: profile-section-reader. |
| `experiments/persistent-vault-shell/profile-section-reader.test.mjs` | MJS | 6094 | 77 | File di progetto: profile-section-reader.test. |
| `experiments/persistent-vault-shell/profile-shell-view.mjs` | MJS | 15176 | 204 | File di progetto: profile-shell-view. |
| `experiments/persistent-vault-shell/profile-shell-view.test.mjs` | MJS | 13138 | 159 | File di progetto: profile-shell-view.test. |
| `experiments/persistent-vault-shell/profile-text-candidate-rules.mjs` | MJS | 1789 | 24 | File di progetto: profile-text-candidate-rules. |
| `experiments/persistent-vault-shell/profile-text-contract.mjs` | MJS | 4257 | 61 | File di progetto: profile-text-contract. |
| `experiments/persistent-vault-shell/profile-text-editor-provider.mjs` | MJS | 1313 | 20 | File di progetto: profile-text-editor-provider. |
| `experiments/persistent-vault-shell/profile-text-editor-source.mjs` | MJS | 3845 | 52 | File di progetto: profile-text-editor-source. |
| `experiments/persistent-vault-shell/profile-text-editor-view.mjs` | MJS | 5129 | 61 | File di progetto: profile-text-editor-view. |
| `experiments/persistent-vault-shell/profile-text-editor.test.mjs` | MJS | 6644 | 83 | File di progetto: profile-text-editor.test. |
| `experiments/persistent-vault-shell/profile-text-handler.mjs` | MJS | 2552 | 38 | File di progetto: profile-text-handler. |
| `experiments/persistent-vault-shell/profile-text.test.mjs` | MJS | 8185 | 99 | File di progetto: profile-text.test. |
| `experiments/persistent-vault-shell/profile-widget-reader.mjs` | MJS | 4496 | 70 | File di progetto: profile-widget-reader. |
| `experiments/persistent-vault-shell/profile-widget-reader.test.mjs` | MJS | 4448 | 50 | File di progetto: profile-widget-reader.test. |
| `experiments/persistent-vault-shell/profile-widget-view.mjs` | MJS | 3479 | 50 | File di progetto: profile-widget-view. |
| `experiments/persistent-vault-shell/profile-widget-view.test.mjs` | MJS | 2931 | 38 | File di progetto: profile-widget-view.test. |
| `experiments/persistent-vault-shell/protected-session.mjs` | MJS | 7145 | 141 | File di progetto: protected-session. |
| `experiments/persistent-vault-shell/protected-session.test.mjs` | MJS | 8801 | 164 | File di progetto: protected-session.test. |
| `experiments/persistent-vault-shell/prototype.test.mjs` | MJS | 10094 | 222 | File di progetto: prototype.test. |
| `experiments/persistent-vault-shell/qr-selection-candidate-rules.mjs` | MJS | 760 | 12 | File di progetto: qr-selection-candidate-rules. |
| `experiments/persistent-vault-shell/qr-selection-contract.mjs` | MJS | 1998 | 33 | File di progetto: qr-selection-contract. |
| `experiments/persistent-vault-shell/qr-selection-contract.test.mjs` | MJS | 2001 | 30 | File di progetto: qr-selection-contract.test. |
| `experiments/persistent-vault-shell/qr-selection-editor-source.mjs` | MJS | 5094 | 66 | File di progetto: qr-selection-editor-source. |
| `experiments/persistent-vault-shell/qr-selection-editor-source.test.mjs` | MJS | 3385 | 46 | File di progetto: qr-selection-editor-source.test. |
| `experiments/persistent-vault-shell/qr-selection-editor-view.mjs` | MJS | 4838 | 63 | File di progetto: qr-selection-editor-view. |
| `experiments/persistent-vault-shell/qr-selection-editor-view.test.mjs` | MJS | 4652 | 58 | File di progetto: qr-selection-editor-view.test. |
| `experiments/persistent-vault-shell/qr-selection-handler.mjs` | MJS | 4369 | 60 | File di progetto: qr-selection-handler. |
| `experiments/persistent-vault-shell/qr-selection-handler.test.mjs` | MJS | 3421 | 48 | File di progetto: qr-selection-handler.test. |
| `experiments/persistent-vault-shell/qr-selection-save-controller.mjs` | MJS | 3853 | 66 | File di progetto: qr-selection-save-controller. |
| `experiments/persistent-vault-shell/qr-selection-save-controller.test.mjs` | MJS | 2955 | 41 | File di progetto: qr-selection-save-controller.test. |
| `experiments/persistent-vault-shell/real-lists-entry.mjs` | MJS | 2355 | 40 | File di progetto: real-lists-entry. |
| `experiments/persistent-vault-shell/render-company-summary-fixture.mjs` | MJS | 1726 | 19 | File di progetto: render-company-summary-fixture. |
| `experiments/persistent-vault-shell/router.mjs` | MJS | 1210 | 33 | File di progetto: router. |
| `experiments/persistent-vault-shell/serve.mjs` | MJS | 1577 | 21 | File di progetto: serve. |
| `experiments/persistent-vault-shell/shell-offline-preparation.mjs` | MJS | 1921 | 31 | File di progetto: shell-offline-preparation. |
| `experiments/persistent-vault-shell/shell-offline-preparation.test.mjs` | MJS | 2970 | 36 | File di progetto: shell-offline-preparation.test. |
| `experiments/persistent-vault-shell/style.css` | CSS | 2766 | 36 | File di progetto: style. |
| `experiments/sharing-key-prototype/firestore.candidate.rules` | RULES | 2077 | 50 | File di progetto: firestore.candidate. |
| `experiments/sharing-key-prototype/migration-simulator.mjs` | MJS | 2662 | 81 | File di progetto: migration-simulator. |
| `experiments/sharing-key-prototype/migration-simulator.test.mjs` | MJS | 2416 | 54 | File di progetto: migration-simulator.test. |
| `experiments/sharing-key-prototype/record-sharing-crypto.mjs` | MJS | 5927 | 139 | File di progetto: record-sharing-crypto. |
| `experiments/sharing-key-prototype/record-sharing-crypto.test.mjs` | MJS | 3663 | 70 | File di progetto: record-sharing-crypto.test. |
| `experiments/sharing-key-prototype/storage.candidate.rules` | RULES | 1707 | 53 | File di progetto: storage.candidate. |

#### firebase.json

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `firebase.json` | JSON | 4025 | 131 | Configura Hosting, header di sicurezza, emulatori, Firestore, Storage e Functions. |

#### firestore.indexes.json

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `firestore.indexes.json` | JSON | 1629 | 75 | Indici Firestore, incluso array-contains collection-group degli account condivisi. |

#### firestore.rules

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `firestore.rules` | RULES | 13806 | 282 | Autorizzazioni Firestore per proprietari, condivisioni, inviti e notifiche. |

#### functions

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `functions/.gitignore` | CONFIG | 22 | 2 | Esclusioni Git per file generati o locali. |
| `functions/account-widget-service.js` | JS | 4822 | 115 | File di progetto: account-widget-service. |
| `functions/archive-purge-receipt.js` | JS | 4070 | 64 | File di progetto: archive-purge-receipt. |
| `functions/archive-purge-reference-plan.js` | JS | 8358 | 138 | File di progetto: archive-purge-reference-plan. |
| `functions/archive-purge-service.js` | JS | 5325 | 120 | File di progetto: archive-purge-service. |
| `functions/audit-event-service.js` | JS | 16097 | 341 | File di progetto: audit-event-service. |
| `functions/audit-retention-service.js` | JS | 9983 | 205 | File di progetto: audit-retention-service. |
| `functions/backup-restore-preview.js` | JS | 3881 | 64 | File di progetto: backup-restore-preview. |
| `functions/backup-restore-receipt.js` | JS | 3329 | 51 | File di progetto: backup-restore-receipt. |
| `functions/backup-restore-service.js` | JS | 6220 | 152 | File di progetto: backup-restore-service. |
| `functions/eslint.config.js` | JS | 606 | 26 | File di progetto: eslint.config. |
| `functions/history-recovery-service.js` | JS | 1855 | 37 | File di progetto: history-recovery-service. |
| `functions/index.js` | JS | 119108 | 2269 | Backend MFA recovery, inviti, email, push e scheduler delle scadenze. |
| `functions/mutation-result-binding.js` | JS | 2990 | 49 | File di progetto: mutation-result-binding. |
| `functions/offline-sync-service.js` | JS | 1632 | 34 | File di progetto: offline-sync-service. |
| `functions/package-lock.json` | JSON | 165585 | 4435 | Lockfile riproducibile delle dipendenze npm. |
| `functions/package.json` | JSON | 651 | 27 | Runtime e dipendenze delle Cloud Functions. |
| `functions/private-account-mutation-service.js` | JS | 3428 | 66 | File di progetto: private-account-mutation-service. |
| `functions/private-account-write-scope.js` | JS | 4379 | 81 | File di progetto: private-account-write-scope. |
| `functions/recovery-security.js` | JS | 1940 | 54 | Generazione, hash e rate-limit dei codici MFA di recupero. |
| `functions/shared-vault-service.js` | JS | 7752 | 184 | File di progetto: shared-vault-service. |
| `functions/test/account-audit-trigger.test.js` | JS | 12134 | 230 | Test automatico: account-audit-trigger.test. |
| `functions/test/account-widget-bank-handler.test.js` | JS | 5625 | 94 | Test automatico: account-widget-bank-handler.test. |
| `functions/test/account-widget-service.test.js` | JS | 4719 | 84 | Test automatico: account-widget-service.test. |
| `functions/test/archive-owner-handler.test.js` | JS | 4259 | 72 | Test automatico: archive-owner-handler.test. |
| `functions/test/archive-purge-receipt.test.js` | JS | 4620 | 70 | Test automatico: archive-purge-receipt.test. |
| `functions/test/archive-purge-reference-plan.test.js` | JS | 9164 | 165 | Test automatico: archive-purge-reference-plan.test. |
| `functions/test/archive-purge-service.test.js` | JS | 5050 | 71 | Test automatico: archive-purge-service.test. |
| `functions/test/archive-receipt-handler.test.js` | JS | 14124 | 230 | Test automatico: archive-receipt-handler.test. |
| `functions/test/audit-event-service.test.js` | JS | 22938 | 369 | Test automatico: audit-event-service.test. |
| `functions/test/audit-retention-job.test.js` | JS | 9497 | 197 | Test automatico: audit-retention-job.test. |
| `functions/test/audit-retention-service.test.js` | JS | 11239 | 200 | Test automatico: audit-retention-service.test. |
| `functions/test/backup-owner-handler.test.js` | JS | 4882 | 83 | Test automatico: backup-owner-handler.test. |
| `functions/test/backup-receipt-handler.test.js` | JS | 8386 | 140 | Test automatico: backup-receipt-handler.test. |
| `functions/test/backup-restore-preview.test.js` | JS | 2173 | 31 | Test automatico: backup-restore-preview.test. |
| `functions/test/backup-restore-receipt.test.js` | JS | 4259 | 58 | Test automatico: backup-restore-receipt.test. |
| `functions/test/backup-restore-service.test.js` | JS | 4484 | 76 | Test automatico: backup-restore-service.test. |
| `functions/test/history-recovery-service.test.js` | JS | 1425 | 19 | Test automatico: history-recovery-service.test. |
| `functions/test/invite-audit-trigger.test.js` | JS | 11053 | 213 | Test automatico: invite-audit-trigger.test. |
| `functions/test/invite-notification-log.test.js` | JS | 1798 | 39 | Test automatico: invite-notification-log.test. |
| `functions/test/mutation-legacy-reason.test.js` | JS | 5152 | 98 | Test automatico: mutation-legacy-reason.test. |
| `functions/test/mutation-owner-handler.test.js` | JS | 5137 | 78 | Test automatico: mutation-owner-handler.test. |
| `functions/test/mutation-result-binding.test.js` | JS | 6270 | 93 | Test automatico: mutation-result-binding.test. |
| `functions/test/offline-sync-service.test.js` | JS | 1296 | 24 | Test automatico: offline-sync-service.test. |
| `functions/test/private-account-mutation-service.test.js` | JS | 2966 | 69 | Test automatico: private-account-mutation-service.test. |
| `functions/test/private-account-write-scope.test.js` | JS | 10953 | 165 | Test automatico: private-account-write-scope.test. |
| `functions/test/purge-profile-cleanup-handler.test.js` | JS | 4911 | 72 | Test automatico: purge-profile-cleanup-handler.test. |
| `functions/test/received-deadline-owner-handler.test.js` | JS | 4834 | 82 | Test automatico: received-deadline-owner-handler.test. |
| `functions/test/recovery-security.test.js` | JS | 1432 | 35 | Test automatico: recovery-security.test. |
| `functions/test/respond-invitation-archived.test.js` | JS | 26387 | 444 | Test automatico: respond-invitation-archived.test. |
| `functions/test/shared-vault-service.test.js` | JS | 3159 | 68 | Test automatico: shared-vault-service.test. |

#### package-lock.json

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `package-lock.json` | JSON | 457586 | 12617 | Lockfile riproducibile delle dipendenze npm. |

#### package.json

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `package.json` | JSON | 20212 | 130 | Comandi di audit, test e versione; dipendenze di sviluppo della radice. |

#### scripts

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `scripts/audit-canonical-pages.mjs` | MJS | 1211 | 29 | Strumento manutenzione/test: audit-canonical-pages. |
| `scripts/audit-data-access.mjs` | MJS | 6284 | 93 | Strumento manutenzione/test: audit-data-access. |
| `scripts/audit-docs.mjs` | MJS | 7598 | 150 | Strumento manutenzione/test: audit-docs. |
| `scripts/audit-firestore-legacy-email-metadata.mjs` | MJS | 1947 | 44 | Strumento manutenzione/test: audit-firestore-legacy-email-metadata. |
| `scripts/audit-html-purity.mjs` | MJS | 2726 | 69 | Strumento manutenzione/test: audit-html-purity. |
| `scripts/audit-js-syntax.mjs` | MJS | 1237 | 38 | Strumento manutenzione/test: audit-js-syntax. |
| `scripts/audit-lightweight-features.mjs` | MJS | 2698 | 51 | Strumento manutenzione/test: audit-lightweight-features. |
| `scripts/audit-navigation-flows.mjs` | MJS | 10558 | 132 | Strumento manutenzione/test: audit-navigation-flows. |
| `scripts/audit-offline-shell.mjs` | MJS | 3627 | 70 | Strumento manutenzione/test: audit-offline-shell. |
| `scripts/audit-page-performance.mjs` | MJS | 8063 | 147 | Strumento manutenzione/test: audit-page-performance. |
| `scripts/audit-page-shells.mjs` | MJS | 8017 | 169 | Strumento manutenzione/test: audit-page-shells. |
| `scripts/audit-project-inventory.mjs` | MJS | 8399 | 128 | Strumento manutenzione/test: audit-project-inventory. |
| `scripts/audit-release-hardening.mjs` | MJS | 2220 | 35 | Strumento manutenzione/test: audit-release-hardening. |
| `scripts/audit-security-flows.mjs` | MJS | 34248 | 301 | Strumento manutenzione/test: audit-security-flows. |
| `scripts/audit-static-references.mjs` | MJS | 2643 | 60 | Strumento manutenzione/test: audit-static-references. |
| `scripts/audit-ui-foundations.mjs` | MJS | 10399 | 139 | Strumento manutenzione/test: audit-ui-foundations. |
| `scripts/audit-vault-key-terminology.mjs` | MJS | 2059 | 34 | Strumento manutenzione/test: audit-vault-key-terminology. |
| `scripts/build-card-importer-prototype.mjs` | MJS | 561 | 17 | Strumento manutenzione/test: build-card-importer-prototype. |
| `scripts/build-offline-runtime.mjs` | MJS | 5011 | 125 | Strumento manutenzione/test: build-offline-runtime. |
| `scripts/bump-version.mjs` | MJS | 5788 | 144 | Strumento manutenzione/test: bump-version. |
| `scripts/docs-manifest.json` | JSON | 1448 | 45 | Strumento manutenzione/test: docs-manifest. |
| `scripts/docs-source-map.json` | JSON | 41866 | 1091 | Strumento manutenzione/test: docs-source-map. |
| `scripts/lib/generated-doc-section.mjs` | MJS | 927 | 17 | Strumento manutenzione/test: generated-doc-section. |
| `scripts/lib/legacy-email-audit-model.mjs` | MJS | 3871 | 66 | Strumento manutenzione/test: legacy-email-audit-model. |
| `scripts/migrate-offline-firestore-reads.mjs` | MJS | 2005 | 47 | Strumento manutenzione/test: migrate-offline-firestore-reads. |
| `scripts/normalize-responsive-foundations.mjs` | MJS | 1747 | 33 | Strumento manutenzione/test: normalize-responsive-foundations. |
| `scripts/page-performance-budget.json` | JSON | 686 | 22 | Strumento manutenzione/test: page-performance-budget. |
| `scripts/run-account-attachment-delete-emulators.mjs` | MJS | 1481 | 37 | Strumento manutenzione/test: run-account-attachment-delete-emulators. |
| `scripts/run-attachment-removal-emulators.mjs` | MJS | 1322 | 35 | Strumento manutenzione/test: run-attachment-removal-emulators. |
| `scripts/run-audit-retention-emulators.mjs` | MJS | 1178 | 27 | Strumento manutenzione/test: run-audit-retention-emulators. |
| `scripts/run-avatar-residues-emulators.mjs` | MJS | 1375 | 36 | Strumento manutenzione/test: run-avatar-residues-emulators. |
| `scripts/run-company-hard-delete-emulators.mjs` | MJS | 1321 | 35 | Strumento manutenzione/test: run-company-hard-delete-emulators. |
| `scripts/run-firestore-rules-tests.mjs` | MJS | 1443 | 31 | Strumento manutenzione/test: run-firestore-rules-tests. |
| `scripts/run-interrupted-restore-emulators.mjs` | MJS | 1319 | 35 | Strumento manutenzione/test: run-interrupted-restore-emulators. |
| `scripts/run-purge-retention-emulators.mjs` | MJS | 1447 | 37 | Strumento manutenzione/test: run-purge-retention-emulators. |
| `scripts/run-purged-account-restore-emulators.mjs` | MJS | 1322 | 35 | Strumento manutenzione/test: run-purged-account-restore-emulators. |
| `scripts/run-restore-collisions-emulators.mjs` | MJS | 1317 | 35 | Strumento manutenzione/test: run-restore-collisions-emulators. |
| `scripts/run-restore-retry-emulators.mjs` | MJS | 1308 | 35 | Strumento manutenzione/test: run-restore-retry-emulators. |
| `scripts/run-restore-stale-emulators.mjs` | MJS | 1296 | 35 | Strumento manutenzione/test: run-restore-stale-emulators. |
| `scripts/run-shared-copies-purge-emulators.mjs` | MJS | 1304 | 35 | Strumento manutenzione/test: run-shared-copies-purge-emulators. |
| `scripts/run-storage-rules-tests.mjs` | MJS | 1848 | 44 | Strumento manutenzione/test: run-storage-rules-tests. |
| `scripts/run-vault-session-emulators.mjs` | MJS | 5155 | 42 | Strumento manutenzione/test: run-vault-session-emulators. |
| `scripts/setup-linux-cloud.sh` | SH | 7927 | 156 | Strumento manutenzione/test: setup-linux-cloud. |
| `scripts/split-translations.mjs` | MJS | 2976 | 85 | Strumento manutenzione/test: split-translations. |
| `scripts/storage-emulator-loopback-dispatcher.cjs` | CJS | 1571 | 57 | Strumento manutenzione/test: storage-emulator-loopback-dispatcher. |
| `scripts/test-functions-emulator.mjs` | MJS | 2598 | 59 | Strumento manutenzione/test: test-functions-emulator. |
| `scripts/test-private-auth-browser.mjs` | MJS | 9036 | 138 | Strumento manutenzione/test: test-private-auth-browser. |
| `scripts/test-vault-assistant.mjs` | MJS | 1397 | 21 | Strumento manutenzione/test: test-vault-assistant. |
| `scripts/ui-quality-baseline.json` | JSON | 128 | 7 | Strumento manutenzione/test: ui-quality-baseline. |

#### storage.cors.json

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `storage.cors.json` | JSON | 361 | 21 | File di progetto: storage.cors. |

#### storage.rules

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `storage.rules` | RULES | 1846 | 44 | Limiti, MIME e isolamento UID degli upload Firebase Storage. |

#### stylelint.config.mjs

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `stylelint.config.mjs` | MJS | 510 | 17 | File di progetto: stylelint.config. |

#### tests

| File | Tipo | Byte | Righe | Responsabilità |
|---|---:|---:|---:|---|
| `tests/account-archive-paths.test.mjs` | MJS | 6248 | 91 | Test automatico: account-archive-paths.test. |
| `tests/account-attachment-delete.emulator.test.mjs` | MJS | 8937 | 154 | Test automatico: account-attachment-delete.emulator.test. |
| `tests/account-attachment-delete.test.mjs` | MJS | 11209 | 179 | Test automatico: account-attachment-delete.test. |
| `tests/account-detail-compact.test.mjs` | MJS | 7958 | 113 | Test automatico: account-detail-compact.test. |
| `tests/account-field-usage-model.test.mjs` | MJS | 3145 | 70 | Test automatico: account-field-usage-model.test. |
| `tests/account-mode-model.test.mjs` | MJS | 1927 | 37 | Test automatico: account-mode-model.test. |
| `tests/account-note-editor.test.mjs` | MJS | 10965 | 162 | Test automatico: account-note-editor.test. |
| `tests/account-page-lifecycle.test.mjs` | MJS | 26419 | 434 | Test automatico: account-page-lifecycle.test. |
| `tests/account-widget-lifecycle.test.mjs` | MJS | 15276 | 146 | Test automatico: account-widget-lifecycle.test. |
| `tests/account-widget-session.test.mjs` | MJS | 2312 | 31 | Test automatico: account-widget-session.test. |
| `tests/account-widget-ui.test.mjs` | MJS | 2454 | 48 | Test automatico: account-widget-ui.test. |
| `tests/archive-account-model.test.mjs` | MJS | 758 | 16 | Test automatico: archive-account-model.test. |
| `tests/archive-guest-suspension.rules.test.mjs` | MJS | 13765 | 233 | Test automatico: archive-guest-suspension.rules.test. |
| `tests/archive-list-filter.test.mjs` | MJS | 12291 | 204 | Test automatico: archive-list-filter.test. |
| `tests/archive-recipients.test.mjs` | MJS | 5667 | 101 | Test automatico: archive-recipients.test. |
| `tests/archive-session.test.mjs` | MJS | 45922 | 700 | Test automatico: archive-session.test. |
| `tests/attachment-removal-residues.emulator.test.mjs` | MJS | 8681 | 142 | Test automatico: attachment-removal-residues.emulator.test. |
| `tests/attachment-removal-residues.test.mjs` | MJS | 11751 | 181 | Test automatico: attachment-removal-residues.test. |
| `tests/attachment-security.test.mjs` | MJS | 2699 | 55 | Test automatico: attachment-security.test. |
| `tests/audit-events.rules.test.mjs` | MJS | 5208 | 96 | Test automatico: audit-events.rules.test. |
| `tests/audit-retention.emulator.test.mjs` | MJS | 19874 | 331 | Test automatico: audit-retention.emulator.test. |
| `tests/avatar-change-residues.emulator.test.mjs` | MJS | 6714 | 116 | Test automatico: avatar-change-residues.emulator.test. |
| `tests/avatar-change-residues.test.mjs` | MJS | 11002 | 197 | Test automatico: avatar-change-residues.test. |
| `tests/backup-crypto-runtime.test.mjs` | MJS | 2716 | 43 | Test automatico: backup-crypto-runtime.test. |
| `tests/backup-export-model.test.mjs` | MJS | 2662 | 49 | Test automatico: backup-export-model.test. |
| `tests/backup-export-session.test.mjs` | MJS | 8666 | 123 | Test automatico: backup-export-session.test. |
| `tests/backup-header-cleartext.test.mjs` | MJS | 10210 | 161 | Test automatico: backup-header-cleartext.test. |
| `tests/backup-import-model.test.mjs` | MJS | 5562 | 93 | Test automatico: backup-import-model.test. |
| `tests/backup-restore-session.test.mjs` | MJS | 40167 | 598 | Test automatico: backup-restore-session.test. |
| `tests/backup-restore-ui.test.mjs` | MJS | 20855 | 296 | Test automatico: backup-restore-ui.test. |
| `tests/banking-form-roundtrip.test.mjs` | MJS | 3125 | 45 | Test automatico: banking-form-roundtrip.test. |
| `tests/banking-model.test.mjs` | MJS | 2985 | 68 | Test automatico: banking-model.test. |
| `tests/banking-widget-hosts.test.mjs` | MJS | 6923 | 105 | Test automatico: banking-widget-hosts.test. |
| `tests/banking-widget-placement.test.mjs` | MJS | 7853 | 95 | Test automatico: banking-widget-placement.test. |
| `tests/company-account-detail-lifecycle.test.mjs` | MJS | 12892 | 116 | Test automatico: company-account-detail-lifecycle.test. |
| `tests/company-archive-conflict.test.mjs` | MJS | 6144 | 114 | Test automatico: company-archive-conflict.test. |
| `tests/company-detail-freshness.test.mjs` | MJS | 7249 | 105 | Test automatico: company-detail-freshness.test. |
| `tests/company-detail-readonly.test.mjs` | MJS | 9651 | 148 | Test automatico: company-detail-readonly.test. |
| `tests/company-form-archive-mount.test.mjs` | MJS | 14207 | 243 | Test automatico: company-form-archive-mount.test. |
| `tests/company-form-freshness.test.mjs` | MJS | 5063 | 69 | Test automatico: company-form-freshness.test. |
| `tests/company-hard-delete-residues.emulator.test.mjs` | MJS | 11134 | 172 | Test automatico: company-hard-delete-residues.emulator.test. |
| `tests/company-hard-delete-residues.test.mjs` | MJS | 6833 | 101 | Test automatico: company-hard-delete-residues.test. |
| `tests/company-profile.test.mjs` | MJS | 7821 | 74 | Test automatico: company-profile.test. |
| `tests/consultation-copies.test.mjs` | MJS | 13712 | 220 | Test automatico: consultation-copies.test. |
| `tests/contact-card-photo.test.mjs` | MJS | 6076 | 85 | Test automatico: contact-card-photo.test. |
| `tests/credential-health-runtime.test.mjs` | MJS | 3287 | 68 | Test automatico: credential-health-runtime.test. |
| `tests/credential-health-session.test.mjs` | MJS | 3497 | 49 | Test automatico: credential-health-session.test. |
| `tests/crypto-utils.test.mjs` | MJS | 1546 | 35 | Test automatico: crypto-utils.test. |
| `tests/deadline-config-model.test.mjs` | MJS | 2122 | 45 | Test automatico: deadline-config-model.test. |
| `tests/deadline-detail-lifecycle.test.mjs` | MJS | 22726 | 295 | Test automatico: deadline-detail-lifecycle.test. |
| `tests/deadline-model.test.mjs` | MJS | 2208 | 44 | Test automatico: deadline-model.test. |
| `tests/deadline-recipient-model.test.mjs` | MJS | 3752 | 83 | Test automatico: deadline-recipient-model.test. |
| `tests/detail-account-mode-reinvite.test.mjs` | MJS | 10094 | 173 | Test automatico: detail-account-mode-reinvite.test. |
| `tests/detail-sharing-revocation-cycle.test.mjs` | MJS | 5853 | 106 | Test automatico: detail-sharing-revocation-cycle.test. |
| `tests/device-cache-residues.test.mjs` | MJS | 19337 | 322 | Test automatico: device-cache-residues.test. |
| `tests/docs-governance.test.mjs` | MJS | 7083 | 134 | Test automatico: docs-governance.test. |
| `tests/firestore.profile-widgets.rules.test.mjs` | MJS | 7500 | 154 | Test automatico: firestore.profile-widgets.rules.test. |
| `tests/fixtures/maturity-dataset.json` | JSON | 2269 | 90 | Test automatico: maturity-dataset. |
| `tests/guest-invite-suspension.test.mjs` | MJS | 4971 | 82 | Test automatico: guest-invite-suspension.test. |
| `tests/history-recovery.rules.test.mjs` | MJS | 2366 | 30 | Test automatico: history-recovery.rules.test. |
| `tests/input-autofill.test.mjs` | MJS | 4322 | 69 | Test automatico: input-autofill.test. |
| `tests/interrupted-restore-orphan-refs.emulator.test.mjs` | MJS | 11273 | 169 | Test automatico: interrupted-restore-orphan-refs.emulator.test. |
| `tests/invite-audit-ref.rules.test.mjs` | MJS | 17757 | 298 | Test automatico: invite-audit-ref.rules.test. |
| `tests/legacy-attachment-opening.test.mjs` | MJS | 16536 | 274 | Test automatico: legacy-attachment-opening.test. |
| `tests/legacy-email-audit-model.test.mjs` | MJS | 1989 | 41 | Test automatico: legacy-email-audit-model.test. |
| `tests/maturity-dataset.test.mjs` | MJS | 1944 | 40 | Test automatico: maturity-dataset.test. |
| `tests/mixed-current.test.mjs` | MJS | 15273 | 219 | Test automatico: mixed-current.test. |
| `tests/new-account-shared-link.test.mjs` | MJS | 2601 | 33 | Test automatico: new-account-shared-link.test. |
| `tests/offline-account-widgets.test.mjs` | MJS | 6182 | 60 | Test automatico: offline-account-widgets.test. |
| `tests/offline-mutation-client.test.mjs` | MJS | 17682 | 281 | Test automatico: offline-mutation-client.test. |
| `tests/offline-mutation-lease.test.mjs` | MJS | 35436 | 516 | Test automatico: offline-mutation-lease.test. |
| `tests/offline-mutation-queue.test.mjs` | MJS | 40923 | 649 | Test automatico: offline-mutation-queue.test. |
| `tests/offline-mutation-sync.test.mjs` | MJS | 13647 | 221 | Test automatico: offline-mutation-sync.test. |
| `tests/offline-profile-readiness.test.mjs` | MJS | 5413 | 97 | Test automatico: offline-profile-readiness.test. |
| `tests/offline-sync.rules.test.mjs` | MJS | 2139 | 42 | Test automatico: offline-sync.rules.test. |
| `tests/pilot-lease-worker.test.mjs` | MJS | 21272 | 296 | Test automatico: pilot-lease-worker.test. |
| `tests/private-account-detail-lifecycle.test.mjs` | MJS | 18091 | 228 | Test automatico: private-account-detail-lifecycle.test. |
| `tests/private-account-offline-pilot.test.mjs` | MJS | 8833 | 125 | Test automatico: private-account-offline-pilot.test. |
| `tests/private-account-offline-policy.test.mjs` | MJS | 1352 | 23 | Test automatico: private-account-offline-policy.test. |
| `tests/private-account-recovery.test.mjs` | MJS | 10689 | 112 | Test automatico: private-account-recovery.test. |
| `tests/private-auth-gate.test.mjs` | MJS | 7879 | 128 | Test automatico: private-auth-gate.test. |
| `tests/private-bootstrap-offline.test.mjs` | MJS | 3194 | 50 | Test automatico: private-bootstrap-offline.test. |
| `tests/private-detail-legacy-id.test.mjs` | MJS | 18505 | 280 | Test automatico: private-detail-legacy-id.test. |
| `tests/private-form-lazy-banking.test.mjs` | MJS | 2846 | 22 | Test automatico: private-form-lazy-banking.test. |
| `tests/profile-account-management.test.mjs` | MJS | 5502 | 38 | Test automatico: profile-account-management.test. |
| `tests/profile-contact-link.test.mjs` | MJS | 29029 | 378 | Test automatico: profile-contact-link.test. |
| `tests/profile-deadline-link-model.test.mjs` | MJS | 2286 | 47 | Test automatico: profile-deadline-link-model.test. |
| `tests/profile-label-management.test.mjs` | MJS | 1039 | 19 | Test automatico: profile-label-management.test. |
| `tests/profile-lazy-editor.test.mjs` | MJS | 3248 | 73 | Test automatico: profile-lazy-editor.test. |
| `tests/profile-legacy-email-recovery.test.mjs` | MJS | 1871 | 42 | Test automatico: profile-legacy-email-recovery.test. |
| `tests/profile-model.test.mjs` | MJS | 5736 | 96 | Test automatico: profile-model.test. |
| `tests/profile-widget-zone.test.mjs` | MJS | 769 | 17 | Test automatico: profile-widget-zone.test. |
| `tests/purge-retention-effects.emulator.test.mjs` | MJS | 18365 | 289 | Test automatico: purge-retention-effects.emulator.test. |
| `tests/purged-account-restore.emulator.test.mjs` | MJS | 19611 | 283 | Test automatico: purged-account-restore.emulator.test. |
| `tests/repository-record-identity.test.mjs` | MJS | 5191 | 86 | Test automatico: repository-record-identity.test. |
| `tests/request-coordinator.test.mjs` | MJS | 1647 | 37 | Test automatico: request-coordinator.test. |
| `tests/restore-multiple-collisions.emulator.test.mjs` | MJS | 16367 | 264 | Test automatico: restore-multiple-collisions.emulator.test. |
| `tests/restore-retry-new-session.emulator.test.mjs` | MJS | 16851 | 255 | Test automatico: restore-retry-new-session.emulator.test. |
| `tests/restore-stale-preview.emulator.test.mjs` | MJS | 16220 | 247 | Test automatico: restore-stale-preview.emulator.test. |
| `tests/setup-linux-cloud.test.mjs` | MJS | 5095 | 92 | Test automatico: setup-linux-cloud.test. |
| `tests/share-revocation-paths.test.mjs` | MJS | 6640 | 102 | Test automatico: share-revocation-paths.test. |
| `tests/shared-copies-purge.emulator.test.mjs` | MJS | 11110 | 174 | Test automatico: shared-copies-purge.emulator.test. |
| `tests/shared-copies-purge.test.mjs` | MJS | 4933 | 75 | Test automatico: shared-copies-purge.test. |
| `tests/shared-credential-editor.test.mjs` | MJS | 3612 | 21 | Test automatico: shared-credential-editor.test. |
| `tests/shared-credential-update-session.test.mjs` | MJS | 4043 | 79 | Test automatico: shared-credential-update-session.test. |
| `tests/shared-record-reader.test.mjs` | MJS | 3452 | 77 | Test automatico: shared-record-reader.test. |
| `tests/shared-regrant-after-restore.test.mjs` | MJS | 10884 | 172 | Test automatico: shared-regrant-after-restore.test. |
| `tests/shared-vault-data-model.test.mjs` | MJS | 4401 | 87 | Test automatico: shared-vault-data-model.test. |
| `tests/sharing-identity.test.mjs` | MJS | 1748 | 24 | Test automatico: sharing-identity.test. |
| `tests/sharing-prototype.rules.test.mjs` | MJS | 4519 | 94 | Test automatico: sharing-prototype.rules.test. |
| `tests/sharing-prototype.storage.rules.test.mjs` | MJS | 4079 | 109 | Test automatico: sharing-prototype.storage.rules.test. |
| `tests/sharing-revocation.rules.test.mjs` | MJS | 8352 | 154 | Test automatico: sharing-revocation.rules.test. |
| `tests/sharing-two-device.test.mjs` | MJS | 4391 | 96 | Test automatico: sharing-two-device.test. |
| `tests/storage-emulator-loopback-dispatcher.test.mjs` | MJS | 1648 | 45 | Test automatico: storage-emulator-loopback-dispatcher.test. |
| `tests/storage.rules.test.mjs` | MJS | 4149 | 99 | Test automatico: storage.rules.test. |
| `tests/swipe-lifecycle.test.mjs` | MJS | 11318 | 211 | Test automatico: swipe-lifecycle.test. |
| `tests/vault-logout.test.mjs` | MJS | 4942 | 95 | Test automatico: vault-logout.test. |
| `tests/vault-session-races.test.mjs` | MJS | 10681 | 233 | Test automatico: vault-session-races.test. |
| `tests/vault-session.test.mjs` | MJS | 7595 | 145 | Test automatico: vault-session.test. |
| `tests/widget-common-picker.test.mjs` | MJS | 4738 | 40 | Test automatico: widget-common-picker.test. |

#### Duplicati esatti

- `archive/home-experiments/home-v126.html` = `archive/home-experiments/home-v127.html`
<!-- generated:files:end -->

## Prestazioni statiche generate

<!-- generated:pages:start -->
### Baseline statica delle prestazioni per pagina

> Generata con `npm run audit:pages`. Misura il peso locale inizialmente raggiungibile da HTML, CSS e grafo degli import JavaScript. Non misura rete Firebase, decifratura, rendering o prestazioni del dispositivo: questi valori richiedono il collaudo runtime P5.

Pagine canoniche analizzate: **30**. I redirect storici sono archiviati; il laboratorio temporaneo pubblico `prova.html` è escluso dal conteggio.

| Pagina | HTML | CSS | Moduli JS | Peso grezzo | Stima gzip |
|---|---:|---:|---:|---:|---:|
| `profilo_privato.html` | 1 | 7 | 43 | 1180.1 KB | 337.0 KB |
| `form_account_azienda.html` | 1 | 6 | 43 | 1162.3 KB | 333.9 KB |
| `form_account_privato.html` | 1 | 6 | 43 | 1160.8 KB | 332.8 KB |
| `dati_azienda.html` | 1 | 8 | 40 | 1107.9 KB | 321.5 KB |
| `aggiungi_scadenza.html` | 1 | 7 | 39 | 1104.6 KB | 319.2 KB |
| `dettaglio_account_privato.html` | 1 | 7 | 38 | 1101.4 KB | 318.5 KB |
| `dettaglio_account_azienda.html` | 1 | 7 | 38 | 1101.6 KB | 318.4 KB |
| `impostazioni.html` | 1 | 5 | 35 | 1116.7 KB | 318.1 KB |
| `modifica_azienda.html` | 1 | 6 | 36 | 1100.8 KB | 309.2 KB |
| `account_privati.html` | 1 | 6 | 37 | 1051.0 KB | 308.8 KB |
| `account_azienda.html` | 1 | 6 | 37 | 1044.2 KB | 307.0 KB |
| `archivio_account.html` | 1 | 6 | 34 | 1045.8 KB | 306.7 KB |
| `dettaglio_scadenza.html` | 1 | 6 | 33 | 1030.6 KB | 301.2 KB |
| `home_page.html` | 1 | 6 | 35 | 1015.3 KB | 300.1 KB |
| `area_privata.html` | 1 | 7 | 32 | 1023.4 KB | 299.3 KB |
| `scadenze.html` | 1 | 6 | 29 | 976.1 KB | 288.3 KB |
| `configurazione_automezzi.html` | 1 | 6 | 28 | 966.2 KB | 283.5 KB |
| `configurazione_generali.html` | 1 | 6 | 28 | 965.6 KB | 283.3 KB |
| `configurazione_documenti.html` | 1 | 6 | 28 | 965.8 KB | 283.3 KB |
| `lista_aziende.html` | 1 | 6 | 30 | 948.6 KB | 281.9 KB |
| `gestione_destinatari.html` | 1 | 6 | 27 | 950.1 KB | 280.9 KB |
| `registrati.html` | 1 | 5 | 25 | 938.6 KB | 278.8 KB |
| `reset_password.html` | 1 | 4 | 25 | 932.2 KB | 277.4 KB |
| `regole_scadenze.html` | 1 | 6 | 24 | 933.0 KB | 276.6 KB |
| `imposta_nuova_password.html` | 1 | 4 | 24 | 926.2 KB | 275.2 KB |
| `privacy.html` | 1 | 4 | 23 | 900.9 KB | 267.6 KB |
| `termini.html` | 1 | 4 | 23 | 898.7 KB | 267.3 KB |
| `login-v115.html` | 1 | 4 | 19 | 888.1 KB | 265.1 KB |
| `contatto_condiviso.html` | 1 | 3 | 3 | 26.0 KB | 9.2 KB |
| `index.html` | 1 | 1 | 1 | 13.5 KB | 4.4 KB |

#### Pagine con il maggiore carico statico

- `profilo_privato.html`: 337.0 KB gzip stimati, 43 moduli JS e 7 fogli CSS.
- `form_account_azienda.html`: 333.9 KB gzip stimati, 43 moduli JS e 6 fogli CSS.
- `form_account_privato.html`: 332.8 KB gzip stimati, 43 moduli JS e 6 fogli CSS.
- `dati_azienda.html`: 321.5 KB gzip stimati, 40 moduli JS e 8 fogli CSS.
- `aggiungi_scadenza.html`: 319.2 KB gzip stimati, 39 moduli JS e 7 fogli CSS.
- `dettaglio_account_privato.html`: 318.5 KB gzip stimati, 38 moduli JS e 7 fogli CSS.
- `dettaglio_account_azienda.html`: 318.4 KB gzip stimati, 38 moduli JS e 7 fogli CSS.
- `impostazioni.html`: 318.1 KB gzip stimati, 35 moduli JS e 5 fogli CSS.

#### Asset condivisi da almeno il 75% delle pagine

- `assets/css/core.css`: 3.2 KB gzip stimati, usato da 30/30 pagine.
- `assets/css/core_fonts.css`: 1.5 KB gzip stimati, usato da 29/30 pagine.
- `assets/js/theme-init.js`: 0.8 KB gzip stimati, usato da 29/30 pagine.
- `assets/js/offline-firestore.js`: 0.6 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/vendor/firebase-runtime.js`: 211.4 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/logger.js`: 0.4 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/ui-core-v129.js`: 5.1 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/dom-utils.js`: 1.6 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/translations.js`: 7.9 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/modules/core/password-policy.js`: 1.3 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/components-v129.js`: 5.1 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/firebase-config.js`: 1.3 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/footer-state.js`: 0.3 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/env-v126.js`: 0.2 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/utils.js`: 1.2 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/offline-status.js`: 0.4 KB gzip stimati, usato da 28/30 pagine.
- `assets/js/main-v129.js`: 8.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/ui-components.js`: 1.3 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/cleanup.js`: 2.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/modules/shared/company-area-preference.js`: 0.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/inactivity-timer.js`: 1.6 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/modules/core/vault-session.js`: 1.3 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/pages-init.js`: 1.1 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/offline-sync.js`: 1.7 KB gzip stimati, usato da 27/30 pagine.
- `assets/js/performance-metrics.js`: 1.4 KB gzip stimati, usato da 27/30 pagine.
- `assets/css/core_ui.css`: 6.0 KB gzip stimati, usato da 26/30 pagine.
- `assets/css/core_fascie.css`: 2.2 KB gzip stimati, usato da 24/30 pagine.

#### Regola di utilizzo

Rigenerare questa baseline prima e dopo ogni rifattorizzazione. Una riduzione statica non autorizza a cambiare sicurezza, schema dati o UX; il risultato va sempre affiancato ai test automatici e a misure runtime su iPhone e PC.
<!-- generated:pages:end -->
