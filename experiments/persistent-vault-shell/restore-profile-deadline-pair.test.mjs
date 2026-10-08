import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRestoreProfileDeadlinePairs as validate} from './restore-profile-deadline-pair.mjs';
const fixture = () => [{path:'users/u',data:{documenti:[{id:'doc',expiryReference:{deadlineId:'due'}}]}},
  {path:'users/u/scadenze/due',data:{sourceRef:{type:'profileDocument',id:'doc'}}}];
test('explicit reciprocal profile/deadline pair is preserved without mutation',()=>{
  const records=fixture(),before=structuredClone(records);
  assert.deepEqual(validate('u',records),[{profilePath:'users/u',documentId:'doc',deadlinePath:'users/u/scadenze/due'}]);
  assert.deepEqual(records,before);
});
test('missing, ambiguous, foreign and non-reciprocal pairs are rejected',()=>{
  for(const change of [r=>r.pop(),r=>r.shift(),r=>r.push(r[0]),
    r=>r[1].data.sourceRef.id='other',r=>r[1].path='users/other/scadenze/due',
    r=>r[0].data.documenti.push({...r[0].data.documenti[0],id:'second'}),
    r=>r[0].data.documenti[0].expiryReference=null,
    r=>r[1].data.sourceRef.type='inferred']) {
    const records=fixture();change(records);
    assert.throws(()=>validate('u',records),/PAIR_INVALID/);
  }
});
test('no relationship is inferred from matching descriptive fields',()=>{
  assert.deepEqual(validate('u',[{path:'users/u',data:{documenti:[{id:'doc',type:'Synthetic',expiry_date:'2030-01-01'}]}},
    {path:'users/u/scadenze/due',data:{type:'Synthetic',dueDate:'2030-01-01'}}]),[]);
});
