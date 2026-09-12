import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/privato/profile-model.js', import.meta.url), 'utf8');
const linkSource = await readFile(new URL('../Frontend/public/assets/js/modules/privato/profilo-links.js', import.meta.url), 'utf8');
const formSource = await readFile(new URL('../Frontend/public/assets/js/modules/privato/form_account_privato.js', import.meta.url), 'utf8');
const saveSource = await readFile(new URL('../Frontend/public/assets/js/modules/privato/form-privato-save.js', import.meta.url), 'utf8');
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

test('una email legacy può scegliere un Account esistente oppure crearne uno nuovo', () => {
    assert.match(linkSource, /const options = \[createLabel, \.\.\.labels\]/);
    assert.match(linkSource, /form_account_privato\.html\?id=\$\{encodeURIComponent\(selected\.id\)\}&profileEmailId=/);
    assert.match(linkSource, /form_account_privato\.html\?profileEmailId=/);
});

test('il collegamento a un Account esistente completa il trasferimento solo al salvataggio', () => {
    assert.match(formSource, /if \(profileEmailId\)[\s\S]+profile-account-link-draft/);
    assert.match(saveSource, /if \(profileEmailLinkDraft\?\.profileEmailId\)[\s\S]+linkProfileEmailToAccount\(email, targetId\)/);
});
