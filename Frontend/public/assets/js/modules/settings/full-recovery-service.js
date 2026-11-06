import {createBackupHeader, deriveBackupKey, decryptBackupEntry, encryptBackupEntry, generateRecoveryKey,
    parseBackupLine, serializeBackupLine, validateBackupHeader, FULL_RECOVERY_PROFILE} from './backup-crypto.js';
import {unwrapVaultKey, wrapVaultKey, createVaultVerifier, verifyVaultVerifier, decryptRequiredValue} from '../core/crypto-utils.js';
import {openSharingIdentity} from '../core/sharing-identity.js';
import {evaluatePassword} from '../core/password-policy.js';
import {decryptAttachmentBytes, unwrapAttachmentFileKey} from '../shared/attachment-security.js';
import {decryptAttachmentChunkBytesWithFileKey} from '../shared/chunked-attachment-security.js';
import {createRecordDescriptorFromData} from './backup-export-model.js';
import {describeRestoreRecords} from './backup-import-model.js';
import {assertRecoveryContentCapacity} from './recovery-transport-limits.js';
import {RECOVERY_BUCKET, MAX_RECOVERY_ASSET_BYTES, MAX_RECOVERY_FILE_BYTES, assertRecoveryUid, canonicalRecoveryJson,
    appendRecoveryAssetMetadata, cloneRecoveryValue, createRecoveryInventory, digestRecoveryValue, exactKeys, fail, fullRecoveryRecordKey, recoveryBase64, recoveryBytes,
    recoveryDigest, recoveryManifest, validateRecoveryAssetMetadata, validateVaultMaterial} from './full-recovery-model.js';

const VERIFIER_MARKER = 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1';
const MAX_LINE_CHARACTERS = Math.ceil((Math.ceil(MAX_RECOVERY_ASSET_BYTES / 3) * 4 + 65536 + 16) / 3) * 4 + 65536;
const sessions = new WeakMap();
const withoutId = value => value ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id')) : null;
const immutable = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(immutable); Object.freeze(value);
    }
    return value;
};

async function confirmedIdentity(identity, uid, material) {
    exactKeys(identity, ['publicIdentity', 'privateEnvelope'], 'RECOVERY_IDENTITY_INCOMPLETE');
    if (identity.publicIdentity === undefined || identity.privateEnvelope === undefined) fail('RECOVERY_IDENTITY_INCOMPLETE');
    const publicIdentity = withoutId(identity?.publicIdentity), privateEnvelope = withoutId(identity?.privateEnvelope);
    if (!publicIdentity && !privateEnvelope) return {state: 'absent'};
    if (!publicIdentity || !privateEnvelope) fail('RECOVERY_IDENTITY_INCOMPLETE');
    exactKeys(publicIdentity, ['schemaVersion', 'agreement', 'uid', 'keyId', 'publicJwk', 'createdAt']);
    exactKeys(privateEnvelope, ['schemaVersion', 'cipher', 'uid', 'keyId', 'salt', 'iv', 'ciphertext', 'createdAt']);
    const jwk = publicIdentity.publicJwk;
    if (publicIdentity.agreement !== 'ECDH-P256' || privateEnvelope.cipher !== 'HKDF-SHA256+A256GCM' ||
        !jwk || Object.keys(jwk).some(key => !['kty', 'crv', 'x', 'y', 'ext', 'key_ops'].includes(key)) ||
        jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !/^[A-Za-z0-9_-]{43}$/.test(jwk.x || '') ||
        !/^[A-Za-z0-9_-]{43}$/.test(jwk.y || '') ||
        (jwk.ext !== undefined && typeof jwk.ext !== 'boolean') ||
        (jwk.key_ops !== undefined && (!Array.isArray(jwk.key_ops) || jwk.key_ops.length)) ||
        !Number.isSafeInteger(publicIdentity.createdAt) || publicIdentity.createdAt < 0 ||
        !Number.isSafeInteger(privateEnvelope.createdAt) || privateEnvelope.createdAt < 0) fail('RECOVERY_IDENTITY_INVALID');
    recoveryBytes(privateEnvelope.salt, 32).fill(0); recoveryBytes(privateEnvelope.iv, 12).fill(0);
    const ciphertext = recoveryBytes(privateEnvelope.ciphertext);
    try { if (ciphertext.length < 17 || ciphertext.length > 16384) fail('RECOVERY_IDENTITY_INVALID'); }
    finally { ciphertext.fill(0); }
    const opened = await openSharingIdentity({uid, publicIdentity, privateEnvelope, vaultKeyMaterial: material});
    const challenge = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, false, ['deriveBits']);
    let a, b;
    try {
        a = new Uint8Array(await crypto.subtle.deriveBits({name: 'ECDH', public: challenge.publicKey}, opened.privateKey, 256));
        b = new Uint8Array(await crypto.subtle.deriveBits({name: 'ECDH', public: opened.publicKey}, challenge.privateKey, 256));
        let difference = a.length ^ b.length;
        for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
        if (difference) fail('RECOVERY_IDENTITY_PAIR_MISMATCH');
    } finally { a?.fill(0); b?.fill(0); }
    return {state: 'present', publicIdentity: cloneRecoveryValue(publicIdentity), privateEnvelope: cloneRecoveryValue(privateEnvelope)};
}

