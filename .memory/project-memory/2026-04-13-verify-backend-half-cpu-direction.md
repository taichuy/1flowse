---
memory_type: project
topic: 统一后端验证脚本默认使用半数可用 CPU 作为 cargo 并发上限
summary: 用户在 `2026-04-13 16` 决定采用最小改动方案，不把环境判断和参数选择交给模型，而是由 `scripts/node/verify-backend.js` 统一将 `cargo` 构建与测试并发限制为当前系统可用 CPU 的一半。
keywords:
  - backend
  - verification
  - cargo
  - cpu
  - parallelism
match_when:
  - 需要判断统一后端验证脚本应如何限制资源占用
  - 需要修改 `scripts/node/verify-backend.js` 的 cargo 并发策略
created_at: 2026-04-13 16
updated_at: 2026-04-13 16
last_verified_at: 2026-04-13 16
decision_policy: verify_before_decision
scope:
  - scripts/node/verify-backend.js
  - README.md
  - api/README.md
---

# 统一后端验证脚本默认使用半数可用 CPU 作为 cargo 并发上限

## 时间

`2026-04-13 16`

## 谁在做什么

用户为统一后端验证脚本拍板资源策略，AI 负责把约定收敛到脚本和说明文档里。

## 为什么这样做

很多执行场景里模型只会直接运行统一脚本，不会额外判断当前机器资源，也不适合把环境判断细节塞进提示上下文。

## 为什么要做

如果继续裸跑全量 `cargo test`，在高并发机器上容易把资源吃满；把限制固化进脚本后，统一入口既保留速度，也降低宕机风险。

## 截止日期

无单独外部截止日期；从 `2026-04-13 16` 起作为当前仓库验证默认约定执行。

## 决策背后动机

- 采用最小改动方案，不增加模型执行时的环境判断负担
- 通过统一脚本兜底，让人工与模型都走同一条验证入口
- 默认只用半数可用 CPU，兼顾全量验证速度与机器稳定性

## 关联文档

- `scripts/node/verify-backend.js`
- `README.md`
- `api/README.md`
