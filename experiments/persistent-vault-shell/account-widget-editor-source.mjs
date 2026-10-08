import {createSessionAccountWidgetWriter} from './account-widget-write-capability.mjs';

// Edits existing embedded widgets only; shared records have a distinct owner.
export function createAccountWidgetEditorSource({context, getUser, account, listConfirmed, readAccount, ...options}) {
  const uid = context.user?.uid, target = structuredClone(account);
  const bankId = target.bankId ?? null;
  if (bankId !== null && (typeof bankId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(bankId))) throw Error('WIDGET_BANK_UNAVAILABLE');
  const writer = createSessionAccountWidgetWriter({context, getUser, account: target, ...options});
  let basis = null, closed = false, newId = null;
  const check = () => {
    if (closed || context.signal.aborted || getUser()?.uid !== uid) throw Error('VIEW_DISPOSED');
    context.assertUnlocked();
  };
  const checkParent = parent => {
    if (!parent || parent.isArchived || (parent.ownerId !== undefined && parent.ownerId !== uid)) throw Error('WIDGET_ACCOUNT_UNAVAILABLE');
    if (bankId !== null) {
      const banks = Array.isArray(parent.banking) ? parent.banking : parent.banking && typeof parent.banking === 'object' ? [parent.banking] : [];
      if (banks.filter(bank => bank?.bankId === bankId).length !== 1) throw Error('WIDGET_BANK_UNAVAILABLE');
    }
  };
  const loadRaw = async id => {
    check();
    const parent = await readAccount(); check();
    checkParent(parent);
    const rows = await listConfirmed(); check();
    const matches = rows.filter(row => row.id === id);
    const row = matches[0];
    if (matches.length !== 1 || row.kind !== 'embedded' || (row.bankId ?? null) !== bankId || row.context !== target.context || row.accountId !== target.accountId ||
        (target.context === 'company' ? row.companyId !== target.companyId : Boolean(row.companyId)) || row.isArchived ||
        !Number.isSafeInteger(row.revision) || row.revision < 1 || !Array.isArray(row.fields)) throw Error('WIDGET_UNAVAILABLE');
    return structuredClone(row);
  };
  const dispose = () => {closed = true; basis = null; newId = null; writer.dispose(); context.signal.removeEventListener('abort', dispose);};
  context.signal.addEventListener('abort', dispose, {once: true});
  return Object.freeze({dispose,
    async prepareCreate(data) {
      check(); data = structuredClone(data);
      const parent = await readAccount(); check();
      checkParent(parent);
      newId ??= crypto.randomUUID();
      const rows = await listConfirmed(); check();
      if (rows.some(row => row.id === newId)) throw Error('WIDGET_CHANGED');
      // Generic creation cannot select banking/shared ownership or inject revision.
      const draft = {title: data?.title, fields: data?.fields, ...(bankId !== null ? {bankId} : {})};
      const plan = await writer.prepare({action: 'create', widgetId: newId, data: draft});
      check(); return plan;
    },
    async load(id) {
      basis = null;
      const raw = await loadRaw(id), data = structuredClone(raw);
      for (const field of data.fields) {
        if (field.encrypted) {
          field.value = await context.read({ownerId: uid, ciphertext: field.valueEnc}); check();
          if (typeof field.value !== 'string' || field.value === field.valueEnc || field.value === '--ERRORE--') throw Error('WIDGET_DECRYPT_FAILED');
          delete field.valueEnc;
        }
      }
      if (JSON.stringify(raw) !== JSON.stringify(await loadRaw(id))) throw Error('WIDGET_CHANGED');
      check(); basis = raw;
      return data;
    },
    async prepare(data) {
      check(); data = structuredClone(data); if (!basis) throw Error('WIDGET_NOT_LOADED');
      const expected = basis;
      if (JSON.stringify(expected) !== JSON.stringify(await loadRaw(expected.id))) throw Error('WIDGET_CHANGED');
      check();
      // The view changes only title and values. Keep all placement and field
      // metadata from the confirmed snapshot, not from caller-supplied objects.
      if (!data || !Array.isArray(data.fields) || data.fields.length !== expected.fields.length ||
          data.fields.some((field, i) => field.id !== expected.fields[i].id)) throw Error('WIDGET_FIELDS_CHANGED');
      const draft = {...expected, title: data.title, fields: expected.fields.map((field, i) => {
        const next = {...field, value: data.fields[i].value}; delete next.valueEnc; return next;
      })};
      const plan = await writer.prepare({action: 'update', widgetId: expected.id, expectedRevision: expected.revision, data: draft});
      check(); if (basis !== expected) throw Error('WIDGET_CHANGED'); return plan;
    },
    async prepareDelete() {
      check(); if (!basis) throw Error('WIDGET_NOT_LOADED');
      const expected = basis;
      if (JSON.stringify(expected) !== JSON.stringify(await loadRaw(expected.id))) throw Error('WIDGET_CHANGED');
      const plan = await writer.prepare({action: 'delete', widgetId: expected.id, expectedRevision: expected.revision});
      check(); if (basis !== expected) throw Error('WIDGET_CHANGED'); return plan;
    },
    send: plan => writer.send(plan)
  });
}
