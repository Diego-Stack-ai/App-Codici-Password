Protocollo Comune Titanium V3.0 (Core) – Baseline Ufficiale

Scopo: Questo protocollo costituisce la base comune per tutte le pagine gestite dai protocolli Impostazioni, Accesso e Account. Stabilisce le regole generali di architettura, layout, componenti e internazionalizzazione (multilingua).
Nota: Per le caratteristiche specifiche di ciascuna pagina satellite, fare riferimento ai rispettivi protocolli dedicati.

1. Ambito di Applicazione

Il Protocollo Comune definisce regole valide per tutte le pagine satellite, indipendentemente dal tipo:

Gestione dati utente: profilo, configurazioni, credenziali, scadenze, documenti, notifiche, flotta

Dashboard principali o secondarie

Pagine di inserimento e dettaglio (form e modali)

Importante: Specifiche aggiuntive di layout, palette, effetti e componenti sensibili devono seguire i protocolli dedicati Impostazioni, Accesso o Account.

1.1 CSS di riferimento

assets/css/auth_comune.css

Garantisce performance, indipendenza dal resto dell’app e coerenza visiva.


2. Regole di Architettura (System Core)
2.1 Cache Busting

Obbligatorio: tutti i file JS e CSS devono includere un parametro di versione:

<script src="assets/js/miofile.js?v=X.Y"></script>
<link rel="stylesheet" href="assets/css/miofile.css?v=X.Y">


Vietato:

File senza versioning

Uso di native alerts (alert(), confirm(), prompt())

2.2 Componenti UI Centralizzati

Tutte le interazioni utente devono passare dai componenti centralizzati:

await window.showInputModal("Titolo", "ValoreDefault");
await window.showConfirmModal("Messaggio");
window.showToast("Messaggio", "success/error");

2.3 Standard Multilingua (i18n)

Concetto di lingua:

Questo protocollo definisce il supporto multilingua di base per tutte le pagine

Testi statici: attributi data-t e data-t-placeholder

Traduzioni applicate tramite applyTranslations() in JS

Nessun testo hardcoded nelle pagine o nei modali gestiti da questo protocollo

I protocolli specifici di pagina possono integrare traduzioni aggiuntive, ma sempre compatibili con il sistema definito qui

2.4 Layout Dinamico e Temi

Layout dinamici via JS; vietato usare rgba/hex inline

Supporto dual-mode (light/dark) tramite variabili CSS o classi condizionali

Tutti i colori, ombre e bordi devono usare classi o variabili predefinite

CSS dedicato: common.css per gestire layout, temi, tipografia e componenti base

2.5 Header & Footer

Header: layout bilanciato a 3 zone (Left, Center, Right). Titoli max 2 righe con wrap intelligente; priorità icone definite

Footer: <div id="footer-placeholder"></div>; vietato usare <footer> statico

2.6 Responsive Design (unificato)

Obiettivo: garantire che tutte le pagine satellite siano pienamente adattive su desktop, tablet e mobile, con layout flessibile, tipografia leggibile e touch target ottimizzati

2.6.1 Breakpoints Standard

Desktop: >768px

Tablet: ≤768px

Mobile: ≤480px

Small Mobile: ≤400px

2.6.2 Layout e Griglie

Layout Flex/Grid per tutte le pagine, modali e card

Strutture centrali e sidebars adattive in base alla larghezza del device

Padding e gap adattivi per garantire simmetria e coerenza

Modali centrate, ridotte e scrollabili su mobile

2.6.3 Tipografia

Testi e titoli adattivi, wrap titoli fino a max 2 righe

Font size ridotto per dispositivi mobili mantenendo leggibilità

Line-height proporzionata per evitare overlapping in schede e tabelle

2.6.4 Card e Data Fields

Altezza fissa o minima per campi dati sensibili e card

Riduzione dimensioni card su tablet e mobile senza compromettere leggibilità

Touch targets minimi: 36x36px per tutti i pulsanti e elementi cliccabili

2.6.5 Immagini e Elementi Multimediali

Immagini responsive con max-width 100%, height auto

Icone e pulsanti scalabili con classi CSS o variabili

Evitare overflow orizzontale

2.7 Checklist di Validazione Comune

Per ogni pagina satellite:

CSS unico collegato (common.css)

Versioning corretto di JS e CSS

No native alerts

Console pulita (senza errori o warning)

Header bilanciato

Titoli mobile a capo corretto

Layout responsive rispettato (come da 2.6)

Modali centrate e scrollabili

Card e matrix field ridotti ma leggibili

Touch targets ≥36x36px

Traduzioni applicate correttamente

2.8 Coordinamento con altri protocolli

Questo protocollo gestisce solo le regole comuni

Per gestire l’intera pagina, fare riferimento ai protocolli specifici:

Impostazioni → gestione configurazioni e preferenze utente

Accesso → gestione login, logout e sessione

Account → gestione dati personali, flotta, documenti, notifiche

Ogni protocollo satellite può usare CSS specifici aggiuntivi, ma deve rispettare le regole comuni di layout, temi, multilingua e responsive definite qui