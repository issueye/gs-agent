import { BaseController } from "./BaseController.gs";
import { currentOperator } from "../utils/system.gs";

export class ActionController extends BaseController {
  constructor(serviceManager, versionManager) {
    super();
    this.serviceManager = serviceManager;
    this.versionManager = versionManager;
  }

  run(req, res) {
    try {
      let action = req.params.action;
      let serviceId = req.params.id;

      if (action === "start" || action === "stop" || action === "restart" || action === "install") {
        let service = this.serviceManager.runLifecycle(serviceId, action, currentOperator(req));
        if (service === null) {
          return this.notFound(res, "service not found");
        }
        return this.ok(res, service, "service " + action + " success");
      }

      if (action === "backup-config") {
        let backup = this.serviceManager.backupConfig(serviceId, currentOperator(req));
        if (backup === null) {
          return this.notFound(res, "service not found");
        }
        return this.ok(res, backup, "service config backed up");
      }

      if (action === "upgrade") {
        let version = null;
        if (req.query && req.query.version) {
          version = req.query.version;
        }
        let result = this.versionManager.upgradeServiceVersion(serviceId, version, currentOperator(req));
        if (result === null) {
          return this.notFound(res, "service not found");
        }
        return this.ok(res, result, "service upgraded");
      }

      if (action === "rollback") {
        let version = null;
        if (req.query && req.query.version) {
          version = req.query.version;
        }
        let result = this.versionManager.rollbackServiceVersion(serviceId, version, currentOperator(req));
        if (result === null) {
          return this.notFound(res, "service not found");
        }
        return this.ok(res, result, "service rolled back");
      }

      return this.badRequest(res, "unknown action");
    } catch (e) {
      return this.badRequest(res, "action failed", String(e));
    }
  }

  restoreConfig(req, res) {
    try {
      let service = this.serviceManager.restoreConfig(req.params.id, req.params.backupId, currentOperator(req));
      if (service === null) {
        return this.notFound(res, "backup not found");
      }

      return this.ok(res, service, "service config restored");
    } catch (e) {
      return this.badRequest(res, "restore failed", String(e));
    }
  }
}
