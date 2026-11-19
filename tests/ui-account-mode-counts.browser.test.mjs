import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createTourHarness} from '../scripts/lib/view-tour-harness.mjs';
import {inspectDynamicPaint} from '../scripts/dynamic-visual-map.mjs';

const livery=JSON.parse(await readFile(new URL('../scripts/ui-livery-contract.json',import.meta.url),'utf8'));
const modes=['standard','shared','memo','shared_memo'],counts=[0,12,123,1001];
const ids=['count-standard','count-shared','count-memo','count-shared-memo'];
const privateSelector=ids.map(id=>'#'+id).join(',');
const companySelector='.company-mode-count';
const output='.codex-tmp/account-mode-counts';

// Real producers consume records in the local memory adapter. No copied card markup,
// real identities, network access or direct replacement of the counter text.
function seeds(){
 const uid='synthetic-local-only',root='users/'+uid,result=[];
 for(const prefix of [root+'/accounts/',root+'/aziende/doc-0/accounts/']){
  for(const id of ['doc-0','doc-1'])result.push({path:prefix+id,value:{isArchived:true,views:0}});
  for(let mode=0;mode<modes.length;mode++)for(let i=0;i<counts[mode];i++)result.push({path:prefix+'counter-'+mode+'-'+i,value:{
   nomeAccount:'Contatore sintetico',type:mode>=2?'memo':'account',visibility:mode%2?'shared':'private',
   isArchived:false,views:0,ownerId:uid,userId:uid
  }});
 }
 return result;
}
const memorySeeds=seeds();
async function waitForCounts(page,selector){
 await page.waitForFunction(({selector,expected})=>JSON.stringify([...document.querySelectorAll(selector)].map(e=>e.textContent.trim()))===JSON.stringify(expected),{selector,expected:counts.map(String)},{timeout:15000});
}
async function pair(harness,graphics){
 const privateView=await harness.open('area_privata.html',{graphics,memorySeeds,theme:'light',palette:'lavender'});
 let companyView;
 try{
  companyView=await harness.open('lista_aziende.html',{graphics,memorySeeds,theme:'light',palette:'lavender'});
  await waitForCounts(privateView.page,privateSelector);await waitForCounts(companyView.page,companySelector);
  return {privateView,companyView};
 }catch(error){await privateView.context.close();await companyView?.context.close();throw error;}
}
const setContext=(page,context)=>page.evaluate(async({theme,palette,width})=>{
 document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.dataset.colorTheme=palette;
 await document.fonts.ready;
},context);
const styles=(page,selector)=>page.evaluate(selector=>[...document.querySelectorAll(selector)].map(e=>{
 const s=getComputedStyle(e),r=e.getBoundingClientRect(),card=e.closest('.matrix-card,.btn-company-account-mode')?.getBoundingClientRect();
 const properties=['color','backgroundColor','fontFamily','fontSize','fontWeight','lineHeight','minWidth','paddingTop','paddingRight','paddingBottom','paddingLeft','borderRadius','textAlign','boxShadow','backdropFilter'];
 return {text:e.textContent.trim(),id:e.id,href:e.closest('a')?.getAttribute('href')||null,style:Object.fromEntries(properties.map(p=>[p,s[p]])),
  geometry:{width:r.width,height:r.height,noTextOverflow:e.scrollWidth<=e.clientWidth+1,insideCard:!!card&&r.left>=card.left-1&&r.right<=card.right+1}};
}),selector);
function verifyShape(values,label){
 assert.equal(values.length,4,label+': four produced counters');
 assert.deepEqual(values.map(v=>v.text),counts.map(String),label+': real zero and multi-digit counts');
 for(const value of values){
  assert.ok(value.geometry.height>0&&value.geometry.width>0,label+': visible counter');
  assert.ok(parseFloat(value.style.borderRadius)>=value.geometry.height/2,label+': capsule, not a colored rectangle');
  assert.ok(value.geometry.noTextOverflow&&value.geometry.insideCard,label+': digits fit inside the counter and card '+value.text+' '+JSON.stringify(value.geometry));
 }
}
async function paint(page,selector,context){
 const ink=await inspectDynamicPaint(page,{selector,property:'color',role:'--text-primary',minimum:4.5},context);
 assert.equal(ink.length,4,'four measured counter texts');
 for(const value of ink){assert.ok(value.visible&&value.rolePass,'counter uses the readable text role');assert.equal(value.contrast?.status,'measured');assert.ok(value.contrast.pass,'counter contrast >=4.5:1');}
 const fill=await inspectDynamicPaint(page,{selector,property:'backgroundColor',role:'color-mix(in srgb, var(--accent) 16%, transparent)'},context);
 assert.equal(fill.length,4);assert.ok(fill.every(v=>v.visible&&v.rolePass),'counter retains the subtle Companies fill');
 return ink.map(v=>v.contrast.ratio);
}

