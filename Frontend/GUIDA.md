GUIDA DI TRANSIZIONE V4.0 → V5.0 (Consolidata e Operativa)
1) Stato Iniziale (Pre-Migrazione)

Spiegazione umana:
Prima del refactoring, le pagine dell’app dipendevano da file monolitici come operatore.css e da utility Tailwind. Gli stili erano sparsi, con molti inline e classi generiche, senza stratificazione chiara. Questo creava confusione e difficoltà nel mantenimento.

Esempio:

<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/operatore.css?v=3.6">
<div style="background-color:#fff; padding:10px;">...</div>


Note operative:

CSS inline e Tailwind non sono ammessi nel target V5.0.

Ogni pagina deve avere solo i CSS modulari e stratificati corretti.

Comando Agente AI:

AGENTE AI:
Analizza la pagina [pagina.html].
Rimuovi tutti i CSS inline e riferimenti a Tailwind o operatore.css.
Assicura che siano presenti solo core.css, core_fonts.css e [pagina].css come da mappatura standard V5.0.
Segnala eventuali elementi inline non rimovibili.

2) Architettura Target V4.0 / V5.0
2.1 Stratificazione della Base Consolidata
Spiegazione umana:

Ogni pagina dell’app deve aderire ad una base architetturale stratificata e coerente.
Lo scopo è garantire:

Coerenza visiva globale

Compatibilità Dual-Mode (Light/Dark)

Separazione tra struttura e contenuto

Manutenibilità a lungo termine

Eliminazione di dipendenze implicite

La base consolidata è composta da:

body.base-bg → gestione sfondo dinamico

.base-container → contenitore strutturale principale

.base-glow → effetto decorativo globale

<main class="base-main"> → area contenuto (solo pagine applicative)

.page-container → gestione padding responsivo e safe-area

Questa struttura è obbligatoria per tutte le pagine ad eccezione delle Auth Pages, che seguono un layout alternativo autorizzato (vedi sotto).

⚠️ Eccezione Architetturale Ufficiale – Auth Pages

Le seguenti pagine:

index.html

registrati.html

reset-password.html

nuova-password.html

costituiscono una eccezione strutturale intenzionale e formalmente approvata.

Motivazione:

Sono pagine fuori dal flusso applicativo autenticato.

Non devono caricare header e footer applicativi.

Non devono includere <main class="base-main">.

Utilizzano .vault come contenitore primario del contenuto.

Devono comunque includere:

body class="base-bg"

.base-container

.base-glow

Il layout Auth è considerato conforme allo standard V5.0 e non rappresenta una violazione della regola Header–Main–Footer.

Non esistono altre eccezioni autorizzate.

Esempi Base Background
/* Base Background */
body.base-bg {
    background: var(--base-box-gradient);
    background-attachment: fixed;
}

Faro Decorativo
.base-glow {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 150%;
    height: 300%;
    z-index: 1;
    background: var(--glow-color);
    pointer-events: none;
    animation: glowFloat 5s ease-in-out infinite;
}

Contenitore Principale (Pagine Non Auth)
<main class="base-main">
    <div class="page-container pt-header-extra pb-footer-extra">
        <!-- Contenuto -->
    </div>
</main>

Note operative:

.base-glow e .base-bg reagiscono al tema Light/Dark.

.page-container gestisce padding responsivo e safe-area.

Nessun CSS inline è ammesso.

Nessuna struttura alternativa è ammessa oltre alla variante Auth documentata.

Comando Agente AI:

AGENTE AI:
Controlla la pagina [pagina.html]:

Verifica che body abbia class="base-bg".

Verifica presenza di div.base-container.

Verifica presenza di div.base-glow.

Se la pagina NON è una Auth Page:

Verifica presenza di <main class="base-main">.

Verifica presenza di div.page-container.

Se la pagina È una Auth Page (index.html, registrati.html, reset-password.html, nuova-password.html):

