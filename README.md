# JadeAPI Studio

A desktop API workbench inspired by Postman/Insomnia, built on Electron + React + TypeScript with a focused jade-green design system.

## Workspace layout

```
apps/desktop          Electron app (main / preload / renderer)
packages/shared       Cross-process types & zod schemas
packages/http-client  Fetch-based request executor
packages/storage      SQLite-backed workspace store
packages/domain       Variables, assertions, Postman import, runner
packages/mock-server  Embedded HTTP mock server
```

## UI architecture

The renderer is composed of independent panels that match the prototype:

- `Sidebar` ? vertical nav rail (Collections, Environments, History, APIs, Mock, Monitors, Flows, Settings)
- `CollectionsPanel` ? workspace picker, collection tree, theme card
- `TopBar` ? request tabs, theme card (appearance settings)
- `RequestPanel` ? URL bar; Params/Headers/Auth/Body/Tests/Pre-request/Settings sub-tabs
- `ResponsePanel` ? Body/Cookies/Headers/Test Results; JSON viewer + Response Explorer
- `StatusBar` ? local workspace stats and active tab indicator

State is split into three Zustand stores: `workspace` (collections), `tabs` (open requests + responses), and `theme` (jade palette switcher).

## Develop

```bash
pnpm install
pnpm dev          # electron-vite dev
pnpm --filter @api-tester/desktop typecheck
pnpm test         # vitest
pnpm build        # electron-builder
```
