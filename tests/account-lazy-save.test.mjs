import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

for (const kind of ['privato', 'azienda']) {
    const source = await readFile(new URL(`../Frontend/public/assets/js/modules/${kind}/form_account_${kind}.js`, import.meta.url), 'utf8');
    const name = kind === 'privato' ? 'savePrivateAccount' : 'saveAccount';
    const start = source.indexOf(`async function ${name}(`);
    const end = source.indexOf('\nimport ', start);
    const code = source.slice(start, end).replaceAll(/import\('[^']+'\)/g, 'loadModule()');
    const fixture = loader => {
        const messages = [], button = {disabled: true}, context = {};
        const scope = {loadModule: loader, mountEpoch: 1, markerConfirmed: true,
            loadContext: context, isAccountSaveAllowed: c => c === context,
            showToast: (...args) => messages.push(args), document: {getElementById: () => button}};
        vm.runInNewContext(code, scope);
        return {scope, context, messages, button};
    };
    test(`${kind}: lazy save forwards the original context`, async () => {
        let received;
        const f = fixture(async () => ({[name]: args => {received = args;}}));
        const args = {loadContext: f.context};
        await f.scope[name](args);
        assert.equal(received, args);
    });
    test(`${kind}: failed import allows retry without a write`, async () => {
        const f = fixture(async () => {throw new Error('synthetic');});
        await f.scope[name]({loadContext: f.context, isActive: () => true});
        assert.equal(f.button.disabled, false);
        assert.equal(f.messages.length, 1);
    });
    test(`${kind}: late import failure cannot change the next screen`, async () => {
        let reject;
        const f = fixture(() => new Promise((_resolve, fail) => {reject = fail;}));
        let active = true;
        const pending = f.scope[name]({loadContext: f.context, isActive: () => active});
        active = false;
        f.scope.loadContext = {};
        reject(new Error('synthetic'));
        await pending;
        assert.equal(f.button.disabled, true);
        assert.equal(f.messages.length, 0);
    });
    if (kind === 'azienda') test('late archive module cannot archive after remount', async () => {
        let release, calls = 0;
        const f = fixture(() => new Promise(resolve => {release = resolve;}));
        const pending = f.scope.deleteAccount({currentDocId: 'synthetic-a'});
        f.scope.mountEpoch++;
        release({deleteAccount: () => {calls++;}});
        await pending;
        assert.equal(calls, 0);
    });
}
