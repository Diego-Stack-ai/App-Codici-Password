GUIDA RAPIDA CLASSI CSS E STANDARD BASE (REVISIONATA)

Questa guida raccoglie le regole fondamentali di struttura e le principali classi CSS del progetto. Aggiorna questa guida ogni volta che aggiungi nuove classi o vuoi documentare uno stile.

1) Gestione della base pagine
1.1) Pagine di accesso (solo tema scuro)

Pagine:

index.html (login)

registrati.html

reset_password.html

imposta_nuova_password.html

Classi CSS principali (dark-only):

Classe	Funzione
base-bg	Sfondo principale della pagina (full viewport, dark).
padding	Contenitore full screen che centra verticalmente e orizzontalmente il vault. Serve anche per dare lo sfondo alla pagina.
auth-vault	Wrapper interno del padding: contiene la card, i pulsanti o i box, centrato e separato dallo sfondo. Può avere proprietà responsive per mobile/tablet.
base-glow	Faro/effetto glow dietro la card/pulsanti. Animazione sempre visibile e sopra lo sfondo ma sotto la card.
auth-card	Card principale di login/registrazione. Bordo arrotondato, padding interno e shadow. Solo dove serve (accesso o dati personali).
border-glow	Bordo luminoso attorno alla card (effetto glow extra).
saetta-master / saetta-drop	Linea di luce animata, da usare sempre insieme per effetto dinamico “saetta”.
auth-icon-box	Contiene l’icona centrale della card (lucchetto, chiave, ecc.).
auth-title, auth-subtitle	Titolo e sottotitolo della card.
auth-form-group, auth-label, auth-input	Gruppi, etichette e campi input del form.
auth-btn-primary	Pulsante principale (Accedi, Registrati).

Nota: In queste pagine non esiste il tema chiaro. Tutto dark.

1.2) Restanti pagine (tema chiaro/scuro, layout a fasce)

Classi principali per la base:

Classe	Funzione
base-bg	Sfondo della pagina (light/dark).
base-container	Contenitore principale per la parte centrale della pagina.

Header:

header-balanced-container, header-left, header-center, header-right

header-avatar-box, profile-header-link, header-user-info

header-title, header-greeting-text

btn-icon-header

Footer:

footer-balanced-container, footer-left, footer-center, footer-right

btn-theme-switch, btn-footer-icon

Utility:

flex, flex-col, flex-center, flex-center-col

items-center, justify-center, justify-between

w-full, h-full, p-0, p-3, p-4, px-4, py-2, mt-2, mt-4, mb-2

rounded-xl, border-glow

bg-primary, bg-accent-blue, text-accent-blue, font-bold, ecc.

Nota: Qui si usano pulsanti o box anche al posto delle card. Gli effetti glow e saetta possono essere applicati solo se serve dinamismo.

2) Struttura e gerarchia padding / vault / card / pulsanti

Padding → occupa tutto lo schermo, sfondo principale. Centra il vault verticalmente e orizzontalmente. Non deve mai essere visibile come bordo.

Vault (auth-vault) → contenitore interno al padding, gestisce larghezza, responsive e centramento dei contenuti (card, box, pulsanti). Può avere padding interno se serve.

Card / Box / Pulsanti → contenuti reali dell’app. Possono essere card (accesso/dati personali) o box/pulsanti normali. Hanno z-index superiore a vault e glow/faro.

Effetti → base-glow e saetta-master/drop sempre dietro il contenitore reale (card o box).

In sintesi: padding = sfondo e centratura dello schermo, vault = wrapper centrato dei contenuti, card/box/pulsanti = contenuto reale.

3) Standard di Layout: Header e Footer

Header: SX = Back/Avatar, C = Titolo, DX = Home/Impostazioni

Footer: SX = Tema, C = Icone funzionali, DX = Impostazioni/Logout

Icone minimal, colore dinamico secondo tema

Eccezioni:

Home: SX = avatar, DX = logout, nessun Home

Profilo/Impostazioni: standard, ma tasto settings DX opaco/disabilitato

4) Consigli pratici

Riutilizza sempre le classi della guida per coerenza grafica.

Nuove classi → solo in operatore.css / core.css, documentare nella guida.

Dark-only: login, registrazione, reset password, nuova password.

Dark/light: tutte le altre pagine.

5) Font (core_fonts.css)

Manrope → testi principali, pesi 400 e 700.

Material Symbols Outlined → icone, peso variabile 100–700.

Regola: mai inserire font in altri CSS o HTML. Modifiche → approvazione responsabile.

Sempre includere core_fonts.css prima del core.css.

6) Migrazione e istruzioni operative

Aggiornare ogni pagina HTML:

Includere core_fonts.css e core.css

Sostituire vecchie classi con nuove (vedi tabella guida)

Verificare compatibilità visiva dark/light

Dopo ogni modifica: commit + push Git

Al termine della migrazione: rimuovere classi vecchie e operatore.css non più necessarie