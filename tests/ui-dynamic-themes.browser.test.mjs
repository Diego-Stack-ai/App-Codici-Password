import test from 'node:test';
import assert from 'node:assert/strict';
import {runDynamicMap,compareDynamicInventory,contrastRatio,inspectDynamicPaint} from '../scripts/dynamic-visual-map.mjs';

test('eleven dynamic UI families exercise their real producers in all 28 contexts', {timeout:300000}, async()=>{
  const report=await runDynamicMap({outDir:'.codex-tmp/ui-dynamic-map-test'});
  const failures=report.results.filter(item=>item.status!=='PASS').map(({id,state,context,checks})=>({id,state,context,checks:checks.filter(check=>check.status!=='PASS')}));
  assert.equal(report.contextCount,28);
  assert.equal(report.byId.length,11);
  assert.equal(report.totals.states,1064,'all 38 declared states, without dropping one to make the suite green');
  for(const group of report.byId)assert.equal(group.executed,group.expected,`${group.id}: no missing states`);
  assert.equal(report.totals.unmeasured,0,'declared contrast checks must be measurable, never assumed PASS');
  assert.equal(failures.length,0,JSON.stringify(failures.slice(0,8),null,2));
  assert.equal(report.status,'PASS');
});

const fourContexts=['tre-livelli','classica'].flatMap(graphics=>['light','dark'].map(theme=>({graphics,theme,palette:'red'})));

test('header livery roles reject swapped variants, missing roles and unreadable paint', {timeout:60000}, async()=>{
  const selector='#header-placeholder .btn-icon-header .material-symbols-outlined';
  for(const [graphics,mutationCss] of [
    ['tre-livelli',`${selector}{color:var(--text-primary)!important}`],
    ['classica',`${selector}{color:var(--companion-ink)!important}`],
    ['tre-livelli','body[data-ui-revision]{--companion-ink:initial!important}'],
    ['tre-livelli',`${selector}{color:var(--rev-popup)!important}`]
  ]){
    const report=await runDynamicMap({contexts:[{graphics,theme:'light',palette:'red'}],cases:['UI275-05'],mutationCss});
    assert.equal(report.status,'FAIL',`${graphics}: mutation rejected`);
    assert.ok(report.results.every(result=>result.checks.some(check=>check.name.includes('follows role')&&check.status==='FAIL')));
    if(mutationCss.includes('initial'))assert.ok(report.results.flatMap(result=>result.checks).flatMap(check=>check.values||[]).some(value=>value.roleResolved===false));
    if(mutationCss.includes('color:var(--rev-popup)'))assert.ok(report.results.every(result=>result.checks.some(check=>check.name.includes('contrast')&&check.status==='FAIL')));
  }
  await assert.rejects(inspectDynamicPaint(null,{newRole:'--companion-ink'}),/explicit graphics context/);
});
test('negative controls: fixed blue widget border and intense blue guide glow fail in both graphics/themes', {timeout:90000}, async()=>{
  const report=await runDynamicMap({contexts:fourContexts,cases:['UI275-08','UI275-10'],
    mutationCss:'.profile-widget{border-top-color:#38bdf8!important}.guide-close-button{box-shadow:0 10px 25px rgba(37,99,235,.3)!important}'});
  for(const context of fourContexts)for(const id of ['UI275-08','UI275-10']) {
    const group=report.results.filter(result=>result.id===id&&JSON.stringify(result.context)===JSON.stringify(context));
    assert.ok(group.length>0);
    assert.ok(group.every(result=>result.status==='FAIL'),`${id}/${context.graphics}/${context.theme}: mutation detected`);
  }
});

test('negative control: omitting real producer, actual trigger or bootstrap marker cannot yield PASS', {timeout:30000}, async()=>{
  for(const option of [{omitProducer:true},{omitTrigger:true},{omitGraphicsMarker:true}]) {
    const report=await runDynamicMap({contexts:[fourContexts[0]],cases:['UI275-10'],...option});
    assert.equal(report.status,'FAIL');
    assert.ok(report.results.every(result=>result.status==='FAIL'));
  }
});

test('inventory requires seven palettes and retains unregistered fixed paints separately',()=>{
  const palettes=['blue','green','red','sand','petrol','lavender','dusty-rose'];
  const row=palette=>({id:'synthetic',state:'open',context:{graphics:'classica',theme:'light',palette},inventory:[{index:1,label:'button',color:[20,90,200]}]});
  assert.equal(compareDynamicInventory(palettes.slice(0,6).map(row),palettes).fixedCandidates.length,0);
  assert.equal(compareDynamicInventory(palettes.map(row),palettes).fixedCandidates.length,1);
  const changed=palettes.map(row);changed[3].inventory[0].color=[100,90,30];
  assert.equal(compareDynamicInventory(changed,palettes).fixedCandidates.length,0);
  assert.equal(contrastRatio([0,0,0],[255,255,255]),21);
});

test('unresolved CSS roles fail even when actual and probe both become transparent', {timeout:20000},async()=>{
  const report=await runDynamicMap({contexts:[fourContexts[0]],cases:['UI275-02'],
    mutationCss:'body[data-ui-revision]{--rev-fill:initial!important}'});
  assert.equal(report.status,'FAIL');
  assert.ok(report.results.every(result=>result.checks.some(check=>check.name.includes('follows role')&&check.status==='FAIL')));
  assert.ok(report.results.flatMap(result=>result.checks).flatMap(check=>check.values||[]).some(value=>value.roleResolved===false));
});

test('unsupported painted backgrounds are unmeasured and cannot be contrast PASS', {timeout:20000},async()=>{
  const report=await runDynamicMap({contexts:[fourContexts[0]],cases:['UI275-02'],
    mutationCss:'#frame-resume{background-image:radial-gradient(red,blue)!important}'});
  assert.equal(report.status,'FAIL');
  assert.ok(report.totals.unmeasured>0);
});
