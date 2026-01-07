import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * Checks if a user is currently logged in and executes a callback function.
 * @param {function} onUserLoggedIn - Callback to execute if a user is logged in.
 * @param {function} onUserLoggedOut - Callback to execute if no user is logged in.
 */
function checkAuthState(onUserLoggedIn, onUserLoggedOut) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // User is signed in.
      console.log("User is logged in:", user);
      if (onUserLoggedIn) {
        onUserLoggedIn(user);
      }
    } else {
      // User is signed out.
      console.log("User is logged out.");
      if (onUserLoggedOut) {
        onUserLoggedOut();
      }
    }
  });
}

/**
 * Gets the UID of the currently authenticated user.
 * @returns {string|null} The UID of the current user, or null if no user is signed in.
 */
function getUserUID() {
  const user = auth.currentUser;
  if (user) {
    return user.uid;
  } else {
    return null;
  }
}

export { checkAuthState, getUserUID };
