// Isolated handler factory: no listener or production export.
export function createRestoreStageDownload({read, verifyIdToken, verifyAppCheck}) {
  if ([read, verifyIdToken, verifyAppCheck].some(fn => typeof fn !== 'function')) throw new TypeError('DOWNLOAD_CONFIG');
  return async (req, res) => {
    let bytes, ended = false;
    const cleanup = () => {ended = true; bytes?.fill(0);};
    res.once('finish', cleanup); res.once('close', cleanup); res.once('error', cleanup);
    let responseStatus = 400;
    const fail = status => {responseStatus = status; throw new Error('DOWNLOAD_FAILED');};
    try {
      let host;
      try {host = new URL(`http://${req.headers.host}`).hostname;} catch {fail(403);}
      if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket?.remoteAddress) ||
          !['127.0.0.1', 'localhost', '[::1]'].includes(host)) fail(403);
      if (req.method !== 'POST') fail(405);
      if (req.url !== '/download' || req.headers['transfer-encoding'] !== undefined ||
          (req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0') ||
          ['x-uid', 'x-storage-path', 'x-generation'].some(name => req.headers[name] !== undefined)) fail(400);
      const id = req.headers['x-stage-id'], token = req.headers.authorization, app = req.headers['x-firebase-appcheck'];
      if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) fail(400);
      if (typeof token !== 'string' || !token.startsWith('Bearer ') || !token.slice(7) || typeof app !== 'string' || !app) fail(401);
      let identity;
      try {identity = await verifyIdToken(token.slice(7)); await verifyAppCheck(app);} catch {fail(401);}
      if (typeof identity?.uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(identity.uid)) fail(401);
      if (ended || res.destroyed) return;
      const result = await read(identity.uid, {stageId: id});
      bytes = result?.bytes;
      if (!(bytes instanceof Uint8Array)) {bytes = undefined; fail(500);}
      if (ended || res.destroyed) {cleanup(); return;}
      if (bytes.length < 1 || bytes.length > 25 * 1024 * 1024 + 1024 || result.size !== bytes.length ||
          typeof result.generation !== 'string' || !/^[1-9][0-9]*$/.test(result.generation) ||
          typeof result.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(result.sha256)) fail(500);
      res.writeHead(200, {'content-type': 'application/octet-stream', 'cache-control': 'no-store',
        'content-length': bytes.length, 'x-storage-generation': result.generation, 'x-content-sha256': result.sha256});
      res.end(bytes);
    } catch (error) {
      bytes?.fill(0);
      if (!ended && !res.destroyed && !res.headersSent) {
        if (error.code === 'BACKUP_STAGE_GENERATION_UNSUPPORTED') {
          res.writeHead(409, {'content-type': 'application/json', 'cache-control': 'no-store',
            'x-stage-error': 'GENERATION_UNSUPPORTED'});
          res.end('{"error":"GENERATION_UNSUPPORTED"}');
          return;
        }
        res.writeHead(responseStatus, {'content-type': 'application/json', 'cache-control': 'no-store'});
        res.end('{"error":"DOWNLOAD_FAILED"}');
      } else if (!ended && !res.destroyed) res.destroy();
    }
  };
}
