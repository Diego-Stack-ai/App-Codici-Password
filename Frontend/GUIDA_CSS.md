# GUIDA RAPIDA CLASSI CSS E STANDARD CORE (V3.9 - Centralized Logic)

Questa guida definisce le regole di struttura, navigazione e logica del **Design System Master V3.9**. Tutte le pagine devono attenersi a questi standard per garantire velocità, sicurezza e coerenza.

---

## 1) Fondamenti del Sistema (Immersive Architecture)

### 1.1) Background & Glassmorphism (V3.9 Standard)
L'estetica si basa su interfacce trasparenti che poggiano su uno sfondo fisso.
- **Sfondo**: Classe `.base-bg` nel body con `background-attachment: fixed`.
- **Matrix Card**: Per grid interattive, usare il design Glassmorphism:
  - `backdrop-filter: blur(12px)`
  - Sfumature `rgba(255, 255, 255, 0.05)` (Dark) e contrasto adattivo.
  - **Icone Adattive**: In modalità Light, le icone devono ereditare `var(--text-primary)` per garantire leggibilità.

### 1.2) Scorrimento Nativo
- **Tassativo**: Lo scorrimento deve avvenire esclusivamente tramite il `body`.
- **Divieto**: È vietato l'uso di `overflow-y: auto` o `scroll` all'interno di `.base-container`.

---

## 2) Categorie di Pagine

### 2.1) Pagine "Servizio" (Autenticazione)
*Pagine: index.html, registrati.html, reset_password.html, imposta_nuova_password.html*
- **Layout**: Centratura tramite `.vault` con `margin-block: auto` (Mobile Friendly).
- **Effetti**: Devono includere `.saetta-master` (shimmer) e `.saetta-drop` (animazione verticale).

### 2.2) Pagine "Contenuto" (Applicazione)
- **Header (Fascia Alta)**: Layout "Balanced" con 3 aree (SX: Back/Avatar, C: Titolo, DX: Home/Logout).
- **Footer (Fascia Bassa)**: Layout "Balanced" (SX: Theme Switcher, DX: Settings).

---

## 3) Gestione Multilingua (Protocollo Cleanup V3.9)

L'applicazione utilizza un motore di traduzione **completamente centralizzato**. Non è ammesso scrivere logica di traduzione nei file JS delle singole pagine.

### 3.1) Automatizzazione
Grazie all'unione di `main.js` e `cleanup.js`, la traduzione avviene automaticamente al caricamento del DOM per tutti gli elementi con:
- `data-t="chiave"`: Contenuto testuale.
- `data-t-placeholder="chiave"`: Testo segnaposto negli input.
- `data-t-aria="chiave"`: Etichette di accessibilità.

### 3.2) Protezione Icone
Il motore di traduzione è istruito per preservare gli elementi `<span>` con classe `.material-symbols-outlined`. Questo permette di tradurre testi accanto alle icone senza cancellare l'aspetto visivo dei pulsanti.

---

## 4) Tipografia & Performance

### 4.1) Testata Standard (TASSATIVO)
Utilizzare esclusivamente la modularità V3.8/3.9 per caricare solo il CSS necessario:

```html
<!-- 1. Preload Font -->
<link rel="preload" href="assets/fonts/manrope/manrope-11.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/material-symbols/material-symbols-0.woff2" as="font" type="font/woff2" crossorigin>

<!-- 2. Core (Sempre necessari) -->
<link rel="stylesheet" href="assets/css/core_fonts.css">
<link rel="stylesheet" href="assets/css/core.css?v=3.8">
<link rel="stylesheet" href="assets/css/core_fascie.css">

<!-- 3. Pagina specifica -->
<link rel="stylesheet" href="assets/css/core_pagine.css?v=1.0">
```

---

## 5) Chiavi ARIA Standard (Accessibilità Universale)

Per mantenere coerenza, utilizzare sempre queste chiavi nel dizionario:
- `select_language`: Per il pulsante del selettore lingua.
- `show_hide_data`: Per il toggle visibilità password (occhio).
- `aria_profile`: Per il link all'utente nell'header.
- `aria_logout`: Per il pulsante di uscita.
- `aria_settings`: Per l'icona ingranaggio/tune.

---

## 6) Audit di Consolidamento (Checklist Finale)
1. **Traduzione**: Ogni stringa testuale, placeholder e label ARIA usa un attributo `data-t`?
2. **Modularità**: I file JS della pagina sono privi di logica `applyLocalTranslations`?
3. **Design**: Il blur nelle Matrix Card è impostato a 12px?
4. **Mobile**: Le icone sono cliccabili con feedback trasparente (`-webkit-tap-highlight-color: transparent`)?

---
*Ultimo aggiornamento: 11 Febbraio 2026 - Standard V3.9 (Centralized Logic & Glassmorphism Design)*
