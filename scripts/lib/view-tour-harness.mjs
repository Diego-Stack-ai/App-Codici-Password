// Giro a schermo delle viste (#313): ogni pagina privata avvia il proprio modulo REALE
// (pages-init.js) contro un Firebase sintetico in memoria. Nessuna rete, nessun account,
// nessuna scrittura: le scritture sono contate e non hanno effetto. Non è una certificazione
// del runtime Firebase/Auth/Vault né di dispositivi fisici.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

export const publicRoot = fileURLToPath(new URL('../../Frontend/public/', import.meta.url));
// pagina → funzione di avvio esportata da pages-init.js
export const pages = {
  'home_page.html': 'initHomePage', 'area_privata.html': 'initAreaPrivata', 'account_privati.html': 'initAccountPrivati',
  'form_account_privato.html': 'initFormAccountPrivato', 'dettaglio_account_privato.html': 'initDettaglioAccountPrivato',
  'profilo_privato.html': 'initProfiloPrivato', 'impostazioni.html': 'initImpostazioni', 'archivio_account.html': 'initArchivioAccount',
  'scadenze.html': 'initScadenze', 'aggiungi_scadenza.html': 'initAggiungiScadenza', 'dettaglio_scadenza.html': 'initDettaglioScadenza',
  'regole_scadenze.html': 'initRegoleScadenze', 'gestione_destinatari.html': 'initGestioneDestinatari',
  'configurazione_automezzi.html': 'initConfigurazioneAutomezzi', 'configurazione_documenti.html': 'initConfigurazioneDocumenti',
  'configurazione_generali.html': 'initConfigurazioneRegoleGenerali', 'lista_aziende.html': 'initListaAziende',
  'modifica_azienda.html': 'initModificaAzienda', 'dati_azienda.html': 'initDatiAzienda', 'account_azienda.html': 'initAccountAziendaList',
  'dettaglio_account_azienda.html': 'initDettaglioAccountAzienda', 'form_account_azienda.html': 'initFormAccountAzienda'
};

