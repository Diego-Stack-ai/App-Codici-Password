import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const configRoot = resolve(projectRoot, '.codex-tmp', 'firebase-config');
const firebaseCli = resolve(projectRoot, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
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
    // The Storage rules runtime resolves firestore.get()/exists() through the
    // loopback Firestore emulator. Keep that traffic out of cloud HTTP proxies;
    // otherwise an inherited uppercase NO_PROXY can override no_proxy and make
    // valid cross-service reads fail closed.
    env: {
      ...process.env,
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      http_proxy: '',
      https_proxy: '',
      NO_PROXY: '127.0.0.1,localhost,::1',
      no_proxy: '127.0.0.1,localhost,::1',
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
