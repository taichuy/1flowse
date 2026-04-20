---
memory_type: project
topic: Dify 风格的插件贡献画布节点语义澄清
summary: 用户于 `2026-04-20 00` 澄清，讨论中的“工具节点”不是指单纯消费工具能力的内置节点，而是指第三方可以开发插件，在产品上作为画布节点被用户选择和使用，方向可参考 `../dify`。后续讨论插件分层时，应区分“产品层节点形态”和“底层插件消费语义”，并重点评估 Dify 式“插件贡献节点声明/实例”是否适合 `1flowbase`，而不是误收窄为仅有工具能力消费。
keywords:
  - dify
  - canvas-node
  - plugin-contributed-node
  - tool-node
  - workflow
match_when:
  - 继续讨论插件体系如何支持第三方画布节点
  - 讨论工具节点是否只是内置节点还是可由插件贡献
  - 需要参考 ../dify 的插件节点形态
created_at: 2026-04-20 00
updated_at: 2026-04-20 00
last_verified_at: 2026-04-20 00
decision_policy: verify_before_decision
scope:
  - ../dify/web/app/components/workflow/nodes/components.ts
  - ../dify/web/app/components/workflow/nodes/tool/default.ts
  - ../dify/web/app/components/workflow/hooks/use-node-plugin-installation.ts
  - api/crates/plugin-framework/src/capability_kind.rs
  - web/app/src/features/agent-flow/lib/node-definitions/nodes/tool.ts
---

# Dify 风格的插件贡献画布节点语义澄清

## 时间

`2026-04-20 00`

## 谁在做什么

- 用户正在明确 `1flowbase` 插件体系后续是否支持第三方贡献画布节点。
- AI 在对照 `../dify` 实现后，修正之前对“工具节点”的狭义理解。

## 为什么这样做

- 如果把“工具节点”误解成“内置 Tool 节点消费工具能力”，会把产品层节点形态和底层插件分层混淆。
- 用户真正要讨论的是：第三方插件是否能在画布里成为可选择、可安装、可治理的节点。

## 为什么要做

- 这会直接影响插件 manifest、block selector、节点面板、安装依赖提示和运行时绑定边界。
- 也是 `1flowbase` 是否走向 Dify 风格插件生态的重要分叉点。

## 截止日期

- 无

## 当前澄清结论

- “工具节点”在本专题里优先指产品上的画布节点形态，而不是单纯的底层能力消费器。
- 参考目标是 `../dify` 这类“插件可贡献节点声明/节点实例，节点在画布中出现并可提示安装依赖”的模式。
- 后续给建议时，必须明确区分：
  - 产品层节点类型与节点壳
  - 插件层能力声明、安装与依赖
  - 运行时实际执行边界
- 若继续参考 Dify，需要重点辨别它是否允许任意前端节点代码注入，还是仅允许插件提供 schema 和 provider/action 声明，由宿主固定节点壳渲染。
