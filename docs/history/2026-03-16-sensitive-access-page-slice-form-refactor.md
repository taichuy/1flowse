# 2026-03-16 sensitive access inbox 手动 slice 入口与页面拆层

## 背景

- `docs/dev/runtime-foundation.md` 当前把 waiting / approval / notification 的 operator 主链列为持续高优先级。
- `/sensitive-access` 页面已经具备按多种 query 参数切 slice 的能力，但更多依赖从 run diagnostics、published detail 等其他入口跳转进来。
- 同时 `web/app/sensitive-access/page.tsx` 已成长为 500+ 行聚合页，筛选 chips、channel diagnostics 和 slice 状态展示混在同一文件中，不利于继续补动作面。

## 目标

- 给 operator 一个可以直接输入 `run_id / node_run_id / access_request_id / approval_ticket_id` 的入口，减少必须依赖外部 cross-link 才能定位阻断对象的跳转成本。
- 把 sensitive access inbox 页面按“共享状态 / filter section / slice form / channel health”拆层，避免后续继续把治理 UI 堆回单体页面。

## 实现

- 新增 `web/components/sensitive-access-inbox-page-shared.ts`，集中管理：
  - filter state 类型
  - approval / waiting / decision / requester / notification 的选项常量
  - 时间格式化与是否存在激活筛选的辅助函数
- 新增 `web/components/sensitive-access-inbox-filter-section.tsx`，收口一类 filter chips 的 Link 生成逻辑，避免页面重复拼装 `buildSensitiveAccessInboxHref(...)`。
- 新增 `web/components/sensitive-access-inbox-slice-form.tsx`：
  - 通过 `GET` 表单直接输入 `run_id / node_run_id / access_request_id / approval_ticket_id`
  - 保留当前治理维度筛选为 hidden fields，避免手动输入 slice 时把已有状态过滤丢掉
- 新增 `web/components/sensitive-access-channel-health-panel.tsx`，把 channel capability / dispatch diagnostics 独立成单独面板。
- 重写 `web/app/sensitive-access/page.tsx`：
  - 保留原有筛选和快照获取逻辑
  - 接入新的手动 slice 表单
  - 将 page 主要职责收敛为“解析 query、构造 filter state、获取 snapshot、拼装面板”

## 影响范围

- 用户层：operator 可不依赖其他页面跳转，直接输入阻断对象 ID 进入治理视图。
- AI 与人协作层：run / node run / request / ticket 的共享事实入口更直接，降低 callback waiting 与 approval pending 联合排障的上下文丢失。
- 架构层：`/sensitive-access` 页面从单体聚合页拆成多个稳定 section，后续继续补批量动作、解释卡片或更细 controller 时更容易维持职责边界。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 下一步

- 继续把 `/sensitive-access` 从“可筛选、可查看”推进到“更可执行”：
  - 优先补贴近 blocker 的治理动作入口，而不只是跳回 inbox
  - 再把 callback waiting / approval pending 的 explanation 与 action suggestion 继续前置到 page section 级别
