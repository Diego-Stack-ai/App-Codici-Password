export async function reserveMfaRecoveryGrant(store, path, candidate) {
  return store.runTransaction(async transaction => {
    const ref = store.doc(path), snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const current = snapshot.data();
      const same = current.uid === candidate.uid && current.enrollmentId === candidate.enrollmentId &&
        current.codeHash === candidate.codeHash && current.status === 'reserved';
      if (!same) throw Error('MFA_RECOVERY_GRANT_CONFLICT');
      return {status: 'reserved', duplicate: true, revision: current.revision};
    }
    const record = {...candidate, status: 'reserved', revision: 1};
    transaction.create(ref, record);
    return {status: 'reserved', duplicate: false, revision: 1};
  });
}

export async function finalizeMfaRecoveryGrant(store, path, expectedRevision, observedEnrollmentIds, nowMs) {
  return store.runTransaction(async transaction => {
    const ref = store.doc(path), snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw Error('MFA_RECOVERY_GRANT_MISSING');
    const current = snapshot.data();
    if (current.status === 'consumed') return {status: 'consumed', duplicate: true, revision: current.revision};
    if (current.status !== 'reserved' || current.revision !== expectedRevision) {
      throw Error('MFA_RECOVERY_GRANT_STALE');
    }
    if (!Number.isSafeInteger(nowMs) || nowMs > current.expiresAtMs) throw Error('MFA_RECOVERY_GRANT_EXPIRED');
    if (!Array.isArray(observedEnrollmentIds) || observedEnrollmentIds.includes(current.enrollmentId)) {
      throw Error('MFA_RECOVERY_FACTOR_STILL_PRESENT');
    }
    transaction.update(ref, {status: 'consumed', consumedAtMs: nowMs, revision: current.revision + 1});
    return {status: 'consumed', duplicate: false, revision: current.revision + 1};
  });
}
