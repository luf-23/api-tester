# API Tester (Electron)

一个轻量、离线优先的 API 测试桌面应用，目标是覆盖 Postman 高频能力但保持简洁。

## 已实现能力
- 请求编辑与发送：Method/URL/Params/Headers/Body（json/text/form）
- 响应查看：状态码、头、body、耗时、大小
- 环境变量：`{{var}}` 替换
- 历史记录：发送后自动记录，可回填请求
- 集合：保存请求并运行集合，输出执行报告 JSON
- 断言：status/header/body_contains/json_path
- Mock Server：内置 Express 路由模拟
- 导入导出：工作区 JSON，Postman Collection v2.1 导入

## 项目结构
- `apps/desktop`：Electron 主应用（main/preload/renderer）
- `packages/shared`：共享类型与 IPC 协议
- `packages/http-client`：HTTP 发送引擎
- `packages/domain`：变量替换、断言、集合运行、Postman 导入
- `packages/storage`：SQLite 存储与工作区仓储
- `packages/mock-server`：Mock 服务控制器

## 本地开发
```bash
pnpm install
pnpm dev
```

## 质量检查
```bash
pnpm test
pnpm --filter @api-tester/desktop typecheck
pnpm lint
```

## 打包
```bash
pnpm build
```

## 安全基线
- `nodeIntegration: false`
- `contextIsolation: true`
- preload 白名单 API + IPC 参数校验
- 外链统一经 `shell.openExternal` 且窗口内阻止直接打开