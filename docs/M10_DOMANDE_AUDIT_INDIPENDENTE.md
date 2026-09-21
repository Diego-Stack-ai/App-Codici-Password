# M10 — Domande per Diego: audit indipendente e chiusura di M10-1

> **Stato:** domande **aperte**, raccolte da DeepSeek il 22/09/2026 dopo la revisione locale preparatoria
> (`docs/M10_REVISIONE_LOCALE.md`).
> **Commit del rapporto tecnico:** revisione locale e aggiornamento del censimento dei gate.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce politiche,
> correzioni o nuovo comportamento. **Non duplica** le domande già raccolte in
> `M6_DOMANDE_*`, `M7_DOMANDE_*`, `M8_DOMANDE_*`: riguarda la **commissione dell'audit** previsto da M10.

## Che cosa è stato osservato

La revisione **locale** di M10-1 è conclusa: 15 controlli automatici rieseguiti (comprese Rules 65/65 e
Storage 12/12 e `npm audit --omit=dev` a **0 vulnerabilità note**), matrice di autorizzazione dei 24
ingressi esportati letta dal codice, 11 aree esaminate, **nessuna vulnerabilità dimostrata**. Restano
quattro voci da assegnare — igiene dei log in `security-manager.js`/`vault-session.js`, bundle di terze
parti `qrcode.min.js` con `innerHTML`, parametro PBKDF2 storico a 100 000 iterazioni, P0 **già noto**
della chiave di wrapping in `sessionStorage` — e i gate esterni di M10. **Nessuna correzione** è stata
introdotta e **M10-1 resta aperto**.

## Domande

1. **Q1 — Commissione e ambito dell'audit indipendente.**
   Chi commissiona l'audit indipendente di crittografia e condivisione, e con quale ambito minimo?
   La proposta di questa revisione: (a) crittografia e gestione delle chiavi a partire dallo stato
   documentato (incluso il P0 della chiave di wrapping in `sessionStorage`); (b) isolamento fra
   proprietari e condivisione/revoca; (c) bundle di terze parti (`qrcode`) e superficie `innerHTML`;
   (d) chiarimento del parametro PBKDF2 storico. Serve indicare anche **commit o versione** da
   certificare: l'audit su una candidata diversa dalla produzione ha valore diverso.

2. **Q2 — Criterio di chiusura di M10-1.**
   Il gate si chiude con il **rapporto dell'audit** più la revisione OWASP finale firmata, oppure
   richiede anche la **bonifica** delle voci trovate? E chi decide la priorità fra le voci di igiene
   (basso rischio) e i lavori già aperti su shell persistente e staging del ripristino?

## Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: runtime, Functions, Rules, dipendenze e
dati sono **invariati**; nessun dato reale è stato letto; la revisione locale **non** sostituisce l'audit
indipendente e **non** certifica l'app. Le prove tecniche sono nel commit di revisione; questo documento
non le ripete.
