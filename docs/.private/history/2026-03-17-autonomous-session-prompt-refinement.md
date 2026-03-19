# 2026-03-17 自治开发循环提示词收口

## 背景

在上一轮已经把“自治开发应按工程观持续推进”沉淀为元流程 skill 后，用户进一步指出一个实际问题：即使好坏标准已经写进 prompt，如果启动提示词本身过满、塞入太多术语、细节和例子，AI 仍然会出现两类偏差：

- 抓不住真正高优先级
- 开始机械套原则，反而过度设计

这意味着“自治开发 prompt”不能只追求信息完整度，还必须控制密度，让 AI 能稳定抓住当前最重要的判断和动作。

## 目标

- 把自治开发启动提示词从“原则堆叠”进一步收敛成“少量高质量原则 + 明确优先级 + 明确禁止项 + 固定复盘格式”
- 提供一份适合每次全新会话开头直接复用的循环提示词模板
- 把“细节放文档和 skill、启动词保持轻量”的原则同步为仓库级长期偏好

## 本轮决策与实现

### 1. 补自治 prompt 的设计原则

更新：

- `.agents/skills/autonomous-development/SKILL.md`
- `.agents/skills/autonomous-development/references/engineering-rubric.md`

新增约束：

- 会话启动词不要塞满所有术语、所有例子和所有细则
- 启动词保留最核心的工程观、优先级和禁止项
- 更细的解释、边界和评分规则继续下沉到仓库文档与 skill reference

### 2. 新增循环提示词模板

新增：

- `.agents/skills/autonomous-development/references/session-bootstrap-prompt.md`

模板特点：

- 保留“好项目 / 好代码 / 好架构 / 坏信号”
- 保留默认优先级和明确禁止项
- 保留“愿景目标完整度”汇报要求
- 不再把过多术语、案例和推导过程塞进每次会话开头

它更适合作为用户在每次新会话开头直接发送给 AI 的固定提示词。

### 3. 同步偏好与当前事实

同步更新：

- `docs/dev/user-preferences.md`
- `docs/dev/runtime-foundation.md`

当前协作事实补充为：

- 自治开发 prompt 不只是要有工程观，还要控制信息密度
- 新会话启动词应优先使用精简模板
- 细节解释应依赖仓库内既有文档与 skill，而不是把启动词写成长规约

## 影响范围

- 每次新会话开头的自治开发提示词写法
- AI 单轮选题的稳定性
- AI 是否容易机械套原则或过度设计
- 后续 `.agents/skills/autonomous-development/` 的使用方式

## 验证

本轮为文档与 skill 资产更新，执行了：

- `git diff --check`
- 引用自查，确认 `autonomous-development` skill 已能指向新的 `session-bootstrap-prompt.md`

## 下一步

1. 后续连续自治开发回合，优先实际使用这份循环提示词模板，观察是否能减少“选题漂移”和“原则过载”。
2. 若后续仍出现固定模式的误判，再把误判模式沉淀进 `engineering-rubric.md`，而不是继续膨胀启动提示词本身。
