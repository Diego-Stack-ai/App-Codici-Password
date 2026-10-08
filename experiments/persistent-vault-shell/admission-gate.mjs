// Candidate decision boundary only: no keys, storage, Firebase or navigation.
// Presentation acceptance is not permission to render sensitive content.
export function createAdmissionGate({getUser, isOnline, reloadUser, acceptIdentity,
    isIdentityActive, enableAppCheck, loadPolicy, requiredPolicyVersion}) {
    for (const fn of [getUser, isOnline, reloadUser, acceptIdentity, isIdentityActive, enableAppCheck, loadPolicy]) {
        if (typeof fn !== 'function') throw new TypeError('INVALID_ADMISSION_DEPENDENCY');
    }
    if (!Number.isSafeInteger(requiredPolicyVersion) || requiredPolicyVersion < 0) throw new TypeError('INVALID_POLICY_VERSION');
    let epoch = 0, disposed = false;
    const refuse = code => ({ok: false, code});
    function stale(snapshot, ticket) {
        if (disposed) return 'disposed';
        if (epoch !== snapshot.epoch) return 'invalidated';
        try {if (getUser()?.uid !== snapshot.uid) return 'uid-mismatch';}
        catch {return 'user-unavailable';}
        try {if (isIdentityActive(ticket) !== true) return 'inactive';}
        catch {return 'inactive';}
        // Synchronous observers can invalidate the gate, too.
        if (disposed) return 'disposed';
        if (epoch !== snapshot.epoch) return 'invalidated';
        return null;
    }
    async function check({ticket} = {}) {
        if (disposed) return refuse('disposed');
        const startEpoch = epoch;
        let online, user;
        try {online = isOnline();} catch {return refuse('online-indeterminate');}
        if (typeof online !== 'boolean') return refuse('online-indeterminate');
        try {user = getUser();} catch {return refuse('user-unavailable');}
        if (typeof user?.uid !== 'string' || !user.uid) return refuse('no-user');
        const snapshot = {uid: user.uid, epoch: startEpoch};
        const failure = code => refuse(stale(snapshot, ticket) || code);
        let bad = stale(snapshot, ticket);
        if (bad) return refuse(bad);
        if (online) {
            try {await reloadUser(user);} catch {return failure('reload-failed');}
            bad = stale(snapshot, ticket); if (bad) return refuse(bad);
        }
        try {user = getUser(); if (user?.emailVerified !== true) return refuse('email-unverified');}
        catch {return refuse('user-unavailable');}
        try {if (acceptIdentity(ticket, user) !== true) return failure('identity-rejected');}
        catch {return failure('identity-rejected');}
        bad = stale(snapshot, ticket); if (bad) return refuse(bad);
        if (online) {
            try {enableAppCheck();} catch {return failure('appcheck-failed');}
            bad = stale(snapshot, ticket); if (bad) return refuse(bad);
        }
        let policy;
        try {policy = await loadPolicy({uid: snapshot.uid, source: online ? 'server-only' : 'cache-only'});}
        catch {return failure('policy-load-failed');}
        bad = stale(snapshot, ticket); if (bad) return refuse(bad);
        let version;
        try {
            if (policy != null && (typeof policy !== 'object' || Array.isArray(policy))) return refuse('policy-malformed');
            version = policy?.passwordPolicyVersion ?? 0;
        } catch {return refuse('policy-malformed');}
        if (!Number.isSafeInteger(version) || version < 0) return refuse('policy-malformed');
        if (version < requiredPolicyVersion) return refuse('policy-insufficient');
        try {user = getUser(); if (user?.uid !== snapshot.uid) return refuse('uid-mismatch');
            if (user.emailVerified !== true) return refuse('email-unverified');}
        catch {return refuse('user-unavailable');}
        bad = stale(snapshot, ticket); if (bad) return refuse(bad);
        return {ok: true, uid: snapshot.uid, online};
    }
    return Object.freeze({check, invalidate() {epoch++;}, dispose() {disposed = true; epoch++;}});
}
