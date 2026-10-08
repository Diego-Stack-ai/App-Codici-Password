import {createStagedChunkBinding, verifyStagedChunkReceipt} from './restore-chunk-binding.mjs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {validateRestoreChunk} = require('../../functions/backup-restore-service.js');

// Pure preparation only. Caller must recover and authenticate the original plan;
// structural completeness cannot prove that this is the plan originally selected.
export function bindOriginalRestorePlan(uid, chunks) {
  if (!Array.isArray(chunks) || chunks.length < 1 || chunks.length > 10000) throw new Error('LAB_RESUME_INPUT');
  const bindings = [], paths = new Set(); let backupId;
  for (let index = 0; index < chunks.length; index++) {
    const item = chunks[index];
    if (!item) throw new Error('LAB_RESUME_INPUT');
    const command = validateRestoreChunk(item.command, uid);
    if (command.mode !== 'apply' || !command.confirmed || command.chunkIndex !== index ||
        command.chunkCount !== chunks.length || (index && command.backupId !== backupId)) throw new Error('LAB_RESUME_INPUT');
    backupId = command.backupId;
    for (const record of command.records) {
      if (paths.has(record.path)) throw new Error('LAB_RESUME_INPUT');
      paths.add(record.path);
    }
    bindings.push(createStagedChunkBinding(uid, command, item.stages));
  }
  summarizeRestoreReceipts(bindings, bindings.map(() => null));
  const planHash = createHash('sha256').update(JSON.stringify({domain: 'lab-original-restore-plan',
    version: 1, bindings})).digest('hex');
  return Object.freeze({planHash, bindings: Object.freeze(bindings)});
}

// Internal, pure classification of original server-derived bindings and receipt snapshots.
// Missing receipt means unconfirmed, NOT proof that data/bytes are missing or safe to overwrite.
export function summarizeRestoreReceipts(bindings, receipts) {
  if (!Array.isArray(bindings) || bindings.length < 1 || bindings.length > 10000 ||
      !Array.isArray(receipts) || receipts.length !== bindings.length) throw new Error('LAB_RESUME_INPUT');
  const seen = new Set(), entries = [];
  for (let index = 0; index < bindings.length; index++) {
    const binding = bindings[index];
    // Reuse strict binding validation without accepting this synthetic receipt as evidence.
    verifyStagedChunkReceipt({...binding, status: 'applied', duplicate: false, rewriteHash: '0'.repeat(64)}, binding);
    if (binding.ownerUid !== bindings[0].ownerUid || binding.restoreOperationId !== bindings[0].restoreOperationId ||
        seen.has(binding.chunkOperationId) || !Object.hasOwn(receipts, index)) throw new Error('LAB_RESUME_INPUT');
    seen.add(binding.chunkOperationId);
    let status = 'unconfirmed';
    if (receipts[index] !== null) {
      try { verifyStagedChunkReceipt(receipts[index], binding); status = 'confirmed'; }
      catch { status = 'conflict'; }
    }
    entries.push(Object.freeze({index, status}));
  }
  return Object.freeze({entries: Object.freeze(entries),
    confirmed: entries.filter(e => e.status === 'confirmed').length,
    unconfirmed: entries.filter(e => e.status === 'unconfirmed').length,
    conflicts: entries.filter(e => e.status === 'conflict').length});
}
