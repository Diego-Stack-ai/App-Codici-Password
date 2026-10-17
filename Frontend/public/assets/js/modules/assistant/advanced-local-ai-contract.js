const LEVELS = new Set(['A1', 'A2']);
const ADVANCED_TIERS = Object.freeze(['light', 'medium', 'power']);
const INTENTS = new Set(['explain_page', 'semantic_search', 'select_result', 'clarify']);
const LOCALE = /^[a-z]{2}(?:-[A-Z]{2})?$/;
const PACKAGE_ID = /^[a-z0-9][a-z0-9._-]{2,80}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const FORBIDDEN_KEY = /(password|passphrase|pin|puk|cvv|secret|token|privatekey|vaultkey|recovery)/i;

function requireCondition(condition, code) {
    if (!condition) throw new TypeError(`LOCAL_AI_${code}`);
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
        && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys, code) {
    requireCondition(isPlainObject(value), code);
    const actual = Object.keys(value);
    requireCondition(actual.length === keys.length && keys.every(key => Object.hasOwn(value, key)), code);
}

function boundedText(value, maximum, code, { optional = false } = {}) {
    if (optional && (value === null || value === '')) return null;
    requireCondition(typeof value === 'string', code);
    const normalized = value.trim().normalize('NFC');
    requireCondition(normalized.length > 0 && normalized.length <= maximum, code);
    return normalized;
}

function freezeTree(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freezeTree);
        Object.freeze(value);
    }
    return value;
}

function assertNoSensitiveKeys(value, path = 'root') {
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
        return;
    }
    if (!isPlainObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
        requireCondition(!FORBIDDEN_KEY.test(key), `SENSITIVE_KEY_${path}_${key}`);
        assertNoSensitiveKeys(child, `${path}.${key}`);
    }
}

export function validateLocalAiPackageManifest(input) {
    const keys = ['schemaVersion', 'level', 'packageId', 'version', 'runtime', 'model', 'approxDownloadBytes',
        'maxResidentBytes', 'locales', 'files'];
    exactKeys(input, keys, 'PACKAGE_SHAPE');
    requireCondition(input.schemaVersion === 1 && LEVELS.has(input.level), 'PACKAGE_VERSION');
    requireCondition(typeof input.packageId === 'string' && PACKAGE_ID.test(input.packageId), 'PACKAGE_ID');
    requireCondition(/^\d+\.\d+\.\d+$/.test(input.version), 'PACKAGE_RELEASE');
    requireCondition(['transformers-js-onnx', 'webllm-webgpu'].includes(input.runtime), 'PACKAGE_RUNTIME');
    requireCondition(isPlainObject(input.model), 'PACKAGE_MODEL');
    exactKeys(input.model, ['provider', 'modelId', 'revision', 'license'], 'PACKAGE_MODEL_SHAPE');
    for (const field of ['provider', 'modelId', 'revision', 'license']) boundedText(input.model[field], 160, `PACKAGE_MODEL_${field}`);
    requireCondition(Number.isSafeInteger(input.approxDownloadBytes) && input.approxDownloadBytes > 0, 'PACKAGE_DOWNLOAD');
    requireCondition(Number.isSafeInteger(input.maxResidentBytes) && input.maxResidentBytes >= input.approxDownloadBytes, 'PACKAGE_MEMORY');
    requireCondition(Array.isArray(input.locales) && input.locales.length > 0 && input.locales.length <= 32, 'PACKAGE_LOCALES');
    requireCondition(input.locales.every(locale => typeof locale === 'string' && LOCALE.test(locale)), 'PACKAGE_LOCALE');
    requireCondition(new Set(input.locales).size === input.locales.length, 'PACKAGE_LOCALE_DUPLICATE');
    requireCondition(Array.isArray(input.files) && input.files.length > 0 && input.files.length <= 128, 'PACKAGE_FILES');
    let total = 0;
    const paths = new Set();
    for (const file of input.files) {
        exactKeys(file, ['path', 'bytes', 'sha256'], 'PACKAGE_FILE_SHAPE');
        requireCondition(typeof file.path === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,240}$/.test(file.path)
            && !file.path.includes('..') && !file.path.includes('://') && !paths.has(file.path), 'PACKAGE_FILE_PATH');
        paths.add(file.path);
        requireCondition(Number.isSafeInteger(file.bytes) && file.bytes > 0, 'PACKAGE_FILE_SIZE');
        requireCondition(typeof file.sha256 === 'string' && SHA256.test(file.sha256), 'PACKAGE_FILE_HASH');
        total += file.bytes;
        requireCondition(Number.isSafeInteger(total), 'PACKAGE_FILE_TOTAL');
    }
    requireCondition(total === input.approxDownloadBytes, 'PACKAGE_FILE_TOTAL');
    if (input.level === 'A1') requireCondition(input.runtime === 'transformers-js-onnx', 'PACKAGE_LEVEL_RUNTIME');
    if (input.level === 'A2') requireCondition(input.runtime === 'webllm-webgpu', 'PACKAGE_LEVEL_RUNTIME');
    return freezeTree(structuredClone(input));
}

