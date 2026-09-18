// Cutover boundary: delete legacy unlock material; never read or reuse it.
export function clearLegacyUnlock(storage) {
    if (!storage) return;
    for (const name of ['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry']) {
        storage.removeItem(name);
    }
}

export function bindBrowserSession(session, target = globalThis) {
    if (typeof target.addEventListener !== 'function') return () => {};
    const handlers = new Map([
        ['pagehide', () => session.lock('pagehide')],
        ['freeze', () => session.lock('freeze')],
        ['private-auth-blocked', () => { detach(); session.dispose(); }],
        ['pageshow', event => { if (event.persisted) session.lock('bfcache'); }]
    ]);
    for (const [name, handler] of handlers) target.addEventListener(name, handler, {capture: true});
    const detach = () => { for (const [name, handler] of handlers) target.removeEventListener(name, handler, {capture: true}); };
    return detach;
}
