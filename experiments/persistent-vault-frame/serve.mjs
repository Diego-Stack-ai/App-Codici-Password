import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {PRIVATE_FRAME_PATHS} from './frame-policy.mjs';

const root = new URL('./', import.meta.url);
const files = new Map(['app.html', 'parent.mjs', 'child.mjs', 'child-material.mjs', 'frame-policy.mjs', 'frame-session.mjs', 'lab.css'].map(name => ['/' + name, name]));
export async function startFrameLab({port = 0} = {}) {
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const privatePage = PRIVATE_FRAME_PATHS.includes(pathname);
    const file = privatePage ? 'fixture.html' : files.get(pathname);
    const host = request.headers.host || '';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', privatePage ? 'SAMEORIGIN' : 'DENY');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'self'; style-src 'self'; frame-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${privatePage ? "'self'" : "'none'"}`);
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) || request.method !== 'GET' || !file) {
      response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}); response.end('Not found'); return;
    }
    try {
      const bytes = await readFile(new URL(file, root));
      response.setHeader('Content-Type', file.endsWith('.mjs') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
      response.end(bytes);
    } catch {response.writeHead(500); response.end('Unavailable');}
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(port, '127.0.0.1', resolve);});
  return {origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))};
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const lab = await startFrameLab({port: 4179});
  console.log(`Laboratorio solo sintetico: ${lab.origin}/app.html`);
}
