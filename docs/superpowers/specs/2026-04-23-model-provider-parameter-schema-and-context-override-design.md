# 模型供应商参数 Schema 与上下文覆盖设计

## 背景

当前 `model-providers/options` 合同把 `parameter_form` 挂在每个模型上，前端在 `LLM` 节点里也是按“当前选中模型”读取参数表单。

这会带来两个问题：

1. `temperature`、`top_p`、`max_tokens`、`seed` 这类参数本质上是供应商协议能力，不是单个模型各自独有的表单。
2. `context_window` 这类信息又确实是模型元信息，不应被提升到供应商级。

当前 `openai_compatible` 插件在调用时已经支持透传常见参数，但没有把参数 schema 作为供应商级能力声明出来；同时它对动态发现模型的 `context_window` / `max_output_tokens` 也还没有补齐解析。

## 目标

本次设计要同时解决参数归属、模型元信息显示和上下文兜底配置三件事：

1. 把 `parameter_form` 从模型级改为供应商级。
2. 保持 `context_window`、`max_output_tokens`、`supports_*` 继续留在模型级。
3. `openai_compatible` 插件优先自动提取模型上下文和输出上限。
4. 当插件提取不到 `context_window` 时，允许用户在“添加模型 / 编辑模型”时为单个模型填写覆盖值。
5. 覆盖值底层统一存纯数字，界面层使用 `16K`、`128K`、`1M` 这类缩写显示。
6. 宿主不猜供应商能力；参数 schema 和模型元信息都由插件声明，用户手工输入只作为明确兜底。

## 非目标

本次不做以下内容：

1. 不为其他尚未接入的模型供应商协议设计通用兼容层。
2. 不把 `context_window` 提升到供应商级。
3. 不自动猜测未知模型的上下文窗口。
4. 不做旧合同兼容和双写，按当前项目阶段直接切到新合同。
5. 不在本轮引入更多模型级人工元信息字段，先只补 `context_window` 覆盖。

## 方案选择

### 方案 A：全部改成供应商级

做法：

1. `parameter_form`、`context_window`、`max_output_tokens` 全部挂到 provider 上。

问题：

1. 参数语义正确，但模型元信息语义错误。
2. 同一供应商下不同模型上下文不同的场景无法表达。

### 方案 B：全部保留模型级

做法：

1. 延续现在的结构，让每个模型各自带 `parameter_form`。

问题：

1. 把同一份供应商协议能力复制到每个模型，插件维护成本高。
2. 宿主和插件边界不干净，参数归属语义不对。

### 方案 C：参数 provider 级，元信息 model 级，覆盖值 model 配置级

做法：

1. `parameter_form` 改为 provider 级。
2. `context_window`、`max_output_tokens`、`supports_*` 继续保留在 model 级。
3. 用户手工上下文覆盖放到 `configured_models[*]`。

本次采用方案 C。

原因：

1. 参数归供应商协议，模型元信息归模型本身，边界清楚。
2. 插件只需要声明一份 provider 级参数 schema，不再对每个模型重复维护。
3. 模型级上下文覆盖可以自然挂在“添加模型 / 编辑模型”的现有行配置结构里。

## 合同设计

### `model-providers/options`

当前结构：

1. `providers[*].model_groups[*].models[*].parameter_form`

目标结构：

1. `providers[*].parameter_form`
2. `providers[*].model_groups[*].models[*]` 保留：
   - `context_window`
   - `max_output_tokens`
   - `supports_streaming`
   - `supports_tool_call`
   - `supports_multimodal`

语义：

1. `providers[*].parameter_form` 表示“该供应商协议支持的通用可调参数”。
2. `models[*].context_window` 表示“插件自动识别出的模型上下文窗口”。
3. 如果某个模型存在用户手工覆盖值，前端展示时应优先显示覆盖后的有效上下文。

### `configured_models`

当前结构：

1. `model_id`
2. `enabled`

目标结构：

1. `model_id`
2. `enabled`
3. `context_window_override_tokens: number | null`

语义：

1. 该字段是模型级人工覆盖值。
2. 仅在插件没有返回准确上下文，或者管理员明确希望修正展示值时填写。
3. 底层一律存 token 纯数字，不存 `16K` 这类缩写字符串。

## 插件设计

### `openai_compatible` 参数 schema

插件新增一份 provider 级 `parameter_form`，第一版先包含：

1. `temperature`
2. `top_p`
3. `max_tokens`
4. `seed`

边界：

1. 只纳入当前插件调用链已经明确支持透传的参数。
2. 不为了“看起来完整”而先行加入未确认支持的参数。

### `openai_compatible` 模型元信息提取

插件 `list_models` 继续从 `GET /models` 获取模型列表，并在归一化阶段补齐常见字段提取。

提取目标：

1. `context_window`
2. `max_output_tokens`

提取原则：

1. 只做字段兼容提取，不做推断。
2. 找到常见字段别名就映射，找不到就返回 `null`。

建议兼容的字段别名：

