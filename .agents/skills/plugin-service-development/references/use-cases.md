# 插件 / 兼容服务技能使用案例

## 案例 1：调整 `services/compat-dify` 的 invoke contract

- 触发条件：`/invoke` 请求体、执行提示 contract、translated payload 或 response mapping 发生变化。
- 重点检查：服务边界是否仍清楚、compat adapter 是否没有被误当成 sandbox backend、README 与测试是否同步。

## 案例 2：新增一个新的 compat service 骨架

- 触发条件：准备在 `services/` 下新增 `compat-*` 服务。
- 重点检查：目录级 `AGENTS.md`、服务 README、skill 索引、shared docs 和 ADR 是否都跟上。

## 案例 3：维护 plugin catalog / manifest 转译

- 触发条件：manifest 字段、catalog 结构、工具 schema 或 metadata mapping 发生调整。
- 重点检查：外部协议字段是否只停留在服务边界，内部仍以 `7Flows IR` 和统一 tool contract 为准。

## 案例 4：补 compat service 测试

- 触发条件：服务已有功能链路，但缺测试或回归保护。
- 重点检查：优先覆盖 catalog、translate、invoke、health check 等完整主链，而不是只补单个琐碎 helper。
