Protocollo Accesso Titanium V3.0 (Specifico Auth)

Estensione del Protocollo Comune: applicabile solo alle pagine di Login, Registrazione e Reset Password. Tutti gli elementi condivisi (CSS core, validazione base, responsive, gestione componenti via JS, multilingua di base) sono ereditati dal Protocollo Comune.
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


1. Pagine Coinvolte

index.html (Login)

registrati.html (Registrazione)

reset_password.html (Richiesta Reset)

imposta_nuova_password.html (Set New Password)

1.1 CSS di riferimento

assets/css/auth_accesso.css

Garantisce performance, indipendenza dal resto dell’app e coerenza visiva.

2. Layout & Scenografia Specifica

Dark Mode forzata: <html class="titanium-forced-dark">

Struttura centrata: .titanium-box → .titanium-vault

Elementi scenografici unici Auth:

.glass-glow (Faro ambientale)

.auth-header e .auth-footer (fasce estetiche)

.border-glow e effetto saetta sulla card

Icona principale: .security-icon-box

Titoli & sottotitoli: .auth-title e .auth-subtitle (inclusi attributi data-t per traduzioni)

Form e bottoni: .auth-form-group e .auth-btn

3. Scripting Specifico

Ogni pagina Auth mantiene il suo JS dedicato (login.js, registrati.js, ecc.)

Gestisce logica del form e traduzioni locali per i testi specifici della pagina

VIETATO modificare tema o layout condiviso

VIETATO usare framework pesanti o librerie UI esterne non necessarie

4. Gestione Lingua Floating (Specifico Auth)

Modulo flottante in alto a destra per la selezione lingua della UI Auth

Classi: .lang-selector-container, .lang-btn-float, .lang-dropdown

Effetti animati sincronizzati con la saetta (fadeInScale)

Popolato dinamicamente da translations.js

Nota: la logica di traduzione base (attributi data-t, data-t-placeholder, applyTranslations()) è ereditata dal Protocollo Comune. Questa sezione si limita alla gestione visuale flottante della lingua nelle pagine Auth.

5. Standard Password & Autofill (Specifico Auth)

Password mascherate con pallini standard del browser

Attributi autocomplete obbligatori:

Login: current-password, Username: username

Nuova Password: new-password

Compatibile con FaceID, Keychain e gestori password

VIETATO forzare asterischi personalizzati

6. Navigazione Specifica

Verifica collegamenti tra pagine Auth:

Login ↔ Registrazione / Reset

Reset → Login

Nuova Password → Login o Impostazioni