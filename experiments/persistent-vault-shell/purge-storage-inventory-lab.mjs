import {createHash} from 'node:crypto';

const HEX = /^[a-f0-9]{64}$/;
const GEN = /^[1-9][0-9]*$/;
const fail = code => { throw new Error(code); };

// Read-only second phase for the demo. It binds every attachment path to the
// exact Storage generation; this result is still not deletion authority.
export async function inventoryPurgeStorageGenerations(plan, bucket) {
  if (!plan || plan.valid !== true || typeof plan.planHash !== 'string' || !HEX.test(plan.planHash) ||
      !Array.isArray(plan.attachmentMetadata) || !bucket || typeof bucket.file !== 'function')
    fail('PURGE_STORAGE_INVENTORY_INVALID');
  const seen = new Set(), objects = [];
  for (const attachment of plan.attachmentMetadata) {
    if (!attachment || typeof attachment.storagePath !== 'string' || !attachment.storagePath ||
        seen.has(attachment.storagePath)) fail('PURGE_STORAGE_INVENTORY_INVALID');
    seen.add(attachment.storagePath);
    let metadata;
    try { [metadata] = await bucket.file(attachment.storagePath).getMetadata(); }
    catch (error) {
      if (Number(error?.code) === 404) fail('PURGE_STORAGE_OBJECT_MISSING');
      throw error;
    }
    if (!metadata || typeof metadata.generation !== 'string' || !GEN.test(metadata.generation))
      fail('PURGE_STORAGE_GENERATION_UNVERIFIED');
    objects.push(Object.freeze({storagePath: attachment.storagePath, generation: metadata.generation}));
  }
  objects.sort((left, right) => left.storagePath.localeCompare(right.storagePath));
  const storageHash = createHash('sha256').update(JSON.stringify({domain: 'purge-storage-inventory-v1',
    planHash: plan.planHash, objects})).digest('hex');
  return Object.freeze({planHash: plan.planHash, storageHash, objects: Object.freeze(objects), destructiveAllowed: false});
}

export async function bindPurgeStorageInventoryLab(db, plan, storageInventory) {
  if (!db || db.projectId !== 'demo-vault-shell' || typeof db.runTransaction !== 'function' ||
      !plan || plan.valid !== true || !Array.isArray(plan.expectedDocuments) ||
      !storageInventory || storageInventory.planHash !== plan.planHash || !Array.isArray(storageInventory.objects))
    fail('PURGE_STORAGE_BINDING_INVALID');
  const canonical = storageInventory.objects.map(item => {
    if (!item || typeof item.storagePath !== 'string' || typeof item.generation !== 'string' || !GEN.test(item.generation))
      fail('PURGE_STORAGE_BINDING_INVALID');
    return {storagePath: item.storagePath, generation: item.generation};
  }).sort((left, right) => left.storagePath.localeCompare(right.storagePath));
  const expectedHash = createHash('sha256').update(JSON.stringify({domain: 'purge-storage-inventory-v1',
    planHash: plan.planHash, objects: canonical})).digest('hex');
  if (storageInventory.storageHash !== expectedHash) fail('PURGE_STORAGE_BINDING_INVALID');
  const seen = new Set(), expected = plan.expectedDocuments.map(item => {
    const version = item?.updateTime;
    if (typeof item?.path !== 'string' || !item.path || seen.has(item.path) ||
        !version || !Number.isSafeInteger(version.seconds) || !Number.isInteger(version.nanoseconds) ||
        version.nanoseconds < 0 || version.nanoseconds >= 1e9) fail('PURGE_STORAGE_BINDING_INVALID');
    seen.add(item.path);
    return {path: item.path, updateTime: {seconds: version.seconds, nanoseconds: version.nanoseconds}};
  });
  const bindingRef = db.doc(`labPurgeStorageBindings/${plan.planHash}`);
  return db.runTransaction(async tx => {
    const refs = expected.map(item => db.doc(item.path));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    snapshots.forEach((snapshot, index) => {
      const version = expected[index].updateTime;
      if (!snapshot.exists || snapshot.updateTime?.seconds !== version.seconds ||
          snapshot.updateTime?.nanoseconds !== version.nanoseconds) fail('PURGE_STORAGE_PREVIEW_STALE');
    });
    const prior = await tx.get(bindingRef);
    const value = {planHash: plan.planHash, storageHash: expectedHash, status: 'prepared', destructiveAllowed: false};
    if (prior.exists) {
      if (JSON.stringify(prior.data()) !== JSON.stringify(value)) fail('PURGE_STORAGE_BINDING_CONFLICT');
      return {...value, duplicate: true};
    }
    tx.create(bindingRef, value);
    return {...value, duplicate: false};
  });
}
