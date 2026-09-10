/**
 * Presentazione multimediale opzionale della Home.
 * Il video protetto viene richiesto soltanto dopo un gesto esplicito.
 */

import { auth } from '../../firebase-config.js?v=1.2.89';

let presentationObjectUrl = null;

export function initHomePresentation() {
    const openButton = document.getElementById('app-presentation-open');
    const modal = document.getElementById('app-presentation-modal');
    const playButton = document.getElementById('app-presentation-play');
    const stage = document.getElementById('app-presentation-stage');
    if (!openButton || !modal || !playButton || !stage) return;

    const closeModal = () => {
        modal.hidden = true;
        document.body.style.removeProperty('overflow');
        stage.querySelector('video')?.pause();
        openButton.focus();
    };

    openButton.addEventListener('click', () => {
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        playButton.focus();
    });
    modal.querySelectorAll('[data-presentation-close]').forEach(element => {
        element.addEventListener('click', closeModal);
    });
    modal.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeModal();
    });

    playButton.addEventListener('click', async () => {
        const existingVideo = stage.querySelector('video');
        if (existingVideo) {
            await existingVideo.play();
            return;
        }

        playButton.disabled = true;
        playButton.querySelector('span:last-child').textContent = 'Caricamento…';
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error('Sessione non disponibile.');
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 20000);
            let response;
            try {
                response = await fetch('/protected-media/presentation', {
                    headers: { Authorization: `Bearer ${idToken}` },
                    cache: 'no-store',
                    signal: controller.signal
                });
            } finally {
                window.clearTimeout(timeout);
            }
            if (!response.ok) throw new Error(`Download non disponibile (${response.status}).`);
            presentationObjectUrl = URL.createObjectURL(await response.blob());
            const video = document.createElement('video');
            video.src = presentationObjectUrl;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.setAttribute('aria-label', 'Presentazione di Codici e Password');
            stage.replaceChildren(video);
            playButton.querySelector('span:last-child').textContent = 'Riproduci';
            await video.play();
        } catch (error) {
            console.warn('[PRESENTAZIONE] Video non disponibile.', error);
            const message = document.createElement('div');
            message.className = 'app-presentation-loading';
            message.setAttribute('role', 'alert');
            message.textContent = 'Il video non è ancora disponibile. Riprova tra poco.';
            stage.replaceChildren(message);
            playButton.querySelector('span:last-child').textContent = 'Riprova';
        } finally {
            playButton.disabled = false;
        }
    });

    window.addEventListener('pagehide', () => {
        if (presentationObjectUrl) URL.revokeObjectURL(presentationObjectUrl);
    }, { once: true });
}
