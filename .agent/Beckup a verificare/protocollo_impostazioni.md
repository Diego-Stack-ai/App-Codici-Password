---
description: Protocollo Standard Titanium Impostazioni V3.0 (Stability & Maintenance Focus)
---

---
description: Protocollo Standard Titanium Impostazioni V3.0 (Stability & Maintenance Focus)
 Titanium Impostazioni V3.0 (The Pragmatic Standard)
> Baseline Ufficiale: Questo protocollo, insieme agli altri presenti in `.agent/workflows/`, costituisce l'unica fonte di istruzioni da seguire per lo sviluppo dell'app, salvo la creazione di nuovi protocolli o l'insorgere di conflitti tecnici attualmente non noti. Viene stabilito che la stabilità operativa, il cache busting e l'uso di componenti centralizzati (Modali/Toast) hanno priorità assoluta su qualsiasi purismo CSS.
 1. Ambito di Applicazione
Questo protocollo governa le "Pagine Satellite" di configurazione e gestione dati dell'utente:
1.`profilo_privato.html` (Gestione Identità)
2.`configurazione_generali.html` (Configurazione Globale)
3.`configurazione_documenti.html` (Setup Tipi Doc)
4.`configurazione_automezzi.html` (Setup Flotta)
5.`impostazioni.html` (Hub Centrale)
6.`archivio_account.html` (Archivio Credenziali)
7.`regole_scadenze.html` (Regole Scadenze Hub)
8.`notifiche_storia.html` (Storico Notifiche)
9.`privacy.html` (Privacy Policy)
10.`scadenze.html` (Lista scadenze)
11.`aggiungi_scadenza.html` (Form composizione scadenza)
12.`dettaglio_scadenza.html` (Dettaglio e azioni scadenza)

# 1.1 CSS di Riferimento Unico
L'unico e solo file CSS** per gestire tutte le pagine sopra elencate è:
- **`assets/css/auth_impostazioni.css`**

Questo file è *completamente autonomo* e contiene tutti gli effetti, componenti e stili necessari per le pagine di impostazioni e configurazione.

*NON* deve essere utilizzato `titanium.css` o altri file CSS nelle pagine di impostazioni. Questa separazione garantisce:
- Performance ottimali (caricamento rapido)
- Indipendenza dal resto dell'applicazione (dashboard/home)
- Manutenibilità e isolamento del codice specifico per settings
- Coerenza visiva all'interno del gruppo di pagine satellite

---
 2. Regole di Architettura (System Core)
 2.1 Cache Busting Tassativo
Ogni inclusione di file JS proprietario DEVE avere un parametro di versione esplicito che viene incrementato ad ogni deployment significativo.
VIETATO: `<script src="assets/js/miofile.js"></script>`
OBBLIGATORIO: `<script src="assets/js/miofile.js?v=3.5"></script>`
 2.2 Gestione Accordion (Modello Ibrido)
Viene riconosciuta la necessità di stili inline per evitare FOUC (Flash of Unstyled Content).
 HTML: È permesso `style="display:none"` sugli `.accordion-content` per nasconderli al caricamento iniziale.
 JS: È autorizzato a manipolare `style.display` in tandem con `classList.arrow` per garantire fluidità.
 CSS: `auth_impostazioni.css` fornisce lo styling, ma il JS governa lo stato.
 2.3 Componenti UI Centralizzati
Ogni interazione utente (Input, Conferma, Feedback) DEVE passare per `ui-core.js` (o `titanium-core.js`).
VIETATO: `alert()`, `confirm()`, `prompt()`, Modali HTML ad-hoc nella pagina.
OBBLIGATORIO:
 Input: `await window.showInputModal("Titolo", "ValoreDefault")`
 Conferma: `await window.showConfirmModal("Messaggio")`
 Feedback: `window.showToast("Messaggio", "success/error")`
 2.4 Standard Multilingua (i18n)
Ogni pagina deve supportare nativamente il cambio lingua dinamico.
 HTML: Usare attributi `data-t="chiave_traduzione"` per ogni elemento testuale statico.
 JS: Includere `translations.js` e invocare `applyTranslations()` al caricamento.
 Placeholders: Anche gli attributi `placeholder` devono essere tradotti (es. `data-t-placeholder="search_text"`).
 Verifica: Controllare sempre che non ci siano testi hardcoded in italiano nel codice sorgente finale.
 2.5 Standard Tema (Dual Mode) & Design System
