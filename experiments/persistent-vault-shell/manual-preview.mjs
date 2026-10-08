// Reuses an already running synthetic bank. Never seeds or changes emulator Rules.
import {createServer} from 'node:http';
import {connect} from 'node:net';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {buildEmulator} from './build-emulator.mjs';

const args=process.argv.slice(2);
if(args.some(arg=>!['--build-only','--serve-built'].includes(arg)) || args.length>1)throw Error('Argomento non supportato');
const listening=port=>new Promise(resolve=>{
  const socket=connect({host:'127.0.0.1',port});
  let settled=false;
  const finish=value=>{if(settled)return;settled=true;socket.destroy();resolve(value);};
  socket.setTimeout(1500,()=>finish(false));socket.once('error',()=>finish(false));socket.once('connect',()=>finish(true));
});
if(!args.includes('--build-only')) {
  if(await listening(4188))throw Error('Porta4188 occupata: il banco esistente non viene interrotto.');
  const missing=[];
  for(const port of [8085,9099,9199])if(!await listening(port))missing.push(port);
  if(missing.length)throw Error(`Emulatori del banco non disponibili: ${missing.join(', ')}. Nessun seed o riavvio automatico.`);
}
if(!args.includes('--serve-built'))await buildEmulator({preview:true,persistent:false,realFunctions:false});
else await readFile(new URL('./dist/manual-preview/emulator.js',import.meta.url));
console.log('Build aggiornata separata: dist/manual-preview. Banco originale non sovrascritto.');
if(args.includes('--build-only'))process.exit(0);
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.FIREBASE_TOKEN;
Object.assign(process.env,{GCLOUD_PROJECT:'demo-vault-shell',GOOGLE_CLOUD_PROJECT:'demo-vault-shell',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
  FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199',STORAGE_EMULATOR_HOST:'http://127.0.0.1:9199',METADATA_SERVER_DETECTION:'none'});
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth');
const app=initializeApp({projectId:'demo-vault-shell'},'manual-preview-lookup');
const owners=[];
for(const email of ['a@example.invalid','b@example.invalid']) {
  try {owners.push((await getAuth(app).getUserByEmail(email)).uid);}
  catch(error) {if(error.code!=='auth/user-not-found')throw error;}
}
if(!owners.length)throw Error('Account sintetici del banco assenti. Nessun account creato: ripristinare il banco conservato.');
const {createEmulatorQrBridge}=await import('./emulator-qr-bridge.mjs');
const {createEmulatorNoteBridge}=await import('./emulator-note-bridge.mjs');
const note=createEmulatorNoteBridge(owners),qr=await createEmulatorQrBridge(owners);
const assets=new Map([['/',['emulator.html','text/html']],['/emulator.css',['emulator.css','text/css']],
  ['/emulator.js',['emulator.js','text/javascript']],['/symbols.woff2',['symbols.woff2','font/woff2']],
  ['/company-summary-pdf.js',['company-summary-pdf.js','text/javascript']],
  ['/assets/js/private-auth-gate.js',['assets/js/private-auth-gate.js','text/javascript']],
  ['/assets/js/vendor/qrcode.min.js',['assets/js/vendor/qrcode.min.js','text/javascript']],
  ['/assets/images/google-avatar.png',['assets/images/google-avatar.png','image/png']]]);
for(const name of ['LiberationSans-Regular.ttf','LiberationSans-Bold.ttf','LICENSE_LIBERATION'])
  assets.set(`/assets/pdf/${name}`,[`assets/pdf/${name}`,name.endsWith('.ttf')?'font/ttf':'text/plain']);
const server=createServer(async(req,res)=>{
  try {
    if(req.headers.host!=='127.0.0.1:4188'){res.writeHead(403).end();return;}
    if(await note(req,res)||await qr(req,res))return;
    const asset=assets.get(req.url);
    if(req.method!=='GET'||!asset){res.writeHead(404).end();return;}
    const body=await readFile(new URL(`./dist/manual-preview/${asset[0]}`,import.meta.url));
    res.writeHead(200,{'Content-Type':asset[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8085 http://127.0.0.1:9199; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}).end(body);
  } catch {if(!res.headersSent)res.writeHead(500);res.end();}
});
server.listen(4188,'127.0.0.1',()=>console.log('Anteprima aggiornata: http://127.0.0.1:4188 — solo banco sintetico esistente. Ctrl+C arresta solo questa anteprima.'));
