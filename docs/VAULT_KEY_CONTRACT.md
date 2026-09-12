# Contratto delle chiavi della Vault

> **Stato:** attivo per terminologia e invarianti; implementazione runtime da verificare  
> **Autorità:** contratto specialistico subordinato ad [Architettura Sicurezza V1](./ARCHITETTURA_SICUREZZA_V1.md)  
> **Versione:** 1.0 riallineata  
> **Ultima verifica documentale:** 11 settembre 2026  
> **Codice interessato:** `security-manager.js`, `vault-session.js`, `crypto-utils.js`, WebAuthn/PRF, backup e condivisione

Questo documento definisce nomi e comportamento obiettivo. Quando descrive il formato esistente lo indica espressamente come **stato corrente da verificare**, non come garanzia di sicurezza.

## 1. Termini canonici

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

## 2. Stato documentato del formato esistente

I documenti e il codice storico dichiarano:

- verifier v2 con PBKDF2-SHA-256, 600.000 iterazioni e AES-GCM-256;
- `vaultKeyEnvelope` in `users/{uid}/settings/security`;
- cache locale di verifier/envelope e contenitore WebAuthn protetto per UID;
- `_vaultKeyMaterial` in RAM;
- keyring `CPVK2:` per leggere record precedenti;
- una funzione di “session wrapping” che salva in `sessionStorage` payload cifrato e chiave casuale di wrapping della stessa scheda.

L’ultimo punto è un **rischio P0 da verificare**: se ciphertext e chiave che lo apre sono entrambi accessibili nello stesso storage/origine, il wrapping non crea una separazione crittografica significativa contro script eseguiti nell’origine. Non deve essere descritto come “sicuro” finché threat model e codice non dimostrano una protezione diversa.

La descrizione dello stato corrente non autorizza a conservarlo.

## 3. Invarianti

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

## 4. Flusso obiettivo

1. La Master Password viene verificata tramite un verifier resistente agli attacchi offline.
2. Master Password e salt derivano la KEK in memoria.
3. La KEK apre `vaultKeyEnvelope`.
4. La KEK viene eliminata appena possibile.
5. Il Vault Key material resta in RAM durante la sessione sbloccata.
6. Record e allegati usano chiavi inferiori secondo il formato versionato.
7. Il blocco elimina il materiale sbloccato.
8. Il nuovo sblocco richiede Master Password oppure un contenitore protetto realmente dal dispositivo.

Il cambio Master Password deve riavvolgere la Vault Key quando il formato lo consente; non coincide con il cambio della password Firebase e non autorizza una migrazione senza test.

## 5. WebAuthn / PRF

WebAuthn/PRF può proteggere lo sblocco locale se:

- usa capacità reali del dispositivo e non una biometria simulata;
- conserva soltanto ciphertext, IV, salt, versione e identificatore credenziale;
- il segreto di apertura non è esportabile nello storage web ordinario;
- mantiene un fallback/recovery esplicitamente progettato;
- è collaudato sui browser e dispositivi supportati;
- revoca e cambio UID eliminano i contenitori non più validi.

I formati `encryptedMasterKey` o versione 1 possono restare lettori legacy soltanto finché inventario e migrazione ne richiedono la presenza.

## 6. KDF, wrapping e gerarchia

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

## 7. Recupero e rotazione

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

## 8. Verifiche P0 aperte

