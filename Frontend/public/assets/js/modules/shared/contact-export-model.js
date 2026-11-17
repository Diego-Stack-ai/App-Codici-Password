// Contact copies leave the app. File handles are local to one operation only.
export function contactVCardFileName({company = false, companyName = '', name = '', surname = ''} = {}) {
    const holder = company ? companyName : [name, surname].filter(Boolean).join(' ');
    const clean = String(holder).normalize('NFC').replace(/[^\p{L}\p{N} _.-]/gu, ' ')
        .replace(/[.\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    const prefix = company ? 'contatto-azienda' : 'contatto';
    const chars = [], encoder = new TextEncoder();
    let budget = 180 - encoder.encode(prefix + '-.vcf').length;
    for (const char of Array.from(clean).slice(0, 120)) {
        const size = encoder.encode(char).length;
        if (size > budget) break;
        chars.push(char); budget -= size;
    }
    const part = chars.join('').replace(/-+$/g, '');
    return `${prefix}${part ? '-' + part : ''}.vcf`;
}

export function createContactFileActions({value, filename, assertActive, checkCurrent = async () => {}, environment = globalThis}) {
    let bytes = new TextEncoder().encode(value), disposed = false, busy = false;
    value = null;
    const urls = new Map();
    const assertLocal = () => {
        if (disposed) throw Error('CONTACT_EXPORT_CLOSED');
        assertActive();
    };
    const current = async () => {
        assertLocal(); await checkCurrent(); assertLocal();
    };
    const file = () => new environment.File([bytes], filename, {type: 'text/vcard'});
    const canShare = () => {
        try {return !disposed && typeof environment.navigator?.share === 'function' &&
            environment.navigator.canShare?.({files: [file()]}) === true;}
        catch {return false;}
    };
    const unsupported = () => Object.assign(Error('CONTACT_EXPORT_UNAVAILABLE'), {name: 'NotSupportedError'});
    const once = operation => () => {
        if (busy) return Promise.reject(Error('CONTACT_EXPORT_BUSY'));
        busy = true;
        // Invoke now, in the trusted click. Never await before opening the native API.
        try {return Promise.resolve(operation()).finally(() => {busy = false;});}
        catch (error) {busy = false; return Promise.reject(error);}
    };
    return Object.freeze({
        canSave: () => !disposed && typeof environment.showSaveFilePicker === 'function',
        canShare,
        save: once(async () => {
            assertLocal();
            if (typeof environment.showSaveFilePicker !== 'function') throw unsupported();
            let handle, writable;
            try {
                handle = await environment.showSaveFilePicker({suggestedName: filename,
                    types: [{description: 'vCard', accept: {'text/vcard': ['.vcf']}}]});
                await current();
                writable = await handle.createWritable(); await current();
                await writable.write(bytes); await current();
                assertLocal(); await writable.close(); assertLocal();
                return {kind: 'saved', name: handle.name || filename};
            } catch (error) {
                try {await writable?.abort();} catch { /* The system may already have closed it. */ }
                throw error;
            } finally {handle = null; writable = null;}
        }),
        share: once(async () => {
            assertLocal();
            if (!canShare()) throw unsupported();
            await environment.navigator.share({files: [file()], title: filename});
            await current();
            return {kind: 'shared', name: filename};
        }),
        download: once(() => {
            assertLocal();
            const url = environment.URL.createObjectURL(new environment.Blob([bytes], {type: 'text/vcard;charset=utf-8'}));
            const link = environment.document.createElement('a');
            link.href = url; link.download = filename; link.hidden = true;
            try {
                environment.document.body.append(link); assertLocal(); link.click();
            } catch (error) {environment.URL.revokeObjectURL(url); throw error;}
            finally {link.remove();}
            const timer = environment.setTimeout(() => {environment.URL.revokeObjectURL(url); urls.delete(url);}, 1000);
            urls.set(url, timer);
            return {kind: 'download-started', name: filename};
        }),
        dispose() {
            if (disposed) return; disposed = true; bytes.fill(0); bytes = null;
            for (const [url, timer] of urls) {environment.clearTimeout(timer); environment.URL.revokeObjectURL(url);}
            urls.clear();
        }
    });
}
