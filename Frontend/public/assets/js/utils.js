/**
 * Centralized error logger for the application.
 * @param {string} context - Where the error happened (e.g., "Firestore User")
 * @param {any} error - The error object or message
 */
export function logError(context, error) {
  console.error(`[${context}]`, error?.code || '', error?.message || error);
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

/**
 * M7-R7C-1 — ciclo di condivisione di un Account.
 * Un Account senza `sharingCycle` è al ciclo legacy 0. Valori non interi,
 * negativi o non sicuri sono INVALIDI (`null`): chi legge deve fallire chiuso
 * invece di interpretarli.
 */
export function sharingCycleOf(record) {
  const value = record ? record.sharingCycle : undefined;
  if (value === undefined) return 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/** Ciclo successivo, oppure `null` se il ciclo attuale è invalido o al massimo. */
export function nextSharingCycle(record) {
  const cycle = sharingCycleOf(record);
  if (cycle === null || cycle >= Number.MAX_SAFE_INTEGER) return null;
  return cycle + 1;
}

/** Scope v2: fixed-width component digests prevent ambiguous resource tuples. */
export async function inviteScopeForAccount(ownerId, companyId, accountId) {
  if (typeof ownerId !== 'string' || !ownerId || typeof companyId !== 'string' ||
      typeof accountId !== 'string' || !accountId) throw new Error('INVITE_SCOPE_INVALID');
  const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
  return sha256((await Promise.all([ownerId, companyId, accountId].map(sha256))).join(''));
}

/** New invitations always use an owner and resource scoped namespace, including cycle zero. */
export function inviteIdForGuest(scope, guestKey, cycle) {
  if (!/^[a-f0-9]{64}$/.test(scope) || !/^[a-z0-9_]+$/.test(guestKey) ||
      !Number.isSafeInteger(cycle) || cycle < 0) throw new Error('INVITE_ID_INVALID');
  return `v2_${scope}_${guestKey}_c${cycle}`;
}

/** Revalidate discovered records before mutating them; never probe global legacy IDs. */
export function inviteMatchesAccount(invite, ownerId, companyId, accountId, cycle) {
  const inviteCycle = invite?.cycle === undefined ? 0 : invite.cycle;
  return invite?.ownerId === ownerId && invite.accountId === accountId &&
    (invite.aziendaId === undefined || invite.aziendaId === null ? '' : invite.aziendaId) === companyId &&
    Number.isSafeInteger(inviteCycle) && inviteCycle >= 0 &&
    (cycle === undefined || inviteCycle === cycle);
}