Prova di compatibilità locale 12/09/2026, base `553a35d5`: adattatore candidato in RAM verificato su fixture tramite `crypto-utils.js` reale, verifier/envelope v2 e CPVK2. Il materiale legacy resta testuale in RAM, non viene descritto come CryptoKey non esportabile. [Audit Vault §13](./AUDIT_VAULT_SESSION_P0.md#13-compatibilità-e-anteprima-offline--12092026) separa queste prove dal runtime reale e dal collaudo iPhone ancora richiesto.

Prototipo autorizzato 12/09/2026, base `a6f756cc`: navigazione persistente e CryptoKey solo in RAM provate esclusivamente su fixture fittizia in `experiments/persistent-vault-shell`. [Audit Vault §11](./AUDIT_VAULT_SESSION_P0.md#11-prototipo-autorizzato--12092026) definisce threat model, limiti e gate. Non è un lettore alternativo dei dati reali e non sostituisce la sessione produttiva.

Secondo intervento locale del 12/09/2026, base `67288cc3`: invalidazione delle operazioni asincrone dopo logout/blocco/reset e controllo UID prima della pubblicazione della chiave. Contatori solo in RAM, nessun nuovo formato persistito. Prove, compatibilità e limiti in [Audit Vault §9](./AUDIT_VAULT_SESSION_P0.md#9-correzione-locale-del-12092026--operazioni-concorrenti); proposta architetturale nella sezione 10, ancora da scegliere.

Aggiornamento locale 12/09/2026 (base v1.2.110): i sette comandi espliciti di logout cancellano il materiale locale prima di `signOut`, con test del comando comune anche in errore remoto. Evidenza e limiti in [Audit Vault, sezione 8](./AUDIT_VAULT_SESSION_P0.md#8-correzione-locale-del-12092026--blocco-1-logout). Il formato della sessione e gli invarianti restano invariati; la persistenza della chiave di wrapping rimane non conforme.

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

Aggiornamento sperimentale 12/09/2026, base `ff006c71`: annullamento esplicito delle dipendenze di sblocco e controlli tra caricamento, prompt, verifier e unwrap; errori di smontaggio delle viste segnalati al blocco. Invarianti e formati produttivi invariati. Evidenze: [Audit Vault §15](./AUDIT_VAULT_SESSION_P0.md#15-annullamento-e-robustezza-del-laboratorio--12092026).

Preparazione delle viste 12/09/2026, base `0a807adb`: i due orchestratori delle liste espongono dismissione e consumatori annullabili; il futuro chiamante deve collegarli a blocco/logout/cambio UID. Nessuna variazione del ciclo crittografico produttivo. [Audit §17](./AUDIT_VAULT_SESSION_P0.md#17-primo-adattamento-degli-orchestratori-reali--12092026).

Coordinamento sperimentale 12/09/2026, base `d906fd50`: il bootstrap candidato consegna lettori per vista, non chiavi; UID e revisione sono ricontrollati dopo le letture. Test integrato con verifier/envelope v2 sintetici riuscito. Il lettore legacy conserva materiale testuale/keyring in RAM; la CryptoKey della demo rimane una fixture distinta. [Audit §19](./AUDIT_VAULT_SESSION_P0.md#19-coordinamento-identità-vault-e-viste--12092026).

Prova emulata 12/09/2026, base `0e07621d`: login Firebase distinto da sblocco v2, secondo utente richiede la propria Master Password, logout invalida viste/letture. Vault senza envelope respinto senza provisioning. Parametri KDF e formati originali invariati; test con sole credenziali sintetiche. [Audit §20](./AUDIT_VAULT_SESSION_P0.md#20-sdk-firebase-e-sessione-protetta-in-emulatore--12092026).

Prova browser locale 12/09/2026, base `83dffc30`: il prompt Master annullabile cancella input e listener dopo uso; SDK Auth in memoria, sblocco v2 e letture per UID. Formati e parametri originali invariati. Nessuna attivazione produttiva. [Audit §21](./AUDIT_VAULT_SESSION_P0.md#21-interfaccia-browser-degli-emulatori--12092026).

Integrazione delle liste, 12/09/2026: capacità readField iniettata per montaggio, senza consegnare chiavi al renderer; il percorso candidato esclude il gestore della sessione legacy. Password lazy, letture revocabili e copie dei campi visibili solo in memoria. Il runtime pubblicato resta invariato. [Audit §22](./AUDIT_VAULT_SESSION_P0.md#22-liste-canoniche-e-repository-negli-emulatori--12092026).

Integrazione del dettaglio base, 12/09/2026: il repository consegna ciphertext a un lettore limitato al proprietario e alla vista; password lazy senza esporre record o chiavi al dettaglio. Controlli anche nell’ultima continuazione prima di mostra/copia. Nessun formato o parametro crittografico modificato. [Audit §23](./AUDIT_VAULT_SESSION_P0.md#23-dettaglio-base-protetto-e-ritorno-alla-lista--12092026).

Estensione locale del lettore di dettaglio, 12/09/2026: note e url aggiunti alla allowlist cifrata; errori dei campi aggiuntivi sanitizzati e plaintext rimosso al blocco. Nessuna migrazione di chiavi o parametri. [Audit §24](./AUDIT_VAULT_SESSION_P0.md#24-identità-dei-record-e-campi-aggiuntivi-del-dettaglio--12092026).
