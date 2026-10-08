import {attachmentReadRoute, readAttachmentRoute} from './attachment-read-route.mjs';

// Candidate for already encoded backup records, not an arbitrary object parser.
// Generation authority stays on the server; no client generation is deduplicated.
export function attachmentExportPlan(records, uid, collectStoragePaths) {
  if (typeof collectStoragePaths !== 'function') throw new TypeError('EXPORT_COLLECTOR_REQUIRED');
  return Object.freeze(collectStoragePaths(records, uid).map(storagePath =>
    Object.freeze({storagePath, route: attachmentReadRoute(uid, storagePath)})));
}

// appendBytes borrows the buffer only until its promise settles. It owns any
// encoding/encryption and partial-output abort. isActive binds one session epoch.
export async function consumeAttachmentExport(records, uid, {collectStoragePaths,
  readPublished, readLegacy, appendBytes, isActive}) {
  for (const callback of [readPublished, readLegacy, appendBytes, isActive]) {
    if (typeof callback !== 'function') throw new TypeError('EXPORT_CALLBACK_REQUIRED');
  }
  const check = () => {if (isActive() !== true) throw new Error('EXPORT_SESSION_INACTIVE');};
  check();
  const plan = attachmentExportPlan(records, uid, collectStoragePaths);
  for (const {storagePath} of plan) {
    check();
    const result = await readAttachmentRoute(uid, storagePath, {readPublished, readLegacy});
    const bytes = result?.bytes;
    try {
      check();
      if (!(bytes instanceof Uint8Array) || bytes.length < 1 || bytes.length > 25 * 1024 * 1024 + 1024) {
        throw new Error('EXPORT_BYTES_INVALID');
      }
      await appendBytes(storagePath, bytes);
      check();
    } finally {
      if (bytes instanceof Uint8Array) bytes.fill(0);
    }
  }
  return plan.length;
}
