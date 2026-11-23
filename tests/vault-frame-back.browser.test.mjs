import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTourHarness} from '../scripts/lib/view-tour-harness.mjs';

const rulesPaintHtml=(await readFile(new URL('../Frontend/public/regole_scadenze.html',import.meta.url),'utf8'))
 .replace('src="assets/js/main-v129.js"','src="/__rules-paint-entry.mjs"');

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
async function fixture(initial='home_page.html',options={}){
 const f=await harness.open('home_page.html',{graphics:'tre-livelli',theme:'light',palette:'lavender',...options});
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

for(const framed of [true,false])for(const entry of ['in_scadenza','urgenti'])for(const control of ['header','link'])
test('recipient return '+control+' from '+entry+' retains the full form-list-Home chain in '+(framed?'frame':'standalone'),{timeout:60000},async()=>{
 const f=framed?await fixture():await harness.open('home_page.html');
 const view=()=>framed?child(f):f.page;
 const wait=async file=>{if(framed)return ready(f,file);await f.page.waitForFunction(file=>location.pathname==='/'+file&&window.__viewTour?.ready,file,{timeout:10000});assert.equal(await f.page.evaluate(()=>window.__viewTour.bootError),undefined);};
 try{
  const writesBefore=await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0));
  await view().locator('a[href="scadenze.html?filter='+entry+'"]').click();await wait('scadenze.html');
  const listUrl=view().url(),selected=entry==='urgenti'?'urgent':'expiring';
  await view().locator('#footer-center-actions .btn-fab-scadenza').click();await wait('aggiungi_scadenza.html');
  const formUrl=view().url(),note='Bozza locale per il ritorno '+entry;
  await view().locator('#notes').fill(note);
  await view().locator('#btn-manage-deadline-contacts').click();await wait('gestione_destinatari.html');
  assert.equal(new URL(view().url()).searchParams.get('return'),new URL(formUrl).pathname.slice(1)+new URL(formUrl).search);
  await view().locator(control==='header'?'#header-left button.btn-icon-header':'#recipient-return').click();await wait('aggiungi_scadenza.html');
  assert.equal(view().url(),formUrl,'recipient return must restore the exact editor');
  assert.equal(await view().locator('#notes').inputValue(),note,'the owner-scoped draft must be restored');
  if(framed)await intact(f);
  await view().locator('#header-left button.btn-icon-header').click();await wait('scadenze.html');
  assert.equal(view().url(),listUrl,'the next Back must reach the originating list without another recipient/editor entry');
  assert.equal(await view().locator('.filter-chip.active').getAttribute('data-filter'),selected);
  await view().locator('#header-left button.btn-icon-header').click();await wait('home_page.html');
  if(framed)await intact(f);
  assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0)),writesBefore,'recipient navigation must not save records');
 }finally{await f.context.close();}
});

for(const framed of [true,false])for(const company of [false,true])for(const control of ['header','link'])
test('recipient Account '+(company?'company':'private')+' '+control+' preserves its form query in '+(framed?'frame':'standalone'),{timeout:60000},async()=>{
 const file=company?'form_account_azienda.html?aziendaId=doc-0':'form_account_privato.html?type=standard';
 const f=framed?await fixture():await harness.open('home_page.html');
 const view=()=>framed?child(f):f.page;
 const wait=async name=>{if(framed)return ready(f,name);await f.page.waitForFunction(name=>location.pathname==='/'+name&&window.__viewTour?.ready,name,{timeout:10000});assert.equal(await f.page.evaluate(()=>window.__viewTour.bootError),undefined);};
 try{
  const writesBefore=await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0));
  await view().locator('a[href="'+(company?'lista_aziende.html':'area_privata.html')+'"]').click();await wait(company?'lista_aziende.html':'area_privata.html');
  if(company){
   await view().locator('.azienda-card').filter({hasText:'Azienda inventata 0'}).locator('.card-name').click();await wait('account_azienda.html');
  }else{
   await view().locator('a[href="account_privati.html?type=standard"]').click();await wait('account_privati.html');
  }
  const listUrl=view().url();
  await view().locator(company?'#add-company-account-link':'#add-account-btn').click();await wait(file.split('?')[0]);
  const formUrl=view().url();
  await view().locator('#account-name').fill('Conto sintetico per ritorno');
  await view().locator('label[data-account-mode-choice="account-shared"]').click();
  await view().locator('#shared-management:not(.hidden)').waitFor({state:'visible'});
  await view().locator('.manage-recipients-link').click();await wait('gestione_destinatari.html');
  assert.equal(new URL(view().url()).searchParams.get('return'),file);
  await view().locator(control==='header'?'#header-left button.btn-icon-header':'#recipient-return').click();await wait(file.split('?')[0]);
  assert.equal(view().url(),formUrl,'recipient return must retain Account/company query');
  await view().locator('#header-left button.btn-icon-header').click();await wait(company?'account_azienda.html':'account_privati.html');
  // The private list's existing + can already lose its predecessor in frame;
  // this regression covers recipient -> exact form, then its canonical parent.
  if(company||!framed)assert.equal(view().url(),listUrl,'the coordinated Account entry must retain its originating list');
  if(company)assert.equal(new URL(view().url()).searchParams.get('id'),'doc-0');
  if(framed)await intact(f);
  assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0)),writesBefore,'opening the recipient manager must not save an Account or invitation');
 }finally{await f.context.close();}
});