Le impostazioni devono riflettere il sistema Titanium Gold:
 Palette Chiaro (Light Mode): Sfondo `f0f4f8`, Testo `var(--text-primary)`, Cards `var(--surface-vault)`.
 Matrix Palette (Colori Semantici):
 🔵 Blue/Indigo: Account, Login, Generale.
 🟢 Emerald/Green: Successo, Risparmio, Indirizzi.
 🟠 Amber/Orange: Scadenze, Documenti.
 🔴 Rose/Red: Urgenze, Errori, Telefoni.
 🟣 Purple: Roadmap.
 Effetti Obbligatori:
 Glass Glow3: Luce ambientale pulsante sullo sfondo.
 Border Glow9: Perimetro luminoso sulle card.
 Standard Matrix (52px): Allineamento millimetrico (8px margine + 44px padding interno).
 Ombre Adattive (Adaptive Shadows):
 Dark Mode:NO ombre visibili (o estremamente sottili). Usa border glow e backdrop-filter blur per profondità.
 Light Mode:SÌ ombre morbide per creare profondità visiva.
 Card/Box: `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);`
 Elevated: `box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);`
 Implementazione CSS: Usare variabili CSS o classi condizionali (`html:not(.dark)`) per applicare ombre solo in Light Mode.
 Layout dinamici (JS): È tassativo non usare colori `rgba` o `hex` nei blocchi HTML generati via Javascript.
VIETATO: `background: rgba(0,0,0,0.5); color: white;`
OBBLIGATORIO: `background: var(--surface-vault); color: var(--text-primary); border: 1px solid var(--border-color);`
---
 3. Standard Editoriale (Layout & HTML)
 3.1 Tabelle "Titanium Data"
Le liste di configurazione devono seguire rigorosamente il markup "Glass Table":
```html
<table class="w-full text-xs">
<tr class="group hover:bg-white/5 transition-colors border-b border-white/5">
<!-- Contenuto -->
<td class="px-3 py-2">Dato</td>
<!-- Azioni (visibili on hover) -->
<td class="text-right opacity-0 group-hover:opacity-100">
<button onclick="window.editItem(...)">Edit</button>
</td>
</tr>
</table>
```
 Densità: Sempre `text-xs` (interfaccia tecnica professionale).
 Interazione: Le icone di azione (Edit/Delete) devono apparire solo all'hover sulla riga per ridurre il rumore visivo.
 3.2 Header Balanced Layout Protocol (V1.0)
Problema Risolto: Gli header con titoli lunghi causano collisioni visive con le icone (back, info, delete, home), rendendo l'interfaccia illeggibile.
 Struttura Obbligatoria a 3 Zone
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
 Regole di Distribuzione Icone
 Icone Dispari: L'icona extra va sempre a destra.
 Esempio (3 icone): 1 sx (back) + 2 dx (info, home)
 Esempio (5 icone): 2 sx (back, delete) + 3 dx (settings, info, home)
 Icone Pari: Distribuzione equilibrata.
 Esempio (4 icone): 2 sx (back, delete) + 2 dx (info, home)
 Priorità Fisse:
1.Freccia "indietro" → sempre prima a sinistra
2.Icona "home" → sempre ultima a destra
 Comportamento Titolo (Wrap Intelligente)
 Titolo Corto (1 parola): 1 riga, centrato
 Titolo Medio (2-3 parole): Se non entra → 2 righe automaticamente
 Titolo Lungo (4+ parole): Massimo 2 righe, resto troncato
 CSS Chiave:
 `white-space: normal` (permette a capo)
 `line-clamp: 2` (massimo 2 righe)
 `line-height: 1.2` (compatto)
 `word-wrap: break-word` (spezza parole lunghe)
 Divieti Assoluti
 VIETATO usare `white-space: nowrap` sul titolo
 VIETATO usare `text-overflow: ellipsis` negli header principali
 VIETATO usare `position: absolute` per titolo o icone
 VIETATO far sovrapporre icone e titolo
 CSS Implementazione
Le classi `.header-balanced-container`, `.header-left`, `.header-center`, `.header-right` sono definite in `auth_impostazioni.css` (sezione 3.1).
 Container: `display: flex; justify-content: space-between`
 Zone laterali: `flex-shrink: 0` (mai si restringono)
 Zona centro: `flex: 1` (espandibile, con padding laterale di sicurezza)
 Colori Testo Adattivi:
 Dark Mode: Testo bianco (`color: white` o `color: var(--text-primary)`)
 Light Mode: Testo nero/scuro (`color: 0f172a` o `color: var(--text-primary)`)
 Usare sempre `var(--text-primary)` per adattamento automatico
 3.3 Modern Inputs & Compact Layouts
