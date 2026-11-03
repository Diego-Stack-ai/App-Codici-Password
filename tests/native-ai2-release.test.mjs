import test from 'node:test';
import assert from 'node:assert/strict';
import { NATIVE_AI2_RELEASE, validateNativeAi2ReleaseManifest } from '../scripts/lib/native-ai2-release.mjs';

const artifact = (role, file) => ({ role, file, bytes:1024, sha256:'a'.repeat(64) });
const valid = () => ({
    schemaVersion:1,
    platform:'windows-x64',
    version:'0.1.0',
    minimum:NATIVE_AI2_RELEASE.minimum,
    model:{ ...NATIVE_AI2_RELEASE.model, revision:'b'.repeat(40) },
    installer:{ signature:{ status:'Valid', subject:'CN=Codici Password', thumbprint:'ABC' } },
    artifacts:[
        artifact('installer', 'CodiciPassword-AI2-Setup-0.1.0.exe'),
        artifact('model', 'qwen3-4b-q4_k_m.gguf'),
        artifact('runtime-license', 'LICENSE-llama.cpp.txt'),
        artifact('model-license', 'LICENSE-Qwen3.txt')
    ]
});
test('la release nativa richiede firma, revisione fissata, licenze e hash', () => {
    assert.equal(validateNativeAi2ReleaseManifest(valid()), true);
    const unsigned = valid(); unsigned.installer.signature.status = 'NotSigned';
    assert.throws(() => validateNativeAi2ReleaseManifest(unsigned), /SIGNATURE_INVALID/);
    const movingRevision = valid(); movingRevision.model.revision = 'main';
    assert.throws(() => validateNativeAi2ReleaseManifest(movingRevision), /REVISION_INVALID/);
});

test('la release rifiuta percorsi attraversabili e modelli diversi da quello approvato', () => {
    const traversal = valid(); traversal.artifacts[0].file = '../setup.exe';
    assert.throws(() => validateNativeAi2ReleaseManifest(traversal), /FILE_INVALID/);
    const swapped = valid(); swapped.artifacts[1].file = 'altro.gguf';
    assert.throws(() => validateNativeAi2ReleaseManifest(swapped), /MODEL_FILE_INVALID/);
});
