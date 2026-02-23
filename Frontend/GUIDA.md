# 📘 PROTOCOLLO V5.1 MASTER — GUIDA TECNICA TOTALE (UNIFICATA)

Questa guida rappresenta l'unico punto di verità per lo sviluppo, il refactoring, la sicurezza e l'audit del progetto **App Codici Password**. Integra i principi del Protocollo V5.0 con le ottimizzazioni e le guardie di sicurezza della V5.1. È un documento vivente che deve essere consultato prima di ogni modifica al codice.

---

## 1. STATO INIZIALE E BONIFICA LEGACY

### Spiegazione umana:
Prima del refactoring V5.0, le pagine dell’app dipendevano da file monolitici come `operatore.css` e da utility Tailwind sparpagliate. Gli stili erano frammentati, con eccessivo uso di CSS inline, creando un debito tecnico che rendeva l'app fragile e difficile da manutenere. L'obiettivo della bonifica è la **pulizia totale**: ogni riga di stile deve avere una sua collocazione gerarchica nel sistema CSS dedicato. Non vogliamo residui di versioni passate che potrebbero causare conflitti visivi imprevisti.

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
- CSS inline e classi Tailwind (es. `flex`, `px-4`, `bg-blue-500`, `text-center`) **non sono ammessi** nel target V5.1.
- Ogni pagina deve caricare solo i file CSS previsti dalla mappatura standard nel `<head>`.
- Se un elemento inline non è rimovibile (es. generato da una libreria esterna come Google Charts o simili), deve essere documentato come "Eccezione Tecnica" nel commento del file.

> 🤖 **Comando Agente AI — Task Operativi Iniziali**
> `audit_legacy([pagina.html])`
> 1. Analizza il file e identifica ogni riferimento a `operatore.css`, `fonts.css` o versioni query (es. `?v=3.6`).
> 2. Estrai tutti i CSS inline presenti negli attributi `style`.
> 3. Identifica tutte le classi utility Tailwind (pattern regex per classi comuni).
> 4. Migra lo stile logico in un file `[pagina].css` dedicato o usa le classi di `moduli.css`.
> 5. Verifica che non rimangano "leak" di vecchi stili nelle sezioni nascoste (es. modali non ancora aperti).

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

> 🤖 **Comando Agente AI — Audit Struttura HTML**
> `audit_html([pagina.html])`
> - Scansiona il DOM per la presenza di `body.base-bg`, `div.base-container` e `div.base-glow`.
> - Se pagina NON Auth: Verifica che esistano `header-placeholder`, `<main class="base-main">` e un `div` con classe `page-container`.
> - Se pagina Auth: Verifica che esista la classe `.vault` e che il tag `<html>` abbia `protocol-forced-dark`.
> - Segnala l'assenza di `core_fascie.css` se sono presenti classi di posizionamento header/footer.

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
| **Gestionali** | Form Account, Dettagli | `core` -> `core_fonts` -> `moduli` -> `pagina` |

### 3.3 Variabili Sincronizzate JS/CSS
### Spiegazione umana:
Esiste un "contratto" dinamico tra il codice JavaScript e il motore CSS. Alcune variabili vengono modificate al volo per riflettere lo stato dell'app:
- `--accent-rgb`: Cambia colore a seconda del tipo di account (Verde per Banking, Blu per Standard, Rosso per Condiviso).
- `--footer-height`: Viene calcolata da JS per permettere ai Toast di apparire esattamente "sopra" il footer senza coprirlo.

> 🤖 **Comando Agente AI — Audit CSS**
> `audit_css([pagina.html])`
> - Controlla l'ordine dei `<link>` nel head.
> - Verifica che non ci siano tentativi di ridefinire variabili root (es. `--primary`) all'interno di file CSS di pagina.
> - Cerca selezioni ad IDs (`#element`) e suggerisci la conversione in classi (`.element`) se lo stile è riutilizzabile.
> - Segnala l'uso di `!important` al di fuori di `core_ui.css`.

### 3.4 SISTEMA TIPOGRAFICO E ICONOGRAFICO (V3.8+ Focused)
### Spiegazione umana:
La tipografia non è solo "scelta del font", è l'intelaiatura della leggibilità. In App Codici Password, usiamo **Manrope** come font unico per la sua estrema modernità e chiarezza sui display retina. Il sistema è centralizzato in `core_fonts.css` per garantire che ogni testo, dal micro-badge al titolo hero, segua una "Scala Armonica" (Scale Tokens). Questo evita che l'app sembri un collage di stili diversi e permette di cambiare il "carattere" dell'intera piattaforma modificando un solo file.

### 3.4.1 I 4 Pilastri del Design System:
1. **Scala Tipografica (Scale Tokens)**: Variabili da `--fs-micro` (12px) a `--fs-xl` (24px). Non usare mai valori `px` nei file di pagina, usa sempre i tokens.
2. **Grammatura (Font Weights)**: Definito gerarchicamente da `--font-weight-normal` (400) a `--font-strong-weight` (900).
3. **Semantic Tokens (V5.0 Ready)**: Variabili composite come `--font-h1`, `--font-label`, `--font-card-title`. Contengono già peso, dimensione e altezza riga. 
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

