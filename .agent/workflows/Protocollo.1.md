---
description: Protocollo.1– Istruzioni Base Pagine
---

Protocollo Base – Core + Performance & Sicurezza
1. Istruzioni per la base delle pagine
1.1 Background Universale

Effetto unico: tutte le pagine condividono lo stesso sfondo con gradiente e l’effetto "faro".

1.2 Categorie di Pagine

Pagine “Servizio”

index.html (Login), registrati.html, reset_password.html, imposta_nuova_password.html

Modalità Dark fissa (Nero).

Nessun header/footer standard e impossibilità di cambiare tema.

Pagine “Contenuto”

Tutte le altre pagine come home_page.html, privacy.html, area_privata.html, profilo_privato.html, account_privati.html, aggiungi_account_privato.html, dettaglio_account_privato.html, modifica_account_privato.html, archivio_account.html, lista_aziende.html, dati_azienda.html, account_azienda.html, aggiungi_nuova_azienda.html, modifica_azienda.html, aggiungi_account_azienda.html, dettaglio_account_azienda.html, modifica_account_azienda.html, scadenze.html, aggiungi_scadenza.html, dettaglio_scadenza.html, modifica_scadenza.html, regole_scadenze.html, impostazioni.html, configurazione_generali.html, configurazione_documenti.html, configurazione_automezzi.html, gestione_allegati.html, notifiche_storia.html

Layout a fasce (header e footer) e possibilità di switch tra Chiaro e Scuro.

2. Layout Header (Fascia Alta)

Sinistra: solo icona "Freccia" (back).

Centro: Nome della pagina (su due righe se lungo o su mobile). Se pagina a tema, il titolo assume il colore del tema.

Destra: Icona "Home" sempre presente (tranne nella Home stessa).

Extra: tra titolo e Home, pulsante di ordinamento (A-Z o Data) dove richiesto.

3. Layout Footer (Fascia Bassa)

Sinistra: switch per modalità Chiaro/Scuro.

Centro: eventuali icone funzionali alla pagina.

Destra: Icona "Impostazioni" sempre presente (tranne nella pagina Impostazioni).

4. Stile Icone e Colori

Minimalismo: icone senza bordi, cerchi o sfondi, “nude”.

Colore dinamico: icone e titolo diventano bianche o nere in base al tema.

Eccezioni tematiche: se una pagina ha tema colorato, icone e titolo adottano quel colore.

5. Eccezioni Layout Specifiche
Home Page (home_page.html)

Header SX: avatar utente (link a Profilo Privato), senza Back.

Header DX: pulsante Logout, senza Home.

Footer: pulsante Tema SX, vuoto C, pulsante Impostazioni DX.

Titolo: “Home Page”, centrato.

Profilo Privato (profilo_privato.html) & Impostazioni (impostazioni.html)

Header standard: Back SX, Titolo C, Home DX.

Footer standard: Tema SX, Icone C, Settings DX (su Impostazioni, Settings DX opaco/disabilitato per indicare “sei qui”).

Nota: ho rimosso riferimenti a classi .titanium-main e .settings-container.

6. Regole di Architettura Comune

Cache, versioning e snippet JS/CSS centralizzati.

Componenti UI riutilizzabili e centrati, modali scrollabili.

Multilingua: data-t / data-t-placeholder, applyTranslations(), vietato testo hardcoded.

Layout dinamico e temi: dual-mode Light/Dark.

Header & Footer: layout a 3 zone, eccezioni icone Home/Back/Sort.

Responsive design completo: Desktop >768px, Tablet ≤768px, Mobile ≤480px, Small Mobile ≤400px.

Adattamento UI Form e dati su Mobile: colonna singola sotto 480px, spaziature 12–16px, nessun campo tagliato/sovrapposto, scroll verticale fluido, touch target ≥36px.

Checklist di validazione: CSS unico collegato, console pulita, layout responsive, modali centrate, card leggibili, traduzioni applicate.

Performance, Cache e Sicurezza: AppState centrale, IndexedDB TTL 15 min, Sync in background, Service Worker cache CSS/JS/font/icone, logout/reset AppState.

7. Snippet di Codice Esempio (Base)
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

8. Note operative

Inclusione CSS/JS: prima il comune, poi eventuali aggiunte relative alla pagina.

Checklist valida per tutte le pagine.

Pattern cache e AppState: IndexedDB solo per cache consultiva, AppState centrale.

Snippet pratici aggiuntivi: Cache → Render → Sync, autocomplete login, Matrix Card stopPropagation, altezza h-8 campi dati.

Specifiche responsive: colonna singola Mobile/Small Mobile sotto 480px, spaziature 12–16px, nessun contenuto tagliato o sovrapposto, scroll verticale fluido.