import { ok, created, fail } from "@/views/response";
import { createSkillsModel } from "@/models/skills";

function parsedGatewayError(error) {
  let message = error && error.message ? String(error.message) : String(error);
  if (!message.startsWith("GATEWAY_ERROR|")) {
    return {
      status: 500,
      code: "SKILL_ADMIN_ERROR",
      message: message || "skill admin error",
    };
  }
  let parts = message.split("|");
  return {
    status: Number(parts[1] || 500),
    code: parts[2] || "SKILL_ADMIN_ERROR",
    message: parts.slice(3).join("|") || "skill admin error",
  };
}

function toFailure(res, error) {
  let parsed = parsedGatewayError(error);
  return fail(res, parsed.status, parsed.code, parsed.message);
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
