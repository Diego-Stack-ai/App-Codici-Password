import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const helper = 'data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/shared/read-error-message.js', import.meta.url), 'utf8')).toString('base64');
const viewSource = (await readFile(new URL('./profile-shell-view.mjs', import.meta.url), 'utf8'))
    .replace("'./profile-section-reader.mjs'", JSON.stringify(new URL('./profile-section-reader.mjs', import.meta.url).href))
    .replace("'../../Frontend/public/assets/js/modules/shared/read-error-message.js'", JSON.stringify(helper));
const {mountProfileShell} = await import('data:text/javascript;base64,' + Buffer.from(viewSource).toString('base64'));
class Node extends EventTarget {
    constructor(tag) { super(); this.tag = tag; this.children = []; this.dataset = {}; this.textContent = ''; }
    setAttribute() {}
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    replaceChildren(...nodes) { this.children = []; this.textContent = ''; this.append(...nodes); }
    remove() { this.parent.children = this.parent.children.filter(node => node !== this); }
    querySelectorAll(tag) { return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag)]); }
}
globalThis.document = {createElement: tag => new Node(tag)};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() { return {root: new Node('root'), control: new AbortController()}; }

test('overview is the initial tab when provided and its action clears values before internal navigation', async () => {
    const f = fixture(), reads = [];
    const cleanup = await mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}}, {
        readOverview: async () => [{group: 'Panoramica', label: 'Email', value: 'private@example.invalid', target: 'contacts'}],
        readSection: async section => {reads.push(section); return [{group: section, label: 'Contatti', value: 'other'}];}
    });
    const value = f.root.querySelectorAll('dd').find(node => node.textContent === 'private@example.invalid');
    const label = f.root.querySelectorAll('dt')[0];
    assert.ok(value); assert.deepEqual(reads, []);
    f.root.querySelectorAll('button').find(node => node.textContent === 'Apri Contatti').dispatchEvent(new Event('click'));
    await tick(); assert.equal(value.textContent, ''); assert.equal(label.textContent, ''); assert.deepEqual(reads, ['contacts']); cleanup();
});

test('Widgets mount in an empty section and are disposed before a new tab starts', async () => {
    const f = fixture(); let stopped = false, oldSignal;
    const cleanup = await mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}}, {
        readSection: async () => [], mountWidgets: async (_root, {section, signal}) => {
            if (section === 'personal') {oldSignal = signal; return () => {stopped = true;};}
            assert.ok(stopped); assert.ok(oldSignal.aborted); return () => {};
        }
    });
    assert.ok(oldSignal); f.root.querySelectorAll('button').find(node => node.textContent === 'Contatti').dispatchEvent(new Event('click'));
    await tick(); assert.ok(stopped); cleanup();
});

test('a late Widget mount is disposed without replacing the next section cleanup', async () => {
    const f = fixture(); let release, oldClosed = 0, nextClosed = 0;
    const mounting = mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}}, {
        readSection: async () => [], mountWidgets: (_root, {section}) => section === 'personal'
            ? new Promise(resolve => {release = resolve;}) : Promise.resolve(() => {nextClosed++;})
    });
    await tick(); f.root.querySelectorAll('button').find(node => node.textContent === 'Contatti').dispatchEvent(new Event('click')); await tick();
    release(() => {oldClosed++;}); const cleanup = await mounting;
    assert.equal(oldClosed, 1); assert.equal(nextClosed, 0); cleanup(); assert.equal(nextClosed, 1);
});
test('safe text rendering and disposal clear detached plaintext and do not remove another view', async () => {
    const f = fixture();
    const cleanup = await mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}}, {readSection: async () => [{group: 'Anagrafica', label: 'Nome', value: '<img onerror=bad>'}]});
    const value = f.root.querySelectorAll('dd')[0]; assert.equal(value.textContent, '<img onerror=bad>'); assert.equal(value.children.length, 0);
    const newer = new Node('new'); f.root.append(newer); f.control.abort(); cleanup();
    assert.equal(value.textContent, ''); assert.deepEqual(f.root.children, [newer]);
});
test('rapid tab changes cannot render a late response from an older tab', async () => {
    const f = fixture(); let release;
    const cleanup = await mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}}, {readSection: async section => section === 'contacts' ? new Promise(resolve => { release = resolve; }) : [{group: section, label: 'Value', value: section}]});
    const buttons = f.root.querySelectorAll('button'); buttons[1].dispatchEvent(new Event('click')); buttons[2].dispatchEvent(new Event('click')); await tick();
    release([{group: 'old', label: 'old', value: 'stale-secret'}]); await tick();
    assert.deepEqual(f.root.querySelectorAll('dd').map(node => node.textContent), ['addresses']); cleanup();
});
test('pending data after lock never renders and old buttons cannot start another read', async () => {
    const f = fixture(); let release, reads = 0;
    const pending = mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}}, {readSection: () => { reads++; return new Promise(resolve => { release = resolve; }); }});
    const button = f.root.querySelectorAll('button')[1]; f.control.abort(); release([{group: 'secret', label: 'secret', value: 'late'}]); await pending;
    button.dispatchEvent(new Event('click')); await tick(); assert.equal(reads, 1); assert.equal(f.root.children.length, 0);
});

