const admin = require("firebase-admin");
admin.initializeApp({
    projectId: "appcodici-password"
});
const db = admin.firestore();

const targetUid = "aebi78Ja4rOvbYcmTlr4m2Or1AE2";

async function checkTokens() {
    console.log(`--- CHECKING TOKENS FOR ${targetUid} ---`);
    const userRef = db.collection("users").doc(targetUid);
    const snap = await userRef.get();

    if (!snap.exists) {
        console.log("User not found.");
        return;
    }

    const data = snap.data();
    console.log("Tokens in fcmTokens array:", data.fcmTokens || []);
    console.log("Last Token Refresh:", data.lastTokenRefresh || "N/A");
    console.log("Last Token Reset:", data.lastTokenReset || "N/A");
}

checkTokens().catch(console.error);
