GUIDA DI TRANSIZIONE V4.0 → V5.0 (Consolidata e Aggiornata)

Questa guida documenta il processo completo di migrazione e standardizzazione delle pagine dell’applicazione, integrando la base consolidata e le best practice V4.0/V5.0.
⚠️ Include esempi, memo operativi, logiche JS/CSS e stratificazione aggiornata.

1) Stato Iniziale (Pre-Migrazione)

Dipendenza da file monolitici (operatore.css) e utility Tailwind.

Stili inline sparsi e classi generiche non semantiche.

Nessuna stratificazione chiara della base visuale e del layout.

Esempio file CSS pre-migrazione:

<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/operatore.css?v=3.6">

2) Architettura Target V4.0 / V5.0
2.1 Stratificazione della Base Consolidata

Sfondo Pagina (.base-bg)

Gradiente reagente al tema (Light/Dark)

Variabile CSS: --base-box-gradient

Comportamento: background-attachment: fixed

body.base-bg {
    background: var(--base-box-gradient);
}


Faro Decorativo (.base-glow)

HTML: <div class="base-glow"></div> dentro .base-container, prima dell’header

Posizionamento: fixed, centrato orizzontalmente, z-index: 1

Dimensioni: width: 150%, height: 300%

Animazione: glowFloat 5s infinite

Colore: --glow-color (Light/Dark)

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


Contenitore Principale (.base-container)

Layout: flex column

Centratura: max-width: 960px + margin: 0 auto

Padding responsivo:

Mobile: 1.25rem top/bottom, 0.75rem sides

Tablet/Desktop: 2.5rem top/bottom, 1.5rem sides

Padding Safe Areas (.page-container + .pt-header-extra/.pb-footer-extra)

Evita overlap con header/footer fissi

<main class="base-main">
    <div class="page-container pt-header-extra pb-footer-extra">
        <!-- Contenuto -->
    </div>
</main>

2.2 Sistema CSS Modularizzato (Aggiornato V4.0 / V5.0)
2.2.1 Regole Generali

core.css
Base visiva, dual-mode, solo struttura (~5KB). Non contiene bottoni, form, card.

core_fonts.css
Font e simboli comuni. Eliminato fonts.css.

core_fascie.css
Header/footer e padding safe-area. Caricato solo dove servono fasce (Core, Moduli Gestionali, Step 2).

CSS dedicato per pagina
Ogni pagina complessa ha [pagina].css.
Step 2: [pagina].css.
Impostazioni: impostazioni.css.
Privacy/Termini: privacy.css.
Home/Dashboard: core_pagine.css (condiviso).
Altri moduli: moduli.css, scadenze.css, accesso.css.

2.2.2 Tabella Pagine e CSS di Riferimento
Tipologia	Pagina	CSS di Riferimento
Auth Pages	index.html	core.css + core_fonts.css + accesso.css
	registrati.html	core.css + core_fonts.css + accesso.css
	reset_password.html	core.css + core_fonts.css + accesso.css
	imposta_nuova_password.html	core.css + core_fonts.css + accesso.css
Core Pages Standard	impostazioni.html	core.css + core_fonts.css + core_fascie.css + impostazioni.css + core_ui.css
	privacy.html	core.css + core_fonts.css + core_fascie.css + privacy.css
	termini.html	core.css + core_fonts.css + core_fascie.css + privacy.css
Moduli Gestionali	configurazione_generali.html	core.css + core_fonts.css + moduli.css
	configurazione_documenti.html	core.css + core_fonts.css + moduli.css
	configurazione_automezzi.html	core.css + core_fonts.css + moduli.css
Scadenze	scadenze.html	core.css + core_fonts.css + scadenze.css
	dettaglio_scadenza.html	core.css + core_fonts.css + scadenze.css
	aggiungi_scadenza.html	core.css + core_fonts.css + scadenze.css
