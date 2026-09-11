# Piano di audit completo del progetto

> **Stato:** approvato come prossima fase; esecuzione non ancora iniziata  
> **Autorità:** piano operativo subordinato a [Guida progetto](./GUIDA_PROGETTO.md) e [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md)  
> **Versione:** 1.0  
> **Data:** 11 settembre 2026  
> **Vincolo:** l’audit è inizialmente read-only. Non autorizza migrazioni, deploy, cancellazioni o modifiche ai dati reali.

## 1. Obiettivo

Ricontrollare l’intero progetto e determinare, con prove:

- cosa è realmente implementato;
- cosa coincide con i contratti;
- cosa esiste soltanto nei laboratori;
- cosa è legacy ma ancora necessario;
- cosa è in conflitto o non verificabile;
- cosa è distribuito davvero su Firebase;
- quali correzioni sono necessarie e in quale ordine.

L’esito sarà un rapporto unico con evidenza, rischio, priorità, intervento proposto, test, migrazione e rollback.

## 2. Regola di classificazione

Ogni affermazione sarà marcata:

| Stato | Significato |
|---|---|
| Verificato nel codice | Evidenza nel commit esaminato |
| Verificato da test | Prova automatica riproducibile |
| Verificato in emulatore | Prova locale Firebase, non produzione |
| Verificato sul dispositivo | Prova fisica registrata |
| Verificato in Firebase | Configurazione/prodotto remoto controllato |
| Dichiarato soltanto | Presente in un MD ma non ancora dimostrato |
| Laboratorio | Isolato dal runtime |
| Legacy necessario | Vecchio formato ancora letto da dati reali |
| In conflitto | Non rispetta la baseline |
| Non determinabile | Richiede accesso o prova aggiuntiva |

## 3. Perimetro

### A. Repository e supply chain

- branch, commit, workflow e deploy;
- dipendenze, lockfile e vulnerabilità;
- segreti, token e credenziali accidentalmente versionati;
- file duplicati, morti, storici o pubblicati per errore;
- laboratori esclusi dal runtime;
- licenze e provenienza delle dipendenze critiche.

### B. Autenticazione e Vault

- Firebase Authentication, verifica email, MFA/TOTP e WebAuthn/PRF;
- separazione password account/Master Password;
- verifier, KDF, salt, envelope e keyring;
- `localStorage`, `sessionStorage`, IndexedDB e RAM;
- blocco, logout, cambio UID, revoca e recupero;
- audit P0 di `vault-session.js`;
- compatibilità e rimozione controllata dei formati legacy.

### C. Cifratura e dati

- inventario di ogni campo e metadato;
- algoritmo, IV/nonce, AAD, versioni e gestione errori;
- plaintext in Firestore, Storage, cache, URL, log e notifiche;
- account privati, aziende, Profilo, scadenze, widget e credenziali comuni;
- confronto fra schema documentato e schema reale;
- inventario Firestore aggregato, senza restituire valori sensibili.

### D. Firestore e Functions

- copertura di ogni percorso da parte delle Rules;
- Rule generica e possibili autorizzazioni eccessive;
- allowlist, tipi, dimensioni, UID e revisioni;
- chiamate client dirette;
- callable e trigger con Authentication, App Check, autorizzazione, idempotenza e rate limit;
- operazioni Admin SDK che bypassano le Rules;
- transazioni, retry, conflitti e documenti orfani.

### E. Storage e allegati

- percorsi e isolamento UID;
- cifratura prima dell’upload;
- chiavi-file e wrapping;
- formati, dimensione, MIME e magic bytes;
- URL di download legacy;
- eliminazione coordinata;
- condivisione allegati;
- apertura sicura dei formati ammessi;
- conferma del compromesso zero-knowledge/scansione malware.

### F. Condivisioni

- inviti, email canonicalizzata, UID, ruoli e stati;
- condivisione account privato e aziendale;
- differenza tra ACL e consegna della chiave;
- record-key, envelope, generazione e revoca;
- comportamento offline dopo revoca;
- allegati e notifiche;
- confronto runtime legacy/laboratorio M5/target.

### G. Offline e prestazioni

- service worker applicativo e worker Firebase Messaging;
- cache shell e cache Firestore;
- consultazione offline di liste e dettagli;
- coda di scrittura cifrata;
- revisioni, operationId, retry e conflitti;
- comportamento iPhone/Windows;
- tempi percepiti e budget;
- caso bancario offline attualmente non superato.

### H. Backup, cestino e recupero

- formato backup, KDF, autenticità e versione;
- Recovery Key e custodia;
- staging, confronto, ripristino e rollback;
- retention di cestino, cronologia, allegati e backup;
- purge backend-only;
- cancellazione account e dati;
- prova reale esclusivamente su copia non produttiva.

### I. Frontend e sicurezza web

- CSP e header Hosting;
- XSS, injection, URL e rendering dinamico;
- script inline, dipendenze esterne e iframe;
- autofill, clipboard, QR e visibilità campi;
- accessibilità e privacy delle notifiche;
- errori che mostrano dati sensibili;
- pagina laboratorio eventualmente pubblicata.

### L. Firebase reale e rilascio

- progetto e ambiente corretti;
- versioni Rules, Functions, Hosting e indici distribuite;
- App Check enforcement;
- Authentication/Identity Platform e MFA;
- scheduler, email e push;
- IAM e service account;
- log e monitoraggio;
- workflow GitHub;
- piano rollback e matrice di rilascio.

### M. Privacy e organizzazione

- minimizzazione e finalità;
- informative e consensi;
- retention;
- diritti dell’utente;
- fornitori e localizzazione;
- procedura incidenti;
- ruoli amministrativi;
- eventuale necessità di DPIA e consulenza legale.

## 4. Ordine di esecuzione

1. congelare commit e inventario;
2. eseguire audit statico read-only;
3. eseguire test automatici esistenti;
4. mappare documenti contro codice;
5. eseguire emulatori;
6. produrre inventario dati aggregato;
7. verificare Firebase Console e deploy reali;
8. eseguire matrice fisica iPhone/Windows;
9. classificare rischi e dipendenze;
10. presentare il rapporto prima di qualsiasi correzione;
11. approvare correzioni per blocchi;
12. implementare, collaudare e documentare ogni blocco separatamente.

## 5. Priorità iniziali

| Priorità | Verifica |
|---|---|
| P0 | contenuto reale di `vault-session.js` e storage delle chiavi |
| P0 | Rules generiche e autorizzazioni effettive |
| P0 | campi/metadati realmente cifrati |
| P0 | condivisione legacy e possibilità reale di decifratura del destinatario |
| P0 | backup realmente ripristinabile |
| P0 | App Check/Rules/Functions realmente distribuiti |
| P1 | URL allegati legacy e pipeline formati |
| P1 | consultazione offline bancaria su iPhone |
| P1 | retention cestino/backup |
| P1 | inventario aggregato dei dati |
| P2 | prestazioni, UI, documentazione generata e laboratori |

## 6. Deliverable finale

Il rapporto dovrà contenere:

- commit e ambiente esaminati;
- matrice requisito → documento → codice → test → produzione;
- elenco findings con gravità e prova;
- falsi positivi separati;
- dati o accessi mancanti;
- correzione proposta;
- impatto su utenti e dati;
- piano di migrazione e rollback;
- ordine dei blocchi;
- gate di accettazione;
- decisioni richieste al product owner.

## 7. Criterio di completamento

L’audit è completo soltanto quando non restano aree dichiarate conformi basandosi esclusivamente sui Markdown. Gli elementi non verificabili devono rimanere esplicitamente aperti.
