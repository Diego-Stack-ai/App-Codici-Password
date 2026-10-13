const CARD_RATIO = 1012 / 638;
const PREVIEW_SIZE = {width: 1012, height: 638};
const CAMERA_IDEAL_SIZE = {width: 4096, height: 2160};
const OVERSCAN = 1.08;
const MIN_ZOOM = .93;
const MAX_ZOOM = 1.15;
const STYLESHEET_ID = 'card-camera-capture-stylesheet';

function ensureCardCameraStyles() {
    const existing = document.getElementById(STYLESHEET_ID);
    if (existing) return existing.dataset.loaded === 'true'
        ? Promise.resolve()
        : new Promise((resolve, reject) => {
            existing.addEventListener('load', resolve, {once: true});
            existing.addEventListener('error', reject, {once: true});
        });
    return new Promise((resolve, reject) => {
        const stylesheet = document.createElement('link');
        stylesheet.id = STYLESHEET_ID;
        stylesheet.rel = 'stylesheet';
        stylesheet.href = new URL('../../../css/card-camera-capture.css', import.meta.url).href;
        stylesheet.addEventListener('load', () => { stylesheet.dataset.loaded = 'true'; resolve(); }, {once: true});
        stylesheet.addEventListener('error', reject, {once: true});
        document.head.append(stylesheet);
    });
}

export function clampCardAdjustment({zoom = 1, x = 0, y = 0}, sourceWidth, sourceHeight) {
    const numericZoom = Number(zoom);
    const safeZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number.isFinite(numericZoom) ? numericZoom : 1));
    const baseWidth = Math.min(sourceWidth, sourceHeight * CARD_RATIO) / OVERSCAN;
    const cropWidth = Math.min(sourceWidth, sourceHeight * CARD_RATIO, baseWidth / safeZoom);
    const cropHeight = Math.min(sourceHeight, cropWidth / CARD_RATIO);
    const limitX = Math.max(0, (sourceWidth - cropWidth) / 2);
    const limitY = Math.max(0, (sourceHeight - cropHeight) / 2);
    return {zoom: safeZoom, x: Math.min(limitX, Math.max(-limitX, Number(x) || 0)), y: Math.min(limitY, Math.max(-limitY, Number(y) || 0)), cropWidth, cropHeight};
}

function renderAdjusted(source, target, adjustment) {
    const state = clampCardAdjustment(adjustment, source.width, source.height);
    const sx = (source.width - state.cropWidth) / 2 + state.x;
    const sy = (source.height - state.cropHeight) / 2 + state.y;
    const context = target.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, target.width, target.height);
    context.drawImage(source, sx, sy, state.cropWidth, state.cropHeight, 0, 0, target.width, target.height);
    return state;
}

export function cardOutputSize(adjustment, sourceWidth, sourceHeight) {
    const state = clampCardAdjustment(adjustment, sourceWidth, sourceHeight);
    return {width: Math.max(1, Math.round(state.cropWidth)), height: Math.max(1, Math.round(state.cropHeight))};
}

function renderFullResolution(source, adjustment) {
    const target = document.createElement('canvas');
    const size = cardOutputSize(adjustment, source.width, source.height);
    target.width = size.width; target.height = size.height;
    renderAdjusted(source, target, adjustment);
    return target;
}

