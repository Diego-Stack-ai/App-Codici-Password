import {embedContactPhoto, validatePhotoURL} from './contact-card-model.js';

export async function loadContactPhoto(photoURL) {
    const response = await fetch(validatePhotoURL(photoURL), {
        credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok || Number(response.headers.get('content-length')) > 6 * 1024 * 1024) throw new Error('La foto non è disponibile.');
    const blob = await response.blob();
    if (blob.size > 6 * 1024 * 1024 || !/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error('Formato della foto non supportato.');
    return blob;
}

export async function encodeContactPhoto(blob) {
    const bitmap = await createImageBitmap(blob);
    try {
        const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.85);
    } finally { bitmap.close(); }
}

export async function prepareContactVCard(card, {loadPhoto = loadContactPhoto, encodePhoto = encodeContactPhoto} = {}) {
    const photo = await loadPhoto(card.photoURL);
    const jpeg = await encodePhoto(photo);
    return {vcard: embedContactPhoto(card, jpeg), photo: jpeg};
}
