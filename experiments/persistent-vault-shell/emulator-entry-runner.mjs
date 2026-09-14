import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {attachEntryNetworkControl} from './emulator-network-control.mjs';

export async function runEntryBrowsers(nextReport, {restart = false} = {}) {
    const browsers = process.platform === 'win32' ? [process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'] :
        [process.env.CHROME_PATH || '/usr/bin/google-chrome', process.env.EDGE_PATH || '/usr/bin/microsoft-edge'];
    for (const browser of browsers) {
        if (!existsSync(browser)) throw new Error('ENTRY_BROWSER_MISSING');
        const temp = resolve(tmpdir()), profile = await mkdtemp(`${temp}/codex-entry-browser-`);
        let child, timer, closeNetwork;
        try {
          for (const restartPhase of restart ? ['prepare', 'resume'] : [undefined]) {
            const report = nextReport();
            child = spawn(browser, ['--headless=new', ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
                '--disable-gpu', '--no-first-run', '--disable-sync', '--disable-background-networking', '--disable-background-mode', '--remote-debugging-port=0', `--user-data-dir=${profile}`, restart ? 'about:blank' : 'http://127.0.0.1:4188/'], {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
            closeNetwork = await attachEntryNetworkControl(child, {restartPhase});
            const result = await Promise.race([report, new Promise((_, reject) => {
                child.on('error', reject); timer = setTimeout(async () => {
                    const state = await Promise.race([closeNetwork?.inspect?.().catch(() => 'unavailable'),
                        new Promise(resolve => setTimeout(() => resolve('unavailable'), 1000))]);
                    reject(new Error(`ENTRY_BROWSER_TIMEOUT: ${JSON.stringify(state)}`));
                }, 60000);
            })]);
            clearTimeout(timer);
            if (!result.ok) throw new Error(JSON.stringify(result));
            if (restartPhase === 'prepare') {
                if (result.phase !== 'prepared') throw new Error('RESTART_NOT_PREPARED');
                const exited = new Promise(resolve => child.once('exit', resolve));
                await closeNetwork.quitBrowser();
                let exitTimer;
                try { await Promise.race([exited, new Promise((_, reject) => {
                    exitTimer = setTimeout(() => reject(new Error('BROWSER_DID_NOT_EXIT')), 10000);
                })]); } finally { clearTimeout(exitTimer); }
                closeNetwork(); closeNetwork = null; child = null;
            } else {
                if (restart) result.passed.unshift('browser process exited before offline restart with the same profile');
                console.log(JSON.stringify(result));
            }
          }
        } finally {
            clearTimeout(timer); closeNetwork?.(); child?.kill();
            if (dirname(profile) === temp && profile.startsWith(`${temp}`) && profile.includes('codex-entry-browser-')) {
                await rm(profile, {recursive: true, force: true, maxRetries: 10, retryDelay: 100}).catch(() => {});
            }
        }
    }
}