test('offline cache miss is explained without relabeling permission or decryption failures', async t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {onLine: false}});
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator; });
    for (const code of ['unavailable', 'permission-denied', 'DECRYPT_FAILED']) {
        const f = fixture();
        const cleanup = await mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}},
            {readSection: async () => { throw Object.assign(new Error('synthetic'), {code}); }});
        const message = f.root.children[0].children.at(-1).textContent;
        assert.equal(message.includes('non sono disponibili offline'), code === 'unavailable');
        cleanup();
    }
});

test('linked password is lazy, can be masked/copied and opens an Account through internal navigation', async t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator'), copies = [];
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {clipboard: {writeText: async value => copies.push(value)}}});
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator; });
    const f = fixture(), selection = {domain: 'company', id: 'account', companyId: 'company'};
    let reads = 0, opened;
    const cleanup = await mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}}, {
        readSection: async () => [{group: 'Email', label: 'Email', value: 'fixture', link: {}}],
        linkedAccounts: {readPassword: async () => { reads++; return 'synthetic-secret'; }, open: async () => selection},
        onOpenAccount: value => { opened = value; }
    });
    const find = label => f.root.querySelectorAll('button').find(node => node.textContent === label);
    const secret = f.root.querySelectorAll('dd').find(node => node.textContent === '••••••••');
    assert.equal(reads, 0);
    find('Mostra password').dispatchEvent(new Event('click')); await tick(); assert.equal(secret.textContent, 'synthetic-secret');
    find('Nascondi password').dispatchEvent(new Event('click')); await tick(); assert.equal(secret.textContent, '••••••••'); assert.equal(reads, 1);
    find('Copia password').dispatchEvent(new Event('click')); await tick(); assert.deepEqual(copies, ['synthetic-secret']); assert.equal(reads, 2);
    find('Apri Account collegato').dispatchEvent(new Event('click')); await tick(); assert.equal(opened, selection);
    cleanup(); assert.equal(secret.textContent, '');
});

for (const operation of ['Mostra password', 'Copia password', 'Apri Account collegato']) test(`late ${operation} has no effect after switching profile section`, async t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); let copies = 0, opened = 0, release;
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {clipboard: {writeText: async () => { copies++; }}}});
    t.after(() => { if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator; });
    const f = fixture(), pending = () => new Promise(resolve => { release = resolve; });
    const cleanup = await mountProfileShell(f.root, {unlocked: true, signal: f.control.signal, assertUnlocked() {}}, {
        readSection: async section => section === 'personal' ? [{group: 'Email', label: 'Email', value: 'fixture', link: {}}] : [],
        linkedAccounts: {readPassword: pending, open: pending}, onOpenAccount: () => { opened++; }
    });
    const button = f.root.querySelectorAll('button').find(node => node.textContent === operation);
    const oldSecret = f.root.querySelectorAll('dd').find(node => node.textContent === '••••••••');
    button.dispatchEvent(new Event('click')); await tick();
    f.root.querySelectorAll('button').find(node => node.textContent === 'Contatti').dispatchEvent(new Event('click'));
    await tick(); release('late-secret'); await tick();
    assert.equal(copies, 0); assert.equal(opened, 0); assert.equal(oldSecret.textContent, '');
    cleanup();
});
