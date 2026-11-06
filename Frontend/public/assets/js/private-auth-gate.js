/* Presentation gate only: Firebase Rules remain the data authorization boundary. */
(() => {
    const AUTH_CHECK_TIMEOUT_MS = 45000;
    const FAILURE_MARKER_KEY = 'codex_auth_gate_last_failure_v1';
    let epoch = 0, blocked = false, ready = false, acceptedUid = null, redirecting = false;
    let timer, armedAt = 0;
    const setPendingState = pending => {
        const root = document.documentElement;
        if (!root?.dataset) return;
        if (pending) root.dataset.privateAuthState = 'pending';
        else delete root.dataset.privateAuthState;
    };
    const hide = () => {
        setPendingState(true);
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
        if (reason) {
            try {
                sessionStorage.setItem(FAILURE_MARKER_KEY, JSON.stringify({
                    reason,
                    at: new Date().toISOString(),
                    page: String(window.location?.pathname || '').split('/').pop().slice(0, 64),
                    elapsedMs: armedAt ? Math.max(0, Date.now() - armedAt) : 0
                }));
            } catch { /* La diagnostica non deve impedire il blocco fail-closed. */ }
        }
        block();
        if (!redirecting) {
            redirecting = true;
            window.location.replace('/login.html' + (reason ? '?authCheck=' + reason : ''));
        }
    };
    // Safari/PWA può impiegare più di 15 secondi a ripristinare Firebase e IndexedDB.
    // La pagina resta comunque nascosta e inert fino alla conferma dell'identità.
    const arm = () => {
        clearTimeout(timer);
        armedAt = Date.now();
        timer = setTimeout(() => reject('timeout'), AUTH_CHECK_TIMEOUT_MS);
    };
    window.privateAuthGate = Object.freeze({
        begin(uid) {
            hide(); ready = false;
            let loggedOut = true;
            try { loggedOut = sessionStorage.getItem('codex_explicit_logout') === '1'; } catch { /* fail closed */ }
            if (blocked || loggedOut || (window.authSessionFence && !window.authSessionFence.isLocallyAllowed()) ||
                (acceptedUid && acceptedUid !== uid)) { reject(); return null; }
            arm();
            return ++epoch;
        },
        acceptIdentity(ticket, user) {
            if (blocked || ticket === null || ticket !== epoch || !user?.uid || !user.emailVerified ||
                (window.authSessionFence && !window.authSessionFence.isLocallyAllowed())) return false;
            clearTimeout(timer); acceptedUid = user.uid; ready = true;
            setPendingState(false);
            document.body.hidden = false; document.body.inert = false;
            return true;
        },
        active: ticket => !blocked && ticket !== null && ticket === epoch &&
            (!window.authSessionFence || window.authSessionFence.isLocallyAllowed()),
        isReady: () => ready,
        block, reject
    });
    setPendingState(true);
    arm();
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', event => { if (event.persisted) { hide(); window.location.reload(); } });
})();
