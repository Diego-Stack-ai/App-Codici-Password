import test from 'node:test';
import assert from 'node:assert/strict';
import {createTourHarness} from '../scripts/lib/view-tour-harness.mjs';
import {collectDynamicPaint} from '../scripts/lib/dynamic-paint.mjs';
import {contrastRatio} from '../scripts/dynamic-visual-map.mjs';
const palettes=['blue','green','red','sand','petrol','lavender','dusty-rose'];
let harness;
test.before(async()=>{harness=await createTourHarness();});
test.after(async()=>{await harness?.close();});
async function appearance(page,theme,palette){await page.evaluate(({theme,palette})=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.dataset.colorTheme=palette;},{theme,palette});}
async function paint(page,locator){const index=await locator.evaluate(e=>[...document.body.querySelectorAll('*')].indexOf(e));return(await page.evaluate(collectDynamicPaint)).records.find(r=>r.index===index);}

test('real Sort and Archive filter menus keep readable text in all 28 contexts', {timeout:180000},async()=>{
  let checks=0;
  for(const graphics of ['classica','tre-livelli'])for(const [file,button,menu,value] of [
    ['scadenze.html','#sort-btn','#sort-menu','name-asc'],
    ['archivio_account.html','#archive-filter-btn','#archive-context-menu','privato']]){
    const {page,context}=await harness.open(file,{graphics});
    try{
      const writes=await page.evaluate(()=>window.__viewTourWrites||0);
      await page.locator(button).click();
      const item=page.locator(`${menu} .base-dropdown-item[data-value="${value}"]`);
      for(const theme of ['light','dark'])for(const palette of palettes){
        await appearance(page,theme,palette);
        for(const state of ['normal','hover','active']){
          if(state==='hover')await item.hover();
          if(state==='active'){await item.click();assert.equal(await page.locator(menu).evaluate(e=>e.classList.contains('show')),false);await page.locator(button).click();assert.equal(await item.evaluate(e=>e.classList.contains('active')),true);}
          const record=await paint(page,item);assert.ok(record?.effectiveFg&&record?.effectiveBg,`${file}/${graphics}/${theme}/${palette}/${state}: measured`);
          const ratio=contrastRatio(record.effectiveFg,record.effectiveBg);
          assert.ok(ratio>=4.5,`${file}/${graphics}/${theme}/${palette}/${state}: ${ratio.toFixed(2)}:1 < 4.5`);checks++;
          await page.mouse.move(0,0);
        }
        await page.locator(`${menu} .base-dropdown-item[data-value="${value==='privato'?'all':'date-asc'}"]`).click();
        await page.locator(button).click();
      }
      assert.equal((await page.evaluate(()=>window.__viewTourWrites||0))-writes,0,'sort/filter never writes repository data');
    }finally{await context.close();}
  }
  assert.equal(checks,168);
});

test('Cancel in real Document and General editors follows the palette and only dismisses editing', {timeout:180000},async()=>{
  let checks=0;
  for(const graphics of ['classica','tre-livelli'])for(const file of ['configurazione_documenti.html','configurazione_generali.html']){
    const {page,context}=await harness.open(file,{graphics});
    try{
      await page.locator('.collapsible-header').first().click({position:{x:30,y:30}});
      await page.locator('.btn-edit-item').first().click();
      const cancel=page.locator('.btn-cancel-inline').first();
      for(const theme of ['light','dark'])for(const palette of palettes){
        await appearance(page,theme,palette);await cancel.hover();
        const colors=await cancel.evaluate(e=>{const probe=document.createElement('span');probe.style.color='var(--accent)';e.append(probe);const result={actual:getComputedStyle(e).color,expected:getComputedStyle(probe).color};probe.remove();return result;});
        assert.equal(colors.actual,colors.expected,`${file}/${graphics}/${theme}/${palette}: Cancel is an ordinary action`);checks++;
      }
      const writes=await page.evaluate(()=>window.__viewTourWrites||0);await cancel.click();
      assert.equal(await page.locator('.btn-cancel-inline').count(),0);
      assert.equal((await page.evaluate(()=>window.__viewTourWrites||0))-writes,0,'Cancel performs no write');
    }finally{await context.close();}
  }
  assert.equal(checks,56);
});

test('Automezzi exercises the real rule editor and its explicit empty state in both graphics', {timeout:60000},async()=>{
  for(const graphics of ['classica','tre-livelli']){
    const {page,context}=await harness.open('configurazione_automezzi.html',{graphics});
    try{
      assert.equal(await page.locator('#vehicle-rule-editor').isVisible(),true);
      assert.equal(await page.locator('[data-vehicle-card]').count(),1);
      assert.ok(await page.locator('#vehicle-rule-editor input').count()>=8);
      await page.locator('#btn-add-email-object').click();
      assert.equal(await page.locator('[data-vehicle-card]').count(),2,'real Add vehicle producer runs');
    }finally{await context.close();}
    const empty=await harness.open('configurazione_automezzi.html',{graphics,query:'?rule=missing'});
    try{
      assert.equal(await empty.page.locator('#vehicle-rule-empty').isVisible(),true);
      for(const theme of ['light','dark'])for(const palette of palettes){
        await appearance(empty.page,theme,palette);
        assert.equal(await empty.page.locator('#vehicle-rule-empty a').evaluate(e=>{const probe=document.createElement('span');probe.style.color='var(--theme-ink)';e.append(probe);const same=getComputedStyle(e).color===getComputedStyle(probe).color;probe.remove();return same;}),true);
      }
    }finally{await empty.context.close();}
  }
});

test('frame toast uses the actual icon font for success, error and info', {timeout:30000},async()=>{
  const {page,context}=await harness.open('app.html');
  try{
    for(const type of ['success','error','info']){
      await page.evaluate(type=>window.__viewTour.Ui.showToast('Prova sintetica',type),type);
      await page.evaluate(()=>document.fonts.ready);
      const icon=await page.locator('#toast .toast-icon').evaluate(e=>({width:e.getBoundingClientRect().width,font:getComputedStyle(e).fontFamily}));
      assert.match(icon.font,/Material Symbols/);assert.ok(icon.width<=32,'ligature is a glyph, not its English identifier');
    }
  }finally{await context.close();}
});
