# Censimento operativo dei gate MD M6–M10 ancora aperti — 21/09/2026

> **Stato:** censimento **documentale**, sola lettura sul ramo; **nessun gate è dichiarato chiuso** e
> nessuna prova locale lo chiude. Raccolto da DeepSeek su incarico Codex del 21/09/2026.
> **Ramo:** `integration/vault-shell-v127-security`, HEAD `de780b8e`, versione `1.2.127`.
> **Fonti:** `docs/PIANO_MATURITA_PROFESSIONALE.md` (programma M0–M10, lavori aperti e passaggi
> esterni), i contratti specialistici `M6_SINCRONIZZAZIONE_OFFLINE.md`, `M7_RETENTION_CENSIMENTO.md`,
> `M7_CRONOLOGIA_CESTINO_AUDIT.md`, `M8_BACKUP_RECUPERO.md`, `M9_SALUTE_CREDENZIALI.md`,
> `M10_HARDENING_RILASCIO.md`, più `PASSAGGIO_CONSEGNE_2026-09-16.md` e `AUDIT_PROGETTO_FASE2_STATICO.md`.
> **Perimetro:** nessun codice o test toccato, nessuna implementazione del passo consigliato, nessuna
> domanda nuova (le decisioni già raccolte restano nei file M7/M8 citati).

**Legenda dipendenze:** **Diego** = decisione di prodotto o collaudo fisico del proprietario ·
**Esterno** = accesso a console/credenziali/fornitore o audit indipendente · **Dispositivo** = prova
su iPhone/Windows reali · **Laboratorio** = lavoro autonomo possibile su dati sintetici ed emulatori.

## 1. Tabella dei gate

