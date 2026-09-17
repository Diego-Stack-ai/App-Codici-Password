import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {assertEveryBrowserReported, attachEntryNetworkControl} from './emulator-network-control.mjs';

export async function runEntryBrowsers(nextReport, {restart = false, forced = false} = {}) {
    if (forced && !restart) throw new Error('FORCED_RESTART_REQUIRED');
    const browserSelection = process.env.VAULT_SHELL_BROWSER || 'all';
    if (!['all', 'chrome', 'edge'].includes(browserSelection)) throw new Error('ENTRY_BROWSER_SELECTION_INVALID');
    const available = process.platform === 'win32' ? [process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        process.env.EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'] :
        [process.env.CHROME_PATH || '/usr/bin/google-chrome', process.env.EDGE_PATH || '/usr/bin/microsoft-edge'];
    const browsers = browserSelection === 'all' ? available : [available[browserSelection === 'chrome' ? 0 : 1]];
    // Every browser of the matrix must be awaited, reported and counted: a missing
    // outcome is a failure, never a silent matrix reduction.
    const completed = new Set();
    for (const browser of browsers) {
        if (!existsSync(browser)) throw new Error('ENTRY_BROWSER_MISSING');
        const temp = resolve(tmpdir()), profile = await mkdtemp(`${temp}/codex-entry-browser-`);
        let child, timer, closeNetwork;
        try {
          for (const restartPhase of restart ? ['prepare', 'resume'] : [undefined]) {
            let receiveReport;
            const report = Promise.race([nextReport(), new Promise(resolve => { receiveReport = resolve; })]);
            child = spawn(browser, ['--headless=new', ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
                '--disable-gpu', '--no-first-run', '--disable-sync', '--disable-background-networking', '--disable-background-mode', '--remote-debugging-port=0', `--user-data-dir=${profile}`, restart ? 'about:blank' : 'http://127.0.0.1:4188/'], {windowsHide: true, detached: forced && process.platform !== 'win32', stdio: ['ignore', 'ignore', 'pipe']});
            closeNetwork = await attachEntryNetworkControl(child, {restartPhase, forced, onReport: receiveReport});
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
                if (forced) {
                    // Only the process just spawned with this disposable profile.
                    if (!Number.isSafeInteger(child.pid) || child.exitCode !== null ||
                        !child.spawnargs.includes(`--user-data-dir=${profile}`) || dirname(profile) !== temp ||
                        !profile.includes('codex-entry-browser-')) throw new Error('UNSAFE_TEST_PROCESS');
                    if (process.platform === 'win32') {
                        await new Promise((resolve, reject) => {
                            const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
                            killer.once('error', reject);
                            killer.once('exit', code => code === 0 ? resolve() : reject(new Error('TEST_PROCESS_KILL_FAILED')));
                        });
                    } else process.kill(-child.pid, 'SIGKILL');
                } else await closeNetwork.quitBrowser();
                let exitTimer;
                try { await Promise.race([exited, new Promise((_, reject) => {
                    exitTimer = setTimeout(() => reject(new Error('BROWSER_DID_NOT_EXIT')), 10000);
                })]); } finally { clearTimeout(exitTimer); }
                closeNetwork(); closeNetwork = null; child = null;
            } else {
                if (restart) result.passed.unshift(forced ? 'browser process tree forcibly terminated before offline restart' : 'browser process exited before offline restart with the same profile');
                console.log(JSON.stringify(result));
            }
          }
        } finally {
            clearTimeout(timer); closeNetwork?.(); child?.kill();
            // The browser is allowed to finish exiting before the next one of the
            // matrix starts: a closing process must not disturb the next DevTools
            // endpoint and must not be read as an early exit.
            if (child && child.exitCode === null) {
                await Promise.race([new Promise(resolve => child.once('exit', resolve)),
                    new Promise(resolve => setTimeout(resolve, 2000))]);
            }
            if (dirname(profile) === temp && profile.startsWith(`${temp}`) && profile.includes('codex-entry-browser-')) {
                await rm(profile, {recursive: true, force: true, maxRetries: 10, retryDelay: 100}).catch(() => {});
            }
        }
        completed.add(browser);
    }
    assertEveryBrowserReported({browsers, results: [...completed]});
}
