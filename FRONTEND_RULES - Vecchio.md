PROGETTO APP CODICI PASSWORD – REGOLE OPERATIVE TESTUALI PER ANTIGRAVITY

Queste regole devono essere lette e applicate da Antigravity prima di generare qualsiasi pagina. Ogni pagina creata deve rispettare queste linee guida senza eccezioni.

⚠️ Punti fortissimi da NON toccare
Queste parti sono colonne portanti dell’app e vanno mantenute senza alcuna modifica.

🔒 Regola 0 – Git & Backup

Ogni modifica sostanziale deve essere salvata su GitHub.

Quando una pagina o funzionalità è completata, fare commit immediato.

Confermare sempre lo stato finale prima di passare a nuove modifiche.

Per l’AI è chiaro: non toccare senza paracadute.

⚡ Regola 1 – CSS critico subito (Fonte Unica di Verità)

Tutti i colori di sfondo principali devono essere definiti subito all’apertura della pagina.

Il colore dello sfondo della pagina e dei contenitori principali deve avere una sola fonte di verità e non deve essere ridondante in più punti.

Concetto chiave: Fonte Unica di Verità.

Eccezione Script Critici:

Firebase core (inizializzazione, auth, database) è considerato script critico e deve essere caricato subito insieme al contenuto principale.

Firebase secondario (analytics, crashlytics, ecc.) può essere caricato differito o dopo.

Firebase di base fa parte dell’architettura, non è opzionale.

🧱 Gerarchia dei livelli (Z-index)

Modali / Overlay → massimo livello sopra tutto.

Barre fisse (header e footer) → sopra il contenuto scrollabile.

Contenuto scrollabile → sotto le barre, sopra il contenitore principale.

Contenitore principale → sotto il contenuto, sopra lo sfondo.

Sfondo pagina → livello base.

Questa gerarchia è la base per far sì che il contenuto scorra sotto le barre correttamente.

1️⃣ Caricamento visivo

Tutte le pagine devono apparire corrette immediatamente.

Colori principali e sfondi devono essere definiti subito.

Script pesanti devono essere caricati dopo il contenuto principale o con modalità differita.

Le immagini di sfondo pesanti devono essere preloadate.

2️⃣ Architettura & Stack

L’app è frontend-only e serverless.

Database e autenticazione gestiti tramite Firebase.

Linguaggi principali: HTML5, JavaScript moderno, Tailwind CSS per gli stili.

Hosting cloud su piattaforme come Firebase Hosting o Netlify.

3️⃣ Gestione tema (Light/Dark)

Ogni pagina ha una classe iniziale sul documento (light o dark).

Pagine scure:

Non applicare Tailwind globale, solo override locali se necessario.

Colori principali definiti esplicitamente al caricamento, per evitare flash.

Tailwind può essere usato solo per layout, moduli ed effetti, non per i colori principali.

Pagine chiare:

Tailwind può essere usato per gestire il selettore notte globale.

Pulsante light/dark opzionale, gestito centralmente via JavaScript.

L’utente sceglie se cambiare tema; non deve essere forzato dal form o dalla pagina.

Il cambio tema globale deve essere gestito solo dal JavaScript centrale, non dalle singole pagine.

4️⃣ Layout e scroll

Header in alto e footer in basso sempre fissi.

Contenuto centrale deve essere scrollabile sotto le barre.

La gerarchia dei livelli deve essere sempre rispettata.

5️⃣ Aiuto base

Ogni pagina utilizzabile deve avere:

Testo descrittivo breve

Tooltip o icona informativa

Messaggio contestuale

L’aiuto non deve bloccare la navigazione.

6️⃣ Tailwind CSS

Usare Tailwind solo per stili, non per logica.

Non usare Tailwind globale sulle pagine dark (già specificato in regola 3).

Tutti i background critici devono avere colori espliciti.

Tailwind reagisce solo allo stato globale (light o dark).

7️⃣ Regole per Antigravity

Leggere e applicare tutte le regole prima di generare codice.

Non modificare layout, tema o logica senza permesso.

Tutte le pagine devono rispettare layout base, tema globale, scroll sotto barre e aiuto obbligatorio.

8️⃣ Sicurezza & utenti

Ogni utente vede solo i dati propri o condivisi.

Password e dati sensibili protetti tramite Firebase Security Rules.

Conferma Eliminazione Rigida:

OGNI pulsante o azione che comporta l’eliminazione di dati (account, aziende, allegati, contatti, ecc.) DEVE attivare un popup di conferma (confirm()) prima di procedere.

Sono vietate eliminazioni silenziose, anche da JS automatico o script di background.

L’operazione deve essere eseguita solo se l’utente accetta.

9️⃣ Sintesi visiva

Pagine dark: dark, nessun Tailwind globale, override locali solo se necessario.

Pagine light: light, Tailwind può reagire al selettore notte globale.

Scroll solo sotto barre.

Aiuto base obbligatorio.

Antigravity applica le regole senza libertà creativa.

1️⃣0️⃣ Standard Layout Universale "Glass Frame"

Body: nessun padding verticale (pb-24 rimosso), colore di sfondo base (definito in 11).

Contenitore principale: min-h-screen, shadow-2xl, overflow-hidden.

Sfondo Esplicito: sempre definito tramite classe o stile

Configurazione Colori: corpo pagina e frame definiti separatamente

Fasce Glass (Header & Footer): sempre presenti, fixed z-50, bg-colore/20 + backdrop-blur-sm

Contenuto & Scroll: scorre dietro le fasce vetrose, ultimo blocco con mb-24 obbligatorio

🔍 Protocollo di Audit e Pulizia (per 30+ pagine)

Rimuovere CODICE VIETATO: 884px, #f6f7f8, bg-white/80, pb-24

Skeleton obbligatorio, layout deve rispecchiare questa nidificazione:

<body class="...(colore_base)... antialiased overflow-x-hidden">
  <div class="relative flex min-h-screen w-full flex-col max-w-md mx-auto shadow-2xl overflow-hidden bg-...(colore_frame)...">
1️⃣1️⃣ Configurazione colori e pagine

**Protocollo Tecnico "Dark Mode Forzato" (Per Pagine Speciali/Nuove)**
Per trasformare una pagina in tema dark unico (stile Scadenze/Home):
1.  **Classe Fissa:** Aggiungere `class="dark"` direttamente su `<html>`. Bloccare/Rimuovere script di toggle.
2.  **Tailwind Config:** Usare o configurare `darkMode: 'class'`. Non usare `media`.
3.  **No OS Override:** Inibire cambio automatico OS. Usare `<meta name="color-scheme" content="dark only">`.
4.  **Layout Esplicito:** Colori sfondo/contenitore definiti hardcoded (es. `#0a0f1e`).
5.  **Applicazione:** Procedere pagina per pagina, migrandole nella lista "Nuova Pagina Speciale".



### **LISTA UFFICIALE PAGINE METODO (TITANIUM)**
Queste pagine seguono rigorosamente lo standard Dark Titanium (Sfondo `#0a0f1e`, Frame `#0a0f1e`, Fasce Glass, Interattività "Prendere Vita").
>
> ### **A. Metodo Metallico "Card Titanium" (Versione Avanzata)**
> Questa è la nuova specifica per l'Area Privata, caratterizzata da un punto luce centrale, riflessi angolari e bordo luminoso.
>
> **Codice CSS (.metallic-card-titanium):**
> ```css
> .metallic-card-titanium {
>   position: relative;
>   border-radius: 0.75rem;
>   overflow: hidden;
>   background:
>     /* Punto luce centrale (Stile Faro - Urgenze) */
>     radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 60%),
>     /* Riflesso diagonale (Saetta) */
>     linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.06) 49%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 51%, transparent 58%),
>     /* Gradiente base Titanio */
>     linear-gradient(135deg, #334155 0%, #1e293b 100%);
> }
> .metallic-card-titanium::after {
>   content: "";
>   position: absolute;
>   inset: 0;
>   border-radius: inherit;
>   padding: 1px; /* Spessore bordo */
>   background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.3) 100%);
>   -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
>   -webkit-mask-composite: xor;
>   mask-composite: exclude;
>   pointer-events: none;
>   z-index: 20;
> }
> ```

**Componente Perimetrale: Bordo Riflettente (.border-glow)**
Scomposizione del bordo "Titanium" in una classe utility per applicarlo a qualsiasi elemento (Pulsanti, Box), mantenendo il background originale.
```css
/* BORDO RIFLETTENTE (GLOW BORDER) */
.border-glow {
    position: relative;
}
.border-glow::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1.5px;
    background: linear-gradient(120deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.1) 40%, rgba(255,255,255,0.1) 60%, rgba(255,255,255,0.6) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    z-index: 20;
}
```

