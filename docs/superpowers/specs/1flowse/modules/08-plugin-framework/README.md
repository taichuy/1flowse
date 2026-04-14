# 08 插件体系

日期：2026-04-14
状态：规则已确认，能力未完备

## 讨论进度

- 状态：`rules_confirmed`
- 完成情况：插件来源分级、消费边界、信任模型和 `plugin-runner` 宿主方向已收敛；当前代码只落了部分边界约束与基础骨架。
- 最后更新：2026-04-14 19:45 CST

## 本模块范围

- 插件来源与信任分级
- 插件消费方式与绑定边界
- `plugin-runner` 宿主方向
- 安装 / 启用 / 分配 / 绑定 / 使用的生命周期规则
- manifest / schema / RPC 的未来实现基线

## 当前代码事实

- `plugin-framework` 已有基础消费类型与绑定约束
- `runtime extension` 绑定目标已限制为 `workspace` 或 `model`
- `capability plugin` 继续要求显式选择使用
- `plugin-runner` 目前只有独立宿主与健康检查骨架
- 当前还没有：
  - 插件安装任务
  - manifest / schema 校验器
  - 已安装注册表
  - runner `load / unload / invoke` 闭环
  - 管理台与分配 UI

## 已确认稳定规则

- 插件体系继续保留“声明式能力插件 + 受控代码插件”的双轨方向。
- 来源分级继续固定为：
  - `official_whitelist`
  - `community`
  - `unknown`
- 风险来源代码插件启用前必须由 `root / admin` 二次确认，不得静默启用。
- 插件消费语义继续分为：
  - `host-extension`
  - `runtime extension`
  - `capability plugin`
- 其中：
  - `host-extension` 才允许参与系统级扩展
  - `runtime extension` 与 `capability plugin` 不允许注册 HTTP 接口
  - 二者只能挂到宿主预定义白名单槽位
- `runtime extension` 继续只允许绑定：
  - `workspace`
  - `model`
- `capability plugin` 即使已安装和分配，也仍需在具体配置里显式选中。
- 当前启用链路继续固定为：
  - 安装
  - 启用
  - 分配
  - 绑定
  - 使用

## 当前模块的正确口径

本模块当前不能再写成“已完成实现”。

更准确的说法是：

- 规则已经确认
- 风险边界已经收口
- 基础骨架已经存在
- 但完整插件产品能力还没做完

## 后续实现仍应对齐的设计基线

后续若继续推进插件实现，仍应对齐以下历史已确认结论：

- 来源分级与启用审批规则
- `manifest + schema + assets + optional wasm` 的统一包结构
- `plugin-runner` 作为共享宿主进程
- 内部 RPC 方法集与密钥保护
- 升级、禁用、卸载与引用保护策略

这些结论仍然有效，但目前不能被引用成“已有实现”。

## 当前结论摘要

- `08` 保留为独立模块，因为它已经形成稳定扩展边界，不只是未来想法。
- 但本模块当前状态必须明确为“规则已确认，能力未完备”，避免后续把历史设计稿误当成现成实现。
