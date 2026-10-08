// Synthetic UI only: no Firebase imports, credentials, enrollment or application bank.
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
const base = new URL('../../Frontend/public/assets/js/', import.meta.url);
const mfa = await readFile(new URL('modules/core/mfa-manager.js', base), 'utf8');
const dialog = mfa.slice(mfa.indexOf('function requestEnrollmentCode('), mfa.indexOf('export async function enrollTotp('));
const qr = await readFile(new URL('modules/shared/qr_code_utils.js', base), 'utf8');
const renderer = qr.slice(qr.indexOf('export function renderQRCode(')).replace('export function', 'function');
const vendor = await readFile(new URL('vendor/qrcode.min.js', base));
const html = `<!doctype html><meta charset="utf-8"><title>Collaudo TOTP sintetico</title>
<h1>Collaudo TOTP sintetico — nessun Auth reale</h1><button id="open">Apri prova</button><button id="logout">Simula logout</button><p id="result">Pronto</p>
<script src="/qr.js"></script><script>
const auth={currentUser:{uid:'synthetic'}}; let listener;
const onAuthStateChanged=(_auth,callback)=>{listener=callback;return()=>{listener=null;}};
const createElement=(tag,props={},children=[])=>{const el=document.createElement(tag);Object.assign(el,props);for(const child of children)el.append(child);return el;};
const setChildren=(el,children)=>el.replaceChildren(...(Array.isArray(children)?children:[children]));
const ensureQRCodeLib=()=>Promise.resolve();
${renderer}
${dialog}
document.getElementById('open').onclick=async()=>{
auth.currentUser={uid:'synthetic'};document.getElementById('open').disabled=true;
try{const result=await requestEnrollmentCode('otpauth://totp/Synthetic:test?secret=JBSWY3DPEHPK3PXP&issuer=Synthetic','SYNTHETIC-NOT-A-REAL-SECRET');document.getElementById('result').textContent=result===null?'Annullato':'Codice sintetico ricevuto';}
catch(error){document.getElementById('result').textContent=error.message;}
finally{document.getElementById('open').disabled=false;}
};
document.getElementById('logout').onclick=()=>{auth.currentUser=null;listener?.(null);};
</script>`;
const server = createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/qr.js'){res.setHeader('Content-Type','text/javascript');res.end(vendor);}
  else if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);}
  else {res.writeHead(404);res.end();}
});
server.listen(0,'127.0.0.1',()=>console.log(`Synthetic UI: http://127.0.0.1:${server.address().port}/`));
