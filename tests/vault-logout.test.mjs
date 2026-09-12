import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../Frontend/public/assets/js/', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const securitySource = await read('modules/core/security-manager.js');
const sessionSource = await read('modules/core/vault-session.js');
const authSource = await read('auth.js');

// Run the real module bodies with browser/Firebase boundaries replaced; no network.
function moduleBody(source) {
    return source.replace(/^import\s+[\s\S]*?;\s*$/gm, '')
        .replace(/^export\s*\{[^}]*\};?/gm, '')
        .replace(/^export /gm, '')
        .replace(/\bimport\(/g, 'loadModule(');
}

function storage() {
    const values = new Map();
    return {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
}

test('every explicit application signOut has preceding Vault cleanup', async () => {
    async function walk(directory) {
        const entries = await readdir(directory, {withFileTypes: true});
        const nested = await Promise.all(entries.filter(e => e.name !== 'vendor').map(e => {
            const url = new URL(e.name + (e.isDirectory() ? '/' : ''), directory);
            return e.isDirectory() ? walk(url) : [url];
        }));
        return nested.flat().filter(url => url.pathname.endsWith('.js'));
    }
    let count = 0;
    for (const file of await walk(root)) {
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(/\bawait signOut\(auth\)/g)) {
            count++;
            const before = source.slice(0, match.index).replace(/\/\/[^\n]*/g, '');
            assert.match(before, /clearSession\(\);\s*(?:try\s*\{\s*)?$/, file.pathname);
        }
    }
    assert.equal(count, 7, 'Review the logout inventory when adding/removing a route');
});

for (const fails of [false, true]) {
    test(`logout clears real Vault RAM/storage before Firebase ${fails ? 'failure' : 'success'}`, async () => {
        const sessionStorage = storage();
        const localStorage = storage();
        for (const key of ['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry']) {
            sessionStorage.setItem(key, 'synthetic-fixture');
        }
        sessionStorage.setItem('unrelated', 'keep');
        const session = vm.createContext({sessionStorage});
        vm.runInContext(moduleBody(sessionSource), session);
        const security = vm.createContext({
            localStorage, auth: {}, onAuthStateChanged() {},
            clearVaultSession: () => vm.runInContext('clearVaultSession()', session)
        });
        vm.runInContext(moduleBody(securitySource), security);
        vm.runInContext("_vaultKeyMaterial = 'synthetic-fixture'; _vaultAutoUnlock = true;", security);
        const calls = [];
        const window = {location: {href: 'home_page.html'}};
        const context = vm.createContext({
            window, auth: {},
            loadModule: async path => {
                assert.equal(path, './modules/core/security-manager.js');
                return {clearSession: () => vm.runInContext('clearSession()', security)};
            },
            signOut: async () => {
                calls.push('signOut');
                assert.equal(vm.runInContext('_vaultKeyMaterial', security), null);
                assert.equal(vm.runInContext('_vaultAutoUnlock', security), false);
                for (const key of ['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry']) {
                    assert.equal(sessionStorage.getItem(key), null);
                }
                if (fails) throw new Error('synthetic-signout-failure');
            },
            logError() { calls.push('error'); }, showToast() { calls.push('toast'); }
        });
        vm.runInContext(moduleBody(authSource), context);
        await vm.runInContext('logout()', context);
        assert.deepEqual(calls, fails ? ['signOut', 'error', 'toast'] : ['signOut']);
        assert.equal(window.location.href, fails ? 'home_page.html' : 'login-v115.html');
        assert.equal(sessionStorage.getItem('unrelated'), 'keep');
    });
}
