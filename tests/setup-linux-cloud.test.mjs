import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

// Shell regression fixture only: no network, npm installation or real browser.
const bash = process.env.BASH_PATH || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash');
const script = fileURLToPath(new URL('../scripts/setup-linux-cloud.sh', import.meta.url)).replaceAll('\\', '/');
const mocks = String.raw`
uname() { if [[ "$1" == -s ]]; then echo Linux; else echo x86_64; fi; }
npm() { echo "npm $*" >> "$FIXTURE_LOG"; }
node() { echo "node $*" >> "$FIXTURE_LOG"; }
java() { echo 'java fixture'; }
md5sum() { return 90; }
apt-cache() { printf 'libatk1.0-0t64\n  Depends: libc6\nlibc6\n'; }
dpkg-query() { if [[ "$3" == libc6 ]]; then printf installed; fi; }
apt-get() { [[ "$1" == download ]] || return 93; printf fixture > libfixture.deb; }
curl() {
    echo download >> "$FIXTURE_LOG"
    while [[ $# -gt 0 ]]; do
        if [[ "$1" == --output ]]; then printf fixture > "$2"; return; fi
        shift
    done
    return 91
}
dpkg-deb() {
    local target
    case "$2" in
        */chrome.deb) target="$3/opt/google/chrome/google-chrome" ;;
        */edge.deb) target="$3/opt/microsoft/msedge/msedge" ;;
        */libfixture.deb) mkdir -p "$3/usr/lib/x86_64-linux-gnu"; return ;;
        *) return 92 ;;
    esac
    mkdir -p "$(dirname "$target")"
    printf '#!/usr/bin/env bash\nif [[ "$FIXTURE_REQUIRE_LIBS" == 1 && -z "$LD_LIBRARY_PATH" ]]; then exit 127; fi\necho Browser-fixture\n' > "$target"
    chmod +x "$target"
}
setup_script="$1"; shift
source "$setup_script" "$@"
`;

test('Linux setup shell handles first install, repeat, quoting, check and custom paths without deletion', () => {
    const base = mkdtempSync(join(tmpdir(), 'codex-cloud-setup-test-'));
    const tools = join(base, "tools with ' quote").replaceAll('\\', '/');
    const cache = join(base, 'cache').replaceAll('\\', '/');
    const env = {...process.env, CLOUD_TOOLS_DIR: tools, FIREBASE_EMULATORS_PATH: cache,
        CHROME_PATH: '', EDGE_PATH: '', FIXTURE_REQUIRE_LIBS: '', FIXTURE_LOG: join(base, 'calls.log').replaceAll('\\', '/')};
    const run = (args = [], overrides = {}) => spawnSync(bash, ['-c', mocks, 'fixture', script, ...args],
        {env: {...env, ...overrides}, encoding: 'utf8', windowsHide: true, timeout: 30000});
    try {
        mkdirSync(join(tools, 'chrome'), {recursive: true});
        const sentinel = join(tools, 'chrome', 'keep.txt'); writeFileSync(sentinel, 'preserve');
        const first = run(); assert.equal(first.status, 0, first.stderr);
        assert.equal(existsSync(sentinel), true);
        assert.match(first.stdout, /Chrome: Browser-fixture/);
        const repeated = run(); assert.equal(repeated.status, 0, repeated.stderr);
        assert.doesNotMatch(repeated.stdout, /Download/);
        const exports = spawnSync(bash, ['-c', 'source "$1"; printf "%s\\n" "$FIREBASE_EMULATORS_PATH" "$CHROME_PATH"',
            'fixture', `${tools}/environment.sh`], {encoding: 'utf8', windowsHide: true});
        assert.equal(exports.status, 0, exports.stderr);
        assert.equal(exports.stdout.trim(), `${cache}\n${tools}/chrome/opt/google/chrome/google-chrome`);
        const check = run(['--check']); assert.equal(check.status, 0, check.stderr);
        assert.doesNotMatch(check.stdout, /Installazione|Download|Setup completato/);
        const unknown = run(['--unexpected']); assert.equal(unknown.status, 64);
        const custom = run([], {CHROME_PATH: `${tools}/chrome/missing-browser`});
        assert.notEqual(custom.status, 0); assert.match(custom.stderr, /personalizzato non disponibile/);
        assert.equal(existsSync(sentinel), true);
        const libraries = run([], {FIXTURE_REQUIRE_LIBS: '1', LD_LIBRARY_PATH: ''});
        assert.equal(libraries.status, 0, libraries.stderr);
        const wrapped = spawnSync(bash, ['-c', 'source "$1"; "$CHROME_PATH" --version; "$EDGE_PATH" --version',
            'fixture', `${tools}/environment.sh`], {env: {...env, FIXTURE_REQUIRE_LIBS: '1', LD_LIBRARY_PATH: ''},
            encoding: 'utf8', windowsHide: true});
        assert.equal(wrapped.status, 0, wrapped.stderr);
        assert.equal(wrapped.stdout.trim(), 'Browser-fixture\nBrowser-fixture');
    } finally {
        // Exact disposable directory created above, never an environment override.
        assert.equal(dirname(base), resolve(tmpdir()));
        rmSync(base, {recursive: true, force: true});
    }
});
