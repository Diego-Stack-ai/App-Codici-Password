# Guida

> Revisione documentale: 23/09/2026. Base delle fonti: `2900ccc0bbd83997de8e50d260b1868f33bc5e38`.
> Indice e autorità: [LEGGIMI](../LEGGIMI.md). Stato verificato e limiti: [STATO](../progetto/STATO.md).

## Indice delle fonti conservate

- [M10_GUIDA_UTENTE_BOZZA.md](#fonte-docs-m10-guida-utente-bozza-md-l1)

<a id="fonte-docs-m10-guida-utente-bozza-md-l1"></a>

## Fonte: M10_GUIDA_UTENTE_BOZZA.md — righe originali 1–144

> Provenienza: `docs/M10_GUIDA_UTENTE_BOZZA.md` a `2900ccc0`.

<a id="fonte-docs-m10-guida-utente-bozza-md-m10-4--bozza-della-guida-utente-funzioni-effettivamente-presenti"></a>

## M10-4 — Bozza della guida utente (funzioni effettivamente presenti)

> **Stato:** **BOZZA di laboratorio** per la revisione di Diego. **Non** è una guida pubblicabile, **non**
> dichiara conclusi M6–M10, **non** sostituisce la revisione privacy/legale finale e **non** autorizza un
> go-live. M10-4 resta **aperto** (`docs/CENSIMENTO_GATE_M6_M10.md`, riga M10-4;
> `docs/PIANO_MATURITA_PROFESSIONALE.md:425`).
> **Base:** ramo `integration/vault-shell-v127-security`, HEAD `30b38835`, versione `1.2.127`.
> **Metodo:** solo fonti del repository, lette e citate; nessun dato reale; nessuna modifica a codice,
> test, Rules o Functions. Le informazioni organizzative sono **segnaposto** (nessun nome, impegno o
> termine inventato).

<a id="fonte-docs-m10-guida-utente-bozza-md-0-come-leggere-questa-bozza"></a>

### 0. Come leggere questa bozza

Ogni voce porta tre etichette:

- **[V] comportamento verificato** — provato da test/banchi presenti nel repository (con la fonte);
- **[C] comportamento candidato non distribuito** — esiste nel ramo di laboratorio, **non** è in
  produzione;
- **[E] prova esterna mancante** — richiede dispositivo fisico, console del progetto o audit esterno.

Le pagine canoniche sono **30** (`docs/CANONICAL_PAGE_REGISTRY.md`): ogni funzione visibile ha una sola
pagina e un solo modulo inizializzatore.

<a id="fonte-docs-m10-guida-utente-bozza-md-1-accesso-e-sicurezza-dellaccount"></a>

### 1. Accesso e sicurezza dell'account

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Registrazione, accesso, reset password | creazione account, accesso e recupero via Firebase Auth | `registrati.html`, `reset_password.html`, `imposta_nuova_password.html`, `login-v115.html` | [V] nei test di autenticazione; [E] matrice fisica |
| Sblocco del Vault con Master Password | deriva la chiave (KEK) e apre la chiave del Vault | `modules/core/crypto-utils.js` (PBKDF2-SHA256 600 000 per verificatore/KEK) | [V] |
| Sblocco biometrico (passkey/WebAuthn PRF) | secondo fattore locale con estensione PRF; fail-closed se il PRF non c'è | `modules/core/webauthn-manager.js`, `security-manager.js` | [V] nei test di laboratorio; [E] su dispositivo |
| Recupero MFA con codice | password + codice di recupero **monouso**, limite per email+IP, codice conservato per hash | `functions/index.js` (`recoverMfaWithCode`) | [V] lettura del codice e test Functions; [E] prova reale |
| Blocco, logout e pulizia | blocco del Vault e logout; viene cancellata la **sessione Vault in `sessionStorage`** (payload incapsulato, chiave di wrapping e due chiavi storiche), mentre bozze, cache IndexedDB, coda offline, `localStorage` e shell PWA **restano sul dispositivo** | `logout-session.js`, `vault-session.js:94-99` | [V] |
| Sessione cifrata nella scheda | la chiave del Vault è incapsulata; **la chiave di wrapping vive in `sessionStorage`** | `vault-session.js:3` (`getSessionKey`) | [V] come comportamento attuale; **[C]/[E]** la bonifica è il P0 noto (`AUDIT_VAULT_SESSION_P0.md`) |

> **Nota di trasparenza:** il P0 della chiave di wrapping in `sessionStorage` è **aperto** e va dichiarato
> all'utente nella versione finale, con il testo approvato dal proprietario (segnaposto Q1 in
> `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md`).

