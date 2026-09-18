// A4 laboratory contract for users/{uid}.documenti[]. Company profiles expose
// only a flat `allegati[]` collection, not an equivalent digital-document model.
export const PRIVATE_DOCUMENT_METADATA = Object.freeze(['_profileDocumentsRevision','_profileDocumentsSchemaVersion','_profileDocumentsUpdatedAt']);
export const PRIVATE_DOCUMENT_FIELDS = Object.freeze([
  ['type','plain',120],['name','plain',160],['num_serie','cipher',1000],['cf_value','cipher',1000],
  ['id_number','cipher',1000],['license_number','cipher',1000],['cf','cipher',1000],
  ['rilasciato_da','cipher',1000],['luogo_rilascio','cipher',1000],['username','cipher',1000],
  ['password','cipher',1000],['pin','cipher',1000],['puk','cipher',1000],['codice_app','cipher',1000],
  ['note','cipher',5000],['categoria','cipher',1000],['home_page','cipher',2000],
  ['data_rilascio','plain',10],['expiry_date','plain',10],['isPrimary','boolean',0]
].map(([key,format,maxLength])=>Object.freeze({key,format,maxLength})));
export const DOCUMENT_REFUSALS=Object.freeze({INVALID:'PROFILE_DOCUMENTS_INVALID',UNCHANGED:'PROFILE_DOCUMENTS_UNCHANGED',SHAPE:'PROFILE_DOCUMENTS_SHAPE_INVALID'});
const object=v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fail=()=>{throw Error(DOCUMENT_REFUSALS.INVALID)};
const uid=/^[A-Za-z0-9_-]{1,128}$/;
export const privateDocumentUid=v=>typeof v==='string'&&uid.test(v);
export const privateDocumentId=v=>typeof v==='string'&&v.length<=256&&!/[\u0000-\u001f/]/.test(v)&&!v.includes('-legacy-')?v:null;
export const privateDocumentCreatedId=v=>typeof v==='string'&&/^document-[A-Za-z0-9-]{1,110}$/.test(v)&&!v.includes('-legacy-');
export const privateDocumentHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const privateDocumentCipher=v=>typeof v==='string'&&(v===''||(v.length>=60&&v.length<=100000&&v.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(v)));
export function privateDocumentFields(fields){
  if(!object(fields)) fail(); const keys=Object.keys(fields); if(!keys.length||keys.length>PRIVATE_DOCUMENT_FIELDS.length) fail(); const out={};
  for(const key of keys){const spec=PRIVATE_DOCUMENT_FIELDS.find(x=>x.key===key),value=fields[key]; if(!spec) fail();
    if(spec.format==='boolean'){if(typeof value!=='boolean') fail();}
    else if(typeof value!=='string'||value.length>100000||spec.format==='cipher'&&!privateDocumentCipher(value)||spec.format==='plain'&&value.length>spec.maxLength) fail();
    out[key]=value;
  } return Object.freeze(out);
}
export function privateDocumentBasis(value){
  let count=0; const copy=(item,depth=0)=>{if(++count>20000||depth>12) fail(); if(item===null||typeof item==='boolean'||typeof item==='string'||typeof item==='number'&&Number.isFinite(item)) return item;
    if(Array.isArray(item)){if(item.length>10000) fail(); return item.map(x=>copy(x,depth+1));} if(!object(item)) fail(); const out={};
    for(const key of Object.keys(item).sort()) out[key]=copy(item[key],depth+1); return out;};
  const serialized=JSON.stringify(copy(value)); if(serialized.length>200000) fail(); return serialized;
}
export function privateDocumentsRevision(record){if(!object(record)||record.isArchived) throw Error(DOCUMENT_REFUSALS.SHAPE); const revision=record._profileDocumentsRevision??0;
  if(!Number.isSafeInteger(revision)||revision<0||record._profileDocumentsSchemaVersion!==undefined&&record._profileDocumentsSchemaVersion!==1) throw Error(DOCUMENT_REFUSALS.SHAPE); return revision;}
export function privateDocumentRows(record){const rows=record.documenti??[]; if(!Array.isArray(rows)||rows.length>10000||rows.some(x=>!object(x))) throw Error(DOCUMENT_REFUSALS.SHAPE); return rows;}
export function privateDocumentDeleteRefusal(item,{qrSelected=false,attachments=0,ambiguous=false}={}){
  if(!object(item)||privateDocumentId(item.id)===null) return 'DOCUMENT_ID_UNSTABLE';
  if(ambiguous) return 'DOCUMENT_DEPENDENCIES_UNVERIFIABLE';
  if(item.linkedAccountId||item.linkedAccountCompanyId) return 'PROFILE_DOCUMENT_LINKED';
  if(qrSelected) return 'PROFILE_DOCUMENT_QR_SELECTED'; if(attachments>0) return 'PROFILE_DOCUMENT_HAS_ATTACHMENTS'; return null;
}
export function validatePrivateDocumentsRequest(data){const allowed=['target','expectedRevision','operations','operationId'];
  if(!object(data)||Object.keys(data).length!==allowed.length||Object.keys(data).some(k=>!allowed.includes(k))||!object(data.target)||data.target.domain!=='private'||Object.keys(data.target).length!==1||
    !Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||!uid.test(data.operationId??'')||!Array.isArray(data.operations)||!data.operations.length||data.operations.length>50) fail();
  const seen=new Set(),operations=[]; for(const raw of data.operations){if(!object(raw)||!['create','update','delete'].includes(raw.kind)) fail(); const keys=raw.kind==='create'?['kind','id','fields']:raw.kind==='update'?['kind','id','basis','fields']:['kind','id','basis'];
    if(Object.keys(raw).length!==keys.length||Object.keys(raw).some(k=>!keys.includes(k))||seen.has(raw.id)||raw.kind==='create'?!privateDocumentCreatedId(raw.id):privateDocumentId(raw.id)===null) fail(); seen.add(raw.id);
    if(raw.kind==='create') operations.push(Object.freeze({kind:raw.kind,id:raw.id,fields:privateDocumentFields(raw.fields)})); else {if(!privateDocumentHash(raw.basis)) fail(); operations.push(Object.freeze(raw.kind==='update'?{kind:raw.kind,id:raw.id,basis:raw.basis,fields:privateDocumentFields(raw.fields)}:{kind:raw.kind,id:raw.id,basis:raw.basis}));}}
  return Object.freeze({target:Object.freeze({domain:'private'}),expectedRevision:data.expectedRevision,operations:Object.freeze(operations),operationId:data.operationId});
}
