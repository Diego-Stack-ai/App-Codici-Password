import test from 'node:test';
import assert from 'node:assert/strict';
import {createTourHarness,defaultTourQuery} from '../scripts/lib/view-tour-harness.mjs';
import {tourDestination} from '../scripts/ui-view-tour.mjs';
import {createDeepDriver,palettes,visibleDeepTextIndices} from '../scripts/lib/deep-ui.mjs';
import {deepContract,scenarios,runDeepScenarios} from '../scripts/ui-deep-scenarios.mjs';
import {readFile,mkdtemp,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('deep registry connects every named case to source, styles, states and tests',async()=>{
 assert.deepEqual(deepContract.cases.map(c=>c.id).sort(),Object.keys(scenarios).sort());
 assert.equal(deepContract.baselineGroups.reduce((n,g)=>n+g.occurrences,0),492);
 for(const c of deepContract.cases){assert.ok(c.expectedStates.length);assert.equal(c.expectedStates.length,new Set(c.expectedStates).size);assert.equal(c.producer,scenarios[c.id].producer);for(const file of [c.producer,...c.styles,c.test.file,c.test.runner])assert.ok((await stat(file)).isFile(),file);}
 for(const group of deepContract.baselineGroups)for(const id of group.cases)assert.ok(scenarios[id],id);
 assert.ok(JSON.parse(await readFile('package.json','utf8')).scripts['test:ui-foundations'].includes('test:ui-deep'));
});

test('empty case and graphics selections cannot produce a green report',async()=>{
 await assert.rejects(()=>runDeepScenarios({only:[]}),/nonempty unique list/);
 await assert.rejects(()=>runDeepScenarios({only:['S00'],graphics:[]}),/nonempty unique supported list/);
});

test('contrast visibility excludes covered swipe text and clipped fields, then measures a revealed action',{timeout:30000},async()=>{
 const h=await createTourHarness({memory:true}),f=await h.open('home_page.html');try{
  await f.page.setContent('<style>body{margin:0}#card{position:relative;width:300px;height:100px}#back,#front{position:absolute;inset:0;background:white}#back{z-index:1}#front{z-index:2}#clip{position:relative;height:20px;overflow:hidden}#hidden{position:absolute;top:100px}#off{position:absolute;top:3000px}</style><div id="card"><div id="back">Azione swipe</div><div id="front">Card davanti</div></div><div id="clip"><span id="hidden">Campo ritagliato</span></div><span id="off">Fuori schermo</span>');
  const check=async()=>f.page.evaluate(visibleDeepTextIndices,await f.page.evaluate(()=>[...document.body.querySelectorAll('*')].flatMap((e,i)=>['back','front','hidden','off'].includes(e.id)?[i]:[])));
  let result=await check();const back=await f.page.evaluate(()=>[...document.body.querySelectorAll('*')].findIndex(e=>e.id==='back'));
  assert.ok(result.excluded.some(x=>x.index===back&&x.reason==='OCCLUDED'));assert.ok(result.excluded.some(x=>x.reason==='CLIPPED'));assert.ok(result.excluded.some(x=>x.reason==='OFF_VIEWPORT'));
  await f.page.locator('#front').evaluate(e=>e.style.transform='translateX(320px)');result=await check();assert.ok(result.visible.includes(back));
 }finally{await f.context.close();await h.close();}
});

test('company account fixtures require the real company and account route, and reject early-return pages',{timeout:30000},async()=>{
 const h=await createTourHarness({memory:true});try{
  for(const file of ['form_account_azienda.html','dettaglio_account_azienda.html']){
   assert.match(defaultTourQuery(file),/aziendaId=doc-0/);await assert.rejects(()=>h.open(file,{query:'?id=doc-0'}),/readiness: aziendaId missing/);
   const f=await h.open(file);try{assert.equal(f.readiness.status,'RECORD_LOADED');assert.deepEqual(await f.page.evaluate(()=>window.__viewTour.errors),[]);}finally{await f.context.close();}
  }
  assert.match(tourDestination('dettaglio_account_azienda.html?id=a&aziendaId=c&ownerId=o','http://fixture.invalid/'),/aziendaId=c/);
  assert.match(tourDestination('dettaglio_scadenza.html?received=r','http://fixture.invalid/'),/received=r/);
 }finally{await h.close();}
});

test('synthetic SDK applies local writes and aborts before writes when the transaction callback rejects',{timeout:30000},async()=>{
 const h=await createTourHarness({memory:true}),f=await h.open('profilo_privato.html');try{
  const data=await f.page.evaluate(async()=>{
   const sdk=await import('/assets/js/vendor/firebase-runtime.js');const path='users/synthetic-local-only';const ref=sdk.doc({},path);let ran=false;
   await sdk.runTransaction({},async tx=>{const before=await tx.get(ref);ran=true;tx.update(ref,{nome:'Nome cambiato'});if(before.data().nome!=='Nome fittizio')throw Error('Wrong fixture');});
   let rejected=false;try{await sdk.runTransaction({},async tx=>{tx.update(ref,{nome:'Non applicare'});throw Error('Intentional abort');});}catch{rejected=true;}
   return {ran,rejected,value:(await sdk.getDocFromServer(ref)).data().nome,operations:window.__viewTourMemory.operations.length};
  });assert.deepEqual(data,{ran:true,rejected:true,value:'Nome cambiato',operations:1});
 }finally{await f.context.close();await h.close();}
});

test('the mutation audit survives navigation even though fixture records are recreated',{timeout:30000},async()=>{
 const h=await createTourHarness({memory:true}),f=await h.open('home_page.html');try{
  await f.page.evaluate(async()=>{const sdk=await import('/assets/js/vendor/firebase-runtime.js');await sdk.updateDoc(sdk.doc({},'users/synthetic-local-only'),{nome:'Mutazione locale QA'});});
  await f.page.goto(h.base+'/impostazioni.html');await f.page.waitForFunction(()=>window.__viewTour?.ready);
  assert.equal(await f.page.evaluate(()=>Number(sessionStorage.getItem('ui313-local-mutation-count'))),1);
  assert.equal(await f.page.evaluate(()=>window.__viewTourMemory.read('users/synthetic-local-only').nome),'Nome fittizio');
 }finally{await f.context.close();await h.close();}
});

test('native checkboxes in real credential and Widget editors follow the palette in both graphics',{timeout:60000},async()=>{
 const d=await createDeepDriver({measure:false});try{for(const graphics of ['classica','tre-livelli'])for(const file of ['impostazioni.html','form_account_privato.html','form_account_azienda.html']){
  const f=await d.open(file,graphics);try{
   let selector;
   if(file==='impostazioni.html'){await f.click(f.page.locator('#btn-shared-credentials'));await f.click(f.page.locator('.shared-credentials-card').filter({hasText:'Credenziale libera'}).getByRole('button',{name:'Modifica credenziale',exact:true}));selector='.shared-credential-field input[type="checkbox"]';}
   else{await f.click(f.page.locator('#btn-add-account-widget'));await f.click(f.page.getByRole('button',{name:'Crea nuovo profilo Widget Account',exact:true}));await f.click(f.page.getByRole('button',{name:'Aggiungi campo',exact:true}));selector='.account-widget-sensitive input[type="checkbox"]';}
   for(const theme of ['light','dark'])for(const palette of palettes){const check=await f.page.evaluate(({theme,palette,selector})=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.dataset.colorTheme=palette;const probe=document.createElement('input');probe.type='checkbox';probe.style.cssText='position:fixed;left:-9999px;accent-color:var(--theme-fill)';document.body.append(probe);const expected=getComputedStyle(probe).accentColor;probe.remove();return {expected,actual:[...document.querySelectorAll(selector)].map(e=>getComputedStyle(e).accentColor)};},{theme,palette,selector});assert.notEqual(check.expected,'auto');assert.ok(check.actual.length);assert.ok(check.actual.every(value=>value===check.expected),`${file}/${graphics}/${theme}/${palette}: ${JSON.stringify(check)}`);}
  }finally{await f.close();}
 }}finally{await d.close();}
});

test('all registered deep workflows assert real UI producers and local mutations in both graphics',{timeout:600000},async()=>{
 const outDir=await mkdtemp(path.join(tmpdir(),'ui313-deep-functional-'));
 const result=await runDeepScenarios({outDir,measure:false});
 assert.equal(result.status,'FUNCTIONAL_ONLY',JSON.stringify({summary:result.summary,failures:result.failures}));
 assert.equal(result.coverage.length,deepContract.cases.length*2);assert.equal(result.summary.states,deepContract.cases.reduce((n,c)=>n+c.expectedStates.length,0)*2);assert.equal(result.summary.contexts,0);
});

test('deep modal and visibility contrast regressions cover both graphics and all themes',{timeout:180000},async()=>{
 const outDir=await mkdtemp(path.join(tmpdir(),'ui313-deep-colors-'));
 const result=await runDeepScenarios({outDir,only:['S02','P01','P06']});
 assert.equal(result.status,'PASS',JSON.stringify({summary:result.summary,failures:result.failures,contrast:result.states.flatMap(s=>s.contrast.filter(x=>x.status==='FAIL')).slice(0,5)}));
 assert.equal(result.summary.contexts,result.summary.states*14);
});
