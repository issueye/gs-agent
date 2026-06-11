import { loadConfig } from "@/config";
import { createApp } from "@/app";

let config = loadConfig();
let app = createApp(config);
let server = app.listen(config.gateway.port);

console.log("=== GS Gateway ===");
console.log("Version: 1.0.0");
console.log("Port:", server.port);
console.log("Database:", config.gateway.database);
console.log("Agent root:", config.gateway.agentRoot);
console.log("Gateway is ready!");
console.log("Health endpoint: http://127.0.0.1:" + String(server.port) + "/health");
console.log("WebSocket endpoint: ws://127.0.0.1:" + String(server.port) + "/ws/chat");
