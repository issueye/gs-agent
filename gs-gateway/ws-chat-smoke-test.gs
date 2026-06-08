let wsClient = require("@std/net/ws/client");

function parseJSON(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (error) {
    return {};
  }
}

let ws = wsClient.connect("ws://127.0.0.1:18878/ws/chat");
let connected = parseJSON(ws.recv());
println("connected=" + connected.type + ":" + connected.role);

ws.sendText(JSON.stringify({
  type: "message",
  payload: {
    platform: "ws-smoke",
    adapter: "goscript",
    sender: "smoke-tester",
    chat: "ws-smoke-chat",
    messageId: "ws-smoke-" + String((new Date()).getTime()),
    text: "WebSocket 实时链路测试：请只回复“WS链路成功”。",
  },
}));

let sawTask = false;
let sawAgentConnected = false;
let sawDelta = false;
let sawDone = false;
let answer = "";

for (let i = 0; i < 120; i = i + 1) {
  let raw = ws.recv();
  if (raw === null) {
    break;
  }
  let event = parseJSON(raw);
  println("event=" + String(event.type || "") + ":" + String(event.taskId || (event.task ? event.task.id : "")));
  if (event.type === "task_created") {
    sawTask = true;
  }
  if (event.type === "agent_connected") {
    sawAgentConnected = true;
  }
  if (event.type === "agent_event") {
    let agentEvent = event.event || {};
    if (agentEvent.kind === "text_delta") {
      sawDelta = true;
      let payload = agentEvent.payload || {};
      answer = answer + String(payload.text || "");
    }
  }
  if (event.type === "done") {
    sawDone = true;
    if (event.answer) {
      answer = String(event.answer);
    }
    break;
  }
  if (event.type === "error") {
    throw new Error(event.error || "ws error");
  }
}

ws.close();

if (!sawTask) {
  throw new Error("missing task_created event");
}
if (!sawAgentConnected) {
  throw new Error("missing agent_connected event");
}
if (!sawDelta) {
  throw new Error("missing text_delta event");
}
if (!sawDone) {
  throw new Error("missing done event");
}
if (!answer.includes("WS链路成功")) {
  throw new Error("unexpected answer: " + answer);
}

println("answer=" + answer);
