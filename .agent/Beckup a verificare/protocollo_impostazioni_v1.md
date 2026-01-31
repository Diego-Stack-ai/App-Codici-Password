# Protocollo Standard Titanium Impostazioni V3.0 + Responsive V3.1

(Stability & Maintenance Focus – The Pragmatic Standard)

**Baseline Ufficiale:** Questo protocollo, insieme agli altri presenti in `.agent/workflows/`, costituisce l'unica fonte di istruzioni da seguire per lo sviluppo dell'app, salvo la creazione di nuovi protocolli o l'insorgere di conflitti tecnici attualmente non noti.
Viene stabilito che la stabilità operativa, il cache busting e l'uso di componenti centralizzati (Modali/Toast) hanno priorità assoluta su qualsiasi purismo CSS.

---

## 1. Ambito di Applicazione

Questo protocollo governa le "Pagine Satellite" di configurazione e gestione dati dell'utente:

1. `profilo_privato.html` (Gestione Identità)
2. `configurazione_generali.html` (Configurazione Globale)
3. `configurazione_documenti.html` (Setup Tipi Doc)
4. `configurazione_automezzi.html` (Setup Flotta)
5. `impostazioni.html` (Hub Centrale)
6. `archivio_account.html` (Archivio Credenziali)
7. `regole_scadenze.html` (Regole Scadenze Hub)
8. `notifiche_storia.html` (Storico Notifiche)
9. `privacy.html` (Privacy Policy)
10. `scadenze.html` (Lista scadenze)
11. `aggiungi_scadenza.html` (Form composizione scadenza)
12. `dettaglio_scadenza.html` (Dettaglio e azioni scadenza)

### 1.1 CSS di Riferimento Unico

* `assets/css/auth_impostazioni.css`

Garantisce:

* Performance ottimali
* Indipendenza dal resto dell'applicazione
* Manutenibilità e isolamento del codice specifico per settings
* Coerenza visiva all'interno del gruppo di pagine satellite

---

## 2. Regole di Architettura (System Core)

### 2.1 Cache Busting Tassativo

**OBBLIGATORIO:** `<script src="assets/js/miofile.js?v=3.5"></script>`

### 2.2 Gestione Accordion (Modello Ibrido)

* HTML: `style="display:none"` sugli `.accordion-content`
* JS: manipolazione `style.display` con `classList.arrow`
* CSS: `auth_impostazioni.css` gestisce styling

### 2.3 Componenti UI Centralizzati

**OBBLIGATORIO:**

```javascript
await window.showInputModal("Titolo", "ValoreDefault");
await window.showConfirmModal("Messaggio");
window.showToast("Messaggio", "success/error");
```

### 2.4 Standard Multilingua (i18n)

* Attributi `data-t` per testi statici
* `applyTranslations()` via JS
* Placeholders con `data-t-placeholder`
* Nessun testo hardcoded

### 2.5 Standard Tema (Dual Mode) & Design System

* Palette Chiaro / Matrix Palette
* Effetti Glass Glow3, Border Glow9
* Standard Matrix 52px, Adaptive Shadows
* Layout dinamici via JS senza rgba/hex inline

---

## 3. Standard Editoriale (Layout & HTML)

### 3.1 Tabelle "Titanium Data"

* Markup Glass Table
* Densità `text-xs`
* Icone Edit/Delete visibili solo all'hover

### 3.2 Header Balanced Layout Protocol (V1.0)

* 3 zone: Left, Center, Right
* Priorità: Freccia sinistra, Icona home destra
* Titoli max 2 righe, CSS: `white-space: normal`, `line-clamp:2`
* Divieti: nowrap, ellipsis, position absolute, sovrapposizione icone/titolo

### 3.3 Modern Inputs & Compact Layouts

* Select Premium, Compact Numeric Fields, Glass Inputs

### 3.4 Mobile Header Typography (Wrap Rule)

* Titoli mobile max 2 righe, line-height 1.1–1.2

