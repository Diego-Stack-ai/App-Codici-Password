// Authenticated metadata boundary only. Bytes use the separate bounded upload.
// No production registration and no client-selected UID or generation authority.
export function createRestoreStageHandler({stageLab}) {
  if (['claim', 'status', 'publish'].some(key => typeof stageLab?.[key] !== 'function'))
    throw Error('STAGE_HANDLER_CONFIG');
  return async (data, trusted) => {
    const uid = trusted?.auth?.uid;
    if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid) || !trusted?.app?.appId)
      throw Error('STAGE_UNAUTHENTICATED');
    if (!data || data.expectedOwnerUid !== uid) throw Error('STAGE_OWNER_MISMATCH');
    const command = structuredClone(data);
    const fields = command.action === 'claim'
      ? ['expectedOwnerUid', 'action', 'operationId', 'storagePath', 'sha256', 'size']
      : command.action === 'publish'
        ? ['expectedOwnerUid', 'action', 'stageId', 'expectedRevision']
        : command.action === 'status' ? ['expectedOwnerUid', 'action', 'stageId'] : null;
    if (!fields || Object.keys(command).some(key => !fields.includes(key))) throw Error('STAGE_REQUEST_INVALID');
    if (command.action === 'claim') {
      const {action, ...input} = command;
      return stageLab.claim(uid, input);
    }
    if (typeof command.stageId !== 'string' || !/^[a-f0-9]{64}$/.test(command.stageId)) throw Error('STAGE_REQUEST_INVALID');
    if (command.action === 'publish') {
      if (command.expectedRevision !== 2) throw Error('STAGE_REQUEST_INVALID');
      return stageLab.publish(uid, {stageId: command.stageId, expectedRevision: 2});
    }
    return stageLab.status(uid, {stageId: command.stageId});
  };
}
