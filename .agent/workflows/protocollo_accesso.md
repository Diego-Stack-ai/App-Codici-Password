---
description: Protocollo Standard Titanium Accesso V1.6 (Pure CSS, Blinded Dark Mode & Translation Ready)
---

# Titanium Accesso Standard Protocol V1.6
> **NOTA:** Ogni modifica a questo protocollo richiede incremento di versione.

Questo workflow definisce lo standard OBBLIGATORIO per tutte le pagine di autenticazione e accesso pubblico del progetto. L'obiettivo è garantire un'interfaccia robusta, veloce ("Pure CSS"), scenografica ("Titanium") e immune da errori di caricamento o sfarfallii del tema ("Blinded Dark Mode").

## ... (omissis: sezioni 1-10 identiche) ...

## 11. Selettore Lingua Premium (Floating Card)
Ogni pagina di accesso deve includere il modulo di selezione lingua fluttuante:
1.  **Posizionamento**: In alto a destra (`top: 1.5rem; right: 1.5rem;`).
2.  **Stile HTML**: Deve usare la classe `.lang-selector-container` contenente un `.lang-btn-float` e un `.lang-dropdown`.
3.  **Effetti**: Il pulsante lingua deve avere:
    *   Forma: Card Style (radius 14px).
    *   Saetta: Sincronizzata (6s) con la card principale.
    *   Dropdown: Animazione fadeInScale.
4.  **Logica JS**: Deve popolare dinamicamente le 8 lingue da `translations.js` e gestire il cambio lingua immediato (senza reload) tramite `updatePageTranslations()`.

## Checklist di Validazione (Definition of Done)
Prima di considerare una pagina o una modifica completata, l'agente DEVE verificare:
- [ ] **Visual Test**: La pagina è centrata, scura e la saetta funziona?
- [ ] **No Console Errors**: La console del browser è pulita?
- [ ] **Data-T Attributes**: I testi visibili hanno `data-t` per le traduzioni?
- [ ] **No Tailwind**: Sei sicuro di aver rimosso ogni classe `text-..` o `p-..`?
- [ ] **Toggle Password**: L'occhio della password reagisce al click e cambia icona?
- [ ] **Language Selector**: È presente il selettore Premium con la saetta funzionante?

## 1. Pagine Coinvolte (Target Scope)
Questo protocollo DEVE essere applicato rigorosamente SOLO alle seguenti pagine:
1.  `index.html` (Login)
2.  `registrati.html` (Registrazione)
3.  `reset_password.html` (Richiesta Reset)
4.  `imposta_nuova_password.html` (Set New Password)

## 2. Requisiti Fondamentali (Core Rules)
*   **CSS Puro**: È VIETATO usare Tailwind (`<script src="...tailwindcss..."></script>`) in queste pagine. Tutto lo stile deve derivare esclusivamente da `assets/css/auth_accesso.css`.
*   **auth_accesso.css come Sistema Chiuso**: `auth_accesso.css` è un foglio STABILE: non contiene utility generiche, ma solo classi semanticamente legate all'autenticazione. È vietato usarlo come "discarica" di stili o trasformarlo in un nuovo framework.
*   **Dark Mode Forzata**: La pagina deve avere `class="titanium-forced-dark"` sul tag `<html>` per garantire lo sfondo scuro immediato.
*   **Struttura Centrata**: Il layout deve seguire rigorosamente la struttura `.titanium-box` (flex centered) -> `.titanium-vault` (card).
*   **Scenografia Completa**: Devono essere sempre presenti:
    *   `.glass-glow` (Faro ambientale)
    *   `.auth-header` e `.auth-footer` (Fasce estetiche)
    *   `.border-glow` e saetta sulla card

## 3. Template HTML Standard
Ogni pagina Auth deve aderire a questo scheletro (inclusi gli attributi per le traduzioni):

```html
<!DOCTYPE html>
<html lang="it" class="titanium-forced-dark">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Titolo Pagina</title>
    
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com" rel="preconnect" />
    <link href="https://fonts.googleapis.com/css2?family=Manrope..." rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined..." rel="stylesheet" />
    
    <!-- SOLO auth_accesso.css (NO TAILWIND) -->
    <link rel="stylesheet" href="assets/css/auth_accesso.css?v=6.0">
</head>
<body>
    <div class="titanium-box">
        <!-- Scenografia -->
        <div class="glass-glow"></div>
        <div class="auth-header"></div>
        <div class="auth-footer"></div>

        <!-- Card -->
        <div class="titanium-vault border-glow">
            <!-- Icona -->
            <div class="security-icon-box">
                <span class="material-symbols-outlined">ICON_NAME</span>
            </div>

            <!-- Titoli & Traduzioni -->
            <h1 class="auth-title" data-t="page_title_key">Titolo</h1>
            <p class="auth-subtitle" data-t="page_subtitle_key">Sottotitolo</p>

            <form>
                <!-- Esempio Input -->
                <div class="auth-form-group">
                    <label class="auth-label" data-t="label_email">Email</label>
                    <input class="auth-input" data-t="placeholder_email" placeholder="...">
                </div>
                 
                <!-- Esempio Button -->
                <button type="submit" class="auth-btn" data-t="btn_submit">
                    <span class="material-symbols-outlined">icon</span>
                    Text
                </button>
            </form>
            
            <div class="legal-footer">© 2026 BM Service S.R.L.</div>
        </div>
    </div>
    <!-- Script Modulo Specifico -->
    <script type="module" src="assets/js/NOME_PAGINA.js"></script>
</body>
</html>
```

