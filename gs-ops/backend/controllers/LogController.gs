import { BaseController } from "./BaseController.gs";

export class LogController extends BaseController {
  constructor(logManager) {
    super();
    this.logManager = logManager;
  }

  index(req, res) {
    let query = "";
    if (req.query && req.query.q) {
      query = req.query.q;
    }

    return this.ok(res, this.logManager.list(req.params.id, query));
  }

  clear(req, res) {
    return this.ok(res, this.logManager.clear(req.params.id, "admin"), "logs cleared");
  }
}
