/**
 * SECURITY MANAGER (V9.0 - Vault Verifier & PRF)
 * - La masterKey è tenuta in RAM e cifrata per la durata della scheda attiva.
 * - Sblocco biometrico usa WebAuthn PRF.
 */

import { encrypt, decrypt, isEncryptedValue, generateVaultKey, createVaultKeyring, wrapVaultKey, unwrapVaultKey } from './crypto-utils.js';
import { showInputModal, showToast, showConfirmModal } from '../../ui-core.js';
import { db, auth } from '../../firebase-config.js?v=1.1.8';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, limit, query } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { setupWebAuthnPrf, getPrfOutput, deriveHkdfKey, encryptVaultSecret, decryptVaultSecret, generateHkdfSalt, isWebAuthnSupported } from './webauthn-manager.js';
import { saveVaultSession, restoreVaultSession, clearVaultSession } from './vault-session.js';
import { evaluatePassword, firstPasswordPolicyError, passwordPolicyMessage } from './password-policy.js';

let _masterKey = null;
let _vaultAutoUnlock = false;
let _isSoftLocked = false;
let _unlockPromise = null;
const updateGlobalState = () => {};

const STORAGE_PREFIX = 'codex_vault_secret_';

// Il vecchio contenitore non era protetto da WebAuthn PRF. Viene soltanto
// eliminato: non deve più essere letto, decodificato o usato per lo sblocco.
function purgeDeprecatedVaultSecrets(uid = null) {
    localStorage.removeItem('codex_vault_secret');
    const scopedKey = getStorageKey(uid);
    const scopedValue = scopedKey ? localStorage.getItem(scopedKey) : null;
    if (scopedValue && !scopedValue.startsWith('{')) localStorage.removeItem(scopedKey);
}

purgeDeprecatedVaultSecrets();


// --- VAULT VERIFIER ---
const VERIFIER_STORAGE_PREFIX = 'codex_vault_verifier_';
const VERIFIER_MARKER = 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1';
const ENVELOPE_STORAGE_PREFIX = 'codex_vault_envelope_';

function getVerifierStorageKey(uid) {
    return uid ? `${VERIFIER_STORAGE_PREFIX}${uid}` : null;
}

