import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createLocalC1Driver} from '../scripts/lib/c1-e2e-cases.mjs';
import {browserEnvironment} from '../scripts/lib/c1-e2e-runner.mjs';

// Real owner/broker/transport, synthetic UI/admission/material only. No Firebase.
const parent = `<!doctype html><link rel="stylesheet" href="/assets/css/vault-frame.css">
<script type="module" src="/owner-fixture.mjs"></script>
<body><div data-frame-safe-area></div><iframe id="vault-frame" class="vault-frame" hidden inert></iframe></body>`;
const ownerModule = `
import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
const fault=new URL(location.href).searchParams.get('fault')||sessionStorage.getItem('fault')||'';
sessionStorage.setItem('fault',fault);
const repeat=fault==='repeat',skip=fault==='skip',wrong=fault==='wrong';
const repeatReload=fault==='repeat-reload';
const first=!sessionStorage.getItem('started');sessionStorage.setItem('started','yes');
const iframe=document.querySelector('iframe');
window.fixture={unlocks:0};
function prompt(){return new Promise(resolve=>{
 const box=document.createElement('div');box.id='modal';
 box.style='position:fixed;inset:0;z-index:99999;background:white';
 box.innerHTML='<input id="protocol-input-modal-input"><button id="modal-confirm-btn">Confirm</button>';
 document.body.append(box);
 box.querySelector('button').onclick=()=>{box.remove();resolve('SYNTHETIC-MATERIAL');
  if(repeatReload){const repeated=document.createElement('input');repeated.id='protocol-input-modal-input';document.body.append(repeated);}
 };
});}
const owner=createVaultFrameOwner({window,iframe,release:'fixture',
 getIdentity:()=>({uid:'synthetic',epoch:'1:fixture'}),
 readPermit:async()=>({enabled:true,uid:'synthetic',version:1,expiresAt:Date.now()+3600000}),
 validateIdentity:async()=>true,readTimeout:async()=>3,
 unlock:async()=>{window.fixture.unlocks++;return first||skip?'SYNTHETIC-MATERIAL':prompt();},
 confirmSensitive:async()=>true,clearMaterial:()=>{}});
window.c1Fault=repeat;window.c1Wrong=wrong;
const route=new URL(location.href).searchParams.get('route')||'/home_page.html';
await owner.start(route);window.started=true;
`;
const child = `<!doctype html><script type="module" src="/child-fixture.mjs"></script>
<body><header id="header-left"><button class="btn-icon-header">Back</button></header>
<main><a href="area_privata.html">Private</a><a href="account_privati.html?type=standard">Accounts</a></main></body>`;
const childModule = `
import {createFrameTransport} from '/assets/js/modules/core/vault-frame-transport.mjs';
const transport=createFrameTransport({window,release:'fixture',enabled:true});
await transport.request('key');
document.querySelectorAll('a').forEach(a=>a.onclick=e=>{
 e.preventDefault();
 const target=parent.c1Wrong?'/profilo_privato.html':new URL(a.href).pathname+new URL(a.href).search;
 parent.vaultFrameNavigation.navigateFromChild(window,document,target,false);
});
document.querySelector('button').onclick=()=>parent.vaultFrameNavigation.navigateFromChild(window,document,'/area_privata.html',false);
if(parent.c1Fault&&location.pathname==='/account_privati.html'){
 const input=parent.document.createElement('input');input.id='protocol-input-modal-input';
 input.style='position:fixed;z-index:99999;top:0';parent.document.body.append(input);
}
`;
let browser, server, base;
test.before(async()=>{
 server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://fixture.invalid').pathname;
  const fixtures={'/app.html':['text/html',parent],'/owner-fixture.mjs':['text/javascript',ownerModule],
   '/child-fixture.mjs':['text/javascript',childModule]};
  try{
   let content,type;
   if(fixtures[path]) [type,content]=fixtures[path];
   else if(/^\/[a-z_]+\.html$/.test(path)){type='text/html';content=child;}
   else if(/^\/assets\/js\/modules\/core\/vault-frame-[a-z-]+\.mjs$/.test(path)||
           path==='/assets/js/modules/core/frame-modal-focus.js'||
           path==='/assets/css/vault-frame.css'){
    type=path.endsWith('.css')?'text/css':'text/javascript';
    content=await readFile(new URL('../Frontend/public'+path,import.meta.url));
   }else{res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true,env:browserEnvironment(process.env)});
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function fixture(fault=''){
 const context=await browser.newContext({serviceWorkers:'block'});
 // An explicit origin comparison; no startsWith URL bypass and no external egress.
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();
 await page.goto(base+'/app.html'+(fault?'?fault='+fault:''));
 await page.waitForFunction(()=>window.started&&document.querySelector('iframe').style.visibility==='visible');
 return {context,page,driver:await createLocalC1Driver(page)};
}
// Test-only interception: arm the synthetic delay at the actual click, then
// delegate to Playwright with the driver's options unchanged. No forced click.
function withLocalClick(page,onClick){
 return new Proxy(page,{get(target,key){
  if(key==='frameLocator')return selector=>{
   const frame=target.frameLocator(selector);
   return new Proxy(frame,{get(target,key){
    if(key==='locator')return selector=>{
     const locator=target.locator(selector);
     return new Proxy(locator,{get(target,key){
      if(key==='click')return options=>onClick({selector,locator:target,options});
      const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
     }});
    };
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
   }});
  };
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});
}

test('local click completes the real navigation after a synthetic delay beyond 3 seconds',async()=>{
 const f=await fixture();let privateClicks=0;
 try{
  const page=withLocalClick(f.page,async({selector,locator,options})=>{
   if(selector==='a[href="area_privata.html"]'){
    privateClicks++;
    await locator.evaluate(link=>{
     link.hidden=true;
     setTimeout(()=>{link.hidden=false;parent.fixture.delayedClickReleased=true;},4000);
    });
   }
   return locator.click(options);
  });
  const driver=await createLocalC1Driver(page);
  await driver.navigationCore();await driver.historyCore();
  assert.equal(privateClicks,1);
  assert.equal(await f.page.evaluate(()=>window.fixture.delayedClickReleased),true);
  assert.equal(await f.page.evaluate(()=>window.fixture.unlocks),1);
 }finally{await f.context.close();}
});

test('local click with an absent target stays a failure with the fixed step',async()=>{
 const f=await fixture();let privateClicks=0;
 try{
  const page=withLocalClick(f.page,async({selector,locator,options})=>{
   if(selector==='a[href="area_privata.html"]'){privateClicks++;await locator.evaluate(link=>link.remove());}
   return locator.click(options);
  });
  const driver=await createLocalC1Driver(page);
  await assert.rejects(()=>driver.navigationCore(),/^Error: C1_LOCAL_CLICK_PRIVATE$/);
  assert.equal(privateClicks,1);assert.equal(await f.page.evaluate(()=>window.fixture.unlocks),1);
 }finally{await f.context.close();}
});

test('real local broker: UI links, browser Back/Forward, app Back preserve query and one unlock',async()=>{
 const f=await fixture();
 try{
  await f.driver.navigationCore();await f.driver.historyCore();
  assert.equal(await f.page.evaluate(()=>window.fixture.unlocks),1);
 }finally{await f.context.close();}
});
test('intentional continuity regression is detected, never silently unlocked',async()=>{
 const f=await fixture('repeat');
 try{await assert.rejects(()=>f.driver.navigationCore(),/^Error: C1_CONTINUITY_BROKEN$/);}
 finally{await f.context.close();}
});
test('wrong UI destination cannot produce a PASS',async()=>{
 const f=await fixture('wrong');
 try{await assert.rejects(()=>f.driver.navigationCore(),/^Error: C1_DESTINATION_WRONG$/);}
 finally{await f.context.close();}
});
test('reload owner demands exactly one new unlock, preserves Account category',async()=>{
 const f=await fixture();let submissions=0;
 try{
  await f.driver.navigationCore();
  await f.driver.reloadOwner(async page=>{
   submissions++;await page.locator('#protocol-input-modal-input').fill('synthetic');
   await page.locator('#modal-confirm-btn').click();
  });
  assert.equal(submissions,1);
 }finally{await f.context.close();}
});
test('missing unlock after reload is a failure before any submission',async()=>{
 const f=await fixture('skip');let submissions=0;
 try{
  await f.driver.navigationCore();
  await assert.rejects(()=>f.driver.reloadOwner(async()=>{submissions++;}),/^Error: C1_UNLOCK_MISSING$/);
  assert.equal(submissions,0);
 }finally{await f.context.close();}
});
test('second Master after reload is a failure, never submitted again',async()=>{
 const f=await fixture('repeat-reload');let submissions=0;
 try{
  await f.driver.navigationCore();
  await assert.rejects(()=>f.driver.reloadOwner(async page=>{
   submissions++;await page.locator('#protocol-input-modal-input').fill('synthetic');
   await page.locator('#modal-confirm-btn').click();
  }),/^Error: C1_CONTINUITY_BROKEN$/);
  assert.equal(submissions,1);
 }finally{await f.context.close();}
});
