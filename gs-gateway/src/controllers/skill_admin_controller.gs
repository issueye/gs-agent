import { ok, created, fail } from "@/views/response";
import { createSkillsModel } from "@/models/skills";

function toFailure(res, error) {
  return fail(res, error.status || 500, error.code || "SKILL_ADMIN_ERROR", error.message || "skill admin error");
}

export function createSkillAdminController(model) {
  let skills = model.skills || createSkillsModel(model);

  function create(req, res) {
    try {
      return created(res, skills.create(req.body || {}));
    } catch (error) {
      return toFailure(res, error);
    }
  }

  function update(req, res) {
    try {
      return ok(res, skills.update(req.params.name, req.body || {}));
    } catch (error) {
      return toFailure(res, error);
    }
  }

  function remove(req, res) {
    try {
      return ok(res, skills.remove(req.params.name));
    } catch (error) {
      return toFailure(res, error);
    }
  }

  return {
    create: create,
    update: update,
    remove: remove,
  };
}
