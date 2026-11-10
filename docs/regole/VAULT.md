# Vault

<a id="cornice-d11-vault-2026-11-10"></a>

## Cornice D11 — notifiche senza prestito di chiavi

Il canale FCM trasmette soltanto coordinate di destinazione e correlazione, mai chiavi, grant, token Auth o UID. Una cornice pronta adotta il push soltanto dopo verifica della sorgente registrata e ammissione fresca, ancora nello stesso documento/identità/generazione e prima della deadline. Blocco, sospensione, logout o revoca intervenuti durante l'attesa impediscono l'adozione. Nessun sblocco o rinnovo dell'inattività deriva dal messaggio. La chiave continua a vivere solo nella RAM prevista dal contratto A1; il fallback non ricrea continuità da storage. Protocollo, limiti nativi e worker distinto sono definiti in [Interfaccia D11](INTERFACCIA.md#cornice-d11-ui-2026-11-10); le prove C1 restano NE.

<a id="cornice-b1-permesso-2026-11-09"></a>

## Cornice B1 — ammissione server candidata

Il singleton root `vaultFramePolicy/current`, fuori dal sottoalbero modificabile dagli utenti, contiene soltanto schemaVersion=1, version=1, uid, enabled ed expiresAt (timestamp). La coorte è un solo UID verificato, scritto privatamente da un operatore server approvato in B3, mai nel repository. Le Rules negano ogni scrittura client, elenco, query, utente anonimo/estraneo/non verificato, formato diverso, scadenza e fence di recupero attivo o malformato. La preferenza utente, un parametro o lo storage non sono un permesso. Assenza/disabilitazione/cambio UID del singleton nega anche al destinatario precedente.

