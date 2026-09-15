// Experimental adaptation of the export on codex/real-excel-export-preview.
// Only explicit user-content scopes are admitted; this is not a backup format.
export const EXCEL_MASK = '••••••••';
const scopes = new Set(['profile', 'private-account', 'company-account', 'company', 'contact', 'deadline',
    'profile-widget', 'private-account-widget', 'company-account-widget', 'shared-vault-data', 'shared-vault-data-link']);
const secrets = /password|passwd|passphrase|pin|puk|ccv|cvv|secret|token|recovery|credential|otp|^valueEnc$/i;
const internal = /vault|master|verifier|envelope|webauthn|private.?key|public.?key|file.?key|wrapped.?key|key.?material|kdf|salt|auth|session/i;
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value) && !['.', '..'].includes(value);
const invalid = () => { throw new Error('EXCEL_RECORD_INVALID'); };

export function createExcelExportProjection({context, getUser, collectRecords, isEncryptedValue}) {
    const uid = context.user?.uid;
    const check = () => {
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        context.assertUnlocked();
    };
    return async ({includeSecrets = false} = {}) => {
        if (typeof includeSecrets !== 'boolean') throw new Error('EXCEL_CONSENT_INVALID');
        check();
        let budget = 16 * 1024 * 1024;
        const consume = value => {
            budget -= typeof value === 'string' ? value.length : 8;
            if (budget < 0) throw new Error('EXCEL_EXPORT_LIMIT');
            return value;
        };
        async function open(value, key = '', depth = 0, protectedField = false) {
            check();
            if (depth > 32) throw new Error('EXCEL_EXPORT_LIMIT');
            if (!includeSecrets && (protectedField || secrets.test(key))) return consume(value == null || value === '' ? '' : EXCEL_MASK);
            if (value === null || typeof value === 'boolean') return consume(value);
            if (typeof value === 'number') { if (!Number.isFinite(value)) invalid(); return consume(value); }
            if (typeof value === 'string') {
                if (!isEncryptedValue(value)) return consume(value);
                const decoded = await context.read({ownerId: uid, ciphertext: value}); check();
                if (typeof decoded !== 'string' || decoded === value || decoded === '--ERRORE--') throw new Error('EXCEL_DECRYPT_FAILED');
                return consume(decoded);
            }
            if (Array.isArray(value)) {
                const rows = [];
                for (const item of value) rows.push(await open(item, key, depth + 1));
                return rows;
            }
            if (!value || Object.getPrototypeOf(value) !== Object.prototype) invalid();
            if (value.$type) {
                if (value.$type === 'date' && typeof value.value === 'string' && Number.isFinite(Date.parse(value.value))) return consume(value.value);
                if (value.$type === 'timestamp' && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1e9) {
                    const date = new Date(value.seconds * 1000); if (!Number.isFinite(date.getTime())) invalid();
                    return consume(date.toISOString());
                }
                // Serialized byte arrays and unknown tagged objects are not Excel content.
                invalid();
            }
            if (Object.hasOwn(value, 'encrypted') && typeof value.encrypted !== 'boolean') invalid();
            const protectedValue = value.encrypted === true || value.sensitivity === 'secret' || value.type === 'sensitive';
            const result = {};
            for (const [name, item] of Object.entries(value)) {
                consume(name);
                if (internal.test(name) || ['__proto__', 'prototype', 'constructor'].includes(name)) continue;
                // File/photo references and bytes are deliberately not exported.
                if (/^(?:allegati|attachments|foto|photo|photoURL|avatar|storagePath|downloadURL)$/i.test(name)) continue;
                result[name] = await open(item, name, depth + 1, protectedValue && ['value', 'valueEnc'].includes(name));
                check();
            }
            return result;
        }
        const records = await collectRecords(uid, {signal: context.signal, isActive: () => {
            try {check(); return true;} catch {return false;}
        }});
        check();
        if (!Array.isArray(records) || records.length > 10000) throw new Error('EXCEL_EXPORT_LIMIT');
        const output = [], seen = new Set();
        try {
            for (const record of records) {
                check();
                if (!record || typeof record.scope !== 'string') invalid();
                if (record.scope === 'settings' || record.scope.endsWith('-attachment')) continue;
                if (!scopes.has(record.scope) || !identifier(record.id) || !record.data || Object.getPrototypeOf(record.data) !== Object.prototype) invalid();
                if ((record.scope === 'profile' && record.id !== uid) || (Object.hasOwn(record.data, 'ownerId') && record.data.ownerId !== uid)) throw new Error('OWNER_MISMATCH');
                for (const key of ['companyId', 'accountId', 'sharedDataId']) if (record[key] !== undefined && !identifier(record[key])) invalid();
                if (record.scope.startsWith('company-') && !record.companyId) invalid();
                if (record.scope.endsWith('-account-widget') && !record.accountId) invalid();
                const identity = JSON.stringify([record.scope, record.companyId ?? null, record.accountId ?? null, record.id]);
                if (seen.has(identity)) invalid(); seen.add(identity);
                const row = {scope: record.scope, id: record.id};
                for (const key of ['companyId', 'accountId', 'sharedDataId']) if (record[key] !== undefined) row[key] = record[key];
                row.data = await open(record.data); check(); output.push(row);
            }
            check(); return output;
        } catch (error) {
            output.length = 0;
            throw error;
        }
    };
}