async function createVerifier(masterPassword, uid) {
    const ciphertext = await encrypt(VERIFIER_MARKER, masterPassword);
    const verifier = {
        version: 1,
        type: 'vault-verifier',
        ciphertext: ciphertext,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    try {
        await setDoc(doc(db, 'users', uid, 'settings', 'security'), { verifier: verifier }, { merge: true });
    } catch (e) {
        console.error('Firestore verifier write failed:', e);
        throw e;
    }
    
    localStorage.setItem(getVerifierStorageKey(uid), JSON.stringify(verifier));
    return verifier;
}

async function verifyMasterPassword(masterPassword, uid) {
    let verifierStr = localStorage.getItem(getVerifierStorageKey(uid));
    let verifier = null;
    
    if (verifierStr) {
        try { verifier = JSON.parse(verifierStr); } catch (e) {}
    }
    
    if (!verifier || verifier.type !== 'vault-verifier' || !verifier.ciphertext) {
        try {
            const snap = await getDoc(doc(db, 'users', uid, 'settings', 'security'));
            if (snap.exists() && snap.data().verifier) {
                verifier = snap.data().verifier;
                localStorage.setItem(getVerifierStorageKey(uid), JSON.stringify(verifier));
            }
        } catch (e) {
            console.error('Failed to fetch verifier from Firestore', e);
            throw new Error('NETWORK_REQUIRED_FOR_SECURITY_SYNC');
        }
    }
    
    if (!verifier || verifier.type !== 'vault-verifier' || !verifier.ciphertext) {
        return 'LEGACY_MIGRATION_NEEDED';
    }
    
    try {
        const decrypted = await decrypt(verifier.ciphertext, masterPassword);
        return (decrypted === VERIFIER_MARKER);
    } catch (e) {
        return false;
    }
}

async function migrateLegacyVault(candidatePassword, uid) {
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        const data = snap.exists() ? snap.data() : null;
        if (data) {
            const testFields = ['nome', 'cognome', 'cf', 'birth_place', 'note'];
            for (const field of testFields) {
                if (data[field] && isEncryptedValue(data[field])) {
                    const decrypted = await decrypt(data[field], candidatePassword);
                    if (decrypted && decrypted !== '--ERRORE--') {
                        await createVerifier(candidatePassword, uid);
                        return true;
                    } else if (decrypted === '--ERRORE--') {
                        return false;
                    }
                }
            }
        }
        
        const accountsSnap = await getDocs(query(collection(db, 'users', uid, 'accounts'), limit(1)));
        if (!accountsSnap.empty) {
            const accountData = accountsSnap.docs[0].data();
            const testFields = ['username', 'account', 'password', 'note'];
            for (const field of testFields) {
                if (accountData[field] && isEncryptedValue(accountData[field])) {
                    const decrypted = await decrypt(accountData[field], candidatePassword);
                    if (decrypted && decrypted !== '--ERRORE--') {
                        await createVerifier(candidatePassword, uid);
                        return true;
                    } else if (decrypted === '--ERRORE--') {
                        return false;
                    }
                }
            }
            console.warn('Found account but no verifiable encrypted fields.');
            return false;
        }
        
        const aziendeSnap = await getDocs(query(collection(db, 'users', uid, 'aziende'), limit(1)));
        if (aziendeSnap.empty) {
            await createVerifier(candidatePassword, uid);
            return true;
        } else {
            console.warn('Found aziende but did not find accounts to verify. Failing closed.');
            return false;
        }
    } catch (e) {
        console.error('Migration check failed:', e);
        throw new Error('NETWORK_REQUIRED_FOR_SECURITY_SYNC');
    }
}
// ----------------------

function getStorageKey(uid) {
    return uid ? `${STORAGE_PREFIX}${uid}` : null;
}

function _clearSessionStorage() {
    clearVaultSession();
    updateGlobalState();
}

// FIX 4: Cleanup centralizzato su logout / cambio UID
let _currentUid = null;
onAuthStateChanged(auth, (user) => {
    if (!user) {
        clearSession();
        _currentUid = null;
    } else {
        purgeDeprecatedVaultSecrets(user.uid);
        if (_currentUid && _currentUid !== user.uid) {
            clearSession();
        }
        _currentUid = user.uid;
    }
});

export function enableVaultAutoUnlock(durationMs = null) {
    if (!_masterKey) {
        showToast('Sblocca prima la Vault.', 'warning');
        return false;
    }
    _vaultAutoUnlock = true;
    updateGlobalState();
    return true;
}

export function disableVaultAutoUnlock() {
    _vaultAutoUnlock = false;
    _masterKey = null;
    _isSoftLocked = false;
    _clearSessionStorage();
    const uid = auth.currentUser?.uid;
    if (uid) {
        localStorage.removeItem(getStorageKey(uid));
    }
    showToast('La Vault è stata protetta. Biometria disabilitata.', 'info');
}

export function softLock() {
    _isSoftLocked = true;
    _masterKey = null;
    _clearSessionStorage();
    updateGlobalState();
}

export function isSoftLocked() { return _isSoftLocked; }

export function isAutoUnlockActive() {
    if (_vaultAutoUnlock && _masterKey) {
        updateGlobalState();
        return true;
    }
    const uid = auth.currentUser?.uid;
    const scopedKey = getStorageKey(uid);
    if (scopedKey && localStorage.getItem(scopedKey)) return true;
    return false;
}

function getEnvelopeStorageKey(uid) {
    return uid ? `${ENVELOPE_STORAGE_PREFIX}${uid}` : null;
}

