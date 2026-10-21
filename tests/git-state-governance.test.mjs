import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRepositoryState, parseWorktreePorcelain} from '../scripts/audit-git-state.mjs';

function validState() {
  return {
    masterRef: 'origin/master', masterHead: 'm'.repeat(40),
    currentBranch: 'codex/release-safe', currentHead: 'c'.repeat(40),
    currentAhead: 1, currentBehind: 0,
    worktrees: [
      {path: 'C:/repo/release', head: 'c'.repeat(40), branch: 'codex/release-safe', dirty: false, merged: false},
      {path: 'C:/repo/main', head: 'm'.repeat(40), branch: 'master', dirty: false, merged: true}
    ],
    localBranches: [
      {name: 'codex/release-safe', head: 'c'.repeat(40), merged: false},
      {name: 'master', head: 'm'.repeat(40), merged: true}
    ],
    remoteBranches: [
      {name: 'origin/master', head: 'm'.repeat(40), merged: true},
      {name: 'origin/codex/release-safe', head: 'c'.repeat(40), merged: false}
    ]
  };
}

test('interpreta worktree, ramo e detached dal formato porcelain', () => {
  assert.deepEqual(parseWorktreePorcelain([
    'worktree C:/repo', `HEAD ${'a'.repeat(40)}`, 'branch refs/heads/master', '',
    'worktree C:/repo/detached', `HEAD ${'b'.repeat(40)}`, 'detached'
  ].join('\n')), [
    {path: 'C:/repo', head: 'a'.repeat(40), branch: 'master', detached: false},
    {path: 'C:/repo/detached', head: 'b'.repeat(40), branch: '', detached: true}
  ]);
});

test('il preflight accetta un solo ramo corrente pulito, aggiornato e gia inviato', () => {
  assert.deepEqual(evaluateRepositoryState(validState(), {strict: true}), {ok: true, strict: true, issues: []});
});

test('il preflight blocca worktree sporchi e rami locali o remoti non integrati', () => {
  const state = validState();
  state.worktrees[1] = {...state.worktrees[1], dirty: true, merged: false, branch: 'codex/old'};
  state.localBranches.push({name: 'codex/old', head: 'o'.repeat(40), merged: false});
  state.remoteBranches.push({name: 'origin/codex/old', head: 'o'.repeat(40), merged: false});
  const codes = evaluateRepositoryState(state, {strict: true}).issues.map(issue => issue.code);
  assert.deepEqual(codes, [
    'OTHER_WORKTREE_DIRTY', 'OTHER_WORKTREE_UNMERGED', 'LOCAL_BRANCH_UNMERGED', 'REMOTE_BRANCH_UNMERGED'
  ]);
});

test('il preflight blocca una base arretrata e un commit non inviato', () => {
  const state = validState();
  state.currentBehind = 216;
  state.remoteBranches = state.remoteBranches.filter(item => item.name !== 'origin/codex/release-safe');
  const codes = evaluateRepositoryState(state, {strict: true}).issues.map(issue => issue.code);
  assert.deepEqual(codes, ['CURRENT_BEHIND', 'CURRENT_NOT_PUSHED']);
});

test('il preflight richiede la chiusura anche dei rami e worktree gia integrati', () => {
  const state = validState();
  state.worktrees.push({
    path: 'C:/repo/old', head: state.masterHead, branch: 'codex/old-merged', dirty: false, merged: true
  });
  state.localBranches.push({name: 'codex/old-merged', head: state.masterHead, merged: true});
  state.remoteBranches.push({name: 'origin/codex/old-merged', head: state.masterHead, merged: true});

  const codes = evaluateRepositoryState(state, {strict: true}).issues.map(issue => issue.code);
  assert.deepEqual(codes, ['OTHER_WORKTREE_STALE', 'LOCAL_BRANCH_STALE', 'REMOTE_BRANCH_STALE']);
});
