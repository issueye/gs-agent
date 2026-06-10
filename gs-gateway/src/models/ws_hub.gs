let wsServer = require("@std/net/ws/server");
import { createSessionContext } from "@/lib/session";
import { parseJSON, sendJSON, safeSend, extractField, safeString } from "@/lib/utils";
import { ErrorCodes, createErrorResponse } from "@/lib/error-codes";
import { createTimeoutController } from "@/lib/timeout";
import { createStreamEmitter } from "@/lib/stream";
import { config } from "@/lib/config";

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
    clientList(task.id).push(ws);

    let ctx = createSessionContext(conversationId, task.id, requestId);

    sendJSON(ws, ctx.frame("session/accepted", {
      metadata: { taskId: task.id }
    }));

    sendJSON(ws, ctx.frame("session/update", {
      update: toolUpdate(task, "running", task.payload && task.payload.input ? task.payload.input.text : "", null)
    }));

    sendJSON(ws, {
      type: "task_created",
      at: now(),
      conversation_id: conversationId,
      session_id: task.id,
      request_id: requestId,
      task: task,
    });

    // 创建超时控制器
    let timeout = createTimeoutController(config.gateway.timeout);

    timeout.start(function() {
      if (!timeout.isCancelled()) {
        broadcast(task.id, ctx.frame("session/error", {
          code: ErrorCodes.AGENT_TIMEOUT,
          error: "任务执行超时",
          metadata: { taskId: task.id, timeoutMs: config.gateway.timeout }
        }));
        removeClient(task.id, ws);
      }
    });

    go(function() {
      let answer = "";
      let stream = createStreamEmitter(broadcast, task.id, ctx);

      try {
        let updated = gateway.agentBridge.runTask(task.id);
        timeout.cancel();

        // 流式推送结果（如果有answer）
        if (updated.result && updated.result.answer) {
          answer = updated.result.answer;
          // 模拟流式推送：分块发送
          let chunkSize = 50;
          for (let i = 0; i < answer.length; i += chunkSize) {
            let chunk = answer.slice(i, i + chunkSize);
            stream.emit(chunk);
          }
        }

        stream.done(answer);

        broadcast(task.id, ctx.frame("session/update", {
          update: toolUpdate(updated, "completed", null, updated.result || answer)
        }));
        broadcast(task.id, ctx.frame("session/completed", {
          stopReason: "completed",
          metadata: { taskId: task.id }
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
        removeClient(task.id, ws);
      } catch (error) {
          broadcast(task.id, ctx.frame("session/update", {
            update: textUpdate(answer, task.id)
          }));
        }
        broadcast(task.id, ctx.frame("session/update", {
          update: toolUpdate(updated, "completed", null, updated.result || answer)
        }));
        broadcast(task.id, ctx.frame("session/completed", {
          stopReason: "completed",
          metadata: { taskId: task.id }
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
        removeClient(task.id, ws);
      } catch (error) {
        timeout.cancel();
        broadcast(task.id, ctx.frame("session/error", {
          code: ErrorCodes.AGENT_TASK_FAILED,
          error: error.message || String(error),
          metadata: { taskId: task.id }
        }));
        broadcast(task.id, {
          type: "error",
          at: now(),
          conversation_id: conversationId,
          session_id: task.id,
          request_id: requestId,
          taskId: task.id,
          error: error.message || String(error),
        });
        removeClient(task.id, ws);
      }
    });
  }
    let requestId = requestIdFromPayload(payload);
    let conversationId = conversationIdFromPayload(payload);
    let inbound = gateway.im.receive(normalizeClientPayload(payload));
    let task = inbound.task;
    clientList(task.id).push(ws);
    sendJSON(ws, sessionFrame("session/accepted", {
      conversationId: conversationId,
      sessionId: task.id,
      requestId: requestId,
      metadata: {
        taskId: task.id,
      },
    }));
    sendJSON(ws, sessionFrame("session/update", {
      conversationId: conversationId,
      sessionId: task.id,
      requestId: requestId,
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

    // 使用 go() 异步执行任务，避免阻塞 WebSocket
    go(function() {
      try {
        let updated = gateway.agentBridge.runTask(task.id);
      let answer = "";
      if (updated.result && updated.result.answer) {
        answer = updated.result.answer;
      }
      if (answer !== "") {
        broadcast(task.id, sessionFrame("session/update", {
          conversationId: conversationId,
          sessionId: task.id,
          requestId: requestId,
          update: textUpdate(answer, task.id),
        }));
      }
      broadcast(task.id, sessionFrame("session/update", {
        conversationId: conversationId,
        sessionId: task.id,
        requestId: requestId,
        update: toolUpdate(updated, "completed", null, updated.result || answer),
      }));
      broadcast(task.id, sessionFrame("session/completed", {
        conversationId: conversationId,
        sessionId: task.id,
        requestId: requestId,
        stopReason: "completed",
        metadata: {
          taskId: task.id,
        },
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
        removeClient(task.id, ws);
      } catch (error) {
        broadcast(task.id, sessionFrame("session/error", {
        conversationId: conversationId,
        sessionId: task.id,
        requestId: requestId,
        code: "AGENT_TASK_FAILED",
        error: error.message || String(error),
        metadata: {
          taskId: task.id,
        },
      }));
      broadcast(task.id, {
        type: "error",
        at: now(),
        conversation_id: conversationId,
        session_id: task.id,
        request_id: requestId,
        taskId: task.id,
        error: error.message || String(error),
      });
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
          message: String(error.message || error),
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
          message: String(error.message || error),
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
        if (event.type === "agent_event") {
          let agentEvent = event.event || {};
          if (agentEvent.kind === "text_delta") {
            broadcast(taskId, sessionFrame("session/update", {
              conversationId: event.conversationId || event.conversation_id || "",
              sessionId: taskId,
              requestId: event.requestId || event.request_id || "",
              update: textUpdate(agentEvent.payload ? agentEvent.payload.text : "", taskId),
            }));
          } else {
            broadcast(taskId, sessionFrame("session/update", {
              conversationId: event.conversationId || event.conversation_id || "",
              sessionId: taskId,
              requestId: event.requestId || event.request_id || "",
              update: {
                sessionUpdate: "tool_call_update",
                toolCallId: taskId,
                title: "Agent 事件",
                kind: String(agentEvent.kind || "event"),
                status: agentEvent.kind === "failed" ? "failed" : "running",
                rawOutput: agentEvent.payload || agentEvent,
              },
            }));
          }
        }
        broadcast(taskId, event);
      }
    }
    ws.close();
  }

  return {
    handleClient: handleClient,
    handleAgent: handleAgent,
    broadcast: broadcast,
  };
}
