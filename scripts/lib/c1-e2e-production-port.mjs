import {C1_ORIGIN} from './c1-e2e-execution.mjs';
import {fail,validateDiag,assertLoopback,authHttpFailureCode} from './c1-e2e-contract.mjs';

const routes=new Set(['home_page.html','area_privata.html','account_privati.html?type=standard',
 'profilo_privato.html','impostazioni.html','archivio_account.html','regole_scadenze.html',
 'gestione_destinatari.html','configurazione_documenti.html','scadenze.html?filter=in_scadenza']);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=30000;

// DOM-only observer: counts creation of secret dialogs, never reads input values.
// It does not stub Auth, App Check, network, key delivery, activity or clocks.
export function observeSecretPrompts({origin}){
 if(location.origin!==origin)return;
 let count=0;const seen=new WeakSet();
 Object.defineProperty(window,'__c1SecretPromptCount',{get:()=>count});
 const scan=node=>{
  if(node.nodeType!==1&&node.nodeType!==9)return;
  const inputs=[];
  if(node.matches?.('input[name="vault-local-secret"]'))inputs.push(node);
  inputs.push(...node.querySelectorAll('input[name="vault-local-secret"]'));
  for(const input of inputs)if(!seen.has(input)){seen.add(input);count++;}
 };
 new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);})
  .observe(document,{childList:true,subtree:true});
 scan(document);
}
export const createProductionPort=(page,config,secrets)=>createPort(page,config,secrets,C1_ORIGIN);
export async function createLocalFixturePort(page,config,secrets){
 const origin=assertLoopback(page.url()),context=page.context();
 if(context.serviceWorkers().length)fail('C1_LOCAL_ONLY');
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 return createPort(page,config,secrets,origin,3000);
}
async function createPort(page,config,secrets,origin,operationTimeout=timeout){
 const timeout=operationTimeout;
 let fatal=null,expectedCount=0,timerChanged=false,timerStartedAt=0,lastActivityAt=0,timerIdle=180000;
 const setFatal=code=>{fatal??=code;};
 page.on('pageerror',()=>setFatal('C1_RUNTIME_FAILURE'));
 page.on('console',message=>{if(message.type()==='error')setFatal('C1_RUNTIME_FAILURE');});
 page.on('response',response=>{if(response.status()===401||response.status()===403)setFatal(authHttpFailureCode(response.url()));
   else if(response.status()>=400)setFatal('C1_HTTP_FAILURE');});
 page.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')setFatal('C1_NETWORK_FAILURE');});
 page.on('dialog',dialog=>{setFatal('C1_MODAL_UNEXPECTED');void dialog.dismiss().catch(()=>{});});
 page.on('download',download=>{setFatal('C1_MODAL_UNEXPECTED');void download.cancel().catch(()=>{});});
 page.context().on('page',popup=>{if(popup!==page){setFatal('C1_MODAL_UNEXPECTED');void popup.close().catch(()=>{});}});
 await page.addInitScript(observeSecretPrompts,{origin});
 page.setDefaultTimeout(timeout);
 function checkpoint(){
  if(fatal)fail(fatal);
  let url;try{url=new URL(page.url());}catch{fail('C1_DESTINATION_WRONG');}
  if(url.origin!==origin)fail('C1_DESTINATION_WRONG');
 }
 const child=()=>page.frameLocator('#vault-frame');
 async function frame(){
  checkpoint();
  const element=await page.locator('#vault-frame').elementHandle();
  const result=await element?.contentFrame();await element?.dispose();
  if(!result||new URL(result.url()).origin!==origin)fail('C1_DESTINATION_WRONG');
  return result;
 }
 async function guardQa2({refresh=false,allowPending=false}={}){
  checkpoint();
  let result;
  try{
   result=await page.evaluate(async expected=>{
    const moduleUrl=new URL('/assets/js/firebase-config.js?v='+expected.version,location.origin).href;
    if(!performance.getEntriesByType('resource').some(entry=>entry.name===moduleUrl))return {ready:false};
    const {auth}=await import(moduleUrl),user=auth.currentUser;
    if(!user)return {ready:false};
    if(auth.app.options.projectId!=='appcodici-password'||user.uid!==expected.uid||
      user.email!==expected.email)return {ready:true,target:false};
    if(user.emailVerified!==true)return {ready:true,emailUnverified:true};
    const token=await user.getIdTokenResult(expected.refresh);
    return {ready:true,target:auth.currentUser===user&&user.uid===expected.uid&&
      user.email===expected.email&&user.emailVerified===true&&token.claims.vault_frame_canary===true};
   },{uid:secrets.uid,email:secrets.email,version:config.version,refresh});
  }catch{fail('C1_BOOTSTRAP_MISMATCH');}
  if(result?.ready!==true){if(allowPending)return false;fail('C1_AUTH_NOT_READY');}
  if(result.emailUnverified===true)fail('C1_AUTH_EMAIL_UNVERIFIED');
  if(result.target!==true)fail('C1_TARGET_DENIED');
  checkpoint();return true;
 }
 async function noUnexpectedMaster(){
  checkpoint();
  const count=await page.evaluate(()=>window.__c1SecretPromptCount);
  if(count!==expectedCount||await page.locator('input[name="vault-local-secret"]').isVisible())fail('C1_CONTINUITY_BROKEN');
  const f=await frame();
  if(await f.evaluate(()=>window.__c1SecretPromptCount!==0))fail('C1_CONTINUITY_BROKEN');
  const visibleDialog=()=>[...document.querySelectorAll('.modal-overlay,[role="dialog"],[role="alertdialog"]')]
   .some(node=>node.getClientRects().length&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden');
  if(await page.evaluate(visibleDialog)||await f.evaluate(visibleDialog))fail('C1_MODAL_UNEXPECTED');
 }
 async function assertUnlocked(target){
  checkpoint();
  if(!routes.has(target))fail('C1_OPTIONS_INVALID');
  if(new URL(page.url()).pathname!=='/app.html')fail('C1_DESTINATION_WRONG');
  const f=await frame();
  try{
   await f.waitForFunction(target=>{
    if(location.pathname+location.search+location.hash!=='/'+target||
       document.body.hidden||document.body.inert||document.documentElement.dataset.i18n!=='ready')return false;
    const visible=selector=>{const e=document.querySelector(selector);return !!e&&!!e.getClientRects().length;};
    const has=selector=>!!document.querySelector(selector);
    const text=selector=>(document.querySelector(selector)?.textContent||'').trim();
    const path=location.pathname;
    if(path==='/home_page.html')return visible('#header-user-avatar');
    if(path==='/area_privata.html')return /^\d+$/.test(text('#count-standard'));
    if(path==='/account_privati.html')return has('#accounts-container .account-card')&&!has('#accounts-container .loading-full-box');
    if(path==='/profilo_privato.html')return visible('#profile-tabs')&&text('#profile-overview').length>0;
    if(path==='/impostazioni.html')return visible('#btn-expiry-rules')&&has('#lock-timer-selector .timer-btn.active');
    if(path==='/regole_scadenze.html')return has('#personal-documents-summary[aria-busy="false"]');
    if(path==='/gestione_destinatari.html')return /^\d+$/.test(text('#recipient-count'))&&text('#recipient-list').length>0;
    if(path==='/archivio_account.html')return has('#accounts-container .archive-row-container, #accounts-container .ui-state-empty')&&!has('.ui-state-loading,.ui-state-error');
    if(path==='/scadenze.html')return has('#scadenze-list .deadline-card, #scadenze-list .archive-empty-state')&&!has('.archive-loading-container,.deadline-error-message');
    if(path==='/configurazione_documenti.html')return has('#container-types')&&has('#container-models')&&has('#container-templates');
    return false;
   },target,{timeout});
  }catch{fail('C1_READINESS');}
  try{await page.waitForFunction(target=>{
   const node=document.querySelector('#vault-frame');
   return !!node&&!node.hidden&&!node.inert&&getComputedStyle(node).visibility==='visible'&&
    new URL(location.href).searchParams.get('route')==='/'+target;
  },target,{timeout});}catch{await noUnexpectedMaster();fail('C1_DESTINATION_WRONG');}
  await noUnexpectedMaster();
 }
 async function currentRoute(){
  const f=await frame();
  const target=await f.evaluate(()=>location.pathname.slice(1)+location.search+location.hash);
  if(!routes.has(target))fail('C1_DESTINATION_WRONG');
  return target;
 }
 async function visit(selector,target){
  await noUnexpectedMaster();
  const locator=child().locator(selector);
  if(await locator.count()!==1)fail('C1_ROUTE_UNAVAILABLE');
  await locator.click();
  await assertUnlocked(target);
 }
 async function ensureHome(){
  if(await currentRoute()==='home_page.html'){await assertUnlocked('home_page.html');return;}
  await visit('#header-right a[href="home_page.html"]','home_page.html');
 }
 async function ensureSettings(){
  if(await currentRoute()==='impostazioni.html'){await assertUnlocked('impostazioni.html');return;}
  await ensureHome();
  await visit('#footer-settings-link a[href="impostazioni.html"]','impostazioni.html');
 }
 async function unlockExpectedOnce(){
  checkpoint();
  try{await page.locator('#protocol-input-modal-input').waitFor({state:'visible',timeout});}
  catch{fail('C1_UNLOCK_MISSING');}
  const valid=await page.locator('#protocol-input-modal').evaluate(modal=>
   modal.querySelector('input[name="vault-local-secret"]')?.id==='protocol-input-modal-input'&&
   modal.querySelector('.modal-title')?.textContent.trim().toUpperCase()==='SBLOCCO VAULT'&&window.__c1SecretPromptCount===1);
  if(!valid)fail('C1_MODAL_UNEXPECTED');
  const isolated=await page.locator('#vault-frame').evaluate(node=>node.inert===true);
  if(!isolated)fail('C1_MODAL_UNEXPECTED');
  await page.locator('#modal-confirm-btn').scrollIntoViewIfNeeded();
  const above=await page.locator('#protocol-input-modal').evaluate(modal=>{
   const r=modal.querySelector('#modal-confirm-btn').getBoundingClientRect();
   return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#protocol-input-modal')===modal;
  });
  if(!above)fail('C1_MODAL_UNEXPECTED');
  await page.locator('#modal-confirm-btn').focus();await page.keyboard.press('Tab');
  if(!await page.locator('#protocol-input-modal').evaluate(modal=>modal.contains(document.activeElement)))fail('C1_MODAL_UNEXPECTED');
  await page.locator('#protocol-input-modal-input').focus();await page.keyboard.press('Shift+Tab');
  if(!await page.locator('#protocol-input-modal').evaluate(modal=>modal.contains(document.activeElement)))fail('C1_MODAL_UNEXPECTED');
  await guardQa2(); // private target is checked immediately before the only submission
  checkpoint();
  const input=await page.locator('#protocol-input-modal-input').elementHandle();
  const confirm=await page.locator('#modal-confirm-btn').elementHandle();let submitted=false;
  try{
   if(!input||!confirm||!await input.evaluate(node=>node.isConnected&&window.__c1SecretPromptCount===1))fail('C1_MODAL_UNEXPECTED');
   await input.fill(secrets.master);
   await guardQa2();
   if(!await input.evaluate(node=>node.isConnected&&window.__c1SecretPromptCount===1))fail('C1_MODAL_UNEXPECTED');
   await confirm.click();submitted=true;
  }finally{
   if(!submitted)await input?.evaluate(node=>{if(node.isConnected)node.value='';}).catch(()=>{});
   await input?.dispose();await confirm?.dispose();
  }
  await page.locator('#protocol-input-modal-input').waitFor({state:'detached',timeout});
  expectedCount=1;
  const target=new URL(page.url()).searchParams.get('route');
  if(!target?.startsWith('/')||!routes.has(target.slice(1)))fail('C1_DESTINATION_WRONG');
  await assertUnlocked(target.slice(1));
 }
 async function collectDiag(){
  await ensureSettings();const f=await frame();let value;
  try{
   value=await f.evaluate(async()=>{
    const runtime=await(await import('/assets/js/frame-navigation.js')).loadFrameDiagnostics();
    if(!runtime.frameDiagnosticContext().ready)return null;
    const {inactivityDiagnosticTimeout}=await import('/assets/js/inactivity-timer.js');
    return runtime.frameDiagnosticReport({idleMs:inactivityDiagnosticTimeout(),pushReady:await runtime.notificationWorkerReady()});
   });
  }catch{fail('C1_DIAG_UNAVAILABLE');}
  if(!value)fail('C1_DIAG_UNAVAILABLE');
  const result=validateDiag(value);
  if(result.state.version!=='v'+config.version)fail('C1_RELEASE_MISMATCH');
  if(!result.enabled||!result.available||!result.state.active||!result.state.permitValid)fail('C1_DIAG_UNAVAILABLE');
  await noUnexpectedMaster();return result;
 }
 const port={
  timerRestoreRequired:()=>timerChanged,
  async start(){
   await page.goto(origin+'/login.html',{waitUntil:'domcontentloaded'});checkpoint();
   await page.locator('#email').fill(secrets.email);
   await page.locator('#password').fill(secrets.password);
   await page.locator('#remember-device').setChecked(false);
   await page.locator('#login-submit-btn').click(); // exactly one login attempt
   const deadline=Date.now()+timeout;let authenticated=false;
   while(Date.now()<deadline){
    checkpoint();
    if(await page.locator('#totp-form-group').isVisible()||await page.locator('#totp-code').isVisible())fail('C1_MFA_BLOCKED');
    if(await page.locator('#email-verification-panel').isVisible())fail('C1_AUTH_EMAIL_UNVERIFIED');
    if(['/home_page.html','/app.html'].includes(new URL(page.url()).pathname)){
     if(await guardQa2({refresh:true,allowPending:true})){authenticated=true;break;}
    }
    await delay(150);
   }
   if(!authenticated)fail('C1_AUTH_NOT_READY');
   await page.goto(origin+'/app.html?route=%2Fhome_page.html',{waitUntil:'domcontentloaded'});
   checkpoint();
   try{await page.locator('#protocol-input-modal-input').waitFor({state:'visible',timeout:Math.min(10000,timeout)});}
   catch{
    if(!await page.locator('#protocol-input-modal-input').isVisible()){
     if(!await page.locator('#frame-resume').isVisible())fail('C1_UNLOCK_MISSING');
     await Promise.all([page.waitForEvent('domcontentloaded',{timeout}),page.locator('#frame-resume').click()]);
    }
   }
   await unlockExpectedOnce();
   await ensureSettings();
   const toggle=child().locator('#frame-diagnostics-toggle');
   if(await toggle.isChecked())fail('C1_DIAG_UNAVAILABLE'); // fresh-context OFF is asserted
   await toggle.setChecked(true); // one explicit UI opt-in, never silently repeated after a cleanup
   return await collectDiag();
  },
  visit,ensureHome,ensureSettings,assertUnlocked,collectDiag,
  async hasDocumentConfigurationLink(){
   await noUnexpectedMaster();
   const count=await child().locator('a[href="configurazione_documenti.html"]').count();
   if(count>1)fail('C1_ROUTE_UNAVAILABLE');return count===1;
  },
  async back(target){await noUnexpectedMaster();await page.goBack({waitUntil:'domcontentloaded'});await assertUnlocked(target);},
  async forward(target){await noUnexpectedMaster();await page.goForward({waitUntil:'domcontentloaded'});await assertUnlocked(target);},
  async reloadExpectedOnce(){await noUnexpectedMaster();const target=await currentRoute();await page.reload({waitUntil:'domcontentloaded'});await unlockExpectedOnce();await assertUnlocked(target);},
  async idleMs(){return (await collectDiag()).state.idleMs;},
  async timerStart(minutes){
   await ensureHome();await ensureSettings(); // browser Back now has an explicit Home destination
   await child().locator('#toast.active').waitFor({state:'hidden',timeout});
   if(minutes!==3)timerChanged=true; // conservative until a confirmed restoration
   await child().locator('#lock-timer-selector .timer-btn[data-val="'+minutes+'"]').click();
   // This success toast is emitted only AFTER awaited updateDoc + preference sync.
   const f=await frame();
   try{await f.waitForFunction(async()=>{
    const {t}=await import('/assets/js/translations.js');
    return document.querySelector('#toast.active .toast-content > span:last-child')?.textContent===t('dyn_inactivity_updated');
   },null,{timeout});}catch{fail('C1_TIMEOUT_BASELINE');}
   const deadline=Date.now()+timeout;let saved=false;
   while(Date.now()<deadline){
    if((await collectDiag()).state.idleMs===minutes*60000){saved=true;break;}
    await delay(250);
   }
   if(!saved)fail('C1_TIMEOUT_BASELINE');
   if(minutes===3)timerChanged=false;
   timerIdle=minutes*60000;
   await delay(1200);await port.trustedActivity();timerStartedAt=Date.now();
  },
  async trustedActivity(){await noUnexpectedMaster();await child().locator('#lock-timer-selector .timer-btn.active').press('Shift');lastActivityAt=Date.now();},
  async wait(ms,{allowExpectedExpiry=false}={}){
   if(!Number.isFinite(ms)||ms<0||ms>200000)fail('C1_OPTIONS_INVALID');
   const deadline=Date.now()+ms;
   while(Date.now()<deadline){
    checkpoint();const locked=await port.isLocked();
    if(locked){
     if(!allowExpectedExpiry||Date.now()<lastActivityAt+timerIdle-1000)fail('C1_CONTINUITY_BROKEN');
    }else await noUnexpectedMaster();
    await delay(Math.min(250,Math.max(0,deadline-Date.now())));
   }
   checkpoint();
  },
  async passiveBack(){await noUnexpectedMaster();await page.goBack({waitUntil:'domcontentloaded'});await assertUnlocked('home_page.html');},
  async isLocked(){
   checkpoint();
   return await page.evaluate(()=>{
    const status=document.querySelector('#frame-status'),node=document.querySelector('#vault-frame');
    return !!status&&!status.hidden&&getComputedStyle(status).display!=='none'&&
      (!node||node.inert&&(node.hidden||getComputedStyle(node).visibility==='hidden'));
   });
  },
  async resumeExpectedOnce(){
   checkpoint();
   await Promise.all([page.waitForEvent('domcontentloaded',{timeout}),page.locator('#frame-resume').click()]);
   // resume intentionally reloads the owner; semantic Master and identity guard are rechecked.
   await unlockExpectedOnce();
   const diag=await collectDiag();
   if(!diag.events.some(event=>event.code==='LOCK_EXPIRED'&&event.at>=timerStartedAt))fail('C1_TIMEOUT_NOT_LOCKED');
  },
  async tryFailureDiag(){
   // Best effort on the existing child only: no navigation, retry, unlock or storage dump.
   const attempt=async()=>{try{
    if(new URL(page.url()).origin!==origin||new URL(page.url()).pathname!=='/app.html')return null;
    const element=await page.$('#vault-frame');
    const f=await element?.contentFrame();await element?.dispose();
    if(!f||new URL(f.url()).origin!==origin)return null;
    const value=await f.evaluate(async()=>{
     const runtime=await(await import('/assets/js/frame-navigation.js')).loadFrameDiagnostics();
     if(!runtime.frameDiagnosticContext().ready)return null;
     const {inactivityDiagnosticTimeout}=await import('/assets/js/inactivity-timer.js');
     return runtime.frameDiagnosticReport({idleMs:inactivityDiagnosticTimeout(),pushReady:await runtime.notificationWorkerReady()});
    });
    return value?validateDiag(value):null;
   }catch{return null;}};
   return Promise.race([attempt(),delay(2500).then(()=>null)]);
  },
  async logoutLocal(){
   await ensureHome();await child().locator('#header-logout-btn').click();
   await child().locator('#logout-modal-dynamic #btn-confirm-logout').click();
   try{await page.waitForURL(url=>url.origin===origin&&url.pathname==='/login.html',{timeout});}
   catch{fail('C1_LOGOUT_FAILED');}
   const cleared=await page.evaluate(()=>['app_frame_diag_consent_v1','app_frame_diag_events_v1'].every(key=>sessionStorage.getItem(key)===null));
   if(!cleared)fail('C1_LOGOUT_FAILED');
   await page.goBack({waitUntil:'domcontentloaded'});
   for(let i=0;i<20;i++){
    checkpoint();
    const blocked=await page.evaluate(()=>{
     if(location.pathname==='/login.html')return true;
     const frame=document.querySelector('#vault-frame');
     return document.body.hidden||document.body.inert||!!document.querySelector('input[name="vault-local-secret"]')||
      !!frame&&(frame.inert||frame.hidden||getComputedStyle(frame).visibility==='hidden');
    });
    if(!blocked)fail('C1_LOGOUT_FAILED');await delay(150);
   }
   checkpoint();
  }
 };
 return Object.freeze(port);
}
