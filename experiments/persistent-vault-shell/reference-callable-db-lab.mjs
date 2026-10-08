import {createAccountWriteFenceLab} from './account-write-fence-lab.mjs';

// Lab-only transport for existing widget/shared-reference handlers. No copied
// business logic; all writes, including audit/receipt, remain in one transaction.
export function createReferenceCallableDbLab(db) {
  const beforeWrite = createAccountWriteFenceLab(db);
  return {projectId: db.projectId, doc: path => db.doc(path), collection: path => db.collection(path),
    runTransaction: callback => db.runTransaction(async tx => {
      const accounts = new Map(), writes = [];
      const staged = {
        get: async ref => {
          if (typeof ref.path === 'string' && /^users\/[^/]+\/(?:aziende\/[^/]+\/)?accounts\/[^/]+$/.test(ref.path)) accounts.set(ref.path, ref);
          return tx.get(ref);
        }
      };
      for (const method of ['set', 'update', 'create', 'delete']) staged[method] = (...args) => { writes.push([method, args]); return staged; };
      const result = await callback(staged);
      if (writes.length) {
        const commits = [];
        for (const ref of accounts.values()) commits.push(await beforeWrite(tx, ref));
        for (const commit of commits) commit();
        for (const [method, args] of writes) tx[method](...args);
      }
      return result;
    })};
}
