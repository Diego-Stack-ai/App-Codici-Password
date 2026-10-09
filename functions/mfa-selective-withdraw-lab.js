"use strict";

const IDENTITY_TOOLKIT_WITHDRAW_URL =
    "https://identitytoolkit.googleapis.com/v2/accounts/mfaEnrollment:withdraw";

function createSelectiveMfaWithdrawLab({request, enabled = false} = {}) {
    if (typeof request !== "function") {
        throw new TypeError("MFA_WITHDRAW_REQUEST_REQUIRED");
    }

    return async function withdrawSingleFactor({idToken, mfaEnrollmentId, tenantId} = {}) {
        if (!enabled) {
            const error = new Error("MFA_SELECTIVE_WITHDRAW_DISABLED");
            error.code = "failed-precondition";
            throw error;
        }
        if (typeof idToken !== "string" || idToken.length < 16) {
            throw new TypeError("MFA_WITHDRAW_ID_TOKEN_REQUIRED");
        }
        if (typeof mfaEnrollmentId !== "string" || !mfaEnrollmentId.trim()) {
            throw new TypeError("MFA_WITHDRAW_ENROLLMENT_ID_REQUIRED");
        }

        const body = {
            idToken,
            mfaEnrollmentId: mfaEnrollmentId.trim(),
            ...(tenantId ? {tenantId} : {}),
        };
        const response = await request({
            method: "POST",
            url: IDENTITY_TOOLKIT_WITHDRAW_URL,
            body,
        });
        if (!response || typeof response.idToken !== "string" ||
            typeof response.refreshToken !== "string") {
            throw new Error("MFA_WITHDRAW_RESPONSE_INVALID");
        }
        return {
            idToken: response.idToken,
            refreshToken: response.refreshToken,
            removedEnrollmentId: body.mfaEnrollmentId,
        };
    };
}

module.exports = {createSelectiveMfaWithdrawLab, IDENTITY_TOOLKIT_WITHDRAW_URL};
