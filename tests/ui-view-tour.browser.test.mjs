import test from 'node:test';
import assert from 'node:assert/strict';
import {createTourHarness,pages} from '../scripts/lib/view-tour-harness.mjs';
import {runViewTour,TOUR_CLICKABLE,tourDestination} from '../scripts/ui-view-tour.mjs';
import {captureTourPaints,analyseTourPaints,listTourControls,settleTourUi} from '../scripts/lib/view-tour-paints.mjs';
import {fixedColorRegistry} from '../scripts/audit-fixed-colors.mjs';

test('tour boots both real graphics and reports partial coverage and ordinary hrefs explicitly',{timeout:60000},async()=>{
 const report=await runViewTour({only:['profilo_privato.html'],depth:0,screenshots:false});
 assert.equal(report.pages.length,2);assert.equal(report.declaredDepth,0);
 const counts=report.pages.map(page=>({graphics:page.graphics,manage:page.states[0].controls.filter(c=>c.classes.split(' ').includes('manage-toggle')).length}));
 assert.equal(counts.find(c=>c.graphics==='classica').manage,counts.find(c=>c.graphics==='tre-livelli').manage,'both liveries install the same management controls');
 assert.ok(counts.find(c=>c.graphics==='tre-livelli').manage>=6,'Nuova really installed section management');
 assert.ok(report.pages.every(p=>p.links.some(link=>link.to.includes('impostazioni.html'))),'normal a[href] is observed');
 assert.equal(report.coverageStatus,'INCOMPLETE');assert.equal(report.omittedPrivatePages.length,Object.keys(pages).length-1);
 assert.ok(report.summary.beyondDepth>0);assert.equal(report.contrastStatus,'NOT_MEASURED_BY_TOUR');assert.equal(report.provenance.sourceStable,true);
});

test('an ordinary fixed-blue control is not excused by a diagnostics ancestor',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('impostazioni.html');
 try{
  await f.page.locator('#performance-diagnostics-toggle').check();
  await f.page.evaluate(()=>{const button=document.createElement('button');button.id='ui313-ordinary';button.textContent='Controllo ordinario';button.style.color='#3b82f6';document.querySelector('.diagnostics-actions').append(button);});
  const data=await f.page.evaluate(captureTourPaints,{graphics:'classica',exceptions:fixedColorRegistry.exceptions});
  const flags=analyseTourPaints(data);
  assert.ok(flags.filter(f=>f.label.includes('#ui313-ordinary')&&f.property==='color').every(f=>f.exception===null));
  assert.equal(flags.filter(f=>f.label.includes('#ui313-ordinary')&&f.property==='color').length,2);
  assert.ok(!flags.some(f=>f.property==='outlineColor'&&f.label.includes('#ui313-ordinary')),'outline-style:none is not a visible paint');
  assert.ok(flags.some(f=>f.exception&&f.exception.selector.includes('btn-reset-vault')),'the exact destructive paint remains admitted');
 }finally{await f.context.close();await h.close();}
});

test('a producer bootstrap error rejects the fixture instead of returning a ready blank page',{timeout:30000},async()=>{
 const h=await createTourHarness({initializers:{...pages,'home_page.html':'missingInitializer'}});
 try{await assert.rejects(()=>h.open('home_page.html'),/View tour bootstrap/);}finally{await h.close();}
});


