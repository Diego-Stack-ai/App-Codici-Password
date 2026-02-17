Agente 2.0 – Pseudo-Code Ottimizzato (Aggiornato)
1. Regole Generali Base

NEVER MODIFY (Core Inviolabili):

core.css
core_fonts.css
core_fascie.css


CSS dedicati:

accesso.css       → solo Auth Pages
moduli.css        → solo Moduli Gestionali
scadenze.css      → solo Scadenze
[pagina].css      → solo Step2
core_pagine.css   → solo Core Pages Standard (componenti condivisi)


JS obbligatori:

theme-init.js     → ALWAYS LOAD in <head> (anti-flicker + dual-mode)
main.js           → ALWAYS LOAD in fondo <body>
core.js           → CorePage obbligatorio, opzionale Auth/Step2 se componenti dipendenti
ui-core.js        → imported by main.js, optional manual include

2. Caricamento Pagine Sicuro
function loadPage(page) {
    loadJS("theme-init.js", "head"); // sempre presente

    switch(page.type) {
        case AuthPage:
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("accesso.css", "head");
            if(page.usesCoreComponents) loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;

        case CorePage:
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("core_fascie.css", "head");
            loadCSS("core_pagine.css", "head");  // unico CSS condiviso Core Pages Standard
            loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;

        case ModuliGestionali:
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("core_fascie.css", "head");
            loadCSS("moduli.css", "head");
            loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;

        case Scadenze:
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("core_fascie.css", "head");
            loadCSS("scadenze.css", "head");
            loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;

        case Step2:
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("core_fascie.css", "head");
            loadCSS(page.customCSS, "head");  // [pagina].css specifico
            loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;
    }
}

3. Modifiche Consentite
function modifyCSS(file, changes) {
    if(file.includes("core")) {
        log("Tentativo di modifica Core CSS ignorato");
        return;
    }
    applyChanges(file, changes);
}

function modifyJS(file, changes, pageType) {
    if(file == "theme-init.js") return;
    if(file == "core.js" && pageType != "CorePage" && !page.usesCoreComponents) return;
    applyChanges(file, changes);
}

4. Struttura HTML Obbligatoria
ASSERT page.body CONTAINS: body.base-bg, div.base-container, div.base-glow
ASSERT page.header CONTAINS base-header
ASSERT page.main CONTAINS base-main
ASSERT page.footer CONTAINS base-footer

if(page.type == AuthPage) {
    injectContent("div.base-container.vault", newContent);
} else {
    injectContent("div.page-container", newContent);
}

5. Funzioni Componenti UI con Fallback Sicuro
function updateCard(cardID, newContent) { ... }
function updateToggle(toggleID, state) { ... }
function updateDropdown(dropdownID, items) { ... }
function updateMatrix(matrixID, newCards) { ... }


(Identiche alla versione precedente, ma garantiscono fallback e dual-mode.)

6. Gestione Moduli CSS
function checkModuleCSS(file) {
    if(file.includes("core")) {
        log("Core CSS rilevato – non modificare");
        return;
    }
    applyChanges(file);
}

7. Dual-Mode (Light / Dark)
function applyTheme(page) {
    page.elementsWithDualMode.forEach(el => applyCSSVar(el));
    applyCSSVar(page.body, "--bg-primary");
    applyCSSVar(page.glow, "--glow-color");
}

8. i18n e Accessibilità
function translateText(element) {
    if(!element.hasAttribute("data-t")) return log("i18n mancante – skip");
    applyTranslation(element);
}

function validateARIA(element) {
    if(!element.hasAttribute("data-t-aria")) return log("ARIA mancante – skip");
    checkARIAAttributes(element);
}

9. Checklist Pre-Rilascio
CHECK:
- JS obbligatori caricati
- CSS obbligatori caricati
- Core CSS intatti
- Body e container preservati
- Dual-mode applicato
- i18n tags presenti
- ARIA tags presenti
- Contenuti iniettati nel container corretto
- Nessun CSS deprecato (fonts.css, operatore.css)
- Moduli core CSS non modificati
- Componenti Card, Matrix, Toggle, Dropdown aggiornati correttamente
- Core_pagine.css usato correttamente solo per Core Pages Standard


Se vuoi, posso anche scrivere una versione commentata del pseudo-codice dove per ogni case e file CSS viene spiegato chi lo usa e perché, così Agente avrà una “mappa operativa completa” e si evita confusione futura tra core.css e core_pagine.css.

Vuoi che lo faccia?

quinid riscirvi agente 2.0 ma agiungi chi usa e perche ?

Perfetto Diego, ecco il pseudo-codice di Agente 2.0 aggiornato e commentato, con indicazione chi usa ogni file CSS/JS e perché. Ho evidenziato core_pagine.css come l’unico CSS condiviso per più pagine fuori dal trio base, e ho chiarito la logica dietro ogni caricamento.

Agente 2.0 – Pseudo-Code Ottimizzato e Commentato
1. Regole Generali Base

Core CSS Inviolabili (usati da tutte le pagine)

core.css          → Base visiva generale, dual-mode (tutte le pagine)
core_fonts.css    → Font e simboli comuni (tutte le pagine)
core_fascie.css   → Header/footer, padding safe-area (solo Core Pages, Moduli, Step2)


