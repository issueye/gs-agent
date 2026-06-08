import { openGatewayStore } from "@/models/store";
import { createGatewayModel } from "@/models/gateway";
import { registerRoutes } from "@/routes";

let web = require("@std/web");
let path = require("@std/path");

export function createApp(config) {
  let store = openGatewayStore(config.gateway.database);
  let model = createGatewayModel(config, store);
  let app = web.createApp();

  app.use(web.json());
  app.use(web.static(path.join(config.root, "public")));
  registerRoutes(app, model);
  return app;
}
