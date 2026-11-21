import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTourHarness} from '../scripts/lib/view-tour-harness.mjs';

const shell=(await readFile(new URL('../Frontend/public/app.html',import.meta.url),'utf8'))
 .replace(/<script\b[\s\S]*?<\/script>/gi,'')
 .replace('</body>','<script type="module" src="/__back-parent.mjs"></script></body>');
const parentModule=`
import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
import {APP_VERSION} from '/assets/js/app-env.js';
document.body.hidden=false;document.body.inert=false;document.querySelector('#frame-loading').hidden=true;
window.backProbe={id:crypto.randomUUID(),unlocks:0,clears:0,locks:[]};
sessionStorage.setItem('back-owner-loads',String(Number(sessionStorage.getItem('back-owner-loads')||0)+1));
const iframe=document.querySelector('#vault-frame');
window.backOwner=createVaultFrameOwner({window,iframe,release:APP_VERSION,
 getIdentity:()=>({uid:'synthetic-local-only',epoch:'1:fence'}),validateIdentity:async()=>true,
 readPermit:async()=>({enabled:true,uid:'synthetic-local-only',version:1,expiresAt:Date.now()+3600000}),
 readTimeout:async()=>720,unlock:async()=>{backProbe.unlocks++;return 'SYNTHETIC-MATERIAL';},
 clearMaterial:()=>backProbe.clears++,confirmSensitive:async()=>true,
 onState:s=>{if(s.locked)backProbe.locks.push(s.reason);}});
iframe.addEventListener('load',()=>iframe.contentWindow?.postMessage('view-tour-frame-loaded',location.origin));
await backOwner.start(new URL(location.href).searchParams.get('route')||'/home_page.html');window.backStarted=true;`;
let harness;
test.before(async()=>{harness=await createTourHarness({memory:true,frameIntegration:true,localFixtures:{
 '/app.html':{type:'text/html',body:shell},'/__back-parent.mjs':{type:'text/javascript',body:parentModule},
 '/login.html':{type:'text/html',body:'<!doctype html><title>Local synthetic login predecessor</title>'}
}});});
test.after(async()=>{await harness?.close();});
const child=f=>f.page.frames().find(frame=>frame.parentFrame()===f.page.mainFrame());
async function ready(f,file){
 try{
  await f.page.waitForFunction(file=>{
   const iframe=document.querySelector('#vault-frame'),win=iframe?.contentWindow;
   const outer=new URL(location.href),actual=win?win.location.pathname+win.location.search+win.location.hash:null;
   return outer.pathname==='/app.html'&&outer.searchParams.get('route')===actual&&!!window.backStarted&&iframe?.style.visibility==='visible'&&win?.location.pathname==='/'+file&&win?.__viewTour?.ready;
  },file,{timeout:10000});
  assert.equal(await child(f).evaluate(()=>window.__viewTour?.bootError),undefined,'real page boot must succeed before the navigation assertion');
 }catch(error){
  const actual=await f.page.evaluate(()=>({path:location.pathname,probe:window.backProbe,
   frame:document.querySelector('iframe')?.contentWindow?.location.pathname,
   bootError:document.querySelector('iframe')?.contentWindow?.__viewTour?.bootError})).catch(()=>({gone:true}));
  assert.fail('Real header return must retain the frame at '+file+': '+JSON.stringify(actual)+'; '+error.message);
 }
}
async function fixture(initial='home_page.html'){
 const f=await harness.open('home_page.html',{graphics:'tre-livelli',theme:'light',palette:'lavender'});
 try{
  await f.page.goto(harness.base+'/login.html');
  await f.page.goto(harness.base+'/app.html?route='+encodeURIComponent('/'+initial));
  await ready(f,initial.split(/[?#]/)[0]);
  f.ownerId=await f.page.evaluate(()=>backProbe.id);
  return f;
 }catch(error){await f.context.close();throw error;}
}
async function intact(f){
 const value=await f.page.evaluate(()=>({id:window.backProbe?.id,unlocks:window.backProbe?.unlocks,
  clears:window.backProbe?.clears,locks:window.backProbe?.locks,loads:sessionStorage.getItem('back-owner-loads'),
  errors:document.querySelector('iframe')?.contentWindow?.__viewTour?.errors}));
 assert.equal(value.id,f.ownerId,'same parent document');assert.equal(value.loads,'1','no parent reload');
 assert.equal(value.unlocks,1,'one unlock for the whole owner');assert.equal(value.clears,0);assert.deepEqual(value.locks,[]);
 assert.deepEqual(value.errors,[],'no asynchronous child errors');
}
const back=f=>child(f).locator('#header-left button.btn-icon-header').click();

async function companyDetail(f,view=''){
 await child(f).locator('a[href="lista_aziende.html"]').click();await ready(f,'lista_aziende.html');
 const company=child(f).locator('.azienda-card').filter({hasText:'Azienda inventata 0'});
 if(view)await company.locator('.btn-company-account-mode.mode-'+view).click();
 else await company.locator('.card-name').click();
 await ready(f,'account_azienda.html');const listUrl=child(f).url();
 assert.equal(new URL(listUrl).searchParams.get('id'),'doc-0');
 assert.equal(new URL(listUrl).searchParams.get('type'),view||null);
 // Distinct Account/company IDs catch accidental interchange of query fields.
 await child(f).locator('#accounts-container .account-card[data-id="doc-1"] .account-card-title').click();
 await ready(f,'dettaglio_account_azienda.html');const detailUrl=child(f).url();
 assert.equal(new URL(detailUrl).searchParams.get('id'),'doc-1');
 assert.equal(new URL(detailUrl).searchParams.get('aziendaId'),'doc-0');
 assert.equal(await child(f).locator('#detail-nomeAccount').inputValue(),'Account sintetico 1');
 assert.equal(await child(f).locator('#btn-edit-footer').count(),1);await intact(f);
 return {listUrl,detailUrl};
}

for(const view of ['', 'standard'])test('real company '+(view||'name')+' Back returns to the exact Account list before companies',{timeout:60000},async()=>{
 const f=await fixture();
 try{
  const {listUrl}=await companyDetail(f,view);
  await back(f);await ready(f,'account_azienda.html');assert.equal(child(f).url(),listUrl);
  assert.equal(await child(f).locator('#accounts-container .account-card[data-id="doc-1"]').count(),1);await intact(f);
  await back(f);await ready(f,'lista_aziende.html');await intact(f);
  await f.page.goForward();await ready(f,'account_azienda.html');assert.equal(child(f).url(),listUrl);await intact(f);
  await back(f);await ready(f,'lista_aziende.html');await intact(f);
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

test('real company edit Back returns to detail and keeps the filtered Account list',{timeout:60000},async()=>{
 const f=await fixture();
 try{
  const {listUrl,detailUrl}=await companyDetail(f,'standard');
  await child(f).locator('#btn-edit-footer').click();await ready(f,'form_account_azienda.html');
  assert.equal(await child(f).locator('#account-name').inputValue(),'Account sintetico 1');
  await back(f);await ready(f,'dettaglio_account_azienda.html');assert.equal(child(f).url(),detailUrl);await intact(f);
  await back(f);await ready(f,'account_azienda.html');assert.equal(child(f).url(),listUrl);await intact(f);
 }finally{await f.context.close();}
});

test('real standalone company Back preserves the filtered Account list',{timeout:45000},async()=>{
 const f=await harness.open('lista_aziende.html');
 const wait=async file=>{await f.page.waitForFunction(file=>location.pathname==='/'+file&&window.__viewTour?.ready,file);assert.equal(await f.page.evaluate(()=>window.__viewTour.bootError),undefined);};
 try{
  await f.page.locator('.azienda-card').filter({hasText:'Azienda inventata 0'}).locator('.btn-company-account-mode.mode-standard').click();
  await wait('account_azienda.html');const listUrl=f.page.url();
  await f.page.locator('#accounts-container .account-card[data-id="doc-1"] .account-card-title').click();await wait('dettaglio_account_azienda.html');
  assert.equal(await f.page.locator('#detail-nomeAccount').inputValue(),'Account sintetico 1');
  await f.page.locator('#header-left button.btn-icon-header').click();await f.page.waitForURL(listUrl);await wait('account_azienda.html');
 }finally{await f.context.close();}
});

for(const [route,expected]of [
 ['dettaglio_account_azienda.html?id=doc-1&aziendaId=doc-0','account_azienda.html?id=doc-0'],
 ['form_account_azienda.html?id=doc-1&aziendaId=doc-0','dettaglio_account_azienda.html?id=doc-1&aziendaId=doc-0'],
 ['form_account_azienda.html?aziendaId=doc-0','account_azienda.html?id=doc-0']
])test('direct company '+route+' Back uses the correct hierarchical parent',{timeout:45000},async()=>{
 const f=await fixture(route);
 try{
  await back(f);await ready(f,expected.split('?')[0]);
  assert.equal(child(f).url(),harness.base+'/'+expected);await intact(f);
 }finally{await f.context.close();}
});

test('real deadline rules Back returns to Settings rather than matching the Scadenze root',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('a[href="impostazioni.html"]').click();await ready(f,'impostazioni.html');
  await child(f).locator('#btn-expiry-rules').click();await ready(f,'regole_scadenze.html');
  await back(f);await ready(f,'impostazioni.html');await intact(f);
 }finally{await f.context.close();}
});

test('direct deadline rules Back uses Settings as its hierarchical parent',{timeout:45000},async()=>{
 const f=await fixture('regole_scadenze.html');
 try{await back(f);await ready(f,'impostazioni.html');await intact(f);}finally{await f.context.close();}
});

for(const [filter,id]of [['in_scadenza','doc-1'],['urgenti','doc-0']])test('real deadline list '+filter+' Back retains its filter and returns straight to Home',{timeout:60000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('a[href="scadenze.html?filter='+filter+'"]').click();await ready(f,'scadenze.html');
  const listUrl=child(f).url();
  const activeChip=filter==='urgenti'?'urgent':'expiring';
  assert.equal(await child(f).locator('.filter-chip.active').getAttribute('data-filter'),activeChip);
  await child(f).locator('#scadenze-list .deadline-card[data-id="'+id+'"] .deadline-card-title').click();
  await ready(f,'dettaglio_scadenza.html');assert.equal(new URL(child(f).url()).searchParams.get('id'),id);await intact(f);
  await back(f);await ready(f,'scadenze.html');assert.equal(child(f).url(),listUrl);
  assert.equal(await child(f).locator('.filter-chip.active').getAttribute('data-filter'),activeChip);await intact(f);
  await f.page.goForward();await ready(f,'dettaglio_scadenza.html');await intact(f);
  await back(f);await ready(f,'scadenze.html');assert.equal(child(f).url(),listUrl);await intact(f);
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

test('real deadline list rule Back retains the canonical list query',{timeout:60000},async()=>{
 const f=await fixture('scadenze.html?rule=Documento');
 try{
  const listUrl=child(f).url();
  await child(f).locator('#scadenze-list .deadline-card[data-id="doc-0"] .deadline-card-title').click();
  await ready(f,'dettaglio_scadenza.html');await back(f);await ready(f,'scadenze.html');
  assert.equal(child(f).url(),listUrl);assert.equal(await child(f).locator('#deadline-search').inputValue(),'Documento');await intact(f);
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

const selectedDeadlineFilters=[
 ['all',null,'doc-0'],['urgent','urgenti','doc-0'],
 ['expiring','in_scadenza','doc-1'],['completed','archiviate','doc-3']
];
for(const framed of [true,false])for(const entry of ['in_scadenza','urgenti'])for(const [selected,query,id]of selectedDeadlineFilters)
test('selected '+selected+' deadline from '+entry+' returns from new form and detail to the selected list in '+(framed?'frame':'standalone'),{timeout:60000},async()=>{
 const f=framed?await fixture():await harness.open('home_page.html');
 const view=()=>framed?child(f):f.page;
 const wait=async file=>{if(framed)return ready(f,file);await f.page.waitForFunction(file=>location.pathname==='/'+file&&window.__viewTour?.ready,file);assert.equal(await f.page.evaluate(()=>window.__viewTour.bootError),undefined);};
 try{
  await view().locator('a[href="scadenze.html?filter='+entry+'"]').click();await wait('scadenze.html');
  const marker=await view().evaluate(()=>window.selectedFilterProbe=crypto.randomUUID()),length=await f.page.evaluate(()=>history.length);
  await view().locator('.filter-chip[data-filter="'+selected+'"]').click();
  assert.equal(await view().evaluate(()=>window.selectedFilterProbe),marker,'selecting a filter must keep the list document');
  assert.equal(await f.page.evaluate(()=>history.length),length,'selecting a filter must not push an intermediate history entry');
  assert.equal(await view().locator('.filter-chip.active').getAttribute('data-filter'),selected);
  const listUrl=view().url();
  const writesBefore=await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0));
  await view().locator('#footer-center-actions .btn-fab-scadenza').click();await wait('aggiungi_scadenza.html');
  if(framed)await intact(f);
  await view().locator('#header-left button.btn-icon-header').click();await wait('scadenze.html');
  assert.equal(view().url(),listUrl,'Back from a blank new deadline must retain the exact list query');
  assert.equal(await view().locator('.filter-chip.active').getAttribute('data-filter'),selected,'Back from a blank new deadline must retain the selected filter');
  assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0)),writesBefore,'opening and leaving a blank form must not write records');
  if(framed)await intact(f);
  await view().locator('#scadenze-list .deadline-card[data-id="'+id+'"] .deadline-card-title').click();await wait('dettaglio_scadenza.html');
  assert.equal(new URL(view().url()).searchParams.get('id'),id);
  await view().locator('#header-left button.btn-icon-header').click();await wait('scadenze.html');
  assert.equal(await view().locator('.filter-chip.active').getAttribute('data-filter'),selected,'Back must restore the manually selected filter');
  assert.equal(await view().locator('#scadenze-list .deadline-card[data-id="'+id+'"]').count(),1);
  assert.equal(new URL(view().url()).searchParams.get('filter'),query);
  assert.equal(await view().locator('#scadenze-list .deadline-card[data-id="'+id+'"]').getAttribute('data-archived'),String(selected==='completed'));
  if(framed)await intact(f);
  await view().locator('#header-left button.btn-icon-header').click();await wait('home_page.html');if(framed)await intact(f);
 }finally{await f.context.close();}
});

test('deadline card navigation respects its inactive-list guard',{timeout:45000},async()=>{
 const f=await fixture('scadenze.html?filter=urgenti');
 try{
  const before=child(f).url();
  await f.page.evaluate(()=>{
   const nav=window.vaultFrameNavigation;backProbe.navigations=0;
   window.vaultFrameNavigation={...nav,navigateFromChild(...args){backProbe.navigations++;return nav.navigateFromChild(...args);}};
  });
  await child(f).evaluate(()=>{window.__viewTourUser.uid='synthetic-inactive-list';document.querySelector('#scadenze-list .deadline-card .deadline-card-title').click();});
  assert.equal(await f.page.evaluate(()=>backProbe.navigations),0,'inactive card must not delegate a second navigation');
  assert.equal(child(f).url(),before);await intact(f);
 }finally{await f.context.close();}
});

test('selected deadline filter preserves the rule through new form and detail Back',{timeout:45000},async()=>{
 const f=await fixture('scadenze.html?rule=Documento');
 try{
  await child(f).locator('.filter-chip[data-filter="completed"]').click();
  assert.equal(new URL(child(f).url()).searchParams.get('rule'),'Documento');
  assert.equal(await child(f).locator('#deadline-search').inputValue(),'Documento');
  const listUrl=child(f).url();
  await child(f).locator('#footer-center-actions .btn-fab-scadenza').click();await ready(f,'aggiungi_scadenza.html');await intact(f);
  await back(f);await ready(f,'scadenze.html');
  assert.equal(child(f).url(),listUrl);
  assert.equal(await child(f).locator('.filter-chip.active').getAttribute('data-filter'),'completed');
  assert.equal(await child(f).locator('#deadline-search').inputValue(),'Documento');await intact(f);
  await child(f).locator('#scadenze-list .deadline-card[data-id="doc-3"] .deadline-card-title').click();await ready(f,'dettaglio_scadenza.html');
  await back(f);await ready(f,'scadenze.html');
  assert.equal(await child(f).locator('.filter-chip.active').getAttribute('data-filter'),'completed');
  assert.equal(new URL(child(f).url()).searchParams.get('rule'),'Documento');
  assert.equal(await child(f).locator('#deadline-search').inputValue(),'Documento');await intact(f);
 }finally{await f.context.close();}
});

test('selected deadline filter leaves the current free-text search usable',{timeout:45000},async()=>{
 const f=await fixture('scadenze.html?filter=in_scadenza');
 try{
  await child(f).locator('#deadline-search').fill('Scadenza sintetica');
  await child(f).locator('.filter-chip[data-filter="completed"]').click();
  assert.equal(await child(f).locator('#deadline-search').inputValue(),'Scadenza sintetica');
  assert.equal(await child(f).locator('#scadenze-list .deadline-card[data-id="doc-3"]').count(),1);await intact(f);
 }finally{await f.context.close();}
});

for(const fault of ['inactive','unknown'])test('selected deadline filter ignores '+fault+' chip callbacks',{timeout:45000},async()=>{
 const f=await fixture('scadenze.html?filter=in_scadenza');
 try{
  const before={url:child(f).url(),filter:await child(f).locator('.filter-chip.active').getAttribute('data-filter')};
  await child(f).evaluate(fault=>{
   const button=document.querySelector('.filter-chip[data-filter="completed"]');
   if(fault==='inactive')window.__viewTourUser.uid='synthetic-inactive-list';
   else button.dataset.filter='__proto__';
   button.click();
  },fault);
  assert.equal(child(f).url(),before.url);
  assert.equal(await child(f).locator('.filter-chip.active').getAttribute('data-filter'),before.filter);await intact(f);
 }finally{await f.context.close();}
});

for(const initial of ['dettaglio_scadenza.html?id=doc-0','home_page.html'])test('deadline detail from '+initial+' uses the canonical list without returning directly Home',{timeout:45000},async()=>{
 const f=await fixture(initial);
 try{
  if(initial==='home_page.html'){
   await f.page.evaluate(()=>{const frame=document.querySelector('iframe');window.vaultFrameNavigation.navigateFromChild(frame.contentWindow,frame.contentDocument,'/dettaglio_scadenza.html?id=doc-0');});
   await ready(f,'dettaglio_scadenza.html');
  }
  await back(f);await ready(f,'scadenze.html');assert.equal(new URL(child(f).url()).search,'');await intact(f);
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

test('forced deadline Back honors an explicitly different list filter',{timeout:45000},async()=>{
 const f=await fixture('scadenze.html?filter=urgenti');
 try{
  await child(f).locator('#scadenze-list .deadline-card[data-id="doc-0"] .deadline-card-title').click();await ready(f,'dettaglio_scadenza.html');
  await f.page.evaluate(()=>{const frame=document.querySelector('iframe');window.vaultFrameNavigation.backFromChild(frame.contentWindow,frame.contentDocument,'/scadenze.html?filter=in_scadenza',false);});
  await ready(f,'scadenze.html');assert.equal(new URL(child(f).url()).search,'?filter=in_scadenza');await intact(f);
 }finally{await f.context.close();}
});

test('a non-deadline detail cannot restore the filter of a forced canonical target',{timeout:45000},async()=>{
 const f=await fixture('scadenze.html?filter=urgenti');
 try{
  await child(f).locator('a[href="impostazioni.html"]').click();await ready(f,'impostazioni.html');
  await f.page.evaluate(()=>{const frame=document.querySelector('iframe');window.vaultFrameNavigation.backFromChild(frame.contentWindow,frame.contentDocument,'/scadenze.html',false);});
  await ready(f,'scadenze.html');assert.equal(new URL(child(f).url()).search,'');await intact(f);
 }finally{await f.context.close();}
});

for(const filter of ['in_scadenza','urgenti'])test('real standalone deadline '+filter+' Back retains its list',{timeout:45000},async()=>{
 const f=await harness.open('home_page.html');
 const wait=async file=>{await f.page.waitForFunction(file=>location.pathname==='/'+file&&window.__viewTour?.ready,file);assert.equal(await f.page.evaluate(()=>window.__viewTour.bootError),undefined);};
 try{
  await f.page.locator('a[href="scadenze.html?filter='+filter+'"]').click();await wait('scadenze.html');const listUrl=f.page.url();
  await f.page.locator('#scadenze-list .deadline-card[data-id="'+(filter==='urgenti'?'doc-0':'doc-1')+'"] .deadline-card-title').click();await wait('dettaglio_scadenza.html');
  await f.page.locator('#header-left button.btn-icon-header').click();await wait('scadenze.html');assert.equal(f.page.url(),listUrl);
  await f.page.locator('#header-left button.btn-icon-header').click();await wait('home_page.html');
 }finally{await f.context.close();}
});

test('forced Back does not traverse a verified previous page with a different target',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
  await f.page.evaluate(()=>{const frame=document.querySelector('iframe');
   window.vaultFrameNavigation.backFromChild(frame.contentWindow,frame.contentDocument,'/impostazioni.html',false);});
  await ready(f,'impostazioni.html');await intact(f);
 }finally{await f.context.close();}
});

test('forced Back does not treat a different list filter as the same previous target',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await companyDetail(f,'standard');
  await f.page.evaluate(()=>{const frame=document.querySelector('iframe');
   window.vaultFrameNavigation.backFromChild(frame.contentWindow,frame.contentDocument,'/account_azienda.html?id=doc-0&type=memo',false);});
  await ready(f,'account_azienda.html');
  assert.equal(new URL(child(f).url()).search,'?id=doc-0&type=memo');await intact(f);
 }finally{await f.context.close();}
});

test('real header and cleanup: repeated Profile tab returns keep one unlock and the parent',{timeout:90000},async()=>{
 const f=await fixture();
 try{
  for(let i=0;i<3;i++){
   await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
   await child(f).locator('#profile-tab-personal').click();await child(f).locator('#profile-tab-addresses').click();
   await f.page.setViewportSize({width:852,height:393});await f.page.setViewportSize({width:393,height:852});
   await back(f);await ready(f,'home_page.html');await intact(f);
  }
 }finally{await f.context.close();}
});

test('Profile entered directly falls back inside the owner instead of its login predecessor',{timeout:45000},async()=>{
 const f=await fixture('profilo_privato.html');
 try{await back(f);await ready(f,'home_page.html');await intact(f);}finally{await f.context.close();}
});

test('real Settings entry retains the previous route, query, fragment and browser Forward/Back',{timeout:60000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('a[href="area_privata.html"]').click();await ready(f,'area_privata.html');
  await child(f).locator('a[href="impostazioni.html"]').click();await ready(f,'impostazioni.html');
  await child(f).locator('#digital-card-settings-link').click();await ready(f,'profilo_privato.html');
  assert.equal(await child(f).locator('#profile-tab-digital-card').getAttribute('aria-selected'),'true');
  await child(f).evaluate(()=>history.replaceState(null,'',location.pathname+location.search+'#documenti-view-container'));
  await back(f);await ready(f,'impostazioni.html');await intact(f);
  await f.page.goForward();await ready(f,'profilo_privato.html');
  const route=await child(f).evaluate(()=>location.search+location.hash);
  assert.ok(route.includes('profileTab=digital-card'));assert.ok(route.endsWith('#documenti-view-container'));
  await f.page.goBack();await ready(f,'impostazioni.html');await intact(f);
  await back(f);await ready(f,'area_privata.html');await intact(f);
 }finally{await f.context.close();}
});

for(const direct of [false,true])test('real standalone header with cleanup preserves '+(direct?'hierarchical fallback':'internal previous page'),{timeout:45000},async()=>{
 const f=await harness.open('home_page.html');
 try{
  const expected=direct?harness.base+'/home_page.html':f.page.url();
  if(direct){await f.page.goto(harness.base+'/login.html');await f.page.goto(harness.base+'/profilo_privato.html');}
  else await f.page.locator('.header-greeting-trigger').click();
  await f.page.waitForFunction(()=>location.pathname==='/profilo_privato.html'&&window.__viewTour?.ready);
  await f.page.locator('#header-left button.btn-icon-header').click();
  await f.page.waitForURL(expected);
  await f.page.waitForFunction(()=>window.__viewTour?.ready);
  assert.equal(new URL(f.page.url()).pathname,'/home_page.html');
 }finally{await f.context.close();}
});

test('unrecognized owner history falls back inside the frame',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('a[href="impostazioni.html"]').click();await ready(f,'impostazioni.html');
  await child(f).locator('#digital-card-settings-link').click();await ready(f,'profilo_privato.html');
  await f.page.evaluate(()=>history.replaceState({frameNavigationOwner:'unrecognized',frameNavigationEntry:1},'',location.href));
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

test('duplicate Back requests are consumed while the real traversal is pending',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
  const accepted=await f.page.evaluate(()=>{const frame=document.querySelector('iframe'),nav=window.vaultFrameNavigation;
   return [nav.backFromChild(frame.contentWindow,frame.contentDocument,'/home_page.html',true),
    nav.backFromChild(frame.contentWindow,frame.contentDocument,'/home_page.html',true)];});
  assert.deepEqual(accepted,[true,true]);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

for(const failure of ['missing','throw'])test('Back has a finite in-frame fallback when traversal is '+failure,{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
  // Fault injection only in these two cases; ordinary path tests use native history.
  await f.page.evaluate(failure=>{history.back=()=>{if(failure==='throw')throw Error('SYNTHETIC_HISTORY_FAILURE');};},failure);
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

test('stale document, external fallback, logout hold and lock cannot reopen through Back',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await f.page.evaluate(()=>window.staleBackDocument=document.querySelector('iframe').contentDocument);
  await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
  const result=await f.page.evaluate(()=>{const frame=document.querySelector('iframe'),nav=window.vaultFrameNavigation;
   return {stale:nav.backFromChild(frame.contentWindow,staleBackDocument,'/home_page.html',true),
    external:nav.backFromChild(frame.contentWindow,frame.contentDocument,'https://example.invalid/',true)};});
  assert.deepEqual(result,{stale:false,external:true});await ready(f,'profilo_privato.html');await intact(f);
  await f.page.evaluate(()=>{const frame=document.querySelector('iframe');window.vaultFrameNavigation.beginLogoutFromChild(frame.contentWindow,frame.contentDocument);});
  await back(f);await ready(f,'profilo_privato.html');await intact(f);
  const locked=await f.page.evaluate(()=>{const frame=document.querySelector('iframe'),source=frame.contentWindow,doc=frame.contentDocument;
   backOwner.session.lock('synthetic-lock');
   return {accepted:window.vaultFrameNavigation.backFromChild(source,doc,'/home_page.html',true),
    unlocked:backOwner.session.state().unlocked,unlocks:backProbe.unlocks,clears:backProbe.clears};});
  // Logout deliberately retains the revoked child until cleanup; true consumes
  // its Back without reopening or granting anything.
  assert.deepEqual(locked,{accepted:true,unlocked:false,unlocks:1,clears:1});
 }finally{await f.context.close();}
});

test('an unheld lock removes the child and rejects its stale Back',{timeout:45000},async()=>{
 const f=await fixture('profilo_privato.html');
 try{
  const value=await f.page.evaluate(()=>{const frame=document.querySelector('iframe'),source=frame.contentWindow,doc=frame.contentDocument;
   backOwner.session.lock('synthetic-lock');
   return {accepted:window.vaultFrameNavigation.backFromChild(source,doc,'/home_page.html',true),
    unlocked:backOwner.session.state().unlocked,unlocks:backProbe.unlocks,clears:backProbe.clears,removed:!frame.isConnected};});
  assert.deepEqual(value,{accepted:false,unlocked:false,unlocks:1,clears:1,removed:true});
 }finally{await f.context.close();}
});

for(const method of ['push','hash','native'])test('unmanaged child '+method+' uses a safe in-frame Back fallback',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('a[href="area_privata.html"]').click();await ready(f,'area_privata.html');
  await child(f).locator('a[href="impostazioni.html"]').click();await ready(f,'impostazioni.html');
  await child(f).locator('#digital-card-settings-link').click();await ready(f,'profilo_privato.html');
  if(method==='push')await child(f).evaluate(()=>history.pushState(null,'',location.pathname+location.search+'#documenti-view-container'));
  else if(method==='hash')await child(f).evaluate(()=>{location.hash='documenti-view-container';});
  else {
   await child(f).evaluate(()=>{location.href='/profilo_privato.html?profileTab=personal';});
   await child(f).waitForURL(harness.base+'/profilo_privato.html?profileTab=personal');
  }
  await ready(f,'profilo_privato.html');
  if(method==='hash')await f.page.waitForFunction(()=>new URL(location.href).searchParams.get('route').endsWith('#documenti-view-container'));
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});
