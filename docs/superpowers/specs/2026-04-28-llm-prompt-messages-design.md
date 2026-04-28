# LLM Prompt Messages 设计稿

日期：2026-04-28
状态：已确认方向，待进入实现

## 1. 文档目标

本文档用于收口 agent-flow 的 LLM 节点上下文消息配置设计，明确：

1. LLM 节点从单一 `system_prompt + user_prompt` 升级为有序消息列表。
2. 消息列表如何在 Inspector 中编辑、添加、删除和拖拽排序。
3. 初始化创建应用与手动新增 LLM 节点的默认值差异。
4. 前端 draft、flow schema 和后端 runtime 的兼容策略。

## 2. 任务理解

用户希望 LLM 节点具备类似 Dify 的上下文消息配置能力：默认支持系统消息，允许添加 `USER` 与 `ASSISTANT` 对话消息，并能上下拖拽排序。新增的消息必须真实加入模型上下文，而不是只改变前端展示。

这次不是独立页面，也不是调试聊天面板；落点是编排画布中 LLM 节点右侧 Inspector 的配置区。

## 3. 参考图拆解

可借鉴：

1. `SYSTEM / USER / ASSISTANT` 作为消息块标题和角色选择。
2. 每条消息块有独立编辑区、变量插入、复制、放大编辑等动作。
3. 消息块左侧提供拖拽手柄，顺序即上下文顺序。
4. “添加消息”位于消息列表底部，追加新的对话消息。

不可直接照搬：

1. Dify 的品牌色、字号、圆角和控件密度。
2. Dify 的完整提示词模板协议。
3. 只做 UI 但不改 runtime 的假上下文能力。

最终视觉和状态语义以当前 `DESIGN.md`、Ant Design Shell 和现有 `TemplatedTextField` 为准。

## 4. 交互架构快审

- 首屏主任务：用户在 LLM 节点 Inspector 中配置模型输入上下文。
- L0 概览：画布节点卡片继续只展示模型摘要，不塞入消息列表。
- L1 聚焦：LLM 消息上下文属于当前节点详情，继续放在 Inspector 设置页。
- L2 管理：消息列表自身承接局部管理能力，包括添加、删除、角色切换和排序。
- L3 执行：节点运行和整流调试沿用现有运行入口。
- 一致性规则：同类消息统一使用消息行块，不再让 `System Prompt` 与 `User Prompt` 作为两套独立编辑 UI 并存。
- 明确建议：这是 LLM 节点配置模型升级，不需要重组应用导航或画布层级。

## 5. 数据合同

新增 LLM 专用 binding：`bindings.prompt_messages`。

建议结构：

```ts
type LlmPromptMessageRole = 'system' | 'user' | 'assistant';

type LlmPromptMessage = {
  id: string;
  role: LlmPromptMessageRole;
  content: {
    kind: 'templated_text';
    value: string;
  };
};

type FlowBinding =
  | ExistingBindings
  | {
      kind: 'prompt_messages';
      value: LlmPromptMessage[];
    };
```

规则：

1. `value` 是有序数组，数组顺序就是模型上下文顺序。
2. 每条消息内容使用 `templated_text`，继续支持 `{{node.output}}` 变量块。
3. `id` 只服务前端稳定渲染、拖拽和删除，不承担业务语义。
4. `system` 消息允许多条，但 runtime 会按顺序合并到 provider 的 `system` 字段，以保持当前 provider contract。
5. `user` 与 `assistant` 消息按顺序进入 provider 的 `messages`。

## 6. 默认值规则

初始化创建应用：

1. 默认文档仍是 `Start -> LLM -> Answer`。
2. LLM 节点默认生成 `prompt_messages`。
3. 默认消息包含空 `SYSTEM` 和一个 `USER`。
4. 默认 `USER` 引用 `Start / userinput.query`，等价于 `{{node-start.query}}`。
5. 目标是创建后应用可直接试跑。

画布中手动新增 LLM 节点：

1. 节点工厂只生成空 `SYSTEM` 消息。
2. 不自动生成 `USER`。
3. 不自动引用 `Start / userinput.query`。
4. 用户需要通过“添加消息”自行添加 `USER / ASSISTANT` 并选择变量。
5. 目标是不在复杂流程里替用户假设上下文来源。

## 7. 前端设计

LLM 节点设置页中，模型字段下方显示“上下文”消息列表。

消息项能力：

1. 拖拽手柄：用于上下排序。
2. 角色选择：支持 `SYSTEM / USER / ASSISTANT`。
3. 内容编辑：复用现有 `TemplatedTextField` 的变量插入、复制、放大编辑能力。
4. 删除：删除当前消息；手动新增节点中的默认 `SYSTEM` 也允许删除，但删除到空列表时显示空状态和添加入口。
5. 添加消息：默认追加 `USER`，用户可改成 `ASSISTANT` 或 `SYSTEM`。

视觉约束：

1. 不引入新组件库。
2. 沿用现有 `agent-flow` detail panel 样式边界。
3. 不裸写递归 `.ant-*` 覆写。
4. 消息块保持工作台密度，不做营销式卡片堆叠。

## 8. 后端运行时设计

runtime 构造 provider 输入时按以下顺序处理：

1. 优先读取 `bindings.prompt_messages`。
2. 渲染每条消息的 `templated_text`。
3. `system` 消息按顺序合并为 provider 的 `system` 字段。
4. `user / assistant` 消息按顺序映射为 provider `messages`。
5. 如果没有 `prompt_messages`，回退读取旧字段 `system_prompt` 与 `user_prompt`。

兼容目标：

1. 旧草稿、旧测试数据和已保存流程不因 schema 升级失效。
2. 新编辑后的 LLM 节点优先写入 `prompt_messages`。
3. 运行 trace 中继续保留 resolved inputs，便于调试消息渲染结果。

## 9. 测试范围

前端测试：

1. 默认应用模板的 LLM 节点展示 `SYSTEM + USER`，且 `USER` 引用 `Start / userinput.query`。
2. 手动新增 LLM 节点只带空 `SYSTEM`。
3. 消息可以添加、删除、切换角色和拖拽排序。
4. 旧 `system_prompt / user_prompt` 能在 UI 中兼容显示。

后端测试：

1. `prompt_messages` 会按顺序生成 provider `messages`。
2. `assistant` 消息会真实进入 provider `messages`。
3. 多条 `system` 消息会合并到 provider `system`。
4. 旧 `system_prompt / user_prompt` 仍可执行。

schema / 文档测试：

1. `FlowBinding` 支持 `prompt_messages`。
2. 默认文档模板和本地文档 helper 保持一致。
3. 节点工厂默认值与初始化模板默认值分离。

## 10. 非目标

本次不做：

1. 多模态消息。
2. tool call 消息。
3. Dify 完整提示词模板协议。
4. 调试对话历史回灌到 LLM 节点配置。
5. 发布态迁移脚本；当前通过 runtime 兼容旧字段。
