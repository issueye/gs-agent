export function registerApiRoutes(app, controllers) {
  let serviceController = controllers.serviceController;
  let monitorController = controllers.monitorController;
  let logController = controllers.logController;
  let configController = controllers.configController;
  let versionController = controllers.versionController;
  let actionController = controllers.actionController;

  app.get("/api/health", (req, res) => configController.health(req, res));
  app.get("/api/actions/:action/:id", (req, res) => actionController.run(req, res));
  app.get("/api/actions/restore-config/:id/:backupId", (req, res) => actionController.restoreConfig(req, res));

  app.get("/api/service-templates", (req, res) => serviceController.templates(req, res));
  app.get("/api/services", (req, res) => serviceController.index(req, res));
  app.post("/api/services", (req, res) => serviceController.create(req, res));
  app.post("/api/services/:id/install", (req, res) => serviceController.lifecycle("install", req, res));
  app.post("/api/services/:id/start", (req, res) => serviceController.lifecycle("start", req, res));
  app.post("/api/services/:id/stop", (req, res) => serviceController.lifecycle("stop", req, res));
  app.post("/api/services/:id/restart", (req, res) => serviceController.lifecycle("restart", req, res));
  app.get("/api/services/:id/actions/install", (req, res) => serviceController.lifecycle("install", req, res));
  app.get("/api/services/:id/actions/start", (req, res) => serviceController.lifecycle("start", req, res));
  app.get("/api/services/:id/actions/stop", (req, res) => serviceController.lifecycle("stop", req, res));
  app.get("/api/services/:id/actions/restart", (req, res) => serviceController.lifecycle("restart", req, res));
  app.delete("/api/services/:id/uninstall", (req, res) => serviceController.lifecycle("uninstall", req, res));
  app.get("/api/services/:id/status", (req, res) => serviceController.status(req, res));
  app.put("/api/services/:id/config", (req, res) => serviceController.updateConfig(req, res));
  app.get("/api/services/:id/config/backups", (req, res) => serviceController.backups(req, res));
  app.post("/api/services/:id/config/backups", (req, res) => serviceController.backupConfig(req, res));
  app.get("/api/services/:id/config/actions/backup", (req, res) => serviceController.backupConfig(req, res));
  app.post("/api/services/:id/config/backups/:backupId/restore", (req, res) => serviceController.restoreConfig(req, res));
  app.get("/api/services/:id/config/backups/:backupId/actions/restore", (req, res) => serviceController.restoreConfig(req, res));
  app.get("/api/services/:id/metrics", (req, res) => monitorController.metrics(req, res));
  app.get("/api/services/:id/logs", (req, res) => logController.index(req, res));
  app.delete("/api/services/:id/logs", (req, res) => logController.clear(req, res));
  app.get("/api/services/:id/versions", (req, res) => versionController.index(req, res));
  app.post("/api/services/:id/upgrade", (req, res) => versionController.upgradeService(req, res));
  app.post("/api/services/:id/rollback", (req, res) => versionController.rollbackService(req, res));
  app.get("/api/services/:id/actions/upgrade", (req, res) => versionController.upgradeService(req, res));
  app.get("/api/services/:id/actions/rollback", (req, res) => versionController.rollbackService(req, res));
  app.get("/api/services/:id", (req, res) => serviceController.show(req, res));
}