async function loadVaultEnvelope(uid) {
    const cached = localStorage.getItem(getEnvelopeStorageKey(uid));
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed?.version === 2) return parsed;
        } catch (error) { /* recupera dalla copia remota */ }
    }
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'security'));
    const envelope = snap.exists() ? snap.data().vaultKeyEnvelope : null;
    if (envelope?.version === 2) localStorage.setItem(getEnvelopeStorageKey(uid), JSON.stringify(envelope));
    return envelope || null;
}

async function saveVaultEnvelope(uid, envelope) {
    await setDoc(doc(db, 'users', uid, 'settings', 'security'), { vaultKeyEnvelope: envelope }, { merge: true });
    localStorage.setItem(getEnvelopeStorageKey(uid), JSON.stringify(envelope));
}

async function resolveVaultKey(masterPassword, uid, newVault) {
    let envelope = await loadVaultEnvelope(uid);
    if (!envelope) {
        // I vault esistenti mantengono inizialmente la chiave dati corrente per evitare
        // una ricifratura non atomica. I vault nuovi ricevono subito 256 bit casuali.
        const vaultKey = newVault
            ? generateVaultKey()
            : createVaultKeyring(generateVaultKey(), masterPassword);
        envelope = await wrapVaultKey(vaultKey, masterPassword, newVault ? 'random' : 'random-with-legacy-fallback');
        await saveVaultEnvelope(uid, envelope);
        return vaultKey;
    }
    return unwrapVaultKey(envelope, masterPassword);
}

async function isNewVault(uid) {
    const [userSnap, accountsSnap, aziendeSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDocs(query(collection(db, 'users', uid, 'accounts'), limit(1))),
        getDocs(query(collection(db, 'users', uid, 'aziende'), limit(1)))
    ]);
    const userData = userSnap.exists() ? userSnap.data() : {};
    const encryptedProfileFields = ['nome', 'cognome', 'cf', 'birth_place', 'note']
        .some(field => isEncryptedValue(userData[field]));
    return !encryptedProfileFields && accountsSnap.empty && aziendeSnap.empty;
}

export function isBiometricUnlockConfigured() {
    const uid = auth.currentUser?.uid;
    purgeDeprecatedVaultSecrets(uid);
    const scopedKey = getStorageKey(uid);
    return !!(scopedKey && localStorage.getItem(scopedKey));
}

export async function ensureMasterKey(options = {}) {
    const forceReload = typeof options === 'boolean' ? options : !!options.forceReload;
    if (_masterKey && !forceReload) return _masterKey;
    if (_unlockPromise && !forceReload) return _unlockPromise;

    const operation = ensureMasterKeyInternal(options);
    _unlockPromise = operation;
    try {
        return await operation;
    } finally {
        if (_unlockPromise === operation) _unlockPromise = null;
    }
}

