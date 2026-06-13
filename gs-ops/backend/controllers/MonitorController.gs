import { BaseController } from "./BaseController.gs";

export class MonitorController extends BaseController {
  constructor(serviceManager) {
    super();
    this.serviceManager = serviceManager;
  }

  metrics(req, res) {
    let metrics = this.serviceManager.metrics(req.params.id);
    if (metrics === null) {
      return this.notFound(res, "service not found");
    }

    return this.ok(res, metrics);
  }
}

