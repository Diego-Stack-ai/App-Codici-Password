import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * Checks the user's authentication state and redirects them accordingly.
 * Public pages (like login, register) will redirect to the dashboard if the user is logged in.
 * Protected pages will redirect to the login page if the user is not logged in.
 * @param {function} [onUserLoggedIn] - Optional callback to execute if a user is logged in.
 * @param {function} [onUserLoggedOut] - Optional callback to execute if no user is logged in.
 */
function checkAuthState(onUserLoggedIn, onUserLoggedOut) {
  onAuthStateChanged(auth, (user) => {
    const currentPage = window.location.pathname.split('/').pop();
    // Assuming '', 'index.html', and 'registrati.html' are the only public/auth pages.
    const isAuthPage = ['', 'index.html', 'registrati.html', 'reset_password.html', 'inserisci_codice_reset.html', 'imposta_nuova_password.html', 'verifica_email.html'].includes(currentPage);

    if (user) {
      // User is signed in.
      console.log("User is logged in:", user);

      // If the user is on an authentication page, redirect to the dashboard.
      if (isAuthPage) {
        console.log("Redirecting to dashboard...");
        window.location.href = 'dashboard_amministratore.html'; // Adjust as needed
        return; // Stop further execution
      }

      // If a callback for logged-in users is provided, execute it.
      if (onUserLoggedIn) {
        onUserLoggedIn(user);
      }
    } else {
      // User is signed out.
      console.log("User is logged out.");

      // If the user is not on an authentication page, redirect to the login page.
      if (!isAuthPage) {
        console.log("Redirecting to login page...");
        window.location.href = 'index.html';
        return; // Stop further execution
      }

      // If a callback for logged-out users is provided, execute it.
      if (onUserLoggedOut) {
        onUserLoggedOut();
      }
    }
  });
}

export { checkAuthState };
