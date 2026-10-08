import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('local runner rejects unknown or combined modes before emulator startup', () => {
    const script = fileURLToPath(new URL('../scripts/run-functions-emulator-local.mjs', import.meta.url));
    for (const args of [['--production'], ['--vault-browser', '--vault-accounts'], ['--vault-browser', '--vault-browser']]) {
        const result = spawnSync(process.execPath, [script, ...args], {encoding: 'utf8', timeout: 10000});
        assert.equal(result.error, undefined);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /INVALID_ARGUMENT/);
        assert.doesNotMatch(result.stdout, /Starting emulators/);
    }
});
