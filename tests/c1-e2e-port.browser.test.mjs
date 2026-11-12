import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createLocalFixturePort} from '../scripts/lib/c1-e2e-production-port.mjs';
import {runPriorityC1} from '../scripts/lib/c1-e2e-priority.mjs';
import {assertCaseDiagnostics,browserEnvironment} from '../scripts/lib/c1-e2e-runner.mjs';

// Same port as the future production adapter; only the origin wrapper and 3s UI
// timeout differ. All Auth/admission/DIAG/UI content is synthetic; real owner and
// transport run on loopback. No production host is opened or contacted.
const authModule=`const user={uid:sessionStorage.getItem('fault')==='identity'?'other-fixture':'fixture-qa2-only',
 email:'codex.qa2@appcodici-password.invalid',emailVerified:true,
 getIdTokenResult:async()=>{
  const fault=sessionStorage.getItem('fault');
  if(fault==='identity-during-token'||fault==='identity-after-fill'&&document.querySelector('#protocol-input-modal-input')?.value.length>0)sessionStorage.removeItem('fixture-auth');
  return {claims:{vault_frame_canary:true}};
 }};
 export const auth={app:{options:{projectId:'appcodici-password'}},get currentUser(){
 return sessionStorage.getItem('fixture-auth')==='yes'?user:null;}};`;