for(const framed of [true,false])test('recipient rules entry without return retains its hierarchical chain in '+(framed?'frame':'standalone'),{timeout:60000},async()=>{
 const f=framed?await fixture('impostazioni.html'):await harness.open('impostazioni.html');
 const view=()=>framed?child(f):f.page;
 const wait=async name=>{if(framed)return ready(f,name);await f.page.waitForFunction(name=>location.pathname==='/'+name&&window.__viewTour?.ready,name,{timeout:10000});assert.equal(await f.page.evaluate(()=>window.__viewTour.bootError),undefined);};
 try{
  await view().locator('#btn-expiry-rules').click();await wait('regole_scadenze.html');
  await view().locator('a[href="gestione_destinatari.html"]').click();await wait('gestione_destinatari.html');
  assert.equal(await view().locator('#recipient-return').isVisible(),false);
  await view().locator('#header-left button.btn-icon-header').click();await wait('regole_scadenze.html');
  await view().locator('#header-left button.btn-icon-header').click();await wait('impostazioni.html');
  if(framed)await intact(f);
 }finally{await f.context.close();}
});

test('standalone explicit recipient return cannot treat a different query as its exact predecessor',{timeout:45000},async()=>{
 const f=await harness.open('form_account_privato.html',{query:'?type=shared'});
 try{
  const previous=f.page.url(),target='form_account_privato.html?type=standard';
  await f.page.goto(harness.base+'/gestione_destinatari.html?return='+encodeURIComponent(target),{referer:previous});
  await f.page.waitForFunction(()=>window.__viewTour?.ready);
  assert.equal(await f.page.evaluate(()=>document.referrer),previous,'negative fixture must have the real internal, different-query referrer');
  await f.page.locator('#recipient-return').click();
  await f.page.waitForFunction(()=>location.pathname==='/form_account_privato.html'&&window.__viewTour?.ready);
  assert.equal(f.page.url(),harness.base+'/'+target,'an explicit different query must use its validated target instead of Back');
 }finally{await f.context.close();}
});

for(const target of ['https://example.invalid/form_account_privato.html','login.html','../aggiungi_scadenza.html'])
test('standalone recipient return rejects unapproved target '+target,{timeout:45000},async()=>{
 const f=await harness.open('gestione_destinatari.html',{query:'?return='+encodeURIComponent(target)});
 try{
  assert.equal(await f.page.locator('#recipient-return').isVisible(),false);
  await f.page.locator('#header-left button.btn-icon-header').click();
  await f.page.waitForFunction(()=>location.pathname==='/home_page.html'&&window.__viewTour?.ready);
 }finally{await f.context.close();}
});

