# Registro indicativo delle decisioni — indice NON normativo

> **Natura del documento.** Indice **breve, datato e NON normativo**: elenca decisioni, rinvii e stati
> **già dimostrabili nelle fonti esistenti**, con il collegamento alla fonte originale. **Non sostituisce
> le fonti**: in caso di divergenza valgono i documenti originali, e la baseline di sicurezza e i
> contratti specialistici restano **normativi**. Questo file non crea, non estende e non reinterpreta
> alcuna decisione.
>
> **Base:** ramo `integration/vault-shell-v127-security`, commit `9be970201a26f1e1df1efa425b8ff74c18ca56ec`
> (`9be97020`, D02), working tree pulito, **23/09/2026**.
>
> **Perimetro:** solo documentazione versionata. Nessun accesso a console, ambienti distribuiti, PWA o
> dati reali; nessuna modifica a codice, test, versione, Rules/Functions.

## Come leggere le voci

**Stati:** **DECISA** = scelta registrata con autorità e perimetro; **PARZIALE** = parte decisa e parte
ancora aperta, dichiarate separatamente; **RINVIATA** = rinvio esplicito registrato; **APERTA** = nessuna
decisione rintracciata (o solo una proposta/preferenza, che **non** è una decisione).

**Campi obbligatori di ogni voce:** ID · titolo · stato · perimetro e residuo aperto · tipo · autorità,
data e fonte originale · *sostituisce/integra* · effetti consentiti · effetti **non** autorizzati.

**Tipi:** decisione tecnica · decisione di prodotto · approvazione consegna · chiusura gate ·
autorizzazione deploy.

## Regole di autorità

1. Il registro **indicizza** le fonti originali e **non le sostituisce**.
2. Baseline e contratti specialistici restano **normativi**.
3. Una **decisione tecnica** non equivale a **approvazione della consegna**.
4. **Approvazione della consegna**, **chiusura di un gate** e **autorizzazione al deploy** sono eventi **distinti**.
5. Una **proposta**, un'**analisi** o una **prova** non diventano decisioni.
6. **Non** si reinterpretano retroattivamente cronologie o stati discordanti: le contraddizioni si indicano, non si risolvono per presunzione.

## 1. M6 — adozione, messaggi, copie PWA

### M6-F1 — Upgrade additivo della coda allo schema v2 (opzione A)

- **Stato:** DECISA
- **Perimetro e residuo:** si adotta l'**opzione A** (upgrade additivo controllato della coda IndexedDB esistente allo schema v2 con store `queueLeases`). Il perimetro riguarda la **coda delle scritture offline già abilitate**; la consultazione offline resta un gate distinto. **Residuo aperto:** prova mista vecchia/nuova, compatibilità delle copie PWA, rollback v2-compatibile, collaudi fisici.
- **Tipo:** decisione tecnica (con ricadute di prodotto)
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:7679`, «Decisione Diego — M6-F1 = A»)
- **Sostituisce/integra:** integra il piano `M6-ADOZIONE-PIANO R1` (opzione A); **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** preparazione e verifica **nel solo ramo** `integration/vault-shell-v127-security`.
- **Effetti NON autorizzati:** upgrade delle copie PWA installate; modifica di dati reali; deploy; chiusura dei gate M6.

### M6-F2 — Testo generico riferito al tipo di operazione (errori di salvataggio senza Web Locks)

- **Stato:** DECISA
- **Perimetro e residuo:** per gli errori del salvataggio offline in browser senza Web Locks si usa un testo **generico ma riferito al tipo di operazione** che l'utente stava compiendo (es. creazione/modifica di Account privato o modifica di memorandum), **senza** nomi, valori o segreti del record; il testo deve indicare che **quella operazione non ha un salvataggio confermato** e invitare a riprovare; **non** deve affermare che la modifica sia conservata, persa o sincronizzata finché lo stato non è verificato. La formulazione per ciascun tipo di operazione va preparata **quando** si arriverà all'incarico UI. **Residuo aperto:** la formulazione concreta per i tipi di operazione abilitati non è ancora prodotta.
- **Tipo:** decisione di prodotto (testo all'utente)
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:7685`, «Decisione Diego — M6-F2»)
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**; distinta dall'avviso alla vecchia PWA (M6-F3).
- **Effetti consentiti:** vincola la futura formulazione dei messaggi nel perimetro dichiarato.
- **Effetti NON autorizzati:** ampliare i domini offline; promettere conservazione non verificata; modificare l'incarico tecnico attivo (allora M6-A-1, limitato al lettore).