const rootModule=`import {auth} from '/assets/js/firebase-config.js?v=1.2.270';
import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
import {beginFrameModalFocus} from '/assets/js/modules/core/frame-modal-focus.js';
const fault=sessionStorage.getItem('fault')||'';
if(location.pathname==='/login.html'){
 document.querySelector('#login-submit-btn').onclick=e=>{
  e.preventDefault();
  if(fault==='mfa'){document.querySelector('#totp-form-group').hidden=false;return;}
  sessionStorage.setItem('fixture-auth','yes');location.replace('/home_page.html');
 };
}else if(!auth.currentUser){location.replace('/login.html');}
else{
 document.body.hidden=false;document.body.inert=false;
 if(location.pathname==='/app.html'){
  const iframe=document.querySelector('#vault-frame'),status=document.querySelector('#frame-status');
  window.fixtureEvent=(code,page='app.html')=>{
   if(!sessionStorage.getItem('app_frame_diag_consent_v1'))return;
   const events=JSON.parse(sessionStorage.getItem('app_frame_diag_events_v1')||'[]');
   events.push({code,at:Date.now(),version:'v1.2.270',page,environment:'browser'});
   sessionStorage.setItem('app_frame_diag_events_v1',JSON.stringify(events.slice(-200)));
  };
  const unlock=()=>new Promise(resolve=>{
   const modal=document.createElement('div');modal.id='protocol-input-modal';
   modal.style='position:fixed;inset:0;background:white;z-index:999999';
   modal.innerHTML='<h3 class="modal-title">'+(fault==='semantic'?'CONFERMA MASTER PASSWORD':'SBLOCCO VAULT')+'</h3><input name="vault-local-secret" id="protocol-input-modal-input"><button id="modal-confirm-btn">Confirm</button>';
   document.body.append(modal);
   const focus=beginFrameModalFocus({modal,dialog:modal,onCancel:()=>{},window});
   modal.querySelector('button').onclick=()=>{
    sessionStorage.setItem('master-submits',String(Number(sessionStorage.getItem('master-submits')||0)+1));
    modal.remove();focus?.close();resolve('SYNTHETIC-MATERIAL');
   };
  });
  const owner=createVaultFrameOwner({window,iframe,release:'fixture',
   getIdentity:()=>({uid:'fixture-qa2-only',epoch:'1:fixture'}),
   readPermit:async()=>({enabled:true,uid:'fixture-qa2-only',version:1,expiresAt:Date.now()+3600000}),
   validateIdentity:async()=>true,readTimeout:async()=>Number(sessionStorage.getItem('fixture-timeout')||3),
   unlock,confirmSensitive:async()=>true,clearMaterial:()=>{},
   onDiagnostic:code=>window.fixtureEvent(code),onState:state=>{status.hidden=!state.locked;}});
  window.fixtureOwner=owner;
  document.querySelector('#frame-resume').onclick=e=>{e.preventDefault();owner.resume();};
  await owner.start(new URL(location.href).searchParams.get('route')||'/home_page.html');
 }
}`;
const childModule=`import {auth} from '/assets/js/firebase-config.js?v=1.2.270';
import {createFrameTransport} from '/assets/js/modules/core/vault-frame-transport.mjs';
const transport=createFrameTransport({window,release:'fixture',enabled:true});
if(parent!==window)await transport.request('key');
document.querySelectorAll('a').forEach(a=>a.onclick=e=>{
 e.preventDefault();const url=new URL(a.href);
 parent.vaultFrameNavigation.navigateFromChild(window,document,url.pathname+url.search,false);
});
const nav=(selector,url)=>document.querySelector(selector).onclick=()=>parent.vaultFrameNavigation.navigateFromChild(window,document,url,false);
nav('#header-user-avatar','/profilo_privato.html');nav('#header-left .btn-icon-header','/area_privata.html');
nav('#btn-expiry-rules','/regole_scadenze.html');nav('#btn-account-archive','/archivio_account.html');
document.querySelector('#frame-diagnostics-toggle').checked=!!sessionStorage.getItem('app_frame_diag_consent_v1');
document.querySelector('#frame-diagnostics-toggle').onchange=e=>{
 if(e.target.checked)sessionStorage.setItem('app_frame_diag_consent_v1','yes');
 else{sessionStorage.removeItem('app_frame_diag_consent_v1');sessionStorage.removeItem('app_frame_diag_events_v1');}
};
const minutes=Number(sessionStorage.getItem('fixture-timeout')||3);
document.querySelectorAll('.timer-btn').forEach(button=>{
 button.classList.toggle('active',Number(button.dataset.val)===minutes);
 button.onclick=()=>{
  document.querySelectorAll('.timer-btn').forEach(b=>b.classList.toggle('active',b===button));
  if(sessionStorage.getItem('fault')==='timer-write')return;
  sessionStorage.setItem('fixture-timeout',button.dataset.val);
  parent.fixtureOwner.updatePreference(Number(button.dataset.val));
  const toast=document.querySelector('#toast')||document.createElement('div');
  toast.id='toast';toast.className='active';
  toast.innerHTML='<div class="toast-content"><span>check_circle</span><span>Saved synthetic timeout</span></div>';
  document.body.append(toast);setTimeout(()=>toast.classList.remove('active'),300);
 };
});
document.querySelector('#header-logout-btn').onclick=()=>{
 const modal=document.createElement('div');modal.id='logout-modal-dynamic';
 modal.innerHTML='<button id="btn-confirm-logout">Confirm logout</button>';document.body.append(modal);
 modal.querySelector('button').onclick=()=>{
  sessionStorage.removeItem('fixture-auth');
  if(sessionStorage.getItem('fault')!=='retain-diag'){
   sessionStorage.removeItem('app_frame_diag_consent_v1');sessionStorage.removeItem('app_frame_diag_events_v1');
  }
  parent.location.replace('/login.html');
 };
};
addEventListener('pagehide',()=>parent.fixtureEvent?.('FRAME_EXIT',location.pathname.slice(1)),{once:true});`;
const diagModule=`export async function loadFrameDiagnostics(){return {
 frameDiagnosticContext:()=>({ready:true}),
 notificationWorkerReady:async()=>false,
 frameDiagnosticReport:()=>{
  const state=parent.vaultFrameNavigation.diagnosticsFromChild(window,document);
  return {state:{version:'v1.2.270',active:state.active,permitValid:state.permitValid,
   permitExpiresAt:state.permitExpiresAt,idleMs:state.idleMs,pushReady:false,lastBlock:state.lastBlock},
   enabled:!!sessionStorage.getItem('app_frame_diag_consent_v1'),available:true,
   events:JSON.parse(sessionStorage.getItem('app_frame_diag_events_v1')||'[]')};
 }};}`;
