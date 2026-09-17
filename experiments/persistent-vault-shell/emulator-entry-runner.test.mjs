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
test('a browser that exits before the endpoint reports the browser identity and the sanitized stderr', async () => {
    const child = fakeBrowser();
    const pending = awaitDevToolsEndpoint(child, {timeoutMs: 200,
        describe: () => ({browser: 'edge', path: 'C:/Edge/msedge.exe', args: ['--headless=new'], exitCode: child.exitCode})});
    child.stderr.emit('data', Buffer.from('profile C:/Temp/codex-entry-browser-Ab12Cd is corrupt\n'));
    child.exit(0);
    await assert.rejects(pending, error => {
        assert.match(error.message, /DEVTOOLS_BROWSER_EXITED_BEFORE_ENDPOINT:0/);
        const detail = JSON.parse(error.message.slice(error.message.indexOf('{')));
        assert.equal(detail.browser, 'edge');
        assert.equal(detail.path, 'C:/Edge/msedge.exe');
        assert.equal(detail.exitCode, 0);
        assert.match(detail.stderr, /codex-entry-browser-<profile>/, 'the disposable profile token is redacted');
        assert.doesNotMatch(detail.stderr, /Ab12Cd/);
        return true;
    });
    assert.equal(child.listenerCount('exit'), 0, 'the failing wait detaches its listeners too');
});
test('a browser that never reports the endpoint times out', async () => {
    const child = fakeBrowser();
    await assert.rejects(awaitDevToolsEndpoint(child, {timeoutMs: 20}), /DEVTOOLS_ENDPOINT_TIMEOUT/);
    assert.equal(child.listenerCount('exit'), 0);
});
test('the matrix needs one identified result per browser and never counts one twice', () => {
    const browsers = [{name: 'chrome', path: 'chrome.exe'}, {name: 'edge', path: 'msedge.exe'}];
    const results = [{browser: 'chrome'}, {browser: 'edge'}];
    assert.deepEqual(assertEveryBrowserReported({browsers, results}), results);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [{browser: 'chrome'}]}),
        /ENTRY_BROWSER_RESULTS_MISSING:1\/2/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: []}), /ENTRY_BROWSER_RESULTS_MISSING:0\/2/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [{browser: 'chrome'}, {browser: 'chrome'}]}),
        /ENTRY_BROWSER_RESULT_DUPLICATED/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [undefined, {browser: 'edge'}]}),
        /ENTRY_BROWSER_RESULT_UNIDENTIFIED/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [{browser: 'firefox'}, {browser: 'edge'}]}),
        /ENTRY_BROWSER_RESULT_UNIDENTIFIED/);
});
// A2-R2: the identity of a result is the (browser, device profile) pair. The same
// pair must never be counted twice, and a result that does not say which device
// profile it came from is not accepted while profiles are in play.
test('the matrix counts each (browser, device profile) pair once', () => {
    const desktop = {name: 'desktop'}, mobile = {name: 'mobile'};
    const browsers = [{name: 'chrome', path: 'chrome.exe', profile: desktop}, {name: 'chrome', path: 'chrome.exe', profile: mobile},
        {name: 'edge', path: 'msedge.exe', profile: desktop}, {name: 'edge', path: 'msedge.exe', profile: mobile}];
    const results = [{browser: 'chrome', profile: 'desktop'}, {browser: 'chrome', profile: 'mobile'},
        {browser: 'edge', profile: 'desktop'}, {browser: 'edge', profile: 'mobile'}];
    assert.deepEqual(assertEveryBrowserReported({browsers, results}), results);
    assert.throws(() => assertEveryBrowserReported({browsers, results: results.slice(1)}), /ENTRY_BROWSER_RESULTS_MISSING:3\/4/);
    assert.equal(assertEveryBrowserReported({browsers: [{name: 'chrome', profile: desktop}], results: [{browser: 'chrome', profile: 'desktop'}]}).length, 1);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [results[0], results[1], results[2], results[0]]}),
        /ENTRY_BROWSER_RESULT_DUPLICATED/, 'the same browser with the same profile is never counted twice');
    assert.throws(() => assertEveryBrowserReported({browsers,
        results: [{browser: 'chrome', profile: 'tablet'}, results[1], results[2], results[3]]}),
        /ENTRY_BROWSER_RESULT_UNIDENTIFIED/, 'an unexpected device profile is not accepted');
    assert.throws(() => assertEveryBrowserReported({browsers, results: [{browser: 'chrome'}, results[1], results[2], results[3]]}),
        /ENTRY_BROWSER_RESULT_UNIDENTIFIED/, 'a result without the device profile identity is not accepted');
});
