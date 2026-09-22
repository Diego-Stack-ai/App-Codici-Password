# M10-4 — Revisione privacy preliminare (mappatura alle fonti del repository)

> **Stato:** **REVISIONE PRELIMINARE di laboratorio**, per la revisione di Diego. **Non** è un parere
> legale, **non** è la revisione privacy finale, **non** chiude M10-4 né M6–M10 e **non** autorizza un
> go-live. M10-4 resta **aperto** (`docs/CENSIMENTO_GATE_M6_M10.md`, riga M10-4).
> **Base:** ramo `integration/vault-shell-v127-security`, HEAD `30b38835`, versione `1.2.127`.
> **Metodo:** solo fonti del repository (documenti e codice letti e citati); nessun dato reale, nessuna
> modifica a codice, test, Rules o Functions. Le decisioni del proprietario sono in
> `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md` (commit separato).

## 1. Categorie di dati e dove vivono

| Categoria | Dove vive | Fonte |
|---|---|---|
| Credenziali e campi sensibili dei record (Account privati/aziendali, banche, widget, credenziali comuni, note, scadenze, profilo) | **Firestore**, cifrati nel client (`encrypt`) con chiave del Vault; testo in chiaro **solo in memoria** dopo lo sblocco | `docs/DATA_ACCESS_CONTRACT.md` («Nessun dato decifrato viene conservato dal repository»); `modules/core/crypto-utils.js` |
| Metadati degli allegati | Firestore, sotto `users/{uid}/accounts/{aid}/attachments/**` e prefissi collegati | `docs/M7_RETENTION_CENSIMENTO.md` §5.1 |
| Byte degli allegati | **Firebase Storage**, sotto gli stessi prefissi | `storage.rules`; `docs/M7_RETENTION_CENSIMENTO.md` §5.4 |
| Identità e sessioni | **Firebase Auth**; copia locale gestita dall'SDK | `docs/M7_RETENTION_CENSIMENTO.md` §6.5 (T-23) |
| Copie sul dispositivo (cache di consultazione) | cache persistente di Firestore (IndexedDB), copie in memoria, bozze in `sessionStorage`; **al logout viene cancellata la sola sessione Vault** (`vault_session_v1`, chiave di wrapping, `vault_s_key`, `vault_s_expiry`), mentre bozze, cache IndexedDB, coda offline, `localStorage` e shell PWA **restano**; dopo il purge nessuna di queste viene evacuata | `docs/M7_RETENTION_CENSIMENTO.md` §6.5-6.6 (T-23, T-24; decisioni D10, D11); `vault-session.js:94-99` |
| Chiave di sessione del Vault | `sessionStorage` (chiave di wrapping + payload incapsulato) | `vault-session.js:3` (`getSessionKey`); **P0 noto** in `AUDIT_VAULT_SESSION_P0.md` |
| Coda offline cifrata | IndexedDB (contenitore cifrato, lease) | `modules/data/offline-mutation-queue.js`; `docs/M6_SINCRONIZZAZIONE_OFFLINE.md` |
| Shell dell'app offline | Cache Storage del service worker (solo asset di stessa origine) | `sw.js`; `docs/M10_REVISIONE_LOCALE.md` §4.11 |
| Cronologia/audit tecnico | `users/{uid}/auditEvents` (nessuna interfaccia utente) | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:114-171` |
| Ricevute di idempotenza | `mutationResults/{uid}/operations`, `operationResults`, `archiveOperations`, `backupRestoreOperations` | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:129` |
| Backup esportato | **file locale dell'utente** (`.cpbackup`), fuori dal servizio | `docs/M8_BACKUP_RECUPERO.md`; `docs/M7_RETENTION_CENSIMENTO.md` §6.1 |
| Log tecnici | Console del browser e log di piattaforma Firebase; dal 22/09 i moduli di sicurezza registrano **solo un'etichetta diagnostica** | `docs/M10_REVISIONE_LOCALE.md` §5.1 (M10-LOG-1) |

## 2. Flussi e destinatari

| Flusso | Verso dove | Fonte |
|---|---|---|
| Autenticazione, letture/scritture, upload/download | **Firebase/Google** (Auth, Firestore, Storage, Functions `europe-west1`) | `firebase.json`, `.firebaserc`, `functions/index.js` |
| Recupero MFA con codice | chiamata server-side a **Identity Toolkit** (`accounts:signInWithPassword`) | `functions/index.js` (`recoverMfaWithCode`) |
| Notifiche push | servizio push del browser/Firebase | `push-messaging-client.js`, `firebase-messaging-sw.js` |
| Controllo violazioni password (k-anonimato) | **nessuna rete**: integrazione disattivata; il laboratorio è testato senza rete | `docs/M9_SALUTE_CREDENZIALI.md:14,30` |
| Autofill/estensione browser | progetto separato, **non** nel bootstrap | `docs/M9_SALUTE_CREDENZIALI.md:18` |
| Analisi salute credenziali | **solo in memoria**, nessuna impronta persistita | `docs/M9_SALUTE_CREDENZIALI.md:12` |