<a id="fonte-docs-m10-guida-utente-bozza-md-2-dati-personali-profilo-contatti-indirizzi-documenti"></a>

### 2. Dati personali: Profilo, contatti, indirizzi, documenti

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Profilo | anagrafica e contatti del proprietario, con valori sensibili protetti | `profilo_privato.html` → `modules/privato/profilo_privato.js` | [V] (include i banchi a freddo `--cold-browser`) |
| Contatti, telefoni, indirizzi, utenze | voci collegate o autonome, con campi cifrati | `modules/privato/*`, `modules/core/vault-repository.js` | [V] |
| Documenti privati con allegati immagine | metadato in Firestore, byte in Storage, protocollo di cancellazione non atomico | `docs/M7_RETENTION_CENSIMENTO.md` §5.1-5.3 | [V] comportamento attuale; **[E]** collaudo fisico |
| Widget di profilo | campi personalizzati, anche sensibili, con anteprima nascosta | `docs/M7_RETENTION_CENSIMENTO.md`, banchi `--cold-browser` | [V] |
| Card digitale, QR e PDF riepilogativo | proiezione scelta dall'utente; esclusioni verificate (nessun segreto nel QR aziendale) | banchi a freddo, `docs/M7_RETENTION_CENSIMENTO.md` §6.6 | [V] |

<a id="fonte-docs-m10-guida-utente-bozza-md-3-account-privati-e-aziendali"></a>

### 3. Account privati e aziendali

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Account privati | credenziali cifrate, note, URL, archiviazione, revisione per la coda offline | `area_privata.html`, `account_privati.html`, `form_account_privato.html`, `dettaglio_account_privato.html` | [V] |
| Credenziali bancarie nei record | più banche/carte per record, PIN e CCV su richiesta | `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` (matrice bancaria) | [V] in laboratorio; [E] su dispositivo |
| Aziende e Account aziendali | stesso modello con contesto aziendale, collegamenti e widget | `lista_aziende.html`, `dati_azienda.html`, `modifica_azienda.html`, `account_azienda.html`, `form_account_azienda.html`, `dettaglio_account_azienda.html` | [V] |
| Widget e credenziali comuni | campi aggiuntivi collegati a un Account o condivisi fra i record del proprietario | `accountWidgets`, `sharedVaultData` (`functions/index.js`) | [V] |
| Campi protetti (lucchetto) | valore nascosto all'apertura, mostrato su richiesta e riazzerato all'uscita | banchi a freddo (`COLD_*_CLEAR`) | [V] |

<a id="fonte-docs-m10-guida-utente-bozza-md-4-scadenze-promemoria-e-destinatari"></a>

### 4. Scadenze, promemoria e destinatari

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Scadenze e regole | scadenze con configurazioni dedicate | `scadenze.html`, `aggiungi_scadenza.html`, `dettaglio_scadenza.html`, `regole_scadenze.html` e le tre pagine di configurazione | [V] |
| Notifica tecnica pianificata | una sola schedulazione backend per le scadenze | `functions/index.js` (`checkDeadlines`), `docs/M7_RETENTION_CENSIMENTO.md` §7 | [V] come codice; **[E]** push reale su dispositivo |
| Destinatari e inviti | invio a destinatari con permesso di gestione, revoca e sospensione | `gestione_destinatari.html`, `functions/index.js` (`respondToInvitation`, `manageReceivedDeadline`) | [V] |
| Push del browser | notifiche push con service worker dedicato | `push-messaging-client.js`, `firebase-messaging-sw.js` | [V] come codice; **[E]** prova su dispositivo |

<a id="fonte-docs-m10-guida-utente-bozza-md-5-condivisione-fra-persone"></a>

