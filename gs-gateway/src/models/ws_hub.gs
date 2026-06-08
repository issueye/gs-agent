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

function normalizeClientPayload(input) {
  let value = input || {};
  return {
    platform: String(value.platform || "web-chat"),
    adapter: String(value.adapter || "browser"),
    sender: String(value.sender || value.senderId || "tester"),
    chat: String(value.chat || value.chatId || "browser-chat-001"),
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
    let inbound = gateway.im.receive(normalizeClientPayload(payload));
    let task = inbound.task;
    clientList(task.id).push(ws);
    sendJSON(ws, {
      type: "task_created",
      at: now(),
      task: task,
    });
    try {
      let updated = gateway.agentBridge.runTask(task.id);
      let answer = "";
      if (updated.result && updated.result.answer) {
        answer = updated.result.answer;
      }
      broadcast(task.id, {
        type: "done",
        at: now(),
        task: updated,
        answer: answer,
      });
      removeClient(task.id, ws);
    } catch (error) {
      broadcast(task.id, {
        type: "error",
        at: now(),
        taskId: task.id,
        error: error.message || String(error),
      });
      removeClient(task.id, ws);
    }
  }

  function handleClient(req, res) {
    let ws = wsServer.upgrade(req);
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
    let ws = wsServer.upgrade(req);
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
