# GUIDA RAPIDA CLASSI CSS E STANDARD BASE

Questa guida raccoglie le regole fondamentali di struttura e le principali classi CSS del progetto. Aggiorna questa guida ogni volta che aggiungi nuove classi o vuoi documentare uno stile!

---

## 1) Gestione della base pagine

### 1.1) Pagine di accesso (solo tema scuro)

**Pagine:**
- index.html (login)
- registrati.html
- reset_password.html
- imposta_nuova_password.html


: = pulsante-principale — bottone principale della card (es. “Accedi”, “Registrati”), con stile evidenziato.

### 1.2) Restanti pagine (tema chiaro/scuro, layout a fasce)

**Pagine principali:**
- home_page.html
- area_privata.html
- profilo_privato.html
- impostazioni.html
- archivio_account.html
- account_azienda.html
- account_privati.html
- lista_aziende.html
- scadenze.html
- ... (aggiungi qui altre pagine)

**Classi CSS per la base:**
- base-bg (sfondo)
- base-container (contenitore principale)

**Classi CSS per header:**
- header-balanced-container
- header-left, header-center, header-right
- header-avatar-box, profile-header-link, header-user-info
- header-title, header-greeting-text
- btn-icon-header

**Classi CSS per footer:**
- footer-balanced-container
- footer-left, footer-center, footer-right
- btn-theme-switch, btn-footer-icon

**Altre classi utili:**
- flex, flex-col, flex-center, flex-center-col
- items-center, justify-center, justify-between
- w-full, h-full, p-0, p-3, p-4, px-4, py-2, mt-2, mt-4, mb-2
- rounded-xl, border-glow
- bg-primary, bg-accent-blue, ...
- text-accent-blue, ...
- font-bold, ...

---

## 2) Standard di Layout: Header e Footer

- Header: SX = Back, C = Titolo, DX = Home (tranne Home), extra pulsanti dove richiesto
- Footer: SX = Tema, C = icone funzionali, DX = Impostazioni (tranne Impostazioni)
- Icone minimal, colore dinamico secondo tema

### Eccezioni:
- Home: SX = avatar, DX = logout, nessun Home
- Profilo/Impostazioni: standard, ma su Impostazioni il tasto settings DX è opaco/disabilitato

---

## 3) Consigli pratici

- Riutilizza sempre queste classi per mantenere coerenza grafica.
- Se serve uno stile nuovo, aggiungilo solo in operatore.css e documentalo qui.
- Per il tema chiaro/scuro, usa le classi già pronte e verifica sempre l’effetto su entrambi i temi.

---

Aggiorna questa guida ogni volta che aggiungi o modifichi una classe importante!
