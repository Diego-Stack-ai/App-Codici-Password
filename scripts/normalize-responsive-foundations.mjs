import { readdir, readFile, writeFile } from 'node:fs/promises';
const publicDir = new URL('../Frontend/public/', import.meta.url);
const cssDir = new URL('../Frontend/public/assets/css/', import.meta.url);
const viewport = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
const pwaMeta = [
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
];

for (const name of (await readdir(publicDir)).filter(name => name.endsWith('.html'))) {
    const path = new URL(name, publicDir);
    let html = await readFile(path, 'utf8');
    html = html.replace(/<meta name="viewport"\s+content="[^"]*">/m, viewport);
    if (!html.includes('name="viewport"')) html = html.replace(/<meta charset="utf-8"\s*\/?>/i, match => `${match}\n    ${viewport}`);
    const missing = pwaMeta.filter(meta => !html.includes(meta.match(/name="([^"]+)/)[1]));
    if (missing.length) html = html.replace(viewport, `${viewport}\n    ${missing.join('\n    ')}`);
    await writeFile(path, html, 'utf8');
}

for (const name of (await readdir(cssDir)).filter(name => name.endsWith('.css'))) {
    const path = new URL(name, cssDir);
    let css = await readFile(path, 'utf8');
    css = css
        .replace(/max-width:\s*480px/g, 'max-width: 600px')
        .replace(/min-width:\s*481px/g, 'min-width: 601px')
        .replace(/max-width:\s*640px/g, 'max-width: 600px')
        .replace(/min-width:\s*640px/g, 'min-width: 601px');
    await writeFile(path, css, 'utf8');
}

console.log('Fondamenta responsive normalizzate: HTML e breakpoint CSS.');
