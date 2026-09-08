const encoder = new TextEncoder();
const decoder = new TextDecoder();
const toBase64 = value => {
    let binary = '';
    for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
    return btoa(binary);
};
const fromBase64 = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

async function deriveWrappingKey(vaultKeyMaterial, salt, usages) {
    if (!String(vaultKeyMaterial || '').trim()) throw new Error('SHARING_VAULT_KEY_REQUIRED');
    const source = await crypto.subtle.importKey('raw', encoder.encode(vaultKeyMaterial), 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        {name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('CodiciPassword:sharing-identity:v1')},
        source, {name: 'AES-GCM', length: 256}, false, usages
    );
}

async function publicKeyId(publicJwk) {
    const canonical = JSON.stringify({crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y});
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonical));
    return toBase64(digest).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function createSharingIdentity({uid, vaultKeyMaterial, createdAt = Date.now()}) {
    if (!uid) throw new Error('SHARING_UID_REQUIRED');
    const pair = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
    const [publicJwk, privateJwk] = await Promise.all([
        crypto.subtle.exportKey('jwk', pair.publicKey), crypto.subtle.exportKey('jwk', pair.privateKey)
    ]);
    const keyId = await publicKeyId(publicJwk);
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = encoder.encode(`CodiciPassword:sharing-identity:v1:${uid}:${keyId}`);
    const ciphertext = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: aad},
        await deriveWrappingKey(vaultKeyMaterial, salt, ['encrypt']),
        encoder.encode(JSON.stringify(privateJwk))
    );
    return {
        publicIdentity: {schemaVersion: 1, agreement: 'ECDH-P256', uid, keyId, publicJwk, createdAt},
        privateEnvelope: {schemaVersion: 1, cipher: 'HKDF-SHA256+A256GCM', uid, keyId, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext), createdAt}
    };
}

export async function openSharingIdentity({publicIdentity, privateEnvelope, uid, vaultKeyMaterial}) {
    if (publicIdentity?.schemaVersion !== 1 || privateEnvelope?.schemaVersion !== 1 ||
        publicIdentity.uid !== uid || privateEnvelope.uid !== uid ||
        publicIdentity.keyId !== privateEnvelope.keyId ||
        await publicKeyId(publicIdentity.publicJwk) !== publicIdentity.keyId) {
        throw new Error('SHARING_IDENTITY_MISMATCH');
    }
    const aad = encoder.encode(`CodiciPassword:sharing-identity:v1:${uid}:${publicIdentity.keyId}`);
    let privateJwk;
    try {
        const clear = await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: fromBase64(privateEnvelope.iv), additionalData: aad},
            await deriveWrappingKey(vaultKeyMaterial, fromBase64(privateEnvelope.salt), ['decrypt']),
            fromBase64(privateEnvelope.ciphertext)
        );
        privateJwk = JSON.parse(decoder.decode(clear));
    } catch {
        throw new Error('SHARING_IDENTITY_AUTHENTICITY_INVALID');
    }
    const [publicKey, privateKey] = await Promise.all([
        crypto.subtle.importKey('jwk', publicIdentity.publicJwk, {name: 'ECDH', namedCurve: 'P-256'}, false, []),
        crypto.subtle.importKey('jwk', privateJwk, {name: 'ECDH', namedCurve: 'P-256'}, false, ['deriveBits'])
    ]);
    return {keyId: publicIdentity.keyId, publicKey, privateKey};
}

export function assertIdentityUpdate(currentIdentity, candidateIdentity) {
    if (currentIdentity && currentIdentity.keyId !== candidateIdentity?.keyId) {
        throw new Error('SHARING_IDENTITY_REPLACEMENT_REQUIRES_RECOVERY');
    }
    return candidateIdentity;
}
