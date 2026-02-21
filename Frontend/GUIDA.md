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

✅ **PROTOCOLLO V5.1 MASTER — DOCUMENTAZIONE COMPLETA.**
Questa guida è ora il tuo unico manuale operativo. Non deviare dalla via maestra.
