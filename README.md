# gs-agent

`gs-agent` 是一个用 GoScript (`.gs`) 编写的真实 AI agent 项目，结构参考 `E:\codes\github\pi` 的核心分层：provider、agent loop、tool registry、tools、session。

## 结构

- `main.gs`：应用入口；默认运行一次 agent，传入 `--tui` 时进入交互式界面。
- `agent.toml`：默认运行配置，使用 Anthropic 兼容 provider。
- `agent.local.toml`：本地密钥配置，已被 `.gitignore` 忽略。
- `workspace/task.txt`：当前任务输入。
- `src/agent/core`：agent loop 和组装入口。
- `src/agent/llm`：Anthropic 兼容 provider，以及显式测试用 fake provider。
- `src/agent/tools`：文件、目录、grep、bash、workspace task 工具。
- `.agent/tools/*`：运行期动态工具目录，工具脚本由 `@std/runtime.runTool` 在独立 VM 中执行。
- `.agent/skills/*/SKILL.md`：运行期技能目录，启动时会发现并注入到模型 system prompt。
- `src/agent/session`：JSONL session 事件记录。
- `src/tui`：终端交互界面，包含按键解析、ANSI 输出、布局和渲染。
- `tui.gs`：TUI 直接脚本入口，主要用于开发调试。
- `docs/plans/2026-06-04-tui-design.md`：TUI 交互界面设计。
- `docs/plans/2026-06-04-gs-tui-development-plan.md`：GS TUI 开发计划。
- `docs/language-side-suggestions.md`：开发过程中沉淀的 GoScript 语言侧建议。
- `stream-test.gs`：真实 streaming endpoint smoke test。

## 运行

先准备本地配置：

```powershell
Copy-Item .\agent.local.example.toml .\agent.local.toml
```

填入 `agent.local.toml` 中的 `apiKey`。当前 DeepSeek Anthropic 兼容配置形如：

```toml
[agent]
provider = "anthropic"
taskFile = "workspace/task.txt"
maxTurns = 10
includeCodingTools = true
includeSubagents = true
includeSkills = true
skillDir = ".agent/skills"
skills = ["*"]
tools = ["read_file", "list_dir", "grep", "todo", "create_skill", "run_subagent", "run_skill"]

[llm.anthropic]
apiKey = "sk-..."
baseUrl = "https://api.deepseek.com/anthropic"
model = "deepseek-v4-flash"
maxTokens = 4096
contextTokenThreshold = 24000
timeoutMs = 60000
thinking = "disabled"
```

`baseUrl` 可填写服务根路径、`/v1` 路径，或完整 `/v1/messages` endpoint。
`contextTokenThreshold` 是上下文重建阈值：估算消息 token 数未达到阈值时保留完整会话；达到阈值后保留最近几轮原文，将更早内容压缩为摘要，并通过 session archive 工具按需查询旧原文。

运行 agent：

```powershell
E:\codes\gts\dist\gs.exe --timeout 60s run
```

运行后会在 `.agent/sessions/<session-id>/` 下生成独立的 `session.jsonl` 和 `answer.md`，并把可搜索对话消息写入共享 SQLite 数据库 `.agent/session-archive.db`，不会覆盖旧会话。
最近一次会话位置会记录到 `.agent/current-session.json`。
运行日志会写入 `.agent/logs/gs-agent.log`，最近一次启动/运行的日志会写入 `.agent/logs/latest.log`。

运行 TUI：

```powershell
E:\codes\gts\dist\gs.exe --timeout 0 run --tui
```

运行 IM 机器人桥接：

```powershell
E:\codes\gts\dist\gs.exe --timeout 0 run --im
```

`--im` 会启动 `@plugin/im-bot`，监听插件入站消息事件，并通过 agent 内部事件总线转成 `agent_input`。agent 会按多轮对话处理该消息，默认把回答通过同一 IM 适配器发回。

打包后的程序直接使用：

```powershell
.\dist\gs-agent.exe --tui
```