| # | Gate e fonte | Evidenza già presente | Che cosa manca | Dipendenza |
|---|---|---|---|---|
| M6-1 | Consultazione bancaria offline iPhone e matrice completa — `PIANO:387` | Matrice di laboratorio con due banche/carte sintetiche, cache preparata e mancante, lock/sblocco, cambio sezione e pulizia, riapertura con cache persistente; 4 esecuzioni `--entry-browser` e 2 `--restart-browser` su Chrome 152/Edge 153 desktop+mobile (`M6:432-450`) | PWA fisica su iPhone, cache espulsa, avvio a freddo, tutte le categorie di pagina di produzione, file Storage | **Dispositivo** (Diego) + **Laboratorio** per le parti non fisiche |
| M6-2 | Fallback senza Web Locks e collaudi dei dispositivi — `PIANO:388`; finding `F2-P1-07` in `AUDIT_PROGETTO_FASE2_STATICO.md:195-217` | Fallback di laboratorio completo: `acquireTimeoutMs`, rifiuto del lease tardivo, 9 scenari in Chrome 152/Edge 153 con `navigator.locks` realmente assente, 12 test unitari, 24 verifiche di coordinamento senza regressioni (`M6:420-430`) | **Adozione nel runtime**: `withOfflineQueueLease` (`Frontend/public/assets/js/modules/data/offline-mutation-queue.js:259-260`) continua a rifiutare con `OFFLINE_QUEUE_LOCKS_UNAVAILABLE`; distribuzione preparatoria delle copie PWA; trasporto autenticato/App Check reali; concorrenza reale fra schede e dispositivi | **Laboratorio** (progetto e prova) + **Diego/Codex** per l'attivazione nel runtime |
| M6-3 | Lettore compatibile, upgrade store, lease in tutte le scritture, copie PWA precedenti — `PIANO:537`, `M6:143-148`, `PIANO:551` | Lettore schemi 1 e 2 disponibile in laboratorio senza upgrade né scritture; 11 scenari browser in Chrome/Edge; prova reale che il lettore v1 rifiuta lo schema 2 | Integrazione delle **mutazioni** sotto il nuovo schema, upgrade dello store, gestione delle copie PWA precedenti e del rollback | **Laboratorio** + **Diego** per la distribuzione |
| M7-1 | Politica di retention complessiva approvata e verificata su dati, allegati e backup — `PIANO:396` | Censimento con matrice T-01…T-38 e decisioni D1–D16 proposte; comportamenti attuali verificati (T-08, T-09, T-16, T-21, T-23, T-24, T-26, T-27, T-28); retention **24 mesi** del registro tecnico **decisa** da Diego il 21/09 e implementata **solo nel ramo** (job, trigger, marcatori; nessun deploy) `M7_CRONOLOGIA:114-171` | Approvazione delle decisioni **D1–D16** (durata del cestino, allegati, backup, informazione all'utente, ordine di lavoro); bonifica dei record storici senza `at`; vista utente del registro; rilascio del job (cadenza, ambiente, monitoraggio, rollback); distribuzione delle Rules del ramo | **Diego** (decisione) + **Laboratorio** |
| M7-2 | Verifica esterna di TTL e lifecycle sul progetto — `PIANO:396`, `M7_RETENTION:635-660` | Sonda documentata con esito **`non verificato`**: `gcloud` assente, nessuna ADC, Firebase CLI non autenticato; i due comandi di completamento sono scritti nel censimento | Esecuzione di `gcloud firestore fields ttls list` e `gcloud storage buckets describe` con registrazione di fonte, data e output | **Esterno** (credenziali) |
| M7-3 | Protocollo condiviso purge/ripristino ↔ writer Account/Widget/link/inviti, Rules e backup; poi planner dei riferimenti residui — `PIANO:538` | Planner `functions/archive-purge-reference-plan.js` presente ma **non attivato**; effetti residui del purge verificati (copie condivise, widget, inviti) | Decisione di policy (D1–D16), definizione del protocollo condiviso, attivazione e distribuzione; collegamento del planner solo dopo | **Diego** + **Laboratorio** |
| M8-1 | Gestione completa delle interruzioni fra blocchi e allegati — `PIANO:404` | Verifiche di oggi: M8 (upload fallito → **riferimento senza byte**, 2/2), M8-bis (nuova sessione bloccata da «invariato»), M8-ter (CAS per blocco con **parzialità** nel flusso a più blocchi), M8-quater (collisioni multiple con selezione parziale) | Scelta fra staging, compensazione e ripresa (Q1–Q5, N1–N4, S1–S2 **aperte**), journal durevole, retry dei soli upload mancanti, applicazione della decisione | **Diego** (decisione) + **Laboratorio** |
| M8-2 | Staging e ripresa/rollback provati su copia non produttiva — `PIANO:405`, `M10:21` | Nessuna: lo staging **non è implementato** (`M7_RETENTION:489`), quindi non esistono residui da misurare | Implementazione (subordinata alla decisione) e prova di backup/cancellazione/ripristino su copia non produttiva | **Diego** + **Esterno** (copia) |
| M8-3 | Limiti di memoria e matrice fisica completa — `PIANO:406`, `PIANO:539` | Tetti dell'anteprima e messaggio dedicato (`44c7f077`); dichiarato che le soglie limitano i dati ammessi ma **non misurano lo heap** | Misura dello heap effettivo su backup grandi, iPhone e Windows | **Dispositivo** (Diego) |
| M9-1 | Collaudo fisico e accessibile su Windows — `PIANO:413`, `M9:31` | 20 test UI di tastiera, focus, Escape e invalidazione; iPhone certificato dal proprietario il 10/09 | Prova fisica Windows con screen reader (Narrator) | **Dispositivo** (Diego) |
| M9-2 | Provider violazioni, privacy e consenso prima di qualsiasi rete — `PIANO:414`, `M9:30`, `M9:14` | Contratto k-anonimo definito e testato **senza rete**; integrazione disattivata; impronte HMAC effimere e nessuna persistenza | Scelta del provider, verifica privacy/sicurezza, timeout, cache, formato di risposta e consenso | **Diego** (decisione) + **Esterno** |
| M10-1 | Revisione OWASP finale e audit indipendente di crittografia e condivisione — `PIANO:421`, `PIANO:424`, `M10:22` | Gate statici/emulatori verdi (header, CSP senza `unsafe-eval`, App Check, Rules, dipendenze), threat model e audit del 08/09 | Revisione OWASP finale sul codice e audit **indipendente** prima di dichiarare mature crittografia e condivisione | **Laboratorio** (revisione) + **Esterno** (audit) |
| M10-2 | Verifica in produzione: App Check Enforcement, Firestore/Storage Rules, indici, log; approvazione esplicita prima di modificare Rules/Functions/dati — `PIANO:422`, `M10:19-23` | Rules del ramo e controlli locali; confronto delle Rules distribuite documentato nell'audit Vault (`M10:17`), che **non** attesta l'enforcement | Lettura dalla console del progetto pubblicato (App Check, Rules, indici, log) e approvazione esplicita | **Esterno** (console) + **Diego** |
| M10-3 | Matrice end-to-end su iPhone, Windows e browser supportati, incluse rete lenta, offline, riapertura e overscroll — `PIANO:423`, `M10:20` | Smoke test del proprietario dell'8/09 sulla v1.2.64, dichiarato **non** sostitutivo della matrice (`M10:27-29`); 29 pagine canoniche e shell verificate a livello automatico | Matrice fisica firmata per dispositivo, sistema, browser, tema e condizioni di rete | **Dispositivo** (Diego) |
| M10-4 | Guida utente, revisione privacy finali e informazioni organizzative della risposta agli incidenti — `PIANO:425`, `M10:41-50`, `RISPOSTA_INCIDENTI_E_RECUPERO.md:48` | Procedura di risposta agli incidenti presente nel repository; checklist operativa di rilascio in 8 punti | Guida utente, revisione privacy finale, completamento delle informazioni organizzative; rollback identificato prima di un deploy | **Laboratorio** (bozza) + **Diego** |

## 2. Un solo prossimo passo autonomo consigliato

**M6-2 — provare in laboratorio l'adozione del coordinatore ibrido (lease + fallback senza Web Locks)
dietro l'interfaccia del runtime, senza modificare `Frontend/public/**`.**

- **Che cosa farebbe.** `withOfflineQueueLease(uid, task, locks)` accetta già un `locks` iniettabile
  (`offline-mutation-queue.js:259-260`) e `offline-mutation-client.js:16` lo collega come `withLease`.
  Il passo è un banco di laboratorio che esercita **la funzione del runtime** con il coordinatore
  ibrido iniettato nei due rami (Web Locks presente e assente), riusando i 9 scenari `--no-locks` e le
  24 verifiche di coordinamento già registrate, e una nota di adozione/rollback che elenca le copie
  PWA precedenti da aggiornare. **Non** attiva nulla e **non** tocca file distribuiti.
- **Perché è autonomo.** Nessuna decisione di prodotto pendente, nessun accesso esterno, nessun
  dispositivo fisico: usa solo laboratorio, browser headless e dati sintetici. Chiude un finding già
  censito (`F2-P1-07`) portando la prova dal candidato isolato all'interfaccia reale del runtime.
- **Criterio di uscita verificabile.** (a) banco nuovo verde nei due rami, accanto a
  `npm run test:offline-no-locks` e alla suite browser di coordinamento; (b)
  `git diff --name-only -- Frontend functions firestore.rules storage.rules` **vuoto**; (c)
  documento di adozione/rollback con l'elenco esplicito di ciò che resta a Diego (distribuzione
  preparatoria, collaudo fisico); (d) `npm test` completo verde.

*Questo censimento non autorizza il passo: lo valuta e lo assegna Codex. Gli altri gate restano come
in tabella.*

## 3. Che cosa questo censimento **non** fa

- **Non chiude alcun gate** e non considera i test locali una chiusura: i gate M0–M10 richiedono
  anche ambiente reale, dispositivi, decisioni di prodotto o audit esterni (`M10:25`).
- **Non duplica domande:** D1–D16 restano in `M7_RETENTION_CENSIMENTO.md`, le domande di ripristino
  in `M8_DOMANDE_RIPRISTINO_INTERROTTO.md`, `M8_DOMANDE_RIPRISTINO_NUOVA_SESSIONE.md`,
  `M8_DOMANDE_RIPRISTINO_CAS_PARZIALE.md`. **Nessuna nuova domanda** è stata raccolta qui.
- **Non modifica** codice, test, Rules, Functions, versione o dati; nessun deploy, push o merge.
- **Ricorda il vincolo vigente:** `PIANO:702-706` dichiara M6-CLOSE come incarico aperto e M7–M10
  **sospesi per decisione utente fino al 21/09/2026**; questo censimento non rimuove la sospensione,
  che può essere sciolta solo dal proprietario.
