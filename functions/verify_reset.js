const admin = require("firebase-admin");
admin.initializeApp({
    projectId: "appcodici-password"
});
const db = admin.firestore();

const targetUid = "aebi78Ja4rOvbYcmTlr4m2Or1AE2";

async function verifyReset() {
    const userRef = db.collection("users").doc(targetUid);
    const snap = await userRef.get();
    const data = snap.data();
    console.log("VERIFICATION REPORT:");
    console.log(`- fcmTokens exists: ${!!data.fcmTokens}`);
    console.log(`- fcmTokens length: ${data.fcmTokens ? data.fcmTokens.length : 'N/A'}`);
    console.log(`- fcmToken (singular) exists: ${data.hasOwnProperty('fcmToken')}`);
    console.log("- Full Data (Tokens/LastRefresh):", {
        fcmTokens: data.fcmTokens,
        fcmToken: data.fcmToken,
        lastTokenReset: data.lastTokenReset
    });
}

verifyReset().catch(console.error);
