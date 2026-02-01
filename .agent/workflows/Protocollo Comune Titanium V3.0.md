---
description: 
---

🔹 Protocollo Comune Titanium V3.1 – Core + Performance & Sicurezza

Nota importante per sviluppatori e agenti AI:

Questa base costituisce il cuore di tutte le pagine. Una volta creata, non deve essere modificata se non tramite richieste formali documentate (eccezioni).

1. Ambito di Applicazione

Copre tutte le pagine della cartella public/

Gestione dati utente, dashboard, inserimento/modali

Eccezioni: 4 pagine Accesso (Login, Registrazione, Reset_password, Imposta_nuova_password) → sempre Dark Mode

CSS comune: assets/css/comune.css

2. Regole di Architettura (System Core)
2.1 Cache Busting
<script src="assets/js/miofile.js?v=X.Y"></script>
<link rel="stylesheet" href="assets/css/miofile.css?v=X.Y">


Obbligatorio su tutti i file JS/CSS

Vietato: alert(), confirm(), prompt()

2.2 Componenti UI centralizzati
await window.showInputModal("Titolo", "ValoreDefault");
await window.showConfirmModal("Messaggio");
window.showToast("Messaggio", "success/error");

2.3 Multilingua (i18n)

Testi statici → data-t / data-t-placeholder

Traduzioni → applyTranslations()

Vietato testo hardcoded

2.4 Layout Dinamico & Temi

Dual-mode Light/Dark tramite CSS/classi

Colori, ombre e bordi → classi/variabili CSS

Modali centrati e scrollabili

2.5 Header & Footer (aggiornato)

Header:

Layout a 3 zone:

Sinistra: sempre freccia “torna indietro” che riporta alla pagina precedente o alla Home se non c’è storia di navigazione.

Centro: nome della pagina, sempre visibile e centrato.

Destra: icone standard di navigazione base (Home), eventuali altre azioni aggiuntive non previste di default devono stare nel footer.

Titoli massimo 2 righe, con word-break corretto su mobile.

Footer:

Tutte le icone secondarie o aggiuntive (aggiungi, impostazioni, info) devono essere centralizzate nel footer.

Footer responsive, visibile su tutti i dispositivi, non sovrapporre il contenuto principale.

2.6 Responsive Design (aggiornato)

Breakpoints:

Desktop > 768px

Tablet ≤ 768px

Mobile ≤ 480px

Small Mobile ≤ 400px

Layout: Flex/Grid per adattamento automatico header e footer

Touch target minimo ≥36x36px

Icone e immagini scalabili e responsive, non distorcere proporzioni

2.7 Checklist di Validazione

CSS unico collegato

Versioning corretto

Console pulita

Header bilanciato

Titoli mobile a capo corretto

Layout responsive rispettato

Modali centrate/scrollabili

Card leggibili

Traduzioni applicate

2.8 Coordinamento con protocolli satellite

Impostazioni → Configurazioni

Accesso → Login/Logout

Account → Dati personali, flotta, documenti, notifiche

CSS aggiuntivo ammesso ma compatibile con regole comuni

2.9 Performance, Cache e Sicurezza (NUOVO)
2.9.1 AppState Centrale
window.AppState = {
  user: null,
  role: null,
  permissions: [],
  theme: "light",
  language: "it",
  lastSync: null
};


Obbligatorio usare AppState per ogni pagina

Vietato ricalcolare lingua, tema, ruolo ad ogni pagina

Firebase → solo per refresh dati

2.9.2 Cache Locale Dati (IndexedDB)

Salvare: scadenze, dashboard, documenti consultivi, configurazioni non sensibili

Ogni dataset → timestamp e TTL max 15 minuti

Refresh silenzioso quando TTL scaduto

2.9.3 Strategia Firebase

Evitare fetch automatici all’apertura pagina

Sync in background con confronto hash/versione

Pattern: Cache → Render → Firebase Sync → Update UI

2.9.4 Service Worker

Cache: CSS, JS, font, icone

Cache richieste GET Firebase

Fornire fallback offline

Vietato logica utente o permessi

2.9.5 Sicurezza Dati Locali

Consentito salvare: dati UI, liste, scadenze

Vietato salvare: token permanenti, permessi senza scadenza

Dati locali → TTL + invalidazione al logout

2.9.6 Logout & Invalidazione

Pulizia IndexedDB

Reset AppState

Rimozione cache sensibili

Forzare nuova validazione accesso

🔹 Protocollo per Agente AI (Prompt “Blind Control”)

Scopo: L’agente AI deve generare codice per le pagine senza mai modificare la base del Protocollo Comune, salvo eccezioni formalmente richieste.

Istruzioni per l’Agente AI

Base intoccabile

Il Protocollo Comune Titanium V3.1 è la base per tutte le pagine

Non modificare regole di layout, cache, sicurezza, AppState, multilingua o responsive

Modifiche consentite

Solo protocolli satellite (Impostazioni, Accesso, Account)

Solo con richiesta chiara e documentata

Generazione pagine

Creare solo codice compatibile con il V3.1

Utilizzare AppState centrale

Non ricalcolare dati già presenti

IndexedDB → solo per cache consultiva

Evitare fetch Firebase ridondanti

UI → solo tramite componenti centralizzati

Validazione

Ogni pagina generata deve rispettare checklist 2.7

Non usare alert/confirm/prompt

Tutti i testi → i18n

Console pulita, modali centrate, touch target ≥36x36px

Offline/Cache

Non scrivere logica di permessi sul Service Worker

Solo caching statici + GET

Sincronizzazione Firebase in background