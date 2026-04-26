---
created_at: 2026-04-26 09
feedback_category: frontend_interaction
decision_policy: direct_reference
scope: agent-flow node detail floating panel
---

# 节点详情浮层优先打开在详情面板左侧空白区

规则：从节点详情面板中打开的共享浮层，不应默认压在详情面板内部；应优先定位到节点详情面板左侧的画布空白区域。

原因：浮层承载的是聚焦编辑任务，压在详情面板内部会遮挡当前字段列表和后续内容；放到详情左侧空白区能保留上下文，同时减少详情面板内部拥挤。

适用场景：`agent-flow` 节点详情中的模型设置、输入字段设置、变量/参数编辑等 floating panel。定位时优先锚定 `.agent-flow-node-detail` 左边界；找不到节点详情容器时再回退到触发器左侧。
