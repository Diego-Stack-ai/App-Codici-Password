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
- **Stato**: ✅ Implementato (V7.1 Core).
- **Dettagli**:
    - ✅ Attivata persistenza `IndexedDB` in `firebase-config.js` (Multi-tab support).
    - ✅ Aggiornato `sw.js` al protocollo **V7.0-MASTER** con asset-caching rinforzato.
    - ✅ L'app è ora pienamente operativa offline per i dati già consultati.

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
