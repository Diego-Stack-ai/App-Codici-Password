/* Presentation gate only: Firebase Rules remain the data authorization boundary. */
(() => {
    const requestingDocument = document;
    document.documentElement.dataset.privateLoadingLabel = 'Verifica accesso in corso…';
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
        try { if (window.parent !== window) window.parent.vaultFrameNavigation?.revokeFromChild(window, requestingDocument); } catch { /* No frame authority. */ }
        window.dispatchEvent(new Event('private-auth-blocked'));
    };
    // Classic head script: keep this bounded predicate in parity with
    // app-env.js without waiting for an ESM import.
    const hasFixedRecoveryIntent = () => {
        if (!/(?:^|\/)(?:login|impostazioni)\.html$/.test(window.location?.pathname || '')) return false;
        try {
            const values = new URLSearchParams(window.location.search || '').getAll('recovery');
            return values.length === 1 && values[0] === 'complete';
        } catch { return false; }
    };
    const reject = (reason = '') => {
        if (window.document && requestingDocument !== window.document) return;
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
            window.dispatchEvent(new Event('frame-diagnostics-login'));
            const recovery = hasFixedRecoveryIntent();
            const target = recovery ? '/login.html?recovery=complete' : '/login.html';
            const destination = target + (reason ? (recovery ? '&' : '?') + 'authCheck=' + encodeURIComponent(String(reason)) : '');
            if (window.vaultFrameNavigation?.deferExit(destination, true)) return;
            try {
                if (window.parent !== window && window.parent.vaultFrameNavigation) {
                    window.parent.vaultFrameNavigation.navigateFromChild(window, requestingDocument, destination, true); return;
                }
            } catch { /* Standalone. */ }
            window.location.replace(destination);
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
        // Identity readiness and first-page presentation are different states.
        // The body remains usable by the real Vault modal while Home is held.
        reveal(ticket) {
            if (window.document && window.document !== requestingDocument) return false;
            if (!ready || blocked || ticket === null || ticket !== epoch || !acceptedUid ||
                (window.authSessionFence && !window.authSessionFence.isLocallyAllowed())) return false;
            delete document.documentElement.dataset.privatePageState;
            return true;
        },
        active: ticket => !blocked && ticket !== null && ticket === epoch &&
            (!window.authSessionFence || window.authSessionFence.isLocallyAllowed()),
        isReady: () => ready,
        block, reject
    });
    if (/(?:^|\/)home_page\.html$/.test(window.location?.pathname || '')) {
        document.documentElement.dataset.privatePageState = 'pending';
    }
    setPendingState(true);
    arm();
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', event => { if (event.persisted) { hide(); window.location.reload(); } });
})();
