import { openGatewayStore } from "@/models/store";
import { createGatewayModel } from "@/models/gateway";
import { registerRoutes } from "@/routes";

let web = require("@std/web");

export function createApp(config) {
  let store = openGatewayStore(config.gateway.database);
  let model = createGatewayModel(config, store);
  let app = web.createApp();

  app.use(web.json());
  registerRoutes(app, model);
  return app;
}
