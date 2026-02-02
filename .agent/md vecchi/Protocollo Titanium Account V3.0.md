🔹 Protocollo Account Titanium V3.1 – Specifico Account

Estensione del Protocollo Comune Titanium V3.1

Priorità funzionale: sicurezza e leggibilità dei dati
Ogni scelta UI o layout deve privilegiare chiarezza, controllo e riduzione del rumore visivo.

Applicabile esclusivamente alle pagine di gestione account privati e aziendali.

⚠️ Nota Importante:
Tutte le regole del Protocollo Comune sono obbligatorie e intoccabili.

Questo protocollo è un’estensione operativa del Protocollo Comune Titanium V3.1.
Definisce le regole complete per progettare, strutturare e implementare le pagine del suo ambito funzionale.

Il Protocollo Comune fornisce il core intoccabile.
Questo protocollo governa la scrittura del codice delle pagine del dominio Account.

È consentito aggiungere strutture, layout, logiche UI e comportamenti specifici del dominio, purché pienamente compatibili con il core.

1. Ambito di Applicazione

home_page.html

account_privati.html

area_privata.html

aggiungi_account_privato.html

modifica_account_privato.html

dettaglio_account_privato.html

lista_aziende.html

account_azienda.html

aggiungi_account_azienda.html

modifica_account_azienda.html

dettaglio_account_azienda.html

aggiungi_nuova_azienda.html

modifica_azienda.html

dati_azienda.html

gestione_allegati.html

1.1 CSS di riferimento
assets/css/account.css


File separato per gli stili specifici Account, compatibile con comune.css

Gestione solo stili extra legati a sicurezza, leggibilità e palette Titanium Gold

Non modificare layout, classi o variabili del core

2. Tema & Design System (specifico)

Palette: Titanium Gold, Matrix Palette semantica

Effetti speciali: vietato effetto “Saetta”; solo Faro statico e hover leggero

Uso JS: layout dinamici consentiti, vietati rgba/hex inline

Differenza chiave: nessun effetto scenografico animato, massima leggibilità dei dati sensibili

3. Standard Editoriale / Layout (specifico)

Header: Balanced Layout 3 zone, gestione titoli lunghi, word-break

Card: Matrix Card Compact, padding p-3, angoli rounded-18px, card cliccabile

Inputs: Triple Masking Protocol per campi sensibili, copia singola valori

Footer: <div id="footer-placeholder"></div>

Dashboard / Liste: Grid layout, Search Bar Solid, compact cards

Differenza chiave: layout responsivo ottimizzato per leggibilità e sicurezza dei dati sensibili

4. Protocollo Matrix V3.1

Regole generali di Matrix Card Compact

Pulsanti interni → stopPropagation

Data fields con altezza fissa, font e icone definiti

Real-time search

Rimozione pulsanti ridondanti

5. Collegamento con altri protocolli

Protocollo Comune: regole core valide per tutte le pagine (header, footer, cache busting, multilingua, layout dinamico, responsive base)

Protocollo Impostazioni: personalizzazioni scenografiche, tabelle Glass, inputs generici, modali e card per gestione configurazioni

Protocollo Account: personalizzazioni per sicurezza e leggibilità, Triple Masking, card compact, dashboard responsive, palette Titanium Gold, effetti minimi

6. Multilingua

Gestione lingue ereditata dal Protocollo Comune

Nessun testo hardcoded nelle UI core

Traduzioni tramite data-t, data-t-placeholder e applyTranslations()

Nessuna logica aggiuntiva di traduzione necessaria

7. Collegamento con Agente AI

CSS/JS: usare solo account.css e JS dedicati alla pagina Account

Componenti UI: solo quelli centralizzati dal core

Check: layout, touch target ≥36px, modali, responsive, palette Titanium Gold

Sicurezza: Triple Masking, dati sensibili, no animazioni scenografiche

Cache e AppState: usare IndexedDB solo per cache consultiva, AppState centrale aggiornato secondo pattern core

UI: tutte le interazioni tramite componenti centralizzati (modali, toast, ecc.)

8. Comportamento dell’Agente AI (Specifico Account)

In caso di dubbio tra estetica e leggibilità, l’agente deve sempre privilegiare leggibilità e sicurezza.

Qualsiasi scelta UI o layout che riduca la chiarezza dei dati deve essere considerata non conforme al protocollo.