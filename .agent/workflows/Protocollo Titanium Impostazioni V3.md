🔹 Protocollo Impostazioni Titanium V3.1 – Specifico Configurazioni

Estensione del Protocollo Comune Titanium V3.1

Applicabile esclusivamente alle pagine satellite di configurazione e gestione dati dell’utente.

⚠️ Nota Importante:
Tutte le regole del Protocollo Comune sono obbligatorie e intoccabili.

Questo protocollo è un’estensione operativa del Protocollo Comune Titanium V3.1.
Definisce le regole complete per progettare, strutturare e implementare le pagine del proprio dominio.

Il Protocollo Comune fornisce il core intoccabile.
Questo protocollo governa la scrittura del codice delle pagine del dominio Impostazioni.

È consentito aggiungere strutture, layout, logiche UI e comportamenti specifici del dominio, purché pienamente compatibili con il core.

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
assets/css/impostazioni.css


File separato per gli stili Impostazioni, compatibile con comune.css

Solo stili extra per scenografia, Glass Glow, Border Glow, Adaptive Shadows

Non modificare layout, classi o variabili del core

2. Tema & Design System (specifico)

Palette: Dual Mode, Glass Glow3, Border Glow9

Effetti: Glass/Border Glow, Adaptive Shadows

Uso JS: Layout dinamici consentiti, vietati rgba/hex inline

Differenza chiave: Consente effetti scenografici e interattività visiva, senza limitazioni alla base

3. Standard Editoriale / Layout (specifico)

Header: Balanced Layout 3 zone, wrap titoli, max 2 righe

Tabelle: “Titanium Data” Glass Table, densità text-xs

Inputs: Select Premium, Numeric Fields, Glass Inputs

Footer: <div id="footer-placeholder"></div>

Dashboard / Liste: Layout generico, più scenografico, non ottimizzato per dati sensibili

4. Protocollo Matrix V3.1

Card Architecture: p-3, rounded-[18px], .matrix-card-compact

Interazione: card cliccabile, pulsanti interni stopPropagation

Data Fields: altezza fissa h-8, font 12px, icone 14px

Search: bordi rinforzati, .search-bar-solid

Dynamic UI: rimuovere pulsanti ridondanti

5. Multilingua

Gestione lingue ereditata dal Protocollo Comune

Tutti i testi statici e placeholder → data-t, data-t-placeholder

Traduzioni applicate tramite applyTranslations()

Nessun testo hardcoded nelle UI core

6. Collegamento con Agente AI

CSS/JS: usare solo impostazioni.css e JS dedicati alla pagina Impostazioni

Componenti UI: solo quelli centralizzati dal core

Check: layout, touch target ≥36px, modali, responsive, effetti scenografici (Glass/Border Glow)

Cache e AppState: usare IndexedDB solo per cache consultiva, AppState centrale aggiornato secondo pattern core

UI: tutte le interazioni tramite componenti centralizzati (modali, toast, ecc.)

7. Comportamento dell’Agente AI (Specifico Impostazioni)

In caso di dubbio tra semplicità e resa visiva, l’agente è autorizzato a privilegiare la resa visiva, purché non comprometta usabilità, accessibilità e coerenza con il core.

Sono consentite variazioni cromatiche, effetti Glow e interazioni più ricche rispetto agli altri domini, ma ogni scelta deve rimanere coerente con il Design System Titanium e non introdurre pattern non previsti dal core.