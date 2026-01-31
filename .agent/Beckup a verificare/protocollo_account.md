---
description: Protocollo Standard Titanium Account V3.0 (Stability & Maintenance Focus)
---

# Titanium Account V3.0 (The Pragmatic Standard)
> **Baseline Ufficiale**: Questo protocollo, insieme agli altri presenti in `.agent/workflows/`, costituisce l'unica fonte di istruzioni da seguire per lo sviluppo delle pagine relative alla gestione degli account privati e aziendali. Viene stabilito che la stabilità operativa, il cache busting e l'uso di componenti centralizzati hanno priorità assoluta su qualsiasi purismo CSS.

## 1. Ambito di Applicazione
Questo protocollo governa le pagine di gestione delle credenziali e degli account (Dashboard e Archivi):
1. `home_page.html` (Dashboard Principale)
2. `account_privati.html` (Lista Account Personali)
3. `area_privata.html` (Hub Privato)
4. `aggiungi_account_privato.html` (Nuovo Account Privato)
5. `dettaglio_account_privato.html` (Dettaglio/Modifica Privato)
6. `lista_aziende.html` (Archivio Aziende)
7. `account_azienda.html` (Lista Credenziali Azienda)
8. `aggiungi_account_azienda.html` (Nuovo Account Aziendale)
9. `dettaglio_account_azienda.html` (Dettaglio/Modifica Aziendale)

### 1.1 CSS di Riferimento Unico
**L'unico e solo file CSS** per gestire tutte le pagine sopra elencate è:
- **`assets/css/auth_account.css`**

Questo file è *completamente autonomo* e contiene tutti gli effetti, componenti e stili necessari per le pagine di gestione account.

**NON** deve essere utilizzato `titanium.css` o altri file CSS nelle pagine di account. Questa separazione garantisce:
- Performance ottimali (caricamento rapido)
- Indipendenza dal resto dell'applicazione
- Manutenibilità e isolamento del codice specifico per la gestione credenziali
- Coerenza visiva all'interno del gruppo di pagine account

---

## 2. Regole di Architettura (System Core)

### 2.1 Cache Busting Tassativo
Ogni inclusione di file JS proprietario DEVE avere un parametro di versione esplicito che viene incrementato ad ogni deployment significativo.
**VIETATO**: `<script src="assets/js/miofile.js"></script>`
**OBBLIGATORIO**: `<script src="assets/js/miofile.js?v=3.7"></script>`
**CSS**: `<link rel="stylesheet" href="assets/css/auth_account.css?v=3.7">`

### 2.2 Componenti UI Centralizzati
Ogni interazione utente (Input, Conferma, Feedback) DEVE passare per `ui-core.js` (o `titanium-core.js`).
**VIETATO**: `alert()`, `confirm()`, `prompt()`, Modali HTML ad-hoc nella pagina.
**OBBLIGATORIO**:
- **Input**: `await window.showInputModal("Titolo", "ValoreDefault")`
- **Conferma**: `await window.showConfirmModal("Messaggio")`
- **Feedback**: `window.showToast("Messaggio", "success/error")`

### 2.3 Standard Multilingua (i18n)
Ogni pagina deve supportare nativamente il cambio lingua dinamico.
- **HTML**: Usare attributi `data-t="chiave_traduzione"` per ogni elemento testuale statico.
- **JS**: Includere `translations.js` e invocare `applyTranslations()` al caricamento.
- **Placeholders**: Anche gli attributi `placeholder` devono essere tradotti (es. `data-t-placeholder="search_text"`).
- **Verifica**: Controllare sempre che non ci siano testi hardcoded in italiano nel codice sorgente finale.

### 2.4 Standard Tema (Dual Mode) & Design System
Le pagine account devono riflettere il sistema Titanium Gold:
- **Palette Chiaro (Light Mode)**: Sfondo `f0f4f8`, Testo `var(--text-primary)`, Cards `var(--surface-vault)`.
- **Matrix Palette (Colori Semantici)**:
  - 🔵 Blue/Indigo: Account, Login, Generale.
  - 🟢 Emerald/Green: Successo, Risparmio, Indirizzi.
  - 🟠 Amber/Orange: Scadenze, Documenti.
  - 🔴 Rose/Red: Urgenze, Errori, Telefoni.
  - 🟣 Purple: Roadmap.
