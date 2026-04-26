---
created_at: 2026-04-26 08
feedback_category: frontend_interaction
decision_policy: direct_reference
scope: agent-flow node detail dynamic fields
---

# 节点动态字段编辑应使用聚焦浮层

规则：节点详情里的动态字段新增/编辑，不要默认做成表格行内直接填写；应优先复用现有的浮层/弹窗壳，让用户在聚焦表单里完成新增或编辑。

原因：行内表格适合快速浏览和排序，但新增字段需要填写变量名、显示名、类型、必填、选项等多个属性，直接铺在列表里会显得拥挤且不符合当前 LLM 节点模型设置的交互节奏。

适用场景：`agent-flow` 节点详情中管理可重复配置项、动态字段、自定义变量、参数项时，主区域保留摘要列表和轻操作，新增/编辑进入与 LLM 节点模型设置类似的浮层表单。
