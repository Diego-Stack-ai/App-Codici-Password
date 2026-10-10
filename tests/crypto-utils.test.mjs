import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(
  new URL('../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url),
  'utf8',
);
const {
  createVaultVerifier,
  verifyVaultVerifier,
  VERIFIER_ITERATIONS,
  wrapVaultKey,
  unwrapVaultKey,
  encrypt,
  decrypt,
  createVaultKeyring,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const MARKER = 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1';

test('legacy 100000-iteration format remains interoperable with independent WebCrypto and CPVK2 fallback',async()=>{
  const password='  Synthetic-e\u0301-password  ',normalized='Synthetic-é-password',plain='SYNTHETIC legacy payload';
  const derive=async salt=>{
    const encoded=new TextEncoder().encode(normalized);
    let material;try{material=await crypto.subtle.importKey('raw',encoded,'PBKDF2',false,['deriveKey']);}finally{encoded.fill(0);}
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},material,
      {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  };
  const salt=new Uint8Array(16).fill(17),iv=new Uint8Array(12).fill(23);
  // Fixed salt/IV only for this synthetic, one-shot compatibility fixture.
  const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await derive(salt),new TextEncoder().encode(plain)));
  const fixture=Buffer.concat([salt,iv,cipher]).toString('base64');
  assert.equal(await decrypt(fixture,password),plain);
  assert.equal(await decrypt(fixture,createVaultKeyring('synthetic-new-key',password)),plain);
  const generated=Buffer.from(await encrypt(plain,password),'base64');
  const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:generated.subarray(16,28)},
    await derive(generated.subarray(0,16)),generated.subarray(28));
  try{assert.equal(new TextDecoder().decode(decoded),plain);}finally{new Uint8Array(decoded).fill(0);}
});

test('runtime dual-read apre CPFE2 a 600000 iterazioni ma continua a scrivere legacy',async()=>{
  const password='Synthetic-CPFE2-password',plain='SYNTHETIC CPFE2 payload';
  const salt=new Uint8Array(16).fill(31),iv=new Uint8Array(12).fill(47);
  const encoded=new TextEncoder().encode(password);
  let material;
  try{material=await crypto.subtle.importKey('raw',encoded,'PBKDF2',false,['deriveKey']);}
  finally{encoded.fill(0);}
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,
    {name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(plain)));
  const envelope={version:2,kdf:'PBKDF2-SHA256',iterations:600000,cipher:'AES-GCM-256',
    salt:Buffer.from(salt).toString('base64'),iv:Buffer.from(iv).toString('base64'),
    ciphertext:Buffer.from(ciphertext).toString('base64')};
  const cpfe2=`CPFE2.${Buffer.from(JSON.stringify(envelope)).toString('base64')}`;
  assert.equal(await decrypt(cpfe2,password),plain);
  assert.equal((await encrypt(plain,password)).startsWith('CPFE2.'),false);
});

test('runtime CPFE2 fallisce chiuso su downgrade, formato alterato e password errata',async()=>{
  const malformed=value=>`CPFE2.${Buffer.from(JSON.stringify(value)).toString('base64')}`;
  const base={version:2,kdf:'PBKDF2-SHA256',iterations:600000,cipher:'AES-GCM-256',
    salt:Buffer.alloc(16).toString('base64'),iv:Buffer.alloc(12).toString('base64'),
    ciphertext:Buffer.alloc(17).toString('base64')};
  for(const patch of [{iterations:100000},{iterations:600001},{kdf:'PBKDF2-SHA1'},{cipher:'AES-CBC-256'},
    {salt:Buffer.alloc(15).toString('base64')},{iv:Buffer.alloc(11).toString('base64')},
    {salt:`${base.salt}\n`},{ciphertext:base.ciphertext.replace(/=$/,'')}])
    assert.equal(await decrypt(malformed({...base,...patch}),'Synthetic-password'),'--ERRORE--');
  assert.equal(await decrypt(`${malformed(base).replace(/=$/,'')}`,'Synthetic-password'),'--ERRORE--');
  assert.equal(await decrypt(malformed(base),'Wrong-password'),'--ERRORE--');
});