async function validateCapsule(capsule, header) {
    exactKeys(capsule, ['kind', 'schemaVersion', 'ownerUid', 'backupId', 'vaultKeyMaterial', 'keyOrigin', 'sourceSecurityBinding', 'sharingIdentity']);
    if (capsule.kind !== 'recovery' || capsule.schemaVersion !== 1 || capsule.ownerUid !== header.ownerUid ||
        capsule.backupId !== header.backupId || !/^[a-f0-9]{64}$/.test(capsule.sourceSecurityBinding || '')) fail('RECOVERY_CAPSULE_INVALID');
    validateVaultMaterial(capsule.vaultKeyMaterial, capsule.keyOrigin);
    const identity = capsule.sharingIdentity;
    if (identity?.state === 'absent') exactKeys(identity, ['state']);
    else {
        exactKeys(identity, ['state', 'publicIdentity', 'privateEnvelope']);
        if (identity.state !== 'present') fail('RECOVERY_IDENTITY_INVALID');
        await confirmedIdentity({publicIdentity: identity.publicIdentity, privateEnvelope: identity.privateEnvelope}, header.ownerUid, capsule.vaultKeyMaterial);
    }
    return capsule;
}

async function verifyAssetBytes(asset, expected, material) {
    validateRecoveryAssetMetadata(asset, expected);
    const bytes = recoveryBytes(asset.content, asset.size);
    let plaintext, fileKey;
    try {
        if (await recoveryDigest(bytes) !== asset.sha256) fail('RECOVERY_ASSET_DIGEST_INVALID');
        if (expected.encryption) {
            if (expected.chunk) {
                fileKey = await unwrapAttachmentFileKey(expected.encryption, material);
                plaintext = await decryptAttachmentChunkBytesWithFileKey(bytes, expected.encryption, expected.chunk, fileKey);
            } else plaintext = await decryptAttachmentBytes(bytes, expected.encryption, material);
            const expectedSize = expected.chunk?.clearSize ?? expected.encryption.originalSize;
            if (plaintext.byteLength !== expectedSize) fail('RECOVERY_ASSET_PLAINTEXT_SIZE_INVALID');
        }
        return bytes;
    } catch (error) { bytes.fill(0); throw error; }
    finally { if (plaintext) new Uint8Array(plaintext).fill(0); fileKey?.fill(0); }
}
async function verifyProfileNames(records, material, check) {
    for (const record of records.filter(record => record.scope === 'profile-document-attachment')) {
        let name = await decryptRequiredValue(record.data.encryptedName, material); check();
        if (typeof name !== 'string' || !name) fail('RECOVERY_PROFILE_NAME_INVALID');
        name = '';
    }
}

