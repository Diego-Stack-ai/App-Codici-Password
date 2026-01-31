---
description: Regole Responsive Design - Breakpoints, Layout, Card, Form e Modali
---

# Titanium Responsive Design Rules V1.0
> Documento di sintesi delle regole di responsive design applicate nell'applicazione AppCodiciPassword

## 1. Breakpoints Standard (Media Queries)

### 1.1 Breakpoints Definiti
L'applicazione utilizza i seguenti breakpoints standard per adattare il layout:

| Breakpoint | Dimensione | Target Device | File CSS |
|------------|------------|---------------|----------|
| **Desktop** | > 768px | Desktop, Laptop | Stili base |
| **Tablet** | ≤ 768px | Tablet, iPad | `@media (max-width: 768px)` |
| **Mobile** | ≤ 480px | Smartphone | `@media (max-width: 480px)` |
| **Small Mobile** | ≤ 400px | Smartphone piccoli | `@media (max-width: 400px)` |

### 1.2 Implementazione nei File CSS

#### auth_account.css
```css
/* Tablet (768px) */
@media (max-width: 768px) {
    .grid-2-cols {
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }
    
    .titanium-main {
        padding-left: 1rem;
        padding-right: 1rem;
    }
    
    .dashboard-grid-2 {
        grid-template-columns: 1fr; /* Singola colonna */
    }
}

/* Mobile (480px) */
@media (max-width: 480px) {
    .titanium-main {
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
    }
    
    [class*="matrix-"]:not(.matrix-field-compact) {
        padding: 1rem;
    }
    
    .matrix-card-compact {
        padding: 0.5rem;
    }
    
    .card-text-block h3,
    [class*="matrix-"] h3 {
        font-size: 1rem;
        line-height: 1.15;
    }
    
    .matrix-field-compact {
        padding: 0 0.5rem;
        height: 24px;
    }
    
    .matrix-field-compact span {
        font-size: 9px;
    }
    
    .titanium-header {
        padding: 0.6rem 0.75rem;
    }
    
    .btn-icon-header {
        width: 36px;
        height: 36px;
    }
    
    .header-title {
        font-size: 0.95rem;
        line-height: 1.1;
    }
    
    .dashboard-grid {
        gap: 0.5rem;
    }
}
```

#### auth_impostazioni.css
```css
/* Small Mobile (400px) */
@media (max-width: 400px) {
    /* Ottimizzazioni specifiche per schermi molto piccoli */
}

/* Tablet (768px) */
@media (max-width: 768px) {
    .profile-card {
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 1.5rem;
    }
    
    .settings-item {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
    }
}
```

#### auth_accesso.css
```css
/* Mobile (640px) */
@media (max-width: 640px) {
    /* Ottimizzazioni per pagine di login/registrazione */
}
```

---

## 2. Layout Flex/Grid Adattivo

### 2.1 Dashboard Grid (Account Lists)
**Regola**: Le liste di account devono sempre usare layout a colonna singola su mobile.

```css
/* Desktop: Colonna singola (default per liste account) */
.dashboard-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
}

/* Tablet: Riduzione gap */
@media (max-width: 768px) {
    .dashboard-grid {
        gap: 0.75rem;
    }
}

/* Mobile: Gap minimo */
@media (max-width: 480px) {
    .dashboard-grid {
        gap: 0.5rem;
    }
}
```

### 2.2 Dashboard Grid 2 Columns (Navigation Cards)
**Regola**: Le card di navigazione (Home Page) usano 2 colonne su desktop, 1 colonna su mobile.

```css
/* Desktop: 2 colonne */
.dashboard-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
}

/* Tablet/Mobile: 1 colonna */
@media (max-width: 768px) {
    .dashboard-grid-2 {
        grid-template-columns: 1fr;
    }
}
```

**Motivazione**: Su mobile, le card di navigazione (Privato, Azienda, Scadenze, Urgenze) devono occupare tutta la larghezza per garantire:
- Leggibilità dei badge numerici
- Spazio sufficiente per titoli lunghi
- Touch target adeguati (min 44px altezza)

### 2.3 Header Balanced Layout (Flex)
**Regola**: Gli header usano flexbox con 3 zone (Left, Center, Right) per bilanciare icone e titolo.

```css
.header-balanced-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-left,
.header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0; /* Mai si restringono */
    min-width: 44px;
}

.header-center {
    flex: 1; /* Espandibile */
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    min-width: 0;
}
```

---

## 3. Adattamento Card, Form e Pannelli

### 3.1 Matrix Cards (Account Items)
**Regola**: Le card compatte devono ridurre padding e font-size su mobile.

```css
/* Desktop */
.matrix-card-compact {
    padding: 0.75rem;
    border-radius: 18px;
}

/* Mobile */
@media (max-width: 480px) {
    .matrix-card-compact {
        padding: 0.5rem;
    }
}
```

### 3.2 Matrix Fields (Data Display)
**Regola**: I campi dati interni devono ridurre altezza e font-size su mobile.

