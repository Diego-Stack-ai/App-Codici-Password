🔹 Protocollo Accesso Titanium V3.1 – Specifico Accesso

Estensione del Protocollo Comune Titanium V3.1

Applicabile solo alle pagine Login, Registrazione e Reset Password. Tutti gli elementi condivisi (CSS core, validazione base, responsive, gestione componenti via JS, multilingua) sono ereditati dal Protocollo Comune (comune.css).

⚠️ Nota Importante:
Tutte le regole del Protocollo Comune sono obbligatorie e intoccabili.

Questo protocollo è un’estensione operativa del Protocollo Comune Titanium V3.1.
Definisce le regole complete per progettare, strutturare e implementare le pagine del suo ambito funzionale.

Il Protocollo Comune fornisce il core intoccabile.
Questo protocollo governa la scrittura del codice delle pagine del dominio Accesso.

È consentito aggiungere strutture, layout, logiche UI e comportamenti specifici del dominio, purché pienamente compatibili con il core.

1. Pagine Coinvolte

index.html (Login)

registrati.html (Registrazione)

reset_password.html (Richiesta Reset)

imposta_nuova_password.html (Set New Password)

1.1 CSS di riferimento
assets/css/accesso.css


File separato per gli stili specifici Accesso, compatibile con comune.css

Non sovrascrivere layout, classi o variabili del core

Solo stili extra specifici della pagina e dark mode

2. Layout & Scenografia Specifica

Dark Mode forzata: <html class="titanium-forced-dark">

Struttura centrata: .titanium-box → .titanium-vault

Elementi scenografici Accesso:

.glass-glow (faro ambientale)

.accesso-header e .accesso-footer (fasce estetiche)

.border-glow e effetto saetta sulla card

Icona principale: .security-icon-box

Titoli & sottotitoli: .accesso-title, .accesso-subtitle (con data-t per traduzioni)

Form e bottoni: .accesso-form-group e .accesso-btn

3. Scripting Specifico

Ogni pagina Accesso mantiene il proprio JS dedicato (login.js, registrati.js, ecc.)

Gestisce logica del form e traduzioni locali per i testi specifici della pagina

VIETATO:

Modificare tema o layout condiviso

Usare framework pesanti o librerie esterne non necessarie

4. Gestione Lingua Floating

Modulo flottante in alto a destra per selezione lingua UI

Classi: .lang-selector-container, .lang-btn-float, .lang-dropdown

Effetti animati sincronizzati con la saetta (fadeInScale)

Popolato dinamicamente da translations.js

Nota: logica di traduzione base (data-t, data-t-placeholder, applyTranslations()) è ereditata dal Protocollo Comune; qui si gestisce solo la parte visuale flottante

5. Standard Password & Autofill

Password mascherate con pallini standard browser

Attributi autocomplete obbligatori:

Login: current-password, Username: username

Nuova Password: new-password

Compatibile con FaceID, Keychain e gestori password

VIETATO: forzare asterischi personalizzati

6. Navigazione Specifica

Collegamenti tra pagine Accesso:

Login ↔ Registrazione / Reset

Reset → Login

Nuova Password → Login o Impostazioni

7. Collegamento con Agente AI

CSS/JS: usare solo accesso.css e JS dedicati

Componenti UI: solo quelli centralizzati dal core

Traduzioni: usare sistema i18n del Protocollo Comune

Check: layout, dark mode, touch target ≥36px, modali, responsive