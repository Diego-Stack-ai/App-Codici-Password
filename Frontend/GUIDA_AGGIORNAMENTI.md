# 🧪 LABORATORIO AGGIORNAMENTI & WIP — APP CODICI PASSWORD

In questo documento vengono tracciate le nuove funzionalità, i refactoring in corso e le evoluzioni estetiche non ancora consolidate nel Protocollo Master. Una volta che una funzionalità raggiunge la perfezione tecnica e stilistica, viene migrata nella `GUIDA.md` (Master).

---

## 1. ROADMAP: END-TO-END ENCRYPTION (E2EE)
L'obiettivo finale è la **conoscenza zero** (Zero-Knowledge Architecture).
- **Stato**: In fase di studio logico.
- **Implementazione**: Uso di `libsodium.js` per cifratura client-side.
- **Dettagli**:
    1. Cifratura sul dispositivo prima dell'invio a Firebase.
    2. Chiave di recupero (Recovery Key) da 24 parole.
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

- prototipo isolato, non collegato ai dati reali;
- almeno 20 immagini di test per ciascun profilo, prive di dati personali reali;
- precisione campo per campo definita e verificata;
- nessun caricamento di immagini su rete durante il percorso locale;
- bundle OCR escluso dal caricamento iniziale e dalla cache offline obbligatoria;
- revisione specifica per PCI/privacy prima di gestire carte di pagamento reali.

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