NON richiedere <main class="base-main">.

NON richiedere header o footer.

Verifica presenza del wrapper .vault come contenitore principale.

Tutti gli stili devono derivare da CSS modulari, nessun inline.

Segnala eventuali deviazioni strutturali.

2.2 Sistema CSS Modularizzato
Spiegazione umana:

Il CSS deve essere organizzato in modo modulare e stratificato.

Livelli autorizzati:

core.css → base visiva generale

core_fonts.css → font e simboli comuni

core_fascie.css → header/footer e safe-area

[pagina].css → CSS specifico della singola pagina

core_ui.css → componenti UI condivisi

moduli.css → layout per moduli gestionali

È vietato:

Utilizzare operatore.css

Utilizzare fonts.css

Inserire CSS inline

Importare file legacy

Tabella Pagine / CSS
Tipologia	Pagina	CSS di Riferimento
Auth Pages	index.html, registrati.html	core.css + core_fonts.css + accesso.css
Core Pages	impostazioni.html	core.css + core_fonts.css + core_fascie.css + impostazioni.css + core_ui.css
Moduli Gestionali	configurazione_generali.html	core.css + core_fonts.css + moduli.css
Comando Agente AI:

AGENTE AI:
Per [pagina.html]:

Identifica la tipologia pagina (Auth, Core, Modulo).

Controlla che siano inclusi solo i CSS autorizzati dalla tabella.

Nessun file obsoleto (operatore.css, fonts.css ecc.) deve essere presente.

Segnala eventuali CSS non consentiti.

Segnala mancanze di CSS obbligatori per la tipologia pagina.

2.3 Script Loading / Bootstrap JS
Spiegazione umana:

Tutte le pagine devono utilizzare main.js come orchestratore unico.

Regole fondamentali:

I moduli JS devono essere passivi.

Devono esportare solo init[NomePagina](user).

Nessuna auto-inizializzazione.

Nessun DOMContentLoaded.

Nessun observeAuth.

Nessuna chiamata top-level a initComponents() o initLockedUX().

L’inizializzazione è centralizzata in pages-init.js.

Esempio modulo passivo
// login.js passivo
export async function initLogin() {
    setupLoginForm();
    setupLanguageSelector();
    setupPasswordToggle();
}

Esempio bootstrap
// pages-init.js
export async function initIndex() {
    const { initLogin } = await import('./modules/auth/login.js');
    await initLogin();
}

Comando Agente AI:

AGENTE AI:
Per [pagina.html]:

Verifica presenza di main.js in fondo al body.

Controlla che i moduli JS siano passivi e esportino solo init[NomePagina](user).

Nessuna chiamata top-level a initComponents() o initLockedUX() nei moduli.

Segnala moduli legacy auto-inizializzanti.

Rimuovi DOMContentLoaded, observeAuth o pattern legacy se presenti.

2.4 HTML Refactoring e Classi Semantiche
Spiegazione umana:

La struttura HTML deve essere semanticamente coerente e aderente alla tipologia pagina.

Esistono due layout autorizzati:

Layout Applicativo Standard (Header–Main–Footer)

Layout Alternativo Auth (Vault Layout)

Non esistono altre varianti consentite.

Esempi Auth Page
<body class="base-bg">
    <div class="base-container">
        <div class="base-glow"></div>
        <div class="vault">
            <div class="card border-glow">...</div>
        </div>
    </div>
</body>


Caratteristiche:

Nessun header

Nessun footer

Nessun main.base-main

.vault come contenitore primario

Esempi Core Page
<body class="base-bg home-page">
    <div class="base-container">
        <div class="base-glow"></div>
        <header id="header-placeholder" class="base-header"></header>
        <main class="base-main">
            <div class="page-container pt-header-extra pb-footer-extra">
                <!-- Contenuto -->
            </div>
        </main>
        <footer id="footer-placeholder" class="base-footer"></footer>
    </div>
</body>


