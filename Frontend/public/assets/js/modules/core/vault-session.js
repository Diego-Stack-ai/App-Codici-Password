/** Sessione Vault cifrata tra i caricamenti completi della stessa scheda. */
const SESSION_KEY = 'vault_session_v1';
const WRAPPING_KEY = 'codex_vault_session_wrapping_key_v1';
let sessionGeneration = 0;

const toBase64 = bytes => {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
};
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function getSessionKey(create = false) {
    let encodedKey = sessionStorage.getItem(WRAPPING_KEY);
    if (!encodedKey && create) {
        encodedKey = toBase64(crypto.getRandomValues(new Uint8Array(32)));
        sessionStorage.setItem(WRAPPING_KEY, encodedKey);
    }
    if (!encodedKey) return null;
    return crypto.subtle.importKey('raw', fromBase64(encodedKey), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function saveVaultSession(vaultKeyMaterial, uid, expiresAt = null) {
    if (!vaultKeyMaterial || !uid) return;
    const generation = ++sessionGeneration;
    try {
        const key = await getSessionKey(true);
        if (generation !== sessionGeneration) return false;
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(vaultKeyMaterial));
        if (generation !== sessionGeneration) return false;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            version: 1, uid, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)),
            expiresAt: Number(expiresAt) || null
        }));
        window.dispatchEvent(new Event('vault-session-unlocked'));
        return true;
    } catch (error) {
        if (generation !== sessionGeneration) return false;
        console.warn('[Vault Session] Persistenza non disponibile:', error);
        clearVaultSession();
        return false;
    }
}

export async function restoreVaultSession(uid) {
    const generation = sessionGeneration;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw || !uid) return null;
    try {
        const data = JSON.parse(raw);
        if (data.version !== 1 || data.uid !== uid || (data.expiresAt && Date.now() >= data.expiresAt)) {
            clearVaultSession();
            return null;
        }
        const key = await getSessionKey(false);
        if (generation !== sessionGeneration) return null;
        if (!key) return null;
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromBase64(data.iv) }, key, fromBase64(data.ciphertext)
        );
        if (generation !== sessionGeneration) return null;
        if (data.expiresAt && Date.now() >= data.expiresAt) {
            clearVaultSession();
            return null;
        }
        return new TextDecoder().decode(decrypted);
    } catch (error) {
        if (generation !== sessionGeneration) return null;
        console.warn('[Vault Session] Ripristino non riuscito:', error);
        clearVaultSession();
        return null;
    }
}

export function touchVaultSession(durationMs) {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        data.expiresAt = Date.now() + durationMs;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch { clearVaultSession(); }
}

export function getVaultSessionExpiry() {
    try { return Number(JSON.parse(sessionStorage.getItem(SESSION_KEY))?.expiresAt) || null; }
    catch { return null; }
}

export function clearVaultSession() {
    sessionGeneration++;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(WRAPPING_KEY);
    sessionStorage.removeItem('vault_s_key');
    sessionStorage.removeItem('vault_s_expiry');
}
