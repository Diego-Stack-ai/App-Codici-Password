// Common Utility Functions

/**
 * Toggles the visibility of a password field.
 * @param {HTMLElement} inputField - The password input field.
 * @param {HTMLElement} toggleIcon - The icon element used for toggling.
 */
function togglePasswordVisibility(inputField, toggleIcon) {
  if (inputField.type === "password") {
    inputField.type = "text";
    // Change icon to 'visibility_off' or similar
    if (toggleIcon) toggleIcon.textContent = "visibility_off";
  } else {
    inputField.type = "password";
    // Change icon back to 'visibility'
    if (toggleIcon) toggleIcon.textContent = "visibility";
  }
}

/**
 * Copies the text from a specified input field to the clipboard.
 * @param {HTMLElement} inputField - The input field to copy from.
 */
function copyToClipboard(inputField) {
  if (!inputField || !inputField.value) {
    console.warn("Cannot copy: input field is empty or invalid.");
    return;
  }

  // Select the text
  inputField.select();
  inputField.setSelectionRange(0, 99999); // For mobile devices

  // Copy the text
  try {
    document.execCommand("copy");
    console.log("Text copied to clipboard:", inputField.value);
    // Optional: show a "Copied!" message to the user
    alert("Copied!");
  } catch (err) {
    console.error("Failed to copy text: ", err);
    alert("Failed to copy.");
  }

  // Deselect the text
  window.getSelection().removeAllRanges();
}

console.log("Utilities module (utils.js) loaded.");