test('exception matching checks every gradient stop, shadow dimension and alpha',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('scadenze.html');
 try{
  await f.page.evaluate(()=>{
   const gradient=document.querySelector('.deadline-card');gradient.id='ui313-wrong-gradient';
   gradient.style.backgroundImage='linear-gradient(to right,rgba(16,185,129,.8) 0%,transparent 10%,transparent 90%,rgba(0,0,255,.8) 100%)';
   const shadow=document.createElement('div');shadow.id='ui313-wrong-shadow';shadow.className='azienda-card is-delete-mode';shadow.textContent='Prova';shadow.style.boxShadow='0 0 150px rgba(239,68,68,.3)';document.body.append(shadow);
   const alpha=document.createElement('button');alpha.id='ui313-wrong-alpha';alpha.className='btn-remove-logo';alpha.textContent='Prova';alpha.style.cssText='background:rgba(239,68,68,.9);position:fixed;top:120px;left:8px;z-index:99999';document.body.append(alpha);
  });
  await f.page.locator('#ui313-wrong-alpha').hover();
  const flags=analyseTourPaints(await f.page.evaluate(captureTourPaints,{graphics:'classica',exceptions:fixedColorRegistry.exceptions}));
  for(const [id,property] of [['ui313-wrong-gradient','backgroundImage'],['ui313-wrong-shadow','boxShadow'],['ui313-wrong-alpha','backgroundColor']]){
   const rows=flags.filter(f=>f.label.includes('#'+id)&&f.property===property);assert.equal(rows.length,2,id);assert.ok(rows.every(f=>f.exception===null),id+' must not borrow a different registered paint');
  }
 }finally{await f.context.close();await h.close();}
});


test('a real graphics change in Settings survives its page reload',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('impostazioni.html',{graphics:'classica'});
 try{
  await f.page.locator('#theme-settings-toggle').click();
  await f.page.locator('.ui-graphics-btn[data-ui-graphics="new"]').click();
  await f.page.waitForFunction(()=>window.__viewTour?.ready&&document.body.dataset.uiRevision==='tre-livelli'&&document.documentElement.dataset.uiGraphics==='new',undefined,{timeout:15000});
  assert.equal(await f.page.evaluate(()=>localStorage.getItem('ui_graphics')),null);
  assert.equal(await f.page.locator('.ui-graphics-btn[data-ui-graphics="new"]').getAttribute('aria-pressed'),'true');
 }finally{await f.context.close();await h.close();}
});


test('an unresolved registered variable cannot inherit and excuse an ordinary blue paint',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('impostazioni.html');
 try{
  await f.page.evaluate(()=>{const button=document.createElement('button');button.id='ui313-unresolved-role';button.className='btn-logout-semantic';button.textContent='Prova';button.style.cssText='--status-error:initial;color:#3b82f6;position:fixed;top:160px;left:10px;z-index:99999';document.body.append(button);});
  const flags=analyseTourPaints(await f.page.evaluate(captureTourPaints,{graphics:'classica',exceptions:fixedColorRegistry.exceptions}));
  const rows=flags.filter(f=>f.label.includes('#ui313-unresolved-role')&&f.property==='color');assert.equal(rows.length,2);assert.ok(rows.every(f=>f.exception===null));
 }finally{await f.context.close();await h.close();}
});


test('a real note dialog has unique replay paths and Cancel is an ordinary click',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('dettaglio_account_privato.html');
 try{
  assert.equal(await f.page.locator('#btn-modify-account-note').isVisible(),false,'shared consultation hides editing');
  await f.page.getByRole('button',{name:'Modifica: Note',exact:true}).click();
  await f.page.locator('#btn-modify-account-note').click();
  const controls=(await f.page.evaluate(listTourControls,TOUR_CLICKABLE)).filter(c=>c.visible&&!c.disabled);
  for(const control of controls)assert.equal(await f.page.locator(control.selector).count(),1,control.name+' has a unique locator');
  const cancels=controls.filter(c=>c.inDialog&&c.name==='Annulla');assert.equal(cancels.length,1);
  await f.page.locator(cancels[0].selector).click();
  assert.equal(await f.page.locator('.modal-overlay').count(),0);
 }finally{await f.context.close();await h.close();}
});

