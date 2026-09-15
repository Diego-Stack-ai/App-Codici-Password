import {createServer} from 'node:http';
import {readFile, mkdtemp, rm, access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const publicRoot = path.resolve(import.meta.dirname, '../Frontend/public');
const published = process.argv.includes('--published');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const home = (await readFile(path.join(publicRoot, 'home_page.html'), 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
const validation = await readFile(path.join(publicRoot, 'assets/js/main-v129.js'), 'utf8');
const start = validation.indexOf('const publicPages =');
const end = validation.indexOf('if (isPrivatePage && navigator.onLine) firebaseRuntime.enableAppCheck', start);
const gateValidation = validation.slice(start, end);
const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname === '/login-v115.html') {
            response.setHeader('Content-Type', 'text/html');
            response.end('<!doctype html><html><body>Login fixture</body></html>'); return;
        }
        if (url.pathname === '/home_page.html') {
            const scenario = url.searchParams.get('case');
            assert.ok(['null','valid','error','timeout','logout'].includes(scenario));
            const simulation = `
                const gate = window.privateAuthGate;
                const currentPage = 'home';
                const user = {uid:'synthetic',emailVerified:true,reload:async()=>{}};
                const auth = {currentUser:user};
                window.__authPhase = 'pending';
                setTimeout(async () => {
                    if (${JSON.stringify(scenario)} === 'timeout') return;
                    if (${JSON.stringify(scenario)} === 'null') { gate.begin(null); gate.reject(); return; }
                    if (${JSON.stringify(scenario)} === 'error') { gate.reject('error'); return; }
                    const authAttempt = gate.begin(user.uid);
                    ${gateValidation}
                    window.__authPhase = 'ready';
                    if (${JSON.stringify(scenario)} === 'logout') {
                        sessionStorage.setItem('vault_session_v1','synthetic');
                        sessionStorage.setItem('codex_vault_session_wrapping_key_v1','synthetic');
                        const {logoutWithCleanup} = await import('/assets/js/logout-session.js');
                        await logoutWithCleanup(async () => {
                            window.__authProbe(JSON.stringify({logoutBlocked:document.body.hidden,
                                localCleared:sessionStorage.getItem('vault_session_v1')===null}));
                        });
                    }
                }, 250);
            `;
            response.setHeader('Content-Type', 'text/html');
            response.end(home.replace('<head>', '<head><script src="/assets/js/private-auth-gate.js"></script>')
                .replace('</body>', `<script type="module">${simulation}</script></body>`)); return;
        }
        const file = path.resolve(publicRoot, '.' + url.pathname);
        if (!file.startsWith(publicRoot + path.sep)) throw new Error('Invalid path');
        response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
        response.end(await readFile(file));
    } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function checkBrowser(executable) {
    await access(executable);
    const profile = await mkdtemp(path.join(os.tmpdir(), 'codex-auth-gate-'));
    const browser = spawn(executable, ['--headless=new','--no-first-run','--no-default-browser-check',
        '--disable-background-networking','--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], {windowsHide:true, stdio:'ignore'});
    const exited = once(browser, 'exit');
    let socket;
    try {
        let port;
        for (let n = 0; n < 100; n++) {
            try { port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
            catch { await delay(100); }
        }
        assert.ok(port, 'DevTools did not start');
        const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method:'PUT'})).json();
        socket = new WebSocket(target.webSocketDebuggerUrl);
        await once(socket, 'open');
        let serial = 0;
        const pending = new Map(); let observed = [];
        socket.addEventListener('message', event => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const entry = pending.get(message.id); pending.delete(message.id);
                if (message.error) entry?.reject(new Error(message.error.message)); else entry?.resolve(message.result);
            }
            if (message.method === 'Runtime.bindingCalled' && message.params.name === '__authProbe') observed.push(JSON.parse(message.params.payload));
        });
        const command = (method, params = {}) => new Promise((resolve,reject) => {
            const id = ++serial; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params}));
        });
        await command('Page.enable'); await command('Runtime.enable');
        await command('Runtime.addBinding', {name:'__authProbe'});
        await command('Page.addScriptToEvaluateOnNewDocument', {source:`
            document.addEventListener('DOMContentLoaded', () => {
                let previous=''; const sample=()=>{
                    const state={page:location.pathname, phase:window.__authPhase||'pending',
                        visible:!!document.body && getComputedStyle(document.body).display!=='none' && getComputedStyle(document.body).visibility!=='hidden'};
                    const value=JSON.stringify(state); if(value!==previous){previous=value;window.__authProbe(value);}
                    requestAnimationFrame(sample);
                }; requestAnimationFrame(sample);
            });`});
        for (const scenario of published ? ['published'] : ['null','valid','error','timeout','logout']) {
            observed = [];
            await command('Page.navigate', {url:published ? 'https://appcodici-password.web.app/home_page.html' : `${origin}/home_page.html?case=${scenario}`});
            const deadline = Date.now() + (scenario === 'timeout' ? 18000 : published ? 6000 : 5000);
            while (Date.now() < deadline) {
                if (!published && observed.some(state => scenario === 'valid' ? state.phase === 'ready' : state.page === '/login-v115.html')) break;
                await delay(100);
            }
            if (published) {
                console.log(JSON.stringify({browser:path.basename(executable), privateStructureVisibleBeforeAuth:observed.some(s=>s.page==='/home_page.html'&&s.visible), finalPage:observed.at(-1)?.page, isolatedProfile:true}));
            } else {
                assert.ok(observed.some(s=>s.page==='/home_page.html'&&s.phase==='pending'&&!s.visible), scenario + ': initially hidden');
                assert.ok(!observed.some(s=>s.page==='/home_page.html'&&s.phase==='pending'&&s.visible), scenario + ': no pre-auth frame');
                if (scenario==='valid') assert.ok(observed.some(s=>s.phase==='ready'&&s.visible));
                else assert.ok(observed.some(s=>s.page==='/login-v115.html'), scenario + ': redirect');
                if (scenario==='logout') assert.ok(observed.some(s=>s.logoutBlocked&&s.localCleared));
                console.log(path.basename(executable) + ': ' + scenario + ' passed');
            }
        }
        await command('Browser.close').catch(()=>{});
        await Promise.race([exited, delay(5000).then(()=>{if(browser.exitCode===null) throw new Error('Browser did not exit');})]);
    } finally {
        socket?.close();
        if (browser.exitCode === null) { browser.kill(); await exited; }
        if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('codex-auth-gate-')) await rm(profile,{recursive:true,force:true});
    }
}
try {
    const browsers = published ? ['C:/Program Files/Google/Chrome/Application/chrome.exe'] :
        ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
    const results = await Promise.allSettled(browsers.map(checkBrowser));
    for (const result of results) if (result.status === 'rejected') throw result.reason;
} finally { server.closeAllConnections(); server.close(); }
