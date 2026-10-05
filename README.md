# dsh-patrol

> 让 DeepSeek Harness 在你提到 **Patrol / Flutter E2E / UI 测试** 时，**自动加载**官方 Patrol Agent Skills。

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-blue)](https://github.com/leancodepl/patrol)
[![Patrol](https://img.shields.io/badge/patrol-4.10.0-0EA5E9)](https://pub.dev/packages/patrol)

简体中文 · [English](#english)

---

## 📖 简介

[Patrol](https://github.com/leancodepl/patrol) 是 LeanCode 出品的 **Flutter-first UI 测试框架**（pub.dev 上的 `patrol`，当前 4.10.0）。它比 `flutter_test` / `integration_test` 强的地方在于：**可以操作原生控件**——系统权限弹窗、通知、以及被测 App 之外的其他应用。

Patrol 官方仓库自带 **3 个 Agent Skill**（`skills/` 目录），本插件把它们接进了 DSH。

### 它解决什么问题

DSH 的 `skill` 工具已经能让模型加载技能，但**前提是模型自己决定去调用它**。实际使用中：

- 你说「给登录页写个 UI 测试」，模型可能直接开始写 `flutter_test` 的代码，**完全忘记** Patrol 的规则；
- 你必须手动输入 `/patrol-write-test` 才能强制加载；
- Patrol 的官方规范没人加载，就等于不存在。

装上这个插件后，**只要你的话里出现 Patrol / E2E / UI 测试相关词汇，对应的技能正文会自动注入当轮对话**。

```
你：用 Patrol 给登录流程写一个 E2E 测试
         ↓
插件：命中 "patrol" + "E2E" → 路由到 patrol-write-test → 自动加载
         ↓
模型：拿到 Patrol 官方的编写规则后再开始写代码 ✅
```

### 三个技能与路由

| 技能 | 何时触发 | 内容 |
|---|---|---|
| **`patrol-setup`** | 「安装 / 配置 / 接入 / 初始化 Patrol」「项目里还没有 Patrol」 | pubspec 的 `patrol:` 块、原生 Android 接线、第一个跑通的测试、`.patrol.env` / `test_bundle.dart` 的 gitignore |
| **`patrol-write-test`** | 任何 **裸 `patrol` 提及**、`E2E` / `end-to-end` / `integration test` / `UI test` / `flutter drive` / 端到端 / 集成测试 / UI 测试 | 动作顺序、Patrol API 与断言规则、原生弹窗处理、test key 约定 |
| **`patrol-test-architecture`** | 「Patrol 测试架构 / 模块化 / `patrol_test/modules`」 | LeanCode 推荐的 Modules / System / ApiClients 分层与共享 keys |

**路由顺序即策略**：先匹配到的赢。「set up Patrol（外加写测试）」会走 `patrol-setup`，因为安装优先。

> 未命中 → 完全不干预，原样放行。`run the unit tests`、`fix the CSS layout`、`add a database index` 都不会触发。

### 工作原理

插件监听 DSH 的 `agent/pre-step` 事件，扫描本轮**用户直接输入**的文本：

1. 命中路由词 → 用 `ctx.skills.get()` 加载对应技能正文；
2. 把正文以 `skill-invocation` 消息拼进当轮，模型立即看到完整规范；
3. 未命中 → 原样放行，连技能注册表都不查。

它复用了 **DSH 自带 `/技能名` 手势的同一条代码路径**，所以注入的内容会：

- ✅ 持久化进会话日志（session log），可回放、可 fork；
- ✅ 由 DSH 官方渲染器输出，格式与内置手势完全一致；
- ✅ 遵循技能自身的 `user-invocable` 策略。

### 特性

| 特性 | 说明 |
|---|---|
| 🎯 **三技能路由** | 按意图自动选安装 / 编写 / 架构，而不是一把梭 |
| 🔒 **来源隔离** | 只扫描 `source.kind === 'user'`，模型输出 / 工具结果 / 子代理文本**无法伪造**触发 |
| 🔁 **每轮仅一次** | 同一轮内多次 step 不重复注入，不浪费 token |
| 🛡️ **失败安全** | 技能缺失或注册表异常时静默放行并告警，不阻断对话 |
| ⚡ **零成本放行** | 未命中时不调用技能注册表 |
| ⚙️ **可开关** | 在「设置 → 插件」中一键启停 |

---

## 📦 安装

### 前置条件

1. **DeepSeek Harness** 已安装；
2. **三个 Patrol 技能**已安装到 `~/.dsh/skills/`（✅ 本仓库已内置，见下方步骤）；
3. 当前 Profile 的 `skill-filesystem` 提供者处于启用状态。

<details>
<summary><b>把内置技能复制到 DSH 技能目录</b></summary>

```powershell
# 假设插件克隆到 ~/.dsh/plugins/dsh-patrol
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.dsh\skills" | Out-Null
Copy-Item -Recurse -Force "$env:USERPROFILE\.dsh\plugins\dsh-patrol\skills\*" "$env:USERPROFILE\.dsh\skills\"
```

确认技能可被加载：

```powershell
Get-ChildItem "$env:USERPROFILE\.dsh\skills\patrol-*\SKILL.md"
```

</details>

### 方式一：让 AI 帮你装（推荐）

> 请把 https://github.com/leancodepl/patrol 的 `skills/` 目录装到
> `~/.dsh/skills/`，然后用 `plugin_manager` 的 `install_bundle` 安装
> `~/.dsh/plugins/dsh-patrol`。

### 方式二：手动安装

```bash
# 1. 克隆到插件目录
git clone https://github.com/leancodepl/patrol.git ~/.dsh/plugins/dsh-patrol-src
cp -r ~/.dsh/plugins/dsh-patrol-src/skills ~/.dsh/plugins/dsh-patrol/

# 2. 复制技能 + 安装 bundle
mkdir -p ~/.dsh/skills && cp -r ~/.dsh/plugins/dsh-patrol/skills/* ~/.dsh/skills/
#    然后对你的 DSH 说：
#    「用 plugin_manager install_bundle 安装 ~/.dsh/plugins/dsh-patrol」
```

安装成功后应看到 `application: "applied"`。

> ⚠️ **修改插件源码后需要重启 DSH。**
> DSH 会缓存已加载的模块：替换已安装的包必须重启才能加载新的 JavaScript 模块代际。

---

## 🚀 使用方法

### 基础用法：直接说人话

装好后**无需任何额外操作**，正常说话即可触发：

```
给登录页写一个 Patrol 测试
set up Patrol in this project and get a first test passing
用 LeanCode 的模块化架构组织 Patrol 测试
our E2E tests are flaky, help me debug
```

### 触发词一览

| 类别 | 触发示例 |
|---|---|
| **Patrol 直接提及** | `write a patrol test`、`patrol_test/login_test.dart` |
| **安装配置** | `set up Patrol`、`install patrol`、`add Patrol to my app`、`Patrol is not installed`、`安装 patrol`、`配置 patrol` |
| **测试术语** | `E2E`、`end-to-end test`、`integration test`、`UI test`、`ui testing`、`flutter drive` |
| **架构** | `patrol test architecture`、`modular patrol tests`、`patrol_test/modules` |
| **中文** | `端到端测试`、`集成测试`、`UI 测试`、`界面测试`、`Patrol 测试架构` |

### 不会误触发的例子

| 输入 | 为什么不触发 |
|---|---|
| `run the unit tests` | 单元测试，不是 E2E |
| `the backend tests are slow` | 后端测试 |
| `fix the CSS layout` | Web 布局，未提及 UI 测试 |
| `add a database index` | 数据库 |
| `read the guide` | 无测试意图 |
| `翻译这段文字成英文` | 无测试意图 |

### 关闭自动触发

**设置 → 插件 → Patrol 自动技能 → 关闭**

关闭后仅停用**自动注入**；`skill` 工具与 `/patrol-write-test` 手势仍然可用。

---

## 🔧 配合 Patrol 本体使用

### 项目接线

插件只负责**加载规范**，不会替你改 `pubspec.yaml`。触发 `patrol-setup` 后，模型会按官方文档接线：

```yaml
dev_dependencies:
  patrol: ^4.10.0

patrol:
  app_name: My App
  test_directory: patrol_test
```

Windows / 本机注意：`patrol` CLI 需要单独安装：

```bash
dart pub global activate patrol_cli
patrol test
```

### Patrol MCP（可选）

Patrol 官方提供 **Patrol MCP**（`patrol_mcp`，当前 0.2.1），让 AI 直接**运行测试、截图、读取原生 UI 树、驱动交互会话**。技能正文里已写明用法：

| MCP 工具 | 用途 |
|---|---|
| `patrol-run` | 运行指定测试文件并等待完成 |
| `patrol-screenshot` | 截图（android / ios）排查失败 |
| `patrol-native-tree` | 获取当前原生 UI 树 |
| `patrol-status` / `patrol-quit` | 查看状态 / 优雅退出 |

安装说明见 <https://pub.dev/packages/patrol_mcp>。

---

## 🧪 测试

项目自带 **125 条断言**，覆盖触发路由、插件接线与**真实技能文件**：

```bash
cd ~/.dsh/plugins/dsh-patrol

node tests/test-trigger.mjs   # 66 条：路由、反向不触发、来源隔离、渲染器
node tests/test-plugin.mjs    # 40 条：pre-step 接线与失败路径
node tests/test-live.mjs      # 19 条：真实安装的 SKILL.md 与宿主渲染器逐字节比对
```

| 测试文件 | 断言数 | 覆盖内容 |
|---|---:|---|
| [`tests/test-trigger.mjs`](tests/test-trigger.mjs) | 66 | 三技能路由优先级、正向触发、**反向不触发**、非用户来源隔离、去重守卫、渲染器 |
| [`tests/test-plugin.mjs`](tests/test-plugin.mjs) | 40 | 消息拼接、路由查找、原消息保序、`reject` 透传、每轮仅一次、查询异常降级、`user-invocable` 策略、中断处理、其它字段保留 |
| [`tests/test-live.mjs`](tests/test-live.mjs) | 19 | 读取**真实安装**的技能文件、断言注入正文与磁盘一致、降级渲染器与宿主渲染器**逐字节**一致 |

前两条测试**不依赖 DSH 运行时**，用纯 Node 即可跑（`trigger.js` 刻意不引入任何 Harness 包）。

`test-live.mjs` 需要先把 `skills/` 复制到 `~/.dsh/skills/`（见安装步骤）。

> **关于逐字节比对**：`renderSkillContentFallback` 只在宿主包无法解析时兜底，但它的输出与
> DSH 官方 `renderSkillContent` **完全一致**——这一点是对照会话日志里宿主真实渲染出的
> `<skill_content>` 块验证过的（含正文首尾空白的裁剪行为）。

---

## 📁 项目结构

```
dsh-patrol/
├── index.js              # 宿主插件：agent/pre-step 监听器 + 路由
├── trigger.js            # 触发词表、路由逻辑与渲染器（零 DSH 依赖，可单测）
├── cordis.patch.yml      # 把插件行注册进 Profile
├── package.json          # bundle 清单（dsh.bundle.patch / icon / exports）
├── icon.svg              # 插件列表里显示的图标
├── locale/
│   ├── zh.json           # 中文标题与描述
│   └── en.json           # 英文标题与描述
├── skills/               # 📦 内置的 3 个官方 Patrol 技能（Apache-2.0，见声明）
│   ├── patrol-setup/
│   ├── patrol-write-test/
│   └── patrol-test-architecture/
├── tests/
│   ├── test-trigger.mjs
│   ├── test-plugin.mjs
│   └── test-live.mjs
├── THIRD-PARTY-NOTICES.md
├── LICENSE
└── README.md
```

### 核心文件说明

| 文件 | 作用 |
|---|---|
| [`index.js`](index.js) | 监听 `agent/pre-step`，命中后调用 `ctx.skills.get()` 并把技能正文注入当轮 |
| [`trigger.js`](trigger.js) | 路由表 `ROUTES`、`matchTrigger()`、`alreadyInjected()`、降级渲染器 |
| [`cordis.patch.yml`](cordis.patch.yml) | 通过 `insert` 注册 `patrol-auto` 插件行 |

---

## ❓ 常见问题

<details>
<summary><b>装了但没反应？</b></summary>

按顺序排查：

1. **技能本体装了吗？**
   ```powershell
   Get-ChildItem "$env:USERPROFILE\.dsh\skills\patrol-*\SKILL.md"
   ```
2. **`skill-filesystem` 提供者启用了吗？** 在「设置 → 插件」中确认它是开启状态（它是技能能被发现的**前提**）。
3. **插件是 active 吗？** 应显示 `fiberPhase: "active"`。
4. **改过代码？** 需要**重启 DSH**——模块有缓存。
</details>

<details>
<summary><b>为什么不在插件里直接改 my pubspec？</b></summary>

插件只做**规范注入**。真正的接线（`patrol:` 块、原生 Android、`MainActivityTest.java`）由模型按 `patrol-setup` 技能与官方文档执行，这样才能适配你的项目结构与 flavor。

Patrol 原生接线对**版本与路径**敏感，让模型照着官方文档做，比硬编码模板更可靠。
</details>

<details>
<summary><b>会不会很费 token？</b></summary>

只在**命中触发词的那一轮**注入一次，且只注入**路由到的那一个**技能：

| 技能 | 正文大小 |
|---|---:|
| `patrol-setup` | ~3 KB |
| `patrol-write-test` | ~5 KB |
| `patrol-test-architecture` | ~14 KB |

普通编码对话不含触发词，完全不受影响。嫌贵可在设置里关掉。
</details>

<details>
<summary><b>为什么不直接做成 skill，而要做插件？</b></summary>

skills 是**被动**的——需要模型主动调用。插件能监听事件、在模型决策**之前**介入，这正是「自动触发」所必需的。两者互补：技能提供知识，插件负责在正确的时机把它递过去。
</details>

---

## 🙏 致谢

- 技能本体（`skills/` 目录下的 3 个技能包）来自
  [leancodepl/patrol](https://github.com/leancodepl/patrol)，
  作者 LeanCode，**Apache-2.0** 许可证。本仓库按其许可证再分发，
  详见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)；
- 插件机制参考 DSH 自带的 `cordis-plugin-development` 技能与 `tool-skill` 实现。

## 📄 许可证

- **本插件代码**（`index.js`、`trigger.js` 等）：[MIT](LICENSE)
- **`skills/` 目录**：第三方内容，Apache-2.0，版权归 LeanCode，
  条款见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)

---

<a id="english"></a>

## English

A **DeepSeek Harness (DSH) plugin** that automatically loads the
[official Patrol agent skills](https://github.com/leancodepl/patrol/tree/master/skills)
whenever your request mentions Patrol, Flutter E2E, or UI testing.

[Patrol](https://patrol.leancode.co) is LeanCode's Flutter-first UI testing
framework — like `flutter_test`, but it can also drive **native** controls:
permission dialogs, notifications, and other apps.

**The problem.** DSH's `skill` tool works, but only if the model decides to call
it. Ask for "a UI test for the login page" and it may reach for `flutter_test`
and never load Patrol's authoring rules.

**The fix.** This plugin listens on `agent/pre-step`, scans the turn's **direct
user input**, routes to the matching skill, and splices its body into that same
step — no manual `/patrol-write-test` gesture.

| Skill | Routes on |
|---|---|
| `patrol-setup` | install / configure / "no Patrol yet" |
| `patrol-write-test` | any bare `patrol`, `E2E`, `integration test`, `UI test` |
| `patrol-test-architecture` | modular architecture, `patrol_test/modules` |

Routing order is the policy: the first matching row wins, so "set up Patrol and
write a test" routes to setup.

### Install

The 3 skills are **bundled in this repo** (`skills/`), so installation is
self-contained:

```bash
# 1. Copy the bundled skills into the root DSH scans
mkdir -p ~/.dsh/skills && cp -r skills/* ~/.dsh/skills/

# 2. Ask your DSH to install the bundle:
#    "Use plugin_manager install_bundle on ~/.dsh/plugins/dsh-patrol"
```

### Usage

Just talk normally — no command needed:

```
write a Patrol test for the login flow
set up Patrol in this project
structure our Patrol tests with the modular architecture
our E2E tests are flaky
```

`run the unit tests`, `fix the CSS layout`, and `add a database index` never
trigger it. Only `source.kind === "user"` text is scanned, so model output, tool
results, and subagent text cannot forge a match.

### Toggle

**Settings → Plugins → Patrol Auto Skills**. Disabling stops only the automatic
injection; the `skill` tool and `/patrol-write-test` still work.

### Tests

```bash
node tests/test-trigger.mjs   # 66 assertions
node tests/test-plugin.mjs    # 40 assertions
node tests/test-live.mjs      # 19 assertions
```

No DSH runtime required — `trigger.js` deliberately imports nothing from the
Harness.

### License

- **Plugin code** (`index.js`, `trigger.js`, …): [MIT](LICENSE)
- **`skills/` directory**: third-party content under Apache-2.0, © LeanCode.
  See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