### M6-F3 — Vecchia PWA: avviso «Aggiorna l'app»

- **Stato:** PARZIALE
- **Perimetro (parte decisa):** per «vecchia PWA» si intende la versione **già installata o ancora aperta** prima dell'aggiornamento della coda; l'utente deve ricevere un avviso **esplicito e operativo** che chieda di **aggiornare** alla nuova versione (non un semplice «la versione è cambiata»), formulato secondo il **meccanismo effettivo di aggiornamento** disponibile (es. aggiornare/riaprire l'app dal browser), **senza** presupporre un download dallo store. Nella stessa fonte è registrato che, **in caso di versione non compatibile**, le **scritture vanno fermate in sicurezza** e i **dati pendenti conservati**.
- **Residuo aperto:** prova della **convivenza delle copie già aperte**; **conservazione della coda** in caso di upgrade bloccato o dispositivo offline; **rollback v2-compatibile**; collaudo delle **PWA installate**; **sequenza di rilascio**; **criterio di blocco** (solo *proposto*, non deciso); **tempi**; **compatibilità reale**; **testo definitivo**.
- **Tipo:** decisione di prodotto (comunicazione all'utente) — non è un'autorizzazione al rilascio
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:8118`, «Decisione Diego M6-F3 — messaggio alla PWA precedente»). Il chiarimento su matrice e prove è in `:7687` ed è **esplicitamente** «non ancora decisione di rilascio»: **un chiarimento non è una decisione**.
- **Sostituisce/integra:** integra M6-F1 e M6-F2; **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** definisce la comunicazione all'utente e il requisito di fermare in sicurezza le scritture con dati pendenti conservati.
- **Effetti NON autorizzati:** distribuire lo schema v2; cancellare operazioni offline pendenti; chiudere M6-F3; considerare approvati tempi, criterio di blocco, compatibilità reale o testo definitivo.

### M6-A-8e — Approvazione della consegna (esterna al repository)

- **Stato:** approvazione registrata **come evento esterno**, limitata al commit indicato
- **Perimetro e residuo:** approvazione della **sola consegna M6-A-8e** (casi 6, 6-bis, 6-ter come **evidenza di laboratorio**) sul commit **`3b7b96a6`**. Nel repository la voce resta `DA_VERIFICARE`. **Residuo aperto:** M6 e i gate fisici, PWA e produttivi restano aperti; **M6-F3** resta aperto.
- **Tipo:** approvazione consegna (distinta da chiusura gate e da autorizzazione deploy)
- **Autorità, data, fonte:** **Sol — 23/09/2026 — chat Harness** (comunicazione esterna al repository). Prova nel repository: [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:8757`, rapporto `DA_VERIFICARE`); limiti dichiarati in [M6_SINCRONIZZAZIONE_OFFLINE.md](./M6_SINCRONIZZAZIONE_OFFLINE.md) (§M6-A-8e).
- **Sostituisce/integra:** **integra** il rapporto `DA_VERIFICARE` di M6-A-8e; **non sostituisce** le revisioni Codex precedenti né le fonti di M6.
- **Effetti consentiti:** considerare approvata **quella** consegna su **quel** commit, nei limiti in cui è dimostrata dalle prove del repository.
- **Effetti NON autorizzati:** chiusura di M6 o di M6-1/M6-2/M6-3/M6-F3; chiusura dei gate fisici, PWA o produttivi; deploy, push, merge o rilascio; estensione dell'approvazione ad altri commit.

### M6-A-8b · M6-A-8c · M6-A-8c R1 · M6-A-8d — Approvazioni **non rintracciate**

- **Stato:** APERTA (nessuna approvazione rintracciata nel repository)
- **Perimetro e residuo:** i commit `583c3d7c` (8b), `a200a334` (8c), `d0a1d71c` (8c R1), `6ab70723` (8d) risultano nel repository **solo** con rapporti `DA_VERIFICARE` ([DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) `:8749`, `:8751`, `:8753`, `:8755`). **Nessuna approvazione è presunta** in questa sede.
- **Tipo:** approvazione consegna (non rintracciata)
- **Autorità, data, fonte:** nessuna autorità rintracciabile nel repository per una approvazione; date dei rapporti: 22–23/09/2026.
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** trattare le consegne come **in attesa di revisione rintracciabile**.
- **Effetti NON autorizzati:** dichiarare approvate, chiuse o distribuibili queste consegne; dedurre approvazioni da lavori successivi.

## 2. M7 — retention e audit (solo decisioni del 21/09/2026)

### M7-D1-a — Account archiviati: conservazione senza scadenza automatica

- **Stato:** DECISA
- **Perimetro e residuo:** gli **Account archiviati** sono conservati **senza scadenza automatica**, finché l'utente non sceglie di eliminarli; la **cancellazione definitiva manuale** resta disponibile con **conferma esplicita**. **Residuo aperto:** le altre famiglie e le scelte M7 non coperte da questa voce restano come indicato in M7-D3 e nelle contraddizioni sotto.
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **21/09/2026** — [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:1212`, «gli Account archiviati sono conservati senza scadenza automatica…»); opzione **D1-a** in [M7_RETENTION_CENSIMENTO.md](./M7_RETENTION_CENSIMENTO.md) (`:501`).
- **Sostituisce/integra:** risponde a **D1** del censimento; **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** definire il comportamento di prodotto per gli Account archiviati.
- **Effetti NON autorizzati:** cancellare dati reali; eseguire deploy; cambiare altre politiche M7; dedurre approvazioni ulteriori.

### M7-D2 (Account) — Comportamento ordinario confermato

- **Stato:** DECISA (limitatamente agli Account)
- **Perimetro e residuo:** la decisione **conferma il comportamento ordinario di D2 per gli Account**, **senza** introdurre eccezioni, obblighi legali o una nuova durata. **Residuo aperto:** D2 per le altre famiglie di dati resta fuori da questa conferma.
- **Tipo:** decisione di prodotto
- **Autorità, data, fonte:** Diego — **21/09/2026** — [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:1212`).
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** assumere il comportamento ordinario per gli Account.
- **Effetti NON autorizzati:** estendere la conferma ad altre famiglie; chiudere D2 in blocco.

### M7-D3 — Registro tecnico `auditEvents` a 24 mesi (solo ramo, non distribuito)

- **Stato:** DECISA con parti residue
- **Perimetro e residuo:** gli eventi tecnici di `users/{uid}/auditEvents` sono conservati **24 mesi** dal timestamp autorevole e poi cancellati da un processo **controllato dal backend**; il client non può creare, modificare o cancellare singoli eventi. La finestra è **24 mesi di calendario**. L'attuazione è **solo nel ramo e non distribuita**. **Residuo aperto:** permanenza delle **altre famiglie** (ricevute di idempotenza, backup, log di piattaforma, Account archiviati restano **fuori** dalla finestra e senza scadenza automatica); **rimozione della scrittura client**; bonifica dei record storici senza `at`; vista utente del registro; rilascio del job (cadenza, ambiente, monitoraggio, rollback); distribuzione delle Rules del ramo.
- **Tipo:** decisione di prodotto (durata) + decisione tecnica (attuazione nel ramo)
- **Autorità, data, fonte:** Diego — **21/09/2026** — [M7_CRONOLOGIA_CESTINO_AUDIT.md](./M7_CRONOLOGIA_CESTINO_AUDIT.md) (`:116`, `:125`, `:190`); registrazione in [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:1230`–`:1232`, «Correzione decisione Diego — M7-R3 audit: 24 mesi»).
- **Sostituisce/integra:** **sostituisce** la precedente indicazione di **12 mesi** per il solo registro ([DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) `:1253`: «la precedente indicazione di 12 mesi è superata»; [M7_CRONOLOGIA_CESTINO_AUDIT.md](./M7_CRONOLOGIA_CESTINO_AUDIT.md) `:116`); integra D3 del censimento.
- **Effetti consentiti:** considerare decisa la durata di 24 mesi per il solo registro e ammettere, nel ramo, il job di retention non distribuito.
- **Effetti NON autorizzati:** estendere i 24 mesi ad altre famiglie; attivare o distribuire il job; cancellare dati reali; deploy.

### M7-D8 — Obblighi legali di conservazione: rinvio

- **Stato:** RINVIATA
- **Perimetro e residuo:** il rinvio è **dichiarato** trattando gli obblighi legali come **dipendenza**, **senza** deroghe inventate. **Residuo aperto:** la verifica degli eventuali obblighi specifici resta da fare (dipendenza esterna).
- **Tipo:** decisione di prodotto (rinvio)
- **Autorità, data, fonte:** registro di coordinamento / censimento — 21/09/2026 — [CENSIMENTO_GATE_M6_M10.md](./CENSIMENTO_GATE_M6_M10.md) (`:24`, «rinvio dichiarato di D8»); [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:1285`).
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** mantenere aperta la verifica senza assumere deroghe.
- **Effetti NON autorizzati:** dedurre una durata o una deroga; chiudere D8.

### Contraddizioni sulle voci M7 (indicate, **non** risolte)

- [CENSIMENTO_GATE_M6_M10.md](./CENSIMENTO_GATE_M6_M10.md) (`:24`) elenca ancora fra le decisioni **da approvare** «D1, D2, D4, D5, D6, D7, D9, D10–D16», mentre il registro del **21/09/2026** documenta D1-a e il comportamento ordinario D2 per gli Account.
- [M10_REVISIONE_PRIVACY_PRELIMINARE.md](./M10_REVISIONE_PRIVACY_PRELIMINARE.md) (§8.1, 22/09/2026) elenca fra le **ancora aperte** «D1, D2, D4, D5, D6, D7, D9, D10–D16».
- [M7_RETENTION_CENSIMENTO.md](./M7_RETENTION_CENSIMENTO.md) (`:208`, §8) tiene **D1/D5** aperti per cestino e ricevute.
- Queste divergenze sono **di datazione e di formulazione**: la loro riconciliazione è un passo separato e **non** è compito di questo registro.

## 3. M8 — backup e recupero

### M8 — Ripristino interrotto: sospensione richiesta dal proprietario

- **Stato:** APERTA (nessuna decisione registrata; **rinvio operativo** richiesto)
- **Perimetro e residuo:** sulla domanda M8-Q2 il proprietario ha espresso una **preferenza preliminare** (annullare l'intera procedura se il record non viene salvato e rimuovere l'allegato senza riferimento) e ha chiesto di **sospendere M8** perché la sequenza dei casi Q1/Q2 non era chiara. La fonte dichiara **esplicitamente** che la preferenza **non** va registrata come decisione M8 e che **non** va assegnato lavoro di ripristino. **Residuo aperto:** tutte le scelte M8 restano aperte.
- **Tipo:** decisione di prodotto (non assunta) — sospensione operativa
- **Autorità, data, fonte:** Diego — 22/09/2026 — [DEEPSEEK_COORDINATION.md](./DEEPSEEK_COORDINATION.md) (`:7890`, «M7-D3 e M8 — chiarimento, non nuove decisioni»)
- **Sostituisce/integra:** **nessuna fonte sostituita rintracciata**.
- **Effetti consentiti:** considerare M8 **sospeso in attesa di chiarimento**; le domande restano nei documenti M8.
- **Effetti NON autorizzati:** trattare la preferenza su Q2 come decisione; avviare lavoro di ripristino; chiudere le voci M8.

## 4. Fuori dal primo contenuto di questo registro

Le voci seguenti **esistono nelle fonti** ma **non sono indicizzate** in questa prima versione, perché
fuori dal primo contenuto richiesto: **M6-C1** e **M6-C2** (22/09/2026, avviso «dati non disponibili» e
ripreparazione automatica), **M7-D1**, **M7-D2**, **M7-D4** e l'orientamento **D14** (22/09/2026),
le altre decisioni M7 del registro e le voci M8 ulteriori, le voci M9/M10. Vanno indicizzate in una
revisione successiva, su incarico, **senza** dedurne il contenuto da questo file.

## 5. Limiti di questo registro

- È un **indice**, non una fonte: ogni voce va letta nella fonte originale collegata.
- **Nessuna decisione è inventata** e **nessun residuo aperto è chiuso** implicitamente: dove la fonte non basta, lo stato è **APERTA**.
- Le date riportate sono quelle delle fonti; questo registro **non** rende attuali decisioni o prove storiche.
- **Produzione e ambiente distribuito non sono verificati** da questo file: per lo stato corrente si veda [STATO_CORRENTE_M0_M10.md](./STATO_CORRENTE_M0_M10.md), anch'esso **non normativo**.
- **Perimetro di D02:** unico file creato questo registro. Nessuna modifica ad altri file, codice, test, versione, Rules/Functions, dati reali, PWA o produzione; nessun push, merge o deploy.
