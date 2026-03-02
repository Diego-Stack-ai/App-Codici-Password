/**
 * Script di verifica: legge il documento generalConfig da Firebase
 * per tutti gli utenti nella collezione 'users' e mostra il contenuto.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkGeneralConfig() {
    console.log('🔍 Verifica generalConfig su Firebase...\n');

    // Lista tutti gli utenti
    const usersSnap = await db.collection('users').get();

    if (usersSnap.empty) {
        console.log('❌ Nessun utente trovato in Firestore.');
        return;
    }

    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();
        const displayName = `${userData.nome || ''} ${userData.cognome || ''}`.trim() || userData.email || uid;

        console.log(`👤 Utente: ${displayName} (${uid})`);

        // Leggi generalConfig
        const genConfigRef = db.collection('users').doc(uid).collection('settings').doc('generalConfig');
        const genSnap = await genConfigRef.get();

        if (!genSnap.exists) {
            console.log('   ❌ generalConfig NON ESISTE su Firebase\n');
        } else {
            const data = genSnap.data();
            console.log('   ✅ generalConfig TROVATO:');
            console.log(`   📋 deadlineTypes (${(data.deadlineTypes || []).length}):`);
            (data.deadlineTypes || []).forEach(t => {
                const name = typeof t === 'object' ? t.name : t;
                const period = typeof t === 'object' ? t.period : '-';
                const freq = typeof t === 'object' ? t.freq : '-';
                console.log(`      - ${name} (avviso: ${period}gg, rep: ${freq}gg)`);
            });

            console.log(`   📧 emailTemplates (${(data.emailTemplates || []).length}):`);
            (data.emailTemplates || []).forEach(e => console.log(`      - ${e}`));

            if (data.notificationEmails && data.notificationEmails.length > 0) {
                console.log(`   📨 notificationEmails: ${data.notificationEmails.join(', ')}`);
            }
            console.log('');
        }

        // Verifica anche deadlineConfig (automezzi) e deadlineConfigDocuments
        const autoSnap = await db.collection('users').doc(uid).collection('settings').doc('deadlineConfig').get();
        const docSnap = await db.collection('users').doc(uid).collection('settings').doc('deadlineConfigDocuments').get();

        console.log(`   🚗 deadlineConfig (automezzi): ${autoSnap.exists ? `✅ ESISTE (${(autoSnap.data().deadlineTypes || []).length} tipi, ${(autoSnap.data().models || []).length} veicoli)` : '❌ NON ESISTE'}`);
        console.log(`   📄 deadlineConfigDocuments: ${docSnap.exists ? `✅ ESISTE (${(docSnap.data().deadlineTypes || []).length} tipi)` : '❌ NON ESISTE'}`);
        console.log('');
    }

    console.log('✅ Verifica completata.');
    process.exit(0);
}

checkGeneralConfig().catch(e => {
    console.error('❌ Errore:', e.message);
    process.exit(1);
});
