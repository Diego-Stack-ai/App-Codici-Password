export const ARCHIVE_RETENTION_DAYS = 30;

function toMillis(value) {
    if (typeof value === 'string') return Date.parse(value);
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    return Number.NaN;
}

export function createArchiveMetadata(record, now = Date.now()) {
    return {
        isArchived: true,
        archiveSchemaVersion: 1,
        archivedAt: new Date(now).toISOString(),
        purgeAfter: new Date(now + ARCHIVE_RETENTION_DAYS * 86400000).toISOString(),
        revision: Number.isInteger(record?.revision) ? record.revision + 1 : 1
    };
}

export function archiveRetention(record, now = Date.now()) {
    const purgeAt = toMillis(record?.purgeAfter);
    if (!Number.isFinite(purgeAt)) return {legacy: true, expired: false, daysRemaining: null};
    const remaining = purgeAt - now;
    return {legacy: false, expired: remaining <= 0, daysRemaining: Math.max(0, Math.ceil(remaining / 86400000))};
}
