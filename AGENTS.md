# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Overview

MarksVault is a browser extension built with WXT (Vite), React, TypeScript, and Material-UI. It manages bookmarks, syncs with GitHub, and runs automated tasks.

## Build Commands

- `npm run dev`: WXT dev mode (Chrome by default).
- `npm run dev:firefox`: WXT dev mode (Firefox).
- `npm run dev:edge`: WXT dev mode (Edge).
- `npm run build`: Production build (Chrome MV3) to `.output/chrome-mv3/`.
- `npm run build:firefox`: Production build (Firefox MV2) to `.output/firefox-mv2/`.
- `npm run build:edge`: Production build (Edge MV3) to `.output/edge-mv3/`.
- `npm run build:all`: Build all supported browsers.
- `npm run zip:all`: Build + zip all supported browsers (release artifacts).
- `npm run typecheck` / `npm run lint` / `npm test`

## Development Workflow

- **Version Bump per Milestone**: Every time a part of development is completed (feature slice, bug fix batch, refactor, etc.), the extension version **MUST** be bumped before the build is handed over for testing. Bump `version` in BOTH `package.json` and `package-lock.json` (root + `packages[""]`). Minor version for new features/improvements (e.g. `1.1.0 -> 1.2.0`), patch version for bug fixes only (e.g. `1.2.0 -> 1.2.1`). The UI reads the version dynamically via `browser.runtime.getManifest().version`, so no UI changes are needed. Verify the bump by checking `"version"` in `.output/<target>/manifest.json` after `npm run build`.

## Architecture (Non-Obvious)

- **WXT Entrypoints (Source of Truth)**: Entrypoints live under `src/entrypoints/` and WXT generates the final manifest + outputs under `.output/*`.
  - `src/entrypoints/background.ts`: background entrypoint (MV3 Service Worker on Chromium)
  - `src/entrypoints/popup/*`: popup page -> `popup.html`
  - `src/entrypoints/options/*`: options page -> `options.html`
  - `src/entrypoints/taskconfig/*`: unlisted page -> `taskconfig.html`
- **Service Architecture**: All services in [`src/services/`](./src/services/) are singletons. Always use `ServiceClass.getInstance()` instead of `new ServiceClass()`.
- **Storage Strategy**: The extension uses a mixed storage model. GitHub credentials are in `browser.storage.sync` for cross-device access, while all other data is in `browser.storage.local`. See [`src/utils/storage-service.ts`](./src/utils/storage-service.ts).
- **Event System**: All bookmark events (`onCreated`, `onRemoved`, `onChanged`, `onMoved`) are unified into a single `EventType.BOOKMARK_CHANGED` for task handling. See [`src/entrypoints/background.ts`](./src/entrypoints/background.ts).
- **MV3 SW Cold Start**: The MV3 Service Worker can be restarted frequently; event handlers should ensure required services are initialized (see `ensureServicesInitialized` in `src/entrypoints/background.ts`).

## Critical Patterns

- **GitHub API Encoding**: For file uploads, you **MUST** use `btoa(unescape(encodeURIComponent(content)))` to handle Unicode characters correctly. Standard `btoa()` will corrupt non-ASCII data. See [`src/services/github-service.ts`](./src/services/github-service.ts).
- **Storage Write Retries**: All writes to extension storage are wrapped in a 3-retry mechanism with exponential backoff. This is not obvious from the calling code. See [`src/utils/storage-service.ts`](./src/utils/storage-service.ts).
- **Settings Updates**: The settings object has nested properties. Updates **MUST** be deep-merged to avoid data loss. See [`src/utils/storage-service.ts`](./src/utils/storage-service.ts).
