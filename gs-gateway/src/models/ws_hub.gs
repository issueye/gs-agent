let wsServer = require("@std/net/ws/server");
import { createSessionContext } from "@/lib/session";
import { parseJSON, sendJSON, safeSend, extractField, safeString } from "@/lib/utils";

function now() {
  return (new Date()).toISOString();
}

function textUpdate(content, messageId) {
  return {
    sessionUpdate: "agent_message_chunk",
    content: {
      type: "text",
      text: String(content || ""),
    },
    messageId: String(messageId || ""),
  };
}

function toolUpdate(task, status, rawInput, rawOutput) {
  return {
    sessionUpdate: status === "running" ? "tool_call" : "tool_call_update",
    toolCallId: String(task && task.id ? task.id : ""),
    title: "网关任务",
    kind: String(task && task.kind ? task.kind : "agent.im"),
    status: status,
    rawInput: rawInput || null,
    rawOutput: rawOutput || null,
  };
}

function normalizeClientPayload(input) {
  let value = input || {};
  return {
    platform: safeString(value.platform, "web-chat"),
    adapter: safeString(value.adapter, "browser"),
    sender: safeString(extractField(value, "sender", "senderId"), "tester"),
    conversationId: extractField(value, "conversationId", "conversation_id"),
    chat: safeString(extractField(value, "chat", "chatId"), "browser-chat-001"),
    agentId: extractField(value, "agentId", "agent_id", "agent"),
    messageId: safeString(value.messageId, "web-" + String((new Date()).getTime())),
    text: safeString(value.text),
  };
}

function errorMessage(error) {
  return String(error && error.message ? error.message : error);
}

export function createWSHub(gateway) {
  let clients = {};

  function clientList(taskId) {
    if (!clients[taskId]) {
      clients[taskId] = [];
    }
    return clients[taskId];
  }

  function removeClient(taskId, ws) {
    let list = clients[taskId] || [];
    let next = [];
    for (let item of list) {
      if (item !== ws) {
        next.push(item);
      }
    }
    if (next.length > 0) {
      clients[taskId] = next;
    } else {
      delete clients[taskId];
    }
  }

  function broadcast(taskId, data) {
    let list = clients[taskId] || [];
    let next = [];
    for (let ws of list) {
      if (safeSend(ws, data)) {
        next.push(ws);
      }
    }
    if (next.length > 0) {
      clients[taskId] = next;
    } else {
      delete clients[taskId];
    }
  }

  function runTaskForClient(ws, payload) {
    let requestId = extractField(payload, "requestId", "request_id", "messageId", "message_id");
    let conversationId = extractField(payload, "conversationId", "conversation_id", "chat", "chatId");
    let inbound = gateway.im.receive(normalizeClientPayload(payload));
    let task = inbound.task;
    let ctx = createSessionContext(conversationId, task.id, requestId);
    clientList(task.id).push(ws);

    sendJSON(ws, ctx.frame("session/accepted", {
      metadata: { taskId: task.id },
    }));
    sendJSON(ws, ctx.frame("session/update", {
      update: toolUpdate(task, "running", task.payload && task.payload.input ? task.payload.input.text : "", null),
    }));
    sendJSON(ws, {
      type: "task_created",
      at: now(),
      conversation_id: conversationId,
      session_id: task.id,
      request_id: requestId,
      task: task,
    });

    go(function() {
      try {
        let updated = gateway.agentBridge.runTask(task.id);
        let answer = "";
        if (updated.result && updated.result.answer) {
          answer = updated.result.answer;
        }
        if (answer !== "") {
          broadcast(task.id, ctx.frame("session/update", {
            update: textUpdate(answer, task.id),
          }));
        }
        broadcast(task.id, ctx.frame("session/update", {
          update: toolUpdate(updated, "completed", null, updated.result || answer),
        }));
        broadcast(task.id, ctx.frame("session/completed", {
          stopReason: "completed",
          metadata: { taskId: task.id },
        }));
        broadcast(task.id, {
          type: "done",
          at: now(),
          conversation_id: conversationId,
          session_id: task.id,
          request_id: requestId,
          task: updated,
          answer: answer,
        });
      } catch (error) {
        broadcast(task.id, ctx.frame("session/error", {
          code: "AGENT_TASK_FAILED",
          error: errorMessage(error),
          metadata: { taskId: task.id },
        }));
        broadcast(task.id, {
          type: "error",
          at: now(),
          conversation_id: conversationId,
          session_id: task.id,
          request_id: requestId,
          taskId: task.id,
          error: errorMessage(error),
        });
      }
      removeClient(task.id, ws);
    });
  }

  function handleClient(req, res) {
    let ws;
    try {
      ws = wsServer.upgrade(req);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: {
          code: "WS_UPGRADE_FAILED",
          message: errorMessage(error),
        },
      });
    }
    sendJSON(ws, {
      type: "connected",
      at: now(),
      role: "client",
    });
    while (true) {
      let raw = ws.recv();
      if (raw === null) {
        break;
      }
      let event = parseJSON(raw);
      if (event.type === "message") {
        runTaskForClient(ws, event.payload || {});
      } else if (event.type === "ping") {
        sendJSON(ws, { type: "pong", at: now() });
      }
    }
    ws.close();
  }

  function handleAgent(req, res) {
    let ws;
    try {
      ws = wsServer.upgrade(req);
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: {
          code: "WS_UPGRADE_FAILED",
          message: errorMessage(error),
        },
      });
    }
    sendJSON(ws, {
      type: "connected",
      at: now(),
      role: "agent",
    });
    while (true) {
      let raw = ws.recv();
      if (raw === null) {
        break;
      }
      let event = parseJSON(raw);
      let taskId = event.taskId || (event.task ? event.task.id : "");
      if (taskId !== "") {
        captureToolCalls(taskId, event);
        broadcast(taskId, event);
      }
    }
    ws.close();
  }

  function captureToolCalls(taskId, event) {
    if (event.type !== "agent_event" || !event.event) {
      return;
    }
    let agentEvent = event.event;
    let kind = agentEvent.kind || "";
    if (kind !== "tool_call" && kind !== "tool_result") {
      return;
    }
    let task = gateway.store.getTask(taskId);
    if (!task) {
      return;
    }
    let payload = task.payload || {};
    let toolCalls = payload.tool_calls || [];
    let toolPayload = agentEvent.payload || {};

    if (kind === "tool_call") {
      toolCalls.push({
        id: toolPayload.id || "",
        name: toolPayload.name || "",
        title: toolPayload.name || "",
        kind: toolPayload.name || "",
        status: "running",
        arguments: toolPayload.args || "",
        result: null,
      });
    } else if (kind === "tool_result") {
      for (let i = toolCalls.length - 1; i >= 0; i--) {
        if (toolCalls[i].id === toolPayload.id) {
          toolCalls[i].status = "completed";
          toolCalls[i].result = toolPayload.content || toolPayload.result || "";
          break;
        }
      }
    }

    payload.tool_calls = toolCalls;
    gateway.store.updateTask(taskId, { payload: payload });
  }

  return {
    handleClient: handleClient,
    handleAgent: handleAgent,
    broadcast: broadcast,
  };
}
