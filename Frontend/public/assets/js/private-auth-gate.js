/* Presentation gate only: Firebase Rules remain the data authorization boundary. */
(() => {
    let epoch = 0, blocked = false, ready = false, acceptedUid = null;
    let timer;
    const hide = () => {
        if (document.body) { document.body.hidden = true; document.body.inert = true; }
    };
    const block = () => {
        blocked = true; ready = false; epoch++;
        clearTimeout(timer); hide();
        for (const key of ['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry']) {
            try { sessionStorage.removeItem(key); } catch { /* Storage can be unavailable. */ }
        }
        window.dispatchEvent(new Event('private-auth-blocked'));
    };
    const reject = (reason = '') => {
        block();
        window.location.replace('/login-v115.html' + (reason ? '?authCheck=' + reason : ''));
    };
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => reject('timeout'), 15000); };
    window.privateAuthGate = Object.freeze({
        begin(uid) {
            hide(); ready = false;
            let loggedOut = true;
            try { loggedOut = sessionStorage.getItem('codex_explicit_logout') === '1'; } catch { /* fail closed */ }
            if (blocked || loggedOut || (acceptedUid && acceptedUid !== uid)) { reject(); return null; }
            arm();
            return ++epoch;
        },
        acceptIdentity(ticket, user) {
            if (blocked || ticket === null || ticket !== epoch || !user?.uid || !user.emailVerified) return false;
            clearTimeout(timer); acceptedUid = user.uid; ready = true;
            document.body.hidden = false; document.body.inert = false;
            return true;
        },
        active: ticket => !blocked && ticket !== null && ticket === epoch,
        isReady: () => ready,
        block, reject
    });
    arm();
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', event => { if (event.persisted) { hide(); window.location.reload(); } });
})();
