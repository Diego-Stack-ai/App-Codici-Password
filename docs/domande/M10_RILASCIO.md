# M10 rilascio

> Stato definitivo 10/10/2026: il ciclo tecnico M10 è chiuso sulla versione pubblicata `1.2.150` con recupero MFA assistito e candidati non certificati hard-off. Non esiste una domanda tecnica corrente. Audit indipendente, privacy/legale e matrice fisica non sono stati eseguiti: sono requisiti di un eventuale nuovo ciclo di certificazione e non vengono dichiarati superati. I quesiti successivi sono conservati come storia decisionale e non vanno riproposti automaticamente.

> Chiusura operativa 09/10/2026: il rilascio tecnico `1.2.144` è completato. Audit indipendente, privacy/legale e matrice fisica restano gate esterni non eseguiti e trasferiti a un futuro ciclo di certificazione; le domande sono conservate come evidenza, non come incarico corrente.

**28/09/2026 — successione del quesito MFA:** risposta esplicita «Autorizzo soltanto progettazione e prove locali» ricevuta e registrata in DECISIONI; non riproporre il consenso come pendente. La prova locale successiva ha dimostrato ricreazione di un account eliminato durante lo scambio custom-token. Percorso non accettato, nessuna attivazione: dettagli e fonte in COLLAUDI. Resta un problema tecnico da risolvere, non richiesta di accettarne il rischio.

**27/09/2026 — nuovo meccanismo tecnico MFA, quesito distinto:** il recupero con codice d'emergenza è obbligatorio. Resta separata l'autorizzazione alla creazione di una sessione Firebase temporanea interna al server, dopo verifica password e codice, per rimuovere un singolo fattore via REST. Alla prima domanda Diego ha chiesto una spiegazione, non dato consenso esplicito. Riproposta in chat la sola autorizzazione a sviluppo e prove locali, senza attivazione: risposta ancora da registrare. La soluzione va comunque verificata contro ricreazione di account eliminati, cambio identità e fattori concorrenti; l'autorizzazione non chiuderebbe tali rischi. Gli altri lavori proseguono.

**27/09/2026 — concorrenza recupero MFA, risposta ricevuta:** Diego sceglie l'alternativa 1: preservare i fattori aggiunti dopo l'avvio e non considerare il recupero pronto al rilascio finché la protezione non è verificata. La scelta non è più pendente; restano progettazione, implementazione e prove, separate dalla ripresa di 15 minuti già approvata. Autorità in DECISIONI; non chiedere nuovamente la stessa conferma.

**Aggiornamento 27/09/2026:** Diego ha approvato le proposte consolidate 4 e 5: registro minimo invii push/email per 30 giorni e ripresa della medesima operazione MFA per 15 minuti con nuova verifica password. Autorità e limiti in DECISIONI. I due quesiti tecnici sotto non vanno riproposti come privi di risposta; restano implementazione, verifica e decisioni organizzative non coperte. Nessun gate di rilascio chiuso automaticamente.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

Decisioni del proprietario, informazioni organizzative, audit indipendente e verifiche esterne restano da completare nei perimetri sotto. La bozza utente non è pubblicabile per effetto del riordino. Non inferire risposte dai placeholder.

## Indice delle fonti conservate

### RICONCILIAZIONE-10 — ripresa recupero MFA, 27/09/2026

Nuovo quesito di sicurezza, non coperto dal consenso sui ritentativi delle notifiche: una prova sintetica sull'handler conferma che il codice viene consumato prima di updateUser; se Auth fallisce resta un recupero pendente e lo stesso codice non riparte. Raccomandazione da progettare: ripresa server vincolata alla medesima operazione e a nuova verifica del primo fattore, senza ripristinare indiscriminatamente il codice consumato e senza disabilitare MFA su identità diversa. Richiede decisione esplicita su durata e metadati dello stato pendente, scadenza e percorso assistito dopo esaurimento dei codici. Alternativa: mantenere consumo definitivo anche in caso di guasto, con rischio di esaurire i codici senza completare il recupero. Nessuna nuova durata, riutilizzabilità o modifica runtime applicata; la proposta non è ancora un protocollo approvato.

### PREPARAZIONE-09 — quesito nuovo anti-duplicati, 27/09/2026

Ritentativo degli esiti incerti già approvato: non chiederlo di nuovo. Resta da approvare un registro tecnico per prenotazione/idempotenza degli invii destinatari push/email e la durata. Proposta da valutare: identificativi opachi dell'evento/canale, stato e timestamp, senza email/token/contenuti; conservazione 30 giorni con pulizia verificata e rifiuto di eventi troppo vecchi. È proposta distinta da N1, non approvazione derivata da N1. Rischi da coprire nel contratto prima della patch: frequenza e giorno zero, snapshot obsoleti, lease scaduto, risposta tardiva, crash dopo accettazione provider, retry parziale e nessun invio oltre scadenza. Nessuna promessa exactly-once. La scelta della durata va conciliata con gli eventi ancora eleggibili, non applicata come cancellazione indiscriminata.

