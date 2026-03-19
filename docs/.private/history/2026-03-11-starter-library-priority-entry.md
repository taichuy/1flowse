# 按主业务线组织 Starter Library

## 背景

用户这轮要求先读清：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/dev/runtime-foundation.md`
- 上一次 Git 提交

随后判断几件事：

- 上一次提交做了什么，是否需要衔接
- 基础框架是否已经设计到可以继续推进主业务
- 当前架构是否足够解耦
- 是否已经出现需要优先拆分的长文件
- 主要功能业务是否已经具备继续提升完整度的条件

检查后发现，上一次提交 `feat: unify workflow node catalog entry model` 已经把 starter 和 editor palette 的节点入口统一到了 `workflow node catalog`。这条线是正确的，也和 `runtime-foundation` 里的 P0 完全衔接。

但继续往下看时，创建页仍有一个明显缺口：starter 虽然统一了节点入口，仍只是“静态卡片列表”，还没有把当前明确的四条主业务线表达成稳定入口模型：

- 应用新建编排
- 编排节点能力
- Dify 插件兼容
- API 调用开放

如果这里不继续收口，后续 workspace 模板、生态模板、节点来源分层仍会回到“页面里堆静态数组”的老路。

## 目标

本轮按当前优先级推进 P0：

1. 把 starter 从静态卡片升级为按主业务线筛选的 `starter library`
2. 把业务优先级和主线焦点沉淀为可复用的前端元数据，而不是继续散落在页面文案里
3. 顺手把创建页中“starter 浏览逻辑”拆出去，避免 `/workflows/new` 再次长成大而杂的入口页

本轮不尝试直接完成：

- workspace 级模板治理
- 动态 plugin-backed node registry
- 发布配置页或对外协议映射

## 实现

### 1. 新增业务主线元数据

新增：

- `web/lib/workflow-business-tracks.ts`

当前把四条主业务线统一建模为共享元数据，包含：

- `priority`
- `summary`
- `focus`

这让：

- starter 创建页
- 后续模板治理
- 节点入口分层

可以复用同一份“为什么现在优先做这个”的业务上下文。

### 2. Starter 升级为可筛选的 library

更新：

- `web/lib/workflow-starters.ts`

当前 starter 不再只暴露基础名称和描述，而是补齐：

- 所属业务主线
- 当前优先级
- 主线摘要
- 来源生态
- 当前工作流焦点
- 推荐下一步

同时新增：

- `WORKFLOW_STARTER_TRACKS`
- `listWorkflowStarterTemplates()`
- `getWorkflowStarterTemplate()`

这让 starter 已经开始具备“模板库”而不是“页面硬编码卡片”的形态。

### 3. 补上 API 调用开放 starter

新增：

- `Response Draft`

这个 starter 仍然保持 MVP 诚实性，没有假装发布层已完成，只是把：

- `trigger`
- `llm_agent`
- `output`

组织成一个更贴近“响应整形 / 发布准备”的草稿入口，让 `API 调用开放` 不再完全停留在文档层。

### 4. 创建页拆出 starter 浏览组件

新增：

- `web/components/workflow-starter-browser.tsx`

更新：

- `web/components/workflow-create-wizard.tsx`

当前拆分结果：

- `workflow-create-wizard.tsx`
  - 负责创建状态、选中 starter、命名和提交创建请求
- `workflow-starter-browser.tsx`
  - 负责按业务主线切换、渲染 starter library 和 starter 卡片

这次拆分不算大重构，但已经把“浏览入口”和“创建动作”分成两层，更利于后续继续加 workspace / ecosystem 级模板来源。

## 判断

### 1. 上一次 Git 提交是否需要衔接

需要，而且这轮已经直接衔接。

连续关系如下：

1. 上一轮统一 `node catalog`
2. 这一轮把 starter 升级为按业务主线组织的 `starter library`

也就是说，上一次提交不是孤立前端整理，而是当前 P0 主线的第一步。

### 2. 基础框架是否已经设计好

当前判断是：已经足够支撑继续推进主业务，但仍然只是“可继续扩展的基础框架”，不是最终架构完成态。

已经稳定的部分：

- 后端运行态事实模型
- workflow definition 校验与版本快照
- workflow 新建 -> 编辑 -> 保存链路
- recent runs / trace overlay 复用后端事实来源

仍未闭环的部分：

- workspace 级 starter/template 治理
- plugin-backed node source
- 发布配置与对外协议映射

### 3. 架构是否解耦

当前方向是对的，但还在继续分层过程里。

已形成的分层：

- `workflow business tracks`
- `workflow node catalog`
- `workflow starters`
- `workflow starter browser`

还没彻底打通的边界：

- tool catalog 仍来自另一条来源链路
- 动态节点注册中心尚未落地
- starter 来源还只有内置静态定义

### 4. 长文件是否需要继续拆

需要，且已经能排出优先级。

当前最值得盯住的是：

- `api/app/services/runtime.py`
  - 约 1387 行，已接近用户偏好的 1500 行阈值
- `web/components/workflow-node-config-form.tsx`
  - 约 1136 行，是前端当前最典型的“大而多职责”文件
- `web/components/workflow-editor-workbench.tsx`
  - 约 796 行，适合继续拆画布壳层、运行态附着和保存逻辑

这轮没有优先拆这些文件，是因为当前更高优先级仍是把主业务入口继续做实，而不是为了拆分而拆分。

### 5. 主业务是否可以继续推进完整度

可以，而且连续路径已经比较清楚：

1. 进入 `/workflows/new`
2. 按主业务线筛选 starter
3. 创建 workflow 草稿
4. 进入 editor
5. 继续增删节点并保存版本
6. 接 recent runs / trace overlay 观察运行态

这说明项目已经不只是“基础框架摆着”，而是开始具备持续补齐主业务完整度的可推进路径。

## 影响范围

- `web/lib/workflow-business-tracks.ts`
- `web/lib/workflow-starters.ts`
- `web/lib/workflow-node-catalog.ts`
- `web/components/workflow-starter-browser.tsx`
- `web/components/workflow-create-wizard.tsx`
- `web/app/globals.css`
- `docs/dev/runtime-foundation.md`

## 验证

已执行：

```powershell
cd web
pnpm lint
pnpm exec tsc --noEmit
```

结果：

- `pnpm lint` 通过
- `pnpm exec tsc --noEmit` 通过

本轮未修改后端代码，因此没有新增后端测试执行。

## 下一步

1. P0：把 starter library 从“按主业务线筛选”推进到“内置 starter / workspace 模板 / 生态模板”的来源模型。
2. P0：把 `node catalog` 和 `tool catalog` 拉到统一的来源分层视图，明确 `native / plugin / compat:*` 的入口模型。
3. P1：继续拆 `workflow-node-config-form.tsx`，优先把 `llm_agent`、`output`、edge `mapping[]` 相关结构化表单从单文件里剥出来。
