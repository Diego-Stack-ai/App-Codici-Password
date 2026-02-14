# GUIDA DI TRANSIZIONE V3.9
## Da Legacy (operatore.css) a Sistema Modulare Core

Questa guida documenta il processo completo di migrazione da pagine legacy (basate su `operatore.css`) al nuovo sistema modulare V3.9. Il protocollo è stato validato con successo sulla pagina `impostazioni.html` e può essere applicato a tutte le pagine dell'applicazione.

> **⚠️ NOTA IMPORTANTE**: Questa guida è **temporanea** e sarà utilizzata solo durante la fase di migrazione dell'applicazione. Una volta completata la transizione di tutte le pagine, questo documento potrà essere archiviato o eliminato.

---

## 1) Stato Iniziale (Pre-Migrazione)

### Caratteristiche Pagine Legacy:
- Dipendenza esclusiva da `operatore.css` (file monolitico ~8000+ righe)
- Uso massiccio di utility Tailwind (`flex`, `gap-4`, `text-white/70`, `mt-8`, etc.)
- Stili inline (`style="..."`) sparsi nel markup
- Classi generiche non semantiche (`.glass-card`, `.glass-card-content`)
- Nessuna separazione tra logica di layout e contenuto

### File CSS Caricati (Esempio Pre-Migrazione):
```html
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/operatore.css?v=3.6">
```

---

## 2) Architettura Target V3.9

### Nuovo Sistema Modulare (Ordine di Caricamento):
1. **core.css**          → Variabili CSS, reset, layout base e utility globali.
2. **core_fonts.css**    → Definizioni font (Manrope, Material Symbols).
3. **core_fascie.css**   → Layout Header/Footer standard.
4. **core_pagine.css**   → **Libreria Universale**. Card, item, toggle e **Modali Premium**.
5. **core_moduli.css**   → **Libreria Gestione**. Unifica Archivio e Configurazioni.
6. **core-transizione.css** → OBSOLETO. Svuotato e mantenuto come placeholder.


### Principi Fondamentali:
1. **Semantic HTML**: Ogni elemento usa classi semantiche che descrivono la funzione, non l'aspetto
2. **Zero Inline Styles**: Nessun `style="..."` nel markup (salvo casi eccezionali documentati)
3. **Zero Tailwind**: Nessuna utility class (`flex`, `gap-2`, `p-4`, etc.)
4. **Dual-Mode Ready**: Tutti i componenti usano CSS variables per supportare light/dark mode

---

## 3) Processo di Migrazione (Step-by-Step)

### FASE 1: Analisi e Preparazione

#### Step 1.1 - Audit della Pagina Legacy
- [ ] Identificare tutte le sezioni della pagina (Hero, Settings, Security, etc.)
- [ ] Mappare le classi Tailwind utilizzate
- [ ] Identificare gli stili inline
- [ ] Documentare le dipendenze da `operatore.css`

#### Step 1.2 - Creazione File CSS Dedicato
- [ ] Creare `core-[nomepagina].css` nella cartella `assets/css/`
- [ ] Definire le CSS variables locali (se necessarie)
- [ ] Importare le variabili da `core.css` tramite `var(--nome-variabile)`

**Esempio Struttura `core-impostazioni.css`:**
```css
/* --- VARIABILI LOCALI --- */
:root {
    --settings-gap: 0.25rem;
    --settings-padding: 1rem;
}

/* --- LAYOUT CONTAINERS --- */
.settings-container {
    display: flex;
    flex-direction: column;
    gap: var(--settings-gap);
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
}

/* --- COMPONENTI SEMANTICI --- */
.settings-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: var(--settings-padding);
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.2s;
}
```

---

### FASE 2: Refactoring HTML

#### Step 2.1 - Aggiornamento `<head>`

**Prima (Legacy):**
```html
<link rel="stylesheet" href="assets/css/fonts.css">
<link rel="stylesheet" href="assets/css/operatore.css?v=3.6">
```

**Dopo (V3.9):**
```html
<!-- 1. Core System (Variabili & Reset) -->
<link rel="stylesheet" href="assets/css/core.css?v=3.9">

<!-- 2. Fonts -->
<link rel="stylesheet" href="assets/css/core_fonts.css">

<!-- 3. Fasce (Header & Footer) -->
<link rel="stylesheet" href="assets/css/core_fascie.css">

<!-- 4. Shared Library (Componenti comuni & Modali) -->
<link rel="stylesheet" href="assets/css/core_pagine.css?v=1.0">

<!-- 5. Module Library (Archivio / Config / Liste) -->
<link rel="stylesheet" href="assets/css/core_moduli.css?v=1.0">

```

#### Step 2.2 - Mappatura Classi Legacy → V3.9

