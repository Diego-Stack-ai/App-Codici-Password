#!/usr/bin/env node
// Real page modules with synthetic repositories. An inventory is not a full-app PASS.
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {createTourHarness,pages,publicRoot} from './lib/view-tour-harness.mjs';
import {fixedColorRegistry} from './audit-fixed-colors.mjs';
import {listTourControls,captureTourPaints,analyseTourPaints,settleTourUi} from './lib/view-tour-paints.mjs';
import {buildUiTopology} from './build-ui-topology.mjs';
export const TOUR_CLICKABLE='button,[role="button"],summary,.collapsible-header,[data-action],select,.custom-select-trigger,input[type="checkbox"],input[type="date"],a[href],a:not([href]),[data-value],.custom-option,[role=option],[tabindex]:not([tabindex="-1"]),.azienda-card';
export function tourDestination(href,base){const url=new URL(href,base);const query=new URLSearchParams();for(const key of ['source','rule','id','companyId','accountId','profileTab','mode','type','tab','section'])if(url.searchParams.has(key))query.set(key,url.searchParams.get(key));return url.pathname+(query.size?'?'+query:'')+url.hash;}
async function snapshot(){const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,e.name);if(e.isDirectory())await walk(name);else if(/\.(?:html|css|js|mjs|json)$/.test(name)&&e.name!=='release-manifest.json')files.push(name);}}await walk(publicRoot);
 for(const name of ['scripts/ui-view-tour.mjs','scripts/lib/view-tour-harness.mjs','scripts/lib/view-tour-paints.mjs','scripts/ui-fixed-color-exceptions.json','scripts/ui-dynamic-theme-contract.json','scripts/audit-fixed-colors.mjs','scripts/build-ui-topology.mjs','scripts/ui-topology-contract.json','package.json','package-lock.json'])files.push(fileURLToPath(new URL('../'+name,import.meta.url)));
 const records=[];for(const name of files.sort())records.push({path:path.relative(fileURLToPath(new URL('../',import.meta.url)),name).replaceAll('\\','/'),sha256:createHash('sha256').update(await readFile(name)).digest('hex')});
 return {sha256:createHash('sha256').update(JSON.stringify(records)).digest('hex'),files:records};}
