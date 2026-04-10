# 2026-04-10 单体 Rust 后端部署决策

- 用户确认：P1 暂时不启用独立 `runtime-worker`。
- 当前后端部署基线统一为：`单体 Rust 模块化后端 + PostgreSQL + Redis + RustFS`。
- 运行时继续保留逻辑分层，采用进程内 `scheduler + worker pool + recovery loop + callback requeue` 组织执行，但不单独作为独立服务部署。
- 后续若规模上升，可在单体边界稳定后再评估是否把运行时独立拆出；当前所有架构与实施计划应以“单体 Rust”作为正式基线。
