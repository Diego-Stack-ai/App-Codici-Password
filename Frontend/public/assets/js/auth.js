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
import { showNotification } from './utils.js';

/**
 * Registers a new user using Firebase Auth.
 * @param {string} nome - User's first name.
 * @param {string} cognome - User's last name.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 */
async function register(nome, cognome, email, password) {
    try {
        // Client-side Password Validation
        if (password.length < 6) {
            throw { code: 'auth/weak-password', message: 'La password deve avere almeno 6 caratteri.' };
        }
        const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
        if (!specialCharRegex.test(password)) {
            throw { code: 'auth/weak-password-special', message: 'La password deve contenere almeno un carattere speciale (!@#$%...).' };
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
        console.log('Verification email sent to', user.email);
        showNotification("Email di verifica inviata! Controlla la tua casella.", "success");

        showNotification("Registrazione avvenuta con successo!", "success");

        // Removed automatic redirect to allow user to see verification modal.
        // You can navigate manually after verification.

        return true;

    } catch (error) {
        console.error("Registration error:", error);
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
        showNotification(message, "error");
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
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // CHECK IF USER EXISTS IN FIRESTORE
        // If "Zombie" (Auth exists, DB missing), we Auto-Resurrect the profile.
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

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

            showNotification("Profilo ripristinato! Benvenuto.", "success");
        } else {
            showNotification("Login effettuato con successo!", "success");
        }

        setTimeout(() => {
            window.location.href = "home_page.html";
        }, 1000);
    } catch (error) {
        console.error("Login error:", error);
        let message = "Credenziali non valide.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            message = "Email o password errati.";
        } else if (error.code === 'auth/too-many-requests') {
            message = "Troppi tentativi falliti. Riprova più tardi.";
        } else if (error.code === 'custom/user-deleted') {
            message = error.message;
        }
        showNotification(message, "error");
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
        console.error("Logout error:", error);
        showNotification("Errore durante il logout.", "error");
    }
}

/**
 * Initiates the password reset process.
 * @param {string} email - The user's email.
 */
async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showNotification("Email di reset inviata! Controlla la tua casella di posta.", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 3000);
    } catch (error) {
        console.error("Reset password error:", error);
        showNotification("Errore nell'invio dell'email di reset.", "error");
    }
}

/**
 * Checks the user's authentication state and redirects if necessary.
 */
function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        const currentPage = window.location.pathname.split('/').pop();
        const authPages = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'];

        // Normalize empty path to index.html
        const isAuthPage = authPages.includes(currentPage) || currentPage === '';

        if (user) {
            // User is signed in.

            // GLOBAL SAFETY CHECK: Verify Firestore Profile Exists
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (!userDoc.exists()) {
                    console.warn("Global Auth Check: User authenticated but no Firestore profile. Auto-recovering...");
                    // Auto-Recover Profile instead of kicking out
                    await setDoc(userDocRef, {
                        email: user.email,
                        nome: "Utente",
                        cognome: "Ripristinato",
                        createdAt: new Date(),
                        photoURL: user.photoURL || "",
                        recreatedAfterDeletion: true
                    });
                    // Allow to proceed
                }
            } catch (e) {
                console.error("Error verifying user profile:", e);
                // Optional: Handle connectivity errors gracefully instead of blocking
            }

            if (isAuthPage) {
                // If on registration page, wait for user to verify email or navigate manually
                if (currentPage.includes('registrati') && !user.emailVerified) {
                    return;
                }
                window.location.href = 'home_page.html';
            }
        } else {
            // No user is signed in.
            if (!isAuthPage) {
                window.location.href = 'index.html';
            }
        }
    });
}

// Resend verification email
async function resendVerificationEmail() {
    const user = auth.currentUser;
    if (!user) {
        showNotification('Devi effettuare il login prima di reinviare la verifica.', 'error');
        return;
    }
    try {
        await sendEmailVerification(user);
        showNotification('Email di verifica reinviata!', 'success');
    } catch (error) {
        console.error('Resend verification error:', error);
        showNotification('Errore nel reinvio della email di verifica.', 'error');
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