test('private account counters match Companies across seven palettes and both liveries',{timeout:240000},async()=>{
 const harness=await createTourHarness({memory:true}),results=[];
 try{
  if(process.env.COUNTER_CAPTURE_STAGE){
   const preview=await pair(harness,'tre-livelli');
   try{await mkdir(output,{recursive:true});for(const [name,view]of [['private',preview.privateView],['companies',preview.companyView]]){
    await view.page.setViewportSize({width:393,height:844});await view.page.evaluate(()=>document.fonts.ready);
    await view.page.screenshot({path:output+'/'+process.env.COUNTER_CAPTURE_STAGE+'-'+name+'.png'});
   }}finally{await preview.privateView.context.close();await preview.companyView.context.close();}
  }
  for(const graphics of ['classica','tre-livelli']){
   const {privateView,companyView}=await pair(harness,graphics);
   try{
    const original=await styles(privateView.page,privateSelector);
    for(const width of livery.widths)for(const theme of livery.themes)for(const palette of livery.palettes){
     const context={graphics,width,theme,palette},label=JSON.stringify(context);
     for(const view of [privateView,companyView]){await view.page.setViewportSize({width,height:844});await setContext(view.page,context);}
     const actual=await styles(privateView.page,privateSelector),reference=await styles(companyView.page,companySelector);
     if(process.env.COUNTER_CAPTURE_STAGE&&results.length===0){
      await mkdir(output,{recursive:true});await writeFile(output+'/'+process.env.COUNTER_CAPTURE_STAGE+'-first-context.json',JSON.stringify({context,actual,reference},null,2));
     }
     verifyShape(actual,label+'/private');verifyShape(reference,label+'/companies');
     assert.deepEqual(actual.map(v=>v.style),reference.map(v=>v.style),label+': shared Companies UI');
     assert.deepEqual(actual.map(v=>({id:v.id,text:v.text,href:v.href})),original.map(v=>({id:v.id,text:v.text,href:v.href})),label+': identities, values and destinations unchanged');
     const ratios=await paint(privateView.page,privateSelector,context);await paint(companyView.page,companySelector,context);
     results.push({...context,minimumContrast:Math.min(...ratios)});
    }
   }finally{await privateView.context.close();await companyView.context.close();}
  }
  assert.equal(results.length,56);await mkdir(output,{recursive:true});await writeFile(output+'/matrix.json',JSON.stringify({status:'PASS',contexts:results},null,2));
 }finally{await harness.close();}
});

test('counter regression rejects shared rectangular or unreadable paint',{timeout:60000},async()=>{
 const harness=await createTourHarness({memory:true});
 try{
  const {privateView,companyView}=await pair(harness,'tre-livelli');
  try{
   for(const [view,selector]of [[privateView,privateSelector],[companyView,companySelector]]){
    await view.page.addStyleTag({content:selector.split(',').map(s=>s+'{border-radius:0!important}').join('')});
    const values=await styles(view.page,selector);assert.throws(()=>verifyShape(values,'negative rectangle'),/capsule/);
    await view.page.addStyleTag({content:selector.split(',').map(s=>s+'{color:var(--accent)!important;background:var(--accent)!important}').join('')});
    const unreadable=await inspectDynamicPaint(view.page,{selector,property:'color',role:'--accent',minimum:4.5},{theme:'light',graphics:'tre-livelli'});
    assert.equal(unreadable.length,4);for(const value of unreadable){assert.equal(value.contrast?.status,'measured');assert.equal(value.contrast.pass,false);assert.ok(value.contrast.ratio<1.01);}
   }
  }finally{await privateView.context.close();await companyView.context.close();}
 }finally{await harness.close();}
});