// All readers are explicitly injected. No Firebase writes, security provisioning,
// token downloads, storage persistence, or automatic UI activation live here.
export async function writeCompleteRecoveryBackup({uid, collectRecords, readSecurity, promptMasterPassword,
    readIdentity, listProfileAttachments, readAsset, writeLine, check = () => {}, bucket = RECOVERY_BUCKET} = {}) {
    assertRecoveryUid(uid);
    if ([collectRecords, readSecurity, promptMasterPassword, readIdentity, listProfileAttachments, readAsset, writeLine].some(fn => typeof fn !== 'function')) fail('RECOVERY_ADAPTER_REQUIRED');
    let material = '', masterPassword = '', recoveryKey = '', capsule, records, assets = [];
    try {
        check();
        const security = withoutId(await readSecurity(uid)); check();
        if (!security?.vaultKeyEnvelope) fail('RECOVERY_CONFIRMED_ENVELOPE_REQUIRED');
        const sourceSecurityBinding = await digestRecoveryValue(security); check();
        masterPassword = await promptMasterPassword(); check();
        if (typeof masterPassword !== 'string' || !masterPassword) fail('RECOVERY_MASTER_VERIFICATION_REQUIRED');
        material = await unwrapVaultKey(security.vaultKeyEnvelope, masterPassword); masterPassword = ''; check();
        const keyOrigin = security.vaultKeyEnvelope.keyOrigin;
        validateVaultMaterial(material, keyOrigin);
        const identity = await readIdentity(uid); check();
        const sharingIdentity = await confirmedIdentity(identity, uid, material); check();
        const sourceIdentityBinding = await digestRecoveryValue({publicIdentity: withoutId(identity?.publicIdentity), privateEnvelope: withoutId(identity?.privateEnvelope)});
        const collected = await collectRecords(uid); check();
        records = cloneRecoveryValue(Array.isArray(collected) ? collected : collected.records)
            .filter(record => !(record.scope === 'settings' && record.id === 'security'));
        const profileAttachments = await listProfileAttachments(uid); check();
        if (!Array.isArray(profileAttachments)) fail('RECOVERY_PROFILE_ATTACHMENTS_INVALID');
        for (const record of profileAttachments) records.push(createRecordDescriptorFromData('profile-document-attachment', record));
        const inventory = createRecoveryInventory(records, uid, bucket);
        await verifyProfileNames(records, material, check);
        recoveryKey = generateRecoveryKey();
        const header = createBackupHeader(uid, Date.now(), {profile: FULL_RECOVERY_PROFILE});
        const key = await deriveBackupKey(header, recoveryKey, uid); check();
        let sequence = 0, previousDigest = '', writtenBytes = 0, retainedAssetBytes = 0;
        const write = async value => {
            const line = serializeBackupLine(value);
            if (line.length > MAX_LINE_CHARACTERS || (writtenBytes += new TextEncoder().encode(line).length) > MAX_RECOVERY_FILE_BYTES) fail('RECOVERY_FILE_CAPACITY_EXCEEDED');
            check(); await writeLine(line); check();
        };
        const append = async entry => {
            check(); const sealed = await encryptBackupEntry({header, key, sequence, previousDigest, entry}); check();
            await write(sealed.envelope); previousDigest = sealed.digest; sequence++;
        };
        capsule = {kind: 'recovery', schemaVersion: 1, ownerUid: uid, backupId: header.backupId,
            vaultKeyMaterial: material, keyOrigin, sourceSecurityBinding, sharingIdentity};
        await write(header); await append(capsule);
        for (const record of records) await append(record);
        for (const expected of inventory.assets) {
            check(); const source = await readAsset(expected.storagePath, {expectedGeneration: expected.expectedGeneration});
            const bytes = source?.bytes instanceof Uint8Array ? source.bytes : source?.bytes instanceof ArrayBuffer ? new Uint8Array(source.bytes) : null;
            if (!bytes) fail('RECOVERY_ASSET_MISSING');
            let verified;
            try {
                check();
                if (!Number.isSafeInteger(source.size) || source.size !== bytes.length ||
                    (expected.assetClass === 'profile-document' && source.encrypted !== 'v1')) fail('RECOVERY_SOURCE_METADATA_INVALID');
                const asset = {kind: 'asset', storagePath: expected.storagePath, assetClass: expected.assetClass,
                    contentType: source.contentType, size: bytes.length, sha256: await recoveryDigest(bytes),
                    sourceGeneration: source.generation, references: expected.references, content: recoveryBase64(bytes)};
                verified = await verifyAssetBytes(asset, expected, material); check();
                const {content: _content, ...metadata} = asset;
                retainedAssetBytes = appendRecoveryAssetMetadata(assets, metadata, retainedAssetBytes);
                await append(asset);
            } finally { bytes.fill(0); verified?.fill(0); }
        }
        // A fresh password only authorizes the confirmed envelope that was opened.
        // A concurrent password/key/identity change invalidates the whole file.
        const currentSecurity = withoutId(await readSecurity(uid)); check();
        const currentIdentity = await readIdentity(uid); check();
        if (await digestRecoveryValue(currentSecurity) !== sourceSecurityBinding ||
            await digestRecoveryValue({publicIdentity: withoutId(currentIdentity?.publicIdentity), privateEnvelope: withoutId(currentIdentity?.privateEnvelope)}) !== sourceIdentityBinding) fail('RECOVERY_SOURCE_CHANGED');
        // The final ciphertext digest has fixed Base64 length. Reserve both
        // commitments before sealing a footer or returning the Recovery Key.
        assertRecoveryContentCapacity({...normalizedContentPayload(uid, {header, records, assets,
            references: inventory.references, manifestDigest: '0'.repeat(64), finalDigest: 'A'.repeat(43) + '='}),
        contentDigest: '0'.repeat(64)});
        const manifestDigest = await digestRecoveryValue(recoveryManifest(records, assets, inventory.references, sourceSecurityBinding, sharingIdentity.state));
        await append({kind: 'footer', entryCount: sequence, recordCount: records.length, assetCount: assets.length,
            capsuleCount: 1, manifestDigest, references: inventory.references});
        return {recoveryKey, backupId: header.backupId, profile: FULL_RECOVERY_PROFILE, schemaVersion: 3,
            recordCount: records.length, attachmentCount: assets.length, manifestDigest};
    } catch (error) {
        if (/^(?:RECOVERY|BACKUP_SESSION)_[A-Z0-9_]{1,96}$/.test(error?.message || '')) throw new Error(error.message);
        throw new Error('RECOVERY_EXPORT_INVALID');
    } finally {
        masterPassword = ''; material = ''; recoveryKey = '';
        if (capsule) { capsule.vaultKeyMaterial = ''; capsule.sharingIdentity = null; }
        if (records) records.length = 0; assets.length = 0;
    }
}