- **Effetti Obbligatori**:
  - **Glass Glow**: Luce ambientale pulsante sullo sfondo (Faro).
  - **Border Glow**: Perimetro luminoso sulle card (SOLO per pagine di login/accesso, NON per dashboard).
  - **Standard Matrix (52px)**: Allineamento millimetrico (8px margine + 44px padding interno).
- **Ombre Adattive (Adaptive Shadows)**:
  - **Dark Mode**: NO ombre visibili (o estremamente sottili). Usa border glow e backdrop-filter blur per profondità.
  - **Light Mode**: SÌ ombre morbide per creare profondità visiva.
    - Card/Box: `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);`
    - Elevated: `box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);`
  - **Implementazione CSS**: Usare variabili CSS o classi condizionali (`html:not(.dark)`) per applicare ombre solo in Light Mode.
- **Layout dinamici (JS)**: È tassativo non usare colori `rgba` o `hex` nei blocchi HTML generati via Javascript.
  **VIETATO**: `background: rgba(0,0,0,0.5); color: white;`
  **OBBLIGATORIO**: `background: var(--surface-vault); color: var(--text-primary); border: 1px solid var(--border-color);`

### 2.5 Effetti Speciali (Shimmer/Saetta)
**REGOLA CRITICA**: L'effetto "Saetta" (Shimmer/Border Glow Animato) è riservato ESCLUSIVAMENTE alle pagine di autenticazione pubblica (Login, Registrazione, Reset Password).

**VIETATO** nelle pagine di account/dashboard:
- Animazioni `shimmer` o `border-glow-animated` sulle card di navigazione
- Effetti di scorrimento luminoso sui pulsanti di navigazione
- Qualsiasi animazione che distragga dalla lettura dei dati sensibili

**PERMESSO** nelle pagine di account:
- Effetto **Faro** statico (`glass-glow`) come luce ambientale di sfondo
- Hover effects sottili sui pulsanti (cambio colore, leggera scala)
- Transizioni smooth per apertura/chiusura pannelli

**Motivazione**: Le dashboard e le liste di credenziali richiedono massima concentrazione e leggibilità. Gli effetti scenografici sono riservati ai momenti di "ingresso" nell'applicazione.

---

## 3. Standard Editoriale (Layout & HTML)

### 3.1 Header Balanced Layout Protocol (V1.0)
**Problema Risolto**: Gli header con titoli lunghi causano collisioni visive con le icone (back, info, delete, home), rendendo l'interfaccia illeggibile.

#### Struttura Obbligatoria a 3 Zone
Ogni header DEVE seguire questa architettura:
```html
<header class="titanium-header">
  <div class="header-balanced-container">
    <!-- ZONA SINISTRA: Navigazione Primaria -->
    <div class="header-left">
      <!-- Freccia "indietro" sempre per prima, se presente -->
      <a href="..." class="btn-icon-header">
        <span class="material-symbols-outlined">arrow_back</span>
      </a>
      <!-- Altre icone primarie (opzionali) -->
    </div>

    <!-- ZONA CENTRO: Titolo con Wrap Intelligente -->
    <div class="header-center">
      <h2 class="header-title" data-t="...">
        TITOLO PAGINA
      </h2>
    </div>

    <!-- ZONA DESTRA: Azioni Secondarie -->
    <div class="header-right">
      <!-- Icone azione -->
      <button class="btn-icon-header">...</button>
      <!-- Icona "home" sempre per ultima, se presente -->
      <a href="home_page.html" class="btn-icon-header">
        <span class="material-symbols-outlined">home</span>
      </a>
    </div>
  </div>
</header>
```

#### Regole di Distribuzione Icone
- **Icone Dispari**: L'icona extra va sempre a destra.
  - Esempio (3 icone): 1 sx (back) + 2 dx (info, home)
  - Esempio (5 icone): 2 sx (back, delete) + 3 dx (settings, info, home)
- **Icone Pari**: Distribuzione equilibrata.
  - Esempio (4 icone): 2 sx (back, delete) + 2 dx (info, home)
