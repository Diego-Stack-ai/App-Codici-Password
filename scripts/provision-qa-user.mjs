import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createQaCredentialBundle, loadQaCredentialBundle, saveQaCredentialBundle, QA_CREDENTIAL_PATH } from './lib/qa-credentials.mjs';

const require = createRequire(import.meta.url);
const cliAuth = require('firebase-tools/lib/auth');
const { Client } = require('firebase-tools/lib/apiv2');
const { identityOrigin, firestoreOrigin } = require('firebase-tools/lib/api');
const { findUser, setCustomClaim } = require('firebase-tools/lib/gcp/auth');

const PROJECT_ID = 'appcodici-password';
const QA_EMAIL = 'codex.qa@appcodici-password.invalid';
const DISPLAY_NAME = 'Codex QA Sintetico';
const ROOT = path.resolve(import.meta.dirname, '..');
const APPLY = process.argv.includes('--apply');
const args = process.argv.slice(2);
if (args.some(argument => !['--apply', '--rotate'].includes(argument))) throw new Error('QA_PROVISION_ARGUMENT_INVALID');

function activateFirebaseCliAccount() {
    const account = cliAuth.getProjectDefaultAccount(ROOT) || cliAuth.getGlobalDefaultAccount();
    if (!account?.tokens?.refresh_token) throw new Error('QA_FIREBASE_LOGIN_REQUIRED');
    cliAuth.setActiveAccount({}, account);
}

async function optionalExistingSecret() {
    try { return await loadQaCredentialBundle(); }
    catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
    }
}

function markerFromUser(user) {
    try { return JSON.parse(user?.customAttributes || '{}'); }
    catch { return {}; }
}

async function publicSignUp(accountPassword) {
    const source = await readFile(path.join(ROOT, 'Frontend/public/assets/js/firebase-config.js'), 'utf8');
    const parts = [...source.matchAll(/const _f\d = "([^"]+)";/g)].map(match => match[1]);
    if (parts.length !== 3) throw new Error('QA_FIREBASE_WEB_KEY_NOT_FOUND');
    const response = await fetch(`${identityOrigin()}/v1/accounts:signUp?key=${encodeURIComponent(parts.join(''))}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: QA_EMAIL, password: accountPassword, returnSecureToken: true })
    });
    const body = await response.json();
    if (!response.ok || !body.localId) throw new Error(`QA_AUTH_CREATE_FAILED:${body?.error?.message || response.status}`);
    return body.localId;
}

async function updateAuthUser(uid, accountPassword) {
    const client = new Client({ urlPrefix: identityOrigin(), auth: true });
    await client.post('/v1/accounts:update', {
        targetProjectId: PROJECT_ID,
        localId: uid,
        email: QA_EMAIL,
        password: accountPassword,
        emailVerified: true,
        displayName: DISPLAY_NAME,
        disableUser: false,
        returnSecureToken: false
    });
    await setCustomClaim(PROJECT_ID, uid, { codexQa: true, synthetic: true, schemaVersion: 1 }, { merge: true });
}

const field = {
    string: value => ({ stringValue: String(value) }),
    integer: value => ({ integerValue: String(value) }),
    bool: value => ({ booleanValue: Boolean(value) }),
    timestamp: value => ({ timestampValue: value }),
    map: fields => ({ mapValue: { fields } })
};

async function writeDocument(documentPath, fields) {
    const client = new Client({ urlPrefix: firestoreOrigin(), auth: true });
    await client.patch(`/v1/projects/${PROJECT_ID}/databases/(default)/documents/${documentPath}`, { fields });
}

async function seedSyntheticProfile(uid) {
    const now = new Date().toISOString();

    await writeDocument(`users/${uid}`, {
        email: field.string(QA_EMAIL),
        nome: field.string('Collaudo'),
        cognome: field.string('Sintetico'),
        photoURL: field.string(''),
        createdAt: field.timestamp(now),
        passwordPolicyVersion: field.integer(1),
        qaAutomation: field.map({ schemaVersion: field.integer(1), synthetic: field.bool(true), provisionedAt: field.timestamp(now) }),
        settings: field.map({
            theme: field.string('system'),
            language: field.string('it'),
            firstConfiguration: field.map({
                version: field.integer(1), completed: field.bool(true), startedAt: field.timestamp(now), completedAt: field.timestamp(now)
            })
        })
    });
}

async function seedSyntheticVault(uid, masterPassword) {
    const cryptoSource = await readFile(path.join(ROOT, 'Frontend/public/assets/js/modules/core/crypto-utils.js'), 'utf8');
    const cryptoApi = await import(`data:text/javascript;base64,${Buffer.from(cryptoSource).toString('base64')}`);
    const vaultKey = cryptoApi.generateVaultKey();
    const verifier = await cryptoApi.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', masterPassword);
    const envelope = await cryptoApi.wrapVaultKey(vaultKey, masterPassword, 'random');
    await writeDocument(`users/${uid}/settings/security`, {
        verifier: field.map(Object.fromEntries(Object.entries(verifier).map(([key, value]) => [key,
            typeof value === 'number' ? field.integer(value) : field.string(value)]))),
        vaultKeyEnvelope: field.map(Object.fromEntries(Object.entries(envelope).map(([key, value]) => [key,
            typeof value === 'number' ? field.integer(value) : field.string(value)])))
    });
}

activateFirebaseCliAccount();
let existing = null;
try { existing = await findUser(PROJECT_ID, QA_EMAIL); }
catch (error) { if (!/No users found/.test(String(error?.message))) throw error; }

if (existing) {
    const marker = markerFromUser(existing);
    if (existing.email !== QA_EMAIL || marker.codexQa !== true || marker.synthetic !== true) {
        throw new Error('QA_EXISTING_IDENTITY_NOT_OWNED_BY_AUTOMATION');
    }
}

const storedCredentials = await optionalExistingSecret();
const rotateRequested = args.includes('--rotate');
const shouldCreateVault = !existing || !storedCredentials || rotateRequested;

if (!APPLY) {
    console.log(JSON.stringify({
        ok: true, dryRun: true, projectId: PROJECT_ID, identity: existing ? 'reconcile' : 'create',
        secretStore: QA_CREDENTIAL_PATH,
        writes: [
            'Firebase Auth synthetic user',
            'synthetic user profile',
            ...(shouldCreateVault ? ['synthetic Vault verifier/envelope'] : [])
        ]
    }, null, 2));
} else {
    let credentials = storedCredentials;
    if (!credentials || rotateRequested) credentials = createQaCredentialBundle();
    let uid = existing?.uid || '';
    if (!uid) uid = await publicSignUp(credentials.accountPassword);
    credentials = Object.freeze({ ...credentials, uid });
    await updateAuthUser(uid, credentials.accountPassword);
    await seedSyntheticProfile(uid);
    if (shouldCreateVault) await seedSyntheticVault(uid, credentials.masterPassword);
    await saveQaCredentialBundle(credentials);

    const verified = await findUser(PROJECT_ID, QA_EMAIL);
    const marker = markerFromUser(verified);
    assert.equal(verified.uid, uid);
    assert.equal(verified.emailVerified, true);
    assert.equal(verified.disabled, false);
    assert.equal(marker.codexQa, true);
    assert.equal(marker.synthetic, true);
    console.log(JSON.stringify({ ok: true, projectId: PROJECT_ID, uid, emailVerified: true, synthetic: true, secretStore: QA_CREDENTIAL_PATH }, null, 2));
}
