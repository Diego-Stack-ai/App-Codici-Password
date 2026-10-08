import {profileLinkAccount} from './profile-link-contract.mjs';

// Consult the existing encrypted M6 queue through its fenced capability. Never
// open raw IDB here, flush, rewrite or discard a pending command automatically.
export function createAccountNoteQueueAccess({context, getUser, account, openQueue}) {
    const uid = context.user?.uid, selection = profileLinkAccount(account);
    if (!uid || !selection || typeof openQueue !== 'function') throw Error('NOTE_QUEUE_CONFIG');
    const check = () => {
        if (context.signal.aborted || getUser()?.uid !== uid) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    const inspect = async () => {
        check();
        // M6's only Account queue domain is private-account; a company Account
        // with the same id is not that record. Revisit when company queues exist.
        if (selection.domain === 'company') return Object.freeze({status: 'clear'});
        let queue;
        try {
            queue = await openQueue({domain: 'private-account', signal: context.signal}); check();
            const result = await queue.pendingForRecord(selection.id); check();
            if (result?.acquired !== true) throw Error('NOTE_QUEUE_BUSY');
            if (result.value === null) return Object.freeze({status: 'clear'});
            if (!result.value || result.value.recordId !== selection.id || typeof result.value.operationId !== 'string' ||
                !/^[A-Za-z0-9:_-]{1,180}$/.test(result.value.operationId)) throw Error('NOTE_QUEUE_INVALID');
            return Object.freeze({status: 'pending', recordId: selection.id, operationId: result.value.operationId});
        } finally {queue?.close();}
    };
    return Object.freeze({inspect,
        async assertNoPendingMutation(scope) {
            check();
            if (scope?.uid !== uid || scope.signal !== context.signal ||
                JSON.stringify(profileLinkAccount(scope.account)) !== JSON.stringify(selection)) throw Error('NOTE_QUEUE_SCOPE');
            return (await inspect()).status === 'clear';
        }
    });
}
