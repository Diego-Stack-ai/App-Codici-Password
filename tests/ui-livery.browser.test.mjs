import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createTourHarness} from '../scripts/lib/view-tour-harness.mjs';
import {inspectDynamicPaint} from '../scripts/dynamic-visual-map.mjs';

// Read the actual bounded metadata declaration without importing the browser's Firebase dependencies.
const componentsSource=await readFile(new URL('../Frontend/public/assets/js/components-v129.js',import.meta.url),'utf8');
const symbolDeclaration=componentsSource.match(/export const pageSymbols = Object\.freeze\(\{[\s\S]*?\}\);/)?.[0];
assert.ok(symbolDeclaration,'actual page symbol declaration exists');
const {pageSymbols}=await import('data:text/javascript;base64,'+Buffer.from(symbolDeclaration).toString('base64'));

const contract=JSON.parse(await readFile(new URL('../scripts/ui-livery-contract.json',import.meta.url),'utf8'));
const output='.codex-tmp/livery-verification';
const hsl=([r,g,b])=>{
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,d=max-min;
  const s=d===0?0:d/(1-Math.abs(2*l-1));
  let h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return [(h*60+360)%360,s,l];
};

export function decorationState(){
 const body=document.body,container=document.querySelector('.page-container'),title=document.querySelector('.header-title');
 const mark=document.querySelector('.archive-watermark'),glyph=mark?.querySelector('.material-symbols-outlined');
 const style=mark&&getComputedStyle(mark),before=title&&getComputedStyle(title,'::before'),after=container&&getComputedStyle(container,'::after');
 return {revision:body.dataset.uiRevision,graphics:document.documentElement.dataset.uiGraphics,
   symbol:body.style.getPropertyValue('--page-symbol'),largeCount:document.querySelectorAll('.archive-watermark').length,
   large:{symbol:glyph?.textContent,hidden:mark?.getAttribute('aria-hidden'),display:style?.display,opacity:style?.opacity,pointer:style?.pointerEvents},
   title:{content:before?.content,display:before?.display,pointer:before?.pointerEvents},
   small:{content:after?.content,display:after?.display,fontSize:after?.fontSize,opacity:after?.opacity,pointer:after?.pointerEvents}};
}
const validDecorations=(state,symbol)=>state.revision==='tre-livelli'&&state.largeCount===1&&state.large.symbol===symbol&&state.large.hidden==='true'&&state.large.display!=='none'&&Number(state.large.opacity)>0&&state.large.pointer==='none'&&state.title.content?.includes(symbol)&&state.title.pointer==='none'&&state.small.content?.includes(symbol)&&state.small.display==='block'&&state.small.fontSize==='72px'&&Number(state.small.opacity)>0&&state.small.pointer==='none';

test('shared title icons fit between real form header controls at 320 pixels',{timeout:60000},async()=>{
 const harness=await createTourHarness({memory:true});
 try{
  for(const file of ['form_account_privato.html','form_account_azienda.html','aggiungi_scadenza.html','modifica_azienda.html'])for(const graphics of ['classica','tre-livelli']){
   const f=await harness.open(file,{graphics});
   try{
    await f.page.setViewportSize({width:320,height:844});await f.page.evaluate(()=>document.fonts.ready);
    const geometry=await f.page.evaluate(()=>{
     const header=document.querySelector('.base-header'),title=header.querySelector('.header-title'),box=title.getBoundingClientRect(),outer=header.getBoundingClientRect();
     const overlaps=[...header.querySelectorAll('.btn-icon-header')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&box.left<r.right-1&&box.right>r.left+1&&box.top<r.bottom-1&&box.bottom>r.top+1;}).map(e=>e.id||e.textContent.trim());
     return {inside:box.left>=outer.left-1&&box.right<=outer.right+1&&box.top>=outer.top-1&&box.bottom<=outer.bottom+1,overlaps,titleOverflow:title.scrollWidth>title.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>320};
    });
    assert.deepEqual(geometry,{inside:true,overlaps:[],titleOverflow:false,pageOverflow:false},file+'/'+graphics);
   }finally{await f.context.close();}
  }
 }finally{await harness.close();}
});

