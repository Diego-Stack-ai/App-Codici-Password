import {decryptFieldCompatibleLab, encryptFieldV2Lab} from './field-kdf-format-lab.mjs';

// Deliberate compile-time interlock. No request, environment, query string or
// persisted user setting can enable new writes in this candidate.
export function isFieldKdfV2WriteEnabled() { return false; }

export function createFieldKdfRolloutLab({legacyEncrypt}) {
  if (typeof legacyEncrypt !== 'function') throw Error('FIELD_KDF_ROLLOUT_INVALID');
  return Object.freeze({
    async encrypt(plaintext, password) {
      if (!isFieldKdfV2WriteEnabled()) return legacyEncrypt(plaintext, password);
      return encryptFieldV2Lab(plaintext, password);
    },
    async decrypt(value, password) {
      return decryptFieldCompatibleLab(value, password);
    }
  });
}
