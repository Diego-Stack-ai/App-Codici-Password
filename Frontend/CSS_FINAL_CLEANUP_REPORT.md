# 🗑️ REPORT FINALE - Classi CSS Realmente Inutilizzate

**Data**: 06 Febbraio 2026  
**Metodo**: Scansione con match esatto (no partial matching)  
**File Analizzato**: `operatore.css` (2343 righe)  
**File Scansionati**: 35 HTML + 57 JS = 92 file

---

## 📊 STATISTICHE FINALI

| Metrica | Valore | Percentuale |
|---------|--------|-------------|
| **Classi CSS Totali** | 278 | 100% |
| **Classi Reali** | 240 | 86.3% |
| **Falsi Positivi** | 38 | 13.7% |
| **Classi Utilizzate** | 228 | 95.0% |
| **Classi NON Utilizzate** | **12** | **5.0%** |

---

## ❌ CLASSI REALMENTE INUTILIZZATE (12)

### 🎨 Colori (2 classi)

| # | Classe | Righe CSS | Motivo | Azione |
|---|--------|-----------|--------|--------|
| 1 | `.bg-black` | ~347-353 | Colore non usato | ⚠️ Rimuovere |
| 2 | `.bg-blue-500` | ~355-361 | Colore non usato | ⚠️ Rimuovere |

---

### 🔴 Icone & Misc (1 classe)

| # | Classe | Righe CSS | Motivo | Azione |
|---|--------|-----------|--------|--------|
| 3 | `.icon-accent-red` | ~2188-2190 | Icona non usata | ⚠️ Rimuovere |

---

### 📦 Micro Components (7 classi)

| # | Classe | Righe CSS | Motivo | Azione |
|---|--------|-----------|--------|--------|
| 4 | `.micro-account-pin` | ~1876-1886 | Bottone pin non implementato | 📦 Staging |
| 5 | `.micro-account-subtitle` | ~1763-1775 | Sottotitolo non usato | 📦 Staging |
| 6 | `.micro-actions-divider` | ~1852-1857 | Divisore non usato | 📦 Staging |
| 7 | `.micro-btn-copy` | ~1859-1874 | Bottone copia alternativo | 📦 Staging |
| 8 | `.micro-data-item` | ~1895-1905 | Item dato non usato | 📦 Staging |
| 9 | `.micro-data-tray` | ~1888-1893 | Tray dati non usato | 📦 Staging |

---

### 🔔 Modal (2 classi)

| # | Classe | Righe CSS | Motivo | Azione |
|---|--------|-----------|--------|--------|
| 10 | `.modal-overlay` | ~715-733 | **USATA in ui-core.js!** | ✅ MANTENERE |
| 11 | `.modal-box` | ~735-750 | **USATA in ui-core.js!** | ✅ MANTENERE |

**NOTA**: Le classi modal sono **FALSE NEGATIVE** - Lo script non le ha trovate perché sono in template strings con interpolazione. **NON rimuovere!**

---

### 🎨 Testo (1 classe)

| # | Classe | Righe CSS | Motivo | Azione |
|---|--------|-----------|--------|--------|
| 12 | `.text-emerald-500` | ~323-325 | Colore testo non usato | ⚠️ Rimuovere |

---

## ⚠️ FALSI POSITIVI (38 classi)

Le seguenti "classi" sono in realtà **valori CSS** estratti erroneamente dal parser:

### Numeri e Unità di Misura (38)

Questi NON sono classi CSS, ma valori numerici estratti da proprietà come `opacity`, `transition`, `font-size`, ecc.:

```
.03, .05, .05em, .08, .1, .15, .16, .1em, .1rem, .2, .25rem, .2rem, .2s,
.3, .34, .3s, .4, .45, .4s, .5, .56, .5px, .5rem, .5s, .6, .64, .7,
.75rem, .7rem, .8, .85rem, .8rem, .9, .95, .95rem, .96, .98, .9rem
```

**Esempio**:
```css
opacity: 0.5;  /* Lo script estrae ".5" come classe */
transition: 0.3s;  /* Lo script estrae ".3s" come classe */
font-size: 0.85rem;  /* Lo script estrae ".85rem" come classe */
```

**Azione**: ❌ **IGNORARE** - Non sono classi CSS reali

---

## ✅ CLASSI DA MANTENERE (Verificate Manualmente)

### Modal System ✅

Le classi modal sono **UTILIZZATE** ma non rilevate dallo script perché sono in template strings con interpolazione:

```javascript
// ui-core.js - Linea 111-123
modal.className = 'modal-overlay';  // ✅ USATA
content.className = 'modal-box';     // ✅ USATA
content.innerHTML = `
  <span class="material-symbols-outlined modal-icon icon-box-blue">info</span>
  <h3 class="modal-title">${title}</h3>
  <p class="modal-text">${message}</p>
  <div class="modal-actions">
    <button id="modal-ok-btn" class="btn-modal btn-primary">Ho Capito</button>
  </div>
`;
```

**Classi modal verificate come UTILIZZATE**:
- ✅ `.modal-overlay` - Usata in `ui-core.js` linea 111, 164, 223, 280
- ✅ `.modal-box` - Usata in `ui-core.js` linea 114, 167, 226
- ✅ `.modal-icon` - Usata in template string
- ✅ `.modal-title` - Usata in template string
- ✅ `.modal-text` - Usata in template string
- ✅ `.modal-actions` - Usata in template string
- ✅ `.btn-modal` - Usata in template string
- ✅ `.btn-primary` - Usata in template string
- ✅ `.btn-secondary` - Usata in template string
- ✅ `.btn-danger` - Usata in template string

