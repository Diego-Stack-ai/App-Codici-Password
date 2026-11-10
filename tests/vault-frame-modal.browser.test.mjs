import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Actual parent HTML/styles, owner, transport and input modal; no Firebase/credentials.
const root = resolve(fileURLToPath(new URL('../Frontend/public/', import.meta.url)));
const parentModule = `import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
import {showInputModal} from '/assets/js/ui-core-v129.js';
document.body.hidden=false;document.body.inert=false;
const state=window.fixture={unlocks:0,confirms:0,clears:0,allowed:true,locks:[]};
const frame=document.getElementById('vault-frame');
const owner=createVaultFrameOwner({window,iframe:frame,release:'fixture',
getIdentity:()=>({uid:'synthetic',epoch:'fixture-fence'}),validateIdentity:async()=>state.allowed,
readPermit:async()=>({enabled:state.allowed,uid:'synthetic',version:1,expiresAt:Date.now()+3600000}),readTimeout:async()=>3,
unlock:async(uid,{signal})=>{state.unlocks++;return showInputModal('Synthetic unlock','','Synthetic input','No real credentials.',{vaultSecret:true,signal});},
confirmSensitive:async({signal})=>{state.confirms++;return (await showInputModal('Synthetic fresh proof','','Synthetic input','No real credentials.',{vaultSecret:true,signal}))==='SYNTHETIC-ONLY';},
clearMaterial:()=>state.clears++,onState:s=>{state.locks.push(s.reason||'started');document.getElementById('frame-status').hidden=!s.locked;}});
window.frameOwner=owner;window.openSyntheticModal=(signal)=>showInputModal('Replacement','','Synthetic input','',{vaultSecret:true,signal});
await owner.start('/home_page.html');state.started=true;`;
const childHtml = `<!doctype html><html><head><script type="module" src="/child-modal-fixture.mjs"></script></head>
<body><input id="child-input"><button id="child-action">Synthetic child action</button></body></html>`;
const childModule = `import {createFrameTransport} from '/assets/js/modules/core/vault-frame-transport.mjs';
const client=createFrameTransport({window,release:'fixture',enabled:true});
window.childState={keys:0,clicks:0,errors:0};
document.querySelector('#child-action').onclick=()=>window.childState.clicks++;
window.requestAgain=()=>client.request('key').then(reply=>{if(reply.kind==='key')window.childState.keys++;});
window.requestFresh=()=>client.request('fresh',{purpose:'backup-export',target:'synthetic'}).then(reply=>{window.childState.fresh=reply.kind;},error=>{window.childState.freshError=error.message;});
void window.requestAgain().catch(()=>{window.childState.errors++;});`;
let server, browser, base;
test.before(async()=>{
    server=createServer(async(req,res)=>{
        try {
            const path=new URL(req.url,'http://127.0.0.1').pathname;
            let type='text/javascript', bytes;
            if(path==='/assets/js/vault-frame-entry.js') bytes=parentModule;
            else if(path==='/standalone.html') {type='text/html';bytes=`<!doctype html><html><head><link rel="stylesheet" href="/assets/css/core.css"><link rel="stylesheet" href="/assets/css/core_ui.css"><script type="module" src="/standalone-modal-fixture.mjs"></script></head><body><button id="ordinary-action">Standalone</button></body></html>`;}
            else if(path==='/standalone-modal-fixture.mjs') bytes=`import {showInputModal} from '/assets/js/ui-core-v129.js';window.openSyntheticModal=signal=>showInputModal('Standalone','','Synthetic input','',{vaultSecret:true,signal});`;
            else if(path==='/child-modal-fixture.mjs') bytes=childModule;
            else if(path.endsWith('.html')&&path!=='/app.html'){type='text/html';bytes=childHtml;}
            else {
                const file=resolve(root,'.'+path);
                if(!file.startsWith(root+sep))throw Error('DENIED');
                bytes=await readFile(file);type=path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript';
            }
            res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(bytes);
        }catch{res.writeHead(404);res.end();}
    });
    await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
    base=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();if(server)await new Promise(ok=>server.close(ok));});

