import {bankingLifecycleBasis, validateBankingLifecycleRequest, applyBankingLifecycle} from './banking-lifecycle-contract.mjs';
import {profileTextId, profileTextHash} from './profile-text-contract.mjs';

// Candidate only. Deleting a bank is prohibited while any attached widget exists.
export function createBankingLifecycleHandler({db, hash, timestamp, beforeAccountWrite}) {
  if (typeof beforeAccountWrite !== 'function') throw Error('BANK_LIFECYCLE_FENCE_REQUIRED');
  return async (data, trusted) => {
    const uid = trusted?.auth?.uid;
    if (!profileTextId(uid) || !trusted?.app?.appId) throw Error('UNAUTHENTICATED');
    const request = validateBankingLifecycleRequest(structuredClone(data));
    if (request.expectedOwnerUid !== uid) throw Error('OWNER_MISMATCH');
    const digest = await hash(JSON.stringify({uid,...request}));
    if (!profileTextHash(digest)) throw Error('HASH_INVALID');
    const {account,expectedRevision,expectedFingerprint} = request;
    const parent = account.domain === 'company' ? `users/${uid}/aziende/${account.companyId}` : `users/${uid}`;
    const ref = db.doc(`${parent}/accounts/${account.id}`);
    const receiptRef = db.doc(`mutationResults/${uid}/operations/banking-lifecycle-${request.operationId}`);
    return db.runTransaction(async tx => {
      const receipt = await tx.get(receiptRef);
      if (receipt.exists) {
        const saved = receipt.data();
        if (saved.kind !== 'banking-lifecycle' || saved.ownerId !== uid || saved.digest !== digest || saved.revision !== expectedRevision+1)
          throw Error('OPERATION_CONFLICT');
        return {status:'confirmed',revision:saved.revision};
      }
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw Error('ACCOUNT_UNAVAILABLE');
      if (account.domain === 'company') {
        const company = await tx.get(db.doc(parent)), value = company.exists && company.data();
        if (!value || value.isArchived || (value.ownerId !== undefined && value.ownerId !== uid) ||
            (value.id !== undefined && value.id !== account.companyId)) throw Error('COMPANY_UNAVAILABLE');
      }
      const record = snapshot.data(), basis = bankingLifecycleBasis(record,uid,account);
      if (basis.revision !== expectedRevision || await hash(basis.fingerprintInput) !== expectedFingerprint) throw Error('BANK_EDIT_CONFLICT');
      if (request.action === 'delete-bank') {
        let query = db.collection(`users/${uid}/accountWidgets`).where('context','==',account.domain)
          .where('accountId','==',account.id).where('bankId','==',request.bankId);
        if (account.domain === 'company') query = query.where('companyId','==',account.companyId);
        if (!(await tx.get(query.limit(1))).empty) throw Error('BANK_LIFECYCLE_WIDGETS_PRESENT');
      }
      const banking = applyBankingLifecycle(record.banking,request);
      const commitFence = await beforeAccountWrite(tx,ref);
      if (typeof commitFence !== 'function') throw Error('BANK_LIFECYCLE_FENCE_REQUIRED');
      commitFence();
      tx.update(ref,{banking,revision:expectedRevision+1,schemaVersion:1,updatedAt:timestamp()});
      tx.create(receiptRef,{kind:'banking-lifecycle',ownerId:uid,digest,revision:expectedRevision+1,createdAt:timestamp()});
      return {status:'confirmed',revision:expectedRevision+1};
    });
  };
}
