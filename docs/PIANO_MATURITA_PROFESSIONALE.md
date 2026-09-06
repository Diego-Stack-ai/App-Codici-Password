# Piano di maturità professionale — Codici & Password

> Stato iniziale: versione locale 1.2.49. Documento di progetto, non autorizza migrazioni, cancellazioni, deploy o modifiche distruttive.

## 1. Obiettivo

Portare progressivamente Codici & Password alla qualità strutturale di un prodotto maturo, conservando tutte le funzioni utili, i dati esistenti, la compatibilità offline e le garanzie di sicurezza. Il piano non prevede una riscrittura totale non verificabile: definisce l'architettura che adotteremmo partendo oggi da zero e usa tale modello come destinazione della rifattorizzazione dell'app reale.

Il risultato è raggiunto soltanto quando ogni area possiede responsabilità chiare, contratti dati versionati, caricamento misurabile, comportamento offline definito, test automatici e una procedura di migrazione o rimozione delle implementazioni precedenti.

## 2. Terminologia crittografica reale

La Master Password e la Vault Key non sono la stessa cosa.

```text
Password account Firebase
  └─ autentica l'utente verso Firebase

Master Password della Vault
  ├─ verifica locale tramite Vault Verifier
  └─ deriva una KEK che apre il Vault Key Envelope

Vault Key casuale
  └─ protegge i dati cifrati della Vault
```

Nel codice attuale la variabile `_masterKey` di `security-manager.js` contiene, dopo lo sblocco, la **Vault Key risolta** o il keyring di compatibilità; il nome è storico e ambiguo. I Vault nuovi ricevono già una chiave casuale generata da `generateVaultKey()`, protetta da `wrapVaultKey()`. Per i dati precedenti può esistere temporaneamente un fallback legacy nel keyring, necessario a leggerli senza una ricifratura non atomica.

Il possibile livello futuro non è “aggiungere una Vault Key”, perché esiste già. È valutare una **Data Encryption Key per record (DEK)**:

```text
Vault Key
  ├─ protegge DEK Account A
  ├─ protegge DEK Documento B
  └─ protegge DEK Scadenza C
```

Questo modello può facilitare condivisione, revoca e rotazione selettiva, ma aumenta complessità e non deve essere adottato senza prima dimostrarne la necessità, progettare la migrazione e testare rollback e compatibilità.

## 3. Prodotto esistente da preservare

- autenticazione Firebase, 2FA TOTP e codici di recupero;
- Master Password distinta dalla password dell'account;
- Vault Key, verifier, envelope e WebAuthn/PRF;
- profilo personale, contatti, indirizzi, documenti e tessera digitale;
- account privati e aziendali, memorandum e memorandum condivisi;
- aziende, dati bancari e allegati cifrati;
- scadenze, regole, email, notifiche Push e notifiche interne;
- rubrica destinatari condivisa tra scadenze e inviti;
- archivio, ricerca e Agente Codex locale;
- consultazione offline dei dati già sincronizzati;
- importatore OCR mantenuto isolato finché non supera i relativi gate.

Una fase non può essere dichiarata conclusa se elimina, altera o rende più lenta una di queste funzioni senza una decisione esplicita e documentata.

## 4. Modello tecnico di destinazione

### 4.1 Bootstrap e navigazione

- bootstrap pubblico minimo per login, registrazione e recupero;
- bootstrap protetto unico per autenticazione, Vault, componenti e routing;
- import dinamico esclusivo del modulo della pagina corrente;
- servizi accessori, Push e prefetch sempre non bloccanti rispetto al primo contenuto;
- redirect storici confinati e rimovibili tramite un registro di compatibilità.

### 4.2 Strati applicativi

```text
UI pagina
  → servizi di dominio
    → repository locale
      → sincronizzazione
        → Firebase

Sicurezza e cifratura attraversano gli strati tramite API centrali,
senza essere replicate nelle singole pagine.
```

- la UI non costruisce direttamente percorsi Firestore complessi;
- il dominio definisce Account, Azienda, Profilo, Scadenza, Condivisione e Notifica;
- il repository decide cache-first/server refresh;
- il motore di sincronizzazione gestisce versione, stato e conflitti;
- la cifratura riceve e restituisce dati attraverso contratti espliciti.

### 4.3 Componenti

- card, righe dati, modali, form field, selettori, switch, liste e stati vuoti condivisi;
- token CSS centrali e CSS di pagina limitato al solo layout specifico;
- accessibilità, target tattili, safe area e responsive verificati automaticamente;
- nessuna dipendenza UI caricata se non serve alla pagina corrente.