打包后 `agent.toml` 和 `agent.local.example.toml` 会复制到 `gs-agent.exe` 所在目录；程序默认从自身所在目录读取配置，而不是从启动命令的当前目录读取。

打包：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1
```

跳过 smoke test：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1 -SkipSmoke
```

指定解释器或输出路径：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package.ps1 -GsExe E:\codes\gts\dist\gs.exe -Output dist\gs-agent.exe
```

TUI 快捷键：

- `Ctrl+R`：保存当前任务并运行 agent。
- `Ctrl+S`：保存任务。
- `Ctrl+O`：加载最近 session。
- `Tab`：切换任务区、时间线、详情区焦点。
- `Up` / `Down`：移动光标或时间线选择。
- `PageUp` / `PageDown`：滚动时间线或详情区。
- 鼠标点击：切换任务区、时间线、详情区焦点。
- 鼠标滚轮：滚动当前指向的任务区、时间线或详情区。
- `Esc` / `Ctrl+C` / `Ctrl+Q`：退出并恢复终端状态；任务未保存时需要再次确认。

Git Bash/mintty 下默认只启用滚轮鼠标事件，不启用拖拽 mouse tracking，避免拦截终端原生文本选择。需要选择内容时可以直接拖拽；如果终端仍拦截选择，按住 `Shift` 再拖拽通常会强制使用终端选择模式。

TUI 启动时会创建新的独立会话；使用 `Ctrl+O` 可加载 `.agent/current-session.json` 指向的最近会话。运行结束后最终答案会作为 `answer` 事件出现在时间线里。
TUI 状态栏会显示 `log=.agent/logs/latest.log`，排查异常时优先查看这个文件；完整历史保留在 `.agent/logs/gs-agent.log`。

## TUI 测试程序

## TUI 框架

`src/tui/framework.gs` 是可复用入口，聚合了：

- `runTuiApp`：项目级 TUI facade，底层使用语言侧 `@std/tui` 托管 raw input、resize、tick、diff 渲染和退出清理，并把事件适配给现有 agent 界面。
- ANSI/Unicode/颜色工具：`line`、`chars`、`charWidth`、`visibleWidth`、`truncateToWidth`、`color`、`styleText`、`setColorEnabled` 等。
- widgets：`banner`、`border`、`wrapText`、`joinColumns`、`scrollTitle` 等。
- components：`Text`、`Input`、`Box`、`Container`、`Spacer`、`Markdown`、`Loading`，用于快速组合 Claude Code 风格的安静、紧凑型终端界面。
- loading 组件：`loadingFrame`、`loadingText`、`compactLoading`。

最小示例在 `programs/framework-demo/main.gs`，可以作为新 TUI 程序模板：

```powershell
E:\codes\gts\dist\gs.exe --timeout 0 programs\framework-demo\main.gs
```

框架级 smoke test：

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s framework-smoke-test.gs
```

`programs/gs-tui-test` 是一个独立的终端测试程序，不调用模型，用来验证 GoScript 的 raw input、ANSI 渲染、resize、timer、Bracketed Paste 和可执行文件打包。
程序运行时会进入终端备用屏幕，顶部显示响应式 ASCII banner，并包含 loading 动画组件。刷新会发生在当前窗口内；退出后恢复原 PowerShell 屏幕，滚动历史里不会堆积每一帧。渲染使用屏幕缓冲 diff，只重写变化行，避免整屏闪烁。

