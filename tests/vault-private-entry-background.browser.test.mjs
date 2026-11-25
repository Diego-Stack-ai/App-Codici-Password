import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';

// Regression: real shell/gate/production adapter/owner/transport/modal and
// exact main key guard/switch fragments; synthetic Auth, key ceremony and page
// initializer/repository. Visibility events are imposed, not native Safari.
const root=resolve(import.meta.dirname,'../Frontend/public');
const main=(await readFile(resolve(root,'assets/js/main-v129.js'),'utf8')).replace(/\r\n/g,'\n');
const manager=(await readFile(resolve(root,'assets/js/modules/core/security-manager.js'),'utf8')).replace(/\r\n/g,'\n');
function cut(s,a,b){const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>=0&&end>start,a);return s.slice(start,end);}
const keyGuard=cut(main,'let vaultKeyMaterial = null;','if (vaultKeyMaterial) {').trim();
const switchSource=cut(main,'switch (currentPage) {',"if (currentPage === 'home' && !firstConfigurationComplete)");
const managerEnsure=cut(manager,'export async function ensureVaultKeyMaterial(options = {}) {','async function ensureFrameMaterial').replace('export ','');
const managerFrame=cut(manager,'async function ensureFrameMaterial(fresh) {','async function ensureVaultKeyMaterialInternal');
const app=(await readFile(resolve(root,'app.html'),'utf8')).replace(/<script type="module" src="assets\/js\/vault-frame-entry[^>]+><\/script>/,
 '<script src="/assets/js/private-auth-gate.js"></script><script type="module" src="/bg-parent.mjs"></script>');
const production=(await readFile(resolve(root,'assets/js/modules/core/vault-frame-production.js'),'utf8')).replace(/^import .*;\r?\n/gm,'');
const deps=`import {createVaultFrameOwner as realOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
export const APP_VERSION='fixture',auth={currentUser:{uid:'synthetic',emailVerified:true}},db={};
export const authSessionFence={isCurrent:async()=>true,isLocallyAllowed:()=>true};
export const doc=()=>({}),onSnapshot=()=>()=>{},getUserProfile=async()=>({lock_timeout:720});
export const emitFrameDiagnostic=code=>window.bgParent.codes.push(code);
export const createProductionFrameAdmission=()=>({read:async()=>({enabled:true,uid:'synthetic',version:1,expiresAt:Date.now()+3600000}),dispose(){}});
export const installFramePushNavigation=()=>()=>{};
export const createVaultFrameOwner=options=>{const owner=realOwner(options);window.bgOwner=owner;return owner;};`;
const productionModule=`import {APP_VERSION,auth,db,authSessionFence,doc,onSnapshot,getUserProfile,emitFrameDiagnostic,createProductionFrameAdmission,installFramePushNavigation,createVaultFrameOwner} from '/bg-deps.mjs';\n`+production;
const parent=`import {startVaultFrame} from '/bg-production.mjs';import {showInputModal} from '/bg-ui.mjs';
window.bgParent={calls:0,material:false,codes:[],childInit:0,childReads:0,childWaitError:null};
const gate=window.privateAuthGate;gate.acceptIdentity(gate.begin('synthetic'),{uid:'synthetic',emailVerified:true});
await startVaultFrame({user:{uid:'synthetic'},fenceTicket:{revision:1,nonce:'fixture'},securityManager:{
 setFrameExpiryAuthority(){},clearSession(){bgParent.material=false;},
 async ensureVaultKeyMaterial({signal}={}){bgParent.calls++;const pass=await showInputModal('SBLOCCO VAULT','','Master Password','',{vaultSecret:true,signal});
 if(!pass||signal?.aborted)throw Error('SYNTHETIC_NO_PASSWORD');bgParent.material=true;return 'SYNTHETIC-MATERIAL';}
}});bgParent.started=true;`;
const childHtml=(await readFile(resolve(root,'dati_azienda.html'),'utf8'))
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')
 .replace('<head>','<head><script src="/assets/js/private-auth-gate.js"></script>')
 .replace('</body>','<p id="invented-private-value"></p><script type="module" src="/bg-child.mjs"></script></body>');