const selectedDeadlineFilters=[
 ['all',null,'doc-0'],['urgent','urgenti','doc-0'],
 ['expiring','in_scadenza','doc-1'],['completed','archiviate','doc-3']
];
for(const framed of [true,false])for(const [selected,query]of selectedDeadlineFilters)
test('deadline footer Cancel restores '+selected+' list without losing the owner '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const f=framed?await fixture():await harness.open('home_page.html');
 const view=()=>framed?child(f):f.page,wait=file=>framed?ready(f,file):standaloneReady(f,file);
 try{
  const entry=selected==='urgent'?'urgenti':'in_scadenza';
  await view().locator('a[href="scadenze.html?filter='+entry+'"]').click();await wait('scadenze.html');
  await view().locator('.filter-chip[data-filter="'+selected+'"]').click();
  const listUrl=view().url(),writes=await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0));
  await view().locator('#footer-center-actions .btn-fab-scadenza').click();await wait('aggiungi_scadenza.html');
  await view().locator('#notes').fill('Synthetic unsaved deadline');
  await view().evaluate(()=>{sessionStorage.setItem('profile-deadline-link-draft','synthetic-profile-draft');sessionStorage.setItem('account-deadline-link-draft','synthetic-account-draft');});
  await view().locator('#footer-center-actions button.btn-fab-neutral').click();await wait('scadenze.html');
  assert.equal(view().url(),listUrl,'footer Cancel returns to the exact predecessor including its filter');
  assert.equal(await view().locator('.filter-chip.active').getAttribute('data-filter'),selected);
  assert.equal(new URL(view().url()).searchParams.get('filter'),query);
  assert.deepEqual(await view().evaluate(()=>[sessionStorage.getItem('profile-deadline-link-draft'),sessionStorage.getItem('account-deadline-link-draft')]),[null,null],'new-form cancellation discards only its existing source drafts');
  assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0)),writes,'Cancel must not save the invented edit');
  await view().locator('#header-left button.btn-icon-header').click();await wait('home_page.html');
  if(framed)await intact(f);
 }finally{await f.context.close();}
});

for(const framed of [true,false])test('deadline footer Cancel from real edit returns to the same detail without saving '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const f=framed?await fixture():await harness.open('home_page.html');
 const view=()=>framed?child(f):f.page,wait=file=>framed?ready(f,file):standaloneReady(f,file);
 try{
  await view().locator('a[href="scadenze.html?filter=urgenti"]').click();await wait('scadenze.html');
  await view().locator('#scadenze-list .deadline-card[data-id="doc-0"] .deadline-card-title').click();await wait('dettaglio_scadenza.html');
  const detailUrl=view().url(),writes=await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0));
  await view().locator('#footer-center-actions .btn-fab-scadenza').click();await wait('aggiungi_scadenza.html');
  assert.equal(new URL(view().url()).searchParams.get('id'),'doc-0');
  await view().locator('#notes').fill('Synthetic cancelled edit');
  await view().locator('#footer-center-actions button.btn-fab-neutral').click();await wait('dettaglio_scadenza.html');
  assert.equal(view().url(),detailUrl);assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0)),writes);
  if(framed)await intact(f);
 }finally{await f.context.close();}
});

for(const framed of [true,false])for(const id of ['', 'doc-0'])test('deadline footer Cancel without predecessor uses canonical '+(id?'detail':'list')+' '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const initial='aggiungi_scadenza.html'+(id?'?id='+id:'');
 const f=framed?await fixture(initial):await harness.open('aggiungi_scadenza.html',{query:id?'?id='+id:''});
 const view=()=>framed?child(f):f.page,wait=file=>framed?ready(f,file):standaloneReady(f,file);
 try{
  await view().locator('#footer-center-actions button.btn-fab-neutral').click();await wait(id?'dettaglio_scadenza.html':'scadenze.html');
  assert.equal(new URL(view().url()).searchParams.get('id'),id||null);
  if(!id)assert.equal(await view().locator('.filter-chip.active').getAttribute('data-filter'),'all');
  if(framed)await intact(f);await noRuleWrites(f);
 }finally{await f.context.close();}
});

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


// Actual rule tab, producer, editor and shared-header returns. Records remain local.
const ruleDomains=['vehicles','home','health','sport','contracts','user-company','company'];
const ruleSeeds=[{path:'users/synthetic-local-only/settings/generalConfig',value:{
 deadlineTypes:ruleDomains.filter(d=>d!=='vehicles').map(domain=>({id:'tab-'+domain,name:'Synthetic '+domain,domain,freq:7,period:14,
  emailObjects:[{id:'object-'+domain,objectText:'Synthetic object',freq:7,period:14}]})),emailTemplates:['Synthetic message']}}];
