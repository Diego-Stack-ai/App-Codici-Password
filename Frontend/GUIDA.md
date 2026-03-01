# 📘 PROTOCOLLO MASTER — COMPLIANT V7.0 (GUIDA TECNICA UNIFICATA)

Questa guida rappresenta l'unico punto di verità per lo sviluppo, il refactoring, la sicurezza e l'audit del progetto **App Codici Password**. Rappresenta l'evoluzione finale che unifica i principi delle versioni precedenti (V5/V6) e introduce lo standard **V7.0 Total Blinding**. È un documento vivente che deve essere consultato prima di ogni modifica al codice.

---

## 1. STATO INIZIALE E BONIFICA LEGACY

### Spiegazione umana:
Il Protocollo V7.0 MASTER impone la **pulizia assoluta** del codice. Ogni pagina deve essere priva di dipendenze legacy, CSS inline o classi utility (es. Tailwind). L'architettura è rigorosamente gerarchica: lo stile deve risiedere esclusivamente nei file CSS autorizzati. Non sono tollerati residui tecnici; la struttura deve essere nitida, leggibile e manutenibile come una macchina di precisione. Ogni deroga a questo standard è considerata un errore critico di integrità.

### Esempio (Cosa eliminare durante la bonifica):
```html
<!-- DA ELIMINARE ASSOLUTAMENTE -->
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/operatore.css?v=3.6">

<!-- Rimuovere classi Tailwind e stili inline -->
<div class="flex p-4 bg-white shadow-lg items-center justify-between" style="background-color:#fff; padding:10px; border-radius: 8px;">
    ...
</div>

<!-- SOSTITUIRE CON STRUTTURA SEMANTICA -->
<div class="item-card-header">
    ...
</div>
```

### Note operative sulla bonifica:
- CSS inline e classi Tailwind (es. `flex`, `px-4`, `bg-blue-500`, `text-center`) **non sono ammessi** nel target V7.0 MASTER.
- Ogni pagina deve caricare solo i file CSS previsti dalla mappatura standard nel `<head>`.
- Se un elemento inline non è rimovibile (es. generato da una libreria esterna come Google Charts o simili), deve essere documentato come "Eccezione Tecnica" nel commento del file.

> 🤖 **Protocollo AI — Comando Categorico: ENFORCE_CLEAN_CODE**
> `enforce_clean([pagina.html])`
> 1. **ELIMINA** ogni riferimento a `operatore.css`, `fonts.css` o versioni query (es. `?v=3.6`).
> 2. **ESTRAI** e migra tutti i CSS inline negli appositi moduli `.css`.
> 3. **RIMUOVI** sistematicamente ogni classe Tailwind (flex, p-4, ecc.) sostituendola con nomi semantici.
> 4. **VALIDA** che la pagina sia "nuda" prima dell'applicazione del nuovo design system.
> 5. **AZZERA** ogni leak di stile nelle sezioni dinamiche (modali e dropdown).

---

## 2. ARCHITETTURA HTML STRATIFICATA (FOUNDATIONS)

### 2.1 Principio Architetturale del Layout
### Spiegazione umana:
La struttura HTML di App Codici Password non è un suggerimento estetico, è un'infrastruttura di stabilità. La stratificazione permette di gestire lo sfondo atomico, la luce ambientale (glow) e il contenuto su piani diversi. Questo evita ricalcoli dinamici del browser (reflow) che causerebbero lag, specialmente su dispositivi mobili meno potenti. Usiamo un contenitore fisso per mantenere la coerenza visiva tra desktop e mobile.

- **body.base-bg**: Gestisce lo sfondo globale (sfumatura atomica e texture).
- **.base-container**: Il "box" strutturale che limita la larghezza massima (60rem) e centra l'interfaccia.
- **.base-glow**: Un elemento `fixed` con z-index basso che proietta l'illuminazione ambientale (il "faro").

### Esempio Struttura Core Page (Standard):
```html
<body class="base-bg">
    <div class="base-container">
        <!-- Effetto luce ambientale -->
        <div class="base-glow"></div>

        <!-- Header dinamico gestito da core.js -->
        <header id="header-placeholder" class="base-header"></header>

        <main class="base-main">
            <!-- page-container contiene i padding di sicurezza per header e footer -->
            <div class="page-container pt-header-extra pb-footer-extra">
                <!-- CONTENUTO APPLICATIVO: Qui vanno le card, le liste, i form -->
            </div>
        </main>

        <!-- Footer dinamico gestito da core.js -->
        <footer id="footer-placeholder" class="base-footer"></footer>
    </div>
</body>
```

### 2.2 Eccezione Ufficiale: Auth Pages (Protocollo .vault)
### Spiegazione umana:
Le pagine di accesso (`index.html`, `registrati.html`, `reset_password.html`) costituiscono un'eccezione formale. Queste pagine non usano Header o Footer applicativi perché l'obiettivo è focalizzare l'utente sul modulo di sicurezza. Utilizzano la classe `.vault` per centrare matematicamente il contenuto nello schermo e forzano il tema Dark (`protocol-forced-dark`) per trasmettere un senso di sicurezza e premiumness fin dal primo contatto.

### Esempio Struttura Auth Page:
```html
<html class="protocol-forced-dark">
<body class="base-bg">
    <div class="base-container">
        <div class="base-glow"></div>
        <div class="vault">
            <!-- La card del modulo di accesso centrata qui -->
            <div class="auth-card-wrapper">
                 ...
            </div>
        </div>
    </div>
</body>
```

### 2.3 Safe Area & Padding (Infrastructure)
### Spiegazione umana:
Essendo un'app progettata per l'uso mobile, dobbiamo rispettare le "Safe Areas" (notch superiore, barra di navigazione inferiore). Per evitare che gli elementi `fixed` (Header e Footer) coprano il contenuto, usiamo dei padding fissi calcolati nel file `core_fascie.css`.
- **.pt-header-extra**: Spazio superiore (100px) per ospitare l'header e la safe area.
- **.pb-footer-extra**: Spazio inferiore (120px) per ospitare il footer e i pulsanti FAB.

> 🤖 **Protocollo AI — Comando Categorico: VALIDATE_STRUCTURE_V7**
> `validate_v7_structure([pagina.html])`
> 1. **IDENTIFICA** la presenza obbligatoria di `body.base-bg`, `div.base-container` e `div.base-glow`.
> 2. **PAGINE CORE**: Imponi la triade `header-placeholder`, `base-main` e `page-container`.
> 3. **PAGINE AUTH**: Imponi la classe `.vault` e la proprietà `protocol-forced-dark` sul tag `<html>`.
> 4. **SAFE AREAS**: Verifica che `core_fascie.css` sia caricato dopo i file di font e core.
> 5. **LAYOUT SYNC**: Ogni modulo deve rispettare i padding `pt-header-extra` e `pb-footer-extra`.

---

## 3. SISTEMA CSS GERARCHICO E MODULARE

### 3.1 Architettura a 4 Livelli di Responsabilità
### Spiegazione umana:
Il CSS è organizzato gerarchicamente. Questo impedisce l'"effetto domino": una modifica stilistica in una pagina non deve mai rompere inavvertitamente lo stile di un'altra sezione dell'app.

1. **`core.css`**: Il nucleo immutabile. Contiene le variabili di sistema (`--primary`, `--bg-dark`, ecc.) e la logica del tema Light/Dark.
2. **`core_fonts.css`**: Centralizza tutto il caricamento dei font (Manrope) e delle icone (Material Symbols).
3. **`core_fascie.css`**: Gestisce esclusivamente le altezze e i posizionamenti di Header, Footer e Safe Area.
4. **`core_ui.css`**: Contiene lo stile dei componenti atomici globali (Toast, Modali di sistema, Loader).
5. **`moduli.css`**: Layout condivisi per i macro-moduli (Liste Account, Form Scadenze, Tabelle Aziende).
6. **`pagina.css`**: (es. `scadenze.css`) Contiene solo e soltanto lo stile unico e non ripetibile della pagina corrente.

