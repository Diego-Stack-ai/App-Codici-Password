"use strict";

const {authorizeSelectiveWithdrawal} = require("./mfa-recovery-grant-lab");

async function runSelectiveRecoveryLab({
    grant, idToken, enrollmentId, nowMs, verifyIdToken, withdraw, listEnrollmentIds, finalize,
}) {
    if ([verifyIdToken, withdraw, listEnrollmentIds, finalize].some(fn => typeof fn !== "function")) {
        throw new TypeError("MFA_RECOVERY_FLOW_DEPENDENCY_REQUIRED");
    }
    const decodedToken = await verifyIdToken(idToken);
    const binding = authorizeSelectiveWithdrawal({grant, decodedToken, enrollmentId, nowMs});
    let withdrawError = null;
    try {
        await withdraw({idToken, mfaEnrollmentId: binding.enrollmentId});
    } catch (error) {
        withdrawError = error;
    }
    const observedEnrollmentIds = await listEnrollmentIds(binding.uid);
    if (observedEnrollmentIds.includes(binding.enrollmentId)) {
        if (withdrawError) throw withdrawError;
        throw new Error("MFA_RECOVERY_FACTOR_STILL_PRESENT");
    }
    return finalize({grant, observedEnrollmentIds, nowMs});
}

module.exports = {runSelectiveRecoveryLab};
