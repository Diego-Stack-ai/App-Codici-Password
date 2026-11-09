import {frameMediaLifetime, vaultFrameClient} from '../core/vault-frame-client.js';
const CARD_MODE = 'card';

export function describeCardCameraError(error, {permissionState, secureContext = globalThis.isSecureContext} = {}) {
    const name = String(error?.name || '');
    const message = String(error?.message || '');
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        if (secureContext === false) return 'La fotocamera integrata richiede una pagina HTTPS sicura.';
        if (permissionState === 'denied') return 'Il permesso fotocamera è bloccato nelle impostazioni del sito o del browser.';
        return 'Il browser non ha autorizzato la fotocamera integrata in questa pagina.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return 'Non è stata trovata una fotocamera utilizzabile.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
        return 'La fotocamera è occupata oppure non può essere avviata in questo momento.';
    }
    if (name === 'OverconstrainedError') {
        return 'La fotocamera disponibile non supporta la modalità richiesta.';
    }
    if (message === 'CAMERA_NOT_SUPPORTED') {
        return 'Questo browser non supporta la fotocamera integrata.';
    }
    return 'La fotocamera integrata non è disponibile in questa modalità.';
}

async function cameraContext() {
    let permissionState = 'unknown';
    try {
        const permission = await navigator.permissions?.query?.({name: 'camera'});
        permissionState = permission?.state || permissionState;
    } catch {}
    return {permissionState, secureContext: globalThis.isSecureContext};
}

export function consumeAttachmentInitialMode(input) {
    const mode = input?.dataset?.attachmentInitialMode === CARD_MODE ? CARD_MODE : 'free';
    if (input?.dataset) delete input.dataset.attachmentInitialMode;
    return mode;
}

const nativeSelections = new WeakMap();
function guardNativeSelection(input) {
    if (!vaultFrameClient.isChild()) return;
    nativeSelections.get(input)?.();
    const lifetime = frameMediaLifetime({stopWhenHidden: false, requireUnlocked: false});
    let done = false, revoked = false;
    const cleanup = clear => {
        if (done) return; done = true;
        input.removeEventListener('change', change, true); input.removeEventListener('cancel', cancel);
        lifetime.signal?.removeEventListener('abort', revoke);
        nativeSelections.delete(input);
        if (clear) {input.value = ''; delete input.dataset.attachmentInitialMode;}
        lifetime.dispose();
    };
    // Keep a tombstone until the OS picker settles: it may deliver after revocation.
    const revoke = () => {revoked = true; input.value = ''; delete input.dataset.attachmentInitialMode;};
    const cancel = () => cleanup(true);
    const change = event => {
        if (revoked || !lifetime.valid()) {event.stopImmediatePropagation(); cleanup(true); return;}
        if (vaultFrameClient.isUnlocked()) {cleanup(false); return;}
        event.stopImmediatePropagation();
        void vaultFrameClient.whenVisible().then(() => {
            if (revoked || !lifetime.valid() || !vaultFrameClient.isUnlocked()) {cleanup(true); return;}
            cleanup(false); input.dispatchEvent(new Event('change', {bubbles: true}));
        }).catch(() => cleanup(true));
    };
    input.addEventListener('change', change, true); input.addEventListener('cancel', cancel);
    lifetime.signal?.addEventListener('abort', revoke, {once: true});
    nativeSelections.set(input, cancel);
}

export async function captureCardAttachment({fallbackInput, confirmFallback}) {
    const lifetime = frameMediaLifetime();
    try {
        const {captureCardPhoto} = await import('./card-camera-capture.js');
        if (!lifetime.valid()) return null;
        const result = await captureCardPhoto({signal: lifetime.signal, isActive: lifetime.valid});
        return lifetime.valid() ? result : null;
    } catch (error) {
        if (!lifetime.valid()) return null;
        const context = await cameraContext();
        if (!lifetime.valid()) return null;
        const reason = describeCardCameraError(error, context);
        const openNative = () => {
            if (!lifetime.valid() || !fallbackInput) return;
            guardNativeSelection(fallbackInput);
            fallbackInput.dataset.attachmentInitialMode = CARD_MODE;
            fallbackInput.click();
        };
        let nativeOpened = false;
        const useNative = await confirmFallback(
            'Usa fotocamera nativa',
            `${reason} Vuoi scattare la tessera con la fotocamera del telefono e regolarla nel formato carta?`, undefined, undefined,
            {signal: lifetime.signal, onConfirm: () => {nativeOpened = true; openNative();}}
        );
        if (!lifetime.valid()) return null;
        if (useNative && !nativeOpened) openNative();
        return null;
    } finally {lifetime.dispose();}
}
