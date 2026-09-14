#!/usr/bin/env bash
set -euo pipefail

# Workspace-local setup for the Linux cloud runner. It never invokes sudo,
# changes system repositories, or contacts Firebase projects.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="${CLOUD_TOOLS_DIR:-$ROOT/.codex-tmp/cloud-tools}"
export FIREBASE_EMULATORS_PATH="${FIREBASE_EMULATORS_PATH:-$ROOT/.codex-tmp/firebase-emulators}"
ENV_FILE="$TOOLS_DIR/environment.sh"
CHECK_ONLY=false
case "$#:${1:-}" in
    0:) ;;
    1:--check) CHECK_ONLY=true ;;
    *) echo "Uso: $0 [--check]" >&2; exit 64 ;;
esac

require_tool() {
    command -v "$1" >/dev/null || { echo "Strumento richiesto non disponibile: $1" >&2; return 1; }
}
for tool in node npm java curl dpkg-deb md5sum; do require_tool "$tool"; done
[[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || {
    echo "Setup supportato soltanto su Linux x86_64." >&2; exit 1;
}

CHROME_PATH="${CHROME_PATH:-$TOOLS_DIR/chrome/opt/google/chrome/google-chrome}"
EDGE_PATH="${EDGE_PATH:-$TOOLS_DIR/edge/opt/microsoft/msedge/msedge}"
FIRESTORE_INFO="$ROOT/node_modules/firebase-tools/lib/emulator/downloadableEmulatorInfo.json"

report() {
    node --version
    npm --version
    java -version 2>&1 | head -n 1
    for item in "Chrome:$CHROME_PATH" "Edge:$EDGE_PATH"; do
        name="${item%%:*}"; path="${item#*:}"
        [[ -x "$path" ]] && echo "$name: $("$path" --version)" || echo "$name: MANCANTE ($path)"
    done
    if [[ -f "$FIRESTORE_INFO" ]]; then
        node - "$FIRESTORE_INFO" "$FIREBASE_EMULATORS_PATH" <<'NODE'
const fs = require('node:fs'), path = require('node:path');
const [infoPath, cache] = process.argv.slice(2);
const info = require(infoPath).firestore;
const jar = path.join(cache, info.downloadPathRelativeToCacheDir);
console.log(`Firestore emulator: ${fs.existsSync(jar) ? 'PRESENTE' : 'MANCANTE'} (${jar})`);
console.log(`Risorsa richiesta: ${info.remoteUrl}`);
NODE
    else
        echo "Metadati Firebase CLI mancanti: eseguire prima npm ci." >&2
    fi
}

if $CHECK_ONLY; then report; exit 0; fi

mkdir -p "$TOOLS_DIR" "$FIREBASE_EMULATORS_PATH"
echo "Installazione dipendenze bloccate dai package-lock..."
npm ci --prefix "$ROOT"
npm ci --prefix "$ROOT/functions"

BROWSER_LIBRARY_PATH=''
prepare_browser_libraries() {
    [[ -z "$BROWSER_LIBRARY_PATH" ]] || return 0
    for tool in apt-cache apt-get dpkg-query; do require_tool "$tool"; done
    local packages_dir="$TOOLS_DIR/browser-library-packages" library_root="$TOOLS_DIR/browser-libraries"
    mkdir -p "$packages_dir" "$library_root"
    # Ubuntu 24.04 universal image. Read existing apt metadata; download and
    # extract missing dependencies locally, never install system packages.
    local dependency package
    local -a missing=()
    local dependencies
    dependencies="$(apt-cache depends --recurse --no-recommends --no-suggests --no-conflicts --no-breaks --no-replaces --no-enhances \
        libatk1.0-0t64 libatk-bridge2.0-0t64 libnss3 libnspr4 libcups2t64 libasound2t64 \
        libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2)"
    while IFS= read -r dependency; do
        [[ "$dependency" =~ ^[a-z0-9][a-z0-9+.-]*(:[a-z0-9]+)?$ ]] || continue
        if [[ "$(dpkg-query -W -f='${db:Status-Status}' "$dependency" 2>/dev/null || true)" != installed ]]; then
            missing+=("$dependency")
        fi
    done <<< "$dependencies"
    if [[ ${#missing[@]} -gt 0 ]]; then
        (cd "$packages_dir" && apt-get download "${missing[@]}")
        for package in "$packages_dir"/*.deb; do dpkg-deb --extract "$package" "$library_root"; done
    fi
    BROWSER_LIBRARY_PATH="$library_root/usr/lib/x86_64-linux-gnu:$library_root/lib/x86_64-linux-gnu"
}

download_deb() {
    local name="$1" url="$2" destination="$3"
    local archive="$TOOLS_DIR/$name.deb" extract_dir="$TOOLS_DIR/$name"
    if [[ ! -x "$destination" ]]; then
        # A custom executable is used as-is; never derive an extraction/deletion
        # directory from an arbitrary executable path.
        case "$name:$destination" in
            "chrome:$TOOLS_DIR/chrome/opt/google/chrome/google-chrome"|"edge:$TOOLS_DIR/edge/opt/microsoft/msedge/msedge") ;;
            *) echo "Eseguibile personalizzato non disponibile: $destination" >&2; return 1 ;;
        esac
        echo "Download $name da $url"
        curl --fail --location --retry 3 --connect-timeout 20 --output "$archive.part" "$url"
        mv "$archive.part" "$archive"
        mkdir -p "$extract_dir"
        dpkg-deb --extract "$archive" "$extract_dir"
        [[ -x "$destination" ]] || { echo "Eseguibile $name non trovato dopo l'estrazione." >&2; exit 1; }
    fi
    if ! "$destination" --version; then
        prepare_browser_libraries
        LD_LIBRARY_PATH="$BROWSER_LIBRARY_PATH${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" "$destination" --version
    fi
}

download_deb chrome "${CHROME_DEB_URL:-https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb}" "$CHROME_PATH"
download_deb edge "${EDGE_DEB_URL:-https://go.microsoft.com/fwlink/?linkid=2149051}" "$EDGE_PATH"

if [[ -n "$BROWSER_LIBRARY_PATH" ]]; then
    mkdir -p "$TOOLS_DIR/bin"
    for browser_name in chrome edge; do
        if [[ "$browser_name" == chrome ]]; then browser_binary="$CHROME_PATH"; else browser_binary="$EDGE_PATH"; fi
        {
            echo '#!/usr/bin/env bash'
            printf 'export LD_LIBRARY_PATH=%q\n' "$BROWSER_LIBRARY_PATH${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
            printf 'exec %q "$@"\n' "$browser_binary"
        } >"$TOOLS_DIR/bin/$browser_name"
        chmod +x "$TOOLS_DIR/bin/$browser_name"
    done
    CHROME_PATH="$TOOLS_DIR/bin/chrome"
    EDGE_PATH="$TOOLS_DIR/bin/edge"
fi

echo "Preparazione della cache Firestore verificata dalla Firebase CLI locale..."
node "$ROOT/node_modules/firebase-tools/lib/bin/firebase.js" setup:emulators:firestore

{
    echo '# Generato da scripts/setup-linux-cloud.sh; file workspace-local ignorato da Git.'
    printf 'export CHROME_PATH=%q\n' "$CHROME_PATH"
    printf 'export EDGE_PATH=%q\n' "$EDGE_PATH"
    printf 'export FIREBASE_EMULATORS_PATH=%q\n' "$FIREBASE_EMULATORS_PATH"
} >"$ENV_FILE"
echo "Setup completato. Prima dei test: source '$ENV_FILE'"
report
