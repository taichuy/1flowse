# 1Flowse Demo React 化计划

日期：2026-04-13 01:05
状态：执行中

## 本轮为什么继续改

- `tmp/demo` 现有版本虽然已经把五个任务域和基础交互讲清楚，但它仍然是静态 HTML，和用户要求的“参考 `web/`、复用主依赖、固定端口 `3200`”还不一致。
- 当前真实 `web/app` 仍停留在 bootstrap 阶段，`Home / AgentFlow / Embedded Apps / Embedded Mount` 都没有形成完整工作区语义；demo 需要承担“把项目现状与目标交互同时讲清楚”的职责。
- 当前 demo 还有两个明显问题没有彻底解决：
  1. `overview` 仍然放了不止一个强动作，弱化了“唯一主入口是进入编排”的规则。
  2. 静态原型无法证明未来能和现有依赖体系一起运行，也不利于后续继续拆组件和加测试。

## 本轮设计结论

- 继续沿用当前仓库 `DESIGN.md` 的深色工程控制台方向，而不是回退到旧的浅色工作台。
- demo 升级为 `React + Vite + Ant Design + TanStack Router` 的独立项目，运行端口固定为 `3200`。
- 继续只在 `tmp/demo` 内工作；与真实仓库的关系通过复用 `web/` 现有依赖和包来建立，不直接改动 `web/app`。
- 工作区保留五个任务域：`overview / orchestration / api / logs / monitoring`。
- L1 详情模型保持两种：
  - `Inspector` 只服务画布节点。
  - `Drawer` 只服务运行日志。
- mock 数据继续集中管理，避免 HTML、组件和文案多处漂移。

## 本轮执行清单

1. 删除旧的静态入口与脚本，改建为 Vite 项目结构。
2. 新建统一 mock 数据层，补充应用、节点、运行、契约、观测、嵌入清单。
3. 实现工作区壳层、五个页面视图、Inspector、Run Drawer、跨页跳转。
4. 加入最小测试，至少覆盖“进入编排”和“日志抽屉打开”两个关键行为。
5. 运行 `test`、`build`，并尝试用 Playwright 做桌面与移动端截图验证。

## 当前批判

- 现在的 `@1flowse/ui` 还只有非常薄的 `AppShell`，说明项目自己的工作区组件层几乎还没开始；demo 必须补这块，但不能假装这些能力已经在正式代码里落地。
- `.agents/skills/frontend-development/references/visual-baseline.md` 与仓库根 `DESIGN.md` 仍有视觉方向冲突；本轮以代码中的当前事实为准，继续记录这个差异，后续应该回到 skill 文档修正。
- 如果这一轮 React 化后仍然出现大段单文件渲染逻辑，下轮就必须继续按视图或组件拆分，不能让 demo 再次退化成“一个文件塞满全部页面”。
