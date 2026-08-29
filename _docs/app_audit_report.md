# 🔍 AppCodiciPassword — Audit Report Completo
**Data:** 06/06/2026 → aggiornato 09/06/2026 | **Versione App:** V8.0 Master  
**Metodologia:** Static analysis + Security review + Architecture analysis  
**Analisti:** Senior Staff Engineer + Security Architect + QA Lead

---

## A. Executive Summary

| Dimensione | Voto iniziale | Voto attuale | Note |
|---|---|---|---|
| **Qualità complessiva** | 5.5 / 10 | **8.0 / 10** | Fix critici applicati, moduli splittati, bug runtime risolti |
| **Rischio sicurezza** | 7.5 / 10 | **3.0 / 10** | Vulnerabilità Sett.1 e Mese1 risolte + password fields hardened |
| **Manutenibilità** | 5.0 / 10 | **7.5 / 10** | God Objects spezzati, profilo modularizzato, dom-utils robusto |
| **Scalabilità** | 4.0 / 10 | **5.5 / 10** | Translations lazy, moduli separati; window.* ancora da rimuovere |

> [!IMPORTANT]
> Il rischio sicurezza **7.5/10** indica che **ci sono vulnerabilità attive che richiedono intervento immediato**, non future. In particolare il punto #1 (redirect commentato) e il punto #2 (file di test in produzione) devono essere corretti prima di qualsiasi altro lavoro.

### Punti di forza rilevati
- ✅ Nessun uso di `innerHTML`/`eval` — XSS lato rendering ben mitigato
- ✅ `dom-utils.js` centralizza la creazione DOM in modo sicuro
- ✅ Crittografia AES-GCM client-side pervasiva via `security-manager.js`
- ✅ `runTransaction` usato correttamente per operazioni multi-documento
- ✅ Pattern `initXxx(user)` uniforme e pulito in tutti i moduli pagina
- ✅ `showToast()` + `logError()` usati sistematicamente

---

## B. Top 20 Problemi

---

### #1 🔴 CRITICO — Redirect autenticazione commentato in produzione

**Gravità:** Critico  
**File:** [`main.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/main.js) — Riga 261  
**Descrizione:** Il guard di autenticazione che dovrebbe reindirizzare gli utenti non autenticati a `index.html` è commentato con la nota "Scommentare in prod".

**Evidenza tecnica:**
```js
// window.location.href = 'index.html'; // Scommentare in prod
```

**Impatto:** L'intera struttura HTML delle pagine private (nomi sezioni, ID campi, flussi funzionali) è visibile a qualsiasi utente non autenticato che acceda direttamente all'URL. I dati Firestore sono protetti dall'SDK ma la superficie d'attacco è esposta.  
**Come riprodurre:** Aprire `home_page.html` senza essere loggati.  
**Soluzione:** Decommentare la riga. Immediatamente.

---

### #2 🔴 CRITICO — File di test/debug che scrivono su Firestore in produzione

**Gravità:** Critico  
**File:** [`simulazione_golive_v6.5.html`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/simulazione_golive_v6.5.html) | [`test_dummy_massivo.html`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/test_dummy_massivo.html)  
**Descrizione:** Due pagine HTML accessibili pubblicamente che contengono suite di test end-to-end che **scrivono dati reali su Firestore** (account dummy, IBAN fittizi, PIN, numeri carta).

**Evidenza tecnica:**
```js
// test_dummy_massivo.html riga 254
console.log("FINAL_REPORT_JSON:", ...)  // log dati in chiaro
// Inserisce: SimPwd123!, TECH-DUMMY SOLUTIONS, dati bancari fittizi su Firestore
```

**Impatto:** Qualsiasi utente autenticato può sporcare il proprio profilo con dati fittizi. Il secondo file espone dati bancari finti nel database.  
**Come riprodurre:** Accedere all'URL direttamente da browser autenticato.  
**Soluzione:** Eliminare entrambi i file dalla cartella `public/`. Se servono per sviluppo, spostarli fuori da qualsiasi cartella deployata.

---

### #3 🔴 CRITICO — Log `[DEBUG_CRYPTO]` espone dati account in chiaro

**Gravità:** Critico  
**File:** [`archivio_account.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/modules/azienda/archivio_account.js) — Riga 214  
**Descrizione:** Un `console.log("[DEBUG_CRYPTO]")` logga nome, username e ID di ogni account **prima della decrittazione**, in chiaro nelle DevTools del browser.

