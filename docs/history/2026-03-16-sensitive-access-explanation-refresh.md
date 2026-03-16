# 2026-03-16 敏感访问解释链路补强

## 背景

- 在本轮重新阅读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md` 与 `docs/dev/runtime-foundation.md` 后，可以确认当前项目主骨架已经足够支撑继续做业务闭环。
- 结合 `docs/dev/runtime-foundation.md` 的最新优先级，当前最直接影响“用户层 / AI 与人协作层 / AI 治理层”一致性的缺口，已经从“有没有敏感访问事实”转向“operator 能否在 run detail / publish detail / inbox / access blocked 入口看到一致的策略解释”。
- 上一条提交 `ccebd86 refactor: split run trace view helpers` 继续沿“拆热点、保持 route/service facade 轻量”的主线推进，没有改变优先级方向；因此本轮适合直接补 explanation 闭环，而不是回头重搭框架。

## 目标

- 为敏感访问请求补齐统一的 `decision_label / reason_label / policy_summary` 解释字段。
- 让 run diagnostics、published invocation detail、sensitive access inbox 和 access-blocked 卡片复用同一套 operator 可读解释，而不是只暴露底层 `reason_code`。
- 在不引入第二套治理模型的前提下，继续强化现有 sensitive access 主链的可观测性与可运维性。

## 实现

### 后端

- 新增 `api/app/services/sensitive_access_reasoning.py`，集中维护 sensitive access `decision` / `reason_code` 的标签与策略解释映射，避免文案散落在 route、presenter 或前端页面里各自维护。
- 扩展 `api/app/schemas/sensitive_access.py` 中的 `SensitiveAccessRequestItem`，新增：
  - `decision_label`
  - `reason_label`
  - `policy_summary`
- 更新 `api/app/services/sensitive_access_presenters.py`，所有 `/api/sensitive-access/*`、run execution view、published invocation detail 中复用的 request 序列化都自动带出解释字段。
- 更新 `api/app/api/routes/sensitive_access_http.py`，让 access-blocked HTTP 响应也返回同样的解释字段，避免“正常详情页有解释、被阻断页只剩 reason code”的入口差异。

### 前端

- 新增 `web/lib/sensitive-access-presenters.ts`，集中承接 sensitive access 的前端展示规则与 fallback，避免 run diagnostics、inbox、blocked card 再各自写一遍标签映射。
- 更新 `web/components/sensitive-access-timeline-entry-list.tsx`：
  - decision 展示改为人可读标签
  - reason 展示改为可读文案
  - 新增 policy summary 展示
- 更新 `web/components/sensitive-access-inbox-entry-card.tsx`：
  - 补 decision / reason 标签
  - 新增 policy summary 卡片
- 更新 `web/components/sensitive-access-blocked-card.tsx`：
  - blocked 入口也改为展示统一 decision / reason 标签
  - 新增 policy summary，减少 operator 只看到阻断提示却不知道策略原因的情况

## 验证

- `cd api; .\.venv\Scripts\python.exe -m pytest -q tests/test_sensitive_access_routes.py tests/test_run_view_routes.py tests/test_workflow_publish_routes.py`
  - 结果：`34 passed in 5.14s`
- `cd api; .\.venv\Scripts\python.exe -m pytest -q`
  - 结果：`304 passed in 42.30s`
- `cd web; pnpm exec tsc --noEmit`
  - 结果：通过
- `cd web; pnpm lint`
  - 结果：通过
- `git diff --check`
  - 结果：通过

## 影响评估

### 对问题 1：架构承载度

- 这次改动没有引入新的治理对象或第二套 DSL，而是继续沿既有 `SensitiveAccessRequest / ApprovalTicket / NotificationDispatch` 主链增强 presenter 层能力，符合 `7Flows IR` 与统一事实源边界。
- explanation 映射集中在独立 helper，而不是散落在多个 route / component 中，有助于后续扩充 reason code 时保持兼容性和稳定性。

### 对问题 2：业务闭环完整度

- 用户层：operator 在 inbox / blocked card 能更快理解为什么被拦截、为什么需要审批。
- AI 与人协作层：run detail 与 publish detail 的 sensitive access timeline 不再只给出底层 code，人与 AI 共享的事实更容易被理解和复核。
- AI 治理层：统一的策略解释让 sensitive access 从“有审批数据”进一步变成“可解释、可排障、可追责”的治理入口。

### 对问题 4：热点文件与解耦

- 本轮没有继续拉长已有热点，而是新增独立 helper：
  - `api/app/services/sensitive_access_reasoning.py`
  - `web/lib/sensitive-access-presenters.ts`
- 这符合当前 `runtime-foundation.md` 的主线：新增能力优先拆 helper / presenter，而不是把复杂度重新堆回 route、service facade 或页面组件。

## 下一步建议

1. **P0：继续补 waiting callback 与 approval 的联合排障解释**
   - 现在 sensitive access explanation 已打通，但 callback waiting / approval decision / resume scheduling 之间的联合解释还不够强。
2. **P1：把 execution node card 内部区块继续细分**
   - tool / ai / callback ticket / artifact 区块仍有继续拆 presenter 的空间。
3. **P1：把更多 publish/editor 入口接上同一套治理解释与字段级焦点**
   - 继续减少“事实层已统一，但操作入口体验仍分散”的问题。
