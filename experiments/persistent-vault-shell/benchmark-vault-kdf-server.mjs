// Dedicated loopback fixture: only these synthetic benchmark resources.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const cryptoSource=await readFile(new URL('../../Frontend/public/assets/js/modules/core/crypto-utils.js',import.meta.url));
const script=await readFile(new URL('./benchmark-vault-kdf-browser.mjs',import.meta.url));
const digest=createHash('sha256').update(cryptoSource).digest('hex');
const html=`<!doctype html><html lang="it"><meta charset="utf-8"><title>Benchmark KDF sintetico</title>
<h1>Benchmark KDF sintetico</h1><p>Nessun account, Firebase o dato reale. Non è un collaudo finale.</p>
<p id="source">${digest}</p><button id="run">Esegui misura sintetica</button><pre id="result" role="status">Pronto</pre>
<script type="module" src="/benchmark.mjs"></script></html>`;
const routes=new Map([['/',[html,'text/html']],['/benchmark.mjs',[script,'text/javascript']],['/crypto-utils.js',[cryptoSource,'text/javascript']]]);
const server=http.createServer((request,response)=>{
  const route=request.method==='GET'&&routes.get(request.url);
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader('X-Content-Type-Options','nosniff');
  if(!route){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',`${route[1]}; charset=utf-8`);response.end(route[0]);
});
server.listen(0,'127.0.0.1',()=>console.log(`SYNTHETIC_KDF_URL=http://127.0.0.1:${server.address().port}/`));
const stop=()=>{server.closeAllConnections();server.close();};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
