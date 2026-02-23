const admin = require("firebase-admin");
admin.initializeApp({
    projectId: "appcodici-password"
});
const db = admin.firestore();

const targetUid = "aebi78Ja4rOvbYcmTlr4m2Or1AE2";

async function resetTokens() {
    console.log(`--- RESETTING TOKENS FOR ${targetUid} ---`);
    const userRef = db.collection("users").doc(targetUid);

    await userRef.update({
        fcmTokens: [],
        fcmToken: admin.firestore.FieldValue.delete(),
        lastTokenReset: new Date().toISOString()
    });

    const snap = await userRef.get();
    console.log("Database status after reset:");
    console.log(JSON.stringify(snap.data(), null, 2));
}

resetTokens().catch(console.error);
