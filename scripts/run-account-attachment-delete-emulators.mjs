import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// M7-T15: prova sul percorso reale di cancellazione dell'allegato con gli
// emulatori Firestore e Storage e le Rules di produzione. Stessa impostazione
// degli altri runner emulatrici (preload loopback per il dispatcher Storage).
const projectRoot = resolve(import.meta.dirname, '..');
const configRoot = resolve(projectRoot, '.codex-tmp', 'firebase-config');
const firebaseCli = resolve(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const loopbackPreload = resolve(projectRoot, 'scripts', 'storage-emulator-loopback-dispatcher.cjs');
const testFile = resolve(projectRoot, 'tests', 'account-attachment-delete.emulator.test.mjs');

mkdirSync(configRoot, {recursive: true});

const result = spawnSync(process.execPath, [
  firebaseCli,
  'emulators:exec',
  '--project',
  'codici-password-account-attachment-delete',
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
