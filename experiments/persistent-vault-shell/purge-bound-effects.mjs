const fail = () => { throw new Error('PURGE_BOUND_EFFECTS_INVALID'); };

// Pure ordering only. Effects remain metadata and never execute a write/delete.
export function planBoundPurgeEffects(plan, storageInventory) {
  if (!plan || plan.valid !== true || typeof plan.planHash !== 'string' ||
      !plan.target || typeof plan.target.accountPath !== 'string' ||
      !Array.isArray(plan.expectedDocuments) || !Array.isArray(plan.deletePaths) ||
      !Array.isArray(plan.revisionTouches) || !Array.isArray(plan.profileReferencePaths) ||
      !Array.isArray(plan.attachmentMetadata) || !storageInventory ||
      storageInventory.planHash !== plan.planHash || typeof storageInventory.storageHash !== 'string' ||
      !Array.isArray(storageInventory.objects)) fail();
  const scope = plan.scope;
  if (!scope || typeof scope.ownerUid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(scope.ownerUid) ||
      !['private', 'company'].includes(scope.context) || typeof scope.accountId !== 'string' ||
      !/^[A-Za-z0-9._:-]{1,160}$/.test(scope.accountId) ||
      (scope.context === 'company' && (typeof scope.companyId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(scope.companyId)))) fail();
  const cleanupCommand = Object.freeze({context: scope.context, accountId: scope.accountId,
    companyId: scope.context === 'company' ? scope.companyId : null});
  const versions = new Map();
  for (const item of plan.expectedDocuments) {
    const version = item?.updateTime;
    if (typeof item?.path !== 'string' || versions.has(item.path) || !version ||
        !Number.isSafeInteger(version.seconds) || !Number.isInteger(version.nanoseconds) ||
        version.nanoseconds < 0 || version.nanoseconds >= 1e9) fail();
    versions.set(item.path, Object.freeze({seconds: version.seconds, nanoseconds: version.nanoseconds}));
  }
  const used = new Set(), effects = [];
  const take = path => {
    if (typeof path !== 'string' || !versions.has(path) || used.has(path)) fail();
    used.add(path); return versions.get(path);
  };
  for (const item of [...plan.revisionTouches].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!Number.isSafeInteger(item.expectedRevision) || !Number.isSafeInteger(item.nextRevision) ||
        item.nextRevision !== item.expectedRevision + 1) fail();
    effects.push(Object.freeze({kind: 'revision-touch', path: item.path, updateTime: take(item.path),
      expectedRevision: item.expectedRevision, nextRevision: item.nextRevision}));
  }
  for (const path of [...plan.profileReferencePaths].sort()) {
    const company = path !== `users/${scope.ownerUid}`;
    if (company && !path.startsWith(`users/${scope.ownerUid}/aziende/`)) fail();
    effects.push(Object.freeze({kind: 'profile-cleanup', path, updateTime: take(path), company,
      command: cleanupCommand}));
  }
  for (const path of [...plan.deletePaths].sort())
    effects.push(Object.freeze({kind: 'document-delete', path, updateTime: take(path)}));
  const attachmentPaths = new Map(plan.attachmentMetadata.map(item => [item.storagePath, item.path]));
  if (attachmentPaths.size !== plan.attachmentMetadata.length || storageInventory.objects.length !== attachmentPaths.size) fail();
  for (const item of storageInventory.objects) {
    const documentPath = attachmentPaths.get(item.storagePath);
    if (!documentPath || typeof item.generation !== 'string' || !/^[1-9][0-9]*$/.test(item.generation)) fail();
    effects.push(Object.freeze({kind: 'object-delete', storagePath: item.storagePath, generation: item.generation}));
  }
  for (const path of [...attachmentPaths.values()].sort())
    effects.push(Object.freeze({kind: 'document-delete', path, updateTime: take(path)}));
  effects.push(Object.freeze({kind: 'document-delete', path: plan.target.accountPath,
    updateTime: take(plan.target.accountPath)}));
  if (used.size !== versions.size) fail();
  return Object.freeze({planHash: plan.planHash, storageHash: storageInventory.storageHash,
    effects: Object.freeze(effects), destructiveAllowed: false});
}
