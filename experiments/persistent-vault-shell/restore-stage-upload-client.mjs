// A single bounded upload, never an automatic retry or a publication decision.
export function createRestoreStageUploadClient({endpoint, origin, fetchImpl, getCredentials, isActive, signal}) {
  const url = new URL(endpoint);
  if (url.origin !== origin || url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/restore-stage/upload' || url.search || url.hash || url.username || url.password ||
      [fetchImpl, getCredentials, isActive].some(fn => typeof fn !== 'function')) throw Error('STAGE_UPLOAD_CONFIG');
  const check = () => {if (signal?.aborted || isActive() !== true) throw Error('STAGE_UPLOAD_INACTIVE');};
  return async ({stageId, bytes}) => {
    check();
    if (!/^[a-f0-9]{64}$/.test(stageId || '') || !(bytes instanceof Uint8Array) || bytes.length < 1 ||
        bytes.length > 25 * 1024 * 1024 + 1024) throw Error('STAGE_UPLOAD_INPUT');
    // Caller retains ownership; clear only our detached transport copy.
    const body = new Uint8Array(bytes);
    const clearBody = () => body.fill(0);
    signal?.addEventListener('abort', clearBody, {once:true});
    let response;
    try {
      const credentials = await getCredentials(); check();
      if ([credentials?.idToken, credentials?.appCheckToken].some(value => typeof value !== 'string' || !value || /[\r\n]/.test(value))) throw Error('STAGE_UPLOAD_AUTH');
      response = await fetchImpl(url.href, {method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store', signal,
        headers: {authorization: `Bearer ${credentials.idToken}`, 'x-firebase-appcheck': credentials.appCheckToken,
          'x-stage-id': stageId, 'content-type': 'application/octet-stream'}, body});
      check();
      if (response.status === 409 && !response.redirected && response.headers?.get('x-stage-error') === 'GENERATION_UNSUPPORTED')
        throw Object.assign(new Error('Recupero bloccato: il componente Storage non conserva esattamente la versione dell’allegato. Caricamento non confermato; nessun nuovo tentativo automatico.'), {code: 'GENERATION_UNSUPPORTED'});
      if (response.status !== 200 || response.redirected) throw Error('STAGE_UPLOAD_UNCONFIRMED');
      // Do not retain or parse arbitrary error bodies. Status is followed by a
      // separate server status/publication operation, not authority from bytes.
      return {uploaded: true};
    } finally {
      signal?.removeEventListener('abort', clearBody);
      body.fill(0);
      try {await response?.body?.cancel();} catch {}
    }
  };
}
