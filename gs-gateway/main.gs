import { createApp } from "@/app";
import { loadConfig } from "@/config";

function main() {
  let config = loadConfig();
  let app = createApp(config);
  let server = app.listen(config.gateway.port);

  println("gs-gateway listening on http://127.0.0.1:" + String(server.port));
  println("agent root: " + config.gateway.agentRoot);
}
