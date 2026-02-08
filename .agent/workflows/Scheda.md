---
description: 
---

Protocollo – Istruzioni Base Pagine – Core + Performance & Sicurezza
1. Istruzioni per la Base delle Pagine
1.1 Background Universale

Effetto unico: tutte le pagine condividono lo stesso sfondo con gradiente e l’effetto "Diffusion".

1.2 Categorie di Pagine
1.2.1 Pagine “Servizio”

Pagine: index.html (Login), registrati.html, reset_password.html, imposta_nuova_password.html

Modalità Dark fissa (Nero).

Nessun header/footer standard e impossibilità di cambiare tema.

Standard UX Auth

Container: obbligo di utilizzo classe .auth-card con .border-glow.

Saetta System (Premium): ogni card deve contenere il doppio effetto:

.saetta-master (Lo shimmer metallico di sfondo, 4s, intensità 8%).

.saetta-drop (La linea verticale blu che cade, 3s).

Selettore Lingua: nelle pagine di accesso (index, registrati), il selettore lingua deve essere ancorato dentro la card in alto a destra (.lang-selector-container inside .auth-card).

Responsive: sotto i 480px, la card si adatta a width: 90% con max-width: 360px per mantenere l’estetica "compatta".

1.2.2 Pagine “Contenuto”

Tutte le altre pagine come:

home_page.html, privacy.html, area_privata.html, profilo_privato.html, account_privati.html, dettaglio_account_privato.html, form_account_privato.html, archivio_account.html, lista_aziende.html, dati_azienda.html, account_azienda.html, aggiungi_nuova_azienda.html, modifica_azienda.html, aggiungi_account_azienda.html, dettaglio_account_azienda.html, modifica_account_azienda.html, scadenze.html, aggiungi_scadenza.html, dettaglio_scadenza.html, modifica_scadenza.html, regole_scadenze.html, impostazioni.html, configurazione_generali.html, configurazione_documenti.html, configurazione_automezzi.html, gestione_allegati.html, notifiche_storia.html

Layout a fasce (header e footer) e possibilità di switch tra Chiaro e Scuro.

Layout Header (Fascia Alta)

Sinistra: solo icona "Freccia" (back).

Centro: Nome della pagina (o Saluto Dinamico in Home). Se pagina a tema, il titolo assume il colore del tema.

Destra: Icona "Home" sempre presente (tranne nella Home stessa).

Extra: tra titolo e Home, pulsante di ordinamento (A-Z o Data) dove richiesto.

Layout Footer (Fascia Bassa)

Sinistra: switch per modalità Chiaro/Scuro.

Centro: eventuali icone funzionali alla pagina.

Destra: Icona "Impostazioni" (Icona: tune) sempre presente (tranne nella pagina Impostazioni).

Stile Icone e Colori

Minimalismo: icone senza bordi, cerchi o sfondi, “nude”.

Colore dinamico: icone e titolo diventano bianche o scure in base al tema.

Eccezioni tematiche: se una pagina ha tema colorato, icone e titolo adottano quel colore.

2. Eccezioni Layout Specifiche
2.1 Home Page (home_page.html)

Header SX: avatar utente (link a Profilo Privato), senza Back.

Header DX: pulsante Logout, senza Home.

Footer: pulsante Tema SX, vuoto C, pulsante Impostazioni DX (tune).

Titolo: Saluto dinamico (es: "Ciao, Nome"), centrato.

2.2 Profilo Privato (profilo_privato.html) & Impostazioni (impostazioni.html)

Header standard: Back SX, Titolo C, Home DX.

Footer standard: Tema SX, Icone C, Settings DX (su Impostazioni, Settings DX opaco/disabilitato per indicare “sei qui”).

3. Regole di Architettura Comune

Cache, versioning e snippet JS/CSS centralizzati.

Componenti UI riutilizzabili e centrati, modali scrollabili.

Multilingua: data-t / data-t-placeholder, applyTranslations(), vietato testo hardcoded.

Layout dinamico e temi: dual-mode Light/Dark.

Header & Footer: layout a 3 zone, eccezioni icone Home/Back/Sort.

Responsive design completo:

Desktop >768px

Tablet ≤768px

Mobile ≤480px

Small Mobile ≤400px

Adattamento UI Form e dati su Mobile: colonna singola sotto 480px, spaziature 10–14px su piccoli schermi, nessun campo tagliato/sovrapposto, scroll verticale fluido, touch target ≥36px.

Checklist di validazione: CSS operatore.css collegato, console pulita, layout responsive, modali centrate, card leggibili, traduzioni applicate.

Performance, Cache e Sicurezza: AppState centrale, IndexedDB TTL 15 min, Sync in background, Service Worker cache CSS/JS/font/icone, logout/reset AppState.

4. Snippet di Codice Esempio (Base)
// AppState centrale
window.AppState = {
  user: null,
  role: null,
  permissions: [],
  theme: "light",
  language: "it",
  lastSync: null
};

// Pattern Cache
function renderPage() {
  loadCache().then(data => renderUI(data));
  syncServer().then(update => updateUI(update));
}

5. Note Operative

Inclusione CSS/JS: prima il comune (operatore.css), poi eventuali aggiunte relative alla pagina.

