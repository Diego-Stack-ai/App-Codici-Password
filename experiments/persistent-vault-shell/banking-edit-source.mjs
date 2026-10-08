import {bankingEditBasis, validateBankingEditRequest, BANK_EDIT_FIELDS, CARD_EDIT_FIELDS, BANK_EDIT_SECRETS} from './banking-edit-contract.mjs';
import {profileLinkAccount} from './profile-link-contract.mjs';

export function createBankingEditSource({context, getUser, account, bankId, cardIndex = null, readRecord, hash, isEncryptedValue, isOnline, submit}) {
  const uid = context.user.uid, selection = profileLinkAccount(account);
  let closed = false, basis = null, plans = new WeakMap();
  const check = () => {if (closed || context.signal.aborted || getUser()?.uid !== uid) throw Error('VIEW_DISPOSED');
    context.assertUnlocked(); if (!isOnline()) throw Error('BANK_EDIT_ONLINE_REQUIRED');};
  const loadRaw = async () => {
    check(); const record = await readRecord(); check();
    const state = bankingEditBasis(record, uid, selection), bank = record.banking.find(item => item.bankId === bankId);
    if (!bank || (cardIndex !== null && (!Number.isInteger(cardIndex) || cardIndex < 0 || !bank.cards?.[cardIndex]))) throw Error('BANK_EDIT_TARGET_MISSING');
    return {state, target: structuredClone(cardIndex === null ? bank : bank.cards[cardIndex])};
  };
  const dispose = () => {closed = true; basis = null; plans = new WeakMap(); context.signal.removeEventListener('abort', dispose);};
  context.signal.addEventListener('abort', dispose, {once: true});
  return Object.freeze({dispose,
    async load() {
      basis = null; const raw = await loadRaw(), values = {};
      for (const field of cardIndex === null ? BANK_EDIT_FIELDS : CARD_EDIT_FIELDS) {
        const value = raw.target[field] ?? '';
        if (typeof value !== 'string') throw Error('BANK_EDIT_INVALID');
        values[field] = isEncryptedValue(value) ? await context.read({ownerId: uid, ciphertext: value}) : value;
        check();
        if (typeof values[field] !== 'string' || (isEncryptedValue(value) && (values[field] === value || values[field] === '--ERRORE--')))
          throw Error('BANK_EDIT_DECRYPT_FAILED');
      }
      if (JSON.stringify(raw) !== JSON.stringify(await loadRaw())) throw Error('BANK_EDIT_CONFLICT');
      basis = raw; return values;
    },
    async prepare(changes) {
      check(); const copied = structuredClone(changes), expected = basis;
      if (!expected) throw Error('BANK_EDIT_NOT_LOADED');
      const fields = cardIndex === null ? BANK_EDIT_FIELDS : CARD_EDIT_FIELDS;
      if (!copied || Object.getPrototypeOf(copied) !== Object.prototype || !Object.keys(copied).length ||
        Object.entries(copied).some(([key, value]) => !fields.includes(key) || typeof value !== 'string' || value.length > 20000)) throw Error('BANK_EDIT_INVALID');
      if (JSON.stringify(expected) !== JSON.stringify(await loadRaw()) || basis !== expected) throw Error('BANK_EDIT_CONFLICT');
      const patch = {};
      for (const [field, value] of Object.entries(copied)) {
        const encrypted = BANK_EDIT_SECRETS.includes(field) || isEncryptedValue(expected.target[field]);
        patch[field] = encrypted && value !== '' ? await context.encrypt(value) : value;
        check(); if (encrypted && value !== '' && !isEncryptedValue(patch[field])) throw Error('BANK_EDIT_ENCRYPTION_FAILED');
      }
      const request = validateBankingEditRequest({expectedOwnerUid: uid, operationId: crypto.randomUUID(), account: selection,
        bankId, cardIndex, patch, expectedRevision: expected.state.revision, expectedFingerprint: await hash(expected.state.fingerprintInput)});
      check(); if (basis !== expected) throw Error('BANK_EDIT_CONFLICT');
      const plan = Object.freeze({}); plans.set(plan, {request, pending: false}); return plan;
    },
    async send(plan) {
      check(); const entry = plans.get(plan); if (!entry || entry.pending) throw Error('BANK_EDIT_PLAN_INVALID');
      entry.pending = true;
      try {const result = await submit(structuredClone(entry.request)); check(); return result;}
      finally {entry.pending = false;}
    }
  });
}
