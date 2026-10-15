import { validateLocalAiPackageManifest } from './advanced-local-ai-contract.js';
import { hashReadableStream } from './incremental-sha256.js';

const CACHE_PREFIX = 'codex-local-ai-';
const ACTIVE_KEY = 'codex.local-ai.active.v1';

function packageCacheName(manifest, suffix = 'ready') {
    return `${CACHE_PREFIX}${manifest.level.toLowerCase()}-${manifest.packageId}-${manifest.version}-${suffix}`;
}

function safeUrl(baseUrl, relativePath, origin) {
    const base = new URL(baseUrl, origin);
    if (base.origin !== origin) throw new TypeError('LOCAL_AI_PACKAGE_URL_SCOPE');
    const url = new URL(relativePath, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) {
        throw new TypeError('LOCAL_AI_PACKAGE_URL_SCOPE');
    }
    return url;
}

function readActive(storage) {
    try { return JSON.parse(storage.getItem(ACTIVE_KEY) || '{}'); } catch { return {}; }
}

function writeActive(storage, value) {
    storage.setItem(ACTIVE_KEY, JSON.stringify(value));
}

export function createLocalAiPackageManager({
    cacheStorage = globalThis.caches,
    storage = globalThis.localStorage,
    storageManager = globalThis.navigator?.storage,
    fetchFn = globalThis.fetch?.bind(globalThis),
    origin = globalThis.location?.origin || 'https://invalid.local'
} = {}) {
    if (!cacheStorage || !storage || !fetchFn) throw new Error('LOCAL_AI_PLATFORM_UNAVAILABLE');
    let activeDownload = null;

    async function estimate(manifestInput) {
        const manifest = validateLocalAiPackageManifest(manifestInput);
        const quota = await storageManager?.estimate?.() || {};
        const quotaBytes = Number.isSafeInteger(quota.quota) ? quota.quota : null;
        const usageBytes = Number.isSafeInteger(quota.usage) ? quota.usage : null;
        const availableBytes = quotaBytes === null || usageBytes === null ? null : Math.max(0, quotaBytes - usageBytes);
        const temporaryRequiredBytes = Math.ceil(manifest.approxDownloadBytes * 2.15);
        return Object.freeze({ requiredBytes: manifest.approxDownloadBytes, temporaryRequiredBytes, quotaBytes, usageBytes, availableBytes,
            enough: availableBytes === null ? null : availableBytes >= temporaryRequiredBytes });
    }

    async function install(manifestInput, { baseUrl, signal, onProgress = () => {} } = {}) {
        if (activeDownload) throw new Error('LOCAL_AI_DOWNLOAD_BUSY');
        const manifest = validateLocalAiPackageManifest(manifestInput);
        if (!baseUrl) throw new TypeError('LOCAL_AI_PACKAGE_BASE_URL');
        const quota = await estimate(manifest);
        if (quota.enough === false) throw new Error('LOCAL_AI_QUOTA_INSUFFICIENT');
        const controller = new AbortController();
        const abort = () => controller.abort(signal?.reason);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        activeDownload = controller;
        const stagingName = packageCacheName(manifest, 'staging');
        const readyName = packageCacheName(manifest);
        let completedBytes = 0;
        try {
            await cacheStorage.delete(stagingName);
            const staging = await cacheStorage.open(stagingName);
            for (const file of manifest.files) {
                if (controller.signal.aborted) throw new DOMException('Download annullato', 'AbortError');
                const sourceUrl = safeUrl(baseUrl, file.path, origin);
                const response = await fetchFn(sourceUrl, { cache: 'no-store', credentials: 'omit', signal: controller.signal });
                if (!response.ok) throw new Error(`LOCAL_AI_FETCH_${response.status}`);
                if (!response.body) throw new Error('LOCAL_AI_STREAM_UNAVAILABLE');
                const cacheWrite = staging.put(new Request(sourceUrl), response.clone());
                const verified = await hashReadableStream(response.body, {
                    signal: controller.signal,
                    onChunk: fileBytes => onProgress(Object.freeze({
                        completedBytes: completedBytes + fileBytes,
                        totalBytes: manifest.approxDownloadBytes,
                        path: file.path
                    }))
                });
                await cacheWrite;
                if (verified.bytes !== file.bytes) throw new Error('LOCAL_AI_FILE_SIZE_MISMATCH');
                if (verified.sha256 !== file.sha256) throw new Error('LOCAL_AI_FILE_HASH_MISMATCH');
                completedBytes += file.bytes;
                onProgress(Object.freeze({ completedBytes, totalBytes: manifest.approxDownloadBytes, path: file.path }));
            }
            await cacheStorage.delete(readyName);
            const ready = await cacheStorage.open(readyName);
            for (const request of await staging.keys()) await ready.put(request, await staging.match(request));
            await cacheStorage.delete(stagingName);
            const active = readActive(storage);
            active[manifest.level] = { packageId: manifest.packageId, version: manifest.version, cacheName: readyName };
            writeActive(storage, active);
            return Object.freeze({ manifest, cacheName: readyName, completedBytes });
        } catch (error) {
            await cacheStorage.delete(stagingName);
            throw error;
        } finally {
            signal?.removeEventListener('abort', abort);
            activeDownload = null;
        }
    }

    async function remove(level) {
        const active = readActive(storage);
        const selected = active[level];
        if (selected?.cacheName) await cacheStorage.delete(selected.cacheName);
        delete active[level];
        writeActive(storage, active);
        for (const name of await cacheStorage.keys()) {
            if (name.startsWith(`${CACHE_PREFIX}${String(level).toLowerCase()}-`)) await cacheStorage.delete(name);
        }
    }

    async function status(level) {
        const selected = readActive(storage)[level] || null;
        return Object.freeze({ level, downloading: Boolean(activeDownload), installed: Boolean(selected), active: selected });
    }

    return Object.freeze({
        estimate, install, remove, status,
        abort() { activeDownload?.abort(); }
    });
}

export { CACHE_PREFIX as LOCAL_AI_CACHE_PREFIX };

