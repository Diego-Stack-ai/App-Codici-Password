// One save per editor. Unknown outcomes keep the exact request in RAM for an
// idempotent retry. Disposal cannot cancel a write already accepted by backend.
function privateRequest(prepared, operationId) {
    if (!Object.isFrozen(prepared.selection) || ['phones', 'emails', 'addresses'].some(key =>
        !Array.isArray(prepared.selection[key]) || !Object.isFrozen(prepared.selection[key]))) throw Error('PREPARATION_INVALID');
    return Object.freeze({selection: prepared.selection, expectedRevision: prepared.expectedRevision, operationId});
}
export function createQrSelectionSaveController({context, getUser, prepare, submit, onState = () => {},
    createOperationId = () => crypto.randomUUID(), createRequest = privateRequest}) {
    const uid = context.user?.uid;
    let disposed = false, busy = false, status = 'idle', operation = null;
    const dispose = () => {disposed = true; operation = null; context.signal.removeEventListener('abort', dispose);};
    const active = () => {
        try {
            if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) return false;
            context.assertUnlocked(); return true;
        } catch {return false;}
    };
    const check = () => {if (!active()) {dispose(); throw new Error('VIEW_DISPOSED');}};
    const emit = next => {
        status = next; if (active()) {try {onState(Object.freeze({status}));} catch {/* UI cannot change certainty. */}}
        return Object.freeze({status: active() ? status : 'detached'});
    };
    const send = async () => {
        check(); emit('saving');
        if (!active()) {dispose(); return {status: 'detached'};}
        try {
            const response = await submit(operation.request);
            if (!active()) {dispose(); return {status: 'detached'};}
            if (response?.status !== 'confirmed' || response.revision !== operation.expectedRevision + 1) return emit('unknown');
            operation = null; return emit('saved');
        } catch {
            if (!active()) {dispose(); return {status: 'detached'};}
            return emit('unknown');
        }
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) dispose();
    return Object.freeze({dispose,
        async save(selection) {
            check(); if (busy || status !== 'idle') throw new Error('SAVE_NOT_IDLE');
            busy = true;
            try {
                emit('preparing'); check();
                const operationId = createOperationId();
                if (typeof operationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(operationId)) throw new Error('OPERATION_ID_INVALID');
                const prepared = await prepare(selection, operationId); check();
                if (!prepared || !Number.isSafeInteger(prepared.expectedRevision) || prepared.expectedRevision < 0 || prepared.expectedRevision >= Number.MAX_SAFE_INTEGER) throw new Error('PREPARATION_INVALID');
                const request = createRequest(prepared, operationId);
                if (!request || typeof request !== 'object' || Array.isArray(request) || !Object.isFrozen(request)) throw Error('REQUEST_INVALID');
                operation = Object.freeze({request, expectedRevision: prepared.expectedRevision});
                return await send();
            } catch {
                if (!active()) {dispose(); return {status: 'detached'};}
                if (operation) return emit('unknown');
                return emit('invalid');
            } finally {busy = false;}
        },
        async retry() {
            check(); if (busy || status !== 'unknown' || !operation) throw new Error('RETRY_UNAVAILABLE');
            busy = true;
            try {return await send();} finally {busy = false;}
        }
    });
}
