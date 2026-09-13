import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const paths = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
for (const browser of paths) {
    if (!existsSync(browser)) throw new Error(`Browser unavailable: ${browser}`);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./run-browser-tests.mjs', import.meta.url)), browser, '--backend'],
        {env: process.env, stdio: 'inherit', windowsHide: true});
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
