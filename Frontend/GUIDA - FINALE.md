GUIDA DI TRANSIZIONE V4.0 (Consolidata e Aggiornata)

Questa guida documenta il processo completo di migrazione e standardizzazione delle pagine dell’applicazione, integrando la base consolidata e le best practice V4.0.

⚠️ Nota: Questa versione aggiornata integra esempi completi, concetti chiave, stratificazione della base e logiche JS/CSS.

1) Stato Iniziale (Pre-Migrazione)

Dipendenza da file monolitici (operatore.css) e utility Tailwind.

Stili inline sparsi e classi generiche non semantiche.

Nessuna stratificazione chiara della base visuale e del layout.

File CSS caricati (esempio pre-migrazione)
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/operatore.css?v=3.6">

2) Architettura Target V4.0
2.1 Stratificazione della Base Consolidata

Sfondo Pagina (.base-bg)

Gradiente reagente al tema (Light/Dark).

Variabile CSS: --base-box-gradient

Comportamento: background-attachment: fixed

body.base-bg {
    background: var(--base-box-gradient);
}


Faro Decorativo (.base-glow)

HTML: <div class="base-glow"></div> all’interno di .base-container, prima dell’header.

Posizionamento: fixed, centrato orizzontalmente.

Z-index: 1

Dimensioni: width 150%, height 300%

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
    background: var(--glow-color); /* Gradiente reattivo */
    pointer-events: none;
    animation: glowFloat 5s ease-in-out infinite;
}


Contenitore Principale (.base-container)

Layout: flex column

Centratura: max-width 960px + margin: 0 auto

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

2.2 Sistema CSS Modularizzato
File	Contenuto/Scopo
core.css	Base visiva, variabili CSS, reset globale
core_fonts.css	Definizione font e simboli
core_fascie.css	Header/Footer comuni, padding safe-area
core_pagine.css	Componenti condivisi (card, item, toggle, dropdown)
core_moduli.css	Componenti gestionali (liste, archivio, configurazioni)
core-[pagina].css	Componenti dedicati alla pagina specifica
2.3 Script Loading / Bootstrap JS

2.3.1 Concetto chiave
Tutte le pagine devono avere un orchestratore JS: `main.js`.
`main.js` decide cosa attivare in base al contesto: **Auth pages** (login, registrati, reset password) o **Core pages** (home, profilo, dashboard).

Non è sempre necessario caricare manualmente `core.js` o `ui-core.js` se `main.js` li importa e inizializza, ma possono essere caricati esplicitamente per sicurezza in casi specifici (es. Core pages complesse).

**Anti-flicker e tema**: `theme-init.js` deve essere sempre caricato bloccante nell'`<head>`, perché inizializza il tema prima del rendering della pagina evitando il flash bianco.

2.3.2 Realtà attuale & Ruoli

Esempio reale (`profilo_privato.html`):
```html
<script src="assets/js/theme-init.js"></script>
<script src="assets/js/core.js"></script>
<script type="module" src="assets/js/ui-core.js"></script>
<script type="module" src="assets/js/main.js"></script>
```

Ruoli specifici:
*   **`theme-init.js`**: (Bloccante) Gestisce Anti-flicker e inizializza il tema (Light/Dark) immediatemente.
*   **`core.js`**: (IIFE) Gestisce protezioni globali, reveal animato e logiche di sistema. Caricabile prima di `main.js` per sicurezza. Necessario su Core pages; opzionale sulle Auth pages se `theme-init.js` già gestisce il tema.
*   **`ui-core.js`**: (Modulo) Importato da `main.js`. Contiene utilities UI condivise (toast, modal, locked UX). Non serve inserirlo manualmente salvo test separati.
*   **`main.js`**: (Modulo Orchestratore) Sempre caricato in fondo al body con `type="module"`. Gestisce:
    *   Check pagina (Auth / Core)
    *   Bootstrapping moduli (`ui-core`, `auth-shared`, ecc.)
    *   Eventi comuni (toast, locked UX, ecc.)

2.3.3 Regole operative per Tipologia Pagina

**Auth Pages** (login, registrati, reset password):
*   Caricano `theme-init.js` (Head) + `main.js` (Body End).
*   Non serve caricare `core.js` pesante o CSS non necessari.
*   Devono essere leggere e veloci, con tema coerente già inizializzato da `theme-init.js`.