```css
/* Desktop */
.matrix-field-compact {
    height: 28px;
    padding: 0 0.6rem;
}

.matrix-field-compact span {
    font-size: 10px;
    font-weight: 700;
    word-break: break-all; /* Forza wrap per email/password lunghe */
}

/* Mobile */
@media (max-width: 480px) {
    .matrix-field-compact {
        height: 24px;
        padding: 0 0.5rem;
    }
    
    .matrix-field-compact span {
        font-size: 9px;
    }
}
```

### 3.3 Titanium Main Container
**Regola**: Il contenitore principale deve ridurre padding laterale su schermi piccoli.

```css
/* Desktop */
.titanium-main {
    padding: calc(var(--header-height) + 1.5rem) 1.5rem 100px 1.5rem;
}

/* Tablet */
@media (max-width: 768px) {
    .titanium-main {
        padding-left: 1rem;
        padding-right: 1rem;
    }
}

/* Mobile */
@media (max-width: 480px) {
    .titanium-main {
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
    }
}
```

### 3.4 Header Icons e Titoli
**Regola**: Gli header devono ridurre dimensioni icone e font-size titoli su mobile.

```css
/* Desktop */
.btn-icon-header {
    width: 42px;
    height: 42px;
}

.header-title {
    font-size: 1.1rem;
    line-height: 1.2;
}

/* Mobile */
@media (max-width: 480px) {
    .btn-icon-header {
        width: 36px;
        height: 36px;
    }
    
    .header-title {
        font-size: 0.95rem;
        line-height: 1.1;
    }
    
    .titanium-header {
        padding: 0.6rem 0.75rem;
    }
}
```

### 3.5 Mobile Header Typography (Wrap Rule)
**REGOLA CRITICA**: In versione mobile, tutti i titoli delle pagine DEVONO poter andare a capo su due righe per evitare troncamenti o sovrapposizioni con i pulsanti di navigazione.

```css
.header-title {
    white-space: normal; /* Permette a capo */
    word-wrap: break-word; /* Spezza parole lunghe */
    display: -webkit-box;
    -webkit-line-clamp: 2; /* Massimo 2 righe */
    -webkit-box-orient: vertical;
    line-clamp: 2;
    overflow: hidden;
    line-height: 1.2;
}
```

**VIETATO**:
- Usare `white-space: nowrap` sul titolo
- Usare `text-overflow: ellipsis` negli header principali
- Usare `position: absolute` per titolo o icone
- Far sovrapporre icone e titolo

### 3.6 Settings Items (Form Elements)
**Regola**: Gli elementi di configurazione devono passare da layout orizzontale a verticale su tablet.

```css
/* Desktop */
.settings-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
}

/* Tablet/Mobile */
@media (max-width: 768px) {
    .settings-item {
        flex-direction: column;
        gap: 1rem;
        align-items: flex-start;
    }
}
```

### 3.7 Profile Card (Avatar + Info)
**Regola**: La card profilo deve centrare verticalmente il contenuto su mobile.

```css
/* Desktop */
.profile-card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 1.5rem;
}

/* Tablet/Mobile */
@media (max-width: 768px) {
    .profile-card {
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 1.5rem;
    }
}
```

---

## 4. Gestione Immagini e Modali su Schermi Piccoli

### 4.1 Avatar e Immagini Profilo
**Regola**: Le immagini devono mantenere aspect ratio e usare `object-fit: cover`.

```css
.avatar-main {
    width: 100%;
    height: 100%;
    border-radius: 27px;
    object-fit: cover; /* Mantiene proporzioni */
    background-size: cover;
    background-position: center;
}

.avatar-wrapper {
    width: 100px;
    height: 100px;
    border-radius: 30px;
    overflow: hidden; /* Previene angoli visibili */
}
```

### 4.2 Logo Aziende (Responsive)
**Regola**: I loghi devono adattarsi mantenendo proporzioni.

```css
.account-logo {
    width: 40px;
    height: 40px;
    object-fit: contain; /* Mantiene proporzioni senza crop */
    border-radius: 8px;
}
```

### 4.3 System Modals (Filosofia Strutturale)
**Regola**: Le modali di sistema devono essere responsive e centralizzate.

#### Quando usare Modali:
- **System Modals**: Riservati ESCLUSIVAMENTE a:
  - Conferme d'azione distruttive (es. "Sei sicuro di eliminare?")
  - Visualizzazione di dettagli estesi (es. Anteprima Immagini Documento)
  - Input critici asincroni che richiedono un blocco totale dell'interfaccia

#### Quando NON usare Modali:
- **Internal Panes**: Le istruzioni, i moduli di aggiunta dati (Email, Documenti, Indirizzi) e le guide rapide NON devono essere modali. Devono essere integrate nella pagina come "Panes" (Accordion espandibili).

#### Implementazione Modali Responsive:
```javascript
// Usare sempre ui-core.js per modali centralizzate
await window.showConfirmModal("Sei sicuro di eliminare questo account?");
await window.showInputModal("Inserisci nuovo nome", "Valore default");
window.showToast("Operazione completata", "success");
```