export function assessLocalAiCapabilities(input) {
    const keys = ['wasm', 'webgpu', 'hardwareConcurrency', 'deviceMemoryGiB', 'storageAvailableBytes', 'mobile', 'ios'];
    exactKeys(input, keys, 'CAPABILITY_SHAPE');
    requireCondition(typeof input.wasm === 'boolean' && typeof input.webgpu === 'boolean'
        && typeof input.mobile === 'boolean' && typeof input.ios === 'boolean', 'CAPABILITY_BOOLEAN');
    requireCondition(Number.isSafeInteger(input.hardwareConcurrency) && input.hardwareConcurrency >= 1, 'CAPABILITY_CPU');
    requireCondition(input.deviceMemoryGiB === null || (Number.isFinite(input.deviceMemoryGiB) && input.deviceMemoryGiB > 0), 'CAPABILITY_MEMORY');
    requireCondition(Number.isSafeInteger(input.storageAvailableBytes) && input.storageAvailableBytes >= 0, 'CAPABILITY_STORAGE');
    const a1Reasons = [];
    if (!input.wasm) a1Reasons.push('wasm-unavailable');
    if (input.storageAvailableBytes < 160 * 1024 * 1024) a1Reasons.push('storage-below-ai1-budget');
    const a2Reasons = [];
    if (input.mobile || input.ios) a2Reasons.push('desktop-required');
    if (!input.webgpu) a2Reasons.push('webgpu-unavailable');
    if (input.deviceMemoryGiB === null) a2Reasons.push('memory-unknown');
    else if (input.deviceMemoryGiB < 4) a2Reasons.push('memory-below-ai2-budget');
    if (input.storageAvailableBytes < 1600 * 1024 * 1024) a2Reasons.push('storage-below-ai2-budget');
    const allowedTiers = [];
    if (!a2Reasons.length) {
        allowedTiers.push('light');
        if (input.deviceMemoryGiB >= 8 && input.hardwareConcurrency >= 8
            && input.storageAvailableBytes >= 4 * 1024 * 1024 * 1024) allowedTiers.push('medium');
        if (input.deviceMemoryGiB >= 16 && input.hardwareConcurrency >= 12
            && input.storageAvailableBytes >= 8 * 1024 * 1024 * 1024) allowedTiers.push('power');
    }
    return freezeTree({
        A1: { status: a1Reasons.length ? 'fallback-only' : 'candidate', reasons: a1Reasons },
        A2: { status: a2Reasons.length ? 'unavailable' : 'candidate', reasons: a2Reasons,
            allowedTiers, recommendedTier:allowedTiers.at(-1) || null }
    });
}

export function validateAdvancedTier(tier) {
    requireCondition(ADVANCED_TIERS.includes(tier), 'ADVANCED_TIER');
    return tier;
}

export function assessAdvancedRuntimeBenchmark(input) {
    exactKeys(input, ['tier', 'firstTokenMs', 'tokensPerSecond', 'peakMemoryMiB', 'cancelMs'], 'BENCHMARK_SHAPE');
    const tier = validateAdvancedTier(input.tier);
    for (const key of ['firstTokenMs', 'tokensPerSecond', 'peakMemoryMiB', 'cancelMs']) {
        requireCondition(Number.isFinite(input[key]) && input[key] >= 0, `BENCHMARK_${key}`);
    }
    const limits = {
        light:{ firstTokenMs:12000, tokensPerSecond:4, peakMemoryMiB:1400, cancelMs:1500 },
        medium:{ firstTokenMs:18000, tokensPerSecond:3, peakMemoryMiB:2400, cancelMs:1500 },
        power:{ firstTokenMs:25000, tokensPerSecond:2, peakMemoryMiB:3200, cancelMs:2000 }
    }[tier];
    const reasons = [];
    if (input.firstTokenMs > limits.firstTokenMs) reasons.push('first-token-too-slow');
    if (input.tokensPerSecond < limits.tokensPerSecond) reasons.push('generation-too-slow');
    if (input.peakMemoryMiB > limits.peakMemoryMiB) reasons.push('memory-above-budget');
    if (input.cancelMs > limits.cancelMs) reasons.push('cancel-too-slow');
    return freezeTree({ tier, passed:reasons.length === 0, reasons, limits });
}

