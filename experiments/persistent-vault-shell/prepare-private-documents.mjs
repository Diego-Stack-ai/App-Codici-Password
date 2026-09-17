import {DOCUMENT_REFUSALS,PRIVATE_DOCUMENT_FIELDS,privateDocumentBasis,privateDocumentCreatedId,privateDocumentFields,privateDocumentId,privateDocumentRows,privateDocumentsRevision,validatePrivateDocumentsRequest} from './private-documents-contract.mjs';
export async function preparePrivateDocuments({context,getUser,record,snapshot,draft,operationId,hash}){
 const uid=context.user?.uid,check=()=>{if(!uid||getUser()?.uid!==uid||context.signal.aborted) throw Error('VIEW_DISPOSED'); context.assertUnlocked();}; check();
 if(record.ownerId!==undefined&&record.ownerId!==uid) throw Error(DOCUMENT_REFUSALS.INVALID); const rows=privateDocumentRows(record),operations=[];
 const list=v=>v===undefined?[]:Array.isArray(v)&&v.length<=50?v:(()=>{throw Error(DOCUMENT_REFUSALS.INVALID)})();
 async function fields(input,stored){const out={}; for(const [key,value] of Object.entries(input??{})){const spec=PRIVATE_DOCUMENT_FIELDS.find(x=>x.key===key); if(!spec) throw Error(DOCUMENT_REFUSALS.INVALID); if(stored?.fields?.[key]===value) continue;
   if(spec.format==='cipher'){if(value===''){out[key]='';continue;} check(); out[key]=await context.encrypt(value); check();} else out[key]=value;} return privateDocumentFields(out);}
 for(const item of list(draft?.creates)){if(!privateDocumentCreatedId(item.id)||rows.some(x=>x.id===item.id)) throw Error('PROFILE_CHANGED'); operations.push({kind:'create',id:item.id,fields:await fields(item.fields)});}
 for(const item of list(draft?.updates)){const matches=rows.filter(x=>x.id===item.id); if(matches.length!==1||privateDocumentId(item.id)===null) throw Error('PROFILE_CHANGED'); const patch=await fields(item.fields,snapshot?.get(item.id)); if(Object.keys(patch).length) operations.push({kind:'update',id:item.id,basis:await hash(privateDocumentBasis(matches[0])),fields:patch});}
 for(const item of list(draft?.deletes)){const matches=rows.filter(x=>x.id===item.id); if(matches.length!==1||privateDocumentId(item.id)===null) throw Error('PROFILE_CHANGED'); operations.push({kind:'delete',id:item.id,basis:await hash(privateDocumentBasis(matches[0]))});}
 if(!operations.length) throw Error(DOCUMENT_REFUSALS.UNCHANGED); check(); return validatePrivateDocumentsRequest({target:{domain:'private'},expectedRevision:privateDocumentsRevision(record),operations,operationId});
}