// Firebase sintetico: ogni documento letto è un record inventato ricco di campi comuni.
const firebaseStub = `
const uid='synthetic-local-only';
const today=new Date();const iso=d=>new Date(today.getFullYear(),today.getMonth(),today.getDate()+d).toISOString().slice(0,10);
const record=(id,i=0)=>({id,nomeAccount:'Account sintetico '+i,nome:'Nome fittizio',cognome:'Locale',name:'Voce sintetica '+i,title:'Titolo sintetico '+i,
  titolo:'Titolo sintetico '+i,ragioneSociale:'Azienda inventata '+i,username:'utente.finto',email:'fixture@example.invalid',telefono:'0000000000',
  note:'Nota inventata',url:'https://example.invalid',type:'Documento',category:'Prova',categoria:'Prova',owner:'Persona fittizia',
  expiryDate:iso([-2,3,60,10][i%4]),date:iso([-2,3,60,10][i%4]),dueDate:iso([-2,3,60,10][i%4]),completed:i%4===3,
  createdAt:today,updatedAt:today,ownerId:uid,userId:uid,isBanking:i%2===1,views:i,pinned:i===0,
  color:'#3b82f6',active:true,enabled:true,items:[],fields:[],phones:[],emails:[],addresses:[],documents:[],attachments:[],recipients:[]});
const snap=(id,i)=>({id,exists:()=>true,data:()=>record(id,i),get:k=>record(id,i)[k],ref:{id,path:'synthetic/'+id}});
const many=()=>{const docs=[0,1,2,3].map(i=>snap('doc-'+i,i));return {docs,empty:false,size:docs.length,forEach:f=>docs.forEach(f),metadata:{fromCache:false}};};
const writes=()=>{window.__viewTourWrites=(window.__viewTourWrites||0)+1;return Promise.resolve({id:'synthetic-new'});};
export const getDocFromServer=async r=>snap(r?.id||'doc-0',0),getDocFromCache=getDocFromServer,getDocsFromServer=async()=>many(),getDocsFromCache=getDocsFromServer;
export const onSnapshot=(r,next)=>{queueMicrotask(()=>{try{next(r&&r.__single?snap(r.id,0):many())}catch(e){console.warn('snapshot',e)}});return()=>{}};
export const doc=(...a)=>({__single:true,id:String(a[a.length-1]||'doc-0'),path:a.filter(x=>typeof x==='string').join('/')});
export const collection=(...a)=>({id:'collection',path:a.filter(x=>typeof x==='string').join('/')}),query=(r)=>r,where=()=>({}),orderBy=()=>({}),limit=()=>({});
export const addDoc=writes,setDoc=writes,updateDoc=writes,deleteDoc=writes,uploadBytes=writes,deleteObject=writes,deleteToken=writes;
export const writeBatch=()=>({set(){},update(){},delete(){},commit:writes}),runTransaction=async()=>writes();
export const serverTimestamp=()=>new Date(),increment=n=>n,arrayUnion=(...a)=>a,deleteField=()=>null,Timestamp={now:()=>({toDate:()=>new Date(),seconds:0}),fromDate:d=>({toDate:()=>d,seconds:0})};
export const onAuthStateChanged=(auth,fn)=>{queueMicrotask(()=>fn(auth.currentUser));return()=>{}};
export const httpsCallable=()=>async()=>({data:{}}),getBytes=async()=>new ArrayBuffer(0),getDownloadURL=async()=>'data:,',ref=(...a)=>({fullPath:a.join('/')});
const noop=()=>({});export const initializeApp=noop,getApp=noop,getApps=()=>[{}],initializeAppCheck=noop,getAuth=noop,initializeFirestore=noop,getFirestore=noop,
  getStorage=noop,getFunctions=noop,getMessaging=noop,persistentLocalCache=noop,persistentMultipleTabManager=noop,getMultiFactorResolver=noop,multiFactor=()=>({enrolledFactors:[]});
export const isSupported=async()=>false,getMessagingToken=async()=>null,onMessage=()=>()=>{},setPersistence=async()=>{},signOut=writes,updatePassword=writes,updateProfile=writes,
  sendEmailVerification=writes,sendPasswordResetEmail=writes,signInWithEmailAndPassword=writes,createUserWithEmailAndPassword=writes,confirmPasswordReset=writes,verifyPasswordResetCode=writes;
export class ReCaptchaV3Provider{} export const TotpMultiFactorGenerator={},browserLocalPersistence={},browserSessionPersistence={};
`;
const configStub = `export const auth={currentUser:{uid:'synthetic-local-only',email:'fixture@example.invalid',emailVerified:true,displayName:'Prova locale',getIdToken:async()=>'synthetic',getIdTokenResult:async()=>({claims:{}})}};
export const db={},storage={},functions={};export const enableAppCheck=()=>{},getMessagingInstance=async()=>null;`;

// Vault sintetica già sbloccata: nessuna Master, nessuna chiave reale, cifratura passante.
const securityStub = `export const ensureVaultKeyMaterial=async()=>'synthetic-key-material',ensureMasterKey=ensureVaultKeyMaterial;
export const isVaultUnlocked=()=>true,isAutoUnlockActive=()=>true,isBiometricUnlockConfigured=()=>false,setFrameExpiryAuthority=()=>{};
export const softLock=()=>{},clearSession=()=>{},resetVault=async()=>{},enableBiometricUnlock=async()=>{},changeMasterPassword=async()=>{};
export const encrypt=async text=>String(text??''),decrypt=async value=>String(value??'');`;

