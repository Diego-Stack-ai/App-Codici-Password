import {profileLinkAccount, assertProfileLinkAccount, profileLinkFingerprintInput} from './profile-link-contract.mjs';
import {profileTextId, profileTextHash, profileTextCipher} from './profile-text-contract.mjs';
export const BANK_EDIT_FIELDS = Object.freeze(['iban', 'passwordDispositiva', 'numeroVerde', 'referenteNome', 'referenteTelefono', 'referenteCellulare']);
export const CARD_EDIT_FIELDS = Object.freeze(['cardType', 'type', 'titolare', 'cardNumber', 'expiry', 'pin', 'ccv']);
export const BANK_EDIT_SECRETS = Object.freeze(['passwordDispositiva', 'cardNumber', 'pin', 'ccv']);
const fail = () => {throw Error('BANK_EDIT_INVALID');};
const object = value => value && Object.getPrototypeOf(value) === Object.prototype;
export function bankingEditBasis(record, uid, account, {allowEmpty = false} = {}) {
  assertProfileLinkAccount(record, uid, account, {destination: true});
  const revision = record.revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER ||
    (record.schemaVersion !== undefined && record.schemaVersion !== 1) || !Array.isArray(record.banking) ||
    (!allowEmpty && !record.banking.length) || record.banking.length > 100) fail();
  const ids = new Set();
  for (const bank of record.banking) {
    if (!object(bank) || !profileTextId(bank.bankId) || ids.has(bank.bankId) ||
      (bank.cards !== undefined && (!Array.isArray(bank.cards) || bank.cards.length > 100 || bank.cards.some(card => !object(card))))) fail();
    ids.add(bank.bankId);
  }
  return {revision, fingerprintInput: profileLinkFingerprintInput(record.banking)};
}
export function validateBankingEditRequest(data) {
  const keys = ['expectedOwnerUid', 'operationId', 'account', 'bankId', 'cardIndex', 'patch', 'expectedRevision', 'expectedFingerprint'];
  if (!object(data) || Object.keys(data).length !== keys.length || keys.some(key => !Object.hasOwn(data, key)) ||
    !profileTextId(data.expectedOwnerUid) || !profileTextId(data.operationId) || !profileTextId(data.bankId) ||
    !Number.isSafeInteger(data.expectedRevision) || data.expectedRevision < 0 || data.expectedRevision >= Number.MAX_SAFE_INTEGER ||
    !profileTextHash(data.expectedFingerprint) || (data.cardIndex !== null && (!Number.isInteger(data.cardIndex) || data.cardIndex < 0 || data.cardIndex >= 100)) ||
    !object(data.patch) || !Object.keys(data.patch).length) fail();
  const allowed = data.cardIndex === null ? BANK_EDIT_FIELDS : CARD_EDIT_FIELDS;
  for (const [key, value] of Object.entries(data.patch)) {
    if (!allowed.includes(key) || typeof value !== 'string' || value.length > 20000 ||
      (BANK_EDIT_SECRETS.includes(key) && !profileTextCipher(value))) fail();
    if (key === 'expiry' && value !== '' && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) fail();
  }
  return {...data, account: profileLinkAccount(data.account), patch: {...data.patch}};
}
