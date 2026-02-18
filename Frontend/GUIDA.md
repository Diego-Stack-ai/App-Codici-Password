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
Ogni pagina deve avere una base comune e stratificata: sfondo, effetti decorativi, contenitore principale. Questo garantisce coerenza visiva e compatibilità dual-mode (light/dark).

Esempi:

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

/* Contenitore Principale */
<main class="base-main">
    <div class="page-container pt-header-extra pb-footer-extra">
        <!-- Contenuto -->
    </div>
</main>


Note operative:

.base-glow e .base-bg reagiscono al tema Light/Dark.

.page-container gestisce padding responsivo e safe area.

Comando Agente AI:

AGENTE AI:
Controlla la pagina [pagina.html]:
1. Verifica che body abbia class="base-bg".
2. Verifica presenza di div.base-glow.
3. Verifica presenza di main.base-main con div.page-container.
4. Tutti gli stili devono derivare da CSS modulari, nessun inline.
5. Se mancano, aggiungi la struttura base e segnalalo.

2.2 Sistema CSS Modularizzato

Spiegazione umana:
Il CSS deve essere suddiviso per livello e tipologia pagina:

core.css: base visiva generale

core_fonts.css: font e simboli comuni

core_fascie.css: header/footer e safe area

[pagina].css: CSS specifico della pagina

Tabella Pagine / CSS:

Tipologia	Pagina	CSS di Riferimento
Auth Pages	index.html, registrati.html	core.css + core_fonts.css + accesso.css
Core Pages	impostazioni.html	core.css + core_fonts.css + core_fascie.css + impostazioni.css + core_ui.css
Moduli Gestionali	configurazione_generali.html	core.css + core_fonts.css + moduli.css

Comando Agente AI:

AGENTE AI:
Per [pagina.html]:
1. Controlla che siano inclusi solo i CSS autorizzati dalla tabella.
2. Nessun file obsoleto (operatore.css, fonts.css ecc.) deve essere presente.
3. Segnala eventuali CSS non consentiti.

2.3 Script Loading / Bootstrap JS

Spiegazione umana:

Tutte le pagine devono avere main.js come unico orchestratore.

I moduli specifici diventano passivi, espongono solo init[NomePagina](user).

L’inizializzazione è gestita da pages-init.js.

Esempi:

// login.js passivo
export async function initLogin() {
    setupLoginForm();
    setupLanguageSelector();
    setupPasswordToggle();
}

// pages-init.js
export async function initIndex() {
    const { initLogin } = await import('./modules/auth/login.js');
    await initLogin();
}


Comando Agente AI:

AGENTE AI:
Per [pagina.html]:
1. Verifica presenza di main.js in fondo al body.
2. Controlla che i moduli JS siano passivi e esportino solo init[NomePagina](user).
3. Nessuna chiamata top-level a initComponents() o initLockedUX() nei moduli.
4. Segnala moduli legacy auto-inizializzanti e rimuovi DOMContentLoaded o observeAuth.

2.4 HTML Refactoring e Classi Semantiche

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
1. Controlla che le classi semanticamente corrette siano presenti.
2. Controlla header/footer placeholder (#header-placeholder, #footer-placeholder).
3. Tutti i div, main e body devono avere classi base-bg, base-container, base-main.
4. Segnala elementi non conformi.

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

 Header/Footer placeholder presenti ✅

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