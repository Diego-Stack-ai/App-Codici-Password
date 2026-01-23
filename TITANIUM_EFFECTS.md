# REGISTRO EFFETTI TITANIUM (Master List)
Questo documento contiene le definizioni tecniche ufficiali per il design system.
Ogni effetto ha un ID numerico per rapido riferimento. I codici qui definiti sono pronti per essere inseriti nel CSS globale `@layer components`.

---

## [#1] SFONDO PAGINA
**Descrizione:** Colore di sfondo base del `body`. Assicura che la pagina sia scura ancora prima che carichi il contenitore.
**Nome Classe:** `.titanium-bg`
**Utilizzo:** Tag `<body>`
```css
.titanium-bg {
    @apply bg-[#0a0f1e] text-white overflow-x-hidden antialiased font-display;
}
```

---

## [#2] CONTENITORE PRINCIPALE
**Descrizione:** La "scatola" metallica che contiene tutta l'app. Include le dimensioni responsive e il gradiente identitario (Gestione Light/Dark predisposta).
**Nome Classe:** `.titanium-box`
**Utilizzo:** Primo `<div>` dentro il body.
```css
.titanium-box {
    /* Layout */
    @apply relative flex min-h-screen w-full flex-col mx-auto shadow-2xl overflow-hidden;
    @apply md:max-w-3xl lg:max-w-5xl; /* Responsive limits */

    /* Colore (Predisposizione Light/Dark) */
    @apply bg-gradient-to-r from-blue-100 to-white; /* Base Light */
}
.dark .titanium-box {
    @apply bg-gradient-to-l from-[#030712] to-[#162e6e]; /* Override Dark */
}
```

---

## [#3] FARO ANIMATO (Glass Glow)
**Descrizione:** La luce ambientale blu che si muove lentamente sullo sfondo per dare vita alla pagina.
**Nome Classe:** `.glass-glow`
**Utilizzo:** Div vuoto dentro al `.titanium-box` (z-index 0).
```css
/* Codice CSS Puro (Animazione) */
.glass-glow {
    position: absolute;
    top: 0; left: 50%;
    transform: translateX(-50%);
    width: 150%; height: 120%;
    background: radial-gradient(ellipse at 50% 0%, rgba(80, 150, 255, 0.6) 0%, rgba(80, 150, 255, 0.2) 25%, rgba(80, 150, 255, 0.05) 50%, transparent 75%);
    filter: blur(80px);
    z-index: 0;
    pointer-events: none;
    animation: glowFloat 5s ease-in-out infinite;
}

@keyframes glowFloat {
    0% { transform: translateX(-50%) translateY(-150px) scale(1); opacity: 0.5; }
    50% { transform: translateX(-50%) translateY(100px) scale(1.4); opacity: 1; }
    100% { transform: translateX(-50%) translateY(-150px) scale(1); opacity: 0.5; }
}
```

---

## [#4] HEADER FUSION (Glass Obbligatorio)
**Descrizione:** La barra di navigazione superiore fissa. **Deve usare l'effetto Glass** (sfumatura + blur) per staccarsi dallo sfondo.
**Nome Classe:** `.titanium-header`
**Utilizzo:** Div fixed in alto (z-50).
```css
.titanium-header {
    @apply fixed top-0 left-0 right-0 mx-auto w-full z-50 p-4 flex items-center justify-between select-none;
    @apply md:max-w-3xl lg:max-w-5xl; /* Allineamento col box */
    @apply backdrop-blur-md bg-gradient-to-b from-white/90 to-transparent;
}
.dark .titanium-header {
    @apply bg-gradient-to-b from-[#0a0f1e]/90 to-transparent;
}
```

---

## [#5] FOOTER FUSION (Glass Obbligatorio)
**Descrizione:** La barra azioni inferiore fissa. **Deve usare l'effetto Glass**.
**Nome Classe:** `.titanium-footer`
**Utilizzo:** Div fixed in basso (z-50).
```css
.titanium-footer {
    @apply fixed bottom-0 left-0 right-0 mx-auto w-full z-50;
    @apply md:max-w-3xl lg:max-w-5xl;
    @apply backdrop-blur-md bg-gradient-to-t from-white/90 to-transparent;
}
.dark .titanium-footer {
    @apply bg-gradient-to-t from-[#0a0f1e]/90 to-transparent;
}
```

---

## [#5b] OVERLAY COMPONENTS (Glass System)
**Descrizione:** Tutti i pulsanti, icone o badge che si trovano "sopra" altri elementi (es. tasto Logout, Badge notifiche, Cerchi icone) devono avere effetto Glass.
**Regola:** Usare `bg-white/10` o `bg-white/20` con `backdrop-blur-md` e `border-white/20`.


---

## [#6] HOVER EFFECTS (Micro-interaction)
**Descrizione:** Standardizza come gli elementi reagiscono al mouse/tocco.
**Nome Classe:** `.titanium-interactive`
**Utilizzo:** Su qualsiasi Card o Bottone cliccabile.
```css
.titanium-interactive {
    @apply transition-all duration-300 cursor-pointer;
    /* Hover state */
    @apply hover:-translate-y-1 hover:shadow-lg;
    /* Active/Click state */
    @apply active:scale-[0.98];
}
```

---

## [#7] BEACON (Standard)
**Descrizione:** Effetto "faretto" dall'alto per dare tridimensionalità alle card scure.
**Nome Classe:** `.beacon-light`
**Utilizzo:** Background image su card scure.
```css
.beacon-light {
    background-image: radial-gradient(circle at 50% 0%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 60%);
}
```

