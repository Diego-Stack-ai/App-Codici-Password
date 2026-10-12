const CARD_MODE = 'card';

export function describeCardCameraError(error) {
    const name = String(error?.name || '');
    const message = String(error?.message || '');
    if (name === 'NotAllowedError' || name === 'SecurityError') {
        return 'Il browser o il dispositivo non ha concesso l’accesso alla fotocamera integrata.';
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

export function consumeAttachmentInitialMode(input) {
    const mode = input?.dataset?.attachmentInitialMode === CARD_MODE ? CARD_MODE : 'free';
    if (input?.dataset) delete input.dataset.attachmentInitialMode;
    return mode;
}

export async function captureCardAttachment({fallbackInput, confirmFallback}) {
    try {
        const {captureCardPhoto} = await import('./card-camera-capture.js');
        return await captureCardPhoto();
    } catch (error) {
        const reason = describeCardCameraError(error);
        const useNative = await confirmFallback(
            'Usa fotocamera nativa',
            `${reason} Vuoi scattare la tessera con la fotocamera del telefono e regolarla nel formato carta?`
        );
        if (useNative && fallbackInput) {
            fallbackInput.dataset.attachmentInitialMode = CARD_MODE;
            fallbackInput.click();
        }
        return null;
    }
}
