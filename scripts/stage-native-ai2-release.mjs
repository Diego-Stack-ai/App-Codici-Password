import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { NATIVE_AI2_RELEASE, sha256File, validateNativeAi2ReleaseManifest } from './lib/native-ai2-release.mjs';

const args = process.argv.slice(2);
const option = name => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : '';
};
const source = resolve(option('--source') || '');
const version = option('--version');
const revision = option('--model-revision').toLowerCase();
const expectedPublisher = option('--publisher');
if (!source || !version || !revision || !expectedPublisher) {
    throw new Error('Uso: node scripts/stage-native-ai2-release.mjs --source <cartella> --version 0.1.0 --model-revision <sha40> --publisher <editore>');
}

const installerName = `CodiciPassword-AI2-Setup-${version}.exe`;
const required = [
    ['installer', installerName],
    ['model', NATIVE_AI2_RELEASE.model.fileName],
    ['runtime-license', 'LICENSE-llama.cpp.txt'],
    ['model-license', 'LICENSE-Qwen3.txt']
];
for (const [, file] of required) {
    if (!existsSync(join(source, file))) throw new Error(`NATIVE_AI2_RELEASE_SOURCE_MISSING:${file}`);
}

const signatureScript = [
    '$s=Get-AuthenticodeSignature -LiteralPath $args[0]',
    '[pscustomobject]@{Status=[string]$s.Status;Subject=[string]$s.SignerCertificate.Subject;Thumbprint=[string]$s.SignerCertificate.Thumbprint}|ConvertTo-Json -Compress'
].join(';');
const signatureResult = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', signatureScript,
    join(source, installerName)], { encoding:'utf8', windowsHide:true });
if (signatureResult.status !== 0) throw new Error('NATIVE_AI2_RELEASE_SIGNATURE_CHECK_FAILED');
const signature = JSON.parse(signatureResult.stdout.trim() || '{}');
if (signature.Status !== 'Valid' || !signature.Subject.includes(expectedPublisher)) {
    throw new Error('NATIVE_AI2_RELEASE_SIGNATURE_INVALID');
}

for (const license of ['LICENSE-llama.cpp.txt', 'LICENSE-Qwen3.txt']) {
    const text = await readFile(join(source, license), 'utf8');
    if (!/Apache License[\s\S]{0,80}Version 2\.0/i.test(text)) throw new Error(`NATIVE_AI2_RELEASE_LICENSE_INVALID:${license}`);
}

const artifacts = [];
for (const [role, file] of required) {
    const path = join(source, file);
    artifacts.push({ role, file:basename(file), bytes:(await stat(path)).size, sha256:await sha256File(path) });
}
const manifest = {
    schemaVersion:1,
    platform:NATIVE_AI2_RELEASE.platform,
    version,
    minimum:NATIVE_AI2_RELEASE.minimum,
    model:{ ...NATIVE_AI2_RELEASE.model, revision },
    installer:{ signature:{ status:signature.Status, subject:signature.Subject, thumbprint:signature.Thumbprint } },
    artifacts
};
validateNativeAi2ReleaseManifest(manifest);

const destination = resolve(import.meta.dirname, '..', 'Frontend', 'public', 'assets', 'native-ai2', 'windows-x64', version);
if (existsSync(destination)) throw new Error(`NATIVE_AI2_RELEASE_ALREADY_EXISTS:${destination}`);
await mkdir(destination, { recursive:true });
for (const artifact of artifacts) await copyFile(join(source, artifact.file), join(destination, artifact.file));
await writeFile(join(destination, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`AI.2 ${version}: ${artifacts.length} artefatti verificati e preparati per Hosting.`);
