import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/privato/profile-model.js', import.meta.url), 'utf8');
const {
    buildProfileAccountLinkDraft,
    hasLegacyEmailPassword,
    linkProfileEmailToAccount
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('riconosce soltanto password legacy valorizzate', () => {
    assert.equal(hasLegacyEmailPassword({password: 'ciphertext-decifrato-in-memoria'}), true);
    assert.equal(hasLegacyEmailPassword({password: '   '}), false);
    assert.equal(hasLegacyEmailPassword({}), false);
});

test('il passaggio alla creazione Account non mette la password in sessionStorage', () => {
    const draft = buildProfileAccountLinkDraft({
        id: 'email-1',
        address: 'fixture@example.test',
        password: 'FIXTURE-NON-SEGRETO-password'
    });

    assert.deepEqual(draft, {profileEmailId: 'email-1', email: 'fixture@example.test'});
    assert.equal(Object.hasOwn(draft, 'password'), false);
});

test('la password legacy viene rimossa solo quando il collegamento Account è pronto', () => {
    const source = {id: 'email-1', address: 'fixture@example.test', password: 'ciphertext'};
    const linked = linkProfileEmailToAccount(source, 'account-1');

    assert.equal(source.password, 'ciphertext');
    assert.equal(linked.password, '');
    assert.equal(linked.linkedAccountId, 'account-1');
});
