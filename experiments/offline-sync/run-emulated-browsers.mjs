import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const candidates = process.platform === 'win32' ? [
    [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe'],
    [process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
] : [
    [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    [process.env.EDGE_PATH, '/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable']
];
const paths = candidates.map(group => group.find(path => path && existsSync(path)));
const modes = process.argv.includes('--no-locks') ? ['--no-locks'] : ['--backend', '--private-backend'];
for (const browser of paths) {
    if (!browser) throw new Error('Chrome/Edge unavailable; set CHROME_PATH and EDGE_PATH to executable paths');
    for (const mode of modes) {
        const result = spawnSync(process.execPath, [fileURLToPath(new URL('./run-browser-tests.mjs', import.meta.url)), browser, mode],
            {env: process.env, stdio: 'inherit', windowsHide: true});
        if (result.error) throw result.error;
        if (result.status !== 0) process.exit(result.status || 1);
    }
}
