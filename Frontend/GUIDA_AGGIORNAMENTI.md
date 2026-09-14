# 🧪 REGISTRO AGGIORNAMENTI, RISCHI E WIP — APP CODICI PASSWORD

> **Stato:** registro operativo e cronologico.
> **Autorità:** roadmap subordinata ai contratti, non certificazione; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** release e attività aperte.
> **Dipendenze:** [Guida progetto](../docs/GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

## Stato corrente — riallineamento documentale 12/09/2026, v1.2.110

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
