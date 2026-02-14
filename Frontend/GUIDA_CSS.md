GUIDA CSS - PROTOCOLLO V4.0 (Aggiornata)

Questa guida definisce lo standard architetturale per la separazione tra struttura (HTML) e stile (CSS) nel progetto, aggiornato con contenitore base obbligatorio e gestione automatica degli spazi senza markup extra.

1) Principi Fondamentali V4.0

Zero Tailwind: vietato l’uso di qualsiasi classe utility (es. flex, gap-4).

Zero Inline Styles: vietato style="..."; tutti gli stili devono essere in classi semantiche.

Zero Inline Logic: vietato onclick="..."; tutta l’interazione tramite JS e Event Listeners.

No !important: vietato salvo override librerie esterne.

Variabili CSS: colori, spaziature e layout basati su variabili definite in core.css.

Dual Theme: ogni componente testato sia in Dark Mode che Light Mode.

2) Architettura dei File
2.1) Struttura Modulare (V4.0)

Ordine di caricamento CSS:

core.css – variabili di sistema, reset, utility globali.

core_fonts.css – font e icone.

core_fascie.css – header e footer (Glassmorphism).

core_pagine.css – libreria universale per card, box, toggle e modal premium.

core_moduli.css – liste, archivio, configurazioni e badge.

pagina_specifica.css – solo per layout complessi (es. scadenze).

2.2) Pagine “Contenuto” (Applicazione)

Header e Footer: layout balanced con Glassmorphism.

Contenitore Base Obbligatorio:

.base-container {
  position: relative;
  width: 100%;
  height: 100%;
}
.base-glow {
  position: absolute;
  inset: 0;
  background: var(--glow-bg);
  z-index: 0;
}
.page-container {
  max-width: 448px;
  margin: 0 auto;
  padding: var(--page-padding);
  width: 100%;
  z-index: 1;
}


Serve come fondazione comune per card, box, pulsanti, liste ecc.
Il padding interno e lo spacing sono gestiti esclusivamente dal CSS.
Obbligatorio per tutte le pagine dell’app.

Hero Page Header: .hero-page-header, .hero-page-icon-box, .hero-page-title.

Badge Moduli: .config-badge-blue, .config-badge-amber, .config-badge-emerald, .config-badge-purple.

3) Gestione Multilingua

data-t="chiave": contenuto testuale.

data-t-placeholder="chiave": placeholder input.

data-t-aria="chiave": etichette accessibilità.

4) Tipografia & Performance

Caricare CSS in ordine corretto per evitare errori variabili.

Animazioni tramite classi: .animate-in, .fade-in, .scale-in, .slide-in-bottom, .delay-100/200/...

5) Glassmorphism

.base-header, .base-footer, .card, .matrix-card, .modal-input-glass → sfondo minimo var(--card-bg) + backdrop-filter: blur(12px).

Valore ottimale dark: rgba(255,255,255,0.02).

Tema gestito via theme-init.js, non hardcoded.

6) Modello HTML Base Obbligatorio (Aggiornato)

Non utilizzare più <div class="spacer-header"></div> o altri spacer HTML.

<!DOCTYPE html>
<html lang="it" data-i18n="loading">
<head>
  <script src="assets/js/theme-init.js"></script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>App Base</title>
  <link rel="stylesheet" href="assets/css/core.css?v=4.0">
  <link rel="stylesheet" href="assets/css/core_fonts.css">
  <link rel="stylesheet" href="assets/css/core_fascie.css">
  <link rel="stylesheet" href="assets/css/core_pagine.css?v=1.0">
  <link rel="stylesheet" href="assets/css/core_moduli.css?v=1.0">
  <script src="assets/js/core.js"></script>
  <script type="module" src="assets/js/ui-core.js"></script>
</head>
<body class="base-bg">
  <div class="base-container">
    <div class="base-glow"></div>
    <header id="header-placeholder" class="base-header"></header>
    <main class="base-main">
      <!-- Aggiungere classi spaziatrici per header/footer fissi se presenti -->
      <div class="page-container pt-header-extra pb-footer-extra">
        <!-- Tutti i contenuti specifici della pagina -->
      </div>
    </main>
    <footer id="footer-placeholder" class="base-footer"></footer>
  </div>
  <script type="module" src="assets/js/main.js"></script>
</body>
</html>

🔔 Nota Pagine di Accesso (Always Dark)

Le 4 pagine di accesso (login, registrazione, reset password, ecc.) devono mantenere sempre la Dark Mode.
Non applicare l’HTML di esempio standard che gestisce dinamicamente il tema, perché la rimozione o l’alterazione della classe .dark comprometterebbe layout e colori.
Queste pagine devono avere <html class="dark protocol-forced-dark"> per garantire consistenza visiva.

7) Checklist di Conformità

Tutti gli elementi testuali usano data-t.

CSS caricati in ordine corretto.

Nessun Tailwind, inline style o inline logic.

Leggibilità Dark/Light testata.

Glassmorphism conforme (--card-bg: 0.02 in dark).

Tema gestito dinamicamente da JS.

Contenitore .page-container obbligatorio in tutte le pagine.

Padding interno e glow di base preservati tramite CSS.

Nessuno spacer HTML presente: il layout usa solo .base-main e .page-container per distanze verticali.