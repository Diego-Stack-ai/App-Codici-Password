import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const configRoot = resolve(projectRoot, '.codex-tmp', 'firebase-config');
const firebaseCli = resolve(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const testFile = resolve(projectRoot, 'tests', 'firestore.profile-widgets.rules.test.mjs');
mkdirSync(configRoot, {recursive: true});

const result = spawnSync(process.execPath, [
  firebaseCli, 'emulators:exec', '--project', 'codici-password-rules-test', '--only', 'firestore',
  `${JSON.stringify(process.execPath)} --test ${JSON.stringify(testFile)}`,
], {
  cwd: projectRoot,
  env: {...process.env, XDG_CONFIG_HOME: configRoot},
  stdio: 'inherit',
  shell: false,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
