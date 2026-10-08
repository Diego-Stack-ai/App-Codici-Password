// Candidate only: classify existing paths without changing backup records.
// Classification is not authorization; each transport must authenticate owner.
export function attachmentReadRoute(uid, path) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid) ||
      typeof path !== 'string' || !path.startsWith(`users/${uid}/`) || path.length > 1024 ||
      /[\\%\u0000-\u001f\u007f]/.test(path) ||
      path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('ATTACHMENT_ROUTE_INVALID');
  }
  const parts = path.split('/');
  if (parts[2] === 'restoreObjects') {
    if (parts.length !== 4 || !/^[a-f0-9]{64}$/.test(parts[3])) throw new Error('ATTACHMENT_ROUTE_INVALID');
    return Object.freeze({kind: 'published', stageId: parts[3]});
  }
  return Object.freeze({kind: 'legacy', storagePath: path});
}

export async function readAttachmentRoute(uid, path, {readPublished, readLegacy}) {
  const route = attachmentReadRoute(uid, path);
  // No catch/retry fallback: a missing or rejected stage remains an error.
  return route.kind === 'published' ? readPublished(route.stageId) : readLegacy(route.storagePath);
}
