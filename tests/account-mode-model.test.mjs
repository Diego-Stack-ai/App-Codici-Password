import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/shared/account-mode-model.js', import.meta.url), 'utf8');
const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('riconosce i quattro modi canonici anche dai record storici', () => {
    assert.equal(model.accountModeFromRecord({}), model.ACCOUNT_MODES.PRIVATE);
    assert.equal(model.accountModeFromRecord({ visibility: 'shared' }), model.ACCOUNT_MODES.SHARED);
    assert.equal(model.accountModeFromRecord({ type: 'memorandum' }), model.ACCOUNT_MODES.MEMO_PRIVATE);
    assert.equal(model.accountModeFromRecord({ type: 'memo', visibility: 'shared' }), model.ACCOUNT_MODES.MEMO_SHARED);
    assert.equal(model.accountModeFromRecord({ isMemoShared: true }), model.ACCOUNT_MODES.MEMO_SHARED);
    assert.equal(model.accountModeFromRecord({ hasMemo: true }), model.ACCOUNT_MODES.MEMO_PRIVATE);
});

test('non consente credenziali nei memorandum', () => {
    for (const mode of [model.ACCOUNT_MODES.MEMO_PRIVATE, model.ACCOUNT_MODES.MEMO_SHARED]) {
        assert.deepEqual(model.validateAccountMode(mode, { username: 'diego' }), {
            valid: false,
            reason: 'memo-has-credentials'
        });
    }
});

test('gli account possono essere privi di credenziali, come i memorandum', () => {
    assert.equal(model.validateAccountMode(model.ACCOUNT_MODES.PRIVATE, {}).valid, true);
    assert.equal(model.validateAccountMode(model.ACCOUNT_MODES.SHARED, {}).valid, true);
    assert.equal(model.validateAccountMode(model.ACCOUNT_MODES.SHARED, { codice: '123' }).valid, true);
    assert.equal(model.validateAccountMode(model.ACCOUNT_MODES.PRIVATE, { password: 'secret' }).valid, true);
    assert.equal(model.validateAccountMode(model.ACCOUNT_MODES.MEMO_PRIVATE, {}).valid, true);
    assert.equal(model.validateAccountMode(model.ACCOUNT_MODES.MEMO_SHARED, {}).valid, true);
});

test('cambiare tipo da una modalita condivisa revoca i destinatari esistenti', () => {
    assert.equal(model.sharedModeTransitionRevokesRecipients(
        model.ACCOUNT_MODES.SHARED,
        model.ACCOUNT_MODES.MEMO_SHARED
    ), true);
    assert.equal(model.sharedModeTransitionRevokesRecipients(
        model.ACCOUNT_MODES.MEMO_SHARED,
        model.ACCOUNT_MODES.MEMO_PRIVATE
    ), true);
    assert.equal(model.sharedModeTransitionRevokesRecipients(
        model.ACCOUNT_MODES.SHARED,
        model.ACCOUNT_MODES.SHARED
    ), false);
    assert.equal(model.sharedModeTransitionRevokesRecipients(
        model.ACCOUNT_MODES.PRIVATE,
        model.ACCOUNT_MODES.SHARED
    ), false);
});

test('la conversione in campi persistiti è deterministica', () => {
    assert.deepEqual(model.recordFieldsFromAccountMode(model.ACCOUNT_MODES.MEMO_SHARED), {
        type: 'memo',
        visibility: 'shared'
    });
});

test('riepiloga e filtra i quattro modi senza contare gli archiviati', () => {
    const accounts = [
        {id: 'standard'},
        {id: 'shared', visibility: 'shared'},
        {id: 'memo', type: 'memo'},
        {id: 'shared-memo', type: 'memorandum', visibility: 'shared'},
        {id: 'archived', type: 'memo', isArchived: true},
        {id: 'archived-legacy', visibility: 'shared', isArchived: 1}
    ];
    assert.deepEqual(model.summarizeAccountModes(accounts), {
        standard: 1,
        shared: 1,
        memo: 1,
        shared_memo: 1
    });
    assert.deepEqual(accounts.filter(account => model.accountMatchesModeView(account, 'memo')).map(account => account.id), ['memo', 'archived']);
    assert.equal(model.accountMatchesModeView(accounts[1], 'unknown'), true);
    assert.equal(model.normalizeAccountModeView(' SHARED_MEMO '), 'shared_memo');
});

test('i conteggi spostano il record nella categoria condivisa senza duplicarlo', () => {
    const account = {id: 'account', type: 'account', visibility: 'private'};
    const memorandum = {id: 'memo', type: 'memo', visibility: 'private'};
    assert.deepEqual(model.summarizeAccountModes([account, memorandum]), {
        standard: 1,
        shared: 0,
        memo: 1,
        shared_memo: 0
    });

    account.visibility = 'shared';
    memorandum.visibility = 'shared';
    assert.deepEqual(model.summarizeAccountModes([account, memorandum]), {
        standard: 0,
        shared: 1,
        memo: 0,
        shared_memo: 1
    });
});