Checklist valida per tutte le pagine.

Pattern cache e AppState: IndexedDB solo per cache consultiva, AppState centrale.

Snippet pratici aggiuntivi: Cache → Render → Sync, autocomplete login, Matrix Card stopPropagation, altezza h-8 campi dati.

Specifiche responsive: colonna singola Mobile/Small Mobile sotto 480px, spaziature 10–14px per piccoli schermi, nessun contenuto tagliato o sovrapposto, scroll verticale fluido.

6. Gestione Modali e Pop-up (Protocollo Modale)

Obiettivo: eliminare i pop-up nativi del browser (alert, confirm, prompt) per garantire un'esperienza utente coerente e stilizzata (Dark/Light).

Regola Mandatoria

Tutte le pagine "Contenuto" DEVONO importare lo script assets/js/ui-core.js prima dello script di pagina.

Funzioni Standard (Globali)

A. Avviso (Alert):

// Vecchio
alert("Messaggio");
// Nuovo
showWarningModal("Titolo", "Messaggio", callbackOpzionale);


B. Conferma (Confirm):

// Vecchio
if (confirm("Sei sicuro?")) { ... }
// Nuovo
if (await showConfirmModal("Titolo", "Messaggio")) {
    // Azione confermata
}


C. Input (Prompt):

// Vecchio
let val = prompt("Inserisci valore");
// Nuovo
let val = await showInputModal("Titolo", "ValoreIniziale", "Placeholder");


D. Logout:

Utilizzare sempre showLogoutModal() per la conferma di uscita standardizzata.

Note Tecniche

ui-core.js inietta dinamicamente l'HTML necessario nel <body>, non serve copiare codice HTML nelle singole pagine.

Il CSS è gestito centralmente in operatore.css.

7. Specifiche Pagine e Layout Critici
7.1 Area Privata (area_privata.html)

Layout Griglia (Matrice 2x2): struttura a griglia per le 4 macro-aree (Privato, Azienda, Scadenze, Urgenze).

Container: classe .content-matrix-grid.

Card: classe .matrix-card.

DIVIETO DI REFACTORING GRIGLIA: non modificare le classi del container né rifattorizzare la griglia senza test esaustivo.

8. Riepilogo Pulizia, Conformità e Sicurezza – Attività Odierna
8.1 Controlli HTML

Verifica struttura semantica coerente.

Rimozione wrapper o tag superflui.

Tutti i <button> hanno type="button se non submit.

Tutti gli <input> hanno etichette <label> correttamente associate.

Collegamenti corretti a JS e CSS modulari.

8.2 Controlli CSS

Nessuno style inline o tailwind deve esere presente nelle pagine.

Tutte le proprietà CSS migrate in operatore.css.

Nessun mix Tailwind/Design System: classi atomiche sostituite da classi coerenti del protocollo.

Verifica assenza vulnerabilità CSS.

8.3 Controlli JS

Nessuno script inline presente.

Tutti i file JS modulari correttamente collegati.

Event listener esterni per tutti i click/change/input.

Nessun onclick o onchange inline rimasto.

Controllo modularità e idempotenza dei JS.

8.4 Controlli CSP e Sicurezza

Header CSP aggiornato e coerente (script-src, style-src, font-src, img-src, connect-src).

Nessuno unsafe-inline presente in JS o CSS.

Solo fonti sicure consentite.

Nessuna possibilità di iniezione JS/CSS malevola.

Controllo corretto dei moduli JS per prevenire vulnerabilità.

9. Controlli Password e Protezione Keychain
Obiettivo

Prevenire il riempimento automatico indesiderato da Password Manager nelle pagine di gestione account.

Azioni Applicate

Autocomplete e Attributi HTML:

username/account → autocomplete="off"

password → type="password" autocomplete="new-password"

ID e name dei campi univoci.

Toggle visibilità password gestito con JS esterno, addEventListener.

Fallback traduzioni: window.t = window.t || ((k) => k);

Pagine interessate:

Privato: modifica_account_privato.html/js, aggiungi_account_privato.html/js, dettaglio_account_privato.html/js

Azienda: modifica_account_azienda.html/js, aggiungi_account_azienda.html/js, dettaglio_account_azienda.html/js

Effetti Ottenuti

Blocco riempimento automatico su campi non login.

Piena compatibilità con login/registrazione/reset password.

Robustezza JS e visibilità password sicura.

10. Gestione HTML/CSS/JS
HTML

Contenuto strutturale e semantico SOLO nell’HTML.

Non inserire stili CSS o logica JavaScript inline.

Evitare <div> o <span> inutili; usare tag semantici (<header>, <main>, <section>, <footer>).

CSS

Tutti gli stili in file esterni.

Non usare style="" negli elementi HTML salvo casi eccezionali.

Classi e ID chiari e descrittivi.

JavaScript

Tutta la logica in file esterni o moduli separati.

Evitare codice inline (onclick="", onload="").

File JS caricati con defer o type="module".

Regola Generale

Solo contenuto strutturale va nell’HTML.

Tutto il resto (stili, script, configurazioni) deve stare in file esterni.

Garantisce pulizia, leggibilità, manutenibilità e performance della PWA.
