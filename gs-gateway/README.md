# gs-gateway

`gs-gateway` 是用 GoScript 编写的网关项目，用于承接桌面端、脚本插件和 `gs-agent`。

它负责：

- 管理 IM 入站消息，并生成待处理 agent 任务。
- 读取和管理 `gs-agent` 的 Skills。
- 读取 `gs-agent` 动态工具和插件目录。
- 管理定时任务和普通任务的网关侧状态。
- 记录网关事件到 SQLite。
- 暴露 HTTP API 给桌面端或插件调用。

## 目录

```text
gs-gateway/
  main.gs
  gateway.toml
  src/
    app.gs
    config.gs
    routes.gs
    controllers/
    models/
    views/
```

## 运行

```powershell
cd E:\codes\gts_codes\gs-gateway
E:\codes\gts\dist\gs.exe --timeout 0 run
```

默认监听：

```text
http://127.0.0.1:18878
```

测试聊天页：

```text
http://127.0.0.1:18878/chat
```

## 配置

`gateway.toml`：

```toml
[gateway]
port = 18878
dataDir = ".gateway"
database = ".gateway/gateway.db"
agentRoot = "../gs-agent"
```

`agentRoot` 默认指向同级目录的 `gs-agent`。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 网关健康检查和 agent 摘要 |
| GET | `/api/agent` | `gs-agent` 文件系统摘要 |
| GET | `/api/agent/sessions` | agent session 列表 |
| GET | `/api/agent/current-session` | 当前 agent session |
| POST | `/api/im/inbound` | 写入 IM 入站消息，并创建 agent 任务 |
| GET | `/api/im/channels` | IM 通道列表 |
| POST | `/api/im/channels` | 创建 IM 通道 |
| PATCH | `/api/im/channels/:id` | 更新 IM 通道 |
| DELETE | `/api/im/channels/:id` | 删除 IM 通道 |
| GET | `/api/im/conversations` | IM 会话列表 |
| GET | `/api/events` | 网关事件列表 |
| GET | `/api/skills` | skill 列表 |
| POST | `/api/skills` | 创建 skill |
| GET | `/api/skills/:name` | 读取单个 `SKILL.md` |
| PUT | `/api/skills/:name` | 更新 skill |
| DELETE | `/api/skills/:name` | 删除 skill |
| GET | `/api/plugins` | agent 插件目录列表 |
| POST | `/api/plugins/register` | 插件向网关注册 |
| GET | `/api/tools` | agent 动态工具列表 |
| GET | `/api/tasks` | 网关任务列表 |
| POST | `/api/tasks` | 创建网关任务 |
| GET | `/api/tasks/:id` | 读取任务 |
| PATCH | `/api/tasks/:id` | 更新任务状态和结果 |
| POST | `/api/tasks/:id/run` | 运行任务；直接派发到真实 `gs-agent` |
| GET | `/api/schedules` | 定时计划列表 |
| POST | `/api/schedules` | 创建定时计划 |
| POST | `/api/schedules/tick` | 执行一次 scheduler tick |
| GET | `/api/scheduler/status` | scheduler 运行状态 |
| GET | `/api/schedules/:id` | 读取定时计划 |
| PATCH | `/api/schedules/:id` | 更新定时计划 |
| DELETE | `/api/schedules/:id` | 删除定时计划 |
| POST | `/api/schedules/:id/run` | 手动运行定时计划 |

## IM 入站示例

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:18878/api/im/inbound `
  -ContentType application/json `
  -Body '{"platform":"onebot","adapter":"qq-local","sender":"10001","chat":"dev","text":"帮我查看当前任务"}'
```

返回中会包含事件记录和新建任务。任务可通过 `/api/tasks/:id/run` 派发给 `gs-agent/gateway-task.gs`。
网关不再提供 `fake`、`dryRun` 或 `allowReal` 分支；运行任务会直接进入真实 agent 链路，并要求 `gs-agent/agent.toml` 中存在可用模型配置。

每次运行都会写入 `agent_bridge` 事件，便于桌面端审计。
网关与 agent 的功能边界见 `docs/gateway-agent-boundary.md`。

## 迁移计划

迁移开发计划见：

```text
docs/migration-development-plan.md
```

IM、定时任务和网关的调整设计见：

```text
docs/im-scheduler-gateway-design.md
```

## 自检

```powershell
cd E:\codes\gts_codes\gs-gateway
E:\codes\gts\dist\gs.exe --timeout 20s smoke-test.gs
```

当前 smoke test 会验证网关记录、技能管理、调度和真实 agent 桥接错误处理。
如果 `gs-agent/agent.toml` 缺少可用 provider 配置，桥接部分预期会失败并被记录为 `agent_bridge failed` 事件。
