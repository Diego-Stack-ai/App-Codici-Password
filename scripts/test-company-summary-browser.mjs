// Browser smoke test: synthetic company, loopback only, no Firebase access.
import {createServer} from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const root=path.resolve('Frontend/public'), output=path.resolve('output/pdf');await mkdir(output,{recursive:true});
const fixture=`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/css/core.css"><link rel="stylesheet" href="/assets/css/core_fonts.css"><link rel="stylesheet" href="/assets/css/core_fascie.css"><link rel="stylesheet" href="/assets/css/core_ui.css"><link rel="stylesheet" href="/assets/css/azienda_shared.css"><link rel="stylesheet" href="/assets/css/dati_azienda.css"><link rel="stylesheet" href="/assets/css/profile-layout.css"></head><body class="base-bg company-profile-page" data-ui-model="detail"><div class="base-container"><main class="base-main"><div class="page-container"><section id="pdf" class="detail-section"></section></div></main></div><script type="module">
import {mountCompanyPdfPanel} from '/assets/js/modules/azienda/pdf/company-summary-panel.js';
let unlocked=true;const record={id:'fixture',ownerId:'fixture',ragioneSociale:'Società Fittizia S.r.l.',partitaIva:'IVA-FITTIZIA',referenteNome:'Nome',referenteCognome:'Fittizio',telefonoAzienda:'000000000',emails:{pec:{email:'fixture@example.invalid',password:'SEGRETO-ESCLUSO'}},note:'SEGRETO-ESCLUSO',indirizzoSede:'Via della Città',civicoSede:'10',cittaSede:'Forlì',capSede:'00000',altreSedi:[{tipo:'Sede operativa',indirizzo:'Indirizzo lungo con città e accenti. '.repeat(75)}]};
window.cleanupPdf=mountCompanyPdfPanel(document.getElementById('pdf'),'fixture',{getUser:()=>({uid:'fixture'}),ensureUnlocked:async()=>{},isUnlocked:()=>unlocked,subscribeAuth:()=>()=>{},readCompany:async()=>structuredClone(record),decryptValue:async value=>value,isEncryptedValue:()=>false});
window.lockPdf=()=>{unlocked=false;window.dispatchEvent(new Event('vault-state-changed'));};
</script></body></html>`;
const server=createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,'http://127.0.0.1');if(u.pathname==='/'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));assert.ok(file.startsWith(root+path.sep));
 res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({acceptDownloads:true});await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [name,width,height] of [['desktop',1280,1000],['mobile',390,844]]){
 await page.setViewportSize({width,height});await page.goto(origin);await page.getByRole('button',{name:'Prepara PDF',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.startsWith('PDF pronto.'));
 assert.ok(!(await page.textContent('#pdf')).includes('SEGRETO-ESCLUSO'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
 await page.screenshot({path:path.join(output,`scheda-${name}.png`),fullPage:false});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Scarica PDF',exact:true}).click();const file=await download;
 assert.equal(file.suggestedFilename(),'scheda-azienda.pdf');await file.saveAs(path.join(output,`scheda-${name}.pdf`));
 await page.locator('[data-pdf-group="contacts"]').uncheck();assert.ok(await page.getByRole('button',{name:'Scarica PDF',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Prepara PDF',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent.startsWith('PDF pronto.'));
 assert.ok(!(await page.textContent('[data-company-pdf-preview]')).includes('fixture@example.invalid'));
 await page.evaluate(()=>window.lockPdf());assert.equal(await page.locator('#pdf').textContent(),'');
 }
 assert.deepEqual(errors,[]);console.log('PDF browser: desktop/mobile, actual download, selection invalidation and Vault revocation OK');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
