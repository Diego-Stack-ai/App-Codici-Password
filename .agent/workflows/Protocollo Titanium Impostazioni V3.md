Protocollo Titanium Impostazioni V3.0 + Responsive V3.1

Baseline Ufficiale: Questo protocollo si applica esclusivamente alle pagine satellite di configurazione e gestione dati dell’utente.
⚠️ ATTENZIONE: Estensione del Protocollo Comune

Questo protocollo è un'estensione del Protocollo Comune Titanium V3.0 (Core). 
Tutte le regole definite nel Protocollo Comune sono obbligatorie e **non possono essere sovrascritte o modificate** dai protocolli specifici. 

Il protocollo specifico può solo:
- Aggiungere regole supplementari relative alla pagina o funzionalità specifica.
- Personalizzare componenti, layout o effetti consentiti nel proprio ambito senza violare le regole comuni.

È vietato:
- Modificare header, footer, cache busting, multilingua, layout dinamico o responsive definiti dal Protocollo Comune.
- Sovrascrivere classi, variabili CSS o comportamenti JS core.
- Ignorare le checklist di validazione o le regole base di sicurezza, leggibilità e compatibilità dispositivi.


1. Ambito di Applicazione

profilo_privato.html

configurazione_generali.html

configurazione_documenti.html

configurazione_automezzi.html

impostazioni.html

archivio_account.html

regole_scadenze.html

notifiche_storia.html

privacy.html

scadenze.html

aggiungi_scadenza.html

modifica_scadenza.html

dettaglio_scadenza.html

1.1 CSS di riferimento

assets/css/auth_impostazioni.css

Garantisce performance, indipendenza dal resto dell’app e coerenza visiva.

2. Tema & Design System (specifico)

Palette: Dual Mode, Glass Glow3, Border Glow9

Effetti: Glass/Border Glow, Adaptive Shadows

Uso JS: Layout dinamici, no rgba/hex inline

Differenza chiave: Permette effetti scenografici, non limita interattività visiva

3. Standard Editoriale / Layout (specifico)

Header: Balanced Layout 3 zone, wrap titoli, max 2 righe

Tabelle: “Titanium Data” Glass Table, densità text-xs

Inputs: Select Premium, Numeric Fields, Glass Inputs

Footer: <div id="footer-placeholder"></div>

Dashboard / Liste: Non specifico

Differenza chiave: Layout generico per gestione dati e form, più scenografico, non ottimizzato per dati sensibili

4. Protocollo Matrix V3.0

Card Architecture: p-3, rounded-[18px], .matrix-card-compact

Interazione: card cliccabile, pulsanti interni stopPropagation

Data Fields: altezza fissa h-8, font 12px, icone 14px

Search: bordi rinforzati, .search-bar-solid

Dynamic UI: rimuovere pulsanti ridondanti


✅ Nota sul Multilingua

La gestione delle lingue per le pagine Impostazioni è ereditata dal Protocollo Comune

Tutti i testi statici e placeholder devono usare data-t e data-t-placeholder

Traduzioni applicate tramite applyTranslations() in JS

Nessun testo hardcoded nelle UI core delle pagine Impostazioni