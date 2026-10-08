# Interfaccia

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Questa raccolta mantiene distinti i contratti specialistici (pagine, registro canonico e design system) dalla guida implementativa Frontend. In caso di conflitto prevalgono i primi, secondo la gerarchia storica preservata nell’indice. Le note di avanzamento Frontend sono nello storico; non costituiscono una seconda roadmap.

## Integrazione corrente — palette colore

La modalità luminosa (`chiaro`, `automatico`, `scuro`) e la palette cromatica sono preferenze indipendenti. Le palette ammesse sono `blue`, `green`, `red` e `sand`; `blue` è il fallback per valori assenti o non validi. La preferenza locale viene applicata da `theme-init.js` prima del rendering per evitare il cambio colore visibile all’avvio. `core.css` resta l’autorità dei token d’identità; colori funzionali di successo, avviso ed errore e colori di categoria non cambiano significato con la palette. I controlli in Impostazioni devono esporre selezione visiva e stato accessibile `aria-pressed`.

## Indice delle fonti conservate

- [GUIDA.md](#fonte-frontend-guida-md-l1)
- [CANONICAL_PAGE_REGISTRY.md](#fonte-docs-canonical-page-registry-md-l1)
- [PAGE_SHELL_CONTRACT.md](#fonte-docs-page-shell-contract-md-l1)
- [UI_DESIGN_SYSTEM_CONTRACT.md](#fonte-docs-ui-design-system-contract-md-l1)

<a id="fonte-frontend-guida-md-l1"></a>

## Fonte: GUIDA.md — righe originali 1–115

> Provenienza: `Frontend/GUIDA.md` a `2900ccc0`.

<a id="fonte-frontend-guida-md-guida-tecnica-operativa--codici--password"></a>

## Guida tecnica operativa — Codici & Password

> **Stato:** guida implementativa attiva; stato runtime distinto dai requisiti obiettivo.\
> **Autorità:** subordinata a [Guida progetto](../LEGGIMI.md), [Architettura Sicurezza V1](SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1) e contratti specialistici.\
> **Riferimento:** v1.2.110, commit applicativo `fa555d49d45e3a3545d09bc862645e84ba386862`.\
> **Verifica documentale:** 12 settembre 2026.\
> **Area:** frontend, UI, accesso dati, sicurezza e manutenzione.\
> **Dipendenze:** contratti collegati nelle sezioni seguenti; [registro aggiornamenti](../storico/REGISTRO.md#fonte-frontend-guida-aggiornamenti-md-l1).\
> **Orientamento (non normativo):** [STATO_CORRENTE_M0_M10.md](../progetto/STATO.md#fonte-docs-stato-corrente-m0-m10-md-l1) raccoglie una vista operativa **datata** dello stato documentato; [REGISTRO_DECISIONI.md](../progetto/DECISIONI.md#fonte-docs-registro-decisioni-md-l1) indicizza decisioni e approvazioni **già presenti nelle fonti**. Entrambi sono **non normativi** e **non sostituiscono** baseline, contratti, guide o fonti originali: baseline e contratti mantengono la **precedenza normativa**.\
> **Sostituisce:** le prescrizioni V7/V8 della precedente revisione di questo stesso file, conservate nella cronologia Git. Non sostituisce la baseline o i contratti specialistici.

<a id="fonte-frontend-guida-md-1-uso-della-guida"></a>

### 1. Uso della guida

Questa guida indica le regole operative consolidate. I contratti specialistici prevalgono; gli audit descrivono soltanto il commit e il perimetro indicati. Un test passato non certifica configurazione Firebase, dispositivi o sicurezza complessiva.

Prima di un intervento verificare il codice corrente, il contratto dell'area, i dati legacy coinvolti e i test pertinenti. Non rimuovere una funzione, un campo o un fallback sulla sola base della sua età. Non eseguire migrazioni, bonifiche o scritture di prova sui dati reali come effetto collaterale di un audit.

<a id="fonte-frontend-guida-md-2-pagine-bootstrap-e-viewport"></a>

### 2. Pagine, bootstrap e viewport

Il [registro canonico](INTERFACCIA.md#fonte-docs-canonical-page-registry-md-l1) identifica la superficie applicativa. Alla v1.2.110 comprende 30 pagine: cinque di accesso, 24 interne e il ricevitore pubblico `contatto_condiviso.html`. `prova.html` è un laboratorio temporaneo escluso dal conteggio.

Il [contratto delle pagine](INTERFACCIA.md#fonte-docs-page-shell-contract-md-l1) disciplina struttura, scroll, safe area e viewport. Le pagine interne usano `body.base-bg`, contenitore comune, header, `.base-main`, `.page-container` e footer. Le pagine di accesso hanno un bootstrap e un layout distinti; il ricevitore pubblico del contatto non carica la shell privata.

Il router e il bootstrap correnti sono `pages-init.js`, `main-v129.js` e gli entry point dedicati. I moduli di pagina espongono il proprio inizializzatore e non duplicano bootstrap o listener. Questo vincolo non vieta ai moduli di dominio di esportare API condivise né agli entry point dedicati di inizializzare la propria pagina.

La shell e gli stati di caricamento devono apparire senza attendere una sincronizzazione globale dei dati. Traduzioni, autenticazione, sblocco e caricamento mantengono i gate effettivi del rispettivo flusso. Non reintrodurre un occultamento globale fino al download completo.

La famiglia accesso conserva il tema previsto e consente scroll di emergenza con tastiera o schermo basso. Modifiche a nebbia, safe area, stacking o viewport richiedono confronto con il [collaudo M4](../procedure/COLLAUDI.md#fonte-docs-m4-visual-acceptance-md-l1); le prove estese rimangono nel gate M10.

<a id="fonte-frontend-guida-md-3-css-componenti-e-accessibilità"></a>

### 3. CSS, componenti e accessibilità

Il [contratto UI](INTERFACCIA.md#fonte-docs-ui-design-system-contract-md-l1) distingue fondazioni, componenti, modelli di pagina e stili esclusivi. Non creare un foglio globale che assorba differenze funzionali.

- `core.css`: fondale, temi, token, watermark e livelli condivisi.
- `core_fonts.css`: Manrope e Material Symbols locali, token tipografici.
- `core_fascie.css`: header, footer, nebbia e compensazioni.
- `core_ui.css` e `moduli.css`: controlli, modali, campi e stati condivisi.
- `account_form.css`, `account_detail.css`, `azienda_shared.css` e `profile-layout.css`: composizioni comuni ai rispettivi domini.
- CSS di pagina: comportamento e presentazione realmente esclusivi.

Rispettare l'ordine di caricamento verificato per ciascuna famiglia; non applicare una sequenza unica alle pagine pubbliche e private. Non introdurre Tailwind runtime, stili inline o nuove librerie UI per sostituire componenti già esistenti. Le utilità locali del progetto non sono automaticamente Tailwind e non vanno eliminate meccanicamente.

Usare token tipografici, target tattili di almeno 44 px, nomi accessibili, focus e movimento ridotto. Conservare occhio, copia e azioni contestuali accessibili. I controlli custom devono mantenere semantica, tastiera e selezione; la sola estetica non autorizza a sostituire un controllo accessibile con un `div` privo di comportamento.

Non applicare divieti globali di `!important`, selettori ID o valori numerici che cancellino eccezioni già presenti nelle fondazioni. Verificare cascade e contesto del componente; una normalizzazione richiede equivalenza e collaudo.

I nuovi testi usano il sistema i18n, inclusi placeholder, ARIA, errori e contenuti dinamici. La revisione editoriale globale di lingue e Impostazioni resta nella fase post-M10. I dizionari generati si aggiornano con `scripts/split-translations.mjs`, non manualmente.

<a id="fonte-frontend-guida-md-4-dati-cache-e-operazioni-asincrone"></a>

### 4. Dati, cache e operazioni asincrone

Il [contratto di accesso dati](DATI.md#fonte-docs-data-access-contract-md-l1) definisce il percorso pagina → repository → adattatore Firestore. Le letture ordinarie sono cache-first; dopo una scrittura confermata si usa il percorso mirato `afterWrite`/server-confirmed. Non trasformare tutte le letture in server-first.

Il coordinatore accorpa richieste concorrenti della stessa risorsa e le libera anche in errore. Non memorizzare dati decifrati nel repository. Non lasciare Promise non attese mediante `forEach(async ...)`: usare un ciclo atteso oppure parallelismo limitato secondo le dipendenze.

La UI distingue caricamento, vuoto, indisponibilità offline, conflitto ed errore. Un refresh fallito non deve cancellare una copia locale valida. La cache non garantisce che una raccolta sia completa o che un allegato sia disponibile offline.

La [policy dei conflitti](OFFLINE.md#fonte-docs-offline-write-conflict-policy-md-l1) e [M6](OFFLINE.md#fonte-docs-m6-sincronizzazione-offline-md-l1) governano revisioni, coda e retry. Il cutover è limitato ad Account e memorandum privati isolati. Banca, condivisioni e collegamenti Profilo restano fuori da quel percorso; la consultazione bancaria offline su iPhone ha un gate non superato.

<a id="fonte-frontend-guida-md-5-account-profili-widget-e-scadenze"></a>

### 5. Account, profili, widget e scadenze

Il [contratto funzionale](DATI.md#fonte-docs-functional-data-contract-md-l1) conserva i domini e i percorsi dati; la [roadmap Profilo/Account/Widget](../storico/REGISTRO.md#fonte-docs-profilo-account-widget-cache-roadmap-md-l1) descrive proprietà, collegamenti e compatibilità.

- Account e Account condivisi possono avere username, codice e password; memorandum non conservano copie nascoste di queste credenziali. Il cambio di tipo richiede la scelta consapevole prevista dal modello condiviso.
- Account aziendali conservano `aziendaId` e il percorso sotto l'azienda. Il contesto del proprietario resta distinto dal visitatore.
- Profilo personale e Dati azienda condividono linguette e componenti, mantenendo campi e significati propri.
- Più recapiti possono riferire lo stesso Account. Apri, cambia e scollega devono operare sul collegamento; scollegare non elimina l'Account.
- Le credenziali appartengono all'Account collegato. Non cancellare copie legacy finché trasferimento e confronto non sono verificati nel flusso autorizzato. Le modifiche del singolo utente non autorizzano una pulizia globale del database.
- Widget incorporati e Credenziali comuni hanno proprietà e percorsi distinti. I valori comuni non si duplicano e non vengono ereditati automaticamente dagli ospiti di un Account.
- Il QR contiene soltanto i dati esplicitamente ammessi e selezionati. Foto e dati del contatto seguono il ricevitore pubblico; password, PIN, PUK e campi sensibili restano esclusi.
- Scadenze proprie e copie ricevute sono domini distinti. Il backend verifica destinatario e permesso corrente; notifiche e link non sostituiscono l'autorizzazione.

Le configurazioni Scadenze rimangono separate in `deadlineConfig`, `deadlineConfigDocuments` e `generalConfig`. Non cambiare automaticamente le scadenze esistenti quando si aggiorna una configurazione. Le cancellazioni seguono i contratti del dominio e i gate di recupero: nessun gesto UI autorizza da solo una bonifica massiva.

<a id="fonte-frontend-guida-md-6-sicurezza-e-condivisione"></a>

### 6. Sicurezza e condivisione

La [baseline](SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1) e il [contratto Vault](VAULT.md#fonte-docs-vault-key-contract-md-l1) separano password Firebase, Master Password, KEK, Vault Key e Recovery Key. AES-GCM è il riferimento corrente; `libsodium` e la frase di recupero di 24 parole erano proposte storiche, non decisioni operative.

Lo stato della sessione è descritto nell'[audit Vault](../evidenze/AUDIT.md#fonte-docs-audit-vault-session-p0-md-l1): payload e chiave di wrapping nello stesso storage mantengono aperto il rilievo. Non replicare questa persistenza come soluzione conforme. Il blocco per inattività è distinto dal logout Firebase; pulizia dei singoli percorsi e collaudo fisico restano verifiche specifiche.

La [classificazione dei campi](../evidenze/INVENTARI.md#fonte-docs-encrypted-field-inventory-md-l1) è un inventario incompleto, non un'autorizzazione a lasciare tutte le anagrafiche o etichette in chiaro. La baseline richiede classificazione e minimizzazione. Non riscrivere i dati per eliminare una discrepanza documentale.

La [condivisione M5](CONDIVISIONE.md#fonte-docs-m5-condivisione-threat-model-md-l1) distingue ACL legacy e consegna crittografica. Nel runtime legacy si conservano i lettori necessari di `sharedWith`, `sharedWithUids` e formati anteriori; il protocollo per-record/grant resta subordinato al [piano di integrazione](CONDIVISIONE.md#fonte-docs-m5-piano-integrazione-md-l1). Revocare non cancella copie già viste o esportate.

Le operazioni semplici possono essere dirette solo con Rules complete; operazioni coordinate, ACL, grant e dati comuni seguono la matrice backend della baseline. La regola ricorsiva proprietario attuale non equivale a validazione di ogni schema. Nessun cambiamento a Rules o Functions è implicito nel riallineamento degli MD.

<a id="fonte-frontend-guida-md-7-campi-credenziali-e-autofill"></a>

### 7. Campi credenziali e autofill

Le credenziali Firebase di accesso mantengono la semantica di login. Nei form Account, username e password effettivi mantengono gli attributi previsti dal flusso; il codice è un campo distinto, non una password universale.

Master Password, PIN, PUK e campi personalizzati cifrati non devono essere proposti come password di login. Per questi valori si usa il controllo testuale protetto previsto dal runtime, con comandi mostra/nascondi e copia dove autorizzati. Non convertire indiscriminatamente tutti i campi Account in testo e non reintrodurre trappole di login nascoste.

La protezione visiva non è cifratura. Gli attributi HTML non garantiscono il comportamento di ogni password manager: il gate comprende Safari/iPhone, Chrome ed Edge e distingue credenziali reali dagli altri segreti.

<a id="fonte-frontend-guida-md-8-csp-storage-notifiche-e-pwa"></a>

### 8. CSP, Storage, notifiche e PWA

La CSP applicata da Hosting è in `firebase.json`. Non copiare il vecchio meta tag con hash inline: il runtime usa script esterni e gate dedicati. Le modifiche a CSP, domini e worker richiedono controllo dei flussi interessati.

Gli allegati seguono la pipeline della baseline: validazione locale, nome casuale, cifratura con chiave-file, upload opaco e riferimento recuperabile. I percorsi e gli URL legacy richiedono inventario e migrazione separata; non sostituirli con nomi contestuali fissi o URL pubblici permanenti.

`sw.js` gestisce la shell; `firebase-messaging-sw.js` gestisce Push con scope distinto. La cache Firestore multi-tab è separata da Cache Storage. Non aggiungere allegati, OCR o modelli AI alla precache obbligatoria. La cache non è un backup.

Notifiche, email e log non contengono segreti. Il backend usa i servizi correnti di `functions/index.js`; lo scheduler della revisione applicativa indicata è alle 09:00 `Europe/Rome`. Il trasporto email usa credenziali dedicate: non è una garanzia di recapito o di invio illimitato. Non inserire credenziali o indirizzi amministrativi negli esempi della guida.

<a id="fonte-frontend-guida-md-9-backup-test-e-rilascio"></a>

### 9. Backup, test e rilascio

[M7](CANCELLAZIONE.md#fonte-docs-m7-cronologia-cestino-audit-md-l1), [M8](BACKUP.md#fonte-docs-m8-backup-recupero-md-l1) e la [procedura incidenti](../procedure/GESTIONE_INCIDENTI.md#fonte-docs-risposta-incidenti-e-recupero-md-l1) governano cestino, retention e recupero. Il backup applicativo è `.cpbackup` cifrato con Recovery Key distinta. Non generare un PDF contenente Master Password, Vault Key o codici MFA come procedura ordinaria di rilascio.

Il ripristino storico riuscito non certifica interruzioni fra blocchi e allegati. Le prove distruttive usano esclusivamente una copia di collaudo autorizzata. Il controllo del solo flag `_encrypted` non dimostra correttezza crittografica.

Scegliere test che esercitino il requisito modificato; distinguere test statici, helper, runtime, emulatori con Rules attuali, Rules candidate e dispositivi fisici. Il [piano di audit](../progetto/PROGRAMMA.md#fonte-docs-piano-audit-completo-progetto-md-l1) richiede il rapporto prima delle correzioni.

Il [gate M10](RILASCIO.md#fonte-docs-m10-hardening-rilascio-md-l1) resta il riferimento per il rilascio. Il workflow della revisione indicata valida PR/push e distribuisce solo Hosting su avvio manuale. Rules, Functions e dati richiedono autorizzazione e distribuzione separate.

Aggiornare i contratti interessati nello stesso lavoro; rigenerare gli inventari con gli script previsti. Conservare commit, test, rollback e limiti nel registro. Il riallineamento documentale non chiude automaticamente i gate del progetto.


<a id="fonte-docs-canonical-page-registry-md-l1"></a>

## Fonte: CANONICAL_PAGE_REGISTRY.md — righe originali 1–54

> Provenienza: `docs/CANONICAL_PAGE_REGISTRY.md` a `2900ccc0`.

<a id="fonte-docs-canonical-page-registry-md-registro-delle-pagine-canoniche"></a>

## Registro delle pagine canoniche

> **Stato:** attivo, 30 pagine canoniche.
> **Autorità:** contratto specialistico; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** pagine e compatibilità.
> **Dipendenze:** [Guida progetto](../LEGGIMI.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

Contratto M3 per distinguere le funzioni reali dai percorsi storici di compatibilità.

<a id="fonte-docs-canonical-page-registry-md-regola"></a>

### Regola

- Ogni funzione visibile possiede una sola pagina HTML e un solo modulo inizializzatore canonici.
- Nuove pagine con suffissi di versione sono vietate. Le evoluzioni modificano la pagina canonica e sono protette da Git e test.
- Redirect storici e laboratori archiviati non appartengono al runtime; `prova.html` è la sola eccezione temporanea pubblicata qui documentata e resta esclusa dalle pagine canoniche.

<a id="fonte-docs-canonical-page-registry-md-compatibilità-home"></a>

### Compatibilità Home

Pagina canonica: `home_page.html` → `modules/home/home.js`.

Riferimenti storici archiviati in `archive/home-experiments/`:

- `home_confronto.html` e `home_nebbia.html`, con i relativi supporti;
- `home-v126.html`;
- `home-v127.html`;
- `home-v128.html`;
- `home-v129.html`.

Questi file non vengono pubblicati, memorizzati offline o inclusi negli audit delle pagine attive.

<a id="fonte-docs-canonical-page-registry-md-laboratorio-viewport-temporaneo"></a>

### Laboratorio viewport temporaneo

`prova.html` e `prova.css` costituiscono un banco di prova isolato, raggiungibile durante il collaudo su dispositivi reali. La pagina mostra soltanto fondale, viewport dinamico e una card neutra: non rappresenta una funzione dell'app e non appartiene alle 30 pagine canoniche.

Il laboratorio è escluso dagli audit che certificano la superficie applicativa. Quando il contratto del viewport sarà validato sulle pagine reali, dovrà essere archiviato o rimosso dalla pubblicazione senza creare alias o suffissi di versione.

<a id="fonte-docs-canonical-page-registry-md-domini-canonici"></a>

### Domini canonici

- ingresso tecnico: `index.html`;
- ricevitore pubblico contatto: `contatto_condiviso.html` → `assets/js/contact-card-receiver.js`;
- autenticazione: `login-v115.html`, `registrati.html`, `reset_password.html`, `imposta_nuova_password.html`;
- Home: `home_page.html`;
- Privato: `area_privata.html`, `account_privati.html`, `form_account_privato.html`, `dettaglio_account_privato.html`, `profilo_privato.html`;
- Azienda: `lista_aziende.html`, `dati_azienda.html`, `modifica_azienda.html`, `account_azienda.html`, `form_account_azienda.html`, `dettaglio_account_azienda.html`;
- Scadenze: `scadenze.html`, `aggiungi_scadenza.html`, `dettaglio_scadenza.html`, `regole_scadenze.html` e le tre configurazioni;
- Impostazioni: `impostazioni.html`, `gestione_destinatari.html`, `archivio_account.html`;
- informative: `privacy.html`, `termini.html`.

Il nome storico `login-v115.html` viene mantenuto finché i flussi di autenticazione e i collegamenti installati non sono migrati con redirect verificato; non autorizza la creazione di nuove varianti.

<a id="fonte-docs-canonical-page-registry-md-riscontro-integrazione--13092026"></a>

### Riscontro integrazione — 13/09/2026

Candidata 1.2.118, codice `4a431ec3`: modificati i due dettagli Account e i relativi editor già censiti; nessuna pagina alternativa introdotta. Registro e budget restano sulle 30 pagine applicative canoniche. [Audit §51](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-51-integrazione-account-ui-e-vault--candidata-13092026).

<a id="fonte-docs-page-shell-contract-md-l1"></a>

## Fonte: PAGE_SHELL_CONTRACT.md — righe originali 1–106

> Provenienza: `docs/PAGE_SHELL_CONTRACT.md` a `2900ccc0`.

<a id="fonte-docs-page-shell-contract-md-contratto-strutturale-delle-pagine-e-del-viewport"></a>

## Contratto strutturale delle pagine e del viewport

> **Stato:** attivo; collaudo fisico richiesto.
> **Autorità:** contratto UI specialistico; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** viewport e struttura delle pagine.
> **Dipendenze:** [Guida progetto](../LEGGIMI.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

<a id="fonte-docs-page-shell-contract-md-ricevitore-pubblico-del-contatto--eccezione-v12110"></a>

### Ricevitore pubblico del contatto — eccezione v1.2.110

`contatto_condiviso.html` è la trentesima pagina canonica, distinta dalle cinque pagine di accesso e dalle 24 interne. Usa `body.base-bg`, il proprio `main.shared-contact-card`, `contact-card-receiver.css` e un entry point dedicato; non applica header/footer o bootstrap privato. Mostra esclusivamente il contatto condiviso dal QR e prepara il download vCard. Il laboratorio `prova.html` resta escluso.

Questo documento definisce esclusivamente la struttura delle 30 pagine canoniche. Non modifica né disciplina ombre, vetro, colori delle card, animazioni, watermark, decorazioni, modali o altri componenti sovrapposti.

<a id="fonte-docs-page-shell-contract-md-perimetro-ufficiale"></a>

### Perimetro ufficiale

- **Famiglia accesso:** `index.html`, `login-v115.html`, `registrati.html`, `reset_password.html`, `imposta_nuova_password.html`.
- **Famiglia interna:** le 24 pagine canoniche operative elencate in `CANONICAL_PAGE_REGISTRY.md`.
- I confronti Home e i redirect storici sono conservati in `archive/home-experiments/` e non appartengono al runtime pubblico.
- `prova.html` è un laboratorio temporaneo pubblicato per il collaudo fisico del viewport. Non è una pagina canonica, non entra nel conteggio né nel gate statico delle 30 pagine e non può introdurre eccezioni nel contratto definitivo.

<a id="fonte-docs-page-shell-contract-md-strati-comuni"></a>

### Strati comuni

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

<a id="fonte-docs-page-shell-contract-md-famiglia-accesso"></a>

### Famiglia accesso

Le quattro pagine operative di autenticazione:

- applicano `protocol-forced-dark` prima del rendering;
- caricano `core.css`, `core_fonts.css`, `core_ui.css` e `accesso.css`;
- usano `body.base-bg` e `.base-container`;
- non caricano `core_fascie.css` e non possiedono header/footer fissi;
- centrano `.vault` quando entra nello schermo;
- consentono lo scorrimento verticale di emergenza quando tastiera, orientamento o altezza ridotta non permettono il centraggio.

La registrazione applica attualmente questa regola tramite `registrati.css`: sui dispositivi bassi il documento può scorrere e `.base-container` non deve bloccarlo con `overflow: hidden`. La correzione locale resta compatibile con il contratto e dovrà essere assorbita nella regola comune della famiglia soltanto dopo il collaudo delle cinque pagine di accesso.

`index.html` appartiene alla stessa famiglia come ingresso minimo: mantiene tema dark, fondale comune e inoltra immediatamente alla pagina di accesso senza costruire la shell completa.

<a id="fonte-docs-page-shell-contract-md-famiglia-interna"></a>

### Famiglia interna

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

<a id="fonte-docs-page-shell-contract-md-eccezioni-ammesse"></a>

### Eccezioni ammesse

Le classi aggiuntive come `relative`, `archive-page-content` e le compensazioni locali già censite possono organizzare il contenuto interno, ma non possono ridefinire viewport, fondale, elemento scorrevole principale o ancoraggio delle fasce.

I componenti sovrapposti saranno regolati in un contratto successivo. Fino ad allora ogni modifica strutturale deve preservare il loro ordine attuale e non introdurre nuovi `z-index` globali.

<a id="fonte-docs-page-shell-contract-md-contratto-del-viewport"></a>

### Contratto del viewport

Il browser determina automaticamente larghezza e altezza disponibili. La soluzione deve usare le unità moderne della viewport e le safe area con fallback compatibili, senza leggere impostazioni del dispositivo e senza JavaScript di ridimensionamento salvo prova documentata che il CSS non sia sufficiente.

La correzione della fascia terminale iOS deve quindi:

- interessare la superficie radice e il fondale, non la nebbia;
- funzionare su schermi futuri più alti a parità di larghezza;
- non scalare card, pulsanti o spazi laterali;
- non aggiungere spazio scorrevole fittizio;
- non cambiare lo stacking globale;
- essere verificata sulle due famiglie, in tema chiaro e scuro, con Safari/PWA e desktop.

<a id="fonte-docs-page-shell-contract-md-gate"></a>

### Gate

`npm run test:page-shells` controlla classificazione e struttura statica delle 30 pagine. Il collaudo fisico descritto in `M4_VISUAL_ACCEPTANCE.md` resta obbligatorio per safe area, overscroll e ricomposizione grafica di iOS.

`prova.html` serve unicamente a separare il comportamento della superficie radice da header, footer, nebbia e contenuti reali. Un esito positivo nel laboratorio non chiude il gate: la stessa soluzione deve essere riportata nel contratto comune e verificata sulle due famiglie.

<a id="fonte-docs-ui-design-system-contract-md-l1"></a>

## Fonte: UI_DESIGN_SYSTEM_CONTRACT.md — righe originali 1–128

> Provenienza: `docs/UI_DESIGN_SYSTEM_CONTRACT.md` a `2900ccc0`.

<a id="fonte-docs-ui-design-system-contract-md-contratto-ui-e-design-system"></a>

## Contratto UI e design system

> **Stato:** fondazioni e componenti attivi; verifiche fisiche separate.
> **Autorità:** contratto UI specialistico; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** design system e composizioni.
> **Dipendenze:** [Guida progetto](../LEGGIMI.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

Questo documento definisce i vincoli tecnici della fase M4. Non sostituisce la revisione completa di lingue e organizzazione delle Impostazioni prevista dopo M10.

La struttura di viewport, fondale, contenitori, area scorrevole, fasce e spaziatori è regolata separatamente da `PAGE_SHELL_CONTRACT.md`. Ombre, vetro e decorazioni non fanno parte di quel contratto strutturale.

<a id="fonte-docs-ui-design-system-contract-md-principi"></a>

### Principi

Preparazione locale del 12/09/2026, base `321fec0b`: i componenti destinati al riuso senza ricaricamento devono rimuovere listener/timer e invalidare letture pendenti allo smontaggio. `SwipeList` e il renderer Account condiviso espongono `destroy()`; ogni nuovo render rilascia la vecchia istanza, anche con lista vuota. [Prove e limiti](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-12-componenti-reali-delle-liste--12092026). Non equivale alla migrazione completa degli orchestratori di pagina.

- Un componente condiviso nasce soltanto quando esistono almeno due utilizzi reali.
- HTML, stile, comportamento e accesso ai dati restano separati.
- Le pagine compongono componenti e servizi; non duplicano renderer o mutazioni di dominio.
- Ogni controllo interattivo deve essere raggiungibile da tastiera, avere nome accessibile e un target minimo di 44 px.
- Gli stati asincroni devono essere espliciti: caricamento, vuoto, errore e avviso non possono apparire come una pagina bloccata.
- Animazioni e transizioni rispettano `prefers-reduced-motion`.

<a id="fonte-docs-ui-design-system-contract-md-fondazioni-canoniche"></a>

### Fondazioni canoniche

- Token di spazio, raggio, livelli, movimento e target tattile: `assets/css/core.css`.
- Token tipografici: `assets/css/core_fonts.css`.
- Header e footer: `assets/css/core_fascie.css` e `components-v129.js`.
- Controlli, modali e stati condivisi: `assets/css/core_ui.css`.
- Campi dei form: `assets/css/moduli.css`; composizione comune dei form Account Privato/Azienda: `assets/css/account_form.css`; fondazioni comuni dei dettagli Account Privato/Azienda: `assets/css/account_detail.css`; primitive comuni di Dati azienda e Modifica azienda: `assets/css/azienda_shared.css`; linguette e composizioni dei profili privato/azienda: `assets/css/profile-layout.css`.
- Card e righe Account: `modules/shared/account-list-view.js`.
- Campi sensibili: `modules/shared/card-secret.js`.
- Stati di pagina: `modules/shared/ui-state-view.js`.

<a id="fonte-docs-ui-design-system-contract-md-famiglie-della-superficie-ui"></a>

### Famiglie della superficie UI

Le due famiglie principali definite dal contratto strutturale restano il livello esterno; il ricevitore pubblico `contatto_condiviso.html` è un’eccezione dedicata, documentata nel contratto shell:

- **Accesso**: `index.html` come ingresso tecnico e le quattro pagine di autenticazione;
- **Operativa**: le 24 pagine dotate di header, area centrale scorrevole e footer condivisi.

La famiglia operativa non implica che tutte le pagine abbiano la stessa composizione interna. Per evitare CSS monolitici e duplicazioni locali, le pagine operative adottano sei modelli di composizione, determinati dall'interazione principale e non dalla sola somiglianza grafica:

1. **Hub e navigazione**: Home e Area privata. Presentano destinazioni, riepiloghi e contatori attraverso grandi card di accesso.
2. **Elenchi e collezioni**: Account privati, Account azienda, Lista aziende, Scadenze e Archivio account. Ripetono righe o card, ricerca, filtri, ordinamento e azioni sugli elementi.
3. **Dettagli e consultazione**: Dettaglio account privato, Dettaglio account azienda, Dettaglio scadenza, Dati azienda e Profilo privato. Organizzano un singolo soggetto o record in hero, sezioni, campi consultabili e azioni contestuali.
4. **Form e modifica**: Form account privato, Form account azienda, Modifica azienda e Aggiungi scadenza. Condividono campi, griglie, validazione, allegati e azioni di salvataggio.
5. **Impostazioni e configurazione**: Impostazioni, Regole scadenze, Gestione destinatari e le tre configurazioni. Usano card amministrative, controlli, preferenze e accessi alle gestioni specialistiche.
6. **Informative**: Privacy e Termini. Condividono una composizione documentale di lettura, distinta dai controlli di configurazione.

Una pagina può usare componenti appartenenti a più modelli, ma deve avere un solo modello primario. Il modello non modifica il contratto del viewport e non autorizza una seconda implementazione di header, footer o area scorrevole.

<a id="fonte-docs-ui-design-system-contract-md-responsabilità-delle-pagine-rappresentative"></a>

#### Responsabilità delle pagine rappresentative

- **Area privata** è un hub di navigazione: distingue Account standard, Condivisi, Note private e Note condivise e mostra gli elementi più utilizzati.
- **Profilo privato** è uno spazio dati operativo: gestisce identità, contatti, indirizzi, documenti, QR e tessera digitale tramite tab e sezioni modificabili.
- **Impostazioni** è un centro di controllo: raccoglie preferenze, servizi e accessi alle configurazioni.

Le tre pagine condividono il linguaggio visivo rappresentativo, non lo stesso modello funzionale: Area privata è un hub, Profilo privato è un dettaglio operativo e Impostazioni è il centro della famiglia configurazione. La qualità "rappresentativa" è quindi una variante visiva trasversale. Hero, card, badge, tab e sezioni devono essere componenti riusabili; i contenuti e il comportamento restano dei rispettivi moduli.

<a id="fonte-docs-ui-design-system-contract-md-livelli-di-proprietà-dello-stile"></a>

### Livelli di proprietà dello stile

Ogni regola deve appartenere al livello più ristretto che ne descrive correttamente la responsabilità:

1. **Fondazioni**: temi, token, viewport, spazi, tipografia e livelli semantici nel core.
2. **Componenti**: card, campi glass, badge, tab, pulsanti, allegati e stati riutilizzati da almeno due pagine.
3. **Modelli di pagina**: composizione interna comune a hub, elenchi, dettagli, form, configurazioni o informative.
4. **Pagina**: solo identità o comportamento realmente esclusivo.

Non si crea un unico foglio globale per assorbire ogni differenza. Una classe locale viene promossa soltanto quando due utilizzi reali hanno stesso significato, stessa struttura e stessi stati. L'uguaglianza puramente estetica non è sufficiente.

<a id="fonte-docs-ui-design-system-contract-md-contratto-degli-effetti-visivi"></a>

### Contratto degli effetti visivi

- Fondale, colori di tema e glow ambientale appartengono a `core.css`.
- Nebbia, vetro delle fasce e dissolvenza del contenuto appartengono a `core_fascie.css`.
- Profondità, bordi e ombre dei componenti devono usare token condivisi; una pagina non ridefinisce una variante già esistente cambiandone soltanto il nome.
- Watermark e decorazioni fisse non partecipano al layout, non intercettano input e non cambiano le dimensioni del documento.
- Animazioni decorative non possono essere necessarie per comprendere uno stato e devono avere una variante senza movimento.
- Il tema scuro non è una semplice inversione: ogni livello glass deve conservare contrasto, separazione e leggibilità equivalenti al tema chiaro.

<a id="fonte-docs-ui-design-system-contract-md-debito-censito-e-ordine-di-consolidamento"></a>

### Debito censito e ordine di consolidamento

La ricognizione M4 ha rilevato una forte sovrapposizione tra i CSS dei form, dei dettagli Account e delle pagine Azienda, mentre Area privata, Profilo privato e Impostazioni condividono soprattutto una variante visiva rappresentativa e non il modello funzionale. Sono inoltre presenti watermark ripetuti, effetti locali e valori di livello non ancora espressi tramite una scala semantica.

Il consolidamento procede senza variazioni grafiche intenzionali in questo ordine:

1. form Account privato e azienda, già basati su `account_form.css`;
2. dettagli Account privato e azienda;
3. Dati azienda e Modifica azienda;
4. componenti rappresentativi realmente comuni tra Area privata, Profilo privato e Impostazioni;
5. watermark, decorazioni e scala semantica dei livelli;
6. rimozione delle regole locali soltanto dopo equivalenza visiva e funzionale verificata.

La presenza duplicata di `base-glow` nelle due pagine di dettaglio Account è registrata come anomalia da verificare durante il punto 2; non deve essere rimossa senza confronto visivo.

Il consolidamento statico dei dettagli Account è completato in `account_detail.css`: fondazioni, allegati, viste bancarie, richiamo informativo, selettore sorgente e utilità equivalenti sono condivisi. Nei due fogli locali non restano regole esattamente identiche; ogni ulteriore convergenza richiede quindi una scelta visiva esplicita e relativo collaudo, non una semplice deduplicazione meccanica.

La verifica dei tre fogli rappresentativi `area_privata.css`, `profilo_privato.css` e `impostazioni.css` non ha trovato regole di componente identiche da estrarre: le sole corrispondenze testuali complete erano percentuali interne a keyframe. Le tre pagine conservano quindi fogli distinti e condividono esclusivamente le fondazioni del core.

Il watermark canonico è definito in `core.css`: posizione, non-interattività, opacità e dimensione predefinite sono comuni. I fogli locali conservano soltanto le differenze intenzionali già esistenti, come opacità `0.08`, contenitore esteso, variazione dell'icona o dimensione da `500px`.

I watermark non sono un disegno unico: il contratto conserva il simbolo semantico di ogni pagina. Le famiglie complete sono configurazione (`directions_car`, `description`, `settings_applications`, `contact_mail`, `settings`, `rule`), informazione (`shield`, `gavel`) e liste (`key`, `business_center`, `archive`, `apartment`, `event`). Il gate `test:page-shells` verifica presenza, simbolo e `aria-hidden` nelle tredici pagine previste. Hub, form e dettagli non ricevono automaticamente una decorazione: card, avatar e sezioni costituiscono già il loro elemento visivo principale.

La scala globale dei livelli è dichiarata in `core.css` con token semantici, dal fondale arretrato fino agli avvisi critici. Core, fasce, moduli, menu e datepicker usano tali token senza alterare i valori numerici storici. Gli `z-index` locali restano invariati finché il relativo stacking context non viene verificato insieme al componente che lo possiede.

<a id="fonte-docs-ui-design-system-contract-md-contratto-degli-stati-di-pagina"></a>

### Contratto degli stati di pagina

`createUiState()` è la sola implementazione dinamica per i nuovi stati di caricamento, vuoto, avviso ed errore. Usa:

- `role="status"` e `aria-live="polite"` per caricamento e stato vuoto;
- `role="alert"` e `aria-live="assertive"` per errori e avvisi;
- `aria-busy="true"` soltanto durante il caricamento;
- pulsanti reali con target tattile minimo per le azioni di recupero.

Le pagine già esistenti vengono migrate quando sono toccate da una fase attiva; non si introduce un cambio grafico globale non verificato.

<a id="fonte-docs-ui-design-system-contract-md-budget"></a>

### Budget

- Nessun testo nuovo sotto 12 px.
- Le dimensioni tipografiche nuove usano i token di `core_fonts.css`.
- Le icone nuove riusano Material Symbols già incluso; nessuna nuova famiglia o libreria.
- Nessun nuovo stile inline, dialogo nativo o runtime CSS.
- Ogni variazione deve superare `test:ui-foundations`, `test:html-purity`, `test:css` e il budget statico delle pagine.

<a id="fonte-docs-ui-design-system-contract-md-verifica-visiva"></a>

### Verifica visiva

I gate automatici coprono struttura, accessibilità statica, dipendenze e budget. Scroll, overscroll, safe area e stabilità delle fasce richiedono anche prova fisica su iPhone e Windows prima di dichiarare M4 conclusa.
