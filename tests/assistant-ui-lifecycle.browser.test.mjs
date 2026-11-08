import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/assistant/assistant-ui.js', import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '')
    .replace("import('./speech-synthesis-controller.js')", "Promise.reject(new Error('SPEECH_DISABLED_IN_TEST'))");

test('real Search DOM rejects retained reveal/copy and late plaintext after dialog teardown', async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
    try {
        const page = await browser.newPage();
        await page.setContent('<!doctype html><html><body></body></html>');
        await page.evaluate(text => {
            Object.defineProperty(window, 'SpeechRecognition', {value: undefined, configurable: true});
            Object.defineProperty(window, 'webkitSpeechRecognition', {value: undefined, configurable: true});
            Object.defineProperty(navigator, 'clipboard', {value: {writeText: async value => {window.copies.push(value);}}, configurable: true});
            window.createTestUI = new Function('t', text + '; return createAssistantUI;') (value => value);
            window.setup = ({pending = false, usernamePending = false} = {}) => {
                window.copies = []; window.active = true; window.resolveLate = null;
                window.ui = window.createTestUI({
                    isSessionActive: () => window.active,
                    onClose() {},
                    onAsk: () => ({message: 'Synthetic result', items: [{id: 'item', title: 'Synthetic account',
                        href: '#account', credentials: usernamePending ? {username: 'cipher'} : {password: 'cipher'}}]}),
                    resolveCredential: value => pending || usernamePending ? new Promise(resolve => {window.resolveLate = resolve;}) : Promise.resolve('synthetic-secret')
                });
                document.querySelector('input').value = 'synthetic query';
                document.querySelector('form').dispatchEvent(new Event('submit', {cancelable: true}));
            };
            window.setup();
        }, source);
        await page.waitForSelector('button[title="Mostra password"]');
        await page.evaluate(() => {
            window.oldReveal = document.querySelector('button[title="Mostra password"]');
            window.oldCopy = document.querySelector('button[title="Copia password"]');
            window.oldValue = document.querySelector('.vault-assistant-credential-value');
            window.oldReveal.click();
        });
        await page.waitForFunction(() => window.oldValue.textContent === 'synthetic-secret');
        await page.evaluate(() => window.oldCopy.click());
        await page.waitForFunction(() => window.copies.length === 1);
        await page.evaluate(() => {
            window.active = false; window.ui.destroy();
            window.oldCopy.click(); window.oldReveal.click();
        });
        await page.waitForTimeout(30);
        assert.deepEqual(await page.evaluate(() => ({copies: window.copies, value: window.oldValue.textContent,
            dialogs: document.querySelectorAll('.vault-assistant-backdrop').length})),
        {copies: ['synthetic-secret'], value: '', dialogs: 0});

        await page.evaluate(() => window.setup({pending: true}));
        await page.waitForSelector('button[title="Mostra password"]');
        await page.evaluate(() => {
            window.pendingReveal = document.querySelector('button[title="Mostra password"]');
            window.pendingCopy = document.querySelector('button[title="Copia password"]');
            window.pendingValue = document.querySelector('.vault-assistant-credential-value');
            window.pendingReveal.click();
        });
        await page.waitForFunction(() => typeof window.resolveLate === 'function');
        await page.evaluate(() => {
            window.active = false; window.ui.destroy();
            window.resolveLate('late-synthetic-secret');
            window.pendingCopy.click();
        });
        await page.waitForTimeout(30);
        assert.deepEqual(await page.evaluate(() => ({copies: window.copies, value: window.pendingValue.textContent,
            body: document.body.textContent})), {copies: [], value: '', body: ''});

        await page.evaluate(() => window.setup({usernamePending: true}));
        await page.waitForFunction(() => typeof window.resolveLate === 'function');
        await page.evaluate(() => {
            window.active = false; window.ui.destroy(); window.resolveLate('late-username');
        });
        await page.waitForTimeout(30);
        assert.equal(await page.evaluate(() => document.body.textContent), '');
    } finally { await browser.close(); }
});

test('pending voice permission, availability and installation cannot resume after dialog teardown', async () => {
    const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
    try {
        for (const stage of ['permission', 'availability', 'installation']) {
            const page = await browser.newPage();
            await page.setContent('<!doctype html><html><body></body></html>');
            await page.evaluate(({text, stage}) => {
                window.starts = 0; window.active = true; window.pendingGate = null;
                const pending = () => new Promise(resolve => {window.pendingGate = resolve;});
                class Recognition extends EventTarget {
                    start() {window.starts++;}
                    stop() {}
                    abort() {this.dispatchEvent(new Event('end'));}
                    static available() {return stage === 'availability' ? pending() : Promise.resolve('downloadable');}
                    static install() {return pending();}
                }
                Recognition.prototype.processLocally = true;
                Object.defineProperty(window, 'SpeechRecognition', {value: Recognition, configurable: true});
                const createUI = new Function('t', 'createSpeechTranscriptState', 'probeMicrophoneAccess',
                    text + '; return createAssistantUI;') (value => value, () => ({}),
                    () => stage === 'permission' ? pending() : Promise.resolve({ok: true}));
                window.ui = createUI({onAsk() {}, onClose() {}, resolveCredential: value => value,
                    isSessionActive: () => window.active});
                window.mic = document.querySelector('.vault-assistant-microphone');
                window.statusNode = document.querySelector('.vault-assistant-status');
            }, {text: source, stage});
            await page.waitForFunction(() => !window.mic.disabled);
            await page.evaluate(() => window.mic.click());
            if (stage === 'installation') {
                await page.waitForFunction(() => !window.mic.disabled && window.statusNode.textContent.includes('scaricarlo'));
                await page.evaluate(() => window.mic.click());
            }
            await page.waitForFunction(() => typeof window.pendingGate === 'function');
            await page.evaluate(stage => {
                window.active = false; window.ui.destroy();
                window.pendingGate(stage === 'permission' ? {ok: true} : stage === 'availability' ? 'available' : true);
            }, stage);
            await page.waitForTimeout(30);
            assert.deepEqual(await page.evaluate(() => ({starts: window.starts, status: window.statusNode.textContent, body: document.body.textContent})),
                {starts: 0, status: '', body: ''}, stage);
            await page.close();
        }
    } finally {await browser.close();}
});
