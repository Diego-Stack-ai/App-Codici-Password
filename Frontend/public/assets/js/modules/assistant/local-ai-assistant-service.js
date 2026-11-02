import { createDocumentationGuide } from './documentation-guide.js';
import { probeLocalAiCapabilities } from './advanced-local-ai-contract.js';
import { createLocalAiPackageManager } from './local-ai-package-manager.js';
import { createLocalAiRuntimeLoader } from './local-ai-runtime-loader.js';
import { readSelectedAdvancedTier, readSelectedLocalAi } from './local-ai-selection.js';
import { reportLocalAiRuntimeFailure, writeLocalAiRuntimeState } from './local-ai-runtime-state.js';

const RUNTIME_IDLE_MS = 30 * 60 * 1000;
const GENERATION_TIMEOUT_MS = 90 * 1000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_ANSWER_LENGTH = 2400;
const sharedRuntimes = new Map();

const locale = language => ({
    it:'it-IT', en:'en-US', es:'es-ES', fr:'fr-FR', de:'de-DE', zh:'zh-CN', hi:'hi-IN', pt:'pt-PT'
}[language] || 'it-IT');

function boundedText(value, maximum) {
    return String(value || '').trim().slice(0, maximum);
}

function safeGuideContext(guide) {
    if (!guide) return 'Questa pagina non ha ancora una guida verificata.';
    const current = guide.page || guide;
    const related = Array.isArray(guide.related) ? guide.related.slice(0, 4) : [];
    const steps = Array.isArray(current.steps)
        ? current.steps.slice(0, 12).map(step => `- ${boundedText(step?.body, 500)}`).filter(step => step !== '- ')
        : [];
    return [
        `Pagina: ${boundedText(current.title, 160)}`,
        `Scopo: ${boundedText(current.purpose, 1200)}`,
        ...steps,
        ...(related.length ? [
            '',
            'Pagine correlate verificate:',
            ...related.map(page => `- ${boundedText(page.title, 160)}: ${boundedText(page.purpose, 500)}`)
        ] : [])
    ].join('\n');
}

export function createA2ChatRequest({ question, guide, language = 'it', history = [] }) {
    const safeHistory = history.slice(-MAX_HISTORY_MESSAGES).map(message => ({
        role:message?.role === 'assistant' ? 'assistant' : 'user',
        content:boundedText(message?.content, 1200)
    })).filter(message => message.content);
    const system = [
        `Sei Codex AI.2, l'assistente locale dell'app Codici & Password. Rispondi in ${locale(language)}.`,
        'Sei separato dalla funzione Ricerca: non affermare di avere cercato, aperto, modificato o letto record della vault.',
        'Puoi spiegare l’app e la pagina corrente usando soltanto la guida verificata seguente.',
        'Non inventare pulsanti, dati, risultati o operazioni. Se mancano informazioni, dichiaralo chiaramente.',
        'Non chiedere né ripetere password, codici segreti o altri dati sensibili.',
        'Le operazioni che modificano dati spettano all’utente. Fornisci istruzioni concise e concrete.',
        '',
        safeGuideContext(guide)
    ].join('\n');
    return Object.freeze({
        messages:Object.freeze([
            Object.freeze({ role:'system', content:system }),
            ...safeHistory.map(message => Object.freeze(message)),
            Object.freeze({ role:'user', content:boundedText(question, 1200) })
        ]),
        options:Object.freeze({ temperature:0.2, maxTokens:384 })
    });
}

export function normalizeA2Answer(completion) {
    const answer = boundedText(completion?.choices?.[0]?.message?.content, MAX_ANSWER_LENGTH);
    if (!answer) {
        const error = new Error('LOCAL_AI_RESPONSE_EMPTY');
        error.code = 'LOCAL_AI_RESPONSE_EMPTY';
        error.stage = 'generation';
        throw error;
    }
    return answer;
}

export function isFatalA2RuntimeError(error) {
    const code = String(error?.code || error?.message || '');
    return /(?:GPU_DEVICE_LOST|WEBGPU_UNAVAILABLE|GPU_LIMIT_UNSUPPORTED|WASM_|WORKER_|RUNTIME_INITIALIZATION|MODEL_ARTIFACT_INVALID)/.test(code);
}

export function requiresA2RuntimeRecycle(error) {
    const code = String(error?.code || error?.message || '');
    return /(?:GENERATION_TIMEOUT|REQUEST_TIMEOUT|OPERATION_ABORTED|RUNTIME_INTERRUPTED)/.test(code);
}

function timeoutError() {
    const error = new Error('LOCAL_AI_GENERATION_TIMEOUT');
    error.code = 'LOCAL_AI_GENERATION_TIMEOUT';
    error.stage = 'generation';
    return error;
}

