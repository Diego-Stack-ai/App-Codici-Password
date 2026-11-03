import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export const NATIVE_AI2_RELEASE = Object.freeze({
    schemaVersion:1,
    platform:'windows-x64',
    minimum:Object.freeze({ ramGiB:32, logicalProcessors:8, freeDiskGiB:8 }),
    model:Object.freeze({
        id:'Qwen/Qwen3-4B-GGUF',
        fileName:'qwen3-4b-q4_k_m.gguf',
        quantization:'Q4_K_M',
        license:'Apache-2.0'
    })
});

const SHA256 = /^[a-f0-9]{64}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const REVISION = /^[a-f0-9]{40}$/;
const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;

export async function sha256File(path) {
    const hash = createHash('sha256');
    await new Promise((resolve, reject) => createReadStream(path)
        .on('data', chunk => hash.update(chunk)).on('error', reject).on('end', resolve));
    return hash.digest('hex');
}
export function validateNativeAi2ReleaseManifest(manifest) {
    if (!manifest || manifest.schemaVersion !== 1) throw new Error('NATIVE_AI2_RELEASE_SCHEMA_INVALID');
    if (manifest.platform !== NATIVE_AI2_RELEASE.platform) throw new Error('NATIVE_AI2_RELEASE_PLATFORM_INVALID');
    if (!VERSION.test(String(manifest.version || ''))) throw new Error('NATIVE_AI2_RELEASE_VERSION_INVALID');
    if (!REVISION.test(String(manifest.model?.revision || ''))) throw new Error('NATIVE_AI2_RELEASE_MODEL_REVISION_INVALID');
    if (manifest.model?.id !== NATIVE_AI2_RELEASE.model.id
        || manifest.model?.quantization !== NATIVE_AI2_RELEASE.model.quantization
        || manifest.model?.license !== NATIVE_AI2_RELEASE.model.license) {
        throw new Error('NATIVE_AI2_RELEASE_MODEL_INVALID');
    }
    if (manifest.installer?.signature?.status !== 'Valid'
        || !String(manifest.installer.signature.subject || '').trim()) {
        throw new Error('NATIVE_AI2_RELEASE_SIGNATURE_INVALID');
    }
    const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
    const roles = new Set(artifacts.map(artifact => artifact.role));
    for (const role of ['installer', 'model', 'runtime-license', 'model-license']) {
        if (!roles.has(role)) throw new Error(`NATIVE_AI2_RELEASE_ARTIFACT_MISSING:${role}`);
    }
    for (const artifact of artifacts) {
        if (!SAFE_FILE.test(String(artifact.file || '')) || String(artifact.file).includes('..')) {
            throw new Error('NATIVE_AI2_RELEASE_FILE_INVALID');
        }
        if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0 || !SHA256.test(String(artifact.sha256 || ''))) {
            throw new Error('NATIVE_AI2_RELEASE_INTEGRITY_INVALID');
        }
    }
    const model = artifacts.find(artifact => artifact.role === 'model');
    if (model.file !== NATIVE_AI2_RELEASE.model.fileName) throw new Error('NATIVE_AI2_RELEASE_MODEL_FILE_INVALID');
    return true;
}
