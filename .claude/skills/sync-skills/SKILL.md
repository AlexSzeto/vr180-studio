---
name: sync-skills
description: "Keep project-local skills for other agents synchronized from this repository's .claude skills. Use when .claude/skills changes, when Codex skills are stale, or when preparing this project so Codex can use the same project workflow skills as Claude."
---

# Sync Skills

Treat `.claude/skills` and `.claude/rules` as the canonical sources for project workflow instructions.

Run:

```bash
npm run sync:codex-skills
npm run sync:antigravity-skills
```

This regenerates `.codex/skills`, `.agents/skills`, `.codex/rules`, and `.agents/rules` from `.claude/skills` and `.claude/rules` by deleting the project-local mirrors and copying the Claude sources into them.

This also regenerates `.agents/skills` and `.agents/rules` from `.claude/skills` and `.claude/rules` by deleting the project-local mirrors and copying the Claude sources into them.

`npm run sync:codex-skills` also regenerates the root `AGENTS.md`, which Codex reads on every run. Codex never auto-loads `.codex/rules/` (Codex uses that folder for its command-approval policy, not markdown instructions), so `AGENTS.md` is how the rules reach it: it tells Codex to read every file in `.claude/rules/` before writing code, listing them by name. Its list is rebuilt from `.claude/rules/` on each sync — never edit `AGENTS.md` by hand; change the generator in `scripts/sync-codex-skills.mjs` instead, and re-run the sync whenever a rule file is added, renamed, or removed.

The `sync-skills` skill itself is excluded from the sync — it is Claude-only and should not appear in `.agents/skills` or `.codex/skills`.

After syncing, run:

```powershell
git status --short
```

Review the copied skill changes before committing.
