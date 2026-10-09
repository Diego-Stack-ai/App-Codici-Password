// Candidato M7-D1 esclusivamente locale. Non è importato da Functions o UI e
// non autorizza cancellazioni: calcola soltanto quando creare l'avviso e quando
// un Account potrebbe entrare in un futuro piano di purge sicuro.
export const ARCHIVE_RETENTION_YEARS = 2;
export const ARCHIVE_NOTICE_MIN_DAYS = 10;
const DAY_MS = 86_400_000;
const IDENTIFIER = /^[A-Za-z0-9._:-]{1,200}$/;
const fail = code => Object.assign(new Error(code), {code});

function instant(value) {
  if (value instanceof Date) return Number.isSafeInteger(value.getTime()) ? value.getTime() : null;
  if (typeof value?.toMillis === 'function') {
    const result = value.toMillis();
    return Number.isSafeInteger(result) && Number.isFinite(new Date(result).getTime()) ? result : null;
  }
  const seconds = value?.seconds, nanoseconds = value?.nanoseconds ?? 0;
  if (!Number.isSafeInteger(seconds) || seconds < 0 || !Number.isInteger(nanoseconds) ||
      nanoseconds < 0 || nanoseconds > 999_999_999) return null;
  const result = seconds * 1000 + Math.floor(nanoseconds / 1e6);
  return Number.isSafeInteger(result) && Number.isFinite(new Date(result).getTime()) ? result : null;
}

function addCalendarYears(value, years) {
  const source = new Date(value), day = source.getUTCDate();
  const target = new Date(Date.UTC(source.getUTCFullYear() + years, source.getUTCMonth(), 1,
    source.getUTCHours(), source.getUTCMinutes(), source.getUTCSeconds(), source.getUTCMilliseconds()));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return target.getTime();
}

function identity(account) {
  const ownerUid = account?.ownerUid, accountId = account?.accountId;
  const context = account?.context, companyId = account?.companyId ?? null;
  if (!IDENTIFIER.test(ownerUid || '') || !IDENTIFIER.test(accountId || '') ||
      !['private', 'company'].includes(context) ||
      (context === 'company' ? !IDENTIFIER.test(companyId || '') : companyId !== null)) {
    throw fail('ARCHIVE_RETENTION_IDENTITY_INVALID');
  }
  return {ownerUid, accountId, context, companyId};
}

export function archiveNoticeRecord(account, createdAt) {
  const target = identity(account), archivedAt = instant(account?.archivedAt);
  if (account?.archived !== true || archivedAt === null || !Number.isSafeInteger(account?.archiveRevision) ||
      account.archiveRevision < 1 || !Number.isSafeInteger(createdAt) || createdAt < archivedAt) {
    throw fail('ARCHIVE_RETENTION_ACCOUNT_INVALID');
  }
  return Object.freeze({...target, archiveRevision: account.archiveRevision, archivedAt,
    createdAt, schemaVersion: 1});
}

export function archiveRetentionDecision({account, notice = null, now} = {}) {
  if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime())) throw fail('ARCHIVE_RETENTION_CLOCK_INVALID');
  const target = identity(account), archivedAt = instant(account?.archivedAt);
  if (account?.archived !== true) return Object.freeze({status: 'not-archived'});
  if (archivedAt === null || !Number.isSafeInteger(account.archiveRevision) || account.archiveRevision < 1) {
    return Object.freeze({status: 'unverifiable'});
  }
  const expiresAt = addCalendarYears(archivedAt, ARCHIVE_RETENTION_YEARS);
  const noticeDueAt = expiresAt - ARCHIVE_NOTICE_MIN_DAYS * DAY_MS;
  if (now < noticeDueAt) return Object.freeze({status: 'retained', expiresAt, noticeDueAt});
  const noticeAt = Number.isSafeInteger(notice?.createdAt) && Number.isFinite(new Date(notice.createdAt).getTime())
    ? notice.createdAt : instant(notice?.createdAt);
  const matches = notice?.schemaVersion === 1 && noticeAt !== null && noticeAt >= archivedAt &&
    notice.ownerUid === target.ownerUid && notice.accountId === target.accountId &&
    notice.context === target.context && (notice.companyId ?? null) === target.companyId &&
    notice.archiveRevision === account.archiveRevision && notice.archivedAt === archivedAt;
  if (!matches) return Object.freeze({status: 'notice-required', expiresAt, noticeDueAt});
  const purgeAt = Math.max(expiresAt, noticeAt + ARCHIVE_NOTICE_MIN_DAYS * DAY_MS);
  return Object.freeze(now < purgeAt
    ? {status: 'waiting-notice', expiresAt, noticeDueAt, purgeAt}
    : {status: 'eligible', expiresAt, noticeDueAt, purgeAt});
}
