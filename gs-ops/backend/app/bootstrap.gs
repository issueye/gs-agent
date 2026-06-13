let web = require("@std/web");
let fs = require("@std/fs");
let process = require("@std/process");

import { Kernel } from "./kernel.gs";
import { cors } from "../middlewares/cors.gs";
import { logger } from "../middlewares/logger.gs";
import { auth } from "../middlewares/auth.gs";
import { rateLimit } from "../middlewares/rateLimit.gs";
import { securityHeaders } from "../middlewares/securityHeaders.gs";
import { notFound } from "../middlewares/errorHandler.gs";
import { registerApiRoutes } from "../routes/api.gs";
import { registerWsRoutes } from "../routes/ws.gs";

export function createApplication() {
  let app = web.createApp();
  let kernel = new Kernel(process.cwd());
  let controllers = kernel.controllers();

  // 初始化系统（创建默认管理员等）
  kernel.initialize();

  // 安全中间件（最先执行）
  app.use(securityHeaders);

  // CORS 和日志
  app.use(cors);
  app.use(logger);

  // 速率限制
  app.use(rateLimit);

  // 请求解析
  app.use(web.json());

  // 认证
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