test('lazy picker assets retain their native module URL and native capabilities stay synthetic',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('dettaglio_account_privato.html');
 try{
  assert.equal(await f.page.locator('#btn-add-attachment').isVisible(),false,'shared consultation hides attachment management');
  await f.page.getByRole('button',{name:'Modifica: Allegati',exact:true}).click();
  await f.page.locator('#btn-add-attachment').click();
  await f.page.waitForFunction(()=>getComputedStyle(document.querySelector('.attachment-source-picker-grid')).display==='grid');
  assert.equal(await f.page.locator('.attachment-source-picker').evaluate(e=>getComputedStyle(e).position),'fixed');
  assert.ok(h.assets.served.has('/assets/css/attachment-source-picker.css'));assert.ok(!h.assets.missing.has('/css/attachment-source-picker.css'));
  await f.page.locator('.attachment-source-picker-cancel').click();
  assert.equal(await f.page.locator('.attachment-source-picker').count(),0);
  await assert.rejects(()=>f.page.evaluate(()=>navigator.mediaDevices.getUserMedia({video:true})),/Synthetic fixture/);
  await f.page.locator('#btn-add-attachment').click();
  await f.page.locator('[data-source="gallery"]').click();
  await f.page.waitForFunction(()=>!document.querySelector('.attachment-source-picker'));
  assert.ok(h.assets.nativeFileChoosers>=1,'the native boundary is observed without reading any user file');
 }finally{await f.context.close();await h.close();}
});


test('closed details and intentionally blocked row actions are not offered as executable controls',{timeout:30000},async()=>{
 const h=await createTourHarness(),settings=await h.open('impostazioni.html');
 try{
  let controls=await settings.page.evaluate(listTourControls,TOUR_CLICKABLE);
  assert.equal(controls.filter(c=>c.visible&&c.classes.includes('ui-graphics-btn')).length,0);
  await settings.page.locator('#theme-settings-toggle').click();controls=await settings.page.evaluate(listTourControls,TOUR_CLICKABLE);
  assert.equal(controls.filter(c=>c.visible&&c.classes.includes('ui-graphics-btn')).length,2);
 }finally{await settings.context.close();}
 const companies=await h.open('lista_aziende.html');
 try{
  await companies.page.locator('#delete-mode-btn').click();
  const controls=await companies.page.evaluate(listTourControls,TOUR_CLICKABLE);
  assert.ok(controls.some(c=>c.visible&&c.classes.includes('azienda-card')&&c.classes.includes('is-delete-mode')&&!c.disabled));
  for(const c of controls.filter(c=>c.visible&&/card-action/.test(c.classes)))assert.equal(c.disabled,true,'row actions are intentionally blocked in delete mode');
 }finally{await companies.context.close();await h.close();}
});

test('new company field IDs may vary without breaking a replay path',{timeout:30000},async()=>{
 const h=await createTourHarness();let first,selector;
 try{
  for(let iteration=0;iteration<2;iteration++){
   const f=await h.open('modifica_azienda.html');try{
    await f.page.locator('#btn-add-email').click();const id=await f.page.locator('input[id^="qr_email-"]').last().getAttribute('id');
    if(iteration===0){first=id;selector=(await f.page.evaluate(listTourControls,TOUR_CLICKABLE)).find(c=>c.id===id).selector;assert.ok(!selector.includes(id));}
    else {assert.notEqual(id,first);assert.equal(await f.page.locator(selector).count(),1);assert.equal(await f.page.locator(selector).getAttribute('id'),id);}
   }finally{await f.context.close();}
  }
 }finally{await h.close();}
});

test('rule destinations stay distinct and a missing runtime stylesheet cannot yield PASS',{timeout:30000},async()=>{
 const a=tourDestination('configurazione_automezzi.html?source=deadlineConfig&rule=a','http://fixture.invalid/');
 const b=tourDestination('configurazione_automezzi.html?source=deadlineConfig&rule=b','http://fixture.invalid/');assert.notEqual(a,b);assert.match(a,/source=deadlineConfig&rule=a/);
 const result=await runViewTour({only:['home_page.html'],graphics:['classica'],depth:0,screenshots:false,harnessOptions:{missingAssets:['/assets/css/core_ui.css']}});
 assert.equal(result.fixedPaintStatus,'FAIL');assert.equal(result.coverageStatus,'INCOMPLETE');assert.ok(result.summary.criticalMissingAssets>0);
});