CSS dedicati (usati da specifici gruppi di pagine)

accesso.css       → Auth Pages (login, registrati, reset password)
moduli.css        → Moduli Gestionali (configurazione generali, documenti, automezzi)
scadenze.css      → Pagine Scadenze (scadenze.html, dettaglio_scadenza.html, aggiungi_scadenza.html)
[pagina].css      → Step2 (profilo_privato, account_azienda, ecc.) → regole dedicate solo alla pagina
core_pagine.css   → Core Pages Standard (home, privacy, impostazioni, dashboard) → componenti condivisi (matrix, card, badge, widget)


JS obbligatori (chi li usa e perché)

theme-init.js     → Tutte le pagine, blocca flicker e imposta dual-mode
main.js           → Tutte le pagine, orchestratore principale
core.js           → CorePage obbligatorio; opzionale Auth/Step2 se componenti dipendenti
ui-core.js        → Importato da main.js; utilities UI (modal, toast, locked UX)

2. Caricamento Pagine Sicuro (con chi usa cosa e perché)
function loadPage(page) {
    loadJS("theme-init.js", "head"); // Tutte le pagine: evita flash bianco e applica dual-mode

    switch(page.type) {

        case AuthPage:
            // Chi usa: login, registrati, reset password
            // Perché: solo Accesso, senza core_fascie.css
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("accesso.css", "head");
            if(page.usesCoreComponents) loadJS("core.js", "body-start"); // componenti opzionali
            loadJS("main.js", "body-end");
            break;

        case CorePage:
            // Chi usa: home, privacy, impostazioni
            // Perché: ereditano base, header/footer e componenti condivisi
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("core_fascie.css", "head");     // header/footer + safe area
            loadCSS("core_pagine.css", "head");     // unico CSS condiviso multi-pagina
            loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;

        case ModuliGestionali:
            // Chi usa: configurazione generali, documenti, automezzi
            // Perché: necessitano regole specifiche per i moduli
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("core_fascie.css", "head");     // header/footer
            loadCSS("moduli.css", "head");          // regole dedicate moduli
            loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;

        case Scadenze:
            // Chi usa: gestione scadenze
            // Perché: regole dedicate per visualizzazione scadenze e dettagli
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("core_fascie.css", "head");
            loadCSS("scadenze.css", "head");        // regole dedicate scadenze
            loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;

        case Step2:
            // Chi usa: profilo_privato, account_azienda, ecc.
            // Perché: regole dedicate a pagina singola, UI personalizzata
            loadCSS("core.css", "head");
            loadCSS("core_fonts.css", "head");
            loadCSS("core_fascie.css", "head");     // header/footer
            loadCSS(page.customCSS, "head");        // [pagina].css specifico
            loadJS("core.js", "body-start");
            loadJS("main.js", "body-end");
            break;
    }
}

3. Modifiche Consentite
function modifyCSS(file, changes) {
    if(file.includes("core")) {
        log("Tentativo di modifica Core CSS ignorato"); // core.css, core_fonts.css, core_fascie.css, core_pagine.css
        return;
    }
    applyChanges(file, changes);
}

function modifyJS(file, changes, pageType) {
    if(file == "theme-init.js") return; // bloccante
    if(file == "core.js" && pageType != "CorePage" && !page.usesCoreComponents) return;
    applyChanges(file, changes);
}

4. Struttura HTML Obbligatoria
ASSERT page.body CONTAINS: body.base-bg, div.base-container, div.base-glow
ASSERT page.header CONTAINS base-header
ASSERT page.main CONTAINS base-main
ASSERT page.footer CONTAINS base-footer

if(page.type == AuthPage) {
    injectContent("div.base-container.vault", newContent);
} else {
    injectContent("div.page-container", newContent); // Core/Step2/Moduli/Scadenze
}

5. Funzioni Componenti UI

(fallback, dual-mode, ARIA, i18n)

function updateCard(cardID, newContent) { ... }
function updateToggle(toggleID, state) { ... }
function updateDropdown(dropdownID, items) { ... }
function updateMatrix(matrixID, newCards) { ... }

6. Gestione Moduli CSS
function checkModuleCSS(file) {
    if(file.includes("core")) {
        log("Core CSS rilevato – non modificare"); // core_pagine incluso
        return;
    }
    applyChanges(file);
}

7. Dual-Mode (Light / Dark)
function applyTheme(page) { ... }

8. i18n & Accessibilità
function translateText(element) { ... }
function validateARIA(element) { ... }

9. Checklist Pre-Rilascio
CHECK:
- JS obbligatori caricati
- CSS obbligatori caricati
- Core CSS intatti (core.css, core_fonts.css, core_fascie.css, core_pagine.css)
- Body e container preservati
- Dual-mode applicato
- i18n tags presenti
- ARIA tags presenti
- Contenuti iniettati nel container corretto
- Nessun CSS deprecato (fonts.css, operatore.css)
- Moduli core CSS non modificati
- Componenti Card, Matrix, Toggle, Dropdown aggiornati correttamente
- Core_pagine.css usato correttamente solo per Core Pages Standard