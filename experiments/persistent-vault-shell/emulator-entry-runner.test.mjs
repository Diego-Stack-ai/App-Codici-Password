import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {assertEveryBrowserReported, awaitDevToolsEndpoint} from './emulator-network-control.mjs';

// Deterministic regression for the endpoint/exit race of the entry runner: a
// browser that closes after the endpoint has been received is a normal close, and
// a missing browser outcome must never be silently accepted.
const fakeBrowser = () => {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.exitCode = null;
    child.exit = code => {child.exitCode = code; child.emit('exit', code);};
    return child;
};
const endpointLine = 'DevTools listening on ws://127.0.0.1:9333/devtools/browser/fixture\n';
test('the endpoint is awaited once and reported', async () => {
    const child = fakeBrowser();
    const pending = awaitDevToolsEndpoint(child, {timeoutMs: 200});
    child.stderr.emit('data', Buffer.from(endpointLine));
    assert.equal(await pending, 'ws://127.0.0.1:9333/devtools/browser/fixture');
});
test('a close after the endpoint is not an early exit and never rejects the wait', async () => {
    const child = fakeBrowser();
    const pending = awaitDevToolsEndpoint(child, {timeoutMs: 200});
    child.stderr.emit('data', Buffer.from('not the endpoint yet\n'));
    child.stderr.emit('data', Buffer.from(endpointLine));
    assert.match(await pending, /^ws:\/\//);
    // The listeners are detached: the later normal close stays silent, and no
    // second settlement or unhandled rejection can come out of it.
    child.exit(0);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(child.listenerCount('exit'), 0);
    assert.equal(child.stderr.listenerCount('data'), 0);
});
test('a browser that exits before the endpoint is a real error, not a silent pass', async () => {
    const child = fakeBrowser();
    const pending = awaitDevToolsEndpoint(child, {timeoutMs: 200});
    child.exit(0);
    await assert.rejects(pending, /DEVTOOLS_BROWSER_EXITED_BEFORE_ENDPOINT:0/);
    assert.equal(child.listenerCount('exit'), 0, 'the failing wait detaches its listeners too');
});
test('a browser that never reports the endpoint times out', async () => {
    const child = fakeBrowser();
    await assert.rejects(awaitDevToolsEndpoint(child, {timeoutMs: 20}), /DEVTOOLS_ENDPOINT_TIMEOUT/);
    assert.equal(child.listenerCount('exit'), 0);
});
test('the matrix fails when one browser of the two never reported', () => {
    const browsers = ['chrome', 'edge'];
    assert.deepEqual(assertEveryBrowserReported({browsers, results: ['chrome', 'edge']}), ['chrome', 'edge']);
    assert.throws(() => assertEveryBrowserReported({browsers, results: ['chrome']}), /ENTRY_BROWSER_RESULTS_MISSING:1\/2/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: []}), /ENTRY_BROWSER_RESULTS_MISSING:0\/2/);
});