> 🤖 **Comando Agente AI — Audit JS & Bootstrap**
> `audit_js([pagina.html])`
> - Controlla che il file JS della pagina sia caricato come `type="module"`.
> - Verifica che `main.js` contenga il `switch(page)` corretto per la pagina corrente.
> - Assicurati che ogni chiamata a Firebase passi attraverso l'oggetto `user` fornito dall'orchestratore.

---

## 5. SISTEMA DI CONDIVISIONE — HARDENING V3.1 (ATOMIC & AUTO-HEALING)

### Spiegazione umana:
La condivisione è l'operazione più delicata: stiamo dando permessi di lettura/scrittura su password a un altro utente. Il Protocollo V3.1 impone l'uso di **Transazioni Atomiche** (`runTransaction`): il database legge i dati, calcola le modifiche e le scrive **tutte insieme**. Se una parte fallisce (es. cade il Wi-Fi a metà), l'intero salvataggio viene annullato, evitando "dati orfani" (inviti accettati ma permessi non dati).

### 5.1 Esempio Tecnico: Transazione di Risposta (db.js)
Questo è lo standard per ogni modulo che gestisce i permessi:
```javascript
/**
 * Accetta o rifiuta un invito (V5.1 Master - Atomic).
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

            // 3. MAP UPDATE (Sanitized Email Key) - Allineamento V5.1
            if (sharedWith[sKey]) {
                sharedWith[sKey].status = status;
                if (accept) sharedWith[sKey].uid = guestUid;
            }

            // 4. AUTO-HEALING: Calcolo visibilità e contatori dinamici
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
    });
}
```

### 5.2 Sanitizzazione Email (Il Contratto della Chiave)
Ogni email utilizzata come chiave nella mappa `sharedWith` **deve** passare per `sanitizeEmail(email)`. 
- **Logica:** `mario.rossi@gmail.com` diventa `mario_rossi_at_gmail_com`. 
- **Perché?** I punti `.` in Firestore indicano percorsi di campi annidati. Sanitizzare previene bug di sovrascrittura accidentale.

---

## 6. RUBRICA CONTATTI E INTEGRAZIONE UI

### Spiegazione umana:
La Rubrica non è solo una lista di nomi, è la **protezione contro gli errori di digitazione**. Inviare una password all'email sbagliata (`gmal.com` invece di `gmail.com`) è un rischio di sicurezza enorme. Quando l'utente inizia a scrivere un'email nel form di condivisione, il sistema deve suggerire i contatti esistenti dalla collezione `/contacts/`.

### Note Tecniche per l'AI:
- I contatti sono memorizzati per ogni utente.
- Il suggerimento deve essere istantaneo e mostrare Nome + Email.
- Al click sul suggerimento, il sistema deve popolare non solo l'email, ma anche preparare i metadati per l'invito atomico.

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