async function ensureMasterKeyInternal(options = {}) {
    const forceReload = typeof options === 'boolean' ? options : !!options.forceReload;

    if (_masterKey && !forceReload) return _masterKey;

    const uid = auth.currentUser?.uid;
    if (!forceReload && uid) {
        const sessionKey = await restoreVaultSession(uid);
        if (sessionKey) {
            _masterKey = sessionKey;
            _isSoftLocked = false;
            _vaultAutoUnlock = true;
            updateGlobalState();
            return _masterKey;
        }
    }

    if (!forceReload) {
        const recovered = await tryBiometricUnlock();
        if (recovered) {
            _masterKey = recovered;
            await saveVaultSession(_masterKey, uid);
            updateGlobalState();
            return _masterKey;
        }
    }

    let msg = "Master Password";
    let description = `${passwordPolicyMessage('master')} Deve essere diversa dalla password dell’account. Non è recuperabile.`;

    const offerMasterSuggestion = !isBiometricUnlockConfigured() && await isNewVault(uid);
    const pass = await showInputModal(
        "SBLOCCO VAULT", '', msg, description,
        { vaultSecret: true, ...(offerMasterSuggestion ? { suggestPassword: true, length: 24 } : {}) }
    );

    if (pass) {
        const cleanPass = pass.normalize('NFC').trim();
        
        try {
            const verificationResult = await verifyMasterPassword(cleanPass, uid);
            
            if (verificationResult === true) {
                // Success
            } else if (verificationResult === 'LEGACY_MIGRATION_NEEDED') {
                if (await isNewVault(uid)) {
                    if (!evaluatePassword(cleanPass, 'master').valid) {
                        showToast(firstPasswordPolicyError(cleanPass, 'master'), "warning");
                        throw new Error("Master password policy failed");
                    }
                    const confirmation = await showInputModal(
                        "CONFERMA MASTER PASSWORD",
                        '',
                        "Reinserisci la Master Password",
                        "Conservala in un luogo sicuro: non può essere recuperata.",
                        { vaultSecret: true }
                    );
                    if (!confirmation || confirmation.normalize('NFC').trim() !== cleanPass) {
                        showToast("Le Master Password non coincidono.", "error");
                        throw new Error("Master password confirmation failed");
                    }
                    await createVerifier(cleanPass, uid);
                } else {
                    const migrated = await migrateLegacyVault(cleanPass, uid);
                    if (!migrated) {
                        showToast("Password errata o migrazione fallita.", "error");
                        throw new Error("Vault verification failed");
                    }
                }
            } else {
                showToast("Password Vault Errata", "error");
                throw new Error("Vault verification failed");
            }
        } catch (e) {
            if (e.message === 'NETWORK_REQUIRED_FOR_SECURITY_SYNC') {
                showToast("Per completare l'aggiornamento di sicurezza è necessaria una connessione.", "error");
            }
            throw e;
        }

        _masterKey = await resolveVaultKey(cleanPass, uid, await isNewVault(uid));
        _isSoftLocked = false;
        _vaultAutoUnlock = true;
        await saveVaultSession(_masterKey, uid);
        updateGlobalState();

        showToast("Vault sbloccata correttamente!", "success");
        return _masterKey;
    }

    throw new Error("Chiave di crittografia non fornita.");
}

export async function resetVault() {
    _masterKey = null;
    _vaultAutoUnlock = false;
    _isSoftLocked = false;
    _clearSessionStorage();
    const uid = auth.currentUser?.uid;
    let syncFailed = false;
    if (uid) {
        localStorage.removeItem(getStorageKey(uid));
        try {
            await updateDoc(doc(db, "users", uid), { settings_biometric: false });
        } catch (error) {
            console.error("Biometric preference cleanup failed", error);
            showToast("Accesso biometrico rimosso dal dispositivo; sincronizzazione non riuscita.", "warning");
            syncFailed = true;
        }
    }
    updateGlobalState();
    showToast("Accesso biometrico rimosso. La Vault richiederà la Master Password.", "info");
    setTimeout(() => window.location.reload(), 1500);
    return !syncFailed;
}

