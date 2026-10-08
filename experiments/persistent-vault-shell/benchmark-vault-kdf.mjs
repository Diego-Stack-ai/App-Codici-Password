// Synthetic, offline Node measurement of the current canonical implementation.
// No credentials, Firebase, file writes, parameter selection or migration.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const source = await readFile(new URL('../../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url),'utf8');
const cryptoUtils = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const password='SYNTHETIC-BENCHMARK-PASSWORD', marker='SYNTHETIC-VERIFIER-MARKER';
const vaultKey=cryptoUtils.generateVaultKey();
const envelope=await cryptoUtils.wrapVaultKey(vaultKey,password);
const verifier=await cryptoUtils.createVaultVerifier(marker,password);
const changed=Uint8Array.from(atob(envelope.wrappedKey),character=>character.charCodeAt(0));
changed[0]^=1;
const tampered={...envelope,wrappedKey:Buffer.from(changed).toString('base64')};
changed.fill(0);
const operations={
  wrap:async()=>{const result=await cryptoUtils.wrapVaultKey(vaultKey,password);assert.equal(result.iterations,envelope.iterations);},
  unwrap:async()=>assert.equal(await cryptoUtils.unwrapVaultKey(envelope,password),vaultKey),
  wrongPassword:async()=>assert.rejects(cryptoUtils.unwrapVaultKey(envelope,`${password}-WRONG`)),
  tamperedCiphertext:async()=>assert.rejects(cryptoUtils.unwrapVaultKey(tampered,password)),
  verifier:async()=>assert.equal(await cryptoUtils.verifyVaultVerifier(verifier,marker,password),true),
};
const measurements={};
for(const [name,operation] of Object.entries(operations)){
  await operation(); // One untimed warm-up per operation.
  const samples=[];
  for(let index=0;index<7;index++){
    const start=performance.now();await operation();samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);
  measurements[name]={samples:7,minMs:+samples[0].toFixed(2),medianMs:+samples[3].toFixed(2),maxMs:+samples[6].toFixed(2)};
}
console.log(JSON.stringify({scope:'synthetic-node-only',platform:process.platform,node:process.version,
  sourceSha256:createHash('sha256').update(source).digest('hex'),
  kdf:envelope.kdf,iterations:envelope.iterations,measurements,
  limits:['Not a browser or iPhone measurement','Not independent audit','No migration or parameter approval']},null,2));
