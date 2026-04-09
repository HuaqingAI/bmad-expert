# Changelog

## [0.3.1] - 2026-04-09

### Fixed

- `init --yes` now appends bmad config to existing CLAUDE.md instead of silently skipping — fixes workspace initialization failure in environments with pre-existing CLAUDE.md (e.g., HappyCapy)
- Workspace CLAUDE.md template now uses HTML comment markers (`<!-- bmad-workspace-config -->`) for reliable detection and idempotent append

### Improved

- **AGENTS.md**: Added Step 2.5 (Workspace Environment Check) — runs every session start, detects bmad projects and verifies workspace routing config; separated detection from action for clarity
- **BOOTSTRAP.md**: Streamlined to focus on agent identity setup; workspace init now delegates to AGENTS.md Step 2.5
- **bmad-project-init.md**: install flow now automatically triggers `npx bmad-expert init --yes` after successful install
- `installer.js`: Post-install output now reminds CLI users to run `npx bmad-expert init`

### Tests

- Added comprehensive tests for append logic: existing CLAUDE.md with/without bmad markers, empty files, malformed markers, idempotent re-runs

## [0.3.0] - 2026-04-08

### Added

- `bmad-expert init` command — workspace initialization (CLAUDE.md + workflow files)
- `bmad-expert uninstall` command — clean removal of bmad files
- `bmad-expert update` — extended to handle config file updates
- Init idempotency protection — safe to re-run without data loss
