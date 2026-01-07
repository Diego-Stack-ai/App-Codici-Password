// Simulated Authentication Logic

/**
 * Simulates a user login.
 * In a real app, this would call Firebase Auth.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 * @returns {boolean} - True for successful login, false otherwise.
 */
function login(email, password) {
  console.log(`Attempting login for email: ${email}`);
  if (email && password) {
    // In this simulation, any non-empty email/password is valid.
    console.log("Login successful (simulated).");
    // Set a simulated session state
    sessionStorage.setItem("isLoggedIn", "true");
    return true;
  }
  console.log("Login failed (simulated).");
  return false;
}

/**
 * Simulates a user logout.
 */
function logout() {
  console.log("Logging out (simulated).");
  sessionStorage.removeItem("isLoggedIn");
}

/**
 * Checks if a user is "logged in" based on session storage.
 * @returns {boolean} - True if logged in, false otherwise.
 */
function checkAuthState() {
  return sessionStorage.getItem("isLoggedIn") === "true";
}

console.log("Authentication module (auth.js) loaded.");
