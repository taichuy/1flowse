---
name: frontend-development
description: Use when building or changing 1flowbase frontend/UI pages, page requirements, workspace flows, node development, schema UI, interactions, visual structure, or component boundaries, or when UI requests are vague, image-led, or need requirement refinement before implementation
---

# Frontend Development

## Overview

1flowbase 前端不是自由拼页，而是基于单一规则源的产品系统：`Ant Design` 壳层 + 薄 `Editor UI` + 固定工作区语法。本 Skill 用来在实现时守住页面边界、L1 详情模型、状态语义和组件职责，减少“写着写着变成另一套产品”的漂移。

## When to Use

- 新增或修改 `overview / orchestration / api / logs / monitoring` 页面
- 改动壳层列表、抽屉、编排画布、Inspector、节点组件
- 新增节点类型、调整节点详情、节点卡片、节点运行态或节点定义目录结构
- 改动 `schema ui` 合同、runtime、renderer registry、overlay shell 或节点 schema adapter
- 调整页面级流程、交互流、视觉方案
- 评估是否拆文件、拆组件、拆 hooks
- 页面状态开始散落，或同一文件同时承载展示、状态、协议、路由变化
- 同类对象出现不同点击结果、不同状态表达或不同移动端降级
- 用户需求模糊，只给目标词、截图、参考图或外部样本，需要先把页面需求讲清楚
- 用户提出页面开发、页面改版、模块级 UI 开发需求，需要先整理需求并把细化结果显式回复给用户
- 需要判断该直接做、复用现有实现，还是先问人

**不要用于**

- 纯后端接口、状态机、核心业务规则设计
- 纯信息架构审查且尚未进入实现

## The Iron Law

在 1flowbase 中，先守 `DESIGN.md` 的任务域边界、L1 模型和状态语义，再决定组件拆分和视觉抛光。

## General Workflow

1. 先回到 `DESIGN.md` 判断任务域边界、L1 模型、状态语义和现有页面 recipe。
2. 如果属于页面 / UI 开发需求，先输出面向用户的需求整理；至少覆盖页面目标、主要对象、关键动作、页面交互、关键状态和视觉约束。
3. 用 `references/communication-gate.md` 判断是默认直接实现，还是先集中提阻塞性产品分歧。
4. 再落实现：先定主路径、反馈位置和模块协作，再拆组件、落结构、补样式。
5. 结束前按 `references/review-checklist.md` 做复查；涉及样式边界、浏览器运行态或共享 slot 时，走项目既有验证链路。

## Quick Reference

### Purpose

- 把前端请求翻译成符合 1flowbase 边界、状态语义和交互语法的实现，而不是自由拼页。

### Requirements

- 单一事实源固定为 `./DESIGN.md`。
- Shell Layer 优先复用 `Ant Design`；Editor UI 只做薄封装，不另起一套视觉语言。
- 页面 / UI 开发需求默认先整理需求并显式回复给用户；只有纯局部样式修补、像素级对齐、文案替换或不改页面结构的 UI bugfix 才可跳过完整流程。
- 需求整理至少覆盖：页面目标、主要对象、关键动作、页面交互、关键状态、视觉约束。
- 页面先设计主路径、操作反馈和模块协作，再落卡片、区块和装饰。
- 目录和分层要守住：`app-shell / routes / features/* / shared/*`，以及 `api-client -> features/*/api -> shared/api`、`shared/schema-ui -> features/*/schema -> features/*/lib/node-definitions`。

### Scenario

- `WHEN` 请求属于页面 / UI 开发、页面改版或模块重构 `THEN` 先输出面向用户的需求整理，再默认继续实现。
- `WHEN` 请求只是纯局部样式修补或不改页面结构的 UI bugfix `THEN` 直接修改，不走完整需求草案。
- `WHEN` 问题本质是信息架构、层级、入口或导航逻辑 `THEN` 使用 `frontend-logic-design`。
- `WHEN` 请求带截图、参考图或外部样本 `THEN` 只借结构、层级和节奏，视觉语言与状态语义回到 `DESIGN.md`。
- `WHEN` 改动共享样式、导航、菜单、壳层或第三方 slot `THEN` 运行 `node scripts/node/check-style-boundary.js ...`，必要时同步维护 `web/app/src/style-boundary/scenario-manifest.json`。
- `WHEN` 需要浏览器级验收、截图或运行态证据 `THEN` 优先复用项目已有 `Playwright / page-debug / style-boundary` 链路。
- `WHEN` 处理节点开发或 `schema ui` `THEN` 保持 `node-definitions -> schema fragments/registry -> renderer -> consumer` 这条拆分链路。

## Implementation

- Single source of truth: `DESIGN.md`
- Visual baseline and layer rules: `references/visual-baseline.md`
- Workspace recipes and interaction rules: `references/workspace-rules.md`
- Directory, API, and utility placement rules: `references/placement-rules.md`
- Node development and schema UI changes must preserve the split between `node-definitions`, `schema registry/adapter`, and renderer consumers
- Ask-first gate: `references/communication-gate.md`
- Requirement refinement workflow for UI/page requests, vague briefs, or image-led requests: `references/requirement-refinement.md`
- Requirement extraction framework: `references/extraction-framework.md`
- Customer-facing requirement brief template: `references/skill-template.md`
- Browser verification defaults: `references/browser-verification.md`
- Before/during/after review: `references/review-checklist.md`
- Anti-decay patterns: `references/anti-patterns.md`
- Pressure scenarios and examples: `examples/`

## Common Mistakes

- 为了“统一”过早抽组件或 hooks
- 把外部灵感稿直接当成当前项目规范
- 页面根组件堆满状态、请求、弹窗和协议转换逻辑
- 把协议拼装、数据转换、渲染混写
- 把节点定义、schema contract、renderer registry、consumer UI 再次堆回同一文件
- 把第三方组件内部 DOM 当成自家 DOM 递归覆盖，或为了修单点视觉问题裸写 `.ant-*`
- 只改导航文案，不同步 `route id / path / selected state` 真值层
- 在 Shell / Canvas 间混用 `Drawer` 和 `Inspector`
- 把状态色拿去表达类型、装饰或品牌
- 把真正的信息架构问题误当成样式问题
- 把需求整理只留在自己脑中，或者只罗列模块名，没有显式整理页面目标、交互路径、关键状态和模块关系
- 需求收敛阶段直接堆卡片和区块，没有先定义主路径、交互反馈和模块协作
