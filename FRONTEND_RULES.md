### Regola 0 – I 5 Pilastri Fondamentali (Design System Titanium)
1.  **Tridimensionalità Metallica**: Uso estensivo di riflessi, bordi cristallini e profondità.
2.  **Dual Theme (Platinum vs Titanium)**: Supporto perfetto a Light Mode (Platinum Cristallo) e Dark Mode (Titanium Deep).
3.  **Simmetria Enterprise**: Allineamento millimetrico (Standard Matrix 52px).
4.  **Effetti Dinamici**: Beacon, Glas Shine, Saette e Glow.
5.  **Modularità JS**: Standard Injection per Header e Footer.

________________________________________

### Regola 1 – Colori e Temi (Dual Theme Premium)
Le interfacce devono supportare attivamente i due temi ufficiali del sistema Titanium.

**1. Sfondo Principale (.titanium-bg):**
*   **Modalità Dark (Titanium Deep):** Sfondo scuro profondo (#0a0f1e) con gradienti radiali Blue/Indigo.
*   **Modalità Light (Platinum Cristallo):** Sfondo chiaro etereo (#f0f4f8) con accenti ghiaccio e trasparenze cristalline.
*   **Pagine di Accesso (Login/Registrati/Reset):** Devono essere forzate in Dark Mode (Regola 20) per trasmettere sicurezza.

**2. Contrasti e Leggibilità:**
*   In Dark Mode: Testi bianchi/grigio chiaro (text-white, text-gray-300).
*   In Light Mode: Testi grigio fumo/antracite (text-gray-900, text-gray-700) per contrasto massimo su sfondi chiari.
*   **ATTENZIONE:** Mai forzare "text-white" in pagine che supportano il tema Light, utilizzare sempre le classi duali (es. `text-gray-900 dark:text-white`).

________________________________________

### Regola 2 – Header Fusion (#4)
*   **Tipologia:** Sticky (fixed top-0), Glassmorphism (blur-md).
*   **Struttura:** 
    1.  Pulsante azione Sinistra (es. Back): `btn-icon-header`.
    2.  Titolo Centrale: `text-xs font-black uppercase tracking-widest center-absolute`.
    3.  Pulsante azione Destra (es. Home): `btn-icon-header`.
*   **Dual Theme Header:** 
    *   In Dark: Sfondo scuro trasparente (`bg-black/20`).
    *   In Light: Sfondo chiaro trasparente (`bg-white/80`).

________________________________________

### Regola 3 – Footer Fusion (#5)
*   **Tipologia:** Sticky (fixed bottom-0), Glassmorphism.
*   **Contenuto:** Di solito ospita il numero di versione dell'app in stile futuristico (mono, uppercase, tracking-wide).

________________________________________

### Regola 4 – Modulo Autenticazione (Vault Style #21)
*   Utilizzato per Login, Registrazione e Reset.
*   Contenitore centrale fisso: `titanium-vault`.
*   Input Field: `titanium-input-glass`. Sfondo semitrasparente, bordo che si illumina al focus.

________________________________________

### Regola 5 – Titanium Box (#2)
La "scocca" dell'applicazione. Deve contenere tutto il `main`, garantendo margini coerenti e ombreggiature metalliche profonde.

________________________________________

### Regola 6 – Faro (Glass Glow #3)
Elemento decorativo ad altezza variabile che proietta una luce soffusa dallo sfondo. Si muove o pulsa per dare vita all'interfaccia.

________________________________________

### Regola 7 – Matrix Palette (#15)
Ogni sezione deve avere un colore dominante che ne definisce l'identità:
*   **Blue/Indigo**: Account, Login, Generale.
*   **Emerald/Green**: Successo, Risparmio.
*   **Amber/Orange**: Scadenze, Documenti.
*   **Rose/Red**: Urgenze, Errori.
*   **Purple**: Roadmap, Roadmap Futura.

________________________________________

### Regola 8 – Elementi Interattivi (Pulsanti e Card)
*   **Effetto Saetta (#13):** Un riflesso metallico che scorre sopra l'elemento.
*   **Glass Shine (#10):** Riflesso che si attiva all'hover.
*   **Border Glow (#9):** Bordo che si illumina in base allo stato o al tema.

________________________________________

### Regola 9 – Iconografia e Font
*   **Font:** Manrope (Display e Body).
*   **Icone:** Material Symbols Outlined.
*   **Utilizzo:** Dimensioni standard 20px per icone liste, 24px per icone header.

________________________________________

### Regola 10 – Standard Matrix Allineamenti (Simmetria Enterprise)
Ogni contenuto all'interno delle card deve rispettare un padding standard.
*   **Titoli Sezione:** Padding-x 20px, Font-bold, 10px size.
*   **Liste:** Dividers trasparenti (`divide-white/5` o `divide-gray-200`).

________________________________________

### Regola 11 – Protezione contro il copia e incolla
Vedi Regola 17 (Titanium Help Block).

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
| 9 | 🔴 DA FARE | `dati_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Info Grid |
| 10 | 🔴 DA FARE | `lista_aziende.html` | Titanium Frame | Beacon (4s) | Standard | Matrix List |
| 11 | 🔴 DA FARE | `modifica_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Edit Grid |
| 12 | 🔴 DA FARE | `area_privata.html` | Titanium Frame | Beacon (4s) | Dashboard | Matrix Home |
| 13 | 🔴 DA FARE | `dati_anagrafici_privato.html` | Titanium Frame | Beacon (4s) | Standard | Info Grid |
| 14 | 🔴 DA FARE | `aggiungi_nuova_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Form Matrix |
| 15 | 🔴 DA FARE | `dettaglio_scadenza.html` | Titanium Frame | Beacon (4s) | Amber | Detail View |
| 16 | � DA FARE | `aggiungi_scadenza.html` | Titanium Frame | Beacon (4s) | Standard | Form Matrix |
| 17 | � DA FARE | `archivio_account.html` | Titanium Frame | Beacon (4s) | Standard | Matrix List |
| 18 | � DA FARE | `home_page.html` | Titanium Frame | Beacon (4s) | Dashboard | Home Matrix |
| 19 | 🟠 INCOMPLETA | `scadenze.html` | 6, 9, 10, 13 | **Scadenze** |
| 20 | 🟠 INCOMPLETA | `lista_aziende.html` | Standard | Palette Standard |
| 21 | 🟠 INCOMPLETA | `archivio_account.html` | 6, 9, 10 | Matrix Sidebar |
| 22 | 🟢 COMPLETATA | `impostazioni.html` | 6, 9, 10, 23 | Fusion Blue |
| 23 | 🟢 COMPLETATA | `regole_scadenze_veicoli.html` | 6, 9, 10, 23 | Dark Menu Glow |
| 24 | 🟢 COMPLETATA | `configurazione_automezzi.html` | 6, 9, 10, 23 | Form Input Glass |
| 25 | 🟢 COMPLETATA | `configurazione_documenti.html` | 6, 9, 10, 23 | Form Input Glass |
| 26 | 🟢 COMPLETATA | `configurazione_generali.html` | 6, 9, 10, 23 | Form Input Glass |
| 27 | 🔴 DA FARE | `privacy.html` | Titanium Frame | Beacon (4s) | Standard | Glass Read-Only |
| 28 | 🔴 DA FARE | `gestione_scadenze.html` | Titanium Frame | Beacon (4s) | Dinamico | Matrix Scadenze |
| 29 | 🔴 DA FARE | `gestione_urgenze.html` | Titanium Frame | Beacon (4s) | Dinamico | Red Glow Matrix |
| 30 | 🔴 DA FARE | `gestione_memorandum.html` | Titanium Frame | Beacon (4s) | Standard | Memo Matrix |
| 31 | 🔴 DA FARE | `gestione_memo_condivisi.html` | Titanium Frame | Beacon (4s) | Standard | Memo Shared Matrix |
| 32 | 🔴 DA FARE | `lista_contatti.html` | Titanium Frame | Beacon (4s) | Standard | Icone Contatti |
| 33 | 🟠 INCOMPLETA | `notifiche_history.html` | 1, 2 | 3 | 4, 5 | Fusion Blue |
| 34 | 🟠 INCOMPLETA | `dettaglio_account_privato.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | **Titanium Glass Fields** |

________________________________________

### Regola 15 – Legenda Effetti Design System Titanium
Gli effetti del design system sono definiti nel dettaglio nel file dedicato: `TITANIUM_EFFECTS.md`.

| ID | Nome Effetto | Riferimento 🟢 | Light 🟢 | Descrizione |
| :--- | :--- | :--- | :--- | :--- |
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
| **[#23]**| **Standard Injection** | `(JS Modular)` 🟢 | SÌ 🟢 | Iniezione dinamica di Header/Footer via Regola 23 |

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

________________________________________

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

________________________________________

### Regola 21 – Titanium Vault (Security Center)
**Obiettivo:** Creare un'area di sosta visiva ultra-sicura per l'inserimento dati sensibili.

**Linee guida operative:**
*   Usare la classe `.titanium-vault` per il contenitore principale.
*   **Effetto**: Ombreggiatura esterna Blue-Deep, bordo cristallino a 1px, e colonna centrale perimetrale.

________________________________________

### Regola 22 – Protocollo Selettori JS (Codice Pulito)
*   **Identificazione Elementi**: Usare attributi `id` per elementi singoli e classi per elementi ripetuti.
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
            <a href="pagina_precedente.html" class="btn-icon-header flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-gray-900 dark:text-white">
                <span class="material-symbols-outlined">arrow_back</span>
            </a>

            <!-- 2. TITOLO (Centrato Assoluto) -->
            <h2 class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-900 dark:text-white text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
                NOME PAGINA
            </h2>

            <!-- 3. Pulsante HOME (Opzionale) -->
            <a href="home_page.html" class="btn-icon-header flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-gray-900 dark:text-white">
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
