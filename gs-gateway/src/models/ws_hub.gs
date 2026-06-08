let wsServer = require("@std/net/ws/server");

function parseJSON(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (error) {
    return {};
  }
}

function sendJSON(ws, data) {
  ws.sendText(JSON.stringify(data || {}));
}

function safeSend(ws, data) {
  try {
    sendJSON(ws, data);
    return true;
  } catch (error) {
    return false;
  }
}

function now() {
  return (new Date()).toISOString();
}

function requestIdFromPayload(payload) {
  let value = payload || {};
  return String(value.requestId || value.request_id || value.messageId || value.message_id || "");
}

function conversationIdFromPayload(payload) {
  let value = payload || {};
  return String(value.conversationId || value.conversation_id || value.chat || value.chatId || "");
}

function sessionFrame(type, payload) {
  let value = payload || {};
  return {
    type: type,
    conversation_id: String(value.conversationId || ""),
    session_id: String(value.sessionId || ""),
    request_id: String(value.requestId || ""),
    at: now(),
    update: value.update || null,
    stop_reason: String(value.stopReason || ""),
    code: String(value.code || ""),
    error: String(value.error || ""),
    metadata: value.metadata || {},
  };
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
    platform: String(value.platform || "web-chat"),
    adapter: String(value.adapter || "browser"),
    sender: String(value.sender || value.senderId || "tester"),
    chat: String(value.chat || value.chatId || "browser-chat-001"),
    agentId: String(value.agentId || value.agent_id || value.agent || ""),
    messageId: String(value.messageId || ("web-" + String((new Date()).getTime()))),
    text: String(value.text || ""),
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
    }
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
