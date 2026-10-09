import {decryptFieldCompatibleLab, encryptFieldV2Lab} from './field-kdf-format-lab.mjs';

const password = 'SYNTHETIC-BENCHMARK-PASSWORD', plaintext = 'synthetic field payload';
async function legacy() {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000}, material,
    {name: 'AES-GCM', length: 256}, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode(plaintext)));
  return Buffer.concat([salt, iv, ciphertext]).toString('base64');
}
const legacyValue = await legacy(), v2Value = await encryptFieldV2Lab(plaintext, password);
const operations = {
  legacyDecrypt: () => decryptFieldCompatibleLab(legacyValue, password),
  v2Encrypt: () => encryptFieldV2Lab(plaintext, password),
  v2Decrypt: () => decryptFieldCompatibleLab(v2Value, password)
};
const measurements = {};
for (const [name, operation] of Object.entries(operations)) {
  await operation(); const samples = [];
  for (let index = 0; index < 7; index++) { const start = performance.now(); await operation(); samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b);
  measurements[name] = {samples: 7, minMs: +samples[0].toFixed(2), medianMs: +samples[3].toFixed(2), maxMs: +samples[6].toFixed(2)};
}
console.log(JSON.stringify({scope: 'synthetic-node-only', platform: process.platform, node: process.version,
  legacyIterations: 100000, v2Iterations: 600000, measurements,
  limits: ['Not a browser or physical-device measurement', 'Not a rollout approval', 'Single local host']}, null, 2));
