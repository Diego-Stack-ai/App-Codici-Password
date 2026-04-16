const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function run() {
    try {
        const user = await admin.auth().getUser("brP8B2YxaESJTf9nydYzckQUnVf1");
        console.log("User Email:", user.email);
        
        // Also let's check one document in accounts to see if passwords are encrypted
        const db = admin.firestore();
        const accountsSnap = await db.collection("users").doc("brP8B2YxaESJTf9nydYzckQUnVf1").collection("accounts").limit(3).get();
        accountsSnap.forEach(doc => {
            console.log(doc.id, "=>", doc.data().nomeAccount, doc.data().password ? (doc.data().password.length > 30 ? "ENCRYPTED" : "CLEARTEXT") : "NO_PASSWORD", "encrypted flag:", doc.data()._encrypted);
        });
        
    } catch (e) {
        console.error(e);
    }
}
run();