const ruleOptions={memorySeeds:ruleSeeds};
async function standaloneReady(f,file){
 await f.page.waitForFunction(file=>location.pathname==='/'+file&&window.__viewTour?.ready,file);
 assert.equal(await f.page.evaluate(()=>window.__viewTour.bootError),undefined);
 assert.deepEqual(await f.page.evaluate(()=>window.__viewTour.errors),[]);
}
async function noRuleWrites(f){assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count')||0)),0);}
for(const framed of [true,false])for(const domain of ruleDomains)test('rules selected tab '+domain+' survives real editor Back '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const f=framed?await fixture('home_page.html',ruleOptions):await harness.open('home_page.html',ruleOptions);
 const ui=()=>framed?child(f):f.page,wait=file=>framed?ready(f,file):standaloneReady(f,file);
 try{
  await ui().locator('a[href="impostazioni.html"]').click();await wait('impostazioni.html');
  await ui().locator('#btn-expiry-rules').click();await wait('regole_scadenze.html');
  const length=await f.page.evaluate(()=>history.length);
  await ui().evaluate(()=>{window.rulesDocumentProbe='same-local-document';history.replaceState({syntheticRuleMarker:3},'',location.href);});
  await ui().locator('#deadline-tab-'+domain).click();
  assert.equal(new URL(ui().url()).searchParams.get('domain'),domain);
  assert.equal(await ui().evaluate(()=>window.rulesDocumentProbe),'same-local-document','tab change keeps the child document');
  assert.deepEqual(await ui().evaluate(()=>history.state),{syntheticRuleMarker:3});
  assert.equal(await f.page.evaluate(()=>history.length),length,'selecting a tab creates no history entry');
  const hubUrl=ui().url();
  await ui().locator('#deadline-panel-'+domain+' a[href^="configurazione_automezzi.html"]').first().click();await wait('configurazione_automezzi.html');
  assert.equal(await ui().locator('#vehicle-rule-editor').isVisible(),true);
  await ui().locator('#header-left button.btn-icon-header').click();await wait('regole_scadenze.html');
  assert.equal(ui().url(),hubUrl,'exact selected hub URL restored');
  assert.equal(await ui().locator('[data-deadline-domain][aria-selected="true"]').getAttribute('data-deadline-domain'),domain);
  assert.equal(await ui().locator('#deadline-panel-'+domain).isVisible(),true);
  await ui().locator('#header-left button.btn-icon-header').click();await wait('impostazioni.html');
  await ui().locator('#header-left button.btn-icon-header').click();await wait('home_page.html');
  if(framed)await intact(f);await noRuleWrites(f);
 }finally{await f.context.close();}
});
for(const framed of [true,false])test('rules keyboard tab preserves return query hash and current entry '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const target='regole_scadenze.html?return='+encodeURIComponent('aggiungi_scadenza.html?id=doc-0')+'&domain=vehicles'+(framed?'':'#deadline-hub-title');
 const f=framed?await fixture(target,ruleOptions):await harness.open('regole_scadenze.html',{...ruleOptions,query:new URL(target,'https://example.invalid/').search+new URL(target,'https://example.invalid/').hash});
 const ui=()=>framed?child(f):f.page;
 try{
  const previous=new URL(ui().url());const length=await f.page.evaluate(()=>history.length);
  await ui().locator('#deadline-tab-vehicles').press('ArrowRight');
  const selected=await ui().locator('[data-deadline-domain][aria-selected="true"]').getAttribute('data-deadline-domain');
  const url=new URL(ui().url());assert.equal(selected,'home');assert.equal(url.searchParams.get('domain'),selected);
  assert.equal(await ui().evaluate(()=>localStorage.getItem('codex_deadline_rules_domain:synthetic-local-only')),selected,'keyboard selection remembers the displayed tab');
  assert.equal(url.searchParams.get('return'),previous.searchParams.get('return'));assert.equal(url.hash,previous.hash);
  assert.equal(await f.page.evaluate(()=>history.length),length);
  await ui().locator('#deadline-tab-home').press('Home');
  assert.equal(new URL(ui().url()).searchParams.get('domain'),'personal');
  assert.equal(await ui().locator('#deadline-panel-personal').isVisible(),true);
  await ui().locator('#deadline-tab-personal').press('End');
  assert.equal(new URL(ui().url()).searchParams.get('domain'),'company');
  await ui().locator('#deadline-tab-company').press('ArrowLeft');
  assert.equal(new URL(ui().url()).searchParams.get('domain'),'user-company');
  assert.equal(await f.page.evaluate(()=>history.length),length,'whole keyboard sequence creates no history entry');
  if(framed)await intact(f);await noRuleWrites(f);
 }finally{await f.context.close();}
});
for(const framed of [true,false])for(const domain of (framed?['vehicles','contracts','']:['vehicles','contracts','', 'not-allowed']))test('direct rule editor fallback domain '+(domain||'absent')+' '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const initial='configurazione_automezzi.html?source=deadlineConfig&rule=tour-rule'+(domain?'&domain='+domain:'');
 const f=framed?await fixture(initial,ruleOptions):await harness.open('configurazione_automezzi.html',{...ruleOptions,query:new URL(initial,'https://example.invalid/').search}),ui=()=>framed?child(f):f.page;
 try{
  await ui().locator('#header-left button.btn-icon-header').click();
  if(framed)await ready(f,'regole_scadenze.html');else await standaloneReady(f,'regole_scadenze.html');
  assert.equal(new URL(ui().url()).searchParams.get('domain'),['vehicles','contracts'].includes(domain)?domain:null);
  assert.equal(await ui().locator('[data-deadline-domain][aria-selected="true"]').getAttribute('data-deadline-domain'),['vehicles','contracts'].includes(domain)?domain:'personal');
  if(framed)await intact(f);await noRuleWrites(f);
 }finally{await f.context.close();}
});

