import { ok, created, fail } from "../utils/response.gs";

export class BaseController {
  ok(res, data, message = "ok") {
    return ok(res, data, message);
  }

  created(res, data, message = "created") {
    return created(res, data, message);
  }

  notFound(res, message = "resource not found") {
    return fail(res, 404, message);
  }

  badRequest(res, message, details = null) {
    return fail(res, 400, message, details);
  }
}