export async function buildTourBundle() {
  const entry = `
import * as Pages from '/PUBLIC/assets/js/pages-init.js';
import {initComponents} from '/PUBLIC/assets/js/components-v129.js';
import {loadLanguage, applyGlobalTranslations} from '/PUBLIC/assets/js/translations.js';
import * as Ui from '/PUBLIC/assets/js/ui-core-v129.js';
window.__viewTour={errors:[],Ui};
window.addEventListener('error',e=>window.__viewTour.errors.push(String(e.message)));
window.addEventListener('unhandledrejection',e=>window.__viewTour.errors.push('rejection: '+String(e.reason?.message||e.reason)));
(async()=>{ const init=${JSON.stringify(pages)}[location.pathname.split('/').pop()];
  try { await loadLanguage('it'); await initComponents(); if(init) await Pages[init](window.__viewTourUser); try{applyGlobalTranslations()}catch{} }
  catch(error){ window.__viewTour.bootError=String(error?.stack||error); }
  document.body.hidden=false;document.body.inert=false;document.documentElement.dataset.i18n='ready';window.__viewTour.ready=true; })();
window.__viewTourUser={uid:'synthetic-local-only',email:'fixture@example.invalid',emailVerified:true,displayName:'Prova locale'};`;
  const stubs = new Map([['firebase-runtime.js', firebaseStub], ['firebase-config.js', configStub], ['security-manager.js', securityStub]]);
  const result = await build({stdin: {contents: entry, resolveDir: publicRoot, sourcefile: 'view-tour-entry.mjs'}, bundle: true, write: false, format: 'esm', splitting: false,
    platform: 'browser', target: 'chrome120', logLevel: 'silent',
    plugins: [{name: 'synthetic-firebase', setup(builder) {
      builder.onResolve({filter: /.*/}, args => {
        const stripped = args.path.split('?')[0];
        if (stripped.startsWith('/PUBLIC/')) return {path: path.join(publicRoot, stripped.slice(8))};
        if (stubs.has(path.basename(stripped))) return {path: path.basename(stripped), namespace: 'synthetic'};
        if (stripped.startsWith('/assets/')) return {path: path.join(publicRoot, stripped)};
        if (stripped !== args.path) return {path: path.resolve(args.resolveDir, stripped)};
      });
      builder.onLoad({filter: /.*/, namespace: 'synthetic'}, args => ({contents: stubs.get(args.path), loader: 'js'}));
    }}]});
  return result.outputFiles[0].text;
}

export async function createTourHarness() {
  const code = await buildTourBundle();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://local.invalid');
      if (url.pathname === '/__view-tour.js') { res.writeHead(200, {'Content-Type': 'text/javascript'}); res.end(code); return; }
      const file = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(publicRoot)) throw Error('outside');
      let body = await readFile(file);
      if (file.endsWith('.html')) body = body.toString()
        .replace(/<script\b[\s\S]*?<\/script>/gi, match => /src=["'][^"']*theme-init\.js/.test(match) ? match : '')
        .replace(/<body([^>]*)>/i, (m, a) => `<body${a.replace(/\s(?:hidden|inert)(?=[\s>])/g, '')}>`)
        .replace('</body>', '<script type="module" src="/__view-tour.js"></script></body>');
      const type = {'.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml'}[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': type}); res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : existsSync(chromium.executablePath()) ? {} : {channel: 'chrome'})});
  return {base,
    async open(file, {theme = 'dark', palette = 'green', graphics = 'classica', query = '?id=doc-0'} = {}) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
      const page = await context.newPage(); page.setDefaultTimeout(4000);
      await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
      await page.addInitScript(c => { localStorage.setItem('theme', c.theme); localStorage.setItem('color_theme', c.palette); localStorage.setItem('ui_graphics', c.graphics === 'classica' ? 'classic' : 'new');
        window.privateAuthGate = {isReady: () => true}; }, {theme, palette, graphics});
      page.on('dialog', dialog => dialog.dismiss());
      await page.goto(`${base}/${file}${query}`, {waitUntil: 'load'});
      await page.waitForFunction(() => window.__viewTour?.ready, {timeout: 20000}).catch(() => {});
      await page.waitForTimeout(400);
      await page.addStyleTag({content: '*,*::before,*::after{animation:none!important;transition:none!important}'});
      return {page, context};
    },
    async close() { await browser.close(); await new Promise(done => server.close(done)); }};
}