for(const framed of [true,false])test('real new-rule producer preserves return and draft through rule tab editor '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const f=framed?await fixture('aggiungi_scadenza.html',ruleOptions):await harness.open('aggiungi_scadenza.html',{...ruleOptions,query:''});
 const ui=()=>framed?child(f):f.page,wait=file=>framed?ready(f,file):standaloneReady(f,file);
 try{
  await ui().locator('#deadline-domain-tabs [data-deadline-domain="vehicles"]').click();
  await ui().locator('#notes').fill('Synthetic draft retained during rule navigation');
  await ui().locator('#btn-add-deadline-rule').click();await wait('regole_scadenze.html');
  const before=new URL(ui().url());assert.equal(before.searchParams.get('return'),'aggiungi_scadenza.html');assert.equal(before.searchParams.get('domain'),'vehicles');
  const draft=await ui().evaluate(()=>sessionStorage.getItem('deadline-editor-return-draft'));assert.ok(draft);
  assert.equal(JSON.parse(draft).fields.notes,'Synthetic draft retained during rule navigation');
  assert.equal(JSON.parse(draft).ownerUid,'synthetic-local-only');assert.equal(JSON.parse(draft).returnTarget,'aggiungi_scadenza.html');
  await ui().locator('#deadline-tab-home').click();const hubUrl=ui().url();assert.equal(new URL(hubUrl).searchParams.get('domain'),'home');
  assert.equal(new URL(hubUrl).searchParams.get('return'),before.searchParams.get('return'));
  await ui().locator('#deadline-panel-home a[href^="configurazione_automezzi.html"]').first().click();await wait('configurazione_automezzi.html');
  assert.equal(new URL(ui().url()).searchParams.has('return'),false,'editor receives no broadened return context');
  await ui().locator('#header-left button.btn-icon-header').click();await wait('regole_scadenze.html');
  assert.equal(ui().url(),hubUrl);assert.equal(await ui().locator('#deadline-tab-home').getAttribute('aria-selected'),'true');
  assert.equal(await ui().evaluate(()=>sessionStorage.getItem('deadline-editor-return-draft')),draft);
  if(framed)await intact(f);await noRuleWrites(f);
 }finally{await f.context.close();}
});


