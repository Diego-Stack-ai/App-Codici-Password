import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const guardSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/credential-decrypt-guard.js', import.meta.url), 'utf8');
const {
    DECRYPT_FAILURE_MESSAGE, accountSaveBlockedReason, assertAccountSaveAllowed,
    createAccountLoadContext, isAccountSaveAllowed
} = await import(`data:text/javascript;base64,${Buffer.from(guardSource).toString('base64')}`);

test('token 0 non e mai valido: nessun READY senza beginLoad', () => {
    const context = createAccountLoadContext({mode: 'edit'});
    assert.equal(context.generation, 0);
    assert.equal(context.isPending(), true);
    assert.equal(context.isCurrent(0), false);
    assert.equal(context.markLoaded(0), false);
    assert.equal(context.markFailed(0, 'ACCOUNT_DECRYPT_FAILED'), false);
    assert.equal(context.isPending(), true);
    assert.equal(isAccountSaveAllowed(context), false);
    const token = context.beginLoad();
    assert.equal(token, 1);
    assert.equal(context.markLoaded(token), true);
});

test('modalita: creazione pronta, modifica in attesa', () => {
    assert.equal(isAccountSaveAllowed(createAccountLoadContext({mode: 'create'})), true);
    assert.equal(accountSaveBlockedReason(createAccountLoadContext()), 'ACCOUNT_LOAD_PENDING');
});

test('FAILED e sticky: markLoaded false finche non c e un nuovo beginLoad', () => {
    const context = createAccountLoadContext({mode: 'edit'});
    const token = context.beginLoad();
    assert.equal(context.markFailed(token, 'ACCOUNT_DECRYPT_FAILED'), true);
    assert.equal(context.markLoaded(token), false);
    assert.equal(context.markLoaded(token), false);
    assert.equal(context.isFailed(), true);
    assert.equal(context.isReady(), false);
    assert.equal(accountSaveBlockedReason(context), 'ACCOUNT_DECRYPT_FAILED');
    const second = context.beginLoad();
    assert.equal(context.failure(), null);
    assert.equal(isAccountSaveAllowed(context), false);
    assert.equal(context.markLoaded(second), true);
});

test('READY solo da PENDING della stessa generazione', () => {
    const context = createAccountLoadContext({mode: 'edit'});
    const token = context.beginLoad();
    assert.equal(context.markLoaded(token + 1), false);
    assert.equal(context.isPending(), true);
    assert.equal(context.markLoaded(token), true);
    assert.equal(context.markLoaded(token), false);
});

test('invalidate: isCurrent falso con generation invariata, contesto morto', () => {
    const context = createAccountLoadContext({mode: 'edit'});
    const token = context.beginLoad();
    assert.equal(context.isCurrent(token), true);
    context.invalidate();
    assert.equal(context.generation, token);
    assert.equal(context.isCurrent(token), false);
    assert.equal(context.isCurrent(null), false);
    assert.equal(context.beginLoad(), null);
    assert.equal(context.markLoaded(token), false);
    assert.equal(context.markFailed(token, 'ACCOUNT_DECRYPT_FAILED'), false);
    assert.equal(accountSaveBlockedReason(context), 'ACCOUNT_LOAD_INVALIDATED');
    assert.equal(isAccountSaveAllowed(context), false);
});

test('due contesti con token 1 identico non si contaminano', () => {
    const older = createAccountLoadContext({mode: 'edit'});
    const newer = createAccountLoadContext({mode: 'edit'});
    const olderToken = older.beginLoad();
    const newerToken = newer.beginLoad();
    assert.equal(olderToken, newerToken);
    older.invalidate();
    assert.equal(older.markLoaded(olderToken), false);
    assert.equal(older.markFailed(olderToken, 'ACCOUNT_DECRYPT_FAILED'), false);
    assert.equal(newer.isFailed(), false);
    assert.equal(isAccountSaveAllowed(newer), false);
    assert.equal(newer.markLoaded(newerToken), true);
});

test('ordine inverso sulla stessa istanza: il token superato non conta', () => {
    const context = createAccountLoadContext({mode: 'edit'});
    const first = context.beginLoad();
    const second = context.beginLoad();
    assert.equal(context.markLoaded(first), false);
    assert.equal(context.markFailed(first, 'ACCOUNT_DECRYPT_FAILED'), false);
    assert.equal(context.isFailed(), false);
    assert.equal(context.isPending(), true);
    assert.equal(context.markLoaded(second), true);
});

test('contesto assente o malformato: nessun fallback permissivo', () => {
    for (const missing of [null, undefined, {}, {isReady: 'no'}]) {
        assert.equal(isAccountSaveAllowed(missing), false);
        assert.equal(accountSaveBlockedReason(missing), 'ACCOUNT_SAVE_CONTEXT_MISSING');
        assert.throws(() => assertAccountSaveAllowed(missing));
    }
    assert.equal(DECRYPT_FAILURE_MESSAGE.includes('salvataggio'), true);
});
