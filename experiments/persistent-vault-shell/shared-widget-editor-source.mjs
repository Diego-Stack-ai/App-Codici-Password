// Updates shared data or removes only this Account's link; never deletes shared data.
export function createSharedWidgetEditorSource({context, getUser, account, readAccount, listWidgets, listLinks,
  listShared, prepare, isEncryptedValue, isOnline, submit}) {
  const uid = context.user.uid, target = structuredClone(account);
  let closed = false, basis = null, plans = new WeakMap();
  const check = () => {
    if (closed || context.signal.aborted || getUser()?.uid !== uid) throw Error('VIEW_DISPOSED');
    context.assertUnlocked(); if (!isOnline()) throw Error('WIDGET_ONLINE_REQUIRED');
  };
  const one = (rows, id) => {
    const matches = rows.filter(row => row.id === id);
    if (matches.length !== 1 || matches[0].isArchived || (matches[0].ownerId !== undefined && matches[0].ownerId !== uid)) throw Error('SHARED_WIDGET_UNAVAILABLE');
    return matches[0];
  };
  const sameAccount = row => row.context === target.context && row.accountId === target.accountId &&
    (target.context === 'company' ? row.companyId === target.companyId : !row.companyId);
  const loadRaw = async id => {
    check(); const parent = await readAccount(); check();
    if (!parent || parent.isArchived || (parent.ownerId !== undefined && parent.ownerId !== uid)) throw Error('SHARED_WIDGET_UNAVAILABLE');
    const widget = one(await listWidgets(), id); check();
    if (widget.kind !== 'shared-reference' || widget.bankId || !sameAccount(widget)) throw Error('SHARED_WIDGET_UNAVAILABLE');
    const link = one(await listLinks(), widget.linkId); check();
    if (!sameAccount(link) || link.widgetId !== id || link.sharedDataId !== widget.sharedDataId) throw Error('SHARED_WIDGET_UNAVAILABLE');
    const data = one(await listShared(), widget.sharedDataId); check();
    if (!Number.isSafeInteger(data.revision) || data.revision < 1 || data.revision >= Number.MAX_SAFE_INTEGER || !Array.isArray(data.fields)) throw Error('SHARED_WIDGET_UNAVAILABLE');
    return structuredClone({widget, link, data});
  };
  const dispose = () => {closed = true; basis = null; plans = new WeakMap(); context.signal.removeEventListener('abort', dispose);};
  context.signal.addEventListener('abort', dispose, {once: true});
  return Object.freeze({dispose,
    async load(id) {
      basis = null; const raw = await loadRaw(id), model = structuredClone(raw.data);
      for (const field of model.fields) if (field.encrypted) {
        field.value = await context.read({ownerId: uid, ciphertext: field.valueEnc}); check();
        if (typeof field.value !== 'string' || field.value === field.valueEnc || field.value === '--ERRORE--') throw Error('SHARED_WIDGET_DECRYPT_FAILED');
        delete field.valueEnc;
      }
      if (JSON.stringify(raw) !== JSON.stringify(await loadRaw(id))) throw Error('WIDGET_CHANGED');
      basis = raw; return model;
    },
    async prepare(data) {
      check(); data = structuredClone(data); const expected = basis;
      if (!expected) throw Error('WIDGET_NOT_LOADED');
      if (JSON.stringify(expected) !== JSON.stringify(await loadRaw(expected.widget.id))) throw Error('WIDGET_CHANGED');
      if (!Array.isArray(data?.fields) || data.fields.length !== expected.data.fields.length ||
        data.fields.some((field, index) => field.id !== expected.data.fields[index].id)) throw Error('WIDGET_FIELDS_CHANGED');
      const draft = {...expected.data, title: data.title, fields: expected.data.fields.map((field, index) => {
        const value = {...field, value: data.fields[index].value}; delete value.valueEnc; return value;
      })};
      const prepared = await prepare(draft, async value => {
        check(); const cipher = await context.encrypt(value); check();
        if (cipher === value || !isEncryptedValue(cipher)) throw Error('WIDGET_CIPHER_INVALID'); return cipher;
      });
      check(); if (basis !== expected) throw Error('WIDGET_CHANGED');
      const plan = Object.freeze({action: 'update'});
      plans.set(plan, {pending: false, command: {expectedOwnerUid: uid, action: 'update', operationId: crypto.randomUUID(),
        sharedDataId: expected.data.id, expectedRevision: expected.data.revision, data: structuredClone(prepared)}});
      return plan;
    },
    async prepareUnlink() {
      check(); const expected = basis;
      if (!expected) throw Error('WIDGET_NOT_LOADED');
      if (JSON.stringify(expected) !== JSON.stringify(await loadRaw(expected.widget.id))) throw Error('WIDGET_CHANGED');
      check(); if (basis !== expected) throw Error('WIDGET_CHANGED');
      const plan = Object.freeze({action: 'unlink'});
      plans.set(plan, {pending: false, command: {expectedOwnerUid: uid, action: 'unlink', operationId: crypto.randomUUID(),
        sharedDataId: expected.data.id, expectedRevision: expected.data.revision,
        linkId: expected.link.id, widgetId: expected.widget.id,
        link: {context: target.context, accountId: target.accountId,
          ...(target.context === 'company' ? {companyId: target.companyId} : {})}}});
      return plan;
    },
    async send(plan) {
      check(); const entry = plans.get(plan);
      if (!entry || entry.pending) throw Error('WIDGET_PLAN_INVALID');
      entry.pending = true;
      try {
        const result = await submit(structuredClone(entry.command)); check();
        if (result?.status !== 'applied') throw Error('WIDGET_NOT_APPLIED'); return result;
      } finally {entry.pending = false;}
    }
  });
}