### 3.2 Tabella di Mapping Ufficiale (CSS Inclusion)
| Tipologia Pagina | Esempi | CSS Obbligatori (Ordine di caricamento) |
| :--- | :--- | :--- |
| **Auth** | Login, Register | `core` -> `core_fonts` -> `accesso` |
| **Core View** | Home, Area Prive | `core` -> `core_fonts` -> `core_fascie` -> `pagina` -> `core_ui` |
| **Gestionali** | Form Account, Dettagli | `core` -> `core_fonts` -> `core_fascie` -> `moduli` -> `pagina` |

### 3.3 Variabili Sincronizzate JS/CSS
### Spiegazione umana:
Esiste un "contratto" dinamico tra il codice JavaScript e il motore CSS. Alcune variabili vengono modificate al volo per riflettere lo stato dell'app:
- `--accent-rgb`: Cambia colore a seconda del tipo di account (Verde per Banking, Blu per Standard, Rosso per Condiviso).
- `--footer-height`: Viene calcolata da JS per permettere ai Toast di apparire esattamente "sopra" il footer senza coprirlo.

> 🤖 **Protocollo AI — Comando Categorico: LOCK_CSS_SPECIFICITY**
> `lock_css_specificity([pagina.html])`
> 1. **ORDINE**: Verifica il caricamento: Core -> Fonts -> Fascie -> Moduli -> Pagina -> UI.
> 2. **NO OVERRIDE**: Blocca ogni tentativo di ridefinire variabili root (`--primary`, ecc.) fuori dal core.
> 3. **SEMANTICA**: Converti ogni stile basato su ID (`#`) in classi (`.`) per favorire il riutilizzo.
> 4. **IMPORTANT**: Impedisci l'uso di `!important` fuori dal file `core_ui.css`.
> 5. **UNITS**: Sostituisci valori `px` hardcoded con i token variabili previsti dal sistema.

### 3.4 SISTEMA TIPOGRAFICO E ICONOGRAFICO (V3.8+ Focused)
### Spiegazione umana:
La tipografia non è solo "scelta del font", è l'intelaiatura della leggibilità. In App Codici Password, usiamo **Manrope** come font unico per la sua estrema modernità e chiarezza sui display retina. Il sistema è centralizzato in `core_fonts.css` per garantire che ogni testo, dal micro-badge al titolo hero, segua una "Scala Armonica" (Scale Tokens). Questo evita che l'app sembri un collage di stili diversi e permette di cambiare il "carattere" dell'intera piattaforma modificando un solo file.

### 3.4.1 I 4 Pilastri del Design System:
1. **Scala Tipografica (Scale Tokens)**: Variabili da `--fs-micro` (12px) a `--fs-xl` (24px). Non usare mai valori `px` nei file di pagina, usa sempre i tokens.
2. **Grammatura (Font Weights)**: Definito gerarchicamente da `--font-weight-normal` (400) a `--font-strong-weight` (900).
3. **Semantic Tokens (V7.0 Ready)**: Variabili composite come `--font-h1`, `--font-label`, `--font-card-title`. Contengono già peso, dimensione e altezza riga. 
4. **Icon System**: Centralizzato su **Material Symbols Outlined**. Le icone sono trattate come font, garantendo allineamento perfetto con il testo.

### Esempio Applicazione (CSS):
```css
/* ✅ Utilizzo Corretto (Tokens Semantici) */
.mia-card-titolo {
    font: var(--font-card-title);
    color: var(--white);
}

/* ✅ Utilizzo Corretto (Scale Tokens) */
.testo-piccolo {
    font-size: var(--fs-xs);
    font-weight: var(--font-weight-medium);
}

/* ❌ DA EVITARE (Valori Hardcoded) */
.titolo {
    font-family: 'Arial'; /* ERRATO: Non usare font esterni */
    font-size: 14px;      /* ERRATO: Non usare px */
}
```

### Note operative per Sviluppatori:
- **Font-Face & Performance**: I font sono self-hosted in `/assets/fonts/` per evitare dipendenze esterne (Google Fonts) e caricamenti lenti.
- **Immediate Override**: `core_fonts.css` usa `!important` sui selettori globali (`html`, `body`, `input`) per forzare l'identità Manrope ovunque e prevenire flash di font legacy.
- **Material Symbols**: Usare sempre la classe `.material-symbols-outlined`. Se serve un'icona piena, aggiungere la classe `.filled`.

> 🤖 **Comando Agente AI — Audit Typography**
> `audit_typography([file.html/.css])`
> 1. Scansiona il file alla ricerca di font-family diverse da 'Manrope'.
> 2. Identifica valori di `font-size` espressi in `px` o `em` manuali.
> 3. Suggerisce la sostituzione con il token semantico corrispondente (es. `var(--fs-base)`).
> 4. Verifica che le icone usino la classe standard e che non ci siano font-icons rimasugli di vecchie versioni (font-awesome, ecc.).

---

## 4. JS BOOTSTRAP E ORCHESTRAZIONE UNICA

### 4.1 Principio di Orchestrazione (main.js)
### Spiegazione umana:
L'app segue un modello a "Direttore d'Orchestra". `main.js` è l'unico punto di ingresso autorizzato per la logica di pagina. Questo previene bug critici come la duplicazione dei listener di eventi (che causerebbero l'esecuzione tripla di una funzione) o il caricamento di dati incoerenti.

**Regole d'oro:**
- ❌ Nessun modulo deve usare `document.addEventListener('DOMContentLoaded', ...)`.
- ❌ Nessun modulo deve auto-eseguire funzioni all'import.
- ✅ Ogni modulo esporta esclusivamente una funzione `init[NomeModulo](user)`.

### 4.2 Ready Gate Protocol (L'Esperienza Utente Premium)
### Spiegazione umana:
Il "Ready Gate" è il sistema che impedisce all'utente di vedere l'app mentre si sta ancora costruendo. Senza di questo, vedresti pulsanti senza icone, testi non tradotti e layout che saltano.
L'app rimane con `visibility: hidden` finché:
1. Firebase Auth ha confermato l'utente.
2. Il modulo di pagina ha scaricato i dati necessari.
3. Le traduzioni (`translations.js`) sono state applicate al DOM.
Solo allora, l'orchestratore rimuove l'attributo `data-i18n="loading"` e aggiunge la classe `.revealed`, mostrando l'app con un'animazione fluida.

> 🤖 **Protocollo AI — Comando Categorico: ORCHESTRATE_JS_BOOTSTRAP**
> `enforce_js_orchestra([pagina.html])`
> 1. **MODULI**: Riscontra l'uso obbligatorio di `type="module"`.
> 2. **ENTRY POINT**: Verifica il corretto aggancio nel `switch(page)` di `main.js`.
> 3. **FIREBASE GATE**: Imponi che ogni interazione db avvenga solo dopo il passaggio dell'oggetto `user`.
> 4. **READY STATE**: La visibilità deve rimanere `hidden` finché `translations.js` non ha popolato il DOM.
> 5. **NO AUTO-START**: Blocca ogni funzione che si auto-esegue all'importazione del modulo.

---

## 5. SISTEMA DI CONDIVISIONE — HARDENING V7.0 (ATOMIC & AUTO-HEALING DI STATO)

### Spiegazione umana (La Cassaforte Digitale):
Immagina di avere una cassaforte. Fino a ieri, se volevi che un tuo collaboratore accedesse a una combinazione, dovevi prestargli la chiave dell'intera stanza. Oggi, puoi "duplicare" virtualmente solo lo scrigno desiderato e consegnarlo nel suo palmo. Quando lui apre la sua app, lo trova comodamente posato sulla scrivania. Se un domani decidi di revocare l'accesso, l'altra persona si ritroverà con la scatola vuota, senza necessità di interventi manuali complessi.