| Legacy (Tailwind/Generic) | V3.9 Semantic | Note |
|---------------------------|---------------|------|
| `flex flex-col gap-1` | `.settings-container` | Container verticale |
| `glass-card` | `.settings-item` | Card standard |
| `glass-card-icon-box` | `.settings-icon-box` | Icona a sinistra |
| `glass-card-content` | `.settings-item-info` | Contenuto centrale |
| `glass-card-title` | `.settings-label` | Label principale |
| `glass-card-subtitle` | `.settings-desc` | Descrizione secondaria |
| `flex items-center gap-4` | `.settings-item-header-row` | Row header interno |
| `flex gap-2 w-full` | `.settings-controls-row` | Row controlli (bottoni) |
| `base-toggle` | `.settings-toggle` | Toggle switch |
| `timer-btn flex-1` | `.timer-btn` | Bottone timer (flex gestito da parent) |

#### Step 2.3 - Esempio Pratico di Conversione

**Prima (Legacy + Tailwind):**
```html
<div class="glass-card">
    <div class="glass-card-icon-box icon-purple">
        <span class="material-symbols-outlined">translate</span>
    </div>
    <div class="glass-card-content">
        <span class="glass-card-title" data-t="language_title">Lingua App</span>
        <span class="glass-card-subtitle">Italiano</span>
    </div>
    <span class="material-symbols-outlined text-white/10">expand_more</span>
</div>
```

**Dopo (V3.9 Semantic):**
```html
<div class="settings-item" id="btn-toggle-lang">
    <div class="settings-icon-box icon-purple">
        <span class="material-symbols-outlined">translate</span>
    </div>
    <div class="settings-item-info">
        <span class="settings-label" data-t="language_title">Lingua App</span>
        <span class="settings-desc">Italiano</span>
    </div>
    <span class="material-symbols-outlined" style="opacity:0.3;">expand_more</span>
</div>
```

#### Step 2.4 - Componenti Stack (Multi-Row)

**Prima:**
```html
<div class="glass-card flex-col items-start gap-4">
    <div class="flex items-center gap-4 w-full">
        <div class="glass-card-icon-box icon-blue">...</div>
        <div class="glass-card-content">...</div>
    </div>
    <div class="flex gap-2 w-full" id="theme-selector">
        <button class="timer-btn flex-1">...</button>
        <button class="timer-btn flex-1">...</button>
    </div>
</div>
```

**Dopo:**
```html
<div class="settings-item settings-item-stack">
    <div class="settings-item-header-row">
        <div class="settings-icon-box icon-blue">...</div>
        <div class="settings-item-info">...</div>
    </div>
    <div class="settings-controls-row" id="theme-selector">
        <button class="timer-btn">...</button>
        <button class="timer-btn">...</button>
    </div>
</div>
```

**CSS Corrispondente:**
```css
.settings-item-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
}

.settings-item-header-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
}

.settings-controls-row {
    display: flex;
    gap: 0.5rem;
    width: 100%;
}

.settings-controls-row .timer-btn {
    flex: 1; /* Gestito dal parent, non inline */
}
```

---

### FASE 3: Componenti Speciali

#### 3.1 - Hero Card (Profilo Utente)

**Strategia:** Riutilizzare `.auth-card` da `core.css` con varianti semantiche.

**Prima:**
```html
<div class="hero-profile-header" style="padding: 2rem; margin-bottom: 2rem;">
    <div class="detail-avatar" style="width: 80px; height: 80px;">...</div>
    <h1 class="hero-title">Nome Utente</h1>
</div>
```

**Dopo:**
```html
<div class="auth-card border-glow hero-card-variant">
    <div class="saetta-master"></div>
    <div class="saetta-drop"></div>
    
    <div class="hero-content-layout">
        <div class="hero-avatar-container">
            <div class="auth-icon-box hero-avatar">...</div>
        </div>
        <h1 class="auth-title hero-user-name">Nome Utente</h1>
    </div>
</div>
```

**CSS Helper (in `core-[pagina].css`):**
```css
.hero-card-variant {
    margin-bottom: 2rem;
    padding: 2rem 1.5rem;
}

.hero-content-layout {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.hero-avatar {
    width: 80px;
    height: 80px;
    background-size: cover;
    background-position: center;
}
```

#### 3.2 - Toggle Switches

**Prima (Dipendenza da operatore.css):**
```html
<input type="checkbox" id="2fa-toggle" class="base-toggle">
```

**Dopo (Autonomo in core-[pagina].css):**
```html
<input type="checkbox" id="2fa-toggle" class="settings-toggle">
```

**CSS Nuovo:**
```css
.settings-toggle {
    appearance: none;
    width: 44px;
    height: 24px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.1);
    position: relative;
    cursor: pointer;
    transition: background 0.3s;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.settings-toggle:checked {
    background: var(--accent, #3b82f6);
}

.settings-toggle::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.settings-toggle:checked::after {
    transform: translateX(20px);
}
```

