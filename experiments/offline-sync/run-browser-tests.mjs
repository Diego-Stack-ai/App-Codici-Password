import {createServer} from 'node:http';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {resolve, relative, dirname, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {build} from 'esbuild';

// Synthetic data and disposable browser profile. Optional backend is emulator-only.
const browserPath = process.argv[2];
const backendMode = ['--backend', '--private-backend'].includes(process.argv[3]);
const noLocks = process.argv[3] === '--no-locks';
if (!browserPath || (process.argv.length !== 3 && !(process.argv.length === 4 && (backendMode || noLocks)))) throw new Error('Usage: node run-browser-tests.mjs <browser-executable> [--backend|--private-backend|--no-locks]');
const bridge = backendMode ? await (await import('./emulated-backend-bridge.mjs')).createEmulatedBackendBridge({privateAccounts: process.argv[3] === '--private-backend'}) : null;
const root = resolve(import.meta.dirname, '../..');
const sdkBundle = backendMode ? (await build({absWorkingDir: root, bundle: true, write: false, format: 'esm', platform: 'browser',
    stdin: {resolveDir: root, contents: `export {initializeApp, deleteApp} from 'firebase/app';
        export {initializeAuth, inMemoryPersistence, connectAuthEmulator, signInWithEmailAndPassword, signOut, onAuthStateChanged} from 'firebase/auth';
        export {getFunctions, connectFunctionsEmulator} from 'firebase/functions';
        export {getFirestore, connectFirestoreEmulator, terminate} from 'firebase/firestore';
        export {initializeAppCheck, CustomProvider} from 'firebase/app-check';
        export {createFirebaseFencedQueueClient} from './experiments/offline-sync/firebase-fenced-queue-client.mjs';
        export {createProtectedSession} from './experiments/persistent-vault-shell/protected-session.mjs';
        export {createPrivateNotePanelProvider} from './experiments/persistent-vault-shell/private-note-panel-provider.mjs';
        export {createFirebasePrivateNoteSource} from './experiments/persistent-vault-shell/firebase-private-note-source.mjs';
        export {createMemoryVault} from './experiments/persistent-vault-shell/memory-vault.mjs';`}})).outputFiles[0].text : null;
const paths = new Map([
    ['/suite.mjs', noLocks ? 'experiments/offline-sync/browser-no-locks.mjs'
        : backendMode ? 'experiments/offline-sync/browser-backend-sync.mjs' : 'experiments/offline-sync/browser-coordination.mjs'],
    ['/compatible-queue-reader.mjs', 'experiments/offline-sync/compatible-queue-reader.mjs'],
    ['/fenced-queue-writer.mjs', 'experiments/offline-sync/fenced-queue-writer.mjs'],
    ['/fenced-queue-client.mjs', 'experiments/offline-sync/fenced-queue-client.mjs'],
    ['/offline-save-panel.mjs', 'experiments/offline-sync/offline-save-panel.mjs'],
    ['/conflict-note-review.mjs', 'experiments/offline-sync/conflict-note-review.mjs'],
    ['/conflict-note-proposal.mjs', 'experiments/offline-sync/conflict-note-proposal.mjs'],
    ['/persistent-vault-shell/prepare-private-account-mutation.mjs', 'experiments/persistent-vault-shell/prepare-private-account-mutation.mjs'],
    ['/persistent-vault-shell/prepare-private-account-patch.mjs', 'experiments/persistent-vault-shell/prepare-private-account-patch.mjs'],
    ['/Frontend/public/assets/js/modules/data/offline-mutation-sync.js', 'Frontend/public/assets/js/modules/data/offline-mutation-sync.js'],
    ['/Frontend/public/assets/js/modules/data/offline-mutation-queue.js', 'Frontend/public/assets/js/modules/data/offline-mutation-queue.js'],
    ['/worker.mjs', 'experiments/offline-sync/browser-coordination-worker.mjs'],
    ['/hybrid-queue-coordinator.mjs', 'experiments/offline-sync/hybrid-queue-coordinator.mjs'],
    ['/indexeddb-queue-lease.mjs', 'experiments/offline-sync/indexeddb-queue-lease.mjs'],
    ['/queue.js', 'Frontend/public/assets/js/modules/data/offline-mutation-queue.js'],
    ['/crypto-utils.js', 'Frontend/public/assets/js/modules/core/crypto-utils.js']
]);
let accept, reject, child, timer;
const result = new Promise((resolveResult, rejectResult) => { accept = resolveResult; reject = rejectResult; });
const server = createServer(async (request, response) => {
    try {
        if (bridge && await bridge.handle(request, response)) return;
        if (request.url === '/firebase-queue.mjs' && sdkBundle) {
            response.setHeader('Content-Type', 'text/javascript'); response.end(sdkBundle); return;
        }
        if (request.url === '/result' && request.method === 'POST') {
            let body = '';
            for await (const chunk of request) { body += chunk; if (body.length > 16000) throw new Error('RESULT_TOO_LARGE'); }
            const value = JSON.parse(body); response.end('ok'); accept(value); return;
        }
        response.setHeader('Cache-Control', 'no-store');
        if (request.url === '/') {
            response.setHeader('Content-Type', 'text/html');
            response.end('<!doctype html><meta charset="utf-8"><title>Offline synthetic tests</title><script type="module" src="/suite.mjs"></script>'); return;
        }
        if (!paths.has(request.url)) { response.writeHead(404).end(); return; }
        response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(resolve(root, paths.get(request.url))));
    } catch { response.writeHead(500).end(); reject(new Error('LOCAL_TEST_SERVER_FAILED')); }
});
const tempRoot = resolve(tmpdir());
const profile = await mkdtemp(resolve(tempRoot, 'codex-offline-browser-'));
try {
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const sandboxArgs = process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : [];
    child = spawn(browserPath, ['--headless=new', ...sandboxArgs, '--disable-gpu', '--no-first-run', '--disable-sync',
        '--disable-background-networking', `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/`],
    {windowsHide: true, stdio: 'ignore'});
    child.on('error', reject);
    child.on('exit', code => { if (code) reject(new Error('BROWSER_EXITED')); });
    timer = setTimeout(() => reject(new Error('BROWSER_TEST_TIMEOUT')), 45000);
    const report = await result;
    if (report.ok !== true || !Array.isArray(report.passed)) throw new Error(JSON.stringify(report));
    console.log(JSON.stringify(report, null, 2));
} finally {
    clearTimeout(timer);
    child?.kill();
    server.closeAllConnections(); // Also release deliberately held SDK test responses on failure.
    await new Promise(done => server.close(done));
    await bridge?.close();
    const local = relative(tempRoot, profile);
    // The only recursive removal is the exact temporary profile created above.
    if (dirname(profile) === tempRoot && local.startsWith('codex-offline-browser-') && !local.includes(sep)) {
        await rm(profile, {recursive: true, force: true, maxRetries: 10, retryDelay: 100}).catch(() => {
            console.error('Disposable browser profile still in use; left in system temp.');
        });
    }
}
