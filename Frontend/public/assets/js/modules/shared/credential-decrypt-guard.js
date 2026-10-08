// Per-instance loading state: failed loads cannot reopen saving at their tail.
export const DECRYPT_FAILURE_MESSAGE = 'Alcuni dati non sono leggibili: il salvataggio è disabilitato. Sblocca di nuovo la cassaforte o ricarica la pagina.';

export function createAccountLoadContext({recordId = null, mode = 'edit'} = {}) {
    let generation = 0;
    let state = mode === 'create' ? 'ready' : 'pending';
    let failure = null;
    return {
        recordId,
        mode,
        get generation() { return generation; },
        beginLoad() {
            if (state === 'invalidated') return null;
            generation += 1;
            state = 'pending';
            failure = null;
            return generation;
        },
        isCurrent(token) { return Number.isInteger(token) && token > 0 && token === generation && state !== 'invalidated'; },
        isPending() { return state === 'pending'; },
        isFailed() { return state === 'failed'; },
        isReady() { return state === 'ready'; },
        isInvalidated() { return state === 'invalidated'; },
        failure() { return failure ? {...failure} : null; },
        markLoaded(token) {
            if (!Number.isInteger(token) || token <= 0 || token !== generation || state !== 'pending') return false;
            state = 'ready';
            failure = null;
            return true;
        },
        markFailed(token, code = 'ACCOUNT_DECRYPT_FAILED') {
            if (!Number.isInteger(token) || token <= 0 || token !== generation || state === 'invalidated') return false;
            state = 'failed';
            failure = {code};
            return true;
        },
        invalidate() {
            state = 'invalidated';
            failure = null;
            return true;
        }
    };
}

export function accountSaveBlockedReason(context) {
    if (!context || typeof context.isReady !== 'function') return 'ACCOUNT_SAVE_CONTEXT_MISSING';
    if (context.isFailed()) return context.failure()?.code || 'ACCOUNT_DECRYPT_FAILED';
    if (context.isInvalidated()) return 'ACCOUNT_LOAD_INVALIDATED';
    if (!context.isReady()) return 'ACCOUNT_LOAD_PENDING';
    return null;
}

export function isAccountSaveAllowed(context) {
    return accountSaveBlockedReason(context) === null;
}

export function assertAccountSaveAllowed(context) {
    const reason = accountSaveBlockedReason(context);
    if (reason) throw Object.assign(new Error(reason), {code: reason});
    return true;
}
