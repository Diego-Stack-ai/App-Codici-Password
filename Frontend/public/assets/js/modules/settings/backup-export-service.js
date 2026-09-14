import {auth, storage} from '../../firebase-config.js?v=1.2.124';
import {getBytes, ref, onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {
    getBackupProfile, listBackupCompanies, listBackupCompanyAccounts, listBackupCompanyAttachments,
    listBackupAccountWidgets,
    listBackupContacts, listBackupDeadlines, listBackupPrivateAccounts, listBackupPrivateAttachments,
    listBackupProfileWidgets, listBackupSettings, listBackupSharedVaultData, listBackupSharedVaultLinks
} from '../data/vault-repository.js';
import {
    createBackupHeader, deriveBackupKey, encryptBackupEntry, generateRecoveryKey, serializeBackupLine
} from './backup-crypto.js';
import {
    attachmentRecordScope, collectStoragePaths, createProfileDescriptorFromData, createRecordDescriptorFromData
} from './backup-export-model.js';

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 + 1024;

function createExportSession(uid, {signal, isActive = () => true} = {}) {
    let invalidated = false, unsubscribe = () => {};
    const dispose = () => {
        if (invalidated) return;
        invalidated = true; unsubscribe();
        signal?.removeEventListener('abort', dispose);
        globalThis.removeEventListener?.('vault-session-locked', dispose);
        globalThis.removeEventListener?.('pagehide', dispose);
    };
    const check = () => {
        if (invalidated || !uid || signal?.aborted || !isActive() || auth.currentUser?.uid !== uid) {
            dispose(); throw Object.assign(new Error('BACKUP_SESSION_INVALIDATED'), {code: 'BACKUP_SESSION_INVALIDATED'});
        }
    };
    check();
    signal?.addEventListener('abort', dispose, {once: true});
    globalThis.addEventListener?.('vault-session-locked', dispose, {once: true});
    globalThis.addEventListener?.('pagehide', dispose, {once: true});
    unsubscribe = onAuthStateChanged(auth, user => { if (user?.uid !== uid) dispose(); });
    if (invalidated) unsubscribe();
    return {check, dispose};
}

async function accountRecords(uid, accounts, companyId = null, check = () => {}) {
    const records = [];
    const scope = companyId ? 'company-account' : 'private-account';
    for (const account of accounts) {
        check();
        records.push(createRecordDescriptorFromData(scope, account, companyId ? {companyId} : {}));
        const attachments = companyId
            ? await listBackupCompanyAttachments(uid, companyId, account.id)
            : await listBackupPrivateAttachments(uid, account.id);
        check();
        for (const attachment of attachments) {
            records.push(createRecordDescriptorFromData(attachmentRecordScope(companyId ? 'company' : 'private'), attachment, {
                companyId, accountId: account.id
            }));
        }
    }
    return records;
}

async function collectRecords(uid, check) {
    check();
    if (!navigator.onLine) throw new Error('BACKUP_REQUIRES_ONLINE');
    const [profile, settings, privateAccounts, companies, deadlines, contacts, widgets] = await Promise.all([
        getBackupProfile(uid), listBackupSettings(uid), listBackupPrivateAccounts(uid),
        listBackupCompanies(uid), listBackupDeadlines(uid), listBackupContacts(uid), listBackupProfileWidgets(uid)
    ]);
    check();
    const records = [createProfileDescriptorFromData(uid, profile)];
    records.push(...settings.map(item => createRecordDescriptorFromData('settings', item)));
    records.push(...await accountRecords(uid, privateAccounts, null, check));
    check();
    records.push(...deadlines.map(item => createRecordDescriptorFromData('deadline', item)));
    records.push(...contacts.map(item => createRecordDescriptorFromData('contact', item)));
    records.push(...widgets.map(item => createRecordDescriptorFromData('profile-widget', item)));
    for (const company of companies) {
        check();
        records.push(createRecordDescriptorFromData('company', company));
        const accounts = await listBackupCompanyAccounts(uid, company.id);
        check();
        records.push(...await accountRecords(uid, accounts, company.id, check));
    }
    check();
    const [accountWidgets, sharedVaultData, sharedVaultLinks] = await Promise.all([
        listBackupAccountWidgets(uid), listBackupSharedVaultData(uid), listBackupSharedVaultLinks(uid)
    ]);
    check();
    for (const widget of accountWidgets) {
        const companyId = widget.context === 'company' ? widget.companyId : null;
        const scope = companyId ? 'company-account-widget' : 'private-account-widget';
        records.push(createRecordDescriptorFromData(scope, widget, {
            companyId, accountId: widget.accountId
        }));
    }
    for (const sharedData of sharedVaultData) {
        records.push(createRecordDescriptorFromData('shared-vault-data', sharedData));
    }
    for (const link of sharedVaultLinks) {
        records.push(createRecordDescriptorFromData('shared-vault-data-link', link, {
            sharedDataId: link.sharedDataId
        }));
    }
    return {records, storagePaths: collectStoragePaths(records, uid)};
}

export async function collectOwnerBackup(uid, options = {}) {
    const session = createExportSession(uid, options);
    try { return await collectRecords(uid, session.check); }
    finally { session.dispose(); }
}

async function openSink(fileName, check) {
    check();
    if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{description: 'Backup cifrato Codici & Password', accept: {'application/x-codici-password-backup': ['.cpbackup']}}]
        });
        check();
        const writable = await handle.createWritable();
        try { check(); } catch (error) { try { await writable.abort(); } catch {} throw error; }
        return {
            write: value => writable.write(value),
            close: () => writable.close(),
            abort: reason => writable.abort(reason),
            streamed: true
        };
    }
    const chunks = [];
    return {
        write(value) { chunks.push(value); },
        close() {
            check();
            const url = URL.createObjectURL(new Blob(chunks, {type: 'application/x-codici-password-backup'}));
            const link = document.createElement('a');
            link.href = url; link.download = fileName; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            chunks.length = 0;
        },
        abort() { chunks.length = 0; },
        streamed: false
    };
}