### 5. Condivisione fra persone

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Condivisione di un Account con un altro utente | il destinatario legge i dati condivisi tramite `sharedWith`; letture vincolate dallo UID | `docs/DATA_ACCESS_CONTRACT.md`, `firestore.rules`, prove di condivisione (38 test) | [V] |
| Revoca e reinvito | revoca, sospensione inviti, reinvito dopo ripristino | test di condivisione e ciclo di revoca | [V] comportamento attuale |
| Copie residue del destinatario | il purge del proprietario **non** tocca inviti e copie condivise: il destinatario può ancora vedere nome e id dell'Account eliminato | `docs/M7_RETENTION_CENSIMENTO.md` §3.6 (D14 aperta) | [V] come comportamento attuale; **decisione aperta** |
| Ricevitore pubblico del contatto | pagina di sola visualizzazione per un contatto condiviso | `contatto_condiviso.html` → `contact-card-receiver.js` | [V] |

<a id="fonte-docs-m10-guida-utente-bozza-md-6-archivio-cancellazione-e-cronologia"></a>

### 6. Archivio, cancellazione e cronologia

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Archivio Account (cestino) | archiviazione, ripristino e cancellazione definitiva con conferma forte; **nessuna scadenza automatica** | `archivio_account.html`, `functions/index.js` (`purgeArchivedAccount`) | [V] |
| Cosa resta dopo il purge | il purge elimina solo gli allegati elencati; restano widget, copie condivise, inviti, prefissi non coperti e le **copie locali** (cache, bozze, coda, shell) | `docs/M7_RETENTION_CENSIMENTO.md` §3.4, §3.6, §3.7, §6.5; T-08/T-09/T-16/T-21/T-27 | [V] come comportamento attuale; **decisioni aperte** (D4, D10, D11, D14) |
| Cronologia e audit tecnico | eventi tecnici per UID, senza interfaccia utente; retention a **24 mesi** decisa dal proprietario e implementata **solo nel ramo** | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:114-171` | [C] implementato non distribuito; [E] rilascio e monitoraggio |
| Vista utente della cronologia | **non esiste** | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md` (censimento in sola lettura) | [V] assenza verificata |

<a id="fonte-docs-m10-guida-utente-bozza-md-7-backup-cifrato-e-ripristino"></a>

### 7. Backup cifrato e ripristino

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Esportazione `.cpbackup` | file cifrato con Recovery Key a visualizzazione singola; la **prima riga è in chiaro** (formato, versione, UID proprietario, identificatore, data, parametri KDF, cifrario) | `docs/M7_RETENTION_CENSIMENTO.md` §6.7 (T-17) | [V] |
| Ripristino con anteprima | confronto record per record, sostituzione selettiva confermata, controllo di versione per blocco | `docs/M8_BACKUP_RECUPERO.md`; banchi M8/M8-bis/M8-ter/M8-quater | [V] |
| Interruzione fra record e byte | un upload fallito lascia un **riferimento senza byte**; una nuova sessione non riprova nulla; il CAS per blocco può lasciare applicati i blocchi precedenti | `docs/M8_BACKUP_RECUPERO.md` (gate **NON CHIUSA**) | [V] difetto osservato; gate **aperto** |
| Ripristino di un Account già purgato | il ripristino lo **ricrea** con byte e riferimenti | `docs/M7_RETENTION_CENSIMENTO.md` §6.8 (T-21, D16 aperta) | [V] |
| Compatibilità delle copie PWA già installate | ordine di aggiornamento di client e backend, messaggio in caso di incompatibilità temporanea | `docs/M10_HARDENING_RILASCIO.md:59-70` | [E] prova sulle copie reali |

<a id="fonte-docs-m10-guida-utente-bozza-md-8-uso-offline-e-dati-sul-dispositivo"></a>

