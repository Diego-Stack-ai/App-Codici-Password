// Candidate-only, online write boundary. UI receives no key material. The
// existing prepareEmbeddedAccountWidget model and encryption are injected.
export function createAccountWidgetWriteCapability({context, getUser, account, prepare, encrypt, submit, isOnline,
  operationId = () => crypto.randomUUID()}) {
  const uid = context.user?.uid;
  const target = structuredClone(account);
  if (!uid || !['private', 'company'].includes(target?.context) || !target.accountId ||
      (target.context === 'company' && !target.companyId)) throw Error('WIDGET_TARGET_INVALID');
  let disposed = false;
  let plans = new WeakMap();
  const check = () => {
    if (disposed || context.signal.aborted) throw Error('VIEW_DISPOSED');
    if (getUser()?.uid !== uid) throw Error('AUTH_CHANGED');
    context.assertUnlocked();
    if (!isOnline()) throw Error('WIDGET_ONLINE_REQUIRED');
  };
  const identity = {context: target.context, accountId: target.accountId,
    ...(target.context === 'company' ? {companyId: target.companyId} : {})};
  return Object.freeze({
    async prepare({action, widgetId, expectedRevision, data}) {
      check();
      if (!['create', 'update', 'delete'].includes(action) || typeof widgetId !== 'string' ||
          !/^[A-Za-z0-9._:-]{1,160}$/.test(widgetId)) throw Error('WIDGET_COMMAND_INVALID');
      if (action !== 'create' && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
          expectedRevision >= Number.MAX_SAFE_INTEGER)) throw Error('WIDGET_REVISION_INVALID');
      const command = {action, widgetId, expectedOwnerUid: uid, ...identity, operationId: operationId(),
        ...(action !== 'create' ? {expectedRevision} : {})};
      if (action !== 'delete') {
        command.data = await prepare(structuredClone(data), {...identity}, async value => {
          check(); const ciphertext = await encrypt(value); check(); return ciphertext;
        });
      }
      check();
      // Opaque identity prevents UI mutation of a prepared retry. The retained
      // command contains prepared data only, never the raw draft or key.
      const plan = Object.freeze({action, widgetId});
      plans.set(plan, {command: structuredClone(command), pending: false});
      return plan;
    },
    async send(plan) {
      check();
      const entry = plans.get(plan);
      if (!entry) throw Error('WIDGET_PLAN_INVALID');
      if (entry.pending) throw Error('WIDGET_SEND_PENDING');
      entry.pending = true;
      try {
        const result = await submit(structuredClone(entry.command));
        check();
        if (result?.status !== 'applied') throw Error('WIDGET_NOT_APPLIED');
        return result;
      } finally {entry.pending = false;}
    },
    dispose() {disposed = true; plans = new WeakMap();}
  });
}

// Bootstrap passes the established data model and callable transport. Encryption
// stays on the current protected-view context, never the legacy global session.
export function createSessionAccountWidgetWriter({context, prepare, isEncryptedValue, ...options}) {
  if (typeof context.encrypt !== 'function' || typeof isEncryptedValue !== 'function') throw Error('WIDGET_CIPHER_UNAVAILABLE');
  return createAccountWidgetWriteCapability({...options, context, prepare, encrypt: async value => {
    const ciphertext = await context.encrypt(value);
    if (ciphertext === value || !isEncryptedValue(ciphertext)) throw Error('WIDGET_CIPHER_INVALID');
    return ciphertext;
  }});
}
