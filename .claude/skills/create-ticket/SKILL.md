---
name: create-ticket
description: Turns a single reported bug into a ready-to-implement spec in one pass, skipping the back-and-forth Q&A of groom-story. Investigates the codebase, fills in missing details, and produces an editable outline; after approval it writes the card directly into .kanban/boards/features/groomed/ linked to the active feature. Also fast-tracks a small, self-contained polish enhancement straight to a fully groomed story with no user input. USE FOR: capturing a bug that needs fixing now; turning a concrete defect report into an actionable spec without a grooming dialogue; capturing a small polish enhancement that needs no design decisions.
---

# Create Ticket

You are turning a single reported bug into an implementation-ready spec in one pass. There is no grooming dialogue — you take the issue as described, investigate the codebase, fill in the gaps, and converge on an approved outline before writing the final card.

**One ticket, one issue.** If the user describes several unrelated problems, do not fold them into a single card — say so and create separate tickets, one per issue. Small, single-issue tickets are always preferable to a bundled fix; they are easier to verify, review, and roll back independently.

If the request is neither a bug nor a **polish fast-track** (below) — a substantial enhancement, a new capability, an idea — this is the wrong skill. Point the user to `/create-story` (to capture it) or `/groom-story` (to spec it).

### Polish fast-track

A small enhancement may skip grooming entirely and be written as a groomed `polish` story. It qualifies only when **all** of these hold:

- It improves an already-functional area (usability, informational, or visual) — it adds no new capability.
- It is small and isolated: one component or screen family, no new endpoints, no data-file or schema change (so no migration), no new `custom-ui` component.
- Every decision is resolvable from codebase conventions. If a genuine design choice remains (new visual treatment with several plausible options, behavior the user must decide), it does not qualify — point to `/create-story` or `/groom-story`.

A polish story follows the same investigation as a ticket, but **skips Phase 2 and Phase 3**: do not present an outline or wait for approval. Go straight to Phase 4 and write the card with `labels: ['polish']`. The Goal describes the improvement achieved rather than a bug no longer occurring. Every assumption is still recorded in Implementation Details, and the final message lists them so the user can veto before running `/implement-story`.

## Phase 1 — Codebase investigation

Take the issue from the user's invocation. Do **not** wait for further input and do **not** ask clarifying questions yet.

Silently investigate every area the issue touches:

- Locate the relevant source files using Glob and Grep.
- Read the key sections of those files to understand current behavior, data shapes, and integration points.
- Note any constraints, patterns, or conventions that will affect the fix (e.g., existing component structure, API conventions, data schema).
- Identify anything the user did **not** specify that is needed to implement the fix (missing data shapes, unclear edge cases, undecided UI behavior).

Make a best-guess decision for every unspecified detail based on existing codebase conventions. Do not ask the user about these — record your assumptions and surface them in the outline.

**If the fix adds or changes client-side UI**, read `public/js/custom-ui/COMPOSITION.md` before deciding any layout, `size`, `widthScale`, `gap`, or `padding` (skip this if the file does not exist). Take those choices from the guide and from comparable existing screens, not from whatever controls happen to sit nearby — the guide starts every control at the default `medium` size, and a non-default `size` is a deliberate density change for a whole segment. Record any non-default `size` in the outline's Assumptions with its reason, so the user can veto it.

Also check the **abandoned index**: read `project-management/abandoned.md` for an entry covering the same ground. A re-reported bug (or re-proposed polish) often maps to a card that was already ruled out, and the abandonment reasoning is usually the answer to why the bug still exists. This index is **advisory** — it never blocks the ticket. If an entry matches, read that card's `## Abandoned <date>` section in `.kanban/boards/features/abandoned/`, and surface it in the Phase 2 outline under a clearly labelled heading — what was tried, what ruled it out, and the reconsider-if condition — so the user can confirm before the ticket is written (for a polish fast-track, which has no outline, surface the match in chat and wait for confirmation instead of fast-tracking). If they proceed, carry the prior attempt into the ticket's Implementation Details. Also **amend or remove the matched ledger entry** — a go-ahead contradicts the warning it carries, and a stale entry cautioning against shipped work is worse than none.

