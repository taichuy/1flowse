# services 协作说明

先读根目录 [AGENTS.md](/E:/code/taichuCode/7flows/AGENTS.md)，再处理 `services/`。

## 目录定位

- `services/` 用于兼容适配或独立服务边界。
- 当前已落地目录是 `services/compat-dify/`。
- 服务层解决外部生态接入、翻译、调用代理和健康检查，不承担工作流主控，也不是 sandbox backend 替身。

## 默认技能

- 服务实现或审查：`plugin-service-development`
- 服务测试：按需组合 `backend-testing`
- 收尾：`development-closure`

## 服务边界

- 保持 `compat adapter`、catalog、invoke、health check 的服务内边界，不把 runtime orchestration 或 sandbox backend registry 拖进 `services/`。
- 外部生态协议的翻译逻辑留在服务层；共享领域模型仍以 `7Flows IR` 为准。
- 服务开发继续遵守 local-first、loopback-first，不新增共享远程依赖或隐藏联网主链。

## 验证要求

- 服务改动至少运行对应测试，并同步检查服务 README 与技能案例是否仍然准确。