---

## 📋 RIEPILOGO AZIONI

### ⚠️ RIMOZIONE IMMEDIATA (3 classi)

Queste classi possono essere **rimosse subito** senza rischi:

| Classe | Righe | Risparmio |
|--------|-------|-----------|
| `.bg-black` | ~347-353 | ~7 righe |
| `.bg-blue-500` | ~355-361 | ~7 righe |
| `.text-emerald-500` | ~323-325 | ~3 righe |
| `.icon-accent-red` | ~2188-2190 | ~3 righe |

**Totale risparmio**: ~20 righe (~0.85% del file)

---

### 📦 STAGING (6 classi)

Queste classi potrebbero essere usate in futuro. **Spostale in staging** per 2 settimane:

| Classe | Righe | Motivo |
|--------|-------|--------|
| `.micro-account-pin` | ~1876-1886 | Feature pin non implementata |
| `.micro-account-subtitle` | ~1763-1775 | Sottotitolo opzionale |
| `.micro-actions-divider` | ~1852-1857 | Divisore azioni |
| `.micro-btn-copy` | ~1859-1874 | Bottone copia alternativo |
| `.micro-data-item` | ~1895-1905 | Item dato alternativo |
| `.micro-data-tray` | ~1888-1893 | Tray dati alternativo |

**Totale staging**: ~60 righe (~2.5% del file)

---

### ✅ MANTENERE (10 classi)

Queste classi sono **UTILIZZATE** ma non rilevate dallo script:

| Classe | Motivo |
|--------|--------|
| `.modal-overlay` | Usata in `ui-core.js` (template string) |
| `.modal-box` | Usata in `ui-core.js` (template string) |
| `.modal-icon` | Usata in `ui-core.js` (template string) |
| `.modal-title` | Usata in `ui-core.js` (template string) |
| `.modal-text` | Usata in `ui-core.js` (template string) |
| `.modal-actions` | Usata in `ui-core.js` (template string) |
| `.btn-modal` | Usata in `ui-core.js` (template string) |
| `.btn-primary` | Usata in `ui-core.js` (template string) |
| `.btn-secondary` | Usata in `ui-core.js` (template string) |
| `.btn-danger` | Usata in `ui-core.js` (template string) |

---

## 📊 STATISTICHE CORRETTE

Dopo aver rimosso i falsi positivi:

| Categoria | Classi | % |
|-----------|--------|---|
| **Classi CSS Reali** | 240 | 100% |
| **Classi Utilizzate** | 231 | 96.25% |
| **Rimozione Immediata** | 3 | 1.25% |
| **Staging** | 6 | 2.5% |

### Utilizzo Reale

```
████████████████████████████████████████ 96.25%
231/240 classi utilizzate
```

---

## 🔬 LIMITAZIONI DELLO SCRIPT

Lo script con matching esatto ha alcune limitazioni:

### ❌ Non Rileva

1. **Template strings con interpolazione**
   ```javascript
   modal.className = 'modal-overlay';  // ❌ Non rilevata
   ```

2. **Assegnazioni dirette**
   ```javascript
   element.className = 'modal-box';  // ❌ Non rilevata
   ```

3. **Concatenazione stringhe**
   ```javascript
   const cls = 'modal-' + 'overlay';  // ❌ Non rilevata
   ```

### ✅ Rileva Correttamente

1. **HTML class attribute**
   ```html
   <div class="modal-overlay">  <!-- ✅ Rilevata -->
   ```

2. **classList operations**
   ```javascript
   element.classList.add('modal-overlay');  // ✅ Rilevata
   ```

3. **querySelector**
   ```javascript
   document.querySelector('.modal-overlay');  // ✅ Rilevata
   ```

---

## 🎯 RACCOMANDAZIONE FINALE

### ✅ Azione Consigliata

1. **Rimuovi subito** (3 classi):
   - `.bg-black`
   - `.bg-blue-500`
   - `.text-emerald-500`
   - `.icon-accent-red`

2. **Sposta in staging** (6 classi):
   - Tutte le classi `.micro-*` non utilizzate

3. **NON rimuovere**:
   - Tutte le classi `.modal-*` e `.btn-*`
   - Sono utilizzate ma non rilevate dallo script

### 📊 Beneficio Atteso

| Metrica | Prima | Dopo | Δ |
|---------|-------|------|---|
| **Righe CSS** | 2343 | ~2260 | -83 (-3.5%) |
| **Classi** | 240 | 231 | -9 (-3.75%) |
| **Utilizzo** | 96.25% | 100% | +3.75% |

---

## 🔧 COMANDI UTILI

### Verifica Manuale di una Classe

```powershell
# Windows PowerShell
Select-String -Path "public\**\*.html","public\**\*.js" -Pattern "modal-overlay"
```

```bash
# Linux/Mac
grep -r "modal-overlay" public/
```

### Riesegui Scansione

```bash
node exact_match_scan.js
```

---

**Report generato**: 06/02/2026  
**Script**: `exact_match_scan.js`  
**Versione**: 1.0 (Match Esatto)
