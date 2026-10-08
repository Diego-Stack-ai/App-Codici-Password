import {createAccountWriteFenceLab} from './account-write-fence-lab.mjs';
import {restoreReferenceParents} from './restore-reference-scope.mjs';
import {createHash} from 'node:crypto';
import {validateRestoreProfileDeadlinePairs} from './restore-profile-deadline-pair.mjs';

// Account/direct attachments plus embedded widgets: both old and new parents are fenced.
// Shared references remain excluded until their complete link protocol is connected.
export function createRestoreAccountFenceLab(store) {
  const beforeAccountWrite = createAccountWriteFenceLab(store);
  return async (transaction, records, previous = []) => {
    if (!Array.isArray(records) || !records.length) {
      throw Error('RESUME_SCOPE_FENCE_NOT_CONNECTED');
    }
    const uid=records[0].path.split('/')[1];
    validateRestoreProfileDeadlinePairs(uid,records);
    validateRestoreProfileDeadlinePairs(uid,records.flatMap((record,index)=>previous[index]==null?[]:[{path:record.path,data:previous[index]}]));
    const parents = records.flatMap((record,index) => restoreReferenceParents(record,previous[index] ?? null));
    for (const record of records.filter(record=>/^users\/[^/]+(?:\/aziende\/[^/]+)?$/.test(record.path))) {
      for (const parent of restoreReferenceParents(record)) {
        if(records.some(item=>item.path===parent))continue;
        const uid=parent.split('/')[1], hash=createHash('sha256').update(parent).digest('hex');
        const snapshot=await transaction.get(store.doc(`labCandidateRecords/${uid}/items/${hash}`));
        if(!snapshot.exists)throw Error('RESUME_PROFILE_PARENT_MISSING');
      }
    }
    // Replacing an Account must not remove a bank still used by an existing
    // embedded widget. Query and replacement participate in the same commit.
    for (const record of records.filter(record => /^users\/[^/]+\/(?:aziende\/[^/]+\/)?accounts\/[^/]+$/.test(record.path))) {
      const parts = record.path.split('/'), uid = parts[1], accountId = parts.at(-1);
      const widgets = await transaction.get(store.collection(`labCandidateRecords/${uid}/items`)
        .where('kind','==','embedded').where('accountId','==',accountId).limit(401));
      if (widgets.size > 400) throw Error('RESUME_WIDGET_INVENTORY_TOO_LARGE');
      for (const snapshot of widgets.docs) {
        const replacement = records.find(item => createHash('sha256').update(item.path).digest('hex') === snapshot.id);
        const data = replacement?.data ?? snapshot.data();
        const expectedContext = parts.length === 6 ? 'company' : 'private';
        if (data.context !== expectedContext || (expectedContext === 'company' && data.companyId !== parts[3]) || data.accountId !== accountId) continue;
        if (data.bankId != null && (!Array.isArray(record.data.banking) ||
            record.data.banking.filter(bank => bank?.bankId === data.bankId).length !== 1)) throw Error('RESUME_WIDGET_BANK_MISSING');
      }
    }
    for (const record of records.filter(record => /\/(?:accountWidgets|attachments)\//.test(record.path))) {
      const widget = /\/accountWidgets\//.test(record.path);
      const parent = restoreReferenceParents(record)[0];
      let account = records.find(item => item.path === parent)?.data;
      if (!account) {
        const uid = parent.split('/')[1], hash = createHash('sha256').update(parent).digest('hex');
        const snapshot = await transaction.get(store.doc(`labCandidateRecords/${uid}/items/${hash}`));
        if (!snapshot.exists) throw Error(widget ? 'RESUME_WIDGET_PARENT_MISSING' : 'RESUME_ATTACHMENT_PARENT_MISSING');
        account = snapshot.data();
      }
      if (widget && record.data.bankId != null && (!Array.isArray(account.banking) ||
          account.banking.filter(bank => bank?.bankId === record.data.bankId).length !== 1)) throw Error('RESUME_WIDGET_BANK_MISSING');
    }
    const apply = [];
    for (const path of new Set(parents)) {
      apply.push(await beforeAccountWrite(transaction, store.doc(path)));
    }
    return () => {for (const commit of apply) commit();};
  };
}
