# 文档计划审计待确认

日期：`2026-04-13 02`

## 建议优先级

- [ ] `P0` 建立 `docs/superpowers` 的执行真相层
  - 建议：做
  - 最小范围：
    - `docs/superpowers/specs/1flowse/README.md` 补齐缺失文档入口
    - `docs/superpowers/specs/1flowse/modules/README.md` 拆成 `spec_status / implementation_status / verification_status`
    - 已落地的 `plan` 同步勾选，或补统一的 `execution_state`
  - 原因：当前根索引、模块状态、计划勾选是三套口径，离线看文档最容易误判

- [ ] `P0` 修复当前验证门禁
  - 建议：做
  - 最小范围：
    - `web/app/src/app/App.test.tsx` 改部分 mock，或补 `getDefaultApiBaseUrl`
    - `api/crates/control-plane/src/auth.rs` 为 `AuthenticatorRegistry` 补 `Default`
    - 后续验证报告继续明确区分“沙箱受限”与“真实代码失败”
  - 原因：现在前端 test 红、后端 clippy 红，会持续污染每一轮审计结论

- [ ] `P1` backend foundation 只推进前两块，不继续扩新域
  - 建议：做
  - 范围：
    - `ApiSuccess / public auth / session / router` 对齐
    - `storage-pg` 拆 `repository + mapper`
  - 原因：当前 auth/team slice 已成立，但 runtime/modeling/plugin 继续叠加会把边界继续压进旧结构

- [ ] `P1` 前端只补一条最小真实主路径
  - 建议：做
  - 推荐路径：`工作台列表 -> 应用概览 -> 进入 agentFlow shell`
  - 不建议：同时继续扩 embedded 管理、更多占位页、更多静态文档映射
  - 原因：现在前端还只能验证壳层，不能验证真实产品路径

- [ ] `P2` `docs/userDocs` 结构先保持稳定，不再继续做目录级重写
  - 建议：做
  - 规则：
    - 继续沿用 `AGENTS.md + user-memory + 四类记忆 + tool-memory + todolist`
    - 新问题优先写进滚动 QA / todolist，不额外引入新的平行记忆分类
  - 原因：这一块当前已经基本对齐，继续改结构收益低，反而会增加认知噪声

- [ ] `P2` 固定当前两个文件作为唯一滚动审计入口
  - 建议：做
  - 规则：
    - 后续继续更新 `docs/qa-report/document-plan-audit.md`
    - 后续继续更新 `docs/userDocs/todolist/document-plan-audit.md`
    - 若旧判断失效，直接覆盖旧结论，不追加平行版本
  - 原因：入口已经建立，下一步重点是保持唯一来源，不让报告再次分叉

## 我当前的明确建议

1. 下一轮先不要继续扩新功能或新增模块文档。
2. 先把 `docs/superpowers` 的索引、状态表达、计划执行状态统一起来。
3. 同时修掉前端 test 和后端 clippy 两个门禁噪声点。
4. 然后只推进 backend foundation 前两块和前端一条最小真实主路径。
5. `docs/userDocs` 先保持稳定，用它服务决策，不要再把精力放在重构目录模型上。