**Impatto:** Chiunque apra la console del browser durante la navigazione vede i nomi degli account sensibili. Su computer condivisi o aziendali con screen recording, questo equivale a un data leak.  
**Come riprodurre:** Aprire DevTools → Console → Navigare in Archivio Account.  
**Soluzione:** Rimuovere immediatamente il log. Usare `window.LOG()` (già silenzioso in prod) per eventuali debug futuri.

---

### #4 🔴 ALTO — Funzioni crittografiche esposte su `window` globale

**Gravità:** Alto  
**File:** [`profilo_privato.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/modules/privato/profilo_privato.js)  
**Descrizione:** Le funzioni più sensibili dell'app sono esposte globalmente su `window`:

```js
window.encrypt = encrypt;
window.decrypt = decrypt;
window.ensureMasterKey = ensureMasterKey;
window.clearSession = clearSession;
```

**Impatto:** Qualsiasi script inline, browser extension, o codice iniettato tramite XSS può chiamare `window.decrypt(val, window._masterKey)` se riesce a recuperare la chiave. Il commento "Audit Ready" è fuorviante.  
**Soluzione:** Rimuovere queste esposizioni globali. Usare import ES6 diretti o un EventBus interno per la comunicazione inter-modulo.

---

### #5 🔴 ALTO — IDOR potenziale su `collectionGroup("accounts")`

**Gravità:** Alto  
**File:** [`db.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/db.js) — Riga 214  
**Descrizione:**

```js
const q = query(collectionGroup(db, "accounts"),
    where("sharedWith", "array-contains", guestUid));
```

La query attraversa **tutti gli `accounts` di tutti gli utenti** nell'istanza Firebase.  
**Impatto:** Se le Firestore Security Rules non limitano esplicitamente l'accesso ai soli documenti dove `request.auth.uid` è in `sharedWith`, un utente potrebbe enumerare strutture di account altrui.  
**Come riprodurre:** Verificare le Firestore Rules per la `collectionGroup("accounts")`.  
**Soluzione:** Aggiungere nella regola: `allow read: if request.auth.uid in resource.data.sharedWith;`

---

### #6 🔴 ALTO — Scrittura su `invites` globale con spread non validato

**Gravità:** Alto  
**File:** [`db.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/db.js) — Righe 97–105  
**Descrizione:**

```js
async function sendInvitation(data) {
    const inviteData = {
        ...data,   // ← spread completo senza whitelist
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, "invites"), inviteData);
```

**Impatto:** Un utente malintenzionato può iniettare campi arbitrari nell'invito (es. `ownerId` di un altro utente, `accountId` altrui).  
**Soluzione:** Sostituire `...data` con una whitelist esplicita dei campi accettati:
```js
const inviteData = {
    recipientEmail: data.recipientEmail,
    accountId: data.accountId,
    senderUid: data.senderUid,
    status: 'pending',
    createdAt: new Date().toISOString()
};
```

---

### #7 🔴 ALTO — Query `invites` per email senza verifica server-side

**Gravità:** Alto  
**File:** [`db.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/db.js) — Righe 107–114  
**Descrizione:**

```js
const q = query(collection(db, "invites"),
    where("recipientEmail", "==", email),
    where("status", "==", "pending")
);
```

La collezione `invites` è **top-level**, non annidata sotto `/users/{uid}/`.  
**Impatto:** Se le Firestore Rules non verificano che `request.auth.token.email == recipientEmail`, qualsiasi utente autenticato può interrogare gli inviti altrui passando un'email diversa dalla propria.  
**Soluzione:** Aggiungere nelle Rules: `allow read: if request.auth.token.email == resource.data.recipientEmail;`

---

