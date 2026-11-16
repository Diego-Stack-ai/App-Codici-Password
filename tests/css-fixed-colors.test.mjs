import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {auditFixedColors,fixedColorRegistry,normalizePaint,exceptionReasons} from '../scripts/audit-fixed-colors.mjs';

// Giro completo dei temi (#313): nessun colore fisso decorativo nelle regole di stile,
// comprese quelle delle viste generate dopo un clic.
test('every fixed chromatic color in the stylesheets is a decided exception', async () => {
  const found = await auditFixedColors();
  const open = found.filter(item => !item.exception);
  assert.deepEqual(open.map(item => `${item.file}:${item.line} ${item.selector} { ${item.prop}: ${item.value} }`), [], 'fixed decorative colors must use the palette roles');
  assert.ok(found.length > 0 && found.filter(item=>item.kind==='literal').length <= 80, `exceptions stay a short reviewed list (${found.length})`);
});

test('the audit catches a new fixed decorative color and accepts a delete command', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fixed-colors-'));
  try {
    await writeFile(path.join(dir, 'account_form.css'), '.new-widget { color: #3b82f6; }\n.btn-remove-logo:hover { background: rgba(239,68,68,0.1); }\n.grey { color: #94a3b8; border: 1px solid rgba(var(--accent-rgb), 0.3); }\n');
    await writeFile(path.join(dir,'core.css'),':root { --accent: #137fec; }');
    const found = await auditFixedColors(dir);
    assert.deepEqual(found.map(item => [item.selector, item.exception]), [['.new-widget', null], ['.btn-remove-logo:hover', 'comandi che cancellano o fanno uscire']]);
  } finally { await rm(dir, {recursive: true, force: true}); }
});


test('exceptions cannot hide ordinary grouped selectors, confirmation dialogs, unrelated descendants or status variables',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'fixed-color-negative-'));
  try{
    await writeFile(path.join(dir,'sample.css'),[
      '.modal-box .btn-modal.btn-danger{color:#ef4444}',
      '.ordinary-help,.btn-delete-row{color:#ef4444}',
      '.deadline-card-expired .deadline-card-title{color:#ef4444}',
      '.diagnostics-actions .ordinary-refresh{color:#3b82f6}',
      '.ordinary-status-decoration{color:var(--status-success)}'
    ].join('\n'));
    const found=await auditFixedColors(dir);
    assert.equal(found.length,5,'each offending declaration is observed');
    assert.ok(found.every(item=>item.exception===null),'only the declared selector/property/value can be admitted');
  }finally{await rm(dir,{recursive:true,force:true});}
});


test('new syntax and a changed paint on an approved control stay unregistered',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'fixed-color-values-'));
 try{
  await writeFile(path.join(dir,'account_form.css'),'.btn-remove-logo:hover{background:#00f;color:#ef4444}.modern{color:rgb(0 0 100%)}.hsl{color:hsl(220 100% 50%)}.named{color:rebeccapurple}');
  const found=await auditFixedColors(dir);assert.equal(found.length,5);assert.ok(found.every(item=>item.exception===null));
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('the closed source registry contains no duplicate, stale or unclassified paint',async()=>{
 assert.equal(fixedColorRegistry.schemaVersion,1);
 const found=await auditFixedColors(),keys=new Set();
 for(const entry of fixedColorRegistry.exceptions){
  assert.deepEqual(Object.keys(entry).sort(),['file','prop','reason','selector','value']);
  assert.ok(exceptionReasons.has(entry.reason));
  const key=[entry.file,entry.selector,entry.prop,normalizePaint(entry.value)].join('|');assert.ok(!keys.has(key),'duplicate '+key);keys.add(key);
  assert.ok(found.some(p=>p.file===entry.file&&p.selectors.includes(entry.selector)&&p.prop===entry.prop&&normalizePaint(p.value)===normalizePaint(entry.value)),'stale '+key);
 }
});
