import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const MASTER_REF = 'origin/master';

function git(args, cwd, {allowFailure = false} = {}) {
  const result = spawnSync('git', args, {cwd, encoding: 'utf8'});
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(' ')}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result;
}

function gitText(args, cwd) {
  return git(args, cwd).stdout.trim();
}

function branchName(value = '') {
  return value.startsWith('refs/heads/') ? value.slice('refs/heads/'.length) : value;
}

export function parseWorktreePorcelain(value = '') {
  return value.trim().split(/\r?\n\r?\n/).filter(Boolean).map(block => {
    const item = {path: '', head: '', branch: '', detached: false};
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) item.path = line.slice('worktree '.length);
      else if (line.startsWith('HEAD ')) item.head = line.slice('HEAD '.length);
      else if (line.startsWith('branch ')) item.branch = branchName(line.slice('branch '.length));
      else if (line === 'detached') item.detached = true;
    }
    return item;
  });
}

function refRows(value = '') {
  return value.split(/\r?\n/).filter(Boolean).map(line => {
    const [name, head] = line.split('\t');
    return {name, head};
  });
}

function isAncestor(cwd, candidate, masterRef = MASTER_REF) {
  return git(['merge-base', '--is-ancestor', candidate, masterRef], cwd, {allowFailure: true}).status === 0;
}

export function collectRepositoryState(cwd = process.cwd()) {
  const root = gitText(['rev-parse', '--show-toplevel'], cwd);
  gitText(['rev-parse', '--verify', MASTER_REF], root);
  const currentBranch = gitText(['branch', '--show-current'], root);
  const currentHead = gitText(['rev-parse', 'HEAD'], root);
  const masterHead = gitText(['rev-parse', MASTER_REF], root);
  const currentAhead = Number(gitText(['rev-list', '--count', `${MASTER_REF}..HEAD`], root));
  const currentBehind = Number(gitText(['rev-list', '--count', `HEAD..${MASTER_REF}`], root));
  const worktrees = parseWorktreePorcelain(gitText(['worktree', 'list', '--porcelain'], root)).map(item => ({
    ...item,
    dirty: Boolean(gitText(['-C', item.path, 'status', '--porcelain=v1', '--untracked-files=all'], root)),
    merged: isAncestor(root, item.head)
  }));
  const localBranches = refRows(gitText([
    'for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/heads'
  ], root)).map(item => ({...item, merged: isAncestor(root, item.name)}));
  const remoteBranches = refRows(gitText([
    'for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/remotes/origin'
  ], root)).filter(item => item.name !== 'origin/HEAD' && item.name !== 'origin').map(item => ({
    ...item, merged: item.name === MASTER_REF || isAncestor(root, item.name)
  }));
  return {root, masterRef: MASTER_REF, masterHead, currentBranch, currentHead,
    currentAhead, currentBehind, worktrees, localBranches, remoteBranches};
}

export function evaluateRepositoryState(state, {strict = false} = {}) {
  const issues = [];
  const currentRemote = `origin/${state.currentBranch}`;
  const currentRemoteRef = state.remoteBranches.find(item => item.name === currentRemote);
  const add = (code, detail) => issues.push({code, detail});
  if (!state.currentBranch) add('CURRENT_DETACHED', 'Il worktree corrente e in detached HEAD.');
  if (strict && state.currentBranch === 'master') add('CURRENT_MASTER', 'Il lavoro di modifica non deve partire direttamente da master.');
  if (strict && state.currentBranch && !state.currentBranch.startsWith('codex/')) {
    add('CURRENT_PREFIX', `Il ramo corrente non usa il prefisso codex/: ${state.currentBranch}`);
  }
  if (strict && state.currentAhead < 1) add('CURRENT_EMPTY', 'Il ramo corrente non contiene commit da rilasciare.');
  if (state.currentBehind > 0) add('CURRENT_BEHIND', `Il ramo corrente e indietro di ${state.currentBehind} commit rispetto a ${state.masterRef}.`);
  const currentWorktree = state.worktrees.find(item => item.head === state.currentHead && item.branch === state.currentBranch);
  if (!currentWorktree) add('CURRENT_WORKTREE_MISSING', 'Il worktree corrente non compare nel registro Git.');
  else if (currentWorktree.dirty) add('CURRENT_DIRTY', `Il worktree corrente non e pulito: ${currentWorktree.path}`);
  if (strict && (!currentRemoteRef || currentRemoteRef.head !== state.currentHead)) {
    add('CURRENT_NOT_PUSHED', `origin/${state.currentBranch || '<detached>'} non coincide con HEAD.`);
  }
  for (const worktree of state.worktrees) {
    if (worktree.path === currentWorktree?.path) continue;
    if (worktree.dirty) add('OTHER_WORKTREE_DIRTY', worktree.path);
    if (!worktree.merged) add('OTHER_WORKTREE_UNMERGED', `${worktree.path} (${worktree.branch || worktree.head.slice(0, 8)})`);
    else if (strict && worktree.branch !== 'master') {
      add('OTHER_WORKTREE_STALE', `${worktree.path} (${worktree.branch || worktree.head.slice(0, 8)})`);
    }
  }
  for (const branch of state.localBranches) {
    if (branch.name === state.currentBranch || branch.name === 'master') continue;
    if (!branch.merged) add('LOCAL_BRANCH_UNMERGED', branch.name);
    else if (strict) add('LOCAL_BRANCH_STALE', branch.name);
  }
  for (const branch of state.remoteBranches) {
    if (branch.name === currentRemote || branch.name === state.masterRef) continue;
    if (!branch.merged) add('REMOTE_BRANCH_UNMERGED', branch.name);
    else if (strict) add('REMOTE_BRANCH_STALE', branch.name);
  }
  return {ok: issues.length === 0, strict, issues};
}

function printReport(state, result) {
  console.log(`Git state: ${state.currentBranch || '(detached)'} @ ${state.currentHead.slice(0, 8)}`);
  console.log(`Base: ${state.masterRef} @ ${state.masterHead.slice(0, 8)} | ahead ${state.currentAhead} | behind ${state.currentBehind}`);
  console.log(`Worktree: ${state.worktrees.length} | rami locali: ${state.localBranches.length} | remoti origin: ${state.remoteBranches.length}`);
  if (result.ok) {
    console.log(result.strict ? 'Preflight Git superato.' : 'Audit Git senza anomalie.');
    return;
  }
  for (const issue of result.issues) console.error(`[${issue.code}] ${issue.detail}`);
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
}

if (isMain()) {
  try {
    const state = collectRepositoryState();
    const result = evaluateRepositoryState(state, {strict: process.argv.includes('--strict')});
    printReport(state, result);
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