// Keep the real head gate and markup; replace only the full application composition root.
const rulesPaintEntry=String.raw`
import * as Pages from '/assets/js/pages-init.js';
import {initComponents} from '/assets/js/components-v129.js';
import {loadLanguage,applyGlobalTranslations} from '/assets/js/translations.js';
import {auth} from '/assets/js/firebase-config.js';
import {authSessionFence} from '/assets/js/auth-session-fence.js';
import {initCleanup} from '/assets/js/cleanup.js';
import {vaultFrameClient} from '/assets/js/modules/core/vault-frame-client.js';
window.__viewTour={errors:[]};
window.addEventListener('error',e=>__viewTour.errors.push(String(e.message)));
window.addEventListener('unhandledrejection',e=>__viewTour.errors.push(String(e.reason?.message||e.reason)));
const probe=window.__rulesPaintProbe||={samples:[],phase:'early'};
const frameLoaded=vaultFrameClient.isChild()?new Promise(resolve=>{
 const loaded=e=>{if(e.source!==parent||e.origin!==location.origin||e.data!=='view-tour-frame-loaded')return;removeEventListener('message',loaded);resolve();};
 addEventListener('message',loaded);
}):Promise.resolve();
(async()=>{try{
 await loadLanguage('it');initCleanup();
 await authSessionFence.readPermit();
 const gate=window.privateAuthGate,ticket=gate.begin(auth.currentUser.uid);
 if(!gate.acceptIdentity(ticket,auth.currentUser))throw Error('Synthetic identity not accepted by real presentation gate');
 await frameLoaded;if(vaultFrameClient.isChild())await vaultFrameClient.request('key');
 await initComponents();applyGlobalTranslations();document.documentElement.dataset.i18n='ready';
 if(sessionStorage.getItem('rules-paint-hold')==='1'){
  sessionStorage.removeItem('rules-paint-hold');probe.phase='waiting';await new Promise(resolve=>probe.release=resolve);
 }
 await Pages.initRegoleScadenze(auth.currentUser);probe.phase='ready';window.__viewTour.ready=true;
}catch(error){window.__viewTour.bootError=String(error?.stack||error);probe.phase='error';}})();
`;
let paintHarness;
test.after(async()=>{await paintHarness?.close();});
async function rulesPaintFixture(framed){
 if(!paintHarness)paintHarness=await createTourHarness({memory:true,frameIntegration:true,localFixtures:{
  '/app.html':{type:'text/html',body:shell},'/__back-parent.mjs':{type:'text/javascript',body:parentModule},
  '/login.html':{type:'text/html',body:'<!doctype html><title>Synthetic login predecessor</title>'},
  '/regole_scadenze.html':{type:'text/html',body:rulesPaintHtml},
  '/__rules-paint-entry.mjs':{type:'text/javascript',body:rulesPaintEntry}
 }});
 const f=await paintHarness.open('home_page.html',{query:'',memorySeeds:ruleSeeds,graphics:framed?'tre-livelli':'classica',theme:'light',palette:'lavender'});
 f.paintErrors=[];f.page.on('pageerror',e=>f.paintErrors.push(e.message));
 await f.context.addInitScript(()=>{
  if(location.pathname!='/regole_scadenze.html')return;
  const probe=window.__rulesPaintProbe={samples:[],phase:'early'};
  const visible=element=>{
   if(!element?.getClientRects().length)return false;
   for(let node=element;node;node=node.parentElement){const style=getComputedStyle(node);if(node.hidden||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0)return false;}
   for(let win=window;win!==win.parent;win=win.parent){const frame=win.frameElement;if(!frame?.getClientRects().length)return false;
    for(let node=frame;node;node=node.parentElement){const style=node.ownerDocument.defaultView.getComputedStyle(node);if(node.hidden||style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0)return false;}}
   return true;
  };
  const sample=()=>{const tabs=[...document.querySelectorAll('[data-deadline-domain]')];
   probe.samples.push({phase:probe.phase,pageVisible:visible(document.body),
    selected:tabs.filter(tab=>visible(tab)&&(tab.getAttribute('aria-selected')==='true'||tab.classList.contains('is-active'))).map(tab=>tab.dataset.deadlineDomain),
    panels:[...document.querySelectorAll('[data-deadline-panel]')].filter(visible).map(panel=>panel.dataset.deadlinePanel)});
   if(probe.samples.length<600)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
 });
 if(framed){await f.page.goto(paintHarness.base+'/login.html');await f.page.goto(paintHarness.base+'/app.html?route=%2Fhome_page.html');await ready(f,'home_page.html');f.ownerId=await f.page.evaluate(()=>backProbe.id);}
 return f;
}
async function heldRulesSamples(f,framed){
 try{await f.page.waitForFunction(framed=>{const win=framed?document.querySelector('iframe')?.contentWindow:window;
  return win?.__rulesPaintProbe?.phase==='waiting'&&win.__rulesPaintProbe.samples.filter(x=>x.phase==='waiting'&&x.pageVisible).length>=4;
 },framed,{timeout:7000});}catch(error){const state=await (framed?child(f):f.page).evaluate(()=>({url:location.href,probe:window.__rulesPaintProbe?{phase:__rulesPaintProbe.phase,samples:__rulesPaintProbe.samples.slice(-6)}:null,bootError:window.__viewTour?.bootError,gateReady:window.privateAuthGate?.isReady?.(),bodyHidden:document.body.hidden}));console.error(JSON.stringify({state,errors:f.paintErrors}));assert.fail(JSON.stringify({state,errors:f.paintErrors})+'; '+error.message);}
 return (framed?child(f):f.page).evaluate(()=>__rulesPaintProbe.samples.filter(x=>x.pageVisible&&(x.phase==='early'||x.phase==='waiting')));
}
for(const framed of [true,false])test('rules first visible paint never presents Personal before requested Automezzi '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const f=await rulesPaintFixture(framed),ui=()=>framed?child(f):f.page;
 try{
  await f.page.evaluate(()=>sessionStorage.setItem('rules-paint-hold','1'));
  if(framed)await f.page.evaluate(()=>{const frame=document.querySelector('iframe');vaultFrameNavigation.navigateFromChild(frame.contentWindow,frame.contentDocument,'/regole_scadenze.html?domain=vehicles',false);});
  else await f.page.goto(paintHarness.base+'/regole_scadenze.html?domain=vehicles');
  const samples=await heldRulesSamples(f,framed);
  assert.ok(samples.length>=4,'observe actual paint opportunities with body and ancestor iframe visible');
  const wrong=samples.filter(x=>x.selected.some(d=>d!=='vehicles')||x.panels.some(d=>d!=='vehicles'));
  await ui().evaluate(()=>__rulesPaintProbe.release());
  if(framed)await ready(f,'regole_scadenze.html');else await standaloneReady(f,'regole_scadenze.html');
  assert.deepEqual(wrong,[],'no visible Personal selection or content while the real hub initializer is held');
  assert.equal(await ui().locator('#deadline-tab-vehicles').getAttribute('aria-selected'),'true');
  assert.equal(await ui().locator('#deadline-panel-vehicles').isVisible(),true,'correct content eventually becomes visible');
  if(framed)await intact(f);await noRuleWrites(f);
 }finally{await f.context.close();}
});

