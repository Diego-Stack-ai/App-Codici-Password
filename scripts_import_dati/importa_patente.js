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

async function importaPatente() {
    console.log(`\n🚀 Inserimento Patente per Utente: ${TARGET_UID}`);

    try {
        const userRef = db.collection("users").doc(TARGET_UID);
        const docSnap = await userRef.get();

        if (!docSnap.exists) {
            console.error("❌ Utente non trovato nel database.");
            return;
        }

        const userData = docSnap.data();
        const documenti = userData.documenti || [];

        const nuovaPatente = {
            type: "Patente",
            num_serie: "U136W4689N",
            rilasciato_da: "Ministero Infrastrutture Trasporti MIT",
            data_rilascio: "2024-03-01",
            expiry_date: "2029-02-28",
            license_number: "U136W4689N"
        };

        // Verifica se già presente per evitare duplicati
        const exists = documenti.some(d => d.num_serie === nuovaPatente.num_serie && d.type === "Patente");
        if (exists) {
            console.log("ℹ️ Patente già registrata per questo utente.");
            return;
        }

        documenti.push(nuovaPatente);

        await userRef.update({ documenti });
        console.log("✅ Patente inserita correttamente nell'anagrafica utente.");

    } catch (error) {
        console.error("❌ Errore durante l'inserimento:", error);
    }
}

importaPatente().then(() => process.exit(0));