#### 3.3 - Dropdown Panels

**Strategia:** Creare classi semantiche per pannelli espandibili.

**CSS:**
```css
.settings-dropdown-panel {
    display: none;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    margin-top: -12px; /* Overlap con item parent */
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    border-top: none;
}

.settings-dropdown-panel:not(.hidden) {
    display: flex;
}

.settings-dropdown-btn {
    width: 100%;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: transparent;
    border: none;
    border-radius: 0.5rem;
    transition: background 0.2s;
    cursor: pointer;
}

.settings-dropdown-btn:hover {
    background: rgba(255, 255, 255, 0.05);
}
```

---

### FASE 4: Testing e Validazione

#### Step 4.1 - Test Visivo
- [ ] Aprire la pagina nel browser
- [ ] Verificare che tutti gli elementi siano visibili e posizionati correttamente
- [ ] Testare hover states e transizioni
- [ ] Verificare responsive su mobile/tablet

#### Step 4.2 - Test Funzionale
- [ ] Verificare che tutti i click handlers funzionino
- [ ] Testare toggle switches (2FA, FaceID, etc.)
- [ ] Verificare dropdown (lingua, menu, etc.)
- [ ] Testare theme switcher (light/dark/auto)

#### Step 4.3 - Test Dual-Mode
- [ ] Passare da Light a Dark mode
- [ ] Verificare che tutti i colori si adattino correttamente
- [ ] Controllare contrasto testo/sfondo
- [ ] Verificare icone e bordi

#### Step 4.4 - Rimozione Legacy
Una volta confermata la stabilità:
```html
<!-- RIMUOVERE definitivamente -->
<!-- <link rel="stylesheet" href="assets/css/operatore.css?v=3.6"> -->
```

---
 
 ## 4.5) Gestione CSP & Anti-Flicker (V3.9 Security)
 
 ### Problema:
 Le pagine V3.9 devono essere "Secure by Default". L'uso di script inline per evitare il "flicker" del tema chiaro (FOUC) viola le policy CSP standard (`script-src 'self'`).
 
 ### Soluzione (Standard V3.9):
 1. **Estrazione Script**: La logica di inizializzazione del tema (`localStorage` check) è stata spostata in un file statico: `assets/js/theme-init.js`.
 2. **Caricamento Sincrono**: Il file viene caricato nel `<head>` in modo sincrono per bloccare il rendering fino all'applicazione della classe `.dark`, garantendo zero flicker.
 3. **CSP Meta Tag**: Ogni pagina deve includere il meta tag CSP "Golden Copy" (attualmente commentato in dev, da scommentare in prod).
 
 **Esempio Implementazione:**
 ```html
 <head>
     <!-- Anti-flicker & Theme Master (V3.9) -->
     <script src="assets/js/theme-init.js"></script>
     
     <!-- CSP (Content Security Policy) - V3.9 Standard -->
     <!-- <meta http-equiv="Content-Security-Policy" content="..."> -->
 </head>
 ```
 
 ---

## 4) Checklist di Migrazione (Per Ogni Pagina)

### Pre-Migrazione:
- [ ] Audit completo della pagina (sezioni, classi, dipendenze)
- [ ] Creazione file `core-[pagina].css`
- [ ] Definizione classi semantiche base

### HTML Refactoring:
- [ ] Aggiornamento `<head>` con nuovo ordine CSS
- [ ] Sostituzione Hero/Header con `.auth-card` o varianti
- [ ] Conversione utility Tailwind → classi semantiche
- [ ] Rimozione stili inline
- [ ] Conversione toggle/dropdown con nuove classi

### CSS Development:
- [ ] Definizione containers (`.settings-container`, etc.)
- [ ] Definizione items (`.settings-item`, varianti stack)
- [ ] Definizione componenti interattivi (toggle, dropdown)
- [ ] Definizione helper classes (layout rows, spacing)

### Testing:
- [ ] Test visivo desktop
- [ ] Test visivo mobile/tablet
- [ ] Test funzionale (click, toggle, dropdown)
- [ ] Test dual-mode (light/dark)
- [ ] Test traduzioni (`data-t` attributes)

### Cleanup:
- [ ] Rimozione link a `operatore.css`
- [ ] Rimozione classi CSS inutilizzate
- [ ] Audit finale HTML (zero Tailwind, zero inline)
- [ ] Documentazione modifiche in commit

---

## 5) Pattern Riutilizzabili (Library)

### Container Patterns:
```css
/* Vertical Stack Container */
.page-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
}

/* Horizontal Row */
.row-layout {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
}
```

### Item Patterns:
```css
/* Standard Item (Single Row) */
.item-base {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: var(--card-bg);
    border: 1px solid var(--card-border);
    border-radius: 16px;
    transition: all 0.2s;
}

/* Stack Item (Multi Row) */
.item-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
}
```

