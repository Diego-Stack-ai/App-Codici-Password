import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
const root = new URL('../Frontend/public/', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

class Element {
    constructor(tag) { this.tagName = tag; this.attrs = {}; this.children = []; }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    appendChild(child) { this.children.push(child); }
}
const dom = await import('data:text/javascript;base64,' + Buffer.from(await read('assets/js/dom-utils.js')).toString('base64'));
test('dynamic local fields opt out while explicit credentials and OTP retain their semantics', () => {
    const previousDocument = globalThis.document, previousNode = globalThis.Node;
    globalThis.Node = Element;
    globalThis.document = {createElement: tag => new Element(tag)};
    try {
        for (const type of ['text', 'email', 'tel', 'url', 'search', 'number']) {
            const input = dom.createElement('input', {type});
            assert.equal(input.attrs.autocomplete, 'off');
            assert.equal(input.attrs['data-form-type'], 'other');
            assert.equal(input.attrs['data-bwignore'], 'true');
        }
        assert.equal(dom.createElement('textarea').attrs['data-form-type'], 'other');
        for (const autocomplete of ['username', 'current-password', 'new-password', 'one-time-code']) {
            const input = dom.createElement('input', {type: 'text', autocomplete});
            assert.equal(input.attrs.autocomplete, autocomplete);
            assert.equal(input.attrs['data-form-type'], undefined);
        }
    } finally { globalThis.document = previousDocument; globalThis.Node = previousNode; }
});

test('only actual login or Account credentials use password inputs in HTML', async () => {
    const allowed = new Set(['login-v115.html', 'registrati.html', 'imposta_nuova_password.html', 'form_account_privato.html', 'form_account_azienda.html']);
    for (const file of (await readdir(root)).filter(f => f.endsWith('.html'))) {
        const source = await read(file);
        assert.doesNotMatch(source, /user_login_trap|password_trap/, file);
        if (!allowed.has(file)) assert.doesNotMatch(source, /<input\b[^>]*type="password"/, file);
    }
    for (const area of ['privato', 'azienda']) {
        const source = await read(`form_account_${area}.html`);
        assert.match(source, /id="account-username"[^>]*autocomplete="username"/);
        assert.match(source, /id="account-password"[^>]*type="password"[^>]*autocomplete="current-password"/);
        assert.doesNotMatch(source.match(/<input\b[^>]*id="account-code"[^>]*>/)[0], /data-form-type="other"/);
    }
    assert.match(await read('login-v115.html'), /id="password"[^>]*autocomplete="current-password"/);
});

test('widgets and banking never become password fields when shown or hidden', async () => {
    for (const path of ['shared/account-embedded-widgets.js', 'shared/account-banking-view.js', 'shared/banking-renderer.js', 'azienda/ma_cards.js', 'azienda/ma_ui.js', 'privato/profilo-modal.js']) {
        const source = await read('assets/js/modules/' + path);
        assert.doesNotMatch(source, /autocomplete: 'new-password'|type: 'password'|\.type\s*=.*'password'|password_trap/, path);
    }
    assert.match(await read('assets/css/core_ui.css'), /\.local-data-masked\s*\{\s*-webkit-text-security: disc/);
    const widget = await read('assets/js/modules/shared/account-embedded-widgets.js');
    assert.match(widget, /input\.classList\.toggle\('local-data-masked', revealed\)/);
    assert.match(widget, /fields: editableWidgets\[index\]/);
});

test('master entry and visibility remain text inputs rather than login credentials', async () => {
    const source = await read('assets/js/ui-core-v129.js');
    const modal = source.slice(source.indexOf('export function showInputModal'), source.indexOf('export function toggleTripleVisibility'));
    assert.match(modal, /type: 'text'/);
    assert.match(modal, /autocomplete: 'off'/);
    assert.match(modal, /'data-form-type': 'other'/);
    assert.match(modal, /classList\.toggle\('vault-secret-input'\)/);
    assert.doesNotMatch(modal, /type: 'password'|\.type\s*=/);
});
