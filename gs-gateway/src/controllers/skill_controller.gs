import { ok, fail } from "@/views/response";

export function createSkillController(model) {
  function list(req, res) {
    return ok(res, model.agent.listSkills());
  }

  function get(req, res) {
    let skill = model.agent.readSkill(req.params.name);
    if (!skill) {
      return fail(res, 404, "NOT_FOUND", "skill not found");
    }
    return ok(res, skill);
  }

  return {
    list: list,
    get: get,
  };
}
