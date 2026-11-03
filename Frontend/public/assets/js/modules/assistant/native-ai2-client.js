const DEFAULT_ORIGIN = 'http://127.0.0.1:32145';
const PAIRING_KEY = 'codici-password:native-ai2-pairing:v1';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const PAIR_CODE_PATTERN = /^[A-Z0-9-]{6,24}$/i;
const ALLOWED_APP_ORIGINS = new Set([
    'https://appcodici-password.web.app',
    'https://appcodici-password.firebaseapp.com',
    'http://127.0.0.1:5000',
    'http://localhost:5000'
]);

function nativeError(code, stage, cause = null) {
    const error = new Error(code, cause ? { cause } : undefined);
    error.code = code;
    error.stage = stage;
    return error;
}

function requireTrustedAppOrigin(origin) {
    if (!ALLOWED_APP_ORIGINS.has(origin)) throw nativeError('LOCAL_AI_NATIVE_APP_ORIGIN_REJECTED', 'native-origin');
}

function normalizeEndpoint(origin = DEFAULT_ORIGIN) {
    const endpoint = new URL(origin);
    if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.port !== '32145'
        || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
        throw nativeError('LOCAL_AI_NATIVE_ENDPOINT_REJECTED', 'native-origin');
    }
    return endpoint.origin;
}

function validatePairing(value) {
    if (!value || typeof value !== 'object' || value.schemaVersion !== 1
        || !TOKEN_PATTERN.test(String(value.token || ''))
        || !/^[A-Za-z0-9._-]{3,80}$/.test(String(value.installId || ''))) {
        throw nativeError('LOCAL_AI_NATIVE_PAIRING_INVALID', 'native-pairing');
    }
    return Object.freeze({ schemaVersion:1, token:String(value.token), installId:String(value.installId) });
}

export async function queryLoopbackPermission({ permissions = globalThis.navigator?.permissions } = {}) {
    if (!permissions?.query) return 'prompt';
    try {
        const status = await permissions.query({ name:'loopback-network' });
        return ['granted', 'denied', 'prompt'].includes(status?.state) ? status.state : 'prompt';
    } catch {
        return 'prompt';
    }
}

export function readNativeAi2Pairing({ storage = globalThis.localStorage } = {}) {
    try {
        const raw = storage?.getItem?.(PAIRING_KEY);
        return raw ? validatePairing(JSON.parse(raw)) : null;
    } catch {
        return null;
    }
}

export function clearNativeAi2Pairing({ storage = globalThis.localStorage } = {}) {
    storage?.removeItem?.(PAIRING_KEY);
}

