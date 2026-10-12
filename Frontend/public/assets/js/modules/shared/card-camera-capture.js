const CARD_RATIO = 1012 / 638;

export async function captureCardPhoto() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('CAMERA_NOT_SUPPORTED');
    const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
    return new Promise(resolve => {
        const overlay = document.createElement('div'); overlay.className = 'card-camera-overlay';
        const video = document.createElement('video'); video.className = 'card-camera-video'; video.autoplay = true; video.muted = true; video.playsInline = true; video.srcObject = stream;
        const frame = document.createElement('div'); frame.className = 'card-camera-frame';
        const help = document.createElement('p'); help.className = 'card-camera-help'; help.textContent = 'Centra la tessera nel rettangolo e mantieni il telefono fermo';
        const controls = document.createElement('div'); controls.className = 'card-camera-controls';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Annulla';
        const shoot = document.createElement('button'); shoot.type = 'button'; shoot.className = 'card-camera-shoot'; shoot.setAttribute('aria-label', 'Scatta foto della tessera');
        const finish = value => {window.removeEventListener('pagehide', cancelCapture); stream.getTracks().forEach(track => track.stop()); overlay.remove(); document.body.classList.remove('card-camera-open'); resolve(value);};
        const cancelCapture = () => finish(null);
        window.addEventListener('pagehide', cancelCapture, {once: true});
        cancel.addEventListener('click', () => finish(null));
        shoot.addEventListener('click', () => {
            if (!video.videoWidth || !video.videoHeight) return;
            const canvas = document.createElement('canvas');
            const videoRect = video.getBoundingClientRect(), frameRect = frame.getBoundingClientRect();
            const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
            const renderedWidth = video.videoWidth * scale, renderedHeight = video.videoHeight * scale;
            const offsetX = (videoRect.width - renderedWidth) / 2, offsetY = (videoRect.height - renderedHeight) / 2;
            const x = Math.max(0, (frameRect.left - videoRect.left - offsetX) / scale);
            const y = Math.max(0, (frameRect.top - videoRect.top - offsetY) / scale);
            const width = Math.min(video.videoWidth - x, frameRect.width / scale);
            const height = Math.min(video.videoHeight - y, frameRect.height / scale);
            canvas.width = 1012; canvas.height = 638;
            canvas.getContext('2d').drawImage(video, x, y, width, height, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => finish(blob ? new File([blob], `tessera-${Date.now()}.jpg`, {type: 'image/jpeg'}) : null), 'image/jpeg', .94);
        });
        controls.append(cancel, shoot); overlay.append(video, frame, help, controls); document.body.append(overlay); document.body.classList.add('card-camera-open');
        video.play().catch(() => finish(null));
    });
}
