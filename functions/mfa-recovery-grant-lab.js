"use strict";

function createRecoveryGrant({uid, enrollmentId, codeHash, nowMs, ttlMs = 5 * 60 * 1000}) {
    if (!uid || !enrollmentId || !codeHash || !Number.isSafeInteger(nowMs) || ttlMs <= 0) {
        throw new TypeError("MFA_RECOVERY_GRANT_INPUT_INVALID");
    }
    return Object.freeze({
        uid,
        enrollmentId,
        codeHash,
        createdAtMs: nowMs,
        expiresAtMs: nowMs + ttlMs,
        status: "reserved",
    });
}

function authorizeSelectiveWithdrawal({grant, decodedToken, enrollmentId, nowMs}) {
    if (!grant || grant.status !== "reserved") {
        throw new Error("MFA_RECOVERY_GRANT_NOT_RESERVED");
    }
    if (!Number.isSafeInteger(nowMs) || nowMs > grant.expiresAtMs) {
        throw new Error("MFA_RECOVERY_GRANT_EXPIRED");
    }
    if (!decodedToken || decodedToken.uid !== grant.uid) {
        throw new Error("MFA_RECOVERY_TOKEN_UID_MISMATCH");
    }
    if (enrollmentId !== grant.enrollmentId) {
        throw new Error("MFA_RECOVERY_ENROLLMENT_MISMATCH");
    }
    return Object.freeze({uid: grant.uid, enrollmentId: grant.enrollmentId});
}

function finalizeRecoveryGrant({grant, observedEnrollmentIds, nowMs}) {
    if (!grant || grant.status !== "reserved") {
        throw new Error("MFA_RECOVERY_GRANT_NOT_RESERVED");
    }
    if (!Number.isSafeInteger(nowMs) || nowMs > grant.expiresAtMs) {
        throw new Error("MFA_RECOVERY_GRANT_EXPIRED");
    }
    if (!Array.isArray(observedEnrollmentIds)) {
        throw new TypeError("MFA_RECOVERY_FACTORS_REQUIRED");
    }
    if (observedEnrollmentIds.includes(grant.enrollmentId)) {
        throw new Error("MFA_RECOVERY_FACTOR_STILL_PRESENT");
    }
    return Object.freeze({...grant, status: "consumed", consumedAtMs: nowMs});
}

module.exports = {createRecoveryGrant, authorizeSelectiveWithdrawal, finalizeRecoveryGrant};
