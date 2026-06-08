# IM / 定时任务 / 网关不兼容式重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 按不兼容式方式落地新的 `gs-gateway` IM 通道、持久化 scheduler runtime 和统一 Agent bridge 任务契约。

**架构：** `gs-gateway` 作为持久化控制面，统一拥有 IM channel/conversation、schedule next-run 状态、task envelope、事件审计和 Agent 派发。`gs-agent` 只接收新的 `source/input/run` 契约并负责模型执行；旧 `payload.im`、旧 `payload.text`、旧 `/api/schedules/run-due` 不再作为新实现的主路径保留。

**技术栈：** GoScript、`@std/db` SQLite、`@std/runtime.callScript`、现有 gateway MVC、`smoke-test.gs`。

---

## 不兼容范围

- 新建 `agent.im` 任务必须使用 `source/input/run`。
- `gs-agent/gateway-task.gs` 读取 `input.text` 和 `input.im`，不再依赖旧 `payload.im`。
- scheduler 使用 `tick()`、`run(id)` 和 `status()`；`dueToTasks()` 和 `/api/schedules/run-due` 移除。
- schedule 数据从单一 `schedule.dueAt` 迁移到 `schedule.type/nextRunAt` 和 `run/last` 结构。
- IM 入站必须归一化出 `channelId/messageId/chatId/senderId/text`，并写入 channel/conversation 相关记录。

## 并行开发拆分

### Worker A：IM Runtime 和 Store 扩展

**文件：**
- 修改：`gs-gateway/src/models/store.gs`
- 新建：`gs-gateway/src/models/im_runtime.gs`
- 修改：`gs-gateway/src/models/gateway.gs`
- 修改：`gs-gateway/src/controllers/im_controller.gs`

**步骤：**

1. 在 `store.gs` 新增表：
   - `gateway_im_channels`
   - `gateway_im_conversations`
   - `gateway_im_replies`
2. 在 `store.gs` 新增方法：
   - `createIMChannel(input)`
   - `listIMChannels(limit)`
   - `getIMChannel(id)`
   - `updateIMChannel(id, patch)`
   - `removeIMChannel(id)`
   - `upsertIMConversation(input)`
   - `listIMConversations(channelId, limit)`
   - `createIMReply(input)`
   - `updateIMReply(id, patch)`
3. 新建 `im_runtime.gs`：
   - `normalizeInbound(input)` 归一化平台字段。
   - `receive(input)` 写事件、upsert conversation、创建 `agent.im` task。
   - task payload 必须包含 `source/input/run`。
4. 更新 `gateway.gs`：
   - 用 `createIMRuntime(gateway)` 替代内联 `normalizeIMInput/receiveIM`。
   - 保留 `model.receiveIM` 指向 `gateway.im.receive`，方便短期调用。
5. 更新 `im_controller.gs`：
   - 增加 channels 和 conversations 管理方法。

**验证：**

- `model.im.receive({ platform, adapter, sender, chat, text })` 返回 event、conversation、task。
- `task.payload.source.type === "im"`。
- `task.payload.input.text` 等于入站文本。
- `model.im.listChannels({})` 可运行。

### Worker B：Scheduler Runtime 和 Controller 重构

**文件：**
- 修改：`gs-gateway/src/models/scheduler.gs`
- 修改：`gs-gateway/src/controllers/scheduler_controller.gs`

**步骤：**

1. 在 `scheduler.gs` 中实现 schedule 归一化：
   - 支持 `manual`、`at`、`interval`、`daily`。
   - 写入 `schedule.nextRunAt`。
   - 写入 `run.prompt/model/mode/workspaceRoot/reasoningEffort`。
   - 写入 `last.status/runAt/taskId/message`。
2. 实现 `tick(options)`：
   - 查找 `status="active"` 且 `schedule.nextRunAt <= now` 的 schedule。
   - 为每条 schedule 创建 `agent.schedule` task。
   - task payload 必须包含 `source/input/run`。
   - 更新 schedule `last.status="queued"`、`last.taskId`、下一次 `nextRunAt`。
3. 实现 `run(id, options)`：
   - 手动创建一次 task，不要求 `nextRunAt` 到期。
4. 实现 `status()`：
   - 返回 schedule 总数、active 数、下一条 nextRunAt。
5. 移除 `dueToTasks()`。
6. 更新 controller：
   - `POST /api/schedules/tick` 调用 `tick`。
   - `POST /api/schedules/:id/run` 调用 `run`。
   - `GET /api/scheduler/status` 调用 `status`。
   - 删除 `runDue`。

**验证：**

- 创建 `at` schedule 后，`tick({ now })` 产生 task。
- 创建 `manual` schedule 后，`tick({ now })` 不产生 task。
- `run(id)` 对 manual schedule 产生 task。

### 主线程：Bridge 契约、路由、Smoke Test 和文档

**文件：**
- 修改：`gs-gateway/src/models/agent_bridge.gs`
- 修改：`gs-agent/gateway-task.gs`
- 修改：`gs-gateway/src/routes.gs`
- 修改：`gs-gateway/smoke-test.gs`
- 修改：`gs-gateway/README.md`

**步骤：**

1. 更新 `agent_bridge.gs`：
   - `agentTaskPayload()` 只透传 task payload 中的 `source/input/run/payload`。
   - start event 记录 task `source.type`。
2. 更新 `gs-agent/gateway-task.gs`：
   - `agent.im` 使用 `input.im` 构造 `imMessagePrompt`。
   - `agent.schedule` 和其他任务使用 `input.text`。
   - 如果缺少 `input.text`，抛出明确错误。
3. 更新 `routes.gs`：
   - 增加 IM channel/conversation 路由。
   - 增加 `/api/schedules/tick`、`/api/schedules/:id/run`、`/api/scheduler/status`。
   - 删除 `/api/schedules/run-due`。
4. 更新 `smoke-test.gs`：
   - 断言 IM task 新 payload。
   - 断言 conversation 创建。
   - 断言 scheduler tick/run/status。
   - 不再调用 `dueToTasks()`。
5. 更新 `README.md` API 表。

**验证命令：**

```powershell
E:\codes\gts\dist\gs.exe --timeout 20s smoke-test.gs
```

从 `gs-gateway` 目录运行。若本机缺少可用模型配置，bridge 部分预期失败，但任务状态和 `agent_bridge failed` 事件必须被持久化。

## 完成标准

- `smoke-test.gs` 通过。
- 新 IM 入站任务不依赖旧 `payload.im`。
- 新 scheduler 不暴露 `dueToTasks()`。
- `/api/schedules/run-due` 不再注册。
- README 与中文设计文档一致。

