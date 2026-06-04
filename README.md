# gs-agent

`gs-agent` 是一个用 GoScript (`.gs`) 编写的真实 AI agent 项目，结构参考 `E:\codes\github\pi` 的核心分层：provider、agent loop、tool registry、tools、session。

## 结构

- `main.gs`：应用入口，读取任务文件并运行 agent。
- `agent.toml`：默认运行配置，使用 Anthropic 兼容 provider。
- `agent.local.toml`：本地密钥配置，已被 `.gitignore` 忽略。
- `workspace/task.txt`：当前任务输入。
- `src/agent/core`：agent loop 和组装入口。
- `src/agent/llm`：Anthropic 兼容 provider，以及显式测试用 fake provider。
- `src/agent/tools`：文件、目录、grep、bash、workspace task 工具。
- `src/agent/session`：JSONL session 事件记录。
- `docs/plans/2026-06-04-tui-design.md`：TUI 交互界面设计。
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

默认只启用只读代码工具：

```toml
tools = ["read_file", "list_dir", "grep"]
```

如需让 agent 写文件或执行 shell 命令，可显式加入：

```toml
tools = ["read_file", "list_dir", "grep", "write_file", "bash"]
```

## 本地 smoke test

不调用真实模型，只验证 agent loop、工具调用和 JSONL session：

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s smoke-test.gs
E:\codes\gts\dist\gs.exe --timeout 20s provider-test.gs
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
