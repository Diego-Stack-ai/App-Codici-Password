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

async function importaCIE() {
    console.log(`\n🚀 Inserimento Carta Identità per Utente: ${TARGET_UID}`);

    try {
        const userRef = db.collection("users").doc(TARGET_UID);
        const docSnap = await userRef.get();

        if (!docSnap.exists) {
            console.error("❌ Utente non trovato nel database.");
            return;
        }

        const userData = docSnap.data();
        const documenti = userData.documenti || [];

        const nuovaCIE = {
            type: "Carta Identità",
            num_serie: "CA55677EP",
            rilasciato_da: "Comune di Chiampo",
            data_rilascio: "2019-07-19",
            expiry_date: "2030-02-28",
            username: "BSCDGI66B28A459W",
            password: "Nsha#8wkPR",
            pin: "45297733",
            puk: "33710329",
            codice_app: "h13G57",
            note: "Ho registrato la CIE in data 22/09/2025 e scaricato app Impresa Italia ed ho messo codice app 431231"
        };

        // Verifica se già presente
        const exists = documenti.some(d => d.num_serie === nuovaCIE.num_serie && d.type === "Carta Identità");
        if (exists) {
            console.log("ℹ️ Carta Identità già registrata per questo utente.");
            return;
        }

        documenti.push(nuovaCIE);

        await userRef.update({ documenti });
        console.log("✅ Carta Identità inserita correttamente.");

    } catch (error) {
        console.error("❌ Errore durante l'inserimento:", error);
    }
}

importaCIE().then(() => process.exit(0));
