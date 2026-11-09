import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {get} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,relative,sep} from 'node:path';
import {chromium} from 'playwright';
import {effectiveHostingHeaders,FRAME_CHILD_PATHS,frameHeaderProfile,buildFrameHostingHeaders} from '../scripts/lib/hosting-frame-headers.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const firebase=JSON.parse(await readFile(new URL('../firebase.json',import.meta.url),'utf8'));
let child,browser,base,log='';
const freePort=async()=>{const server=createServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));const port=server.address().port;await new Promise(done=>server.close(done));return port;};
const pause=ms=>new Promise(done=>setTimeout(done,ms));
async function htmlPaths(directory,prefix=''){const result=[];for(const item of await readdir(directory,{withFileTypes:true})){
 const path=prefix+'/'+item.name;if(item.isDirectory())result.push(...await htmlPaths(resolve(directory,item.name),path));else if(item.name.endsWith('.html'))result.push(path);}return result;}
const paths=await htmlPaths(resolve(root,'Frontend/public'));
function response(path){return new Promise((resolve,reject)=>{get(base+path,{headers:{'Cache-Control':'no-cache'}},res=>{
 const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,raw:res.rawHeaders,body:Buffer.concat(chunks)}));}).on('error',reject);});}
test.before(async()=>{
 const scratch=resolve(root,'.codex-tmp','b1-hosting-'+process.pid);await mkdir(scratch,{recursive:true});
 const port=await freePort(),hub=await freePort(),logging=await freePort();base='http://127.0.0.1:'+port;
 const config={hosting:{...firebase.hosting,public:relative(scratch,resolve(root,'Frontend/public')).split(sep).join('/')},emulators:{hosting:{host:'127.0.0.1',port},hub:{host:'127.0.0.1',port:hub},logging:{host:'127.0.0.1',port:logging},ui:{enabled:false},singleProjectMode:true}};
 const configPath=resolve(scratch,'firebase.json');await writeFile(configPath,JSON.stringify(config));
 const env={...process.env,XDG_CONFIG_HOME:resolve(scratch,'config')};for(const key of ['FIREBASE_TOKEN','GOOGLE_APPLICATION_CREDENTIALS','CLOUDSDK_AUTH_ACCESS_TOKEN'])delete env[key];
 child=spawn(process.execPath,[resolve(root,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:start','--only','hosting','--project','demo-vault-frame-headers','--config',configPath],{cwd:scratch,env,stdio:['pipe','pipe','pipe'],windowsHide:true});
 for(const stream of [child.stdout,child.stderr])stream.on('data',bytes=>{log=(log+bytes.toString()).slice(-10000);});
 let started=false;for(let i=0;i<300;i++){if(child.exitCode!==null)throw Error('Hosting exited: '+log);try{const result=await response('/app.html');if(result.status===200){started=true;break;}}catch{}await pause(100);}
 if(!started)throw Error('Hosting start timeout: '+log);
 browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();if(child&&child.exitCode===null){child.kill('SIGINT');await Promise.race([new Promise(done=>child.once('exit',done)),pause(5000).then(()=>child.kill('SIGKILL'))]);}});
test('header definitions are idempotent and assign exactly one security profile',()=>{
 assert.deepEqual(buildFrameHostingHeaders(firebase.hosting),firebase.hosting.headers);
 for(const path of [...paths,'/','/home','/app.html/','/profilo_privato.html/','/nested/profilo_privato.html','/appXhtml']){
  const value=effectiveHostingHeaders(firebase.hosting,path);assert.equal(value['x-frame-options'],frameHeaderProfile(path)==='child'?'SAMEORIGIN':'DENY');
 }
 for(let i=0;i<500;i++)assert.equal(effectiveHostingHeaders(firebase.hosting,'/unknown-'+i+'.html')['x-frame-options'],'DENY');
});
test('official Hosting HTTP: every HTML, alias, unknown path, query and suffix has the intended single headers',async()=>{
 const probes=[...paths,'/','/home','/login-v115.html','/__frame_missing__.html','/app.html/','/profilo_privato.html/','/nested/profilo_privato.html','/%61pp.html','/appXhtml','/impostazioni.html?recovery=complete'];
 for(const path of probes){const actual=await response(path),pathname=new URL(base+path).pathname,expected=effectiveHostingHeaders(firebase.hosting,pathname);
  for(const key of ['content-security-policy','x-frame-options','permissions-policy']){
   assert.equal(actual.headers[key],expected[key],path+' '+key);
   assert.equal(actual.raw.filter((value,index)=>index%2===0&&value.toLowerCase()===key).length,1,path+' duplicate '+key);
  }
  if(paths.includes(path))assert.equal(actual.status,200,path);
  const csp=actual.headers['content-security-policy'];assert.match(csp,/script-src 'self'/);assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/);
  assert.equal(actual.headers['x-content-type-options'],'nosniff',path);
  assert.equal(actual.headers['referrer-policy'],'strict-origin-when-cross-origin',path);
 }
});
for(const [foreign,target,allowed]of [[false,'/profilo_privato.html',true],[false,'/app.html',false],[true,'/profilo_privato.html',false]])
 test(`actual browser framing: foreign=${foreign}, target=${target}, allowed=${allowed}`,async()=>{
 const context=await browser.newContext();await context.route('**/*',route=>{
  const url=route.request().url();if(url.endsWith('/_b1-harness'))return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
  if(!url.startsWith(base))return route.abort();if(route.request().resourceType()==='script')return route.fulfill({contentType:'text/javascript',body:'/* inert synthetic header probe */'});return route.continue();});
 const page=await context.newPage();try{
  await page.goto((foreign?'http://foreign.invalid':base)+'/_b1-harness');
  await page.evaluate(url=>{window.probeLoaded=false;const frame=document.createElement('iframe');frame.onload=()=>{window.probeLoaded=true;};frame.src=url;document.body.append(frame);},base+target);
  await page.waitForFunction(()=>window.probeLoaded);
  const frames=page.frames().filter(frame=>frame!==page.mainFrame());
  const urls=await Promise.all(frames.map(frame=>frame.evaluate(()=>document.URL).catch(()=>'')));
  assert.equal(urls.includes(base+target),allowed,JSON.stringify(urls));
 }finally{await context.close();}
});
