const COMMON_PASSWORDS = new Set([
    'password', 'password1', '12345678', 'qwerty123', 'admin123'
]);

const DAY_MS = 86_400_000;

export function createCredentialHealthSessionKey() {
    return crypto.getRandomValues(new Uint8Array(32));
}

async function fingerprint(secret, sessionKey) {
    const key = await crypto.subtle.importKey(
        'raw', sessionKey, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']
    );
    return new Uint8Array(await crypto.subtle.sign(
        'HMAC', key, new TextEncoder().encode(secret)
    ));
}

function tokenToKey(token) {
    return Array.from(token, byte => byte.toString(16).padStart(2, '0')).join('');
}

function classifyStrength(secret) {
    if (COMMON_PASSWORDS.has(secret.toLowerCase())) return 'weak';
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/]
        .filter(pattern => pattern.test(secret)).length;
    if (secret.length >= 12 && classes === 4) return 'strong';
    if (secret.length >= 8 && classes >= 3) return 'medium';
    return 'weak';
}

function timestampMillis(value) {
    if (Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (Number.isFinite(value?.seconds)) return value.seconds * 1000;
    return null;
}

export async function analyzeCredentialHealth(records, {
    now = Date.now(), staleDays = 365, sessionKey = createCredentialHealthSessionKey()
} = {}) {
    const fingerprints = new Map();
    const internalResults = [];

    for (const record of records) {
        const secret = String(record.password ?? '');
        const flags = [];
        const strength = classifyStrength(secret);
        if (secret && strength === 'weak') flags.push('weak');
        const changedAt = timestampMillis(record.passwordUpdatedAt ?? record.updatedAt);
        if (secret && changedAt !== null && now - changedAt >= staleDays * DAY_MS) flags.push('dated');
        const token = secret ? tokenToKey(await fingerprint(secret, sessionKey)) : null;
        if (token) fingerprints.set(token, (fingerprints.get(token) ?? 0) + 1);
        internalResults.push({recordId: String(record.id), flags, strength, token});
    }

    return internalResults.map(({recordId, flags, strength, token}) => ({
        recordId,
        strength,
        flags: token && fingerprints.get(token) > 1 ? [...flags, 'duplicate'] : flags
    }));
}
