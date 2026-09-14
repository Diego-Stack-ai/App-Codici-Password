#!/usr/bin/env bash
set -euo pipefail

# Workspace-local setup for the Linux cloud runner. It never invokes sudo,
# changes system repositories, or contacts Firebase projects.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="${CLOUD_TOOLS_DIR:-$ROOT/.codex-tmp/cloud-tools}"
export FIREBASE_EMULATORS_PATH="${FIREBASE_EMULATORS_PATH:-$ROOT/.codex-tmp/firebase-emulators}"
ENV_FILE="$TOOLS_DIR/environment.sh"
CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true
[[ $# -le 1 ]] || { echo "Uso: $0 [--check]" >&2; exit 64; }

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
        [[ -x "$path" ]] && echo "$name: $($path --version)" || echo "$name: MANCANTE ($path)"
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

download_deb() {
    local name="$1" url="$2" destination="$3" archive="$TOOLS_DIR/$name.deb"
    if [[ ! -x "$destination" ]]; then
        echo "Download $name da $url"
        curl --fail --location --retry 3 --connect-timeout 20 --output "$archive.part" "$url"
        mv "$archive.part" "$archive"
        rm -rf "${destination%%/opt/*}"
        mkdir -p "${destination%%/opt/*}"
        dpkg-deb --extract "$archive" "${destination%%/opt/*}"
        [[ -x "$destination" ]] || { echo "Eseguibile $name non trovato dopo l'estrazione." >&2; exit 1; }
    fi
    "$destination" --version
}

download_deb chrome "${CHROME_DEB_URL:-https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb}" "$CHROME_PATH"
download_deb edge "${EDGE_DEB_URL:-https://go.microsoft.com/fwlink/?linkid=2149051}" "$EDGE_PATH"

echo "Preparazione della cache Firestore verificata dalla Firebase CLI locale..."
node "$ROOT/node_modules/firebase-tools/lib/bin/firebase.js" setup:emulators:firestore

cat >"$ENV_FILE" <<EOF
# Generato da scripts/setup-linux-cloud.sh; file workspace-local ignorato da Git.
export CHROME_PATH='$CHROME_PATH'
export EDGE_PATH='$EDGE_PATH'
export FIREBASE_EMULATORS_PATH='$FIREBASE_EMULATORS_PATH'
EOF
echo "Setup completato. Prima dei test: source '$ENV_FILE'"
report
