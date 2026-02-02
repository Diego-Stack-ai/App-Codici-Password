---



\## description: Protocollo Titanium V3.1 Integrale – Versione Unificata con Esempi



\# Protocollo Titanium V3.1 Integrale – Versione Unificata Dettagliata con Esempi



Nota: Questo documento integra fedelmente i protocolli Comune, Accesso, Impostazioni e Account senza alterare testi o capitoli, riorganizzandoli e aggiungendo esempi pratici per snippet di codice, layout e componenti UI.



---



\## 1. Protocollo Comune Titanium V3.1 – Core + Performance \& Sicurezza



\### 1.1 Ambito di Applicazione



Copre tutte le pagine della cartella public/, inclusi dashboard, inserimento/modali.

Eccezioni Accesso (index.html, registrati.html, reset\_password.html, imposta\_nuova\_password.html) → sempre Dark Mode.

CSS comune: assets/css/comune.css



\### 1.2 Effetti Globali Base (V3.1 – Consolidati)



\* \*\*Sfondo Adaptive – .titanium-bg\*\*: applicazione su <body>, variabile --bg-primary, transition 0.3s

\* \*\*Contenitore Master – .titanium-container\*\*: max-width 48rem, centrato, background --titanium-box-gradient, Dark: Blu profondo, Light: Slate/Blue, Z-index 10

\* \*\*Faro Ambientale – .titanium-glow\*\*: luce fluttuante, animazione glowFloat, primo elemento interno a .titanium-container

\* \*\*Fasce Vetrose – Header \& Footer\*\*: .titanium-header, .titanium-footer, backdrop-filter: blur(12px), sfondo --surface-glass, fixed

\* \*\*Spaziatori Tecnici\*\*: .spacer-header (altezza --header-height), .spacer-footer (altezza 100px)



\### 1.3 Regole di Architettura (System Core)



\* \*\*Cache Busting\*\*



```html

<script src="assets/js/miofile.js?v=3.1"></script>

<link rel="stylesheet" href="assets/css/miofile.css?v=3.1">

```



\* \*\*Componenti UI centralizzati\*\*:



```javascript

await window.showInputModal("Inserisci Nome", "ValoreDefault");

await window.showConfirmModal("Confermi l'azione?");

window.showToast("Operazione riuscita", "success");

```



\* \*\*Multilingua (i18n)\*\*: data-t / data-t-placeholder, applyTranslations(), vietato testo hardcoded

\* \*\*Layout Dinamico \& Temi\*\*: dual-mode Light/Dark, modali centrati/scrollabili, classi/variabili CSS

\* \*\*Header \& Footer\*\*: layout 3 zone, eccezioni icon Home/Back/Sort, footer con azioni secondarie

\* \*\*Responsive Design\*\*: Desktop >768px, Tablet ≤768px, Mobile ≤480px, Small Mobile ≤400px; layout flex/grid; media queries

\* \*\*Adattamento UI Form e Dati su Mobile\*\*: colonna singola sotto 480px, spaziature 12–16px, nessun campo tagliato/sovrapposto, scroll verticale fluido, touch target ≥36px

\* \*\*Checklist di Validazione\*\*: CSS unico collegato, versioning corretto, console pulita, layout responsive, modali centrate, card leggibili, traduzioni applicate

\* \*\*Performance, Cache e Sicurezza\*\*: AppState centrale, IndexedDB TTL 15 min, Sync Firebase in background, Service Worker cache CSS/JS/font/icone, logout/reset AppState



\### 1.4 Snippet di Codice Esempio



```javascript

// AppState centrale

window.AppState = {

&nbsp; user: null,

&nbsp; role: null,

&nbsp; permissions: \[],

&nbsp; theme: "light",

&nbsp; language: "it",

&nbsp; lastSync: null

};



// Pattern Cache

function renderPage() {

&nbsp; loadCache().then(data => renderUI(data));

&nbsp; syncFirebase().then(update => updateUI(update));

}

```



\### 1.5 Protocollo per Agente AI (“Blind Control”)



\* Base intoccabile, modifiche solo protocolli satellite con richiesta documentata

\* Uso AppState centrale, IndexedDB solo per cache consultiva, UI centralizzata, checklist rispettata



---



\## 2. Protocollo Accesso Titanium V3.1 – Specifico Accesso



\* \*\*Pagine\*\*: index.html, registrati.html, reset\_password.html, imposta\_nuova\_password.html

\* \*\*CSS\*\*: assets/css/accesso.css

\* Dark Mode forzata: <html class="titanium-forced-dark">

\* Layout centrato: .titanium-box → .titanium-vault

\* Elementi scenografici: .glass-glow, .accesso-header, .accesso-footer, .border-glow, .saetta-master

\* Icona principale: .security-icon-box

