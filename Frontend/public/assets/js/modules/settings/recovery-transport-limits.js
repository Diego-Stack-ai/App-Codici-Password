// These limits cover UTF-8 JSON on the callable wire, including commitments,
// external references and the callable protocol's {data: ...} envelope.
export const MAX_RECOVERY_CONTENT_BYTES = 20 * 1024 * 1024;
export const MAX_RECOVERY_CALLABLE_BODY_BYTES = 24 * 1024 * 1024;
export const RECOVERY_PART_BYTES = 2 * 1024 * 1024;
const encoder = new TextEncoder();
const fail = code => { throw Object.assign(new Error(code), {code}); };
export function recoveryJsonUtf8Bytes(value) {
    let serialized;
    try { serialized = JSON.stringify(value); } catch { fail('RECOVERY_VALUE_INVALID'); }
    if (typeof serialized !== 'string') fail('RECOVERY_VALUE_INVALID');
    return encoder.encode(serialized).length;
}
export function assertRecoveryContentCapacity(content) {
    if (recoveryJsonUtf8Bytes(content) > MAX_RECOVERY_CONTENT_BYTES) fail('RECOVERY_TRANSPORT_CAPACITY_EXCEEDED');
    return content;
}
export function assertRecoveryCallableCapacity(data) {
    if (recoveryJsonUtf8Bytes({data}) > MAX_RECOVERY_CALLABLE_BODY_BYTES) fail('RECOVERY_TRANSPORT_CAPACITY_EXCEEDED');
    return data;
}
export function assertRecoveryTransportAdmission(content, operationId, finalize) {
    assertRecoveryContentCapacity(content);
    assertRecoveryCallableCapacity({action: 'prepare', operationId, content});
    // Reserve the largest part and indices before persisting the locator or
    // acquiring a server fence. Base64 ASCII has exactly this encoded length.
    assertRecoveryCallableCapacity({action: 'uploadPart', operationId, content,
        assetIndex: 9999, partIndex: 16, bytes: 'A'.repeat(Math.ceil(RECOVERY_PART_BYTES / 3) * 4)});
    assertRecoveryCallableCapacity({action: 'finalize', operationId, content, finalize});
}
