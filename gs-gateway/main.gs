import { createGatewayModel } from "@/models/gateway";
import { openGatewayStore } from "@/models/store";
import { config } from "@/lib/config";

let store = openGatewayStore("./data/gateway.db");
let gateway = createGatewayModel(store);

console.log("=== GS Gateway ===");
console.log("Version: 1.0.0");
console.log("Host:", config.gateway.host);
console.log("Port:", config.gateway.port);
console.log("Timeout:", config.gateway.timeout, "ms");
console.log("Starting...");

gateway.listen(config.gateway.host, config.gateway.port);

console.log("Gateway is ready!");
console.log("WebSocket endpoint: ws://" + config.gateway.host + ":" + String(config.gateway.port) + "/ws/chat");
