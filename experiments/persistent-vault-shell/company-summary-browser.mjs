// Static, non-user assets may survive view changes. Generated PDFs never do.
const fontAssets = new Map();
export function createCompanyPdfActions({assertActive, fetchImpl = fetch, loadGenerator = () => import('/company-summary-pdf.js'),
    navigatorApi = navigator, documentApi = document, urlApi = URL, FileClass = File}) {
    let disposed = false; const urls = new Set();
    const check = () => {if (disposed) throw Error('VIEW_DISPOSED'); assertActive();};
    const file = bytes => new FileClass([bytes], 'scheda-azienda.pdf', {type: 'application/pdf'});
    const revoke = url => {if (urls.delete(url)) urlApi.revokeObjectURL(url);};
    return Object.freeze({
        async generate(model) {
            check(); const {generateCompanySummaryPdf} = await loadGenerator(); check();
            const loadFont = async name => {
                const fetchAsset = async () => {
                    const response = await fetchImpl(`/assets/pdf/${name}`);
                    if (!response.ok) throw Error('PDF_FONT_UNAVAILABLE');
                    const bytes = new Uint8Array(await response.arrayBuffer());
                    if (!bytes.length || bytes.length > 1000000) throw Error('PDF_FONT_INVALID'); return bytes;
                };
                if (fetchImpl !== globalThis.fetch) {const bytes = await fetchAsset(); check(); return bytes;}
                if (!fontAssets.has(name)) fontAssets.set(name, fetchAsset().catch(error => {fontAssets.delete(name); throw error;}));
                const bytes = await fontAssets.get(name); check(); return bytes;
            };
            const [regularFont, boldFont] = await Promise.all([loadFont('LiberationSans-Regular.ttf'), loadFont('LiberationSans-Bold.ttf')]);
            check(); return generateCompanySummaryPdf(model, {regularFont, boldFont, assertActive: check});
        },
        canShare(bytes) {
            try {check(); return typeof navigatorApi.share === 'function' && typeof navigatorApi.canShare === 'function' && navigatorApi.canShare({files: [file(bytes)]});} catch {return false;}
        },
        share(bytes) {check(); return navigatorApi.share({files: [file(bytes)], title: 'Scheda aziendale'});},
        download(bytes) {
            check(); const url = urlApi.createObjectURL(file(bytes)); urls.add(url);
            const anchor = documentApi.createElement('a'); anchor.href = url; anchor.download = 'scheda-azienda.pdf'; anchor.rel = 'noopener';
            try {check(); documentApi.body.append(anchor); anchor.click();}
            finally {anchor.remove(); anchor.removeAttribute('href'); setTimeout(() => revoke(url), 1000);}
        },
        dispose() {disposed = true; for (const url of [...urls]) revoke(url);}
    });
}
