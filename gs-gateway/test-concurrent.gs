// test-gateway-concurrent.gs - 测试网关并发能力

let wsClient = require("@std/net/ws/client");

function createTestClient(id) {
  return {
    id: id,
    connect: function() {
      let ws = wsClient.connect("ws://127.0.0.1:18878/ws/chat");
      let connected = JSON.parse(ws.recv());
      if (connected.type !== "connected") {
        throw new Error("连接失败");
      }
      println("客户端 " + String(id) + " 已连接");
      return ws;
    },
    sendMessage: function(ws, text) {
      let requestId = "test-" + String(id) + "-" + String((new Date()).getTime());
      ws.sendText(JSON.stringify({
        type: "message",
        payload: {
          platform: "test",
          adapter: "concurrent",
          sender: "tester-" + String(id),
          requestId: requestId,
          messageId: requestId,
          text: text
        }
      }));
      return requestId;
    },
    waitForResponse: function(ws) {
      let completed = false;
      let count = 0;
      while (!completed && count < 100) {
        let raw = ws.recv();
        if (raw === null) break;
        let event = JSON.parse(raw);
        println("客户端 " + String(id) + " 收到: " + event.type);
        if (event.type === "session/completed" || event.type === "done") {
          completed = true;
        }
        count++;
      }
      return completed;
    }
  };
}

println("=== 测试网关并发能力 ===");
println("");

// 测试 1: 顺序发送（基准）
println("测试 1: 顺序发送 3 个消息");
let start1 = (new Date()).getTime();
for (let i = 0; i < 3; i++) {
  let client = createTestClient(i);
  let ws = client.connect();
  client.sendMessage(ws, "顺序测试 " + String(i));
  client.waitForResponse(ws);
  ws.close();
}
let duration1 = (new Date()).getTime() - start1;
println("顺序完成时间: " + String(duration1) + "ms");
println("");

// 测试 2: 并发发送（go() 后）
println("测试 2: 并发发送 3 个消息");
let start2 = (new Date()).getTime();
let clients = [];
for (let i = 0; i < 3; i++) {
  let client = createTestClient(10 + i);
  let ws = client.connect();
  client.sendMessage(ws, "并发测试 " + String(i));
  clients.push({client: client, ws: ws});
}

// 等待所有响应
for (let i = 0; i < clients.length; i++) {
  clients[i].client.waitForResponse(clients[i].ws);
  clients[i].ws.close();
}
let duration2 = (new Date()).getTime() - start2;
println("并发完成时间: " + String(duration2) + "ms");
println("");

println("=== 测试完成 ===");
println("性能提升: " + String(Math.round((duration1 / duration2) * 100) / 100) + "x");
