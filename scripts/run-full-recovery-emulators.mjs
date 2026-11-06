import {existsSync, mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve, delimiter} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dependencyRoot = existsSync(resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js')) ? root : resolve(root, '../..');
const scratch = resolve(root, '.codex-tmp/full-recovery');
mkdirSync(scratch, {recursive: true});
const temporaryRoot = resolve(scratch, 'temp');
mkdirSync(temporaryRoot, {recursive: true});
const config = resolve(scratch, 'firebase.json');
const firestoreRules = resolve(scratch, 'firestore.rules'), storageRules = resolve(scratch, 'storage.rules');
writeFileSync(firestoreRules, readFileSync(resolve(dependencyRoot, 'firestore.rules')));
writeFileSync(storageRules, readFileSync(resolve(dependencyRoot, 'storage.rules')));
writeFileSync(config, JSON.stringify({firestore: {rules: firestoreRules}, storage: {rules: storageRules}, emulators: {firestore: {host: '127.0.0.1', port: 18091}, storage: {host: '127.0.0.1', port: 19191}, hub: {host: '127.0.0.1', port: 14491}, logging: {host: '127.0.0.1', port: 14591}, ui: {enabled: false}, singleProjectMode: true}}));
const preload = resolve(dependencyRoot, 'scripts/storage-emulator-loopback-dispatcher.cjs');
const selection = process.argv.includes('--lifecycle-only') ? ' --test-name-pattern=lifecycle' : process.argv.includes('--abort-only') ? ' --test-name-pattern=abortChecking' : process.argv.includes('--client-only') ? ' --test-name-pattern=actual.client.coordinator' : '';
const result = spawnSync(process.execPath, [resolve(dependencyRoot, 'node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--config', config, '--project', 'demo-full-recovery-publisher', '--only', 'firestore,storage', `${JSON.stringify(process.execPath)} --test${selection} ${JSON.stringify(resolve(root, 'tests/full-recovery-publisher.emulator.test.mjs'))}`], {cwd: scratch, stdio: 'inherit', shell: false, env: {...process.env,
  NODE_PATH: [resolve(dependencyRoot, 'functions/node_modules'), resolve(dependencyRoot, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(delimiter),
  NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${JSON.stringify(preload)}`].filter(Boolean).join(' '), STORAGE_EMULATOR_LOOPBACK_DIRECT: '1', XDG_CONFIG_HOME: resolve(scratch, 'firebase-config'), TEMP: temporaryRoot, TMP: temporaryRoot, FULL_RECOVERY_DEPENDENCY_ROOT: dependencyRoot}});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
