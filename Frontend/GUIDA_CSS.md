# GUIDA RAPIDA CLASSI CSS E STANDARD CORE (V3.8 - Immersive Update)

Questa guida definisce le regole fondamentali di struttura, navigazione e classi CSS del **Design System Master V3.8**. Tutte le pagine devono attenersi a questi standard.

---

## 1) Fondamenti del Sistema (Immersive Architecture)

### 1.1) Background Universale & Immersivo
Tutte le pagine condividono lo stesso sfondo con gradiente gestito dalla classe `.base-bg` (Body).
- **Tassativo**: Il gradiente deve avere `background-attachment: fixed`. Lo sfondo non scorre, creando profondità mentre la card si muove sopra di esso.
- **Container**: La classe `.base-container` deve essere sempre **trasparente** (`background: transparent`) per mostrare lo sfondo del body.

### 1.2) Scorrimento Nativo (Zero Space Ghost)
Per evitare spazi vuoti in fondo alla pagina o tagli di contenuto in alto:
- **Tassativo**: Lo scorrimento deve avvenire esclusivamente tramite il `body`.
- **Divieto**: È vietato l'uso di `overflow-y: auto` o `scroll` all'interno di `.base-container` o `.vault`.

---

## 2) Categorie di Pagine

### 2.1) Pagine "Servizio" (Autenticazione)
*Pagine: index.html, registrati.html, reset_password.html, imposta_nuova_password.html*

- **Modalità**: Dark fissa (Nero).
- **Layout**: Centratura dinamica (Centred if short, scroll if long).
- **Centratura Robusta (Mobile)**: Sotto i 480px, la centratura è affidata a `margin-block: auto` sulla classe `.vault`. Questo garantisce che la card non venga mai "tagliata" in alto.
- **Saetta System (Premium)**: Ogni card deve contenere il doppio effetto:
  1. `.saetta-master` (Shimmer metallico di sfondo).
  2. `.saetta-drop` (Linea verticale blu che cade).
- **Faro (Glow)**: La classe `.base-glow` deve essere `position: fixed` per rimanere sempre visibile in alto mentre l'utente scorre.

### 2.2) Pagine "Contenuto" (Applicazione)
*Tutte le altre pagine (Home, Liste, Dettagli, Form, Impostazioni, ecc.)*

- **Modalità**: Adaptive (Switch Chiaro/Scuro).
- **Layout**: Struttura a fasce obbligatoria con Header e Footer.

#### A) Layout Header (Fascia Alta)
- **Sinistra**: Solo icona "Freccia" (`arrow_back`). La logica di ritorno deve essere lineare (es: Form -> Dettaglio -> Lista -> Home).
- **Centro**: Nome della pagina o Saluto Dinamico. Il titolo assume il colore del tema o del brand.
- **Destra**: Icona "Home" (`home`) sempre presente (tranne in Home).

#### B) Layout Footer (Fascia Bassa)
- **Sinistra**: Switch per modalità Chiaro/Scuro (`dark_mode` / `light_mode`).
- **Centro**: Icone funzionali specifiche della pagina (es: Aggiungi, Salva).
- **Destra**: Icona "Impostazioni" (`tune`) sempre presente (tranne in Impostazioni).

#### C) Stile Icone e Colori
- **Minimalismo**: Icone "nude", senza bordi o cerchi di sfondo.
- **Colore Dinamico**: Titoli e icone cambiano colore (Bianco/Deep Slate) in base al tema selezionato.

---

## 3) Eccezioni e Casi Specifici

### 3.1) Home Page (`home_page.html`)
- **Header SX**: Avatar utente (link a Profilo Privato). Niente freccia "Back".
- **Header DX**: Pulsante Logout. Niente icona "Home".
- **Titolo**: Saluto dinamico (es: "Ciao, Nome"), centrato.

### 3.2) Profilo & Impostazioni
- **Layout SX/C/DX**: Standard (Back, Titolo, Home).
- **Footer DX**: Nella pagina Impostazioni, l'icona `tune` deve apparire opaca o disabilitata per indicare lo stato "Current Page".

