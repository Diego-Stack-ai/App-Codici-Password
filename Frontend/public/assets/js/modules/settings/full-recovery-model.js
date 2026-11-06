import {restoreRecordKey, validateRestoreTypes} from './backup-import-model.js';
import {validateChunkedAttachmentManifest} from '../shared/chunked-attachment-security.js';
import {normalizeExternalUrl} from '../shared/attachment-security.js';
import {isEncryptedValue} from '../core/crypto-utils.js';

export const RECOVERY_BUCKET = 'appcodici-password.firebasestorage.app';
export const MAX_RECOVERY_ASSET_BYTES = 32 * 1024 * 1024 + 16;
export const MAX_RECOVERY_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_RECOVERY_ASSETS = 10000;
export const MAX_RECOVERY_ASSET_METADATA_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();
const idPattern = /^[A-Za-z0-9._:-]{1,160}$/;
const documentIdPattern = /^[A-Za-z0-9_-]{1,256}$/;
const urlFields = new Set(['photoURL', 'avatar', 'logo', 'referentePhoto', 'url']);
export const fail = code => { throw new Error(code); };
export const cloneRecoveryValue = value => JSON.parse(JSON.stringify(value));
export function exactKeys(value, keys, code = 'RECOVERY_SCHEMA_INVALID') {
    if (!value || Array.isArray(value) || typeof value !== 'object' ||
        Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) fail(code);
}
export function canonicalRecoveryJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalRecoveryJson).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort()
        .map(key => `${JSON.stringify(key)}:${canonicalRecoveryJson(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
}
export async function recoveryDigest(value) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
export const digestRecoveryValue = value => recoveryDigest(canonicalRecoveryJson(value));
export function recoveryBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
}
export function recoveryBytes(value, length) {
    if (typeof value !== 'string' || !value || value.length > 90 * 1024 * 1024) fail('RECOVERY_BASE64_INVALID');
    let bytes;
    try { bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0)); } catch { fail('RECOVERY_BASE64_INVALID'); }
    if ((length !== undefined && bytes.length !== length) || recoveryBase64(bytes) !== value) {
        bytes.fill(0); fail('RECOVERY_BASE64_INVALID');
    }
    return bytes;
}
export function assertRecoveryUid(uid) {
    if (typeof uid !== 'string' || !idPattern.test(uid)) fail('RECOVERY_OWNER_INVALID');
    return uid;
}
export function validateVaultMaterial(material, keyOrigin) {
    if (typeof material !== 'string' || !material || material.length > 16384) fail('RECOVERY_KEY_MATERIAL_INVALID');
    if (material.startsWith('CPVK2:')) {
        if (keyOrigin !== 'random-with-legacy-fallback') fail('RECOVERY_KEY_ORIGIN_INVALID');
        const bytes = recoveryBytes(material.slice(6));
        try {
            const serialized = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
            // The supported keyring has exactly two string/null values. A strict
            // grammar rejects duplicate JSON members without reserializing it.
            const jsonString = '"(?:[^"\\\\\\u0000-\\u001f]|\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4}))*"';
            const primary = `"primaryKey"\\s*:\\s*${jsonString}`;
            const legacy = `"legacyKey"\\s*:\\s*(?:${jsonString}|null)`;
            if (!new RegExp(`^\\s*\\{\\s*(?:${primary}\\s*,\\s*${legacy}|${legacy}\\s*,\\s*${primary})\\s*\\}\\s*$`).test(serialized)) fail('RECOVERY_KEY_MATERIAL_INVALID');
            const keyring = JSON.parse(serialized);
            exactKeys(keyring, ['primaryKey', 'legacyKey'], 'RECOVERY_KEY_MATERIAL_INVALID');
            recoveryBytes(keyring.primaryKey, 32).fill(0);
            if (keyring.legacyKey !== null && (typeof keyring.legacyKey !== 'string' || !keyring.legacyKey ||
                keyring.legacyKey.length > 4096)) fail('RECOVERY_KEY_MATERIAL_INVALID');
        } finally { bytes.fill(0); }
    } else {
        if (keyOrigin !== 'random') fail('RECOVERY_KEY_ORIGIN_INVALID');
        recoveryBytes(material, 32).fill(0);
    }
    // Preserve the original string: auxiliary HKDF envelopes use every byte,
    // including CPVK2 serialization. Parsing here is validation only.
    return material;
}
export function validateOwnedStoragePath(path, uid) {
    assertRecoveryUid(uid);
    if (typeof path !== 'string' || path.length > 1024 || !path.startsWith(`users/${uid}/`) ||
        /[\\\u0000-\u001f\u007f?#]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
        fail('RECOVERY_STORAGE_PATH_INVALID');
    }
    return path;
}
export function ownedStorageUrl(value, uid, bucket = RECOVERY_BUCKET) {
    let url;
    try { url = new URL(value); } catch { return null; }
    if (!['https:', 'http:'].includes(url.protocol) || url.hostname !== 'firebasestorage.googleapis.com') return null;
    const match = /^\/v0\/b\/([^/]+)\/o\/([^/]+)$/.exec(url.pathname);
    if (!match) fail('RECOVERY_STORAGE_URL_INVALID');
    let path, actualBucket;
    try { path = decodeURIComponent(match[2]); actualBucket = decodeURIComponent(match[1]); } catch { fail('RECOVERY_STORAGE_URL_INVALID'); }
    if (actualBucket !== bucket || !path.startsWith(`users/${uid}/`)) return null;
    if (url.port || url.username || url.password) fail('RECOVERY_STORAGE_URL_INVALID');
    return validateOwnedStoragePath(path, uid);
}
export function fullRecoveryRecordKey(record, uid) {
    if (record?.scope === 'profile-document-attachment') {
        if (!documentIdPattern.test(record.id || '')) fail('RECOVERY_PROFILE_ATTACHMENT_INVALID');
        return JSON.stringify(['profile-document-attachment', record.id]);
    }
    for (const field of ['id', 'companyId', 'accountId', 'sharedDataId']) {
        if (record[field] !== undefined && (typeof record[field] !== 'string' || !idPattern.test(record[field]))) fail('RECOVERY_IDENTIFIER_INVALID');
    }
    const key = restoreRecordKey(record);
    if (record.scope === 'profile' && record.id !== uid) fail('RECOVERY_OWNER_INVALID');
    if (record.scope === 'settings' && record.id === 'security') fail('RECOVERY_SECURITY_RECORD_FORBIDDEN');
    return key;
}
function validateEncryption(encryption) {
    exactKeys(encryption, ['version', 'cipher', 'keyWrap', 'contentIv', 'wrapSalt', 'wrapIv', 'wrappedFileKey', 'originalType', 'originalSize']);
    if (encryption.version !== 1 || encryption.cipher !== 'AES-GCM-256' || encryption.keyWrap !== 'HKDF-SHA256+A256GCM' ||
        !Number.isSafeInteger(encryption.originalSize) || encryption.originalSize <= 0 ||
        encryption.originalSize > MAX_RECOVERY_ASSET_BYTES - 16 || typeof encryption.originalType !== 'string' || !encryption.originalType) fail('RECOVERY_ENCRYPTION_INVALID');
    recoveryBytes(encryption.contentIv, 12).fill(0); recoveryBytes(encryption.wrapSalt, 32).fill(0);
    recoveryBytes(encryption.wrapIv, 12).fill(0); recoveryBytes(encryption.wrappedFileKey, 48).fill(0);
}
export function validateProfileAttachment(record, profile, uid) {
    const data = record.data;
    if (!data || data.status !== 'ready' || data.ownerId !== uid || data.schemaVersion !== 1 ||
        !documentIdPattern.test(data.documentId || '') || !documentIdPattern.test(record.id || '') ||
        (profile.documenti || []).filter(item => item?.id === data.documentId).length !== 1 ||
        data.storagePath !== `users/${uid}/profile-documents/${data.documentId}/attachments/${record.id}` ||
        !Number.isSafeInteger(data.size) || data.size <= 0 || data.size > MAX_RECOVERY_ASSET_BYTES - 16 ||
        !/^[a-f0-9]{64}$/.test(data.digest || '') || typeof data.generation !== 'string' || !/^[1-9][0-9]*$/.test(data.generation) ||
        typeof data.encryptedName !== 'string' || data.encryptedName.length > 4096 || !isEncryptedValue(data.encryptedName) || !data.mimeType) fail('RECOVERY_PROFILE_ATTACHMENT_INVALID');
    validateEncryption(data.encryption);
    if (data.encryption.originalSize !== data.size || data.encryption.originalType !== data.mimeType) fail('RECOVERY_PROFILE_ATTACHMENT_INVALID');
}
export function validateRecoveryRecords(records, uid) {
    if (!Array.isArray(records) || !records.length || records.length > 10000) fail('RECOVERY_RECORDS_INVALID');
    const seen = new Set(); let total = 0;
    for (const record of records) {
        const context = {
            'company-account': ['companyId'], 'private-account-attachment': ['accountId'],
            'company-account-attachment': ['companyId', 'accountId'], 'private-account-widget': ['accountId'],
            'company-account-widget': ['companyId', 'accountId'], 'shared-vault-data-link': ['sharedDataId']
        }[record?.scope] || [];
        exactKeys(record, ['kind', 'scope', 'id', 'data', ...context], 'RECOVERY_RECORD_INVALID');
        if (record.kind !== 'record' ||
            !record.data || typeof record.data !== 'object' || Array.isArray(record.data)) fail('RECOVERY_RECORD_INVALID');
        validateRestoreTypes(record.data);
        const key = fullRecoveryRecordKey(record, uid);
        if (seen.has(key)) fail('RECOVERY_RECORD_DUPLICATE');
        seen.add(key);
        const size = encoder.encode(JSON.stringify(record)).length;
        if (size > 800 * 1024 || (total += size) > 16 * 1024 * 1024) fail('RECOVERY_RECORD_CAPACITY_EXCEEDED');
    }
    const profiles = records.filter(record => record.scope === 'profile');
    if (profiles.length !== 1) fail('RECOVERY_PROFILE_MISSING');
    for (const record of records.filter(record => record.scope === 'profile-document-attachment')) validateProfileAttachment(record, profiles[0].data, uid);
    return records;
}
export function createRecoveryInventory(records, uid, bucket = RECOVERY_BUCKET) {
    validateRecoveryRecords(records, uid);
    const assets = new Map(), references = [];
    const profileSources = new Map(records.filter(record => record.scope === 'profile-document-attachment')
        .map(record => [record.data.storagePath, record]));
    function add(path, reference, classification, encryption, chunk, source, record, value) {
        validateOwnedStoragePath(path, uid);
        const profileSource = profileSources.get(path);
        if (record.scope === 'deadline' && value.linkedSource?.type === 'profileDocumentAttachment') {
            if (!profileSource) fail('RECOVERY_PROFILE_ATTACHMENT_MISSING');
            const documentId = profileSource.data.documentId, deadline = record.data;
            const hasReference = deadline.sourceRef !== undefined || deadline.sourceType !== undefined;
            if (!hasReference || value.linkedSource.id !== profileSource.id || chunk ||
                (deadline.sourceRef !== undefined && (deadline.sourceRef?.type !== 'profileDocument' || deadline.sourceRef.id !== documentId)) ||
                (deadline.sourceType !== undefined && (deadline.sourceType !== 'profileDocument' || deadline.sourceDocumentId !== documentId)) ||
                canonicalRecoveryJson(encryption) !== canonicalRecoveryJson(profileSource.data.encryption)) fail('RECOVERY_ASSET_CONFLICT');
            classification = 'profile-document'; source = profileSource.data;
        }
        const descriptor = {storagePath: path, assetClass: classification, encryption: encryption || null, chunk: chunk || null,
            expectedSize: chunk?.encryptedSize ?? (encryption ? encryption.originalSize + 16 : null),
            expectedDigest: source?.digest || null, expectedGeneration: source?.generation || null};
        const current = assets.get(path);
        if (current && canonicalRecoveryJson({...current, references: undefined}) !== canonicalRecoveryJson({...descriptor, references: undefined})) fail('RECOVERY_ASSET_CONFLICT');
        if (!current) assets.set(path, {...descriptor, references: []});
        assets.get(path).references.push(reference);
    }
    for (const record of records) {
        const recordKey = fullRecoveryRecordKey(record, uid);
        function visit(value, fieldPath = [], inheritedEncryption = null) {
            if (!value || typeof value !== 'object') return;
            if (Array.isArray(value)) { value.forEach((child, index) => visit(child, [...fieldPath, index], inheritedEncryption)); return; }
            const encryption = value.encryption || inheritedEncryption;
            if (value.encryption?.chunked) validateChunkedAttachmentManifest(value);
            else if (value.encryption) validateEncryption(value.encryption);
            for (const [field, child] of Object.entries(value)) {
                const path = [...fieldPath, field];
                if (field === 'storagePath') {
                    const chunk = inheritedEncryption?.chunked ? value : null;
                    const cls = record.scope === 'profile-document-attachment' ? 'profile-document' : encryption ? 'encrypted-file' : 'raw-file';
                    add(child, {recordKey, fieldPath: path, kind: 'storage-path'}, cls, encryption, chunk,
                        record.scope === 'profile-document-attachment' ? value : null, record, value);
                } else if (typeof child === 'string' && (urlFields.has(field) || /^https?:\/\/firebasestorage\.googleapis\.com\//.test(child))) {
                    if (!child) continue;
                    const reference = {recordKey, fieldPath: path};
                    if (child.startsWith('data:')) references.push({...reference, kind: 'embedded-data'});
                    else {
                        const owned = ownedStorageUrl(child, uid, bucket);
                        if (owned) {
                            const rawMedia = ['photoURL', 'avatar', 'logo', 'referentePhoto'].includes(field);
                            if (record.scope === 'profile' && ['photoURL', 'avatar'].includes(field) && !owned.startsWith(`users/${uid}/avatar_`)) fail('RECOVERY_AVATAR_PATH_INVALID');
                            const cls = record.scope === 'profile-document-attachment' ? 'profile-document' : rawMedia ? 'raw-media' : encryption ? 'encrypted-file' : 'raw-file';
                            add(owned, {...reference, kind: 'download-url'}, cls, encryption, inheritedEncryption?.chunked ? value : null,
                                record.scope === 'profile-document-attachment' ? value : null, record, value);
                        } else if (normalizeExternalUrl(child)) references.push({...reference, kind: 'external-url', url: child});
                        // Account websites are user content saved verbatim. An
                        // unopenable website does not imply a missing owned blob.
                        else if (field === 'url' && fieldPath.length === 0 &&
                            ['private-account', 'company-account'].includes(record.scope)) continue;
                        else if (urlFields.has(field) && !child.startsWith('CPFE')) fail('RECOVERY_ASSET_REFERENCE_UNSUPPORTED');
                    }
                } else if (field !== 'encryption') visit(child, path, encryption);
            }
        }
        visit(record.data);
    }
    for (const asset of assets.values()) {
        if (asset.assetClass === 'profile-document' || asset.storagePath.startsWith(`users/${uid}/avatar_`) ||
            asset.references.some(reference => reference.recordKey === '["profile"]' && ['photoURL', 'avatar'].includes(reference.fieldPath.at(-1)))) continue;
        const parents = new Set();
        for (const reference of asset.references) {
            const key = JSON.parse(reference.recordKey);
            if (['private-account', 'private-account-attachment'].includes(key[0])) parents.add(JSON.stringify(['private', key[1]]));
            else if (['company-account', 'company-account-attachment'].includes(key[0])) parents.add(JSON.stringify(['company', key[1], key[2]]));
            else if (key[0] === 'deadline') parents.add(JSON.stringify(['deadline', key[1]]));
        }
        if (parents.size > 1) fail('RECOVERY_ASSET_LIFECYCLE_CONFLICT');
        if (!parents.size && asset.storagePath.startsWith(`users/${uid}/restoreObjects/`)) fail('RECOVERY_ASSET_LIFECYCLE_UNSUPPORTED');
    }
    if (assets.size > MAX_RECOVERY_ASSETS) fail('RECOVERY_ASSET_CAPACITY_EXCEEDED');
    return {assets: [...assets.values()].sort((a, b) => a.storagePath < b.storagePath ? -1 : a.storagePath > b.storagePath ? 1 : 0), references};
}
export function appendRecoveryAssetMetadata(assets, metadata, previousBytes) {
    // Account for the complete JSON array, as the server does: the first
    // entry adds both brackets, every following entry adds its comma.
    const bytes = previousBytes + (assets.length ? 1 : 2) + encoder.encode(JSON.stringify(metadata)).length;
    if (assets.length >= MAX_RECOVERY_ASSETS || bytes > MAX_RECOVERY_ASSET_METADATA_BYTES) fail('RECOVERY_ASSET_CAPACITY_EXCEEDED');
    assets.push(metadata);
    return bytes;
}
export function validateRecoveryAssetMetadata(asset, expected) {
    exactKeys(asset, ['kind', 'storagePath', 'assetClass', 'contentType', 'size', 'sha256', 'sourceGeneration', 'references', 'content']);
    if (asset.kind !== 'asset' || asset.storagePath !== expected.storagePath || asset.assetClass !== expected.assetClass ||
        canonicalRecoveryJson(asset.references) !== canonicalRecoveryJson(expected.references) ||
        !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_RECOVERY_ASSET_BYTES ||
        typeof asset.sourceGeneration !== 'string' || !/^[1-9][0-9]*$/.test(asset.sourceGeneration) ||
        !/^[a-f0-9]{64}$/.test(asset.sha256 || '') || typeof asset.contentType !== 'string' || !asset.contentType ||
        (expected.expectedSize !== null && asset.size !== expected.expectedSize) ||
        (expected.expectedDigest && asset.sha256 !== expected.expectedDigest) ||
        (expected.expectedGeneration && asset.sourceGeneration !== expected.expectedGeneration) ||
        (expected.encryption && asset.contentType !== 'application/octet-stream') ||
        (asset.assetClass === 'raw-media' && (!asset.contentType.startsWith('image/') || asset.size > 5 * 1024 * 1024))) fail('RECOVERY_ASSET_INVALID');
    return asset;
}
export function recoveryManifest(records, assets, references, sourceSecurityBinding, identityState) {
    return {records, assets: assets.map(({content: _content, ...asset}) => asset), references, sourceSecurityBinding, identityState};
}
