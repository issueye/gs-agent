import { openGatewayStore, ensureDefaultAgent } from "@/models/store";
import { createGatewayModel } from "@/models/gateway";
import { startOutboundPoller } from "@/models/im_outbound";
import { registerRoutes } from "@/routes";

let web = require("@std/web");
let path = require("@std/path");

export function createApp(config) {
  let store = openGatewayStore(config.gateway.database);
  ensureDefaultAgent(store, config);
  let model = createGatewayModel(config, store);

  if (config.im && config.im.outbound && config.im.outbound.enabled !== false) {
    startOutboundPoller(model, config.im.outbound);
  }
  let app = web.createApp();

  app.use(function(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    return next();
  });
  app.use(web.json());
  app.use(web.static(path.join(config.root, "public")));
  registerRoutes(app, model);
  return app;
}
