// Candidate handler. Authentication/attestation must come from the server transport,
// never from request data. Does not register a production callable.
export function createRestoreResumeHandler({plans, writer}) {
  return async (data, trusted) => {
    const uid = trusted?.auth?.uid;
    if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid) || !trusted?.app?.appId)
      throw Error('RESUME_UNAUTHENTICATED');
    if (!data || data.expectedOwnerUid !== uid) throw Error('RESUME_OWNER_MISMATCH');
    if (data.action === 'cleanupExpired') {
      if (Object.keys(data).some(key => !['expectedOwnerUid', 'action', 'after'].includes(key)) ||
          (data.after !== null && data.after !== undefined && !/^[a-f0-9]{64}$/.test(data.after))) throw Error('RESUME_REQUEST_INVALID');
      return plans.sweepExpired(uid, {limit: 50, after: data.after ?? null});
    }
    if (data.action === 'preview') {
      if (Object.keys(data).some(key => !['expectedOwnerUid', 'action', 'inputs'].includes(key))) throw Error('RESUME_REQUEST_INVALID');
      return plans.preview(uid, data.inputs);
    }
    if (data.action === 'reconstruct') {
      if (Object.keys(data).some(key => !['expectedOwnerUid', 'action', 'planId', 'backupId', 'records'].includes(key)) ||
        typeof data.planId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(data.planId)) throw Error('RESUME_REQUEST_INVALID');
      return plans.reconstruct(uid, data.planId, data.backupId, data.records);
    }
    if (Object.keys(data).some(key => !['expectedOwnerUid', 'action', 'planId', 'inputs', 'stageCommands'].includes(key)))
      throw Error('RESUME_REQUEST_INVALID');
    const {action, planId, inputs, stageCommands} = structuredClone(data);
    if (!Array.isArray(stageCommands)) throw Error('RESUME_STAGE_INVALID');
    if (action === 'recoverCreation') {
      if (planId !== undefined) throw Error('RESUME_REQUEST_INVALID');
      return plans.recoverCreation(uid, inputs, stageCommands);
    }
    if (action === 'create') {
      if (planId !== undefined) throw Error('RESUME_REQUEST_INVALID');
      const plan = await plans.create(uid, inputs, stageCommands);
      return {planId: plan.planId, expiresAtMs: plan.expiresAtMs};
    }
    if (typeof planId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(planId)) throw Error('RESUME_REQUEST_INVALID');
    if (action === 'inspect') return plans.reconcile(uid, planId, inputs, stageCommands);
    if (action === 'resume') return writer.commitPlan(uid, planId, inputs, stageCommands);
    throw Error('RESUME_REQUEST_INVALID');
  };
}
