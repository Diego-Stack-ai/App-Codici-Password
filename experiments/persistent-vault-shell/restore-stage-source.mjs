// Sequential stage preparation. Retry uses the same operation and byte digest;
// the server owns stage identity and all publication/generation decisions.
export function createRestoreStageSource({uid, submit, upload, isActive, signal}) {
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(uid || '') || [submit, upload, isActive].some(fn => typeof fn !== 'function'))
    throw Error('STAGE_SOURCE_CONFIG');
  let closed = false, busy = false, ownedCopy = null;
  const dispose = () => {
    closed = true; ownedCopy?.fill(0); ownedCopy = null;
    signal?.removeEventListener('abort', dispose);
  };
  signal?.addEventListener('abort', dispose, {once:true});
  const check = () => {if (closed || signal?.aborted || isActive() !== true) throw Error('STAGE_SOURCE_INACTIVE');};
  const validate = value => {
    if (!/^[a-f0-9]{64}$/.test(value?.stageId || '') || ![1, 2, 3].includes(value.revision) ||
        typeof value.destinationPath !== 'string' || !value.destinationPath.startsWith(`users/${uid}/`) ||
        value.destinationPath.includes('..') || !Number.isSafeInteger(value.expiresAtMillis) ||
        (value.revision > 1 && !/^[1-9][0-9]*$/.test(value.generation || ''))) throw Error('STAGE_SOURCE_RESPONSE');
    return value;
  };
  return Object.freeze({dispose, async prepare({operationId, storagePath, bytes}) {
    check(); if (busy) throw Error('STAGE_SOURCE_BUSY');
    if (!/^[A-Za-z0-9._:-]{1,160}$/.test(operationId || '') || typeof storagePath !== 'string' ||
        !storagePath.startsWith(`users/${uid}/`) || storagePath.includes('..') ||
        !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 25 * 1024 * 1024 + 1024) throw Error('STAGE_SOURCE_INPUT');
    const copy = new Uint8Array(bytes); ownedCopy = copy; busy = true;
    try {
      const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', copy)), byte => byte.toString(16).padStart(2, '0')).join('');
      check();
      let result = validate(await submit({expectedOwnerUid: uid, action: 'claim', operationId, storagePath, sha256, size: copy.length}));
      check(); const stageId = result.stageId, destinationPath = result.destinationPath;
      const stable = value => {
        validate(value);
        if (value.stageId !== stageId || value.destinationPath !== destinationPath) throw Error('STAGE_SOURCE_RESPONSE');
        return value;
      };
      if (result.revision === 1) {
        await upload({stageId, bytes: copy}); check();
        result = stable(await submit({expectedOwnerUid: uid, action: 'status', stageId})); check();
        if (result.revision < 2) throw Error('STAGE_SOURCE_UNCONFIRMED');
      }
      if (result.revision === 2) {
        const verifiedGeneration = result.generation;
        result = stable(await submit({expectedOwnerUid: uid, action: 'publish', stageId, expectedRevision: 2})); check();
        if (result.generation !== verifiedGeneration) throw Error('STAGE_SOURCE_RESPONSE');
      }
      if (result.revision !== 3) throw Error('STAGE_SOURCE_UNCONFIRMED');
      return {stageId, storagePath, destinationPath, generation: result.generation, sha256, size: copy.length};
    } finally {copy.fill(0); ownedCopy = null; busy = false;}
  }});
}
