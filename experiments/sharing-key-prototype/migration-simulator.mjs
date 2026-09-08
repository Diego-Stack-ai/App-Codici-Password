import {
  encryptRecordPayload,
  generateRecordKey,
  wrapRecordKeyForRecipient
} from './record-sharing-crypto.mjs';

const encoder = new TextEncoder();

function clone(value) {
  return structuredClone(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

async function checksum(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(stable(value))));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createRollbackPackage(source) {
  const snapshot = clone(source);
  return {
    schemaVersion: 1,
    fixtureOnly: true,
    sourceChecksum: await checksum(snapshot),
    snapshot
  };
}

export async function restoreRollbackPackage(backup) {
  if (backup?.schemaVersion !== 1 || backup?.fixtureOnly !== true || !backup.snapshot) {
    throw new Error('ROLLBACK_PACKAGE_INVALID');
  }
  if (await checksum(backup.snapshot) !== backup.sourceChecksum) throw new Error('ROLLBACK_INTEGRITY_FAILED');
  return clone(backup.snapshot);
}

export async function simulateFixtureMigration({fixture, account, owner, recipients = []}) {
  if (fixture !== true) throw new Error('PRODUCTION_DATA_FORBIDDEN');
  if (!account?.id || !owner?.uid || !owner?.publicKey) throw new Error('MIGRATION_INPUT_INVALID');

  const recordId = account.id;
  const recordKey = generateRecordKey();
  const payload = await encryptRecordPayload(clone(account), recordKey, recordId);
  const subjects = [owner, ...recipients];
  const grants = [];

  for (const subject of subjects) {
    if (!subject.uid || !subject.publicKey) throw new Error('MIGRATION_SUBJECT_INVALID');
    grants.push({
      schemaVersion: 1,
      shareId: `${recordId}:${subject.uid}:1`,
      recordId,
      ownerUid: owner.uid,
      recipientUid: subject.uid,
      role: subject.uid === owner.uid ? 'owner' : 'viewer',
      status: 'accepted',
      keyGeneration: 1,
      envelope: await wrapRecordKeyForRecipient(recordKey, subject.publicKey, recordId, subject.uid)
    });
  }

  return {
    record: {
      schemaVersion: 2,
      cryptoProtocol: 'record-key-v1',
      recordId,
      ownerUid: owner.uid,
      kind: account.type === 'memo' || account.visibility === 'memorandum' ? 'memo' : 'account',
      keyGeneration: 1,
      payload
    },
    grants,
    backup: await createRollbackPackage(account)
  };
}
