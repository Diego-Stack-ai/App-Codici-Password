# MEMO - PIANO DI STANDARDIZZAZIONE & REFACTORING (GUIDA - FINALE V5.0)

Questo documento traccia l'avanzamento del refactoring per allineare tutte le pagine del progetto agli standard tecnici e visuali della **GUIDA - FINALE**.
L'obiettivo è trasformare l'applicazione in un sistema modulare "Hub & Spoke", con HTML semantico pulito e CSS centralizzati.

---

## 🟢 1. GRUPPO AUTENTICAZIONE (Auth)
**Stato:** ✅ COMPLETATO E VALIDATO
**Pagine:** `index.html`, `registrati.html`, `reset_password.html`, `imposta_nuova_password.html`
**CSS:** `core.css` + `core_fonts.css` + `accesso.css` (NO Fascie)

- [x] Standardizzazione Link CSS (V5.0)
- [x] Refactoring HTML (Struttura `.auth-card`)
- [x] Rimozione script inline / Adozione `ui-core.js`
- [x] Verifica finale attributi `data-i18n` (Completa copertura)

---

## 🟡 2. GRUPPO DASHBOARD & ARCHIVIO
**Stato:** ✅ COMPLETATO E VALIDATO
**Pagine:** `home_page.html`, `archivio_account.html`
**CSS:** `core.css` + `core_fonts.css` + `core_fascie.css` + `dashboard.css` (Home) / `core_moduli.css` (Archivio)

**Azioni Richieste:**
- [x] Standardizzazione Link CSS (V5.0)
- [x] **Home:** Implementazione "Saluto Dinamico" (Buongiorno/Buonasera [Nome]) - *Feature Specifica*.
- [x] **Home:** Verifica presenza stili effetti speciali (Saetta/Glow/Vetro) in `dashboard.css`.
- [x] **Archivio:** Riscrittura HTML Lista/Search (Adottare classi `.search-field-box` standard).
- [x] **Archivio:** Rimozione classi legacy obsolete (`.settings-item` rimosso da bottone eliminazione).
- [x] **Archivio:** Standardizzazione Dropdown (Aggiunte classi `.base-dropdown` in `core_moduli.css`).
- [x] Integrazione Search/Filtri (Struttura corretta per manipolazione JS).

---

## 🟢 3. GRUPPO SCADENZE
**Stato:** ✅ COMPLETATO E VALIDATO
**Pagine:** `scadenze.html`, `dettaglio_scadenza.html`, `aggiungi_scadenza.html`
**CSS:** `core.css` + `core_fonts.css` + `core_fascie.css` + `scadenze.css`

**Azioni Richieste:**
- [x] Standardizzazione Link CSS (V5.0)
- [x] Unificazione CSS (`core-transizione` -> `scadenze.css`)
- [x] **Dettaglio:** Verifica layout "Hero Header" standard.
- [x] **Form:** Bonifica completa HTML da classi Tailwind (Sostituite con classi semantiche `.form-grid-2`, `.icon-box-*`).
- [x] Standardizzazione Input e Dropdown con nuove utility semantiche.

---

## � 4. GRUPPO CONFIGURAZIONE
**Stato:** ✅ COMPLETATO E VALIDATO
**Pagine:** `configurazione_generali.html`, `configurazione_documenti.html`, `configurazione_automezzi.html`, `regole_scadenze.html`
**CSS:** `core_moduli.css` (Esteso con utility header e text)

**Azioni Richieste:**
- [x] Standardizzazione Link CSS (V5.0)
- [x] **Header:** Sostituzione header legacy con classi semantiche `.settings-header-actions` e `.btn-icon-add`.
- [x] **JS Dinamico:** Bonifica classi Tailwind nei template JS (`configurazione_*.js`).
- [x] **CSS:** Aggiunta utility mancanti (`.text-left`, `.text-secondary`, `.settings-dropdown-panel`) in `core_moduli.css`.
- [x] Verifica coerenza stile "Dark Glass" su liste e accordion.
- [ ] Rimozione script specifici (spostare logica in moduli JS standard).
- [ ] Eliminazione classi CSS legacy "orfane" dal markup.

---

## 🟢 5. GRUPPO PAGINE SINGOLE
**Stato:** ✅ COMPLETATO E VALIDATO
**Pagine:** `profilo_privato.html`, `impostazioni.html`, `privacy.html`
**CSS:** `core`... + `core_moduli.css` (Esteso con Privacy & Data Display System)

**Azioni Richieste:**
- [x] Standardizzazione Link CSS (V5.0)
- [x] **Impostazioni:** Verifica switch `.settings-toggle` (Presenti in `core_moduli.css`).
- [x] **Profilo:** Adozione classi standard `.data-display-group` per visualizzazione dati.
- [x] **Privacy:** Standardizzazione tipografia con classi `.settings-content-text` e `.settings-list-styled`.

---

## 🟡 6. GRUPPO AZIENDA (Business Logic)
**Stato:** 🚧 IN CORSO
**Pagine:** `lista_aziende.html`, `aggiungi_nuova_azienda.html`, `dati_azienda.html`, `modifica_azienda.html`, `account_azienda.html`, `form_account_azienda.html`, `dettaglio_account_azienda.html`, `modifica_account_azienda.html`
**CSS:** `core_moduli.css` (Richiede estensione "Form Edit System")

**Azioni Richieste:**
- [ ] **Dettaglio Account:** Refactoring layout Hero e Card visualizzazione dati (allineamento V5.0).
- [ ] **Modifica Azienda:** Bonifica TOTALE HTML da utility Tailwind (uso `.form-grid-2`, `.input-group`).
- [ ] **Wizard Form:** Standardizzazione dei form di creazione/modifica account.
- [ ] **Liste:** Standardizzazione `lista_aziende.html` con layout archivio.
- [ ] Verifica integrazione logica QR Code e nuovi componenti Business.

---

## � 7. GRUPPO PRIVATI
**Stato:** ⏳ DA INIZIARE
**Pagine:** `account_privati.html`, `form_account_privato.html`, `dettaglio_account_privato.html`

**Azioni Richieste:**
- [ ] Sincronizzazione stili con il sistema "Data Display" del profilo.
- [ ] Standardizzazione sezioni input e allegati.

---

## 🔘 8. GRUPPO AREA PRIVATA
**Stato:** ⏳ DA INIZIARE
**Pagine:** `area_privata.html`

**Azioni Richieste:**
- [ ] Verifica layout Dashboard personale (Dashboard Pro).
- [ ] Allineamento Card informative e link rapidi.

---

## � 9. GRUPPO NOTIFICHE
**Stato:** ✅ COMPLETATO E VALIDATO
**Pagine:** `notifiche_storia.html`
**CSS:** `core_moduli.css` (Esteso con Notification System V5.0)

**Azioni Richieste:**
- [x] Standardizzazione layout lista cronologica (Timeline Style).
- [x] Sostituzione icone e utility Tailwind con classi semantiche `.notification-item`.
- [x] Bonifica template dinamico in `notifiche_storia.js`.
- [x] Verifica icone di stato (Push/Email/Sms) con varianti colore (`notif-success`, `notif-warning`, etc.).

---

## 📝 NOTE TECNICHE & STANDARD (V5.0)
1.  **Icone:** Usare SOLO `Material Symbols Outlined`.
2.  **Colori:** Usare SOLO variabili CSS (`var(--primary)`, `var(--card-bg)`, etc.).
3.  **Layout:** Privilegiare `display: grid` con `.form-grid-2` per i form su due colonne.
4.  **Componenti:** Usare i componenti semantici definiti in `core_moduli.css` (Badge, Toggle, Input).