for(const framed of [true,false])for(const destination of ['editor','recipients'])test('rules first visible Back from '+destination+' restores Health without Personal flash '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const f=await rulesPaintFixture(framed),ui=()=>framed?child(f):f.page;
 const wait=file=>framed?ready(f,file):standaloneReady(f,file);
 try{
  await ui().locator('a[href="impostazioni.html"]').click();await wait('impostazioni.html');
  await ui().locator('#btn-expiry-rules').click();await wait('regole_scadenze.html');
  await ui().locator('#deadline-tab-health').click();const selectedUrl=ui().url();
  const link=destination==='editor'?'#deadline-panel-health a[href^="configurazione_automezzi.html"]':'a[href="gestione_destinatari.html"]';
  await ui().locator(link).first().click();await wait(destination==='editor'?'configurazione_automezzi.html':'gestione_destinatari.html');
  await f.page.evaluate(()=>sessionStorage.setItem('rules-paint-hold','1'));
  await ui().locator('#header-left button.btn-icon-header').click();
  const samples=await heldRulesSamples(f,framed);
  const wrong=samples.filter(x=>x.selected.some(d=>d!=='health')||x.panels.some(d=>d!=='health'));
  await ui().evaluate(()=>__rulesPaintProbe.release());await wait('regole_scadenze.html');
  assert.deepEqual(wrong,[],'no incorrect tab or content during real Back initialization');
  assert.equal(ui().url(),selectedUrl);assert.equal(await ui().locator('#deadline-panel-health').isVisible(),true);
  await ui().locator('#header-left button.btn-icon-header').click();await wait('impostazioni.html');
  await ui().locator('#header-left button.btn-icon-header').click();await wait('home_page.html');
  if(framed)await intact(f);await noRuleWrites(f);assert.deepEqual(f.paintErrors,[]);
 }finally{await f.context.close();}
});