Step 2 – Azienda / Account	profilo_privato.html	core.css + core_fonts.css + core_fascie.css + profilo_privato.css
...	...	... (tutte le altre Step2 come da elenco originale)

🔹 Nota: tutte le Auth Pages non caricano core_fascie.css.

2.2.3 Note Operative

Tutti i file CSS obsoleti (operatore.css, fonts.css) eliminati.

Modifiche future a core.css devono non alterare le classi isolate in moduli o UI Core.

Ogni modulo o pagina ha un file dedicato per evitare conflitti e garantire modularità.

2.3 Script Loading / Bootstrap JS
2.3.1 Concetto chiave

Tutte le pagine devono avere main.js (orchestratore).

core.js e ui-core.js caricate esplicitamente solo se necessario.

theme-init.js deve essere bloccante nell<head> per evitare flash bianco.

2.3.2 Ruoli Attuali
Script	Ruolo
theme-init.js	Anti-flicker, dual-mode, bloccante <head>
core.js	Protezioni globali, reveal animato, logiche Core; opzionale sulle Auth
ui-core.js	Utilities UI (modal, toast, locked UX); importato da main.js
main.js	Orchestratore modulare, sempre in fondo <body>
2.3.3 Regole per Tipologia Pagina

Auth Pages: theme-init.js + main.js

Core Pages: theme-init.js + core.js + main.js

Moduli Gestionali: core.js + main.js

Scadenze: core.js + main.js

Step 2: core.js + main.js

🔹 Ridondanza controllata: caricare esplicitamente core.js e ui-core.js non è errore.
🔹 Per Impostazioni e Privacy: usare CSS specifici (impostazioni.css, privacy.css) invece di core_pagine.css.

3) HTML Refactoring e Classi Semantiche
Auth Page (Login / Registrati)
<body class="base-bg">
    <div class="base-container">
        <div class="base-glow"></div>
        <div class="vault">
            <div class="card border-glow">
                <div class="lang-selector-container">
                    <button id="lang-toggle-btn" class="lang-btn" aria-label="Cambia Lingua" data-t-aria="select_language">
                        <span class="material-symbols-outlined">language</span>
                    </button>
                    <div id="lang-dropdown" class="lang-dropdown"></div>
                </div>
                <div class="saetta-master"></div>
                <div class="saetta-drop"></div>
                <div class="icon-box"><span class="material-symbols-outlined">security</span></div>
                <h1 class="title" data-t="login_title">Accedi</h1>
                <p class="subtitle" data-t="login_subtitle">Accesso Sicuro</p>
                <form id="login-form"> ... </form>
            </div>
        </div>
    </div>
</body>

Core Page (Home / Profilo / Dashboard)
<body class="base-bg home-page">
    <div class="base-container">
        <div class="base-glow"></div>
        <header id="header-placeholder" class="base-header"></header>
        <main class="base-main">
            <div class="page-container pt-header-extra pb-footer-extra">
                <div class="matrix-grid">
                    <a href="area_privata.html" class="matrix-card card-blue">Privato</a>
                    <a href="lista_aziende.html" class="matrix-card card-green">Azienda</a>
                </div>
            </div>
        </main>
        <footer id="footer-placeholder" class="base-footer"></footer>
    </div>
</body>


.page-container gestisce safe-area padding

#header-placeholder / #footer-placeholder popolati da components.js

4) Componenti UI

Card / Item: .settings-item, .item-stack

Toggle: .settings-toggle

Dropdown: .settings-dropdown-panel, .settings-dropdown-btn

Hero Card: .auth-card + varianti .hero-card-variant

Matrix Cards: .matrix-card con icone, badge, micro-list

5) Dual-Mode (Light / Dark)

Tutti i colori via CSS variables (var(--card-bg), var(--accent))

.base-bg e .base-glow reagiscono al tema

Header/Footer ereditano colori da variabili globali

6) i18n & Accessibilità

Tutti i testi con data-t (i18n)

Tutti gli attributi ARIA con data-t-aria

