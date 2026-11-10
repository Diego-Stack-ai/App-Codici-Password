import {navigateDocument, beginFrameLogout} from './frame-navigation.js';
import { clearVaultSession } from './modules/core/vault-session.js';
import './auth-session-fence.js';

const requestingDocument = document;

// Local protection precedes Firebase and survives a failed or stalled signOut.
export async function logoutWithCleanup(signOutOperation, redirect = '/login.html') {
    const frameLogoutToken = beginFrameLogout();
    if (window.document && requestingDocument !== window.document) return;
    window.privateAuthGate?.block();
    window.dispatchEvent(new Event('private-auth-blocked'));
    try { clearVaultSession(); } catch { /* RAM and presentation are already locked. */ }
    try { sessionStorage.setItem('codex_explicit_logout', '1'); } catch { /* Redirect still required. */ }
    let timer;
    try {
        // Even a failed SDK signOut leaves a durable deny for fresh/other tabs.
        try { await window.authSessionFence?.deny(); } catch { /* Still attempt SDK logout. */ }
        await Promise.race([
            Promise.resolve().then(signOutOperation),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('SIGN_OUT_TIMEOUT')), 10000); })
        ]);
    } catch {
        // Keep the local deny marker until a new explicit login succeeds.
    } finally {
        clearTimeout(timer);
        if (window.document && requestingDocument !== window.document) return;
        try { if (window.parent !== window) window.parent.vaultFrameNavigation?.finishLogoutFromChild(window, requestingDocument, frameLogoutToken); } catch { /* Standalone. */ }
        if (redirect) navigateDocument(redirect, true);
    }
}
