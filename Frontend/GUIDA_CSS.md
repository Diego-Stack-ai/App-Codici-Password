# GUIDA CSS - PROTOCOLLO BM SERVICE V3.9 (Pure HTML)

Questa guida definisce lo standard architettonico per la separazione tra struttura (HTML) e stile (CSS) nel progetto.

---

## 1) Principi Fondamentali V3.9

1.  **Zero Tailwind**: È vietato l'uso di qualsiasi classe di utility Tailwind (es. `flex`, `gap-4`).
2.  **Zero Inline Styles**: È vietato l'uso dell'attributo `style="..."`ed inline styles. Ogni stile deve essere definito in classi semantiche.
3.  **Zero Inline Logic**: È vietato l'uso di `onclick="..."`. Ogni interazione deve essere gestita tramite Event Listeners in JavaScript.
4.  **No !important**: È vietato l'uso del flag `!important` dove non strettamente necessario per override di librerie esterne.
5.  **Variabili CSS**: Tutti i colori, spaziature e layout devono basarsi sulle variabili definite in `core.css`.
6.  **Dual Theme**: Ogni componente deve essere testato sia in Dark Mode (default) che in Light Mode.

---

## 2) Architettura dei File

### 2.1) Struttura Modulare (V3.9)

I CSS sono suddivisi in 5 livelli gerarchici caricati in questo ordine preciso:

1.  **`core.css`**: Variabili di sistema, Reset, Utility globali (es. `.hidden`).
2.  **`core_fonts.css`**: Definizioni dei font (Manrope) e icone.
3.  **`core_fascie.css`**: Strutture fisse condivise (Header e Footer).
4.  **`core_pagine.css`**: **Libreria Universale**. Card, item, toggle, modali e stili della Home.
5.  **`core-transizione.css`**: Stili unici temporanei o in fase di migrazione.

### 2.2) Pagine "Contenuto" (Applicazione)
- **Header (Fascia Alta)**: Layout "Balanced" con 3 aree (SX: Back/Avatar, C: Titolo, DX: Home/Logout).
- **Hero Page Header (Internal)**: Varianti compatte della Hero Card per pagine interne.
    - Container: `.hero-page-header` (centrato).
    - Icon Box: `.hero-page-icon-box` (80x80px) con Glassmorphism (`backdrop-filter: blur(8px)`) e effetti Titanium (`.saetta-master`, `.saetta-drop`, `.border-glow`).
    - Title: `.hero-page-title` (letter-spacing 0.15em, uppercase).
    - Badge: `.badge-base` (pill shape, theme-aware).
- **Footer (Fascia Bassa)**: Layout "Balanced" (SX: Theme Switcher, DX: Settings).

### 2.3) Convenzione Prefissi: Protocollo "auth-" (V3.9)
Per evitare conflitti con codebase legacy, ogni nuova classe dedicata esclusivamente al flusso di accesso deve utilizzare il prefisso `auth-`.
- **Scopo**: Isolare lo stile del login/registrazione dal resto dell'app.
- **Utilizzo**: Usare per contenitori di link (`.auth-footer-links`), stati di progresso (`.is-auth-progress`) o elementi strutturali specifici del vault.

---

## 3) Gestione Multilingua (Cleanup V3.9)

L'applicazione utilizza un motore di traduzione centralizzato. Elementi target:
- `data-t="chiave"`: Contenuto testuale.
- `data-t-placeholder="chiave"`: Testo segnaposto negli input.
- `data-t-aria="chiave"`: Etichette di accessibilità.

---

## 4) Tipografia & Performance

### 4.1) Testata Standard (TASSATIVO)
Utilizzare esclusivamente la modularità V3.9 per caricare solo il CSS necessario nell'ordine corretto:

```html
<!-- 1. Core System (Variabili & Reset) -->
<link rel="stylesheet" href="assets/css/core.css?v=3.9">

<!-- 2. Fonts -->
<link rel="stylesheet" href="assets/css/core_fonts.css">

<!-- 3. Fasce (Header & Footer) -->
<link rel="stylesheet" href="assets/css/core_fascie.css">

<!-- 4. Shared Library (Componenti comuni) -->
<link rel="stylesheet" href="assets/css/core_pagine.css?v=1.0">

<!-- 5. Page Specific (Transizione) -->
<link rel="stylesheet" href="assets/css/core-transizione.css?v=1.0">
```

### 4.2) Animazioni & Routine CSP (TASSATIVO)
Per rispettare le policy di sicurezza (CSP) ed evitare blocchi del browser:
- **Vietato**: Uso di `style="--delay: 100ms"`.
- **Obbligatorio**: Usare le classi di utilità predefinite in `core.css`:
    - `.animate-in .fade-in`
    - `.animate-in .scale-in`
    - `.animate-in .slide-in-bottom`
    - Ritardi: `.delay-100`, `.delay-200`, `.delay-300`, `.delay-400`, `.delay-500`.

