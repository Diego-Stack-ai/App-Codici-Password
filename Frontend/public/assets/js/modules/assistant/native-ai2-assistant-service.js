import { createDocumentationGuide } from './documentation-guide.js';
import { completeWithinBudget, createA2ChatRequest, normalizeA2Answer } from './local-ai-assistant-service.js';
import { createNativeAi2Client } from './native-ai2-client.js';

const MAX_HISTORY_MESSAGES = 12;
const locale = language => ({
    it:'it-IT', en:'en-US', es:'es-ES', fr:'fr-FR', de:'de-DE', zh:'zh-CN', hi:'hi-IN', pt:'pt-PT'
}[language] || 'it-IT');

async function loadGuide(language, question, fetchFn) {
    const response = await fetchFn('/assets/js/modules/assistant/documentation-catalog.json', { credentials:'omit' });
    if (!response.ok) {
        const error = new Error('LOCAL_AI_GUIDE_UNAVAILABLE');
        error.code = 'LOCAL_AI_GUIDE_UNAVAILABLE';
        error.stage = 'guide';
        throw error;
    }
    const guide = createDocumentationGuide(await response.json());
    return guide.getPageKnowledge(location.pathname, { locale:locale(language), query:question, limit:4 });
}

export function createNativeAi2AssistantService({
    language = 'it',
    client = createNativeAi2Client(),
    fetchFn = globalThis.fetch
} = {}) {
    const history = [];
    let closed = false;
    return Object.freeze({
        level:'A2',
        runtime:'native-llama-cpp',
        async prepare() {
            if (closed) throw new Error('LOCAL_AI_SESSION_CLOSED');
            await client.health();
            return true;
        },
        async ask(question) {
            if (closed) throw new Error('LOCAL_AI_SESSION_CLOSED');
            const guide = await loadGuide(language, question, fetchFn);
            const request = createA2ChatRequest({ question, guide, language, history });
            const completion = await completeWithinBudget(client, request.messages, request.options);
            const answer = normalizeA2Answer(completion);
            history.push(
                { role:'user', content:String(question || '').trim().slice(0, 1200) },
                { role:'assistant', content:answer }
            );
            if (history.length > MAX_HISTORY_MESSAGES) history.splice(0, history.length - MAX_HISTORY_MESSAGES);
            return { message:answer, items:[] };
        },
        cancel:() => client.interrupt(),
        async close() {
            if (closed) return;
            closed = true;
            history.length = 0;
            await client.dispose();
        }
    });
}
