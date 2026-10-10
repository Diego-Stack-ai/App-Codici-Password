import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const {Storage} = require('../functions/node_modules/@google-cloud/storage');

const PROJECT = 'appcodici-password';
const PREFIX = 'codex-synthetic-gcs-gate/';

export function validateGateConfig({projectId, bucketName}) {
  if (projectId !== PROJECT) throw new Error('GCS_GATE_PROJECT_NOT_ALLOWED');
  if (typeof bucketName !== 'string' || !/^appcodici-password(?:[.-][a-z0-9.-]+)?$/.test(bucketName)) {
    throw new Error('GCS_GATE_BUCKET_NOT_ALLOWED');
  }
  return {projectId, bucketName};
}

export function isExpectedPreconditionFailure(error) {
  // A stale generation is 404 when object versioning is disabled and 412 when
  // GCS evaluates the generation-match precondition against a current target.
  return [404, 412].includes(Number(error?.code)) ||
    Boolean(error?.errors?.some(item => [404, 412].includes(Number(item?.code))));
}

export async function runGenerationGate({projectId, bucketName, storage = new Storage({projectId})}) {
  validateGateConfig({projectId, bucketName});
  const objectName = `${PREFIX}${new Date().toISOString().slice(0, 10)}/${randomUUID()}.txt`;
  const file = storage.bucket(bucketName).file(objectName);
  const pinnedFile = generation => storage.bucket(bucketName).file(objectName, {
    generation, preconditionOpts: {ifGenerationMatch: generation}
  });
  let currentGeneration = null;
  const evidence = {projectId, bucketName, objectName, staleDeleteRejected: false, cleanupVerified: false};
  try {
    await file.save(Buffer.from('synthetic-generation-1'), {resumable: false,
      preconditionOpts: {ifGenerationMatch: 0}, metadata: {contentType: 'text/plain',
        metadata: {purpose: 'codex-synthetic-gcs-generation-gate'}}});
    const [first] = await file.getMetadata();
    const firstGeneration = String(first?.generation || '');
    if (!/^\d+$/.test(firstGeneration)) throw new Error('GCS_GATE_GENERATION_MISSING');

    await file.save(Buffer.from('synthetic-generation-2'), {resumable: false,
      preconditionOpts: {ifGenerationMatch: firstGeneration}});
    const [second] = await file.getMetadata();
    currentGeneration = String(second?.generation || '');
    if (!/^\d+$/.test(currentGeneration) || currentGeneration === firstGeneration) {
      throw new Error('GCS_GATE_REPLACEMENT_UNVERIFIED');
    }
    try {
      await pinnedFile(firstGeneration).delete({generation: firstGeneration, ifGenerationMatch: firstGeneration});
      throw new Error('GCS_GATE_STALE_DELETE_APPLIED');
    } catch (error) {
      if (error?.message === 'GCS_GATE_STALE_DELETE_APPLIED') throw error;
      if (!isExpectedPreconditionFailure(error)) throw error;
      evidence.staleDeleteRejected = true;
    }
    const [afterRejectedDelete] = await file.getMetadata();
    if (String(afterRejectedDelete?.generation || '') !== currentGeneration) {
      throw new Error('GCS_GATE_REPLACEMENT_NOT_PRESERVED');
    }
    await pinnedFile(currentGeneration).delete({generation: currentGeneration, ifGenerationMatch: currentGeneration});
    currentGeneration = null;
    try {
      await file.getMetadata();
      throw new Error('GCS_GATE_CLEANUP_NOT_APPLIED');
    } catch (error) {
      if (error?.message === 'GCS_GATE_CLEANUP_NOT_APPLIED' || Number(error?.code) !== 404) throw error;
      evidence.cleanupVerified = true;
    }
    return evidence;
  } finally {
    if (currentGeneration) {
      try {
        await pinnedFile(currentGeneration).delete({generation: currentGeneration,
          ifGenerationMatch: currentGeneration});
      } catch (error) {
        if (Number(error?.code) !== 404 && !isExpectedPreconditionFailure(error)) throw error;
      }
    }
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
  const bucketName = process.env.GCS_GATE_BUCKET || '';
  validateGateConfig({projectId, bucketName});
  if (!execute) {
    console.log(JSON.stringify({ready: true, execute: false, projectId, bucketName,
      prefix: PREFIX, note: 'Nessun accesso cloud eseguito; aggiungere --execute dopo autenticazione gcloud/ADC.'}));
    return;
  }
  console.log(JSON.stringify(await runGenerationGate({projectId, bucketName})));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => { console.error(error?.code || error?.message || String(error)); process.exitCode = 1; });
}
