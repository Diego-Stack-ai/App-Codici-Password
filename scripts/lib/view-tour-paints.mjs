// Browser-side observations. Real graphics are selected by a fresh document bootstrap.
// Await the browser event loop, so delayed modal activation runs before observation.
export function settleTourUi(){return new Promise(resolve=>setTimeout(resolve,100));}
export function listTourControls(selector){
 const path=e=>{const parts=[];for(let n=e;n&&n!==document.body;n=n.parentElement){if(n.id&&!/\d{10,}/.test(n.id)&&document.querySelectorAll('#'+CSS.escape(n.id)).length===1){parts.unshift('#'+CSS.escape(n.id));return parts.join(' > ');}const tag=n.tagName.toLowerCase();parts.unshift(tag+':nth-of-type('+([...n.parentElement.children].filter(x=>x.tagName===n.tagName).indexOf(n)+1)+')');}return 'body > '+parts.join(' > ');};
 const dialogs=[...document.querySelectorAll('[role=dialog],.modal-overlay,.modal-profile-overlay,.attachment-source-picker')].filter(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility==='visible'&&Number(s.opacity)>0&&!e.closest('[hidden],[inert]');});
 return [...document.querySelectorAll(selector)].map(e=>{const rect=e.getBoundingClientRect(),s=getComputedStyle(e);const closed=[...e.closest('body').querySelectorAll('details:not([open])')].some(d=>d.contains(e)&&!d.querySelector(':scope > summary')?.contains(e));let opacity=1;for(let n=e;n;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity);
  return {selector:path(e),id:e.id||null,name:(e.getAttribute('aria-label')||e.title||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,100),tag:e.tagName.toLowerCase(),classes:typeof e.className==='string'?e.className:'',inDialog:!!e.closest('[role=dialog],.modal-overlay,.modal-profile-overlay'),href:e.getAttribute('href'),checked:'checked'in e?e.checked:null,
   visible:rect.width>0&&rect.height>0&&s.visibility==='visible'&&s.display!=='none'&&opacity>0&&!closed&&!e.closest('[hidden],[inert]'),disabled:e.disabled===true||e.getAttribute('aria-disabled')==='true'||s.pointerEvents==='none'||(dialogs.length>0&&!dialogs.some(d=>d.contains(e))),disabledReason:dialogs.length>0&&!dialogs.some(d=>d.contains(e))?'behind active dialog':null};
 });
}
export function captureTourPaints({graphics,exceptions,dynamicExceptions=[]}){
 const html=document.documentElement,body=document.body;
 const original={dark:html.classList.contains('dark'),palette:html.getAttribute('data-color-theme')};
 const elements=[...body.querySelectorAll('*')].filter(e=>!['SCRIPT','STYLE','TEMPLATE','NOSCRIPT'].includes(e.tagName));
 const label=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).filter(Boolean).slice(0,6).join('.'):'');
 const parse=value=>{if(!value||value==='none'||value==='transparent')return null;const n=value.match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number);if(!n||n.length<3)return null;const srgb=value.startsWith('color(srgb');return [n[0]*(srgb?255:1),n[1]*(srgb?255:1),n[2]*(srgb?255:1),n[3]??1];};
 const same=(a,b)=>{const solid=/^(?:rgba?\([^()]+\)|color\(srgb[^()]+\))$/;if(!solid.test(a)||!solid.test(b))return a.replace(/\s+/g,'')===b.replace(/\s+/g,'');const x=parse(a),y=parse(b);return x&&y&&x.slice(0,3).every((c,i)=>Math.abs(c-y[i])<=1.5)&&Math.abs(x[3]-y[3])<=1/255;};
 const slots=[['color','color'],['backgroundColor','background'],['borderTopColor','border'],['backgroundImage','image'],['boxShadow','shadow'],['outlineColor','outline']];
 const classify=(e,property,value)=>{const s=getComputedStyle(e);
 let exception=null;
    for(const entry of exceptions){
     if(property==='color'?!['color','--card-accent'].includes(entry.prop):
       property==='backgroundColor'||property==='backgroundImage'?!/^background/.test(entry.prop):
       property==='borderTopColor'?!/^border/.test(entry.prop):
       property==='boxShadow'?entry.prop!=='box-shadow':!/^outline/.test(entry.prop))continue;
     for(let target=e;target;target=property==='color'?target.parentElement:null){
      let matches=false;try{matches=target.matches(entry.selector);}catch{}if(!matches)continue;
      if(property==='color'&&target!==e&&!same(s.color,getComputedStyle(target).color))continue;
      const host=document.createElement('span'),probe=document.createElement('span');host.style.color='rgb(1,2,3)';probe.style.setProperty(entry.prop,entry.value);if(entry.prop.startsWith('--'))probe.style.color=entry.value;host.append(probe);target.append(host);
      const expected=getComputedStyle(probe)[property];host.style.color='rgb(251,252,253)';const independent=getComputedStyle(probe)[property];host.remove();
      if(same(expected,independent)&&same(value,expected)){exception={file:entry.file,selector:entry.selector,property:entry.prop,value:entry.value,reason:entry.reason};break;}
     }
     if(exception)break;
    }
    for(const entry of dynamicExceptions){if(exception)break;if(entry.property!==property)continue;
     let matches=false;try{matches=e.matches(entry.selector);}catch{}if(!matches)continue;
     if(entry.valueSource&&e.style[property]&&same(value,e.style[property]))exception={id:entry.id,property,reason:entry.meaning};
     if(entry.values?.some(v=>same(value,v)))exception={id:entry.id,property,reason:entry.meaning};
    }

 return exception;};
 const runs={};
 for(const theme of ['light','dark'])for(const palette of ['blue','green','red','sand','petrol','lavender','dusty-rose']){
  html.classList.toggle('dark',theme==='dark');html.dataset.colorTheme=palette;
  const records=[];
  for(let index=0;index<elements.length;index++){
   const e=elements[index],s=getComputedStyle(e),r=e.getBoundingClientRect();let opacity=1;for(let n=e;n;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity);
   if(!r.width||!r.height||s.visibility!=='visible'||s.display==='none'||opacity===0||e.closest('[hidden],[inert]'))continue;
   const hasText=[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()),icon=/material-symbols/.test(typeof e.className==='string'?e.className:'');
   const paints=[];
   for(const [property,kind]of slots){
    if(property==='color'&&!hasText&&!icon)continue;
    if(property==='borderTopColor'&&(parseFloat(s.borderTopWidth)===0||s.borderTopStyle==='none'))continue;
    if(property==='outlineColor'&&(parseFloat(s.outlineWidth)===0||s.outlineStyle==='none'))continue;
    const value=s[property];if(!value||value==='none')continue;
    const colors=(value.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)/g)||[]).map(parse).filter(Boolean);
    if(!colors.some(c=>c[3]*opacity>.02&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))>=40))continue;
    paints.push({property,kind,value,exception:null});
   }
   records.push({index,label:label(e),text:hasText,icon,paints});
  }
  runs[`${graphics}|${theme}|${palette}`]=records;
 }
 // Classify only paints that are actually fixed across all seven palettes.
 for(const theme of ['light','dark']){
  html.classList.toggle('dark',theme==='dark');html.dataset.colorTheme='blue';
  const contexts=['blue','green','red','sand','petrol','lavender','dusty-rose'].map(p=>runs[`${graphics}|${theme}|${p}`]);
  for(const record of contexts[0])for(const paint of record.paints){
   const copies=contexts.map(records=>records.find(r=>r.index===record.index)?.paints.find(p=>p.property===paint.property));
   if(copies.some(x=>!x)||!copies.every(x=>x.value===paint.value))continue;
   const exception=classify(elements[record.index],paint.property,paint.value);for(const copy of copies)copy.exception=exception;
  }
 }
 html.classList.toggle('dark',original.dark);if(original.palette===null)delete html.dataset.colorTheme;else html.dataset.colorTheme=original.palette;
 return {runs,contrast:{status:'NOT_MEASURED',verification:'tests/ui313-regressions.browser.test.mjs and the canonical dynamic contract measure their declared contrast pairs'}};
}
export function analyseTourPaints({runs}){
 const flags=[];const groups={};
 for(const [key,records]of Object.entries(runs)){const [graphics,theme,palette]=key.split('|');(groups[graphics+'|'+theme]??=[]).push({palette,records});}
 for(const [group,contexts]of Object.entries(groups)){
  const observations=new Map();
  for(const {palette,records}of contexts)for(const record of records)for(const paint of record.paints){const key=record.index+'|'+paint.property;const slot=observations.get(key)||{label:record.label,property:paint.property,values:[]};slot.values.push({palette,...paint});observations.set(key,slot);}
  for(const slot of observations.values()){
   if(slot.values.length!==7)continue;
   if(!slot.values.every(v=>v.value===slot.values[0].value))continue;
   flags.push({group,label:slot.label,property:slot.property,value:slot.values[0].value,exception:slot.values.every(v=>v.exception)?slot.values[0].exception:null});
  }
 }
 return flags;
}
