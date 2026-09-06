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
- [ ] catalogo completo delle funzioni visibili e dei relativi percorsi dati;
- [ ] dataset di prova privo di segreti reali;
- [ ] budget per apertura, primo contenuto, richieste, memoria e peso.

**Uscita:** sappiamo misurare prima/dopo senza usare i dati personali come collaudo.

### M1 — Nomenclatura e contratti della Vault

- [ ] rinominare gradualmente `_masterKey` in `vaultKeyMaterial` senza cambiare il valore;
- [ ] documentare verifier, KEK, envelope, Vault Key, keyring legacy e session wrapping;
- [ ] inventariare ogni campo cifrato e relativo formato;
- [ ] dimostrare che logout e blocco eliminino il materiale previsto;
- [ ] vietare nuovi usi ambigui di `masterKey` tramite audit.

**Uscita:** nessuna ambiguità fra password e chiavi; nessuna migrazione dati in questa fase.

### M2 — Data access e repository local-first

- [ ] sostituire le letture Firestore replicate con repository di dominio;
- [ ] formalizzare cache-first e refresh in background;
- [ ] deduplicare richieste equivalenti;
- [ ] rendere selettiva la sincronizzazione per pagina;
- [ ] definire conflitti prima di abilitare scritture offline.

**Uscita:** le pagine non conoscono più i dettagli della cache o della rete.

### M3 — Rifattorizzazione delle pagine

Ordine iniziale determinato dalla baseline, corretto dal rischio funzionale:

1. [x] Profilo Utente unico;
2. [~] Area Privata e liste Account: prima parallelizzazione e segreti lazy completati;
3. [ ] Aggiungi/Modifica Scadenza;
4. [ ] Dettagli Account Privato e Azienda;
5. [ ] Form Account Privato e Azienda;
6. [ ] Impostazioni e configurazioni;
7. [ ] Aziende e archivio;
8. [ ] Home e pagine pubbliche.

Per ogni pagina: baseline, mappa responsabilità, componenti condivisi, caricamento progressivo, test, confronto e rimozione del vecchio percorso.

**Uscita:** una sola implementazione canonica per funzione, senza suffissi di versione applicativi.

### M4 — Componenti e design system

- [ ] estrarre componenti soltanto dopo almeno due utilizzi reali;
- [ ] unificare card Account, righe sensibili, form field e stati di caricamento;
- [ ] ridurre CSS duplicato senza aumentare il cascade globale;
- [ ] completare i18n e accessibilità;
- [ ] applicare budget per font e icone.

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
| M0 | in corso |
| M1 | da avviare |
| M2 | infrastruttura parziale esistente |
| M3 | Profilo completato; Account/Area Privata avviati |
| M4 | fondazioni presenti, consolidamento da fare |
| M5 | da progettare prima di modificare le condivisioni |
| M6 | sola consultazione offline parzialmente operativa |
| M7 | da avviare |
| M8 | da avviare |
| M9 | da valutare dopo il core |
| M10 | da avviare dopo stabilizzazione architetturale |

Questo documento è la fonte principale del programma di maturazione. `GUIDA.md` resta il contratto tecnico e di sicurezza; `GUIDA_AGGIORNAMENTI.md` registra decisioni e avanzamento delle release.
