import { HOSTED_ADVANCED_AI_CATALOG } from '../Frontend/public/assets/js/modules/assistant/local-ai-hosting-catalog.generated.js';

const origin = String(process.env.LOCAL_AI_PUBLIC_ORIGIN || process.argv[2] || 'https://appcodici-password.web.app')
    .replace(/\/$/, '');
const concurrency = 8;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function fetchWithRetry(url, options = {}, attempts = 4) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const response = await fetch(url, { redirect:'follow', ...options });
            if (response.ok) return response;
            lastError = new Error(`${response.status} ${response.statusText}: ${url}`);
        } catch (error) {
            lastError = error;
        }
        if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
    throw lastError;
}

async function verifyFile(baseUrl, file) {
    const url = `${origin}${baseUrl}${file.path}`;
    const response = await fetchWithRetry(url, { method:'HEAD', headers:{ 'Accept-Encoding':'identity' } });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    const contentLength = Number(response.headers.get('content-length'));
    assert(!contentType.includes('text/html'), `Fallback HTML al posto del modello: ${url}`);
    assert(Number.isSafeInteger(contentLength), `Content-Length assente o invalido: ${url}`);
    assert(contentLength === file.bytes,
        `Dimensione pubblica inattesa ${file.path}: ${contentLength}/${file.bytes}`);
}

async function parallelMap(items, worker) {
    let cursor = 0;
    const workers = Array.from({ length:Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            await worker(items[index]);
        }
    });
    await Promise.all(workers);
}

for (const [tier, entry] of Object.entries(HOSTED_ADVANCED_AI_CATALOG)) {
    const manifestUrl = `${origin}${entry.baseUrl}hosting-manifest.json?release=${Date.now()}`;
    const response = await fetchWithRetry(manifestUrl, { headers:{ 'Accept-Encoding':'identity' } }, 6);
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    assert(!contentType.includes('text/html'), `Manifest ${tier} sostituito dal fallback HTML`);
    const published = await response.json();
    assert(published.packageId === entry.manifest.packageId, `Package ID ${tier} non corrispondente`);
    assert(published.version === entry.manifest.version, `Versione ${tier} non corrispondente`);
    assert(published.approxDownloadBytes === entry.manifest.approxDownloadBytes,
        `Totale byte ${tier} non corrispondente`);
    assert(Array.isArray(published.files) && published.files.length === entry.manifest.files.length,
        `Inventario ${tier} non corrispondente`);
    await parallelMap(entry.manifest.files, file => verifyFile(entry.baseUrl, file));
    console.log(`${tier}: pubblicazione verificata (${entry.manifest.files.length} file, ${entry.manifest.approxDownloadBytes} byte)`);
}

