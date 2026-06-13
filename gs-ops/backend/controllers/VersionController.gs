import { BaseController } from "./BaseController.gs";
import { currentOperator } from "../utils/system.gs";

export class VersionController extends BaseController {
  constructor(versionManager) {
    super();
    this.versionManager = versionManager;
  }

  index(req, res) {
    let versions = this.versionManager.list(req.params.id);
    return this.ok(res, versions);
  }

  upgradeService(req, res) {
    try {
      let version = null;
      if (req.query && req.query.version) {
        version = req.query.version;
      }

      let result = this.versionManager.upgradeServiceVersion(req.params.id, version, currentOperator(req), req.body || {});
      if (result === null) {
        return this.notFound(res, "service not found");
      }
      if (result.error) {
        return this.badRequest(res, "service upgrade failed", result.error);
      }

      return this.ok(res, result, "service upgraded");
    } catch (e) {
      return this.badRequest(res, "service upgrade failed", String(e));
    }
  }

  rollbackService(req, res) {
    try {
      let version = null;
      if (req.query && req.query.version) {
        version = req.query.version;
      }

      let result = this.versionManager.rollbackServiceVersion(req.params.id, version, currentOperator(req));
      if (result === null) {
        return this.notFound(res, "service not found");
      }
      if (result.error) {
        return this.badRequest(res, "service rollback failed", result.error);
      }

      return this.ok(res, result, "service rolled back");
    } catch (e) {
      return this.badRequest(res, "service rollback failed", String(e));
    }
  }
}
