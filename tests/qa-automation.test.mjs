import test from 'node:test';
import assert from 'node:assert/strict';
import { createQaCredentialBundle, validateQaCredentialBundle } from '../scripts/lib/qa-credentials.mjs';
import { readFile } from 'node:fs/promises';

test('le credenziali QA sono sintetiche, robuste e distinte', () => {
    const bundle = createQaCredentialBundle({ uid: 'synthetic_uid_123' });
    assert.equal(validateQaCredentialBundle(bundle), bundle);
    assert.equal(bundle.email, 'codex.qa@appcodici-password.invalid');
    assert.ok(bundle.accountPassword.length >= 20);
    assert.ok(bundle.masterPassword.length >= 24);
    assert.notEqual(bundle.accountPassword, bundle.masterPassword);
    for (const value of [bundle.accountPassword, bundle.masterPassword]) {
        assert.match(value, /[a-z]/);
        assert.match(value, /[A-Z]/);
        assert.match(value, /[0-9]/);
        assert.match(value, /[^A-Za-z0-9]/);
    }
});

test('la validazione rifiuta progetto, email e password non conformi', () => {
    const valid = createQaCredentialBundle({ uid: 'synthetic_uid_123' });
    assert.throws(() => validateQaCredentialBundle({ ...valid, projectId: 'altro' }), /QA_SECRET_PROJECT_INVALID/);
    assert.throws(() => validateQaCredentialBundle({ ...valid, email: 'persona@example.com' }), /QA_SECRET_EMAIL_INVALID/);
    assert.throws(() => validateQaCredentialBundle({ ...valid, masterPassword: valid.accountPassword }), /QA_SECRET_PASSWORD_REUSE/);
});

test('provisioner e runner non stampano né incorporano i segreti', async () => {
    const sources = await Promise.all([
        readFile(new URL('../scripts/provision-qa-user.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/test-qa-release-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/test-qa-page-matrix-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/populate-qa-profile-browser.mjs', import.meta.url), 'utf8')
    ]);
    const joined = sources.join('\n');
    assert.doesNotMatch(joined, /console\.log\([^\n]*(accountPassword|masterPassword)/);
    assert.doesNotMatch(joined, /Local-Test-Only|LOCAL-Vault-Only/);
    assert.match(joined, /codex\.qa@appcodici-password\.invalid/);
    assert.match(joined, /QA_EXISTING_IDENTITY_NOT_OWNED_BY_AUTOMATION/);
    assert.match(joined, /updateMask\.fieldPaths/);
    assert.match(joined, /shouldCreateVault \? \['synthetic Vault verifier\/envelope'\] : \[\]/);
});

test('il popolamento profilo usa solo UI e recapiti sintetici non raggiungibili', async () => {
    const source = await readFile(new URL('../scripts/populate-qa-profile-browser.mjs', import.meta.url), 'utf8');
    assert.match(source, /profilo\.qa@appcodici-password\.invalid/);
    assert.match(source, /QA-SINTETICO/);
    assert.doesNotMatch(source, /firebase-config|updateDoc|setDoc|addDoc|deleteDoc/);
    assert.match(source, /#profile-edit-modal/);
    assert.match(source, /reload-verification/);
});

test('il percorso alternativo delle credenziali indica solo un file locale protetto', async () => {
    const source = await readFile(new URL('../scripts/lib/qa-credentials.mjs', import.meta.url), 'utf8');
    assert.match(source, /CODEX_QA_CREDENTIAL_PATH/);
    assert.doesNotMatch(source, /accountPassword\s*[:=]\s*["'][^"']+["']/);
    assert.doesNotMatch(source, /masterPassword\s*[:=]\s*["'][^"']+["']/);
});
