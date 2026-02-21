GUIDA DI TRANSIZIONEV5.0 (Consolidata e Operativa)
1) Stato Iniziale 

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
Ogni pagina dell’app deve aderire ad una base architetturale stratificata e coerente. Lo scopo è garantire:

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

Eccezione Architetturale Ufficiale – Auth Pages:
Le pagine: index.html, registrati.html, reset-password.html, nuova-password.html costituiscono una eccezione strutturale intenzionale e formalmente approvata.

Non devono caricare header e footer applicativi.

Non devono includere <main class="base-main">.

Utilizzano .vault come contenitore primario del contenuto.

Devono comunque includere: body class="base-bg", .base-container, .base-glow.

Esempi Base Background:

/* Base Background */
body.base-bg {
    background: var(--base-box-gradient);
    background-attachment: fixed;
}

/* Faro Decorativo */
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


Contenitore Principale (Pagine Non Auth):

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

Se la pagina È una Auth Page:

NON richiedere <main class="base-main">.

NON richiedere header o footer.

Verifica presenza del wrapper .vault come contenitore principale.

Tutti gli stili devono derivare da CSS modulari, nessun inline.

Segnala deviazioni strutturali.

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

Segnala mancanze di CSS obbligatori per la tipologia pagina.

2.3 Script Loading / Bootstrap JS

Spiegazione umana:

Tutte le pagine devono utilizzare main.js come orchestratore unico.

I moduli JS devono essere passivi.

Devono esportare solo init[NomePagina](user).

Nessuna auto-inizializzazione.

L’inizializzazione è centralizzata in pages-init.js.

Esempio modulo passivo:

// login.js passivo
export async function initLogin() {
    setupLoginForm();
    setupLanguageSelector();
    setupPasswordToggle();
}


Esempio bootstrap:

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

Struttura HTML deve essere semanticamente coerente e aderente alla tipologia pagina.

Layout autorizzati: Header–Main–Footer (Core Pages) / Vault Layout (Auth Pages).

Esempi Auth Page:

<body class="base-bg">
    <div class="base-container">
        <div class="base-glow"></div>
        <div class="vault">
            <div class="card border-glow">...</div>
        </div>
    </div>
</body>


Esempi Core Page:

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

Verifica che tutte le card, toggle, dropdown abbiano classi corrette.

Controlla dual-mode tramite variabili CSS.

Controlla testi con data-t e attributi ARIA con data-t-aria.

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

Controlla presenza CSS e JS come da standard.

Controlla struttura HTML base (body, base-container, base-glow, base-main, header/footer placeholder).

Controlla moduli passivi init[NomePagina](user) corretti.

Controlla classi UI standard, dual-mode, i18n.

Segnala tutte le anomalie, incongruenze o elementi non conformi.

5) SISTEMA DI CONDIVISIONE – HARDENING V2 (MULTI-DESTINATARIO)

(segue la guida originale dalla sezione 5, invariata, con tutte le subsezioni 5.1 – 5.3 e esempi JSON, UI, race condition, listener globale, output report, ecc.)

Aree Critiche / Punti da Monitorare (Aggiornato)

Migrazione CSS inline e Tailwind:
Convertire tutti i CSS inline e classi Tailwind in file modulari [pagina].css senza alterare lo styling originale, preservando colori, spaziature, dimensioni e layout responsivo.

Integrazione JS legacy:
Moduli legacy adattati a pattern passivi centralizzati in main.js/pages-init.js. Chiamate top-level, DOMContentLoaded o observeAuth sostituite senza perdere logica esistente. Funzioni init[NomePagina](user) devono funzionare correttamente.

Dual-mode e i18n:
Tutti gli stili e componenti devono continuare a supportare light/dark mode e variabili CSS dual-mode.
Componenti UI (card, toggle, dropdown) mantengono classi corrette e comportamento coerente.
Attributi data-t e data-t-aria preservati per internazionalizzazione e accessibilità.

Controlli trasversali:

Consistenza visiva rispetto al design originale.

Integrità dei moduli JS passivi.

Compatibilità dual-mode e corretto mapping i18n.

Nessun CSS inline residuo.

========================================================================
========================================================================

GUIDA DI TRANSIZIONE V5.0 (Agente AI Ready)
1) Stato Iniziale 

Task Operativi AI:

Analizza [pagina.html] e identifica:

Tutti i CSS inline presenti.

Tutti i riferimenti a Tailwind o operatore.css.