Also resolve the **active feature**: run `git branch --show-current` and look for a card whose `id` matches the branch name and whose `labels` contain `feature` (check `.kanban/boards/features/in-progress/` first, then the other lanes). If found, the ticket is linked to it. If no feature card matches the branch, skip linking.

## Phase 2 — Preliminary outline

Present the outline as a structured but informal list — not the full card format yet. It must cover:

1. **Problem** — one or two sentences restating the bug in your own words, including the observed symptom and (if you found it) the root cause.
2. **Scope** — bullet list of what is in scope and, if helpful, what is explicitly out of scope.
3. **Work items** — a flat or loosely grouped list of the concrete things that need to happen. Each item should be short (one sentence) but unambiguous.
4. **Your assumptions** — a clearly labelled section listing every detail you filled in that the user did not specify. For each assumption, state what you decided and why (convention match, simplicity, existing pattern). This section must be present even if minimal.
5. **Category** — `blocker` (breaking bug — prevents essential function) or `defect` (non-breaking bug — occurs in known edge cases and can be avoided). These are the only two options; if the issue fits neither, say so and suggest `create-story` instead.
6. **Feature** — the active feature this ticket links to, or a note that it stays unaffiliated.
7. **Open questions** — if anything truly cannot be resolved from the codebase or convention, list it here. Keep this short; prefer assumptions over questions.

Format the outline with plain markdown — no card headers, no checkbox lists, no phase headings. Keep it scannable. The user should be able to read the whole outline in under two minutes.

End the outline with:

