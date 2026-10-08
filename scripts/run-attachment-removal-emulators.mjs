import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// M7-T26: prove del residuo degli allegati sugli emulatori Firestore e Storage.
const projectRoot = resolve(import.meta.dirname, '..');
const configRoot = resolve(projectRoot, '.codex-tmp', 'firebase-config');
const firebaseCli = resolve(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const loopbackPreload = resolve(projectRoot, 'scripts', 'storage-emulator-loopback-dispatcher.cjs');
const testFile = resolve(projectRoot, 'tests', 'attachment-removal-residues.emulator.test.mjs');

mkdirSync(configRoot, {recursive: true});

const result = spawnSync(process.execPath, [
  firebaseCli,
  'emulators:exec',
  '--project',
  'codici-password-attachment-removal',
  '--only',
  'firestore,storage',
  `${JSON.stringify(process.execPath)} --test ${JSON.stringify(testFile)}`,
], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${JSON.stringify(loopbackPreload)}`].filter(Boolean).join(' '),
    STORAGE_EMULATOR_LOOPBACK_DIRECT: '1',
    XDG_CONFIG_HOME: configRoot,
  },
  stdio: 'inherit',
  shell: false,
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
