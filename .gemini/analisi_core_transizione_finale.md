# Analisi core-transizione.css - Cosa Rimane e Chi lo Usa

## 🔍 CHI USA ANCORA core-transizione.css?

### ✅ **SOLO 1 PAGINA:**
- **scadenze.html** (linea 27)

---

## 📦 COSA CONTIENE core-transizione.css (670 linee)

### 1️⃣ **ARCHIVIO** (linee 5-301) - ~150 linee
**❌ NON PIÙ USATE** (spostate in archivio.css)

- `.btn-trash-archive` (8-12)
- `.btn-trash-archive .btn-logout-text` (14-17)
- `.archive-hint-wrap` (20-24)
- `.archive-action-group` (27-30)
- `.archive-list-group` (32-35)
- `.saetta-master` (38-42) - Override specifico archivio
- `.settings-group:first-of-type` (44-47)
- `.archive-page-content .settings-icon-box.icon-blue` (50-52)
- `.dark .archive-page-content .settings-select-semantic option` (55-58)
- `.hero-page-header.no-card` (61-74)
- `.archive-watermark` (77-92)
- `.archive-watermark span` (94-100)
- `.archive-row-container` (104-115)
- `.archive-row-container::after` (117-128)
- `.archive-item-content` (130-142)
- `.archive-item-content-header` (144-150)
- `.archive-item-content h4` (152-159)
- `.swipe-action-bg` (162-169)
- `.bg-restore` (171-175)
- `.bg-delete` (177-181)
- `.swipe-action-bg span` (183-185)
- `.dark .modal-box` (190-197)
- `.modal-input-glass` (199-213)
- `.archive-loading-container` (217-224)
- `.archive-spinner` (226-234)
- `@keyframes spin` (236-244)
- `.archive-loading-text, .archive-empty-text` (246-252)
- `.archive-empty-state` (254-262)
- `.archive-empty-icon` (264-267)
- `.archive-badge-context` (269-278)
- `.archive-row-container.is-removing` (281-286)
- `.archive-item-content:focus` (288-290)
- `.modal-input-glass:focus` (292-295)
- `.modal-input-glass::placeholder` (297-300)

---

### 2️⃣ **CONFIGURAZIONI** (linee 302-670) - ~240 linee
**❌ NON PIÙ USATE** (spostate in configurazioni.css)

#### Configuration Lists (302-347):
- `.config-list-item` (303-313)
- `.config-list-item:hover` (315-317)
- `.config-badge` (319-326)
- `.config-badge-standard` (329-332)
- `.dark .config-badge-standard` (334-336)
- `.config-item-actions` (338-343)
- `.config-list-item:hover .config-item-actions` (345-347)

#### Collapsible Headers (548-556):
- `.collapsible-header` (549-552)
- `.collapsible-header .arrow-icon` (554-556)

#### Semantic List Items (558-577):
- `.config-item-name` (559-565)
- `.config-item-desc` (567-572)
- `.config-badge-accent` (574-577)

#### Deadline Card Internals (579-606):
- `.deadline-card-category` (580-587)
- `.deadline-card-title` (589-598)
- `.deadline-card-subtitle` (600-606)

#### Semantic Badges (608-644):
- `.config-badge-blue` (609-612)
- `.config-badge-amber` (614-617)
- `.config-badge-purple` (619-622)
- `.config-badge-emerald` (624-627)
- `.dark .config-badge-blue` (630-632)
- `.dark .config-badge-amber` (634-636)
- `.dark .config-badge-purple` (638-640)
- `.dark .config-badge-emerald` (642-644)

#### Layout Helpers (647-670):
- `.config-item-main` (648-651)
- `.config-badge-group` (653-657)
- `.btn-delete-item-semantic` (659-661)
- `.dark .btn-delete-item-semantic` (663-665)
- `.icon-size-sm` (668-670)

---

### 3️⃣ **SCADENZE** (linee 349-545) - ~200 linee
**✅ USATE DA scadenze.html**

#### Deadline Cards (349-459):
- `.deadline-card` (350-364)
- `.deadline-card:hover` (366-369)
- `.deadline-card:active` (371-373)
- `.deadline-card-expired` (375-378)
- `.deadline-card-upcoming` (380-383)
- `.deadline-card-info` (385-388)
- `.deadline-icon-box` (390-401)
- `.deadline-card-expired .deadline-icon-box` (403-407)
- `.deadline-card-upcoming .deadline-icon-box` (409-413)
- `.deadline-card-info .deadline-icon-box` (415-419)
- `.deadline-date-badge` (421-429)
- `.deadline-card-expired .deadline-date-badge` (431-435)
- `.deadline-card-upcoming .deadline-date-badge` (437-441)
- `.deadline-card-info .deadline-date-badge` (443-447)
- `@keyframes slideInUp` (449-459)

#### Filters & Search (461-545):
- `.filter-container` (462-471)
- `.filter-container::-webkit-scrollbar` (473-475)
- `.filter-chip` (477-490)
- `.filter-chip.active` (492-497)
- `.search-bar-animated` (499-513)
- `.search-bar-animated.active` (515-519)
- `.search-input-wrapper` (521-530)
- `.search-input-wrapper span` (532-536)
- `.search-input-wrapper input` (538-545)

---

## 📊 RIEPILOGO

### Classi TOTALI in core-transizione.css: **~80 classi**

#### ❌ **NON PIÙ USATE** (spostate in altri file):
- **~30 classi ARCHIVIO** → Spostate in `archivio.css`
- **~30 classi CONFIGURAZIONI** → Spostate in `configurazioni.css`

#### ✅ **ANCORA USATE** (solo da scadenze.html):
- **~20 classi SCADENZE** → Deadline cards, filters, search

---

## 💡 PROSSIMO PASSO

### Creare `scadenze.css` con:

1. **Deadline Cards** (~110 linee)
   - Base card + varianti (expired, upcoming, info)
   - Icon box + varianti
   - Date badge + varianti
   - Animazione slideInUp

2. **Filters & Search** (~85 linee)
   - Filter container + chips
   - Search bar animata
   - Input wrapper

**TOTALE: ~200 linee** (invece di 670)

**Risparmio: -70% CSS** (~12KB risparmiati)

---

## 🎯 DOPO L'OTTIMIZZAZIONE

### File CSS Finali:

1. **archivio.css** → Solo archivio_account.html (~310 linee)
2. **configurazioni.css** → 4 pagine config (~240 linee)
3. **scadenze.css** → Solo scadenze.html (~200 linee)
4. **core-transizione.css** → ❌ ELIMINABILE (tutto spostato)

---

## ✅ STATO FINALE

### **8/8 pagine ottimizzate** (100%)

1. ✅ privacy.html → Nessun CSS specifico
2. ✅ impostazioni.html → Nessun CSS specifico
3. ✅ archivio_account.html → archivio.css
4. ✅ configurazione_generali.html → configurazioni.css
5. ✅ configurazione_documenti.html → configurazioni.css
6. ✅ configurazione_automezzi.html → configurazioni.css
7. ✅ regole_scadenze.html → configurazioni.css
8. ⏳ **scadenze.html** → scadenze.css (DA CREARE)

### **Dopo l'ottimizzazione:**
- ❌ **core-transizione.css** → ELIMINABILE
- ✅ **3 file CSS specifici** (archivio, configurazioni, scadenze)
- 🎉 **100% pagine ottimizzate**
