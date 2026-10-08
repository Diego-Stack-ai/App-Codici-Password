// Loopback laboratory identity tickets only; not policy or data authorization.
export function createLocalPresentation({origin, getUser}) {
    if (origin !== 'http://127.0.0.1:4188') throw new Error('LOCAL_EMULATOR_ONLY');
    if (typeof getUser !== 'function') throw new TypeError('INVALID_IDENTITY_READER');
    let epoch = 0, uid = null, ticket = null, disposed = false;
    function invalidate() {epoch++; uid = null; ticket = null;}
    function identity() {
        const before = epoch;
        const user = getUser();
        const next = user?.uid;
        if (disposed || before !== epoch) return null;
        const normalized = typeof next === 'string' && next ? next : null;
        if (normalized !== uid) {epoch++; uid = normalized; ticket = null;}
        return {uid, epoch, user};
    }
    function getTicket() {
        if (disposed) return null;
        const current = identity();
        if (!current?.uid) return null;
        return ticket ??= Object.freeze({});
    }
    function active(value) {
        if (disposed) return false;
        const current = identity();
        return Boolean(current?.uid && value && value === ticket && !disposed && current.epoch === epoch);
    }
    function acceptIdentity(value, user) {
        if (disposed) return false;
        const current = identity();
        if (!current?.uid) return false;
        const verified = user?.emailVerified === true && current.user?.emailVerified === true;
        const same = user?.uid === current.uid;
        return verified && same && value !== null && value === ticket && !disposed && current.epoch === epoch;
    }
    return Object.freeze({getTicket, active, acceptIdentity, invalidate,
        dispose() {if (!disposed) {disposed = true; invalidate();}}
    });
}
