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

### 2026-07-17

- **Added [FORK.md](file:///Users/mmcdonnell/code/opencode/FORK.md):** Outlines branching, syncing, and custom workspace strategy.
- **Added [Makefile](file:///Users/mmcdonnell/code/opencode/Makefile):** Standard checkmake-compliant targets for building, cleaning, testing, and syncing with automatic Bun dependency management.
- **Updated [Makefile](file:///Users/mmcdonnell/code/opencode/Makefile):** Added `push` target to automate pushing the active custom branch to your fork.
- **Updated `alias.zsh`:** Mapped global `oc` alias to local compiled standalone binary via `$HOME`.
