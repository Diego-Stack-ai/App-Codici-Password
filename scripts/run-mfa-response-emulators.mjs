import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const configRoot = resolve(root, '.codex-tmp', 'firebase-config');
mkdirSync(configRoot, {recursive: true});
const result = spawnSync(process.execPath, [
    resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
    'emulators:exec', '--project', 'demo-purge-fence', '--only', 'firestore',
    'node --test functions/test/recovery-attempts.emulator.test.js'
], {cwd: root, env: {...process.env, XDG_CONFIG_HOME: configRoot}, stdio: 'inherit', shell: false});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