**VIETATO**:
- `alert()`, `confirm()`, `prompt()` nativi
- Modali HTML ad-hoc nella pagina
- Modali che non si adattano a schermi piccoli

### 4.4 Modali Responsive (Best Practices)
Le modali devono:
1. **Centrare verticalmente e orizzontalmente** su tutti gli schermi
2. **Ridurre padding e font-size** su mobile
3. **Usare max-width** per evitare che siano troppo larghe su desktop
4. **Permettere scroll** se il contenuto è troppo lungo
5. **Avere backdrop blur** per evidenziare il focus

```css
/* Esempio modale responsive */
.modal-container {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 1rem;
}

.modal-content {
    background: var(--surface-vault);
    border-radius: 24px;
    padding: 2rem;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
}

@media (max-width: 480px) {
    .modal-content {
        padding: 1.5rem;
        border-radius: 20px;
    }
}
```

---

## 5. Regole Generali di Responsive Design

### 5.1 Touch Targets (Mobile)
**Regola**: Tutti gli elementi interattivi devono avere almeno 44x44px su mobile.

```css
/* Minimo touch target */
.btn-icon-header,
.settings-icon-box,
button {
    min-width: 44px;
    min-height: 44px;
}

/* Mobile: Riduzione accettabile solo se non compromette usabilità */
@media (max-width: 480px) {
    .btn-icon-header {
        width: 36px; /* Minimo accettabile */
        height: 36px;
    }
}
```

### 5.2 Word Break (Overflow Prevention)
**Regola**: I campi con testo lungo (email, password, URL) devono usare `word-break: break-all`.

```css
.matrix-field-compact span,
.field-value {
    word-break: break-all; /* Forza wrap per stringhe lunghe */
    overflow-wrap: break-word;
}
```

### 5.3 Padding Simmetrico (Mobile Fix)
**Regola**: Su mobile, assicurare padding uguale su entrambi i lati per evitare asimmetrie.

```css
@media (max-width: 480px) {
    .titanium-main {
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
    }
    
    .dashboard-grid,
    #accounts-container {
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
    }
}
```

### 5.4 Font Size Scaling
**Regola**: Ridurre progressivamente le dimensioni dei font su schermi piccoli.

| Elemento | Desktop | Tablet | Mobile |
|----------|---------|--------|--------|
| Header Title | 1.1rem | 1.1rem | 0.95rem |
| Card Title (h3) | 1.1rem | 1.1rem | 1rem |
| Field Value | 10px | 10px | 9px |
| Body Text | 0.9rem | 0.9rem | 0.85rem |

### 5.5 Gap Reduction
**Regola**: Ridurre gli spazi tra elementi su schermi piccoli.

```css
/* Desktop */
.dashboard-grid { gap: 1.5rem; }
.grid-2-cols { gap: 1.5rem; }

/* Tablet */
@media (max-width: 768px) {
    .dashboard-grid { gap: 0.75rem; }
    .grid-2-cols { gap: 0.75rem; }
}

/* Mobile */
@media (max-width: 480px) {
    .dashboard-grid { gap: 0.5rem; }
}
```

---

## 6. Checklist Responsive Design

Prima di considerare una pagina completamente responsive, verificare:

- [ ] **Breakpoints**: Implementati @768px e @480px?
- [ ] **Grid Adattivo**: Le griglie passano a colonna singola su mobile?
- [ ] **Padding Simmetrico**: Padding uguale su entrambi i lati su mobile?
- [ ] **Titoli Wrap**: I titoli vanno a capo senza troncamenti?
- [ ] **Touch Targets**: Tutti i pulsanti sono almeno 36x36px su mobile?
- [ ] **Word Break**: I campi lunghi (email/password) usano `word-break: break-all`?
- [ ] **Font Scaling**: I font si riducono progressivamente su schermi piccoli?
- [ ] **Gap Reduction**: Gli spazi tra elementi si riducono su mobile?
- [ ] **Modali Responsive**: Le modali si adattano a schermi piccoli?
- [ ] **Immagini Responsive**: Le immagini usano `object-fit: cover/contain`?
- [ ] **Test Viewport**: Testato su viewport 375px (iPhone standard)?
- [ ] **No Overflow**: Nessun overflow orizzontale su nessun breakpoint?

---

## 7. File CSS di Riferimento

| File CSS | Responsabilità | Breakpoints |
|----------|----------------|-------------|
| `auth_account.css` | Account, Dashboard, Home | 768px, 480px |
| `auth_impostazioni.css` | Settings, Profilo, Config | 768px, 400px |
| `auth_accesso.css` | Login, Registrazione, Reset | 640px |
| `titanium.css` | Componenti generali (legacy) | 480px, 640px |

---

## 8. Protocolli di Riferimento

Per approfondimenti, consultare:
- **protocollo_account.md**: Sezione 3.3 (Dashboard Grid Layout), 3.6 (Mobile Responsivity)
- **protocollo_impostazioni.md**: Sezione 3.2 (Header Balanced Layout), 3.4 (Mobile Header Typography)
- **protocollo_accesso.md**: Sezione 3 (Template HTML Standard)
