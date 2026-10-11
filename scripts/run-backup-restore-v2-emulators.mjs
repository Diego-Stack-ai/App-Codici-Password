import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const configRoot = resolve(root, '.codex-tmp', 'firebase-config');
const firebaseCli = resolve(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const testFile = resolve(root, 'tests', 'backup-restore-v2-plan.emulator.test.mjs');
mkdirSync(configRoot, {recursive: true});
const result = spawnSync(process.execPath, [firebaseCli, 'emulators:exec', '--project',
    'codici-password-m8-v2-plan', '--only', 'firestore',
    `${JSON.stringify(process.execPath)} --test ${JSON.stringify(testFile)}`], {
    cwd: root, env: {...process.env, XDG_CONFIG_HOME: configRoot}, stdio: 'inherit', shell: false
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