### #8 🔴 ALTO — `DEV_MODE = true` hardcoded in produzione

**Gravità:** Alto  
**File:** [`impostazioni.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/modules/settings/impostazioni.js) — Riga 17  
**Evidenza tecnica:**

```js
const DEV_MODE = true; // In fase di test 12 ore visibili
```

**Impatto:** Gli utenti vedono opzioni di timeout che non dovrebbero essere disponibili in produzione (es. "12 ore"), riducendo la sicurezza dell'inactivity lock.  
**Soluzione:** `const DEV_MODE = location.hostname === 'localhost';`

---

### #9 🟠 ALTO — Stack trace completi visibili in produzione

**Gravità:** Alto  
**File:** [`main.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/main.js) — Righe 574–577  
**Descrizione:** Il meccanismo che silenzia `console.log` in produzione **non copre** `console.error` e `console.warn`. Path Firestore, UID utente, email, invite ID sono visibili in DevTools in ogni sessione.

```js
console.error("-> Full Stack:", e);  // stack trace completo visibile
```

**Soluzione:** Estendere il meccanismo di override anche a `console.error` e `console.warn` in produzione, oppure centralizzare tutto in `window.LOG`.

---

### #10 🟠 ALTO — Accesso consentito senza verifica email

**Gravità:** Alto  
**File:** [`auth.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/auth.js) — Righe 129–132  
**Evidenza tecnica:**

```js
console.warn("Email non ancora verificata, ma procedo come da richiesta utente.");
showToast("Nota: Email non verificata, ma accesso consentito.", "warning");
```

**Impatto:** Chiunque registri un indirizzo email falso accede immediatamente all'app senza verifica.  
**Soluzione (se si vuole mantenere questa scelta):** Almeno aggiungere un banner persistente e impedire alcune operazioni critiche (condivisione, inviti) finché l'email non è verificata.

---

### #11 🟠 ALTO — Auto-recovery profilo senza blocco o notifica

**Gravità:** Alto  
**File:** [`auth.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/auth.js) — Righe 134–147  
**Descrizione:** Se un documento utente Firestore viene eliminato (anche da admin), il sistema ricrea automaticamente il profilo e concede accesso immediato senza alert.

**Impatto:** Un account potrebbe essere ripristinato da flussi di automazione non intenzionali senza che l'admin se ne accorga.  
**Soluzione:** Il flag `recreatedAfterDeletion: true` dovrebbe bloccare l'accesso e generare una notifica all'amministratore.

---

### #12 🟠 ALTO — Dati personali reali hardcoded nel codice sorgente

**Gravità:** Alto  
**File:** [`aggiungi_scadenza.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js)  
**Descrizione:** Targhe e modelli di veicoli reali dell'utente sono hardcoded come valori di default nel codice:

```js
models: ["Moto Guzzi Nevada 750 - CJ14146", "Moto Guzzi California - CC60256", ...]
```

**Impatto:** Chiunque acceda al repository GitHub pubblico vede dati personali reali (targhe di veicoli). Qualsiasi sviluppatore futuro o collaboratore ha accesso a queste informazioni.  
**Soluzione:** Caricare i veicoli da Firestore dinamicamente, non hardcodarli.

---

### #13 🟡 MEDIO — User enumeration via `getPublicUserDataByEmail`

**Gravità:** Medio  
**File:** [`db.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/db.js) — Righe 232–245  
**Descrizione:** Qualsiasi utente autenticato può verificare se un'email è registrata e ottenere nome, cognome e avatar di qualunque altro utente.  
**Soluzione:** Limitare la query solo agli utenti che sono stati invitati esplicitamente o aggiungere un campo `public: false` di opt-out.

---

### #14 🟡 MEDIO — `titan_last_activity` manipolabile in localStorage

