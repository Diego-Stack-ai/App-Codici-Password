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
*   **Classi semantiche e palette**: `.matrix-blue`, `.fusion-clean`. Devono rimanere neutre finché il Light non è richiesto.
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

### Regola 5 – Aiuto base informativa

•	Ogni pagina deve fornire aiuto contestuale.
*   **Testi descrittivi**: Brevi, chiari, non interattivi.
*   **Elementi informativi**: Tooltip, icone aiuto.
*   Non bloccare la navigazione.
*   Sempre leggibili e coerenti col tema (Dark/Light).

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
🔴 DA FARE | � INCOMPLETA (Dual Theme Req.) | 🟢 COMPLETATA

| # | Stato | Nome Pagina | Contenitore | Faro | Effetti Card | Palette / Colori |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 🟠 INCOMPLETA | `index.html` (Login) | 1, 2 | 3 | 4, 5, 9, 13 | Fusion Clean |
| 2 | 🔴 DA FARE | `registrati.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 3 | 🔴 DA FARE | `verifica_email.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 4 | 🔴 DA FARE | `reset_password.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 5 | 🔴 DA FARE | `imposta_nuova_password.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 6 | 🔴 | `dashboard_amministratore.html` | Titanium Frame | Beacon (4s) | Premium | Matrix Cromatico |
| 7 | 🔴 | `gestione_utenti_(admin).html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 8 | 🔴 | `account_azienda.html` | Titanium Frame | Beacon (4s) | Premium | Matrix Interno |
| 9 | 🟠 INCOMPLETA | `account_privati.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | **Titanium Glass Cards** |
| 10 | 🔴 | `aggiungi_account_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 11 | 🔴 | `aggiungi_account_privato.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 12 | 🔴 | `aggiungi_nuova_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 13 | 🔴 | `aggiungi_scadenza.html` | Titanium Frame | Beacon (4s) | Dinamico | Matrix Scadenze |
| 14 | 🔴 | `modifica_account_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 15 | 🔴 | `modifica_account_privato.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 16 | 🔴 | `modifica_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 17 | 🟠 INCOMPLETA | `home_page.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 14, 15 | Matrix Fusion |
| 18 | 🟠 INCOMPLETA | `dati_anagrafici_privato.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | **Titanium Glass Section Box** |
| 19 | 🟠 INCOMPLETA | `area_privata.html` | 1, 2 | 3 | 4, 5, 9, 11 | **Dashboard Navigazione** |
| 20 | 🔴 | `scadenze.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | **Scadenze** |
| 21 | 🔴 | `lista_aziende.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 22 | 🟠 INCOMPLETA | `archivio_account.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Matrix Sidebar |
| 23 | 🟠 INCOMPLETA | `impostazioni.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | Fusion Glass |
| 24 | 🟠 INCOMPLETA | `regole_scadenze_veicoli.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Dark Menu Glow |
| 25 | 🟠 INCOMPLETA | `configurazione_automezzi.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 26 | 🟠 INCOMPLETA | `configurazione_documenti.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 27 | 🟠 INCOMPLETA | `configurazione_generali.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 28 | 🔴 | `privacy.html` | Titanium Frame | Beacon (4s) | Standard | Glass Read-Only |
| 29 | 🔴 | `gestione_scadenze.html` | Titanium Frame | Beacon (4s) | Dinamico | Matrix Scadenze |
| 30 | 🔴 | `gestione_urgenze.html` | Titanium Frame | Beacon (4s) | Dinamico | Red Glow Matrix |
| 31 | 🔴 | `gestione_memorandum.html` | Titanium Frame | Beacon (4s) | Standard | Memo Matrix |
| 32 | 🔴 | `gestione_memo_condivisi.html` | Titanium Frame | Beacon (4s) | Standard | Memo Shared Matrix |
| 33 | 🔴 | `lista_contatti.html` | Titanium Frame | Beacon (4s) | Standard | Icone Contatti |
| 34 | 🟠 INCOMPLETA | `notifiche_history.html` | 1, 2 | 3 | 4, 5 | Fusion Blue |
| 35 | 🟠 INCOMPLETA | `dettaglio_account_privato.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | **Titanium Glass Fields** |

________________________________________

### Regola 15 – Impostazione Effetti Metodo Titanium

Gli effetti del design system sono definiti nel dettaglio nel file dedicato: `TITANIUM_EFFECTS.md`.

| ID | Nome Effetto | Descrizione Breve | Variante Light Necessaria? |
| :--- | :--- | :--- | :--- |
| **[#1]** | **Sfondo Pagina** | `.titanium-bg` | Opzionale |
| **[#2]** | **Contenitore** | `.titanium-box` | SÌ |
| **[#3]** | **Faro (Glass Glow)** | `.glass-glow` | Opzionale |
| **[#4]** | **Header Fusion** | `.titanium-header` | SÌ |
| **[#5]** | **Footer Fusion** | `.titanium-footer` | SÌ |
| **[#6]** | **Hover** | `.titanium-interactive` | NO | pulsanti che si alzano quando si passa sopra
| **[#7]** | **Beacon** | `.beacon-light` | SÌ |
| **[#8]** | **Beacon Gold** | `.beacon-gold` | SÌ |
| **[#9]** | **Border Glow** | `.border-glow` | SÌ | bordi illuminati
| **[#10]**| **Glass Shine** | Overlay luminoso | SÌ |e il riflesso vetroso sulle barre sotto e sopra e sui pulsanti sopra alle barre
| **[#13]**| **Saetta** | `.saetta` | SÌ |
| **[#14]**| **Saetta Gold** | `.saetta-gold` | SÌ |
| **[#15]**| **Matrix Palette** | `.matrix-*` | SÌ |
| **[#16]**| **Glass Card** | `.titanium-glass-card` | SÌ |
| **[#17]**| **Swipe Safety** | (JS Logic) | SÌ |
| **[#18]**| **Saetta Master** | `.saetta-master` | SÌ | Onda unica totale
| **[#16]**| **Glass Card** | `.titanium-glass-card` | SÌ |
| **[#17]**| **Swipe Safety** | JS Logic | NO |

________________________________________

### Regola 16 – Riferimento Codici
Fare riferimento SEMPRE a `TITANIUM_EFFECTS.md` per i codici CSS/Tailwind completi.

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