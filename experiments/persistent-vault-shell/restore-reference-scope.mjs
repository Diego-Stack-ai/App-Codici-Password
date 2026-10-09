const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const fail=()=>{throw Error('RESUME_SCOPE_FENCE_NOT_CONNECTED');};
export function restoreReferenceParents(record, previous=null) {
  const company=typeof record?.path==='string'&&record.path.match(/^users\/([A-Za-z0-9_-]+)\/aziende\/([A-Za-z0-9_-]+)$/);
  if(company) {
    const collect=data=>{
      if(!data||typeof data!=='object'||Array.isArray(data))fail();
      const items=[];
      for(const field of ['emails','phoneAccountLinks']) {
        if(data[field]==null)continue;
        if(typeof data[field]!=='object'||Array.isArray(data[field]))fail();
        for(const [key,value] of Object.entries(data[field])) {
          if(field==='emails'&&key==='extra') {if(!Array.isArray(value))fail();items.push(...value);}
          else items.push(value);
        }
      }
      return items.flatMap(item=>{
        if(!item||typeof item!=='object'||Array.isArray(item))fail();
        if(!item.linkedAccountId) {if(item.linkedAccountCompanyId)fail();return [];}
        if(!id(item.linkedAccountId)||(item.linkedAccountCompanyId&&!id(item.linkedAccountCompanyId)))fail();
        return [`users/${company[1]}/${item.linkedAccountCompanyId?`aziende/${item.linkedAccountCompanyId}/`:''}accounts/${item.linkedAccountId}`];
      });
    };
    return [...new Set([...collect(record.data),...(previous===null?[]:collect(previous))])];
  }
  if(typeof record?.path==='string'&&/^users\/[A-Za-z0-9_-]+\/contacts\/[A-Za-z0-9_-]+$/.test(record.path))return [];
  if(typeof record?.path==='string'&&/^users\/[A-Za-z0-9_-]+\/settings\/(?:profileLabels|deadlineConfig|deadlineConfigDocuments|generalConfig)$/.test(record.path))return [];
  if(typeof record?.path==='string'&&/^users\/[A-Za-z0-9_-]+\/scadenze\/[A-Za-z0-9_-]+$/.test(record.path)) {
    // Reciprocal profile links are validated separately for the complete chunk.
    for(const data of [record.data,...(previous===null?[]:[previous])]) {
      if(!data||typeof data!=='object'||Array.isArray(data))fail();
      if(data.sourceRef!=null&&(data.sourceRef.type!=='profileDocument'||!id(data.sourceRef.id)))fail();
    }
    return [];
  }
  const profile=typeof record?.path==='string'&&record.path.match(/^users\/([A-Za-z0-9_-]+)$/);
  if(profile) {
    const collect=data=>{
      if(!data||typeof data!=='object'||Array.isArray(data))fail();
      const items=[];
      for(const field of ['contactEmails','contactPhones','documenti','userAddresses']) {
        if(data[field]!==undefined&&!Array.isArray(data[field]))fail();
        for(const item of data[field]||[]) {
          if(!item||typeof item!=='object'||Array.isArray(item))fail();
          items.push(item);
          if(field==='userAddresses') {
            if(item.utilities!==undefined&&!Array.isArray(item.utilities))fail();
            items.push(...(item.utilities||[]));
          }
        }
      }
      return items.flatMap(item=>{
        if(!item||typeof item!=='object'||Array.isArray(item))fail();
        // Exact reciprocal pairing is checked on the complete atomic chunk.
        if(item.expiryReference!=null&&!id(item.expiryReference.deadlineId))fail();
        if(item.compatibleDeadlineId!=null)fail();
        if(item.linkedAccountId==null||item.linkedAccountId==='') {
          if(item.linkedAccountCompanyId)fail();
          return [];
        }
        if(!id(item.linkedAccountId)||(item.linkedAccountCompanyId&&!id(item.linkedAccountCompanyId)))fail();
        return [`users/${profile[1]}/${item.linkedAccountCompanyId?`aziende/${item.linkedAccountCompanyId}/`:''}accounts/${item.linkedAccountId}`];
      });
    };
    return [...new Set([...collect(record.data),...(previous===null?[]:collect(previous))])];
  }
  const direct=typeof record?.path==='string'&&record.path.match(/^(users\/[A-Za-z0-9_-]+\/(?:aziende\/[A-Za-z0-9_-]+\/)?accounts\/[A-Za-z0-9_-]+)(?:\/attachments\/[A-Za-z0-9_-]+)?$/);
  if(direct)return [direct[1]];
  const sharedData=typeof record?.path==='string'&&record.path.match(/^users\/([A-Za-z0-9_-]+)\/sharedVaultData\/([A-Za-z0-9_-]+)$/);
  if(sharedData)return [];
  const sharedLink=typeof record?.path==='string'&&record.path.match(/^users\/([A-Za-z0-9_-]+)\/sharedVaultLinks\/([A-Za-z0-9_-]+)$/);
  const sharedParents=(owner,data,companionCollection,companionField)=>{
    if(!data||typeof data!=='object'||Array.isArray(data)||!id(data.sharedDataId)||!id(data[companionField])||
      !['private','company'].includes(data.context)||!id(data.accountId)||(data.ownerId!==undefined&&data.ownerId!==owner)||
      (data.context==='company'?!id(data.companyId):data.companyId!==undefined&&data.companyId!==null&&data.companyId!==''))fail();
    return [`users/${owner}/${data.context==='company'?`aziende/${data.companyId}/`:''}accounts/${data.accountId}`,
      `users/${owner}/sharedVaultData/${data.sharedDataId}`,`users/${owner}/${companionCollection}/${data[companionField]}`];
  };
  if(sharedLink)return [...new Set([...sharedParents(sharedLink[1],record.data,'accountWidgets','widgetId'),
    ...(previous===null?[]:sharedParents(sharedLink[1],previous,'accountWidgets','widgetId'))])];
  const widget=typeof record?.path==='string'&&record.path.match(/^users\/([A-Za-z0-9_-]+)\/accountWidgets\/([A-Za-z0-9_-]+)$/);
  if(!widget)fail();
  const parent=data=>{
    if(data?.kind==='shared-reference')return sharedParents(widget[1],data,'sharedVaultLinks','linkId');
    if(!data||data.kind!=='embedded'||!['private','company'].includes(data.context)||!id(data.accountId)||
      (data.ownerId!==undefined&&data.ownerId!==widget[1])||
      (data.context==='company'?!id(data.companyId):data.companyId!==undefined&&data.companyId!==null&&data.companyId!==''))fail();
    if(data.sharedDataId!==undefined||data.linkId!==undefined)fail();
    return [`users/${widget[1]}/${data.context==='company'?`aziende/${data.companyId}/`:''}accounts/${data.accountId}`];
  };
  return [...new Set([...parent(record.data),...(previous===null?[]:parent(previous))])];
}

