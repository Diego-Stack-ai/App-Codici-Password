// Only a fresh, empty local bank. Never reset or replace an existing bank.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:8085');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:9099');
assert.equal(process.env.GCLOUD_PROJECT,'demo-vault-shell');
const require=createRequire(new URL('../../functions/package.json',import.meta.url));
const {initializeApp,deleteApp}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth'),{getFirestore}=require('firebase-admin/firestore');
const app=initializeApp({projectId:'demo-vault-shell'}),auth=getAuth(app),db=getFirestore(app);
try {
  if((await auth.listUsers(1)).users.length || (await db.listCollections()).length)throw Error('Banco non vuoto: nessun seed consentito');
  const source=await readFile(new URL('../../Frontend/public/assets/js/modules/core/crypto-utils.js',import.meta.url),'utf8');
  const crypto=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const user=await auth.createUser({email:'a@example.invalid',password:'LOGIN-SOLO-EMULATORE!123',emailVerified:true});
  const key=crypto.generateVaultKey(),master='MASTER-FITTIZIA-A!123',encrypt=value=>crypto.encrypt(value,key);
  const root=`users/${user.uid}`,batch=db.batch();
  batch.create(db.doc(root),{nome:await encrypt('Anteprima sintetica'),passwordPolicyVersion:1,contactEmails:[],contactPhones:[],userAddresses:[],documenti:[]});
  batch.create(db.doc(`${root}/settings/security`),{verifier:await crypto.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1',master),vaultKeyEnvelope:await crypto.wrapVaultKey(key,master)});
  batch.create(db.doc(`${root}/aziende/demo`),{ragioneSociale:await encrypt('Azienda di prova'),emails:{},phoneAccountLinks:{}});
  for(const path of [`${root}/accounts/alfa`,`${root}/aziende/demo/accounts/alfa`]) {
    batch.create(db.doc(path),{ownerId:user.uid,_encrypted:true,schemaVersion:1,revision:0,type:'account',visibility:'private',
      nomeAccount:await encrypt('Alfa di prova'),username:await encrypt('demo@example.invalid'),account:await encrypt('CODICE-FITTIZIO'),
      password:await encrypt('SEGRETO-FITTIZIO'),note:await encrypt('Solo dati sintetici'),url:'https://example.invalid'});
  }
  await batch.commit();console.log('Nuovo banco sintetico creato. Nessun dato precedente modificato.');
} finally {await db.terminate();await deleteApp(app);}
