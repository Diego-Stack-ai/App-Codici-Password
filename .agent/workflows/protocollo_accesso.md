---
description: Protocollo Standard Titanium Accesso V3.0 (Security, Versioning & UX)
---

# Titanium Accesso V3.0 (The Secure Standard)
> **Baseline Ufficiale**: Questo protocollo, insieme agli altri presenti in `.agent/workflows/`, costituisce l'unica fonte di istruzioni da seguire per lo sviluppo dell'app, salvo la creazione di nuovi protocolli o l'insorgere di conflitti tecnici attualmente non noti.

## 0. Standard Design Titanium Gold
Ogni pagina di accesso deve rispettare i seguenti pilastri estetici:
*   **Matrix Palette**: Colori semantici Blue/Indigo per la sicurezza.
*   **Titanium Vault [#21]**: Contenitore centrale perimetrale con `border-glow`.
*   **Forced Dark Mode [#20]**: Le pagine auth sono bloccate in Dark Mode per sicurezza e coerenza.

---
## 1. Ambito di Applicazione
Questo protocollo governa le pagine pubbliche di ingresso (entry-points):
1.  `index.html` (Login)
2.  `registrati.html` (Registrazione)
3.  `reset_password.html` (Richiesta Reset)
4.  `imposta_nuova_password.html` (Set New Password)

### 1.1 CSS di Riferimento Unico
**L'unico e solo file CSS** per gestire tutte le pagine sopra elencate è:
- **`assets/css/auth_accesso.css`**

Questo file è **completamente autonomo** e contiene tutti gli effetti, componenti e stili necessari per le pagine di autenticazione. 

**NON** deve essere utilizzato `titanium.css` o altri file CSS nelle pagine di accesso. Questa separazione garantisce:
- Performance ottimali (caricamento rapido)
- Indipendenza dal resto dell'applicazione
- Manutenibilità e isolamento del codice critico di sicurezza

---

## 2. Regole di Architettura (System Core)

### 2.1 Cache Busting Tassativo (Nuova Regola V3)
Le pagine di accesso sono critiche. Se modifichi la logica di autenticazione, l'utente DEVE riceverla subito.
**OBBLIGATORIO**: Ogni script tag deve avere il versioning query string.
```html
<script type="module" src="assets/js/login.js?v=3.0"></script>
```

### 2.2 Pure CSS (Regola Storica V1)
Per garantire caricamento istantaneo e zero FOUC (Flash of Unstyled Content):
*   È **VIETATO** usare TailwindCSS o framework pesanti nel `<head>`.
*   Tutto lo stile deve derivare da `assets/css/auth_accesso.css`.

### 2.3 Componenti UI Centralizzati (Regola V3)
L'interazione con l'utente deve essere premium e coerente con l'app interna.
*   ❌ **VIETATO**: `alert()`, `confirm()`, `prompt()` nativi.
*   ✅ **OBBLIGATORIO**:
    *   **Toast**: Per feedback di successo o errori di rete (`window.showToast("Benvenuto", "success")`).
    *   **Inline Errors**: Per errori di validazione form (es. "Email non valida"), usare i div dedicati nel DOM, non alert.
    *   **Modali**: Se serve confermare un'azione, usare `ui-core.js` -> `showConfirmModal`.

### 2.4 Standard Multilingua (i18n)
L'accesso deve essere comprensibile a tutti gli utenti.
*   **Obbligo**: Ogni testo visibile deve essere mappato con `data-t`.
*   **JS**: Assicurarsi che `translations.js` sia caricato e inizializzato.
*   **Check**: Verificare che il selettore lingua aggiorni istantaneamente tutti i campi (label, button, placeholder).

---

## 3. Template HTML Standard V3
Ogni pagina Auth deve aderire a questo scheletro aggiornato:

```html
<!DOCTYPE html>
<html lang="it" class="titanium-forced-dark">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Titolo Pagina</title>
    
    <!-- Fonts & Icons -->
    <link href="https://fonts.googleapis.com/css2?family=Manrope..." rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined..." rel="stylesheet" />
    
    <!-- SOLO auth_accesso.css (NO TAILWIND) -->
    <link rel="stylesheet" href="assets/css/auth_accesso.css?v=3.0">
    
    <!-- Core UI per Toast/Modali -->
    <script src="assets/js/ui-core.js?v=3.0"></script>
</head>
<body>
    <div class="titanium-box">
        <!-- Scenografia (Glass Glow, Header, Footer) -->
        <div class="glass-glow"></div>
        
        <!-- Selettore Lingua Fluttuante -->
        <div class="lang-selector-container">...</div>

        <!-- Card Principale -->
        <div class="titanium-vault border-glow">
            <!-- Contenuto Form -->
        </div>
    </div>

    <!-- Toast Container (Se non generato dinamicamente) -->
    <div id="toast-container"></div>

    <!-- Script Specifico Versionato -->
    <script type="module" src="assets/js/login.js?v=3.0"></script>
</body>
</html>
```

### 3.1 Mobile Header Typography
I titoli delle card (es. "Imposta Nuova Password") DEVONO poter andare a capo su due righe nei dispositivi mobili.
*   Evitare assolutamente troncamenti o overflow orizzontali.
*   Impaginare il titolo in modo che il contenitore si espanda verticalmente se il testo è lungo.

---

## 4. Standard Password & UX

### 4.1 Gestione Errori
*   **Networking/System**: Usare `showToast("Errore di connessione", "error")`.
*   **User/Validation**: Usare messaggi testuali rossi sotto il campo input o sopra il bottone submit (`.error-message`). MAI usare alert.

### 4.2 Auto-Fill & Security
*   Login Password: `autocomplete="current-password"`
*   New Password: `autocomplete="new-password"`
*   Gli input password devono usare i pallini di sistema (non forzare font asterischi).

---

## 5. Checklist di Validazione V3 (Definition of Done)
Prima di chiudere un task sulle pagine di accesso, verificare:

- [ ] **Versioning**: Script e CSS hanno `?v=3.x`?
- [ ] **Clean Console**: Nessun errore rosso al caricamento.
- [ ] **No Alert**: Ho provato a sbagliare password e NON è uscito un alert nativo?
- [ ] **Toast**: I messaggi di successo (es. "Email inviata") appaiono come Toast scuri?
- [ ] **Multilingua**: Il selettore lingua fluttuante funziona senza ricaricare?
- [ ] **Pure CSS**: Non ho introdotto classi Tailwind (`text-center`, `p-4`) nell'HTML?

---

## 6. Procedura di Migrazione
Quando tocchi una pagina di accesso vecchia:
1.  Aggiungi `?v=...` agli script e CSS.
2.  Assicurati che importi `ui-core.js` (per i Toast).
3.  Sostituisci eventuali `alert()` nel codice JS con `showToast` o logica DOM.