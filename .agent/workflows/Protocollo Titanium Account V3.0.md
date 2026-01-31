Protocollo Titanium Account V3.0

Baseline Ufficiale: Questo protocollo si applica esclusivamente alle pagine di gestione account privati e aziendali, con priorità a sicurezza e leggibilità dei dati sensibili.
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

home_page.html

account_privati.html

area_privata.html

aggiungi_account_privato.html

dettaglio_account_privato.html

lista_aziende.html

account_azienda.html

aggiungi_account_azienda.html

dettaglio_account_azienda.html

1.1 CSS di riferimento

assets/css/auth_account.css

Completamente autonomo, indipendente dal resto dell’app.

2. Tema & Design System (specifico)

Palette: Titanium Gold, Matrix Palette semantica

Effetti speciali: Effetto “Saetta” proibito; solo Faro statico e hover leggero

Uso JS: Layout dinamici, no rgba/hex inline

Differenza chiave: Vietati effetti scenografici animati, privilegiata leggibilità dati sensibili

3. Standard Editoriale / Layout (specifico)

Header: Balanced Layout 3 zone, gestione titoli lunghi, word-break

Card: “Matrix Card Compact”, padding p-3, angoli rounded-18px, card cliccabile

Inputs: Triple Masking Protocol per campi sensibili, copia singola valori

Footer: <div id="footer-placeholder"></div>

Dashboard / Liste: Dashboard grid layout, Search Bar Solid, compact cards

Differenza chiave: enfatizza sicurezza, leggibilità, layout responsivo per liste e dati sensibili

4. Protocollo Matrix V3.0

Stesse regole generali di Matrix Card Compact

Pulsanti interni stopPropagation

Data fields con altezza fissa, font e icone definiti

Real-time search

Rimozione pulsanti ridondanti


5. Struttura finale dei tre protocolli

Protocollo Comune → regole core valide per tutte le pagine satellite, con header, footer, cache busting, multilingua, layout dinamico, responsive base

Protocollo Impostazioni → personalizzazioni scenografiche, tabelle Glass, inputs generici, modali e card per gestione configurazioni

Protocollo Account → personalizzazioni per sicurezza e leggibilità, Triple Masking, card compact, dashboard responsive, palette Titanium Gold, effetti minimi



✅ Nota sul Multilingua

La gestione delle lingue per le pagine Account è ereditata dal Protocollo Comune.

Nessun testo hardcoded nelle UI core.

Tutte le traduzioni si applicano tramite data-t, data-t-placeholder e applyTranslations().

Questo protocollo non richiede ulteriori logiche di traduzione.