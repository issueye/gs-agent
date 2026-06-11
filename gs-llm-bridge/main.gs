import { loadConfig } from "@/config";
import { createApp } from "@/app";

let config = loadConfig();
let app = createApp(config);
let server = app.listen(config.port);

console.log("=== GS LLM Bridge ===");
console.log("Version: 0.1.0");
console.log("Address: http://" + config.host + ":" + String(server.port));
console.log("Store:", config.storePath);
console.log("Health: http://" + config.host + ":" + String(server.port) + "/healthz");
