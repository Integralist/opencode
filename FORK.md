# Fork Syncing & Custom Branching Strategy

To keep your fork of OpenCode in sync with the upstream repository while developing your own features, follow this workflow.

## Git Remotes Configuration

Set the original repository as your `upstream` remote:

```bash
git remote add upstream https://github.com/anomalyco/opencode.git
```

## Branch Strategy

- **`dev` branch:** Keep this clean. It should strictly track `upstream/dev`. Do not commit custom code directly to it.
- **Custom branches:** Create separate branches for your custom work.
  - **Rule:** Short kebab-case names of at most three words, separated by hyphens (e.g., `custom-feature-name`). Do not use slashes or prefixes like `feat/` or `fix/`.

## Manual Sync Workflow

1. Sync local `dev` with upstream:
   ```bash
   git checkout dev
   git pull upstream dev
   git push origin dev
   ```
2. Integrate into your custom branch:
   ```bash
   git checkout <your-custom-branch>
   git merge dev
   ```

## Pushing Changes

Push your custom branch to your fork (`origin`):

```bash
git push -u origin <your-custom-branch>
```

---
> [!TIP]
> - Use `make sync` to automate the sync workflow.
> - Use `make push` to push the current custom branch to your fork.

## Changelog

### 2026-07-18

- **Added Session Recap Card:** ([39a8902e6](https://github.com/Integralist/opencode/commit/39a8902e6)) Generate a read-only LLM summary of a session and surface it in the TUI as a recap card on open, after idle, or on demand via `/recap`. Recap builds its transcript from the legacy V1 message/part tables (where sessions actually persist history), falling back to the V2 projected message store, and falls back to the default model when the session's own model is unavailable so the summary is best-effort and never blocks. Adds the `/api/session/:sessionID/recap` endpoint across protocol, server, core execution/runner, and the generated SDK/client.
- **Fixed Copy-on-Select in Permission Prompt:** ([88cb2bb67](https://github.com/Integralist/opencode/commit/88cb2bb67)) The permission prompt's fullscreen view (ctrl+f) renders via Portal outside the root box, so the global copy-on-select handler never fired. Added an `onMouseUp` copy handler directly on the prompt's content box so clipboard copy works in both inline and fullscreen views.
- **Fixed Recap Showing on Fresh Sessions:** ([ed4ff47ab](https://github.com/Integralist/opencode/commit/ed4ff47ab)) The startup recap triggered on brand new sessions due to a race between SSE message events and the sync effect. Now checks session age and only shows recap when re-opening a session older than 60 seconds.

### 2026-07-17

- **Added `/effort` Slash Command Alias:** ([59e520713](https://github.com/Integralist/opencode/commit/59e520713)) Added `/effort` as an alias for the `/variants` slash command to quickly switch model variants.
- **Added Global BTW Side Query:** ([b52d39fb3](https://github.com/Integralist/opencode/commit/b52d39fb3)) Implemented the `/btw` command as a global side query dialog in the TUI, complete with `ctrl+b` global shortcut, responsive scrolling, proper interruption/cancellation logic via `ESC`, and refined UI layout.
- **Added `/btw` Model/Variant Flags:** Added support for `--model` and `--effort` flags to `/btw` to quickly specify variants in a single command.
- **Fixed `@` Autocomplete Resolution for External Paths:** ([8fcf878af](https://github.com/Integralist/opencode/commit/8fcf878af)) Resolved a pathing issue where `@` file mentions correctly query external directories but would mistakenly construct the display path against the workspace root when explicitly traversing upwards (e.g. `../folder`).
- **Exposed Sub-agent Cost Calculations in TUI Sidebar:** ([a1f59f85e](https://github.com/Integralist/opencode/commit/a1f59f85e)) Added recursive cost-summing for sub-agent threads. Updates the TUI Context sidebar to display a detailed breakdown of Main Agent cost, Sub-agent total cost, and combined Total Cost under the active session ID.
- **Ported PR #23262 (File Cycling in Permission Prompt):** ([e74ec3ad3](https://github.com/Integralist/opencode/commit/e74ec3ad3)) Ported the file cycling feature from upstream PR #23262 to [packages/tui/src/routes/session/permission.tsx](file:///Users/mmcdonnell/code/opencode/packages/tui/src/routes/session/permission.tsx). This enables cycling through multiple files inside the TUI permission dialog using `[` and `]` keys.
- **Added [FORK.md](file:///Users/mmcdonnell/code/opencode/FORK.md):** ([8fdf1124f](https://github.com/Integralist/opencode/commit/8fdf1124f)) Outlines branching, syncing, and custom workspace strategy.
- **Added [Makefile](file:///Users/mmcdonnell/code/opencode/Makefile):** ([8fdf1124f](https://github.com/Integralist/opencode/commit/8fdf1124f)) Standard checkmake-compliant targets for building, cleaning, testing, and syncing with automatic Bun dependency management.
- **Updated [Makefile](file:///Users/mmcdonnell/code/opencode/Makefile):** ([cc773775c](https://github.com/Integralist/opencode/commit/cc773775c)) Added `push` target to automate pushing the active custom branch to your fork.
- **Updated `alias.zsh`:** ([8fdf1124f](https://github.com/Integralist/opencode/commit/8fdf1124f)) Mapped global `oc` alias to local compiled standalone binary via `$HOME`.
