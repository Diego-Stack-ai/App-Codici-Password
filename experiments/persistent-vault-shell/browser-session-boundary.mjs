// Cutover boundary: delete legacy unlock material; never read or reuse it.
export function clearLegacyUnlock(storage) {
    if (!storage) return;
    let failed = false, firstError;
    for (const name of ['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry']) {
        try {storage.removeItem(name);}
        catch (error) {
            if (!failed) firstError = error;
            failed = true;
        }
    }
    // Still refuse startup on any failure, but do not leave other removable
    // unlock material behind merely because an earlier deletion failed.
    if (failed) throw firstError;
}

export function bindBrowserSession(session, target = globalThis) {
    if (typeof target.addEventListener !== 'function') return () => {};
    const document = target.document;
    const registrations = [];
    let detached = false, timer = null;
    const active = action => event => { if (!detached) action(event); };
    const on = (emitter, name, action) => {
        const handler = active(action);
        emitter.addEventListener(name, handler, {capture: true});
        registrations.push([emitter, name, handler]);
    };
    const detach = () => {
        if (detached) return;
        detached = true;
        let failed = false, firstError;
        const attempt = action => {
            try {action();} catch (error) {if (!failed) firstError = error; failed = true;}
        };
        if (timer !== null) {const oldTimer = timer; timer = null; attempt(() => target.clearInterval(oldTimer));}
        for (const [emitter, name, handler] of registrations.splice(0)) {
            attempt(() => emitter.removeEventListener(name, handler, {capture: true}));
        }
        if (failed) throw firstError;
    };
    try {
        on(target, 'pagehide', () => session.lock('pagehide'));
        on(target, 'pageshow', event => {if (event.persisted) session.lock('bfcache');});
        on(target, 'private-auth-blocked', () => {try {detach();} finally {session.dispose();}});
        const lifecycle = typeof document?.addEventListener === 'function' ? document : target;
        on(lifecycle, 'freeze', () => session.lock('freeze'));
        if (lifecycle === document) {
            on(document, 'pointerdown', () => session.touch());
            on(document, 'keydown', () => session.touch());
            on(document, 'visibilitychange', () => {if (document.hidden) session.lock('background');});
        }
        // No ambient timer fallback: Node-only tests and other event targets do
        // not acquire browser resources. This checks the existing Vault expiry;
        // it does not renew it or introduce a different timeout.
        if (typeof target.setInterval === 'function' && typeof target.clearInterval === 'function') {
            timer = target.setInterval(active(() => session.check()), 1000);
        }
    } catch (error) {detach(); throw error;}
    return detach;
}