\* Form e bottoni: .accesso-form-group, .accesso-btn

\* Lingua flottante: .lang-selector-container, .lang-btn-float, .lang-dropdown, fadeInScale

\* Standard password \& autofill: current-password, username, new-password

\* Snippet JS dedicati: login.js, registrati.js, reset\_password.js

\* Navigazione: Login ↔ Registrazione / Reset → Login → Impostazioni

\* \*\*Esempi pratici\*\*:



```javascript

// Validazione form Login

document.querySelector('.accesso-form-group').addEventListener('submit', async e => {

&nbsp; e.preventDefault();

&nbsp; const username = document.getElementById('username').value;

&nbsp; const password = document.getElementById('password').value;

&nbsp; if(validateCredentials(username, password)) await loginUser(username, password);

});

```



\* Collegamento Agente AI: CSS/JS Accesso, UI centralizzata, modali centrate, touch target ≥36px, applyTranslations()



---



\## 3. Protocollo Impostazioni Titanium V3.1 – Specifico Configurazioni



\* \*\*Pagine\*\*: profilo\_privato.html, configurazione\_generali.html, configurazione\_documenti.html, configurazione\_automezzi.html, impostazioni.html, archivio\_account.html, regole\_scadenze.html, notifiche\_storia.html, privacy.html, scadenze.html, aggiungi\_scadenza.html, modifica\_scadenza.html, dettaglio\_scadenza.html

\* \*\*CSS\*\*: assets/css/impostazioni.css

\* Tema \& Design System: Dual Mode, Glass Glow3, Border Glow9, Adaptive Shadows

\* Layout header/footer, dashboard, Tabelle Glass, Inputs Premium, Matrix Card p-3, rounded-18px

\* \*\*Protocollo Matrix V3.1\*\*: pulsanti stopPropagation, altezza h-8 campi dati, font/icone definiti, search rinforzata, rimozione pulsanti ridondanti

\* Multilingua: applyTranslations(), vietato testo hardcoded

\* \*\*Esempi pratici Matrix Card\*\*:



```html

<div class="matrix-card-compact p-3 rounded-18px">

&nbsp; <div class="data-field h-8">Valore</div>

&nbsp; <button onclick="event.stopPropagation()">Azioni</button>

</div>

```



\* Collegamento Agente AI: CSS/JS dedicati, modali centrate, touch target ≥36px, effetti scenografici compatibili core, AppState/Cache secondo core

\* Comportamento AI: resa visiva senza compromettere usabilità e coerenza



---



\## 4. Protocollo Account Titanium V3.1 – Specifico Account



\* \*\*Pagine\*\*: home\_page.html, account\_privati.html, area\_privata.html, aggiungi\_account\_privato.html, modifica\_account\_privato.html, dettaglio\_account\_privato.html, lista\_aziende.html, account\_azienda.html, aggiungi\_account\_azienda.html, modifica\_account\_azienda.html, dettaglio\_account\_azienda.html, aggiungi\_nuova\_azienda.html, modifica\_azienda.html, dati\_azienda.html, gestione\_allegati.html

\* \*\*CSS\*\*: assets/css/account.css

\* Tema \& Design System: Titanium Gold, Matrix Palette semantica, effetti minimi, nessuna Saetta animata

\* Layout: header 3 zone, card Matrix Compact p-3 rounded-18px, dashboard/grid layout, search bar solid

\* Triple Masking Protocol campi sensibili

\* Collegamento protocolli: Comune, Impostazioni, Account

\* Multilingua: applyTranslations(), vietato testo hardcoded

\* \*\*Esempi pratici Triple Masking\*\*:



```javascript

function maskField(fieldId) {

&nbsp; const input = document.getElementById(fieldId);

&nbsp; input.type = 'password'; // maschera

&nbsp; input.addEventListener('copy', e => e.preventDefault());

}

maskField('codice\_fiscale');

```



\* Collegamento Agente AI: CSS/JS dedicati, UI centralizzata, modali centrate, touch ≥36px, palette Titanium Gold, Triple Masking, dati sensibili, nessuna animazione scenografica

\* Comportamento AI: privilegiare leggibilità e sicurezza



---



\## 5. Appendice / Note operative



\* Inclusione CSS/JS: Comune prima, poi satellite relativo alla pagina

\* Checklist 2.7: valida per tutte le pagine e satelliti

\* Pattern cache e AppState: IndexedDB solo per cache consultiva, AppState centrale

\* Snippet pratici aggiuntivi: Cache → Render → Sync, autocomplete login, Matrix Card stopPropagation, altezza h-8 campi dati

\* Specifiche Responsive complete: colonna singola Mobile/Small Mobile sotto 480px, spaziature 12–16px, nessun contenuto tagliato o sovrapposto, scroll verticale fluido



