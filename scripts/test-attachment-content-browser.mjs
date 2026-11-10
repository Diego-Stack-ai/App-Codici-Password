import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from 'playwright';

// Real recipient crypto/openers; only remote Firebase and identity persistence are replaced.
const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const {fileURLToPath} = await import('node:url');
const bundle = await build({stdin: {contents: [
    "export * from './shared/attachment-security.js';",
    "export * from './shared/chunked-attachment-security.js';",
    "export * from './shared/shared-attachment-access.js';",
    "export * from './shared/record-sharing-crypto.js';"
].join('\n'), resolveDir: fileURLToPath(modules)}, bundle: true, format: 'esm', write: false,
plugins: [{name: 'synthetic-identity-only', setup(builder) {
    builder.onResolve({filter: /firebase-config|firebase-runtime|sharing-identity-service/}, args => ({path: args.path, namespace: 'synthetic'}));
    builder.onLoad({filter: /.*/, namespace: 'synthetic'}, () => ({contents:
        'export const functions={}; export const httpsCallable=()=>{throw Error("NO_REMOTE_CALLS")};' +
        'export const ensureSharingIdentity=async()=>globalThis.syntheticIdentity;' +
        'export const getSharingPublicIdentity=()=>{throw Error("NO_REMOTE_CALLS")};'}));
}}]});
function syntheticPdfBase64() {
    const objects=['<</Type /Catalog /Pages 2 0 R>>','<</Type /Pages /Kids [3 0 R] /Count 1>>','<</Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R>>','<</Length 0>>\nstream\n\nendstream'];
    let pdf='%PDF-1.4\n'; const offsets=[0];
    for(const [index,object] of objects.entries()){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;}
    const xref=Buffer.byteLength(pdf);
    pdf+=`xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<</Size 5 /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf).toString('base64');
}
const entry = `import * as api from '/runtime.mjs';
window.fixtureReady=true;
window.prepare=async(type,mode)=>{
 window.fixtureActive=true; window.invalidateOnChunk=false;
 const bytes=type==='application/pdf'?Uint8Array.from(atob('${syntheticPdfBase64()}'),c=>c.charCodeAt(0)):type==='image/png'?Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO2UAAAAASUVORK5CYII='),c=>c.charCodeAt(0)):new TextEncoder().encode('<!doctype html><p>Synthetic attachment only</p>');
 const recipient='recipient-fixture',ownerUid='owner-fixture',accountId='account-fixture';
 window.syntheticIdentity=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']).then(pair=>({privateKey:pair.privateKey,publicKey:pair.publicKey}));
 let open;
 if(mode==='chunked'){
  const chunks=[];const encrypted=await api.encryptAttachmentFileInChunks(new File([bytes],'fixture.mov',{type:'video/quicktime'}),'owner-fixture',{binding:'browser-fixture',chunkSize:16,onChunk:async chunk=>{chunks.push(new Uint8Array(await chunk.blob.arrayBuffer()));return{storagePath:'fixture/'+chunk.index}}});
  const attachment={id:'attachment-fixture',name:'fixture.mov',encryption:{...encrypted.metadata,originalType:type},chunks:encrypted.chunks};
  const fileKeyBytes=await api.unwrapAttachmentFileKey(attachment.encryption,'owner-fixture');
  open=async()=>{try{return await api.openChunkedDecryptedAttachment({attachment,fileKeyBytes,isActive:()=>window.fixtureActive,loadChunk:async chunk=>{if(window.invalidateOnChunk)window.fixtureActive=false;return chunks[chunk.index]}})}finally{fileKeyBytes.fill(0)}};
 }else{
  const encrypted=await api.encryptAttachmentFile(new File([bytes],'fixture',{type:'application/pdf'}),'owner-fixture');
  const attachment={id:'attachment-fixture',name:'invoice.pdf.html',encryption:{...encrypted.metadata,originalType:type}};
  const fileKey=await api.unwrapAttachmentFileKey(attachment.encryption,'owner-fixture');
  const contextId=await api.sharedAttachmentContextId({ownerUid,accountId,attachmentId:attachment.id});
  attachment.recipientKeyEnvelopes={[recipient]:await api.wrapRecordKeyForRecipient(fileKey,window.syntheticIdentity.publicKey,contextId,recipient)};fileKey.fill(0);
  open=async()=>{const clear=await api.decryptReceivedPrivateAttachment({ownerUid,accountId,attachment,recipientUid:recipient,vaultKeyMaterial:'recipient-synthetic',ciphertext:new Uint8Array(await encrypted.blob.arrayBuffer())});try{return api.openDecryptedAttachment(clear,attachment)}finally{clear.fill(0)}};
 }
 document.querySelector('button').onclick=async()=>{try{window.result=await open()}catch(error){window.result={error:error.message}}};
 window.result=null;
};`;
const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/runtime.mjs') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundle.outputFiles[0].text); }
    else if (request.url === '/entry.mjs') { response.setHeader('Content-Type', 'text/javascript'); response.end(entry); }
    else if (request.url === '/favicon.ico') { response.writeHead(204).end(); }
    else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><button>Open synthetic attachment</button><script type="module" src="/entry.mjs"></script>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({headless: true,
    ...((process.env.CHROME_PATH || process.platform === 'win32')
        ? {executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'} : {})});
const context = await browser.newContext({acceptDownloads: true});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.fixtureReady);
    for (const type of ['text/html', 'image/svg+xml', 'text/xml', '']) {
        await page.evaluate(type => window.prepare(type, 'shared'), type);
        const pending = page.waitForEvent('download');
        await page.getByRole('button').click();
        const download = await pending;
        assert.equal(download.suggestedFilename(), 'invoice_pdf.bin');
        assert.equal(context.pages().length, 1, type);
        assert.match(await readFile(await download.path(), 'utf8'), /Synthetic attachment/);
    }
    for (const [type, extension] of [
        ['application/msword','doc'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','docx'],
        ['application/vnd.ms-excel','xls'], ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx'],
        ['image/heic','heic'], ['image/heif','heif'], ['video/quicktime','mov']
    ]) {
        await page.evaluate(type => window.prepare(type, 'shared'), type);
        const pending = page.waitForEvent('download'); await page.getByRole('button').click();
        const result = await pending;
        assert.equal(result.suggestedFilename(), `invoice_pdf.${extension}`);
        assert.equal(await result.failure(), null);
        assert.match(await readFile(await result.path(), 'utf8'), /Synthetic attachment/);
        assert.equal(context.pages().length, 1);
    }
    for (const type of ['application/pdf', 'image/png', 'text/plain']) {
        await page.evaluate(type => window.prepare(type, 'shared'), type);
        const pending = context.waitForEvent('page');
        await page.getByRole('button').click();
        const popup = await pending;
        await popup.waitForURL(/^blob:/, {waitUntil: 'commit'});
        assert.equal(context.pages().length, 2, type);
        if (type === 'image/png') await popup.waitForFunction(() => document.querySelector('img')?.naturalWidth > 0);
        if (type === 'text/plain') assert.match(await popup.locator('body').innerText(), /<!doctype html>/);
        await popup.close();
    }
    for (const type of ['text/html', 'image/svg+xml']) {
        await page.evaluate(type => window.prepare(type, 'chunked'), type);
        await page.getByRole('button').click();
        await page.waitForFunction(() => window.result !== null);
        assert.equal(await page.evaluate(() => window.result.error), 'ATTACHMENT_CHUNK_MANIFEST_INVALID');
        assert.equal(context.pages().length, 1);
    }
    await page.evaluate(() => window.prepare('video/quicktime', 'chunked'));
    const download = page.waitForEvent('download');
    await page.getByRole('button').click();
    const chunkedDownload = await download;
    assert.equal(chunkedDownload.suggestedFilename(), 'fixture.mov');
    assert.equal(await chunkedDownload.failure(), null, 'chunked download must finish, not only start');
    assert.match(await readFile(await chunkedDownload.path(), 'utf8'), /Synthetic attachment/);
    assert.equal(context.pages().length, 1);
    await page.evaluate(async () => {await window.prepare('video/quicktime','chunked');window.invalidateOnChunk=true;});
    let lateDownloads=0;const onLateDownload=()=>lateDownloads++;page.on('download',onLateDownload);
    await page.getByRole('button').click();
    await page.waitForFunction(()=>window.result!==null);
    assert.equal(await page.evaluate(()=>window.result.error),'ATTACHMENT_SESSION_INVALIDATED');
    assert.equal(lateDownloads,0);page.off('download',onLateDownload);
    assert.equal(context.pages().length,1);
    const remaining = await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle('codici-password-previews');
        let count=0; for await (const _ of dir.keys()) count++; return count;
    });
    assert.equal(remaining, 0);
    // A raw SVG in an image is passive even before the stricter thumbnail policy.
    assert.equal(await page.evaluate(async () => {
        window.svgExecuted=false;
        const url=URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" onload="window.svgExecuted=true"/>'],{type:'image/svg+xml'}));
        const image=new Image(); image.src=url; document.body.append(image);
        try { await image.decode(); return window.svgExecuted; } finally { image.remove(); URL.revokeObjectURL(url); }
    }), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({pass:true, sharedDownloads:11, sharedOpens:3, chunkedRejected:2, chunkedDownload:true, chunkedRevocation:true, opfsCleanup:true, svgImagePassive:true, remoteFirebase:false}));
} finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
}
