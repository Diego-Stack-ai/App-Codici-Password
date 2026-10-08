import * as utils from './crypto-utils.js';
const button=document.getElementById('run'),output=document.getElementById('result');
const equal=(actual,expected)=>{if(actual!==expected)throw Error('BENCHMARK_ASSERTION');};
const rejects=async action=>{let rejected=false;try{await action();}catch{rejected=true;}equal(rejected,true);};
button.addEventListener('click',async()=>{
  if(button.disabled)return;button.disabled=true;output.textContent='Misura in corso';
  try{
    const password='SYNTHETIC-BENCHMARK-PASSWORD',marker='SYNTHETIC-VERIFIER-MARKER',key=utils.generateVaultKey();
    const envelope=await utils.wrapVaultKey(key,password),verifier=await utils.createVaultVerifier(marker,password);
    const changed=Uint8Array.from(atob(envelope.wrappedKey),c=>c.charCodeAt(0));changed[0]^=1;
    const tampered={...envelope,wrappedKey:btoa(String.fromCharCode(...changed))};changed.fill(0);
    const operations={wrap:async()=>equal((await utils.wrapVaultKey(key,password)).iterations,envelope.iterations),
      unwrap:async()=>equal(await utils.unwrapVaultKey(envelope,password),key),
      wrongPassword:()=>rejects(()=>utils.unwrapVaultKey(envelope,password+'-WRONG')),
      tamperedCiphertext:()=>rejects(()=>utils.unwrapVaultKey(tampered,password)),
      verifier:async()=>equal(await utils.verifyVaultVerifier(verifier,marker,password),true)};
    const measurements={};
    for(const [name,operation] of Object.entries(operations)){
      await operation();const samples=[];
      for(let i=0;i<7;i++){const start=performance.now();await operation();samples.push(performance.now()-start);}
      samples.sort((a,b)=>a-b);
      measurements[name]={samples:7,minMs:+samples[0].toFixed(2),medianMs:+samples[3].toFixed(2),maxMs:+samples[6].toFixed(2)};
    }
    output.textContent=JSON.stringify({status:'completed',scope:'synthetic-browser-only',userAgent:navigator.userAgent,
      sourceSha256:document.getElementById('source').textContent,kdf:envelope.kdf,iterations:envelope.iterations,measurements,
      limits:['No application integration test','No independent audit','No migration or parameter approval']},null,2);
  }catch{output.textContent='FAILED: nessuna misura accettata';}
  finally{button.disabled=false;}
});
