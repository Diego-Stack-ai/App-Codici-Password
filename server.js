const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const projectRoot = __dirname; // The server is in the project root

const server = http.createServer((req, res) => {
    let requestedUrl = req.url === '/' ? '/Frontend/public/index.html' : req.url;
    let filePath = path.join(projectRoot, requestedUrl);

    // Security check
    if (!filePath.startsWith(projectRoot)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code == 'ENOENT') {
                console.error(`File not found: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end(`File Not Found: ${req.url}`);
            } else {
                console.error(`Server error: ${err.code}`);
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