test('derived result borders are exact and native sharing stays inside the synthetic boundary',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('impostazioni.html');
 try{
  await f.page.locator('#performance-diagnostics-toggle').check();await f.page.locator('#btn-run-app-diagnostics').click();
  await f.page.locator('.diagnostics-overall').waitFor();
  const capture=()=>f.page.evaluate(captureTourPaints,{graphics:'classica',exceptions:fixedColorRegistry.exceptions,dynamicExceptions:fixedColorRegistry.runtimePaints});
  const flags=analyseTourPaints(await capture());
  assert.ok(flags.some(p=>p.label.includes('diagnostics-overall')&&p.property==='borderTopColor'&&p.exception?.id==='diagnostics-result-border-warn'));
  await f.page.evaluate(()=>{document.querySelector('.diagnostics-overall').style.borderColor='#3b82f6';const e=document.querySelector('.diagnostics-actions');e.style.border='1px solid rgb(245,158,11)';});
  const negative=analyseTourPaints(await capture());
  assert.ok(negative.some(p=>p.label.includes('diagnostics-overall')&&p.property==='borderTopColor'&&!p.exception));
  assert.ok(negative.some(p=>p.label.includes('diagnostics-actions')&&p.property==='borderTopColor'&&!p.exception));
 }finally{await f.context.close();}
 const profile=await h.open('profilo_privato.html');
 try{await profile.page.locator('#profile-tab-digital-card').click();await profile.page.getByRole('button',{name:'Condividi',exact:true}).click();await profile.page.waitForFunction(()=>window.__viewTourNativeShares===1);assert.equal(h.assets.nativeShares,1);assert.deepEqual(await profile.page.evaluate(()=>window.__viewTour.errors),[]);}
 finally{await profile.context.close();await h.close();}
});

test('controls behind the active profile dialog are blocked rather than replayed through it',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('profilo_privato.html');
 try{
  await f.page.getByRole('button',{name:'Modifica anagrafica',exact:true}).click();
  await f.page.waitForFunction(()=>Number(getComputedStyle(document.getElementById('profile-edit-modal')).opacity)>0);
  const controls=await f.page.evaluate(listTourControls,TOUR_CLICKABLE);
  assert.ok(controls.some(c=>c.visible&&c.disabled&&c.disabledReason==='behind active dialog'));
  assert.ok(controls.some(c=>c.visible&&c.inDialog&&!c.disabled));
  assert.ok(controls.filter(c=>c.visible&&!c.inDialog).every(c=>c.disabled));
 }finally{await f.context.close();await h.close();}
});


test('delayed real confirmation is observed before its commands are inventoried',{timeout:30000},async()=>{
 const h=await createTourHarness(),f=await h.open('configurazione_automezzi.html',{graphics:'tre-livelli'});
 try{
  await f.page.evaluate(()=>{const original=window.setTimeout;window.setTimeout=(callback,delay,...args)=>original(callback,delay===10?60:delay,...args);});
  await f.page.locator('#btn-add-email-object').click();
  await f.page.locator('[data-vehicle-card]').last().locator('summary').click();
  await f.page.locator('[data-vehicle-card]').last().locator('.btn-icon-delete').click();
  await f.page.evaluate(settleTourUi);
  const controls=await f.page.evaluate(listTourControls,TOUR_CLICKABLE);
  for(const id of ['confirm-cancel-btn','confirm-ok-btn'])assert.ok(controls.some(c=>c.id===id&&c.visible&&!c.disabled),id+' must be discovered after actual activation');
  await f.page.locator('#confirm-cancel-btn').click();assert.equal(await f.page.locator('[data-vehicle-card]').count(),2);
 }finally{await f.context.close();await h.close();}
});
