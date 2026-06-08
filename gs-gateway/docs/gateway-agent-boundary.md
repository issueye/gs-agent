# Gateway / Agent 边界

> 更新日期：2026-06-08。

本文用于固定 `gs-gateway` 和 `gs-agent` 的职责边界。
后续改动应保持这个拆分，除非有新的架构决策文档明确替代它。

## 决策

`gs-gateway` 是集成、调度、持久化和 HTTP 控制面。
`gs-agent` 是模型执行、工具执行、Skill 执行和 session 产出运行时。

网关可以创建并跟踪 Agent 任务，但不能模拟 Agent 输出，也不能包含模型循环行为。
网关执行任务时，始终委托给 `gs-agent/gateway-task.gs`。

IM 和定时任务的细化设计见 `docs/im-scheduler-gateway-design.md`。

## Gateway 负责

- HTTP API 路由和响应格式。
- IM 入站消息归一化，并转换成网关事件和 pending 任务。
- 网关任务记录、schedule 记录、client/plugin 注册记录和网关审计事件。
- IM 通道元数据、归一化入站消息、会话映射、出站回复生命周期和 IM 审计事件。
- 读取 Agent 文件系统摘要，用于 UI 展示：
  - current session 元数据
  - session 列表
  - skill 索引
  - 动态 tool 索引
  - plugin 目录索引
- 通过网关 API 管理 Skill 文件。
- 将到期 schedule 转换成 pending 任务。
- 持久化 scheduler runtime 状态：
  - schedule 校验
  - next-run 计算
  - 手动 schedule 运行
  - 重复运行防护
  - 中断定时任务的重启恢复
- Agent bridge 派发和审计：
  - 将任务标记为 `running`
  - 调用 `gs-agent/gateway-task.gs`
  - 成功时持久化结果
  - 失败时持久化结构化失败
  - 追加 `agent_bridge` 事件：`start`、`done`、`failed`

## Agent 负责

- 加载 `agent.toml`。
- provider 选择和模型请求。
- Agent loop 行为：
  - 消息历史
  - tool-call 处理
  - final-turn 行为
  - 取消
  - context 选择和 session archive 搜索
- 内置 coding tools、workspace tools、动态 tools、skill runner 和 subagent runner。
- 执行期 Skill 发现和 prompt 注入。
- JSONL session 创建、answer file 创建、current-session 更新和模型请求体日志。
- 控制进入 `gs-agent` 后的 IM plugin runtime bridge。
- Agent 本地测试使用的 fake provider 或 scripted provider。
- 模型执行期的 IM 平台凭据边界。网关可以拥有用于平台收发的集成凭据，但这些凭据不能传入 Agent task payload，除非后续有显式契约要求。

## Gateway 不能负责

- 模型 provider 配置、API key 或模型请求体。
- fake Agent 结果、fake session 或 dry-run 任务完成。
- tool 执行语义。
- 模型运行时的 Skill prompt 应用。
- subagent 编排。
- Agent session 内容生成。
- 归一化之后的平台特定 prompt 语义。网关只提供标准上下文；Agent 决定如何构造 prompt 并进行推理。

## Bridge 契约

网关调用：

```text
runtime.callScript(<agentRoot>/gateway-task.gs, "runGatewayTask", [payload], {
  cwd: agentRoot,
  argv: ["gs-agent", "gateway-task"],
})
```

Payload 结构：

```json
{
  "taskId": "task-...",
  "id": "task-...",
  "kind": "agent.im",
  "name": "IM message from user",
  "root": "absolute/path/to/gs-agent",
  "source": {
    "type": "im",
    "eventId": "evt-...",
    "scheduleId": ""
  },
  "input": {
    "text": "...",
    "displayText": "...",
    "conversation": {},
    "schedule": {}
  },
  "run": {
    "workspaceRoot": "",
    "model": "auto",
    "mode": "agent",
    "reasoningEffort": "medium"
  },
  "payload": {}
}
```

`payload` 只用于额外扩展数据，不再作为旧 `payload.im` 或 `payload.text` 的兼容入口。新网关代码必须填充 `source`、`input` 和 `run`。

期望结果结构：

```json
{
  "ok": true,
  "answer": "...",
  "events": 12,
  "sessionId": "...",
  "sessionDir": "...",
  "sessionFile": "...",
  "sessionArchiveFile": "...",
  "answerFile": "...",
  "logFile": "...",
  "latestLogFile": "..."
}
```

失败通过网关任务状态 `failed` 和 result 对象表示：

```json
{
  "error": {
    "message": "..."
  }
}
```

## 测试策略

网关 smoke test 可以验证派发错误处理，即使本地没有模型 key。
测试不能创建 fake Agent answer。

真实端到端 bridge 测试需要 `gs-agent/agent.toml` 中存在可用 provider 配置。
当该配置缺失时，预期 bridge 行为是持久化失败，并给出清晰的 provider 配置错误。