export function createNativeAi2Client({
    fetchFn = globalThis.fetch,
    storage = globalThis.localStorage,
    appOrigin = globalThis.location?.origin,
    endpoint = DEFAULT_ORIGIN
} = {}) {
    if (typeof fetchFn !== 'function') throw nativeError('LOCAL_AI_NATIVE_FETCH_UNAVAILABLE', 'native-preflight');
    requireTrustedAppOrigin(String(appOrigin || ''));
    const baseUrl = normalizeEndpoint(endpoint);
    let activeController = null;

    const request = async (path, { method = 'GET', body = null, token = null, signal = null } = {}) => {
        const headers = { Accept:'application/json' };
        if (body !== null) headers['Content-Type'] = 'application/json';
        if (token) headers.Authorization = `Bearer ${token}`;
        try {
            return await fetchFn(`${baseUrl}${path}`, {
                method,
                mode:'cors',
                credentials:'omit',
                cache:'no-store',
                redirect:'error',
                referrerPolicy:'no-referrer',
                targetAddressSpace:'loopback',
                headers,
                body:body === null ? undefined : JSON.stringify(body),
                signal
            });
        } catch (error) {
            if (error?.name === 'AbortError') throw nativeError('LOCAL_AI_RUNTIME_INTERRUPTED', 'generation', error);
            throw nativeError('LOCAL_AI_NATIVE_UNREACHABLE', 'native-connect', error);
        }
    };

    return Object.freeze({
        endpoint:baseUrl,
        isPaired:() => Boolean(readNativeAi2Pairing({ storage })),
        async status() {
            const response = await request('/v1/status');
            if (!response.ok) throw nativeError('LOCAL_AI_NATIVE_STATUS_UNAVAILABLE', 'native-status');
            const value = await response.json();
            if (value?.schemaVersion !== 1 || value?.status !== 'available'
                || typeof value?.installed !== 'boolean' || typeof value?.ready !== 'boolean') {
                throw nativeError('LOCAL_AI_NATIVE_STATUS_INVALID', 'native-status');
            }
            return Object.freeze({
                status:'available',
                version:String(value.version || ''),
                model:String(value.model || ''),
                installed:value.installed,
                ready:value.ready,
                ramGiB:Number(value.ramGiB) || 0,
                freeStorageBytes:Number(value.freeStorageBytes) || 0
            });
        },
        async health() {
            const pairing = readNativeAi2Pairing({ storage });
            if (!pairing) throw nativeError('LOCAL_AI_NATIVE_PAIRING_REQUIRED', 'native-pairing');
            const response = await request('/v1/health', { token:pairing.token });
            if (response.status === 401 || response.status === 403) {
                clearNativeAi2Pairing({ storage });
                throw nativeError('LOCAL_AI_NATIVE_PAIRING_EXPIRED', 'native-pairing');
            }
            if (!response.ok) throw nativeError('LOCAL_AI_NATIVE_NOT_READY', 'native-health');
            const value = await response.json();
            if (value?.status !== 'ok' || value?.schemaVersion !== 1) {
                throw nativeError('LOCAL_AI_NATIVE_HEALTH_INVALID', 'native-health');
            }
            return Object.freeze({ status:'ok', version:String(value.version || ''), model:String(value.model || '') });
        },
        async pair(code) {
            if (!PAIR_CODE_PATTERN.test(String(code || '').trim())) {
                throw nativeError('LOCAL_AI_NATIVE_PAIR_CODE_INVALID', 'native-pairing');
            }
            const response = await request('/v1/pair', {
                method:'POST',
                body:{ schemaVersion:1, code:String(code).trim(), appOrigin:String(appOrigin) }
            });
            if (!response.ok) throw nativeError('LOCAL_AI_NATIVE_PAIRING_REJECTED', 'native-pairing');
            const pairing = validatePairing(await response.json());
            storage?.setItem?.(PAIRING_KEY, JSON.stringify(pairing));
            return pairing;
        },
        async complete(messages, options = {}) {
            const pairing = readNativeAi2Pairing({ storage });
            if (!pairing) throw nativeError('LOCAL_AI_NATIVE_PAIRING_REQUIRED', 'native-pairing');
            activeController?.abort();
            activeController = new AbortController();
            const body = {
                model:'codici-password-ai2',
                messages,
                stream:false,
                temperature:Number.isFinite(options.temperature) ? options.temperature : 0.1,
                max_tokens:Number.isSafeInteger(options.maxTokens) ? options.maxTokens : 384
            };
            const response = await request('/v1/chat/completions', {
                method:'POST', body, token:pairing.token, signal:activeController.signal
            });
            activeController = null;
            if (response.status === 401 || response.status === 403) {
                clearNativeAi2Pairing({ storage });
                throw nativeError('LOCAL_AI_NATIVE_PAIRING_EXPIRED', 'native-pairing');
            }
            if (!response.ok) throw nativeError('LOCAL_AI_NATIVE_GENERATION_FAILED', 'generation');
            const value = await response.json();
            if (!value?.choices?.[0]?.message?.content) {
                throw nativeError('LOCAL_AI_RESPONSE_EMPTY', 'generation');
            }
            return value;
        },
        async interrupt() {
            activeController?.abort();
            activeController = null;
        },
        async dispose() {
            activeController?.abort();
            activeController = null;
        }
    });
}

export { DEFAULT_ORIGIN as NATIVE_AI2_ORIGIN, PAIRING_KEY as NATIVE_AI2_PAIRING_KEY };
