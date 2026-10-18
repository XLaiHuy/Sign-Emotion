---
name: signemo-codegraph-change
description: Use SignEmo's existing local CodeGraph index to locate implementation, assess change impact and verify refactors.
---

Follow the preserved CodeGraph instructions in AGENTS.md. Only use CodeGraph when `.codegraph/` exists; indexing is a separate user decision. This repo has authorized a local index, not a hosted code upload or global agent reconfiguration.

Before grep/file reads for code discovery, use `codegraph_explore` or `codegraph explore` with exact symbols/files. Read current source and callers; use impact/affected output to choose meaningful regression checks. If the CLI index is stale after new files or moves, sync and inspect status rather than assuming every reference is resolved.

Keep `codegraph.json` exclusions for secrets, media, datasets, public model/runtime binaries, dependencies and build artifacts. Never index consented research material. Preserve this workflow when moving code; verify boundaries/import cycles with `npm run lint` and build/tests, since a graph is not a compiler or test result.
