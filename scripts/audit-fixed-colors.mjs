#!/usr/bin/env node
// Exact source paint exceptions. A class name or ancestor never exempts an entire subtree.
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import colorNames from 'color-name';
export const cssRoot=fileURLToPath(new URL('../Frontend/public/assets/css/',import.meta.url));
export const fixedColorRegistry=JSON.parse(await readFile(new URL('./ui-fixed-color-exceptions.json',import.meta.url),'utf8'));
export const exceptionReasons=new Set(['comandi che cancellano o fanno uscire','scorrimento predefinito degli elenchi','campioni delle sette palette','esiti ed errori','scadenza scaduta (valutazione a vista di Diego)']);
export const normalizePaint=value=>value.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\s+/g,'').toLowerCase();
export const normalizeSelector=value=>value.trim().replace(/\s+/g,' ');
const palettes=['blue','green','red','sand','petrol','lavender','dusty-rose'];
const definitions=new Set(['--bg-primary','--viewport-edge-color','--text-primary','--text-secondary','--text-placeholder','--accent','--accent-rgb','--accent-hex','--accent-surface','--accent-surface-strong','--base-box-gradient','--qr-bg','--theme-ink','--theme-fill','--theme-fill-deep','--status-success','--status-warning','--status-error','--color-purple']);
for(const role of ['--companion-ink','--companion-card-ink','--companion-card-fill','--companion-fill','--companion-fill-deep'])definitions.add(role);
const paletteSelectors=new Set([':root','.dark',...[':root','.dark'].flatMap(root=>[
 ...palettes.map(p=>`${root}[data-color-theme="${p}"]`),`${root}:is([data-color-theme="petrol"], [data-color-theme="lavender"], [data-color-theme="dusty-rose"])`])]);
const chromatic=rgb=>Math.max(...rgb)-Math.min(...rgb)>=40;
export function fixedPaintKind(value,property='color'){
 let literal=false,reference=false,unsupported=false;
 const color=rgb=>{if(chromatic(rgb))literal=true;};
 valueParser(value).walk(node=>{
  if(node.type==='word'){
   const hex=node.value.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
   if(hex){let digits=hex[1];if(digits.length<5)digits=[...digits].map(c=>c+c).join('');color([0,2,4].map(i=>parseInt(digits.slice(i,i+2),16)));}
   else if(colorNames[node.value.toLowerCase()])color(colorNames[node.value.toLowerCase()]);
  }
  if(node.type!=='function')return;
  const name=node.value.toLowerCase(),inner=valueParser.stringify(node.nodes);
  if(name==='var'&&/^--(?:status-(?:success|error|warning|info)|color-purple)\b/.test(inner))reference=true;
  if(/^(?:rgb|rgba|hsl|hsla)$/.test(name)&&!inner.includes('var(')){
   const tokens=inner.split(/[\s,/]+/).filter(Boolean);if(tokens.length<3)return;
   if(name.startsWith('rgb')){const rgb=tokens.slice(0,3).map(v=>parseFloat(v)*(v.endsWith('%')?2.55:1));if(rgb.every(Number.isFinite))color(rgb);}
   else {const h=((parseFloat(tokens[0])%360)+360)%360,s=parseFloat(tokens[1])/100,l=parseFloat(tokens[2])/100;
    if([h,s,l].every(Number.isFinite)){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
     const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];color(rgb.map(v=>(v+m)*255));}}
  }
  // Unknown literal color spaces stay visible to the gate instead of silently passing.
  if(/^(?:hwb|lab|lch|oklab|oklch|color)$/.test(name)&&!inner.includes('var('))unsupported=true;
 });
 if(property.startsWith('--')&&/^\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$/.test(value))color(value.split(',').map(Number));
 return unsupported?'unparsed-color':literal?'literal':reference?'role-reference':null;
}
async function cssFiles(root,prefix=''){
 const files=[];for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){
  const name=path.posix.join(prefix,entry.name);if(entry.isDirectory())files.push(...await cssFiles(root,name));else if(entry.isFile()&&name.endsWith('.css'))files.push(name);
 }return files.sort();
}
export async function auditFixedColors(root=cssRoot,{registry=fixedColorRegistry}={}){
 const found=[];
 for(const file of await cssFiles(root)){
  const tree=postcss.parse(await readFile(path.join(root,file),'utf8'),{from:file});
  tree.walkDecls(decl=>{
   if(decl.parent.type!=='rule')return;
   const prop=decl.prop.toLowerCase();if(!prop.startsWith('--')&&!/^(?:color|background|border|outline|box-shadow|text-shadow|text-decoration|fill|stroke|stop-color|caret-color|accent-color|filter)/.test(prop))return;
   const kind=fixedPaintKind(decl.value,prop);if(!kind)return;
   const selectors=postcss.list.comma(decl.parent.selector).map(normalizeSelector);
   if(file==='core.css'&&definitions.has(prop)&&paletteSelectors.has(normalizeSelector(decl.parent.selector)))return;
   const matches=selectors.map(selector=>registry.exceptions.find(item=>exceptionReasons.has(item.reason)&&item.file===file&&item.selector===selector&&item.prop===prop&&normalizePaint(item.value)===normalizePaint(decl.value)));
   const exception=matches.every(Boolean)?[...new Set(matches.map(x=>x.reason))].join(' / '):null;
   found.push({file,line:decl.source.start.line,selector:normalizeSelector(decl.parent.selector),selectors,prop,value:decl.value,kind,exception,unregisteredSelectors:selectors.filter((_,i)=>!matches[i])});
  });
 }
 return found;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const found=await auditFixedColors(),open=found.filter(x=>!x.exception);
 const counts={};for(const x of found)counts[x.exception||'NON AMMESSO']=(counts[x.exception||'NON AMMESSO']||0)+1;
 console.log(`Pitture fisse CSS: ${found.length} (${found.filter(x=>x.kind==='literal').length} letterali, ${found.filter(x=>x.kind==='role-reference').length} riferimenti di stato)`);console.table(counts);
 for(const x of open)console.log(`NON AMMESSO ${x.file}:${x.line} ${x.selector} {${x.prop}:${x.value}}`);process.exitCode=open.length?1:0;
}
