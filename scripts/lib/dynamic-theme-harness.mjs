import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const synthetic = `
export const auth={currentUser:{uid:'synthetic-local-only',email:'fixture@example.invalid'}};
export const db=null,storage=null,functions=null;
`;
const denied = `const denied=()=>{throw Error('SYNTHETIC_HARNESS_FORBIDDEN_SIDE_EFFECT')};`;
const data = `
const widgets=[{id:'widget',title:'Widget sintetico',description:'Solo dati inventati',tab:'personal',color:'#38bdf8',size:'medium',fields:[{id:'field',label:'Campo inventato',value:'Esempio locale',type:'text',order:0,copyable:true}]}];
const now=new Date();const date=days=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+days).toISOString().slice(0,10);
export const listProfileWidgets=async()=>structuredClone(widgets).map(widget=>({...widget,color:window.__dynamicWidgetColor??widget.color}));
export const listDeadlines=async()=>[-2,3,60,10].map((days,i)=>({id:'deadline-'+i,title:'Scadenza sintetica '+i,type:'Documento',category:'Prova',owner:'Persona fittizia',expiryDate:date(days),date:date(days),dueDate:date(days),completed:i===3}));
export const listReceivedDeadlines=async()=>[];
export const getUserProfile=async()=>({});
export const listPrivateAccountAttachments=async()=>[{id:'synthetic-file',name:'Documento inventato.pdf',type:'application/pdf',size:42}];
export const listCompanyAccountAttachments=listPrivateAccountAttachments;
`;
const firebase = `${denied}
export const doc=(...args)=>args,collection=(...args)=>args,query=(...args)=>args,where=(...args)=>args,ref=(...args)=>args;
export const onAuthStateChanged=(auth,fn)=>{queueMicrotask(()=>fn(auth.currentUser));return()=>{}};
export const updateDoc=async()=>{window.__dynamicSyntheticWrites=(window.__dynamicSyntheticWrites||0)+1;};
export const setDoc=async()=>{window.__dynamicSyntheticWrites=(window.__dynamicSyntheticWrites||0)+1;};
export const getDocsFromServer=async()=>({docs:Array.from({length:window.__dynamicAttachmentLimit?10:1},(_,i)=>({id:'attachment-'+i,data:()=>({documentId:'doc',status:'ready',mimeType:'application/pdf',encryptedName:'synthetic',size:42,storagePath:'never-fetched',encryption:{}})}))});
export const deleteDoc=denied,addDoc=denied,uploadBytes=denied,deleteObject=denied,getBytes=denied,getDownloadURL=denied,httpsCallable=denied,signOut=denied,runTransaction=denied,serverTimestamp=denied;
`;

export async function buildDynamicBundle(publicRoot) {
  const entry=await readFile(new URL('./dynamic-theme-entry.mjs',import.meta.url),'utf8');
  const stubs = new Map([
    ['firebase-config.js',synthetic],['firebase-runtime.js',firebase],['vault-repository.js',data],
    ['security-manager.js',`${denied} export const ensureVaultKeyMaterial=async()=>null,encrypt=denied,decrypt=denied,isVaultUnlocked=()=>false;`],
    ['vault-frame-client.js',`${denied} export const confirmFrameAction=denied,executeFrameNativeAction=denied;export const vaultFrameClient=Object.freeze({isChild:()=>false,onClear:()=>()=>{}});`],
    ['frame-navigation.js',`${denied} export const navigateDocument=denied,beginFrameLogout=denied,handleFrameBack=denied;`],
    ['utils.js',`export const logError=(label,error)=>{throw error};export const formatDateToIT=value=>String(value);`],
    ['attachment-security.js',`${denied} export const MAX_ATTACHMENT_BYTES=33554432;export const encryptAttachmentFile=denied,decryptAttachmentBytes=denied,openDecryptedAttachment=denied,validateAttachmentFile=denied,createStorageObjectName=denied,openExternalUrl=denied,resolveAccountAttachmentMime=denied,unwrapAttachmentFileKey=denied,validateAccountAttachmentFile=denied;`],
    ['shared-attachment-access.js',`${denied} export const decryptReceivedPrivateAttachment=denied,syncPrivateAttachmentAccess=denied,unwrapReceivedAttachmentFileKey=denied,decryptReceivedCompanyAttachment=denied,syncCompanyAttachmentAccess=denied;`],
    ['image-crop-editor.js',`${denied} export const editImageBeforeUpload=denied;`],
    ['chunked-attachment-security.js',`${denied} export const encryptAttachmentFileInChunks=denied,decryptAttachmentChunkBytesWithFileKey=denied,isChunkedAttachment=denied,validateChunkedAttachmentManifest=denied,streamDecryptedAttachmentChunks=denied,openChunkedDecryptedAttachment=denied;`],
    ['card-attachment-capture.js',`${denied} export const captureCardAttachment=denied,consumeAttachmentInitialMode=()=> 'free';`]
  ]);
  const result=await build({stdin:{contents:entry,resolveDir:publicRoot,sourcefile:'synthetic-dynamic-entry.mjs'},bundle:true,write:false,format:'esm',platform:'browser',target:'chrome120',metafile:true,
    plugins:[{name:'synthetic-local-only',setup(builder){
      builder.onResolve({filter:/.*/},args=>{
        if(args.path.includes('/PUBLIC/')) return {path:path.join(publicRoot,args.path.split('/PUBLIC/')[1])};
        const stripped=args.path.split('?')[0];
        if(stubs.has(path.basename(stripped))) return {path:path.basename(stripped),namespace:'synthetic'};
        if(stripped.startsWith('/assets/')) return {path:path.join(publicRoot,stripped)};
        if(stripped!==args.path) return {path:path.resolve(args.resolveDir,stripped)};
      });
      builder.onLoad({filter:/.*/,namespace:'synthetic'},args=>({contents:stubs.get(args.path),loader:'js'}));
    }}]});
  return {code:result.outputFiles[0].text,inputs:Object.keys(result.metafile.inputs),stubs:[...stubs.keys()]};
}

