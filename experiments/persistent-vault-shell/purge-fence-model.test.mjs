import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePurgeFence, invalidatePurgeForWrite, enterExclusivePurge, cancelPreparedPurge} from './purge-fence-model.mjs';
const idle = {revision: 0, phase: 'idle', operationId: null};

test('claim of a preview-bound preparation rejects missing or different preview hash', () => {
  const prepared={...preparePurgeFence(idle,'purge'),previewHash:'a'.repeat(64)};
  for(const expected of [{revision:prepared.revision,phase:'prepared',operationId:'purge'},
    {...prepared,previewHash:'b'.repeat(64)}])
    assert.throws(()=>enterExclusivePurge(prepared,expected),/FENCE_CONFLICT/);
  assert.equal(enterExclusivePurge(prepared,{...prepared}).phase,'exclusive');
});

test('pre-effect cancellation invalidates the old claim and never releases exclusive state', () => {
  const prepared = {...preparePurgeFence(idle, 'purge'), previewHash:'a'.repeat(64)};
  const cancelled = cancelPreparedPurge(prepared, {...prepared});
  assert.deepEqual(cancelled, {phase:'idle',revision:2,operationId:null});
  assert.throws(()=>enterExclusivePurge(cancelled,prepared),/FENCE_CONFLICT/);
  assert.throws(()=>cancelPreparedPurge(enterExclusivePurge(prepared,prepared),prepared),/FENCE_CONFLICT/);
  assert.throws(()=>cancelPreparedPurge(preparePurgeFence(cancelled,'purge'),prepared),/FENCE_CONFLICT/);
  for(const patch of [{revision:0},{operationId:'other'},{previewHash:'b'.repeat(64)}])
    assert.throws(()=>cancelPreparedPurge(prepared,{...prepared,...patch}),/FENCE_CONFLICT/);
});
test('writer invalidates preparation and old token cannot authorize destruction', () => {
  const prepared = preparePurgeFence(idle, 'purge');
  const written = invalidatePurgeForWrite(prepared);
  assert.equal(written.phase, 'idle');
  assert.throws(() => enterExclusivePurge(written, prepared), /FENCE_CONFLICT/);
  const rePrepared = preparePurgeFence(written, 'purge');
  assert.throws(() => enterExclusivePurge(rePrepared, prepared), /FENCE_CONFLICT/);
  assert.equal(enterExclusivePurge(rePrepared, rePrepared).phase, 'exclusive');
  assert.deepEqual(idle, {revision: 0, phase: 'idle', operationId: null});
});
test('exclusive boundary refuses subsequent writer and competing purge', () => {
  const prepared = preparePurgeFence(idle, 'purge'), exclusive = enterExclusivePurge(prepared, prepared);
  assert.throws(() => invalidatePurgeForWrite(exclusive), /FENCE_BUSY/);
  assert.throws(() => preparePurgeFence(exclusive, 'other'), /FENCE_BUSY/);
  assert.throws(() => enterExclusivePurge(prepared, {...prepared, operationId: 'other'}), /FENCE_CONFLICT/);
});
test('malformed and exhausted revisions cannot wrap into a reusable token', () => {
  for (const revision of [-1, NaN, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => preparePurgeFence({...idle, revision}, 'purge'), /FENCE_STATE/);
  }
  assert.throws(() => invalidatePurgeForWrite({...idle, revision: Number.MAX_SAFE_INTEGER}), /FENCE_OVERFLOW/);
});

test('unknown fence state is never discarded by a writer or preparation', () => {
  for (const extra of [{sequence:{outcome:'unknown'}},{stopRequested:true},{previewHash:'not-a-hash'}]) {
    assert.throws(()=>invalidatePurgeForWrite({...idle,...extra}),/FENCE_STATE/);
    assert.throws(()=>preparePurgeFence({...idle,...extra},'purge'),/FENCE_STATE/);
  }
  const prepared={...preparePurgeFence(idle,'purge'),previewHash:'a'.repeat(64)};
  assert.equal(invalidatePurgeForWrite(prepared).phase,'idle');
  assert.throws(()=>cancelPreparedPurge({...prepared,sequence:{outcome:'unknown'}},prepared),/FENCE_STATE/);
});