---

## 4) Tipografia & Performance (TASSATIVO V3.8)

Per eliminare i warning del browser ("preload not used") e garantire velocità massima:

- **Caricamento**: Usare esclusivamente `core_fonts.css`.
- **Preload**: Inserire SEMPRE i tag di preload prima di qualsiasi CSS.
- **Anti-Flicker**: Inserire `data-i18n="loading"` nel tag `<html>` per evitare sbalzi di testo durante la traduzione.

### 4.1) Blocco Standard Testata (Copia & Incolla)
Ogni nuova pagina deve iniziare con questa struttura nell' `<head>`:

```html
<!-- 1. Preload Font (Velocità) -->
<link rel="preload" href="assets/fonts/manrope/manrope-11.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/material-symbols/material-symbols-0.woff2" as="font" type="font/woff2" crossorigin>

<!-- 2. Core Fonts (Forzatura Body & Icone) -->
<link rel="stylesheet" href="assets/css/core_fonts.css">

<!-- 3. Design System (Layout & Temi) -->
<link rel="stylesheet" href="assets/css/core.css?v=3.8">
```

- **Zero Nuovi Font**: Non è ammesso l'uso di font esterni o file `fonts.css` obsoleti nelle nuove pagine standardizzate.

---

## 5) Sicurezza & Integrità (Protocollo Security)

Ogni pagina deve includere le misure di protezione previste dal Protocollo V3.8:

- **CSP (Content Security Policy)**: Presente in testata come tag `<meta>`. Definisce le sorgenti autorizzate per script, stili e dati (Firebase/Google). È tassativo non rimuoverlo o indebolirlo.
- **Iconografia di Sicurezza**: Nelle pagine di servizio (Login/Reset), l'uso dell'icona `security` all'interno di `.icon-box` è lo standard visivo per indicare l'accesso al Vault.
- **Attributi Input**: Obbligo di usare `autocomplete="current-password"` o `new-password` e `type="password"`. 
- **Mapping Credenziali**: Nelle pagine di impostazione nuova password, inserire sempre un campo `<input name="username" style="display:none">` per permettere ai Password Manager di associare correttamente la password all'account.
- **Viewport Protection**: Utilizzo di `viewport-fit=cover` e restrizioni allo zoom per evitare "break" visivi su dispositivi mobili durante l'inserimento dati.

---

## 6) Gestione Multilingua (Protocollo Translations)

L'applicazione utilizza un sistema di traduzione centralizzato in `assets/js/translations.js`.

- **Attributi Tassativi**:
  - `data-t="chiave"`: Per tradurre il contenuto testuale (`textContent`).
  - `data-t-placeholder="chiave"`: Per tradurre il placeholder degli input.
  - `data-t-aria="chiave"`: Per tradurre gli attributi `aria-label` (accessibilità).
- **Metodo Tassativo**: È vietato inserire stringhe di testo fisse nell'HTML. Ogni parola deve passare dal dizionario.
- **Pulizia**: Rimuovere sempre le chiavi obsolete (es. `login_hint`) per mantenere il sistema leggero ed evitare confusione.
- **Integrità**: In caso di aggiunta di una nuova chiave, questa deve essere replicata in tutte le lingue supportate (IT, EN, ES, FR, DE).

---

## 7) Protocollo di Consolidamento Pagina (Audit V3.8)

Ogni pagina completata deve superare i seguenti controlli:
1. **Audit Immersivo**: Lo sfondo è fisso? Il container è trasparente?
2. **Audit Scroll**: Lo scorrimento è delegato al body? Non ci sono overflow interni?
3. **Audit Lingua**: Ogni stringa è mappata? Placeholder e ARIA inclusi?

---
*Ultimo aggiornamento: 11 Febbraio 2026 - Standard V3.8 (Immersive Architecture & Mobile Robustness)*