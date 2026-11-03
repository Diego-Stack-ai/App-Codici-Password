import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SECRET_SCHEMA = 1;
const TARGET_NAME = 'CodiciPassword-QA-Automation';
const ENTROPY = 'CodiciPassword|QA|DPAPI|v1';

function defaultSecretPath() {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'CodiciPassword', 'qa', 'credentials.dpapi');
}

function randomPassword(length) {
    const groups = ['abcdefghijkmnopqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*+-=?'];
    const chars = groups.map(group => group[randomBytes(1)[0] % group.length]);
    const alphabet = groups.join('');
    while (chars.length < length) chars.push(alphabet[randomBytes(1)[0] % alphabet.length]);
    for (let index = chars.length - 1; index > 0; index -= 1) {
        const swap = randomBytes(2).readUInt16BE() % (index + 1);
        [chars[index], chars[swap]] = [chars[swap], chars[index]];
    }
    return chars.join('');
}

export function createQaCredentialBundle({ uid = '', email = 'codex.qa@appcodici-password.invalid' } = {}) {
    return Object.freeze({
        schemaVersion: SECRET_SCHEMA,
        projectId: 'appcodici-password',
        uid: String(uid || ''),
        email: String(email).trim().toLowerCase(),
        accountPassword: randomPassword(28),
        masterPassword: randomPassword(32),
        createdAt: new Date().toISOString()
    });
}

export function validateQaCredentialBundle(bundle, { requireUid = true } = {}) {
    if (!bundle || bundle.schemaVersion !== SECRET_SCHEMA) throw new Error('QA_SECRET_SCHEMA_INVALID');
    if (bundle.projectId !== 'appcodici-password') throw new Error('QA_SECRET_PROJECT_INVALID');
    if (bundle.email !== 'codex.qa@appcodici-password.invalid') throw new Error('QA_SECRET_EMAIL_INVALID');
    if (requireUid && !/^[A-Za-z0-9_-]{6,128}$/.test(bundle.uid || '')) throw new Error('QA_SECRET_UID_INVALID');
    if (typeof bundle.accountPassword !== 'string' || bundle.accountPassword.length < 20) throw new Error('QA_SECRET_ACCOUNT_PASSWORD_INVALID');
    if (typeof bundle.masterPassword !== 'string' || bundle.masterPassword.length < 24) throw new Error('QA_SECRET_MASTER_PASSWORD_INVALID');
    if (bundle.accountPassword === bundle.masterPassword) throw new Error('QA_SECRET_PASSWORD_REUSE');
    return bundle;
}

function runPowerShell(script, input) {
    return new Promise((resolve, reject) => {
        const child = spawn('powershell.exe', [
            '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script
        ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        let output = '';
        let errorOutput = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { errorOutput += chunk; });
        child.once('error', reject);
        child.once('exit', code => {
            if (code === 0) resolve(output.trim());
            else reject(new Error(`QA_DPAPI_FAILED:${code}:${errorOutput.trim().slice(0, 200)}`));
        });
        child.stdin.end(input, 'utf8');
    });
}

const protectScript = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Security",
    "$plain=[Console]::In.ReadToEnd()",
    `$entropy=[Text.Encoding]::UTF8.GetBytes('${ENTROPY}')`,
    '$bytes=[Text.Encoding]::UTF8.GetBytes($plain)',
    '$cipher=[Security.Cryptography.ProtectedData]::Protect($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Console]::Out.Write([Convert]::ToBase64String($cipher))'
].join(';');

const unprotectScript = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Security",
    "$encoded=[Console]::In.ReadToEnd().Trim()",
    `$entropy=[Text.Encoding]::UTF8.GetBytes('${ENTROPY}')`,
    '$cipher=[Convert]::FromBase64String($encoded)',
    '$plain=[Security.Cryptography.ProtectedData]::Unprotect($cipher,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))'
].join(';');

export async function saveQaCredentialBundle(bundle, filePath = defaultSecretPath()) {
    validateQaCredentialBundle(bundle);
    const encrypted = await runPowerShell(protectScript, JSON.stringify(bundle));
    if (!/^[A-Za-z0-9+/=]+$/.test(encrypted)) throw new Error('QA_DPAPI_OUTPUT_INVALID');
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${encrypted}\n`, { encoding: 'utf8', mode: 0o600 });
    return filePath;
}

export async function loadQaCredentialBundle(filePath = defaultSecretPath()) {
    const encrypted = (await readFile(filePath, 'utf8')).trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(encrypted)) throw new Error('QA_DPAPI_FILE_INVALID');
    const plain = await runPowerShell(unprotectScript, encrypted);
    return validateQaCredentialBundle(JSON.parse(plain));
}

export const QA_CREDENTIAL_TARGET = TARGET_NAME;
export const QA_CREDENTIAL_PATH = defaultSecretPath();