export async function completeWithinBudget(runtime, messages, options, timeoutMs = GENERATION_TIMEOUT_MS) {
    let timer;
    try {
        return await Promise.race([
            runtime.complete(messages, options),
            new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError()), timeoutMs); })
        ]);
    } catch (error) {
        if (error?.code === 'LOCAL_AI_GENERATION_TIMEOUT') await runtime.interrupt?.().catch?.(() => {});
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

function serialize(entry, task) {
    const run = entry.tail.then(task, task);
    entry.tail = run.catch(() => {});
    return run;
}

async function acquireSharedRuntime(key, createRuntime, onDisposed = () => {}) {
    let entry = sharedRuntimes.get(key);
    if (!entry) {
        entry = { refs:0, timer:null, tail:Promise.resolve(), promise:Promise.resolve().then(createRuntime) };
        sharedRuntimes.set(key, entry);
        entry.promise.catch(() => {
            if (sharedRuntimes.get(key) === entry) sharedRuntimes.delete(key);
        });
    }
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    entry.refs += 1;
    await entry.promise;
    let released = false;
    return Object.freeze({
        runtime:await entry.promise,
        run:task => serialize(entry, task),
        release() {
            if (released) return;
            released = true;
            entry.refs = Math.max(0, entry.refs - 1);
            if (entry.refs) return;
            entry.timer = setTimeout(async () => {
                if (entry.refs || sharedRuntimes.get(key) !== entry) return;
                sharedRuntimes.delete(key);
                try { await (await entry.promise).dispose?.(); }
                finally { onDisposed(); }
            }, RUNTIME_IDLE_MS);
        }
    });
}

async function evictSharedRuntime(key) {
    const entry = sharedRuntimes.get(key);
    if (!entry) return;
    sharedRuntimes.delete(key);
    if (entry.timer) clearTimeout(entry.timer);
    try { await (await entry.promise).dispose?.(); } catch { /* Il runtime era gia' in errore. */ }
}

async function loadCurrentGuide(language, question) {
    const response = await fetch('/assets/js/modules/assistant/documentation-catalog.json', { credentials:'omit' });
    if (!response.ok) throw new Error('LOCAL_AI_GUIDE_UNAVAILABLE');
    const guide = createDocumentationGuide(await response.json());
    return guide.getPageKnowledge(location.pathname, {
        locale:locale(language),
        query:question,
        limit:4
    });
}

export function createLocalAiAssistantService({ language = 'it' } = {}) {
    const level = readSelectedLocalAi();
    const tier = level === 'A2' ? readSelectedAdvancedTier() : null;
    const manager = createLocalAiPackageManager();
    const loader = createLocalAiRuntimeLoader({ packageManager:manager });
    const history = [];
    let runtimeLeasePromise = null;
    let activeRuntime = null;
    let closed = false;
    const runtimeTier = tier || 'desktop32';
    const runtimeKey = `${level}:${tier || 'default'}`;
    const getLease = async () => {
        if (closed) throw new Error('LOCAL_AI_SESSION_CLOSED');
        if (!runtimeLeasePromise) {
            runtimeLeasePromise = acquireSharedRuntime(runtimeKey, async () => {
                writeLocalAiRuntimeState(level, runtimeTier, { status:'starting', stage:'preflight' });
                try {
                    const assessment = await probeLocalAiCapabilities();
                    const loaded = await loader.load(level, {
                        assessment,
                        tier:runtimeTier,
                        verifyRuntime:false,
                        onStage:stage => writeLocalAiRuntimeState(level, runtimeTier, { status:'starting', stage })
                    });
                    activeRuntime = loaded;
                    writeLocalAiRuntimeState(level, runtimeTier, { status:'ready', stage:'ready' });
                    return loaded;
                } catch (error) {
                    reportLocalAiRuntimeFailure(level, runtimeTier, error);
                    throw error;
                }
            }, () => writeLocalAiRuntimeState(level, runtimeTier, { status:'verified', stage:'idle' }));
        }
        const lease = await runtimeLeasePromise;
        activeRuntime = lease.runtime;
        return lease;
    };
    return Object.freeze({
        level,
        tier,
        async prepare() {
            await getLease();
            return true;
        },
        async ask(question) {
            const guide = await loadCurrentGuide(language, question);
            const request = createA2ChatRequest({ question, guide, language, history });
            const lease = await getLease();
            try {
                const completion = await lease.run(() => completeWithinBudget(lease.runtime, request.messages, request.options));
                const answer = normalizeA2Answer(completion);
                history.push(
                    { role:'user', content:boundedText(question, 1200) },
                    { role:'assistant', content:answer }
                );
                if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);
                return { message:answer, items:[] };
            } catch (error) {
                const fatal = isFatalA2RuntimeError(error);
                const recycle = requiresA2RuntimeRecycle(error);
                if (fatal) {
                    reportLocalAiRuntimeFailure(level, runtimeTier, error, 'generation');
                }
                if (fatal || recycle) {
                    activeRuntime = null;
                    runtimeLeasePromise = null;
                    lease.release();
                    await evictSharedRuntime(runtimeKey);
                }
                throw error;
            }
        },
        async cancel() { await activeRuntime?.interrupt?.(); },
        close() {
            closed = true;
            history.length = 0;
            void runtimeLeasePromise?.then(lease => lease.release(), () => {});
        }
    });
}