Caratteristiche:

Header placeholder obbligatorio

Footer placeholder obbligatorio

main.base-main obbligatorio

page-container obbligatorio

Comando Agente AI:

AGENTE AI:

Identifica la tipologia pagina.

Se pagina NON Auth:

Verifica presenza di #header-placeholder con classe base-header.

Verifica presenza di <main class="base-main">.

Verifica presenza di div.page-container.

Verifica presenza di #footer-placeholder con classe base-footer.

Se pagina Auth:

NON richiedere header.

NON richiedere footer.

NON richiedere main.base-main.

Verifica presenza di .vault.

Controlla che body, .base-container, .base-glow siano presenti in entrambe le tipologie.

Segnala elementi non conformi rispetto alla tipologia identificata.

3) Componenti UI / Dual Mode / i18n

Spiegazione umana:

Componenti standardizzati: card, toggle, dropdown, hero-card, matrix-card.

Tutti i colori tramite variabili CSS, light/dark mode compatibile.

i18n tramite data-t, attributi ARIA tramite data-t-aria.

Comando Agente AI:

AGENTE AI:
Per [pagina.html]:
1. Verifica che tutte le card, toggle, dropdown abbiano classi corrette.
2. Controlla dual-mode tramite variabili CSS.
3. Controlla testi con data-t e attributi ARIA con data-t-aria.

4) Checklist Finale Post-Migrazione

Controlli da fare per ogni pagina:

 Audit completo pagina ✅

 CSS dedicato creato ✅

 <head> aggiornato ✅

Header/Footer placeholder presenti ✅ (solo per pagine non Auth)

Layout Auth conforme (.vault presente, nessun header/footer) ✅

 Safe area padding ✅

 Classi Card, Toggle, Dropdown ✅

 main.js presente ✅

 Moduli JS passivi importati correttamente ✅

 Dual-mode e i18n verificati ✅

 Nessun CSS Core modificato ✅

 Nessun file obsoleto caricato ✅

Comando Agente AI (Check Completo):

AGENTE AI:
Esegui audit completo su [pagina.html]:
1. Controlla presenza CSS e JS come da standard.
2. Controlla struttura HTML base (body, base-container, base-glow, base-main, header/footer placeholder).
3. Controlla moduli passivi init[NomePagina](user) corretti.
4. Controlla classi UI standard, dual-mode, i18n.
5. Segnala tutte le anomalie, incongruenze o elementi non conformi.

5) SISTEMA DI CONDIVISIONE – HARDENING V2 (MULTI-DESTINATARIO)
📘 5.1 — PARTE UMANA (SPECIFICA TECNICA COMPLETA)
🎯 Obiettivo

Rendere il sistema di condivisione:

Transaction-safe
Race-condition proof
Coerente bidirezionalmente
Backend-enforced
Idempotente
Realtime
Auto-healing
Enterprise-ready
Multi-destinario (più utenti per account/memorandum)

🔐 5.1.1 Stati Account (Flag Esclusivi)

Un account può avere un solo flag tra:
Privato
Condiviso
Memorandum
Se Condiviso o Memorandum → è obbligatorio selezionare almeno un destinatario interno.
È possibile aggiungere più destinatari per lo stesso account.

🌉 5.1.2 Documento “Invite” (Il Ponte)

Ogni destinatario ha il proprio invite singolo.
Collezione: invites

Struttura minima:

{
  "accountId": "string",
  "ownerEmail": "string",
  "recipientEmail": "string",
  "status": "pending | accepted | revoked",
  "createdAt": "timestamp"
}
Non creare duplicati.
Lo stato è indipendente per ogni destinatario.

🚫 5.1.3 Anti-Duplicazione

Prima di creare invite:

Verificare che non esista già un invite con stesso accountId e recipientEmail in status pending o accepted.
Se esiste: non creare duplicato e non resettare lo stato.

⚙ 5.1.4 Transazioni Atomiche

