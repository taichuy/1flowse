# ai必读
1.所有任务开始前需要先阅读相关记忆，并且与用户沟通完决策性沟通时候应该主动维护记忆内容，对应记忆请先阅读：`.memory/AGENTS.md`
2.回复前应该先阅读用户偏好：`.memory/user-memory.md`
# 本项目相关skill在
.agents/skills
如果没有注册，请自行更新到对应约定目录
# 质量控制
1.质量控制与验证入口以各级 `AGENTS.md` 为准，`README.md` 不再作为规范主承载。
2.仓库级质量门禁入口固定为 `node scripts/node/test-scripts.js [filter]`、`node scripts/node/test-contracts.js`、`node scripts/node/test-frontend.js [fast|full]`、`node scripts/node/test-backend.js`、`node scripts/node/verify-repo.js`、`node scripts/node/verify-coverage.js [frontend|backend|all]`、`node scripts/node/verify-ci.js`、`node scripts/node/runtime-gate.js <page-debug args>`。
3.`node scripts/node/verify-repo.js` 是仓库级 full gate，固定串联 `scripts/node` 测试、contract gate、前端 full gate 和后端 `verify-backend`。
4.`node scripts/node/verify-ci.js` 是 CI 总入口，固定串联 `verify-repo` 与 `verify-coverage all`。
5.前端质量规则、样式边界和页面验证看 `web/AGENTS.md`。
6.后端分层规则、测试要求和验证入口看 `api/AGENTS.md`。
7.warning 与 coverage 产物统一落到 `tmp/test-governance/`。
# 文件管理约定
1.理论上来说单个代码文件不应该超过1500行
2.当前一个目录下不文件不应该超过15个，超过后应该收纳整理对应子目录
3.测试文件统一放到对应子目录下的_tests
4.如果对应子目录下有AGENTS.md，需要先介绍阅读再做处理
5.所有AGENTS.md，目标是提供短、硬、稳定的本地执行规则，尽可能精准，清晰，简短，最多不得超过200行。
