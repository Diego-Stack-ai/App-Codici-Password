const admin = require("firebase-admin");
admin.initializeApp({
    projectId: "appcodici-password"
});
const db = admin.firestore();

async function listUsers() {
    console.log("--- LISTING USERS ---");
    const snap = await db.collection("users").get();
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`UID: ${doc.id}`);
        console.log(`Email: ${data.email}`);
        console.log(`Tokens (Array):`, data.fcmTokens);
        console.log(`Token (Legacy):`, data.fcmToken);
        console.log(`Prefs Push:`, data.prefs_push);
        console.log("--------------------");
    });
}

listUsers().catch(console.error);
