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
