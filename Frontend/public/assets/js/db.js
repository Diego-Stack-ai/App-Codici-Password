import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    arrayUnion,
    arrayRemove,
    collectionGroup
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

/**
 * Recupera le scadenze per un determinato utente.
 * @param {string} userId - L'ID dell'utente (email o UID).
 * @returns {Promise<Array>} Una promise che risolve in un array di oggetti scadenza.
 */
async function getScadenze(userId) {
    if (!userId) return [];
    const q = query(collection(db, "users", userId, "scadenze"), orderBy("dueDate", "asc"));
    const querySnapshot = await getDocs(q);
    const scadenze = [];
    querySnapshot.forEach((doc) => {
        scadenze.push({ ...doc.data(), id: doc.id });
    });
    return scadenze;
}

/**
 * Recupera una singola scadenza.
 * @param {string} userId 
 * @param {string} scadenzaId 
 */
async function getScadenza(userId, scadenzaId) {
    const docRef = doc(db, "users", userId, "scadenze", scadenzaId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id };
    } else {
        return null;
    }
}

/**
 * Aggiunge una nuova scadenza.
 * @param {string} userId - L'ID dell'utente.
 * @param {Object} scadenza - L'oggetto scadenza da aggiungere.
 * @returns {Promise<string>} L'ID del nuovo documento creato.
 */
async function addScadenza(userId, scadenza) {
    if (!userId) throw new Error("User ID mancante");
    const docRef = await addDoc(collection(db, "users", userId, "scadenze"), scadenza);
    return docRef.id;
}

/**
 * Aggiorna una scadenza esistente.
 * @param {string} userId - L'ID dell'utente.
 * @param {string} scadenzaId - L'ID della scadenza.
 * @param {Object} updates - I campi da aggiornare.
 */
async function updateScadenza(userId, scadenzaId, updates) {
    const scadenzaRef = doc(db, "users", userId, "scadenze", scadenzaId);
    await updateDoc(scadenzaRef, updates);
}

/**
 * Elimina una scadenza.
 * @param {string} userId - L'ID dell'utente.
 * @param {string} scadenzaId - L'ID della scadenza.
 */
async function deleteScadenza(userId, scadenzaId) {
    const scadenzaRef = doc(db, "users", userId, "scadenze", scadenzaId);
    await deleteDoc(scadenzaRef);
}

// Funzioni per gli Account (Privati/Aziendali)

async function getAccounts(userId, type = 'privato') {
    if (!userId) return [];
    const q = query(collection(db, "users", userId, "accounts"), where("type", "==", type));
    const SNAPSHOT = await getDocs(q);
    return SNAPSHOT.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

async function getAccount(userId, accountId) {
    const docRef = doc(db, "users", userId, "accounts", accountId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id };
    } else {
        return null;
    }
}

async function addAccount(userId, accountData) {
    if (!userId) throw new Error("User ID mancante");
    const docRef = await addDoc(collection(db, "users", userId, "accounts"), accountData);
    return docRef.id;
}

async function updateAccount(userId, accountId, updates) {
    const accountRef = doc(db, "users", userId, "accounts", accountId);
    await updateDoc(accountRef, updates);
}

async function deleteAccount(userId, accountId) {
    const accountRef = doc(db, "users", userId, "accounts", accountId);
    await deleteDoc(accountRef);
}

// --- SISTEMA DI CONDIVISIONE & INVITI ---

/**
 * Invia un invito di condivisione.
 */
async function sendInvitation(data) {
    const inviteData = {
        ...data,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, "invites"), inviteData);
    return docRef.id;
}

/**
 * Recupera gli inviti pendenti per un'email.
 */
async function getPendingInvitations(email) {
    const q = query(collection(db, "invites"),
        where("recipientEmail", "==", email),
        where("status", "==", "pending")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

/**
 * Accetta o rifiuta un invito.
 */
async function respondToInvitation(inviteId, accept, guestUid) {
    const inviteRef = doc(db, "invites", inviteId);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) throw new Error("Invito non trovato");
    const invite = inviteSnap.data();

    if (accept) {
        // 1. Aggiungi il guestUid all'array sharedWith dell'account
        const accountRef = doc(db, "users", invite.ownerId, "accounts", invite.accountId);
        await updateDoc(accountRef, {
            sharedWith: arrayUnion(guestUid)
        });

        // 2. Segna come accettato
        await updateDoc(inviteRef, { status: 'accepted', guestUid });
    } else {
        await updateDoc(inviteRef, { status: 'rejected' });
    }
}

/**
 * Revoca l'accesso a un account.
 */
async function revokeAccess(ownerId, accountId, guestUid) {
    const accountRef = doc(db, "users", ownerId, "accounts", accountId);
    await updateDoc(accountRef, {
        sharedWith: arrayRemove(guestUid)
    });

    // Rimuovi anche l'invito accettato per pulizia
    const q = query(collection(db, "invites"),
        where("accountId", "==", accountId),
        where("guestUid", "==", guestUid)
    );
    const snap = await getDocs(q);
    snap.forEach(async (d) => await deleteDoc(doc(db, "invites", d.id)));
}

/**
 * Recupera gli account condivisi CON l'utente attuale.
 */
async function getSharedAccounts(guestUid) {
    const q = query(collectionGroup(db, "accounts"), where("sharedWith", "array-contains", guestUid));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id, ownerId: doc.ref.parent.parent.id }));
}

// --- RUBRICA CONTATTI ---

async function getContacts(userId) {
    const q = query(collection(db, "users", userId, "contacts"));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

async function addContact(userId, contact) {
    const docRef = await addDoc(collection(db, "users", userId, "contacts"), contact);
    return docRef.id;
}

/**
 * Recupera dati base di un altro utente (Nome, Avatar) tramite email.
 */
async function getPublicUserDataByEmail(email) {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const data = snap.docs[0].data();
        return {
            uid: snap.docs[0].id,
            nome: data.nome || '',
            cognome: data.cognome || '',
            photoURL: data.photoURL || data.avatar || ''
        };
    }
    return null;
}

export {
    getScadenze,
    getScadenza,
    addScadenza,
    updateScadenza,
    deleteScadenza,
    getAccounts,
    getAccount,
    addAccount,
    updateAccount,
    deleteAccount,
    sendInvitation,
    getPendingInvitations,
    respondToInvitation,
    revokeAccess,
    getSharedAccounts,
    getContacts,
    addContact,
    getPublicUserDataByEmail
};
