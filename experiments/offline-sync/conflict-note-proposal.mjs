import {readConflictNotes} from './conflict-note-review.mjs';
import {capturePrivateAccountSource, preparePrivateAccountMutation} from '../persistent-vault-shell/prepare-private-account-mutation.mjs';

// Laboratory preparation only. Caller must prove this command edits only note;
// replacing an arbitrary full-record command could otherwise discard other edits.
export async function createConflictNoteProposal({context, operation, readLatest, noteOnly,
    newOperationId = () => crypto.randomUUID(), deviceId}) {
    if (noteOnly !== true || typeof readLatest !== 'function' || typeof newOperationId !== 'function' ||
        operation?._queueState || operation?._reviewReason) throw new Error('NOTE_PROPOSAL_SCOPE');
    const uid = context?.user?.uid, expected = structuredClone(operation);
    let closed = false, source, review, hasProfileLink, prepared, replacementId;
    const check = () => {
        if (closed || !uid || context.user?.uid !== uid || context.signal?.aborted || !context.unlocked) throw new Error('NOTE_PROPOSAL_INACTIVE');
    };
    const close = () => {
        closed = true; source = review = prepared = null;
        context.signal?.removeEventListener('abort', close);
    };
    check();
    if (!context.signal) throw new Error('NOTE_PROPOSAL_SCOPE');
    context.signal.addEventListener('abort', close, {once: true});
    try {
        review = await readConflictNotes({context, operation: expected, readLatest: async scope => {
            const result = await readLatest(scope); check();
            if (result?.hasProfileLink !== false) throw new Error('NOTE_PROPOSAL_SCOPE');
            hasProfileLink = false;
            source = capturePrivateAccountSource(result.source);
            return source;
        }});
        check();
        // Empty-note deletion remains outside the existing mutation preparer.
        if (!review.localNote) throw new Error('NOTE_PROPOSAL_EMPTY_UNSUPPORTED');
        return Object.freeze({
            get comparison() { check(); return review; },
            close,
            async prepareReplacement({confirmed = false} = {}) {
                check();
                if (confirmed !== true) throw new Error('NOTE_PROPOSAL_CONFIRMATION_REQUIRED');
                if (!replacementId) {
                    replacementId = newOperationId();
                    if (typeof replacementId !== 'string' || !/^[A-Za-z0-9:_-]{1,180}$/.test(replacementId) || replacementId === expected.operationId) {
                        replacementId = null; throw new Error('NOTE_PROPOSAL_ID_INVALID');
                    }
                }
                if (!prepared) prepared = preparePrivateAccountMutation({context, source,
                    changes: {note: review.localNote}, domain: 'private', uid, recordId: expected.recordId,
                    expectedRevision: review.onlineRevision, operationId: replacementId, deviceId, hasProfileLink});
                try { const result = await prepared; check(); return result; }
                catch (error) { prepared = null; throw error; }
            }
        });
    } catch (error) { close(); throw error; }
}