const identity=c=>c.selector+'|'+c.name+'|'+c.classes;
export async function runViewTour({outDir,only=Object.keys(pages),depth=3,graphics=['classica','tre-livelli'],screenshots=true,maxStatesPerPage=Infinity,harnessOptions={}}={}){
 if(!Number.isInteger(depth)||depth<0||depth>4)throw Error('depth must be 0..4');
 if(only.some(file=>!pages[file]))throw Error('Unknown private page: '+only.filter(file=>!pages[file]).join(','));
 if(graphics.some(g=>!['classica','tre-livelli'].includes(g)))throw Error('Unknown graphics');
 if(outDir)await mkdir(outDir,{recursive:true});
 const sourceBefore=await snapshot(),dynamic=JSON.parse(await readFile(new URL('./ui-dynamic-theme-contract.json',import.meta.url),'utf8'));
 const harness=await createTourHarness(harnessOptions),report=[];
 try{
 for(const file of only)for(const graphicsMode of graphics){
  const entry={page:file,graphics:graphicsMode,producer:{path:'Frontend/public/assets/js/pages-init.js',export:pages[file]},stylesheets:[],states:[],links:[],notOpened:[],disabled:[],beyondDepth:[]};
  const visit=async(trail)=>{
   if(entry.states.length>=maxStatesPerPage){entry.notOpened.push({trail,reason:'state limit reached'});return null;}
   let instance;try{instance=await harness.open(file,{graphics:graphicsMode});}catch(error){entry.notOpened.push({trail,reason:'bootstrap failed',error:String(error.message)});return null;}
   const {page,context}=instance;let navigation=null;
   page.on('framenavigated',frame=>{if(frame===page.mainFrame())try{navigation=tourDestination(frame.url(),harness.base+'/'+file);}catch{navigation='changed document';}});
   try{
    const actual=await page.evaluate(()=>({revision:document.body.dataset.uiRevision,graphics:document.documentElement.dataset.uiGraphics||'new'}));
    if(actual.graphics!==(graphicsMode==='classica'?'classic':'new')||(actual.revision&&actual.revision!==graphicsMode))throw Error('Real graphics bootstrap mismatch');
    for(const action of trail){
     const controls=await page.evaluate(listTourControls,TOUR_CLICKABLE),target=controls.find(c=>c.selector===action.selector&&c.name===action.name);
     if(!target){await page.locator(action.selector).waitFor({state:'attached',timeout:2000});const ready=await page.evaluate(listTourControls,TOUR_CLICKABLE);if(!ready.some(c=>c.selector===action.selector&&c.name===action.name))throw Error('Replay control identity changed');}
     try{await page.locator(action.selector).click({timeout:2000});}catch(error){entry.notOpened.push({trail,reason:'ordinary click failed',action,error:String(error.message).split('\n')[0]});return null;}
     await page.evaluate(settleTourUi);
     if(navigation){entry.links.push({trail,from:action.selector,to:navigation,status:'DOCUMENT_TRANSITION_OBSERVED',resultingView:'measured separately; no paint PASS for the transition'});return null;}
    }
    const after=await page.evaluate(listTourControls,TOUR_CLICKABLE);
    const errors=await page.evaluate(()=>({boot:window.__viewTour?.bootError||null,runtime:window.__viewTour?.errors||[]}));
    if(errors.boot)throw Error(errors.boot);
    const criticalMissing=[...harness.assets.missing].filter(name=>/\.(?:css|js|mjs|woff2?|json)$/.test(name));if(criticalMissing.length)throw Error('Missing local runtime assets: '+criticalMissing.join(','));
    await page.waitForFunction(()=>[...document.querySelectorAll('link[rel=stylesheet]')].every(link=>link.disabled||link.sheet),undefined,{timeout:5000});
    await page.evaluate(()=>document.fonts.ready);
    const data=await page.evaluate(captureTourPaints,{graphics:graphicsMode,exceptions:fixedColorRegistry.exceptions,dynamicExceptions:[...dynamic.exceptions,...fixedColorRegistry.runtimePaints]});
    const flags=analyseTourPaints(data),state={trail,name:trail.at(-1)?.name||'initial',contexts:14,flags,errors:errors.runtime,contrast:data.contrast,controls:after};
    const shot=file.replace('.html','')+'-'+graphicsMode+'-'+(entry.states.length)+'.png';
    if(outDir&&screenshots&&(!trail.length||flags.some(x=>!x.exception))){await page.screenshot({path:path.join(outDir,shot)});state.screenshot=shot;}
    entry.states.push(state);
    if(!entry.stylesheets.length)entry.stylesheets=await page.locator('link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname));
    for(const c of after.filter(c=>c.visible&&c.disabled))if(!entry.disabled.some(x=>identity(x)===identity(c)))entry.disabled.push(c);
    // Link destinations are explicit observations even when the browser cannot navigate them in a synthetic fixture.
    for(const c of after.filter(c=>c.visible&&c.href&&!c.href.startsWith('#')))if(!entry.links.some(x=>x.from===c.selector))entry.links.push({from:c.selector,to:tourDestination(c.href,harness.base+'/'+file),status:'OBSERVED_HREF'});
    return after;
   }catch(error){entry.notOpened.push({trail,reason:'state failed',error:String(error.message)});return null;}finally{await context.close();}
  };
  const initial=await visit([]);
  if(initial){
   const baseline=new Set(initial.filter(c=>c.visible).map(identity));
   const walk=async(trail,known)=>{
    const result=await visit(trail);if(!result)return;
    const fresh=result.filter(c=>c.visible&&!c.disabled&&!known.has(identity(c)));
    if(trail.length>=depth){entry.beyondDepth.push(...fresh.map(action=>({trail,action,reason:'beyond declared depth'})));return;}
    const nextKnown=new Set([...known,...result.filter(c=>c.visible).map(identity)]);
    for(const action of fresh)await walk([...trail,action],nextKnown);
   };
   if(depth>0)for(const action of initial.filter(c=>c.visible&&!c.disabled))await walk([action],baseline);
   else entry.beyondDepth.push(...initial.filter(c=>c.visible&&!c.disabled).map(action=>({action,reason:'initial state only'})));
  }
  report.push(entry);if(outDir)await writeFile(path.join(outDir,'view-tour.partial.json'),JSON.stringify(report));
  console.log(`${file}/${graphicsMode}: ${entry.states.length} real states ×14, ${entry.notOpened.length} missing, ${entry.beyondDepth.length} beyond depth`);
 }
 }finally{await harness.close();}
 const sourceAfter=await snapshot(),topology=buildUiTopology();
 const states=report.flatMap(p=>p.states),missing=report.reduce((n,p)=>n+p.notOpened.length,0),open=states.flatMap(s=>s.flags).filter(f=>!f.exception),errors=states.reduce((n,s)=>n+s.errors.length,0);
 const criticalMissingAssets=[...harness.assets.missing].filter(name=>/\.(?:css|js|mjs|woff2?|json)$/.test(name));
 const expectedPrivate=Object.keys(pages),covered=new Set(report.filter(p=>p.states.length).map(p=>p.page));
 const result={schemaVersion:2,declaredDepth:depth,viewport:{width:390,height:844},generatedAt:new Date().toISOString(),scope:'Real private-page modules, synthetic data, per-graphics boot; computed fixed-paint inventory. Contrast is delegated to explicit canonical tests, never a full-app PASS.',
  expectedPrivatePages:expectedPrivate,requestedPages:only,omittedPrivatePages:expectedPrivate.filter(p=>!covered.has(p)),canonicalPages:topology.summary.pages,
  delegated:{contract:'scripts/ui-dynamic-theme-contract.json',tests:['tests/ui-dynamic-themes.browser.test.mjs','tests/ui313-regressions.browser.test.mjs'],status:'SEPARATE_EVIDENCE_REQUIRED'},
  provenance:{assets:{served:[...harness.assets.served],missing:[...harness.assets.missing],blocked:[...harness.assets.blocked],nativeFileChoosers:harness.assets.nativeFileChoosers,nativeShares:harness.assets.nativeShares},sourceSnapshot:sourceBefore,sourceStable:sourceBefore.sha256===sourceAfter.sha256,exceptionRegistry:'scripts/ui-fixed-color-exceptions.json'},
  summary:{pages:covered.size,graphicsRuns:report.length,realStates:states.length,paintContexts:states.length*14,notOpened:missing,beyondDepth:report.reduce((n,p)=>n+p.beyondDepth.length,0),unregisteredFixedPaints:open.length,runtimeErrors:errors,criticalMissingAssets:criticalMissingAssets.length},
  fixedPaintStatus:open.length||errors||missing||criticalMissingAssets.length||sourceBefore.sha256!==sourceAfter.sha256?'FAIL':'PASS',coverageStatus:missing||criticalMissingAssets.length||report.some(p=>p.beyondDepth.length)||expectedPrivate.some(p=>!covered.has(p))?'INCOMPLETE':'DECLARED_DEPTH_ONLY',contrastStatus:'NOT_MEASURED_BY_TOUR',pages:report};
 if(outDir)await writeFile(path.join(outDir,'view-tour.json'),JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 const only=process.argv[3]&&!process.argv[3].startsWith('--')?process.argv[3].split(','):Object.keys(pages);
 const depth=Number((process.argv.find(a=>a.startsWith('--depth='))||'--depth=3').slice(8));
 const result=await runViewTour({outDir:path.resolve(process.argv[2]||'.codex-tmp/view-tour'),only,depth});
 console.log(JSON.stringify({summary:result.summary,fixedPaintStatus:result.fixedPaintStatus,coverageStatus:result.coverageStatus,sourceStable:result.provenance.sourceStable}));
 process.exitCode=result.fixedPaintStatus==='PASS'&&result.coverageStatus!=='INCOMPLETE'?0:1;
}
