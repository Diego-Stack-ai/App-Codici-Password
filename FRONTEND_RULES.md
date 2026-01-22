Regola 1 – CSS critico subito
•	Tutti i colori di sfondo principali devono essere definiti subito all’apertura della pagina.
•	Colore sfondo pagina e contenitore principale: obbligatoriamente gradiente blu scuro (Metodo Titanium).
•	Script critici (Firebase core: auth, database) caricati subito insieme al contenuto.
•	Script secondari (analytics, crashlytics) possono essere caricati differiti.
________________________________________
Regola 2 – Colori base e Faro
•	Sfondo pagina: gradiente blu scuro, sempre presente, obbligatorio su tutte le pagine.
•	Contenitore principale: gradiente blu scuro, sempre presente, obbligatorio.
•	Faro animato (effetto “vivo” dall’alto): obbligatorio su tutte le pagine, sopra il contenitore.
•	Bloccato l’accesso a temi chiari o variabili: l’utente non può cambiare tema.
•	Tutti gli altri colori interni sono definiti pagina per pagina in Regola 14.
________________________________________
Regola 3 – Divieto gestione temi variabili
•	Vietato qualunque tema “light”, “dark” o speciale.
•	Blocca modifiche automatiche da sistema operativo (es. iOS, Android).
•	Colori interni a pulsanti, card, campi devono essere definiti pagina per pagina (Regola 14).
________________________________________
Regola 4 – Layout e scroll
•	Header e footer sempre fixed, z-index superiore al contenuto.
•	Contenuto scrollabile sotto barre, ma blocchi principali non cliccabili o copiabili.
•	Scroll solo sul contenitore centrale, proporzionale e responsivo a PC, tablet, mobile.
________________________________________
Regola 5 – Aiuto base
•	Ogni pagina deve avere:
o	Testo descrittivo breve (non copiabile)
o	Tooltip o icona informativa
o	Messaggio contestuale
•	Aiuto non blocca la navigazione.
•	Tutti i testi descrittivi, istruzioni o regole dell’app devono essere non copiabili e non selezionabili.
________________________________________
Regola 6 – Tailwind CSS
•	Usare solo per layout, moduli ed effetti.
•	Colori principali definiti hardcoded (non dipendenti da Tailwind globale).
•	Bloccare qualsiasi modifica automatica dei colori da Tailwind per i gradienti universali.
________________________________________
Regola 7 – Regole operative Antigravity
•	Antigravity deve leggere tutte le regole prima di generare codice.
•	Non modificare layout, tema o logica senza permesso.
•	Tutte le pagine rispettano:
o	Layout base
o	Tema globale bloccato
o	Contenitore responsivo
o	Aiuto obbligatorio
•	Deve attendere input specifico pagina per pagina prima di creare o modificare qualsiasi pagina.
________________________________________
Regola 8 – Sicurezza & utenti
•	Ogni utente vede solo dati propri o condivisi.
•	Password e dati sensibili protetti tramite Firebase Security Rules.
•	Eliminazione dati → confirm() obbligatorio.
•	Mai eliminazioni silenziose o automatiche.
________________________________________
Regola 9 – Sintesi visiva
•	Sfondo e contenitore sempre scuri (Metodo Titanium).
•	Scroll sotto barre, overlay e modali rispettano z-index.
•	Aiuto obbligatorio.
•	Nessun Tailwind globale sui colori critici.
________________________________________
Regola 10 – Standard Layout Universale “Glass Frame”
•	Body: nessun padding verticale, colore di sfondo base definito.
•	Contenitore principale: min-h-screen, shadow, overflow-hidden.
•	Fasce Glass header/footer: fixed, z-50, backdrop-blur, semi-trasparenti.
•	Contenuto scorre dietro le fasce, ultimo blocco mb-24 obbligatorio.
________________________________________
Regola 11 – Configurazione colori e pagine
•	Colori universali: sfondo, contenitore, faro.
•	Effetti obbligatori su tutte le pagine: hover, Beacon, Bacon, Glow.
•	Pulsanti, liste, card: colori definiti pagina per pagina in Regola 14.
•	Bloccare selezione e copia dei testi descrittivi o istruzioni all’interno dei contenitori.
________________________________________
Regola 12 – Responsive design
•	Layout mobile-first: contenitore principale adatta dimensioni e proporzioni a PC, tablet e smartphone.
•	Griglie adattive: 1 colonna mobile, 2 tablet, 3/4 desktop.
•	Tutti gli elementi interattivi mantengono proporzioni, dimensioni e posizione coerenti con il Metodo Titanium.
________________________________________
Regola 13 – Eccezioni e elementi speciali
•	Pulsante “+” per aggiungere account in header (z-50) rimane eccezione gestita centralmente.
•	Gestione allegati centralizzata, logica concentrata in gestione_allegati.html.
•	Tutti gli elementi interattivi rimangono conformi alla regola dei gradienti/blu scuro e al faro.
### Regola 14 – Registro Pagine Metodo Titanium