1. `context_window`
2. `context_length`
3. `input_token_limit`
4. `max_output_tokens`
5. `output_token_limit`
6. `max_tokens`

## 宿主有效值规则

### 参数 schema

参数表单来源固定为：

1. `selectedProvider.parameterForm`

不再从 `selectedModel.parameterForm` 读取。

### 有效上下文窗口

有效上下文窗口按以下优先级解析：

1. `configured_models[*].context_window_override_tokens`
2. 插件返回的 `models[*].context_window`
3. `null`

该优先级同时用于：

1. 设置页模型配置展示
2. Agent Flow 模型选择弹窗展示
3. 后续任何只读摘要展示

本次不要求把该值写回插件缓存；它只作为宿主侧有效展示值和运行时辅助元信息。

## 前端交互设计

### 设置页：模型配置表格

“添加模型 / 编辑模型”抽屉里的模型表格新增一列：`上下文`。

该列使用“可输入下拉”控件，支持：

1. 选择预置项
2. 直接输入
3. 清空为 `null`

预置项：

1. `16K`
2. `32K`
3. `64K`
4. `128K`
5. `256K`
6. `1M`

提交归一化规则：

1. `16K -> 16384`
2. `32K -> 32768`
3. `64K -> 65536`
4. `128K -> 131072`
5. `256K -> 262144`
6. `1M -> 1048576`
7. 允许输入纯数字，例如 `200000`
8. 允许输入缩写，例如 `200K`、`1M`
9. 用户输入在解析前统一执行 `trim + toLowerCase`
10. 只接受以下格式：
   - 纯数字，例如 `200000`
   - 数字加 `k` 后缀，例如 `200k`
   - 数字加 `m` 后缀，例如 `1m`
11. 非法输入直接在前端校验阶段拦截，不写入表单提交数据，也不进入数据库
12. 最终提交时统一转成 `number`

显示格式：

1. 数据库存储和接口传输使用纯数字。
2. UI 摘要展示使用缩写格式，例如 `131072 -> 128K`。
3. UI 显示可以使用大写缩写，但解析逻辑不区分大小写。

### Agent Flow：模型选择弹窗

当前模型选择弹窗只显示模型名和来源标签。

本次补充：

1. 模型有效上下文
2. 可选显示最大输出上限

显示值来源：

1. 优先使用模型级覆盖值
2. 回退到插件自动提取值

### Agent Flow：参数面板

当前参数面板改为按供应商读取 schema。

行为：

1. 选择模型时，`llm_parameters` 初始值按 provider 级 schema 生成。
2. 切换同一供应商下不同模型时，不重新切换参数 schema。
3. 切换到不同供应商时，重新按新供应商 schema 初始化参数状态。

## 存储与迁移

### 数据库存储

`configured_models_json` 的单项新增：

1. `context_window_override_tokens`

迁移原则：

1. 旧数据默认补 `null`。
2. 旧实例如果仍然只有 `enabled_model_ids`，归一化为 `configured_models` 时同样补 `null`。

### 运行时兼容

本项目当前阶段按“优先完整一致性”处理，因此不做长期兼容层。

要求：

1. 宿主前后端 DTO、测试合同和插件版本在同一轮内一起切换。
2. 打包后的插件版本显式升级。

## 验证范围

后端需要覆盖：

1. `model-providers/options` provider 级 `parameter_form`
2. `configured_models` 新字段的创建、更新、读取、归一化
3. `enabled_model_ids` 与 `configured_models` 派生逻辑不回归
4. 插件动态模型元信息提取

前端需要覆盖：

1. 设置页模型表格新增“上下文”列
2. 可输入下拉的缩写显示和数字归一化
3. 编辑态回填现有覆盖值
4. Agent Flow 参数面板读取 provider 级 schema
5. Agent Flow 模型列表显示有效上下文

QA 重点需要检查：

1. 设置页添加模型、编辑模型、保存后回显
2. 插件自动识别成功与识别失败两种路径
3. 上下文覆盖优先级是否生效
4. 参数面板是否仍按正确供应商渲染

## 风险与约束

1. 上游 `OpenAI-compatible` 实现对 `/models` 字段并不统一，插件只能做“显式字段提取”，不能保证所有兼容服务都能自动拿到上下文。
2. `max_tokens` 在不同供应商协议里既可能表示“请求参数”，也可能表示“模型输出上限字段”；插件实现时必须区分“模型列表返回中的元信息”和“调用请求里的参数”。
3. 如果未来引入更多供应商，仍应坚持“参数 schema 由插件声明，宿主只消费，不猜测”的边界。

## 实施摘要

本轮实施按以下范围推进：

1. 宿主把 `parameter_form` 改到 provider 级。
2. 宿主在 `configured_models` 中新增模型级 `context_window_override_tokens`。
3. 设置页模型配置新增上下文可输入下拉。
4. Agent Flow 模型选择器显示有效上下文，并改为读取 provider 级参数 schema。
5. `openai_compatible` 插件补 provider 级参数 schema 与模型元信息提取。
6. 插件版本升级后再走打包、CI、CD。
