# Cancellazione

27/09/2026 — mitigazione locale Azienda: anche le Rules negano ora la cancellazione del documento padre, inclusa azienda vuota, oltre alla guardia UI. Preservati i permessi precedenti sui discendenti. Il percorso server sicuro 3B non è ancora operativo; non è una nuova politica definitiva di conservazione. Emulatori e limiti in COLLAUDI; nessuna distribuzione.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Riconciliazione M7 vigente

Aggiornamento locale 09/10/2026: un modello isolato codifica la decisione M7-D1 senza eseguire effetti. Usa due anni di calendario dall'ultima archiviazione e richiede almeno dieci giorni dall'avviso interno persistito; un avviso tardivo rinvia il purge. Revisione/data della nuova archiviazione rendono inutilizzabile l'avviso del ciclo precedente. Identità, ambito aziendale o tempi inverificabili non producono mai eleggibilità. Prove history-recovery 25/25 e regressione Archivio 117/117; nessun raccordo a notifiche, scheduler o purge e nessun superamento di PURGE-CAS/D8.

Correzione locale 27/09/2026: prima di avviare i passi distruttivi, la transazione di preparazione verifica anche la pianificabilità dei riferimenti Profilo/Aziende e il budget conservativo. Dati già malformati o piano già eccessivo impediscono il purge senza cancellazioni. La transazione finale rilegge l'Account: se è stato ricreato, non scollega i riferimenti e non scrive esito purged. Queste guardie non sono un blocco comune: modifiche fra preparazione e cancellazione Storage/recursiveDelete rimangono fuori dalla garanzia; nessuna chiusura PURGE-CAS.

Aggiornamento vincolante 27/09/2026 (decisioni 1A/1B/2B/3A/3B/3C in DECISIONI): conservazione prevalente nei conflitti, due anni dall'ultima archiviazione, almeno dieci giorni dall'avviso interno persistito senza obbligo di lettura, mancato push non bloccante. Azienda con Account non eliminabile; copie/scadenze autonome preservate e origine ambigua segnalata. Pulizia server riprovabile dei file certamente non referenziati, upload temporanei riprendibili sette giorni escludendo operazioni attive. Backup ripristinabile esplicitamente senza riattivare condivisioni. Queste scelte precisano i residui sotto, ma non attestano implementazione né superamento di D8.

- La conservazione fino a cancellazione manuale descrive il comportamento precedente/attuale documentato. La politica richiesta il 22/09 prevede **due anni dall’archiviazione**, con avviso in-app **dieci giorni prima** e push se attivo/consentito. Non è implementazione o rilascio del purge automatico.
- D2 conserva la cancellazione immediata manuale con conferma; testo finale e prove restano da rivedere con D6/D8.
- D4/orientamento D14 richiede la cascata sui dati derivati controllati dall’app; non autorizza cancellazioni di record autonomi altrui o garantisce la rimozione di copie esterne/offline.
- Retention `auditEvents`: **24 mesi di calendario**; rimozione della scrittura client **decisa e implementata nel ramo**. Distribuzione di Rules/job e le altre dipendenze restano separate.
- Prima del purge automatico servono protocollo sicuro, idempotenza, prova non produttiva, notifiche non recapitate, D8 e semantica di ripristino/riarchiviazione.

Fonti e successioni sono in [DECISIONI](../progetto/DECISIONI.md). Nessuna chiusura M7 o autorizzazione a eseguire cancellazioni è introdotta dal riordino.

## Indice delle fonti conservate

