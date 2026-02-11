# GUIDA RAPIDA CLASSI CSS E STANDARD CORE (V3.7)

Questa guida definisce le regole fondamentali di struttura, navigazione e classi CSS del **Design System Master V3.7**. Tutte le pagine devono attenersi a questi standard.

---

## 1) Fondamenti del Sistema

### 1.1) Background Universale
Tutte le pagine condividono lo stesso sfondo con gradiente e l'effetto dinamico garantito dalla classe `.base-bg`. È vietato sovrascrivere lo sfondo globalmente nelle singole pagine.

### 1.2) Reset Globale & Box Model
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
```

---

## 2) Categorie di Pagine

### 2.1) Pagine "Servizio" (Autenticazione)
*Pagine: index.html, registrati.html, reset_password.html, imposta_nuova_password.html*

- **Modalità**: Dark fissa (Nero).
- **Layout**: Nessun header/footer standard. Impossibilità di cambiare tema.
- **Container**: Obbligo di utilizzo classe `.card` con `.border-glow`.
- **Saetta System (Premium)**: Ogni card deve contenere il doppio effetto:
  1. `.saetta-master` (Shimmer metallico di sfondo, intensità ~8%).
  2. `.saetta-drop` (Linea verticale blu che cade).
- **Selettore Lingua**: Deve essere ancorato **dentro** la card in alto a destra (`.lang-selector-container` inside `.card`).
- **Responsive**: Sotto i 480px, la card si adatta a `width: 90%` con `max-width: 360px` per mantenere l’estetica "compatta" e centrata.

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

## 4) Tipografia & Performance (TASSATIVO)

- **Caricamento**: Usare esclusivamente `core_fonts.css` e i tag di `preload` per Manrope e Material Symbols.
- **Ordine**: 
  1. `<link rel="preload" ...>`
  2. `core_fonts.css`
  3. `core.css?v=3.7`
- **Zero Nuovi Font**: Non è ammesso l'uso di font esterni non censiti nel sistema.

---

## 5) Sicurezza & Integrità (Protocollo Security)

Ogni pagina deve includere le misure di protezione previste dal Protocollo V3.7:

- **CSP (Content Security Policy)**: Presente in testata come tag `<meta>`. Definisce le sorgenti autorizzate per script, stili e dati (Firebase/Google). È tassativo non rimuoverlo o indebolirlo.
- **Iconografia di Sicurezza**: Nelle pagine di servizio (Login/Reset), l'uso dell'icona `security` all'interno di `.icon-box` è lo standard visivo per indicare l'accesso al Vault.
- **Attributi Input**: Obbligo di usare `autocomplete="current-password"` o `new-password` e `type="password"` per la gestione sicura del portachiavi del browser.
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

## 7) Protocollo di Consolidamento Pagina (Revisione Atomica)

Il consolidamento dell'applicazione avviene secondo un processo **atomico per singola pagina**. Non è ammesso passare alla revisione di una nuova pagina se quella attuale non è conforme al 100%.

- **Check-list di Consolidamento**:
  1. **Audit CSS**: Allineamento completo al sistema di classi V3.7 (rimozione vecchi prefissi).
  2. **Audit Lingua**: Controllo che ogni stringa (testo, placeholder, aria-label) sia mappata in `translations.js`.
  3. **Audit Performance**: Verifica dei tag `preload` e dell'ordine di caricamento dei font.
- **Workflow**: Si lavora su una pagina alla volta su indicazione dell'utente. Ogni pagina completata deve essere considerata un "prodotto finito" e non deve richiedere ulteriori interventi strutturali.

---
*Ultimo aggiornamento: 11 Febbraio 2026 - Standard V3.7 (Full Architecture, Security & Multilingua)*