### 4.3) Nota Sviluppo (Live Server)
Per evitare errori CSP in console locale (`127.0.0.1`), il meta tag include l'hash `'sha256-vvt4KW...'` che autorizza lo script di Live Server.
In produzione questo hash è superfluo ma innocuo. Non rimuovere se si vuole mantenere la console pulita in dev.

---


---

## 6) Glassmorphism \u0026 Effetto "Vetro Satinato" (Best Practices V3.9)

### 6.1) Variabile Critica: `--card-bg`

La variabile `--card-bg` definita in `core.css` è il cuore dell'effetto glassmorphism utilizzato in:
- Header e Footer (`.base-header`, `.base-footer`)
- Card e contenitori (`.card`, `.card-hero`, `.matrix-card`)
- Modali e overlay

**Valore Ottimale per Dark Mode**:
```css
.dark {
    --card-bg: rgba(255, 255, 255, 0.02); /* Ultra-trasparente */
}
```

**Perché 0.02?**
- Valori troppo alti (es. `0.4`) creano una "patina" opaca che copre lo sfondo
- Valori troppo bassi (es. `0.01`) rendono invisibili i bordi e riducono la leggibilità
- `0.02` è il sweet spot: massima trasparenza mantenendo la percezione del vetro

### 6.2) Backdrop Filter: Il Vero Protagonista

L'effetto "satinato" NON deriva dal colore di sfondo, ma dal `backdrop-filter`:

```css
.base-header, .base-footer {
    background: var(--card-bg);           /* Colore minimo */
    backdrop-filter: blur(12px);          /* Effetto vetro */
    -webkit-backdrop-filter: blur(12px);  /* Safari */
}
```

**Regola d'Oro**: Più il background è trasparente, più il blur è visibile e premium.

### 6.3) Inizializzazione Tema: NO Hardcoded `class="dark"`

**❌ SBAGLIATO**:
```html
<html lang="it" class="dark">
```

**✅ CORRETTO**:
```html
<html lang="it" data-i18n="loading">
```

**Motivo**: La classe `dark` deve essere gestita dinamicamente da `theme-init.js` per:
- Rispettare le preferenze utente salvate
- Supportare la modalità "Auto" (segue sistema operativo)
- Evitare flash di contenuto non stilizzato (FOUC)

### 6.4) Ordine di Caricamento CSS: CRITICO

L'ordine di caricamento influenza la cascata CSS. **NON** invertire mai:

```html
<!-- ✅ ORDINE CORRETTO -->
<link rel="stylesheet" href="assets/css/core.css?v=3.9">
<link rel="stylesheet" href="assets/css/core_fonts.css">
<link rel="stylesheet" href="assets/css/core_fascie.css">

<!-- ❌ ORDINE SBAGLIATO (causa inconsistenze visive) -->
<link rel="stylesheet" href="assets/css/core_fonts.css">
<link rel="stylesheet" href="assets/css/core.css?v=3.9">
```

**Perché?** `core.css` definisce le variabili CSS. Se caricato dopo altri file, le variabili potrebbero non essere disponibili al momento del parsing.

### 6.5) Struttura Container: Evitare `position: relative` Non Necessario

**❌ SBAGLIATO**:
```html
<div class="base-container relative">
```

**✅ CORRETTO**:
```html
<div class="base-container">
```

**Motivo**: La classe `relative` può alterare lo stacking context e influenzare il rendering del `backdrop-filter` negli elementi `fixed` (come header/footer).

---

## 7) Audit di Consolidamento (Checklist Finale)
1. **Traduzione**: Ogni stringa testuale, placeholder e label ARIA usa un attributo `data-t`?
2. **Modularità**: I file CSS seguono l'ordine di caricamento standard?
3. **Pureness**: L'HTML è privo di Tailwind, stili inline e onclick?
4. **Theming**: La pagina è leggibile sia in modalità chiara che scura?
5. **Glassmorphism**: La variabile `--card-bg` usa valori ultra-trasparenti (`0.02`) in Dark Mode?
6. **Inizializzazione**: Il tema è gestito da `theme-init.js` e NON hardcoded nell'HTML?
7. **Container**: La struttura HTML evita classi `relative` non necessarie?

---

## 8) Pagine Migrate e Verificate (V3.9 Compliant)

Le seguenti pagine sono state auditate e certificate conformi al Protocollo V3.9:

- ✅ `home_page.html`
- ✅ `impostazioni.html`
- ✅ `privacy.html`
- ✅ `archivio_account.html`
- ✅ `regole_scadenze.html`
- ✅ `configurazione_automezzi.html`
- ✅ `configurazione_documenti.html`
- ✅ `configurazione_generali.html`

**Pagine Legacy (Richiedono Migrazione)**:
- ⚠️ `account_azienda.html` (usa `operatore.css`)
- ⚠️ `dettaglio_account_azienda.html` (usa `operatore.css`)
- ⚠️ `modifica_azienda.html` (usa `operatore.css`)