- **Priorità Fisse**:
  1. Freccia "indietro" → sempre prima a sinistra
  2. Icona "home" → sempre ultima a destra

#### Comportamento Titolo (Wrap Intelligente)
- **Titolo Corto (1 parola)**: 1 riga, centrato
- **Titolo Medio (2-3 parole)**: Se non entra → 2 righe automaticamente
- **Titolo Lungo (4+ parole)**: Massimo 2 righe, resto troncato

**CSS Chiave**:
- `white-space: normal` (permette a capo)
- `line-clamp: 2` (massimo 2 righe)
- `line-height: 1.2` (compatto)
- `word-wrap: break-word` (spezza parole lunghe)

#### Divieti Assoluti
- **VIETATO** usare `white-space: nowrap` sul titolo
- **VIETATO** usare `text-overflow: ellipsis` negli header principali
- **VIETATO** usare `position: absolute` per titolo o icone
- **VIETATO** far sovrapporre icone e titolo

#### CSS Implementazione
Le classi `.header-balanced-container`, `.header-left`, `.header-center`, `.header-right` sono definite in `auth_account.css`.
- **Container**: `display: flex; justify-content: space-between`
- **Zone laterali**: `flex-shrink: 0` (mai si restringono)
- **Zona centro**: `flex: 1` (espandibile, con padding laterale di sicurezza)

#### Colori Testo Adattivi:
- **Dark Mode**: Testo bianco (`color: white` o `color: var(--text-primary)`)
- **Light Mode**: Testo nero/scuro (`color: 0f172a` o `color: var(--text-primary)`)
- Usare sempre `var(--text-primary)` per adattamento automatico

### 3.2 Triple Masking Protocol (Security UX)
Per i campi sensibili (Username, Account Number, Password) nelle card di dettaglio:

#### Livelli di Protezione
1. **Default State (Masked)**: Tutti i campi sensibili sono mascherati con asterischi (`********`).
2. **Toggle Visibility**: Un unico pulsante "occhio" (`visibility`/`visibility_off`) per rivelare/nascondere l'intero set di dati sensibili contemporaneamente.
3. **Individual Copy**: Ogni campo ha un pulsante dedicato per copiare il valore reale negli appunti, con feedback visuale (icona check temporanea).

#### Implementazione HTML Standard
```html
<div class="matrix-field-compact">
  <span class="material-symbols-outlined field-icon">account_circle</span>
  <span class="field-value" data-sensitive="true" data-real-value="mario.rossi@example.com">
    ********
  </span>
  <button class="btn-copy-field" onclick="copyFieldValue(this)">
    <span class="material-symbols-outlined">content_copy</span>
  </button>
</div>
```

#### Logica JS
```javascript
function toggleVisibility() {
  const fields = document.querySelectorAll('[data-sensitive="true"]');
  const isVisible = fields[0].textContent !== '********';
  
  fields.forEach(field => {
    if (isVisible) {
      field.textContent = '********';
    } else {
      field.textContent = field.dataset.realValue;
    }
  });
  
  // Aggiorna icona toggle
  toggleBtn.querySelector('.material-symbols-outlined').textContent = 
    isVisible ? 'visibility' : 'visibility_off';
}

function copyFieldValue(btn) {
  const field = btn.previousElementSibling;
  const realValue = field.dataset.realValue;
  
  navigator.clipboard.writeText(realValue).then(() => {
    // Feedback visivo
    const icon = btn.querySelector('.material-symbols-outlined');
    icon.textContent = 'check';
    setTimeout(() => { icon.textContent = 'content_copy'; }, 1500);
    
    window.showToast('Copiato negli appunti', 'success');
  });
}
```

### 3.3 Dashboard Grid Layout (Responsive Cards)
Le dashboard (Home Page, Area Privata) devono usare un layout a griglia responsivo:

#### Desktop (> 768px)
```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}
```

#### Mobile (≤ 768px)
```css
@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr; /* Colonna singola */
    gap: 1rem;
  }
}
```

