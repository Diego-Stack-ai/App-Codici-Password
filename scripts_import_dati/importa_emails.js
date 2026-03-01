const admin = require("firebase-admin");
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const path = require("path");

// 1. CHIAVE DI SERVIZIO
// Qui dovremo inserire il percorso del file JSON scaricato da Firebase
const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ ERRORE CRITICO: File 'serviceAccountKey.json' non trovato!");
    console.log("👉 Devi scaricare la chiave da Firebase Console: Impostazioni Progetto -> Account di servizio -> Genera nuova chiave privata.");
    console.log("Salvala in questa cartella (scripts_import_dati) nominandola 'serviceAccountKey.json'.");
    process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

// 2. INIZIALIZZAZIONE FIREBASE ADMIN
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 3. ID DEL TUO UTENTE BERSAGLIO
// Sostituisci questo con il tuo vero UID che trovi in Authentication
const TARGET_UID = "brP8B2YxaESJTf9nydYzckQUnVf1";

async function importaEmails() {
    console.log(`\n🚀 Inizio importazione per Utente: ${TARGET_UID}`);

    const csvPath = path.join(__dirname, "dati_import", "emails.csv");

    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV non trovato: ${csvPath}`);
        return;
    }

    try {
        const fileContent = fs.readFileSync(csvPath, "utf-8");
        // Parsiamo il CSV (ci aspetta la prima riga coi nomi delle colonne)
        const righe = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            delimiter: [',', ';', '\t'] // Supportiamo vari separatori
        });

        console.log(`📥 Lette ${righe.length} email dal CSV. Preparazione dati...`);

        // Estraiamo il documento utente attuale per non sovrascrivere o perdere dati vecchi
        const userRef = db.collection("users").doc(TARGET_UID);
        const docSnap = await userRef.get();

        if (!docSnap.exists) {
            console.error("❌ Utente non trovato nel database per UID indicato.");
            return;
        }

        const userData = docSnap.data();
        const vecchieEmail = userData.contactEmails || [];

        // Mappiamo le nuove righe
        const nuoveEmail = righe.map(r => ({
            label: r.Etichetta || "Email",
            address: r.IndirizzoEmail || "",
            password: r.Password || "",
            // Aggiungiamo note solo se esistono
            ...(r.Note ? { note: r.Note } : {})
        })).filter(e => e.address !== ""); // Ignoriamo righe con email vuote

        // Fondiamo vecchie e nuove
        const updatedEmails = [...vecchieEmail, ...nuoveEmail];

        console.log(`⏳ Salvataggio nel database (${updatedEmails.length} email totali)...`);

        // UPDATE PULITO ED ISOLATO SU FIRESTORE
        await userRef.update({
            contactEmails: updatedEmails
        });

        console.log("✅ Fatto! Dati fusi ed importati in completa sicurezza.");

    } catch (error) {
        console.error("❌ Errore durante l'importazione:", error);
    }
}

// Esegui
importaEmails().then(() => process.exit(0));
