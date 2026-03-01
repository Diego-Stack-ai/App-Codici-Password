const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function countTotal() {
    const usersSnap = await db.collection('users').get();
    console.log(`--- REPORT AUDIT ACCOUNT PRIVATI ---`);
    let grandTotal = 0;
    let todayTotal = 0;
    let encryptedTotal = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const userDoc of usersSnap.docs) {
        const email = userDoc.id;
        const accountsSnap = await db.collection('users').doc(userDoc.id).collection('accounts').get();
        let userCount = 0;

        console.log(`\nElenco account per ${email}:`);
        accountsSnap.forEach(doc => {
            const data = doc.data();
            userCount++;
            console.log(`- ${data.nomeAccount} (ID: ${doc.id})`);
        });

        grandTotal += userCount;
    }

    console.log(`\n-------------------------------------`);
    console.log(`TOTALE GLOBALE: ${grandTotal}`);
    process.exit(0);
}

countTotal().catch(err => {
    console.error(err);
    process.exit(1);
});
