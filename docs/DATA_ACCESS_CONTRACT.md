# Contratto di accesso dati local-first

> **Stato:** letture attive e cutover M6 limitato.
> **Autorità:** contratto specialistico; prevale la baseline sicurezza.
> **Revisione:** 12/09/2026, documentazione v1.1; riferimento applicativo v1.2.110, commit `fa555d49d45e3a3545d09bc862645e84ba386862`.
> **Area:** repository e accesso dati.
> **Dipendenze:** [Guida progetto](./GUIDA_PROGETTO.md) e contratti d’area collegati nel testo.
> **Sostituisce:** la precedente revisione di questo file; nessun nuovo contratto. Audit e collaudi mantengono le date originali.

Contratto introdotto in M2 per separare progressivamente le pagine dalla cache e dalla rete.

## Percorso canonico

`pagina → vault-repository → offline-firestore → cache persistente Firestore / server`

- La pagina richiede dati di dominio e non sceglie la sorgente.
- `vault-repository.js` centralizza percorsi e query ricorrenti.
- `request-coordinator.js` accorpa richieste contemporanee con la stessa chiave semantica.
- `offline-firestore.js` restituisce prima la cache valida; online aggiorna Firestore in background oppure usa il server quando la cache manca.
- Non viene aggiunta una cache applicativa permanente: si evita di avere due fonti locali discordanti.

## Regole

1. La chiave di deduplicazione include dominio, UID e identificatori necessari.
2. Una Promise viene rimossa appena conclusa, anche in errore; una lettura successiva può quindi ottenere dati aggiornati.
3. Utenti, aziende e record diversi non possono condividere la stessa Promise.
4. I domini già adottati usano il percorso M6; gli altri mantengono i percorsi esistenti e le relative limitazioni. Nessuna estensione è implicita nel contratto di lettura.
5. Un errore di refresh remoto non deve cancellare un risultato locale valido.
6. Nessun dato decifrato viene conservato dal repository.
7. La lettura remota/cache può essere condivisa, ma ogni consumatore riceve nuovi oggetti: la decifratura o la normalizzazione di una pagina non contamina le altre.

## Domini migrati nel primo incremento M2

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

## Consumo delle liste durante il cambio vista — 12/09/2026

Su base `0a807adb`, le due liste canoniche mantengono il repository corrente ma invalidano il consumatore quando la vista viene smontata. Le richieste già inviate possono terminare; non vengono promesse cancellazione remota o revoca di scritture in corso. La chiusura annulla listener e impedisce render tardivi. Nessun nuovo cache o schema. [Audit §17](./AUDIT_VAULT_SESSION_P0.md#17-primo-adattamento-degli-orchestratori-reali--12092026).

Integrazione sperimentale 12/09/2026, base `4c1d90b5`: gli orchestratori canonici usano nel solo laboratorio un repository sintetico senza rete, con clonazione e dismissione per contesto; il repository produttivo resta invariato. [Audit §18](./AUDIT_VAULT_SESSION_P0.md#18-orchestratori-canonici-nel-laboratorio--12092026).

Collegamento SDK sperimentale 12/09/2026: `firebase-session.mjs` usa letture dirette soltanto nel laboratorio per il collaudo Auth/Rules. Non sostituisce né duplica una cache del repository canonico nell’app; la successiva integrazione browser dovrà passare dal repository. [Audit §20](./AUDIT_VAULT_SESSION_P0.md#20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).

Laboratorio browser 12/09/2026, base `83dffc30`: UI collegata al lettore SDK emulato; nessuna cache persistente o scrittura utente dalla pagina. Il repository canonico resta da integrare: questa prova non ne autorizza la sostituzione. [Audit §21](./AUDIT_VAULT_SESSION_P0.md#21-interfaccia-browser-degli-emulatori--12092026).

Integrazione browser successiva, 12/09/2026: gli orchestratori canonici usano vault-repository, offline-firestore e request-coordinator originali collegati agli SDK emulati; il build verifica tali dipendenze. Nessuna sostituzione del repository con fixture, nessun cutover offline o nuova scrittura attivata. [Audit §22](./AUDIT_VAULT_SESSION_P0.md#22-liste-canoniche-e-repository-negli-emulatori--12092026).

Prova dettaglio base, 12/09/2026: getPrivateAccount/getCompanyAccount canonici alimentano un lettore per UID con controlli prima/dopo fetch e decifratura. Finding aperto: lo spread dei dati nel repository può sovrascrivere snapshot.id con data.id; il nuovo lettore non usa tale ID per scegliere il percorso, ma la normalizzazione globale richiede verifica di compatibilità legacy. [Audit §23](./AUDIT_VAULT_SESSION_P0.md#23-dettaglio-base-protetto-e-ritorno-alla-lista--12092026).

Correzione candidata locale 12/09/2026: il mapper applica snapshot.id dopo lo spread del payload in liste e letture singole; il lookup legacy conserva where(id==alias) ma restituisce ID fisico e nuove copie per consumer. Il dettaglio privato deve risolvere il record prima delle azioni. Resta il gate di compatibilità per sottocollezioni/relazioni precedentemente riferite ad alias; nessuna bonifica automatica. [Audit §24](./AUDIT_VAULT_SESSION_P0.md#24-identità-dei-record-e-campi-aggiuntivi-del-dettaglio--12092026).

Preparazione locale, base `b792b1c0`: patch cifrata prodotta senza repository di scrittura o persistenza. Evidenza hasProfileLink fornita esplicitamente dal chiamante; non sostituisce controllo delle relazioni backend. Il futuro writer deve mantenere revisioni/idempotenza e verificare lo schema titolo/URL. [Audit §25](./AUDIT_VAULT_SESSION_P0.md#25-preparazione-cifrata-delle-modifiche-nella-sessione-in-ram--12092026).

Integrazione sperimentale base `6432cad8`: preparatore di operazioni M6 e prova del backend originale su Firestore emulato. Nessun nuovo accesso dati attivato; il controllo delle relazioni correnti sul server rimane aperto. [Audit §26](./AUDIT_VAULT_SESSION_P0.md#26-preparazione-m6-e-transazione-originale-su-dati-emulati--12092026).

Modulo modifica azienda, 12/09/2026: lettura puntuale getCompanyConfirmed online per stabilire una base aggiornata prima della transazione. Offline rimane getCompany; errore server non è sostituito da cache obsoleta. Liste e consultazione mantengono il percorso local-first. [Audit §27](./AUDIT_VAULT_SESSION_P0.md#27-falso-conflitto-nella-modifica-dei-contatti-azienda--12092026).

Prova locale base `1b6a13ed`: riconciliazione di una singola operazione in RAM tramite lookup puntuale iniettato. Assenza del documento esito non prova mancato salvataggio; il namespace operationResults attuale non è esclusivo del backend. Nessun nuovo repository persistente o accesso client attivato. [Audit §29](./AUDIT_VAULT_SESSION_P0.md#29-esito-incerto-retry-e-verifica-del-salvataggio--12092026).

Dati azienda dopo scrittura: afterWrite e callback di modifica collegamenti richiedono getCompanyConfirmed. Il flag è consumato dopo rendering riuscito; errore o offline non dichiarano aggiornata una copia vecchia. Richieste e callback sono vincolati alla vista. [Audit §30](./AUDIT_VAULT_SESSION_P0.md#30-dati-azienda-aggiornati-dopo-il-salvataggio--12092026).