const rootHtml=login=>'<html data-i18n="ready"><head><link rel="stylesheet" href="/assets/css/vault-frame.css"><script type="module" src="/fixture-root.mjs"></script></head><body'+(login?'':' hidden inert')+'>'+
 (login?'<input id="email"><input id="password" type="password"><input id="remember-device" type="checkbox" checked><button id="login-submit-btn">Login</button><section id="totp-form-group" hidden><input id="totp-code"></section>':
 '<main id="frame-status"><a id="frame-resume">Unlock</a></main><div data-frame-safe-area class="frame-safe-area"></div><iframe id="vault-frame" class="vault-frame" hidden inert></iframe>')+'</body></html>';
const childHtml='<html data-i18n="ready"><head><script type="module" src="/fixture-child.mjs"></script></head><body><header id="header-left"><button class="btn-icon-header">Back</button></header>'+
 '<div id="header-right"><a href="home_page.html">Home</a></div><button id="header-user-avatar">Profile</button><button id="header-logout-btn">Logout</button>'+
 '<main><a href="area_privata.html">Private</a><a href="account_privati.html?type=standard">Accounts</a><a href="scadenze.html?filter=in_scadenza">Deadlines</a>'+
 '<div id="footer-settings-link"><a href="impostazioni.html">Settings</a></div><button id="btn-account-archive">Archive</button><button id="btn-expiry-rules">Rules</button>'+
 '<a href="gestione_destinatari.html">Recipients</a><span id="count-standard">1</span>'+
 '<div id="accounts-container"><article class="account-card archive-row-container">Synthetic card</article></div><div id="scadenze-list"><article class="deadline-card">Synthetic</article></div>'+
 '<nav id="profile-tabs">Tabs</nav><section id="profile-overview">Synthetic loaded profile</section><div id="personal-documents-summary" aria-busy="false"></div>'+
 '<div id="recipient-count">0</div><div id="recipient-list"><p class="recipient-card-email">Empty</p></div>'+
 '<div id="lock-timer-selector"><button class="timer-btn" data-val="1">1</button><button class="timer-btn" data-val="3">3</button></div>'+
 '<input id="frame-diagnostics-toggle" type="checkbox"></main></body></html>';
