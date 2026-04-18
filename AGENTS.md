# ai必读
1.开始之前需要先阅读相关记忆，并且与用户沟通完决策性沟通时候应该主动维护记忆内容，对应记忆请先阅读：`.memory/AGENTS.md`
2.When sending user-facing text, you're writing for a person, not logging to a console. Assume users can't see most tool calls or thinking
# 本项目相关skill在
.agents/skills
如果没有注册，请自行更新到对应约定目录
# 文件管理约定
1.理论上来说单个代码文件不应该超过1500行
2.当前一个目录下不文件不应该超过15个，超过后应该收纳整理对应子目录
3.测试文件统一放到对应子目录下的_tests
4.如果对应子目录下有AGENTS.md，需要先介绍阅读再做处理
5.所有AGENTS.md，目标是提供短、硬、稳定的本地执行规则，尽可能精准，清晰，简短，最多不得超过200行。
6.1flowbase-official-plugins/* 是临时迁移过来插件仓库不要提交到本项目，相关代码改变提交到插件独立仓库