function childModule(){
 const guard=keyGuard;
 return `import {createElement} from '/assets/js/dom-utils.js';import {t} from '/bg-labels.mjs';
import {createFrameTransport} from '/assets/js/modules/core/vault-frame-transport.mjs';
const vaultFrameClient=createFrameTransport({window,release:'fixture',enabled:true});
const currentPage=location.pathname==='/home_page.html'?'home':'dati_azienda';
const auth={currentUser:{uid:'synthetic',emailVerified:true}},user=auth.currentUser;
const authSessionFence={readPermit:async()=>({uid:'synthetic'}),isCurrent:async()=>true};
let _vaultKeyMaterial=null,_frameFencePermit=null,_isSoftLocked=false,_vaultAutoUnlock=false,_sessionGeneration=0,_unlockPromise=null;
const state=window.bgChild={init:0,reads:0,clears:0,afterGuard:false,done:false,waitError:null};
const isVaultUnlocked=()=>!!_vaultKeyMaterial&&vaultFrameClient.isUnlocked();
function assertCurrentSession(uid,generation){if(uid!==auth.currentUser?.uid||generation!==_sessionGeneration)throw Error('STALE_SYNTHETIC_SESSION');}
function clearSession({notifyFrame=true}={}){if(notifyFrame&&vaultFrameClient.isChild())vaultFrameClient.lock();_sessionGeneration++;_unlockPromise=null;_vaultKeyMaterial=null;_frameFencePermit=null;state.clears++;}
${managerFrame}
${managerEnsure}
const gate=window.privateAuthGate,authAttempt=gate.begin(user.uid),fenceTicket={};gate.acceptIdentity(authAttempt,user);
const securityModules=[{clearSession,ensureVaultKeyMaterial:async()=>{try{return await ensureVaultKeyMaterial();}catch(e){state.waitError=e.message;parent.bgParent.childWaitError=e.message;throw e;}}}];
const Pages={initDatiAzienda:async()=>{state.init++;state.reads++;parent.bgParent.childInit++;parent.bgParent.childReads++;document.querySelector('#invented-private-value').textContent='INVENTED COMPANY VALUE';},
initHomePage:async()=>{state.init++;state.reads++;parent.bgParent.childInit++;parent.bgParent.childReads++;document.querySelector('#invented-private-value').textContent='INVENTED HOME VALUE';}};
window.bgDone=(async()=>{try{${guard}
state.afterGuard=true;${switchSource}
}finally{state.done=true;}})();
window.bgState=()=>({...state,materialPresent:!!_vaultKeyMaterial,frameUnlocked:vaultFrameClient.isUnlocked(),value:document.querySelector('#invented-private-value').textContent});`;
}
const ui=(await readFile(resolve(root,'assets/js/ui-core-v129.js'),'utf8'))
 .replace("'./dom-utils.js'","'/assets/js/dom-utils.js'").replace("'./translations.js'","'/bg-labels.mjs'")
 .replace("'./modules/core/password-policy.js'","'/bg-policy.mjs'");

