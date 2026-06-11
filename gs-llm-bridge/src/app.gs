import { createBridgeModel } from "@/models/bridge";
import { registerRoutes } from "@/routes";

let web = require("@std/web");

export function createApp(config) {
  let model = createBridgeModel(config);
  let app = web.createApp();

  app.use(function(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-API-Key,anthropic-version");
    res.setHeader("Access-Control-Expose-Headers", "X-ICOO-Request-ID");
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }
    return next();
  });
  app.use(web.json());

  registerRoutes(app, model);
  return app;
}
