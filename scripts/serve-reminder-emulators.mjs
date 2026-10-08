import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT,'demo-vault-shell');
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const admin=initializeApp({projectId:'demo-vault-shell'});
const db=getFirestore(admin);
const email=`reminder-${crypto.randomUUID()}@example.invalid`,password='Local-SYNTHETIC-ONLY!123';
const user=await getAuth(admin).createUser({email,password,emailVerified:true});
const uid=user.uid,root=db.collection('users').doc(uid);
const policySource=await readFile(resolve(import.meta.dirname,'../Frontend/public/assets/js/modules/core/password-policy.js'),'utf8');
const policy=await import(`data:text/javascript;base64,${Buffer.from(policySource).toString('base64')}`);
assert.ok(policy.evaluatePassword(password,'account').valid);
await root.set({passwordPolicyVersion:policy.ACCOUNT_PASSWORD_POLICY_VERSION,name:'Utente sintetico'});
const cryptoSource=await readFile(resolve(import.meta.dirname,'../Frontend/public/assets/js/modules/core/crypto-utils.js'),'utf8');
const cryptoApi=await import(`data:text/javascript;base64,${Buffer.from(cryptoSource).toString('base64')}`);
const syntheticMaster='LOCAL-Vault-Only!8264';
const syntheticKey=cryptoApi.generateVaultKey();
await root.collection('settings').doc('security').set({verifier:await cryptoApi.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1',syntheticMaster),vaultKeyEnvelope:await cryptoApi.wrapVaultKey(syntheticKey,syntheticMaster)});
await root.collection('accounts').doc('local-proof').set({ownerId:uid,_encrypted:true,name:'Account sintetico collaudo',password:await cryptoApi.encrypt('VALORE-SINTETICO-8264',syntheticKey)});
const day=offset=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const seedDeadline=(id,date)=>root.collection('scadenze').doc(id).set({type:'Bollo sintetico',dueDate:date,completed:false});
const seedNotice=(id,deadlineId,days,date=day(0),status='unread')=>root.collection('deadlineNotifications').doc(id).set({eventType:'deadline',deadlineId,dueDate:date,diffDays:days,status});
await seedDeadline('s1',day(0));await seedNotice('n21','s1',21);
const publicRoot=resolve(import.meta.dirname,'../Frontend/public');
const sdkBundle=await build({stdin:{contents:"export * from 'firebase/app';export * from 'firebase/auth';export * from 'firebase/firestore';export * from 'firebase/storage';export * from 'firebase/functions';export * from 'firebase/app-check';export * from 'firebase/messaging';export {isSupported} from 'firebase/messaging';",resolveDir:resolve(import.meta.dirname,'..')},bundle:true,write:false,format:'esm',platform:'browser'});
const fullConfig=`import {initializeApp,getAuth,connectAuthEmulator,getFirestore,connectFirestoreEmulator,getStorage,connectStorageEmulator,getFunctions,connectFunctionsEmulator} from '/assets/js/vendor/firebase-runtime.js';
const app=initializeApp({projectId:'demo-vault-shell',apiKey:'demo-key',storageBucket:'demo-vault-shell.appspot.com'});export const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});export const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8085);export const storage=getStorage(app);connectStorageEmulator(storage,'127.0.0.1',9199);export const functions=getFunctions(app,'europe-west1');connectFunctionsEmulator(functions,'127.0.0.1',5001);export const enableAppCheck=()=>null;export const getMessagingInstance=async()=>null;`;
const config=`import {initializeApp} from 'firebase/app';import {initializeAuth,inMemoryPersistence,connectAuthEmulator} from 'firebase/auth';import {getFirestore,connectFirestoreEmulator} from 'firebase/firestore';
const app=initializeApp({projectId:'demo-vault-shell',apiKey:'demo-key'});export const auth=initializeAuth(app,{persistence:inMemoryPersistence});connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});export const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8085);`;
const bundle=await build({entryPoints:[resolve(import.meta.dirname,'reminder-emulator-entry.mjs')],bundle:true,write:false,format:'esm',platform:'browser',metafile:true,plugins:[{name:'local-only',setup(builder){
 builder.onResolve({filter:/reminder-local-config|firebase-config\.js/},()=>({path:'local-config',namespace:'local'}));
 builder.onLoad({filter:/.*/,namespace:'local'},()=>({contents:config,loader:'js',resolveDir:resolve(import.meta.dirname,'..')}));
 builder.onResolve({filter:/firebase-runtime\.js$/},()=>({path:'sdk',namespace:'sdk'}));
 builder.onLoad({filter:/.*/,namespace:'sdk'},()=>({contents:"export * from 'firebase/firestore';export {onAuthStateChanged} from 'firebase/auth';",loader:'js',resolveDir:resolve(import.meta.dirname,'..')}));
 builder.onResolve({filter:/^\/assets\//},args=>({path:resolve(publicRoot,args.path.slice(1))}));
}}]});
assert.ok(!Object.keys(bundle.metafile.inputs).some(p=>/firebase-config\.js/.test(p)),'production config forbidden');
const html=(await readFile(resolve(publicRoot,'home_page.html'),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
 .replace(/<meta[^>]*http-equiv[^>]*>/gi,'').replace('</head>','<script src="/probe-gate.js"></script></head>')
 .replace('</body>','<section style="position:relative;z-index:99999;background:white;color:black;padding:20px"><h1 id="probe-status">PROVA LOCALE IN CORSO</h1><div id="probe-results"></div></section><script type="module" src="/probe.js"></script></body>');
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8085; base-uri 'none'; form-action 'none'");
 try{
 if(req.url==='/phase'&&req.method==='POST'){
  assert.equal(req.headers.origin,'http://127.0.0.1:3088');
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1000)throw Error('too large');}const {phase}=JSON.parse(body);
  let result={ok:true};
  if(phase==='start')result={email,password,uid};
  else if(phase==='stages'){await seedNotice('n14','s1',14);await seedNotice('n7','s1',7);}
  else if(phase==='homonym'){await seedDeadline('s2',day(0));await seedNotice('other','s2',7);}
  else if(phase==='viewed')await root.collection('deadlineNotifications').doc('n7').update({status:'viewed'});
  else if(phase==='expired'){await seedDeadline('s1',day(-1));await seedDeadline('s2',day(-1));}
  else if(phase==='reset'){await seedDeadline('s1',day(0));await seedDeadline('s2',day(0));}
  else if(phase==='verify')result={originals:(await root.collection('scadenze').get()).size};
  else throw Error('unknown phase');
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
 }
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 const appPath=new URL(req.url,'http://127.0.0.1').pathname;
 if(appPath==='/local-test-info'){res.setHeader('Content-Type','text/plain');res.end(`Synthetic local login: ${email}\nPassword: ${password}\nVault: ${syntheticMaster}`);return;}
 if(appPath==='/assets/js/firebase-config.js'){res.setHeader('Content-Type','text/javascript');res.end(fullConfig);return;}
 if(appPath==='/assets/js/vendor/firebase-runtime.js'){res.setHeader('Content-Type','text/javascript');res.end(sdkBundle.outputFiles[0].contents);return;}
 if(req.url==='/'||req.url==='/?visual'){res.setHeader('Content-Type','text/html');res.end(html);return;}
 if(req.url==='/probe.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);return;}
 if(req.url==='/probe-gate.js'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(resolve(publicRoot,'assets/js/private-auth-gate.js')));return;}
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(!/\.(html|js|css|json|woff2|png|svg|ico)$/.test(pathname)||pathname.includes('..')){res.writeHead(404).end();return;}
 const file=resolve(publicRoot,'.'+pathname);assert.ok(file.startsWith(publicRoot+'\\')||file.startsWith(publicRoot+'/'));
 const types={html:'text/html',js:'text/javascript',css:'text/css',json:'application/json',woff2:'font/woff2',png:'image/png',svg:'image/svg+xml'};
 res.setHeader('Content-Type',types[pathname.split('.').pop()]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(400).end('Local probe request rejected');}
});
server.listen(3088,'127.0.0.1',()=>console.log('Integrated demo-only reminder probe: http://127.0.0.1:3088'));