源码自检：

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s programs\gs-tui-test\main.gs --self-test
```

构建独立可执行文件：

```powershell
E:\codes\gts\dist\gs.exe --timeout 60s dist programs\gs-tui-test dist\gs-tui-test.exe
```

运行打包后的自检：

```powershell
.\dist\gs-tui-test.exe -- --self-test
```

进入交互测试：

```powershell
.\dist\gs-tui-test.exe
```

交互测试中可输入文本、方向键、Tab、粘贴、多次调整窗口大小；`Ctrl+L` 清日志，`Ctrl+Q`、`Ctrl+C` 或 `Esc` 退出。

默认启用只读代码工具和 todo 任务工具：

```toml
tools = ["read_file", "list_dir", "grep", "todo", "create_skill", "run_subagent", "run_skill"]
```

启用 `todo` 后，模型可以用单个 `todo` 工具管理 `.agent/todos.json` 中的任务，支持 `add`、`list`、`get`、`update`、`delete` 和 `clear`。任务状态为 `open` 或 `done`，`list` 和 `clear` 可按 `status` 过滤。
启用 `create_skill` 后，模型可以创建标准 `.agent/skills/<name>/SKILL.md`，用于沉淀新的本地技能。创建或更新技能时应调用 `create_skill`，不要用 `write_file` 手写 `.agent/skills` 下的文件，也不要为技能创建 `skill.toml` 或 `main.gs`。
`write_file` 和 `append_file` 会拒绝写入 `.agent/skills`，以防模型绕过 `create_skill` 写出错误目录结构。
启用 `run_subagent` 后，模型可以把聚焦任务委派给一个同步子 agent；子 agent 使用独立 session，默认继承父 agent 已启用的所有工具，但排除 `create_skill`、`run_subagent` 和 `run_skill`。
启用 `run_skill` 后，模型在命中技能索引时可以把技能名和任务交给同步子 agent；子 agent 的 system prompt 会包含对应 `SKILL.md` 全文，并返回最终结果。
`run_skill` 每次调用都会重新发现 `.agent/skills`，所以同一会话中刚用 `create_skill` 创建的技能可以立即运行，不需要重启 TUI 或开启新会话。

如需让 agent 写文件或执行 shell 命令，可显式加入：

```toml
tools = ["read_file", "list_dir", "grep", "write_file", "append_file", "bash", "todo", "create_skill", "run_subagent", "run_skill"]
```

## 动态工具

agent 会自动发现 `.agent/tools/*/tool.toml`，并把这些工具和内置工具一起暴露给模型。动态工具入口脚本需要导出 `exports.run(input)`，运行时由语言侧 `@std/runtime.runTool` 放到独立 VM 中执行。

目录示例：

```text
.agent/tools/echo_dynamic/
  tool.toml
  main.gs
```

`tool.toml`：

```toml
name = "echo_dynamic"
description = "Echo a message from a dynamic tool."
entry = "main.gs"

[[params]]
name = "message"
type = "string"
required = true
description = "Message to echo"
```

`main.gs`：

```javascript
exports.run = function(input) {
  return {
    ok: true,
    result: "dynamic:" + input.message,
  };
};
```

动态工具等同本地代码，第一版不做沙箱隔离，只应运行可信工具。

已内置的运行期动态工具示例：

- `web_fetch`：抓取 HTTP(S) 页面，返回状态码、响应头和文本内容。
- `web_search`：通过 DuckDuckGo HTML 搜索返回结果摘要，不需要 API key。

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s web-tools-smoke-test.gs
```

## IM 机器人事件总线

项目内置了一个中间事件总线，IM 插件事件不会直接调用 agent，而是先规范化为：

```javascript
{
  source: "im",
  platform: "onebot",
  adapter: "qq-local",
  sender: "user-id",
  chat: "group-or-chat-id",
  replyTo: "target-id",
  text: "用户消息原文"
}
```

`src/agent/im/bridge.gs` 默认监听 `message`、`message_create`、`im_message` 和 `inbound_message`。语言层 IM 插件发来的消息进入总线后，会触发 `agent_input`，再由 `runAgentIMBridge` 调用现有 `runAgentTurn`。

## 技能系统

agent 会自动发现 `.agent/skills/*/SKILL.md`。按照 Skills 规范，启动时只把技能的 `name`、`description` 和文件路径作为索引注入 system prompt；其中 `description` 是主要触发表面，需要同时写清楚技能做什么以及何时使用。当用户请求命中某个技能且 `run_skill` 可用时，模型会调用 `run_skill`，由同步子 agent 读取该技能的 `SKILL.md` 全文并按其中说明执行。若未启用 `run_skill`，模型仍可按索引路径渐进读取技能文件。

`SKILL.md` 顶部必须包含 YAML frontmatter，且 frontmatter 只使用 `name` 和 `description`。`name` 只能使用小写字母、数字和连字符，最长 64 个字符，且不能以连字符开头或结尾；`description` 必填，用来判断技能何时触发。技能正文只写触发后的执行说明和必要资源导航。

目录示例：

```text
.agent/skills/code-review/
  SKILL.md