async function* recoveryLines(file, check) {
    check();
    const size = file?.size;
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_RECOVERY_FILE_BYTES || typeof file.slice !== 'function') fail('RECOVERY_FILE_SIZE_INVALID');
    const decoder = new TextDecoder('utf-8', {fatal: true});
    let pending = '';
    for (let offset = 0; offset < size; offset += 65536) {
        check(); const bytes = new Uint8Array(await file.slice(offset, Math.min(offset + 65536, size)).arrayBuffer()); check();
        try { pending += decoder.decode(bytes, {stream: true}); } finally { bytes.fill(0); }
        let newline;
        while ((newline = pending.indexOf('\n')) !== -1) {
            const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
            if (!line || line.length > MAX_LINE_CHARACTERS) fail('RECOVERY_LINE_INVALID');
            yield parseBackupLine(line); check();
        }
        if (pending.length > MAX_LINE_CHARACTERS || file.size !== size) fail('RECOVERY_FILE_CHANGED');
    }
    pending += decoder.decode();
    if (pending) fail('RECOVERY_FILE_TRUNCATED');
}

async function scanRecovery(file, uid, recoveryKey, check, expectedResult = null, visitor = null, bucket = RECOVERY_BUCKET) {
    let header, key, capsule, footer, inventory, sequence = 0, previousDigest = '', records = [], assets = [], phase = 'capsule';
    let retainedRecordBytes = 0, retainedAssetBytes = 0;
    try {
        for await (const value of recoveryLines(file, check)) {
            if (!header) {
                validateBackupHeader(value, uid);
                if (value.schemaVersion !== 3 || value.profile !== FULL_RECOVERY_PROFILE) fail('RECOVERY_PROFILE_REQUIRED');
                header = value; key = await deriveBackupKey(header, recoveryKey, uid); check(); continue;
            }
            if (footer) fail('RECOVERY_TRAILING_DATA');
            exactKeys(value, ['sequence', 'previousDigest', 'iv', 'ciphertext']);
            recoveryBytes(value.iv, 12).fill(0);
            recoveryBytes(value.ciphertext).fill(0);
            const opened = await decryptBackupEntry({header, key, expectedSequence: sequence, previousDigest, envelope: value}); check();
            previousDigest = opened.digest; sequence++;
            const entry = opened.entry;
            if (entry?.kind === 'recovery' && phase === 'capsule') {
                capsule = await validateCapsule(entry, header); check(); phase = 'records';
            } else if (entry?.kind === 'record' && phase === 'records') {
                const size = new TextEncoder().encode(JSON.stringify(entry)).length;
                if (size > 800 * 1024 || (retainedRecordBytes += size) > 16 * 1024 * 1024) fail('RECOVERY_RECORD_CAPACITY_EXCEEDED');
                records.push(entry);
                if (records.length > 10000) fail('RECOVERY_RECORD_CAPACITY_EXCEEDED');
            } else if (entry?.kind === 'asset' && (phase === 'records' || phase === 'assets')) {
                if (!inventory) inventory = createRecoveryInventory(records, uid, bucket);
                if (phase === 'records') await verifyProfileNames(records, capsule.vaultKeyMaterial, check);
                phase = 'assets';
                const expected = inventory.assets[assets.length];
                if (!expected) fail('RECOVERY_ASSET_UNEXPECTED');
                const bytes = await verifyAssetBytes(entry, expected, capsule.vaultKeyMaterial);
                try {
                    check();
                    const {content: _content, ...metadata} = entry;
                    retainedAssetBytes = appendRecoveryAssetMetadata(assets, metadata, retainedAssetBytes);
                    if (visitor) { await visitor(cloneRecoveryValue(metadata), bytes); check(); }
                } finally { bytes.fill(0); entry.content = ''; }
            } else if (entry?.kind === 'footer' && capsule && (phase === 'records' || phase === 'assets')) {
                exactKeys(entry, ['kind', 'entryCount', 'recordCount', 'assetCount', 'capsuleCount', 'manifestDigest', 'references']);
                if (!inventory) {
                    inventory = createRecoveryInventory(records, uid, bucket);
                    await verifyProfileNames(records, capsule.vaultKeyMaterial, check);
                }
                if (entry.entryCount !== sequence - 1 || entry.recordCount !== records.length || entry.assetCount !== assets.length ||
                    entry.capsuleCount !== 1 || assets.length !== inventory.assets.length ||
                    canonicalRecoveryJson(entry.references) !== canonicalRecoveryJson(inventory.references) ||
                    entry.manifestDigest !== await digestRecoveryValue(recoveryManifest(records, assets, inventory.references, capsule.sourceSecurityBinding, capsule.sharingIdentity.state))) fail('RECOVERY_FOOTER_INVALID');
                footer = entry;
            } else fail('RECOVERY_ENTRY_ORDER_INVALID');
        }
        if (!header || !footer || !capsule) fail('RECOVERY_FOOTER_MISSING');
        const result = {header, capsule, records, assets, references: inventory.references, manifestDigest: footer.manifestDigest, finalDigest: previousDigest};
        assertRecoveryContentCapacity({...normalizedContentPayload(uid, result), contentDigest: '0'.repeat(64)});
        if (expectedResult && (canonicalRecoveryJson(header) !== canonicalRecoveryJson(expectedResult.header) ||
            result.finalDigest !== expectedResult.finalDigest || result.manifestDigest !== expectedResult.manifestDigest)) fail('RECOVERY_FILE_CHANGED');
        check(); return result;
    } catch (error) {
        if (capsule) { capsule.vaultKeyMaterial = ''; capsule.sharingIdentity = null; }
        records.length = 0; assets.length = 0;
        if (/^RECOVERY_[A-Z0-9_]{1,96}$/.test(error?.message || '')) throw new Error(error.message);
        throw new Error('RECOVERY_FILE_INVALID');
    }
}