**Motivazione**: Su mobile, le card di navigazione (Privato, Azienda, Scadenze, Urgenze) devono occupare tutta la larghezza per garantire:
- Leggibilità dei badge numerici
- Spazio sufficiente per titoli lunghi
- Touch target adeguati (min 44px altezza)

### 3.4 Matrix Card Compact (Account List Item)
Le liste di account (privati/aziendali) devono seguire il design "Matrix Card Compact":

#### Struttura Standard
```html
<div class="matrix-card-compact" onclick="viewAccountDetail('ID')">
  <!-- Header: Logo + Titolo + Badge -->
  <div class="card-header">
    <img src="logo.png" class="account-logo" alt="Logo">
    <h3 class="account-title">Nome Account</h3>
    <span class="badge-category">Categoria</span>
  </div>
  
  <!-- Body: Campi Dati (3 righe max) -->
  <div class="card-body">
    <div class="matrix-field-compact">
      <span class="material-symbols-outlined">person</span>
      <span class="field-value">Username</span>
    </div>
    <div class="matrix-field-compact">
      <span class="material-symbols-outlined">mail</span>
      <span class="field-value">email@example.com</span>
    </div>
    <div class="matrix-field-compact">
      <span class="material-symbols-outlined">lock</span>
      <span class="field-value">********</span>
    </div>
  </div>
  
  <!-- Footer: Azioni Rapide (Pin, Copy) -->
  <div class="card-footer">
    <button class="btn-pin" onclick="togglePin(event, 'ID')">
      <span class="material-symbols-outlined">push_pin</span>
    </button>
    <button class="btn-copy" onclick="copyPassword(event, 'ID')">
      <span class="material-symbols-outlined">content_copy</span>
    </button>
  </div>
</div>
```

#### Regole di Styling
- **Padding**: `p-3` (12px) per compattezza
- **Border Radius**: `rounded-[18px]` (18px) per coerenza Titanium
- **Background**: Adattivo (Dark: `slate-800/40`, Light: `white`)
- **Hover**: Leggero lift (`translateY(-2px)`) + cambio opacità bordo
- **Click**: Intera card cliccabile per aprire dettaglio
- **Stop Propagation**: Pulsanti interni (Pin, Copy) devono bloccare l'evento click della card

### 3.5 Search Bar Solid (Filtro Liste)
Le pagine di lista (Account Privati, Account Azienda) devono includere una barra di ricerca:

```html
<div class="search-bar-solid">
  <span class="material-symbols-outlined">search</span>
  <input 
    type="text" 
    placeholder="Cerca account..." 
    data-t-placeholder="search_accounts"
    oninput="filterAccounts(this.value)"
  >
</div>
```

**Caratteristiche**:
- Background solido (non trasparente) per distinguerla dalle card
- Bordi rinforzati (`border: 2px solid`)
- Icona search fissa a sinistra
- Placeholder tradotto
- Filtro real-time (oninput)

### 3.6 Mobile Responsivity (Standard Accesso V3.0)
In conformità con il protocollo di accesso:

1. **Typography**: I titoli dei box e delle card DEVONO poter andare a capo su due righe nei dispositivi mobili.
2. **Overflow**: Evitare assolutamente troncamenti o overflow orizzontali.
3. **Layout**: Impaginare i contenuti in modo che il contenitore si espanda verticalmente se il testo è lungo.
4. **Liste Account**: Usare sempre layout a colonna singola (`dashboard-grid`) per garantire leggibilità dei dati sensibili.
5. **Word Break**: Applicare `word-break: break-all` sui campi email/password per evitare overflow orizzontale.

#### Implementazione Media Queries
Il file `auth_account.css` DEVE includere:

**@media (max-width: 768px)**: Tablet - riduzione gap e padding laterali
```css
@media (max-width: 768px) {
  .titanium-main { padding: 1rem; }
  .dashboard-grid { grid-template-columns: 1fr; gap: 1rem; }
  .matrix-card-compact { padding: 0.875rem; }
}
```

**@media (max-width: 480px)**: Mobile - ottimizzazioni profonde
```css
@media (max-width: 480px) {
  .titanium-main { padding: 0.75rem; }
  .matrix-card-compact { padding: 1rem; }
  .account-title { font-size: 1rem; }
  .field-value { font-size: 9px; }
  .titanium-header { padding: 0.6rem 1rem; }
  .btn-icon-header { width: 36px; height: 36px; }
}
```

