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

test('un account condiviso richiede almeno una credenziale', () => {
    assert.equal(model.validateAccountMode(model.ACCOUNT_MODES.SHARED, {}).reason, 'shared-account-without-credentials');
    assert.equal(model.validateAccountMode(model.ACCOUNT_MODES.SHARED, { codice: '123' }).valid, true);
});

test('la conversione in campi persistiti è deterministica', () => {
    assert.deepEqual(model.recordFieldsFromAccountMode(model.ACCOUNT_MODES.MEMO_SHARED), {
        type: 'memo',
        visibility: 'shared'
    });
});
