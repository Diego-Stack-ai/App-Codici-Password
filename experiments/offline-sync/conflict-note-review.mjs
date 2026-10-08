// Read-only comparison. The caller supplies an owner-bound, fresh reader;
// this helper neither prepares a replacement nor changes the queue.
export async function readConflictNotes({context, operation, readLatest}) {
    const uid = context?.user?.uid;
    const check = () => {
        if (!uid || context.user?.uid !== uid || context.signal?.aborted || !context.unlocked) throw new Error('CONFLICT_REVIEW_INACTIVE');
    };
    check();
    if (!context.signal || typeof context.read !== 'function' || typeof readLatest !== 'function' ||
        operation?.uid !== uid || operation.schemaVersion !== 1 || !/^[A-Za-z0-9_-]{1,180}$/.test(operation.recordId || '') ||
        operation.record?.type !== 'account' || operation.record.visibility !== 'private' || operation.record._encrypted !== true ||
        typeof operation.record.note !== 'string') throw new Error('CONFLICT_REVIEW_SCOPE');
    const recordId = operation.recordId, localCipher = operation.record.note;
    const latest = await readLatest({uid, recordId, signal: context.signal}); check();
    if (!latest || latest.id !== recordId || latest.ownerId !== uid || latest.schemaVersion !== 1 ||
        latest.type !== 'account' || latest.visibility !== 'private' || latest._encrypted !== true ||
        !Number.isSafeInteger(latest.revision) || latest.revision < 0 || typeof latest.note !== 'string') throw new Error('CONFLICT_REVIEW_SCOPE');
    const onlineCipher = latest.note, onlineRevision = latest.revision;
    const read = async ciphertext => {
        check();
        const value = ciphertext === '' ? '' : await context.read({ownerId: uid, ciphertext}); check();
        if (typeof value !== 'string' || value.length > 100000) throw new Error('CONFLICT_REVIEW_VALUE');
        return value;
    };
    const localNote = await read(localCipher), onlineNote = await read(onlineCipher); check();
    return Object.freeze({localNote, onlineNote, onlineRevision});
}
