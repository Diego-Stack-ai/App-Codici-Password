import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const configRoot = resolve(projectRoot, '.codex-tmp', 'firebase-config');
const firebaseCli = resolve(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const loopbackPreload = resolve(projectRoot, 'scripts', 'storage-emulator-loopback-dispatcher.cjs');
const productionTest = resolve(projectRoot, 'tests', 'storage.rules.test.mjs');
const sharingTest = resolve(projectRoot, 'tests', 'sharing-prototype.storage.rules.test.mjs');

mkdirSync(configRoot, {recursive: true});

function run(projectId, emulators, testFile) {
  const result = spawnSync(process.execPath, [
    firebaseCli,
    'emulators:exec',
    '--project',
    projectId,
    '--only',
    emulators,
    `${JSON.stringify(process.execPath)} --test ${JSON.stringify(testFile)}`,
  ], {
    cwd: projectRoot,
    // firebase-tools apiv2 creates ProxyAgent directly and ignores NO_PROXY.
    // The preload sends only exact loopback origins directly; every other
    // destination keeps using the original ProxyAgent and inherited settings.
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
  return result.status ?? 1;
}

const productionStatus = run('codici-password-rules-test', 'storage', productionTest);
if (productionStatus !== 0) process.exit(productionStatus);
process.exit(run('codici-password-sharing-storage-test', 'firestore,storage', sharingTest));
