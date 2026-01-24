/**
 * Displays a notification banner to the user.
 * @param {string} message - The message to display.
 * @param {string} type - The type of notification ('success' or 'error').
 */
function showNotification(message, type) {
  const banner = document.getElementById('notification-banner');
  if (!banner) {
    console.error('Notification banner not found!');
    return;
  }

  banner.textContent = message;
  banner.classList.remove('hidden', 'bg-green-500', 'bg-red-500');

  if (type === 'success') {
    banner.classList.add('bg-green-500');
  } else if (type === 'error') {
    banner.classList.add('bg-red-500');
  }

  banner.classList.remove('hidden');

  setTimeout(() => {
    banner.classList.add('hidden');
  }, 5000);
}

/**
 * Centralized error logger for the application.
 * @param {string} context - Where the error happened (e.g., "Firestore User")
 * @param {any} error - The error object or message
 */
function logError(context, error) {
  console.error(`[${context}]`, error?.code || '', error?.message || error);
}

export { showNotification, logError };
