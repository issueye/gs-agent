import { BaseController } from "./BaseController.gs";
import { currentOperator } from "../utils/system.gs";

export class ServiceController extends BaseController {
  constructor(serviceManager) {
    super();
    this.serviceManager = serviceManager;
  }

  index(req, res) {
    return this.ok(res, this.serviceManager.list());
  }

  templates(req, res) {
    return this.ok(res, this.serviceManager.templates());
  }

  create(req, res) {
    try {
      let service = this.serviceManager.createFromTemplate(req.body || {}, currentOperator(req));
      return this.created(res, service, "service created");
    } catch (e) {
      return this.badRequest(res, "service create failed", String(e));
    }
  }

  show(req, res) {
    let service = this.serviceManager.find(req.params.id);
    if (service === null) {
      return this.notFound(res, "service not found");
    }

    return this.ok(res, service);
  }

  lifecycle(operation, req, res) {
    try {
      let service = this.serviceManager.runLifecycle(req.params.id, operation, currentOperator(req));
      if (service === null) {
        return this.notFound(res, "service not found");
      }

      return this.ok(res, service, "service " + operation + " success");
    } catch (e) {
      return this.badRequest(res, "service action failed", String(e));
    }
  }

  status(req, res) {
    let service = this.serviceManager.find(req.params.id);
    if (service === null) {
      return this.notFound(res, "service not found");
    }

    return this.ok(res, {
      id: service.id,
      status: service.status,
      pid: service.pid,
      uptime: service.uptime,
      updatedAt: service.updatedAt,
    });
  }

  updateConfig(req, res) {
    let service = this.serviceManager.updateConfig(req.params.id, req.body || {}, currentOperator(req));
    if (service === null) {
      return this.notFound(res, "service not found");
    }

    return this.ok(res, service, "service config updated");
  }

  backups(req, res) {
    let backups = this.serviceManager.backups(req.params.id);
    if (backups === null) {
      return this.notFound(res, "service not found");
    }

    return this.ok(res, backups);
  }

  backupConfig(req, res) {
    let backup = this.serviceManager.backupConfig(req.params.id, currentOperator(req));
    if (backup === null) {
      return this.notFound(res, "service not found");
    }

    return this.ok(res, backup, "service config backed up");
  }

  restoreConfig(req, res) {
    let service = this.serviceManager.restoreConfig(req.params.id, req.params.backupId, currentOperator(req));
    if (service === null) {
      return this.notFound(res, "backup not found");
    }

    return this.ok(res, service, "service config restored");
  }
}