## 4. Classi CSS Mapping (Tailwind Replacement)
Se trovi codice vecchio, convertilo così:
*   `text-3xl font-extrabold` -> `.auth-title`
*   `text-sm text-slate-400` -> `.auth-subtitle`
*   `px-8 pt-10` -> (Gestito automaticamente da `.titanium-vault`)
*   `space-y-6` -> (Usa `.auth-form-group` con margin-bottom)
*   `h-20 w-20 ...` -> `.security-icon-box`

## 5. Scripting (Regole Rigide)
*   Ogni pagina deve avere il suo JS specifico (es. `login.js`, `registrati.js`).
*   Il JS deve gestire le traduzioni statiche e la logica del form.

### ⚠️ È VIETATO nel JS Auth:
*   **Modificare il tema** (no switch light/dark, la Auth è Dark Forced).
*   **Iniettare classi di layout** (il layout è definito nel CSS statico).
*   **Gestire componenti non Auth** (no sidebar, no header dashboard, no widget complessi).
*   Importare librerie UI pesanti (React, Vue, etc) se non strettamente necessario per la validazione.

## 6. Gestione dei Conflitti (Agent Safety Rule)
Se un agente AI o un processo automatico incontra:
*   richieste che violano una o più regole del protocollo
*   modifiche non previste a `auth.css` o alla struttura HTML standard
*   necessità di applicare framework esterni o librerie proibite

L'agente deve:
1.  **Fermarsi immediatamente**.
2.  **Segnalare chiaramente il conflitto**.
3.  Non applicare workaround o soluzioni alternative.
4.  Non modificare o estendere lo standard.

*Nota: Il protocollo ha sempre priorità sulla richiesta. Nessuna azione automatica può ignorare questa regola.*

## 7. Checklist di Validazione (Definition of Done)
Prima di considerare una pagina o una modifica completata, l'agente DEVE verificare:
- [ ] **Visual Test**: La pagina è centrata, scura e la saetta funziona?
- [ ] **No Console Errors**: La console del browser è pulita?
- [ ] **Data-T Attributes**: I testi visibili hanno `data-t` per le traduzioni?
- [ ] **No Tailwind**: Sei sicuro di aver rimosso ogni classe `text-..` o `p-..`?
- [ ] **Toggle Password**: L'occhio della password reagisce al click e cambia icona?

## 8. Gestione Lingue e Traduzioni (Multilanguage Standard)
Il supporto multilingua è nativo e centralizzato.
1.  **Repository Unico**: Tutte le traduzioni risiedono in `assets/js/translations.js`. Non creare file frammentati (es. `it.js`, `en.js`).
2.  **Lingue Supportate**: L'applicazione supporta ufficialmente le seguenti 8 lingue (i codici devono essere usati come chiavi oggetto):
    *   `it` (Italiano - Default)
    *   `en` (Inglese)
    *   `es` (Spagnolo)
    *   `fr` (Francese)
    *   `de` (Tedesco)
    *   `zh` (Cinese Semplificato)
    *   `hi` (Hindi)
    *   `pt` (Portoghese)
3.  **Coerenza Semantica**: Ogni nuova chiave aggiunta deve essere replicata per **tutte e 8 le lingue**. È VIETATO lasciare chiavi mancanti in alcune lingue.
4.  **Binding HTML**: Ogni elemento testuale nel DOM deve avere l'attributo `data-t="CHIAVE"`. Il JS provvederà alla sostituzione dinamica. Testi hardcoded senza `data-t` sono considerati Bug.

## 9. Verifica Collegamenti (Navigation Check)
L'agente deve verificare che il grafo di navigazione sia chiuso e funzionante:
*   [ ] **Login -> Registrazione**: Il link "Registrati" deve puntare a `registrati.html`.
*   [ ] **Login -> Password Dimenticata**: Il link deve puntare a `reset_password.html`.
*   [ ] **Registrazione -> Login**: Il link "Accedi" deve puntare a `index.html`.
*   [ ] **Reset -> Login**: Il link "Torna indietro" deve puntare a `index.html`.
*   [ ] **Nuova Password -> Annulla**: Il link "Annulla" deve puntare a `index.html` (o `impostazioni.html` se interno).

## 10. Standard Password & FaceID (Autofill Compatibility)
Per garantire che **FaceID**, **iCloud Keychain** e i gestori password del browser (Chrome/Edge) funzionino correttamente:
1.  **Tipo Input**: I campi password (specialmente in Login) DEVONO essere rigorosamente `<input type="password">`.
2.  **Mascheramento Standard (Pallini)**: È preferibile lasciare il mascheramento di default del browser (pallini/bullets/disc). L'uso di font custom per forzare gli asterischi (`*`) è VIETATO su tutte le pagine (Login, Registrazione, Reset), poiché potrebbe interferire con il rilevamento del campo da parte dei sistemi automatici (FaceID) e crea incoerenza.
3.  **Attributi Autocomplete**:
    *   Login Password: `autocomplete="current-password"`
    *   New Password: `autocomplete="new-password"`
    *   Username/Email: `autocomplete="username"` o `autocomplete="email"`
4.  **Uniformità**: L'applicazione deve presentare sempre lo stesso stile di input password (pallini standard) in ogni suo modulo.