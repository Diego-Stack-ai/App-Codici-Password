# 📊 REPORT ANALISI CSS - operatore.css

**Data Analisi**: 06 Febbraio 2026  
**File Analizzato**: `assets/css/operatore.css`  
**Totale Righe CSS**: 2343

---

## 🎯 EXECUTIVE SUMMARY

| Metrica | Valore | Percentuale |
|---------|--------|-------------|
| **Classi CSS Totali** | 240 | 100% |
| **Classi Utilizzate** | 189 | **78.75%** ✅ |
| **Classi NON Utilizzate** | 50 | 20.83% ⚠️ |
| **Classi Protette** | 1 | 0.42% 🛡️ |
| **ID CSS Totali** | 0 | - |

---

## ✅ RISULTATO ANALISI

Il file `operatore.css` ha un **ottimo tasso di utilizzo del 78.75%**. 

- ✅ **189 classi** sono attivamente utilizzate nel codice
- ⚠️ **50 classi** non sono utilizzate e possono essere rimosse o spostate in staging
- 🛡️ **1 classe protetta** (`.show`) non è stata trovata ma deve essere mantenuta per funzionalità dinamiche

---

## 🗑️ CLASSI NON UTILIZZATE (50)

Le seguenti classi CSS sono definite in `operatore.css` ma **non sono utilizzate** in nessun file HTML o JavaScript:

### 🎨 Colori e Background (3)
```css
.bg-black
.bg-blue-500
.text-amber-500
.text-emerald-500
```

### 🔘 Bottoni e Modal (6)
```css
.btn-danger
.btn-modal
.btn-primary
.btn-secondary
.modal-actions
.modal-box
.modal-icon
.modal-overlay
.modal-text
.modal-title
```

### 📋 Liste e Dashboard (5)
```css
.dashboard-list-item
.item-badge
.item-content
.item-icon-box
.item-title
```

### 👤 Account Cards (Micro Components) (30)
```css
.micro-account-avatar
.micro-account-avatar-box
.micro-account-badge
.micro-account-card
.micro-account-content
.micro-account-info
.micro-account-name
.micro-account-pin
.micro-account-subtitle
.micro-account-top-actions
.micro-actions-divider
.micro-btn-copy
.micro-btn-copy-inline
.micro-btn-utility
.micro-data-display
.micro-data-item
.micro-data-label
.micro-data-row
.micro-data-tray
.micro-data-value
.micro-item-badge
.micro-item-badge-container
.micro-item-content
.micro-item-icon-box
.micro-item-title
```

### 🔄 Swipe Components (4)
```css
.swipe-backgrounds
.swipe-bg-left
.swipe-bg-right
.swipe-content
```

### 🏴 Misc (2)
```css
.flag
.icon-accent-red
```

---

## 🛡️ CLASSI PROTETTE (1)

Queste classi **NON devono essere rimosse** anche se non trovate direttamente nel codice, perché vengono aggiunte dinamicamente via JavaScript:

```css
.show
```

**Altre classi dinamiche comuni già presenti e utilizzate:**
- `.active` ✅ (trovata e utilizzata)
- `.hidden` ✅ (trovata e utilizzata)
- `.filled` ✅ (trovata e utilizzata)

---

## 📊 ANALISI DETTAGLIATA

### Classi Più Utilizzate (Top 20)

Le seguenti classi sono le più comuni nel progetto:

1. `flex` - Layout flexbox
2. `flex-col` - Colonne flex
3. `items-center` - Allineamento centrale
4. `justify-between` - Spaziatura tra elementi
5. `gap-2`, `gap-3`, `gap-4` - Spaziatura gap
6. `w-full` - Larghezza completa
7. `hidden` - Nascondere elementi
8. `relative`, `absolute` - Posizionamento
9. `text-white`, `text-slate-400` - Colori testo
10. `rounded-xl`, `rounded-2xl` - Bordi arrotondati
11. `bg-transparent` - Background trasparente
12. `border-glow` - Effetto bordo luminoso
13. `base-container`, `base-header`, `base-footer` - Struttura base
14. `glass-field` - Campi glassmorphism
15. `settings-*` - Componenti settings
16. `auth-*` - Componenti autenticazione
17. `matrix-*` - Grid homepage
18. `hero-*` - Header profilo
19. `detail-*` - Pagine dettaglio
20. `micro-list-item` - Liste compatte

---

## ⚠️ RACCOMANDAZIONI

### 1. **Rimozione Sicura (Priorità Alta)**

Le seguenti classi possono essere **rimosse immediatamente** senza rischi:

