import { clearVaultSession } from './modules/core/vault-session.js';

// Local protection precedes Firebase and survives a failed or stalled signOut.
export async function logoutWithCleanup(signOutOperation, redirect = '/login-v115.html') {
    window.privateAuthGate?.block();
    window.dispatchEvent(new Event('private-auth-blocked'));
    try { clearVaultSession(); } catch { /* RAM and presentation are already locked. */ }
    try { sessionStorage.setItem('codex_explicit_logout', '1'); } catch { /* Redirect still required. */ }
    let timer;
    try {
        await Promise.race([
            Promise.resolve().then(signOutOperation),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SIGN_OUT_TIMEOUT')), 10000); })
        ]);
    } catch {
        // Keep the local deny marker until a new explicit login succeeds.
    } finally {
        clearTimeout(timer);
        if (redirect) window.location.replace(redirect);
    }
}
