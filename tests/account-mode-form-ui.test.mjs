import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const uiSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/account-mode-model.js', import.meta.url), 'utf8');
const ui = await import(`data:text/javascript;base64,${Buffer.from(uiSource).toString('base64')}`);

const modes = {
    'account-private': 'flag-account',
    'account-shared': 'flag-shared',
    'memo-private': 'flag-memo',
    'memo-shared': 'flag-memo-shared'
};

function fixture() {
    const hidden = new Map();
    const cards = Object.fromEntries(Object.entries(modes).map(([mode, id]) => [id, {
        mode,
        classList: {toggle(name, value) { if (name === 'hidden') hidden.set(mode, value); }}
    }]));
    const flags = Object.fromEntries(Object.values(modes).map(id => [id, {
        id,
        checked: false,
        closest: () => cards[id]
    }]));
    const container = {classList: {remove(name) { if (name === 'hidden') hidden.set('container', false); }}};
    return {
        hidden,
        flags,
        root: {getElementById: id => id === 'account-mode-edit-controls' ? container : flags[id] || null}
    };
}

test('in modifica mostra sempre le tre alternative e nasconde soltanto il modo corrente', () => {
    for (const currentMode of Object.keys(modes)) {
        const {hidden, flags, root} = fixture();
        ui.selectAccountMode(currentMode, root);
        ui.showAccountModeAlternatives(currentMode, {editing: true, root});

        assert.equal(hidden.get(currentMode), true);
        assert.equal([...hidden.entries()].filter(([mode, value]) => mode !== 'container' && value === false).length, 3);
        assert.equal(Object.values(flags).filter(flag => flag.checked).map(flag => flag.id).join(','), modes[currentMode]);
        assert.equal(hidden.get('container'), false);
    }
});

test('in creazione Account resta implicito e sono proposte le altre tre modalita', () => {
    const {hidden, root} = fixture();
    ui.showAccountModeAlternatives('account-private', {root});
    assert.equal(hidden.get('account-private'), true);
    assert.equal([...hidden.entries()].filter(([mode, value]) => mode !== 'container' && value === false).length, 3);
});

test('i due moduli espongono lo stesso gruppo atomico di quattro modalita', async () => {
    for (const type of ['privato', 'azienda']) {
        const html = await readFile(new URL(`../Frontend/public/form_account_${type}.html`, import.meta.url), 'utf8');
        const group = html.match(/<div id="account-mode-edit-controls"[\s\S]*?<div id="shared-management"/)?.[0] || '';
        for (const [mode, id] of Object.entries(modes)) {
            assert.match(group, new RegExp(`data-account-mode-choice="${mode}"[\\s\\S]*?id="${id}"`));
        }
        assert.match(group, /account-mode-edit-controls" class="flex-col-gap hidden"/);
    }
});
