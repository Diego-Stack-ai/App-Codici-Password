const idPattern = /^[A-Za-z0-9_-]{1,180}$/u;
const operationPattern = /^[A-Za-z0-9:_-]{1,180}$/u;
const fail = code => { throw new Error(code); };
const state = (status, details = {}) => Object.freeze({status, ...details});
function immutableData(value, seen = new WeakSet()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (!value || typeof value !== 'object' || !Object.isFrozen(value) || seen.has(value) ||
        (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) return false;
    seen.add(value);
    const valid = Reflect.ownKeys(value).every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return typeof key === 'string' && key !== 'toJSON' && Object.hasOwn(descriptor, 'value') && immutableData(descriptor.value, seen);
    });
    seen.delete(value);
    return valid;
}

// One operation per view. Unknown outcomes retain only the prepared envelope in
// RAM. Disposal detaches consumers; an already submitted write may still commit.
export function createPrivateAccountSaveController({context, getUser, prepare, submit, lookupResult, onState = () => {}}) {
    const uid = context?.user?.uid;
    if (typeof uid !== 'string' || !uid || !context?.signal || !context.unlocked ||
        ![getUser, prepare, submit, lookupResult, onState].every(value => typeof value === 'function')) fail('SAVE_CONTEXT_INVALID');
    let disposed = false, busy = false, status = 'idle', operation = null;
    function dispose() {
        disposed = true; operation = null;
        context.signal.removeEventListener('abort', dispose);
    }
    function active() {
        let currentUid;
        try { currentUid = getUser()?.uid; } catch { /* A failing provider cannot authorize a write. */ }
        if (disposed || context.signal.aborted || !context.unlocked || currentUid !== uid) { dispose(); return false; }
        return true;
    }
    function assertActive() { if (!active()) fail('VIEW_DISPOSED'); }
    function emit(next) {
        status = next.status;
        if (active()) { try { onState(next); } catch { /* UI failures do not change commit certainty. */ } }
        return next;
    }
    function detached() { return state('detached'); }
    function begin(expectedStatus) {
        assertActive();
        if (busy) fail('SAVE_BUSY');
        if (status !== expectedStatus) fail(expectedStatus === 'idle' ? 'SAVE_ALREADY_STARTED' : 'SAVE_NOT_UNKNOWN');
        busy = true;
    }
    function metadata(input) {
        if (!input || input.uid !== uid || input.domain !== 'private' ||
            typeof input.recordId !== 'string' || !idPattern.test(input.recordId) ||
            typeof input.operationId !== 'string' || !operationPattern.test(input.operationId) ||
            typeof input.deviceId !== 'string' || !operationPattern.test(input.deviceId) ||
            !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
            input.expectedRevision >= Number.MAX_SAFE_INTEGER) fail('SAVE_INPUT_INVALID');
        return {recordId: input.recordId, operationId: input.operationId, deviceId: input.deviceId, expectedRevision: input.expectedRevision};
    }
    function validOperation(value, expected) {
        return value && immutableData(value) && value.schemaVersion === 1 &&
            value.record && Object.isFrozen(value.record) &&
            Object.entries(expected).every(([key, item]) => value[key] === item);
    }
    function resultState(result, fromLookup) {
        if (!result || typeof result !== 'object' || !operation) return null;
        for (const [field, value] of Object.entries({domain: 'private-account', recordId: operation.recordId, ownerUid: uid, deviceId: operation.deviceId})) {
            if ((fromLookup || Object.hasOwn(result, field)) && result[field] !== value) return null;
        }
        if ((fromLookup || Object.hasOwn(result, 'operationId')) && result.operationId !== operation.operationId) return null;
        if (result.status === 'applied' && Number.isSafeInteger(result.revision) && result.revision === operation.expectedRevision + 1 &&
            (typeof result.duplicate === 'boolean' || (fromLookup && result.duplicate === undefined))) {
            return state('applied', {revision: result.revision, duplicate: result.duplicate === true});
        }
        if (!fromLookup && result.status === 'conflict' && Number.isSafeInteger(result.currentRevision) && result.currentRevision >= 0) {
            return state('conflict', {currentRevision: result.currentRevision});
        }
        return null;
    }
    async function send() {
        assertActive();
        emit(state('submitting'));
        // onState can synchronously close a view; recheck immediately before send.
        if (!active()) return detached();
        try {
            const result = await submit(operation);
            if (!active()) return detached();
            const next = resultState(result, false) || state('unknown');
            if (next.status !== 'unknown') operation = null;
            return emit(next);
        } catch {
            return active() ? emit(state('unknown')) : detached();
        }
    }
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) dispose();
    return Object.freeze({
        async save(input) {
            begin('idle');
            try {
                let expected;
                try { expected = metadata(input); } catch { fail('SAVE_INPUT_INVALID'); }
                emit(state('preparing'));
                if (!active()) return detached();
                let prepared;
                try { prepared = await prepare({...input, context}); } catch {
                    if (!active()) return detached();
                    status = 'idle'; fail('SAVE_PREPARATION_FAILED');
                } finally { input = null; }
                if (!active()) return detached();
                if (!validOperation(prepared, expected)) { status = 'idle'; fail('SAVE_PREPARATION_FAILED'); }
                operation = prepared;
                return await send();
            } finally { busy = false; }
        },
        async retry() {
            begin('unknown');
            try { return await send(); } finally { busy = false; }
        },
        async reconcile() {
            begin('unknown');
            try {
                emit(state('reconciling'));
                if (!active()) return detached();
                try {
                    const result = await lookupResult(operation.operationId);
                    if (!active()) return detached();
                    const next = resultState(result, true) || state('unknown');
                    if (next.status !== 'unknown') operation = null;
                    return emit(next);
                } catch { return active() ? emit(state('unknown')) : detached(); }
            } finally { busy = false; }
        },
        dispose
    });
}
