import { auth, db } from './firebase-config.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showToast } from './ui-core.js';
import { logError } from './utils.js';

/**
 * Centrialized Auth Observer
 * @param {Function} callback - Function to run when auth state changes
 */
export function observeAuth(callback) {
    onAuthStateChanged(auth, (user) => {
        const path = window.location.pathname.toLowerCase();
        const authPages = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'];
        const isAuthPage = authPages.some(p => path.includes(p)) || path === '/' || path.endsWith('/');

        if (!user) {
            // Se non siamo in una pagina di auth, reindirizza al login
            if (!isAuthPage) {
                window.location.href = 'index.html';
                return;
            }
        }
        if (callback) callback(user);
    });
}

/**
 * Registers a new user using Firebase Auth.
 * @param {string} nome - User's first name.
 * @param {string} cognome - User's last name.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 */
async function register(nome, cognome, email, password) {
    try {
        // Client-side Password Validation (Protocollo 12-3-3)
        if (password.length < 12) {
            throw { code: 'auth/weak-password', message: 'La password deve avere almeno 12 caratteri.' };
        }
        const upperCount = (password.match(/[A-Z]/g) || []).length;
        if (upperCount < 3) {
            throw { code: 'auth/weak-password-upper', message: 'Servono almeno 3 lettere MAIUSCOLE.' };
        }
        const symbolCount = (password.match(/[!@#$%^&*(),.?":{}|<>]/g) || []).length;
        if (symbolCount < 3) {
            throw { code: 'auth/weak-password-symbols', message: 'Servono almeno 3 caratteri speciali (!@#...).' };
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update profile with name
        await updateProfile(user, {
            displayName: `${nome} ${cognome}`.trim()
        });

        // CREATE FIRESTORE DOCUMENT (Fix for "Account Not Found" issue)
        await setDoc(doc(db, "users", user.uid), {
            nome: nome,
            cognome: cognome,
            email: email,
            createdAt: new Date(),
            photoURL: "",
            settings: { theme: 'system' }
        });

        // Send email verification (optional but recommended)
        await sendEmailVerification(user);
        window.LOG('Verification email sent to', user.email);
        showToast("Email di verifica inviata! Controlla la tua casella.", "success");

        showToast("Registrazione avvenuta con successo!", "success");

        // Removed automatic redirect to allow user to see verification modal.
        // You can navigate manually after verification.

        return true;

    } catch (error) {
        logError("Auth Registration", error);
        let message = `Errore registrazione: ${error.code || error.message}`;
        if (error.code === 'auth/email-already-in-use') {
            message = "Questa email è già registrata.";
        } else if (error.code === 'auth/weak-password') {
            message = "La password è troppo debole (min. 6 caratteri).";
        } else if (error.code === 'auth/weak-password-special') {
            message = error.message;
        } else if (error.code === 'auth/network-request-failed') {
            message = "Problema di connessione. Riprova.";
        }
        showToast(message, "error");
        alert(message); // Fallback alert ensures visibility if notification fails
        return false;
    }
}

/**
 * Logs a user in.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 */
async function login(email, password) {
    try {
        window.LOG("LOGIN START: ", email);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        window.LOG("AUTH SUCCESS: ", user.uid);

        // FORZA REFRESH: Controlla lo stato reale su Firebase (evita cache vecchia)
        await user.reload();
        const updatedUser = auth.currentUser;

        // CHECK IF USER EXISTS IN FIRESTORE
        const userDocRef = doc(db, "users", updatedUser.uid);
        window.LOG("FETCHING DOC...");
        const userDoc = await getDoc(userDocRef);
        window.LOG("DOC FETCHED: ", userDoc.exists());

        if (!updatedUser.emailVerified) {
            console.warn("Email non ancora verificata, ma procedo come da richiesta utente.");
            showToast("Nota: Email non verificata, ma accesso consentito.", "warning");
        }

        if (!userDoc.exists()) {
            console.warn("User authenticated but no Firestore profile. Auto-recovering profile...");

            // Create a basic skeleton profile to allow access
            await setDoc(userDocRef, {
                email: email,
                nome: "Utente",
                cognome: "Ripristinato",
                createdAt: new Date(),
                photoURL: user.photoURL || "",
                recreatedAfterDeletion: true
            });

            showToast("Profilo ripristinato! Benvenuto.", "success");
        } else {
            showToast("Login effettuato con successo!", "success");
        }

        // NOTA: Il redirect viene ora gestito dall'osservatore centrale onAuthStateChanged
        // per evitare doppie navigazioni o conflitti.
    } catch (error) {
        logError("Auth Login", error);
        let message = "Credenziali non valide.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = "Email o password errati.";
        } else if (error.code === 'auth/invalid-email') {
            message = "Formato email non valido.";
        } else if (error.code === 'auth/email-not-verified') {
            message = error.message;
        } else if (error.code === 'auth/too-many-requests') {
            message = "Troppi tentativi falliti. Riprova più tardi.";
        } else if (error.code === 'custom/user-deleted') {
            message = error.message;
        }
        showToast(message, "error");
        // Rilanciamo l'errore per permettere al chiamante (login.js) di fermare lo spinner
        throw error;
    }
}

/**
 * Logs the current user out.
 */
async function logout() {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (error) {
        logError("Auth Logout", error);
        showToast("Errore durante il logout.", "error");
    }
}

/**
 * Initiates the password reset process.
 * @param {string} email - The user's email.
 */
async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Email di reset inviata! Controlla la tua casella di posta.", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 3000);
    } catch (error) {
        logError("Auth ResetPassword", error);
        showToast("Errore nell'invio dell'email di reset.", "error");
    }
}

/**
 * Checks the user's authentication state and redirects if necessary.
 */
function checkAuthState() {
    let initialCheckDone = false;
    onAuthStateChanged(auth, async (user) => {
        const path = window.location.pathname.toLowerCase();
        const authPages = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'];
        const isAuthPage = authPages.some(p => path.includes(p)) || path === '/' || path.endsWith('/');

        window.LOG(`[AUTH CHECK] User: ${user ? user.uid : 'Guest'}, Path: ${path}, isAuthPage: ${isAuthPage}`);

        if (user) {
            // Utente loggato: se tenta di accedere al login, lo mandiamo alla home
            if (isAuthPage) {
                window.LOG("[AUTH] Already logged in, redirecting to home...");
                window.location.href = 'home_page.html';
            }
        } else {
            // Utente non loggato: se tenta di accedere a una pagina protetta, lo mandiamo al login
            if (!isAuthPage) {
                window.LOG("[AUTH] No session, redirecting to login...");
                window.location.href = 'index.html';
            }
        }
    });
}

// Resend verification email
async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) {
        showToast('Devi effettuare il login prima di reinviare la verifica.', 'error');
        return;
    }
    try {
        await sendEmailVerification(user);
        showToast('Email di verifica reinviata!', 'success');
    } catch (error) {
        logError("Auth ResendVerification", error);
        showToast('Errore nel reinvio della email di verifica.', 'error');
    }
}

export {
    resendVerificationEmail,
    register,
    login,
    logout,
    resetPassword,
    checkAuthState
};