### 3.5 Placeholder Footer Protocol

* `<div id="footer-placeholder"></div>`
* Vietato `<footer>` statico

### 3.6 Internal Panes vs System Modals

* Internal Panes: integrati (accordion)
* System Modals: solo JS, input critici, dettagli estesi, conferme azioni

---

## 4. Protocollo Matrix V3.0 (Ultra-Compact List View)

* Card Architecture: `p-3`, `rounded-[18px]`, `.matrix-card-compact`
* Interaction: card cliccabile, `event.stopPropagation()` su pulsanti interni
* Data Fields: altezza fissa `h-8`, font 12px, icone 14px
* Search: bordi rinforzati, `.search-bar-solid`
* Dynamic UI: rimuovere pulsanti ridondanti

---

## 5. Checklist di Validazione V3 (Definition of Done)

* Versioning `?v=3.5`
* No Native Alerts
* Feedback Loop con `showToast`
* Accordion fluido
* Clean HTML
* Console clean
* Compact Elements applicati

---

## 6. Procedura di Migrazione (Workflow)

1. Backup
2. Replace prompt con Modali
3. Enhance toast di successo
4. Tag versione nello script
5. Verify errori console

---

## 7. Responsive Design (Nuova Sezione V3.1)

### 7.1 Breakpoints Standard

| Breakpoint   | Dimensione | Target Device      |
| ------------ | ---------- | ------------------ |
| Desktop      | >768px     | Desktop/Laptop     |
| Tablet       | ≤768px     | Tablet/iPad        |
| Mobile       | ≤480px     | Smartphone         |
| Small Mobile | ≤400px     | Smartphone piccoli |

### 7.2 Layout Flex/Grid Adattivo

* Multi-colonna desktop → singola colonna mobile
* Header Balanced: 3 zone, padding/font ridotti mobile
* Settings Items / Form: layout verticale tablet/mobile
* Profile Card: centrare contenuto mobile, ridurre gap

### 7.3 Tipografia Mobile

* Titoli max 2 righe, `white-space: normal`, `line-clamp:2`, line-height 1.1–1.2
* Font scaling: header 1.1→0.95rem, card 1.1→1rem, field 10→9px, body 0.9→0.85rem

### 7.4 Padding e Gap

* `.titanium-main` padding ridotto tablet/mobile
* Ridurre gap tra elementi griglie/flex `.dashboard-grid`, `.grid-2-cols`
* Padding simmetrico mobile

### 7.5 Matrix Cards e Fields

* `.matrix-card-compact`, `.matrix-field-compact` padding/font ridotti mobile
* `word-break: break-all` su campi dati

### 7.6 Touch Targets

* Minimo 44x44px, accettabile 36x36px solo se non compromette usabilità

### 7.7 Immagini e Logo

* Mantener proporzioni `object-fit: cover/contain`
* Ridurre dimensioni e padding mobile

### 7.8 Modali Responsive

* Centrate, ridotte, scrollabili mobile
* Solo via JS (`ui-core.js`)
* Nessun alert/confirm/prompt/static modals
* Ridurre padding/font-size, max-width, backdrop blur

### 7.9 Checklist Responsive (Definition of Done)

* Breakpoints rispettati (@768, @480, @400)
* Griglie passano a colonna singola
* Titoli header a capo senza troncamenti
* Touch targets ≥36x36px
* Padding simmetrico
* Font scaling applicato
* Gap ridotti
* Card/matrix field ridotti
* Modali responsive/centrate
* Immagini avatar/logo adattive
* Nessun overflow orizzontale

### 7.10 Sintesi / ToDo per Responsive

1. Definizione breakpoints
2. Grid/flex adattivi
3. Tipografia responsive
4. Padding e gap adattivi
5. Card, fields, profile card ridotti mobile
6. Touch targets minimi
7. Immagini responsive
8. Modali centralizzate e ridotte mobile
9. Checklist responsive per pagina
