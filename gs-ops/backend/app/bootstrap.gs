let web = require("@std/web");
let fs = require("@std/fs");
let process = require("@std/process");

import { Kernel } from "./kernel.gs";
import { cors } from "../middlewares/cors.gs";
import { logger } from "../middlewares/logger.gs";
import { auth } from "../middlewares/auth.gs";
import { notFound } from "../middlewares/errorHandler.gs";
import { registerApiRoutes } from "../routes/api.gs";
import { registerWsRoutes } from "../routes/ws.gs";

export function createApplication() {
  let app = web.createApp();
  let kernel = new Kernel(process.cwd());
  let controllers = kernel.controllers();

  app.use(cors);
  app.use(logger);
  app.use(web.json());
  app.use(auth);

  registerApiRoutes(app, controllers);
  registerWsRoutes(app, controllers);

  app.get("/", (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(fs.readTextSync("public/index.html"));
  });
  app.use(web.static("public"));
  app.all("*", notFound);

  return app;
}