test('the two liveries keep the same evolved geometry and all decorations on 22 real routes',{timeout:240000},async()=>{
 const harness=await createTourHarness({memory:true}),baseline=new Map(),observed=[];
 try{
  for(const [file,symbol] of Object.entries(pageSymbols))for(const graphics of ['classica','tre-livelli']){
   const f=await harness.open(file,{graphics});
   try{
    for(const width of contract.widths){
     await f.page.setViewportSize({width,height:844});
     await f.page.evaluate(()=>document.fonts.ready);
     const state=await f.page.evaluate(decorationState);
     assert.ok(validDecorations(state,symbol),`${file}/${graphics}/${width}: ${JSON.stringify(state)}`);
     assert.equal(state.graphics,graphics==='classica'?'classic':'new');
     const layout=await f.page.evaluate(()=>{
      const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility==='visible';};
      return {manage:[...document.querySelectorAll('.manage-toggle')].map(e=>({name:e.textContent,pressed:e.getAttribute('aria-pressed')})),
       cards:[...document.querySelectorAll('.matrix-card,.settings-menu-item,.profile-widget-header')].filter(visible).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {width:Math.round(r.width),height:Math.round(r.height),display:s.display,background:s.backgroundImage};})};
     });
     const key=`${file}/${width}`;
     if(graphics==='classica')baseline.set(key,layout);else assert.deepEqual(layout,baseline.get(key),key+': livery cannot change geometry, commands or card surfaces');
     observed.push({page:file,width,graphics,state});
    }
    const module=await f.page.evaluate(()=>{window.__viewTour.installPageDecorations(document,location.pathname);return document.querySelectorAll('.archive-watermark').length;});
    assert.equal(module,1,'decoration producer is idempotent');
   }finally{await f.context.close();}
  }
  assert.equal(observed.length,22*2*2);
  await mkdir(output,{recursive:true});await writeFile(output+'/decorations.json',JSON.stringify({status:'PASS',contexts:observed},null,2));
 }finally{await harness.close();}
});

