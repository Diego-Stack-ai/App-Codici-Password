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