export async function setMasterKey(pass, saveForBiometrics = false) {
    const cleanPass = String(pass).normalize('NFC').trim();
    const uid = auth.currentUser?.uid;
    
    // FIX 4: UID SAFETY
    if (!uid) {
        _masterKey = null;
        _vaultAutoUnlock = false;
        return; // STOP
    }
    
    // Assicura che un verifier esista sempre quando viene impostata una password root
    try {
        const verificationResult = await verifyMasterPassword(cleanPass, uid);
        if (verificationResult === 'LEGACY_MIGRATION_NEEDED') {
            // FIX 2: NO VERIFIER CREATION CIECA
            const migrated = await migrateLegacyVault(cleanPass, uid);
            if (!migrated) {
                // FIX 1: setMasterKey FAIL-CLOSED
                _masterKey = null;
                _vaultAutoUnlock = false;
                throw new Error("Vault verification/migration failed in setMasterKey");
            }
        } else if (verificationResult === false) {
            // FIX 1: setMasterKey FAIL-CLOSED
            console.warn('setMasterKey called with wrong password. Rejecting.');
            _masterKey = null;
            _vaultAutoUnlock = false;
            throw new Error("Wrong Vault Password");
        }
    } catch(e) {
        // FIX 3: ERROR PROPAGATION (uscita fail-closed)
        console.error('setMasterKey verifier check failed:', e);
        _masterKey = null;
        _vaultAutoUnlock = false;
        throw e;
    }
    
    _masterKey = await resolveVaultKey(cleanPass, uid, await isNewVault(uid));
    _isSoftLocked = false;
    _vaultAutoUnlock = true;
    await saveVaultSession(_masterKey, uid);
    const biometricAlreadyEnabled = !!localStorage.getItem(getStorageKey(uid));
    if (saveForBiometrics || biometricAlreadyEnabled) {
        await enableBiometricUnlock(_masterKey);
    }
    updateGlobalState();
}

async function tryBiometricUnlock() {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    
    const encryptedSecret = localStorage.getItem(getStorageKey(uid));
    
    if (!encryptedSecret) return null;

    if (!encryptedSecret.startsWith('{')) {
        return null;
    }

    try {
        const data = JSON.parse(encryptedSecret);
        if (![1, 2].includes(data.version) || !data.credentialId || !(data.encryptedVaultKey || data.encryptedMasterKey)) return null;

        const prfOutput = await getPrfOutput(data.credentialId, data.prfSalt);
        const aesKey = await deriveHkdfKey(prfOutput, data.hkdfSalt);
        const secret = await decryptVaultSecret(data.encryptedVaultKey || data.encryptedMasterKey, data.iv, aesKey);
        
        // VERIFY WITH VAULT VERIFIER
        if (data.version === 2) {
            showToast('Accesso Biometrico Confermato', 'success');
            return secret;
        }

        const verificationResult = await verifyMasterPassword(secret, uid);
        
        if (verificationResult === true) {
            const vaultKey = await resolveVaultKey(secret, uid, await isNewVault(uid));
            showToast('Accesso Biometrico Confermato', 'success');
            return vaultKey;
        } else if (verificationResult === 'LEGACY_MIGRATION_NEEDED') {
            const migrated = await migrateLegacyVault(secret, uid);
            if (migrated) {
                showToast('Accesso Biometrico Confermato (Migrato)', 'success');
                const vaultKey = await resolveVaultKey(secret, uid, await isNewVault(uid));
                return vaultKey;
            }
        }
        
        console.warn('Biometric PRF decrypted secret but Vault Verifier rejected it.');
        return null;
        
    } catch (e) {
        if (e.message === 'NETWORK_REQUIRED_FOR_SECURITY_SYNC') {
            showToast('Connessione necessaria per verifica sicurezza offline.', 'warning');
        } else {
            console.error('[SECURITY-AUDIT] Biometric recovery failed:', e);
        }
        return null;
    }
}

