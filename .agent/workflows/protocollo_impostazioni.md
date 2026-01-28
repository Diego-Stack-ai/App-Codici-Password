---
description: Protocollo Standard Titanium Impostazioni V3.0 (Stability & Maintenance Focus)
---

# Titanium Impostazioni V3.0 (The Pragmatic Standard)
> **Baseline Ufficiale**: Viene stabilito che la stabilità operativa, il cache busting e l'uso di componenti centralizzati (Modali/Toast) hanno priorità assoluta su qualsiasi purismo CSS.

## 1. Ambito di Applicazione
Questo protocollo governa le "Pagine Satellite" di configurazione e gestione dati dell'utente:
1.  `profilo_privato.html` (Gestione Identità)
2.  `configurazione_generali.html` (Configurazione Globale)
3.  `configurazione_documenti.html` (Setup Tipi Doc)
4.  `configurazione_automezzi.html` (Setup Flotta)
5.  `impostazioni.html` (Hub Centrale)

---

## 2. Regole di Architettura (System Core)

### 2.1 Cache Busting Tassativo
Ogni inclusione di file JS proprietario DEVE avere un parametro di versione esplicito che viene incrementato ad ogni deployment significativo.
**VIETATO**: `<script src="assets/js/miofile.js"></script>`
**OBBLIGATORIO**: `<script src="assets/js/miofile.js?v=3.0"></script>`

### 2.2 Gestione Accordion (Modello Ibrido)
Viene riconosciuta la necessità di stili inline per evitare FOUC (Flash of Unstyled Content).
*   **HTML**: È permesso `style="display:none"` sugli `.accordion-content` per nasconderli al caricamento iniziale.
*   **JS**: È autorizzato a manipolare `style.display` in tandem con `classList.arrow` per garantire fluidità.
*   **CSS**: `auth_impostazioni.css` fornisce lo styling, ma il JS governa lo stato.

### 2.3 Componenti UI Centralizzati
Ogni interazione utente (Input, Conferma, Feedback) DEVE passare per `ui-core.js` (o `titanium-core.js`).
*   ❌ **VIETATO**: `alert()`, `confirm()`, `prompt()`, Modali HTML ad-hoc nella pagina.
*   ✅ **OBBLIGATORIO**:
    *   Input: `await window.showInputModal("Titolo", "ValoreDefault")`
    *   Conferma: `await window.showConfirmModal("Messaggio")`
    *   Feedback: `window.showToast("Messaggio", "success/error")`

---

## 3. Standard Editoriale (Layout & HTML)

### 3.1 Tabelle "Titanium Data"
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
*   **Densità**: Sempre `text-xs` (interfaccia tecnica professionale).
*   **Interazione**: Le icone di azione (Edit/Delete) devono apparire solo all'hover sulla riga per ridurre il rumore visivo.

### 3.2 Header Stack
Il titolo della pagina non deve essere orfano.
Se ci sono Nome e Cognome, devono essere impilati verticalmente (`flex-col`) con pesi tipografici diversi (Bold vs Medium) per creare gerarchia senza usare `<br>` forzati.

---

## 4. Checklist di Validazione V3 (Definition of Done)
Un file si considera aggiornato a V3 SOLO se soddisfa TUTTI i seguenti punti:

- [ ] **Versioning**: Lo script principale ha `?v=3.x`?
- [ ] **No Native Alerts**: Ho cercato "alert", "confirm", "prompt" e non ho trovato nulla?
- [ ] **Feedback Loop**: Ogni salvataggio termina con un `showToast`?
- [ ] **Accordion**: Le chevron ruotano correttamente e i pannelli si aprono fluidamente?
- [ ] **Clean HTML**: Non ci sono stili inline inutili (es. `width: 100%` su div che sono già block)?
- [ ] **Console Clean**: Nessun errore rosso in console al caricamento.

---

## 5. Procedura di Migrazione (Workflow)
Quando si aggiorna una pagina vecchia a V3:
1.  **Backup**: Non toccare la logica business se funziona.
2.  **Replace**: Sostituisci i prompt con i Modali.
3.  **Enhance**: Aggiungi i Toast di successo.
4.  **Tag**: Aggiorna la versione nello script tag.
5.  **Verify**: Apri e verifica che non ci siano errori.
