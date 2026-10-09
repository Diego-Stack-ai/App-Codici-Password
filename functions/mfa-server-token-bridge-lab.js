"use strict";

async function runServerOnlyTokenBridgeLab({uid, enrollmentId, mintCustomToken,
    exchangeCustomToken, withdraw, revokeRefreshTokens}) {
    if (!uid || !enrollmentId || [mintCustomToken, exchangeCustomToken, withdraw,
        revokeRefreshTokens].some(fn => typeof fn !== "function")) {
        throw new TypeError("MFA_TOKEN_BRIDGE_INPUT_INVALID");
    }
    const customToken = await mintCustomToken(uid, {mfaRecoveryOnly: true});
    let exchanged;
    try {
        exchanged = await exchangeCustomToken(customToken);
        if (!exchanged || typeof exchanged.idToken !== "string" ||
            typeof exchanged.refreshToken !== "string") {
            throw new Error("MFA_TOKEN_BRIDGE_EXCHANGE_INVALID");
        }
        await withdraw({idToken: exchanged.idToken, mfaEnrollmentId: enrollmentId});
        return {ok: true, removedEnrollmentId: enrollmentId};
    } finally {
        if (exchanged?.refreshToken) await revokeRefreshTokens(uid);
    }
}

module.exports = {runServerOnlyTokenBridgeLab};