> Review the outline above. Reply with any changes you want (I'll update it), or say **"approved"** to generate the final spec.

## Phase 3 — Revision loop

Each time the user requests a change:

1. Acknowledge the change in one sentence.
2. Print only the updated item(s) — do **not** reprint the full outline. Label each with its number and title so the user can locate it.
3. End again with the same approval prompt.

If the user explicitly asks to see the full outline reprinted, do so in full. Otherwise, keep responses to only the changed items.

Repeat until the user says "approved" (case-insensitive).

## Phase 4 — Card generation

Convert the approved outline into a card at the same quality and format as a groomed spec.

### Output file structure

```markdown
---
version: 1
id: '<slug>'
boardId: 'features'
status: 'groomed'
priority: '<high | medium | low>'
assignee: null
dueDate: null
created: '<current UTC time in ISO 8601 format>'
modified: '<current UTC time in ISO 8601 format>'
completedAt: null
labels: ['<blocker | defect | polish>']
attachments: []
order: 'a0'
metadata:
  feature: '<active-feature-id>'
---

# <Ticket Title>

## Goal

<Concise description of the desired outcome — the bug no longer occurring. No implementation steps.>

## Tasks

### Phase 1 — <Short milestone description>

- [ ] Complete initial implementation
  - Task description one
  - Task description two

## Implementation Details

<Code snippets, data shapes, constraints, and design decisions. Capture every assumption from the outline here.>
```

Include the `metadata` block only when an active feature was resolved; omit the key entirely otherwise. Most tickets are a single phase — use more only when the fix genuinely has separable, independently testable milestones.

### Per-phase progress tracking

- Each phase carries exactly **one** tracked checkbox, labeled `Complete initial implementation`.
- Concrete tasks are plain **nested bullets** beneath it — no checkboxes on them.
- Leave the phase checkbox unchecked (`- [ ]`).
- Post-phase fixes are added later by `implement-story` as sibling checkboxes named after the fix. Do not create a `#### Fixes and Changes` subheader — that convention is retired.

### Task standards

Apply all standards from `groom-story`:

- Each nested bullet describes a single outcome that can be verified — by automated tests or a brief observable check.
- Name exact file paths and the specific function or section to change. Never write "and related files" or "all callers".
- Any project jargon used must be defined in Implementation Details.
- Test bullets specify what to assert, not just "add a test".
- Capture every assumption from the outline in Implementation Details.

### Docs-review bullet (always append)

Append as the final nested bullet of the last phase:

```
  - Review and update affected living docs: <comma-separated list>
```

Mapping ticket scope to affected docs:

| Ticket touches…                             | Likely affected docs            |
| ------------------------------------------- | ------------------------------- |
| AnyTale (characters, parts, plots, outfits) | `docs/features/anytale.md`      |
| Ambient brew / sound sources                | `docs/features/ambient-brew.md` |
| Main gallery, generation form, inpaint      | `docs/features/main-gallery.md` |
| ComfyUI workflow config, pre/post tasks     | `docs/workflow.md`              |
| New or changed API endpoints                | `docs/server.md`                |
| New `custom-ui` components                  | `docs/components.md`            |
| New pages (changes to `hamburger-menu.mjs`) | `docs/scaffolding.md`           |
| Backend architecture, new feature domains   | `docs/architecture.md`          |
| Client-side patterns, component strategy    | `.claude/rules/client.md`       |
| Server-side patterns, domain structure      | `.claude/rules/server.md`       |
| Project management, board, card format      | `.claude/rules/planning.md`     |

If the ticket is a pure bug fix that changes no documented behavior, the docs-review bullet may state that no docs are affected — but include the bullet so the check is explicit.

### Data migration tasks

If the fix changes any tracked data file (`server/database/*.json`, `config.json`), include:

1. A migration script bullet at `scripts/migrate/<domain>/<N>-to-<M>.mjs`.
2. A bullet to bump `currentVersion` in `server/core/data-versions.mjs`.

Include the migration script interface in Implementation Details:

```js
// scripts/migrate/<domain>/<N>-to-<M>.mjs
export const fromVersion = N
export const toVersion = M

/**
 * @param {Object} data - Parsed JSON data (do not set data.version — the migrator handles that)
 * @returns {Object} The migrated data object
 */
export function migrate(data) {
  // ... transform data ...
  return data
}
```

`migrate(data)` must be idempotent and guarded — safe to run twice against its own output with the second run a no-op (gate destructive renames/moves on the absence of the destination field; use `??`/`!Array.isArray(x)`/`x === undefined` guards for default-fills). This matters because `migrateDataObject` (`server/core/migrator.mjs`) runs migrations in-memory against arbitrary source versions during AnyTale library/tale import, not only as a startup chain — see `docs/architecture.md`'s Data Versioning section.

If the fix adds or changes a domain's write path, its single write function should stamp `data.version = getCurrentVersion(domain)` before writing, so a freshly created file is never mistaken for version `0` on the next restart.

### Writing the file

1. Derive a kebab-case slug from the ticket title.
2. Write the card to `.kanban/boards/features/groomed/<slug>.md` using the Write tool.
3. Run `npx prettier . --write` to format the new card.

### Final message

After writing the file, send exactly:

> Ticket written to [<slug>](.kanban/boards/features/groomed/<slug>.md). Run `/implement-story <slug>.md` to begin work immediately.

For a polish fast-track, say "Polish story written to …" instead, and follow the line with a short bullet list of the assumptions made, since the user never saw an outline.

## Rules

- Do **not** modify any source code.
- Do **not** wait for additional input before investigating — the issue as described in the invocation is the brief.
- Do **not** ask questions during Phase 1 — investigate and assume.
- Do **not** bundle multiple unrelated issues into one ticket. Create one ticket per issue.
- Do **not** skip the assumptions section in the outline — even if you are highly confident, name every decision the user did not make.
- Every written card must carry exactly one category label (`blocker` or `defect`; `polish` for a fast-tracked polish story) in `labels`; do not invent new category names, and never assign `feature`.
- Use `metadata.feature`, never a bare top-level `feature:` field. Kanban Lite strips unknown top-level frontmatter keys when the board rewrites a card.
- Do **not** invoke `implement-story` automatically — the user must run it manually.