Monitoraggio dello stato di avanzamento. Ogni pagina deve essere portata dallo stato 🔴 allo stato 🟢.

| # | Stato | Nome Pagina | Contenitore | Faro | Effetti Card | Palette / Colori |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 🟢 COMPLETATA | `index.html` (Login) | 1, 2 | 3 | 4, 5, 9, 13 | Fusion Clean |
| 2 | 🔴 DA FARE | `registrati.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 3 | 🔴 DA FARE | `verifica_email.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 4 | 🔴 DA FARE | `reset_password.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 5 | 🔴 DA FARE | `imposta_nuova_password.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 6 | 🔴 | `dashboard_amministratore.html` | Titanium Frame | Beacon (4s) | Premium | Matrix Cromatico |
| 7 | 🔴 | `gestione_utenti_(admin).html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 8 | 🔴 | `account_azienda.html` | Titanium Frame | Beacon (4s) | Premium | Matrix Interno |
| 9 | � COMPLETATA | `account_privati.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | **Titanium Glass Cards**: Layout a griglia con card dinamiche. 1) **Architettura**: `bg-slate-500/5`, `border-glow`, `saetta`. 2) **Dati**: `view-label` (9px upper) + Glass Field per Utente/Account/Pass. 3) **Feedback**: Beacon colorato per tipologia (Standard/Shared/Memo).|
| 10 | 🔴 | `aggiungi_account_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 11 | 🔴 | `aggiungi_account_privato.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 12 | 🔴 | `aggiungi_nuova_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 13 | 🔴 | `aggiungi_scadenza.html` | Titanium Frame | Beacon (4s) | Dinamico | Matrix Scadenze |
| 14 | 🔴 | `modifica_account_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 15 | 🔴 | `modifica_account_privato.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 16 | 🔴 | `modifica_azienda.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 17 | 🟢 COMPLETATA | `home_page.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 14, 15 | Matrix Fusion |
| 18 | 🟢 COMPLETATA | `dati_anagrafici_privato.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | **Titanium Glass Section Box**: Architettura a nidificazione premium. 1) **Section Box**: `bg-color-500/5`, `border-white/5`, `rounded-2xl`, `p-5`. 2) **Dato Informativo**: Label tecnico (9px bold upper) + Glass Field + Utility on hover. 3) **Color-Coding**: Blue (Pers), Emerald (Res), Amber (Utenze), Violet (Doc), Rose (Tel), Cyan (Mail), Yellow (Note). |
| 19 | 🟢 COMPLETATA | `area_privata.html` | 1, 2 | 3 | 4, 5, 9, 11 | **Dashboard Navigazione**: 4 card Matrix (Account / Account condivisi / Memorandum / Memo condivisi) - Nomenclatura in Title Case (No Uppercase). Widget Top 10 e Rubrica in Titanium Section Box. |
| 20 | 🔴| `scadenze.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | **Scadenze**: 4 card Matrix (Account, Condivisi, Memo, Sh.Memo) + Widget Top 10 e Rubrica in Titanium Section Box. |
| 21 | 🔴 | `lista_aziende.html` | Titanium Frame | Beacon (4s) | Standard | Palette Standard |
| 22 | 🟢 COMPLETATA | `archivio_account.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Matrix Sidebar |
| 23 | 🟢 COMPLETATA | `impostazioni.html` | 1, 2 | 3 | 4, 5, 6, 9, 10, 13 | Fusion Glass |
| 24 | 🟢 COMPLETATA | `regole_scadenze_veicoli.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Dark Menu Glow |
| 25 | 🟢 COMPLETATA | `configurazione_automezzi.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 26 | 🟢 COMPLETATA | `configurazione_documenti.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 27 | 🟢 COMPLETATA | `configurazione_generali.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | Form Input Glass |
| 28 | 🔴 | `privacy.html` | Titanium Frame | Beacon (4s) | Standard | Glass Read-Only |
| 29 | 🔴 | `gestione_scadenze.html` | Titanium Frame | Beacon (4s) | Dinamico | Matrix Scadenze |
| 30 | 🔴 | `gestione_urgenze.html` | Titanium Frame | Beacon (4s) | Dinamico | Red Glow Matrix |
| 31 | 🔴 | `gestione_memorandum.html` | Titanium Frame | Beacon (4s) | Standard | Memo Matrix |
| 32 | 🔴 | `gestione_memo_condivisi.html` | Titanium Frame | Beacon (4s) | Standard | Memo Shared Matrix |
| 33 | 🔴 | `lista_contatti.html` | Titanium Frame | Beacon (4s) | Standard | Icone Contatti |
| 34 | 🟢 COMPLETATA | `notifiche_history.html` | 1, 2 | 3 | 4, 5 | Fusion Blue |
| 35 | 🟢 COMPLETATA | `dettaglio_account_privato.html` | 1, 2 | 3 | 4, 5, 6, 9, 10 | **Titanium Glass Fields**: Layout informativo ultra-tecnico. 1) **Campi**: `bg-slate-500/5`, `border-glow`. 2) **Etichette**: `view-label` (9px upper bold). 3) **Layout**: Header Fusion con sottotitolo 'Privato' e rimozione badge categoria per massima pulizia visiva. |