const privatePages=new Set(['area_privata.html','account_privati.html','profilo_privato.html','impostazioni.html','archivio_account.html','regole_scadenze.html','gestione_destinatari.html','configurazione_documenti.html','scadenze.html']);
let browser,server,base;
test.before(async()=>{
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://fixture.invalid'),path=url.pathname;
  try{
   let body,type='text/html';
   if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
   if(path==='/fixture-start.html')body='<script>sessionStorage.setItem("fault",new URL(location.href).searchParams.get("fault")||"")</script>';
   else if(path==='/login.html')body=rootHtml(true);
   else if(path==='/app.html')body=rootHtml(false);
   else if(path==='/home_page.html'||privatePages.has(path.slice(1)))body=childHtml;
   else if(path==='/fixture-root.mjs'){type='text/javascript';body=rootModule;}
   else if(path==='/fixture-child.mjs'){type='text/javascript';body=childModule;}
   else if(path==='/assets/js/firebase-config.js'){type='text/javascript';body=authModule;}
   else if(path==='/assets/js/frame-navigation.js'){type='text/javascript';body=diagModule;}
   else if(path==='/assets/js/inactivity-timer.js'){type='text/javascript';body='export const inactivityDiagnosticTimeout=()=>180000;';}
   else if(path==='/assets/js/translations.js'){type='text/javascript';body='export const t=()=> "Saved synthetic timeout";';}
   else if(/^\/assets\/js\/modules\/core\/vault-frame-[a-z-]+\.mjs$/.test(path)||
    path==='/assets/js/modules/core/frame-modal-focus.js'||path==='/assets/css/vault-frame.css'){
    type=path.endsWith('.css')?'text/css':'text/javascript';body=await readFile(new URL('../Frontend/public'+path,import.meta.url));
   }else{res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({channel:'chrome',headless:true,env:browserEnvironment(process.env)});
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function fixture(fault=''){
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();await page.goto(base+'/fixture-start.html?fault='+fault);
 const port=await createLocalFixturePort(page,{version:'1.2.270'},{
  uid:'fixture-qa2-only',email:'codex.qa2@appcodici-password.invalid',
  password:'Synthetic-login-only-123!',master:'Synthetic-master-only-456!'});
 return {page,context,port};
}
test('real local port drives setup + 9-page UI subset/history/reload, keeps absent configuration NE',async()=>{
 const f=await fixture();const rows=[];let startedAt=Date.now();
 try{
  await f.port.start();
  await assert.rejects(()=>runPriorityC1(f.port,async(id,status,code)=>{
   const diag=await f.port.collectDiag();assertCaseDiagnostics(id,diag,startedAt);
   rows.push({id,status,code});
   if(id==='D05-A')throw Error('LOCAL_TEST_COMPLETED');
  },()=>{startedAt=Date.now();}),/^Error: LOCAL_TEST_COMPLETED$/);
  assert.deepEqual(rows,[{id:'D02',status:'LIMITE',code:'C1_CONFIG_DOC_ROUTE_UNAVAILABLE'},
   {id:'D04-core',status:'PASS',code:null},{id:'D05-A',status:'PASS',code:null}]);
  assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('master-submits'))),2);
 }finally{await f.context.close();}
});
test('MFA, wrong identity and Master creation dialogs stop before any Master submission',async()=>{
 for(const [fault,code]of [['mfa','C1_MFA_BLOCKED'],['identity','C1_TARGET_DENIED'],['identity-during-token','C1_TARGET_DENIED'],['identity-after-fill','C1_TARGET_DENIED'],['semantic','C1_MODAL_UNEXPECTED']]){
  const f=await fixture(fault);
  try{
   await assert.rejects(()=>f.port.start(),new RegExp('^Error: '+code+'$'));
   assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('master-submits')||0)),0);
   if(fault==='identity-after-fill')assert.equal(await f.page.locator('#protocol-input-modal-input').evaluate(node=>node.value===''),true);
  }finally{await f.context.close();}
 }
});
test('DOM observers reject transient Master and unexpected non-secret dialogs without reading values',async()=>{
 for(const secret of [true,false]){
  const f=await fixture();
  try{
   await f.port.start();
   await f.page.evaluate(secret=>{
    const node=document.createElement(secret?'input':'div');
    if(secret)node.name='vault-local-secret';else{node.setAttribute('role','dialog');node.textContent='Synthetic unexpected dialog';}
    document.body.append(node);if(secret)node.remove();
   },secret);
   await assert.rejects(()=>f.port.assertUnlocked('impostazioni.html'),secret?/^Error: C1_CONTINUITY_BROKEN$/:/^Error: C1_MODAL_UNEXPECTED$/);
  }finally{await f.context.close();}
 }
});
test('timer preference needs owner diagnostic confirmation, restores 3 and handles removed iframe lock',async()=>{
 const f=await fixture();
 try{
  await f.port.start();await f.port.timerStart(1);assert.equal(await f.port.idleMs(),60000);
  assert.equal(f.port.timerRestoreRequired(),true);
  await f.port.timerStart(3);assert.equal(await f.port.idleMs(),180000);assert.equal(f.port.timerRestoreRequired(),false);
  await f.page.evaluate(()=>window.fixtureOwner.dispose());
  assert.equal(await f.port.isLocked(),true);assert.equal(await f.page.locator('#vault-frame').count(),0);
 }finally{await f.context.close();}
});
test('optimistic timer button alone is insufficient confirmation',async()=>{
 const f=await fixture('timer-write');
 try{
  await f.port.start();
  await assert.rejects(()=>f.port.timerStart(1),/^Error: C1_TIMEOUT_BASELINE$/);
  assert.equal(f.port.timerRestoreRequired(),true);
 }finally{await f.context.close();}
});
test('local logout clears DIAG and Back stays closed; retained DIAG fails',async()=>{
 for(const fault of ['', 'retain-diag']){
  const f=await fixture(fault);
  try{
   await f.port.start();
   if(fault)await assert.rejects(()=>f.port.logoutLocal(),/^Error: C1_LOGOUT_FAILED$/);
   else await f.port.logoutLocal();
  }finally{await f.context.close();}
 }
});
