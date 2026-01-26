### Regola 0 – I 5 Pilastri Fondamentali (DNA Titanium)
•  Gli effetti [#1], [#2], [#3], [#4], [#5] costituiscono la **Fondazione Obbligatoria** dell'App.
•  Siamo in presenza di un'architettura dual-core: ogni pilastro ha una variante **Dark (Metallo Blu)** e una variante **Light (Platino Cristallo)**.
•  **NON OPZIONALI**: Ogni pagina deve caricare questi 5 elementi. Se mancano, la pagina non rispetta il protocollo.
•  Questi effetti sono protetti: non possono essere nascosti dalla Regola [#19].

________________________________________

### Regola 1 – CSS critico subito
•	Tutti i colori di sfondo principali devono essere definiti subito all’apertura della pagina.
•	Colore sfondo pagina e contenitore principale: obbligatoriamente gradiente blu scuro (Metodo Titanium).
•	Script critici (Firebase core: auth, database) caricati subito insieme al contenuto.
•	Script secondari (analytics, crashlytics) possono essere caricati differiti.

________________________________________

### Regola 2 – Colori base e Dual Theme

**Obiettivo:** Definire l'uso di colori e gradienti in modalità Dark/Light, rispettando il Metodo Titanium.

**Linee guida operative:**
*   **Effetti principali (Registro Titanium)**: `.titanium-bg`, `.titanium-box`, `.glass-glow`. Gestiscono già dual theme tramite classi `.dark` o predisposizione.
*   **Classi semantiche e palette**: `.matrix-blue`, `.fusion-blue`. Devono rimanere neutre finché il Light non è richiesto.
*   **Utility Tailwind dark**: Usata solo per micro-dettagli (es. divider). Mai colori hardcoded.

**Nota Light (Platinum):**
*   La variante Light si costruisce solo se necessaria.
*   **Principio Chiave:** "Non definire colori Light arbitrari; creare solo quelli necessari alle pagine o componenti Platinum/Light."

________________________________________

### Regola 3 – Gestione Tema App (Chiaro/Auto/Scuro)
•	L'app deve gestire 3 stati tramite pulsante in Impostazioni:
    1. **Chiaro**: Forza la rimozione della classe `dark`.
    2. **Scuro**: Forza l'aggiunta della classe `dark`.
    3. **Automatico**: Segue `window.matchMedia`.
•	**Priorità Anti-Interferenza**: La scelta utente (`localStorage.theme`) VINCE SEMPRE sul sistema.
•	**Script Critico**: Script sincrono in `<head>` obbligatorio per evitare flicker.

________________________________________

### Regola 4 – Layout e gestione dello scroll

•	Header e footer sempre fixed (z-index > contenuto).
•	Scroll solo sul contenitore centrale, responsivo.
•	**Contenitori Strutturali**: Wrapper e griglie NON intercettano interazioni (non cliccabili).
•	**Elementi Funzionali**: Solo card, pulsanti, link e input sono interattivi.
•	**Scroll e Interazione**: Non devono interferire con effetti visivi o beacon.

________________________________________

### Regola 5 – Aiuto contestuale (Titanium Help Block)
•	Ogni pagina deve fornire un blocco di aiuto informativo standard.
*   **Implementazione**: Usare la classe CSS `.titanium-help-block`.
*   **Caratteristiche**:
    *   Testi brevi, chiari, in corsivo.
    *   Sempre non selezionabili (`user-select-none`).
    *   Dual Theme Automatico: Bianco 25% (Dark), Slate 40% (Light).
*   **Utilizzo**: `<p class="titanium-help-block">Testo guida qui...</p>`.

________________________________________

### Regola 6 – Tailwind CSS
•	Usare per layout, moduli ed effetti.
•	Gestione Dual Theme obbligatoria tramite classi `dark:` o classi semantiche.
•	Non usare colori hardcoded isolati; fare riferimento agli Effetti [#1]- [#16].

________________________________________

### Regola 7 – Regole operative Antigravity
•	Leggere tutte le regole prima di generare codice.
•	Non modificare layout o logica senza permesso.
•	Rispettare layout base, tema bloccato, contenitore responsivo.
•	Attendere input specifico per ogni pagina.

________________________________________

### Regola 8 – Sicurezza & utenti
•	Ogni utente vede solo dati propri o condivisi.
•	Password e dati sensibili protetti da Security Rules.
•	Eliminazione dati: `confirm()` obbligatorio. Mai eliminazioni silenziose.

________________________________________

### Regola 9 – Sintesi visiva
•	Sfondo e contenitore seguono il tema attivo (vedi Effetti [#1] e [#2]).
•	Scroll rispetta overlaping e z-index.
•	Usa sempre le classi standard del Registro Effetti.

________________________________________

### Regola 10 – Standard Layout Universale “Glass Frame”
•	Body: zero padding verticale.
•	Contenitore principale: `min-h-screen`, `shadow`, `overflow-hidden`.
•	Fasce Glass: fixed, z-50, backdrop-blur.
•	Contenuto scorre dietro, ultimo blocco `mb-24`.

________________________________________

### Regola 11 – Configurazione colori e pagine

**Descrizione:** Gestione colori ed effetti con focus su leggibilità e coerenza.

*   **Colori Universali**: Definiti nel Registro Effetti [#1]-[#16].
*   **Effetti Obbligatori**: Hover [#6], Beacon [#7], Border Glow [#9].
*   **Palette**: Definite pagina per pagina o Matrix Palette [#15].
*   **Dual Theme**: Blocchi informativi seguono il tema attivo.
*   **Nota**: Per la protezione testi vedi Regola 17.

________________________________________

### Regola 12 – Responsive design
•	Layout mobile-first.
•	Griglie adattive (1 col mobile -> 4 col desktop).
•	Elementi interattivi coerenti su tutti i device.

________________________________________

### Regola 13 – Eccezioni e elementi speciali
•	Pulsante “+” in header (z-50) è gestito centralmente.
•	Gestione allegati centralizzata (`gestione_allegati.html`).
•	Tutti gli elementi seguono il contrasto del tema attivo.

________________________________________

### Regola 14 – Registro Pagine Metodo Titanium

Monitoraggio dello stato di avanzamento.
🔴 DA FARE |  INCOMPLETA (Dual Theme Req.) | 🟢 COMPLETATA

| # | Stato | Nome Pagina | Effetti Addizionali (ID) | Palette / Colori |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 🟢 COMPLETATA | `index.html` (Login) | 9, 19, 20, 21 | Fusion Blue |
| 2 | 🟢 COMPLETATA | `registrati.html` | 9, 19, 20, 21 | Fusion Blue |
| 3 | 🟢 COMPLETATA | `reset_password.html` | 9, 19, 20, 21 | Fusion Blue |
| 4 | 🟢 COMPLETATA | `imposta_nuova_password.html` | 9, 19, 20, 21 | Fusion Blue |
| 5 | 🔴 DA FARE | `account_azienda.html` | Titanium Frame | Beacon (4s) | Premium | Matrix Interno |
| 6 | 🟠 INCOMPLETA | `account_privati.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | **Titanium Glass Cards** |
| 7 | 🔴 DA FARE | `aggiungi_account_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 8 | 🟠 INCOMPLETA | `aggiungi_account_privato.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 9 | 🔴 DA FARE | `aggiungi_nuova_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 10 | 🔴 DA FARE | `aggiungi_scadenza.html` | Titanium Frame | Beacon (4s) | Dinamico | Matrix Scadenze |
| 11 | 🔴 DA FARE | `modifica_account_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 12 | 🔴 DA FARE | `modifica_account_privato.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 13 | 🔴 DA FARE | `modifica_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 14 | 🟢 COMPLETATA | `home_page.html` | 6, 9, 10, 15 | Matrix Fusion |
| 17 | 🟠 INCOMPLETA | `dati_anagrafici_privato.html` | 6, 9, 10, 13 | **Titanium Glass Section Box** |
| 18 | 🟠 INCOMPLETA | `area_privata.html` | 9, 11 | **Dashboard Navigazione** |
| 19 | 🟠 INCOMPLETA | `scadenze.html` | 6, 9, 10, 13 | **Scadenze** |
| 20 | 🟠 INCOMPLETA | `lista_aziende.html` | Standard | Palette Standard |
| 21 | 🟠 INCOMPLETA | `archivio_account.html` | 6, 9, 10 | Matrix Sidebar |
| 22 | 🟢 COMPLETATA | `impostazioni.html` | 6, 9, 10, 21 | Fusion Blue |
| 23 | � COMPLETATA | `regole_scadenze_veicoli.html` | 6, 9, 10, 21 | Dark Menu Glow |
| 24 | 🟠 INCOMPLETA | `configurazione_automezzi.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 25 | 🟠 INCOMPLETA | `configurazione_documenti.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 26 | 🟠 INCOMPLETA | `configurazione_generali.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 27 | 🔴 DA FARE | `privacy.html` | Titanium Frame | Beacon (4s) | Standard | Glass Read-Only |
| 28 | 🔴 DA FARE | `gestione_scadenze.html` | Titanium Frame | Beacon (4s) | Dinamico | Matrix Scadenze |
| 29 | 🔴 DA FARE | `gestione_urgenze.html` | Titanium Frame | Beacon (4s) | Dinamico | Red Glow Matrix |
| 30 | 🔴 DA FARE | `gestione_memorandum.html` | Titanium Frame | Beacon (4s) | Standard | Memo Matrix |
| 31 | 🔴 DA FARE | `gestione_memo_condivisi.html` | Titanium Frame | Beacon (4s) | Standard | Memo Shared Matrix |
| 32 | 🔴 DA FARE | `lista_contatti.html` | Titanium Frame | Beacon (4s) | Standard | Icone Contatti |
| 33 | 🟠 INCOMPLETA | `notifiche_history.html` | 1, 2 | 3 | 4, 5 | Fusion Blue |
| 34 | 🟠 INCOMPLETA | `dettaglio_account_privato.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | **Titanium Glass Fields** |

________________________________________

### Regola 15 – Impostazione Effetti Metodo Titanium

Gli effetti del design system sono definiti nel dettaglio nel file dedicato: `TITANIUM_EFFECTS.md`.

| ID | Nome Effetto | Riferimento 🟢 | Light 🟢 | Descrizione |
| :--- | :--- | :--- | :--- |
| **[#1]** | **Sfondo Pagina** | `.titanium-bg` 🟢 | SÌ 🟢 | Base obbligatoria per tutti i temi |
| **[#2]** | **Titanium Box (Frame)** | `.titanium-box` 🟢 | SÌ 🟢 | La scocca esterna metallica (Obbligatoria) |
| **[#3]** | **Faro (Glass Glow)** | `.glass-glow` 🟢 | SÌ 🟢 | Luce ambientale pulsante (300% altezza per scrolling) |
| **[#4]** | **Header Fusion** | `.titanium-header` 🟢 | SÌ 🟢 | Barra superiore fissa con effetto Glass e blur |
| **[#5]** | **Footer Fusion** | `.titanium-footer` 🟢 | SÌ 🟢 | Barra inferiore fissa con effetto Glass e blur |
| **[#6]** | **Hover** | `.titanium-interactive` 🟢 | NO 🟢 | Micro-interazione che alza l'elemento all'hover |
| **[#7]** | **Beacon** | `.beacon-light` 🟢 | SÌ 🟢 | Faretto zenitale centrale per tridimensionalità |
| **[#8]** | **Beacon Gold** | `.beacon-gold` 🟢 | SÌ 🟢 | Faretto asimmetrico per card larghe |
| **[#9]** | **Border Glow** | `.border-glow` 🟢 | SÌ 🟢 | Perimetro luminoso cristallino (Dark) o solido (Light) |
| **[#10]**| **Glass Shine** | `.glass-shine` 🟢 | SÌ 🟢 | Riflesso vetroso diagonale all'hover su pulsanti e barre |
| **[#13]** | **Saetta (Master Grade)** | `.saetta` 🟢 | SÌ 🟢 | **UNICA** definizione ufficiale del riflesso metallico. Potente, z-index 999. |
| **[#15]** | **Matrix Palette** | `.matrix-blue` etc. 🟢 | SÌ 🟢 | Sistema di colori semantici per box e card |
| **[#16]**| **Glass Card** | `.titanium-glass-card` 🟢 | SÌ 🟢 | Sfondo semitrasparente blurrato per elementi in lista |
| **[#17]**| **Swipe Safety** | (JS Logic) 🟢 | NO 🟢 | Blocca click e navigazione durante lo swipe degli elementi nelle liste (Swipe List) |
| **[#19]**| **Visibilità Selettiva** | `.titanium-hide` 🟢 | SÌ 🟢 | Nasconde componenti standard (es. selettore tema) in pagine specifiche |
| **[#20]**| **Sicurezza Tema Forzato** | `.titanium-forced-dark` 🟢 | SÌ 🟢 | Blocca la pagina in Dark Mode per privacy e coerenza grafica |
| **[#21]**| **Titanium Vault (Card)** | `.titanium-vault` 🟢| SÌ 🟢 | Il box centrale "forziere" per Login e Registrazione |
________________________________________

#### Regola 16 - Caratteristiche Box e Pulsanti
- **Box Matrix [#15]**: Le card principali sono ibride: fungono da contenitori ma hanno comportamenti da pulsante (`.titanium-interactive` [#6]). All'hover si alzano (`translateY`) e attivano il `.glass-shine` [#10].
- **Watermark**: Ogni card ha un'icona di sfondo (`.bg-icon-container`) che ruota e si ingrandisce all'hover per dare profondità.
- **Liste**: Gli elementi in lista usano la `.titanium-glass-card` [#16], ottimizzata per lo scroll fluido, accoppiata alla logica **Swipe Safety** [#17].

#### Regola 17 - Integrazione Dati (Logic Layer)
- **Profilo**: Caricamento asincrono di Nome, Cognome e Avatar da Firestore (`users/{uid}`).
- **Badge Notifiche**: Le card Scadenze e Urgenze mostrano badge numerici popolati in tempo reale dai moduli JS.
- **Header/Footer**: Caricati dinamicamente tramite placeholder e la funzione `initComponents()`.

________________________________________

### Regola 17 – Protezione testi
**Descrizione:**
Tutti i testi descrittivi, istruzioni e messaggi informativi devono essere non copiabili e non selezionabili.

**Implementazione Pratica (Classi Utility):**
```css
.user-select-none {
    @apply select-none; /* Tailwind */
    user-select: none;
}
```

**Utilizzo:**
*   Applicare a: Blocchi testo, tooltip, messaggi aiuto.
*   NON applicare a: Pulsanti, Link, Input.
*   Codice: `<div class="user-select-none text-gray-400 ...">`

________________________________________

### Regola 18 – Allineamento Premium Titanium (Simmetria Enterprise)
**Obiettivo**: Garantire una simmetria perfetta e un allineamento "al righello" di tutti i contenuti.

**Linee guida operative**:
1.  **Standard Matrix (52 pixel)**: Obbligatorio per Box Matrix, Dashboard e Sezioni Informative.
    *   *Calcolo*: 8px (Margine esterno/Padding Box) + 44px (Padding interno al contenuto).
    *   *Effetto*: Il testo (Titoli, Liste, Paragrafi) deve iniziare esattamente a 52px dal bordo esterno del contenitore.
2.  **Standard Liste/Form (Allineamento Dinamico)**:
    *   Per liste di pulsanti (es. Impostazioni) o input fields, mantenere l'allineamento verticale degli elementi (Icone/Titoli) sulla stessa linea dei 52px, ma con padding laterali che favoriscano la cliccabilità su mobile.
3.  **Simmetria**: Il margine deve essere identico sia a **Sinistra** che a **Destra**.
    *   **Perimetri (Light)**: Bordo solidale coordinato di **2px** (tramite `outline` per evitare clipping).
### Regola 19 – Visibilità Selettiva (Hidden State)
**Obiettivo:** Gestire la scomparsa di componenti standard in pagine critiche o stati pre-autenticazione.

**Linee guida operative:**
*   Utilizzare la classe utility `.titanium-hide` per rimuovere elementi dall'interfaccia senza alterare permanentemente il DOM.
*   **Casi d'uso**: Nascondere il selettore tema o il pulsante impostazioni nella pagina di Login.
*   **Comportamento**: L'elemento deve essere completamente invisibile e non occupare spazio (`display: none !important`).

________________________________________

### Regola 20 – Sicurezza Tema Forzato (Security Dark Mode)
**Obiettivo:** Blindare esteticamente le pagine di accesso per trasmettere un senso di impenetrabilità e privacy.

**Linee guida operative:**
*   Aggiungere la classe `.titanium-forced-dark` al tag `<html>` della pagina.
*   **Effetto**: La pagina rimane in modalità Dark indipendentemente dalle preferenze utente salvate nel `localStorage`.
*   **Contextual Hiding**: Questa regola attiva automaticamente la Regola 19 sul selettore del tema per evitare incoerenze visive.




________________________________________

### Regola 21 – Pulizia Strutturale (External Assets Only)
**Obiettivo:** Trasformare i file HTML in "gusci" puri, delegando tutta la logica e lo stile a file esterni per massima manutenibilità.

**Linee guida operative:**
*   **Zero CSS Inline**: Non utilizzare il tag <style> dentro i file HTML. Tutte le regole devono trovarsi in titanium.css o file CSS dedicati.
*   **Zero Logica Manuale nell'Header**: Non inserire link a Google Fonts, Material Symbols o Meta Tag Theme-Color manuali. Tutto il pre-caricamento critico è delegato a `titanium-core.js`.
*   **Zero JS Logic Inline**: Non scrivere la logica delle funzioni o i listener dei form dentro i file HTML.
*   **Modulo Unico**: Ogni pagina deve avere un singolo punto di ingresso JS specifico (es. <script type="module" src="assets/js/nome_pagina.js"></script>).
*   **Ereditarietà**: La pagina deve fidarsi delle regole globali; se serve un'eccezione, va creata una classe di utility nel registro effetti.

________________________________________

### Regola 22 – Protocollo di Ottimizzazione HTML (TEMPORANEA)
**Obiettivo:** Standardizzare e ripulire sistematicamente i file HTML esistenti portandoli al livello "Titanium Gold".

**⚠️ NOTA IMPORTANTE:** Questa regola serve esclusivamente come guida operativa strutturale per completare la trasformazione di tutti i file del progetto. **AL TERMINE DEI LAVORI, QUESTA INTERA REGOLA DEVE ESSERE CANCELLATA DAL MANUALE.**

**Istruzioni operative per i prossimi file HTML:**

1.  **Collegamento Motore (Master Core)**: Verificare che nell'header sia presente il link al file mastro: `<script src="assets/js/titanium-core.js"></script>`. Questo file gestisce automaticamente: Tema (anti-flicker), Font (Manrope), Icone e Protezioni UI.
2.  **Collegamento Stile (Master CSS)**: Verificare che nell'header sia presente `<link rel="stylesheet" href="assets/css/titanium.css">`.
2.  **Applicazione Regole Fondamentali (1-5)**:
    *   **Regola 1**: Applicare la classe `titanium-bg` al tag `<body>` per lo sfondo critico.
    *   **Regola 2**: Usare la classe master `.titanium-box` per il contenitore principale (sostituendo classi Tailwind manuali).
    *   **Regola 3**: Inserire `<div class="glass-glow"></div>` (Faro animato) all'inizio del contenitore.
    *   **Regola 4**: Sostituire Header e Footer fisici con i placeholder: `<div id="header-placeholder"></div>` e `<div id="footer-placeholder"></div>`.
    *   **Regola 5**: Inserire il blocco di aiuto informativo (Testo guida) protetto da `user-select-none`.
3.  **DNA Tipografico (Coerenza Visiva)**: Tutte le informazioni secondarie (Versioni nel footer, testi di aiuto nelle card, note tecniche) devono usare lo stesso formato:
    *   Classe: `text-[10px] text-white/30 italic user-select-none`.
    *   Niente maiuscolo forzato (scrivere come testo normale, es: "Versione 5").
4.  **Pulizia Asset (Regola 21)**: Eliminare ogni riga di CSS inline (`<style>`) e spostare la logica Javascript in un file esterno dedicato: `assets/js/nome_pagina.js`.
5.  **Integrazione JS**: Richiamare il modulo JS a fine body: `<script type="module" src="assets/js/nome_pagina.js"></script>`.
6.  **Controllo Effetti Dinamici**: Inserire div di servizio come `.saetta-master` all'inizio del tag `<main>`, basandosi sulla **tabella della Regola 14** per gli ID effetto.
7.  **UX Blinda (Menu Contestuale)**: Verificare che il file `main.js` sia collegato correttamente. Questo assicura che il menu contestuale e la selezione siano disabilitati (eccetto negli input), dando l'effetto app nativa e impedendo azioni non autorizzate (ispeziona, copia URL, ecc.).
8.  **Pulizia Residui**: Rimuovere ogni classe Tailwind orfana o commento superfluo che non serva alla struttura pura.
9.  **Architettura 10/10 (Moduli)**: La logica JS non deve essere ammassata in un unico file. Verificare la distribuzione:
    *   `ui-core.js`: Policy globali e feedback di sistema (Toast).
    *   `ui-components.js`: Logica componenti universali (Toggles, Copy).
    *   `ui-pages.js`: Logica specifica di pagina.
    *   `utils.js`: Helper puri (date, chiamate).
    *   `main.js`: Semplice entry-point (`type="module"`) che importa e inizializza i moduli sopra citati.
10. **Refinement Enterprise**:
    *   **Selezione Semantica**: Evitare selettori HTML generici (es. `button[type=submit]`). Usare attributi descrittivi (es. `[data-login-submit]`) per slegare la logica dalla struttura.

________________________________________

### Regola 23 – Gestione Header Dinamico (Standard Injection)
**Obiettivo:** Personalizzare Titolo e Navigazione senza rompere la struttura dell'Header nativo (Regola 4).

**Protocollo Operativo:**
1.  Usare sempre `initComponents().then(...)` nel file JS della pagina.
2.  Targettare l'elemento interno `header-content` (NON il placeholder esterno).
3.  Iniettare la struttura Flex standard per garantire l'allineamento.

**Snippet Standard (JS):**
```javascript
initComponents().then(() => {
    const headerStack = document.getElementById('header-content');
    if (headerStack) {
        // Configurazione Layout
        headerStack.style.display = 'flex';
        headerStack.style.justifyContent = 'space-between';
        headerStack.className = "px-4 w-full flex items-center relative";

        // Iniezione Contenuto
        headerStack.innerHTML = `
            <!-- 1. Pulsante BACK (Opzionale) -->
            <a href="pagina_precedente.html" class="btn-icon-header border-glow flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-white">
                <span class="material-symbols-outlined">arrow_back</span>
            </a>

            <!-- 2. TITOLO (Centrato Assoluto) -->
            <h2 class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
                NOME PAGINA
            </h2>

            <!-- 3. Pulsante HOME (Opzionale) -->
            <a href="home_page.html" class="btn-icon-header border-glow flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-white">
                <span class="material-symbols-outlined">home</span>
            </a>
        `;
    }
});
```
**Nota:** Se un pulsante (Back o Home) non serve, rimuovere semplicemente il blocco `<a>` corrispondente. Il titolo rimarrà perfettamente centrato.

**Variante per Footer (Opzionale):**
La stessa logica si applica al footer. Targettare `footer-content` per iniettare, ad esempio, la versione dell'app o azioni secondarie.
```javascript
const footerStack = document.getElementById('footer-content');
if (footerStack) {
    footerStack.innerHTML = `<span class="text-[9px] opacity-30 tracking-widest">${t('version')}</span>`;
}
```
    *   **Stato Globale**: Usare hook di stato sul body (es. `is-auth-loading`) durante i processi critici per gestire feedback visuali e blocchi di interazione a livello di sistema.
    *   **Zero Duplicazione**: Non riscrivere la logica dei componenti (es. toggle password) nei moduli di pagina se è già gestita dai componenti globali.
