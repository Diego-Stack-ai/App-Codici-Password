/** Sessione effimera del solo documento corrente; nessun materiale nello storage. */
const SESSION_KEY = 'vault_session_v1';
const WRAPPING_KEY = 'codex_vault_session_wrapping_key_v1';
let sessionGeneration = 0;
let sessionPayload = null;
let wrappingKey = null;

const LOG_LABELS = '|permission-denied|unavailable|not-found|failed-precondition|unauthenticated|OperationError|InvalidStateError|Error|';
export const logErrorLabel = v => { try { const c = String(typeof v?.code === 'string' ? v.code : v?.name ?? ''); return LOG_LABELS.includes('|' + c + '|') ? c : 'Error'; } catch { return 'Error'; } };

const toBase64 = bytes => {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
};
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function getSessionKey(create = false) {
    if (wrappingKey || !create) return wrappingKey;
    const generation = sessionGeneration;
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    if (generation !== sessionGeneration) return null;
    wrappingKey = key;
    return key;
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
        sessionPayload = JSON.stringify({
            version: 1, uid, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)),
            expiresAt: Number(expiresAt) || null
        });
        window.dispatchEvent(new Event('vault-session-unlocked'));
        return true;
    } catch (error) {
        if (generation !== sessionGeneration) return false;
        console.warn('[Vault Session] Persistenza non disponibile:', logErrorLabel(error));
        clearVaultSession();
        return false;
    }
}

export async function restoreVaultSession(uid) {
    const generation = sessionGeneration;
    const raw = sessionPayload;
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
        console.warn('[Vault Session] Ripristino non riuscito:', logErrorLabel(error));
        clearVaultSession();
        return null;
    }
}

export function touchVaultSession(durationMs) {
    const raw = sessionPayload;
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        data.expiresAt = Date.now() + durationMs;
        sessionPayload = JSON.stringify(data);
    } catch { clearVaultSession(); }
}

export function getVaultSessionExpiry() {
    try { return Number(JSON.parse(sessionPayload)?.expiresAt) || null; }
    catch { return null; }
}

export function clearVaultSession() {
    sessionGeneration++;
    sessionPayload = null;
    wrappingKey = null;
    let failure;
    for (const name of [SESSION_KEY, WRAPPING_KEY, 'vault_s_key', 'vault_s_expiry']) {
        try { sessionStorage.removeItem(name); }
        catch (error) { failure ||= error; }
    }
    if (failure) throw failure;
}

// Never import or reuse the old colocated pair, including on a cached page.
clearVaultSession();
