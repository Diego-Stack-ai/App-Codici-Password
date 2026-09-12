import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed = new Set(['index.html', 'style.css', 'app.mjs', 'memory-vault.mjs', 'router.mjs', 'fixture.mjs']);
const server = createServer(async (req, res) => {
    const name = new URL(req.url, 'http://127.0.0.1').pathname.slice(1) || 'index.html';
    if (req.method !== 'GET' || !allowed.has(name)) { res.writeHead(404).end(); return; }
    try {
        const data = await readFile(new URL(name, import.meta.url));
        res.writeHead(200, {
            'Content-Type': name.endsWith('.mjs') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html',
            'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'
        }).end(data);
    } catch { res.writeHead(500).end(); }
});
server.listen(4187, '127.0.0.1', () => console.log('Prototipo locale: http://127.0.0.1:4187'));
