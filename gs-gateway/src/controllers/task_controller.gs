import { ok, created, fail } from "@/views/response";

export function createTaskController(model) {
  function list(req, res) {
    return ok(res, model.store.listTasks(req.query.status, req.query.limit));
  }

  function create(req, res) {
    return created(res, model.store.createTask(req.body || {}));
  }

  function get(req, res) {
    let task = model.store.getTask(req.params.id);
    if (!task) {
      return fail(res, 404, "NOT_FOUND", "task not found");
    }
    return ok(res, task);
  }

  function update(req, res) {
    let task = model.store.updateTask(req.params.id, req.body || {});
    if (!task) {
      return fail(res, 404, "NOT_FOUND", "task not found");
    }
    return ok(res, task);
  }

  return {
    list: list,
    create: create,
    get: get,
    update: update,
  };
}
