const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!require("fs").existsSync(serviceAccountPath)) {
    console.error("❌ File serviceAccountKey.json non trovato!");
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const TARGET_UID = "brP8B2YxaESJTf9nydYzckQUnVf1";

async function importaCodiceFiscale() {
    console.log(`\n🚀 Inserimento Codice Fiscale per Utente: ${TARGET_UID}`);

    try {
        const userRef = db.collection("users").doc(TARGET_UID);
        const docSnap = await userRef.get();

        if (!docSnap.exists) {
            console.error("❌ Utente non trovato nel database.");
            return;
        }

        const userData = docSnap.data();
        const documenti = userData.documenti || [];

        const nuovoCF = {
            type: "Codice Fiscale",
            num_serie: "BSCDGI66B28A459W",
            expiry_date: "2027-04-14",
            id_number: "80380000500313823013"
        };

        // Verifica se già presente
        const exists = documenti.some(d => d.num_serie === nuovoCF.num_serie && d.type === "Codice Fiscale");
        if (exists) {
            console.log("ℹ️ Codice Fiscale già registrato per questo utente.");
            return;
        }

        documenti.push(nuovoCF);

        await userRef.update({ documenti });
        console.log("✅ Codice Fiscale inserito correttamente.");

    } catch (error) {
        console.error("❌ Errore durante l'inserimento:", error);
    }
}

importaCodiceFiscale().then(() => process.exit(0));
