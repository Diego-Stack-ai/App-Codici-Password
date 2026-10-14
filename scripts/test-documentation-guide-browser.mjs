// Real headless Chromium; synthetic pages and same-origin static assets only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(import.meta.dirname, '../Frontend/public');
const workerSource = await readFile(path.join(root, 'sw.js'), 'utf8');
const shellCache = workerSource.match(/const CACHE_NAME = '([^']+)'/)[1];
const cases = ['impostazioni', 'login-v115', 'contatto_condiviso'];
const executable = process.env.GUIDE_TEST_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname === '/__guide_test.js') {
            response.setHeader('Content-Type', 'text/javascript');
            response.end(`import { mountDocumentationHelp, getDocumentationPageContext } from '/assets/js/guide.js';
                window.__guideOwner = mountDocumentationHelp(getDocumentationPageContext(location.pathname));
                window.__guideMounted = true; window.__syntheticVaultLocked = true;`);
            return;
        }
        const file = path.resolve(root, '.' + url.pathname);
        assert.ok(file.startsWith(root + path.sep));
        let content = await readFile(file);
        if (cases.some(name => url.pathname === `/${name}.html`)) {
            let html = content.toString('utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
            if (url.searchParams.has('auth-gate')) html = html.replace('<head>', '<head><script src="/assets/js/private-auth-gate.js"></script>');
            else html = html.replace(/\bdata-private-auth\s*/g, '').replace(/<body([^>]*)\bhidden\s+inert/g, '<body$1');
            content = Buffer.from(html
                .replace(/data-i18n="loading"/g, 'data-i18n="ready"')
                .replace('</body>', '<script type="module" src="/__guide_test.js"></script></body>'));
        }
        response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css'
            : file.endsWith('.json') ? 'application/json' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
        response.end(content);
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
await access(executable);
const profile = await mkdtemp(path.join(os.tmpdir(), 'codex-guide-browser-'));
const browser = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
const exited = once(browser, 'exit');
let socket;
try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
        catch { await delay(100); }
    }
    assert.ok(port, 'Il browser isolato non ha avviato DevTools');
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await once(socket, 'open');
    const pending = new Map();
    let serial = 0;
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        if (!message.id) return;
        const task = pending.get(message.id); pending.delete(message.id);
        if (message.error) task?.reject(new Error(message.error.message));
        else task?.resolve(message.result);
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
        const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        assert.ok(!result.exceptionDetails, result.exceptionDetails?.text || 'Errore nella fixture browser');
        return result.result.value;
    };
    const wait = async expression => {
        for (let attempt = 0; attempt < 150; attempt++) {
            if (await evaluate(expression)) return;
            await delay(100);
        }
        const state = await evaluate(`({notice:document.querySelector('.documentation-entry-notice')?.textContent,
            focus:document.activeElement?.id,busy:document.getElementById('documentation-help-open')?.getAttribute('aria-busy'),
            hidden:document.body.hidden,inert:document.body.inert})`);
        throw new Error('Condizione browser non raggiunta: ' + expression + ' ' + JSON.stringify(state));
    };
    const key = async (value, modifiers = 0) => {
        await command('Input.dispatchKeyEvent', { type: 'keyDown', key: value,
            code: value === 'Tab' ? 'Tab' : value === 'Escape' ? 'Escape' : 'Enter', modifiers,
            text: value === 'Enter' ? '\r' : undefined,
            unmodifiedText: value === 'Enter' ? '\r' : undefined,
            windowsVirtualKeyCode: value === 'Tab' ? 9 : value === 'Escape' ? 27 : 13 });
        await command('Input.dispatchKeyEvent', { type: 'keyUp', key: value, modifiers,
            windowsVirtualKeyCode: value === 'Tab' ? 9 : value === 'Escape' ? 27 : 13 });
    };
    await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
    await command('Page.bringToFront');
    await command('Accessibility.enable');
    await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await command('Page.navigate', { url: `${origin}/impostazioni.html` });
    await wait('window.__guideMounted && !!document.getElementById("documentation-help-open")');
    assert.equal(await evaluate('window.__syntheticVaultLocked'), true);
    // Install the actual application worker and shell before first guide opening.
    await evaluate(`(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
        if(!navigator.serviceWorker.controller) await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})); return true;})()`);
    const cached = await evaluate(`(async()=>{const name=${JSON.stringify(shellCache)};if(!(await caches.keys()).includes(name))return false;const cache=await caches.open(name);return !!(await cache.match('assets/js/modules/assistant/documentation-catalog.json'));})()`);
    assert.equal(cached, true, 'Il catalogo deve entrare nella shell realmente installata');
    await command('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await evaluate('document.getElementById("documentation-help-open").focus()');
    await key('Enter');
    await wait('!!document.querySelector(".documentation-panel")');
    assert.equal(await evaluate('document.querySelector(".documentation-article h3").textContent'), 'Impostazioni');
    console.log('Browser: prima apertura della guida offline con shell reale e Vault sintetico bloccato: OK');
    await key('Escape');
    await command('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

    // Actual presentation gate, synthetic identity: no Firebase or Vault access.
    await command('Page.navigate', { url: `${origin}/impostazioni.html?auth-gate=1` });
    await wait('window.__guideMounted && !!document.getElementById("documentation-help-open")');
    assert.equal(await evaluate('document.body.hidden && document.body.inert'), true, 'La guida non deve rivelare la pagina prima di Auth');
    await evaluate('window.privateAuthGate.acceptIdentity(window.privateAuthGate.begin("synthetic"),{uid:"synthetic",emailVerified:true})');
    await evaluate('document.getElementById("documentation-help-open").click()');
    await wait('!!document.querySelector(".documentation-panel")');
    assert.equal(await evaluate('window.__syntheticVaultLocked'), true);
    await evaluate('window.privateAuthGate.block()');
    assert.equal(await evaluate('document.body.hidden && document.body.inert && !document.querySelector(".documentation-overlay") && !document.querySelector(".documentation-entry")'), true,
        'Il blocco Auth deve smontare la guida senza riaprire la pagina');
    console.log('Browser: gate Auth reale, identità sintetica e Vault bloccato; blocco e cleanup: OK');

    for (const pageId of cases) {
        await command('Page.navigate', { url: `${origin}/${pageId}.html` });
        await wait('window.__guideMounted && !!document.getElementById("documentation-help-open")');
        await evaluate('localStorage.setItem("app_language","en"); document.getElementById("documentation-help-open").focus()');
        await key('Enter');
        await wait('!!document.querySelector(".documentation-panel")');
        const state = await evaluate(`(()=>{const panel=document.querySelector('.documentation-panel');const button=document.getElementById('documentation-close');
            const r=button.getBoundingClientRect();return {role:panel.getAttribute('role'),modal:panel.getAttribute('aria-modal'),title:document.getElementById(panel.getAttribute('aria-labelledby')).textContent,
            focus:document.activeElement.id,options:document.getElementById('documentation-page').options.length,buttonSize:[r.width,r.height],fallback:!document.querySelector('.documentation-fallback').hidden,
            overflow:document.documentElement.scrollWidth>window.innerWidth};})()`);
        assert.equal(state.role, 'dialog'); assert.equal(state.modal, 'true'); assert.ok(state.title);
        assert.equal(state.focus, 'documentation-close'); assert.equal(state.options, 30);
        assert.equal(state.fallback, true); assert.equal(state.overflow, false);
        assert.ok(state.buttonSize.every(size => size >= 44), 'Controllo minimo 44 px');
        const tree = await command('Accessibility.getFullAXTree');
        assert.ok(tree.nodes.some(node => node.role?.value === 'dialog' && node.name?.value === 'Guida dell’app'));
        assert.ok(tree.nodes.filter(node => node.role?.value === 'button').every(node => Boolean(node.name?.value)));
        await key('Tab', 8);
        assert.equal(await evaluate('document.querySelector(".documentation-panel").contains(document.activeElement)'), true, 'Shift Tab deve restare nel dialogo');
        await key('Tab');
        assert.equal(await evaluate('document.activeElement.id'), 'documentation-close', 'Tab dal fondo deve tornare al primo controllo');
        await evaluate('document.getElementById("documentation-first-steps").focus()');
        await key('Enter');
        assert.equal(await evaluate('document.querySelectorAll(".documentation-journey button").length'), 5);
        await evaluate('document.getElementById("documentation-page").value="form_account_privato"; document.getElementById("documentation-page").dispatchEvent(new Event("change"))');
        assert.equal(await evaluate('document.querySelector(".documentation-article h3").textContent'), 'Crea o modifica Account privato');
        assert.equal(await evaluate('location.pathname'), `/${pageId}.html`, 'Le schede della guida non navigano o aprono record');
        await evaluate('document.getElementById("documentation-current-page").click()');
        assert.equal(await evaluate('document.querySelector(".documentation-journey").hidden'), true);
        if (pageId === 'impostazioni') {
            const output = path.resolve(import.meta.dirname, '../.codex-tmp/guide-browser');
            await mkdir(output, { recursive: true });
            const screenshot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            await writeFile(path.join(output, 'guide-mobile.png'), Buffer.from(screenshot.data, 'base64'));
        }
        // A 195 CSS px viewport at scale 2 exercises the 390 px page at 200%.
        await command('Emulation.setDeviceMetricsOverride', { width: 195, height: 422, deviceScaleFactor: 2, mobile: false });
        const enlarged = await evaluate(`(()=>{const panel=document.querySelector('.documentation-panel');const r=panel.getBoundingClientRect();
            return {left:r.left,right:r.right,width:window.innerWidth,font:Number.parseFloat(getComputedStyle(panel).fontSize)};})()`);
        assert.ok(enlarged.left >= 0 && enlarged.right <= enlarged.width + 1 && enlarged.font * 2 >= 32,
            'Il testo al 200% deve rifluire nel dialogo: ' + JSON.stringify(enlarged));
        await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
        await key('Escape');
        assert.equal(await evaluate('!!document.querySelector(".documentation-panel")'), false);
        assert.equal(await evaluate('document.activeElement.id'), 'documentation-help-open');
        await evaluate('document.getElementById("documentation-help-open").click()');
        await wait('!!document.querySelector(".documentation-panel")');
        await evaluate(`(async()=>{const modal=document.createElement('div');modal.id='synthetic-app-modal';modal.setAttribute('aria-modal','true');
            modal.style.display='none';const action=document.createElement('button');action.id='synthetic-modal-action';action.textContent='Synthetic modal';modal.append(action);document.body.append(modal);
            await new Promise(resolve=>setTimeout(resolve,0));if(!document.querySelector('.documentation-panel'))throw new Error('Un dialogo nascosto non deve chiudere la guida');modal.style.display='block';action.focus();
            await new Promise(resolve=>setTimeout(resolve,0));return true;})()`);
        assert.equal(await evaluate('document.querySelector(".documentation-panel") === null'), true, 'Un dialogo dell’app tardivo deve chiudere la guida');
        assert.equal(await evaluate('document.activeElement.id'), 'synthetic-modal-action', 'La guida non deve sottrarre il focus al dialogo dell’app');
        await evaluate('document.getElementById("synthetic-app-modal").remove();document.getElementById("documentation-help-open").click()');
        await wait('!!document.querySelector(".documentation-panel")');
        await evaluate('window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}))');
        assert.equal(await evaluate('document.querySelector(".documentation-panel") === null && document.querySelector(".documentation-entry") === null'), true);
        await evaluate('window.dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))');
        assert.equal(await evaluate('!!document.querySelector(".documentation-entry") && document.querySelector(".documentation-panel") === null'), true,
            'Il ritorno dalla bfcache deve ricreare solo il comando, senza riaprire la guida');
        await evaluate(`(async()=>{const entry=await import('/assets/js/guide.js');window.__guideOwner=entry.initDocumentationHelp();document.getElementById('documentation-help-open').click();return true;})()`);
        await wait('!!document.querySelector(".documentation-panel")');
        await evaluate('window.__guideOwner.destroy(); window.__guideOwner.destroy()');
        assert.equal(await evaluate('document.querySelector(".documentation-overlay") === null && document.querySelector(".documentation-entry") === null'), true);
        assert.equal(await evaluate('[...document.body.children].some(node=>node.inert)'), false);
        console.log(`Browser: ${pageId}, tastiera/AX/fallback/mobile/lifecycle: OK`);
    }
    await evaluate(`(async()=>{const entry=await import('/assets/js/guide.js');window.__guideOwner=entry.mountDocumentationHelp(entry.getDocumentationPageContext(location.pathname));
        const original=window.fetch;window.fetch=async(url,options)=>{const response=await original(url,{...options,signal:undefined});await new Promise(resolve=>setTimeout(resolve,250));return response;};
        document.getElementById('documentation-help-open').click();setTimeout(()=>window.__guideOwner.destroy(),50);
        await new Promise(resolve=>setTimeout(resolve,500));window.fetch=original;return true;})()`);
    assert.equal(await evaluate('document.querySelector(".documentation-overlay") === null && document.querySelector(".documentation-entry") === null'), true,
        'Una risposta del catalogo tardiva non deve riaprire una vista smontata');
    console.log('Browser: annullamento durante risposta catalogo tardiva: OK');
    await command('Browser.close').catch(() => {});
    await Promise.race([exited, delay(5000).then(() => { if (browser.exitCode === null) throw new Error('Browser non terminato'); })]);
} finally {
    socket?.close();
    if (browser.exitCode === null) { browser.kill(); await exited; }
    server.closeAllConnections(); server.close();
    if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('codex-guide-browser-')) await rm(profile, { recursive: true, force: true });
}