---

## [#8] BEACON GOLD (Asimmetrico)
**Descrizione:** Faretto spostato a destra per card rettangolari (evita il taglio visivo).
**Nome Classe:** `.beacon-gold`
**Utilizzo:** Background image su card larghe.
```css
.beacon-gold {
    background-image: radial-gradient(circle at 80% 0%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%);
}
```

---

## [#9] BORDER GLOW
**Descrizione:** Il bordo luminoso "magico" che sembra fatto di luce. Usa maschere css avanzate.
**Nome Classe:** `.border-glow`
**Utilizzo:** Su Card, Bottoni, Input.
```css
.border-glow {
    position: relative;
    /* Rimuove bordi standard se presenti */
    border: 0; 
}
.border-glow::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit; /* Segue il radius del genitore */
    padding: 1.5px; /* Spessore bordo */
    background: linear-gradient(120deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.1) 40%, rgba(255, 255, 255, 0.1) 60%, rgba(255, 255, 255, 0.6) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    pointer-events: none;
    z-index: 20;
}
```

---

## [#10] GLASS SHINE (Glow)
**Descrizione:** Riflesso diagonale bianco che appare all'hover.
**Nome Classe:** Utilità interna (HTML snippet o componente).
**Utilizzo:** Div interno assoluto (z-10).
```html
<div class="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[inherit] pointer-events-none z-10"></div>
```

---

## [#13] SAETTA Main (Shimmer)
**Descrizione:** Riflesso metallico continuo che attraversa le card principali.
**Nome Classe:** `.saetta`
**Utilizzo:** Div interno assoluto (z-0).
```css
.saetta {
    position: absolute; inset: 0;
    background: linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.12) 50%, transparent 58%);
    background-size: 200% 100%;
    animation: shimmer 4s infinite linear;
    pointer-events: none;
    z-index: 1;
}
@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}
```

---

## [#14] SAETTA GOLD (Liste)
**Descrizione:** Variante più sottile del riflesso metallico per righe di liste.
**Nome Classe:** `.saetta-gold`
**Utilizzo:** Come Saetta Main, ma su elementi piccoli.
```css
.saetta-gold {
    /* Stesso codice di saetta ma opacity diversa o gradiente più fine */
    @apply absolute inset-0 pointer-events-none z-0;
    background: linear-gradient(110deg, transparent 42%, rgba(255, 255, 255, 0.1) 50%, transparent 58%);
    background-size: 200% 100%;
    animation: shimmer 4s infinite linear;
}
```

---

## [#15] MATRIX PALETTE
**Descrizione:** I gradienti fondamentali del sistema. Da applicare come sfondo.
**Nomi Classi:** `.matrix-blue`, `.matrix-green`, `.matrix-orange`, `.matrix-red`, `.matrix-violet`, `.matrix-amber`
```css
/* Blue (Standard/Privato) */
.matrix-blue   { background-image: linear-gradient(to bottom right, #1976D2, #2196F3); }

/* Green (Azienda) */
.matrix-green  { background-image: linear-gradient(to bottom right, #2E7D32, #00C853); }

/* Orange (Scadenze) */
.matrix-orange { background-image: linear-gradient(to bottom right, #E65100, #FF9800); }

/* Red (Urgenze) */
.matrix-red    { background-image: linear-gradient(to bottom right, #1e0707, #450a0a); }

/* Violet (Condivisi - da area_privata.html) */
.matrix-violet { background-image: linear-gradient(to bottom right, #4f46e5, #6d28d9); }

/* Amber (Memorandum - da area_privata.html) */
.matrix-amber  { background-image: linear-gradient(to bottom right, #f59e0b, #ea580c); }

/* Emerald/Teal (Memo Condivisi - da area_privata.html) */
.matrix-teal   { background-image: linear-gradient(to bottom right, #10b981, #0d9488); }
```

---

## [#16] TITANIUM GLASS CARD
**Descrizione:** Lo stile standard per le liste dati (Account, Log, File). Sfondo semitrasparente scuro.
**Nome Classe:** `.titanium-glass-card`
**Utilizzo:** Card di elementi in lista.
```css
.titanium-glass-card {
    @apply relative bg-slate-500/5 backdrop-blur-md rounded-xl p-3;
    /* Include automaticamente il bordo glow */
    @apply border-glow; 
}
```

---

## [#17] SWIPE SAFETY
**Descrizione:** Logica Javascript per prevenire click durante lo swipe su mobile.
**Nota:** Non è CSS, è un comportamento JS da applicare alle liste "Swipeable".

---

## [#18] SAETTA MASTER (Total Shimmer)
**Descrizione:** Unica grande onda luminosa che attraversa l'intera dashboard o griglia, passando sopra a tutto (anche contenuto opaco).
**Nome Classe:** `.saetta-master`
**Utilizzo:** Figlio diretto del container principale (es. `main` o `.grid-buttons`).
```css
.saetta-master { 
    position: absolute; inset: 0; 
    /* Alta intensità per visibilità su tutto */
    background: linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%); 
    background-size: 200% 100%; 
    pointer-events: none; 
    z-index: 40; /* Sopra contenuto z-10 e border z-20 */
    animation: shimmer 5s infinite linear; 
    mix-blend-mode: overlay; 
}
```
