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
    runTransaction,
    arrayUnion,
    arrayRemove,
    collectionGroup
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { sanitizeEmail } from './utils.js';

/**
 * Recupera le scadenze per un determinato utente.
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

async function getScadenza(userId, scadenzaId) {
    const docRef = doc(db, "users", userId, "scadenze", scadenzaId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { ...docSnap.data(), id: docSnap.id };
    } else {
        return null;
    }
}

async function addScadenza(userId, scadenza) {
    if (!userId) throw new Error("User ID mancante");
    const docRef = await addDoc(collection(db, "users", userId, "scadenze"), scadenza);
    return docRef.id;
}

async function updateScadenza(userId, scadenzaId, updates) {
    const scadenzaRef = doc(db, "users", userId, "scadenze", scadenzaId);
    await updateDoc(scadenzaRef, updates);
}

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

async function sendInvitation(data) {
    const inviteData = {
        ...data,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, "invites"), inviteData);
    return docRef.id;
}

async function getPendingInvitations(email) {
    const q = query(collection(db, "invites"),
        where("recipientEmail", "==", email),
        where("status", "==", "pending")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
}

/**
 * Accetta o rifiuta un invito (V5.1 Master - Atomic).
 * Notifiche rimosse (Reset Notifiche).
 */
async function respondToInvitation(inviteId, accept, guestUid, guestEmail) {
    const inviteRef = doc(db, "invites", inviteId);

    await runTransaction(db, async (transaction) => {
        const invSnap = await transaction.get(inviteRef);
        if (!invSnap.exists()) throw new Error("Invito non trovato");

        const invite = invSnap.data();
        if (invite.status !== 'pending') throw new Error("Invito già elaborato");

        const status = accept ? 'accepted' : 'rejected';
        const sKey = sanitizeEmail(guestEmail || invite.recipientEmail);

        let accPath = invite.aziendaId
            ? `users/${invite.ownerId}/aziende/${invite.aziendaId}/accounts/${invite.accountId}`
            : `users/${invite.ownerId}/accounts/${invite.accountId}`;
        const accountRef = doc(db, accPath);
        const accSnap = await transaction.get(accountRef);

        if (accSnap.exists()) {
            let accData = accSnap.data();
            let sharedWith = accData.sharedWith || {};

            if (sharedWith[sKey]) {
                sharedWith[sKey].status = status;
                if (accept) sharedWith[sKey].uid = guestUid;
            }

            const newCount = Object.values(sharedWith).filter(g => g.status === 'accepted').length;
            const hasActive = Object.values(sharedWith).some(g => g.status === 'pending' || g.status === 'accepted');
            const newVisibility = hasActive ? "shared" : "private";

            let newType = accData.type;
            if (newVisibility === 'private' && accData.type === 'memo' && accData.isExplicitMemo !== true) {
                newType = 'account';
            }

            transaction.update(accountRef, {
                sharedWith: sharedWith,
                acceptedCount: newCount,
                visibility: newVisibility,
                type: newType,
                updatedAt: new Date().toISOString()
            });
        }

        transaction.update(inviteRef, {
            status: status,
            guestUid: accept ? guestUid : null,
            respondedAt: new Date().toISOString()
        });
    });
}

/**
 * Revoca l'accesso a un account (V5.1 Master - Atomic).
 * Notifiche rimosse.
 */
async function revokeAccess(ownerId, accountId, guestEmail, aziendaId = null) {
    const sKey = sanitizeEmail(guestEmail);
    const inviteId = `${accountId}_${sKey}`;
    const invRef = doc(db, "invites", inviteId);

    await runTransaction(db, async (transaction) => {
        let accPath = `users/${ownerId}/accounts/${accountId}`;
        if (aziendaId) {
            accPath = `users/${ownerId}/aziende/${aziendaId}/accounts/${accountId}`;
        }
        const accountRef = doc(db, accPath);
        const accSnap = await transaction.get(accountRef);

        if (!accSnap.exists()) return;

        let data = accSnap.data();
        let sharedWith = data.sharedWith || {};

        delete sharedWith[sKey];

        const newCount = Object.values(sharedWith).filter(g => g.status === 'accepted').length;
        const hasActive = Object.values(sharedWith).some(g => g.status === 'pending' || g.status === 'accepted');
        const newVisibility = hasActive ? "shared" : "private";

        transaction.update(accountRef, {
            sharedWith: sharedWith,
            acceptedCount: newCount,
            visibility: newVisibility,
            updatedAt: new Date().toISOString()
        });

        transaction.delete(invRef);
    });
}

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
