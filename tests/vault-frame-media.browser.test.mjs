import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=fileURLToPath(new URL('../Frontend/public/',import.meta.url));
let browser,server,base;
test.before(async()=>{
 server=createServer(async(req,res)=>{try{
  const path=new URL(req.url,'http://fixture.invalid').pathname;
  let text,type='text/javascript';
  if(path==='/media.html'){type='text/html';text='<!doctype html><html><body><input id="file" type="file"></body></html>';}
  else if(path==='/labels.mjs')text='export const t=key=>key;';
  else if(path.endsWith('/vault-frame-client.js'))text=`import {createFrameMediaLifetime} from './vault-frame-media-lifetime.mjs';
  export const vaultFrameClient={isChild:()=>true,isUnlocked:()=>true,whenVisible:async()=>{}};
  export const frameMediaLifetime=options=>createFrameMediaLifetime({window,document,...options});`;
  else {text=await readFile(resolve(root,'.'+path),'utf8');
   if(path.endsWith('/card-camera-capture.js'))text=text.replace("'../../translations.js'","'/labels.mjs'");
   if(path.endsWith('.css'))type='text/css';}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(text);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();await new Promise(done=>server?.close(done));});
async function fixture(){const context=await browser.newContext();await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 const page=await context.newPage();await page.goto(base+'/media.html');return {context,page};}
async function startCamera(page,delayed=false){await page.evaluate(async delayed=>{
 const {captureCardPhoto}=await import('/assets/js/modules/shared/card-camera-capture.js');
 const canvas=document.createElement('canvas');canvas.width=640;canvas.height=400;canvas.getContext('2d').fillRect(0,0,640,400);
 const stream=canvas.captureStream(30),track=stream.getTracks()[0],original=track.stop.bind(track);
 window.mediaFixture={stops:0,done:false,result:'pending',acquired:0};track.stop=()=>{window.mediaFixture.stops++;original();};
 navigator.mediaDevices.getUserMedia=()=>{window.mediaFixture.acquired++;return delayed?new Promise(resolve=>{window.deliverStream=()=>resolve(stream);}):Promise.resolve(stream);};
 window.cancelCamera=new AbortController();window.pendingCamera=captureCardPhoto({signal:window.cancelCamera.signal}).then(result=>{window.mediaFixture.result=result;window.mediaFixture.done=true;});
 },delayed);await page.waitForFunction(()=>window.mediaFixture.acquired===1);}
test('camera acquired after revocation stops once and creates no overlay or file',async()=>{
 const f=await fixture();try{await startCamera(f.page,true);
 await f.page.evaluate(()=>{window.cancelCamera.abort();window.deliverStream();});await f.page.waitForFunction(()=>window.mediaFixture.done);
 assert.deepEqual(await f.page.evaluate(()=>[window.mediaFixture.result,window.mediaFixture.stops,document.querySelectorAll('.card-camera-overlay').length]),[null,1,0]);
 }finally{await f.context.close();}});
test('active camera stops and clears its overlay on frame revocation',async()=>{
 const f=await fixture();try{await startCamera(f.page);await f.page.locator('.card-camera-overlay').waitFor();
 await f.page.evaluate(()=>window.dispatchEvent(new Event('vault-session-locked')));await f.page.waitForFunction(()=>window.mediaFixture.done);
 assert.deepEqual(await f.page.evaluate(()=>[window.mediaFixture.result,window.mediaFixture.stops,document.querySelectorAll('.card-camera-overlay').length]),[null,1,0]);
 }finally{await f.context.close();}});
test('late encoded photo cannot escape after cancellation',async()=>{
 const f=await fixture();try{await startCamera(f.page);await f.page.locator('.card-camera-overlay').waitFor();
 await f.page.waitForFunction(()=>document.querySelector('video').videoWidth>0);
 await f.page.locator('.card-camera-shoot').click();
 await f.page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=function(callback){window.deliverPhoto=()=>callback(new Blob(['synthetic'],{type:'image/jpeg'}));window.outputCanvas=this;};});
 await f.page.locator('.card-camera-use').click();await f.page.waitForFunction(()=>window.deliverPhoto);
 await f.page.evaluate(()=>{window.cancelCamera.abort();window.deliverPhoto();});await f.page.waitForFunction(()=>window.mediaFixture.done);
 assert.deepEqual(await f.page.evaluate(()=>[window.mediaFixture.result,window.mediaFixture.stops,window.outputCanvas.width,document.querySelectorAll('.card-camera-overlay').length]),[null,1,0,0]);
 }finally{await f.context.close();}});
test('native picker tombstone rejects a late file and a new selection works once',async()=>{
 const f=await fixture();try{
 await f.page.evaluate(async()=>{
 const {captureCardAttachment}=await import('/assets/js/modules/shared/card-attachment-capture.js');
 navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('synthetic','NotAllowedError');};
 const input=document.querySelector('#file');window.nativeMedia={opens:0,changes:0};input.click=()=>window.nativeMedia.opens++;
 input.addEventListener('change',()=>window.nativeMedia.changes++);
 window.selectNative=()=>captureCardAttachment({fallbackInput:input,confirmFallback:async(_title,_text,_yes,_no,options)=>{options.onConfirm();return true;}});
 window.deliverFile=()=>{const data=new DataTransfer();data.items.add(new File(['synthetic'],'synthetic.txt'));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));};
 await window.selectNative();});
 await f.page.evaluate(()=>{window.dispatchEvent(new Event('vault-session-locked'));window.deliverFile();});
 assert.deepEqual(await f.page.evaluate(()=>[window.nativeMedia.opens,window.nativeMedia.changes,document.querySelector('#file').files.length]),[1,0,0]);
 await f.page.evaluate(async()=>{await window.selectNative();window.deliverFile();});
 assert.deepEqual(await f.page.evaluate(()=>[window.nativeMedia.opens,window.nativeMedia.changes,document.querySelector('#file').files.length]),[2,1,1]);
 }finally{await f.context.close();}});
