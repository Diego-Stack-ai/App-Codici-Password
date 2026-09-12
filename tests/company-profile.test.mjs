import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../Frontend/public/assets/js/modules/azienda/',import.meta.url);
async function moduleFile(file){return import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(file,root),'utf8')).toString('base64'));}
const model=await moduleFile('company-profile-model.js');
const {buildCompanyVCard}=await moduleFile('company-vcard.js');
async function controller(file,deps,names){const src=(await readFile(new URL(file,root),'utf8')).replace(/import\s+(?!\()[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g,'').replace(/export\s+(?=(async\s+)?function|const|let)/g,'');return new Function(...Object.keys(deps),src+'\nreturn {'+names.join(',')+'};')(...Object.values(deps));}

test('email legacy e aggiuntive: collegamento e scollegamento conservano credenziali e metadati',()=>{
 const data={aziendaEmail:'old@example.test',aziendaEmailPassword:'cipher:original',emails:{extra:[{email:'extra@example.test',password:'cipher:extra',username:'user',custom:42}]},telefonoAzienda:'123'};
 const before=structuredClone(data);
 for(const contact of model.companyProfileContacts(data).emails){const linked=model.companyContactLinkPatch(data,contact,'email',{linkedAccountId:'a',linkedAccountCompanyId:'c'});const merged={...data,...linked};const fresh=model.findCompanyProfileContact(merged,'email',contact.id);assert.equal(fresh.password,contact.password);const unlinked=model.companyContactLinkPatch(merged,fresh,'email',{linkedAccountId:'',linkedAccountCompanyId:''});assert.equal(model.findCompanyProfileContact({...merged,...unlinked},'email',contact.id).password,contact.password);}
 assert.deepEqual(data,before);assert.doesNotMatch(JSON.stringify(model.companyProfileDraft(model.companyProfileContacts(data).emails[0],'source','email','owner')),/cipher:original/);
});

test('tessera: selezione rispettata, valori escapati e credenziali escluse',()=>{
 const card=buildCompanyVCard({ragioneSociale:'Nome\nTEL:iniettato',aziendaEmail:'pec@example.test',aziendaEmailPassword:'SECRET',emails:{pec:{password:'SECRET2'},amministrazione:{email:'admin@example.test'},extra:[{email:'hidden@example.test',qr:false,password:'SECRET3'}]},note:'PRIVATE-NOTE',qrConfig:{aziendaEmail:false,adminEmail:true}});
 assert.doesNotMatch(card,/SECRET|PRIVATE-NOTE|pec@example|hidden@example|\nTEL:iniettato/);assert.match(card,/admin@example.test/);assert.match(card,/Nome\\nTEL:iniettato/);
});

async function companySaveFixture({conflict=false,changedEmail=false,locked=false}={}){
 const original={emails:{pec:{email:'pec@example.test',password:'cipher: old ',linkedAccountId:'a',linkedAccountCompanyId:'c',username:'user',custom:42},extra:[]},qrConfig:{custom:true}};
 const inputs=new Map();const get=id=>{if(!inputs.has(id))inputs.set(id,{value:'',disabled:false});return inputs.get(id);};
 for(const [id,value] of Object.entries({'ragione-sociale':'Fixture','email-pec':changedEmail?'different@example.test':'pec@example.test','email-pec-password':' old ','type-pec':'PEC','type-amministrazione':'Amministrazione','type-personale':'Personale'}))get(id).value=value;
 const writes=[];const state={currentUid:'owner',currentAziendaId:'company',originalCompany:original,formLoaded:true,selectedFiles:[],existingAttachments:[]};
 const ctrl=await controller('ma_save.js',{state,db:{},doc:(...p)=>p,runTransaction:async(db,cb)=>{const staged=[];await cb({get:async()=>({exists:()=>true,data:()=>conflict?{...original,emails:{}}:original}),update:(ref,data)=>staged.push(data)});writes.push(...staged);},serverTimestamp:()=>1,document:{getElementById:get,querySelectorAll:()=>[]},ensureVaultKeyMaterial:async()=>locked?null:'key',encrypt:async value=>value?'cipher:'+value:'',showToast:()=>{},t:k=>k,logError:()=>{},setTimeout:()=>{},createElement:()=>({}),setChildren:()=>{}},['saveAzienda']);
 await ctrl.saveAzienda();return {writes,original};
}
test('modifica azienda conserva link, username, password con spazi e configurazione QR',async()=>{const {writes,original}=await companySaveFixture();assert.equal(writes.length,1);assert.deepEqual(writes[0].emails.pec,{...original.emails.pec,tipo:'PEC',note:''});assert.equal(writes[0].qrConfig.custom,true);});
for(const condition of ['conflict','changedEmail','locked'])test('modifica azienda bloccata senza perdita dati: '+condition,async()=>{assert.deepEqual((await companySaveFixture({[condition]:true})).writes,[]);});