Le operazioni critiche devono usare runTransaction():
Accettazione invite
Cambio destinatario
Stop condivisione
Accettazione invite:
Leggi invite
Verifica status === pending
Aggiorna invite → accepted
Aggiorna account → aggiungi email in sharedWithEmails
Commit

Stop condivisione:

Rimuovere flag shared/memo
Svuotare sharedWithEmails
Cancellare o revocare invite
Commit

🔁 5.1.5 Consistency Check Bidirezionale

Invite accepted ma email non in sharedWithEmails → aggiungi email.
Email in sharedWithEmails ma invite mancante → rimuovi email.
Invite pending ma flag account disattivato → cancella invite.

🔒 5.1.6 Security Rules Hardened

Lettura account condiviso solo se:
Email presente in sharedWithEmails
Esiste invite collegato all’account
Invite.status == accepted

🧯 5.1.7 Protezione Doppio Click

Disabilita bottone “Accetta” al click
Controlla status !== pending prima di aggiornare

🔄 5.1.8 Listener Globale

main.js controlla invite pendenti al login
Mostra popup globale
Usa listener realtime (onSnapshot)

📡 5.1.9 Stato Live Lato Proprietario

Dettaglio account mostra lista destinatari
Colore stato:
Giallo → pending
Verde → accepted
Possibilità di aggiungere nuovi destinatari senza alterare quelli già presenti
Possibilità di revocare singoli destinatari

🧪 5.2 — PARTE ESEMPIO
Esempio Multi-Destinario
{
  "accountId": "acc_123",
  "ownerEmail": "owner@app.com",
  "sharedWithEmails": ["userA@app.com", "userB@app.com", "userC@app.com"]
}

Invites:
[
  {"recipientEmail": "userA@app.com", "status": "accepted"},
  {"recipientEmail": "userB@app.com", "status": "pending"},
  {"recipientEmail": "userC@app.com", "status": "pending"}
]

UI:

Lista destinatari con stato live
Possibilità di aggiungere destinatario D → crea nuovo invite pending
Possibilità di rimuovere destinatario B → revoke invite + rimuovi email dall’array
Esempio Stop Condivisione
Proprietario rimuove flag shared
sharedWithEmails svuotato
Invite cancellati/revoked
Destinatari perdono accesso immediato
Esempio Race Condition
Due click su “Accetta” → solo primo update valido
Nessuna duplicazione
Coerenza mantenuta

🤖 5.3 — VERSIONE PER AGENTE AI
Obiettivo

Verificare e correggere sistema di condivisione multi-destinario, idempotente, transazionale e coerente.

5.3.1 Transazioni

Accettazione invite → transaction
Stop condivisione → transaction
Cambio destinatario → transaction
Refactor se operazioni non sono atomic

5.3.2 Consistency Check

Invite accepted ma email non in array → aggiungere
Email in array ma invite mancante → rimuovere
Invite pending ma flag disattivo → cancellare

5.3.3 Security Rules

Lettura solo se email in array e invite accepted esiste

5.3.4 Anti-Duplicazione

Prima di creare invite, verificare assenza duplicati

5.3.5 Protezione doppio click

Disabilita bottone
Controllo status pending

5.3.6 Listener Globale

Controllo invite pendenti al login
Popup globale
Realtime listener

5.3.7 Output report JSON
{
  "accountId": "acc_123",
  "sharedWithEmails": [
    {"email": "userA@app.com", "status": "accepted"},
    {"email": "userB@app.com", "status": "pending"},
    {"email": "userC@app.com", "status": "pending"}
  ],
  "consistency_check": "OK / NON_COMPLIANT",
  "actions_needed": []
}

✅ Risultato Atteso

Dopo implementazione completa:

Transaction-safe
Race-condition proof
Multi-destinario
Coerenza bidirezionale
Backend-enforced
Idempotente
Realtime
Auto-healing
Enterprise-ready