# JadeAPI Studio

一款**轻量级**的桌面 **API 测试工具**：专注发请求、看响应、管集合与环境。界面与交互贴近 Postman / Insomnia，数据与运行以本机为主，不做在线账号、协作同步与平台化能力堆叠。

## 为什么做这个项目

日常接口调试往往离不开 Postman 一类工具，但常见痛点有两类：

- **产品臃肿**：协作、监控、Flows 等能力越堆越多，安装包变大、启动变慢，对大部分的场景来说负担过重。
- **国内使用不便**：官方客户端依赖在线账号与同步，访问与更新常受网络环境影响；团队也更希望数据留在本机、不绑云。

JadeAPI Studio 定位：核心流程（请求、响应、集合、环境变量）做扎实，其余能力（Mock、Postman 导入、简单 Runner 等）按需轻量提供，不追求做成平台型产品。

技术栈：**Electron · React · TypeScript · Zustand**。仓库根包名为 `api-tester`，桌面应用为 `@api-tester/desktop`。

## 下载（Releases）

不想从源码构建时，可直接使用已打包的安装包：

**[GitHub Releases](https://github.com/luf-23/api-tester/releases)** — 推送 `v*` 标签后 CI 会在 Windows / macOS / Linux 上构建并上传对应产物（`.exe`、`.dmg`、`.AppImage` 等，以各版本 Release 说明为准）。

从源码开发或自行打包，见下文「开发与调试」。

## 功能概览

- **请求与响应**：多 Tab、参数 / 头 / Body、响应体（含 JSON 查看与结构化浏览）
- **集合与工作区**：本地组织接口，配合环境变量做切换
- **本地数据**：**SQLite** 持久化（主进程 `better-sqlite3`）
- **辅助能力**：内置轻量 **mock-server**；变量替换、断言、Postman 导入与简单 Runner（见 `packages/domain`）

## 环境要求

| 项 | 版本 |
|----|------|
| Node.js | **20.x**（与 CI 一致即可） |
| pnpm | **9.x**（见根目录 `packageManager`） |

推荐启用 [Corepack](https://nodejs.org/api/corepack.html)：`corepack enable`，再使用项目指定的 pnpm 版本。

## 目录结构

```
apps/desktop          Electron（main / preload / renderer），electron-vite
packages/shared       跨进程类型与 Zod 模型
packages/http-client  基于 fetch 的请求执行
packages/storage      SQLite 工作区存储
packages/domain       变量、断言、Postman 导入、集合运行
packages/mock-server  进程内 HTTP Mock
```

## 界面结构（Renderer）

各面板与原型布局对应：

- **Sidebar** — 垂直导航（Collections、Environments、History、APIs、Mock、Monitors、Flows、Settings 等）
- **CollectionsPanel** — 工作区选择、集合树、主题卡片
- **TopBar** — 请求标签、外观设置入口
- **RequestPanel** — URL；Params / Headers / Auth / Body / Tests / Pre-request / Settings 子 Tab
- **ResponsePanel** — Body / Cookies / Headers / Test Results；JSON 与 Response Explorer
- **StatusBar** — 本地工作区信息与当前 Tab 状态

状态由三个 Zustand store 管理：`workspace`（集合）、`tabs`（打开的请求与响应）、`theme`（主题）。

## 开发与调试

```bash
pnpm install           # 安装依赖；桌面包 postinstall 会为本机 Electron 编译 better-sqlite3（CI 中会跳过）
pnpm dev               # electron-vite 开发模式
pnpm build             # electron-vite build + electron-builder（见 apps/desktop 的 build 配置）
pnpm lint              # ESLint（根目录）
pnpm test              # Vitest（packages / apps 下的 *.test.ts）
pnpm test:watch        # Vitest watch
```

**全工作区 TypeScript 检查**（与 CI 一致）：

```bash
pnpm -r exec -- tsc --noEmit -p tsconfig.json
```

仅检查桌面包：

```bash
pnpm --filter @api-tester/desktop typecheck
```

### 原生模块（better-sqlite3）

首次 `pnpm install` 后，若未自动完成编译，可在 `apps/desktop` 下执行：

```bash
pnpm rebuild:native
```

在 **Windows** 上通常需要安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（含「使用 C++ 的桌面开发」或 MSVC 工具链），以满足 `node-gyp` / `electron-rebuild` 的编译需求。

## 持续集成（CI）

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) 在 Push / Pull Request（及手动 `workflow_dispatch`）时：

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm -r exec -- tsc --noEmit -p tsconfig.json`
4. `pnpm test`

Runner 为 `ubuntu-latest`；为避免在无 Electron 环境下的原生编译，`CI=true` 时桌面包会跳过 `postinstall` 里的 `electron-rebuild`。