•	Regola 15 – Impostazione Effetti Metodo Titanium
Effetto / Elemento	Descrizione	Codice / Parametri	Applicazione
==============================================
-1) Sfondo pagina (pagina 0)	Colore di base della pagina, garantisce contrasto con il contenitore metallico	class="bg-[#0a0f1e]"	Body / pagina completa, tutte le pagine Metodo Titanium
==============================================
-2) Contenitore principale (Box)	Contenitore metallico responsivo a step (Mobile: 100%, Tablet: 3xl, Desktop: 5xl)	<div class="relative flex min-h-screen w-full flex-col md:max-w-3xl lg:max-w-5xl mx-auto shadow-2xl overflow-hidden bg-gradient-to-l from-[#030712] to-[#162e6e]">	Tutte le pagine Metodo Titanium
==============================================
-3) Faro animato (Glass Glow)	Punto luce blu di sfondo che "respira" dietro il contenuto (z-0)	.glass-glow { position: absolute; top: 0; left: 50%; width: 150%; height: 120%; background: radial-gradient(ellipse at 50% 0%, rgba(80, 150, 255, 0.6) 0%, rgba(80, 150, 255, 0.2) 25%, rgba(80, 150, 255, 0.05) 50%, transparent 75%); filter: blur(80px); z-index: 0; animation: glowFloat 4s ease-in-out infinite; }	Sfondo (z-0) / Tutte le pagine Metodo Titanium
==============================================
-4) Header Fusion	Fascia superiore sfumata che si fonde con il contenuto	bg-gradient-to-b from-[#0a0f1e] to-transparent backdrop-blur-md (No border)	Tutte le pagine
==============================================
-5) Footer Fusion	Fascia inferiore sfumata che si fonde con il contenuto	bg-gradient-to-t from-[#0a0f1e] to-transparent backdrop-blur-md (No border)	Tutte le pagine
==============================================
-6) Hover / Active (Evoluzione)	Effetto combinato di sollevamento, pressione e micro-interazioni interne per un feedback premium	hover:-translate-y-1 active:scale-[0.98] transition-all duration-300. Micro: group-hover:translate-x-1 (testo), group-hover:scale-110 (icone)	Box, pulsanti, card, sub-box
-7) Beacon (Standard)	Punto luce bianco centrato in alto alla card per profondità 3D	radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%)	Interno Card
-8) Beacon Gold (Asimmetrico)	Punto luce spostato per card lunghe (evita il "taglio" visivo)	radial-gradient(circle at 80% 0%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%, height: 100%)	Interno Card (Premium)
-9) Border Glow Riflettente	Bordo luminoso con doppia maschera per compatibilità cross-browser	-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude;	Card / Bottoni
-10) Glow	Overlay luminoso o gradienti interni; evidenzia elementi dinamici o attivi	<div class="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[24px] pointer-events-none z-10"></div>	Box, sub-box, pulsanti interni
-11) Sub-box	Widget o contenitore informativo interno (es. Rubrica, Top Accounts)	bg-gradient-to-br from-slate-700 to-slate-900 rounded-[24px] shadow-lg shadow-black/20 relative overflow-hidden + class="border-glow"	Box principale
-12) Pulsante interno Sub-box	Pulsante cliccabile nel sub-box; può avere colore e overlay propri	Stile pulsante standard + eventuali effetti: hover, border glow, glow	Sub-box
-13) Saetta (Metallic Shimmer)	Riflesso metallico diagonale animato (z-10)	.saetta { background-size: 200% 100%; animation: shimmer 4s infinite linear; }	Card principali (Premium)
-14) Saetta Gold (Liste)	Riflesso metallico sottile per item interni alle liste	.saetta-gold { position: absolute; inset: 0; background: linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.1) 50%, transparent 58%); animation: shimmer 4s infinite linear; }	Item interni (Scadenze, Urgenze)
-15) Matrix Palette (4 Box)	Set di gradienti standard per le card principali della Home	🔵 [#1976D2]→[#2196F3], 🟢 [#2E7D32]→[#00C853], 🟠 [#E65100]→[#FF9800], 🔴 [#1e0707]→[#450a0a]	Home Page / Dashboard
-16) Titanium Glass Card (Grid/List)	Nuovo standard per item di navigazione e record	bg-slate-500/5 + border-glow + saetta + view-label (9px bold upper) + Glass Field (Sensitive Data)	Account, Liste, Record dinamici
-17) Swipe Safety (Ghost Click Fix)	Prevenzione navigazione accidentale durante swipe	Capture phase blocking + hasMoved threshold detection (5px)	Ogni SwipeList v6 o superiore
==============================================


