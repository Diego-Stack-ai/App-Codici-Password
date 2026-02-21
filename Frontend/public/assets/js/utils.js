/**
 * Centralized error logger for the application.
 * @param {string} context - Where the error happened (e.g., "Firestore User")
 * @param {any} error - The error object or message
 */
export function logError(context, error) {
  console.error(`[${context}]`, error?.code || '', error?.message || error);
}

export function logDebug(context, message) {
  if (window.__APP_ENV !== 'production' || window.location.hostname === 'localhost') {
    console.log(`DEBUG [${context}]:`, message);
  }
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
 * Pure helper for Italian date formatting.
 * Supporta stringhe YYYY-MM-DD, oggetti Date e Firestore Timestamps.
 */
export function formatDateToIT(dateString) {
  if (!dateString) return '-';

  // Se è un oggetto Timestamp di Firebase o un oggetto Date
  if (dateString.toDate && typeof dateString.toDate === 'function') {
    return dateString.toDate().toLocaleDateString('it-IT');
  }

  if (dateString instanceof Date) {
    return dateString.toLocaleDateString('it-IT');
  }

  // Se è una stringa YYYY-MM-DD
  if (typeof dateString === 'string' && dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      // Gestione YYYY-MM-DD
      if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      // Gestione DD-MM-YYYY
      return dateString.replace(/-/g, '/');
    }
  }
  return dateString;
}

/**
 * Sanitizes an email to be used as a Firestore Map Key.
 */
export function sanitizeEmail(email) {
  if (!email) return 'unknown_guest';
  const clean = email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
  return clean || 'unknown_guest';
}

// Global exposure for non-module scripts
window.makeCall = makeCall;
window.formatDateToIT = formatDateToIT;
window.sanitizeEmail = sanitizeEmail;
