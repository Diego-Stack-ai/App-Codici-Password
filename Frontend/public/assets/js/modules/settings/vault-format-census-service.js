// Censimento dei formati della Vault in sola lettura (fase 1, issue #373).
// Nessuna scrittura su Firestore o Storage, nessun invio: il rapporto resta locale.
// Non è collegato all'interfaccia: l'esecuzione sui dati reali richiede il gate dedicato.
import {auth} from '../../firebase-config.js?v=1.2.299';
import {onAuthStateChanged} from '/assets/js/vendor/firebase-runtime.js';
import {collectOwnerBackup} from './backup-export-service.js';
import {
    listBackupProfileDocumentAttachments, getBackupSharingPublicIdentity, getBackupSharingPrivateIdentity
} from '../data/vault-repository.js';
import {probeFieldKey} from './vault-format-census-probe.js';
import {unwrapAttachmentFileKey} from '../shared/attachment-security.js';
import {openSharingIdentity} from '../core/sharing-identity.js';
import {createCensusRunner} from './vault-format-census-model.js';

function cancelled() {
    return Object.assign(new Error('CENSUS_CANCELLED'), {code: 'CENSUS_CANCELLED'});
}

// Stesse condizioni di invalidazione dell'export: abort, blocco della Vault,
// uscita dalla pagina e cambio o uscita dell'utente.
export function createCensusSession(uid, {signal, isActive = () => true, authRef = auth,
    observeAuth = onAuthStateChanged, target = globalThis} = {}) {
    let invalidated = false, unsubscribe = () => {};
    const dispose = () => {
        if (invalidated) return;
        invalidated = true; unsubscribe();
        signal?.removeEventListener('abort', dispose);
        target.removeEventListener?.('vault-session-locked', dispose);
        target.removeEventListener?.('pagehide', dispose);
    };
    const check = () => {
        if (invalidated || !uid || signal?.aborted || !isActive() || authRef.currentUser?.uid !== uid) {
            dispose(); throw cancelled();
        }
    };
    check();
    signal?.addEventListener('abort', dispose, {once: true});
    target.addEventListener?.('vault-session-locked', dispose, {once: true});
    target.addEventListener?.('pagehide', dispose, {once: true});
    unsubscribe = observeAuth(authRef, user => { if (user?.uid !== uid) dispose(); });
    if (invalidated) unsubscribe();
    return {check, dispose};
}

export function createCensusProbes(uid) {
    return {
        field: (value, key) => probeFieldKey(value, key),
        async attachment(encryption, key) {
            try {
                const bytes = await unwrapAttachmentFileKey(encryption, key);
                bytes.fill(0);
                return 'opened';
            } catch (error) {
                return error?.message === 'ATTACHMENT_ENCRYPTION_INVALID' ? 'invalid' : 'closed';
            }
        },
        async identity(identity, key) {
            try {
                await openSharingIdentity({...identity, uid, vaultKeyMaterial: key});
                return 'opened';
            } catch (error) {
                return 'closed';
            }
        }
    };
}

export async function runVaultFormatCensus(uid, vaultKeyMaterial, options = {}) {
    const started = Date.now();
    const session = createCensusSession(uid, options);
    try {
        const runner = createCensusRunner({
            keyMaterial: vaultKeyMaterial, probes: options.probes || createCensusProbes(uid),
            check: session.check, onProgress: options.onProgress
        });
        const collect = options.collectOwnerBackup || collectOwnerBackup;
        const {records} = await collect(uid, {signal: options.signal, isActive: options.isActive});
        session.check();
        for (const record of records) await runner.addRecord(record);
        const listProfileAttachments = options.listProfileDocumentAttachments || listBackupProfileDocumentAttachments;
        for (const attachment of await listProfileAttachments(uid)) {
            session.check();
            const {id, ...data} = attachment || {};
            await runner.addRecord({kind: 'record', scope: 'profile-document-attachment', id, data});
        }
        session.check();
        const readPublic = options.getSharingPublicIdentity || getBackupSharingPublicIdentity;
        const readPrivate = options.getSharingPrivateIdentity || getBackupSharingPrivateIdentity;
        const [publicIdentity, privateEnvelope] = await Promise.all([readPublic(uid), readPrivate(uid)]);
        await runner.addIdentity(privateEnvelope ? {publicIdentity, privateEnvelope} : null);
        session.check();
        records.length = 0;
        return runner.report({durationMs: Date.now() - started});
    } catch (error) {
        if (error?.code === 'BACKUP_SESSION_INVALIDATED') throw cancelled();
        throw error;
    } finally {
        session.dispose();
    }
}