async function fixture({viewport={width:1280,height:850},dropCss=false,dropFocusGuard=false}={}){
    const context=await browser.newContext({viewport,serviceWorkers:'block'});
    let outside=0;
    await context.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==base){outside++;return route.abort();}
        if(dropCss&&url.pathname.endsWith('/core_ui.css'))return route.fulfill({contentType:'text/css',body:''});
        if(dropFocusGuard&&url.pathname.endsWith('/frame-modal-focus.js'))return route.fulfill({contentType:'text/javascript',body:'export function beginFrameModalFocus(){return null;}'});
        return route.continue();
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.name));
    try {
        await page.goto(base+'/app.html');
        await page.waitForFunction(()=>window.fixture?.started&&window.fixture.unlocks===1);
        await page.locator('#protocol-input-modal.active').waitFor({state:'attached'});
        return {context,page,errors,outside:()=>outside,child:()=>page.frames().find(f=>f!==page.mainFrame())};
    } catch(error){await context.close();throw error;}
}
async function promptState(page){
    return page.evaluate(()=>{
        const modal=document.getElementById('protocol-input-modal'),box=modal.querySelector('.modal-box'),frame=document.getElementById('vault-frame');
        const style=getComputedStyle(modal),r=modal.getBoundingClientRect(),b=box.getBoundingClientRect();
        const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
        return {position:style.position,z:Number(style.zIndex),coversViewport:r.left<=0&&r.top<=0&&r.right>=innerWidth&&r.bottom>=innerHeight,
            hitInside:!!hit&&modal.contains(hit),inert:frame.inert,focusInside:modal.contains(document.activeElement),
            dialogRole:box.getAttribute('role'),ariaModal:box.getAttribute('aria-modal'),named:!!document.getElementById(box.getAttribute('aria-labelledby')),
            masked:getComputedStyle(modal.querySelector('input')).webkitTextSecurity==='disc',unlocked:window.frameOwner.session.state().unlocked};
    });
}
async function assertPrompt(page){
    const state=await promptState(page);
    assert.equal(state.position,'fixed');assert.ok(state.z>0);assert.equal(state.coversViewport,true);
    assert.equal(state.hitInside,true);assert.equal(state.inert,true);assert.equal(state.focusInside,true);
    assert.equal(state.dialogRole,'dialog');assert.equal(state.ariaModal,'true');assert.equal(state.named,true);assert.equal(state.masked,true);
}
async function confirm(page){
    await page.locator('#protocol-input-modal-input').fill('SYNTHETIC-ONLY');
    await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(()=>!document.getElementById('protocol-input-modal'));
}

for(const viewport of [{width:1280,height:850},{width:393,height:852}])test(`real parent modal stays above iframe, inert and keyboard-contained at ${viewport.width}px`,async()=>{
    const f=await fixture({viewport});
    try {
        await assertPrompt(f.page);
        assert.equal(await f.child().evaluate(()=>window.childState.keys),0);
        assert.equal((await promptState(f.page)).unlocked,false);
        for(let i=0;i<12;i++){await f.page.keyboard.press(i%2?'Shift+Tab':'Tab');assert.equal((await promptState(f.page)).focusInside,true);}
        await f.page.evaluate(()=>document.getElementById('frame-resume').focus());
        assert.equal((await promptState(f.page)).focusInside,true);
        await f.child().evaluate(()=>document.getElementById('child-action').focus());
        assert.equal((await promptState(f.page)).focusInside,true);
        await f.page.setViewportSize({width:viewport.height,height:viewport.width});
        await f.page.waitForTimeout(100);
        await assertPrompt(f.page);
        const childButton=await f.child().locator('#child-action').boundingBox();
        await f.page.mouse.click(childButton.x+childButton.width/2,childButton.y+childButton.height/2);
        await f.page.locator('#protocol-input-modal-input').focus();
        await f.page.keyboard.type('x');
        assert.equal(await f.child().locator('#child-input').inputValue(),'');
        assert.equal(await f.child().evaluate(()=>window.childState.clicks),0);
        await confirm(f.page);
        await f.child().waitForFunction(()=>window.childState.keys===1);
        assert.equal(await f.page.locator('#vault-frame').evaluate(el=>el.inert),false);
        await f.child().evaluate(()=>window.requestAgain());
        assert.equal(await f.page.evaluate(()=>window.fixture.unlocks),1);
        await f.child().evaluate(()=>{void window.requestFresh();});
        await f.page.locator('#protocol-input-modal.active').waitFor({state:'attached'});
        await assertPrompt(f.page);
        await f.page.locator('#modal-confirm-btn').focus();
        await f.page.keyboard.press('Escape');
        await f.page.waitForFunction(()=>!document.getElementById('protocol-input-modal'));
        await f.child().waitForFunction(()=>window.childState.freshError==='FRAME_REQUEST_DENIED');
        assert.equal(await f.page.locator('#vault-frame').evaluate(el=>el.inert),false);
        assert.deepEqual(f.errors,[]);assert.equal(f.outside(),0);
    }finally{await f.context.close();}
});

test('negative controls catch missing parent stylesheet and missing iframe/focus isolation',async()=>{
    for(const options of [{dropCss:true},{dropFocusGuard:true}]){
        const f=await fixture(options);
        try {await assert.rejects(assertPrompt(f.page),assert.AssertionError);}
        finally{await f.context.close();}
    }
});

