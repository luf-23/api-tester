# Architecture Notes

## Process model
- Main process: window lifecycle, IPC router, DB access, mock server lifecycle.
- Preload process: `contextBridge`-based safe API surface.
- Renderer process: React UI and user interactions.

## Data flow
1. Renderer builds request draft.
2. Renderer calls preload API.
3. Main validates payload and executes request via `@api-tester/http-client`.
4. Main persists history in SQLite.
5. Renderer renders response/history/report.

## Persistence
- Database: `api-tester.db` under Electron `userData`.
- Tables: workspace, environments, collections, history.

## Renderer (JadeAPI Studio UI)
- React 18 + Zustand stores: `workspace`, `tabs`, `theme`.
- Layout grid: 72px nav rail · 280px collections panel · main column · 28px status bar.
- Theme tokens live in `renderer/src/styles/themes.css` and switch via `data-theme` on `<html>`.
- Sub-components are colocated under `renderer/src/components/` and share icons from `icons.tsx`.

## Future evolution
- Persist tab state and per-tab response history into SQLite.
- Auth presets, certificate manager, and a richer assertion DSL.
- Real script sandbox for pre-request / test scripts.