export async function createDynamicHarness({publicRoot,mutationCss='',omitProducer=false,omitGraphicsMarker=false}={}) {
  publicRoot=path.resolve(publicRoot||process.env.DYNAMIC_UI_ROOT||fileURLToPath(new URL('../../Frontend/public/',import.meta.url)));
  const bundle=await buildDynamicBundle(publicRoot);
  const served=[];
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://local.invalid');
      if(url.pathname.endsWith('/__dynamic-harness.js')) {
        res.writeHead(200,{'Content-Type':'text/javascript'});res.end(omitProducer?'window.__dynamicThemeReady=true;':bundle.code);return;
      }
      const file=path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
      if(!file.startsWith(publicRoot+path.sep)) throw Error('outside public tree');
      let body=await readFile(file);
      if(file.endsWith('.html')) {
        const html=body.toString();
        const hasTheme=/<script[^>]+src=["'][^"']*theme-init\.js/.test(html);
        body=html.replace(/<script\b[\s\S]*?<\/script>/gi,match=>/src=["'][^"']*theme-init\.js/.test(match)?match:'')
          .replace(/<body([^>]*)>/i,(m,a)=>`<body${a.replace(/\s(?:hidden|inert)(?=[\s>])/g,'')}>`)
          .replace('</head>',`<style>*,*::before,*::after{animation-play-state:paused!important;transition:none!important}</style></head>`)
          .replace('</body>',`<script>window.__dynamicHasRealThemeBootstrap=${hasTheme};</script><script type="module" src="/assets/js/modules/shared/__dynamic-harness.js"></script>${mutationCss?`<style>${mutationCss}</style>`:''}</body>`);
        if(omitGraphicsMarker)body=body.replace(/\sdata-ui-revision="[^"]*"/g,'');
      }
      const type={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
      served.push(url.pathname);res.writeHead(200,{'Content-Type':type});res.end(body);
    }catch(error){res.writeHead(404);res.end(String(error));}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const base=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try { browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:existsSync(chromium.executablePath())?{}:{channel:'chrome'})}); }
  catch(error){await new Promise(done=>server.close(done));throw error;}
  const blocked=[];
  return {base,bundle,served,blocked,publicRoot,
    async open(file,context){
      const contextBrowser=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,serviceWorkers:'block'});
      const page=await contextBrowser.newPage();
      page.setDefaultTimeout(2500);
      await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith(base+'/')) return route.continue();blocked.push(url);return route.abort();});
      await page.addInitScript(context=>{
        localStorage.clear();sessionStorage.clear();
        localStorage.setItem('theme',context.theme);localStorage.setItem('color_theme',context.palette);localStorage.setItem('ui_graphics',context.graphics==='classica'?'classic':'new');
        window.privateAuthGate={isReady:()=>true};
        // Explicit auth adapter exists only in the test bundle; no SDK initializes.
        Object.defineProperty(navigator,'clipboard',{value:{writeText(){throw Error('No clipboard in dynamic theme harness');}},configurable:true});
      },context);
      page.on('dialog',dialog=>dialog.dismiss());
      await page.goto(`${base}/${file}`,{waitUntil:'load'});
      await page.waitForFunction(()=>window.__dynamicThemeReady||window.__dynamicThemeError,{timeout:15000});
      const error=await page.evaluate(()=>window.__dynamicThemeError);if(error){await page.close();throw Error(error);}
      await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
      return page;
    },
    async close(){await browser.close();await new Promise(done=>server.close(done));}
  };
}
