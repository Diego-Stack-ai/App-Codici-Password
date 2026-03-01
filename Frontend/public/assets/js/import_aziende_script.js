import { auth, db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { encrypt, ensureMasterKey } from './modules/core/security-manager.js';

export async function runMassiveImport() {
    console.log("[IMPORT] Avvio caricamento 5 aziende...");

    const user = auth.currentUser;
    if (!user) {
        alert("Devi essere loggato per importare i dati.");
        return;
    }

    let masterKey;
    try {
        masterKey = await ensureMasterKey();
    } catch (e) {
        alert("Vault bloccata. Inserisci la Master Key prima di procedere per la crittografia dei dati sensibili.");
        return;
    }

    const aziendeData = [
        {
            ragioneSociale: "BM Service srl",
            referenteTitolo: "Amministratore",
            referenteNome: "Diego",
            referenteCognome: "Boschetto",
            referenteCellulare: "3491825905",
            indirizzoSede: "Piazzale delle Medaglie D'Oro",
            civicoSede: "7",
            cittaSede: "Roma",
            provinciaSede: "RM",
            capSede: "00136",
            partitaIva: "04075800245",
            codiceSDI: "M5UXCR1",
            numeroCCIAA: "RM - 1557282",
            dataIscrizione: "2018-10-08",
            telefonoAzienda: "0497385098",
            note: ""
        },
        {
            ragioneSociale: "D'Alessio Food",
            referenteTitolo: "Amministratore",
            referenteNome: "Diego",
            referenteCognome: "Boschetto",
            cittaSede: "Padova",
            note: ""
        },
        {
            ragioneSociale: "EGF LOGISTICA SRL",
            referenteTitolo: "Amministratore",
            referenteNome: "Alessandro",
            referenteCognome: "Sarti",
            cittaSede: "Limena",
            provinciaSede: "PD",
            capSede: "35010",
            partitaIva: "04987910280",
            numeroCCIAA: "PD - 434248",
            note: ""
        },
        {
            ragioneSociale: "Venti18 srl",
            referenteTitolo: "Amministratore",
            referenteNome: "Diego",
            referenteCognome: "Boschetto",
            referenteCellulare: "3491825905",
            indirizzoSede: "Piazzale delle Medaglie D'Oro",
            civicoSede: "7",
            cittaSede: "Roma",
            provinciaSede: "RM",
            capSede: "00136",
            partitaIva: "14941141005",
            codiceSDI: "J6URRTW",
            numeroCCIAA: "RM - 1556783",
            dataIscrizione: "2028-10-02",
            telefonoAzienda: "0492145618",
            faxAzienda: "0492145618",
            note: `BANCA BPER IBAN IT97H0312703200000000006121

BANCOMAT DEBIT BPER
01577857
29954
————————————-
CARTA CREDITO BUSINESS 

https://areariservata.divisioneconsumer.it/#/
questi i codici per accedere
 Id: 22413154
PWD: Bosco20776

CREDIT BPER
5529630193197246
01/24
421
PIN 4340
————————————

BPM
CODICE POSTAZIONE 
P6286145 
IDENTIFICATIVO UTENTE 
WNXLS
PASSWORD Bosco14459
IBAN 
Chiavetta piccola verde
IT90H0503460120000000007869`
        },
        {
            ragioneSociale: "Pax Tibi srl",
            referenteTitolo: "Amministratore",
            referenteNome: "Diego",
            referenteCognome: "Boschetto",
            referenteCellulare: "3491825905",
            indirizzoSede: "Piazzale delle Medaglie D'Oro",
            civicoSede: "7",
            cittaSede: "Roma",
            provinciaSede: "RM",
            capSede: "00136",
            partitaIva: "15344451008",
            codiceSDI: "M5UXCR1",
            numeroCCIAA: "RM - 1584514",
            dataIscrizione: "2019-07-10",
            telefonoAzienda: "0492145618",
            faxAzienda: "0492145618",
            note: ""
        }
    ];

    const colRef = collection(db, "users", user.uid, "aziende");

    for (const azienda of aziendeData) {
        try {
            console.log(`[IMPORT] Caricamento ${azienda.ragioneSociale}...`);

            // Cifratura delle note (campo sensibile)
            const encryptedNote = await encrypt(azienda.note || "", masterKey);

            const docData = {
                ...azienda,
                tipoSedeLegale: "Sede Legale",
                formaGiuridica: "",
                note: encryptedNote,
                emails: { pec: null, amministrazione: null, personale: null, extra: [] },
                qrConfig: { ragioneSociale: true, partitaIva: true, codiceSDI: true },
                altreSedi: [],
                allegati: [],
                colorIndex: Math.floor(Math.random() * 10),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                _encrypted: true
            };

            await addDoc(colRef, docData);
            console.log(`[IMPORT] ${azienda.ragioneSociale} OK.`);
        } catch (err) {
            console.error(`[IMPORT] Errore su ${azienda.ragioneSociale}:`, err);
        }
    }

    alert("Importazione delle 5 aziende completata con successo!");
    window.location.href = 'lista_aziende.html';
}
