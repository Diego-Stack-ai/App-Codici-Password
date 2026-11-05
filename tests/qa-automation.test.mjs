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
    const second = createQaCredentialBundle({ uid: 'synthetic_uid_456', email: 'codex.qa2@appcodici-password.invalid' });
    assert.equal(validateQaCredentialBundle(second, {expectedEmail: second.email}), second);
    assert.throws(() => validateQaCredentialBundle({ ...valid, projectId: 'altro' }), /QA_SECRET_PROJECT_INVALID/);
    assert.throws(() => validateQaCredentialBundle({ ...valid, email: 'persona@example.com' }), /QA_SECRET_EMAIL_INVALID/);
    assert.throws(() => validateQaCredentialBundle(second, {expectedEmail: valid.email}), /QA_SECRET_EMAIL_MISMATCH/);
    assert.throws(() => validateQaCredentialBundle({ ...valid, masterPassword: valid.accountPassword }), /QA_SECRET_PASSWORD_REUSE/);
});

test('provisioner e runner non stampano né incorporano i segreti', async () => {
    const sources = await Promise.all([
        readFile(new URL('../scripts/lib/qa-credentials.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/provision-qa-user.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/test-qa-release-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/test-qa-page-matrix-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/populate-qa-profile-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/populate-qa-profile-links-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/populate-qa-company-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/populate-qa-accounts-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../scripts/populate-qa-deadlines-browser.mjs', import.meta.url), 'utf8')
    ]);
    const joined = sources.join('\n');
    assert.doesNotMatch(joined, /console\.log\([^\n]*(accountPassword|masterPassword)/);
    assert.doesNotMatch(joined, /Local-Test-Only|LOCAL-Vault-Only/);
    assert.match(joined, /codex\.qa@appcodici-password\.invalid/);
    assert.match(joined, /QA_EXISTING_IDENTITY_NOT_OWNED_BY_AUTOMATION/);
    assert.match(joined, /existing && !storedCredentials && !rotateRequested[\s\S]+QA_CREDENTIALS_MISSING_EXISTING_VAULT/);
    assert.match(joined, /shouldCreateVault = !existing \|\| rotateRequested/);
    assert.match(joined, /QA_CREDENTIALS_IDENTITY_MISMATCH/);
    assert.match(joined, /QA_CREDENTIALS_UID_MISMATCH/);
    assert.match(joined, /QA_CREDENTIALS_IDENTITY_NOT_FOUND/);
    assert.match(joined, /CODEX_QA_EMAIL/);
    assert.match(joined, /codex\\\.qa\(\?:\[1-9\]\[0-9\]\*\)\?@appcodici-password\\\.invalid/);
    assert.match(joined, /updateMask\.fieldPaths/);
    assert.match(joined, /shouldCreateVault \? \['synthetic Vault verifier\/envelope'\] : \[\]/);
});

test('il collaudo dei collegamenti Profilo usa UI reale e fixture non raggiungibili', async () => {
    const source = await readFile(new URL('../scripts/populate-qa-profile-links-browser.mjs', import.meta.url), 'utf8');
    assert.match(source, /profilo\.qa@appcodici-password\.invalid/);
    assert.match(source, /QA Account Profilo/);
    assert.match(source, /QA-DOC-0001/);
    assert.match(source, /qa-allegato-sintetico\.txt/);
    assert.match(source, /passed-number-text-attachment-no-duplication/);
    assert.match(source, /created-without-recipients/);
    assert.match(source, /deferred-missing-deadline-rule/);
    assert.match(source, /profile-account-link\.png/);
    assert.match(source, /profile-deadline-link\.png/);
    assert.doesNotMatch(source, /firebase-config|updateDoc|setDoc|addDoc|deleteDoc/);
    assert.match(source, /#profile-account-picker/);
    assert.match(source, /#btn-save-footer/);
    assert.match(source, /#save-btn/);
});

test('il collaudo Azienda usa UI reale, recapiti non raggiungibili e password sintetiche', async () => {
    const source = await readFile(new URL('../scripts/populate-qa-company-browser.mjs', import.meta.url), 'utf8');
    assert.match(source, /QA Azienda Sintetica SRL/);
    assert.match(source, /@appcodici-password\.invalid/);
    assert.match(source, /QA-PASSWORD-NON-REALE/);
    assert.match(source, /company-contacts-masked\.png/);
    assert.match(source, /#btn-save/);
    assert.match(source, /#btn-add-sede/);
    assert.match(source, /#btn-add-email/);
    assert.doesNotMatch(source, /firebase-config|updateDoc|setDoc|addDoc|deleteDoc/);
});

test('il lotto Account QA richiede esplicitamente l Azienda QA2 e usa solo UI reale', async () => {
    const source = await readFile(new URL('../scripts/populate-qa-accounts-browser.mjs', import.meta.url), 'utf8');
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(source, /CODEX_QA_COMPANY_ID/);
    assert.match(source, /QA_COMPANY_ID_REQUIRED/);
    assert.match(source, /QA_COMPANY_ID_INVALID/);
    assert.match(source, /codex\.qa2@appcodici-password\.invalid/);
    assert.match(source, /QA2_UID_MISMATCH/);
    assert.match(source, /qa2-company-ownership/);
    assert.match(source, /QA_ACCOUNT_FIXTURE_NOT_UNIQUE/);
    assert.match(source, /QA_ACCOUNT_ATTACHMENT_NOT_UNIQUE/);
    assert.match(source, /QA_CLEANUP_ACCOUNT_ATTACHMENT_ID/);
    assert.match(source, /QA_CLEANUP_ATTACHMENT_CONFIRM/);
    assert.match(source, /QA_ATTACHMENT_CLEANUP_DESTRUCTIVE_AUTH_REQUIRED/);
    assert.match(source, /CODEX_QA_ACCOUNT_AUDIT_ONLY/);
    assert.match(source, /CODEX_QA_ACCOUNT_DUPLICATE_CLEANUP/);
    assert.match(source, /CODEX_QA_ACCOUNT_KEEP_ID/);
    assert.match(source, /CODEX_QA_ACCOUNT_DELETE_ID/);
    assert.match(source, /DELETE_QA2_SYNTHETIC_DUPLICATE/);
    assert.match(source, /QA_DUPLICATE_CLEANUP_STATE_MISMATCH/);
    assert.match(source, /blocked-app-check/);
    assert.doesNotMatch(source, /DzU5YMXcMV58DwpUezuN/);
    assert.match(source, /QA Privato Standard/);
    assert.match(source, /QA Privato Bancario/);
    assert.match(source, /QA Privato Memorandum/);
    assert.match(source, /QA Azienda Account Standard/);
    assert.match(source, /QA Azienda Account Bancario/);
    assert.match(source, /QA Azienda Memorandum/);
    assert.match(source, /qa-account-allegato-sintetico\.txt/);
    assert.match(source, /Scegli o aggiungi almeno un contatto per condividere/);
    assert.doesNotMatch(source, /firebase-config|updateDoc|setDoc|addDoc|deleteDoc/);
    assert.equal(packageJson.scripts['qa:populate-accounts-browser'], 'node scripts/populate-qa-accounts-browser.mjs');
});

test('il lotto Scadenze QA usa solo UI, recapiti non raggiungibili e cancellazione con opt-in', async () => {
    const source = await readFile(new URL('../scripts/populate-qa-deadlines-browser.mjs', import.meta.url), 'utf8');
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.match(source, /QA Contratto privato/);
    assert.match(source, /QA Licenza aziendale/);
    assert.match(source, /Carta Identità/);
    assert.match(source, /scadenze\.privato\.qa@example\.invalid/);
    assert.match(source, /scadenze\.azienda\.qa@example\.invalid/);
    assert.match(source, /QA_ALLOW_DESTRUCTIVE/);
    assert.match(source, /QA_DELETE_TEMP_TRASH/);
    assert.match(source, /QA_ALLOW_INCOMPLETE/);
    assert.match(source, /QA_COMPANY_ID_REQUIRED/);
    assert.match(source, /QA_CLEANUP_DEADLINE_ID/);
    assert.match(source, /QA_CLEANUP_CONFIRM/);
    assert.match(source, /DELETE_SYNTHETIC_DUPLICATE/);
    assert.match(source, /QA_DUPLICATE_CLEANUP_DESTRUCTIVE_AUTH_REQUIRED/);
    assert.match(source, /QA_SKIP_PRIVATE_ARCHIVE/);
    assert.match(source, /QA_DUPLICATE_CLEANUP_IDENTITY_NOT_UNIQUE/);
    assert.match(source, /QA_DEADLINE_FIXTURE_NOT_UNIQUE/);
    assert.match(source, /gatePassed/);
    assert.match(source, /QA_RECIPIENT_CHANNEL_ACTIVE/);
    assert.match(source, /deadline-push-toggle/);
    assert.match(source, /deadline-idempotency/);
    assert.doesNotMatch(source, /firebase-config|updateDoc|setDoc|addDoc|deleteDoc/);
    assert.equal(packageJson.scripts['qa:populate-deadlines-browser'], 'node scripts/populate-qa-deadlines-browser.mjs');
});

test('il popolamento profilo usa solo UI e recapiti sintetici non raggiungibili', async () => {
    const source = await readFile(new URL('../scripts/populate-qa-profile-browser.mjs', import.meta.url), 'utf8');
    assert.match(source, /profilo\.qa@appcodici-password\.invalid/);
    assert.match(source, /QA-SINTETICO/);
    assert.match(source, /QA-DOC-0001/);
    assert.match(source, /qa-allegato-sintetico\.txt/);
    assert.match(source, /QA Widget Profilo/);
    assert.match(source, /Segreto QA cifrato/);
    assert.doesNotMatch(source, /firebase-config|updateDoc|setDoc|addDoc|deleteDoc/);
    assert.match(source, /#profile-edit-modal/);
    assert.match(source, /reload-verification/);
    assert.match(source, /profile-widget\.png/);
    assert.match(source, /profile-documents\.png/);
});

test('il percorso alternativo delle credenziali indica solo un file locale protetto', async () => {
    const source = await readFile(new URL('../scripts/lib/qa-credentials.mjs', import.meta.url), 'utf8');
    assert.match(source, /CODEX_QA_CREDENTIAL_PATH/);
    assert.doesNotMatch(source, /accountPassword\s*[:=]\s*["'][^"']+["']/);
    assert.doesNotMatch(source, /masterPassword\s*[:=]\s*["'][^"']+["']/);
    assert.match(source, /QA_DPAPI_TIMEOUT/);
    assert.match(source, /15_000/);
});

test('il runner P0 separa esecuzione e gate e cancella gli export decifrati', async () => {
    const source = await readFile(new URL('../scripts/test-qa-p0-safe-browser.mjs', import.meta.url), 'utf8');
    assert.match(source, /QA_P0_ALLOW_INCOMPLETE/);
    assert.match(source, /runCompleted/);
    assert.match(source, /gatePassed/);
    assert.match(source, /codici-password-qa-p0-artifacts-/);
    assert.match(source, /randomBytes\(24\)/);
    assert.match(source, /downloadEvidence/);
    assert.match(source, /zipEntryNames/);
    assert.match(source, /CSV_FORMULA_NOT_NEUTRALIZED/);
    assert.match(source, /await rm\(exported\.path, \{force: true\}\)/);
});

test('la matrice multilingua usa un override solo loopback e rileva i fallback', async () => {
    const [runner, translations, main] = await Promise.all([
        readFile(new URL('../scripts/test-qa-page-matrix-browser.mjs', import.meta.url), 'utf8'),
        readFile(new URL('../Frontend/public/assets/js/translations.js', import.meta.url), 'utf8'),
        readFile(new URL('../Frontend/public/assets/js/main-v129.js', import.meta.url), 'utf8')
    ]);
    assert.match(runner, /QA_LANGUAGES/);
    assert.match(runner, /QA_LANGUAGE_MATRIX_REQUIRES_LOCAL_ORIGIN/);
    assert.match(runner, /QA_PAGE_IDS/);
    assert.match(runner, /QA_PAGE_IDS_INVALID/);
    assert.match(runner, /knownPageIds/);
    assert.match(runner, /QA_INTERACTIVE_SCREENSHOTS/);
    assert.match(runner, /INTERACTIVE_I18N_FALLBACK/);
    assert.match(runner, /INTERACTIVE_HORIZONTAL_OVERFLOW/);
    assert.match(runner, /INTERACTIVE_TRANSLATION_MISMATCH/);
    assert.match(runner, /QA_ALLOW_CONTEXT_REDIRECTS/);
    assert.match(runner, /CODEX_QA_PRIVATE_ACCOUNT_ID/);
    assert.match(runner, /CODEX_QA_COMPANY_ID/);
    assert.match(runner, /CODEX_QA_COMPANY_ACCOUNT_ID/);
    assert.match(runner, /CODEX_QA_DEADLINE_ID/);
    assert.match(runner, /\^\[A-Za-z0-9_-\]\{8,128\}\$/);
    assert.match(runner, /contextFixtures: Object\.fromEntries/);
    assert.match(runner, /\['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'\]/);
    assert.match(runner, /missingTranslationKeys/);
    assert.match(runner, /LANGUAGE_MISMATCH/);
    assert.match(runner, /I18N_FALLBACK/);
    assert.match(runner, /#profile-overview \.profile-overview-heading/);
    assert.match(runner, /captureInteractiveRecipientStates/);
    assert.match(runner, /recipient_delete_message/);
    assert.match(runner, /#confirm-cancel-btn/);
    assert.match(runner, /DYNAMIC_CONTENT_TIMEOUT/);
    assert.match(runner, /allowContextRedirects && entry\.status === 'NEEDS_FIXTURE_OR_CONTEXT'/);
    assert.match(runner, /`\$\{language\}-\$\{viewport\.name\}-\$\{currentRoute\}\.png`/);
    assert.match(translations, /LOCAL_QA_HOSTS = new Set\(\['localhost', '127\.0\.0\.1', '::1'\]\)/);
    assert.match(translations, /window\.sessionStorage\.getItem\(LOCAL_QA_LANGUAGE_KEY\)/);
    assert.match(main, /getLocalQaLanguageOverride\(\) \|\| getCurrentLanguage\(\)/);
    assert.match(main, /getLocalQaLanguageOverride\(\) \|\| profileLanguage/);
    assert.doesNotMatch(runner, /updateDoc|setDoc|addDoc|deleteDoc/);
});