### 4.4 Dati e sincronizzazione

- schema versionato per ogni entità;
- migrazioni idempotenti e riprendibili;
- cache locale cifrata o affidata a contenitori il cui rischio sia documentato;
- stato `sincronizzato`, `in attesa`, `conflitto`, `errore` quando saranno abilitate scritture offline;
- aggiornamento incrementale e selettivo, non riscaricamento globale;
- cancellazione locale verificabile su logout, cambio utente e revoca dispositivo.

### 4.5 Condivisione

- risoluzione email → UID esclusivamente backend;
- autorizzazione Firestore distinta dalla consegna crittografica della chiave;
- inviti con stato, scadenza, revoca e audit minimo;
- modello permessi predisposto per `view`, `edit`, `manage`, anche se inizialmente viene concesso soltanto `view`;
- nessuna enumerazione degli utenti e nessuna esposizione di token dispositivo;
- studio formale dell'eventuale cifratura per-record prima di cambiare il formato attuale.

### 4.6 Continuità e recupero

- cestino recuperabile e cronologia essenziale;
- esportazione cifrata completa e ripristino verificato;
- Recovery Key valutata separatamente dai codici di recupero 2FA;
- Emergency Access soltanto con disegno zero-knowledge, tempo di attesa e revoca;
- nessuna backdoor server per la Master Password.

## 5. Confronto sintetico con prodotti maturi

| Area | Codici & Password oggi | Modello maturo da valutare |
|---|---|---|
| Vault | Vault Key casuale con envelope e compatibilità legacy | terminologia pulita, migrazione legacy conclusa e possibile DEK per record |
| Condivisione | inviti, UID e regole di accesso | consegna crittografica verificata, ruoli, revoca e audit |
| Offline | shell PWA, Firestore persistente e prefetch | repository local-first, conflitti e coda scritture espliciti |
| Prestazioni | metriche bootstrap e baseline statica | budget CI e misure runtime su dispositivi reali |
| Account | consultazione, copia e condivisione | salute credenziali, cronologia e possibile autofill separato |
| Recupero | recupero account/2FA e cambio Master Password | backup cifrato verificato, Recovery Key ed eventuale emergenza |
| Organizzazione | Privato, Azienda, memorandum, documenti e scadenze | contratti comuni senza perdere i domini specifici |
| Funzioni distintive | scadenze, veicoli, documenti, Push, AI locale e OCR sperimentale | conservarle come vantaggio del prodotto, subordinate ai gate core |

