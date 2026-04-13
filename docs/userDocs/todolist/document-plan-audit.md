# 文档计划审计待办

更新时间：`2026-04-14 07`

说明：本文件承接 `docs/qa-report/document-plan-audit.md` 的后续讨论。继续围绕这个主题沟通时，只更新本文件，不重复新建同主题 todo。

## 本轮新增或替换后的事实

- 前端结构治理已经真实完成一轮：
  - `web` 已收敛到 `app-shell / routes / features / _tests`
  - `lint / test / build / style-boundary` 本轮都通过
- 旧口径“前端主要问题还是结构没拆开”应废弃。
- 当前前端更准确的问题是：
  - `2026-04-13-frontend-bootstrap-realignment.md` 已执行完成
  - `2026-04-13-console-shell-auth-settings-design.md` 又定义了更正式的控制台方案
  - 代码和测试仍固化在前一个 bootstrap 过渡态
- 当前后端统一验证仍可通过，但 `publish-gateway` 和 `plugin-runner` 只能算骨架或基础能力，不应被写成整个模块已完成。
- 当前文档与代码体量：
  - `docs/superpowers/specs/1flowse`：`31` 个 Markdown，`9454` 行
  - `docs/superpowers/plans`：`16` 个 Markdown，`11664` 行
  - `api + web` 非构建产物源码：`17303` 行
- 当前文档真相层问题仍成立，而且比上一版更具体：
  - `specs/1flowse/README.md` 只索引 `10` 个入口
  - `plans` 已超过单目录 `15` 文件约定
  - 已完成 plan 仍和活动 plan 混放
- 当前 QA 绿灯需要分层看：
  - `style-boundary` 在沙箱里因 Vite 端口监听报 `EPERM`
  - `verify-backend` 在沙箱里因本地权限依赖报 `Operation not permitted`
  - 提权后两者都可通过
  - `8` 个 package 配置了 `passWithNoTests`，其中 `6` 个本轮实际没有测试文件

## 当前最值得继续推进的主线

| 优先级 | 动作 | 预期结果 | 备注 |
| --- | --- | --- | --- |
| `P0` | 固定 `specs / plans / qa-report / userDocs / modules` 的职责矩阵 | 文档不再混写 | 不建议继续拖 |
| `P0` | 给 `docs/superpowers/plans` 增加 `active / completed / archived` 生命周期 | 活动入口稳定，可归档旧 plan | 需要整理历史 plan |
| `P0` | 把模块状态改成 `design / implementation / verification / evidence` 四列 | 模块成熟度表达回到可举证状态 | 比旧的三轴更实用 |
| `P0` | 对前端下一步唯一真相层做拍板：继续执行正式控制台设计，或显式冻结它 | 前端不再被两个阶段文档同时牵引 | 这是当前最关键决策 |
| `P1` | 如果正式控制台设计仍有效，把它转成唯一活动 plan 并一次性收口 `route / shell / page copy / tests` | 前端绿灯不再保护 bootstrap 过渡态 | 不建议零散修词 |
| `P1` | 把 QA 结论拆成 `static / sandbox-safe / local-service / manual` 四层 | 绿灯含义更诚实 | 需要改报告口径 |
| `P1` | 为 `passWithNoTests` 建“补测或豁免”清单 | 测试状态不再混写 | 属于 shared package 治理 |
| `P1` | 为 `docs/userDocs` 建最小信息架构 | 用户侧真相层开始成形 | 建议先结构后正文 |
| `P2` | 在真相层收口后，再做 bundle 优化和热点文件拆分 | 避免次优先级问题抢主线 | 当前不建议提前做 |

## 当前明确建议

1. 不要继续让 `completed` 同时表示“设计已确认”和“实现已完成”。
2. 不要继续把已执行完成的 plan 和活动 plan 混放在同一入口层。
3. 前端下一步建议先明确 `2026-04-13-console-shell-auth-settings-design.md` 是否仍为有效方向。
4. 如果该方向仍有效，建议它成为前端唯一活动 plan，不要再边讨论边在旧 bootstrap 语义上打补丁。
5. `docs/userDocs` 第一页先写“项目现状”，第二页写“模块状态矩阵”，第三页写“QA 分层说明”。

## 待拍板事项

1. 是否立即冻结本专题继续新增顶层 `spec/plan`，先治理文档生命周期和模块状态：
   建议：`是`
2. `2026-04-13-console-shell-auth-settings-design.md` 是否继续作为前端下一步唯一方向：
   建议：`是`，若不继续就显式标记暂缓/废弃
3. `docs/userDocs` 是否先落三页最小结构：
   建议：`是`

## 已废弃的旧口径

- 废弃：“前端当前主要还是结构混乱，先做目录整改”
  - 新结论：结构整改基本完成，当前主要问题是更晚确认的正式控制台方案没有进入代码和测试真相层
- 废弃：“`embedded-apps` 仍只是 placeholder 页”
  - 新结论：该页已有正式中文文案和测试，但整体前端仍停留在 bootstrap 过渡语义
- 废弃：“统一门禁通过，足够说明主路径已就绪”
  - 新结论：更准确的说法是工程门禁已建立，但产品主路径和用户文档真相层仍未收口

## 下次讨论最值得先拍板的问题

1. 是否先处理文档生命周期和模块状态矩阵，而不是继续新增同主题文档。
2. 前端是否直接进入“正式控制台设计 -> 唯一活动 plan -> 一次性语义收口”。
3. `docs/userDocs` 是否先落“项目现状 / 模块状态矩阵 / QA 分层说明”三页。

## 讨论记录

- `2026-04-14 05`：确认当前统一门禁可成立，主问题收敛到文档生命周期、模块状态表达和前端语义失真。
- `2026-04-14 06`：确认问题核心不是“代码先坏了”，而是“表达成熟度的真相层先失真”。
- `2026-04-14 07`：进一步确认前端结构整改已经完成；当前更关键的问题是“更晚确认的正式控制台方案没有进入代码和测试真相层”，因此下一步应先拍板前端唯一活动文档入口。
