# 2026-03-14 统一敏感访问控制基座设计

## 背景

用户在本轮架构讨论中明确说明：7Flows 的“安全、授权、通知”其实是同一条链上的交叉能力，不应拆成互不相干的模块。平台当前不需要预置“支付信息 / 个人隐私 / 危险工具能力”等业务分类，而应先提供统一的分级访问管理流程：业务侧声明资源文本与敏感等级，平台负责访问请求、人工审核、通知与审计闭环。

## 目标

- 在产品设计中明确“敏感访问控制”是统一运行时能力，而不是先做独立人工审核节点。
- 在技术补充中补齐对象模型、决策流、审批通知与 Tool Gateway / waiting-resume 集成点。
- 在当前事实索引与仓库协作规则中标记：这属于架构初期事项，但当前代码还未完整落地。

## 决策与落地

- 在 `docs/product-design.md` 中新增 `SensitiveResource`、`AccessRequest`、`ApprovalTicket` 核心对象，并把“统一敏感访问控制”写入产品价值、设计原则、MVP 能力、系统架构与运行模型。
- 在 `docs/product-design.md` 中明确：
  - 首版不预置行业分类，只管理 `sensitivity_level`
  - 授权 = 人工审核驱动的运行时能力
  - 通知是人工审核的触达机制
  - 首版不把“人工审核节点”作为标准节点类型
- 在 `docs/technical-design-supplement.md` 中补充 `Sensitive Access Control` 最小对象模型、审批通知流、`need_review` / `approval_required` 语义，以及 Tool Gateway 的策略决策与审批挂点。
- 在 `docs/dev/runtime-foundation.md` 中补充当前事实：已有 ToolGateway、waiting/resume、callback ticket 原语，但尚无统一的 access request / approval ticket / notification 事实层；并把该方向提升到下一步优先级。
- 在 `AGENTS.md` 与 `docs/dev/user-preferences.md` 中同步沉淀为长期协作约束，避免后续实现时又退回到“做行业分类”或“直接新增人工审核节点”的路径。

## 影响范围

- 产品定位、MVP 范围、系统架构与运行模型描述。
- 安全与交互模型、Tool Gateway 职责、waiting/resume 设计、审计追溯模型。
- 后续工作台、审批视图、通知适配器、凭证访问、敏感上下文读取与发布出口治理。

## 验证方式

- 回读 `docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md`、`AGENTS.md` 和 `docs/dev/user-preferences.md`，确认“分级管理、不做业务分类、授权=人工审核、通知=审批触达、waiting/resume 闭环”表述一致。
- 使用 `git diff --check` 验证本轮文档改动没有引入格式告警。

## 未决问题 / 下一步

- 当前仍需在实现层明确事实表与 API：`SensitiveAccessRequest`、`ApprovalTicket`、通知投递记录是否复用现有 callback ticket 还是单独建模。
- 通知通道首版建议先以站内 / webhook 为主，飞书、Slack、邮件等外部 channel 后续再通过适配器扩展。
- 人工审核节点是否需要包装为显式节点壳层，建议等统一敏感访问控制能力稳定后再决定，而不是抢跑定义节点类型。
