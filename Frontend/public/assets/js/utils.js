/**
 * Centralized error logger for the application.
 * @param {string} context - Where the error happened (e.g., "Firestore User")
 * @param {any} error - The error object or message
 */
export function logError(context, error) {
  console.error(`[${context}]`, error?.code || '', error?.message || error);
}

/**
 * Pure helper for telephone calls
 */
export function makeCall(number) {
  if (!number || number === '-' || number === '') return;
  const cleanNumber = number.replace(/[\s\-\(\)]/g, '');
  window.location.href = `tel:${cleanNumber}`;
}

/**
 * Pure helper for Italian date formatting
 */
export function formatDateToIT(dateString) {
  if (!dateString) return '-';
  if (dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

// Global exposure for non-module scripts
window.makeCall = makeCall;
window.formatDateToIT = formatDateToIT;
