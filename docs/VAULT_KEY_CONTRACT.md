# Contratto delle chiavi della Vault

Questo documento fissa la terminologia della fase M1. Non modifica algoritmi, formati o dati.

## Termini canonici

- **Password account**: credenziale Firebase Authentication. Non cifra la Vault.
- **Master Password**: segreto conosciuto dall'utente. Verifica lo sblocco e deriva la KEK; non è la chiave dati dei Vault nuovi.
- **Verifier**: prova cifrata usata per verificare la Master Password senza conservarla. Il formato v2 usa PBKDF2-SHA256 (600.000 iterazioni) e AES-GCM-256.
- **KEK (Key Encryption Key)**: chiave temporanea derivata dalla Master Password e dal salt dell'envelope. Serve soltanto ad aprire o proteggere la Vault Key.
- **Vault Key**: segreto casuale a 256 bit che cifra i dati applicativi.
- **Vault Key material**: valore runtime consumato da `encrypt`/`decrypt`. Può essere una Vault Key singola oppure un keyring di transizione.
- **Envelope**: oggetto `vault-key-envelope` che contiene la Vault Key cifrata dalla KEK.
- **Keyring legacy**: valore `CPVK2:` con chiave primaria casuale e fallback del vecchio modello. Le nuove cifrature usano la primaria; il fallback mantiene leggibili i record precedenti.
- **Session wrapping**: copia temporanea del Vault Key material cifrata in `sessionStorage` con una chiave casuale della stessa scheda.

## Flusso e ciclo di vita

1. La Master Password viene verificata tramite il verifier.
2. Da Master Password e salt viene derivata in memoria la KEK.
3. La KEK apre `vaultKeyEnvelope`; il risultato è il Vault Key material.
4. Il materiale resta in RAM e può essere session-wrapped nella scheda attiva.
5. `softLock()` e `clearSession()` azzerano il riferimento in RAM e rimuovono payload e chiave di wrapping dalla sessione.
6. Il cambio Master Password riavvolge la stessa Vault Key: non ricifra tutti i record e non cambia la password account.

## WebAuthn / PRF

La configurazione biometrica v2 protegge localmente il Vault Key material con una chiave derivata dall'output PRF WebAuthn. Conserva ciphertext, IV, salt e identificatore credenziale, mai la Master Password in chiaro. `encryptedMasterKey` e il formato versione 1 restano soltanto compatibilità di lettura.

## Confini di persistenza

- Firestore `users/{uid}/settings/security`: `verifier`, `vaultKeyEnvelope`.
- `localStorage`: copie cache di verifier/envelope e contenitore biometrico protetto per UID.
- `sessionStorage`: `vault_session_v1` e chiave casuale di wrapping, entrambi eliminati al blocco/logout.
- RAM: `_vaultKeyMaterial`, eliminato al blocco/logout o cambio utente.

`ensureVaultKeyMaterial()` è il nome API canonico. `ensureMasterKey` rimane temporaneamente un alias per i moduli non ancora rinominati.
