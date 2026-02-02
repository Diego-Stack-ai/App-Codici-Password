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

2.X Effetti Globali Base (V3.1 – Consolidati)

Obiettivo
Definire l’involucro estetico e strutturale obbligatorio, ereditato da tutte le pagine satellite, garantendo coerenza visiva, gerarchia UI e supporto Dual-Mode (Light/Dark).

Queste regole sono core intoccabile.

● Sfondo Adaptive – .titanium-bg

Applicazione: obbligatoria sul <body> di ogni pagina

Logica: utilizza la variabile --bg-primary gestita dal tema

Comportamento:
background-color con transition: 0.3s per cambio tema

Note:
Le pagine di Accesso forzano Dark Mode ma ereditano comunque questa classe

● Contenitore Master – .titanium-container

Dimensioni: max-width: 48rem (768px) – centrato orizzontalmente

Estetica:
background tramite --titanium-box-gradient

Dark: Blu profondo

Light: Slate / Blue

Z-index: base 10 per garantire corretta gerarchia visiva

Applicazione: obbligatoria su tutte le pagine applicative e di accesso

● Faro Ambientale – .titanium-glow

Effetto: luce ambientale fluttuante

Animazione: glowFloat

Sorgente: gradiente radiale definito in --glow-gradient

Posizionamento:
primo elemento interno a .titanium-container

Nota:
Effetto sempre presente, eventuali variazioni cromatiche dipendono dal tema

● Fasce Vetrose – Header & Footer

Classi: .titanium-header, .titanium-footer

Stile:

backdrop-filter: blur(12px)

sfondo --surface-glass

Comportamento: elementi fixed, sempre visibili

● Spaziatori Tecnici

.spacer-header

Altezza fissa: --header-height (80px)

.spacer-footer

Altezza fissa: 100px

Scopo:
prevenire sovrapposizioni tra contenuto e header/footer fissi

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

2.5 Header & Footer (V3.1 – Regole Definitive)
Header – Regole Generali

Applicazione:

Presente su tutte le pagine

Nelle pagine di Accesso → header minimale

Nelle pagine applicative → header completo

Layout Header (3 zone fisse)
Sinistra

Sempre presente

Unica icona consentita:
freccia “torna indietro”

Azione: navigazione alla pagina precedente

Centro

Sempre presente

Nome della pagina

Centrato orizzontalmente

Massimo 2 righe

word-break corretto su mobile

Destra

Icona Home (sempre tranne le pagine di accesso e la pagina home page)

Pulsante Ordinamento (se presente):

Posizione: tra titolo pagina e Home

Consentito solo in pagine con liste o dati ordinabili

Vietate altre icone o azioni nel header

Footer – Regole Generali

Applicazione:

Presente solo nelle pagine applicative

Le pagine di Accesso hanno footer minimale senza azioni

Contenuto Footer:

Tutte le azioni secondarie:

aggiungi

impostazioni

info

modifica

azioni contestuali

Icone centralizzate

Cerca

Footer:

responsive

sempre visibile

non deve sovrapporre il contenuto

Regola Chiave di Sistema (non negoziabile)

Nessuna icona di azione nel header, eccetto:

torna indietro

home

ordinamento (se previsto)

Tutte le altre azioni vanno nel footer

Le pagine di Accesso non mostrano azioni applicative

2.6 Responsive Design (aggiornato)

Breakpoints:

Desktop > 768px

Tablet ≤ 768px

Mobile ≤ 480px

Small Mobile ≤ 400px

Layout: Flex/Grid per adattamento automatico header e footer

Touch target minimo ≥36x36px

Icone e immagini scalabili e responsive, non distorcere proporzioni

2.6.1 Adattamento UI Form e Dati su Mobile (V3.1 – Obbligatorio)

Obiettivo
Garantire leggibilità, usabilità e stabilità dei form e delle viste dati su dispositivi mobili, evitando sovrapposizioni, tagli o compressioni visive, senza duplicare logica o dati.

Questa regola si applica a:

pagine di dettaglio

pagine di modifica

form di inserimento

viste dati strutturate

Principio Fondamentale (non negoziabile)

I dati sono unici, la UI è adattiva.
La logica applicativa non cambia tra desktop e mobile.
Cambia solo la disposizione visiva.

Regole di Comportamento UI

Desktop (>768px)

Layout libero (grid, colonne affiancate)

Campi possono essere affiancati

Tablet (≤768px)

Layout semplificato

Massimo 2 colonne

Spaziature aumentate

Mobile (≤480px)

Layout a colonna singola obbligatorio

Nessun campo affiancato

Label sempre sopra il campo

Input, select, textarea: width 100%

Spazio verticale minimo tra campi: 12–16px

Nessun contenuto deve essere:

tagliato

sovrapposto

compresso orizzontalmente

Small Mobile (≤400px)

Colonna singola

Spaziature ulteriormente aumentate

Priorità a scroll verticale naturale

Implementazione Tecnica

L’adattamento deve avvenire solo via CSS

Consentito:

media queries

flex-direction: column

grid a 1 colonna

classi di supporto (.mobile-only / .desktop-only)

Vietato:

duplicare campi o dati

usare JS per forzare layout

creare logiche dati separate per mobile

CSS

Le regole di adattamento vanno inserite:

nel CSS satellite di riferimento della pagina

È vietato modificare:

comune.css

Vietati nuovi inline-style per risolvere problemi di layout mobile

Validazione Obbligatoria

Ogni pagina con form o dati deve garantire su mobile:

Nessun campo tagliato

Nessuna sovrapposizione

Scroll verticale fluido

Tastiera mobile non copre i campi attivi

Touch target ≥36x36px

UX coerente con Titanium Mobile

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