# gs-agent TUI 设计

## 目标

TUI 是 `gs-agent` 的交互式运行界面，用于替代只读写 `workspace/task.txt` 的单次命令流程。它不改变现有 provider、agent loop、tool registry、tools、session 的核心边界，只在外层提供任务编辑、运行观察、工具调用审计和最终答案查看。

第一版目标是做成可靠的本地调试界面：

- 输入和编辑本次任务。
- 启动、停止一次 agent run。
- 实时查看模型消息、工具调用、工具结果和最终回答。
- 展示当前配置摘要，包括 provider、model、maxTurns、启用工具，但不显示 apiKey。
- 打开最近一次 `.agent/session.jsonl` 和 `.agent/answer.md` 的结构化视图。

非目标：

- 不做多会话数据库。
- 不做远程协作。
- 不在第一版实现聊天式长期记忆。
- 不把 TUI 作为安全审批系统；`bash`、`write_file` 等高风险工具仍由配置控制。

## 启动方式

新增一个独立入口，例如 `tui.gs`，后续可通过项目命令运行：

```powershell
..\gs.exe --timeout 0 tui.gs
```

分发二进制可以提供两个模式：

- 无参数：保持当前 `main.gs` 行为，执行一次任务并退出。
- `tui` 参数：进入交互式 TUI。

如果 GoScript 当前分发入口不方便区分参数，可以先保留 `tui.gs` 作为开发入口，等运行时参数能力确认后再并入分发二进制。

## 界面布局

默认布局采用四区结构：

```text
+------------------------------------------------------------------+
| gs-agent  provider=anthropic  model=deepseek-v4-flash  tools=3   |
+--------------------------+---------------------------------------+
| Task                     | Run Timeline                          |
|                          |                                       |
| 当前任务编辑区           | turn_start #0                         |
| 支持多行文本             | tool_call read_file README.md         |
|                          | tool_result ok                        |
+--------------------------+---------------------------------------+
| Details                                                          |
| 当前选中事件的完整内容、工具参数、错误信息或模型文本              |
+------------------------------------------------------------------+
| Ctrl+R Run  Ctrl+S Save Task  Ctrl+O Open Session  q Quit          |
+------------------------------------------------------------------+
```

区域职责：

- 顶部状态栏显示项目名、provider、model、maxTurns、工具数量、运行状态。
- 左侧任务区编辑 `workspace/task.txt`，支持保存和恢复。
- 右侧时间线显示 session 事件摘要，按 `turn_start`、`message`、`tool_call`、`tool_result`、`turn_end` 分组。
- 底部详情区展示当前选中事件的完整 JSON 摘要，长文本可滚动。
- 底栏显示快捷键和最近错误。

## 状态模型

TUI 内部维护一个轻量状态对象：

```javascript
{
  cwd,
  config,
  taskText,
  dirty,
  running,
  selectedEvent,
  events,
  answer,
  error
}
```

状态来源：

- `config` 来自现有 `agent.toml` / `agent.local.toml` 读取逻辑。
- `taskText` 来自 `workspace/task.txt`。
- `events` 优先来自当前运行过程中的 `onEvent` 回调。
- `answer` 来自 agent run 返回值，并同步读取 `.agent/answer.md` 做兜底。

为了避免 TUI 直接解析业务逻辑，建议把 [src/agent/app.gs](../../src/agent/app.gs) 拆出可复用装配函数：

- `loadAgentApp(root)`：读取配置、创建 workspace、session 路径和 kit。
- `runAgentApp()`：保留当前一次性命令行为。
- `runAgentTask(options)`：允许 TUI 传入 task 文本和 `onEvent`。

这样 TUI 只关心交互和渲染，不复制 provider、tools、session 的组装代码。

## 运行流程

1. TUI 启动，读取配置、任务文件和最近 session。
2. 用户编辑任务，按 `Ctrl+S` 保存到 `workspace/task.txt`。
3. 用户按 `Ctrl+R` 启动一次 agent run。
4. TUI 设置 `running=true`，清空当前事件列表。
5. agent 每次 `emit` 事件时通过 `onEvent` 推送给 TUI。
6. TUI 追加事件到时间线，并刷新详情区。
7. run 结束后写入 `.agent/answer.md`，状态栏显示完成。
8. 如果 provider 或工具抛错，TUI 在底栏显示错误，并把错误事件保留在时间线。

第一版可以同步运行 agent。若 UI 刷新被阻塞，再引入 worker 或异步执行模型；不要在第一版提前复杂化。

## 事件展示

事件摘要规则：

- `message user`：显示用户消息首行。
- `message assistant`：显示 assistant 文本首行。
- `tool_call`：显示工具名和关键参数，例如 `read_file README.md`。
- `tool_result ok:true`：显示工具名、成功状态和结果大小。
- `tool_result ok:false`：显示工具名和错误摘要。
- `turn_start` / `turn_end`：显示 turn 编号和 stop reason。

详情区规则：

- 工具调用展示 `name`、`args`。
- 工具结果展示 `ok`、`name`、`result` 或 `error`。
- 文件内容类结果默认截断到可视窗口，避免大文件撑爆界面。
- apiKey 一律不展示；配置区只显示是否已配置。

## 快捷键

第一版快捷键保持少量、稳定：

- `Ctrl+R`：运行当前任务。
- `Ctrl+S`：保存任务。
- `Ctrl+O`：加载最近 session。
- `Tab`：切换任务区、时间线、详情区焦点。
- `Up` / `Down`：移动时间线选中事件。
- `PageUp` / `PageDown`：滚动详情内容。
- `Esc`：取消当前输入状态或关闭错误提示。
- `q`：退出；如果任务有未保存改动，先提示确认。

## 错误处理

需要明确处理的错误：

- 缺少 `agent.local.toml` 或 apiKey：状态栏显示配置缺失，禁止运行真实 provider。
- `workspace/task.txt` 不存在：自动创建空文件，提示用户输入任务。
- provider 请求失败：保留 HTTP status 和错误体摘要。
- 工具参数校验失败：展示 registry 返回的 `ok:false`。
- 工具结果过大：详情区截断展示，但 session 文件保留完整记录。
- 用户退出时仍在运行：提示确认中断；第一版如果无法安全中断，则提示等待完成。

## 测试计划

离线测试：

- 使用 fake provider 验证 TUI 可以展示 `read_task`、`tool_result` 和最终回答。
- 使用伪造 session JSONL 验证事件解析和摘要生成。
- 验证 apiKey 不会出现在状态栏、详情区和错误提示里。

真实接口测试：

- 使用 DeepSeek Anthropic 兼容配置运行只读工具任务。
- 任务要求读取 `README.md`，确认 session 里出现 `read_file`。
- 验证运行结束后 `.agent/answer.md` 与 TUI 展示一致。

回归测试：

- 保持 `smoke-test.gs` 和 `provider-test.gs` 不依赖 TUI。
- 新增 TUI 纯函数测试时优先覆盖事件摘要、文本截断、配置脱敏。

## 实施阶段

第一阶段：设计和装配拆分。

- 新增 TUI 设计文档。
- 从 `runAgentApp` 拆出可复用装配和任务运行函数。
- 保持现有 `main.gs` 行为不变。

第二阶段：最小 TUI。

- 新增 `tui.gs`。
- 实现状态栏、任务区、时间线、详情区。
- 支持保存任务、运行任务、加载最近 session。

第三阶段：分发体验。

- 支持二进制 `tui` 参数进入 TUI。
- 更新 README 的运行和分发说明。
- 增加 fake provider 下的 TUI smoke test。