- [M7_CRONOLOGIA_CESTINO_AUDIT.md](#fonte-docs-m7-cronologia-cestino-audit-md-l1)

<a id="fonte-docs-m7-cronologia-cestino-audit-md-l1"></a>

## Fonte: M7_CRONOLOGIA_CESTINO_AUDIT.md — righe originali 1–177

> Provenienza: `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md` a `2900ccc0`.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-m7--cronologia-cestino-e-audit"></a>

## M7 — Cronologia, cestino e audit

> **Stato:** funzioni implementate e collaudo storico registrato; retention complessiva non approvata.
> **Autorità:** contratto specialistico e registro prove; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** cronologia, cestino e purge.
> **Dipendenze:** [Guida progetto](../LEGGIMI.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-contratto"></a>

### Contratto

- la cancellazione ordinaria sposta il record in un cestino cifrato;
- la conservazione senza scadenza automatica descritta dal primo laboratorio non è approvata come politica di produzione;
- prima del go-live deve essere definita una retention esplicita, con cancellazione, backup e possibili obblighi legali;
- il cestino conserva ID, proprietario, revisione e data di archiviazione; il contenuto resta ciphertext;
- il ripristino fallisce se l'ID è occupato e crea una nuova revisione;
- il percorso di purge documentato prima della politica del 22/09 è backend-only e manuale, con conferma forte; la politica automatica richiesta resta subordinata alle decisioni e prove della riconciliazione sopra;
- revoca e ripristino non riattivano grant precedenti;
- la cronologia è limitata agli eventi necessari, non a snapshot illimitati;
- l'audit usa un'allowlist e non registra password, chiavi, token, ciphertext o testo libero.

Il laboratorio `experiments/history-recovery` dimostra una retention tecnica di prova, ripristino senza sovrascrittura, revisione, redazione dei segreti e limite della cronologia. Non modifica la produzione e non approva una conservazione indefinita.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-gate"></a>

### Gate

- [x] conservazione senza scadenza automatica e condizioni di purge manuale definite;
- [x] ripristino senza sovrascrittura silenziosa;
- [x] audit con allowlist e senza segreti;
- [x] cronologia limitata;
- [x] Archivio Account riutilizzato come UI cestino; i nuovi elementi ricevono data e revisione, senza scadenza automatica; anche gli eventuali record con il vecchio `purgeAfter` richiedono la cancellazione manuale;
- [x] Rules verificate e callable atomica/idempotente distribuita;
- [x] conferma forte della UI collegata alla callable backend `purgeArchivedAccount`, con controllo archivio/revisione, ripresa idempotente, rimozione degli allegati confinata allo UID e scollegamento delle email del Profilo;
- [x] archiviazione, ripristino, permanenza senza scadenza automatica e cancellazione definitiva manuale verificati fisicamente il 09/09/2026 con account di prova dopo la distribuzione del nuovo contratto.

Il 09/09/2026 è stato accettato il collaudo funzionale descritto sopra. Non costituisce approvazione della retention complessiva né certificazione rispetto alla baseline adottata l’11/09.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-decisione-di-retention-aperta"></a>

### Decisione di retention aperta

Per chiudere il requisito di retention della baseline occorre stabilire, senza annullare il collaudo storico delle funzioni già implementate:

- durata ordinaria del cestino;
- eliminazione immediata richiesta dall’utente e relative eccezioni legali;
- rapporto tra cestino, cronologia, allegati e backup;
- purge verificabile e idempotente;
- informazione mostrata all’utente;
- prova che il dato non resti raggiungibile nei percorsi applicativi.

La cifratura riduce l’esposizione ma non giustifica la conservazione illimitata.

**Censimento collegato (M7-R1, 21/09/2026):** [`M7_RETENTION_CENSIMENTO.md`](../evidenze/INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1) documenta il comportamento attuale di cestino, cronologia/audit, allegati e backup con citazioni verificabili, propone opzioni di politica e una matrice di test sintetici e raccoglie le domande decisionali. **Non decide** durate, eccezioni legali o cancellazioni definitive e non approva alcuna retention.


<a id="fonte-docs-m7-cronologia-cestino-audit-md-riesame-dopo-evoluzione-profili--13092026"></a>

### Riesame dopo evoluzione Profili — 13/09/2026

Base `141259d9`: la pulizia finale di `purgeArchivedAccount` considerava soltanto `contactEmails` privato e confrontava il solo ID. La stessa stringa ID in Account privato e aziendale non identifica lo stesso record: questa collisione può scollegare un contatto estraneo. Telefoni, documenti, utenze e riferimenti nelle aziende non erano inclusi. Il nuovo blocco candidato deve distinguere contesto/azienda e conservare dati del contatto, note e valori cifrati.

Restano distinti e aperti:

- `accountWidgets` e `sharedVaultLinks` sono collezioni sorelle del documento Account, quindi la cancellazione ricorsiva dell'Account non li include. La pulizia deve eliminare soltanto il collegamento dell'Account; il valore comune usato altrove va conservato.
- Ripristino da Archivio e preparazione del purge non condividono un protocollo transazionale che impedisca il ripristino fra verifica iniziale e cancellazione. Il solo aggiornamento della pulizia finale non chiude questa race.
- Ripristino e grant legacy richiedono una prova specifica di mancata riattivazione delle autorizzazioni precedenti.
- Storage, cancellazione ricorsiva e transazione finale sono passaggi distinti: l'atomicità globale e la ripresa completa non sono certificate.

L'audit finale attuale usa una allowlist di campi tecnici, senza segreti. Nessuna decisione di retention, operazione su dati reali o pubblicazione deriva da questo riesame.


<a id="fonte-docs-m7-cronologia-cestino-audit-md-pulizia-candidata-dei-collegamenti-dopo-purge--13092026"></a>

#### Pulizia candidata dei collegamenti dopo purge — 13/09/2026

Il pianificatore `planProfileReferenceCleanup` distingue `{context, companyId, accountId}` e aggiorna solo i campi che contengono un riferimento esatto. Copre i campi noti dei Profili privati e aziendali, mantenendo il resto del contatto. La transazione finale legge Profilo e tutte le aziende prima delle scritture; un retry rilegge i dati correnti. Il completamento avviene insieme alle patch e all'audit finale. Una precedente operazione `processing` senza Account riprende la pulizia; `purged` conserva il comportamento di retry esistente. Questo non certifica la provenienza storica delle ricevute `archiveOperations`, distinta dal nuovo registro M6.

Limiti: scansione completa delle aziende, crescita dei costi e della contesa; massimo conservativo di 450 documenti modificati più ricevuta/audit. Un piano troppo ampio o malformato interrompe la transazione finale, lasciando `processing` e nessuna pulizia parziale; l'Account può però essere già stato eliminato dal passaggio precedente. Non è un rollback né una soluzione alla race purge/ripristino. Nessuna migrazione di alias o intervento sui dati reali.

Compatibilità M6: il vecchio purge scriveva `linkedAccountId: null`. Il guard dei riferimenti accetta ora questo marker di collegamento assente, senza modificarlo. Un ID reale con `linkedAccountCompanyId: null` continua a essere trattato come collegamento privato e impedisce il writer ridotto. Il nuovo unlink usa stringhe vuote per entrambi i campi, come la UI corrente.


<a id="fonte-docs-m7-cronologia-cestino-audit-md-proprietario-e-sessione-dellarchivio--candidata-13092026"></a>

#### Proprietario e sessione dell'Archivio — candidata 13/09/2026

Il purge richiede `expectedOwnerUid`, confrontato con Auth prima della validazione del comando e di qualunque accesso a Firestore o Storage. Questo impedisce che un token scelto dall'SDK dopo il cambio utente esegua il comando nel Vault successivo. I client precedenti senza proprietario atteso sono rifiutati: il rilascio richiede aggiornamento coordinato e rollback che mantenga il controllo.

Il lavoro sul ciclo di vita UI/servizio accompagna il controllo server: acquisire Account e proprietario prima dei dialoghi, annullare le azioni ancora in attesa dopo blocco/cambio sessione, fermare lo svuotamento prima del record successivo e distinguere Account con ID uguali in contesti diversi. Una richiesta già inviata può comunque completarsi. Il vincolo proprietario non risolve le ricevute `archiveOperations` storicamente scrivibili dal client né la race globale purge/ripristino.


<a id="fonte-docs-m7-cronologia-cestino-audit-md-ricevute-protette-del-purge--candidata-13092026"></a>

#### Ricevute protette del purge — candidata 13/09/2026

Il registro di avanzamento si sposta in `mutationResults/{uid}/operations/{operationId}`, storicamente negato alle scritture client. Il binding server comprende proprietario, dominio, Account/contesto/azienda, revisione, conferma e hash dell'intero comando normalizzato. Conferma obbligatoria anche per riprese e duplicati. Le vecchie ricevute `archiveOperations`, da sole, provocano un rifiuto esplicito; non sono promosse. Un esito protetto valido prevale sul legacy, mentre un esito protetto malformato non autorizza fallback.

La transazione iniziale accetta soltanto ricevute verificate: `processing` consente ripresa del comando identico, mantenendo i controlli archivio/revisione se l'Account esiste; `purged` restituisce solo stato e indicatore duplicato. La transazione finale rilegge e verifica il binding prima delle patch dei Profili, della ricevuta finale e dell'audit. Il timestamp iniziale viene conservato nei retry.

Questo blocco corregge la provenienza degli esiti, non il protocollo globale: una richiesta già partita, la race purge/ripristino e i widget/grant residui restano problemi separati. La UI genera ancora un nuovo identificatore ad ogni operazione: ripresa backend con lo stesso ID collaudata, recupero UI degli esiti incerti non ancora implementato. Nessuna migrazione delle ricevute pregresse o cancellazione reale.


<a id="fonte-docs-m7-cronologia-cestino-audit-md-ripresa-delleliminazione-nella-stessa-sessione--candidata-13092026"></a>

#### Ripresa dell'eliminazione nella stessa sessione — candidata 13/09/2026

Dopo la conferma iniziale, il servizio prepara un piano opaco con comandi e identificativi immutabili. Se la risposta del purge non arriva, la UI propone «Verifica e riprendi»: solo quella scelta riutilizza il comando incerto. Nello svuotamento vengono saltati gli Account già confermati. Una sola operazione per volta; filtro e altre mutazioni non partono durante l'eliminazione. Rifiuti definitivi bloccano il piano; interrompere mantiene visibili gli elementi non confermati e segnala l'eventuale eliminazione parziale.

Blocco Vault, logout e cambio montaggio eliminano il piano; i vecchi callback non possono ripartire. Le API precedenti del servizio restano utilizzabili senza retry automatico. Il recupero UI copre adesso la stessa sessione aperta, non un refresh o un nuovo accesso. Nessun journal durevole e nessuna soluzione implicita alla concorrenza globale purge/ripristino.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-piano-dei-riferimenti-residui-non-attivato--candidata-13092026"></a>

#### Piano dei riferimenti residui, non attivato — candidata 13/09/2026

Il planner puro archive-purge-reference-plan distingue widget incorporati, coppie widget/link e inviti tramite identità esatte; non deduce i documenti dai prefissi. Le credenziali centrali sharedVaultData non vengono eliminate, anche se prive di altri collegamenti. Sono proposte soltanto revisioni esistenti e incrementabili. Coppie incomplete, riferimenti incrociati anche provenienti da altri Account, inventario non attestato o budget residuo insufficiente annullano tutta la proposta. Undici test dedicati e 121 test Functions superati.

Un piano coerente restituisce comunque applicable:false: non è collegato al purge. La completezza è dichiarata dal chiamante, non provata dal planner. Prima dell'attivazione occorre un blocco comune rispettato da ripristino Archivio, widget/link, inviti, Rules e ripristino backup; il solo controllo dell'esistenza dell'Account non basta. I grant M5 candidati non sono dedotti dagli ID legacy. I percorsi degli inviti possono contenere email: il piano è interno e non va scritto nei log o negli eventi audit.


<a id="fonte-docs-m7-cronologia-cestino-audit-md-ripristino-con-confronto-transazionale--candidata-13092026"></a>

#### Ripristino con confronto transazionale — candidata 13/09/2026

Base `4fba54e7`, ramo `experiment/m7-archive-restore-cas`: il ripristino rilegge nella transazione l'identità selezionata e richiede Account esistente, ancora archiviato e revisione uguale a quella scelta. La revisione deve essere intera sicura e incrementabile; soltanto l'assenza legacy equivale a zero. Null, stringhe, revisioni negative o fuori intervallo sono rifiutate. Il cambio sessione dopo la lettura impedisce la scrittura. In caso di conflitto la riga rimane visibile e il messaggio chiede di aggiornare l'Archivio.

25 test del servizio/UI superati. Il runner mutazioni include inoltre il servizio canonico con Auth/Firestore demo: successo, revisione obsoleta/stato già ripristinato, retry SDK dopo aggiornamento concorrente e invalidazione sessione dopo lettura. I casi negativi conservano contenuto e updateTime; i test usano esclusivamente dati sintetici. Il ripristino non retrocede più la revisione usando soltanto la snapshot UI.

Il CAS non chiude la race purge/ripristino: la preparazione purge non marca ancora il documento e recursiveDelete resta fuori dalla transazione. Il futuro protocollo comune deve essere rispettato da tutti i writer, Rules, Widget/link, inviti e backup prima di attivare il planner residui. Nessuna modifica a retention, backend o dati reali in questo blocco.


<a id="fonte-docs-m7-cronologia-cestino-audit-md-retention-del-registro-tecnico--decisione-21092026-e-progetto-candidato"></a>

### Retention del registro tecnico — decisione 21/09/2026 e progetto candidato

**Decisione del proprietario.** Gli eventi tecnici di `users/{uid}/auditEvents` sono conservati per **24 mesi** dal timestamp autorevole e poi cancellati automaticamente da un processo **controllato dal backend**; l'app client non può creare, modificare o cancellare singoli eventi di audit. Diego ha indicato 12 mesi e poi corretto a **24 mesi** il 21/09/2026: prevale la seconda indicazione. La durata è una decisione di prodotto per questo registro e **non** un termine legale generale: eventuali obblighi specifici di conservazione restano da verificare. La decisione **non** si estende alle ricevute di idempotenza (`mutationResults`, `operationResults`, `archiveOperations`, `backupRestoreOperations`), ai backup, ai log di piattaforma o agli Account archiviati, che restano fuori dalla finestra audit; per gli Account archiviati si applica la successiva decisione D1 come politica richiesta, non ancora attiva.

**Stato: implementato nel ramo locale, NON distribuito.** Il candidato di laboratorio è stato montato in Functions e le Rules del ramo escludono la scrittura client sul registro: nel ramo esistono gli eventi di risposta agli inviti (M7-AUDIT-4), i trigger degli inviti (M7-AUDIT-5I) e degli Account (M7-AUDIT-5A), i marcatori opachi nei tre scrittori client (M7-AUDIT-5C) e il job pianificato di retention (M7-AUDIT-6). **Nessun deploy è avvenuto e nessun dato reale è stato letto o cancellato**: in produzione non esiste ancora alcun job attivo e le Rules distribuite restano quelle precedenti. `experiments/history-recovery/audit-retention.mjs` resta il **riferimento di laboratorio**; il runtime ha il proprio modulo `functions/audit-retention-service.js`.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-contratto-implementato-nel-ramo-riferimento-per-i-documenti-successivi"></a>

#### Contratto implementato nel ramo (riferimento per i documenti successivi)

- **Registro best-effort.** `users/{uid}/auditEvents` traccia transizioni Firestore: non è prova forense dell'intenzione dell'utente e **non** è input di alcuna decisione di accesso.
- **Contatori Account delle voci di condivisione.** I campi sono `suspendedSharingEntries` e `neutralizedSharingEntries` e contano le **voci di `sharedWith`** che passano da `pending`/`accepted` a `suspended` nella scrittura osservata — **non** i documenti invito toccati dal client, che il trigger non può conoscere. I vecchi nomi `suspendedInvites`/`neutralizedInvites` sono storici e superati.
- **Limiti di D-8.** Il reinvito resta un `update` sullo stesso documento, quindi il proprietario può cambiare `auditRef` e rimuovere `responseAuditRef`: l'effetto massimo è una riga del **proprio** registro.
- **Retention di 24 mesi di calendario**, dal timestamp efficace, con giorno limitato nei mesi corti.
- **Date ammesse.** `at` è la data ordinaria; `createdAt` (Timestamp del server) è ammessa **solo** per le due famiglie che non scrivono `at` (`shared-vault-*`, `account-widget-*`) e **solo** quando `at` è assente. Un `at` presente ma malformato non viene aggirato da alcun ripiego.
- **Eventi non databili conservati.** Un evento senza data valida è `unverifiable` e **non** entra in alcun lotto.
- **Cursori di servizio.** La scansione avanza fra i run con un cursore per campo nel documento `auditRetentionState/scan`; a fine giro i cursori tornano `null` e la scansione riparte dall'inizio.
- **Fuori dalla retention:** ricevute di idempotenza (`mutationResults`, `operationResults`, `archiveOperations`, `backupRestoreOperations`, `syncRecords`), `trash`, `recordHistory` (non esiste in produzione), backup, log di piattaforma e Account archiviati.
- **Nessun deploy**: le voci sopra valgono **solo nel ramo**.


<a id="fonte-docs-m7-cronologia-cestino-audit-md-perimetro-del-registro"></a>

#### Perimetro del registro

Entrano in `auditEvents` i cinque percorsi censiti in [M7_RETENTION_CENSIMENTO.md](../evidenze/INVENTARI.md#fonte-docs-m7-retention-censimento-md-l1) §4.1 — `trashed`/`restored` (`trashSyncRecord`/`restoreSyncRecord`), `account-purged` (`purgeArchivedAccount`), `shared-vault-<azione>`, `account-widget-<azione>` e `backup-restore-chunk` — **più tre famiglie introdotte dalle fette M7-AUDIT**: la risposta all'invito (`invite-accepted`/`invite-rejected`, dentro la transazione della callable), i trigger degli inviti (`invite-created`, `invite-removed`) e i trigger degli Account (`account-archived`, `account-restored`). I nuovi produttori scrivono `at` con `FieldValue.serverTimestamp()`; le due famiglie `shared-vault-*` e `account-widget-*` scrivono `createdAt` con `FieldValue.serverTimestamp()` e **non** scrivono `at`.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-timestamp-autorevole"></a>

#### Timestamp autorevole

Il timestamp è `at`, impostato dal backend con `serverTimestamp`: nei cinque percorsi storici e nelle tre famiglie nuove (risposta all'invito, trigger inviti, trigger Account). Le due famiglie `shared-vault-*` e `account-widget-*` scrivono invece `createdAt` con `FieldValue.serverTimestamp()` e **non** scrivono `at`; per quelle, e solo quando `at` è assente e `createdAt` è un Timestamp valido, la data efficace è `createdAt` (M7-AUDIT-6P-R1 e rettifica approvata). Il validatore accetta le forme con cui Firestore restituisce un Timestamp (istanza SDK, `{seconds, nanoseconds}`, `Date` nei test) e considera **inverificabile** qualunque altro valore. La validazione è stretta: i nanosecondi devono essere interi nell'intervallo **0…999999999** e i secondi devono produrre un istante intero, sicuro e rappresentabile da una data JavaScript. Un valore fuori intervallo — nanosecondi negativi o oltre il miliardo, secondi oltre l'intervallo di `Date`, tipi non interi — è **malformato** e resta `unverifiable`; se la scadenza calcolata non è finita, l'evento è ugualmente `unverifiable`. Questa severità è stata introdotta dalla revisione Codex del 21/09/2026, che ha rilevato l'accettazione di `nanoseconds` fuori intervallo nella prima stesura.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-record-legacy-o-malformati"></a>

#### Record legacy o malformati

Un evento privo di data valida non viene mai cancellato: è classificato `unverifiable`, resta nel registro e viene elencato dall'esecuzione. La scelta è deliberata — non si inventa una data per eliminare un record che non si sa datare — ed è il motivo per cui una futura bonifica dei record storici senza `at` resta una decisione aperta.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-cancellazione-a-lotti"></a>

#### Cancellazione a lotti

Il piano è deterministico: solo eventi scaduti e databili, ordinati dal più vecchio con spareggio sull'id, divisi in lotti entro il limite di **500 operazioni per batch** di Firestore (dimensione predefinita 200). Nel job montato nel ramo i tetti sono: **20.000 letture per run**, **50 lotti per run** e **10 lotti per proprietario**, così un singolo proprietario con uno storico enorme non consuma il budget degli altri; la finestra della query è di 700 giorni (24 mesi di calendario sono almeno 730) e il classificatore resta l'unica autorità sulla cancellazione. L'ordine stabile rende il piano riproducibile.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-idempotenza-errori-e-ripresa"></a>

#### Idempotenza, errori e ripresa

La cancellazione di un documento già assente è un no-op; il piano si ricalcola dagli eventi ancora presenti, quindi ripetere l'esecuzione non duplica effetti e un lotto già cancellato non riappare. Un errore di lotto interrompe l'esecuzione e riporta `partial` con il lotto fallito, **senza mai dichiarare completato** ciò che non lo è; una sessione chiusa interrompe senza cancellare oltre. La ripresa riparte dagli eventi residui.

**Dettagli del job montato nel ramo (M7-AUDIT-6).** La cancellazione di ogni lotto è confermata sulla **versione letta**: via rapida con precondizione `lastUpdateTime` e, se la versione è cambiata, transazione di ripiego che rilegge, riclassifica e cancella solo ciò che è **ancora** scaduto. Il conteggio dei cancellati viene dal solo tentativo che ha committato. La scansione avanza fra i run con un **cursore per campo** (`auditRetentionState/scan`), che si azzera a fine giro; i cursori avanzano solo se la finestra letta è stata gestita per intero, così un lotto fallito o un piano saltato non fanno perdere eventi. Un errore di pianificazione produce `partial` e non avanza i cursori. Lo stato `completed` significa «nessun lavoro noto», non «tutto il registro è stato esaminato».

<a id="fonte-docs-m7-cronologia-cestino-audit-md-esclusione-delle-ricevute-e-isolamento-fra-uid"></a>

#### Esclusione delle ricevute e isolamento fra UID

Ogni percorso pianificato deve iniziare con `users/{uid}/auditEvents/`: id non conformi sono rifiutati e un evento attribuito a un altro UID interrompe il piano. Le ricevute di idempotenza non sono mai toccate, né pianificate. L'esecutore non si fida del piano ricevuto: prima di ogni cancellazione ri-deriva il percorso da UID e id, rifiuta un UID non valido, un id non conforme, una lunghezza incoerente o un percorso che non corrisponde all'id, **senza invocare alcuna cancellazione**.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-visibilità-allutente"></a>

#### Visibilità all'utente

Non esiste un'interfaccia che mostri la cronologia: **censimento in sola lettura di M7-AUDIT-7, confermato** — nessun file di `Frontend/public/assets/js` nomina `auditEvents`, e nessun modulo lo legge. Le Rules del ramo mantengono la **lettura** del proprietario e negano ogni scrittura client. L'eventuale visibilità all'utente richiederebbe una decisione di prodotto separata: la proposta minima, **non implementata**, è una pagina in sola lettura che elenca gli eventi del proprietario ordinati per `at`, con finestra di 24 mesi, nessun dato del Vault e nessuna azione di modifica (i dettagli in `docs/DEEPSEEK_COORDINATION.md`, sezione di riconciliazione M7-AUDIT-7).

<a id="fonte-docs-m7-cronologia-cestino-audit-md-dipendenze-e-decisioni-ancora-aperte"></a>

#### Dipendenze e decisioni ancora aperte

- **Convenzione della finestra**: **decisa e implementata**: mesi di calendario con giorno limitato nei mesi corti.
- **Record storici senza `at` valido**: conservati come `unverifiable` e mai cancellati; una bonifica manuale resta una decisione aperta.
- **Record storici delle due famiglie `createdAt`**: databili e quindi potabili dopo 24 mesi, perché `createdAt` è un Timestamp del server (deciso in M7-AUDIT-6P-R1 e nella rettifica approvata).
- **Obblighi legali specifici**: dipendenza dichiarata, nessuna deroga inventata.
- **Rilascio del job**: cadenza, ambiente di collaudo, monitoraggio, allarme e rollback sono **progettati solo come proposta** (giornaliero alle 03:00 Europe/Rome, 50 lotti per run, 10 per proprietario, 3 ritentativi); nessun deploy è autorizzato.
- **Rules produttive e distribuzione**: le Rules del **ramo** escludono la scrittura client sul registro; la distribuzione coordinata resta autorizzata separatamente.
- **Vista utente del registro**: non esiste (censimento in sola lettura in M7-AUDIT-7); una vista in sola lettura resta una decisione di prodotto separata e non è implementata.

<a id="fonte-docs-m7-cronologia-cestino-audit-md-prove-disponibili"></a>

#### Prove disponibili

- **Laboratorio**: `experiments/history-recovery/audit-retention.mjs` — pianificatore ed esecutore puri, riferimento di laboratorio, **non importati** da Functions; `experiments/history-recovery/audit-retention.test.mjs` — **15 prove sintetiche** (forme del timestamp, finestra di calendario, dati non interpretabili mai cancellati, ordinamento e lotti, esclusione delle ricevute, isolamento UID, input fuori misura, completamento, errore parziale con ripresa idempotente, interruzione, rifiuto dei piani arbitrari).
- **Runtime (ramo)**: `functions/audit-retention-service.js` (policy: data efficace, `createdAt` solo per le due famiglie, finestra di calendario, confinamento, piano, esecutore) con 13 casi in `functions/test/audit-retention-service.test.js`; il job in `functions/index.js` con 6 casi in `functions/test/audit-retention-job.test.js` (conteggio dal solo tentativo che committa, via rapida con precondizione, ripiego transazionale, errore non inghiottito, errore di piano ⇒ `partial`, scrittura dei cursori) e **14 casi Emulator** in `tests/audit-retention.emulator.test.mjs` (semantica dei due filtri, idempotenza, sottocollezione orfana, percorso estraneo respinto, cursore e duplicati fra proprietari, aggiornamento concorrente, scansione troncata, prefisso non cancellabile più lungo del tetto su più run, budget di letture, configurazione indici).
- `tests/history-recovery.rules.test.mjs` — Rules **candidate** (`experiments/history-recovery/firestore.candidate.rules`): lettura riservata al proprietario e **create, update e delete negati** al client su `auditEvents`, `trash` e `recordHistory`.
