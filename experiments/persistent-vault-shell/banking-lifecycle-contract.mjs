import {bankingEditBasis, validateBankingEditRequest} from './banking-edit-contract.mjs';

// Canonical arrays only: never assign identities to legacy banks implicitly.
export function bankingLifecycleBasis(record, uid, account) {
  if (!Array.isArray(record?.banking)) throw Error('BANK_LIFECYCLE_NONCANONICAL');
  return bankingEditBasis(record, uid, account, {allowEmpty:true});
}

export function validateBankingLifecycleRequest(data) {
  const keys = ['expectedOwnerUid','operationId','account','action','bankId','cardIndex','values','expectedRevision','expectedFingerprint'];
  if (!data || Object.getPrototypeOf(data) !== Object.prototype || Object.keys(data).length !== keys.length ||
      keys.some(key=>!Object.hasOwn(data,key)) || !['create-bank','delete-bank','create-card','delete-card'].includes(data.action))
    throw Error('BANK_LIFECYCLE_INVALID');
  const bankAction = data.action.endsWith('bank'), create = data.action.startsWith('create');
  if ((bankAction && data.cardIndex !== null) || (!bankAction && !Number.isInteger(data.cardIndex)) ||
      (!create && data.values !== null) || (create && (!data.values || Object.getPrototypeOf(data.values) !== Object.prototype)))
    throw Error('BANK_LIFECYCLE_INVALID');
  const validated = validateBankingEditRequest({expectedOwnerUid:data.expectedOwnerUid, operationId:data.operationId,
    account:data.account, bankId:data.bankId, cardIndex:data.cardIndex,
    patch:create && Object.keys(data.values).length ? data.values : bankAction ? {iban:''} : {cardType:''},
    expectedRevision:data.expectedRevision, expectedFingerprint:data.expectedFingerprint});
  return {...data, account:validated.account, values:create ? {...data.values} : null};
}

export function applyBankingLifecycle(banking, request) {
  const result = structuredClone(banking), index = result.findIndex(bank=>bank.bankId===request.bankId);
  if (request.action === 'create-bank') {
    if (index !== -1 || result.length >= 100) throw Error('BANK_LIFECYCLE_TARGET_CONFLICT');
    result.push({bankId:request.bankId, ...request.values, cards:[]});
    return result;
  }
  if (index < 0) throw Error('BANK_LIFECYCLE_TARGET_CONFLICT');
  if (request.action === 'delete-bank') {result.splice(index,1); return result;}
  const cards = result[index].cards ?? [];
  if (request.action === 'create-card') {
    if (request.cardIndex !== cards.length || cards.length >= 100) throw Error('BANK_LIFECYCLE_TARGET_CONFLICT');
    result[index].cards = [...cards, {type:'Credit', ...request.values}];
  } else {
    if (!cards[request.cardIndex]) throw Error('BANK_LIFECYCLE_TARGET_CONFLICT');
    cards.splice(request.cardIndex,1); result[index].cards = cards;
  }
  return result;
}
