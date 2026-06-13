// e2e-test.gs - 网关端到端测试
// 默认不调用真实模型；如需验证真实 agent 桥接，请设置 GS_AGENT_API_KEY 并启用 defaultAgent

import { loadConfig } from "@/config";
import { createApp } from "@/app";

let fs = require("@std/fs");
let path = require("@std/path");
let http = require("@std/net/http/client");
let wsClient = require("@std/net/ws/client");

let baseUrl = "http://127.0.0.1:18878";

function assertOK(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function rawHttpRequest(method, urlPath, body) {
  let url = baseUrl + urlPath;
  let headers = {
    "Content-Type": "application/json",
  };
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return http.post(url, body || {}, {
      headers: headers,
    });
  }
  return http.request({
    url: url,
    method: method,
    headers: headers,
  });
}

function httpRequest(method, urlPath, body) {
  let response = rawHttpRequest(method, urlPath, body);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(method + " " + urlPath + " failed: " + String(response.status) + " " + String(response.body || ""));
  }
  return JSON.parse(response.body || "{}");
}

function waitForServer() {
  let attempts = 0;
  while (attempts < 20) {
    try {
      let response = http.request({
        url: baseUrl + "/health",
        method: "GET",
      });
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      // ignore
    }
    attempts = attempts + 1;
    let start = Date.now();
    while (Date.now() - start < 100) {
      // busy wait
    }
  }
  throw new Error("server did not become ready");
}

function testWebSocket() {
  println("=== WebSocket test ===");
  let ws = wsClient.connect("ws://127.0.0.1:18878/ws/chat");
  let connected = JSON.parse(ws.recv());
  assertOK(connected.type === "connected", "client should connect");

  let requestId = "ws-test-" + String((new Date()).getTime());
  ws.sendText(JSON.stringify({
    type: "message",
    payload: {
      platform: "test",
      adapter: "e2e-ws",
      sender: "ws-tester",
      requestId: requestId,
      messageId: requestId,
      text: "hello from websocket",
    },
  }));

  let completed = false;
  let eventCount = 0;
  while (!completed && eventCount < 100) {
    let raw = ws.recv();
    if (raw === null) {
      break;
    }
    let event = JSON.parse(raw);
    println("ws event: " + event.type);
    if (event.type === "session/completed" || event.type === "done" || event.type === "error") {
      completed = true;
    }
    eventCount = eventCount + 1;
  }
  assertOK(completed, "websocket client should receive completion");
  ws.close();
  println("websocket test ok");
}

function main() {
  let config = loadConfig();
  let smokeDb = path.join(config.root, ".gateway", "e2e-test-" + String((new Date()).getTime()) + ".db");
  config.gateway.database = smokeDb;
  config.im.outbound.enabled = false;

  let app = createApp(config);
  let server = app.listen(config.gateway.port);
  println("e2e server started on port " + String(server.port));

  try {
    waitForServer();

    let health = httpRequest("GET", "/health", undefined);
    assertOK(health.ok, "health check should return ok");
    println("health ok");

    let im = httpRequest("POST", "/api/im/inbound", {
      platform: "test",
      adapter: "e2e",
      sender: "e2e-user",
      chat: "e2e-chat",
      text: "hello from e2e",
    });
    assertOK(im.ok, "IM inbound should succeed");
    assertOK(im.data.task.id, "IM inbound should create task");
    println("im inbound ok task=" + im.data.task.id);

    let taskId = im.data.task.id;
    let runResponse = rawHttpRequest("POST", "/api/tasks/" + encodeURIComponent(taskId) + "/run", {});
    let runResult = JSON.parse(runResponse.body || "{}");
    // 未配置真实 agent 时预期返回 500，错误码为 AGENT_NOT_CONFIGURED
    if (runResponse.status === 500 && runResult.error && runResult.error.code === "AGENT_BRIDGE_RUN_FAILED") {
      println("task run endpoint returned expected bridge error: " + runResult.error.message);
    } else {
      assertOK(runResponse.status >= 200 && runResponse.status < 300, "task run endpoint should respond");
      println("task run endpoint ok status=" + runResult.data.status);
    }

    let taskDetail = httpRequest("GET", "/api/tasks/" + encodeURIComponent(taskId), undefined);
    assertOK(taskDetail.ok, "task detail should be readable");
    println("task detail ok status=" + taskDetail.data.status);

    testWebSocket();

    println("gs-gateway e2e ok");
  } finally {
    server.close();
    try {
      fs.rmSync(smokeDb, { force: true });
    } catch (error) {
      // ignore
    }
  }
}

main();