### 3.7 Footer Placeholder Protocol
Usare `<div id="footer-placeholder"></div>`. Vietato l'uso di tag `<footer>` statici che confliggono con l'iniezione dinamica di `ui-core.js`.

---

## 4. Protocollo Matrix V3.0 (Ultra-Compact List View)
Governa le liste account, scadenze, rubrica. Obiettivo: massima densità informativa.

### 4.1 Card Architecture
- **Padding**: `p-3` (12px)
- **Angoli**: `rounded-[18px]` (18px)
- **Sfondo**: Solido adattivo (Dark: `slate-800/40`, Light: `white`)
- **Classe**: `.matrix-card-compact`

### 4.2 Interaction
- **Card**: Interamente cliccabile per aprire dettaglio
- **Pulsanti Interni**: Obbligatorio `event.stopPropagation()` su pulsanti interni (Copy, Pin, Delete)
- **Hover**: Effetto lift sottile (`transform: translateY(-2px)`)

### 4.3 Data Fields
- **Altezza**: Fissa `h-8` (32px)
- **Classe**: `.matrix-field-compact`
- **Font**: `12px` per testo, `14px` per icone
- **Layout**: Icona + Valore (no label testuali esterne)
- **Overflow**: `word-break: break-all` per email/password lunghe

### 4.4 Search
- **Classe**: `.search-bar-solid`
- **Bordi**: Rinforzati (`border: 2px solid`)
- **Sfondo**: Denso (non trasparente)
- **Filtro**: Real-time con `oninput`

### 4.5 Dynamic UI
- **Rimuovere**: Pulsanti ridondanti come "Vedi Dettaglio" se la card è già cliccabile
- **Priorità**: Azioni rapide (Pin, Copy) visibili sempre, azioni distruttive (Delete) solo su hover o in dettaglio

---

## 5. Checklist di Validazione V3 (Definition of Done)
Un file si considera aggiornato a V3 SOLO se soddisfa TUTTI i seguenti punti:

- [ ] **CSS Unico**: Il file CSS collegato è solo `auth_account.css`?
- [ ] **Versioning**: Script e CSS hanno `?v=3.7`?
- [ ] **No Native Alerts**: Ho cercato "alert", "confirm", "prompt" e non ho trovato nulla?
- [ ] **Feedback Loop**: Ogni salvataggio termina con un `showToast`?
- [ ] **Clean Console**: Nessun errore rosso in console al caricamento.
- [ ] **Header Bilanciato**: Il layout dell'header è a 3 zone (Left, Center, Right)?
- [ ] **Titoli Mobile**: I titoli su mobile vanno a capo senza troncamenti?
- [ ] **No Shimmer**: L'effetto "Saetta" è assente o rimosso dalle dashboard?
- [ ] **Dashboard Grid**: Le liste account usano `dashboard-grid` (colonna singola su mobile)?
- [ ] **Media Queries**: Le media queries @768px e @480px sono implementate?
- [ ] **Word Break**: I campi interni hanno `word-break: break-all` per email/password lunghe?
- [ ] **Compact Elements**: Card `p-3` e campi `h-8` applicati correttamente?
- [ ] **Triple Masking**: I campi sensibili sono mascherati con toggle e copy funzionanti?

---

## 6. Procedura di Migrazione (Workflow)
Quando si aggiorna una pagina vecchia a V3:

1. **Backup**: Non toccare la logica business se funziona.
2. **CSS Swap**: Sostituire `titanium.css` con `auth_account.css`.
3. **Remove Shimmer**: Rimuovere effetti "Saetta" dalle card di navigazione.
4. **Replace Alerts**: Sostituire i prompt con i Modali.
5. **Enhance**: Aggiungere i Toast di successo.
6. **Responsive**: Implementare media queries per mobile.
7. **Tag**: Aggiornare la versione nello script tag al valore `v=3.7`.
8. **Verify**: Aprire e verificare che non ci siano errori in console.
9. **Test Mobile**: Verificare su viewport 375px che i titoli vadano a capo correttamente.