const routes=new Map([
 ['/app.html',['text/html',app]],['/bg-parent.mjs',['text/javascript',parent]],['/bg-production.mjs',['text/javascript',productionModule]],
 ['/bg-deps.mjs',['text/javascript',deps]],['/bg-ui.mjs',['text/javascript',ui]],
 ['/bg-labels.mjs',['text/javascript',"export const t=k=>k;export const loadLanguage=async()=>{};"]],
 ['/bg-policy.mjs',['text/javascript','export const generateSecurePassword=()=>"";export const bindPasswordChecklist=()=>()=>{};']],
 ['/home_page.html',['text/html',childHtml]],['/dati_azienda.html',['text/html',childHtml]]
]);
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://fixture.invalid').pathname;
 let[type,body]=pathname==='/bg-child.mjs'?['text/javascript',childModule()]:(routes.get(pathname)||[]);
 if(!body){const file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep))throw Error('DENIED');body=await readFile(file);type=file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/javascript';}
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(404);res.end();}});
let base,browser;
test.before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({channel:'chrome',headless:true});});
test.after(async()=>{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));});
async function snapshot(page){const parentState=await page.evaluate(()=>({keyPresent:bgOwner.session.state().unlocked,parentMaterial:bgParent.material,childInit:bgParent.childInit,childReads:bgParent.childReads,childWaitError:bgParent.childWaitError,
 modalOpen:!!document.querySelector('#protocol-input-modal'),statusVisible:!document.querySelector('#frame-status').hidden,
 framePresent:!!document.querySelector('iframe'),frameVisible:document.querySelector('iframe')?.style.visibility==='visible',frameInert:document.querySelector('iframe')?.inert,codes:bgParent.codes}));
 const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());return {...parentState,child:frame?await frame.evaluate(()=>window.bgState?.()).catch(()=>null):null};}
async function visibility(page,hidden,order){const frame=page.frames().find(f=>f.parentFrame()===page.mainFrame());
 for(const target of [page,frame])await target.evaluate(hidden=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:hidden});Object.defineProperty(document,'visibilityState',{configurable:true,value:hidden?'hidden':'visible'});
 },hidden);
 for(const target of (order==='child-first'?[frame,page]:[page,frame]))await target.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
}
for(const outcome of ['success','parent-first','child-first'])test('private entry interrupted untouched modal '+outcome,{timeout:15000},async()=>{
  const context=await browser.newContext({viewport:{width:393,height:852}}),page=await context.newPage(),errors=[];
  await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(base+'/app.html?route='+encodeURIComponent('/dati_azienda.html?id=QA_COMPANY_001'));
   await page.locator('#protocol-input-modal.active').waitFor({timeout:6000});
   assert.equal(await page.locator('#protocol-input-modal-input').inputValue(),'');
   const before=await snapshot(page);assert.equal(before.keyPresent,false);assert.equal(before.child?.init,0);assert.equal(before.childInit,0);assert.equal(before.childReads,0);assert.equal(before.child?.value,'');
   if(outcome==='success'){
    await page.locator('#protocol-input-modal-input').fill('SYNTHETIC-PASSWORD-ONLY');await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.bgState?.().done,null,{timeout:6000});
    const after=await snapshot(page);assert.equal(after.keyPresent,true);assert.equal(after.child.materialPresent,true);assert.equal(after.child.init,1);assert.equal(after.childInit,1);assert.equal(after.childReads,1);
    assert.equal(after.child.reads,1);assert.equal(after.frameVisible,true);assert.equal(after.frameInert,false);
   }else{
    await visibility(page,true,outcome);
    await page.locator('#protocol-input-modal').waitFor({state:'detached',timeout:6000});
    await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow?.bgState?.().done||!document.querySelector('iframe'),null,{timeout:6000});
    // No user input or approval was sent in either negative case.
    await page.waitForFunction(()=>!document.querySelector('iframe')&&!document.querySelector('#frame-status').hidden,null,{timeout:6000});
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    const after=await snapshot(page);assert.equal(after.keyPresent,false);assert.equal(after.parentMaterial,false);assert.equal(after.modalOpen,false);assert.equal(after.childWaitError,'FRAME_HIDDEN');
    assert.equal(after.framePresent,false);assert.equal(after.statusVisible,true);assert.equal(after.childInit,0);assert.equal(after.childReads,0);
    assert.equal(await page.locator('#frame-resume').isVisible(),true);
   }
   assert.deepEqual(errors,[],'no unrelated page errors');
  }finally{await context.close();}
});
