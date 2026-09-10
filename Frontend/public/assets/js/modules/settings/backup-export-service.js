import {storage} from '../../firebase-config.js?v=1.2.92';
import {getBytes, ref} from '/assets/js/vendor/firebase-runtime.js';
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

async function accountRecords(uid, accounts, companyId = null) {
    const records = [];
    const scope = companyId ? 'company-account' : 'private-account';
    for (const account of accounts) {
        records.push(createRecordDescriptorFromData(scope, account, companyId ? {companyId} : {}));
        const attachments = companyId
            ? await listBackupCompanyAttachments(uid, companyId, account.id)
            : await listBackupPrivateAttachments(uid, account.id);
        for (const attachment of attachments) {
            records.push(createRecordDescriptorFromData(attachmentRecordScope(companyId ? 'company' : 'private'), attachment, {
                companyId, accountId: account.id
            }));
        }
    }
    return records;
}

export async function collectOwnerBackup(uid) {
    if (!navigator.onLine) throw new Error('BACKUP_REQUIRES_ONLINE');
    const [profile, settings, privateAccounts, companies, deadlines, contacts, widgets] = await Promise.all([
        getBackupProfile(uid), listBackupSettings(uid), listBackupPrivateAccounts(uid),
        listBackupCompanies(uid), listBackupDeadlines(uid), listBackupContacts(uid), listBackupProfileWidgets(uid)
    ]);
    const records = [createProfileDescriptorFromData(uid, profile)];
    records.push(...settings.map(item => createRecordDescriptorFromData('settings', item)));
    records.push(...await accountRecords(uid, privateAccounts));
    records.push(...deadlines.map(item => createRecordDescriptorFromData('deadline', item)));
    records.push(...contacts.map(item => createRecordDescriptorFromData('contact', item)));
    records.push(...widgets.map(item => createRecordDescriptorFromData('profile-widget', item)));
    for (const company of companies) {
        records.push(createRecordDescriptorFromData('company', company));
        records.push(...await accountRecords(uid, await listBackupCompanyAccounts(uid, company.id), company.id));
    }
    const [accountWidgets, sharedVaultData, sharedVaultLinks] = await Promise.all([
        listBackupAccountWidgets(uid), listBackupSharedVaultData(uid), listBackupSharedVaultLinks(uid)
    ]);
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

async function openSink(fileName) {
    if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{description: 'Backup cifrato Codici & Password', accept: {'application/x-codici-password-backup': ['.cpbackup']}}]
        });
        const writable = await handle.createWritable();
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
            const url = URL.createObjectURL(new Blob(chunks, {type: 'application/x-codici-password-backup'}));
            const link = document.createElement('a');
            link.href = url; link.download = fileName; link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
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

export async function exportOwnerBackup(uid) {
    const date = new Date().toISOString().slice(0, 10);
    const sink = await openSink(`codici-password-${date}.cpbackup`);
    try {
        const recoveryKey = generateRecoveryKey();
        const header = createBackupHeader(uid);
        const key = await deriveBackupKey(header, recoveryKey, uid);
        await sink.write(serializeBackupLine(header));
        const {records, storagePaths} = await collectOwnerBackup(uid);
        let sequence = 0;
        let previousDigest = '';
        const append = async entry => {
            const encrypted = await encryptBackupEntry({header, key, sequence, previousDigest, entry});
            await sink.write(serializeBackupLine(encrypted.envelope));
            sequence += 1;
            previousDigest = encrypted.digest;
        };
        for (const record of records) await append(record);
        for (const storagePath of storagePaths) {
            const content = await getBytes(ref(storage, storagePath), MAX_ATTACHMENT_BYTES);
            await append({kind: 'attachment', storagePath, content: bytesToBase64(content)});
        }
        await append({kind: 'footer', entryCount: sequence, recordCount: records.length, attachmentCount: storagePaths.length});
        await sink.close();
        return {recoveryKey, recordCount: records.length, attachmentCount: storagePaths.length, streamed: sink.streamed};
    } catch (error) {
        try {
            await sink.abort(error);
        } catch (abortError) {
            console.warn('Impossibile annullare il file di backup parziale.', abortError);
        }
        throw error;
    }
}
