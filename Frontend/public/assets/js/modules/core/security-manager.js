/**
 * SECURITY MANAGER (V9.0 - Vault Verifier & PRF)
 * - La masterKey è tenuta solo in RAM (_masterKey). Non persistita.
 * - Sblocco biometrico usa WebAuthn PRF.
 */

import { encrypt, decrypt, isEncryptedValue } from './crypto-utils.js';
import { showInputModal, showToast, showConfirmModal } from '../../ui-core.js';
import { db, auth } from '../../firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, limit, query } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { setupWebAuthnPrf, getPrfOutput, deriveHkdfKey, encryptVaultSecret, decryptVaultSecret, generateHkdfSalt, isWebAuthnSupported } from './webauthn-manager.js';

let _masterKey = null;
let _vaultAutoUnlock = false;
let _isSoftLocked = false;
const updateGlobalState = () => {};

const STORAGE_PREFIX = 'codex_vault_secret_';
const LEGACY_STORAGE_KEY = 'codex_vault_secret';


// --- VAULT VERIFIER ---
const VERIFIER_STORAGE_PREFIX = 'codex_vault_verifier_';
const VERIFIER_MARKER = 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1';

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
    sessionStorage.removeItem('vault_s_key');
    sessionStorage.removeItem('vault_s_expiry');
    updateGlobalState();
}

// FIX 4: Cleanup centralizzato su logout / cambio UID
let _currentUid = null;
onAuthStateChanged(auth, (user) => {
    if (!user) {
        clearSession();
        _currentUid = null;
    } else {
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
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    showToast('La Vault è stata protetta. Biometria disabilitata.', 'info');
}

export function softLock() {
    _isSoftLocked = true;
    _masterKey = null;
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
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) return true;
    return false;
}

export async function ensureMasterKey(options = {}) {
    const forceReload = typeof options === 'boolean' ? options : !!options.forceReload;

    if (_masterKey && !forceReload) return _masterKey;

    if (!forceReload) {
        const recovered = await tryBiometricUnlock();
        if (recovered) {
            _masterKey = recovered;
            updateGlobalState();
            return _masterKey;
        }
    }

    const uid = auth.currentUser?.uid;
    const scopedKey = getStorageKey(uid);
    let storedSecret = scopedKey ? localStorage.getItem(scopedKey) : null;
    let isLegacy = false;

    if (!storedSecret) {
        storedSecret = localStorage.getItem(LEGACY_STORAGE_KEY);
        isLegacy = !!storedSecret;
    }
    
    let isOldFormat = storedSecret && !storedSecret.startsWith('{');
    
    let msg = "Inserisci la password principale...";
    if (isOldFormat || isLegacy) {
        msg = "Migrazione sicurezza in corso: inserisci la Master Password per aggiornare l'accesso biometrico.";
    }

    const pass = await showInputModal("SBLOCCO VAULT", '', msg);

    if (pass) {
        const cleanPass = pass.normalize('NFC').trim();
        
        try {
            const verificationResult = await verifyMasterPassword(cleanPass, uid);
            
            if (verificationResult === true) {
                // Success
            } else if (verificationResult === 'LEGACY_MIGRATION_NEEDED') {
                const migrated = await migrateLegacyVault(cleanPass, uid);
                if (!migrated) {
                    showToast("Password errata o migrazione fallita.", "error");
                    throw new Error("Vault verification failed");
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

        _masterKey = cleanPass;
        _isSoftLocked = false;
        _vaultAutoUnlock = true;
        updateGlobalState();

        if (isOldFormat || isLegacy) {
            let isValid = true;
            if (isOldFormat) {
                const oldDecoded = decodeURIComponent(escape(atob(storedSecret))).normalize('NFC').trim();
                isValid = (oldDecoded === cleanPass);
            }
            if (isValid) {
                const migrated = await enableBiometricUnlock(cleanPass);
                if (migrated) {
                    localStorage.removeItem(LEGACY_STORAGE_KEY);
                    showToast("Migrazione WebAuthn completata con successo!", "success");
                }
            }
        }

        showToast("Vault sbloccata correttamente!", "success");
        return _masterKey;
    }

    throw new Error("Chiave di crittografia non fornita.");
}

export function resetVault() {
    _masterKey = null;
    _vaultAutoUnlock = false;
    _isSoftLocked = false;
    _clearSessionStorage();
    const uid = auth.currentUser?.uid;
    if (uid) localStorage.removeItem(getStorageKey(uid));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    updateGlobalState();
    showToast("Cache Vault pulita.", "info");
    setTimeout(() => window.location.reload(), 1500);
}

export async function setMasterKey(pass, saveForBiometrics = false) {
    const cleanPass = String(pass).normalize('NFC').trim();
    const uid = auth.currentUser?.uid;
    
    // Assicura che un verifier esista sempre quando viene impostata una password root
    try {
        const verificationResult = await verifyMasterPassword(cleanPass, uid);
        if (verificationResult === 'LEGACY_MIGRATION_NEEDED') {
            await createVerifier(cleanPass, uid);
        } else if (verificationResult === false) {
            console.warn('setMasterKey called with wrong password. Rejecting.');
            return;
        }
    } catch(e) {
        console.error('setMasterKey verifier check failed:', e);
    }
    
    _masterKey = cleanPass;
    const biometricAlreadyEnabled = !!(uid && localStorage.getItem(getStorageKey(uid))) || !!localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saveForBiometrics || biometricAlreadyEnabled) {
        await enableBiometricUnlock(cleanPass);
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
        if (data.version !== 1 || !data.credentialId || !data.encryptedMasterKey) return null;

        const prfOutput = await getPrfOutput(data.credentialId, data.prfSalt);
        const aesKey = await deriveHkdfKey(prfOutput, data.hkdfSalt);
        const secret = await decryptVaultSecret(data.encryptedMasterKey, data.iv, aesKey);
        
        // VERIFY WITH VAULT VERIFIER
        const verificationResult = await verifyMasterPassword(secret, uid);
        
        if (verificationResult === true) {
            showToast('Accesso Biometrico Confermato', 'success');
            return secret;
        } else if (verificationResult === 'LEGACY_MIGRATION_NEEDED') {
            const migrated = await migrateLegacyVault(secret, uid);
            if (migrated) {
                showToast('Accesso Biometrico Confermato (Migrato)', 'success');
                return secret;
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
            version: 1,
            credentialId: setup.credentialId,
            encryptedMasterKey: encrypted.ciphertext,
            iv: encrypted.iv,
            hkdfSalt: hkdfSalt,
            prfSalt: setup.prfSalt,
            algorithm: "AES-GCM-256",
            createdAt: Date.now()
        };

        const scopedKey = getStorageKey(user.uid);
        localStorage.setItem(scopedKey, JSON.stringify(container));
        
        // Clean legacy if it existed
        localStorage.removeItem(LEGACY_STORAGE_KEY);

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
            localStorage.removeItem(LEGACY_STORAGE_KEY);
        } else {
            showToast("Errore durante la configurazione della biometria.", "error");
        }
        return false;
    }
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