- [M10_DOMANDE_AUDIT_INDIPENDENTE.md](#fonte-docs-m10-domande-audit-indipendente-md-l1)
- [M10_DOMANDE_GUIDA_E_PRIVACY.md](#fonte-docs-m10-domande-guida-e-privacy-md-l1)

<a id="fonte-docs-m10-domande-audit-indipendente-md-l1"></a>

## Fonte: M10_DOMANDE_AUDIT_INDIPENDENTE.md — righe originali 1–44

> Provenienza: `docs/M10_DOMANDE_AUDIT_INDIPENDENTE.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m10-domande-audit-indipendente-md-m10--domande-per-diego-audit-indipendente-e-chiusura-di-m10-1"></a>

## M10 — Domande per Diego: audit indipendente e chiusura di M10-1

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 22/09/2026 dopo la revisione locale preparatoria
> (`docs/M10_REVISIONE_LOCALE.md`).
> **Commit del rapporto tecnico:** revisione locale e aggiornamento del censimento dei gate.
> Questo documento è in un **commit separato**: raccoglie **solo** le domande e non introduce politiche,
> correzioni o nuovo comportamento. **Non duplica** le domande già raccolte in
> `M6_DOMANDE_*`, `M7_DOMANDE_*`, `M8_DOMANDE_*`: riguarda la **commissione dell'audit** previsto da M10.

<a id="fonte-docs-m10-domande-audit-indipendente-md-che-cosa-è-stato-osservato"></a>

### Che cosa è stato osservato

La revisione **locale** di M10-1 è conclusa: 15 controlli automatici rieseguiti (comprese Rules 65/65 e
Storage 12/12 e `npm audit --omit=dev` a **0 vulnerabilità note**), matrice di autorizzazione dei 24
ingressi esportati letta dal codice, 11 aree esaminate, **nessuna vulnerabilità dimostrata**. Restano
quattro voci da assegnare — igiene dei log in `security-manager.js`/`vault-session.js` (9 chiamate che
registrano l'oggetto errore), bundle di terze parti `qrcode.min.js` con `innerHTML`, **PBKDF2 dei campi a
100 000 iterazioni attivo in scrittura** (`crypto-utils.js:11`, raggiunto da `encrypt` a `:212` e da
`decrypt` a `:275`, con ripiego sulla **Master Password** nel percorso legacy), P0 **già noto** della
chiave di wrapping in `sessionStorage` — e i gate esterni di M10. **Nessuna correzione** è stata
introdotta e **M10-1 resta aperto**.

<a id="fonte-docs-m10-domande-audit-indipendente-md-domande"></a>

### Domande

1. **Q1 — Commissione e ambito dell'audit indipendente.**
   Chi commissiona l'audit indipendente di crittografia e condivisione, e con quale ambito minimo?
   La proposta di questa revisione: (a) crittografia e gestione delle chiavi a partire dallo stato
   documentato (incluso il P0 della chiave di wrapping in `sessionStorage`); (b) isolamento fra
   proprietari e condivisione/revoca; (c) bundle di terze parti (`qrcode`) e superficie `innerHTML`;
   (d) **PBKDF2 dei campi a 100 000 iterazioni**, attivo in scrittura e con ripiego sulla Master Password
   nel percorso legacy: parametro, formato senza marcatore KDF e migrazione necessaria. Serve indicare
   anche **commit o versione** da certificare: l'audit su una candidata diversa dalla produzione ha
   valore diverso.

2. **Q2 — Criterio di chiusura di M10-1.**
   Il gate si chiude con il **rapporto dell'audit** più la revisione OWASP finale firmata, oppure
   richiede anche la **bonifica** delle voci trovate? E chi decide la priorità fra le voci di igiene
   (basso rischio) e i lavori già aperti su shell persistente e staging del ripristino?

<a id="fonte-docs-m10-domande-audit-indipendente-md-nota-di-perimetro"></a>

### Nota di perimetro

Nessuna di queste domande modifica il comportamento attuale: runtime, Functions, Rules, dipendenze e
dati sono **invariati**; nessun dato reale è stato letto; la revisione locale **non** sostituisce l'audit
indipendente e **non** certifica l'app. Le prove tecniche sono nel commit di revisione; questo documento
non le ripete.

<a id="fonte-docs-m10-domande-guida-e-privacy-md-l1"></a>

## Fonte: M10_DOMANDE_GUIDA_E_PRIVACY.md — righe originali 1–53

> Provenienza: `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md` a `2900ccc0`.  La formulazione originale è conservata; lo stato per voce nella raccolta e DECISIONI prevalgono sulla vecchia etichetta generale.

<a id="fonte-docs-m10-domande-guida-e-privacy-md-m10-4--domande-per-diego-guida-utente-privacy-e-informazioni-organizzative"></a>

## M10-4 — Domande per Diego: guida utente, privacy e informazioni organizzative

> **Stato alla raccolta originale:** domande **aperte**, raccolte da DeepSeek il 2026-09-22 insieme alla bozza
> (`docs/M10_GUIDA_UTENTE_BOZZA.md`, `docs/M10_REVISIONE_PRIVACY_PRELIMINARE.md`), in un **commit
> separato** come richiesto dal proprietario. Questo documento **non** prende decisioni, **non** inventa
> nomi, contatti, termini o impegni e **non** chiude M10-4.
> **Non duplica** le raccolte già esistenti: D1–D16 (`docs/M7_RETENTION_CENSIMENTO.md`), cache e copie
> (`M7_DOMANDE_T23_*`, `M7_DOMANDE_T24_*`), residui (`M7_DOMANDE_T26/T27/T08/T17/T21_*`), ripristino
> (`M8_DOMANDE_*`), fallback Web Locks e cache espulsa (`M6_DOMANDE_*`), audit (`M10_DOMANDE_AUDIT_INDIPENDENTE.md`).

<a id="fonte-docs-m10-domande-guida-e-privacy-md-1-guida-utente-bozza-pronta-servono-scelte"></a>

### 1. Guida utente (bozza pronta, servono scelte)

1. **Q1 — Chi approva la guida utente** (`docs/M10_GUIDA_UTENTE_BOZZA.md`) e con quale livello di
   dettaglio tecnico? Deve spiegare anche i **limiti noti** (P0 della chiave di wrapping in
   `sessionStorage`, PBKDF2 dei campi a 100 000, riferimenti orfani dopo un ripristino interrotto) o
   rimandarli a una nota tecnica separata?
2. **Q2 — Canale di assistenza e tempi di risposta** per un utente che perde la Recovery Key o non
   riesce a sbloccare il Vault: qual è il canale, e quali informazioni possono essere chieste **senza**
   ricevere segreti?
3. **Q6 — Informative pubblicate**: `privacy.html` e `termini.html` esistono nel repository ma il loro
   contenuto **non** è stato riesaminato in questa bozza. Chi li riesamina e con quale priorità?

<a id="fonte-docs-m10-domande-guida-e-privacy-md-2-privacy-e-profili-legali"></a>

### 2. Privacy e profili legali

4. **Q3 — Referente privacy/legale**: chi copre i profili legali (informativa, diritti degli
   interessati, obblighi di conservazione) e come si interfaccia con le decisioni **D8** (obblighi
   legali) e **D7** (livello di prova richiesto)? La revisione preliminare
   (`docs/M10_REVISIONE_PRIVACY_PRELIMINARE.md`) **non** è un parere legale.
5. **Q7 — Copie sul dispositivo**: al logout l'app cancella da sé **solo la sessione Vault in
   `sessionStorage`**; bozze, cache IndexedDB, coda offline, `localStorage` e shell PWA **restano**, e
   dopo il purge nessuna copia locale viene evacuata (D10, D11). L'utente deve poter cancellare anche
   quelle copie (comando dedicato), o basta dichiararlo nella guida finale?
6. **Q8 — Informativa e trasparenza sull'audit**: il registro tecnico è conservato **24 mesi** e la
   vista utente **non esiste**. Deve comparire nell'informativa (con quale formulazione) o resta una
   scelta tecnica documentata solo nei contratti?

<a id="fonte-docs-m10-domande-guida-e-privacy-md-3-informazioni-organizzative-segnaposto-da-compilare"></a>

### 3. Informazioni organizzative (segnaposto da compilare)

Tutte le voci seguenti sono **segnaposto**: nessun nome, contatto, scadenza o impegno è stato inventato.

7. **Q4 — Ruoli e canali di incidente**: chi è l'**incident commander**, chi il **referente Firebase**,
   qual è il **canale di emergenza** e come si accede in **break-glass**? La procedura
   (`docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`, «Informazioni organizzative da completare») li richiede
   prima di un go-live con più utenti e oggi sono **vuoti**.
8. **Q5 — Comunicazioni**: chi comunica un incidente agli utenti, con quale canale e con quale
   contenuto minimo (senza dati personali)? Serve anche la decisione su **cosa** dichiarare quando un
   ripristino è parziale o un allegato è senza byte.

<a id="fonte-docs-m10-domande-guida-e-privacy-md-4-che-cosa-questa-raccolta-non-fa"></a>

### 4. Che cosa questa raccolta non fa

Nessuna decisione viene presa qui; nessun testo definitivo viene approvato; nessun termine viene
assegnato. Le risposte alimenteranno la revisione finale di M10-4 e la guida pubblicabile, che resta
**aperta** insieme a M10-1 e agli altri gate elencati in `docs/CENSIMENTO_GATE_M6_M10.md`.
