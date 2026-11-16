# Architecture

VR180 Studio is an Express 5 server plus a build-free Preact client, carried over from AnyTale.

## Client (`public/`)

- **No build step.** Pages are static HTML in `public/` that load ES modules through an import map (`public/index.html`). Vendored libraries live in `public/lib/` and are fetched by `npm run libs` (`scripts/download-libs.mjs`, configured by `scripts/lib.config.json`): Preact, Preact hooks/compat/signals, htm, goober, and boxicons. Fonts land in `public/fonts/` with `public/css/fonts.css`.
- **Components.** `public/js/custom-ui/` is the shared component library (see `docs/components.md`), frozen against rework — additive changes only (see `.claude/rules/client.md`). Project-specific components go in `public/js/app-ui/`.
- **Shared code.** `public/js/shared/` holds modules that run in both browser and server; today only `logger.mjs`.
- **Routing.** The server serves `public/` with `extensions: ['html']` and 301-redirects `/x.html` to `/x`, so a new page is `public/<name>.html` plus `public/js/<name>.mjs` with no server route.

## Server (`server/`)

- `server/server.mjs` — entry point: ensures `server/database/` and `server/logs/` exist, runs `migrateAll()`, loads config, serves `public/`, mounts feature routers, exposes `GET /status`.
- `server/core/` — `paths.mjs` (all path constants), `config.mjs` (loads `config.json`, created from `config.default.json` on first run, sanitized against `server/resource/schemas/config.schema.json`), `logger.mjs`, `sanitizer.mjs` (Ajv `sanitize`/`validate`), `data-versions.mjs` + `migrator.mjs` (data versioning, below), `child-process.mjs` (the only allowed `child_process` import; defaults `windowsHide: true`).
- `server/features/<domain>/` — one folder per domain (router, service, repository, sanitizer, co-located tests). None exist yet.
- Default port: `3180` (`server/config.default.json`).

## Data versioning

Every persisted JSON file is a registered domain in `server/core/data-versions.mjs`'s `DATA_DOMAINS` with a `currentVersion`. On startup `migrateAll()` walks each domain's file from its stored `version` up to `currentVersion` using `scripts/migrate/<domain>/<N>-to-<M>.mjs`, writing a backup to `scripts/migrate/backups/` first. Only `config` is registered today (version 1).

## Project management

Kanban Lite board under `.kanban/` (`npm run kanban`, port 2956), driven by the skills in `.claude/skills/` per `.claude/rules/planning.md`. Completed features are summarized in `project-management/archived/`; abandoned work is indexed in `project-management/abandoned.md`.
