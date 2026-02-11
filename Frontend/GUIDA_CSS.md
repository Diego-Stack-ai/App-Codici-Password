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
*Ultimo aggiornamento: 11 Febbraio 2026 - Standard V3.7 (Full Architecture)*