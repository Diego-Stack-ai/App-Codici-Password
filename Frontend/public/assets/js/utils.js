/**
 * Displays an alert message to the user.
 * @param {string} message - The message to display.
 */
function showAlert(message) {
  // In a real application, you might use a more sophisticated notification system.
  alert(message);
}

/**
 * Handles errors by logging them to the console and showing an alert.
 * @param {Error} error - The error object.
 */
function handleError(error) {
  console.error("An error occurred:", error);
  showAlert("An unexpected error occurred. Please try again later.");
}

/**
 * Validates a form, checking for empty fields.
 * @param {string[]} fieldIds - An array of input field IDs to validate.
 * @returns {boolean} - True if all fields are filled, false otherwise.
 */
function validateForm(fieldIds) {
  for (const id of fieldIds) {
    const field = document.getElementById(id);
    if (!field || field.value.trim() === '') {
      showAlert(`Please fill in the ${id.replace(/_/g, ' ')} field.`);
      return false;
    }
  }
  return true;
}

/**
 * Validates an email address format.
 * @param {string} email - The email address to validate.
 * @returns {boolean} - True if the email format is valid, false otherwise.
 */
function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (!re.test(String(email).toLowerCase())) {
    showAlert("Please enter a valid email address.");
    return false;
  }
  return true;
}

/**
 * Formats a Firestore Timestamp or JavaScript Date object into a readable string.
 * @param {object} dateObject - The Timestamp or Date object.
 * @returns {string} - The formatted date string (e.g., 'DD/MM/YYYY').
 */
function formatDate(dateObject) {
  if (!dateObject) return '';
  // Convert Firestore Timestamp to JavaScript Date if necessary
  const date = dateObject.toDate ? dateObject.toDate() : dateObject;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export { showAlert, handleError, validateForm, validateEmail, formatDate };
