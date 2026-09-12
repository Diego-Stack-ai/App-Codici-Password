# Contratto strutturale delle pagine e del viewport

> **Stato:** attivo; collaudo fisico richiesto.
> **Autorità:** contratto UI specialistico; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** viewport e struttura delle pagine.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

## Ricevitore pubblico del contatto — eccezione v1.2.110

`contatto_condiviso.html` è la trentesima pagina canonica, distinta dalle cinque pagine di accesso e dalle 24 interne. Usa `body.base-bg`, il proprio `main.shared-contact-card`, `contact-card-receiver.css` e un entry point dedicato; non applica header/footer o bootstrap privato. Mostra esclusivamente il contatto condiviso dal QR e prepara il download vCard. Il laboratorio `prova.html` resta escluso.

Questo documento definisce esclusivamente la struttura delle 30 pagine canoniche. Non modifica né disciplina ombre, vetro, colori delle card, animazioni, watermark, decorazioni, modali o altri componenti sovrapposti.

## Perimetro ufficiale

- **Famiglia accesso:** `index.html`, `login-v115.html`, `registrati.html`, `reset_password.html`, `imposta_nuova_password.html`.
- **Famiglia interna:** le 24 pagine canoniche operative elencate in `CANONICAL_PAGE_REGISTRY.md`.
- I confronti Home e i redirect storici sono conservati in `archive/home-experiments/` e non appartengono al runtime pubblico.
- `prova.html` è un laboratorio temporaneo pubblicato per il collaudo fisico del viewport. Non è una pagina canonica, non entra nel conteggio né nel gate statico delle 30 pagine e non può introdurre eccezioni nel contratto definitivo.

## Strati comuni

L'ordine strutturale concettuale è:

```text
viewport
└── superficie radice: html
    └── fondale applicativo: body.base-bg
        └── contenitore della famiglia
            └── contenuto della pagina
```

Regole comuni:

1. Ogni pagina dichiara `width=device-width, initial-scale=1, viewport-fit=cover`.
2. `html` e `body.base-bg` coprono l'intera area visibile, incluse le safe area; l'altezza del fondale non dipende dalla quantità di contenuto.
3. Il fondale non introduce scroll, larghezza aggiuntiva o un nuovo contesto di sovrapposizione per i componenti.
4. Il contenuto non può produrre scroll orizzontale involontario.
5. Le safe area proteggono i controlli, ma non accorciano né interrompono il fondale.
6. Ombre e decorazioni possono fuoriuscire visivamente dalle card, ma non cambiano le dimensioni strutturali e non vengono definite in questo contratto.

## Famiglia accesso

Le quattro pagine operative di autenticazione:

- applicano `protocol-forced-dark` prima del rendering;
- caricano `core.css`, `core_fonts.css`, `core_ui.css` e `accesso.css`;
- usano `body.base-bg` e `.base-container`;
- non caricano `core_fascie.css` e non possiedono header/footer fissi;
- centrano `.vault` quando entra nello schermo;
- consentono lo scorrimento verticale di emergenza quando tastiera, orientamento o altezza ridotta non permettono il centraggio.

La registrazione applica attualmente questa regola tramite `registrati.css`: sui dispositivi bassi il documento può scorrere e `.base-container` non deve bloccarlo con `overflow: hidden`. La correzione locale resta compatibile con il contratto e dovrà essere assorbita nella regola comune della famiglia soltanto dopo il collaudo delle cinque pagine di accesso.

`index.html` appartiene alla stessa famiglia come ingresso minimo: mantiene tema dark, fondale comune e inoltra immediatamente alla pagina di accesso senza costruire la shell completa.

## Famiglia interna

Ogni pagina interna segue questa struttura:

```text
body.base-bg
└── .base-container
    ├── .base-glow
    ├── header.base-header
    ├── main.base-main
    │   └── .page-container.pt-header-extra.pb-footer-extra
    └── footer.base-footer
```

Regole:

- `.base-container` organizza la pagina e limita la larghezza massima senza determinare il fondale del viewport;
- `.base-main` è l'unica superficie di scorrimento verticale su mobile;
- `.page-container` controlla larghezza e margini laterali del contenuto;
- `pt-header-extra` e `pb-footer-extra` impediscono che il contenuto resti sotto header e footer e non devono allungare artificialmente il viewport;
- header e footer sono ancorati rispettivamente a `top: 0` e `bottom: 0`;
- le fasce di nebbia mantengono geometria ed effetto correnti e restano indipendenti dall'altezza del documento;
- header, footer e relativi controlli tengono conto di `safe-area-inset-top` e `safe-area-inset-bottom`.

## Eccezioni ammesse

Le classi aggiuntive come `relative`, `archive-page-content` e le compensazioni locali già censite possono organizzare il contenuto interno, ma non possono ridefinire viewport, fondale, elemento scorrevole principale o ancoraggio delle fasce.

I componenti sovrapposti saranno regolati in un contratto successivo. Fino ad allora ogni modifica strutturale deve preservare il loro ordine attuale e non introdurre nuovi `z-index` globali.

## Contratto del viewport

Il browser determina automaticamente larghezza e altezza disponibili. La soluzione deve usare le unità moderne della viewport e le safe area con fallback compatibili, senza leggere impostazioni del dispositivo e senza JavaScript di ridimensionamento salvo prova documentata che il CSS non sia sufficiente.

La correzione della fascia terminale iOS deve quindi:

- interessare la superficie radice e il fondale, non la nebbia;
- funzionare su schermi futuri più alti a parità di larghezza;
- non scalare card, pulsanti o spazi laterali;
- non aggiungere spazio scorrevole fittizio;
- non cambiare lo stacking globale;
- essere verificata sulle due famiglie, in tema chiaro e scuro, con Safari/PWA e desktop.

## Gate

`npm run test:page-shells` controlla classificazione e struttura statica delle 30 pagine. Il collaudo fisico descritto in `M4_VISUAL_ACCEPTANCE.md` resta obbligatorio per safe area, overscroll e ricomposizione grafica di iOS.

`prova.html` serve unicamente a separare il comportamento della superficie radice da header, footer, nebbia e contenuti reali. Un esito positivo nel laboratorio non chiude il gate: la stessa soluzione deve essere riportata nel contratto comune e verificata sulle due famiglie.