for(const reason of ['revocation','pagehide','freeze','hidden','dispose'])test(`${reason} cancels real prompt, clears input and preserves child isolation`,async()=>{
    const f=await fixture();
    try {
        await f.page.locator('#protocol-input-modal-input').fill('SYNTHETIC-ONLY');
        await f.page.evaluate(reason=>{
            window.cancelledPromptInput=document.getElementById('protocol-input-modal-input');
            if(reason==='revocation'){window.fixture.allowed=false;window.frameOwner.session.lock('policy-revoked');}
            else if(reason==='pagehide')window.dispatchEvent(new Event('pagehide'));
            else if(reason==='freeze')document.dispatchEvent(new Event('freeze'));
            else if(reason==='hidden'){Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}
            else window.frameOwner.dispose();
        },reason);
        await f.page.waitForFunction(()=>!document.getElementById('protocol-input-modal'));
        assert.equal(await f.page.evaluate(()=>window.cancelledPromptInput.value),'');
        assert.equal(await f.page.locator('#vault-frame').count(),reason==='hidden'?1:0);
        assert.equal(await f.page.evaluate(()=>window.frameOwner.session.state().unlocked),false);
        if(reason==='hidden') {
            assert.equal(await f.page.locator('#vault-frame').evaluate(el=>el.inert&&el.style.visibility==='hidden'),true);
            assert.equal(await f.child().evaluate(()=>window.childState.keys),0);
        } else assert.notEqual(await f.page.evaluate(()=>window.fixture.locks.at(-1)),'started');
        await f.page.waitForTimeout(350);
        assert.equal(await f.page.locator('#vault-frame').count(),reason==='hidden'?1:0);
        assert.deepEqual(f.errors,[]);
    }finally{await f.context.close();}
});

test('standalone input modal keeps confirmation, cancel, masking and aborted-signal behavior',async()=>{
    const f=await fixture();
    try {
        await f.page.goto(base+'/standalone.html');
        await f.page.waitForFunction(()=>typeof window.openSyntheticModal==='function');
        assert.equal(await f.page.evaluate(()=>!!window.vaultFrameNavigation),false);
        await f.page.evaluate(()=>{window.ordinaryResult='pending';void window.openSyntheticModal().then(v=>{window.ordinaryResult=v;});});
        await f.page.locator('#protocol-input-modal.active').waitFor({state:'attached'});
        assert.equal(await f.page.locator('#ordinary-action').evaluate(el=>el.inert),false);
        assert.equal(await f.page.locator('#protocol-input-modal-input').getAttribute('type'),'text');
        await confirm(f.page);
        assert.equal(await f.page.evaluate(()=>window.ordinaryResult),'SYNTHETIC-ONLY');
        await f.page.evaluate(()=>{window.ordinaryResult='pending';void window.openSyntheticModal().then(v=>{window.ordinaryResult=v;});});
        await f.page.locator('#protocol-input-modal.active').waitFor({state:'attached'});
        await f.page.locator('#protocol-input-modal-input').press('Escape');
        await f.page.waitForFunction(()=>window.ordinaryResult===null);
        assert.equal(await f.page.evaluate(async()=>{const c=new AbortController();c.abort();return window.openSyntheticModal(c.signal);}),null);
        assert.equal(await f.page.locator('#protocol-input-modal').count(),0);
        assert.deepEqual(f.errors,[]);
    }finally{await f.context.close();}
});

test('already-aborted and replaced dialogs leave no orphan modal or inert hold',async()=>{
    const f=await fixture();
    try {
        await confirm(f.page);await f.child().waitForFunction(()=>window.childState.keys===1);
        assert.equal(await f.page.evaluate(async()=>{const c=new AbortController();c.abort();return await window.openSyntheticModal(c.signal);}),null);
        assert.equal(await f.page.locator('#protocol-input-modal').count(),0);
        await f.page.evaluate(()=>{window.firstResult='pending';window.secondResult='pending';void window.openSyntheticModal().then(v=>{window.firstResult=v;});});
        await f.page.locator('#protocol-input-modal.active').waitFor({state:'attached'});
        await f.page.evaluate(()=>{void window.openSyntheticModal().then(v=>{window.secondResult=v;});});
        await f.page.waitForFunction(()=>window.firstResult===null);
        await f.page.locator('#protocol-input-modal.active').waitFor({state:'attached'});
        await assertPrompt(f.page);
        await f.page.locator('#modal-cancel-btn').click();
        await f.page.waitForFunction(()=>window.secondResult===null);
        assert.equal(await f.page.locator('#protocol-input-modal').count(),0);
        assert.equal(await f.page.locator('#vault-frame').evaluate(el=>el.inert),false);
        assert.deepEqual(f.errors,[]);
    }finally{await f.context.close();}
});
