const encoder = new TextEncoder();
const decoder = new TextDecoder();
const bytesToBase64 = value => Buffer.from(value).toString('base64');
const base64ToBytes = value => new Uint8Array(Buffer.from(value, 'base64'));

export function createOperation({operationId, recordId, deviceId, expectedRevision, changes, createdAt = Date.now()}) {
  if (!operationId || !recordId || !deviceId || !Number.isInteger(expectedRevision) || expectedRevision < 0) throw new Error('OPERATION_INVALID');
  return {schemaVersion: 1, operationId, recordId, deviceId, expectedRevision, changes: structuredClone(changes), createdAt};
}

export async function encryptQueuedOperation(operation, queueKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', queueKey, 'AES-GCM', false, ['encrypt']);
  const aad = encoder.encode(`CodiciPassword:offline-operation:v1:${operation.operationId}`);
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv, additionalData: aad}, key, encoder.encode(JSON.stringify(operation)));
  return {schemaVersion: 1, operationId: operation.operationId, iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext)};
}

export async function decryptQueuedOperation(container, queueKey) {
  if (container?.schemaVersion !== 1 || !container.operationId) throw new Error('QUEUE_CONTAINER_INVALID');
  const key = await crypto.subtle.importKey('raw', queueKey, 'AES-GCM', false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({name: 'AES-GCM', iv: base64ToBytes(container.iv), additionalData: encoder.encode(`CodiciPassword:offline-operation:v1:${container.operationId}`)}, key, base64ToBytes(container.ciphertext));
  const operation = JSON.parse(decoder.decode(clear));
  if (operation.operationId !== container.operationId) throw new Error('QUEUE_OPERATION_MISMATCH');
  return operation;
}

export function applyOperation(state, operation) {
  const processed = new Map(state.processed || []);
  if (processed.has(operation.operationId)) return {state, result: processed.get(operation.operationId), duplicate: true};
  const current = state.records[operation.recordId];
  const currentRevision = current?.revision ?? 0;
  if (currentRevision !== operation.expectedRevision) return {state, result: {status: 'conflict', operationId: operation.operationId, expectedRevision: operation.expectedRevision, currentRevision}, duplicate: false};
  const updated = {...current, ...structuredClone(operation.changes), revision: currentRevision + 1};
  const result = {status: 'applied', operationId: operation.operationId, revision: updated.revision};
  processed.set(operation.operationId, result);
  return {state: {records: {...state.records, [operation.recordId]: updated}, processed: [...processed]}, result, duplicate: false};
}

export function resolveConflict({localOperation, serverRecord, choice}) {
  if (!['keep-server', 'retry-local'].includes(choice)) throw new Error('CONFLICT_CHOICE_REQUIRED');
  if (choice === 'keep-server') return {status: 'discarded', record: structuredClone(serverRecord)};
  return {status: 'retry', operation: createOperation({...localOperation, operationId: `${localOperation.operationId}:retry:${serverRecord.revision}`, expectedRevision: serverRecord.revision})};
}
