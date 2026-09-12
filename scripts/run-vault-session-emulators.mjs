import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {mkdirSync, copyFileSync} from 'node:fs';
const root = resolve(import.meta.dirname, '..');
const laboratory = resolve(root, 'experiments/persistent-vault-shell');
const cli = resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js');
const browser = process.argv.includes('--browser');
if (process.argv.slice(2).some(arg => arg !== '--browser')) throw new Error('INVALID_ARGUMENT');
mkdirSync(resolve(laboratory, 'dist/emulators'), {recursive: true});
copyFileSync(resolve(root, 'firestore.rules'), resolve(laboratory, 'dist/emulators/firestore.rules'));
// A demo project cannot fall through to real Firebase resources.
const result = spawnSync(process.execPath, [cli, 'emulators:exec', '--project', 'demo-vault-shell',
    '--only', 'auth,firestore', '--config', 'firebase.emulators.json',
    browser ? 'node emulator-browser.mjs' : 'node --test firebase-session.test.mjs'], {cwd: laboratory, env: process.env, stdio: 'inherit', shell: false});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
