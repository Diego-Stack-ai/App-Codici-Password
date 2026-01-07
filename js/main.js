// Main JavaScript file - DOM interaction logic
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed. Initializing event listeners.");

  // --- Login Page Logic ---
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Prevent actual form submission
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;

      if (login(email, password)) {
        // Redirect to home page on successful login
        window.location.href = "home_page.html";
      } else {
        alert("Login failed. Please check your credentials.");
      }
    });
  }

  // --- Password Field Utilities ---
  const passwordInput = document.getElementById("password");
  const toggleIcon = document.querySelector(".password-toggle-icon");
  const copyButton = document.querySelector(".copy-btn");

  if (passwordInput && toggleIcon) {
    toggleIcon.addEventListener("click", () => {
      // The icon text itself isn't changing in this simple version,
      // but the function in utils.js is ready for it.
      togglePasswordVisibility(passwordInput, null); // Pass null as we are not changing the icon text here
    });
  }

  if (passwordInput && copyButton) {
    copyButton.addEventListener("click", () => {
      copyToClipboard(passwordInput);
    });
  }

  // --- Home Page Logic ---
  const logoutButton = document.getElementById("logout-btn");
  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      logout();
      // Redirect to login page on logout
      window.location.href = "index.html";
    });
  }

  // --- Global Auth Check ---
  // On protected pages, you might run a check like this:
  // if (!checkAuthState() && window.location.pathname.includes('home_page.html')) {
  //   window.location.href = 'index.html';
  // }
});
