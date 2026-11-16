import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createTourHarness} from './view-tour-harness.mjs';
import {captureTourPaints,analyseTourPaints,settleTourUi} from './view-tour-paints.mjs';
import {collectDynamicPaint} from './dynamic-paint.mjs';
import {contrastRatio} from '../dynamic-visual-map.mjs';
import {fixedColorRegistry} from '../audit-fixed-colors.mjs';
import dynamicContract from '../ui-dynamic-theme-contract.json' with {type:'json'};

export const palettes=['blue','green','red','sand','petrol','lavender','dusty-rose'];
// Contrast is sampled only where text is actually painted on screen. Layout boxes
// alone include clipped fields and swipe actions covered by the foreground card.
export function visibleDeepTextIndices(indices){
 const nodes=[...document.body.querySelectorAll('*')],visible=[],excluded=[];
 for(const index of indices){const node=nodes[index];if(!node)continue;let inViewport=false,inClip=false,seen=false;
  let target=node;if(getComputedStyle(node).pointerEvents==='none'){for(target=node.parentElement;target&&getComputedStyle(target).pointerEvents==='none';target=target.parentElement){/* nearest hit-testable ancestor only */}}
  const rectangles=[...node.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).flatMap(text=>{const range=document.createRange();range.selectNodeContents(text);return [...range.getClientRects()];});
  for(const box of rectangles){let left=Math.max(0,box.left),right=Math.min(innerWidth,box.right),top=Math.max(0,box.top),bottom=Math.min(innerHeight,box.bottom);if(right<=left||bottom<=top)continue;inViewport=true;
   for(let parent=node.parentElement;parent&&right>left&&bottom>top;parent=parent.parentElement){const s=getComputedStyle(parent),r=parent.getBoundingClientRect();if(/hidden|clip|scroll|auto/.test(s.overflowX)){left=Math.max(left,r.left);right=Math.min(right,r.right);}if(/hidden|clip|scroll|auto/.test(s.overflowY)){top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}}
   if(right<=left||bottom<=top)continue;inClip=true;
   for(const [x,y]of [[.5,.5],[.2,.2],[.8,.2],[.2,.8],[.8,.8]]){const front=document.elementFromPoint(left+(right-left)*x,top+(bottom-top)*y);if(front&&(front===target||node.contains(front))){seen=true;break;}}if(seen)break;
  }if(seen)visible.push(index);else excluded.push({index,reason:!inViewport?'OFF_VIEWPORT':!inClip?'CLIPPED':'OCCLUDED'});
 }return {visible,excluded};
}
export async function createDeepDriver({outDir,measure=true}={}){
 const harness=await createTourHarness({memory:true});
 const states=[],failures=[],events=[];
 if(outDir)await mkdir(outDir,{recursive:true});
 const open=async(file,graphics,options={})=>{
  const f=await harness.open(file,{graphics,...options});
  const page=f.page,context=f.context;
  const click=async locator=>{
   // Clear the preceding hover before the next normal action, including after a palette sweep.
   await page.mouse.move(0,0);
   const id=await locator.getAttribute('id');
   const closing=['confirm-cancel-btn','confirm-ok-btn'].includes(id)?await page.locator('#protocol-confirm-modal').elementHandle():['modal-cancel-btn','modal-confirm-btn'].includes(id)?await page.locator('#protocol-input-modal').elementHandle():null;
   await locator.click();
   if(closing){await page.waitForFunction(node=>!node.isConnected,closing);await closing.dispose();}
   await page.evaluate(settleTourUi);
  };
  const profileField=label=>page.locator('#profile-edit-modal .glass-field-container').filter({has:page.locator('.view-label').filter({hasText:new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')})});
  const selectProfile=async(label,value)=>{const box=profileField(label);await click(box.locator('.custom-select-trigger'));await click(box.locator('.custom-option').filter({hasText:new RegExp('^'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'))}).first().locator('span').first());};
  const profileInput=(label)=>profileField(label).locator('input,textarea').first();
  const manage=async title=>{if(graphics==='tre-livelli'){const button=page.getByRole('button',{name:'Modifica: '+title,exact:true});if(await button.count()&&await button.isVisible())await click(button);}};
  const expand=async section=>{const header=page.locator('.collapsible-header[data-section="'+section+'"]');if(await header.count()&&await header.evaluate(e=>e.classList.contains('collapsed')))await click(header.locator('h3').first());};
  const state=async(caseId,name,{root='body',contrast=true}={})=>{
   await page.evaluate(settleTourUi);await page.evaluate(()=>document.fonts.ready);
   const selected=typeof root==='string'?page.locator(root).last():root;
   await selected.waitFor({state:'visible'});await selected.scrollIntoViewIfNeeded();
   const errors=await page.evaluate(()=>window.__viewTour.errors);assert.deepEqual(errors,[],caseId+'/'+name+': runtime errors');
   const missing=[...harness.assets.missing].filter(p=>/\.(css|js|mjs|woff2?|json)$/.test(p));assert.deepEqual(missing,[],caseId+'/'+name+': missing runtime asset');
   const record={caseId,page:file,observedPage:new URL(page.url()).pathname.split('/').pop(),graphics,name,contexts:measure?14:0,fixed:[],contrast:[],excludedText:[],contrastScope:'Hit-tested ordinary text in viewport and scroll clips; inputs/icons/borders/filters and optical occlusion through non-hit-testable layers are outside this compositor.',root:typeof root==='string'?root:'semantic locator',readiness:f.readiness};
   if(measure){
    record.fixed=analyseTourPaints(await page.evaluate(captureTourPaints,{graphics,exceptions:fixedColorRegistry.exceptions,dynamicExceptions:[...dynamicContract.exceptions,...fixedColorRegistry.runtimePaints]})).filter(f=>!f.exception);
    const indices=await selected.evaluate(e=>[...document.body.querySelectorAll('*')].flatMap((node,i)=>e.contains(node)?[i]:[]));
    const initial=await page.evaluate(()=>({dark:document.documentElement.classList.contains('dark'),palette:document.documentElement.dataset.colorTheme}));
    try{if(contrast)for(const theme of ['light','dark'])for(const palette of palettes){
      await page.evaluate(({theme,palette})=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.dataset.colorTheme=palette;},{theme,palette});
      const data=await page.evaluate(collectDynamicPaint);
      const candidates=data.records.filter(r=>indices.includes(r.index)&&r.text&&!r.icon),visibility=await page.evaluate(visibleDeepTextIndices,candidates.map(r=>r.index)),texts=candidates.filter(r=>visibility.visible.includes(r.index));
      record.excludedText.push({theme,palette,...Object.fromEntries(['OFF_VIEWPORT','CLIPPED','OCCLUDED'].map(reason=>[reason,visibility.excluded.filter(e=>e.reason===reason).length]))});
      assert.ok(texts.length,caseId+'/'+name+': no text measured');
      for(const r of texts){const ratio=r.effectiveFg&&r.effectiveBg?contrastRatio(r.effectiveFg,r.effectiveBg):null,minimum=r.fontSize>=24||(r.fontSize>=18.6667&&r.fontWeight>=700)?3:4.5;record.contrast.push({theme,palette,label:r.label,index:r.index,fontSize:r.fontSize,fontWeight:r.fontWeight,ratio,minimum,status:ratio===null?'UNMEASURED':ratio>=minimum?'PASS':'FAIL'});}
    }}finally{await page.evaluate(initial=>{document.documentElement.classList.toggle('dark',initial.dark);document.documentElement.dataset.colorTheme=initial.palette;},initial);}
   }
   states.push(record);if(outDir)await writeFile(outDir+'/partial.json',JSON.stringify({states,failures,events}));
   return record;
  };
  const log=async()=>page.evaluate(()=>window.__viewTourMemory.operations.map(o=>({kind:o.kind,path:o.path,name:o.name,keys:Object.keys(o.payload||o.command||{})})));
  const data=async path=>page.evaluate(path=>window.__viewTourMemory.read(path),path);
  const event=(caseId,name,detail={})=>events.push({caseId,page:file,graphics,name,...detail});
  return {...f,graphics,click,profileField,profileInput,selectProfile,manage,expand,state,log,data,event,close:()=>context.close()};
 };
 return {open,states,failures,events,harness,async close(){await harness.close();},async finish(){const checks=states.flatMap(s=>s.contrast),result={scope:'Named deep UI workflows; real producers, synthetic local state and explicit native boundaries. No Firebase/Auth/Vault or physical-device certification.',states,events,failures,summary:{states:states.length,contexts:states.reduce((n,s)=>n+s.contexts,0),fixed:states.reduce((n,s)=>n+s.fixed.length,0),contrastFail:checks.filter(x=>x.status==='FAIL').length,unmeasured:checks.filter(x=>x.status==='UNMEASURED').length,failures:failures.length},assets:{missing:[...harness.assets.missing],blocked:[...harness.assets.blocked],nativeFileChoosers:harness.assets.nativeFileChoosers,nativeShares:harness.assets.nativeShares}};if(outDir)await writeFile(outDir+'/report.json',JSON.stringify(result,null,2));return result;}};
}
