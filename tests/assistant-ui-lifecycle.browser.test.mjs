import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createDynamicHarness} from '../scripts/lib/dynamic-theme-harness.mjs';
const {chromium} = createRequire(import.meta.url)('playwright');
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/assistant/assistant-ui.js', import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '')
    .replace("import('./speech-synthesis-controller.js')", "Promise.reject(new Error('SPEECH_DISABLED_IN_TEST'))");
const controllerSource = (await readFile(new URL('../Frontend/public/assets/js/modules/assistant/assistant-controller.js', import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

test('Search opens without a square pulse and uses an empty divider without collapsing real messages', {timeout: 120000}, async () => {
    const harness = await createDynamicHarness();
    const failures = [];
    try {
        for (const graphics of ['classica', 'tre-livelli']) {
            const page = await harness.open('profilo_privato.html', {graphics, theme: 'light', palette: 'blue'});
            try {
                await page.emulateMedia({reducedMotion: 'no-preference'});
                await page.evaluate(({ui, controller}) => {
                    // Restore motion only for this regression: sample the actual CSS animation halfway through.
                    for (const style of document.querySelectorAll('style')) {
                        if (style.textContent.startsWith('*,*::before,*::after{animation')) style.remove();
                    }
                    Object.defineProperty(window, 'SpeechRecognition', {value: undefined, configurable: true});
                    Object.defineProperty(window, 'webkitSpeechRecognition', {value: undefined, configurable: true});
                    const createUI = new Function('t', ui + '; return createAssistantUI;')(value => value);
                    const user = {uid: 'synthetic-owner'};
                    const dependencies = {
                        vaultFrameClient: {isChild: () => false}, auth: {currentUser: user},
                        onAuthStateChanged: () => () => {},
                        ensureVaultKeyMaterial: () => new Promise(resolve => {window.releaseSearch = resolve;}),
                        loadVaultSearchRecords: async () => [],
                        fetch: async () => ({ok: false}),
                        getCurrentLanguage: () => 'it', t: value => value,
                        getOfflineReadiness: () => ({complete: true}),
                        VaultConversationEngine: class {
                            ask() {return {message: 'Risposta sintetica', items: []};}
                            clear() {}
                        },
                        createAssistantUI: createUI
                    };
                    window.initSearchFixture = new Function(...Object.keys(dependencies), controller + '; return initVaultAssistant;')(...Object.values(dependencies));
                    window.searchUser = user;
                    document.getElementById('search-status').classList.remove('hidden');
                }, {ui: source, controller: controllerSource});
                for (const width of [320, 1280]) {
                    await page.setViewportSize({width, height: 844});
                    for (const theme of ['light', 'dark']) for (const palette of ['blue', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose']) {
                        const context = `${graphics}/${width}/${theme}/${palette}`;
                        await page.evaluate(async ({theme, palette}) => {
                            document.documentElement.classList.toggle('dark', theme === 'dark');
                            document.documentElement.dataset.colorTheme = palette;
                            window.searchController = await window.initSearchFixture(window.searchUser);
                            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                        }, {theme, palette});
                        await page.waitForFunction(() => document.querySelector('link[data-vault-assistant]')?.sheet);
                        await page.locator('#search-status').click();
                        await page.waitForSelector('#search-status[aria-busy="true"]');
                        const pulse = await page.locator('#search-status .material-symbols-outlined').evaluate(element => {
                            const animations = element.getAnimations();
                            for (const animation of animations) {animation.pause(); animation.currentTime = 400;}
                            const style = getComputedStyle(element);
                            return {animations: animations.length, shadow: style.boxShadow};
                        });
                        if (!pulse.animations || pulse.shadow !== 'none') failures.push(`${context}: preparing square ${JSON.stringify(pulse)}`);
                        await page.evaluate(() => window.releaseSearch('synthetic-key'));
                        await page.waitForSelector('.vault-assistant-panel');
                        const empty = await page.locator('.vault-assistant-conversation').evaluate(element => {
                            const style = getComputedStyle(element);
                            const probe = document.createElement('div');
                            probe.style.borderTop = '1px solid var(--rev-border)';
                            element.append(probe);
                            const expectedBorder = getComputedStyle(probe).borderTopColor;
                            probe.remove();
                            return {height: element.getBoundingClientRect().height, radius: style.borderRadius, padding: style.padding,
                                background: style.backgroundColor, border: style.borderTopWidth, borderStyle: style.borderTopStyle,
                                color: style.borderTopColor, expectedBorder};
                        });
                        if (empty.height < 1 || empty.height > 2 || empty.border !== '1px' || empty.borderStyle !== 'solid' || empty.color !== empty.expectedBorder || empty.radius !== '0px' || empty.padding !== '0px' || empty.background !== 'rgba(0, 0, 0, 0)') failures.push(`${context}: empty divider ${JSON.stringify(empty)}`);
                        await page.locator('.vault-assistant-input').fill('Domanda sintetica');
                        await page.locator('.vault-assistant-send').click();
                        await page.waitForFunction(() => document.querySelector('.vault-assistant-conversation')?.textContent.includes('Risposta sintetica'));
                        const populated = await page.locator('.vault-assistant-conversation').evaluate(element => ({height: element.getBoundingClientRect().height, radius: getComputedStyle(element).borderRadius, text: element.textContent}));
                        assert.ok(populated.height > 30 && populated.radius !== '0px' && populated.text.includes('Domanda sintetica'), `${context}: real messages remain visible`);
                        await page.evaluate(() => window.searchController.destroy());
                    }
                }
            } finally {await page.context().close();}
        }
        assert.equal(failures.length, 0, failures.slice(0, 4).join('\n'));
    } finally {await harness.close();}
});

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
