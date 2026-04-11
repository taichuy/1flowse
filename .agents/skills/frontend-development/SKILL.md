---
name: frontend-development
description: Use when building or changing frontend pages, flows, interactions, visual structure, or component boundaries and need to keep UI logic, state, and reuse from turning brittle
---

# Frontend Development

## Overview

前端最容易失控的原因，不是组件太少，而是把展示、状态、协议、路由、交互规则揉进同一个实现单元。本 Skill 用来在开发前端时控制边界、复用和交互一致性，减少“越写越难改”的页面。

## When to Use

- 新增或修改页面、页面级流程、交互流
- 评估是否拆文件、拆组件、拆 hooks
- 页面状态开始散落，改动开始互相牵连
- 同类区域出现不同交互规则
- 需要判断该直接做、复用现有实现，还是先问人

**不要用于**

- 纯后端接口、状态机、核心业务规则设计
- 纯信息架构审查且尚未进入实现

## The Iron Law

用户可见的交互契约要稳定；展示、状态、协议、路由四类变化原因不要塞进同一个实现单元。

## Quick Reference

- 新页面、新流程、交互流、视觉方案、页面内 AI 协作层：先问人
- 开发者先作为第一体验用户走一遍，再判断实现是否顺手
- 同类对象行为不一致：先停手，检查是不是结构问题
- 信息架构、层级、入口、导航问题：**REQUIRED COMPANION SKILL:** Use `frontend-logic-design`
- 单点使用且变化原因单一：先别抽象
- 先复用现有组件和成熟依赖，再考虑新封装

## Implementation

- Ask-first gate: `references/communication-gate.md`
- Before/during/after review: `references/review-checklist.md`
- Anti-decay patterns: `references/anti-patterns.md`
- Pressure scenarios: `references/examples.md`

## Common Mistakes

- 为了“统一”过早抽组件或 hooks
- 页面根组件堆满状态、请求和弹窗逻辑
- 把协议拼装、数据转换、渲染混写
- 新需求顺手造出新的交互语法
- 把真正的信息架构问题误当成样式问题
