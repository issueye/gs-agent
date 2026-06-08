let wsClient = require("@std/net/ws/client");

function parseJSON(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch (error) {
    return {};
  }
}

let requestId = "desktop-smoke-" + String((new Date()).getTime());
let ws = wsClient.connect("ws://127.0.0.1:18878/ws/chat");
let connected = parseJSON(ws.recv());
if (connected.type !== "connected" || connected.role !== "client") {
  throw new Error("missing connected frame");
}

ws.sendText(JSON.stringify({
  type: "message",
  payload: {
    platform: "desktop",
    adapter: "wails-smoke",
    sender: "desktop-smoke",
    chat: "desktop-smoke-chat",
    requestId: requestId,
    messageId: requestId,
    text: "桌面端协议自检",
  },
}));

let accepted = false;
let update = false;
let terminal = false;

for (let i = 0; i < 20; i = i + 1) {
  let raw = ws.recv();
  if (raw === null) {
    break;
  }
  let event = parseJSON(raw);
  println("event=" + String(event.type || "") + ":" + String(event.session_id || ""));
  if (event.type === "session/accepted") {
    accepted = true;
    if (event.request_id !== requestId) {
      throw new Error("accepted request_id mismatch");
    }
  }
  if (event.type === "session/update" && event.update) {
    update = true;
  }
  if (event.type === "session/completed" || event.type === "session/error") {
    terminal = true;
    break;
  }
}

ws.close();

if (!accepted) {
  throw new Error("missing session/accepted");
}
if (!update) {
  throw new Error("missing session/update");
}
if (!terminal) {
  throw new Error("missing terminal session frame");
}

println("desktop websocket protocol ok");