Dal punto di vista tecnico, la condivisione è l'operazione più delicata: il Protocollo V7.0 impone l'uso di **Transazioni Atomiche** (`runTransaction`). Il database legge i dati, calcola le modifiche e le scrive **tutte insieme**. Se una parte fallisce, l'intero salvataggio viene annullato, evitando "dati orfani" o perdite di integrità.

### 5.1 Esempio Tecnico: Transazione di Risposta (db.js)
Questo è lo standard per ogni modulo che gestisce i permessi:
```javascript
/**
 * Accetta o rifiuta un invito (V7.0 Master - Atomic).
 */
async function respondToInvitation(inviteId, accept, guestUid, guestEmail) {
    const inviteRef = doc(db, "invites", inviteId);
    
    await runTransaction(db, async (t) => {
        // 1. READ: Scarica lo stato attuale dell'invito
        const invSnap = await t.get(inviteRef);
        if (!invSnap.exists()) throw "Invito non trovato";
        
        const invite = invSnap.data();
        if (invite.status !== 'pending') throw "Invito già elaborato";

        const sKey = sanitizeEmail(guestEmail || invite.recipientEmail);

        // 2. PATH RESOLUTION: Privato o Azienda?
        let accPath = invite.aziendaId 
            ? `users/${invite.ownerId}/aziende/${invite.aziendaId}/accounts/${invite.accountId}`
            : `users/${invite.ownerId}/accounts/${invite.accountId}`;
            
        const accRef = doc(db, accPath);
        const accSnap = await t.get(accRef);

        if (accSnap.exists()) {
            let sharedWith = accSnap.data().sharedWith || {};
            const status = accept ? 'accepted' : 'rejected';

            // 3. MAP UPDATE (Sanitized Email Key) - Allineamento V7.0
            if (sharedWith[sKey]) {
                sharedWith[sKey].status = status;
                if (accept) sharedWith[sKey].uid = guestUid;
            }

            // 4. AUTO-HEALING DI STATO: Calcolo visibilità e contatori dinamici
            const newCount = Object.values(sharedWith).filter(g => g.status === 'accepted').length;
            const hasActive = Object.values(sharedWith).some(g => g.status === 'pending' || g.status === 'accepted');

            // 5. WRITE: Scrittura simultanea dell'account e dell'invito
            t.update(accRef, {
                sharedWith: sharedWith,
                acceptedCount: newCount,
                visibility: hasActive ? "shared" : "private",
                updatedAt: new Date().toISOString()
            });
        }

        // Aggiorna lo stato dell'invito
        t.update(inviteRef, { 
            status: accept ? 'accepted' : 'rejected',
            guestUid: accept ? guestUid : null,
            respondedAt: new Date().toISOString()
        });

        // 6. NOTIFY: Notifica per il proprietario
        const notifRef = doc(collection(db, "users", invite.ownerId, "notifications"));
        t.set(notifRef, {
            title: accept ? "Invito Accettato" : "Invito Rifiutato",
            message: `${guestEmail || invite.recipientEmail} ha risposto al tuo invito.`,
            type: "share_response",
            accountId: invite.accountId,
            timestamp: new Date().toISOString(),
            read: false
        });

        // 7. AUTO-HEALING DI STATO (V7.0 Logic Recap)
        // Se l'account torna privato e non era un memo esplicito, 
        // deve essere ritrasformato in 'account'.
    });
}
```

### 5.2 Sanitizzazione Email (Il Contratto della Chiave)
Ogni email utilizzata come chiave nella mappa `sharedWith` **deve** passare per `sanitizeEmail(email)`. 
- **Logica:** `mario.rossi@gmail.com` diventa `mario_rossi_at_gmail_com`. 
- **Perché?** I punti `.` in Firestore indicano percorsi di campi annidati. Sanitizzare previene bug di sovrascrittura accidentale.

