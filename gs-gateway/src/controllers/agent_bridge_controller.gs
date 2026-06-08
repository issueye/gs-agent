import { ok, fail } from "@/views/response";

export function createAgentBridgeController(model) {
  function run(req, res) {
    try {
      let body = req.body || {};
      let task = model.runTask(req.params.id, {
        dryRun: !!body.dryRun,
        mode: body.mode || "fake",
        allowReal: !!body.allowReal,
      });
      return ok(res, task);
    } catch (error) {
      if (error && error.message === "task not found") {
        return fail(res, 404, "NOT_FOUND", "task not found");
      }
      let message = error.message || String(error);
      if (message.includes("real agent execution is disabled")) {
        return fail(res, 403, "REAL_AGENT_DISABLED", message);
      }
      return fail(res, error.status || 500, error.code || "AGENT_BRIDGE_RUN_FAILED", message);
    }
  }

  return {
    run: run,
  };
}
