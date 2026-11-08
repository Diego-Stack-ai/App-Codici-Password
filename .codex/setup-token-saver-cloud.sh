#!/usr/bin/env bash
set -euo pipefail

# Managed by token-saver. Codex Cloud install script entrypoint.
python -m pip install --upgrade graphifyy
python .agents/skills/token-saver/scripts/project_graph.py . --ensure-code