**Interattività Standard**
Tutti gli elementi interattivi a lista, griglia o card devono "prendere vita" al passaggio del mouse.
Regole Tassative per l'animazione di hover:

1.  **Movimento Verticale (Lift):**
    *   Tutti i box/card devono sollevarsi.
    *   Classe obbligatoria: `hover:-translate-y-1`
    *   Transizione: `transition-all duration-300`

2.  **Effetto Luce (Glass Shine):**
    *   Tutti i box/card devono avere un div overlay interno per il riflesso.
    *   Codice Standard Div:
        ```html
        <div class="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none z-0"></div>
        ```
    *   Il contenitore padre deve avere `group relative overflow-hidden`.

Questo standard si applica a:
*   Pulsanti dashboard (Home Page)
*   Card "I più usati"
*   Card "Scadenze" e "Urgenze"
*   Elementi nelle liste (Lista Account, Lista Aziende, etc.)
*   Griglie di card

**Componente Sfondo: Faro Animato (Standard)**
Animazione "Respiro Profondo" per il background.
```css
.glass-glow { animation: glowFloat 4s ease-in-out infinite; }
@keyframes glowFloat {
    0% { transform: translateX(-50%) translateY(-150px) scale(1); opacity: 0.5; }
    50% { transform: translateX(-50%) translateY(100px) scale(1.4); opacity: 1; }
    100% { transform: translateX(-50%) translateY(-150px) scale(1); opacity: 0.5; }
}
```
**Registro Pagine Metodo A (Titanium) e Configurazioni Cromatiche:**
Il Metodo A definisce la *struttura* (Faro, Bordo Glow), ma ogni pagina può avere una sua declinazione cromatica per i campi interni:

Pagine.htlm da controllare;

account_azienda.html

account_privati.html

aggiungi_account_azienda.html

aggiungi_account_privato.html

aggiungi_nuova_azienda.html

aggiungi_scadenza.html

modifica_account_azienda.html

modifica_account_privato.html

modifica_azienda.html

index.html

registrati.html

login.html

verifica_email.html

reset_password.html

imposta_nuova_password.html

dashboard_amministratore.html

gestione_utenti_(admin).html


Lista pagine.html finite; 

1.  **`dati_anagrafici_privato.html` (Blue Glass Premium)**
    *   **Card Background:** `#1F3A8A` (Blu Solido Scuro)
    *   **Border Effect:** `.border-glow` obbligatorio
    *   **Input & Edit Fields:**
        *   Background: `bg-black/20` (Glass Scuro - Previene flash bianco)
        *   Text: `#F1F5F9` (Bianco Puro)
        *   Border: `border-white/5`
    *   **Labels:** `#CBD5E1` (Slate-300)
    *   **Allegati:** Lista unificata (Profilo + Documenti) con stile dark.
    
2.  **`area_privata.html`**
    *   **Palette Campi Generali:** Standard Titanium (Base) per liste e card neutre (es. "I più usati").
    *   **Palette Pulsanti Navigazione (Matrix Cromatico):**
        *   Account: `bg-gradient-to-br from-[#1e88e5] to-[#1565c0]` (Slightly Darker than Home)
        *   Condivisi: `bg-gradient-to-br from-purple-600 to-indigo-600`
        *   Memorandum: `bg-gradient-to-br from-amber-500 to-orange-600`
        *   Memo Condivisi: `bg-gradient-to-br from-emerald-500 to-teal-600`
    *   **Palette "I più usati" & "Rubrica":**
        *   Container Base: `bg-gradient-to-br from-slate-700 to-slate-900`
        *   Icona Stella: `text-yellow-400`
        *   Icona Contatti: `text-purple-400`
        *   Input Fields (Rubrica): `bg-white/5` (Variant Light Glass), Text White.

3.  **`scadenze.html`**
    *   **Palette Campi:** Standard Titanium (Base) per layout e ricerca.
    *   **Palette Dinamica Card (Stati):**
        *   **Scaduta (Expired):** Gradiente `#7f1d1d` -> `#1e0707` (Glow Red).
        *   **In Scadenza (Upcoming):** Gradiente `#f59e0b` -> `#92400e` (Glow Amber).
        *   **Normale:** Gradiente `#1e40af` -> `#0f172a` (Glow Blue).
    *   **Nota Tecnica:** Le card usano un sistema di *Triple-Glow* (Faro Alto + Lati SX/DX colorati).

