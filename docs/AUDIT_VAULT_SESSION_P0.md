# Audit P0 — Sessione Vault

> **Stato:** audit statico completato; correzione architetturale da approvare
> **Autorità:** evidenza subordinata a [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md) e [Contratto Vault Key](./VAULT_KEY_CONTRACT.md)
> **Data:** 11 settembre 2026
> **Commit esaminato:** `2b00336dfcf2a2c90e244263bca33fbf3db2d922`
> **Codice esaminato:** `security-manager.js`, `vault-session.js`, `webauthn-manager.js`, `inactivity-timer.js`, chiamate di logout e test Vault

## 1. Esito

Il runtime separa correttamente la password Firebase dalla Master Password e usa una Vault Key casuale protetta da envelope. La sessione fra pagine, però, non soddisfa l'invariante della baseline: `vault-session.js` conserva nello stesso `sessionStorage` sia il materiale Vault cifrato sia la chiave casuale che lo decifra.

Questo wrapping impedisce la lettura casuale del solo payload, ma non crea una separazione crittografica contro uno script eseguito nella stessa origine. Un attaccante capace di eseguire JavaScript nell'app può leggere entrambi i valori e ricostruire il materiale Vault della scheda sbloccata.

Il runtime non deve quindi essere dichiarato conforme al contratto Vault o definitivamente zero-knowledge finché questa persistenza resta attiva.

## 2. Flusso verificato

1. La Master Password verifica il verifier e deriva temporaneamente la KEK.
2. La KEK apre `vaultKeyEnvelope` oppure inizializza il formato compatibile previsto.
3. `_vaultKeyMaterial` conserva la chiave sbloccata in RAM.
4. `saveVaultSession()` cifra lo stesso materiale e salva il payload in `sessionStorage`.
5. `getSessionKey(true)` genera la chiave di wrapping e salva anch'essa in `sessionStorage`.
6. Al caricamento della pagina successiva `restoreVaultSession()` legge entrambi i valori e ripristina `_vaultKeyMaterial` senza chiedere nuovamente la Master Password.
7. Il timer aggiorna `expiresAt`; `softLock()` e `clearSession()` eliminano payload e chiave di wrapping.

## 3. Evidenze positive

- non è emersa persistenza della Master Password in `localStorage`;
- verifier e `vaultKeyEnvelope` memorizzati localmente sono contenitori cifrati e versionati;
- il vecchio segreto biometrico non strutturato viene eliminato e non viene più letto;
- il contenitore WebAuthn/PRF conserva ciphertext, IV, salt e identificatore credenziale, non la chiave PRF;
- cambio UID, perdita dell'utente autenticato, blocco per inattività e reset Vault chiamano la pulizia centralizzata;
- i test verificano isolamento per UID e cancellazione dei due valori di sessione;
- non sono emerse chiamate che inviano Master Password o Vault Key alle Cloud Functions.

## 4. Finding

### VS-P0-01 — Chiave e ciphertext nello stesso storage

**Gravità:** alta.
**Stato:** verificato nel codice e indirettamente dai test.
**Impatto:** una XSS o dipendenza frontend compromessa, mentre la Vault è sbloccata o ripristinabile, può ottenere entrambi gli elementi necessari alla decifratura.
**Limite:** nessuna soluzione browser può proteggere completamente una chiave già in RAM da codice ostile eseguito nella stessa pagina; eliminare la persistenza riduce però la finestra e impedisce il recupero dopo un nuovo caricamento.

### VS-P1-02 — Pulizia al logout non sempre esplicita

**Gravità:** media.
**Stato:** verificato nel codice.
**Impatto:** alcuni pulsanti chiamano direttamente `signOut()` e affidano la pulizia al listener globale `onAuthStateChanged`. Il percorso normalmente funziona, ma il contratto dovrebbe richiedere `clearSession()` prima del logout in ogni comando esplicito, mantenendo il listener come seconda difesa.

### VS-P1-03 — Ripristino della scheda e crash non certificati

**Gravità:** media.
**Stato:** non determinabile senza prova fisica.
**Impatto:** `sessionStorage` è normalmente limitato alla scheda, ma il ripristino della sessione del browser dopo chiusura anomala può conservarlo. Non esiste una prova su Safari/iPhone, Chrome ed Edge che documenti tutti i casi.

### VS-P1-04 — Test funzionali descritti come contratto di sicurezza

**Gravità:** media.
**Stato:** verificato nei test e negli script.
**Impatto:** i test attuali dimostrano che la sessione viene ripristinata e cancellata, ma non dimostrano che il wrapping sia sicuro. Uno script di audit richiede esplicitamente la persistenza fra pagine; il messaggio “contratto M1 rispettato” deve essere separato dalla conformità alla nuova baseline.

## 5. Vincolo funzionale

