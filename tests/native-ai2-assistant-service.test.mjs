import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNativeAi2AssistantService } from '../Frontend/public/assets/js/modules/assistant/native-ai2-assistant-service.js';

const catalog = JSON.parse(await readFile(new URL(
    '../Frontend/public/assets/js/modules/assistant/documentation-catalog.json', import.meta.url
), 'utf8'));

test('il servizio nativo usa la stessa guida D0 e la stessa forma di risposta di Agente Codex', async () => {
    const previousLocation = globalThis.location;
    Object.defineProperty(globalThis, 'location', { configurable:true, value:{ pathname:'/home_page.html' } });
    const calls = [];
    const client = {
        health:async () => ({ status:'ok' }),
        complete:async (messages, options) => {
            calls.push({ messages, options });
            return { choices:[{ message:{ content:'Apri Nuova Scadenza.' } }] };
        },
        interrupt:async () => {},
        dispose:async () => {}
    };
    const fetchFn = async () => Response.json(catalog);
    const service = createNativeAi2AssistantService({ language:'it', client, fetchFn });
    try {
        assert.equal(await service.prepare(), true);
        assert.deepEqual(await service.ask('Come creo una scadenza?'), { message:'Apri Nuova Scadenza.', items:[] });
        assert.match(calls[0].messages[0].content, /FATTI VERIFICATI E VINCOLANTI/);
        assert.match(calls[0].messages[0].content, /Dal footer puoi aprire Nuovo Privato, Nuova Scadenza/);
        assert.equal(calls[0].options.maxTokens, 384);
    } finally {
        await service.close();
        Object.defineProperty(globalThis, 'location', { configurable:true, value:previousLocation });
    }
});