export async function captureCardPhoto() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('CAMERA_NOT_SUPPORTED');
    await ensureCardCameraStyles();
    const stream = await navigator.mediaDevices.getUserMedia({video: {
        facingMode: {ideal: 'environment'},
        width: {ideal: CAMERA_IDEAL_SIZE.width},
        height: {ideal: CAMERA_IDEAL_SIZE.height}
    }, audio: false});
    return new Promise(resolve => {
        const overlay = document.createElement('div'); overlay.className = 'card-camera-overlay';
        const video = document.createElement('video'); video.className = 'card-camera-video'; video.autoplay = true; video.muted = true; video.playsInline = true; video.srcObject = stream;
        const frame = document.createElement('div'); frame.className = 'card-camera-frame';
        const preview = document.createElement('canvas'); preview.className = 'card-camera-preview'; preview.width = PREVIEW_SIZE.width; preview.height = PREVIEW_SIZE.height;
        const help = document.createElement('p'); help.className = 'card-camera-help'; help.textContent = 'Centra la tessera nel rettangolo e mantieni il telefono fermo';
        const controls = document.createElement('div'); controls.className = 'card-camera-controls';
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Annulla';
        const shoot = document.createElement('button'); shoot.type = 'button'; shoot.className = 'card-camera-shoot'; shoot.setAttribute('aria-label', 'Scatta foto della tessera');
        const retake = document.createElement('button'); retake.type = 'button'; retake.textContent = 'Ripeti foto'; retake.className = 'card-camera-preview-control';
        const use = document.createElement('button'); use.type = 'button'; use.textContent = 'Usa foto'; use.className = 'card-camera-preview-control card-camera-use';
        const zoom = document.createElement('input'); zoom.type = 'range'; zoom.min = String(MIN_ZOOM); zoom.max = String(MAX_ZOOM); zoom.step = '.01'; zoom.value = '1'; zoom.className = 'card-camera-zoom'; zoom.setAttribute('aria-label', 'Zoom tessera');
        const source = document.createElement('canvas');
        let adjustment = {zoom: 1, x: 0, y: 0};
        let previewing = false;
        const pointers = new Map();
        let previousCenter = null, previousDistance = 0;
        const finish = value => {window.removeEventListener('pagehide', cancelCapture); stream.getTracks().forEach(track => track.stop()); overlay.remove(); document.body.classList.remove('card-camera-open'); resolve(value);};
        const cancelCapture = () => finish(null);
        const refresh = () => {
            adjustment = renderAdjusted(source, preview, adjustment);
            zoom.value = String(adjustment.zoom);
            const output = cardOutputSize(adjustment, source.width, source.height);
            help.textContent = `Trascina per centrare · Risoluzione finale ${output.width}×${output.height} px`;
        };
        const showLive = () => {previewing = false; adjustment = {zoom: 1, x: 0, y: 0}; pointers.clear(); overlay.classList.remove('card-camera-adjusting'); help.textContent = 'Centra la tessera nel rettangolo e mantieni il telefono fermo';};
        const showPreview = () => {
            if (!video.videoWidth || !video.videoHeight) return;
            const videoRect = video.getBoundingClientRect(), frameRect = frame.getBoundingClientRect();
            const scale = Math.max(videoRect.width / video.videoWidth, videoRect.height / video.videoHeight);
            const renderedWidth = video.videoWidth * scale, renderedHeight = video.videoHeight * scale;
            const offsetX = (videoRect.width - renderedWidth) / 2, offsetY = (videoRect.height - renderedHeight) / 2;
            const frameX = (frameRect.left - videoRect.left - offsetX) / scale;
            const frameY = (frameRect.top - videoRect.top - offsetY) / scale;
            const frameWidth = frameRect.width / scale, frameHeight = frameRect.height / scale;
            const width = Math.min(video.videoWidth, frameWidth * OVERSCAN);
            const height = Math.min(video.videoHeight, frameHeight * OVERSCAN);
            const x = Math.min(video.videoWidth - width, Math.max(0, frameX - (width - frameWidth) / 2));
            const y = Math.min(video.videoHeight - height, Math.max(0, frameY - (height - frameHeight) / 2));
            source.width = Math.round(width); source.height = Math.round(height);
            source.getContext('2d').drawImage(video, x, y, width, height, 0, 0, source.width, source.height);
            previewing = true; overlay.classList.add('card-camera-adjusting'); refresh();
        };
        const pointerSnapshot = () => [...pointers.values()];
        const resetGesture = () => {
            const values = pointerSnapshot();
            previousCenter = values.length ? {x: values.reduce((sum, point) => sum + point.x, 0) / values.length, y: values.reduce((sum, point) => sum + point.y, 0) / values.length} : null;
            previousDistance = values.length > 1 ? Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y) : 0;
        };
        preview.addEventListener('pointerdown', event => {if (!previewing) return; preview.setPointerCapture(event.pointerId); pointers.set(event.pointerId, {x: event.clientX, y: event.clientY}); resetGesture();});
        preview.addEventListener('pointermove', event => {
            if (!pointers.has(event.pointerId)) return;
            pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
            const values = pointerSnapshot();
            const center = {x: values.reduce((sum, point) => sum + point.x, 0) / values.length, y: values.reduce((sum, point) => sum + point.y, 0) / values.length};
            const rect = preview.getBoundingClientRect();
            if (previousCenter) {adjustment.x -= (center.x - previousCenter.x) * source.width / rect.width / adjustment.zoom; adjustment.y -= (center.y - previousCenter.y) * source.height / rect.height / adjustment.zoom;}
            if (values.length > 1) {const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y); if (previousDistance) adjustment.zoom *= distance / previousDistance; previousDistance = distance;}
            previousCenter = center; refresh();
        });
        const endPointer = event => {pointers.delete(event.pointerId); resetGesture();};
        preview.addEventListener('pointerup', endPointer); preview.addEventListener('pointercancel', endPointer);
        zoom.addEventListener('input', () => {adjustment.zoom = Number(zoom.value); refresh();});
        window.addEventListener('pagehide', cancelCapture, {once: true}); cancel.addEventListener('click', () => finish(null)); shoot.addEventListener('click', showPreview); retake.addEventListener('click', showLive);
        use.addEventListener('click', () => {
            const output = renderFullResolution(source, adjustment);
            output.toBlob(blob => {
                output.width = output.height = 0;
                finish(blob ? new File([blob], `tessera-${Date.now()}.jpg`, {type: 'image/jpeg'}) : null);
            }, 'image/jpeg', .98);
        });
        controls.append(cancel, shoot, retake, use); frame.append(preview); overlay.append(video, frame, help, zoom, controls); document.body.append(overlay); document.body.classList.add('card-camera-open');
        video.play().catch(() => finish(null));
    });
}
