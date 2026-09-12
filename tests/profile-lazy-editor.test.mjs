import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/privato/profilo_privato.js', import.meta.url), 'utf8');
const start = source.indexOf('async function runProfileEdit(');
const end = source.indexOf('// ─── INIT', start);
assert.ok(start >= 0 && end > start);
const editorSource = source.slice(start, end).replace("import('./profilo-actions.js')", 'loadEditor()');
const actions = ['editSection', 'editAddress', 'editUserDocument', 'addUtility', 'editUtility'];

function setup() {
  let resolve, reject, loads = 0;
  const pending = new Promise((done, fail) => { resolve = done; reject = fail; });
  const calls = [], toasts = [], errors = [];
  const context = vm.createContext({
    currentUserUid: 'owner', profileEditVersion: 1,
    auth: {currentUser: {uid: 'owner'}}, nameDisplay: {isConnected: true},
    loadEditor: () => { loads += 1; return pending; },
    showToast: (...args) => toasts.push(args), logError: (...args) => errors.push(args),
  });
  vm.runInContext(`${editorSource}\nglobalThis.actions = {${actions.join(',')}};`, context);
  const editor = Object.fromEntries(actions.map(name => [name, (...args) => calls.push({name, args})]));
  return {context, calls, toasts, errors, resolve: () => resolve(editor), reject, loads: () => loads};
}

test('profile editors load only on action and preserve each editor’s arguments', async () => {
  const runtime = setup();
  assert.equal(runtime.loads(), 0);
  assert.doesNotMatch(source, /import\s+\{[^}]*\}\s+from\s+['"]\.\/profilo-actions\.js['"]/);
  for (const name of actions) {
    const state = {currentUserUid: 'owner'};
    const pending = runtime.context.actions[name](4, state);
    if (name === actions[0]) {
      assert.equal(runtime.calls.length, 0);
      runtime.resolve();
    }
    await pending;
    assert.equal(runtime.calls.at(-1).name, name);
    assert.equal(runtime.calls.at(-1).args[0], 4);
    assert.equal(runtime.calls.at(-1).args[1], state);
  }
});

test('pending editor never opens after UID, profile generation or DOM lifecycle changes', async () => {
  for (const invalidate of [
    context => { context.auth.currentUser = {uid: 'other'}; },
    context => { context.profileEditVersion += 1; },
    context => { context.nameDisplay.isConnected = false; },
  ]) {
    const runtime = setup();
    const pending = runtime.context.actions.editAddress(-1, {});
    invalidate(runtime.context);
    runtime.resolve();
    await pending;
    assert.equal(runtime.calls.length, 0);
    assert.equal(runtime.toasts.length, 0);
  }
});

test('editor import failure is visible only in the originating active profile', async () => {
  for (const active of [true, false]) {
    const runtime = setup();
    const pending = runtime.context.actions.editSection('personal', {});
    runtime.context.nameDisplay.isConnected = active;
    runtime.reject(new Error('synthetic module failure'));
    await pending;
    assert.equal(runtime.toasts.length, active ? 1 : 0);
    assert.equal(runtime.calls.length, 0);
  }
});