## 3. Conservazione: che cosa è deciso e che cosa no

| Voce | Stato attuale | Fonte |
|---|---|---|
| Cronologia tecnica `auditEvents` | **24 mesi** decisi dal proprietario (21/09/2026), job di cancellazione controllato dal backend, **implementato solo nel ramo, non distribuito** | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:116-118` |
| Eventi non databili | conservati come `unverifiable`, **mai** cancellati automaticamente | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:143` |
| Archivio Account (cestino) | **nessuna scadenza automatica**: permane fino alla cancellazione manuale | `docs/M7_RETENTION_CENSIMENTO.md` §7, D1 |
| Ricevute di idempotenza, backup, log di piattaforma, Account archiviati | **fuori** dalla retention dei 24 mesi | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:129` |
| Copie sul dispositivo (cache, bozze, copie di consultazione) | al **logout** viene cancellata la **sola sessione Vault in `sessionStorage`** (4 elementi, `vault-session.js:94-99`); restano bozze `sessionStorage`, envelope e verifier in `localStorage`, cache Firestore in IndexedDB, coda offline, shell PWA e file dell'utente. Dopo il **purge** nessuna di queste copie viene evacuata | `docs/M7_RETENTION_CENSIMENTO.md` §6.5-6.6, tabella M7-T23 (D10, D11) |
| TTL Firestore e lifecycle del bucket | **configurazione reale non verificata** (serve accesso esterno) | `docs/M7_RETENTION_CENSIMENTO.md` §11.1 (T-22) |
| Obblighi legali di conservazione | **dipendenza dichiarata**, nessuna deroga inventata (D8 rinviata) | `docs/M7_RETENTION_CENSIMENTO.md` §8 D8; `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:168` |

## 4. Condivisione e revoca

- La condivisione usa `sharedWith` sull'Account e inviti; le letture del destinatario sono vincolate
  dallo UID (`docs/DATA_ACCESS_CONTRACT.md`; `firestore.rules`; 38 test di condivisione, ciclo di revoca,
  sospensione inviti, reinvito dopo ripristino).
- Il **purge del proprietario non tocca inviti né copie condivise**: l'invito resta leggibile dal
  destinatario con nome e identificativo dell'Account eliminato e lo stato `suspended`
  (`docs/M7_RETENTION_CENSIMENTO.md` §3.6; decisione **D14 aperta**).
- La cancellazione di un'**Azienda** è un singolo `deleteDoc` non ricorsivo: Account, byte e riferimenti
  restano (`docs/M7_RETENTION_CENSIMENTO.md` §3.5; **D13 aperta**).

## 5. Backup e ripristino

- Il file `.cpbackup` è **locale**: la prima riga è in chiaro (formato, `schemaVersion`, UID del
  proprietario, `backupId`, data, parametri KDF, cifrario) e il corpo è cifrato
  (`docs/M7_RETENTION_CENSIMENTO.md` §6.7; **D15 aperta**).
- La **Recovery Key** è a visualizzazione singola; senza di essa il recupero dei dati cifrati non è
  promesso (`docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`).
- Un ripristino può **ricreare** un Account già purgato, con byte e riferimenti, mentre la ricevuta di
  purge resta `purged` (`docs/M7_RETENTION_CENSIMENTO.md` §6.8; **D16 aperta**).
- Le interruzioni fra record e byte sono un **difetto osservato** con gate aperto
  (`docs/M8_BACKUP_RECUPERO.md`): riferimento senza byte dopo un upload fallito; nessuna compensazione.

## 6. Log e diagnosi

- Dal 22/09/2026 i nove punti dei moduli di sicurezza che registravano l'oggetto errore emettono **solo
  un'etichetta diagnostica** da lista chiusa (`docs/M10_REVISIONE_LOCALE.md` §5.1; commit `27c1c621`,
  `30b38835`). Restano le righe di log **applicative** preesistenti (contesto e identificatori), e i log
  di piattaforma Firebase, che **non** sono stati riesaminati qui.
- La procedura di incidente vieta di inserire password, Master Password, Vault Key o Recovery Key nei
  canali di supporto e chiede di annotare versione, orario e azione tecnica **senza dati personali**
  (`docs/RISPOSTA_INCIDENTI_E_RECUPERO.md`).

## 7. Interazione dell'utente con i propri dati

| Diritto/azione | Stato nel prodotto | Fonte |
|---|---|---|
| Consultare i propri dati | sì, dopo lo sblocco | `docs/DATA_ACCESS_CONTRACT.md` |
| Esportare un backup | sì, file locale cifrato | `docs/M8_BACKUP_RECUPERO.md` |
| Cancellare un Account | sì, con conferma forte; il purge lascia copie residue elencate | `docs/M7_RETENTION_CENSIMENTO.md` §3.4 |
| Cancellare copie sul dispositivo | **parziale**: al logout l'app cancella da sé solo la sessione Vault in `sessionStorage`; **nessun comando** cancella bozze, cache IndexedDB, coda offline, `localStorage` o shell PWA | `docs/M7_RETENTION_CENSIMENTO.md` §6.5-6.6; `vault-session.js:94-99` |
| Vedere la cronologia tecnica | **non previsto** (nessuna interfaccia) | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md` |
| Richiedere la cancellazione anticipata di un evento di audit | **non previsto** (registro non cancellabile dal client) | `docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:116` |
| Informative pubblicate | `privacy.html` e `termini.html` esistono; **contenuto non riesaminato qui** | `docs/CANONICAL_PAGE_REGISTRY.md` |

