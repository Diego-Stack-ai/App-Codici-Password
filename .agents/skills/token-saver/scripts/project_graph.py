#!/usr/bin/env python3
"""Check and maintain a lightweight, code-only Graphify map for a project."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Iterable


CODE_SUFFIXES = {
    ".c", ".cc", ".cpp", ".cs", ".dart", ".ex", ".exs", ".fs", ".fsx",
    ".go", ".h", ".hpp", ".java", ".js", ".jsx", ".kt", ".kts", ".lua",
    ".m", ".mm", ".php", ".pl", ".pm", ".ps1", ".py", ".r", ".rb", ".rs",
    ".scala", ".sh", ".sql", ".swift", ".svelte", ".ts", ".tsx", ".vue",
}

CONTENT_SUFFIXES = {
    ".adoc", ".csv", ".docx", ".gdoc", ".gsheet", ".gslides", ".html", ".md",
    ".mdx", ".odt", ".pdf", ".pptx", ".rst", ".rtf", ".txt", ".xlsx",
}

EXCLUDED_DIRS = {
    ".agents", ".codex", ".git", ".hg", ".svn", ".cache", ".idea", ".next",
    ".nuxt", ".pytest_cache", ".tox", ".venv", ".vscode", "__pycache__", "build", "coverage", "dist",
    "graphify-out", "node_modules", "target", "vendor", "venv",
}


def project_root(raw_path: str) -> Path:
    start = Path(raw_path).expanduser().resolve()
    if start.is_file():
        start = start.parent
    if not start.exists() or not start.is_dir():
        raise ValueError(f"Project path is not a directory: {start}")
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists():
            return candidate
    return start


def scan_files(root: Path) -> tuple[list[Path], list[Path]]:
    code: list[Path] = []
    content: list[Path] = []
    for current, dirs, files in os.walk(root, topdown=True):
        dirs[:] = [name for name in dirs if name not in EXCLUDED_DIRS]
        base = Path(current)
        for name in files:
            path = base / name
            suffix = path.suffix.lower()
            if suffix in CODE_SUFFIXES:
                code.append(path)
            elif suffix in CONTENT_SUFFIXES:
                content.append(path)
    return code, content


def newer_than(paths: Iterable[Path], timestamp_ns: int) -> list[Path]:
    newer: list[Path] = []
    for path in paths:
        try:
            if path.stat().st_mtime_ns > timestamp_ns:
                newer.append(path)
        except OSError:
            continue
    return newer


def relative_samples(paths: Iterable[Path], root: Path, limit: int = 10) -> list[str]:
    samples: list[str] = []
    for path in paths:
        try:
            samples.append(path.relative_to(root).as_posix())
        except ValueError:
            samples.append(str(path))
        if len(samples) >= limit:
            break
    return samples


def inspect(root: Path) -> dict[str, object]:
    code, content = scan_files(root)
    graph = root / "graphify-out" / "graph.json"
    result: dict[str, object] = {
        "root": str(root),
        "graph": str(graph),
        "graph_exists": graph.is_file(),
        "code_files": len(code),
        "content_files": len(content),
        "newer_code_files": 0,
        "newer_content_files": 0,
        "newer_code_samples": [],
        "newer_content_samples": [],
    }

    if not code and not content:
        result["status"] = "empty"
        return result
    if not graph.is_file():
        result["status"] = "missing" if code else "content_only"
        return result

    graph_mtime = graph.stat().st_mtime_ns
    newer_code = newer_than(code, graph_mtime)
    newer_content = newer_than(content, graph_mtime)
    result["newer_code_files"] = len(newer_code)
    result["newer_content_files"] = len(newer_content)
    result["newer_code_samples"] = relative_samples(newer_code, root)
    result["newer_content_samples"] = relative_samples(newer_content, root)

    if newer_code:
        result["status"] = "stale_code"
    elif newer_content:
        result["status"] = "semantic_stale"
    else:
        result["status"] = "current"
    return result


def run_graphify(root: Path, update: bool) -> tuple[int, str]:
    executable = shutil.which("graphify")
    if not executable:
        return 127, "graphify executable was not found on PATH"
    command = (
        [executable, "update", str(root), "--no-cluster"]
        if update
        else [executable, "extract", str(root), "--code-only", "--no-cluster"]
    )
    completed = subprocess.run(
        command,
        cwd=root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    combined = "\n".join(part.strip() for part in (completed.stdout, completed.stderr) if part.strip())
    return completed.returncode, combined[-4000:]


def ensure_code_map(root: Path) -> dict[str, object]:
    before = inspect(root)
    status = str(before["status"])
    if status in {"empty", "content_only", "current", "semantic_stale"}:
        before["action"] = "none"
        return before

    update = status == "stale_code"
    return_code, output = run_graphify(root, update=update)
    if return_code == 127:
        before["status"] = "graphify_missing"
        before["action"] = "none"
        before["error"] = output
        return before
    if return_code != 0:
        before["status"] = "error"
        before["action"] = "update_failed" if update else "create_failed"
        before["error"] = output
        before["graphify_exit_code"] = return_code
        return before

    after = inspect(root)
    after["action"] = "updated" if update else "created"
    if output:
        after["graphify_output"] = output
    return after


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check or maintain a code-only Graphify map without using an LLM."
    )
    parser.add_argument("path", nargs="?", default=".", help="Project path (default: current directory)")
    parser.add_argument(
        "--ensure-code",
        action="store_true",
        help="Create a missing code map or incrementally update stale code",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        root = project_root(args.path)
        result = ensure_code_map(root) if args.ensure_code else inspect(root)
    except Exception as exc:
        result = {"status": "error", "error": str(exc)}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result.get("status") in {"error", "graphify_missing"} else 0


if __name__ == "__main__":
    sys.exit(main())