### 5.3 Il Motore di Auto-Healing (Logica di Ripristino)
L'Auto-Healing è la sentinella silenziosa che garantisce che un account non rimanga "bloccato" in uno stato ibrido (es. visualizzato come condiviso ma senza ospiti).
- **Trigger**: Viene eseguito ogni volta che `visibility` passa a `"private"`.
- **Condizione**: Se `isExplicitMemo !== true` (ovvero l'account era nato come account standard ma convertito in memo per la condivisione protetta).
- **Azione**: Il campo `type` viene resettato forzatamente a `"account"`.
- **Obiettivo**: Garantire che l'Owner ritrovi sempre i propri campi (Utente/Password) visibili non appena la condivisione cessa.

### 5.4 Note Operative sulla Sicurezza (Sharing Logic)
- **Atomicità Obbligatoria**: Mai aggiornare un account condiviso senza `runTransaction`. Il rischio è che l'accettazione di un invito sovrascriva per errore la revoca di un altro.
- **Sanificazione delle Chiavi**: L'email sanificata (`_at_` al posto di `@`) non è un'opzione, è un vincolo architetturale. L'uso di chiavi non sanificate porterà alla creazione di campi annidati corrotti in Firestore.
- **Integrità Notifiche**: Ogni transazione di condivisione deve generare un record in `/notifications/` per garantire lo storico fiduciario.

> 🤖 **Protocollo AI — Comando Categorico: ENFORCE_ATOMIC_SHARING**
> `enforce_sharing_integrity()`
> 1. **MAPS ONLY**: Imponi l'uso di Object/Map per `sharedWith`. Rifiuta categoricamente gli Array.
> 2. **SANITIZATION**: Valida che `sanitizeEmail()` sia attiva su ogni chiave email.
> 3. **ATOMICITY**: Riscontra l'uso di `runTransaction()` per ogni modifica a inviti o permessi.
> 4. **HEALING**: Verifica che il reset della visibilità forzi correttamente il `type="account"`.
> 5. **AUDIT LOG**: Ogni transazione deve scrivere un evento nella collection `/notifications/`.

### 5.5 Tipologie Account & Memorandum Condivisi
L'architettura gestisce un singolo record (Account) plasmato da 4 "stati dell'essere":

1. **Account Privato**: 
   - Deve avere il campo NOME ACCOUNT popolato.
   - Nessuna spunta di condivisione attivata nell'interfaccia.
   - Rimane sigillato nella lista personale degli account. 
2. **Memorandum**:
   - Spunta "Memorandum" selezionata.
   - **Regola di ferro:** Deve avere NOME ACCOUNT popolato, ma i campi UTENTE, PASSWORD e ACCOUNT/CODICE devono essere categoricamente *vuoti*.
3. **Memorandum Condiviso**: 
   - Dinamica identica a *Memorandum* puro, ma con spunta di condivisione attiva.
   - In UI si apre il modulo della Rubrica. Il contatto selezionato cade a cascata sotto la card come invito pendente.
4. **Account Condiviso (Utente Condiviso)**: 
   - Spunta "Condiviso" selezionata.
   - Deve avere il NOME ACCOUNT e *almeno uno* tra Utente, Account o Password popolati.
   - C'è una logica di **Auto-Rimozione condizionata**: se c'era un solo ospite ed egli rifiuta l'invito, l'account torna "Privato".

### 5.6 Il Motore a Mappe (Struttura Dati)
Abbiamo categoricamente dismesso i vecchi array a favore di una robusta struttura a Map in Firestore:
- **`visibility`**: Campo semantico `"private"` o `"shared"`.
- **`type`**: `"account"` o `"memo"`.
- **`isExplicitMemo`**: Booleano. Distingue un account nato come Memo da uno convertito per la condivisione.
- **`sharedWith`**: L'oggetto della verità. Le chiavi sono l'email sanificata (es: `mario_rossi_at_gmail_com`).

### 5.7 Revoca ed Estromissione Avanzata
Quando un accesso fiduciario si spegne (revoca da parte dell'Owner), la transazione:
1. Spazza via la chiave incriminata dalla mappa `sharedWith`.
2. Azzera ed elimina gli eventuali inviti fantasma in `invites`.
3. Notifica lo storico dell'Owner e l'Ospite dell'operazione compiuta.

---

## 6. RUBRICA CONTATTI E INTEGRAZIONE UI

### Spiegazione umana (La Sicurezza del Suggerimento):
La Rubrica non è un semplice "elenco telefonico", è una barriera di protezione contro il **data leak**. Un semplice errore di battitura (es. `mario.rossi@gmal.com`) potrebbe inviare credenziali sensibili a uno sconosciuto. Il sistema suggerisce i contatti presenti nella collezione `/contacts/` dell'utente, garantendo che la condivisione avvenga solo con entità verificate e fidate. Il suggerimento deve essere visivamente integrato nel campo di input, deve mostrare chiaramente Nome e Email e deve innescare automaticamente la sanificazione della chiave al momento della selezione.

### Codice di Memoria (Logic Flow):
```javascript
// Il "Motore Rubrica" deve seguire questo flusso:
inputEmail.onInput = () => {
   const list = matches(contacts, userInput);
   renderDropdown(list);
};
// Al click: populate() + prepareInviteMetadata();
```

---

## 7. PATTERN ASINCRONI E PERFORMANCE (THE GOLDEN RULES)

### 7.1 Bando Totale del "forEach(async)"
### Spiegazione umana:
Il metodo `.forEach()` di JavaScript è cieco rispetto alle `Promise`. Se lo usi per caricare o salvare dati su Firebase, l'app continuerà l'esecuzione mentre il database sta ancora lavorando, portando a dati mancanti o interfacce che "lampeggiano".

```javascript
/* ❌ ERRORE CRITICO (NON USARE MAI) */
snapshot.docs.forEach(async doc => {
    const data = await getAltro(doc.id); // L'app NON aspetta questa Promise!
});

/* ✅ PROTOCOLLO V7.0 MASTER (OBBLIGATORIO) */
for (const doc of snapshot.docs) {
    const data = await getAltro(doc.id); // L'app aspetta correttamente il completamento
}
// oppure se serve parallelismo controllato:
const results = await Promise.all(snapshot.docs.map(doc => getAltro(doc.id)));
```

---

## 8. SICUREZZA E SENTINEL CHECKS (SENTINELLE)

### 8.1 Sentinel 1: Anti-Double Bootstrap (main.js)
Per evitare che l'app carichi due volte i listener (causando doppie notifiche o click multipli), usiamo una sentinella globale.

```javascript
/* 🔐 BLOCCO SENTINELLA V7.0 **/
if (window.__V7_BOOTSTRAPPED__) {
    console.warn("⚠️ Doppio bootstrap bloccato.");
    return;
}
window.__V7_BOOTSTRAPPED__ = true;
```

### 8.2 Content Security Policy (CSP) — Standard V7.0
Il CSP è il "perimetro di difesa" dell'app. Non usiamo una configurazione permissiva, ma una basata su **Whitelisting** e **Hashes**. Impedisce l'esecuzione di script malevoli (XSS).

**Il Meta Tag Ufficiale (da copiare in ogni pagina):**
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self' https://*.firebaseapp.com https://*.googleapis.com; 
               script-src 'self' https://*.firebaseapp.com https://apis.google.com https://www.googletagmanager.com https://www.gstatic.com https://cdnjs.cloudflare.com 'sha256-vvt4KWwuNr51XfE5m+hzeNEGhiOfZzG97ccfqGsPwvE='; 
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; 
               font-src 'self' https://fonts.gstatic.com; 
               img-src 'self' data: https://*; 
               connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://www.gstatic.com wss://*.firebaseio.com; 
               frame-src 'self' https://*.firebaseapp.com https://www.gstatic.com;">
```

**L'importanza dell'Hash (`sha256-...`):**
- Autorizza specificamente lo script inline di inizializzazione tema (`theme-init.js` logic) senza abilitare `unsafe-inline` per tutti gli script, proteggendo l'integrità dell'app.
- Se modifichi lo script inline in `index.html`, devi ricalcolare l'hash e aggiornare questa guida e tutti i file HTML, altrimenti l'app si bloccherà per violazione di sicurezza.

**💡 Eccezione per lo Sviluppo Locale (Nota Operativa):**
Durante l'uso di **Live Server** o i **Chrome DevTools**, potresti vedere errori in console che bloccano connessioni a `127.0.0.1` o `ws://...` (usati per il refresh automatico o il debugging). 
Per silenziare questi errori "rumorosi" durante lo sviluppo, puoi aggiungere temporaneamente l'eccezione locale alla direttiva `connect-src`:
```text
connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:* https://*.googleapis.com ...
```
⚠️ **ATTENZIONE**: Questa eccezione è strettamente per uso locale. Prima della messa in produzione o del deploy su Firebase, il CSP deve essere riportato allo standard rigoroso senza riferimenti a `127.0.0.1`.

### 8.3 Sicurezza Form & Anti-Autofill (Standard V7.0 Total Blinding)

### Spiegazione umana:
I browser moderni (Chrome, Safari, Edge) e i password manager sono diventati estremamente aggressivi. Tentano di "sniffare" qualsiasi campo che assomigli a una password per salvare o aggiornare credenziali. In un'app di gestione password (come App Codici Password), questo è un disastro di UX e sicurezza. Lo standard **V7.0 Total Blinding** rompe radicalmente ogni euristica di sniffing per rendere la pagina completamente invisibile agli automatismi esterni.

### Le 4 Regole d'Oro del Total Blinding:
1.  **No-Form Context (Rottura Euristica):** Rimuovere completamente il tag `<form>` dalle pagine di dettaglio e modifica. Senza un contenitore form, i browser non riescono a identificare la pagina come un modulo di login o editor di credenziali. La logica di invio dati deve essere gestita tramite ID e listener JS diretti.
2.  **Text-Only Protection (Bypass Scanner):** Mai usare `type="password"` sui campi reali dei dati gestiti. Convertire in `type="text"` e applicare la classe CSS `.base-shield` (che applica `-webkit-text-security: disc`). Il browser vede testo semplice, ma l'utente vede i pallini.
3.  **Annullamento Attributi:** Rimuovere attributi `name` sospetti (come `password`, `account_secret`, `account_label`) dai campi reali. Impostare `autocomplete="off"` in modo sistematico su ogni campo, inclusi quelli dinamici generati via JS.
4.  **La Trappola Rinforzata (Finto Login):** Inserire all'inizio della sezione una trappola invisibile (`left: -9999px`) con nomi di campi e attributi autocomplete *molto appetibili* per i browser (`user_login_trap`, `password_trap`). Il browser "si sfoga" sulla trappola, lasciando puliti i dati reali.

**Esempio di Implementazione Blindata:**
```html
<div class="detail-content-wrap">
    <!-- 🛡️ Trappola Anti-autofill (V7.0 Hardened) -->
    <div class="anti-autofill-trap" aria-hidden="true" style="position: absolute; left: -9999px;">
        <input type="text" name="user_login_trap" autocomplete="username" tabindex="-1">
        <input type="password" name="password_trap" autocomplete="current-password" tabindex="-1">
    </div>

    <!-- Campi reali travestiti da testo comune -->
    <div class="glass-field-container">
        <label class="view-label">Utente</label>
        <div class="detail-field-box border-glow">
            <input id="detail-username" type="text" autocomplete="off" class="detail-field-input no-transform">
        </div>
    </div>

    <div class="glass-field-container">
        <label class="view-label">Password</label>
        <div class="detail-field-box border-glow">
            <input id="detail-password" type="text" autocomplete="off" 
                   class="detail-field-input base-shield field-value-password no-transform">
        </div>
    </div>
</div>
```

> 🤖 **Protocollo AI — Comando Categorico: ENFORCE_TOTAL_BLINDING**
> `enforce_blinding([pagina.html])`
> 1. **FORBID FORM**: Blocca e rimuovi ogni tag `<form>` nelle pagine gestionali.
> 2. **TYPE SHIFT**: Forza l'uso di `type="text"` con classe `.base-shield` per i dati sensibili.
> 3. **TRAP VALIDATION**: Verifica la presenza fisica della `anti-autofill-trap` all'inizio della card.
> 4. **NO NAMES**: Elimina attributi `name` dai campi reali per mandare in errore gli scanner.
> 5. **AUTOCOMPLETE**: Imponi `autocomplete="off"` su ogni input, inclusi quelli dinamici.

---

## 9. VISIONE E2EE (END-TO-END ENCRYPTION) - ROADMAP

### Spiegazione umana:
L'obiettivo finale del progetto è la **conoscenza zero**. Presto implementeremo la cifratura locale tramite `libsodium.js`.
1. **Cifratura sul telefono**: La password viene criptata prima di essere inviata al cloud.
2. **Nessuna chiave sul server**: Se i server di Google venissero bucati, gli hacker troverebbero solo dati indecifrabili.
3. **Recovery Key**: L'utente avrà una chiave fisica di 24 parole (stile portafoglio crypto) per recuperare l'accesso in caso di smarrimento password.

---

## 10. ZONE ROSSE (MODIFICHE PROIBITE SENZA APPROVAZIONE)

| Elemento | Tipo | Perché non toccarlo? |
| :--- | :--- | :--- |
| `theme-init.js` | JS (Head) | È l'unica cosa sincrona. Gestisce il tema prima del rendering per evitare il flash bianco. |
| `.base-container` | CSS (core) | Mantiene la fisica del layout su ogni dispositivo. Modificarlo rompe il centramento globale. |
| `data-i18n="loading"` | Attribute | È il trigger chimico del Ready Gate. Se lo rimuovi, l'app appare "rotta" durante il caricamento. |
| `!important` | CSS | Ammesso solo in `core_ui.css` per garantire che i Toast siano sempre visibili. |

---

## 11. PROTOCOLLO DI AUDIT AGENTE AI (CHECKLIST FINALE)

Ogni richiesta dell'utente deve essere validata contro questo database di regole. Un Agente AI che non rispetta questi punti sta fallendo la sua missione.

> 🤖 **Comando Agente AI — Compliance Check**
> `audit_v7_compliance([file_o_task])`
> 1. **HTML**: Stratificazione presente? (.base-bg, .base-container, .base-glow)
> 2. **CSS**: Mapping corretto? (No utility Tailwind nel codice finale)
> 3. **JS**: Orchestrazione main.js e Guardie Sentinel presenti?
> 4. **Safe Area**: Gestita correttamente tramite `core_fascie.css`?
> 5. **Ready Gate**: La pagina si svela solo a dati/traduzioni caricate?
> 6. **Performance**: Assenza di cicli asincroni non sicuri (`forEach`)?
> 7. **Sharing**: Se toccata, usate transazioni atomiche V7.0?

---

## 12. INFRASTRUTTURA PWA & MOBILE (APP STORE READY)

### Spiegazione umana:
L'app è progettata per essere "installata" sul telefono come una vera applicazione, non solo aperta nel browser. Questo richiede una configurazione ferrea del manifesto e dei meta-tag per garantire che l'utente non veda barre del browser, bordi bianchi o comportamenti "da sito web".

### 12.1 Configurazione Master:
- **`manifest.json`**: Gestisce il nome, i colori di avvio e le icone. La versione deve essere sempre sincronizzata (es. `?v=5.3`).
- **StatusBar Protocol**: Usiamo `black-translucent` per permettere al design di "scorrere" sotto la barra dell'ora, tipico delle app iOS premium.
- **Icone**: Devono essere in formato `.jpg` o `.png` ad alta risoluzione (192x192 e 512x512) per evitare sgranature sui display Retina.
- **Service Worker**: L'app utilizza un sistema di caching intelligente (Vedi [Sezione 19](#19-service-worker--aggiornamento-dinamico-pwa-v70)) per gestire l'offline e gli aggiornamenti automatici.

---

## 13. PROTOCOLLO STORAGE & MEDIA (FILE MANAGEMENT)

### Spiegazione umana:
Caricare file (foto profilo, loghi aziendali, documenti IBAN) richiede ordine. Se carichiamo tutto in un'unica cartella, il database diventa ingestibile. Il Protocollo V7.0 impone una gerarchia "User-Centric".

### 13.1 Gerarchia dei Percorsi:
- **Foto Profilo**: `users/{uid}/profile/avatar.jpg`
- **Loghi Aziende**: `users/{uid}/aziende/{aziendaId}/logo.jpg`
- **Allegati**: `users/{uid}/aziende/{aziendaId}/accounts/{accountId}/documento.pdf`

### 13.2 Regole di Salvataggio:
1. **Rinomina**: Non mantenere mai il nome file originale dell'utente (es. `IMG_2024.jpg`). Rinomina sempre in base al contesto (es. `logo_main.jpg`).
2. **Compressione**: Prima dell'upload, il JS dovrebbe tentare una compressione client-side per risparmiare spazio e banda.
3. **Cleanup**: Quando un account viene eliminato, il sistema deve invocare la funzione di pulizia dello Storage per non lasciare file "orfani".

---

## 14. COMPONENTI UI AVANZATI (CUSTOM STANDARDS)

### 14.1 Custom Select (Il Bando dei Default)
### Spiegazione umana:
I menu a tendina (`<select>`) nativi dei browser sono grigi e piatti. Per mantenere l'estetica scura e premium, usiamo componenti custom basati su `div`.
- **Esempio**: Vedi `archivio_account.html`.
- **Regola**: Se aggiungi un nuovo filtro, usa la struttura `.base-dropdown` con il menu a tendina blu scuro coerente.

### 14.2 Swipe-to-Action (Liste Dinamiche)
### Spiegazione umana:
Sulle liste (specialmente Scadenze), l'utente si aspetta di poter scorrere verso sinistra per cancellare o verso destra per archiviare.
- **Libreria**: `swipe-list-v6.js`.
- **Standard**: Il rosso è sempre per l'eliminazione definitiva, il blu/grigio per l'archiviazione.

---

## 15. PROTOCOLLO QR CODE & LAZY-LOAD

### Spiegazione umana:
Generare un codice QR è un'operazione che "pesa" sulla CPU. Se una pagina avesse 50 QR, l'app si bloccherebbe.
### 15.1 Strategia di Performance:
1. **Preview**: Inizialmente carica solo un'icona o un QR a bassissima risoluzione (placeholder).
2. **Generazione On-Demand**: Il QR reale viene generato tramite `qrcode.js` solo quando l'utente clicca per ingrandire.
3. **Anti-Leak**: Distruggi l'istanza del QR quando il modal viene chiuso per liberare memoria.

---

## 16. ECOSISTEMA NOTIFICHE (CANALE EMAIL & IN-APP V7.0)

### Spiegazione umana:
L'app rimane "viva" tramite socket real-time per gli inviti e attraverso il canale **Email** per gli avvisi proattivi (scadenze). Tutte le interazioni di sicurezza e condivisione generano notifiche che l'utente può consultare direttamente all'interno dell'applicazione (In-App).

### 16.1 Schema Notifica:
Ogni notifica è un documento in `/users/{uid}/notifications/` con:
- `type`: (es. `invite_rejected`, `access_revoked`, `security_alert`).
- `read`: boolean (inizialmente `false`).
- `payload`: oggetto contenente l'ID dell'account o dell'azienda coinvolta.

---



## 17. ARCHITETTURA E LOGICA DELLE SCADENZE (V2.0+)

### Spiegazione umana:
Il tab Scadenze non è una banale "lista della spesa". È un sistema proattivo (agenda automatica) in grado di gestire i rinnovi di domini, assicurazioni, abbonamenti e revisioni auto, calcolando quanto manca e mutando visivamente al variare del tempo residuo.

### 17.1 Struttura Dati (Il Modello Scadenza)
Ogni Scadenza salvata in `/scadenze` possiede questi metadati vitali:
- **`titolo`**: Il nome della scadenza (es. "Rinnovo Dominio Aruba").
- **`dataScadenza`**: Data matematica limite.
- **`categoria`**: Associato a icone/colori precisi per l'UI (es. Vetture, Utenze, Abbonamenti).
- **`stato`**: Variabile che determina il ciclo di vita (es. `in_scadenza`, `scaduta`, `pagata`).
- **`importo`**: Identifica la transazione economica.
- **`nota`**: Testo esteso per dettagli o link di pagamento.

### 17.2 Le 3 Fasi Temporali (Behavior Logic)
Il frontend analizza la `dataScadenza` rispetto alla data odierna (`Date.now()`) e innesca automatismi visivi:

1. **Stato Neutro (Regolare)**:
   - Scadenza molto lontana nel futuro (oltre i 30gg solitamente).
   - Card visualizzata con toni standard, senza icone di urgenza.

2. **In Avvicinamento (Warning / In Scadenza)**:
   - Identificata da una finestra temporale in base alle "Regole" impostate (`impostazioni > regole invio scadenze`).
   - L'UI si "accende" di toni caldi (Arancione/Giallo) e mostra un "countdown" dei giorni mancanti (es. "-12 giorni").
   
3. **Scaduta Oltre Termine (Critical)**:
   - Se `Data.now() > dataScadenza` e l'utente NON dispone del flag "Pagata".
   - L'UI diventa "Rosso Allarme". Mostra un valore temporale in ritardo ("Scaduta da 4 giorni").
   - Questa fase richiede un'azione di chiusura manuale (Click su "Segna come Pagata").

### 17.3 Azioni In-Page (Swipe-To-Action)
Come stabilito dal Protocollo UX, le scadenze non usano bottoni invasivi:
- **Swipe verso Sinistra**: Elimina (Cestino Rosso). L'operazione tritura permanentemente dal db la scadenza.
- **Swipe verso Destra / Tasto Flag**: Marca come `Pagata` / `Risolta`. La scadenza passa in colore Verde (Safe), stoppa matematicamente i timer e i controlli, congelandosi in attesa che l'utente, l'anno successivo, sposti la data in avanti riavviando la giostra.

> 🤖 **Protocollo AI — Comando Categorico: AUDIT_SCADENZE_BEHAVIOR**
> `enforce_scadenze_logic()`
> 1. **ISO DATES**: Imponi date in stringa `YYYY-MM-DD` per parsing deterministico.
> 2. **CONFIRM DELETE**: Impedisci l'eliminazione senza conferma esplicita o wrapper di Undo.
> 3. **QUERY ORDER**: Verifica l'obbligo di `.orderBy('dataScadenza', 'asc')` in ogni fetch.
> 4. **UI SYNC**: Valida che il colore della card muti matematicamente in base al tempo residuo.
> 5. **BADGE LOGIC**: Il conteggio urgente deve essere calcolato localmente per risparmiare letture asincrone.

### 17.4 Il Motore di Sintassi e Notifiche Email (Triple DB Mode)
Il sistema scadenze abbandona il monolite per operare su tre configurazioni atomiche separate e personalizzabili, per fornire opzioni granulari ed intelligenza ai placeholder:
- **Automezzi** (`deadlineConfig`): per gestire Modelli, Targhe e Assicurazioni.
- **Documenti** (`deadlineConfigDocuments`): per gestire Intestatari e Patenti/ID.
- **Generali** (`generalConfig`): per gestire oggetti liberi come Corsi o Affitti.

**Il Parsing Automatico dell'Oggetto (Syntax Builder)**:
Tramite la funzione `buildEmailSubject(objectName, detail)` in `scadenza_templates.js`, il front-end genera a tempo di record l'oggetto email. Se l'utente unisce la tipologia "L'Assicurazione" e la targa "AB123CD", l'app pre-assemblerà matematicamente la stringa:
> *"L'Assicurazione dell'auto targata AB123CD e in scadenza con data DD/MM/YYYY"*
Questa logica riduce l'errore umano ed è pronta per essere pescata dai demoni di background per l'invio delle comunicazioni primarie (`email1`) e secondarie (`email2`).

### 17.5 Algoritmo di Calcolo "Urgenze e Avvisi in Home"
Le allerte per le scadenze non sono hardcoded, ma variano per ciascun record in base alla direttiva `notificationDaysBefore` (i "Giorni di preavviso" salvati).
Nel file `scadenze.js` la funzione globale `loadUrgentDeadlinesCount()` esegue un calcolo assoluto rispetto al giorno odierno privo di orario (`today.setHours(0, 0, 0, 0)`):
- Identifica la variabile temporale: `Inizio_Allarme = dataScadenza - notificationDaysBefore`
- Se la data odierna entra in questa "finestra", scatta la sirena (`urgente = true`) e l'Home Page espone la **Badge Rossa** animata col count cumulativo senza interrogare di nuovo la base dati primaria, risparmiando letture asincrone esose e costose.

---

## 18. BACKEND ENTERPRISE: CLOUD FUNCTIONS E CRONJOBS (V7.0 MASTER)

L'App Codici Password possiede un "demone" serverless resident su Firebase Cloud Functions (`functions/index.js`) che opera indipendentemente. Questo demone ha l'onere e l'onore di svegliarsi ogni giorno spaccando il minuto, scansionare il database globale, calcolare chi deve ricevere una notifica per una scadenza e inviarla in modo sicuro via Email, tenendo traccia della cronologia per evitare spam.

### 18.1 Il Demone Schedulato (Cron Job)
La funzione primaria exportata è `checkDeadlines`, schedulata tramite `onSchedule("0 8 * * *")`.
- **Fuso Orario**: Esegue ogni giorno alle ore 08:00 AM (configurazione standard UTC/Europe).
- **Logica di Trigger**: Effettua una lettura passiva globale (`usersSnap = await db.collection("users").get()`), scorrendo ogni utente ed interpolando i dati con le relative collection `scadenze` attive.

### 18.2 L'Algoritmo di Avviso (Preavviso e Frequenza)
Il backend per far scattare un avviso non guarda solo "se è scaduto", ma esegue una doppia verifica algoritmica incrociata per non importunare l'utente:
1. **Verifica Preavviso (`notificationDaysBefore`)**: "Oggi mancano X giorni alla data. X è minore del limite di preavviso salvato in db?" (Es: Mancano 11 giorni, l'avviso è a 14. Regola superata).
2. **Verifica Frequenza Anti-Spam (`notificationFrequency`)**: Calcola il delta temporale (`now - lastSent`) dalla variabile `lastNotificationSent`. L'allarme viene effettivamente triggrato **solo** se il tempo trascorso dall'ultimo invio è pari o superiore ai giorni impostati nella frequenza (es. ogni 7 giorni).

### 18.3 Strategia di Rilascio V7.0 (Email Priority)
- **✅ CANALE EMAIL**: Il sistema invia le notifiche assicurandosi che il messaggio arrivi a destinazione tramite l'infrastruttura Google OAuth2 (App Password).

### 18.4 Architettura Email OAuth2 e JWT (App Password)
Le mail passano per l'autenticazione tramite Password per le App.
Attualmente configurato con l'account: `boschettodiego@gmail.com`. 
Questo approccio garantisce:
- Recapità garantito (Bypass delle cartelle spam comuni).
- Assenza di limitazioni di invio rispetto agli SMTP gratis commerciali.
- Sicurezza tramite credenziale dedicata.

> 🤖 **Protocollo AI — Comando Categorico: AUDIT_BACKEND_FIREWALL**
> `enforce_backend_integrity()`
> 1. **ENV ISOLATION**: Impedisci l'importazione di moduli frontend in `functions/index.js`.
> 2. **ATOMIC ARRAYS**: Imponi l'uso di `FieldValue.arrayUnion()` per la cronologia notifiche.
> 3. **ASYNC LOOPS**: Blocca ogni `forEach` bloccante; imponi `for...of` o `Promise.all`.
> 4. **ANTI-SPAM**: Valida il controllo `lastNotificationSent` per ogni thread di invio.
> 5. **OAUTH CHECK**: Verifica la corretta configurazione delle credenziali Google App Password.

---

## 19. SERVICE WORKER & AGGIORNAMENTO DINAMICO PWA (V7.0)

### 1️⃣ Spiegazione Umana
Il Service Worker è il cuore tecnologico che trasforma il sito web in una vera **Progressive Web App (PWA)** matura. Il suo scopo principale è risolvere il problema della "cache persistente" (quando il telefono visualizza vecchie versioni dell'app anche dopo un aggiornamento) e garantire che l'applicazione sia veloce e accessibile anche con connessione instabile o assente. 

Grazie al protocollo V6.3, l'utente non deve più preoccuparsi di svuotare manualmente la cache: l'app rileva autonomamente i nuovi rilasci sul server, li scarica in background e avvisa l'utente con un avviso non invasivo (Toast), ricaricandosi solo quando necessario per applicare le modifiche senza interrompere il lavoro.

### 19.1 Il Service Worker (sw.js)
- **Stato**: ✅ v7.0-MASTER.
- **Strategia**: `Stale-While-Revalidate` per asset, `Network-First` per HTML.
- **Versionamento**: Ogni rilascio core incrementa `CACHE_NAME` in `sw.js` per forzare lo svuotamento delle vecchie cache.

### 19.2 Persistenza Dati Offline (Firestore IndexedDB)
Per garantire che l'app sia "Zero-Download" ad ogni apertura, abbiamo attivato la persistenza permanente nel file `firebase-config.js`:
- **Comando**: `enableMultiTabIndexedDbPersistence(db)`.
- **Efficacia**: I dati caricati vengono salvati cifrati sul dispositivo. L'app si apre e mostra i dati istantaneamente anche senza rete.
- **Auto-Sync**: Ogni modifica effettuata offline viene inviata al cloud non appena la connessione viene ripristinata.

### 19.3 Protocollo Agente AI (Audit & Watchdog)
Ogni volta che viene effettuata una modifica agli asset core o al design system, l'agente deve validare lo stato della PWA:

> 🤖 **Protocollo AI — Comando Categorico: AUDIT_PWA_STABILITY**
> `enforce_pwa_watchdog()`
> 1. **ASSETS INTEGRITY**: Verifica che ogni CSS/JS core sia registrato nell'elenco `ASSETS_TO_CACHE`.
> 2. **CACHING HEADERS**: Imponi `no-cache` su `sw.js` e `manifest.json` in `firebase.json`.
> 3. **VERSION SYNC**: Incrementa matematicamente il `CACHE_NAME` ad ogni cambio di asset core.
> 4. **TOAST SIGNAL**: Assicurati che l'orchestratore gestisca l'evento `updatefound` con avviso utente.
> 5. **LOAD EVENT**: Blocca registrazioni SW esterne all'evento `window.load`.
---

## 20. PROTOCOLLO SICUREZZA UNIFICATA V7.0 (HARDENING & UX)

### 1️⃣ Spiegazione Umana
Per garantire un'esperienza "Premium" ed evitare prompt ripetitivi, abbiamo unificato la logica di Sicurezza tra la **Sessione App** e la **Vault Crittografica**. La MasterKey viene "ricordata" in modo sicuro (`sessionStorage`) per tutta la durata della sessione. Il "Blocco Inattività" (Titan-Lock) agisce come un cane da guardia automatico.

### 2️⃣ Architettura dei Controlli (Titan-Lock V8.0)
Per garantire stabilità, il timeout è stato unificato e semplificato rispetto alla V7.0:
1.  **Soglie Selezionabili**: L'utente può scegliere tra 1 min, 3 min (default) o 5 min.
2.  **Hard Logout**: Al termine del timeout scelto, la Vault viene bloccata e viene eseguito il logout forzato.
3.  **Dev Mode**: L'opzione 12 ore è riservata esclusivamente allo sviluppo (`DEV_MODE = true`).

### 3️⃣ Protocollo Agente AI (Security Watchdog)
> 🤖 **Protocollo AI — Comando Categorico: AUDIT_SECURITY_HARDENING**
> `enforce_security_v7()`
> 1. **VAULT CHECK**: Valida l'uso di `sessionStorage` per la permanenza della MasterKey.
> 2. **AES-GCM**: Imponi la crittografia su ogni campo marcato come sensibile.
> 3. **TITAN-LOCK**: Riscontra le soglie V8.0: 1, 3 o 5 min. Blocco immediato di ogni occorrenza "Subito" (0).
> 4. **BIOMETRIC FIRST**: Imponi il tentativo biometrico prima di ogni prompt manuale.
> 5. **SINGLE UNLOCK**: Impedisci ri-richieste di password se la Vault è già indicata come aperta.

---

## 21. PROTOCOLLO V7.0 MASTER: SECURITY PATCH & SELF-HEALING

### Spiegazione umana:
Il Protocollo V7.0 impone la **crittografia AES-256-GCM su ogni singolo dato sensibile**. È stato introdotto il **Cripto-Healing**: un sistema che rileva dati vulnerabili (salvati in chiaro o senza flag `_encrypted`) e ne forza la migrazione sicura tramite `migration_security.html`.

### Esempio Operativo (AES-256-GCM Standard):
```javascript
// 🔐 SALVATAGGIO BLINDATO
const payload = {
    password: await encrypt(userInput, masterKey),
    pin: await encrypt(pinInput, masterKey),
    status: "active", // Campo non sensibile
    _encrypted: true // Flag obbligatorio
};

// 🔓 CARICAMENTO DINAMICO
const val = data._encrypted ? await decrypt(data.password, masterKey) : data.password;
```

### Note operative per la Sicurezza:
- **Zero Plaintext**: Nessun valore sensibile in chiaro nella Firebase Console.
- **Cripto-Healing**: Bonifica automatica record legacy; interfaccia di controllo nascosta in produzione tramite `SAFE_MODE = false`.
- **Crypto Silence**: Divieto assoluto di logging di chiavi, salt o IV (Vedi Sezione 22).
- **Titan-Lock Reference**: Fare riferimento alla Sezione 22 per le nuove soglie V8.0.

### 21.1 Cassaforte Intelligente e Cifratura Selettiva (V7.5)
Il protocollo V7.5 evolve il "Total Blinding" verso una **Cifratura Selettiva** per bilanciare sicurezza estrema e usabilità (ricerca, performance).

**Dati Sempre Cifrati (Blindati):**
- Password, PIN, PUK, Codici App.
- Numeri seriali di documenti (Patente, Passaporto, ID).
- Dati finanziari (Numeri Carte, CCV, Password Dispositive).
- Note Account e Note Documenti.
- Username e Codici di accesso ai servizi.

**Dati in Chiaro (Leggibili per Usabilità):**
- Nomi e Cognomi (Profilo e Intestatari).
- Indirizzi fisici e Numeri di Telefono.
- Ragioni Sociali e Dati Fiscali (P.IVA, SDI).
- Titoli dei Servizi (es. "Netflix", "Amazon").
- Email (solo l'indirizzo, non la password).

**Regola d'Oro:** Se il dato è una credenziale o un segreto numerico, va blindato. Se è un dato anagrafico o un'etichetta di ricerca, resta in chiaro.cezione che blocca la UI.

### Regola per lo Sviluppo:
Non chiamare mai `atob()` direttamente nel codice dei moduli. Usa sempre la funzione `decrypt()` di `crypto-utils.js`, che implementa già queste protezioni.

---

## 22. PROTOCOLLO VAULT & SESSION HARDENING (V8.0 PRODOTTO BLINDATO)

### Spiegazione umana:
La sicurezza della cassaforte (Vault) della V8.0 si basa sulla **certezza della sessione**. Abbiamo rimosso l'opzione "Subito" perché creava instabilità e loop di sblocco inutili; ora la sessione è granitica con tempi minimi di 1 minuto. Il sistema distingue ora nettamente tra **Ambiente di Sviluppo** (`DEV_MODE`), dove possiamo testare sessioni lunghe (12 ore), e **Produzione**, dove l'app è "Blindata". La `SAFE_MODE` funge da paracadute invisibile: i meccanismi di auto-cura ci sono, ma non sporcano l'interfaccia dell'utente finché non servono davvero.

### Esempio tecnico (Configurazione & Fallback):
```javascript
// [V8.0] Logica nel caricamento del timer (inactivity-timer.js)
let minutes = data.lock_timeout ?? 3;

// Fallback obbligatorio: se un vecchio profilo ha il valore "0" (Subito),
// il sistema lo converte forzatamente in 1 minuto.
if (minutes === 0) minutes = 1; 

// [V8.0] Stati di visibilità (home.js / impostazioni.js)
const DEV_MODE = false;  // In produzione: nasconde l'opzione 12h
const SAFE_MODE = false; // In produzione: nasconde reset vault e banner auto-cura
```

> 🤖 **Protocollo AI — Comando Categorico: AUDIT_VAULT_PROD_V8**
> `audit_vault_v8([file_o_moduli])`
> 1.  **NO_SUBITO_CHECK**: Elimina ogni occorrenza residua di "Subito" o valore `0` nei selettori e nelle traduzioni.
> 2.  **TIMEOUT_VALIDATION**: Verifica che la lista timeout sia limitata a [1, 3, 5] min (o 12h solo se `DEV_MODE=true`).
> 3.  **MODE_ISOLATION**: Riscontra che i flag `DEV_MODE` e `SAFE_MODE` siano rigorosamente `false` per i file pronti al deploy.
> 4.  **CRYPTO_SILENCE**: Valida l'assenza totale di log con dati sensibili (Salt, IV, Chiavi HEX) in favore di soli codici errore asettici.
> 5.  **FALLBACK_ENFORCEMENT**: Verifica la presenza della logica `if (minutes === 0) minutes = 1` nello script di sincronizzazione.

---

## 23. PROTOCOLLO DI TEST & AUDIT BACKEND (V8.0)

### Spiegazione umana:
Per garantire che il database sia sempre coerente e che la crittografia sia applicata correttamente a ogni nuova scrittura, utilizziamo uno script di audit atomico. Questo test crea record dummy (falsi) sia in ambito Privato che Ditta, verifica che il flag `_encrypted: true` sia presente e che i dati sensibili non siano leggibili in chiaro su Firebase Console prima di ritornare il risultato.

### Esempio Tecnico (Script di Audit):
```javascript
/**
 * Comando Agente AI — Creazione e Audit Account (V8.0 BLINDATO)
 * Protocollo — Vault Blindato & Firebase Integrity Check
 */
async function audit_create_and_verify_accounts_v8() {
    const masterKey = await ensureMasterKey(); // Assicura che la chiave sia presente

    // 1️⃣ Creazione Account Privato (Cifrato)
    const privateAccount = {
        type: "account",
        visibility: "private",
        isExplicitMemo: false,
        nomeAccount: "Test Privato", // In chiaro per ricerca
        utente: await encrypt("utente_privato", masterKey), // BLINDATO
        password: await encrypt("PasswordTest123!", masterKey), // BLINDATO
        codice: await encrypt("CODICE123", masterKey), // BLINDATO
        note: await encrypt("Memo di test privato", masterKey), // BLINDATO
        sharedWith: {},
        _encrypted: true // Flag V8.0
    };

    const privateRef = doc(db, `users/${currentUser.uid}/accounts/${generateId()}`);
    await runTransaction(db, async (t) => t.set(privateRef, privateAccount));

    // 2️⃣ Creazione Account Ditta (Cifrato)
    const companyAccount = {
        type: "account",
        visibility: "private",
        isExplicitMemo: false,
        nomeAccount: "Test Ditta",
        utente: await encrypt("utente_ditta", masterKey),
        password: await encrypt("DittaPass456!", masterKey),
        codice: await encrypt("DITTA789", masterKey),
        note: await encrypt("Memo aziendale completo", masterKey),
        aziendaId: "azienda_test",
        sharedWith: {},
        _encrypted: true
    };

    const companyRef = doc(db, `users/${currentUser.uid}/aziende/azienda_test/accounts/${generateId()}`);
    await runTransaction(db, async (t) => t.set(companyRef, companyAccount));

    // 3️⃣ Audit su Firebase (Verifica strutturale)
    const snapPrivate = await getDoc(privateRef);
    const snapCompany = await getDoc(companyRef);

    const auditResults = {
        privateAccountComplete: snapPrivate.exists() && snapPrivate.data()._encrypted === true,
        companyAccountComplete: snapCompany.exists() && snapCompany.data()._encrypted === true,
        cryptoBlindness: snapPrivate.data().password !== "PasswordTest123!", // Verifica cifratura
        allFieldsPresent: false
    };

    const requiredFields = ["nomeAccount","utente","password","codice","note","visibility","type","_encrypted"];
    const checkFields = (docData) => requiredFields.every(f => docData.hasOwnProperty(f));

    auditResults.allFieldsPresent = checkFields(snapPrivate.data()) && checkFields(snapCompany.data());

    return auditResults; // Restituisce il risultato nel silenzio (Zero Log)
}
```

> 🤖 **Protocollo AI — Comando Categorico: AUDIT_BACKEND_INTEGRITY**
> `audit_create_and_verify_accounts_v8()`
> 1. **ATOMIC_WRITE**: Usa solo `runTransaction` per le scritture di test.
> 2. **CRYPTO_CHECK**: Fallire il test se `_encrypted` è falso o se i dati sensibili nel DB sono in chiaro.
> 3. **ZERO_LOG**: Non stampare mai i risultati in console; restituire solo l'oggetto `auditResults`.

---

---

## 24. GO-LIVE & CHECKLIST OPERATIVA V7.0

### 1️⃣ Procedura di Rilascio Pro
Il Go-Live standardizza l'inserimento dei dati reali garantendo la massima sicurezza end-to-end.

**Checklist Obbligatoria:**
1. **Security Audit**: Esecuzione `audit_security_flow()` per validare Titan-Lock e MasterKey.
2. **Observer Dinamico**: Verifica intercettazione MutationObserver per nuovi campi nel DOM.
3. **Cripto-Healing**: Esecuzione `migration_security.html` per allineare il seed iniziale.
4. **PDF Backup**: Generazione documento cifrato con MasterKey e codici 2FA per l'utente.

### 2️⃣ Comandi Operativi AI
> 🤖 **Protocollo AI — Comando Categorico: EXECUTE_GOLIVE_V7**
> `execute_golive_master()`
> 1. **PRE-FLIGHT**: Esegui `enforce_security_v7()` su tutti i moduli critici.
> 2. **DATA SYMBOL**: Verifica l'attivazione dell'Observer Dinamico su tutto il DOM.
> 3. **SEED SYNC**: Esegui la bonifica massiva tramite `migration_security.html`.
> 4. **USER RECOVERY**: Imponi la generazione del PDF di Backup cifrato prima della chiusura.
> 5. **END-TO-END**: Valida il flusso con dataset dummy prima dell'immissione dati reale.