// Candidate bridge only. Invalidation revokes tickets; session owns physical lock.
export function createPrivateGatePresentation({gate, getUser} = {}) {
    if (!gate || ['begin', 'active', 'acceptIdentity'].some(key => typeof gate[key] !== 'function') || typeof getUser !== 'function') {
        throw new TypeError('INVALID_PRESENTATION_DEPENDENCIES');
    }
    let epoch = 0, held = null, disposed = false;
    function invalidate() {epoch++; held = null;}
    function current(snapshot) {return !disposed && held === snapshot && snapshot !== null && snapshot.epoch === epoch;}
    function readIdentity() {
        const user = getUser();
        return {uid: user?.uid, verified: user?.emailVerified === true};
    }
    function check(snapshot, ticket) {
        if (!current(snapshot) || snapshot.ticket !== ticket) return null;
        let identity;
        try {identity = readIdentity();}
        catch (error) {if (current(snapshot)) invalidate(); throw error;}
        if (!current(snapshot)) return null;
        if (identity.uid !== snapshot.uid) {invalidate(); return null;}
        return identity;
    }
    function beginIdentity() {
        if (disposed) throw new Error('PRESENTATION_DISPOSED');
        invalidate();
        const mine = epoch;
        const fresh = () => !disposed && epoch === mine;
        try {
            const {uid} = readIdentity();
            if (!fresh() || typeof uid !== 'string' || !uid) return null;
            const ticket = gate.begin(uid);
            if (!fresh()) return null;
            const after = readIdentity();
            if (!fresh() || after.uid !== uid || ticket == null) return null;
            held = {uid, ticket, epoch: mine};
            return ticket;
        } catch (error) {
            if (fresh()) invalidate();
            throw error;
        }
    }
    function active(ticket) {
        const snapshot = held;
        if (!check(snapshot, ticket)) return false;
        const accepted = gate.active(ticket) === true;
        return Boolean(check(snapshot, ticket)) && accepted;
    }
    function getTicket() {
        const snapshot = held;
        return snapshot && active(snapshot.ticket) ? snapshot.ticket : null;
    }
    function acceptIdentity(ticket, user) {
        const snapshot = held;
        // Snapshot argument fields before invoking the gate (getters can reenter).
        const uid = user?.uid, verified = user?.emailVerified === true;
        const identity = check(snapshot, ticket);
        if (!identity?.verified || !verified || uid !== snapshot.uid) return false;
        const accepted = gate.acceptIdentity(ticket, {uid, emailVerified: true}) === true;
        return Boolean(check(snapshot, ticket)) && accepted;
    }
    return Object.freeze({beginIdentity, getTicket, active, acceptIdentity, invalidate,
        dispose() {if (!disposed) {disposed = true; invalidate();}}
    });
}
