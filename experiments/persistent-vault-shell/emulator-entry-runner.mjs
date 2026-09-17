import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {assertEveryBrowserReported, attachEntryNetworkControl} from './emulator-network-control.mjs';

// Test runner for the laboratory entry checks. Each browser of the matrix is
// identified by name and path, awaited, and reported exactly once: a browser that
// never produces an outcome, an outcome without identity or the same browser twice
// all fail the run instead of being hidden.
export async function runEntryBrowsers(nextReport, {restart = false, forced = false} = {}) {
    if (forced && !restart) throw new Error('FORCED_RESTART_REQUIRED');
    const browserSelection = process.env.VAULT_SHELL_BROWSER || 'all';
    if (!['all', 'chrome', 'edge'].includes(browserSelection)) throw new Error('ENTRY_BROWSER_SELECTION_INVALID');
    const executable = (override, windows, other) => override || (process.platform === 'win32' ? windows : other);
    const candidates = [
        {name: 'chrome', path: executable(process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome')},
        {name: 'edge', path: executable(process.env.EDGE_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/microsoft-edge')}
    ];
    const browsers = browserSelection === 'all' ? candidates : [candidates.find(entry => entry.name === browserSelection)];
    const completed = [];
    for (const entry of browsers) {
        if (!existsSync(entry.path)) throw new Error(`ENTRY_BROWSER_MISSING:${entry.name}:${entry.path}`);
        const temp = resolve(tmpdir()), profile = await mkdtemp(`${temp}/codex-entry-browser-`);
        let child, timer, closeNetwork;
        try {
          for (const restartPhase of restart ? ['prepare', 'resume'] : [undefined]) {
            let receiveReport;
            const report = Promise.race([nextReport(), new Promise(resolve => { receiveReport = resolve; })]);
            const spawnArgs = ['--headless=new', ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
                '--disable-gpu', '--no-first-run', '--disable-sync', '--disable-background-networking', '--disable-background-mode', '--remote-debugging-port=0', `--user-data-dir=${profile}`, restart ? 'about:blank' : 'http://127.0.0.1:4188/'];
            const describe = () => ({browser: entry.name, path: entry.path, args: spawnArgs, exitCode: child?.exitCode ?? null});
            child = spawn(entry.path, spawnArgs, {windowsHide: true, detached: forced && process.platform !== 'win32', stdio: ['ignore', 'ignore', 'pipe']});
            closeNetwork = await attachEntryNetworkControl(child, {restartPhase, forced, onReport: receiveReport, describe});
            const result = await Promise.race([report, new Promise((_, reject) => {
                child.on('error', reject); timer = setTimeout(async () => {
                    const state = await Promise.race([closeNetwork?.inspect?.().catch(() => 'unavailable'),
                        new Promise(resolve => setTimeout(() => resolve('unavailable'), 1000))]);
                    reject(new Error(`ENTRY_BROWSER_TIMEOUT:${entry.name}:${JSON.stringify(state)}`));
                }, 60000);
            })]);
            clearTimeout(timer);
            if (!result.ok) throw new Error(JSON.stringify({browser: entry.name, path: entry.path, ...result}));
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
                console.log(JSON.stringify({browser: entry.name, path: entry.path, ...result}));
            }
          }
        } catch (error) {
            // The failure carries the browser identity and the sanitized stderr, so a
            // browser that never reaches its endpoint can be diagnosed, not guessed.
            throw new Error(`${entry.name}: ${error?.message ?? error}`);
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
        completed.push({browser: entry.name, path: entry.path});
    }
    assertEveryBrowserReported({browsers, results: completed});
}