function createSession(uid, options) {
    if (typeof options.getCurrentUid !== 'function') fail('RECOVERY_SESSION_PROVIDER_REQUIRED');
    let invalidated = false;
    const state = {uid, recoveryKey: '', file: null, result: null};
    const release = () => {
        invalidated = true;
        options.signal?.removeEventListener('abort', release);
        globalThis.removeEventListener?.('vault-session-locked', release);
        globalThis.removeEventListener?.('pagehide', release);
        if (state.result?.capsule) { state.result.capsule.vaultKeyMaterial = ''; state.result.capsule.sharingIdentity = null; }
        if (state.result) { state.result.records.length = 0; state.result.assets.length = 0; }
        state.result = null; state.recoveryKey = ''; state.file = null;
    };
    const check = () => {
        if (invalidated || options.signal?.aborted || options.getCurrentUid() !== uid || options.isActive?.() === false) {
            release(); fail('RECOVERY_SESSION_INVALIDATED');
        }
    };
    options.signal?.addEventListener('abort', release, {once: true});
    globalThis.addEventListener?.('vault-session-locked', release, {once: true});
    globalThis.addEventListener?.('pagehide', release, {once: true});
    return Object.assign(state, {check, release, bucket: options.bucket || RECOVERY_BUCKET});
}
export async function prepareCompleteRecovery(file, uid, recoveryKey, options = {}) {
    assertRecoveryUid(uid);
    const state = createSession(uid, options);
    try {
        state.check();
        const result = await scanRecovery(file, uid, recoveryKey, state.check, null, null, state.bucket);
        state.file = file; state.recoveryKey = recoveryKey; state.result = result; state.check();
        result.contentDigest = await digestRecoveryValue(normalizedContentPayload(uid, result)); state.check();
        const plan = immutable({ownerUid: uid, backupId: result.header.backupId, schemaVersion: 3, profile: FULL_RECOVERY_PROFILE,
            manifestDigest: result.manifestDigest, finalDigest: result.finalDigest, contentDigest: result.contentDigest,
            counts: {records: result.records.length, assets: result.assets.length, externalReferences: result.references.filter(r => r.kind === 'external-url').length},
            descriptions: describeRestoreRecords(result.records)});
        sessions.set(plan, state); return plan;
    } catch (error) { state.release(); throw error; }
}
function privateSession(plan) {
    const state = sessions.get(plan);
    if (!state) fail('RECOVERY_PLAN_RELEASED');
    state.check(); return state;
}
export function releaseCompleteRecovery(plan) {
    sessions.get(plan)?.release(); sessions.delete(plan);
}
function normalizedContentPayload(uid, result) {
    const payload = cloneRecoveryValue({ownerUid: uid, backupId: result.header.backupId, profile: FULL_RECOVERY_PROFILE,
        manifestDigest: result.manifestDigest, sourceDigest: result.finalDigest,
        records: result.records, assets: result.assets, references: result.references});
    // Old Firebase download tokens are source evidence only. The dedicated
    // publisher must replace these fields using fresh URLs and typed references.
    const byKey = new Map(payload.records.map(record => [fullRecoveryRecordKey(record, uid), record]));
    for (const asset of payload.assets) for (const reference of asset.references) {
        if (reference.kind !== 'download-url') continue;
        // Resolve by the model's canonical destination identity, never by a label.
        const record = byKey.get(reference.recordKey);
        if (!record) fail('RECOVERY_REFERENCE_INVALID');
        let parent = record.data;
        for (const field of reference.fieldPath.slice(0, -1)) parent = parent[field];
        parent[reference.fieldPath.at(-1)] = null;
    }
    byKey.clear();
    return payload;
}
export function createRecoveryContentPayload(plan) {
    const state = privateSession(plan), result = state.result;
    return assertRecoveryContentCapacity({...normalizedContentPayload(state.uid, result), contentDigest: result.contentDigest});
}
export async function createFinalizePayload(plan, newMasterPassword) {
    const state = privateSession(plan), result = state.result;
    const policy = evaluatePassword(newMasterPassword, 'master');
    if (!policy.valid) fail('RECOVERY_MASTER_POLICY_INVALID');
    const capsule = result.capsule;
    try {
        const vaultKeyEnvelope = await wrapVaultKey(capsule.vaultKeyMaterial, policy.value, capsule.keyOrigin); state.check();
        const verifier = await createVaultVerifier(VERIFIER_MARKER, policy.value); state.check();
        return cloneRecoveryValue({ownerUid: state.uid, backupId: result.header.backupId, profile: FULL_RECOVERY_PROFILE,
            manifestDigest: result.manifestDigest, sourceDigest: result.finalDigest,
            contentDigest: result.contentDigest, sourceSecurityBinding: capsule.sourceSecurityBinding,
            security: {vaultKeyEnvelope, verifier}, sharingIdentity: capsule.sharingIdentity});
    } finally { policy.value = ''; newMasterPassword = ''; }
}
// A resumed operation may already be committed after a lost response. Prove
// the supplied password against actual stored authority, not a fresh envelope
// generated locally with new random salt/IVs.
export async function verifyCompletedRecovery(plan, security, masterPassword) {
    const state = privateSession(plan), policy = evaluatePassword(masterPassword, 'master');
    let material = '';
    try {
        if (!policy.valid || !security?.vaultKeyEnvelope || !security?.verifier) return false;
        const verified = await verifyVaultVerifier(security.verifier, VERIFIER_MARKER, policy.value); state.check();
        if (!verified) return false;
        material = await unwrapVaultKey(security.vaultKeyEnvelope, policy.value); state.check();
        return material === state.result.capsule.vaultKeyMaterial;
    } catch {
        state.check();
        return false;
    } finally { material = ''; policy.value = ''; masterPassword = ''; }
}
export async function visitRecoveryAssets(plan, visitor) {
    if (typeof visitor !== 'function') fail('RECOVERY_VISITOR_REQUIRED');
    const state = privateSession(plan), expected = state.result;
    const clearScan = result => { result.capsule.vaultKeyMaterial = ''; result.capsule.sharingIdentity = null; result.records.length = 0; result.assets.length = 0; };
    // Re-authenticate every record, blob and footer before the first callback.
    // Callbacks may stage bytes only; publication needs a separate server fence.
    try {
        const preflight = await scanRecovery(state.file, state.uid, state.recoveryKey, state.check, expected, null, state.bucket);
        clearScan(preflight); state.check();
        const visited = await scanRecovery(state.file, state.uid, state.recoveryKey, state.check, expected, visitor, state.bucket);
        clearScan(visited); state.check();
        return {assetCount: expected.assets.length, manifestDigest: expected.manifestDigest};
    } catch (error) { state.release(); throw error; }
}