test('il confine strict non riclassifica CPFE2 malformato come testo in chiaro',async()=>{
  const {decryptRequiredValue,isEncryptedValue}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#strict-cpfe2`);
  const malformed=`CPFE2.${'A'.repeat(32)}!`;
  assert.equal(isEncryptedValue(malformed),true);
  await assert.rejects(decryptRequiredValue(malformed,'Synthetic-password'),/Dato non leggibile/);
  assert.equal(isEncryptedValue('CPFE2.bad'),true);
  await assert.rejects(decryptRequiredValue('CPFE2.bad','Synthetic-password'),/Dato non leggibile/);
});

for(const operation of ['wrap','verifier','legacy'])for(const failure of [false,true])
test(`${operation} clears imported credential bytes on ${failure?'failure':'success'}`,async t=>{
  const original=crypto.subtle.importKey.bind(crypto.subtle);let retained;
  t.mock.method(crypto.subtle,'importKey',async(...args)=>{retained=args[1];
    if(failure)throw Error('SYNTHETIC_IMPORT_FAILURE');return original(...args);});
  const password='  Synthetic-e\u0301-password  ';
  const pending=operation==='wrap'?wrapVaultKey('synthetic-key',password):operation==='verifier'?
    createVaultVerifier(MARKER,password):encrypt('synthetic-content',password);
  if(failure)await assert.rejects(pending);else await pending;
  assert.ok(retained.length>0);assert.ok(retained.every(byte=>byte===0));
});

for(const failure of [false,true])test(`wrapping clears its encoded Vault Key after encryption ${failure?'failure':'success'}`,async t=>{
  const encrypt=crypto.subtle.encrypt.bind(crypto.subtle);let retained;
  t.mock.method(crypto.subtle,'encrypt',async(...args)=>{retained=args[2];
    if(failure)throw Error('SYNTHETIC_FAILURE');return encrypt(...args);});
  const pending=wrapVaultKey('SYNTHETIC-VAULT-KEY','Synthetic-password');
  if(failure)await assert.rejects(pending,/SYNTHETIC_FAILURE/);else await pending;
  assert.ok(retained.length>0);assert.ok(retained.every(byte=>byte===0));
});

test('unwrapping clears decrypted key bytes while preserving the returned string',async t=>{
  const password='Synthetic-password',key='SYNTHETIC-VAULT-KEY',envelope=await wrapVaultKey(key,password);
  const decrypt=crypto.subtle.decrypt.bind(crypto.subtle);let retained;
  t.mock.method(crypto.subtle,'decrypt',async(...args)=>{retained=await decrypt(...args);return retained;});
  assert.equal(await unwrapVaultKey(envelope,password),key);
  assert.ok(new Uint8Array(retained).every(byte=>byte===0));
});

test('envelope v2 rejects altered KDF and cipher declarations instead of silently ignoring them',async()=>{
  const password='Synthetic-Wrapping-Password',key='SYNTHETIC-KEY-MATERIAL';
  const envelope=await wrapVaultKey(key,password);
  assert.equal(await unwrapVaultKey(envelope,password),key);
  for(const patch of [{kdf:'unsupported'},{cipher:'unsupported'},{iterations:100000},{iterations:600001},{iterations:undefined}])
    await assert.rejects(unwrapVaultKey({...envelope,...patch},password),/VAULT_ENVELOPE_INVALID/);
});

test('il verifier v2 usa il KDF rinforzato e verifica la Master Password corretta', async () => {
  const verifier = await createVaultVerifier(MARKER, 'MasterPassword!123456');

  assert.equal(verifier.version, 2);
  assert.equal(verifier.iterations, VERIFIER_ITERATIONS);
  assert.equal(verifier.kdf, 'PBKDF2-SHA256');
  assert.equal(verifier.cipher, 'AES-GCM-256');
  assert.equal(await verifyVaultVerifier(verifier, MARKER, 'MasterPassword!123456'), true);
});

test('il verifier v2 respinge password errata, manomissione e costo KDF ridotto', async () => {
  const verifier = await createVaultVerifier(MARKER, 'MasterPassword!123456');
  assert.equal(await verifyVaultVerifier(verifier, MARKER, 'PasswordErrata!123456'), false);

  const tampered = {...verifier, ciphertext: `${verifier.ciphertext.slice(0, -2)}AA`};
  assert.equal(await verifyVaultVerifier(tampered, MARKER, 'MasterPassword!123456'), false);
  assert.equal(await verifyVaultVerifier({...verifier, iterations: 100000}, MARKER, 'MasterPassword!123456'), false);
});
