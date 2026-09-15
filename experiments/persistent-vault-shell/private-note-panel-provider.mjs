import {mountOfflineSavePanel} from '../offline-sync/offline-save-panel.mjs';
import {readConflictNotes} from '../offline-sync/conflict-note-review.mjs';
import {createConflictNoteProposal} from '../offline-sync/conflict-note-proposal.mjs';
import {capturePrivateAccountSource, preparePrivateAccountMutation, assertPrivateNoteSourceCompatible} from './prepare-private-account-mutation.mjs';

// Candidate bootstrap provider. readSource must return the complete owner-bound
// document and explicit reverse-link evidence. No SDK/key/database goes to UI.
export function createPrivateNotePanelProvider({context, getUser, readSource, openQueue, deviceId,
    newOperationId = () => crypto.randomUUID(), mountPanel = mountOfflineSavePanel,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context?.user?.uid;
    if (!uid || !context.signal || !context.unlocked ||
        ![getUser, readSource, openQueue, newOperationId, mountPanel, isOnline, context.read, context.encrypt].every(fn => typeof fn === 'function')) throw new Error('NOTE_PROVIDER_CONFIG');
    return async (root, {selection, signal, isActive = () => true, onSaved, onDiscarded} = {}) => {
        const recordId = selection?.id;
        if (selection?.domain !== 'private' || !/^[A-Za-z0-9_-]{1,180}$/.test(recordId || '') || !signal) throw new Error('NOTE_PROVIDER_SCOPE');
        const lifetime = new AbortController();
        let source, prepared, queue, cleanup, closed = false;
        const close = () => {
            if (closed) return;
            closed = true; lifetime.abort(); source = prepared = null;
            signal.removeEventListener('abort', close); context.signal.removeEventListener('abort', close);
            try { cleanup?.(); } finally { queue?.close(); queue = null; }
        };
        const active = () => {
            try { if (!closed && (signal.aborted || context.signal.aborted || getUser()?.uid !== uid || !isActive())) close(); }
            catch { close(); }
            return !closed;
        };
        const check = () => { if (!active()) throw new Error('NOTE_PROVIDER_INACTIVE'); };
        const invoke = async (opened, name, ...args) => {
            check(); const result = await opened[name](...args); check(); return result;
        };
        const ownedContext = {...context, signal: lifetime.signal,
            read: async record => { check(); const value = await context.read(record); check(); return value; },
            encrypt: async value => { check(); const ciphertext = await context.encrypt(value); check(); return ciphertext; }};
        const scope = operation => {
            check(); if (operation?.uid !== uid || operation?.recordId !== recordId) throw new Error('NOTE_PROVIDER_SCOPE');
        };
        const current = async () => {
            check(); const result = await readSource({uid, recordId, signal: lifetime.signal}); check();
            if (result?.source?.ownerId !== uid || result.source.id !== recordId) throw new Error('NOTE_PROVIDER_SCOPE');
            return {source: capturePrivateAccountSource(result.source), hasProfileLink: result.hasProfileLink};
        };
        signal.addEventListener('abort', close, {once: true}); context.signal.addEventListener('abort', close, {once: true});
        try {
            check();
            const recoveryOnly = !isOnline();
            let initialNote = '';
            if (!recoveryOnly) {
                const initial = await current();
                if (initial.hasProfileLink !== false) throw new Error('NOTE_PROVIDER_SCOPE');
                source = initial.source;
                assertPrivateNoteSourceCompatible(source);
                initialNote = source.note === '' ? '' : await ownedContext.read({ownerId: uid, ciphertext: source.note});
            }
            if (typeof initialNote !== 'string' || initialNote.length > 100000) throw new Error('NOTE_PROVIDER_VALUE');
            const mounted = await mountPanel(root, {signal: lifetime.signal, isActive: active, initialNote, recoveryOnly,
                recoveryRecordId: recordId, onSaved, onDiscarded,
                prepare: async note => {
                    check();
                    if (recoveryOnly) throw new Error('NOTE_PROVIDER_RECOVERY_ONLY');
                    const operation = await preparePrivateAccountMutation({context: ownedContext, source, changes: {note},
                        domain: 'private', uid, recordId, expectedRevision: source.revision, operationId: newOperationId(), deviceId, hasProfileLink: false});
                    check(); prepared = operation; return operation;
                },
                createClient: async callbacks => {
                    check(); const opened = await openQueue({domain: 'private-account', signal: lifetime.signal,
                        onState: event => {
                            if (!active()) return;
                            const operation = event.operation;
                            callbacks.onState(operation && operation.recordId !== recordId
                                ? {...event, operation: {uid, recordId: operation.recordId, operationId: operation.operationId}} : event);
                        },
                        onCommitted: event => { if (active() && event.recordId === recordId) return callbacks.onCommitted(event); }});
                    if (!active()) { opened.close(); throw new Error('NOTE_PROVIDER_INACTIVE'); }
                    queue = opened;
                    return Object.freeze({close: () => { opened.close(); if (queue === opened) queue = null; },
                        flush: () => invoke(opened, 'flush'),
                        pendingForRecord: id => { check(); if (id !== recordId) throw new Error('NOTE_PROVIDER_SCOPE'); return invoke(opened, 'pendingForRecord', id); },
                        enqueue: operation => { scope(operation); if (operation !== prepared) throw new Error('NOTE_PROVIDER_UNPREPARED'); return invoke(opened, 'enqueue', operation); },
                        discard: operation => { scope(operation); return invoke(opened, 'discard', operation); },
                        replace: (expected, replacement) => { scope(expected); scope(replacement); if (replacement !== prepared) throw new Error('NOTE_PROVIDER_UNPREPARED'); return invoke(opened, 'replace', expected, replacement); }});
                },
                readConflict: async operation => {
                    scope(operation); return readConflictNotes({context: ownedContext, operation, readLatest: async () => (await current()).source});
                },
                createConflictProposal: async operation => {
                    scope(operation);
                    // Reopened full-record commands have no durable note-only
                    // provenance. Allow comparison/discard, not silent rebase.
                    if (!prepared || JSON.stringify(operation) !== JSON.stringify(prepared)) return null;
                    const proposal = await createConflictNoteProposal({context: ownedContext, operation, readLatest: current,
                        noteOnly: true, deviceId, newOperationId});
                    if (!active()) { proposal.close(); throw new Error('NOTE_PROVIDER_INACTIVE'); }
                    return Object.freeze({get comparison() { check(); return proposal.comparison; }, close: proposal.close,
                        async prepareReplacement(options) { check(); const replacement = await proposal.prepareReplacement(options); check(); prepared = replacement; return replacement; }});
                }});
            if (!active()) { mounted?.(); return close; }
            cleanup = mounted; return close;
        } catch (error) { close(); throw error; }
    };
}