Per ottimizzare lo spazio e migliorare la UX nei form complessi:
 Select Premium: Rimuovere sempre l'aspetto nativo (`appearance: none`) e utilizzare un chevron personalizzato in posizione assoluta. Assicurare `padding-right` sufficiente per evitare sovrapposizioni.
 Compact Numeric Fields: Campi correlati (es. Preavviso e Frequenza) devono essere affiancati in un unico `settings-item` utilizzando un layout `flex` con divisore verticale (`w-px bg-white/10`).
 Glass Inputs: Gli input all'interno dei `settings-item` devono essere trasparenti, senza bordi bianchi invasivi, utilizzando pesi font elevati (Bold/Black) per la leggibilità.
 3.4 Mobile Header Typography (Wrap Rule)
In versione mobile, tutti i titoli delle pagine DEVONO poter andare a capo su due righe per evitare troncamenti o sovrapposizioni con i pulsanti di navigazione.
 Regola: È vietato forzare il titolo su una sola riga (`white-space: nowrap` è proibito se causa overflow).
 Stile: Utilizzare `line-height: 1.1` o `1.2` e assicurare che il container del titolo abbia spazio verticale sufficiente.
 3.5 Placeholder Footer Protocol
Usare `<div id="footer-placeholder"></div>`. Vietato l'uso di tag `<footer>` statici che confliggono con l'iniezione dinamica di `ui-core.js`.
 3.6 Internal Panes vs System Modals (Filosofia Strutturale)
Viene introdotta la distinzione tra elementi informativi e flussi di controllo:
 Internal Panes (Pannelli Interni): Le istruzioni, i moduli di aggiunta dati (Email, Documenti, Indirizzi) e le guide rapide NON devono essere modali. Devono essere integrate nella pagina come "Panes" (Accordion espandibili). 
 Obiettivo: Massima fluidità operativa. L'utente apre il pannello "Aggiungi", compila i campi inline e salva, senza mai perdere il contesto della pagina sottostante o subire interruzioni da popup invasivi.
 Struttura Standard: Il pulsante di azione (es. "Aggiungi Email") agisce da `accordion-header` che espande un blocco `settings-group` integrato nel DOM, contenente i campi di input e le azioni di conferma/annullamento.
 System Modals (Modali di Sistema): Riservati ESCLUSIVAMENTE a conferme d'azione distruttive (es. "Sei sicuro di eliminare?"), visualizzazione di dettagli estesi (es. Anteprima Immagini Documento) o input critici asincroni che richiedono un blocco totale dell'interfaccia.
 Regola: Non devono esistere nel markup HTML statico, ma essere invocati solo via JS.
 4. Protocollo Matrix V3.0 (Ultra-Compact List View)
Governa le liste account, scadenze, rubrica. Obiettivo: massima densità informativa.
 Card Architecture: Padding `p-3`, angoli `rounded-[18px`, sfondo solido adattivo. Usare `.matrix-card-compact`.
 Interaction: Card interamente cliccabile. Obbligatorio `event.stopPropagation()` su pulsanti interni (Copy, Pin).
 Data Fields: Altezza fissa `h-8`. Usare `.matrix-field-compact`. Font `12px`, icone `14px`. No label testuali esterne.
 Search: Bordi rinforzati e sfondo denso. Usare `.search-bar-solid`.
 Dynamic UI: Rimuovere pulsanti ridondanti come "Vedi Dettaglio" se la card è già cliccabile.
 5. Checklist di Validazione V3 (Definition of Done)
Un file si considera aggiornato a V3 SOLO se soddisfa TUTTI i seguenti punti:
-Versioning: Lo script principale ha `?v=3.5`?
-No Native Alerts: Ho cercato "alert", "confirm", "prompt" e non ho trovato nulla?
-Feedback Loop: Ogni salvataggio termina con un `showToast`?
-Accordion: Le chevron ruotano correttamente e i pannelli si aprono fluidamente?
-Clean HTML: Non ci sono stili inline inutili (es. `width: 100%` su div che sono già block)?
-Console Clean: Nessun errore rosso in console al caricamento.
-Compact Elements: Card p-3 e campi h-8 applicati correttamente?
 6. Procedura di Migrazione (Workflow)
Quando si aggiorna una pagina vecchia a V3:
1.Backup: Non toccare la logica business se funziona.
2.Replace: Sostituisci i prompt con i Modali.
3.Enhance: Aggiungi i Toast di successo.
4.Tag: Aggiorna la versione nello script tag al valore v=3.5.
5.Verify: Apri e verifica che non ci siano errori.