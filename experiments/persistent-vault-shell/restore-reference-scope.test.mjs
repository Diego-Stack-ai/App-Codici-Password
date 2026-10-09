import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreReferenceParents,validateRestoreSharedPairs} from './restore-reference-scope.mjs';

test('company restore fences current and replacement email and phone Account links',()=>{
  const record={path:'users/u/aziende/c',data:{emails:{pec:{linkedAccountId:'a'},extra:[{linkedAccountId:'b',linkedAccountCompanyId:'c'}]}}};
  assert.deepEqual(restoreReferenceParents(record,{phoneAccountLinks:{telefonoAzienda:{linkedAccountId:'old'}}}),
    ['users/u/accounts/a','users/u/aziende/c/accounts/b','users/u/accounts/old']);
  assert.throws(()=>restoreReferenceParents({...record,data:{emails:{extra:{}}}}),/NOT_CONNECTED/);
});

test('only known label and deadline configuration settings enter the candidate',()=>{
  for(const name of ['profileLabels','deadlineConfig','deadlineConfigDocuments','generalConfig'])
    assert.deepEqual(restoreReferenceParents({path:`users/u/settings/${name}`,data:{}}),[]);
  for(const name of ['security','qrCodeInclusions','unknown'])
    assert.throws(()=>restoreReferenceParents({path:`users/u/settings/${name}`,data:{}}),/NOT_CONNECTED/);
});

test('deadline Account-fence extractor accepts explicit profile links but rejects unknown source types',()=>{
  const record={path:'users/u/scadenze/d',data:{title:'Synthetic'}};
  assert.deepEqual(restoreReferenceParents(record),[]);
  assert.deepEqual(restoreReferenceParents(record,{sourceRef:{type:'profileDocument',id:'doc'}}),[]);
  assert.throws(()=>restoreReferenceParents({...record,data:{sourceRef:{type:'unknown',id:'doc'}}}),/NOT_CONNECTED/);
});

test('profile restore identifies old and new Account links without guessing deadline references',()=>{
  const record={path:'users/u',data:{contactEmails:[{linkedAccountId:'new'}],
    userAddresses:[{utilities:[{linkedAccountId:'a',linkedAccountCompanyId:'c'}]}]}};
  assert.deepEqual(restoreReferenceParents(record,{documenti:[{linkedAccountId:'old'}]}),
    ['users/u/accounts/new','users/u/aziende/c/accounts/a','users/u/accounts/old']);
  assert.deepEqual(restoreReferenceParents({path:'users/u',data:{nome:'Synthetic'}}),[]);
  for(const data of [{contactEmails:{}},{documenti:[null]},
    {documenti:[{expiryReference:{deadlineId:'../d'}}]},
    {contactPhones:[{linkedAccountId:'../bad'}]}]) {
    assert.throws(()=>restoreReferenceParents({path:'users/u',data}),/NOT_CONNECTED/);
  }
});
test('embedded restore fences old and new account references and rejects mixed metadata',()=>{
  const record={path:'users/u/accountWidgets/w',data:{kind:'embedded',context:'company',companyId:'c',accountId:'new'}};
  assert.deepEqual(restoreReferenceParents(record,{kind:'embedded',context:'private',accountId:'old'}),
    ['users/u/aziende/c/accounts/new','users/u/accounts/old']);
  assert.deepEqual(restoreReferenceParents(record,record.data),['users/u/aziende/c/accounts/new']);
  for(const change of [{ownerId:'other'},{accountId:'../x'},{sharedDataId:'s'},{linkId:'l'}])
    assert.throws(()=>restoreReferenceParents({...record,data:{...record.data,...change}}),/NOT_CONNECTED/);
  assert.throws(()=>restoreReferenceParents(record,{kind:'shared-reference',context:'private',accountId:'old'}),/NOT_CONNECTED/);
});

test('shared link and widget fence Account, common data and reciprocal companion in old and new locations',()=>{
  const link={path:'users/u/sharedVaultLinks/l',data:{sharedDataId:'s',widgetId:'w',context:'company',companyId:'c',accountId:'a'}};
  assert.deepEqual(restoreReferenceParents(link,{sharedDataId:'old',widgetId:'oldw',context:'private',accountId:'old'}),[
    'users/u/aziende/c/accounts/a','users/u/sharedVaultData/s','users/u/accountWidgets/w',
    'users/u/accounts/old','users/u/sharedVaultData/old','users/u/accountWidgets/oldw']);
  const widget={path:'users/u/accountWidgets/w',data:{kind:'shared-reference',sharedDataId:'s',linkId:'l',context:'private',accountId:'a'}};
  assert.deepEqual(restoreReferenceParents(widget),['users/u/accounts/a','users/u/sharedVaultData/s','users/u/sharedVaultLinks/l']);
  assert.deepEqual(restoreReferenceParents({path:'users/u/sharedVaultData/s',data:{synthetic:true}}),[]);
  for(const data of [{sharedDataId:'s',widgetId:'w',context:'other',accountId:'a'},
    {sharedDataId:'s',widgetId:'w',context:'private',accountId:'../a'},
    {sharedDataId:'s',widgetId:'w',context:'private',accountId:'a',companyId:'c'}])
    assert.throws(()=>restoreReferenceParents({...link,data}),/NOT_CONNECTED/);
});

test('shared reciprocal validator accepts complete private/company groups and rejects partial or crossed pairs',()=>{
  const group=(company=false)=>{
    const context=company?'company':'private',companyId=company?'c':undefined,accountPath=company?'users/u/aziende/c/accounts/a':'users/u/accounts/a';
    return [{path:accountPath,data:{}},{path:'users/u/sharedVaultData/s',data:{}},
      {path:'users/u/sharedVaultLinks/l',data:{sharedDataId:'s',widgetId:'w',context,accountId:'a',...(company?{companyId}:{})}},
      {path:'users/u/accountWidgets/w',data:{kind:'shared-reference',sharedDataId:'s',linkId:'l',context,accountId:'a',...(company?{companyId}:{})}}];
  };
  for(const records of [group(),group(true)])assert.doesNotThrow(()=>validateRestoreSharedPairs('u',records));
  for(const mutate of [records=>records.shift(),records=>records.pop(),records=>{records[2].data.widgetId='other';},
    records=>{records[3].data.sharedDataId='other';},records=>records.splice(1,1)]) {
    const records=group();mutate(records);assert.throws(()=>validateRestoreSharedPairs('u',records),/NOT_CONNECTED/);
  }
});
