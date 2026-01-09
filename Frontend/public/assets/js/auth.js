// Simulated Authentication and User Session Management

import { getUsers, saveUsers } from './db.js';
import { showNotification } from './utils.js'; // Assuming a showNotification function exists
import { showNotification } from './utils.js';

const BASE_PATH = '/Frontend/public/';

/**
 * Registers a new user.
 * @param {string} nome - User's first name.
 * @param {string} cognome - User's last name.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 */
async function register(nome, cognome, email, password) {
    const users = getUsers();
    const userExists = users.some(user => user.email === email);

    if (userExists) {
        showNotification("User with this email already exists.", "error");
        return;
    }

    // Generate a simulated 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser = {
        id: Date.now().toString(),
        nome,
        cognome,
        email,
        password, // In a real app, this should be hashed
        verified: false,
        verificationCode,
    };

    users.push(newUser);
    saveUsers(users);

    // Store email temporarily to pass to the verification page
    sessionStorage.setItem('emailForVerification', email);

    console.log(`Simulated verification code for ${email}: ${verificationCode}`);
    showNotification("Registration successful! Redirecting to email verification.", "success");

    // Redirect to the email verification page
    setTimeout(() => {
        window.location.href = "verifica_email.html";
        window.location.href = `${BASE_PATH}verifica_email.html`;
    }, 2000);
}

/**
 * Verifies a user's email with a simulated code.
 * @param {string} email - The user's email.
 * @param {string} code - The 6-digit verification code.
 */
async function verifyEmail(email, code) {
    const users = getUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        showNotification("User not found.", "error");
        return;
    }

    if (user.verificationCode === code) {
        user.verified = true;
        saveUsers(users);
        showNotification("Email verified successfully! Logging you in.", "success");

        // Log the user in by creating a session
        sessionStorage.setItem('loggedInUser', JSON.stringify({ email: user.email, nome: user.nome }));

        setTimeout(() => {
            window.location.href = "home_page.html";
            window.location.href = `${BASE_PATH}home_page.html`;
        }, 2000);
    } else {
        showNotification("Invalid verification code.", "error");
    }
}


/**
 * Logs a user in.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 */
async function login(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        showNotification("Invalid credentials.", "error");
        return;
    }

    if (!user.verified) {
        showNotification("Please verify your email before logging in.", "error");
        sessionStorage.setItem('emailForVerification', email); // Help user re-verify
        setTimeout(() => { window.location.href = "verifica_email.html"; }, 1500);
        setTimeout(() => { window.location.href = `${BASE_PATH}verifica_email.html`; }, 1500);
        return;
    }

    if (user.password === password) {
        // Create a "session"
        sessionStorage.setItem('loggedInUser', JSON.stringify({ email: user.email, nome: user.nome }));
        showNotification("Login successful!", "success");

        setTimeout(() => {
            window.location.href = "home_page.html";
            window.location.href = `${BASE_PATH}home_page.html`;
        }, 1500);
    } else {
        showNotification("Invalid credentials.", "error");
    }
}

/**
 * Logs the current user out.
 */
function logout() {
    sessionStorage.removeItem('loggedInUser');
    window.location.href = "index.html";
    window.location.href = `${BASE_PATH}index.html`;
}


/**
 * Initiates the password reset process.
 * @param {string} email - The user's email.
 */
async function resetPassword(email) {
    const users = getUsers();
    const userExists = users.some(user => user.email === email);

    if (userExists) {
        // In a real app, a token would be generated and emailed.
        // Here, we'll just store the email to be reset.
        sessionStorage.setItem('emailForPasswordReset', email);
        showNotification("If a user with this email exists, a reset link has been sent.", "success");
        setTimeout(() => {
            window.location.href = `imposta_nuova_password.html`; // No token needed for simulation
            window.location.href = `${BASE_PATH}imposta_nuova_password.html`; // No token needed for simulation
        }, 2000);
    } else {
        // Show a generic message to prevent user enumeration
        showNotification("If a user with this email exists, a reset link has been sent.", "success");
    }
}

/**
 * Updates the user's password.
 * @param {string} email - The user's email.
 * @param {string} newPassword - The new password.
 */
async function updatePassword(email, newPassword) {
    const users = getUsers();
    const user = users.find(u => u.email === email);

    if (user) {
        user.password = newPassword;
        saveUsers(users);
        sessionStorage.removeItem('emailForPasswordReset');
        showNotification("Password updated successfully. Please log in.", "success");
        setTimeout(() => {
            window.location.href = "index.html";
            window.location.href = `${BASE_PATH}index.html`;
        }, 2000);
    } else {
        showNotification("Could not update password. User not found.", "error");
    }
}


/**
 * Checks the user's authentication state and redirects if necessary.
 */
function checkAuthState() {
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const currentPage = window.location.pathname.split('/').pop();
    const authPages = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html', 'verifica_email.html', ''];

    if (loggedInUser && authPages.includes(currentPage)) {
        // User is logged in but on an auth page, redirect to home
        window.location.href = 'home_page.html';
    } else if (!loggedInUser && !authPages.includes(currentPage)) {
        // User is not logged in and on a protected page, redirect to login
        window.location.href = 'index.html';
    }
}


}


/**
 * Checks the user's authentication state and redirects if necessary.
 */
function checkAuthState() {
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const currentPage = window.location.pathname.split('/').pop();
    const authPages = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html', 'verifica_email.html', ''];

    if (loggedInUser && authPages.includes(currentPage)) {
        // User is logged in but on an auth page, redirect to home
        window.location.href = `${BASE_PATH}home_page.html`;
    } else if (!loggedInUser && !authPages.includes(currentPage)) {
        // User is not logged in and on a protected page, redirect to login
        window.location.href = `${BASE_PATH}index.html`;
    }
}


export {
    register,
    verifyEmail,
    login,
    logout,
    resetPassword,
    updatePassword,
    checkAuthState
};
