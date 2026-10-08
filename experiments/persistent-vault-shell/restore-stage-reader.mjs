// Candidate transport adapter only. No production imports or legacy fallback.
// readPublished must authenticate the caller and resolve stageId server-side.
// isActive must be bound to this reader's immutable session/epoch, not a global
// logged-in flag. Dispose on revocation; a new session needs a new reader.
export function createRestoreStageReader({readPublished, isActive}) {
  if (typeof readPublished !== 'function' || typeof isActive !== 'function') throw new TypeError('RESTORE_READER_CONFIG');
  let disposed = false;
  const check = () => {
    if (disposed || isActive() !== true || disposed) throw new Error('RESTORE_READER_INACTIVE');
  };
  return Object.freeze({
    async read(stageId) {
      check();
      if (typeof stageId !== 'string' || !/^[a-f0-9]{64}$/.test(stageId)) throw new Error('RESTORE_READER_ID');
      let result;
      try {
        // Never accept a client-selected path/generation as download authority.
        result = await readPublished({stageId});
        check();
        if (!(result?.bytes instanceof Uint8Array) || result.bytes.length < 1 ||
            result.bytes.length > 25 * 1024 * 1024 + 1024 || result.size !== result.bytes.length ||
            typeof result.generation !== 'string' || !/^[1-9][0-9]*$/.test(result.generation) ||
            typeof result.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(result.sha256)) throw new Error('RESTORE_READER_RESULT');
        // Server verifies digest/size against the published descriptor. Caller
        // owns these bytes after return and must clear them after use.
        return {bytes: result.bytes, size: result.size, generation: result.generation, sha256: result.sha256};
      } catch (error) {
        if (result?.bytes instanceof Uint8Array) result.bytes.fill(0);
        throw error;
      }
    },
    dispose() { disposed = true; }
  });
}
