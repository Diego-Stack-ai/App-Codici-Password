const marks = new Map();
const samples = [];
const MAX_SAMPLES = 80;
const ENABLED_KEY = 'codex_performance_diagnostics_enabled';
const SAMPLES_KEY = 'codex_performance_diagnostics_samples_v1';
const SAFE_DETAIL_KEYS = new Set(['page', 'source', 'records', 'requests', 'resources', 'transferKb', 'cache', 'online', 'success']);

function diagnosticsEnabled() {
    try { return localStorage.getItem(ENABLED_KEY) === 'true'; } catch { return false; }
}

function safeDetail(detail) {
    return Object.fromEntries(Object.entries(detail || {}).filter(([key, value]) =>
        SAFE_DETAIL_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value)
    ));
}

function loadStoredSamples() {
    if (!diagnosticsEnabled()) return;
    try {
        const stored = JSON.parse(localStorage.getItem(SAMPLES_KEY) || '[]');
        if (Array.isArray(stored)) samples.push(...stored.slice(-MAX_SAMPLES));
    } catch { /* archivio diagnostico non valido: viene ignorato */ }
}

function persistSamples() {
    if (!diagnosticsEnabled()) return;
    try { localStorage.setItem(SAMPLES_KEY, JSON.stringify(samples.slice(-MAX_SAMPLES))); } catch { /* quota o modalità privata */ }
}

loadStoredSamples();

export function startMetric(name) {
    if (!name) return;
    marks.set(name, performance.now());
}

export function endMetric(name, detail = {}) {
    const startedAt = marks.get(name);
    if (startedAt == null) return null;
    marks.delete(name);
    const sample = {
        name,
        durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        at: Date.now(),
        ...safeDetail(detail)
    };
    samples.push(sample);
    if (samples.length > MAX_SAMPLES) samples.shift();
    persistSamples();
    window.dispatchEvent(new CustomEvent('codex:performance', { detail: sample }));
    return sample;
}

export function getPerformanceSamples() {
    return samples.map(sample => ({ ...sample }));
}

export function isPerformanceDiagnosticsEnabled() {
    return diagnosticsEnabled();
}

export function setPerformanceDiagnosticsEnabled(enabled) {
    try { localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false'); } catch { /* preferenza non persistibile */ }
    if (enabled) persistSamples();
    else clearPerformanceSamples();
}

export function clearPerformanceSamples() {
    marks.clear();
    samples.length = 0;
    try { localStorage.removeItem(SAMPLES_KEY); } catch { /* archivio non disponibile */ }
    window.dispatchEvent(new CustomEvent('codex:performance-cleared'));
}

export function captureNavigationMetric(page) {
    if (!diagnosticsEnabled()) return;
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource');
    const transferBytes = resources.reduce((total, entry) => total + (Number(entry.transferSize) || 0), 0);
    const sample = {
        name: 'page-navigation',
        durationMs: Math.round((navigation?.domContentLoadedEventEnd || performance.now()) * 10) / 10,
        at: Date.now(),
        page: String(page || 'unknown').slice(0, 48),
        online: navigator.onLine,
        resources: resources.length,
        transferKb: Math.round(transferBytes / 102.4) / 10
    };
    samples.push(sample);
    if (samples.length > MAX_SAMPLES) samples.shift();
    persistSamples();
    window.dispatchEvent(new CustomEvent('codex:performance', { detail: sample }));
}

export function getPerformanceDiagnosticReport() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        enabled: diagnosticsEnabled(),
        context: {
            online: navigator.onLine,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            deviceClass: window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'desktop',
            connection: connection?.effectiveType || 'non-disponibile'
        },
        samples: getPerformanceSamples()
    };
}
