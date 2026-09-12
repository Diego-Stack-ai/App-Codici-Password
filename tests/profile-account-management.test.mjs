import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../Frontend/public/assets/js/modules/',import.meta.url);
async function model(path){return import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(path,root),'utf8')).toString('base64'));}
const privateModel=await model('privato/profile-model.js'),companyModel=await model('azienda/company-profile-model.js');
async function fixture({sourceCompany=false,type='email',nextCompany=false,unlink=false,fail=false,stale=false,missingOld=false,archived=false}={}){
 const oldId='old',nextId='next',sourcePath=sourceCompany?'users/u/aziende/source':'users/u';
 const contact={id:sourceCompany?(type==='email'?'pec':'telefonoAzienda'):'item',linkedAccountId:oldId,linkedAccountCompanyId:'',password:'cipher:preserve',note:'cipher:note',value:'cipher:POD'};
 const other={id:'other',linkedAccountId:oldId,linkedAccountCompanyId:'',password:'cipher:other'};
 const source=sourceCompany?{emails:{pec:{...contact,email:'fixture@example.test'}},telefonoAzienda:'123',phoneAccountLinks:{telefonoAzienda:{linkedAccountId:oldId}},untouched:'keep'}:{contactEmails:type==='email'?[contact,other]:[other],contactPhones:type==='phone'?[contact]:[],documenti:type==='document'?[contact]:[],userAddresses:[{id:'address',utilities:type==='utility'?[contact]:[]}],untouched:'keep'};
 const first={companyId:'source',type,id:contact.id},second={companyId:'otherCompany',type:'phone',id:'another'};
 const old={password:'cipher:old-password',linkedCompanyProfileField:first,linkedCompanyProfileFields:[first,second]};
 const next={password:'cipher:next-password',username:'cipher:username',isArchived:archived,linkedCompanyProfileFields:[second]};
 const records=new Map([[sourcePath,source],['users/u/accounts/old',old],[nextCompany?'users/u/aziende/target/accounts/next':'users/u/accounts/next',next],['users/u/aziende/target',{}]]);
 if(missingOld)records.delete('users/u/accounts/old');
 if(stale){if(sourceCompany){if(type==='email')source.emails.pec.linkedAccountId='changed';else source.phoneAccountLinks.telefonoAzienda.linkedAccountId='changed';}else privateModel.findProfileAccountItem(source,{contactType:type,profileContactId:contact.id,parentAddressId:'address'}).linkedAccountId='changed';}
 const before=structuredClone([...records]);let writes=[];
 const deps={...privateModel,...companyModel,auth:{currentUser:{uid:'u'}},db:{},doc:(db,...parts)=>parts.join('/'),deleteField:()=> 'DELETE',runTransaction:async(db,fn)=>{const staged=[];let writing=false;await fn({get:async path=>{assert.equal(writing,false,'all reads precede writes');return{exists:()=>records.has(path),data:()=>structuredClone(records.get(path))};},update:(path,patch)=>{writing=true;staged.push({path,patch});}});if(fail)throw Error('commit failed');writes=staged;}};
 const src=(await readFile(new URL('shared/profile-account-management.js',root),'utf8')).replace(/import\s+[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g,'').replace(/export\s+(?=(async\s+)?function)/g,'');
 const {replaceAccountLink}=new Function(...Object.keys(deps),src+';return {replaceAccountLink};')(...Object.values(deps));
 let error;
 try{await replaceAccountLink({contact:{...contact,linkedAccountId:oldId},type,sourceCompanyId:sourceCompany?'source':'',parentAddressId:'address'},unlink?null:{id:nextId,companyId:nextCompany?'target':''});}catch(e){error=e;}
 assert.deepEqual([...records],before,'input data not mutated');return{writes,error,contact,source,sourcePath};
}
for(const sourceCompany of [false,true])for(const type of sourceCompany?['email','phone']:['email','phone','utility','document'])for(const unlink of [false,true])for(const nextCompany of unlink?[false]:[false,true])test(`${sourceCompany?'azienda':'privato'} ${type}: ${unlink?'scollega':'cambia verso '+(nextCompany?'azienda':'personale')}`,async()=>{
 const r=await fixture({sourceCompany,type,unlink,nextCompany});assert.equal(r.error,undefined);assert.equal(r.writes.length,unlink?2:3);
 const patch=r.writes.find(w=>w.path===r.sourcePath).patch,updated={...r.source,...patch};
 const item=sourceCompany?companyModel.findCompanyProfileContact(updated,type,r.contact.id):privateModel.findProfileAccountItem(updated,{contactType:type,profileContactId:'item',parentAddressId:'address'});
 assert.equal(item.linkedAccountId,unlink?'':'next');assert.equal(item.linkedAccountCompanyId,!unlink&&nextCompany?'target':'');
 if(!sourceCompany||type==='email')assert.equal(item.password,'cipher:preserve');
 for(const w of r.writes.filter(w=>w.path!==r.sourcePath)){assert.equal(Object.hasOwn(w.patch,'password'),false);assert.equal(Object.hasOwn(w.patch,'username'),false);}
 const old=r.writes.find(w=>w.path==='users/u/accounts/old').patch;
 if(sourceCompany)assert.deepEqual(old.linkedCompanyProfileFields,[{companyId:'otherCompany',type:'phone',id:'another'}]);else assert.equal(old.linkedProfileFields.some(f=>f.id==='other'),true);
});
for(const sourceCompany of [false,true])for(const failure of ['fail','stale','archived'])test(`nessuna scrittura parziale ${sourceCompany} ${failure}`,async()=>{const r=await fixture({sourceCompany,[failure]:true});assert.ok(r.error);assert.deepEqual(r.writes,[]);});
test('scollega anche un Account non più esistente senza cancellare la scheda',async()=>{const r=await fixture({missingOld:true,unlink:true});assert.equal(r.error,undefined);assert.equal(r.writes.length,1);});