export async function enableBiometricUnlock(pass) {
    if (!pass) return false;
    
    if (!await isWebAuthnSupported()) {
        showToast("WebAuthn non è supportato su questo dispositivo.", "error");
        return false;
    }

    const cleanPass = String(pass).normalize('NFC').trim();
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Utente non loggato");

        const setup = await setupWebAuthnPrf(user.uid, user.email);
        
        // FIX 3: Evitare doppio prompt
        const prfOutput = setup.prfOutput || await getPrfOutput(setup.credentialId, setup.prfSalt);
        
        const hkdfSalt = generateHkdfSalt();
        const aesKey = await deriveHkdfKey(prfOutput, hkdfSalt);
        
        const encrypted = await encryptVaultSecret(cleanPass, aesKey);

        const container = {
            version: 2,
            credentialId: setup.credentialId,
            encryptedVaultKey: encrypted.ciphertext,
            iv: encrypted.iv,
            hkdfSalt: hkdfSalt,
            prfSalt: setup.prfSalt,
            algorithm: "AES-GCM-256",
            createdAt: Date.now()
        };

        const scopedKey = getStorageKey(user.uid);
        localStorage.setItem(scopedKey, JSON.stringify(container));
        
        // Aggiorna impostazione su Firebase
        await updateDoc(doc(db, "users", user.uid), { settings_biometric: true });

        showToast("Biometria PRF configurata localmente in modo sicuro", "success");
        return true;
    } catch (e) {
        console.error("Biometric setup failed", e);
        if (e.message === 'PRF_NOT_SUPPORTED') {
            showToast("Il dispositivo non supporta l'estensione PRF. Impossibile usare la biometria offline.", "error");
            // Se fallisce, eliminiamo anche la falsa biometria se c'era
            const uid = auth.currentUser?.uid;
            if (uid) localStorage.removeItem(getStorageKey(uid));
        } else {
            showToast("Errore durante la configurazione della biometria.", "error");
        }
        return false;
    }
}

export async function changeMasterPassword() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Utente non autenticato.');
    const oldPassword = await showInputModal('CAMBIA MASTER PASSWORD', '', 'Master Password attuale', 'Verifica la chiave attuale della Vault.', { vaultSecret: true });
    if (!oldPassword) return false;
    const cleanOld = oldPassword.normalize('NFC').trim();
    if (await verifyMasterPassword(cleanOld, uid) !== true) throw new Error('Master Password attuale errata.');

    const newPassword = await showInputModal('NUOVA MASTER PASSWORD', '', 'Nuova Master Password', passwordPolicyMessage('master'), { vaultSecret: true, suggestPassword: true, length: 24, passwordType: 'master' });
    if (!newPassword) return false;
    const cleanNew = newPassword.normalize('NFC').trim();
    if (!evaluatePassword(cleanNew, 'master').valid) throw new Error(firstPasswordPolicyError(cleanNew, 'master'));
    if (cleanNew === cleanOld) throw new Error('La nuova Master Password deve essere diversa dalla precedente.');
    const confirmation = await showInputModal('CONFERMA MASTER PASSWORD', '', 'Reinserisci la nuova Master Password', 'Il cambio non modifica la password di login.', { vaultSecret: true });
    if (!confirmation || confirmation.normalize('NFC').trim() !== cleanNew) throw new Error('Le nuove Master Password non coincidono.');

    const envelope = await loadVaultEnvelope(uid);
    const vaultKey = envelope
        ? await unwrapVaultKey(envelope, cleanOld)
        : createVaultKeyring(generateVaultKey(), cleanOld);
    const newEnvelope = await wrapVaultKey(vaultKey, cleanNew, envelope?.keyOrigin || 'random-with-legacy-fallback');
    const verifier = {
        version: 1, type: 'vault-verifier',
        ciphertext: await encrypt(VERIFIER_MARKER, cleanNew),
        createdAt: Date.now(), updatedAt: Date.now()
    };
    await setDoc(doc(db, 'users', uid, 'settings', 'security'), { verifier, vaultKeyEnvelope: newEnvelope }, { merge: true });
    localStorage.setItem(getVerifierStorageKey(uid), JSON.stringify(verifier));
    localStorage.setItem(getEnvelopeStorageKey(uid), JSON.stringify(newEnvelope));
    localStorage.removeItem(getStorageKey(uid));
    _masterKey = vaultKey;
    await saveVaultSession(vaultKey, uid);
    showToast('Master Password modificata. Riattiva la biometria su questo dispositivo.', 'success');
    return true;
}

export function clearSession() {
    _masterKey = null;
    _vaultAutoUnlock = false;
    _isSoftLocked = false;
    _clearSessionStorage();
    updateGlobalState();
}

updateGlobalState();
export { encrypt, decrypt };
