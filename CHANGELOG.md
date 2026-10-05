# Changelog

本项目的所有重要变更都会记录在此文件。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-10-05

### 新增

- **自动触发**：监听 DSH `agent/pre-step` 事件，命中 Patrol / Flutter E2E /
  UI 测试关键词时，把对应技能的正文注入当轮对话。
- **三技能路由**（`trigger.js` 的 `ROUTES`，首个匹配的生效）：
  - `patrol-setup` —— 安装、配置、接入、初始化，或「项目里还没有 Patrol」；
  - `patrol-write-test` —— 任何裸 `patrol` 提及、`E2E`、`end-to-end`、
    `integration test`、`UI test`、`flutter drive`、
    `端到端`、`集成测试`、`UI 测试`；
  - `patrol-test-architecture` —— 测试架构、模块化、`patrol_test/modules`。
- **路由优先级**：「set up Patrol 并写第一个测试」这类请求走 `patrol-setup`，
  因为安装优先于编写。
- **中英双语触发**：含粘贴仓库 URL 的中文句式
  （如「安装这个 UI 测试插件 …/patrol」）。
- **来源隔离**：仅扫描 `source.kind === "user"` 的文本，模型输出、工具结果、
  注入上下文、子代理文本均无法伪造触发。
- **每轮去重**：`alreadyInjected()` 守卫确保同一轮内只注入一次，
  三个技能任一已注入即视为已覆盖。
- **失败安全**：技能注册表异常或技能缺失时静默放行并记录告警，不阻断对话。
- **零成本放行**：未命中时不调用技能注册表。
- **策略遵循**：尊重技能自身的 `user-invocable` 设置。
- **中断安全**：轮次信号已取消时不注入。
- **降级渲染**：无法解析 DSH 宿主包时回退到本地渲染器，输出与官方
  `renderSkillContent` **逐字节一致**（含正文首尾空白的裁剪行为）。
- **插件元数据**：`icon.svg` 图标与 `locale/{zh,en}.json` 标题描述，
  可在「设置 → 插件」中查看与启停。
- **测试**：125 条断言（触发路由 66 + 插件接线 40 + 真实技能 19），
  纯 Node 即可运行。

### 说明

- 复用 DSH 内置 `/技能名` 手势的同一代码路径
  （`skill-invocation` 消息源），因此注入内容会持久化进会话日志，
  可回放、可 fork，并由官方渲染器输出。
- `skills/` 目录内置 Patrol 官方的 3 个 Agent Skill
  （Apache-2.0，© LeanCode），安装开箱即用；详见
  [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
- 本插件只负责**注入规范**，不会修改目标项目的 `pubspec.yaml`；
  原生接线由模型按 `patrol-setup` 技能与官方文档执行。

[1.0.0]: https://github.com/bsfcxz/dsh-patrol/releases/tag/v1.0.0
