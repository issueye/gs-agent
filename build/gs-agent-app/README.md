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
tools = ["read_file", "list_dir", "grep"]

[llm.anthropic]
apiKey = "sk-..."
baseUrl = "https://api.deepseek.com/anthropic"
model = "deepseek-v4-flash"
maxTokens = 1024
timeoutMs = 60000
thinking = "disabled"
```

`baseUrl` 可填写服务根路径、`/v1` 路径，或完整 `/v1/messages` endpoint。

运行 agent：

```powershell
E:\codes\gts\dist\gs.exe --timeout 60s run
```

运行后会生成 `.agent/session.jsonl`。
最终回答会同时保存到 `.agent/answer.md`。
运行日志会写入 `.agent/logs/gs-agent.log`，最近一次启动/运行的日志会写入 `.agent/logs/latest.log`。

运行 TUI：

```powershell
E:\codes\gts\dist\gs.exe --timeout 0 run --tui
```

打包后的程序直接使用：

```powershell
.\dist\gs-agent.exe --tui
```

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

TUI 启动时会自动加载最近的 `.agent/session.jsonl` 和 `.agent/answer.md`。运行结束后最终答案会作为 `answer` 事件出现在时间线里。
TUI 状态栏会显示 `log=.agent/logs/latest.log`，排查异常时优先查看这个文件；完整历史保留在 `.agent/logs/gs-agent.log`。

## TUI 测试程序

## TUI 框架

`src/tui/framework.gs` 是可复用入口，聚合了：

- `runTuiApp`：通用 TUI 运行时，负责备用屏、raw input、按键解析、resize、tick、局部刷新和退出清理。
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

默认只启用只读代码工具：

```toml
tools = ["read_file", "list_dir", "grep"]
```

如需让 agent 写文件或执行 shell 命令，可显式加入：

```toml
tools = ["read_file", "list_dir", "grep", "write_file", "bash"]
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

## 本地 smoke test

不调用真实模型，只验证 agent loop、工具调用和 JSONL session：

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s dynamic-tool-smoke-test.gs
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
