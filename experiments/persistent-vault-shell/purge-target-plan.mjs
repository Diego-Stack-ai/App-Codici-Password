// Synthetic lab plan only. No SDK calls, discovery, authorization or deletion.
import {createHash} from 'node:crypto';
const fail = () => { throw new Error('PURGE_TARGET_INVALID'); };
const segment = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
export function planLabPurgeTargets(scope, targets) {
  if (!scope || !segment(scope.id) || typeof scope.bucket !== 'string' ||
      !/^demo-[a-z0-9-]+$/.test(scope.bucket) || !Array.isArray(targets) ||
      targets.length < 1 || targets.length > 400) fail();
  const seen = new Set();
  const result = Array.from(targets, target => {
    if (!target || typeof target.path !== 'string') fail();
    const parts = target.path.split('/');
    if (!parts.every(segment) || parts[1] !== scope.id) fail();
    let item;
    if (target.kind === 'document') {
      if (parts[0] !== 'labPurgeTargets' || parts.length % 2 !== 0) fail();
      const v = target.updateTime;
      if (!v || !Number.isSafeInteger(v.seconds) || v.seconds < -62135596800 || v.seconds > 253402300799 ||
          !Number.isInteger(v.nanoseconds) || v.nanoseconds < 0 || v.nanoseconds > 999999999 || v.nanoseconds % 1000 !== 0) fail();
      item = {kind: 'document', path: target.path, updateTime: Object.freeze({seconds: v.seconds, nanoseconds: v.nanoseconds})};
    } else if (target.kind === 'object') {
      if (parts[0] !== 'labPurgeObjects' || parts.length < 3 || target.bucket !== scope.bucket ||
          typeof target.generation !== 'string' || !/^[1-9][0-9]{0,99}$/.test(target.generation)) fail();
      item = {kind: 'object', path: target.path, bucket: target.bucket, generation: target.generation};
    } else fail();
    // Multiple versions of one path are ambiguous, not additional targets.
    const key = `${item.kind}:${item.path}`;
    if (seen.has(key)) fail();
    seen.add(key);
    return Object.freeze(item);
  });
  return Object.freeze(result);
}
export function bindLabPurgeTarget(scope, claim, target) {
  if (!claim || typeof claim.operationId !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(claim.operationId) ||
      !Number.isSafeInteger(claim.claimRevision) || claim.claimRevision < 1) fail();
  const [canonical] = planLabPurgeTargets(scope, [target]);
  const effectId = createHash('sha256').update(JSON.stringify({domain: 'lab-purge-target-v1',
    scope: {id: scope.id, bucket: scope.bucket}, operationId: claim.operationId,
    claimRevision: claim.claimRevision, target: canonical})).digest('hex');
  return Object.freeze({effectId, target: canonical});
}
