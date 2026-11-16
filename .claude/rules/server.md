---
description: when working on the server side of the website
---

## 4. Backend Architecture (Domain-Driven)

The backend is organized into **Feature Domains** to avoid monolithic files. Each domain is a self-contained folder in `server/features/` managing its own routes, business logic, and data access.

### Directory Structure

- **`server/server.mjs`**: Entry point. Initializes Express, runs migrations (`await migrateAll()`), loads config, and mounts domain routers.
- **`server/core/`**: Shared foundational code (config, logger, data versioning — migrator, sanitizer — and the child-process wrapper).
- **`server/features/<domain>/`**: one folder per domain, each following the same shape:
  - `router.mjs`: Express router — endpoint definitions only, mounted from `server.mjs`.
  - `service.mjs`: Domain logic.
  - `repository.mjs`: Data access for the domain's JSON file in `server/database/`.
  - `sanitizer.mjs`: Domain sanitize/validate wrapper (see Schemas below).
  - `router.test.mjs` / `service.test.mjs`: Co-located tests.

### Design Patterns

- **Service Layer**: Routes should **never** contain business logic. They should extract parameters and call a Service.
- **Repository Pattern**: Data access is isolated. `server.mjs` should never touch a domain's data object directly; go through that domain's repository.
- **Dependency Injection**: Services should accept their dependencies (like config or other services) in their constructor or factory function, rather than importing global singletons, to facilitate testing and modularity.
- **Logging**: Never call `console.log`, `console.warn`, or `console.error` directly. Import `log` from `server/core/logger.mjs` and call `log(source, level, message)` where `level` is `'info' | 'warn' | 'error'`. Choose a stable source name for the module (e.g. `'projects'`, `'render'`). `info`-level messages from sources in `HIDE_LOG_SOURCES` are silenced automatically.
- **Starting child processes**: never import `child_process` directly — import `spawn`/`execFile`/`execSync` from `server/core/child-process.mjs`, which defaults `windowsHide: true`. On Windows a console program (ffmpeg, `cmd.exe`, `taskkill`) shares its parent's console when there is one, but a server started without one (under PM2) gives every such child its own visible window — a foreground flash for short calls, an empty lingering window for piped long-lived ones. The guard test in `server/core/child-process.test.mjs` fails on any other `server/` module that imports `child_process`. Pass `windowsHide: false` only when the child must show a window.

### Shared client/server code

Code the server shares with the browser lives in `public/js/shared/` and is imported by relative path, e.g. `import { log } from '../../../public/js/shared/logger.mjs'`. Shared modules import only from within `public/js/shared/` and use no browser-only or Node-only APIs — see `.claude/rules/client.md`'s "Shared client/server code". Never import from `public/js/app-ui/` or `custom-ui/` on the server: those modules are free to use browser APIs.

### Path Handling

- Always use `path.join()` for file paths.
- Use `process.cwd()` or a dedicated `AppPaths` constant from `server/core/paths.mjs` to resolve project roots, rather than `__dirname` hacks in every file.

## 5. Data Management

- **Persistence**:
  - Primary data storage is **JSON files** in `server/database/`.
  - **Do not use a SQL database** unless explicitly requested.
  - **Flat-file per domain**: All domain data must be stored as a single JSON file in `server/database/` (e.g., `projects-data.json`), not as a directory of per-record files. Mimic the flat array structure of an existing database JSON file, if available.
  - **Manual edit backup requirement**: Before making any user-requested manual edit to a file in `server/database/` (i.e. directly editing the JSON rather than going through application code/migrations), first copy the unmodified file into `scratch/` (e.g. `scratch/<file>.bak`, or a timestamped variant if a backup for that file already exists there). This applies whenever the user asks for a hand edit, correction, or cleanup of a database file's contents — not to writes made by the running server or migration scripts. `server/database/` is gitignored, so this is the only safety net against an edit going wrong.
  - **Migrations must be idempotent and guarded.** Every `scripts/migrate/<domain>/<N>-to-<M>.mjs`'s `migrate(data)` must be safe to run twice in a row against its own output — the second run must be a no-op, never a destructive re-transform. Gate destructive renames/moves on the **absence** of the destination field (e.g. `if (record.newField === undefined) { …rename… }`), use `??`/`!Array.isArray(x)`/`x === undefined` guards for default-fill migrations, and verify value-remap migrations don't re-fire once the target value no longer matches an old remap key — don't just assume the pattern holds. A migration may be re-run against its own output (a restored backup, a retried startup), so it must never assume it sees each input once.
  - **Migrations that need to surface something to the user log through `server/core/logger.mjs`,** not `console.*` — `log('migrate', 'warn', …)`. Most migrations are silent transforms with nothing to report; when one has to flag a lossy or ambiguous case it resolved on the user's behalf, a warn-level line is the channel. Never leave such a case unreported.
  - **After bumping `currentVersion`, restart the server before anything else writes that domain's file.** The version stamp and the migration runner live on different paths: every write function stamps `getCurrentVersion(domain)`, but only server startup calls `migrateAll()`. A standalone `scripts/` tool run in the window between the bump and the restart reads the old file, writes it back stamped with the new version, and the migration is skipped **permanently and silently** — and because the migrator's `dataVersion === currentVersion` early return precedes `writeBackup`, no backup is ever written either, so there is nothing to restore from. A script that cannot guarantee it runs post-restart must `await migrateAll()` itself or assert `data.version === getCurrentVersion(domain)` and refuse to write.
  - **New data files must be stamped with the current version on creation.** Every domain's single write function should set `data.version = getCurrentVersion(domain)` (from `server/core/data-versions.mjs`) before writing, not only the startup migrator — otherwise a file created by an import or a first save carries no `"version"` field and gets misread as version `0` on the next restart, incorrectly replaying the full migration chain against already-current data. This only applies to domains whose data file is a JSON object; a domain stored as a bare top-level array cannot carry a `.version` property and is exempt until its file shape changes.