test('all seven palettes keep companion ink and the 15 percent card increase exclusively in New',{timeout:600000},async()=>{
 const harness=await createTourHarness({memory:true}),results=[],failures=[];
 await mkdir(output,{recursive:true});
 try{
  for(const file of Object.keys(pageSymbols))for(const graphics of ['classica','tre-livelli']){
   const f=await harness.open(file,{graphics});
   try{
    // Search has its real footer producer but Main is deliberately replaced by the synthetic composition.
    await f.page.evaluate(()=>document.getElementById('search-status')?.classList.remove('hidden'));
    if(await f.page.locator('#search-status').count())await f.page.addStyleTag({url:harness.base+'/assets/css/vault-assistant.css'});
    for(const width of contract.widths){
     await f.page.setViewportSize({width,height:844});
     for(const theme of contract.themes)for(const palette of contract.palettes){
      await f.page.evaluate(({theme,palette})=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.dataset.colorTheme=palette;},{theme,palette});
      const label=`${file}/${graphics}/${width}/${theme}/${palette}`;
      const colors=await f.page.evaluate(()=>{
       const color=role=>{const p=document.createElement('span');p.style.color=`var(${role})`;document.body.append(p);const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.fillStyle=getComputedStyle(p).color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3);p.remove();return rgb;};
       return {base:color('--companion-ink'),enhanced:color('--companion-card-ink'),actual:color('--card-icon-ink'),primary:color('--theme-ink'),declared:getComputedStyle(document.body).getPropertyValue('--companion-card-ink').trim()};
      });
      const [baseHue,baseSat,baseL]=hsl(colors.base),[newHue,newSat,newL]=hsl(colors.enhanced);
      assert.ok(Math.abs(newL-baseL)<=.005,label+': preserve icon lightness');
      assert.ok(Math.min(Math.abs(newHue-baseHue),360-Math.abs(newHue-baseHue))<=4,label+': preserve companion hue');
      const declaredSat=Number(colors.declared.match(/\s([\d.]+)%/)?.[1])/100;
      assert.ok(Math.abs(declaredSat-Math.min(1,baseSat*contract.cardSaturationMultiplier))<.000001,label+': declared card saturation is exactly +15 percent');
      // Painting/Canvas quantizes each RGB channel to 8 bits; the declared HSL above is exact.
      assert.ok(Math.abs(newSat-declaredSat)<=.013,label+': painted saturation follows the declared color within RGB quantization');
      assert.deepEqual(colors.actual,graphics==='classica'?colors.primary:colors.enhanced,label+': Classic never receives the companion or increase');
      let measured=0;
      const selectors=contract.cardGlyphs.join(',');
      const cardPaint={selector:selectors,property:'color',role:'--card-icon-ink',minimum:3};
      const values=await inspectDynamicPaint(f.page,cardPaint,{theme});
      for(const value of values){
       if(!value.visible)continue;
       const filled=await f.page.evaluate(index=>{const node=[...document.body.querySelectorAll('*')][index];return !!node?.closest('.company-profile-page .settings-icon-box.icon-blue,.company-profile-page .settings-icon-box.icon-purple,.matrix-icon-box.icon-blue,.matrix-icon-box.icon-purple');},value.own);
       if(filled)continue;
       if(!value.rolePass||!value.contrast?.pass){
        const ancestry=failures.length<80?await f.page.evaluate(index=>{const list=[];for(let node=[...document.body.querySelectorAll('*')][index];node&&list.length<5;node=node.parentElement){const s=getComputedStyle(node);list.push({tag:node.tagName,class:node.className,color:s.color,bg:s.backgroundColor,image:s.backgroundImage,opacity:s.opacity});}return list;},value.own):[];
        failures.push({label,kind:'card',role:value.rolePass,contrast:value.contrast,actual:value.actual,expected:value.expected,ancestry});
       }measured++;
      }
      if(await f.page.locator(contract.filledCardGlyphs.join(',')).count())for(const value of await inspectDynamicPaint(f.page,{selector:contract.filledCardGlyphs.join(','),property:'color',role:'#fff',minimum:3},{theme}))if(value.visible)if(!value.rolePass||!value.contrast?.pass)failures.push({label,kind:'filled-card',role:value.rolePass,contrast:value.contrast,background:value.backgroundColor,image:value.backgroundImage,index:value.own});
      const footerPaints=graphics==='tre-livelli'?[{selector:'#search-status > .material-symbols-outlined,.footer-settings-link > .material-symbols-outlined,#profile-guide-button > .material-symbols-outlined',role:'--companion-ink'}]:[{selector:'#search-status > .material-symbols-outlined',role:'--theme-ink'},{selector:'.footer-settings-link > .material-symbols-outlined,#profile-guide-button > .material-symbols-outlined',role:'--text-primary'}];
      for(const paint of footerPaints){
       if(!await f.page.locator(paint.selector).count())continue;
       for(const value of await inspectDynamicPaint(f.page,{...paint,property:'color',minimum:3},{theme}))if(value.visible)if(!value.rolePass||!value.contrast?.pass)failures.push({label,kind:'footer',selector:paint.selector,role:value.rolePass,contrast:value.contrast,actual:value.actual,expected:value.expected});
      }
      if(file==='home_page.html'){
       const actions=f.page.locator('#footer-center-actions .fab-group button');assert.equal(await actions.count(),3,label+': all three quick actions are present');
       assert.equal(await f.page.locator('.base-footer button,.base-footer a').count(),5,label+': the real Home footer has all five controls');
       const role=graphics==='tre-livelli'?'--companion-fill':'--theme-fill';
       for(const value of await inspectDynamicPaint(f.page,{selector:'.btn-fab-privato',property:'backgroundColor',role},{theme}))assert.ok(value.rolePass,label+': actual private quick action fill');
      }
      results.push({page:file,graphics,width,theme,palette,cardGlyphs:measured});
     }
    }
    if(['home_page.html','profilo_privato.html','impostazioni.html','dati_azienda.html'].includes(file)){
     await f.page.screenshot({path:output+'/'+file.replace('.html','')+'-'+graphics+'.png',fullPage:true});
    }
   }finally{await f.context.close();}
  }
  assert.equal(results.length,22*2*2*2*7);assert.ok(results.filter(r=>r.page==='home_page.html').every(r=>r.cardGlyphs===4));
  await mkdir(output,{recursive:true});await writeFile(output+'/colors.json',JSON.stringify({status:failures.length?'FAIL':'PASS',contexts:results,failures},null,2));
  assert.equal(failures.length,0,JSON.stringify(failures.slice(0,8),null,2));
 }finally{await harness.close();}
});

test('decoration checks reject a missing symbol, a hidden watermark and a form without common CSS',{timeout:30000},async()=>{
 const harness=await createTourHarness({memory:true}),f=await harness.open('form_account_privato.html');
 try{
  const symbol=pageSymbols['form_account_privato.html'];assert.ok(validDecorations(await f.page.evaluate(decorationState),symbol));
  await f.page.evaluate(()=>document.body.style.setProperty('--page-symbol','none'));
  assert.equal(validDecorations(await f.page.evaluate(decorationState),symbol),false);
  await f.page.evaluate(()=>document.body.style.setProperty('--page-symbol',"'key'"));
  await f.page.locator('.archive-watermark').evaluate(e=>e.style.display='none');
  assert.equal(validDecorations(await f.page.evaluate(decorationState),symbol),false);
  await f.page.locator('.archive-watermark').evaluate(e=>e.style.display='');
  await f.page.evaluate(()=>{for(const link of document.querySelectorAll('link[rel=stylesheet]'))if(link.href.includes('/core_ui.css'))link.disabled=true;});
  assert.equal(validDecorations(await f.page.evaluate(decorationState),symbol),false);
 }finally{await f.context.close();await harness.close();}
});