File legacy (fonts.css ecc.).

Esegui refactor CSS:

Rimuovi CSS inline e Tailwind.

Migra styling esistente in [pagina].css preservando layout e colori.

Verifica:

Solo core.css, core_fonts.css, [pagina].css presenti secondo mappatura V5.0.

Segnala eventuali inline non rimovibili.

2) Architettura Target V5.0
2.1 Stratificazione della Base

Task AI:

Controlla struttura base:

body ha class="base-bg"

div.base-container presente

div.base-glow presente

Se pagina NON Auth:

<main class="base-main"> presente

div.page-container presente

Se pagina Auth (index.html, registrati.html, reset-password.html, nuova-password.html):

.vault presente

NON richiedere <main>

NON richiedere header/footer

Segnala qualsiasi deviazione dallo standard V5.0.

2.2 Sistema CSS Modularizzato

Task AI:

Identifica tipologia pagina: Auth, Core, Modulo.

Controlla inclusione CSS obbligatori per tipologia secondo tabella:

Tipologia	Pagina	CSS
Auth Pages	index.html, registrati.html	core.css + core_fonts.css + accesso.css
Core Pages	impostazioni.html	core.css + core_fonts.css + core_fascie.css + impostazioni.css + core_ui.css
Moduli Gestionali	configurazione_generali.html	core.css + core_fonts.css + moduli.css

Segnala file obsoleti o mancanti.

2.3 Script Loading / Bootstrap JS

Task AI:

Controlla <script src="main.js"> presente in fondo al body.

Controlla che tutti i moduli JS siano passivi e esportino solo init[NomePagina](user).

Rimuovi pattern legacy: DOMContentLoaded, observeAuth, initComponents(), initLockedUX().

Segnala moduli legacy auto-inizializzanti.

2.4 HTML Refactoring e Classi Semantiche

Task AI:

Identifica tipologia pagina.

Per pagine NON Auth:

#header-placeholder con class="base-header" presente

<main class="base-main"> presente

div.page-container presente

#footer-placeholder con class="base-footer" presente

Per pagine Auth:

.vault presente

NON richiedere header/footer/main

Controlla che body, .base-container, .base-glow siano sempre presenti.

Segnala elementi non conformi.

3) Componenti UI / Dual Mode / i18n

Task AI:

Controlla tutte le card, toggle, dropdown, hero-card, matrix-card:

Classi corrette

Comportamento dual-mode tramite variabili CSS

Controlla testi:

data-t per traduzioni

data-t-aria per ARIA/accessibilità

Segnala anomalie o regressioni visive/semantiche.

4) Checklist Finale Post-Migrazione

Task AI:

Per [pagina.html], verifica:

Audit completo pagina ✅

CSS dedicato creato ✅

<head> aggiornato ✅

Header/Footer placeholder presenti (solo non Auth) ✅

Layout Auth conforme ✅

Safe area padding corretto ✅

Classi Card, Toggle, Dropdown corrette ✅

main.js presente ✅

Moduli JS passivi importati correttamente ✅

Dual-mode e i18n verificati ✅

Nessun CSS Core modificato ✅

Nessun file obsoleto caricato ✅

5) SISTEMA DI CONDIVISIONE – HARDENING V2 (MULTI-DESTINATARIO)

Task AI:

Accettazione invite, stop condivisione, cambio destinatario: usa transaction atomic.

Verifica anti-duplicazione: non creare invite duplicati.

Controlla coerenza bidirezionale:

Invite accepted ma email non in array → aggiungi

Email in array ma invite mancante → rimuovi

Invite pending ma flag account disattivo → cancella

Protezione doppio click: disabilita bottone se status ≠ pending.

Listener globale: realtime onSnapshot, popup invite pendenti.

Output JSON report per ogni account:

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

6) Aree Critiche / Punti da Monitorare (AI Ready)

Migrazione CSS inline e Tailwind

Convertire senza perdere styling originale.

Tutti i layout e colori devono essere preservati in [pagina].css.

Integrazione JS legacy

Adattare a moduli passivi centralizzati.

Sostituire pattern top-level e legacy senza perdere funzionalità.

Dual-mode e i18n

Verifica compatibilità light/dark mode.

Controlla attributi data-t e data-t-aria.

Controlli trasversali

Consistenza visiva con design originale

Integrità moduli JS

Compatibilità dual-mode/i18n

Nessun CSS inline residuo
