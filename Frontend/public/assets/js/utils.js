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

export { showAlert, handleError };
