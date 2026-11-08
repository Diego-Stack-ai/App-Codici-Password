#!/usr/bin/env python3
"""Install token-saver into a repository and add a Codex Cloud setup entrypoint."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import shutil
import stat
import sys


START_MARKER = "<!-- token-saver:start -->"
END_MARKER = "<!-- token-saver:end -->"
IGNORE_START_MARKER = "# token-saver:start"
IGNORE_END_MARKER = "# token-saver:end"
AGENTS_BLOCK = f"""{START_MARKER}
## Token-efficient project mapping

- At the start of work in this repository, invoke `$token-saver` once to ensure `graphify-out/graph.json` is present and current. Keep automatic extraction code-only; run semantic document extraction only when the task needs it.
{END_MARKER}"""

GRAPHIFYIGNORE_BLOCK = f"""{IGNORE_START_MARKER}
.agents/
.codex/
{IGNORE_END_MARKER}"""

CLOUD_SETUP = """#!/usr/bin/env bash
set -euo pipefail

# Managed by token-saver. Codex Cloud install script entrypoint.
python -m pip install --upgrade graphifyy
python .agents/skills/token-saver/scripts/project_graph.py . --ensure-code
"""

SKILL_FILES = (
    Path("SKILL.md"),
    Path("agents/openai.yaml"),
    Path("scripts/project_graph.py"),
    Path("scripts/bootstrap_cloud.py"),
)


def git_root(raw_path: str) -> Path:
    start = Path(raw_path).expanduser().resolve()
    if start.is_file():
        start = start.parent
    if not start.exists() or not start.is_dir():
        raise ValueError(f"Project path is not a directory: {start}")
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists():
            return candidate
    raise ValueError(f"No Git repository found from: {start}")


def copy_skill(source: Path, target: Path, force: bool) -> str:
    if source.resolve() == target.resolve():
        return "already_repository_scoped"
    if target.exists() and not force:
        return "preserved_existing"
    for relative in SKILL_FILES:
        source_file = source / relative
        if not source_file.is_file():
            raise FileNotFoundError(f"Missing skill file: {source_file}")
        target_file = target / relative
        target_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, target_file)
    return "updated" if force else "created"


def update_agents(root: Path) -> str:
    path = root / "AGENTS.md"
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    if START_MARKER in existing and END_MARKER in existing:
        return "already_present"
    if START_MARKER in existing or END_MARKER in existing:
        raise ValueError(f"Incomplete token-saver marker block in {path}")
    prefix = existing.rstrip()
    if prefix:
        content = prefix + "\n\n" + AGENTS_BLOCK + "\n"
    else:
        content = "# Project instructions\n\n" + AGENTS_BLOCK + "\n"
    path.write_text(content, encoding="utf-8")
    return "updated" if existing else "created"


def update_graphifyignore(root: Path) -> str:
    path = root / ".graphifyignore"
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    if IGNORE_START_MARKER in existing and IGNORE_END_MARKER in existing:
        return "already_present"
    if IGNORE_START_MARKER in existing or IGNORE_END_MARKER in existing:
        raise ValueError(f"Incomplete token-saver marker block in {path}")
    prefix = existing.rstrip()
    content = prefix + "\n\n" + GRAPHIFYIGNORE_BLOCK + "\n" if prefix else GRAPHIFYIGNORE_BLOCK + "\n"
    path.write_text(content, encoding="utf-8")
    return "updated" if existing else "created"


def write_cloud_setup(root: Path, force: bool) -> str:
    path = root / ".codex" / "setup-token-saver-cloud.sh"
    if path.exists() and not force:
        existing = path.read_text(encoding="utf-8", errors="replace")
        if "Managed by token-saver" not in existing:
            return "preserved_existing"
        if existing == CLOUD_SETUP:
            return "already_present"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(CLOUD_SETUP, encoding="utf-8", newline="\n")
    try:
        path.chmod(path.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    except OSError:
        pass
    return "updated" if force else "created"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add repo-scoped token-saver files and a Codex Cloud setup script."
    )
    parser.add_argument("path", nargs="?", default=".", help="Path inside the target Git repository")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace an existing repo-scoped token-saver skill and managed setup script",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        root = git_root(args.path)
        source_skill = Path(__file__).resolve().parents[1]
        target_skill = root / ".agents" / "skills" / "token-saver"
        result = {
            "status": "ready",
            "root": str(root),
            "repo_skill": copy_skill(source_skill, target_skill, args.force),
            "agents_md": update_agents(root),
            "graphifyignore": update_graphifyignore(root),
            "cloud_setup": write_cloud_setup(root, args.force),
            "cloud_install_command": "bash .codex/setup-token-saver-cloud.sh",
            "committed": False,
        }
    except Exception as exc:
        result = {"status": "error", "error": str(exc)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["status"] == "error" else 0


if __name__ == "__main__":
    sys.exit(main())