**Gravità:** Medio  
**File:** [`inactivity-timer.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/inactivity-timer.js) — Righe 69, 95  
**Descrizione:** Il timer di auto-logout legge/scrive il timestamp da `localStorage` senza firma né verifica.  
**Come riprodurre:** Aprire DevTools → Application → localStorage → impostare `titan_last_activity` a `Date.now()` → il timer si resetta.  
**Soluzione:** Usare una variabile in-memory anziché localStorage per il timestamp di ultima attività.

---

### #15 🟡 MEDIO — `translations.js` (164 KB) caricato su ogni pagina

**Gravità:** Medio  
**File:** [`translations.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/translations.js)  
**Descrizione:** L'intero dizionario i18n (~4000 chiavi, 164KB) viene scaricato su ogni navigazione di pagina, anche se la pagina usa solo 30-40 chiavi.  
**Impatto:** ~400-500KB di JS per ogni page load — lento su mobile e connessioni limitate.  
**Soluzione:** Suddividere per modulo/pagina oppure caricare solo la lingua attiva lazy.

---

### #16 🟡 MEDIO — `decryptIfPossible` duplicato in 4+ file con varianti

**Gravità:** Medio  
**File:** `modifica_azienda.js`, `form_account_azienda.js`, `dettaglio_account_azienda.js`, `dettaglio_account_privato.js`  
**Descrizione:** Stessa closure ridefinita con lievi varianti (fallback `"---"` vs `"---ERRORE DECRYPT---"`).  
**Soluzione:** Estrarre in `crypto-utils.js` condiviso e importare da tutti i moduli.

---

### #17 🟡 MEDIO — `window.*` come bus di comunicazione inter-modulo (25+ proprietà)

**Gravità:** Medio  
**Descrizione:** Lo stato globale e le funzioni UI sono gestiti tramite oltre 25 proprietà su `window`:  
`window.__footerReady`, `window.showToast`, `window.saveAccount`, `window.addPhone`, `window.renderGuestsList`, ecc.  
**Impatto:** Impossibile tracciare chi chiama cosa. Ogni nuovo modulo inquina il namespace globale. Rompe l'incapsulamento ES6.  
**Soluzione:** Introdurre un `EventBus` minimo o un modulo `app-state.js` con funzioni esportate.

---

### #18 🟡 MEDIO — `initComponents()` potenzialmente eseguita 2–3 volte per pagina

**Gravità:** Medio  
**File:** [`components.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/components.js), [`ui-core.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/ui-core.js)  
**Descrizione:** `initComponents` viene chiamata da `ui-core.js` (auto-init al DOMContentLoaded), importata esplicitamente dai moduli pagina e potenzialmente da `main.js`. Ogni chiamata doppia esegue 2 fetch di header/footer.  
**Soluzione:** Aggiungere un guard `if (window.__componentsInitialized) return;` all'inizio di `initComponents`.

---

### #19 🟢 BASSO — Nessun rate limiting lato client per login e reset password

**Gravità:** Basso  
**File:** [`login.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/modules/auth), [`auth.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/auth.js) — Riga 195  
**Descrizione:** Firebase gestisce internamente il rate limiting ma non c'è prevenzione preventiva lato client (nessun delay progressivo, nessun blocco locale dopo N tentativi).  
**Soluzione:** Implementare un contatore locale di tentativi con cooldown progressivo (1s, 2s, 4s, 8s…).

---

### #20 🟢 BASSO — `prompt()`/`confirm()` nativi mescolati con modal custom