for(const framed of [true,false])test('rules remember last tab across fresh Settings entry and explicit URL wins '+(framed?'framed':'standalone'),{timeout:45000},async()=>{
 const f=await rulesPaintFixture(framed),ui=()=>framed?child(f):f.page;
 const wait=file=>framed?ready(f,file):standaloneReady(f,file);
 const visit=async target=>{
  if(framed)await f.page.evaluate(target=>{const frame=document.querySelector('iframe');vaultFrameNavigation.navigateFromChild(frame.contentWindow,frame.contentDocument,target,false);},target);
  else await f.page.goto(paintHarness.base+target);
  await wait('regole_scadenze.html');
 };
 try{
  await ui().locator('a[href="impostazioni.html"]').click();await wait('impostazioni.html');
  await ui().locator('#btn-expiry-rules').click();await wait('regole_scadenze.html');
  assert.equal(await ui().locator('#deadline-tab-personal').getAttribute('aria-selected'),'true','no preference defaults to Personal');
  assert.equal(await ui().evaluate(()=>localStorage.getItem('codex_deadline_rules_domain:synthetic-local-only')),null);
  await ui().locator('#deadline-tab-health').click();
  assert.equal(await ui().evaluate(()=>localStorage.getItem('codex_deadline_rules_domain:synthetic-local-only')),'health');
  await ui().locator('#header-left button.btn-icon-header').click();await wait('impostazioni.html');
  await ui().locator('#header-left button.btn-icon-header').click();await wait('home_page.html');
  await ui().locator('a[href="impostazioni.html"]').click();await wait('impostazioni.html');
  await f.page.evaluate(()=>sessionStorage.setItem('rules-paint-hold','1'));
  await ui().locator('#btn-expiry-rules').click();const samples=await heldRulesSamples(f,framed);
  const wrong=samples.filter(x=>x.selected.some(d=>d!=='health')||x.panels.some(d=>d!=='health'));
  await ui().evaluate(()=>__rulesPaintProbe.release());await wait('regole_scadenze.html');
  assert.deepEqual(wrong,[]);assert.equal(await ui().locator('#deadline-tab-health').getAttribute('aria-selected'),'true');
  assert.equal(new URL(ui().url()).searchParams.get('domain'),'health','remembered tab pins current history entry');
  await visit('/regole_scadenze.html?domain=vehicles');
  assert.equal(await ui().locator('#deadline-tab-vehicles').getAttribute('aria-selected'),'true');
  assert.equal(await ui().evaluate(()=>localStorage.getItem('codex_deadline_rules_domain:synthetic-local-only')),'vehicles','explicit valid URL updates the last displayed tab');
  const pinnedUrl=ui().url();
  await ui().locator('#deadline-panel-vehicles a[href^="configurazione_automezzi.html"]').first().click();await wait('configurazione_automezzi.html');
  await ui().evaluate(()=>localStorage.setItem('codex_deadline_rules_domain:synthetic-local-only','health'));
  await ui().locator('#header-left button.btn-icon-header').click();await wait('regole_scadenze.html');
  assert.equal(ui().url(),pinnedUrl);assert.equal(await ui().locator('#deadline-tab-vehicles').getAttribute('aria-selected'),'true','Back URL wins over another window preference');
  await ui().evaluate(()=>localStorage.setItem('codex_deadline_rules_domain:synthetic-local-only','not-allowed'));
  await visit(framed?'/regole_scadenze.html':'/regole_scadenze.html?domain=not-allowed');
  assert.equal(await ui().locator('#deadline-tab-personal').getAttribute('aria-selected'),'true','invalid stored values and standalone requested values use safe default');
  if(framed)await intact(f);await noRuleWrites(f);assert.deepEqual(f.paintErrors,[]);
 }finally{await f.context.close();}
});
