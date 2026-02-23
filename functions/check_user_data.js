const admin = require("firebase-admin");
admin.initializeApp({
    projectId: "appcodici-password"
});
const db = admin.firestore();

const targetUid = "aebi78Ja4rOvbYcmTlr4m2Or1AE2";

async function checkNotifications() {
    console.log(`--- CHECKING NOTIFICATIONS FOR ${targetUid} ---`);
    const snap = await db.collection("users").doc(targetUid).collection("notifications")
        .orderBy("timestamp", "desc").limit(5).get();

    if (snap.empty) {
        console.log("No notifications found.");
        return;
    }

    snap.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Title: ${data.title}, Time: ${data.timestamp}`);
    });
}

async function checkUser() {
    const doc = await db.collection("users").doc(targetUid).get();
    if (doc.exists) {
        console.log("User data:", doc.data().fcmTokens);
    } else {
        console.log("User doc not found!");
    }
}

checkUser().then(() => checkNotifications()).catch(console.error);