Riferimenti di confronto: [Bitwarden Security Whitepaper](https://bitwarden.com/help/bitwarden-security-white-paper/), [Bitwarden encryption](https://bitwarden.com/help/what-encryption-is-used/), [Proton Pass vault](https://proton.me/support/pass-vault), [Proton Pass sharing](https://proton.me/support/pass-browser-share), [KeePassXC documentation](https://keepassxc.org/docs/).

## 6. Programma di lavoro

### M0 — Baseline e congelamento dei contratti

- [x] inventario del repository e grafo dipendenze;
- [x] baseline statica per pagina con `npm run audit:pages`;
- [x] prima metrica runtime `private-page-bootstrap`;
- [x] catalogo delle funzioni visibili e dei percorsi dati in `FUNCTIONAL_DATA_CONTRACT.md`;
- [x] dataset di prova privo di segreti reali, protetto da test automatici;
- [x] budget statici e obiettivi runtime definiti; baseline reale iPhone/PC registrata in `RUNTIME_PERFORMANCE_BASELINE.md`.

**Uscita:** sappiamo misurare prima/dopo senza usare i dati personali come collaudo.

### M1 — Nomenclatura e contratti della Vault

- [x] rinominare gradualmente `_masterKey` in `vaultKeyMaterial` senza cambiare il valore;
- [x] documentare verifier, KEK, envelope, Vault Key, keyring legacy e session wrapping in `VAULT_KEY_CONTRACT.md`;
- [x] inventariare ogni campo cifrato e relativo formato in `ENCRYPTED_FIELD_INVENTORY.md`;
- [x] dimostrare con test che logout e blocco eliminino il materiale previsto;
- [x] vietare il ritorno della variabile interna ambigua `_masterKey` tramite audit.

**Uscita:** nessuna ambiguità fra password e chiavi; nessuna migrazione dati in questa fase.

### M2 — Data access e repository local-first

- [x] sostituire le letture Firestore replicate con repository di dominio;
- [x] formalizzare cache-first e refresh in background in `DATA_ACCESS_CONTRACT.md`;
- [x] deduplicare richieste equivalenti nel perimetro già migrato;
- [x] rendere selettiva la sincronizzazione per pagina tramite le priorità di `offline-sync.js`;
- [x] definire conflitti prima di abilitare scritture offline in `OFFLINE_WRITE_CONFLICT_POLICY.md`.

M2 completata: i moduli applicativi usano il repository unico; richieste equivalenti sono coordinate senza introdurre una seconda cache permanente. Le scritture offline restano disabilitate fino all'implementazione dei gate M6.

**Uscita:** le pagine non conoscono più i dettagli della cache o della rete.

### M3 — Rifattorizzazione delle pagine

Registro canonico e redirect di compatibilità formalizzati in `CANONICAL_PAGE_REGISTRY.md`; il gate automatico impedisce che le vecchie Home vengano trattate come pagine applicative.

Ordine iniziale determinato dalla baseline, corretto dal rischio funzionale:

1. [x] Profilo Utente unico;
2. [x] Area Privata e liste Account: letture parallelizzate, password lazy anche nei più usati e vista card/Swipe condivisa tra Privato e Azienda;
3. [x] Aggiungi/Modifica Scadenza: modelli destinatari/data/configurazione, controller destinatari/allegati/configurazione e servizio di persistenza estratti e testati; il form conserva soltanto orchestrazione e UI specifiche;
4. [x] Dettagli Account Privato e Azienda: modalità canoniche, renderer bancario e compatibilità legacy condivisi; allegati e condivisione isolati, con gate su campi sensibili, listener e revoca;
5. [x] Form Account Privato e Azienda: regole Account/Memorandum e renderer bancario condivisi; cifratura e transazioni di salvataggio isolate in servizi dedicati e protette da gate;
6. [x] Impostazioni e configurazioni: modello comune delle configurazioni Scadenze estratto e testato; canali Push riuniti in un controller condiviso e QR opzionale caricato fuori dal percorso critico; riordino visivo complessivo rinviato al post-M10;
7. [x] Aziende e archivio: letture archivio parallelizzate e isolate dalla vista, mutazioni Archivio/Aziende delegate a servizi dedicati, decifratura preventiva limitata al solo indice username; apertura allegati anagrafica azienda isolata e coperta dai gate di sicurezza;
8. [x] Home e pagine pubbliche: bootstrap pubblico minimo; presentazione protetta, inbox e dashboard Scadenze isolate dall’orchestratore Home e coperte da gate dedicati.

Per ogni pagina: baseline, mappa responsabilità, componenti condivisi, caricamento progressivo, test, confronto e rimozione del vecchio percorso.

**Uscita:** una sola implementazione canonica per funzione, senza suffissi di versione applicativi.

M3 completata: le pagine canoniche sono state separate in orchestratori, viste condivise e servizi di dominio dove necessario; i percorsi precedenti non sono più concorrenti e i gate impediscono il ritorno delle duplicazioni rimosse.

### M4 — Componenti e design system

- [x] estrarre componenti soltanto dopo almeno due utilizzi reali, secondo `UI_DESIGN_SYSTEM_CONTRACT.md`;
- [x] unificare card Account, righe sensibili, form field e stati di caricamento: viste Account e dati bancari condivise, campi base in `moduli.css`, stati di pagina accessibili in `ui-state-view.js`;
- [~] eliminare definitivamente flash e discontinuità di header/footer durante scroll e overscroll: ricomposizione mobile rimossa e fallback opaco implementato; resta il collaudo fisico su iPhone/Windows;
- [x] ridurre CSS duplicato senza aumentare il cascade globale: i due form Account usano un solo foglio canonico e gli stati pagina sono nel core condiviso;
- [~] completare i18n e accessibilità: stati asincroni, focus, target tattili, movimento ridotto e dialoghi sono coperti; revisione linguistica globale resta vincolata al post-M10;
- [x] applicare budget per font e icone: Manrope e Material Symbols restano locali, non bloccanti e protetti dal gate M4.

**Uscita:** UI coerente e più leggera, senza una libreria astratta sovradimensionata.

### M5 — Condivisione professionale

- [ ] threat model completo del flusso proprietario/invitato;
- [ ] verificare come il destinatario ottiene il materiale necessario alla decifratura;
- [ ] confrontare ACL attuale e condivisione crittografica;
- [ ] progettare ruoli, revoca, scadenza e cronologia;
- [ ] prototipo isolato dell'eventuale chiave per-record;
- [ ] migrazione soltanto dopo test su copia non produttiva.

**Uscita:** autorizzazione e crittografia sono entrambe dimostrate end-to-end.

### M6 — Sincronizzazione e scritture offline

- [ ] modello versione/revisione del record;
- [ ] coda locale cifrata e idempotente;
- [ ] risoluzione conflitti comprensibile;
- [ ] gestione multi-tab e multi-dispositivo;
- [ ] test modalità aereo, chiusura forzata e ritorno online.

**Uscita:** nessuna perdita o sovrascrittura silenziosa.

### M7 — Cronologia, cestino e audit

- [ ] cestino con conservazione definita;
- [ ] ripristino e cancellazione definitiva;
- [ ] cronologia limitata ai cambiamenti necessari;
- [ ] audit delle azioni condivise senza registrare segreti.

**Uscita:** gli errori dell'utente e della sincronizzazione sono recuperabili.

### M8 — Backup e recupero

- [ ] formato di esportazione cifrato e versionato;
- [ ] verifica automatica dell'integrità del backup;
- [ ] procedura reale di ripristino;
- [ ] progetto Recovery Key;
- [ ] valutazione separata Emergency Access.

**Uscita:** il recupero è provato, non soltanto dichiarato.

### M9 — Salute credenziali e integrazioni

- [ ] controllo locale di password deboli, duplicate e datate;
- [ ] controllo violazioni soltanto con protocollo privacy verificato;
- [ ] studio separato di estensione browser/autofill e protezione phishing;
- [ ] passkey dei servizi come tipo di dato distinto dalla passkey di sblocco Vault.

**Uscita:** nessuna integrazione riduce la sicurezza o appesantisce il bootstrap.

### M10 — Hardening e rilascio maturo

- [ ] threat model finale e checklist OWASP pertinente;
- [ ] dipendenze, CSP, App Check e Rules verificate in produzione;
- [ ] test end-to-end su iPhone, Windows e browser supportati;
- [ ] audit esterno indipendente quando il modello crittografico è stabile;
- [ ] guida utente, privacy, recupero e risposta agli incidenti.

**Uscita:** release candidata documentata, misurata e ripristinabile.

### Attività conclusiva dopo M10 — Lingue e riordino Impostazioni

Questa attività è un promemoria vincolante, ma **non deve essere anticipata durante le fasi M0–M10**. Una volta completato l’intero programma di maturazione:

- riesaminare tutte le lingue e tutte le stringhe dell’app;
- completare e uniformare le traduzioni, eliminando testi mancanti, duplicati o incoerenti;
- verificare terminologia, maiuscole, messaggi di errore, accessibilità e adattamento dei testi su mobile;
- riesaminare integralmente la pagina **Impostazioni**;
- riordinare card e comandi in gruppi logici, coerenti e facilmente riconoscibili;
- eliminare eventuali doppioni soltanto dopo averne verificato utilizzo e collegamenti;
- collaudare il risultato su iPhone, PC e in tutte le lingue supportate.

**Uscita:** lingue coerenti e pagina Impostazioni organizzata definitivamente per gruppi, dopo la stabilizzazione tecnica M0–M10.

## 7. Regole di esecuzione

1. Una sola fase strutturale attiva per volta; correzioni urgenti possono essere isolate.
2. Nessun cambio di formato dati senza lettore retrocompatibile, backup e rollback.
3. Nessuna funzione viene rimossa perché “sembra inutilizzata” senza prova da runtime, riferimenti e test.
4. Ogni rifattorizzazione deve ridurre o mantenere peso, richieste e tempo; un aumento richiede motivazione.
5. Nessun dato sensibile nei log, nelle metriche o nei dataset di prova.
6. Commit piccoli e tematici; push e deploy soltanto dopo suite verde e autorizzazione.
7. Le implementazioni precedenti vengono eliminate soltanto quando il percorso canonico supera tutti i gate.
8. AI, OCR e funzioni accessorie non entrano nel percorso critico di apertura.

## 8. Stato di avanzamento

| Fase | Stato |
|---|---|
| M0 | completata il 06/09/2026 |
| M1 | completata il 06/09/2026 |
| M2 | completata il 06/09/2026 |
| M3 | completata il 06/09/2026 |
| M4 | fondazioni presenti, consolidamento da fare |
| M5 | da progettare prima di modificare le condivisioni |
| M6 | sola consultazione offline parzialmente operativa |
| M7 | da avviare |
| M8 | da avviare |
| M9 | da valutare dopo il core |
| M10 | da avviare dopo stabilizzazione architetturale |
| Post-M10 | revisione lingue e riordino per gruppi della pagina Impostazioni |

Questo documento è la fonte principale del programma di maturazione. `GUIDA.md` resta il contratto tecnico e di sicurezza; `GUIDA_AGGIORNAMENTI.md` registra decisioni e avanzamento delle release.
