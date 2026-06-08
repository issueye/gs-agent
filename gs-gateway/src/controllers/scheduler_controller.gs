import { ok, created, fail } from "@/views/response";

export function createSchedulerController(model) {
  function list(req, res) {
    return ok(res, model.list(req.query || {}));
  }

  function create(req, res) {
    return created(res, model.create(req.body || {}));
  }

  function get(req, res) {
    let schedule = model.get(req.params.id);
    if (!schedule) {
      return fail(res, 404, "NOT_FOUND", "schedule not found");
    }
    return ok(res, schedule);
  }

  function update(req, res) {
    let schedule = model.update(req.params.id, req.body || {});
    if (!schedule) {
      return fail(res, 404, "NOT_FOUND", "schedule not found");
    }
    return ok(res, schedule);
  }

  function remove(req, res) {
    let schedule = model.remove(req.params.id);
    if (!schedule) {
      return fail(res, 404, "NOT_FOUND", "schedule not found");
    }
    return ok(res, schedule);
  }

  function runDue(req, res) {
    return ok(res, model.dueToTasks(req.body || req.query || {}));
  }

  return {
    list: list,
    create: create,
    get: get,
    update: update,
    remove: remove,
    runDue: runDue,
  };
}
