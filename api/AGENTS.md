# api 协作说明

先读根目录 [AGENTS.md](/E:/code/taichuCode/7flows/AGENTS.md) 与 [API README](/E:/code/taichuCode/7flows/api/README.md)，再处理 `api/`。

## 默认技能

- 审查或风险分析：`backend-code-review`
- 补测或验证：`backend-testing`
- 收尾：`development-closure`

## 后端边界

- 保持 `7Flows IR`、runtime、published surface、trace facts 的统一主链，不引入第二套执行语义。
- 路由保持薄，service 负责编排，repository 负责复杂持久化；不要把外部协议细节直接扩散进核心模型。
- `compat adapter` 与 `sandbox backend` 必须职责分离；高风险执行路径继续坚持 `fail-closed`。
- 运行追溯、调试和 AI/operator 排障优先复用 `runs / node_runs / run_events` 及其聚合视图，不另起事实源。

## 验证要求

- 后端改动至少补充或运行相关测试。
- 如果修改 API 契约、运行时行为或治理边界，同步检查 `docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/team-conventions.md` 与相关 skill。