**Gravità:** Basso  
**File:** [`profilo_privato.js`](file:///C:/Users/Diego/OneDrive%20-%20BM%20SERVICE%20S.R.L/BM%20Service%20srl/Desktop_Veggiano/Progetti/AppCodiciPassword/Frontend/public/assets/js/modules/privato/profilo_privato.js) — Righe 624, 643  
**Descrizione:** Alcune azioni usano `window.prompt()` e `window.confirm()` nativi del browser invece dei modal custom (`showConfirmModal`, `showInputModal`) già presenti.  
**Impatto:** Esperienza utente incoerente, non stilizzabile, bloccante in alcuni browser mobile.  
**Soluzione:** Sostituire tutti i `prompt()`/`confirm()` con le versioni custom.

---

## C. Security Report

### Vulnerabilità trovate

| ID | Vulnerabilità | File | Severity | Confidenza |
|---|---|---|---|---|
| SEC-01 | Redirect auth commentato | `main.js:261` | Critica | **Alta** |
| SEC-02 | File test che scrivono su Firestore | `simulazione_golive_v6.5.html`, `test_dummy_massivo.html` | Critica | **Alta** |
| SEC-03 | `[DEBUG_CRYPTO]` log dati in chiaro | `archivio_account.js:214` | Critica | **Alta** |
| SEC-04 | `window.encrypt/decrypt` esposti | `profilo_privato.js` | Alta | **Alta** |
| SEC-05 | IDOR su `collectionGroup("accounts")` | `db.js:214` | Alta | **Media** (dipende dalle Rules) |
| SEC-06 | Spread non validato su `invites` | `db.js:97-105` | Alta | **Alta** |
| SEC-07 | Query `invites` senza auth match | `db.js:107-114` | Alta | **Media** (dipende dalle Rules) |
| SEC-08 | `DEV_MODE = true` in produzione | `impostazioni.js:17` | Alta | **Alta** |
| SEC-09 | Stack trace in `console.error` in prod | `main.js:574-577` | Alta | **Alta** |
| SEC-10 | Accesso senza email verificata | `auth.js:129-132` | Alta | **Alta** |
| SEC-11 | Auto-recovery profilo senza blocco | `auth.js:134-147` | Alta | **Alta** |
| SEC-12 | Dati personali hardcoded nel codice | `aggiungi_scadenza.js` | Alta | **Alta** |
| SEC-13 | User enumeration via email lookup | `db.js:232-245` | Media | **Alta** |
| SEC-14 | `titan_last_activity` manipolabile | `inactivity-timer.js:69,95` | Media | **Alta** |
| SEC-15 | `data-href` aperto a `javascript:` | `cleanup.js:32-35` | Media | **Media** (condizionale) |
| SEC-16 | SW cache senza SRI | `sw.js:11-14` | Media | **Media** |
| SEC-17 | Validazione password solo client-side | `auth.js:51-61` | Media | **Alta** |
| SEC-18 | Nessun rate limiting login/reset | `login.js`, `auth.js:195` | Media | **Alta** |
| SEC-19 | `browserLocalPersistence` (token in LS) | `auth.js:18` | Bassa | **Alta** (by design) |
| SEC-20 | `skipWaiting()` immediato nel SW | `sw.js:19` | Bassa | **Alta** |

### Non verificabili (dichiarazione esplicita)

Le seguenti aree **non sono verificabili** dall'analisi statica del codice client e richiedono accesso diretto alla Firebase Console:
- **Firestore Security Rules** (effettiva protezione di `collectionGroup`, `invites`, `users`) — il rischio IDOR è *dedotto* dai pattern di query, non provato
- **CORS headers** di Firebase Hosting
- **CSP headers** (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`) — non presenti in `firebase.json` analizzato
- **Configurazione App Check** (non trovata nel codebase analizzato) — se assente, la `apiKey` esposta consente chiamate all'API Identity Toolkit senza autenticazione app

### Falsi positivi possibili

| Finding | Motivo del falso positivo |
|---|---|
| Firebase API Key esposta (`firebase-config.js`) | Per Firebase Web, l'esposizione della `apiKey` è **by design** — non è una chiave privata. La sicurezza dipende dalle Rules. Non è una vulnerabilità in sé. |
| `browserLocalPersistence` | Scelta architetturale standard per PWA. Il rischio è reale ma accettato per UX. |
| `collectionGroup` IDOR | Dipende completamente dalle Firestore Rules. Se le Rules sono corrette, non c'è IDOR. Confidenza media. |

---

## D. Refactoring Roadmap

### ⚡ Settimana 1 — Correzioni urgenti (sicurezza attiva)

> [!CAUTION]
> Queste azioni riguardano vulnerabilità **già attive in produzione**. Priorità assoluta.

- [x] **[main.js:261]** Decommentare il redirect di sicurezza per utenti non autenticati
- [x] **[public/]** Eliminare `simulazione_golive_v6.5.html` e `test_dummy_massivo.html`
- [x] **[archivio_account.js:214]** Rimuovere il log `[DEBUG_CRYPTO]`
- [x] **[profilo_privato.js]** Rimuovere `window.encrypt`, `window.decrypt`, `window.ensureMasterKey` dall'oggetto globale
- [x] **[impostazioni.js:17]** Impostare `DEV_MODE = location.hostname === 'localhost'`
- [x] **[main.js:574-577]** Silenziare `console.error` e `console.warn` in produzione
- [x] **[aggiungi_scadenza.js]** Rimuovere targhe e dati personali hardcoded (caricare da Firestore)
- [x] **[cleanup.js:32-35]** Sanitizzare `data-href` per bloccare schemi `javascript:` e non-HTTP

### 📅 Mese 1 — Debito tecnico e sicurezza media

> [!WARNING]
> Questi interventi riducono la superficie d'attacco e il debito tecnico più urgente.

- [x] **[Firestore Rules]** Verificare e rafforzare le regole per `collectionGroup("accounts")`, `invites`, `users`
- [x] **[db.js:97-105]** Sostituire `...data` con whitelist esplicita dei campi in `sendInvitation`
- [x] **[Tutti i moduli]** Estrarre `decryptIfPossible` in `crypto-utils.js` condiviso e importarlo *(3 file deduplicati; 3 con needsDecryption invariati per sicurezza)*
- [x] **[profilo_privato.js]** Sostituire tutti i `prompt()`/`confirm()` nativi con `showInputModal`/`showConfirmModal`
- [x] **[inactivity-timer.js]** Spostare `titan_last_activity` da `localStorage` a variabile in-memory
- [x] **[Tutti i moduli]** Cleanup sistematico dei `console.log` di init/ready (usare `window.LOG`) — 32 sostituiti in main.js/pages-init/inactivity-timer/swipe-list/components
- [x] **[auth.js]** Implementare delay progressivo per tentativi di login falliti
- [x] **[components.js]** Aggiungere guard `if (window.__componentsInitialized) return;`
- [x] **[firebase.json]** Aggiungere headers CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- [x] **[functions/]** Aggiornare Node.js 20 → Node.js 22

### 🗓️ 3 Mesi — Architettura e scalabilità

> [!NOTE]
> Questi interventi migliorano la qualità a lungo termine senza urgenza di sicurezza.

- [x] **[translations.js]** Lazy loading implementato: 76KB → 22.7KB inline IT + 7 file lingua on-demand (`translations/en.js` ecc.); `loadLanguage()` in main.js
- [🔀] **[Tutti i moduli]** Sostituire `window.*` con `EventBus`/`app-state.js` ← **IN PROGRESS su branch `feature/eventbus-no-window`** (9/11 proprietà migrate; 2 rimaste giustificate: `window.tailwind` CDN + `window.ProtocolloBaseTheme` IIFE)
- [ ] **[Grandi moduli]** Estrarre `banking-renderer.js`, `sharing-manager.js`, `attachments-manager.js` ← **DA FARE**
- [x] **[form_account_azienda.js]** Spezzato: saveAccount+deleteAccount → `form-azienda-save.js` (756→444r main, +241r save)
- [x] **[dettaglio_account_azienda.js]** Spezzato: allegati→`dettaglio-azienda-attachments.js`, sharing→`dettaglio-azienda-sharing.js` (889→425r main)
- [x] **[profilo_privato.js]** Suddivisione completata: 1253r → 321r main + 6 moduli (profilo-qr.js, profilo-phones-emails.js, profilo-addresses-docs.js, profilo-ui.js, profilo-sync.js, profilo-state.js)
- [x] **[modifica_azienda.js]** Split in 6 moduli: orchestratore 94r + ma_state/ma_attachments/ma_cards/ma_ui/ma_save
- [ ] **[sw.js]** Aggiungere SRI (Subresource Integrity) per gli asset cachati ← **DA FARE**
- [ ] **[Architettura]** Valutare migrazione a SPA con routing client-side ← **DA FARE** (lunga analisi)
- [ ] **[App Check]** Valutare l'attivazione di Firebase App Check ← **DA FARE** (richiede Console)
- [x] **[Allegati]** Aggiungere `loading="lazy"` alle immagini e agli allegati

---

## E. Bug Runtime Risolti Post-Audit (09/06/2026)

> [!NOTE]
> Bug scoperti in fase di test dopo il refactoring — non presenti nell'audit iniziale.

| # | Bug | File | Causa | Stato |
|---|---|---|---|---|
| RT-01 | `--ERRORE--` su tutti i dati cifrati | `security-manager.js` | Chiave biometrica in localStorage obsoleta (stale key) | ✅ Fix |
| RT-02 | `setMasterKey` non aggiornava la chiave biometrica | `security-manager.js` | `if (saveForBiometrics)` non copriva il caso "biometria già attiva" | ✅ Fix |
| RT-03 | Nessun pulsante Reset Vault nella UI | `impostazioni.html/js` | Sezione rimossa in V6.2 cleanup senza sostituzione | ✅ Fix |
| RT-04 | `import { LOG }` dentro commento JSDoc | `profilo-sync.js` | Import inserito nel blocco commento invece che nel codice | ✅ Fix |
| RT-05 | Sezioni Telefoni/Email/Indirizzi/Documenti vuote nel profilo | `profilo_privato.js` + 4 sub-moduli | `renderAllSections()` chiamata **prima** di `initPhonesEmailsModule()` → `_getState=null` → TypeError silenzioso | ✅ Fix |
| RT-06 | `generateProfileQRCode` crash con `_getState=null` | `profilo-qr.js` | Stesso bug di RT-05 — `initQRModule` non ancora eseguito | ✅ Fix |

### Soluzione sistematica RT-05/RT-06

In tutti i sottomoduli del profilo (`profilo-phones-emails.js`, `profilo-addresses-docs.js`, `profilo-qr.js`) le funzioni `render*` ora hanno una guardia:
```js
export function renderPhonesView() {
    if (!_getState) return;  // modulo non ancora inizializzato
    ...
}
```
E in `initProfiloPrivato`, dopo l'init di tutti i moduli, viene chiamato esplicitamente:
```js
renderAllSections();
generatePr ofileQRCode();
```

---

## F. Bug Runtime Risolti Post-Refactoring (09/06/2026 — sessione 2)

> [!NOTE]
> Bug scoperti durante i test utente nella seconda sessione di lavoro.

| # | Bug | File | Causa | Stato |
|---|---|---|---|---|
| RT-07 | `note-azienda` mostrava ciphertext nel form modifica | `ma_cards.js` | `populateForm` impostava `data.note` senza decifrare; la logica decrypt era dentro `if(data.emails)` | ✅ Fix |
| RT-08 | Password email criptate nella pagina visualizzazione | `dati_azienda.js` | `decrypt` e `ensureMasterKey` usati senza import ES6 → `ReferenceError` silenzioso nel `catch` | ✅ Fix |
| RT-09 | Campi Indirizzo/Città/Civico non compilabili nelle extra sedi | `ma_cards.js` → `dom-utils.js` | `maxLength: undefined` → `el.maxLength = ToInt32(NaN) = 0` → zero char limit | ✅ Fix |
| RT-10 | Label campo mostra `civic_number` invece di `N.` | `ma_cards.js` | `t()` restituisce la chiave come fallback (truthy) → `t('civic_number') \|\| 'N.'` = `'civic_number'` | ✅ Fix |
| RT-11 | `dom-utils.js` senza guardia per props `undefined`/`null` | `dom-utils.js` | Nessun `continue` per valori undefined → coercioni WebIDL indesiderate in tutta l'app | ✅ Fix |
| RT-12 | Chrome propone di salvare password email nel Password Manager | `modifica_azienda.html` | Campi `type="password"` rilevati da Chrome → cambio a `type="text"` + CSS `base-shield` | ✅ Fix |

---

*Report aggiornato il 09/06/2026 — Versione V8.0 Master (sessione 2)*
