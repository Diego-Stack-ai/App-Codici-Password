# Dati

## Promemoria correnti — PROMEMORIA-06, 26/09/2026

La Home proietta in lettura un solo promemoria per identità della scadenza nella raccolta dell'utente. Gli eventi di una data precedente non appartengono al ciclo corrente; a parità di data prevale lo stage con meno giorni memorizzati, poi il timestamp e un ordinamento deterministico. Lo stato corrente risolto non fa riapparire stage precedenti; un avviso già visto resta consultabile come tale fino alle Urgenze. Giorni e data visualizzati provengono dalla scadenza corrente e dal calendario locale: «Scade oggi» per tutta la giornata, urgente dal giorno dopo, secondo DECISIONI. Rendering paginato a 10 correnti, senza eliminare i successivi; eventi persistiti, sorgente e politiche email/push invariati. L'aggiornamento Home avviene al ritorno visibile, periodicamente quando visibile e al cambio giorno, con invalidazione su sessione/blocco/pagehide. Nessuna garanzia di refresh remoto quando offline; test e limiti in COLLAUDI.

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Indice delle fonti conservate

- [DATA_ACCESS_CONTRACT.md](#fonte-docs-data-access-contract-md-l1)
- [FUNCTIONAL_DATA_CONTRACT.md](#fonte-docs-functional-data-contract-md-l1)

<a id="fonte-docs-data-access-contract-md-l1"></a>

## Fonte: DATA_ACCESS_CONTRACT.md — righe originali 1–93

> Provenienza: `docs/DATA_ACCESS_CONTRACT.md` a `2900ccc0`.

<a id="fonte-docs-data-access-contract-md-contratto-di-accesso-dati-local-first"></a>

## Contratto di accesso dati local-first

> **Stato:** letture attive e cutover M6 limitato.
> **Autorità:** contratto specialistico; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** repository e accesso dati.
> **Dipendenze:** [Guida progetto](../LEGGIMI.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

Contratto introdotto in M2 per separare progressivamente le pagine dalla cache e dalla rete.

<a id="fonte-docs-data-access-contract-md-percorso-canonico"></a>

### Percorso canonico

Aggiornamento candidato 15/09/2026, base `2686b48e`: il preparatore offline canonico deduplica per UID e la shell lo avvia senza visita preventiva alle pagine. Nessuna cache aggiuntiva o decifratura nel preparatore. Prove e limiti nel [contratto M6](OFFLINE.md#fonte-docs-m6-sincronizzazione-offline-md-preparazione-automatica-nella-shell--candidata-15092026).

`pagina → vault-repository → offline-firestore → cache persistente Firestore / server`

- La pagina richiede dati di dominio e non sceglie la sorgente.
- `vault-repository.js` centralizza percorsi e query ricorrenti.
- `request-coordinator.js` accorpa richieste contemporanee con la stessa chiave semantica.
- `offline-firestore.js` restituisce prima la cache valida; online aggiorna Firestore in background oppure usa il server quando la cache manca.
- Non viene aggiunta una cache applicativa permanente: si evita di avere due fonti locali discordanti.

<a id="fonte-docs-data-access-contract-md-regole"></a>

### Regole

1. La chiave di deduplicazione include dominio, UID e identificatori necessari.
2. Una Promise viene rimossa appena conclusa, anche in errore; una lettura successiva può quindi ottenere dati aggiornati.
3. Utenti, aziende e record diversi non possono condividere la stessa Promise.
4. I domini già adottati usano il percorso M6; gli altri mantengono i percorsi esistenti e le relative limitazioni. Nessuna estensione è implicita nel contratto di lettura.
5. Un errore di refresh remoto non deve cancellare un risultato locale valido.
6. Nessun dato decifrato viene conservato dal repository.
7. La lettura remota/cache può essere condivisa, ma ogni consumatore riceve nuovi oggetti: la decifratura o la normalizzazione di una pagina non contamina le altre.

<a id="fonte-docs-data-access-contract-md-domini-migrati-nel-primo-incremento-m2"></a>

### Domini migrati nel primo incremento M2

- lista Account privati e contatori della relativa dashboard;
- inviti accettati e record condivisi collegati;
- Top Account privati;
- contatti della dashboard privata;
- lista Aziende;
- lista Account di una singola Azienda;
- lista Scadenze.
- Profilo, impostazioni del Profilo e widget;
- dettaglio Account aziendale, Dati azienda e caricamento del form Azienda;
- lettura principale del dettaglio Account privato, mantenendo il fallback per gli ID legacy.
- form Account privato e aziendale: caricamento del record in modifica e rubrica destinatari;
- pagina Impostazioni: profilo, configurazione QR e widget del profilo.
- configurazioni Scadenze per automezzi, documenti e generali;
- creazione/modifica Scadenza: configurazioni, profilo, rubrica e record in modifica;
- dettaglio Scadenza e relativo stato di notifica.
- Home: profilo, Aziende, Scadenze e casella notifiche;
- indice locale dell'Agente Codex;
- allegati degli Account aziendali.

Tutti i moduli applicativi passano ora dal repository. `offline-firestore.js` resta confinato all'infrastruttura del repository.

Il cutover M6 è attivo per Account e memorandum privati isolati. Banca, condivisioni e collegamenti Profilo non rientrano in quel percorso. Revisioni, idempotenza, conflitti e gate ancora aperti sono definiti in `OFFLINE_WRITE_CONFLICT_POLICY.md` e `M6_SINCRONIZZAZIONE_OFFLINE.md`. La consultazione offline completa non è certificata.

<a id="fonte-docs-data-access-contract-md-consumo-delle-liste-durante-il-cambio-vista--12092026"></a>

### Consumo delle liste durante il cambio vista — 12/09/2026

Su base `0a807adb`, le due liste canoniche mantengono il repository corrente ma invalidano il consumatore quando la vista viene smontata. Le richieste già inviate possono terminare; non vengono promesse cancellazione remota o revoca di scritture in corso. La chiusura annulla listener e impedisce render tardivi. Nessun nuovo cache o schema. [Audit §17](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-17-primo-adattamento-degli-orchestratori-reali--12092026).

Integrazione sperimentale 12/09/2026, base `4c1d90b5`: gli orchestratori canonici usano nel solo laboratorio un repository sintetico senza rete, con clonazione e dismissione per contesto; il repository produttivo resta invariato. [Audit §18](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-18-orchestratori-canonici-nel-laboratorio--12092026).

Collegamento SDK sperimentale 12/09/2026: `firebase-session.mjs` usa letture dirette soltanto nel laboratorio per il collaudo Auth/Rules. Non sostituisce né duplica una cache del repository canonico nell’app; la successiva integrazione browser dovrà passare dal repository. [Audit §20](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).

Laboratorio browser 12/09/2026, base `83dffc30`: UI collegata al lettore SDK emulato; nessuna cache persistente o scrittura utente dalla pagina. Il repository canonico resta da integrare: questa prova non ne autorizza la sostituzione. [Audit §21](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-21-interfaccia-browser-degli-emulatori--12092026).

Integrazione browser successiva, 12/09/2026: gli orchestratori canonici usano vault-repository, offline-firestore e request-coordinator originali collegati agli SDK emulati; il build verifica tali dipendenze. Nessuna sostituzione del repository con fixture, nessun cutover offline o nuova scrittura attivata. [Audit §22](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-22-liste-canoniche-e-repository-negli-emulatori--12092026).

Prova dettaglio base, 12/09/2026: getPrivateAccount/getCompanyAccount canonici alimentano un lettore per UID con controlli prima/dopo fetch e decifratura. Finding aperto: lo spread dei dati nel repository può sovrascrivere snapshot.id con data.id; il nuovo lettore non usa tale ID per scegliere il percorso, ma la normalizzazione globale richiede verifica di compatibilità legacy. [Audit §23](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-23-dettaglio-base-protetto-e-ritorno-alla-lista--12092026).

Correzione candidata locale 12/09/2026: il mapper applica snapshot.id dopo lo spread del payload in liste e letture singole; il lookup legacy conserva where(id==alias) ma restituisce ID fisico e nuove copie per consumer. Il dettaglio privato deve risolvere il record prima delle azioni. Resta il gate di compatibilità per sottocollezioni/relazioni precedentemente riferite ad alias; nessuna bonifica automatica. [Audit §24](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-24-identità-dei-record-e-campi-aggiuntivi-del-dettaglio--12092026).

Preparazione locale, base `b792b1c0`: patch cifrata prodotta senza repository di scrittura o persistenza. Evidenza hasProfileLink fornita esplicitamente dal chiamante; non sostituisce controllo delle relazioni backend. Il futuro writer deve mantenere revisioni/idempotenza e verificare lo schema titolo/URL. [Audit §25](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-25-preparazione-cifrata-delle-modifiche-nella-sessione-in-ram--12092026).

Integrazione sperimentale base `6432cad8`: preparatore di operazioni M6 e prova del backend originale su Firestore emulato. Nessun nuovo accesso dati attivato; il controllo delle relazioni correnti sul server rimane aperto. [Audit §26](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-26-preparazione-m6-e-transazione-originale-su-dati-emulati--12092026).

Modulo modifica azienda, 12/09/2026: lettura puntuale getCompanyConfirmed online per stabilire una base aggiornata prima della transazione. Offline rimane getCompany; errore server non è sostituito da cache obsoleta. Liste e consultazione mantengono il percorso local-first. [Audit §27](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-27-falso-conflitto-nella-modifica-dei-contatti-azienda--12092026).

Prova locale base `1b6a13ed`: riconciliazione di una singola operazione in RAM tramite lookup puntuale iniettato. Assenza del documento esito non prova mancato salvataggio; il namespace operationResults attuale non è esclusivo del backend. Nessun nuovo repository persistente o accesso client attivato. [Audit §29](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-29-esito-incerto-retry-e-verifica-del-salvataggio--12092026).

Candidato base `a795b462`: il lookup emulato usa il nuovo percorso backend `/mutationResults/{uid}/operations/{operationId}` e richiede anche l'identità dell'operazione. Le conferme storiche non vengono usate come prova o replicate automaticamente. Integrazione repository/UI e recupero pregresso ancora aperti; nessun nuovo percorso attivato sul sito pubblico. [Audit §32](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-32-provenienza-e-identità-degli-esiti-di-salvataggio--12092026).

Dati azienda dopo scrittura: afterWrite e callback di modifica collegamenti richiedono getCompanyConfirmed. Il flag è consumato dopo rendering riuscito; errore o offline non dichiarano aggiornata una copia vecchia. Richieste e callback sono vincolati alla vista. [Audit §30](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-30-dati-azienda-aggiornati-dopo-il-salvataggio--12092026).

<a id="fonte-docs-data-access-contract-md-modulo-azienda-base-aggiornata-per-la-modifica--v12111"></a>

#### Modulo azienda: base aggiornata per la modifica — v1.2.111

Online il modulo modifica azienda usa `getCompanyConfirmed`, una lettura confermata dal server attraverso il repository, prima di abilitare Salva. Una risposta mancante o fallita non viene sostituita dalla copia obsoleta. Offline resta `getCompany`; liste e consultazione mantengono il percorso local-first. Il controllo transazionale confronta i valori dei contatti senza dipendere dall’ordine delle chiavi delle mappe, preservando conflitti reali e collegamenti Account. Nessuna modifica del mapper degli identificativi o dei dati persistiti.

<a id="fonte-docs-data-access-contract-md-dati-azienda-dopo-scrittura--v12112"></a>

#### Dati azienda dopo scrittura — v1.2.112

Dopo creazione/modifica il dettaglio usa getCompanyConfirmed su afterWrite=1, consumato soltanto dopo rendering riuscito. Callback dei collegamenti usano la stessa lettura confermata; errori e offline preservano la richiesta di refresh senza dichiarare aggiornata la vecchia cache. Navigazione ordinaria invariata. Generazione della vista e delle richieste distinte impediscono aggiornamenti tardivi senza bloccare il retry nella stessa vista.

<a id="fonte-docs-functional-data-contract-md-l1"></a>

## Fonte: FUNCTIONAL_DATA_CONTRACT.md — righe originali 1–112

> Provenienza: `docs/FUNCTIONAL_DATA_CONTRACT.md` a `2900ccc0`.

<a id="fonte-docs-functional-data-contract-md-contratto-funzionale-e-dati--baseline-m0"></a>

## Contratto funzionale e dati — baseline M0

> **Stato:** baseline M0 con integrazioni successive.
> **Autorità:** contratto funzionale subordinato alla baseline sicurezza; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** domini funzionali e compatibilità.
> **Dipendenze:** [Guida progetto](../LEGGIMI.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

> **Aggiornamento di lettura:** baseline M0 v1.2.49 con integrazioni funzionali successive. Le tabelle storiche non certificano l’offline corrente. Alla v1.2.110 valgono il cutover privato isolato M6, i profili a linguette e il ricevitore pubblico del contatto; stato e limiti sono descritti nei contratti M6 e Profilo/Account/Widget. Nessuna migrazione generale dei campi è implicita.

> Fotografia dell'app alla versione 1.2.49. Questo documento descrive il comportamento da preservare; non dichiara ideale l'accesso diretto a Firebase presente in alcune pagine.

<a id="fonte-docs-functional-data-contract-md-regole-trasversali"></a>

### Regole trasversali

- L'identità remota è Firebase Auth; la Master Password sblocca localmente la Vault Key e non coincide con la password Firebase.
- I dati sensibili devono arrivare alla UI soltanto dopo lo sblocco della Vault e passare dalle API crittografiche condivise.
- L'email è l'identificatore umano di destinatari e invitati; la risoluzione email → UID avviene nel backend quando necessaria.
- La consultazione offline riguarda shell e dati già sincronizzati. Gli allegati non sono garantiti offline; Push, email e risoluzione inviti richiedono rete.
- Logout, cambio utente e blocco devono eliminare dalla sessione il materiale crittografico previsto.

<a id="fonte-docs-functional-data-contract-md-mappa-delle-aree"></a>

### Mappa delle aree

| Area visibile | Entrata/modulo principale | Dati remoti attuali | Contratto da preservare |
|---|---|---|---|
| Login, registrazione, recupero | `login-v115.html`, `registrati.html`, `reset_password.html`, moduli `auth/*` | Firebase Auth; `users/{uid}`; funzioni MFA | Login, 2FA, recupero e rotazione password senza esporre Master Password o codici |
| Sblocco Vault | `modules/core/security-manager.js`, `vault-session.js` | `users/{uid}/settings/security`; campi compatibili in `users/{uid}` | verifier, envelope, WebAuthn/PRF e fallback legacy controllato |
| Home | `home_page.html`, `modules/home/home.js` | profilo, `aziende`, `scadenze`, `deadlineNotifications` | accesso rapido, conteggi, avvisi pendenti e Agente locale senza bloccare il primo contenuto |
| Area privata | `area_privata.html`, `modules/privato/area_privata.js` | `users/{uid}/accounts`, `contacts`, inviti top-level | riepilogo, account frequenti, contatti e inviti |
| Account privati | lista/form/dettaglio in `modules/privato/*account*` | `users/{uid}/accounts/{accountId}` e sotto-collezione `attachments` | card consultabili, segreti su richiesta, memorandum, archivio e condivisione |
| Aziende | `lista_aziende.html`, `dati_azienda.html`, `modifica_azienda.html` | `users/{uid}/aziende/{aziendaId}` | anagrafica, contatti, dati bancari, note e allegati cifrati |
| Account aziendali | lista/form/dettaglio in `modules/azienda/*account*` | `users/{uid}/aziende/{aziendaId}/accounts/{accountId}` e `attachments` | stesso contratto Account, mantenendo il contesto aziendale |
| Profilo personale | `profilo_privato.html`, `modules/privato/profilo_privato.js` e moduli `profilo-*` | `users/{uid}`, `profileWidgets`, `settings/profileLabels`, `settings/qrCodeInclusions` | identità, recapiti, documenti, indirizzi, widget, QR e collegamenti ad Account/Scadenze |
| Scadenze | lista/form/dettaglio in `modules/scadenze/*` | `users/{uid}/scadenze/{deadlineId}`; `users/{uid}/receivedDeadlines/{receivedDeadlineId}` | scadenze proprie e ricevute; il destinatario può consultare o gestire solo quando autorizzato, senza ricevere allegati o accesso al documento originale |
| Regole Scadenze | configurazioni `scadenze/configurazione_*` | `settings/deadlineConfig`, `deadlineConfigDocuments`, `generalConfig` | anticipo, frequenza, tipi, modelli e template senza alterare le scadenze esistenti |
| Destinatari | `gestione_destinatari.html`, `modules/shared/gestione-destinatari.js` | `users/{uid}/contacts/{contactId}` | rubrica unica riusabile; email normalizzata e cancellazione bloccata se in uso |
| Credenziali comuni | Impostazioni e dettaglio Account | `users/{uid}/sharedVaultData`, `sharedVaultLinks`, `accountWidgets` | valori centrali cifrati; collegamenti atomici; nessuna eredità automatica nelle condivisioni Account |
| Condivisioni | form/dettagli Account, `main-v129.js`, callable `respondToInvitation` | `invites/{inviteId}`; `sharedWith`, `sharedWithUids`; notifiche utente | pending/accetta/rifiuta/revoca; nessuna enumerazione utenti; record accessibile solo nell'app |
| Notifiche Scadenze | Home, service worker, backend | `deadlineNotifications`, `receivedDeadlines`, `pushDevices`, log di consegna | proprietario retrocompatibile; destinatari con Email/Push indipendenti; Push e pulsante email aprono la copia ricevuta; errori di un canale non bloccano l'altro |
| Archivio | `archivio_account.html`, `modules/settings/archivio_account.js` | Account privati e aziendali con `isArchived` | consultazione e ripristino senza confondere archivio con cancellazione definitiva |
| Impostazioni | `impostazioni.html`, `modules/settings/impostazioni.js` | `users/{uid}` e documenti `settings/*` | preferenze UI, area Azienda, 2FA, biometria, Push e sicurezza |
| Ricerca/Agente Codex | `modules/assistant/*` | profilo, Account, Aziende e Scadenze dell'utente | ricerca locale dopo sblocco, nessun invio di segreti a servizi AI remoti |
| Allegati | moduli dettaglio/form e Firebase Storage | `users/{uid}/.../attachments/*`; oggetti Storage sotto `users/{uid}` | upload/download cifrato, limiti tipo/dimensione; non inclusi automaticamente nell'offline |
| OCR sperimentale | `experiments/card-importer` | nessun dato produttivo richiesto | prototipo isolato; estrazione proposta all'utente, mai salvataggio automatico di segreti |

<a id="fonte-docs-functional-data-contract-md-strutture-critiche-attuali"></a>

### Strutture critiche attuali

```text
users/{uid}
users/{uid}/settings/{settingId}
users/{uid}/accounts/{accountId}
users/{uid}/accounts/{accountId}/attachments/{attachmentId}
users/{uid}/aziende/{aziendaId}
users/{uid}/aziende/{aziendaId}/accounts/{accountId}
users/{uid}/aziende/{aziendaId}/accounts/{accountId}/attachments/{attachmentId}
users/{uid}/scadenze/{deadlineId}
users/{uid}/contacts/{contactId}
users/{uid}/profileWidgets/{widgetId}
users/{uid}/notifications/{notificationId}
users/{uid}/deadlineNotifications/{notificationId}
users/{uid}/receivedDeadlines/{receivedDeadlineId}
users/{uid}/pushDevices/{deviceId}
invites/{inviteId}
```

Le Scadenze nuove usano `recipients[]` con `contactId?`, `displayName`, `email`, `sendEmail`, `sendPush`, `canManage`; `emails[]`, `email1` ed `email2` restano letti come formato legacy. Per un destinatario registrato con Push o permesso di gestione, il backend mantiene una copia minima in `receivedDeadlines`: il client può leggerla ma non scriverla. La callable `manageReceivedDeadline` verifica identità, email e permesso corrente prima di segnare l'originale come completato o aggiornarne la data. Le condivisioni Account usano invece `sharedWith`, `sharedWithUids` e inviti con `recipientEmail`; gli UID accettati non sostituiscono l'email nell'interfaccia.

Il backend conserva inoltre in `deadlineShares/{shareId}` l'elenco tecnico degli UID destinatari già risolti. Il client non accede a questa collezione: serve esclusivamente a eliminare in modo affidabile le copie revocate o cancellate anche quando l'email dell'utente non è più risolvibile.

<a id="fonte-docs-functional-data-contract-md-collegamento-documenti-profilo--scadenze"></a>

### Collegamento documenti Profilo → Scadenze

Il comando nel Profilo distingue tre stati: creare una nuova scadenza, collegare una scadenza legacy compatibile oppure aprire una scadenza già collegata. Una corrispondenza esplicita usa `sourceRef: {type: 'profileDocument', id}`; per i record anteriori al collegamento, categoria e data uguali producono soltanto una proposta confermata dall'utente. Più corrispondenze bloccano la creazione automatica per evitare associazioni ambigue.

La precompilazione mantiene separati i significati dei campi: il nominativo proviene da nome e cognome del Profilo, la categoria dal tipo di documento, il dettaglio dal tipo e dal numero identificativo, la data da `expiry_date` e il testo email dal template associato alla categoria. Una nuova scadenza collegata e il suo `expiryReference` nel documento Profilo vengono salvati nello stesso batch.

I nominativi digitati nelle Scadenze restano suggerimenti storici nelle configurazioni `names`; non sono utenti né Contatti. Il form consente di eliminare esplicitamente il nominativo selezionato dalla lista del contesto corrente, con conferma. Un nominativo proveniente dalla Rubrica va invece gestito nei Contatti e non viene cancellato indirettamente.

<a id="fonte-docs-functional-data-contract-md-confini-offline"></a>

### Confini offline

| Operazione | Offline atteso |
|---|---|
| Aprire shell già installata e sessione conservata | sì |
| Consultare dati già sincronizzati e sbloccare la Vault | sì, se il metodo di sblocco locale è disponibile |
| Ricerca locale sui dati sincronizzati | sì |
| Scaricare un allegato mai aperto | no |
| Inviare email/Push, risolvere destinatari o accettare inviti | no; ripresa con rete |
| Scrivere/modificare record | solo per i domini adottati da M6; non è una garanzia generale per tutti i record |
| Eliminare una Scadenza collegata a un documento del Profilo (candidato) | richiede rete: cancellazione e scollegamento esatto avvengono nella stessa transazione, preservando modifiche e collegamenti più recenti |

<a id="fonte-docs-functional-data-contract-md-gate-per-le-rifattorizzazioni"></a>

### Gate per le rifattorizzazioni

Ogni sostituzione deve conservare: percorso dati leggibile, schema legacy, Rules, cifratura, navigazione diretta, consultazione offline prevista e test. Un vecchio percorso può essere rimosso soltanto dopo confronto con questo catalogo e collaudo sul dataset M0.

I budget statici sono applicati da `npm run test:performance-budget`. Gli obiettivi runtime in `scripts/page-performance-budget.json` diventano bloccanti soltanto dopo una baseline ripetibile su dispositivi reali; fino ad allora non costituiscono una dichiarazione delle prestazioni correnti.

La diagnostica runtime è attivabile nelle Impostazioni del singolo dispositivo. Conserva localmente al massimo 80 campioni con nome della fase, durata, pagina, stato rete e conteggi tecnici ammessi da una lista chiusa. Non registra contenuti, identificativi utente, email, URL visitati, token, credenziali o valori decifrati; disattivandola vengono cancellati i campioni persistiti.

<a id="fonte-docs-functional-data-contract-md-gate-reale-per-le-scadenze-ricevute"></a>

### Gate reale per le scadenze ricevute

Prima di dichiarare concluso il flusso condiviso occorre un collaudo con due account reali distinti: creare una scadenza con Email e Push attivi; verificare la copia in `receivedDeadlines`; aprire sia il deep link Push sia quello email; controllare il caso sola lettura; ripetere con `canManage`; completare o rinviare dal destinatario; verificare l'aggiornamento dell'originale e della copia; revocare il permesso; confermare il blocco delle modifiche successive. Le vecchie notifiche prive di `receivedDeadlineId` possono aprire la lista come compatibilità, ma non certificano il nuovo percorso.

<a id="fonte-docs-functional-data-contract-md-integrazione-account--candidata-12118-13092026"></a>

### Integrazione Account — candidata 1.2.118, 13/09/2026

Riferimento codice `4a431ec3`, dipendenze: guida UI e inventario cifratura. `banking[]` conserva i campi facoltativi `referenteNome` e `numeroVerde` nei due editor e nella consultazione. Il nome/telefono/cellulare del referente generale restano alla radice dell'Account; il solo referente generale non crea un conto bancario nell'editor. Restano leggibili oggetto bancario singolo e dati bancari legacy, incluso il Numero verde; nessuna migrazione automatica del database. La scorciatoia Widget bancaria usa l'editor dei Widget Account già esistente. Campi vuoti nascosti soltanto nella consultazione; una password composta di spazi resta un valore presente. Nessuna nuova pagina o estensione di permessi. [Audit §51](../storico/REGISTRO.md#fonte-docs-audit-vault-session-p0-md-51-integrazione-account-ui-e-vault--candidata-13092026).

<a id="fonte-docs-functional-data-contract-md-account-ui-12118--13092026"></a>

### Account UI 1.2.118 — 13/09/2026

Base `445b338d`, UI `d2ef897e` con correzioni di compatibilità. I campi facoltativi `banking[].numeroVerde` e `banking[].referenteNome` sono conservati nei due form; oggetto bancario singolo e formati legacy restano leggibili. Un referente generale da solo non crea una banca. Nessuna migrazione del database. I campi vuoti sono nascosti in consultazione; una password composta di spazi resta presente. Il selettore Widget usa i servizi già pubblicati, senza cambiamenti ai protocolli backend.

<a id="fonte-docs-functional-data-contract-md-posizione-dei-widget-bancari--candidata-12119-13092026"></a>

### Posizione dei Widget bancari — candidata 1.2.119, 13/09/2026

Sul ramo fix/banking-widget-placement, base master a6699e8d, banking[].bankId identifica stabilmente un conto all'interno dello stesso Account; accountWidgets.bankId opzionale collega un Widget embedded a quel conto. Il servizio manageAccountWidget verifica il target nella transazione, solo in banking[] dello stesso Account privato o aziendale e senza duplicati. Omissione in update conserva l'associazione precedente, null esplicito la rimuove; delete di un Widget orfano resta consentito. Nessuna assegnazione retroattiva ai Widget generici: la posizione si modifica esplicitamente nell'editor. Nuovo conto e formati legacy acquisiscono bankId al normale salvataggio del form; nessuna migrazione batch. Credenziali comuni mantengono il collegamento generale all'Account.
