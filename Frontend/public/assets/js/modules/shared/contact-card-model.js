const MAX_CARD_BYTES = 12000;
const supported = /^(?:FN|N|TEL(?:;TYPE=(?:CELL|HOME|WORK))?|EMAIL(?:;TYPE=INTERNET)?|ADR|BDAY|X-CF|X-BIRTHPLACE|NOTE|URL|PHOTO;VALUE=URI):/;

export function validatePhotoURL(value) {
    const url = new URL(value);
    const objectPath = decodeURIComponent(url.pathname);
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' ||
        url.username || url.password || url.port ||
        !/^\/v0\/b\/appcodici-password\.firebasestorage\.app\/o\/users\/[^/]+\/avatar_[^/]+$/.test(objectPath)) {
        throw new Error('La foto non proviene dal profilo dell’app.');
    }
    return url.href;
}

export function readContactCard(fragment) {
    const encoded = String(fragment).replace(/^#card=/, '');
    if (!encoded || encoded.length > 16000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('QR del contatto non valido.');
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const vcard = new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
    if (new TextEncoder().encode(vcard).length > MAX_CARD_BYTES || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(vcard)) throw new Error('Dati del contatto non validi.');
    const lines = vcard.replace(/\r\n/g, '\n').split('\n');
    if (lines.shift() !== 'BEGIN:VCARD' || lines.shift() !== 'VERSION:3.0' || lines.pop() !== 'END:VCARD' ||
        lines.some(line => !supported.test(line) || line.includes('\r'))) throw new Error('Formato del contatto non valido.');
    const photos = lines.filter(line => line.startsWith('PHOTO;VALUE=URI:'));
    if (photos.length !== 1) throw new Error('La foto del contatto non è presente.');
    const photoURL = validatePhotoURL(photos[0].slice('PHOTO;VALUE=URI:'.length).replace(/\\([,;])/g, '$1'));
    const name = (lines.find(line => line.startsWith('FN:'))?.slice(3) || 'Contatto condiviso').replace(/\\([nN,;\\])/g, (_, c) => /n/i.test(c) ? ' ' : c);
    return {lines: lines.filter(line => !line.startsWith('PHOTO;')), photoURL, name};
}

// vCard 3.0 binary PHOTO uses base64 with folded content lines.
export function embedContactPhoto(card, jpegDataURL) {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(jpegDataURL);
    if (!match || match[1].length > 500000) throw new Error('Impossibile preparare la foto del contatto.');
    const line = 'PHOTO;ENCODING=b;TYPE=JPEG:' + match[1];
    const folded = [line.slice(0, 75)];
    for (let i = 75; i < line.length; i += 74) folded.push(' ' + line.slice(i, i + 74));
    const fields = [...card.lines];
    if (!fields.some(field => field.startsWith('FN:'))) fields.unshift('FN:Contatto condiviso');
    return ['BEGIN:VCARD', 'VERSION:3.0', ...fields, ...folded, 'END:VCARD', ''].join('\r\n');
}