**Core Pages** (home, profilo, dashboard, ecc.):
*   Caricano `theme-init.js` (Head) + `core.js` (Body Start/End) + `main.js` (Body End).
*   Caricano CSS completi (`core_fascie.css`, `core_pagine.css`, etc).
*   `core.js` è consigliato esplicitamente per garantire l'inizializzazione robusta del tema e delle protezioni extra.

2.3.4 Esempi HTML Consigliati

**Auth Page (Login / Registrati)**
```html
<head>
  <!-- Anti-flicker / Theme Init -->
  <script src="assets/js/theme-init.js"></script>
</head>
<body>
  <!-- Contenuto pagina -->

  <!-- Scripts -->
  <script type="module" src="assets/js/main.js"></script>
</body>
```

**Core Page (Home / Profilo / Dashboard)**
```html
<head>
  <!-- Anti-flicker / Theme Init -->
  <script src="assets/js/theme-init.js"></script>
</head>
<body>
  <!-- Contenuto pagina -->

  <!-- Scripts -->
  <script src="assets/js/core.js"></script>
  <script type="module" src="assets/js/main.js"></script>
</body>
```

2.3.5 Note Importanti
*   **Ridondanza controllata**: Caricare esplicitamente `core.js` e `ui-core.js` non è un errore; serve sicurezza extra su Core pages complesse.
*   **Flessibilità Dev vs Prod**: In Dev puoi lasciare tutto esplicito per debugging. In Prod, carica solo quello necessario, mantenendo `theme-init.js` bloccante e `main.js` alla fine.
*   **Consistenza tema**: Tutte le pagine (Auth e Core) devono usare le stesse variabili CSS e logiche di `theme-init.js` per garantire uniformità Light/Dark.

3) HTML Refactoring e Classi Semantiche

Esempio login (Auth page):

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


.vault → contenitore centrale della card

.card → card standard, semantica

.icon-box → icona centrale

.lang-selector-container → Language Selector

.saetta-master / .saetta-drop → decorazioni

3.1 Pagine Core (es. home_page.html)
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


#header-placeholder / #footer-placeholder popolati da components.js

.page-container gestisce safe-area padding e layout centrato

4) Componenti UI

Card / Item: .settings-item, .item-stack

Toggle: .settings-toggle

Dropdown: .settings-dropdown-panel / .settings-dropdown-btn

Hero Card: .auth-card + varianti .hero-card-variant

Matrix Cards: .matrix-card con icone, badge, micro-list

5) Dual-Mode (Light / Dark)

Tutti i colori usano CSS variables (var(--card-bg), var(--accent))

.base-bg e .base-glow reagiscono al tema

Header/Footer ereditano colori da variabili globali

6) i18n

Tutti i testi devono usare attributi `data-t` per le chiavi di traduzione.

Attributi aria/accessibilità: usare `data-t-aria`.

**Language Selector**:
*   Centralizzato nel modulo `assets/js/modules/auth/auth-shared.js`.
*   Tutte le pagine Auth (`login`, `registrati`, `reset`) devono importare `setupLanguageSelector` da questo modulo.
*   Evitare duplicazioni della logica di cambio lingua nei singoli file JS.

7) CSP / Anti-Flicker

Dev: theme-init.js caricato per evitare errori live-server

Prod: usare core.js o theme-init.js + meta CSP completo

Live-server richiede momentaneo override hash per evitare blocco

8) Checklist di Migrazione
Pre-Migrazione

 Audit completo della pagina

 Creazione file CSS dedicato se serve (core-[pagina].css)

HTML Refactoring

 Aggiornamento <head> con CSS modulare

 Header/Footer placeholder

 Safe area padding con .pt-header-extra / .pb-footer-extra

 Conversione card, toggle, dropdown

JS / Funzionalità

 main.js presente in tutte le pagine

 auth.js per Auth pages

 UI modules specifici (login.js, registrati.js)

Testing

 Visual desktop/mobile

 Funzionale click/toggle/dropdown

 Dual-mode check

 Traduzioni / i18n

9) Diagramma Stratificazione Base
BODY.base-bg
 └─ DIV.base-container
     ├─ DIV.base-glow
     ├─ HEADER#header-placeholder.base-header
     ├─ MAIN.base-main
     │   └─ DIV.page-container.pt-header-extra.pb-footer-extra
     │       └─ Contenuto pagina
     └─ FOOTER#footer-placeholder.base-footer
