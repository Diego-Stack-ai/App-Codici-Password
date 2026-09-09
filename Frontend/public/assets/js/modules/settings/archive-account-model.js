export function createArchiveMetadata(record, now = Date.now()) {
    return {
        isArchived: true,
        archiveSchemaVersion: 2,
        archivedAt: new Date(now).toISOString(),
        revision: Number.isInteger(record?.revision) ? record.revision + 1 : 1
    };
}