export async function probeLocalAiCapabilities({ navigatorObject = globalThis.navigator } = {}) {
    const estimate = await navigatorObject?.storage?.estimate?.() || {};
    const quota = Number.isSafeInteger(estimate.quota) ? estimate.quota : 0;
    const usage = Number.isSafeInteger(estimate.usage) ? estimate.usage : 0;
    const userAgent = String(navigatorObject?.userAgent || '');
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
    const ios = /iPhone|iPad|iPod/i.test(userAgent)
        || (navigatorObject?.platform === 'MacIntel' && Number(navigatorObject?.maxTouchPoints) > 1);
    return assessLocalAiCapabilities({
        wasm: typeof WebAssembly === 'object',
        webgpu: Boolean(navigatorObject?.gpu),
        hardwareConcurrency: Math.max(1, Number(navigatorObject?.hardwareConcurrency) || 1),
        deviceMemoryGiB: Number.isFinite(navigatorObject?.deviceMemory) ? navigatorObject.deviceMemory : null,
        storageAvailableBytes: Math.max(0, quota - usage),
        mobile,
        ios
    });
}

export function createLocalAiEnvelope({ level, locale, page, question, turns = [], shortlist = [] }) {
    requireCondition(LEVELS.has(level), 'ENVELOPE_LEVEL');
    requireCondition(typeof locale === 'string' && LOCALE.test(locale), 'ENVELOPE_LOCALE');
    exactKeys(page, ['pageId', 'purpose'], 'ENVELOPE_PAGE');
    requireCondition(Array.isArray(turns) && turns.length <= 8, 'ENVELOPE_TURNS');
    requireCondition(Array.isArray(shortlist) && shortlist.length <= 12, 'ENVELOPE_SHORTLIST');
    const envelope = {
        schemaVersion: 1,
        level,
        locale,
        page: {
            pageId: boundedText(page.pageId, 80, 'ENVELOPE_PAGE_ID'),
            purpose: boundedText(page.purpose, 1200, 'ENVELOPE_PAGE_PURPOSE')
        },
        question: boundedText(question, 1200, 'ENVELOPE_QUESTION'),
        turns: turns.map(turn => {
            exactKeys(turn, ['question', 'intent'], 'ENVELOPE_TURN');
            return {
                question: boundedText(turn.question, 600, 'ENVELOPE_TURN_QUESTION'),
                intent: validateTypedIntent(turn.intent)
            };
        }),
        shortlist: shortlist.map(item => {
            exactKeys(item, ['recordRef', 'kind', 'title', 'subtitle'], 'ENVELOPE_RESULT');
            return {
                recordRef: boundedText(item.recordRef, 128, 'ENVELOPE_RESULT_REF'),
                kind: boundedText(item.kind, 64, 'ENVELOPE_RESULT_KIND'),
                title: boundedText(item.title, 240, 'ENVELOPE_RESULT_TITLE'),
                subtitle: boundedText(item.subtitle, 320, 'ENVELOPE_RESULT_SUBTITLE', { optional: true })
            };
        })
    };
    assertNoSensitiveKeys(envelope);
    return freezeTree(envelope);
}

export function validateTypedIntent(input) {
    exactKeys(input, ['schemaVersion', 'type', 'query', 'pageId', 'resultOrdinal', 'confidence', 'requiresConfirmation'], 'INTENT_SHAPE');
    requireCondition(input.schemaVersion === 1 && INTENTS.has(input.type), 'INTENT_TYPE');
    const result = {
        schemaVersion: 1,
        type: input.type,
        query: boundedText(input.query, 600, 'INTENT_QUERY', { optional: true }),
        pageId: boundedText(input.pageId, 80, 'INTENT_PAGE', { optional: true }),
        resultOrdinal: input.resultOrdinal,
        confidence: input.confidence,
        requiresConfirmation: input.requiresConfirmation
    };
    requireCondition(result.resultOrdinal === null || (Number.isSafeInteger(result.resultOrdinal)
        && result.resultOrdinal >= 1 && result.resultOrdinal <= 12), 'INTENT_ORDINAL');
    requireCondition(Number.isFinite(result.confidence) && result.confidence >= 0 && result.confidence <= 1, 'INTENT_CONFIDENCE');
    requireCondition(typeof result.requiresConfirmation === 'boolean', 'INTENT_CONFIRMATION');
    if (result.type === 'select_result') requireCondition(result.resultOrdinal !== null, 'INTENT_SELECTION');
    assertNoSensitiveKeys(result);
    return freezeTree(result);
}

export function createEphemeralAssistantSession({ maxTurns = 8 } = {}) {
    requireCondition(Number.isSafeInteger(maxTurns) && maxTurns >= 1 && maxTurns <= 8, 'SESSION_LIMIT');
    let turns = [];
    let closed = false;
    return Object.freeze({
        append(question, intent) {
            requireCondition(!closed, 'SESSION_CLOSED');
            const turn = freezeTree({
                question: boundedText(question, 600, 'SESSION_QUESTION'),
                intent: validateTypedIntent(intent)
            });
            turns = [...turns.slice(-(maxTurns - 1)), turn];
            return turn;
        },
        snapshot() {
            requireCondition(!closed, 'SESSION_CLOSED');
            return freezeTree(structuredClone(turns));
        },
        clear() { turns = []; },
        close() { turns = []; closed = true; }
    });
}