export function validateRestoreSharedPairs(uid,records) {
  if(!id(uid)||!Array.isArray(records))fail();
  const byPath=new Map(records.map(record=>[record.path,record]));
  if(byPath.size!==records.length)fail();
  for(const record of records) {
    const link=record.path?.match(new RegExp(`^users/${uid}/sharedVaultLinks/([A-Za-z0-9_-]+)$`));
    const widget=record.path?.match(new RegExp(`^users/${uid}/accountWidgets/([A-Za-z0-9_-]+)$`));
    if(link) {
      const parents=restoreReferenceParents(record),account=byPath.get(parents[0]),companion=byPath.get(parents[2]),common=byPath.get(parents[1]);
      if(!account||!companion||!common||companion.data?.kind!=='shared-reference'||companion.data?.linkId!==link[1]||
        companion.data?.sharedDataId!==record.data.sharedDataId||companion.data?.context!==record.data.context||
        companion.data?.accountId!==record.data.accountId||companion.data?.companyId!==record.data.companyId)fail();
    } else if(widget&&record.data?.kind==='shared-reference') {
      const parents=restoreReferenceParents(record),account=byPath.get(parents[0]),companion=byPath.get(parents[2]),common=byPath.get(parents[1]);
      if(!account||!companion||!common||companion.data?.widgetId!==widget[1]||companion.data?.sharedDataId!==record.data.sharedDataId||
        companion.data?.context!==record.data.context||companion.data?.accountId!==record.data.accountId||
        companion.data?.companyId!==record.data.companyId)fail();
    }
  }
}
