# Web Mock UI Sync Design

日期：2026-04-13
状态：已确认并进入实现
关联目录：
- `web`
- `tmp/mock-ui`
- `scripts/node`

## 1. 目标

为 `tmp/mock-ui` 提供一个可重复执行的前端沙盒重建脚本。脚本每次执行时都从 `web/` 复制一份干净的前端 workspace 到 `tmp/mock-ui/`，并把 mock 副本的 Vite 默认端口改为 `3210`，用于 UI 风格探索与反复重置。

## 2. 范围

本轮只做：

- 新增一个 Node 脚本作为同步入口
- 每次执行前清空 `tmp/mock-ui/`
- 从 `web/` 复制前端 workspace 内容到 `tmp/mock-ui/`
- 排除 `node_modules`、构建产物、缓存目录等运行垃圾
- 改写 mock 副本 `app/vite.config.ts` 的开发端口为 `3210`
- 为脚本补充自动化测试

本轮不做：

- 自动安装依赖
- 自动启动 mock-ui dev server
- 双向同步
- 增量合并保留本地修改

## 3. 设计

### 3.1 同步模型

脚本默认采用“重建式同步”：

1. 校验 `web/` 源目录存在
2. 删除 `tmp/mock-ui/` 现有内容
3. 重新创建目标目录
4. 复制 `web/` 内容到 `tmp/mock-ui/`
5. 改写 `tmp/mock-ui/app/vite.config.ts` 端口为 `3210`

### 3.2 目录边界

目标目录直接承接 `web/` 的内容，而不是生成 `tmp/mock-ui/web/`。这样同步完成后，`tmp/mock-ui` 自身就是一个独立的前端 workspace，可直接在该目录执行 `pnpm install` 与 `pnpm dev`。

### 3.3 排除规则

同步时跳过以下运行垃圾目录：

- `node_modules`
- `dist`
- `coverage`
- `.turbo`
- `.vite`

### 3.4 验证

测试覆盖以下行为：

- CLI 默认参数指向 `web -> tmp/mock-ui`
- 执行同步时会清空旧目标内容
- 复制后保留源码文件并跳过运行垃圾目录
- `app/vite.config.ts` 默认端口被改写为 `3210`
