# 🧪 REGISTRO AGGIORNAMENTI, RISCHI E WIP — APP CODICI PASSWORD

> **Stato:** registro operativo e cronologico.
> **Autorità:** roadmap subordinata ai contratti, non certificazione; prevale la baseline sicurezza.
> **Revisione:** 17/09/2026; contratti candidati in laboratorio e non montati: contatti privati A1 (con correzione QR fail-closed) e DS-002A per le immagini dei documenti digitali. Produzione 1.2.128 (PR #68); candidata nella PR #67 ancora separata.
> **Area:** release e attività aperte.
> **Dipendenze:** [Guida progetto](../docs/GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

## Stato corrente e consegna — 16/09/2026

Riferimento operativo: [relazione di consegna](../docs/PASSAGGIO_CONSEGNE_2026-09-16.md), con obiettivo, lavori fatti/aperti, motivi del mancato rilascio complessivo, cartelle verificate e istruzioni per il nuovo agente. Questo riepilogo aggiorna lo stato; le sezioni successive conservano la cronologia e non sono tutte istruzioni ancora da eseguire.

- **Produzione 1.2.128:** PDF aziendale pubblicato separatamente, commit `9d0f7065`, merge `4efda528`, PR #68. Suite completa, 23 test PDF e verifiche browser/asset online superati; CI 35071328912. Nessuna nuova Rules/Function o migrazione.
- **Riconciliazione PDF 1.2.128 (16/09/2026):** confronto selettivo con `origin/master`/`9d0f7065`, nessun merge né cherry-pick; generatore e lettore già byte-identici (`e5cf2125`, `8739aa92`); riallineate vista e CSS `.company-pdf-*` nel laboratorio. Non portati adapter `entry`/`panel`, bundle vendor e bundler. 16 test PDF e 513 test shell superati; `npm ci` ripristinato su cartella principale e `functions/`. Nessuna verifica browser/emulatore attribuita.
- **Candidata `ebf1b1fa`:** Collega/Cambia/Scollega montati; note e coda già integrate. Suite completa, 513 test shell e 109 verifiche Chrome; CI 35070097640 superata. Tutto committato e inviato prima di questa relazione, non pubblicato come shell completa.
- **Prossimo:** completare gli allegati dei documenti privati (DS-002B: montaggio in laboratorio e scenario browser, poi trasporto di produzione e Rules autorizzate), contatti aziendali (A1b), poi editor indirizzi/utenze/documenti e creazione Account dal collegamento; quindi editor completi Account/Widget/banca e altri percorsi. I contratti candidati A1 e DS-002A sono in laboratorio e non pubblicati. Excel originale resta isolato a `40052515`; M5–M10 e collaudi reali ancora aperti. Non ricominciare i blocchi già conclusi nelle note storiche.
- **Motivo:** parità incompleta, trasporti/Rules di laboratorio, transizione writer e migrazione/rollback non chiusi. VS-P0-01 resta aperto in produzione. Il deploy PDF non autorizza il deploy dell'intera PR #67.
- **Cartella principale unica:** `C:/Users/Diego/Documents/Progetti/App-Codici-Password`. Le vecchie copie e i worktree temporanei sono stati archiviati e rimossi; l'Excel resta disponibile sul ramo remoto `origin/codex/real-excel-export-preview` al commit `40052515`. Ripresa automatica in pausa per il passaggio a un altro agente.

Editor contatti privati (A1) dopo `6ef44c4b` — laboratorio 17/09/2026: email e telefoni modificabili dalla linguetta Contatti del profilo privato, con contratto/allowlist, preparazione che cifra i soli campi già cifrati, sorgente revocabile, servizio transazionale candidato con ricevuta idempotente, editor/provider, bridge loopback, overlay Rules di laboratorio e refresh confermato. Nessuna ricifratura; svuotamento esplicito a stringa vuota; solo online, coda M6 intatta e consultazione offline invariata. Nessun ID da indice: le nuove righe ricevono `email-<uuid>`/`phone-<uuid>`; le righe senza ID persistito restano visibili ma non modificabili in attesa di una migrazione separata. Campi sconosciuti, legacy, `isPrimary` e collegamenti Account preservati; eliminazione vietata per righe collegate a un Account, incluse nel QR o con riferimento posizionale legacy, e `qrCodeInclusions` mai modificata. Contatti aziendali (A1b), indirizzi, utenze, documenti e creazione Account restano aperti. Prove: 48 unitarie, due prove emulatrici, nuovo flusso browser superato su Chrome 152 ed Edge 153, 561 test shell, `npm test` completo e `audit:inventory` rigenerato. A1 resta in laboratorio e non concluso. Nessun deploy, nessun bump, nessuna modifica a master, Rules o Functions produttive.

Controllo QR fail-closed nei contatti (A1, secondo commit) — 17/09/2026: una configurazione `qrCodeInclusions` che non si riesce a interpretare non vale più come selezione vuota. La sorgente distingue tre esiti — documento assente (cancellazione consentita se il contatto non è incluso), selezione verificata, protezione non verificabile per errore di lettura o configurazione incoerente — e nel terzo caso mantiene consultazione e modifica ma disabilita **tutte** le cancellazioni con messaggio esplicito. Il servizio valida l'intera configurazione con il contratto canonico prima di ogni cancellazione: sezione di tipo errato, riferimento a un ID inesistente, duplicati, indice legacy non risolvibile, metadato di trasporto o versione di schema incoerenti fanno rifiutare l'intera operazione con `CONTACTS_QR_UNVERIFIABLE`, senza modificare profilo, selezione QR o ricevute; un riferimento posizionale legacy che la cancellazione sposterebbe è rifiutato con `CONTACTS_QR_INDEXED`, mentre un indice realmente risolto vale come selezione. Prove aggiunte: undici casi unitari di configurazione non verificabile, il caso del riferimento posizionale spostato, i tre esiti nella sorgente, il divieto nel view e la matrice equivalente sull'emulatore con confronto di profilo, selezione e ricevute dopo ogni rifiuto. Rischi residui: il contratto canonico è l'unica autorità e non riconcilia letture divergenti della stessa impostazione; un indice legacy risolvibile blocca solo le cancellazioni che lo sposterebbero; un'impostazione non leggibile disabilita le cancellazioni in modo conservativo anche se il contatto non è incluso.

### Editor utenze annidate (A3) — laboratorio 18/09/2026

Censimento in `docs/A3_CENSIMENTO_UTENZE.md`. Le utenze vivono **dentro** l'indirizzo padre (`userAddresses[].utilities[]`); il writer reale espone `type` e `value`, cifra **solo `value`**, assegna `utility-<uuid>` alle righe nuove e lascia al modello di lettura un'identità legacy `utility-<idIndirizzo>-legacy-<hash>` che dipende dal contenuto e dalla posizione; i collegamenti Account stanno nella riga, i riferimenti inversi sull'Account, e il QR include l'indirizzo, non la singola utenza. **Nessuno schema aziendale equivalente esiste**: «utility» nei moduli aziendali è solo un tipo di collegamento, quindi l'estensione aziendale richiederà un contratto separato e non è stata inventata. Consegnati contratto/allowlist dedicati, preparazione e servizio transazionale con indirizzo padre, revisione propria, impronta dell'intera riga, ricevuta idempotente e retry: il servizio sostituisce solo l'array `utilities` dell'indirizzo interessato, quindi indirizzo padre, altre utenze, altri indirizzi e campi sconosciuti restano intatti. Guardie: utenza collegata a un Account mai eliminabile, identità derivata mai indirizzabile, nessuna guardia QR sulla singola utenza: la tessera pubblica solo la riga ``ADR`` dell'indirizzo e non le utenze (correzione A3-R1). Prove: **6 nuove prove unitarie**, `npm run test:vault-shell` **712/712**. Restano da consegnare, dichiarati nel rapporto: editor sotto l'indirizzo padre, endpoint e Rules candidate, suite emulatrici e scenario browser. Rollback: rimuovere i moduli candidati e le prove. **A3 resta in laboratorio e non concluso**; nessun deploy, bump o dato reale.
Editor indirizzi (A2) — laboratorio 17/09/2026: censimento dei due schemi reali in `docs/A2_CENSIMENTO_INDIRIZZI.md`. Indirizzi **privati** in chiaro con le sole utenze annidate cifrate nel `value`, identità nuova `address-<uuid>` e identità legacy sintetizzata dal modello di lettura come `address-legacy-<hash>` (dipende anche dalla posizione), `isPrimary` esclusivo. Indirizzi **aziendali** come sede fissa in campi top-level e sedi ripetibili `altreSedi[]`, tutte in chiaro, con id legacy `sede-<indice>` riscritto dal form, pubblicazione sulla tessera decisa da `qrConfig.qrLegale` e dal `qr` di riga, nessun collegamento Account. Consegnati contratti/allowlist separati, preparazione e servizi transazionali con revisione propria, impronta dell'intera riga (o dell'intera famiglia della sede), ricevuta idempotente, retry e letture prima delle scritture: un indirizzo con utenze o collegamenti non si elimina, un'identità derivata non è indirizzabile nemmeno da una richiesta a mano, una configurazione QR non risolvibile blocca l'eliminazione in fail-closed, una sede pubblicata non si elimina, la sede fissa si aggiorna campo per campo e non si cancella, e utenze, collegamenti, campi sconosciuti, `qrConfig` e contatti restano intatti. Prove: **14 nuove prove unitarie** (8 private, 6 azienda), `npm run test:vault-shell` **705/705**. Completamento A2-R1: montaggio dell'editor indirizzi nelle due linguette Indirizzi (privato e azienda) con sorgenti revocabili separate, vista condivisa, provider, doppia conferma, scarto locale delle righe nuove, sola consultazione offline e motivazione visibile delle guardie (utenze, Account, tessera digitale); endpoint loopback `applyPrivateAddressesMutation`/`applyCompanyAddressesMutation`; Rules candidate di laboratorio; suite emulatore `--profile-addresses` con transazioni reali (2/2); scenario browser dedicato `--profile-addresses-browser` con **27 controlli per profilo** su privato e azienda, superato su Chrome 152 ed Edge 153 con **profilo desktop 1280×800 e profilo mobile 390×844 (dpr 3)** emulati via DevTools e identità di ogni esito = coppia (browser, profilo), in due esecuzioni consecutive. Difetto reale trovato dal montaggio e corretto: nella sorgente privata una riga con identità derivata restava modificabile invece che solo consultabile. Restano aperti trasporto produttivo, Rules autorizzate, prova su dispositivo fisico. A2 resta in laboratorio e non concluso; nessun deploy, bump, master, Rules/Functions produttive o dato reale.

Contatti aziendali (A1b) — laboratorio 17/09/2026: la linguetta **Contatti aziendale** del profilo aziendale della shell di laboratorio ha ora un editor con lo stesso comportamento del profilo privato A1 — doppia conferma dell'eliminazione, scarto locale della riga nuova mai salvata senza richiesta, sola consultazione offline, etichette aziendali migliori conservate — ma **senza convertire l'azienda nel formato privato**. Il contratto di mutazione e la preparazione cifrata sono separati e seguono la classificazione reale di `ma_save.js`: solo `password` è cifrata, `tipo`/`email`/`note` restano in chiaro e `telefonoAzienda`/`faxAzienda`/`referenteCellulare` sono stringhe top-level, mai oggetti. Slot fissi **svuotabili ma non cancellabili**; righe `emails.extra` create, modificate ed eliminate solo con identità stabile persistita (`company-email-<uuid>`), mai ricavata dall'indice; righe legacy senza identità stabile visibili e non modificabili. Guardie fail-closed: non si svuota uno slot collegato a un Account, pubblicato sulla tessera digitale o il cui valore visibile è il fallback legacy `aziendaEmail` (che resta di sola consultazione); un `qrConfig` non leggibile blocca ogni svuotamento ed eliminazione senza impedire la consultazione. Servizio transazionale candidato con revisione separata, impronta dell'intera riga, letture prima delle scritture e ricevuta idempotente in `mutationResults/{uid}/operations/company-contacts-{operationId}`; campi sconosciuti, chiavi ignote dentro `emails`, password legacy, `phoneAccountLinks`, `linkedAccountId`/`linkedAccountCompanyId` e `qrConfig` preservati. Rules candidate solo negli emulatori e endpoint loopback `applyCompanyContactsMutation`. Correzione di un difetto del contratto consegnato: lo svuotamento di uno slot telefonico stringa lo diffondeva in un oggetto posizionale distruggendo il record. Prove: **31 nuove prove unitarie** e **2 prove emulatrici** con transazioni Firestore reali (`--profile-company-contacts`), `npm run test:vault-shell` **691/691**, più uno **scenario browser sintetico dedicato** (`--profile-company-contacts-browser`, 22 controlli: rendering con etichette aziendali, salvataggio confermato e riletto nella stessa linguetta, scarto locale senza richiesta, doppia conferma, guardie Account/QR e configurazione ambigua, offline consultativo, revoca su cambio sezione/lock/logout/cambio UID, risposta tardiva ignorata, zero errori di console) superato su **Chrome 152 ed Edge 153** in due esecuzioni consecutive. Il montaggio ha rivelato e fatto correggere un difetto della vista: l'etichetta aziendale della riga non era resa, quindi gli slot fissi erano indistinguibili. Restano aperti trasporto produttivo, Rules autorizzate, prova su dispositivi e collegamento del salvataggio al bridge reale in browser; A1b resta in laboratorio e non concluso. Nessun deploy, bump, master, Rules/Functions produttive o dato reale.

Allegati dei documenti privati — contratto candidato (DS-002A) — 17/09/2026: preparato in laboratorio il confine perché un documento digitale privato possa avere zero o più immagini cifrate, **senza interfaccia e senza upload reali**. Contratto e validatori con allowlist MIME (JPEG/PNG/WebP/HEIC/HEIF), 10 MiB per immagine, 10 immagini per documento e documento con ID persistito univoco; metadati in `users/{uid}/profileDocumentAttachments/{attachmentId}` senza nome originale, URL o byte; percorso Storage `users/{uid}/profile-documents/{documentId}/attachments/{attachmentId}` derivato dal contesto autenticato; envelope v1 `AES-GCM-256`/`HKDF-SHA256+A256GCM` con **AAD contestuale** (versione, UID, documento, allegato, percorso) che non riusa la costante degli allegati Account; capacità binaria revocabile che azzera sempre il plaintext e non vede mai la Vault Key; comandi immutabili senza byte/chiave/nome con ricevuta idempotente; macchina a stati upload/cancellazione con esiti `confirmed`/`compensated`/`incomplete` e compensazione degli oggetti orfani, senza dichiarare atomicità fra Firestore e Storage; proiezione di sola lettura con record non verificabili separati, disponibilità solo online e revoca dopo ogni attesa; byte mai in cache offline. Prove: 35 nuove prove unitarie; nessun emulatore e nessuna verifica browser, perché non esiste interfaccia. Resta a DS-002B: trasporto callable con Auth/App Check e adattatori reali, sigillo binario reale, irrigidimento autorizzato delle Rules (`firestore.rules` ammette ancora la scrittura diretta del proprietario su `profileDocumentAttachments`) e decisione sul marcatore oggetto richiesto da `storage.rules`, pulsante Allegato con galleria/apertura/eliminazione e revoca degli Object URL, cestino-retention e interazione con backup/ripristino, gate §16. Candidato **non montato** e non attivo in produzione: nessun deploy, bump, dato reale o modifica a master, Rules e Functions produttive.

Allegati dei documenti privati — revisione DS-002A-R1 — 17/09/2026: dopo la revisione Codex, il servizio candidato è stato corretto su sei punti. Tutte le transazioni eseguono le letture prima delle scritture (il fake unitario ora **rifiuta read-after-write** e una nuova suite su **Firestore Emulator** lo prova con transazioni reali). La prenotazione legge il **profilo autorevole** e richiede che `documentId` identifichi esattamente una riga persistita. Il limite di dieci immagini è deciso **atomicamente** nella stessa transazione con una lettura transazionale limitata, quindi due caricamenti concorrenti non possono superarlo (nessun contatore da compensare). Il confine fidato copia i byte e ne calcola lo SHA-256 confrontandolo con il digest del comando **prima** della scrittura, e un oggetto già presente con byte diversi non viene mai sovrascritto (`OBJECT_CONFLICT`). La cancellazione valida l'**intero record canonico** (proprietario, documento, ID derivato, percorso, digest, schema, stato, envelope) e non il solo digest. `recover()` promuove o elimina soltanto oggetti **dimostrati dal digest** registrato nella ricevuta (`objectDigest`), lasciando bloccato ciò che non è dimostrabile. Prove: 42 unitarie più la suite `npm run test:profile-document-attachments-emulators` (caricamento idempotente, documento non univoco, corsa sul decimo posto, cancellazione validata, recupero con digest). Il candidato resta **non montato** e non attivo in produzione: nessun deploy, bump, dato reale o modifica a master, Rules e Functions produttive.

Allegati dei documenti privati — revisione DS-002A-R2 — 17/09/2026: chiusura delle **finestre TOCTOU** fra verifica e scrittura segnalate dalla seconda revisione Codex. Le ricevute di caricamento e cancellazione hanno ora **validatori canonici** — allowlist esatta per tipo, percorso ricalcolato da proprietario/documento/allegato, digest di operazione, digest dell'oggetto (`objectDigest`/`expectedDigest`), `objectSize`, stato ammesso e `readyAt`/`removedAt` presenti solo nello stato che li possiede; l'`id` di trasporto è tollerato solo se coincide con il nome derivato `profile-document-attachment-<operationId>` — e una ricevuta non conforme resta **bloccata**: `recover()` la conta come `incomplete` senza toccare record o Storage. La ricevuta registra la **dimensione cifrata** dell'oggetto (misurata nel confine fidato, distinta dai byte originali del documento): se il trasporto riporta la dimensione deve coincidere, se non la riporta la proprietà è dimostrata dal solo digest, e digest o dimensione discordanti non permettono promozione, sovrascrittura o cancellazione (`OBJECT_CONFLICT`; dimensione di trasporto non conforme → `OBJECT_UNVERIFIABLE`). La finalizzazione del caricamento rilegge **nella stessa transazione** record e ricevuta e riprova l'intera coerenza con il comando (proprietario, documento, allegato derivato, percorso, MIME, dimensione, digest, envelope campo per campo, stato `reserved`): un valore cambiato dopo la prenotazione produce `FINALIZE_CONFLICT` e nulla viene promosso. Stessa regola per la cancellazione, che non cancella un record sostituito dopo la verifica e non rimuove metadati se la ricevuta non è più canonica. `recover()` non separa più verifica e scrittura: rilegge entrambi nella transazione finale, rimuove l'oggetto solo dopo una prova **immediatamente precedente** di digest e dimensione e non cancella mai un record che non riesca a riprovare come proprio e `reserved`. Prove: 11 regressioni unitarie aggiuntive (hook che muta record, ricevuta o oggetto esattamente fra la prova e la transazione, per caricamento, cancellazione e recupero; ricevute non canoniche; dimensioni discordanti), **53 unitarie** in totale, **8 prove su Firestore Emulator** e `npm run test:vault-shell` **617/617**. Il candidato resta **non montato** e non attivo in produzione: nessun deploy, bump, dato reale o modifica a master, Rules e Functions produttive.

Allegati dei documenti privati — DS-002B, primi due blocchi — 17/09/2026: consegnati in due blocchi revisionabili, **senza montare nulla in `Frontend/public/**`**. Blocco 1 (`0bb19c60`): cifratura binaria **reale** (AES-GCM-256 con chiave-file casuale avvolta da HKDF-SHA256 sul materiale della Vault Key e AAD contestuale, azzeramento di chiavi e bit derivati su ogni percorso); la sessione espone `sealImage`/`openImage` con le stesse verifiche di `read`/`encrypt` e la capacità binaria apre ciò che ha sigillato; il trasporto riporta la **versione nativa** dell'oggetto e la cancellazione è condizionata alla versione appena verificata; **adattatori reali** Firestore e Firebase Storage (`ifGenerationMatch: 0` in creazione, lettura con digest, dimensione e versione); **Rules candidate** ancorate ai file produttivi (record degli allegati leggibili dal solo proprietario e non scrivibili dal client, oggetti Storage confinati allo UID con marcatore `encrypted: 'v1'` e envelope di 10 MiB più overhead). Blocco 2 (`c826ff3e`): sorgente revocabile della galleria — una sola anteprima, Object URL revocato e plaintext azzerato a chiusura, blocco, logout, cambio UID, annullamento e `dispose`, caricamento file per file con esito distinto, nessuna scrittura offline — e interfaccia con azione **Allegato** accanto a Modifica e Cestino, selezione multipla, galleria con Apri e Cancella, anteprima con Chiudi e messaggio esplicito per i documenti senza ID persistito univoco. Prove: 80 unitarie della fetta (`npm run test:vault-shell` 644/644), 8 su Firestore Emulator e 9 sulla nuova suite emulatrice `auth,firestore,storage`. Due riscontri: l'**emulatore Firebase Storage non applica `ifGenerationMatch`** (la suite lo asserisce, quindi la verifica della versione è dell'adattatore e la garanzia atomica resta da provare su Cloud Storage reale) e le **Rules Storage concedono l'accesso se una qualsiasi regola corrisponde**, quindi la regola generica del proprietario copre ancora il percorso degli allegati: chiuderlo richiede un modello esplicito per collezione, decisione di deploy non presa. Il servizio resta fail-closed su entrambi i punti. Montaggio nella pagina di laboratorio e scenario browser sintetico non sono compresi nei due blocchi pubblicati. Candidato **non montato** e non attivo in produzione: nessun deploy, bump, dato reale o modifica a master, Rules e Functions produttive.

Allegati dei documenti privati — DS-002C, pannello montato e scenario browser — 17/09/2026: la sezione Documenti della pagina di laboratorio monta ora il pannello **Allegati** con un provider che riusa capacità di sessione, lettore, sorgente, vista e pianificatori di DS-002B, senza duplicare decisioni. Il montaggio ha fatto emergere **due difetti reali nella sorgente**, corretti su prova dei test: l'identità dell'allegato era letta da un campo che il contratto non ammette (ora è derivata dal percorso dal validatore canonico) e il pianificatore di cancellazione riceveva i metadati canonici invece del record. Lo scenario **browser sintetico** gira su **Chrome ed Edge** con 13 controlli superati: due righe con Modifica, Cestino e Allegato, messaggio per il documento senza ID persistito, focus da tastiera, selezione multipla, caricamento con sigillo reale nel browser, galleria aggiornata, anteprima con Object URL e sua revoca alla chiusura, offline in sola consultazione, cancellazione, revoca al cambio vista e **nessun errore di console**. Lo scenario gira su fixture e sigillo reale; il trasporto Firestore/Storage resta provato dalle suite emulatrici. Prove: `npm run test:vault-shell` **649/649**, `npm test` completo, suite emulatrici 8/8 e 9/9, `git diff --check` pulito, inventario rigenerato (708 file). Restano fuori: emulazione mobile e prova su dispositivo reale, trasporto di produzione con Auth/App Check, applicazione autorizzata delle Rules e verifica delle precondizioni di generazione su Cloud Storage reale. Nessun deploy, bump, dato reale o modifica a master, Rules e Functions produttive.

## Stato corrente — chiusura documentale 15/09/2026

Collegamenti montati dopo `781c7974`: azioni Collega/Cambia/Scollega nei contatti e nelle origini private supportate, selettore ricercabile personale/azienda, conferma e rilettura senza reload. Controllo delle code del vecchio/nuovo Account, revoca e UID atteso lungo la richiesta. Offline sola consultazione. Prove e limiti nella roadmap profili; creazione Account ed editor completi restano aperti, nessun deploy.

Note montate dopo `e21202ac`: nuovo editor nel dettaglio per Account personali collegati/aziendali, penna o Aggiungi nota, salvataggio/svuotamento con rilettura immediata. Coda M6 consultata senza invio, recupero pendente mantenuto e vecchio editor isolato invariato. Chrome 99 verifiche online/offline/riavvio superate; quattordici nuove prove unitarie. Prossimo montaggio azioni di collegamento nei profili; limiti e gate nella roadmap, nessun deploy.

Editor nota dopo `713127a1`: sorgente/provider per Account personali/aziendali, sola consultazione offline, salvataggio/svuotamento online e pulizia del testo. Impone controllo esplicito della coda pendente, senza modificarla; dieci prove aggiunte. Da collegare adapter reale della coda, dettaglio e azioni di collegamento; nuovo provider non ancora montato nel browser. Nessun deploy.

Compatibilità note dopo `053440f7`: servizio candidato aggiorna solo la nota cifrata, revisione/schema/timestamp e ricevuta; conserva collegamenti, banca e campi sconosciuti. UID atteso e impronta della nota proteggono cambio utente e modifiche legacy. Vecchio percorso M6 invariato; montaggio editor e recupero della coda ancora da integrare. Otto prove unitarie e test Firestore dedicato, nessuna UI produttiva o deploy.

Selettore dopo `0babf0c9`: ricerca per nome Account/azienda e filtro personali/azienda, identità distinta anche con ID uguali e possibilità di scegliere Account già collegati. Lettore e vista revocabili, soli nomi decifrati, dodici prove aggiunte. Chiuso anche il mancato rifiuto del flag `isExplicitMemo` nelle destinazioni del servizio candidato. Da completare compatibilità editor e montaggio integrato; nessuna nuova prova browser attribuita, nessun deploy.

Sorgente collegamenti dopo `8d5be66d`: relazione consultabile offline e preparazione online revocabile, con confronto di revisione/impronta e richieste immutabili senza decifrare credenziali. Sei nuove prove; selettore e montaggio ancora da completare. Verificata e documentata incompatibilità del vecchio editor M6 con i metadati dei collegamenti, da risolvere senza scartarli. Prossimo selettore/adattatori e compatibilità editor; nessun deploy.

Collegamenti dopo `520aafd2`: preparato servizio atomico per origine, vecchio/nuovo Account e ricevuta, preservando credenziali e altri riferimenti. Undici prove unitarie ed emulatori dedicati; suite completa npm test superata (456 test shell). Nessun writer produttivo o UI montata. Prossimo sorgente/selettore Collega/Cambia/Scollega, con limiti di schema e compatibilità metadati nella roadmap profili; nessun deploy.

Editor anagrafica dopo `6cca03f5`: testi/note modificabili nei due profili del laboratorio, con cifratura, refresh confermato e pulizia dei controlli. Offline in sola consultazione. Undici nuove prove unitarie; suite completa npm test superata (445 test shell) e 94 verifiche Chrome online/offline e dopo riavvio superate; Edge/iPhone restano aperti. Proseguire collegamenti e restanti editor; perimetro e gate nella roadmap profili, nessun deploy.

Anagrafica dopo `7bb38823`: preparati patch cifrata e servizio transazionale per testi/note privati e aziendali, senza toccare contatti/collegamenti. Confronto revisioni e impronte, ricevuta idempotente e Rules candidate solo negli emulatori. Dodici nuove prove unitarie; suite completa npm test superata (434 test shell), senza nuova prova browser del servizio non montato. Editor e trasporto da montare nel laboratorio, nessuna modifica produttiva; perimetro e limiti nella roadmap profili.

Editor QR aziendale dopo `81cc50d6`: montati sorgente/provider revocabili, vista comune e trasporto limitato alle fixture. Otto nuove prove unitarie, integrazione con retry dopo conferma persa; suite completa npm test superata (422 test shell) e 90 verifiche Chrome online/offline e dopo riavvio superate; Edge/iPhone restano aperti. Selezione righe aggiuntive e gate produttivi ancora aperti; proseguire parità editor/collegamenti. Dettagli nella roadmap profili, nessun deploy.

Selezione QR aziendale dopo `a2a0252a`: servizio transazionale candidato per i quattordici flag fissi, ricevuta idempotente e confronto delle modifiche legacy. Dieci test unitari ed emulatori superati, suite completa npm test superata (414 test shell). UI non montata; Rules produttive invariate, overlay solo laboratorio e flag delle righe aggiuntive ancora esclusi dal servizio. Riprendere sorgente/editor aziendale; nessun deploy. Perimetro e limiti nella roadmap profili.

Scheda PDF aziendale dopo `d62e74d8`: scelta gruppi, generatore locale separato, anteprima testuale e download/condivisione con fallback. Sedici nuove prove, suite completa (404 shell), 90 verifiche Chrome e controllo visivo PDF sintetico di tre pagine superati. Nessun dato reale o invio; iPhone/WhatsApp/email reali ed Edge restano da collaudare. Dettagli e limiti nella roadmap profili; riprendere editor profili/collegamenti e residui MD, senza deploy.

Montaggio editor QR dopo `fb207a4e`: salvataggio/rilettura e consultazione offline verificati nel browser del laboratorio con trasporto limitato alle fixture e overlay Rules. Corretto il metadato id del repository; due regressioni, suite completa (388 shell) e 90 verifiche Chrome superate. Gate produttivo/App Check, writer legacy ed Edge/iPhone aperti. Proseguire con scheda PDF aziendale richiesta in `45110a0e`; nessun deploy.

Editor QR dopo `686b1f1c`: sorgente, vista e controller con revoca/retry preparati; suite completa superata (386 shell), sedici nuove prove e integrazione Firestore demo con conferma persa. Provider non ancora montato nel browser: adapter attendibile, transizione Rules/writer legacy e collaudi UI restano aperti. Nessun deploy o nuova prova browser attribuita; dettagli nella roadmap profili.

Preparazione selezione QR dopo `5fc9c8f2`: contratto privato e servizio transazionale candidato, sette nuove prove, suite completa (370 shell) e concorrenza/Rules su emulatori superate. Nessuna attivazione runtime: adapter callable, interfaccia e migrazione dei writer legacy restano da completare. Overlay Rules solo nel test; nessun enforcement HTTP dimostrato o deploy. Perimetro nella roadmap profili.

QR dopo `e7f70061`: telefono aziendale selezionabile esplicitamente, escluso per default nelle configurazioni precedenti. Lettore shell non decifra il numero non selezionato. Due regressioni e suite completa superate (363 shell), senza nuova attribuzione di prove browser. Proseguire con editor selezione shell e Rules ristrette; foto aziendale e restanti gate aperti. Nessun deploy.

Tessera aziendale dopo `104aefc9`: vista QR/download condivisa, lettore dedicato sulla selezione salvata e generatore canonico. Suite completa superata (362 shell), 90 verifiche Chrome online/offline e dopo riavvio. Restano editor selezione/profili e parità campi QR (telefono aziendale/foto non previsti dal generatore attuale), Widget aziendali, Edge/iPhone. Dettagli nella roadmap profili; nessun deploy.

Tessera privata successiva a `f439cb61`: QR e vCard dalla selezione salvata, letture revocabili e pulizia anteprima. Suite completa superata (355 shell), 90 verifiche Chrome online/offline e dopo riavvio. Restano tessera aziendale, editor della selezione/profili, Widget aziendali e collaudi Edge/iPhone; dettagli nella roadmap profili. Nessun deploy o chiusura del programma.

Preparazione tessera dopo `cc6ff020`: generatore vCard limita autonomamente i tipi Widget esportabili, rifiuta classificazioni ambigue e impedisce nuove proprietà tramite CR/LF nei valori. Due regressioni, 141 test profilo e suite completa superati (343 shell). Tessera della shell ancora da montare; prossimi passi nella roadmap profili. Nessun dato reale o deploy.

Widget personali dopo `16dae6f1`: consultazione nelle linguette, ordine conservato, collasso locale e anteprime protette. Suite completa superata (341 shell), suite shell finale 343 e 90 verifiche Chrome superati. Corretto solo il formato della fixture sintetica; nessuna migrazione. Widget di profilo aziendale ancora da progettare con schema/Rules propri: non riutilizzare quelli personali. Proseguire con tessera digitale mantenendo aperti editor, estensione aziendale ed Edge/iPhone. Dettagli nella roadmap profili; nessun deploy.

Panoramica dopo `530c991a`: linguetta iniziale personale/azienda con modello canonico, contatti principali, riepilogo fiscale/documentale e aperture interne. Otto nuove prove, 329 shell, suite completa e 90 verifiche Chrome superati; limiti del collaudo e gate Edge/iPhone nella roadmap profili. Proseguire con Widget di profilo, tessera e parità editor. Nessuna modifica produzione o dichiarazione di programma concluso.

Note anagrafiche dopo `1fc6e357`: campo canonico privato ora consultabile nella shell e cancellato dai nodi al cambio linguetta. Quattro prove aggiuntive, 321 shell e 90 verifiche Chrome superati, compresa prima visita offline dopo riavvio. Editor del profilo ancora aperto; proseguire con Panoramica, Widget e tessera. CI del precedente `1fc6e357` superata (34998077954); il workflow esegue `npm test` e non sostituisce la matrice browser/Edge. Dettagli nella roadmap profili; produzione invariata.

Vista bancaria successiva a `33e4b1b1`: ogni conto contiene i propri Widget tra dati del conto e carte. Suite completa con 317 shell e 90 verifiche Chrome superati, incluso recupero note dopo navigazione e arresto/riapertura offline. Edge non verificato: il browser locale termina prima dell'endpoint DevTools; il runner conserva entrambi i browser per default e consente diagnosi mirata esplicita. Gate e limiti nella roadmap profili. Proseguire con parità profili, mantenendo aperta la verifica Edge. Nessun rilascio o chiusura del programma.

Correzione della coda del laboratorio dopo `3d11e6eb`: la chiusura di una vista revoca subito il client, ma attende la conclusione delle operazioni pendenti prima di chiudere IndexedDB. Il coordinatore può così rilasciare il lease anche dopo un annullamento; chiudere prima la connessione poteva impedire tale rilascio e bloccare temporaneamente il recupero nella vista successiva. Due regressioni deterministiche (risoluzione e rifiuto pendenti), cinque test del modulo superati. Suite completa superata nel working tree che comprende anche la vista bancaria ancora da consolidare (317 shell): non attribuire la parità bancaria a questo solo fix. Le prove browser del nuovo incremento restano aperte: Chrome ha superato 58 verifiche entry prima del fix e 32 dopo arresto/riapertura con il fix; Edge ha incontrato un timeout di avvio DevTools nelle prove entry. Non è dimostrato che il problema intermittente dell'editor avesse questa sola causa. Nessuna modifica al database reale o alla produzione; rollback limitato al factory della coda sperimentale.

Lettore bancario successivo a `5f17a9a2`: capability revocabili per conti e carte, modello canonico, nessuna creazione di ID durante la consultazione. 13 prove mirate e contratto Vault completo superati (312 shell). La vista bancaria e gli host Widget sono il prossimo passo; questo sottoblocco non è ancora montato nel browser. Nessun deploy.

Vincolo Widget/conto successivo a `6b952fe5`: letture rifiutate con genitore bancario assente o ambiguo e dopo rimozione/spostamento concorrente. 299 test shell superati. È un sottoblocco preparatorio: modulo bancario completo e restante programma MD ancora aperti. Proseguimento per commit verificati confermato da Diego; nessun deploy.

Widget, consultazione integrata dopo `0d31c777`: Widget Account e credenziali comuni presenti nel dettaglio della shell, letture revocabili e comandi legati alla classificazione corrente dei campi. Fixture non vuote, suite completa e 296 shell superati; 108 verifiche entry più 62 arresto/riapertura Chrome/Edge, 170 totali. Prossimo blocco: modulo bancario con Widget nel rispettivo conto, seguito dalla parità restante. Limiti nella roadmap profili; non è un rilascio né chiusura dell'intero programma.

Excel, primo adeguamento dopo `45deb058`: verificato il ramo recuperato `40052515`, aggiunta proiezione sperimentale con mascheramento PUK/Widget e revoca sulla sessione. Suite completa superata, 290 shell. Servizio Excel originale non integrato; generazione/consenso/download e parità allegati ancora aperti. Perimetro e rischi in [M8](../docs/M8_BACKUP_RECUPERO.md#esportazione-excel-separata-dal-backup--candidata-15092026). Nessun deploy.

Sottoblocco Widget successivo a `8a664499`: lettore revocabile per Widget incorporati e credenziali comuni, senza gestore legacy o valori restituiti nell'elenco. 15 test mirati e 278 shell finali superati; suite completa superata prima dell'ultimo affinamento, poi suite shell rieseguita. UI e fixture browser non vuote restano il prossimo lavoro, come descritto nella roadmap profili. CI della directory `8a664499` superata (34951205896); nessun deploy o chiusura del programma.

Incremento directory aziende successivo a `b3b07769`: selezione generica con ricerca e apertura di profilo/Account, contesto aziendale preservato anche con ID Account uguali. Suite completa, 263 test shell e 156 verifiche browser superati. Il commit precedente `b3b07769` ha superato CI GitHub 34950037514; il risultato del nuovo commit va verificato separatamente. Prossimo blocco autonomo: Widget e credenziali comuni nella shell. Produzione invariata, nessun deploy.

Stato successivo: [proseguimento autonomo nel piano](../docs/PIANO_MATURITA_PROFESSIONALE.md#proseguimento-autonomo--stato-15092026-dopo-17a1236a). Completati consultazione aziendale, preparazione offline automatica e incremento utenze personali; ordine dei residui esplicito. Ultimo incremento: suite completa, 253 test shell e 146 verifiche browser superati. I risultati dei primi due commit sono confermati anche da CI GitHub. Nessun deploy, nessuna dichiarazione di programma completo.

Proseguimento autorizzato dall'utente: portare avanti autonomamente le attività lavorabili degli MD e annotare i gate che richiedono intervento, continuando sulle attività indipendenti. Incremento azienda successivo a `199441d0`: stessa vista profilo per i due domini, adapter canonico e credenziali collegate; suite completa, 240 test shell e 136 verifiche browser superati. Perimetro e residui in [Roadmap profili](../docs/PROFILO_ACCOUNT_WIDGET_CACHE_ROADMAP.md#candidata-shell-profilo-aziendale-in-consultazione--15092026). La chiusura sotto è il checkpoint precedente, non il termine del programma.

Chiuso e pubblicato l'incremento `054b045d` della candidata shell; CI GitHub 34947029981 riuscita. Voci completate, gate ancora aperti e prossimo lavoro sono nel [riepilogo autorevole del programma](../docs/PIANO_MATURITA_PROFESSIONALE.md#chiusura-documentale-dellincremento-054b045d--15092026). Nessun deploy o chiusura complessiva del programma; VS-P0-01 resta aperto in produzione. La revisione documentale corregge intestazioni obsolete, senza cambiare requisiti o riscrivere gli audit passati.

## Fotografia storica — riallineamento documentale 12/09/2026, v1.2.110

Questa sezione precede il diario storico. Le vecchie istruzioni V7/V8, le fasi preliminari e i conteggi valgono per la data o la versione indicata; non sono comandi da eseguire oggi. Le indicazioni operative sono nella [guida tecnica](./GUIDA.md) e nei contratti specialistici.

- Guida tecnica riallineata: nessuna bonifica massiva, PDF con segreti o scelta libsodium/24 parole implicita; semantica distinta fra credenziali Account e altri campi protetti.
- Stati M6–M9 riconciliati con i rispettivi contratti. M4 resta chiusa per l’accettazione storica; la matrice estesa resta M10.
- Release 1.2.101–1.2.110: selezione Account migliorata; note e credenziali collegate nei contatti; profilo aziendale a linguette; riuso, cambio e scollegamento; azioni compatte; distinzione autofill; QR con foto e riepilogo del contatto; composizioni condivise tra profili.
- La superficie canonica comprende 30 pagine, incluso `contatto_condiviso.html`. Inventari rigenerati con gli script del progetto.
- Restano aperti sessione Vault, validazione delle scritture, recupero backup interrotto, inventario reale, consultazione bancaria offline e verifiche Firebase/dispositivi.
- La revisione modifica documentazione e testo del generatore dei report; non modifica comportamento applicativo, dati, Rules o Functions e non certifica un nuovo rilascio.

## Diario storico

### Blocchi offline, Archivio e backup verificati — 13/09/2026

Commit `51f43532`, `1b8ada9d`, `273de41b`: modifica offline fuori perimetro sospesa con scelta esplicita, pulizia riferimenti dopo purge con distinzione privato/azienda, ripristino backup legato a sessione e proprietario verificato dal server. Suite completa 700 test. Produzione 1.2.117 invariata; nessuna migrazione o pubblicazione backend. Il vincolo `expectedOwnerUid` richiede distribuzione coordinata. Limiti e prossimo blocco nell'audit Vault §42.

### Checkpoint multi-commit verificato — 12/09/2026

Commit `3f40efbc` e `59ebff4e`: riferimenti inversi dei Profili controllati prima della mutazione privata; ciclo di vita widget e dialoghi invalidato a blocco/logout/cambio vista; renderer bancario differito entro budget. Suite completa 669 test, 30 pagine entro budget. Produzione 1.2.117 invariata. Scala della scansione aziende, alias, dispositivi fisici e distribuzione/rollback restano aperti. Evidenze e limiti nell'audit Vault §41.

### Ripresa per commit verificati — 12/09/2026

Sul ramo sperimentale: recupero sicuro delle code legacy, sostituzione atomica, controlli del record corrente e caricamento differito degli editor Profilo. Suite completa: 642 test. Produzione resta 1.2.117. I gate fisici e di distribuzione/rollback sono esplicitamente separati dai blocchi indipendenti; vedere [audit §39–40](../docs/AUDIT_VAULT_SESSION_P0.md#39-ripresa-autonoma-per-blocchi-verificati--12092026). Nessuna nuova migrazione o pubblicazione backend.

### Caricamento iniziale Dati azienda — 12/09/2026

Release 1.2.117: i pannelli delle linguette non attive sono nascosti già nell’HTML. Evita la comparsa temporanea delle vecchie sezioni tutte insieme prima del caricamento dati e dell’attivazione della linguetta memorizzata. Nessuna modifica ai dati o al percorso di collegamento email/Account. Verificati stato iniziale dei dieci pannelli, purezza HTML e budget pagine. Rollback Hosting alla 1.2.116.

### Stile del selettore widget — 12/09/2026

Release 1.2.116: il controllo chiuso torna allo sfondo trasparente degli altri campi; le opzioni mantengono testo contrastato su azzurro chiaro/blu coerente con le modali. Correzione esclusivamente CSS, senza modifiche a selezione, collegamenti o dati. Verificati CSS, versione, risorse offline e budget pagine. Rollback Hosting alla 1.2.115.

### Collegamento Credenziali comuni in creazione e modifica — 12/09/2026

Release 1.2.115: pulsante esplicito nei form privato e aziendale; in creazione salva prima l’Account e apre il selettore soltanto dopo l’esito positivo. Il menu Nuovo widget propone anche le Credenziali comuni già usate da altri Account e collega il record originale senza copiarne i valori. Esclude soltanto i collegamenti già presenti nell’Account corrente, includendo il contesto aziendale. Opzioni leggibili in tema chiaro/scuro e comando adattabile agli schermi stretti.

Sei nuovi test verificano riuso, isolamento del contesto, scadenza della sessione, errore senza creazione alternativa e percorso di salvataggio. Suite completa produttiva superata; nessuna migrazione dei dati o modifica di Rules/Functions. Rollback Hosting alla 1.2.114. Pubblicazione ed esito HTTPS registrati separatamente nell’audit.

### Widget comuni in Modifica Account — 12/09/2026

Correzione candidata: i form privato e aziendale montano anche le credenziali comuni (`shared-reference`), prima presenti soltanto nel dettaglio. Il comando di modifica dei valori aggiorna il record centrale con revisione e conferma esplicita dell'effetto su tutti gli Account collegati. Collegamento e scollegamento sono disponibili nel form; il dettaglio resta consultazione. Nessuna copia dei dati o modifica a Rules/Functions. Verifiche e rilascio registrati separatamente nell'audit Vault.

### Esiti di salvataggio verificabili — candidato locale, 12/09/2026

Base `a795b462`: correzione candidata della provenienza degli esiti e del riuso di operationId con payload diverso; nessuna modifica ai dati reali o pubblicazione di Rules/Functions. La coda conserva le modifiche quando la risposta non conferma l'applicazione. Recupero delle code pregresse e rollback sono gate prima del rilascio. [Audit §32](../docs/AUDIT_VAULT_SESSION_P0.md#32-provenienza-e-identità-degli-esiti-di-salvataggio--12092026).

### Compatibilità legacy e anteprima offline — 12/09/2026

Su base `553a35d5`, otto test dell’adattatore di sola lettura con crypto-utils reale e dati fittizi: verifier/envelope correnti, CPVK2, errori e cambi identità. Preparata anteprima Hosting separata di dieci file e verificato refresh/sblocco demo nel browser Windows con server fermo. Due test controllano inventario e worker. [Audit Vault §13](../docs/AUDIT_VAULT_SESSION_P0.md#13-compatibilità-e-anteprima-offline--12092026) conserva limiti e istruzioni; pubblicazione temporanea e collaudo iPhone ancora richiesti. App live invariata.

### Preparazione navigazione persistente — liste reali, 12/09/2026

Su base `321fec0b`, corretto l’accumulo dei gestori SwipeList nelle liste Account condivise privato/azienda e nell’Archivio. Aggiunti smontaggio esplicito, cancellazione timer e invalidazione dei reveal pendenti. Il laboratorio usa ora il renderer reale con dati fittizi, ricerca e mostra/nascondi; non integra ancora le pagine complete. Cinque nuovi test e suite completa verde. [Audit Vault §12](../docs/AUDIT_VAULT_SESSION_P0.md#12-componenti-reali-delle-liste--12092026) registra perimetro, prove e rollback. Nessun deploy.

### Laboratorio autorizzato 12/09/2026 — navigazione persistente

Creato prototipo separato su base `a6f756cc`, con due viste, chiave solo in RAM, hash/history e smontaggio controllato. Fixture fittizia senza Firebase o dati personali; 12 test aggiunti al gate Vault e prova browser Windows di navigazione, Indietro/Avanti, refresh e blocco. [Audit Vault §11](../docs/AUDIT_VAULT_SESSION_P0.md#11-prototipo-autorizzato--12092026) conserva istruzioni di avvio, limiti e gate per le vere pagine. App pubblicata e sessione produttiva invariati.

### Intervento locale 12/09/2026 — invalidazione sblocchi pendenti

Su base `67288cc3`, impedito alle operazioni Vault precedenti a logout/blocco/reset di ripubblicare chiavi o cancellare una sessione successiva; controllo UID e scadenza al termine della decifratura. Aggiunti 14 test di concorrenza al gate Vault. Formati e navigazione invariati, nessun deploy. [Audit Vault §9–10](../docs/AUDIT_VAULT_SESSION_P0.md#9-correzione-locale-del-12092026--operazioni-concorrenti) riporta prove, rollback, limiti e proposta del prossimo modello di navigazione.

### Intervento locale 12/09/2026 — pulizia prima del logout

Su base v1.2.110, completata la pulizia esplicita nei quattro comandi mancanti: Home, logout comune e due uscite del cambio password. Ora tutti i sette percorsi eliminano RAM/sessione Vault prima di `signOut`; test del logout riuscito e fallito e censimento automatico aggiunti al gate Vault. Nessun cambio di formato o dati, nessun deploy. Dettagli, rollback e gate ancora aperti in [Audit Vault §8](../docs/AUDIT_VAULT_SESSION_P0.md#8-correzione-locale-del-12092026--blocco-1-logout). La persistenza delle chiavi fra documenti resta da riprogettare.

> **Dipendenze:** [Guida progetto](../docs/GUIDA_PROGETTO.md) e [Architettura Sicurezza V1](../docs/ARCHITETTURA_SICUREZZA_V1.md)

Questo documento traccia nuove funzioni, refactoring, prove e attività aperte. Le sezioni possono descrivere epoche diverse: la dicitura “completato” vale soltanto per il perimetro e la versione indicati. Una decisione consolidata viene riportata nel contratto specialistico pertinente; `GUIDA.md` conserva le regole implementative e non prevale sulla baseline sicurezza.

---

## 1. ROADMAP: END-TO-END ENCRYPTION (E2EE)
L'obiettivo finale è la **conoscenza zero** (Zero-Knowledge Architecture).
- **Stato aggiornato (11/09/2026)**: la conoscenza zero è l’architettura obiettivo. Il runtime usa AES-GCM per i campi e gli allegati; il modello record-key/grant è dimostrato nel laboratorio M5 ma non ancora migrato in produzione.
- **Algoritmo**: `libsodium.js` era una proposta storica, non una decisione attiva. Algoritmi e formati possono cambiare soltanto tramite il contratto crittografico, migrazione verificata e audit indipendente.
- **Dettagli**:
    1. Cifratura sul dispositivo prima dell'invio a Firebase.
    2. Recovery Key: la proposta storica di 24 parole è superata dai formati descritti in M8; nessun nuovo formato approvato qui.
    3. Nessuna chiave sensibile memorizzata sui server Google.

## 2. REFACTORING IN CORSO: PROFILO PRIVATO & GLOBAL DECRYPT
Raffinamento dell'interfaccia utente e allineamento di sicurezza tra i moduli.
- **Stato**: ✅ Completato (Sincronizzazione sicurezza Home/Impostazioni).
- **Tasks**:
    - ✅ Risolto bug visualizzazione "Codici" (dati cifrati) in Home Page e Impostazioni.
    - ✅ Aggiunta logica `ensureMasterKey` + `decrypt` ovunque venga mostrato il nome profilo.
    - ✅ Verifica spaziature e padding (`pt-header-extra`, `pb-footer-extra`).

## 3. FEEDBACK UI & MICRO-ANIMAZIONI
Sezione sperimentale per nuovi effetti visivi.
- [ ] Implementazione transizioni fluide tra le tab di navigazione.
- [ ] Nuovo effetto "Shimmer" per il caricamento dei dati (Skeleton Screens).
- [ ] Raffinamento dei Toast di sistema con icone dinamiche.

## 4. GESTIONE ERRORI PWA & OFFLINE PERMANENTE
- **Stato**: ⚠️ In rivalutazione prestazionale (versione 1.2.38).
- **Dettagli**:
    - ✅ Attivata persistenza `IndexedDB` in `firebase-config.js` (Multi-tab support).
    - ✅ La shell statica e il runtime Firebase sono disponibili localmente tramite `sw.js`.
    - ✅ Le letture senza rete usano esplicitamente la cache Firestore.
    - ⚠️ La release 1.2.38 forza una sincronizzazione completa prima del rendering di ogni pagina privata: rende più affidabile il riempimento iniziale della cache, ma rallenta sensibilmente l'uso online e non rappresenta l'architettura definitiva.
    - ⚠️ La piena operatività offline end-to-end non è ancora certificata: deve essere verificata su login già persistente, sblocco Vault, liste, dettagli, navigazione, allegati, iPhone/PWA, PC e ritorno online.
    - ℹ️ Un nuovo login, TOTP, email, Push, inviti e download di allegati non già locali richiedono rete.

## 5. PROTOCOLLO SICUREZZA (V7.1 Hardened)
Definizione dei nuovi standard di accesso e protezione dati.

- **5.1 Autenticazione 2FA (Authenticator)**:
    - Obbligo di configurazione tramite App (Google/Microsoft Authenticator).
    - Generazione e stampa automatica dei dati di backup al primo avvio.
- **5.2 Sblocco Biometrico (Face ID)**:
    - Implementazione via WebAuthn per sbloccare il Vault senza digitazione manuale della Master Password (previo inserimento iniziale).
- **5.3 Timeout Inattività (12 Ore)**:
    - Fissata una soglia di 12 ore per il mantenimento della sessione attiva prima del blocco automatico del Vault.
- **5.4 Controllo Variazioni & Notifiche**:
    - Invio notifica di sicurezza per ogni variazione di Username/Password.
    - Obbligo di "ristampa" o download dei nuovi dati critici (QR 2FA, Vault Password) in caso di modifica.

---

## 6. MECCANISMI TEMPORANEI DI SICUREZZA (V8.0 Prodotto Blindato)
Con il rilascio della **V8.0**, l'app entra in uno stato di produzione "Blindato".

- **Configurazione Produzione (V8.0)**:
    - **Timeout "Subito" rimosso definitivamente**: L'opzione è stata eliminata da tutti i menu e la logica core (fallback su 1min per vecchi profili).
    - **Timeout Disponibili**: 1 min, 3 min (default), 5 min.
    - `DEV_MODE = false`: Opzione "12 ore" nascosta (visibile solo per test in DEV_MODE = true).
    - `SAFE_MODE = false`: Banner auto-cura e reset Vault sul Nome nascosti (interfaccia pulita).

- **Status Crittografia**:
    - ✅ Stabilizzata su Safari iOS 17.x grazie al protocollo Memory-Clean.
    - ✅ Regex `isEnc` ottimizzata per tolleranza Base64 senza log di debug.
    - ✅ Rimozione totale di console.log con dati sensibili (HEX, Salt, IV).

- **Roadmap Futura**:
    - Questa configurazione rimarrà la base stabile per la produzione. Le costanti `SAFE_MODE` e `DEV_MODE` fungeranno da interruttori di manutenzione rapidi.

---

## 7. CONTROLLI APERTI CONSOLIDATI

### Hardening P4 — settembre 2026

- Le dipendenze runtime del pacchetto principale non presentano vulnerabilità note (`npm audit --omit=dev`).
- Firebase Admin, Firebase Functions e Nodemailer sono aggiornati alle baseline compatibili con Node 22; le sole segnalazioni runtime residue delle Functions sono moderate e transitive nella catena Google Storage, senza aggiornamento compatibile disponibile.
- Il lint delle Functions è nuovamente operativo con configurazione ESLint flat ed è parte della suite `npm test`.
- I log di sviluppo non includono più email, UID, nomi account, payload cifrati o frammenti di ciphertext.
- Il fallback QR non usa più assegnazioni `innerHTML`.

Questa sezione sostituisce i vecchi report di audit e i documenti di migrazione V3 separati.

- 🟡 **P0 — Firestore Rules condivisioni (implementazione locale completata)**: dalla versione 1.2.6 la lettura condivisa richiede che l'UID dell'ospite sia presente in `sharedWithUids`; il solo `visibility="shared"` non concede più accesso. Gli ospiti non hanno permessi di scrittura sugli account condivisi. Restano obbligatori il collaudo con emulatori/progetto di test e la verifica del deploy effettivo di Rules e Functions prima del go-live.
- [ ] **P0 — Test regole**: eseguire i casi `permission-denied` della sezione 5.8 della `GUIDA.md` contro emulatori o progetto di test prima del go-live.
- [ ] **App Check**: il client reCAPTCHA è configurato; verificare nella Firebase Console che l'enforcement sia attivo per Firestore e Storage.
- [ ] **Compatibilità legacy**: verificare nel database l'assenza di record che dipendono da `shared`, `isMemoShared`, `hasMemo` o `sharedWithEmails`; solo dopo rimuovere i fallback di lettura dal frontend e dalle Rules.
- [ ] **Globali residue**: sostituire `window.deleteAccount`; mantenere soltanto le globali tecniche giustificate per Tailwind e il tema finché l'architettura attuale le richiede.
- [ ] **Deploy GitHub**: sostituire il token legacy `FIREBASE_TOKEN` con credenziali di servizio/ADC generate dalla procedura ufficiale `firebase init hosting:github`. Il workflow attuale pubblica soltanto Hosting; Functions, Rules e indici richiedono un rilascio separato e controllato.

I vecchi script di importazione e backfill sono stati rimossi: non devono essere ricreati senza una nuova procedura approvata, un backup Firestore e un piano di rollback.

## 8. SICUREZZA, ACCESSO E VAULT

### Stato verificato — 1 settembre 2026 (versione 1.2.6)

- Repository su `master`, working tree pulita e sincronizzata con `origin/master` al momento della verifica.
- Audit automatico `npm test`: 60 controlli di sicurezza e offline superati.
- ✅ Policy password separate: minimo 12 caratteri per l'account e 16 per una nuova Master Password, con minuscola, maiuscola, numero, simbolo e controllo degli spazi esterni.
- ✅ Registrazione e cambio password account applicano la policy account; la creazione di un nuovo Vault applica la policy Master Password. Le Master Password esistenti non vengono cambiate automaticamente.
- ⚠️ Questi controlli validano nuove credenziali ma non costituiscono una rotazione della Master Password e non ricifrano dati esistenti.
- ✅ **Formato locale legacy rimosso**: il vecchio `codex_vault_secret` e gli eventuali contenitori UID non strutturati non vengono più letti o decodificati; sono eliminati in modo fail-closed. Lo sblocco richiede la Master Password nota oppure un contenitore WebAuthn PRF corrente.

### Fase 1 — Coerenza e fail-safe (completata)

- ✅ **Password**: il flusso esistente è dichiarato esplicitamente come cambio della password Firebase Auth; non viene più presentato come aggiornamento delle chiavi o della Master Password Vault.
- ✅ **2FA**: il toggle privo di una reale enrollment MFA è disabilitato e indicato come non disponibile; non può più salvare un falso stato `settings_2fa`.
- ✅ **Biometria**: onboarding e Impostazioni usano entrambi `settings_biometric`; l'onboarding registra realmente WebAuthn PRF e la UI legge la credenziale locale del dispositivo come fonte di verità.
- ✅ **Inattività**: una sola soglia selezionata blocca la Vault; il timer non esegue più comportamenti diversi a 1/3/5 minuti e non cancella più la credenziale biometrica.
- ✅ **Reset Vault**: rinominato in rimozione dell'accesso biometrico; cancella la credenziale locale e sincronizza `settings_biometric=false` senza dichiarare la cancellazione dei dati Vault.

### Fasi successive

- [ ] **Fase 2A — Sblocco biometrico esplicito e password manager**: aggiungere il comando “Sblocca con Face ID” quando esiste una credenziale WebAuthn locale, lasciando l'inserimento manuale come fallback/configurazione iniziale. Il percorso normale non deve mostrare il campo Master Password. Il modal Vault usa ancora `autocomplete="current-password"`: va sostituito con semantica e attributi che non lo presentino a Safari come password di login, verificando il comportamento reale su Safari/iOS e sugli altri browser supportati.
- 🟡 **Fase 2B — MFA TOTP reale (client completato)**: enrollment con QR/chiave manuale, verifica nel login e revoca usano Firebase MFA e lo stato reale `enrolledFactors`; resta da abilitare TOTP nel progetto Firebase Authentication with Identity Platform e collaudare enrollment/recovery sull'ambiente remoto.
- [ ] **Fase 3 — Cambio Master Password**: migrazione versionata e controllata dei dati cifrati, aggiornamento del verifier e rigenerazione delle credenziali biometriche con backup e rollback verificati. Non avviare questa fase senza approvazione esplicita del disegno e dei test descritti sotto.
- [ ] **Fase 4 — Reset completo Vault**: progettare un'operazione distruttiva distinta da “Blocca Vault” e “Rimuovi accesso biometrico”, con inventario esatto dei dati eliminati, riautenticazione recente e conferma forte. Attualmente non è implementata e `resetVault()` rimuove soltanto l'accesso biometrico/sessione locale.
- [ ] **Fase 5 — Test end-to-end**: coprire i cinque flussi con Firebase Emulator e browser/dispositivi WebAuthn compatibili, includendo Safari/iOS e scenari offline/multi-tab.

### Gate di sicurezza prima di modificare la crittografia

**Modifiche previste per la futura rotazione della Master Password**:

1. Inventariare tutte le collezioni e tutti i campi cifrati, compresi record legacy e dati condivisi, senza modificarli.
2. Verificare la vecchia Master Password e creare un backup/esportazione recuperabile prima di ogni scrittura.
3. Decifrare e validare ogni record con la vecchia chiave, quindi preparare la nuova versione cifrata con un formato/versione espliciti.
4. Usare una migrazione a fasi con checkpoint e marker di completamento: il verifier e la biometria passano alla nuova chiave soltanto dopo la verifica integrale dei dati migrati.
5. Collaudare interruzione di rete, chiusura scheda, multi-tab, record corrotti, rollback e ripresa idempotente su emulatori e su una copia non produttiva.

**Rischi da approvare prima dell'implementazione**:

- perdita definitiva di accesso ai dati se verifier, ciphertext e contenitore biometrico vengono aggiornati in ordine errato;
- Vault parzialmente migrata in caso di errore, rete assente, quota Firestore o chiusura dell'app;
- sovrascritture concorrenti da un'altra scheda o dispositivo durante la migrazione;
- incompatibilità con record legacy, dati condivisi o cache offline non ancora sincronizzata;
- impossibilità di rollback se il backup non è stato verificato con una prova reale di ripristino;
- esposizione temporanea di dati in chiaro in memoria e nei log se l'implementazione non mantiene il perimetro esclusivamente client-side.

Fino all'approvazione di questo gate non modificare algoritmi, derivazione chiavi, formato dei ciphertext, verifier o contenitori WebAuthn.

### Contratto sessione e offline

- ✅ “Ricordami su questo dispositivo” usa la persistenza Firebase locale; se disattivato usa la persistenza della sola sessione browser.
- ✅ Il secondo fattore compare nella stessa pagina di login solo quando Firebase restituisce `auth/multi-factor-auth-required`.
- ✅ Il timer di inattività blocca esclusivamente la Vault e non revoca la sessione Firebase.
- ✅ Firestore mantiene la cache persistente multi-tab; il service worker conserva anche le pagine HTML visitate, oltre agli asset dell'app, così i dati già sincronizzati possono essere mostrati offline.
- ℹ️ Un nuovo login email/password/2FA richiede rete. Offline sono disponibili soltanto una sessione locale già valida, lo sblocco Vault locale e i dati precedentemente sincronizzati.

---

### 📝 Note per l'Agente AI:
Quando lavori su queste sezioni, documenta qui ogni progresso. Se l'utente approva un nuovo stile o una nuova logica, prepara lo snippet per il trasferimento nel **Protocollo Master**.

---

## 9. DASHBOARD PROFILO E TESSERA DIGITALE

### Decisione approvata — 5 settembre 2026

La pagina Profilo viene evoluta senza eliminare dati o funzioni esistenti e senza
modificare in questa fase il sistema crittografico. La cifratura integrale di tutti
i campi resta un progetto separato, con audit, misure prestazionali, migrazione,
backup e rollback dedicati.

Principi approvati:

- sei linguette: Panoramica, Anagrafica, Contatti, Indirizzi, Documenti e Tessera digitale;
- mantenimento delle carte espandibili esistenti tramite adattatore legacy;
- nessuna duplicazione del medesimo dato tra Profilo, Account e Scadenze;
- email nel Profilo come dato personale, credenziali esclusivamente nell'Account collegato;
- collegamenti tramite ID stabili e navigazione bidirezionale;
- proposta guidata di creazione/collegamento Account quando un'email ne è priva;
- proposta esplicita di creazione o aggiornamento Scadenza per i documenti, senza automazioni silenziose;
- una sola configurazione QR condivisa; la Tessera digitale è il punto principale di gestione;
- nessun segreto, password, PIN, PUK, chiave o allegato selezionabile per il QR;
- widget personalizzati in `users/{uid}/profileWidgets/{widgetId}`;
- campi dei widget inizialmente contenuti in un array limitato a 30 elementi;
- un solo elemento `isPrimary` per ciascuna categoria indirizzo, telefono ed email;
- migrazione incrementale, idempotente e retrocompatibile; il vecchio formato non viene rimosso durante l'introduzione della nuova UI.

### Piano operativo

- [x] **P0 — Contratti e test**: adattatore legacy, ID stabili, fixture e test vCard/QR/offline.
- [x] **P1 — Linguette**: organizzazione accessibile e responsive delle carte esistenti senza riscrivere Firestore.
- [x] **P2 — Panoramica**: dati principali, documenti prossimi alla scadenza e azioni rapide.
- [x] **P3 — Tessera digitale**: provenienza dati, anteprima, selezione esplicita, limite capacità, salvataggio e condivisione.
- [x] **P4 — Widget personalizzati**: creazione, modifica, duplicazione, ordine, dimensione, compressione ed eliminazione confermata.
- [x] **P5 — Persistenza**: sottocollezione widget, validazione schema, regole e test dedicati.
- [x] **P6 — Collegamenti**: Profilo ↔ Account e Documento ↔ Scadenza con riferimenti stabili e gestione dei riferimenti orfani.
- [ ] **P7 — Migrazione e collaudo**: compatibilità legacy e controlli automatici completati; resta il collaudo autenticato su PC/tablet/telefono, tema chiaro/scuro e riapertura offline prima della pubblicazione.

#### Correzione recupero password email legacy — settembre 2026

- Le password email legacy già presenti nel Profilo restano decifrate esclusivamente nella sessione Vault sbloccata e sono mostrate inizialmente oscurate, con comandi espliciti per visualizzarle o copiarle.
- La creazione guidata dell’Account trasferisce in `sessionStorage` soltanto ID stabile e indirizzo email, mai la password.
- La password legacy viene rimossa dal Profilo esclusivamente nella stessa transazione che salva con successo il nuovo Account collegato; annullamento o errore conservano il dato originale.
- I menu Etichetta di email e telefoni usano nuovamente `configKey`: dal menu si possono aggiungere, rinominare o eliminare le etichette personalizzate, conservando una sola configurazione in `settings/profileLabels`.

### Fuori ambito: cifratura completa

La cifratura di nome, cognome, nascita, telefoni, indirizzi ed email attualmente
interrogabili in chiaro non viene cambiata in questa roadmap. La futura migrazione
deve considerare anche ricerca AI, ordinamento, dati principali, collegamenti e uso
offline prima di modificare la rappresentazione persistente.

---

## 10. PIANO PROFESSIONALE: PRESTAZIONI, ONLINE/OFFLINE E SINCRONIZZAZIONE

### Stato e obiettivo — 5 settembre 2026

- **Stato**: analisi e progettazione approvate; implementazione non ancora avviata.
- **Regola di prodotto**: velocità percepita, affidabilità dei dati e sicurezza sono requisiti non negoziabili. Nuove funzioni, inclusa l'AI, non devono peggiorarli.
- **Obiettivo UX**: mostrare immediatamente la shell e l'ultima copia locale disponibile; aggiornare dalla rete in background; comunicare in modo discreto se i dati sono locali, aggiornati o in attesa di sincronizzazione.
- **Vincolo di sicurezza**: nessuna Master Password, chiave Vault o dato decifrato deve essere scritto in Cache API, localStorage, log o backend. La cache Firestore può contenere soltanto la rappresentazione persistita e cifrata dei campi protetti.

### 10.1 Evidenze misurate nel repository

- La shell pubblica comprende **175 file** per circa **7,7 MB**; il solo bundle locale Firebase principale pesa circa **727 KB** non compresso. Il service worker precarica l'intero manifest statico durante l'installazione.
- `offline-firestore.js` sceglie la rete quando `navigator.onLine` è vero e la cache soltanto quando è falso. Questo indicatore non garantisce che Firebase sia effettivamente raggiungibile e non realizza una vera strategia local-first.
- **32 moduli** usano l'adattatore Firestore, per **33 punti di lettura** rilevati. La migrazione è quindi estesa, ma la politica di lettura resta binaria rete/cache.
- `main-v129.js` attende `prepareOfflineData(user)` prima di inizializzare qualunque pagina privata.
- `prepareOfflineData()` legge dal server sette raccolte (`accounts`, `aziende`, `contacts`, `deadlineNotifications`, `profileWidgets`, `scadenze`, `settings`) e poi la sottoraccolta `accounts` di ogni azienda.
- Dopo questa sincronizzazione globale, la pagina richiesta esegue nuovamente le proprie query. Ne derivano attesa iniziale, letture duplicate e costo crescente con il numero di aziende e account.
- Diverse liste decifrano in blocco più campi di tutti i record prima o durante il rendering. La cifratura resta necessaria; va ridotto il lavoro iniziale decifrando soltanto ciò che serve alla vista e rinviando segreti e dettagli all'apertura della singola scheda.
- Il banner offline è già non interattivo e collocato in basso, quindi non deve più impedire l'uso della navigazione.

### 10.2 Modello di riferimento

Le applicazioni vault mature adottano un modello **local-first cifrato**: mantengono sul dispositivo una copia cifrata, la rendono consultabile offline dopo una sincronizzazione riuscita e conservano i dati in chiaro soltanto in memoria durante la sessione sbloccata. Firestore supporta letture, query, listener e scritture dalla cache persistente, quindi non richiede una scansione completa bloccante a ogni navigazione. La sincronizzazione deve essere incrementale e separata dal primo rendering.

Il modello scelto per Codici & Password sarà pertanto:

1. **Shell immediata**: HTML/CSS/JS locali, senza aspettare Firestore.
2. **Autenticazione persistita**: offline è valida soltanto una sessione precedentemente autenticata sul dispositivo.
3. **Sblocco Vault locale**: Master Password o WebAuthn secondo le regole esistenti, senza dipendenza dalla rete quando il materiale locale valido è presente.
4. **Cache-first per la vista corrente**: lettura e rendering della copia locale disponibile.
5. **Network refresh in background**: richiesta al server non bloccante; aggiornamento della UI soltanto se arrivano dati più recenti.
6. **Sincronizzazione selettiva**: priorità a home e raccolta della pagina aperta; prefetch delle altre raccolte quando il browser è inattivo o dopo il primo contenuto utile.
7. **Scritture offline controllate**: consentite soltanto dopo aver definito conflitti, stato “da sincronizzare”, errore permanente e ripetizione idempotente. Fino ad allora, offline resta consultazione sicura.

### 10.3 Budget prestazionali del prodotto

I Core Web Vitals restano il riferimento esterno (LCP massimo 2,5 s, INP massimo 200 ms e CLS massimo 0,1 al 75° percentile), ma per una vault personale si adottano obiettivi percepiti più severi:

- shell/interfaccia visibile: **entro 500 ms** su dispositivo già installato;
- prima lista dalla cache: **entro 1 s**;
- dettaglio già locale: **entro 500 ms** dopo il tocco;
- risposta visiva a un'interazione: **entro 200 ms**;
- sblocco completato e primo contenuto: **entro 1,5 s**, escluso il tempo umano di biometria/digitazione;
- nessuna sincronizzazione completa, download allegati o decifratura massiva sul percorso critico;
- nessun salto rilevante del layout durante il caricamento.

Questi valori sono obiettivi da misurare su PC e iPhone reali, non dichiarazioni già raggiunte.

### 10.4 Contratto funzionale online/offline

**Disponibile offline, dopo una preparazione riuscita sul dispositivo fidato:**

- apertura della PWA e navigazione tra le pagine statiche;
- riconoscimento della sessione Firebase persistita;
- sblocco locale della Vault;
- consultazione di home, profilo, aziende, account e scadenze presenti nella copia locale;
- ricerca AI locale limitata ai dati effettivamente disponibili nella sessione.

**Non garantibile offline:**

- primo accesso o riautenticazione email/password/TOTP;
- recupero password, invio email, Push, inviti e risoluzione destinatari;
- dati mai sincronizzati sul dispositivo;
- allegati mai scaricati e non esplicitamente conservati offline;
- garanzia assoluta che iOS/browser non rimuovano storage locale sotto pressione.

**Al ritorno online:**

- la UI resta utilizzabile con i dati locali;
- il refresh remoto avviene in background e mostra “Aggiornato” soltanto dopo conferma server;
- gli errori di rete non cancellano né nascondono la copia locale;
- un conflitto non viene risolto silenziosamente senza una policy documentata.

### 10.5 Architettura target minima

- Sostituire il gate globale bloccante con un coordinatore di sincronizzazione in background.
- Introdurre un repository dati centrale per evitare che ogni pagina scelga autonomamente tra rete e cache.
- Per ogni query restituire anche metadati minimi: `source` (`cache`/`server`), `isStale`, `syncedAt`, `pendingWrites`.
- Deduplicare le richieste concorrenti e mantenere una sola Promise per la medesima query in corso.
- Usare cache-first + refresh per liste e home; server-confirmed per operazioni sensibili che richiedono certezza corrente.
- Caricare prima campi indice/riassunto; decifrare i segreti soltanto nel dettaglio o su richiesta esplicita.
- Separare metadati leggeri e allegati; nessun prefetch automatico di tutti gli allegati.
- Rendere l'AI una consumatrice del repository locale, non un secondo sistema di caricamento o una scansione completa a ogni domanda.
- Conservare un indicatore di preparazione offline per utente e versione schema, ma non usarlo per bloccare ogni pagina.

### 10.6 Piano operativo a fasi

#### FASE P0 — Baseline e osservabilità (implementazione tecnica completata; baseline reale demandata a P5)

- [x] Aggiungere misure locali in memoria prive di dati sensibili per bootstrap e sincronizzazione.
- [ ] Registrare quantità di documenti e durata per raccolta, senza nomi, email, UID o contenuti.
- [ ] Preparare dataset di test piccolo, medio e grande e una matrice PC/iPhone, Wi-Fi, rete lenta e modalità aereo.
- [x] Rilevare letture duplicate e query N+1, in particolare `aziende/*/accounts`.

#### FASE P1 — Rimuovere il collo di bottiglia (completata nel codice locale)

- [x] Togliere `await prepareOfflineData(user)` dal percorso critico.
- [x] Inizializzare subito la pagina e avviare il refresh in background.
- [x] Impedire sincronizzazioni complete ripetute a ogni navigazione mediante deduplicazione e finestra temporale.
- [x] Mantenere un fallback reversibile alla release stabile durante il collaudo tramite commit isolato precedente al deploy.

#### FASE P2 — Repository local-first (prima infrastruttura completata)

- [x] Centralizzare letture cache-first e server-confirmed in `offline-firestore.js`.
- [x] Correggere l'inizializzazione Firebase moderna usando `localCache: persistentLocalCache(...)`.
- [x] Usare subito una cache non vuota e aggiornare Firestore in background.
- [x] Se la cache online è vuota, attendere la conferma server per non mostrare falsamente “nessun dato”.
- [ ] Aggiornare in tempo reale la vista già aperta quando il refresh in background trova dati diversi.
- [ ] Mostrare nella UI provenienza, obsolescenza e stato “non ancora disponibile offline”.

#### FASE P3 — Sincronizzazione selettiva (prima implementazione completata)

- [x] Dare priorità per pagina a home, aziende, account, profilo, impostazioni e scadenze.
- [x] Sincronizzare gli account aziendali con concorrenza limitata invece di avviare tutte le richieste insieme.
- [x] Eseguire il prefetch restante dopo il primo rendering e durante inattività.
- [x] Applicare una finestra di cinque minuti alla preparazione completa riuscita.
- [ ] Salvare `lastSuccessfulSync` per singola area e invalidare la preparazione quando cambia lo schema.

#### FASE P4 — Decifratura e rendering progressivi (prima ottimizzazione completata)

- [x] Evitare la decifratura delle password nelle liste account private e aziendali.
- [ ] Estendere l'inventario campo per campo alle altre liste prima di rinviare ulteriori dati.
- [ ] Non decifrare PIN, CCV, note estese e dati bancari finché il dettaglio non li richiede.
- [ ] Renderizzare per piccoli lotti sulle liste grandi, preservando ordinamento e ricerca.
- [ ] Verificare che nessun valore in chiaro persista oltre la memoria della sessione Vault.

#### FASE P5 — Offline verificabile

- [ ] Aggiungere una schermata/stato “Disponibile offline” con data dell'ultima sincronizzazione riuscita.
- [ ] Collaudare chiusura forzata, riapertura in modalità aereo, navigazione completa e ritorno online.
- [ ] Decidere separatamente se abilitare scritture offline; non confonderle con la sola consultazione.
- [ ] Definire una scelta esplicita “dispositivo fidato” prima di mantenere dati persistenti sensibili nel browser.
- [ ] Documentare cancellazione cache, logout, cambio account e revoca del dispositivo.

#### FASE P6 — Allegati, AI e funzioni secondarie (chiusa: 5 settembre 2026)

- [x] **Decisione allegati**: restano cifrati e disponibili soltanto online. Non vengono duplicati nella cache offline, così l'app rimane leggera e non occupa spazio imprevedibile sul dispositivo.
- [x] **Dati utili offline**: codici e informazioni necessarie devono essere salvati come campi strutturati e cifrati dell'Account/Profilo/Azienda, non recuperati ogni volta dall'immagine.
- [x] **Agente AI**: continua a lavorare sui dati locali già autorizzati; non scarica allegati né li invia a servizi esterni.
- [x] **Gate prestazionale**: nessun motore OCR entra nel bootstrap o nella shell offline dell'app.
- [x] La sperimentazione locale degli allegati offline è stata annullata prima di push e deploy; la versione pubblica non l'ha mai ricevuta.

### 10.6.1 Roadmap separata — Importatore leggero di card

L'importatore non fa parte della P6 runtime e dovrà essere caricato dinamicamente soltanto quando l'utente seleziona **Importa da foto**. La foto resta sul dispositivo durante l'analisi, salvo consenso esplicito a un futuro servizio esterno.

Profili di acquisizione previsti:

1. **Carta di credito/debito**: numero carta, intestatario e scadenza; CVV escluso dall'acquisizione automatica e sempre soggetto a inserimento/conferma esplicita.
2. **Biglietto da visita**: nome, cognome, azienda, ruolo, telefoni, email, sito e indirizzo.
3. **QR e codici a barre**: contenuto grezzo prima della classificazione; nessuna apertura automatica di URL o esecuzione di azioni.
4. **Card generica**: testo libero suddiviso in proposte di campo, senza salvataggio automatico.

Architettura raccomandata:

- tentare prima le API native del browser quando realmente disponibili;
- usare un decoder QR/barcode locale e lazy-loaded come fallback multipiattaforma, perché `BarcodeDetector` non è disponibile in modo affidabile su Safari/iOS;
- valutare un worker OCR WebAssembly soltanto per fotografie che richiedono testo libero;
- scaricare runtime e modello linguistico esclusivamente alla prima richiesta OCR, mostrando dimensione e stato;
- non aggiungere runtime/modelli OCR al service worker o alla shell PWA;
- ridimensionare e correggere prospettiva/contrasto dell'immagine prima dell'OCR per limitare memoria e tempo;
- applicare parser separati per carta, biglietto da visita e card generica;
- mostrare sempre immagine, valore riconosciuto e confidenza; ogni campo deve essere modificabile e confermato;
- verificare numero carta con algoritmo di Luhn e data di scadenza, senza considerare la validazione una prova di correttezza;
- non sovrascrivere campi esistenti e non salvare nulla senza conferma;
- cifrare i dati approvati attraverso i flussi esistenti e poi liberare bitmap, testo OCR e worker dalla memoria;
- misurare separatamente peso iniziale dell'app (che deve restare invariato), download opzionale, memoria, tempo e precisione su iPhone e PC.

Gate prima dell'implementazione:

- [x] prototipo isolato, non collegato ai dati reali;
- [ ] almeno 20 immagini di test per ciascun profilo, prive di dati personali reali (prima prova: 6 fotografie, dati non conservati nel repository);
- precisione campo per campo definita e verificata;
- nessun caricamento di immagini su rete durante il percorso locale;
- [x] bundle OCR escluso dal caricamento iniziale e dalla cache offline obbligatoria; il gate automatico `npm run test:lightweight` impedisce riferimenti OCR/QR nel runtime pubblico;
- revisione specifica per PCI/privacy prima di gestire carte di pagamento reali.

Esito della prima prova reale: l'OCR grezzo su fotografie grandi e ruotate ha richiesto
circa 15–20 secondi per immagine e ha prodotto risultati insufficienti. Il prototipo
applica ora ridimensionamento, scala di grigi e contrasto prima dell'OCR, ma resta
necessario collaudare su iPhone ritaglio e rotazione guidati. Nessun dato illeggibile
può essere ricostruito o suggerito automaticamente.

### 10.7 Gate di accettazione

La nuova architettura potrà essere dichiarata pronta soltanto quando:

- i test automatici restano verdi;
- i budget sono verificati con misure reali e dataset rappresentativi;
- l'app apre liste e dettagli offline dopo una sola sincronizzazione esplicita riuscita;
- online il primo contenuto non attende la sincronizzazione globale;
- nessun dato segreto finisce in cache statiche, localStorage o log;
- logout e rimozione dispositivo eliminano correttamente il materiale locale previsto;
- il comportamento su cache assente, cache obsoleta e conflitto è comprensibile e non produce perdita dati.

### 10.8 Decisione raccomandata

La priorità successiva non è aggiungere altre funzioni. È completare **P0 e P1**, misurare il miglioramento e poi costruire il repository local-first. L'attuale sincronizzazione globale della 1.2.38 va considerata una misura temporanea di affidabilità, non la soluzione definitiva. L'AI, gli allegati offline e le scritture senza rete restano subordinate al superamento dei gate prestazionali e di sicurezza.

## 11. Versione 1.2.48 — Profilo Utente unico e caricamento progressivo

- La precedente pagina **Profilo Utente V2** è diventata la pagina canonica `profilo_privato.html`; la vecchia pagina Profilo e tutti i duplicati con suffisso `v2` sono stati rimossi.
- Navigazione, Impostazioni, inizializzazione delle pagine e shell offline puntano ora a un solo Profilo Utente.
- Il primo contenuto del Profilo non attende più il caricamento dei widget personalizzati: i widget vengono inizializzati in background e aggiornano la vista quando disponibili.
- Le impostazioni delle etichette e del QR vengono lette in parallelo anziché in sequenza.
- Tessera digitale e QR vengono generati in modo differito e, quando possibile, soltanto all'apertura della relativa scheda.
- La scelta UX delle liste Account resta intenzionalmente invariata: username, account e password continuano a essere disponibili direttamente nelle card autorizzate. La decifratura progressiva va applicata agli altri dati non visibili senza trasformare il dettaglio in un passaggio obbligatorio per consultare le credenziali.
- La nuova struttura riduce il lavoro bloccante prima del rendering, ma il miglioramento percepito deve essere confermato con una prova reale su iPhone e PC.

## 12. Rifattorizzazione professionale in cinque punti — baseline 1.2.48

1. **Misurazione**: introdotto `npm run audit:pages`, che genera `docs/PAGE_PERFORMANCE_BASELINE.md` con peso grezzo, gzip stimato, CSS e grafo JavaScript per ogni pagina canonica. Le misure statiche non sostituiscono quelle runtime su iPhone e PC.
2. **Colli di bottiglia**: la baseline individua Firebase come costo condiviso principale e Profilo, Aggiungi Scadenza e dettagli Account come pagine applicative più pesanti. Sono state rilevate inoltre attese sequenziali evitabili nel bootstrap e nell'area privata.
3. **Uniformità**: le liste Account Privato e Azienda condividono ora un solo risolutore per i segreti delle card. Account propri e inviti, oltre ai relativi contatori, vengono richiesti in parallelo quando indipendenti.
4. **Sicurezza e comportamento**: la password resta cifrata durante il caricamento della lista e viene decifrata soltanto dopo il comando esplicito Occhio o Copia. Il valore non viene scritto in localStorage, cache o documento; la consultazione continua ad avvenire direttamente nella card.
5. **Pagina per pagina**: il Profilo è la prima pagina promossa e ottimizzata integralmente. Area Privata e liste Account ricevono il primo intervento mirato; le altre pagine saranno affrontate secondo la baseline e con confronto prima/dopo.

Il listener Push in primo piano viene inizializzato in background: un servizio accessorio non può ritardare il contenuto della pagina.

## 13. Programma di maturità professionale

Il confronto con password manager maturi e con architetture local-first è stato trasformato in un programma verificabile: [`docs/PIANO_MATURITA_PROFESSIONALE.md`](../docs/PIANO_MATURITA_PROFESSIONALE.md).

Decisione fondamentale: l'app possiede già una Vault Key casuale protetta da envelope. La variabile storica `_masterKey` contiene il materiale della Vault Key dopo lo sblocco e non deve essere confusa con la Master Password. L'eventuale chiave per singolo record è una proposta distinta, ancora da dimostrare e progettare; non è una correzione automatica né autorizza una migrazione.

Il programma M0–M10 conserva tutte le funzioni attuali e permette di eliminare progressivamente le implementazioni meno mature soltanto dopo baseline, compatibilità, test, rollback e promozione di un percorso canonico.

# Avanzamento M0 — contratto funzionale e collaudo sicuro (06/09/2026)

- Creato `docs/FUNCTIONAL_DATA_CONTRACT.md`: cataloga aree visibili, moduli, percorsi Firestore/Storage, confini offline e invarianti da preservare.
- Creato `tests/fixtures/maturity-dataset.json`, composto esclusivamente da identità `.invalid` e password marcate come fixture non segrete.
- Aggiunto `test:maturity-fixture` alla suite per impedire l'introduzione accidentale di email o credenziali reali nel dataset M0.
- Definito `scripts/page-performance-budget.json`: soglie statiche iniziali e obiettivi runtime. I valori runtime sono obiettivi, non risultati, finché non vengono misurati su iPhone e PC.
- M0 resta in corso: manca la baseline runtime reale su entrambi i dispositivi.

# Pannello diagnostico runtime M0 (06/09/2026)

- Aggiunto nelle Impostazioni il comando locale «Misura velocità app», disattivato per impostazione iniziale.
- Il pannello conserva al massimo 80 misure tecniche tra le pagine e mostra bootstrap, navigazione, stato online/offline, conteggio risorse e traffico trasferito disponibile.
- La raccolta usa una lista chiusa di dettagli ammessi: non salva email, UID, URL, token, contenuti della Vault o dati decifrati.
- Sono disponibili aggiornamento, copia del report tecnico e cancellazione; la disattivazione elimina automaticamente le misure dal dispositivo.

# Anteprima QR reale nelle Impostazioni (06/09/2026)

- Rimossa la scritta duplicata «Apri Profilo utente» dalla card principale delle Impostazioni.
- Il riquadro vicino all’avatar genera ora la stessa vCard configurata nel Profilo, usando inclusioni QR e widget consentiti; il tocco continua ad aprire la scheda Tessera digitale.
- Il caricamento del QR è asincrono e non blocca le altre Impostazioni; in caso di indisponibilità resta una semplice icona QR.
- Il flash residuo di header/footer durante scroll e overscroll è registrato come difetto trasversale della fase M4 e sarà verificato unitariamente sulle pagine canoniche.

# Chiusura baseline runtime M0 (06/09/2026)

- Acquisiti report reali online e offline su PC portatile e iPhone tramite il pannello diagnostico locale.
- La baseline è documentata in `docs/RUNTIME_PERFORMANCE_BASELINE.md`; M0 è completata.
- Criticità misurate: liste Account private/aziendali lente anche offline, Archivio con campione da 25,14 s, picchi Home e prima navigazione offline PC da 28,85 s.
- Su iPhone online risultano circa 229–238 KB trasferiti per pagina: va verificato il rapporto tra Service Worker, cache Safari e header `no-store`.
- Le pagine già rapide costituiscono un vincolo di non regressione per le fasi successive.

# Autoripristino registrazione Push locale (06/09/2026)

- Corretto il percorso comune degli switch «Notifiche scadenze» e «Notifiche inviti condivisi» in presenza di una registrazione FCM/browser locale incoerente.
- Al primo fallimento l’app revoca esclusivamente token e sottoscrizione Push del dispositivo corrente, quindi tenta una sola nuova registrazione.
- Nessun dato applicativo, destinatario o dispositivo remoto viene modificato; gli ambiti Scadenze e Condivisioni restano indipendenti.
- Se il recupero fallisce, la UI mostra un messaggio italiano classificato per permesso, compatibilità o registrazione, senza esporre l’errore interno dell’SDK.

# Consolidamento remoto e laboratorio viewport (07–08/09/2026)

- La registrazione consente lo scroll verticale di emergenza su schermi bassi tramite `registrati.css`; la famiglia Auth resta distinta dalle pagine interne.
- `prova.html` e `prova.css` sono registrati come laboratorio temporaneo pubblicato per isolare il fondale dinamico del viewport. Non sono una trentesima funzione e restano esclusi dagli audit delle 29 pagine canoniche.
- La prova non autorizza modifiche a nebbia V2, ombre, pulsanti o ordine dei livelli: la soluzione definitiva deve passare il gate fisico M4 sulle pagine reali.
- La messaggistica Push usa un worker dedicato, separato da `sw.js`, con scope `/firebase-cloud-messaging-push-scope`; Firebase resta alla versione 12.18.0 per non regredire lo schema IndexedDB.
- Le Scadenze condivise dispongono di copie minime in `receivedDeadlines`, permesso opzionale `canManage`, callable server `manageReceivedDeadline` e deep link Email/Push. Resta obbligatorio il collaudo completo con due account reali prima della chiusura.
- Consolidamento successivo: `sw.js` è tornato a occuparsi soltanto della shell offline; messaggi e click Push appartengono esclusivamente a `firebase-messaging-sw.js`. Il listener online non viene più caricato sui dispositivi certamente disabilitati e gli errori tecnici restano nella console.
- La revoca delle scadenze ricevute non dipende più dalla possibilità di ritrovare l'email precedente: il backend conserva gli UID risolti in un indice tecnico non accessibile al client e li usa per la pulizia.

# Riallineamento documentale — 11/09/2026

- [x] creata `docs/ARCHITETTURA_SICUREZZA_V1.md`;
- [x] creato audit dei 25 Markdown allora presenti;
- [x] creata `docs/GUIDA_PROGETTO.md` come indice centrale;
- [x] aggiornata la gerarchia delle fonti per gli agenti;
- [x] riallineato `VAULT_KEY_CONTRACT.md`, con session wrapping classificato P0;
- [x] esclusa ogni interpretazione del Cripto-Healing come migrazione automatica autorizzata;
- [x] aperta la decisione di retention del cestino;
- [x] riallineamento documentale dei contratti completato il 12/09/2026 nel perimetro descritto in apertura; i gate tecnici restano aperti;
- [ ] eseguire [il piano di audit completo](../docs/PIANO_AUDIT_COMPLETO_PROGETTO.md) su codice, Rules, Functions, Storage, crittografia, offline e configurazione Firebase;
- [ ] aggiornare la documentazione con gli esiti reali senza confondere test locali e produzione.

# Collegamento email e telefoni, password e widget Profilo — 12/09/2026

- Un’email del Profilo può scegliere dal medesimo menu se collegare un Account privato esistente oppure crearne uno nuovo, anche quando conserva una password legacy.
- Anche ogni telefono può scegliere un Account privato esistente o crearne uno nuovo; dopo il salvataggio compare “Apri Account collegato”. Non vengono aggiunti campi PIN/PUK né spostati i dati telefonici già presenti.
- Entrambe le scelte aprono il form Account per verificare i dati. I campi vuoti vengono precompilati; credenziali e note già presenti nell’Account vengono conservate.
- La password email legacy viene rimossa soltanto se coincide esattamente con la password salvata nell’Account, nella stessa transazione. Se è diversa resta visibile, inizialmente oscurata, e copiabile nel Profilo anche dopo il collegamento. “Verifica trasferimento password” riapre il relativo Account.
- Errori di lettura, salvataggio o conflitti non eliminano la password. Nessuna password viene copiata in `sessionStorage`; la bozza è associata all’utente autenticato.
- Le zone Widget caricate in background rispettano subito la linguetta attiva; non compaiono più comandi appartenenti alle altre linguette.
- Ogni linguetta mostra un solo pulsante `+` per creare Widget. Il numero dei Widget non è limitato; resta soltanto il limite di sicurezza di 30 campi per singolo Widget.
- Cache applicativa aggiornata a `1.2.100`. Suite completa locale superata, inclusi emulatori Firestore/Storage; test comportamentali per selezione, salvataggio atomico, password differenti, errori e schede del Profilo.

### Pubblicazione anteprima Vault — 12/09/2026

Su autorizzazione del product owner, pubblicato il canale temporaneo `vault-shell-fc9fffe1-0912` dal commit `fc9fffe1`, scadenza 19/09/2026. Contiene dieci file con soli dati fittizi. Verificati sblocco, lista aziendale, worker pronto e refresh bloccato nel browser Windows; collaudo fisico iPhone ancora richiesto. Evidenze e URL in `docs/AUDIT_VAULT_SESSION_P0.md`, sezione 14. Canale live invariato.

### Robustezza laboratorio Vault — 12/09/2026

Corretti prompt tardivi dopo blocco, dismissione dell’adattatore, errori di smontaggio e titoli dei collegamenti diretti alle liste. Sette test nuovi: gate laboratorio 32/32 e anteprima 2/2. Censiti i vincoli dei due orchestratori reali prima della futura migrazione. [Audit §15](../docs/AUDIT_VAULT_SESSION_P0.md#15-annullamento-e-robustezza-del-laboratorio--12092026). Nessuna attivazione nell’app live.

### Riscontro iPhone del product owner — 12/09/2026

Ricevuti quattro esiti positivi riferiti dall’utente per la demo (navigazione, refresh, inattività/background, offline). Superato il controllo preliminare necessario ad ampliare la preparazione delle liste reali. Restano aperti i collaudi dell’app completa. [Audit §16](../docs/AUDIT_VAULT_SESSION_P0.md#16-esito-riferito-dal-product-owner--12092026) distingue riscontro utente e verifiche osservate dall’agente.

### Orchestratori liste reali — 12/09/2026

Preparati montaggio/smontaggio e annullamento dei consumatori per liste private e aziendali; 19 test aggiunti al gate navigazione. Gli URL e i percorsi dati esistenti restano operativi. Il collegamento completo alla shell è ancora aperto. [Audit §17](../docs/AUDIT_VAULT_SESSION_P0.md#17-primo-adattamento-degli-orchestratori-reali--12092026).

### Liste canoniche nel laboratorio — 12/09/2026

Su base `4c1d90b5`, montati i due orchestratori reali con repository sintetico e sola lettura. Nel browser verificati ordinamento, ricerca vuota e cambio dominio senza stato residuo. Suite completa: 364 test; anteprima: quattro. Aggiornato il piano di maturità per distinguere avanzamento corrente e gate aperti. [Audit §18](../docs/AUDIT_VAULT_SESSION_P0.md#18-orchestratori-canonici-nel-laboratorio--12092026).

### Coordinatore della sessione — 12/09/2026

Collegati identità, Vault e viste nel laboratorio: blocco/logout/cambio UID invalidano i consumatori, logout pendente impedisce nuovi sblocchi. Tredici nuove prove, inclusa integrazione con il lettore v2 su credenziali sintetiche; identità nel browser ancora fittizia. [Audit §19](../docs/AUDIT_VAULT_SESSION_P0.md#19-coordinamento-identità-vault-e-viste--12092026). Nessun aggiornamento del runtime produttivo o del canale HTTPS in questo blocco.

### Firebase Auth/Firestore in emulatore — 12/09/2026

Collegato il bootstrap candidato agli SDK reali e al lettore v2 su utenti e record sintetici. Undici test emulati superati: separazione login/sblocco, isolamento utenti, letture cifrate, logout e rifiuto di record non conformi. Nuovo gate `npm run test:vault-emulators`, incluso in npm test. Confermato che la validazione degli schemi nelle Rules resta aperta. [Audit §20](../docs/AUDIT_VAULT_SESSION_P0.md#20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).

Laboratorio browser 12/09/2026, base `83dffc30`: comando `npm run prototype:vault-emulators`, due utenti sintetici, accesso e sblocco distinti, letture private/aziendali e pulizia su uscita/refresh verificati nel browser Windows. Anteprima pubblicata invariata. [Audit §21](../docs/AUDIT_VAULT_SESSION_P0.md#21-interfaccia-browser-degli-emulatori--12092026).

Integrazione liste nel laboratorio, 12/09/2026: repository canonico e callback Vault per vista, ricerca e ordinamento su copie decifrate, password letta su richiesta. Nuove opzioni preservano i chiamanti legacy. [Audit §22](../docs/AUDIT_VAULT_SESSION_P0.md#22-liste-canoniche-e-repository-negli-emulatori--12092026).

Dettaglio base locale, 12/09/2026, base `70a6c4c5`: apertura dalle liste senza cambio documento, ritorno con ricerca/ordinamento e pulizia su blocco. Correzione del controllo finale prima di mostra/copia dopo attese asincrone. Nessuna scrittura o pubblicazione. [Audit §23](../docs/AUDIT_VAULT_SESSION_P0.md#23-dettaglio-base-protetto-e-ritorno-alla-lista--12092026).

Avanzamento locale 12/09/2026, base `755c68ed`: note/sito web nel dettaglio emulato, correzione ID repository, nessuna mutazione views/edit in dettaglio aziendale readonly e gestione ID fisico dopo lookup privato legacy. Compatibilità dei riferimenti storici da collaudare prima del rilascio. [Audit §24](../docs/AUDIT_VAULT_SESSION_P0.md#24-identità-dei-record-e-campi-aggiuntivi-del-dettaglio--12092026).

Avanzamento locale, base `b792b1c0`: capacità di cifratura legata alla vista e preparatore di patch privata. Nessun pulsante Salva aggiunto; aperti compatibilità writer M6, isolamento autorevole e cancellazione campi. [Audit §25](../docs/AUDIT_VAULT_SESSION_P0.md#25-preparazione-cifrata-delle-modifiche-nella-sessione-in-ram--12092026).

Avanzamento locale base `6432cad8`: preparatore M6 per quattro campi sensibili e test del salvataggio originale su fixture emulata. Titolo/URL preservati, nessuna scrittura UI o pubblicazione. [Audit §26](../docs/AUDIT_VAULT_SESSION_P0.md#26-preparazione-m6-e-transazione-originale-su-dati-emulati--12092026).

Correzione contatti azienda, 12/09/2026: confronto strutturale elimina falsi conflitti dovuti all’ordine delle mappe; modulo online caricato dal server prima di abilitare Salva. Conflitti reali e obbligo di scollegare Account restano protetti. Correzione locale non pubblicata. [Audit §27](../docs/AUDIT_VAULT_SESSION_P0.md#27-falso-conflitto-nella-modifica-dei-contatti-azienda--12092026).

Rilasciata separatamente la correzione contatti azienda v1.2.111 tramite PR #45, master `f4d9393b`; Hosting verificato. Il ramo sperimentale non è stato pubblicato. [Evidenze](../docs/AUDIT_VAULT_SESSION_P0.md#28-rilascio-isolato-della-correzione-azienda--12092026).

Avanzamento P0 base `1b6a13ed`: controller sperimentale per esito incerto, retry con stesso payload e ricerca del risultato. Individuato gate operationResults scrivibile dal proprietario; nessuna attivazione UI o modifica Rules/Functions. [Audit §29](../docs/AUDIT_VAULT_SESSION_P0.md#29-esito-incerto-retry-e-verifica-del-salvataggio--12092026).

Dati azienda, aggiornamento dopo scrittura: creazione/modifica tornano subito al dettaglio con afterWrite; server confermato per mostrare il dato aggiornato, anche dopo cambio/scollegamento Account. Consultazione ordinaria local-first preservata. [Audit §30](../docs/AUDIT_VAULT_SESSION_P0.md#30-dati-azienda-aggiornati-dopo-il-salvataggio--12092026).


Avanzamento candidato 13/09/2026, checkpoint `99dabb19`: isolamento del dettaglio Account aziendale durante cambio contesto e vincolo proprietario delle mutazioni; ricevute backup verificate nel registro non scrivibile dai client. Suite completa 731 test superati. Nessun deploy; confronto atomico con anteprima, staging/compensazione e gate fisici restano aperti. [Audit §43](../docs/AUDIT_VAULT_SESSION_P0.md#43-dettaglio-aziendale-e-ricevute-backup--candidata-13092026).

Avanzamento candidato 13/09/2026: anteprima backup legata alle versioni effettive, confronto transazionale prima di scrivere, scelta esplicita anche per il Profilo; interruzioni e tipi binari verificati. [Audit §44](../docs/AUDIT_VAULT_SESSION_P0.md#44-anteprima-backup-e-confronto-transazionale--candidata-13092026). Staging e rilascio restano aperti.

Avanzamento candidato Archivio 13/09/2026: sessione e identità complete protette, purge vincolato al proprietario, ricevute storiche non più attendibili e registro server verificato. Suite completa 771 test superati, nessun deploy. [Audit §45](../docs/AUDIT_VAULT_SESSION_P0.md#45-archivio-sessione-proprietario-e-ricevute--candidata-13092026).

Ripresa backup candidata 13/09/2026: stessa operazione dopo risposta persa, scelta esplicita e blocco dei retry Storage incerti. Suite completa 781 test superati. [Audit §46](../docs/AUDIT_VAULT_SESSION_P0.md#46-ripresa-esplicita-del-backup-nella-sessione--candidata-13092026). Nessuna ripresa dopo refresh o pubblicazione dichiarata.

Checkpoint candidato 13/09/2026: manifest allegati completo, Bytes SDK e recupero esplicito delle eliminazioni, 795 test superati. [Audit §47](../docs/AUDIT_VAULT_SESSION_P0.md#47-manifest-backup-e-ripresa-archivio--candidata-13092026). Prossimo intervento: isolamento del dettaglio privato e limitazione della lettura backup; nessun deploy.

Checkpoint candidato 13/09/2026: isolamento dettaglio privato e lettura incrementale backup, suite completa 813 test superati. Vincolo successivo fra digest anteprima/upload verificato con 61 test backup. [Audit §48](../docs/AUDIT_VAULT_SESSION_P0.md#48-dettaglio-privato-e-lettura-backup--candidata-13092026). Nessun deploy; dettaglio Scadenza in lavorazione.


Checkpoint candidato 13/09/2026: Scadenze isolate per sessione, conferma della coda offline tramite CAS e transazioni backup provate in emulatore. Suite completa 843 test superati. [Audit §49](../docs/AUDIT_VAULT_SESSION_P0.md#49-scadenze-e-conferma-della-coda-offline--candidata-13092026). Nessun deploy.


Checkpoint candidato 13/09/2026: cancellazione Scadenza/Profilo transazionale provata con SDK reale; prerequisiti IndexedDB e pulizia Archivio preparati ma non attivati. Suite completa 873 test superati. [Audit §50](../docs/AUDIT_VAULT_SESSION_P0.md#50-transazioni-scadenze-e-prerequisiti--candidata-13092026). Nessun deploy o chiusura globale del programma.


## Correzione contatti azienda — v1.2.111, 12/09/2026

Rilascio isolato su base v1.2.110 (`fa555d49`). Eliminando un telefono non collegato, il confronto JSON delle mappe contatti poteva segnalare falsamente “Contatti modificati” per il solo ordine delle proprietà. Il confronto ora è strutturale; modifiche reali e obbligo di scollegare un Account restano protetti. Online il modulo parte da una lettura confermata dal server, senza ripiego sulla cache obsoleta in caso di errore. Offline conserva il caricamento precedente.

Quattordici test mirati coprono cancellazione, mappe equivalenti, conflitti reali, telefono collegato, caricamento server/cache ed errore. Suite completa della release: 301 test superati, build e gate Rules inclusi. Versione e 236 riferimenti asset verificati; inventario e baseline rigenerati. Pubblicazione da verificare al termine del workflow. Correzione adattata dal commit locale `73fbe022`; preservato il mapper ID di produzione, senza importare la shell Vault sperimentale o modificare Rules/Functions. Rollback Hosting: ripubblicare il commit di produzione precedente `fa555d49`; nessuna migrazione di dati.

## Aggiornamento immediato dati azienda — v1.2.112, 12/09/2026

Dopo salvataggio o creazione confermati, il modulo apre subito il dettaglio con afterWrite=1; il dettaglio attende il dato server prima di consumare il flag. Anche cambia/scollega Account richiedono un refresh confermato. Nessun ritardo artificiale o cache presentata come dato appena salvato; consultazione normale local-first e offline con avviso preservati. Richieste e callback restano vincolati alla vista, con possibilità di ritentare un refresh fallito.

Release isolata su master v1.2.111 (`f4d9393b`), derivata dalla correzione locale `ca7736a5`. Ventuno test mirati e suite completa di 313 test superati; versione, asset, inventario e budget verificati. Pubblicazione da verificare dopo il workflow. Nessuna modifica a Rules, Functions o laboratorio Vault. Rollback: ripubblicare Hosting dal precedente master `f4d9393b`, senza migrazione dati.

## Integrazione candidata 1.2.118 — 13/09/2026

Nel ramo `codex/integrate-vault-account-v118`, integrati i sette commit UI fino a `d2ef897e` sulla base sperimentale `3660a838`, poi ricongiunta la cronologia master `445b338d` senza modificare master. Codice risultante `4a431ec3`: 887 test della suite completa superati, 244 riferimenti asset coerenti e budget invariati. Gli MD descrivono vista compatta, campi banca e Widget; protezioni sessione conservate. Nessun deploy, migrazione o chiusura generale M0–M10. [Audit §51](../docs/AUDIT_VAULT_SESSION_P0.md#51-integrazione-account-ui-e-vault--candidata-13092026).

## Rilascio UI isolato 1.2.118 — 13/09/2026

Autorizzata la pubblicazione delle sole modifiche UI Account sulla base master `445b338d`. Ramo `release/account-ui-v118`, derivato da `d2ef897e`; inclusi fix UI per conservazione dei campi bancari, nomi della rubrica in consultazione e password di soli spazi. Vault, Rules, Functions, cifratura e protocolli backend produttivi invariati. Il ramo integrato `codex/integrate-vault-account-v118` resta separato. Rollback Hosting: ripubblicare i file di `445b338d`, senza migrazioni. Suite completa: 336 test superati, zero fallimenti, inclusi emulatori Firestore/Storage. Versione 1.2.118 e 245 riferimenti asset coerenti; budget delle 30 pagine rispettati. Hosting pubblicato e verificato il 13/09/2026 dal commit `bbf0d65d`: sei file pubblici confrontati con la build locale, inclusi entrambi i dettagli e il service worker. Anche la CI della PR #52 è passata. Master resta `445b338d`: il merge della PR richiede autorizzazione esplicita, secondo la revisione automatica. Nessun deploy backend.

## Widget bancari — candidata 1.2.119, 13/09/2026

Base a6699e8d, ramo fix/banking-widget-placement. Ogni conto conserva la propria area Widget e carte; posizione stabile nel form e in consultazione, spostamento esplicito dei Widget generici e conservazione delle bozze durante rerender. Il server verifica bankId nello stesso Account. Suite completa: 352 test superati, incluse 36 prove Functions, emulatori, cifratura, UI e budget. Nessuna pubblicazione: necessario aggiornare il solo callable manageAccountWidget prima di Hosting. Nessuna modifica Rules o integrazione Vault.

## Prerequisito conto salvato — candidata 1.2.120, 13/09/2026

Corretto il flusso della 1.2.119: il form generava bankId localmente, ma consentiva di inviare il Widget prima che il conto fosse salvato. Il backend respingeva correttamente la richiesta con HTTP 400/failed-precondition. Ora i due form distinguono gli ID caricati da quelli appena generati; creazione e spostamento chiedono prima il salvataggio Account, senza inviare il comando fallito e conservando eventuali campi nel modale. Gestito anche il testo italiano del rifiuto server. Nessuna modifica backend, Rules, dati reali o ramo Vault.

## Ordine interno del conto — candidata 1.2.121, 13/09/2026

Ogni conto mostra prima i dati bancari, poi i Widget specifici del conto e infine le carte associate. Ordine condiviso da Modifica e consultazione, nei contesti privato e aziendale. Il contenitore Widget rimane disponibile anche a conto chiuso, preservando le bozze al rerender. Nessuna modifica a dati, associazioni, backend o Rules.

## Ripresa del programma guida — 13/09/2026

Nuovo ramo `experiment/vault-shell-v121`: merge `e2edd2b9` conserva il lavoro Vault integrato e i rilasci Account/banca fino a master 1.2.121. Commit `8de71910`: coordinatore offline ibrido di laboratorio, ancora escluso dal runtime. Suite completa 913 test superati; dopo l'ultima correzione locale del coordinatore, suite offline 69 test superati. Audit Vault §52 registra perimetro, prove e limiti.

Lo stato corrente sostituisce le indicazioni di preparazione storiche: Hosting 1.2.121 e il supporto bancario manageAccountWidget sono già pubblicati; le modifiche strutturali del ramo Vault non lo sono. Nessun deploy eseguito durante questa ripresa. I prossimi passi M6 sono compatibilità delle copie PWA, store comune e integrazione sulla coda cifrata prima del cutover; gli altri gate aperti del piano rimangono invariati.

## Sei blocchi del programma guida — 13/09/2026

Ripresa dalla base `5b3cd4da`, codice `f47a55c9`: M6 apertura database e collaudi reali Chrome/Edge headless; M8 limiti cumulativi e unicità delle destinazioni del backup; M9 ciclo di vita dell'analisi; M7 ripristino transazionale dell'Archivio. I singoli rami experiment/m6-database-lifecycle, experiment/m8-restore-memory-budget, experiment/m6-browser-coordination, experiment/m8-backup-record-identities, experiment/m9-health-session ed experiment/m7-archive-restore-cas formano una sola catena. Il ramo principale sperimentale raccoglie tutti i commit verificati.

Il piano di maturità distingue ora lavori tecnici aperti e decisioni/verifiche esterne: non occorre fermare l'intero progetto in attesa di un singolo gate. Non sono stati attivati schema IndexedDB 2, nuovo backend, controllo violazioni online o migrazioni. Master e Hosting restano 1.2.121; nessun deploy in questo blocco.

## Note rapide — rilascio 1.2.122, 13/09/2026

Base master `6fc3546e`, ramo release/inline-notes-v122. Portate solo le note rapide da `1c5aeec7`: comando Aggiungi/Modifica nei dettagli privato/azienda, dialogo cifrato, confronto transazionale, aggiornamento immediato e conservazione bozza in caso di errore. Il riquadro resta nascosto se vuoto; i form completi continuano a modificare lo stesso campo. L'editor della release segue Auth e annullamento del caricamento senza dipendere dalla shell sperimentale.

Suite locale completa: 359 test superati, più sei test dedicati rieseguiti dopo l'aggiunta del caso cambio Auth. Versione coerente con 246 riferimenti; budget delle 31 pagine rispettati. Nessuna modifica Functions/Rules/formato cifrato o migrazione. Vecchi Account non marcati cifrati richiedono prima un salvataggio dal form completo. Il rilascio autorizzato riguarda solo Hosting; tutti i lavori Vault/M6–M9 restano fuori da master. Rollback: ripubblicare Hosting dalla base 6fc3546e, senza rimuovere le note salvate nel campo esistente.

## Avvio note rapide — correzione 1.2.123, 13/09/2026

Nei due dettagli Account mancava l’import esplicito di auth: il controllo sessione lanciava ReferenceError e il catch mostrava soltanto Editor note non disponibile. Ripristinato auth dalla configurazione Firebase condivisa; aggiunta diagnostica fissa senza contenuti Account. Un test verifica il binding importato ed esegue il callback di avvio di entrambe le pagine, oltre ai sei test del modulo note. Nessuna modifica a scritture, cifratura, Rules, Functions o dati. Rollback: Hosting 1.2.122 (con il difetto di avvio noto).


## Azioni compatte note — rilascio 1.2.124

In entrambi i dettagli Account il pulsante grande Aggiungi nota compare soltanto a nota vuota. Una nota presente mostra matita e cestino nella sua intestazione. Eliminazione con anteprima in sola lettura e conferma, sul medesimo salvataggio cifrato transazionale; conflitti conservano la nota. Focus riportato al comando visibile. Nove test note superati, inclusi cancellazione, annullamento, conflitto e blocco sessione; controlli HTML, sintassi e riferimenti superati. Pubblicazione Hosting richiesta; rami sperimentali esclusi. Rollback: versione 1.2.123, senza modificare i dati.

## Conferme e rilettura nella shell sperimentale — 14/09/2026

Base 790d3d26. Due passaggi consecutivi: conferme correlate a operationId/recordId e rilettura del dettaglio tramite capability protetta. Il pannello distingue salvataggio confermato da errore di aggiornamento della vista; logout e navigazione impediscono risposte tardive. 79 test offline, 155 test shell, 32 esecuzioni browser/backend emulato e suite npm test completa superati. Provider principale e trasporto autenticato restano aperti; Hosting 1.2.124 invariato. Nessuna migrazione, master non modificato. Dettagli nei checkpoint 61–62 dell'audit Vault e nel contratto M6.

## Revisione del trasferimento cloud — 14/09/2026

PR #59, base pubblicata `a3f7f28`, destinazione esclusiva `experiment/vault-shell-v124`. Riproposizione note collegata alla UI candidata, corretti lifecycle ed esiti incerti del replace; setup Linux corretto senza cancellazioni ricorsive. Suite completa e Chrome/Edge con backend emulato passati localmente. Audit 68 e `docs/SETUP_LINUX_CLOUD.md` distinguono il codice verificato dall'installazione cloud ancora da collaudare. Nessuna importazione dei rami documentali errati, nuova versione, modifica a master o deploy. Restano aperti i gate runtime elencati nel piano M6.


## Collaudo ambiente Linux cloud — 14/09/2026

Su discendente verificato di `bdb95236`, toolchain, Chrome, Edge, Java e Firestore sono presenti e la fixture setup passa. La suite completa raggiunge Storage Rules, dove manca il JAR Storage perché la fase setup consolidata precaricava soltanto Firestore; la rete agente disattivata impedisce il recupero tardivo. Il runner browser richiedeva inoltre il flag previsto da Chromium quando Linux gira come root. Correzione candidata circoscritta: cache Firestore e Storage durante setup e `--no-sandbox` soltanto per Linux root; dopo la modifica Chrome ed Edge superano i 17 scenari sintetici ciascuno. Riesecuzione della suite completa bloccata fino a un nuovo setup con rete; nessun gate M6 aggiuntivo, deploy, versione o dato reale coinvolto.

## Trasferimento cloud collaudato — 14/09/2026

Il nuovo ambiente ha completato setup e suite `npm test` su Linux, oltre alla fixture setup e alle 34 esecuzioni Chrome/Edge con backend emulato. Il precedente blocco Storage è risolto: entrambi i JAR sono precaricati e il runner instrada direttamente soltanto gli host loopback ammessi, conservando proxy e impostazioni ereditate per gli altri host. La correzione definitiva della PR #61 è pubblicata in `4894bd23`; il gate Storage, inclusi i nuovi test senza rete del dispatcher, è passato anche su Windows dopo il recupero da GitHub.

Base unica di prosecuzione: `experiment/vault-shell-v124`, con i contributi delle PR #59, #60 e #61. Per il prossimo lavoro cloud selezionare questo ramo in una nuova task: un follow-up di una task precedente può conservare il vecchio checkout e non riesegue automaticamente il setup. Audit 70 e guida Linux registrano gli esiti effettivi. Il trasferimento è concluso; provider bootstrap, trasporto autenticato/App Check, recupero delle code dopo riapertura, rollout e prove fisiche restano attività M6 separate. Produzione 1.2.124 e master invariati; nessun deploy o migrazione.

## Ripresa del programma M6 — 14/09/2026

Primo incremento da `b5ab595c`: il pannello candidato recupera l'identità della nota pendente prima di consentire un nuovo salvataggio. Riprende soltanto la coda esistente su comando esplicito; ambiguità, lock negato e cambio sessione non provocano cancellazioni. Verificati DOM e Chrome/Edge con chiusura/riapertura IndexedDB e backend emulato. Dettagli e limiti nell'audit 71 e in M6; nessuna attivazione della shell o distribuzione produttiva.

## Backup e ciclo della sessione — candidata 14/09/2026

Su experiment/m8-export-session, base 4dd2f0a2, il backup interrompe i passaggi successivi al blocco del Vault o cambio utente; conferma e Recovery Key vengono dismesse insieme alla sessione. Suite completa npm test e regressioni mirate superate. Dettagli e limiti in M8 e audit 72. Produzione invariata; nessun deploy.

## Limite del backup in memoria — candidata 14/09/2026

Il ramo experiment/m8-export-buffer-limit limita il download Blob e indica quando usare il salvataggio diretto. Formato invariato, nessun download troncato in caso di superamento. 90 prove backup e controlli statici superati; manifest offline aggiornato. Limiti e attività residue in M8 e audit 73. Nessuna distribuzione.

## Raccolta backup limitata — candidata 14/09/2026

Su experiment/m8-export-record-limits, limite record e caratteri coerente con l'import; stop esplicito prima di altre letture, senza produrre un backup completo impropriamente. 93 test backup, budget e sintassi superati. Dettagli e limiti in M8/audit 74; nessuna pubblicazione produttiva.

## Dismissione coda M6 — candidata 14/09/2026

Sul ramo experiment/m6-queue-client-disposal, chiusura writer e abort client rilasciano i riferimenti alle chiavi e impediscono altre mutazioni locali. 106 prove offline e 44 esecuzioni Chrome/Edge con backend emulato superate. Limiti in M6/audit 75; nessun deploy o attivazione bootstrap.

## Tastiera Salute credenziali — candidata 14/09/2026

Ramo experiment/m9-health-keyboard: elenco raggiungibile e focus confinato al dialogo, Escape con ritorno al comando iniziale nella sessione valida. 20 test UI, CSS e npm test finale superati sui checkpoint 71–76. Nessun collaudo fisico o deploy; M9 registra i gate rimasti aperti.

## Adattatore Firebase M6 — candidata 14/09/2026

Da 82ab2002, sul ramo experiment/m6-firebase-queue-adapter: client della coda collegato al vero SDK callable, con proprietario, dominio e durata della sessione controllati. 113 test offline, suite completa e 52 esecuzioni Chrome/Edge/backend demo superati. La risposta persa dopo commit si recupera con la ricevuta esistente. Il test usa attestazione sintetica: non chiude App Check remoto, bootstrap, rollout o prove fisiche. Dettagli in M6/audit 77; aggiornamento destinato alla PR #62, senza master, versione o deploy.

## Coda posseduta dalla shell — candidata 14/09/2026

Ramo experiment/m6-shell-owned-queue, base 32db005f: la shell apre la coda tramite factory fidata e ne revoca operazioni/riferimenti alla chiusura del Vault o della vista. Suite completa, 165 test shell, 15 test Firebase emulati e 52 esecuzioni browser demo superati. Nessun key/DB/SDK alle route. Provider UI/entry e rollout restano aperti; M6/audit 78 registrano i limiti. Checkpoint destinato alla stessa PR #62, senza deploy.

## Provider della nota privata — candidata 14/09/2026

Da c4e1a1a8 consolidato, ramo experiment/m6-private-note-provider: collegamento del pannello alla coda posseduta dalla shell, preparazione della sola nota sulla revisione visualizzata, callback protetti da UID e durata della vista. Suite completa superata, 178 test shell finali e 52 esecuzioni browser della catena preesistente. Il nuovo provider è verificato in fixture/DOM simulato; entry con lettore fidato, prova browser dedicata e rollout restano da completare. M6/audit 79 descrivono limiti e recupero senza riproposta automatica. Nessuna versione o pubblicazione in produzione.

## Lettore e prova browser della nota — candidata 14/09/2026

Sullo stesso ramo experiment/m6-private-note-provider, base 840128de: lettura server di Account/profili/aziende, riuso della policy backend per i collegamenti inversi e prova del provider reale nel browser. Assenza di prove o sorgenti troncate impediscono l'editor; il backend conserva il controllo finale in transazione. Entry del laboratorio e apertura iniziale offline ancora da completare. Dettagli in M6/audit 80; nessuna versione, migrazione o distribuzione.

Validazione finale audit 80: npm test completo superato (183 test shell e 114 offline inclusi); Chrome/Edge superati, 9 scenari generici e 20 privati per browser, 58 esecuzioni totali. Compresi lettore Firebase reale, blocco dei link inversi e salvataggio del provider. App Check resta sintetico e il laboratorio principale non è ancora attivato.

## Entry locale della nota — candidata 14/09/2026

Ramo experiment/m6-private-note-provider, base 8343282e, stessa PR #63: editor attivo nel laboratorio per Alfa privato con trasporto emulato, code nuove e conferma server. Risolta la nota vecchia dopo salvataggio: il dettaglio rilegge dal repository confermato. Zeta incompatibile resta consultabile. Test dedicato --entry-browser; dettagli e gate residui in M6/audit 81. Nessuna versione o pubblicazione in produzione.

Validazione finale audit 81: suite completa npm test superata, inclusi 189 test shell e 114 offline. Regressioni Chrome/Edge della coda: 58 esecuzioni superate. Nuovo collaudo dell'entry: 5 verifiche per browser, 10 esecuzioni superate (68 totali). Dopo le ultime guardie di chiusura, rieseguiti i 21 test mirati di coda/dettaglio e il collaudo dell'entry. Nessuna prova App Check remota o su dispositivo fisico.

## Recupero offline della nota — candidata 14/09/2026

Ramo experiment/m6-private-note-provider, base 48b1eae6: il dettaglio aperto offline recupera soltanto la modifica esistente, senza nuovo editor o prove server inventate. Prova Chrome/Edge con rete effettivamente disabilitata tramite DevTools, blocco/sblocco Vault e ritorno online con ricevuta. Sessione e cache erano già disponibili: avvio a freddo e PWA fisica restano gate distinti. Dettagli in M6/audit 82; nessun master o deploy.

Validazione finale audit 82: npm test completo superato, inclusi 191 test shell e 116 offline. Chrome/Edge: 58 regressioni coda/provider e 18 verifiche dell'entry (9 per browser), 76 esecuzioni totali. La rete viene disabilitata dal protocollo DevTools, con HTTP effettivamente bloccato; superati recupero, nuovo sblocco offline e retry al ritorno online. Questa prova non certifica avvio a freddo o PWA fisica.

## Consultazione offline dei domini — candidata 14/09/2026

Base 3af7006b, stessa PR #63. Le password collegate nei profili usano la cache quando offline, mantenendo server confermato online e controlli d'identità. Ampliata la prova a dati bancari e altri domini sintetici già caricati. Il test riguarda repository e decifratura, non tutte le UI o i file Storage; M6/audit 83 riportano la matrice e i gate aperti. Nessuna versione o distribuzione.

Validazione finale audit 83: npm test completo superato (inclusi 191 test shell, 116 offline e 65 test dei collegamenti dei profili). Collaudo entry su Chrome ed Edge: 25 verifiche per browser, 50 esecuzioni superate, con rete DevTools disabilitata e ripristinata. Questa matrice certifica letture dei dati sintetici già caricati nella sessione del laboratorio, non avvio a freddo, tutte le UI o file Storage offline.

### Audit 84 — ciclo online/offline e blocco della consultazione (14/09/2026)

Base 2dc18daa, stessa PR #63. Il collaudo dell'entry verifica esplicitamente che la matrice dei dati già caricati sia ancora consultabile dopo il ritorno online e che il probe protetto rifiuti la lettura dopo blocco del Vault, sia offline sia online. Chrome ed Edge: 28 verifiche per browser, 56 esecuzioni superate con emulatori e fixture locali. Modifica limitata al collaudo: nessun cambiamento runtime produttivo. La suite completa resta quella superata sul checkpoint precedente; non viene dichiarata rieseguita in questo incremento.

Programma: avanzamento della verifica M6, senza chiusura globale. Restano avvio a freddo/cache persistente, file Storage, copertura delle UI e compatibilità estesa, rollout e prove fisiche/remoti. M8 conserva staging/journal e verifiche memoria/dispositivi; M9 conserva le prove fisiche di accessibilità. Nessun master, versione o deploy.

## Reload con cache persistente — candidata 14/09/2026

Base 613dece6, stessa PR #63: comando di collaudo node scripts/run-vault-session-emulators.mjs --cold-browser. Usa esclusivamente demo locali e browser temporanei, prepara i dati, ricarica senza rete e richiede un nuovo sblocco. 44 verifiche Chrome/Edge superate; limiti e rete DevTools documentati in M6/audit 85. Il normale laboratorio non cambia persistenza; nessun deploy o test sui dati reali. La chiusura forzata della PWA e il riavvio fisico restano da provare.

Validazione finale audit 85: npm test completo superato, inclusi 194 test shell e 116 offline. Nuovo collaudo persistente: 44 esecuzioni Chrome/Edge superate; regressione entry ordinaria: 56 esecuzioni superate, 100 verifiche browser complessive nei due collaudi. Nessuna certificazione di chiusura processo, riavvio dispositivo o PWA produttiva.

## Riavvio offline del browser — candidata 14/09/2026

Base ba529553, stessa PR #63. Il comando node scripts/run-vault-session-emulators.mjs --restart-browser prepara le fixture, termina il browser di prova e lo riapre senza rete sullo stesso profilo temporaneo. Nuovo sblocco richiesto e matrice cache leggibile; 46 verifiche Chrome/Edge superate. M6/audit 86 distinguono questa chiusura controllata da arresto forzato, riavvio fisico e PWA iPhone. Produzione invariata.

Validazione finale audit 86: npm test completo superato (194 test shell e 116 offline inclusi). Chrome/Edge: 46 verifiche del riavvio processo, 44 del reload e 56 dell'entry ordinaria, 146 esecuzioni complessive superate. Nessun test su dispositivo fisico o dati reali; nessun deploy.

## Arresto forzato e nota pendente — candidata 14/09/2026

Base 1947b5c1, stessa PR #63. Comando node scripts/run-vault-session-emulators.mjs --crash-browser: nota fittizia accodata offline, terminazione forzata del solo browser temporaneo, recupero dopo nuova Master Password e sincronizzazione esplicita. 50 verifiche Chrome/Edge Windows superate. La rete non viene riattivata prima dell'interruzione. Limiti in M6/audit 87; nessun deploy o dato reale.

Validazione finale audit 87: npm test completo superato (194 test shell e 116 offline inclusi). Chrome/Edge Windows: 50 verifiche arresto forzato/nota pendente, 46 riavvio controllato, 56 entry ordinaria e 44 reload; 196 esecuzioni browser superate. Percorso Linux di terminazione non collaudato in questo incremento. Nessun test su dati reali o deploy.

## Lista offline dalla Home su iPhone — candidata 14/09/2026

Base 1b341c74, stessa PR #63. Corretto il controllo iniziale delle pagine private: refresh Auth solo online, identità corrente verificata richiesta anche offline e arresto del vecchio bootstrap su cambio UID. Riprodotto il blocco presente nella 1.2.124; 7 test dedicati. La PWA sull'iPhone resta alla release pubblicata: non chiedere di ripetere la prova prima di una pubblicazione autorizzata. Dettagli in M6/audit 88; nessun deploy.

Validazione finale audit 88: npm test completo superato, inclusi 88 controlli statici sicurezza, 11 test security (7 nuovi sul bootstrap), 194 test shell e 116 offline. Inventario aggiornato e controllo whitespace superato. I 196 scenari browser dell'audit 87 non sono stati rieseguiti né attribuiti a questa modifica del bootstrap produttivo; retest iPhone ancora necessario dopo rilascio autorizzato.

## Rilascio isolato iPhone 1.2.125 — 15/09/2026

PR #64 unita in master 263355f261c0fe0661089e2c65782edf1d13527a; release 6b36ae2d, backport isolato del controllo Auth offline. npm test locale e workflow GitHub 34931928458 superati. Deploy Hosting completato; verificati via HTTP gli hash di Home, env-v126.js, sw.js e main-v129.js rispetto al rilascio testato. Functions, Rules e dati non distribuiti/modificati. Prova iPhone Home → modalità aereo → lista ancora da ripetere dopo aggiornamento alla 1.2.125.

La PR #63 resta sperimentale e separata: non è stata unita o distribuita. Prima di un suo futuro rilascio occorre riallinearne la base/versione al nuovo master; non distribuire direttamente il vecchio numero 1.2.124 del ramo. Il programma generale e i gate fisici restano aperti.

### Verifiche fisiche e preparazione profilo — 15/09/2026

L'utente conferma su iPhone 1.2.125 la consultazione degli Account e dei dati già caricati, anche dopo chiusura completa, riapertura offline e nuovo sblocco del Vault. Precisa però che il profilo utente inizialmente mostrava un errore generico: dopo averlo visitato online i suoi dati diventano leggibili offline. Queste prove non certificano l'intero archivio, file Storage, riavvio del dispositivo o cache espulsa.

Correzione candidata sulla PR #63: la preparazione online include esplicitamente il documento users/{uid}, oltre alle raccolte già previste. Il vecchio marker completo non evita il nuovo caricamento del profilo; una lettura fallita o un documento assente mantengono la preparazione incompleta. Le pagine principali di profilo, aziende, liste e dettagli Account distinguono i fallimenti di connettività offline dagli altri errori. Permessi, autenticazione e decifratura non vengono riclassificati come cache mancante. Le query vuote offline restano ambigue: non equivalgono a prova di archivio vuoto o completo.

Non occorre visitare il profilo per prepararlo dopo questa correzione, ma occorrono rete e completamento del caricamento automatico. Nessuna nuova cache di chiavi o dati decifrati, nessun cambiamento a scritture, allegati o Rules. Candidato non pubblicato: produzione resta 1.2.125; PR #63 resta da riallineare prima di un futuro rilascio.

Validazione: npm test completo superato, inclusi sei nuovi test su preparazione profilo, marker precedente, lettura fallita/assente, assenza rete e classificazione degli errori. Gli ambienti dei test delle pagine caricano il nuovo gestore condiviso. Il candidato non è stato ancora collaudato su iPhone né distribuito.

### Audit 90 — Widget Account e credenziali comuni offline (15/09/2026)

Base 9f769aab, stessa PR #63. Su richiesta dell'utente la verifica riguarda Widget Account e credenziali comuni; foto e byte degli allegati sono esplicitamente esclusi dal requisito di consultazione offline, per evitare carichi eccessivi nella cache. Non chiedere il loro caricamento offline come condizione per chiudere questo requisito. L'utente intende mantenere la sessione autenticata (nessun logout), anche chiudendo e riaprendo l'app.

Riscontro: i componenti di consultazione già leggono accountWidgets e sharedVaultData tramite il repository con cache e decifrano localmente dopo sblocco. Queste due raccolte mancavano però dalla preparazione automatica. Ora sono incluse; un nuovo marker widgetsIncluded impedisce che il precedente stato completo salti il caricamento. Un fallimento di una delle due mantiene la preparazione incompleta. I riferimenti condivisi usati nelle schede Account risiedono in accountWidgets; non occorre scaricare file Storage.

Validazione: test:data-access, test:offline, test:js-syntax e controllo whitespace superati. Sette nuove regressioni: tre sulla preparazione (inclusione senza visita, fallimento di ciascuna raccolta) e quattro sulla UI reale eseguita in ambiente simulato, con letture server vietate offline, per Widget/credenziali e Account personali/aziendali. Verificati rendering, rivelazione del valore e rimozione al blocco; zero scritture. Crittografia nei test UI simulata: non attribuire una nuova prova fisica iPhone o end-to-end a questi risultati. La suite completa era passata su 9f769aab; questo incremento ha eseguito i controlli mirati indicati.

Nessun deploy, bump, modifica a master, scrittura dati o estensione delle modifiche offline. Produzione resta 1.2.125; il candidato sperimentale richiede il riallineamento già previsto prima del rilascio.

## Rilascio isolato 1.2.126 completato — 15/09/2026

PR #65 unita in master a14d0198b37507b7c6fb0e7352fe8930d57a9f0d, candidato bb926671693f52348a4d2f9a6032d532170e7635 sulla base produttiva 1.2.125. Distribuite soltanto preparazione offline del profilo, accountWidgets/sharedVaultData e spiegazione degli errori di connettività nelle pagine principali. Il gestore del profilo viene importato su errore; intestazione del modulo abbreviata per il budget. Non sono stati importati i cambiamenti sperimentali dei componenti Widget.

npm test completo della release superato; GitHub Actions 34937232687, job validate 104277695629 riuscito. Tredici test offline del ramo produttivo (preparazione/classificazione e quattro letture Widget/credenziali private/azienda con rivelazione e mascheramento simulati). Hosting distribuito con successo, 240 file. Verificati via HTTP gli hash SHA256 di Home, env-v126.js, sw.js, offline-sync.js, read-error-message.js, profilo_privato.js e offline-assets.js: corrispondono al candidato testato. Functions, Rules e dati invariati.

Retest iPhone ancora richiesto sulla 1.2.126: app online fino a completamento preparazione, poi modalità aereo senza logout; profilo, Widget e credenziali comuni consultabili senza visita preventiva. Foto e allegati esclusi per decisione dell'utente. Non interpretare la nuova pubblicazione come test fisico riuscito o garanzia contro cache espulsa.

PR #63 resta separata e aperta. Produzione ora 1.2.126: prima di un futuro rilascio sperimentale riallineare master, versioni e i due backport già distribuiti, evitando duplicazioni. Non distribuire direttamente la vecchia versione 1.2.124 del ramo sperimentale.

## Rilascio isolato Auth 1.2.127 completato — 15/09/2026

PR #66 unita in master 0ba2332b298d155f0afb1a4eb50c9659115fe321; release 94792d837cadd538e17aa67e439df1c68a09a23a. Pubblicazione Hosting autorizzata e completata. Le 22 pagine private rimangono nascoste fino alla conferma Auth; errore, timeout e logout mantengono il blocco. Pulizia locale/Vault prima del tentativo di signOut. Nessuna lettura o modifica di dati reali; Functions e Rules non distribuite.

npm test completo e dieci scenari browser Chrome/Edge superati; GitHub Actions 34939530695 riuscita. Dopo il deploy, 31 file pubblicati corrispondono via SHA256 alla release. Prova Chrome con profilo isolato senza credenziali: nessuna struttura privata visibile e arrivo a /login-v115.html senza parametro di errore/timeout. Collaudo fisico iPhone ancora da eseguire, inclusa riapertura offline con sessione mantenuta e sblocco Vault.

Produzione ora 1.2.127. PR #63 resta sperimentale: riallineare con master prima di integrare, evitando duplicazioni dei backport offline e logout. La direzione shell persistente resta confermata; questo rilascio non chiude il P0 legacy del wrapping in sessionStorage né l'intero audit sicurezza. Dettagli implementativi e regressioni sono in docs/AUDIT_VAULT_SESSION_P0.md del ramo produttivo e nella PR #66.

## Correzione candidata apertura offline su iPhone — 14/09/2026

Ramo fix/iphone-offline-bootstrap, base pubblicata 9e5335d9 (1.2.124). Backport selettivo della correzione 291ce2bb: refresh dell'identità Firebase solo online, utente corrente verificato richiesto anche offline, arresto del bootstrap su cambio UID durante l'attesa. Nessuna integrazione della shell sperimentale. Sette regressioni dedicate incluse nella suite security; npm test completo superato su questa base.

Rilascio non eseguito e versione invariata. Dopo pubblicazione autorizzata ripetere su PWA iPhone Account online → Home → modalità aereo → lista. Il retest fisico resta necessario; questo backport non certifica l'offline completo o gli allegati.

## Apertura pagine private offline — rilascio 1.2.125, 15/09/2026

Pubblicazione della sola correzione iPhone autorizzata dall'utente. Il refresh Auth avviene online; offline resta richiesto l'utente Firebase corrente verificato, seguito dal normale sblocco Vault. Aggiornati versione e riferimenti statici tramite lo script canonico; verificato che il diff di release contenga soltanto 1.2.124 → 1.2.125. npm test completo e sette regressioni dedicate superati. Destinazione: Hosting soltanto, senza Functions, Rules o dati; shell sperimentale esclusa. Dopo rilascio ripetere Home → modalità aereo → lista sulla PWA iPhone. Rollback Hosting: 1.2.124, con il blocco offline noto.

## Candidata 1.2.126 — preparazione offline profilo, Widget e credenziali (15/09/2026)

Backport isolato da 9f769aab e 61cd253e, sulla produzione 1.2.125 (master 263355f2). La preparazione online include il documento del profilo, accountWidgets e sharedVaultData senza visita preventiva delle singole pagine; marker precedenti invalidati e stato incompleto in caso di letture fallite. Messaggi di indisponibilità offline nelle principali pagine di profilo, aziende e Account, senza riclassificare errori di permessi o decifratura. Il profilo carica il gestore messaggi solo nel percorso di errore; intestazione del modulo abbreviata per mantenere il budget statico di apertura.

Tredici test offline: nove sulla preparazione/classificazione e quattro sulla consultazione dei componenti della base produttiva (privato/azienda, Widget/credenziali), con server vietato offline e rivelazione/mascheramento simulati. Non attribuire a questo backport i test di lifecycle della shell sperimentale. Prima del rilascio sono richiesti npm test completo e controllo versione; budget statico delle 31 pagine verificato.

Foto e allegati esclusi dall'offline per decisione dell'utente. Nessuna estensione delle scritture, Functions o Rules. La PR #63 e la shell persistente restano separate dal rilascio. Dopo pubblicazione verificare fisicamente iPhone: completare caricamento online, passare offline senza logout e consultare profilo, Widget e credenziali senza averne aperto prima le pagine.

## Verifica della visibilità prima di Auth — candidata del 15/09/2026

Sulla 1.2.126 pubblicata riprodotta in Chrome isolato la Home generica visibile prima del redirect al login; nessun accesso a dati reali. La candidata mantiene hidden/inert le 22 pagine private fino alla conferma Auth, gestisce errore/timeout e risposte tardive, centralizza la pulizia locale prima di signOut. Nessun bump o deploy.

Il requisito generale era già previsto dagli MD; mancava il test del primo frame produttivo. Quattordici nuove regressioni, sette test offline precedenti, dieci scenari locali Chrome/Edge e npm test completo superati. Il costo del modulo sincrono è documentato: massimo 336.8 KB gzip, tetti 337 KB/43 moduli. Restano collaudo iPhone e audit generale Vault; la shell persistente rimane separata. Evidenze, file, minaccia, limiti e rollback nell'ultima sezione di [AUDIT_VAULT_SESSION_P0.md](../docs/AUDIT_VAULT_SESSION_P0.md).

## Preparazione rilascio Auth 1.2.127 — 15/09/2026

Rilascio isolato autorizzato dall'utente dopo revisione della PR #66. Base fa34e9d0, su master 1.2.126 a14d0198; nessuna integrazione della shell sperimentale. Aggiornamento tramite script canonico: 246 riferimenti asset in 94 file; verificato che le differenze runtime successive al candidato siano soltanto sostituzioni 1.2.126 → 1.2.127.

npm test completo superato sulla 1.2.127; dieci scenari browser locali Chrome/Edge superati (anonimo, valido, errore, timeout e logout). CI precedente del candidato fa34e9d0: run 34939242389 riuscito; attendere anche il controllo del nuovo commit di release prima del merge. Dopo Hosting verificare hash dei file e accesso anonimo in browser isolato. Resta il collaudo fisico iPhone/PWA e il programma della shell; Functions, Rules, formati crittografici e dati utente esclusi dal rilascio.

## Integrazione sicurezza e shell, 15/09/2026

Riallineata la candidata al master 1.2.127 nel merge 1089cde8, mantenendo le protezioni di entrambi i rami. Rules distribuite confrontate e coincidenti con quelle testate. L'ingresso Firebase della shell ora elimina il materiale di sessione legacy senza riutilizzarlo e blocca/chiude la Vault agli eventi del browser o al rifiuto Auth. Evidenze e limiti nel capitolo finale di docs/AUDIT_VAULT_SESSION_P0.md. La shell resta parziale: produzione invariata, VS-P0-01 ancora aperto fino alla sostituzione del percorso multipagina e collaudo completo. Nessuna nuova autorizzazione architetturale da richiedere; nessun deploy effettuato.

## Profilo nella shell: prima consultazione protetta — 15/09/2026

PR #67: route locale per Anagrafica, Contatti, Indirizzi e Documenti, con repository canonico e chiave confinata alla sessione RAM. Navigazione senza reload e rimozione dei testi all'uscita. Fixture allineate ai nomi reali dei campi; lettura online/offline e dopo arresto del browser verificata su dati sintetici. Dettagli e limiti nell'ultimo capitolo di docs/AUDIT_VAULT_SESSION_P0.md. Editor, collegamenti, utenze e tessera digitale ancora da integrare; nessuna attivazione in produzione o chiusura del rischio legacy.

## Consultazione degli Account collegati nella shell — 15/09/2026

Stessa PR #67: apertura e ritorno al profilo senza reload, password dell'Account collegato su richiesta con mostra/nascondi/copia, anche quando email e telefono condividono l'Account o il destinatario è aziendale. Controlli di provenienza e sessione ripetuti dopo le attese; nessun riuso delle vecchie password dei contatti. Suite completa superata, 232 test shell finali e 126 verifiche browser online/offline/arresto superate. Limiti del pre-caricamento della cache ed evidenze nell'ultimo capitolo di docs/AUDIT_VAULT_SESSION_P0.md. Modifica dei collegamenti e parità completa dei profili ancora da integrare; nessun deploy e rischio legacy produttivo ancora aperto.

## Consegna e riordino locale — 16/09/2026

La cartella operativa unica è `C:/Users/Diego/Documents/Progetti/App-Codici-Password`, ramo `integration/vault-shell-v127-security`. Le vecchie copie e i worktree temporanei sono stati inclusi in un archivio locale verificato e rimossi; il materiale Excel resta disponibile su `origin/codex/real-excel-export-preview` al commit `40052515`. Il checkpoint applicativo della candidata resta `ebf1b1fa`; i commit documentali successivi aggiornano consegna e percorsi senza cambiare il runtime.

Produzione resta 1.2.128, master `4efda528`, PDF aziendale pubblicato tramite PR #68. La candidata è committata e inviata su GitHub, ma non è stata unita in master né distribuita perché mancano ancora parità funzionale, trasporto produttivo e App Check, transizione dei writer, migrazione/rollback e collaudi fisici. Inoltre deve essere riconciliata selettivamente con i commit produttivi successivi. Il comando di avvio e l'ordine operativo per un nuovo agente sono in `docs/PASSAGGIO_CONSEGNE_2026-09-16.md`; nessun deploy o modifica dati è stato eseguito durante il riordino documentale.
