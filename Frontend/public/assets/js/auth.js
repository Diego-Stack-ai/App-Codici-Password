import { getDocSmart as getDoc } from "/assets/js/offline-firestore.js";
import { auth, db } from './firebase-config.js?v=1.2.37';
import { LOG } from './logger.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail, sendEmailVerification, setPersistence, browserLocalPersistence, browserSessionPersistence, getMultiFactorResolver, TotpMultiFactorGenerator } from "/assets/js/vendor/firebase-runtime.js";
import { doc, setDoc } from "/assets/js/vendor/firebase-runtime.js";
import { showToast } from './ui-core-v129.js?v=1.2.37';
import { logError } from './utils.js';
import { ACCOUNT_PASSWORD_POLICY_VERSION, evaluatePassword, firstPasswordPolicyError } from './modules/core/password-policy.js';

let pendingMfaResolver = null;
const RESET_POLICY_MARKER = 'codex_password_reset_policy_v1';

async function consumePasswordResetPolicyMarker(user) {
    let marker = null;
    try {
        marker = JSON.parse(localStorage.getItem(RESET_POLICY_MARKER) || 'null');
    } catch {
        localStorage.removeItem(RESET_POLICY_MARKER);
        return;
    }
    if (!marker) return;

    const sameEmail = marker.email === user.email?.trim().toLowerCase();
    const recent = Date.now() - Number(marker.completedAt) < 30 * 60 * 1000;
    if (!sameEmail || !recent || marker.version !== ACCOUNT_PASSWORD_POLICY_VERSION) {
        localStorage.removeItem(RESET_POLICY_MARKER);
        return;
    }

    await setDoc(doc(db, 'users', user.uid), {
        passwordPolicyVersion: ACCOUNT_PASSWORD_POLICY_VERSION
    }, { merge: true });
    localStorage.removeItem(RESET_POLICY_MARKER);
}

/**
 * Centrialized Auth Observer
 * @param {Function} callback - Function to run when auth state changes
 */
export function observeAuth(callback) {
    onAuthStateChanged(auth, (user) => {
        const path = window.location.pathname.toLowerCase();
        const authPages = ['login-v115.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'];
        const isAuthPage = authPages.some(p => path.includes(p)) || path === '/' || path.endsWith('/');

        if (!user) {
            // Se non siamo in una pagina di auth, reindirizza al login
            if (!isAuthPage) {
                window.location.href = 'login-v115.html';
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
        if (!evaluatePassword(password, 'account').valid) {
            throw { code: 'auth/weak-password', message: firstPasswordPolicyError(password, 'account') };
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
            settings: { theme: 'system' },
            passwordPolicyVersion: ACCOUNT_PASSWORD_POLICY_VERSION
        });

        // Send email verification (optional but recommended)
        await sendEmailVerification(user);
        LOG('Verification email sent');
        showToast("Email di verifica inviata! Controlla la tua casella.", "success");

        showToast("Registrazione avvenuta con successo!", "success");

        return true;

    } catch (error) {
        logError("Auth Registration", error);
        let message = `Errore registrazione: ${error.code || error.message}`;
        if (error.code === 'auth/email-already-in-use') {
            message = "Questa email è già registrata.";
        } else if (error.code === 'auth/weak-password') {
            message = error.message || "La password non rispetta i requisiti di sicurezza.";
        } else if (error.code === 'auth/network-request-failed') {
            message = "Problema di connessione. Riprova.";
        }
        showToast(message, "error");
        return false;
    }
}

/**
 * Logs a user in.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 */
async function finalizeLogin(user, email) {
    LOG("AUTH SUCCESS");

    await user.reload();
    const updatedUser = auth.currentUser;
    await consumePasswordResetPolicyMarker(updatedUser);
    const userDocRef = doc(db, "users", updatedUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (!updatedUser.emailVerified) {
        showToast("Verifica l'email prima di configurare la 2FA.", "warning");
    }

    if (!userDoc.exists()) {
        await setDoc(userDocRef, {
            email,
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

    pendingMfaResolver = null;
    return { user: updatedUser, mfaRequired: false };
}

async function login(email, password, rememberDevice = true) {
    try {
        LOG("LOGIN START");
        await setPersistence(auth, rememberDevice ? browserLocalPersistence : browserSessionPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return await finalizeLogin(userCredential.user, email);
    } catch (error) {
        if (error.code === 'auth/multi-factor-auth-required') {
            pendingMfaResolver = getMultiFactorResolver(auth, error);
            const hasTotp = pendingMfaResolver.hints.some(
                hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
            );
            if (!hasTotp) throw new Error("Secondo fattore configurato ma non supportato da questa app.");
            return { mfaRequired: true };
        }
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

async function completeTotpLogin(code, email) {
    if (!pendingMfaResolver) throw new Error("Sessione 2FA scaduta. Ripeti il login.");
    const hint = pendingMfaResolver.hints.find(
        item => item.factorId === TotpMultiFactorGenerator.FACTOR_ID
    );
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
    const credential = await pendingMfaResolver.resolveSignIn(assertion);
    return finalizeLogin(credential.user, email || credential.user.email);
}

/**
 * Logs the current user out.
 */
async function logout() {
    try {
        // Cleanup proattivo sessione

        await signOut(auth);
        window.location.href = "login-v115.html";
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
    await sendPasswordResetEmail(auth, email);
    return true;
}

/**
 * Checks the user's authentication state and redirects if necessary.
 */
function checkAuthState() {
    let initialCheckDone = false;
    onAuthStateChanged(auth, async (user) => {
        const path = window.location.pathname.toLowerCase();
        const reauthFlow = new URLSearchParams(window.location.search).get('reauth');
        const authPages = ['login-v115.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'];
        const isAuthPage = authPages.some(p => path.includes(p)) || path === '/' || path.endsWith('/');

        LOG(`[AUTH CHECK] State: ${user ? 'authenticated' : 'guest'}, Path: ${path}, isAuthPage: ${isAuthPage}`);

        if (user) {
            if (path.includes('login-v115.html') && reauthFlow === 'password-change') {
                LOG("[AUTH] Reauthentication completed, returning to password change");
                window.location.replace('imposta_nuova_password.html?reauthenticated=1');
                return;
            }
            if (path.includes('login-v115.html') && reauthFlow === 'security-settings') {
                LOG("[AUTH] Security reauthentication completed, returning to settings");
                window.location.replace('impostazioni.html');
                return;
            }
            // Utente loggato: se siamo su una pagina di login, spostiamoci sulla home
            // Usiamo percorsi relativi per compatibilità con Live Server
            if (isAuthPage) {
                if (!path.endsWith('/home_page.html')) {
                    LOG("[AUTH] Already logged in, redirecting to home_page.html");
                    window.location.href = 'home_page.html';
                }
            }
        } else {
            // Utente non loggato: se siamo su una pagina protetta, andiamo al login
            if (!isAuthPage) {
                // Evitiamo di ricaricare se siamo già sulla root o sul login versionato.
                if (!path.includes('login-v115.html') && path !== '/' && path !== '') {
                    LOG("[AUTH] No session, redirecting to /login-v115.html");
                    window.location.href = '/login-v115.html';
                }
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
    completeTotpLogin,
    logout,
    resetPassword,
    checkAuthState
};