## 8. Punti incerti e dipendenze (nessuna decisione presa qui)

1. **Decisioni D1–D16: stato distinto, non «tutte aperte».**
   - **Decise:** **D3** — il registro tecnico `auditEvents` è conservato **24 mesi** con cancellazione
     controllata dal backend (decisione del proprietario del 21/09/2026), **implementata solo nel ramo e
     non distribuita**; la convenzione della finestra (mesi di calendario) è decisa e implementata
     (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:116,165`; `docs/CENSIMENTO_GATE_M6_M10.md:24`). **La durata
     non si richiede di nuovo.**
   - **Rinviata:** **D8** (obblighi legali di conservazione) — dipendenza dichiarata, nessuna deroga
     inventata (`docs/M7_CRONOLOGIA_CESTINO_AUDIT.md:168`).
   - **Parziali:** **D3**, per le parti non coperte dalla durata (permanenza delle altre famiglie,
     rimozione della scrittura client sul registro, eventuale anonimizzazione al purge).
   - **Ancora aperte:** **D1, D2, D4, D5, D6, D7, D9, D10–D16** (durata del cestino, cancellazione
     immediata, residui del purge, backup e ricevute, messaggi all'utente, prova di irraggiungibilità,
     ordine di lavoro, copie sul dispositivo, copie di consultazione, residui alla rimozione, hard-delete
     di Azienda, copie condivise, intestazione del backup, ripristino dopo il purge), elencate in
     `docs/M7_RETENTION_CENSIMENTO.md` §8 e §10.
2. **TTL Firestore e lifecycle del bucket**: stato reale **non verificato** (T-22): richiede accesso
   esterno (`gcloud`), non deducibile dai file del repository.
3. **P0 della chiave di wrapping in `sessionStorage`**: aperto (`docs/AUDIT_VAULT_SESSION_P0.md`).
4. **PBKDF2 dei campi a 100 000 iterazioni**, attivo in scrittura e con ripiego sulla Master Password nel
   percorso legacy: da chiarire con l'audit indipendente, con migrazione necessaria per cambiarlo
   (`docs/M10_REVISIONE_LOCALE.md` §4.2).
5. **Audit indipendente di crittografia e condivisione** e **revisione OWASP finale firmata**: non
   eseguiti; domande in `docs/M10_DOMANDE_AUDIT_INDIPENDENTE.md`.
6. **Copie sul dispositivo e copie di consultazione**: comportamenti attuali verificati, decisioni di
   prodotto aperte (`docs/M7_DOMANDE_T23_CACHE_DISPOSITIVO.md`,
   `docs/M7_DOMANDE_T24_COPIE_CONSULTAZIONE.md`).
7. **Prove esterne mancanti**: matrice fisica iPhone/Windows, console del progetto (App Check
   Enforcement, Rules distribuite, indici, log), copia non produttiva, obblighi legali specifici.

## 9. Limiti di questa revisione

- È **preliminare e documentale**: si basa sulle fonti del repository a questo commit, non su un esame
  dei dati reali, dei log di piattaforma o delle configurazioni distribuite.
- **Non** è un parere legale e **non** sostituisce la revisione privacy finale né l'audit indipendente:
  per i profili legali e per i diritti degli interessati serve il referente competente (segnaposto in
  `docs/M10_DOMANDE_GUIDA_E_PRIVACY.md`).
- **Non** chiude M6–M10 e **non** autorizza alcuna pubblicazione o go-live.