4.  **`lista_aziende.html`**
    *   **Palette Campi:** Standard Titanium (Base)

5.  **`home_page.html`**
    *   **Palette Campi:** Standard Titanium (Frame globale).
    *   **Palette Dashboard (Matrix):**
        *   **Privato:** `bg-gradient-to-l from-[#1976D2] to-[#2196F3]`
        *   **Azienda:** `bg-gradient-to-l from-[#2E7D32] to-[#00C853]`
        *   **Scadenze:** `bg-gradient-to-l from-[#E65100] to-[#FF9800]`
        *   **Urgenze:** `bg-gradient-to-l from-[#1e0707] to-[#450a0a]` (Glow Red).

6.  **`account_privati.html`**
    *   **Palette Campi:** Standard Titanium (Base) per layout.
    *   **Palette Header:** Standard Titanium Glass (Neutro) - `bg-[#0a0f1e]/20` fisso.
    *   **Card:** Matrix Palette applicata ai Gradienti Interni. Le card devono avere `border-white/10` ed effetto punto luce (Beacon) interno o shadow colorata.

7.  **`archivio_account.html`**
    *   **Palette Campi:** Standard Titanium (Base) + Header Glass Neutro.
    *   **Palette Card:** Sfondo `bg-[#1e293b]/80` (Dark Base) con bordi laterali colorati (Matrix Sidebar):
        *   Privato: `border-blue-500`
        *   Azienda: `border-purple-500` (Condiviso)
        *   Memo: `border-amber-500`
    *   **Interattività:** Swipe Actions + Glass Shine su hover.

8.  **`impostazioni.html` & Sottopagine (Regole, Privacy, Info)**
    *   **Palette Campi:** Standard Titanium (Base).
    *   **Accordion:** `bg-white/5` (Closed) -> `bg-black/20` (Open). Testi interni `text-white/60`.
    *   **Menu Card:** Glass Style `bg-white/5` con `border-glow`.

9.  **`regole_scadenze_veicoli.html`**
    *   **Palette Campi:** Standard Titanium (Base).
    *   **Menu Card:** `bg-[#1e293b]` con icone glow (Blue, Amber, Teal).
    *   **Memo:** TextArea `bg-black/20`.

10. **Pagine Configurazione (`configurazione_automezzi.html`, `_documenti`, `_generali`)**
    *   **Palette Campi:** Standard Titanium (Base).
    *   **Form Style:** Input `bg-black/20`, Label `text-gray-400`.
    *   **Elementi Unici:**
        *   CheckBox/Radio: Accent Color differenziato per sezione (Blue/Amber/Teal).
        *   Bottoni Salvataggio: Stile Glass con icona animata.

11. **`privacy.html`**
    *   **Palette Campi:** Standard Titanium (Base).
    *   **Content:** Testo `text-white/70` in container `bg-white/5` (Glass Read-Only).

**12. Responsive Design Strategy (Mobile First -> Desktop)**
Il layout deve adattarsi al dispositivo massimizzando lo spazio disponibile, senza lasciare fasce vuote su tablet/desktop.

*   **Container Principale Scalabile:**
    *   **Mobile (< 768px):** `w-full` (100% width).
    *   **Tablet (md: >= 768px):** `max-w-3xl` (o `max-w-4xl`), centrato.
    *   **Desktop (lg: >= 1024px):** `max-w-5xl`, centrato.
    *   *Obiettivo:* Il contenuto respira su schermi grandi.

*   **Griglie Adattive (Grid System):**
    *   Non allargare semplicemente le card (effetto "striscia"), ma riorganizzarle.
    *   **Mobile:** 1 Colonna (`grid-cols-1`).
    *   **Tablet:** 2 Colonne (`md:grid-cols-2`).
    *   **Desktop:** 3 o 4 Colonne (`lg:grid-cols-3`).

---

1️⃣2️⃣ Eccezioni alle Regole

Pulsante "+" per Aggiungere Account: in header bar (z-50) per pagine account_privati.html e account_azienda.html.

Gestione Allegati Centralizzata: tutta la logica concentrata in gestione_allegati.html con regole di link diretto e salvataggio preventivo.