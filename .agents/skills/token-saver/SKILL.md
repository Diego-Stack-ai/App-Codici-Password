---
name: token-saver
description: Maintains a lightweight per-project Graphify code map and reduces unnecessary context during codebase work. Use when starting work in a repository, analyzing architecture or cross-file behavior, debugging across files, or when the user asks to minimize token use. Skip non-project chat and never start semantic document extraction automatically.
---

# Token Saver

Keep a reusable project map available without spending LLM tokens unnecessarily. The automatic path indexes code structurally; semantic extraction of documents, papers, or images remains an explicit, task-driven choice.

## Prepare repositories for Codex Cloud

Personal skills on the local computer are not available in Codex Cloud. When the current project is a Git repository and `.agents/skills/token-saver/SKILL.md` is absent, run:

```text
python <skill-dir>/scripts/bootstrap_cloud.py .
```

Use `python3` if `python` is unavailable. The bootstrap adds a repository-scoped copy of this skill, marked blocks in the root `AGENTS.md` and `.graphifyignore`, and `.codex/setup-token-saver-cloud.sh`. It preserves existing instructions, does not commit anything, and does not overwrite an existing repository skill unless the user explicitly requests `--force`.

For a Codex Cloud environment, use this install command and then publish or republish the environment:

```text
bash .codex/setup-token-saver-cloud.sh
```

Do not create a cloud environment, commit the bootstrap files, or broaden network access without the user's authorization for that repository.

## Ensure the project map

At the beginning of work in a software project, run the bundled status helper from the project root:

```text
python <skill-dir>/scripts/project_graph.py . --ensure-code
```

The helper resolves the Git root when possible, excludes generated and vendor directories, and prints JSON.

Interpret the result as follows:

- `current`: reuse the existing map.
- `action: created` or `action: updated`: the code map is ready.
- `empty`: no supported code or content exists; stop without creating a map.
- `content_only`: do not loop or force a code map. Use the Graphify skill only when the current task genuinely needs semantic mapping.
- `graphify_missing` or `error`: report the concise cause. If mapping is needed, follow the installed Graphify skill's setup or recovery guidance.
- `semantic_stale`: the code map is usable, but newer documents exist. Refresh semantic content only when those documents matter to the task.

The helper may create or update `graphify-out/`, but it must not install Git hooks, commit generated files, create a cross-project global graph, or force past Graphify's shrink guard.

## Route context economically

- For a direct one-file change or an exact symbol lookup, use `rg` and read only the relevant sections. Do not query the graph merely because it exists.
- For architecture, data flow, ownership, impact, or cross-file questions, query the existing graph first:

```text
graphify query "<question>" --budget 1500
```

- Use roughly 800 tokens for narrow lookups, 1500 by default, and up to 2500 only when the question crosses several subsystems.
- Treat graph output as a navigation index. Before editing, verify exact behavior in the cited source files.
- If there is no usable graph and the question requires relationships, follow the Graphify skill rather than scanning the whole repository blindly.

## Keep the map fresh

After changing code, run the helper again before the final response when the task changed multiple files, public interfaces, dependencies, or architecture. A small isolated edit may leave refresh until the next project task.

If documents or other semantic sources changed, refresh them only when they are part of the current question. Code-only extraction and incremental code updates require no LLM or API key; semantic extraction can consume tokens.

## Report honestly

Do not claim a percentage saving from the existence of the skill or graph. Report measured savings only when a benchmark compares equivalent real workloads. A missing or stale graph is a routing condition, not evidence that the task failed.
