import {documentAttachmentMime, documentAttachmentSize} from './profile-document-attachments-contract.mjs';

// Header/type check before encryption. Not an antivirus or a full image decoder.
// The viewer remains an <img>, never an executable document or embedded HTML.
export function assertDocumentImageSignature(bytes, mimeType) {
    if (!(bytes instanceof Uint8Array) || !documentAttachmentSize(bytes.length)) throw Error('SIZE_NOT_ALLOWED');
    if (!documentAttachmentMime(mimeType)) throw Error('MIME_NOT_ALLOWED');
    const starts = values => values.every((byte, index) => bytes[index] === byte);
    const ascii = (offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
    const uint32 = offset => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
    let matches = false;
    if (mimeType === 'image/jpeg') matches = bytes.length >= 4 && starts([255, 216, 255]) && bytes[3] !== 0 && bytes[3] !== 255;
    if (mimeType === 'image/png') matches = bytes.length >= 33 && starts([137, 80, 78, 71, 13, 10, 26, 10])
        && uint32(8) === 13 && ascii(12, 4) === 'IHDR' && uint32(16) > 0 && uint32(20) > 0;
    if (mimeType === 'image/webp') matches = bytes.length >= 16 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP'
        && ['VP8 ', 'VP8L', 'VP8X'].includes(ascii(12, 4))
        && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length;
    if ((mimeType === 'image/heic' || mimeType === 'image/heif') && bytes.length >= 24 && ascii(4, 4) === 'ftyp') {
        const size = uint32(0);
        if (size >= 24 && size <= bytes.length && size <= 4096 && size % 4 === 0) {
            const brands = [ascii(8, 4)];
            for (let offset = 16; offset < size; offset += 4) brands.push(ascii(offset, 4));
            const heic = brands.some(brand => ['heic', 'heix', 'hevc', 'hevx'].includes(brand));
            matches = !brands.some(brand => ['avif', 'avis'].includes(brand)) && (mimeType === 'image/heic' ? heic
                : heic || brands.some(brand => ['mif1', 'msf1'].includes(brand)));
        }
    }
    if (!matches) throw Error('IMAGE_SIGNATURE_MISMATCH');
}
