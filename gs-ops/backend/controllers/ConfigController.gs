import { BaseController } from "./BaseController.gs";
import { runtimeInfo } from "../utils/system.gs";

export class ConfigController extends BaseController {
  health(req, res) {
    return this.ok(res, {
      status: "ok",
      runtime: runtimeInfo(),
    });
  }
}