```

`SKILL.md`：

```markdown
---
name: code-review
description: Review code changes for bugs, regressions, and missing tests. Use when the user asks for review, code review, risk analysis, or pre-merge inspection.
---

# Code Review

Use this skill when the user asks for a review.

- Lead with findings ordered by severity.
- Include file and line references.
- Keep summaries brief.
```

默认启用全部本地技能：

```toml
[agent]
includeSkills = true
skillDir = ".agent/skills"
skills = ["*"]
```

如果只想启用部分技能，可写：

```toml
skills = ["code-review", "docs"]
```

本地自检：

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s skill-system-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s create-skill-tool-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s skill-write-guard-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s run-skill-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s run-skill-refresh-smoke-test.gs
```

`run_skill` 工具参数：

```json
{
  "skill": "code-review",
  "task": "Review the current changes.",
  "maxTurns": 6,
  "tools": ["read_file", "list_dir", "grep"]
}
```

- `skill` 和 `task` 必填。
- `maxTurns` 可选，范围 1 到 12，默认 6。
- `tools` 可选；只能从父 agent 已启用的工具里选，且不会把 `create_skill`、`run_skill` 或 `run_subagent` 继续传给子 agent。未指定时默认继承父 agent 已启用的其他工具，包括动态工具。

## Subagent

`run_subagent` 是一个同步委派工具：父 agent 调用后，会创建新的 `.agent/sessions/<session-id>/`，用同一 provider 配置运行一个子 agent，并把子 agent 的最终回答、事件数和 session 路径作为工具结果返回。

工具参数：

```json
{
  "role": "explorer",
  "task": "Inspect src/agent/core and summarize the agent loop.",
  "maxTurns": 4,
  "tools": ["read_file", "list_dir", "grep"]
}
```

- `task` 必填。
- `role` 可选，用来给子 agent 一个聚焦身份。
- `maxTurns` 可选，范围 1 到 12，默认 4。
- `tools` 可选；只能从父 agent 已启用的工具里选，且不会把 `create_skill`、`run_subagent` 或 `run_skill` 继续传给子 agent。未指定时默认继承父 agent 已启用的其他工具，包括动态工具。
- 第一版是同步执行，不做后台并行调度；父 agent 会等待子 agent 完成。

配置开关：

```toml
[agent]
includeSubagents = true
tools = ["read_file", "list_dir", "grep", "todo", "run_subagent", "run_skill"]
```

本地自检：

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s subagent-smoke-test.gs
```

## 本地 smoke test

不调用真实模型，只验证 agent loop、工具调用和 JSONL session：

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s todo-tool-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s dynamic-tool-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s skill-system-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s create-skill-tool-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s skill-write-guard-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s child-tools-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s subagent-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s run-skill-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s run-skill-refresh-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s web-tools-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s markdown-stdlib-smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s provider-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s tui-smoke-test.gs
```

## 修改任务

编辑 `workspace/task.txt`，然后重新运行：

```powershell
E:\codes\gts\dist\gs.exe --timeout 60s run
```

## 流式测试

`stream-test.gs` 会直接调用 Anthropic 兼容 streaming endpoint，逐块打印 SSE 文本增量：

```powershell
E:\codes\gts\dist\gs.exe --timeout 60s stream-test.gs
```

## 构建解释器

如果需要从 GoScript 源码重新构建解释器：

```powershell
Push-Location E:\codes\gts
go build -o .\dist\gs.exe .\cmd\gs
Pop-Location
```