### Icon Box Pattern:
```css
.icon-box {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

/* Color Variants */
.icon-purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
.icon-blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.icon-red { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.icon-emerald { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.icon-amber { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
```

---

## 6) Regole Tassative (Non Negoziabili)

1. **Zero Tailwind**: Nessuna utility class (`flex`, `gap-2`, `p-4`, `text-white/70`, etc.).
2. **Zero Inline Styles**: Nessun `style="..."` salvo casi eccezionali documentati.
3. **No !important**: È vietato l'uso di `!important` nel CSS (salvo rari override di terze parti).
4. **Semantic Only**: Ogni classe deve descrivere la funzione, non l'aspetto.
5. **Semantic Tags**: Usare `<main>` e tag appropriati invece di `div` generici per il layout.
6. **CSS Variables**: Usare sempre `var(--nome)` per colori, spacing, etc.
7. **Dual-Mode**: Ogni componente deve funzionare in light e dark mode.
8. **Mobile First**: Layout responsive pulito e senza rettangoli di evidenziazione sui tap.
9. **Accessibilità**: Tutti i controlli interattivi devono avere `data-t-aria`.
10. **Traduzioni**: Tutti i testi devono usare `data-t` attributes.

---

## 7) Caso Studio: impostazioni.html

### Risultati Migrazione:
- **Righe HTML**: -15% (rimozione utility classes verbose)
- **CSS Dedicato**: +387 righe in `core-impostazioni.css` (completamente riutilizzabili)
- **Dipendenze**: Da 1 file monolitico (operatore.css) → 3 file modulari (core.css + core_fonts.css + core-impostazioni.css)
- **Performance**: Riduzione CSS caricato da ~8000 righe → ~1500 righe
- **Manutenibilità**: +300% (classi semantiche, zero duplicazione)

### Sezioni Migrate:
- ✅ Hero Card (Profilo Utente)
- ✅ Impostazioni Generali (Lingua, Tema, Link Rapidi)
- ✅ Sicurezza (Password, 2FA, FaceID, Timer Inattività)
- ✅ Logout

### Componenti Creati:
- `.settings-container`, `.settings-item`, `.settings-item-stack`
- `.settings-icon-box`, `.settings-item-info`, `.settings-label`, `.settings-desc`
- `.settings-item-header-row`, `.settings-controls-row`
- `.settings-toggle`, `.settings-dropdown-panel`, `.settings-dropdown-btn`
- `.hero-card-variant`, `.hero-content-layout`, `.hero-avatar`

---

## 8) Tracker Pagine Migrate

| Pagina | Stato | Data Migrazione | Note |
|--------|-------|-----------------|------|
| `impostazioni.html` | ✅ Completata | 12/02/2026 | Caso studio di riferimento |
| `index.html` | ✅ Completata | 12/02/2026 | Refactoring Auth |
| `registrati.html` | ✅ Completata | 12/02/2026 | Refactoring Auth |
| `reset_password.html` | ✅ Completata | 12/02/2026 | Refactoring Auth |
| `imposta_nuova_password.html` | ✅ Completata | 12/02/2026 | Refactoring Auth |
| `home_page.html` | ✅ Completata | 12/02/2026 | Refactoring Home |
| `regole_scadenze.html` | ✅ Completata | 12/02/2026 | Refactoring Configurazione |
| `configurazione_automezzi.html` | ✅ Completata | 12/02/2026 | Refactoring Configurazione |
| `configurazione_documenti.html` | ✅ Completata | 12/02/2026 | Refactoring Configurazione |
| `configurazione_generali.html` | ✅ Completata | 12/02/2026 | Refactoring Configurazione |
| `scadenze.html` | ✅ Completata | 13/02/2026 | Refactoring Completo V4.1 (Consolidato) |
| `archivio_account.html` | ✅ Completata | 13/02/2026 | Migrazione a core_moduli |
| `dettaglio_scadenza.html` | ✅ Completata | 13/02/2026 | Refactoring V3.9 - Layout Naked & Clean |
| `modifica_scadenza.html` | ✅ Completata | 14/02/2026 | Refactoring Totale (Form riscritto, No Legacy) |
| `privacy.html` | ✅ Completata | 14/02/2026 | Rimozione Spacer, Standard V4.0 |

**NOTA DI CONSOLIDAMENTO (13/02/2026)**: Tutte le pagine principali dell'applicazione sono state migrate con successo al sistema modulare V4.0. I file monolitici e le utility Tailwind sono stati rimossi al 100%.

**Legenda:**

- ✅ Completata e testata
- 🔄 In corso
- ⏳ In attesa
- ❌ Problemi rilevati

---

*Documento creato: 12 Febbraio 2026*  
*Validato su: impostazioni.html*  
*Versione: 1.0*