Un listener server con includeMetadataChanges alimenta solo RAM. L'evento cache iniziale non autorizza e attende un evento server entro cinque secondi. Dopo l'ammissione, cache, scritture pendenti, errore, offline osservato, UID/fence diverso, cancellazione o policy non valida revocano il consenso e il contesto. I risultati tardivi non lo riattivano. Nessun heartbeat rinnova artificialmente la validità: expiresAt resta il limite imposto dal documento server; una connessione silenziosamente interrotta dipende dai segnali del trasporto Firestore, non da una garanzia di revoca istantanea. Per ingresso, ripresa visibile e operazioni sensibili si esegue inoltre getDocFromServer con richieste concorrenti coalescenti e ricontrollo UID/fence/generazione. Il controllo periodico del broker legge la RAM e non genera GET ogni dieci secondi. Questo esplicita il modello di freschezza del listener; non considera lo stato online o una cache persistente prova di autorità ([Firebase listener](https://firebase.google.com/docs/firestore/query-data/listen), [metadata cache](https://firebase.google.com/docs/firestore/manage-data/enable-offline)).

Il bootstrap canonico instrada le sole route top-level ammesse prima del primo sblocco. Gli altri utenti e i dinieghi conservano il percorso standalone. Un marker monouso esclusivamente di diniego, rimosso subito dall'URL, evita che il ripiego per differenza di versione rientri automaticamente nella cornice; non è una fonte di autorizzazione. Gli anchor sono elencati per route nel codice e corrispondono a sezioni reali del DOM; frammenti sconosciuti o codificati non entrano nella cornice. La lista comprende le sezioni dei due form Account, del Profilo e dei dati/modifica azienda; restano obbligatori i tre anchor già censiti in A1.

Correzione del NO-GO B1: il routing automatico viene tentato soltanto se il token già ottenuto dal controllo Auth canonico contiene il booleano server `vault_frame_canary: true`, email verificata e UID ancora corrente. La hint è locale al callback e nasce falsa: assenza, valore diverso da true, refresh della verifica email o offline conservano subito il percorso ordinario, senza import del routing, listener o letture del singleton aggiuntive. Non si introduce una seconda richiesta token né una cache positiva in storage. La hint è soltanto un filtro per evitare lavoro ai non partecipanti: non compare nelle Rules e non autorizza la cornice o la chiave. Una hint vera, anche se manipolata sul client, richiede comunque documento server valido, UID e fence. Per il solo partecipante resta la doppia verifica in ingresso (route e padre), senza ripeterla nei figli. Se il trasporto risulta già offline, anche l'adapter nega prima di creare la referenza SDK. Il marker standalone viene consumato localmente prima del filtro, anche senza hint o rete.

In B3 andranno proposti e approvati il singleton e il solo claim dell'UID di Diego, preservando gli altri claim Auth, con rinnovo del suo token; nessuna scrittura Auth o Firestore effettuata in B1. L'assenza o il ritardo di propagazione del claim può solo rinviare l'ingresso automatico, mai permettere una chiave. Revocare/disabilitare il singleton rimane il kill switch autorevole, indipendente dal token. Il claim non sostituisce tale revoca.

Ogni lettura fresca ha una deadline di cinque secondi: scadenza o diniego bloccano il contesto. Alla sospensione si annullano soltanto le verifiche pendenti, preservando il timeout ordinario della chiave; la ripresa deve avviare una nuova lettura server e non può riutilizzare la promessa precedente.

La candidata abilita il raccordo compilato, ma non configura alcun singleton reale né pubblica Rules/Hosting: produzione invariata. Kill switch server e ripiego standalone precedono qualsiasi rollback del codice. Chiavi, prove e preferenze non vengono migrate. B1 attende revisione; le prove reali Firebase/Auth/App Check/PRF e dispositivi restano separate. Le sezioni A2 sottostanti descrivono il candidato precedente al GO, non l'interruttore compilato B1.


<a id="cornice-a2-raccordo-2026-11-09"></a>

## Cornice A2 — raccordo disattivato candidato

Il contratto A1 seguente ha ricevuto GO Claude sul commit `4f2bc0f812fa2f72c63a409d1aa5d3a120bcd136`. Prescrizioni recepite nella candidata: messaggi con protocollo e versione di rilascio; differenza di versione revoca e ripiega fuori cornice, senza consegna; fence intero revision/nonce oltre all'UID, ricontrollato dopo le attese e prima della consegna; unico timer nel padre e nessun rinnovo al bootstrap del figlio. Background usa la stessa preferenza dell'inattività e cancella conferme/grant pendenti. Le copie dei figli restano RAM transitoria; il gestore canonico adotta il materiale soltanto dopo verifica di UID/fence/generazione.

A2 resta spenta con due dinieghi indipendenti, senza UID Diego nel codice: B1 deve fornire l'ammissione server. I comandi sensibili censiti sono raccordati alla conferma fresca: export/backup, cambio Master Password, condivisioni/revoche e cancellazioni definitive, comprese rimozioni strutturate differite al salvataggio. Il grant è monouso, legato a scopo/target/UID/documento/generazione e scadenza; le continuazioni riverificano il fence dopo le attese. La revisione A2 di Claude deve ancora valutarne la copertura: nessuna presenza di API vale come certificazione automatica. Nel cambio Master Password le tre schermate esistenti sono annullabili alla sospensione; la conferma del padre è richiesta immediatamente prima della scrittura, poi la sessione della cornice viene revocata per rileggere il nuovo contenitore al prossimo sblocco. Il passaggio aggiuntivo è esplicito, non un ritorno alla richiesta a ogni pagina. Al blocco il figlio viene revocato sincronicamente e rimosso, distruggendo DOM e closure del documento. Solo logout e pulizia biometrica locale trattengono il contesto mascherato, già senza chiave, per completare la pulizia durevole; guardia massima 20 secondi e rimozione anche al timeout/dispose. Il comando Home non interrompe questa fase. Nessun rilascio o modifica del contratto crittografico o dei dati Vault. [Evidenze e limiti](../evidenze/COLLAUDI.md#cornice-a2-preparazione-2026-11-09).

<a id="cornice-a1-2026-11-09"></a>

## Cornice persistente — contratto A1 approvato, 09/11/2026

**Stato e autorità.** Il nuovo [ordine di Diego](../progetto/DECISIONI.md#cornice-ordine-2026-11-09) autorizza la sequenza A1/A2/B1/B2/B3/C1/C2 sulla [PR #278](https://github.com/Diego-Stack-ai/App-Codici-Password/pull/278). Questo passo definisce il contratto; non implementa né attiva la cornice. Codex è l'unico esecutore, Claude è revisore consultivo in sola lettura sulla PR. Nessun passaggio ad A2 senza «REVISIONE CLAUDE – GO» riferibile ad A1 e al suo commit; nessun merge/deploy senza approvazione personale di Diego. Le note precedenti del laboratorio restano evidenze sintetiche, non prove produttive. La produzione rimane 1.2.267. Il nuovo ordine colloca la lista B2 prima del canary e le prove fisiche di Diego in C1 dopo B3: supera soltanto per questo canary individuale la precedente sequenza che pretendeva l'intera matrice fisica prima dell'attivazione. Non trasforma prove mancanti in PASS, non permette altri utenti e non elimina i gate automatizzati A2/B1, il GO o l'approvazione personale; un esito C1 negativo richiede arresto/rollback.

### Sessione, materiale e confine di fiducia

`app.html` è il documento principale persistente e possiede la continuità della sessione; le pagine esistenti vengono montate come figli dello stesso sito. Le API crittografiche attuali richiedono copie transitorie del materiale nella RAM del figlio: non si promette che il solo padre possieda ogni copia. Navigare fra figli ammessi elimina la copia del documento precedente e conserva quella del padre. Ricaricare/chiudere la cornice, terminazione o congelamento del suo documento richiedono un nuovo sblocco tramite Master Password o PRF reale compatibile; non si ricrea una sessione da storage.

**Le pagine della stessa origine non sono un confine di sicurezza. Una XSS nell'origine dell'app compromette la chiave, come oggi.** Allowlist, controlli dei messaggi e permesso server prevengono consegne o navigazioni non autorizzate nel flusso previsto; non isolano codice same-origin malevolo e non sostituiscono CSP, Rules, Auth, App Check o contenimento degli allegati. Non si introduce un iframe sandbox come finta separazione.

KEK, Vault Key/keyring aperti e grant non compaiono in storage browser, IndexedDB, Cache Storage, Service Worker/Shared Worker, URL, history.state, DOM, log o console. La Master Password è ammessa soltanto nel valore transitorio del campo password attivo e nella RAM della cerimonia di sblocco/conferma: azzerare l'input a completamento, annullamento o blocco, senza rifletterla in attributi/markup, history, log o persistenza. History e messaggi ai worker contengono soltanto intenzioni/coordinate di navigazione non segrete; nessuna chiave fra schede. Restano i formati crittografici e i lettori esistenti: nessuna migrazione di dati deriva dalla cornice.

### Allowlist produttiva chiusa

Sono ammissibili esclusivamente i seguenti percorsi root canonici, ciascuno con bootstrap privato e controlli di autorizzazione invariati. La tabella censisce le query esistenti lette o generate dai collegamenti da preservare con validazione per route; non autorizza qualunque valore né trasforma la query in un permesso. Per esempio il form privato deve conservare type generato dalla lista anche se il form attuale non lo legge direttamente.

| Percorsi `.html` (prefisso `/`) | Query di compatibilità |
|---|---|
| `home_page`, `area_privata`, `lista_aziende`, `archivio_account`, `configurazione_documenti`, `configurazione_generali` | Nessuna query operativa censita; non ammettere campi arbitrari |
| `account_privati` | `type`, `afterWrite`, `m6refresh` |
| `form_account_privato` | `id`, `type`, `profileContactId`, `linkShared` |
| `dettaglio_account_privato` | `id`, `ownerId`, `afterWrite`, `m6refresh`, `linkShared` |
| `account_azienda` | `id`, `type` |
| `form_account_azienda` | `id`, `aziendaId`, `profileContactId`, `type`, `linkShared` |
| `dettaglio_account_azienda` | `id`, `aziendaId`, `ownerId`, `afterWrite`, `serverRefresh`, `linkShared` |
| `dati_azienda` | `id`, `afterWrite`, `profileTab` |
| `modifica_azienda` | `id` |
| `profilo_privato` | `profileTab`, `profileDocumentId`, `assistantDoc` |
| `impostazioni` | `firstConfiguration`; `recovery=complete` escluso dalla cornice |
| `scadenze` | `filter`, `rule` |
| `aggiungi_scadenza` | `id`, `profileDocumentId`, `accountSource` |
| `dettaglio_scadenza` | `id`, `received`, `notification` |
| `regole_scadenze` | `return`, `domain` |
| `configurazione_automezzi` | `source`, `rule`, `domain` |
| `gestione_destinatari` | `return`, `companyKind`, `companyId`, `companyName` |

Totale: **22 pagine**. A2 dovrà codificare schemi chiusi con limiti e validatori coerenti con i consumer attuali: ID opachi, enum e flag non condividono un unico regex permissivo. `accountSource`, `linkShared` e `firstConfiguration` mantengono il significato esistente del flag 1; `assistantDoc` resta indice numerico validato. Campi duplicati, valori fuori schema o non classificati non ottengono un handoff: rimangono nel percorso standalone previsto, senza loop di reindirizzamento. I diagnostici `m6pilot`/`m6lease` sono esclusi da questa ammissione. Non si inventano alias query `scope` o `returnTo`.

`return` della rubrica ammette soltanto aggiungi_scadenza/form_account_privato/form_account_azienda; quello delle regole soltanto aggiungi_scadenza. Validare anche la destinazione annidata, senza ricorsione aperta o URL esterni. `ownerId`, `aziendaId` e altri riferimenti selezionano risorse autorizzate dai controlli esistenti: **non scelgono mai l'UID della Vault**. Conservare gli anchor di sezione leciti sia nello stesso documento sia all'ingresso di un nuovo documento: almeno #section-email su modifica_azienda e #shared-credentials-section nei due form Account. Restano identificatori di sezione validati per route, non contenuto da decodificare/eseguire o fonte di privilegi; non riusare il diniego indiscriminato di tutti gli hash del laboratorio.

Canonicalizzare `/home` in `/home_page.html` prima del caricamento nel figlio. Niente riconoscimenti per sottostringa, path ambigui o traversal, credenziali URL, schemi diversi da HTTPS/origine canonica o corrispondenze per suffisso. Sono esclusi `/app.html` annidato, index/login/registrazione/reset/nuova password, privacy/termini/contatto condiviso, anteprime, laboratori e ogni altro percorso; inoltre allegati, PDF e viewer, URL esterni, `blob:`, `data:` e `about:`. Le dieci fixture del laboratorio non diventano implicitamente la tabella produttiva.

### Ammissione e protocollo reale ancora da implementare

Il ripiego ordinario resta identico per chi non è abilitato. A2 pubblicabile parte spento; B1 introduce una configurazione server dedicata, leggibile e attiva soltanto per l'UID Firebase di Diego verificato, non scrivibile dal client, neppure dal proprietario. Le preferenze del documento utente non sono il flag. Nessuna email, query, localStorage o codice client può autoabilitare la cornice. Anonimo, UID diverso, revocato, policy assente/disabled/incompatibile o risposta server non verificabile non ottengono la chiave. Non assumere che una cache Firestore costituisca un consenso server corrente.

Il broker lega ogni consegna a origine esatta, proprio iframe (`event.source === iframe.contentWindow`), effettivo Document/URL ammesso, nonce nuovo per documento, UID Auth, epoca del fence e generazione del blocco. Il figlio verifica il parent atteso; il testo di un messaggio non decide da solo l'URL autorizzato. Ricontrollare tutti i vincoli prima della consegna e prima dell'uso dopo ogni await. Richieste tardive o relative al vecchio documento non riaprono la sessione. Grant monouso, scopo/bersaglio vincolati e scadenza breve verificata; il tempo non è fornito dal richiedente. Grant scaduti, riusati, di un altro UID/documento/generazione o cancellati sono negati.

Il padre osserva flag/revoche e partecipa al fence di autenticazione esistente; rilegge la policy dal server prima di ammissione, ripresa e azioni sensibili. Il ritorno visibile non concede materiale mentre tale verifica è pendente. Una revoca osservata o l'impossibilità di verificare l'ammissione provoca blocco e cancellazione delle copie; risultati tardivi non possono ripristinarle. A2/B1 devono provare questo comportamento, senza fingere di aver già progettato un nuovo servizio di autorizzazione.

### Inattività, background e revoca

**Decisione esplicita di Diego:** il background usa la stessa durata dell'inattività. La sorgente è `lock_timeout` del profilo autenticato: opzioni attuali 1, 3, 5 e 720 minuti; assenza segue il default esistente di 3, valore legacy 0 segue il ripiego a 1. Una preferenza presente ma non numerica, non finita o non positiva usa il ripiego a 1 minuto, senza rinnovare una scadenza preesistente più vicina; i valori numerici positivi leciti seguono la preferenza effettiva, non un default fisso. Non usare i tre minuti fissi del laboratorio al posto della preferenza. Un cambio di preferenza è acquisito senza dipendere dalla navigazione; ridurre il tempo non regala una nuova finestra a una sessione già scaduta.

Il padre conserva in RAM l'ultima attività e le scadenze; i messaggi del figlio non impongono timestamp. Solo interazioni effettive nel documento attivo e verificato rinnovano l'inattività, non caricamenti, polling, replaceState o risposte SDK. La navigazione non azzera automaticamente il timer. In background nessuna attività fittizia lo rinnova: si applica la scadenza più vicina fra inattività già maturata e hiddenAt + durata scelta. Al ritorno controllare scadenze e fence/flag prima di mostrare dati o consegnare chiavi, anche se i timer sono stati rallentati dal browser.

Nascondere/sospendere le funzioni sensibili, fermare camera/microfono e annullare conferme/richieste pendenti all'uscita dal contesto visibile. Alla scadenza, blocco manuale, logout, cambio UID/epoca, revoca o uscita/freeze del padre: eliminare materiale del padre e del figlio, copie plaintext raggiungibili, grant e operazioni pendenti; ripristinare la schermata protetta. Invalidare prima di attendere signOut o servizi remoti. Pagehide del solo figlio durante navigazione elimina soltanto la sua copia: non è logout del padre. La pulizia non promette cancellazione forense della RAM o del sistema operativo.

### Operazioni sensibili e arresto

Vault aperta non equivale a conferma recente per backup/export, archivio portabile, cambio Master Password, condivisione/variazione permessi o cancellazione definitiva. Richiedere nuova biometria PRF reale oppure Master Password e un'autorizzazione monouso legata a UID/generazione/documento/scopo/bersaglio/scadenza; un normale handoff della cornice non soddisfa il requisito. Restano distinti tutti gli altri vincoli di reautenticazione Firebase/2FA già esistenti. Annullamento, errore o timeout non autorizzano l'operazione; nessuna richiesta o grant è riusata dopo blocco.

Fermare l'attivazione per perdita di controllo su copie RAM o grant, mancata revoca/cambio UID, ammissione da storage o URL, file navigabile nel frame, header effettivi contraddittori, regressione Auth/App Check/PRF/media/download/back o impossibilità di ripiego senza loop. Nessuna prova mancante diventa PASS usando Master Password al posto di una PRF prima funzionante. I problemi di sicurezza aperti diversi da questo perimetro e la nuova grafica restano incarichi separati.

Rollback: disabilitare prima il flag server, revocare le sessioni cornice/grant osservate e ripiegare sulle pagine ordinarie; in alternativa distribuire via CI la rimozione del solo instradamento, e se necessario le precedenti intestazioni restrittive in un pacchetto coerente. Nessun downgrade che ripersisti chiavi, nessuna modifica/cancellazione di dati Vault, nessun deploy dal PC. Rules/Function eventualmente necessarie a B1 hanno scope CI esplicito, GO e approvazione personale distinti. [Contratto UI/header e transizioni](INTERFACCIA.md#cornice-a1-ui-2026-11-09), [fasi e gate](../progetto/INCARICO_CORRENTE.md#cornice-a1-incarico-2026-11-09).


<a id="cornice-lab-2026-11-09"></a>

## Cornice: laboratorio isolato e contratto di raccordo — 09/11/2026

Il nuovo ordine di Diego avvia la preparazione disabilitata; supera la sospensione assoluta della sola preparazione riportata nel raccordo storico del 08/11, non i gate dell'attivazione reale. `experiments/persistent-vault-frame/` è un laboratorio su loopback con pagine sintetiche e nessun adapter Firebase. La sua abilitazione locale riguarda soltanto fixture inventate, non costituisce l'interruttore dell'account e non può autorizzare l'accesso a una Vault reale.

Il proprietario della continuità è il documento padre. L'adattamento alle pagine esistenti comporta copie transitorie del materiale nella RAM del figlio; blocco, logout, cambio UID/epoca e revoca devono eliminarle entrambe e invalidare le operazioni pendenti. Una navigazione normale elimina il vecchio figlio senza chiudere la sessione del padre. La semplice presenza della cornice non protegge da codice malevolo già attivo nella stessa origine.

Il confine del laboratorio combina origine esatta, WindowProxy del proprio iframe, URL effettivo in allowlist, identità del Document, nonce per documento e handshake con nonce generato dal figlio. Il dato dichiarato nel messaggio non sceglie la pagina autorizzata. Niente blob/data/about, pagine pubbliche o anteprime; nessuna chiave in storage, URL, DOM o log. Le risposte vengono ricontrollate al momento della consegna. Ammissione assente, scaduta o non verificabile implica diniego e revoca; risposte tardive non possono riaprire una sessione bloccata. Le conferme sensibili del laboratorio sono sintetiche, monouso, legate a UID, generazione, scopo, bersaglio e scadenza: non autorizzano comandi reali.

Prima della PR di integrazione reale mancano: bridge nel boundary canonico `security-manager`, pagina pubblicabile `app.html`, flag server dedicato e sua revoca, timer centrale configurato da `lock_timeout` e background, invalidazione coordinata con Auth/fence, conferme effettive nei comandi e header selettivi. Le normali preferenze del documento utente sono scrivibili dal proprietario e non valgono come interruttore server; un custom claim dedicato è solo una possibilità da progettare, non impostata. La CSP reale oggi nega gli antenati e non permette frame self: le eccezioni future devono lasciare login/pubbliche protette, senza policy sovrapposte contraddittorie. Gli allegati restano fuori dalla cornice secondo il contenimento già distribuito.

Prima dell'attivazione: tutti i collaudi originari su Chrome desktop/Android, Safari iPhone e PWA; dieci pagine reali, blocco inattività/background/logout, login/App Check/PRF/scanner, Indietro/Avanti/reload/link/nuova scheda, separazione origini e nessuna persistenza, parità delle pagine. Le prove sintetiche non sostituiscono questi gate. Rollback mediante spegnimento del flag server o rimozione del solo instradamento Hosting; nessuna migrazione dei dati deriva dal laboratorio. [Mandato](../progetto/INCARICO_CORRENTE.md#cornice-laboratorio-2026-11-09), [ricevuta](../evidenze/COLLAUDI.md#cornice-lab-2026-11-09).

## Raccordo operativo — 08/11/2026

Le revoche della Ricerca descritte nel checkpoint del 07/11 sottostante sono state distribuite nella [1.2.261](../evidenze/COLLAUDI.md#pubblicazione-sicurezza-1-2-261) e conservate nella 1.2.262. La continuità della Vault resta invece un incarico distinto: il nuovo prototipo è sospeso fino al completamento del prerequisito assegnato in [INCARICO_CORRENTE](../progetto/INCARICO_CORRENTE.md#vault-frame-prerequisites-2026-11-08). Nessuna cornice, trasmissione della chiave o attivazione per Diego è implementata o autorizzata dalla sola ricognizione preparatoria. Le descrizioni anteriori conservano il proprio contesto e non attestano lo stato produttivo corrente.

## Candidata di revoca e continuità ancora da integrare — 07/11/2026

Il lotto locale di sicurezza invalida anche le copie di chiave e plaintext mantenute dalla Ricerca, comprese preparazioni/decifrature e operazioni vocali che terminano dopo il blocco. Un dialogo vecchio non riacquista autorità dopo un nuovo sblocco dello stesso UID; il comando Ricerca rimane invece disponibile per una preparazione nuova. I dettagli offline richiedono un grant esplicito del destinatario prima di mostrare dati cached, senza cancellare automaticamente la cache.

Queste correzioni non sono ancora una distribuzione attestata e non risolvono la richiesta della Master Password a ogni cambio pagina: la shell persistente con chiavi solo RAM resta il prossimo lotto separato di [PROGRAMMA](../progetto/PROGRAMMA.md#chiusura-e-priorita-2026-11-07). La cache cifrata e la conversione legacy mantengono i propri prerequisiti di backup recuperabile, canary e CAS.

## Contenimento multipagina — distribuzione attestata il 06/11/2026

Il contenimento introdotto con la **1.2.259 pubblicata** e mantenuto nella **1.2.260** conserva payload di sessione e CryptoKey non esportabile esclusivamente nella memoria del documento; nessun valore della sessione viene letto o scritto nello storage browser. Al bootstrap e al blocco vengono rimossi i nomi legacy. UID, scadenza, eventi di sblocco e invalidazione generazionale restano obbligatori; uscita dal documento/freeze revocano la RAM. Una nuova pagina o un refresh richiedono nuovo sblocco tramite Master Password o PRF compatibile. Questo contenimento non certifica la shell completa, non protegge da codice malevolo già attivo nello stesso contesto e non sana cache personali o cifrature legacy. Per prove, distribuzione e limiti correnti vale [STATO](../progetto/STATO.md#stato-corrente).

Il profilo recovery completo schema 3 conserva il materiale serializzato del keyring nella capsula cifrata e nella RAM client; non richiede la vecchia Master Password in importazione e crea un nuovo envelope e verifier con quella nuova. Il solo locator di ripresa persistibile contiene UID, ID operazione, ID backup e digest del contenuto, senza file, password, chiavi o record. I prerequisiti sono distribuiti con la **1.2.260**, ma il percorso resta **inerte**: policy server `disabled`, coorte vuota e flag client `false`. La distribuzione non chiude attivazione, drain, canary Auth/App Check o migrazioni; contratto e gate sono in [BACKUP](BACKUP.md#recovery-completo).

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Indice delle fonti conservate

- [VAULT_KEY_CONTRACT.md](#fonte-docs-vault-key-contract-md-l1)

<a id="fonte-docs-vault-key-contract-md-l1"></a>

## Fonte: VAULT_KEY_CONTRACT.md — righe originali 1–168

> Provenienza: `docs/VAULT_KEY_CONTRACT.md` a `2900ccc0`.

<a id="fonte-docs-vault-key-contract-md-contratto-delle-chiavi-della-vault"></a>

## Contratto delle chiavi della Vault

> **Stato:** contratto attivo; candidata shell RAM verificata parzialmente, persistenza legacy produttiva ancora non conforme
> **Autorità:** contratto specialistico subordinato ad [Architettura Sicurezza V1](SICUREZZA.md#fonte-docs-architettura-sicurezza-v1-md-l1)\
> **Versione:** 1.0 riallineata\
> **Ultima verifica documentale:** 15 settembre 2026, incremento `054b045d`, PR #67; invarianti e formati invariati
> **Codice interessato:** `security-manager.js`, `vault-session.js`, `crypto-utils.js`, WebAuthn/PRF, backup e condivisione

Questo documento definisce nomi e comportamento obiettivo. Le verifiche storiche conservano data e base originarie. La shell persistente è la direzione già approvata: nel candidato la chiave resta in RAM e l'ingresso elimina i residui legacy; la produzione 1.2.127 conserva ancora il percorso multipagina. Il rischio VS-P0-01 resta aperto fino alla sostituzione completa. Stato ed evidenze nel [riepilogo corrente](../storico/REGISTRO.md#fonte-docs-piano-maturita-professionale-md-chiusura-documentale-dellincremento-054b045d--15092026); nessuna nuova decisione sui formati o sulla crittografia.

<a id="fonte-docs-vault-key-contract-md-1-termini-canonici"></a>

### 1. Termini canonici

| Termine | Significato | Persistenza in chiaro |
|---|---|---|
| Password account | Credenziale Firebase Authentication; non cifra la Vault | Mai nell’app |
| Master Password | Segreto conosciuto dall’utente che verifica lo sblocco e deriva la KEK | Vietata |
| Verifier | Prova per verificare la Master Password senza conservarla | Ammessa solo nel formato autenticato/versionato |
| KEK | Chiave temporanea derivata dalla Master Password e dal salt | Vietata |
| Vault Key | Segreto casuale a 256 bit che protegge dati o chiavi inferiori | Vietata |
| Vault Key material | Valore runtime usato dalle API crittografiche; può includere un keyring di transizione | Vietata |
| Envelope | Vault Key cifrata e autenticata dalla KEK | Ammesso |
| Keyring legacy | Chiave primaria e fallback necessari alla lettura transitoria | Solo cifrato |
| Record Key | Chiave casuale dedicata a un record | Vietata |
| File Key | Chiave casuale dedicata a un allegato | Vietata |
| Recovery Key | Segreto indipendente per il recupero | Vietata |
| Chiave privata di condivisione | Materiale privato dell’identità crittografica | Vietata |
| Chiave pubblica | Materiale pubblico versionato e legato all’UID | Ammessa |

La variabile storica `_masterKey` non deve essere chiamata Master Password se contiene la Vault Key già sbloccata. Il codice nuovo deve usare nomi non ambigui.

<a id="fonte-docs-vault-key-contract-md-2-stato-documentato-del-formato-esistente"></a>

### 2. Stato documentato del formato esistente

I documenti e il codice storico dichiarano:

- verifier v2 con PBKDF2-SHA-256, 600.000 iterazioni e AES-GCM-256;
- `vaultKeyEnvelope` in `users/{uid}/settings/security`;
- cache locale di verifier/envelope e contenitore WebAuthn protetto per UID;
- `_vaultKeyMaterial` in RAM;
- keyring `CPVK2:` per leggere record precedenti;
- una funzione di “session wrapping” che salva in `sessionStorage` payload cifrato e chiave casuale di wrapping della stessa scheda.

L’ultimo punto è un **rischio P0 da verificare**: se ciphertext e chiave che lo apre sono entrambi accessibili nello stesso storage/origine, il wrapping non crea una separazione crittografica significativa contro script eseguiti nell’origine. Non deve essere descritto come “sicuro” finché threat model e codice non dimostrano una protezione diversa.

La descrizione dello stato corrente non autorizza a conservarlo.

<a id="fonte-docs-vault-key-contract-md-3-invarianti"></a>

### 3. Invarianti

1. Password account e Master Password sono separate.
2. Master Password, KEK, Vault Key, Record Key, File Key, Recovery Key e chiavi private non arrivano a Firestore, Storage, Functions, log, URL o analytics in chiaro.
3. La Vault Key persistita esiste soltanto come envelope cifrato e autenticato.
4. Le chiavi sbloccate restano in memoria per il tempo strettamente necessario.
5. `localStorage` non contiene Master Password o chiavi sbloccate, neppure codificate Base64.
6. `sessionStorage` non è memoria sicura per una chiave sbloccata.
7. Un contenitore locale persistito è ammesso soltanto se cifrato/autenticato e se la chiave che lo apre non è conservata nello stesso storage accessibile agli stessi script.
8. IndexedDB e cache Firestore possono contenere ciphertext, envelope e metadati minimi, non plaintext.
9. Logout, blocco Vault, cambio UID e revoca dispositivo eliminano il materiale sbloccato raggiungibile dall’app.
10. Nonce/IV sono unici per chiave e operazione.
11. Ogni formato è versionato e dispone di lettore retrocompatibile controllato.
12. Nessuna migrazione crittografica modifica dati reali senza inventario, backup recuperabile, confronto, rollback e approvazione.
13. Le Functions non ricevono le chiavi necessarie a decifrare il contenuto zero-knowledge.

<a id="fonte-docs-vault-key-contract-md-4-flusso-obiettivo"></a>

### 4. Flusso obiettivo

1. La Master Password viene verificata tramite un verifier resistente agli attacchi offline.
2. Master Password e salt derivano la KEK in memoria.
3. La KEK apre `vaultKeyEnvelope`.
4. La KEK viene eliminata appena possibile.
5. Il Vault Key material resta in RAM durante la sessione sbloccata.
6. Record e allegati usano chiavi inferiori secondo il formato versionato.
7. Il blocco elimina il materiale sbloccato.
8. Il nuovo sblocco richiede Master Password oppure un contenitore protetto realmente dal dispositivo.

Il cambio Master Password deve riavvolgere la Vault Key quando il formato lo consente; non coincide con il cambio della password Firebase e non autorizza una migrazione senza test.

<a id="fonte-docs-vault-key-contract-md-5-webauthn--prf"></a>

### 5. WebAuthn / PRF

WebAuthn/PRF può proteggere lo sblocco locale se:

- usa capacità reali del dispositivo e non una biometria simulata;
- conserva soltanto ciphertext, IV, salt, versione e identificatore credenziale;
- il segreto di apertura non è esportabile nello storage web ordinario;
- mantiene un fallback/recovery esplicitamente progettato;
- è collaudato sui browser e dispositivi supportati;
- revoca e cambio UID eliminano i contenitori non più validi.

I formati `encryptedMasterKey` o versione 1 possono restare lettori legacy soltanto finché inventario e migrazione ne richiedono la presenza.

<a id="fonte-docs-vault-key-contract-md-6-kdf-wrapping-e-gerarchia"></a>

### 6. KDF, wrapping e gerarchia

I parametri definitivi della KDF non vengono promossi a standard definitivo finché non sono:

- inventariati nel codice e nei dati;
- misurati su iPhone e Windows supportati;
- verificati rispetto a salt, dominio d’uso e versione;
- testati con credenziale errata e contenitore alterato;
- sottoposti ad audit indipendente.

Cambiare algoritmo o parametri è una migrazione.

La gerarchia obiettivo è:

1. credenziale utente o protezione dispositivo;
2. KEK/chiave di protezione;
3. envelope della Vault Key;
4. Record Key;
5. File Key.

<a id="fonte-docs-vault-key-contract-md-7-recupero-e-rotazione"></a>

### 7. Recupero e rotazione

Il recupero zero-knowledge richiede un segreto o dispositivo predisposto. Senza tale materiale il servizio non può promettere il recupero.

Cambio Master Password e rotazione richiedono:

- autenticazione recente;
- verifica della vecchia credenziale;
- backup cifrato verificato;
- trasformazione in memoria;
- nuova versione;
- rilettura e confronto;
- rollback;
- rigenerazione dei contenitori dispositivo/WebAuthn quando necessaria.

<a id="fonte-docs-vault-key-contract-md-8-verifiche-p0-aperte"></a>

### 8. Verifiche P0 aperte

Prova di compatibilità locale 12/09/2026, base `553a35d5`: adattatore candidato in RAM verificato su fixture tramite `crypto-utils.js` reale, verifier/envelope v2 e CPVK2. Il materiale legacy resta testuale in RAM, non viene descritto come CryptoKey non esportabile. [Audit Vault §13](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-13-compatibilità-e-anteprima-offline--12092026) separa queste prove dal runtime reale e dal collaudo iPhone ancora richiesto.

Prototipo autorizzato 12/09/2026, base `a6f756cc`: navigazione persistente e CryptoKey solo in RAM provate esclusivamente su fixture fittizia in `experiments/persistent-vault-shell`. [Audit Vault §11](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-11-prototipo-autorizzato--12092026) definisce threat model, limiti e gate. Non è un lettore alternativo dei dati reali e non sostituisce la sessione produttiva.

Secondo intervento locale del 12/09/2026, base `67288cc3`: invalidazione delle operazioni asincrone dopo logout/blocco/reset e controllo UID prima della pubblicazione della chiave. Contatori solo in RAM, nessun nuovo formato persistito. Prove, compatibilità e limiti in [Audit Vault §9](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-9-correzione-locale-del-12092026--operazioni-concorrenti); proposta architetturale nella sezione 10, ancora da scegliere.

Aggiornamento locale 12/09/2026 (base v1.2.110): i sette comandi espliciti di logout cancellano il materiale locale prima di `signOut`, con test del comando comune anche in errore remoto. Evidenza e limiti in [Audit Vault, sezione 8](../evidenze/AUDIT.md#fonte-docs-audit-vault-session-p0-md-8-correzione-locale-del-12092026--blocco-1-logout). Il formato della sessione e gli invarianti restano invariati; la persistenza della chiave di wrapping rimane non conforme.

- determinare esattamente cosa `vault-session.js` scrive in `sessionStorage`;
- verificare se payload e chiave di wrapping sono entrambi recuperabili dalla stessa origine;
- cercare residui storici in `localStorage`;
- censire verifier, envelope, salt, IV, iterazioni e versioni;
- verificare pulizia a logout, blocco, crash e cambio UID;
- verificare l’impatto XSS sul Vault sbloccato;
- censire fallback e keyring legacy;
- provare sblocco e fallimento su due dispositivi;
- confermare che Functions e log non ricevano segreti;
- ottenere revisione crittografica indipendente.

Finché questi punti non sono chiusi, il runtime non deve essere dichiarato definitivamente zero-knowledge o conforme a questo contratto.

Aggiornamento sperimentale 12/09/2026, base `ff006c71`: annullamento esplicito delle dipendenze di sblocco e controlli tra caricamento, prompt, verifier e unwrap; errori di smontaggio delle viste segnalati al blocco. Invarianti e formati produttivi invariati. Evidenze: [Audit Vault §15](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-15-annullamento-e-robustezza-del-laboratorio--12092026).

Preparazione delle viste 12/09/2026, base `0a807adb`: i due orchestratori delle liste espongono dismissione e consumatori annullabili; il futuro chiamante deve collegarli a blocco/logout/cambio UID. Nessuna variazione del ciclo crittografico produttivo. [Audit §17](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-17-primo-adattamento-degli-orchestratori-reali--12092026).

Coordinamento sperimentale 12/09/2026, base `d906fd50`: il bootstrap candidato consegna lettori per vista, non chiavi; UID e revisione sono ricontrollati dopo le letture. Test integrato con verifier/envelope v2 sintetici riuscito. Il lettore legacy conserva materiale testuale/keyring in RAM; la CryptoKey della demo rimane una fixture distinta. [Audit §19](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-19-coordinamento-identità-vault-e-viste--12092026).

Prova emulata 12/09/2026, base `0e07621d`: login Firebase distinto da sblocco v2, secondo utente richiede la propria Master Password, logout invalida viste/letture. Vault senza envelope respinto senza provisioning. Parametri KDF e formati originali invariati; test con sole credenziali sintetiche. [Audit §20](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).

Prova browser locale 12/09/2026, base `83dffc30`: il prompt Master annullabile cancella input e listener dopo uso; SDK Auth in memoria, sblocco v2 e letture per UID. Formati e parametri originali invariati. Nessuna attivazione produttiva. [Audit §21](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-21-interfaccia-browser-degli-emulatori--12092026).

Integrazione delle liste, 12/09/2026: capacità readField iniettata per montaggio, senza consegnare chiavi al renderer; il percorso candidato esclude il gestore della sessione legacy. Password lazy, letture revocabili e copie dei campi visibili solo in memoria. Il runtime pubblicato resta invariato. [Audit §22](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-22-liste-canoniche-e-repository-negli-emulatori--12092026).

Integrazione del dettaglio base, 12/09/2026: il repository consegna ciphertext a un lettore limitato al proprietario e alla vista; password lazy senza esporre record o chiavi al dettaglio. Controlli anche nell’ultima continuazione prima di mostra/copia. Nessun formato o parametro crittografico modificato. [Audit §23](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-23-dettaglio-base-protetto-e-ritorno-alla-lista--12092026).

Estensione locale del lettore di dettaglio, 12/09/2026: note e url aggiunti alla allowlist cifrata; errori dei campi aggiuntivi sanitizzati e plaintext rimosso al blocco. Nessuna migrazione di chiavi o parametri. [Audit §24](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-24-identità-dei-record-e-campi-aggiuntivi-del-dettaglio--12092026).

Capacità sperimentale di cifratura, base `b792b1c0`: la vista prepara ciphertext tramite sessione in RAM, con invalidazione del risultato dopo blocco/cambio identità; chiavi non esposte. Formato originale invariato, cancellazione campi vuoti e writer restano da integrare. [Audit §25](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-25-preparazione-cifrata-delle-modifiche-nella-sessione-in-ram--12092026).

Candidato locale 12/09/2026: `softLock`, `clearSession` e `resetVault` emettono `vault-session-locked` dopo aver azzerato la chiave e cancellato la sessione locale. L'evento non contiene UID, chiavi o altri dati; la sola pulizia tecnica `clearVaultSession` non lo emette. I widget Account lo usano per dismettere viste e dialoghi anche quando Firebase mantiene lo stesso UID. Nessuna variazione a formati, parametri crittografici o contratto delle chiavi; nessuna pubblicazione implicita.

<a id="fonte-docs-vault-key-contract-md-proprietà-delle-capability-della-coda--candidato-14092026"></a>

#### Proprietà delle capability della coda — candidato 14/09/2026

Nel laboratorio della shell persistente, memory-vault e protected-session collegano il ciclo della coda alla generazione del Vault e all'UID. La factory fidata è configurata nel costruttore dal bootstrap, mai ricevuta da una route; la facciata restituisce soltanto i metodi previsti e non espone materiale crittografico o proprietà della factory. Lock e cambio generazione revocano le facciate e chiudono anche client arrivati tardi. È un vincolo dell'implementazione candidata, non una protezione da codice applicativo compromesso né un azzeramento fisico della memoria. Prove e limiti: audit 78 e M6. Nessun nuovo formato o persistenza delle chiavi.
