// Pure closed-pair validation used by preview and atomic candidate commits.
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function validateRestoreProfileDeadlinePairs(uid, records) {
  const fail = () => {throw Error('RESUME_PROFILE_DEADLINE_PAIR_INVALID');};
  if (!id(uid) || !Array.isArray(records)) fail();
  const byPath = new Map();
  for (const record of records) {
    if (!record || typeof record.path !== 'string' || byPath.has(record.path)) fail();
    byPath.set(record.path, record.data);
  }
  const profile = byPath.get(`users/${uid}`);
  const linked = records.filter(record => record.path.startsWith(`users/${uid}/scadenze/`) && record.data?.sourceRef != null);
  if (!profile) {if (linked.length) fail(); return [];}
  if (profile.documenti !== undefined && !Array.isArray(profile.documenti)) fail();
  const documents = new Map(), pairs = [], deadlines = new Set();
  for (const document of profile.documenti || []) {
    if (!document || !id(document.id) || documents.has(document.id)) fail();
    documents.set(document.id, document);
    if (document.expiryReference == null) continue;
    const reference = document.expiryReference;
    if (typeof reference !== 'object' || Object.keys(reference).join(',') !== 'deadlineId' || !id(reference.deadlineId)) fail();
    if (deadlines.has(reference.deadlineId)) fail();
    deadlines.add(reference.deadlineId);
    const path = `users/${uid}/scadenze/${reference.deadlineId}`, deadline = byPath.get(path);
    if (!deadline || deadline.sourceRef?.type !== 'profileDocument' || deadline.sourceRef.id !== document.id ||
        Object.keys(deadline.sourceRef).sort().join(',') !== 'id,type') fail();
    pairs.push({profilePath: `users/${uid}`, documentId: document.id, deadlinePath: path});
  }
  for (const record of linked) {
    const reference = record.data.sourceRef, deadlineId = record.path.split('/').at(-1);
    if (!id(deadlineId) || record.path !== `users/${uid}/scadenze/${deadlineId}` ||
        reference.type !== 'profileDocument' || !id(reference.id) ||
        documents.get(reference.id)?.expiryReference?.deadlineId !== deadlineId) fail();
  }
  return pairs;
}
