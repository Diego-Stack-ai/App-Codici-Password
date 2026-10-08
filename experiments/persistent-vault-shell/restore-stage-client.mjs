// Candidate same-origin loopback client. No ambient Firebase or credentials.
export function createRestoreStageClient({endpoint, origin, fetchImpl, getCredentials, isActive, signal}) {
  const url = new URL(endpoint);
  if (url.origin !== origin || url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !['/download', '/restore-stage/download'].includes(url.pathname) || url.search || url.hash || url.username || url.password ||
      [fetchImpl, getCredentials, isActive].some(fn => typeof fn !== 'function')) throw new TypeError('STAGE_CLIENT_CONFIG');
  const check = () => {if (signal?.aborted || isActive() !== true) throw Error('STAGE_CLIENT_INACTIVE');};
  return async ({stageId}) => {
    check();
    if (typeof stageId !== 'string' || !/^[a-f0-9]{64}$/.test(stageId)) throw Error('STAGE_CLIENT_ID');
    const credentials = await getCredentials(); check();
    if ([credentials?.idToken, credentials?.appCheckToken].some(value => typeof value !== 'string' || !value || /[\r\n]/.test(value))) throw Error('STAGE_CLIENT_AUTH');
    const response = await fetchImpl(url.href, {method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal,
      headers: {authorization: `Bearer ${credentials.idToken}`, 'x-firebase-appcheck': credentials.appCheckToken, 'x-stage-id': stageId}});
    let reader, output;
    const chunks = [];
    const clearChunks = () => {for (const chunk of chunks) chunk.fill(0);};
    const clearOwned = () => {output?.fill(0); clearChunks();};
    signal?.addEventListener('abort', clearOwned, {once:true});
    try {
      check();
      if (response.status === 409 && !response.redirected && response.headers.get('x-stage-error') === 'GENERATION_UNSUPPORTED')
        throw Object.assign(new Error('Recupero bloccato: il componente Storage non conserva esattamente la versione dell’allegato. Nessuna versione alternativa è stata letta.'), {code: 'GENERATION_UNSUPPORTED'});
      const length = response.headers.get('content-length'), generation = response.headers.get('x-storage-generation'), sha256 = response.headers.get('x-content-sha256');
      const size = Number(length);
      if (response.status !== 200 || response.redirected || response.headers.get('content-type') !== 'application/octet-stream' ||
          typeof length !== 'string' || !/^[1-9][0-9]*$/.test(length) || !Number.isSafeInteger(size) || size > 25 * 1024 * 1024 + 1024 ||
          !/^[1-9][0-9]*$/.test(generation || '') || !/^[a-f0-9]{64}$/.test(sha256 || '')) throw Error('STAGE_CLIENT_RESPONSE');
      reader = response.body.getReader();
      let total = 0;
      for (;;) {
        const {done, value} = await reader.read();
        if (value instanceof Uint8Array) chunks.push(value);
        check();
        if (done) break;
        if (!(value instanceof Uint8Array)) throw Error('STAGE_CLIENT_BYTES');
        total += value.length;
        if (total > size) throw Error('STAGE_CLIENT_SIZE');
      }
      if (total !== size) throw Error('STAGE_CLIENT_SIZE');
      output = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) {output.set(chunk, offset); offset += chunk.length;}
      check();
      return {bytes: output, size, generation, sha256};
    } catch (error) {
      clearOwned();
      try {if (reader) await reader.cancel(); else await response.body?.cancel();} catch {}
      throw error;
    } finally {
      signal?.removeEventListener('abort', clearOwned);
      clearChunks();
      reader?.releaseLock();
    }
  };
}
