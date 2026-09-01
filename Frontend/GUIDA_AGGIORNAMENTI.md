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

Questa sezione sostituisce i vecchi report di audit e i documenti di migrazione V3 separati.

- [ ] **P0 — Firestore Rules condivisioni**: eliminare l'accesso generico basato sul solo `visibility="shared"`. Lettura e aggiornamento devono essere consentiti esclusivamente al proprietario o a un ospite presente nella Map `sharedWith` con stato `accepted`; limitare inoltre i campi aggiornabili dall'ospite.
- [ ] **P0 — Test regole**: eseguire i casi `permission-denied` della sezione 5.8 della `GUIDA.md` contro emulatori o progetto di test prima del go-live.
- [ ] **App Check**: il client reCAPTCHA è configurato; verificare nella Firebase Console che l'enforcement sia attivo per Firestore e Storage.
- [ ] **Compatibilità legacy**: verificare nel database l'assenza di record che dipendono da `shared`, `isMemoShared`, `hasMemo` o `sharedWithEmails`; solo dopo rimuovere i fallback di lettura dal frontend e dalle Rules.
- [ ] **Globali residue**: sostituire `window.deleteAccount`; mantenere soltanto le globali tecniche giustificate per Tailwind e il tema finché l'architettura attuale le richiede.
- [ ] **Deploy GitHub**: sostituire il token legacy `FIREBASE_TOKEN` con credenziali di servizio/ADC generate dalla procedura ufficiale `firebase init hosting:github`. Il workflow attuale pubblica soltanto Hosting; Functions, Rules e indici richiedono un rilascio separato e controllato.

I vecchi script di importazione e backfill sono stati rimossi: non devono essere ricreati senza una nuova procedura approvata, un backup Firestore e un piano di rollback.

---

### 📝 Note per l'Agente AI:
Quando lavori su queste sezioni, documenta qui ogni progresso. Se l'utente approva un nuovo stile o una nuova logica, prepara lo snippet per il trasferimento nel **Protocollo Master**.
