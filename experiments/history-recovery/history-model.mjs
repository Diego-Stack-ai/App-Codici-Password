const SECRET_KEYS = new Set(['password', 'username', 'account', 'pin', 'puk', 'ccv', 'cardNumber', 'ciphertext', 'wrappedKey', 'token']);

export function moveToTrash(record, {deletedAt, retentionDays = 30, actorUid}) {
  if (!record?.id || !actorUid || !Number.isFinite(deletedAt) || retentionDays < 1) throw new Error('TRASH_INPUT_INVALID');
  return {schemaVersion: 1, recordId: record.id, ownerUid: actorUid, deletedAt, purgeAfter: deletedAt + retentionDays * 86400000, revision: record.revision || 0, snapshot: structuredClone(record)};
}

export function restoreFromTrash(entry, {now, destinationExists = false}) {
  if (!entry?.snapshot || now >= entry.purgeAfter) throw new Error('TRASH_ENTRY_EXPIRED');
  if (destinationExists) throw new Error('RESTORE_CONFLICT');
  return {...structuredClone(entry.snapshot), revision: Number(entry.revision || 0) + 1, restoredAt: now};
}

export const mayPurge = (entry, now) => Boolean(entry?.purgeAfter && now >= entry.purgeAfter);

export function createAuditEvent({action, actorUid, recordId, at, metadata = {}}) {
  if (!action || !actorUid || !recordId || !Number.isFinite(at)) throw new Error('AUDIT_INPUT_INVALID');
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_KEYS.has(key) || typeof value === 'object') continue;
    safe[key] = String(value).slice(0, 160);
  }
  return {schemaVersion: 1, action, actorUid, recordId, at, metadata: safe};
}

export const appendHistory = (history, event, maximum = 100) =>
  [...history, structuredClone(event)].sort((a, b) => a.at - b.at).slice(-maximum);