```css
/* Bottoni modal non utilizzati */
.btn-danger
.btn-modal
.btn-primary
.btn-secondary

/* Modal non utilizzato */
.modal-actions
.modal-box
.modal-icon
.modal-overlay
.modal-text
.modal-title

/* Colori non utilizzati */
.bg-black
.bg-blue-500
.text-amber-500
.text-emerald-500

/* Misc */
.flag
.icon-accent-red
```

**Righe da rimuovere**: ~150 righe

---

### 2. **Spostamento in STAGING (Priorità Media)**

Le seguenti classi potrebbero essere utilizzate in futuro o in pagine non ancora completate. **Spostale in una sezione STAGING** per 2 settimane:

```css
/* Micro Account Components (30 classi) */
.micro-account-*
.micro-data-*
.micro-btn-*
.micro-item-*

/* Swipe Components (4 classi) */
.swipe-*

/* Dashboard Items (5 classi) */
.dashboard-list-item
.item-*
```

**Righe da spostare**: ~400 righe

---

### 3. **Verifica Manuale (Priorità Bassa)**

Alcune classi potrebbero essere costruite dinamicamente in JavaScript (es: `"micro-" + type`). Verifica manualmente:

- Tutte le classi `micro-*` (potrebbero essere generate dinamicamente)
- Classi `swipe-*` (potrebbero essere usate da librerie esterne)

---

## 🔧 PIANO DI AZIONE CONSIGLIATO

### Fase 1: Backup
```bash
cp assets/css/operatore.css assets/css/operatore.css.backup
```

### Fase 2: Rimozione Sicura
Rimuovi le 15 classi nella sezione "Rimozione Sicura"

### Fase 3: Staging
Sposta le 39 classi rimanenti in una sezione alla fine del file:

```css
/* ==========================================================================
   STAGING - CLASSI NON UTILIZZATE (Da rimuovere dopo 2 settimane)
   Data: 06/02/2026
   ========================================================================== */

/* Micro Account Components */
.micro-account-avatar { ... }
/* ... */

/* Swipe Components */
.swipe-backgrounds { ... }
/* ... */
```

### Fase 4: Test
- Testa tutte le pagine principali
- Verifica che non ci siano errori visivi
- Controlla la console per errori CSS

### Fase 5: Rimozione Finale
Dopo 2 settimane senza problemi, rimuovi la sezione STAGING

---

## 📈 BENEFICI ATTESI

| Metrica | Prima | Dopo | Miglioramento |
|---------|-------|------|---------------|
| **Righe CSS** | 2343 | ~1800 | -23% |
| **Dimensione File** | 47.9 KB | ~37 KB | -23% |
| **Classi Totali** | 240 | 190 | -21% |
| **Tasso Utilizzo** | 78.75% | **99%+** | +20% |

---

## 🎯 CONCLUSIONI

Il file `operatore.css` è **ben mantenuto** con un tasso di utilizzo del 78.75%. La pulizia proposta è **conservativa e sicura**:

✅ **Rimozione immediata**: 15 classi (modal, bottoni non usati)  
⚠️ **Staging temporaneo**: 35 classi (micro-components, swipe)  
🛡️ **Protezione**: 1 classe dinamica (`.show`)

**Rischio**: ⬇️ **BASSO** - La maggior parte delle classi da rimuovere sono chiaramente inutilizzate  
**Beneficio**: ⬆️ **MEDIO** - Riduzione del 23% della dimensione del file

---

## 📝 NOTE TECNICHE

### Metodo di Analisi

1. **Estrazione selettori CSS**: Parsing di `operatore.css` per estrarre tutte le classi definite
2. **Scansione HTML**: Ricerca di `class="..."` in tutti i file `.html`
3. **Scansione JavaScript**: Ricerca di:
   - `classList.add/remove/toggle('...')`
   - `querySelector('.class')`
   - `getElementsByClassName('...')`
   - Template strings con `class="${...}"`
4. **Confronto**: Identificazione delle classi CSS non trovate nel codice
5. **Protezione**: Esclusione delle classi dinamiche comuni

### Limitazioni

- ⚠️ Classi costruite dinamicamente (es: `"card-" + color`) potrebbero non essere rilevate
- ⚠️ Classi usate solo in pagine non ancora sviluppate non sono rilevabili
- ⚠️ Classi usate da librerie esterne potrebbero essere segnalate come inutilizzate

**Raccomandazione**: Usa sempre la sezione STAGING prima della rimozione definitiva.

---

**Report generato automaticamente** | Script: `analyze_css_usage.js`
