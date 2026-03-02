/**
 * Script backfill OPZIONE B: 
 * - names per modalità nel config corretto
 * - notificationEmails per modalità nel config corretto
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function backfillOptionB() {
    console.log('🔧 Backfill Opzione B: names + notificationEmails per modalità...\n');

    const usersSnap = await db.collection('users').get();

    for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const userData = userDoc.data();
        const displayName = `${userData.nome || ''} ${userData.cognome || ''}`.trim() || uid;
        console.log(`👤 Utente: ${displayName} (${uid})`);

        const scadenzeSnap = await db.collection('users').doc(uid).collection('scadenze').get();
        if (scadenzeSnap.empty) { console.log('   ℹ️ Nessuna scadenza.\n'); continue; }

        // Raggruppa per modalità
        const data = { automezzi: { names: new Set(), emails: new Set() }, documenti: { names: new Set(), emails: new Set() }, generali: { names: new Set(), emails: new Set() } };

        scadenzeSnap.docs.forEach(s => {
            const d = s.data();
            const mode = d.mode || 'generali';
            if (d.name?.trim()) data[mode]?.names.add(d.name.trim());
            if (d.email1?.trim() && d.email1 !== 'manual') data[mode]?.emails.add(d.email1.trim());
            if (d.email2?.trim() && d.email2 !== 'manual') data[mode]?.emails.add(d.email2.trim());
        });

        const modeToDoc = {
            automezzi: 'deadlineConfig',
            documenti: 'deadlineConfigDocuments',
            generali: 'generalConfig'
        };

        for (const [mode, docName] of Object.entries(modeToDoc)) {
            const update = {};
            if (data[mode].names.size > 0) update.names = [...data[mode].names].sort();
            if (data[mode].emails.size > 0) update.notificationEmails = [...data[mode].emails].sort();

            if (Object.keys(update).length > 0) {
                await db.collection('users').doc(uid).collection('settings').doc(docName).set(update, { merge: true });
                console.log(`   ✅ ${docName}: names=[${(update.names || []).join(', ')}] | emails=[${(update.notificationEmails || []).join(', ')}]`);
            } else {
                console.log(`   ℹ️ ${docName}: nessun dato da scadenze ${mode}`);
            }
        }
        console.log('');
    }

    console.log('✅ Backfill Opzione B completato!');
    process.exit(0);
}

backfillOptionB().catch(e => { console.error('❌ Errore:', e.message); process.exit(1); });
