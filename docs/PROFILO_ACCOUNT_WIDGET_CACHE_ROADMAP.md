# Profilo, Account, Widget e Cache — roadmap di coerenza dati

> **Stato:** blocchi implementati; inventario e gate reali ancora aperti.
> **Autorità:** roadmap specialistica; prevale la baseline sicurezza.
> **Revisione:** 17/09/2026; contratti candidati in laboratorio e non montati: contatti privati A1 (con correzione QR fail-closed) e DS-002A per le immagini dei documenti digitali. Produzione 1.2.128 (PR #68); candidata nella PR #67 ancora separata.
> **Area:** profili, collegamenti e widget.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

## Stato corrente e consegna — 16/09/2026

Riferimento operativo: [relazione di consegna](./PASSAGGIO_CONSEGNE_2026-09-16.md), con obiettivo, lavori fatti/aperti, motivi del mancato rilascio complessivo, cartelle verificate e istruzioni per il nuovo agente. Questo riepilogo aggiorna lo stato; le sezioni successive conservano la cronologia e non sono tutte istruzioni ancora da eseguire.

- **Produzione 1.2.128:** PDF aziendale pubblicato separatamente, commit `9d0f7065`, merge `4efda528`, PR #68. Suite completa, 23 test PDF e verifiche browser/asset online superati; CI 35071328912. Nessuna nuova Rules/Function o migrazione.
- **Candidata `ebf1b1fa`:** Collega/Cambia/Scollega montati; note e coda già integrate. Suite completa, 513 test shell e 109 verifiche Chrome; CI 35070097640 superata. Tutto committato e inviato prima di questa relazione, non pubblicato come shell completa.
- **Riconciliazione PDF:** completata il 16/09/2026 con confronto selettivo e senza merge. La candidata mancava solo del rilascio `9d0f7065`; generatore e lettore erano già byte-identici, riallineate la vista e il CSS `.company-pdf-*`. Dettagli nella sezione di laboratorio sotto.
- **Prossimo:** trasporto e interfaccia degli allegati dei documenti (DS-002B, in coda e non eseguibile finché Codex non lo dettaglia), contatti aziendali (A1b), poi editor indirizzi/utenze/documenti e creazione Account dal collegamento; quindi editor completi Account/Widget/banca e altri percorsi. I contratti candidati A1 e DS-002A sono in laboratorio e non pubblicati. Excel originale resta isolato a `40052515`; M5–M10 e collaudi reali ancora aperti. Non ricominciare i blocchi già conclusi nelle note storiche.
- **Motivo:** parità incompleta, trasporti/Rules di laboratorio, transizione writer e migrazione/rollback non chiusi. VS-P0-01 resta aperto in produzione. Il deploy PDF non autorizza il deploy dell'intera PR #67.
- **Cartella principale unica:** `C:/Users/Diego/Documents/Progetti/App-Codici-Password`. Le cartelle datate di Codex, i worktree temporanei e la copia `Documents/Progetti/Codici&Password` sono stati archiviati e rimossi; il file Excel resta sul ramo remoto `origin/codex/real-excel-export-preview` al commit `40052515`. Ripresa automatica in pausa per il passaggio a un altro agente.

### Riconciliazione PDF 1.2.128 — laboratorio 16/09/2026

Confronto selettivo con la produzione, senza merge né cherry-pick: rispetto a `origin/master` (`4efda528`, merge della PR #68) la candidata mancava **solo** del rilascio PDF `9d0f7065`. Gli altri file di quel rilascio divergono unicamente per il numero di versione (`?v=1.2.128` produttivo contro `?v=1.2.127` della candidata, che resta invariata per scelta e non riceve bump).

Il core era già riconciliato: generatore e lettore del laboratorio sono **byte-identici** alle controparti produttive — blob `e5cf212597c51dad3263a8b20eb77e2cd5ecc538` (`company-summary-pdf.mjs` = `scripts/pdf/company-summary-pdf.mjs`) e `8739aa92703282290a270ead73a9942eb66aec04` (`company-summary-reader.mjs` = `Frontend/public/assets/js/modules/azienda/pdf/company-summary-reader.js`). Restavano due soli delta reali, entrambi di presentazione: la vista e il relativo CSS `.company-pdf-*`. Riallineati nel laboratorio conservando i percorsi `.mjs` e la chiave Vault esclusivamente in RAM; il CSS usa i colori del laboratorio, non le variabili applicative assenti nel foglio locale.

Deliberatamente **non** portati: `company-summary-entry.js` e `company-summary-panel.js` (adapter del percorso produttivo), il bundle `vendor/company-summary-pdf.js` e il bundler `scripts/build-company-pdf.mjs`. Le differenze di percorso in `company-summary-browser.mjs` e nel test PDF sono strutturali, non funzionali. Il duplicato generatore/lettore va eliminato al cutover, quando il percorso produttivo sarà sostituito dalla shell.

Prove: 16 test PDF del laboratorio (generatore 4, lettore 7, browser 3, vista 2) e suite shell completa **513 test, 0 fallimenti** (56 file). Ambiente di test ripristinato con `npm ci` sulla cartella principale e su `functions/`: entrambi i `node_modules` erano vuoti dopo il riordino. **Nessuna nuova verifica browser/emulatore** è attribuita a questo riallineamento, che è di sola presentazione; Edge, iPhone e i gate produttivi restano invariati. Nessun dato reale, master, bump o deploy. Rollback: ripristinare i due file di laboratorio.
### Editor contatti privati (A1) — laboratorio 17/09/2026

Fetta verticale dei **soli contatti privati**, non pubblicata: contratto e allowlist dei campi, preparazione con cifratura dei soli campi già cifrati, sorgente revocabile, servizio transazionale candidato con ricevuta idempotente, editor e provider, bridge loopback, overlay Rules di laboratorio e montaggio nella linguetta Contatti. I contatti aziendali sono esclusi e restano ad A1b.

File nuovi nel laboratorio: `profile-contacts-contract.mjs`, `prepare-profile-contacts.mjs`, `profile-contacts-handler.mjs`, `profile-contacts-editor-source.mjs`, `profile-contacts-editor-view.mjs`, `profile-contacts-editor-provider.mjs` e `profile-contacts-candidate-rules.mjs`. Montaggio in `profile-shell-view.mjs` e `emulator-entry.mjs`, endpoint loopback `applyProfileContactsMutation` in `emulator-qr-bridge.mjs`; le regole candidate proteggono, oltre a `contactEmails`/`contactPhones`/`documenti`/`userAddresses`, anche `_profileContactsRevision`, `_profileContactsSchemaVersion` e `_profileContactsUpdatedAt`. `profile-link-candidate-rules.mjs` esporta i propri metadati senza cambiarne il comportamento.

Perimetro di scrittura: `contactEmails` e `contactPhones` del documento `users/{uid}`. Campi modificabili: email `label`, `address`, `note`, `password`; telefono `label`, `number`. **Nessuna ricifratura**: `note` e `password` restano cifrate, i campi non cifrati conservano il formato già memorizzato e un valore invariato non viene mai riscritto; lo svuotamento esplicito scrive stringa vuota e non cancella il campo. Solo online per le scritture: la coda M6 non è stata modificata e la consultazione offline resta invariata.

Identità: nessun ID derivato dalla posizione o dall'indice; le nuove righe ricevono `email-<uuid>`/`phone-<uuid>` da `createProfileItemId`. Le righe **senza ID persistito** restano visibili e non modificabili con messaggio esplicito, in attesa di una migrazione separata. Campi sconosciuti, legacy, `isPrimary` e i riferimenti `linkedAccountId`/`linkedAccountCompanyId` sono preservati. Revisione o impronta divergenti rifiutano l'intera transazione senza scritture parziali; la ripetizione della stessa operazione è idempotente tramite ricevuta e il riuso della ricevuta per un'altra richiesta è respinto.

Guardie di eliminazione: una riga collegata a un Account, inclusa nella selezione QR o raggiunta da un riferimento posizionale legacy non viene eliminata, coerentemente con l'esclusione dei riferimenti QR da questo incremento. `qrCodeInclusions` non viene mai modificata.

Prove: 48 nuove prove unitarie (31 contratto/preparazione/servizio, 17 sorgente/editor), due prove emulatrici con Rules candidate (ricevuta, conflitti, duplicati, guardie, corsa concorrente e la matrice fail-closed del QR con confronto di profilo, selezione e ricevute dopo ogni rifiuto) e il nuovo flusso browser nella linguetta Contatti (aggiunta con ID generato, refresh confermato, eliminazione consentita, rifiuto della riga collegata, sola consultazione offline) superato su Chrome 152 e Edge 153. `npm run test:vault-shell` 561 test, 0 fallimenti (513 di base più 48).

**Correzione fail-closed del controllo QR (secondo commit dedicato, 17/09/2026).** Una configurazione `qrCodeInclusions` che non si riesce a interpretare non è più trattata come selezione vuota: la sorgente `profile-contacts-editor-source.mjs` distingue documento assente (cancellazione consentita se il contatto non è incluso), selezione verificata e protezione non verificabile — errore di lettura o configurazione incoerente — e nel terzo caso mantiene consultazione e modifica ma disabilita tutte le cancellazioni con messaggio esplicito. Il servizio `profile-contacts-handler.mjs` valida l'intera configurazione con il contratto canonico `preparePrivateQrSelection` (tipo delle sezioni, riferimento a ID inesistente, duplicati, indici legacy non risolvibili, metadati di trasporto e versione di schema) e rifiuta l'intera operazione con `CONTACTS_QR_UNVERIFIABLE` senza toccare profilo, selezione o ricevute; un riferimento posizionale legacy che la cancellazione sposterebbe è rifiutato con `CONTACTS_QR_INDEXED`, mentre un indice risolto vale come selezione. Il divieto di cancellazione è visibile nell'editor (`profile-contacts-editor-view.mjs`).

Restano aperti: contatti aziendali (A1b); editor indirizzi/utenze/documenti e creazione Account dal collegamento; migrazione degli ID mancanti; classificazione di telefoni e indirizzi con eventuale migrazione verso maggiore cifratura (gate separato prima del rilascio produttivo); trasporto callable/App Check produttivi e transizione dei writer legacy. Limite osservato: l'editor della selezione QR (`qr-selection-editor-source.mjs`) valida ogni ID selezionabile e non tollera una riga di contatto priva di ID, quindi la fixture browser conserva ID validi e il caso senza ID resta coperto dalle prove unitarie. Rischi residui della correzione: la protezione dipende dal contratto canonico come unica autorità e non riconcilia letture divergenti della stessa impostazione; un riferimento posizionale risolvibile blocca solo le cancellazioni che lo sposterebbero; un'impostazione non leggibile disabilita le cancellazioni in modo conservativo anche quando il contatto non è incluso. **A1 resta in laboratorio e non concluso.** Rollback: rimuovere i file e il montaggio candidato, senza toccare dati, documenti o Rules produttive. Nessun deploy, nessun bump, nessun dato reale.

### Allegati dei documenti privati — contratto candidato (DS-002A) — laboratorio 17/09/2026

Confine sicuro e testabile perché un documento digitale privato (`users/{uid}.documenti[]`) possa possedere zero o più immagini cifrate, **non montato** e senza upload reali. File nuovi nel laboratorio: `profile-document-attachments-contract.mjs` (contratto, validatori, AAD contestuale, percorsi derivati), `profile-document-attachment-capability.mjs` (capacità binaria revocabile), `prepare-profile-document-attachment.mjs` (comandi immutabili e digest di operazione), `profile-document-attachments-handler.mjs` (macchina a stati, ricevuta idempotente, compensazione), `profile-document-attachments-reader.mjs` (proiezione di sola lettura). Documento tecnico: [DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md](./DS-002A_ALLEGATI_DOCUMENTI_CONTRATTO.md).

Schema candidato: metadati in `users/{uid}/profileDocumentAttachments/{attachmentId}` con `ownerId`, `documentId`, `storagePath`, `mimeType`, `size`, `digest` dei byte memorizzati, `envelope`, `status`, `schemaVersion` e `createdAt`; nessun nome originale, URL o byte. Envelope `profile-document-attachment-envelope` v1 con `AES-GCM-256` e avvolgimento `HKDF-SHA256+A256GCM`. **AAD contestuale** `CodiciPassword:profile-document-attachment:v1:<uid>:<documentId>:<attachmentId>:<storagePath>`: la costante legacy degli allegati Account **non** viene riusata e il percorso Storage `users/{uid}/profile-documents/{documentId}/attachments/{attachmentId}` è sempre derivato dal contesto autenticato, mai accettato. Limiti: sole immagini JPEG/PNG/WebP/HEIC/HEIF, 10 MiB per immagine, 10 per documento; documento con ID persistito univoco, righe senza ID o duplicate consultabili ma senza allegati e nessuna migrazione implicita.

Flusso: prenotazione transazionale dei metadati e della ricevuta → scrittura dell'oggetto opaco fuori transazione → finalizzazione; cancellazione con digest atteso e rimozione coordinata; `recover()` completa le ricevute pendenti e compensa gli oggetti orfani. Esiti dichiarati senza falsa atomicità: `confirmed`, `compensated`, `incomplete`. La proiezione di sola lettura espone i soli metadati del documento richiesto, con `available` vero solo se online e `ready`, record non verificabili in `invalid` e revoca dopo ogni attesa.

Prove: **35 nuove prove unitarie** (limiti e MIME, ID documento, iniezione di percorso, metadati sconosciuti, AAD diverso fra proprietari/documenti/allegati, revoca con plaintext azzerato, comandi senza byte/chiave/nome, retry idempotente, riuso illecito dell'operazione, scrittura fallita compensata, finalizzazione rinviata, orfano compensato, `recover()` idempotente, proiezione e revoca durante l'attesa). Nessun emulatore e nessuna verifica browser: non esiste interfaccia. Il modello **non** riusa gli allegati Account (`attachment-security.js` resta solo fotografia dei limiti legacy).

Restano aperti per DS-002B: trasporto callable con Auth/App Check e adattatori reali; sigillo binario reale; irrigidimento autorizzato di `firestore.rules:106-118` (oggi ammette la scrittura diretta del proprietario su `profileDocumentAttachments`) e decisione sul marcatore richiesto da `storage.rules:18-20`; pulsante Allegato, galleria, apertura ed eliminazione con revoca degli Object URL (le indicazioni 60 s e chiusura/blocco/logout vanno riconciliate); cestino/retention (M7), interazione con backup/ripristino (M8) e gate §16 dell'architettura. Rischi residui: l'irrigidimento più restrittivo vive nel client finché le Rules non sono autorizzate; `recover()` dipende da ricevute complete e da un trasporto che sappia elencare la collezione delle operazioni; la cifratura reale non è ancora implementata né collaudata. Rollback: rimuovere i moduli candidati, le suite e il registro in `package.json`, senza migrazioni. **Nessun dato reale, deploy, bump, modifica a master o alle Rules/Functions produttive.**

### Azioni di collegamento montate — laboratorio 16/09/2026

Successivo a `781c7974`: Collega/Cambia/Scollega usa sorgente revocabile, selettore personale/azienda con ricerca e servizio transazionale candidato. Account già associati ad altri dati restano selezionabili. Dopo conferma rilegge la stessa linguetta dal server; Annulla, navigazione e blocco puliscono selezione e risultati. Offline mostra il vincolo e non apre il selettore né salva.

Origini abilitate solo dopo verifica canonica dell'identità persistita: email, telefono, documento e utenza privata (con indirizzo padre), slot fissi email/telefono aziendali. Nessun ID inventato per righe legacy, alias o duplicati. Extra aziendali, utenze/documenti aziendali senza schema persistito e creazione Account restano aperti. Non è l'editor completo di contatti/indirizzi/documenti.

Prima della preparazione controlla la coda del vecchio e nuovo Account: stato ambiguo o pendente blocca la richiesta, senza invio/scarto automatico. Il dominio M6 rimane privato. Richiesta con UID atteso, impronta, revisione, identità composta e ricevuta; aggiunto rifiuto degli alias del padre aziendale. Retry conserva la stessa richiesta. Bridge solo loopback demo, App Check sintetico; nessuna Function produttiva esportata.

Sette nuove prove unitarie coprono origini, alias/UID, montaggio, code vecchie/nuove, retry e offline. Chrome 152: 77 verifiche entry superate, incluse dissociazione/ripristino di email, telefono, utenza, documento privato e PEC aziendale; gli altri collegamenti e le credenziali restano presenti. Controlli HTTP anonimo/token invalido anche sul nuovo endpoint. Il cambio diretto di destinazione è coperto dai test provider/servizio; il browser esercita scollegamento e ricollegamento alla destinazione condivisa originale.

Suite completa npm test superata, inclusi 513 test shell ed emulatori. Ulteriori 32 verifiche Chrome di arresto/riapertura offline superate: totale browser 109. CI del nuovo commit da verificare separatamente.

Restano i gate di trasporto produttivo, writer legacy, concorrenza fra contesti della coda, Edge/iPhone, parità editor, Excel, Widget aziendali e M5–M10. VS-P0-01 non chiuso in produzione. Rollback: rimuovere il montaggio/bridge candidato conservando dati e code. Nessun dato reale, master, bump o deploy.

### Note montate nel dettaglio e recupero coda — laboratorio 15/09/2026

Successivo a `e21202ac`: il dettaglio del laboratorio usa un selettore di percorso note. Consulta la coda privata mediante `pendingForRecord` e il lease esistente, chiude la connessione dopo la verifica e non invia/cancella nulla automaticamente. Risultato ambiguo, lease occupato, UID/Account/signal diversi e revoca non valgono come coda vuota. Per Account aziendali non consulta la coda privata omonima: il dominio M6 Account attuale è esclusivamente privato, da riesaminare quando si aggiungeranno code aziendali.

Un comando privato pendente apre il recupero M6 anche online, senza leggere una base Account ormai fuori dal vecchio sottoinsieme e senza poter preparare nuovi comandi completi. L'utente conserva retry e scarto esplicito già esistenti; nessuna conversione automatica in una nota nuova. Per un Account privato isolato compatibile resta l'editor/coda precedente. Solo errori di incompatibilità riconosciuti passano al nuovo editor della nota; errori di permesso/rete non diventano un fallback. Le verifiche del backend M6 restano invariate.

Il nuovo percorso, personale collegato/aziendale/bancario, mostra una penna con etichetta accessibile se la nota è presente e «Aggiungi nota» se è vuota. La textarea si apre su azione esplicita. Salvataggio e svuotamento rileggono il dettaglio dal server senza reload; Annulla e conferma ripristinano l'azione appropriata e puliscono il testo. Offline l'editor nuovo è consultivo. Lo svuotamento avviene dall'editor; parità UI completa, incluso eventuale comando cestino dedicato, non è dichiarata chiusa.

Bridge locale `applyAccountNoteMutation` vincolato a loopback, fixture UID/token e App Check sintetico; overlay Rules delle note/collegamenti nel laboratorio browser. Quattordici nuove prove unitarie di accesso coda/router/recupero, più aggiornamento della capability del dettaglio. Chrome: 67 verifiche entry e 32 arresto/riapertura superate (99), incluse note personali collegate e aziendali online/offline, svuotamento/ripristino, testo trattenuto, vecchia coda M6 e rifiuto HTTP anonimo/token invalido. Il recupero esplicito dopo perdita di compatibilità è testato al confine provider/router; non attribuire al browser una modifica concorrente del collegamento che quel test non esegue.

Suite completa npm test superata (506 test shell), inclusi emulatori. Aggiornata l'allowlist delle capability del test dettaglio per la nuova sola lettura `hasNote`; nessuna esposizione di chiavi o record. CI precedente `e21202ac` superata, run 35026302787. Prossimo blocco: montare sorgente/selettore e azioni Collega/Cambia/Scollega nella shell, con refresh e revoca; gli editor completi di credenziali/Widget restano distinti. App Check/callable produttivi, transizione writer, Edge/iPhone, grandi archivi e altri gate invariati. Nessun dato reale, master, bump o deploy. Rollback del montaggio: ripristinare router/bridge/overlay precedenti, conservando coda e dati.

### Sorgente e provider dell'editor nota — laboratorio 15/09/2026

Successivo a `713127a1`: sorgente della sola nota per Account personali/aziendali, con controllo del record completo e del padre aziendale prima della proiezione. Decifra soltanto la nota, confronta valore/revisione dopo le attese e prima della preparazione, invalida caricamenti concorrenti, cambio UID, blocco e revoca. Offline legge la cache in sola consultazione; disconnessione durante la preparazione impedisce la richiesta. Nessun passaggio della proiezione al vecchio writer M6.

Il provider riusa la vista testuale con etichette della nota e il controller dei retry immutabili. Salvataggio/svuotamento, Annulla e revoca puliscono textarea, valore iniziale e sorgente; il callback di conferma è il punto per ricaricare il dettaglio. Impone un controllo esplicito della coda pendente all'apertura e prima della preparazione, con UID, dominio, azienda, Account e signal catturati. Solo `true` vale come conferma; controllo mancante o ambiguo blocca il nuovo editor. Non apre, converte, elimina né ripete autonomamente operazioni della coda M6.

Dieci nuove prove per sorgente/provider/vista, comprese coda pendente, retry identico, svuotamento, scope, offline e testo trattenuto. Suite completa npm test superata (492 test shell), inclusi emulatori; nessuna nuova prova browser attribuita al provider non montato. La vista anagrafica mantiene le etichette predefinite e i test precedenti. CI precedente `713127a1` superata, run 35025323489. Provider ancora separato dal dettaglio: **prossimo adapter reale di consultazione/recupero coda, quindi montaggio note e azioni di collegamento con browser/emulatori**. Non dichiarare compatibilità finale prima di questi passaggi. Tutti i gate produttivi e gli altri residui restano aperti; nessun dato reale, master, bump o deploy.

### Note Account senza riscrittura dei collegamenti — laboratorio 15/09/2026

Successivo a `053440f7`: contratto, preparazione cifrata e servizio candidato per aggiornare soltanto la nota di un Account personale/aziendale proprietario. Include svuotamento esplicito. Nessuna serializzazione del resto dell'Account: riferimenti inversi, metadati dei collegamenti, banca, credenziali e campi sconosciuti rimangono sul record. Funziona anche dopo dissociazione con array inversi vuoti e metadati persistenti. Il vecchio writer M6 e i suoi controlli di isolamento non vengono modificati.

La richiesta contiene identità Account, UID atteso, ciphertext della nota, impronta del valore precedente, revisione e identità del tentativo. Il server verifica Auth/App Check, UID atteso, proprietà/stato e per l'azienda anche il record padre. Archiviati, condivisi, memorandum e alias sono rifiutati; banca ammessa solo perché la patch non modifica alcun campo bancario. Revisione nativa `revision`, `schemaVersion:1` e `updatedAt` gestiti dal backend, ricevuta atomica per retry identico; nota cambiata da writer legacy senza revisione provoca conflitto. Riferimenti cambiati dal servizio collegamenti sono conservati, non ricopiati dalla base dell'editor. Record legacy senza revisione partono da zero solo in questo percorso candidato; schema diverso da 1 viene rifiutato.

Overlay Rules solo nei test: impedisce modifica diretta di nota, revisione e timestamp, mantenendo le protezioni dei collegamenti. Nessun nuovo export Functions o trasporto produttivo. Otto prove unitarie coprono preservazione, svuotamento, conflitti, revoca, isolamento e retry; prova Firestore dedicata per concorrenza, Rules e metadati reali Timestamp. Suite completa npm test superata (482 test shell), inclusi emulatori; prove unitarie dedicate rieseguite dopo l'aggiunta finale dell'UID atteso, già incluso nel successivo test Firestore della suite. CI precedente `053440f7` superata, run 35024178521. Nessun dato reale o nuovo collaudo browser. Il servizio è una base di compatibilità, non un editor già montato né estensione della coda offline.

Prossimo blocco: sorgente/provider note con refresh confermato e integrazione delle azioni di collegamento. Mantenere distinti recupero della coda M6 esistente e nuovo salvataggio online; non inoltrare al vecchio writer gli Account collegati. Prima dell'attivazione restano callable/App Check, UID atteso lungo ogni trasporto, transizione writer, migrazione e rollback. Restante programma invariato; nessun master, bump o deploy. Rollback: rimuovere montaggio futuro e servizio candidato, senza eliminare o riscrivere dati.

### Selettore Account personali e aziendali — laboratorio 15/09/2026

Successivo a `0babf0c9`: lettore e vista separati per scegliere una destinazione esistente. Ricerca locale per nome Account/azienda, senza distinzione di accenti, e filtro canonico per personali o singola azienda. Nomi accompagnati dall'ambito, identità composta dominio/azienda/Account: ID uguali in raccolte diverse non vengono confusi. Un Account già collegato resta selezionabile; nessuna esclusione basata sui riferimenti inversi. La scelta consegna solo l'identità al chiamante, non salva né crea Account.

Il lettore passa dal repository canonico, con liste confermate online e cache offline. Decifra solo nome Account/ragione sociale, mai username, password o dati dei Widget. Ricontrolla la proiezione delle destinazioni dopo le decifrature; cambio UID, blocco, revoca, titolo o idoneità cambiati impediscono l'esposizione tardiva. Il backend resta autorevole al salvataggio. Limiti espliciti: 1.000 aziende, 10.000 Account complessivi letti, nomi decifrati entro 1.000 caratteri; superamenti, duplicati e ID non supportati bloccano il caricamento, senza inventare identità. Grandi archivi/paginazione remota ancora da collaudare. La vista mostra 50 risultati per volta, cerca sull'intera lista e pulisce nomi/query e listener anche nei nodi trattenuti all'uscita.

Corretto il validatore condiviso delle destinazioni: anche `isExplicitMemo` impedisce un collegamento, oltre ai flag memorandum già coperti. Verificato il rifiuto nella transazione senza modifiche parziali. Dodici nuove prove per lettore/vista e regressione backend estesa; suite completa npm test superata (474 test shell), inclusi emulatori. Nessun montaggio browser dichiarato. CI del precedente `0babf0c9` superata, run 35023283209.

Prossimo blocco: compatibilità dell'editor Account con riferimenti/metadati, poi provider/azioni e collaudo integrato nel laboratorio. Non risolvere filtrando i campi fuori dal contratto M6 o indebolendo il controllo inverso. Restano creazione Account, righe legacy/extra, editor profilo restanti e gate sotto. Nessuna modifica produttiva, dati reali, master, bump o deploy. Rollback del selettore isolato; conservare il controllo aggiunto sui memorandum.

### Sorgente revocabile dei collegamenti — laboratorio 15/09/2026

Successivo a `8d5be66d`: sorgente candidata per caricare la relazione e preparare Collega/Cambia/Scollega, riusando la proiezione canonica del servizio. Conserva in RAM solo identità, revisione e impronta; nessuna decifratura del contatto o delle credenziali. La lettura online è confermata, quella offline consultiva. Prima di preparare la richiesta rilegge l'origine e verifica anche modifiche legacy senza revisione. Richiesta e destinazione sono copie immutabili; revoca, cambio UID, alias aziendale e caricamenti concorrenti invalidano il lavoro. Il backend resta responsabile dell'idoneità della destinazione nella transazione.

Compatibilità verificata nel codice: `prepare-private-account-patch.mjs` e `prepare-private-account-mutation.mjs` ammettono un sottoinsieme chiuso che esclude i nuovi metadati e riferimenti; `private-note-panel-provider.mjs` richiede assenza esplicita di relazioni. Anche `functions/private-account-write-scope.js` rifiuta relazioni attive e controlla le origini inverse. Nessuna rimozione di questi controlli o filtraggio dei metadati per aggirarli. Dopo una dissociazione, i metadati persistenti richiedono comunque evoluzione del contratto editor: non basta che gli array siano vuoti. Il montaggio UI resta da completare insieme alla compatibilità del writer.

Sei nuove prove automatiche della sorgente: entrambi i domini, richiesta immutabile senza segreti, dissociazione, offline, modifiche concorrenti/legacy, proprietà e revoca. Suite completa npm test superata (462 test shell), inclusi emulatori. Primo avvio bloccato dai permessi sandbox del compilatore, rieseguito con permessi approvati; nessuna correzione runtime per aggirare il limite ambientale. Nessuna nuova prova browser: sorgente non ancora montata. CI precedente `8d5be66d` superata, run 35022208948. Nessun dato reale, master, bump o deploy. Prossimo blocco: selettore ricercabile e adattatori della shell, con compatibilità editor esplicita; invariati gli altri gate sotto.

### Collegamenti Account: transazione e riferimenti inversi — laboratorio 15/09/2026

Successivo a `520aafd2`: preparato un servizio candidato per collegare un Account esistente, cambiarlo o dissociarlo. Origini private: email, telefono, documento e utenza con ID persistito e, per l'utenza, ID dell'indirizzo. Origini aziendali di questo incremento: tre slot email fissi e telefono/fax/cellulare referente. Destinazioni personali o aziendali del medesimo UID; un Account già usato da un altro contatto resta selezionabile. Nessuna creazione Account o copia di username/password.

Riutilizzati tramite dipendenza esplicita i modelli puri canonici profile-model/company-profile-model. Transazione unica su origine, vecchio e nuovo Account e ricevuta: verifica proprietà, stato/dominio, impronta del contatto, relazione attesa e revisione; preserva i riferimenti degli altri numeri e delle altre aziende. I riferimenti privati sono ricavati dalla fonte autorevole del profilo, quelli aziendali mantengono gli altri riferimenti canonici. Revisione/schema/timestamp dei riferimenti aggiornati dal backend su ciascun record interessato. Retry non duplica modifiche; payload diverso con la stessa identità è un conflitto.

Account destinazione archiviati, condivisi, memorandum, ospiti o con alias di identità non verificato sono rifiutati. La dissociazione può pulire un vecchio Account archiviato o mancante, conservando credenziali, dati del contatto e stato di archivio. Identità duplicate, forme inverse sconosciute e impronte con tipi non JSON sono rifiutate. Nessuna assegnazione automatica di ID o trasferimento di credenziali legacy.

Overlay Rules solo nei test: chiude le scritture client dei contenitori di relazioni del profilo, dei riferimenti inversi e metadati, oltre alla cancellazione diretta dei record coinvolti. Gli altri permessi legacy non sono certificati da questo test. Test dedicato negli emulatori aggiunto alla suite completa: due origini diverse possono aggiornare lo stesso Account senza perdere riferimenti; due richieste concorrenti sulla stessa origine non sovrascrivono silenziosamente. Undici prove unitarie e integrazione demo; suite completa npm test superata (456 test shell). CI del precedente `520aafd2` superata, run 35020531459. Nessuna nuova prova browser attribuita.

Prossimo blocco: sorgente/selettore Account e azioni Collega/Cambia/Scollega revocabili nel laboratorio, con rilettura confermata. Il montaggio deve mantenere esplicita la compatibilità degli editor Account con i nuovi metadati/riferimenti, senza scartarli per rientrare nel vecchio sottoinsieme M6. Email aggiuntive aziendali e righe senza ID richiedono completamento della gestione identità; documenti/utenze aziendali richiedono schema canonico prima della scrittura. Packaging dei modelli, callable/App Check produttivi e migrazione writer restano aperti. Nessun export Functions, modifica Rules produttive, dato reale, master, bump o deploy. Rollback limitato a servizio/contratto candidato, overlay e test.

### Editor anagrafica nella shell — laboratorio 15/09/2026

Successivo a `6cca03f5`: Modifica anagrafica apre un editor comune nel profilo privato e aziendale, con i soli campi del contratto testuale. Note tramite textarea, altri dati tramite normali campi testo; nessun campo password o valore di credenziali collegate. La sorgente legge la base confermata online/cache offline, decifra soltanto i campi anagrafici consentiti e confronta di nuovo la proiezione dopo le attese. Offline i valori restano consultabili, con salvataggio disabilitato e senza promessa di draft persistente.

Invia solo i campi effettivamente cambiati, compreso lo svuotamento esplicito della nota. Il ciclo comune assegna l'identità del tentativo prima della preparazione, conserva soltanto la richiesta cifrata per retry e non cambia certezza dopo la revoca. Dopo conferma il pannello rilegge dal server la stessa linguetta senza reload del documento, mostrando subito la modifica; Annulla torna alla consultazione. Uscita/cambio linguetta/blocco cancellano valori correnti, defaultValue e originali trattenuti nei controlli. Risposte tardive non riaprono la vista.

Provider e bridge limitati al laboratorio; overlay Rules applicato dopo il seed. Nessun nuovo export nelle Functions o modifica delle Rules produttive. Undici nuove prove unitarie di sorgente, vista e refresh; regressioni dei controller QR privato/aziendale. Suite completa npm test superata (445 test shell); Chrome 62 verifiche entry e 32 arresto/riapertura superate. Incluse modifica/rilettura immediata e svuotamento note nei due domini, controlli testuali, editor offline dopo riavvio, pulizia dei nodi e richieste anonime/token invalidi respinte. CI del precedente 6cca03f5 superata, run 35019009364. Il primo test browser anticipava la lettura della nota durante il caricamento dopo Annulla: corretta l'attesa del test fino al completamento della consultazione, senza ripristinare dati vecchi nell'interfaccia.

Restano editor contatti/indirizzi/documenti e creazione/cambio/dissociazione dei collegamenti, selezione delle righe QR aggiuntive, Widget aziendali, Excel e M5–M10. Per i collegamenti riusare lo schema canonico e le verifiche inverse già esistenti, senza nuovo writer client multi-documento. Callable/App Check e transizione writer legacy, Edge/iPhone restano gate separati. Rollback limitato a sorgente/provider/vista, montaggio e adattamento del ciclo comune; nessun dato reale, master, bump o deploy.

### Anagrafica cifrata: preparazione e transazione — laboratorio 15/09/2026

Successivo a `7bb38823`: preparato il confine per modificare i testi anagrafici già consultabili, incluse le note, senza coinvolgere contatti o collegamenti. Allowlist privata: nome, cognome, luogo/data di nascita e note. Allowlist aziendale: ragione sociale, forma giuridica, partita IVA, SDI, CCIAA, data iscrizione, nome/cognome/ruolo referente e note. Telefoni, email, indirizzi, documenti, permessi e relazioni Account restano fuori da questa mutazione.

La preparazione usa la cifratura della sessione esistente, senza nuova crittografia o accesso alle chiavi. Controlli di UID/segnale/Vault prima e dopo gli await; input copiati prima dell'attesa. Limiti 1.000 caratteri per campo e 20.000 per nota, 200.000 caratteri cifrati complessivi. Il testo vuoto è una cancellazione esplicita del solo contenuto, non del record. I vecchi valori eventualmente in chiaro vengono confrontati mediante impronte calcolate localmente: né vecchio né nuovo plaintext entra nella richiesta.

Servizio candidato con transazione del record e ricevuta: destinatario derivato da UID e dominio, revisione e schema separati per l'anagrafica, timestamp backend, impronte dei soli campi modificati e confronto anche contro writer legacy che non incrementano revisioni. Patch dei soli campi scelti, nessuna riscrittura di contatti o collegamenti; retry della stessa richiesta non duplica la revisione. Il server valida struttura/dimensioni del ciphertext, non può certificarne la decifrabilità senza la chiave.

Overlay Rules solo nei test: campi anagrafici/metadati e cancellazione del record non scrivibili direttamente dal client. Mantiene distinti gli altri permessi legacy, che non sono certificati da questo blocco. Nuovo comando test:profile-text-emulators incluso in npm test, sempre sul progetto demo loopback. Dodici prove unitarie incluse revoche durante cifratura, vuoto, esclusione plaintext e round-trip con la cifratura reale dell'app; test emulatori privato/azienda con concorrenza, retry, scrittura diretta negata e modifiche legacy. Suite completa npm test superata (434 test shell); nessuna nuova prova browser attribuita al servizio non montato. CI del precedente 7bb38823 superata, run 35017732264.

Nessun editor o adapter HTTP montato, nessun export produttivo nelle Functions. Prossimo blocco: sorgente/editor anagrafica revocabili e montaggio nel laboratorio, poi collegamenti e parità restante. Migrazione/rollback produttivi e transizione dei writer legacy restano da progettare prima dell'attivazione; nessuna migrazione automatica o modifica di dati reali. Rollback limitato ai moduli candidati e al runner/test. Nessun master, bump o deploy.

Selezione QR delle righe aggiuntive ancora aperta: il form legacy usa fallback extra-indice/sede-indice quando manca un ID persistito; il nuovo writer non deve trattarli come identità stabili né assegnarli implicitamente. Verificare contratto/migrazione delle identità prima di completare quel sottoblocco. Continuare le attività indipendenti dell'anagrafica senza nascondere questo limite.

### Editor QR aziendale montato — laboratorio 15/09/2026

Successivo a `81cc50d6`: Modifica selezione nella tessera aziendale apre lo stesso editor del profilo privato, con i quattordici flag aziendali. Sorgente dedicata e provider senza writer alternativo; nessun valore aziendale, password o foto viene decifrato per mostrare queste etichette. Consultazione della selezione in cache offline; preparazione del salvataggio solo online con rilettura confermata, controllo UID/proprietà/archivio, identità dell'azienda e confronto della configurazione precedente.

Controller comune mantiene un solo tentativo in RAM e ritenta la stessa richiesta immutabile; formato aziendale separato da quello privato, senza array privati o revisione client aggiunta al payload. Revisione attesa verificata sulla configurazione precedente. Sorgente, etichette e richieste pendenti vengono revocate alla chiusura; una scrittura già accettata dal backend non viene presentata come annullabile. Il trasporto HTTP del laboratorio estende le stesse verifiche token/origine/UID delle fixture al servizio aziendale; overlay Rules aziendale applicato dopo il seed.

Otto nuove prove unitarie di sorgente/vista, con regressioni del controller privato; integrazione Firestore demo estesa al percorso sorgente-controller-servizio aziendale con risposta persa, retry e rilettura. Suite completa npm test superata (422 test shell); Chrome 58 verifiche entry e 32 arresto/riapertura superate, incluse selezione/salvataggio/rilettura aziendale, QR col telefono scelto, consultazione editor offline anche dopo riavvio, pulizia e rifiuto di richieste anonime/token invalidi. Edge e iPhone restano aperti. CI del precedente `81cc50d6` superata, run 35016571406; distinta dai collaudi di questo incremento.

Limiti invariati: selezione delle email aggiuntive e altre sedi non modificabile da questo editor, foto aziendale non implementata, nessun draft persistente offline. Callable/App Check produttivi e migrazione writer legacy restano aperti; il bridge sintetico non li sostituisce. Proseguire con parità dei profili/collegamenti e selezione delle righe aggiuntive secondo schema canonico, mantenendo Widget aziendali, Excel, Edge/iPhone e M5–M10. Nessun dato reale, master, bump o deploy. Rollback limitato a provider/sorgente, adattamento controller/vista, bridge e montaggio sperimentali.

### Selezione QR aziendale: confine transazionale — laboratorio 15/09/2026

Incremento successivo alla scheda PDF `a2a0252a`: preparati contratto e servizio backend candidato per i quattordici flag fissi di `qrConfig`. Distinzione esplicita tra configurazione assente (nessuna scelta implicita) e configurazione legacy esistente; telefono aziendale, email amministrativa e personale mantengono opt-in. Payload solo booleani, identificatore azienda/operazione e configurazione precedente, mai valori di contatto o credenziali. Campi sconosciuti non vengono scartati: la richiesta viene rifiutata.

Transazione su azienda e ricevuta: verifica UID attendibile, proprietà, archivio, revisione e configurazione precedente completa; il confronto canonico rileva anche modifiche legacy senza incremento di revisione, senza falsi conflitti per ordine delle chiavi. Aggiorna esclusivamente `qrConfig`, preservando email, sedi, password cifrate e gli altri dati. Ricevuta legata a UID, azienda e digest della richiesta; retry non incrementa nuovamente la revisione. Copia del payload prima del primo await per impedirne il cambio durante l'hash.

Overlay Rules soltanto negli emulatori: chiude creazione, sostituzione, modifica annidata e rimozione client di `qrConfig`; conserva le autorizzazioni precedenti degli altri campi e delle sottoraccolte. **Non protegge ancora i flag `qr` dentro email aggiuntive e altre sedi**, che questo servizio non modifica. Nessuna esportazione nelle Functions, montaggio browser o modifica delle Rules produttive. Non è una chiusura generale dei writer aziendali.

Dieci prove unitarie superate; test transazionale su Firestore demo superato con due salvataggi concorrenti (uno solo confermato), retry, conflitto legacy, isolamento proprietario, ricevuta non falsificabile e preservazione dei campi. Suite completa npm test superata (414 test shell); nessuna nuova prova browser attribuita. CI della precedente scheda PDF `a2a0252a` superata, run 35015683279: non sostituisce i test del nuovo incremento.

Prossimo blocco: sorgente/editor revocabili e montaggio dei flag fissi aziendali; mantenere separati selezione delle righe aggiuntive, App Check/callable produttivi e transizione dei writer legacy. Migrazione dati non eseguita né necessaria per il laboratorio; rollback rimuove moduli candidati, overlay e prove. Nessun dato reale, master, bump o deploy. Restano editor/collegamenti, Widget aziendali, Excel e gli altri gate del piano.

### Editor QR montato nel browser — laboratorio 15/09/2026

Successivo a `fb207a4e` (richiesta PDF registrata separatamente in `45110a0e`): Modifica selezione apre l'editor privato nella tessera. Il trasporto locale verifica token Firebase dell'emulatore, UID nella lista delle sole fixture, origine/host esatti e limite del corpo; attestazione sintetica confinata al laboratorio, senza valore di enforcement produttivo. Overlay Rules condiviso tra browser e test transazionali, applicato dopo il seed sintetico, impedisce scritture client della selezione. Nessun nuovo export nelle Functions o modifica di firestore.rules.

Corretto il caricamento dei metadati canonici: il repository aggiunge id al documento, ora validato come qrCodeInclusions e rimosso dalla proiezione delle preferenze. La vista chiude anche editor completati dopo la revoca. Due regressioni, suite completa `npm test` superata (388 shell); Chrome 58 entry + 32 arresto/riapertura, incluse selezione/salvataggio/rilettura, consultazione editor offline e dopo riavvio, pulizia etichette e richieste senza credenziali/con token invalido respinte. CI del precedente `fb207a4e` superata, run 35010296381; non sostituisce i test browser del nuovo incremento.

Gate produttivo ancora aperto: callable reale con App Check, transizione dei writer legacy, migrazione/rollback e collaudi Edge/iPhone. Nessuna promessa di draft persistente offline. Nessun dato reale, master, bump o deploy. Prossimo blocco richiesto: scheda PDF aziendale; mantenere separati i residui selezione aziendale, foto e altri editor del piano.

### Scheda PDF aziendale nella shell — candidata 15/09/2026

Implementa la richiesta registrata in `45110a0e`, dopo il montaggio QR `d62e74d8`. Nuova linguetta Scheda PDF nel profilo aziendale con scelta per gruppi (azienda, fiscale, referente, contatti, sedi), preparazione esplicita, anteprima testuale dei dati selezionati, download e condivisione nativa del file quando supportata. Condivisione invocata dal clic dopo la preparazione, senza invio automatico; fallback download quando il dispositivo non condivide file.

Lettore dedicato con UID, sessione, confronto finale del record e proiezione minima: non decifra né passa password, PIN, note riservate, dati bancari, link Account o allegati. PDF generato localmente con pdf-lib 1.17.1 e fontkit 1.1.1 fissati; font Liberation incorporati con licenza SIL inclusa. Generatore separato caricato su richiesta. Cache conserva solo codice/font pubblici; PDF e anteprime restano nella vista, buffer azzerati e URL revocati all'uscita/cambio selezione. File già scaricati/condivisi sono copie esterne, non revocabili dalla sessione.

Sedici nuove prove, suite completa `npm test` superata (404 shell). Chrome 58 entry + 32 arresto/riapertura: generazione online/offline, prima visita dopo riavvio offline, esclusione segreti, download pronto e pulizia anteprima. Le azioni di download/condivisione sono verificate anche con adapter simulati; nessun messaggio reale inviato. PDF sintetico di tre pagine renderizzato e ispezionato integralmente; accenti e tutte le 75 frasi del testo lungo preservati. Output QA esclusi da Git. Risolto il recupero font nella seconda visita offline senza conservare dati utente.

Limiti aperti: condivisione/download su iPhone reale e destinazioni WhatsApp/email, Edge locale, caratteri non presenti nel font (rifiutati, mai sostituiti silenziosamente). Anteprima in app testuale; il layout PDF è collaudato tramite fixture renderizzata. Selezione attuale per gruppi, non singoli campi. Nessun dato reale, master, bump o deploy. Rollback limitato ai moduli PDF, montaggio/assets sperimentali e dipendenze aggiunte. Riprendere il programma dal gate adapter/rollout QR e dagli editor profili/collegamenti, mantenendo aperti selezione aziendale, Widget aziendali ed Excel.

### Scheda PDF aziendale — richiesta originaria 15/09/2026

Diego richiede un PDF di riepilogo dei dati aziendali da salvare sul telefono o inviare tramite WhatsApp/email. Prevedere scelta dei campi, anteprima, download e condivisione nativa del file quando supportata; fallback download, nessun invio automatico o pubblicazione su URL pubblico. Contenuto: identità/dati fiscali, referente, sedi, email e telefoni. Password, PIN/PUK, credenziali degli Account collegati, chiavi, note riservate e allegati esclusi dalla proiezione; non basta mascherarli graficamente dopo averli caricati nel generatore.

Generazione sul dispositivo tramite lettore revocabile e proiezione consentita. Verificare pulizia di anteprime/URL temporanei, limiti, accenti, campi vuoti, testi lunghi, impaginazione e più pagine con fixture sintetiche. Le copie che l'utente scarica/condivide restano esterne alla revoca della sessione. Collaudo iPhone e destinazioni di condivisione separati dai test automatici. Implementazione ancora aperta; inserita dopo il consolidamento del montaggio QR, senza saltare il resto degli MD o autorizzare deploy.

### Editor selezione QR revocabile — laboratorio 15/09/2026

Successivo a `686b1f1c`: sorgente dedicata carica solo etichette dei contatti e selezione, senza password, immagini o dati collegati. Risolve gli indici legacy in ID, verifica tutti i riferimenti e confronta snapshot/revisione/selezione prima della preparazione. La consultazione può usare cache offline; il salvataggio richiede connessione. Il controller conserva in RAM un solo tentativo immutabile, impedisce un secondo invio distinto con esito incerto e ripete lo stesso ID; revoca e cambio UID impediscono invii tardivi. Un invio già accettato dal backend può concludersi dopo l'uscita, senza aggiornare una vista dismessa.

Vista con checkbox, Salva e Riprova, stati distinti e pulizia dei nodi trattenuti. Scelte incomplete non eliminano silenziosamente contatti selezionati. Provider composto pronto, ma **non montato nel bootstrap browser**: richiede esplicitamente un adapter attendibile e non ha writer alternativo. Restano adapter callable reale, attestazione HTTP, transizione Rules/writer legacy, montaggio e prove browser. Nessuna persistenza del draft offline o ripresa dopo arresto dichiarata.

Sedici prove aggiuntive (sorgente/controller/vista), suite completa `npm test` superata (386 shell). Test Firestore demo esteso al percorso sorgente-controller-servizio: risposta persa dopo commit, retry idempotente, revisione incrementata una sola volta e rilettura della selezione aggiornata. Il contesto App Check resta sintetico. Nessun nuovo collaudo Chrome/Edge/iPhone attribuito all'editor. Nessun dato reale, master, bump o deploy; rollback dei moduli sperimentali e delle prove. Proseguire con adapter e collegamento browser senza dichiarare chiuso il gate di attivazione.

### Preparazione salvataggio selezione QR — laboratorio 15/09/2026

Successiva a `5fc9c8f2`: contratto privato con soli flag booleani e riferimenti stabili, migrazione degli indici sullo snapshot dell'editor e rifiuto di righe rimosse/ambigue. Servizio backend candidato salva selezione e ricevuta nella stessa transazione, valida UID/App Check forniti dal futuro adapter attendibile, revisione, esistenza dei riferimenti e digest del tentativo. Ripetere lo stesso tentativo restituisce la conferma precedente; payload diverso, revisione obsoleta o configurazione sconosciuta non sovrascrivono dati. Nessun contenuto dei contatti o chiave entra nella richiesta/ricevuta.

La matrice della baseline richiede un backend per questa operazione con ricevuta multi-documento. L'overlay Rules di laboratorio esclude settings dalla regola generica e vieta la scrittura diretta di qrCodeInclusions, mantenendo le altre preferenze proprietario. **Overlay non applicato a firestore.rules e servizio non esportato dalle Functions:** il writer produttivo legacy resta permissivo e non costituisce una barriera valida per il nuovo flusso. Prima di abilitare il salvataggio shell occorrono adapter callable con attestazione reale, chiusura dei writer legacy e piano di compatibilità/migrazione/rollback. Il test usa un contesto App Check sintetico, non dimostra enforcement HTTP.

Sette test unitari aggiunti, suite completa `npm test` superata (370 shell), più test integrato Firestore demo: scrittura atomica, un solo vincitore fra due richieste concorrenti, retry invariato, contatto rimosso senza ricevuta, accessi altrui e scritture client negate, altre preferenze ancora utilizzabili. Test incluso nella suite tramite `test:qr-selection-emulators`. Nessuna nuova prova browser o modifica dei dati reali; nessun bump, master o deploy. Proseguire con controller/editor revocabili e preparazione dell'adapter, mantenendo esplicito il gate di attivazione. Foto e selezione aziendale restano aperte.

### Telefono aziendale nel QR — candidata 15/09/2026

Successivo a `e7f70061`: il generatore canonico supporta `telefonoAzienda` con flag booleano esplicito omonimo. Il nuovo campo resta escluso nelle configurazioni precedenti e finché non viene selezionato; il lettore shell non lo decifra prima della selezione. Aggiunta la scelta alla pagina aziendale canonica, distinta dal cellulare referente. Escape CR/LF mantenuto, nessuna modifica ai dati o ai flag esistenti.

Due regressioni aggiuntive e suite completa `npm test` superata (363 shell). Nessuna nuova prova browser attribuita a questo piccolo incremento: i 90 controlli Chrome precedenti restano riferiti a `e7f70061`. Editor selezione nella shell, foto aziendale e prove fisiche restano aperti. Nessun bump, master o deploy; rollback dei cinque file di codice/test senza migrazioni.

### Tessera digitale aziendale nella shell — candidata 15/09/2026

Successiva a `104aefc9`: stessa linguetta e comandi QR/download del profilo privato, con lettore aziendale dedicato e generatore canonico `buildCompanyVCard`. Richiede una configurazione `qrConfig` salvata; al suo interno conserva i default legacy del modello (amministrazione/personale esclusi salvo selezione). Email extra e sedi rispettano il proprio flag `qr`. Configurazione assente o malformata impedisce la generazione: non viene creata una selezione implicita.

Decifra solo la proiezione inclusa: identità aziendale/referente, email, sedi e dati fiscali scelti. Password, collegamenti, note libere e allegati non raggiungono il generatore. Sorgenti confermate online/cache offline, UID e revoca prima/dopo await, confronto finale del record per rifiutare modifiche concorrenti. Nessuna scrittura o fallback ai dati del profilo privato. Il modello aziendale corrente non comprende foto né telefono aziendale generico nel vCard: questo limite canonico rimane aperto per il successivo editor/parità, senza inventare nuovi flag in questo incremento.

Sette test aggiunti, suite completa `npm test` superata (362 shell). Chrome: 58 entry + 32 arresto/riapertura, con QR aziendale online/offline, prima visita dopo riavvio, esclusione email non selezionata e pulizia canvas/title. Edge, iPhone e importazione/download fisici restano da collaudare. Nessun dato reale, modifica master, bump o deploy; rollback limitato a lettore e montaggio sperimentali. Proseguire con editor selezione/profili e parità dei campi, poi Widget aziendali con schema/Rules dedicati.

### Tessera digitale privata nella shell — candidata 15/09/2026

Successiva a `f439cb61`: linguetta privata con generazione QR e download vCard come azioni esplicite sulla selezione già salvata. Lettore con sorgenti confermate online/cache offline, controllo UID/sblocco/segnale e confronto finale dei record. Selezione mancante, riferimenti ambigui o modifica concorrente impediscono il risultato. Solo campi selezionati vengono proiettati; i Widget segreti non vengono decifrati né esportati. Nessuna scrittura dei dati o della selezione.

Anteprima con solo QR; uscita/blocco cancellano pixel, immagini e attributo title anche sui nodi trattenuti. La foto è inclusa solo se selezionata e tramite URL HTTPS del profilo, senza fallback alla foto Auth né caricamento dei byte. Il payload con foto usa il ricevitore pubblico canonico esistente: la generazione locale non apre il ricevitore, non carica dati sul server e non ne certifica il comportamento. Download e importazione rubrica su dispositivo fisico restano da collaudare.

Dodici nuove prove, suite completa `npm test` superata (355 test shell). Chrome: 58 verifiche entry e 32 arresto/riapertura superate, con asserzioni QR online/offline, prima generazione dopo riavvio offline e pulizia al cambio linguetta. Edge e iPhone restano aperti. Nessun dato reale, master, bump o deploy. Rollback limitato ai moduli e al montaggio sperimentali, asset QR del laboratorio ed export repository aggiuntivo.

Prossimi blocchi: tessera aziendale con modello/selezione canonici, editor della selezione e dei profili, estensione Widget aziendali con schema/Rules dedicati. Questo incremento non completa la parità né chiude il programma MD.

## Stato corrente verificato — 12/09/2026

La fotografia del 10/09 e i blocchi successivi sono cronologia: le descrizioni “non esiste” o “non conosce” valgono per quella tappa, non per il runtime 1.2.110.

| Area | Stato attuale e limite |
|---|---|
| Read-your-writes | `afterWrite` e sorgenti server esplicite implementati; le letture ordinarie restano cache-first |
| Allegati aziendali | Contesto proprietario e sola lettura corretti; nessuna estensione implicita dei permessi |
| Widget e Credenziali comuni | Runtime, scope backup e servizi backend presenti; i vecchi paragrafi di predisposizione non sono lo stato attuale |
| Profili privato/azienda | Linguette e composizioni condivise, con dati specifici del dominio |
| Collegamenti | Selezione/creazione Account, riuso, cambio e scollegamento disponibili nei flussi implementati |
| Tessera digitale | Ricevitore pubblico con foto e riepilogo dei dati selezionati; segreti esclusi |
| Dati legacy | Nessuna cancellazione globale autorizzata; inventario e verifica dei trasferimenti restano distinti dalla UI |

Il codice corrente è il riferimento per la disponibilità dei comandi, non una prova di migrazione di tutti i dati. I collaudi fisici e i gate non registrati restano aperti.

> Le diciture “implementato”, “testato” e “attivo” devono essere lette nel perimetro indicato. Non equivalgono a verifica dei dati reali o della configurazione Firebase pubblicata. Per ogni widget, il percorso diretto/Function segue la matrice della baseline: singolo record con Rules complete può essere diretto; collegamenti multi-documento e credenziali comuni richiedono Function.

## Scopo e stato

### Confine vCard prima della tessera shell — candidata 15/09/2026

Successiva a `cc6ff020`: il generatore vCard condiviso applica autonomamente l'allowlist dei tipi testuali esportabili dei Widget. Non basta più `encrypted !== true`: esclude tipi segreti/allegati/foto/sconosciuti, sensibilità `secret`, cifratura ambigua e residui `valueEnc`; conserva il tipo testuale legacy senza flag di cifratura se privo di tali ambiguità. I valori non esportabili vengono omessi senza cambiare il record. I collegamenti strutturati Account/indirizzo non vengono esportati come testo libero: la loro eventuale rappresentazione richiede una proiezione esplicita successiva.

Escape uniforme CR/LF anche per data di nascita e vecchi campi Contatti delle Impostazioni: un valore non può aggiungere nuove proprietà vCard. Due regressioni aggiunte, 141 test profilo e suite `npm test` completa superati (343 shell). Nessuna nuova prova browser attribuita a questa correzione pura. Non è ancora la tessera digitale montata nella shell: restano sorgente delle inclusioni, proiezione selettiva revocabile, foto online, generazione/anteprima, modifica selezione e download esplicito. Il comportamento cambia solo nella candidata, senza dati reali, Rules, bump, master o deploy. Proseguire da tale adapter, senza reintrodurre gli editor QR legacy.

### Widget del profilo nella shell — candidata 15/09/2026

Successiva a `16dae6f1`: i Widget personali sono montati nella linguetta canonica, anche quando la sezione non contiene altri dati. Lettore dedicato su `users/{uid}/profileWidgets`, con nuova lettura repository confermata online e cache offline; nessun editor/gestore chiave legacy. Modello canonico e validazione puntuale dei campi, ID duplicati, proprietario, contesto e tipi sensibili; letture rivalidate dopo la decifratura e invalidate da modifica/spostamento/rimozione o cambio sessione. Il metadato conserva ordine, collasso, anteprima e copia senza valori o ciphertext.

Il collasso nella shell è solo locale alla vista: aprire/comprimere non scrive nel database. Widget chiusi e campi con anteprima disabilitata non vengono letti anticipatamente. Mostra/nascondi è esplicito; copia solo per campi non cifrati con autorizzazione nel modello corrente. Collapse, cambio linguetta e blocco invalidano letture pendenti e cancellano i nodi trattenuti. Nessuna inclusione automatica nel QR. La fixture è stata corretta al formato canonico `valueEnc` con etichetta/tipo, sostituendo soltanto il precedente dato sintetico non canonico `value`; nessuna migrazione reale.

Dieci prove del lettore, due della vista e due sulla durata del montaggio nelle linguette. Suite completa superata (341 shell), poi suite shell finale con le due ulteriori regressioni di montaggio superata (343). Chrome: 58 entry + 32 arresto/riapertura superati, con Widget cifrato non vuoto, espansione, anteprima nascosta, lettura e pulizia online/offline e dopo riavvio. Nessuna nuova prova Edge o iPhone attribuita all'incremento.

**Parità aziendale ancora aperta:** la pagina/modello aziendale e le Rules verificate non hanno una raccolta equivalente ai Widget del profilo privato. Non si mostrano i Widget personali dentro un'azienda e non si inventa un namespace con permessi impliciti. L'estensione richiede contratto dati e Rules dedicati in un blocco successivo; i Widget degli Account aziendali sono già distinti e non sono questa funzione. Restano anche editor, modifica persistente dell'ordine/collasso e layout produttivo. Proseguire con tessera digitale, lasciando questa estensione esplicita nel piano. Nessun dato reale, master, bump, deploy o ampliamento Rules; rollback limitato ai moduli/montaggio sperimentali e all'export repository aggiuntivo.

### Panoramica dei profili nella shell — candidata 15/09/2026

Successiva a `530c991a`: Panoramica è la linguetta iniziale in entrambi i profili e apre internamente Anagrafica, Contatti, Indirizzi e Documenti. Il lettore riusa `buildProfileOverview` e `resolvePrimary` canonici: identità, codice fiscale/Partita IVA, contatto e indirizzo principali, documenti personali in scadenza entro 90 giorni oppure numero degli allegati aziendali. Non modifica i record né crea nuovi collegamenti. La normalizzazione aziendale resta l'adattatore canonico già integrato.

Online legge la sorgente confermata, offline il repository locale. Decifra solo la proiezione ammessa: nessuna password del profilo, credenziale collegata, nota, Widget, URL o byte allegato entra nel riepilogo. Il documento fiscale viene scelto dal tipo; i numeri degli altri documenti non sono decifrati. UID/sblocco/segnale controllati prima e dopo gli await; assenza, archiviazione, proprietario discordante, forme invalide e decifratura fallita impediscono il risultato. Cambiando sezione vengono cancellati valori, etichette e titoli anche nei nodi trattenuti.

Otto nuove prove, 329 shell e suite `npm test` completa superati. Chrome: 58 entry + 32 arresto/riapertura, 90 verifiche superate, con Panoramica iniziale, apertura interna dell'Anagrafica e prima visita offline dopo riavvio. L'ultimo affinamento della pulizia etichette è verificato dai test della vista e dalla suite completa; la precedente prova entry non va presentata come collaudo visivo di quell'affinamento. Edge e iPhone restano gate aperti; layout produttivo, modifica dati, tessera digitale e Widget di profilo non sono completati. Prossimo blocco: consultazione dei Widget del profilo e relativa parità aziendale; poi tessera/editor secondo il piano. Nessun dato reale, master, bump o deploy; rollback limitato al montaggio sperimentale di Panoramica.

### Note anagrafiche nella shell — candidata 15/09/2026

Successiva a `1fc6e357`: la sezione Anagrafica privata include il campo canonico `users.note` con etichetta «Note anagrafica», come la pagina produttiva; l'azienda esponeva già il proprio `note`. Nessuna riga per valore assente, nessun accesso a campi arbitrari/password, nessun nuovo writer. Il lettore conserva autorizzazione RAM e revoca prima/dopo la decifratura; la vista tratta il testo come testo e lo cancella dai nodi trattenuti cambiando linguetta.

Quattro nuove prove, 321 test shell superati; Chrome 58 entry e 32 arresto/riapertura superati, ora con nota cifrata non vuota e pulizia esplicita durante il cambio sezione, anche alla prima visita offline dopo riavvio. Non sono prove dell'editor delle note del profilo: modifica/creazione restano aperte. Suite completa e CI del precedente `1fc6e357` superate (run 34998077954); per questo piccolo incremento rieseguite suite shell e matrice Chrome, non attribuire la suite completa precedente al nuovo codice. Edge locale resta indisponibile; la CI esegue `npm test`, non entry/crash browser. Prossimo blocco: Panoramica tramite modello canonico, poi Widget del profilo e tessera digitale. Nessun dato reale, bump, master o deploy.

### Vista bancaria della shell — candidata 15/09/2026

Successiva a `33e4b1b1`: dettaglio personale e aziendale compongono ogni conto nell'ordine dati bancari, Widget del relativo `bankId`, carte. I Widget bancari sono esclusi dal contenitore generico. La vista riceve solo capability del lettore canonico; PIN, CCV e password dispositiva richiedono un comando esplicito di visualizzazione/copia. La copia dei segreti bancari non abilita quella dei Widget cifrati, che conserva il contratto precedente. Uscita e blocco cancellano anche valori nei nodi trattenuti; nessun editor legacy o gestore chiave importato.

Fixture con due conti, due Widget distinti e carte in entrambi i domini. Tre nuove prove della vista; suite completa superata con 317 shell. Chrome: 58 verifiche entry online/offline dopo il fix della coda, 32 arresto/riapertura con prima visita bancaria offline, 90 totali. Edge resta **non verificato** per questo incremento: il processo locale termina con codice 0 prima dell'endpoint DevTools anche con profilo temporaneo vuoto. Il runner segnala ora l'uscita anticipata e permette `VAULT_SHELL_BROWSER=chrome|edge` per diagnosi mirate; il default del runner resta entrambi i browser. Il workflow CI della PR esegue `npm test`, non le prove entry/crash browser; il successo CI non chiude questo gate. Non conteggiare Chrome come sostituto di Edge. Il precedente errore intermittente del recupero note non si è ripresentato nell'ultima prova Chrome; resta da rieseguire la matrice Edge quando disponibile.

Non chiude editor, ordine/collasso interattivo, parità grafica produttiva, iPhone o il programma MD. Nessun dato reale, modifica Rules/Functions, migrazione, bump, master o deploy. Rollback: rimuovere il montaggio sperimentale della vista e il relativo adattatore; il modello dei dati rimane invariato. Prossimo blocco autonomo: parità del profilo (panoramica/note/Widget/tessera), conservando aperto il gate Edge.

### Lettore bancario della shell — candidata 15/09/2026

Base `5f17a9a2`: `banking-reader.mjs` espone descrittori e capability puntuali per campi del conto e carte. Riusa tramite iniezione `normalizeEditableBankingAccounts` canonico (provato con il sorgente reale), senza `ensureBankIds` o scritture. Conserva gli ID esistenti; i conti legacy senza ID restano leggibili con una capability legata alla posizione e alla fotografia del record. Il riordino di conti con ID stabili conserva la destinazione; modifica/rimozione del conto o spostamento delle carte invalida i lettori precedenti.

UID, blocco e segnale della vista sono verificati prima/dopo letture e decifratura; online solo repository confermato, offline repository cache. Allowlist distinta conto/carta, nessuna chiave o record cifrato restituito alla UI. PIN, CCV e password dispositiva sono marcati come segreti anche per dati legacy in chiaro. Record archiviati, proprietari discordanti, ID duplicati, tipi invalidi e decifrature fallite sono rifiutati.

13 prove mirate superate; `npm run test:vault-contract` completo superato, inclusi 312 test shell. Il lettore non è ancora montato nel browser: nessuna nuova prova browser o parità UI attribuita al sottoblocco. Prossimo passo: vista bancaria che riceve queste capability, host Widget per bankId tra dati del conto e carte, fixture con due conti e collaudo online/offline/arresto. Non anticipare una migrazione o assegnare ID in lettura. Nessun dato reale, schema, Rules, Functions, bump o deploy modificato. Rollback: rimozione del solo modulo/test sperimentale.

### Vincolo del Widget al conto — candidata 15/09/2026

Sottoblocco successivo a `6b952fe5`: il lettore dei Widget verifica che `bankId` identifichi esattamente un conto canonico nell'Account corrente. Conto assente, ID duplicati o rimozione durante la decifratura impediscono la lettura; spostamento del Widget verso un altro conto invalida il risultato pendente. Nessun ID viene inventato per i dati legacy. Tre nuove prove e tutta la suite shell superate (299 test). Nessuna nuova verifica browser attribuita a questo sottoblocco. Il lettore bancario e il montaggio nel conto restano da completare; nessuna migrazione, modifica dei dati reali o distribuzione.

### Consultazione Widget nella shell — candidata 15/09/2026

Base `0d31c777`, stessa PR #67. Il dettaglio Account monta ora `account-widget-view.mjs` con il lettore revocabile: Widget incorporati e credenziali comuni personali/aziendali, campi cifrati mascherati, mostra/nascondi espliciti e copia dei soli campi non cifrati abilitati dal modello. La richiesta di lettura vincola anche la classificazione del campo: un vecchio comando di copia non può esportare un campo nel frattempo diventato cifrato o non copiabile. Errori invalidano lo snapshot, scartano letture concorrenti e mostrano testo generico. Uscita/blocco cancellano valori, titoli, etichette e listener anche nei nodi trattenuti.

Composizione di sola consultazione con nomi di classe canonici e CSS del laboratorio; nessun import dei vecchi editor, writer o gestori chiave. Il modulo bancario completo non è ancora montato: i Widget con `bankId` sono riconosciuti e rimandati esplicitamente a tale modulo, mai appiattiti tra i campi generici dell'Account. Non dichiarare parità completa, editing, ordine/collasso o layout produttivo conclusi. Le letture confermate ripetute proteggono la freschezza; il costo su archivi grandi resta da misurare prima del cutover.

Verifiche finali: `npm test` completo, 296 test shell, 108 verifiche entry e 62 arresto/riapertura su Chrome/Edge (170 browser totali). Fixture non vuote in `accountWidgets` e `sharedVaultData`, inizializzate esclusivamente tramite amministratore dell'emulatore loopback con host verificati; Rules invariate. Tre contesti (privato, prima e seconda azienda) con lo stesso ID Account verificano isolamento online/offline. Il riavvio offline dopo preparazione automatica legge Widget e credenziale comune senza visita preventiva; uscita cancella i nodi. Prove fisiche iPhone/eviction restano aperte. Nessun dato reale, bump, master o deploy. Il precedente `0d31c777` ha superato CI GitHub 34953444888.

Prossimo sottoblocco: lettore bancario revocabile e montaggio dei Widget nel conto identificato da `bankId`, tra i dati bancari e le carte, usando il modello canonico e preservando gli ID esistenti. Poi parità degli editor e dei profili secondo il piano. Il lettore base attuale espone soltanto sei campi Account: non aggirarne l'allowlist restituendo il record completo o una chiave al renderer. Rollback tramite rimozione del montaggio sperimentale; nessuna migrazione dati.

### Lettore Widget per la shell — candidata 15/09/2026

Base `8a664499`, stessa PR #67. Primo sottoblocco della consultazione Widget: `account-widget-reader.mjs` espone metadati senza valori/ciphertext e letture puntuali attraverso la capability RAM. Account, dominio e azienda sono validati; online usa esclusivamente letture confermate, offline il repository locale. Ogni lettura rivalida Account, collegamento e record dopo la decifratura e rifiuta cambi, archiviazione, duplicati, riferimenti mancanti e proprietari discordanti. Blocco, cambio UID e uscita invalidano i risultati pendenti. Tipi semplici non cifrati compatibili con il servizio canonico; copia disabilitata nei metadati dei campi cifrati come previsto dal contratto corrente.

15 test mirati con fixture non vuote, 278 test shell finali superati. Suite `npm test` completa superata sulla prima revisione (277 shell); successiva correzione della compatibilità booleani/numeri e della proiezione `copyable` verificata con l'intera suite shell finale. Nessuna modifica a schema, Rules, Functions, chiavi, dati reali o runtime pubblicato; rollback tramite rimozione del solo lettore sperimentale, senza migrazione.

**Non è ancora integrazione UI né prova browser di Widget offline.** Prossimo passo: collegare le viste tramite la capability, mantenere i Widget bancari nel rispettivo modulo e completare fixture browser non vuote di `accountWidgets`/`sharedVaultData`. Queste raccolte sono function-only: usare inizializzazione amministrativa del solo emulatore, senza allargare le Rules. I renderer canonici richiedono adattamento esplicito (`readOnly` negli incorporati nasconde la sezione, mentre `editable: false` esclude l'editor); non riattivare `ensureVaultKeyMaterial` legacy. Il lettore deve essere collegato e collaudato prima di chiudere il punto 2 del piano.

### Selezione aziende nella shell — candidata 15/09/2026

Base `b3b07769`, stessa PR #67. La nuova route Aziende elenca le aziende attive dell'UID, consente ricerca locale e offre Apri profilo/Apri Account. Le liste sono confermate dal server online e lette dal repository/cache offline. Solo ragione sociale e ID validato vengono proiettati; aziende archiviate escluse, duplicati/proprietario errato/ID non valido rifiutati. Nessuna decifratura di altri campi del record.

Il bootstrap conserva separatamente l'azienda selezionata e l'Account: il parametro della lista, il parser del dettaglio e il ritorno mantengono il contesto aziendale. La ricerca delle liste Account è distinta per azienda; blocco/logout cancellano selezione e filtri. La directory cancella nomi e input anche nei nodi trattenuti, rimuove listener e scarta letture tardive. Nessun ritorno ai gestori produttivi della chiave.

Suite completa superata, 263 test shell; 96 verifiche entry e 60 arresto/riapertura Chrome/Edge, 156 totali. Due aziende fittizie con lo stesso ID Account verificano ricerca, profili, dettaglio e ritorno alla lista senza scambio di contesto. La seconda raccolta Account è disponibile offline dopo il solo avvio normale e nuova Master dopo riapertura. Nessun dato reale, foto, migrazione, bump o deploy; UI completa, editor e Widget restano da integrare. Il conteggio delle pagine canoniche resta invariato: nuova route nel laboratorio, nessuna nuova pagina produttiva.

### Utenze personali nella shell — candidata 15/09/2026

Base `17a1236a`, stessa PR #67. La linguetta Indirizzi proietta anche `utilities[].type/value`; i collegamenti usano la coppia `parentAddressId` e ID utenza. La lettura richiede esattamente un indirizzo e una utenza corrispondenti e li ricontrolla dopo la decifratura. ID utenza ripetuti in indirizzi diversi non vengono confusi; indirizzo rimosso, duplicati o destinazione cambiata impediscono la restituzione della password. Nessuna lettura delle vecchie password contenute nell'utenza.

Suite completa superata, 253 test shell. Browser Chrome/Edge: 88 verifiche entry online/offline e 58 arresto/riapertura superate; incluse credenziali collegate a utenze e documenti. Le utenze personali risultano leggibili dopo preparazione automatica, senza visita preventiva. Solo fixture; nessuna modifica a dati reali, Rules, Functions o formati. Creazione, modifica e dissociazione restano da integrare, così come eventuali utenze aziendali con schema diverso: non vengono inventate equivalenze.

### Candidata shell: profilo aziendale in consultazione — 15/09/2026

Base `199441d0`, stessa PR #67. Profilo privato e aziendale montano la stessa vista a quattro linguette. L'adattatore aziendale riusa `companyProfileContacts` canonico per email fisse/extra e telefoni, proietta anagrafica, sede legale/altre sedi e nomi dei documenti incorporati. Legge l'azienda di origine sotto l'UID autenticato, distinta dall'eventuale azienda dell'Account collegato. Apertura, password lazy e ritorno al profilo condividono i controlli di sessione e provenienza già introdotti. Nessuna lettura di file/foto, password legacy o URL degli allegati.

Suite completa superata, 240 test shell, 80 verifiche entry e 56 arresto/riapertura Chrome/Edge superate, tutte su fixture. L'azienda del laboratorio è selezionata dal bootstrap; il selettore generale aziende, editor, azioni sui collegamenti, utenze, Widget, panoramica e tessera digitale non sono completati. Documenti aziendali qui significa nomi degli allegati incorporati, non apertura dei file. Nessuna migrazione, formato, deploy o chiusura VS-P0-01.

Questa attività precede l'evoluzione funzionale dell'Agente Codex. Deve stabilizzare il modello dati che l'Agente dovrà successivamente descrivere e utilizzare.

Stato: **audit statico completato; piano applicativo e verifica aggregata dei dati reali ancora da approvare; nessuna migrazione autorizzata**.

Principi inderogabili:

- preservare Firestore esistente, cifratura, offline-first e compatibilità con account privati e aziendali;
- non cancellare, migrare o sovrascrivere campi legacy senza averne verificato struttura, popolazione e utilizzo reale;
- correggere prima i difetti osservabili, senza riscrivere l'app;
- procedere per blocchi piccoli, testabili e reversibili.

## A — Audit

1. Ricostruire i flussi delle email di profilo e azienda/PEC, incluso `contactEmails[]`, `password` legacy e `linkedAccountId`.
2. Verificare se il collegamento a un Account trasferisce sempre la credenziale prima di rimuovere il valore legacy. Dopo una migrazione riuscita, valutare la rimozione del campo anziché una stringa vuota cifrata.
3. Verificare che gli account aziendali siano letti e scritti esclusivamente in `users/{uid}/aziende/{aziendaId}/accounts/{accountId}` e che dettaglio, modifica, allegati e condivisione conservino sempre `aziendaId`.
4. Cercare duplicazioni o contaminazioni con `users/{uid}/accounts/{accountId}`, prima nel codice e nei test e, solo con accesso autorizzato, nei dati reali.
5. Confermare nel codice la causa del difetto modifica → salva → dettaglio: `getDocSmart()` può restituire una cache precedente mentre il fetch server in background non provoca un nuovo render.
6. Mappare tutti i consumer di `getDocSmart()` e `getDocsSmart()` per individuare altre aree soggette allo stesso difetto.
7. Inventariare `profileWidgets`, wizard, banking, referente, QR, allegati e regole per campi sensibili, distinguendo schemi riutilizzabili da logica specifica.
8. Rivisitare **Dati azienda** sulla falsariga del Profilo personale: struttura della pagina, panoramica, modifica, recapiti, documenti, sedi, widget e collegamenti, senza uniformare forzatamente dati che hanno significato diverso.

L'audit dei dati reali deve essere soltanto esplorativo e minimizzato: conteggi, percorsi e forma dei documenti, senza esportare segreti nei log.

## Esito audit sorgente — 10/09/2026

Stato: **audit statico completato; dati Firestore reali non ispezionati; nessuna modifica applicativa o migrazione eseguita**.

### Cache e read-your-writes

L'ipotesi è confermata. Quando il dispositivo è online, `getDocSmart()` e `getDocsSmart()` restituiscono una copia cache valida e avviano una lettura remota non attesa. Il valore remoto non viene pubblicato al consumer che ha già renderizzato la pagina. Tutti i consumer del repository possono quindi osservare dati precedenti, in particolare dopo una scrittura o una modifica proveniente da un altro contesto.

I due flussi Account hanno già correzioni puntuali:

- il form privato naviga con `m6refresh=1` e il dettaglio chiama `getPrivateAccountConfirmed()`;
- il form aziendale naviga con `serverRefresh=1` e il dettaglio chiama `getCompanyAccountConfirmed()`.

Queste correzioni coprono la navigazione immediata nota, ma duplicano il contratto tramite due nomi di parametro e non proteggono gli altri consumer. Inoltre le funzioni denominate `ServerConfirmed` usano attualmente `getDoc()`/`getDocs()` standard; soltanto `getDocsFromServer()` è presente nel bundle Firebase corrente. Prima di considerare forte la garanzia occorre introdurre una sorgente server esplicita per il documento oppure definire con precisione la semantica accettata.

Il repository è usato anche da Home, liste Account/Aziende/Scadenze, Profilo, Impostazioni, archivio, Salute credenziali, configurazioni Scadenze, allegati e Agente Codex. Non vanno trasformate tutte queste letture in server-first: serve un'opzione mirata per il read-after-write e un contratto testabile.

### Percorsi Account aziendali

Creazione, modifica, dettaglio proprietario, lista, archivio, backup e metadati degli allegati usano nel sorgente il percorso canonico `users/{uid}/aziende/{aziendaId}/accounts/{accountId}`. Il form rifiuta l'avvio senza `aziendaId` e lo conserva nella navigazione.

È stata però trovata una divergenza nel dettaglio di un Account aziendale condiviso: il record viene letto con `ownerId`, mentre `initAttachmentModule()` riceve `currentUid`. Di conseguenza la lista e i percorsi allegati vengono costruiti sotto l'utente visitatore anziché sotto il proprietario. Le azioni di scrittura devono comunque restare bloccate in sola lettura; il contesto di lettura degli allegati va corretto e coperto da test senza allargare i permessi.

La ricerca statica non mostra salvataggi ordinari di Account aziendali nella collezione privata. Le letture condivise scelgono il percorso aziendale quando l'invito contiene `aziendaId`. Questo non dimostra l'assenza di duplicati storici nei dati reali.

### Email profilo e credenziali legacy

`contactEmails[]` continua a leggere, decifrare, modificare e ricifrare `password` e `note`. Il collegamento a un Account esistente imposta `linkedAccountId` e poi assegna `email.password = ''`; il salvataggio del Profilo cifra nuovamente anche la stringa vuota. Il flusso di creazione guidata di un nuovo Account precompila l'email come username, ma non trasferisce la password legacy prima di scrivere `password: ''` nel Profilo.

Esiste quindi un rischio concreto di perdita della password legacy durante il collegamento. Il collegamento va bloccato o reso transazionale finché la password non è stata trasferita e verificata. Dopo il trasferimento, il campo deve essere eliminato esplicitamente dalla voce email, non sostituito da un ciphertext della stringa vuota. Non è stata trovata una migrazione completa già esistente.

Le email aziendali hanno tuttora un modello separato: `emails.pec`, `emails.amministrazione`, `emails.personale`, `emails.extra[]` e il fallback storico `aziendaEmailPassword`. Le password vengono lette e cifrate nel documento Azienda; non è presente un collegamento equivalente a `linkedAccountId`. Questo ambito richiede prima un inventario reale e non deve essere migrato insieme al Profilo per semplice analogia.

### Widget e strutture riutilizzabili

`profileWidgets` offre già il nucleo richiesto: documento widget con `fields[]`, ordine di widget e campi, duplicazione, collasso, tipi di campo, limite di 30 campi e cifratura per `sensitive`. I campi sensibili vengono esclusi dal QR e dalla copia/anteprima in chiaro. Le Rules limitano forma, tab e dimensione del widget, ma non validano in profondità ogni oggetto di `fields[]`; il controllo più dettagliato è oggi lato client.

Banking è già normalizzato da un modello condiviso e legge sia il formato canonico `banking[]` sia il vecchio oggetto singolo. Referente esiste sia a livello Account sia dentro banking. Non esistono ancora widget Account né una libreria template. La generalizzazione dovrà estrarre un modello neutro senza spostare automaticamente banking/referente esistenti.

### Dati reali e gate

Il repository e l'ambiente corrente non forniscono una lettura amministrativa sicura già predisposta che produca soltanto conteggi e forma dei documenti. Per evitare di esporre credenziali o introdurre uno script improvvisato sulla produzione, Firestore reale non è stato interrogato in questo audit. Prima di qualsiasi migrazione servirà un comando read-only dedicato, con output aggregato e campi sensibili esclusi.

### Priorità risultante

1. [x] formalizzare e testare una lettura `afterWrite`/server-required unica nel repository;
2. [x] sostituire i due parametri ad hoc con un contratto condiviso, mantenendo il fallback offline;
3. [x] correggere il contesto proprietario degli allegati aziendali condivisi;
4. [x] bloccare il collegamento email quando esiste una password legacy non trasferita;
5. creare l'inventario Firestore aggregato prima di progettare migrazioni;
6. soltanto dopo, definire schema widget Account, template e ordinamento touch.

### Primo blocco implementato — read-your-writes

Il contratto usa ora `afterWrite=1` per le navigazioni successive a un salvataggio privato o aziendale. I vecchi parametri `m6refresh` e `serverRefresh` restano accettati in lettura per compatibilità con schede o shell già aperte, ma non vengono più prodotti dai form.

Le funzioni `getDocServerConfirmed()` e `getDocsServerConfirmed()` richiedono esplicitamente la sorgente server di Firestore. Le normali funzioni `getDocSmart()` e `getDocsSmart()` restano cache-first: il costo di rete e l'offline-first non cambiano per la navigazione ordinaria.

Verifiche automatiche superate: build del runtime Firebase locale, shell offline, audit accesso dati, navigazione, sintassi JavaScript e riferimenti statici. Resta obbligatorio il collaudo fisico privato/azienda modifica → salva → dettaglio prima del rilascio.

### Secondo blocco implementato — allegati aziendali condivisi

Il modulo allegati distingue ora lo UID proprietario dallo UID del visitatore. La lista usa il percorso canonico del proprietario e conserva `aziendaId`; caricamento, eliminazione e selettore sorgente sono bloccati in modalità condivisa/sola lettura e il pulsante Elimina non viene renderizzato. Non sono stati ampliati i permessi Firestore o Storage: il contenuto degli allegati continua a rispettare il contratto di condivisione esistente.

### Terzo blocco implementato — inventario e protezione password legacy

È disponibile `scripts/audit-firestore-legacy-email-metadata.mjs`, con conferma obbligatoria del progetto e output limitato a conteggi aggregati. Il modello è testato per non restituire nomi, email, password o identificativi. Il tentativo del 10/09/2026 non ha letto Firestore perché nell'ambiente manca Application Default Credentials; non sono stati usati token o metodi alternativi meno sicuri.

In attesa dell'inventario reale, il collegamento email Profilo → Account è fail-closed: se la voce email contiene ancora una password decifrata non vuota, l'operazione viene bloccata e chiede di salvare prima la credenziale nell'Account e rimuoverla poi manualmente dal Profilo. In questo modo il codice non può più sostituire direttamente una password legacy con la stringa vuota durante il collegamento.

## B — Piano architetturale

Prima di modifiche strutturali devono essere approvati:

- file e flussi interessati;
- strategia generale **read-your-writes** senza fetch server indiscriminati;
- comportamento online, offline e durante la riconnessione;
- modello compatibile per widget, campi e template;
- trattamento dei campi legacy e, solo se indispensabile, migrazione idempotente e reversibile;
- rischi, rollback e matrice dei test.

La soluzione read-your-writes dovrà distinguere le normali letture cache-first dalle letture successive a una scrittura confermata. Le alternative da confrontare sono aggiornamento/invalida­zione controllata della cache, passaggio del dato appena scritto o lettura server-confirmed mirata.

### Decisioni funzionali approvate

#### Account e Memorandum

- Account e Account condiviso possono contenere `username`, `account/utente/codice` e `password`.
- Memorandum e Memorandum condiviso non possono contenere questi tre valori e non devono mostrarne i campi.
- Il passaggio a Memorandum è bloccato finché l'utente non svuota consapevolmente le credenziali; non si conservano copie nascoste.
- Se un Memorandum torna Account, i tre campi ricompaiono vuoti.
- Note, sito, widget e allegati restano disponibili in tutte le tipologie.
- La validazione deve esistere nel dominio/repository o backend, non soltanto nella UI.

#### Corpo dinamico della pagina

La struttura desiderata è: dati standard, note, corpo dinamico dei widget, allegati, tipologia/condivisione e comandi. Il corpo può allungarsi verticalmente e contenere widget singoli o composti. Widget e campi sono ordinabili; su touch è previsto un blocco/sblocco esplicito dell'ordinamento per evitare trascinamenti involontari.

#### Credenziali comuni

È approvata una terza area autonoma, provvisoriamente denominata **Credenziali comuni** o **Dati comuni protetti**. Non è un Account privato o aziendale e non appartiene a una singola Azienda. Conserva una sola istanza cifrata di un dato realmente riutilizzato, per esempio il codice generale dell'app Legal Mail collegato agli Account PEC di aziende differenti.

Una Credenziale comune usa lo stesso contratto `widget + fields` e può quindi contenere uno o più campi normali o sensibili. Negli Account appare come **widget collegato**, contenente soltanto un riferimento; non viene duplicato il valore.

Si distinguono:

- **widget incorporato**: appartiene a un solo Account;
- **widget collegato**: riferisce una Credenziale comune centrale utilizzabile da più Account.

La Credenziale comune è di proprietà dell'utente che la crea. Gli Account collegati non ne diventano proprietari. Un destinatario di un Account condiviso non riceve automaticamente accesso alla Credenziale comune e non può modificarla senza un permesso separato ed esplicito.

Accessi previsti:

- Impostazioni → Credenziali comuni: creazione, modifica, elenco dei collegamenti, autorizzazioni e rimozione;
- Account → Credenziali comuni: collega un dato esistente oppure crea un nuovo dato centrale e collega automaticamente l'Account corrente.

Creazione centrale e collegamento devono costituire un'unica operazione atomica. La modifica deve avvisare quanti Account saranno interessati. L'eliminazione deve essere bloccata finché esistono collegamenti, mentre lo scollegamento del singolo Account non elimina il dato centrale.

Il percorso centrale è `users/{uid}/sharedVaultData/{datoId}`. Rules, backup, funzione atomica e prima UI applicativa sono attivi. Il collaudo reale ha confermato creazione di una Credenziale con più campi e collegamento ad Account privati e aziendali; nessuna migrazione legacy è stata eseguita.

#### Dati azienda ed email/PEC

La pagina **Dati azienda** deve essere riesaminata come famiglia funzionale parallela al Profilo personale, mantenendo però il proprio modello aziendale. La revisione comprende gerarchia e leggibilità di panoramica/modifica, recapiti, sedi, documenti, dati fiscali, widget e collegamenti; non autorizza una riscrittura né una migrazione automatica dei record esistenti.

Per email e PEC il collegamento approvato è a livelli:

`Email o PEC aziendale → Account aziendale di riferimento → eventuale Credenziale comune`

L'indirizzo email/PEC resta un recapito dell'Azienda. Username, password e altri dati di accesso appartengono all'Account aziendale collegato. Un codice condiviso da più Account, come il codice generale di un'app, appartiene invece alla Credenziale comune richiamata dagli Account interessati. Non è previsto un collegamento diretto Email/PEC → Credenziale comune.

Prima di attivare il collegamento occorre:

- censire i formati legacy `emails.pec`, `emails.amministrazione`, `emails.personale`, `emails.extra[]` e `aziendaEmailPassword`;
- introdurre un identificativo stabile per ogni recapito che ne sia privo;
- verificare l'esistenza dell'Account aziendale corretto e conservare sempre `aziendaId`;
- trasferire e verificare ogni password legacy prima di rimuoverla dal documento Azienda;
- impedire collegamenti a Account privati o appartenenti a un'altra Azienda;
- mostrare nella panoramica lo stato del collegamento senza duplicare o rivelare la password;
- includere backup, ripristino, cache e scollegamento controllato nei test.

La migrazione resta manuale e assistita: l'utente crea o conferma l'Account di riferimento, verifica la credenziale trasferita e solo dopo autorizza la rimozione della copia legacy. Nessuna password aziendale viene svuotata automaticamente.

#### Prevenzione duplicati

È prevista una ricerca locale preventiva mentre si digita il nome di Account o Memorandum. Normalizzazione, parole in ordine diverso e piccoli errori di battitura producono suggerimenti, mai un blocco assoluto. Il confronto rispetta il perimetro privato/azienda, non usa password e permette sempre di creare legittimamente due Account distinti.

## C — Implementazione per blocchi

Ordine previsto:

1. correggere in modo generale modifica → salva → dettaglio per account privati e aziendali;
2. rendere coerenti i percorsi aziendali e il trasporto di `aziendaId`;
3. mettere in sicurezza il collegamento email → Account senza perdita di password legacy;
4. completare il modello dei widget incorporati negli Account, senza migrare banking o referente legacy;
5. introdurre la libreria dei template come definizioni, separata dalle istanze associate agli Account;
6. rivisitare Dati azienda e predisporre il collegamento Email/PEC → Account aziendale con migrazione assistita e non distruttiva;
7. collaudare la catena Account aziendale → Credenziale comune e l'isolamento fra aziende;
8. valutare ulteriori dati condivisi di servizio/dispositivo solo su casi reali ricorrenti, senza creare prematuramente una nuova entità `Servizio`.

## Modello widget desiderato

- **Widget**: contenitore o sezione associabile a profilo, Account privato o Account aziendale.
- **Fields**: array di uno o più campi; non esistono architetture separate per widget semplice e complesso.
- **Template**: sola definizione riutilizzabile della struttura.
- **Istanza**: widget effettivo con dati appartenenti a uno specifico contesto.

I primi template candidati derivano dalle strutture già presenti: referente, banking e domande di sicurezza. Non si duplicano campi o validazioni già esistenti senza aver prima valutato un adattatore o uno schema comune.

Ogni field sensibile deve essere cifrato, escluso da QR e anteprime in chiaro, protetto dallo stato della Vault e mai indicizzato o registrato senza protezione.

### Contratto tecnico candidato — 10/09/2026

#### Collocazione dei dati

I widget Account non vengono incorporati nel documento Account. Usano collezioni proprietarie dedicate:

- widget privati e aziendali: `users/{uid}/accountWidgets/{widgetId}`;
- centrale: `users/{uid}/sharedVaultData/{sharedDataId}`;
- indice dei collegamenti: `users/{uid}/sharedVaultLinks/{linkId}`.

Le collezioni separate evitano di avvicinarsi al limite Firestore del singolo Account, impediscono che il riordino riscriva l'intero Account e riducono i conflitti con le credenziali standard. Sono state preferite alle sottocollezioni annidate perché l'attuale Rule generica su `accounts` e `aziende` renderebbe impossibile applicare una validazione più stretta ai soli widget senza un refactor rischioso delle regole esistenti.

Ogni documento nella collezione proprietaria `accountWidgets` ha un solo contratto e un discriminante:

- `kind: embedded`: contiene `fields[]` ed è proprietà dell'Account;
- `kind: shared-reference`: contiene `sharedDataId` e metadati di presentazione/ordine, ma nessuna copia dei valori centrali.

Campi comuni candidati: `context`, `accountId`, `companyId` solo per il contesto aziendale, `title`, `description`, `icon`, `color`, `order`, `collapsed`, `schemaVersion`, `createdAt`, `updatedAt` e `revision`. Un widget incorporato aggiunge `fields[]`; un riferimento aggiunge esclusivamente `sharedDataId`. Lo schema dei field riusa quello già collaudato in `profileWidgets`, inclusi identificativo stabile, tipo, etichetta, ordine, valore cifrato per i dati sensibili e divieto di esposizione in QR/anteprime.

La Credenziale comune centrale usa lo stesso modello `fields[]`, con titolo e metadati propri. Non contiene una lista duplicata degli Account nel documento principale: i collegamenti stanno in `sharedVaultLinks`, priva di segreti. Ciascun link identifica `sharedDataId`, contesto (`private` o `company`), `accountId` e, se necessario, `companyId`.

#### Coerenza e proprietà

Creazione centrale + collegamento, collegamento esistente e scollegamento devono essere operazioni atomiche che aggiornano insieme il riferimento nell'Account e l'indice centrale. Un identificativo deterministico del collegamento impedisce di collegare due volte la stessa Credenziale allo stesso Account.

La rimozione della Credenziale centrale è rifiutata se esiste almeno un link. Poiché una Rule non può garantire da sola l'assenza di documenti arbitrari in una sottocollezione, creazione/collegamento/scollegamento/eliminazione passano da una funzione backend validata. Le normali letture restano disponibili al proprietario. Nessun destinatario di Account condiviso eredita il dato centrale: il widget collegato mostra uno stato non disponibile, salvo una futura condivisione esplicita separata.

#### Ordinamento

Widget incorporati e collegati condividono lo stesso campo `order`, quindi possono essere intercalati nella pagina. Il riordino touch è consentito soltanto dopo **Sblocca ordinamento** e si conclude con un salvataggio esplicito. Il riordino aggiorna soltanto i documenti interessati e non i dati Account. Non si introduce ora il trascinamento dei singoli campi: l'ordine dei field resta quello dell'array del widget.

#### Template

I template predefiniti sono manifest statici versionati distribuiti con l'app: descrivono struttura e validazioni, non contengono valori utente e non richiedono Firestore. La creazione copia la struttura in una nuova istanza, così un aggiornamento futuro del template non altera silenziosamente i widget esistenti.

Prima libreria candidata, da approvare dopo il confronto con i wizard esistenti:

- Informazioni referente;
- Dati bancari;
- Domande di sicurezza;
- campo singolo personalizzato.

Banking e referente legacy non vengono migrati né rimossi in questa fase. Il template potrà riusarne nomi, tipi e validazioni, ma rimarrà una nuova istanza indipendente finché non sarà definita una migrazione esplicita.

#### Backup e ripristino

Il backup attuale esporta `profileWidgets`, ma non conosce widget Account, Credenziali comuni o relativi link. Prima di rendere scrivibile la nuova UI occorre aggiungere scope distinti per:

- widget Account privato;
- widget Account aziendale;
- Credenziale comune;
- link della Credenziale comune.

Il ripristino deve ricostruire prima i documenti centrali e poi i riferimenti, validare proprietario e percorsi, descrivere chiaramente titolo e Account nell'anteprima e non creare riferimenti orfani. Il backup rimane cifrato; gli allegati conservano il flusso separato già esistente.

#### Offline e coda M6

I widget incorporati potranno entrare nel normale offline-first solo dopo una mutation dedicata e test di conflitto. Le Credenziali comuni coinvolgono più documenti e, nella prima versione, sono **consultabili dalla cache ma creabili, modificabili, collegabili e scollegabili soltanto online**. Questa limitazione è intenzionale e deve essere dichiarata nella UI; evita code parziali o riferimenti orfani. L'estensione offline sarà valutata dopo la certificazione degli account semplici e degli allegati.

#### Rules e limiti

Le nuove collezioni non devono ricadere semplicemente nella regola generica proprietario. Servono Rules nominate che limitino chiavi, tipi, numero massimo di field, lunghezze, `kind`, contesto e versione schema. La validazione profonda già insufficiente in `profileWidgets` va centralizzata in un modello condiviso lato client/backend e coperta da test Rules. Valori sensibili ammessi soltanto nella forma cifrata prevista dalla Vault; nessun valore decifrato può apparire nei link o nei log.

#### Gate prima del codice applicativo

1. approvazione esplicita di percorsi, proprietà e limite online iniziale;
2. estensione backup/ripristino e relativi test prima della prima scrittura reale;
3. Rules e test emulator per isolamento privato/aziendale e accesso condiviso negato;
4. funzioni atomiche con test di idempotenza, conflitto e cancellazione bloccata;
5. prova isolata con un widget incorporato e una Credenziale comune collegata a due Account di aziende diverse;
6. soltanto dopo, UI completa, ordinamento touch e libreria template.

### Quarto blocco implementato — predisposizione backup e Rules

Il formato cifrato riconosce ora, pur in assenza di dati reali, quattro scope distinti: widget Account privato, widget Account aziendale, Credenziale comune e relativo collegamento. Esportazione e ripristino conservano `accountId`, `companyId` e `sharedDataId`, costruiscono esclusivamente percorsi sotto lo UID autenticato e mostrano nell'anteprima titoli leggibili senza includere valori protetti.

L'esame delle Rules ha fatto scartare le sottocollezioni annidate negli Account: la regola generica storica su `accounts` e `aziende` avrebbe consentito scritture senza la nuova validazione, a meno di un refactor ampio e rischioso. Il contratto è stato quindi corretto verso `accountWidgets`, `sharedVaultData` e `sharedVaultLinks`, tutte sotto il proprietario. Sono escluse dalla regola generica, leggibili soltanto dal proprietario e temporaneamente non scrivibili dai client. Il ripristino amministrativo continua a essere compatibile; le future modifiche atomiche passeranno dal backend.

Verifiche superate: 16 test del backup cifrato e dell'anteprima, 5 test del servizio backend, controllo sintattico di 139 moduli e 15 test Firestore Rules. Nessuna collezione è stata popolata e nessun dato reale è stato modificato. Prima dell'attivazione UI restano da implementare validazione condivisa dello schema, funzioni atomiche e controllo delle dipendenze durante un ripristino selettivo.

### Quinto blocco implementato — funzione atomica e client applicativo isolato

La callable `manageSharedVaultData` gestisce creazione, aggiornamento, collegamento, scollegamento ed eliminazione con revisione, idempotenza e blocco della cancellazione quando esistono collegamenti. Il client applicativo prepara lo stesso schema, cifra ogni valore sensibile prima della chiamata e rifiuta le modifiche offline; link e widget usano identificativi deterministici per impedire duplicazioni.

Il client è collegato a una prima UI controllata. In Impostazioni, **Credenziali comuni** consente elenco, creazione e modifica di schede con uno o più campi; dal dettaglio degli Account privati e aziendali il proprietario può collegare una scheda esistente, rivelarne localmente i campi sensibili e scollegarla senza eliminare il dato centrale. Le letture successive a una modifica sono server-confirmed e non richiedono refresh.

La UI non migra né collega automaticamente email o PEC legacy. Gli Account ricevuti in sola lettura non ereditano la Credenziale comune del proprietario e non mostrano comandi di collegamento. Creazione, modifica, collegamento e scollegamento richiedono rete; la consultazione può usare la cache già sincronizzata. Il collaudo applicativo ha confermato collegamento, consultazione e scollegamento; l'uso per PEC reali resta subordinato alla revisione di Dati azienda e alla migrazione assistita descritta sopra.

### Sesto blocco avviato — contratto widget incorporato

Il modello client prepara ora `kind: embedded` riutilizzando lo stesso schema `fields[]` e la stessa cifratura delle Credenziali comuni. Il contratto distingue esclusivamente il contesto (`private` o `company`), richiede `accountId` e, per gli Account aziendali, `companyId`; non incorpora il widget nel documento Account e non modifica banking o referente legacy.

I test confermano lo stesso formato per Account privati e aziendali, l'esclusione dal QR dei valori sensibili e il rifiuto di contesti incompleti.

La callable `manageAccountWidget` implementa creazione, aggiornamento ed eliminazione atomici. Prima di scrivere verifica che l'Account esista nel percorso proprietario corretto, impedisce di trasferire implicitamente un widget fra Account o aziende e usa revisione e `operationId` per conflitti, retry e idempotenza. Le scritture restano riservate al backend e producono soltanto audit tecnico privo dei valori dei campi.

Il gate completo delle funzioni, composto da 28 test, è superato. Il client `account-widget-client.js` prepara e cifra il payload localmente, richiede la rete per le modifiche e usa la callable per creare, aggiornare o eliminare. Il repository espone letture cache-first e server-confirmed filtrate per Account, senza query o indici aggiuntivi.

Backup e ripristino riconoscono già gli scope distinti `private-account-widget` e `company-account-widget`; i relativi 16 test cifrati sono superati insieme ai gate di accesso dati, sintassi e riferimenti statici.

La versione 1.2.94 attiva il primo editor controllato nella sezione **Campi personalizzati** dei dettagli Account privati e aziendali. Il proprietario può creare un widget con uno o più campi, marcare singoli valori come sensibili, rivelarli localmente, modificarli ed eliminarli. Le viste ricevute restano escluse e le mutazioni richiedono rete. Template, riordino e migrazione dei campi legacy non fanno parte di questo primo rilascio.

La revisione successiva rende ogni widget incorporato già creato una possibile sorgente di template: durante la creazione in un altro Account, un menu consente di copiarne titolo, struttura dei campi e classificazione sensibile. I valori non vengono mai copiati; restano vuoti per impedire la duplicazione involontaria di segreti. Quando più Account devono leggere lo stesso valore, il dominio corretto resta la Credenziale comune.

La presentazione dei widget usa gli stessi campi glass del dettaglio Account. Il comando occhio non viene più rimosso dopo la rivelazione: alterna esplicitamente mostra/nascondi e torna all'icona iniziale quando il valore viene protetto di nuovo.

La suite completa è superata. Il gate finale del blocco richiede una prova fisica con dati fittizi: un widget a campo singolo e uno composto, almeno un valore sensibile, modifica immediata senza refresh ed eliminazione, sia nel perimetro privato sia in quello aziendale.

## D — Matrice minima di test

- Account privato e aziendale, con isolamento fra almeno due aziende;
- online, cache presente, offline applicabile e riconnessione;
- modifica e aggiunta di username, account/codice, password, URL, note, referente, banking e altri campi modificabili;
- dettaglio immediatamente aggiornato senza refresh manuale;
- allegati e condivisione sul percorso e sull'azienda corretti;
- nessuna perdita o duplicazione delle credenziali email/PEC;
- widget con uno e più campi, istanza da template e widget personalizzato;
- cifratura e non esposizione di tutti i campi sensibili;
- test mirati degli altri consumer di `getDocSmart()`/`getDocsSmart()`.

## E — Documentazione e gate di chiusura

Registrare decisioni, schema effettivo, compatibilità, eventuali migrazioni, test e problemi aperti negli MD pertinenti. Il blocco si chiude solo quando la proprietà read-your-writes è verificata, l'isolamento aziendale è provato e ogni intervento sui dati legacy ha un inventario e un rollback documentati.


### Verifica candidata del ciclo di vita widget — 12/09/2026

Sul ramo `experiment/persistent-vault-shell`, base `1ce18fe2`, ogni montaggio dei widget possiede dialoghi e listener. Cambio UID, blocco Vault, uscita pagina, smontaggio e annullamento invalidano la vista e puliscono i valori nei controlli. Letture e decifrature terminate in ritardo non ricreano la vista; crea/modifica controllano il contesto anche dopo cifratura. Il timer di navigazione del salvataggio privato ricontrolla il modulo prima di cambiare pagina.

Le operazioni già inviate al server non sono annullabili da questo controllo: il risultato viene ignorato dalla vista scaduta e va riletto nel contesto valido. Nessuna migrazione di widget, modifica del formato cifrato o nuova pubblicazione. Rollback del blocco tramite revert dei moduli e test, senza ripristino dei dati. Evidenze complessive nel successivo aggiornamento dell'audit Vault; collaudo fisico ancora aperto.

## Consolidamento Account — candidata 1.2.118, 13/09/2026

Base codice `4a431ec3`: UI Account compatta, allegati sotto note, Numero verde e referente banca, scorciatoia al normale editor Widget integrati con i controlli sessione del candidato Vault. Conservate le correzioni master 1.2.111–1.2.117 per contatti, aggiornamento dopo scrittura, credenziali comuni e selettore Widget. I test coprono anche salvataggio/riapertura dei dati bancari e callback tardive. Non è una nuova migrazione dei Profili né una chiusura dei gate reali. [Audit §51](./AUDIT_VAULT_SESSION_P0.md#51-integrazione-account-ui-e-vault--candidata-13092026).

## Widget dentro il conto — candidata 1.2.119, 13/09/2026

Corretto il pulsante introdotto nella UI 1.2.118: la creazione dal conto ora seleziona una posizione bancaria specifica, persistita tramite bankId. Host separati mantengono i Widget dentro ciascun conto, anche dopo riapertura; generici invariati. Disponibile spostamento esplicito dall'editor per Widget creati prima della correzione. Il requisito richiede un aggiornamento compatibile del solo callable manageAccountWidget oltre a Hosting; lavoro Vault escluso. Candidata verificata con 352 test, non distribuita.

## Prerequisito conto salvato — candidata 1.2.120, 13/09/2026

Corretto il flusso della 1.2.119: il form generava bankId localmente, ma consentiva di inviare il Widget prima che il conto fosse salvato. Il backend respingeva correttamente la richiesta con HTTP 400/failed-precondition. Ora i due form distinguono gli ID caricati da quelli appena generati; creazione e spostamento chiedono prima il salvataggio Account, senza inviare il comando fallito e conservando eventuali campi nel modale. Gestito anche il testo italiano del rifiuto server. Nessuna modifica backend, Rules, dati reali o ramo Vault.
