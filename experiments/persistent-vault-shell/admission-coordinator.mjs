// Candidate coordinator only. The caller owns Vault locking and physical single-flight.
export function createAdmissionCoordinator({getUser, getTicket, isTicketActive, admission, onRefused}) {
    for (const fn of [getUser, getTicket, isTicketActive, onRefused,
        admission?.check, admission?.invalidate, admission?.dispose]) {
        if (typeof fn !== 'function') throw new TypeError('INVALID_ADMISSION_DEPENDENCY');
    }
    let epoch = 0, sequence = 0, disposed = false;
    const issued = new WeakSet(), failed = new WeakSet();
    const obsolete = () => new Error('ATTEMPT_OBSOLETE');
    const localCurrent = s => !disposed && s.epoch === epoch &&
        (s.sequence === null || s.sequence === sequence) && !failed.has(s);
    function refuse(s, code) {
        if (!localCurrent(s)) throw obsolete();
        failed.add(s);
        // Never suppress cleanup errors; the caller must use nested finally.
        onRefused(code);
        const error = new Error('ADMISSION_REFUSED');
        error.code = code;
        throw error;
    }
    function owner(s) {
        if (!issued.has(s)) throw new TypeError('INVALID_ADMISSION_ATTEMPT');
        if (!localCurrent(s)) throw obsolete();
        let uid;
        try {uid = getUser()?.uid;}
        catch {return refuse(s, 'admission-user-unavailable');}
        // A synchronous identity reader can itself invalidate the attempt.
        if (!localCurrent(s)) throw obsolete();
        if (uid !== s.uid) throw obsolete();
    }
    function assertCurrent(s) {
        owner(s);
        let active, threw = false;
        try {active = isTicketActive(s.ticket);}
        catch {threw = true;}
        owner(s);
        if (threw) refuse(s, 'admission-ticket-unavailable');
        if (active !== true) refuse(s, 'admission-ticket-inactive');
        return true;
    }
    function begin(kind) {
        if (!['unlock', 'navigate'].includes(kind)) throw new TypeError('INVALID_ADMISSION_KIND');
        if (disposed) throw new Error('SESSION_DISPOSED');
        const s = {epoch, sequence: kind === 'navigate' ? ++sequence : null, uid: null, ticket: null};
        issued.add(s);
        try {s.uid = getUser()?.uid;}
        catch {refuse(s, 'admission-user-unavailable');}
        if (!localCurrent(s)) throw obsolete();
        if (typeof s.uid !== 'string' || !s.uid) refuse(s, 'admission-no-user');
        let threw = false;
        try {s.ticket = getTicket();} catch {threw = true;}
        owner(s);
        if (threw) refuse(s, 'admission-ticket-unavailable');
        return Object.freeze(s);
    }
    async function check(s) {
        assertCurrent(s);
        let result, threw = false;
        try {result = await admission.check({ticket: s.ticket});}
        catch {threw = true;}
        owner(s);
        if (threw) refuse(s, 'admission-failed');
        let valid = false;
        try {valid = result?.ok === true && result.uid === s.uid;}
        catch { /* malformed result is refused after the ownership recheck */ }
        owner(s);
        if (!valid) refuse(s, 'admission-refused');
        assertCurrent(s);
        return Object.freeze({uid: s.uid});
    }
    return Object.freeze({begin, check, assertCurrent,
        invalidate() {if (!disposed) {epoch++; admission.invalidate();}},
        dispose() {if (!disposed) {disposed = true; epoch++; admission.dispose();}}
    });
}
