import {bankingEditBasis, validateBankingEditRequest} from './banking-edit-contract.mjs';
import {profileTextId, profileTextHash} from './profile-text-contract.mjs';

// Existing canonical banks/cards only. No creation, deletion, relinking or
// implicit legacy normalization. Scope is the loopback candidate bridge.
export function createBankingEditHandler({db, hash, timestamp, beforeAccountWrite}) {
  return async (data, trusted) => {
    const uid = trusted?.auth?.uid;
    if (!profileTextId(uid) || !trusted?.app?.appId) throw Error('UNAUTHENTICATED');
    const request = validateBankingEditRequest(data);
    if (uid !== request.expectedOwnerUid) throw Error('OWNER_MISMATCH');
    const digest = await hash(JSON.stringify({uid, ...request}));
    if (!profileTextHash(digest)) throw Error('HASH_INVALID');
    const {account, operationId, expectedRevision, expectedFingerprint, bankId, cardIndex, patch} = request;
    const parent = account.domain === 'company' ? `users/${uid}/aziende/${account.companyId}` : `users/${uid}`;
    const ref = db.doc(`${parent}/accounts/${account.id}`);
    const receiptRef = db.doc(`mutationResults/${uid}/operations/banking-edit-${operationId}`);
    return db.runTransaction(async tx => {
      const receipt = await tx.get(receiptRef);
      if (receipt.exists) {
        const saved = receipt.data();
        if (saved.kind !== 'banking-edit' || saved.ownerId !== uid || saved.digest !== digest || saved.revision !== expectedRevision + 1)
          throw Error('OPERATION_CONFLICT');
        return {status: 'confirmed', revision: saved.revision};
      }
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw Error('ACCOUNT_UNAVAILABLE');
      if (account.domain === 'company') {
        const company = await tx.get(db.doc(parent)), value = company.exists && company.data();
        if (!value || value.isArchived || (value.ownerId !== undefined && value.ownerId !== uid) ||
          (value.id !== undefined && value.id !== account.companyId)) throw Error('COMPANY_UNAVAILABLE');
      }
      const record = snapshot.data(), basis = bankingEditBasis(record, uid, account);
      if (basis.revision !== expectedRevision || await hash(basis.fingerprintInput) !== expectedFingerprint) throw Error('BANK_EDIT_CONFLICT');
      const index = record.banking.findIndex(bank => bank.bankId === bankId);
      if (index < 0 || (cardIndex !== null && !record.banking[index].cards?.[cardIndex])) throw Error('BANK_EDIT_TARGET_MISSING');
      const banking = record.banking.map((bank, current) => current !== index ? bank : cardIndex === null
        ? {...bank, ...patch} : {...bank, cards: bank.cards.map((card, at) => at === cardIndex ? {...card, ...patch} : card)});
      const commitFence = beforeAccountWrite ? await beforeAccountWrite(tx, ref) : null;
      if (commitFence) commitFence();
      tx.update(ref, {banking, revision: expectedRevision + 1, schemaVersion: 1, updatedAt: timestamp()});
      tx.create(receiptRef, {kind: 'banking-edit', ownerId: uid, digest, revision: expectedRevision + 1, createdAt: timestamp()});
      return {status: 'confirmed', revision: expectedRevision + 1};
    });
  };
}