function bytesToBase64(value) {
    let binary = '';
    const bytes = new Uint8Array(value);
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

export async function exportOwnerBackup(uid, options = {}) {
    const session = createExportSession(uid, options), check = session.check;
    const date = new Date().toISOString().slice(0, 10);
    let sink, records, storagePaths, recoveryKey = '';
    try {
        sink = await openSink(`codici-password-${date}.cpbackup`, check);
        check();
        recoveryKey = generateRecoveryKey();
        const header = createBackupHeader(uid);
        const key = await deriveBackupKey(header, recoveryKey, uid);
        check();
        await sink.write(serializeBackupLine(header));
        check();
        ({records, storagePaths} = await collectRecords(uid, check));
        let sequence = 0;
        let previousDigest = '';
        const append = async entry => {
            check();
            const encrypted = await encryptBackupEntry({header, key, sequence, previousDigest, entry});
            check();
            await sink.write(serializeBackupLine(encrypted.envelope));
            check();
            sequence += 1;
            previousDigest = encrypted.digest;
        };
        for (const record of records) await append(record);
        for (const storagePath of storagePaths) {
            check();
            const content = await getBytes(ref(storage, storagePath), MAX_ATTACHMENT_BYTES);
            check();
            await append({kind: 'attachment', storagePath, content: bytesToBase64(content)});
        }
        await append({kind: 'footer', entryCount: sequence, recordCount: records.length, attachmentCount: storagePaths.length});
        await sink.close();
        check();
        return {recoveryKey, recordCount: records.length, attachmentCount: storagePaths.length, streamed: sink.streamed};
    } catch (error) {
        try { await sink?.abort(); } catch {}
        const code = ['BACKUP_SESSION_INVALIDATED', 'BACKUP_REQUIRES_ONLINE'].includes(error?.code || error?.message)
            ? error.code || error.message : 'BACKUP_EXPORT_FAILED';
        if (error?.name === 'AbortError') throw Object.assign(new Error('BACKUP_EXPORT_CANCELLED'), {name: 'AbortError'});
        throw Object.assign(new Error(code), {code});
    } finally {
        recoveryKey = ''; if (records) records.length = 0; if (storagePaths) storagePaths.length = 0;
        session.dispose();
    }
}
