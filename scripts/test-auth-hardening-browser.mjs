import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve('Frontend/public');
const privateHtml=`<!doctype html><html><head><script src="/assets/js/private-auth-gate.js"></script>
<link rel="stylesheet" href="/assets/css/core.css"></head><body data-private-auth hidden inert>synthetic private view
<script type="module">
import {authSessionFence as fence} from '/assets/js/auth-session-fence.js';
import * as vault from '/assets/js/modules/core/vault-session.js';
import {logoutWithCleanup} from '/assets/js/logout-session.js';
window.synthetic={fence,vault,logout:()=>logoutWithCleanup(async()=>{throw new Error('synthetic signOut failure');})};
const permit=await fence.readPermit();
if(!permit) window.privateAuthGate.reject();
else {
  const ticket=window.privateAuthGate.begin('synthetic');
  if(await fence.isCurrent(permit)) window.privateAuthGate.acceptIdentity(ticket,{uid:'synthetic',emailVerified:true});
}
</script></body></html>`;
const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/private.html'){res.setHeader('Content-Type','text/html');res.end(privateHtml);return;}
    if(url.pathname==='/login.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body>synthetic login</body></html>');return;}
    const file=path.resolve(root,'.'+url.pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
    try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile(file));}
    catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let checks=0;
try {
    for(const executablePath of ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']) {
        const browser=await chromium.launch({executablePath,headless:true});
        try {for(const withoutBroadcast of [false,true]){
            const context=await browser.newContext();
            try {
                const external=[];
                await context.route('**/*',route=>{
                    if(new URL(route.request().url()).origin===origin) return route.continue();
                    external.push(route.request().url());return route.abort();
                });
                if(withoutBroadcast) await context.addInitScript(()=>{window.BroadcastChannel=undefined;});
                const a=await context.newPage(),b=await context.newPage();
                await Promise.all([a.goto(origin+'/private.html'),b.goto(origin+'/private.html')]);
                await Promise.all([a.waitForFunction(()=>!document.body.hidden),b.waitForFunction(()=>!document.body.hidden)]);
                await b.evaluate(async()=>{await window.synthetic.vault.saveVaultSession('SYNTHETIC-KEY','synthetic');});
                assert.equal(await b.evaluate(()=>sessionStorage.length),0);
                await a.evaluate(()=>{void window.synthetic.logout();});
                await Promise.all([a.waitForURL('**/login.html'),b.waitForURL('**/login.html')]);
                const c=await context.newPage();await c.goto(origin+'/private.html');await c.waitForURL('**/login.html');
                // Start a login, then race a later logout from another tab.
                await c.evaluate(async()=>{const m=await import('/assets/js/auth-session-fence.js');window.f=m.authSessionFence;window.permit=await window.f.beginExplicitLogin();});
                await b.evaluate(async()=>{const m=await import('/assets/js/auth-session-fence.js');await m.authSessionFence.deny();});
                assert.equal(await c.evaluate(async()=>{try{await window.f.completeExplicitLogin(window.permit,{uid:'synthetic',emailVerified:true});return true;}catch{return false;}}),false);
                await c.evaluate(async()=>{const p=await window.f.beginExplicitLogin();await window.f.completeExplicitLogin(p,{uid:'synthetic',emailVerified:true});});
                await c.goto(origin+'/private.html');await c.waitForFunction(()=>!document.body.hidden);
                // Reload loses the real document RAM key, even with all storage retained.
                await c.evaluate(async()=>window.synthetic.vault.saveVaultSession('SYNTHETIC-KEY','synthetic'));
                await c.reload();await c.waitForFunction(()=>!document.body.hidden);
                assert.equal(await c.evaluate(()=>window.synthetic.vault.restoreVaultSession('synthetic')),null);
                const tokenError=await c.evaluate(async()=>{
                    const runtime=await import('/assets/js/vendor/firebase-runtime.js');
                    Object.defineProperty(Notification,'permission',{configurable:true,get:()=> 'denied'});
                    try {await runtime.getMessagingToken({});return 'unexpected-success';}
                    catch(error){return error.code;}
                });
                assert.equal(tokenError,'messaging/permission-blocked','the generated alias must call Messaging, not App Check');
                // The pending card has deterministic contrasting pairs in both themes.
                for(const dark of [false,true]){
                    const colors=await c.evaluate(dark=>{
                        document.documentElement.classList.toggle('dark',dark);
                        document.documentElement.dataset.privateAuthState='pending';
                        const s=getComputedStyle(document.documentElement,'::before');
                        return {fg:s.color,bg:s.backgroundColor};
                    },dark);
                    const luminance=rgb=>rgb.match(/\d+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
                    const values=[luminance(colors.fg),luminance(colors.bg)].sort((x,y)=>y-x);
                    assert.ok((values[0]+.05)/(values[1]+.05)>=4.5);
                }
                assert.deepEqual(external,[]);
                checks++;console.log(path.basename(executablePath)+': logout/tab/login race/RAM/contrast PASS (BroadcastChannel '+!withoutBroadcast+')');
            } finally {await context.close();}
        }} finally {await browser.close();}
    }
    console.log('Browser hardening: '+checks+' configurations passed; synthetic data, loopback only.');
} finally {await new Promise(resolve=>server.close(resolve));}