L'app usa pagine HTML separate. Una Vault Key conservata soltanto in una variabile JavaScript viene persa a ogni navigazione completa. Rimuovere subito `sessionStorage` obbligherebbe quindi l'utente a reinserire la Master Password in quasi ogni pagina, salvo usare WebAuthn con un nuovo gesto dell'utente.

Per questo motivo la correzione non deve essere una cancellazione isolata di `vault-session.js`: richiede una decisione sull'architettura di navigazione e sul livello di comodità accettato.

## 6. Piano di correzione proposto

### Blocco 1 — Riduzione immediata del rischio

- rendere esplicita la pulizia prima di ogni logout;
- distinguere nei test “continuità funzionale” e “conformità di sicurezza”;
- verificare CSP, rendering dinamico e dipendenze come difesa principale contro XSS;
- misurare chiusura, crash, ripristino scheda e timeout sui browser supportati.

Questo blocco non cambia il formato dei dati e non richiede migrazione.

### Blocco 2 — Scelta del modello di sessione

Valutare e approvare una delle seguenti direzioni:

1. **modalità rigorosa:** chiave solo in RAM e nuovo sblocco dopo ogni caricamento completo;
2. **navigazione persistente:** evoluzione graduale verso una shell che non ricarica il contesto crittografico a ogni pagina;
3. **sblocco dispositivo:** WebAuthn/PRF esplicito quando cambia documento, mantenendo la Master Password come fallback;
4. **compatibilità temporanea:** mantenere il comportamento corrente per un periodo dichiarato, rafforzando fortemente prevenzione XSS e timeout, senza definirlo conforme.

Service Worker, SharedWorker, cookie o un secondo storage web non devono essere considerati automaticamente sicuri: richiedono threat model, compatibilità iPhone/PWA e prova che la chiave non sia recuperabile dagli stessi script dell'origine.

### Blocco 3 — Cutover controllato

Dopo la scelta:

- implementare il nuovo gestore dietro una modalità reversibile;
- mantenere invariati ciphertext, envelope e dati Firestore quando possibile;
- aggiungere test per logout, cambio UID, timeout, refresh, chiusura e ripristino;
- collaudare su iPhone/Safari, PWA, Chrome ed Edge;
- rimuovere il lettore di sessione precedente soltanto dopo il collaudo e il rollback verificato.

## 7. Decisione richiesta

La correzione non richiede recuperare o risalvare gli account esistenti: riguarda il modo in cui la chiave già sbloccata sopravvive fra le pagine. Prima del Blocco 2 il product owner deve scegliere se privilegiare temporaneamente comodità, modalità rigorosa oppure una futura shell persistente.

## 8. Correzione locale del 12/09/2026 — Blocco 1, logout

Base applicativa: v1.2.110, `fa555d49`; documentazione consolidata in `5ef16228`.

- Corretti i quattro percorsi privi di pulizia esplicita: logout in `auth.js`, pulsante Home in `components-v129.js`, riautenticazione e uscita dall’aggiornamento password obbligatorio in `imposta_nuova_password.js`.
- Tutti i sette `signOut(auth)` applicativi sono preceduti da `clearSession()`. Nei percorsi nuovi il gestore viene importato soltanto quando si esce, mantenendo leggero il bootstrap pubblico.
- `tests/vault-logout.test.mjs` censisce i sette percorsi e prova il comando logout con il corpo reale dei moduli di sicurezza/sessione, sostituendo soltanto browser e Firebase. Verifica RAM e quattro chiavi di sessione eliminate prima della chiamata remota, anche quando questa fallisce; gli altri dati locali restano intatti.
- I messaggi dei gate distinguono terminologia e continuità funzionale dalla conformità crittografica.

**Impatto e rollback:** nessuna modifica a ciphertext, envelope, autenticazione, Rules o Functions. Se Firebase rifiuta il logout, la Vault resta priva del materiale locale già cancellato; il recupero richiede lo sblocco previsto dall’app. Il rollback è il revert del commit, senza migrazione dati.

**Validazione locale:** `npm test` completato con successo il 12/09/2026, inclusi build, gate statici, test Vault e suite Firestore/Storage negli emulatori. Rigenerati inventario e baseline delle 30 pagine; nessun collegamento relativo a file MD rotto. Il primo tentativo di build era impedito dai permessi di lettura della sandbox; la suite completa è stata poi eseguita con l’accesso locale necessario. Queste prove non sostituiscono i collaudi fisici elencati sotto.

**Limiti:** VS-P1-02 corretto nei comandi espliciti; listener Firebase conservato come seconda difesa. VS-P0-01 rimane aperto: chiave di wrapping e payload persistono ancora nello stesso storage durante la sessione. Nessuna prova fisica di crash/ripristino scheda né certificazione di operazioni di sblocco già in corso. Il Blocco 1 complessivo e il Blocco 2 non sono chiusi da questa correzione. Nessun deploy eseguito.
