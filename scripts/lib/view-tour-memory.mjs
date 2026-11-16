// Test-only store. All identities, values and operations are synthetic and local.
export function createViewTourMemory(){
 if(globalThis.__viewTourMemory)return globalThis.__viewTourMemory;
 const uid='synthetic-local-only',root=`users/${uid}`,records=new Map(),listeners=new Set(),operations=[];let nextId=0;
 const clone=value=>value===undefined?undefined:structuredClone(value),enc=value=>'mock:v1:'+value;
 const now=new Date(),date=days=>new Date(now.getFullYear(),now.getMonth(),now.getDate()+days).toISOString().slice(0,10);
 const seed=(path,value)=>records.set(path,clone(value));
 const account=(i=0)=>({nomeAccount:`Account sintetico ${i}`,username:enc('utente.finto'),account:enc('QA-ACCOUNT'),password:enc('Synthetic-only-Password-3!'),website:'https://example.invalid/',note:enc('Nota sintetica Account'),_encrypted:true,revision:1,isArchived:false,ownerId:uid,userId:uid,views:4-i,createdAt:new Date(now.getTime()-i*86400000),updatedAt:now,attachments:[]});
 seed(root,{nome:'Nome fittizio',cognome:'Locale',note:enc('Nota sintetica Profilo'),_encrypted:true,birth_date:'1980-01-15',birth_place:'Citta QA',birth_province:'QA',contactPhones:[{id:'phone-0',label:'Cellulare',number:'0000000001',isPrimary:true}],contactEmails:[{id:'email-0',label:'Personale',address:'fixture@example.invalid',password:enc('Synthetic-only-Email-3!'),note:enc('Nota email sintetica'),isPrimary:true}],userAddresses:[{id:'address-0',type:'Residenza',address:'Via Prova',civic:'1',cap:'00000',city:'Citta QA',province:'QA',isPrimary:true,utilities:[]}],documenti:[{id:'document-0',type:'Codice Fiscale',num_serie:enc('QA-CF-0001'),id_number:enc('QA-ID-0001'),expiry_date:date(60),note:enc('Nota documento sintetico')}]});
 for(let i=0;i<2;i++)seed(`${root}/accounts/doc-${i}`,account(i));
 seed(`${root}/aziende/doc-0`,{ragioneSociale:'Azienda inventata 0',nome:'Azienda inventata 0',revision:1,isArchived:false,createdAt:now,updatedAt:now,note:enc('Nota azienda sintetica'),sedi:[],phones:[],emails:[]});
 for(let i=0;i<2;i++)seed(`${root}/aziende/doc-0/accounts/doc-${i}`,account(i));
 for(const [source,domain] of [['deadlineConfig','vehicles'],['deadlineConfigDocuments','documents'],['generalConfig','contracts']])seed(`${root}/settings/${source}`,{deadlineTypes:[{id:source==='deadlineConfig'?'tour-rule':'tour-type',name:source==='deadlineConfig'?'Revisione Auto':'Regola sintetica',domain,freq:7,period:14,emailObjects:[{id:'tour-object',objectText:'Revisione Auto',freq:7,period:14,vehicles:[{id:'tour-vehicle',model:'Modello sintetico',plate:'AA000AA'}]}]}],models:['Modello sintetico'],emailTemplates:['Messaggio sintetico']});
 const field={id:'field-tour',label:'Campo Sintetico',type:'text',order:0,encrypted:false,sensitivity:'normal',preview:true,copyable:true,includeInQr:false,qrLabel:'',qrOrder:0};
 seed(`${root}/accountWidgetProfiles/profile-tour`,{kind:'widget-profile',category:'account',title:'Profilo Widget Sintetico',description:'Profilo locale di prova',icon:'widgets',schemaVersion:1,revision:1,fields:[field]});
 for(const [context,accountId,companyId,suffix] of [['private','doc-0',null,'private'],['company','doc-0','doc-0','company']])seed(`${root}/accountWidgets/widget-${suffix}`,{kind:'embedded',context,accountId,...(companyId?{companyId}:{}),title:'Widget Sintetico',description:'Widget locale di prova',icon:'widgets',schemaVersion:1,revision:1,order:0,collapsed:false,profileId:'profile-tour',profileCategory:'account',fields:[{...field,value:'Valore sintetico'}]});
 for(const [id,title] of [['credential-free','Credenziale libera'],['credential-linked','Credenziale collegata']])seed(`${root}/sharedVaultData/${id}`,{title,description:'Credenziale sintetica',icon:'key',schemaVersion:1,revision:1,fields:[{...field,value:'QA-PUBLIC'},{...field,id:'secret-tour',label:'Segreto sintetico',type:'sensitive',encrypted:true,valueEnc:enc('QA-SECRET'),sensitivity:'secret'}]});
 seed(`${root}/sharedVaultLinks/link-seed`,{sharedDataId:'credential-linked',context:'private',accountId:'doc-0',order:0,collapsed:false});
 seed(`${root}/accountWidgets/widget-shared`,{kind:'shared-reference',sharedDataId:'credential-linked',context:'private',accountId:'doc-0',order:1,collapsed:false,revision:1});
 seed(`${root}/profileWidgets/profile-widget-0`,{title:'Widget Profilo Sintetico',description:'Prova locale',icon:'widgets',tab:'personal',size:'medium',order:0,collapsed:false,fields:[{id:'profile-field-0',label:'Campo QA',type:'text',value:'QA-VALUE'}]});
 for(let i=0;i<4;i++)seed(`${root}/scadenze/doc-${i}`,{title:`Scadenza sintetica ${i}`,titolo:`Scadenza sintetica ${i}`,expiryDate:date([-2,3,60,10][i]),date:date([-2,3,60,10][i]),dueDate:date([-2,3,60,10][i]),completed:i===3,type:'Documento',category:'Prova',owner:'Persona fittizia',createdAt:now,updatedAt:now,userId:uid,ownerId:uid,attachments:[]});
 const metadata={fromCache:false,hasPendingWrites:false};
 const get=(value,key)=>key.split('.').reduce((v,k)=>v?.[k],value);
 const single=reference=>{const value=records.get(reference.path);return {id:reference.id||reference.path.split('/').at(-1),exists:()=>value!==undefined,data:()=>clone(value),get:key=>clone(get(value,key)),ref:reference,metadata};};
 const many=reference=>{let entries=[...records.entries()].filter(([path])=>path.startsWith(reference.path+'/')&&!path.slice(reference.path.length+1).includes('/'));
  for(const c of reference.constraints||[]){if(c.kind==='where')entries=entries.filter(([,data])=>{const v=get(data,c.field);if(c.op==='==')return v===c.value;if(c.op==='!=')return v!==c.value;if(c.op==='array-contains')return Array.isArray(v)&&v.includes(c.value);if(c.op==='in')return c.value.includes(v);if(c.op==='<')return v<c.value;if(c.op==='<=')return v<=c.value;if(c.op==='>')return v>c.value;if(c.op==='>=')return v>=c.value;throw Error('Unsupported synthetic query');});if(c.kind==='orderBy')entries.sort((a,b)=>{const x=get(a[1],c.field),y=get(b[1],c.field);return (x<y?-1:x>y?1:0)*(c.direction==='desc'?-1:1);});if(c.kind==='limit')entries=entries.slice(0,c.maximum);}
  const docs=entries.map(([path])=>single({path,id:path.split('/').at(-1),__single:true}));return {docs,size:docs.length,empty:docs.length===0,forEach:fn=>docs.forEach(fn),metadata};};
 let queued=false;const emit=()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;for(const listener of listeners)try{listener.next(listener.reference.__single?single(listener.reference):many(listener.reference));}catch(error){globalThis.__viewTour?.errors.push('Synthetic snapshot callback: '+error.message);}});};
 const patch=(base,payload)=>{const value=clone(base||{});for(const [key,source]of Object.entries(payload||{})){const keys=key.split('.');let target=value;for(const part of keys.slice(0,-1))target=target[part]??={};const name=keys.at(-1);if(source?.__op==='delete')delete target[name];else if(source?.__op==='increment')target[name]=Number(target[name]||0)+source.amount;else if(source?.__op==='arrayUnion')target[name]=[...(target[name]||[]),...clone(source.values).filter(v=>!(target[name]||[]).some(old=>JSON.stringify(old)===JSON.stringify(v)))];else target[name]=clone(source);}return value;};
 const inScope=path=>path===root||path?.startsWith(root+'/');
 const noteMutation=()=>{const key='ui313-local-mutation-count';sessionStorage.setItem(key,String(Number(sessionStorage.getItem(key)||0)+1));};
 const write=(kind,reference,payload,options={})=>{if(!inScope(reference?.path))throw Error('Synthetic write outside fixture UID');if(kind==='update'&&!records.has(reference.path))throw Error('Synthetic update requires an existing record');noteMutation();operations.push({kind,path:reference.path,payload:clone(payload)});globalThis.__viewTourWrites=(globalThis.__viewTourWrites||0)+1;if(kind==='delete')records.delete(reference.path);else records.set(reference.path,kind==='update'||options.merge?patch(records.get(reference.path),payload):clone(payload));emit();return {id:reference.id};};
 const subscribe=(reference,next)=>{const listener={reference,next};listeners.add(listener);queueMicrotask(()=>{try{next(reference.__single?single(reference):many(reference));}catch(error){globalThis.__viewTour?.errors.push('Synthetic snapshot callback: '+error.message);}});return()=>listeners.delete(listener);};
 const callable=(name,command)=>{
  if(command.expectedOwnerUid!==uid)throw Error('Synthetic callable UID mismatch');
  const collections={manageSharedVaultData:'sharedVaultData',manageAccountWidget:'accountWidgets',manageWidgetProfile:'accountWidgetProfiles'};
  const collection=collections[name];if(!collection)throw Error('Unsupported synthetic callable: '+name);
  const id=command.sharedDataId||command.widgetId||command.profileId,path=`${root}/${collection}/${id}`,old=records.get(path),revision=Number(old?.revision||0);
  operations.push({kind:'callable',name,command:clone(command)});
  if(command.action==='create'&&old)return {status:'conflict',revision};
  if(command.action!=='create'&&(!old||Number(command.expectedRevision)!==revision))return {status:'conflict',revision};
  if(command.action==='delete'){if(collection==='sharedVaultData'&&[...records.entries()].some(([p,v])=>p.startsWith(root+'/sharedVaultLinks/')&&v.sharedDataId===id))return {status:'linked',revision};write('delete',{path,id});return {status:'applied',duplicate:false,revision:revision+1};}
  if(command.action==='link'||command.action==='unlink'){
   const linkPath=`${root}/sharedVaultLinks/${command.linkId}`,widgetPath=`${root}/accountWidgets/${command.widgetId}`;
   if(command.action==='link'){write('set',{path:linkPath,id:command.linkId},{...command.link,sharedDataId:id});write('set',{path:widgetPath,id:command.widgetId},{...command.link,sharedDataId:id,kind:'shared-reference'});}else{write('delete',{path:linkPath,id:command.linkId});write('delete',{path:widgetPath,id:command.widgetId});}
   write('update',{path,id},{revision:revision+1});return {status:'applied',duplicate:false,revision:revision+1};
  }
  if(!['create','update'].includes(command.action))throw Error('Unsupported synthetic command');
  let data=clone(command.data);
  // Mirrors only the UI-visible definition/value boundary of widget-profile-service.
  // Backend validation and authorization are exercised by their own suites.
  if(collection==='accountWidgetProfiles')data={...data,kind:'widget-profile',fields:data.fields.map(({value,valueEnc,...definition})=>definition)};
  write('set',{path,id},{...data,revision:revision+1,createdAt:old?.createdAt||now,updatedAt:now});return {status:'applied',duplicate:false,revision:revision+1};
 };
 const transaction=async update=>{const pending=[];const tx={get:async reference=>single(reference),set:(reference,payload,options)=>pending.push(['set',reference,payload,options]),update:(reference,payload)=>pending.push(['update',reference,payload]),delete:reference=>pending.push(['delete',reference])};const result=await update(tx);for(const args of pending)write(...args);return result;};
 for(const record of globalThis.__viewTourMemorySeeds||[]){if(!inScope(record.path))throw Error('Synthetic seed outside fixture UID');seed(record.path,record.value);}
 const removeStorage=reference=>{if(!inScope(reference?.fullPath))throw Error('Synthetic storage outside fixture UID');noteMutation();operations.push({kind:'deleteObject',path:reference.fullPath});if(globalThis.__viewTourStorageFailure)throw Error('Synthetic Storage refusal');};
 const api={uid,root,operations,single,many,write,subscribe,callable,transaction,removeStorage,newId:()=>`synthetic-new-${++nextId}`,read:path=>clone(records.get(path)),seed:(path,value)=>{if(!inScope(path))throw Error('Synthetic seed outside fixture UID');seed(path,value);emit();},all:()=>[...records.entries()].map(([path,value])=>({path,value:clone(value)}))};
 globalThis.__viewTourMemory=api;return api;
}