### 8. Uso offline e dati sul dispositivo

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Consultazione offline dei dati già preparati | la shell è in cache; i dati testuali preparati sono leggibili senza rete dopo lo sblocco | `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` (banchi `--cold-browser`, 33 esiti) | [V] in laboratorio; [E] dispositivo fisico |
| Scritture offline in coda cifrata | coda cifrata con lease, idempotenza e conflitti espliciti; soli domini abilitati | `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` | [V] per il perimetro; [C] fallback senza Web Locks non adottato |
| Browser senza Web Locks | oggi il percorso della coda **rifiuta** (`OFFLINE_QUEUE_LOCKS_UNAVAILABLE`); il fallback di laboratorio non è attivo | `docs/M6_DOMANDE_FALLBACK_WEB_LOCKS.md` | [C] candidato; decisione aperta |
| Cache del dispositivo espulsa | con la cache applicativa espulsa l'identità non si ripristina, il Vault resta chiuso e la consultazione è rifiutata | `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` (M6-1-LAB) | [V] in laboratorio; **[E]** su dispositivo, con limiti dichiarati |

<a id="fonte-docs-m10-guida-utente-bozza-md-9-salute-delle-credenziali-e-integrazioni"></a>

### 9. Salute delle credenziali e integrazioni

| Funzione | Che cosa fa | Fonte | Stato |
|---|---|---|---|
| Analisi locale di password deboli, duplicate e datate | analisi in memoria dopo lo sblocco; nessuna password o impronta persistita | `docs/M9_SALUTE_CREDENZIALI.md` | [V]; [E] collaudo Windows |
| Controllo violazioni con k-anonimato | contratto definito e testato **senza rete**; integrazione **disattivata** | `docs/M9_SALUTE_CREDENZIALI.md:14,30` | [C] non attivo; decisione e verifica provider mancanti |
| Passkey di servizio nei record | è un dato del record, non sblocca il Vault | `docs/M9_SALUTE_CREDENZIALI.md:16` | [V] |
| Autofill/estensione browser | progetto separato, non nel bootstrap | `docs/M9_SALUTE_CREDENZIALI.md:18` | [C] non implementato |

<a id="fonte-docs-m10-guida-utente-bozza-md-10-funzioni-non-presenti-o-non-distribuite"></a>

### 10. Funzioni **non** presenti o non distribuite

- **Interfaccia della cronologia/audit**: non esiste (vedi §6).
- **Vista utente delle ricevute di idempotenza**: non esiste.
- **Excel**: presente solo su un ramo separato, **non** montato nella shell (`docs/PASSAGGIO_CONSEGNE_2026-09-16.md:90`).
- **Integrazione violazioni password**: disattivata (§9).
- **Fallback senza Web Locks**: candidato di laboratorio (§8).
- **Rollout della shell persistente**: sperimentale; la produzione è `1.2.127`.

<a id="fonte-docs-m10-guida-utente-bozza-md-11-segnaposto-per-le-informazioni-organizzative-da-compilare"></a>

### 11. Segnaposto per le informazioni organizzative (da compilare)

Nessun nome, contatto, termine o impegno è inventato qui: ogni voce è un **segnaposto** con la domanda
corrispondente in `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md`.

| Voce | Segnaposto |
|---|---|
| Chi approva la guida utente | `[DA COMPILARE — Q1]` |
| Canale di assistenza e tempi di risposta | `[DA COMPILARE — Q2]` |
| Referente privacy/legale e modalità di contatto | `[DA COMPILARE — Q3]` |
| Incident commander, referente Firebase, canale di emergenza, accesso break-glass | `[DA COMPILARE — Q4]` (`docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`, «Informazioni organizzative da completare») |
| Comunicazioni in caso di incidente o interruzione | `[DA COMPILARE — Q5]` |
| Informativa privacy e termini pubblicati | `privacy.html`, `termini.html` **esistono**; il contenuto non è stato riesaminato in questa bozza (`[DA COMPILARE — Q6]`) |

<a id="fonte-docs-m10-guida-utente-bozza-md-12-limiti-di-questa-bozza"></a>

### 12. Limiti di questa bozza

- È una **bozza documentale di laboratorio**: nessuna approvazione, nessun uso pubblico, nessuna
  traduzione, nessuna verifica su dispositivo fisico.
- Le fonti sono **il repository** a questo commit: dove la prova è solo di laboratorio (emulatori,
  browser headless, dati sintetici) è indicato; dove serve un dispositivo o la console è indicato [E].
- **Non** chiude M6–M10, **non** sostituisce l'audit indipendente, **non** è una revisione legale o
  privacy finale e **non** autorizza un go-live.
