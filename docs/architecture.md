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

## Future evolution
- Add request tabs and multiple open documents.
- Support auth presets and certificate manager.
- Extend assertion DSL and script sandbox.