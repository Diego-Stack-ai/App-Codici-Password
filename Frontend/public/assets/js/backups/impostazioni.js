import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const avatarEl = document.getElementById('user-avatar-settings');
const nameEl = document.getElementById('user-name-settings');
const emailEl = document.getElementById('user-email-settings');
const logoutBtn = document.getElementById('logout-btn-settings');

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is signed in, fetch details
            try {
                const docRef = doc(db, "users", user.uid);
                const docSnap = await getDoc(docRef);

                let userData = {};
                if (docSnap.exists()) {
                    userData = docSnap.data();
                }

                // 1. Name Construction (Matching Home Page Logic)
                const displayName = (userData.nome || userData.cognome)
                    ? `${userData.nome || ''} ${userData.cognome || ''}`.trim()
                    : (user.displayName || "Utente");

                if (nameEl) nameEl.textContent = displayName;

                // 2. Email
                const email = user.email || "No Email";
                if (emailEl) emailEl.textContent = email;

                // 3. Avatar
                const photoURL = userData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";
                if (avatarEl) {
                    avatarEl.style.backgroundImage = `url('${photoURL}')`;
                }

            } catch (error) {
                console.error("Error fetching user data:", error);
                if (nameEl) nameEl.textContent = "Errore caricamento";
            }
        } else {
            // No user is signed in. Redirect to login.
            window.location.href = 'index.html';
        }
    });

    // Logout Handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'index.html';
            } catch (error) {
                console.error("Error signing out:", error);
                alert("Impossibile disconnettersi. Riprova.");
            }
        });
    }


});