/* ✅ PROTOCOLLO V5.1 MASTER (OBBLIGATORIO) */
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
/* 🔐 BLOCCO SENTINELLA V5.1 **/
if (window.__V5_BOOTSTRAPPED__) {
    console.warn("⚠️ Doppio bootstrap bloccato.");
    return;
}
window.__V5_BOOTSTRAPPED__ = true;
```

### 8.2 Content Security Policy (CSP) — Standard V5.1
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

> 🤖 **Comando Agente AI — Audit Total Blinding**
> `audit_total_blinding([pagina.html])`
> - Scansione a tappeto: il tag `<form>` deve essere ASSENTE nelle pagine di dettaglio e modifica account.
> - Verifica campi sensibili: devono essere `type="text"` con classe `.base-shield`.
> - Check Trappola: deve contenere input con `name="user_login_trap"` e `name="password_trap"`.

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
> `audit_v5_compliance([file_o_task])`
> 1. **HTML**: Stratificazione presente? (.base-bg, .base-container, .base-glow)
> 2. **CSS**: Mapping corretto? (No utility Tailwind nel codice finale)
> 3. **JS**: Orchestrazione main.js e Guardie Sentinel presenti?
> 4. **Safe Area**: Gestita correttamente tramite `core_fascie.css`?
> 5. **Ready Gate**: La pagina si svela solo a dati/traduzioni caricate?
> 6. **Performance**: Assenza di cicli asincroni non sicuri (`forEach`)?
> 7. **Sharing**: Se toccata, usate transazioni atomiche V3.1?

---

## 12. INFRASTRUTTURA PWA & MOBILE (APP STORE READY)

### Spiegazione umana:
L'app è progettata per essere "installata" sul telefono come una vera applicazione, non solo aperta nel browser. Questo richiede una configurazione ferrea del manifesto e dei meta-tag per garantire che l'utente non veda barre del browser, bordi bianchi o comportamenti "da sito web".

### 12.1 Configurazione Master:
- **`manifest.json`**: Gestisce il nome, i colori di avvio e le icone. La versione deve essere sempre sincronizzata (es. `?v=5.3`).
- **StatusBar Protocol**: Usiamo `black-translucent` per permettere al design di "scorrere" sotto la barra dell'ora, tipico delle app iOS premium.
- **Icone**: Devono essere in formato `.jpg` o `.png` ad alta risoluzione (192x192 e 512x512) per evitare sgranature sui display Retina.

---

## 13. PROTOCOLLO STORAGE & MEDIA (FILE MANAGEMENT)

### Spiegazione umana:
Caricare file (foto profilo, loghi aziendali, documenti IBAN) richiede ordine. Se carichiamo tutto in un'unica cartella, il database diventa ingestibile. Il Protocollo V5.1 impone una gerarchia "User-Centric".

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

## 16. ECOSISTEMA NOTIFICHE REAL-TIME

### Spiegazione umana:
L'app è "viva". Se qualcuno rifiuta un tuo invito, devi saperlo subito senza ricaricare la pagina.
### 16.1 Schema Notifica:
Ogni notifica è un documento in `/users/{uid}/notifications/` con:
- `type`: (es. `invite_rejected`, `access_revoked`, `security_alert`).
- `read`: boolean (inizialmente `false`).
- `payload`: oggetto contenente l'ID dell'account o dell'azienda coinvolta.

---

---

## 17. ARCHITETTURA ACCOUNT & MEMORANDUM CONDIVISI (V5.1+ Hardened)

### Spiegazione umana (Presentazione Pubblica):
"Immagina di avere una cassaforte. Fino a ieri, se volevi che un tuo collaboratore accedesse a una combinazione, dovevi prestargli la chiave dell'intera stanza. Oggi, con il sistema Condivisi & Memorandum, puoi 'duplicare' virtualmente solo lo scrigno desiderato e consegnarlo nel suo palmo. Quando lui apre la sua app, lo trova comodamente posato sulla scrivania, pronto per essere consultato. E la cosa più bella? Se un domani decidi di cambiare la serratura o ritirare l'accesso, l'altra persona si ritroverà con la scatola vuota sotto gli occhi, senza che tu debba fare chiamate imbarazzanti o avvisi. 
Inoltre, per tutelare i segreti, c'è il *Memorandum Condiviso*: una modalità furbissima in cui dai a Tizio lo scrigno, ma svuoti prima i campi Password, Codice e Username, lasciandogli leggere solo le note, gli allegati o i referenti della banca. Comunichi quindi *come* fare una cosa senza fornire la chiave. Tutto questo avviene dietro le quinte in frazioni di secondo: l'invito, l'accettazione e persino lo storico delle notifiche in tempo reale che vi avvisano ad ogni singolo movimento fiduciario."

### 17.1 Struttura Dati (Il Motore a Mappe)
Abbiamo categoricamente dismesso i vecchi array che generavano crash e duplicati a favore di una robusta struttura a Map per i documenti in Firestore:
- **`visibility`**: Campo semantico `"private"` o `"shared"`.
- **`type`**: `"account"` o `"memo"`.
- **`isExplicitMemo`**: Booleano. Permette di distinguere un account nato esplicitamente come Memorandum da un Account Normale convertito temporaneamente in Memo per la condivisione protetta.
- **`sharedWith`**: L'oggetto della verità. Le chiavi sono l'email sanificata (es: `mario_rossi_at_gmail_com`) e il valore contiene lo stato: `{ email: "...", status: "pending|accepted", uid: "..." }`.

### 17.2 Le 4 Tipologie Core di Account (Regole Logiche UI)
L'architettura gestisce un singolo record (Account) plasmato da 4 "stati dell'essere":

1. **Account Privato**: 
   - Deve avere il campo NOME ACCOUNT popolato.
   - Nessuna spunta di condivisione attivata nell'interfaccia.
   - Rimane sigillato nella lista personale degli account. 
   - L'utente è libero in qualsiasi momento di editarlo e convertirlo in una delle altre tre opzioni.

2. **Memorandum**:
   - Spunta "Memorandum" selezionata.
   - **Regola di ferro:** Deve avere NOME ACCOUNT popolato, ma i campi UTENTE, PASSWORD e ACCOUNT/CODICE devono essere categoricamente *vuoti*.
   - Il sistema interdice il salvataggio o fa un wipe preventivo se ci sono dati anagrafici, in quanto è progettato solo per salvare Note, IBAN e Allegati.

3. **Memorandum Condiviso**: 
   - Dinamica identica a *Memorandum* puro, ma con spunta di condivisione attiva.
   - In UI si apre il modulo della Rubrica. Il contatto selezionato cade a cascata sotto la card come invito pendente.
   - Al salvataggio parte la notifica di sistema al ricevente. Lato Owner, nel Dettaglio Account appare la dicitura *"In attesa di accettazione"*.

4. **Account Condiviso (Utente Condiviso)**: 
   - Spunta "Condiviso" selezionata.
   - Deve avere il NOME ACCOUNT e *almeno uno* tra Utente, Account o Password popolati.
   - Segue l'identico flusso contatti del Memorandum Condiviso.
   - C'è una logica di **Auto-Rimozione condizionata**: se c'era un solo ospite ed egli rifiuta l'invito, scompare *"In attesa di accettazione"* e l'account stesso deve sflagarsi in automatico dalle condivisioni (tramite l'Auto-Healing) e sparire da quelle liste tornando "Privato". Se ci sono altri ospiti accettati, la dicitura per chi ha rifiutato sparisce ma l'account resta globalmente "Condiviso".

### 17.3 Il Flusso Atomico & Auto-Healing
Ogni operazione di condivisione o revoca avviene tramite `runTransaction` (Transazioni Atomiche db) per garantire l'integrità assoluta dei conflitti di rete.
- **Fase Invio**: L'owner salva il form. Viene creato un documento nella collection globale `invites` (ID: `{accountId}_{emailSanificata}`) e aggiornata la mappa `sharedWith` dell'account sorgente. Simultaneamente parte una notifica all'ospite.
- **Fase Risposta**: Il modulo `main.js` dell'ospite è costantemente in ascolto del nodo `invites`. Al click di "Accetta", la transazione va a bussare criptograficamente nel database dell'owner, inietta l'`UID` dell'ospite nella mappa e setta lo stato su `"accepted"`.
- **Auto-Healing (Il Riparo Medico)**: Se un account "shared" rimane improvvisamente senza alcun ospite attivo (es. tutti rifiutano o vengono rimossi dall'owner), il sistema lo riporta in `visibility="private"`. In questo istante controlla il flag `isExplicitMemo`. Se è `false`, **ri-trasforma automaticamente l'account da Memo ad Account puro**, ripristinando l'integrità e la visualizzazione originaria per l'Owner senza necessità di click manuali.

### 17.4 Revoca ed Estromissione Avanzata:
Quando un accesso fiduciario si spezza (revoca da parte dell'Owner), la transazione:
1. Spazza via la chiave incriminata dalla mappa `sharedWith`.
2. Azzera ed elimina gli eventuali inviti fantasma in `invites`.
3. Notifica lo storico dell'Owner dell'operazione compiuta.
4. **V5.4+**: Notifica con procedura diretta l'Ospite che "l'accesso per l'Account X gli è stato appena revocato", mantenendo totale trasparenza delle history di sistema.

> 🤖 **Comando Agente AI: audit_sharing_architecture()**
> \`\`\`
> 1. In ogni refactor documentale controlla che `sharedWith` sia sempre iniettata/letta come Object e mai come Array.
> 2. Verifica che l'array UI di email `invitedEmails` sfrutti la funzione `sanitizeEmail(email)` prima di operare sulle chiavi di Firestore.
> 3. Assicurati che ogni modifica/creazione d'invito sia incapsulata obbligatoriamente in `runTransaction()`, pena possibile perdita di sincronia.
> 4. Audita fermamente l'Auto-Healing: il `newType` deve per forza fare fallback su `'account'` solo se `isExplicitMemo !== true` nell'istante in cui diventa `"private"`.
> \`\`\`

---

## 18. ARCHITETTURA E LOGICA DELLE SCADENZE (V2.0+)

### Spiegazione umana:
Il tab Scadenze non è una banale "lista della spesa". È un sistema proattivo (agenda automatica) in grado di gestire i rinnovi di domini, assicurazioni, abbonamenti e revisioni auto, calcolando quanto manca e mutando visivamente al variare del tempo residuo.

### 18.1 Struttura Dati (Il Modello Scadenza)
Ogni Scadenza salvata in `/scadenze` possiede questi metadati vitali:
- **`titolo`**: Il nome della scadenza (es. "Rinnovo Dominio Aruba").
- **`dataScadenza`**: Data matematica limite.
- **`categoria`**: Associato a icone/colori precisi per l'UI (es. Vetture, Utenze, Abbonamenti).
- **`stato`**: Variabile che determina il ciclo di vita (es. `in_scadenza`, `scaduta`, `pagata`).
- **`importo`**: Identifica la transazione economica.
- **`nota`**: Testo esteso per dettagli o link di pagamento.

### 18.2 Le 3 Fasi Temporali (Behavior Logic)
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

### 18.3 Azioni In-Page (Swipe-To-Action)
Come stabilito dal Protocollo UX, le scadenze non usano bottoni invasivi:
- **Swipe verso Sinistra**: Elimina (Cestino Rosso). L'operazione tritura permanentemente dal db la scadenza.
- **Swipe verso Destra / Tasto Flag**: Marca come `Pagata` / `Risolta`. La scadenza passa in colore Verde (Safe), stoppa matematicamente i timer e i controlli, congelandosi in attesa che l'utente, l'anno successivo, sposti la data in avanti riavviando la giostra.

> 🤖 **Comando Agente AI: audit_scadenze_logic()**
> \`\`\`
> 1. Controlla che le date (`dataScadenza`) scritte nel Database siano formattate sempre in ISO compatibile o in stringhe `YYYY-MM-DD` per consentirgli parsing nativi senza errori da `Date()`.
> 2. Assicurati che se un utente marca una scadenza come "Eliminata", l'azione venga avvolta in un popup di conferma o sfrutti l'Undo (se archiviata).
> 3. Nelle query Firebase verifica sempre di estrapolare `.orderBy('dataScadenza', 'asc')` in modo che le più urgenti appaiano sempre e matematicamente in cima alla lista frontend.
> \`\`\`

### 18.4 Il Motore di Sintassi e Notifiche Email (Triple DB Mode)
Il sistema scadenze abbandona il monolite per operare su tre configurazioni atomiche separate e personalizzabili, per fornire opzioni granulari ed intelligenza ai placeholder:
- **Automezzi** (`deadlineConfig`): per gestire Modelli, Targhe e Assicurazioni.
- **Documenti** (`deadlineConfigDocuments`): per gestire Intestatari e Patenti/ID.
- **Generali** (`generalConfig`): per gestire oggetti liberi come Corsi o Affitti.

**Il Parsing Automatico dell'Oggetto (Syntax Builder)**:
Tramite la funzione `buildEmailSubject(objectName, detail)` in `scadenza_templates.js`, il front-end genera a tempo di record l'oggetto email. Se l'utente unisce la tipologia "L'Assicurazione" e la targa "AB123CD", l'app pre-assemblerà matematicamente la stringa:
> *"L'Assicurazione dell'auto targata AB123CD e in scadenza con data DD/MM/YYYY"*
Questa logica riduce l'errore umano ed è pronta per essere pescata dai demoni di background per l'invio delle comunicazioni primarie (`email1`) e secondarie (`email2`).

### 18.5 Algoritmo di Calcolo "Urgenze e Avvisi in Home"
Le allerte per le scadenze non sono hardcoded, ma variano per ciascun record in base alla direttiva `notificationDaysBefore` (i "Giorni di preavviso" salvati).
Nel file `scadenze.js` la funzione globale `loadUrgentDeadlinesCount()` esegue un calcolo assoluto rispetto al giorno odierno privo di orario (`today.setHours(0, 0, 0, 0)`):
- Identifica la variabile temporale: `Inizio_Allarme = dataScadenza - notificationDaysBefore`
- Se la data odierna entra in questa "finestra", scatta la sirena (`urgente = true`) e l'Home Page espone la **Badge Rossa** animata col count cumulativo senza interrogare di nuovo la base dati primaria, risparmiando letture asincrone esose e costose.

---

## 19. BACKEND ENTERPRISE: CLOUD FUNCTIONS E CRONJOBS (V2.0 Notifier)

### Spiegazione umana:
L'App Codici Password non è una semplice PWA (Client-Side). Possiede un "demone" serverless resident su Firebase Cloud Functions (`functions/index.js`) che opera indipendentemente dai telefoni degli utenti. Questo demone ha l'onere e l'onore di svegliarsi ogni giorno spaccando il minuto, scansionare il database globale, calcolare chi deve ricevere una notifica per una scadenza e inviarla in modo sicuro via Push o Email, tenendo traccia della cronologia per evitare spam.

### 19.1 Il Demone Schedulato (Cron Job)
La funzione primaria exportata è `checkDeadlines`, schedulata tramite `onSchedule("0 8 * * *")`.
- **Fuso Orario**: Esegue ogni giorno alle ore 08:00 AM (configurazione standard UTC/Europe).
- **Logica di Trigger**: Effettua una lettura passiva globale (`usersSnap = await db.collection("users").get()`), scorrendo ogni utente ed interpolando i dati con le relative collection `scadenze` attive.

### 19.2 L'Algoritmo di Avviso (Preavviso e Frequenza)
Il backend per far scattare un avviso non guarda solo "se è scaduto", ma esegue una doppia verifica algoritmica incrociata per non importunare l'utente:
1. **Verifica Preavviso (`notificationDaysBefore`)**: "Oggi mancano X giorni alla data. X è minore del limite di preavviso salvato in db?" (Es: Mancano 11 giorni, l'avviso è a 14. Regola superata).
2. **Verifica Frequenza Anti-Spam (`notificationFrequency`)**: Per evitare un'email al giorno, la funzione calcola il delta temporale (`now - lastSent`) dalla variabile `lastNotificationSent`. L'allarme viene effettivamente triggrato **solo** se il tempo trascorso dall'ultimo invio è pari o superiore ai giorni impostati nella frequenza (es. ogni 7 giorni).

### 19.3 Il Flusso di Rilascio Mutuamente Esclusivo (Push ➡️ Email Fallback)
Questa è l'architettura core di routing dei messaggi:
- **Piano A (Push Notifcation via FCM)**: Il modulo interroga prima gli `fcmTokens` salvati nell'utente. Se abilitato (`prefs_push !== false`), l'infrastruttura di Google spedisce un pacchetto push criptato al device, facendo apparire la notifica nativa sul telefono IOS/Android.
- **Piano B (Email Fallback Auth2)**: Solo e unicamente se il Push fallisce e l'utente ha autorizzato la ricezione email (`prefs_email_sharing !== false`), il sistema sgancia l'email di backup, assicurandosi che il messaggio arrivi a destinazione in ogni casistica.

### 19.4 Architettura Email OAuth2 e JWT (App Password)
Le mail passano per l'autenticazione tramite Password per le App.
Attualmente configurato con l'account: `boschettodiego@gmail.com`. 
Questo approccio garantisce:
- Recapità garantito (Bypass delle cartelle spam comuni).
- Assenza di limitazioni di invio rispetto agli SMTP gratis commerciali.
- Sicurezza tramite credenziale dedicata.

> 🤖 **Comando Agente AI: audit_backend_functions()**
> \`\`\`
> 1. Trattandosi di un ambiente Node.js distaccato (Server), evita di richiamare file, librerie e moduli frontend JS dentro `functions/index.js`. Qui si ragiona ESCLUSIVAMENTE tramite l'oggetto `admin.firestore()`.
> 2. Mai disabilitare le logiche "ArrayUnion" (ad esempio dentro `logNotification`) che tengono traccia dello storico notifiche nell'architettura utente, sono legali ed essenziali.
> 3. Evita cicli in `forEach` puri (bloccanti). Le scan di Firebase Functions devono SEMPRE usare esplicitamente costrutti ciclici basati su standard moderni (`for...of`) o map + Promise.all per evitare memory leaks e timeout dei processi lambda.
> \`\`\`

---

## 20. GESTIONE TOKEN E HEARTBEAT FCM (V5.4)

### 1️⃣ Lettura Umana

Nel nostro sistema, inviare notifiche Push richiede di conservare i "Token" dei dispositivi utente. Per evitare che il database si intasi di vecchi telefoni rotti o disconnessi (i cosiddetti "Token Zombie"), utilizziamo un sistema di pulizia e un campo chiamato `lastUsed` (Ultimo Utilizzo) configurato all'interno di `tokensMetadata`.

**Come Funziona?**
- Quando avvii l'app, il Frontend cattura il token e lo salva nel DB, registrando `lastUsed` come **Firestore Timestamp** (o convertendo eventuali vecchie date ISO).
- In Backend, il sistema ordina i token dal più recente al più vecchio e **mantiene in vita solo i TOP 3**. Gli altri vengono "amputati" per sicurezza.
- **L'Heartbeat (Il Battito Cardiaco):** Se l'utente riceve una notifica passiva ma non apre l'app per settimane, c'era il rischio che il dispositivo venisse classificato come zombie. Nella V5.4, abbiamo inserito l'**Heartbeat Delivery-Based**: ogni volta che una notifica arriva a destinazione con successo, il Backend aggiorna *automaticamente* quel token impostando `lastUsed` = Adesso. In questo modo i terminali validi si rinnovano da soli!

**Ibridazione (Il Rischio Crash)**
In passato i dati tempo erano formattati come testi (Stringhe ISO). Per consentire al server di fare ordine cronologico mischiando dati vecchi e nuovi senza rompere il sistema (Crash), adesso la `runHealthCheck` trasforma dinamicamente tutti i valori in Millisecondi durante i confronti, pur utilizzando nativi Firebase Timestamp sui nuovi log!

### 2️⃣ Esempio Operativo e Flusso Visivo

```text
[DISPOSITIVO]       [FRONTEND JS]                     [FIRESTORE DB]                      [CLOUD CRONJOB]
  Apre App  ━━━━━▶ syncPushToken()  ━━━━━▶ Scrive / Aggiorna tokensMetadata ◀━━━━━ (Ogni Mattina) runHealthCheck()
                        │                                  │                                │
                        ▼                                  ▼                                ▼
              [Verifica Watchdog < 3]               {                             [Se token > 3: Ordina per lastUsed]
                                                      "tokenA" : { lastUsed: Timestamp },   [Slice(0,3) (Salva Nuovi)]
[SVEGLIA PASSIVA]                                     "tokenB" : { lastUsed: ISO Old }      [Amputa token obsoleti ] 
 Notifica Inviata ◀━━━ FCM Success ━━━━━━━━ (Aggiorna) "tokenC" : { lastUsed: Timestamp }
```

**Scenario Pratico:**
1. **Device A (Tablet Vecchio):** Ultima apertura 20 giorni fa.
2. **Device B (Smartphone):** Ultima apertura ieri.
3. **Device C (PC Lavoro):** Apre oggi pomeriggio.
4. **Oggi alle 15:00:** Invio Notifica Scadenza. Va a buon fine su A, B e C!
5. *Effetto V5.4:* L'Heartbeat aggiorna in Firestore il campo `lastUsed` per i token A, B e C impostandolo alle 15:00 di oggi.
6. **Device D (Nuovo):** Esegue Login stasera.
7. *Effetto Watchdog (Domani 8:00):* Riconosce 4 token totali. Ordina per `lastUsed`: D (stasera), A, B, C (ore 15:00). Nessuno ha 20 giorni. Il sistema taglierà semplicemente in base al millisecondo più lento ma non ucciderà MAI un telefono passivo valido!

### 3️⃣ Comandi operativi per Agenti AI e Umani

Questa serie di Prompt istruisce un Agente a scansionare, riparare o diagnosticare anomalie Push. Evidenziarli direttamente nei Task o in chat:

> 🤖 **Comando AI: `verify_fcm_health("ID_UTENTE")`**
> Verifica la correttezza del formato `tokensMetadata` estrando il record Firestore, assicurandosi che non ci siano mismatch ISO VS Timestamp e stampa la lunghezza dell'array.
```javascript
// Esempio logico di verifica:
const doc = await db.collection("users").doc(UID).get();
console.log(doc.data().tokensMetadata);
```

> 🤖 **Comando AI: `run_healthcheck_dry()`**
> Simula il pruning (Cronjob O_o 8 AM) su Firebase Emulator (o limitato in readonly) per osservare chi verrebbe rimosso da un array `> 3`, usando esplicitamente la logica iterativa millisecondi `getMillis()`.

> 👨‍💻 **Azione Umana (Normalizzazione DB)**
> Nel caso di sporcizia residua da V4, eseguire da shell il comando Firebase Functions locale oppure lo script NodeJS di migrazione:
> `npm run migrate:fcm-timers` *(Script temporaneo di conversione da String a Timestamp Firestore)*.

> 🤖 **Comando AI: `test_delivery_heartbeat()`**
> Simula un invio push "vittorioso" a un token target noto e verifica 5 secondi dopo se il demone backend ha istanziato il campo `tokensMetadata.{tokenId}.lastUsed` con il nuovo serverTimestamp().

---

✅ **PROTOCOLLO V5.1 MASTER — DOCUMENTAZIONE COMPLETA.**
Questa guida è ora il tuo unico manuale operativo. Non deviare dalla via maestra.

---

## 21. MODALITÀ OFFLINE E SICUREZZA LOCALE (ROADMAP STRATEGICA)

### 21.1 🎯 Obiettivo
L’app dovrà permettere la navigazione tra gli account e l’accesso ai dati essenziali anche in assenza di connessione internet. Lo scenario d’uso principale è il seguente:
- **Utente senza segnale** che necessita di accedere a un’informazione critica (es. PIN Bancomat, codice carta, credenziali di emergenza).
L’obiettivo è rendere l’utente autonomo anche offline, evitando blocchi operativi in situazioni critiche.

### 21.2 ⚠️ Premessa Importante
In assenza di connessione:
- L’accesso a username/password di siti web potrebbe non essere immediatamente utile.
- Tuttavia, codici fisici (**PIN, codici carte, codici emergenza**) possono risultare fondamentali.

È quindi necessario distinguere tra:
- **🔹 Credenziali “web”**
- **🔹 Dati sensibili di utilizzo fisico** (PIN, codici carta, ecc.) — *Priorità Offline*

### 21.3 🔐 Tema Critico: Sicurezza dei Dati Locali
Consentire l'accesso offline significa salvare dati sensibili in locale sul dispositivo. Questo introduce rischi significativi in caso di smarrimento, furto o accesso fisico non autorizzato. La modalità offline deve quindi essere progettata con un modello **“zero trust locale”**.

### 21.4 🔒 Linee Guida di Sicurezza Obbligatorie

1. **1️⃣ Cifratura Locale Forte**:
   - Tutti i dati sensibili devono essere cifrati in locale. Nessun dato leggibile in chiaro nel filesystem.
   - Utilizzo di chiavi derivate dalla master password o secure enclave del dispositivo.
2. **2️⃣ Sblocco Biometrico Obbligatorio**:
   - Accesso ai dati offline consentito solo tramite **Biometria** (FaceID / Fingerprint) o **Master password**. Mai accesso diretto automatico.
3. **3️⃣ Separazione dei Livelli di Sensibilità**:
   - Possibile evoluzione: Livello base visibile offline, Livello critico (PIN, carte) visibile solo dopo un secondo livello di autenticazione.
4. **4️⃣ Auto-Lock & Auto-Purge**:
   - Blocco automatico dopo inattività e cancellazione delle cache temporanee. Nessun dato lasciato in memoria oltre il tempo necessario.

### 21.5 🧠 Decisione Architetturale da Prendere
**Domanda chiave**: Vogliamo che tutti gli account siano disponibili offline o solo quelli marcati come “Accesso Emergenza”?
**Possibile soluzione evoluta**:
- Inserire un Toggle **“Disponibile Offline”** per ogni account.
- Sincronizzazione cifrata locale solo per gli elementi marcati. Questo riduce drasticamente il rischio.

### 21.6 ⚖️ Considerazione Strategica
Un’app che contiene PIN Bancomat, codici carte di credito e password critiche diventa un **“Single Point of Failure”**. L’obiettivo non deve essere solo funzionale, ma **ridurre il danno massimo possibile** in caso di compromissione del dispositivo.

### 21.7 📌 Conclusione
La modalità offline è un’evoluzione strategica importante, ma deve essere implementata solo con cifratura robusta, autenticazione forte e minimizzazione dei dati salvati. 
**La sicurezza non può essere un’aggiunta successiva: deve essere parte integrante della progettazione.**

---

## 22. CODICE RIMOSSO — ARCHIVIO PER EVENTUALE RIPRISTINO

### 22.1 Pulsante Invia Notifica di Prova (Rimosso v5.3 — 23/02/2026)

**Motivo rimozione**: Le notifiche push funzionano correttamente. Il pulsante di test non serve piu in produzione.

**Come ripristinarlo**: Seguire i 2 passaggi sotto.

#### Passo 1 — HTML (impostazioni.html)

Inserire dentro al settings-item delle Notifiche Push, dopo il div.flex-between:

```html
<button id='btn-test-push' class='btn-text-accent text-[10px] mt-1 hidden'>
    <span class='material-symbols-outlined text-[14px]'>send</span>
    Invia Notifica di Prova
</button>
```

#### Passo 2 — JS (impostazioni.js)

Dentro al blocco if (tPush), dopo il listener change, aggiungere:

```javascript
const btnTest = document.getElementById('btn-test-push');
if (btnTest) {
    btnTest.classList.toggle('hidden', !tPush.checked);
    btnTest.addEventListener('click', async () => {
        try {
            btnTest.disabled = true;
            showToast('Invio notifica di prova...');
            await addDoc(collection(db, 'users', auth.currentUser.uid, 'notifications'), {
                title: 'Prova Push',
                message: 'Se leggi questo messaggio, le notifiche push funzionano!',
                timestamp: serverTimestamp(),
                type: 'test'
            });
            const CACHE_KEY = 'notifications_cache_data_' + auth.currentUser.uid;
            localStorage.removeItem(CACHE_KEY);
            showToast('Notifica inviata con successo!');
        } catch (e) {
            console.error('Errore invio prova:', e);
            showToast('Errore invio prova', 'error');
        } finally {
            setTimeout(() => btnTest.disabled = false, 3000);
        }
    });
}
```

Nel listener change del toggle push, dopo showToast, aggiungere:

```javascript
if (btnTest) btnTest.classList.toggle('hidden', !val);
```

> NOTA: addDoc, collection, serverTimestamp devono essere importati da Firestore.


### 22.2 Pulsante TEST Push in Dettaglio Scadenza (Rimosso v5.3 - 23/02/2026)

**Motivo rimozione**: Le notifiche push funzionano. Il pulsante TEST nel dettaglio scadenza non serve piu.

**File**: `dettaglio_scadenza.js`

**Come ripristinarlo**:

#### Passo 1 - Ripristinare la funzione handleTestNotification

Aggiungere prima di renderScadenza():

```javascript
async function handleTestNotification() {
    if (!currentScadenza || !auth.currentUser) return;
    try {
        const ok = await showConfirmModal('INVIO TEST PUSH','Vuoi inviare una notifica push di test?','Invia Test');
        if (!ok) return;
        const token = await getPushToken(auth.currentUser.uid);
        if (!token) console.warn('Nessun token FCM trovato.');
        await addNotification(auth.currentUser.uid, {
            title: 'TEST PUSH: ' + currentScadenza.title,
            message: 'Verifica ricezione: la notifica per questa scadenza e configurata correttamente.',
            type: 'deadline_test',
            scadenzaId: currentScadenzaId,
            channel: currentScadenza.notificationChannel || 'none'
        });
        localStorage.removeItem('notifications_cache_data_' + auth.currentUser.uid);
        localStorage.removeItem('notifications_cache_timestamp_' + auth.currentUser.uid);
        showToast('Notifica di test inviata!', 'success');
    } catch (e) {
        console.error('Errore invio test:', e);
        showToast('Errore durante invio', 'error');
    }
}
```

#### Passo 2 - Ripristinare il bottone nel renderScadenza

Nella sezione Notifiche, dentro al detail-list-item del canale, aggiungere dopo il div info:

```javascript
isNotifActive ? createElement('button', {
    className: 'btn-icon-test-push',
    title: 'Invia Notifica di Test',
    onclick: handleTestNotification
}, [
    createElement('span', { className: 'material-symbols-outlined', textContent: 'send' }),
    createElement('span', { className: 'text-xs ml-1', textContent: 'TEST' })
]) : null
```

> NOTA: Richiede import di addNotification e getPushToken da db.js
---

## 23. LOGICA NOTIFICHE "STUPID-PROOF" (V5.5)

### 1️⃣ Filosofia del Sistema
Il sistema di notifiche è stato reso "robusto" per evitare che l'utente manchi una scadenza a causa di impostazioni di frequenza troppo larghe o dimenticanze nel salvataggio. La logica si basa su tre pilastri:

1.  **Invio Immediato al Salvataggio**: La notifica non aspetta più il cronjob delle 08:00. Se salvi una scadenza che è già nel periodo di preavviso, l'avviso parte **immediatamente**.
2.  **Regola del "Giorno Zero" (Deadline Day)**: Indipendentemente dalla frequenza impostata (es. ogni 7 giorni), il giorno esatto della scadenza il sistema invierà **sempre** una notifica finale. Non è possibile "saltare" il giorno della scadenza.
3.  **Aggregazione Destinatari**: Il sistema invia a tutti i soggetti coinvolti (Email principali e Utenti registrati per le Push), anche se il campo email principale è vuoto.

### 2️⃣ Flusso Tecnico (Cloud Functions)

Il Backend utilizza due motori paralleli che condividono la stessa logica di calcolo:
- **Motore A (Cronjob)**: Gira ogni mattina alle 08:00 e scansiona tutte le scadenze attive.
- **Motore B (Real-time Trigger)**: Si attiva istantaneamente quando crei o modifichi una scadenza (`onDocumentWritten`).

#### La Logica di decisione (`shouldNotify`):
```javascript
// La notifica parte se:
let shouldNotify = 
    !lastSent || // 1. Non è mai stata inviata
    ((now - lastSent) >= frequency) || // 2. È passata la frequenza impostata
    diffDays === 0; // 3. OGGI È IL GIORNO DELLA SCADENZA (Sempre True)
```

### 3️⃣ Casi d'Uso Operativi

| Scenario | Comportamento Ante V5.5 | Comportamento V5.5 (Nuovo) |
| :--- | :--- | :--- |
| **Salvataggio Urgente** (scade domani) | Notifica domani mattina alle 08:00 | Notifica **ISTANTANEA** appena premi Salva |
| **Frequenza 10 giorni** (scade oggi) | Se inviata 2 giorni fa, oggi non inviava | Invia **OGGI** (Giorno Zero) ignorando la frequenza |
| **Solo Push selezionati** | Poteva bloccarsi se l'email era vuota | Invia regolarmente ai destinatari Push |

### 4️⃣ Manutenzione e Debug
Se un utente lamenta la mancata ricezione:
1.  **Verificare lo Stato**: La scadenza deve essere `status: "active"`.
2.  **Verificare i Destinatari**: Controllare l'array `emails` e `pushRecipients` nel documento Firestore.
3.  **Log Storico**: Controllare il campo `notificationLogs` dentro la scadenza per vedere la cronologia degli invii tentati dal server.

---

✅ **DOCUMENTAZIONE AGGIORNATA AL PROTOCOLLO V5.5.**
