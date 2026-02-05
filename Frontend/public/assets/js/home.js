import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

/**
 * HOME PAGE MODULE (Nuova Versione - Protocollo.1)
 * Gestisce l'interfaccia della nuova Home Page statica.
 */

// Stato Globale
let currentUser = null;

// 1. AUTH LISTENER
document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Redirect se non loggato
            window.location.href = 'index.html';
            return;
        }

        currentUser = user;
        console.log("Utente autenticato:", user.email);

        // Renderizza Info Utente (Header)
        await renderHeaderUser(user);
    });

    // Logout Handler (Delegato se il bottone esiste staticamente)
    const logoutBtn = document.getElementById('header-logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if (confirm("Vuoi uscire?")) {
                await signOut(auth);
                window.location.href = 'index.html';
            }
        };
    }
});

/**
 * Gestisce il rendering dell'utente nell'Header
 * (Foto, Nome, Saluto)
 */
async function renderHeaderUser(user) {
    // Riferimenti DOM
    const uAvatar = document.getElementById('header-user-avatar');
    const uGreeting = document.getElementById('home-greeting-text');
    const uName = document.getElementById('home-user-name');

    // 1. Calcolo Saluto
    const h = new Date().getHours();
    let timeGreeting = "Benvenuto";
    if (h >= 5 && h < 13) timeGreeting = "Buongiorno";
    else if (h >= 13 && h < 18) timeGreeting = "Buon pomeriggio";
    else timeGreeting = "Buonasera";

    if (uGreeting) uGreeting.textContent = timeGreeting;

    // 2. Nome Utente (Fallback su Auth displayName o email)
    // Helper formattazione nome
    const toFriendlyName = (name) => {
        if (!name) return "";
        return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    let displayName = toFriendlyName(user.displayName || user.email.split('@')[0]);
    if (uName) uName.textContent = displayName; // Set preliminare

    // 3. Foto Utente (da Auth)
    if (user.photoURL && uAvatar) {
        setAvatarImage(uAvatar, user.photoURL);
    }

    // 4. Recupero Dati Completi da Firestore (per nome completo e foto aggiornata)
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Aggiorna Nome Completo
            const fullName = toFriendlyName(`${data.nome || ''} ${data.cognome || ''}`.trim());
            if (fullName) {
                uName.textContent = fullName;
            }

            // Aggiorna Foto (se presente in Firestore vince su Auth)
            const firestorePhoto = data.photoURL || data.avatar;
            if (firestorePhoto && uAvatar) {
                setAvatarImage(uAvatar, firestorePhoto);
            }
        }
    } catch (e) {
        console.warn("Errore recupero profilo Firestore:", e);
    }
}

// Helper per impostare l'immagine avatar
function setAvatarImage(element, url) {
    if (!url) return;
    element.style.backgroundImage = `url("${url}")`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.innerHTML = ''; // Rimuove l'icona di fallback
}
