#!/usr/bin/env node
// A local map of declared dynamic UI states, not a certification of the whole app.
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createDynamicHarness} from './lib/dynamic-theme-harness.mjs';
import {collectDynamicPaint} from './lib/dynamic-paint.mjs';

export const contractPath=fileURLToPath(new URL('./ui-dynamic-theme-contract.json',import.meta.url));
export const loadDynamicContract=async()=>JSON.parse(await readFile(contractPath,'utf8'));
async function snapshotSources(harness,contract) {
  const toolRoot=fileURLToPath(new URL('../',import.meta.url));
  const files=new Map();
  const add=async(label,file)=>{files.set(label,createHash('sha256').update(await readFile(file)).digest('hex'));};
  for(const item of contract.cases)for(const relative of item.sources)if(relative.startsWith('Frontend/public/'))await add('runtime/'+relative.slice(16),path.join(harness.publicRoot,relative.slice(16)));
  const walk=async directory=>{for(const entry of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await walk(file);else if(entry.name.endsWith('.css'))await add('runtime/'+path.relative(harness.publicRoot,file).replaceAll('\\','/'),file);}};
  await walk(path.join(harness.publicRoot,'assets/css'));
  for(const input of harness.bundle.inputs)if(!input.startsWith('synthetic:')&&!input.endsWith('synthetic-dynamic-entry.mjs')) {
    const file=path.resolve(input);await add('runtime-input/'+path.relative(harness.publicRoot,file).replaceAll('\\','/'),file);
  }
  await add('runtime/assets/js/vendor/qrcode.min.js',path.join(harness.publicRoot,'assets/js/vendor/qrcode.min.js'));
  for(const relative of ['scripts/ui-dynamic-theme-contract.json','scripts/ui-color-decisions.json','scripts/dynamic-visual-map.mjs','scripts/lib/dynamic-theme-harness.mjs','scripts/lib/dynamic-theme-entry.mjs','scripts/lib/dynamic-paint.mjs','tests/ui-dynamic-themes.browser.test.mjs'])await add('tool/'+relative,path.join(toolRoot,relative));
  const entries=[...files].sort(([a],[b])=>a.localeCompare(b));
  return {publicRoot:harness.publicRoot,toolRoot,sha256:createHash('sha256').update(JSON.stringify(entries)).digest('hex'),files:entries.map(([path,sha256])=>({path,sha256}))};
}
const luminance=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((a,n,i)=>a+n*[.2126,.7152,.0722][i],0);
export const contrastRatio=(a,b)=>{const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Return actual computed values and expected roles in the SAME element scope.
// Unsupported paint is explicitly unmeasured. Hidden/missing expected targets fail.
export async function inspectDynamicPaint(page,paint,{theme}={}) {
  const values=await page.evaluate(({paint,theme})=>{
    const nodes=[...document.querySelectorAll(paint.selector)];
    return nodes.map(element=>{
      const style=getComputedStyle(element,paint.pseudo||null);
      const rect=element.getBoundingClientRect();
      let visible=!!rect.width&&!!rect.height;
      for(let node=element;node;node=node.parentElement){const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)visible=false;}
      const role=theme==='dark'&&paint.darkRole?paint.darkRole:paint.role;
      const roleNames=role.startsWith('--')?[role]:[...role.matchAll(/var\(\s*(--[\w-]+)/g)].map(match=>match[1]);
      const roleDeclarations=Object.fromEntries(roleNames.map(name=>[name,style.getPropertyValue(name).trim()]));
      const roleResolved=Object.values(roleDeclarations).every(value=>value.length>0);
      let expected=role;
      if(!['content','transform'].includes(paint.property)) {
        const probe=document.createElement('span');
        probe.style[paint.property]=role.startsWith('--')?`var(${role})`:role;
        // Inputs are void elements: an appended child has no computed style.
        (element.matches('input,img,canvas')?element.parentElement:element).append(probe);
        expected=getComputedStyle(probe)[paint.property];probe.remove();
      }
      const own=[...document.body.querySelectorAll('*')].indexOf(element);
      const actual=style[paint.property];
      const extra={fontSize:style.fontSize,fontWeight:style.fontWeight,opacity:style.opacity,
        backgroundColor:style.backgroundColor,color:style.color,backgroundImage:style.backgroundImage,
        boxShadow:style.boxShadow,filter:style.filter,outline:style.outline,
        pseudoBefore:{content:getComputedStyle(element,'::before').content,backgroundColor:getComputedStyle(element,'::before').backgroundColor,transform:getComputedStyle(element,'::before').transform},
        checked:element instanceof HTMLInputElement?element.checked:undefined,disabled:element.disabled===true};
      if(paint.kind==='headerContrast') {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
        const rgba=css=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=css;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
        const bg=rgba(getComputedStyle(element.closest('#header-placeholder')).backgroundColor),fg=rgba(style.color);
        const over=(c,b)=>b.map((v,i)=>c[i]*(c[3]/255)+v*(1-c[3]/255));
        extra.headerExtremes=[0,255].map(value=>{const backdrop=over(bg,[value,value,value]);return {bg:backdrop,fg:over(fg,backdrop)};});
      }
      return {own,actual,expected,visible,roleDeclarations,roleResolved,...extra};
    });
  },{paint,theme});
  let records;
  if(paint.minimum||paint.kind==='headerContrast') records=(await page.evaluate(collectDynamicPaint)).records;
  return values.map(value=>{
    const result={...value,rolePass:value.roleResolved&&value.actual===value.expected};
    if(paint.minimum) {
      const record=records.find(record=>record.index===value.own);
      if(record?.effectiveBg&&record?.effectiveFg) {
        result.contrast={status:'measured',ratio:contrastRatio(record.effectiveFg,record.effectiveBg),minimum:paint.minimum};
        result.contrast.pass=result.contrast.ratio+0.005>=paint.minimum;
      } else result.contrast={status:'unmeasured',reason:'Unsupported backdrop, missing visible text or image paint',pass:false};
      if(value.headerExtremes) {
        result.headerContrast={ratios:value.headerExtremes.map(p=>contrastRatio(p.fg,p.bg)),minimum:paint.minimum,
          method:'Computed translucent header over solid black and solid white; pseudo veil separately asserted absent'};
        result.headerContrast.pass=result.headerContrast.ratios.every(r=>r+.005>=paint.minimum);
      }
    }
    return result;
  });
}

export async function verifyDynamicState(page,item,state,context,{omitTrigger=false,registrations={exceptions:[],function:[]}}={}) {
  const checks=[];const add=(name,pass,details={})=>checks.push({name,...details,status:pass?'PASS':'FAIL'});
  if(!omitTrigger) await page.evaluate(async({id,state})=>{if(!window.__dynamicTheme?.trigger)throw Error('Missing real producer composition');await window.__dynamicTheme.trigger(id,state);},{id:item.id,state});
  const triggered=await page.evaluate(()=>window.__dynamicLastTrigger);
  add('real producer trigger',triggered?.id===item.id&&triggered?.phase===state,{actual:triggered||null});
  const graphics=await page.evaluate(()=>({body:document.body.dataset.uiRevision,html:document.documentElement.dataset.uiGraphics}));
  add('real bootstrap retains graphics marker',graphics.body===context.graphics&&(context.graphics!=='classica'||graphics.html==='classic'),{actual:graphics});
  if(['UI275-04','UI275-10'].includes(item.id)&&(state==='hover'||state==='focus')){
    const target=item.id==='UI275-04'?'.vault-assistant-help':'.guide-close-button';
    if(state==='hover')await page.locator(target).hover();else await page.locator(target).focus();
  }
  if(item.id==='UI275-02'&&state==='focus')await page.locator('#frame-resume').focus();
  if(state==='focus') {
    const target=item.id==='UI275-02'?'#frame-resume':item.id==='UI275-04'?'.vault-assistant-help':'.guide-close-button';
    const focused=await page.evaluate(selector=>{const el=document.querySelector(selector),style=el&&getComputedStyle(el);return !!el&&document.activeElement===el&&style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>=1;},target);
    add('actual focus target has a visible outline',focused);
  }
  for(const paint of item.paints) {
    if(paint.states&&!paint.states.includes(state))continue;
    const values=await inspectDynamicPaint(page,paint,context);
    add(`${paint.selector} exists and visible`,values.length>0&&values.every(v=>v.visible),{paint,values});
    for(const value of values) {
      add(`${paint.selector} ${paint.property} follows role`,value.rolePass,{actual:value.actual,expected:value.expected});
      if(value.contrast)add(`${paint.selector} contrast`,value.contrast.pass,{...value.contrast,measurementStatus:value.contrast.status});
      if(value.headerContrast)add(`${paint.selector} black/white backdrop contrast`,value.headerContrast.pass,value.headerContrast);
      if(paint.property==='boxShadow') {
        const colors=[...value.actual.matchAll(/rgba?\(([^)]+)\)/g)];
        const lengths=value.actual.replace(/rgba?\([^)]+\)/g,'').match(/-?[\d.]+px/g)?.map(parseFloat)||[];
        add('ordinary action shadow at most 12% / 10px',value.actual==='none'||colors.length===1&&Number(colors[0][1].split(',')[3]??1)<=.12&&lengths[2]<=10,{actual:value.actual});
      }
    }
  }
  if(item.id==='UI275-01') {
    const actual=await page.evaluate(()=>({bootstrap:window.__dynamicHasRealThemeBootstrap,palette:document.documentElement.dataset.colorTheme,dark:document.documentElement.classList.contains('dark')}));
    add('real HTML loads theme-init',actual.bootstrap,{actual});
    add('bootstrap resolves selected palette/theme',actual.palette===context.palette&&actual.dark===(context.theme==='dark'),{actual});
    if(state==='changed') {
      const other=context.palette==='petrol'?'red':'petrol';
      const otherTheme=context.theme==='dark'?'light':'dark';
      const origin=new URL(page.url()).origin;
      const child=await page.context().newPage();
      try {
        await child.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
        await child.goto(origin+'/app.html',{waitUntil:'load'});
        await child.evaluate(({other,otherTheme})=>{localStorage.setItem('color_theme',other);localStorage.setItem('theme',otherTheme);},{other,otherTheme});
        await page.waitForFunction(({other,otherTheme})=>document.documentElement.dataset.colorTheme===other&&document.documentElement.classList.contains('dark')===(otherTheme==='dark'),{other,otherTheme},{timeout:2500});
        add('persistent parent follows authentic cross-document palette/theme storage events',true,{documents:2});
        const nextGraphics=context.graphics==='classica'?'tre-livelli':'classica';
        await child.evaluate(next=>localStorage.setItem('ui_graphics',next==='classica'?'classic':'new'),nextGraphics);
        await page.waitForTimeout(30);
        add('graphics stays fixed for the current parent Document',await page.evaluate(graphics=>document.body.dataset.uiRevision===graphics,context.graphics));
        await child.reload({waitUntil:'load'});await child.waitForFunction(()=>window.__dynamicThemeReady||window.__dynamicThemeError);
        add('new child Document adopts the saved graphics preference',await child.evaluate(graphics=>document.body.dataset.uiRevision===graphics,nextGraphics));
        await child.evaluate(()=>localStorage.clear());await page.waitForTimeout(30);
        add('storage clear also preserves current parent graphics',await page.evaluate(graphics=>document.body.dataset.uiRevision===graphics,context.graphics));
        await child.evaluate(graphics=>localStorage.setItem('ui_graphics',graphics==='classica'?'classic':'new'),context.graphics);
        await child.evaluate(({palette,theme})=>{localStorage.setItem('color_theme',palette);localStorage.setItem('theme',theme);},context);
        await page.waitForFunction(({palette,theme})=>document.documentElement.dataset.colorTheme===palette&&document.documentElement.classList.contains('dark')===(theme==='dark'),context,{timeout:2500});
      } finally{await child.close();}
    }
    if(state==='reloaded') {
      await page.reload({waitUntil:'load'});await page.waitForFunction(()=>window.__dynamicThemeReady||window.__dynamicThemeError);
      add('reload uses selected palette',await page.evaluate(p=>document.documentElement.dataset.colorTheme===p,context.palette));
    }
  }
  if(item.id==='UI275-04') add('help is actually toggled',await page.evaluate(state=>document.querySelector('.vault-assistant-instructions').hidden===(state==='closed'),state));
  if(item.id==='UI275-05'&&state==='scrolled')add('real profile main scroller moved under the header',await page.evaluate(()=>document.querySelector('main.base-main').scrollTop>0));
  if(item.id==='UI275-06') {
    if(state!=='digital-card'){
      const actual=await page.evaluate(()=>{const input=document.querySelector('#qr-toggle-nome'),pseudo=getComputedStyle(input,'::before');return{checked:input.checked,transform:pseudo.transform,tickShadow:pseudo.boxShadow};});
      add('checkbox click changes real control and pseudo tick',actual.checked===(state==='checked')&&(state==='checked'?actual.transform==='matrix(1, 0, 0, 1, 0, 0)':actual.transform==='matrix(0, 0, 0, 0, 0, 0)'),{actual});
      add('real QR inclusion handler updates its synthetic data model',await page.evaluate(expected=>window.__dynamicTheme.state.qrCodeInclusions.nome===expected,state==='checked'));
      if(state==='checked')add('checkbox pseudo tick keeps white ink on the tested primary fill',/rgb\(255, 255, 255\)/.test(actual.tickShadow),{actual:actual.tickShadow});
    } else add('real digital-card choices rendered',await page.locator('.digital-card-choice input').count()>3);
  }
  if(item.id==='UI275-07') {
    const target=state==='zoom'?'#qr-enlarged':'#qrcode-header';
    const qr=await page.evaluate(selector=>{const host=document.querySelector(selector),canvas=host?.querySelector('canvas');if(!canvas)return null;const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;const colors=new Set();for(let i=0;i<data.length;i+=4)colors.add([...data.slice(i,i+4)].join(','));return{width:canvas.width,height:canvas.height,colors:[...colors]};},target);
    add('actual QR producer preserves readable black/quiet-zone pixels',!!qr&&qr.colors.includes('0,0,0,255')&&qr.colors.includes('227,242,253,255'),{actual:qr});
  }
  if(item.id==='UI275-08'){
    add('real widget collapse state',await page.locator('.profile-widget-body').count()===(state==='collapsed'?0:1));
    if(state==='color-default')add('new uncolored widget identity follows theme',await page.locator('.profile-widget-identity[data-color-role="theme"]').count()===1);
    if(state==='color-custom')add('saved custom widget color is preserved on its identity only',await page.evaluate(()=>{const icon=document.querySelector('.profile-widget-identity[data-color-role="custom"]');return !!icon&&getComputedStyle(icon).color==='rgb(192, 38, 211)';}));
  }
  if(item.id==='UI275-09'){
    add('one selected tab after actual click/key',await page.locator('.profile-tab.is-active').count()===1);
    if(state!=='keyboard')add('actual click selected personal tab',await page.locator('[data-profile-tab-target="personal"]').getAttribute('aria-selected')==='true');
    if(state==='keyboard')add('End key activates digital card',await page.locator('[data-profile-tab-target="digital-card"]').getAttribute('aria-selected')==='true');
    if(state==='scrolled')add('tab strip actually scrolls',await page.evaluate(()=>document.querySelector('.profile-tabs').scrollLeft>0));
  }
  if(item.id==='UI275-03'&&state==='disabled')add('real attachment limit disables upload',await page.evaluate(()=>[...document.querySelectorAll('.profile-document-attachments-dialog .attachment-source-picker-grid button')].every(b=>b.disabled)));
  if(item.id==='UI275-03'&&['picker','dialog','disabled'].includes(state))add('all four real source choices present',await page.evaluate(()=>JSON.stringify([...document.querySelectorAll('.attachment-source-picker-grid button')].map(button=>button.dataset.source).sort())===JSON.stringify(['camera','card','document','gallery'])));
  if(item.id==='UI275-11'){
    const cls={valid:'info',upcoming:'upcoming',expired:'expired',completed:'completed'}[state];
    add('real deadline bucket present',await page.locator(`.deadline-card-${cls}`).count()>0,{bucket:cls});
  }
  const inventory=(await page.evaluate(collectDynamicPaint)).records;
  const classified=await page.evaluate(({records,registrations,graphics})=>{
    const elements=[...document.body.querySelectorAll('*')];
    const prop={color:'color',backgroundColor:'bg',borderTopColor:'border'};
    const hue=rgb=>{const [r,g,b]=rgb.map(n=>n/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;if(!d)return null;return((max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4)*60+360)%360;};
    return records.map(record=>{
      const element=elements[record.index],registered={};
      for(const rule of registrations.exceptions||[])if(element?.matches(rule.selector)&&prop[rule.property]) {
        const value=record[prop[rule.property]];
        const allowed=!rule.values||rule.values.some(hex=>/^#[0-9a-f]{6}$/i.test(hex)&&value&&[1,3,5].every((offset,i)=>Math.abs(parseInt(hex.slice(offset,offset+2),16)-value[i])<1));
        if(allowed)registered[prop[rule.property]]={id:rule.id,kind:'registered-custom',meaning:rule.meaning};
      }
      for(const group of registrations.function||[])for(const paint of group.paints||[])if((!paint.revisions||paint.revisions.includes(graphics))&&element?.matches(paint.selector))for(const p of paint.properties||[]) {
        const h=record[p]&&hue(record[p]);
        const valid=h!==null&&(paint.hue==='red'?(h<12||h>=345):paint.hue==='amber'?(h>=20&&h<=50):paint.hue==='green'?(h>=85&&h<=170):false);
        if(valid)registered[p]={id:group.id,kind:'registered-semantic',hue:paint.hue};
      }
      return {...record,registered};
    });
  },{records:inventory,registrations,graphics:context.graphics});
  return {id:item.id,page:item.page,state,context,checks,inventory:classified,status:checks.every(check=>check.status==='PASS')?'PASS':'FAIL'};
}

// Reconnaissance is separate from the declared-state checks. Seven palettes are
// required before a paint can be called fixed; absent contexts are not a PASS.
export function compareDynamicInventory(results,palettes) {
  const groups=new Map();
  for(const result of results)for(const record of result.inventory||[])for(const property of ['color','bg','border']) {
    const value=record[property];if(!value)continue;
    const key=[result.id,result.state,result.context.graphics,result.context.theme,record.index,record.label,property].join('|');
    let group=groups.get(key);if(!group){group={id:result.id,state:result.state,graphics:result.context.graphics,theme:result.context.theme,index:record.index,label:record.label,property,registration:record.registered?.[property]||{kind:'unregistered'},values:{}};groups.set(key,group);}
    group.values[result.context.palette]=value;
  }
  const fixed=[];let incomplete=0;
  for(const group of groups.values()) {
    if(palettes.some(p=>!group.values[p])){incomplete++;continue;}
    const values=Object.values(group.values),first=values[0];
    if(Math.max(...first)-Math.min(...first)<40)continue;
    if(values.every(v=>v.every((n,i)=>Math.abs(n-first[i])<1)))fixed.push(group);
  }
  return {scope:'All visible painted DOM recorded after each declared trigger. Fixed candidates are reconnaissance, not automatic defects or a complete UI certification.',comparedGroups:groups.size,incompleteGroups:incomplete,
    counts:{registeredCustom:fixed.filter(x=>x.registration.kind==='registered-custom').length,registeredSemantic:fixed.filter(x=>x.registration.kind==='registered-semantic').length,unregistered:fixed.filter(x=>x.registration.kind==='unregistered').length},fixedCandidates:fixed};
}

export async function runDynamicMap({publicRoot,outDir,contexts,cases,mutationCss='',omitProducer=false,omitTrigger=false,omitGraphicsMarker=false}={}) {
  const contract=await loadDynamicContract();
  const decisions=JSON.parse(await readFile(new URL('./ui-color-decisions.json',import.meta.url),'utf8'));
  const dynamicSemantic=contract.cases.flatMap(item=>item.paints.filter(p=>p.semanticHue).map(p=>({id:item.id+'-'+p.semanticHue,paints:[{selector:p.selector,properties:[{color:'color',backgroundColor:'bg',borderTopColor:'border'}[p.property]],hue:p.semanticHue}]})));
  const registrations={exceptions:contract.exceptions,function:[...(decisions.function||[]),...dynamicSemantic]};
  const matrix=contexts||contract.matrix.graphics.flatMap(graphics=>contract.matrix.themes.flatMap(theme=>contract.matrix.palettes.map(palette=>({graphics,theme,palette}))));
  const selected=cases?contract.cases.filter(item=>cases.includes(item.id)):contract.cases;
  const harness=await createDynamicHarness({publicRoot,mutationCss,omitProducer,omitGraphicsMarker});const results=[];
  const sourceSnapshot=await snapshotSources(harness,contract);
  try {
    for(const context of matrix) for(const file of [...new Set(selected.flatMap(item=>item.states.map(state=>item.statePages?.[state]||item.page)))]) {
      let page;
      try {
        page=await harness.open(file,context);
        for(const item of selected) for(const state of item.states.filter(state=>(item.statePages?.[state]||item.page)===file)) {
          try {results.push(await verifyDynamicState(page,{...item,page:file},state,context,{omitTrigger,registrations}));}
          catch(error){results.push({id:item.id,page:file,state,context,status:'FAIL',checks:[{name:'real producer execution',status:'FAIL',error:error.message}]});}
        }
      } catch(error){for(const item of selected)for(const state of item.states.filter(state=>(item.statePages?.[state]||item.page)===file))results.push({id:item.id,page:file,state,context,status:'FAIL',checks:[{name:'page/producer bootstrap',status:'FAIL',error:error.message}]});}
      finally{if(page)await page.context().close();}
    }
  }finally{await harness.close();}
  const sourceStable=sourceSnapshot.sha256===(await snapshotSources(harness,contract)).sha256;
  const byId=selected.map(item=>({id:item.id,states:item.states.length,contexts:matrix.length,expected:item.states.length*matrix.length,executed:results.filter(r=>r.id===item.id).length,pass:results.filter(r=>r.id===item.id&&r.status==='PASS').length,fail:results.filter(r=>r.id===item.id&&r.status==='FAIL').length}));
  const report={schemaVersion:1,generatedAt:new Date().toISOString(),scope:contract.scope,viewport:{width:390,height:844},sourceRoot:harness.publicRoot,contextCount:matrix.length,
    status:sourceStable&&results.every(r=>r.status==='PASS')?'PASS':'FAIL',totals:{states:results.length,pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length,unmeasured:results.flatMap(r=>r.checks).filter(c=>c.measurementStatus==='unmeasured').length},
    byId,inventory:compareDynamicInventory(results,contract.matrix.palettes),provenance:{contract:'scripts/ui-dynamic-theme-contract.json',sourceSnapshot,sourceStable,contractSha256:createHash('sha256').update(JSON.stringify(contract)).digest('hex'),bundleSha256:createHash('sha256').update(harness.bundle.code).digest('hex'),realInputs:harness.bundle.inputs,syntheticAdapters:harness.bundle.stubs,servedLocalFiles:[...new Set(harness.served)],externalRequestsBlocked:harness.blocked.length},limits:contract.limits,results};
  if(outDir){await mkdir(outDir,{recursive:true});await writeFile(path.join(outDir,'dynamic-visual-map.json'),JSON.stringify(report,null,2));
    const rows=results.map(r=>`<tr><td>${escape(r.id)}</td><td>${escape(r.page)}</td><td>${escape(Object.values(r.context).join(' / '))}</td><td>${escape(r.state)}</td><td class="${r.status}">${r.status}</td><td><details><summary>${r.checks.length} controlli</summary><pre>${escape(JSON.stringify(r.checks,null,2))}</pre></details></td></tr>`).join('');
    await writeFile(path.join(outDir,'dynamic-visual-map.html'),`<!doctype html><meta charset="utf-8"><title>Mappa dinamica locale</title><style>body{font:16px system-ui;max-width:1400px;margin:auto;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;vertical-align:top}.FAIL{color:#a00}.PASS{color:#075}pre{white-space:pre-wrap;max-width:700px}summary{cursor:pointer}</style><h1>Mappa dinamica: 11 famiglie dichiarate</h1><p>${escape(report.scope)}</p><p>${report.contextCount} contesti · ${report.totals.pass} stati PASS · ${report.totals.fail} stati FAIL. Le assenze e i non misurati non valgono PASS.</p><ul>${report.limits.map(x=>`<li>${escape(x)}</li>`).join('')}</ul><h2>Esito dei controlli dichiarati: ${report.status}</h2><p>Fonti immutate durante il giro: ${sourceStable}. Il PASS riguarda i selettori e gli stati dichiarati.</p><h2>Inventario del DOM aperto</h2><p>${escape(report.inventory.scope)}</p><p>${report.inventory.comparedGroups} gruppi confrontati; ${report.inventory.incompleteGroups} incompleti. Conteggi candidati fissi: ${escape(JSON.stringify(report.inventory.counts))}. I non registrati richiedono classificazione: non sono stati automaticamente promossi a PASS.</p><details><summary>Candidati e pitture registrate</summary><pre>${escape(JSON.stringify(report.inventory.fixedCandidates,null,2))}</pre></details><h2>Conteggi per ID</h2><pre>${escape(JSON.stringify(byId,null,2))}</pre><h2>Fonti e adattatori</h2><details><summary>Provenienza</summary><pre>${escape(JSON.stringify(report.provenance,null,2))}</pre></details><table><thead><tr><th>ID</th><th>Pagina</th><th>Contesto</th><th>Stato</th><th>Esito</th><th>Misure</th></tr></thead><tbody>${rows}</tbody></table>`);}
  return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const report=await runDynamicMap({outDir:path.resolve(process.argv[2]||'.codex-tmp/dynamic-visual-map')});
  console.log(JSON.stringify({status:report.status,contextCount:report.contextCount,totals:report.totals,byId:report.byId}));
  process.exitCode=report.status==='PASS'?0:1;
}
