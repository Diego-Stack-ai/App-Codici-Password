import {copyFileSync, existsSync, mkdirSync, readdirSync, realpathSync, symlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';

// Generated isolated fixture: copy runtime JS/package only, never .env or real secrets.
// Default smoke creates no scadenze/invites/devices. Browser fixtures use only
// demo identities and contain no delivery recipients or device tokens.
const modes = new Set(['--vault-browser', '--vault-accounts', '--mfa-session-probe']);
if (process.argv.length > 3 || process.argv.slice(2).some(arg => !modes.has(arg))) throw new Error('INVALID_ARGUMENT');
const root = resolve(import.meta.dirname, '..');
const browser = process.argv.includes('--vault-browser');
const project = browser ? 'demo-vault-shell' : 'demo-codici-password';
const source = resolve(root, 'functions');
const fixture = resolve(root, '.codex-tmp/functions-local');
mkdirSync(fixture, {recursive: true});
copyFileSync(resolve(root, 'scripts/functions-emulator.synthetic.env'), resolve(fixture, '.secret.local'));
for (const entry of readdirSync(source, {withFileTypes: true})) {
  if (entry.isFile() && (entry.name.endsWith('.js') || entry.name === 'package.json')) {
    copyFileSync(resolve(source, entry.name), resolve(fixture, entry.name));
  }
}
const dependencies = resolve(source, 'node_modules');
const link = resolve(fixture, 'node_modules');
if (!existsSync(link)) symlinkSync(dependencies, link, 'junction');
if (realpathSync(link) !== realpathSync(dependencies)) throw new Error('Unexpected fixture dependency target');
const config = resolve(root, '.codex-tmp/functions-local-cli');
mkdirSync(config, {recursive: true});
const env = {...process.env, XDG_CONFIG_HOME: config,
  METADATA_SERVER_DETECTION: 'none',
  GCLOUD_PROJECT: project, GOOGLE_CLOUD_PROJECT: project,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: browser ? '127.0.0.1:8085' : '127.0.0.1:8080',
  FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001'};
delete env.GOOGLE_APPLICATION_CREDENTIALS;
delete env.FIREBASE_TOKEN;
const result = spawnSync(process.execPath, [resolve(root, 'node_modules/firebase-tools/lib/bin/firebase.js'),
  'emulators:exec', '--config', resolve(root, browser ? 'firebase.functions-browser-local.json' : 'firebase.functions-local.json'), '--project', project,
  '--only', 'auth,firestore,functions',
  browser ? `${JSON.stringify(process.execPath)} ${JSON.stringify(resolve(root, 'experiments/persistent-vault-shell/emulator-browser.mjs'))} --real-functions --test` : `${JSON.stringify(process.execPath)} ${JSON.stringify(resolve(root, process.argv.includes('--vault-accounts')
    ? 'scripts/test-vault-account-functions-emulator.mjs' : process.argv.includes('--mfa-session-probe')
      ? 'scripts/test-mfa-session-emulator.mjs' : 'scripts/test-functions-emulator.mjs'))}`],
{cwd: root, env, stdio: 'inherit', shell: false});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
