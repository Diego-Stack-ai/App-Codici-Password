import { readLocalAiRuntimeDiagnostic } from './local-ai-runtime-loader.js';

const STORAGE_PREFIX = 'codici-password:local-ai-runtime-state:v1';
const EVENT_NAME = 'codici-password:local-ai-runtime-state';
const STATUSES = new Set(['verified', 'starting', 'ready', 'failed']);
const liveStates = new Map();

function storageKey(level, tier) {
    return `${STORAGE_PREFIX}:${level}:${level === 'A2' ? tier : 'default'}`;
}

function safeStorage() {
    try { return globalThis.sessionStorage || null; } catch { return null; }
}

function normalizeState(value) {
    if (!value || !STATUSES.has(value.status)) return null;
    const result = {
        status:value.status,
        stage:/^[a-z][a-z0-9-]{0,47}$/.test(String(value.stage || '')) ? String(value.stage) : null,
        diagnostic:null
    };
    if (value.status === 'failed') {
        result.diagnostic = readLocalAiRuntimeDiagnostic(value.diagnostic || {}, result.stage || 'runtime-initialization');
    }
    return Object.freeze(result);
}

export function readLocalAiRuntimeState(level, tier = 'desktop32') {
    const key = storageKey(level, tier);
    if (liveStates.has(key)) return liveStates.get(key);
    try {
        return normalizeState(JSON.parse(safeStorage()?.getItem(key) || 'null'));
    } catch { return null; }
}

export function writeLocalAiRuntimeState(level, tier, value) {
    const normalized = normalizeState(value);
    if (!normalized) throw new TypeError('LOCAL_AI_RUNTIME_STATE_INVALID');
    const key = storageKey(level, tier);
    liveStates.set(key, normalized);
    try {
        if (['failed', 'verified'].includes(normalized.status)) safeStorage()?.setItem(key, JSON.stringify(normalized));
        else safeStorage()?.removeItem(key);
    } catch { /* Stato best effort. */ }
    try {
        globalThis.dispatchEvent?.(new CustomEvent(EVENT_NAME, { detail:{ level, tier, state:normalized } }));
    } catch { /* Gli eventi non sono disponibili nei test Node. */ }
    return normalized;
}

export function reportLocalAiRuntimeFailure(level, tier, error, fallbackStage = 'runtime-initialization') {
    const diagnostic = readLocalAiRuntimeDiagnostic(error, fallbackStage);
    return writeLocalAiRuntimeState(level, tier, {
        status:'failed',
        stage:diagnostic.stage,
        diagnostic
    });
}

export function clearLocalAiRuntimeState(level, tier = 'desktop32') {
    const key = storageKey(level, tier);
    liveStates.delete(key);
    try { safeStorage()?.removeItem(key); } catch { /* Stato best effort. */ }
}

export function subscribeLocalAiRuntimeState(listener) {
    const handler = event => listener(event.detail);
    globalThis.addEventListener?.(EVENT_NAME, handler);
    return () => globalThis.removeEventListener?.(EVENT_NAME, handler);
}