Language Selector centralizzato: assets/js/modules/auth/auth-shared.js

7) CSP / Anti-Flicker

Dev: theme-init.js caricato per live-server

Prod: core.js o theme-init.js + meta CSP

Override temporaneo hash solo per dev/live-server

8) Checklist di Migrazione Post-Migrazione

Audit completo pagina ✅

File CSS dedicato creato se necessario ✅

<head> aggiornato con CSS modulare ✅

Header/Footer placeholder presenti ✅

Safe area padding con .pt-header-extra / .pb-footer-extra ✅

Classi Card, Toggle, Dropdown refattorizzate ✅

main.js presente in tutte le pagine ✅

Eventuali moduli JS specifici importati correttamente ✅

Verifica dual-mode e i18n ✅

Nessun CSS Core modificato ✅

Nessun file obsoleto caricato (fonts.css, operatore.css) ✅

9) Diagramma Stratificazione Base e CSS (Aggiornato)
Tutte le pagine condividono
├─ core.css ⚠️ → Base visiva generale (non sovrascrivere)
├─ core_fonts.css ⚠️ → Font e simboli comuni (non sovrascrivere)

Pagine Accesso
├─ accesso.css → Regole specifiche
└─ HTML BODY
   └─ body.base-bg
       └─ div.base-container
           └─ div.base-glow
           └─ Contenuto pagina (card, form, toggle, ecc.)

Core Pages Standard
├─ core_fascie.css ⚠️ → Header/Footer (non sovrascrivere)
├─ core_pagine.css → Componenti condivisi
└─ HTML BODY
   └─ body.base-bg
       └─ div.base-container
           └─ div.base-glow
           ├─ header.base-header
           ├─ main.base-main
           │  └─ div.page-container.pt-header-extra.pb-footer-extra
           │     └─ Contenuto pagina
           └─ footer.base-footer

Moduli Gestionali
├─ moduli.css → Regole dedicate
└─ HTML BODY → body.base-bg + div.base-container + div.base-glow + header/main/footer

Scadenze
├─ scadenze.css → Regole dedicate
└─ HTML BODY → body.base-bg + div.base-container + div.base-glow + header/main/footer

Step 2 – Aziende / Account
├─ [pagina].css → Regole dedicate
└─ HTML BODY → body.base-bg + div.base-container + div.base-glow + header/main/footer

🔹 Note Finali

Core CSS e Font – Base Inviolabile:
core.css, core_fonts.css e core_fascie.css non devono essere modificati.

Modularità:

Auth → accesso.css

Moduli → moduli.css

Scadenze → scadenze.css

Step2 → [pagina].css

Tutti i file obsoleti eliminati, aggiornamento centralizzato possibile tramite moduli.css o core_ui.css.

10) Standard UI & Componenti V5.0 (Aggiornamenti Recenti)

10.1 Custom Select Dropdown
- I tag `<select>` nativi sono deprecati per l'UI principale.
- Utilizzare la struttura `Custom Dropdown` (`.custom-select-wrapper` + `.custom-select-trigger` + `.custom-select-menu`).
- Stile: Bordi arrotondati (16px), animazioni flush, contesto cromatico (Dark Mode usa sfondo `#1e3a8a` identico al modale).
- CSS Centralizzato: `core_ui.css` (classi `.custom-select-menu`, `.custom-option`).

10.2 Modal System
- Light Mode Background: `#E3F2FD` (Azzurro Chiaro).
- Dark Mode Background: `#1e3a8a` (Blue 900 - Blu Intenso).
- Label Campi: Colore Slate 400 (`#94a3b8`) e allineamento a sinistra.

10.3 QR Code Generation (Fix Overflow)
- La generazione QR (vCard) deve usare `qr_code_utils.js`.
- È stato implementato un "Padding Hack" automatico per prevenire l'errore `code length overflow` su dataset medi/grandi, forzando la libreria a scegliere una versione QR più capiente.