- **Configuration**:
  - System configuration lives in `config.json`.
  - Defaults are in `config.default.json`.
  - The server should handle missing `config.json` by copying the default on startup.
  - **Config migrations must seed values from `config.default.json` first.** When a migration adds a new field, read its value from `config.default.json` and only fall back to a hardcoded literal if the key is absent there. Never hardcode a default directly in a migration script when `config.default.json` is the authoritative source.
  - **Config migrations only fill blanks — never authored text.** A config migration may add a missing structural field (a new flag, a `goal` on each direction), but it never adds, rewrites, or removes authored text — labels, instructions, prompts, phrase lists — and never appends authored entries, not even when the old text "still matches the old default". When a field's purpose shifts and its text should change, edit `server/config.json` directly (backing it up to `scratch/` first), and `archive-feature` copies those authored changes into `config.default.json` when the feature is archived.
- **Schemas**:
  - Authoritative JSON Schema (draft-07) files for every persisted domain live in `server/resource/schemas/`. File naming: `<domain>.schema.json`.
  - Every new domain that adds a persistent data file **must** also add a schema file here.
  - The core sanitizer (`server/core/sanitizer.mjs`) exports `sanitize(data, schema)` (fills defaults, permissive) and `validate(data, schema)` (Ajv type/required check, returns `{ valid, errors }`).
  - Each feature domain must have a co-located `sanitizer.mjs` that calls `sanitize()` then applies domain-specific unknown-field handling. Wire sanitizers into both load paths and write paths.
  - All POST/PUT router endpoints must call `validate(req.body, schema)` and return `400 { error, details }` on failure.

## 6. Code Hygiene

- **Cleanliness**: Remove unused imports, variables, and console logs before finalizing a task.
- **Modularity**:
  - Extract repeated logic into helper functions.
  - Keep files focused (Single Responsibility Principle).
- **Comments**:
  - Explain _why_, not just _what_.
  - Use `// TODO:` comments to mark areas for future improvement, but try to resolve them if they are within scope.

## 7. Testing

- **Co-located tests**: Every new route module or service module must include a co-located test file (e.g. `router.mjs` → `router.test.mjs`).
- **Passing definition**: At phase boundaries, "passing" means `npx vitest run` (full suite) exits 0 — not just `--changed`. All tests, including pre-existing ones, must be green before a phase is considered complete.
- **Standalone `scripts/` tools**: Structure a top-level repair/migration script (in `scripts/`) as an exported function performing the actual work, called from an entrypoint guard at the bottom — not top-level side-effecting code — so it can be imported and unit-tested directly. Use `fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')`, not a raw `file://${process.argv[1]}` string comparison — the latter breaks on Windows, where `process.argv[1]` is a relative, backslash-separated path rather than a `file://` URL. Co-locate its test as `scripts/<name>.test.mjs`; the `scripts` project in `vitest.config.mjs` picks up `scripts/**/*.test.mjs`.
- **No tautological assertions**: never assert that a result has a property or shape you just selected it by (e.g. filtering a list on `type === 'x'` and then asserting each item's `type` is `'x'`). Assert behaviour or content instead: the value computed, the side effect written, the response returned.
- **External services**: Any test that would otherwise reach a live external service must go through a mock in `server/test/mocks/` instead. Add the mock alongside the first feature that needs it.
